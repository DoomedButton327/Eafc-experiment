/* ═══════════════════════════════════════════════════════════════
   METTLESTATE — themes.js
   10-Theme System · applies to UI + export posters
═══════════════════════════════════════════════════════════════ */

const Themes = (() => {
  'use strict';

  const THEMES = [
    {
      id: 'default',
      name: 'Acid Dark',
      label: 'ACID',
      bg: '#04010F',
      accent: '#C8F135',
      accent2: '#00E5FF',
      gradient: 'linear-gradient(135deg,#04010F,#070413)',
      swatchColor: '#C8F135',
      swatchBg: '#04010F',
      posterBg: '#07041A',
      emoji: '⚡',
    },
    {
      id: 'crimson',
      name: 'Crimson Blaze',
      label: 'BLAZE',
      bg: '#100005',
      accent: '#FF2D55',
      accent2: '#FF6B35',
      gradient: 'linear-gradient(135deg,#100005,#1C000A)',
      swatchColor: '#FF2D55',
      swatchBg: '#100005',
      posterBg: '#160008',
      emoji: '🔥',
    },
    {
      id: 'ocean',
      name: 'Ocean Deep',
      label: 'OCEAN',
      bg: '#000D1A',
      accent: '#00E5FF',
      accent2: '#00FF94',
      gradient: 'linear-gradient(135deg,#000D1A,#001828)',
      swatchColor: '#00E5FF',
      swatchBg: '#000D1A',
      posterBg: '#001020',
      emoji: '🌊',
    },
    {
      id: 'gold',
      name: 'Royal Gold',
      label: 'ROYAL',
      bg: '#080400',
      accent: '#FFD60A',
      accent2: '#BF5AF2',
      gradient: 'linear-gradient(135deg,#080400,#160E00)',
      swatchColor: '#FFD60A',
      swatchBg: '#080400',
      posterBg: '#0E0800',
      emoji: '👑',
    },
    {
      id: 'cyber',
      name: 'Neon Cyber',
      label: 'CYBER',
      bg: '#000000',
      accent: '#39FF14',
      accent2: '#FF00FF',
      gradient: 'linear-gradient(135deg,#000000,#0A0A0A)',
      swatchColor: '#39FF14',
      swatchBg: '#000000',
      posterBg: '#050505',
      emoji: '🤖',
    },
    {
      id: 'forest',
      name: 'Forest Night',
      label: 'FOREST',
      bg: '#010A02',
      accent: '#32D74B',
      accent2: '#F0A500',
      gradient: 'linear-gradient(135deg,#010A02,#051408)',
      swatchColor: '#32D74B',
      swatchBg: '#010A02',
      posterBg: '#030E04',
      emoji: '🌲',
    },
    {
      id: 'arctic',
      name: 'Arctic Ice',
      label: 'ARCTIC',
      bg: '#020810',
      accent: '#64DFDF',
      accent2: '#E8F4F8',
      gradient: 'linear-gradient(135deg,#020810,#071020)',
      swatchColor: '#64DFDF',
      swatchBg: '#020810',
      posterBg: '#040C18',
      emoji: '❄️',
    },
    {
      id: 'sunset',
      name: 'Sunset Fire',
      label: 'SUNSET',
      bg: '#0F0400',
      accent: '#FF9500',
      accent2: '#FF6161',
      gradient: 'linear-gradient(135deg,#0F0400,#1E0900)',
      swatchColor: '#FF9500',
      swatchBg: '#0F0400',
      posterBg: '#160600',
      emoji: '🌅',
    },
    {
      id: 'midnight',
      name: 'Midnight Purple',
      label: 'NITE',
      bg: '#070010',
      accent: '#BF5AF2',
      accent2: '#FF69B4',
      gradient: 'linear-gradient(135deg,#070010,#0F0020)',
      swatchColor: '#BF5AF2',
      swatchBg: '#070010',
      posterBg: '#0A0018',
      emoji: '🌙',
    },
    {
      id: 'emerald',
      name: 'Emerald Elite',
      label: 'ELITE',
      bg: '#000A08',
      accent: '#00B894',
      accent2: '#FDCB6E',
      gradient: 'linear-gradient(135deg,#000A08,#001A18)',
      swatchColor: '#00B894',
      swatchBg: '#000A08',
      posterBg: '#001210',
      emoji: '💎',
    },
  ];

  let _current = 'default';

  function apply(themeId) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    _current = theme.id;

    // Set data attribute on root
    document.documentElement.setAttribute('data-theme', theme.id === 'default' ? '' : theme.id);

    // Save preference
    localStorage.setItem('eafc_theme', theme.id);

    // Update theme picker UI
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeId === theme.id);
    });

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.bg;

    // Flash transition
    document.body.classList.add('theme-transition');
    setTimeout(() => document.body.classList.remove('theme-transition'), 400);

    return theme;
  }

  function load() {
    const saved = localStorage.getItem('eafc_theme') || 'default';
    apply(saved);
  }

  function getCurrent() {
    return THEMES.find(t => t.id === _current) || THEMES[0];
  }

  function renderPicker(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    THEMES.forEach(theme => {
      const btn = document.createElement('button');
      btn.className = 'theme-btn';
      btn.dataset.themeId = theme.id;
      btn.style.background = theme.gradient;
      btn.style.color = theme.accent;
      btn.style.border = '2px solid ' + theme.accent + '33';
      btn.title = theme.name;
      btn.innerHTML = `
        <div class="theme-preview" style="background:${theme.accent};border-color:${theme.accent2}"></div>
        <span>${theme.label}</span>
      `;
      btn.addEventListener('click', () => apply(theme.id));
      if (theme.id === _current) btn.classList.add('active');
      container.appendChild(btn);
    });
  }

  function getPosterpColors() {
    const theme = getCurrent();
    return { accent: theme.accent, bg: theme.posterBg, accent2: theme.accent2 };
  }

  // Apply poster theme colors to export elements
  function applyPosterTheme() {
    const { accent, bg, accent2 } = getPosterpColors();
    document.querySelectorAll('.export-poster').forEach(el => {
      el.style.background = bg;
    });
    document.querySelectorAll('.poster-top-bar').forEach(el => {
      el.style.background = `linear-gradient(90deg,${accent},${accent2},${accent})`;
    });
    document.querySelectorAll('.poster-title').forEach(el => {
      el.style.color = accent;
    });
    document.querySelectorAll('.poster-match-vs,.poster-lb-pos-1,.poster-lb-pts').forEach(el => {
      el.style.color = accent;
    });
    document.querySelectorAll('.poster-bottom-bar').forEach(el => {
      el.style.background = `linear-gradient(90deg,transparent,${accent},transparent)`;
    });
  }

  return { THEMES, apply, load, getCurrent, renderPicker, getPosterpColors, applyPosterTheme };
})();
