# 🚀 Multiplication Master

A kid-friendly multiplication practice game for ages 6–10, built for browser-only play. Open `index.html` in any modern browser and start learning.

![Game Screenshot](https://img.shields.io/badge/platform-browser-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

## Play it

**Offline:** open `index.html` directly.
**Online:** publish this repo (GitHub Pages) and serve the same `index.html`.

## Features

### 🎮 Game
- **10 progressive levels** — focused tables from ×1 to ×10
- **Per-level mastery** — each level uses `a × 1..10` for its table
- **Unlock flow** — complete all 10 facts in a level to unlock the next
- **Lives system** — 3 hearts per round; wrong answer loses one
- **Streak tracking** — bonuses scale with streak length
- **Coins economy** — earn 🪙 coins with streak multipliers

### 🧒 Kid-Friendly
- **Answer modes** — Type mode and 4-choice mode
- **Fast Mode / Slow Mode** — toggle auto-submit behavior for typed answers
- **Bright theme** — light theme available for classroom readability
- **Responsive UI** — touch-friendly controls and adaptable layouts
- **No custom keypad** — uses normal keyboard input for typing mode

### 🥳 Celebrations
- **🦊 Animated mascot** — happy / sad / dance states
- **Milestone feedback** — streak banners at 3, 5, and 10
- **Correct feedback** — mini burst particles and result star animation
- **Wrong feedback** — overlay with correct equation

### 📊 Stats
- **Mastery map** — 10×10 progress grid with solved status
- **Level performance** — attempts, accuracy, average speed, best streak
- **Answer log** — recent question-by-question history
- **Focus list** — suggests weak/untried facts from the next target level

## How to Play

1. Pick a level (start at Level 1).
2. Answer each question before hearts run out.
3. Master all 10 facts to unlock the next level.
4. Keep building streaks for faster coin rewards.
5. Check My Stats for weak facts and trend tracking.

## Levels

| Level | Name  | Table |
|---|---|---|
| 1 | Ones | ×1 |
| 2 | Twos | ×2 |
| 3 | Threes | ×3 |
| 4 | Fours | ×4 |
| 5 | Fives | ×5 |
| 6 | Sixes | ×6 |
| 7 | Sevens | ×7 |
| 8 | Eights | ×8 |
| 9 | Nines | ×9 |
| 10 | Tens | ×10 |

## Tech

- **Pure HTML/CSS/JS** — `index.html` + `app.js`, no dependencies
- **localStorage** — progress is saved in-browser
- **Google Fonts** — Fredoka One + Nunito

## Storage keys

- `mm_data` — progress, coins, level unlocks, and fact statistics
- `mm_mode` — answer mode (`type` or `choice`)
- `mm_fast_mode` — fast-mode preference
- `mm_theme` — theme preference (`light` or `dark`)

## License

MIT
