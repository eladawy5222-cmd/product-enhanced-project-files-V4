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
    var tripLinkValue = String(tripNumber || tripId || '').trim();
    var existingHighlights = convEnf_fetchHighlights_(tripLinkValue);
    var existingItinerary = convEnf_fetchItinerary_(tripLinkValue);
    var existingIncludes = convEnf_fetchIncExc_(tripLinkValue, 'TripIncludes Improvement With AI', 'IncludeItem');
    var existingExcludes = convEnf_fetchIncExc_(tripLinkValue, 'TripExcludes Improvement With AI', 'ExcludeItem');
    var existingFaqs = convEnf_fetchFaqs_(tripLinkValue);
    var existingPackages = convEnf_fetchPackages_(tripLinkValue);
    try {
      Logger.log('Fetched Highlights count: ' + (existingHighlights && existingHighlights.items ? existingHighlights.items.length : 0));
      Logger.log('Fetched Itinerary count: ' + (existingItinerary && existingItinerary.steps ? existingItinerary.steps.length : 0));
      Logger.log('Fetched Includes count: ' + (existingIncludes && existingIncludes.items ? existingIncludes.items.length : 0));
      Logger.log('Fetched FAQs count: ' + (existingFaqs && existingFaqs.faqs ? existingFaqs.faqs.length : 0));
      Logger.log('Fetched Packages count: ' + (existingPackages && existingPackages.packages ? existingPackages.packages.length : 0));
      if (!existingHighlights.items.length) Logger.log('⚠️ No Highlights found using TripID filter');
      if (!existingItinerary.steps.length) Logger.log('⚠️ No Itinerary found using TripID filter');
      if (!existingIncludes.items.length) Logger.log('⚠️ No Includes found using TripID filter');
      if (!existingFaqs.faqs.length) Logger.log('⚠️ No FAQs found using TripID filter');
      if (!existingPackages.packages.length) Logger.log('⚠️ No Packages found using TripID filter');
    } catch (eLogFetch) {}
    try {
      Logger.log('🔹 Processing Highlights...');
      Logger.log('Original Highlights count: ' + (existingHighlights && existingHighlights.items ? existingHighlights.items.length : 0));
      Logger.log('🔹 Processing Itinerary...');
      Logger.log('Original Steps: ' + (existingItinerary && existingItinerary.steps ? existingItinerary.steps.length : 0));
      Logger.log('🔹 Processing Includes...');
      Logger.log('Original Includes: ' + (existingIncludes && existingIncludes.items ? existingIncludes.items.length : 0));
      Logger.log('🔹 Processing FAQs...');
      Logger.log('Original FAQs: ' + (existingFaqs && existingFaqs.faqs ? existingFaqs.faqs.length : 0));
      Logger.log('🔹 Processing Packages...');
      Logger.log('Original Packages: ' + (existingPackages && existingPackages.packages ? existingPackages.packages.length : 0));
    } catch (eLog2) {}
    var payload = {
      trip: {
        id: tripId,
        TripID: tripNumber || '',
        Title: tripFields.Title || '',
        TourType: tripFields.TourType || '',
        Slug: tripFields.Slug || '',
        Duration_Hours: tripFields.Duration_Hours || '',
        Duration_Minutes: tripFields.Duration_Minutes || tripFields['Duration Minutes'] || '',
        Duration_Unit: tripFields.Duration_Unit || ''
      },
      seo: {
        h1: String(impFields.AI_Titel_H1 || ''),
        title: String(impFields.AI_SEO_Title || ''),
        meta_description: String(impFields.AI_SEO_Meta_Description || ''),
        short_summary: String(impFields.AI_Short_Summary || ''),
        excerpt: String(impFields.AI_Excerpt || ''),
        focus_keywords: String(impFields.AI_SEO_FocusKeywords || ''),
        focus_keywords_list: impFields.AI_SEO_FocusKeywords_List || '',
        permalink: String(impFields.AI_SEO_Permalink || '')
      },
      description: (impFields.AI_Trip_Description || '').toString(),
      why_people_love: (impFields.AI_Tab_Content || '').toString(),
      highlights: existingHighlights.items,
      itinerary: existingItinerary.steps,
      included: existingIncludes.items,
      excluded: existingExcludes.items,
      faqs: existingFaqs.faqs,
      packages: existingPackages.packages,
      package_copy_source: {
        guaranteed_inclusions: convEnf_getGuaranteedItems_(existingIncludes.items),
        guaranteed_exclusions: convEnf_getGuaranteedItems_(existingExcludes.items)
      }
    };
    var standardContext = convEnf_buildStandardContext_(payload);
    try {
      Logger.log('🧭 Standard Context:');
      Logger.log(JSON.stringify(standardContext, null, 2));
    } catch (eLogStd) {}
    var prompt = convEnf_buildPrompt_(payload, standardContext);
    var ai = callAi_(prompt);
    if (!ai || typeof ai !== 'object') return;
    var updateMain = {};
    var flags = (standardContext && standardContext.flags) ? standardContext.flags : {};
    var evidence = (standardContext && standardContext.evidence) ? standardContext.evidence : {};
    var entranceTruth = convEnf_detectEntranceFeesTruth_(payload.included, payload.excluded);
    var guideTruth = convEnf_detectGuideTruth_(payload.included, payload.excluded, String(evidence.strict_combined || evidence.combined || ''));
    var fixedSeo = convEnf_finalizeSeoFields_(ai, payload, flags);
    var fixedSeoH1 = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.h1, entranceTruth), guideTruth);
    var fixedSeoTitle = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.title, entranceTruth), guideTruth);
    var fixedSeoMeta = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.meta_description, entranceTruth), guideTruth);
    var fixedSeoExcerpt = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.excerpt, entranceTruth), guideTruth);
    var fixedSeoShort = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.short_summary, entranceTruth), guideTruth);
    if (fixedSeoH1 && fixedSeoH1.length >= 15) updateMain.AI_Titel_H1 = fixedSeoH1;
    if (fixedSeoTitle && fixedSeoTitle.length >= 20) updateMain.AI_SEO_Title = fixedSeoTitle;
    if (fixedSeoMeta && fixedSeoMeta.length >= 60) updateMain.AI_SEO_Meta_Description = fixedSeoMeta;
    if (fixedSeoExcerpt && fixedSeoExcerpt.length >= 40) updateMain.AI_Excerpt = fixedSeoExcerpt;
    if (fixedSeoShort && fixedSeoShort.length >= 40) updateMain.AI_Short_Summary = fixedSeoShort;
    var descHtml = convEnf_getString_(ai, ['description', 'html']);
    if (descHtml) descHtml = convEnf_sanitizeHtml_(descHtml);
    if (descHtml) descHtml = convEnf_rewriteUnsupportedContentText_(descHtml, flags, evidence);
    if (descHtml) descHtml = convEnf_applyEntranceFeesTruthToText_(descHtml, entranceTruth);
    if (descHtml) descHtml = convEnf_applyGuideTruthToText_(descHtml, guideTruth);
    if (descHtml && descHtml.length >= 80) updateMain.AI_Trip_Description = descHtml;
    var whyHtml = convEnf_getString_(ai, ['why_people_love', 'html']);
    if (whyHtml) whyHtml = convEnf_sanitizeWhyPeopleLoveHtml_(whyHtml);
    if (whyHtml) whyHtml = convEnf_rewriteUnsupportedContentText_(whyHtml, flags, evidence);
    if (whyHtml) whyHtml = convEnf_applyEntranceFeesTruthToText_(whyHtml, entranceTruth);
    if (whyHtml) whyHtml = convEnf_applyGuideTruthToText_(whyHtml, guideTruth);
    if (whyHtml && whyHtml.length >= 100) updateMain.AI_Tab_Content = whyHtml;
    var boldPromise = convEnf_getString_(ai, ['bold_promise', 'value']);
    if (!boldPromise) boldPromise = convEnf_getString_(ai, ['bold_promise', 'text']);
    if (!boldPromise) boldPromise = convEnf_getString_(ai, ['bold_promise']);
    if (boldPromise) boldPromise = String(boldPromise).replace(/\s+/g, ' ').trim();
    if (boldPromise && boldPromise.length >= 20) updateMain.AI_Bold_Promise = boldPromise;
    var atAGlanceObj = convEnf_getObject_(ai, ['at_a_glance', 'value']);
    if (!atAGlanceObj) atAGlanceObj = convEnf_getObject_(ai, ['at_a_glance']);
    if (atAGlanceObj) {
      var atAGlance = {
        duration: String(atAGlanceObj.duration || '').replace(/\s+/g, ' ').trim(),
        meeting_point: String(atAGlanceObj.meeting_point || atAGlanceObj.meeting || atAGlanceObj.meet || '').replace(/\s+/g, ' ').trim(),
        group_size: String(atAGlanceObj.group_size || atAGlanceObj.group || '').replace(/\s+/g, ' ').trim(),
        includes: String(atAGlanceObj.includes || atAGlanceObj.included || '').replace(/\s+/g, ' ').trim(),
        excludes: String(atAGlanceObj.excludes || atAGlanceObj.excluded || '').replace(/\s+/g, ' ').trim()
      };
      var hasAnyAtAGlance = false;
      for (var k0 in atAGlance) {
        if (atAGlance[k0]) { hasAnyAtAGlance = true; break; }
      }
      if (hasAnyAtAGlance) updateMain.AI_At_A_Glance = JSON.stringify(atAGlance);
    }
    try { Logger.log('📤 Writing updates to Airtable...'); } catch (eLog3) {}
    if (Object.keys(updateMain).length) {
      updateMain.AI_LastUpdated = nowIso;
      convEnf_logAirtableFields_('UPDATE', 'Improvement With AI', imp.id, updateMain);
      convEnf_airtableUpdateSafe_('Improvement With AI', imp.id, updateMain);
    }
    var newHighlights = convEnf_getArray_(ai, ['highlights', 'items']);
    newHighlights = convEnf_sanitizeStringList_(newHighlights, { max: 12 });
    newHighlights = convEnf_filterUnsupportedItems_(newHighlights, flags);
    newHighlights = convEnf_applyEntranceFeesTruthToHighlights_(newHighlights, entranceTruth);
    newHighlights = convEnf_applyGuideTruthToHighlights_(newHighlights, guideTruth);
    if (newHighlights && newHighlights.length >= 3) {
      try {
        Logger.log('✅ Improved Highlights:');
        Logger.log(JSON.stringify(newHighlights, null, 2));
      } catch (eLog4) {}
      convEnf_replaceHighlights_(tripId, existingHighlights.records, newHighlights, nowIso);
    }
    var newItinerary = convEnf_getArray_(ai, ['itinerary', 'steps']);
    newItinerary = convEnf_sanitizeItinerarySteps_(newItinerary, { max: 20 });
    newItinerary = convEnf_applyItineraryDurationSuffix_(newItinerary);
    newItinerary = convEnf_sanitizeItineraryByFlags_(newItinerary, flags, evidence);
    if (newItinerary && newItinerary.length >= 2) {
      try {
        Logger.log('✅ Improved Itinerary:');
        Logger.log(JSON.stringify(newItinerary, null, 2));
      } catch (eLog5) {}
      convEnf_replaceItinerary_(tripId, existingItinerary.records, newItinerary, nowIso);
    }
    var newIncluded = convEnf_mergeOptionalItems_(ai, ['included', 'items'], ['included', 'optional_items']);
    newIncluded = convEnf_sanitizeStringList_(newIncluded, { max: 40 });
    newIncluded = convEnf_sortIncExcItems_(newIncluded);
    newIncluded = convEnf_filterUnsupportedItems_(newIncluded, flags);
    newIncluded = convEnf_filterOptionalLikeItemsFromIncluded_(newIncluded);
    var newExcluded = convEnf_mergeOptionalItems_(ai, ['excluded', 'items'], ['excluded', 'optional_items']);
    newExcluded = convEnf_sanitizeStringList_(newExcluded, { max: 40 });
    newExcluded = convEnf_sortIncExcItems_(newExcluded);
    newExcluded = convEnf_filterUnsupportedItems_(newExcluded, flags);

    if (newIncluded && newExcluded) {
      var fixedIncExc = convEnf_removeIncExcOverlap_(newIncluded, newExcluded);
      newIncluded = fixedIncExc.included;
      newExcluded = fixedIncExc.excluded;
    }

    if (newIncluded && newIncluded.length >= 3) {
      try {
        Logger.log('✅ Improved Includes:');
        Logger.log(JSON.stringify(newIncluded, null, 2));
      } catch (eLog6) {}
      convEnf_replaceIncExc_(tripId, existingIncludes.records, 'TripIncludes Improvement With AI', 'IncludeItem', newIncluded, nowIso);
    }
    if (newExcluded && newExcluded.length >= 2) {
      convEnf_replaceIncExc_(tripId, existingExcludes.records, 'TripExcludes Improvement With AI', 'ExcludeItem', newExcluded, nowIso);
    }
    var newFaqs = convEnf_getArray_(ai, ['faqs', 'items']);
    newFaqs = convEnf_sanitizeFaqItems_(newFaqs, { max: 15 }, { included: newIncluded, excluded: newExcluded, flags: flags });
    newFaqs = convEnf_sortFaqItems_(newFaqs);
    if (newFaqs && newFaqs.length >= 3) {
      try {
        Logger.log('✅ Improved FAQs:');
        Logger.log(JSON.stringify(newFaqs, null, 2));
      } catch (eLog7) {}
      convEnf_replaceFaqs_(tripId, existingFaqs.records, newFaqs, nowIso);
    }
    var packageCopyItems = convEnf_getArray_(ai, ['packages', 'items']);
    packageCopyItems = convEnf_sanitizePackageCopyItems_(packageCopyItems, flags, evidence);
    if (packageCopyItems && packageCopyItems.length) {
      convEnf_updatePackagesCopy_(existingPackages.records, packageCopyItems);
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
  var out = [];
  items.forEach(function(x) {
    var s = String(x || '').replace(/\s+/g, ' ').trim();
    if (!s) return;
    out.push(s);
  });
  return out;
}

function convEnf_isOptionalLikeItem_(text) {
  var s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return false;
  var lc = s.toLowerCase();
  if (/^optional[:\s-]/i.test(s)) return true;
  if (/\bif selected\b/.test(lc)) return true;
  if (/\b(optional|add-?on|addon|extra|upgrade|supplement)\b/.test(lc)) return true;
  if (/\b(additional cost|extra charge|at extra cost)\b/.test(lc)) return true;
  if (/\bfts\b/.test(lc) && /\b(scarf|scarve|scarfes|scarves|oils?)\b/.test(lc)) return true;
  return false;
}

function convEnf_filterOptionalLikeItemsFromIncluded_(items) {
  if (!Array.isArray(items)) return items;
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var t = String(items[i] || '').trim();
    if (!t) continue;
    if (convEnf_isOptionalLikeItem_(t)) continue;
    out.push(t);
  }
  return out;
}

function convEnf_detectEntranceFeesTruth_(included, excluded) {
  var incText = (Array.isArray(included) ? included.join(' | ') : String(included || '')).toLowerCase();
  var excText = (Array.isArray(excluded) ? excluded.join(' | ') : String(excluded || '')).toLowerCase();
  var incHas = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(incText);
  var excHas = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(excText);
  var excSaysNotIncluded = excHas && /\b(not included|excluded)\b/.test(excText);
  var incSaysNotIncluded = incHas && /\b(not included|excluded)\b/.test(incText);
  var includedTruth = incHas && !incSaysNotIncluded;
  var excludedTruth = excHas || incSaysNotIncluded || excSaysNotIncluded;
  return { included: includedTruth && !excludedTruth, excluded: excludedTruth && !includedTruth, ambiguous: !includedTruth && !excludedTruth };
}

function convEnf_detectGuideTruth_(included, excluded, evidenceText) {
  var incText = (Array.isArray(included) ? included.join(' | ') : String(included || '')).toLowerCase();
  var excText = (Array.isArray(excluded) ? excluded.join(' | ') : String(excluded || '')).toLowerCase();
  var ev = String(evidenceText || '').toLowerCase();
  var hasGuideInInc = /\b(egyptologist|tour guide|guide)\b/.test(incText);
  var hasGuideInExc = /\b(egyptologist|tour guide|guide)\b/.test(excText);
  var incConditional = hasGuideInInc && /\b(if selected|optional|depending on the option)\b/.test(incText);
  var evOptional = /\bguide\b/.test(ev) && /\b(if selected|optional|depending on the option)\b/.test(ev);
  var includedTruth = hasGuideInInc && !incConditional && !hasGuideInExc;
  var optionalTruth = incConditional || evOptional;
  return { included: includedTruth, optional: optionalTruth && !includedTruth, ambiguous: !includedTruth && !optionalTruth };
}

function convEnf_applyGuideTruthToText_(text, truth) {
  var s = String(text || '');
  if (!s.trim()) return '';
  if (truth && truth.included) return s;
  s = s
    .replace(/\byour\s+expert\s+egyptologist\s+guide\b/ig, 'If selected, an Egyptologist guide')
    .replace(/\bexpert\s+egyptologist\s+guide\b/ig, 'Egyptologist guide (depending on the option selected)')
    .replace(/\bexpert\s+guidance\b/ig, 'guiding (depending on the option selected)')
    .replace(/\bexpert\s+guide\b/ig, 'guide (depending on the option selected)');
  return s.replace(/\s+/g, ' ').trim();
}

function convEnf_applyGuideTruthToHighlights_(highlights, truth) {
  if (!Array.isArray(highlights)) return highlights;
  if (truth && truth.included) return highlights;
  var out = [];
  for (var i = 0; i < highlights.length; i++) {
    var s = String(highlights[i] || '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    s = convEnf_applyGuideTruthToText_(s, truth);
    if (!s) continue;
    out.push(s);
  }
  return out;
}

function convEnf_applyEntranceFeesTruthToHighlights_(highlights, truth) {
  if (!Array.isArray(highlights)) return highlights;
  if (!truth || (!truth.included && !truth.excluded)) return highlights;
  var out = [];
  for (var i = 0; i < highlights.length; i++) {
    var s = String(highlights[i] || '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    var lc = s.toLowerCase();
    var mentionsEntrance = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(lc);
    if (!mentionsEntrance) { out.push(s); continue; }
    if (truth.excluded || truth.ambiguous) {
      s = s
        .replace(/,?\s*(and\s+)?all\s+entrance\s+(tickets|fees)\s+included\.?/ig, '')
        .replace(/,?\s*(and\s+)?entrance\s+(tickets|fees)\s+included\.?/ig, '')
        .replace(/\b(all\s+)?entrance\s+(tickets|fees)\s+included\b/ig, '')
        .replace(/\s+/g, ' ')
        .trim();
      s = s.replace(/\s*[,.]\s*$/g, '').trim();
      if (!s) continue;
      out.push(s);
      continue;
    }
    out.push(s);
  }
  return out;
}

function convEnf_applyEntranceFeesTruthToText_(text, truth) {
  var s = String(text || '');
  if (!s.trim()) return '';
  if (!truth || (!truth.included && !truth.excluded)) return s;
  if (truth.excluded || truth.ambiguous) {
    s = s
      .replace(/\b(all\s+)?entrance\s+(tickets|fees)\s+included\b/ig, 'site visits as per itinerary')
      .replace(/\bentrance\s+(tickets|fees)\s+are\s+included\b/ig, 'site visits are as per itinerary')
      .replace(/\b(includes?|including)\s+(all\s+)?entrance\s+(tickets|fees)\b/ig, 'includes site visits as per itinerary');
  }
  if (truth.included) {
    s = s.replace(/\b(entrance\s+(tickets|fees)|tickets?|admission)\s+are\s+not\s+included\b/ig, "attraction entrance fees are included as listed in What's Included");
  }
  return s.replace(/\s+/g, ' ').trim();
}

function convEnf_filterUnsupportedItems_(items, flags) {
  if (!Array.isArray(items)) return items;
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var s = String(items[i] || '').trim();
    if (!s) continue;
    if (convEnf_hasUnsupportedHighRiskClaims_(s, flags)) continue;
    out.push(s);
  }
  return out;
}

function convEnf_removeIncExcOverlap_(included, excluded) {
  var inc = Array.isArray(included) ? included : [];
  var exc = Array.isArray(excluded) ? excluded : [];
  var incKeys = {};
  for (var i = 0; i < inc.length; i++) {
    var k = String(inc[i] || '').replace(/^optional[:\s-]/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!k) continue;
    incKeys[k] = true;
  }
  var outExc = [];
  for (var j = 0; j < exc.length; j++) {
    var s = String(exc[j] || '').trim();
    if (!s) continue;
    var k2 = s.replace(/^optional[:\s-]/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (k2 && incKeys[k2]) continue;
    outExc.push(s);
  }
  return { included: inc, excluded: outExc };
}

function convEnf_getGuaranteedItems_(items) {
  if (!Array.isArray(items)) return [];
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var s = String(items[i] || '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    if (/^optional[:\s-]/i.test(s)) continue;
    out.push(s);
  }
  return out;
}

function convEnf_buildStandardContext_(payload) {
  var p = payload || {};
  var trip = p.trip || {};
  var seo = p.seo || {};

  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function stripHtml_(s) { return norm_(String(s || '').replace(/<[^>]*>/g, ' ')); }
  function listToText_(arr, max) {
    if (!Array.isArray(arr) || !arr.length) return '';
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var t = stripHtml_(arr[i]);
      if (!t) continue;
      out.push(t);
      if (typeof max === 'number' && out.length >= max) break;
    }
    return out.join(' | ');
  }

  var highlightsText = listToText_(p.highlights, 20);
  var includedText = listToText_(p.included, 80);
  var excludedText = listToText_(p.excluded, 80);

  var itineraryText = '';
  if (Array.isArray(p.itinerary)) {
    var parts = [];
    for (var iIt = 0; iIt < p.itinerary.length; iIt++) {
      var st = p.itinerary[iIt] || {};
      var title = stripHtml_(st.step_title || st.title || '');
      var desc = stripHtml_(st.step_description || st.desc || '');
      var chunk = norm_((title ? (title + ': ') : '') + desc);
      if (!chunk) continue;
      parts.push(chunk);
      if (parts.length >= 25) break;
    }
    itineraryText = parts.join(' | ');
  }

  var faqsText = '';
  if (Array.isArray(p.faqs)) {
    var partsF = [];
    for (var iF = 0; iF < p.faqs.length; iF++) {
      var f = p.faqs[iF] || {};
      var q = stripHtml_(f.question || f.q || '');
      var a = stripHtml_(f.answer || f.a || '');
      var chunkF = norm_((q ? (q + ' — ') : '') + a);
      if (!chunkF) continue;
      partsF.push(chunkF);
      if (partsF.length >= 20) break;
    }
    faqsText = partsF.join(' | ');
  }

  var packagesText = '';
  if (Array.isArray(p.packages)) {
    var partsP = [];
    for (var iP = 0; iP < p.packages.length; iP++) {
      var pkg = p.packages[iP] || {};
      var titleP = stripHtml_(pkg.PackageTitle || pkg.title || '');
      var excerptP = stripHtml_(pkg.excerpt || pkg.Excerpt || '');
      var htmlP = stripHtml_(pkg.content_html || pkg.CONTENT_HTML || pkg.content || '');
      var chunkP = norm_([titleP, excerptP, htmlP].filter(function(x) { return !!x; }).join(' — '));
      if (!chunkP) continue;
      partsP.push(chunkP);
      if (partsP.length >= 20) break;
    }
    packagesText = partsP.join(' | ');
  }

  var seoTitle = norm_(seo.title);
  var seoMeta = norm_(seo.meta_description);
  var seoExcerpt = norm_(seo.excerpt || seo.short_summary);

  var descriptionText = stripHtml_(p.description || '');
  var whyText = stripHtml_(p.why_people_love || '');

  var evidenceText = norm_([
    trip.Title,
    trip.TourType,
    seoTitle,
    seoMeta,
    seoExcerpt,
    descriptionText,
    whyText,
    highlightsText,
    itineraryText,
    includedText,
    excludedText,
    faqsText,
    packagesText
  ].filter(function(x) { return !!x; }).join(' | '));

  var strictEvidenceText = norm_([
    trip.Title,
    trip.TourType,
    descriptionText,
    highlightsText,
    itineraryText,
    excludedText,
    packagesText
  ].filter(function(x) { return !!x; }).join(' | '));

  var lc = strictEvidenceText.toLowerCase();
  var slugLc = String(trip.Slug || '').toLowerCase();
  var civFromSlug = (slugLc.indexOf('civilization') !== -1 && slugLc.indexOf('museum') !== -1) || /\bnmec\b/.test(slugLc);
  var flags = {
    has_nile: /\bnile\b/.test(lc),
    has_felucca: /\b(felucca|faluka)\b/.test(lc),
    has_boat: /\bboat\b/.test(lc),
    has_cruise: /\bcruise\b/.test(lc),
    has_flights: /\b(flight|flights|airfare|air ticket|air tickets)\b/.test(lc),
    has_snorkel: /\b(snorkel|snorkeling|diving)\b/.test(lc),
    has_safari: /\b(safari|quad|atv)\b/.test(lc),
    has_private: /\bprivate\b/.test(lc),
    has_tickets: /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(lc),
    has_lunch: /\blunch\b/.test(lc),
    has_pickup: /\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/.test(lc),
    has_egyptian_museum: /\begyptian museum\b/.test(lc),
    has_civ_museum: civFromSlug || /\b(egyptian civilization museum|museum of egyptian civilization|national museum of egyptian civilization|civilization museum|nmec)\b/.test(lc),
    civ_context_slug: civFromSlug,
    has_languages: /\b(language|languages|english|french|german|spanish|italian|arabic)\b/.test(lc),
    has_group_size: /\b(group size|max|maximum|small group|up to \d+|\d+ travelers|\d+ people|\d+ persons)\b/.test(lc)
  };

  return {
    trip: {
      id: String(trip.id || ''),
      title: String(trip.Title || ''),
      tour_type: String(trip.TourType || ''),
      slug: String(trip.Slug || ''),
      duration_hours: String(trip.Duration_Hours || ''),
      duration_minutes: String(trip.Duration_Minutes || ''),
      duration_unit: String(trip.Duration_Unit || '')
    },
    seo: {
      title: seoTitle,
      meta_description: seoMeta,
      excerpt: seoExcerpt,
      focus_keywords: norm_(seo.focus_keywords || ''),
      permalink: norm_(seo.permalink || '')
    },
    evidence: {
      description: descriptionText,
      why_people_love: whyText,
      highlights: highlightsText,
      itinerary: itineraryText,
      included: includedText,
      excluded: excludedText,
      faqs: faqsText,
      packages: packagesText,
      combined: evidenceText,
      strict_combined: strictEvidenceText
    },
    flags: flags
  };
}

function convEnf_sanitizePackageCopyItems_(items, flags, evidence) {
  if (!Array.isArray(items)) return null;
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var rid = String(it.airtable_record_id || it.record_id || it.id || '').trim();
    var excerpt = String(it.excerpt || '').replace(/\s+/g, ' ').trim();
    var content = String(it.content_html || it.content || '').trim();
    var action = String(it.action || '').trim();
    var reason = String(it.reason || '').trim();
    var severity = String(it.severity || '').trim();
    if (!rid) continue;
    if (excerpt) excerpt = convEnf_rewriteUnsupportedContentText_(excerpt, flags, evidence);
    if (content) content = convEnf_rewriteUnsupportedContentText_(convEnf_sanitizeHtml_(content), flags, evidence);
    out.push({ airtable_record_id: rid, excerpt: excerpt, content_html: content, action: action, reason: reason, severity: severity });
  }
  return out;
}

function convEnf_isPlaceholderText_(s) {
  var t = String(s || '').trim();
  if (!t) return true;
  if (/^\*{3,}$/.test(t)) return true;
  if (/(k){5,}/i.test(t)) return true;
  if (/(x){5,}/i.test(t)) return true;
  if (t.length < 10) return true;
  return false;
}

function convEnf_updatePackagesCopy_(existingRecords, packageCopyItems) {
  var recs = Array.isArray(existingRecords) ? existingRecords : [];
  var byId = {};
  for (var i = 0; i < recs.length; i++) {
    var r = recs[i];
    if (r && r.id) byId[String(r.id)] = r;
  }
  for (var j = 0; j < packageCopyItems.length; j++) {
    var it = packageCopyItems[j] || {};
    var rid = String(it.airtable_record_id || '').trim();
    if (!rid || !byId[rid]) continue;
    var fields = {};
    var current = byId[rid].fields || {};
    var allowOverwrite = convEnf_shouldOverwriteLockedField_(it, current);
    if (it.excerpt && (convEnf_isPlaceholderText_(current.excerpt) || allowOverwrite)) fields.excerpt = it.excerpt;
    if (it.content_html && (convEnf_isPlaceholderText_(current.content_html) || allowOverwrite)) fields.content_html = it.content_html;
    if (Object.keys(fields).length) {
      convEnf_logAirtableFields_('UPDATE', 'Packages', rid, fields);
      airtableUpdate_('Packages', rid, fields);
    }
  }
}

function convEnf_shouldOverwriteLockedField_(aiItem, currentFields) {
  var it = aiItem || {};
  var cur = currentFields || {};
  var action = String(it.action || '').toLowerCase().trim();
  var reasonLc = String(it.reason || '').toLowerCase().trim();
  var severityLc = String(it.severity || '').toLowerCase().trim();
  var curExcerpt = String(cur.excerpt || '').trim();
  var curHtml = String(cur.content_html || '').trim();
  var isLocked = (!convEnf_isPlaceholderText_(curExcerpt) || !convEnf_isPlaceholderText_(curHtml));
  if (!isLocked) return true;
  if (action !== 'rewrite') return false;
  if (/(hallucination|mismatch|inconsistent|violation|unsupported|contradict)/.test(reasonLc)) return true;
  if (severityLc === 'high' || severityLc === 'critical') return true;
  return false;
}

function convEnf_hasUnsupportedHighRiskClaims_(text, flags) {
  var t = String(text || '').toLowerCase();
  var f = (flags && typeof flags === 'object') ? flags : {};
  if (!f.has_nile && /\bnile\b/.test(t)) return true;
  if (!f.has_felucca && /\b(felucca|faluka)\b/.test(t)) return true;
  if (!f.has_boat && /\bboat\b/.test(t)) return true;
  if (!f.has_cruise && /\bcruise\b/.test(t)) return true;
  if (!f.has_flights && /\b(flight|flights|airfare|air ticket|air tickets)\b/.test(t)) return true;
  if (!f.has_snorkel && /\b(snorkel|snorkeling|diving)\b/.test(t)) return true;
  if (!f.has_safari && /\b(safari|quad|atv)\b/.test(t)) return true;
  if (!f.has_private && /\bprivate\b/.test(t)) return true;
  if (!f.has_tickets && /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(t)) return true;
  if (!f.has_lunch && /\blunch\b/.test(t)) return true;
  if (!f.has_pickup && /\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/.test(t)) return true;
  return false;
}

function convEnf_joinListWithAmp_(items) {
  var xs = (Array.isArray(items) ? items : []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (xs.length <= 1) return xs.join('');
  if (xs.length === 2) return xs[0] + ' & ' + xs[1];
  return xs.slice(0, xs.length - 1).join(', ') + ' & ' + xs[xs.length - 1];
}

function convEnf_extractAttractionsFromTripTitle_(title) {
  var t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  var rhs = t;
  if (t.indexOf(':') !== -1) rhs = String(t.split(':').slice(1).join(':') || '').trim();
  rhs = rhs.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  rhs = rhs.replace(/\s*&\s*/g, ', ').replace(/\s+and\s+/gi, ', ');
  var parts = rhs.split(',').map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p) continue;
    if (p.length > 48) continue;
    var key = p.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(p);
    if (out.length >= 3) break;
  }
  return out;
}

function convEnf_extractPrimaryFromTitle_(title) {
  var t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.indexOf(':') !== -1) return String(t.split(':')[0] || '').trim();
  if (t.indexOf(' - ') !== -1) return String(t.split(' - ')[0] || '').trim();
  if (t.indexOf(' | ') !== -1) return String(t.split(' | ')[0] || '').trim();
  return '';
}

function convEnf_buildUspSuffixFromFlags_(flags) {
  var f = (flags && typeof flags === 'object') ? flags : {};
  var hasLunch = !!f.has_lunch;
  var hasPickup = !!f.has_pickup;
  if (hasLunch && hasPickup) return 'with Lunch & Hotel Pickup';
  if (hasLunch) return 'with Lunch';
  if (hasPickup) return 'with Hotel Pickup';
  return '';
}

function convEnf_fixTripTypeCasing_(text) {
  var s = convEnf_sanitizeSeoText_(text);
  if (!s) return '';
  s = s.replace(/\bday tour\b/ig, 'Day Tour');
  return s;
}

function convEnf_dedupeEgyptianPrefix_(text) {
  var s = convEnf_sanitizeSeoText_(text);
  if (!s) return '';
  s = s.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ');
  return s;
}

function convEnf_normalizeCivMuseumText_(text) {
  var s = convEnf_sanitizeSeoText_(text);
  if (!s) return '';
  s = convEnf_dedupeEgyptianPrefix_(s);
  s = s.replace(/\b(Egyptian\s+)?Civilization Museum\b/gi, 'Egyptian Civilization Museum');
  s = s.replace(/\bEgyptian Museum\b/gi, 'Egyptian Civilization Museum');
  s = convEnf_dedupeEgyptianPrefix_(s);
  return s;
}

function convEnf_stripTrailingUspFragmentFromH1_(text) {
  var s = convEnf_sanitizeSeoText_(text);
  if (!s) return { main: '', tailLunch: false, tailPickup: false };
  s = s.replace(/\s*&\s*$/g, '').trim();
  s = s.replace(/\bwith\s+lunch\s*&\s*(?:h|ho|hot|hote|hotel)?\s*$/i, '').trim();

  var tailFull = /\bwith\s+lunch\s*&\s*hotel\s*pick-?up\b\s*$/i.test(s);
  var tailLunch = tailFull || /\bwith\s+lunch\b\s*$/i.test(s);
  var tailPickup = tailFull || /\bwith\s+hotel\s*pick-?up\b\s*$/i.test(s);

  s = s.replace(/\bwith\s+lunch\s*&\s*hotel\s*pick-?up\b\s*$/i, '').trim();
  s = s.replace(/\bwith\s+hotel\s*pick-?up\b\s*$/i, '').trim();
  s = s.replace(/\bwith\s+lunch\b\s*$/i, '').trim();

  s = s.replace(/\bwith\s+(?:l|lu|lun|lunc|h|ho|hot|hote|hotel)\s*$/i, '').trim();
  s = s.replace(/\bwith\s*$/i, '').trim();
  s = s.replace(/[|—–\-:;,]\s*$/g, '').trim();
  s = s.replace(/\s*&\s*$/g, '').trim();

  return { main: s, tailLunch: tailLunch, tailPickup: tailPickup };
}

function convEnf_truncateH1AtWordBoundary_(text, maxLen) {
  var t = convEnf_sanitizeSeoText_(text);
  if (!t) return '';
  if (!maxLen || t.length <= maxLen) return t;
  var cut = t.substring(0, maxLen);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= 12) return cut.substring(0, lastSpace).trim().replace(/[,\-–—:;]\s*$/g, '');
  return cut.trim().replace(/[,\-–—:;]\s*$/g, '');
}

function convEnf_finalizeH1Quality_(h1, maxLen, src) {
  var t = convEnf_sanitizeSeoText_(h1);
  if (!t) return '';
  var n = (typeof maxLen === 'number' && isFinite(maxLen) && maxLen > 0) ? Math.floor(maxLen) : 0;
  var source = String(src || '');
  for (var i = 0; i < 4; i++) {
    t = t.replace(/\s+[|—–\-:;,]\s*$/g, '').trim();
    t = t.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim();
    t = t.replace(/\s*\+\s*$/g, '').trim();
    t = t.replace(/\s*&\s*$/g, '').trim();
    t = t.replace(/\bwith\s+(?:l|lu|lun|lunc|h|ho|hot|hote|hotel)\s*$/i, '').trim();
    t = t.replace(/\bwith\s*$/i, '').trim();
    t = t.replace(/\b(and|or|but)\s*$/i, '').trim();
  }
  if (/old cairo/i.test(source)) {
    t = t.replace(/\bold\s+cair\b/ig, 'Old Cairo');
    t = t.replace(/\bold\s+cai\b/ig, 'Old Cairo');
  }
  if (/\bold\s+cai(?:r)?$/i.test(t) && !/\bold\s+cairo$/i.test(t)) {
    if (/old cairo/i.test(source)) {
      var rep = t.replace(/\bold\s+cai(?:r)?$/i, 'Old Cairo');
      if (!n || rep.length <= n) t = rep;
      else t = t.replace(/\bold\s+cai(?:r)?$/i, 'Old').trim();
    }
  }
  if (/\bold$/i.test(t)) {
    if (/old cairo/i.test(source)) {
      if (!n || t.length + 6 <= n) t = (t + ' Cairo').trim();
      else t = t.replace(/\bold$/i, '').replace(/[,&]\s*$/g, '').trim();
    }
  }
  t = t.replace(/\bwith\s+with\b/ig, 'with');
  if (n && t.length > n) t = convEnf_truncateH1AtWordBoundary_(t, n);
  t = t.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim();
  t = t.replace(/\s*&\s*$/g, '').trim();
  return t;
}

function convEnf_forceUspSuffixIntoH1_(h1, flags) {
  var raw = convEnf_dedupeEgyptianPrefix_(h1);
  var split = convEnf_stripTrailingUspFragmentFromH1_(raw);
  var base = split.main;
  if (!base) return '';

  var uspFull = convEnf_buildUspSuffixFromFlags_(flags);
  if (!uspFull) return convEnf_truncateH1AtWordBoundary_(base, 90).replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim();

  var maxLen = 90;
  var reserved = uspFull.length + 1;
  var baseMax = maxLen - reserved;
  if (baseMax < 12) return convEnf_truncateH1AtWordBoundary_(base, maxLen).replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim();

  var shortBase = convEnf_truncateH1AtWordBoundary_(base, baseMax);
  shortBase = shortBase.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim();
  shortBase = shortBase.replace(/\s*&\s*$/g, '').trim();
  shortBase = shortBase.replace(/\bwith\s+(?:l|lu|lun|lunc|h|ho|hot|hote|hotel)\s*$/i, '').trim();
  shortBase = shortBase.replace(/\bwith\s*$/i, '').trim();
  if (!shortBase) return convEnf_truncateH1AtWordBoundary_(base, maxLen).replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim();

  var cand = (shortBase + ' ' + uspFull).replace(/\s+/g, ' ').trim();
  cand = cand.replace(/\bwith\s+with\b/ig, 'with');
  cand = cand.replace(/\s*&\s*$/g, '').trim();
  return cand;
}

function convEnf_buildH1Fallback_(payload, flags, seoTitle) {
  var p = payload || {};
  var trip = p.trip || {};
  var pSeo = p.seo || {};
  var primary = String(pSeo.focus_keywords || '').replace(/\s+/g, ' ').trim();
  if (!primary) primary = convEnf_extractPrimaryFromTitle_(seoTitle);
  if (!primary) primary = convEnf_extractPrimaryFromTitle_(trip.Title);
  if (!primary) primary = String(seoTitle || trip.Title || '').replace(/\s+/g, ' ').trim();
  if (!primary) return '';
  var atts = convEnf_extractAttractionsFromTripTitle_(trip.Title);
  var h1 = primary;
  if (atts.length) h1 = primary + ': ' + convEnf_joinListWithAmp_(atts);
  h1 = convEnf_truncateText_(h1, 90);
  h1 = h1.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim();
  h1 = convEnf_fixTripTypeCasing_(h1);
  h1 = convEnf_forceUspSuffixIntoH1_(h1, flags);
  return h1;
}

function convEnf_finalizeSeoFields_(ai, payload, flags) {
  var out = { h1: '', title: '', meta_description: '', excerpt: '', short_summary: '' };
  var pSeo = (payload && payload.seo) ? payload.seo : {};
  var aiH1 = convEnf_getString_(ai, ['seo', 'h1', 'text']);
  var aiTitle = convEnf_getString_(ai, ['seo', 'title', 'text']);
  var aiMeta = convEnf_getString_(ai, ['seo', 'meta_description', 'text']);
  var aiExcerpt = convEnf_getString_(ai, ['seo', 'excerpt', 'text']);
  var aiShort = convEnf_getString_(ai, ['seo', 'short_summary', 'text']);

  var fallbackH1 = String(pSeo.h1 || '').trim();
  var fallbackTitle = String(pSeo.title || (payload && payload.trip ? payload.trip.Title : '') || '').trim();
  var fallbackMeta = String(pSeo.meta_description || pSeo.excerpt || pSeo.short_summary || '').trim();
  var fallbackExcerpt = String(pSeo.excerpt || pSeo.short_summary || '').trim();

  var h1Candidate = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiH1 || fallbackH1), flags);
  if (!h1Candidate || h1Candidate.length < 15) h1Candidate = convEnf_buildH1Fallback_(payload, flags, aiTitle || fallbackTitle);
  h1Candidate = convEnf_fixTripTypeCasing_(h1Candidate);
  if (flags && flags.civ_context_slug) {
    h1Candidate = convEnf_normalizeCivMuseumText_(h1Candidate);
  }
  h1Candidate = convEnf_forceUspSuffixIntoH1_(h1Candidate, flags);
  h1Candidate = convEnf_truncateH1AtWordBoundary_(convEnf_sanitizeSeoText_(h1Candidate), 90);
  h1Candidate = h1Candidate.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim();
  var h1Src = String((payload && payload.trip ? payload.trip.Title : '') || '') + ' ' + String(aiH1 || '') + ' ' + String(aiTitle || '');
  out.h1 = convEnf_finalizeH1Quality_(h1Candidate, 90, h1Src);

  out.title = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiTitle || fallbackTitle), flags);
  if (!out.title || out.title.length < 20) out.title = convEnf_sanitizeSeoText_(fallbackTitle);
  out.title = convEnf_optimizeSeoTitleForSerp_(out.title, payload, flags);

  out.meta_description = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiMeta || fallbackMeta), flags);
  out.meta_description = convEnf_truncateText_(out.meta_description, 160);
  out.meta_description = convEnf_finalizeMetaDescriptionQuality_(out.meta_description, 160);
  out.meta_description = convEnf_optimizeMetaDescriptionForKeyword_(out.meta_description, payload, 160, flags);
  if (!out.meta_description || out.meta_description.length < 60) {
    var fromDesc = convEnf_sanitizeSeoText_(String((payload && payload.description) || '').replace(/<[^>]*>/g, ' '));
    var cleaned = convEnf_truncateText_(convEnf_removeUnsupportedHighRiskParts_(fromDesc, flags), 160);
    cleaned = convEnf_finalizeMetaDescriptionQuality_(cleaned, 160);
    if (cleaned && cleaned.length >= 60) out.meta_description = cleaned;
  }
  out.meta_description = convEnf_optimizeMetaDescriptionForKeyword_(out.meta_description, payload, 160, flags);

  out.excerpt = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiExcerpt || fallbackExcerpt), flags);
  out.excerpt = convEnf_truncateText_(out.excerpt, 220);

  out.short_summary = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiShort || fallbackExcerpt), flags);
  out.short_summary = convEnf_truncateText_(out.short_summary, 240);

  return out;
}

function convEnf_sanitizeSeoText_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function convEnf_buildSeoEvidenceText_(payload) {
  try {
    var p = payload || {};
    var trip = p.trip || {};
    var parts = [
      trip.Title,
      p.title,
      p.description,
      (p.seo ? p.seo.h1 : ''),
      (p.seo ? p.seo.title : ''),
      (p.seo ? p.seo.meta_description : ''),
      (p.seo ? p.seo.excerpt : ''),
      (p.seo ? p.seo.short_summary : '')
    ];
    return String(parts.filter(function(x) { return x != null && x !== ''; }).join(' ')).replace(/\s+/g, ' ').trim();
  } catch (e) {
    return '';
  }
}

function convEnf_optimizeSeoTitleForSerp_(title, payload, flags) {
  var t = convEnf_sanitizeSeoText_(title);
  if (!t) return '';
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ');
  var f = (flags && typeof flags === 'object') ? flags : {};
  var civ = !!(f.civ_context_slug || f.has_civ_museum);
  if (civ && /\bcivilization museum\b/i.test(t) && !/egyptian civilization museum/i.test(t)) {
    t = t.replace(/\bCivilization Museum\b/ig, 'Egyptian Civilization Museum');
  }
  if (civ && !/egyptian civilization museum/i.test(t) && /egyptian museum/i.test(t)) {
    t = t.replace(/egyptian museum/ig, 'Egyptian Civilization Museum');
  } else if (!civ && f.has_egyptian_museum && /egyptian civilization museum/i.test(t)) {
    t = t.replace(/egyptian civilization museum/ig, 'Egyptian Museum');
  }
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ');
  t = t.replace(/\s+and\s+/ig, ' & ');
  t = t.replace(/\s+/g, ' ').trim();
  var target = 60;
  if (t.length > target) {
    t = t
      .replace(/\s+with\s+lunch\s*(?:&|and)?\s*hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '')
      .replace(/\s+with\s+hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '')
      .replace(/\s+with\s+lunch\b/ig, '')
      .replace(/\s*&\s*hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '')
      .replace(/\s+hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/[|—–\-:;,]\s*$/g, '').trim();
  }
  if (t.length > target) t = convEnf_truncateText_(t, target);
  if (/\bold$/i.test(t)) {
    var src = String((payload && payload.trip ? payload.trip.Title : '') || '') + ' ' + String(title || '');
    if (/old cairo/i.test(src)) {
      if (t.length + 6 <= target) t = (t + ' Cairo').trim();
      else t = t.replace(/\bold$/i, '').replace(/[,&]\s*$/g, '').trim();
    }
  }
  return t;
}

function convEnf_optimizeMetaDescriptionForKeyword_(meta, payload, maxLen, flags) {
  var t = convEnf_sanitizeSeoText_(meta);
  if (!t) return '';
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ');
  var f = (flags && typeof flags === 'object') ? flags : {};
  var civ = !!(f.civ_context_slug || f.has_civ_museum);
  if (!civ && f.has_egyptian_museum && /egyptian civilization museum/i.test(t)) {
    var rep0 = t.replace(/egyptian civilization museum/ig, 'Egyptian Museum');
    rep0 = convEnf_finalizeMetaDescriptionQuality_(rep0, maxLen);
    if (rep0 && rep0.length <= maxLen) return rep0;
  }
  if (!civ) return t;
  if (/egyptian civilization museum/i.test(t) || /national museum of egyptian civilization/i.test(t) || /museum of egyptian civilization/i.test(t)) return t;
  var keyword = 'Egyptian Civilization Museum';
  if (/\bcivilization museum\b/i.test(t) && !/egyptian civilization museum/i.test(t)) {
    var rep2 = t.replace(/\bCivilization Museum\b/i, keyword);
    rep2 = convEnf_finalizeMetaDescriptionQuality_(rep2, maxLen);
    if (rep2 && rep2.length <= maxLen) return rep2;
  }
  if (/egyptian museum/i.test(t)) {
    var rep = t.replace(/egyptian museum/i, keyword);
    rep = convEnf_finalizeMetaDescriptionQuality_(rep, maxLen);
    if (rep && rep.length <= maxLen) return rep;
  }
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ');
  return t;
}

function convEnf_finalizeMetaDescriptionQuality_(s, maxLen) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';

  t = t.replace(/[|—–\-:;,]\s*$/g, '').trim();
  if (!t) return '';

  var lastIncludesIdx = -1;
  var re = /\bincludes\b/ig;
  var m;
  while ((m = re.exec(t)) !== null) lastIncludesIdx = m.index;

  if (lastIncludesIdx >= 0) {
    var tailLen = t.length - lastIncludesIdx;
    var endsWithPunct = /[.!?]$/.test(t);
    if (!endsWithPunct && tailLen <= 28) {
      t = t.substring(0, lastIncludesIdx).replace(/[,\-–—:;]\s*$/g, '').trim();
    }
  }

  t = t.replace(/\b(and|with|including|plus|also|to|in|at|on|for|from|by|of|the|a|an)\s*$/i, '').trim();
  t = t.replace(/[|—–\-:;,]\s*$/g, '').trim();

  if (t && !/[.!?]$/.test(t) && (typeof maxLen !== 'number' || t.length + 1 <= maxLen)) {
    t = t + '.';
  }

  if (typeof maxLen === 'number' && isFinite(maxLen) && maxLen > 0) {
    t = convEnf_truncateText_(t, maxLen);
  }

  return t;
}

function convEnf_truncateText_(s, maxLen) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (!maxLen || t.length <= maxLen) return t;
  var cut = t.substring(0, maxLen);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= 80) return cut.substring(0, lastSpace).trim().replace(/[,\-–—:;]\s*$/g, '');
  return cut.trim().replace(/[,\-–—:;]\s*$/g, '');
}

function convEnf_removeUnsupportedHighRiskParts_(text, flags) {
  var t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (!convEnf_hasUnsupportedHighRiskClaims_(t, flags)) return t;
  var parts = t.split(/[|•]|(?:\s+[–—-]\s+)|(?:\s*;\s*)|[.!?]\s+/).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  var kept = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (convEnf_hasUnsupportedHighRiskClaims_(p, flags)) continue;
    kept.push(p);
  }
  var out = kept.join('. ').replace(/\s+/g, ' ').trim();
  out = out.replace(/^(and|with|including|plus|also)\b\s*/i, '');
  out = out.replace(/[,\-–—:;]\s*$/g, '').trim();
  return out;
}

function convEnf_sanitizeStringList_(arr, opts) {
  if (!Array.isArray(arr)) return null;
  opts = opts || {};
  var max = (typeof opts.max === 'number' && isFinite(opts.max) && opts.max > 0) ? Math.floor(opts.max) : null;
  var out = [];
  var seen = {};
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] || '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    var key = s.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(s);
    if (max && out.length >= max) break;
  }
  return out;
}

function convEnf_sanitizeHtml_(html) {
  var s = String(html || '').trim();
  if (!s) return '';
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');
  s = s.replace(/\u0000/g, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  if (s.indexOf('<p') === -1) {
    var parts = s.split(/\n{2,}/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = String(parts[i] || '').trim();
      if (!p) continue;
      out.push('<p>' + p + '</p>');
    }
    s = out.join('');
  }
  return s.trim();
}

function convEnf_logAirtableFields_(action, tableName, recordId, fields) {
  try {
    var f = fields && typeof fields === 'object' ? fields : {};
    var keys = Object.keys(f);
    keys.sort();
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = f[k];
      convEnf_logFieldChange_(action, tableName, recordId, k, v);
    }
  } catch (e) {}
}

function convEnf_logFieldChange_(action, tableName, recordId, fieldName, value) {
  try {
    var act = String(action || 'WRITE');
    var tbl = String(tableName || '');
    var rid = recordId ? (' [' + String(recordId) + ']') : '';
    var key = String(fieldName || '');
    var prefix = '🧾 ' + act + ' ' + tbl + rid + ' :: ' + key;

    if (value === null) { Logger.log(prefix + ' = null'); return; }
    if (value === undefined) { Logger.log(prefix + ' = undefined'); return; }
    if (typeof value === 'number' || typeof value === 'boolean') { Logger.log(prefix + ' = ' + String(value)); return; }

    if (Array.isArray(value)) {
      Logger.log(prefix + ' (array items=' + String(value.length) + '):');
      for (var i = 0; i < value.length; i++) {
        var item = value[i];
        var line = '';
        if (item === null) line = 'null';
        else if (item === undefined) line = 'undefined';
        else if (typeof item === 'object') { try { line = JSON.stringify(item); } catch (e0) { line = '[object]'; } }
        else line = String(item);
        convEnf_logChunks_(prefix + ' [' + String(i) + '] = ', line);
      }
      return;
    }

    if (typeof value === 'object') {
      var js = '';
      try { js = JSON.stringify(value); } catch (e1) { js = '[object]'; }
      Logger.log(prefix + ' (json len=' + String(js.length) + '):');
      convEnf_logChunks_(prefix + ' = ', js);
      return;
    }

    var s = String(value);
    Logger.log(prefix + ' (len=' + String(s.length) + '):');
    convEnf_logChunks_(prefix + ' = ', s);
  } catch (e2) {}
}

function convEnf_logChunks_(linePrefix, text) {
  try {
    var p = String(linePrefix || '');
    var s = String(text || '');
    var chunkSize = 900;
    if (!s) { Logger.log(p + '""'); return; }
    for (var i = 0; i < s.length; i += chunkSize) {
      Logger.log(p + s.substring(i, i + chunkSize));
    }
  } catch (e) {}
}

function convEnf_formatLogValue_(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) {
    var parts = v.map(function(x) { return String(x); });
    var joined = parts.join(',');
    if (joined.length > 140) joined = joined.substring(0, 140) + '…';
    return '[ ' + joined + ' ]';
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    try {
      var js = JSON.stringify(v);
      if (js.length > 180) js = js.substring(0, 180) + '…';
      return js;
    } catch (e) {
      return '[object]';
    }
  }
  var s = String(v);
  var oneLine = s.replace(/\s+/g, ' ').trim();
  if (oneLine.length > 180) oneLine = oneLine.substring(0, 180) + '…';
  return '"' + oneLine + '"' + ' (len=' + String(s.length) + ')';
}

function convEnf_sanitizeWhyPeopleLoveHtml_(html) {
  var s = convEnf_sanitizeHtml_(html);
  if (!s) return s;
  if (s.indexOf('<strong') !== -1) return s;
  if (s.indexOf('<p') !== -1) {
    s = s.replace(/<p>\s*([^<]{2,120})\s+—\s+([\s\S]*?)<\/p>/g, function(_, title, body) {
      var t = String(title || '').replace(/\s+/g, ' ').trim();
      var b = String(body || '').trim();
      if (!t || !b) return '<p>' + (t || '') + (t && b ? ' — ' : '') + (b || '') + '</p>';
      return '<p><strong>' + t + '</strong> — ' + b + '</p>';
    });
    return s.trim();
  }
  var raw = String(html || '').trim();
  var lines = raw.split(/\n+/).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (lines.length < 2) return s;
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    var m = ln.match(/^([^—]{2,120})\s+—\s+(.+)$/);
    if (m) {
      out.push('<p><strong>' + m[1].replace(/\s+/g, ' ').trim() + '</strong> — ' + m[2].trim() + '</p>');
    } else {
      out.push('<p>' + ln + '</p>');
    }
  }
  return out.join('').trim();
}

function convEnf_sanitizeItinerarySteps_(steps, opts) {
  if (!Array.isArray(steps)) return null;
  opts = opts || {};
  var max = (typeof opts.max === 'number' && isFinite(opts.max) && opts.max > 0) ? Math.floor(opts.max) : null;
  var out = [];
  for (var i = 0; i < steps.length; i++) {
    var st = steps[i] || {};
    var title = String(st.step_title || '').replace(/\s+/g, ' ').trim();
    var desc = String(st.step_description || '').trim();
    var label = String(st.step_label || '').replace(/\s+/g, ' ').trim();
    var durVal = st.duration_value;
    if (durVal !== null && durVal !== undefined && durVal !== '') {
      var n = Number(durVal);
      durVal = isFinite(n) ? n : null;
    } else {
      durVal = null;
    }
    var durUnit = String(st.duration_unit || '').replace(/\s+/g, ' ').trim();
    var meals = String(st.meals_included || '').replace(/\s+/g, ' ').trim();
    if (!title && !desc) continue;
    out.push({
      step_title: title,
      step_description: desc,
      step_label: label,
      duration_value: durVal,
      duration_unit: durUnit,
      meals_included: meals
    });
    if (max && out.length >= max) break;
  }
  return out;
}

function convEnf_applyItineraryDurationSuffix_(steps) {
  if (!Array.isArray(steps)) return steps;
  var out = [];
  for (var i = 0; i < steps.length; i++) {
    var st0 = steps[i] || {};
    var title = String(st0.step_title || '').trim();
    var desc = String(st0.step_description || '').trim();
    var label = String(st0.step_label || '').trim();
    var durVal = st0.duration_value;
    var durUnit = String(st0.duration_unit || '').trim();
    var meals = String(st0.meals_included || '').trim();
    var suffix = '';
    if (durVal !== null && durVal !== undefined && durVal !== '' && isFinite(Number(durVal)) && durUnit) {
      var unitLc = durUnit.toLowerCase();
      var unitOut = durUnit;
      if (unitLc === 'mins' || unitLc === 'min' || unitLc === 'minutes') unitOut = 'minutes';
      if (unitLc === 'hrs' || unitLc === 'hr' || unitLc === 'hours') unitOut = 'hours';
      suffix = ' (Approx. ' + String(Number(durVal)) + ' ' + unitOut + ')';
    }
    if (suffix && desc && desc.indexOf('Approx.') === -1) {
      desc = desc + suffix;
    }
    out.push({
      step_title: title,
      step_description: desc,
      step_label: label,
      duration_value: durVal,
      duration_unit: durUnit,
      meals_included: meals
    });
  }
  return out;
}

function convEnf_sanitizeFaqItems_(faqs, opts, ctx) {
  if (!Array.isArray(faqs)) return null;
  opts = opts || {};
  var max = (typeof opts.max === 'number' && isFinite(opts.max) && opts.max > 0) ? Math.floor(opts.max) : null;
  var out = [];
  var seen = {};
  var ctxIncluded = (ctx && ctx.included) ? ctx.included : [];
  var ctxExcluded = (ctx && ctx.excluded) ? ctx.excluded : [];
  var flags = (ctx && ctx.flags) ? ctx.flags : {};
  var ctxText = '';
  try { ctxText = JSON.stringify(ctx || {}); } catch (eCtx0) { ctxText = ''; }
  var ctxLc = String(ctxText || '').toLowerCase();
  var incText = Array.isArray(ctxIncluded) ? ctxIncluded.join(' | ').toLowerCase() : String(ctxIncluded || '').toLowerCase();
  var excText = Array.isArray(ctxExcluded) ? ctxExcluded.join(' | ').toLowerCase() : String(ctxExcluded || '').toLowerCase();
  var hasEntranceIncluded = /entrance|admission|ticket/.test(incText) && !/not included|excluded/.test(incText);
  var hasEntranceExcluded = /entrance|admission|ticket/.test(excText) || /entrance|admission|ticket/.test(incText) && /not included|excluded/.test(incText);
  var hasLanguageEvidence = /(english|french|german|spanish|italian|arabic)\b/.test(ctxLc);
  var hasPrivateEvidence = /\bprivate\b/.test(ctxLc);
  var hasGroupEvidence = /\b(group size|max|maximum|small group|private)\b/.test(ctxLc);
  for (var i = 0; i < faqs.length; i++) {
    var f = faqs[i] || {};
    var q = String(f.question || f.q || '').replace(/\s+/g, ' ').trim();
    var a = String(f.answer || f.a || '').trim();
    if (!q || !a) continue;
    var qLc = q.toLowerCase();
    var aLc = a.toLowerCase();
    if (convEnf_hasUnsupportedHighRiskClaims_(a, flags)) a = convEnf_rewriteUnsupportedFaqAnswer_(q, a, flags, { hasEntranceIncluded: hasEntranceIncluded, hasEntranceExcluded: hasEntranceExcluded });
    if (convEnf_isEntranceFeesDecisionQuestion_(qLc)) {
      if (hasEntranceIncluded && !hasEntranceExcluded) {
        a = "Yes. Attraction entrance fees are included as listed in What's Included."
      } else if (hasEntranceExcluded && !hasEntranceIncluded) {
        a = "No. Attraction entrance fees are not included as listed in What's Excluded."
      } else {
        a = "Please refer to the What's Included/Excluded section for whether attraction entrance fees are covered for your selected option."
      }
    } else {
      a = convEnf_softNormalizeEntranceFeesInAnswer_(a, { hasEntranceIncluded: hasEntranceIncluded, hasEntranceExcluded: hasEntranceExcluded });
    }
    if (/how large|group size|how many people|tour groups/.test(qLc)) {
      var looksLikeGroupSize = (/\b(private|small|group|people|persons|pax|max|maximum|limited|up to|size)\b/.test(aLc) || /\d+/.test(aLc));
      var looksLikeLanguage = (/\b(language|languages|english|french|german|spanish|italian|arabic)\b/.test(aLc));
      if (looksLikeLanguage && !looksLikeGroupSize) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        try { Logger.log("✅ Fixed FAQ: group size question had language answer"); } catch (eLogFaq1x) {}
      } else if (!looksLikeGroupSize && !hasGroupEvidence) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        try { Logger.log("✅ Fixed FAQ: normalized group size answer"); } catch (eLogFaq1) {}
      }
      if (a.toLowerCase().indexOf('private') !== -1 && !hasPrivateEvidence) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        try { Logger.log("✅ Fixed FAQ: removed unsupported private claim"); } catch (eLogFaq3) {}
      }
    }
    if (/languages?\b/.test(qLc) && !hasLanguageEvidence) {
      a = "Language availability is confirmed at booking."
      try { Logger.log("✅ Fixed FAQ: normalized language answer"); } catch (eLogFaq4) {}
    }
    a = convEnf_fixBrokenFaqText_(a);
    var key = q.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push({ question: q, answer: a });
    if (max && out.length >= max) break;
  }
  return out;
}

function convEnf_fixBrokenFaqText_(text) {
  var s = String(text || '');
  if (!s.trim()) return '';
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/,\s*a,\s*(and\s+)?/ig, ', ');
  s = s.replace(/,\s*,+/g, ', ');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/,\s+and\s+,/ig, ' and ');
  s = s.replace(/,\s*and\s*([.?!;:])/g, '$1');
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/\s+([.?!;:])/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function convEnf_isEntranceFeesDecisionQuestion_(question) {
  var q = String(question || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return false;
  var hasEntrance = /\b(entrance fee|entrance fees|admission|ticket|tickets)\b/.test(q);
  if (!hasEntrance) return false;
  var hasDecision = /\b(included|not included|cover|covered|pay|pay for|need to pay|extra charge|additional cost)\b/.test(q);
  if (!hasDecision) return false;
  if (/\b(cash|money|bring|what to bring|tips?|gratuities|extras)\b/.test(q)) return false;
  return true;
}

function convEnf_softNormalizeEntranceFeesInAnswer_(answer, ctx) {
  var c = ctx || {};
  var a0 = String(answer || '').trim();
  if (!a0) return '';
  if (!c.hasEntranceIncluded && !c.hasEntranceExcluded) return a0;
  var a = a0;
  if (c.hasEntranceExcluded && !c.hasEntranceIncluded) {
    a = a
      .replace(/\b(all\s+)?entrance\s+(tickets|fees)\s+are\s+included\b/ig, "entrance fees are not included")
      .replace(/\b(admission|tickets?)\s+are\s+included\b/ig, "$1 are not included");
  } else if (c.hasEntranceIncluded && !c.hasEntranceExcluded) {
    a = a
      .replace(/\b(entrance\s+(tickets|fees)|admission|tickets?)\s+are\s+not\s+included\b/ig, "entrance fees are included")
      .replace(/\b(not included)\b/ig, "included");
  }
  return convEnf_fixBrokenFaqText_(a);
}

function convEnf_rewriteUnsupportedFaqAnswer_(question, answer, flags, ctx) {
  var q = String(question || '').replace(/\s+/g, ' ').trim();
  var qLc = q.toLowerCase();
  var f = (flags && typeof flags === 'object') ? flags : {};
  var c = ctx || {};
  if (convEnf_isEntranceFeesDecisionQuestion_(qLc)) {
    if (c.hasEntranceIncluded && !c.hasEntranceExcluded) return "Yes. Attraction entrance fees are included as listed in What's Included.";
    if (c.hasEntranceExcluded && !c.hasEntranceIncluded) return "No. Attraction entrance fees are not included as listed in What's Excluded.";
    return "Please refer to the What's Included/Excluded section for whether attraction entrance fees are covered for your selected option.";
  }
  if (/private\b/.test(qLc) && !f.has_private) return "Tour details depend on the option selected and availability. You'll receive the exact details after booking.";
  if (/pickup|pick\s*-?\s*up|drop-?off/.test(qLc) && !f.has_pickup) return "Pickup details depend on the option selected. You'll receive the meeting point information after booking.";
  if (/lunch|meal|food/.test(qLc) && !f.has_lunch) return "Meal details depend on the option selected. Please refer to the What's Included/Excluded section.";
  if (/flight|airfare|air ticket/.test(qLc) && !f.has_flights) return "Flights are not included unless explicitly listed in What's Included.";
  if (/cruise|boat|felucca|nile/.test(qLc) && (!f.has_cruise || !f.has_boat || !f.has_felucca || !f.has_nile)) return "Activities depend on the option selected. Please refer to the itinerary and What's Included/Excluded section.";
  return "Details depend on the option selected and availability. Please refer to the itinerary and What's Included/Excluded section.";
}

function convEnf_rewriteUnsupportedContentText_(text, flags, evidence) {
  var t = String(text || '');
  if (!t.trim()) return '';
  var lc = t.toLowerCase();
  var f = (flags && typeof flags === 'object') ? flags : {};
  var ev = (evidence && typeof evidence === 'object') ? evidence : {};
  var evText = String(ev.strict_combined || ev.combined || '').toLowerCase();
  function hasEv_(re) { return re.test(evText); }

  if (!f.has_nile && /\bnile\b/.test(lc) && evText.indexOf('nile') === -1) t = t.replace(/\bnile\b/gi, 'historic Egyptian sites');
  if (!f.has_felucca && /\b(felucca|faluka)\b/i.test(lc) && !hasEv_(/\b(felucca|faluka)\b/)) t = t.replace(/\b(felucca|faluka)\b/gi, 'local sightseeing');
  if (!f.has_boat && /\bboat\b/.test(lc) && evText.indexOf('boat') === -1) t = t.replace(/\bboat\b/gi, 'guided tour');
  if (!f.has_cruise && /\bcruise\b/.test(lc) && evText.indexOf('cruise') === -1) t = t.replace(/\bcruise\b/gi, 'guided tour');
  if (!f.has_flights && /\b(flight|flights|airfare|air ticket|air tickets)\b/i.test(lc) && !hasEv_(/\b(flight|flights|airfare|air ticket|air tickets)\b/)) t = t.replace(/\b(flight|flights|airfare|air ticket|air tickets)\b/gi, 'transportation');
  if (!f.has_snorkel && /\b(snorkel|snorkeling|diving)\b/i.test(lc) && !hasEv_(/\b(snorkel|snorkeling|diving)\b/)) t = t.replace(/\b(snorkel|snorkeling|diving)\b/gi, 'optional activities');
  if (!f.has_safari && /\b(safari|quad|atv)\b/i.test(lc) && !hasEv_(/\b(safari|quad|atv)\b/)) t = t.replace(/\b(safari|quad|atv)\b/gi, 'optional activities');
  if (!f.has_private && /\bprivate\b/.test(lc) && evText.indexOf('private') === -1) t = t.replace(/\bprivate\b/gi, 'guided');
  if (!f.has_tickets && /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/i.test(lc) && !hasEv_(/\b(ticket|tickets|admission|entrance fee|entrance fees)\b/)) t = t.replace(/\b(ticket|tickets|admission|entrance fee|entrance fees)\b/gi, 'site visits');
  if (!f.has_lunch && /\blunch\b/.test(lc) && evText.indexOf('lunch') === -1) t = t.replace(/\blunch\b/gi, 'meal time');
  if (!f.has_pickup && /\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/i.test(lc) && !hasEv_(/\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/)) t = t.replace(/\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/gi, 'meeting point');

  return t.replace(/\s+/g, ' ').trim();
}

function convEnf_sanitizeItineraryByFlags_(steps, flags, evidence) {
  if (!Array.isArray(steps)) return steps;
  var out = [];
  for (var i = 0; i < steps.length; i++) {
    var st = steps[i] || {};
    var t = convEnf_rewriteUnsupportedContentText_(st.step_title || '', flags, evidence);
    var d = convEnf_rewriteUnsupportedContentText_(st.step_description || '', flags, evidence);
    var l = convEnf_rewriteUnsupportedContentText_(st.step_label || '', flags, evidence);
    var meals = convEnf_rewriteUnsupportedContentText_(st.meals_included || '', flags, evidence);
    if (meals && convEnf_hasUnsupportedHighRiskClaims_(meals, flags)) meals = '';
    out.push({
      step_title: t,
      step_description: d,
      step_label: l,
      duration_value: st.duration_value,
      duration_unit: st.duration_unit,
      meals_included: meals
    });
  }
  return out;
}

function convEnf_sortIncExcItems_(items) {
  if (!Array.isArray(items)) return items;
  var scored = items.map(function(s) {
    var t = String(s || '').trim();
    var lc = t.toLowerCase();
    var optional = /^optional[:\s-]/i.test(t) ? 1 : 0;
    var score = 0;
    if (/hotel pickup|pickup|drop-?off/.test(lc)) score += 90;
    if (/transport|air-?conditioned|vehicle|transfer/.test(lc)) score += 80;
    if (/egyptologist|guide/.test(lc)) score += 70;
    if (/lunch|meal/.test(lc)) score += 60;
    if (/water/.test(lc)) score += 50;
    if (/entrance|admission|ticket/.test(lc)) score += 40;
    if (/tax|service charge/.test(lc)) score += 30;
    if (optional) score -= 1000;
    return { t: t, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  return scored.map(function(x) { return x.t; });
}

function convEnf_sortFaqItems_(faqs) {
  if (!Array.isArray(faqs)) return faqs;
  var scored = faqs.map(function(f, idx) {
    var q = String((f || {}).question || '').trim();
    var a = String((f || {}).answer || '').trim();
    var lc = q.toLowerCase();
    var score = 0;
    if (/entrance|admission|ticket/.test(lc)) score += 100;
    if (/pickup|pick up|meeting|where.*meet|hotel/.test(lc)) score += 95;
    if (/cancel|cancellation|refund/.test(lc)) score += 90;
    if (/wear|bring|dress|shoes/.test(lc)) score += 85;
    if (/duration|how long|time/.test(lc)) score += 80;
    if (/group|private|languages?/.test(lc)) score += 75;
    if (/kids|children|elderly|accessible/.test(lc)) score += 70;
    return { q: q, a: a, score: score, idx: idx };
  });
  scored.sort(function(x, y) {
    if (y.score !== x.score) return y.score - x.score;
    return x.idx - y.idx;
  });
  return scored.map(function(x) { return { question: x.q, answer: x.a }; });
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

function convEnf_getObject_(obj, pathArr) {
  var v = convEnf_getPath_(obj, pathArr);
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v;
}

function convEnf_getPath_(obj, pathArr) {
  var cur = obj;
  for (var i = 0; i < pathArr.length; i++) {
    if (!cur || typeof cur !== 'object') return null;
    cur = cur[pathArr[i]];
  }
  return cur;
}

function convEnf_airtableUpdateSafe_(tableName, recordId, fields) {
  try {
    airtableUpdate_(tableName, recordId, fields);
    return;
  } catch (e) {
    var msg = (e && e.message) ? e.message : String(e);
    var unknown = [];
    var re = /Unknown field name:\s*(?:\\"([^\\"]+)\\"|"([^"]+)")/g;
    var m;
    while ((m = re.exec(msg)) !== null) unknown.push(m[1] || m[2]);
    if (!unknown.length) throw e;
    var filtered = {};
    for (var k in fields) {
      if (unknown.indexOf(k) === -1) filtered[k] = fields[k];
    }
    if (!Object.keys(filtered).length) return;
    airtableUpdate_(tableName, recordId, filtered);
  }
}

function convEnf_normalizeTripRecord_(record) {
  if (!record) return null;
  var id = '';
  if (typeof record === 'object' && record.id) id = String(record.id || '').trim();
  if (!id) id = String(record || '').trim();
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

function convEnf_fetchHighlights_(tripLinkValue) {
  var res = airtableGet_('Highlights Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLinkValue) + "', ARRAYJOIN({Trip}))",
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

function convEnf_fetchItinerary_(tripLinkValue) {
  var res = airtableGet_('Itinerary Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLinkValue) + "', ARRAYJOIN({Trip}))",
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

function convEnf_fetchIncExc_(tripLinkValue, tableName, textField) {
  var res = airtableGet_(tableName, {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLinkValue) + "', ARRAYJOIN({Trip}))",
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

function convEnf_fetchFaqs_(tripLinkValue) {
  var res = airtableGet_('FAQs Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLinkValue) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  });
  var recs = res && res.records ? res.records : [];
  var faqs = [];
  recs.forEach(function(r) {
    var f = r.fields || {};
    var q = (f.AI_Question || '').toString().trim();
    var a = (f.AI_Answer || '').toString().trim();
    if (!q && !a) return;
    faqs.push({ question: q, answer: a });
  });
  return { records: recs, faqs: faqs };
}

function convEnf_fetchPackages_(tripLinkValue) {
  var res = airtableGet_('Packages', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLinkValue) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  });
  var recs = res && res.records ? res.records : [];
  var packages = [];
  recs.forEach(function(r) {
    var f = r.fields || {};
    packages.push({
      airtable_record_id: r.id,
      PackageID: (f.PackageID || '').toString(),
      PackageTitle: (f.PackageTitle || f.PackageName || '').toString(),
      RegularPrice: f.RegularPrice,
      SalePrice: f.SalePrice,
      Currency: (f.Currency || '').toString(),
      PricingCategories: (f.PricingCategories || '').toString(),
      GroupPricing: (f.GroupPricing || '').toString(),
      excerpt: (f.excerpt || '').toString(),
      content_html: (f.content_html || '').toString()
    });
  });
  return { records: recs, packages: packages };
}

function convEnf_replaceHighlights_(tripId, existingRecords, items, nowIso) {
  var recs = Array.isArray(existingRecords) ? existingRecords : [];
  var ids = recs.map(function(r) { return r && r.id ? r.id : ''; }).filter(function(x) { return !!x; });
  if (ids.length) airtableBatchDelete_('Highlights Improvement With AI', ids);
  Logger.log('Deleted old records: ' + ids.length);
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
  for (var j = 0; j < fieldsArray.length; j++) convEnf_logAirtableFields_('CREATE', 'Highlights Improvement With AI', '', fieldsArray[j]);
  airtableBatchCreate_('Highlights Improvement With AI', fieldsArray);
  Logger.log('Created new records: ' + fieldsArray.length);
}

function convEnf_replaceItinerary_(tripId, existingRecords, steps, nowIso) {
  var recs = Array.isArray(existingRecords) ? existingRecords : [];
  var ids = recs.map(function(r) { return r && r.id ? r.id : ''; }).filter(function(x) { return !!x; });
  if (ids.length) airtableBatchDelete_('Itinerary Improvement With AI', ids);
  Logger.log('Deleted old records: ' + ids.length);
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
  for (var j = 0; j < fieldsArray.length; j++) convEnf_logAirtableFields_('CREATE', 'Itinerary Improvement With AI', '', fieldsArray[j]);
  airtableBatchCreate_('Itinerary Improvement With AI', fieldsArray);
  Logger.log('Created new records: ' + fieldsArray.length);
}

function convEnf_replaceIncExc_(tripId, existingRecords, tableName, textField, items, nowIso) {
  var recs = Array.isArray(existingRecords) ? existingRecords : [];
  var ids = recs.map(function(r) { return r && r.id ? r.id : ''; }).filter(function(x) { return !!x; });
  if (ids.length) airtableBatchDelete_(tableName, ids);
  Logger.log('Deleted old records: ' + ids.length);
  var fieldsArray = [];
  for (var i = 0; i < items.length; i++) {
    var t = String(items[i] || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    var f = { Trip: [tripId], AI_Status: 'Done', AI_LastUpdated: nowIso };
    f[textField] = t;
    fieldsArray.push(f);
  }
  for (var j = 0; j < fieldsArray.length; j++) convEnf_logAirtableFields_('CREATE', tableName, '', fieldsArray[j]);
  airtableBatchCreate_(tableName, fieldsArray);
  Logger.log('Created new records: ' + fieldsArray.length);
}

function convEnf_replaceFaqs_(tripId, existingRecords, faqs, nowIso) {
  var recs = Array.isArray(existingRecords) ? existingRecords : [];
  var ids = recs.map(function(r) { return r && r.id ? r.id : ''; }).filter(function(x) { return !!x; });
  if (ids.length) airtableBatchDelete_('FAQs Improvement With AI', ids);
  Logger.log('Deleted old records: ' + ids.length);
  var fieldsArray = [];
  for (var i = 0; i < faqs.length; i++) {
    var f0 = faqs[i] || {};
    var q = String(f0.question || f0.q || '').replace(/\s+/g, ' ').trim();
    var a = String(f0.answer || f0.a || '').trim();
    if (!q || !a) continue;
    fieldsArray.push({
      Trip: [tripId],
      AI_Question: q,
      AI_Answer: a,
      AI_Status: 'Done',
      AI_LastUpdated: nowIso
    });
  }
  for (var j = 0; j < fieldsArray.length; j++) convEnf_logAirtableFields_('CREATE', 'FAQs Improvement With AI', '', fieldsArray[j]);
  airtableBatchCreate_('FAQs Improvement With AI', fieldsArray);
  Logger.log('Created new records: ' + fieldsArray.length);
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

function convEnf_buildPrompt_(payload, standardContext) {
  var input = { trip_dossier: payload, standard_context: standardContext };
  return [
    "You are a tour product standardization and conversion copywriting enforcer. Return ONLY valid JSON.",
    "",
    "GOAL:",
    "- Treat the trip as one complete product dossier. Review ALL sections together to ensure consistency.",
    "- Make content consistently high-conversion like top OTA tour pages (benefit-led, decision-enabling).",
    "- Fix violations and weak sections by rewriting ONLY what needs rewriting.",
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
    "- Each step_description should end with one short benefit sentence (why it matters) without adding new facts.",
    "INCLUDED/EXCLUDED:",
    "- Rewrite into value-driven bullets (traveler benefit).",
    "- Separate optional items clearly as optional_items[].",
    "- Put core value items first (pickup/transport/guide/fees/meal), optional items last.",
    "FAQS:",
    "- Improve and rewrite FAQs to be customer-focused and decision-enabling.",
    "- Keep answers factual and based ONLY on the provided INPUT JSON.",
    "- Keep questions clear and specific; avoid generic fluff.",
    "- Do not repeat the same question in different wording.",
    "- NEVER contradict INCLUDED/EXCLUDED. If unsure, tell the user to check Included/Excluded.",
    "- NEVER mention activities or inclusions not present in the INPUT JSON (e.g., Nile boat ride) unless explicitly included.",
    "DESCRIPTION:",
    "- Persuasive narrative focused on experience and outcomes.",
    "- No headings; output HTML paragraphs only.",
    "- Include a short final paragraph covering who this tour is for (and who it may not suit), based ONLY on INPUT JSON.",
    "- Add 1 short paragraph to set expectations (pace, walking, and what to bring) ONLY if those details exist in INPUT JSON; otherwise omit.",
    "WHY PEOPLE LOVE:",
    "- Enforce emotional hooks, clear benefits, decision triggers.",
    "- 5-7 points, each as <p><strong>Title</strong> — ...</p> (HTML only).",
    "- Each point must be concrete and must not introduce new inclusions beyond INPUT JSON.",
    "BOLD PROMISE:",
    "- Write bold_promise.value as one short, benefit-driven sub-headline following: \"Enjoy [desire] without [pain], even if [objection]\".",
    "- Keep it specific and factual; do not add inclusions or logistics not supported by INPUT JSON.",
    "AT A GLANCE:",
    "- Fill at_a_glance.value with: duration, meeting_point, group_size, includes, excludes.",
    "- Use short strings. If unknown, use empty string (do not guess).",
    "PACKAGES:",
    "- For each package in INPUT JSON packages[], write 1 excerpt and 1 content_html for the package card.",
    "- excerpt: plain text, 1-2 short sentences, max 180 characters.",
    "- content_html: HTML only using <p>, <ul>, <li>, <strong>. No headings.",
    "- Use ONLY facts from INPUT JSON. Do NOT invent inclusions (no flights).",
    "- Prefer pulling inclusions from package_copy_source.guaranteed_inclusions[]; do not add anything outside it.",
    "- Keep content_html to 3-5 bullets, benefit-led.",
    "SEO:",
    "- Improve seo.h1 (page H1) for clarity and conversion; target 60-90 characters.",
    "- Improve seo.title and seo.meta_description for CTR and clarity.",
    "- NEVER mention any high-risk items unless supported by standard_context.flags (e.g., Nile/boat/cruise/flights/snorkeling/safari/private/tickets/lunch/pickup).",
    "",
    "STRICT:",
    "- Do NOT add headings (no h2/h3/h4).",
    "- Do NOT invent new destinations or logistics not supported by input.",
    "- Output must be JSON only.",
    "",
    "INPUT JSON:",
    JSON.stringify(input),
    "",
    "OUTPUT JSON SCHEMA:",
    JSON.stringify({
      seo: {
        h1: { score: 0, action: "keep", text: "" },
        title: { score: 0, action: "keep", text: "" },
        meta_description: { score: 0, action: "keep", text: "" },
        excerpt: { score: 0, action: "keep", text: "" },
        short_summary: { score: 0, action: "keep", text: "" }
      },
      description: { score: 0, action: "polish", html: "" },
      why_people_love: { score: 0, action: "polish", html: "" },
      highlights: { score: 0, action: "polish", items: [""] },
      itinerary: { score: 0, action: "polish", steps: [{ step_title: "", step_description: "", step_label: "", duration_value: null, duration_unit: "", meals_included: "" }] },
      included: { score: 0, action: "polish", items: [""], optional_items: [""] },
      excluded: { score: 0, action: "polish", items: [""], optional_items: [""] },
      faqs: { score: 0, action: "polish", items: [{ question: "", answer: "" }] },
      packages: { items: [{ airtable_record_id: "", action: "keep", severity: "low", reason: "", excerpt: "", content_html: "" }] },
      bold_promise: { score: 0, action: "polish", value: "" },
      at_a_glance: { score: 0, action: "polish", value: { duration: "", meeting_point: "", group_size: "", includes: "", excludes: "" } }
    })
  ].join("\n");
}
