'use strict';

const Store = window.TrackerStore;

const EMOTIONS = {
  calm: { label: 'Normale / tranquilla', piece: 'O', color: '#D7A2D0', colorName: 'Rosa-lilla' },
  sad: { label: 'Triste', piece: 'J', color: '#7790D3', colorName: 'Blu' },
  nervous: { label: 'Nervosa', piece: 'Z', color: '#45488F', colorName: 'Indaco' },
  happy: { label: 'Felice', piece: 'T', color: '#E8BD93', colorName: 'Pesca' },
  productive: { label: 'Produttiva', piece: 'I', color: '#9A92DF', colorName: 'Pervinca' },
  unproductive: { label: 'Non produttiva / non soddisfatta', piece: 'S', color: '#E3A2A8', colorName: 'Rosa polvere' },
  empty: { label: 'Vuoto / noia', piece: 'L', color: '#B89FD8', colorName: 'Lilla' }
};

const MEAL_LABELS = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snacks: 'Spuntini'
};

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snacks'];

function trackerSettings() {
  return Store?.getState()?.settings || {};
}

function visibleMealOrder() {
  const food = trackerSettings().tracker?.food || {};
  return MEAL_ORDER.filter((key) => food[key] !== false);
}

function visibleCategories() {
  const categories = trackerSettings().tracker?.categories;
  return Array.isArray(categories) ? categories.filter((item) => item.visible !== false && String(item.name || '').trim()) : [];
}

function categoryStyleClass(name) {
  const category = (trackerSettings().tracker?.categories || []).find((item) => item.name === name);
  const color = category?.color || ({ 'Lavoro': 'violet', 'Creatività': 'rose', 'Commissioni': 'sky', 'Svago': 'lilac', 'Casa': 'violet', 'Cura personale': 'periwinkle' }[name] || 'neutral');
  return ({ rose: 'category-creativity', sky: 'category-errands', lilac: 'category-leisure', violet: 'category-house', periwinkle: 'category-personal', neutral: 'category-other' })[color] || 'category-other';
}

function isWorkCategory(name) {
  const configured = (trackerSettings().tracker?.categories || []).find((item) => item.id === 'work')?.name;
  return name === 'Lavoro' || Boolean(configured && name === configured);
}

const BASE_SHAPES = {
  I: [[0,0],[1,0],[2,0],[3,0]],
  O: [[0,0],[1,0],[0,1],[1,1]],
  T: [[0,0],[1,0],[2,0],[1,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]]
};

function capitalizeFirstLetter(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function formatDate(value, options = null) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  let resolved = options;
  if (!resolved) {
    const mode = trackerSettings().dateFormat || 'long-weekday';
    resolved = mode === 'numeric'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : mode === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  }
  return capitalizeFirstLetter(new Intl.DateTimeFormat('it-IT', resolved).format(date));
}

function formatClock(value = new Date()) {
  const hour12 = trackerSettings().clockFormat === '12';
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hour12 }).format(value);
}

function parseTime(value) {
  if (!value || !String(value).includes(':')) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function timeDifference(startValue, endValue) {
  const start = parseTime(startValue);
  const end = parseTime(endValue);
  if (start === null || end === null) return null;
  let result = end - start;
  if (result < 0) result += 1440;
  return result;
}

function formatMinutes(minutes, empty = '—') {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return empty;
  const safe = Math.max(0, Math.round(Number(minutes)));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (hours && remainder) return `${hours} h ${remainder} min`;
  if (hours) return `${hours} h`;
  return `${remainder} min`;
}

function waterQuarters(day) {
  return (day?.water || []).reduce((total, entry) => total + (Number(entry.quarters) || 0), 0);
}

function formatWater(quarters) {
  const safe = Math.max(0, Number(quarters) || 0);
  const bottles = Math.floor(safe / 4);
  const remainder = safe % 4;
  if (!safe) return '0 borracce';
  const division = trackerSettings().waterDivision || 'quarters';
  const fraction = division === 'halves' && remainder === 2 ? '1/2' : `${remainder}/4`;
  if (!bottles) return `${fraction} di borraccia`;
  const word = bottles === 1 ? 'borraccia' : 'borracce';
  return remainder ? `${bottles} ${word} + ${fraction}` : `${bottles} ${word}`;
}

function waterLiters(quarters, bottleMl = 750) {
  const liters = ((Number(quarters) || 0) * (bottleMl / 4)) / 1000;
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 3 }).format(liters)} l`;
}

function sleepEnergy(sleep) {
  const value = Number(sleep?.energy ?? sleep?.quality);
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
}

function beverageGlasses(day) {
  return (day?.beverages || []).reduce((total, entry) => total + (Number(entry.glasses) || 0), 0);
}

function beverageMilliliters(day) {
  const defaultGlass = Number(trackerSettings().glassMl) || 220;
  return (day?.beverages || []).reduce((total, entry) => total + (Number(entry.glasses) || 0) * (Number(entry.mlPerGlass) || defaultGlass), 0);
}

function beverageSummary(day) {
  const glasses = beverageGlasses(day);
  if (!glasses) return 'Nessuna bevanda extra';
  return `${glasses} ${glasses === 1 ? 'bicchiere' : 'bicchieri'} · circa ${new Intl.NumberFormat('it-IT').format(beverageMilliliters(day))} ml`;
}

function uid(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dayHasData(day) {
  return Boolean(day?.sleep || Object.values(day?.meals || {}).some(Boolean) || Object.values(day?.mealItems || {}).some((ids) => Array.isArray(ids) && ids.length) || (day?.water || []).length || (day?.beverages || []).length || (day?.activities || []).length || day?.dailyNote || day?.tetr);
}

function getDateRange(periodValue) {
  const today = new Date();
  let start;
  let end;
  if (periodValue === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (periodValue === 'previous') {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  } else {
    const days = Math.max(1, Number(periodValue) || 7);
    end = today;
    start = new Date(today);
    start.setDate(start.getDate() - days + 1);
  }
  return { start, end, startKey: Store.dateKey(start), endKey: Store.dateKey(end) };
}

function dateFromQuery(fallback = new Date()) {
  const value = new URLSearchParams(window.location.search).get('date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    const parsed = new Date(`${value}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(fallback);
}

function tetrominoMarkup(tetr, unit = 8, extraClass = '') {
  if (!tetr) return '<span class="empty-tetr-piece">—</span>';
  const piece = (tetr.piece || EMOTIONS[tetr.emotionKey]?.piece || 'O').toLowerCase();
  const color = tetr.color || EMOTIONS[tetr.emotionKey]?.color || '#B89FD8';
  return `<span class="tetromino piece-${piece} ${extraClass}" style="--piece-color:${color};--unit:${unit}px"><i></i><i></i><i></i><i></i></span>`;
}

// Applica le preferenze visive condivise in tutte le pagine.
function applyGlobalSettings() {
  const settings = trackerSettings();
  const appearance = settings.appearance || {};
  const body = document.body;
  if (!body) return;
  body.classList.toggle('text-mode-large', appearance.textMode === 'large');
  body.classList.toggle('text-mode-contrast', appearance.textMode === 'contrast');
  body.classList.toggle('decorations-light', appearance.decorations === 'light');
  body.classList.toggle('decorations-none', appearance.decorations === 'none');
  body.classList.toggle('tetr-borders-off', appearance.tetrBorders === false);
  body.classList.toggle('tetr-hover-off', appearance.tetrHover === false);
  const backgrounds = { rose: '#F7F4FA', white: '#FFFFFF', lilac: '#F2EFF8' };
  const lineAlpha = ({ 1: .10, 2: .18, 3: .28 })[Number(appearance.tetrGridLines) || 1];
  document.documentElement.style.setProperty('--tetr-board-surface', backgrounds[appearance.tetrGridBackground] || backgrounds.rose);
  document.documentElement.style.setProperty('--tetr-board-line', `rgba(82,63,119,${lineAlpha})`);
  document.documentElement.style.setProperty('--tetr-piece-border-width', appearance.tetrBorders === false ? '0px' : '1px');
}
applyGlobalSettings();
window.addEventListener('tracker:data-changed', (event) => {
  if (['settings-update', 'remote-pull', 'import', 'reset'].includes(event.detail?.reason)) applyGlobalSettings();
});

// Orologio e data della homepage.
(() => {
  const dateElement = document.querySelector('[data-current-date]');
  const timeElement = document.querySelector('[data-current-time]');
  const dayElement = document.querySelector('[data-current-day]');
  const weekdayElement = document.querySelector('[data-current-weekday]');
  const monthYearElement = document.querySelector('[data-current-month-year]');
  if (!dateElement && !timeElement && !dayElement && !weekdayElement && !monthYearElement) return;

  function updateClock() {
    const now = new Date();
    if (dateElement) dateElement.textContent = formatDate(now);
    if (dayElement) dayElement.textContent = String(now.getDate()).padStart(2, '0');
    if (weekdayElement) weekdayElement.textContent = formatDate(now, { weekday: 'long' });
    if (monthYearElement) monthYearElement.textContent = formatDate(now, { month: 'long', year: 'numeric' });
    if (timeElement) timeElement.textContent = formatClock(now);
  }
  updateClock();
  window.setInterval(updateClock, 30000);
  window.addEventListener('tracker:data-changed', (event) => { if (event.detail?.reason === 'settings-update') updateClock(); });
})();

// Atmosfera automatica della homepage.
(() => {
  const hero = document.querySelector('.hero-fullscreen');
  if (!hero) return;
  const sceneByHour = (hour) => hour >= 5 && hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 22 ? 'evening' : 'night';
  const applyScene = () => {
    const appearance = Store.getState().settings.appearance;
    const scene = appearance.autoScenes ? sceneByHour(new Date().getHours()) : (appearance.scene || 'afternoon');
    hero.classList.remove('scene-morning', 'scene-afternoon', 'scene-evening', 'scene-night');
    hero.classList.add(`scene-${scene}`);
    hero.dataset.heroScene = scene;
    const strength = Math.max(.30, Math.min(.85, Number(appearance.gradient || 62) / 100));
    const palette = {
      morning: [[42,35,65],[74,56,74],[41,30,59]],
      afternoon: [[25,15,42],[35,22,55],[24,15,40]],
      evening: [[38,20,53],[91,48,76],[35,21,50]],
      night: [[18,18,47],[25,28,66],[14,17,44]]
    }[scene];
    hero.style.backgroundImage = `linear-gradient(90deg, rgba(${palette[0].join(',')},${strength}) 0%, rgba(${palette[1].join(',')},${Math.max(.08, strength * .28)}) 52%, rgba(${palette[2].join(',')},${Math.max(.22, strength * .62)}) 100%), linear-gradient(0deg, rgba(${palette[0].join(',')},${Math.max(.34, strength * .92)}) 0%, rgba(${palette[0].join(',')},.02) 52%), url("assets/hero-room.png")`;
  };
  applyScene();
  window.setInterval(applyScene, 60000);
  window.addEventListener('tracker:data-changed', (event) => { if (event.detail?.reason === 'settings-update') applyScene(); });
})();

// Meteo della homepage tramite Open-Meteo.
(() => {
  const card = document.querySelector('.weather-card');
  if (!card) return;
  const descriptions = {
    0: 'Cielo sereno', 1: 'Prevalentemente sereno', 2: 'Parzialmente nuvoloso', 3: 'Coperto',
    45: 'Nebbia', 48: 'Nebbia con brina', 51: 'Pioviggine leggera', 53: 'Pioviggine', 55: 'Pioviggine intensa',
    61: 'Pioggia leggera', 63: 'Pioggia', 65: 'Pioggia intensa', 71: 'Neve leggera', 73: 'Neve', 75: 'Neve intensa',
    80: 'Rovesci leggeri', 81: 'Rovesci', 82: 'Rovesci intensi', 95: 'Temporale', 96: 'Temporale con grandine', 99: 'Temporale forte'
  };
  let refreshTimer = null;
  async function loadWeather() {
    const settings = Store.getState().settings;
    if (settings.home.weather === false) { card.hidden = true; return; }
    card.hidden = false;
    const city = settings.city || 'Roma, Italia';
    card.querySelector('.weather-location').textContent = city;
    card.querySelector('.weather-status').textContent = 'Aggiornamento…';
    try {
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it&format=json`);
      const geo = await geoResponse.json();
      const place = geo.results?.[0];
      if (!place) throw new Error('Località non trovata');
      const unit = settings.weatherUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto&temperature_unit=${unit}`);
      const weather = await weatherResponse.json();
      card.querySelector('.weather-location').textContent = [place.name, place.country].filter(Boolean).join(', ');
      const unitSymbol = settings.weatherUnit === 'fahrenheit' ? '°F' : '°C';
      card.querySelector('.weather-temp').textContent = `${Math.round(weather.current?.temperature_2m)}${unitSymbol}`;
      card.querySelector('.weather-status').textContent = descriptions[weather.current?.weather_code] || 'Condizioni aggiornate';
      const bottom = card.querySelectorAll('.weather-bottom span');
      if (bottom[0]) bottom[0].textContent = `Min ${Math.round(weather.daily?.temperature_2m_min?.[0])}${unitSymbol}`;
      if (bottom[1]) bottom[1].textContent = `Max ${Math.round(weather.daily?.temperature_2m_max?.[0])}${unitSymbol}`;
    } catch (error) {
      card.querySelector('.weather-temp').textContent = '—°';
      card.querySelector('.weather-status').textContent = 'Meteo non disponibile';
    }
  }
  function scheduleWeather() {
    window.clearInterval(refreshTimer);
    const refresh = trackerSettings().weatherRefresh || '60';
    if (refresh !== 'open') refreshTimer = window.setInterval(loadWeather, Number(refresh) * 60 * 1000);
  }
  loadWeather();
  scheduleWeather();
  window.addEventListener('tracker:data-changed', (event) => {
    if (event.detail?.reason === 'settings-update') { loadWeather(); scheduleWeather(); }
  });
})();

// La mia giornata.
(() => {
  const page = document.querySelector('.day-page');
  if (!page) return;
  let selectedDate = dateFromQuery();
  let editingId = null;
  const form = page.querySelector('[data-activity-form]');
  const list = page.querySelector('[data-activity-list]');
  const feedback = page.querySelector('[data-form-feedback]');
  const noteField = page.querySelector('[data-daily-note]');
  const noteFeedback = page.querySelector('[data-note-feedback]');
  const submitButton = form?.querySelector('button[type="submit"]');

  const categoryClassMap = {
    'Lavoro': 'category-creativity',
    'Creatività': 'category-creativity',
    'Commissioni': 'category-errands',
    'Svago': 'category-leisure',
    'Casa': 'category-house',
    'Cura personale': 'category-personal',
    'Altro': 'category-other'
  };


  function key() { return Store.dateKey(selectedDate); }
  function renderCategoryControls() {
    const categories = visibleCategories();
    const select = form?.elements.category;
    if (select) {
      const previous = select.value;
      select.innerHTML = categories.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('');
      if (!select.options.length) select.innerHTML = '<option value="Altro">Altro</option>';
      if ([...select.options].some((option) => option.value === previous)) select.value = previous;
    }
    const filters = page.querySelector('.activity-filter');
    if (filters) {
      const active = filters.querySelector('.active')?.dataset.filter || 'Tutte';
      filters.innerHTML = `<button class="filter-chip${active === 'Tutte' ? ' active' : ''}" type="button" data-filter="Tutte">Tutte</button>${categories.map((item) => `<button class="filter-chip${active === item.name ? ' active' : ''}" type="button" data-filter="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join('')}`;
      filters.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
        filters.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
        applyFilter();
      }));
    }
  }
  function renderDate() {
    page.querySelector('[data-selected-weekday]').textContent = formatDate(selectedDate, { weekday: 'long' });
    page.querySelector('[data-selected-date]').textContent = formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function renderList() {
    const day = Store.getDay(key());
    const activities = day.activities || [];
    list.innerHTML = '';
    if (!activities.length) {
      list.innerHTML = '<div class="tracker-empty-state"><strong>Nessuna attività registrata</strong><span>Aggiungi la prima voce per questa giornata.</span></div>';
    }
    activities.forEach((activity) => {
      const article = document.createElement('article');
      article.className = 'activity-item';
      article.dataset.category = activity.category || 'Altro';
      article.dataset.duration = String(activity.duration || 0);
      article.dataset.activityId = activity.id;
      const categoryClass = categoryStyleClass(activity.category);
      article.innerHTML = `
        <div class="activity-time"><strong>${escapeHtml(activity.time || '—')}</strong><span>${Number(activity.duration) ? formatMinutes(activity.duration) : 'Senza durata'}</span></div>
        <span class="timeline-dot ${categoryClass}" aria-hidden="true"></span>
        <div class="activity-card">
          <div class="activity-card-top">
            <span class="category-pill ${categoryClass}">${escapeHtml(activity.category || 'Altro')}</span>
            <div class="activity-actions">
              <button type="button" data-edit-activity aria-label="Modifica attività">✎</button>
              <button type="button" data-delete-activity aria-label="Elimina attività">×</button>
            </div>
          </div>
          <h3>${escapeHtml(activity.title)}</h3>
          <p>${escapeHtml(activity.note || 'Nessuna nota aggiunta.')}</p>
        </div>`;
      list.append(article);
    });
    noteField.value = day.dailyNote || '';
    updateSummary();
    applyFilter();
  }

  function updateSummary() {
    const day = Store.getDay(key());
    const activities = day.activities || [];
    const categoryCounts = {};
    activities.forEach((item) => { categoryCounts[item.category || 'Altro'] = (categoryCounts[item.category || 'Altro'] || 0) + 1; });
    const top = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    page.querySelector('[data-summary-count]').textContent = String(activities.length);
    page.querySelector('[data-summary-category]').textContent = top;
  }

  function applyFilter() {
    const active = page.querySelector('[data-filter].active')?.dataset.filter || 'Tutte';
    list.querySelectorAll('.activity-item').forEach((item) => {
      item.hidden = active !== 'Tutte' && item.dataset.category !== active;
    });
  }

  function loadDay() {
    editingId = null;
    if (form) form.reset();
    if (submitButton) submitButton.innerHTML = 'Aggiungi attività <span>＋</span>';
    renderCategoryControls();
    renderDate();
    renderList();
    if (feedback) feedback.textContent = dayHasData(Store.getDay(key())) ? 'Dati caricati per la giornata selezionata.' : 'Questa giornata non contiene ancora attività.';
    if (noteFeedback) noteFeedback.textContent = Store.getDay(key()).dailyNote ? 'Nota salvata' : 'Nota non ancora salvata';
  }

  page.querySelectorAll('[data-date-shift]').forEach((button) => button.addEventListener('click', () => {
    selectedDate.setDate(selectedDate.getDate() + Number(button.dataset.dateShift));
    loadDay();
  }));
  page.querySelector('[data-date-today]')?.addEventListener('click', () => { selectedDate = new Date(); loadDay(); });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get('activity') || '').trim();
    if (!title) return;
    const activity = {
      id: editingId || uid('activity'),
      title,
      category: String(data.get('category') || 'Altro'),
      time: String(data.get('time') || ''),
      duration: (Math.max(0, Number(data.get('durationHours')) || 0) * 60) + Math.max(0, Number(data.get('durationMinutes')) || 0),
      note: String(data.get('note') || '').trim()
    };
    Store.updateDay(key(), (day) => {
      const activities = [...(day.activities || [])];
      const index = activities.findIndex((item) => item.id === editingId);
      if (index >= 0) activities[index] = activity;
      else activities.push(activity);
      return { ...day, activities };
    }, editingId ? 'activity-edit' : 'activity-add');
    if (feedback) feedback.textContent = editingId ? 'Attività aggiornata e salvata.' : 'Attività aggiunta e salvata.';
    editingId = null;
    form.reset();
    if (submitButton) submitButton.innerHTML = 'Aggiungi attività <span>＋</span>';
    renderList();
  });

  list?.addEventListener('click', (event) => {
    const item = event.target.closest('.activity-item');
    if (!item) return;
    const id = item.dataset.activityId;
    const day = Store.getDay(key());
    const activity = day.activities.find((entry) => entry.id === id);
    if (!activity) return;
    if (event.target.closest('[data-delete-activity]')) {
      Store.updateDay(key(), (currentDay) => ({ ...currentDay, activities: currentDay.activities.filter((entry) => entry.id !== id) }), 'activity-delete');
      renderList();
      if (feedback) feedback.textContent = 'Attività eliminata.';
    } else if (event.target.closest('[data-edit-activity]')) {
      editingId = id;
      form.elements.activity.value = activity.title || '';
      form.elements.category.value = activity.category || 'Altro';
      form.elements.time.value = activity.time || '';
      form.elements.durationHours.value = activity.duration ? Math.floor(Number(activity.duration) / 60) : '';
      form.elements.durationMinutes.value = activity.duration ? Number(activity.duration) % 60 : '';
      form.elements.note.value = activity.note || '';
      if (submitButton) submitButton.innerHTML = 'Salva modifica <span>✓</span>';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (feedback) feedback.textContent = 'Modifica la voce e salva.';
    }
  });

  page.querySelector('[data-save-note]')?.addEventListener('click', () => {
    Store.updateDay(key(), (day) => ({ ...day, dailyNote: noteField.value.trim() }), 'daily-note');
    noteFeedback.textContent = noteField.value.trim() ? 'Nota salvata' : 'Nota rimossa';
  });

  loadDay();
  window.addEventListener('tracker:data-changed', (event) => {
    if (['settings-update', 'remote-pull', 'import', 'reset'].includes(event.detail?.reason)) loadDay();
  });
})();

// Sonno.
(() => {
  const page = document.querySelector('.sleep-page');
  if (!page) return;
  let selectedDate = dateFromQuery();
  const form = page.querySelector('[data-sleep-form]');
  const awakeningList = page.querySelector('[data-awakening-list]');
  const feedback = page.querySelector('[data-sleep-feedback]');

  function setSleepElementVisible(element, visible) {
    if (!element) return;
    element.hidden = !visible;
    element.classList.toggle('is-setting-hidden', !visible);
    element.setAttribute('aria-hidden', String(!visible));
  }

  function applySleepSettings() {
    const settings = trackerSettings().tracker?.sleep || {};
    const showRiseDelay = settings.riseDelay !== false;
    const showAwakenings = settings.awakenings !== false;
    const showEnergy = settings.energy !== false;
    const upLabel = form?.elements.up?.closest('label');
    const awakeningsCard = page.querySelector('.sleep-awakenings-card');
    const energyScale = page.querySelector('.quality-scale');
    const energyHeading = page.querySelector('.sleep-quality-card h3');
    setSleepElementVisible(upLabel, showRiseDelay);
    setSleepElementVisible(awakeningsCard, showAwakenings);
    setSleepElementVisible(energyScale, showEnergy);
    if (energyHeading) energyHeading.textContent = showEnergy ? 'Come ti sei svegliata?' : 'Nota sul sonno';
    const summaryCards = [...page.querySelectorAll('.sleep-summary-card')];
    setSleepElementVisible(summaryCards[1], showRiseDelay);
    setSleepElementVisible(summaryCards[2], showRiseDelay);
    setSleepElementVisible(summaryCards[3], showAwakenings);
    const insightRows = page.querySelectorAll('.sleep-insight-list > div');
    setSleepElementVisible(insightRows[2], showEnergy);
  }

  function key() { return Store.dateKey(selectedDate); }
  function renderDate() {
    page.querySelector('[data-sleep-weekday]').textContent = formatDate(selectedDate, { weekday: 'long' });
    page.querySelector('[data-sleep-date]').textContent = formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' });
    const previous = new Date(selectedDate); previous.setDate(previous.getDate() - 1);
    const hint = page.querySelector('.sleep-date-copy .secondary-text');
    if (hint) hint.textContent = `Notte tra ${formatDate(previous, { weekday: 'long' }).toLowerCase()} e ${formatDate(selectedDate, { weekday: 'long' }).toLowerCase()}`;
  }

  function awakeningRow(awakening = { time: '' }) {
    const row = document.createElement('div');
    row.className = 'awakening-row';
    row.innerHTML = `<label><span>Orario</span><span class="sleep-time-wrap"><input type="time" name="awakeningTime[]" value="${escapeHtml(awakening.time || '')}"></span></label>
      <button class="awakening-remove" type="button" data-remove-awakening aria-label="Rimuovi risveglio">×</button>`;
    return row;
  }

  function awakeningsFromForm() {
    return [...awakeningList.querySelectorAll('.awakening-row')].map((row) => ({
      time: row.querySelector('input[name="awakeningTime[]"]')?.value || ''
    })).filter((item) => item.time);
  }

  function sleepCalculations() {
    const settings = trackerSettings().tracker?.sleep || {};
    const bedtime = form.elements.bedtime.value;
    const wake = form.elements.wake.value;
    const up = settings.riseDelay === false ? wake : (form.elements.up.value || wake);
    const napStart = form.elements.napStart?.value || '';
    const napEnd = form.elements.napEnd?.value || '';
    return {
      duration: timeDifference(bedtime, wake),
      bedDuration: timeDifference(bedtime, up),
      riseDelay: timeDifference(wake, up),
      napDuration: napStart && napEnd ? timeDifference(napStart, napEnd) : null
    };
  }

  function updateSummary() {
    const calculations = sleepCalculations();
    page.querySelector('[data-sleep-duration]').textContent = formatMinutes(calculations.duration);
    page.querySelector('[data-bed-duration]').textContent = formatMinutes(calculations.bedDuration);
    page.querySelector('[data-rise-delay]').textContent = formatMinutes(calculations.riseDelay);
    page.querySelector('[data-awakening-count]').textContent = String(awakeningsFromForm().length);
    const napDuration = page.querySelector('[data-nap-duration]');
    if (napDuration) napDuration.textContent = calculations.napDuration === null ? '—' : formatMinutes(calculations.napDuration);
  }

  function renderSleepStats() {
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(selectedDate);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const records = dates.map((date) => ({
      date,
      key: Store.dateKey(date),
      sleep: Store.getDay(Store.dateKey(date)).sleep
    }));
    const recorded = records.filter(({ sleep }) => sleep && sleep.duration !== null && sleep.duration !== undefined && Number.isFinite(Number(sleep.duration)));
    const durations = recorded.map(({ sleep }) => Number(sleep.duration));
    const averageDuration = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
    const maximumDuration = Math.max(540, ...durations, 1);

    const averageLabel = page.querySelector('.sleep-chart-topline strong');
    if (averageLabel) averageLabel.textContent = averageDuration === null ? 'Nessuna notte registrata' : `Media ${formatMinutes(averageDuration)}`;

    const bars = page.querySelector('.sleep-bars');
    if (bars) {
      bars.innerHTML = records.map(({ date, key: dateKeyValue, sleep }) => {
        const duration = Number(sleep?.duration);
        const valid = sleep?.duration !== null && sleep?.duration !== undefined && Number.isFinite(duration);
        const height = valid ? Math.max(5, Math.min(100, (duration / maximumDuration) * 100)) : 0;
        const hours = valid ? Math.floor(duration / 60) : 0;
        const minutes = valid ? Math.round(duration % 60) : 0;
        const valueLabel = valid ? `${hours}h ${String(minutes).padStart(2, '0')}` : '—';
        const dayLabel = dateKeyValue === Store.dateKey(new Date()) ? 'Oggi' : capitalizeFirstLetter(new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date).replace('.', ''));
        return `<div class="sleep-bar-item${dateKeyValue === key() ? ' active' : ''}"><span class="sleep-bar-value">${valueLabel}</span><div class="sleep-bar-track"><i style="height:${height}%"></i></div><span class="secondary-text">${dayLabel}</span></div>`;
      }).join('');
      bars.setAttribute('aria-label', `Ore dormite nei sette giorni fino al ${formatDate(selectedDate, { day: 'numeric', month: 'long' })}`);
    }

    const averageClock = (values, shiftAfterMidnight = false) => {
      const minutes = values.map(parseTime).filter((value) => value !== null).map((value) => shiftAfterMidnight && value < 720 ? value + 1440 : value);
      if (!minutes.length) return null;
      return Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) % 1440;
    };
    const clockLabel = (minutes) => minutes === null ? '—' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const bedtimeValues = recorded.map(({ sleep }) => sleep.bedtime).filter(Boolean);
    const wakeValues = recorded.map(({ sleep }) => sleep.wake).filter(Boolean);
    const bedtimeAverage = averageClock(bedtimeValues, true);
    const wakeAverage = averageClock(wakeValues);
    const energies = recorded.map(({ sleep }) => sleepEnergy(sleep)).filter((value) => value !== null);
    const energyAverage = energies.length ? energies.reduce((sum, value) => sum + value, 0) / energies.length : null;
    const wakeMinutes = wakeValues.map(parseTime).filter((value) => value !== null);
    const wakeSpread = wakeMinutes.length > 1 ? Math.max(...wakeMinutes) - Math.min(...wakeMinutes) : 0;
    const durationSpread = durations.length > 1 ? Math.max(...durations) - Math.min(...durations) : 0;

    let insightTitle = 'Nessun ritmo da confrontare';
    let insightText = 'Registra almeno una notte per vedere il riepilogo reale degli ultimi sette giorni.';
    if (recorded.length === 1) {
      insightTitle = 'Una notte registrata';
      insightText = 'Servono almeno due notti per confrontare la regolarità degli orari e della durata.';
    } else if (recorded.length > 1) {
      if (wakeSpread <= 45 && durationSpread <= 60) insightTitle = 'Ritmo abbastanza stabile';
      else if (wakeSpread <= 90 && durationSpread <= 120) insightTitle = 'Ritmo un po’ variabile';
      else insightTitle = 'Ritmo molto variabile';
      insightText = `L’orario della sveglia è variato di ${formatMinutes(wakeSpread)}. La durata del sonno è variata di ${formatMinutes(durationSpread)} nelle ${recorded.length} notti registrate.`;
    }

    const insightCard = page.querySelector('.sleep-insight-card');
    if (insightCard) {
      insightCard.querySelector('h3').textContent = insightTitle;
      insightCard.querySelector(':scope > p').textContent = insightText;
      const values = insightCard.querySelectorAll('.sleep-insight-list strong');
      if (values[0]) values[0].textContent = clockLabel(bedtimeAverage);
      if (values[1]) values[1].textContent = clockLabel(wakeAverage);
      if (values[2]) values[2].textContent = energyAverage === null ? '—' : `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(energyAverage)} / 5`;
    }

    const recentList = page.querySelector('.recent-nights-list');
    if (recentList) {
      const recent = Object.values(Store.getState().days || {})
        .filter((day) => day.date <= key() && day.sleep)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);
      recentList.innerHTML = recent.length ? recent.map((day) => {
        const date = new Date(`${day.date}T12:00:00`);
        const sleep = day.sleep;
        return `<article class="recent-night-row"><div class="recent-night-date"><strong>${date.getDate()}</strong><span>${formatDate(date, { month: 'long' })}</span></div><div><span class="recent-night-label">Sonno</span><strong>${formatMinutes(sleep.duration)}</strong></div><div><span class="recent-night-label">Orari</span><strong>${sleep.bedtime || '—'} — ${sleep.wake || '—'}</strong></div><div><span class="recent-night-label">Energie</span><strong>${sleepEnergy(sleep) ? `${sleepEnergy(sleep)} / 5` : '—'}</strong></div><button type="button" data-recent-sleep-date="${day.date}" aria-label="Apri la notte del ${formatDate(date, { day: 'numeric', month: 'long' })}">→</button></article>`;
      }).join('') : '<div class="tracker-empty-state"><strong>Nessuna notte registrata</strong><span>Le ultime notti compariranno qui dopo il primo salvataggio.</span></div>';
    }
  }

  function loadDay() {
    const sleep = Store.getDay(key()).sleep;
    form.reset();
    awakeningList.innerHTML = '';
    const values = sleep || { bedtime: '', wake: '', up: '', energy: '', note: '', awakenings: [], nap: null };
    ['bedtime', 'wake', 'up'].forEach((name) => { form.elements[name].value = values[name] || ''; });
    if (form.elements.napStart) form.elements.napStart.value = values.nap?.start || '';
    if (form.elements.napEnd) form.elements.napEnd.value = values.nap?.end || '';
    const savedEnergy = sleepEnergy(values);
    form.querySelectorAll('input[name="energy"]').forEach((radio) => { radio.checked = String(radio.value) === String(savedEnergy || ''); });
    form.elements.sleepNote.value = values.note || '';
    (values.awakenings || []).forEach((item) => awakeningList.append(awakeningRow(item)));
    applySleepSettings();
    renderDate();
    updateSummary();
    feedback.textContent = sleep ? 'Notte caricata. Puoi modificarla e salvarla di nuovo.' : 'Nessun dato salvato per questa notte.';
    renderSleepStats();
  }

  page.querySelector('[data-add-awakening]')?.addEventListener('click', () => { awakeningList.append(awakeningRow()); updateSummary(); });
  awakeningList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-awakening]');
    if (button) { button.closest('.awakening-row')?.remove(); updateSummary(); }
  });
  form.addEventListener('input', updateSummary);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const calculations = sleepCalculations();
    const energy = form.querySelector('input[name="energy"]:checked')?.value || '';
    Store.updateDay(key(), (day) => ({
      ...day,
      sleep: {
        bedtime: form.elements.bedtime.value,
        wake: form.elements.wake.value,
        up: form.elements.up.value,
        energy: energy ? Number(energy) : null,
        note: form.elements.sleepNote.value.trim(),
        awakenings: awakeningsFromForm(),
        duration: calculations.duration,
        bedDuration: calculations.bedDuration,
        riseDelay: calculations.riseDelay,
        nap: (form.elements.napStart?.value || form.elements.napEnd?.value) ? {
          start: form.elements.napStart?.value || '',
          end: form.elements.napEnd?.value || '',
          duration: calculations.napDuration
        } : null
      }
    }), 'sleep-save');
    feedback.textContent = 'Notte salvata correttamente.';
    renderSleepStats();
  });
  page.querySelector('.recent-nights-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-recent-sleep-date]');
    if (!button) return;
    selectedDate = new Date(`${button.dataset.recentSleepDate}T12:00:00`);
    loadDay();
    page.querySelector('.sleep-entry-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  page.querySelectorAll('[data-sleep-date-shift]').forEach((button) => button.addEventListener('click', () => { selectedDate.setDate(selectedDate.getDate() + Number(button.dataset.sleepDateShift)); loadDay(); }));
  page.querySelector('[data-sleep-today]')?.addEventListener('click', () => { selectedDate = new Date(); loadDay(); });
  loadDay();
  window.addEventListener('tracker:data-changed', (event) => {
    if (['settings-update', 'remote-pull', 'import', 'reset'].includes(event.detail?.reason)) loadDay();
  });
})();

// Cibo e acqua.
(() => {
  const page = document.querySelector('.food-page');
  if (!page) return;
  let selectedDate = dateFromQuery();
  const mealCards = [...page.querySelectorAll('[data-meal-card]')];
  const waterHistory = page.querySelector('[data-water-history]');
  const beverageList = page.querySelector('[data-beverage-list]');
  const beverageName = page.querySelector('[data-beverage-name]');
  const beverageGlassesInput = page.querySelector('[data-beverage-glasses]');
  const beverageFeedback = page.querySelector('[data-beverage-feedback]');
  const bottleMl = () => Number(Store.getState().settings.bottleMl) || 750;
  const glassMl = () => Number(Store.getState().settings.glassMl) || 220;
  const quarterMl = () => bottleMl() / 4;

  function applyFoodSettings() {
    const settings = trackerSettings();
    const food = settings.tracker?.food || {};
    mealCards.forEach((card) => { card.hidden = food[mealKey(card.dataset.mealName)] === false; });
    const mealsColumn = page.querySelector('.meals-column');
    if (mealsColumn) mealsColumn.hidden = !visibleMealOrder().length;
    const showEquivalence = settings.showWaterEquivalence !== false;
    page.querySelectorAll('[data-water-ml-short], [data-water-liters], .water-actions button span').forEach((element) => { element.hidden = !showEquivalence; });
    const capacity = page.querySelector('.bottle-capacity');
    if (capacity) capacity.textContent = `${bottleMl()} ml`;
    const glassCapacity = page.querySelector('[data-glass-capacity]');
    if (glassCapacity) glassCapacity.textContent = `circa ${glassMl()} ml per bicchiere`;
    const buttons = [...page.querySelectorAll('[data-water-add]')];
    const division = settings.waterDivision || 'quarters';
    if (division === 'halves') {
      const values = [2, 4];
      buttons.forEach((button, index) => {
        button.hidden = index > 1;
        if (index <= 1) {
          button.dataset.waterAdd = String(values[index]);
          button.querySelector('strong').textContent = index === 0 ? '+ 1/2' : '+ 1 borraccia';
          const detail = button.querySelector('span');
          if (detail) detail.textContent = `${Math.round(values[index] * quarterMl())} ml`;
        }
      });
    } else {
      const values = [1, 2, 3, 4];
      buttons.forEach((button, index) => {
        button.hidden = false;
        button.dataset.waterAdd = String(values[index]);
        button.querySelector('strong').textContent = index === 3 ? '+ 1 borraccia' : `+ ${values[index]}/4`;
        const detail = button.querySelector('span');
        if (detail) detail.textContent = `${[0, 2].includes(index) ? 'circa ' : ''}${Math.round(values[index] * quarterMl())} ml`;
      });
    }
  }

  function key() { return Store.dateKey(selectedDate); }
  function mealKey(name) {
    return ({ Colazione: 'breakfast', Pranzo: 'lunch', Cena: 'dinner', Spuntino: 'snacks' })[name] || String(name).toLowerCase();
  }

  const FOOD_ICONS = ['🍝','🍚','🍞','🥐','🥗','🥦','🥕','🍅','🍎','🍑','🍌','🍓','🥛','🧀','🥚','🍗','🐟','🍪','🍰','🍫','🥣','🍲','🥪','🍕','🥔','🌰','🥒','🫘','🍋','🥤','🧃','☕','🍵',''];
  let editingFoodId = null;

  function foodLibrary() {
    return Array.isArray(Store.getState().settings.tracker?.foodLibrary)
      ? Store.getState().settings.tracker.foodLibrary
      : [];
  }
  function saveFoodLibrary(items, reason = 'food-library-update') {
    const settings = Store.getState().settings;
    Store.saveSettings({ tracker: { ...settings.tracker, foodLibrary: items } });
    window.dispatchEvent(new CustomEvent('tracker:food-library-changed', { detail: { reason } }));
  }
  function foodById(id) { return foodLibrary().find((item) => item.id === id); }
  function foodUsage(id) {
    let count = 0, lastDate = '';
    Object.values(Store.getState().days || {}).forEach((day) => {
      Object.values(day.mealItems || {}).forEach((ids) => {
        if (Array.isArray(ids) && ids.includes(id)) { count += 1; if (!lastDate || day.date > lastDate) lastDate = day.date; }
      });
    });
    return { count, lastDate };
  }
  function selectedFoodIds(day, meal) {
    return Array.isArray(day.mealItems?.[meal]) ? day.mealItems[meal] : [];
  }
  function persistMealFood(meal, ids) {
    Store.updateDay(key(), (day) => ({ ...day, mealItems: { ...(day.mealItems || {}), [meal]: [...new Set(ids)] } }), 'meal-food-update');
  }
  function foodChip(item, removable = false) {
    return `<span class="selected-food-chip" data-food-chip-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.icon || '•')}</span>${escapeHtml(item.name)}${removable ? '<button type="button" data-remove-food aria-label="Rimuovi alimento">×</button>' : ''}</span>`;
  }
  function renderFoodPickers(day) {
    mealCards.forEach((card) => {
      const meal = mealKey(card.dataset.mealName);
      const holder = card.querySelector('[data-food-picker]');
      if (!holder) return;
      const ids = selectedFoodIds(day, meal);
      const selected = ids.map(foodById).filter(Boolean);
      holder.innerHTML = `
        <div class="selected-food-block">
          <span class="selected-food-title">Alimenti selezionati</span>
          <div class="selected-food-list" data-selected-foods>${selected.map((item) => foodChip(item, true)).join('') || '<span class="selected-food-empty">Non hai ancora selezionato alimenti.</span>'}</div>
        </div>
        <label class="food-picker-search"><span>Aggiungi un alimento</span><input type="search" data-food-suggest-input placeholder="Cerca nella libreria…" autocomplete="off"></label>
        <div class="food-suggestion-list" data-food-suggestions hidden></div>`;
      const input = holder.querySelector('[data-food-suggest-input]');
      const suggestions = holder.querySelector('[data-food-suggestions]');
      function updateSuggestions() {
        const query = input.value.trim().toLocaleLowerCase('it');
        const matches = foodLibrary().filter((item) => item.active !== false && !ids.includes(item.id) && (!query || `${item.name} ${item.category}`.toLocaleLowerCase('it').includes(query))).sort((a,b) => Number(b.favorite)-Number(a.favorite) || a.name.localeCompare(b.name,'it')).slice(0,8);
        suggestions.hidden = false;
        suggestions.innerHTML = matches.map((item) => `<button type="button" data-select-food="${escapeHtml(item.id)}"><span>${escapeHtml(item.icon || '•')}</span><span><strong>${escapeHtml(item.name)}</strong><span class="food-suggestion-meta">${escapeHtml(item.category || 'Senza categoria')}</span></span></button>`).join('') + (query && !foodLibrary().some((item) => item.name.toLocaleLowerCase('it') === query) ? `<button type="button" class="food-add-suggestion" data-create-food-from-picker><span>＋</span><span><strong>Aggiungi “${escapeHtml(input.value.trim())}”</strong><span class="food-suggestion-meta">Scegli icona e categoria</span></span></button>` : '');
        if (!suggestions.innerHTML) suggestions.innerHTML = '<p>Nessun altro alimento disponibile.</p>';
      }
      input.addEventListener('focus', updateSuggestions);
      input.addEventListener('input', updateSuggestions);
      suggestions.addEventListener('click', (event) => {
        const select = event.target.closest('[data-select-food]');
        if (select) { persistMealFood(meal, [...ids, select.dataset.selectFood]); const nextDay = Store.getDay(key()); renderMeals(nextDay); renderFoodPickers(nextDay); renderFoodLibrary(); updateSummary(nextDay); renderWeeklyStats(); return; }
        if (event.target.closest('[data-create-food-from-picker]')) openFoodEditor(null, input.value.trim(), meal);
      });
      holder.querySelector('[data-selected-foods]').addEventListener('click', (event) => {
        const chip = event.target.closest('[data-food-chip-id]');
        if (event.target.closest('[data-remove-food]') && chip) { persistMealFood(meal, ids.filter((id) => id !== chip.dataset.foodChipId)); const nextDay = Store.getDay(key()); renderMeals(nextDay); renderFoodPickers(nextDay); renderFoodLibrary(); updateSummary(nextDay); renderWeeklyStats(); }
      });
    });
  }

  document.addEventListener('pointerdown', (event) => {
    page.querySelectorAll('[data-food-suggestions]').forEach((list) => {
      const picker = list.closest('[data-food-picker]');
      if (picker && !picker.contains(event.target)) list.hidden = true;
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') page.querySelectorAll('[data-food-suggestions]').forEach((list) => { list.hidden = true; });
  });

  const libraryList = page.querySelector('[data-food-library-list]');
  const librarySearch = page.querySelector('[data-food-library-search]');
  const libraryFilter = page.querySelector('[data-food-library-filter]');
  const editor = page.querySelector('[data-food-library-editor]');
  let pendingMealAfterCreate = null;
  function renderFoodLibrary() {
    if (!libraryList) return;
    const query = (librarySearch?.value || '').trim().toLocaleLowerCase('it');
    const category = libraryFilter?.value || '';
    const items = foodLibrary().filter((item) => item.active !== false && (!query || `${item.name} ${item.category}`.toLocaleLowerCase('it').includes(query)) && (!category || item.category === category)).sort((a,b) => Number(b.favorite)-Number(a.favorite) || a.name.localeCompare(b.name,'it'));
    libraryList.innerHTML = items.length ? items.map((item) => {
      const usage = foodUsage(item.id);
      return `<article class="food-library-card" data-library-food-id="${escapeHtml(item.id)}"><div class="food-library-icon">${escapeHtml(item.icon || '•')}</div><div><div class="food-library-name"><strong>${escapeHtml(item.name)}</strong>${item.favorite ? '<span aria-label="Preferito">★</span>' : ''}</div><p>${escapeHtml(item.category || 'Senza categoria')} · ${usage.count} ${usage.count === 1 ? 'consumo' : 'consumi'}${usage.lastDate ? ` · Ultimo: ${formatDate(usage.lastDate,{day:'numeric',month:'short'})}` : ''}</p></div><div class="food-library-actions"><button type="button" data-toggle-food-favorite aria-label="Preferito">${item.favorite ? '★' : '☆'}</button><button type="button" data-edit-food>Modifica</button><button type="button" data-merge-food>Unisci</button><button type="button" data-delete-food>Elimina</button></div></article>`;
    }).join('') : '<div class="food-library-empty"><strong>Nessun alimento trovato.</strong><p>Aggiungine uno mentre compili un pasto oppure usa “Nuovo alimento”.</p></div>';
  }
  function openFoodEditor(id = null, suggestedName = '', meal = null) {
    if (!editor) return;
    editingFoodId = id;
    pendingMealAfterCreate = meal;
    const item = id ? foodById(id) : null;
    editor.hidden = false;
    editor.querySelector('[data-food-editor-title]').textContent = item ? 'Modifica alimento' : 'Nuovo alimento';
    editor.querySelector('[data-food-editor-name]').value = item?.name || suggestedName || '';
    editor.querySelector('[data-food-editor-icon]').value = item?.icon || '';
    editor.querySelector('[data-food-editor-category]').value = item?.category || '';
    editor.querySelector('[data-food-editor-favorite]').checked = item?.favorite === true;
    editor.querySelector('[data-food-icon-options]').innerHTML = FOOD_ICONS.map((icon) => `<button type="button" data-food-icon="${escapeHtml(icon)}" aria-label="${icon || 'Nessuna icona'}">${icon || '∅'}</button>`).join('');
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editor.querySelector('[data-food-editor-name]').focus();
  }
  function closeFoodEditor() { if (editor) editor.hidden = true; editingFoodId = null; pendingMealAfterCreate = null; }
  page.querySelector('[data-open-food-library-add]')?.addEventListener('click', () => openFoodEditor());
  editor?.querySelector('[data-food-icon-options]')?.addEventListener('click', (event) => { const button=event.target.closest('[data-food-icon]'); if(button) editor.querySelector('[data-food-editor-icon]').value=button.dataset.foodIcon; });
  editor?.querySelector('[data-food-editor-cancel]')?.addEventListener('click', closeFoodEditor);
  editor?.querySelector('[data-food-editor-save]')?.addEventListener('click', () => {
    const name = editor.querySelector('[data-food-editor-name]').value.trim();
    const feedback = editor.querySelector('[data-food-editor-feedback]');
    if (!name) { feedback.textContent = 'Inserisci il nome dell’alimento.'; return; }
    const duplicate = foodLibrary().find((item) => item.id !== editingFoodId && item.name.toLocaleLowerCase('it') === name.toLocaleLowerCase('it'));
    if (duplicate) { feedback.textContent = `Esiste già “${duplicate.name}”. Usa quella voce oppure modifica il nome.`; return; }
    const next = foodLibrary();
    const data = { id: editingFoodId || uid('food'), name, icon: editor.querySelector('[data-food-editor-icon]').value.trim(), category: editor.querySelector('[data-food-editor-category]').value, favorite: editor.querySelector('[data-food-editor-favorite]').checked, active: true, createdAt: editingFoodId ? (foodById(editingFoodId)?.createdAt || '') : new Date().toISOString() };
    const saved = editingFoodId ? next.map((item) => item.id === editingFoodId ? data : item) : [...next, data];
    saveFoodLibrary(saved);
    if (pendingMealAfterCreate) { const day=Store.getDay(key()); persistMealFood(pendingMealAfterCreate,[...selectedFoodIds(day,pendingMealAfterCreate),data.id]); }
    closeFoodEditor(); renderFoodLibrary(); renderFoodPickers(Store.getDay(key()));
  });
  libraryList?.addEventListener('click', (event) => {
    const card=event.target.closest('[data-library-food-id]'); if(!card) return; const id=card.dataset.libraryFoodId;
    if(event.target.closest('[data-edit-food]')) openFoodEditor(id);
    if(event.target.closest('[data-toggle-food-favorite]')) saveFoodLibrary(foodLibrary().map((item)=>item.id===id?{...item,favorite:!item.favorite}:item));
    if(event.target.closest('[data-merge-food]')) {
      const source = foodById(id);
      const targetName = prompt(`Con quale alimento vuoi unire “${source?.name || ''}”? Scrivi il nome esatto.`);
      if (targetName) {
        const target = foodLibrary().find((item) => item.id !== id && item.active !== false && item.name.toLocaleLowerCase('it') === targetName.trim().toLocaleLowerCase('it'));
        if (!target) alert('Alimento di destinazione non trovato.');
        else if (confirm(`Unire “${source.name}” in “${target.name}”? Tutto lo storico verrà associato alla voce scelta.`)) {
          const state = Store.getState();
          Object.values(state.days || {}).forEach((day) => {
            Object.keys(day.mealItems || {}).forEach((meal) => {
              const ids = day.mealItems[meal] || [];
              if (ids.includes(id)) day.mealItems[meal] = [...new Set(ids.map((value) => value === id ? target.id : value))];
            });
          });
          state.settings.tracker.foodLibrary = state.settings.tracker.foodLibrary.map((item) => item.id === id ? { ...item, active:false } : item);
          Store.replaceState(state, 'food-library-merge');
        }
      }
    }
    if(event.target.closest('[data-delete-food]')) { if(confirm('Rimuovere questo alimento dalla libreria? Lo storico resterà intatto.')) saveFoodLibrary(foodLibrary().map((item)=>item.id===id?{...item,active:false}:item)); }
    renderFoodLibrary(); renderFoodPickers(Store.getDay(key()));
  });
  librarySearch?.addEventListener('input', renderFoodLibrary);
  libraryFilter?.addEventListener('change', renderFoodLibrary);
  function formatEntry(quarters) {
    const ml = Math.round(quarters * quarterMl());
    const base = quarters === 4 ? '1 borraccia' : formatWater(quarters);
    return trackerSettings().showWaterEquivalence === false ? base : `${base} · circa ${ml} ml`;
  }
  function renderDate() {
    page.querySelector('[data-food-weekday]').textContent = formatDate(selectedDate, { weekday: 'long' });
    page.querySelector('[data-food-date]').textContent = formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function renderMeals(day) {
    mealCards.forEach((card) => {
      const name = card.dataset.mealName;
      const meal = mealKey(name);
      const value = day.meals?.[meal] || '';
      const selectedCount = selectedFoodIds(day, meal).length;
      const textarea = card.querySelector('[data-meal-text]');
      const panel = card.querySelector('[data-meal-note-panel]');
      const toggle = card.querySelector('[data-toggle-meal-note]');
      if (textarea) textarea.value = value;
      if (panel) panel.hidden = !value;
      if (toggle) toggle.textContent = value ? 'Modifica la nota' : '+ Aggiungi una nota facoltativa';
      const hasMeal = Boolean(value || selectedCount);
      card.classList.toggle('is-saved', hasMeal);
      card.querySelector('[data-meal-status]').textContent = hasMeal ? 'Registrato' : 'Da compilare';
      const save = card.querySelector('[data-save-meal]');
      if (save) save.textContent = value ? 'Aggiorna nota' : 'Salva nota';
    });
  }
  function renderWater(day) {
    waterHistory.innerHTML = '';
    (day.water || []).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'water-history-row';
      row.dataset.waterEntry = '';
      row.dataset.entryId = entry.id;
      row.dataset.quarters = String(entry.quarters);
      row.innerHTML = `<span class="water-history-dot"></span><div><strong>${formatEntry(entry.quarters)}</strong></div><button type="button" data-water-delete aria-label="Elimina registrazione">×</button>`;
      waterHistory.append(row);
    });
    updateSummary(day);
  }
  function renderBeverages(day) {
    if (!beverageList) return;
    const entries = day.beverages || [];
    beverageList.innerHTML = entries.length ? entries.map((entry) => {
      const glasses = Math.max(1, Number(entry.glasses) || 1);
      const ml = glasses * (Number(entry.mlPerGlass) || glassMl());
      return `<div class="other-drink-row" data-beverage-id="${escapeHtml(entry.id)}"><span class="other-drink-icon">◌</span><div><strong>${escapeHtml(entry.name || 'Altra bevanda')}</strong><span>${glasses} ${glasses === 1 ? 'bicchiere' : 'bicchieri'} · circa ${new Intl.NumberFormat('it-IT').format(ml)} ml</span></div><button type="button" data-delete-beverage aria-label="Elimina ${escapeHtml(entry.name || 'bevanda')}">×</button></div>`;
    }).join('') : '<div class="other-drinks-empty"><span>Nessuna bevanda extra registrata.</span></div>';
  }
  function updateSummary(day = Store.getDay(key())) {
    const allowedMeals = visibleMealOrder();
    const meals = allowedMeals.filter((meal) => String(day.meals?.[meal] || '').trim() || (day.mealItems?.[meal] || []).length);
    const quarters = waterQuarters(day);
    page.querySelector('[data-meal-count]').textContent = String(meals.length);
    page.querySelector('[data-last-meal]').textContent = meals.at(-1) ? ({ breakfast: 'Colazione', lunch: 'Pranzo', dinner: 'Cena', snacks: 'Spuntino' }[meals.at(-1)] || '—') : '—';
    page.querySelector('[data-water-total]').textContent = formatWater(quarters);
    page.querySelector('[data-water-short]').textContent = quarters ? (quarters % 4 ? `${Math.floor(quarters / 4)} + ${quarters % 4}/4` : String(quarters / 4)) : '0';
    page.querySelector('[data-water-liters]').textContent = `circa ${waterLiters(quarters, bottleMl())}`;
    page.querySelector('[data-water-ml-short]').textContent = `circa ${waterLiters(quarters, bottleMl())}`;
    const last = day.water?.at(-1);
    page.querySelector('[data-last-water]').textContent = last ? formatEntry(last.quarters) : '—';
    const complete = Math.floor(quarters / 4);
    const rem = quarters % 4;
    page.querySelector('[data-water-progress]').textContent = quarters ? `${complete} complete${rem ? ` + ${rem}/4 della successiva` : ''}` : 'Nessuna acqua registrata';
    const visibleFill = quarters > 0 && rem === 0 ? 4 : rem;
    page.querySelectorAll('[data-bottle-segment]').forEach((segment) => segment.classList.toggle('filled', Number(segment.dataset.bottleSegment) <= visibleFill));
  }
  function renderWeeklyStats() {
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(selectedDate);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const records = dates.map((date) => ({
      date,
      key: Store.dateKey(date),
      day: Store.getDay(Store.dateKey(date))
    }));

    const waterValues = records.map(({ day }) => waterQuarters(day) / 4);
    const waterAverage = waterValues.reduce((sum, value) => sum + value, 0) / records.length;
    const waterMaximum = Math.max(2, ...waterValues);
    const waterAverageLabel = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(waterAverage);
    const waterHeading = page.querySelector('.water-week-card .week-card-heading > span');
    if (waterHeading) waterHeading.textContent = `Media ${waterAverageLabel}`;

    const waterBars = page.querySelector('.water-week-bars');
    if (waterBars) {
      waterBars.innerHTML = records.map(({ date, key: dateKeyValue }, index) => {
        const value = waterValues[index];
        const height = value ? Math.max(5, (value / waterMaximum) * 100) : 0;
        const valueLabel = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value);
        const dayLabel = capitalizeFirstLetter(new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date).replace('.', ''));
        return `<div class="water-week-item${dateKeyValue === key() ? ' active' : ''}"><span>${valueLabel}</span><div><i style="height:${height}%"></i></div><span class="secondary-text">${dayLabel}</span></div>`;
      }).join('');
      waterBars.setAttribute('aria-label', `Borracce bevute nei sette giorni fino al ${formatDate(selectedDate, { day: 'numeric', month: 'long' })}`);
    }

    const mealKeys = visibleMealOrder();
    const mealTotal = records.reduce((total, { day }) => total + mealKeys.filter((meal) => (String(day.meals?.[meal] || '').trim() || (day.mealItems?.[meal] || []).length)).length, 0);
    const mealHeading = page.querySelector('.meal-week-card .week-card-heading > span');
    if (mealHeading) mealHeading.textContent = `${mealTotal} ${mealTotal === 1 ? 'registrazione' : 'registrazioni'}`;

    const mealTable = page.querySelector('.meal-week-table');
    if (mealTable) {
      const rows = records.map(({ date, key: dateKeyValue, day }) => {
        const dayLabel = capitalizeFirstLetter(new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date).replace('.', ''));
        const cells = mealKeys.map((meal) => (String(day.meals?.[meal] || '').trim() || (day.mealItems?.[meal] || []).length) ? '✓' : '—');
        return `<div class="meal-week-row${dateKeyValue === key() ? ' active' : ''}" role="row"><strong>${dayLabel}</strong>${cells.map((cell) => `<i>${cell}</i>`).join('')}</div>`;
      }).join('');
      const shortLabels = { breakfast: 'Col.', lunch: 'Pranzo', dinner: 'Cena', snacks: 'Snack' };
      mealTable.style.setProperty('--meal-columns', String(mealKeys.length));
      mealTable.innerHTML = `<div class="meal-week-row meal-week-head" role="row"><span>Giorno</span>${mealKeys.map((meal) => `<span>${shortLabels[meal]}</span>`).join('')}</div>${rows}`;
      mealTable.setAttribute('aria-label', `Pasti registrati nei sette giorni fino al ${formatDate(selectedDate, { day: 'numeric', month: 'long' })}`);
    }
  }

  function loadDay() {
    const day = Store.getDay(key());
    applyFoodSettings();
    renderDate(); renderMeals(day); renderFoodPickers(day); renderFoodLibrary(); renderWater(day); renderBeverages(day); renderWeeklyStats();
    page.querySelector('[data-meal-feedback]').textContent = dayHasData(day) ? 'Dati caricati e pronti per essere aggiornati.' : 'Nessun pasto registrato per questa giornata.';
    page.querySelector('[data-water-feedback]').textContent = `${trackerSettings().waterDivision === 'halves' ? 'Ogni metà' : 'Ogni quarto'} corrisponde a ${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(trackerSettings().waterDivision === 'halves' ? quarterMl() * 2 : quarterMl())} ml.`;
  }

  mealCards.forEach((card) => card.querySelector('[data-toggle-meal-note]')?.addEventListener('click', () => {
    const panel = card.querySelector('[data-meal-note-panel]');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) card.querySelector('[data-meal-text]')?.focus();
  }));

  mealCards.forEach((card) => card.querySelector('[data-save-meal]')?.addEventListener('click', () => {
    const name = card.dataset.mealName;
    const value = card.querySelector('[data-meal-text]').value.trim();
    Store.updateDay(key(), (day) => ({ ...day, meals: { ...day.meals, [mealKey(name)]: value } }), 'meal-save');
    const nextDay = Store.getDay(key());
    renderMeals(nextDay); renderFoodPickers(nextDay); updateSummary(nextDay); renderWeeklyStats();
    if (!value) card.querySelector('[data-meal-note-panel]')?.setAttribute('hidden', '');
    page.querySelector('[data-meal-feedback]').textContent = value ? `Nota di ${name.toLowerCase()} salvata.` : `Nota di ${name.toLowerCase()} rimossa.`;
  }));
  page.querySelectorAll('[data-water-add]').forEach((button) => button.addEventListener('click', () => {
    const quarters = Number(button.dataset.waterAdd) || 0;
    Store.updateDay(key(), (day) => ({ ...day, water: [...day.water, { id: uid('water'), quarters, createdAt: new Date().toISOString() }] }), 'water-add');
    renderWater(Store.getDay(key())); renderWeeklyStats();
    page.querySelector('[data-water-feedback]').textContent = `${formatEntry(quarters)} aggiunti.`;
  }));
  waterHistory.addEventListener('click', (event) => {
    const button = event.target.closest('[data-water-delete]');
    if (!button) return;
    const id = button.closest('[data-entry-id]')?.dataset.entryId;
    Store.updateDay(key(), (day) => ({ ...day, water: day.water.filter((entry) => entry.id !== id) }), 'water-delete');
    renderWater(Store.getDay(key())); renderWeeklyStats();
  });
  page.querySelector('[data-water-undo]')?.addEventListener('click', () => {
    Store.updateDay(key(), (day) => ({ ...day, water: day.water.slice(0, -1) }), 'water-undo');
    renderWater(Store.getDay(key())); renderWeeklyStats();
  });
  page.querySelector('[data-add-beverage]')?.addEventListener('click', () => {
    const name = beverageName?.value.trim() || '';
    const glasses = Math.max(1, Math.min(20, Number(beverageGlassesInput?.value) || 1));
    if (!name) { if (beverageFeedback) beverageFeedback.textContent = 'Scrivi il nome della bevanda.'; beverageName?.focus(); return; }
    Store.updateDay(key(), (day) => ({ ...day, beverages: [...(day.beverages || []), { id: uid('beverage'), name, glasses, mlPerGlass: glassMl(), createdAt: new Date().toISOString() }] }), 'beverage-add');
    if (beverageName) beverageName.value = '';
    if (beverageGlassesInput) beverageGlassesInput.value = '1';
    renderBeverages(Store.getDay(key()));
    if (beverageFeedback) beverageFeedback.textContent = `${name}: ${glasses} ${glasses === 1 ? 'bicchiere aggiunto' : 'bicchieri aggiunti'}.`;
  });
  beverageList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-beverage]');
    if (!button) return;
    const id = button.closest('[data-beverage-id]')?.dataset.beverageId;
    Store.updateDay(key(), (day) => ({ ...day, beverages: (day.beverages || []).filter((entry) => entry.id !== id) }), 'beverage-delete');
    renderBeverages(Store.getDay(key()));
    if (beverageFeedback) beverageFeedback.textContent = 'Bevanda rimossa.';
  });
  page.querySelectorAll('[data-food-date-shift]').forEach((button) => button.addEventListener('click', () => { selectedDate.setDate(selectedDate.getDate() + Number(button.dataset.foodDateShift)); loadDay(); }));
  page.querySelector('[data-food-today]')?.addEventListener('click', () => { selectedDate = new Date(); loadDay(); });
  loadDay();
  window.addEventListener('tracker:data-changed', (event) => {
    if (['settings-update', 'remote-pull', 'import', 'reset'].includes(event.detail?.reason)) loadDay();
  });
})();

// Tetr-Emotion.
(() => {
  const page = document.querySelector('.tetr-page');
  if (!page) return;
  const COLS = 10;
  const ROWS = 20;
  const boardElement = page.querySelector('[data-tetr-board]');
  const tooltip = page.querySelector('[data-tetr-tooltip]');
  const feedback = page.querySelector('[data-tetr-feedback]');
  const boardStatus = page.querySelector('[data-tetr-board-status]');
  const boardTitle = page.querySelector('[data-tetr-board-title]');
  const monthLabel = page.querySelector('[data-tetr-month]');
  const selectedDateLabel = page.querySelector('[data-tetr-today-date]');
  const currentEmotionLabel = page.querySelector('[data-current-emotion]');
  const currentPieceCopy = page.querySelector('[data-current-piece-copy]');
  const noteField = page.querySelector('[data-tetr-note]');
  const noteSaveButton = page.querySelector('[data-save-tetr-note]');
  const placeButton = page.querySelector('[data-tetr-place]');
  const confirmOverlay = page.querySelector('[data-tetr-confirm-overlay]');
  const confirmPreview = page.querySelector('[data-confirm-preview]');
  const confirmEmotion = page.querySelector('[data-confirm-emotion]');
  const confirmSaveButton = page.querySelector('[data-confirm-save]');
  const lastPieceActions = page.querySelector('[data-last-piece-actions]');
  const nextDayButton = page.querySelector('[data-tetr-day-shift="1"]');
  if (!boardElement) return;

  const tetrSettings = () => trackerSettings().tracker?.tetr || {};
  function applyTetrSettings() {
    const settings = tetrSettings();
    const noteLabel = noteField?.closest('.tetr-note-field');
    const noteHelper = page.querySelector('.tetr-note-helper');
    if (noteLabel) noteLabel.hidden = settings.note === false;
    if (noteHelper) noteHelper.hidden = settings.note === false;
    if (noteSaveButton) noteSaveButton.hidden = settings.note === false;
    const modeCopy = settings.keyboard === false
      ? 'Clicca una colonna per scegliere la posizione. Doppio clic per ruotare e usa il pulsante per confermare.'
      : 'Clicca una colonna per scegliere la posizione. Doppio clic per ruotare e premi Invio per confermare.';
    if (currentPieceCopy && current) currentPieceCopy.textContent = modeCopy;
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayKey = Store.dateKey(today);
  let selectedDate = dateFromQuery();
  selectedDate.setHours(12, 0, 0, 0);
  let selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let placedPieces = [];
  let selectedEmotion = 'productive';
  let current = null;
  let selectedNoteDate = null;

  const normalizeShape = (shape) => {
    const minX = Math.min(...shape.map(([x]) => x));
    const minY = Math.min(...shape.map(([, y]) => y));
    return shape.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  };
  const rotateShape = (shape, piece) => piece === 'O' ? shape.map((point) => [...point]) : normalizeShape(shape.map(([x, y]) => [-y, x]));
  const getBounds = (shape) => ({ width: Math.max(...shape.map(([x]) => x)) + 1, height: Math.max(...shape.map(([, y]) => y)) + 1 });
  const canPlace = (shape, x, y) => shape.every(([dx, dy]) => {
    const bx = x + dx; const by = y + dy;
    return bx >= 0 && bx < COLS && by >= 0 && by < ROWS && !board[by][bx];
  });
  const getDropY = (piece = current) => {
    if (!piece) return 0;
    let y = piece.y;
    while (canPlace(piece.shape, piece.x, y + 1)) y += 1;
    return y;
  };
  const monthKey = () => Store.monthKey(selectedMonth);
  const selectedKey = () => Store.dateKey(selectedDate);
  const selectedEntry = () => Store.getDay(selectedKey()).tetr;
  const isFutureDay = () => selectedKey() > todayKey;
  const canAddSelectedDay = () => {
    if (selectedEntry() || isFutureDay()) return false;
    const last = placedPieces.at(-1);
    return !last || selectedKey() > last.date;
  };

  function buildMini(container, pieceKey, color) {
    if (!container) return;
    container.innerHTML = '';
    container.style.setProperty('--emotion-color', color || 'currentColor');
    BASE_SHAPES[pieceKey].forEach(([x, y]) => {
      const cell = document.createElement('i');
      cell.className = container.classList.contains('tetr-confirm-piece') ? 'tetr-preview-cell' : 'tetr-mini-cell';
      const size = cell.className === 'tetr-preview-cell' ? 31 : 19;
      cell.style.left = `${x * size}px`; cell.style.top = `${y * size}px`;
      container.append(cell);
    });
  }
  page.querySelectorAll('[data-mini-piece]').forEach((element) => {
    const emotion = EMOTIONS[element.closest('[data-emotion]')?.dataset.emotion];
    buildMini(element, element.dataset.miniPiece, emotion?.color);
  });

  function syncEmotionSelection(emotionKey) {
    page.querySelectorAll('[data-emotion]').forEach((button) => {
      const selected = button.dataset.emotion === emotionKey;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
  }

  function loadBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    placedPieces = [];
    const days = Store.monthDays(monthKey()).filter((day) => day.tetr).sort((a, b) => a.date.localeCompare(b.date));
    days.forEach((day, index) => {
      const entry = { ...day.tetr, date: day.date, pieceId: index + 1 };
      const emotion = EMOTIONS[entry.emotionKey];
      const cells = Array.isArray(entry.cells) ? entry.cells : [];
      if (cells.length !== 4 || !emotion) return;
      cells.forEach(([row, col]) => {
        if (board[row] && col >= 0 && col < COLS) board[row][col] = { ...entry, label: emotion.label, color: emotion.color, piece: emotion.piece };
      });
      placedPieces.push(entry);
    });

    const entry = selectedEntry();
    selectedNoteDate = entry ? selectedKey() : null;
    noteField.value = entry?.note || '';
    const last = placedPieces.at(-1);
    const canEditLast = Boolean(entry && last?.date === selectedKey());
    lastPieceActions.hidden = !canEditLast;
    noteSaveButton.disabled = !entry;
    noteSaveButton.textContent = entry?.note ? 'Aggiorna nota' : 'Salva nota';
  }

  function setCurrent(emotionKey, { preserveNote = true } = {}) {
    if (!canAddSelectedDay()) return;
    selectedEmotion = emotionKey;
    const emotion = EMOTIONS[emotionKey];
    const shape = BASE_SHAPES[emotion.piece].map((point) => [...point]);
    const bounds = getBounds(shape);
    current = { emotionKey, shape, x: Math.floor((COLS - bounds.width) / 2), y: 0 };
    syncEmotionSelection(emotionKey);
    if (!preserveNote) noteField.value = '';
    currentEmotionLabel.textContent = emotion.label;
    currentPieceCopy.textContent = tetrSettings().keyboard === false ? 'Clicca una colonna per scegliere la posizione. Doppio clic per ruotare e usa il pulsante per confermare.' : 'Clicca una colonna per scegliere la posizione. Doppio clic per ruotare e premi Invio per confermare.';
    confirmEmotion.textContent = emotion.label;
    buildMini(confirmPreview, emotion.piece, emotion.color);
    placeButton.disabled = false;
    feedback.textContent = `${emotion.label} selezionata per il ${formatDate(selectedDate, { day: 'numeric', month: 'long' })}.`;
    renderBoard();
  }

  function renderBoard() {
    boardElement.innerHTML = '';
    const ghostY = current ? getDropY(current) : null;
    const currentCells = new Set();
    const ghostCells = new Set();
    if (current) current.shape.forEach(([dx, dy]) => {
      currentCells.add(`${current.x + dx},${current.y + dy}`);
      ghostCells.add(`${current.x + dx},${ghostY + dy}`);
    });
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = document.createElement('div');
        cell.className = 'tetr-cell'; cell.dataset.x = x; cell.dataset.y = y; cell.setAttribute('role', 'gridcell');
        const locked = board[y][x]; const key = `${x},${y}`;
        if (locked) {
          cell.classList.add('is-filled');
          cell.style.setProperty('--cell-color', locked.color);
          cell.dataset.pieceId = locked.pieceId;
          cell.dataset.date = locked.date;
          const dateLabel = formatDate(locked.date, { weekday: 'long', day: 'numeric', month: 'long' });
          cell.dataset.tooltip = `${locked.label}|${locked.note || ''}`;
          if (locked.date === todayKey && tetrSettings().highlightToday !== false) cell.classList.add('is-today-piece');
        } else if (current && currentCells.has(key)) {
          cell.classList.add('is-current'); cell.style.setProperty('--cell-color', EMOTIONS[current.emotionKey].color);
        } else if (current && ghostCells.has(key) && tetrSettings().ghost !== false) {
          cell.classList.add('is-ghost'); cell.style.setProperty('--cell-color', EMOTIONS[current.emotionKey].color);
        }
        boardElement.append(cell);
      }
    }
    boardStatus.textContent = `${placedPieces.length} ${placedPieces.length === 1 ? 'pezzo posizionato' : 'pezzi posizionati'}`;
    placeButton.disabled = !current;
    renderSummary();
  }

  function renderLabels() {
    const formatted = formatDate(selectedMonth, { month: 'long', year: 'numeric' });
    const monthName = formatted.replace(/\s\d{4}$/, '');
    monthLabel.textContent = formatted;
    boardTitle.textContent = `La composizione di ${monthName}`;
    page.querySelector('#tetr-summary-title').textContent = `Le emozioni di ${monthName}`;
    selectedDateLabel.textContent = formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' });
    if (nextDayButton) nextDayButton.disabled = selectedKey() >= todayKey;
    page.querySelectorAll('[data-emotion]').forEach((button) => { button.disabled = !canAddSelectedDay(); });
  }

  function renderSummary() {
    const counts = Object.fromEntries(Object.keys(EMOTIONS).map((key) => [key, 0]));
    placedPieces.forEach((record) => { counts[record.emotionKey] += 1; });
    const most = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    page.querySelector('[data-tetr-most-common]').textContent = most[1] ? EMOTIONS[most[0]].label : '—';
    page.querySelector('[data-tetr-most-common-detail]').textContent = `${most[1]} ${most[1] === 1 ? 'giorno' : 'giorni'} nel mese`;
    page.querySelector('[data-tetr-days-count]').textContent = String(placedPieces.length);
    let best = { length: 0, emotionKey: null }; let run = { length: 0, emotionKey: null };
    placedPieces.forEach((record) => {
      run = run.emotionKey === record.emotionKey ? { ...run, length: run.length + 1 } : { length: 1, emotionKey: record.emotionKey };
      if (run.length > best.length) best = { ...run };
    });
    page.querySelector('[data-tetr-longest-streak]').textContent = `${best.length} ${best.length === 1 ? 'giorno' : 'giorni'}`;
    page.querySelector('[data-tetr-streak-detail]').textContent = best.emotionKey ? EMOTIONS[best.emotionKey].label : '—';
    const max = Math.max(1, ...Object.values(counts));
    const bars = page.querySelector('[data-tetr-summary-bars]'); bars.innerHTML = '';
    Object.entries(EMOTIONS).forEach(([key, emotion]) => {
      const row = document.createElement('div'); row.className = 'tetr-bar-row';
      row.innerHTML = `<span>${emotion.label}</span><div class="tetr-bar-track"><i style="--bar-color:${emotion.color};width:${(counts[key] / max) * 100}%"></i></div><strong>${counts[key]} ${counts[key] === 1 ? 'giorno' : 'giorni'}</strong>`;
      bars.append(row);
    });
  }

  function initializeDay() {
    current = null;
    applyTetrSettings();
    loadBoard();
    renderLabels();
    renderBoard();
    const entry = selectedEntry();
    if (canAddSelectedDay()) {
      setCurrent(selectedEmotion, { preserveNote: false });
    } else if (entry) {
      selectedEmotion = entry.emotionKey;
      syncEmotionSelection(entry.emotionKey);
      const emotion = EMOTIONS[entry.emotionKey];
      currentEmotionLabel.textContent = emotion?.label || 'Emozione registrata';
      currentPieceCopy.textContent = 'Il pezzo di questa giornata è già stato salvato. La nota può essere aggiornata anche in seguito.';
      feedback.textContent = 'Giornata caricata dai dati salvati.';
    } else if (isFutureDay()) {
      syncEmotionSelection(null);
      currentEmotionLabel.textContent = 'Giornata futura';
      currentPieceCopy.textContent = 'Puoi consultare la data, ma il pezzo si potrà inserire quando arriverà questa giornata.';
      feedback.textContent = 'Non è possibile registrare emozioni nei giorni futuri.';
    } else {
      syncEmotionSelection(null);
      currentEmotionLabel.textContent = 'Giornata precedente';
      currentPieceCopy.textContent = 'Per mantenere valida la composizione, non puoi aggiungere un pezzo prima di quelli già posizionati dopo questa data.';
      feedback.textContent = 'Puoi comunque consultare la griglia e le giornate già registrate.';
    }
  }

  function moveCurrentToColumn(column) {
    if (!current) return;
    const bounds = getBounds(current.shape);
    const wantedX = Math.max(0, Math.min(COLS - bounds.width, column - Math.floor(bounds.width / 2)));
    const candidates = Array.from({ length: COLS - bounds.width + 1 }, (_, x) => x).sort((a, b) => Math.abs(a - wantedX) - Math.abs(b - wantedX));
    const validX = candidates.find((x) => canPlace(current.shape, x, current.y));
    if (validX !== undefined) { current.x = validX; renderBoard(); feedback.textContent = 'Posizione aggiornata.'; }
  }
  function moveCurrent(dx) { if (current && canPlace(current.shape, current.x + dx, current.y)) { current.x += dx; renderBoard(); } }
  function rotateCurrent() {
    if (!current) return;
    const emotion = EMOTIONS[current.emotionKey];
    const rotated = rotateShape(current.shape, emotion.piece);
    const kick = [0, -1, 1, -2, 2].find((value) => canPlace(rotated, current.x + value, current.y));
    if (kick !== undefined) { current.shape = rotated; current.x += kick; renderBoard(); feedback.textContent = emotion.piece === 'O' ? 'Il tetramino O mantiene la stessa forma.' : 'Pezzo ruotato.'; }
    else feedback.textContent = 'Qui il pezzo non può ruotare.';
  }
  function openConfirmation() { if (current) { confirmOverlay.hidden = false; setTimeout(() => confirmSaveButton.focus(), 0); } }
  function lockCurrent() {
    if (!current) return;
    const emotion = EMOTIONS[current.emotionKey];
    const dropY = getDropY(current);
    const cells = current.shape.map(([dx, dy]) => [dropY + dy, current.x + dx]);
    const rotationShape = current.shape.map((point) => [...point]);
    const dateKey = selectedKey();
    Store.updateDay(dateKey, (day) => ({ ...day, tetr: {
      emotionKey: current.emotionKey, piece: emotion.piece, color: emotion.color, colorName: emotion.colorName,
      shape: rotationShape, x: current.x, y: dropY, cells, note: noteField.value.trim(), createdAt: new Date().toISOString()
    } }), 'tetr-save');
    confirmOverlay.hidden = true;
    feedback.textContent = `${emotion.label} salvata per il ${formatDate(selectedDate, { day: 'numeric', month: 'long' })}.`;
    initializeDay();
  }
  function updateNote() {
    if (!selectedNoteDate) return;
    const noteDate = selectedNoteDate;
    Store.updateDay(noteDate, (day) => ({ ...day, tetr: day.tetr ? { ...day.tetr, note: noteField.value.trim() } : null }), 'tetr-note');
    feedback.textContent = noteField.value.trim() ? 'Nota salvata.' : 'Nota rimossa. Potrai aggiungerla nuovamente.';
    initializeDay();
  }
  function removeLast({ restore = false } = {}) {
    const last = placedPieces.at(-1);
    const dateKey = selectedKey();
    if (!last || last.date !== dateKey) return;
    const old = Store.getDay(dateKey).tetr;
    Store.updateDay(dateKey, (day) => ({ ...day, tetr: null }), 'tetr-remove');
    initializeDay();
    if (restore && old) {
      setCurrent(old.emotionKey);
      current.shape = (old.shape || BASE_SHAPES[old.piece]).map((point) => [...point]);
      current.x = Math.min(old.x || 0, COLS - getBounds(current.shape).width);
      noteField.value = old.note || '';
      feedback.textContent = 'Ultimo pezzo riaperto: puoi riposizionarlo e salvarlo di nuovo.';
    } else feedback.textContent = 'Ultimo pezzo rimosso.';
  }

  page.querySelectorAll('[data-emotion]').forEach((button) => button.addEventListener('click', () => setCurrent(button.dataset.emotion)));
  boardElement.addEventListener('click', (event) => {
    const cell = event.target.closest('.tetr-cell'); if (!cell) return;
    if (current) moveCurrentToColumn(Number(cell.dataset.x));
    else if (cell.dataset.date) {
      selectedDate = new Date(`${cell.dataset.date}T12:00:00`);
      selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      initializeDay();
    }
  });
  boardElement.addEventListener('dblclick', (event) => { if (event.target.closest('.tetr-cell') && current) { event.preventDefault(); rotateCurrent(); } });
  placeButton.addEventListener('click', () => { if (tetrSettings().confirm === false) lockCurrent(); else openConfirmation(); });
  noteSaveButton.addEventListener('click', updateNote);
  page.querySelector('[data-confirm-back]').addEventListener('click', () => { confirmOverlay.hidden = true; });
  confirmSaveButton.addEventListener('click', lockCurrent);
  page.querySelector('[data-edit-last-piece]').addEventListener('click', () => removeLast({ restore: true }));
  page.querySelector('[data-remove-last-piece]').addEventListener('click', () => removeLast());
  confirmOverlay.addEventListener('click', (event) => { if (event.target === confirmOverlay) confirmOverlay.hidden = true; });

  function highlightWholePiece(pieceId) {
    boardElement.querySelectorAll('.is-piece-hovered').forEach((cell) => cell.classList.remove('is-piece-hovered'));
    if (pieceId) boardElement.querySelectorAll(`[data-piece-id="${pieceId}"]`).forEach((cell) => cell.classList.add('is-piece-hovered'));
  }
  boardElement.addEventListener('mousemove', (event) => {
    const cell = event.target.closest('.tetr-cell[data-tooltip]');
    if (!cell) { highlightWholePiece(null); tooltip.hidden = true; return; }
    if (trackerSettings().appearance?.tetrHover !== false) highlightWholePiece(cell.dataset.pieceId); else highlightWholePiece(null);
    const parts = cell.dataset.tooltip.split('|');
    tooltip.innerHTML = `<strong>${escapeHtml(parts[0])}</strong>${parts[1] ? `<span class="tetr-tooltip-note">${escapeHtml(parts[1])}</span>` : ''}`;
    tooltip.hidden = false; tooltip.style.left = `${event.clientX + 16}px`; tooltip.style.top = `${event.clientY + 16}px`;
  });
  boardElement.addEventListener('mouseleave', () => { highlightWholePiece(null); tooltip.hidden = true; });

  page.querySelectorAll('[data-tetr-day-shift]').forEach((button) => button.addEventListener('click', () => {
    const shift = Number(button.dataset.tetrDayShift);
    if (shift > 0 && selectedKey() >= todayKey) return;
    selectedDate.setDate(selectedDate.getDate() + shift);
    selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    initializeDay();
  }));
  page.querySelectorAll('[data-tetr-month-shift]').forEach((button) => button.addEventListener('click', () => {
    const target = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + Number(button.dataset.tetrMonthShift), 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    selectedDate = new Date(target.getFullYear(), target.getMonth(), Math.min(selectedDate.getDate(), lastDay), 12);
    selectedMonth = target;
    initializeDay();
  }));
  page.querySelector('[data-tetr-today]').addEventListener('click', () => {
    selectedDate = new Date(today);
    selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    initializeDay();
  });
  document.addEventListener('keydown', (event) => {
    if (tetrSettings().keyboard === false || event.target.matches('input, textarea, select, button') || !current || !confirmOverlay.hidden) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft') moveCurrent(-1);
    if (event.key === 'ArrowRight') moveCurrent(1);
    if (event.key === 'ArrowUp') rotateCurrent();
    if (event.key === 'Enter') { if (tetrSettings().confirm === false) lockCurrent(); else openConfirmation(); }
  });
  initializeDay();
  window.addEventListener('tracker:data-changed', (event) => {
    if (['settings-update', 'remote-pull', 'import', 'reset'].includes(event.detail?.reason)) initializeDay();
  });
})();

// Homepage con dati reali.
(() => {
  const page = document.querySelector('.home-page');
  if (!page) return;
  const today = new Date();
  const todayKey = Store.dateKey(today);

  function completionStatus(day) {
    const missing = [];
    if (!day.sleep) missing.push('sonno');
    if (!waterQuarters(day) && !Object.values(day.meals || {}).some(Boolean) && !(day.beverages || []).length) missing.push('cibo e acqua');
    if (!(day.activities || []).length) missing.push('giornata');
    if (!day.tetr) missing.push('Tetr-Emotion');
    return { complete: missing.length === 0, missing };
  }

  function update() {
    const state = Store.getState();
    const homeSettings = state.settings.home || {};
    const setVisible = (selector, visible) => { const element = page.querySelector(selector); if (element) element.hidden = visible === false; };
    setVisible('.weather-card', homeSettings.weather);
    setVisible('.summary-section', homeSettings.summary);
    setVisible('.complete-panel', homeSettings.reminders);
    setVisible('.sections-band', homeSettings.sections);
    setVisible('.trends-section', homeSettings.trends);
    setVisible('.recent-band', homeSettings.recentDays);
    setVisible('.home-tetr-summary', homeSettings.tetrToday);
    setVisible('.home-tetr-week', homeSettings.tetrWeek);
    const tetrReminder = page.querySelector('.complete-panel-items .quick-status[href="tetr-emotion.html"]');
    if (tetrReminder) tetrReminder.hidden = homeSettings.tetrReminder === false;
    const day = Store.getDay(todayKey);
    const cards = [...page.querySelectorAll('.summary-card')];
    const sleepCard = cards.find((card) => card.getAttribute('href') === 'sonno.html');
    const foodCard = cards.find((card) => card.getAttribute('href') === 'cibo-acqua.html');
    const dayCard = cards.find((card) => card.getAttribute('href') === 'giornata.html');
    const tetrCard = cards.find((card) => card.getAttribute('href') === 'tetr-emotion.html');

    const setCard = (card, value, detail, saved) => {
      if (!card) return;
      card.querySelector('strong:not(.summary-label)')?.replaceChildren(document.createTextNode(value));
      const secondary = card.querySelector('.secondary-text');
      if (secondary) secondary.textContent = detail;
      const tag = card.querySelector('.data-tag');
      if (tag) tag.textContent = saved ? 'Salvato' : 'Da compilare';
    };

    setCard(sleepCard, day.sleep ? formatMinutes(day.sleep.duration) : '—', day.sleep ? `Energie ${sleepEnergy(day.sleep) || '—'}/5` : 'Nessuna notte registrata', Boolean(day.sleep));
    const mealCount = MEAL_ORDER.filter((meal) => String(day.meals?.[meal] || '').trim() || (day.mealItems?.[meal] || []).length).length;
    const quarters = waterQuarters(day);
    const extraGlasses = beverageGlasses(day);
    const foodValue = `${mealCount} pasti · ${waterLiters(quarters, state.settings.bottleMl)}`;
    const foodDetail = extraGlasses ? `${extraGlasses} ${extraGlasses === 1 ? 'bicchiere extra' : 'bicchieri extra'}` : (quarters || mealCount ? 'Dati aggiornati oggi' : 'Nessun dato registrato');
    setCard(foodCard, foodValue, foodDetail, Boolean(quarters || mealCount || extraGlasses));
    const totalActivity = (day.activities || []).reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    setCard(dayCard, `${(day.activities || []).length} attività`, totalActivity ? `${formatMinutes(totalActivity)} di tempo registrato` : 'Nessuna durata registrata', Boolean((day.activities || []).length));
    const emotion = day.tetr ? EMOTIONS[day.tetr.emotionKey] : null;
    setCard(tetrCard, emotion?.label || '—', emotion ? 'Emozione di oggi' : 'Emozione non registrata', Boolean(emotion));
    if (tetrCard) {
      const icon = tetrCard.querySelector('.summary-tetr-icon');
      if (icon) icon.innerHTML = emotion ? tetrominoMarkup(day.tetr, 11) : '<span class="empty-tetr-piece">—</span>';
    }

    const quick = [...page.querySelectorAll('.complete-panel-items .quick-status')];
    const statuses = [
      { done: Boolean(day.sleep), title: day.sleep ? 'Sonno registrato' : 'Registra il sonno', detail: day.sleep ? formatMinutes(day.sleep.duration) : 'Ultima notte mancante' },
      { done: Boolean(quarters || extraGlasses), title: quarters ? 'Acqua aggiornata' : (extraGlasses ? 'Bevande registrate' : 'Aggiorna cibo e acqua'), detail: quarters ? formatWater(quarters) : (extraGlasses ? `${extraGlasses} bicchieri extra` : 'Nessuna bevuta registrata') },
      { done: Boolean(day.tetr), title: day.tetr ? 'Tetr-Emotion registrata' : 'Aggiungi Tetr-Emotion', detail: emotion ? emotion.label : 'Manca il pezzo di oggi' }
    ];
    quick.forEach((item, index) => {
      const status = statuses[index];
      if (!status) return;
      item.classList.toggle('is-done', status.done);
      item.querySelector('.quick-status-icon').textContent = status.done ? '✓' : '+';
      item.querySelector('strong').textContent = status.title;
      item.querySelector('.secondary-text').textContent = status.detail;
    });

    const last7 = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      last7.push({ date, day: Store.getDay(Store.dateKey(date)) });
    }
    const tetrDays = page.querySelector('.home-tetr-days');
    if (tetrDays) {
      tetrDays.innerHTML = last7.map(({ date, day: data }) => `<span title="${formatDate(date, { weekday: 'long' })}${data.tetr ? ` · ${EMOTIONS[data.tetr.emotionKey].label}` : ' · non registrata'}"><b>${formatDate(date, { weekday: 'short' }).slice(0, 3)}</b>${data.tetr ? tetrominoMarkup(data.tetr, 9) : '<span class="home-tetr-empty">—</span>'}</span>`).join('');
    }
    const columns = [...page.querySelectorAll('.flat-chart-column')];
    columns.forEach((column, index) => {
      const data = last7[index]?.day;
      const sleepHeight = data?.sleep?.duration ? Math.min(100, (data.sleep.duration / 600) * 100) : 0;
      const waterHeight = Math.min(100, (waterQuarters(data) / 8) * 100);
      const sleepBar = column.querySelector('.bar-sleep');
      const waterBar = column.querySelector('.bar-water');
      if (sleepBar) { sleepBar.style.height = `${sleepHeight}%`; sleepBar.title = data?.sleep ? formatMinutes(data.sleep.duration) : 'Nessun dato'; }
      if (waterBar) { waterBar.style.height = `${waterHeight}%`; waterBar.title = formatWater(waterQuarters(data)); }
      const label = column.querySelector('span');
      if (label) label.textContent = formatDate(last7[index].date, { weekday: 'short' }).slice(0, 3);
    });

    const sleepValues = last7.filter(({ day: data }) => data.sleep?.duration).map(({ day: data }) => Number(data.sleep.duration));
    const waterValues = last7.filter(({ day: data }) => waterQuarters(data) > 0).map(({ day: data }) => waterQuarters(data));
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const metricCards = [...page.querySelectorAll('.metric-stack .metric-card')];
    if (metricCards[0]) {
      metricCards[0].querySelector('strong').textContent = sleepValues.length ? formatMinutes(average(sleepValues)) : '—';
      metricCards[0].querySelector('.secondary-text').textContent = sleepValues.length ? `${sleepValues.length} notti registrate` : 'Nessun sonno registrato';
    }
    if (metricCards[1]) {
      metricCards[1].querySelector('strong').textContent = waterValues.length ? waterLiters(average(waterValues), state.settings.bottleMl) : '—';
      metricCards[1].querySelector('.secondary-text').textContent = `${waterValues.length} giorni su 7 registrati`;
    }
    if (metricCards[2]) {
      const completed = last7.filter(({ day: data }) => completionStatus(data).complete).length;
      metricCards[2].querySelector('strong').textContent = `${completed} su 7`;
      metricCards[2].querySelector('.secondary-text').textContent = 'Giornate con tutte le sezioni compilate';
    }

    const recentList = page.querySelector('.recent-list');
    if (recentList) {
      const recentDays = Object.values(state.days)
        .filter(dayHasData)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);
      recentList.innerHTML = recentDays.length ? recentDays.map((recentDay) => {
        const date = new Date(`${recentDay.date}T12:00:00`);
        const meals = Object.values(recentDay.meals || {}).filter(Boolean).length;
        const emotionData = recentDay.tetr ? EMOTIONS[recentDay.tetr.emotionKey] : null;
        const status = completionStatus(recentDay);
        const statusText = status.complete ? 'Giornata completa' : `Manca ${status.missing[0] || 'qualche dato'}`;
        return `<a class="recent-row" href="archivio.html?date=${recentDay.date}">
          <div class="recent-date"><strong>${date.getDate()}</strong><span>${formatDate(date, { weekday: 'long' })} · ${formatDate(date, { month: 'long' })}</span></div>
          <div class="recent-chips"><span>${recentDay.sleep ? formatMinutes(recentDay.sleep.duration) : 'Sonno —'}</span><span>${waterLiters(waterQuarters(recentDay), state.settings.bottleMl)}</span><span>${beverageGlasses(recentDay)} bicch. extra</span><span>${meals} ${meals === 1 ? 'pasto' : 'pasti'}</span><span>${recentDay.activities.length} attività</span><span class="recent-emotion-chip${emotionData ? '' : ' is-missing'}">${emotionData ? `${tetrominoMarkup(recentDay.tetr, 7)}${emotionData.label}` : 'Tetr-Emotion non inserita'}</span></div>
          <div class="recent-status"><span>${statusText}</span><b>→</b></div>
        </a>`;
      }).join('') : '<div class="tracker-empty-state"><strong>Nessuna giornata salvata</strong><span>Le giornate compariranno qui dopo le prime registrazioni.</span></div>';
    }

    page.querySelectorAll('.data-tag').forEach((tag) => tag.classList.add('is-live'));
    const chartSubtitle = page.querySelector('.chart-panel-header div span');
    if (chartSubtitle) chartSubtitle.textContent = 'Dati salvati negli ultimi sette giorni';
  }
  update();
  window.addEventListener('tracker:data-changed', update);
})();

// Statistiche.
(() => {
  const page = document.querySelector('.stats-page');
  if (!page) return;
  const periodSelect = page.querySelector('[data-stats-period]');
  const comparison = page.querySelector('[data-comparison-section]');

  const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  function workMinutes(day) {
    return (day.activities || []).filter((item) => isWorkCategory(item.category)).reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
  }
  function activityMinutes(day) {
    return (day.activities || []).reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
  }
  function timeLabel(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) return '—';
    const value = Math.round(totalMinutes) % 1440;
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }
  function averageClock(values, bedtime = false) {
    const minutes = values.map(parseTime).filter((value) => value !== null).map((value) => bedtime && value < 720 ? value + 1440 : value);
    return minutes.length ? average(minutes) : null;
  }
  function calculate(days) {
    const sleepValues = days.filter((day) => Number.isFinite(Number(day.sleep?.duration))).map((day) => Number(day.sleep.duration));
    const waterValues = days.filter((day) => waterQuarters(day) > 0).map(waterQuarters);
    const workValues = days.map(workMinutes).filter((value) => value > 0);
    const activityValues = days.map(activityMinutes).filter((value) => value > 0);
    const emotionCounts = {};
    const categories = {};
    const titles = {};
    let totalActivities = 0;
    let fullest = null;
    days.forEach((day) => {
      if (day.tetr) emotionCounts[day.tetr.emotionKey] = (emotionCounts[day.tetr.emotionKey] || 0) + 1;
      totalActivities += day.activities.length;
      if (day.activities.length && (!fullest || day.activities.length > fullest.count)) fullest = { date: day.date, count: day.activities.length };
      day.activities.forEach((item) => {
        categories[item.category || 'Altro'] = (categories[item.category || 'Altro'] || 0) + (Number(item.duration) || 0);
        const normalized = String(item.title || '').trim().toLocaleLowerCase('it-IT');
        if (normalized) titles[normalized] = { label: item.title, count: (titles[normalized]?.count || 0) + 1 };
      });
    });
    const mostEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const recurring = Object.values(titles).sort((a, b) => b.count - a.count)[0] || null;
    const completedDays = days.filter(dayHasData).length;
    const energyValues = days.map((day) => sleepEnergy(day.sleep)).filter((value) => value !== null);
    const bedValues = days.map((day) => day.sleep?.bedtime).filter(Boolean);
    const wakeValues = days.map((day) => day.sleep?.wake).filter(Boolean);
    const riseValues = days.map((day) => Number(day.sleep?.riseDelay)).filter((value) => Number.isFinite(value));
    return {
      sleep: average(sleepValues), sleepCount: sleepValues.length,
      water: average(waterValues), waterTotal: waterValues.reduce((a, b) => a + b, 0), waterMax: Math.max(0, ...waterValues), waterCount: waterValues.length,
      workTotal: workValues.reduce((a, b) => a + b, 0), workAverage: average(workValues),
      activityTotal: activityValues.reduce((a, b) => a + b, 0), totalActivities, completedDays, categories, topCategory, recurring, fullest,
      mostEmotion, emotionCounts,
      energy: average(energyValues), energyCount: energyValues.length,
      beverageGlasses: days.reduce((sum, day) => sum + beverageGlasses(day), 0), beverageDays: days.filter((day) => beverageGlasses(day) > 0).length,
      bedtime: averageClock(bedValues, true), bedtimeCount: bedValues.length,
      wake: averageClock(wakeValues), wakeCount: wakeValues.length,
      riseDelay: average(riseValues), riseCount: riseValues.length
    };
  }

  function renderHeatmap(container, monthDate, type) {
    container.innerHTML = '';
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const weekStartsSunday = trackerSettings().weekStart === 'sunday';
    const calendarOffset = weekStartsSunday ? first.getDay() : (first.getDay() + 6) % 7;
    for (let i = 0; i < calendarOffset; i += 1) {
      const empty = document.createElement('span'); empty.className = 'stats-heat-cell is-empty'; container.append(empty);
    }
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNumber);
      const day = Store.getDay(Store.dateKey(date));
      let value = 0; let level = 0; let label = 'Nessun dato'; let heatClass = '';
      if (type === 'sleep') {
        value = Number(day.sleep?.duration) || 0; heatClass = 'heat-sleep';
        level = value ? (value <= 120 ? 1 : value <= 240 ? 2 : value <= 300 ? 3 : 4) : 0;
        label = value ? formatMinutes(value) : 'Nessun sonno registrato';
      } else if (type === 'water') {
        value = waterQuarters(day); heatClass = 'heat-water';
        level = value ? (value <= 2 ? 1 : value <= 4 ? 2 : value <= 7 ? 3 : 4) : 0;
        label = value ? `${formatWater(value)} · circa ${waterLiters(value, Store.getState().settings.bottleMl)}` : 'Nessuna acqua registrata';
      } else {
        value = workMinutes(day); heatClass = 'heat-activity';
        level = value === 0 ? 0 : value <= 120 ? 2 : value <= 180 ? 3 : 4;
        label = value ? formatMinutes(value) : 'Nessuna ora lavorata';
      }
      const cell = document.createElement(level ? 'button' : 'span');
      cell.className = `stats-heat-cell ${level ? `level-${level} ${heatClass}` : 'is-empty'}`;
      if (level) {
        cell.type = 'button';
        cell.dataset.tooltip = `${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })} · ${label}`;
        cell.setAttribute('aria-label', cell.dataset.tooltip);
      }
      container.append(cell);
    }
    while (container.children.length % 7) {
      const empty = document.createElement('span'); empty.className = 'stats-heat-cell is-empty'; container.append(empty);
    }
  }

  function renderTetrBoard(monthDate) {
    const board = page.querySelector('[data-stats-tetr-board]');
    if (!board) return 0;
    board.innerHTML = '';
    const matrix = Array.from({ length: 20 }, () => Array(10).fill(null));
    const monthRecords = Store.monthDays(Store.monthKey(monthDate)).filter((day) => day.tetr);
    monthRecords.forEach((day, pieceIndex) => day.tetr.cells?.forEach(([row, col]) => {
      if (matrix[row]) matrix[row][col] = { ...day.tetr, date: day.date, pieceId: pieceIndex + 1 };
    }));
    matrix.forEach((row) => row.forEach((entry) => {
      const cell = document.createElement('span');
      cell.className = 'stats-tetr-cell';
      if (entry) {
        cell.classList.add('is-filled');
        cell.style.setProperty('--cell-color', entry.color || EMOTIONS[entry.emotionKey]?.color);
        cell.dataset.pieceId = entry.pieceId;
        cell.dataset.tooltip = `${formatDate(entry.date, { day: 'numeric', month: 'long' })} · ${EMOTIONS[entry.emotionKey]?.label}${entry.note ? ` · ${entry.note}` : ''}`;
      }
      board.append(cell);
    }));
    return monthRecords.length;
  }

  function renderSleepChart(range) {
    const svg = page.querySelector('[data-detail-sleep-chart]');
    if (!svg) return;
    const dates = [];
    const end = new Date(range.end);
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(end); date.setDate(end.getDate() - offset);
      dates.push({ date, value: Number(Store.getDay(Store.dateKey(date)).sleep?.duration) || 0 });
    }
    const x = (index) => 55 + (680 * index / 13);
    const y = (minutes) => 250 - Math.min(600, Math.max(0, minutes)) / 600 * 205;
    const points = dates.map((item, index) => item.value ? { x: x(index), y: y(item.value), ...item } : null).filter(Boolean);
    const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    const area = points.length > 1 ? `${line} L${points.at(-1).x.toFixed(1)} 250 L${points[0].x.toFixed(1)} 250 Z` : '';
    const labels = [0, 3, 6, 9, 13].map((index) => `<text x="${x(index)}" y="286">${formatDate(dates[index].date, { day: 'numeric', month: 'short' })}</text>`).join('');
    svg.innerHTML = `
      <g class="stats-grid-lines"><line x1="55" x2="735" y1="45" y2="45"></line><line x1="55" x2="735" y1="96" y2="96"></line><line x1="55" x2="735" y1="148" y2="148"></line><line x1="55" x2="735" y1="199" y2="199"></line><line x1="55" x2="735" y1="250" y2="250"></line></g>
      <g class="stats-y-labels"><text x="10" y="50">10 h</text><text x="10" y="101">7,5 h</text><text x="10" y="153">5 h</text><text x="10" y="204">2,5 h</text><text x="22" y="255">0</text></g>
      ${area ? `<path class="stats-line-area" d="${area}"></path>` : ''}
      ${line ? `<path class="stats-line" d="${line}"></path>` : ''}
      <g class="stats-line-points">${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5"><title>${formatDate(point.date, { day: 'numeric', month: 'long' })} · ${formatMinutes(point.value)}</title></circle>`).join('')}</g>
      <g class="stats-x-labels">${labels}</g>`;
  }

  function renderWaterBars(range, current) {
    const holder = page.querySelector('[data-detail-water-bars]');
    if (!holder) return;
    const dates = [];
    const end = new Date(range.end);
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(end); date.setDate(end.getDate() - offset);
      dates.push({ date, value: waterQuarters(Store.getDay(Store.dateKey(date))) });
    }
    const max = Math.max(4, ...dates.map((item) => item.value));
    holder.innerHTML = dates.map((item, index) => `<div${index === 13 ? ' class="is-current"' : ''}><i style="height:${item.value ? Math.max(6, item.value / max * 100) : 0}%" title="${formatWater(item.value)}"></i><span>${item.date.getDate()}</span></div>`).join('');
    page.querySelector('[data-detail-water-total]').textContent = `Totale ${formatWater(current.waterTotal)}`;
    page.querySelector('[data-detail-water-average]').textContent = current.water ? formatWater(Math.round(current.water)) : '—';
    page.querySelector('[data-detail-water-max]').textContent = current.waterMax ? formatWater(current.waterMax) : '—';
    page.querySelector('[data-detail-water-total-value]').textContent = current.waterTotal ? formatWater(current.waterTotal) : '—';
  }

  function renderActivityDetails(current) {
    page.querySelector('[data-detail-activity-total]').textContent = current.activityTotal ? `${formatMinutes(current.activityTotal)} tracciate` : 'Nessun tempo tracciato';
    const bars = page.querySelector('[data-detail-category-bars]');
    if (bars) {
      const entries = Object.entries(current.categories).sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ...entries.map(([, value]) => value));
      bars.innerHTML = entries.length ? entries.map(([name, value]) => `<div><span>${escapeHtml(name)}</span><i><b style="width:${value / max * 100}%"></b></i><strong>${formatMinutes(value)}</strong></div>`).join('') : '<div class="tracker-empty-state"><strong>Nessuna attività con durata</strong><span>Aggiungi una durata alle attività per vedere la distribuzione.</span></div>';
    }
    page.querySelector('[data-detail-activity-average]').textContent = current.completedDays ? new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(current.totalActivities / current.completedDays) : '—';
    page.querySelector('[data-detail-top-category]').textContent = current.topCategory[0] || '—';
    page.querySelector('[data-detail-top-category-note]').textContent = current.topCategory[1] && current.activityTotal ? `${Math.round(current.topCategory[1] / current.activityTotal * 100)}% del tempo tracciato` : 'Nessun dato';
    page.querySelector('[data-detail-recurring-activity]').textContent = current.recurring?.label || '—';
    page.querySelector('[data-detail-recurring-note]').textContent = current.recurring ? `registrata ${current.recurring.count} ${current.recurring.count === 1 ? 'volta' : 'volte'}` : 'Nessun dato';
    page.querySelector('[data-detail-fullest-day]').textContent = current.fullest ? formatDate(current.fullest.date, { day: 'numeric', month: 'long' }) : '—';
    page.querySelector('[data-detail-fullest-note]').textContent = current.fullest ? `${current.fullest.count} attività registrate` : 'Nessun dato';
  }

  function longestEmotionStreak(days) {
    let best = { length: 0, key: null };
    let run = { length: 0, key: null };
    days.filter((day) => day.tetr).sort((a, b) => a.date.localeCompare(b.date)).forEach((day) => {
      run = run.key === day.tetr.emotionKey ? { key: run.key, length: run.length + 1 } : { key: day.tetr.emotionKey, length: 1 };
      if (run.length > best.length) best = { ...run };
    });
    return best;
  }

  function differenceMinutes(currentValue, previousValue) {
    const diff = Math.round((currentValue || 0) - (previousValue || 0));
    if (!diff) return '—';
    return `${diff > 0 ? '+' : '−'}${formatMinutes(Math.abs(diff))}`;
  }
  function differenceNumber(currentValue, previousValue, suffix = '') {
    const diff = Math.round(((currentValue || 0) - (previousValue || 0)) * 100) / 100;
    if (!diff) return '—';
    return `${diff > 0 ? '+' : '−'}${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(Math.abs(diff))}${suffix}`;
  }

  function renderComparison(range, current, previous, previousStart, previousEnd) {
    const title = page.querySelector('#stats-comparison-title');
    if (title) title.textContent = 'Periodo selezionato e periodo precedente';
    const table = page.querySelector('[data-comparison-table]');
    if (!table) return;
    const currentLabel = `${formatDate(range.start, { day: 'numeric', month: 'short' })}–${formatDate(range.end, { day: 'numeric', month: 'short' })}`;
    const previousLabel = `${formatDate(previousStart, { day: 'numeric', month: 'short' })}–${formatDate(previousEnd, { day: 'numeric', month: 'short' })}`;
    const emotionCurrent = current.mostEmotion[0] ? EMOTIONS[current.mostEmotion[0]].label : '—';
    const emotionPrevious = previous.mostEmotion[0] ? EMOTIONS[previous.mostEmotion[0]].label : '—';
    const productiveCurrent = current.emotionCounts.productive || 0;
    const productivePrevious = previous.emotionCounts.productive || 0;
    table.innerHTML = `<div class="stats-comparison-row stats-comparison-head" role="row"><span>Dato</span><span>${currentLabel}</span><span>${previousLabel}</span><span>Differenza</span></div>
      <div class="stats-comparison-row" role="row"><strong>Sonno medio</strong><span>${current.sleep ? formatMinutes(current.sleep) : '—'}</span><span>${previous.sleep ? formatMinutes(previous.sleep) : '—'}</span><em>${differenceMinutes(current.sleep, previous.sleep)}</em></div>
      <div class="stats-comparison-row" role="row"><strong>Acqua media</strong><span>${current.water ? formatWater(Math.round(current.water)) : '—'}</span><span>${previous.water ? formatWater(Math.round(previous.water)) : '—'}</span><em>${differenceNumber(current.water, previous.water, ' quarti')}</em></div>
      <div class="stats-comparison-row" role="row"><strong>Tempo nelle attività</strong><span>${current.activityTotal ? formatMinutes(current.activityTotal) : '—'}</span><span>${previous.activityTotal ? formatMinutes(previous.activityTotal) : '—'}</span><em>${differenceMinutes(current.activityTotal, previous.activityTotal)}</em></div>
      <div class="stats-comparison-row" role="row"><strong>Ore lavorate</strong><span>${current.workTotal ? formatMinutes(current.workTotal) : '—'}</span><span>${previous.workTotal ? formatMinutes(previous.workTotal) : '—'}</span><em>${differenceMinutes(current.workTotal, previous.workTotal)}</em></div>
      <div class="stats-comparison-row" role="row"><strong>Emozione più frequente</strong><span>${emotionCurrent}</span><span>${emotionPrevious}</span><em>—</em></div>
      <div class="stats-comparison-row" role="row"><strong>Giornate produttive</strong><span>${productiveCurrent}</span><span>${productivePrevious}</span><em>${differenceNumber(productiveCurrent, productivePrevious)}</em></div>`;
  }

  function render() {
    const settings = trackerSettings();
    const showWork = settings.tracker?.showWorkInStats !== false;
    page.querySelector('.summary-work')?.toggleAttribute('hidden', !showWork);
    const habitCards = [...page.querySelectorAll('.stats-habit-card')];
    if (habitCards[2]) habitCards[2].hidden = !showWork;
    const weekdayLabels = settings.weekStart === 'sunday' ? ['D','L','M','M','G','V','S'] : ['L','M','M','G','V','S','D'];
    page.querySelectorAll('.stats-week-labels').forEach((holder) => { holder.innerHTML = weekdayLabels.map((label) => `<span>${label}</span>`).join(''); });
    const range = getDateRange(periodSelect.value);
    const days = Store.daysInRange(range.startKey, range.endKey);
    const current = calculate(days);
    const previousEnd = new Date(range.start); previousEnd.setDate(previousEnd.getDate() - 1);
    const length = Math.round((range.end - range.start) / 86400000) + 1;
    const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - length + 1);
    const previous = calculate(Store.daysInRange(Store.dateKey(previousStart), Store.dateKey(previousEnd)));

    page.querySelector('[data-period-caption]').textContent = `${formatDate(range.start, { day: 'numeric', month: 'long' })} — ${formatDate(range.end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    page.querySelector('[data-stat-sleep]').textContent = current.sleep ? formatMinutes(current.sleep) : '—';
    page.querySelector('[data-stat-sleep-note]').innerHTML = current.sleep ? `<b>${differenceMinutes(current.sleep, previous.sleep)}</b> rispetto al periodo precedente` : 'Nessun dato nel periodo';
    page.querySelector('[data-stat-water]').textContent = current.water ? formatWater(Math.round(current.water)) : '—';
    page.querySelector('[data-stat-water-note]').textContent = current.water ? `circa ${waterLiters(current.water, Store.getState().settings.bottleMl)} al giorno` : 'Nessun dato nel periodo';
    page.querySelector('[data-stat-work]').textContent = current.workTotal ? formatMinutes(current.workTotal) : '—';
    page.querySelector('[data-stat-work-note]').textContent = current.workAverage ? `media di ${formatMinutes(current.workAverage)} nei giorni lavorati` : 'Nessuna attività Lavoro';
    const emotion = current.mostEmotion[0] ? EMOTIONS[current.mostEmotion[0]] : null;
    page.querySelector('[data-stat-emotion]').textContent = emotion?.label || '—';
    page.querySelector('[data-stat-emotion-note]').textContent = emotion ? `${current.mostEmotion[1]} giorni nel periodo` : 'Nessuna emozione registrata';
    const emotionIcon = page.querySelector('.summary-emotion .stats-summary-icon');
    if (emotionIcon) emotionIcon.innerHTML = emotion ? tetrominoMarkup({ emotionKey: current.mostEmotion[0], piece: emotion.piece, color: emotion.color }, 9) : '<span class="empty-tetr-piece">—</span>';
    page.querySelector('[data-stat-insight-sleep]').textContent = current.sleep ? `Hai dormito in media ${formatMinutes(current.sleep)} nel periodo selezionato.` : 'Non ci sono ancora notti sufficienti per calcolare la media.';
    page.querySelector('[data-stat-insight-water]').textContent = current.water ? `La media giornaliera è stata di ${formatWater(Math.round(current.water))}, circa ${waterLiters(current.water, Store.getState().settings.bottleMl)}.` : 'Non ci sono ancora registrazioni d’acqua nel periodo.';
    page.querySelector('[data-stat-insight-emotion]').textContent = emotion ? `${emotion.label} è stata l’emozione più frequente, registrata in ${current.mostEmotion[1]} giornate.` : 'Tetr-Emotion non contiene ancora dati nel periodo.';

    const monthDate = periodSelect.value === 'previous' ? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) : new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    const heatmaps = [...page.querySelectorAll('[data-heatmap]')];
    if (heatmaps[0]) renderHeatmap(heatmaps[0], monthDate, 'sleep');
    if (heatmaps[1]) renderHeatmap(heatmaps[1], monthDate, 'water');
    if (heatmaps[2]) renderHeatmap(heatmaps[2], monthDate, 'work');
    heatmaps.forEach((map) => {
      map.closest('.stats-habit-card')?.querySelector('.stats-habit-top > strong')?.replaceChildren(document.createTextNode(
        map === heatmaps[0] ? `Media ${current.sleep ? formatMinutes(current.sleep) : '—'}` : map === heatmaps[1] ? `Media ${current.water ? formatWater(Math.round(current.water)) : '—'}` : `Media ${current.workAverage ? formatMinutes(current.workAverage) : '—'}`
      ));
    });

    const monthPieceCount = renderTetrBoard(monthDate);
    const monthName = formatDate(monthDate, { month: 'long' });
    page.querySelector('#stats-tetr-title').textContent = `Tetr-Emotion di ${monthName}`;
    const boardHeading = page.querySelector('.stats-tetr-board-card .stats-card-heading > span');
    if (boardHeading) boardHeading.textContent = `${monthPieceCount} ${monthPieceCount === 1 ? 'giorno rappresentato' : 'giorni rappresentati'}`;
    const tetrBars = page.querySelector('.stats-tetr-bars');
    if (tetrBars) {
      const max = Math.max(1, ...Object.values(current.emotionCounts));
      tetrBars.innerHTML = Object.entries(EMOTIONS).map(([key, item]) => `<div><span>${tetrominoMarkup({ emotionKey: key, piece: item.piece, color: item.color }, 6)}${item.label}</span><i><b style="--bar-color:${item.color};width:${((current.emotionCounts[key] || 0) / max) * 100}%"></b></i><strong>${current.emotionCounts[key] || 0}</strong></div>`).join('');
    }
    const metrics = [...page.querySelectorAll('.stats-tetr-metrics article')];
    const streak = longestEmotionStreak(days);
    if (metrics[0]) { metrics[0].querySelector('strong').textContent = emotion?.label || '—'; metrics[0].querySelector('.stats-metric-note').textContent = emotion ? `${current.mostEmotion[1]} giornate nel periodo` : 'Nessun dato'; }
    if (metrics[1]) { const distinct = Object.values(current.emotionCounts).filter(Boolean).length; metrics[1].querySelector('strong').textContent = String(distinct); metrics[1].querySelector('.stats-metric-note').textContent = distinct ? `${distinct} categorie presenti` : 'Nessuna emozione'; }
    if (metrics[2]) { metrics[2].querySelector('strong').textContent = streak.length ? `${streak.length} ${streak.length === 1 ? 'giorno' : 'giorni'}` : '—'; metrics[2].querySelector('.stats-metric-note').textContent = streak.key ? EMOTIONS[streak.key].label : 'Nessun dato'; }

    page.querySelector('[data-detail-sleep-average]').textContent = current.sleep ? `Media ${formatMinutes(current.sleep)}` : 'Nessun dato';
    page.querySelector('[data-detail-bed-average]').textContent = current.bedtime !== null ? timeLabel(current.bedtime) : '—';
    page.querySelector('[data-detail-bed-note]').textContent = current.bedtimeCount ? `${current.bedtimeCount} notti considerate` : 'Nessun dato';
    page.querySelector('[data-detail-wake-average]').textContent = current.wake !== null ? timeLabel(current.wake) : '—';
    page.querySelector('[data-detail-wake-note]').textContent = current.wakeCount ? `${current.wakeCount} risvegli considerati` : 'Nessun dato';
    page.querySelector('[data-detail-rise-average]').textContent = current.riseCount ? formatMinutes(current.riseDelay) : '—';
    page.querySelector('[data-detail-quality-average]').textContent = current.energyCount ? `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(current.energy)} / 5` : '—';
    page.querySelector('[data-detail-quality-note]').textContent = current.energyCount ? `${current.energyCount} notti con energia registrata` : 'Nessuna energia registrata';
    renderSleepChart(range);
    renderWaterBars(range, current);
    const beverageMetric = page.querySelector('[data-detail-beverage-total]');
    if (beverageMetric) beverageMetric.textContent = current.beverageGlasses ? `${current.beverageGlasses} ${current.beverageGlasses === 1 ? 'bicchiere' : 'bicchieri'}` : '—';
    renderActivityDetails(current);
    renderComparison(range, current, previous, previousStart, previousEnd);
  }

  periodSelect.addEventListener('change', render);
  page.querySelector('[data-stats-compare]')?.addEventListener('click', () => { comparison.hidden = !comparison.hidden; });
  page.querySelector('[data-stats-export]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('tracker:open-notion-export')));
  page.addEventListener('mousemove', (event) => {
    const target = event.target.closest('[data-tooltip]');
    let tip = page.querySelector('.stats-floating-tooltip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'stats-floating-tooltip'; tip.hidden = true; document.body.append(tip); }
    if (!target) { tip.hidden = true; return; }
    tip.textContent = target.dataset.tooltip;
    tip.hidden = false;
    tip.style.left = `${event.clientX + 14}px`;
    tip.style.top = `${event.clientY + 14}px`;
  });
  page.addEventListener('mouseleave', () => { const tip = document.querySelector('.stats-floating-tooltip'); if (tip) tip.hidden = true; });
  render();
  window.addEventListener('tracker:data-changed', render);
})();


// Archivio.
(() => {
  const page = document.querySelector('.archive-page');
  if (!page) return;
  const initialArchiveDate = dateFromQuery();
  let selectedMonth = new Date(initialArchiveDate.getFullYear(), initialArchiveDate.getMonth(), 1);
  let selectedDate = Store.dateKey(initialArchiveDate);
  let activeFilter = 'all';
  let activeView = 'calendar';
  const calendar = page.querySelector('[data-archive-calendar]');
  const list = page.querySelector('[data-archive-list]');
  const search = page.querySelector('[data-archive-search]');

  function workMinutes(day) { return (day.activities || []).filter((item) => isWorkCategory(item.category)).reduce((sum, item) => sum + (Number(item.duration) || 0), 0); }
  function matches(day) {
    const query = search.value.trim().toLowerCase();
    const hasFilter = activeFilter === 'all' || (activeFilter === 'sleep' && day.sleep) || (activeFilter === 'food' && (Object.values(day.meals || {}).some(Boolean) || Object.values(day.mealItems || {}).some((ids) => Array.isArray(ids) && ids.length) || day.water.length || (day.beverages || []).length)) || (activeFilter === 'day' && (day.activities.length || day.dailyNote)) || (activeFilter === 'tetr' && day.tetr);
    if (!hasFilter) return false;
    if (!query) return true;
    const library = Store.getState().settings.tracker?.foodLibrary || [];
    const selectedFoods = Object.values(day.mealItems || {}).flatMap((ids) => (ids || []).map((id) => library.find((item) => item.id === id)?.name || ''));
    const text = [day.date, day.dailyNote, day.sleep?.note, ...Object.values(day.meals || {}), ...selectedFoods, ...(day.beverages || []).flatMap((item) => [item.name, item.glasses]), ...day.activities.flatMap((item) => [item.title, item.note, item.category]), day.tetr?.note, day.tetr ? EMOTIONS[day.tetr.emotionKey]?.label : ''].join(' ').toLowerCase();
    return text.includes(query);
  }
  function renderMonthLabel() { page.querySelector('[data-archive-month-label]').textContent = formatDate(selectedMonth, { month: 'long', year: 'numeric' }); }
  function renderCalendar() {
    calendar.innerHTML = '';
    const weekStartsSunday = trackerSettings().weekStart === 'sunday';
    const weekdays = weekStartsSunday ? ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'] : ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
    weekdays.forEach((label) => { const head = document.createElement('span'); head.className = 'archive-weekday'; head.textContent = label; calendar.append(head); });
    const first = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const offset = weekStartsSunday ? first.getDay() : (first.getDay() + 6) % 7;
    for (let i = 0; i < offset; i += 1) { const empty = document.createElement('span'); empty.className = 'archive-day is-empty'; calendar.append(empty); }
    const count = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
    let results = 0;
    for (let number = 1; number <= count; number += 1) {
      const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), number);
      const key = Store.dateKey(date); const day = Store.getDay(key); const visible = dayHasData(day) && matches(day); if (visible) results += 1;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'archive-day'; button.dataset.date = key;
      if (key === selectedDate) button.classList.add('is-selected');
      if (!dayHasData(day)) button.classList.add('is-blank');
      if (!visible && (search.value.trim() || activeFilter !== 'all')) button.classList.add('is-muted');
      const metrics = [];
      if (day.sleep && (activeFilter === 'all' || activeFilter === 'sleep')) metrics.push(`<span class="archive-day-metric metric-sleep"><i>☾</i><span>${formatMinutes(day.sleep.duration)}</span></span>`);
      if (day.water.length && (activeFilter === 'all' || activeFilter === 'food')) metrics.push(`<span class="archive-day-metric metric-water"><i>◔</i><span>${formatWater(waterQuarters(day))}</span></span>`);
      if ((day.beverages || []).length && (activeFilter === 'all' || activeFilter === 'food')) metrics.push(`<span class="archive-day-metric metric-drink"><i>◌</i><span>${beverageGlasses(day)} ${beverageGlasses(day) === 1 ? 'bicchiere' : 'bicchieri'}</span></span>`);
      if (day.activities.length && (activeFilter === 'all' || activeFilter === 'day')) metrics.push(`<span class="archive-day-metric metric-day"><i>▣</i><span>${day.activities.length} attività</span></span>`);
      if (day.tetr && (activeFilter === 'all' || activeFilter === 'tetr')) metrics.push(`<span class="archive-day-metric metric-tetr ${activeFilter === 'all' ? 'is-compact' : ''}" title="${EMOTIONS[day.tetr.emotionKey].label}">${tetrominoMarkup(day.tetr, 6)}${activeFilter === 'tetr' ? `<span>${EMOTIONS[day.tetr.emotionKey].label}</span>` : ''}</span>`);
      button.innerHTML = `<span class="archive-day-number">${number}</span><span class="archive-day-metrics">${metrics.join('')}</span>`;
      calendar.append(button);
    }
    page.querySelector('[data-archive-result-caption]').textContent = `${results} ${results === 1 ? 'giornata trovata' : 'giornate trovate'} nel mese`;
  }
  function renderList() {
    const days = Store.monthDays(Store.monthKey(selectedMonth)).filter((day) => dayHasData(day) && matches(day));
    list.innerHTML = days.length ? days.map((day) => `<button type="button" class="archive-list-row" data-date="${day.date}"><span><strong>${formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong><span>${day.dailyNote || 'Nessuna nota generale'}</span></span><span class="archive-list-metrics"><span>☾ ${day.sleep ? formatMinutes(day.sleep.duration) : '—'}</span><span>◔ ${formatWater(waterQuarters(day))}</span><span>◌ ${beverageGlasses(day)} bicch.</span><span>▣ ${day.activities.length}</span><span class="archive-list-emotion">${day.tetr ? `${tetrominoMarkup(day.tetr, 5)} ${EMOTIONS[day.tetr.emotionKey].label}` : '—'}</span></span></button>`).join('') : '<div class="tracker-empty-state"><strong>Nessun risultato</strong><span>Prova a cambiare mese, filtro o ricerca.</span></div>';
  }
  function renderDetail() {
    const day = Store.getDay(selectedDate);
    page.querySelector('[data-archive-detail-date]').textContent = formatDate(selectedDate);
    page.querySelector('[data-archive-detail-intro]').textContent = dayHasData(day) ? 'Riepilogo dei dati salvati per questa giornata.' : 'Questa giornata non contiene ancora dati.';
    page.querySelector('[data-detail-sleep-duration]').textContent = day.sleep ? formatMinutes(day.sleep.duration) : '—';
    page.querySelector('[data-detail-sleep-quality]').textContent = sleepEnergy(day.sleep) ? `${sleepEnergy(day.sleep)} / 5` : '—';
    page.querySelector('[data-detail-sleep-awakenings]').textContent = String(day.sleep?.awakenings?.length || 0);
    page.querySelector('[data-detail-bedtime]').textContent = day.sleep?.bedtime || '—';
    page.querySelector('[data-detail-wakeup]').textContent = day.sleep?.wake || '—';
    page.querySelector('[data-detail-rise]').textContent = day.sleep?.up || '—';
    const napDetail = page.querySelector('[data-detail-nap]');
    if (napDetail) napDetail.textContent = day.sleep?.nap?.start && day.sleep?.nap?.end ? `${day.sleep.nap.start} — ${day.sleep.nap.end} (${formatMinutes(day.sleep.nap.duration)})` : '—';
    page.querySelector('[data-detail-water]').textContent = formatWater(waterQuarters(day));
    page.querySelector('[data-detail-water-ml]').textContent = waterLiters(waterQuarters(day), Store.getState().settings.bottleMl);
    const mealList = page.querySelector('[data-detail-meals]');
    const savedMeals = MEAL_ORDER
      .map((mealKey) => ({ key: mealKey, label: MEAL_LABELS[mealKey], text: String(day.meals?.[mealKey] || '').trim() }))
      .filter((meal) => meal.text);
    mealList.innerHTML = savedMeals.length
      ? savedMeals.map((meal) => `<div class="archive-meal"><strong>${meal.label}</strong><p>${escapeHtml(meal.text)}</p></div>`).join('')
      : (Object.values(day.mealItems || {}).some((ids) => Array.isArray(ids) && ids.length) ? '' : '<div class="archive-meal"><strong>Nessun pasto registrato</strong><p>Per questa giornata non hai ancora annotato cosa hai mangiato.</p></div>');
    const foodItemsHolder = page.querySelector('[data-detail-food-items]');
    if (foodItemsHolder) {
      const library = Store.getState().settings.tracker?.foodLibrary || [];
      const groups = MEAL_ORDER.map((meal) => ({ meal, items: (day.mealItems?.[meal] || []).map((id) => library.find((item) => item.id === id)).filter(Boolean) })).filter((group) => group.items.length);
      foodItemsHolder.innerHTML = groups.map((group) => `<div class="archive-food-group"><strong>${MEAL_LABELS[group.meal]}</strong><div>${group.items.map((item) => `<span class="archive-food-chip"><span>${escapeHtml(item.icon || '•')}</span>${escapeHtml(item.name)}</span>`).join('')}</div></div>`).join('');
      foodItemsHolder.hidden = !groups.length;
    }
    const beverageHolder = page.querySelector('[data-detail-beverages]');
    if (beverageHolder) {
      const drinks = day.beverages || [];
      beverageHolder.innerHTML = drinks.length
        ? `<div class="archive-beverage-heading"><strong>Altre bevande</strong><span>${beverageSummary(day)}</span></div>${drinks.map((drink) => {
            const glasses = Math.max(1, Number(drink.glasses) || 1);
            const ml = glasses * (Number(drink.mlPerGlass) || Number(Store.getState().settings.glassMl) || 220);
            return `<div class="archive-beverage"><strong>${escapeHtml(drink.name || 'Altra bevanda')}</strong><p>${glasses} ${glasses === 1 ? 'bicchiere' : 'bicchieri'} · circa ${new Intl.NumberFormat('it-IT').format(ml)} ml</p></div>`;
          }).join('')}`
        : '';
      beverageHolder.hidden = !drinks.length;
    }
    page.querySelector('[data-detail-activity-count]').textContent = String(day.activities.length);
    page.querySelector('[data-detail-work]').textContent = formatMinutes(workMinutes(day));
    const activities = page.querySelector('[data-detail-activities]');
    activities.innerHTML = day.activities.length ? day.activities.map((item) => {
      const categoryClass = categoryStyleClass(item.category || 'Altro');
      const meta = [item.category || 'Altro', item.note].filter(Boolean).map(escapeHtml).join(' · ');
      const duration = item.duration ? formatMinutes(item.duration) : (item.time || 'Senza durata');
      return `<div class="archive-activity"><span class="archive-activity-dot ${categoryClass}" aria-hidden="true"></span><div><strong>${escapeHtml(item.title)}</strong><p>${meta || 'Nessun dettaglio aggiunto'}</p></div><span>${escapeHtml(duration)}</span></div>`;
    }).join('') : '<div class="archive-activity archive-activity-empty"><span class="archive-activity-dot category-other" aria-hidden="true"></span><div><strong>Nessuna attività</strong><p>Non ci sono attività registrate per questa giornata.</p></div><span>—</span></div>';
    page.querySelector('[data-detail-note]').textContent = day.dailyNote || 'Nessuna nota salvata.';
    const emotion = day.tetr ? EMOTIONS[day.tetr.emotionKey] : null;
    page.querySelector('[data-detail-tetr-emotion]').textContent = emotion?.label || '—';
    const tetrMeta = page.querySelector('[data-detail-tetr-meta]');
    if (tetrMeta) { tetrMeta.textContent = ''; tetrMeta.hidden = true; }
    page.querySelector('[data-detail-tetr-note]').textContent = day.tetr?.note || 'Nessuna nota salvata.';
    ['[data-detail-tetr-piece]', '[data-detail-tetr-large]'].forEach((selector) => { const holder = page.querySelector(selector); if (holder) holder.innerHTML = day.tetr ? tetrominoMarkup(day.tetr, selector.includes('large') ? 13 : 8) : '—'; });
    const monthName = formatDate(new Date(`${selectedDate.slice(0, 7)}-01T12:00:00`), { month: 'long' });
    page.querySelector('[data-archive-tetr-link]').textContent = `Apri la griglia Tetr-Emotion di ${monthName} →`;
  }
  function renderAll() { renderMonthLabel(); renderCalendar(); renderList(); renderDetail(); }
  page.addEventListener('click', (event) => {
    const dated = event.target.closest('[data-date]');
    if (dated) { selectedDate = dated.dataset.date; renderAll(); }
  });
  page.querySelectorAll('[data-archive-month-shift]').forEach((button) => button.addEventListener('click', () => { selectedMonth.setMonth(selectedMonth.getMonth() + Number(button.dataset.archiveMonthShift)); selectedDate = Store.dateKey(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)); renderAll(); }));
  page.querySelector('[data-archive-today]').addEventListener('click', () => { selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); selectedDate = Store.dateKey(new Date()); renderAll(); });
  page.querySelectorAll('[data-archive-filter]').forEach((button) => button.addEventListener('click', () => { page.querySelectorAll('[data-archive-filter]').forEach((item) => item.classList.toggle('active', item === button)); activeFilter = button.dataset.archiveFilter; renderAll(); }));
  page.querySelectorAll('[data-archive-view]').forEach((button) => button.addEventListener('click', () => {
    page.querySelectorAll('[data-archive-view]').forEach((item) => item.classList.toggle('active', item === button));
    activeView = button.dataset.archiveView;
    page.querySelector('[data-archive-calendar-section]').hidden = activeView !== 'calendar';
    page.querySelector('[data-archive-list-section]').hidden = activeView !== 'list';
  }));
  search.addEventListener('input', renderAll);
  page.querySelector('[data-archive-edit]').addEventListener('click', () => { window.location.href = `giornata.html?date=${selectedDate}`; });
  page.querySelector('[data-archive-export]').addEventListener('click', () => { page.querySelector('[data-archive-action-feedback]').textContent = 'L’esportazione per Notion verrà aggiunta in seguito.'; });
  renderAll();
  window.addEventListener('tracker:data-changed', renderAll);
})();

// Impostazioni dinamiche, esportazione JSON e collegamento a Google Sheets.
(() => {
  const page = document.querySelector('.settings-page');
  if (!page) return;
  const tabs = [...page.querySelectorAll('[data-settings-tab]')];
  const panels = [...page.querySelectorAll('[data-settings-panel]')];
  const saveFeedback = page.querySelector('[data-settings-feedback]');
  const dataFeedback = page.querySelector('[data-data-feedback]');
  const connectionUrl = page.querySelector('[data-connection-url]');
  const connectionStatus = page.querySelector('[data-connection-status]');
  const categoryList = page.querySelector('[data-category-list]');
  const categoryColors = ['rose', 'sky', 'lilac', 'violet', 'periwinkle', 'neutral'];
  const categoryIcons = ['✦', '⌖', '☾', '⌂', '♡', '•'];

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((item) => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); });
    panels.forEach((panel) => { const active = panel.dataset.settingsPanel === tab.dataset.settingsTab; panel.hidden = !active; panel.classList.toggle('active', active); });
  }));

  const sceneMeta = { morning: ['Mattina', '05:00 — 11:59'], afternoon: ['Pomeriggio', '12:00 — 17:59'], evening: ['Sera', '18:00 — 21:59'], night: ['Notte', '22:00 — 04:59'] };
  const scenePreview = page.querySelector('[data-scene-preview]');
  const autoScenes = page.querySelector('[data-auto-scenes]');
  const gradient = page.querySelector('[data-gradient-range]');
  const tetrLines = page.querySelector('[data-setting-tetr-lines]');
  let chosenScene = trackerSettings().appearance?.scene || 'afternoon';
  const currentScene = () => { const h = new Date().getHours(); return h >= 5 && h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'; };

  function renderScene(scene) {
    chosenScene = scene;
    scenePreview?.classList.remove('scene-morning','scene-afternoon','scene-evening','scene-night');
    scenePreview?.classList.add(`scene-${scene}`);
    page.querySelector('[data-scene-period]').textContent = sceneMeta[scene][0];
    page.querySelector('[data-scene-time-range]').textContent = sceneMeta[scene][1];
    page.querySelectorAll('[data-scene-choice]').forEach((button) => button.classList.toggle('active', button.dataset.sceneChoice === scene));
  }

  function renderGradient() {
    page.querySelector('[data-gradient-value]').textContent = `${gradient.value}%`;
    page.querySelector('[data-gradient-sample]').style.backgroundImage = `linear-gradient(0deg, rgba(38,25,56,${Number(gradient.value) / 100}), rgba(38,25,56,.03)), url("assets/hero-room.png")`;
  }

  function renderTetrPreview() {
    const value = Number(tetrLines?.value || 1);
    const labels = { 1: 'Leggera', 2: 'Media', 3: 'Marcata' };
    const label = page.querySelector('[data-tetr-lines-label]');
    if (label) label.textContent = labels[value];
    const preview = page.querySelector('.settings-tetr-preview');
    if (preview) {
      const bg = page.querySelector('[data-setting-tetr-bg]')?.value || 'rose';
      const backgrounds = { rose: '#F7F4FA', white: '#FFFFFF', lilac: '#F2EFF8' };
      preview.style.setProperty('--preview-grid-background', backgrounds[bg]);
      preview.style.setProperty('--preview-grid-line', `rgba(82,63,119,${({1:.10,2:.18,3:.28})[value]})`);
      const borders = page.querySelector('[data-setting-appearance="tetrBorders"]')?.checked !== false;
      preview.classList.toggle('preview-borders-off', !borders);
    }
  }

  function categoryRow(item, index) {
    const color = item.color || categoryColors[index % categoryColors.length];
    const icon = item.icon || categoryIcons[index % categoryIcons.length];
    const row = document.createElement('div');
    row.className = 'category-setting-row';
    row.dataset.categoryId = item.id || `custom-${Date.now()}-${index}`;
    row.dataset.categoryColor = color;
    row.dataset.categoryIcon = icon;
    row.innerHTML = `<span class="category-color color-${color}"></span><input type="text" value="${escapeHtml(item.name || 'Nuova categoria')}" data-category-name><span class="category-icon">${escapeHtml(icon)}</span><label class="settings-switch-row compact"><span><strong>Visibile</strong></span><input type="checkbox" data-category-visible${item.visible === false ? '' : ' checked'}><i aria-hidden="true"></i></label><button type="button" class="category-remove" aria-label="Rimuovi categoria">×</button>`;
    return row;
  }

  function renderCategories(categories) {
    categoryList.innerHTML = '';
    categories.forEach((item, index) => categoryList.append(categoryRow(item, index)));
  }

  function readCategories() {
    return [...categoryList.querySelectorAll('.category-setting-row')].map((row, index) => ({
      id: row.dataset.categoryId || `category-${index + 1}`,
      name: row.querySelector('[data-category-name]').value.trim() || `Categoria ${index + 1}`,
      color: row.dataset.categoryColor || categoryColors[index % categoryColors.length],
      icon: row.dataset.categoryIcon || categoryIcons[index % categoryIcons.length],
      visible: row.querySelector('[data-category-visible]').checked
    }));
  }

  page.querySelectorAll('[data-scene-choice]').forEach((button) => button.addEventListener('click', () => { autoScenes.checked = false; renderScene(button.dataset.sceneChoice); }));
  autoScenes.addEventListener('change', () => { if (autoScenes.checked) renderScene(currentScene()); });
  gradient.addEventListener('input', renderGradient);
  tetrLines?.addEventListener('input', renderTetrPreview);
  page.querySelector('[data-setting-tetr-bg]')?.addEventListener('change', renderTetrPreview);
  page.querySelector('[data-setting-appearance="tetrBorders"]')?.addEventListener('change', renderTetrPreview);
  page.querySelectorAll('[data-single-choice]').forEach((group) => group.querySelectorAll('.settings-choice').forEach((choice) => choice.addEventListener('click', () => { group.querySelectorAll('.settings-choice').forEach((item) => item.classList.remove('active')); choice.classList.add('active'); })));
  page.querySelectorAll('[data-segmented]').forEach((group) => group.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { group.querySelectorAll('button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); })));
  page.querySelector('[data-add-category]')?.addEventListener('click', () => {
    const index = categoryList.children.length;
    categoryList.append(categoryRow({ id: `custom-${Date.now()}`, name: 'Nuova categoria', color: categoryColors[index % categoryColors.length], icon: categoryIcons[index % categoryIcons.length], visible: true }, index));
    categoryList.lastElementChild.querySelector('[data-category-name]')?.select();
  });
  categoryList?.addEventListener('click', (event) => {
    const button = event.target.closest('.category-remove');
    if (!button) return;
    if (categoryList.children.length <= 1) { saveFeedback.textContent = 'Deve restare almeno una categoria.'; return; }
    button.closest('.category-setting-row')?.remove();
  });

  function updateConnectionStatus(message, type) {
    if (!connectionStatus) return;
    connectionStatus.textContent = message;
    connectionStatus.className = `settings-connection-status is-${type}`;
  }

  function loadSettings() {
    const settings = trackerSettings();
    page.querySelector('[data-setting-city]').value = settings.city || 'Roma, Italia';
    page.querySelector('[data-setting-weather-unit]').value = settings.weatherUnit || 'celsius';
    page.querySelector('[data-setting-weather-refresh]').value = settings.weatherRefresh || '60';
    page.querySelector('[data-setting-clock-format]').value = settings.clockFormat || '24';
    page.querySelector('[data-setting-week-start]').value = settings.weekStart || 'monday';
    page.querySelector('[data-setting-date-format]').value = settings.dateFormat || 'long-weekday';
    page.querySelector('[data-setting-bottle]').value = settings.bottleMl || 750;
    const glassInput = page.querySelector('[data-setting-glass]');
    if (glassInput) glassInput.value = settings.glassMl || 220;
    page.querySelector('[data-setting-water-division]').value = settings.waterDivision || 'quarters';
    page.querySelector('[data-setting-water-equivalence]').checked = settings.showWaterEquivalence !== false;
    page.querySelectorAll('[data-setting-home]').forEach((input) => { input.checked = settings.home?.[input.dataset.settingHome] !== false; });

    const appearance = settings.appearance || {};
    autoScenes.checked = appearance.autoScenes !== false;
    gradient.value = appearance.gradient || 62;
    renderScene(autoScenes.checked ? currentScene() : (appearance.scene || 'afternoon'));
    renderGradient();
    page.querySelectorAll('[data-text-mode]').forEach((button) => button.classList.toggle('active', button.dataset.textMode === (appearance.textMode || 'normal')));
    page.querySelectorAll('[data-decoration-mode]').forEach((button) => button.classList.toggle('active', button.dataset.decorationMode === (appearance.decorations || 'full')));
    page.querySelector('[data-setting-tetr-bg]').value = appearance.tetrGridBackground || 'rose';
    tetrLines.value = appearance.tetrGridLines || 1;
    page.querySelectorAll('[data-setting-appearance]').forEach((input) => { input.checked = appearance[input.dataset.settingAppearance] !== false; });
    renderTetrPreview();

    const tracker = settings.tracker || {};
    page.querySelectorAll('[data-setting-sleep]').forEach((input) => { input.checked = tracker.sleep?.[input.dataset.settingSleep] !== false; });
    page.querySelectorAll('[data-setting-tetr]').forEach((input) => { input.checked = tracker.tetr?.[input.dataset.settingTetr] !== false; });
    page.querySelector('[data-setting-work]').checked = tracker.showWorkInStats !== false;
    page.querySelectorAll('[data-setting-food]').forEach((input) => { input.checked = tracker.food?.[input.dataset.settingFood] !== false; });
    renderCategories(tracker.categories || visibleCategories());

    if (connectionUrl) connectionUrl.value = Store.getScriptUrl();
    updateConnectionStatus(Store.getScriptUrl() ? 'Configurato. Premi “Verifica collegamento”.' : 'Non configurato', Store.getScriptUrl() ? 'wait' : 'off');
  }

  function saveSettings({ showFeedback = true } = {}) {
    const oldState = Store.getState();
    const oldCategories = oldState.settings.tracker?.categories || [];
    const categories = readCategories();
    const renameMap = Object.fromEntries(oldCategories.map((old) => {
      const next = categories.find((item) => item.id === old.id);
      return [old.name, next?.name || old.name];
    }));
    const nextState = oldState;
    nextState.settings = {
      ...oldState.settings,
      city: page.querySelector('[data-setting-city]').value.trim() || 'Roma, Italia',
      weatherUnit: page.querySelector('[data-setting-weather-unit]').value,
      weatherRefresh: page.querySelector('[data-setting-weather-refresh]').value,
      clockFormat: page.querySelector('[data-setting-clock-format]').value,
      weekStart: page.querySelector('[data-setting-week-start]').value,
      dateFormat: page.querySelector('[data-setting-date-format]').value,
      bottleMl: Math.max(100, Number(page.querySelector('[data-setting-bottle]').value) || 750),
      glassMl: Math.max(100, Math.min(500, Number(page.querySelector('[data-setting-glass]')?.value) || 220)),
      waterDivision: page.querySelector('[data-setting-water-division]').value,
      showWaterEquivalence: page.querySelector('[data-setting-water-equivalence]').checked,
      home: Object.fromEntries([...page.querySelectorAll('[data-setting-home]')].map((input) => [input.dataset.settingHome, input.checked])),
      appearance: {
        ...oldState.settings.appearance,
        autoScenes: autoScenes.checked,
        scene: chosenScene,
        gradient: Number(gradient.value),
        textMode: page.querySelector('[data-text-mode].active')?.dataset.textMode || 'normal',
        decorations: oldState.settings.appearance?.decorations || 'full',
        tetrGridBackground: page.querySelector('[data-setting-tetr-bg]').value,
        tetrGridLines: Number(tetrLines.value),
        ...Object.fromEntries([...page.querySelectorAll('[data-setting-appearance]')].map((input) => [input.dataset.settingAppearance, input.checked]))
      },
      tracker: {
        ...oldState.settings.tracker,
        sleep: Object.fromEntries([...page.querySelectorAll('[data-setting-sleep]')].map((input) => [input.dataset.settingSleep, input.checked])),
        tetr: Object.fromEntries([...page.querySelectorAll('[data-setting-tetr]')].map((input) => [input.dataset.settingTetr, input.checked])),
        categories,
        showWorkInStats: page.querySelector('[data-setting-work]').checked,
        food: Object.fromEntries([...page.querySelectorAll('[data-setting-food]')].map((input) => [input.dataset.settingFood, input.checked]))
      }
    };
    nextState.settingsUpdatedAt = new Date().toISOString();
    Object.values(nextState.days || {}).forEach((day) => {
      day.activities = (day.activities || []).map((activity) => ({ ...activity, category: renameMap[activity.category] || activity.category }));
    });
    Store.replaceState(nextState, 'settings-update');
    if (showFeedback) {
      saveFeedback.textContent = 'Impostazioni salvate e applicate al tracker.';
      setTimeout(() => { saveFeedback.textContent = ''; }, 3500);
    } else {
      saveFeedback.textContent = 'Modifica salvata automaticamente.';
      window.clearTimeout(saveFeedback._clearTimer);
      saveFeedback._clearTimer = window.setTimeout(() => { saveFeedback.textContent = ''; }, 1800);
    }
  }

  let automaticSaveTimer = null;
  function queueAutomaticSettingsSave() {
    window.clearTimeout(automaticSaveTimer);
    automaticSaveTimer = window.setTimeout(() => saveSettings({ showFeedback: false }), 120);
  }

  page.querySelector('[data-save-settings]').addEventListener('click', () => saveSettings());
  page.addEventListener('change', (event) => {
    if (event.target.closest('[data-connection-url], [data-import-file]')) return;
    if (event.target.matches('input, select, textarea')) queueAutomaticSettingsSave();
  });
  page.querySelectorAll('[data-scene-choice], [data-text-mode], [data-segmented] button').forEach((control) => {
    control.addEventListener('click', queueAutomaticSettingsSave);
  });


  page.querySelector('[data-connect-sheet]')?.addEventListener('click', async () => {
    const url = connectionUrl.value.trim();
    if (!url) { updateConnectionStatus('Incolla prima l’URL della Web App.', 'error'); return; }
    updateConnectionStatus('Verifica in corso…', 'wait');
    try { await Store.ping(url); Store.setScriptUrl(url); updateConnectionStatus('Collegamento riuscito. I salvataggi verranno sincronizzati.', 'ok'); }
    catch (error) { updateConnectionStatus(`Collegamento non riuscito: ${error.message}`, 'error'); }
  });
  page.querySelector('[data-pull-sheet]')?.addEventListener('click', async () => {
    updateConnectionStatus('Caricamento dal foglio…', 'wait');
    try { await Store.pullRemote({ merge: true }); loadSettings(); updateConnectionStatus('Dati del foglio caricati e uniti a quelli locali.', 'ok'); }
    catch (error) { updateConnectionStatus(`Caricamento non riuscito: ${error.message}`, 'error'); }
  });
  page.querySelector('[data-push-sheet]')?.addEventListener('click', async () => {
    updateConnectionStatus('Invio dei dati locali…', 'wait');
    try { await Store.pushRemote(); updateConnectionStatus('Dati locali inviati a Google Sheets.', 'ok'); }
    catch (error) { updateConnectionStatus(`Invio non riuscito: ${error.message}`, 'error'); }
  });
  page.querySelector('[data-disconnect-sheet]')?.addEventListener('click', () => { Store.setScriptUrl(''); connectionUrl.value = ''; updateConnectionStatus('Collegamento rimosso. I dati locali restano disponibili.', 'off'); });

  const importInput = page.querySelector('[data-import-file]');
  page.querySelectorAll('[data-data-action]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.dataAction;
    if (action === 'export') {
      const blob = new Blob([Store.exportJson()], { type: 'application/json' });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `tracker-personale-backup-${Store.dateKey(new Date())}.json`; link.click(); URL.revokeObjectURL(link.href);
      dataFeedback.textContent = 'Backup JSON scaricato.';
    } else if (action === 'import') importInput?.click();
    else if (action === 'reset') {
      if (confirm('Ripristinare le impostazioni predefinite? I dati giornalieri resteranno invariati.')) {
        Store.saveSettings({
          city: 'Roma, Italia', weatherUnit: 'celsius', weatherRefresh: '60', clockFormat: '24', weekStart: 'monday', dateFormat: 'long-weekday', bottleMl: 750, glassMl: 220, waterDivision: 'quarters', showWaterEquivalence: true,
          home: { weather:true, summary:true, reminders:true, sections:true, trends:true, recentDays:true, tetrToday:true, tetrWeek:true, tetrReminder:true },
          appearance: { autoScenes:true, scene:'afternoon', gradient:62, textMode:'normal', decorations:'full', tetrGridBackground:'rose', tetrGridLines:1, tetrBorders:true, tetrHover:true },
          tracker: {
            sleep: { awakenings:true, energy:true, riseDelay:true },
            tetr: { ghost:true, keyboard:true, confirm:true, note:true, highlightToday:true },
            categories: [
              { id:'work', name:'Lavoro', color:'violet', icon:'◷', visible:true }, { id:'creative', name:'Creatività', color:'rose', icon:'✦', visible:true }, { id:'home', name:'Casa', color:'violet', icon:'⌂', visible:true },
              { id:'errands', name:'Commissioni', color:'sky', icon:'⌖', visible:true }, { id:'leisure', name:'Svago', color:'lilac', icon:'☾', visible:true }, { id:'personal', name:'Cura personale', color:'periwinkle', icon:'♡', visible:true }, { id:'other', name:'Altro', color:'neutral', icon:'•', visible:true }
            ],
            showWorkInStats: true,
            food: { breakfast:true, lunch:true, dinner:true, snacks:true }
          }
        });
        loadSettings(); dataFeedback.textContent = 'Impostazioni ripristinate.';
      }
    } else if (action === 'delete') {
      if (confirm('Eliminare tutti i dati del tracker? Questa azione non può essere annullata.') && confirm('Confermi definitivamente l’eliminazione di tutti i dati?')) { Store.resetAll(); loadSettings(); dataFeedback.textContent = 'Tutti i dati sono stati eliminati.'; }
    }
  }));
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0]; if (!file) return;
    try { Store.importJson(await file.text()); dataFeedback.textContent = 'Backup importato correttamente.'; loadSettings(); }
    catch (error) { dataFeedback.textContent = `File non valido: ${error.message}`; }
    importInput.value = '';
  });
  page.querySelector('[data-demo-upload]')?.addEventListener('click', () => { page.querySelector('[data-image-feedback]').textContent = 'Il caricamento di immagini personalizzate resta locale e verrà aggiunto in una fase successiva.'; });
  page.querySelector('[data-demo-reset]')?.addEventListener('click', () => { autoScenes.checked = true; renderScene(currentScene()); page.querySelector('[data-image-feedback]').textContent = 'Scene automatiche ripristinate. Premi Salva modifiche.'; });
  loadSettings();
})();

// Se è già configurato un foglio, prova a unire i dati remoti senza bloccare l'apertura del sito.
if (Store?.getScriptUrl()) {
  Store.pullRemote({ merge: true }).catch((error) => console.warn('Sincronizzazione iniziale non riuscita. I dati locali restano disponibili.', error));
}

// V24 — esportazione del riepilogo, CSV e grafici PNG per Notion.
(() => {
  const page = document.querySelector('.stats-page');
  const dialog = document.querySelector('[data-notion-export-dialog]');
  if (!page || !dialog) return;

  const periodControl = dialog.querySelector('[data-notion-period]');
  const customDates = dialog.querySelector('[data-notion-custom-dates]');
  const startInput = dialog.querySelector('[data-notion-start]');
  const endInput = dialog.querySelector('[data-notion-end]');
  const periodCaption = dialog.querySelector('[data-notion-period-caption]');
  const detailControl = dialog.querySelector('[data-notion-detail]');
  const notesControl = dialog.querySelector('[data-notion-notes]');
  const feedback = dialog.querySelector('[data-notion-feedback]');
  const pageFeedback = page.querySelector('[data-stats-export-feedback]');

  const COLORS = {
    ink: '#2F283B', muted: '#6D6578', violet: '#523F77', violetSoft: '#EEE9F4',
    line: '#DED9E5', rose: '#B35A8A', pink: '#F6B7C7', lilac: '#B6A5CE',
    periwinkle: '#7880AE', sky: '#A3BBD7', white: '#FFFFFF', pale: '#F8F6FA',
    sleep: ['#F5F1F8', '#DCD3E9', '#B9A8D0', '#8A75AA', '#523F77'],
    water: ['#F4F7FA', '#DDE8F1', '#BDD2E3', '#91B4D1', '#5F8EB7'],
    work: ['#F5F3F8', '#E4DFF0', '#BDB3D4', '#8C7DAE', '#5E4D82']
  };

  const IMAGE_META = {
    overview: { label: 'Panoramica del periodo', file: 'panoramica' },
    'sleep-trend': { label: 'Andamento del sonno', file: 'andamento-sonno' },
    'sleep-calendar': { label: 'Calendario del sonno', file: 'calendario-sonno' },
    'water-trend': { label: 'Andamento dell’acqua', file: 'andamento-acqua' },
    'water-calendar': { label: 'Calendario dell’acqua', file: 'calendario-acqua' },
    'work-calendar': { label: 'Calendario delle ore lavorate', file: 'calendario-lavoro' },
    activities: { label: 'Distribuzione delle attività', file: 'distribuzione-attivita' },
    emotions: { label: 'Distribuzione delle emozioni', file: 'distribuzione-emozioni' },
    'tetr-grid': { label: 'Griglia Tetr-Emotion', file: 'griglia-tetr-emotion' }
  };

  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const workMinutes = (day) => (day.activities || []).filter((item) => isWorkCategory(item.category)).reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
  const activityMinutes = (day) => (day.activities || []).reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  function enumerateDates(range) {
    const dates = [];
    const cursor = new Date(range.start);
    cursor.setHours(12, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(12, 0, 0, 0);
    while (cursor <= end) {
      const date = new Date(cursor);
      const key = Store.dateKey(date);
      dates.push({ date, key, day: Store.getDay(key) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function selectedSections() {
    return new Set([...dialog.querySelectorAll('[data-notion-section]:checked')].map((input) => input.value));
  }

  function selectedImageKeys() {
    return [...dialog.querySelectorAll('[data-notion-image]:checked')].map((input) => input.value);
  }

  function currentStatsRange() {
    const statsPeriod = page.querySelector('[data-stats-period]')?.value || '30';
    return getDateRange(statsPeriod);
  }

  function resolveRange() {
    const value = periodControl.value;
    if (value === 'current') return currentStatsRange();
    if (value === 'custom') {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(startInput.value) ? new Date(`${startInput.value}T12:00:00`) : null;
      const end = /^\d{4}-\d{2}-\d{2}$/.test(endInput.value) ? new Date(`${endInput.value}T12:00:00`) : null;
      if (!start || !end || start > end) throw new Error('Controlla le date dell’intervallo personalizzato.');
      return { start, end, startKey: Store.dateKey(start), endKey: Store.dateKey(end) };
    }
    return getDateRange(value);
  }

  function periodLabel(range) {
    return `${formatDate(range.start, { day: 'numeric', month: 'long', year: 'numeric' })} — ${formatDate(range.end, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  function periodSlug(range) {
    return `${Store.dateKey(range.start)}_${Store.dateKey(range.end)}`;
  }

  function averageClock(values, bedtime = false) {
    const minutes = values.map(parseTime).filter((value) => value !== null).map((value) => bedtime && value < 720 ? value + 1440 : value);
    return minutes.length ? average(minutes) : null;
  }

  function clockLabel(value) {
    if (!Number.isFinite(value)) return '—';
    const normalized = Math.round(value) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  }

  function calculate(days) {
    const sleep = days.map((day) => Number(day.sleep?.duration)).filter((value) => Number.isFinite(value) && value > 0);
    const water = days.map(waterQuarters).filter((value) => value > 0);
    const work = days.map(workMinutes).filter((value) => value > 0);
    const activities = days.map(activityMinutes).filter((value) => value > 0);
    const energy = days.map((day) => sleepEnergy(day.sleep)).filter((value) => value !== null);
    const bedtimes = days.map((day) => day.sleep?.bedtime).filter(Boolean);
    const wakes = days.map((day) => day.sleep?.wake).filter(Boolean);
    const rise = days.map((day) => Number(day.sleep?.riseDelay)).filter((value) => Number.isFinite(value));
    const naps = days.map((day) => Number(day.sleep?.nap?.duration)).filter((value) => Number.isFinite(value) && value > 0);
    const emotionCounts = Object.fromEntries(Object.keys(EMOTIONS).map((key) => [key, 0]));
    const categoryMinutes = {};
    const categoryCounts = {};
    const mealCounts = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
    let totalActivities = 0;
    let awakenings = 0;
    days.forEach((day) => {
      if (day.tetr?.emotionKey && emotionCounts[day.tetr.emotionKey] !== undefined) emotionCounts[day.tetr.emotionKey] += 1;
      Object.keys(mealCounts).forEach((key) => { if (String(day.meals?.[key] || '').trim() || (day.mealItems?.[key] || []).length) mealCounts[key] += 1; });
      awakenings += Array.isArray(day.sleep?.awakenings) ? day.sleep.awakenings.length : 0;
      (day.activities || []).forEach((item) => {
        const category = item.category || 'Altro';
        categoryMinutes[category] = (categoryMinutes[category] || 0) + (Number(item.duration) || 0);
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        totalActivities += 1;
      });
    });
    const mostEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
    return {
      sleepAverage: average(sleep), sleepCount: sleep.length, sleepTotal: sleep.reduce((sum, value) => sum + value, 0),
      waterAverage: average(water), waterTotal: water.reduce((sum, value) => sum + value, 0), waterCount: water.length, waterMax: Math.max(0, ...water),
      workTotal: work.reduce((sum, value) => sum + value, 0), workAverage: average(work),
      activityTotal: activities.reduce((sum, value) => sum + value, 0), totalActivities, categoryMinutes, categoryCounts, topCategory,
      energyAverage: average(energy), energyCount: energy.length, bedtime: averageClock(bedtimes, true), wake: averageClock(wakes), riseAverage: average(rise), awakenings, napAverage: average(naps), napCount: naps.length,
      beverageGlasses: days.reduce((sum, day) => sum + beverageGlasses(day), 0), beverageMl: days.reduce((sum, day) => sum + beverageMilliliters(day), 0),
      emotionCounts, mostEmotion, mealCounts, completedDays: days.filter(dayHasData).length
    };
  }

  function longestEmotionStreak(days) {
    let best = { key: null, length: 0 };
    let run = { key: null, length: 0 };
    days.filter((day) => day.tetr).sort((a, b) => a.date.localeCompare(b.date)).forEach((day) => {
      run = run.key === day.tetr.emotionKey ? { key: run.key, length: run.length + 1 } : { key: day.tetr.emotionKey, length: 1 };
      if (run.length > best.length) best = { ...run };
    });
    return best;
  }

  function createContext() {
    const range = resolveRange();
    const dateEntries = enumerateDates(range);
    const days = dateEntries.map((entry) => entry.day);
    const stats = calculate(days);
    const monthDate = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    return { range, dateEntries, days, stats, monthDate, label: periodLabel(range), slug: periodSlug(range) };
  }

  function updatePeriodCaption() {
    customDates.hidden = periodControl.value !== 'custom';
    try {
      const range = resolveRange();
      periodCaption.textContent = periodLabel(range);
    } catch (error) {
      periodCaption.textContent = error.message;
    }
  }

  function activityDescription(day) {
    return (day.activities || []).map((item) => {
      const duration = Number(item.duration) > 0 ? ` (${formatMinutes(Number(item.duration))})` : '';
      return `${item.title || 'Attività'}${duration}`;
    }).join('; ');
  }

  function buildMarkdown(context) {
    const { range, days, stats, label } = context;
    const sections = selectedSections();
    const full = detailControl.value === 'full';
    const includeNotes = notesControl.checked;
    const emotion = stats.mostEmotion[0] ? EMOTIONS[stats.mostEmotion[0]] : null;
    const streak = longestEmotionStreak(days);
    const lines = [
      `# Riepilogo personale — ${formatDate(range.end, { month: 'long', year: 'numeric' })}`,
      '',
      `**Periodo:** ${label}`,
      `**Giornate con dati:** ${stats.completedDays}`,
      ''
    ];

    if (sections.has('overview')) {
      lines.push('## Panoramica', '', '| Dato | Valore |', '|---|---|',
        `| Sonno medio | ${stats.sleepCount ? formatMinutes(stats.sleepAverage) : '—'} |`,
        `| Acqua media | ${stats.waterCount ? `${formatWater(Math.round(stats.waterAverage))} · ${waterLiters(stats.waterAverage, Store.getState().settings.bottleMl)}` : '—'} |`,
        `| Ore lavorate | ${stats.workTotal ? formatMinutes(stats.workTotal) : '—'} |`,
        `| Attività registrate | ${stats.totalActivities} |`,
        `| Emozione più frequente | ${emotion ? `${emotion.label} · ${stats.mostEmotion[1]} giorni` : '—'} |`,
        '');
    }

    if (sections.has('sleep')) {
      lines.push('## Sonno', '',
        `- Sonno medio: **${stats.sleepCount ? formatMinutes(stats.sleepAverage) : '—'}**`,
        `- Energie medie al risveglio: **${stats.energyCount ? `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(stats.energyAverage)} / 5` : '—'}**`,
        `- Riposi pomeridiani: **${stats.napCount}**${stats.napCount ? ` · durata media ${formatMinutes(stats.napAverage)}` : ''}`,
        `- Orario medio a letto: **${clockLabel(stats.bedtime)}**`,
        `- Sveglia media: **${clockLabel(stats.wake)}**`,
        `- Tempo medio per alzarti: **${stats.riseAverage ? formatMinutes(stats.riseAverage) : '—'}**`,
        `- Risvegli complessivi: **${stats.awakenings}**`, '');
      if (full) {
        lines.push('| Data | Durata | A letto | Sveglia | Energie | Risvegli |', '|---|---:|---:|---:|---:|---:|');
        context.dateEntries.filter(({ day }) => day.sleep).forEach(({ date, day }) => lines.push(`| ${formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' })} | ${formatMinutes(day.sleep.duration)} | ${day.sleep.bedtime || '—'} | ${day.sleep.wake || '—'} | ${sleepEnergy(day.sleep) || '—'} | ${Array.isArray(day.sleep.awakenings) ? day.sleep.awakenings.length : 0} |`));
        lines.push('');
      }
    }

    if (sections.has('water')) {
      lines.push('## Cibo e acqua', '',
        `- Acqua media: **${stats.waterCount ? `${formatWater(Math.round(stats.waterAverage))} · ${waterLiters(stats.waterAverage, Store.getState().settings.bottleMl)}` : '—'}**`,
        `- Acqua totale: **${waterLiters(stats.waterTotal, Store.getState().settings.bottleMl)}**`,
        `- Altre bevande: **${stats.beverageGlasses} ${stats.beverageGlasses === 1 ? 'bicchiere' : 'bicchieri'} · circa ${new Intl.NumberFormat('it-IT').format(stats.beverageMl)} ml**`,
        `- Colazioni registrate: **${stats.mealCounts.breakfast}**`,
        `- Pranzi registrati: **${stats.mealCounts.lunch}**`,
        `- Cene registrate: **${stats.mealCounts.dinner}**`,
        `- Giornate con spuntini: **${stats.mealCounts.snacks}**`, '');
      if (full) {
        lines.push('| Data | Acqua | Altre bevande | Colazione | Pranzo | Cena | Spuntini |', '|---|---:|---|---|---|---|---|');
        context.dateEntries.filter(({ day }) => waterQuarters(day) || (day.beverages || []).length || Object.values(day.meals || {}).some(Boolean)).forEach(({ date, day }) => lines.push(`| ${formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' })} | ${formatWater(waterQuarters(day))} | ${(day.beverages || []).map((drink) => `${drink.name}: ${drink.glasses} bicch.`).join('; ') || '—'} | ${day.meals?.breakfast || '—'} | ${day.meals?.lunch || '—'} | ${day.meals?.dinner || '—'} | ${day.meals?.snacks || '—'} |`));
        lines.push('');
      }
    }

    if (sections.has('day')) {
      lines.push('## La mia giornata', '',
        `- Attività registrate: **${stats.totalActivities}**`,
        `- Ore lavorate: **${stats.workTotal ? formatMinutes(stats.workTotal) : '—'}**`,
        `- Categoria più presente: **${stats.topCategory[0] || '—'}${stats.topCategory[1] ? ` · ${stats.topCategory[1]} attività` : ''}**`, '');
      const categories = Object.entries(stats.categoryMinutes).sort((a, b) => b[1] - a[1]);
      if (categories.length) {
        lines.push('### Tempo per categoria', '');
        categories.forEach(([category, minutes]) => lines.push(`- ${category}: **${minutes ? formatMinutes(minutes) : 'Senza durata registrata'}**`));
        lines.push('');
      }
      if (full) {
        lines.push('| Data | Attività | Ore lavorate |', '|---|---|---:|');
        context.dateEntries.filter(({ day }) => day.activities?.length).forEach(({ date, day }) => lines.push(`| ${formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric' })} | ${activityDescription(day) || '—'} | ${workMinutes(day) ? formatMinutes(workMinutes(day)) : '—'} |`));
        lines.push('');
      }
    }

    if (sections.has('tetr')) {
      lines.push('## Tetr-Emotion', '');
      Object.entries(EMOTIONS).forEach(([key, item]) => lines.push(`- ${item.label}: **${stats.emotionCounts[key] || 0} ${(stats.emotionCounts[key] || 0) === 1 ? 'giorno' : 'giorni'}**`));
      lines.push('', `**Emozione più frequente:** ${emotion ? emotion.label : '—'}`,
        `**Serie più lunga:** ${streak.length ? `${streak.length} ${streak.length === 1 ? 'giorno' : 'giorni'} · ${EMOTIONS[streak.key]?.label}` : '—'}`, '',
        '> La griglia Tetr-Emotion e gli altri grafici possono essere scaricati separatamente come immagini PNG.', '');
    }

    if (sections.has('diary')) {
      lines.push('## Diario giornaliero', '');
      context.dateEntries.filter(({ day }) => dayHasData(day)).forEach(({ date, day }) => {
        const emotionData = day.tetr ? EMOTIONS[day.tetr.emotionKey] : null;
        lines.push(`### ${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, '',
          `- **Sonno:** ${day.sleep ? formatMinutes(day.sleep.duration) : '—'}`,
          `- **Acqua:** ${waterQuarters(day) ? formatWater(waterQuarters(day)) : '—'}`,
          `- **Lavoro:** ${workMinutes(day) ? formatMinutes(workMinutes(day)) : '—'}`,
          `- **Emozione:** ${emotionData?.label || '—'}`);
        if (day.activities?.length) lines.push(`- **Attività:** ${activityDescription(day)}`);
        const meals = [['Colazione', day.meals?.breakfast], ['Pranzo', day.meals?.lunch], ['Cena', day.meals?.dinner], ['Spuntini', day.meals?.snacks]].filter(([, value]) => String(value || '').trim());
        if (meals.length) {
          lines.push('', '**Cosa ho mangiato**');
          meals.forEach(([name, value]) => lines.push(`- ${name}: ${value}`));
        }
        if (includeNotes) {
          const notes = [day.dailyNote, day.sleep?.note, day.tetr?.note, ...(day.activities || []).map((item) => item.note)].filter((value) => String(value || '').trim());
          if (notes.length) lines.push('', '**Note**', ...notes.map((note) => `> ${note}`));
        }
        lines.push('');
      });
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function inlineMarkdown(value) {
    return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function markdownToHtml(markdown) {
    const lines = markdown.split('\n');
    const html = [];
    let index = 0;
    let listOpen = false;
    const closeList = () => { if (listOpen) { html.push('</ul>'); listOpen = false; } };
    while (index < lines.length) {
      const line = lines[index];
      const next = lines[index + 1] || '';
      if (!line.trim()) { closeList(); index += 1; continue; }
      if (/^\|/.test(line) && /^\|?\s*:?-+/.test(next)) {
        closeList();
        const headers = line.split('|').slice(1, -1).map((cell) => cell.trim());
        html.push('<table><thead><tr>' + headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('') + '</tr></thead><tbody>');
        index += 2;
        while (index < lines.length && /^\|/.test(lines[index])) {
          const cells = lines[index].split('|').slice(1, -1).map((cell) => cell.trim());
          html.push('<tr>' + cells.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('') + '</tr>');
          index += 1;
        }
        html.push('</tbody></table>');
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) { closeList(); html.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`); index += 1; continue; }
      if (line.startsWith('- ')) {
        if (!listOpen) { html.push('<ul>'); listOpen = true; }
        html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`); index += 1; continue;
      }
      if (line.startsWith('> ')) { closeList(); html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`); index += 1; continue; }
      closeList(); html.push(`<p>${inlineMarkdown(line)}</p>`); index += 1;
    }
    closeList();
    return `<div>${html.join('')}</div>`;
  }

  function buildCsv(context) {
    const bottleMl = Store.getState().settings.bottleMl;
    const headers = ['Data', 'Sonno minuti', 'A letto', 'Sveglia', 'Tempo per alzarsi minuti', 'Energie al risveglio', 'Risvegli', 'Riposo pomeridiano inizio', 'Riposo pomeridiano fine', 'Riposo pomeridiano minuti', 'Acqua quarti', 'Acqua ml', 'Altre bevande', 'Bicchieri altre bevande', 'Colazione', 'Pranzo', 'Cena', 'Spuntini', 'Lavoro minuti', 'Attività', 'Emozione', 'Nota Tetr-Emotion', 'Nota giornata'];
    const rows = context.dateEntries.map(({ key, day }) => {
      const quarters = waterQuarters(day);
      const emotion = day.tetr ? EMOTIONS[day.tetr.emotionKey]?.label : '';
      return [key, day.sleep?.duration || '', day.sleep?.bedtime || '', day.sleep?.wake || '', day.sleep?.riseDelay ?? '', sleepEnergy(day.sleep) || '', Array.isArray(day.sleep?.awakenings) ? day.sleep.awakenings.length : '', day.sleep?.nap?.start || '', day.sleep?.nap?.end || '', day.sleep?.nap?.duration ?? '', quarters || '', quarters ? Math.round(quarters * bottleMl / 4) : '', (day.beverages || []).map((drink) => `${drink.name}: ${drink.glasses}`).join('; '), beverageGlasses(day) || '', day.meals?.breakfast || '', day.meals?.lunch || '', day.meals?.dinner || '', day.meals?.snacks || '', workMinutes(day) || '', activityDescription(day), emotion || '', day.tetr?.note || '', day.dailyNote || ''];
    });
    return '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function setBusy(value, message = '') {
    dialog.classList.toggle('is-busy', value);
    if (message) feedback.textContent = message;
  }

  function canvasBase(title, subtitle, width = 1600, height = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = COLORS.violet;
    ctx.font = '700 54px Arial, sans-serif';
    ctx.fillText(title, 88, 90);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '400 25px Arial, sans-serif';
    ctx.fillText(subtitle, 88, 134);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(88, 174); ctx.lineTo(width - 88, 174); ctx.stroke();
    return { canvas, ctx, width, height, top: 220, left: 88, right: width - 88, bottom: height - 72 };
  }

  function roundedRect(ctx, x, y, width, height, radius, fill, stroke = null) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(index === maxLines - 1 && lines.length > maxLines ? `${item}…` : item, x, y + index * lineHeight));
  }

  function drawEmpty(ctx, width, height, message = 'Nessun dato nel periodo selezionato') {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '400 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
    ctx.textAlign = 'left';
  }

  function drawOverview(context) {
    const base = canvasBase('Panoramica del periodo', context.label, 1600, 1040);
    const { ctx, canvas } = base;
    const emotion = context.stats.mostEmotion[0] ? EMOTIONS[context.stats.mostEmotion[0]] : null;
    const cards = [
      ['Sonno medio', context.stats.sleepCount ? formatMinutes(context.stats.sleepAverage) : '—', `${context.stats.sleepCount} notti registrate`, '#F4EFF7'],
      ['Acqua media', context.stats.waterCount ? formatWater(Math.round(context.stats.waterAverage)) : '—', context.stats.waterCount ? waterLiters(context.stats.waterAverage, Store.getState().settings.bottleMl) : 'Nessun dato', '#EEF4F8'],
      ['Ore lavorate', context.stats.workTotal ? formatMinutes(context.stats.workTotal) : '—', `${context.stats.totalActivities} attività registrate`, '#F1EFF7'],
      ['Emozione più frequente', emotion?.label || '—', emotion ? `${context.stats.mostEmotion[1]} giorni` : 'Nessun dato', emotion?.color ? `${emotion.color}26` : '#F7F4F9'],
      ['Giornate con dati', String(context.stats.completedDays), `${context.dateEntries.length} giorni nel periodo`, '#F8F3F6']
    ];
    const positions = [[88, 235, 690, 245], [822, 235, 690, 245], [88, 520, 690, 245], [822, 520, 690, 245], [455, 805, 690, 170]];
    cards.forEach(([label, value, note, fill], index) => {
      const [x, y, w, h] = positions[index];
      roundedRect(ctx, x, y, w, h, 28, fill, COLORS.line);
      ctx.fillStyle = COLORS.muted; ctx.font = '600 25px Arial, sans-serif'; ctx.fillText(label, x + 32, y + 48);
      ctx.fillStyle = COLORS.violet; ctx.font = index === 3 ? '700 42px Arial, sans-serif' : '700 52px Arial, sans-serif';
      wrapCanvasText(ctx, value, x + 32, y + 115, w - 64, 50, 2);
      ctx.fillStyle = COLORS.muted; ctx.font = '400 22px Arial, sans-serif'; ctx.fillText(note, x + 32, y + h - 30);
    });
    return canvas;
  }

  function drawLineTrend(context, type) {
    const isSleep = type === 'sleep';
    const title = isSleep ? 'Andamento del sonno' : 'Andamento dell’acqua';
    const base = canvasBase(title, context.label, 1600, 1180);
    const { ctx, canvas, left, right } = base;
    const chartOffset = isSleep ? 70 : 190;
    const chart = { x: left + chartOffset, y: 245, width: right - left - chartOffset - 25, height: 610 };
    const values = context.dateEntries.map(({ day }) => isSleep ? (Number(day.sleep?.duration) || 0) : waterQuarters(day));
    const valid = values.filter((value) => value > 0);
    if (!valid.length) { drawEmpty(ctx, canvas.width, canvas.height); return canvas; }
    const maxRaw = Math.max(...valid, isSleep ? 600 : 8);
    const maxValue = isSleep ? Math.ceil(maxRaw / 60) * 60 : Math.ceil(maxRaw);
    ctx.strokeStyle = COLORS.line; ctx.lineWidth = 2;
    for (let line = 0; line <= 4; line += 1) {
      const y = chart.y + chart.height * line / 4;
      ctx.beginPath(); ctx.moveTo(chart.x, y); ctx.lineTo(chart.x + chart.width, y); ctx.stroke();
      const value = maxValue * (1 - line / 4);
      ctx.fillStyle = COLORS.muted; ctx.font = '400 20px Arial, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(isSleep ? `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value / 60)} h` : formatWater(value), chart.x - 16, y + 7);
    }
    ctx.textAlign = 'left';
    const count = Math.max(1, values.length - 1);
    const xFor = (index) => chart.x + chart.width * index / count;
    const yFor = (value) => chart.y + chart.height - (value / maxValue) * chart.height;
    if (isSleep) {
      ctx.strokeStyle = COLORS.violet; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      let drawing = false;
      ctx.beginPath();
      values.forEach((value, index) => {
        if (!value) { drawing = false; return; }
        const x = xFor(index); const y = yFor(value);
        if (!drawing) { ctx.moveTo(x, y); drawing = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      values.forEach((value, index) => { if (!value) return; ctx.fillStyle = COLORS.white; ctx.strokeStyle = COLORS.violet; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(xFor(index), yFor(value), 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    } else {
      const barSpace = chart.width / values.length;
      const barWidth = Math.max(7, Math.min(42, barSpace * .58));
      values.forEach((value, index) => {
        const x = xFor(index) - barWidth / 2;
        const height = value ? (value / maxValue) * chart.height : 0;
        roundedRect(ctx, x, chart.y + chart.height - height, barWidth, height, Math.min(10, barWidth / 2), value ? COLORS.sky : '#EEF0F4');
      });
    }
    const step = Math.max(1, Math.ceil(values.length / 9));
    context.dateEntries.forEach(({ date }, index) => {
      const lastIndex = values.length - 1;
      if (index !== lastIndex && (index % step !== 0 || lastIndex - index < Math.max(2, step / 2))) return;
      ctx.fillStyle = COLORS.muted; ctx.font = '400 19px Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(formatDate(date, { day: 'numeric', month: 'short' }), xFor(index), chart.y + chart.height + 42);
    });
    ctx.textAlign = 'left';
    const avg = average(valid);
    ctx.fillStyle = COLORS.violet; ctx.font = '700 30px Arial, sans-serif';
    ctx.fillText(isSleep ? `Media: ${formatMinutes(avg)}` : `Media: ${formatWater(Math.round(avg))} · ${waterLiters(avg, Store.getState().settings.bottleMl)}`, left, 1100);
    return canvas;
  }

  function heatmapLevel(day, type) {
    if (type === 'sleep') { const value = Number(day.sleep?.duration) || 0; return value ? (value <= 120 ? 1 : value <= 240 ? 2 : value <= 300 ? 3 : 4) : 0; }
    if (type === 'water') { const value = waterQuarters(day); return value ? (value <= 2 ? 1 : value <= 4 ? 2 : value <= 7 ? 3 : 4) : 0; }
    const value = workMinutes(day); return value === 0 ? 0 : value <= 120 ? 2 : value <= 180 ? 3 : 4;
  }

  function heatmapValue(day, type) {
    if (type === 'sleep') return day.sleep?.duration ? formatMinutes(day.sleep.duration) : '—';
    if (type === 'water') return waterQuarters(day) ? formatWater(waterQuarters(day)) : '—';
    return workMinutes(day) ? formatMinutes(workMinutes(day)) : '—';
  }

  function drawCalendar(context, type) {
    const titles = { sleep: 'Calendario del sonno', water: 'Calendario dell’acqua', work: 'Calendario delle ore lavorate' };
    const monthTitle = formatDate(context.monthDate, { month: 'long', year: 'numeric' });
    const base = canvasBase(titles[type], capitalizeFirstLetter(monthTitle), 1600, 1100);
    const { ctx, canvas } = base;
    const first = new Date(context.monthDate.getFullYear(), context.monthDate.getMonth(), 1);
    const daysInMonth = new Date(context.monthDate.getFullYear(), context.monthDate.getMonth() + 1, 0).getDate();
    const sunday = trackerSettings().weekStart === 'sunday';
    const labels = sunday ? ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'] : ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
    const offset = sunday ? first.getDay() : (first.getDay() + 6) % 7;
    const x0 = 120; const y0 = 285; const gap = 14; const cellW = 180; const cellH = 112;
    labels.forEach((label, index) => { ctx.fillStyle = COLORS.violet; ctx.font = '700 23px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x0 + index * (cellW + gap) + cellW / 2, 245); });
    const palette = type === 'sleep' ? COLORS.sleep : type === 'water' ? COLORS.water : COLORS.work;
    for (let number = 1; number <= daysInMonth; number += 1) {
      const position = offset + number - 1;
      const row = Math.floor(position / 7); const column = position % 7;
      const date = new Date(context.monthDate.getFullYear(), context.monthDate.getMonth(), number);
      const day = Store.getDay(Store.dateKey(date));
      const level = heatmapLevel(day, type);
      const x = x0 + column * (cellW + gap); const y = y0 + row * (cellH + gap);
      roundedRect(ctx, x, y, cellW, cellH, 18, palette[level], COLORS.line);
      ctx.fillStyle = COLORS.violet; ctx.font = '700 27px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(String(number), x + 17, y + 34);
      ctx.fillStyle = level >= 4 && type !== 'water' ? COLORS.white : COLORS.ink; ctx.font = '600 19px Arial, sans-serif';
      wrapCanvasText(ctx, heatmapValue(day, type), x + 17, y + 76, cellW - 34, 22, 2);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.muted; ctx.font = '400 20px Arial, sans-serif'; ctx.fillText('Più intenso = valore più alto. Le celle bianche non contengono dati.', 120, 1040);
    return canvas;
  }

  function drawHorizontalDistribution(context, type) {
    const isEmotion = type === 'emotions';
    const items = isEmotion
      ? Object.entries(EMOTIONS).map(([key, item]) => ({ label: item.label, value: context.stats.emotionCounts[key] || 0, color: item.color, valueLabel: `${context.stats.emotionCounts[key] || 0}` }))
      : Object.entries(context.stats.categoryMinutes).sort((a, b) => b[1] - a[1]).map(([label, value], index) => ({ label, value, color: [COLORS.rose, COLORS.violet, COLORS.sky, COLORS.lilac, COLORS.periwinkle, COLORS.pink][index % 6], valueLabel: value ? formatMinutes(value) : '—' }));
    const height = Math.max(900, 330 + items.length * 90);
    const base = canvasBase(isEmotion ? 'Distribuzione delle emozioni' : 'Distribuzione delle attività', context.label, 1600, height);
    const { ctx, canvas } = base;
    if (!items.length || !items.some((item) => item.value > 0)) { drawEmpty(ctx, canvas.width, canvas.height); return canvas; }
    const max = Math.max(1, ...items.map((item) => item.value));
    const labelX = 90; const barX = 520; const barWidth = 780; const valueX = 1450;
    items.forEach((item, index) => {
      const y = 260 + index * 90;
      ctx.fillStyle = COLORS.ink; ctx.font = '600 24px Arial, sans-serif'; ctx.textAlign = 'left';
      wrapCanvasText(ctx, item.label, labelX, y + 13, 390, 28, 2);
      roundedRect(ctx, barX, y - 18, barWidth, 28, 14, '#EEEAF1');
      if (item.value > 0) roundedRect(ctx, barX, y - 18, Math.max(12, barWidth * item.value / max), 28, 14, item.color);
      ctx.fillStyle = COLORS.violet; ctx.font = '700 24px Arial, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(item.valueLabel, valueX, y + 5);
    });
    ctx.textAlign = 'left';
    return canvas;
  }

  function drawTetrGrid(context) {
    const monthName = capitalizeFirstLetter(formatDate(context.monthDate, { month: 'long', year: 'numeric' }));
    const base = canvasBase('Griglia Tetr-Emotion', monthName, 1500, 1450);
    const { ctx, canvas } = base;
    const matrix = Array.from({ length: 20 }, () => Array(10).fill(null));
    const monthDays = Store.monthDays(Store.monthKey(context.monthDate)).filter((day) => day.tetr);
    monthDays.forEach((day) => (day.tetr.cells || []).forEach(([row, col]) => { if (matrix[row] && col >= 0 && col < 10) matrix[row][col] = day.tetr; }));
    const cell = 48; const boardX = 110; const boardY = 250;
    roundedRect(ctx, boardX - 18, boardY - 18, cell * 10 + 36, cell * 20 + 36, 28, '#F8F6FA', COLORS.line);
    matrix.forEach((row, rowIndex) => row.forEach((entry, colIndex) => {
      const x = boardX + colIndex * cell; const y = boardY + rowIndex * cell;
      ctx.fillStyle = entry?.color || '#FFFFFF'; ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      ctx.strokeStyle = entry ? 'rgba(82,63,119,.24)' : 'rgba(82,63,119,.10)'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
    }));
    ctx.fillStyle = COLORS.violet; ctx.font = '700 30px Arial, sans-serif'; ctx.fillText(`${monthDays.length} ${monthDays.length === 1 ? 'giorno rappresentato' : 'giorni rappresentati'}`, 720, 270);
    const counts = Object.fromEntries(Object.keys(EMOTIONS).map((key) => [key, 0]));
    monthDays.forEach((day) => { counts[day.tetr.emotionKey] = (counts[day.tetr.emotionKey] || 0) + 1; });
    Object.entries(EMOTIONS).forEach(([key, emotion], index) => {
      const y = 340 + index * 120;
      roundedRect(ctx, 720, y - 35, 54, 54, 12, emotion.color, 'rgba(82,63,119,.18)');
      ctx.fillStyle = COLORS.ink; ctx.font = '600 24px Arial, sans-serif'; wrapCanvasText(ctx, emotion.label, 800, y, 430, 28, 2);
      ctx.fillStyle = COLORS.violet; ctx.font = '700 27px Arial, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(String(counts[key] || 0), 1370, y);
      ctx.textAlign = 'left';
    });
    return canvas;
  }

  function renderImageCanvas(key, context) {
    if (key === 'overview') return drawOverview(context);
    if (key === 'sleep-trend') return drawLineTrend(context, 'sleep');
    if (key === 'sleep-calendar') return drawCalendar(context, 'sleep');
    if (key === 'water-trend') return drawLineTrend(context, 'water');
    if (key === 'water-calendar') return drawCalendar(context, 'water');
    if (key === 'work-calendar') return drawCalendar(context, 'work');
    if (key === 'activities') return drawHorizontalDistribution(context, 'activities');
    if (key === 'emotions') return drawHorizontalDistribution(context, 'emotions');
    if (key === 'tetr-grid') return drawTetrGrid(context);
    throw new Error('Grafico non riconosciuto.');
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Impossibile creare l’immagine PNG.')), 'image/png'));
  }

  async function buildImageFile(key, context) {
    const canvas = renderImageCanvas(key, context);
    const blob = await canvasBlob(canvas);
    return { name: `${IMAGE_META[key].file}-${context.slug}.png`, blob };
  }

  function crc32Table() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }
  const CRC_TABLE = crc32Table();
  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let index = 0; index < bytes.length; index += 1) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function dosDateTime(date = new Date()) {
    return {
      time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31),
      date: (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
    };
  }
  function concatBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  }
  function headerBytes(size, writer) {
    const bytes = new Uint8Array(size); const view = new DataView(bytes.buffer); writer(view); return bytes;
  }
  async function createZip(files) {
    const encoder = new TextEncoder();
    const localParts = []; const centralParts = [];
    let offset = 0;
    const stamp = dosDateTime();
    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = new Uint8Array(await file.blob.arrayBuffer());
      const checksum = crc32(data);
      const localHeader = headerBytes(30, (view) => {
        view.setUint32(0, 0x04034B50, true); view.setUint16(4, 20, true); view.setUint16(6, 0, true); view.setUint16(8, 0, true);
        view.setUint16(10, stamp.time, true); view.setUint16(12, stamp.date, true); view.setUint32(14, checksum, true);
        view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
      });
      localParts.push(localHeader, name, data);
      const centralHeader = headerBytes(46, (view) => {
        view.setUint32(0, 0x02014B50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0, true); view.setUint16(10, 0, true);
        view.setUint16(12, stamp.time, true); view.setUint16(14, stamp.date, true); view.setUint32(16, checksum, true);
        view.setUint32(20, data.length, true); view.setUint32(24, data.length, true); view.setUint16(28, name.length, true); view.setUint16(30, 0, true);
        view.setUint16(32, 0, true); view.setUint16(34, 0, true); view.setUint16(36, 0, true); view.setUint32(38, 0, true); view.setUint32(42, offset, true);
      });
      centralParts.push(centralHeader, name);
      offset += localHeader.length + name.length + data.length;
    }
    const central = concatBytes(centralParts);
    const end = headerBytes(22, (view) => {
      view.setUint32(0, 0x06054B50, true); view.setUint16(4, 0, true); view.setUint16(6, 0, true); view.setUint16(8, files.length, true);
      view.setUint16(10, files.length, true); view.setUint32(12, central.length, true); view.setUint32(16, offset, true); view.setUint16(20, 0, true);
    });
    return new Blob([concatBytes(localParts), central, end], { type: 'application/zip' });
  }

  async function copyForNotion() {
    const context = createContext();
    const markdown = buildMarkdown(context);
    const html = markdownToHtml(markdown);
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([markdown], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
      } else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(markdown);
      else {
        const field = document.createElement('textarea'); field.value = markdown; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); document.execCommand('copy'); field.remove();
      }
      feedback.textContent = 'Riepilogo copiato. Puoi incollarlo direttamente in una pagina Notion.';
    } catch (error) {
      feedback.textContent = 'Il browser non ha consentito la copia automatica. Scarica il file Markdown.';
    }
  }

  function openDialog() {
    const current = currentStatsRange();
    startInput.value = current.startKey;
    endInput.value = current.endKey;
    periodControl.value = 'current';
    updatePeriodCaption();
    feedback.textContent = 'Seleziona le opzioni e scegli il formato da generare.';
    if (!dialog.open) dialog.showModal();
    pageFeedback.textContent = 'Finestra di esportazione aperta.';
  }

  window.addEventListener('tracker:open-notion-export', openDialog);
  dialog.querySelector('[data-notion-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  periodControl.addEventListener('change', updatePeriodCaption);
  startInput.addEventListener('change', updatePeriodCaption);
  endInput.addEventListener('change', updatePeriodCaption);

  dialog.querySelector('[data-notion-copy]')?.addEventListener('click', copyForNotion);
  dialog.querySelector('[data-notion-markdown]')?.addEventListener('click', () => {
    try {
      const context = createContext();
      downloadBlob(new Blob([buildMarkdown(context)], { type: 'text/markdown;charset=utf-8' }), `riepilogo-notion-${context.slug}.md`);
      feedback.textContent = 'File Markdown scaricato.';
    } catch (error) { feedback.textContent = error.message; }
  });
  dialog.querySelector('[data-notion-csv]')?.addEventListener('click', () => {
    try {
      const context = createContext();
      downloadBlob(new Blob([buildCsv(context)], { type: 'text/csv;charset=utf-8' }), `database-giornaliero-${context.slug}.csv`);
      feedback.textContent = 'CSV scaricato: puoi importarlo come database in Notion.';
    } catch (error) { feedback.textContent = error.message; }
  });

  dialog.querySelectorAll('[data-notion-single-image]').forEach((button) => button.addEventListener('click', async () => {
    try {
      setBusy(true, `Preparazione di “${IMAGE_META[button.dataset.notionSingleImage].label}”…`);
      const context = createContext();
      const file = await buildImageFile(button.dataset.notionSingleImage, context);
      downloadBlob(file.blob, file.name);
      setBusy(false, `${IMAGE_META[button.dataset.notionSingleImage].label} scaricato in PNG.`);
    } catch (error) { setBusy(false, error.message); }
  }));

  dialog.querySelector('[data-notion-images-selected]')?.addEventListener('click', async () => {
    const keys = selectedImageKeys();
    if (!keys.length) { feedback.textContent = 'Seleziona almeno un grafico.'; return; }
    try {
      setBusy(true, `Preparazione di ${keys.length} immagini…`);
      const context = createContext();
      for (let index = 0; index < keys.length; index += 1) {
        const file = await buildImageFile(keys[index], context);
        downloadBlob(file.blob, file.name);
        await wait(220);
      }
      setBusy(false, `${keys.length} immagini PNG generate. Il browser potrebbe chiederti di consentire download multipli.`);
    } catch (error) { setBusy(false, error.message); }
  });

  dialog.querySelector('[data-notion-images-zip]')?.addEventListener('click', async () => {
    const keys = selectedImageKeys();
    if (!keys.length) { feedback.textContent = 'Seleziona almeno un grafico.'; return; }
    try {
      setBusy(true, `Preparazione dello ZIP con ${keys.length} immagini…`);
      const context = createContext();
      const files = [];
      for (let index = 0; index < keys.length; index += 1) {
        feedback.textContent = `Creazione immagine ${index + 1} di ${keys.length}: ${IMAGE_META[keys[index]].label}`;
        files.push(await buildImageFile(keys[index], context));
      }
      const zip = await createZip(files);
      downloadBlob(zip, `grafici-notion-${context.slug}.zip`);
      setBusy(false, `ZIP creato con ${keys.length} immagini PNG.`);
    } catch (error) { setBusy(false, error.message); }
  });
})();

/* =========================================================
   V26 — navigazione responsive mobile/tablet verticale
   ========================================================= */
function initResponsiveNavigation() {
  if (document.querySelector('.mobile-bottom-nav')) return;

  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const primary = [
    ['index.html', 'Home', '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/>'],
    ['giornata.html', 'Giornata', '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M8 11h8M8 15h5"/>'],
    ['sonno.html', 'Sonno', '<path d="M20 15.5A8 8 0 0 1 8.5 4a8.3 8.3 0 1 0 11.5 11.5Z"/>'],
    ['cibo-acqua.html', 'Cibo e acqua', '<path d="M8 3v8M5 3v5a3 3 0 0 0 6 0V3M8 11v10M16 3v18M16 3c3 2 3 7 0 9"/>']
  ];
  const secondary = [
    ['tetr-emotion.html', 'Tetr-Emotion', '▦'],
    ['statistiche.html', 'Statistiche', '▥'],
    ['archivio.html', 'Archivio', '◫'],
    ['impostazioni.html', 'Impostazioni', '⚙']
  ];
  const isSecondary = secondary.some(([href]) => href === path);

  const nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('aria-label', 'Navigazione mobile');
  nav.innerHTML = primary.map(([href, label, icon]) => `
    <a class="mobile-nav-item${path === href ? ' is-active' : ''}" href="${href}"${path === href ? ' aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${icon}</svg>
      <span>${label}</span>
    </a>`).join('') + `
    <button class="mobile-nav-item${isSecondary ? ' is-active' : ''}" type="button" data-mobile-more aria-expanded="false" aria-controls="mobile-more-sheet">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>
      <span>Altro</span>
    </button>`;

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'mobile-sheet-backdrop';
  backdrop.setAttribute('aria-label', 'Chiudi il menu');

  const sheet = document.createElement('section');
  sheet.className = 'mobile-more-sheet';
  sheet.id = 'mobile-more-sheet';
  sheet.setAttribute('aria-label', 'Altre sezioni');
  sheet.innerHTML = `
    <div class="mobile-more-title"><strong>Altre sezioni</strong><button class="mobile-sheet-close" type="button" aria-label="Chiudi">×</button></div>
    <div class="mobile-more-grid">
      ${secondary.map(([href, label, icon]) => `<a class="mobile-more-link${path === href ? ' is-active' : ''}" href="${href}"${path === href ? ' aria-current="page"' : ''}><span class="mobile-more-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('')}
    </div>`;

  document.body.append(backdrop, sheet, nav);
  const trigger = nav.querySelector('[data-mobile-more]');
  const close = () => { document.body.classList.remove('mobile-more-open'); trigger.setAttribute('aria-expanded', 'false'); };
  const open = () => { document.body.classList.add('mobile-more-open'); trigger.setAttribute('aria-expanded', 'true'); sheet.querySelector('.mobile-sheet-close')?.focus(); };
  trigger.addEventListener('click', () => document.body.classList.contains('mobile-more-open') ? close() : open());
  backdrop.addEventListener('click', close);
  sheet.querySelector('.mobile-sheet-close')?.addEventListener('click', close);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
}

document.addEventListener('DOMContentLoaded', initResponsiveNavigation);

// Ricerca cronologica degli alimenti nelle Statistiche.
(() => {
  const page = document.querySelector('.stats-page');
  const input = page?.querySelector('[data-stats-food-search]');
  const results = page?.querySelector('[data-stats-food-results]');
  if (!page || !input || !results) return;

  function library() { return Store.getState().settings.tracker?.foodLibrary || []; }
  function occurrences(foodId) {
    const found = [];
    Object.values(Store.getState().days || {}).sort((a,b) => b.date.localeCompare(a.date)).forEach((day) => {
      MEAL_ORDER.forEach((meal) => {
        if ((day.mealItems?.[meal] || []).includes(foodId)) found.push({ date: day.date, meal });
      });
    });
    return found;
  }
  function render() {
    const query = input.value.trim().toLocaleLowerCase('it');
    const matches = library().filter((item) => item.active !== false && (!query || `${item.name} ${item.category}`.toLocaleLowerCase('it').includes(query))).sort((a,b) => a.name.localeCompare(b.name,'it')).slice(0,20);
    if (!query) {
      const used = library().map((item) => ({ item, uses: occurrences(item.id) })).filter((entry) => entry.uses.length).sort((a,b) => b.uses.length-a.uses.length).slice(0,8);
      results.innerHTML = used.length ? `<div class="food-history-suggestions"><p>Alimenti più registrati</p>${used.map(({item,uses}) => `<button type="button" data-food-history-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.icon || '•')}</span><strong>${escapeHtml(item.name)}</strong><span>${uses.length} volte</span></button>`).join('')}</div>` : '<div class="food-history-empty">La cronologia comparirà dopo aver associato alimenti ai pasti.</div>';
      return;
    }
    results.innerHTML = matches.length ? matches.map((item) => {
      const uses = occurrences(item.id);
      return `<article class="food-history-result"><div class="food-history-result-head"><span>${escapeHtml(item.icon || '•')}</span><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category || 'Senza categoria')} · ${uses.length} ${uses.length === 1 ? 'volta' : 'volte'}</p></div></div><div class="food-history-dates">${uses.length ? uses.slice(0,12).map((entry) => `<div><strong>${formatDate(entry.date,{day:'numeric',month:'long',year:'numeric'})}</strong><span>${MEAL_LABELS[entry.meal]}</span></div>`).join('') : '<p>Non risulta ancora registrato in nessun pasto.</p>'}</div></article>`;
    }).join('') : '<div class="food-history-empty">Nessun alimento corrisponde alla ricerca.</div>';
  }
  results.addEventListener('click', (event) => { const button=event.target.closest('[data-food-history-id]'); if(button){ const item=library().find((entry)=>entry.id===button.dataset.foodHistoryId); if(item){ input.value=item.name; render(); } } });
  input.addEventListener('input', render);
  window.addEventListener('tracker:data-changed', render);
  render();
})();
