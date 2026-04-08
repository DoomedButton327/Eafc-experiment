/* ═══════════════════════════════════════════════════════════════
   METTLESTATE — calendar.js
   South African public holidays (fixed + computed)
   GMT+2 / SAST timezone awareness
   Calendar UI rendering + fixture date highlighting
═══════════════════════════════════════════════════════════════ */

const Calendar = (() => {
  'use strict';

  // ── SA HOLIDAYS (fixed dates every year) ──────────────────────
  const FIXED_HOLIDAYS = [
    { month:1,  day:1,  name:'New Year\'s Day' },
    { month:3,  day:21, name:'Human Rights Day' },
    { month:4,  day:27, name:'Freedom Day' },
    { month:5,  day:1,  name:'Workers\' Day' },
    { month:6,  day:16, name:'Youth Day' },
    { month:8,  day:9,  name:'National Women\'s Day' },
    { month:9,  day:24, name:'Heritage Day' },
    { month:12, day:16, name:'Day of Reconciliation' },
    { month:12, day:25, name:'Christmas Day' },
    { month:12, day:26, name:'Day of Goodwill' },
  ];

  // Easter algorithm (Meeus/Jones/Butcher)
  function getEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function getHolidaysForYear(year) {
    const holidays = [];

    // Fixed holidays
    FIXED_HOLIDAYS.forEach(h => {
      const date = new Date(year, h.month - 1, h.day);
      holidays.push({ date, name: h.name, type: 'statutory' });
      // Observed Monday rule: if Sunday, next Monday is also a holiday
      if (date.getDay() === 0) {
        const observed = new Date(year, h.month - 1, h.day + 1);
        holidays.push({ date: observed, name: h.name + ' (Observed)', type: 'observed' });
      }
    });

    // Easter-based
    const easter = getEaster(year);
    const goodFriday = new Date(easter); goodFriday.setDate(easter.getDate() - 2);
    const familyDay  = new Date(easter); familyDay.setDate(easter.getDate() + 1);
    holidays.push({ date: goodFriday, name: 'Good Friday',  type: 'statutory' });
    holidays.push({ date: familyDay,  name: 'Family Day',   type: 'statutory' });

    return holidays.sort((a, b) => a.date - b.date);
  }

  // ── SAST CLOCK (GMT+2) ─────────────────────────────────────────
  function getSASTNow() {
    const now = new Date();
    // Convert to GMT+2
    const utcMs  = now.getTime() + now.getTimezoneOffset() * 60000;
    const sastMs = utcMs + 2 * 3600000;
    return new Date(sastMs);
  }

  function formatSASTTime(date) {
    return date.toLocaleTimeString('en-ZA', { timeZone:'Africa/Johannesburg', hour:'2-digit', minute:'2-digit' });
  }

  function formatSASTDate(date) {
    return date.toLocaleDateString('en-ZA', { timeZone:'Africa/Johannesburg', weekday:'long', year:'numeric', month:'long', day:'numeric' });
  }

  function isHoliday(date, year) {
    const holidays = getHolidaysForYear(year || date.getFullYear());
    return holidays.find(h =>
      h.date.getFullYear() === date.getFullYear() &&
      h.date.getMonth()    === date.getMonth() &&
      h.date.getDate()     === date.getDate()
    );
  }

  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  // ── CALENDAR RENDER STATE ─────────────────────────────────────
  let _viewYear  = null;
  let _viewMonth = null;

  function renderCalendar(fixturesDates = []) {
    const now = getSASTNow();
    if (_viewYear  === null) _viewYear  = now.getFullYear();
    if (_viewMonth === null) _viewMonth = now.getMonth();

    const year  = _viewYear;
    const month = _viewMonth;
    const holidays = getHolidaysForYear(year);
    const today = getSASTNow();

    // Month/year heading
    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const el = id => document.getElementById(id);
    if (el('cal-month-title')) el('cal-month-title').textContent = monthNames[month] + ' ' + year;

    // Current time display
    if (el('sast-clock')) {
      el('sast-clock').textContent = 'SAST ' + formatSASTTime(today);
    }

    // Build grid
    const grid = el('cal-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();

    // Fixture dates set for quick lookup
    const fixDateSet = new Set(fixturesDates.map(d => {
      const fd = new Date(d);
      return fd.getFullYear() + '-' + fd.getMonth() + '-' + fd.getDate();
    }));

    // Fill previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrev - i;
      const cell = makeCell(day, new Date(year, month - 1, day), holidays, fixDateSet, today, true);
      grid.appendChild(cell);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const cell = makeCell(d, date, holidays, fixDateSet, today, false);
      grid.appendChild(cell);
    }

    // Fill remaining cells
    const totalCells = grid.children.length;
    const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const cell = makeCell(d, new Date(year, month + 1, d), holidays, fixDateSet, today, true);
      grid.appendChild(cell);
    }

    // Holiday list
    renderHolidayList(holidays, today);
    renderUpcomingFixtures();
  }

  function makeCell(dayNum, date, holidays, fixDateSet, today, otherMonth) {
    const div = document.createElement('div');
    div.className = 'calendar-day';
    if (otherMonth) div.classList.add('other-month');

    const isToday = !otherMonth &&
      date.getDate()     === today.getDate() &&
      date.getMonth()    === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const holiday = isHoliday(date, date.getFullYear());
    const weekend = isWeekend(date);
    const fixKey  = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
    const hasFix  = fixDateSet.has(fixKey);

    if (isToday)  div.classList.add('today');
    if (holiday)  div.classList.add('holiday');
    if (weekend && !isToday && !holiday) div.classList.add('weekend');
    if (hasFix)   div.classList.add('has-fixture');

    const numSpan = document.createElement('span');
    numSpan.className = 'cal-num';
    numSpan.textContent = dayNum;
    div.appendChild(numSpan);

    if (holiday && !otherMonth) {
      const dot = document.createElement('span');
      dot.className = 'cal-holiday-dot';
      div.appendChild(dot);
      div.title = holiday.name;
    }

    // Click to show info
    if (!otherMonth) {
      div.style.cursor = 'pointer';
      div.addEventListener('click', () => showDayInfo(date, holiday, hasFix));
    }

    return div;
  }

  function showDayInfo(date, holiday, hasFix) {
    const parts = [];
    const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
    parts.push(date.toLocaleDateString('en-ZA', opts));
    if (holiday) parts.push('🎌 ' + holiday.name);
    if (hasFix)  parts.push('⚽ Fixture scheduled');
    if (isWeekend(date)) parts.push('📅 Weekend');
    // Use the existing toast system
    if (typeof toast === 'function') toast(parts.join(' · '), holiday ? 'warn' : 'success');
  }

  function renderHolidayList(holidays, today) {
    const list = document.getElementById('holiday-list');
    if (!list) return;
    list.innerHTML = '';

    const upcomingHols = holidays.filter(h => h.date >= today).slice(0, 8);
    if (!upcomingHols.length) {
      list.innerHTML = '<div class="holiday-item"><span class="holiday-name" style="color:var(--muted)">No more holidays this year</span></div>';
      return;
    }

    upcomingHols.forEach(h => {
      const item = document.createElement('div');
      item.className = 'holiday-item';
      const isUpcoming = (h.date - today) / 86400000 <= 14;
      item.innerHTML = `
        <span class="holiday-date">${h.date.toLocaleDateString('en-ZA',{day:'2-digit',month:'short'})}</span>
        <span class="holiday-name">${esc(h.name)}</span>
        <span class="holiday-badge ${isUpcoming?'upcoming':'statutory'}">${isUpcoming?'SOON':'STAT'}</span>
      `;
      list.appendChild(item);
    });
  }

  function renderUpcomingFixtures() {
    // Stub - main app will call this with fixture data
    const el = document.getElementById('cal-upcoming-fixtures');
    if (!el) return;
    // Populated by app.js
  }

  function navigate(delta) {
    const now = getSASTNow();
    if (_viewYear === null) { _viewYear = now.getFullYear(); _viewMonth = now.getMonth(); }
    _viewMonth += delta;
    if (_viewMonth < 0)  { _viewMonth = 11; _viewYear--; }
    if (_viewMonth > 11) { _viewMonth = 0;  _viewYear++; }
    renderCalendar(window._calFixtureDates || []);
  }

  function goToday() {
    const now = getSASTNow();
    _viewYear  = now.getFullYear();
    _viewMonth = now.getMonth();
    renderCalendar(window._calFixtureDates || []);
  }

  // Live clock update
  let _clockInterval = null;
  function startClock() {
    if (_clockInterval) clearInterval(_clockInterval);
    _clockInterval = setInterval(() => {
      const t = getSASTNow();
      const el = document.getElementById('sast-clock');
      if (el) el.textContent = 'SAST ' + t.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }, 1000);
  }

  // Exposed utilities
  return {
    getHolidaysForYear,
    getSASTNow,
    formatSASTTime,
    formatSASTDate,
    isHoliday,
    isWeekend,
    renderCalendar,
    navigate,
    goToday,
    startClock,
  };

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
})();
