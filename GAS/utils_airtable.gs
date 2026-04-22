/************************************************************
 * AIRTABLE UTILITIES — API v0
 ************************************************************/

var AIRTABLE_MAX_PAGE_SIZE = 100;

function airtableBaseUrl_(tableName) {
  return 'https://api.airtable.com/v0/' +
    CONFIG.AIRTABLE_BASE_ID + '/' +
    encodeURIComponent(tableName);
}

function airtableHeaders_() {
  loadConfigSecrets_();
  if (!CONFIG.AIRTABLE_API_KEY) {
    throw new Error('Missing AIRTABLE_API_KEY in Script Properties');
  }
  return {
    'Authorization': 'Bearer ' + CONFIG.AIRTABLE_API_KEY,
    'Content-Type': 'application/json'
  };
}

/**
 * Generic GET to Airtable (returns parsed JSON).
 */
function airtableGet_(tableName, params) {
  params = params || {};
  params.pageSize = Math.min(params.pageSize || AIRTABLE_MAX_PAGE_SIZE, AIRTABLE_MAX_PAGE_SIZE);
  var url = airtableBaseUrl_(tableName);
  if (params) {
    var qs = [];
    for (var k in params) {
      if (!params.hasOwnProperty(k) || params[k] == null) continue;
      qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
    if (qs.length) url += '?' + qs.join('&');
  }
  return httpGetJson(url, airtableHeaders_());
}

/**
 * Create a single record.
 * fields: object of fieldName -> value
 */
function airtableCreate_(tableName, fields) {
  var url = airtableBaseUrl_(tableName);
  var body = { records: [{ fields: fields }], typecast: true };
  return httpPostJson(url, airtableHeaders_(), body);
}

/**
 * Update a single record by id.
 */
function airtableUpdate_(tableName, recordId, fields) {
  var url = airtableBaseUrl_(tableName);
  var body = {
    records: [
      { id: recordId, fields: fields }
    ],
    typecast: true
  };
  return httpPatchJson(url, airtableHeaders_(), body);
}

/**
 * Batch create up to 10 records at a time.
 * fieldsArray: [{...fields}, ...]
 */
function airtableBatchCreate_(tableName, fieldsArray) {
  if (!fieldsArray || !fieldsArray.length) return;
  var url = airtableBaseUrl_(tableName);
  var chunks = chunkArray_(fieldsArray, 10);
  for (var i = 0; i < chunks.length; i++) {
    var records = chunks[i].map(function (f) { return { fields: f }; });
    var body = { records: records, typecast: true };
    httpPostJson(url, airtableHeaders_(), body);
  }
}

/**
 * Batch delete records by id.
 */
function airtableBatchDelete_(tableName, ids) {
  if (!ids || !ids.length) return;
  var chunks = chunkArray_(ids, 10);
  for (var i = 0; i < chunks.length; i++) {
    var url = airtableBaseUrl_(tableName);
    var qs = [];
    for (var j = 0; j < chunks[i].length; j++) {
      qs.push('records[]=' + encodeURIComponent(chunks[i][j]));
    }
    url += '?' + qs.join('&');
    httpDelete(url, airtableHeaders_());
  }
}

/**
 * Delete a single record by id.
 * (Wrapper فوق الـ batch delete عشان نستخدمه بسهولة في أي مكان)
 */
function airtableDelete_(tableName, recordId) {
  if (!tableName || !recordId) return;
  airtableBatchDelete_(tableName, [recordId]);
}

/**
 * Find one record matching a field value (exact match).
 * Returns the first matching record or null.
 */
function airtableFindOneByField_(tableName, fieldName, value) {
  var formula = '({' + fieldName + '} = "' + AirtableUtils.escapeFormulaValue(String(value)) + '")';
  var resp = airtableGet_(tableName, { maxRecords: 1, filterByFormula: formula });
  var recs = resp.records || [];
  return recs.length ? recs[0] : null;
}

/**
 * Upsert record in a table by matching a field (e.g., TripID).
 * - If record exists → update.
 * - Else → create.
 * Returns the record id.
 */
function airtableUpsertByField_(tableName, matchField, matchValue, fields) {
  var existing = airtableFindOneByField_(tableName, matchField, matchValue);
  if (existing) {
    airtableUpdate_(tableName, existing.id, fields);
    return existing.id;
  } else {
    var res = airtableCreate_(tableName, fields);
    var recs = res.records || [];
    return recs.length ? recs[0].id : null;
  }
}

/**
 * Simple helper: split array into chunks.
 */
function chunkArray_(arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

var AirtableUtils = (function() {
  function escapeFormulaValue(s) {
    return String(s || '').replace(/"/g, '\\"');
  }

  function getTripRecordIdByTripID(tripID) {
    if (!tripID) return null;
    var existing = airtableFindOneByField_('Trips', 'TripID', tripID);
    return existing ? existing.id : null;
  }

  return {
    escapeFormulaValue: escapeFormulaValue,
    getTripRecordIdByTripID: getTripRecordIdByTripID
  };
})();

/************************************************************
 * DUAL IDENTIFIER SYSTEM HELPERS (TripID + Record ID)
 ************************************************************/

/**
 * Get Trip Record ID by TripID field value.
 * @param {string} tripID - The TripID field value (e.g., "7495")
 * @return {string|null} - The Airtable Record ID or null if not found
 */
/**
 * Upsert a Trip using TripID as the stable identifier.
 * If a trip with this TripID exists, update it (keeping same Record ID).
 * Otherwise, create a new trip.
 * @param {string} tripID - The TripID field value
 * @param {Object} fields - The fields to create/update
 * @return {string} - The Record ID of the trip
 */
function upsertTripByTripID_(tripID, fields) {
  if (!tripID) throw new Error('TripID is required for upsert');
  
  // Ensure TripID is in the fields
  fields.TripID = tripID;
  
  var existing = airtableFindOneByField_('Trips', 'TripID', tripID);
  
  if (existing) {
    // Update existing trip (Record ID stays the same)
    airtableUpdate_('Trips', existing.id, fields);
    return existing.id;
  } else {
    // Create new trip
    var res = airtableCreate_('Trips', fields);
    var recs = res.records || [];
    return recs.length ? recs[0].id : null;
  }
}

/**
 * Fetch child records linked to a trip.
 * Supports both TripID (string) and Record ID (starts with "rec").
 * @param {string} tableName - The child table name
 * @param {string} linkField - The field name that links to Trips
 * @param {string} tripIdentifier - Either TripID or Record ID
 * @return {Array} - Array of records
 */
function fetchChildRecordsByTripIdentifier_(tableName, linkField, tripIdentifier) {
  if (!tripIdentifier) return [];
  
  var formula;
  
  // Check if it's a Record ID (starts with "rec")
  if (tripIdentifier.indexOf('rec') === 0) {
    // Use Record ID directly
    formula = "ARRAYJOIN({" + linkField + "}) = '" + tripIdentifier + "'";
  } else {
    // It's a TripID - need to find the Record ID first
    var recordId = AirtableUtils.getTripRecordIdByTripID(tripIdentifier);
    if (!recordId) return [];
    formula = "ARRAYJOIN({" + linkField + "}) = '" + recordId + "'";
  }
  
  var res = airtableGet_(tableName, { filterByFormula: formula });
  return res && res.records ? res.records : [];
}

