(function () {
  const GAME_META = {
    millionaire: {
      id: 'millionaire',
      name: 'MİLYONÇU ŞOUSU',
      icon: '💰',
      badgeClass: 'mode-millionaire',
      tag: '💰 BİLİK SUALLARI',
      callout: '💬 Çatda <strong>A</strong>, <strong>B</strong>, <strong>C</strong> və ya <strong>D</strong> yaz — Xal qazan!'
    },
    flag: {
      id: 'flag',
      name: 'BAYRAĞI TAP',
      icon: '🏳️',
      badgeClass: 'mode-flag',
      tag: '🏳️ DÜNYA BAYRAQLARI',
      callout: '💬 Bayrağı tap: <strong>A–D</strong> və ya <strong>ölkənin adını</strong> çatda yaz!'
    },
    truefalse: {
      id: 'truefalse',
      name: 'DOĞRU YOXSA YANLIŞ',
      icon: '⚡',
      badgeClass: 'mode-truefalse',
      tag: '⚡ SÜRƏTLİ FAKTLAR',
      callout: '💬 Çatda <strong>A (Doğru)</strong> və ya <strong>B (Yanlış)</strong> yaz!'
    },
    word: {
      id: 'word',
      name: 'SÖZ & EMOJİ TAPMACASI',
      icon: '🔤',
      badgeClass: 'mode-word',
      tag: '🔤 SÖZÜ TAP & QAZAN',
      callout: '💬 Tapdığın <strong>sözü çatda yaz</strong> — İlk tapan 3 nəfər qazanır!'
    },
    speed: {
      id: 'speed',
      name: 'SÜRƏT DUELİ',
      icon: '🎯',
      badgeClass: 'mode-speed',
      tag: '🎯 İLK YAZAN QAZANIR',
      callout: '💬 Cavabı <strong>ilk yazan 3 nəfər</strong> (+300 / +200 / +100) qazanır!'
    }
  };

  // ==================== MODERN GAME-SHOW WEBAUDIO ENGINE v3 ====================
  // Soft bells, reverb, compressor - no harsh noise / buzz.
  const SoundEngine = {
    ctx: null,
    muted: false,
    master: null,
    reverbIn: null,

    ensureCtx() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this._buildChain(this.ctx);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    },

    unlock() {
      this.ensureCtx();
    },

    _buildChain(ctx) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);

      const conv = ctx.createConvolver();
      conv.buffer = this._impulse(ctx, 2.2, 3.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.3;
      conv.connect(wet);
      wet.connect(master);

      this.master = master;
      this.reverbIn = conv;
    },

    _impulse(ctx, seconds, decay) {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
      }
      return buf;
    },

    _out(node, wet = true) {
      node.connect(this.master);
      if (wet && this.reverbIn) node.connect(this.reverbIn);
    },

    _env(g, t, vol, attack, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    },

    _tone(t, freq, dur, opts = {}) {
      const ctx = this.ctx;
      const { type = 'sine', vol = 0.1, attack = 0.006, wet = true, glideTo = null, lowpass = null } = opts;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
      this._env(g, t, vol, attack, dur);
      let last = osc;
      if (lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = lowpass;
        osc.connect(f);
        last = f;
      }
      last.connect(g);
      this._out(g, wet);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },

    // Crystal bell / marimba-like tone (fundamental + soft harmonics)
    _bell(t, freq, dur = 1, vol = 0.07) {
      this._tone(t, freq, dur, { vol, attack: 0.004 });
      this._tone(t, freq * 2, dur * 0.55, { vol: vol * 0.32, attack: 0.003 });
      this._tone(t, freq * 3.01, dur * 0.3, { vol: vol * 0.12, attack: 0.002 });
    },

    _noise(t, dur, opts = {}) {
      const ctx = this.ctx;
      const { type = 'bandpass', from = 1000, to = null, q = 1, vol = 0.05, attack = 0.01, wet = true } = opts;
      const len = Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.05)));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(from, t);
      if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain();
      this._env(g, t, vol, attack, dur);
      src.connect(f);
      f.connect(g);
      this._out(g, wet);
      src.start(t);
      src.stop(t + dur + 0.05);
    },

    // Soft brass-like synth note (for fanfare)
    _brass(t, freq, dur, vol = 0.05) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 2;
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(2600, t + 0.06);
      f.frequency.exponentialRampToValueAtTime(1100, t + dur);
      this._env(g, t, vol, 0.03, dur);
      f.connect(g);
      this._out(g, true);
      [-6, 6].forEach((det) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.detune.value = det;
        osc.connect(f);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      });
    },

    _sparkles(t, count, spread, vol = 0.018) {
      const notes = [2093, 2349.3, 2637, 3136, 3520, 4186];
      for (let i = 0; i < count; i++) {
        const st = t + Math.random() * spread;
        this._tone(st, notes[Math.floor(Math.random() * notes.length)], 0.35, { vol, attack: 0.002 });
      }
    },

    // Soft clock tick (only last 10 sec). Urgent = tick + heartbeat
    playTick(isUrgent = false) {
      if (this.muted) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      if (isUrgent) {
        this._tone(now, 1320, 0.07, { vol: 0.05, attack: 0.002, wet: false, glideTo: 1000 });
        this._tone(now, 72, 0.2, { vol: 0.22, attack: 0.008, wet: false, glideTo: 46 });
        this._tone(now + 0.17, 66, 0.16, { vol: 0.14, attack: 0.008, wet: false, glideTo: 44 });
      } else {
        this._tone(now, 1050, 0.06, { vol: 0.045, attack: 0.002, wet: false, glideTo: 820 });
        this._noise(now, 0.025, { from: 3200, q: 3, vol: 0.02, attack: 0.001, wet: false });
      }
    },

    // Correct answer (isBig=false) / round victory fanfare (isBig=true)
    playApplause(isBig = false) {
      if (this.muted) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (!isBig) {
        // Bright "success" arpeggio + warm pad + sparkles + distant soft crowd
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._bell(now + i * 0.075, f, 1.1, 0.075));
        [523.25, 659.25, 783.99].forEach((f) =>
          this._tone(now + 0.3, f, 1.3, { type: 'triangle', vol: 0.025, attack: 0.08, lowpass: 2200 })
        );
        this._sparkles(now + 0.25, 8, 0.6);
        this._tone(now, 120, 0.3, { vol: 0.12, attack: 0.005, wet: false, glideTo: 60 });
        this._noise(now + 0.1, 1.5, { type: 'lowpass', from: 1400, q: 0.5, vol: 0.03, attack: 0.25 });
        return;
      }

      // Victory fanfare: G4 C5 E5 -> big C major chord
      [[392.0, 0], [523.25, 0.14], [659.25, 0.28]].forEach(([f, d]) => this._brass(now + d, f, 0.24, 0.05));
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => this._brass(now + 0.46, f, 1.7, 0.04));
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this._bell(now + 0.46 + i * 0.06, f, 1.4, 0.05));
      this._tone(now + 0.46, 110, 0.6, { vol: 0.2, attack: 0.005, wet: false, glideTo: 50 });
      this._sparkles(now + 0.5, 22, 1.6, 0.016);
      this._noise(now + 0.4, 2.3, { type: 'lowpass', from: 1600, q: 0.5, vol: 0.045, attack: 0.3 });
    },

    // New question: airy whoosh + crystal chime
    playOpen() {
      if (this.muted) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      this._noise(now, 0.4, { from: 300, to: 3500, q: 1.2, vol: 0.045, attack: 0.25 });
      [659.25, 830.61, 987.77, 1318.51].forEach((f, i) => this._bell(now + 0.14 + i * 0.07, f, 0.9, 0.06));
      this._tone(now + 0.14, 98, 0.35, { vol: 0.1, attack: 0.005, wet: false, glideTo: 55 });
    },

    // Nobody correct: soft muted "oops" (two descending tones)
    playWrong() {
      if (this.muted) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      this._tone(now, 392.0, 0.28, { type: 'triangle', vol: 0.09, attack: 0.01, lowpass: 900 });
      this._tone(now + 0.17, 311.13, 0.45, { type: 'triangle', vol: 0.09, attack: 0.01, lowpass: 800, glideTo: 293.66 });
    }
  };

  // ==================== DOM REFERENCES ====================
  const el = {
    gameModePill: document.getElementById('gameModePill'),
    gameModeIcon: document.getElementById('gameModeIcon'),
    gameModeName: document.getElementById('gameModeName'),
    roundBadge: document.getElementById('roundBadge'),
    timerWrap: document.getElementById('timerWrap'),
    timerProgress: document.getElementById('timerProgress'),
    timerValue: document.getElementById('timerValue'),
    nextGameLabel: document.getElementById('nextGameLabel'),
    btn5050: document.getElementById('btnLifeline5050'),
    btnAudience: document.getElementById('btnLifelineAudience'),
    btnPhone: document.getElementById('btnLifelinePhone'),
    flagDisplayWrap: document.getElementById('flagDisplayWrap'),
    flagImg: document.getElementById('flagImg'),
    puzzleDisplayWrap: document.getElementById('puzzleDisplayWrap'),
    puzzlePrompt: document.getElementById('puzzlePrompt'),
    puzzleMask: document.getElementById('puzzleMask'),
    puzzleHint: document.getElementById('puzzleHint'),
    speedBadgeWrap: document.getElementById('speedBadgeWrap'),
    qModeTag: document.getElementById('qModeTag'),
    questionText: document.getElementById('questionText'),
    answerRevealBanner: document.getElementById('answerRevealBanner'),
    answerRevealWord: document.getElementById('answerRevealWord'),
    hintToast: document.getElementById('hintToast'),
    optionsGrid: document.getElementById('optionsGrid'),
    speedWinnersBox: document.getElementById('speedWinnersBox'),
    chatCallout: document.getElementById('chatCallout'),
    voteTicker: document.getElementById('voteTicker'),
    stageLiveBadge: document.getElementById('stageLiveBadge'),
    lbList: document.getElementById('lbList'),
    stageOverlay: document.getElementById('stageOverlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlaySub: document.getElementById('overlaySub'),
    overlayPodium: document.getElementById('overlayPodium'),
    overlayNextGameName: document.getElementById('overlayNextGameName'),
    // Control Panel
    connModeBadge: document.getElementById('connModeBadge'),
    autoRotateToggle: document.getElementById('autoRotateToggle'),
    btnStartRound: document.getElementById('btnStartRound'),
    btnReveal: document.getElementById('btnReveal'),
    btnNextQ: document.getElementById('btnNextQ'),
    btnMuteSound: document.getElementById('btnMuteSound'),
    btnTestApplause: document.getElementById('btnTestApplause'),
    btnTestTick: document.getElementById('btnTestTick'),
    questionTimeSelect: document.getElementById('questionTimeSelect'),
    tiktokUserInput: document.getElementById('tiktokUserInput'),
    btnConnectTikTok: document.getElementById('btnConnectTikTok'),
    btnDisconnectTikTok: document.getElementById('btnDisconnectTikTok'),
    tiktokStatusText: document.getElementById('tiktokStatusText'),
    btnSimToggle: document.getElementById('btnSimToggle'),
    btnSimBurst: document.getElementById('btnSimBurst'),
    manualTestInput: document.getElementById('manualTestInput'),
    btnManualTestSend: document.getElementById('btnManualTestSend'),
    questionBankSummary: document.getElementById('questionBankSummary'),
    btnOpenModal: document.getElementById('btnOpenModal'),
    btnCopyObsUrl: document.getElementById('btnCopyObsUrl'),
    obsOverlayUrl: document.getElementById('obsOverlayUrl'),
    questionModal: document.getElementById('questionModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    addQuestionForm: document.getElementById('addQuestionForm'),
    modalQList: document.getElementById('modalQList')
  };

  // ==================== OVERLAY CHECK ====================
  const urlParams = new URLSearchParams(window.location.search);
  const isOverlay = urlParams.get('overlay') === '1' || urlParams.get('obs') === '1';
  if (isOverlay) {
    document.body.classList.add('obs-mode');
  }

  // ==================== RUNTIME STATE ====================
  let socket = null;
  let hasBackend = false;
  let simInterval = null;
  let currentState = null;
  let prevPhase = null;
  let prevTimeLeft = null;
  let prevQId = null;

  function connectSocketIO() {
    if (typeof io === 'undefined') {
      startLocalStandaloneEngine();
      return;
    }

    socket = io({ transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      hasBackend = true;
      if (localGame.timer) {
        clearInterval(localGame.timer);
        localGame.timer = null;
      }
      if (el.connModeBadge) el.connModeBadge.textContent = 'Server Rejimi • Canlı Sinxron';
    });

    socket.on('connect_error', () => {
      if (!hasBackend && !localGame.timer) {
        startLocalStandaloneEngine();
      }
    });

    socket.on('disconnect', () => {
      if (el.connModeBadge) el.connModeBadge.textContent = 'Yenidən Qoşulur...';
    });

    socket.on('game-state-sync', (state) => {
      renderState(state);
    });

    socket.on('chat-vote', (evt) => {
      pushTickerItem(evt);
      if (evt.votes && currentState) {
        currentState.votes = evt.votes;
        renderState(currentState);
      }
    });

    socket.on('tiktok-status', (info) => {
      if (info.connecting) {
        if (el.tiktokStatusText) el.tiktokStatusText.textContent = `⏳ @${info.username} canlı yayımına qoşulur...`;
        if (el.stageLiveBadge) el.stageLiveBadge.textContent = `⏳ @${info.username}`;
      } else if (info.connected) {
        const viewerTxt = info.viewerCount > 0 ? ` • ${info.viewerCount} izləyici` : '';
        if (el.tiktokStatusText) el.tiktokStatusText.textContent = `🟢 Qoşuldu: @${info.username}${viewerTxt}`;
        if (el.stageLiveBadge) el.stageLiveBadge.textContent = `🔴 @${info.username}${viewerTxt}`;
      } else {
        if (el.tiktokStatusText) el.tiktokStatusText.textContent = `⚪ Bağlı deyil: ${info.error || 'Hazır'}`;
        if (el.stageLiveBadge) el.stageLiveBadge.textContent = '● HAZIR';
      }
    });

    socket.on('tiktok-gift', (gift) => {
      pushTickerRaw(`🎁 ${gift.nickname}: ${gift.giftName} x${gift.repeatCount}`, true);
    });
  }

  const isStaticCloudHost = /mygearvibe\.com$|netlify\.app$/i.test(window.location.hostname);
  const defaultCloudUser = (urlParams.get('user') || urlParams.get('username') || 'bakuremixlab')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

  function initSocketOrFallback() {
    if (el.obsOverlayUrl) {
      el.obsOverlayUrl.value = `${window.location.origin}${window.location.pathname}?overlay=1`;
    }

    if (isStaticCloudHost) {
      startLocalStandaloneEngine();
    } else if (typeof io !== 'undefined') {
      connectSocketIO();
      refreshBankStats();
    } else {
      const s = document.createElement('script');
      s.src = '/socket.io/socket.io.js';
      s.onload = () => {
        connectSocketIO();
        refreshBankStats();
      };
      s.onerror = () => {
        startLocalStandaloneEngine();
      };
      document.head.appendChild(s);
    }
  }

  // ==================== LOCAL STANDALONE & NETLIFY CLOUD ENGINE ====================
  const localGame = {
    seq: ['millionaire', 'flag', 'truefalse', 'word', 'speed'],
    activeGame: 'millionaire',
    autoRotateGames: true,
    roundNumber: 1,
    phase: 'question',
    qIndex: 0,
    questions: [],
    timeLeft: 25,
    questionTime: 25,
    customQuestionTime: null,
    theme: urlParams.get('theme') || (() => { try { return localStorage.getItem('milyoncu_theme') || 'auto'; } catch { return 'auto'; } })(),
    questionStartedAtMs: Date.now(),
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
    baseQuestions: [],
    timer: null,
    phaseTimeout: null
  };

  const cloudPoll = {
    active: false,
    inFlight: false,
    username: defaultCloudUser,
    since: 0,
    seenMsgIds: new Set(),
    timerId: null
  };

  async function runCloudPollStep(forceReconnect = false) {
    if (!cloudPoll.active || cloudPoll.inFlight || !cloudPoll.username) return;
    cloudPoll.inFlight = true;
    try {
      const qs = new URLSearchParams({
        username: cloudPoll.username,
        since: String(cloudPoll.since)
      });
      if (forceReconnect) qs.set('reconnect', '1');
      const res = await fetch(`/.netlify/functions/tiktok-live?${qs.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.latestSeq === 'number') {
          if (data.latestSeq < cloudPoll.since) {
            cloudPoll.since = 0;
          }
          if (data.latestSeq > cloudPoll.since) {
            cloudPoll.since = data.latestSeq;
          }
        }
        if (data.status === 'connected') {
          const viewerTxt = data.viewerCount > 0 ? ` • ${data.viewerCount} izləyici` : '';
          if (el.tiktokStatusText) el.tiktokStatusText.textContent = `🟢 Bulud LIVE: @${data.username}${viewerTxt}`;
          if (el.stageLiveBadge) el.stageLiveBadge.textContent = `🔴 @${data.username}${viewerTxt}`;
        } else if (data.message) {
          if (el.tiktokStatusText) el.tiktokStatusText.textContent = `⚪ ${data.message}`;
          if (el.stageLiveBadge) el.stageLiveBadge.textContent = '● CANLI HAZIR';
        }
        if (Array.isArray(data.votes)) {
          for (const v of data.votes) {
            if (v.msgId && cloudPoll.seenMsgIds.has(v.msgId)) continue;
            if (v.msgId) {
              cloudPoll.seenMsgIds.add(v.msgId);
              if (cloudPoll.seenMsgIds.size > 600) {
                cloudPoll.seenMsgIds.delete(cloudPoll.seenMsgIds.values().next().value);
              }
            }
            const rawTs = Number(v.createTime || 0);
            const createMs = rawTs > 0 && rawTs < 1e12 ? rawTs * 1000 : rawTs;
            if (createMs && createMs < localGame.questionStartedAtMs - 5000) continue;
            localHandleViewerChat({
              uniqueId: v.uniqueId || v.nickname || 'viewer',
              nickname: v.nickname || v.uniqueId || 'İzləyici',
              comment: v.rawComment || v.choice || ''
            });
          }
        }
      }
    } catch (_) {
    } finally {
      cloudPoll.inFlight = false;
    }
  }

  function startNetlifyCloudPolling(rawUsername, forceReconnect = false) {
    const clean = (rawUsername || '').trim().replace(/^@+/, '').toLowerCase();
    if (!clean) return;
    stopNetlifyCloudPolling();
    cloudPoll.active = true;
    cloudPoll.username = clean;
    cloudPoll.since = 0;
    cloudPoll.seenMsgIds.clear();
    if (el.tiktokStatusText) el.tiktokStatusText.textContent = `⏳ Bulud bağlantısı: @${clean}...`;
    runCloudPollStep(forceReconnect);
    cloudPoll.timerId = setInterval(() => runCloudPollStep(false), 3500);
  }

  function stopNetlifyCloudPolling() {
    cloudPoll.active = false;
    if (cloudPoll.timerId) {
      clearInterval(cloudPoll.timerId);
      cloudPoll.timerId = null;
    }
  }

  async function startLocalStandaloneEngine() {
    hasBackend = false;
    if (el.connModeBadge) el.connModeBadge.textContent = isStaticCloudHost ? 'Bulud Rejimi • 5-Oyun LIVE' : 'Statik / Lokal Rejim';
    if (el.tiktokUserInput && !el.tiktokUserInput.value.trim()) {
      el.tiktokUserInput.value = defaultCloudUser;
    }
    try {
      let res = await fetch('questions.json');
      if (!res.ok) res = await fetch('/api/questions');
      if (res.ok) {
        const data = await res.json();
        localGame.baseQuestions = Array.isArray(data) ? data : (Array.isArray(data.questions) ? data.questions : []);
      }
    } catch (_) {}

    const baseCount = localGame.baseQuestions.length || 946;
    const virtCount = (window.InfiniteQuestionEngine && window.InfiniteQuestionEngine.VIRTUAL_COMBINATION_COUNT) || 10000;
    if (el.questionBankSummary) {
      el.questionBankSummary.textContent = `${baseCount} əsas sual + ${virtCount}+ dinamik kombinasiya + 4 mini-oyun bazası`;
    }
    const pill = document.getElementById('bankCounterPill');
    if (pill) pill.textContent = `♾️ ${(baseCount + virtCount).toLocaleString()}+ Sual`;

    startLocalRound('millionaire');
    if (defaultCloudUser) {
      startNetlifyCloudPolling(defaultCloudUser, false);
    }
  }

  function startLocalRound(mode) {
    clearInterval(localGame.timer);
    clearTimeout(localGame.phaseTimeout);
    localGame.activeGame = mode;
    const eng = window.InfiniteQuestionEngine;
    const times = { millionaire: 25, flag: 22, truefalse: 18, word: 28, speed: 24 };
    const sizes = { millionaire: 8, flag: 6, truefalse: 8, word: 6, speed: 6 };
    localGame.questionTime = localGame.customQuestionTime || times[mode] || 25;
    localGame.qIndex = 0;
    localGame.leaderboard.clear();

    if (mode === 'flag') {
      let qs = eng.generateFlagRound(sizes.flag, localGame.seen.flag);
      if (qs.length < sizes.flag) {
        localGame.seen.flag.clear();
        qs = eng.generateFlagRound(sizes.flag, localGame.seen.flag);
      }
      qs.forEach((q) => localGame.seen.flag.add(q.flagCode));
      localGame.questions = qs;
    } else if (mode === 'truefalse') {
      let qs = eng.generateTrueFalseRound(sizes.truefalse, localGame.seen.truefalse);
      if (qs.length < sizes.truefalse) {
        localGame.seen.truefalse.clear();
        qs = eng.generateTrueFalseRound(sizes.truefalse, localGame.seen.truefalse);
      }
      qs.forEach((q) => localGame.seen.truefalse.add(q.question));
      localGame.questions = qs;
    } else if (mode === 'word') {
      let qs = eng.generateWordRound(sizes.word, localGame.seen.word);
      if (qs.length < sizes.word) {
        localGame.seen.word.clear();
        qs = eng.generateWordRound(sizes.word, localGame.seen.word);
      }
      qs.forEach((q) => localGame.seen.word.add(q.answerWord));
      localGame.questions = qs;
    } else if (mode === 'speed') {
      let qs = eng.generateSpeedRound(sizes.speed, localGame.seen.speed);
      if (qs.length < sizes.speed) {
        localGame.seen.speed.clear();
        qs = eng.generateSpeedRound(sizes.speed, localGame.seen.speed);
      }
      qs.forEach((q) => localGame.seen.speed.add(q.question));
      localGame.questions = qs;
    } else {
      let pool = localGame.baseQuestions.filter((q) => !localGame.seen.millionaire.has(q.question));
      if (pool.length < 4 && localGame.baseQuestions.length > 0) {
        localGame.seen.millionaire.clear();
        pool = [...localGame.baseQuestions];
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const cur = pool.slice(0, 5);
      cur.forEach((q) => localGame.seen.millionaire.add(q.question));
      const dynNeed = Math.max(0, sizes.millionaire - cur.length);
      const dyn = eng.generateDynamicBatch(2, dynNeed, localGame.seen.millionaire);
      dyn.forEach((q) => localGame.seen.millionaire.add(q.question));
      const merged = [...cur, ...dyn];
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]];
      }
      localGame.questions = merged.slice(0, sizes.millionaire);
    }
    loadLocalQuestion(0);
  }

  function loadLocalQuestion(idx) {
    clearInterval(localGame.timer);
    clearTimeout(localGame.phaseTimeout);
    localGame.qIndex = idx;
    localGame.phase = 'question';
    const times = { millionaire: 25, flag: 22, truefalse: 18, word: 28, speed: 24 };
    localGame.questionTime = localGame.customQuestionTime || times[localGame.activeGame] || 25;
    localGame.timeLeft = localGame.questionTime;
    localGame.questionStartedAtMs = Date.now();
    localGame.votes = { A: 0, B: 0, C: 0, D: 0 };
    localGame.voters.clear();
    localGame.speedWinners = [];
    localGame.eliminatedOptions = [];
    localGame.audiencePoll = null;
    localGame.phoneTip = null;
    SoundEngine.playOpen();
    emitLocalState();

    localGame.timer = setInterval(() => {
      if (localGame.phase !== 'question') return;
      localGame.timeLeft = Math.max(0, localGame.timeLeft - 1);
      if (localGame.timeLeft > 0 && localGame.timeLeft <= 10) {
        SoundEngine.playTick(localGame.timeLeft <= 5);
      }
      emitLocalState();
      if (localGame.timeLeft <= 0) revealLocal();
    }, 1000);
  }

  function localAwardPoints(uniqueId, nickname, pts) {
    const prev = localGame.leaderboard.get(uniqueId) || { uniqueId, nickname, score: 0 };
    prev.score += pts;
    prev.nickname = nickname;
    localGame.leaderboard.set(uniqueId, prev);
  }

  function revealLocal() {
    if (localGame.phase !== 'question') return;
    clearInterval(localGame.timer);
    clearTimeout(localGame.phaseTimeout);
    localGame.phase = 'reveal';
    const q = localGame.questions[localGame.qIndex];
    const mode = localGame.activeGame;

    if (mode === 'word' || mode === 'speed') {
      if (localGame.speedWinners.length > 0) SoundEngine.playApplause(false);
      else SoundEngine.playWrong();
    } else if (q) {
      const pts = mode === 'truefalse' ? 100 : 150 + localGame.qIndex * 25;
      let correctCount = 0;
      for (const [uid, info] of localGame.voters.entries()) {
        if (info.choice === q.correct) {
          correctCount++;
          localAwardPoints(uid, info.nickname, pts);
        }
      }
      if (correctCount > 0 || localGame.voters.size === 0) SoundEngine.playApplause(false);
      else SoundEngine.playWrong();
    }

    emitLocalState();
    localGame.phaseTimeout = setTimeout(() => {
      if (localGame.qIndex + 1 < localGame.questions.length) {
        loadLocalQuestion(localGame.qIndex + 1);
      } else {
        localGame.phase = 'victory';
        SoundEngine.playApplause(true);
        emitLocalState();
        localGame.phaseTimeout = setTimeout(() => {
          localGame.roundNumber++;
          const nextIdx = (localGame.seq.indexOf(localGame.activeGame) + 1) % localGame.seq.length;
          startLocalRound(localGame.autoRotateGames ? localGame.seq[nextIdx] : localGame.activeGame);
        }, 5500);
      }
    }, 4000);
  }

  function localHandleViewerChat({ uniqueId, nickname, comment }) {
    if (localGame.phase !== 'question') return;
    const q = localGame.questions[localGame.qIndex];
    const eng = window.InfiniteQuestionEngine;
    if (!q || !eng || !comment) return;

    const mode = localGame.activeGame;
    const clean = String(comment).trim();
    const norm = eng.normalizeAz(clean);

    if (mode === 'word' || mode === 'speed') {
      if (localGame.speedWinners.some((w) => w.uniqueId === uniqueId)) return;
      const aliases = Array.isArray(q.answerAliases) && q.answerAliases.length ? q.answerAliases : [q.answerWord || ''];
      const matched = aliases.some((a) => {
        const na = eng.normalizeAz(a);
        if (!na) return false;
        if (norm === na) return true;
        return na.includes(' ') ? norm.includes(na) : norm.split(' ').includes(na);
      });
      if (!matched) return;
      const rank = localGame.speedWinners.length + 1;
      if (rank > 3) return;
      const points = rank === 1 ? 300 : rank === 2 ? 200 : 100;
      localGame.speedWinners.push({ uniqueId, nickname, rank, points, text: clean });
      localAwardPoints(uniqueId, nickname, points);
      pushTickerItem({ nickname, rawText: clean, matchedSpeed: true, rank, points });
      emitLocalState();
      if (localGame.speedWinners.length >= 3) {
        setTimeout(() => {
          if (localGame.phase === 'question') revealLocal();
        }, 1400);
      }
      return;
    }

    const cleanLatin = clean
      .replace(/[\u0410\u0430]/g, 'a')
      .replace(/[\u0412\u0432]/g, 'b')
      .replace(/[\u0421\u0441]/g, 'c')
      .replace(/[\u0414\u0434]/g, 'd')
      .replace(/🅰️?/g, 'A')
      .replace(/🅱️?/g, 'B');

    let choice = null;
    if (mode === 'truefalse') {
      if (/^(a|1|dogru|duz|duzdur|he|beli|true|t)$/.test(norm)) choice = 'A';
      else if (/^(b|2|yanlis|sehv|yox|xeyr|false|f)$/.test(norm)) choice = 'B';
    }
    if (!choice) {
      const m =
        cleanLatin.match(/^[\s!@#.*\-]*([A-Da-d1-4])(?:[\s.,!?:;)\]]|$)/) ||
        cleanLatin.match(/(?:^|\s)(?:cavab|variant|secim|cvb|var)[:=\-\s]+([A-Da-d1-4])(?:\s|$|[.,!?)])/i) ||
        cleanLatin.match(/^([A-Da-d1-4])\s*(?:variant|varianti|cavab|cvb)\b/i);
      const map14 = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
      if (m) {
        const ch = m[1].toUpperCase();
        choice = map14[ch] || ch;
      }
    }
    if (!choice && mode === 'flag' && q.options) {
      for (const l of ['A', 'B', 'C', 'D']) {
        if (q.options[l] && eng.normalizeAz(q.options[l]) === norm) choice = l;
      }
      if (!choice && Array.isArray(q.answerAliases) && q.answerAliases.some((a) => eng.normalizeAz(a) === norm)) {
        choice = q.correct;
      }
    }

    if (!choice || localGame.eliminatedOptions.includes(choice)) return;
    if (mode === 'truefalse' && choice !== 'A' && choice !== 'B') return;

    const prev = localGame.voters.get(uniqueId);
    if (prev) {
      if (prev.choice === choice) return;
      localGame.votes[prev.choice] = Math.max(0, (localGame.votes[prev.choice] || 0) - 1);
    }
    localGame.voters.set(uniqueId, { choice, nickname });
    localGame.votes[choice] = (localGame.votes[choice] || 0) + 1;
    pushTickerItem({ nickname, choice });
    emitLocalState();
  }

  function localUseLifeline(type) {
    const q = localGame.questions[localGame.qIndex];
    if (!q || localGame.phase !== 'question') return;
    if (type === '5050' && localGame.activeGame === 'millionaire' && localGame.eliminatedOptions.length === 0) {
      const wrongs = ['A', 'B', 'C', 'D'].filter((l) => l !== q.correct);
      localGame.eliminatedOptions = wrongs.slice(0, 2);
      emitLocalState();
    } else if (type === 'audience' && !localGame.audiencePoll) {
      const pcts = { A: 0, B: 0, C: 0, D: 0 };
      const letters = localGame.activeGame === 'truefalse' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
      const corrPct = 55 + Math.floor(Math.random() * 20);
      pcts[q.correct] = corrPct;
      let rem = 100 - corrPct;
      const others = letters.filter((l) => l !== q.correct && !localGame.eliminatedOptions.includes(l));
      others.forEach((l, idx) => {
        pcts[l] = idx === others.length - 1 ? rem : Math.floor(rem / 2);
        rem -= pcts[l];
      });
      localGame.audiencePoll = pcts;
      emitLocalState();
    } else if (type === 'phone' && !localGame.phoneTip) {
      localGame.phoneTip = localGame.activeGame === 'word' || localGame.activeGame === 'speed'
        ? `İpucu: ${q.hint || 'İlk hərflərə baxın!'}`
        : `Dostunun fikri: Məncə ${q.correct} variantıdır! (${q.hint || 'Uğurlar'})`;
      emitLocalState();
    }
  }

  function localSimulateVote(count = 1) {
    const q = localGame.questions[localGame.qIndex];
    if (!q || localGame.phase !== 'question') return;
    const names = ['Nicat_AZ', 'Aysel_99', 'Tural_Baku', 'Orxan_Pro', 'Nigar_Live', 'Fidan_Star'];
    for (let i = 0; i < count; i++) {
      const nick = names[Math.floor(Math.random() * names.length)];
      const uid = `loc_${nick}_${Math.floor(Math.random() * 3)}`;
      if (localGame.activeGame === 'word' || localGame.activeGame === 'speed') {
        const comment = Math.random() < 0.65 ? q.answerWord : 'Bilmədim';
        localHandleViewerChat({ uniqueId: uid, nickname: nick, comment });
      } else {
        const opts = localGame.activeGame === 'truefalse' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
        const choice = Math.random() < 0.6 ? q.correct : opts[Math.floor(Math.random() * opts.length)];
        localHandleViewerChat({ uniqueId: uid, nickname: nick, comment: choice });
      }
    }
  }

  function emitLocalState() {
    const rawQ = localGame.questions[localGame.qIndex];
    const nextIdx = (localGame.seq.indexOf(localGame.activeGame) + 1) % localGame.seq.length;
    const nextId = localGame.seq[nextIdx];
    const names = {
      millionaire: { icon: '💰', name: 'Milyonçu Şousu' },
      flag: { icon: '🏳️', name: 'Bayrağı Tap' },
      truefalse: { icon: '⚡', name: 'Doğru yoxsa Yanlış' },
      word: { icon: '🔤', name: 'Söz & Emoji Tapmacası' },
      speed: { icon: '🎯', name: 'Sürət Dueli' }
    };

    let qOut = rawQ;
    if (rawQ && localGame.activeGame === 'word' && rawQ.answerWord) {
      const word = rawQ.answerWord;
      const elapsed = Math.max(0, localGame.questionTime - localGame.timeLeft);
      const lettersOnly = word.replace(/\s+/g, '');
      const hintSteps = localGame.phase === 'reveal'
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
      qOut = { ...rawQ, revealedMask: mask, wordLength: lettersOnly.length };
    }

    renderState({
      activeGame: localGame.activeGame,
      nextGameMeta: names[nextId],
      autoRotateGames: localGame.autoRotateGames,
      roundNumber: localGame.roundNumber,
      phase: localGame.phase,
      qIndex: localGame.qIndex,
      totalInRound: localGame.questions.length,
      questionTime: localGame.questionTime,
      timeLeft: localGame.timeLeft,
      soundMuted: SoundEngine.muted,
      theme: localGame.theme,
      currentQuestion: qOut,
      votes: localGame.votes,
      speedWinners: localGame.speedWinners,
      eliminatedOptions: localGame.eliminatedOptions,
      audiencePoll: localGame.audiencePoll,
      phoneTip: localGame.phoneTip,
      leaderboard: Array.from(localGame.leaderboard.values()).sort((a, b) => b.score - a.score).slice(0, 5)
    });
  }

  // ==================== THEMES & VISUAL FX ====================
  const AUTO_THEME_BY_MODE = {
    millionaire: 'gold',
    flag: 'azerbaijan',
    truefalse: 'neon',
    word: 'galaxy',
    speed: 'fire'
  };
  const CONFETTI_COLORS = {
    classic: ['#f5c542', '#38bdf8', '#a855f7', '#22c55e', '#ffffff'],
    gold: ['#f5c542', '#ffe07d', '#d4a017', '#fff7d6', '#b8860b'],
    azerbaijan: ['#00b5e2', '#ef3340', '#509e2f', '#ffffff'],
    neon: ['#ff2bd6', '#00f0ff', '#b026ff', '#39ff14', '#ffffff'],
    galaxy: ['#a78bfa', '#60a5fa', '#f0abfc', '#ffffff', '#c4b5fd'],
    fire: ['#ff4d00', '#ff9500', '#ffd000', '#ff1e56', '#fff3b0']
  };
  let appliedTheme = null;

  function resolveTheme(state) {
    const choice = state.theme || 'auto';
    if (choice === 'auto') return AUTO_THEME_BY_MODE[state.activeGame] || 'classic';
    return CONFETTI_COLORS[choice] ? choice : 'classic';
  }

  function applyTheme(state) {
    const stage = document.getElementById('stage9x16');
    const resolved = resolveTheme(state);
    if (stage && appliedTheme !== resolved) {
      stage.dataset.theme = resolved;
      document.body.dataset.theme = resolved;
      appliedTheme = resolved;
    }
    const choice = state.theme || 'auto';
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themeChoice === choice);
    });
    return resolved;
  }

  function burstConfetti(big) {
    const stage = document.getElementById('stage9x16');
    if (!stage) return;
    const colors = CONFETTI_COLORS[appliedTheme] || CONFETTI_COLORS.classic;
    const layer = document.createElement('div');
    layer.className = 'fx-confetti-layer';
    const count = big ? 90 : 46;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'fx-confetti';
      const size = 5 + Math.random() * 7;
      p.style.left = `${Math.random() * 100}%`;
      p.style.width = `${size}px`;
      p.style.height = `${size * (Math.random() > 0.5 ? 1.8 : 1)}px`;
      p.style.background = colors[i % colors.length];
      p.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px';
      p.style.setProperty('--drift', `${(Math.random() - 0.5) * 140}px`);
      p.style.setProperty('--spin', `${(Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720)}deg`);
      p.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
      p.style.animationDelay = `${Math.random() * 0.45}s`;
      layer.appendChild(p);
    }
    stage.appendChild(layer);
    setTimeout(() => layer.remove(), 4200);
  }

  function replayAnim(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  function runVisualFx(state) {
    const q = state.currentQuestion;
    const qIdNow = q ? q.id : null;
    if (state.phase === 'question' && qIdNow !== prevQId) {
      replayAnim(document.getElementById('questionBox'), 'fx-q-enter');
      replayAnim(document.getElementById('optionsGrid'), 'fx-opts-enter');
    }
    if (state.phase === 'reveal' && prevPhase !== 'reveal') {
      burstConfetti(false);
    } else if (state.phase === 'victory' && prevPhase !== 'victory') {
      burstConfetti(true);
    }
  }

  // ==================== STATE RENDERER ====================
  function renderState(state) {
    currentState = state;
    const mode = state.activeGame || 'millionaire';
    const meta = GAME_META[mode] || GAME_META.millionaire;
    const q = state.currentQuestion;

    // Trigger browser Web Audio if static OR if server speaker audio is disabled
    if (state.soundMuted !== undefined) SoundEngine.muted = !!state.soundMuted;
    if (hasBackend && !state.serverAudioActive && !SoundEngine.muted) {
      SoundEngine.ensureCtx();
      const qIdNow = q ? q.id : null;
      if (state.phase === 'question' && qIdNow !== prevQId) {
        SoundEngine.playOpen();
      } else if (state.phase === 'question' && prevTimeLeft !== null && state.timeLeft < prevTimeLeft && state.timeLeft > 0) {
        if (state.timeLeft <= 10) {
          SoundEngine.playTick(state.timeLeft <= 5);
        }
      } else if (state.phase === 'reveal' && prevPhase !== 'reveal') {
        SoundEngine.playApplause(false);
      } else if (state.phase === 'victory' && prevPhase !== 'victory') {
        SoundEngine.playApplause(true);
      }
    }

    // Game Mode Pill & Selector Sync
    applyTheme(state);
    runVisualFx(state);
    if (el.gameModePill) {
      el.gameModePill.className = `game-mode-pill ${meta.badgeClass}`;
      el.gameModeIcon.textContent = meta.icon;
      el.gameModeName.textContent = meta.name;
    }
    if (el.qModeTag) el.qModeTag.textContent = meta.tag;
    if (el.chatCallout) el.chatCallout.innerHTML = meta.callout;

    document.querySelectorAll('.game-select-btn[data-game]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.game === mode);
    });

    if (el.autoRotateToggle) {
      el.autoRotateToggle.checked = !!state.autoRotateGames;
    }

    if (el.nextGameLabel && state.nextGameMeta) {
      el.nextGameLabel.textContent = state.autoRotateGames
        ? `${state.nextGameMeta.icon} ${state.nextGameMeta.name}`
        : `Eyni oyun davam edir (${meta.icon})`;
    }

    if (el.roundBadge) {
      el.roundBadge.textContent = `TUR ${state.roundNumber || 1} • SUAL ${(state.qIndex || 0) + 1} / ${state.totalInRound || 8}`;
    }

    // Sound Mute button text sync
    if (el.btnMuteSound) {
      const muted = !!state.soundMuted || SoundEngine.muted;
      el.btnMuteSound.textContent = muted ? '🔇 Səs Bağlıdır' : '🔊 Səs Açıqdır';
    }

    // SVG Timer Ring
    const totalT = state.questionTime || 25;
    const leftT = Math.max(0, state.timeLeft ?? totalT);
    const ratio = Math.max(0, Math.min(1, leftT / totalT));
    const circumference = 157.08;
    if (el.timerProgress) {
      el.timerProgress.style.strokeDashoffset = (circumference * (1 - ratio)).toFixed(2);
    }
    if (el.timerValue) el.timerValue.textContent = leftT;
    if (el.timerWrap) el.timerWrap.classList.toggle('urgent', leftT <= 5 && state.phase === 'question');

    // Lifelines visibility / availability
    const isOptMode = mode === 'millionaire' || mode === 'flag' || mode === 'truefalse';
    if (el.btn5050) el.btn5050.disabled = mode !== 'millionaire' || (state.eliminatedOptions && state.eliminatedOptions.length > 0);
    if (el.btnAudience) el.btnAudience.disabled = !isOptMode || !!state.audiencePoll;
    if (el.btnPhone) el.btnPhone.disabled = !!state.phoneTip;

    // Stage elements per game mode
    el.flagDisplayWrap.classList.toggle('hidden', mode !== 'flag');
    el.puzzleDisplayWrap.classList.toggle('hidden', mode !== 'word');
    el.speedBadgeWrap.classList.toggle('hidden', mode !== 'speed');

    if (q) {
      el.questionText.textContent = q.question || '';

      if (mode === 'flag' && q.flagUrl) {
        if (el.flagImg.getAttribute('data-code') !== q.flagCode) {
          el.flagImg.src = q.flagUrl;
          el.flagImg.setAttribute('data-code', q.flagCode || '');
        }
      }

      if (mode === 'word') {
        el.puzzlePrompt.textContent = q.puzzlePrompt || '';
        el.puzzleMask.textContent = q.revealedMask || '';
        el.puzzleHint.textContent = `İpucu: ${q.wordLength || '?'} hərf • ${q.hint || 'Sözü çatda yazın!'}`;
      }
    }

    // Options vs Free-Text Podium
    const isFreeText = mode === 'word' || mode === 'speed';
    el.optionsGrid.classList.toggle('hidden', isFreeText);
    el.speedWinnersBox.classList.toggle('hidden', !isFreeText);

    if (!isFreeText && q) {
      el.optionsGrid.classList.toggle('tf-layout', mode === 'truefalse');
      const totalVotes = ['A', 'B', 'C', 'D'].reduce((acc, l) => acc + (state.votes?.[l] || 0), 0);

      ['A', 'B', 'C', 'D'].forEach((letter) => {
        const optEl = document.getElementById(`opt${letter}`);
        const fillEl = document.getElementById(`fill${letter}`);
        const textEl = document.getElementById(`text${letter}`);
        const statsEl = document.getElementById(`stats${letter}`);
        if (!optEl) return;

        if (mode === 'truefalse' && (letter === 'C' || letter === 'D')) {
          optEl.classList.add('hidden');
          return;
        }
        optEl.classList.remove('hidden');

        textEl.textContent = (q.options && q.options[letter]) || '—';

        // Vote % or audience poll %
        let pct = 0;
        const count = state.votes?.[letter] || 0;
        if (state.audiencePoll && typeof state.audiencePoll[letter] === 'number') {
          pct = state.audiencePoll[letter];
        } else if (totalVotes > 0) {
          pct = Math.round((count / totalVotes) * 100);
        }

        fillEl.style.width = `${pct}%`;
        statsEl.textContent = count > 0 ? `${pct}% (${count})` : `${pct}%`;

        const eliminated = Array.isArray(state.eliminatedOptions) && state.eliminatedOptions.includes(letter);
        optEl.classList.toggle('eliminated', eliminated);

        const isReveal = state.phase === 'reveal';
        const isCorrect = isReveal && q.correct === letter;
        optEl.classList.toggle('correct', isCorrect);
        optEl.classList.toggle('dimmed', isReveal && !isCorrect);
      });
    }

    // Speed Winners Podium + Reveal Banner (Word / Speed modes)
    if (isFreeText) {
      const winners = state.speedWinners || [];
      [1, 2, 3].forEach((rank) => {
        const slot = document.getElementById(`speedSlot${rank}`);
        const userEl = document.getElementById(`speedUser${rank}`);
        const w = winners[rank - 1];
        if (w) {
          slot.classList.add('filled');
          userEl.textContent = `${w.nickname} ✓`;
        } else {
          slot.classList.remove('filled');
          userEl.textContent = 'Gözlənilir...';
        }
      });

      if (state.phase === 'reveal' && q && q.answerWord) {
        el.answerRevealBanner.classList.remove('hidden');
        el.answerRevealWord.textContent = q.answerWord;
      } else {
        el.answerRevealBanner.classList.add('hidden');
      }
    } else {
      el.answerRevealBanner.classList.add('hidden');
    }

    // Hint Toast (Phone tip or explanation during reveal)
    if (state.phoneTip) {
      el.hintToast.classList.remove('hidden');
      el.hintToast.textContent = `📞 ${state.phoneTip}`;
    } else if (state.phase === 'reveal' && q && q.hint && mode === 'truefalse') {
      el.hintToast.classList.remove('hidden');
      el.hintToast.textContent = `💡 İzah: ${q.hint}`;
    } else {
      el.hintToast.classList.add('hidden');
    }

    // Round Leaderboard
    renderLeaderboard(state.leaderboard || []);

    // Round Victory / Transition Overlay
    if (state.phase === 'victory') {
      el.stageOverlay.classList.remove('hidden');
      el.overlayTitle.textContent = `${meta.icon} ${meta.name} BİTDİ!`;
      el.overlaySub.textContent = `Tur ${state.roundNumber || 1} Liderləri:`;
      const podiumHtml = (state.leaderboard || []).slice(0, 3).map((p, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        return `<div class="overlay-podium-row"><span>${medal} ${escapeHtml(p.nickname)}</span><span>${p.score} xal</span></div>`;
      }).join('') || '<div class="overlay-podium-row"><span>Növbəti turda iştirak et!</span><span>🚀</span></div>';
      el.overlayPodium.innerHTML = podiumHtml;
      if (state.nextGameMeta) {
        el.overlayNextGameName.textContent = state.autoRotateGames
          ? `${state.nextGameMeta.icon} ${state.nextGameMeta.name}`
          : `${meta.icon} ${meta.name}`;
      }
    } else {
      el.stageOverlay.classList.add('hidden');
    }

    // Track state transitions for next delta
    prevPhase = state.phase;
    prevTimeLeft = state.timeLeft;
    prevQId = q ? q.id : null;
  }

  function renderLeaderboard(list) {
    if (!el.lbList) return;
    if (!list || list.length === 0) {
      el.lbList.innerHTML = '<div class="lb-empty">İlk düzgün cavabdan sonra xallar toplanacaq</div>';
      return;
    }
    el.lbList.innerHTML = list.slice(0, 3).map((p, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      return `<div class="lb-row"><span>${medal} ${escapeHtml(p.nickname)}</span><span class="lb-score">${p.score} xal</span></div>`;
    }).join('');
  }

  function pushTickerItem(evt) {
    if (!evt) return;
    if (evt.matchedSpeed) {
      const medal = evt.rank === 1 ? '🥇' : evt.rank === 2 ? '🥈' : '🥉';
      pushTickerRaw(`${medal} ${evt.nickname}: "${evt.rawText}" (+${evt.points})`, true);
    } else if (evt.choice) {
      pushTickerRaw(`${evt.nickname} → ${evt.choice}`, false);
    }
  }

  function pushTickerRaw(text, isWinner) {
    if (!el.voteTicker) return;
    const placeholder = el.voteTicker.querySelector('.ticker-placeholder');
    if (placeholder) placeholder.remove();

    const pill = document.createElement('span');
    pill.className = `ticker-pill${isWinner ? ' winner' : ''}`;
    pill.textContent = text;
    el.voteTicker.prepend(pill);

    while (el.voteTicker.children.length > 5) {
      el.voteTicker.removeChild(el.voteTicker.lastChild);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==================== CONTROL PANEL HANDLERS ====================
  function bindControls() {
    document.querySelectorAll('.game-select-btn[data-game]').forEach((btn) => {
      btn.addEventListener('click', () => {
        SoundEngine.unlock();
        const mode = btn.dataset.game;
        if (hasBackend && socket) socket.emit('switch-game', { mode });
        else startLocalRound(mode);
      });
    });

    if (el.autoRotateToggle) {
      el.autoRotateToggle.addEventListener('change', (e) => {
        const enabled = !!e.target.checked;
        if (hasBackend && socket) socket.emit('toggle-auto-rotate', { enabled });
        else {
          localGame.autoRotateGames = enabled;
          emitLocalState();
        }
      });
    }

    if (el.btnStartRound) {
      el.btnStartRound.addEventListener('click', () => {
        SoundEngine.unlock();
        const mode = currentState ? currentState.activeGame : 'millionaire';
        if (hasBackend && socket) socket.emit('start-game', { mode });
        else startLocalRound(mode);
      });
    }

    if (el.btnReveal) {
      el.btnReveal.addEventListener('click', () => {
        SoundEngine.unlock();
        if (hasBackend && socket) socket.emit('reveal-answer');
        else revealLocal();
      });
    }

    if (el.btnNextQ) {
      el.btnNextQ.addEventListener('click', () => {
        SoundEngine.unlock();
        if (hasBackend && socket) socket.emit('next-question');
        else {
          if (localGame.qIndex + 1 < localGame.questions.length) loadLocalQuestion(localGame.qIndex + 1);
          else startLocalRound(localGame.activeGame);
        }
      });
    }

    if (el.btnMuteSound) {
      el.btnMuteSound.addEventListener('click', () => {
        SoundEngine.muted = !SoundEngine.muted;
        if (hasBackend && socket) socket.emit('toggle-sound', { muted: SoundEngine.muted });
        else emitLocalState();
      });
    }

    if (el.btnTestApplause) {
      el.btnTestApplause.addEventListener('click', () => {
        SoundEngine.unlock();
        SoundEngine.playApplause(false);
        if (hasBackend && socket) socket.emit('test-sound', { sound: 'correct' });
      });
    }

    if (el.btnTestTick) {
      el.btnTestTick.addEventListener('click', () => {
        SoundEngine.unlock();
        SoundEngine.playTick(false);
        if (hasBackend && socket) socket.emit('test-sound', { sound: 'tick' });
      });
    }

    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.themeChoice;
        if (hasBackend && socket) {
          socket.emit('set-theme', { theme });
        } else {
          localGame.theme = theme;
          try { localStorage.setItem('milyoncu_theme', theme); } catch (_) {}
          emitLocalState();
        }
      });
    });

    if (el.questionTimeSelect) {
      el.questionTimeSelect.addEventListener('change', (e) => {
        const val = e.target.value === 'auto' ? 0 : Number(e.target.value);
        if (hasBackend && socket) {
          socket.emit('set-question-time', { seconds: val });
        } else {
          localGame.customQuestionTime = val >= 10 && val <= 90 ? val : null;
          emitLocalState();
        }
      });
    }

    // Lifelines
    if (el.btn5050) {
      el.btn5050.addEventListener('click', () => {
        if (hasBackend && socket) socket.emit('use-lifeline', { type: '5050' });
        else localUseLifeline('5050');
      });
    }
    if (el.btnAudience) {
      el.btnAudience.addEventListener('click', () => {
        if (hasBackend && socket) socket.emit('use-lifeline', { type: 'audience' });
        else localUseLifeline('audience');
      });
    }
    if (el.btnPhone) {
      el.btnPhone.addEventListener('click', () => {
        if (hasBackend && socket) socket.emit('use-lifeline', { type: 'phone' });
        else localUseLifeline('phone');
      });
    }

    // TikTok Connection
    if (el.btnConnectTikTok) {
      el.btnConnectTikTok.addEventListener('click', () => {
        const username = el.tiktokUserInput.value.trim();
        if (hasBackend && socket) socket.emit('connect-tiktok', { username });
        else startNetlifyCloudPolling(username, true);
      });
    }

    if (el.btnDisconnectTikTok) {
      el.btnDisconnectTikTok.addEventListener('click', () => {
        if (hasBackend && socket) socket.emit('disconnect-tiktok');
        else {
          stopNetlifyCloudPolling();
          if (el.tiktokStatusText) el.tiktokStatusText.textContent = '⚪ Bulud bağlantısı dayandırıldı.';
        }
      });
    }

    // Bot Simulator Toggle & Burst
    if (el.btnSimToggle) {
      el.btnSimToggle.addEventListener('click', () => {
        if (simInterval) {
          clearInterval(simInterval);
          simInterval = null;
          el.btnSimToggle.textContent = '🤖 Bot Simulyatoru: BAĞLI';
          el.btnSimToggle.classList.remove('warn');
          el.btnSimToggle.classList.add('accent');
        } else {
          const fireSim = () => {
            if (hasBackend && socket) socket.emit('simulate-vote', { count: 2 });
            else localSimulateVote(2);
          };
          fireSim();
          simInterval = setInterval(fireSim, 1600);
          el.btnSimToggle.textContent = '🟢 Bot Simulyatoru: AKTİV';
          el.btnSimToggle.classList.remove('accent');
          el.btnSimToggle.classList.add('warn');
        }
      });
    }

    if (el.btnSimBurst) {
      el.btnSimBurst.addEventListener('click', () => {
        if (hasBackend && socket) socket.emit('simulate-vote', { count: 5 });
        else localSimulateVote(5);
      });
    }

    // Manual Test Chat Box
    const sendManual = () => {
      const txt = (el.manualTestInput.value || '').trim();
      if (!txt) return;
      if (hasBackend && socket) {
        socket.emit('manual-chat', { nickname: 'Aparıcı_Test', comment: txt });
      } else {
        localHandleViewerChat({ uniqueId: 'manual_host', nickname: 'Aparıcı_Test', comment: txt });
      }
      el.manualTestInput.value = '';
    };

    if (el.btnManualTestSend) el.btnManualTestSend.addEventListener('click', sendManual);
    if (el.manualTestInput) {
      el.manualTestInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendManual();
      });
    }

    // Copy OBS URL
    if (el.btnCopyObsUrl) {
      el.btnCopyObsUrl.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(el.obsOverlayUrl.value);
          el.btnCopyObsUrl.textContent = '✅ Kopyalandı!';
          setTimeout(() => { el.btnCopyObsUrl.textContent = '📋 Overlay Linkini Kopyala'; }, 1800);
        } catch (_) {}
      });
    }

    // Modal Editor
    if (el.btnOpenModal) {
      el.btnOpenModal.addEventListener('click', () => {
        el.questionModal.classList.remove('hidden');
        loadModalQuestions();
      });
    }
    if (el.btnCloseModal) {
      el.btnCloseModal.addEventListener('click', () => {
        el.questionModal.classList.add('hidden');
      });
    }
    if (el.addQuestionForm) {
      el.addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          question: document.getElementById('newQText').value,
          options: {
            A: document.getElementById('newOptA').value,
            B: document.getElementById('newOptB').value,
            C: document.getElementById('newOptC').value,
            D: document.getElementById('newOptD').value
          },
          correct: document.getElementById('newQCorrect').value,
          hint: document.getElementById('newQHint').value
        };
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          el.addQuestionForm.reset();
          loadModalQuestions();
          refreshBankStats();
        }
      });
    }
  }

  async function refreshBankStats() {
    try {
      const res = await fetch('/api/questions');
      if (!res.ok) return;
      const data = await res.json();
      if (el.questionBankSummary) {
        el.questionBankSummary.textContent = `${data.baseTotal} əsas sual + ${data.virtualCombinations}+ dinamik kombinasiya + 4 mini-oyun bazası`;
      }
      const pill = document.getElementById('bankCounterPill');
      if (pill) pill.textContent = `♾️ ${data.total.toLocaleString()}+ Sual`;
    } catch (_) {}
  }

  async function loadModalQuestions() {
    if (!el.modalQList) return;
    try {
      let list = localGame.baseQuestions;
      if (hasBackend || !isStaticCloudHost) {
        const res = await fetch('/api/questions');
        if (res.ok) {
          const data = await res.json();
          list = data.questions || [];
        }
      }
      const recent = (list || []).slice(-35).reverse();
      el.modalQList.innerHTML = recent.map((q) => `
        <div class="modal-q-item">
          <div>
            <strong>${escapeHtml(q.question)}</strong>
            <div style="color:#94a3b8;font-size:0.78rem;">Cavab: ${q.correct} (${escapeHtml(q.options?.[q.correct] || '')})</div>
          </div>
          ${hasBackend ? `<button class="ctrl-btn small danger" data-del="${q.id}">Sil</button>` : ''}
        </div>
      `).join('');

      if (hasBackend) {
        el.modalQList.querySelectorAll('[data-del]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            await fetch(`/api/questions/${btn.dataset.del}`, { method: 'DELETE' });
            loadModalQuestions();
            refreshBankStats();
          });
        });
      }
    } catch (_) {}
  }

  // ==================== BOOT ====================
  document.addEventListener('pointerdown', () => SoundEngine.unlock(), { passive: true });
  document.addEventListener('keydown', () => SoundEngine.unlock(), { passive: true });
  bindControls();
  initSocketOrFallback();
})();
