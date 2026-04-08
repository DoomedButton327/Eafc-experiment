# 🎮 Mettlestate × EA FC Mobile League Manager v4

A fully-featured, mobile-first league management system for EA FC Mobile — built for the Mettlestate community.

---

## 📁 Folder Structure

```
/
├── index.html                    ← Main league manager (admin + public view)
├── css/
│   ├── styles.css                ← All UI styles + 10 themes
│   └── animations.css            ← Animations & micro-interactions
├── js/
│   ├── app.js                    ← Core application logic
│   ├── github.js                 ← Season-aware GitHub sync (seasons/s1/, s2/, etc.)
│   ├── discord.js                ← Full Discord webhook event logger
│   ├── calendar.js               ← SA holidays + SAST clock + calendar UI
│   ├── automation.js             ← Auto-scheduler (fixtures + draws at set SAST times)
│   └── themes.js                 ← 10-theme system (UI + export posters)
├── seasons/
│   └── s1/
│       ├── league-data.json      ← Season 1 data (players, fixtures, results)
│       └── match-images/         ← Match evidence screenshots
├── newplayers/
│   └── index.html                ← Player signup page → Discord webhook
├── assets/
│   └── logo.png                  ← Mettlestate logo
└── README.md
```

---

## ✨ Features

### 🏆 League Management
- Full standings table with podium display
- Live fixture management with quick-resolve buttons
- Detailed match results with evidence images
- Player profiles with stats, form, win rate
- Search/filter for results and players

### 📅 Calendar
- Full South African public holidays (statutory + Easter-based + observed Mondays)
- SAST (GMT+2) live clock
- Month navigation with fixture date highlighting
- Click days for details

### ⏰ Auto-Scheduler (SAST)
- Configure auto fixture generation at any time (e.g. 02:00 SAST)
- Configure auto-draws for pending matches
- Skip SA public holidays & weekends (configurable)
- Discord notifications on all auto-events
- Live countdown to next scheduled action
- Full automation log

### 🔁 Season System
- Season selector with load/switch functionality  
- Start new season: archives to GitHub, resets stats, keeps players with fresh 20 postponements
- All previous seasons accessible via GitHub history

### ⏸ Postponements — 20 Per Season
- Each player gets exactly 20 postponements per season
- Includes postponements by opponents against you
- At 0 postponements: **AUTO-FORFEIT** — opponent wins 3-0 automatically
- Admin override possible for genuine emergencies with evidence

### 🎨 10 Themes
All themes apply to UI **and** export posters:
1. **Acid Dark** (default) — acid yellow/lime on deep navy
2. **Crimson Blaze** — red/orange on dark crimson
3. **Ocean Deep** — cyan/green on midnight blue
4. **Royal Gold** — gold/purple on dark amber
5. **Neon Cyber** — neon green/magenta on pure black
6. **Forest Night** — green/amber on forest black
7. **Arctic Ice** — ice blue/white on deep midnight
8. **Sunset Fire** — orange/red on burnt dark
9. **Midnight Purple** — purple/pink on deep violet
10. **Emerald Elite** — emerald/gold on dark teal

### 🤖 Discord Webhook Logging
Logs these events to Discord with rich embeds:
- ⚽ Match results (with attached evidence image)
- ⏸ Postponements (with remaining count)
- ⛔ Auto-forfeits (when PP count hits 0)
- 🏳️ Forfeits & no-show wins
- 🔀 Fixture generation (manual + automated)
- 🎲 Auto-draws
- ⏰ All automated scheduler events
- 🏆 New season start
- 👤 Player added/removed
- 🚫 Suspensions/reactivations
- 📊 Public leaderboard pushes

### 🤖 WhatsApp OCR (Gemini AI)
- Upload WhatsApp chat screenshots
- AI detects: postponements, forfeits, no-shows, match results
- Per-item approval before applying changes
- Uses Google Gemini 2.5 Flash (free tier, 1,500/day)

### 📋 Player Signup Page (`/newplayers/`)
- 3-step signup form: details → read rules → review & submit
- Country code selector for phone numbers
- Full rules displayed with scroll-tracking enforcement
- Must scroll through and check rules before proceeding
- Submits to Discord webhook with player info

### ☁️ GitHub Sync (Season-Aware)
- Data stored at `seasons/s1/league-data.json` (not root)
- Match images at `seasons/s1/match-images/`
- Public leaderboard push to separate repo
- Debounced auto-sync on every change

### 📸 Image Exports (10 Themes)
- Export fixture matchday poster
- Export standings poster  
- Export rules poster
- All exports respect active theme colours

---

## 🔧 Setup

### 1. Deploy to GitHub Pages
Push this entire folder to a GitHub repo and enable Pages.

### 2. Configure GitHub Sync (Admin)
- Go to **Admin → GitHub Sync**
- Enter your repo owner, name, branch, and PAT token
- Click **Save & Connect**

### 3. Configure Discord Webhook (Admin)
- Go to **Admin → Discord Webhook**
- Paste your Discord webhook URL
- Click **Save & Test** — a test message will be sent

### 4. Configure Player Signup Page
- Edit `newplayers/index.html`
- Set `DISCORD_WEBHOOK_URL` at the top of the script
- Deploy and share the link with prospective players

### 5. Configure Auto-Scheduler (Admin)
- Go to **Admin → Auto-Scheduler**
- Enable auto-fixture and/or auto-draw
- Set times (SAST/GMT+2)
- Toggle holiday/weekend skipping
- Keep the admin tab open or the page active for the scheduler to run

### 6. Google Gemini API (for WhatsApp OCR)
- Get a free key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- Paste in **Admin → WhatsApp OCR → Save API Key**

---

## 📖 Rules Summary

- Win: 3 pts | Draw: 1 pt | Loss: 0 pts
- GD (goal difference) is the tiebreaker
- **20 postponements per season** — then auto-forfeit
- Results due 23:59 same day SAST
- No DMs — all messages in the Mettlestate group

---

*Built for Mettlestate × EA FC Mobile League — South Africa 🇿🇦*
