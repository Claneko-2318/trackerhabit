(() => {
  'use strict';

  const STORAGE_KEY = 'tracker_personale_data_v1';
  const SCRIPT_URL_KEY = 'tracker_personale_script_url';
  const REMOTE_DELAY = 900;
  let remoteTimer = null;
  let syncInProgress = false;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  function dateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  function monthKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function emptyDay(key) {
    return {
      date: key,
      updatedAt: '',
      sleep: null,
      meals: {},
      water: [],
      beverages: [],
      activities: [],
      dailyNote: '',
      tetr: null
    };
  }

  function defaultCategories() {
    return [
      { id: 'work', name: 'Lavoro', color: 'violet', icon: '◷', visible: true },
      { id: 'creative', name: 'Creatività', color: 'rose', icon: '✦', visible: true },
      { id: 'home', name: 'Casa', color: 'violet', icon: '⌂', visible: true },
      { id: 'errands', name: 'Commissioni', color: 'sky', icon: '⌖', visible: true },
      { id: 'leisure', name: 'Svago', color: 'lilac', icon: '☾', visible: true },
      { id: 'personal', name: 'Cura personale', color: 'periwinkle', icon: '♡', visible: true },
      { id: 'other', name: 'Altro', color: 'neutral', icon: '•', visible: true }
    ];
  }

  function defaultState() {
    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      settingsUpdatedAt: '',
      settings: {
        city: 'Roma, Italia',
        weatherUnit: 'celsius',
        weatherRefresh: '60',
        clockFormat: '24',
        weekStart: 'monday',
        dateFormat: 'long-weekday',
        bottleMl: 750,
        glassMl: 220,
        waterDivision: 'quarters',
        showWaterEquivalence: true,
        home: {
          weather: true,
          summary: true,
          reminders: true,
          sections: true,
          trends: true,
          recentDays: true,
          tetrToday: true,
          tetrWeek: true,
          tetrReminder: true
        },
        appearance: {
          autoScenes: true,
          scene: 'afternoon',
          gradient: 62,
          textMode: 'normal',
          decorations: 'full',
          tetrGridBackground: 'rose',
          tetrGridLines: 1,
          tetrBorders: true,
          tetrHover: true
        },
        tracker: {
          sleep: { awakenings: true, energy: true, riseDelay: true },
          tetr: { ghost: true, keyboard: true, confirm: true, note: true, highlightToday: true },
          categories: defaultCategories(),
          showWorkInStats: true,
          food: { breakfast: true, lunch: true, dinner: true, snacks: true }
        }
      },
      days: {}
    };
  }

  function normalizeState(input) {
    const base = defaultState();
    if (!input || typeof input !== 'object') return base;
    const result = {
      ...base,
      ...input,
      settings: {
        ...base.settings,
        ...(input.settings || {}),
        home: { ...base.settings.home, ...(input.settings?.home || {}) },
        appearance: { ...base.settings.appearance, ...(input.settings?.appearance || {}) },
        tracker: {
          ...base.settings.tracker,
          ...(input.settings?.tracker || {}),
          sleep: {
            ...base.settings.tracker.sleep,
            ...(input.settings?.tracker?.sleep || {}),
            energy: input.settings?.tracker?.sleep?.energy ?? input.settings?.tracker?.sleep?.quality ?? base.settings.tracker.sleep.energy
          },
          tetr: { ...base.settings.tracker.tetr, ...(input.settings?.tracker?.tetr || {}) },
          food: { ...base.settings.tracker.food, ...(input.settings?.tracker?.food || {}) },
          categories: Array.isArray(input.settings?.tracker?.categories)
            ? input.settings.tracker.categories.map((item, index) => ({
                id: item?.id || `category-${index + 1}`,
                name: String(item?.name || `Categoria ${index + 1}`),
                color: item?.color || 'neutral',
                icon: item?.icon || '•',
                visible: item?.visible !== false
              }))
            : base.settings.tracker.categories
        }
      },
      days: {}
    };

    Object.entries(input.days || {}).forEach(([key, day]) => {
      result.days[key] = {
        ...emptyDay(key),
        ...(day || {}),
        meals: { ...((day || {}).meals || {}) },
        water: Array.isArray(day?.water) ? day.water : [],
        beverages: Array.isArray(day?.beverages) ? day.beverages : [],
        activities: Array.isArray(day?.activities) ? day.activities : []
      };
    });
    return result;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : defaultState();
    } catch (error) {
      console.warn('Impossibile leggere i dati locali del tracker.', error);
      return defaultState();
    }
  }

  let state = loadLocal();

  function emit(detail = {}) {
    window.dispatchEvent(new CustomEvent('tracker:data-changed', { detail }));
  }

  function writeLocal(reason = 'update') {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emit({ reason, state: clone(state) });
    scheduleRemoteSave();
  }

  function getScriptUrl() {
    return localStorage.getItem(SCRIPT_URL_KEY) || '';
  }

  function setScriptUrl(url) {
    const value = String(url || '').trim();
    if (value) localStorage.setItem(SCRIPT_URL_KEY, value);
    else localStorage.removeItem(SCRIPT_URL_KEY);
    emit({ reason: 'connection', connected: Boolean(value) });
    return value;
  }

  async function api(payload, options = {}) {
    const url = options.url || getScriptUrl();
    if (!url) throw new Error('URL della Web App non configurato.');
    const isGet = payload.action === 'getState' || payload.action === 'ping';
    const requestUrl = isGet
      ? `${url}${url.includes('?') ? '&' : '?'}action=${encodeURIComponent(payload.action)}&_=${Date.now()}`
      : url;
    const response = await fetch(requestUrl, isGet
      ? { method: 'GET', cache: 'no-store' }
      : { method: 'POST', body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.ok) throw new Error(data?.error || 'Risposta non valida dalla Web App.');
    return data;
  }

  function scheduleRemoteSave() {
    if (!getScriptUrl() || syncInProgress) return;
    window.clearTimeout(remoteTimer);
    remoteTimer = window.setTimeout(() => {
      pushRemote().catch((error) => {
        console.warn('Salvataggio remoto non riuscito; i dati locali restano al sicuro.', error);
        emit({ reason: 'sync-error', error: error.message });
      });
    }, REMOTE_DELAY);
  }

  async function ping(url = getScriptUrl()) {
    const data = await api({ action: 'ping' }, { url });
    return data;
  }

  function mergeStates(localState, remoteState) {
    const local = normalizeState(localState);
    const remote = normalizeState(remoteState);
    const merged = normalizeState(local);

    Object.entries(remote.days).forEach(([key, remoteDay]) => {
      const localDay = merged.days[key];
      const remoteTime = new Date(remoteDay.updatedAt || 0).getTime();
      const localTime = new Date(localDay?.updatedAt || 0).getTime();
      if (!localDay || remoteTime >= localTime) merged.days[key] = clone(remoteDay);
    });

    const remoteSettingsTime = new Date(remote.settingsUpdatedAt || remote.updatedAt || 0).getTime();
    const localSettingsTime = new Date(local.settingsUpdatedAt || 0).getTime();
    if (remoteSettingsTime > localSettingsTime) {
      merged.settings = clone(remote.settings);
      merged.settingsUpdatedAt = remote.settingsUpdatedAt || remote.updatedAt || '';
    }
    merged.updatedAt = new Date(Math.max(remoteSettingsTime, localSettingsTime, Date.now())).toISOString();
    return merged;
  }

  async function pullRemote({ merge = true } = {}) {
    if (!getScriptUrl()) throw new Error('URL non configurato.');
    syncInProgress = true;
    try {
      const data = await api({ action: 'getState' });
      if (data.state) state = merge ? mergeStates(state, data.state) : normalizeState(data.state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      emit({ reason: 'remote-pull', state: clone(state) });
      return clone(state);
    } finally {
      syncInProgress = false;
    }
  }

  async function pushRemote() {
    if (!getScriptUrl()) throw new Error('URL non configurato.');
    syncInProgress = true;
    try {
      const result = await api({ action: 'saveState', state });
      emit({ reason: 'remote-push', savedAt: result.savedAt || new Date().toISOString() });
      return result;
    } finally {
      syncInProgress = false;
    }
  }

  function getState() {
    return clone(state);
  }

  function replaceState(nextState, reason = 'replace') {
    state = normalizeState(nextState);
    writeLocal(reason);
  }

  function getDay(key, create = false) {
    const normalizedKey = typeof key === 'string' ? key : dateKey(key);
    if (!state.days[normalizedKey] && create) state.days[normalizedKey] = emptyDay(normalizedKey);
    return state.days[normalizedKey] ? clone(state.days[normalizedKey]) : emptyDay(normalizedKey);
  }

  function saveDay(key, nextDay, reason = 'day-update') {
    const normalizedKey = typeof key === 'string' ? key : dateKey(key);
    state.days[normalizedKey] = {
      ...emptyDay(normalizedKey),
      ...(nextDay || {}),
      date: normalizedKey,
      updatedAt: new Date().toISOString(),
      meals: { ...((nextDay || {}).meals || {}) },
      water: Array.isArray(nextDay?.water) ? nextDay.water : [],
      beverages: Array.isArray(nextDay?.beverages) ? nextDay.beverages : [],
      activities: Array.isArray(nextDay?.activities) ? nextDay.activities : []
    };
    writeLocal(reason);
    return getDay(normalizedKey);
  }

  function updateDay(key, updater, reason = 'day-update') {
    const current = getDay(key, true);
    const updated = typeof updater === 'function' ? updater(current) : { ...current, ...(updater || {}) };
    return saveDay(key, updated, reason);
  }

  function deleteDay(key) {
    const normalizedKey = typeof key === 'string' ? key : dateKey(key);
    delete state.days[normalizedKey];
    writeLocal('day-delete');
  }

  function daysInRange(startKey, endKey) {
    return Object.values(state.days)
      .filter((day) => day.date >= startKey && day.date <= endKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(clone);
  }

  function monthDays(key) {
    const prefix = typeof key === 'string' ? key : monthKey(key);
    return Object.values(state.days)
      .filter((day) => day.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(clone);
  }

  function saveSettings(nextSettings) {
    state.settings = {
      ...state.settings,
      ...(nextSettings || {}),
      home: { ...state.settings.home, ...(nextSettings?.home || {}) },
      appearance: { ...state.settings.appearance, ...(nextSettings?.appearance || {}) },
      tracker: {
        ...state.settings.tracker,
        ...(nextSettings?.tracker || {}),
        sleep: {
          ...state.settings.tracker.sleep,
          ...(nextSettings?.tracker?.sleep || {}),
          energy: nextSettings?.tracker?.sleep?.energy ?? nextSettings?.tracker?.sleep?.quality ?? state.settings.tracker.sleep.energy
        },
        tetr: { ...state.settings.tracker.tetr, ...(nextSettings?.tracker?.tetr || {}) },
        food: { ...state.settings.tracker.food, ...(nextSettings?.tracker?.food || {}) },
        categories: Array.isArray(nextSettings?.tracker?.categories)
          ? clone(nextSettings.tracker.categories)
          : state.settings.tracker.categories
      }
    };
    state.settingsUpdatedAt = new Date().toISOString();
    writeLocal('settings-update');
    return clone(state.settings);
  }

  function exportJson() {
    return JSON.stringify(state, null, 2);
  }

  function importJson(text) {
    const parsed = JSON.parse(text);
    replaceState(parsed, 'import');
    return getState();
  }

  function resetAll() {
    state = defaultState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    emit({ reason: 'reset', state: clone(state) });
    scheduleRemoteSave();
  }

  window.TrackerStore = {
    STORAGE_KEY,
    dateKey,
    monthKey,
    getState,
    replaceState,
    getDay,
    saveDay,
    updateDay,
    deleteDay,
    daysInRange,
    monthDays,
    saveSettings,
    exportJson,
    importJson,
    resetAll,
    getScriptUrl,
    setScriptUrl,
    ping,
    pullRemote,
    pushRemote
  };
})();
