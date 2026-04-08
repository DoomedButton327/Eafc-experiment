/* ═══════════════════════════════════════════════════════════════
   METTLESTATE × EAFC — app.js v4 ULTIMATE
   Season system · Calendar · Auto-scheduler · 10 Themes · Discord
   20 postponements/season → auto-forfeit · Full match management
═══════════════════════════════════════════════════════════════ */

/* ─── STATE ──────────────────────────────────────────────────── */
let players  = JSON.parse(localStorage.getItem('eafc_players'))  || [];
let fixtures = JSON.parse(localStorage.getItem('eafc_fixtures')) || [];
let results  = JSON.parse(localStorage.getItem('eafc_results'))  || [];
let pendingMatchImage = null;
let currentSeason = localStorage.getItem('eafc_current_season') || 's1';

/* ─── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  Themes.load();
  GH.load();
  updateSeasonPill();

  if (GH.isConnected()) {
    const remote = await GH.loadRemoteData(currentSeason);
    if (remote) {
      if (remote.players)  players  = remote.players;
      if (remote.fixtures) fixtures = remote.fixtures;
      if (remote.results)  results  = remote.results;
      saveLocalOnly();
    }
  }

  renderAll();
  initNavigation();
  initStarfield();

  // Wire file inputs
  const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('change', fn); };
  wire('playerImport', e => {
    const lbl = document.getElementById('file-chosen');
    if (lbl) lbl.textContent = e.target.files[0]?.name || 'No file chosen';
  });
  wire('matchImageInput', handleMatchImagePick);
  wire('whatsappImageInput', e => {
    const lbl = document.getElementById('whatsapp-file-chosen');
    if (lbl) lbl.textContent = e.target.files[0]?.name || 'No file chosen';
  });
  wire('importBackup', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.players)  players  = data.players;
        if (data.fixtures) fixtures = data.fixtures;
        if (data.results)  results  = data.results;
        saveData(); renderAll(); toast('Backup restored!', 'success');
      } catch { toast('Invalid backup file.', 'error'); }
    };
    reader.readAsText(file);
  });

  // Gemini key status
  if (getGeminiApiKey()) {
    const el = document.getElementById('gemini-key-status');
    if (el) el.innerHTML = '<span style="color:var(--success)"><i class="fas fa-check"></i> API key loaded</span>';
  }

  // Discord webhook URL
  const wh = Discord.getWebhookUrl();
  if (wh) { const el = document.getElementById('discordWebhook'); if (el) el.value = wh; }

  // Accordion init
  document.querySelectorAll('.acc-item:not(.acc-open) .acc-body').forEach(b => b.style.display = 'none');
  document.querySelectorAll('.acc-item.acc-open .acc-body').forEach(b => b.style.display = 'block');

  Automation.init();
  Themes.renderPicker('theme-grid');
  Calendar.startClock();
  loadPublicRepoConfigUI();
});

/* ─── NAVIGATION ─────────────────────────────────────────────── */
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const tab = document.getElementById(btn.dataset.tab);
      if (tab) tab.classList.add('active');
      if (btn.dataset.tab === 'admin')    { renderEvidenceGrid(); loadPublicRepoConfigUI(); Automation.loadConfigUI(); }
      if (btn.dataset.tab === 'calendar') { renderCalendarTab(); }
      if (btn.dataset.tab === 'seasons')  { renderSeasonsTab(); }
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === tabId));
  if (tabId === 'calendar') renderCalendarTab();
  if (tabId === 'seasons')  renderSeasonsTab();
}

/* ─── RENDER ALL ─────────────────────────────────────────────── */
function renderAll() {
  renderLeaderboard();
  renderFixtures();
  renderResults();
  renderPlayerManagement();
  updatePlayerDatalist();
  updateScoreSelect();
  updatePlayerCount();
  updateStatsTicker();
  Themes.applyPosterTheme();
}

/* ─── SEASON PILL ────────────────────────────────────────────── */
function updateSeasonPill() {
  const el = document.getElementById('season-pill-label');
  if (el) el.textContent = currentSeason.toUpperCase();
}

/* ─── STATS TICKER ───────────────────────────────────────────── */
function updateStatsTicker() {
  const totalGoals = results.reduce((s, r) => s + (r.homeGoals||0) + (r.awayGoals||0), 0);
  setText('stat-players', players.length);
  setText('stat-matches', results.length);
  setText('stat-goals',   totalGoals);
  setText('stat-pending', fixtures.length);

  document.querySelectorAll('.ticker-val').forEach(el => {
    el.classList.remove('count-updated'); void el.offsetWidth; el.classList.add('count-updated');
  });

  const liveBar = document.getElementById('live-bar');
  if (liveBar) {
    liveBar.style.display = fixtures.length > 0 ? 'flex' : 'none';
    const lt = document.getElementById('live-bar-text');
    if (lt) lt.textContent = `SEASON IN PROGRESS · ${fixtures.length} FIXTURE${fixtures.length!==1?'S':''} REMAINING`;
  }

  const sub = document.getElementById('standings-subtitle');
  if (sub) sub.textContent = `${players.length} players · ${results.length} matches played · ${currentSeason.toUpperCase()}`;
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

/* ─── LEADERBOARD ────────────────────────────────────────────── */
function renderLeaderboard() {
  const sorted = sortedPlayers();
  const tbody  = document.getElementById('leaderboardBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const podium = document.getElementById('podium-area');
  if (sorted.length >= 3 && podium) {
    podium.style.display = 'grid';
    const [f, s, t] = sorted;
    podium.innerHTML = `
      <div class="podium-card rank-2"><div class="podium-medal">🥈</div><div class="podium-rank">2ND</div><div class="podium-name">${esc(s.username)}</div><div class="podium-pts"><strong>${s.points||0}</strong> pts</div></div>
      <div class="podium-card rank-1"><div class="podium-medal trophy-animate">🥇</div><div class="podium-rank">1ST</div><div class="podium-name">${esc(f.username)}</div><div class="podium-pts"><strong>${f.points||0}</strong> pts</div></div>
      <div class="podium-card rank-3"><div class="podium-medal">🥉</div><div class="podium-rank">3RD</div><div class="podium-name">${esc(t.username)}</div><div class="podium-pts"><strong>${t.points||0}</strong> pts</div></div>`;
  } else if (podium) { podium.style.display = 'none'; }

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="padding:40px;text-align:center;color:var(--muted);font-style:italic">No players yet — add players in Admin</td></tr>`;
    return;
  }

  sorted.forEach((p, i) => {
    const rank = i + 1;
    const gd   = (p.gf||0)-(p.ga||0);
    const gdStr = gd>0?`<span class="gd-pos">+${gd}</span>`:gd<0?`<span class="gd-neg">${gd}</span>`:`<span style="color:var(--muted)">${gd}</span>`;
    const posClass = rank<=3 ? `pos-${rank}` : 'pos-n';
    const zone = rank<=3 ? 'zone-champ' : (sorted.length>=5 && rank>=sorted.length-1 ? 'zone-danger' : '');
    const form = buildFormBadges(p.form||[]);
    const ppLeft = p.postponements !== undefined ? p.postponements : 20;
    const ppBadge = ppLeft<=0 ? '<span style="font-size:0.55rem;color:var(--danger);margin-left:4px;font-family:\'JetBrains Mono\',monospace">NO PP</span>' :
                    ppLeft<=3 ? `<span style="font-size:0.55rem;color:var(--warn);margin-left:4px;font-family:'JetBrains Mono',monospace">${ppLeft}PP</span>` : '';
    const susBadge = p.suspended ? '<span style="font-size:0.58rem;color:var(--danger);margin-left:5px;font-family:\'JetBrains Mono\',monospace;letter-spacing:1px">SUSP</span>' : '';
    const tr = document.createElement('tr');
    tr.className = zone;
    if (p.suspended) tr.style.opacity = '0.45';
    tr.innerHTML = `
      <td><span class="pos-badge ${posClass}">${rank}</span></td>
      <td style="cursor:pointer" onclick="openPlayerProfile('${esc(p.username)}')">
        <div class="player-cell-name">${esc(p.name)}${susBadge}${ppBadge}</div>
        <div class="player-cell-username">${esc(p.username)}</div>
      </td>
      <td>${p.played||0}</td><td>${p.wins||0}</td><td>${p.draws||0}</td><td>${p.losses||0}</td>
      <td class="hide-xs">${p.gf||0}</td><td class="hide-xs">${p.ga||0}</td>
      <td>${gdStr}</td><td class="pts-cell">${p.points||0}</td>
      <td class="hide-sm"><div class="form-badges">${form}</div></td>`;
    tbody.appendChild(tr);
  });
}

function sortedPlayers() {
  return [...players].sort((a,b) => {
    if (b.points!==a.points) return b.points-a.points;
    const gdA=(a.gf||0)-(a.ga||0), gdB=(b.gf||0)-(b.ga||0);
    if (gdB!==gdA) return gdB-gdA;
    return (b.gf||0)-(a.gf||0);
  });
}

function buildFormBadges(form) {
  return (form||[]).slice(-5).map(r =>
    r==='W'?`<span class="form-w">W</span>`:r==='D'?`<span class="form-d">D</span>`:`<span class="form-l">L</span>`
  ).join('');
}

/* ─── PLAYER PROFILE MODAL ───────────────────────────────────── */
function openPlayerProfile(username) {
  const p = players.find(x => x.username===username); if (!p) return;
  const gd = (p.gf||0)-(p.ga||0);
  const gdStr = gd>=0?`+${gd}`:String(gd);
  const winRate = (p.played||0)>0 ? Math.round(((p.wins||0)/(p.played||0))*100) : 0;
  const form = buildFormBadges(p.form||[]);
  const initials = p.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  const ppLeft = p.postponements!==undefined ? p.postponements : 20;
  const ppColor = ppLeft<=0?'var(--danger)':ppLeft<=3?'var(--warn)':'var(--muted)';

  const playerResults = results.filter(r => r.home===username||r.away===username);
  const recentHTML = [...playerResults].reverse().slice(0,5).map(r => {
    const isHome = r.home===username;
    const opp = isHome?r.away:r.home;
    let outcome, cls;
    if (r.result==='draw')                                               {outcome='D';cls='form-d';}
    else if ((r.result==='home'&&isHome)||(r.result==='away'&&!isHome)) {outcome='W';cls='form-w';}
    else                                                                  {outcome='L';cls='form-l';}
    const score = r.homeGoals!==undefined?(isHome?`${r.homeGoals}–${r.awayGoals}`:`${r.awayGoals}–${r.homeGoals}`):outcome;
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:0.8rem">
      <span class="${cls}" style="font-family:'Bebas Neue';font-size:0.95rem;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px">${outcome}</span>
      <span style="flex:1;color:var(--text-soft)">vs ${esc(opp)}</span>
      <span style="font-family:'JetBrains Mono';font-size:0.75rem;color:var(--muted)">${score}</span>
    </div>`;
  }).join('');

  openModal(`
    <div class="player-profile-header">
      <div class="player-avatar">${initials}</div>
      <div>
        <div style="font-weight:700;font-size:1.05rem">${esc(p.name)}</div>
        <div style="font-size:0.75rem;color:var(--muted);font-family:'JetBrains Mono',monospace">${esc(p.username)}</div>
        ${p.phone?`<div style="font-size:0.72rem;color:var(--muted-2);margin-top:3px">${esc(p.phone)}</div>`:''}
      </div>
    </div>
    <div class="profile-stats-grid">
      <div class="profile-stat"><div class="profile-stat-val" style="color:var(--accent)">${p.points||0}</div><div class="profile-stat-lbl">Points</div></div>
      <div class="profile-stat"><div class="profile-stat-val">${p.played||0}</div><div class="profile-stat-lbl">Played</div></div>
      <div class="profile-stat"><div class="profile-stat-val" style="color:var(--success)">${p.wins||0}</div><div class="profile-stat-lbl">Wins</div></div>
      <div class="profile-stat"><div class="profile-stat-val" style="color:var(--gold)">${p.draws||0}</div><div class="profile-stat-lbl">Draws</div></div>
      <div class="profile-stat"><div class="profile-stat-val" style="color:var(--danger)">${p.losses||0}</div><div class="profile-stat-lbl">Losses</div></div>
      <div class="profile-stat"><div class="profile-stat-val">${winRate}%</div><div class="profile-stat-lbl">Win Rate</div></div>
      <div class="profile-stat"><div class="profile-stat-val" style="color:var(--accent2)">${p.gf||0}</div><div class="profile-stat-lbl">Goals For</div></div>
      <div class="profile-stat"><div class="profile-stat-val">${p.ga||0}</div><div class="profile-stat-lbl">Goals Ag.</div></div>
      <div class="profile-stat"><div class="profile-stat-val" style="color:${gd>=0?'var(--success)':'var(--danger)'}">${gdStr}</div><div class="profile-stat-lbl">GD</div></div>
    </div>
    ${form?`<div style="margin-bottom:14px"><div style="font-size:0.65rem;font-family:'JetBrains Mono',monospace;color:var(--muted);letter-spacing:1.5px;margin-bottom:7px">RECENT FORM</div><div class="form-badges">${form}</div></div>`:''}
    ${recentHTML?`<div><div style="font-size:0.65rem;font-family:'JetBrains Mono',monospace;color:var(--muted);letter-spacing:1.5px;margin-bottom:4px">LAST 5 MATCHES</div>${recentHTML}</div>`:''}
    <div style="margin-top:14px;font-size:0.7rem;color:${ppColor};font-family:'JetBrains Mono',monospace">
      Postponements remaining: ${ppLeft}/20 ${ppLeft<=0?'⛔ AUTO-FORFEIT on next attempt':''}
    </div>`);
}

/* ─── FIXTURES ───────────────────────────────────────────────── */
function renderFixtures() {
  const grid = document.getElementById('fixtures-grid'); if (!grid) return;
  grid.innerHTML = '';
  if (!fixtures.length) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-futbol"></i>No fixtures yet.<br>Use Admin → Generate Fixtures to create matches.</div>`;
    return;
  }
  fixtures.forEach((match, fi) => {
    if (!match.postponedBy) match.postponedBy = null;
    const div = document.createElement('div');
    div.className = 'fixture-card' + (match.ignored ? ' ignored-match' : '');
    div.style.animationDelay = (fi*0.04)+'s';
    const homePhone = getPlayerPhone(match.home);
    const awayPhone = getPlayerPhone(match.away);
    const postponedBadge = match.postponedBy
      ? `<div class="postponed-tag"><i class="fas fa-pause-circle"></i> POSTPONED by ${esc(match.postponedBy)}</div>` : '';
    const resumeBtn = match.postponedBy
      ? `<button class="btn-resume" onclick="unpostponeMatch('${match.id}')"><i class="fas fa-play"></i> Resume</button>` : '';
    const ignoreBtn = !match.postponedBy
      ? `<button class="btn-ignore" onclick="toggleIgnoreMatch('${match.id}')">${match.ignored?'<i class="fas fa-eye"></i> Unignore':'<i class="fas fa-eye-slash"></i> Ignore'}</button>` : '';
    div.innerHTML = `
      <div class="fixture-matchup">
        <div class="fixture-player home-player">
          <div class="fixture-player-name">${esc(match.home)}</div>
          <div class="fixture-player-sub">${esc(homePhone)}</div>
        </div>
        <div class="vs-badge">VS</div>
        <div class="fixture-player away-player">
          <div class="fixture-player-name">${esc(match.away)}</div>
          <div class="fixture-player-sub">${esc(awayPhone)}</div>
        </div>
      </div>
      ${postponedBadge}
      <div class="match-actions">
        <button class="btn-win-home" onclick="resolveMatch('${match.id}','home')">🏆 ${truncate(match.home,9)}</button>
        <button class="btn-match-draw" onclick="resolveMatch('${match.id}','draw')">DRAW</button>
        <button class="btn-win-away" onclick="resolveMatch('${match.id}','away')">🏆 ${truncate(match.away,9)}</button>
      </div>
      <div class="fixture-postpone-row">
        <button class="btn-postpone" onclick="postponeMatch('${match.id}','${esc(match.home)}')"><i class="fas fa-pause"></i> ${truncate(match.home,7)}</button>
        <button class="btn-postpone" onclick="postponeMatch('${match.id}','${esc(match.away)}')"><i class="fas fa-pause"></i> ${truncate(match.away,7)}</button>
        ${resumeBtn}${ignoreBtn}
      </div>`;
    grid.appendChild(div);
  });
}

function getPlayerPhone(username) {
  return players.find(x => x.username===username)?.phone || '';
}

function toggleIgnoreMatch(matchId) {
  const match = fixtures.find(f => String(f.id)===String(matchId)); if (!match) return;
  match.ignored = !match.ignored;
  saveData(); renderFixtures();
  toast(match.ignored ? 'Match ignored for auto-draw' : 'Match un-ignored', match.ignored?'warn':'success');
}

/* ─── RESULTS ────────────────────────────────────────────────── */
let _resultsFilter = '';
function filterResults(q) { _resultsFilter = q.toLowerCase(); renderResults(); }

function renderResults() {
  const list = document.getElementById('results-list'); if (!list) return;
  list.innerHTML = '';
  let filtered = [...results].reverse();
  if (_resultsFilter) filtered = filtered.filter(r =>
    r.home.toLowerCase().includes(_resultsFilter) || r.away.toLowerCase().includes(_resultsFilter));
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-check-double"></i>${_resultsFilter?'No results match search.':'No results recorded yet.'}</div>`;
    return;
  }
  filtered.forEach((r, ri) => {
    const homeWon=r.result==='home', awayWon=r.result==='away', isDraw=r.result==='draw';
    const scoreDisplay = r.homeGoals!==undefined?`${r.homeGoals} — ${r.awayGoals}`:(isDraw?'DRAW':'WIN');
    const sideClass = homeWon?'res-home-win':awayWon?'res-away-win':'res-draw';
    const badges = [];
    if (r.autoWin)  badges.push('<span style="background:rgba(255,149,0,0.1);color:var(--warn);border:1px solid rgba(255,149,0,0.2);border-radius:4px;padding:2px 5px;font-size:0.58rem;font-family:\'JetBrains Mono\',monospace">AUTO-WIN</span>');
    if (r.forfeit)  badges.push('<span style="background:rgba(255,214,10,0.1);color:var(--gold);border:1px solid rgba(255,214,10,0.2);border-radius:4px;padding:2px 5px;font-size:0.58rem;font-family:\'JetBrains Mono\',monospace">FORFEIT</span>');
    if (r.autoDraw) badges.push('<span style="background:rgba(191,90,242,0.1);color:var(--purple);border:1px solid rgba(191,90,242,0.2);border-radius:4px;padding:2px 5px;font-size:0.58rem;font-family:\'JetBrains Mono\',monospace">AUTO-DRAW</span>');
    const specialBadge = badges.join('');
    const evidenceBtn = (r.imageUrl||r.imageDataUrl)
      ? `<button class="result-evidence-btn" onclick="openLightbox('${r.imageUrl||r.imageDataUrl}','${esc(r.home)} ${scoreDisplay} ${esc(r.away)}')"><i class="fas fa-image"></i></button>` : '';
    const div = document.createElement('div');
    div.className = `result-item ${sideClass}`;
    div.style.animationDelay = (ri*0.03)+'s';
    div.innerHTML = `
      <div class="result-side home-side">
        <div class="result-player-name${homeWon?' winner':''}">${esc(r.home)}</div>
        ${homeWon?`<span class="result-badge badge-win">WIN</span>${specialBadge}`:isDraw?'<span class="result-badge badge-draw">DRAW</span>':'<span class="result-badge badge-loss">LOSS</span>'}
      </div>
      <div class="score-box">${scoreDisplay}</div>
      <div class="result-side away-side">
        <div class="result-player-name${awayWon?' winner':''}">${esc(r.away)}</div>
        ${awayWon?`<span class="result-badge badge-win">WIN</span>${specialBadge}`:isDraw?'<span class="result-badge badge-draw">DRAW</span>':'<span class="result-badge badge-loss">LOSS</span>'}
      </div>
      ${evidenceBtn}`;
    list.appendChild(div);
  });
}

/* ─── PLAYER MANAGEMENT ──────────────────────────────────────── */
let _playerFilter = '';
function filterPlayers(q) { _playerFilter = q.toLowerCase(); renderPlayerManagement(); }

function renderPlayerManagement() {
  const tbody = document.getElementById('playerMgmtBody'); if (!tbody) return;
  tbody.innerHTML = '';
  const filtered = _playerFilter
    ? players.filter(p => p.name.toLowerCase().includes(_playerFilter)||p.username.toLowerCase().includes(_playerFilter))
    : players;
  if (!filtered.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="padding:30px;text-align:center;color:var(--muted);font-style:italic">${_playerFilter?'No match':'No players yet'}</td>`;
    tbody.appendChild(tr); return;
  }
  filtered.forEach(p => {
    const realIdx = players.indexOf(p);
    if (p.postponements===undefined) p.postponements=20;
    if (p.suspended===undefined) p.suspended=false;
    const ppLeft = p.postponements;
    const ppColor = ppLeft<=0?'var(--danger)':ppLeft<=3?'var(--warn)':'var(--muted-2)';
    const susBadge = p.suspended?'<span style="font-size:0.58rem;color:var(--danger);font-family:\'JetBrains Mono\',monospace;margin-left:4px">SUSP</span>':'';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="pos-badge pos-n">${realIdx+1}</span></td>
      <td style="${p.suspended?'opacity:0.5':''}">
        <div class="player-cell-name" style="cursor:pointer" onclick="openPlayerProfile('${esc(p.username)}')">${esc(p.name)}${susBadge}</div>
        <div class="player-cell-username">${esc(p.phone||'N/A')}</div>
      </td>
      <td class="hide-sm"><div class="player-cell-username" style="color:var(--text)">${esc(p.username)}</div></td>
      <td class="hide-sm">
        <div style="font-size:0.72rem;font-family:'JetBrains Mono',monospace;color:${ppColor}">${ppLeft}/20</div>
        ${ppLeft<=0?'<div style="font-size:0.58rem;color:var(--danger)">⛔ AUTO-FORFEIT</div>':''}
      </td>
      <td class="hide-xs"><div style="font-size:0.7rem;font-family:'JetBrains Mono',monospace;color:var(--muted)">${p.wins||0}W ${p.draws||0}D ${p.losses||0}L</div></td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="action-btn ${p.suspended?'success':'warn'}" onclick="toggleSuspension(${realIdx})" title="${p.suspended?'Reactivate':'Suspend'}"><i class="fas fa-${p.suspended?'play':'ban'}"></i></button>
          <button class="action-btn danger" onclick="deletePlayer(${realIdx})" title="Remove"><i class="fas fa-trash"></i></button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ─── MATCH ACTIONS ──────────────────────────────────────────── */
function resolveMatch(id, result) {
  const idx = fixtures.findIndex(f => String(f.id)===String(id)); if (idx===-1) return;
  const match = fixtures[idx];
  if (match.postponedBy) { toast('Resume the match first.','error'); return; }
  const homeP = players.find(p=>p.username===match.home);
  const awayP = players.find(p=>p.username===match.away);
  if (!homeP||!awayP) { toast('Player not found','error'); return; }
  homeP.played=(homeP.played||0)+1; awayP.played=(awayP.played||0)+1;
  if (result==='draw') {
    homeP.draws=(homeP.draws||0)+1;homeP.points=(homeP.points||0)+1;
    awayP.draws=(awayP.draws||0)+1;awayP.points=(awayP.points||0)+1;
    addForm(homeP,'D');addForm(awayP,'D');
  } else if (result==='home') {
    homeP.wins=(homeP.wins||0)+1;homeP.points=(homeP.points||0)+3;awayP.losses=(awayP.losses||0)+1;addForm(homeP,'W');addForm(awayP,'L');
  } else {
    awayP.wins=(awayP.wins||0)+1;awayP.points=(awayP.points||0)+3;homeP.losses=(homeP.losses||0)+1;addForm(homeP,'L');addForm(awayP,'W');
  }
  results.push({home:match.home,away:match.away,result,id:Date.now()});
  fixtures.splice(idx,1);
  saveData(); renderAll(); spawnParticles(); toast(`Result logged: ${match.home} vs ${match.away}`,'success');
  Discord.send({type:'result',home:match.home,away:match.away,score:'?-?',result});
}

function postponeMatch(matchId, playerUsername) {
  const match  = fixtures.find(f=>String(f.id)===String(matchId)); if (!match) return;
  const player = players.find(p=>p.username===playerUsername); if (!player) return;
  if (player.postponements===undefined) player.postponements=20;
  if (match.postponedBy) { toast('Match is already postponed','error'); return; }

  if (player.postponements<=0) {
    if (!confirm(`${playerUsername} has used all 20 postponements this season.\nApply AUTO-FORFEIT? Opponent wins 3-0.`)) return;
    const opponent = match.home===playerUsername ? match.away : match.home;
    const oppHome  = match.home===opponent;
    applyScoreToPlayers(match, oppHome?3:0, oppHome?0:3);
    results.push({home:match.home,away:match.away,result:oppHome?'home':'away',homeGoals:oppHome?3:0,awayGoals:oppHome?0:3,id:Date.now(),forfeit:true});
    const fi=fixtures.indexOf(match); if(fi>-1) fixtures.splice(fi,1);
    saveData(); renderAll();
    toast(`Auto-forfeit! ${opponent} wins 3-0`,'error');
    Discord.send({type:'auto_forfeit',player:playerUsername,match:`${match.home} vs ${match.away}`});
    Automation.addLog(`⛔ AUTO-FORFEIT: ${playerUsername} used all postponements — ${opponent} wins 3-0`,'warn');
    return;
  }

  player.postponements--;
  match.postponedBy = playerUsername;
  saveData(); renderAll();
  toast(`Postponed by ${playerUsername} (${player.postponements} remaining)`,'warn');
  Discord.send({type:'postponement',player:playerUsername,match:`${match.home} vs ${match.away}`,remaining:player.postponements});
}

function unpostponeMatch(matchId) {
  const match = fixtures.find(f=>String(f.id)===String(matchId));
  if (!match||!match.postponedBy) return;
  match.postponedBy=null; saveData(); renderAll(); toast('Match resumed','success');
}

/* ─── LOG SCORE ──────────────────────────────────────────────── */
async function logScore() {
  const sel   = document.getElementById('scoreFixtureSelect');
  const hgRaw = document.getElementById('scoreHome').value;
  const agRaw = document.getElementById('scoreAway').value;
  const hg=parseInt(hgRaw), ag=parseInt(agRaw), id=sel.value;
  if (!id)                           { toast('Select a fixture','error'); return; }
  if (hgRaw===''||agRaw===''||isNaN(hg)||isNaN(ag)) { toast('Enter both scores','error'); return; }
  if (hg<0||ag<0)                    { toast('Scores cannot be negative','error'); return; }
  const idx = fixtures.findIndex(f=>String(f.id)===String(id)); if (idx===-1) return;
  const match = fixtures[idx];
  if (match.postponedBy) { toast('Resume the match first.','error'); return; }
  const homeP=players.find(p=>p.username===match.home), awayP=players.find(p=>p.username===match.away);
  if (!homeP||!awayP) { toast('Player data missing','error'); return; }

  homeP.played=(homeP.played||0)+1;awayP.played=(awayP.played||0)+1;
  homeP.gf=(homeP.gf||0)+hg;homeP.ga=(homeP.ga||0)+ag;
  awayP.gf=(awayP.gf||0)+ag;awayP.ga=(awayP.ga||0)+hg;
  let result;
  if (hg>ag)  {result='home';homeP.wins=(homeP.wins||0)+1;homeP.points=(homeP.points||0)+3;awayP.losses=(awayP.losses||0)+1;addForm(homeP,'W');addForm(awayP,'L');}
  else if(ag>hg){result='away';awayP.wins=(awayP.wins||0)+1;awayP.points=(awayP.points||0)+3;homeP.losses=(homeP.losses||0)+1;addForm(homeP,'L');addForm(awayP,'W');}
  else {result='draw';homeP.draws=(homeP.draws||0)+1;homeP.points=(homeP.points||0)+1;awayP.draws=(awayP.draws||0)+1;awayP.points=(awayP.points||0)+1;addForm(homeP,'D');addForm(awayP,'D');}

  const entry = {home:match.home,away:match.away,result,homeGoals:hg,awayGoals:ag,id:Date.now()};
  if (pendingMatchImage) {
    toast('Uploading screenshot…','success');
    const imageUrl = await GH.uploadMatchImage(pendingMatchImage.base64,pendingMatchImage.filename,currentSeason);
    if (imageUrl) entry.imageUrl=imageUrl;
    else if (pendingMatchImage) entry.imageDataUrl=pendingMatchImage.previewUrl;
  }
  results.push(entry);
  fixtures.splice(idx,1);
  clearMatchImage();
  document.getElementById('scoreHome').value='';
  document.getElementById('scoreAway').value='';
  saveData();
  await Discord.send({type:'result',home:match.home,away:match.away,score:`${hg}-${ag}`,result,imageDataUrl:entry.imageDataUrl||entry.imageUrl});
  await autoSyncPublicLeaderboard();
  renderAll(); spawnParticles();
  toast(`Score: ${match.home} ${hg}–${ag} ${match.away}`,'success');
}

function addForm(player, r) {
  if (!player.form) player.form=[];
  player.form.push(r);
  if (player.form.length>10) player.form=player.form.slice(-10);
}

function applyScoreToPlayers(match, hg, ag) {
  const homeP=players.find(p=>p.username===match.home), awayP=players.find(p=>p.username===match.away);
  if (!homeP||!awayP) return;
  homeP.played=(homeP.played||0)+1;awayP.played=(awayP.played||0)+1;
  homeP.gf=(homeP.gf||0)+hg;homeP.ga=(homeP.ga||0)+ag;
  awayP.gf=(awayP.gf||0)+ag;awayP.ga=(awayP.ga||0)+hg;
  if (hg>ag)  {homeP.wins=(homeP.wins||0)+1;homeP.points=(homeP.points||0)+3;awayP.losses=(awayP.losses||0)+1;addForm(homeP,'W');addForm(awayP,'L');}
  else if(ag>hg){awayP.wins=(awayP.wins||0)+1;awayP.points=(awayP.points||0)+3;homeP.losses=(homeP.losses||0)+1;addForm(homeP,'L');addForm(awayP,'W');}
  else{homeP.draws=(homeP.draws||0)+1;homeP.points=(homeP.points||0)+1;awayP.draws=(awayP.draws||0)+1;awayP.points=(awayP.points||0)+1;addForm(homeP,'D');addForm(awayP,'D');}
}

function updateScoreSelect() {
  const sel=document.getElementById('scoreFixtureSelect'); if(!sel) return;
  sel.innerHTML='<option value="">— Select Fixture —</option>';
  fixtures.forEach(f=>{const opt=document.createElement('option');opt.value=f.id;opt.textContent=`${f.home} vs ${f.away}${f.postponedBy?' [POSTPONED]':''}`;sel.appendChild(opt);});
}

/* ─── IMAGE ──────────────────────────────────────────────────── */
function handleMatchImagePick(e) {
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const dataUrl=ev.target.result,base64=dataUrl.split(',')[1],ext=file.name.split('.').pop()||'png';
    const sel=document.getElementById('scoreFixtureSelect');
    const matchLabel=sel?.options[sel.selectedIndex]?.text?.replace(/\s+/g,'_')||'match';
    pendingMatchImage={base64,filename:`${matchLabel}_${Date.now()}.${ext}`,previewUrl:dataUrl};
    document.getElementById('match-image-preview').src=dataUrl;
    document.getElementById('match-image-preview-wrap').style.display='block';
    document.getElementById('matchImageLabel').innerHTML=`<i class="fas fa-check-circle" style="color:var(--success)"></i> Image attached`;
  };
  reader.readAsDataURL(file);
}
function clearMatchImage(){
  pendingMatchImage=null;
  document.getElementById('matchImageInput').value='';
  document.getElementById('match-image-preview-wrap').style.display='none';
  document.getElementById('matchImageLabel').innerHTML=`<i class="fas fa-image"></i> Attach Screenshot (optional)`;
}

/* ─── PLAYERS ────────────────────────────────────────────────── */
function addSinglePlayer(){
  const name=document.getElementById('addName').value.trim();
  const username=document.getElementById('addUsername').value.trim();
  const phone=document.getElementById('addPhone').value.trim();
  if(!name||!username){toast('Name and username required','error');return;}
  if(players.some(p=>p.username===username)){toast('Username already exists','error');return;}
  players.push(mkPlayer(name,username,phone||'N/A'));
  saveData();renderAll();
  ['addName','addUsername','addPhone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast(`${username} added!`,'success');
  Discord.send({type:'player_add',name,username,phone:phone||'N/A',totalPlayers:players.length});
  Automation.addLog(`Player added: ${username}`,'success');
}

function processImport(){
  const file=document.getElementById('playerImport').files[0]; if(!file){toast('Select a file first','error');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    let added=0;
    e.target.result.split('\n').filter(l=>l.trim()).forEach(line=>{
      const parts=line.split(',');
      if(parts.length>=2){
        const username=parts[1].trim();
        if(!players.some(p=>p.username===username)){players.push(mkPlayer(parts[0].trim(),username,parts[2]?.trim()||'N/A'));added++;}
      }
    });
    saveData();renderAll();toast(`Imported ${added} players`,'success');
    Automation.addLog(`Imported ${added} players from file`,'success');
  };
  reader.readAsText(file);
}

function mkPlayer(name,username,phone){
  return{name,username,phone,played:0,wins:0,draws:0,losses:0,points:0,gf:0,ga:0,form:[],postponements:20,suspended:false};
}

function deletePlayer(index){
  if(!confirm(`Remove ${players[index].username} from the league?`)) return;
  const username=players[index].username;
  players.splice(index,1);
  saveData();renderAll();toast('Player removed','success');
  Discord.send({type:'player_remove',username});
}

function toggleSuspension(index){
  const player=players[index];
  player.suspended=!player.suspended;
  saveData();renderAll();
  toast(`${player.username} ${player.suspended?'suspended':'reactivated'}`,player.suspended?'error':'success');
  Discord.send({type:'suspension',player:player.username,suspended:player.suspended});
}

function updatePlayerDatalist(){
  ['player-list-p1','player-list-p2'].forEach(id=>{
    const dl=document.getElementById(id);if(!dl)return;
    dl.innerHTML='';
    players.forEach(p=>{const opt=document.createElement('option');opt.value=p.username;dl.appendChild(opt);});
  });
}
function updatePlayerCount(){const el=document.getElementById('player-count');if(el)el.textContent=players.length;}

/* ─── GENERATE FIXTURES ──────────────────────────────────────── */
function generateDraw(){
  const active=players.filter(p=>!p.suspended);
  if(active.length<2){toast('Need at least 2 active players!','error');return;}
  const mode=document.getElementById('matchday-select')?.value||'random';
  let newF=[];
  if(mode==='roundrobin'){
    for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
      const exists=fixtures.some(f=>(f.home===active[i].username&&f.away===active[j].username)||(f.home===active[j].username&&f.away===active[i].username));
      if(!exists)newF.push({home:active[i].username,away:active[j].username,id:Date.now()+Math.random()});
    }
    for(let i=newF.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[newF[i],newF[j]]=[newF[j],newF[i]];}
  } else {
    const shuffled=[...active].sort(()=>0.5-Math.random());
    for(let i=0;i<shuffled.length-1;i+=2)newF.push({home:shuffled[i].username,away:shuffled[i+1].username,id:Date.now()+i});
  }
  if(!newF.length){toast('No new fixtures to generate','warn');return;}
  fixtures=[...fixtures,...newF];
  saveData();renderAll();switchTab('fixtures');
  toast(`Generated ${newF.length} fixtures`,'success');
  Discord.send({type:'fixture_gen',count:newF.length,mode,by:'Admin',fixtures:newF});
  Automation.addLog(`✅ Admin generated ${newF.length} fixtures (${mode})`,'success');
}

function addManualMatch(){
  const p1=document.getElementById('p1Input')?.value.trim();
  const p2=document.getElementById('p2Input')?.value.trim();
  if(!p1||!p2){toast('Enter both usernames','error');return;}
  if(p1===p2){toast('Players must be different','error');return;}
  fixtures.push({home:p1,away:p2,id:Date.now()});
  saveData();renderAll();
  document.getElementById('p1Input').value='';document.getElementById('p2Input').value='';
  toast(`Fixture: ${p1} vs ${p2}`,'success');
}

/* ─── EVIDENCE GRID ──────────────────────────────────────────── */
function renderEvidenceGrid(){
  const grid=document.getElementById('evidence-grid');if(!grid)return;
  const withImages=results.filter(r=>r.imageUrl||r.imageDataUrl);
  if(!withImages.length){grid.innerHTML='<p style="color:var(--muted);font-size:0.82rem">No evidence images yet.</p>';return;}
  grid.innerHTML='';
  [...withImages].reverse().forEach(r=>{
    const score=r.homeGoals!==undefined?`${r.homeGoals}–${r.awayGoals}`:r.result.toUpperCase();
    const resColor=r.result==='draw'?'var(--gold)':'var(--success)';
    const card=document.createElement('div');card.className='evidence-game-card';
    card.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div><div style="font-size:0.82rem;font-weight:600">${esc(r.home)} vs ${esc(r.away)}</div></div>
        <div style="text-align:right"><div style="font-size:1.05rem;font-weight:700;color:${resColor};font-family:'Bebas Neue'">${score}</div>${r.forfeit?'<div style="font-size:0.6rem;color:var(--gold)">FORFEIT</div>':''}${r.autoDraw?'<div style="font-size:0.6rem;color:var(--purple)">AUTO-DRAW</div>':''}</div>
      </div>
      <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border-2)">
        <img src="${r.imageUrl||r.imageDataUrl}" alt="Match screenshot" style="width:100%;height:110px;object-fit:cover">
        <button onclick="openLightbox('${r.imageUrl||r.imageDataUrl}','${esc(r.home)} ${score} ${esc(r.away)}')" style="position:absolute;bottom:6px;right:6px;background:rgba(4,1,15,0.85);color:#fff;border:none;padding:6px 10px;border-radius:6px;font-size:0.7rem;cursor:pointer;backdrop-filter:blur(8px)"><i class="fas fa-expand"></i> View</button>
      </div>`;
    grid.appendChild(card);
  });
}

/* ─── CALENDAR TAB ───────────────────────────────────────────── */
function renderCalendarTab(){
  window._calFixtureDates=fixtures.map(f=>f.date?new Date(f.date):new Date());
  Calendar.renderCalendar(window._calFixtureDates);
}

/* ─── SEASONS TAB ────────────────────────────────────────────── */
async function renderSeasonsTab(){
  const grid=document.getElementById('seasons-grid');if(!grid)return;
  grid.innerHTML='<div style="color:var(--muted);font-size:0.82rem;padding:20px;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  let seasonsList=['s1'];
  if(GH.isConnected()){const remote=await GH.listSeasons();if(remote.length)seasonsList=remote;}
  const localRaw=Object.keys(localStorage).filter(k=>k.startsWith('eafc_season_')).map(k=>k.replace('eafc_season_',''));
  if(localRaw.length)seasonsList=[...new Set([...seasonsList,...localRaw])];
  grid.innerHTML='';
  seasonsList.sort().forEach(sid=>{
    const isActive=sid===currentSeason;
    const card=document.createElement('div');card.className='season-card'+(isActive?' active-season':'');
    card.innerHTML=`
      <div class="season-icon">${sid.toUpperCase()}</div>
      <div class="season-info">
        <div class="season-name">Season ${sid.replace('s','')}</div>
        <div class="season-meta">EA FC Mobile · Mettlestate</div>
      </div>
      <div>
        <div class="season-status ${isActive?'active':'archived'}">${isActive?'● ACTIVE':'○ ARCHIVED'}</div>
        ${!isActive?`<button class="btn-outline" style="font-size:0.7rem;padding:5px 10px;margin-top:6px" onclick="loadSeason('${sid}')">Load</button>`:''}
      </div>`;
    grid.appendChild(card);
  });
}

async function loadSeason(sid){
  if(!confirm(`Load Season ${sid}? This will overwrite current unsaved data.`)) return;
  currentSeason=sid;localStorage.setItem('eafc_current_season',sid);updateSeasonPill();
  if(GH.isConnected()){
    const remote=await GH.loadRemoteData(sid);
    if(remote){players=remote.players||[];fixtures=remote.fixtures||[];results=remote.results||[];saveLocalOnly();renderAll();toast(`Loaded Season ${sid}!`,'success');return;}
  }
  const localRaw=localStorage.getItem('eafc_season_'+sid);
  if(localRaw){
    try{const data=JSON.parse(localRaw);players=data.players||[];fixtures=data.fixtures||[];results=data.results||[];saveLocalOnly();renderAll();toast(`Loaded Season ${sid} (local)`,'success');}
    catch{toast('Could not load season data','error');}
  } else {
    players=[];fixtures=[];results=[];saveLocalOnly();renderAll();toast(`Started empty Season ${sid}`,'warn');
  }
}

async function startNewSeason(){
  const nextNum=parseInt(currentSeason.replace('s',''))+1;
  const nextSid='s'+nextNum;
  if(!confirm(`Start Season ${nextNum}?\n\nThis will archive Season ${currentSeason.replace('s','')} to GitHub and reset all stats.\nPlayer rosters will be kept.\n\nContinue?`)) return;

  const archiveData=JSON.stringify({players,fixtures,results,archived:true,archivedAt:new Date().toISOString()},null,2);
  localStorage.setItem('eafc_season_'+currentSeason,archiveData);
  if(GH.isConnected()) await GH.archiveSeason(players,fixtures,results,currentSeason);

  // Keep players, reset stats
  const newPlayers=players.map(p=>({...p,played:0,wins:0,draws:0,losses:0,points:0,gf:0,ga:0,form:[],postponements:20,suspended:false}));
  players=newPlayers; fixtures=[]; results=[];
  currentSeason=nextSid;
  localStorage.setItem('eafc_current_season',nextSid);
  saveLocalOnly(); renderAll(); updateSeasonPill();

  toast(`Season ${nextNum} started! Stats reset.`,'success');
  Discord.send({type:'season_start',seasonName:`Season ${nextNum}`,playerCount:players.length,previousSeason:`Season ${nextNum-1}`});
  Automation.addLog(`🏆 New season started: Season ${nextNum}`,'success');
  launchConfetti();
  renderSeasonsTab();
}

/* ─── GITHUB CONFIG ──────────────────────────────────────────── */
async function saveGitHubConfig(){
  const owner=document.getElementById('ghOwner').value.trim();
  const repo=document.getElementById('ghRepo').value.trim();
  const branch=document.getElementById('ghBranch').value.trim()||'main';
  const token=document.getElementById('ghToken').value.trim();
  if(!owner||!repo||!token){toast('Owner, repo, and token required','error');return;}
  const statusEl=document.getElementById('gh-connect-status');
  statusEl.textContent='Testing connection…';statusEl.className='gh-status-msg';
  GH.save(owner,repo,branch,token);
  const test=await GH.testConnection();
  if(!test.ok){statusEl.textContent='✗ '+test.msg;statusEl.className='gh-status-msg gh-status-error';toast('Connection failed: '+test.msg,'error');return;}
  statusEl.textContent='✓ Connected — checking remote data…';statusEl.className='gh-status-msg gh-status-ok';
  const remote=await GH.loadRemoteData(currentSeason);
  if(remote&&(remote.players?.length||remote.fixtures?.length||remote.results?.length)){
    if(remote.players)players=remote.players;if(remote.fixtures)fixtures=remote.fixtures;if(remote.results)results=remote.results;
    saveLocalOnly();renderAll();statusEl.textContent='✓ Loaded '+players.length+' players from GitHub';
    toast('Connected & data loaded!','success');
  } else {
    await GH.syncData(players,fixtures,results,currentSeason);
    statusEl.textContent='✓ Connected — local data pushed';toast('Connected! Data pushed.','success');
  }
  GH.updateStatusUI();
}

function disconnectGitHub(){
  if(!confirm('Disconnect from GitHub? Data stays local.')) return;
  GH.disconnect();document.getElementById('gh-connect-status').textContent='';
  const el=document.getElementById('ghToken');if(el)el.value='';
  toast('GitHub disconnected','success');
}

async function forceSyncToGitHub(){
  if(!GH.isConnected()){toast('Not connected to GitHub','error');return;}
  await GH.syncDataNow(players,fixtures,results,currentSeason);
}

/* ─── PUBLIC LEADERBOARD ─────────────────────────────────────── */
function savePublicRepoConfig(){
  const owner=document.getElementById('pubOwner').value.trim();
  const repo=document.getElementById('pubRepo').value.trim();
  const branch=document.getElementById('pubBranch').value.trim()||'main';
  const token=document.getElementById('pubToken').value.trim();
  if(!owner||!repo||!token){toast('Owner, repo, and token required','error');return;}
  localStorage.setItem('eafc_public_gh',JSON.stringify({owner,repo,branch,token}));
  toast('Public repo config saved!','success');
  const s=document.getElementById('pub-sync-status');
  if(s){s.textContent='✓ Config saved — '+owner+'/'+repo;s.className='gh-status-msg gh-status-ok';}
}

async function pushToPublicLeaderboard(silent=false){
  const raw=localStorage.getItem('eafc_public_gh');
  if(!raw){if(!silent)toast('Configure public repo first','error');return;}
  const cfg=JSON.parse(raw);
  const payload=JSON.stringify({players,fixtures,results,lastUpdated:new Date().toISOString()},null,2);
  try{
    const path='seasons/'+currentSeason+'/league-data.json';
    const ok=await GH.commitFileDirect(cfg.owner,cfg.repo,cfg.branch,cfg.token,path,payload,'Update public leaderboard — '+new Date().toLocaleString('en-ZA'));
    if(!silent){
      const s=document.getElementById('pub-sync-status');
      if(s){s.textContent=ok?'✓ Leaderboard updated!':'✗ Push failed';s.className='gh-status-msg '+(ok?'gh-status-ok':'gh-status-error');}
      toast(ok?'Public leaderboard updated!':'Push failed',ok?'success':'error');
      if(ok) Discord.send({type:'leaderboard_push'});
    }
  }catch(err){if(!silent)toast('Network error','error');}
}

function loadPublicRepoConfigUI(){
  const raw=localStorage.getItem('eafc_public_gh');if(!raw)return;
  const cfg=JSON.parse(raw);
  const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  sv('pubOwner',cfg.owner);sv('pubRepo',cfg.repo);sv('pubBranch',cfg.branch);sv('pubToken',cfg.token);
  const s=document.getElementById('pub-sync-status');
  if(s){s.textContent='✓ Config loaded — '+cfg.owner+'/'+cfg.repo;s.className='gh-status-msg gh-status-ok';}
}

async function autoSyncPublicLeaderboard(){
  if(!localStorage.getItem('eafc_public_gh')) return;
  try{await pushToPublicLeaderboard(true);}catch(e){}
}

/* ─── DATA ───────────────────────────────────────────────────── */
async function saveData(){
  saveLocalOnly();
  if(GH.isConnected()) await GH.syncData(players,fixtures,results,currentSeason);
}
function saveLocalOnly(){
  localStorage.setItem('eafc_players',JSON.stringify(players));
  localStorage.setItem('eafc_fixtures',JSON.stringify(fixtures));
  localStorage.setItem('eafc_results',JSON.stringify(results));
}
function exportData(){
  const blob=new Blob([JSON.stringify({players,fixtures,results},null,2)],{type:'application/json'});
  const link=document.createElement('a');link.download=`Mettlestate_${currentSeason.toUpperCase()}_Backup_${dateStamp()}.json`;
  link.href=URL.createObjectURL(blob);link.click();toast('Backup exported!','success');
}
function clearData(){
  if(!confirm('⚠️ DELETE all players, fixtures, and results. Are you sure?')) return;
  localStorage.removeItem('eafc_players');localStorage.removeItem('eafc_fixtures');localStorage.removeItem('eafc_results');
  players=[];fixtures=[];results=[];renderAll();toast('League reset.','success');
}

/* ─── DISCORD WEBHOOK UI ─────────────────────────────────────── */
async function saveDiscordWebhook(){
  const url=document.getElementById('discordWebhook')?.value.trim();
  if(!url){toast('Paste a webhook URL first','error');return;}
  const statusEl=document.getElementById('discord-status');
  if(statusEl){statusEl.textContent='Testing…';statusEl.className='gh-status-msg';}
  const result=await Discord.test(url);
  if(result.ok){
    Discord.setWebhookUrl(url);
    if(statusEl){statusEl.textContent='✓ Webhook connected & test sent!';statusEl.className='gh-status-msg gh-status-ok';}
    toast('Discord webhook connected!','success');
    Automation.addLog('Discord webhook connected','success');
  } else {
    if(statusEl){statusEl.textContent='✗ '+result.msg;statusEl.className='gh-status-msg gh-status-error';}
    toast('Webhook failed: '+result.msg,'error');
  }
}

/* ─── EXPORT / CAPTURE ───────────────────────────────────────── */
function downloadFixtureImage(){
  if(!fixtures.length){toast('No fixtures to export','error');return;}
  Themes.applyPosterTheme();
  const list=document.getElementById('poster-fixture-list');list.innerHTML='';
  const active=fixtures.filter(f=>!f.postponedBy);
  const postponed=fixtures.filter(f=>f.postponedBy);
  const addHeader=(txt,color)=>{const h=document.createElement('div');h.style.cssText=`text-align:center;padding:9px;margin:10px 0;border-radius:6px;font-weight:700;font-size:0.85rem;letter-spacing:1px;color:${color};border:2px solid ${color}33;background:${color}11`;h.textContent=txt;list.appendChild(h);};
  if(active.length){addHeader('▶ ACTIVE FIXTURES',Themes.getCurrent().accent);active.forEach(f=>list.appendChild(buildPosterRow(f,false)));}
  if(postponed.length){addHeader('⏸ POSTPONED','#FF9500');postponed.forEach(f=>list.appendChild(buildPosterRow(f,true)));}
  captureElement('fixture-capture-area',`Mettlestate_Fixtures_${currentSeason.toUpperCase()}_${dateStamp()}.png`,'Fixtures image downloaded!');
}

function buildPosterRow(f,isPostponed){
  const hp=players.find(p=>p.username===f.home);
  const ap=players.find(p=>p.username===f.away);
  const row=document.createElement('div');row.className='poster-match-row';
  if(isPostponed) row.style.opacity='0.65';
  row.innerHTML=`
    <div class="poster-match-home"><div class="poster-player-name">${esc(hp?hp.name:f.home)}</div><div class="poster-player-details">${hp?hp.phone||'N/A':''} · ${f.home}</div></div>
    <div class="poster-match-vs">${isPostponed?'⏸':'VS'}</div>
    <div class="poster-match-away"><div class="poster-player-name">${esc(ap?ap.name:f.away)}</div><div class="poster-player-details">${ap?ap.phone||'N/A':''} · ${f.away}</div></div>`;
  return row;
}

function downloadLeaderboardImage(){
  if(!players.length){toast('No players to export','error');return;}
  Themes.applyPosterTheme();
  const sorted=sortedPlayers();
  const container=document.getElementById('poster-lb-table');container.innerHTML='';
  const header=document.createElement('div');header.className='poster-lb-header';
  header.innerHTML='<div>#</div><div>PLAYER</div><div>P</div><div>W</div><div>D</div><div>L</div><div>PTS</div>';
  container.appendChild(header);
  sorted.forEach((p,i)=>{
    const rank=i+1;
    const posClass=rank===1?'poster-lb-pos-1':rank===2?'poster-lb-pos-2':rank===3?'poster-lb-pos-3':'';
    const row=document.createElement('div');row.className='poster-lb-row';
    row.innerHTML=`<div class="${posClass}">${rank}</div><div>${esc(p.name)}<div style="font-size:0.78em;color:#888;margin-top:1px">${esc(p.username)}</div></div><div>${p.played||0}</div><div>${p.wins||0}</div><div>${p.draws||0}</div><div>${p.losses||0}</div><div class="poster-lb-pts">${p.points||0}</div>`;
    container.appendChild(row);
  });
  captureElement('lb-capture-area',`Mettlestate_Standings_${currentSeason.toUpperCase()}_${dateStamp()}.png`,'Standings image downloaded!');
}

function downloadRulesImage(){
  const src=document.getElementById('rules-content');
  const dst=document.getElementById('poster-rules-content');
  if(src&&dst) dst.innerHTML=src.innerHTML;
  captureElement('rules-capture-area',`Mettlestate_Rules_${currentSeason.toUpperCase()}.png`,'Rules image downloaded!');
}

function captureElement(elId,filename,successMsg){
  const el=document.getElementById(elId); if(!el) return;
  Themes.applyPosterTheme();
  el.style.cssText='position:fixed;top:0;left:0;visibility:visible;z-index:-1';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    html2canvas(el,{scale:2,useCORS:true,allowTaint:true,backgroundColor:Themes.getPosterpColors().bg,logging:false,
      onclone:doc=>{const c=doc.getElementById(elId);if(c){c.style.visibility='visible';c.style.position='static';c.style.left='0';c.style.top='0';}}
    }).then(canvas=>{
      el.style.cssText='position:absolute;top:0;left:-9999px;z-index:-1;visibility:hidden';
      const link=document.createElement('a');link.download=filename;link.href=canvas.toDataURL('image/png');link.click();
      toast(successMsg,'success');
    }).catch(()=>{
      el.style.cssText='position:absolute;top:0;left:-9999px;z-index:-1;visibility:hidden';
      toast('Export failed. Try again.','error');
    });
  }));
}

/* ─── GEMINI / OCR ───────────────────────────────────────────── */
function saveGeminiApiKey(){
  const key=document.getElementById('geminiApiKey').value.trim();
  const statusEl=document.getElementById('gemini-key-status');
  if(!key){if(statusEl)statusEl.innerHTML='<span style="color:var(--danger)">Please enter an API key</span>';return;}
  localStorage.setItem('gemini_api_key',key);
  if(statusEl)statusEl.innerHTML='<span style="color:var(--success)"><i class="fas fa-check"></i> Saved!</span>';
  document.getElementById('geminiApiKey').value='';
  toast('Gemini API key saved','success');
}
function getGeminiApiKey(){return localStorage.getItem('gemini_api_key');}

async function processWhatsAppOCR(){
  const fileInput=document.getElementById('whatsappImageInput');
  const file=fileInput.files[0]; if(!file){toast('Select a WhatsApp screenshot first','error');return;}
  const apiKey=getGeminiApiKey(); if(!apiKey){toast('Set up your Gemini API key first','error');return;}
  const statusEl=document.getElementById('whatsapp-ocr-status');
  const resultsEl=document.getElementById('whatsapp-ocr-results');
  const btn=document.getElementById('btn-process-whatsapp');
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Processing…';
  statusEl.innerHTML='<div style="color:var(--purple)"><i class="fas fa-spinner fa-spin"></i> Analysing with AI…</div>';
  resultsEl.innerHTML='';
  try{
    const base64=await fileToBase64(file);
    const base64Data=base64.split(',')[1];
    const playerNames=players.map(p=>`${p.name} (username: ${p.username})`).join(', ');
    const fixturesList=fixtures.map(f=>`${f.home} vs ${f.away}`).join(', ');
    const response=await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[
        {text:`You are analyzing a WhatsApp chat screenshot from a South African EA FC Mobile football league.\n\nLEAGUE CONTEXT:\n- Players: ${playerNames}\n- Current fixtures: ${fixturesList}\n\nTASK: Scan this WhatsApp chat and identify:\n1. POSTPONEMENT REQUESTS: Must have "@Tyron" or "@Astral" tag AND contain "postpone","reschedule"\n2. FORFEIT/GIVE-WIN: "take the win","take the W","I forfeit" = 3-0 to opponent\n3. NO-SHOW REPORTS: Must tag "@Tyron" or "@Astral" AND include "no-show","didn't show","never showed"\n4. MATCH RESULTS: Score screenshots with player names\n\nReturn ONLY a JSON object (no markdown, no backticks):\n{"postponements":[{"player":"username","reason":"brief reason"}],"forfeits":[{"forfeitingPlayer":"username","winningPlayer":"username"}],"noShows":[{"reporter":"username","opponent":"username"}],"results":[{"home":"username","away":"username","homeGoals":0,"awayGoals":0}]}\n\nIf nothing found, return empty arrays.`},
        {inline_data:{mime_type:file.type,data:base64Data}}
      ]}]})
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error?.message||'API request failed');
    const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    if(!text) throw new Error('No response from AI');
    let parsedData;
    try{parsedData=JSON.parse(text.replace(/```json\n?|\n?```/g,'').trim());}
    catch(e){throw new Error('Failed to parse AI response');}
    showOCRConfirmation(parsedData,statusEl,resultsEl);
  }catch(error){
    statusEl.innerHTML=`<div style="color:var(--danger)"><i class="fas fa-exclamation-triangle"></i> Error: ${esc(error.message)}</div>`;
  }finally{
    btn.disabled=false;btn.innerHTML='<i class="fas fa-magic"></i> Process Screenshot';
  }
}

function showOCRConfirmation(parsedData,statusEl,resultsEl){
  const uploadedImage=document.getElementById('whatsappImageInput').files[0];
  const total=(parsedData.postponements?.length||0)+(parsedData.forfeits?.length||0)+(parsedData.noShows?.length||0)+(parsedData.results?.length||0);
  if(total===0){statusEl.innerHTML='<div style="color:var(--warn)"><i class="fas fa-info-circle"></i> No events detected.</div>';return;}
  let html=`<div style="background:var(--purple-soft);border:1px solid rgba(191,90,242,0.25);padding:14px;border-radius:var(--r);margin-top:12px">
    <div style="font-size:0.85rem;color:var(--purple);font-weight:600;margin-bottom:12px"><i class="fas fa-check-circle"></i> Detected ${total} item(s) — select which to apply:</div>`;
  if(parsedData.postponements?.length){
    html+=`<div style="margin-bottom:12px"><div style="font-size:0.72rem;font-weight:600;color:var(--warn);margin-bottom:6px;font-family:'JetBrains Mono',monospace;letter-spacing:1px">⏸ POSTPONEMENTS</div>`;
    parsedData.postponements.forEach((p,i)=>{
      const player=players.find(pl=>pl.username===p.player);const rem=player?(player.postponements||0):0;
      html+=`<label style="display:flex;align-items:center;background:rgba(255,149,0,0.07);border:1px solid rgba(255,149,0,0.2);padding:8px;border-radius:var(--r-sm);margin-bottom:4px;font-size:0.78rem;cursor:pointer;gap:8px"><input type="checkbox" class="ocr-checkbox" data-type="postponement" data-index="${i}" checked style="cursor:pointer"><div><strong>${esc(p.player)}</strong> — ${esc(p.reason)} <span style="color:var(--muted)">(${rem}→${Math.max(0,rem-1)} left)</span></div></label>`;
    });html+='</div>';
  }
  if(parsedData.forfeits?.length){
    html+=`<div style="margin-bottom:12px"><div style="font-size:0.72rem;font-weight:600;color:var(--gold);margin-bottom:6px;font-family:'JetBrains Mono',monospace;letter-spacing:1px">🏳 FORFEITS</div>`;
    parsedData.forfeits.forEach((f,i)=>{html+=`<label style="display:flex;align-items:center;background:rgba(255,214,10,0.07);border:1px solid rgba(255,214,10,0.2);padding:8px;border-radius:var(--r-sm);margin-bottom:4px;font-size:0.78rem;cursor:pointer;gap:8px"><input type="checkbox" class="ocr-checkbox" data-type="forfeit" data-index="${i}" checked style="cursor:pointer"><div><strong>${esc(f.forfeitingPlayer)}</strong> forfeits → <strong>${esc(f.winningPlayer)}</strong> wins 3-0</div></label>`;});html+='</div>';
  }
  if(parsedData.noShows?.length){
    html+=`<div style="margin-bottom:12px"><div style="font-size:0.72rem;font-weight:600;color:var(--success);margin-bottom:6px;font-family:'JetBrains Mono',monospace;letter-spacing:1px">⚡ NO-SHOWS</div>`;
    parsedData.noShows.forEach((ns,i)=>{html+=`<label style="display:flex;align-items:center;background:rgba(50,215,75,0.07);border:1px solid rgba(50,215,75,0.2);padding:8px;border-radius:var(--r-sm);margin-bottom:4px;font-size:0.78rem;cursor:pointer;gap:8px"><input type="checkbox" class="ocr-checkbox" data-type="noshow" data-index="${i}" checked style="cursor:pointer"><div><strong>${esc(ns.reporter)}</strong> wins 3-0 vs <strong>${esc(ns.opponent)}</strong></div></label>`;});html+='</div>';
  }
  if(parsedData.results?.length){
    html+=`<div style="margin-bottom:12px"><div style="font-size:0.72rem;font-weight:600;color:var(--accent2);margin-bottom:6px;font-family:'JetBrains Mono',monospace;letter-spacing:1px">⚽ RESULTS</div>`;
    parsedData.results.forEach((r,i)=>{html+=`<label style="display:flex;align-items:center;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);padding:8px;border-radius:var(--r-sm);margin-bottom:4px;font-size:0.78rem;cursor:pointer;gap:8px"><input type="checkbox" class="ocr-checkbox" data-type="result" data-index="${i}" checked style="cursor:pointer"><div><strong>${esc(r.home)}</strong> ${r.homeGoals} – ${r.awayGoals} <strong>${esc(r.away)}</strong></div></label>`;});html+='</div>';
  }
  html+=`<div style="display:flex;gap:8px;margin-top:12px">
    <button onclick="applySelectedOCRChanges()" style="flex:1;background:var(--accent);color:#04010F;border:none;padding:10px;border-radius:var(--r-sm);font-weight:700;cursor:pointer;font-size:0.85rem;font-family:'DM Sans',sans-serif"><i class="fas fa-check"></i> Apply Selected</button>
    <button onclick="cancelOCRChanges()" style="flex:1;background:var(--danger-soft);color:var(--danger);border:1px solid rgba(255,45,85,0.25);padding:10px;border-radius:var(--r-sm);font-weight:600;cursor:pointer;font-size:0.85rem;font-family:'DM Sans',sans-serif"><i class="fas fa-times"></i> Cancel</button>
  </div></div>`;
  statusEl.innerHTML='<div style="color:var(--success)"><i class="fas fa-check-circle"></i> AI analysis complete!</div>';
  resultsEl.innerHTML=html;
  window._ocrPendingData={parsedData,uploadedImage};
}

function cancelOCRChanges(){
  document.getElementById('whatsapp-ocr-results').innerHTML='';
  document.getElementById('whatsapp-ocr-status').innerHTML='<div style="color:var(--muted)"><i class="fas fa-times-circle"></i> Cancelled.</div>';
  window._ocrPendingData=null;
}

async function applySelectedOCRChanges(){
  if(!window._ocrPendingData) return;
  const{parsedData,uploadedImage}=window._ocrPendingData;
  const resultsEl=document.getElementById('whatsapp-ocr-results');
  const statusEl=document.getElementById('whatsapp-ocr-status');
  statusEl.innerHTML='<div style="color:var(--purple)"><i class="fas fa-spinner fa-spin"></i> Applying…</div>';
  const checkboxes=document.querySelectorAll('.ocr-checkbox:checked');
  const selected={postponements:[],forfeits:[],noShows:[],results:[]};
  checkboxes.forEach(cb=>{
    const type=cb.dataset.type,index=parseInt(cb.dataset.index);
    if(type==='postponement'&&parsedData.postponements) selected.postponements.push(parsedData.postponements[index]);
    else if(type==='forfeit'&&parsedData.forfeits) selected.forfeits.push(parsedData.forfeits[index]);
    else if(type==='noshow'&&parsedData.noShows) selected.noShows.push(parsedData.noShows[index]);
    else if(type==='result'&&parsedData.results) selected.results.push(parsedData.results[index]);
  });
  let imageDataUrl=null;
  if(uploadedImage) imageDataUrl=await fileToBase64(uploadedImage);
  let actions=[];
  for(const p of selected.postponements){
    const match=fixtures.find(f=>f.home===p.player||f.away===p.player);
    if(match&&!match.postponedBy){
      const player=players.find(pl=>pl.username===p.player);
      if(player&&(player.postponements||0)>0){
        player.postponements=(player.postponements||20)-1;match.postponedBy=p.player;
        actions.push(`✅ Postponed: ${match.home} vs ${match.away} by ${p.player}`);
        await Discord.send({type:'postponement',player:p.player,match:`${match.home} vs ${match.away}`,remaining:player.postponements});
      } else actions.push(`⚠️ ${p.player} has no postponements left`);
    }
  }
  for(const f of selected.forfeits){
    const match=fixtures.find(m=>(m.home===f.forfeitingPlayer&&m.away===f.winningPlayer)||(m.away===f.forfeitingPlayer&&m.home===f.winningPlayer));
    if(match){
      const winHome=match.home===f.winningPlayer;
      applyScoreToPlayers(match,winHome?3:0,winHome?0:3);
      results.push({home:match.home,away:match.away,result:winHome?'home':'away',homeGoals:winHome?3:0,awayGoals:winHome?0:3,id:Date.now()+Math.random(),forfeit:true,imageDataUrl});
      fixtures.splice(fixtures.indexOf(match),1);
      actions.push(`✅ Forfeit: ${f.winningPlayer} 3-0 ${f.forfeitingPlayer}`);
      await Discord.send({type:'forfeit',winner:f.winningPlayer,forfeiter:f.forfeitingPlayer,score:'3-0',imageDataUrl});
    }
  }
  for(const ns of selected.noShows){
    const match=fixtures.find(m=>(m.home===ns.reporter&&m.away===ns.opponent)||(m.away===ns.reporter&&m.home===ns.opponent));
    if(match){
      const repHome=match.home===ns.reporter;
      applyScoreToPlayers(match,repHome?3:0,repHome?0:3);
      results.push({home:match.home,away:match.away,result:repHome?'home':'away',homeGoals:repHome?3:0,awayGoals:repHome?0:3,id:Date.now()+Math.random(),autoWin:true,imageDataUrl});
      fixtures.splice(fixtures.indexOf(match),1);
      actions.push(`✅ No-show: ${ns.reporter} 3-0 ${ns.opponent}`);
      await Discord.send({type:'noshow',winner:ns.reporter,noshow:ns.opponent,score:'3-0',imageDataUrl});
    }
  }
  for(const r of selected.results){
    const match=fixtures.find(m=>(m.home===r.home&&m.away===r.away)||(m.away===r.home&&m.home===r.away));
    if(match){
      let hg=r.homeGoals,ag=r.awayGoals;
      if(match.away===r.home)[hg,ag]=[ag,hg];
      applyScoreToPlayers(match,hg,ag);
      const matchResult=hg>ag?'home':ag>hg?'away':'draw';
      results.push({home:match.home,away:match.away,result:matchResult,homeGoals:hg,awayGoals:ag,id:Date.now()+Math.random(),imageDataUrl});
      fixtures.splice(fixtures.indexOf(match),1);
      actions.push(`✅ Result: ${match.home} ${hg}-${ag} ${match.away}`);
      await Discord.send({type:'result',home:match.home,away:match.away,score:`${hg}-${ag}`,result:matchResult,imageDataUrl});
    }
  }
  await saveData();await autoSyncPublicLeaderboard();renderAll();
  statusEl.innerHTML='<div style="color:var(--success)"><i class="fas fa-check-circle"></i> Changes applied!</div>';
  resultsEl.innerHTML=`<div style="background:var(--success-soft);border:1px solid rgba(50,215,75,0.25);padding:12px;border-radius:var(--r);margin-top:8px"><div style="font-size:0.82rem;color:var(--success);font-weight:600;margin-bottom:7px">✅ Applied:</div>${actions.map(a=>`<div style="font-size:0.78rem;color:var(--text);margin:3px 0">${a}</div>`).join('')}</div>`;
  toast('OCR changes applied!','success');window._ocrPendingData=null;
}

/* ─── MODAL / LIGHTBOX ───────────────────────────────────────── */
function openModal(html){document.getElementById('modal-body').innerHTML=html;document.getElementById('modal-overlay').classList.add('open');}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
function openLightbox(src,caption){document.getElementById('lightbox-img').src=src;document.getElementById('lightbox-caption').textContent=caption;document.getElementById('lightbox').classList.add('open');}
function closeLightbox(){document.getElementById('lightbox').classList.remove('open');}

/* ─── TOAST ──────────────────────────────────────────────────── */
function toast(msg,type='success'){
  const el=document.getElementById('toast');
  el.textContent=msg;el.className=`toast ${type} show`;
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),3500);
}

/* ─── ACCORDION ──────────────────────────────────────────────── */
function toggleAcc(trigger){
  const item=trigger.closest('.acc-item');const body=item.querySelector('.acc-body');
  const isOpen=item.classList.contains('acc-open');
  item.classList.toggle('acc-open',!isOpen);
  if(isOpen){
    body.style.maxHeight=body.scrollHeight+'px';
    requestAnimationFrame(()=>{body.style.transition='max-height 0.25s ease,opacity 0.2s ease';body.style.maxHeight='0';body.style.opacity='0';});
    setTimeout(()=>{body.style.display='none';body.style.maxHeight='';body.style.opacity='';body.style.transition='';},260);
  }else{
    body.style.display='block';body.style.maxHeight='0';body.style.opacity='0';
    requestAnimationFrame(()=>{body.style.transition='max-height 0.3s ease,opacity 0.25s ease';body.style.maxHeight=body.scrollHeight+'px';body.style.opacity='1';});
    setTimeout(()=>{body.style.maxHeight='';body.style.opacity='';body.style.transition='';},320);
  }
}

/* ─── STARFIELD CANVAS ───────────────────────────────────────── */
function initStarfield(){
  const canvas=document.getElementById('starfield-canvas'); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  let stars=[];
  function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;stars=Array.from({length:120},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*1.5+0.3,o:Math.random(),s:Math.random()*0.003+0.001}));}
  resize();window.addEventListener('resize',resize);
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    stars.forEach(s=>{s.o+=s.s;if(s.o>1||s.o<0)s.s*=-1;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${s.o})`;ctx.fill();});
    requestAnimationFrame(draw);
  }
  draw();
}

/* ─── PARTICLES / CONFETTI ───────────────────────────────────── */
function spawnParticles(){
  const colors=['var(--accent)','var(--accent2)','var(--success)','var(--gold)'];
  for(let i=0;i<12;i++){
    const p=document.createElement('div');p.className='particle';
    const angle=Math.random()*Math.PI*2;const dist=60+Math.random()*80;
    p.style.cssText=`left:50%;top:70%;width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;background:${colors[Math.floor(Math.random()*colors.length)]};--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist-80}px;animation-duration:${0.6+Math.random()*0.4}s`;
    document.body.appendChild(p);setTimeout(()=>p.remove(),1000);
  }
}

function launchConfetti(){
  const colors=['#C8F135','#00E5FF','#FF2D55','#FFD60A','#BF5AF2','#32D74B'];
  for(let i=0;i<60;i++){
    setTimeout(()=>{
      const c=document.createElement('div');c.className='confetti-piece';
      c.style.cssText=`left:${Math.random()*100}vw;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};animation-duration:${2+Math.random()*2}s;animation-delay:${Math.random()*1}s`;
      document.body.appendChild(c);setTimeout(()=>c.remove(),4000);
    },i*30);
  }
}

/* ─── HELPERS ────────────────────────────────────────────────── */
function truncate(str,n){return String(str||'').length>n?String(str).slice(0,n)+'…':String(str||'');}
function dateStamp(){return new Date().toLocaleDateString('en-ZA').replace(/\//g,'-');}
function esc(str){return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('Failed to read file'));r.readAsDataURL(file);});}
function shake(el){if(!el)return;el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');setTimeout(()=>el.classList.remove('shake'),500);}
