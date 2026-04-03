/**
 * ENHANCEMENT HELPERS
 * 
 * Helper functions for managing enhancement pipeline status,
 * retry counts, and state transitions.
 */

/**
 * Update enhancement status for a trip
 * @param {string} tripId - Airtable Record ID of the trip
 * @param {string} statusField - Field name (e.g., 'AI_Status', 'AI_AddOns_Status')
 * @param {string} status - New status value ('Waiting', 'Pending', 'Processing', 'Done', 'Error')
 */
function updateEnhancementStatus_(tripId, statusField, status) {
  if (!tripId || !statusField || !status) {
    Logger.log('updateEnhancementStatus_: missing required parameters');
    return;
  }
  
  var fields = {};
  fields[statusField] = status;
  
  try {
    airtableUpdate_('Trips', tripId, fields);
    Logger.log('✅ Updated ' + statusField + ' = ' + status + ' for Trip ' + tripId);
  } catch (e) {
    Logger.log('❌ Error updating status: ' + e.message);
  }
}

/**
 * Check if a stage is complete (Done or Error)
 * @param {Object} tripFields - Trip record fields
 * @param {string} statusField - Field name to check
 * @return {boolean}
 */
function isStageComplete_(tripFields, statusField) {
  if (!tripFields || !statusField) return false;
  var status = tripFields[statusField];
  return status === 'Done' || status === 'Error';
}

/**
 * Check if any of the given stages has errors
 * @param {Object} tripFields - Trip record fields
 * @param {Array<string>} statusFields - Array of status field names to check
 * @return {boolean}
 */
function hasErrors_(tripFields, statusFields) {
  if (!tripFields || !statusFields || !statusFields.length) return false;
  
  for (var i = 0; i < statusFields.length; i++) {
    if (tripFields[statusFields[i]] === 'Error') {
      return true;
    }
  }
  return false;
}

/**
 * Get trip fields by Record ID
 * @param {string} tripId - Airtable Record ID
 * @return {Object|null} - Trip fields or null if not found
 */
function getTripFields_(tripId) {
  if (!tripId) return null;
  
  try {
    var formula = "RECORD_ID() = '" + tripId + "'";
    var res = airtableGet_('Trips', { filterByFormula: formula, maxRecords: 1 });
    
    if (res && res.records && res.records.length) {
      return res.records[0].fields;
    }
    return null;
  } catch (e) {
    Logger.log('❌ Error fetching trip fields: ' + e.message);
    return null;
  }
}

var ImprovementRepository = (function() {
  function fetchImprovementRecordForTrip(options) {
    options = options || {};
    var tripRecordId = options.tripRecordId || null;
    var tripPublicId = options.tripPublicId || null;
    var directRecordId = options.directRecordId || null;
    var tripName = options.tripName || null;
    var tableName = options.tableName || 'Improvement With AI';
    var tripLinkField = options.tripLinkField || 'Trip';

    if (directRecordId) {
      try {
        var url = airtableBaseUrl_(tableName) + '/' + directRecordId;
        var rec = httpGetJson(url, airtableHeaders_());
        if (rec && rec.id) return rec;
      } catch (e) {}
    }

    var conditions = [];
    if (tripName) {
      var safeName = String(tripName).replace(/'/g, "\\'");
      conditions.push("FIND('" + safeName + "', ARRAYJOIN({" + tripLinkField + "}))");
    }

    if (tripPublicId) {
      conditions.push("FIND('" + String(tripPublicId) + "', ARRAYJOIN({" + tripLinkField + "}))");
    }

    if (tripRecordId) {
      conditions.push("FIND('" + String(tripRecordId) + "', ARRAYJOIN({" + tripLinkField + "}))");
    }

    if (!conditions.length) return null;
    var formula = "OR(" + conditions.join(", ") + ")";

    var all = [];
    var offset = null;
    do {
      var params = { filterByFormula: formula, pageSize: 100 };
      if (offset) params.offset = offset;
      var res = airtableGet_(tableName, params);
      var recs = (res && res.records) ? res.records : [];
      for (var i = 0; i < recs.length; i++) all.push(recs[i]);
      offset = res && res.offset ? res.offset : null;
    } while (offset);

    if (!all.length) return null;

    var newest = all[0];
    for (var j = 1; j < all.length; j++) {
      var ct = all[j].createdTime || '';
      var best = newest.createdTime || '';
      if (ct > best) newest = all[j];
    }
    return newest;
  }

  return {
    fetchImprovementRecordForTrip: fetchImprovementRecordForTrip,
    getOrCreateActive: function(options) {
      options = options || {};
      var tripRecordId = options.tripRecordId || null;
      var tripFields = options.tripFields || null;
      var tableName = options.tableName || 'Improvement With AI';
      var tripLinkField = options.tripLinkField || 'Trip';
      var initialFields = options.initialFields || null;

      if (!tripRecordId) return null;

      var directId = tripFields && tripFields.ImprovementRecordId ? String(tripFields.ImprovementRecordId) : '';
      var rec = fetchImprovementRecordForTrip({
        tripRecordId: tripRecordId,
        directRecordId: directId || null,
        tableName: tableName,
        tripLinkField: tripLinkField
      });

      if (rec && rec.id) {
        if (!directId) {
          try { airtableUpdate_('Trips', tripRecordId, { ImprovementRecordId: rec.id }); } catch (e1) {}
        }
        return rec;
      }

      var fields = {};
      fields[tripLinkField] = [tripRecordId];
      if (initialFields && typeof initialFields === 'object') {
        for (var k in initialFields) {
          if (!initialFields.hasOwnProperty(k)) continue;
          fields[k] = initialFields[k];
        }
      }

      var created = airtableCreate_(tableName, fields);
      if (created && created.records && created.records.length) {
        var createdId = created.records[0].id;
        try { airtableUpdate_('Trips', tripRecordId, { ImprovementRecordId: createdId }); } catch (e2) {}
        return created.records[0];
      }

      if (created && created.id) {
        try { airtableUpdate_('Trips', tripRecordId, { ImprovementRecordId: created.id }); } catch (e3) {}
        return created;
      }

      return null;
    }
  };
})();

function claimStage_(tripRecordId, stageName, ttlSeconds) {
  if (!tripRecordId || !stageName) return true;
  var ttlMs = Math.max(60, Number(ttlSeconds || 0)) * 1000;
  var now = Date.now();
  var leaseUntil = new Date(now + ttlMs).toISOString();
  var workerId = '';
  try {
    workerId = PropertiesService.getScriptProperties().getProperty('WORKER_ID') || '';
  } catch (e) {}
  if (!workerId) workerId = 'gas';
  var runId = Utilities.getUuid();

  var res = null;
  try {
    res = airtableGet_('Trips', { filterByFormula: "RECORD_ID() = '" + String(tripRecordId) + "'", maxRecords: 1 });
  } catch (e1) {
    return true;
  }
  var recs = res && res.records ? res.records : [];
  if (!recs.length) return false;
  var f = recs[0].fields || {};

  var currentLeaseRaw = f.Stage_LeaseUntil;
  var currentLeaseMs = 0;
  if (currentLeaseRaw) {
    var d = new Date(currentLeaseRaw);
    if (!isNaN(d.getTime())) currentLeaseMs = d.getTime();
  }
  var currentOwner = String(f.Stage_Owner || '');
  var currentStage = String(f.Stage_Name || '');

  if (currentLeaseMs && currentLeaseMs > now) {
    if (currentOwner && currentOwner !== workerId) return false;
    if (currentStage && currentStage !== stageName) return false;
  }

  try {
    airtableUpdate_('Trips', tripRecordId, {
      Stage_Name: stageName,
      Stage_Owner: workerId,
      Stage_RunId: runId,
      Stage_LeaseUntil: leaseUntil
    });
  } catch (e2) {
    return true;
  }

  try {
    var verify = airtableGet_('Trips', { filterByFormula: "RECORD_ID() = '" + String(tripRecordId) + "'", maxRecords: 1 });
    var vr = verify && verify.records ? verify.records : [];
    if (!vr.length) return false;
    var vf = vr[0].fields || {};
    return String(vf.Stage_RunId || '') === runId;
  } catch (e3) {
    return true;
  }
}
