/* ===================== DATA ===================== */
const LEVELS = [
  // Each level now focuses on one times-table from 1x1..1x10 to 10x1..10x10.
  { name:'×1',  friendly:'Ones',    color:'#f59e0b', tables:[1],  hint:'1s across the table' },
  { name:'×2',  friendly:'Twos',    color:'#10b981', tables:[2],  hint:'2s from 1 to 10' },
  { name:'×3',  friendly:'Threes',  color:'#3b82f6', tables:[3],  hint:'3s from 1 to 10' },
  { name:'×4',  friendly:'Fours',   color:'#ec4899', tables:[4],  hint:'4s from 1 to 10' },
  { name:'×5',  friendly:'Fives',   color:'#8b5cf6', tables:[5],  hint:'5s from 1 to 10' },
  { name:'×6',  friendly:'Sixes',   color:'#f97316', tables:[6],  hint:'6s from 1 to 10' },
  { name:'×7',  friendly:'Sevens',  color:'#06b6d4', tables:[7],  hint:'7s from 1 to 10' },
  { name:'×8',  friendly:'Eights',  color:'#ef4444', tables:[8],  hint:'8s from 1 to 10' },
  { name:'×9',  friendly:'Nines',   color:'#14b8a6', tables:[9],  hint:'9s from 1 to 10' },
  { name:'×10', friendly:'Tens',    color:'#a855f7', tables:[10], hint:'10s from 1 to 10' },
];
let fastMode = false;
let masteryFilter = 'all';
const APP_SCREEN = {
  HOME: 'home',
  GAME: 'game',
  RESULTS: 'results',
  STATS: 'stats',
};
const QUESTION_TIMER_TICK_MS = 250;
const DATA_SAVE_DEBOUNCE_MS = 600;
const MAX_ANSWER_LOG_ROWS = 30;
const EFFECTS_CONFIG = {
  confettiPieces: 24,
  miniBurstPieces: 8,
  starDropSpacingMs: 280,
};
const REQUIRED_APP_IDS = [
  'app',
  'screen-home',
  'screen-game',
  'screen-results',
  'screen-stats',
  'level-grid',
  'answer-input',
  'answer-row',
  'choice-row',
  'submit-btn',
  'question-display',
  'question-card',
  'confirm-overlay',
  'confirm-accept-btn',
  'confirm-cancel-btn',
  'mode-toggle',
  'theme-btn',
  'fast-mode-btn',
  'home-stats-btn',
  'home-reset-btn',
  'game-quit-btn',
  'results-home-btn',
  'btn-next-level',
  'retry-level-btn',
  'stats-back-btn',
];

const STORAGE_KEYS = {
  data: 'mm_data',
  mode: 'mm_mode',
  fastMode: 'mm_fast_mode',
  theme: 'mm_theme',
};
const ANSWER_MODES = {
  TYPE: 'type',
  CHOICE: 'choice',
};
let answerMode = ANSWER_MODES.TYPE; // 'type' | 'choice'
const inMemoryStorage = new Map();
const uiCache = new Map();
let dataSaveTimer = null;
let pendingData = null;
let storageAvailable = true;

function isStorageAvailable() {
  if (!storageAvailable) return false;
  try {
    const probe = '__mm_storage_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch (e) {
    storageAvailable = false;
    return false;
  }
}

function getStorageValue(key) {
  if (!key) return null;
  if (isStorageAvailable()) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      storageAvailable = false;
    }
  }
  return inMemoryStorage.get(key) ?? null;
}

function setStorageValue(key, value) {
  if (!key) return;
  if (isStorageAvailable()) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch (e) {
      storageAvailable = false;
    }
  }
  inMemoryStorage.set(key, value);
}

function removeStorageValue(key) {
  if (!key) return;
  if (isStorageAvailable()) {
    try {
      localStorage.removeItem(key);
      return;
    } catch (e) {
      storageAvailable = false;
    }
  }
  inMemoryStorage.delete(key);
}

function getStorageBool(key) {
  return getStorageValue(key) === '1';
}
const FACT_MIN = 1;
const FACT_MAX = 10;
const MAX_LIVES = 3;
const FACT_CACHE = (() => {
  const pairs = [];
  for (let a = FACT_MIN; a <= FACT_MAX; a++) {
    for (let b = FACT_MIN; b <= FACT_MAX; b++) {
      const key = `${a}x${b}`;
      pairs.push(key);
    }
  }
  return { pairs };
})();
const TOTAL_FACT_KEYS = FACT_CACHE.pairs;
const UI_ICON = {
  coin: '🪙',
  fire: '🔥',
  star: '🌟',
  check: '✅',
  wrong: '❌',
  trophy: '🏆',
  spark: '✨',
  timer: '⏱',
  heart: '❤️',
  heartEmpty: '🤍',
  arrow: '➡',
  lock: '🔒'
};
const LEVEL_QUESTION_SETS = LEVELS.map((lvl) => {
  if (!lvl || !Array.isArray(lvl.tables)) return [];
  const pool = [];
  lvl.tables.forEach((table) => {
    for (let b = FACT_MIN; b <= FACT_MAX; b++) {
      pool.push([table, b]);
    }
  });
  return pool;
});
/* ===================== STATE ===================== */
let gameState = {
  currentLevel: 0,
  questions: [],
  qIndex: 0,
  totalQuestions: 0,
  results: [],
  streak: 0,
  maxStreak: 0,
  questionStart: 0,
  timerInterval: null,
  activeQuestion: 0,
  fastModeUsed: false,
  isQuestionLocked: false,
  masteredFactKeys: new Set(),
  currentA: 0,
  currentB: 0,
  lives: MAX_LIVES,
  maxLives: MAX_LIVES,
  screen: APP_SCREEN.HOME,
  isActiveSession: false,
  timerLastText: null,
};
let confirmReturnFocus = null;
let cachedChoiceButtons = null;
let cachedScreens = null;
let activeScreenNode = null;
let appDataCache = null;

// ===================== HELPERS =====================
// Small DOM convenience wrappers used by most screen flows.
function el(id) {
  if (uiCache.has(id)) return uiCache.get(id);
  const node = document.getElementById(id);
  uiCache.set(id, node);
  return node;
}

function setText(nodeOrId, value) {
  const node = typeof nodeOrId === 'string' ? el(nodeOrId) : nodeOrId;
  if (!node) return;
  node.textContent = value;
}

function replaceChildrenWithFragment(target, nodes) {
  if (!target) return;
  const fragment = document.createDocumentFragment();
  nodes.forEach((node) => {
    if (node) fragment.appendChild(node);
  });
  target.replaceChildren(fragment);
}

function formatCoins(value) {
  return `${UI_ICON.coin} ${coerceNumber(value, 0)}`;
}

// Fetches the current answer field used by both typing and choice workflows.
function getAnswerInput() {
  return el('answer-input');
}

// Computes digit count for the expected answer so input length can expand dynamically.
function getCurrentAnswerLength() {
  return String(gameState.currentA * gameState.currentB).length || 1;
}

// Loads persisted fast-mode preference into runtime state.
function syncFastModeFromStorage() {
  fastMode = getStorageBool(STORAGE_KEYS.fastMode);
}

// Returns true only while the user is actively playing in the game screen.
function isActiveGameplayInput() {
  return gameState.isActiveSession && gameState.screen === APP_SCREEN.GAME;
}
function isTypeAnswerMode() {
  return answerMode === ANSWER_MODES.TYPE;
}
function isChoiceAnswerMode() {
  return answerMode === ANSWER_MODES.CHOICE;
}
function getModeButtonLabel() {
  return isTypeAnswerMode() ? '⌨️ Type' : '📌 Pick';
}
function getChoiceButtons() {
  if (cachedChoiceButtons === null) {
    cachedChoiceButtons = Array.from(document.querySelectorAll('.choice-btn'));
  }
  return cachedChoiceButtons;
}
function getCachedScreens() {
  if (cachedScreens === null) {
    cachedScreens = Array.from(document.querySelectorAll('.screen'));
  }
  return cachedScreens;
}

/* ===================== STORAGE ===================== */
const LEVEL_COUNT = LEVELS.length;
const UNLOCK_DEFAULTS = [true, ...Array(Math.max(0, LEVEL_COUNT - 1)).fill(false)];

function coerceNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function coerceBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeBooleanArray(value, fallback) {
  const out = Array.isArray(value) ? value.slice(0, fallback.length) : [];
  return Array.from({ length: fallback.length }, (_, i) => coerceBoolean(out[i], fallback[i]));
}

function normalizeLevelStat(stat) {
  return {
    attempts: coerceNumber(stat?.attempts, 0),
    correct: coerceNumber(stat?.correct, 0),
    totalTime: coerceNumber(stat?.totalTime, 0),
    bestTime: (typeof stat?.bestTime === 'number' && Number.isFinite(stat.bestTime)) ? stat.bestTime : Infinity,
    bestAccuracy: coerceNumber(stat?.bestAccuracy, 0)
  };
}

function normalizeFactStat(stat) {
  return {
    attempts: coerceNumber(stat?.attempts, 0),
    correct: coerceNumber(stat?.correct, 0)
  };
}

function loadData() {
  const raw = getStorageValue(STORAGE_KEYS.data);
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
function createDefaultData() {
  const factStats = {};
  for (let i = 0; i < TOTAL_FACT_KEYS.length; i++) {
    factStats[TOTAL_FACT_KEYS[i]] = { attempts: 0, correct: 0 };
  }
  return {
    unlocked: [...UNLOCK_DEFAULTS],
    levelStats: Array.from({ length: LEVEL_COUNT }, () => normalizeLevelStat()),
    factStats,
    coins: 0,
  };
}
function hydrateData(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const d = createDefaultData();
  d.coins = coerceNumber(src.coins, 0);
  if (d.coins < 0) d.coins = 0;
  d.unlocked = normalizeBooleanArray(src.unlocked, UNLOCK_DEFAULTS);
  // Enforce strict in-order progression: a level can only be open if the previous one is open.
  for (let i = 1; i < d.unlocked.length; i++) {
    if (!d.unlocked[i - 1]) d.unlocked[i] = false;
  }
  if (Array.isArray(src.levelStats)) {
    src.levelStats.forEach((stat, i) => {
      if (i < LEVEL_COUNT && stat) {
        d.levelStats[i] = normalizeLevelStat(stat);
      }
    });
  }
  if (src.factStats && typeof src.factStats === 'object') {
    TOTAL_FACT_KEYS.forEach((key) => {
      d.factStats[key] = normalizeFactStat(src.factStats[key]);
    });
  }
  return d;
}
function saveData(d) {
  setStorageValue(STORAGE_KEYS.data, JSON.stringify(d));
}
function queueSaveData(d) {
  appDataCache = d;
  pendingData = d;
  if (dataSaveTimer) {
    clearTimeout(dataSaveTimer);
  }
  dataSaveTimer = setTimeout(() => {
    saveData(appDataCache || pendingData);
    pendingData = null;
    dataSaveTimer = null;
  }, DATA_SAVE_DEBOUNCE_MS);
}
function flushQueuedSave() {
  if (!dataSaveTimer) return;
  clearTimeout(dataSaveTimer);
  dataSaveTimer = null;
  if (pendingData) {
    saveData(appDataCache || pendingData);
    pendingData = null;
  }
}
function getData() {
  if (appDataCache) return appDataCache;
  appDataCache = hydrateData(loadData());
  return appDataCache;
}

function resetAll() {
  removeStorageValue(STORAGE_KEYS.data);
  removeStorageValue(STORAGE_KEYS.mode);
  removeStorageValue(STORAGE_KEYS.fastMode);
  removeStorageValue(STORAGE_KEYS.theme);
  if (dataSaveTimer) {
    clearTimeout(dataSaveTimer);
    dataSaveTimer = null;
  }
  pendingData = null;
  appDataCache = createDefaultData();
  answerMode = ANSWER_MODES.TYPE;
  fastMode = false;
  document.body.classList.remove('light');
  renderHome();
  updateModeText();
  updateFastModeButton();
}

function toggleMode() {
  answerMode = isTypeAnswerMode() ? ANSWER_MODES.CHOICE : ANSWER_MODES.TYPE;
  const btn = el('mode-toggle');
  if (btn) btn.textContent = getModeButtonLabel();
  setStorageValue(STORAGE_KEYS.mode, answerMode);
  if (isActiveGameplayInput()) {
    syncGameAnswerMode();
    const firstChoice = getChoiceButtons()[0];
    if (isTypeAnswerMode()) {
      focusAnswerInput();
    } else if (firstChoice) {
      firstChoice.focus();
    }
  }
}

function toggleFastMode() {
  // Persisted per user preference; stays in sync across levels and sessions.
  fastMode = !fastMode;
  setStorageValue(STORAGE_KEYS.fastMode, fastMode ? '1' : '0');
  updateFastModeButton();
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  const btn = el('theme-btn');
  if (btn) btn.textContent = isLight ? '🌙 Dark' : '☀️ Bright';
  setStorageValue(STORAGE_KEYS.theme, isLight ? 'light' : 'dark');
}

// Reset this on each new question so fast mode applies once per question.
function resetFastModeForQuestion() {
  gameState.fastModeUsed = false;
}

// Exact number of digits in the current answer (1 for 6, 2 for 10/25/40, etc).
function expectedAnswerLength() {
  return getCurrentAnswerLength();
}

// Build the full learning set for a level so every one of its multiples is asked.
function getLevelQuestionSet(levelIdx) {
  return LEVEL_QUESTION_SETS[levelIdx] || [];
}

function makeFactKey(a, b) {
  return `${a}x${b}`;
}

/* ===================== RENDER HOME ===================== */
function renderHome() {
  const d = getData();
  const grid = el('level-grid');
  const rows = [];
  const nextUnlockIdx = getNextTargetLevelIndex(d);

  LEVELS.forEach((lvl,i) => {
    const unlocked = d.unlocked[i];
    const ls = d.levelStats[i];
    const acc = ls.attempts > 0 ? Math.round(ls.correct/ls.attempts*100) : 0;
    const stars = acc >= 93 ? '⭐⭐⭐' : acc >= 80 ? '⭐⭐' : acc > 0 ? '⭐' : '';
    const progress = getLevelFactProgress(i);
    const mastered = progress.mastered || 0;
    const totalFacts = progress.total || 0;
    const pct = getPercentValue(mastered, totalFacts);
    const statusLine = !unlocked ? 'Locked' : mastered >= totalFacts ? 'Mastered' : `${mastered}/${totalFacts} facts`;
    const hintLine = unlocked ? `${lvl.hint || 'Practice 1-10 × ' + lvl.tables[0]}` : '';
    const btn = document.createElement('button');
    btn.type = 'button';
    const isNextUnlock = i === nextUnlockIdx && !unlocked;
    btn.className = 'level-btn ' + (unlocked ? 'unlocked' : 'locked') + (isNextUnlock ? ' next-target' : '');
    btn.style.cssText = unlocked
      ? `background:linear-gradient(135deg,${lvl.color}22,${lvl.color}44);border-color:${lvl.color}55;color:${lvl.color}`
      : '';
    if(unlocked) {
      btn.innerHTML = `
        <div class="lvl-badge">
          <div class="lvl-num">${i+1}</div>
          <div class="lvl-mini">${statusLine}</div>
        </div>
        <div class="lvl-name">${lvl.friendly}</div>
        <div class="lvl-sub">${lvl.name}</div>
        <div class="lvl-hint">${hintLine}</div>
        <div class="lvl-progress-wrap">
          <div class="lvl-progress-track">
            <div class="lvl-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="lvl-progress-meta">${pct}%</div>
        </div>
        <div class="lvl-stars">${stars}</div>
      `;
      btn.dataset.levelIndex = String(i);
    } else {
      btn.disabled = true;
      btn.setAttribute('aria-label', `Locked level ${i + 1}`);
      btn.innerHTML = `<div class="lvl-num" style="opacity:.3">${i+1}</div><div class="lvl-name" style="margin-top:8px">Locked</div>`;
    }
    rows.push(btn);
  });
  replaceChildrenWithFragment(grid, rows);

  const homeCoins = el('home-coins');
  setText(homeCoins, `${formatCoins(d.coins)} coins`);
  const themeBtn = el('theme-btn');
  if (themeBtn) themeBtn.textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Bright';
}

function focusAnswerInput() {
  const input = getAnswerInput();
  if (!input) return;
  if (document.activeElement !== input) input.focus();
}

function syncGameAnswerMode() {
  const isChoice = isChoiceAnswerMode();
  const answerRow = el('answer-row');
  const choiceRow = el('choice-row');
  const submitBtn = el('submit-btn');
  if (answerRow) answerRow.style.display = isChoice ? 'none' : '';
  if (choiceRow) choiceRow.style.display = isChoice ? '' : 'none';
  if (submitBtn) submitBtn.style.display = isChoice ? 'none' : '';

  if (!isChoice || !gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME) return;

  const correct = gameState.currentA * gameState.currentB;
  const choices = generateChoices(correct);
  const btns = getChoiceButtons();
  btns.forEach((btn, i) => {
    btn.textContent = choices[i];
    btn.className = 'choice-btn';
    btn.dataset.val = choices[i];
  });
  setChoiceButtonsEnabled(true);
}

function setChoiceButtonsEnabled(enabled) {
  getChoiceButtons().forEach((btn) => {
    btn.disabled = !enabled;
  });
}

/* ===================== GENERATE QUESTIONS ===================== */
function generateQuestions(levelIdx) {
  return shuffleArray(getLevelQuestionSet(levelIdx));
}

function generateChoices(correct) {
  const opts = new Set([correct]);
  const offsets = shuffleArray([-2,-1,1,2,3,-3,4,-4,5,-5]);
  for (const o of offsets) {
    if (opts.size >= 4) break;
    const v = correct + o;
    if (v > 0 && v !== correct) opts.add(v);
  }
  return shuffleArray([...opts]);
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function beginGameSession(levelIdx) {
  // Start of a fresh gameplay run: clear timers/state and initialize question data.
  gameState.activeQuestion++;
  clearQuestionTimer();
  syncFastModeFromStorage();
  updateFastModeButton();
  gameState.currentLevel = levelIdx;
  gameState.questions = generateQuestions(levelIdx);
  gameState.totalQuestions = gameState.questions.length;
  gameState.qIndex = 0;
  gameState.results = [];
  gameState.masteredFactKeys = new Set();
  gameState.streak = 0;
  gameState.maxStreak = 0;
  resetFastModeForQuestion();
  gameState.isQuestionLocked = false;
  gameState.lives = MAX_LIVES;
  gameState.maxLives = MAX_LIVES;
  gameState.isActiveSession = true;
  gameState.screen = APP_SCREEN.GAME;
}

function endGameSession() {
  flushQueuedSave();
  gameState.activeQuestion++;
  gameState.isActiveSession = false;
  clearQuestionTimer();
}

/* ===================== START LEVEL ===================== */
function startLevel(idx) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= LEVEL_COUNT) return;
  const d = getData();
  if (!d.unlocked[idx]) return;
  // Build session state, switch to game UI, and render the first math challenge.
  beginGameSession(idx);

  setText('game-level-badge', `Level ${idx+1} — ${LEVELS[idx].name}`);
  showScreen(APP_SCREEN.GAME);
  loadQuestion();
  setText('coin-badge', formatCoins(d.coins));
}

function loadQuestion() {
  if (!gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME) return;
  // Guard against stale async events by pinning updates to this question session.
  const questionSession = ++gameState.activeQuestion;
  clearQuestionTimer();
  const qa = gameState.questions[gameState.qIndex];
  if (!Array.isArray(qa) || qa.length < 2) {
    showResults();
    return;
  }
  const [a,b] = qa;
  gameState.currentA = a;
  gameState.currentB = b;
  gameState.isQuestionLocked = false;
  resetFastModeForQuestion();
  const answerLen = expectedAnswerLength();
  gameState.questionStart = Date.now();
  gameState.timerLastText = null;

  el('question-display').textContent = `${a} × ${b} = ?`;
  el('feedback-row').innerHTML = '';
  // Keep UI for this question reset and focused before rendering choices/timer.
  const answerInput = getAnswerInput();
  answerInput.value = '';
  answerInput.maxLength = answerLen;
  answerInput.className = 'answer-input';
  answerInput.focus();

  renderGameHUD();
  syncGameAnswerMode();

  startQuestionTimer(questionSession);
}

function getLevelProgressLabel(levelIdx) {
  const level = LEVELS[levelIdx];
  if (!level || !Array.isArray(level.tables) || level.tables.length === 0) return '';
  const unique = Array.from(new Set(level.tables)).sort((a, b) => a - b);
  if (unique.length === 1) {
    const t = unique[0];
    return `${t}×${FACT_MIN}-${FACT_MAX}`;
  }
  return unique.map(t => `${t}×${FACT_MIN}-${FACT_MAX}`).join(', ');
}

function getPercentValue(done, total) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function updateProgress() {
  const total = Math.max(1, gameState.totalQuestions);
  const done = Math.min(gameState.masteredFactKeys.size, total);
  const pct = getPercentValue(done, total);
  const levelText = getLevelProgressLabel(gameState.currentLevel);
  el('progress-bar').style.width = pct+'%';
  el('progress-text').textContent = `${done}/${total} mastered ${levelText ? `(${levelText})` : ''}`;
  el('streak-badge').textContent = `${UI_ICON.fire} ${gameState.streak}`;
  const qCount = el('question-count');
  if (qCount) qCount.textContent = `Fact ${Math.min(gameState.qIndex + 1, total)}/${total}`;
}

function updateLives() {
  const icons = UI_ICON.heart.repeat(gameState.lives) + UI_ICON.heartEmpty.repeat(gameState.maxLives - gameState.lives);
  el('lives-display').textContent = icons;
}

function renderGameHUD() {
  updateLives();
  updateProgress();
}

function clearQuestionTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  gameState.timerLastText = null;
}

function startQuestionTimer(questionSession) {
  clearQuestionTimer();
  gameState.timerInterval = setInterval(() => {
    if (!gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME || gameState.activeQuestion !== questionSession) {
      clearQuestionTimer();
      return;
    }
    const elapsed = ((Date.now() - gameState.questionStart)/1000).toFixed(1);
    if (gameState.timerLastText === elapsed) return;
    gameState.timerLastText = elapsed;
    setText('timer-display', `${UI_ICON.timer} ${elapsed}s`);
  }, QUESTION_TIMER_TICK_MS);
}

function awardCoins(n) {
  const d = getData();
  d.coins = (d.coins || 0) + n;
  queueSaveData(d);
  setText('coin-badge', formatCoins(d.coins));
}

function submitChoice(btn) {
  if (!gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME) return;
  // Reuse the same grading path as typing by injecting the selected value before submit.
  el('answer-input').value = btn.dataset.val;
  setChoiceButtonsEnabled(false);
  submitAnswer();
}

/* ===================== SUBMIT ===================== */
function submitAnswer() {
  if (!gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME) return;
  if (gameState.isQuestionLocked) return;
  const input = el('answer-input');
  const raw = input.value.trim();

  // Require a valid numeric string and convert once with Number() for single/double-digit answers.
  if (!isNumericInput(raw)) return;
  const val = Number(raw);
  gameState.isQuestionLocked = true;

  clearQuestionTimer();
  const questionSession = gameState.activeQuestion;
  const elapsed = (Date.now() - gameState.questionStart);
  const a = gameState.currentA, b = gameState.currentB;
  const correct = a * b;
  const isCorrect = val === correct;
  const key = makeFactKey(a, b);

  // Update fact stats
  const d = getData();
  d.factStats[key].attempts++;
  if(isCorrect) d.factStats[key].correct++;
  queueSaveData(d);

  // Record result
  gameState.results.push({ a, b, answer: val, correct: isCorrect, time: elapsed });

  // UI feedback
  const fb = el('feedback-row');
  if(isCorrect) {
    gameState.streak++;
    gameState.maxStreak = Math.max(gameState.maxStreak, gameState.streak);
    input.className = 'answer-input correct-flash';
    fb.innerHTML = `<span class="feedback-correct">✅ Correct! ${correct} 🎉</span>`;
    if(gameState.streak > 1) fb.innerHTML += ` <span style="color:var(--accent1);font-size:.9rem">🔥 Streak ${gameState.streak}!</span>`;
    if (gameState.streak >= 5) {
      animateMascot('dance');
    } else {
      animateMascot('happy');
    }
    const milestones = {
      3: 'ON FIRE! 🔥',
      5: 'UNSTOPPABLE! 😄',
      10: 'MATH WIZARD! 🧠'
    };
    if (milestones[gameState.streak]) showMilestone(milestones[gameState.streak]);
    miniBurst();
    // Award coins based on streak
    if (gameState.streak >= 5) {
      awardCoins(3);
    } else if (gameState.streak >= 3) {
      awardCoins(2);
    } else {
      awardCoins(1);
    }
    gameState.masteredFactKeys.add(key);
  } else {
    gameState.streak = 0;
    gameState.lives = Math.max(0, gameState.lives - 1);
    updateLives();
    animateMascot('sad');
    el('wrong-eq').textContent = `${a} × ${b} = ${correct}`;
    const wo = el('wrong-overlay');
    wo.style.display = 'flex';
    setTimeout(() => { wo.style.display = 'none'; }, 1300);
    input.className = 'answer-input shake';
    fb.innerHTML = `<span class="feedback-wrong">❌ Answer: ${a} × ${b} = ${correct}</span>`;
    if (gameState.lives <= 0) {
      setTimeout(() => showResults(), 1400);
      return;
    }
    gameState.isQuestionLocked = false;
    input.value = '';
    input.focus();
    gameState.questionStart = Date.now();
    startQuestionTimer(questionSession);
  }
  el('streak-badge').textContent = `${UI_ICON.fire} ${gameState.streak}`;

  // Next question after short delay
  setTimeout(() => {
    if (gameState.activeQuestion !== questionSession) return;
    if (!isCorrect) return;
    gameState.qIndex++;
    if(gameState.qIndex >= gameState.totalQuestions) {
      showResults();
    } else {
      loadQuestion();
    }
  }, isCorrect ? 700 : 1400);
}

/* ===================== RESULTS ===================== */
function showResults() {
  if (!gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME) return;
  endGameSession();
  const res = gameState.results;
  const total = Math.max(1, gameState.totalQuestions);
  const learnedCount = gameState.masteredFactKeys.size;
  const lvl = gameState.currentLevel;
  const correct = res.filter(r=>r.correct).length;
  const accuracy = Math.round((correct / Math.max(1, res.length)) * 100);
  const times = res.filter(r=>r.correct).map(r=>r.time);
  const fullyCompleted = learnedCount >= total;
  const avgTime = times.length ? (times.reduce((a,b)=>a+b,0)/times.length/1000).toFixed(1) : '—';
  const passed = fullyCompleted;

  // Stars
  const starCount = accuracy >= 93 ? 3 : accuracy >= 80 ? 2 : accuracy >= 60 ? 1 : 0;

  // Save level stats
  const d = getData();
  d.levelStats[lvl].attempts += res.length;
  d.levelStats[lvl].correct += correct;
  d.levelStats[lvl].totalTime += times.reduce((a,b)=>a+b,0);
  if(times.length) d.levelStats[lvl].bestTime = Math.min(d.levelStats[lvl].bestTime, Math.min(...times)/1000);
  d.levelStats[lvl].bestAccuracy = Math.max(d.levelStats[lvl].bestAccuracy, accuracy);

  // Unlock next
  if(passed && lvl < LEVEL_COUNT - 1) d.unlocked[lvl+1] = true;
  queueSaveData(d);

  // Render
  const starEl = el('results-stars');
  starEl.textContent = '';
  showScreen(APP_SCREEN.RESULTS);

  let displayed = '';
  for (let i = 0; i < starCount; i++) {
    setTimeout(() => {
      displayed += UI_ICON.star;
      starEl.textContent = displayed;
      starEl.style.animation = 'none';
      void starEl.offsetWidth;
      starEl.style.animation = 'star-drop .4s cubic-bezier(.34,1.56,.64,1)';
    }, 300 + i * EFFECTS_CONFIG.starDropSpacingMs);
  }
  if (starCount === 0) setTimeout(() => { starEl.textContent = UI_ICON.spark; }, 300);

  let title, sub;
  if(accuracy === 100) { title='Perfect Score! 🏆'; }
  else if(accuracy >= 93) { title='Amazing! 🎉'; }
  else if(accuracy >= 80) { title='Great Job! 👏'; }
  else if(passed) { title='Good Try! 🧩'; }
  else { title='Keep Practicing! 🚀'; }
  sub = passed
    ? `Level ${lvl+1} complete! ${lvl < LEVEL_COUNT - 1 ? 'Level ' + (lvl+2) + ' unlocked! 🔒' : ''}`
    : `${learnedCount}/${total} facts mastered — solve every ${LEVELS[lvl].name} fact to unlock the next level 🧩`;

  el('results-title').textContent = title;
  el('results-sub').textContent = sub;
  el('r-accuracy').textContent = accuracy+'%';
  el('r-avg-time').textContent = avgTime+'s';
  el('r-streak').textContent = gameState.maxStreak + ' ' + UI_ICON.fire;

  // Answer log
  const log = el('answer-log');
  const rows = [];
  const recent = res.slice(-MAX_ANSWER_LOG_ROWS);
  recent.forEach((r) => {
    const ans = r.correct ? r.a * r.b : `${r.answer} ${UI_ICON.wrong}`;
    const icon = r.correct ? UI_ICON.check : UI_ICON.wrong;
    const spd = (r.time / 1000).toFixed(1) + 's';
    const row = document.createElement('div');
    const valueStyle = r.correct ? 'var(--correct)' : 'var(--wrong)';
    row.className = 'answer-log-row';
    row.innerHTML = `
      <span class="q">${r.a} × ${r.b}</span>
      <span style="flex:1;text-align:center;font-weight:700;color:${valueStyle}">${ans}</span>
      <span class="status">${icon}</span>
      <span class="spd">${spd}</span>
    `;
    rows.push(row);
  });
  replaceChildrenWithFragment(log, rows);

  // Next level btn
  const btnNext = el('btn-next-level');
    if(passed && lvl < LEVEL_COUNT - 1) {
      btnNext.style.display = ''; btnNext.textContent = `Level ${lvl+2} ${UI_ICON.arrow}`;
  } else {
    btnNext.style.display = 'none';
  }

  if(accuracy >= 93) launchConfetti();
}

function nextLevel() { startLevel(gameState.currentLevel + 1); }
function retryLevel() { startLevel(gameState.currentLevel); }
function goHome() {
  endGameSession();
  showScreen(APP_SCREEN.HOME);
  renderHome();
}
function confirmQuit() {
  showConfirmDialog({
    title: 'Quit this round?',
    text: 'Want to leave now? Your progress is saved and your streak will continue when you return.',
    acceptText: 'Quit Round',
    cancelText: 'Keep Playing',
    onAccept: confirmQuitAction,
  });
}
function confirmQuitAction() {
  hideConfirmOverlay();
  goHome();
}
function showResetConfirm() {
  showConfirmDialog({
    title: 'Reset all progress?',
    text: 'This clears all level unlocks, streak history, and coins. This action cannot be undone.',
    acceptText: 'Reset',
    cancelText: 'Cancel',
    onAccept: confirmResetAll,
  });
}
function confirmResetAll() {
  hideConfirmOverlay();
  resetAll();
}
function hideConfirmOverlay() {
  el('confirm-overlay').style.display = 'none';
  el('confirm-overlay').setAttribute('aria-hidden', 'true');
  if (confirmReturnFocus && typeof confirmReturnFocus.focus === 'function') {
    confirmReturnFocus.focus();
  }
  confirmReturnFocus = null;
}

/* ===================== STATS ===================== */
function showStats() {
  const d = getData();
  renderStatsOverview(d);
  renderMasteryGrid(d);
  renderLevelPerf(d);
  renderWeakFacts(d);
  setMasteryFilter(masteryFilter, false);
  showScreen(APP_SCREEN.STATS);
}

function renderStatsOverview(d) {
  let totalAttempts = 0;
  let totalCorrect = 0;
  let learnedFacts = 0;
  let strongFacts = 0;
  const totalFacts = (FACT_MAX - FACT_MIN + 1) ** 2;

  for (let a = FACT_MIN; a <= FACT_MAX; a++) {
    for (let b = FACT_MIN; b <= FACT_MAX; b++) {
      const fs = d.factStats[makeFactKey(a, b)] || { attempts: 0, correct: 0 };
      const attempts = coerceNumber(fs.attempts, 0);
      const correct = coerceNumber(fs.correct, 0);
      totalAttempts += attempts;
      totalCorrect += correct;
      if (correct > 0) learnedFacts++;
      if (attempts > 0 && correct / attempts >= 0.85) strongFacts++;
    }
  }
  const unlockedCount = Array.isArray(d.unlocked) ? d.unlocked.filter(Boolean).length : 1;
  const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const learnedRate = Math.round((learnedFacts / totalFacts) * 100);

  el('stats-total-attempts').textContent = `${totalAttempts}`;
  el('stats-total-correct').textContent = `${totalCorrect}`;
  el('stats-accuracy').textContent = `${overallAccuracy}%`;
  el('stats-quick-metric').textContent = `${learnedFacts}/${totalFacts}`;
  el('stats-level-unlocked').textContent = `${unlockedCount}/${LEVEL_COUNT}`;
  setText('stats-coins', formatCoins(d.coins));
  el('stats-learned-pct').textContent = `${learnedRate}%`;
  el('stats-strong-facts').textContent = `${strongFacts}`;
}

function setMasteryFilter(filter, updateGrid = true) {
  masteryFilter = filter || 'all';
  ['all', 'weak', 'untried'].forEach((value) => {
    const btn = el(`mastery-filter-${value}`);
    if (btn) btn.classList.toggle('active', value === masteryFilter);
  });
  if (updateGrid) {
    renderMasteryGrid(getData());
  }
}

function getFactStatus(fs) {
  const attempts = coerceNumber(fs?.attempts, 0);
  const correct = coerceNumber(fs?.correct, 0);
  if (attempts <= 0) return 'untried';
  const acc = correct / attempts;
  if (acc < 0.6) return 'struggling';
  if (acc < 0.85) return 'learning';
  return 'mastered';
}

function shouldShowFactForFilter(status) {
  if (masteryFilter === 'weak') return status === 'struggling' || status === 'untried';
  if (masteryFilter === 'untried') return status === 'untried';
  return true;
}

function getLevelFactProgress(d, levelIdx) {
  const levelFacts = getLevelQuestionSet(levelIdx);
  if (!Array.isArray(levelFacts) || levelFacts.length === 0) return { mastered: 0, total: 0 };
  let mastered = 0;
  levelFacts.forEach(([a, b]) => {
    const fs = d.factStats[makeFactKey(a, b)] || { correct: 0 };
    if (coerceNumber(fs.correct, 0) > 0) mastered++;
  });
  return { mastered, total: levelFacts.length };
}

function getLevelStatus(d, idx, progress) {
  const unlocked = Array.isArray(d.unlocked) ? !!d.unlocked[idx] : idx === 0;
  if (!unlocked) return '🔒 Locked';
  if (progress.mastered >= progress.total && progress.total > 0) return '✅ Mastered';
  return '🚀 In Progress';
}

function getNextTargetLevelIndex(d) {
  if (!Array.isArray(d.unlocked)) return 0;
  const firstLocked = d.unlocked.indexOf(false);
  if (firstLocked !== -1) return firstLocked;
  return LEVEL_COUNT - 1;
}

function renderWeakFacts(d) {
  const list = el('weak-facts-list');
  if (!list) return;
  const nextLevelIdx = getNextTargetLevelIndex(d);
  const levelFacts = getLevelQuestionSet(nextLevelIdx);
  const focusKeys = new Set();
  if (Array.isArray(levelFacts)) {
    levelFacts.forEach(([a, b]) => {
      focusKeys.add(makeFactKey(a, b));
    });
  }
  const attempted = [];
  const untried = [];
  if (focusKeys.size === 0) {
    replaceChildrenWithFragment(list, [createWeakFactRow('🎉', 'Great job! No focused facts yet.', 'good')]);
    return;
  }

  focusKeys.forEach((key) => {
    const [a, b] = key.split('x').map(Number);
    const fs = d.factStats[key] || { attempts: 0, correct: 0 };
    const attempts = coerceNumber(fs.attempts, 0);
    const correct = coerceNumber(fs.correct, 0);
    const item = { a, b, attempts, correct };
    if (attempts === 0) {
      untried.push(item);
      return;
    }
    if (correct < attempts) {
      item.acc = Math.round((correct / attempts) * 100);
      attempted.push(item);
    }
  });

  if (!attempted.length && !untried.length) {
    const nextName = LEVELS[nextLevelIdx]?.friendly || `Level ${nextLevelIdx + 1}`;
    replaceChildrenWithFragment(list, [createWeakFactRow('🎉', `${nextName} is clean — next facts are ready for full speed.`, 'good')]);
    return;
  }

  attempted.sort((a, b) => {
    if (a.acc !== b.acc) return a.acc - b.acc;
    if (a.attempts !== b.attempts) return b.attempts - a.attempts;
    return (a.a + a.b) - (b.a + b.b);
  });

  const top = attempted.slice(0, 5);
  const remaining = Math.max(0, 5 - top.length);
  if (untried.length && remaining > 0) top.push(...untried.slice(0, remaining));
  if (!top.length) {
    replaceChildrenWithFragment(list, [createWeakFactRow('🎉', 'Great job! Everything is clean for the next level.', 'good')]);
    return;
  }

  const rows = [];
  top.forEach(item => {
    const attempts = item.attempts;
    const correct = item.correct;
    const acc = attempts ? Math.round((correct / attempts) * 100) : 0;
    const statusClass = attempts === 0 ? 'warning' : (acc >= 85 ? 'good' : acc >= 60 ? '' : 'bad');
    const label = attempts === 0 ? 'Not tried yet' : `${correct}/${attempts} right · ${acc}%`;
    const row = createWeakFactRow(`${item.a} × ${item.b}`, label, statusClass);
    rows.push(row);
  });
  replaceChildrenWithFragment(list, rows);
}

function createWeakFactRow(name, label, statusClass) {
  const row = document.createElement('div');
  row.className = 'weak-fact-row';
  const labelText = label || '';
  const status = statusClass || '';
  row.innerHTML = `<span class="name">${name}</span><span class="meta ${status}">${labelText}</span>`;
  return row;
}

function showConfirmDialog(options) {
  const {
    title,
    text,
    acceptText,
    cancelText,
    onAccept,
    onCancel = hideConfirmOverlay,
  } = options;

  const overlay = el('confirm-overlay');
  const accept = el('confirm-accept-btn');
  const cancel = el('confirm-cancel-btn');
  el('confirm-title').textContent = title;
  el('confirm-text').textContent = text;
  accept.textContent = acceptText;
  cancel.textContent = cancelText;
  accept.onclick = onAccept;
  cancel.onclick = onCancel;
  const active = document.activeElement;
  if (active instanceof HTMLElement) confirmReturnFocus = active;
  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('tabindex', '-1');
  requestAnimationFrame(() => {
    if (accept) accept.focus();
  });
}

function renderMasteryGrid(d) {
  const grid = el('mastery-grid');
  const nodes = [];
  const emptyState = el('mastery-empty-state');
  if (emptyState) emptyState.style.display = 'none';
  let hasMatch = false;
  // Top-left corner
  const corner = document.createElement('div');
  corner.className='mg-cell header'; corner.textContent='×';
  nodes.push(corner);
  // Column headers
  for(let c=FACT_MIN;c<=FACT_MAX;c++) {
    const h = document.createElement('div');
    h.className='mg-cell header'; h.textContent=c;
    nodes.push(h);
  }
  // Rows
  for(let a=FACT_MIN;a<=FACT_MAX;a++) {
    const rh = document.createElement('div');
    rh.className='mg-cell header'; rh.textContent=a;
    nodes.push(rh);
    for(let b=FACT_MIN;b<=FACT_MAX;b++) {
      const key = `${a}x${b}`;
      const fs = d.factStats[key] || {attempts:0,correct:0};
      const status = getFactStatus(fs);
      const cell = document.createElement('div');
      cell.className = 'mg-cell';
      if(status === 'untried') cell.classList.add('untried');
      if(status === 'struggling') cell.classList.add('struggling');
      if(status === 'learning') cell.classList.add('learning');
      if(status === 'mastered') cell.classList.add('mastered');
      if (!shouldShowFactForFilter(status)) {
        cell.classList.add('muted-cell');
      } else {
        hasMatch = true;
      }
      cell.textContent = fs.attempts > 0 ? `${a*b}` : '';
      cell.title = `${a}×${b}=${a*b} | ${fs.correct}/${fs.attempts} correct`;
      nodes.push(cell);
    }
  }
  replaceChildrenWithFragment(grid, nodes);
  if (!hasMatch && emptyState) emptyState.style.display = 'block';
}

function renderLevelPerf(d) {
  const list = el('level-perf-list');
  const rows = [];
  LEVELS.forEach((lvl,i) => {
    const progress = getLevelFactProgress(d, i);
    const ls = d.levelStats[i];
    const acc = ls.attempts>0 ? Math.round(ls.correct/ls.attempts*100) : 0;
  const avgSpd = ls.correct>0 ? (ls.totalTime/ls.correct/1000).toFixed(1)+'s' : '—';
    const status = getLevelStatus(d, i, progress);
    const statusClass = status.includes('Mastered') ? 'done' : status.includes('Locked') ? 'locked' : 'active';
    const levelPct = getPercentValue(progress.mastered, progress.total);
    const div = document.createElement('div');
    div.className = 'level-perf-row';
    div.innerHTML = `
      <div class="lpr-lvl" style="color:${lvl.color}">Lv${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.75rem;color:var(--text2);margin-bottom:4px">${lvl.name}</div>
        <div class="lpr-bar-wrap"><div class="lpr-bar" style="width:${levelPct}%;background:linear-gradient(90deg,${lvl.color},${lvl.color}88)"></div></div>
      </div>
      <div class="lpr-tag ${statusClass}">${status}</div>
      <div class="lpr-pct">${acc>0?acc+'%':'—'}</div>
      <div class="lpr-spd">⏱${avgSpd}</div>
    `;
    rows.push(div);
  });
  replaceChildrenWithFragment(list, rows);
}

/* ===================== MILESTONE ===================== */
function showMilestone(text) {
  const overlay = el('milestone-overlay');
  el('milestone-content').textContent = text;
  overlay.style.display = 'flex';
  setTimeout(() => { overlay.style.display = 'none'; }, 1500);
}

/* ===================== MASCOT ===================== */
function animateMascot(type) {
  const m = el('mascot');
  if (!m) return;
  m.className = 'mascot';
  void m.offsetWidth; // reflow to restart animation
  m.className = `mascot ${type}`;
}

function miniBurst() {
  const card = el('question-card');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const colors = ['#f59e0b','#ec4899','#10b981','#3b82f6'];
  for (let i = 0; i < EFFECTS_CONFIG.miniBurstPieces; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position:fixed;
      left:${rect.left + rect.width/2}px;
      top:${rect.top + rect.height/2}px;
      width:8px;height:8px;border-radius:50%;
      background:${colors[i%colors.length]};
      pointer-events:none;z-index:999;
      animation:mini-burst .6s ease forwards;
      --dx:${(Math.random()-0.5)*120}px;
      --dy:${(Math.random()-0.5)*80 - 40}px;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

/* ===================== CONFETTI ===================== */
function launchConfetti() {
  const colors = ['#f59e0b','#ec4899','#10b981','#3b82f6','#8b5cf6','#f97316'];
  for(let i=0;i<EFFECTS_CONFIG.confettiPieces;i++) {
    setTimeout(()=>{
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.cssText = `
        left:${Math.random()*100}vw;
        top:-10px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        width:${6+Math.random()*8}px;
        height:${6+Math.random()*8}px;
        animation-duration:${1.5+Math.random()*2}s;
        animation-delay:${Math.random()*.5}s;
        transform:rotate(${Math.random()*360}deg);
      `;
      document.body.appendChild(p);
      setTimeout(()=>p.remove(), 3500);
    }, i*25);
  }
}

/* ===================== SCREEN SWITCHING ===================== */
function showScreen(name) {
  const target = el('screen-'+name);
  if (!target) return;
  const current = activeScreenNode || getCachedScreens().find((screen) => screen.classList.contains('active'));
  if (current && current !== target) {
    current.classList.remove('screen-in');
  }
  gameState.screen = name;
  getCachedScreens().forEach(s=>s.classList.remove('active'));
  target.classList.remove('screen-in');
  target.classList.add('active');
  activeScreenNode = target;
  requestAnimationFrame(() => {
    target.classList.add('screen-in');
  });
}

function handleConfirmOverlayKeydown(e) {
  const overlay = el('confirm-overlay');
  if (!overlay || overlay.style.display !== 'flex') return;

  const accept = el('confirm-accept-btn');
  const cancel = el('confirm-cancel-btn');
  if (!accept || !cancel) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    hideConfirmOverlay();
    return;
  }

  if (e.key !== 'Tab') return;
  const focusables = [accept, cancel];
  const idx = focusables.indexOf(document.activeElement);
  if (idx === -1) {
    e.preventDefault();
    accept.focus();
    return;
  }
  if (e.shiftKey && idx === 0) {
    e.preventDefault();
    cancel.focus();
    return;
  }
  if (!e.shiftKey && idx === focusables.length - 1) {
    e.preventDefault();
    accept.focus();
  }
}

/* ===================== KEYBOARD ===================== */
const answerInput = el('answer-input');
if (answerInput) {
  answerInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!isTypeAnswerMode()) return;
    e.preventDefault();
    const input = getAnswerInput();
    if (!input) return;
    // Keep only digits and keep the current behavior for both 1-digit and 2-digit answers.
    input.value = getSanitizedNumericAnswer();
    submitAnswer();
  });

// Keep number format handling centralized for all input methods.
function getAnswerLengthFromInput() {
  return expectedAnswerLength();
}

// Accept only digits (0-9); this prevents symbols, spaces, and signs.
function isNumericInput(value) {
  return /^\d+$/.test(value);
}

// Remove anything that's not a digit before validating length and submission.
function sanitizeNumericInput(value) {
  return String(value || '').replace(/\D/g, '');
}

// Build a normalized input value that is safe for numeric grading.
function getSanitizedNumericAnswer() {
  const input = getAnswerInput();
  if (!input) return '';
  return sanitizeNumericInput(input.value);
}

// Submit only when the exact typed length matches the expected answer length.
function hasExactAnswerLength(value) {
  return isNumericInput(value) && value.length === getAnswerLengthFromInput();
}

// Decide if fast-mode auto-submit should run for the current input event.
function shouldAutoSubmitByFastMode(rawValue) {
  // Auto-submit only in game, only type mode, and only once per question.
  if (!isActiveGameplayInput() || !fastMode || gameState.fastModeUsed) return false;
  if (!isTypeAnswerMode()) return false;
  return hasExactAnswerLength(rawValue);
}

  answerInput.addEventListener('input', function() {
    const input = this;
    // Rebuild the field using only digits so pasted text never breaks answer checks.
    const sanitized = sanitizeNumericInput(input.value);

  input.value = sanitized;
  const expectedLen = getAnswerLengthFromInput();
  if (input.value.length > expectedLen) input.value = input.value.slice(0,expectedLen);

  if (!shouldAutoSubmitByFastMode(input.value)) return;

  gameState.fastModeUsed = true;
  submitAnswer();
  });
  answerInput.addEventListener('blur', function() {
    // Always normalize on blur so pasted/IME artifacts can't remain.
    const sanitized = sanitizeNumericInput(this.value);
    this.value = sanitized;
  });
}

function handleChoiceClick(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  submitChoice(target);
}

function getMissingCoreNodes() {
  return REQUIRED_APP_IDS.filter((id) => !el(id));
}

function renderLoadError(message) {
  const app = el('app');
  if (!app) return;
  app.innerHTML = `
    <div class="card" style="margin:40px auto;max-width:700px">
      <div class="results-title">⚠️ App Failed to Load</div>
      <p class="muted-note">Missing required page nodes: ${message}</p>
    </div>
  `;
}

/* ===================== INIT ===================== */
function initUIHandlers() {
  [
    ['home-stats-btn', showStats],
    ['mode-toggle', toggleMode],
    ['theme-btn', toggleTheme],
    ['home-reset-btn', showResetConfirm],
    ['game-quit-btn', confirmQuit],
    ['submit-btn', submitAnswer],
    ['fast-mode-btn', toggleFastMode],
    ['results-home-btn', goHome],
    ['retry-level-btn', retryLevel],
    ['btn-next-level', nextLevel],
    ['mastery-filter-all', () => setMasteryFilter('all')],
    ['mastery-filter-weak', () => setMasteryFilter('weak')],
    ['mastery-filter-untried', () => setMasteryFilter('untried')],
    ['stats-back-btn', goHome],
  ].forEach(([id, handler]) => {
    const btn = el(id);
    if (!btn) return;
    btn.addEventListener('click', handler);
  });

  const levelGrid = el('level-grid');
  if (levelGrid) {
    levelGrid.addEventListener('click', handleLevelGridClick);
  }

  getChoiceButtons().forEach((btn) => {
    btn.addEventListener('click', handleChoiceClick);
  });
}

function handleLevelGridClick(event) {
  const button = event.target instanceof Element ? event.target.closest('.level-btn') : null;
  if (!button) return;
  if (button.disabled) return;

  const rawIndex = button.dataset.levelIndex;
  const idx = Number(rawIndex);
  if (!Number.isInteger(idx)) return;

  startLevel(idx);
}

answerMode = (() => {
  const savedMode = getStorageValue(STORAGE_KEYS.mode);
  return savedMode === ANSWER_MODES.CHOICE || savedMode === ANSWER_MODES.TYPE
    ? savedMode
    : ANSWER_MODES.TYPE;
})();
syncFastModeFromStorage();
if (getStorageValue(STORAGE_KEYS.theme) === 'light') {
  document.body.classList.add('light');
}
function updateModeText() {
  const btn = el('mode-toggle');
  if (btn) btn.textContent = getModeButtonLabel();
}
function updateFastModeButton() {
  const btn = el('fast-mode-btn');
  if (btn) btn.textContent = fastMode ? '⚡ Fast Mode' : '🐢 Slow Mode';
}
const confirmOverlay = el('confirm-overlay');
if (confirmOverlay) {
  confirmOverlay.addEventListener('keydown', handleConfirmOverlayKeydown);
  confirmOverlay.addEventListener('click', function(event) {
    if (event.target === confirmOverlay) hideConfirmOverlay();
  });
}
window.addEventListener('pagehide', flushQueuedSave);

const missingNodes = getMissingCoreNodes();
if (missingNodes.length > 0) {
  renderLoadError(missingNodes.join(', '));
} else {
  renderHome();
  initUIHandlers();
  showScreen(APP_SCREEN.HOME);
  updateModeText();
  updateFastModeButton();
}
