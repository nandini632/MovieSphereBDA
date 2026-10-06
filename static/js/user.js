/* =========================================================
   MovieSphere — user.js
   User profile analytics with a per-user picker.
   API: GET /api/user/<id>/insights
   Profiles are computed from the configured MovieLens dataset.
   ========================================================= */

(() => {

  /* ---------------------------------------------------------
     1) STATE & ELS
     --------------------------------------------------------- */
  const state = {
    users: [],
    currentUserId: 1,
    charts: {},
  };

  const els = {};

  function cacheEls() {
    els.select    = document.getElementById('userSelect');
    els.avatar    = document.getElementById('profileAvatar');
    els.stats     = document.getElementById('profileStats');
    els.recGrid   = document.getElementById('userRecGrid');
    els.recSub    = document.getElementById('recSubtitle');
  }

  /* ---------------------------------------------------------
     2) HELPERS
     --------------------------------------------------------- */
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function chartDefaults() {
    Chart.defaults.color = '#9CA3AF';
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  }

  const PALETTE = [
    '#E50914', '#F97316', '#FBBF24', '#22C55E', '#38BDF8',
    '#6366F1', '#A855F7', '#EC4899',
  ];

  /* ---------------------------------------------------------
     3) DATA FETCH
     --------------------------------------------------------- */
  async function fetchInsights(userId) {
    const data = await API.getUserInsights(userId);
    if (data && typeof data === 'object' && data.userId) return data;
    throw new Error('User profile is unavailable');
  }

  /* ---------------------------------------------------------
     4) RENDER — HEADER + STATS
     --------------------------------------------------------- */
  function renderHeader(profile) {
    if (els.avatar) els.avatar.textContent = `U${profile.userId}`;
  }

  function renderStats(profile) {
    if (!els.stats) return;

    const stats = [
      { icon: 'fa-clapperboard',   label: 'Movies Rated',       value: profile.moviesRated,                  format: v => String(v) },
      { icon: 'fa-star',           label: 'Avg Rating Given',   value: profile.avgRating,                    format: v => `${v.toFixed(2)} ★` },
      { icon: 'fa-heart',          label: 'Favorite Genre',     value: profile.favoriteGenre,                format: v => v, text: true },
      { icon: 'fa-chart-simple',   label: 'Most Active Genre',  value: profile.mostActiveGenre,              format: v => v, text: true },
    ];

    els.stats.innerHTML = stats.map((s, i) => `
      <article class="profile-stat" style="animation-delay:${i * 50}ms">
        <div class="profile-stat__icon"><i class="fa-solid ${s.icon}" aria-hidden="true"></i></div>
        <div class="profile-stat__value" data-stat="${i}">${s.text ? escapeHtml(s.value) : '0'}</div>
        <div class="profile-stat__label">${escapeHtml(s.label)}</div>
      </article>
    `).join('');

    // Animate numeric counters
    stats.forEach((s, i) => {
      if (s.text) return;
      const node = els.stats.querySelector(`[data-stat="${i}"]`);
      if (!node) return;
      if (Number.isInteger(s.value)) {
        Counter.animate(node, s.value, { formatter: s.format });
      } else {
        animateFloat(node, s.value, s.format);
      }
    });
  }

  function animateFloat(el, target, formatter) {
    if (Utils.prefersReducedMotion()) {
      el.textContent = formatter(target);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    const from = 0;
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatter(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     5) RENDER — CHARTS
     --------------------------------------------------------- */
  function renderFavoriteGenres(profile) {
    const ctx = document.getElementById('chartFavGenres');
    if (!ctx) return;

    const labels = profile.favoriteGenres.map(g => g.genre);
    const data   = profile.favoriteGenres.map(g => g.count);

    const cfg = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: PALETTE,
          borderColor: '#0F1117',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: '#9CA3AF',
              padding: 10,
              boxWidth: 8, boxHeight: 8,
              usePointStyle: true,
              font: { size: 11, weight: '600' },
            },
          },
          tooltip: {
            backgroundColor: '#171A23',
            borderColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleColor: '#F5F5F5',
            bodyColor: '#9CA3AF',
            displayColors: false,
            callbacks: {
              label: c => {
                const total = c.dataset.data.reduce((s, v) => s + v, 0);
                const pct = ((c.raw / total) * 100).toFixed(1);
                return `${c.label}: ${c.raw} movies (${pct}%)`;
              },
            },
          },
        },
      },
    };

    if (state.charts.favGenres) {
      state.charts.favGenres.data = cfg.data;
      state.charts.favGenres.update();
    } else {
      state.charts.favGenres = new Chart(ctx, cfg);
    }
  }

  function renderRatingBehaviour(profile) {
    const ctx = document.getElementById('chartRatingBehaviour');
    if (!ctx) return;

    const labels = ['5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1', '0.5']
      .map(value => `${value} ★`);
    const data = profile.ratingBehaviour;

    const cfg = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#E50914', '#F97316', '#FB923C', '#FBBF24', '#FDE047', '#38BDF8', '#0EA5E9', '#6366F1', '#64748B', '#6B7280'],
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 52,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#171A23',
            borderColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleColor: '#F5F5F5',
            bodyColor: '#9CA3AF',
            displayColors: false,
            callbacks: {
              label: c => {
                const total = c.dataset.data.reduce((s, v) => s + v, 0);
                const pct = ((c.raw / total) * 100).toFixed(1);
                return `${c.raw} ratings (${pct}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#9CA3AF' },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            border: { display: false },
            ticks: { color: '#6B7280' },
          },
        },
      },
    };

    if (state.charts.ratingBehaviour) {
      state.charts.ratingBehaviour.data = cfg.data;
      state.charts.ratingBehaviour.update();
    } else {
      state.charts.ratingBehaviour = new Chart(ctx, cfg);
    }
  }

  /* ---------------------------------------------------------
     6) RENDER — RECOMMENDATIONS
     --------------------------------------------------------- */
  async function renderRecommendations(profile) {
    if (!els.recGrid) return;

    let ranked = [];
    try {
      const res = await fetch(`/api/user/${profile.userId}/recommendations?limit=6`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) ranked = data;
      }
    } catch { /* leave the analytics view available without model artifacts */ }

    if (!ranked.length) {
      els.recGrid.innerHTML = `
        <div class="state" style="grid-column:1/-1">
          <div class="state__icon"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></div>
          <p class="state__title">ALS results are not available</p>
          <p class="state__text">Run the Spark ALS job, verify its artifacts, then enable them with MOVIESPHERE_USE_ALS=1.</p>
        </div>`;
      return;
    }

    MovieCard.renderGrid(els.recGrid, ranked);

    if (els.recSub) {
      els.recSub.textContent =
        `ALS collaborative filtering · ${profile.displayName} · ${profile.moviesRated} rated movies · ` +
        `average score ${profile.avgRating.toFixed(2)} / 5`;
    }
}

  /* ---------------------------------------------------------
     7) ORCHESTRATION
     --------------------------------------------------------- */
  async function loadUser(userId) {
    state.currentUserId = Number(userId) || 1;

    // Loading state on the picker + skeletons
    const picker = document.querySelector('.user-picker');
    picker?.classList.add('is-loading');

    els.stats.innerHTML = `
      <div class="skeleton skeleton--kpi"></div>
      <div class="skeleton skeleton--kpi"></div>
      <div class="skeleton skeleton--kpi"></div>
      <div class="skeleton skeleton--kpi"></div>`;

    els.recGrid.innerHTML = Array.from({ length: 6 }).map(() =>
      `<div class="skeleton skeleton--card"></div>`
    ).join('');

    try {
      const profile = await fetchInsights(state.currentUserId);

      renderHeader(profile);
      renderStats(profile);
      renderFavoriteGenres(profile);
      renderRatingBehaviour(profile);
      await renderRecommendations(profile);

      // Persist in URL so refresh keeps the chosen user
      const url = new URL(location.href);
      url.searchParams.set('user', profile.userId);
      history.replaceState(null, '', url);
    } catch (error) {
      els.stats.innerHTML = `
        <div class="state" style="grid-column:1/-1">
          <div class="state__icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
          <p class="state__title">Unable to load this dataset profile</p>
          <p class="state__text">${escapeHtml(error.message || 'Please try again.')}</p>
        </div>`;
      els.recGrid.innerHTML = '';
    } finally {
      picker?.classList.remove('is-loading');
    }
  }

  /* ---------------------------------------------------------
     8) PICKER
     --------------------------------------------------------- */
  async function buildPicker() {
    if (!els.select) return [];
    els.select.innerHTML = '<option value="">Loading dataset users…</option>';

    const response = await fetch('/api/users');
    if (!response.ok) throw new Error(`User directory unavailable (${response.status})`);
    const directory = await response.json();
    state.users = Array.isArray(directory.users) ? directory.users : [];
    if (!state.users.length) throw new Error('No users are present in the loaded dataset');

    els.select.innerHTML = state.users.map(user =>
      `<option value="${Number(user.userId)}">User #${Number(user.userId)} · ${Number(user.ratingsCount).toLocaleString()} ratings</option>`
    ).join('');
    els.select.addEventListener('change', e => loadUser(e.target.value));
    return state.users;
  }

  /* ---------------------------------------------------------
     9) INIT
     --------------------------------------------------------- */
  async function init() {
    if (!document.getElementById('profileStats')) return;
    if (!window.Chart) {
      console.warn('Chart.js not loaded');
      return;
    }

    cacheEls();
    chartDefaults();
    try {
      const users = await buildPicker();
      const url = new URL(location.href);
      const requested = Number(url.searchParams.get('user'));
      const initial = users.some(user => user.userId === requested)
        ? requested
        : users[0].userId;
      if (els.select) els.select.value = String(initial);
      await loadUser(initial);
    } catch (error) {
      if (els.select) els.select.innerHTML = '<option value="">Dataset unavailable</option>';
      els.stats.innerHTML = `
        <div class="state" style="grid-column:1/-1">
          <div class="state__icon"><i class="fa-solid fa-database" aria-hidden="true"></i></div>
          <p class="state__title">MovieLens data is unavailable</p>
          <p class="state__text">${escapeHtml(error.message)}. Check MOVIELENS_DIR and make sure movies.csv and ratings.csv are present.</p>
        </div>`;
      els.recGrid.innerHTML = '';
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
