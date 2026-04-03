/************************************************************
 * UPSERT LOGIC — write to Airtable using mappers
 ************************************************************/

/**
 * Helper: delete & recreate all child records by TripID for a table.
 * Assumes child table has:
 *  - "TripID" text field
 *  - link field to Trips (default "Trip" unless overridden)
 */
function replaceChildRecordsForTrip_(tableName, childRows, tripId, tripRecordId) {
  // لو مفيش Trip record ID يبقى مانقدرش نربط
  if (!tripRecordId) {
    Logger.log('No tripRecordId for table ' + tableName + ', skipping child replace.');
    return;
  }

  var linkFieldName = CONFIG.LINK_FIELDS[tableName] || CONFIG.DEFAULT_TRIP_LINK_FIELD;

  /********************************************************
   * 0) حماية:
   * لو الـ extractor رجّع 0 صفوف → مانلمسش القديم
   ********************************************************/
  if (!childRows || !childRows.length) {
    if (CONFIG.DEBUG) {
      Logger.log('No child rows for ' + tableName +
                 ' (TripID=' + tripId + '), skipping delete & create.');
    }
    return;
  }

  // 1) نجيب كل السجلات في الجدول (مع Pagination) ونفلتر في الكود
  //    على السجلات اللي مربوطة بـ tripRecordId
  var toDelete = [];
  var offset = null;

  do {
    var params = { pageSize: 100 };
    if (offset) params.offset = offset;

    var existing = airtableGet_(tableName, params);
    var records = existing && existing.records ? existing.records : [];
    offset = existing ? existing.offset : null;

    records.forEach(function (rec) {
      var fields = rec.fields || {};
      var linkVal = fields[linkFieldName];

      var match = false;
      // Handle Linked Record (Array)
      if (Array.isArray(linkVal)) {
        if (linkVal.indexOf(tripRecordId) !== -1) match = true;
      } 
      // Handle Text Field (String) - fallback if schema changed or user error
      else if (typeof linkVal === 'string') {
        if (linkVal === tripRecordId) match = true;
      }

      if (match) {
        toDelete.push(rec.id);
      }
    });

  } while (offset);

  if (toDelete.length && CONFIG.DEBUG) {
    Logger.log('Deleting ' + toDelete.length + ' existing records from ' +
               tableName + ' for Trip record=' + tripRecordId);
  }

  if (toDelete.length) {
    airtableBatchDelete_(tableName, toDelete);
  }

  /********************************************************
   * 2) نضيف السجلات الجديدة
   ********************************************************/
  var recordsFields = childRows.map(function (row) {
    var fields = {};
    for (var k in row) {
      if (!row.hasOwnProperty(k)) continue;
      if (k === 'TripID') continue; // مش حقل في Airtable
      fields[k] = row[k];
    }

    if (linkFieldName) {
      fields[linkFieldName] = [tripRecordId];
    }

    return fields;
  });

  airtableBatchCreate_(tableName, recordsFields);
}

/************************************************************
 * DELETE Trip + all child tables by TripID (hard reset)
 ************************************************************/

/**
 * Deletes all child records in a given table for a list of Trip record IDs.
 * يعتمد على أن كل جدول فرعي فيه linked field للـ Trips (افتراض: "Trip"
 * أو مخصص في CONFIG.LINK_FIELDS[tableName])
 */
function deleteChildRecordsForTripRecords_(tableName, tripRecordIds) {
  if (!tripRecordIds || !tripRecordIds.length) return;

  var linkFieldName = 'Trip';
  if (CONFIG.LINK_FIELDS && CONFIG.LINK_FIELDS[tableName]) {
    linkFieldName = CONFIG.LINK_FIELDS[tableName];
  }

  var toDelete = [];
  var offset = null;

  do {
    var params = { pageSize: 100 };
    if (offset) params.offset = offset;

    var res = airtableGet_(tableName, params);
    var records = (res && res.records) ? res.records : [];
    offset = res ? res.offset : null;

    records.forEach(function (rec) {
      var f = rec.fields || {};
      var linkVal = f[linkFieldName];
      var match = false;

      if (Array.isArray(linkVal)) {
        // لو أي Trip record ID موجود في الـ array → احذف السجل
        for (var i = 0; i < linkVal.length; i++) {
          if (tripRecordIds.indexOf(linkVal[i]) !== -1) {
            match = true;
            break;
          }
        }
      } else if (typeof linkVal === 'string') {
        // Fallback for text field
        if (tripRecordIds.indexOf(linkVal) !== -1) {
          match = true;
        }
      }

      if (match) toDelete.push(rec.id);
    });

  } while (offset);

  if (!toDelete.length) {
    if (CONFIG.DEBUG) {
      Logger.log('No child records to delete in ' + tableName +
                 ' for Trip record IDs: ' + tripRecordIds.join(', '));
    }
    return;
  }

  Logger.log('Deleting ' + toDelete.length + ' records from ' + tableName +
             ' for Trip record IDs: ' + tripRecordIds.join(', '));

  if (typeof airtableBatchDelete_ === 'function') {
    airtableBatchDelete_(tableName, toDelete);
  } else {
    toDelete.forEach(function (id) {
      try {
        airtableDelete_(tableName, id);
      } catch (e) {
        Logger.log('Failed to delete record ' + id + ' from ' +
                   tableName + ': ' + e.message);
      }
    });
  }
}

/**
 * Delete Trip(s) and all related child table records by TripID (string)
 * مثال: TripID = core.id بتاع وردبريس
 */
function deleteTripAndChildrenByTripId_(tripId) {
  if (!tripId && tripId !== 0) return;

  var tripIdStr = String(tripId);
  Logger.log('deleteTripAndChildrenByTripId_: TripID=' + tripIdStr);

  // 1) نجيب كل سجلات Trips اللي TripID = tripIdStr
  var formula = '({TripID} = "' + AirtableUtils.escapeFormulaValue(tripIdStr) + '")';
  var res = airtableGet_('Trips', {
    filterByFormula: formula,
    pageSize: 50
  });

  var tripRecords = (res && res.records) ? res.records : [];
  if (!tripRecords.length) {
    if (CONFIG.DEBUG) {
      Logger.log('No Trips records found for TripID=' + tripIdStr +
                 ' — nothing to delete.');
    }
    return;
  }

  var tripRecordIds = tripRecords.map(function (r) { return r.id; });

  Logger.log('Found ' + tripRecordIds.length +
             ' Trips record(s) for TripID=' + tripIdStr +
             ' → deleting children + Trips.');

  // 2) نحذف كل السجلات في الجداول الفرعية اللي مربوطة بالـ Trips دي
  var childTables = [
    'TripHighlights',
    'ItinerarySteps',
    'TripFAQs',
    'TripIncludes',
    'TripExcludes',
    'AddOns',
    'PickupLocations',
    'TripDetails',
    'Packages',
    'Images',
    'Prices',
    'TripFacts'
  ];

  childTables.forEach(function (tbl) {
    deleteChildRecordsForTripRecords_(tbl, tripRecordIds);
  });

  // 3) نحذف سجلات Trips نفسها
  if (typeof airtableBatchDelete_ === 'function') {
    airtableBatchDelete_('Trips', tripRecordIds);
  } else {
    tripRecordIds.forEach(function (id) {
      try {
        airtableDelete_('Trips', id);
      } catch (e) {
        Logger.log('Failed to delete Trips record ' + id +
                   ' for TripID=' + tripIdStr + ': ' + e.message);
      }
    });
  }

  Logger.log('Finished deleting Trip(s) and children for TripID=' + tripIdStr);
}

function buildSeoFocusKeywordsAggregateForTrip_(trip) {
  var coreId = get_(trip, 'core.id', '');
  var seo = get_(trip, 'seo.rank_math', {}) || {};
  var meta = trip.meta || {};
  var baseFocus = seo.focus_keyword || meta.rank_math_focus_keyword || '';
  var baseList = parseCSV_(baseFocus);

  var primary = baseList.length ? baseList[0] : '';
  var all = [];
  for (var i = 0; i < baseList.length; i++) all.push(baseList[i]);

  var translations = get_(trip, 'language.translations', null);
  if (translations && typeof translations === 'object') {
    for (var lang in translations) {
      if (!translations.hasOwnProperty(lang)) continue;
      var tid = translations[lang];
      if (!tid) continue;
      if (String(tid) === String(coreId)) continue;

      try {
        var tTrip = fetchTripById_(tid);
        var tSeo = get_(tTrip, 'seo.rank_math', {}) || {};
        var tMeta = tTrip.meta || {};
        var tFocus = tSeo.focus_keyword || tMeta.rank_math_focus_keyword || '';
        var tList = parseCSV_(tFocus);
        for (var j = 0; j < tList.length; j++) all.push(tList[j]);
      } catch (e) {
        Logger.log('upsertTrip_: failed to fetch translation ' + lang + ' (' + tid + '): ' + e.message);
      }
    }
  }

  var seen = {};
  var deduped = [];
  for (var k = 0; k < all.length; k++) {
    var s = String(all[k] || '').trim();
    if (!s) continue;
    var key = s.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    deduped.push(s);
  }

  if (!primary && deduped.length) primary = deduped[0];
  var list = deduped.filter(function(x) { return x && x !== primary; });

  return {
    primary: primary,
    list: list
  };
}

function upsertTrip_(trip) {
  if (!trip) {
    Logger.log('upsertTrip_: trip is null/undefined, skipping.');
    return;
  }

  var tripId = get_(trip, 'core.id', '');
  if (!tripId) {
    Logger.log('upsertTrip_: trip has no core.id, skipping.');
    return;
  }

  try {
    trip._seoFocusKeywordsAggregate = buildSeoFocusKeywordsAggregateForTrip_(trip);
  } catch (eAgg) {
    Logger.log('upsertTrip_: failed to build SEO_FocusKeywords_List aggregate: ' + eAgg.message);
  }

  // 1) بنجهز الحقول الرئيسية للجدول Trips
  var tripFields = mapTripToTripsRow_(trip);

  // 2) نشوف هل فيه record موجود بنفس TripID ولا لأ
  var formula = '({TripID} = "' + AirtableUtils.escapeFormulaValue(String(tripId)) + '")';
  var existing = airtableGet_('Trips', {
    filterByFormula: formula,
    maxRecords: 1
  });

  var tripRecordId = null;

  if (existing.records && existing.records.length) {
    // موجود → Update
    tripRecordId = existing.records[0].id;
    if (CONFIG.DEBUG) {
      Logger.log('Updating Trips record ' + tripRecordId + ' for TripID=' + tripId);
    }
    airtableUpdate_('Trips', tripRecordId, tripFields);
  } else {
    // مش موجود → Create
    if (CONFIG.DEBUG) {
      Logger.log('Creating Trips record for TripID=' + tripId);
    }
    var created = airtableCreate_('Trips', tripFields);

    // نحاول ناخد الـ id من نتيجة الـ helper
    if (created && created.id) {
      tripRecordId = created.id;
    }

    // Fallback مهم: لو الـ helper ما رجّعش id، نعمل query تاني بالـ TripID
    if (!tripRecordId) {
      var check = airtableGet_('Trips', {
        filterByFormula: formula,
        maxRecords: 1
      });
      if (check.records && check.records.length) {
        tripRecordId = check.records[0].id;
      }
    }
  }

  if (!tripRecordId) {
    Logger.log('upsertTrip_: no tripRecordId after create/update, skipping children.');
    return;
  }

  // 3) جداول فرعية مرتبطة بالرحلة دي
  replaceChildRecordsForTrip_('TripHighlights',   extractHighlights_(trip),      tripId, tripRecordId);
  replaceChildRecordsForTrip_('ItinerarySteps',   extractItinerarySteps_(trip),  tripId, tripRecordId);
  replaceChildRecordsForTrip_('TripFAQs',         extractFAQs_(trip),            tripId, tripRecordId);
  replaceChildRecordsForTrip_('TripIncludes',     extractIncludes_(trip),        tripId, tripRecordId);
  replaceChildRecordsForTrip_('TripExcludes',     extractExcludes_(trip),        tripId, tripRecordId);
  replaceChildRecordsForTrip_('AddOns',           extractAddOns_(trip),          tripId, tripRecordId);
  replaceChildRecordsForTrip_('PickupLocations',  extractPickupLocations_(trip), tripId, tripRecordId);
  replaceChildRecordsForTrip_('TripDetails',      extractTripDetails_(trip),     tripId, tripRecordId);
  replaceChildRecordsForTrip_('Packages',         extractPackages_(trip),        tripId, tripRecordId);
  replaceChildRecordsForTrip_('Images',           extractImages_(trip),          tripId, tripRecordId);
  replaceChildRecordsForTrip_('Prices',           extractPrices_(trip),          tripId, tripRecordId);
  replaceChildRecordsForTrip_('TripFacts',        extractTripFacts_(trip),       tripId, tripRecordId);
}
