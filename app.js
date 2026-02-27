/* ===================== DATA ===================== */
const LEVELS = [
  // Progression: single-table levels from ×1 to ×10.
  { name:'×1', friendly:'Easy Start',           color:'#f59e0b', tables:[1] },
  { name:'×2', friendly:'Steady Start',         color:'#f97316', tables:[2] },
  { name:'×3', friendly:'Third Time',           color:'#10b981', tables:[3] },
  { name:'×4', friendly:'Four to Four',         color:'#3b82f6', tables:[4] },
  { name:'×5', friendly:'Fizz and Five',        color:'#8b5cf6', tables:[5] },
  { name:'×6', friendly:'Six Pack',             color:'#ec4899', tables:[6] },
  { name:'×7', friendly:'Lucky Sevens',         color:'#14b8a6', tables:[7] },
  { name:'×8', friendly:'Octave Boost',         color:'#f59e0b', tables:[8] },
  { name:'×9', friendly:'Niner’s Dash',         color:'#ef4444', tables:[9] },
  { name:'×10', friendly:'Final Countdown',     color:'#06b6d4', tables:[10] },
];
const TOTAL_Q = 15;
let answerMode = 'type'; // 'type' | 'choice'
let fastMode = false;
const APP_SCREEN = {
  HOME: 'home',
  GAME: 'game',
  RESULTS: 'results',
  STATS: 'stats',
};

const STORAGE_KEYS = {
  data: 'mm_data',
  mode: 'mm_mode',
  fastMode: 'mm_fast_mode',
  theme: 'mm_theme',
};
const inMemoryStorage = new Map();
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
const PASS_THRESHOLD = 10;
const MAX_LIVES = 3;
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
  heartEmpty: '🖤',
  arrow: '➜',
  lock: '🔓'
};

/* ===================== STATE ===================== */
let gameState = {
  currentLevel: 0,
  questions: [],
  qIndex: 0,
  results: [],
  streak: 0,
  maxStreak: 0,
  questionStart: 0,
  timerInterval: null,
  activeQuestion: 0,
  fastModeUsed: false,
  isQuestionLocked: false,
  currentA: 0,
  currentB: 0,
  lives: MAX_LIVES,
  maxLives: MAX_LIVES,
  screen: APP_SCREEN.HOME,
  isActiveSession: false,
};

// ===================== HELPERS =====================
// Small DOM convenience wrappers used by most screen flows.
function el(id) {
  return document.getElementById(id);
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
function saveData(d) {
  setStorageValue(STORAGE_KEYS.data, JSON.stringify(d));
}
function getData() {
  let d = loadData();
  d.unlocked = normalizeBooleanArray(d.unlocked, UNLOCK_DEFAULTS);
  d.levelStats = Array.from({ length: LEVEL_COUNT }, (_, i) => normalizeLevelStat(d.levelStats?.[i]));
  if (!d.factStats || typeof d.factStats !== 'object') d.factStats = {};
  for(let a=FACT_MIN;a<=FACT_MAX;a++) {
    for(let b=FACT_MIN;b<=FACT_MAX;b++) {
      const key = `${a}x${b}`;
      d.factStats[key] = normalizeFactStat(d.factStats[key]);
    }
  }
  d.coins = coerceNumber(d.coins, 0);
  if (d.coins < 0) d.coins = 0;
  return d;
}

function resetAll() {
  removeStorageValue(STORAGE_KEYS.data);
  removeStorageValue(STORAGE_KEYS.mode);
  removeStorageValue(STORAGE_KEYS.fastMode);
  removeStorageValue(STORAGE_KEYS.theme);
  answerMode = 'type';
  fastMode = false;
  document.body.classList.remove('light');
  renderHome();
  updateModeText();
  updateFastModeButton();
}

function toggleMode() {
  answerMode = answerMode === 'type' ? 'choice' : 'type';
  const btn = el('mode-toggle');
  if (btn) btn.textContent = answerMode === 'type' ? '⌨️ Type' : '🔘 Pick';
  setStorageValue(STORAGE_KEYS.mode, answerMode);
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

function initAppControls() {
  const binds = [
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
    ['stats-back-btn', goHome],
  ];

  binds.forEach(([id, handler]) => {
    const node = el(id);
    if (node) node.onclick = handler;
  });
}

/* ===================== RENDER HOME ===================== */
function renderHome() {
  const d = getData();
  const grid = el('level-grid');
  if (!grid) return;
  grid.innerHTML = '';
  LEVELS.forEach((lvl,i) => {
    const unlocked = d.unlocked[i];
    const ls = d.levelStats[i];
    const acc = ls.attempts > 0 ? Math.round(ls.correct/ls.attempts*100) : 0;
  const stars = acc >= 93 ? '⭐️⭐️⭐️' : acc >= 80 ? '⭐️⭐️' : acc > 0 ? '⭐️' : '';
    const btn = document.createElement('div');
    btn.className = 'level-btn ' + (unlocked ? 'unlocked' : 'locked');
    btn.style.cssText = unlocked
      ? `background:linear-gradient(135deg,${lvl.color}22,${lvl.color}44);border-color:${lvl.color}55;color:${lvl.color}`
      : '';
    if(unlocked) {
      btn.innerHTML = `<div class="lvl-num">${i+1}</div><div class="lvl-name">${lvl.friendly}</div><div class="lvl-sub">${lvl.name}</div><div class="lvl-hint">${lvl.hint || 'Tap to start'}</div><div class="lvl-stars">${stars}</div>`;
      btn.onclick = () => startLevel(i);
    } else {
      btn.innerHTML = `<div class="lvl-num" style="opacity:.3">${i+1}</div><div class="lvl-name" style="margin-top:8px">Locked</div>`;
    }
    grid.appendChild(btn);
  });
  const homeCoins = el('home-coins');
  if (homeCoins) homeCoins.textContent = `🪙 ${d.coins || 0} coins`;
  const themeBtn = el('theme-btn');
  if (themeBtn) themeBtn.textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Bright';
}

/* ===================== GENERATE QUESTIONS ===================== */
function generateQuestions(levelIdx) {
  const tables = LEVELS[levelIdx].tables;
  let pool = [];
  tables.forEach(t => {
    for(let b=FACT_MIN;b<=FACT_MAX;b++) pool.push([t,b]);
  });
  if (pool.length === 0) return [];
  // shuffle each block and repeat until we have enough questions
  const shuffledBlock = shuffleArray(pool);
  let result = [];
  while(result.length < TOTAL_Q) {
    result.push(...shuffleArray(shuffledBlock));
  }
  return result.slice(0, TOTAL_Q);
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
  gameState.qIndex = 0;
  gameState.results = [];
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

  el('game-level-badge').textContent = `Level ${idx+1} — ${LEVELS[idx].name}`;
  showScreen(APP_SCREEN.GAME);
  loadQuestion();
  el('coin-badge').textContent = `🪙 ${d.coins || 0}`;
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

  el('question-display').textContent = `${a} × ${b} = ?`;
  el('feedback-row').innerHTML = '';
  // Keep UI for this question reset and focused before rendering choices/timer.
  const answerInput = getAnswerInput();
  answerInput.value = '';
  answerInput.maxLength = answerLen;
  answerInput.className = 'answer-input';
  answerInput.focus();

  renderGameHUD();

  // Show/hide type vs choice UI
  const isChoice = answerMode === 'choice';
  el('answer-row').style.display = isChoice ? 'none' : '';
  el('choice-row').style.display = isChoice ? '' : 'none';
  el('submit-btn').style.display = isChoice ? 'none' : '';

  if (isChoice) {
    const correct = gameState.currentA * gameState.currentB;
    const choices = generateChoices(correct);
    const btns = document.querySelectorAll('.choice-btn');
    btns.forEach((btn, i) => {
      btn.textContent = choices[i];
      btn.className = 'choice-btn';
      btn.dataset.val = choices[i];
      btn.onclick = function() { submitChoice(this); };
    });
  }

  startQuestionTimer(questionSession);
}

function updateProgress() {
  const done = gameState.qIndex;
  const pct = (done/TOTAL_Q)*100;
  el('progress-bar').style.width = pct+'%';
  el('progress-text').textContent = `${done}/${TOTAL_Q}`;
  el('streak-badge').textContent = `${UI_ICON.fire} ${gameState.streak}`;
  const qCount = el('question-count');
  if (qCount) qCount.textContent = `Q ${Math.min(done + 1, TOTAL_Q)}/${TOTAL_Q}`;
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
}

function startQuestionTimer(questionSession) {
  clearQuestionTimer();
  gameState.timerInterval = setInterval(() => {
    if (!gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME || gameState.activeQuestion !== questionSession) {
      clearQuestionTimer();
      return;
    }
    const elapsed = ((Date.now() - gameState.questionStart)/1000).toFixed(1);
    el('timer-display').textContent = `⏱ ${elapsed}s`;
  }, 100);
}

function awardCoins(n) {
  const d = getData();
  d.coins = (d.coins || 0) + n;
  saveData(d);
  el('coin-badge').textContent = `🪙 ${d.coins}`;
}

function submitChoice(btn) {
  if (!gameState.isActiveSession || gameState.screen !== APP_SCREEN.GAME) return;
  // Reuse the same grading path as typing by injecting the selected value before submit.
  document.querySelectorAll('.choice-btn').forEach(b => b.onclick = null);
  el('answer-input').value = btn.dataset.val;
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
  const key = `${a}x${b}`;

  // Update fact stats
  const d = getData();
  d.factStats[key].attempts++;
  if(isCorrect) d.factStats[key].correct++;
  saveData(d);

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
      5: 'UNSTOPPABLE! ⚡',
      10: 'MATH WIZARD! 🧙'
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
  }
  el('streak-badge').textContent = `${UI_ICON.fire} ${gameState.streak}`;

  // Next question after short delay
  setTimeout(() => {
    if (gameState.activeQuestion !== questionSession) return;
    gameState.qIndex++;
    if(gameState.qIndex >= TOTAL_Q) {
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
  const lvl = gameState.currentLevel;
  const correct = res.filter(r=>r.correct).length;
  const accuracy = Math.round((correct/TOTAL_Q)*100);
  const times = res.filter(r=>r.correct).map(r=>r.time);
  const avgTime = times.length ? (times.reduce((a,b)=>a+b,0)/times.length/1000).toFixed(1) : '—';
  const passed = gameState.lives > 0 && correct >= PASS_THRESHOLD;

  // Stars
  const starCount = accuracy >= 93 ? 3 : accuracy >= 80 ? 2 : accuracy >= 60 ? 1 : 0;

  // Save level stats
  const d = getData();
  d.levelStats[lvl].attempts += TOTAL_Q;
  d.levelStats[lvl].correct += correct;
  d.levelStats[lvl].totalTime += times.reduce((a,b)=>a+b,0);
  if(times.length) d.levelStats[lvl].bestTime = Math.min(d.levelStats[lvl].bestTime, Math.min(...times)/1000);
  d.levelStats[lvl].bestAccuracy = Math.max(d.levelStats[lvl].bestAccuracy, accuracy);

  // Unlock next
  if(passed && lvl < LEVEL_COUNT - 1) d.unlocked[lvl+1] = true;
  saveData(d);

  // Render
  // Animate stars dropping in one by one
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
    }, 300 + i * 400);
  }
  if (starCount === 0) setTimeout(() => { starEl.textContent = UI_ICON.spark; }, 300);

  let title, sub;
  if(accuracy === 100) { title='Perfect Score! 🏆'; }
  else if(accuracy >= 93) { title='Amazing! 🎉'; }
  else if(accuracy >= 80) { title='Great Job! 👏'; }
  else if(passed) { title='Good Try! 💪'; }
  else { title='Keep Practicing! 🌱'; }
  sub = passed
    ? `Level ${lvl+1} complete! ${lvl < LEVEL_COUNT - 1 ? 'Level ' + (lvl+2) + ' unlocked! 🔓' : ''}`
    : `${correct}/${TOTAL_Q} correct — you ran out of hearts! Try again 💪`;

  el('results-title').textContent = title;
  el('results-sub').textContent = sub;
  el('r-accuracy').textContent = accuracy+'%';
  el('r-avg-time').textContent = avgTime+'s';
  el('r-streak').textContent = gameState.maxStreak + ' ' + UI_ICON.fire;

  // Answer log
  const log = el('answer-log');
  log.innerHTML = res.map(r => {
    const ans = r.correct ? r.a*r.b : `${r.answer} ${UI_ICON.wrong}`;
    const icon = r.correct ? UI_ICON.check : UI_ICON.wrong;
    const spd = (r.time/1000).toFixed(1)+'s';
    return `<div class="answer-log-row">
      <span class="q">${r.a} × ${r.b}</span>
      <span style="flex:1;text-align:center;font-weight:700;color:${r.correct?'var(--correct)':'var(--wrong)'}">${ans}</span>
      <span class="status">${icon}</span>
      <span class="spd">${spd}</span>
    </div>`;
  }).join('');

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
  const o = el('confirm-overlay');
  el('confirm-title').textContent = 'Quit this round?';
  el('confirm-text').textContent = 'Want to leave now? Your progress is saved and your streak will continue when you return.';
  el('confirm-accept-btn').textContent = 'Quit Round';
  el('confirm-accept-btn').onclick = confirmQuitAction;
  el('confirm-cancel-btn').textContent = 'Keep Playing';
  el('confirm-cancel-btn').onclick = hideConfirmOverlay;
  o.style.display = 'flex';
}
function confirmQuitAction() {
  hideConfirmOverlay();
  goHome();
}
function showResetConfirm() {
  const o = el('confirm-overlay');
  el('confirm-title').textContent = 'Reset all progress?';
  el('confirm-text').textContent = 'This clears all level unlocks, streak history, and coins. This action cannot be undone.';
  el('confirm-accept-btn').textContent = 'Reset';
  el('confirm-accept-btn').onclick = function(){ confirmResetAll(); };
  el('confirm-cancel-btn').textContent = 'Cancel';
  el('confirm-cancel-btn').onclick = hideConfirmOverlay;
  o.style.display = 'flex';
}
function confirmResetAll() {
  hideConfirmOverlay();
  resetAll();
}
function hideConfirmOverlay() {
  el('confirm-overlay').style.display = 'none';
}

/* ===================== STATS ===================== */
function showStats() {
  const d = getData();
  renderMasteryGrid(d);
  renderLevelPerf(d);
  showScreen(APP_SCREEN.STATS);
}

function renderMasteryGrid(d) {
  const grid = el('mastery-grid');
  grid.innerHTML = '';
  // Top-left corner
  const corner = document.createElement('div');
  corner.className='mg-cell header'; corner.textContent='×';
  grid.appendChild(corner);
  // Column headers
  for(let c=FACT_MIN;c<=FACT_MAX;c++) {
    const h = document.createElement('div');
    h.className='mg-cell header'; h.textContent=c;
    grid.appendChild(h);
  }
  // Rows
  for(let a=FACT_MIN;a<=FACT_MAX;a++) {
    const rh = document.createElement('div');
    rh.className='mg-cell header'; rh.textContent=a;
    grid.appendChild(rh);
    for(let b=FACT_MIN;b<=FACT_MAX;b++) {
      const key = `${a}x${b}`;
      const fs = d.factStats[key] || {attempts:0,correct:0};
      const cell = document.createElement('div');
      cell.className = 'mg-cell';
      const acc = fs.attempts>0 ? fs.correct/fs.attempts : -1;
      if(acc < 0) cell.classList.add('untried');
      else if(acc < 0.7) cell.classList.add('struggling');
      else if(acc < 0.9) cell.classList.add('learning');
      else cell.classList.add('mastered');
      cell.textContent = fs.attempts > 0 ? `${a*b}` : '';
      cell.title = `${a}×${b}=${a*b} | ${fs.correct}/${fs.attempts} correct`;
      grid.appendChild(cell);
    }
  }
}

function renderLevelPerf(d) {
  const list = el('level-perf-list');
  list.innerHTML = '';
  LEVELS.forEach((lvl,i) => {
    const ls = d.levelStats[i];
    const acc = ls.attempts>0 ? Math.round(ls.correct/ls.attempts*100) : 0;
    const avgSpd = ls.correct>0 ? (ls.totalTime/ls.correct/1000).toFixed(1)+'s' : '—';
    const div = document.createElement('div');
    div.className = 'level-perf-row';
    div.innerHTML = `
      <div class="lpr-lvl" style="color:${lvl.color}">Lv${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.75rem;color:var(--text2);margin-bottom:4px">${lvl.name}</div>
        <div class="lpr-bar-wrap"><div class="lpr-bar" style="width:${acc}%;background:linear-gradient(90deg,${lvl.color},${lvl.color}88)"></div></div>
      </div>
      <div class="lpr-pct">${acc>0?acc+'%':'—'}</div>
      <div class="lpr-spd">⏱${avgSpd}</div>
    `;
    list.appendChild(div);
  });
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
  const rect = card.getBoundingClientRect();
  const colors = ['#f59e0b','#ec4899','#10b981','#3b82f6'];
  for (let i = 0; i < 8; i++) {
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
  for(let i=0;i<60;i++) {
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
  const previous = document.querySelector('.screen.active');
  if (previous && previous !== target) {
    previous.classList.remove('screen-in');
  }
  gameState.screen = name;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  target.classList.add('active');
  requestAnimationFrame(() => {
    target.classList.add('screen-in');
  });
  target.classList.add('screen-in');
}

/* ===================== KEYBOARD ===================== */
function bindAnswerInputHandlers() {
  const input = getAnswerInput();
  if (!input) return;

  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (answerMode !== 'type') return;
    e.preventDefault();
    input.value = getSanitizedNumericAnswer();
    submitAnswer();
  });

  input.addEventListener('input', function() {
    const currentInput = input;
    const sanitized = sanitizeNumericInput(currentInput.value);

    currentInput.value = sanitized;
    const expectedLen = getAnswerLengthFromInput();
    if (currentInput.value.length > expectedLen) currentInput.value = currentInput.value.slice(0,expectedLen);

    if (!shouldAutoSubmitByFastMode(currentInput.value)) return;

    gameState.fastModeUsed = true;
    submitAnswer();
  });

  input.addEventListener('blur', function() {
    const currentInput = input;
    const sanitized = sanitizeNumericInput(currentInput.value);
    currentInput.value = sanitized;
  });
}

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
  if (answerMode !== 'type') return false;
  return hasExactAnswerLength(rawValue);
}

/* ===================== INIT ===================== */
answerMode = (() => {
  const savedMode = getStorageValue(STORAGE_KEYS.mode);
  return savedMode === 'choice' || savedMode === 'type' ? savedMode : 'type';
})();
syncFastModeFromStorage();
if (getStorageValue(STORAGE_KEYS.theme) === 'light') {
  document.body.classList.add('light');
}
function updateModeText() {
  const btn = el('mode-toggle');
  if (btn) btn.textContent = answerMode === 'type' ? '⌨️ Type' : '🔘 Pick';
}
function updateFastModeButton() {
  const btn = el('fast-mode-btn');
  if (btn) btn.textContent = fastMode ? '⚡ Fast Mode' : '🐢 Slow Mode';
}
renderHome();
updateModeText();
updateFastModeButton();
bindAnswerInputHandlers();
initAppControls();
showScreen(APP_SCREEN.HOME);




