const { sleep } = require('../core/runtime')

let airtable
let http
let config
let CONFIG
let logger
let lock
let store
let aiProvider

function initItineraryEnhancer(options) {
  if (!options) throw new Error('createItineraryEnhancer: missing options')
  airtable = options.airtable
  http = options.http
  config = options.config
  logger = options.logger
  lock = options.lock
  store = options.store
  aiProvider = options.aiProvider

  if (!airtable) throw new Error('createItineraryEnhancer: missing options.airtable')
  if (!http) throw new Error('createItineraryEnhancer: missing options.http')
  if (!config) throw new Error('createItineraryEnhancer: missing options.config')
  if (!logger) throw new Error('createItineraryEnhancer: missing options.logger')
  if (!store) throw new Error('createItineraryEnhancer: missing options.store')
  if (!aiProvider) throw new Error('createItineraryEnhancer: missing options.aiProvider')

  CONFIG = config

  if (!lock) {
    lock = {
      async tryLock() {
        return true
      },
      releaseLock() {
      }
    }
  }
}

function loadConfigSecrets_() {
}

function log(msg) {
  logger.info(String(msg == null ? '' : msg))
}

async function airtableGet_(tableName, params) {
  return airtable.airtableGet(tableName, params || {})
}

async function airtableCreate_(tableName, fields) {
  return airtable.airtableCreate(tableName, fields || {})
}

async function airtableUpdate_(tableName, recordId, fields) {
  return airtable.airtableUpdate(tableName, recordId, fields || {})
}

async function airtableDelete_(tableName, recordId) {
  return airtable.airtableDelete(tableName, recordId)
}

async function airtableBatchDelete_(tableName, ids) {
  return airtable.airtableBatchDelete(tableName, ids || [])
}

async function callAi_(prompt) {
  return aiProvider.callDeepseek(String(prompt || ''))
}

async function fetchRecordsByTrip_(tableName, tripRecordId, tripPublicId, limit, tripName) {
  const t = String(tableName || '')
  const lf = (CONFIG && CONFIG.LINK_FIELDS && CONFIG.LINK_FIELDS[t]) ? String(CONFIG.LINK_FIELDS[t]) : (CONFIG && CONFIG.DEFAULT_TRIP_LINK_FIELD ? String(CONFIG.DEFAULT_TRIP_LINK_FIELD) : 'Trip')
  const parts = []
  if (tripRecordId) parts.push(`FIND('${String(tripRecordId)}', ARRAYJOIN({${lf}}))`)
  if (tripPublicId) parts.push(`FIND('${String(tripPublicId)}', ARRAYJOIN({${lf}}))`)
  if (tripName) {
    const safeName = String(tripName).replace(/'/g, "\\'")
    parts.push(`FIND('${safeName}', ARRAYJOIN({${lf}}))`)
  }
  if (!parts.length) return []
  const formula = parts.length === 1 ? parts[0] : `OR(${parts.join(', ')})`
  const res = await airtableGet_(t, { filterByFormula: formula, pageSize: Math.min(100, Number(limit || 100)) })
  return res && res.records ? res.records : []
}

async function buildUnifiedTripContext_(tripId, tripFields) {
  const tripPublicId = tripFields && tripFields.TripID ? tripFields.TripID : ''
  const tripName = tripFields && tripFields.Title ? tripFields.Title : ''

  const highlights = await fetchRecordsByTrip_('TripHighlights', tripId, tripPublicId, 100, tripName)
  const itinerary = await fetchRecordsByTrip_('ItinerarySteps', tripId, tripPublicId, 100, tripName)
  const includes = await fetchRecordsByTrip_('TripIncludes', tripId, tripPublicId, 100, tripName)
  const excludes = await fetchRecordsByTrip_('TripExcludes', tripId, tripPublicId, 100, tripName)
  const addons = await fetchRecordsByTrip_('AddOns', tripId, tripPublicId, 100, tripName)
  const details = await fetchRecordsByTrip_('TripDetails', tripId, tripPublicId, 100, tripName)
  const packages = await fetchRecordsByTrip_('Packages', tripId, tripPublicId, 100, tripName)
  const faqs = await fetchRecordsByTrip_('TripFAQs', tripId, tripPublicId, 100, tripName)
  const pickup = await fetchRecordsByTrip_('PickupLocations', tripId, tripPublicId, 100, tripName)

  const highlightsText = highlights
    .map((r) => {
      const f = r.fields || {}
      return String(f.Highlight || f.Title || f.Name || '').trim()
    })
    .filter(Boolean)
    .join('\n')

  const itineraryText = itinerary
    .map((r) => {
      const f = r.fields || {}
      const t = String(f.StepTitle || f.Title || '').trim()
      const d = String(f.StepDescription || f.Description || '').trim()
      if (!t && !d) return ''
      return t ? (d ? `${t}: ${d}` : t) : d
    })
    .filter(Boolean)
    .join('\n')

  const includesText = includes
    .map((r) => {
      const f = r.fields || {}
      return String(f.IncludeItem || f.Title || f.Name || '').trim()
    })
    .filter(Boolean)
    .join('\n')

  const excludesText = excludes
    .map((r) => {
      const f = r.fields || {}
      return String(f.ExcludeItem || f.Title || f.Name || '').trim()
    })
    .filter(Boolean)
    .join('\n')

  const addonsText = addons
    .map((r) => {
      const f = r.fields || {}
      const name = String(f.Title || f.AddOn || f.Name || f.AddOnTitle || '').trim()
      const price = f.Price != null ? String(f.Price).trim() : ''
      if (!name) return ''
      return price ? `${name} ($${price})` : name
    })
    .filter(Boolean)
    .join('\n')

  const detailsText = details
    .map((r) => {
      const f = r.fields || {}
      const chunks = []
      for (const k of Object.keys(f)) {
        const v = f[k]
        if (typeof v === 'string') {
          const t = v.trim()
          if (t) chunks.push(t)
        }
      }
      return chunks.join(' ')
    })
    .filter(Boolean)
    .join('\n')

  const packagesText = packages
    .map((r) => {
      const f = r.fields || {}
      const t = String(f.PackageTitle || f.Title || f.Name || '').trim()
      const d = String(f.Description || '').trim()
      if (!t && !d) return ''
      return t ? (d ? `${t}: ${d}` : t) : d
    })
    .filter(Boolean)
    .join('\n')

  const faqsText = faqs
    .map((r) => {
      const f = r.fields || {}
      const q = String(f.Question || f.FAQ || '').trim()
      const a = String(f.Answer || '').trim()
      if (!q && !a) return ''
      return q ? (a ? `Q: ${q}\nA: ${a}` : `Q: ${q}`) : a
    })
    .filter(Boolean)
    .join('\n')

  const pickupText = pickup
    .map((r) => {
      const f = r.fields || {}
      return String(f.Location || f.Title || f.Name || '').trim()
    })
    .filter(Boolean)
    .join('\n')

  return { highlightsText, itineraryText, includesText, excludesText, addonsText, detailsText, packagesText, faqsText, pickupText }
}

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
async function runAiItineraryBatch() {
  loadConfigSecrets_();
  log('AI Itinerary Generator (TRIP-level): starting batch...');

  try {
    const trips = await fetchTripsNeedingItinerary_(AI_ITIN_TRIPS_BATCH_LIMIT)

    if (!trips || !trips.length) {
      log('AI Itinerary Generator: no Trips with ' + TRIP_ITIN_STATUS_FIELD + " = 'Pending'.");
      return;
    }

    for (let i = 0; i < trips.length; i++) {
      const tripRec = trips[i]
      const tripId = tripRec.id
      const tripFields = tripRec.fields || {}

      log('AI Itinerary Generator: processing Trip ' + tripId);
      await updateTripItinStatus_(tripId, 'Processing')

      try {
        await deleteItineraryImprovementForTrip_(tripId, tripFields.TripID || '')

        var impRecord = await findImprovementRecordForTrip_(tripId)

        await generateItineraryStepsForTripWithContext_(tripRec, impRecord)

        await updateTripItinStatus_(tripId, 'Done')

      } catch (tripErr) {
        log('AI Itinerary Generator: ERROR for Trip ' + tripId + ' → ' + tripErr);
        await updateTripItinStatus_(tripId, 'Error')
      }
    }

  } catch (e) {
    log('AI Itinerary Generator: fatal batch error — ' + e);
  }

  log('AI Itinerary Generator (TRIP-level): batch finished.');
}

/************************************************************
 * TEST ENTRY — TripID ثابت (للاختبار اليدوي)
 ************************************************************/
async function testGenerateItineraryForSingleTrip() {
  var tripIdValue = "21262"; 

  var tripRecord = await findTripRecordByTripID_(tripIdValue)
  if (!tripRecord || !tripRecord.id) {
    throw new Error("No Trip found with TripID = " + tripIdValue);
  }

  log("Found Trip record: " + tripRecord.id);

  var impRecord = await findImprovementRecordForTrip_(tripRecord.id)

  await deleteItineraryImprovementForTrip_(tripRecord.id)
  await generateItineraryStepsForTripWithContext_(tripRecord, impRecord)
}

/************************************************************
 * TRIPS HELPERS
 ************************************************************/

async function fetchTripsNeedingItinerary_(limit) {
  var params = {
    filterByFormula: "AND({" + TRIP_ITIN_STATUS_FIELD + "} = 'Pending', {AI_Highlights_Status} = 'Done')",
    maxRecords:      limit || 10
  };
  var res = await airtableGet_(TRIPS_TABLE, params)
  if (!res || !res.records) return [];
  return res.records;
}

async function updateTripItinStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[TRIP_ITIN_STATUS_FIELD] = status;
  await airtableUpdate_(TRIPS_TABLE, tripId, fields)
}

async function findTripRecordByTripID_(tripIdValue) {
  var formula = "{TripID} = '" + tripIdValue + "'";
  var params  = { filterByFormula: formula, maxRecords: 1 };
  var res     = await airtableGet_(TRIPS_TABLE, params)
  if (!res || !res.records || !res.records.length) return null;
  return res.records[0];
}

/************************************************************
 * DELETE OLD ITINERARY FOR TRIP
 ************************************************************/
async function deleteItineraryImprovementForTrip_(tripId, tripNumber) {
  if (!tripId) return;

  while (true) {
    var params = tripNumber ? {
      filterByFormula: "FIND('" + tripNumber + "', ARRAYJOIN({Trip}))",
      pageSize: 100
    } : {
      filterByFormula: "FIND('" + tripId + "', ARRAYJOIN({Trip}))",
      pageSize: 100
    };
    
    var res = await airtableGet_(ITINERARY_IMPROVEMENT_TABLE, params)
    var recs = res && res.records ? res.records : [];
    
    if (!recs.length) {
      log('AI Itinerary Generator: no old itinerary records to delete for Trip ' + tripId);
      break;
    }
    
    var toDelete = recs.map(function(r){ return r.id; });
    log('AI Itinerary Generator: deleting ' + toDelete.length + ' old itinerary records for Trip ' + tripId);
    
    try {
      await airtableBatchDelete_(ITINERARY_IMPROVEMENT_TABLE, toDelete)
    } catch (e) {
      for (var j = 0; j < toDelete.length; j++) {
        var id = toDelete[j];
        try {
          await airtableDelete_(ITINERARY_IMPROVEMENT_TABLE, id)
        } catch (inner) {
          log('AI Itinerary Generator: failed to delete record ' + id + ' — ' + inner.message)
        }
      }
    }
  }
}

/************************************************************
 * IMPROVEMENT WITH AI — LINKED RECORD
 ************************************************************/
async function findImprovementRecordForTrip_(tripRecordId) {
  var formula = "ARRAYJOIN({Trip}) = '" + tripRecordId + "'";
  var params  = { filterByFormula: formula, maxRecords: 1 };
  var res     = await airtableGet_(IMPROVEMENTS_TABLE, params)
  if (!res || !res.records || !res.records.length) return null;
  return res.records[0];
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

/************************************************************
 * MAIN GENERATION FOR ONE TRIP
 ************************************************************/
async function generateItineraryStepsForTripWithContext_(trip, imp) {
  var tripRecordId = trip.id;
  log('AI Itinerary Generator: start for trip ' + tripRecordId);

  var t = trip.fields || {};
  var f = (imp && imp.fields) ? imp.fields : {};

  var seoKeywords = Array.isArray(t.SEO_FocusKeywords_List)
    ? t.SEO_FocusKeywords_List.join(', ')
    : (t.SEO_FocusKeywords_List || '');

  var citySequenceRule = buildCitySequenceRuleFromTrip_(t);

  var U = await buildUnifiedTripContext_(tripRecordId, t)
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

  log('AI Itinerary Generator: prompt length = ' + prompt.length);

  var aiResult = await callAi_(prompt)

  if (typeof aiResult === 'string') {
    try { aiResult = JSON.parse(aiResult); }
    catch { throw new Error('Invalid JSON from AI'); }
  }

  if (!aiResult || !Array.isArray(aiResult.steps))
    throw new Error('Invalid AI result structure');

  var steps = aiResult.steps;
  log('AI Itinerary Generator: Generated ' + steps.length + ' steps. First step sample: ' + JSON.stringify(steps[0]));

  // --- DURATION CHECK & UPDATE (REGEX BASED) ---
  if (imp && imp.id && steps.length > 0) {
    try {
      // 1. Extract times from First and Last steps using Regex
      // Looks for patterns like "8:00 AM", "12:45 PM", "08:00", etc.
      var timeRegex = /(\d{1,2}:\d{2})\s*(AM|PM)?/i;
      
      var firstStepTitle = steps[0].step_title || '';
      var lastStepTitle = steps[steps.length - 1].step_title || '';
      
      var startMatch = firstStepTitle.match(timeRegex);
      
      // 2. For the last step, we want the END time (last time mentioned), not the start time.
      // Example: "11:00 AM - 11:45 AM" -> We want 11:45 AM.
      // Use global regex to find all time patterns
      var allTimesInLastStep = lastStepTitle.match(/(\d{1,2}:\d{2})\s*(AM|PM)?/gi);
      var endMatch = null;
      
      if (allTimesInLastStep && allTimesInLastStep.length > 0) {
        // Take the last match found
        var lastTimeStr = allTimesInLastStep[allTimesInLastStep.length - 1];
        endMatch = lastTimeStr.match(timeRegex);
      } else {
        // Fallback to simple match if no multiple times found
        endMatch = lastStepTitle.match(timeRegex);
      }
      
      if (startMatch && endMatch) {
        var startObj = parseTime_(startMatch[0]);
        var endObj = parseTime_(endMatch[0]);
        
        if (startObj && endObj) {
          // Calculate difference in minutes
          var diffMinutes = (endObj.hours * 60 + endObj.minutes) - (startObj.hours * 60 + startObj.minutes);
          
          // Handle day crossover (if end time is earlier than start time, assume next day)
          if (diffMinutes < 0) {
            diffMinutes += 24 * 60;
          }
          
          // Convert to hours and minutes
          var calcHours = Math.floor(diffMinutes / 60);
          var calcMinutes = diffMinutes % 60;
          var calcUnit = "hours"; // Default for single-day trips
          
          // Current values in DB
          var currentH = Number(f.Duration_Hours) || 0;
          var currentM = Number(f.Duration_Minutes) || 0;
          
          // Allow small tolerance (e.g., +/- 15 mins) to avoid minor updates
          // But here user wants strict correction if different.
          var isDifferent = (calcHours !== currentH) || (Math.abs(calcMinutes - currentM) > 5);
          
          if (isDifferent) {
             log('AI Itinerary Generator: Regex Duration Calculation -> ' + calcHours + 'h ' + calcMinutes + 'm');
             log('AI Itinerary Generator: Duration mismatch vs DB (' + currentH + 'h ' + currentM + 'm). Updating...');
             
             var updateFields = {
               Duration_Hours: calcHours,
               Duration_Minutes: calcMinutes,
               Duration_Unit: calcUnit
             };
             
             await airtableUpdate_(IMPROVEMENTS_TABLE, imp.id, updateFields)
          } else {
             log('AI Itinerary Generator: Duration matches DB (Regex Calc: ' + calcHours + 'h ' + calcMinutes + 'm). No update.');
          }
        }
      } else {
        log('AI Itinerary Generator: Could not extract start/end times via Regex to verify duration.');
      }
    } catch (e) {
      log('AI Itinerary Generator: Error in Regex duration calculation: ' + e.message);
    }
  }
  // -------------------------------

  if (steps.length > MAX_ITIN_STEPS) steps = steps.slice(0, MAX_ITIN_STEPS);

  for (let idx = 0; idx < steps.length; idx++) {
    const stepObj = steps[idx]
    var order       = idx + 1;
    var title       = stepObj.step_title || '';
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

    await airtableCreate_(ITINERARY_IMPROVEMENT_TABLE, fields)
  }

  log("AI Itinerary Generator: DONE");
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
    "- CALCULATE TOTAL DURATION as the full time span: (End Time of Last Step) minus (Start Time of First Step). Do NOT just sum the activity durations.\n\n" +

    "=== USER SEARCH INTENT & PSYCHOLOGY ===\n" +
    "When users read an itinerary, they want to know:\n" +
    "1. \"What time does it start/end?\" (Clear pickup/drop-off)\n" +
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
    "2. SPECIFIC TIMES: Use actual times or durations (not vague)\n" +
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

    "=== TIME FORMATTING ===\n" +
    "Option A - Specific Times (Best for fixed-schedule tours): \"7:00 AM - Hotel Pickup\"\n" +
    "Option B - Duration-Based (Best for flexible tours): \"Morning (2 hours) - Pyramids of Giza\"\n" +
    "Option C - Sequential (Best for adventure tours): \"Stop 1 (30 min) - Colored Canyon\"\n\n" +

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
    "      \"step_title\": \"Morning (8:00 AM) – Pyramids of Giza | 🏛️ Visit | ⭐ Highlight\",\n" +
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
async function fetchImprovedHighlightsForTrip_(tripId) {
  if (!tripId) return "";
  
  var HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
  var params = {
    filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
    pageSize: 20
  };
  
  try {
    var res = await airtableGet_(HIGHLIGHTS_IMPROVEMENT_TABLE, params)
    if (!res || !res.records || !res.records.length) return "";
    
    var texts = [];
    res.records.forEach(function(r) {
      var f = r.fields || {};
      var txt = f.AI_Highlight || "";
      if (txt) texts.push("- " + txt);
    });
    
    return texts.join("\n");
  } catch (e) {
    log("fetchImprovedHighlightsForTrip_ error: " + e.message);
    return "";
  }
}

/**
 * جلب خطوات البرنامج الخام من جدول ItinerarySteps
 */
async function fetchRawItineraryStepsForTrip_(tripId) {
  if (!tripId) return "";
  
  var ITINERARY_STEPS_TABLE = 'ItinerarySteps';
  var params = {
    filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
    pageSize: 50
  };
  
  try {
    var res = await airtableGet_(ITINERARY_STEPS_TABLE, params)
    if (!res || !res.records || !res.records.length) return "";
    
    var steps = [];
    res.records.forEach(function(r) {
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
    log("fetchRawItineraryStepsForTrip_ error: " + e.message);
    return "";
  }
}

/**
 * Create time-driven trigger for itinerary enhancement
 * Run this once to set up automatic processing
 */
async function createAiItineraryTrigger() {
  log('AI Itinerary: createAiItineraryTrigger is not supported in Node runtime')
}


function createItineraryEnhancer(options) {
  let inited = false
  async function ensureInit() {
    if (inited) return
    initItineraryEnhancer(options)
    inited = true
  }

  return {
    runAiItineraryBatch: async (...args) => {
      await ensureInit()
      return runAiItineraryBatch(...args)
    }
  }
}

module.exports = { createItineraryEnhancer }
