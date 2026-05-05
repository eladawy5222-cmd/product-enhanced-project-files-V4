/************************************************************
 * AI Itinerary GENERATOR (Trip-level Batch)
 * - يشتغل على جدول Trips حسب حقل حالة
 * - يمسح الـ Itinerary القديمة من جدول "Itinerary Improvement With AI"
 * - يولّد 5–10 خطوات جديدة بأسلوب احترافي
 ************************************************************/

var TRIPS_TABLE                  = 'Trips';
var IMPROVEMENTS_TABLE           = 'Improvement With AI';
var ITINERARY_IMPROVEMENT_TABLE  = 'Itinerary Improvement With AI';

// حقل الحالة في جدول Trips للتحكم
var TRIP_ITIN_STATUS_FIELD       = 'AI_Itinerary_Status';

// عدد الرحلات في كل تشغيل
var AI_ITIN_TRIPS_BATCH_LIMIT    = 1;  // Process one trip at a time

// حدود عدد الخطوات
var MIN_ITIN_STEPS               = 5;
var MAX_ITIN_STEPS               = 30;

/************************************************************
 * ENTRY POINT — Batch
 ************************************************************/
function runAiItineraryBatch() {
  loadConfigSecrets_();
  Logger.log('AI Itinerary Generator (TRIP-level): starting batch...');

  try {
    var trips = fetchTripsNeedingItinerary_(AI_ITIN_TRIPS_BATCH_LIMIT);

    if (!trips || !trips.length) {
      Logger.log('AI Itinerary Generator: no Trips with ' + TRIP_ITIN_STATUS_FIELD + " = 'Pending'.");
      return;
    }

    trips.forEach(function(tripRec) {
      var tripId     = tripRec.id;
      var tripFields = tripRec.fields || {};

      Logger.log('AI Itinerary Generator: processing Trip ' + tripId);
      updateTripItinStatus_(tripId, 'Processing');

      try {
        deleteItineraryImprovementForTrip_(tripId, tripFields.TripID || '');

        var impRecord = findImprovementRecordForTrip_(tripId, tripFields.TripID || '');

        generateItineraryStepsForTripWithContext_(tripRec, impRecord);

        updateTripItinStatus_(tripId, 'Done');

      } catch (tripErr) {
        Logger.log('AI Itinerary Generator: ERROR for Trip ' + tripId + ' → ' + tripErr);
        updateTripItinStatus_(tripId, 'Error');
      }
    });

  } catch (e) {
    Logger.log('AI Itinerary Generator: fatal batch error — ' + e);
  }

  Logger.log('AI Itinerary Generator (TRIP-level): batch finished.');
}

/************************************************************
 * TEST ENTRY — TripID ثابت (للاختبار اليدوي)
 ************************************************************/
function testGenerateItineraryForSingleTrip() {
  var tripIdValue = "21262"; 

  var tripRecord = findTripRecordByTripID_(tripIdValue);
  if (!tripRecord || !tripRecord.id) {
    throw new Error("No Trip found with TripID = " + tripIdValue);
  }

  Logger.log("Found Trip record: " + tripRecord.id);

  var impRecord = findImprovementRecordForTrip_(tripRecord.id, tripIdValue);

  deleteItineraryImprovementForTrip_(tripRecord.id);
  generateItineraryStepsForTripWithContext_(tripRecord, impRecord);
}

/************************************************************
 * TRIPS HELPERS
 ************************************************************/

function fetchTripsNeedingItinerary_(limit) {
  var params = {
    filterByFormula: "AND({" + TRIP_ITIN_STATUS_FIELD + "} = 'Pending', {AI_Highlights_Status} = 'Done')",
    maxRecords:      limit || 10
  };
  var res = airtableGet_(TRIPS_TABLE, params);
  if (!res || !res.records) return [];
  return res.records;
}

function updateTripItinStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[TRIP_ITIN_STATUS_FIELD] = status;
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

function findTripRecordByTripID_(tripIdValue) {
  var formula = "{TripID} = '" + tripIdValue + "'";
  var params  = { filterByFormula: formula, maxRecords: 1 };
  var res     = airtableGet_(TRIPS_TABLE, params);
  if (!res || !res.records || !res.records.length) return null;
  return res.records[0];
}

/************************************************************
 * DELETE OLD ITINERARY FOR TRIP
 ************************************************************/
function deleteItineraryImprovementForTrip_(tripId, tripNumber) {
  if (!tripId) return;
  var recs = fetchRecordsByTrip_(ITINERARY_IMPROVEMENT_TABLE, tripId, tripNumber || '', 10000, '');
  if (!recs || !recs.length) {
    Logger.log('AI Itinerary Generator: no old itinerary records to delete for Trip ' + tripId);
    return;
  }
  var toDelete = recs.map(function(r){ return r.id; }).filter(function(x){ return !!x; });
  if (!toDelete.length) return;
  Logger.log('AI Itinerary Generator: deleting ' + toDelete.length + ' old itinerary records for Trip ' + tripId);
  if (typeof airtableBatchDelete_ === 'function') {
    try { airtableBatchDelete_(ITINERARY_IMPROVEMENT_TABLE, toDelete); } catch (e) {}
  } else {
    toDelete.forEach(function(id) {
      try { airtableDelete_(ITINERARY_IMPROVEMENT_TABLE, id); } catch (e) {
        Logger.log('AI Itinerary Generator: failed to delete record ' + id + ' — ' + e.message);
      }
    });
  }
}

/************************************************************
 * IMPROVEMENT WITH AI — LINKED RECORD
 ************************************************************/
function findImprovementRecordForTrip_(tripId, tripNumber) {
  if (!tripId && !tripNumber) return null;
  var recs = fetchRecordsByTrip_(IMPROVEMENTS_TABLE, tripId || '', tripNumber || '', 1, '');
  if (!recs || !recs.length) return null;
  return recs[0];
}

/************************************************************
 * HELPER: PARSE TIME STRING
 ************************************************************/
function parseTime_(timeStr) {
  if (!timeStr) return null;
  
  var match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  
  var hours = parseInt(match[1], 10);
  var minutes = parseInt(match[2], 10);
  var meridian = match[3] ? match[3].toUpperCase() : null;
  
  if (meridian === 'PM' && hours < 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;
  
  return { hours: hours, minutes: minutes };
}

function stripTimeRangeFromStepTitle_(title) {
  var s = String(title || '');
  if (!s) return '';
  s = s.replace(/\s*\(?\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*(?:-|–|—|to)\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\)?\s*/gi, ' ');
  s = s.replace(/\s*\(?\b\d{1,2}:\d{2}\s*(?:AM|PM)?\)?\s*/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\-\–\—\|\:\s]+/, '').replace(/[\-\–\—\|\:\s]+$/, '').trim();
  return s;
}

function formatDurationText_(value, unit) {
  if (value === null || value === undefined || value === '') return '';
  var v = Number(value);
  if (!isFinite(v) || v <= 0) return '';
  var u = String(unit || '').trim();
  if (!u) return '';
  return String(v) + ' ' + u;
}

function ensureStepTitleHasDuration_(title, durationValue, durationUnit) {
  var s = String(title || '').trim();
  if (!s) return s;
  var dur = formatDurationText_(durationValue, durationUnit);
  if (!dur) return s;

  if (/\(\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?)\s*\)/i.test(s)) return s;
  if (/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?)\b/i.test(s)) return s;

  var labelRe = /^(Morning|Afternoon|Evening|Night|Day\s*\d+|Stop\s*\d+)\b/i;
  if (labelRe.test(s)) {
    return s.replace(labelRe, function(m) { return m + ' (' + dur + ')'; }).trim();
  }

  if (s.indexOf('|') !== -1) {
    var parts = s.split('|');
    parts[0] = String(parts[0] || '').trim() + ' (' + dur + ')';
    return parts.map(function(p) { return String(p || '').trim(); }).join(' | ').trim();
  }

  return (s + ' (' + dur + ')').trim();
}

/************************************************************
 * MAIN GENERATION FOR ONE TRIP
 ************************************************************/
function generateItineraryStepsForTripWithContext_(trip, imp) {
  var tripRecordId = trip.id;
  Logger.log('AI Itinerary Generator: start for trip ' + tripRecordId);

  var t = trip.fields || {};
  var f = (imp && imp.fields) ? imp.fields : {};

  var seoKeywords = Array.isArray(t.SEO_FocusKeywords_List)
    ? t.SEO_FocusKeywords_List.join(', ')
    : (t.SEO_FocusKeywords_List || '');

  var citySequenceRule = buildCitySequenceRuleFromTrip_(t);

  var U = buildUnifiedTripContext_(tripRecordId, t);
  var prompt = buildItineraryGeneratorPrompt_({
    tripTitle:        t.Title || '',
    slug:             t.Slug || '',
    durationHours:    t.Duration_Hours || '',
    durationUnit:     t.Duration_Unit || '',
    seoKeywords:      seoKeywords,
    focusKeyword:     f.AI_SEO_FocusKeywords || '',  // 🆕 AI-generated Focus Keyword
    aiOverviewTitle:  f.AI_Overview_Section_Title || '',
    aiTripDesc:       f.AI_Trip_Description || '',
    aiItineraryDesc:  f.AI_Itinerary_Description || '',
    aiWhyLoveTitle:   f.AI_Why_People_Love_This_Trip_Section_Title || '',
    aiTabContent:     f.AI_Tab_Content || '',
    citySequenceRule: citySequenceRule,
    aiHighlights:     U.highlightsText,
    rawItinerary:     U.itineraryText
  });

  Logger.log('AI Itinerary Generator: prompt length = ' + prompt.length);

  var aiResult = callAi_(prompt);

  if (typeof aiResult === 'string') {
    try { aiResult = JSON.parse(aiResult); }
    catch { throw new Error('Invalid JSON from AI'); }
  }

  if (!aiResult || !Array.isArray(aiResult.steps))
    throw new Error('Invalid AI result structure');

  var steps = aiResult.steps;
  Logger.log('AI Itinerary Generator: Generated ' + steps.length + ' steps. First step sample: ' + JSON.stringify(steps[0]));

  // --- DURATION CHECK & UPDATE ---
  if (imp && imp.id && steps.length > 0) {
    try {
      var calc = null;
      if (aiResult.calculated_total_duration && typeof aiResult.calculated_total_duration === 'object') {
        var td = aiResult.calculated_total_duration;
        var h = Number(td.hours);
        var m = Number(td.minutes);
        var u = String(td.unit || '').trim();
        if (isFinite(h) && isFinite(m) && u) calc = { hours: h, minutes: m, unit: u };
      }

      if (!calc) {
        var totalMinutes = 0;
        var hasAny = false;
        steps.forEach(function(st) {
          if (!st) return;
          var v = st.duration_value;
          var unit = String(st.duration_unit || '').toLowerCase().trim();
          if (v === null || v === undefined || v === '') return;
          var n = Number(v);
          if (!isFinite(n) || n <= 0) return;
          hasAny = true;
          if (unit === 'minute' || unit === 'minutes' || unit === 'min' || unit === 'mins') totalMinutes += n;
          else if (unit === 'hour' || unit === 'hours' || unit === 'hr' || unit === 'hrs') totalMinutes += n * 60;
          else if (unit === 'day' || unit === 'days') totalMinutes += n * 24 * 60;
          else totalMinutes += n * 60;
        });

        if (hasAny) {
          var calcUnit = 'hours';
          var calcHours = Math.floor(totalMinutes / 60);
          var calcMinutes = totalMinutes % 60;
          if (String(durationUnit || '').toLowerCase() === 'days' || totalMinutes >= 24 * 60) {
            var days = Math.round(totalMinutes / (24 * 60));
            if (days >= 1 && Math.abs(days * 24 * 60 - totalMinutes) <= 30) {
              calcUnit = 'days';
              calcHours = days;
              calcMinutes = 0;
            }
          }
          calc = { hours: calcHours, minutes: calcMinutes, unit: calcUnit };
        }
      }

      if (calc) {
        var currentH = Number(f.Duration_Hours) || 0;
        var currentM = Number(f.Duration_Minutes) || 0;
        var currentU = String(f.Duration_Unit || '').trim();
        var isDifferent = (Number(calc.hours) !== currentH) || (Math.abs(Number(calc.minutes) - currentM) > 5) || (String(calc.unit || '') !== currentU);
        if (isDifferent) {
          Logger.log('AI Itinerary Generator: Duration Calculation -> ' + calc.hours + 'h ' + calc.minutes + 'm (' + calc.unit + ')');
          Logger.log('AI Itinerary Generator: Duration mismatch vs DB (' + currentH + 'h ' + currentM + 'm ' + currentU + '). Updating...');
          airtableUpdate_(IMPROVEMENTS_TABLE, imp.id, {
            Duration_Hours: calc.hours,
            Duration_Minutes: calc.minutes,
            Duration_Unit: calc.unit
          });
        } else {
          Logger.log('AI Itinerary Generator: Duration matches DB. No update.');
        }
      } else {
        Logger.log('AI Itinerary Generator: Could not compute duration from AI output.');
      }
    } catch (e) {
      Logger.log('AI Itinerary Generator: Error in duration calculation: ' + e.message);
    }
  }
  // -------------------------------

  if (steps.length > MAX_ITIN_STEPS) steps = steps.slice(0, MAX_ITIN_STEPS);

  steps.forEach(function(stepObj, idx) {
    var order       = idx + 1;
    var title       = ensureStepTitleHasDuration_(
      stripTimeRangeFromStepTitle_(stepObj.step_title || ''),
      stepObj.duration_value,
      stepObj.duration_unit
    );
    var description = stepObj.step_description || '';

    if (!title && !description) return;

    var durVal = stepObj.duration_value;
    if (durVal !== null && durVal !== undefined && durVal !== '') {
      durVal = Number(durVal);
    } else {
      durVal = null;
    }

    var fields = {
      Trip:                [tripRecordId],
      StepOrder:           order,
      AI_Step_Title:       title,
      AI_Step_Description: description,
      AI_Step_Label:       stepObj.step_label || '',
      AI_Duration_Value:   durVal,
      AI_Duration_Unit:    stepObj.duration_unit || '',
      AI_Meals_Included:   stepObj.meals_included || '',
      AI_Status:           "Done",
      AI_LastUpdated:      new Date().toISOString()
    };

    airtableCreate_(ITINERARY_IMPROVEMENT_TABLE, fields);
  });

  Logger.log("AI Itinerary Generator: DONE");
}

/************************************************************
 * CITY DETECTION
 ************************************************************/
function detectCitiesFromTrip_(tripFields) {
  var textSources = [];

  if (tripFields.Title)              textSources.push(String(tripFields.Title));
  if (tripFields.Slug)               textSources.push(String(tripFields.Slug));
  if (tripFields.Trip_Description)   textSources.push(String(tripFields.Trip_Description));
  if (tripFields.des)                textSources.push(String(tripFields.des));

  var bigText = textSources.join(' \n ').toLowerCase();

  var knownCities = [
    "cairo", "giza", "aswan", "luxor",
    "hurghada", "sharm el sheikh", "sharm",
    "marsaalam", "marsa alam", "dahab",
    "alexandria", "fayoum", "siwa"
  ];

  var found = [];

  knownCities.forEach(function(city) {
    var idx = bigText.indexOf(city.toLowerCase());
    if (idx !== -1)
      found.push({ name: city, index: idx });
  });

  if (!found.length) return [];

  found.sort(function(a, b) { return a.index - b.index; });

  var unique = [];
  var added  = {};

  found.forEach(function(item) {
    var key = item.name.toLowerCase();
    if (!added[key]) {
      unique.push(item.name);
      added[key] = true;
    }
  });

  return unique;
}

/************************************************************
 * CITY SEQUENCE RULE
 ************************************************************/
function buildCitySequenceRuleFromTrip_(tripFields) {
  var cities = detectCitiesFromTrip_(tripFields);
  if (!cities.length) {
    return (
      "- The itinerary should follow a logical sequence of destinations.\n" +
      "- Transfers should happen at the end of the last day in each destination.\n" +
      "- The next day starts in the new city, not with the transfer again.\n"
    );
  }

  var seqStr = cities.map(capitalizeWords_).join(" → ");

  var coastal = ["hurghada", "sharm el sheikh", "sharm", "marsa alam", "marsaalam", "dahab"];
  var last    = cities[cities.length - 1].toLowerCase();
  var isRed   = coastal.indexOf(last) !== -1;

  var rule =
    "- The logical order of main destinations in this tour is: " + seqStr + ".\n" +
    "- You MUST follow this exact sequence in your itinerary.\n" +
    "- Only use cities mentioned clearly in the context; do NOT invent new destinations.\n" +
    "- Transfers must occur at the end of the last day in the current city.\n" +
    "- The next day should begin already in the new city.\n";

  if (isRed && cities.length >= 2) {
    var beforeLast = cities[cities.length - 2];
    rule +=
      "- The transfer to " + capitalizeWords_(cities[cities.length - 1]) +
      " must happen on the final afternoon/evening in " + capitalizeWords_(beforeLast) +
      ", and the next day MUST start in " + capitalizeWords_(cities[cities.length - 1]) + ".\n";
  }

  return rule;
}

/************************************************************
 * Capitalize helper
 ************************************************************/
function capitalizeWords_(str) {
  return String(str)
    .split(' ')
    .map(function(p) { return p.charAt(0).toUpperCase() + p.slice(1); })
    .join(' ');
}

/************************************************************
 * PROMPT MAIN
 ************************************************************/
function buildItineraryGeneratorPrompt_(ctx) {
  var seoKeywords      = ctx.seoKeywords || '';
  var durationHours    = ctx.durationHours || '';
  var durationUnit     = ctx.durationUnit || '';
  var citySequenceRule = ctx.citySequenceRule || '';
  var rawItinerary     = ctx.rawItinerary || '';
  var focusKeyword     = ctx.focusKeyword || '';

  return (
    "You are an SEO expert and tourism content writer. Create a detailed, engaging tour itinerary that builds excitement and answers all user questions.\n\n" +
    "TRIP INFO:\n" +
    "Title: " + ctx.tripTitle + "\n" +
    "Slug: " + ctx.slug + "\n" +
    "Duration: " + durationHours + " " + durationUnit + "\n" +
    "Focus Keyword: " + focusKeyword + "\n" +
    "SEO Keywords: " + seoKeywords + "\n\n" +
    "Overview: " + ctx.aiOverviewTitle + "\n" +
    "Description: " + ctx.aiTripDesc + "\n" +
    "Existing Itinerary Description: " + ctx.aiItineraryDesc + "\n" +
    "Why People Love This: " + ctx.aiWhyLoveTitle + "\n" +
    "Tab Content: " + ctx.aiTabContent + "\n\n" +
    "CITY SEQUENCE RULES (MUST FOLLOW):\n" + citySequenceRule + "\n\n" +
    "HIGHLIGHTS (Include these experiences):\n" + ctx.aiHighlights + "\n\n" +
    "RAW ITINERARY STEPS (Reference):\n" + rawItinerary + "\n\n" +
    
    "GOAL: Create a detailed, day-by-day (or step-by-step) itinerary for this trip.\n" +
    "- Total steps should be between " + MIN_ITIN_STEPS + " and " + MAX_ITIN_STEPS + ".\n" +
    "- If the trip is multi-day (more than 1 day), each step MUST correspond to ONE FULL DAY. Do NOT split a single day into multiple steps (e.g., Morning/Afternoon). Combine them into one description.\n" +
    "- If the trip is single-day (duration in hours), break it down by activity/time (Morning, Afternoon, etc.) into separate steps.\n" +
    "- USE THE FOCUS KEYWORD ('" + focusKeyword + "') naturally in at least one Step Title or Description if possible.\n" +
    "- CALCULATE TOTAL DURATION by summing the duration_value/duration_unit for all steps.\n\n" +

    "=== USER SEARCH INTENT & PSYCHOLOGY ===\n" +
    "When users read an itinerary, they want to know:\n" +
    "1. \"How long does it take?\" (Clear pickup/drop-off duration)\n" +
    "2. \"How long at each place?\" (Duration for each stop)\n" +
    "3. \"What exactly will I do there?\" (Specific activities)\n" +
    "4. \"Will I be rushed or relaxed?\" (Balanced timing)\n" +
    "5. \"When do I eat?\" (Meal timing clearly marked)\n\n" +

    "=== ITINERARY STRUCTURE ===\n" +
    "Each stop must include:\n" +
    "[Time/Duration]: # \"| [Location] | [Activity Type] | [Description]\"\n" +
    "Activity Types: 🚐 Transfer, 📸 Photo Stop, 🏛️ Visit, 🎯 Activity, 🍽️ Meal, 🛍️ Shopping, ⭐ Highlight\n\n" +

    "=== WRITING RULES ===\n" +
    "1. CHRONOLOGICAL: Write in time order from pickup to drop-off\n" +
    "2. DURATIONS (NO CLOCK TIMES IN TITLES): Use realistic durations per step. Do NOT include clock times or time ranges in step_title.\n" +
    "3. DESCRIPTIVE: Each stop needs 2-3 sentences of engaging description\n" +
    "4. KEYWORDS: Include SEO keywords naturally in descriptions\n" +
    "5. SENSORY LANGUAGE: Help users visualize the experience\n" +
    "6. PRACTICAL INFO: Include what they'll do, see, and feel\n\n" +
    
    "=== CLEAN ITINERARY FLOW RULES (CRITICAL) ===\n" +
    "- Do NOT use phrases like '(if selected)', '(Optional)', '(Extra Charge)' in Step Titles, Descriptions, or Meals.\n" +
    "- If a step (like Lunch) is in the itinerary, describe it as a definite, immersive part of the experience.\n" +
    "- Do NOT mention payment conditions or booking options in the itinerary steps.\n" +
    "- For 'meals_included', use ONLY: 'Breakfast', 'Lunch', 'Dinner', 'Breakfast & Lunch', 'Lunch & Dinner', 'Full Board', or 'None'. Do NOT add '(if selected)'.\n\n" +

    "=== DESCRIPTION FORMULA FOR EACH STOP ===\n" +
    "Sentence 1: What you'll DO at this location\n" +
    "Sentence 2: What you'll SEE or EXPERIENCE\n" +
    "Sentence 3: Why it's SPECIAL or MEMORABLE (optional for minor stops)\n\n" +

    "=== STEP TITLE RULES (CRITICAL) ===\n" +
    "- step_title MUST NOT contain any clock time like '8:00 AM' or '08:00'.\n" +
    "- step_title MUST NOT contain time ranges like '8:00 AM - 10:00 AM' or '08:00–10:00'.\n" +
    "- step_title SHOULD include the duration in parentheses using duration_value/duration_unit (e.g., 'Morning (2 hours) – ...').\n" +
    "- Put timing as durations only using duration_value and duration_unit.\n" +
    "- You MAY include broad labels like 'Morning', 'Afternoon', 'Evening'.\n\n" +

    "=== REALISM & SAFETY RULES ===\n" +
    "- You MUST NOT invent transportation types that are not clearly stated in the context.\n" +
    "- Do NOT mention flights, trains, cruises, or buses unless explicitly stated.\n" +
    "- If unsure, use neutral verbs: 'Travel to', 'Head to', 'Go to'.\n" +
    "- Do NOT invent specific times (e.g., 'at 8:00 AM') unless stated. Use 'Morning', 'Afternoon', etc.\n" +
    "- Do NOT invent new cities or destinations not in the context.\n" +
    "- Keep all activities realistic for an Egypt tours & excursions website.\n\n" +

    "=== MUSEUM DISTINCTION & LOGIC (CRITICAL) ===\n" +
    "1. The Egyptian Museum (Tahrir): Old museum in Tahrir Square.\n" +
    "2. The Grand Egyptian Museum (GEM): New museum in Giza (Tutankhamun & Mummies as per user rule).\n" +
    "3. The National Museum of Egyptian Civilization (NMEC): In Fustat (Civilization Museum).\n\n" +
    "RULES:\n" +
    "- IF trip originates from outside Cairo (e.g. Hurghada, Sharm) AND input mentions 'Egyptian Museum': REPLACE with 'Grand Egyptian Museum' (GEM).\n" +
    "- DO NOT replace 'National Museum of Egyptian Civilization' (NMEC) with GEM. Treat it as a distinct visit.\n" +
    "- IF trip is Cairo City Tour: Keep 'Egyptian Museum' unless context implies GEM.\n\n" +

    "=== CONDITIONAL VISIT RULES ===\n" +
    "- IF the itinerary involves visiting BOTH 'Pyramids' AND 'Grand Egyptian Museum' (GEM):\n" +
    "  -> The visit to 'Khan el-Khalili' (if present) MUST be marked as conditional.\n" +
    "  -> Add '(if time permits)' to the Step Title for Khan el-Khalili.\n" +
    "  -> Example: 'Khan el-Khalili Market (if time permits)'\n\n" +

    "=== MANDATORY WRITING RULES ===\n" +
    "1. Tone & Voice: Natural, conversational, like an experienced guide.\n" +
    "2. Break AI Patterns: No repetitive structures, no generic openings.\n" +
    "3. Experience & Trust: Reference real-world experience, address traveler concerns.\n" +
    "4. Direct Engagement: Speak to 'you', make it easy to read aloud.\n" +
    "5. SEO: Natural synonyms, focus on search intent, avoid keyword stuffing.\n\n" +

    "OUTPUT FORMAT (VERY IMPORTANT):\n" +
    "Return ONLY a valid JSON object with this exact structure, no extra text, no explanations:\n" +
    "{\n" +
    "  \"calculated_total_duration\": {\n" +
    "    \"hours\": 0,\n" +
    "    \"minutes\": 0,\n" +
    "    \"unit\": \"days\"\n" +
    "  },\n" +
    "  \"steps\": [\n" +
    "    {\n" +
    "      \"step_order\": 1,\n" +
    "      \"step_label\": \"Morning\",\n" +
    "      \"step_title\": \"Morning (2 hours) – Pyramids of Giza | 🏛️ Visit | ⭐ Highlight\",\n" +
    "      \"step_description\": \"Marvel at the legendary Great Pyramids...\",\n" +
    "      \"duration_value\": 2,\n" +
    "      \"duration_unit\": \"hours\",\n" +
    "      \"meals_included\": \"None\"\n" +
    "    }\n" +
    "  ]\n" +
    "}\n"
  );
}

/**
 * جلب الهايلايتس المحسنة من جدول Highlights Improvement With AI
 */
function fetchImprovedHighlightsForTrip_(tripId) {
  if (!tripId) return "";
  
  var HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
  
  try {
    var recs = fetchRecordsByTrip_(HIGHLIGHTS_IMPROVEMENT_TABLE, tripId || '', '', 20, '');
    if (!recs || !recs.length) return "";
    
    var texts = [];
    recs.forEach(function(r) {
      var f = r.fields || {};
      var txt = f.AI_Highlight || "";
      if (txt) texts.push("- " + txt);
    });
    
    return texts.join("\n");
  } catch (e) {
    Logger.log("fetchImprovedHighlightsForTrip_ error: " + e.message);
    return "";
  }
}

/**
 * جلب خطوات البرنامج الخام من جدول ItinerarySteps
 */
function fetchRawItineraryStepsForTrip_(tripId) {
  if (!tripId) return "";
  
  var ITINERARY_STEPS_TABLE = 'ItinerarySteps';
  
  try {
    var recs = fetchRecordsByTrip_(ITINERARY_STEPS_TABLE, tripId || '', '', 50, '');
    if (!recs || !recs.length) return "";
    
    var steps = [];
    recs.forEach(function(r) {
      var f = r.fields || {};
      steps.push({
        order: f.StepOrder || 999,
        title: f.StepTitle || '',
        desc: f.StepDescription || ''
      });
    });
    
    // Sort by order
    steps.sort(function(a, b) { return a.order - b.order; });
    
    return steps.map(function(s, i) {
      return "Step " + (i + 1) + ": " + s.title + "\n" + s.desc;
    }).join("\n\n");
    
  } catch (e) {
    Logger.log("fetchRawItineraryStepsForTrip_ error: " + e.message);
    return "";
  }
}

/**
 * Create time-driven trigger for itinerary enhancement
 * Run this once to set up automatic processing
 */
function createAiItineraryTrigger() {
  ScriptApp.newTrigger('runAiItineraryBatch')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('✅ Created trigger: runAiItineraryBatch (every 15 minutes)');
}

