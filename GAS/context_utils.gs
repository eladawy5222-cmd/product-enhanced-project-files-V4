function fetchRecordsByTrip_(tableName, tripId, tripNumber, pageSize, tripName) {
  var linkField = TABLE_LINK_FIELD_MAP[tableName] || 'Trip';
  var recs = [];
  
  try {
    var maxOut = pageSize || 100;
    var idNeedle = String(tripId || '').trim();
    var numNeedle = String(tripNumber || '').trim();
    var nameNeedle = String(tripName || '').trim();

    var conditions = [];
    if (idNeedle) conditions.push("FIND('" + idNeedle.replace(/'/g, "\\'") + "', ARRAYJOIN({" + linkField + "}))");
    if (numNeedle) conditions.push("FIND('" + numNeedle.replace(/'/g, "\\'") + "', ARRAYJOIN({" + linkField + "}))");
    if (nameNeedle) conditions.push("FIND('" + nameNeedle.replace(/'/g, "\\'") + "', ARRAYJOIN({" + linkField + "}))");

    if (conditions.length) {
      var formula = "OR(" + conditions.join(", ") + ")";
      var offset = null;
      do {
        var params = { filterByFormula: formula, pageSize: 100 };
        if (offset) params.offset = offset;
        var res = airtableGet_(tableName, params);
        var rr = res && res.records ? res.records : [];
        for (var i = 0; i < rr.length; i++) {
          recs.push(rr[i]);
          if (recs.length >= maxOut) break;
        }
        if (recs.length >= maxOut) break;
        offset = res && res.offset ? res.offset : null;
      } while (offset);
    }

    if ((!recs || !recs.length) && idNeedle) {
      var out = [];
      var off2 = null;
      do {
        var params2 = { pageSize: 100 };
        if (off2) params2.offset = off2;
        var res2 = airtableGet_(tableName, params2);
        var rr2 = res2 && res2.records ? res2.records : [];
        for (var j = 0; j < rr2.length; j++) {
          var r = rr2[j];
          var f = r && r.fields ? r.fields : {};
          var links = f[linkField];
          var hit = false;
          if (Array.isArray(links)) hit = links.indexOf(idNeedle) !== -1;
          else hit = String(links || '') === idNeedle;
          if (hit) {
            out.push(r);
            if (out.length >= maxOut) break;
          }
        }
        if (out.length >= maxOut) break;
        off2 = res2 && res2.offset ? res2.offset : null;
      } while (off2);
      recs = out;
    }
    
  } catch (e) {
    Logger.log('fetchRecordsByTrip_ Error (' + tableName + '): ' + e.message);
    recs = [];
  }
  
  return recs;
}

function concatFieldsText_(records, fieldNames) {
  var out = [];
  var recs = records || [];
  for (var i = 0; i < recs.length; i++) {
    var f = recs[i].fields || {};
    for (var j = 0; j < fieldNames.length; j++) {
      var v = (f[fieldNames[j]] || '').toString().trim();
      if (v) out.push(v);
    }
  }
  return out;
}

function sortByStepOrder_(records) {
  var recs = (records || []).slice();
  recs.sort(function(a, b) {
    var af = a.fields || {};
    var bf = b.fields || {};
    var ao = typeof af.StepOrder === 'number' ? af.StepOrder : 0;
    var bo = typeof bf.StepOrder === 'number' ? bf.StepOrder : 0;
    return ao - bo;
  });
  return recs;
}

/**
 * Enhanced formatter for Itinerary Steps to capture Duration/Time data.
 * This ensures the AI has enough context to calculate total trip duration.
 */
function formatItineraryStepsWithDetails_(records) {
  var out = [];
  var recs = records || [];
  for (var i = 0; i < recs.length; i++) {
    var f = recs[i].fields || {};
    
    // Basic Info
    var title = (f.StepTitle || '').toString().trim();
    var desc  = (f.StepDescription || '').toString().trim();
    
    // Time/Duration Info (check common field names)
    var extras = [];
    
    // Duration
    if (f.Duration) extras.push('Duration: ' + f.Duration);
    if (f.Duration_Hours) extras.push('Hours: ' + f.Duration_Hours);
    if (f.Duration_Minutes) extras.push('Minutes: ' + f.Duration_Minutes);
    if (f.DurationText) extras.push('DurationText: ' + f.DurationText);
    if (f.Time) extras.push('Time: ' + f.Time);
    
    // Check if title itself contains duration like "(25 minutes)"
    // No specific check needed, as title is included in the line.

    // Timing
    if (f.Start_Time || f.StartTime) extras.push('Start: ' + (f.Start_Time || f.StartTime));
    if (f.End_Time || f.EndTime)   extras.push('End: ' + (f.End_Time || f.EndTime));
    
    // Day
    if (f.Day_Number || f.Day) extras.push('Day: ' + (f.Day_Number || f.Day));

    // Construct line: "Title [Duration: 2h, Start: 9am] - Description"
    var line = title;
    if (extras.length > 0) {
      line += ' [' + extras.join(', ') + ']';
    }
    if (desc) {
      line += (line ? ' - ' : '') + desc;
    }
    
    if (line) out.push(line);
  }
  return out;
}

function buildUnifiedTripContext_(tripId, tripFields) {
  var tripNumber = (tripFields && tripFields.TripID) ? String(tripFields.TripID) : '';
  var tripName = (tripFields && tripFields.Title) ? String(tripFields.Title) : '';

  var rawHighlightsRecs = fetchRecordsByTrip_('TripHighlights', tripId, tripNumber, 100, tripName);
  var rawHighlightsArr = concatFieldsText_(rawHighlightsRecs, ['Highlight']);

  var improvedHighlightsRecs = fetchRecordsByTrip_('Highlights Improvement With AI', tripId, tripNumber, 100, tripName);
  var improvedHighlightsArr = concatFieldsText_(improvedHighlightsRecs, ['AI_Highlight']);

  var itinRawRecs = fetchRecordsByTrip_('ItinerarySteps', tripId, tripNumber, 100, tripName);
  // Enhanced formatting to include Duration/Time info for AI calculation
  var itinRawArr = formatItineraryStepsWithDetails_(sortByStepOrder_(itinRawRecs));

  var itinImpRecs = fetchRecordsByTrip_('Itinerary Improvement With AI', tripId, tripNumber, 100, tripName);
  var itinImpArr = concatFieldsText_(sortByStepOrder_(itinImpRecs), ['AI_Step_Title', 'AI_Step_Description']);

  var incRawRecs = fetchRecordsByTrip_('TripIncludes', tripId, tripNumber, 100, tripName);
  var incRawArr = concatFieldsText_(incRawRecs, ['IncludeItem']);

  var incImpRecs = fetchRecordsByTrip_('TripIncludes Improvement With AI', tripId, tripNumber, 100, tripName);
  var incImpArr = concatFieldsText_(incImpRecs, ['AI_IncludeItem', 'AI_IncludeText']);

  var exRawRecs = fetchRecordsByTrip_('TripExcludes', tripId, tripNumber, 100, tripName);
  var exRawArr = concatFieldsText_(exRawRecs, ['ExcludeItem']);

  var exImpRecs = fetchRecordsByTrip_('TripExcludes Improvement With AI', tripId, tripNumber, 100, tripName);
  var exImpArr = concatFieldsText_(exImpRecs, ['AI_ExcludeItem', 'AI_ExcludeText']);

  var addRawRecs = fetchRecordsByTrip_('AddOns', tripId, tripNumber, 100, tripName);
  var addRawArr = concatFieldsText_(addRawRecs, ['AddOnTitle', 'AddOnDescription']);

  var addImpRecs = fetchRecordsByTrip_('AddOns Improvement With AI', tripId, tripNumber, 100, tripName);
  var addImpArr = concatFieldsText_(addImpRecs, ['AI_AddOn_Title', 'AI_AddOn_Description']);

  var faqRawRecs = fetchRecordsByTrip_('TripFAQs', tripId, tripNumber, 100, tripName);
  var faqRawArr = concatFieldsText_(faqRawRecs, ['Question', 'Answer']);

  var faqImpRecs = fetchRecordsByTrip_('FAQs Improvement With AI', tripId, tripNumber, 100, tripName);
  var faqImpArr = concatFieldsText_(faqImpRecs, ['AI_Question', 'AI_Answer']);

  var pickupRecs = fetchRecordsByTrip_('PickupLocations', tripId, tripNumber, 100, tripName);
  var pickupArr = concatFieldsText_(pickupRecs, ['LocationName', 'LocationNotes']);

  var packagesRecs = fetchRecordsByTrip_('Packages', tripId, tripNumber, 100, tripName);
  var packagesArr = concatFieldsText_(packagesRecs, ['PackageName', 'ShortDescription']);

  var detailsRecs = fetchRecordsByTrip_('TripDetails', tripId, tripNumber, 100, tripName);
  var detailsArr = concatFieldsText_(detailsRecs, ['DetailTitle', 'DetailText']);

  return {
    rawHighlightsArr: rawHighlightsArr,
    improvedHighlightsArr: improvedHighlightsArr,
    highlightsText: rawHighlightsArr.concat(improvedHighlightsArr).join("\n"),
    itineraryArr: itinRawArr.concat(itinImpArr),
    itineraryText: "=== RAW ITINERARY STEPS (Use for Duration Calculation) ===\n" + itinRawArr.join("\n"),
    includesArr: incRawArr.concat(incImpArr),
    includesRawArr: incRawArr,
    includesText: incRawArr.concat(incImpArr).join("\n"),
    excludesArr: exRawArr.concat(exImpArr),
    excludesRawArr: exRawArr,
    excludesText: exRawArr.concat(exImpArr).join("\n"),
    addonsArr: addRawArr.concat(addImpArr),
    addonsText: addRawArr.concat(addImpArr).join("\n"),
    pickupArr: pickupArr,
    pickupText: pickupArr.join("\n"),
    packagesArr: packagesArr,
    packagesText: packagesArr.join("\n"),
    detailsArr: detailsArr,
    detailsText: detailsArr.join("\n"),
    faqsArr: faqRawArr.concat(faqImpArr),
    faqsText: faqRawArr.concat(faqImpArr).join("\n")
  };
}
var TABLE_LINK_FIELD_MAP = {
  'TripHighlights': 'Trip',
  'TripFAQs': 'Trip',
  'TripDetails': 'Trip',
  'Packages': 'Trip',
  'PickupLocations': 'Trip',
  'ItinerarySteps': 'Trip',
  'Itinerary Improvement With AI': 'Trip',
  'TripIncludes': 'Trip',
  'TripIncludes Improvement With AI': 'Trip',
  'TripExcludes': 'Trip',
  'TripExcludes Improvement With AI': 'Trip',
  'AddOns': 'Trip',
  'AddOns Improvement With AI': 'Trip',
  'FAQs Improvement With AI': 'Trip',
  'Trip Facts Improvement With AI': 'Trip',
  'Images Improvement With AI': 'Trip',
  'Images': 'SourceTrip'
};

var TABLE_TRIPID_FALLBACK_MAP = {
};
