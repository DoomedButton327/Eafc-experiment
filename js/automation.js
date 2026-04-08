/* ═══════════════════════════════════════════════════════════════
   METTLESTATE — automation.js
   Auto-scheduler: fixture generation + auto-draw at configured time
   Runs on a timer every minute, checking SAST time
   Respects SA public holidays, postponed matches, ignored matches
═══════════════════════════════════════════════════════════════ */

const Automation = (() => {
  'use strict';

  let _checkInterval = null;
  let _lastAutoFixtureDate = null;
  let _lastAutoDrawDate    = null;
  let _log = [];

  const MAX_LOG = 100;

  // ── CONFIG KEYS ────────────────────────────────────────────────
  const CFG_KEY = 'eafc_auto_config';

  function getConfig() {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return {
      autoFixtureEnabled: false,
      autoFixtureTime: '02:00',
      autoFixtureMode: 'roundrobin',
      autoDrawEnabled: false,
      autoDrawTime: '02:00',
      skipHolidays: true,
      skipWeekends: false,
      notifyDiscord: true,
    };
  }

  function saveConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  // ── LOG ────────────────────────────────────────────────────────
  function addLog(msg, level = 'info') {
    const entry = {
      time: new Date().toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
      msg,
      level, // 'info' | 'success' | 'warn' | 'error'
    };
    _log.unshift(entry);
    if (_log.length > MAX_LOG) _log = _log.slice(0, MAX_LOG);
    localStorage.setItem('eafc_auto_log', JSON.stringify(_log.slice(0, 50)));
    renderLog();
  }

  function loadLog() {
    const raw = localStorage.getItem('eafc_auto_log');
    if (raw) { try { _log = JSON.parse(raw); } catch(e) {} }
  }

  function renderLog() {
    const el = document.getElementById('auto-log-content');
    if (!el) return;
    if (!_log.length) { el.innerHTML = '<div class="auto-log-entry"><span class="auto-log-msg" style="color:var(--muted)">No automation events yet.</span></div>'; return; }
    el.innerHTML = _log.slice(0, 30).map(e =>
      `<div class="auto-log-entry">
        <span class="auto-log-time">${e.time}</span>
        <span class="auto-log-msg ${e.level === 'success' ? 'success' : e.level === 'warn' ? 'warn' : e.level === 'error' ? 'error' : ''}">${esc(e.msg)}</span>
      </div>`
    ).join('');
  }

  // ── SAST NOW ───────────────────────────────────────────────────
  function getSASTNow() {
    if (typeof Calendar !== 'undefined') return Calendar.getSASTNow();
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utcMs + 7200000);
  }

  function todayKey(date) {
    const d = date || getSASTNow();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function parseTime(timeStr) {
    const [h, m] = (timeStr || '02:00').split(':').map(Number);
    return { h: h || 0, m: m || 0 };
  }

  // ── MAIN TICK ──────────────────────────────────────────────────
  function tick() {
    const cfg  = getConfig();
    const now  = getSASTNow();
    const hhmm = { h: now.getHours(), m: now.getMinutes() };
    const key  = todayKey(now);
    const isHoliday = typeof Calendar !== 'undefined' ? Calendar.isHoliday(now) : false;
    const isWeekend  = now.getDay() === 0 || now.getDay() === 6;

    // Check if we should skip today
    if (cfg.skipHolidays && isHoliday) return;
    if (cfg.skipWeekends && isWeekend) return;

    // ── AUTO-FIXTURE ────────────────────────────────────────────
    if (cfg.autoFixtureEnabled && _lastAutoFixtureDate !== key) {
      const ft = parseTime(cfg.autoFixtureTime);
      if (hhmm.h === ft.h && hhmm.m === ft.m) {
        _lastAutoFixtureDate = key;
        runAutoFixture(cfg);
      }
    }

    // ── AUTO-DRAW ───────────────────────────────────────────────
    if (cfg.autoDrawEnabled && _lastAutoDrawDate !== key) {
      const dt = parseTime(cfg.autoDrawTime);
      if (hhmm.h === dt.h && hhmm.m === dt.m) {
        _lastAutoDrawDate = key;
        runAutoDraw(cfg);
      }
    }
  }

  // ── AUTO-FIXTURE GENERATION ────────────────────────────────────
  function runAutoFixture(cfg) {
    if (typeof players === 'undefined' || typeof fixtures === 'undefined') return;
    const active = players.filter(p => !p.suspended);
    if (active.length < 2) {
      addLog('Auto-fixture skipped: not enough active players', 'warn');
      return;
    }

    const mode   = cfg.autoFixtureMode || 'roundrobin';
    const newF   = [];

    if (mode === 'roundrobin') {
      for (let i = 0; i < active.length; i++) {
        for (let j = i+1; j < active.length; j++) {
          const exists = fixtures.some(f =>
            (f.home === active[i].username && f.away === active[j].username) ||
            (f.home === active[j].username && f.away === active[i].username)
          );
          if (!exists) newF.push({ home: active[i].username, away: active[j].username, id: Date.now()+Math.random(), autoGenerated: true });
        }
      }
      // Shuffle
      for (let i = newF.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [newF[i], newF[j]] = [newF[j], newF[i]];
      }
    } else {
      const shuffled = [...active].sort(() => 0.5 - Math.random());
      for (let i = 0; i < shuffled.length-1; i+=2) {
        newF.push({ home: shuffled[i].username, away: shuffled[i+1].username, id: Date.now()+i, autoGenerated: true });
      }
    }

    if (!newF.length) {
      addLog('Auto-fixture: no new fixtures to generate (all already exist)', 'warn');
      return;
    }

    fixtures.push(...newF);
    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();

    addLog(`✅ Auto-generated ${newF.length} fixtures (${mode})`, 'success');

    if (cfg.notifyDiscord) {
      Discord.send({
        type: 'fixture_gen',
        count: newF.length,
        mode: mode.charAt(0).toUpperCase() + mode.slice(1),
        by: '⏰ Automated Scheduler',
        fixtures: newF,
      });
      Discord.send({ type: 'auto_schedule', action: 'Fixture Generation', result: `${newF.length} fixtures created` });
    }
  }

  // ── AUTO-DRAW (resolve pending matches) ────────────────────────
  function runAutoDraw(cfg) {
    if (typeof players === 'undefined' || typeof fixtures === 'undefined') return;

    const toResolve = fixtures.filter(f => !f.postponedBy && !f.ignored);
    if (!toResolve.length) {
      addLog('Auto-draw: no eligible fixtures to resolve', 'warn');
      return;
    }

    let resolved = 0;
    let skippedPostponed = fixtures.filter(f => f.postponedBy).length;
    let skippedIgnored   = fixtures.filter(f => f.ignored).length;

    toResolve.forEach(match => {
      const homeP = players.find(p => p.username === match.home);
      const awayP = players.find(p => p.username === match.away);
      if (!homeP || !awayP) return;

      // Apply draw result
      homeP.played = (homeP.played||0)+1; awayP.played = (awayP.played||0)+1;
      homeP.draws  = (homeP.draws||0)+1;  awayP.draws  = (awayP.draws||0)+1;
      homeP.points = (homeP.points||0)+1; awayP.points = (awayP.points||0)+1;
      if (typeof addForm === 'function') { addForm(homeP,'D'); addForm(awayP,'D'); }
      else {
        if (!homeP.form) homeP.form = []; homeP.form.push('D'); if (homeP.form.length>10) homeP.form = homeP.form.slice(-10);
        if (!awayP.form) awayP.form = []; awayP.form.push('D'); if (awayP.form.length>10) awayP.form = awayP.form.slice(-10);
      }

      results.push({
        home: match.home, away: match.away, result: 'draw',
        homeGoals: 0, awayGoals: 0,
        id: Date.now() + Math.random(),
        autoDraw: true,
      });

      const fi = fixtures.indexOf(match);
      if (fi > -1) fixtures.splice(fi, 1);
      resolved++;
    });

    if (typeof saveData === 'function') saveData();
    if (typeof renderAll === 'function') renderAll();

    addLog(`✅ Auto-draw: resolved ${resolved} matches (${skippedPostponed} postponed, ${skippedIgnored} ignored skipped)`, 'success');

    if (cfg.notifyDiscord && resolved > 0) {
      Discord.send({
        type: 'draw_gen',
        count: resolved,
        skipped: skippedPostponed,
        ignored: skippedIgnored,
      });
      Discord.send({ type: 'auto_schedule', action: 'Auto-Draw', result: `${resolved} matches resolved as draws` });
    }
  }

  // ── START / STOP ───────────────────────────────────────────────
  function start() {
    if (_checkInterval) clearInterval(_checkInterval);
    _checkInterval = setInterval(tick, 60000); // check every minute
    addLog('Automation scheduler started', 'info');
    tick(); // immediate check on start
  }

  function stop() {
    if (_checkInterval) { clearInterval(_checkInterval); _checkInterval = null; }
    addLog('Automation scheduler stopped', 'warn');
  }

  // ── MANUAL TRIGGER ─────────────────────────────────────────────
  function manualFixture() {
    const cfg = getConfig();
    addLog('Manual fixture generation triggered by admin', 'info');
    runAutoFixture(cfg);
  }

  function manualDraw() {
    const cfg = getConfig();
    addLog('Manual auto-draw triggered by admin', 'info');
    runAutoDraw(cfg);
  }

  // ── COUNTDOWN TO NEXT EVENT ────────────────────────────────────
  function getCountdownToNext(timeStr) {
    const now  = getSASTNow();
    const { h, m } = parseTime(timeStr);
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const diff = next - now;
    const hours   = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  // ── CONFIG UI ──────────────────────────────────────────────────
  function loadConfigUI() {
    const cfg = getConfig();
    const sv = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } };
    sv('auto-fixture-enabled',  cfg.autoFixtureEnabled);
    sv('auto-fixture-time',     cfg.autoFixtureTime);
    sv('auto-fixture-mode',     cfg.autoFixtureMode);
    sv('auto-draw-enabled',     cfg.autoDrawEnabled);
    sv('auto-draw-time',        cfg.autoDrawTime);
    sv('auto-skip-holidays',    cfg.skipHolidays);
    sv('auto-skip-weekends',    cfg.skipWeekends);
    sv('auto-notify-discord',   cfg.notifyDiscord);
    updateCountdowns();
  }

  function saveConfigUI() {
    const gv = id => { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
    const cfg = {
      autoFixtureEnabled: !!gv('auto-fixture-enabled'),
      autoFixtureTime:    gv('auto-fixture-time') || '02:00',
      autoFixtureMode:    gv('auto-fixture-mode') || 'roundrobin',
      autoDrawEnabled:    !!gv('auto-draw-enabled'),
      autoDrawTime:       gv('auto-draw-time') || '02:00',
      skipHolidays:       !!gv('auto-skip-holidays'),
      skipWeekends:       !!gv('auto-skip-weekends'),
      notifyDiscord:      !!gv('auto-notify-discord'),
    };
    saveConfig(cfg);
    updateCountdowns();
    if (typeof toast === 'function') toast('Automation config saved!', 'success');
    addLog('Config updated by admin', 'info');
  }

  function updateCountdowns() {
    const cfg = getConfig();
    const f = document.getElementById('auto-fixture-countdown');
    const d = document.getElementById('auto-draw-countdown');
    if (f) f.textContent = cfg.autoFixtureEnabled ? 'Next: ' + getCountdownToNext(cfg.autoFixtureTime) : 'Disabled';
    if (d) d.textContent = cfg.autoDrawEnabled    ? 'Next: ' + getCountdownToNext(cfg.autoDrawTime)    : 'Disabled';
  }

  // Update countdowns every minute
  setInterval(updateCountdowns, 60000);

  function init() {
    loadLog();
    loadConfigUI();
    start();
  }

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { init, start, stop, getConfig, saveConfig, saveConfigUI, loadConfigUI, manualFixture, manualDraw, addLog, renderLog, getCountdownToNext };
})();
