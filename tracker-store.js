(() => {
  'use strict';

  const STORAGE_KEY = 'tracker_personale_data_v1';
  const SCRIPT_URL_KEY = 'tracker_personale_script_url';
  const REMOTE_DELAY = 900;
  const REMOTE_REFRESH_INTERVAL = 30000;
  const REQUEST_TIMEOUT = 25000;
  let remoteTimer = null;
  let syncInProgress = false;
  let remoteReady = false;
  let remoteBootstrapPromise = null;
  let pendingRemoteSave = false;
  let lastRemoteRefresh = 0;

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
      sectionUpdatedAt: {},
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
      reading: { books: [], sessions: [], deletedBooks: [], deletedSessions: [] },
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
             createdAt: item?.createdAt || '',
             updatedAt: item?.updatedAt || item?.createdAt || ''
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
          createdAt: String(book?.createdAt || ''),
          updatedAt: String(book?.updatedAt || book?.createdAt || '')
        })).filter((book) => book.title) : [],
        sessions: Array.isArray(input.reading?.sessions) ? input.reading.sessions.map((session, index) => ({
          id: session?.id || `reading-session-${index + 1}`,
          bookId: String(session?.bookId || ''),
          date: String(session?.date || ''),
          page: Math.max(0, Number(session?.page) || 0),
          minutes: Math.max(0, Number(session?.minutes) || 0),
          note: String(session?.note || ''),
          createdAt: String(session?.createdAt || ''),
          updatedAt: String(session?.updatedAt || session?.createdAt || '')
        })).filter((session) => session.bookId && session.date) : [],
        deletedBooks: Array.isArray(input.reading?.deletedBooks)
          ? input.reading.deletedBooks.map((item) => ({
              id: String(item?.id || ''),
              deletedAt: String(item?.deletedAt || '')
            })).filter((item) => item.id && item.deletedAt)
          : [],
        deletedSessions: Array.isArray(input.reading?.deletedSessions)
          ? input.reading.deletedSessions.map((item) => ({
              id: String(item?.id || ''),
              deletedAt: String(item?.deletedAt || '')
            })).filter((item) => item.id && item.deletedAt)
          : []
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
    remoteReady = !value;
    remoteBootstrapPromise = null;
    emit({ reason: 'connection', connected: Boolean(value) });
    if (value) bootstrapRemoteSync({ force: true }).catch((error) => {
      console.warn('Prima sincronizzazione non riuscita.', error);
      emit({ reason: 'sync-error', error: error.message });
    });
    return value;
  }

  async function api(payload, options = {}) {
    const url = options.url || getScriptUrl();
    if (!url) throw new Error('URL della Web App non configurato.');
    const isGet = payload.action === 'getState' || payload.action === 'ping';
    const requestUrl = isGet
      ? `${url}${url.includes('?') ? '&' : '?'}action=${encodeURIComponent(payload.action)}&_=${Date.now()}`
      : url;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT) : null;
    let response;
    try {
      response = await fetch(requestUrl, isGet
        ? { method: 'GET', cache: 'no-store', redirect: 'follow', signal: controller?.signal }
        : {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            cache: 'no-store',
            redirect: 'follow',
            signal: controller?.signal
          });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('La sincronizzazione ha superato 25 secondi. Controlla la rete e riprova.');
      throw new Error(`Connessione alla Web App non riuscita: ${error?.message || 'errore di rete'}`);
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
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

  function mergeDeletionMarkers(localItems, remoteItems) {
    const map = new Map();
    [...(localItems || []), ...(remoteItems || [])].forEach((item) => {
      const id = String(item?.id || '');
      const deletedAt = String(item?.deletedAt || '');
      if (!id || !deletedAt) return;
      const current = map.get(id);
      if (!current || new Date(deletedAt).getTime() > new Date(current.deletedAt || 0).getTime()) {
        map.set(id, { id, deletedAt });
      }
    });
    return [...map.values()];
  }

  function applyDeletionMarkers(items, markers) {
    const deleted = new Map((markers || []).map((item) => [String(item.id), new Date(item.deletedAt || 0).getTime()]));
    return (items || []).filter((item) => {
      const deletedAt = deleted.get(String(item.id || '')) || 0;
      if (!deletedAt) return true;
      // Una vecchia copia può annullare un'eliminazione solo se l'elemento è stato
      // modificato esplicitamente DOPO la cancellazione. Le date globali dello stato
      // non devono mai far "resuscitare" un elemento privo di timestamp proprio.
      const itemTime = new Date(item.updatedAt || item.modifiedAt || item.finishedAt || item.createdAt || 0).getTime();
      return Number.isFinite(itemTime) && itemTime > deletedAt;
    });
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

  const DAY_SECTIONS = ['sleep', 'meals', 'mealItems', 'water', 'beverages', 'activities', 'dailyNote', 'tetr'];

  function mergeLegacyArray(first, second) {
    const map = new Map();
    [...(first || []), ...(second || [])].forEach((item, index) => {
      const key = String(item?.id || '') || `legacy:${JSON.stringify(item)}:${index}`;
      map.set(key, map.has(key) ? newerItem(map.get(key), item) : clone(item));
    });
    return [...map.values()];
  }

  function hasContent(value) {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }

  function mergeLegacySection(name, localValue, remoteValue, localDayTime, remoteDayTime) {
    if (['water', 'beverages', 'activities'].includes(name)) return mergeLegacyArray(localValue, remoteValue);
    if (name === 'meals' || name === 'mealItems') {
      const merged = { ...(remoteValue || {}), ...(localValue || {}) };
      new Set([...Object.keys(localValue || {}), ...Object.keys(remoteValue || {})]).forEach((key) => {
        const a = localValue?.[key];
        const b = remoteValue?.[key];
        if (!hasContent(a) && hasContent(b)) merged[key] = clone(b);
        else if (hasContent(a) && hasContent(b) && remoteDayTime > localDayTime) merged[key] = clone(b);
      });
      return merged;
    }
    if (!hasContent(localValue) && hasContent(remoteValue)) return clone(remoteValue);
    if (hasContent(localValue) && !hasContent(remoteValue)) return clone(localValue);
    return clone(remoteDayTime > localDayTime ? remoteValue : localValue);
  }

  function mergeDay(localDay, remoteDay, key) {
    if (!localDay) return clone(remoteDay);
    if (!remoteDay) return clone(localDay);
    const localDayTime = new Date(localDay.updatedAt || 0).getTime() || 0;
    const remoteDayTime = new Date(remoteDay.updatedAt || 0).getTime() || 0;
    const result = { ...emptyDay(key), date: key, sectionUpdatedAt: {} };
    DAY_SECTIONS.forEach((name) => {
      const localStamp = localDay.sectionUpdatedAt?.[name] || '';
      const remoteStamp = remoteDay.sectionUpdatedAt?.[name] || '';
      const localTime = new Date(localStamp || 0).getTime() || 0;
      const remoteTime = new Date(remoteStamp || 0).getTime() || 0;
      if (localTime || remoteTime) {
        result[name] = clone(remoteTime > localTime ? remoteDay[name] : localDay[name]);
        result.sectionUpdatedAt[name] = remoteTime > localTime ? remoteStamp : localStamp;
      } else {
        result[name] = mergeLegacySection(name, localDay[name], remoteDay[name], localDayTime, remoteDayTime);
      }
    });
    result.updatedAt = new Date(Math.max(localDayTime, remoteDayTime)).toISOString();
    return result;
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
      merged.days[key] = mergeDay(local.days[key], remote.days[key], key);
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
    const deletedBooks = mergeDeletionMarkers(local.reading?.deletedBooks, remote.reading?.deletedBooks);
    const deletedSessions = mergeDeletionMarkers(local.reading?.deletedSessions, remote.reading?.deletedSessions);
    const mergedBooks = mergeById(local.reading?.books, remote.reading?.books, localReadingTime, remoteReadingTime);
    const mergedSessions = mergeById(local.reading?.sessions, remote.reading?.sessions, localReadingTime, remoteReadingTime);
    const visibleBooks = applyDeletionMarkers(mergedBooks, deletedBooks);
    const visibleBookIds = new Set(visibleBooks.map((book) => String(book.id)));
    merged.reading = {
      books: visibleBooks,
      sessions: applyDeletionMarkers(mergedSessions, deletedSessions)
        .filter((session) => visibleBookIds.has(String(session.bookId))),
      deletedBooks,
      deletedSessions
    };
    merged.readingUpdatedAt = remoteReadingTime > localReadingTime
      ? (remote.readingUpdatedAt || remote.updatedAt || '')
      : (local.readingUpdatedAt || local.updatedAt || '');
    merged.version = Math.max(Number(local.version) || 1, Number(remote.version) || 1, 2);
    merged.updatedAt = new Date(Math.max(localTime, remoteTime, Date.now())).toISOString();
    return normalizeState(merged);
  }

  function scheduleRemoteSave() {
    if (!getScriptUrl()) return;
    if (!remoteReady || syncInProgress) {
      pendingRemoteSave = true;
      return;
    }
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
      if (pendingRemoteSave) {
        pendingRemoteSave = false;
        scheduleRemoteSave();
      }
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
    if (syncInProgress) return remoteBootstrapPromise || { state: clone(state), summary: stateSummary(state) };
    syncInProgress = true;
    try {
      // Invia una fotografia stabile. Durante l'attesa l'utente puo continuare
      // a salvare: quelle modifiche restano nello stato locale corrente.
      const stateSent = clone(state);
      const result = await api({ action: 'mergeState', state: stateSent });
      if (!result.state) throw new Error('La Web App non ha restituito lo stato sincronizzato.');
      // Non sostituire mai i salvataggi eseguiti mentre la richiesta era in
      // corso. Uniscili alla risposta e il salvataggio pendente li inviera al
      // foglio nel giro successivo.
      state = mergeStates(state, result.state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      lastRemoteRefresh = Date.now();
      emit({ reason: 'remote-sync', state: clone(state), savedAt: result.savedAt || '' });
      return { ...result, state: clone(state), summary: stateSummary(state) };
    } finally {
      syncInProgress = false;
      if (pendingRemoteSave) {
        pendingRemoteSave = false;
        scheduleRemoteSave();
      }
    }
  }

  async function bootstrapRemoteSync({ force = false } = {}) {
    if (!getScriptUrl()) {
      remoteReady = true;
      return { skipped: true };
    }
    if (!force && remoteBootstrapPromise) return remoteBootstrapPromise;
    remoteBootstrapPromise = (async () => {
      try {
        const result = await syncRemote();
        remoteReady = true;
        if (pendingRemoteSave) {
          pendingRemoteSave = false;
          scheduleRemoteSave();
        }
        return result;
      } catch (error) {
        remoteReady = true;
        throw error;
      } finally {
        remoteBootstrapPromise = null;
      }
    })();
    return remoteBootstrapPromise;
  }

  function refreshRemoteWhenReturning() {
    if (!getScriptUrl() || document.visibilityState === 'hidden') return;
    if (Date.now() - lastRemoteRefresh < 4000) return;
    bootstrapRemoteSync({ force: true }).catch((error) => {
      console.warn('Aggiornamento remoto non riuscito.', error);
      emit({ reason: 'sync-error', error: error.message });
    });
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
    const now = new Date().toISOString();
    const sectionByReason = {
      'sleep-save': 'sleep', 'sleep-delete': 'sleep',
      'activity-save': 'activities', 'activity-add': 'activities', 'activity-edit': 'activities', 'activity-delete': 'activities',
      'daily-note': 'dailyNote', 'meal-save': 'meals', 'meal-food-update': 'mealItems',
      'water-add': 'water', 'water-delete': 'water', 'water-undo': 'water',
      'beverage-add': 'beverages', 'beverage-delete': 'beverages',
      'tetr-save': 'tetr', 'tetr-note': 'tetr', 'tetr-remove': 'tetr'
    };
    const sectionUpdatedAt = { ...(nextDay?.sectionUpdatedAt || {}) };
    const changedSection = sectionByReason[reason];
    if (changedSection) sectionUpdatedAt[changedSection] = now;
    else DAY_SECTIONS.forEach((section) => { sectionUpdatedAt[section] = now; });
    state.days[normalizedKey] = {
      ...emptyDay(normalizedKey),
      ...(nextDay || {}),
      date: normalizedKey,
      updatedAt: now,
      sectionUpdatedAt,
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
    syncRemote,
    bootstrapRemoteSync
  };

  // All'apertura della pagina recupera e unisce i dati remoti prima che
  // eventuali modifiche locali vengano inviate. Ripete il controllo quando
  // l'app torna in primo piano su telefono, tablet o PC.
  remoteReady = !getScriptUrl();
  window.setTimeout(() => bootstrapRemoteSync().catch((error) => {
    console.warn('Sincronizzazione iniziale non riuscita.', error);
    emit({ reason: 'sync-error', error: error.message });
  }), 0);
  document.addEventListener('visibilitychange', refreshRemoteWhenReturning);
  window.addEventListener('focus', refreshRemoteWhenReturning);
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine) refreshRemoteWhenReturning();
  }, REMOTE_REFRESH_INTERVAL);
})();
