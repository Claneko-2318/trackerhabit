const TRACKER_SHEET = 'TrackerData';
const CHUNK_SIZE = 45000;

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'ping');
    if (action === 'ping') {
      return json_({ ok: true, message: 'Tracker personale collegato', time: new Date().toISOString() });
    }
    if (action === 'getState') {
      return json_({ ok: true, state: loadState_() });
    }
    return json_({ ok: false, error: 'Azione GET non riconosciuta.' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'saveState') {
      saveState_(payload.state || {});
      return json_({ ok: true, savedAt: new Date().toISOString() });
    }
    return json_({ ok: false, error: 'Azione POST non riconosciuta.' });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  }
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
  try {
    const sheet = getTrackerSheet_();
    const json = JSON.stringify(state || {});
    const chunks = [];
    for (let index = 0; index < json.length; index += CHUNK_SIZE) {
      chunks.push([chunks.length + 1, json.slice(index, index + CHUNK_SIZE)]);
    }

    sheet.clearContents();
    sheet.getRange(1, 1, 1, 3).setValues([['Parte', 'Dati JSON', 'Ultimo salvataggio']]);
    if (chunks.length) {
      const savedAt = new Date();
      const rows = chunks.map(([part, data]) => [part, data, savedAt]);
      sheet.getRange(2, 1, rows.length, 3).setValues(rows);
    }
    sheet.setFrozenRows(1);
    sheet.hideColumns(2);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function loadState_() {
  const sheet = getTrackerSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const json = rows
    .filter(row => row[1] !== '')
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(row => String(row[1]))
    .join('');
  return json ? JSON.parse(json) : null;
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
