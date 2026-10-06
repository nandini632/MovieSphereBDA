/* MovieSphere EDA: charts and summaries are backed by the Flask analytics API. */
(() => {
  const COLORS = {
    accent: '#E50914', orange: '#F97316', yellow: '#FBBF24', green: '#22C55E',
    blue: '#38BDF8', violet: '#8B5CF6', text: '#9CA3AF', dim: '#6B7280',
    grid: 'rgba(255,255,255,0.06)', tooltip: '#171A23',
  };
  const PALETTE = [COLORS.accent, COLORS.orange, COLORS.yellow, COLORS.green,
    COLORS.blue, COLORS.violet, '#EC4899', '#14B8A6', '#A3E635', '#94A3B8'];
  const number = new Intl.NumberFormat('en-US');
  const state = {
    filters: { genre: '', decade: '', rating: 0 },
    options: { genres: [], decades: [] },
    charts: {}, data: null, controller: null,
  };
  const els = {};

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);

  function baseOptions({ horizontal = false } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: COLORS.tooltip, borderColor: 'rgba(255,255,255,.12)',
          borderWidth: 1, padding: 11, titleColor: '#fff', bodyColor: COLORS.text,
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: COLORS.text } },
        y: { grid: { color: COLORS.grid }, border: { display: false }, ticks: { color: COLORS.dim } },
      },
    };
  }

  function draw(key, id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (state.charts[key]) {
      state.charts[key].data = config.data;
      state.charts[key].options = config.options;
      state.charts[key].update();
    } else {
      state.charts[key] = new Chart(canvas, config);
    }
  }

  function renderCharts(data) {
    const charts = data.charts;
    const dist = charts.ratingDistribution;
    const distributionOptions = baseOptions();
    distributionOptions.plugins.tooltip.callbacks = {
      label: item => `${number.format(item.raw)} observed ratings`,
    };
    draw('distribution', 'chartDistribution', {
      type: 'bar',
      data: { labels: dist.labels, datasets: [{
        data: dist.values, backgroundColor: PALETTE, borderRadius: 5,
        borderSkipped: false, maxBarThickness: 34,
      }] },
      options: distributionOptions,
    });

    const genre = charts.moviesByGenre.slice(0, 10);
    draw('genre', 'chartDonut', {
      type: 'doughnut',
      data: { labels: genre.map(row => row.genre), datasets: [{
        data: genre.map(row => row.count), backgroundColor: PALETTE,
        borderColor: '#0F1117', borderWidth: 2, hoverOffset: 5,
      }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { display: true, position: 'right', labels: {
            color: COLORS.text, padding: 11, boxWidth: 8, usePointStyle: true,
            font: { size: 11, weight: '600' },
          } },
          tooltip: { backgroundColor: COLORS.tooltip, padding: 11,
            callbacks: { label: item => `${item.label}: ${number.format(item.raw)} movies` } },
        },
      },
    });

    const avgRows = [...charts.avgRatingByGenre].sort((a, b) => a.avgRating - b.avgRating);
    const avgOptions = baseOptions({ horizontal: true });
    avgOptions.scales.x = { min: 0, max: 5, grid: { color: COLORS.grid },
      border: { display: false }, ticks: { color: COLORS.dim, stepSize: 1 } };
    avgOptions.plugins.tooltip.callbacks = {
      label: item => {
        const row = avgRows[item.dataIndex];
        return `${item.raw.toFixed(2)} stars · ${number.format(row.ratingsCount)} ratings`;
      },
    };
    draw('avgGenre', 'chartAvgGenre', {
      type: 'bar', data: { labels: avgRows.map(row => row.genre), datasets: [{
        data: avgRows.map(row => row.avgRating), backgroundColor: COLORS.accent,
        borderRadius: 5, borderSkipped: false, maxBarThickness: 20,
      }] }, options: avgOptions,
    });

    const popular = charts.mostRatedMovies.slice().reverse();
    const mostOptions = baseOptions({ horizontal: true });
    mostOptions.plugins.tooltip.callbacks = {
      label: item => `${number.format(item.raw)} ratings · average ${popular[item.dataIndex].avgRating.toFixed(2)}`,
    };
    mostOptions.scales.y.ticks = { color: COLORS.text, font: { size: 10 },
      callback(value) {
        const title = this.getLabelForValue(value);
        return title.length > 31 ? `${title.slice(0, 29)}…` : title;
      } };
    draw('mostRated', 'chartMostRated', {
      type: 'bar', data: { labels: popular.map(row => row.title), datasets: [{
        data: popular.map(row => row.ratingsCount), backgroundColor: COLORS.blue,
        borderRadius: 5, borderSkipped: false, maxBarThickness: 17,
      }] }, options: mostOptions,
    });

    const decades = charts.moviesByDecade;
    draw('decade', 'chartByDecade', {
      type: 'bar', data: { labels: decades.map(row => row.decade), datasets: [{
        data: decades.map(row => row.count), backgroundColor: COLORS.violet,
        borderRadius: 5, borderSkipped: false, maxBarThickness: 30,
      }] }, options: baseOptions(),
    });

    const activity = charts.ratingActivity;
    const activityOptions = baseOptions();
    activityOptions.plugins.tooltip.callbacks = {
      label: item => `${number.format(item.raw)} ratings`,
    };
    draw('activity', 'chartActivity', {
      type: 'line', data: { labels: activity.map(row => row.year), datasets: [{
        data: activity.map(row => row.count), borderColor: COLORS.accent,
        backgroundColor: 'rgba(229,9,20,.14)', fill: true, tension: 0.28,
        pointRadius: 3, pointHoverRadius: 5,
      }] }, options: activityOptions,
    });

    draw('userActivity', 'chartUserActivity', {
      type: 'bar', data: { labels: charts.userActivity.map(row => row.range), datasets: [{
        data: charts.userActivity.map(row => row.count), backgroundColor: COLORS.green,
        borderRadius: 5, borderSkipped: false, maxBarThickness: 36,
      }] }, options: baseOptions(),
    });

    draw('weekday', 'chartWeekday', {
      type: 'bar', data: { labels: charts.ratingWeekday.map(row => row.weekday), datasets: [{
        data: charts.ratingWeekday.map(row => row.count), backgroundColor: COLORS.orange,
        borderRadius: 5, borderSkipped: false, maxBarThickness: 30,
      }] }, options: baseOptions(),
    });

    const points = charts.ratingPopularity;
    const popularityOptions = baseOptions();
    popularityOptions.scales.x = {
      type: 'logarithmic', min: 1, grid: { color: COLORS.grid }, border: { display: false },
      title: { display: true, text: 'Number of ratings (log scale)', color: COLORS.text },
      ticks: { color: COLORS.dim },
    };
    popularityOptions.scales.y = {
      min: 0, max: 5, grid: { color: COLORS.grid }, border: { display: false },
      title: { display: true, text: 'Average movie rating', color: COLORS.text },
      ticks: { color: COLORS.dim },
    };
    popularityOptions.plugins.tooltip.callbacks = {
      title: items => items.length ? points[items[0].dataIndex].title : '',
      label: item => {
        const movie = points[item.dataIndex];
        return `${movie.avgRating.toFixed(2)} stars · ${number.format(movie.ratingsCount)} ratings`;
      },
    };
    popularityOptions.onClick = (_event, elements) => {
      if (!elements.length) return;
      const movie = points[elements[0].index];
      window.location.href = `/movie/${movie.id}`;
    };
    draw('popularity', 'chartPopularity', {
      type: 'scatter',
      data: { datasets: [{
        data: points.map(movie => ({ x: movie.ratingsCount, y: movie.avgRating })),
        pointRadius: 4, pointHoverRadius: 6,
        backgroundColor: context => {
          const point = points[context.dataIndex];
          return point.avgRating >= 4 ? COLORS.green : point.avgRating >= 3 ? COLORS.orange : COLORS.accent;
        },
      }] },
      options: popularityOptions,
    });
  }

  function renderKpis(summary) {
    const items = [
      { label: 'Ratings in view', value: number.format(summary.ratings), icon: 'fa-database' },
      { label: 'Movies in view', value: number.format(summary.movies), icon: 'fa-film' },
      { label: 'Active users', value: number.format(summary.users), icon: 'fa-users' },
      { label: 'Genres represented', value: number.format(summary.genres), icon: 'fa-tags' },
      { label: 'Weighted average', value: `${Number(summary.averageRating).toFixed(2)} / 5`, icon: 'fa-star' },
    ];
    els.kpis.innerHTML = items.map((item, index) => `
      <article class="kpi-card" style="animation-delay:${index * 45}ms">
        <div class="kpi-card__icon"><i class="fa-solid ${item.icon}" aria-hidden="true"></i></div>
        <div class="kpi-card__value">${esc(item.value)}</div>
        <div class="kpi-card__label">${esc(item.label)}</div>
      </article>`).join('');
  }

  function renderHeatmap(heatmap) {
    const host = document.getElementById('genreHeatmap');
    if (!heatmap.genres.length) {
      host.innerHTML = '<p class="eda-empty">No ratings match these filters.</p>';
      return;
    }
    const max = Math.max(1, ...heatmap.values.flat());
    const table = document.createElement('table');
    table.className = 'eda-heatmap';
    table.setAttribute('aria-label', 'Observed rating counts by genre and half-star score');
    const head = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col'; corner.textContent = 'Genre'; headerRow.appendChild(corner);
    heatmap.ratings.forEach(rating => {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = rating;
      headerRow.appendChild(th);
    });
    head.appendChild(headerRow); table.appendChild(head);
    const body = document.createElement('tbody');
    heatmap.genres.forEach((genreName, rowIndex) => {
      const row = document.createElement('tr');
      const name = document.createElement('th'); name.scope = 'row'; name.textContent = genreName;
      row.appendChild(name);
      heatmap.values[rowIndex].forEach((count, columnIndex) => {
        const cell = document.createElement('td');
        const intensity = count ? 0.10 + (Math.log1p(count) / Math.log1p(max)) * 0.72 : 0;
        cell.style.backgroundColor = count ? `rgba(56,189,248,${intensity.toFixed(3)})` : 'transparent';
        cell.textContent = count ? number.format(count) : '·';
        cell.title = `${genreName}: ${count.toLocaleString()} ratings at ${heatmap.ratings[columnIndex]} stars`;
        cell.setAttribute('aria-label', cell.title);
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.appendChild(body);
    host.replaceChildren(table);
  }

  function renderTables(data) {
    const rows = data.tables.highestRatedMovies;
    const body = document.getElementById('topRatedMovies');
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4">No titles meet the 20-rating minimum.</td></tr>';
    } else {
      body.innerHTML = rows.map(row => `
        <tr>
          <td><a href="/movie/${Number(row.id)}">${esc(row.title)}</a></td>
          <td><span class="eda-score"><i class="fa-solid fa-star" aria-hidden="true"></i> ${Number(row.avgRating).toFixed(2)}</span></td>
          <td>${Number(row.adjustedRating).toFixed(3)}</td>
          <td>${number.format(row.ratingsCount)}</td>
        </tr>`).join('');
    }

    const controversial = data.tables.controversialMovies;
    const controversialBody = document.getElementById('controversialMovies');
    controversialBody.innerHTML = controversial.length
      ? controversial.map(row => `
        <tr>
          <td><a href="/movie/${Number(row.id)}">${esc(row.title)}</a></td>
          <td>${Number(row.avgRating).toFixed(2)}</td>
          <td>${Number(row.ratingStdDev).toFixed(3)}</td>
          <td>${number.format(row.ratingsCount)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4">No titles meet the 20-rating minimum.</td></tr>';

    const tags = data.tables.popularTags;
    document.getElementById('popularTags').innerHTML = tags.length
      ? tags.map((item, index) => `<span class="eda-tag" style="--tag-order:${index}">
          <span>${esc(item.tag)}</span><small>${number.format(item.count)}</small>
        </span>`).join('')
      : '<p class="eda-empty">No community tags in this view.</p>';

    const quality = data.quality;
    const checks = [
      ['Missing rating fields', quality.missingValues],
      ['Duplicate user/movie pairs', quality.duplicateUserMoviePairs],
      ['Ratings without a movie', quality.ratingsWithoutMovie],
      ['Invalid rating values', quality.invalidRatings],
      ['Movie rating coverage', `${Number(quality.ratedMovieCoveragePct).toFixed(1)}%`],
    ];
    document.getElementById('dataQuality').innerHTML = checks.map(([label, value]) => `
      <div class="eda-quality__row"><span>${esc(label)}</span><strong>${esc(numberOrText(value))}</strong></div>`).join('');

    const stats = data.ratingStats;
    const ratingRows = [
      ['Mean', Number(stats.mean).toFixed(3)],
      ['Median', Number(stats.median).toFixed(2)],
      ['Standard deviation', Number(stats.stdDev).toFixed(3)],
      ['25th–75th percentile', `${Number(stats.q1).toFixed(2)} – ${Number(stats.q3).toFixed(2)}`],
      ['90th percentile', Number(stats.p90).toFixed(2)],
      ['Ratings ≥ 4 stars', `${Number(stats.fourPlusPct).toFixed(1)}%`],
      ['Most common score', stats.mode == null ? '—' : `${Number(stats.mode).toFixed(1)} stars`],
    ];
    document.getElementById('ratingProfile').innerHTML = ratingRows.map(([label, value]) => `
      <div class="eda-quality__row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');

    const correlationLabels = {
      popularityVsAverageRating: 'Rating count ↔ average score',
      releaseYearVsAverageRating: 'Release year ↔ average score',
    };
    document.getElementById('correlationSummary').innerHTML = Object.entries(data.correlations).map(([key, item]) => `
      <div class="eda-correlation">
        <strong>${esc(correlationLabels[key] || key)}</strong>
        <span>Pearson <b>${formatCorrelation(item.pearson)}</b> · Spearman <b>${formatCorrelation(item.spearman)}</b></span>
        <small>${number.format(item.sampleSize)} rated movies</small>
      </div>`).join('');
  }

  function formatCorrelation(value) {
    return value == null ? 'n/a' : Number(value).toFixed(3);
  }

  function numberOrText(value) {
    return typeof value === 'number' ? number.format(value) : String(value);
  }

  function renderInsights(items) {
    els.insights.innerHTML = items.map(item => `
      <article class="key-insight">
        <span class="key-insight__icon"><i class="fa-solid ${esc(item.icon)}" aria-hidden="true"></i></span>
        <p class="key-insight__text"><strong>${esc(item.title)}.</strong> ${esc(item.text)}</p>
      </article>`).join('');
  }

  function renderMeta(source, summary) {
    const range = source.ratingDateRange || [];
    const rangeText = range.length === 2 ? `Rating timestamps: ${range[0]} to ${range[1]} (UTC)` : '';
    document.getElementById('edaMeta').innerHTML = `
      <span class="eda-meta__pulse" aria-hidden="true"></span>
      <strong>${esc(source.dataset)}</strong>
      <span>${number.format(source.ratingRows)} source ratings</span>
      <span>${esc(source.engine)} analysis</span>
      <span>${number.format(summary.ratings)} ratings in current view</span>
      ${rangeText ? `<span>${esc(rangeText)}</span>` : ''}`;
  }

  function render(data) {
    state.data = data;
    state.options = data.filters;
    renderKpis(data.summary);
    renderMeta(data.source, data.summary);
    renderCharts(data);
    renderHeatmap(data.heatmap);
    renderTables(data);
    renderInsights(data.insights);
    updatePills();
  }

  async function loadData() {
    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    const controller = state.controller;
    const meta = document.getElementById('edaMeta');
    meta.classList.add('is-loading');
    const query = new URLSearchParams();
    if (state.filters.genre) query.set('genre', state.filters.genre);
    if (state.filters.decade) query.set('decade', state.filters.decade);
    if (state.filters.rating) query.set('min_rating', state.filters.rating);
    try {
      const response = await fetch(`/api/analytics/eda?${query.toString()}`, {
        headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load analytics.');
      render(payload);
      meta.classList.remove('has-error');
    } catch (error) {
      if (error.name === 'AbortError') return;
      meta.textContent = error.message || 'Unable to load analytics.';
      meta.classList.add('has-error');
      els.kpis.innerHTML = `<div class="state eda-error" style="grid-column:1/-1">
        <div class="state__icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
        <p class="state__title">EDA data could not be loaded</p>
        <p class="state__text">${esc(error.message || 'Check that the MovieLens dataset is available.')}</p>
      </div>`;
    } finally {
      if (state.controller === controller && !controller.signal.aborted) meta.classList.remove('is-loading');
    }
  }

  const filterOptions = {
    genre: () => [
      { label: 'All genres', value: '' },
      ...state.options.genres.map(value => ({ label: value, value })),
    ],
    decade: () => [
      { label: 'Any release decade', value: '' },
      ...state.options.decades,
    ],
    rating: () => [
      { label: 'Any average score', value: '0' },
      ...[3, 3.5, 4, 4.5].map(value => ({ label: `Movie average ≥ ${value.toFixed(1)}`, value: String(value) })),
    ],
  };

  const filterLabels = {
    genre: 'Genre', decade: 'Release decade', rating: 'Movie score',
  };

  function openMenu(kind, button) {
    const menu = document.querySelector(`.filter-menu[data-menu="${kind}"]`);
    if (!menu || !filterOptions[kind]) return;
    const selected = kind === 'rating' ? String(state.filters.rating) : state.filters[kind];
    menu.innerHTML = filterOptions[kind]().map(option => `
      <button class="filter-menu__item ${String(option.value) === String(selected) ? 'is-selected' : ''}"
              type="button" role="option" aria-selected="${String(option.value) === String(selected)}"
              data-value="${esc(option.value)}">
        <span>${esc(option.label)}</span>
        ${String(option.value) === String(selected) ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : ''}
      </button>`).join('');
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }

  function closeMenus() {
    document.querySelectorAll('.filter-menu').forEach(menu => { menu.hidden = true; });
    document.querySelectorAll('#analyticsFilters [data-filter]').forEach(button => {
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function updatePills() {
    const labels = {
      genre: state.filters.genre || filterLabels.genre,
      decade: state.options.decades.find(option => option.value === state.filters.decade)?.label || filterLabels.decade,
      rating: state.filters.rating ? `Avg ≥ ${Number(state.filters.rating).toFixed(1)}` : filterLabels.rating,
    };
    Object.entries(labels).forEach(([kind, label]) => {
      const pill = document.querySelector(`.filter-pill[data-filter="${kind}"]`);
      if (!pill) return;
      pill.querySelector('.filter-pill__value').textContent = label;
      pill.classList.toggle('has-value', !!state.filters[kind]);
    });
    const all = document.querySelector('.filter-pill[data-filter="all"]');
    all?.classList.toggle('is-active', !state.filters.genre && !state.filters.decade && !state.filters.rating);
  }

  function bindFilters() {
    els.filters.addEventListener('click', event => {
      const pill = event.target.closest('.filter-pill');
      if (pill) {
        const kind = pill.dataset.filter;
        if (kind === 'all') {
          state.filters = { genre: '', decade: '', rating: 0 };
          closeMenus(); updatePills(); loadData(); return;
        }
        if (!filterOptions[kind]) return;
        const menu = pill.parentElement.querySelector('.filter-menu');
        const shouldOpen = menu?.hidden;
        closeMenus();
        if (shouldOpen) openMenu(kind, pill);
        return;
      }
      const option = event.target.closest('.filter-menu__item');
      if (!option) return;
      const kind = option.closest('.filter-menu').dataset.menu;
      if (kind === 'rating') state.filters.rating = Number(option.dataset.value) || 0;
      else state.filters[kind] = option.dataset.value;
      closeMenus(); updatePills(); loadData();
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.analytics-filters')) closeMenus();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenus(); });
    document.getElementById('exportEda').addEventListener('click', exportCsv);
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const data = state.data;
    if (!data) return;
    const rows = [['section', 'rank', 'item', 'value', 'details']];
    Object.entries(data.summary).forEach(([key, value]) => rows.push(['Summary', '', key, value, '']));
    rows.push(['Filters', '', 'Genre', state.filters.genre || 'All', '']);
    rows.push(['Filters', '', 'Release decade', state.filters.decade || 'All', '']);
    rows.push(['Filters', '', 'Minimum movie average', state.filters.rating || 'None', '']);
    data.charts.ratingDistribution.labels.forEach((label, index) => {
      rows.push(['Rating distribution', index + 1, label, data.charts.ratingDistribution.values[index], 'ratings']);
    });
    data.charts.moviesByGenre.forEach((row, index) => rows.push(['Movies by genre', index + 1, row.genre, row.count, 'movies']));
    data.charts.avgRatingByGenre.forEach((row, index) => rows.push(['Average rating by genre', index + 1, row.genre, row.avgRating, `${row.ratingsCount} ratings`]));
    data.charts.mostRatedMovies.forEach((row, index) => rows.push(['Most-rated movies', index + 1, row.title, row.ratingsCount, `${row.avgRating} average`]));
    data.charts.moviesByDecade.forEach((row, index) => rows.push(['Movies by decade', index + 1, row.decade, row.count, 'movies']));
    data.charts.ratingActivity.forEach((row, index) => rows.push(['Rating activity', index + 1, row.year, row.count, 'ratings']));
    data.charts.userActivity.forEach((row, index) => rows.push(['User activity', index + 1, row.range, row.count, 'users']));
    data.charts.ratingWeekday.forEach((row, index) => rows.push(['Rating activity by weekday', index + 1, row.weekday, row.count, 'ratings']));
    data.charts.ratingPopularity.forEach((row, index) => rows.push(['Popularity vs rating', index + 1, row.title, row.avgRating, `${row.ratingsCount} ratings`]));
    data.heatmap.genres.forEach((genreName, rowIndex) => data.heatmap.ratings.forEach((rating, columnIndex) => {
      rows.push(['Genre-rating heatmap', '', genreName, data.heatmap.values[rowIndex][columnIndex], `${rating} stars`]);
    }));
    data.tables.highestRatedMovies.forEach((row, index) => rows.push(['Bayesian-ranked movies', index + 1, row.title, row.adjustedRating, `${row.avgRating} mean from ${row.ratingsCount} ratings`]));
    data.tables.controversialMovies.forEach((row, index) => rows.push(['Most divisive movies', index + 1, row.title, row.ratingStdDev, `${row.avgRating} mean from ${row.ratingsCount} ratings`]));
    data.tables.popularTags.forEach((row, index) => rows.push(['Popular tags', index + 1, row.tag, row.count, 'uses']));
    Object.entries(data.ratingStats).forEach(([key, value]) => rows.push(['Rating statistics', '', key, value, '']));
    Object.entries(data.correlations).forEach(([key, value]) => {
      rows.push(['Feature correlation', '', key, `Pearson=${value.pearson}; Spearman=${value.spearman}`, `n=${value.sampleSize}`]);
    });
    Object.entries(data.quality).forEach(([key, value]) => rows.push(['Data quality', '', key, value, 'source dataset']));
    const content = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'moviesphere-eda.csv'; link.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    if (document.body.dataset.page !== 'analytics') return;
    els.filters = document.getElementById('analyticsFilters');
    els.kpis = document.getElementById('analyticsKpis');
    els.insights = document.getElementById('insightList');
    if (!window.Chart) {
      document.getElementById('edaMeta').textContent = 'Chart.js did not load. Check the network connection and refresh this page.';
      return;
    }
    Chart.defaults.color = COLORS.text;
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.borderColor = COLORS.grid;
    bindFilters();
    loadData();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
