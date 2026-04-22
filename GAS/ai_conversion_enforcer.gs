function runConversionEnforcer(record) {
  try { loadConfigSecrets_(); } catch (e0) {}
  var _logTripId = (record && typeof record === 'object' && record.id) ? record.id : String(record || '');
  var _success = false;
  try { Logger.log('🚀 Conversion Enforcer START for Trip: ' + _logTripId); } catch (eLog0) {}
  try {
    var trip = convEnf_normalizeTripRecord_(record);
    if (!trip || !trip.id) return;
    var tripId = trip.id;
    var tripFields = trip.fields || {};
    try {
      Logger.log('📥 Input Data:');
      Logger.log(JSON.stringify(tripFields, null, 2));
    } catch (eLog1) {}
    var tripNumber = tripFields.TripID || '';
    var imp = convEnf_fetchMainImprovementRecord_(tripId, tripFields, tripNumber);
    if (!imp || !imp.id) return;
    var impFields = imp.fields || {};
    var nowIso = new Date().toISOString();
    var existingHighlights = convEnf_fetchHighlights_(tripId);
    var existingItinerary = convEnf_fetchItinerary_(tripId);
    var existingIncludes = convEnf_fetchIncExc_(tripId, 'TripIncludes Improvement With AI', 'IncludeItem');
    var existingExcludes = convEnf_fetchIncExc_(tripId, 'TripExcludes Improvement With AI', 'ExcludeItem');
    try {
      Logger.log('🔹 Processing Highlights...');
      Logger.log('Original Highlights count: ' + (existingHighlights && existingHighlights.items ? existingHighlights.items.length : 0));
      Logger.log('🔹 Processing Itinerary...');
      Logger.log('Original Steps: ' + (existingItinerary && existingItinerary.steps ? existingItinerary.steps.length : 0));
      Logger.log('🔹 Processing Includes...');
      Logger.log('Original Includes: ' + (existingIncludes && existingIncludes.items ? existingIncludes.items.length : 0));
    } catch (eLog2) {}
    var payload = {
      trip: {
        id: tripId,
        TripID: tripNumber || '',
        Title: tripFields.Title || '',
        Slug: tripFields.Slug || '',
        Duration_Hours: tripFields.Duration_Hours || '',
        Duration_Minutes: tripFields.Duration_Minutes || tripFields['Duration Minutes'] || '',
        Duration_Unit: tripFields.Duration_Unit || ''
      },
      description: (impFields.AI_Trip_Description || '').toString(),
      why_people_love: (impFields.AI_Tab_Content || '').toString(),
      highlights: existingHighlights.items,
      itinerary: existingItinerary.steps,
      included: existingIncludes.items,
      excluded: existingExcludes.items
    };
    var prompt = convEnf_buildPrompt_(payload);
    var ai = callAi_(prompt);
    if (!ai || typeof ai !== 'object') return;
    var updateMain = {};
    var descHtml = convEnf_getString_(ai, ['description', 'html']);
    if (descHtml && descHtml.length >= 80) updateMain.AI_Trip_Description = descHtml;
    var whyHtml = convEnf_getString_(ai, ['why_people_love', 'html']);
    if (whyHtml && whyHtml.length >= 100) updateMain.AI_Tab_Content = whyHtml;
    try { Logger.log('📤 Writing updates to Airtable...'); } catch (eLog3) {}
    if (Object.keys(updateMain).length) {
      updateMain.AI_LastUpdated = nowIso;
      airtableUpdate_('Improvement With AI', imp.id, updateMain);
    }
    var newHighlights = convEnf_getArray_(ai, ['highlights', 'items']);
    if (newHighlights && newHighlights.length >= 3) {
      try {
        Logger.log('✅ Improved Highlights:');
        Logger.log(JSON.stringify(newHighlights, null, 2));
      } catch (eLog4) {}
      convEnf_replaceHighlights_(tripId, newHighlights, nowIso);
    }
    var newItinerary = convEnf_getArray_(ai, ['itinerary', 'steps']);
    if (newItinerary && newItinerary.length >= 2) {
      try {
        Logger.log('✅ Improved Itinerary:');
        Logger.log(JSON.stringify(newItinerary, null, 2));
      } catch (eLog5) {}
      convEnf_replaceItinerary_(tripId, newItinerary, nowIso);
    }
    var newIncluded = convEnf_mergeOptionalItems_(ai, ['included', 'items'], ['included', 'optional_items']);
    if (newIncluded && newIncluded.length >= 3) {
      try {
        Logger.log('✅ Improved Includes:');
        Logger.log(JSON.stringify(newIncluded, null, 2));
      } catch (eLog6) {}
      convEnf_replaceIncExc_(tripId, 'TripIncludes Improvement With AI', 'IncludeItem', newIncluded, nowIso);
    }
    var newExcluded = convEnf_mergeOptionalItems_(ai, ['excluded', 'items'], ['excluded', 'optional_items']);
    if (newExcluded && newExcluded.length >= 2) {
      convEnf_replaceIncExc_(tripId, 'TripExcludes Improvement With AI', 'ExcludeItem', newExcluded, nowIso);
    }
    _success = true;
  } catch (e) {
    try {
      Logger.log('❌ Conversion Enforcer ERROR:');
      Logger.log(e && e.message ? e.message : String(e));
      Logger.log(e && e.stack ? e.stack : '');
    } catch (e2) {}
  } finally {
    if (_success) {
      try { Logger.log('✅ Airtable update SUCCESS for Trip: ' + _logTripId); } catch (eLog4b) {}
    }
    try { Logger.log('🏁 Conversion Enforcer FINISHED for Trip: ' + _logTripId); } catch (eLogF) {}
  }
}

function convEnf_mergeOptionalItems_(aiObj, itemsPath, optionalPath) {
  var items = convEnf_getArray_(aiObj, itemsPath) || [];
  var optionalItems = convEnf_getArray_(aiObj, optionalPath) || [];
  var out = [];
  items.forEach(function(x) {
    var s = String(x || '').replace(/\s+/g, ' ').trim();
    if (!s) return;
    out.push(s);
  });
  optionalItems.forEach(function(x) {
    var s = String(x || '').replace(/\s+/g, ' ').trim();
    if (!s) return;
    if (!/^optional[:\s-]/i.test(s)) s = 'Optional: ' + s;
    out.push(s);
  });
  return out;
}

function convEnf_getString_(obj, pathArr) {
  var v = convEnf_getPath_(obj, pathArr);
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function convEnf_getArray_(obj, pathArr) {
  var v = convEnf_getPath_(obj, pathArr);
  return Array.isArray(v) ? v : null;
}

function convEnf_getPath_(obj, pathArr) {
  var cur = obj;
  for (var i = 0; i < pathArr.length; i++) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[pathArr[i]];
  }
  return cur;
}

function convEnf_normalizeTripRecord_(record) {
  if (!record) return null;
  if (typeof record === 'object' && record.id) return record;
  var id = String(record || '').trim();
  if (!id) return null;
  var res = airtableGet_('Trips', { filterByFormula: "RECORD_ID() = '" + convEnf_escapeFormulaString_(id) + "'", maxRecords: 1 });
  if (!res || !res.records || !res.records.length) return null;
  return res.records[0];
}

function convEnf_fetchMainImprovementRecord_(tripId, tripFields, tripNumber) {
  var linked = tripFields ? tripFields['Improvement With AI'] : null;
  var directId = (Array.isArray(linked) && linked.length) ? String(linked[0] || '').trim() : '';
  if (directId) {
    var byId = airtableGet_('Improvement With AI', { filterByFormula: "RECORD_ID() = '" + convEnf_escapeFormulaString_(directId) + "'", maxRecords: 1 });
    if (byId && byId.records && byId.records.length) return byId.records[0];
  }
  var conditions = [];
  conditions.push("FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))");
  if (tripNumber) conditions.push("FIND('" + convEnf_escapeFormulaString_(String(tripNumber)) + "', ARRAYJOIN({Trip}))");
  var formula = (conditions.length > 1) ? ("OR(" + conditions.join(', ') + ")") : conditions[0];
  var res = airtableGet_('Improvement With AI', { filterByFormula: formula, maxRecords: 1 });
  if (!res || !res.records || !res.records.length) return null;
  return res.records[0];
}

function convEnf_fetchHighlights_(tripId) {
  var res = airtableGet_('Highlights Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  });
  var recs = res && res.records ? res.records : [];
  recs.sort(function(a, b) {
    var ao = (a.fields || {}).Order;
    var bo = (b.fields || {}).Order;
    if (typeof ao !== 'number') ao = 999999;
    if (typeof bo !== 'number') bo = 999999;
    return ao - bo;
  });
  var items = [];
  recs.forEach(function(r) {
    var t = ((r.fields || {}).AI_Highlight || '').toString().trim();
    if (t) items.push(t);
  });
  return { records: recs, items: items };
}

function convEnf_fetchItinerary_(tripId) {
  var res = airtableGet_('Itinerary Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  });
  var recs = res && res.records ? res.records : [];
  recs.sort(function(a, b) {
    var ao = (a.fields || {}).StepOrder;
    var bo = (b.fields || {}).StepOrder;
    if (typeof ao !== 'number') ao = 999999;
    if (typeof bo !== 'number') bo = 999999;
    return ao - bo;
  });
  var steps = [];
  recs.forEach(function(r) {
    var f = r.fields || {};
    steps.push({
      step_title: (f.AI_Step_Title || '').toString(),
      step_description: (f.AI_Step_Description || '').toString(),
      step_label: (f.AI_Step_Label || '').toString(),
      duration_value: (f.AI_Duration_Value === null || f.AI_Duration_Value === undefined || f.AI_Duration_Value === '') ? null : f.AI_Duration_Value,
      duration_unit: (f.AI_Duration_Unit || '').toString(),
      meals_included: (f.AI_Meals_Included || '').toString()
    });
  });
  return { records: recs, steps: steps };
}

function convEnf_fetchIncExc_(tripId, tableName, textField) {
  var res = airtableGet_(tableName, {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 200
  });
  var recs = res && res.records ? res.records : [];
  var items = [];
  recs.forEach(function(r) {
    var f = r.fields || {};
    var t = (f[textField] || '').toString().trim();
    if (t) items.push(t);
  });
  return { records: recs, items: items };
}

function convEnf_replaceHighlights_(tripId, items, nowIso) {
  convEnf_deleteLinked_(tripId, 'Highlights Improvement With AI', 'Trip');
  var fieldsArray = [];
  for (var i = 0; i < items.length; i++) {
    var t = String(items[i] || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    fieldsArray.push({
      Trip: [tripId],
      AI_Highlight: t,
      Order: i + 1,
      AI_Status: 'Done',
      AI_LastUpdated: nowIso
    });
  }
  airtableBatchCreate_('Highlights Improvement With AI', fieldsArray);
}

function convEnf_replaceItinerary_(tripId, steps, nowIso) {
  convEnf_deleteLinked_(tripId, 'Itinerary Improvement With AI', 'Trip');
  var fieldsArray = [];
  for (var i = 0; i < steps.length; i++) {
    var st = steps[i] || {};
    var title = String(st.step_title || '').trim();
    var desc = String(st.step_description || '').trim();
    if (!title && !desc) continue;
    var durVal = st.duration_value;
    if (durVal !== null && durVal !== undefined && durVal !== '') {
      var n = Number(durVal);
      durVal = isFinite(n) ? n : null;
    } else {
      durVal = null;
    }
    fieldsArray.push({
      Trip: [tripId],
      StepOrder: i + 1,
      AI_Step_Title: title,
      AI_Step_Description: desc,
      AI_Step_Label: String(st.step_label || '').trim(),
      AI_Duration_Value: durVal,
      AI_Duration_Unit: String(st.duration_unit || '').trim(),
      AI_Meals_Included: String(st.meals_included || '').trim(),
      AI_Status: 'Done',
      AI_LastUpdated: nowIso
    });
  }
  airtableBatchCreate_('Itinerary Improvement With AI', fieldsArray);
}

function convEnf_replaceIncExc_(tripId, tableName, textField, items, nowIso) {
  convEnf_deleteLinked_(tripId, tableName, 'Trip');
  var fieldsArray = [];
  for (var i = 0; i < items.length; i++) {
    var t = String(items[i] || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    var f = { Trip: [tripId], AI_Status: 'Done', AI_LastUpdated: nowIso };
    f[textField] = t;
    fieldsArray.push(f);
  }
  airtableBatchCreate_(tableName, fieldsArray);
}

function convEnf_deleteLinked_(tripId, tableName, linkField) {
  var res = airtableGet_(tableName, {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({" + linkField + "}))",
    pageSize: 200
  });
  var recs = res && res.records ? res.records : [];
  if (!recs.length) return;
  var ids = recs.map(function(r) { return r.id; }).filter(function(x) { return !!x; });
  if (ids.length) airtableBatchDelete_(tableName, ids);
}

function convEnf_escapeFormulaString_(s) {
  return String(s || '').replace(/'/g, "\\'");
}

function convEnf_buildPrompt_(payload) {
  return [
    "You are a conversion copywriting quality enforcer for tour pages. Return ONLY valid JSON.",
    "",
    "GOAL:",
    "- Make content consistently high-conversion like the best-performing tour pages.",
    "- Keep the existing content structure; improve quality and persuasion.",
    "",
    "QUALITY LOGIC:",
    "- For each section, rate strength 0-10.",
    "- If score >= 8: light polish only (keep most phrasing, sharpen benefits, remove fluff).",
    "- If score <= 7: rewrite for conversion (preserve facts, no hallucinations).",
    "",
    "TRANSFORMATION RULES:",
    "HIGHLIGHTS:",
    "- Convert features -> benefits with specific outcomes.",
    "- Remove generic verbs like 'visit'/'explore' and vague filler.",
    "- Keep each highlight 8-16 words, punchy, concrete.",
    "ITINERARY:",
    "- Convert schedule -> experience timeline with realistic flow.",
    "- Include clear sequence and what the traveler experiences.",
    "- Avoid invented places/times; keep what's plausible from inputs.",
    "INCLUDED/EXCLUDED:",
    "- Rewrite into value-driven bullets (traveler benefit).",
    "- Separate optional items clearly as optional_items[].",
    "DESCRIPTION:",
    "- Persuasive narrative focused on experience and outcomes.",
    "- No headings; output HTML paragraphs only.",
    "WHY PEOPLE LOVE:",
    "- Enforce emotional hooks, clear benefits, decision triggers.",
    "- 5-7 points, each as <p><strong>Title</strong> — ...</p> (HTML only).",
    "",
    "STRICT:",
    "- Do NOT add headings (no h2/h3/h4).",
    "- Do NOT invent new destinations or logistics not supported by input.",
    "- Output must be JSON only.",
    "",
    "INPUT JSON:",
    JSON.stringify(payload),
    "",
    "OUTPUT JSON SCHEMA:",
    JSON.stringify({
      description: { score: 0, action: "polish", html: "" },
      why_people_love: { score: 0, action: "polish", html: "" },
      highlights: { score: 0, action: "polish", items: [""] },
      itinerary: { score: 0, action: "polish", steps: [{ step_title: "", step_description: "", step_label: "", duration_value: null, duration_unit: "", meals_included: "" }] },
      included: { score: 0, action: "polish", items: [""], optional_items: [""] },
      excluded: { score: 0, action: "polish", items: [""], optional_items: [""] }
    })
  ].join("\n");
}
