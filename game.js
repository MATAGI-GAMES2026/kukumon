/* =========================================================
   九九モンスター 育成バトル（くくモン）ゲームロジック
   ========================================================= */

(() => {
  "use strict";

  const SAVE_KEY = "kukumon_save_v1";

  // 進化段階定義
  const EVOLUTIONS = [
    { stage: 1, minLv: 1, name: "タマゴ", img: "assets/images/partner_1.png" },
    { stage: 2, minLv: 3, name: "チビドラ", img: "assets/images/partner_2.png" },
    { stage: 3, minLv: 6, name: "フレイムドラ", img: "assets/images/partner_3.png" },
    { stage: 4, minLv: 10, name: "キングドラゴン", img: "assets/images/partner_4.png" },
  ];

  // きょうかショップ定義
  const SHOP_ITEMS = [
    {
      id: "atkLv",
      icon: "⚔️",
      title: "こうげき力 UP",
      desc: "モンスターへの ダメージが +6 ふえるよ！",
      maxLv: 5,
      baseCost: 30,
      stepCost: 25,
    },
    {
      id: "hpLv",
      icon: "❤️",
      title: "ハート（HP）ぞうか",
      desc: "バトルの ハートが +1 ふえるよ！",
      maxLv: 5,
      baseCost: 40,
      stepCost: 30,
    },
    {
      id: "critLv",
      icon: "⚡",
      title: "かいしん時間 えんちょう",
      desc: "かいしんの いちげき の じかんが +1びょう ふえるよ！",
      maxLv: 5,
      baseCost: 35,
      stepCost: 25,
    },
  ];

  // 敵モンスターカタログ（全7種）
  const ENEMIES = {
    mushroom: { name: "きのこボーイ", img: "assets/images/mob_mushroom.png" },
    goblin: { name: "ちびゴブリン", img: "assets/images/mob_goblin.png" },
    lizard: { name: "トカゲせんし", img: "assets/images/mob_lizard.png" },
    ghost: { name: "まほうおばけ", img: "assets/images/mob_ghost.png" },
    slime: { name: "キングスライム", img: "assets/images/boss_slime.png" },
    golem: { name: "ファイアゴーレム", img: "assets/images/boss_golem.png" },
    demon: { name: "ダーク魔王", img: "assets/images/boss_demon.png" },
  };

  // 段ごとの設定（1戦目・2戦目・ボス戦すべて専用モンスター）
  const DAN_META = [
    { dan: 1, tier: "slime", bossKey: "slime", bossName: "キングスライム", mobKeys: ["mushroom", "goblin"] },
    { dan: 2, tier: "slime", bossKey: "slime", bossName: "キングスライム", mobKeys: ["goblin", "mushroom"] },
    { dan: 3, tier: "slime", bossKey: "slime", bossName: "キングスライム", mobKeys: ["mushroom", "lizard"] },
    { dan: 4, tier: "golem", bossKey: "golem", bossName: "ファイアゴーレム", mobKeys: ["goblin", "lizard"] },
    { dan: 5, tier: "golem", bossKey: "golem", bossName: "ファイアゴーレム", mobKeys: ["lizard", "ghost"] },
    { dan: 6, tier: "golem", bossKey: "golem", bossName: "ファイアゴーレム", mobKeys: ["mushroom", "slime"] },
    { dan: 7, tier: "demon", bossKey: "demon", bossName: "ダーク魔王", mobKeys: ["ghost", "lizard"] },
    { dan: 8, tier: "demon", bossKey: "demon", bossName: "ダーク魔王", mobKeys: ["lizard", "ghost"] },
    { dan: 9, tier: "demon", bossKey: "demon", bossName: "ダーク魔王", mobKeys: ["slime", "golem"] },
  ];

  const PARTNER_LINES = [
    "いっしょに 九九バトル しよう！",
    "すごいぞ！ つぎも がんばろう！",
    "かいしんの いちげき を ねらおう！",
    "きょうかショップ で つよくなれるよ！",
    "ぜんぶの 段 クリアを めざそう！",
    "にがてな もんだい も レンシュウすれば だいじょうぶ！",
  ];

  /* =========================================================
     Web Audio API サウンドマネージャー（外部音声ファイル不要）
     ========================================================= */
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    ensureContext() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    setMuted(flag) {
      this.muted = !!flag;
    }

    playTone(freq, duration, type = "sine", volume = 0.16, delay = 0, freqEnd = null) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
      }
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playNoise(duration, volume = 0.2, delay = 0, filterFreq = 800) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + duration + 0.02);
    }

    click() {
      this.playTone(640, 0.07, "triangle", 0.14, 0, 880);
    }

    clear() {
      this.playTone(360, 0.08, "sine", 0.13, 0, 220);
    }

    fireAttack() {
      this.playNoise(0.36, 0.24, 0, 1400);
      this.playTone(280, 0.28, "sawtooth", 0.12, 0.02, 110);
      this.playTone(150, 0.18, "square", 0.15, 0.24, 65);
    }

    criticalHit() {
      this.playTone(880, 0.1, "square", 0.14, 0, 1320);
      this.playTone(1320, 0.16, "triangle", 0.18, 0.08, 1760);
      this.playNoise(0.45, 0.3, 0.05, 1900);
      this.playTone(130, 0.25, "sawtooth", 0.18, 0.22, 50);
    }

    ultimate() {
      const notes = [523, 659, 784, 1046, 1318];
      notes.forEach((n, i) => this.playTone(n, 0.12, "square", 0.13, i * 0.055));
      this.playNoise(0.7, 0.35, 0.18, 2200);
      this.playTone(160, 0.45, "sawtooth", 0.2, 0.25, 42);
    }

    wrong() {
      this.playTone(220, 0.16, "sawtooth", 0.15, 0, 180);
      this.playTone(165, 0.24, "sawtooth", 0.15, 0.15, 125);
    }

    enemyDefeat() {
      this.playTone(520, 0.1, "triangle", 0.15, 0, 780);
      this.playTone(780, 0.14, "triangle", 0.15, 0.09, 1040);
      this.playNoise(0.25, 0.16, 0.06, 1200);
    }

    coin() {
      this.playTone(988, 0.08, "sine", 0.15, 0);
      this.playTone(1319, 0.18, "sine", 0.16, 0.07);
    }

    fanfare() {
      const seq = [
        [523.25, 0.11, 0.0],
        [659.25, 0.11, 0.11],
        [783.99, 0.11, 0.22],
        [1046.5, 0.36, 0.33],
      ];
      seq.forEach(([f, d, t]) => this.playTone(f, d, "triangle", 0.18, t));
    }

    evolveFanfare() {
      const seq = [
        [523.25, 0.1, 0.0],
        [587.33, 0.1, 0.1],
        [659.25, 0.1, 0.2],
        [783.99, 0.12, 0.3],
        [1046.5, 0.14, 0.44],
        [1318.5, 0.42, 0.58],
      ];
      seq.forEach(([f, d, t]) => this.playTone(f, d, "square", 0.14, t));
    }
  }

  const sfx = new SoundManager();

  /* =========================================================
     セーブデータ管理
     ========================================================= */
  function createDefaultSave() {
    return {
      level: 1,
      exp: 0,
      coins: 0,
      atkLv: 0,
      hpLv: 0,
      critLv: 0,
      clearedDans: [],
      weakProblems: {}, // 例: { "7x8": 2 }
      muted: false,
      totalCorrect: 0,
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return createDefaultSave();
      const parsed = JSON.parse(raw);
      return { ...createDefaultSave(), ...parsed };
    } catch {
      return createDefaultSave();
    }
  }

  let saveData = loadSave();
  sfx.setMuted(saveData.muted);

  function persistSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch {
      // プライベートブラウズ等で失敗しても続行
    }
  }

  function getExpNeeded(level) {
    return 80 + (level - 1) * 45;
  }

  function getEvolution(level) {
    let current = EVOLUTIONS[0];
    for (const evo of EVOLUTIONS) {
      if (level >= evo.minLv) current = evo;
    }
    return current;
  }

  function getNextEvolution(level) {
    for (const evo of EVOLUTIONS) {
      if (level < evo.minLv) return evo;
    }
    return null;
  }

  function getPlayerStats() {
    const evo = getEvolution(saveData.level);
    return {
      atk: 24 + (saveData.level - 1) * 4 + saveData.atkLv * 6,
      maxHp: 3 + saveData.hpLv,
      critSeconds: 4.5 + saveData.critLv * 1.0,
      evo,
    };
  }

  /* =========================================================
     DOM 参照
     ========================================================= */
  const el = {
    homeScreen: document.getElementById("home-screen"),
    battleScreen: document.getElementById("battle-screen"),
    homeCoins: document.getElementById("home-coins"),
    btnOpenShop: document.getElementById("btn-open-shop"),
    btnSoundHome: document.getElementById("btn-sound-home"),
    btnSoundBattle: document.getElementById("btn-sound-battle"),

    partnerStageBadge: document.getElementById("partner-stage-badge"),
    partnerLevelText: document.getElementById("partner-level-text"),
    homePartnerStage: document.getElementById("home-partner-stage"),
    homePartnerImg: document.getElementById("home-partner-img"),
    partnerSpeech: document.getElementById("partner-speech"),
    homeExpText: document.getElementById("home-exp-text"),
    homeExpBar: document.getElementById("home-exp-bar"),
    nextEvoHint: document.getElementById("next-evo-hint"),
    statAtk: document.getElementById("stat-atk"),
    statHp: document.getElementById("stat-hp"),
    statCrit: document.getElementById("stat-crit"),
    homeClearCount: document.getElementById("home-clear-count"),
    danGrid: document.getElementById("dan-grid"),
    btnStageRandom: document.getElementById("btn-stage-random"),
    btnStageRevenge: document.getElementById("btn-stage-revenge"),
    revengeDesc: document.getElementById("revenge-desc"),
    revengeBadge: document.getElementById("revenge-badge"),

    battlePartnerIcon: document.getElementById("battle-partner-icon"),
    battlePartnerName: document.getElementById("battle-partner-name"),
    battlePartnerLv: document.getElementById("battle-partner-lv"),
    playerHearts: document.getElementById("player-hearts"),
    battleStageTitle: document.getElementById("battle-stage-title"),
    battleWavePills: document.getElementById("battle-wave-pills"),
    enemyName: document.getElementById("enemy-name"),
    enemyHpText: document.getElementById("enemy-hp-text"),
    enemyHpBar: document.getElementById("enemy-hp-bar"),
    btnPause: document.getElementById("btn-pause"),

    battleField: document.getElementById("battle-field"),
    thunderFlash: document.getElementById("thunder-flash"),
    damageVignette: document.getElementById("damage-vignette"),
    partnerActor: document.getElementById("partner-actor"),
    battlePartnerImg: document.getElementById("battle-partner-img"),
    enemyActor: document.getElementById("enemy-actor"),
    enemyBossAura: document.getElementById("enemy-boss-aura"),
    battleEnemyImg: document.getElementById("battle-enemy-img"),
    fireEffect: document.getElementById("fire-effect"),
    damagePopupContainer: document.getElementById("damage-popup-container"),

    qLeft: document.getElementById("q-left"),
    qRight: document.getElementById("q-right"),
    answerBox: document.getElementById("answer-box"),
    critBarFill: document.getElementById("crit-bar-fill"),

    wrongOverlay: document.getElementById("wrong-overlay"),
    wrongFormula: document.getElementById("wrong-formula"),
    btnWrongOk: document.getElementById("btn-wrong-ok"),

    btnClear: document.getElementById("btn-clear"),
    btnAttack: document.getElementById("btn-attack"),
    btnHelp: document.getElementById("btn-help"),
    helpCountText: document.getElementById("help-count-text"),
    btnSpecial: document.getElementById("btn-special"),
    specialChargeText: document.getElementById("special-charge-text"),
    ultimateBarFill: document.getElementById("ultimate-bar-fill"),
    numBtns: document.querySelectorAll(".num-btn"),

    shopModal: document.getElementById("shop-modal"),
    shopCoins: document.getElementById("shop-coins"),
    shopItems: document.getElementById("shop-items"),
    btnCloseShop: document.getElementById("btn-close-shop"),

    helpModal: document.getElementById("help-modal"),
    helpFormulaBadge: document.getElementById("help-formula-badge"),
    helpAdditionBox: document.getElementById("help-addition-box"),
    helpDotsCaption: document.getElementById("help-dots-caption"),
    helpDotsGrid: document.getElementById("help-dots-grid"),
    btnCloseHelp: document.getElementById("btn-close-help"),

    pauseModal: document.getElementById("pause-modal"),
    btnResume: document.getElementById("btn-resume"),
    btnQuitBattle: document.getElementById("btn-quit-battle"),

    resultModal: document.getElementById("result-modal"),
    resultTitle: document.getElementById("result-title"),
    resultEvoBanner: document.getElementById("result-evo-banner"),
    resultEvoImg: document.getElementById("result-evo-img"),
    resultEvoText: document.getElementById("result-evo-text"),
    resultExp: document.getElementById("result-exp"),
    resultCoins: document.getElementById("result-coins"),
    resultAcc: document.getElementById("result-acc"),
    resultLevelupNote: document.getElementById("result-levelup-note"),
    btnResultRetry: document.getElementById("btn-result-retry"),
    btnResultHome: document.getElementById("btn-result-home"),

    toast: document.getElementById("toast"),
  };

  /* =========================================================
     トースト・サウンドUI更新
     ========================================================= */
  let toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.add("hidden");
    }, 2200);
  }

  function updateSoundButtons() {
    const icon = saveData.muted ? "🔇" : "🔊";
    el.btnSoundHome.textContent = icon;
    el.btnSoundBattle.textContent = icon;
  }

  function toggleSound() {
    saveData.muted = !saveData.muted;
    sfx.setMuted(saveData.muted);
    persistSave();
    updateSoundButtons();
    if (!saveData.muted) sfx.click();
  }

  /* =========================================================
     ホーム画面レンダリング
     ========================================================= */
  function renderHome() {
    const stats = getPlayerStats();
    const evo = stats.evo;
    const needed = getExpNeeded(saveData.level);
    const pct = Math.min(100, Math.round((saveData.exp / needed) * 100));

    el.homeCoins.textContent = saveData.coins;
    el.partnerStageBadge.textContent = evo.name;
    el.partnerLevelText.textContent = `Lv.${saveData.level}`;
    el.homePartnerImg.src = evo.img;
    el.homeExpText.textContent = `${saveData.exp} / ${needed}`;
    el.homeExpBar.style.width = `${pct}%`;

    const nextEvo = getNextEvolution(saveData.level);
    if (nextEvo) {
      const diff = nextEvo.minLv - saveData.level;
      el.nextEvoHint.textContent = `つぎの しんか「${nextEvo.name}」まで あと Lv.${diff}！`;
    } else {
      el.nextEvoHint.textContent = "👑 さいしゅう しんか たっせい！ さいきょう！";
    }

    el.statAtk.textContent = stats.atk;
    el.statHp.textContent = stats.maxHp;
    el.statCrit.textContent = `${stats.critSeconds.toFixed(1)}びょう`;
    el.homeClearCount.textContent = `クリア ${saveData.clearedDans.length} / 9`;

    // 1〜9の段ボタン生成
    el.danGrid.innerHTML = "";
    DAN_META.forEach((m) => {
      const cleared = saveData.clearedDans.includes(m.dan);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dan-btn tier-${m.tier}`;
      btn.innerHTML = `
        ${cleared ? '<span class="dan-crown" title="クリアずみ">👑</span>' : ""}
        <span class="dan-btn-num">${m.dan}の段</span>
        <span class="dan-btn-sub">${m.bossName}</span>
      `;
      btn.addEventListener("click", () => {
        sfx.click();
        startBattle({ mode: "dan", dan: m.dan });
      });
      el.danGrid.appendChild(btn);
    });

    // にがてリベンジ
    const weakCount = Object.keys(saveData.weakProblems).length;
    el.revengeBadge.textContent = `${weakCount}もん`;
    if (weakCount === 0) {
      el.revengeDesc.textContent = "いまは にがて ゼロ！すごい！";
    } else {
      el.revengeDesc.textContent = `まちがえた ${weakCount}もん に リベンジしよう！`;
    }

    updateSoundButtons();
  }

  /* =========================================================
     きょうかショップ
     ========================================================= */
  function openShop() {
    sfx.click();
    renderShop();
    el.shopModal.classList.remove("hidden");
  }

  function renderShop() {
    el.shopCoins.textContent = saveData.coins;
    el.shopItems.innerHTML = "";

    SHOP_ITEMS.forEach((item) => {
      const currentLv = saveData[item.id] || 0;
      const isMax = currentLv >= item.maxLv;
      const cost = item.baseCost + currentLv * item.stepCost;
      const canBuy = !isMax && saveData.coins >= cost;

      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-title">${item.icon} ${item.title} <small>（Lv.${currentLv} / ${item.maxLv}）</small></div>
          <div class="shop-item-desc">${item.desc}</div>
        </div>
        <button type="button" class="shop-buy-btn" ${canBuy ? "" : "disabled"}>
          ${isMax ? "MAX！" : `🪙 ${cost} で きょうか`}
        </button>
      `;

      const buyBtn = row.querySelector(".shop-buy-btn");
      buyBtn.addEventListener("click", () => {
        if (isMax || saveData.coins < cost) return;
        saveData.coins -= cost;
        saveData[item.id] = currentLv + 1;
        persistSave();
        sfx.coin();
        showToast(`${item.title} が レベルアップしたよ！`);
        renderShop();
        renderHome();
      });

      el.shopItems.appendChild(row);
    });
  }

  /* =========================================================
     バトル状態とロジック
     ========================================================= */
  let battle = null;

  function buildWavesForStage(config) {
    const scale = Math.max(1, 0.85 + saveData.level * 0.1);

    if (config.mode === "dan") {
      const meta = DAN_META[config.dan - 1];
      const mob1 = ENEMIES[meta.mobKeys[0]];
      const mob2 = ENEMIES[meta.mobKeys[1]];
      const boss = ENEMIES[meta.bossKey];
      const mobHp = Math.round(52 * scale);
      const bossHp = Math.round(108 * scale);
      return [
        { name: mob1.name, img: mob1.img, maxHp: mobHp, isBoss: false, tintClass: "" },
        { name: mob2.name, img: mob2.img, maxHp: Math.round(mobHp * 1.15), isBoss: false, tintClass: "" },
        { name: boss.name, img: boss.img, maxHp: bossHp, isBoss: true, tintClass: "" },
      ];
    }

    // 全段ランダムの森・にがてリベンジの塔は雑魚＋中ボスから毎回ランダムに2体＋ボス
    const candidateKeys = shuffleArray(["mushroom", "goblin", "lizard", "ghost", "slime", "golem"]);
    const m1 = ENEMIES[candidateKeys[0]];
    const m2 = ENEMIES[candidateKeys[1]];
    const demon = ENEMIES.demon;

    if (config.mode === "random") {
      return [
        { name: m1.name, img: m1.img, maxHp: Math.round(62 * scale), isBoss: false, tintClass: "" },
        { name: m2.name, img: m2.img, maxHp: Math.round(78 * scale), isBoss: false, tintClass: "" },
        { name: demon.name, img: demon.img, maxHp: Math.round(135 * scale), isBoss: true, tintClass: "" },
      ];
    }

    // にがてリベンジの塔
    return [
      { name: m1.name, img: m1.img, maxHp: Math.round(55 * scale), isBoss: false, tintClass: "" },
      { name: m2.name, img: m2.img, maxHp: Math.round(68 * scale), isBoss: false, tintClass: "" },
      { name: "にがてダーク魔王", img: demon.img, maxHp: Math.round(115 * scale), isBoss: true, tintClass: "" },
    ];
  }

  function buildQuestionPool(config) {
    const pool = [];
    if (config.mode === "dan") {
      for (let b = 1; b <= 9; b++) {
        pool.push({ a: config.dan, b });
      }
    } else if (config.mode === "random") {
      for (let a = 1; a <= 9; a++) {
        for (let b = 1; b <= 9; b++) {
          pool.push({ a, b });
        }
      }
    } else {
      const keys = Object.keys(saveData.weakProblems);
      keys.forEach((k) => {
        const [a, b] = k.split("x").map(Number);
        if (a >= 1 && a <= 9 && b >= 1 && b <= 9) {
          pool.push({ a, b });
        }
      });
    }
    return shuffleArray(pool);
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startBattle(config) {
    if (config.mode === "revenge" && Object.keys(saveData.weakProblems).length === 0) {
      showToast("いまは にがてな もんだいが ないよ！ ほかの ステージへ いこう！");
      return;
    }

    const stats = getPlayerStats();
    const waves = buildWavesForStage(config);

    battle = {
      config,
      stats,
      playerHp: stats.maxHp,
      maxHp: stats.maxHp,
      waves,
      waveIndex: 0,
      enemyHp: waves[0].maxHp,
      enemyMaxHp: waves[0].maxHp,
      pool: buildQuestionPool(config),
      poolCursor: 0,
      currentQ: null,
      input: "",
      combo: 0,
      helpLeft: 2,
      answeredCount: 0,
      correctCount: 0,
      critRemainingMs: stats.critSeconds * 1000,
      critTotalMs: stats.critSeconds * 1000,
      lastTickTime: performance.now(),
      rafId: null,
      paused: false,
      locked: false,
      wrongAutoTimer: null,
    };

    // UI切り替え
    el.homeScreen.classList.remove("active");
    el.battleScreen.classList.add("active");
    el.wrongOverlay.classList.add("hidden");
    el.resultModal.classList.add("hidden");
    el.pauseModal.classList.add("hidden");
    el.helpModal.classList.add("hidden");

    // タイトル・相棒表示
    if (config.mode === "dan") {
      el.battleStageTitle.textContent = `${config.dan}の段`;
    } else if (config.mode === "random") {
      el.battleStageTitle.textContent = "全段ランダムの森";
    } else {
      el.battleStageTitle.textContent = "にがてリベンジの塔";
    }

    el.battlePartnerIcon.src = stats.evo.img;
    el.battlePartnerImg.src = stats.evo.img;
    el.battlePartnerName.textContent = stats.evo.name;
    el.battlePartnerLv.textContent = `Lv.${saveData.level}`;

    renderPlayerHearts();
    setupCurrentWave();
    updateSpecialButtons();
    nextQuestion();
    startCritLoop();
  }

  function renderPlayerHearts() {
    el.playerHearts.innerHTML = "";
    for (let i = 0; i < battle.maxHp; i++) {
      const span = document.createElement("span");
      span.className = `heart-icon ${i < battle.playerHp ? "" : "empty"}`;
      span.textContent = "❤️";
      el.playerHearts.appendChild(span);
    }
  }

  function setupCurrentWave() {
    const wave = battle.waves[battle.waveIndex];
    battle.enemyHp = wave.maxHp;
    battle.enemyMaxHp = wave.maxHp;

    el.enemyName.textContent = wave.name;
    el.battleEnemyImg.src = wave.img;

    el.enemyActor.className = "actor enemy-actor";
    if (!wave.isBoss) {
      el.enemyActor.classList.add("mob-small");
      if (wave.tintClass) el.enemyActor.classList.add(wave.tintClass);
      el.enemyBossAura.classList.add("hidden");
    } else {
      el.enemyBossAura.classList.remove("hidden");
    }

    // ウェーブインジケータ更新
    const pills = el.battleWavePills.querySelectorAll(".wave-pill");
    pills.forEach((pill, idx) => {
      pill.classList.remove("active", "done");
      if (idx < battle.waveIndex) pill.classList.add("done");
      if (idx === battle.waveIndex) pill.classList.add("active");
    });

    updateEnemyHpBar();
  }

  function updateEnemyHpBar() {
    const ratio = Math.max(0, Math.min(100, (battle.enemyHp / battle.enemyMaxHp) * 100));
    el.enemyHpBar.style.width = `${ratio}%`;
    el.enemyHpText.textContent = `${Math.max(0, battle.enemyHp)} / ${battle.enemyMaxHp}`;
  }

  function nextQuestion() {
    if (!battle) return;
    if (battle.poolCursor >= battle.pool.length) {
      battle.pool = buildQuestionPool(battle.config);
      if (battle.pool.length === 0) {
        // にがてリベンジで全問解消された場合はランダム補完
        battle.pool = buildQuestionPool({ mode: "random" });
      }
      battle.poolCursor = 0;
    }

    // 直前と同じ問題が連続しないよう調整
    let q = battle.pool[battle.poolCursor++];
    if (battle.currentQ && battle.pool.length > 1 && q.a === battle.currentQ.a && q.b === battle.currentQ.b) {
      if (battle.poolCursor < battle.pool.length) {
        const swap = battle.pool[battle.poolCursor];
        battle.pool[battle.poolCursor] = q;
        q = swap;
      }
    }

    battle.currentQ = q;
    battle.input = "";
    battle.critRemainingMs = battle.critTotalMs;
    battle.lastTickTime = performance.now();

    el.qLeft.textContent = q.a;
    el.qRight.textContent = q.b;
    renderAnswerBox();
    el.critBarFill.style.width = "100%";
  }

  function renderAnswerBox() {
    if (!battle || battle.input === "") {
      el.answerBox.textContent = "";
      el.answerBox.classList.add("empty");
    } else {
      el.answerBox.textContent = battle.input;
      el.answerBox.classList.remove("empty");
    }
  }

  function handleDigitInput(digit) {
    if (!battle || battle.paused || battle.locked) return;
    sfx.click();
    // 九九の答えは最大2桁：2桁入力済みで次の数字を押した場合は新しい1桁目に上書き
    if (battle.input.length >= 2) {
      battle.input = digit;
    } else {
      battle.input += digit;
    }
    renderAnswerBox();
  }

  function handleClearInput() {
    if (!battle || battle.paused || battle.locked) return;
    if (battle.input.length > 0) {
      sfx.clear();
      battle.input = battle.input.slice(0, -1);
      renderAnswerBox();
    }
  }

  function updateSpecialButtons() {
    if (!battle) return;
    el.helpCountText.textContent = `あと ${battle.helpLeft}かい`;
    el.btnHelp.disabled = battle.helpLeft <= 0;

    const charge = Math.min(5, battle.combo);
    el.specialChargeText.textContent = charge >= 5 ? "まんたん！ タップ！" : `${charge} / 5 れんぞく`;
    el.ultimateBarFill.style.width = `${(charge / 5) * 100}%`;

    if (charge >= 5) {
      el.btnSpecial.disabled = false;
      el.btnSpecial.classList.add("ready");
    } else {
      el.btnSpecial.disabled = true;
      el.btnSpecial.classList.remove("ready");
    }
  }

  /* =========================================================
     かいしんタイムゲージ更新ループ
     ========================================================= */
  function startCritLoop() {
    stopCritLoop();
    const tick = (now) => {
      if (!battle) return;
      if (!battle.paused && !battle.locked) {
        const dt = now - battle.lastTickTime;
        battle.critRemainingMs = Math.max(0, battle.critRemainingMs - dt);
        const pct = (battle.critRemainingMs / battle.critTotalMs) * 100;
        el.critBarFill.style.width = `${pct}%`;
      }
      battle.lastTickTime = now;
      battle.rafId = requestAnimationFrame(tick);
    };
    battle.lastTickTime = performance.now();
    battle.rafId = requestAnimationFrame(tick);
  }

  function stopCritLoop() {
    if (battle && battle.rafId) {
      cancelAnimationFrame(battle.rafId);
      battle.rafId = null;
    }
  }

  /* =========================================================
     攻撃判定・演出
     ========================================================= */
  function submitAnswer() {
    if (!battle || battle.paused || battle.locked) return;
    if (battle.input === "") {
      showToast("すうじボタン で こたえを いれてね！");
      return;
    }

    const userVal = parseInt(battle.input, 10);
    const { a, b } = battle.currentQ;
    const correctVal = a * b;
    battle.answeredCount++;

    if (userVal === correctVal) {
      battle.correctCount++;
      saveData.totalCorrect++;
      battle.combo++;

      // にがてリベンジで正解したら苦手度を減らす
      const key = `${a}x${b}`;
      if (saveData.weakProblems[key]) {
        saveData.weakProblems[key]--;
        if (saveData.weakProblems[key] <= 0) {
          delete saveData.weakProblems[key];
        }
        persistSave();
      }

      const isCrit = battle.critRemainingMs > 0;
      const baseDmg = battle.stats.atk;
      const dmg = isCrit ? Math.round(baseDmg * 1.8) : baseDmg;

      updateSpecialButtons();
      executeAttackSequence(dmg, isCrit ? "crit" : "normal");
    } else {
      // 不正解
      battle.combo = 0;
      updateSpecialButtons();

      const key = `${a}x${b}`;
      saveData.weakProblems[key] = (saveData.weakProblems[key] || 0) + 1;
      persistSave();

      executeWrongSequence(a, b, correctVal);
    }
  }

  function triggerUltimate() {
    if (!battle || battle.paused || battle.locked || battle.combo < 5) return;
    battle.combo = 0;
    updateSpecialButtons();
    const dmg = Math.round(battle.stats.atk * 3.4);
    executeAttackSequence(dmg, "ultimate");
  }

  function triggerAnim(element, className, durationMs) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    if (durationMs) {
      setTimeout(() => element.classList.remove(className), durationMs);
    }
  }

  function spawnDamagePopup(amount, type) {
    const div = document.createElement("div");
    div.className = `damage-pop ${type}`;
    let label = "";
    if (type === "crit") label = '<span class="damage-label">⚡ かいしんの いちげき！</span>';
    if (type === "ultimate") label = '<span class="damage-label">🌈 ひっさつわざ！！</span>';
    div.innerHTML = `${label}${amount}`;
    el.damagePopupContainer.innerHTML = "";
    el.damagePopupContainer.appendChild(div);
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 980);
  }

  function executeAttackSequence(dmg, type) {
    battle.locked = true;

    // 音＆相棒前進＆炎ブレス
    if (type === "ultimate") {
      sfx.ultimate();
      triggerAnim(el.thunderFlash, "active", 760);
    } else if (type === "crit") {
      sfx.criticalHit();
    } else {
      sfx.fireAttack();
    }

    triggerAnim(el.partnerActor, "lunge", 540);

    el.fireEffect.classList.remove("hidden", "shoot", "shoot-ultimate");
    void el.fireEffect.offsetWidth;
    el.fireEffect.classList.add(type === "ultimate" ? "shoot-ultimate" : "shoot");

    const hitDelay = type === "ultimate" ? 280 : 210;
    setTimeout(() => {
      if (!battle) return;
      battle.enemyHp = Math.max(0, battle.enemyHp - dmg);
      updateEnemyHpBar();
      spawnDamagePopup(dmg, type);

      triggerAnim(el.enemyActor, "enemy-hit", 500);
      if (type === "ultimate") {
        triggerAnim(el.battleField, "shake-big", 560);
      } else if (type === "crit") {
        triggerAnim(el.battleField, "shake-normal", 340);
      }
    }, hitDelay);

    const endDelay = type === "ultimate" ? 950 : 720;
    setTimeout(() => {
      if (!battle) return;
      el.fireEffect.classList.add("hidden");
      el.fireEffect.classList.remove("shoot", "shoot-ultimate");

      if (battle.enemyHp <= 0) {
        handleEnemyDefeated();
      } else {
        battle.locked = false;
        nextQuestion();
      }
    }, endDelay);
  }

  function handleEnemyDefeated() {
    sfx.enemyDefeat();
    el.enemyActor.classList.add("enemy-defeated");

    setTimeout(() => {
      if (!battle) return;
      if (battle.waveIndex + 1 < battle.waves.length) {
        battle.waveIndex++;
        setupCurrentWave();
        battle.locked = false;
        nextQuestion();
      } else {
        finishBattle(true);
      }
    }, 640);
  }

  function executeWrongSequence(a, b, correctVal) {
    battle.locked = true;
    sfx.wrong();

    battle.playerHp = Math.max(0, battle.playerHp - 1);
    renderPlayerHearts();

    triggerAnim(el.damageVignette, "active", 480);
    triggerAnim(el.partnerActor, "hit", 480);
    triggerAnim(el.battleField, "shake-normal", 340);

    el.wrongFormula.textContent = `${a} × ${b} ＝ ${correctVal} だよ！`;
    el.wrongOverlay.classList.remove("hidden");

    const proceed = () => {
      if (!battle) return;
      clearTimeout(battle.wrongAutoTimer);
      battle.wrongAutoTimer = null;
      el.wrongOverlay.classList.add("hidden");
      if (battle.playerHp <= 0) {
        finishBattle(false);
      } else {
        battle.locked = false;
        nextQuestion();
      }
    };

    el.btnWrongOk.onclick = proceed;
    clearTimeout(battle.wrongAutoTimer);
    battle.wrongAutoTimer = setTimeout(proceed, 3200);
  }

  /* =========================================================
     おたすけヒントモーダル（ドット配列＋足し算ヒント）
     ========================================================= */
  function openHelpModal() {
    if (!battle || battle.paused || battle.locked || battle.helpLeft <= 0) return;
    sfx.click();
    battle.helpLeft--;
    battle.paused = true;
    updateSpecialButtons();

    const { a, b } = battle.currentQ;
    el.helpFormulaBadge.textContent = `${a} × ${b}`;

    if (b === 1) {
      el.helpAdditionBox.textContent = `${a} が 1つぶん だから、そのまま ${a} だよ！`;
    } else {
      const prev = a * (b - 1);
      el.helpAdditionBox.textContent = `1つまえの「${a} × ${b - 1} ＝ ${prev}」に、${a} を たしてみよう！（${prev} ＋ ${a} ＝ ？）`;
    }

    el.helpDotsCaption.textContent = `● が ${a}こ ずつ、${b}れつ あるよ！`;
    el.helpDotsGrid.innerHTML = "";

    for (let row = 1; row <= b; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = `dot-row ${row === b && b > 1 ? "highlight-last" : ""}`;

      const lbl = document.createElement("span");
      lbl.className = "dot-row-label";
      lbl.textContent = `${row}れつ`;
      rowEl.appendChild(lbl);

      for (let col = 1; col <= a; col++) {
        const dot = document.createElement("span");
        dot.className = "dot-circle";
        rowEl.appendChild(dot);
      }
      el.helpDotsGrid.appendChild(rowEl);
    }

    el.helpModal.classList.remove("hidden");
  }

  function closeHelpModal() {
    sfx.click();
    el.helpModal.classList.add("hidden");
    if (battle) {
      battle.paused = false;
      battle.lastTickTime = performance.now();
    }
  }

  /* =========================================================
     バトル終了・経験値・進化処理
     ========================================================= */
  function finishBattle(victory) {
    stopCritLoop();
    battle.locked = true;

    const acc = battle.answeredCount > 0
      ? Math.round((battle.correctCount / battle.answeredCount) * 100)
      : 100;

    let gainedExp = victory ? 75 + battle.correctCount * 5 : 20 + battle.correctCount * 3;
    let gainedCoins = victory ? 35 + battle.correctCount * 3 : 10 + battle.correctCount;

    if (victory && battle.config.mode === "random") {
      gainedExp += 35;
      gainedCoins += 25;
    }

    if (victory && battle.config.mode === "dan") {
      if (!saveData.clearedDans.includes(battle.config.dan)) {
        saveData.clearedDans.push(battle.config.dan);
        gainedCoins += 20;
      }
    }

    const prevEvo = getEvolution(saveData.level);
    const prevLv = saveData.level;

    saveData.exp += gainedExp;
    saveData.coins += gainedCoins;

    while (saveData.exp >= getExpNeeded(saveData.level)) {
      saveData.exp -= getExpNeeded(saveData.level);
      saveData.level++;
    }

    const newEvo = getEvolution(saveData.level);
    const leveledUp = saveData.level > prevLv;
    const evolved = newEvo.stage > prevEvo.stage;

    persistSave();

    // リザルト表示
    if (victory) {
      el.resultTitle.textContent = "🎉 ステージ クリア！";
      if (evolved) {
        sfx.evolveFanfare();
      } else {
        sfx.fanfare();
      }
    } else {
      el.resultTitle.textContent = "💪 つぎは かてるよ！";
      sfx.wrong();
    }

    el.resultExp.textContent = `+${gainedExp} EXP`;
    el.resultCoins.textContent = `+${gainedCoins} 🪙`;
    el.resultAcc.textContent = `${acc}%`;

    if (evolved) {
      el.resultEvoBanner.classList.remove("hidden");
      el.resultEvoImg.src = newEvo.img;
      el.resultEvoText.textContent = `「${newEvo.name}」に しんかしたよ！`;
    } else {
      el.resultEvoBanner.classList.add("hidden");
    }

    if (leveledUp) {
      el.resultLevelupNote.classList.remove("hidden");
      el.resultLevelupNote.textContent = `⭐ Lv.${prevLv} → Lv.${saveData.level} に レベルアップ！`;
    } else {
      el.resultLevelupNote.classList.add("hidden");
    }

    el.resultModal.classList.remove("hidden");
  }

  function returnToHome() {
    stopCritLoop();
    if (battle && battle.wrongAutoTimer) {
      clearTimeout(battle.wrongAutoTimer);
    }
    battle = null;
    el.pauseModal.classList.add("hidden");
    el.resultModal.classList.add("hidden");
    el.helpModal.classList.add("hidden");
    el.wrongOverlay.classList.add("hidden");
    el.battleScreen.classList.remove("active");
    el.homeScreen.classList.add("active");
    renderHome();
  }

  /* =========================================================
     イベントリスナー登録
     ========================================================= */
  el.btnSoundHome.addEventListener("click", toggleSound);
  el.btnSoundBattle.addEventListener("click", toggleSound);

  el.btnOpenShop.addEventListener("click", openShop);
  el.btnCloseShop.addEventListener("click", () => {
    sfx.click();
    el.shopModal.classList.add("hidden");
  });

  el.homePartnerStage.addEventListener("click", () => {
    sfx.coin();
    triggerAnim(el.homePartnerStage, "happy", 460);
    const line = PARTNER_LINES[Math.floor(Math.random() * PARTNER_LINES.length)];
    el.partnerSpeech.textContent = line;
  });

  el.btnStageRandom.addEventListener("click", () => {
    sfx.click();
    startBattle({ mode: "random" });
  });

  el.btnStageRevenge.addEventListener("click", () => {
    sfx.click();
    startBattle({ mode: "revenge" });
  });

  el.numBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      handleDigitInput(btn.dataset.digit);
    });
  });

  el.btnClear.addEventListener("click", handleClearInput);
  el.btnAttack.addEventListener("click", submitAnswer);
  el.btnHelp.addEventListener("click", openHelpModal);
  el.btnCloseHelp.addEventListener("click", closeHelpModal);
  el.btnSpecial.addEventListener("click", triggerUltimate);

  el.btnPause.addEventListener("click", () => {
    if (!battle) return;
    sfx.click();
    battle.paused = true;
    el.pauseModal.classList.remove("hidden");
  });

  el.btnResume.addEventListener("click", () => {
    sfx.click();
    el.pauseModal.classList.add("hidden");
    if (battle) {
      battle.paused = false;
      battle.lastTickTime = performance.now();
    }
  });

  el.btnQuitBattle.addEventListener("click", () => {
    sfx.click();
    returnToHome();
  });

  el.btnResultRetry.addEventListener("click", () => {
    sfx.click();
    const prevConfig = battle ? battle.config : { mode: "dan", dan: 1 };
    el.resultModal.classList.add("hidden");
    startBattle(prevConfig);
  });

  el.btnResultHome.addEventListener("click", () => {
    sfx.click();
    returnToHome();
  });

  // キーボード操作サポート（PC・外付けキーボードでも快適）
  window.addEventListener("keydown", (e) => {
    if (!battle || battle.paused || battle.locked) return;
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      handleDigitInput(e.key);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      handleClearInput();
    } else if (e.key === "Enter") {
      e.preventDefault();
      submitAnswer();
    }
  });

  // 初期描画
  renderHome();
})();
