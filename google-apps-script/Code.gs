const TRACKER_SHEET = 'TrackerData';
const CHUNK_SIZE = 45000;

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'ping');
    if (action === 'ping') return json_({ ok: true, message: 'Tracker personale collegato', time: new Date().toISOString(), version: 2 });
    if (action === 'getState') return json_({ ok: true, state: loadState_(), summary: stateSummary_(loadState_()) });
    return json_({ ok: false, error: 'Azione GET non riconosciuta.' });
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'testWrite') {
      const props = PropertiesService.getDocumentProperties();
      const key = 'tracker_write_test';
      props.setProperty(key, new Date().toISOString());
      props.deleteProperty(key);
      return json_({ ok: true, writable: true, testedAt: new Date().toISOString() });
    }
    if (payload.action === 'saveState') {
      saveState_(payload.state || {});
      return json_({ ok: true, savedAt: new Date().toISOString(), summary: stateSummary_(payload.state || {}) });
    }
    if (payload.action === 'mergeState') {
      const result = mergeAndSaveState_(payload.state || {});
      return json_({ ok: true, savedAt: new Date().toISOString(), state: result, summary: stateSummary_(result) });
    }
    return json_({ ok: false, error: 'Azione POST non riconosciuta.' });
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function getTrackerSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(TRACKER_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(TRACKER_SHEET);
  return sheet;
}

function saveState_(state) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { saveStateUnlocked_(state); }
  finally { lock.releaseLock(); }
}

function saveStateUnlocked_(state) {
  const sheet = getTrackerSheet_();
  const json = JSON.stringify(state || {});
  const chunks = [];
  for (let index = 0; index < json.length; index += CHUNK_SIZE) chunks.push([chunks.length + 1, json.slice(index, index + CHUNK_SIZE)]);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 3).setValues([['Parte', 'Dati JSON', 'Ultimo salvataggio']]);
  if (chunks.length) {
    const savedAt = new Date();
    sheet.getRange(2, 1, chunks.length, 3).setValues(chunks.map(row => [row[0], row[1], savedAt]));
  }
  sheet.setFrozenRows(1);
  sheet.hideColumns(2);
  SpreadsheetApp.flush();
}

function loadState_() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return loadStateUnlocked_(); }
  finally { lock.releaseLock(); }
}

function loadStateUnlocked_() {
  const sheet = getTrackerSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const json = rows.filter(row => row[1] !== '').sort((a,b) => Number(a[0])-Number(b[0])).map(row => String(row[1])).join('');
  return json ? JSON.parse(json) : null;
}

function mergeAndSaveState_(incoming) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const remote = loadStateUnlocked_();
    const merged = remote ? mergeStates_(incoming || {}, remote) : incoming || {};
    merged.updatedAt = new Date().toISOString();
    saveStateUnlocked_(merged);
    return merged;
  } finally { lock.releaseLock(); }
}

function time_(value) { const result = new Date(value || 0).getTime(); return isNaN(result) ? 0 : result; }
function clone_(value) { return JSON.parse(JSON.stringify(value == null ? null : value)); }
function newer_(a, b, fallbackA, fallbackB) {
  if (!a) return clone_(b); if (!b) return clone_(a);
  const ta = time_(a.updatedAt || a.modifiedAt || a.finishedAt || a.createdAt || fallbackA);
  const tb = time_(b.updatedAt || b.modifiedAt || b.finishedAt || b.createdAt || fallbackB);
  return clone_(tb > ta ? b : a);
}
function mergeArrayById_(a, b, fallbackA, fallbackB) {
  const map = {};
  (a || []).forEach(item => { if (item && item.id) map[String(item.id)] = clone_(item); });
  (b || []).forEach(item => { if (item && item.id) map[String(item.id)] = newer_(map[String(item.id)], item, fallbackA, fallbackB); });
  return Object.keys(map).map(key => map[key]);
}

function mergeDeletionMarkers_(a, b) {
  const map = {};
  (a || []).concat(b || []).forEach(item => {
    if (!item || !item.id || !item.deletedAt) return;
    const id = String(item.id);
    if (!map[id] || time_(item.deletedAt) > time_(map[id].deletedAt)) {
      map[id] = { id: id, deletedAt: String(item.deletedAt) };
    }
  });
  return Object.keys(map).map(key => map[key]);
}
function applyDeletionMarkers_(items, markers) {
  const deleted = {};
  (markers || []).forEach(item => { if (item && item.id) deleted[String(item.id)] = time_(item.deletedAt); });
  return (items || []).filter(item => {
    const deletedAt = deleted[String(item && item.id || '')] || 0;
    if (!deletedAt) return true;
    const itemTime = time_(item.updatedAt || item.modifiedAt || item.finishedAt || item.createdAt);
    return itemTime > deletedAt;
  });
}
function mergeFood_(a, b, fallbackA, fallbackB) {
  const map = {};
  const add = (item, fallback, remote) => {
    if (!item) return;
    const key = String(item.id || '').trim() || ('name:' + String(item.name || '').trim().toLowerCase());
    if (!key || key === 'name:') return;
    map[key] = map[key] ? newer_(map[key], item, remote ? fallbackA : fallback, remote ? fallback : fallbackB) : clone_(item);
  };
  (a || []).forEach(item => add(item, fallbackA, false));
  (b || []).forEach(item => add(item, fallbackB, true));
  return Object.keys(map).map(key => map[key]);
}
function mergeStates_(local, remote) {
  local = local || {}; remote = remote || {};
  const lt = time_(local.updatedAt), rt = time_(remote.updatedAt);
  const merged = clone_(lt >= rt ? local : remote) || {};
  merged.days = {};
  const keys = {};
  Object.keys(local.days || {}).forEach(k => keys[k] = true);
  Object.keys(remote.days || {}).forEach(k => keys[k] = true);
  Object.keys(keys).forEach(k => {
    const a = (local.days || {})[k], b = (remote.days || {})[k];
    merged.days[k] = !a ? clone_(b) : !b ? clone_(a) : clone_(time_(b.updatedAt) > time_(a.updatedAt) ? b : a);
  });
  const lst = time_(local.settingsUpdatedAt || local.updatedAt), rst = time_(remote.settingsUpdatedAt || remote.updatedAt);
  merged.settings = clone_(rst > lst ? remote.settings : local.settings) || {};
  merged.settings.tracker = merged.settings.tracker || {};
  merged.settings.tracker.foodLibrary = mergeFood_(
    local.settings && local.settings.tracker && local.settings.tracker.foodLibrary,
    remote.settings && remote.settings.tracker && remote.settings.tracker.foodLibrary,
    lst, rst
  );
  merged.settingsUpdatedAt = rst > lst ? (remote.settingsUpdatedAt || remote.updatedAt || '') : (local.settingsUpdatedAt || local.updatedAt || '');
  const lrt = time_(local.readingUpdatedAt || local.updatedAt), rrt = time_(remote.readingUpdatedAt || remote.updatedAt);
  const deletedBooks = mergeDeletionMarkers_(
    local.reading && local.reading.deletedBooks,
    remote.reading && remote.reading.deletedBooks
  );
  const deletedSessions = mergeDeletionMarkers_(
    local.reading && local.reading.deletedSessions,
    remote.reading && remote.reading.deletedSessions
  );
  const mergedBooks = mergeArrayById_(local.reading && local.reading.books, remote.reading && remote.reading.books, lrt, rrt);
  const visibleBooks = applyDeletionMarkers_(mergedBooks, deletedBooks);
  const visibleBookIds = {};
  visibleBooks.forEach(book => visibleBookIds[String(book.id)] = true);
  merged.reading = {
    books: visibleBooks,
    sessions: applyDeletionMarkers_(
      mergeArrayById_(local.reading && local.reading.sessions, remote.reading && remote.reading.sessions, lrt, rrt),
      deletedSessions
    ).filter(session => visibleBookIds[String(session.bookId)]),
    deletedBooks: deletedBooks,
    deletedSessions: deletedSessions
  };
  merged.readingUpdatedAt = rrt > lrt ? (remote.readingUpdatedAt || remote.updatedAt || '') : (local.readingUpdatedAt || local.updatedAt || '');
  merged.version = Math.max(Number(local.version)||1, Number(remote.version)||1, 2);
  return merged;
}

function stateSummary_(state) {
  if (!state) return null;
  const days = state.days || {};
  return {
    days: Object.keys(days).length,
    activities: Object.keys(days).reduce((sum,key) => sum + (((days[key] || {}).activities || []).length), 0),
    foodItems: (((state.settings || {}).tracker || {}).foodLibrary || []).length,
    books: (((state.reading || {}).books) || []).length,
    readingSessions: (((state.reading || {}).sessions) || []).length,
    updatedAt: state.updatedAt || ''
  };
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
