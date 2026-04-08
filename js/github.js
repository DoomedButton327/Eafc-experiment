/* ═══════════════════════════════════════════════════════════════
   METTLESTATE — github.js v4
   Season-aware GitHub sync
   Paths: seasons/s1/league-data.json, seasons/s1/match-images/
═══════════════════════════════════════════════════════════════ */

const GH = {
  config: null,
  _queue: [], _running: false, _shaCache: {},
  _debounceTimer: null, _pendingPayload: null, _hideTimer: null,

  load() {
    const raw = localStorage.getItem('eafc_gh_config');
    this.config = raw ? JSON.parse(raw) : null;
    this.updateStatusUI();
    return !!this.config;
  },

  save(owner, repo, branch, token) {
    this.config = { owner: owner.trim(), repo: repo.trim(), branch: (branch||'main').trim(), token: token.trim() };
    localStorage.setItem('eafc_gh_config', JSON.stringify(this.config));
    this._shaCache = {};
    this.updateStatusUI();
  },

  disconnect() {
    this.config = null; this._shaCache = {};
    localStorage.removeItem('eafc_gh_config');
    this.updateStatusUI();
  },

  isConnected() { return !!(this.config && this.config.owner && this.config.repo && this.config.token); },

  updateStatusUI() {
    const dot   = document.getElementById('gh-status-dot');
    const label = document.getElementById('gh-status-label');
    const btn   = document.getElementById('btn-force-sync');
    if (!dot || !label) return;
    if (this.isConnected()) {
      dot.className = 'status-dot status-ok';
      label.textContent = this.config.owner + '/' + this.config.repo;
      if (btn) btn.style.display = 'block';
      const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      sv('ghOwner', this.config.owner); sv('ghRepo', this.config.repo);
      sv('ghBranch', this.config.branch); sv('ghToken', this.config.token);
    } else {
      dot.className = 'status-dot status-local';
      label.textContent = 'Local';
      if (btn) btn.style.display = 'none';
    }
  },

  showSyncBar(msg) {
    const bar = document.getElementById('sync-bar');
    const msgEl = document.getElementById('sync-msg');
    const icon  = document.getElementById('sync-icon');
    if (!bar) return;
    msgEl.textContent = msg || 'Syncing…';
    icon.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    bar.className = 'sync-bar sync-active';
    bar.classList.remove('hidden');
  },

  hideSyncBar(status, msg) {
    const bar   = document.getElementById('sync-bar');
    const msgEl = document.getElementById('sync-msg');
    const icon  = document.getElementById('sync-icon');
    if (!bar) return;
    if (status === 'ok') {
      icon.innerHTML = '<i class="fas fa-check-circle"></i>';
      msgEl.textContent = msg || 'Saved to GitHub';
      bar.className = 'sync-bar sync-ok';
    } else {
      icon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
      msgEl.textContent = msg || 'Sync failed – data saved locally';
      bar.className = 'sync-bar sync-error';
    }
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => bar.classList.add('hidden'), 4000);
  },

  apiBase() { return 'https://api.github.com/repos/' + this.config.owner + '/' + this.config.repo; },
  headers() { return { 'Authorization': 'token ' + this.config.token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }; },

  async getFileSHA(path) {
    if (this._shaCache[path] !== undefined) return this._shaCache[path];
    try {
      const res = await fetch(this.apiBase() + '/contents/' + path + '?ref=' + this.config.branch, { headers: this.headers() });
      if (res.status === 404) { this._shaCache[path] = null; return null; }
      if (!res.ok) return null;
      const data = await res.json();
      this._shaCache[path] = data.sha || null;
      return this._shaCache[path];
    } catch(e) { return null; }
  },

  _enqueue(job) {
    return new Promise((resolve, reject) => {
      this._queue.push({ job, resolve, reject });
      this._drainQueue();
    });
  },

  async _drainQueue() {
    if (this._running) return;
    if (!this._queue.length) return;
    this._running = true;
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      try { item.resolve(await item.job()); } catch(err) { item.reject(err); }
    }
    this._running = false;
  },

  async commitFile(path, content, commitMsg, isBinary) {
    if (!this.isConnected()) return false;
    return this._enqueue(() => this._doCommit(path, content, commitMsg, isBinary||false, 1));
  },

  async _doCommit(path, content, commitMsg, isBinary, attempt) {
    const sha  = await this.getFileSHA(path);
    const body = { message: commitMsg, branch: this.config.branch, content: isBinary ? content : btoa(unescape(encodeURIComponent(content))) };
    if (sha) body.sha = sha;
    const res = await fetch(this.apiBase() + '/contents/' + path, { method:'PUT', headers: this.headers(), body: JSON.stringify(body) });
    if (res.ok) {
      try { const rd = await res.json(); if (rd?.content?.sha) this._shaCache[path] = rd.content.sha; } catch(e) {}
      return true;
    }
    if (res.status === 409 && attempt < 3) {
      delete this._shaCache[path];
      await this._sleep(400 * attempt);
      return this._doCommit(path, content, commitMsg, isBinary, attempt + 1);
    }
    return false;
  },

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  // ── SEASON-AWARE DATA PATH ─────────────────────────────────────
  getDataPath(season) {
    return 'seasons/' + (season || 'main') + '/league-data.json';
  },

  getImagePath(season, filename) {
    return 'seasons/' + (season || 'main') + '/match-images/' + filename;
  },

  syncData(players, fixtures, results, season) {
    if (!this.isConnected()) return Promise.resolve();
    this._pendingPayload = { players, fixtures, results, season };
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._flushData(), 600);
    return Promise.resolve();
  },

  async _flushData() {
    this._debounceTimer = null;
    if (!this._pendingPayload) return;
    const snap = this._pendingPayload; this._pendingPayload = null;
    this.showSyncBar('Syncing to GitHub…');
    try {
      const payload = JSON.stringify({ players: snap.players, fixtures: snap.fixtures, results: snap.results, lastUpdated: new Date().toISOString() }, null, 2);
      const path = this.getDataPath(snap.season);
      const ok = await this.commitFile(path, payload, 'Update league data — ' + new Date().toLocaleString('en-ZA'));
      this.hideSyncBar(ok ? 'ok' : 'error', ok ? 'Saved to GitHub' : 'Sync failed – data saved locally');
    } catch(err) { this.hideSyncBar('error', 'Sync error'); }
  },

  async syncDataNow(players, fixtures, results, season) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null; this._pendingPayload = null;
    this.showSyncBar('Force syncing…');
    try {
      const payload = JSON.stringify({ players, fixtures, results, lastUpdated: new Date().toISOString() }, null, 2);
      const path = this.getDataPath(season);
      const ok = await this.commitFile(path, payload, 'Force sync — ' + new Date().toLocaleString('en-ZA'));
      this.hideSyncBar(ok ? 'ok' : 'error', ok ? 'Force sync complete' : 'Sync failed');
      return ok;
    } catch(err) { this.hideSyncBar('error', 'Sync error'); return false; }
  },

  async uploadMatchImage(base64Data, filename, season) {
    if (!this.isConnected()) return null;
    this.showSyncBar('Uploading match screenshot…');
    try {
      const path = this.getImagePath(season || 'main', filename);
      const ok = await this.commitFile(path, base64Data, 'Match screenshot: ' + filename, true);
      if (ok) {
        this.hideSyncBar('ok', 'Screenshot saved to GitHub');
        return 'https://raw.githubusercontent.com/' + this.config.owner + '/' + this.config.repo + '/' + this.config.branch + '/' + path;
      }
      this.hideSyncBar('error', 'Image upload failed'); return null;
    } catch(err) { this.hideSyncBar('error', 'Image upload failed'); return null; }
  },

  async loadRemoteData(season) {
    if (!this.isConnected()) return null;
    this.showSyncBar('Loading data from GitHub…');
    try {
      const path = this.getDataPath(season || 'main');
      const res = await fetch(this.apiBase() + '/contents/' + path + '?ref=' + this.config.branch, { headers: this.headers() });
      if (!res.ok) { this.hideSyncBar('ok', 'No remote data yet'); return null; }
      const file = await res.json();
      const decoded = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
      const data = JSON.parse(decoded);
      if (file.sha) this._shaCache[path] = file.sha;
      this.hideSyncBar('ok', 'Data loaded from GitHub');
      return data;
    } catch(err) { this.hideSyncBar('error', 'Could not load remote data'); return null; }
  },

  async listSeasons() {
    if (!this.isConnected()) return [];
    try {
      const res = await fetch(this.apiBase() + '/contents/seasons?ref=' + this.config.branch, { headers: this.headers() });
      if (!res.ok) return [];
      const items = await res.json();
      return items.filter(i => i.type === 'dir').map(i => i.name).sort();
    } catch(e) { return []; }
  },

  async archiveSeason(players, fixtures, results, season) {
    if (!this.isConnected()) return false;
    this.showSyncBar('Archiving season ' + season + '…');
    const payload = JSON.stringify({ players, fixtures, results, archived: true, archivedAt: new Date().toISOString() }, null, 2);
    const path = this.getDataPath(season);
    const ok = await this.commitFile(path, payload, 'Archive season ' + season);
    this.hideSyncBar(ok ? 'ok' : 'error', ok ? 'Season archived!' : 'Archive failed');
    return ok;
  },

  async commitFileDirect(owner, repo, branch, token, path, content, commitMsg) {
    const base = 'https://api.github.com/repos/' + owner + '/' + repo;
    const headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
    let sha = null;
    try { const r = await fetch(base + '/contents/' + path + '?ref=' + branch, { headers }); if (r.ok) { const d = await r.json(); sha = d.sha||null; } } catch(e) {}
    const body = { message: commitMsg, branch, content: btoa(unescape(encodeURIComponent(content))) };
    if (sha) body.sha = sha;
    const res = await fetch(base + '/contents/' + path, { method:'PUT', headers, body: JSON.stringify(body) });
    return res.ok;
  },

  async testConnection() {
    if (!this.isConnected()) return { ok: false, msg: 'Not configured' };
    try {
      const res = await fetch(this.apiBase(), { headers: this.headers() });
      if (res.status === 200) return { ok: true, msg: 'Connected!' };
      if (res.status === 401) return { ok: false, msg: 'Invalid token' };
      if (res.status === 404) return { ok: false, msg: 'Repo not found' };
      return { ok: false, msg: 'GitHub error ' + res.status };
    } catch(e) { return { ok: false, msg: 'Network error' }; }
  },
};
