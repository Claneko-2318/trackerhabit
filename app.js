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

function formatDate(value, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  return capitalizeFirstLetter(new Intl.DateTimeFormat('it-IT', options).format(date));
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
  if (!bottles) return `${remainder}/4 di borraccia`;
  const word = bottles === 1 ? 'borraccia' : 'borracce';
  return remainder ? `${bottles} ${word} + ${remainder}/4` : `${bottles} ${word}`;
}

function waterLiters(quarters, bottleMl = 750) {
  const liters = ((Number(quarters) || 0) * (bottleMl / 4)) / 1000;
  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 3 }).format(liters)} l`;
}

function uid(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dayHasData(day) {
  return Boolean(day?.sleep || Object.values(day?.meals || {}).some(Boolean) || (day?.water || []).length || (day?.activities || []).length || day?.dailyNote || day?.tetr);
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
    if (timeElement) timeElement.textContent = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(now);
  }
  updateClock();
  window.setInterval(updateClock, 30000);
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
  };
  applyScene();
  window.setInterval(applyScene, 60000);
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
      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`);
      const weather = await weatherResponse.json();
      card.querySelector('.weather-location').textContent = [place.name, place.country].filter(Boolean).join(', ');
      card.querySelector('.weather-temp').textContent = `${Math.round(weather.current?.temperature_2m)}°`;
      card.querySelector('.weather-status').textContent = descriptions[weather.current?.weather_code] || 'Condizioni aggiornate';
      const bottom = card.querySelectorAll('.weather-bottom span');
      if (bottom[0]) bottom[0].textContent = `Min ${Math.round(weather.daily?.temperature_2m_min?.[0])}°`;
      if (bottom[1]) bottom[1].textContent = `Max ${Math.round(weather.daily?.temperature_2m_max?.[0])}°`;
    } catch (error) {
      card.querySelector('.weather-temp').textContent = '—°';
      card.querySelector('.weather-status').textContent = 'Meteo non disponibile';
    }
  }
  loadWeather();
  window.addEventListener('tracker:data-changed', (event) => { if (event.detail?.reason === 'settings-update') loadWeather(); });
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
      const categoryClass = categoryClassMap[activity.category] || 'category-other';
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
  page.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    page.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    applyFilter();
  }));

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
})();

// Sonno.
(() => {
  const page = document.querySelector('.sleep-page');
  if (!page) return;
  let selectedDate = dateFromQuery();
  const form = page.querySelector('[data-sleep-form]');
  const awakeningList = page.querySelector('[data-awakening-list]');
  const feedback = page.querySelector('[data-sleep-feedback]');

  function key() { return Store.dateKey(selectedDate); }
  function renderDate() {
    page.querySelector('[data-sleep-weekday]').textContent = formatDate(selectedDate, { weekday: 'long' });
    page.querySelector('[data-sleep-date]').textContent = formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' });
    const previous = new Date(selectedDate); previous.setDate(previous.getDate() - 1);
    const hint = page.querySelector('.sleep-date-copy .secondary-text');
    if (hint) hint.textContent = `Notte tra ${formatDate(previous, { weekday: 'long' }).toLowerCase()} e ${formatDate(selectedDate, { weekday: 'long' }).toLowerCase()}`;
  }

  function awakeningRow(awakening = { time: '', duration: 5 }) {
    const row = document.createElement('div');
    row.className = 'awakening-row';
    row.innerHTML = `<label><span>Orario</span><span class="sleep-time-wrap"><input type="time" name="awakeningTime[]" value="${escapeHtml(awakening.time || '')}"></span></label>
      <label><span>Durata</span><span class="sleep-duration-wrap"><input type="number" name="awakeningDuration[]" min="0" step="1" value="${Number(awakening.duration) || 0}"><em>min</em></span></label>
      <button class="awakening-remove" type="button" data-remove-awakening aria-label="Rimuovi risveglio">×</button>`;
    return row;
  }

  function awakeningsFromForm() {
    return [...awakeningList.querySelectorAll('.awakening-row')].map((row) => ({
      time: row.querySelector('input[name="awakeningTime[]"]')?.value || '',
      duration: Math.max(0, Number(row.querySelector('input[name="awakeningDuration[]"]')?.value) || 0)
    }));
  }

  function sleepCalculations() {
    const bedtime = form.elements.bedtime.value;
    const asleep = form.elements.asleep.value || bedtime;
    const wake = form.elements.wake.value;
    const up = form.elements.up.value || wake;
    const awakeningMinutes = awakeningsFromForm().reduce((sum, item) => sum + item.duration, 0);
    const baseSleep = timeDifference(asleep, wake);
    return {
      duration: baseSleep === null ? null : Math.max(0, baseSleep - awakeningMinutes),
      bedDuration: timeDifference(bedtime, up),
      riseDelay: timeDifference(wake, up),
      awakeningMinutes
    };
  }

  function updateSummary() {
    const calculations = sleepCalculations();
    page.querySelector('[data-sleep-duration]').textContent = formatMinutes(calculations.duration);
    page.querySelector('[data-bed-duration]').textContent = formatMinutes(calculations.bedDuration);
    page.querySelector('[data-rise-delay]').textContent = formatMinutes(calculations.riseDelay);
    page.querySelector('[data-awakening-count]').textContent = String(awakeningsFromForm().length);
    page.querySelector('[data-awakening-total]').textContent = formatMinutes(calculations.awakeningMinutes);
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
    const bedtimeValues = recorded.map(({ sleep }) => sleep.bedtime || sleep.asleep).filter(Boolean);
    const wakeValues = recorded.map(({ sleep }) => sleep.wake).filter(Boolean);
    const bedtimeAverage = averageClock(bedtimeValues, true);
    const wakeAverage = averageClock(wakeValues);
    const qualities = recorded.map(({ sleep }) => Number(sleep.quality)).filter((value) => Number.isFinite(value) && value > 0);
    const qualityAverage = qualities.length ? qualities.reduce((sum, value) => sum + value, 0) / qualities.length : null;
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
      if (values[2]) values[2].textContent = qualityAverage === null ? '—' : `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(qualityAverage)} / 5`;
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
        return `<article class="recent-night-row"><div class="recent-night-date"><strong>${date.getDate()}</strong><span>${formatDate(date, { month: 'long' })}</span></div><div><span class="recent-night-label">Sonno</span><strong>${formatMinutes(sleep.duration)}</strong></div><div><span class="recent-night-label">Orari</span><strong>${sleep.asleep || sleep.bedtime || '—'} — ${sleep.wake || '—'}</strong></div><div><span class="recent-night-label">Qualità</span><strong>${sleep.quality ? `${sleep.quality} / 5` : '—'}</strong></div><button type="button" data-recent-sleep-date="${day.date}" aria-label="Apri la notte del ${formatDate(date, { day: 'numeric', month: 'long' })}">→</button></article>`;
      }).join('') : '<div class="tracker-empty-state"><strong>Nessuna notte registrata</strong><span>Le ultime notti compariranno qui dopo il primo salvataggio.</span></div>';
    }
  }

  function loadDay() {
    const sleep = Store.getDay(key()).sleep;
    form.reset();
    awakeningList.innerHTML = '';
    const values = sleep || { bedtime: '', asleep: '', wake: '', up: '', quality: '', note: '', awakenings: [] };
    ['bedtime', 'asleep', 'wake', 'up'].forEach((name) => { form.elements[name].value = values[name] || ''; });
    form.querySelectorAll('input[name="quality"]').forEach((radio) => { radio.checked = String(radio.value) === String(values.quality || ''); });
    form.elements.sleepNote.value = values.note || '';
    (values.awakenings || []).forEach((item) => awakeningList.append(awakeningRow(item)));
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
    const quality = form.querySelector('input[name="quality"]:checked')?.value || '';
    Store.updateDay(key(), (day) => ({
      ...day,
      sleep: {
        bedtime: form.elements.bedtime.value,
        asleep: form.elements.asleep.value,
        wake: form.elements.wake.value,
        up: form.elements.up.value,
        quality: quality ? Number(quality) : null,
        note: form.elements.sleepNote.value.trim(),
        awakenings: awakeningsFromForm(),
        duration: calculations.duration,
        bedDuration: calculations.bedDuration,
        riseDelay: calculations.riseDelay,
        awakeningMinutes: calculations.awakeningMinutes
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
})();

// Cibo e acqua.
(() => {
  const page = document.querySelector('.food-page');
  if (!page) return;
  let selectedDate = dateFromQuery();
  const mealCards = [...page.querySelectorAll('[data-meal-card]')];
  const waterHistory = page.querySelector('[data-water-history]');
  const bottleMl = Number(Store.getState().settings.bottleMl) || 750;
  const quarterMl = bottleMl / 4;

  function key() { return Store.dateKey(selectedDate); }
  function mealKey(name) {
    return ({ Colazione: 'breakfast', Pranzo: 'lunch', Cena: 'dinner', Spuntino: 'snacks' })[name] || String(name).toLowerCase();
  }
  function formatEntry(quarters) {
    const ml = Math.round(quarters * quarterMl);
    return quarters === 4 ? `1 borraccia · ${ml} ml` : `${quarters}/4 · circa ${ml} ml`;
  }
  function renderDate() {
    page.querySelector('[data-food-weekday]').textContent = formatDate(selectedDate, { weekday: 'long' });
    page.querySelector('[data-food-date]').textContent = formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function renderMeals(day) {
    mealCards.forEach((card) => {
      const name = card.dataset.mealName;
      const value = day.meals?.[mealKey(name)] || '';
      card.querySelector('[data-meal-text]').value = value;
      card.classList.toggle('is-saved', Boolean(value));
      card.querySelector('[data-meal-status]').textContent = value ? 'Registrato' : 'Da compilare';
      card.querySelector('[data-save-meal]').textContent = value ? 'Aggiorna' : `Registra ${name.toLowerCase()}`;
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
  function updateSummary(day = Store.getDay(key())) {
    const meals = Object.entries(day.meals || {}).filter(([, value]) => String(value).trim());
    const quarters = waterQuarters(day);
    page.querySelector('[data-meal-count]').textContent = String(meals.length);
    page.querySelector('[data-last-meal]').textContent = meals.at(-1)?.[0] ? ({ breakfast: 'Colazione', lunch: 'Pranzo', dinner: 'Cena', snacks: 'Spuntino' }[meals.at(-1)[0]] || '—') : '—';
    page.querySelector('[data-water-total]').textContent = formatWater(quarters);
    page.querySelector('[data-water-short]').textContent = quarters ? (quarters % 4 ? `${Math.floor(quarters / 4)} + ${quarters % 4}/4` : String(quarters / 4)) : '0';
    page.querySelector('[data-water-liters]').textContent = `circa ${waterLiters(quarters, bottleMl)}`;
    page.querySelector('[data-water-ml-short]').textContent = `circa ${waterLiters(quarters, bottleMl)}`;
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

    const mealTotal = records.reduce((total, { day }) => total + MEAL_ORDER.filter((meal) => String(day.meals?.[meal] || '').trim()).length, 0);
    const mealHeading = page.querySelector('.meal-week-card .week-card-heading > span');
    if (mealHeading) mealHeading.textContent = `${mealTotal} ${mealTotal === 1 ? 'registrazione' : 'registrazioni'}`;

    const mealTable = page.querySelector('.meal-week-table');
    if (mealTable) {
      const rows = records.map(({ date, key: dateKeyValue, day }) => {
        const dayLabel = capitalizeFirstLetter(new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(date).replace('.', ''));
        const cells = MEAL_ORDER.map((meal) => String(day.meals?.[meal] || '').trim() ? '✓' : '—');
        return `<div class="meal-week-row${dateKeyValue === key() ? ' active' : ''}" role="row"><strong>${dayLabel}</strong>${cells.map((cell) => `<i>${cell}</i>`).join('')}</div>`;
      }).join('');
      mealTable.innerHTML = `<div class="meal-week-row meal-week-head" role="row"><span>Giorno</span><span>Col.</span><span>Pranzo</span><span>Cena</span><span>Snack</span></div>${rows}`;
      mealTable.setAttribute('aria-label', `Pasti registrati nei sette giorni fino al ${formatDate(selectedDate, { day: 'numeric', month: 'long' })}`);
    }
  }

  function loadDay() {
    const day = Store.getDay(key());
    renderDate(); renderMeals(day); renderWater(day); renderWeeklyStats();
    page.querySelector('[data-meal-feedback]').textContent = dayHasData(day) ? 'Dati caricati e pronti per essere aggiornati.' : 'Nessun pasto registrato per questa giornata.';
    page.querySelector('[data-water-feedback]').textContent = `Ogni quarto corrisponde a ${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(quarterMl)} ml.`;
  }

  mealCards.forEach((card) => card.querySelector('[data-save-meal]')?.addEventListener('click', () => {
    const name = card.dataset.mealName;
    const value = card.querySelector('[data-meal-text]').value.trim();
    Store.updateDay(key(), (day) => ({ ...day, meals: { ...day.meals, [mealKey(name)]: value } }), 'meal-save');
    renderMeals(Store.getDay(key())); updateSummary(); renderWeeklyStats();
    page.querySelector('[data-meal-feedback]').textContent = value ? `${name} salvato.` : `${name} rimosso.`;
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
  page.querySelectorAll('[data-food-date-shift]').forEach((button) => button.addEventListener('click', () => { selectedDate.setDate(selectedDate.getDate() + Number(button.dataset.foodDateShift)); loadDay(); }));
  page.querySelector('[data-food-today]')?.addEventListener('click', () => { selectedDate = new Date(); loadDay(); });
  loadDay();
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
    currentPieceCopy.textContent = 'Clicca una colonna per scegliere la posizione. Doppio clic per ruotare e premi Invio per confermare.';
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
          cell.dataset.tooltip = `${dateLabel}|${locked.label}|Tetramino ${locked.piece}${locked.note ? `|${locked.note}` : ''}`;
        } else if (current && currentCells.has(key)) {
          cell.classList.add('is-current'); cell.style.setProperty('--cell-color', EMOTIONS[current.emotionKey].color);
        } else if (current && ghostCells.has(key)) {
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
  placeButton.addEventListener('click', openConfirmation);
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
    highlightWholePiece(cell.dataset.pieceId);
    const parts = cell.dataset.tooltip.split('|');
    tooltip.innerHTML = `<strong>${parts[0]}</strong><span>${parts[1]} · ${parts[2]}</span>${parts[3] ? `<span class="tetr-tooltip-note">${escapeHtml(parts[3])}</span>` : ''}`;
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
    if (event.target.matches('input, textarea, select, button') || !current || !confirmOverlay.hidden) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter'].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowLeft') moveCurrent(-1);
    if (event.key === 'ArrowRight') moveCurrent(1);
    if (event.key === 'ArrowUp') rotateCurrent();
    if (event.key === 'Enter') openConfirmation();
  });
  initializeDay();
  window.addEventListener('tracker:data-changed', (event) => {
    if (['remote-pull', 'import', 'reset'].includes(event.detail?.reason)) initializeDay();
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
    if (!waterQuarters(day) && !Object.values(day.meals || {}).some(Boolean)) missing.push('cibo e acqua');
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

    setCard(sleepCard, day.sleep ? formatMinutes(day.sleep.duration) : '—', day.sleep ? `Qualità ${day.sleep.quality || '—'}/5` : 'Nessuna notte registrata', Boolean(day.sleep));
    const mealCount = Object.values(day.meals || {}).filter((value) => String(value).trim()).length;
    const quarters = waterQuarters(day);
    setCard(foodCard, `${mealCount} pasti · ${waterLiters(quarters, state.settings.bottleMl)}`, quarters || mealCount ? 'Dati aggiornati oggi' : 'Nessun dato registrato', Boolean(quarters || mealCount));
    const totalActivity = (day.activities || []).reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    setCard(dayCard, `${(day.activities || []).length} attività`, totalActivity ? `${formatMinutes(totalActivity)} di tempo registrato` : 'Nessuna durata registrata', Boolean((day.activities || []).length));
    const emotion = day.tetr ? EMOTIONS[day.tetr.emotionKey] : null;
    setCard(tetrCard, emotion?.label || '—', emotion ? `Tetramino ${emotion.piece} · emozione di oggi` : 'Emozione non registrata', Boolean(emotion));
    if (tetrCard) {
      const icon = tetrCard.querySelector('.summary-tetr-icon');
      if (icon) icon.innerHTML = emotion ? tetrominoMarkup(day.tetr, 11) : '<span class="empty-tetr-piece">—</span>';
    }

    const quick = [...page.querySelectorAll('.complete-panel-items .quick-status')];
    const statuses = [
      { done: Boolean(day.sleep), title: day.sleep ? 'Sonno registrato' : 'Registra il sonno', detail: day.sleep ? formatMinutes(day.sleep.duration) : 'Ultima notte mancante' },
      { done: Boolean(quarters), title: quarters ? 'Acqua aggiornata' : 'Aggiorna l’acqua', detail: quarters ? formatWater(quarters) : 'Nessuna bevuta registrata' },
      { done: Boolean(day.tetr), title: day.tetr ? 'Tetr-Emotion registrata' : 'Aggiungi Tetr-Emotion', detail: emotion ? `${emotion.label} · tetramino ${emotion.piece}` : 'Manca il pezzo di oggi' }
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
          <div class="recent-chips"><span>${recentDay.sleep ? formatMinutes(recentDay.sleep.duration) : 'Sonno —'}</span><span>${waterLiters(waterQuarters(recentDay), state.settings.bottleMl)}</span><span>${meals} ${meals === 1 ? 'pasto' : 'pasti'}</span><span>${recentDay.activities.length} attività</span><span class="recent-emotion-chip${emotionData ? '' : ' is-missing'}">${emotionData ? `${tetrominoMarkup(recentDay.tetr, 7)}${emotionData.label}` : 'Tetr-Emotion non inserita'}</span></div>
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
    return (day.activities || []).filter((item) => item.category === 'Lavoro').reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
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
    const qualityValues = days.map((day) => Number(day.sleep?.quality)).filter((value) => value > 0);
    const bedValues = days.map((day) => day.sleep?.bedtime).filter(Boolean);
    const wakeValues = days.map((day) => day.sleep?.wake).filter(Boolean);
    const riseValues = days.map((day) => Number(day.sleep?.riseDelay)).filter((value) => Number.isFinite(value));
    return {
      sleep: average(sleepValues), sleepCount: sleepValues.length,
      water: average(waterValues), waterTotal: waterValues.reduce((a, b) => a + b, 0), waterMax: Math.max(0, ...waterValues), waterCount: waterValues.length,
      workTotal: workValues.reduce((a, b) => a + b, 0), workAverage: average(workValues),
      activityTotal: activityValues.reduce((a, b) => a + b, 0), totalActivities, completedDays, categories, topCategory, recurring, fullest,
      mostEmotion, emotionCounts,
      quality: average(qualityValues), qualityCount: qualityValues.length,
      bedtime: averageClock(bedValues, true), bedtimeCount: bedValues.length,
      wake: averageClock(wakeValues), wakeCount: wakeValues.length,
      riseDelay: average(riseValues), riseCount: riseValues.length
    };
  }

  function renderHeatmap(container, monthDate, type) {
    container.innerHTML = '';
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const mondayOffset = (first.getDay() + 6) % 7;
    for (let i = 0; i < mondayOffset; i += 1) {
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
    page.querySelector('[data-detail-water-average]').textContent = current.water ? formatWater(Math.round(current.water * 4) / 4) : '—';
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
      <div class="stats-comparison-row" role="row"><strong>Acqua media</strong><span>${current.water ? formatWater(Math.round(current.water * 4) / 4) : '—'}</span><span>${previous.water ? formatWater(Math.round(previous.water * 4) / 4) : '—'}</span><em>${differenceNumber(current.water, previous.water, ' quarti')}</em></div>
      <div class="stats-comparison-row" role="row"><strong>Tempo nelle attività</strong><span>${current.activityTotal ? formatMinutes(current.activityTotal) : '—'}</span><span>${previous.activityTotal ? formatMinutes(previous.activityTotal) : '—'}</span><em>${differenceMinutes(current.activityTotal, previous.activityTotal)}</em></div>
      <div class="stats-comparison-row" role="row"><strong>Ore lavorate</strong><span>${current.workTotal ? formatMinutes(current.workTotal) : '—'}</span><span>${previous.workTotal ? formatMinutes(previous.workTotal) : '—'}</span><em>${differenceMinutes(current.workTotal, previous.workTotal)}</em></div>
      <div class="stats-comparison-row" role="row"><strong>Emozione più frequente</strong><span>${emotionCurrent}</span><span>${emotionPrevious}</span><em>—</em></div>
      <div class="stats-comparison-row" role="row"><strong>Giornate produttive</strong><span>${productiveCurrent}</span><span>${productivePrevious}</span><em>${differenceNumber(productiveCurrent, productivePrevious)}</em></div>`;
  }

  function render() {
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
    page.querySelector('[data-stat-water]').textContent = current.water ? formatWater(Math.round(current.water * 4) / 4) : '—';
    page.querySelector('[data-stat-water-note]').textContent = current.water ? `circa ${waterLiters(current.water, Store.getState().settings.bottleMl)} al giorno` : 'Nessun dato nel periodo';
    page.querySelector('[data-stat-work]').textContent = current.workTotal ? formatMinutes(current.workTotal) : '—';
    page.querySelector('[data-stat-work-note]').textContent = current.workAverage ? `media di ${formatMinutes(current.workAverage)} nei giorni lavorati` : 'Nessuna attività Lavoro';
    const emotion = current.mostEmotion[0] ? EMOTIONS[current.mostEmotion[0]] : null;
    page.querySelector('[data-stat-emotion]').textContent = emotion?.label || '—';
    page.querySelector('[data-stat-emotion-note]').textContent = emotion ? `${current.mostEmotion[1]} giorni nel periodo` : 'Nessuna emozione registrata';
    const emotionIcon = page.querySelector('.summary-emotion .stats-summary-icon');
    if (emotionIcon) emotionIcon.innerHTML = emotion ? tetrominoMarkup({ emotionKey: current.mostEmotion[0], piece: emotion.piece, color: emotion.color }, 9) : '<span class="empty-tetr-piece">—</span>';
    page.querySelector('[data-stat-insight-sleep]').textContent = current.sleep ? `Hai dormito in media ${formatMinutes(current.sleep)} nel periodo selezionato.` : 'Non ci sono ancora notti sufficienti per calcolare la media.';
    page.querySelector('[data-stat-insight-water]').textContent = current.water ? `La media giornaliera è stata di ${formatWater(Math.round(current.water * 4) / 4)}, circa ${waterLiters(current.water, Store.getState().settings.bottleMl)}.` : 'Non ci sono ancora registrazioni d’acqua nel periodo.';
    page.querySelector('[data-stat-insight-emotion]').textContent = emotion ? `${emotion.label} è stata l’emozione più frequente, registrata in ${current.mostEmotion[1]} giornate.` : 'Tetr-Emotion non contiene ancora dati nel periodo.';

    const monthDate = periodSelect.value === 'previous' ? new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) : new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    const heatmaps = [...page.querySelectorAll('[data-heatmap]')];
    if (heatmaps[0]) renderHeatmap(heatmaps[0], monthDate, 'sleep');
    if (heatmaps[1]) renderHeatmap(heatmaps[1], monthDate, 'water');
    if (heatmaps[2]) renderHeatmap(heatmaps[2], monthDate, 'work');
    heatmaps.forEach((map) => {
      map.closest('.stats-habit-card')?.querySelector('.stats-habit-top > strong')?.replaceChildren(document.createTextNode(
        map === heatmaps[0] ? `Media ${current.sleep ? formatMinutes(current.sleep) : '—'}` : map === heatmaps[1] ? `Media ${current.water ? formatWater(Math.round(current.water * 4) / 4) : '—'}` : `Media ${current.workAverage ? formatMinutes(current.workAverage) : '—'}`
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
    page.querySelector('[data-detail-quality-average]').textContent = current.qualityCount ? `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(current.quality)} / 5` : '—';
    page.querySelector('[data-detail-quality-note]').textContent = current.qualityCount ? `${current.qualityCount} notti con valutazione` : 'Nessuna valutazione';
    renderSleepChart(range);
    renderWaterBars(range, current);
    renderActivityDetails(current);
    renderComparison(range, current, previous, previousStart, previousEnd);
  }

  periodSelect.addEventListener('change', render);
  page.querySelector('[data-stats-compare]')?.addEventListener('click', () => { comparison.hidden = !comparison.hidden; });
  page.querySelector('[data-stats-export]')?.addEventListener('click', () => { page.querySelector('[data-stats-export-feedback]').textContent = 'L’esportazione per Notion è in sospeso e verrà aggiunta in seguito.'; });
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

  function workMinutes(day) { return (day.activities || []).filter((item) => item.category === 'Lavoro').reduce((sum, item) => sum + (Number(item.duration) || 0), 0); }
  function matches(day) {
    const query = search.value.trim().toLowerCase();
    const hasFilter = activeFilter === 'all' || (activeFilter === 'sleep' && day.sleep) || (activeFilter === 'food' && (Object.values(day.meals || {}).some(Boolean) || day.water.length)) || (activeFilter === 'day' && (day.activities.length || day.dailyNote)) || (activeFilter === 'tetr' && day.tetr);
    if (!hasFilter) return false;
    if (!query) return true;
    const text = [day.date, day.dailyNote, day.sleep?.note, ...Object.values(day.meals || {}), ...day.activities.flatMap((item) => [item.title, item.note, item.category]), day.tetr?.note, day.tetr ? EMOTIONS[day.tetr.emotionKey]?.label : ''].join(' ').toLowerCase();
    return text.includes(query);
  }
  function renderMonthLabel() { page.querySelector('[data-archive-month-label]').textContent = formatDate(selectedMonth, { month: 'long', year: 'numeric' }); }
  function renderCalendar() {
    calendar.innerHTML = '';
    ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach((label) => { const head = document.createElement('span'); head.className = 'archive-weekday'; head.textContent = label; calendar.append(head); });
    const first = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
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
      if (day.activities.length && (activeFilter === 'all' || activeFilter === 'day')) metrics.push(`<span class="archive-day-metric metric-day"><i>▣</i><span>${day.activities.length} attività</span></span>`);
      if (day.tetr && (activeFilter === 'all' || activeFilter === 'tetr')) metrics.push(`<span class="archive-day-metric metric-tetr ${activeFilter === 'all' ? 'is-compact' : ''}" title="${EMOTIONS[day.tetr.emotionKey].label}">${tetrominoMarkup(day.tetr, 6)}${activeFilter === 'tetr' ? `<span>${EMOTIONS[day.tetr.emotionKey].label}</span>` : ''}</span>`);
      button.innerHTML = `<span class="archive-day-number">${number}</span><span class="archive-day-metrics">${metrics.join('')}</span>`;
      calendar.append(button);
    }
    page.querySelector('[data-archive-result-caption]').textContent = `${results} ${results === 1 ? 'giornata trovata' : 'giornate trovate'} nel mese`;
  }
  function renderList() {
    const days = Store.monthDays(Store.monthKey(selectedMonth)).filter((day) => dayHasData(day) && matches(day));
    list.innerHTML = days.length ? days.map((day) => `<button type="button" class="archive-list-row" data-date="${day.date}"><span><strong>${formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong><span>${day.dailyNote || 'Nessuna nota generale'}</span></span><span class="archive-list-metrics"><span>☾ ${day.sleep ? formatMinutes(day.sleep.duration) : '—'}</span><span>◔ ${formatWater(waterQuarters(day))}</span><span>▣ ${day.activities.length}</span><span class="archive-list-emotion">${day.tetr ? `${tetrominoMarkup(day.tetr, 5)} ${EMOTIONS[day.tetr.emotionKey].label}` : '—'}</span></span></button>`).join('') : '<div class="tracker-empty-state"><strong>Nessun risultato</strong><span>Prova a cambiare mese, filtro o ricerca.</span></div>';
  }
  function renderDetail() {
    const day = Store.getDay(selectedDate);
    page.querySelector('[data-archive-detail-date]').textContent = formatDate(selectedDate);
    page.querySelector('[data-archive-detail-intro]').textContent = dayHasData(day) ? 'Riepilogo dei dati salvati per questa giornata.' : 'Questa giornata non contiene ancora dati.';
    page.querySelector('[data-detail-sleep-duration]').textContent = day.sleep ? formatMinutes(day.sleep.duration) : '—';
    page.querySelector('[data-detail-sleep-quality]').textContent = day.sleep?.quality ? `${day.sleep.quality} / 5` : '—';
    page.querySelector('[data-detail-sleep-awakenings]').textContent = String(day.sleep?.awakenings?.length || 0);
    page.querySelector('[data-detail-bedtime]').textContent = day.sleep?.bedtime || '—';
    page.querySelector('[data-detail-wakeup]').textContent = day.sleep?.wake || '—';
    page.querySelector('[data-detail-rise]').textContent = day.sleep?.up || '—';
    page.querySelector('[data-detail-water]').textContent = formatWater(waterQuarters(day));
    page.querySelector('[data-detail-water-ml]').textContent = waterLiters(waterQuarters(day), Store.getState().settings.bottleMl);
    const mealList = page.querySelector('[data-detail-meals]');
    const savedMeals = MEAL_ORDER
      .map((mealKey) => ({ key: mealKey, label: MEAL_LABELS[mealKey], text: String(day.meals?.[mealKey] || '').trim() }))
      .filter((meal) => meal.text);
    mealList.innerHTML = savedMeals.length
      ? savedMeals.map((meal) => `<div class="archive-meal"><strong>${meal.label}</strong><p>${escapeHtml(meal.text)}</p></div>`).join('')
      : '<div class="archive-meal"><strong>Nessun pasto registrato</strong><p>Per questa giornata non hai ancora annotato cosa hai mangiato.</p></div>';
    page.querySelector('[data-detail-activity-count]').textContent = String(day.activities.length);
    page.querySelector('[data-detail-work]').textContent = formatMinutes(workMinutes(day));
    const activities = page.querySelector('[data-detail-activities]'); activities.innerHTML = day.activities.length ? day.activities.map((item) => `<li><span>${escapeHtml(item.title)}</span><strong>${item.duration ? formatMinutes(item.duration) : item.category}</strong></li>`).join('') : '<li><span>Nessuna attività</span><strong>—</strong></li>';
    page.querySelector('[data-detail-note]').textContent = day.dailyNote || 'Nessuna nota salvata.';
    const emotion = day.tetr ? EMOTIONS[day.tetr.emotionKey] : null;
    page.querySelector('[data-detail-tetr-emotion]').textContent = emotion?.label || '—';
    page.querySelector('[data-detail-tetr-meta]').textContent = emotion ? `Tetramino ${emotion.piece} · ${emotion.colorName}` : 'Nessun pezzo registrato';
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

// Impostazioni, esportazione JSON e collegamento a Google Sheets.
(() => {
  const page = document.querySelector('.settings-page');
  if (!page) return;
  const tabs = [...page.querySelectorAll('[data-settings-tab]')];
  const panels = [...page.querySelectorAll('[data-settings-panel]')];
  const saveFeedback = page.querySelector('[data-settings-feedback]');
  const dataFeedback = page.querySelector('[data-data-feedback]');
  const connectionUrl = page.querySelector('[data-connection-url]');
  const connectionStatus = page.querySelector('[data-connection-status]');

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((item) => { const active = item === tab; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); });
    panels.forEach((panel) => { const active = panel.dataset.settingsPanel === tab.dataset.settingsTab; panel.hidden = !active; panel.classList.toggle('active', active); });
  }));

  const sceneMeta = { morning: ['Mattina', '05:00 — 11:59'], afternoon: ['Pomeriggio', '12:00 — 17:59'], evening: ['Sera', '18:00 — 21:59'], night: ['Notte', '22:00 — 04:59'] };
  const scenePreview = page.querySelector('[data-scene-preview]');
  const autoScenes = page.querySelector('[data-auto-scenes]');
  let chosenScene = Store.getState().settings.appearance.scene || 'afternoon';
  function currentScene() { const h = new Date().getHours(); return h >= 5 && h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'; }
  function renderScene(scene) {
    chosenScene = scene;
    scenePreview.classList.remove('scene-morning','scene-afternoon','scene-evening','scene-night'); scenePreview.classList.add(`scene-${scene}`);
    page.querySelector('[data-scene-period]').textContent = sceneMeta[scene][0]; page.querySelector('[data-scene-time-range]').textContent = sceneMeta[scene][1];
    page.querySelectorAll('[data-scene-choice]').forEach((button) => button.classList.toggle('active', button.dataset.sceneChoice === scene));
  }
  page.querySelectorAll('[data-scene-choice]').forEach((button) => button.addEventListener('click', () => { autoScenes.checked = false; renderScene(button.dataset.sceneChoice); }));
  autoScenes.addEventListener('change', () => { if (autoScenes.checked) renderScene(currentScene()); });

  const gradient = page.querySelector('[data-gradient-range]');
  function renderGradient() {
    page.querySelector('[data-gradient-value]').textContent = `${gradient.value}%`;
    page.querySelector('[data-gradient-sample]').style.backgroundImage = `linear-gradient(0deg, rgba(38,25,56,${Number(gradient.value) / 100}), rgba(38,25,56,.03)), url("assets/hero-room.png")`;
  }
  gradient.addEventListener('input', renderGradient);
  page.querySelectorAll('[data-single-choice]').forEach((group) => group.querySelectorAll('.settings-choice').forEach((choice) => choice.addEventListener('click', () => { group.querySelectorAll('.settings-choice').forEach((item) => item.classList.remove('active')); choice.classList.add('active'); })));
  page.querySelectorAll('[data-segmented]').forEach((group) => group.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { group.querySelectorAll('button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); })));

  function loadSettings() {
    const settings = Store.getState().settings;
    page.querySelector('[data-setting-city]').value = settings.city || 'Roma, Italia';
    const bottleInput = page.querySelector('[data-setting-bottle]');
    if (bottleInput) bottleInput.value = settings.bottleMl || 750;
    page.querySelectorAll('[data-setting-home]').forEach((input) => { input.checked = settings.home[input.dataset.settingHome] !== false; });
    autoScenes.checked = settings.appearance.autoScenes !== false;
    gradient.value = settings.appearance.gradient || 62;
    renderScene(autoScenes.checked ? currentScene() : (settings.appearance.scene || 'afternoon'));
    renderGradient();
    if (connectionUrl) connectionUrl.value = Store.getScriptUrl();
    updateConnectionStatus(Store.getScriptUrl() ? 'Configurato. Premi “Verifica collegamento”.' : 'Non configurato', Store.getScriptUrl() ? 'wait' : 'off');
  }
  function updateConnectionStatus(message, type) {
    if (!connectionStatus) return;
    connectionStatus.textContent = message;
    connectionStatus.className = `settings-connection-status is-${type}`;
  }

  page.querySelector('[data-save-settings]').addEventListener('click', () => {
    Store.saveSettings({
      city: page.querySelector('[data-setting-city]').value.trim() || 'Roma, Italia',
      bottleMl: Math.max(100, Number(page.querySelector('[data-setting-bottle]')?.value) || 750),
      home: Object.fromEntries([...page.querySelectorAll('[data-setting-home]')].map((input) => [input.dataset.settingHome, input.checked])),
      appearance: { autoScenes: autoScenes.checked, scene: chosenScene, gradient: Number(gradient.value) }
    });
    saveFeedback.textContent = 'Impostazioni salvate.';
    setTimeout(() => { saveFeedback.textContent = ''; }, 3000);
  });

  page.querySelector('[data-connect-sheet]')?.addEventListener('click', async () => {
    const url = connectionUrl.value.trim();
    if (!url) { updateConnectionStatus('Incolla prima l’URL della Web App.', 'error'); return; }
    updateConnectionStatus('Verifica in corso…', 'wait');
    try {
      await Store.ping(url); Store.setScriptUrl(url); updateConnectionStatus('Collegamento riuscito. I salvataggi verranno sincronizzati.', 'ok');
    } catch (error) { updateConnectionStatus(`Collegamento non riuscito: ${error.message}`, 'error'); }
  });
  page.querySelector('[data-pull-sheet]')?.addEventListener('click', async () => {
    updateConnectionStatus('Caricamento dal foglio…', 'wait');
    try { await Store.pullRemote({ merge: true }); updateConnectionStatus('Dati del foglio caricati e uniti a quelli locali.', 'ok'); }
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
    else if (action === 'reset') { if (confirm('Ripristinare le impostazioni predefinite? I dati giornalieri resteranno invariati.')) { Store.saveSettings({ city: 'Roma, Italia', bottleMl: 750 }); loadSettings(); dataFeedback.textContent = 'Impostazioni principali ripristinate.'; } }
    else if (action === 'delete') { if (confirm('Eliminare tutti i dati del tracker? Questa azione non può essere annullata.') && confirm('Confermi definitivamente l’eliminazione di tutti i dati?')) { Store.resetAll(); loadSettings(); dataFeedback.textContent = 'Tutti i dati sono stati eliminati.'; } }
  }));
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0]; if (!file) return;
    try { Store.importJson(await file.text()); dataFeedback.textContent = 'Backup importato correttamente.'; loadSettings(); }
    catch (error) { dataFeedback.textContent = `File non valido: ${error.message}`; }
    importInput.value = '';
  });
  page.querySelector('[data-demo-upload]')?.addEventListener('click', () => { page.querySelector('[data-image-feedback]').textContent = 'Il caricamento di immagini personalizzate verrà aggiunto in una fase successiva.'; });
  page.querySelector('[data-demo-reset]')?.addEventListener('click', () => { autoScenes.checked = true; renderScene(currentScene()); page.querySelector('[data-image-feedback]').textContent = 'Scene automatiche ripristinate.'; });
  loadSettings();
})();

// Se è già configurato un foglio, prova a unire i dati remoti senza bloccare l'apertura del sito.
if (Store?.getScriptUrl()) {
  Store.pullRemote({ merge: true }).catch((error) => console.warn('Sincronizzazione iniziale non riuscita. I dati locali restano disponibili.', error));
}
