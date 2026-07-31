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
      mealItems: {},
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
      readingUpdatedAt: '',
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
          food: { breakfast: true, lunch: true, dinner: true, snacks: true },
          foodLibrary: []
        }
      },
      reading: { books: [], sessions: [] },
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
          foodLibrary: Array.isArray(input.settings?.tracker?.foodLibrary) ? input.settings.tracker.foodLibrary.map((item, index) => ({
            id: item?.id || `food-${index + 1}`,
            name: String(item?.name || '').trim(),
            icon: String(item?.icon || ''),
            category: String(item?.category || ''),
            favorite: item?.favorite === true,
            active: item?.active !== false,
            createdAt: item?.createdAt || ''
          })).filter((item) => item.name) : [],
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
      reading: {
        books: Array.isArray(input.reading?.books) ? input.reading.books.map((book, index) => ({
          id: book?.id || `book-${index + 1}`,
          title: String(book?.title || '').trim(),
          author: String(book?.author || '').trim(),
          totalPages: Math.max(0, Number(book?.totalPages) || 0),
          startPage: Math.max(0, Number(book?.startPage) || 0),
          startedAt: String(book?.startedAt || ''),
          finishedAt: String(book?.finishedAt || ''),
          status: book?.status === 'finished' ? 'finished' : 'reading',
          icon: String(book?.icon || '📖'),
          createdAt: String(book?.createdAt || '')
        })).filter((book) => book.title) : [],
        sessions: Array.isArray(input.reading?.sessions) ? input.reading.sessions.map((session, index) => ({
          id: session?.id || `reading-session-${index + 1}`,
          bookId: String(session?.bookId || ''),
          date: String(session?.date || ''),
          page: Math.max(0, Number(session?.page) || 0),
          minutes: Math.max(0, Number(session?.minutes) || 0),
          note: String(session?.note || ''),
          createdAt: String(session?.createdAt || '')
        })).filter((session) => session.bookId && session.date) : []
      },
      days: {}
    };

    Object.entries(input.days || {}).forEach(([key, day]) => {
      result.days[key] = {
        ...emptyDay(key),
        ...(day || {}),
        meals: { ...((day || {}).meals || {}) },
        mealItems: Object.fromEntries(Object.entries((day || {}).mealItems || {}).map(([meal, ids]) => [meal, Array.isArray(ids) ? ids : []])),
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
      ? { method: 'GET', cache: 'no-store', redirect: 'follow' }
      : { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
    if (!response.ok) throw new Error(`Errore HTTP ${response.status}`);
    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error('La Web App non ha restituito JSON. Controlla URL e distribuzione Apps Script.'); }
    if (!data?.ok) throw new Error(data?.error || 'Risposta non valida dalla Web App.');
    return data;
  }

  function stateSummary(value = state) {
    const normalized = normalizeState(value);
    return {
      days: Object.keys(normalized.days || {}).length,
      activities: Object.values(normalized.days || {}).reduce((sum, day) => sum + (day.activities?.length || 0), 0),
      foodItems: normalized.settings?.tracker?.foodLibrary?.length || 0,
      books: normalized.reading?.books?.length || 0,
      readingSessions: normalized.reading?.sessions?.length || 0,
      updatedAt: normalized.updatedAt || ''
    };
  }

  function newerItem(first, second, fallbackFirst = 0, fallbackSecond = 0) {
    if (!first) return clone(second);
    if (!second) return clone(first);
    const firstTime = new Date(first.updatedAt || first.modifiedAt || first.finishedAt || first.createdAt || fallbackFirst || 0).getTime();
    const secondTime = new Date(second.updatedAt || second.modifiedAt || second.finishedAt || second.createdAt || fallbackSecond || 0).getTime();
    return clone(secondTime > firstTime ? second : first);
  }

  function mergeById(localItems, remoteItems, localFallback, remoteFallback) {
    const map = new Map();
    (localItems || []).forEach((item) => map.set(String(item.id || ''), clone(item)));
    (remoteItems || []).forEach((item) => {
      const id = String(item.id || '');
      if (!id) return;
      map.set(id, newerItem(map.get(id), item, localFallback, remoteFallback));
    });
    return [...map.values()];
  }

  function mergeFoodLibraries(localItems, remoteItems, localFallback, remoteFallback) {
    const byKey = new Map();
    const add = (item, fallback, preferRemote = false) => {
      const key = String(item?.id || '').trim() || `name:${String(item?.name || '').trim().toLocaleLowerCase('it')}`;
      if (!key || key === 'name:') return;
      const current = byKey.get(key);
      byKey.set(key, current ? newerItem(current, item, preferRemote ? localFallback : fallback, preferRemote ? fallback : remoteFallback) : clone(item));
    };
    (localItems || []).forEach((item) => add(item, localFallback));
    (remoteItems || []).forEach((item) => add(item, remoteFallback, true));
    return [...byKey.values()];
  }

  function mergeStates(localState, remoteState) {
    const local = normalizeState(localState);
    const remote = normalizeState(remoteState);
    const localTime = new Date(local.updatedAt || 0).getTime();
    const remoteTime = new Date(remote.updatedAt || 0).getTime();
    const merged = normalizeState(localTime >= remoteTime ? local : remote);

    const allDayKeys = new Set([...Object.keys(local.days || {}), ...Object.keys(remote.days || {})]);
    merged.days = {};
    allDayKeys.forEach((key) => {
      const localDay = local.days[key];
      const remoteDay = remote.days[key];
      const localDayTime = new Date(localDay?.updatedAt || 0).getTime();
      const remoteDayTime = new Date(remoteDay?.updatedAt || 0).getTime();
      merged.days[key] = clone(!localDay ? remoteDay : !remoteDay ? localDay : remoteDayTime > localDayTime ? remoteDay : localDay);
    });

    const localSettingsTime = new Date(local.settingsUpdatedAt || local.updatedAt || 0).getTime();
    const remoteSettingsTime = new Date(remote.settingsUpdatedAt || remote.updatedAt || 0).getTime();
    const chosenSettings = remoteSettingsTime > localSettingsTime ? remote.settings : local.settings;
    merged.settings = clone(chosenSettings);
    merged.settings.tracker = merged.settings.tracker || {};
    merged.settings.tracker.foodLibrary = mergeFoodLibraries(
      local.settings?.tracker?.foodLibrary,
      remote.settings?.tracker?.foodLibrary,
      localSettingsTime,
      remoteSettingsTime
    );
    merged.settingsUpdatedAt = remoteSettingsTime > localSettingsTime
      ? (remote.settingsUpdatedAt || remote.updatedAt || '')
      : (local.settingsUpdatedAt || local.updatedAt || '');

    const localReadingTime = new Date(local.readingUpdatedAt || local.updatedAt || 0).getTime();
    const remoteReadingTime = new Date(remote.readingUpdatedAt || remote.updatedAt || 0).getTime();
    merged.reading = {
      books: mergeById(local.reading?.books, remote.reading?.books, localReadingTime, remoteReadingTime),
      sessions: mergeById(local.reading?.sessions, remote.reading?.sessions, localReadingTime, remoteReadingTime)
    };
    merged.readingUpdatedAt = remoteReadingTime > localReadingTime
      ? (remote.readingUpdatedAt || remote.updatedAt || '')
      : (local.readingUpdatedAt || local.updatedAt || '');
    merged.version = Math.max(Number(local.version) || 1, Number(remote.version) || 1, 2);
    merged.updatedAt = new Date(Math.max(localTime, remoteTime, Date.now())).toISOString();
    return normalizeState(merged);
  }

  function scheduleRemoteSave() {
    if (!getScriptUrl() || syncInProgress) return;
    window.clearTimeout(remoteTimer);
    remoteTimer = window.setTimeout(() => {
      syncRemote().catch((error) => {
        console.warn('Sincronizzazione remota non riuscita; i dati locali restano al sicuro.', error);
        emit({ reason: 'sync-error', error: error.message });
      });
    }, REMOTE_DELAY);
  }

  async function ping(url = getScriptUrl()) {
    return api({ action: 'ping' }, { url });
  }

  async function verifyConnection(url = getScriptUrl()) {
    const pingResult = await api({ action: 'ping' }, { url });
    const writeResult = await api({ action: 'testWrite' }, { url });
    const readResult = await api({ action: 'getState' }, { url });
    return {
      ping: pingResult,
      write: writeResult,
      remoteEmpty: !readResult.state,
      remoteSummary: readResult.state ? stateSummary(readResult.state) : null
    };
  }

  async function pullRemote({ merge = false } = {}) {
    if (!getScriptUrl()) throw new Error('URL non configurato.');
    syncInProgress = true;
    try {
      const data = await api({ action: 'getState' });
      if (!data.state) return { empty: true, state: clone(state), summary: null };
      state = merge ? mergeStates(state, data.state) : normalizeState(data.state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      emit({ reason: 'remote-pull', state: clone(state) });
      return { empty: false, state: clone(state), summary: stateSummary(state) };
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
      return { ...result, summary: stateSummary(state) };
    } finally {
      syncInProgress = false;
    }
  }

  async function syncRemote() {
    if (!getScriptUrl()) throw new Error('URL non configurato.');
    syncInProgress = true;
    try {
      const result = await api({ action: 'mergeState', state });
      if (!result.state) throw new Error('La Web App non ha restituito lo stato sincronizzato.');
      state = normalizeState(result.state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      emit({ reason: 'remote-sync', state: clone(state), savedAt: result.savedAt || '' });
      return { ...result, state: clone(state), summary: stateSummary(state) };
    } finally {
      syncInProgress = false;
    }
  }

  function getState() {
    return clone(state);
  }

  function replaceState(nextState, reason = 'replace') {
    state = normalizeState(nextState);
    if (reason === 'reading-update') state.readingUpdatedAt = new Date().toISOString();
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
        foodLibrary: Array.isArray(nextSettings?.tracker?.foodLibrary)
          ? clone(nextSettings.tracker.foodLibrary)
          : state.settings.tracker.foodLibrary,
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
    verifyConnection,
    stateSummary,
    mergeStates,
    pullRemote,
    pushRemote,
    syncRemote
  };
})();
