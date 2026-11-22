const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
const InfiniteQuestionEngine = require('./public/infinite-questions.js');

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_TIKTOK_USER = (process.env.TIKTOK_USER || 'bakuremixlab').trim().replace(/^@+/, '').toLowerCase();
const PUBLIC_DIR = path.join(__dirname, 'public');
const QUESTIONS_PATH = path.join(PUBLIC_DIR, 'questions.json');
const VIRTUAL_COMBINATION_COUNT = InfiniteQuestionEngine.VIRTUAL_COMBINATION_COUNT || 10000;

const GAME_SEQ = ['millionaire', 'flag', 'truefalse', 'word', 'speed'];
const MODE_TIMES = { millionaire: 25, flag: 22, truefalse: 18, word: 28, speed: 24 };
const MODE_SIZES = { millionaire: 8, flag: 6, truefalse: 8, word: 6, speed: 6 };
const MODE_META = {
  millionaire: { icon: '💰', name: 'Milyonçu Şousu' },
  flag: { icon: '🏳️', name: 'Bayrağı Tap' },
  truefalse: { icon: '⚡', name: 'Doğru yoxsa Yanlış' },
  word: { icon: '🔤', name: 'Söz & Emoji Tapmacası' },
  speed: { icon: '🎯', name: 'Sürət Dueli' }
};

const app = express();

// ==================== THEME SETTINGS (persisted) ====================
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
const THEMES = ['auto', 'classic', 'gold', 'azerbaijan', 'neon', 'galaxy', 'fire'];
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) || {};
  } catch {
    return {};
  }
}
function saveSettings(patch) {
  try {
    const next = { ...loadSettings(), ...patch };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  } catch (err) {
    console.warn('[Settings] yazila bilmedi:', err.message);
  }
}
const initialSettings = loadSettings();
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true, connected: tiktok.connected }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ==================== QUESTION BANK ====================
let baseQuestions = [];

function loadQuestionsFromDisk() {
  try {
    const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    baseQuestions = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Questions] Oxuma xətası:', err.message);
    baseQuestions = [];
  }
}

function saveQuestionsToDisk() {
  try {
    fs.writeFileSync(QUESTIONS_PATH, JSON.stringify(baseQuestions, null, 2), 'utf8');
  } catch (err) {
    console.error('[Questions] Yazma xətası:', err.message);
  }
}

loadQuestionsFromDisk();

app.get('/api/questions', (_req, res) => {
  res.json({
    baseTotal: baseQuestions.length,
    virtualCombinations: VIRTUAL_COMBINATION_COUNT,
    total: baseQuestions.length + VIRTUAL_COMBINATION_COUNT,
    questions: baseQuestions
  });
});

app.post('/api/questions', (req, res) => {
  const { question, options, correct, hint } = req.body || {};
  if (!question || !options || !options.A || !options.B || !options.C || !options.D) {
    return res.status(400).json({ error: 'Bütün sual və variant sahələri doldurulmalıdır.' });
  }
  const maxId = baseQuestions.reduce((m, q) => Math.max(m, Number(q.id) || 0), 0);
  const newQ = {
    id: maxId + 1,
    difficulty: 2,
    question: String(question).trim(),
    options: {
      A: String(options.A).trim(),
      B: String(options.B).trim(),
      C: String(options.C).trim(),
      D: String(options.D).trim()
    },
    correct: ['A', 'B', 'C', 'D'].includes(correct) ? correct : 'A',
    hint: String(hint || '').trim()
  };
  baseQuestions.push(newQ);
  saveQuestionsToDisk();
  res.status(201).json(newQ);
});

app.delete('/api/questions/:id', (req, res) => {
  const id = String(req.params.id);
  const before = baseQuestions.length;
  baseQuestions = baseQuestions.filter((q) => String(q.id) !== id);
  if (baseQuestions.length !== before) {
    saveQuestionsToDisk();
  }
  res.json({ deleted: before - baseQuestions.length });
});

// ==================== GAME ENGINE ====================
const game = {
  activeGame: 'millionaire',
  autoRotateGames: true,
  roundNumber: 1,
  phase: 'question',
  qIndex: 0,
  questions: [],
  timeLeft: 25,
  questionTime: 25,
  customQuestionTime: null,
  soundMuted: false,
  theme: THEMES.includes(initialSettings.theme) ? initialSettings.theme : 'auto',
  votes: { A: 0, B: 0, C: 0, D: 0 },
  voters: new Map(),
  speedWinners: [],
  eliminatedOptions: [],
  audiencePoll: null,
  phoneTip: null,
  leaderboard: new Map(),
  seen: {
    millionaire: new Set(),
    flag: new Set(),
    truefalse: new Set(),
    word: new Set(),
    speed: new Set()
  },
  timer: null,
  phaseTimeout: null
};

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildWordMask(rawQ) {
  if (!rawQ || game.activeGame !== 'word' || !rawQ.answerWord) return rawQ;
  const word = rawQ.answerWord;
  const elapsed = Math.max(0, game.questionTime - game.timeLeft);
  const lettersOnly = word.replace(/\s+/g, '');
  const hintSteps =
    game.phase === 'reveal'
      ? lettersOnly.length
      : elapsed >= 18
        ? Math.min(lettersOnly.length, Math.max(2, Math.ceil(lettersOnly.length * 0.5)))
        : elapsed >= 10
          ? 1
          : 0;
  let nonSpaceIdx = 0;
  const mask = word
    .split('')
    .map((c) => {
      if (c === ' ') return '   ';
      const show = nonSpaceIdx < hintSteps;
      nonSpaceIdx++;
      return show ? c : '_';
    })
    .join(' ');
  return { ...rawQ, revealedMask: mask, wordLength: lettersOnly.length };
}

function buildClientState() {
  const rawQ = game.questions[game.qIndex] || null;
  const nextIdx = (GAME_SEQ.indexOf(game.activeGame) + 1) % GAME_SEQ.length;
  const nextId = GAME_SEQ[nextIdx];
  return {
    activeGame: game.activeGame,
    nextGameMeta: MODE_META[nextId],
    autoRotateGames: game.autoRotateGames,
    roundNumber: game.roundNumber,
    phase: game.phase,
    qIndex: game.qIndex,
    totalInRound: game.questions.length,
    questionTime: game.questionTime,
    timeLeft: game.timeLeft,
    soundMuted: game.soundMuted,
    theme: game.theme,
    serverAudioActive: false,
    currentQuestion: buildWordMask(rawQ),
    votes: game.votes,
    speedWinners: game.speedWinners,
    eliminatedOptions: game.eliminatedOptions,
    audiencePoll: game.audiencePoll,
    phoneTip: game.phoneTip,
    leaderboard: Array.from(game.leaderboard.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  };
}

function broadcastState() {
  io.emit('game-state-sync', buildClientState());
}

function startRound(mode) {
  const active = GAME_SEQ.includes(mode) ? mode : 'millionaire';
  clearInterval(game.timer);
  clearTimeout(game.phaseTimeout);

  game.activeGame = active;
  game.questionTime = game.customQuestionTime || MODE_TIMES[active] || 25;
  game.qIndex = 0;
  game.leaderboard.clear();

  const size = MODE_SIZES[active] || 8;
  if (active === 'flag') {
    let qs = InfiniteQuestionEngine.generateFlagRound(size, game.seen.flag);
    if (qs.length < size) {
      game.seen.flag.clear();
      qs = InfiniteQuestionEngine.generateFlagRound(size, game.seen.flag);
    }
    qs.forEach((q) => game.seen.flag.add(q.flagCode));
    game.questions = qs;
  } else if (active === 'truefalse') {
    let qs = InfiniteQuestionEngine.generateTrueFalseRound(size, game.seen.truefalse);
    if (qs.length < size) {
      game.seen.truefalse.clear();
      qs = InfiniteQuestionEngine.generateTrueFalseRound(size, game.seen.truefalse);
    }
    qs.forEach((q) => game.seen.truefalse.add(q.question));
    game.questions = qs;
  } else if (active === 'word') {
    let qs = InfiniteQuestionEngine.generateWordRound(size, game.seen.word);
    if (qs.length < size) {
      game.seen.word.clear();
      qs = InfiniteQuestionEngine.generateWordRound(size, game.seen.word);
    }
    qs.forEach((q) => game.seen.word.add(q.answerWord));
    game.questions = qs;
  } else if (active === 'speed') {
    let qs = InfiniteQuestionEngine.generateSpeedRound(size, game.seen.speed);
    if (qs.length < size) {
      game.seen.speed.clear();
      qs = InfiniteQuestionEngine.generateSpeedRound(size, game.seen.speed);
    }
    qs.forEach((q) => game.seen.speed.add(q.question));
    game.questions = qs;
  } else {
    let pool = baseQuestions.filter((q) => !game.seen.millionaire.has(q.question));
    if (pool.length < 4 && baseQuestions.length > 0) {
      game.seen.millionaire.clear();
      pool = [...baseQuestions];
    }
    pool = shuffleArray(pool);
    const cur = pool.slice(0, 5);
    cur.forEach((q) => game.seen.millionaire.add(q.question));
    const dynNeed = Math.max(0, size - cur.length);
    const dyn = InfiniteQuestionEngine.generateDynamicBatch(2, dynNeed, game.seen.millionaire);
    dyn.forEach((q) => game.seen.millionaire.add(q.question));
    game.questions = shuffleArray([...cur, ...dyn]).slice(0, size);
  }

  loadQuestion(0);
}

function loadQuestion(idx) {
  clearInterval(game.timer);
  clearTimeout(game.phaseTimeout);
  game.qIndex = idx;
  game.phase = 'question';
  game.questionTime = game.customQuestionTime || MODE_TIMES[game.activeGame] || 25;
  game.timeLeft = game.questionTime;
  game.votes = { A: 0, B: 0, C: 0, D: 0 };
  game.voters.clear();
  game.speedWinners = [];
  game.eliminatedOptions = [];
  game.audiencePoll = null;
  game.phoneTip = null;
  broadcastState();

  game.timer = setInterval(() => {
    if (game.phase !== 'question') return;
    game.timeLeft = Math.max(0, game.timeLeft - 1);
    broadcastState();
    if (game.timeLeft <= 0) {
      revealAnswer();
    }
  }, 1000);
}

function awardPoints(uniqueId, nickname, pts) {
  const prev = game.leaderboard.get(uniqueId) || { uniqueId, nickname, score: 0 };
  prev.score += pts;
  prev.nickname = nickname;
  game.leaderboard.set(uniqueId, prev);
}

function revealAnswer() {
  if (game.phase !== 'question') return;
  clearInterval(game.timer);
  clearTimeout(game.phaseTimeout);
  game.phase = 'reveal';

  const q = game.questions[game.qIndex];
  const mode = game.activeGame;

  if (q && mode !== 'word' && mode !== 'speed') {
    const pts = mode === 'truefalse' ? 100 : 150 + game.qIndex * 25;
    for (const [uid, info] of game.voters.entries()) {
      if (info.choice === q.correct) {
        awardPoints(uid, info.nickname, pts);
      }
    }
  }

  broadcastState();
  game.phaseTimeout = setTimeout(() => {
    if (game.qIndex + 1 < game.questions.length) {
      loadQuestion(game.qIndex + 1);
    } else {
      game.phase = 'victory';
      broadcastState();
      game.phaseTimeout = setTimeout(() => {
        game.roundNumber++;
        const nextIdx = (GAME_SEQ.indexOf(game.activeGame) + 1) % GAME_SEQ.length;
        startRound(game.autoRotateGames ? GAME_SEQ[nextIdx] : game.activeGame);
      }, 5500);
    }
  }, 4000);
}

function normalizeCyrillicLetters(str) {
  return String(str || '')
    .replace(/[\u0410\u0430]/g, 'a')
    .replace(/[\u0412\u0432]/g, 'b')
    .replace(/[\u0421\u0441]/g, 'c')
    .replace(/[\u0414\u0434]/g, 'd')
    .replace(/🅰️?/g, 'A')
    .replace(/🅱️?/g, 'B');
}

function parseAnswerChoice(clean, norm, mode, q) {
  const cleanLatin = normalizeCyrillicLetters(clean);
  if (mode === 'truefalse') {
    if (/^(a|1|dogru|duz|duzdur|he|beli|true|t)$/.test(norm)) return 'A';
    if (/^(b|2|yanlis|sehv|yox|xeyr|false|f)$/.test(norm)) return 'B';
  }

  const m =
    cleanLatin.match(/^[\s!@#.*\-]*([A-Da-d1-4])(?:[\s.,!?:;)\]]|$)/) ||
    cleanLatin.match(/(?:^|\s)(?:cavab|variant|secim|cvb|var)[:=\-\s]+([A-Da-d1-4])(?:\s|$|[.,!?)])/i) ||
    cleanLatin.match(/^([A-Da-d1-4])\s*(?:variant|varianti|cavab|cvb)\b/i);

  if (m) {
    const map14 = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    const ch = m[1].toUpperCase();
    return map14[ch] || ch;
  }

  if (mode === 'flag' && q && q.options) {
    for (const l of ['A', 'B', 'C', 'D']) {
      if (q.options[l] && InfiniteQuestionEngine.normalizeAz(q.options[l]) === norm) return l;
    }
    if (Array.isArray(q.answerAliases) && q.answerAliases.some((a) => InfiniteQuestionEngine.normalizeAz(a) === norm)) {
      return q.correct;
    }
  }
  return null;
}

function handleViewerChat({ uniqueId, nickname, comment }) {
  if (game.phase !== 'question') return;
  const q = game.questions[game.qIndex];
  if (!q || !comment) return;

  const mode = game.activeGame;
  const clean = String(comment).trim();
  const norm = InfiniteQuestionEngine.normalizeAz(clean);

  if (mode === 'word' || mode === 'speed') {
    if (game.speedWinners.some((w) => w.uniqueId === uniqueId)) return;
    const aliases = Array.isArray(q.answerAliases) && q.answerAliases.length ? q.answerAliases : [q.answerWord || ''];
    const matched = aliases.some((a) => {
      const na = InfiniteQuestionEngine.normalizeAz(a);
      if (!na) return false;
      if (norm === na) return true;
      return na.includes(' ') ? norm.includes(na) : norm.split(' ').includes(na);
    });
    if (!matched) return;

    const rank = game.speedWinners.length + 1;
    if (rank > 3) return;
    const points = rank === 1 ? 300 : rank === 2 ? 200 : 100;
    game.speedWinners.push({ uniqueId, nickname, rank, points, text: clean });
    awardPoints(uniqueId, nickname, points);
    io.emit('chat-vote', { nickname, rawText: clean, matchedSpeed: true, rank, points });
    broadcastState();
    if (game.speedWinners.length >= 3) {
      setTimeout(() => {
        if (game.phase === 'question') revealAnswer();
      }, 1400);
    }
    return;
  }

  const choice = parseAnswerChoice(clean, norm, mode, q);
  if (!choice || game.eliminatedOptions.includes(choice)) return;
  if (mode === 'truefalse' && choice !== 'A' && choice !== 'B') return;

  const prev = game.voters.get(uniqueId);
  if (prev) {
    if (prev.choice === choice) return;
    game.votes[prev.choice] = Math.max(0, (game.votes[prev.choice] || 0) - 1);
  }
  game.voters.set(uniqueId, { choice, nickname });
  game.votes[choice] = (game.votes[choice] || 0) + 1;

  io.emit('chat-vote', { nickname, choice, votes: game.votes });
  broadcastState();
}

function useLifeline(type) {
  const q = game.questions[game.qIndex];
  if (!q || game.phase !== 'question') return;
  if (type === '5050' && game.activeGame === 'millionaire' && game.eliminatedOptions.length === 0) {
    const wrongs = ['A', 'B', 'C', 'D'].filter((l) => l !== q.correct);
    game.eliminatedOptions = wrongs.slice(0, 2);
    broadcastState();
  } else if (type === 'audience' && !game.audiencePoll) {
    const pcts = { A: 0, B: 0, C: 0, D: 0 };
    const letters = game.activeGame === 'truefalse' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
    const corrPct = 55 + Math.floor(Math.random() * 20);
    pcts[q.correct] = corrPct;
    let rem = 100 - corrPct;
    const others = letters.filter((l) => l !== q.correct && !game.eliminatedOptions.includes(l));
    others.forEach((l, idx) => {
      pcts[l] = idx === others.length - 1 ? rem : Math.floor(rem / 2);
      rem -= pcts[l];
    });
    game.audiencePoll = pcts;
    broadcastState();
  } else if (type === 'phone' && !game.phoneTip) {
    game.phoneTip =
      game.activeGame === 'word' || game.activeGame === 'speed'
        ? `İpucu: ${q.hint || 'İlk hərflərə baxın!'}`
        : `Dostunun fikri: Məncə ${q.correct} variantıdır! (${q.hint || 'Uğurlar'})`;
    broadcastState();
  }
}

function simulateVote(count = 1) {
  const q = game.questions[game.qIndex];
  if (!q || game.phase !== 'question') return;
  const names = ['Nicat_AZ', 'Aysel_99', 'Tural_Baku', 'Orxan_Pro', 'Nigar_Live', 'Fidan_Star'];
  for (let i = 0; i < count; i++) {
    const nick = names[Math.floor(Math.random() * names.length)];
    const uid = `sim_${nick}_${Math.floor(Math.random() * 3)}`;
    if (game.activeGame === 'word' || game.activeGame === 'speed') {
      const comment = Math.random() < 0.65 ? q.answerWord : 'Bilmədim';
      handleViewerChat({ uniqueId: uid, nickname: nick, comment });
    } else {
      const opts = game.activeGame === 'truefalse' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
      const comment = Math.random() < 0.6 ? q.correct : opts[Math.floor(Math.random() * opts.length)];
      handleViewerChat({ uniqueId: uid, nickname: nick, comment });
    }
  }
}

// ==================== TIKTOK LIVE CONNECTOR ====================
const tiktok = {
  conn: null,
  username: DEFAULT_TIKTOK_USER,
  connecting: false,
  connected: false,
  viewerCount: 0,
  error: '',
  manualDisconnect: false,
  reconnectTimer: null
};

function emitTikTokStatus() {
  io.emit('tiktok-status', {
    connecting: tiktok.connecting,
    connected: tiktok.connected,
    username: tiktok.username,
    viewerCount: tiktok.viewerCount,
    error: tiktok.error
  });
}

async function disconnectTikTok(manual = true) {
  clearTimeout(tiktok.reconnectTimer);
  tiktok.reconnectTimer = null;
  if (manual) tiktok.manualDisconnect = true;
  tiktok.connecting = false;
  tiktok.connected = false;
  tiktok.viewerCount = 0;
  if (tiktok.conn) {
    const oldConn = tiktok.conn;
    tiktok.conn = null;
    try {
      oldConn.removeAllListeners();
      await oldConn.disconnect();
    } catch (_) {}
  }
  if (manual) {
    tiktok.error = 'Bağlantı dayandırıldı';
    emitTikTokStatus();
  }
}

function scheduleReconnect(delayMs = 6000) {
  if (tiktok.manualDisconnect || !tiktok.username) return;
  clearTimeout(tiktok.reconnectTimer);
  tiktok.reconnectTimer = setTimeout(() => {
    if (!tiktok.manualDisconnect && !tiktok.connected && !tiktok.connecting) {
      connectTikTok(tiktok.username, false);
    }
  }, delayMs);
}

async function connectTikTok(rawUsername, isManual = true) {
  const clean = String(rawUsername || tiktok.username || DEFAULT_TIKTOK_USER)
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
  if (!clean) return;

  await disconnectTikTok(false);
  tiktok.manualDisconnect = false;
  tiktok.username = clean;
  tiktok.connecting = true;
  tiktok.connected = false;
  tiktok.error = '';
  emitTikTokStatus();

  console.log(`[TikTok] @${clean} canlı yayımına qoşulur...`);
  const conn = new TikTokLiveConnection(clean, {
    processInitialData: false,
    enableExtendedGiftInfo: false
  });
  tiktok.conn = conn;

  conn.on(WebcastEvent.CHAT, (data) => {
    if (tiktok.conn !== conn) return;
    const uniqueId = data.user?.displayId || data.user?.uniqueId || data.user?.id || data.user?.userId || data.uniqueId || 'viewer';
    const nickname = data.user?.nickname || uniqueId;
    const comment = String(data.content ?? data.comment ?? '').trim();
    if (!comment) return;
    console.log(`[CHAT] ${nickname} (@${uniqueId}): ${comment}`);
    handleViewerChat({ uniqueId, nickname, comment });
  });

  conn.on(WebcastEvent.ROOM_USER, (data) => {
    if (tiktok.conn !== conn) return;
    const rawVc = data.viewerCount ?? data.total ?? data.totalUser;
    if (rawVc !== undefined && rawVc !== null && rawVc !== '') {
      const vc = Number(rawVc);
      if (Number.isFinite(vc)) {
        tiktok.viewerCount = vc;
        emitTikTokStatus();
      }
    }
  });

  conn.on(WebcastEvent.GIFT, (data) => {
    if (tiktok.conn !== conn) return;
    const giftType = data.giftDetails?.giftType ?? data.gift?.type;
    if (giftType === 1 && !data.repeatEnd) return;
    io.emit('tiktok-gift', {
      nickname: data.user?.nickname || data.user?.displayId || data.user?.uniqueId || 'İzləyici',
      giftName: data.giftDetails?.giftName || data.gift?.name || `Hədiyyə #${data.giftId}`,
      repeatCount: data.repeatCount || 1
    });
  });

  conn.on(WebcastEvent.STREAM_END, () => {
    if (tiktok.conn !== conn) return;
    console.log(`[TikTok] @${clean} canlı yayımı bitdi.`);
    tiktok.connected = false;
    tiktok.connecting = false;
    tiktok.viewerCount = 0;
    tiktok.error = 'Canlı yayım bitdi';
    emitTikTokStatus();
    scheduleReconnect(15000);
  });

  conn.on(ControlEvent.DISCONNECTED, (ev) => {
    if (tiktok.conn !== conn) return;
    console.log(`[TikTok] Bağlantı kəsildi:`, ev?.reason || ev?.code || '');
    tiktok.connected = false;
    tiktok.connecting = false;
    tiktok.viewerCount = 0;
    tiktok.error = 'Bağlantı kəsildi — yenidən qoşulur...';
    emitTikTokStatus();
    scheduleReconnect(5000);
  });

  conn.on(ControlEvent.ERROR, (err) => {
    if (tiktok.conn !== conn) return;
    const msg = err?.exception?.message || err?.info || 'TikTok xətası';
    console.error('[TikTok ERROR]', msg);
  });

  try {
    const state = await conn.connect();
    if (tiktok.conn !== conn) return;
    tiktok.connecting = false;
    tiktok.connected = true;
    tiktok.viewerCount = Number(state?.roomInfo?.data?.user_count ?? state?.roomInfo?.user_count ?? 0) || 0;
    tiktok.error = '';
    console.log(`[TikTok] Qoşuldu! Room ID: ${state.roomId}`);
    emitTikTokStatus();
  } catch (err) {
    if (tiktok.conn !== conn) return;
    const rawMsg = err?.message || String(err || '');
    const isOffline = /offline|not live|UserOffline|isn't online/i.test(rawMsg);
    tiktok.connecting = false;
    tiktok.connected = false;
    tiktok.error = isOffline
      ? `@${clean} hazırda canlı yayımda deyil (canlı başlayanda avtomatik qoşulacaq)`
      : `Qoşulma xətası: ${rawMsg.slice(0, 90)}`;
    console.warn(`[TikTok] Qoşulmadı (${isOffline ? 'offline' : rawMsg})`);
    emitTikTokStatus();
    if (!isManual || isOffline) {
      scheduleReconnect(15000);
    }
  }
}

// ==================== SOCKET.IO HANDLERS ====================
io.on('connection', (socket) => {
  socket.emit('game-state-sync', buildClientState());
  socket.emit('tiktok-status', {
    connecting: tiktok.connecting,
    connected: tiktok.connected,
    username: tiktok.username,
    viewerCount: tiktok.viewerCount,
    error: tiktok.error
  });

  socket.on('switch-game', ({ mode } = {}) => startRound(mode));
  socket.on('toggle-auto-rotate', ({ enabled } = {}) => {
    game.autoRotateGames = !!enabled;
    broadcastState();
  });
  socket.on('start-game', ({ mode } = {}) => startRound(mode || game.activeGame));
  socket.on('reveal-answer', () => revealAnswer());
  socket.on('next-question', () => {
    if (game.qIndex + 1 < game.questions.length) {
      loadQuestion(game.qIndex + 1);
    } else {
      startRound(game.activeGame);
    }
  });
  socket.on('toggle-sound', ({ muted } = {}) => {
    game.soundMuted = !!muted;
    broadcastState();
  });
  socket.on('set-question-time', ({ seconds } = {}) => {
    const val = Number(seconds);
    game.customQuestionTime = val >= 10 && val <= 90 ? val : null;
    broadcastState();
  });
  socket.on('set-theme', ({ theme } = {}) => {
    if (!THEMES.includes(theme)) return;
    game.theme = theme;
    saveSettings({ theme });
    broadcastState();
  });
  socket.on('use-lifeline', ({ type } = {}) => useLifeline(type));
  socket.on('connect-tiktok', ({ username } = {}) => connectTikTok(username, true));
  socket.on('disconnect-tiktok', () => disconnectTikTok(true));
  socket.on('simulate-vote', ({ count } = {}) => simulateVote(Number(count) || 1));
  socket.on('manual-chat', ({ nickname, comment } = {}) => {
    handleViewerChat({
      uniqueId: 'manual_host',
      nickname: nickname || 'Aparıcı_Test',
      comment: comment || ''
    });
  });
});

// ==================== BOOT ====================
startRound('millionaire');
server.listen(PORT, () => {
  console.log(`\n================================================`);
  console.log(`  Milyoncu TikTok LIVE Server isleyir!`);
  console.log(`  Aparici Studiyasi : http://localhost:${PORT}`);
  console.log(`  OBS / Studio Link : http://localhost:${PORT}/?overlay=1`);
  console.log(`  TikTok Kanal      : @${tiktok.username}`);
  console.log(`================================================\n`);
  connectTikTok(DEFAULT_TIKTOK_USER, false);
});

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err?.stack || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});
