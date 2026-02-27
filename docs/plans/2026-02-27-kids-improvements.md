# Kids Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Multiplication Master more fun, engaging, and accessible for kids aged 6-10.

**Architecture:** Single self-contained HTML file. All changes are in-place edits to `multiplication-master.html` — CSS in `<style>`, markup in `<body>`, logic in `<script>`. No build tools, no dependencies beyond Google Fonts.

**Tech Stack:** Vanilla HTML/CSS/JS, localStorage for persistence.

---

## Verification method (no test framework)
Each task ends with: open `multiplication-master.html` in browser → manually verify the described behavior → save.

---

### Task 1: Friendly Level Names + Touch Target Improvements

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. In the `LEVELS` array (line ~426), add a `friendly` property to each level:
```js
{ name:'×1 & ×2',  friendly:'Easy Start 🌟', color:'#f59e0b', tables:[1,2] },
{ name:'×5 & ×10', friendly:'Getting Warmer 🔆', color:'#10b981', tables:[5,10] },
{ name:'×3 & ×4',  friendly:'Level Up! 🚀',  color:'#3b82f6', tables:[3,4] },
{ name:'×6 & ×7',  friendly:'Getting Tricky 🧠', color:'#ec4899', tables:[6,7] },
{ name:'×8 & ×9',  friendly:'Almost There 💪', color:'#8b5cf6', tables:[8,9] },
{ name:'Mixed Easy',friendly:'Mix It Up 🎲',  color:'#f97316', tables:[1,2,3,4,5,10] },
{ name:'Mixed Hard',friendly:'Hard Mode 🔥',  color:'#06b6d4', tables:[6,7,8,9] },
{ name:'Full Blast!',friendly:'FULL BLAST 💥', color:'#ef4444', tables:[1,2,3,4,5,6,7,8,9,10] },
```

2. In `renderHome()`, update the button innerHTML to show `friendly` as the main label and `name` as subtitle:
```js
btn.innerHTML = `
  <div class="lvl-num">${i+1}</div>
  <div class="lvl-name">${lvl.friendly}</div>
  <div class="lvl-sub">${lvl.name}</div>
  <div class="lvl-stars">${stars}</div>`;
```

3. Add `.lvl-sub` CSS:
```css
.level-btn .lvl-sub { font-size: .5rem; opacity: .5; font-family: 'Nunito', sans-serif; }
```

4. Change level-grid on mobile to 2 columns (replace the `@media(max-width:480px)` rule):
```css
@media(max-width:480px) {
  .level-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .level-btn .lvl-num { font-size: 1.5rem; }
  .stats-grid { grid-template-columns: repeat(3,1fr); gap: 8px; }
  .question-text { font-size: clamp(3rem,16vw,4.5rem); }
  .answer-input { font-size: 1.6rem; padding: 10px 14px; }
}
```

5. Make the submit button taller:
```css
#submit-btn { min-width: 56px; min-height: 56px; font-size: 1.4rem; padding: 12px 20px; }
```

**Verify:** Open in browser. On a narrow window (or mobile), level grid should show 2 columns with friendly names. Submit button should be large and tappable.

---

### Task 2: Lives System (Replace Pass Threshold)

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. Add `lives` and `maxLives` to `gameState`:
```js
lives: 3,
maxLives: 3,
```

2. Add a lives display to the game header HTML (after streak-badge):
```html
<div class="lives-display" id="lives-display">❤️❤️❤️</div>
```

3. Add CSS:
```css
.lives-display {
  font-size: 1.3rem;
  margin-right: 10px;
  letter-spacing: 2px;
  min-width: 72px;
}
```

4. In `startLevel()`, reset lives:
```js
gameState.lives = 3;
gameState.maxLives = 3;
```

5. Add `updateLives()` function:
```js
function updateLives() {
  const icons = '❤️'.repeat(gameState.lives) + '🖤'.repeat(gameState.maxLives - gameState.lives);
  document.getElementById('lives-display').textContent = icons;
}
```

6. Call `updateLives()` in `loadQuestion()` and `startLevel()`.

7. In `submitAnswer()`, when wrong: decrement lives and check for game over:
```js
} else {
  gameState.streak = 0;
  gameState.lives--;
  updateLives();
  input.className = 'answer-input shake';
  fb.innerHTML = `<span class="feedback-wrong">✗ Answer: ${a} × ${b} = ${correct}</span>`;
  if (gameState.lives <= 0) {
    setTimeout(() => showResults(), 1400);
    return;
  }
}
```

8. Remove the `PASS_THRESHOLD` constant. In `showResults()`, change pass logic to:
```js
const passed = gameState.lives > 0 && correct >= 10; // passed if survived with at least 10/15
```

9. In results subtitle, replace "need X to pass" with:
```js
sub = passed
  ? `Level ${lvl+1} complete! ${lvl<7?'Level '+(lvl+2)+' unlocked! 🔓':''}`
  : `You ran out of hearts! Try again 💪`;
```

**Verify:** Play a level. Getting 3 wrong answers should end the round early. Hearts should visually drain. Surviving should still unlock next level.

---

### Task 3: Custom On-Screen Numpad

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. Add numpad HTML inside `.question-card`, after `.answer-row`:
```html
<div class="numpad" id="numpad">
  <div class="numpad-row">
    <button class="np-btn" onclick="numpadPress('7')">7</button>
    <button class="np-btn" onclick="numpadPress('8')">8</button>
    <button class="np-btn" onclick="numpadPress('9')">9</button>
  </div>
  <div class="numpad-row">
    <button class="np-btn" onclick="numpadPress('4')">4</button>
    <button class="np-btn" onclick="numpadPress('5')">5</button>
    <button class="np-btn" onclick="numpadPress('6')">6</button>
  </div>
  <div class="numpad-row">
    <button class="np-btn" onclick="numpadPress('1')">1</button>
    <button class="np-btn" onclick="numpadPress('2')">2</button>
    <button class="np-btn" onclick="numpadPress('3')">3</button>
  </div>
  <div class="numpad-row">
    <button class="np-btn np-wide" onclick="numpadPress('0')">0</button>
    <button class="np-btn np-del" onclick="numpadPress('del')">⌫</button>
  </div>
</div>
```

2. Add CSS:
```css
.numpad { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; width: 100%; max-width: 240px; }
.numpad-row { display: flex; gap: 8px; justify-content: center; }
.np-btn {
  font-family: 'Fredoka One', cursive;
  font-size: 1.5rem;
  width: 64px; height: 64px;
  border-radius: 14px;
  border: 2px solid #ffffff18;
  background: var(--card2);
  color: var(--text);
  cursor: pointer;
  transition: transform .1s, background .1s;
  display: flex; align-items: center; justify-content: center;
}
.np-btn:active { transform: scale(.92); background: var(--accent4); }
.np-wide { width: 136px; }
.np-del { background: #ef444422; border-color: #ef444444; color: #ef4444; }
```

3. Add `numpadPress()` function:
```js
function numpadPress(val) {
  const input = document.getElementById('answer-input');
  if (val === 'del') {
    input.value = input.value.slice(0, -1);
  } else {
    if (input.value.length >= 3) return;
    input.value += val;
  }
}
```

4. Hide the native input's spin buttons with CSS:
```css
.answer-input::-webkit-inner-spin-button,
.answer-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.answer-input[type=number] { -moz-appearance: textfield; }
```

5. Set `readonly` on the input so mobile keyboard doesn't pop up:
In the HTML: `<input class="answer-input" id="answer-input" type="number" ... readonly />`

**Verify:** Open on mobile or desktop. Tapping numpad buttons fills the input. Backspace removes last digit. Native keyboard does not appear on mobile.

---

### Task 4: Multiple Choice Mode

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. Add a mode toggle to the home screen card, after the level grid:
```html
<div style="display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:16px">
  <span style="font-family:'Fredoka One',cursive;color:var(--text2)">Answer mode:</span>
  <button class="btn btn-secondary" id="mode-toggle" onclick="toggleMode()">⌨️ Type</button>
</div>
```

2. Add to game state:
```js
let answerMode = 'type'; // 'type' | 'choice'
```

3. Add `toggleMode()`:
```js
function toggleMode() {
  answerMode = answerMode === 'type' ? 'choice' : 'type';
  const btn = document.getElementById('mode-toggle');
  btn.textContent = answerMode === 'type' ? '⌨️ Type' : '🔘 Pick';
  localStorage.setItem('mm_mode', answerMode);
}
```

4. Load saved mode on init:
```js
answerMode = localStorage.getItem('mm_mode') || 'type';
// update button text after renderHome()
```

5. Add choice buttons HTML to game screen (hidden by default), after `.answer-row`:
```html
<div class="choice-row" id="choice-row" style="display:none">
  <button class="choice-btn" onclick="submitChoice(this)"></button>
  <button class="choice-btn" onclick="submitChoice(this)"></button>
  <button class="choice-btn" onclick="submitChoice(this)"></button>
  <button class="choice-btn" onclick="submitChoice(this)"></button>
</div>
```

6. Add CSS:
```css
.choice-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 8px; width: 100%; max-width: 340px; }
.choice-btn {
  font-family: 'Fredoka One', cursive;
  font-size: 1.6rem;
  width: calc(50% - 6px);
  padding: 18px 10px;
  border-radius: 16px;
  border: 2px solid #ffffff18;
  background: var(--card2);
  color: var(--text);
  cursor: pointer;
  transition: transform .1s, background .15s;
}
.choice-btn:hover { transform: scale(1.04); background: var(--card); }
.choice-btn.correct-choice { background: #10b98133; border-color: #10b981; }
.choice-btn.wrong-choice  { background: #ef444433; border-color: #ef4444; }
```

7. In `loadQuestion()`, show/hide the right UI based on mode:
```js
const isChoice = answerMode === 'choice';
document.getElementById('answer-row').style.display = isChoice ? 'none' : '';
document.getElementById('numpad').style.display = isChoice ? 'none' : '';
document.getElementById('choice-row').style.display = isChoice ? '' : 'none';
document.getElementById('submit-btn').style.display = isChoice ? 'none' : '';

if (isChoice) {
  const correct = gameState.currentA * gameState.currentB;
  const choices = generateChoices(correct);
  const btns = document.querySelectorAll('.choice-btn');
  btns.forEach((btn, i) => {
    btn.textContent = choices[i];
    btn.className = 'choice-btn';
    btn.dataset.val = choices[i];
  });
}
```

8. Add `generateChoices(correct)`:
```js
function generateChoices(correct) {
  const opts = new Set([correct]);
  const offsets = [-2,-1,1,2,3,-3,4,-4,5,-5].sort(()=>Math.random()-.5);
  for (const o of offsets) {
    if (opts.size >= 4) break;
    const v = correct + o;
    if (v > 0 && v !== correct) opts.add(v);
  }
  return [...opts].sort(() => Math.random() - .5);
}
```

9. Add `submitChoice(btn)`:
```js
function submitChoice(btn) {
  const val = parseInt(btn.dataset.val);
  document.getElementById('answer-input').value = val;
  // disable all buttons briefly
  document.querySelectorAll('.choice-btn').forEach(b => b.onclick = null);
  submitAnswer();
}
```

**Verify:** Toggle to "Pick" mode on home screen. Play a level — see 4 large buttons instead of input. Correct button lights green, wrong lights red. Type mode still works normally.

---

### Task 5: Mascot + Micro-Celebrations

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. Add mascot HTML to game screen, inside `.question-card` before `.level-badge`:
```html
<div class="mascot" id="mascot">🦊</div>
```

2. Add CSS:
```css
.mascot {
  position: absolute;
  top: 12px; right: 16px;
  font-size: 2rem;
  transition: transform .3s cubic-bezier(.34,1.56,.64,1);
  user-select: none;
}
.mascot.happy { animation: mascot-happy .5s ease; }
.mascot.sad   { animation: mascot-sad .5s ease; }
.mascot.dance { animation: mascot-dance .8s ease; }
@keyframes mascot-happy {
  0%   { transform: scale(1) rotate(0); }
  40%  { transform: scale(1.4) rotate(-15deg); }
  70%  { transform: scale(1.2) rotate(10deg); }
  100% { transform: scale(1) rotate(0); }
}
@keyframes mascot-sad {
  0%,100% { transform: translateY(0); }
  30%     { transform: translateY(6px) rotate(-10deg); }
  60%     { transform: translateY(3px) rotate(5deg); }
}
@keyframes mascot-dance {
  0%   { transform: scale(1) rotate(0); }
  20%  { transform: scale(1.5) rotate(-20deg); }
  40%  { transform: scale(1.3) rotate(20deg); }
  60%  { transform: scale(1.5) rotate(-10deg); }
  80%  { transform: scale(1.2) rotate(10deg); }
  100% { transform: scale(1) rotate(0); }
}
```

3. Add `animateMascot(type)` function:
```js
function animateMascot(type) {
  const m = document.getElementById('mascot');
  m.className = 'mascot';
  void m.offsetWidth; // reflow to restart animation
  m.className = `mascot ${type}`;
}
```

4. In `submitAnswer()`, call mascot:
- On correct: `animateMascot('happy')`
- On wrong: `animateMascot('sad')`
- On streak ≥ 5: `animateMascot('dance')`

5. Add mini particle burst on correct answer (add to `submitAnswer()` when correct):
```js
function miniBurst() {
  const card = document.getElementById('question-card');
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
```

6. Add CSS for mini-burst animation:
```css
@keyframes mini-burst {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
}
```

7. Call `miniBurst()` on correct answer in `submitAnswer()`.

**Verify:** Correct answers → mascot bounces + mini particles. Wrong answer → mascot droops. High streaks → mascot dances.

---

### Task 6: Streak Milestones Flash

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. Add milestone overlay HTML (inside `.app`, after all screens):
```html
<div class="milestone-overlay" id="milestone-overlay" style="display:none">
  <div class="milestone-content" id="milestone-content"></div>
</div>
```

2. Add CSS:
```css
.milestone-overlay {
  position: fixed; inset: 0; z-index: 500;
  display: flex; align-items: center; justify-content: center;
  background: #00000066;
  animation: fadeIn .2s ease;
  pointer-events: none;
}
.milestone-content {
  font-family: 'Fredoka One', cursive;
  font-size: clamp(2rem, 10vw, 4rem);
  text-align: center;
  background: linear-gradient(135deg, var(--accent1), var(--accent2));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 30px #f59e0b88);
  animation: milestone-pop .4s cubic-bezier(.34,1.56,.64,1);
}
@keyframes milestone-pop {
  from { transform: scale(.5); opacity: 0; }
  to   { transform: scale(1);  opacity: 1; }
}
```

3. Add `showMilestone(text)`:
```js
function showMilestone(text) {
  const overlay = document.getElementById('milestone-overlay');
  document.getElementById('milestone-content').textContent = text;
  overlay.style.display = 'flex';
  setTimeout(() => { overlay.style.display = 'none'; }, 1500);
}
```

4. In `submitAnswer()`, after incrementing streak, add:
```js
const milestones = { 3: 'ON FIRE! 🔥', 5: 'UNSTOPPABLE! ⚡', 10: 'MATH WIZARD! 🧙' };
if (milestones[gameState.streak]) showMilestone(milestones[gameState.streak]);
```

**Verify:** Get 3, 5, and 10 correct answers in a row. Each triggers a full-screen flash with the milestone message.

---

### Task 7: Level Complete Fanfare + Better Wrong Feedback

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

**Better wrong feedback:**

1. Add a wrong-answer overlay HTML (inside `.app`):
```html
<div class="wrong-overlay" id="wrong-overlay" style="display:none">
  <div class="wrong-overlay-content">
    <div class="wrong-eq" id="wrong-eq"></div>
    <div style="color:var(--text2);font-size:1rem;margin-top:8px">Remember this one! 💡</div>
  </div>
</div>
```

2. Add CSS:
```css
.wrong-overlay {
  position: fixed; inset: 0; z-index: 400;
  display: flex; align-items: center; justify-content: center;
  background: #00000077;
  pointer-events: none;
}
.wrong-overlay-content {
  background: var(--card);
  border: 2px solid #ef444455;
  border-radius: 24px;
  padding: 32px 48px;
  text-align: center;
  animation: fadeIn .2s ease;
}
.wrong-eq {
  font-family: 'Fredoka One', cursive;
  font-size: clamp(2.5rem, 10vw, 4rem);
  color: var(--correct);
}
```

3. In `submitAnswer()` on wrong answer, show the overlay:
```js
document.getElementById('wrong-eq').textContent = `${a} × ${b} = ${correct}`;
const wo = document.getElementById('wrong-overlay');
wo.style.display = 'flex';
setTimeout(() => { wo.style.display = 'none'; }, 1300);
```

**Level complete fanfare (stars drop in):**

4. In `showResults()`, before calling `showScreen('results')`, add a delay and animate stars:
```js
// Set stars to empty first
document.getElementById('results-stars').textContent = '';
showScreen('results');

// Drop stars in one by one
const starCount = stars === '⭐⭐⭐' ? 3 : stars === '⭐⭐' ? 2 : stars === '⭐' ? 1 : 0;
const starEl = document.getElementById('results-stars');
let displayed = '';
for (let i = 0; i < starCount; i++) {
  setTimeout(() => {
    displayed += '⭐';
    starEl.textContent = displayed;
    starEl.style.animation = 'none';
    void starEl.offsetWidth;
    starEl.style.animation = 'star-drop .4s cubic-bezier(.34,1.56,.64,1)';
  }, 300 + i * 400);
}
if (starCount === 0) setTimeout(() => { starEl.textContent = '💫'; }, 300);
```

5. Add CSS:
```css
@keyframes star-drop {
  from { transform: scale(0) translateY(-20px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}
```

**Verify:** Get a wrong answer → large overlay shows the correct equation clearly. Complete a level → stars animate in one by one with a bounce.

---

### Task 8: Coins Economy

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. Add `coins` to `getData()` defaults:
```js
if (!d.coins) d.coins = 0;
```

2. Add coin display to game header HTML:
```html
<div class="coin-badge" id="coin-badge">🪙 0</div>
```

3. Add CSS:
```css
.coin-badge {
  background: var(--card2); border-radius: 50px; padding: 4px 12px;
  font-family: 'Fredoka One', cursive; font-size: .9rem; color: var(--accent1);
  margin-right: 8px;
}
```

4. Add `awardCoins(n)`:
```js
function awardCoins(n) {
  const d = getData();
  d.coins = (d.coins || 0) + n;
  saveData(d);
  document.getElementById('coin-badge').textContent = `🪙 ${d.coins}`;
}
```

5. In `submitAnswer()` on correct:
- Base: `awardCoins(1)`
- Streak 3+: `awardCoins(2)` instead
- Streak 5+: `awardCoins(3)` instead

6. Show coins on home screen in the button row:
```html
<div style="text-align:center;margin-bottom:12px">
  <span id="home-coins" style="font-family:'Fredoka One',cursive;color:var(--accent1);font-size:1.1rem"></span>
</div>
```

7. In `renderHome()`, update the coin display:
```js
const d = getData();
document.getElementById('home-coins').textContent = `🪙 ${d.coins || 0} coins`;
```

**Verify:** Play through some questions. Coins accumulate. Streaks give bonus coins. Home screen shows total coin count.

---

### Task 9: High-Contrast Theme Toggle

**Files:**
- Modify: `multiplication-master.html`

**What to change:**

1. Add a `light` class style block to `<style>`:
```css
body.light {
  --bg: #f0f4ff;
  --bg2: #e2e8f0;
  --card: #ffffff;
  --card2: #e2e8f0;
  --text: #1e1b4b;
  --text2: #64748b;
  --locked: #cbd5e1;
}
body.light .stars { display: none; }
body.light .logo { filter: none; }
```

2. Add theme toggle button to home screen (in the button row):
```html
<button class="btn btn-secondary" id="theme-btn" onclick="toggleTheme()">☀️ Bright Mode</button>
```

3. Add `toggleTheme()`:
```js
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('theme-btn').textContent = isLight ? '🌙 Dark Mode' : '☀️ Bright Mode';
  localStorage.setItem('mm_theme', isLight ? 'light' : 'dark');
}
```

4. On init, apply saved theme:
```js
if (localStorage.getItem('mm_theme') === 'light') {
  document.body.classList.add('light');
}
```

5. Update the theme button label on `renderHome()`:
```js
const isLight = document.body.classList.contains('light');
const themeBtn = document.getElementById('theme-btn');
if (themeBtn) themeBtn.textContent = isLight ? '🌙 Dark Mode' : '☀️ Bright Mode';
```

**Verify:** Click "Bright Mode" — app switches to light pastel theme, stars hidden. Toggle back — dark space theme returns. Refresh — persists.

---

## Implementation Order

1. Task 1 (friendly names + touch targets) — quick, visual win
2. Task 2 (lives system) — core game loop change
3. Task 3 (numpad) — removes keyboard barrier
4. Task 4 (multiple choice) — big accessibility win for 6-8 yr olds
5. Task 5 (mascot + micro-celebrations) — fun factor
6. Task 6 (streak milestones) — excitement layer
7. Task 7 (fanfare + wrong feedback) — polish
8. Task 8 (coins) — engagement layer
9. Task 9 (theme toggle) — accessibility finish
