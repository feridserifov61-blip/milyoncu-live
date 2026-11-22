(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InfiniteQuestionEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function normalizeAz(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ə/g, 'e')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/ş/g, 's')
      .replace(/ğ/g, 'g')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function makeQuestion(difficulty, question, correctAnswer, candidateWrong, hint) {
    const correctStr = String(correctAnswer).trim();
    const wrongs = [];
    for (const w of candidateWrong) {
      const s = String(w).trim();
      if (s && s !== correctStr && !wrongs.includes(s)) {
        wrongs.push(s);
      }
      if (wrongs.length === 3) break;
    }
    if (wrongs.length < 3) return null;

    const all = shuffle([correctStr, ...wrongs]);
    const letters = ['A', 'B', 'C', 'D'];
    const correct = letters[all.indexOf(correctStr)];
    return {
      id: `dyn_${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
      difficulty,
      question,
      options: { A: all[0], B: all[1], C: all[2], D: all[3] },
      correct,
      hint,
      isDynamic: true
    };
  }

  function numericDistractors(correctNum, offsets, suffix = '', minVal = 1) {
    const out = [];
    for (const off of shuffle(offsets)) {
      const val = correctNum + off;
      if (val >= minVal && val !== correctNum) {
        out.push(`${val}${suffix}`);
      }
    }
    let step = 1;
    while (out.length < 6) {
      const v1 = correctNum + step;
      if (v1 >= minVal && v1 !== correctNum && !out.includes(`${v1}${suffix}`)) {
        out.push(`${v1}${suffix}`);
      }
      step++;
    }
    return out;
  }

  function toRoman(num) {
    const table = [
      [1000, 'M'],
      [900, 'CM'],
      [500, 'D'],
      [400, 'CD'],
      [100, 'C'],
      [90, 'XC'],
      [50, 'L'],
      [40, 'XL'],
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I']
    ];
    let n = num;
    let res = '';
    for (const [val, sym] of table) {
      while (n >= val) {
        res += sym;
        n -= val;
      }
    }
    return res;
  }

  const COUNTRY_CAPITAL_PAIRS = [
    ['Azərbaycan', 'Bakı'],
    ['Türkiyə', 'Ankara'],
    ['Gürcüstan', 'Tbilisi'],
    ['Rusiya', 'Moskva'],
    ['Fransa', 'Paris'],
    ['Almaniya', 'Berlin'],
    ['İtaliya', 'Roma'],
    ['İspaniya', 'Madrid'],
    ['Böyük Britaniya', 'London'],
    ['Portuqaliya', 'Lissabon'],
    ['Niderland', 'Amsterdam'],
    ['Belçika', 'Brüssel'],
    ['İsveçrə', 'Bern'],
    ['Avstriya', 'Vyana'],
    ['Polşa', 'Varşava'],
    ['Çexiya', 'Praqa'],
    ['Macarıstan', 'Budapeşt'],
    ['Yunanıstan', 'Afina'],
    ['Norveç', 'Oslo'],
    ['İsveç', 'Stokholm'],
    ['Finlandiya', 'Helsinki'],
    ['Danimarka', 'Kopenhagen'],
    ['Ukrayna', 'Kiyev'],
    ['Belarus', 'Minsk'],
    ['Qazaxıstan', 'Astana'],
    ['Özbəkistan', 'Daşkənd'],
    ['Türkmənistan', 'Aşqabad'],
    ['Qırğızıstan', 'Bişkek'],
    ['Tacikistan', 'Düşənbə'],
    ['İran', 'Tehran'],
    ['İraq', 'Bağdad'],
    ['Səudiyyə Ərəbistanı', 'Ər-Riyad'],
    ['BƏƏ', 'Əbu-Dabi'],
    ['Qətər', 'Doha'],
    ['Misir', 'Qahirə'],
    ['Mərakeş', 'Rabat'],
    ['Yaponiya', 'Tokio'],
    ['Çin', 'Pekin'],
    ['Cənubi Koreya', 'Seul'],
    ['Hindistan', 'Yeni Dehli'],
    ['Pakistan', 'İslamabad'],
    ['Tailand', 'Banqkok'],
    ['Vyetnam', 'Hanoy'],
    ['İndoneziya', 'Cakarta'],
    ['Malayziya', 'Kuala-Lumpur'],
    ['ABŞ', 'Vaşinqton'],
    ['Kanada', 'Ottava'],
    ['Meksika', 'Mexiko'],
    ['Braziliya', 'Brazilia'],
    ['Argentina', 'Buenos-Ayres'],
    ['Avstraliya', 'Kanberra'],
    ['Yeni Zelandiya', 'Vellinqton'],
    ['İslandiya', 'Reykyavik'],
    ['Estoniya', 'Tallin'],
    ['Latviya', 'Riqa'],
    ['Litva', 'Vilnüs'],
    ['Xorvatiya', 'Zaqreb'],
    ['Rumıniya', 'Buxarest'],
    ['Bolqarıstan', 'Sofiya'],
    ['Keniya', 'Nayrobi']
  ];

  const ELEMENT_SYMBOLS = [
    ['Hidrogen', 'H', 1],
    ['Helium', 'He', 2],
    ['Litium', 'Li', 3],
    ['Karbon', 'C', 6],
    ['Azot', 'N', 7],
    ['Oksigen', 'O', 8],
    ['Neon', 'Ne', 10],
    ['Natrium', 'Na', 11],
    ['Maqnezium', 'Mg', 12],
    ['Alüminium', 'Al', 13],
    ['Silisium', 'Si', 14],
    ['Fosfor', 'P', 15],
    ['Kükürd', 'S', 16],
    ['Xlor', 'Cl', 17],
    ['Kalium', 'K', 19],
    ['Kalsium', 'Ca', 20],
    ['Titan', 'Ti', 22],
    ['Dəmir', 'Fe', 26],
    ['Mis', 'Cu', 29],
    ['Sink', 'Zn', 30],
    ['Gümüş', 'Ag', 47],
    ['Qalay', 'Sn', 50],
    ['Yod', 'I', 53],
    ['Platin', 'Pt', 78],
    ['Qızıl', 'Au', 79],
    ['Civə', 'Hg', 80],
    ['Qurğuşun', 'Pb', 82],
    ['Uran', 'U', 92]
  ];

  // --- 140+ DÜNYA ÖLKƏSİNİN BAYRAĞI (Bayrağı Tap oyunu üçün) ---
  const FLAG_COUNTRIES = [
    ['az', 'Azərbaycan', 'Qafqaz / Avrasiya'],
    ['tr', 'Türkiyə', 'Avropa və Asiya'],
    ['ge', 'Gürcüstan', 'Qafqaz'],
    ['ru', 'Rusiya', 'Avrasiya'],
    ['ua', 'Ukrayna', 'Şərqi Avropa'],
    ['by', 'Belarus', 'Şərqi Avropa'],
    ['kz', 'Qazaxıstan', 'Mərkəzi Asiya'],
    ['uz', 'Özbəkistan', 'Mərkəzi Asiya'],
    ['tm', 'Türkmənistan', 'Mərkəzi Asiya'],
    ['kg', 'Qırğızıstan', 'Mərkəzi Asiya'],
    ['tj', 'Tacikistan', 'Mərkəzi Asiya'],
    ['ir', 'İran', 'Yaxın Şərq'],
    ['iq', 'İraq', 'Yaxın Şərq'],
    ['sa', 'Səudiyyə Ərəbistanı', 'Yaxın Şərq'],
    ['ae', 'BƏƏ', 'Yaxın Şərq'],
    ['qa', 'Qətər', 'Yaxın Şərq'],
    ['kw', 'Küveyt', 'Yaxın Şərq'],
    ['bh', 'Bəhreyn', 'Yaxın Şərq'],
    ['om', 'Oman', 'Yaxın Şərq'],
    ['jo', 'İordaniya', 'Yaxın Şərq'],
    ['lb', 'Livan', 'Yaxın Şərq'],
    ['sy', 'Suriya', 'Yaxın Şərq'],
    ['ye', 'Yəmən', 'Yaxın Şərq'],
    ['il', 'İsrail', 'Yaxın Şərq'],
    ['eg', 'Misir', 'Şimali Afrika'],
    ['ma', 'Mərakeş', 'Şimali Afrika'],
    ['dz', 'Əlcəzair', 'Şimali Afrika'],
    ['tn', 'Tunis', 'Şimali Afrika'],
    ['ly', 'Liviya', 'Şimali Afrika'],
    ['sd', 'Sudan', 'Afrika'],
    ['et', 'Efiopiya', 'Şərqi Afrika'],
    ['ke', 'Keniya', 'Şərqi Afrika'],
    ['tz', 'Tanzaniya', 'Şərqi Afrika'],
    ['ng', 'Nigeriya', 'Qərbi Afrika'],
    ['gh', 'Qana', 'Qərbi Afrika'],
    ['sn', 'Seneqal', 'Qərbi Afrika'],
    ['cm', 'Kamerun', 'Mərkəzi Afrika'],
    ['za', 'Cənubi Afrika', 'Cənubi Afrika'],
    ['mg', 'Madaqaskar', 'Afrika (Ada)'],
    ['mz', 'Mozambik', 'Cənub-Şərqi Afrika'],
    ['zm', 'Zambiya', 'Afrika'],
    ['zw', 'Zimbabve', 'Afrika'],
    ['fr', 'Fransa', 'Qərbi Avropa'],
    ['de', 'Almaniya', 'Mərkəzi Avropa'],
    ['it', 'İtaliya', 'Cənubi Avropa'],
    ['es', 'İspaniya', 'Cənubi Avropa'],
    ['pt', 'Portuqaliya', 'Cənubi Avropa'],
    ['gb', 'Böyük Britaniya', 'Qərbi Avropa'],
    ['ie', 'İrlandiya', 'Qərbi Avropa'],
    ['nl', 'Niderland', 'Qərbi Avropa'],
    ['be', 'Belçika', 'Qərbi Avropa'],
    ['lu', 'Lüksemburq', 'Qərbi Avropa'],
    ['ch', 'İsveçrə', 'Mərkəzi Avropa'],
    ['at', 'Avstriya', 'Mərkəzi Avropa'],
    ['pl', 'Polşa', 'Mərkəzi Avropa'],
    ['cz', 'Çexiya', 'Mərkəzi Avropa'],
    ['sk', 'Slovakiya', 'Mərkəzi Avropa'],
    ['hu', 'Macarıstan', 'Mərkəzi Avropa'],
    ['ro', 'Rumıniya', 'Şərqi Avropa'],
    ['bg', 'Bolqarıstan', 'Balkanlar'],
    ['md', 'Moldova', 'Şərqi Avropa'],
    ['gr', 'Yunanıstan', 'Cənubi Avropa'],
    ['cy', 'Kipr', 'Aralıq dənizi'],
    ['mt', 'Malta', 'Aralıq dənizi'],
    ['no', 'Norveç', 'Skandinaviya'],
    ['se', 'İsveç', 'Skandinaviya'],
    ['fi', 'Finlandiya', 'Şimali Avropa'],
    ['dk', 'Danimarka', 'Şimali Avropa'],
    ['is', 'İslandiya', 'Şimali Avropa'],
    ['ee', 'Estoniya', 'Baltikyanı'],
    ['lv', 'Latviya', 'Baltikyanı'],
    ['lt', 'Litva', 'Baltikyanı'],
    ['hr', 'Xorvatiya', 'Balkanlar'],
    ['si', 'Sloveniya', 'Mərkəzi Avropa'],
    ['rs', 'Serbiya', 'Balkanlar'],
    ['ba', 'Bosniya və Herseqovina', 'Balkanlar'],
    ['me', 'Monteneqro', 'Balkanlar'],
    ['mk', 'Şimali Makedoniya', 'Balkanlar'],
    ['al', 'Albaniya', 'Balkanlar'],
    ['mc', 'Monako', 'Qərbi Avropa'],
    ['us', 'ABŞ', 'Şimali Amerika'],
    ['ca', 'Kanada', 'Şimali Amerika'],
    ['mx', 'Meksika', 'Şimali Amerika'],
    ['cu', 'Kuba', 'Karib hövzəsi'],
    ['jm', 'Yamayka', 'Karib hövzəsi'],
    ['do', 'Dominikan', 'Karib hövzəsi'],
    ['cr', 'Kosta-Rika', 'Mərkəzi Amerika'],
    ['pa', 'Panama', 'Mərkəzi Amerika'],
    ['gt', 'Qvatemala', 'Mərkəzi Amerika'],
    ['hn', 'Honduras', 'Mərkəzi Amerika'],
    ['sv', 'Salvador', 'Mərkəzi Amerika'],
    ['br', 'Braziliya', 'Cənubi Amerika'],
    ['ar', 'Argentina', 'Cənubi Amerika'],
    ['cl', 'Çili', 'Cənubi Amerika'],
    ['co', 'Kolumbiya', 'Cənubi Amerika'],
    ['pe', 'Peru', 'Cənubi Amerika'],
    ['ve', 'Venesuela', 'Cənubi Amerika'],
    ['ec', 'Ekvador', 'Cənubi Amerika'],
    ['bo', 'Boliviya', 'Cənubi Amerika'],
    ['py', 'Paraqvay', 'Cənubi Amerika'],
    ['uy', 'Uruqvay', 'Cənubi Amerika'],
    ['jp', 'Yaponiya', 'Şərqi Asiya'],
    ['cn', 'Çin', 'Şərqi Asiya'],
    ['kr', 'Cənubi Koreya', 'Şərqi Asiya'],
    ['mn', 'Monqolustan', 'Şərqi Asiya'],
    ['in', 'Hindistan', 'Cənubi Asiya'],
    ['pk', 'Pakistan', 'Cənubi Asiya'],
    ['bd', 'Banqladeş', 'Cənubi Asiya'],
    ['lk', 'Şri-Lanka', 'Cənubi Asiya'],
    ['np', 'Nepal', 'Cənubi Asiya'],
    ['bt', 'Butan', 'Cənubi Asiya'],
    ['mv', 'Maldiv adaları', 'Cənubi Asiya'],
    ['af', 'Əfqanıstan', 'Asiya'],
    ['th', 'Tailand', 'Cənub-Şərqi Asiya'],
    ['vn', 'Vyetnam', 'Cənub-Şərqi Asiya'],
    ['id', 'İndoneziya', 'Cənub-Şərqi Asiya'],
    ['my', 'Malayziya', 'Cənub-Şərqi Asiya'],
    ['ph', 'Filippin', 'Cənub-Şərqi Asiya'],
    ['sg', 'Sinqapur', 'Cənub-Şərqi Asiya'],
    ['kh', 'Kamboca', 'Cənub-Şərqi Asiya'],
    ['la', 'Laos', 'Cənub-Şərqi Asiya'],
    ['mm', 'Myanma', 'Cənub-Şərqi Asiya'],
    ['au', 'Avstraliya', 'Okeaniya'],
    ['nz', 'Yeni Zelandiya', 'Okeaniya']
  ];

  // --- DOĞRU YOXSA YANLIŞ KURASİYA FAKTİKLƏRİ ---
  const CURATED_TF = [
    ['Azərbaycan bayrağındakı ulduz 8 guşəlidir.', true, 'Aypara ilə birlikdə 8 guşəli ulduz təsvir olunub.'],
    ['Avstraliyanın rəsmi paytaxtı Sidney şəhəridir.', false, 'Yanlışdır! Rəsmi paytaxt Kanberra şəhəridir.'],
    ['Venera planetində Günəş qərbdən doğur.', true, 'Doğrudur! Venera öz oxu ətrafında əks istiqamətdə fırlanır.'],
    ['Mavi balina balıq növünə aiddir.', false, 'Yanlışdır! Balina suda yaşayan məməli heyvandır.'],
    ['İnsan skeletində böyüklərdə 206 sümük var.', true, 'Doğrudur! Körpələrdə ~270 olur, böyüdükcə 206-ya birləşir.'],
    ['Braziliyada rəsmi dövlət dili ispan dilidir.', false, 'Yanlışdır! Braziliyada portuqal dili rəsmi dildir.'],
    ['Şahmat taxtasında cəmi 64 xana mövcuddur.', true, 'Doğrudur! 8 × 8 = 64 xana var.'],
    ['Civə otaq temperaturunda bərk halda olur.', false, 'Yanlışdır! Civə otaq temperaturunda maye olan yeganə metaldır.'],
    ['Səs vakuumda (kosmos boşluğunda) yayıla bilir.', false, 'Yanlışdır! Səs dalğalarının yayılması üçün hava və ya maddə lazımdır.'],
    ['Azərbaycanın ən hündür zirvəsi Bazardüzüdür.', true, 'Doğrudur! Hündürlüyü 4466 metrdir.'],
    ['Bakı metropoliteni 1967-ci ildə fəaliyyətə başlayıb.', true, 'Doğrudur! 6 noyabr 1967-ci ildə açılıb.'],
    ['Qızılın kimyəvi simvolu "Ag" hərfləridir.', false, 'Yanlışdır! Qızıl "Au", Gümüş isə "Ag" ilə işarələnir.'],
    ['Hörümçəklərin 8 ayağı olur.', true, 'Doğrudur! Həşəratların 6, hörümçəklərin 8 ayağı var.'],
    ['Ən kiçik sadə ədəd 1-dir.', false, 'Yanlışdır! 1 sadə ədəd sayılmır, ən kiçik sadə ədəd 2-dir.'],
    ['Qarabağın incisi Şuşa şəhəri Azərbaycanın mədəniyyət paytaxtıdır.', true, 'Doğrudur! Şuşa rəsmi olaraq mədəniyyət paytaxtıdır.'],
    ['Təyyarələrdəki "Qara qutu" əslində qara rəngdə olur.', false, 'Yanlışdır! Asan tapılması üçün parlaq narıncı rəngdə hazırlanır.'],
    ['İşığın sürəti səsin sürətindən dəfələrlə yüksəkdir.', true, 'Doğrudur! Ona görə şimşəyi görüb, gurultusunu sonra eşidirik.'],
    ['Bütün aylarda ən azı 28 gün var.', true, 'Doğrudur! Yalnız Fevral 28-29, qalanları 30-31 gündür.'],
    ['Şah İsmayıl Xətai Səfəvilər dövlətinin banisidir.', true, 'Doğrudur! 1501-ci ildə Təbrizdə taxta çıxıb.'],
    ['Piza qülləsi Fransanın Paris şəhərində yerləşir.', false, 'Yanlışdır! İtaliyanın Piza şəhərindədir.'],
    ['Almaz və qələm içindəki qrafit eyni elementdən — karbondan ibarətdir.', true, 'Doğrudur! Sadəcə atomların düzülüşü fərqlidir.'],
    ['ABŞ-ın ən böyük ştatı Texasdır.', false, 'Yanlışdır! Sahəsinə görə ən böyük ştat Alyaskadır.'],
    ['İnsan bədənindəki bütün damarların uzunluğu 100 min km-ə yaxındır.', true, 'Doğrudur! Ekvatoru 2 dəfədən çox dövrələyir.'],
    ['Yarasalar uça bilən yeganə məməli heyvanlardır.', true, 'Doğrudur! Balalarını südlə bəsləyir və qanadları var.'],
    ['Nobel mükafatı Riyaziyyat sahəsində də hər il verilir.', false, 'Yanlışdır! Riyaziyyat Nobel siyahısında yoxdur.'],
    ['Xəzər dənizi sahəsinə görə dünyanın ən böyük gölü hesab olunur.', true, 'Doğrudur! Okeanla birbaşa əlaqəsi olmayan ən böyük su hövzəsidir.'],
    ['Suveyş kanalı Atlantik və Sakit okeanları birləşdirir.', false, 'Yanlışdır! O, Panama kanalıdır; Suveyş Aralıq və Qırmızı dənizi birləşdirir.'],
    ['Qarpız botaniki baxımdan giləmeyvə (böyük giləmeyvə) sinfinə daxildir.', true, 'Doğrudur! Pomidor və banan kimi giləmeyvə sayılır.'],
    ['Roma rəqəmi "L" ədədi 500-ü ifadə edir.', false, 'Yanlışdır! "L" = 50, "D" = 500 deməkdir.'],
    ['Dünyada ilk neft platforması şəhərciyi Neft Daşları 1949-cu ildə qurulub.', true, 'Doğrudur! Xəzər dənizində 7 noyabr 1949-da açılıb.'],
    ['Azərbaycan əlifbasında 33 hərf var.', false, 'Yanlışdır! Müasir əlifbamızda 32 hərf var.'],
    ['Üçbucağın daxili bucaqlarının cəmi 180 dərəcədir.', true, 'Doğrudur! Dördbucaqlıda isə 360°-dir.'],
    ['Pinqvinlər Şimal qütbündə (Arktikada) təbii şəkildə yaşayır.', false, 'Yanlışdır! Pinqvinlər Cənub yarımkürəsində (Antarktidada) yaşayır.'],
    ['Şahmatda At digər fiqurların üstündən tullana bilən yeganə fiqurdur.', true, 'Doğrudur! "L" formasında gedir və maneəni keçə bilir.'],
    ['Futbolda bir komandada meydançada 12 oyunçu olur.', false, 'Yanlışdır! Qapıçı daxil 11 oyunçu olur.'],
    ['Bal təbii şəraitdə min illərlə xarab olmadan qala bilir.', true, 'Doğrudur! Aşağı nəmlik və turşuluğa görə bakteriya yaranmır.'],
    ['Günəş sisteminin ən böyük planeti Saturndur.', false, 'Yanlışdır! Ən böyük planet Yupiterdir.'],
    ['Azərbaycanda dünyadakı 11 iqlim tipindən 9-u mövcuddur.', true, 'Doğrudur! Bu, ölkəmizin zəngin coğrafiyasını göstərir.'],
    ['Üzeyir Hacıbəyli "Əkinçi" qəzetinin təsisçisi olub.', false, 'Yanlışdır! "Əkinçi"ni Həsən bəy Zərdabi yaradıb (1875).'],
    ['Kamil Cəlilovun balaban ifası kosmosa Voyager-1 ilə göndərilib.', true, 'Doğrudur! 1977-ci ildə Qızıl Plastinkaya salınıb.']
  ];

  // --- SÖZ & EMOJİ TAPMACALARI (200+ tapmaca) ---
  const EMOJI_PUZZLES = [
    ['🦁👑', 'KRAL ŞİR', ['kral sir', 'aslan kral'], 'Məşhur cizgi filmi'],
    ['🔥🏙️', 'BAKI', ['baki', 'baku'], 'Odlar yurdu paytaxtı'],
    ['🍎📱', 'IPHONE', ['ayfon', 'iphone'], 'Populyar smartfon'],
    ['⚽🏆', 'FUTBOL', ['futbol'], 'Dünyanın ən məşhur oyunu'],
    ['❄️⛄', 'QAR ADAM', ['qar adam', 'qaradam'], 'Qışda qardan düzəldilir'],
    ['🍉☀️', 'QARPIZ', ['qarpiz'], 'Yayda yeyilən yaşıl-qırmızı meyvə'],
    ['🍯🐝', 'BAL', ['bal'], 'Arıların hazırladığı şirin qida'],
    ['🍕🇮🇹', 'PİTSA', ['pitsa', 'pizza'], 'İtalyan yeməyi'],
    ['🐼🎋', 'PANDA', ['panda'], 'Bambuk yeyən ağ-qara ayı'],
    ['🚀🌕', 'KOSMOS', ['kosmos', 'ay'], 'Raketlərin uçduğu fəza'],
    ['🌧️🌈', 'GÖY QURŞAĞI', ['goy qursagi', 'goyqursagi'], 'Yağışdan sonra 7 rəng'],
    ['♟️👑', 'ŞAHMAT', ['sahmat'], '64 xanalı zəka oyunu'],
    ['🐪🏜️', 'DƏVƏ', ['deve'], 'Səhra gəmisi'],
    ['🐘🌴', 'FİL', ['fil'], 'Xortumlu nəhəng heyvan'],
    ['🐒🍌', 'MEYMUN', ['meymun'], 'Banan sevən heyvan'],
    ['✈️☁️', 'TƏYYARƏ', ['teyyare'], 'Havada uçan nəqliyyat'],
    ['🚂🛤️', 'QATAR', ['qatar'], 'Dəmir yolu nəqliyyatı'],
    ['💍👰', 'TOY', ['toy'], 'Vağzalı sədaları altında məclis'],
    ['🩺🏥', 'HƏKİM', ['hekim', 'doktor'], 'Xəstələri sağaldan peşə'],
    ['🎸🎵', 'GİTARA', ['gitara'], 'Simli musiqi aləti'],
    ['🌋🔥', 'VULKAN', ['vulkan'], 'Lava püskürən dağ'],
    ['🧀🐭', 'SİÇAN', ['sican'], 'Pişiyin qovaladığı kiçik canlı'],
    ['🚗⚡', 'TESLA', ['tesla'], 'Elektrikli avtomobil'],
    ['📚🎓', 'UNİVERSİTET', ['universitet', 'mekteb'], 'Ali təhsil ocağı'],
    ['🦈🌊', 'KÖPƏKBALIĞI', ['kopekbaligi', 'akula'], 'Okeanın yırtıcı balığı'],
    ['☕🥐', 'SƏHƏR YEMƏYİ', ['seher yemeyi', 'qehvealti'], 'Günün ilk yeməyi'],
    ['🕷️🕸️', 'HÖRÜMÇƏK', ['horumcek', 'spiderman'], 'Tor quran canlı'],
    ['⏱️🏃', 'MARAFON', ['marafon', 'qacis'], '42 km qaçış yarışı'],
    ['🎥🍿', 'KİNO', ['kino', 'kinoteatr', 'film'], 'Böyük ekranda izlənir'],
    ['🎂🕯️', 'AD GÜNÜ', ['ad gunu', 'adgunu'], 'Hər il tortla qeyd olunur'],
    ['🔑🚪', 'AÇAR', ['acar'], 'Qapını açmaq üçün istifadə olunur'],
    ['💎💍', 'ÜZÜK', ['uzuk', 'brilyant'], 'Barmağa taxılan zinət əşyası'],
    ['🍓🥛', 'KOKTEYL', ['kokteyl', 'milkseyk'], 'Çiyələkli süd içkisi'],
    ['🐢🏁', 'TISBAĞA', ['tisbaga'], 'Zirehli yavaş heyvan'],
    ['🦅⛰️', 'QARTAL', ['qartal'], 'Dağların qürurlu quşu'],
    ['🌽🍿', 'POPKORN', ['popkorn', 'qarqidali'], 'Kinoda yeyilən partlamış qarğıdalı'],
    ['🧊🥤', 'KOLA', ['kola', 'soyuq icki', 'limonad'], 'Buzlu sərinləşdirici içki'],
    ['🌻🐝', 'GÜNƏBAXAN', ['gunebaxan', 'semicka'], 'Günəşə tərəf dönən sarı bitki'],
    ['🎤🎶', 'MÜĞƏNNİ', ['mugenni', 'mahnici'], 'Səhnədə mahnı oxuyan'],
    ['🚢⚓', 'GƏMİ', ['gemi'], 'Dənizdə üzən nəqliyyat'],
    ['🌵☀️', 'SƏHRA', ['sehra'], 'Quraqlıq və kaktuslar diyarı'],
    ['🐧❄️', 'PİNQVİN', ['pinqvin'], 'Antarktida quşu'],
    ['🎃👻', 'HELLOUİN', ['hellouin', 'halloween'], 'Balqabaq bayramı'],
    ['🗽🇺🇸', 'NYU-YORK', ['nyu york', 'nyuyork', 'amerika'], 'Azadlıq heykəli şəhəri'],
    ['🗼🇫🇷', 'PARİS', ['paris', 'fransa'], 'Eyfel qülləsi şəhəri'],
    ['🕰️🇬🇧', 'LONDON', ['london', 'big ben'], 'Big Ben saat qülləsi'],
    ['🍕🏛️', 'ROMA', ['roma', 'italiya'], 'Kolizey şəhəri'],
    ['🐫🔺', 'MİSİR', ['misir', 'ehram'], 'Piramidalar ölkəsi'],
    ['🍣🗻', 'YAPONİYA', ['yaponiya', 'tokio'], 'Suşi və Fuci dağı'],
    ['🍁🏒', 'KANADA', ['kanada'], 'Ağcaqayın yarpağı və xokkey']
  ];

  const WORD_ANAGRAMS = [
    ['AZƏRBAYCAN', 'Ölkə'],
    ['QARABAĞ', 'Bölgə'],
    ['BAKI', 'Paytaxt'],
    ['GƏNCƏ', 'Şəhər'],
    ['ŞUŞA', 'Mədəniyyət paytaxtı'],
    ['NAXÇIVAN', 'Muxtar Respublika'],
    ['LƏNKƏRAN', 'Cənub şəhəri'],
    ['QƏBƏLƏ', 'Turizm bölgəsi'],
    ['ŞƏKİ', 'Halva və Xan Sarayı'],
    ['SUMQAYIT', 'Gənclər şəhəri'],
    ['MİNGƏÇEVİR', 'İşıqlar şəhəri'],
    ['XƏZƏR', 'Dəniz'],
    ['KÜR', 'Azərbaycan çayı'],
    ['ARAZ', 'Çay'],
    ['BAZARDÜZÜ', 'Ən hündür zirvə'],
    ['XARIBÜLBÜL', 'Zəfər çiçəyi'],
    ['NOVRUZ', 'Bahar bayramı'],
    ['SƏMƏNİ', 'Novruz rəmzi'],
    ['PAXLAVA', 'Milli şirniyyat'],
    ['ŞƏKƏRBURA', 'Şirniyyat'],
    ['DÜŞBƏRƏ', 'Milli xörək'],
    ['QUTAB', 'Sac yeməyi'],
    ['DOVĞA', 'Qatıqlı şorba'],
    ['PİTİ', 'Şəki yeməyi'],
    ['ZƏFƏRAN', 'Qiymətli ədviyyat'],
    ['KAMANÇA', 'Simli alət'],
    ['BALABAN', 'Nəfəs aləti'],
    ['NAĞARA', 'Zərb aləti'],
    ['MUĞAM', 'Milli musiqi sənəti'],
    ['QOBUSTAN', 'Tarixi qoruq'],
    ['YANARDAĞ', 'Abşeron abidəsi'],
    ['TÜRKİYƏ', 'Qardaş ölkə'],
    ['ANKARA', 'Paytaxt'],
    ['İSTANBUL', 'İki qitəli şəhər'],
    ['ALMANİYA', 'Avropa ölkəsi'],
    ['İTALİYA', 'Çəkmə formalı ölkə'],
    ['FRANSA', 'Avropa ölkəsi'],
    ['YAPONİYA', 'Gündoğan ölkə'],
    ['BRAZİLİYA', 'Cənubi Amerika ölkəsi'],
    ['KANADA', 'Şimali Amerika ölkəsi'],
    ['NORVEÇ', 'Skandinaviya ölkəsi'],
    ['İSVEÇRƏ', 'Alp ölkəsi'],
    ['AVSTRALİYA', 'Qitə və ölkə'],
    ['GÜNƏŞ', 'Ulduz'],
    ['YUPİTER', 'Ən böyük planet'],
    ['SATURN', 'Halqalı planet'],
    ['NEPTUN', 'Mavi planet'],
    ['VENERA', 'Ən isti planet'],
    ['MERKURİ', 'Günəşə ən yaxın planet'],
    ['OKSİGEN', 'Nəfəs qazı'],
    ['HİDROGEN', 'İlk element'],
    ['ALMAZ', 'Ən sərt mineral'],
    ['QIZIL', 'Qiymətli metal'],
    ['GÜMÜŞ', 'Ağ qiymətli metal'],
    ['ZÜRAFƏ', 'Ən hündür heyvan'],
    ['GEPARD', 'Ən sürətli heyvan'],
    ['BALİNA', 'Okean nəhəngi'],
    ['TİMSAH', 'Su yırtıcısı'],
    ['KƏPƏNƏK', 'Rəngli həşərat'],
    ['QARANQUŞ', 'Yaz quşu'],
    ['BÜLBÜL', 'Gözəl səsli quş'],
    ['FUTBOL', 'Komanda oyunu'],
    ['BASKETBOL', 'Səbət oyunu'],
    ['VOLEYBOL', 'Tor oyunu'],
    ['GÜLƏŞ', 'Milli idman növü'],
    ['OLİMPİYA', '4 ildən bir keçirilən yarış'],
    ['KOMPÜTER', 'Texnologiya'],
    ['İNTERNET', 'Qlobal şəbəkə'],
    ['PROQRAM', 'Kod toplusu'],
    ['ALQORİTM', 'Məsələ həlli ardıcıllığı'],
    ['TELEFON', 'Əlaqə vasitəsi'],
    ['KİTABXANA', 'Kitablar evi'],
    ['MÜƏLLİM', 'Bilik öyrədən'],
    ['MÜHƏNDİS', 'Texniki mütəxəssis'],
    ['MEMAR', 'Bina layihələndirən'],
    ['TƏBİƏT', 'Ətraf aləm'],
    ['ŞƏLALƏ', 'Dağdan tökülən su'],
    ['GÖYGÖL', 'Azərbaycan gölü'],
    ['QARABALA', 'Xalq nağılı deyil — MARALGAL olsun? -> MARALGÖL', 'Göygöl yaxınlığındakı göl']
  ].filter((x) => !x[0].includes(' '));

  // Add clean MARALGÖL instead of typo entry
  WORD_ANAGRAMS.push(['MARALGÖL', 'Göygöl yaxınlığındakı göl']);
  WORD_ANAGRAMS.push(['İÇƏRİŞƏHƏR', 'Bakının qədim qala hissəsi']);
  WORD_ANAGRAMS.push(['QARAXAN', 'Tarixi titul']);
  WORD_ANAGRAMS.push(['PİRAMİDA', 'Misir abidəsi']);
  WORD_ANAGRAMS.push(['TELESKOP', 'Ulduzlara baxmaq üçün cihaz']);
  WORD_ANAGRAMS.push(['MİKROSKOP', 'Kiçik hüceyrələrə baxan cihaz']);
  WORD_ANAGRAMS.push(['KOMPAS', 'İstiqamət göstərən cihaz']);
  WORD_ANAGRAMS.push(['AVTOMOBİL', 'Nəqliyyat vasitəsi']);
  WORD_ANAGRAMS.push(['VELOSİPED', 'İki təkərli nəqliyyat']);
  WORD_ANAGRAMS.push(['ŞOKOLAD', 'Kakaodan hazırlanan şirniyyat']);

  // --- MİLYONÇU ASAN / ORTA / ÇƏTİN DİNAMİK GENERATORLAR ---
  function genEasy() {
    const mode = randInt(1, 8);

    if (mode === 1) {
      const a = randInt(4, 25);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      const ans = a + b * c;
      const trap = (a + b) * c;
      return makeQuestion(
        1,
        `${a} + ${b} × ${c} ifadəsinin qiyməti neçədir?`,
        ans,
        [trap, ans + 4, ans - 3, ans + 10],
        `Əvvəlcə vurma əməlini (${b} × ${c} = ${b * c}), sonra toplamanı yerinə yetirin.`
      );
    }

    if (mode === 2) {
      if (randInt(0, 1) === 0) {
        const hrs = randInt(2, 12);
        const mins = hrs * 60;
        return makeQuestion(
          1,
          `${hrs} saat neçə dəqiqədir?`,
          `${mins} dəqiqə`,
          numericDistractors(mins, [-60, -30, 30, 60, 120], ' dəqiqə', 60),
          `1 saat 60 dəqiqə olduğuna görə ${hrs}-i 60-a vurun.`
        );
      }
      const days = randInt(3, 9);
      const hrs = days * 24;
      return makeQuestion(
        1,
        `${days} gün (sutka) cəmi neçə saatdır?`,
        `${hrs} saat`,
        numericDistractors(hrs, [-24, -12, 12, 24, 48], ' saat', 24),
        `1 gün 24 saat olduğuna görə ${days} × 24 hesablayın.`
      );
    }

    if (mode === 3) {
      if (randInt(0, 1) === 0) {
        const km = randInt(2, 25);
        const m = km * 1000;
        return makeQuestion(
          1,
          `${km} kilometr neçə metrdir?`,
          `${m} metr`,
          [`${km * 100} metr`, `${km * 10} metr`, `${km * 10000} metr`, `${m + 500} metr`],
          `1 kilometr 1000 metrə bərabərdir.`
        );
      }
      const kq = randInt(2, 18);
      const gr = kq * 1000;
      return makeQuestion(
        1,
        `${kq} kiloqram neçə qramdır?`,
        `${gr} qram`,
        [`${kq * 100} qram`, `${kq * 500} qram`, `${kq * 10000} qram`],
        `1 kiloqram 1000 qramdır.`
      );
    }

    if (mode === 4) {
      const pct = pick([10, 20, 25, 50]);
      const mult = pct === 25 ? 4 : pct === 20 ? 5 : pct === 10 ? 10 : 2;
      const ans = randInt(3, 45) * 2;
      const base = ans * mult;
      return makeQuestion(
        1,
        `${base} ədədinin ${pct}%-i neçəyə bərabərdir?`,
        ans,
        numericDistractors(ans, [-10, -5, 5, 10, 15, 20], '', 1),
        `${base}-i ${pct}/100-ə vurun (yəni ${mult}-ə bölün).`
      );
    }

    if (mode === 5) {
      const speed = pick([40, 50, 60, 70, 80, 90, 100, 110, 120]);
      const hours = randInt(2, 6);
      const dist = speed * hours;
      return makeQuestion(
        1,
        `Saatda ${speed} km sürətlə hərəkət edən avtomobil ${hours} saata neçə km yol gedər?`,
        `${dist} km`,
        numericDistractors(dist, [-40, -20, 20, 40, 60], ' km', 20),
        `Sürəti zamana vurun: ${speed} × ${hours}.`
      );
    }

    if (mode === 6) {
      const side = randInt(4, 19);
      if (randInt(0, 1) === 0) {
        const per = side * 4;
        return makeQuestion(
          1,
          `Bir tərəfi ${side} sm olan kvadratın perimetri neçə sm-dir?`,
          `${per} sm`,
          [`${side * side} sm`, `${side * 2} sm`, `${per + 4} sm`, `${per - 4} sm`],
          `Kvadratın 4 bərabər tərəfi olduğu üçün ${side}-i 4-ə vurun.`
        );
      }
      const area = side * side;
      return makeQuestion(
        1,
        `Bir tərəfi ${side} sm olan kvadratın sahəsi neçə sm²-dir?`,
        `${area} sm²`,
        numericDistractors(area, [-side, side, -10, 10, 20], ' sm²', 4),
        `Kvadratın sahəsi tərəfin özünə vurulması ilə tapılır (${side} × ${side}).`
      );
    }

    if (mode === 7) {
      const n = randInt(4, 29);
      const rom = toRoman(n);
      return makeQuestion(
        1,
        `Roma rəqəmi "${rom}" hansı ədədi ifadə edir?`,
        n,
        numericDistractors(n, [-3, -2, -1, 1, 2, 3, 5], '', 1),
        `X=10, V=5, I=1 qaydasından istifadə edərək hesablayın.`
      );
    }

    const subset = shuffle(COUNTRY_CAPITAL_PAIRS).slice(0, 4);
    const target = subset[0];
    const wrongPairs = subset.slice(1).map((p, idx) => {
      const shiftedCap = subset[((idx + 1) % 3) + 1][1];
      return `${p[0]} — ${shiftedCap === p[1] ? target[1] : shiftedCap}`;
    });
    return makeQuestion(
      1,
      `Aşağıdakı "Ölkə — Paytaxt" cütlüklərindən hansı DOĞRUDUR?`,
      `${target[0]} — ${target[1]}`,
      wrongPairs,
      `${target[0]} dövlətinin paytaxtını yada salın.`
    );
  }

  function genMedium() {
    const mode = randInt(1, 8);

    if (mode === 1) {
      const pct = pick([10, 15, 20, 25, 30, 40]);
      const base = pick([40, 60, 80, 100, 120, 140, 160, 180, 200, 240, 300, 400, 500]);
      const finalPrice = Math.round(base * (1 - pct / 100));
      return makeQuestion(
        2,
        `${base} manatlıq mala ${pct}% endirim edilərsə, yeni qiyməti neçə manat olar?`,
        `${finalPrice} manat`,
        numericDistractors(finalPrice, [-20, -10, -5, 5, 10, 20], ' manat', 5),
        `${base} manatın ${pct}%-ni (${(base * pct) / 100} manat) çıxın.`
      );
    }

    if (mode === 2) {
      const h = randInt(8, 20);
      const m = pick([10, 15, 20, 25, 30, 35, 40, 45, 50]);
      const add = pick([25, 35, 40, 45, 50, 55, 65, 75, 85, 95]);
      const totalMins = h * 60 + m + add;
      const nh = Math.floor(totalMins / 60) % 24;
      const nm = totalMins % 60;
      const fmt = (hh, mm) => `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const ans = fmt(nh, nm);
      const wrongs = [
        fmt(nh, (nm + 10) % 60),
        fmt((nh + 1) % 24, nm),
        fmt(nh, (nm + 50) % 60),
        fmt((nh + 23) % 24, (nm + 5) % 60)
      ];
      return makeQuestion(
        2,
        `Saat ${fmt(h, m)}-dan ${add} dəqiqə sonra saat neçə olacaq?`,
        ans,
        wrongs,
        `${add} dəqiqəni saat və dəqiqəyə bölüb ${fmt(h, m)} üzərinə əlavə edin.`
      );
    }

    if (mode === 3) {
      const type = randInt(0, 2);
      if (type === 0) {
        const start = randInt(3, 25);
        const diff = randInt(4, 17);
        const seq = [0, 1, 2, 3, 4].map((i) => start + i * diff);
        const ans = start + 5 * diff;
        return makeQuestion(
          2,
          `${seq.join(', ')}, ? — ardıcıllığında növbəti ədəd hansıdır?`,
          ans,
          numericDistractors(ans, [-diff, -4, -2, 2, 4, diff], '', 1),
          `Hər ədəd özündən əvvəlkindən ${diff} vahid böyükdür.`
        );
      }
      if (type === 1) {
        const start = randInt(2, 6);
        const mult = pick([2, 3]);
        const count = mult === 2 ? 5 : 4;
        const seq = [];
        let cur = start;
        for (let i = 0; i < count; i++) {
          seq.push(cur);
          cur *= mult;
        }
        return makeQuestion(
          2,
          `${seq.join(', ')}, ? — həndəsi silsiləsində növbəti ədəd neçədir?`,
          cur,
          numericDistractors(cur, [-12, -6, 6, 12, 24, -24], '', 2),
          `Hər sonrakı ədəd əvvəlkinin ${mult} mislidir.`
        );
      }
      const start = randInt(80, 140);
      const diff = randInt(6, 14);
      const seq = [0, 1, 2, 3].map((i) => start - i * diff);
      const ans = start - 4 * diff;
      return makeQuestion(
        2,
        `${seq.join(', ')}, ? — ardıcıllığında növbəti ədəd neçədir?`,
        ans,
        numericDistractors(ans, [-6, -3, 3, 6, 9], '', 1),
        `Hər dəfə ədəd ${diff} vahid azalır.`
      );
    }

    if (mode === 4) {
      const n = randInt(11, 29);
      const sq = n * n;
      if (randInt(0, 1) === 0) {
        return makeQuestion(
          2,
          `${n} ədədinin kvadratı (${n}²) neçəyə bərabərdir?`,
          sq,
          numericDistractors(sq, [-20, -10, 10, 20, 40, -40], '', 100),
          `${n} × ${n} hasilini hesablayın.`
        );
      }
      return makeQuestion(
        2,
        `${sq} ədədinin kvadrat kökü (√${sq}) neçədir?`,
        n,
        numericDistractors(n, [-3, -2, -1, 1, 2, 3], '', 5),
        `Hansı ədədi özünə vurduqda ${sq} alınır?`
      );
    }

    if (mode === 5) {
      const a = randInt(25, 85);
      const b = randInt(25, 130 - a);
      const c = 180 - a - b;
      return makeQuestion(
        2,
        `Üçbucağın iki bucağı ${a}° və ${b}° olarsa, üçüncü bucağı neçə dərəcədir?`,
        `${c}°`,
        numericDistractors(c, [-15, -10, -5, 5, 10, 15], '°', 5),
        `Üçbucağın daxili bucaqlarının cəmi 180°-dir.`
      );
    }

    if (mode === 6) {
      const w = randInt(5, 18);
      const h = randInt(w + 2, 26);
      if (randInt(0, 1) === 0) {
        const area = w * h;
        return makeQuestion(
          2,
          `Tərəfləri ${w} sm və ${h} sm olan düzbucaqlının sahəsi neçə sm²-dir?`,
          `${area} sm²`,
          numericDistractors(area, [-12, -6, 6, 12, 20], ' sm²', 10),
          `Enini uzununa vurun (${w} × ${h}).`
        );
      }
      const per = 2 * (w + h);
      return makeQuestion(
        2,
        `Tərəfləri ${w} sm və ${h} sm olan düzbucaqlının perimetri neçə sm-dir?`,
        `${per} sm`,
        [`${w + h} sm`, `${w * h} sm`, `${per + 4} sm`, `${per - 4} sm`],
        `2 × (${w} + ${h}) düsturundan istifadə edin.`
      );
    }

    if (mode === 7) {
      const n = randInt(31, 399);
      const rom = toRoman(n);
      return makeQuestion(
        2,
        `Roma rəqəmi "${rom}" hansı ədədi bildirir?`,
        n,
        numericDistractors(n, [-20, -10, -5, 5, 10, 20], '', 10),
        `C=100, L=50, X=10, V=5, I=1 qiymətləri ilə toplayın.`
      );
    }

    const subset = shuffle(ELEMENT_SYMBOLS).slice(0, 4);
    const target = subset[0];
    const wrongPairs = subset.slice(1).map((el, idx) => {
      const shiftedSym = subset[((idx + 1) % 3) + 1][1];
      return `${el[0]} — ${shiftedSym === el[1] ? target[1] : shiftedSym}`;
    });
    return makeQuestion(
      2,
      `Kimyada aşağıdakı "Element — Simvol" cütlüklərindən hansı DOĞRUDUR?`,
      `${target[0]} — ${target[1]}`,
      wrongPairs,
      `${target[0]} elementinin latınca adını xatırlayın.`
    );
  }

  function genHard() {
    const mode = randInt(1, 7);

    if (mode === 1) {
      const n = randInt(17, 125);
      const bin = n.toString(2);
      if (randInt(0, 1) === 0) {
        const wrongs = [];
        for (const off of [-4, -2, 2, 4, 8]) {
          const cand = (n + off).toString(2);
          if (cand !== bin && !wrongs.includes(cand)) wrongs.push(cand);
        }
        return makeQuestion(
          3,
          `Onluq say sistemindəki "${n}" ədədi ikilik (binary) sistemdə necə yazılır?`,
          bin,
          wrongs,
          `2-nin qüvvətlərinin (64, 32, 16, 8, 4, 2, 1) cəmi şəklində göstərin.`
        );
      }
      return makeQuestion(
        3,
        `İkilik (binary) say sistemindəki "${bin}" ədədi onluq sistemdə neçəyə bərabərdir?`,
        n,
        numericDistractors(n, [-8, -4, -2, 2, 4, 8], '', 2),
        `Sağdan sola 1, 2, 4, 8, 16, 32, 64 qüvvətlərini toplayın.`
      );
    }

    if (mode === 2) {
      const triples = [
        [3, 4, 5],
        [5, 12, 13],
        [8, 15, 17],
        [7, 24, 25]
      ];
      const base = pick(triples);
      const k = randInt(1, 5);
      const a = base[0] * k;
      const b = base[1] * k;
      const c = base[2] * k;
      return makeQuestion(
        3,
        `Katetləri ${a} sm və ${b} sm olan düzbucaqlı üçbucağın hipotenuzu neçə sm-dir?`,
        `${c} sm`,
        numericDistractors(c, [-4, -2, 2, 4, 6], ' sm', 3),
        `Pifaqor teoremi: c² = ${a}² + ${b}² = ${a * a + b * b}.`
      );
    }

    if (mode === 3) {
      const n = randInt(410, 2026);
      const rom = toRoman(n);
      return makeQuestion(
        3,
        `Roma rəqəmi "${rom}" hansı ili/ədədi ifadə edir?`,
        n,
        numericDistractors(n, [-100, -50, -10, 10, 50, 100], '', 100),
        `M=1000, D=500, C=100, L=50, X=10 (kiçik soldadırsa çıxılır).`
      );
    }

    if (mode === 4) {
      const base = pick([100, 150, 200, 250, 300, 400, 500, 600, 800, 1000]);
      const inc = pick([10, 20, 25, 50]);
      const dec = pick([10, 20, 25]);
      const afterInc = base * (1 + inc / 100);
      const finalVal = Math.round(afterInc * (1 - dec / 100));
      return makeQuestion(
        3,
        `${base} manatlıq məhsulun qiyməti əvvəl ${inc}% artırılıb, sonra yeni qiymətdən ${dec}% endirim edilərsə, son qiymət neçə manat olar?`,
        `${finalVal} manat`,
        numericDistractors(finalVal, [-25, -15, -10, 10, 15, 25], ' manat', 10),
        `Əvvəl ${base} + ${inc}% = ${afterInc}, sonra ondan ${dec}% çıxın.`
      );
    }

    if (mode === 5) {
      const count = randInt(3, 6);
      const avg = randInt(14, 48);
      const sum = count * avg;
      return makeQuestion(
        3,
        `${count} ədədin ədədi ortası ${avg} olarsa, bu ədədlərin cəmi neçəyə bərabərdir?`,
        sum,
        numericDistractors(sum, [-count * 2, -count, count, count * 2, 10], '', 10),
        `Ədədi ortanı (${avg}) ədədlərin sayına (${count}) vurun.`
      );
    }

    if (mode === 6) {
      const a = randInt(14, 35);
      const b = randInt(4, a - 3);
      const ans = a * a - b * b;
      return makeQuestion(
        3,
        `${a}² - ${b}² ifadəsinin qiyməti neçəyə bərabərdir?`,
        ans,
        numericDistractors(ans, [-20, -10, -4, 4, 10, 20], '', 5),
        `Kvadratlar fərqi düsturu: (${a} - ${b}) × (${a} + ${b}) = ${a - b} × ${a + b}.`
      );
    }

    const subset = shuffle(COUNTRY_CAPITAL_PAIRS).slice(0, 5);
    const wrongTarget = subset[0];
    const fakeCapital = subset[4][1];
    const wrongStr = `${wrongTarget[0]} — ${fakeCapital}`;
    const correctPairs = [
      `${subset[1][0]} — ${subset[1][1]}`,
      `${subset[2][0]} — ${subset[2][1]}`,
      `${subset[3][0]} — ${subset[3][1]}`
    ];
    return makeQuestion(
      3,
      `Aşağıdakı "Ölkə — Paytaxt" cütlüklərindən hansı SƏHV göstərilib?`,
      wrongStr,
      correctPairs,
      `${wrongTarget[0]} ölkəsinin əsl paytaxtı ${fakeCapital} deyil.`
    );
  }

  function generateOne(difficulty, seenTexts) {
    const diff = Number(difficulty);
    for (let attempt = 0; attempt < 25; attempt++) {
      let item = null;
      if (diff === 1) item = genEasy();
      else if (diff === 2) item = genMedium();
      else item = genHard();

      if (!item) continue;
      const norm = item.question.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenTexts && seenTexts.has(norm)) continue;
      if (seenTexts) seenTexts.add(norm);
      return item;
    }
    return null;
  }

  function generateDynamicBatch(difficulty, count, seenTexts) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const q = generateOne(difficulty, seenTexts);
      if (q) out.push(q);
    }
    return out;
  }

  // --- BAYRAĞI TAP TURU GENERATORU ---
  function generateFlagRound(count, seenCodes) {
    let available = FLAG_COUNTRIES.filter(([code]) => !seenCodes || !seenCodes.has(code));
    if (available.length < count) {
      if (seenCodes) seenCodes.clear();
      available = FLAG_COUNTRIES.slice();
    }

    const chosen = shuffle(available).slice(0, count);
    const allNames = FLAG_COUNTRIES.map((c) => c[1]);
    const out = [];

    for (const [code, name, region] of chosen) {
      if (seenCodes) seenCodes.add(code);
      const wrongNames = shuffle(allNames.filter((n) => n !== name)).slice(0, 3);
      const q = makeQuestion(
        2,
        `Bu bayraq hansı dövlətə məxsusdur?`,
        name,
        wrongNames,
        `Bölgə ipucu: ${region}.`
      );
      if (q) {
        q.mode = 'flag';
        q.flagCode = code;
        q.flagUrl = `https://flagcdn.com/w320/${code}.png`;
        q.answerAliases = [normalizeAz(name)];
        out.push(q);
      }
    }
    return out;
  }

  // --- DOĞRU YOXSA YANLIŞ TURU GENERATORU ---
  function generateTrueFalseRound(count, seenTexts) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard < 200) {
      guard++;
      const roll = randInt(1, 10);
      let statement = '';
      let isTrue = true;
      let explanation = '';

      if (roll <= 4) {
        const pair = pick(CURATED_TF);
        statement = pair[0];
        isTrue = pair[1];
        explanation = pair[2];
      } else if (roll <= 7) {
        const idx = randInt(0, COUNTRY_CAPITAL_PAIRS.length - 1);
        const [country, realCap] = COUNTRY_CAPITAL_PAIRS[idx];
        isTrue = randInt(0, 1) === 0;
        if (isTrue) {
          statement = `${country} dövlətinin rəsmi paytaxtı ${realCap} şəhəridir.`;
          explanation = `Doğrudur! ${country} — ${realCap}.`;
        } else {
          const fakeCap = pick(COUNTRY_CAPITAL_PAIRS.filter((x) => x[1] !== realCap))[1];
          statement = `${country} dövlətinin rəsmi paytaxtı ${fakeCap} şəhəridir.`;
          explanation = `Yanlışdır! ${country} dövlətinin paytaxtı ${realCap} şəhəridir.`;
        }
      } else if (roll <= 9) {
        const a = randInt(4, 18);
        const b = randInt(3, 14);
        const realProd = a * b;
        isTrue = randInt(0, 1) === 0;
        const shown = isTrue ? realProd : realProd + pick([-4, -2, 2, 4, 6]);
        statement = `Riyazi bərabərlik: ${a} × ${b} = ${shown}`;
        explanation = isTrue ? `Doğrudur! ${a} × ${b} = ${realProd}.` : `Yanlışdır! Düzgün cavab ${realProd}-dir.`;
      } else {
        const el = pick(ELEMENT_SYMBOLS);
        isTrue = randInt(0, 1) === 0;
        if (isTrue) {
          statement = `Kimyada "${el[0]}" elementinin simvolu "${el[1]}"-dir.`;
          explanation = `Doğrudur! ${el[0]} (${el[1]}).`;
        } else {
          const fakeSym = pick(ELEMENT_SYMBOLS.filter((x) => x[1] !== el[1]))[1];
          statement = `Kimyada "${el[0]}" elementinin simvolu "${fakeSym}"-dir.`;
          explanation = `Yanlışdır! ${el[0]} elementinin simvolu "${el[1]}"-dir.`;
        }
      }

      const norm = normalizeAz(statement);
      if (seenTexts && seenTexts.has(norm)) continue;
      if (seenTexts) seenTexts.add(norm);

      out.push({
        id: `tf_${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
        mode: 'truefalse',
        difficulty: 2,
        question: statement,
        options: {
          A: '✅ DOĞRU',
          B: '❌ YANLIŞ',
          C: '',
          D: ''
        },
        correct: isTrue ? 'A' : 'B',
        hint: explanation,
        isDynamic: true
      });
    }
    return out;
  }

  // --- SÖZ VƏ EMOJİ TAPMACASI GENERATORU ---
  function scrambleWord(word) {
    const chars = Array.from(word.toUpperCase());
    if (chars.length <= 2) return chars.join(' ');
    let scrambled = shuffle(chars);
    let tries = 0;
    while (scrambled.join('') === chars.join('') && tries < 10) {
      scrambled = shuffle(chars);
      tries++;
    }
    return scrambled.join('  ');
  }

  function generateWordRound(count, seenKeys) {
    const out = [];
    const totalPoolCount = EMOJI_PUZZLES.length + WORD_ANAGRAMS.length;
    if (seenKeys && seenKeys.size >= totalPoolCount - count) {
      seenKeys.clear();
    }

    const combined = [];
    EMOJI_PUZZLES.forEach(([emoji, word, aliases, hint]) => {
      combined.push({
        key: `em_${word}`,
        kind: 'emoji',
        display: emoji,
        word,
        aliases: aliases.map(normalizeAz),
        hint
      });
    });
    WORD_ANAGRAMS.forEach(([word, hint]) => {
      combined.push({
        key: `an_${word}`,
        kind: 'anagram',
        display: scrambleWord(word),
        word,
        aliases: [normalizeAz(word)],
        hint
      });
    });

    const fresh = shuffle(combined.filter((item) => !seenKeys || !seenKeys.has(item.key)));
    const picked = fresh.slice(0, count);

    for (const item of picked) {
      if (seenKeys) seenKeys.add(item.key);
      out.push({
        id: `word_${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
        mode: 'word',
        kind: item.kind,
        difficulty: 2,
        question:
          item.kind === 'emoji'
            ? `Emojilərə baxıb gizli sözü rəydə yazın! (${item.hint})`
            : `Qarışıq hərflərdən sözü düzəldib rəydə yazın! (İpucu: ${item.hint})`,
        puzzlePrompt: item.display,
        answerWord: item.word,
        answerAliases: [...new Set([normalizeAz(item.word), ...item.aliases])],
        hint: item.hint,
        options: { A: '', B: '', C: '', D: '' },
        correct: 'A',
        isDynamic: true
      });
    }
    return out;
  }

  // --- SÜRƏT DUELİ (İLK YAZAN QAZANIR) GENERATORU ---
  const SPEED_TRIVIA = [
    ['Azərbaycanın paytaxtı hansı şəhərdir?', 'Bakı', ['baki', 'baku']],
    ['Azərbaycanın ikinci böyük şəhəri hansıdır?', 'Gəncə', ['gence']],
    ['Azərbaycanın ən hündür dağı hansıdır?', 'Bazardüzü', ['bazarduzu']],
    ['Azərbaycanın ən uzun çayı hansıdır?', 'Kür', ['kur', 'kur cayi']],
    ['Azərbaycan əlifbasında neçə hərf var?', '32', ['32', 'otuz iki']],
    ['1 saat neçə dəqiqədir?', '60', ['60']],
    ['Bir gündə neçə saat var?', '24', ['24']],
    ['Bir ildə neçə ay var?', '12', ['12']],
    ['Şahmat taxtasında neçə xana var?', '64', ['64']],
    ['Futbolda bir komandada neçə oyunçu olur?', '11', ['11']],
    ['Yerə ən yaxın ulduz hansıdır?', 'Günəş', ['gunes']],
    ['Hansı planet "Qırmızı planet" adlanır?', 'Mars', ['mars']],
    ['Günəş sisteminin ən böyük planeti hansıdır?', 'Yupiter', ['yupiter']],
    ['Suyun kimyəvi formulu nədir?', 'H2O', ['h2o']],
    ['Qızılın kimyəvi simvolu nədir?', 'Au', ['au']],
    ['Gümüşün kimyəvi simvolu nədir?', 'Ag', ['ag']],
    ['Azərbaycanın milli valyutası nədir?', 'Manat', ['manat', 'azn']],
    ['Türkiyənin paytaxtı hansı şəhərdir?', 'Ankara', ['ankara']],
    ['Fransanın paytaxtı hansı şəhərdir?', 'Paris', ['paris']],
    ['İtaliyanın paytaxtı hansı şəhərdir?', 'Roma', ['roma']],
    ['Almaniyanın paytaxtı hansı şəhərdir?', 'Berlin', ['berlin']],
    ['Yaponiyanın paytaxtı hansı şəhərdir?', 'Tokio', ['tokio', 'tokyo']],
    ['Qarabağın incisi sayılan mədəniyyət paytaxtımız hansıdır?', 'Şuşa', ['susa']],
    ['Dünyanın ən sürətli quru heyvanı hansıdır?', 'Gepard', ['gepard']],
    ['Dünyanın ən hündür dağı hansıdır?', 'Everest', ['everest']],
    ['Yetkin insanın ağzında neçə diş olur?', '32', ['32']],
    ['İnsan ürəyində neçə kamera var?', '4', ['4']],
    ['Suyun donma temperaturu neçə dərəcədir?', '0', ['0']]
  ];

  function generateSpeedRound(count, seenTexts) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard < 180) {
      guard++;
      const roll = randInt(1, 10);
      let question = '';
      let answer = '';
      let aliases = [];
      let hint = '';

      if (roll <= 3) {
        const t = pick(SPEED_TRIVIA);
        question = t[0];
        answer = t[1];
        aliases = t[2];
        hint = `Rəydə birbaşa cavabı yazın!`;
      } else if (roll <= 6) {
        const type = randInt(0, 2);
        if (type === 0) {
          const a = randInt(6, 19);
          const b = randInt(3, 9);
          const res = a * b;
          question = `${a} × ${b} neçəyə bərabərdir?`;
          answer = String(res);
          aliases = [answer];
          hint = `Tez hesablayıb rəydə yazın!`;
        } else if (type === 1) {
          const a = randInt(15, 65);
          const b = randInt(15, 65);
          const res = a + b;
          question = `${a} + ${b} cəmi neçədir?`;
          answer = String(res);
          aliases = [answer];
          hint = `Toplama əməlini tez yerinə yetirin!`;
        } else {
          const pct = pick([10, 25, 50]);
          const mult = pct === 25 ? 4 : pct === 10 ? 10 : 2;
          const res = randInt(4, 30) * 2;
          const base = res * mult;
          question = `${base}-in ${pct}%-i neçədir?`;
          answer = String(res);
          aliases = [answer];
          hint = `${base}-i ${mult}-ə bölün!`;
        }
      } else if (roll <= 8) {
        const [country, cap] = pick(COUNTRY_CAPITAL_PAIRS.slice(0, 35));
        question = `${country} dövlətinin paytaxtı hansı şəhərdir?`;
        answer = cap;
        aliases = [normalizeAz(cap)];
        hint = `Şəhərin adını rəydə yazın!`;
      } else {
        const n = randInt(5, 29);
        const rom = toRoman(n);
        question = `Roma rəqəmi "${rom}" neçəyə bərabərdir?`;
        answer = String(n);
        aliases = [answer];
        hint = `Ədədi rəqəmlə yazın!`;
      }

      const normQ = normalizeAz(question);
      if (seenTexts && seenTexts.has(normQ)) continue;
      if (seenTexts) seenTexts.add(normQ);

      out.push({
        id: `spd_${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
        mode: 'speed',
        difficulty: 2,
        question,
        answerWord: answer,
        answerAliases: [...new Set([normalizeAz(answer), ...aliases.map(normalizeAz)])],
        hint,
        options: { A: '', B: '', C: '', D: '' },
        correct: 'A',
        isDynamic: true
      });
    }
    return out;
  }

  return {
    normalizeAz,
    generateOne,
    generateDynamicBatch,
    generateFlagRound,
    generateTrueFalseRound,
    generateWordRound,
    generateSpeedRound,
    VIRTUAL_COMBINATION_COUNT: 10000
  };
});
