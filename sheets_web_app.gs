const SPREADSHEET_ID = '10SQCFtT_J4jToNORlHjrNziLh3AN4v_Zdhmj4t4ZONY';
const SHEET_NAME = '注文データ';
const PHOTO_FOLDER_NAME = '大口注文_製造指示書写真';

const HEADERS = [
  'id',
  'createdAt',
  'updatedAt',
  'customerName',
  'deliveryDate',
  'deliveryTime',
  'productName',
  'quantity',
  'amount',
  'teaOption',
  'teaOptionOther',
  'materialType',
  'expirySticker',
  'expiryTime',
  'noshi',
  'rubberBand',
  'sorting',
  'chopsticksType',
  'chopsticksMethod',
  'notes',
  'insidePhoto',
  'packagePhoto',
  'deleted',
  'deletedAt',
  'source'
];

function doGet(e) {
  try {
    const action = (e.parameter.action || 'list').toLowerCase();
    if (action === 'list') {
      return output_({ ok: true, orders: listOrders_() }, e.parameter.callback);
    }
    return output_({ ok: true, message: 'ready' }, e.parameter.callback);
  } catch (error) {
    return output_({ ok: false, error: error.message }, e.parameter.callback);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = parsePayload_(e);
    const action = (payload.action || '').toLowerCase();
    if (action === 'save') {
      const order = saveOrder_(payload.order || {});
      return output_({ ok: true, order }, null);
    }
    if (action === 'delete') {
      deleteOrder_(payload.id);
      return output_({ ok: true }, null);
    }
    throw new Error('Unknown action: ' + action);
  } catch (error) {
    return output_({ ok: false, error: error.message }, null);
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  if (e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  throw new Error('payload is required');
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  const body = callback ? `${callback}(${json});` : json;
  const mimeType = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mimeType);
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getHeaderIndex_() {
  return HEADERS.reduce((map, header, index) => {
    map[header] = index;
    return map;
  }, {});
}

function listOrders_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const index = getHeaderIndex_();
  return values
    .map((row) => rowToOrder_(row, index))
    .filter((order) => order.id && !isDeleted_(order.deleted))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .map((order) => {
      delete order.deleted;
      delete order.deletedAt;
      delete order.source;
      return order;
    });
}

function rowToOrder_(row, index) {
  const order = {};
  HEADERS.forEach((header) => {
    order[header] = row[index[header]] || '';
  });
  return order;
}

function isDeleted_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function saveOrder_(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('order is required');
  }

  const now = new Date().toISOString();
  const order = normalizeOrder_(input, now);
  order.insidePhoto = storePhotoIfNeeded_(order, 'insidePhoto');
  order.packagePhoto = storePhotoIfNeeded_(order, 'packagePhoto');

  const sheet = getSheet_();
  const rowNumber = findRowById_(sheet, order.id);
  const row = HEADERS.map((header) => order[header] || '');

  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
  return order;
}

function normalizeOrder_(input, now) {
  const order = {};
  HEADERS.forEach((header) => {
    order[header] = input[header] || '';
  });
  order.id = order.id || `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  order.createdAt = order.createdAt || now;
  order.updatedAt = now;
  order.deleted = '';
  order.deletedAt = '';
  order.source = 'web';
  return order;
}

function findRowById_(sheet, id) {
  if (!id) return 0;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i][0] === id) {
      return i + 2;
    }
  }
  return 0;
}

function deleteOrder_(id) {
  if (!id) throw new Error('id is required');
  const sheet = getSheet_();
  const rowNumber = findRowById_(sheet, id);
  if (!rowNumber) return;

  const now = new Date().toISOString();
  const index = getHeaderIndex_();
  sheet.getRange(rowNumber, index.deleted + 1).setValue(true);
  sheet.getRange(rowNumber, index.deletedAt + 1).setValue(now);
  sheet.getRange(rowNumber, index.updatedAt + 1).setValue(now);
}

function storePhotoIfNeeded_(order, fieldName) {
  const value = order[fieldName] || '';
  if (!value || !String(value).startsWith('data:image/')) {
    return value;
  }

  const match = String(value).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return value;

  const mimeType = match[1];
  const extension = mimeType.includes('png') ? 'png' : 'jpg';
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, mimeType, `${order.id}_${fieldName}_${Date.now()}.${extension}`);
  const file = getPhotoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1400`;
}

function getPhotoFolder_() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}
