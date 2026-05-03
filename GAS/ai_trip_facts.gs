/************************************************************
 * AI Trip Facts Enhancement
 *
 * Generates exactly 6 Trip Facts for each trip using:
 * - Raw trip data from Trips table
 * - Improved AI content from enhancement tables
 * - Smart prioritization based on data availability
 *
 * Output: English only (no Arabic translation)
 ************************************************************/

var TRIPS_TABLE = 'Trips';
var TRIP_FACTS_IMPROVEMENT_TABLE = 'TripFacts Improvement With AI';
var TRIP_FACTS_BASE_TABLE = 'TripFacts';            // قاموس الفاكتس (FactId + FactLabel + FactKey)
var IMPROVEMENT_TABLE = 'Improvement With AI';
var HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
var ITINERARY_IMPROVEMENT_TABLE = 'Itinerary Improvement With AI';

var TRIP_FACTS_STATUS_FIELD = 'AI_TripFacts_Status';
var FACTS_PER_TRIP = 6; // Exactly 6 facts per trip
var AI_TRIPFACTS_BATCH_LIMIT = 1;  // Process one trip at a time

// Canonical FactKeys allowed (must match Airtable exactly)
var CANONICAL_FACT_KEYS = [
  'language',
  'arrival_on',
  'accomodation',
  'permits',
  'departure_from',
  'best_season',
  'transportation',
  'fitness_level',
  'meals',
  'maximum_altitude',
  'tour_type',
  'group_size',
  'duration',
  'tour_location',
  'tour_availability',
  'pickup__drop_off'
];

// Available fact types (prioritized) - keys MUST be canonical FactKeys
var FACT_TYPES = {
  // Priority 1: Always try to include
  'duration': 'Duration',
  'tour_location': 'Tour Location',
  'meals': 'Meals',

  // Priority 2: Include if available
  'tour_type': 'Tour type',
  'language': 'Language',
  'best_season': 'Best season',

  // Priority 3: Fallback options
  'group_size': 'Group Size',
  'accomodation': 'Accomodation',
  'tour_availability': 'Tour Availability',
  'pickup__drop_off': 'Pickup & Drop Off',
  'transportation': 'Transportation',
  'fitness_level': 'Fitness level',
  'permits': 'Permits',
  'arrival_on': 'Arrival on',
  'departure_from': 'Departure from',
  'maximum_altitude': 'Maximum Altitude'
};

// Known WordPress IDs for fallback (if missing from Airtable Dictionary)
var KNOWN_FACT_IDS = {
  'language': '12647846',
  'transportation': '35550118',
  'meals': '69801669',
  'tour_type': '90730383',
  'duration': '97932390',
  'tour_availability': '97943192',
  'pickup__drop_off': '97950890',
  'group_size': '93988162',
  'accomodation': '28890066',
  'guiding_method': '97927509',
  'maximum_altitude': '89526429',
  'fitness_level': '69738162',
  'arrival_on': '12660073',
  'departure_from': '32070658',
  'best_season': '33257212',
  'permits': '31652972',
  'tour_location': '97941245'
};

/************************************************************
 * MAIN BATCH FUNCTION
 ************************************************************/
function runAiTripFactsEnhancementBatch() {
  loadConfigSecrets_();
  Logger.log('AI TripFacts: starting batch...');

  var formula = "AND({" + TRIP_FACTS_STATUS_FIELD + "} = 'Pending', {AI_IncExc_Status} = 'Done')";
  var params = {
    filterByFormula: formula,
    maxRecords: AI_TRIPFACTS_BATCH_LIMIT
  };

  var res = airtableGet_(TRIPS_TABLE, params);
  var trips = res && res.records ? res.records : [];

  if (!trips || !trips.length) {
    Logger.log('AI TripFacts: no Trips with ' + TRIP_FACTS_STATUS_FIELD + " = 'Pending'.");
    return;
  }

  // 🧩 Load dictionary of all possible facts (FactId + FactKey + FactLabel)
  var rawFacts = fetchRawTripFacts_();

  trips.forEach(function(tripRec) {
    var tripId = tripRec.id;
    var fields = tripRec.fields || {};

    try {
      Logger.log('AI TripFacts: processing Trip ' + tripId);

      // 1) Update status to Processing
      updateTripFactsStatus_(tripId, 'Processing');

      // 2) Delete old improved facts
      deleteOldTripFactsForTrip_(tripId, fields.TripID || '');

      // 3) Build context
      var ctx = buildTripFactsContext_(fields, tripId);

      // 4) Build prompt
      var prompt = buildTripFactsPrompt_(ctx);

      // 5) Call AI
      var aiResult = callAi_(prompt);

      if (!aiResult || typeof aiResult !== 'object') {
        throw new Error('Invalid AI result for TripFacts (not an object).');
      }

      var facts = aiResult.facts || [];
      if (!Array.isArray(facts)) facts = [];

      // Ensure exactly 6 facts
      if (facts.length > FACTS_PER_TRIP) {
        facts = facts.slice(0, FACTS_PER_TRIP);
      }

      // Normalize FactKeys to canonical ones
      facts = normalizeFactKeysArray_(facts, tripId);

      // Sanitize values - replace "Not specified" with defaults
      facts = sanitizeFactValues_(facts, tripId);

      // 6) Create records (with FactId matching from dictionary)
      var createdCount = 0;
      var createdFactIds = []; // Track created IDs to avoid conflicts

      facts.forEach(function(fact) {
        var label = (fact.label || '').toString().trim();
        var keyRaw = (fact.key || '').toString().trim();
        var key = normalizeFactKey_(keyRaw); // ensure canonical
        var value = (fact.value || '').toString().trim();

        if (!label || !key || !value) return;

        // Try to find matching FactId from dictionary
        var factId = matchFactId_(rawFacts, label, key);

        // --- Conflict Check (90730383 vs 97952084) ---
        if (factId) {
          var fidStr = String(factId);
          // 1. Check for mutual exclusivity
          if ((fidStr === '90730383' && createdFactIds.indexOf('97952084') !== -1) ||
              (fidStr === '97952084' && createdFactIds.indexOf('90730383') !== -1)) {
            Logger.log('AI TripFacts: Skipping FactId ' + fidStr + ' to avoid conflict with already created pair.');
            return;
          }
          // 2. Check for exact duplicates
          if (createdFactIds.indexOf(fidStr) !== -1) {
             return;
          }
        }
        // ---------------------------------------------

        var nowIso = new Date().toISOString();
        var fieldsCreate = {};
        fieldsCreate.Trip = [tripId];
        if (factId) {
          fieldsCreate.AI_Fact_ID = factId; // ← Changed from FactId - Preserve WordPress ID
          createdFactIds.push(String(factId));
        }
        fieldsCreate.AI_Fact_Label = label;
        fieldsCreate.FactKey = key; // canonical FactKey (kept for backward compatibility)
        fieldsCreate.AI_Fact_Value = value;
        fieldsCreate.AI_Status = 'Done';
        fieldsCreate.AI_LastUpdated = nowIso;

        airtableCreate_(TRIP_FACTS_IMPROVEMENT_TABLE, fieldsCreate);
        createdCount++;
      });

      Logger.log('AI TripFacts: Trip ' + tripId + ' → created ' + createdCount + ' facts');

      // 7) Update status
      updateTripFactsStatus_(tripId, 'Done');

    } catch (e) {
      Logger.log('AI TripFacts: error for Trip ' + tripId + ' — ' + e.message);
      updateTripFactsStatus_(tripId, 'Error');
    }
  });

  Logger.log('AI TripFacts: batch finished.');
}

/************************************************************
 * CONTEXT BUILDING
 ************************************************************/
function buildTripFactsContext_(fields, tripId, improvedFields) {
  var ctx = {};

  // Fetch improved AI content (passing TripID and Title for robust search)
  var improved = fetchImprovedDataForTrip_(tripId, fields.TripID, fields.Title);

  // Basic trip info
  ctx.title = fields.Title || '';
  
  // Duration: Prefer improved fields (Argument > Fetched > Original)
  if (improvedFields && improvedFields.Duration_Hours) {
    ctx.durationHours = improvedFields.Duration_Hours;
    ctx.durationMinutes = improvedFields.Duration_Minutes || improvedFields['Duration Minutes'] || '';
    ctx.durationUnit = improvedFields.Duration_Unit || 'days';
    Logger.log('AI TripFacts: Using Improved Duration (Arg): ' + ctx.durationHours + 'h ' + ctx.durationMinutes + 'm ' + ctx.durationUnit);
  } else if (improved && improved.durationHours) {
    ctx.durationHours = improved.durationHours;
    ctx.durationMinutes = improved.durationMinutes || '';
    ctx.durationUnit = improved.durationUnit || 'days';
    Logger.log('AI TripFacts: Using Improved Duration (Fetched): ' + ctx.durationHours + 'h ' + ctx.durationMinutes + 'm ' + ctx.durationUnit);
  } else {
    ctx.durationHours = fields.Duration_Hours || '';
    ctx.durationMinutes = fields.Duration_Minutes || fields['Duration Minutes'] || '';
    ctx.durationUnit = fields.Duration_Unit || '';
  }
  ctx.slug = fields.Slug || '';
  ctx.tripId = fields.TripID || '';

  // Validate duration - detect unrealistic values
  if (ctx.durationHours && ctx.durationUnit) {
    var hours = Number(ctx.durationHours);
    var unit = ctx.durationUnit.toLowerCase();

    if (unit === 'days' && hours > 30) {
      Logger.log('⚠️ DURATION WARNING [Trip ' + tripId + ']: ' + hours + ' days seems unrealistic. Using generic value.');
      ctx.durationHours = '';
      ctx.durationUnit = 'Multi-day tour';
    } else if (unit === 'hours' && hours > 720) {
      Logger.log('⚠️ DURATION WARNING [Trip ' + tripId + ']: ' + hours + ' hours seems unrealistic. Converting to days.');
      ctx.durationHours = Math.floor(hours / 24);
      ctx.durationUnit = 'days';
    }
  }

  // Location
  ctx.cities = Array.isArray(fields.Cities) ? fields.Cities.join(', ') : '';
  ctx.countries = Array.isArray(fields.Countries) ? fields.Countries.join(', ') : '';

  // Type & Category
  ctx.tourType = fields.Tour_Type || '';
  ctx.category = fields.Category || '';

  // Language
  ctx.languages = Array.isArray(fields.Languages) ? fields.Languages.join(', ') : '';

  // Group size
  ctx.minGroupSize = fields.Min_Group_Size || '';
  ctx.maxGroupSize = fields.Max_Group_Size || '';

  ctx.aiDescription = improved.description || '';
  ctx.aiOverview = improved.overview || '';
  var U = buildUnifiedTripContext_(tripId, fields);
  ctx.aiHighlights = (U && U.highlightsText) ? U.highlightsText : (improved.highlights || '');
  ctx.aiItinerary = (U && U.itineraryText) ? U.itineraryText : (improved.itinerary || '');
  ctx.focusKeyword = improved.focusKeyword || '';

  return ctx;
}

/************************************************************
 * AI PROMPT
 ************************************************************/
function buildTripFactsPrompt_(ctx) {
  var prompt =
    "You are a travel content expert. Generate exactly 6 Trip Facts for this tour.\n\n" +

    "AVAILABLE FACT TYPES (FactLabel → FactKey):\n" +
    "- Duration → duration (e.g., '8 hours', '3 days')\n" +
    "- Tour Location → tour_location (e.g., 'Cairo, Giza')\n" +
    "- Meals → meals (e.g., 'Lunch included', 'Breakfast and dinner', 'As per itinerary')\n" +
    "- Tour Type → tour_type (e.g., 'Cultural Tour', 'Adventure')\n" +
    "- Language → language (e.g., 'English, Spanish', 'English')\n" +
    "- Best season → best_season (e.g., 'October to April', 'Year-round')\n" +
    "- Group Size → group_size (e.g., 'Small group (max 15)', 'Private tour available')\n" +
    "- Accomodation → accomodation (e.g., '4-star hotels', 'As per itinerary')\n" +
    "- Tour Availability → tour_availability (e.g., 'Daily', 'Everyday')\n" +
    "- Pickup & Drop Off → pickup__drop_off (e.g., 'Hotel pickup included', 'Available')\n" +
    "- Transportation → transportation (e.g., 'Air-conditioned vehicle', 'As per itinerary')\n" +
    "- Fitness level → fitness_level (e.g., 'Easy', 'Moderate', 'All levels')\n" +
    "- Permits → permits (e.g., 'Included', 'Not required')\n" +
    "- Arrival on → arrival_on\n" +
    "- Departure from → departure_from\n" +
    "- Maximum Altitude → maximum_altitude\n\n" +

    "IMPORTANT: The fact 'key' MUST be one of these EXACT FactKeys (snake_case):\n" +
    "language, arrival_on, accomodation, permits, departure_from, best_season, transportation, fitness_level, meals, maximum_altitude, tour_type, group_size, duration, tour_location, tour_availability, pickup__drop_off\n\n" +

    "TRIP CONTEXT:\n" +
    "Title: " + (ctx.title || 'N/A') + "\n" +
    "Duration: " + (ctx.durationHours || '0') + " hours " + (ctx.durationMinutes ? ctx.durationMinutes + " minutes" : "") + " (" + (ctx.durationUnit || '') + ")\n" +
    "Location: " + (ctx.cities || ctx.countries || 'N/A') + "\n" +
    "Tour Type: " + (ctx.tourType || 'N/A') + "\n" +
    "Category: " + (ctx.category || 'N/A') + "\n" +
    "Languages: " + (ctx.languages || 'N/A') + "\n" +
    "Group Size: " + (ctx.minGroupSize || 'N/A') + " - " + (ctx.maxGroupSize || 'N/A') + "\n\n" +

    "IMPROVED AI CONTENT:\n" +
    "Description: " + (ctx.aiDescription || 'N/A') + "\n" +
    "Highlights: " + (ctx.aiHighlights || 'N/A') + "\n" +
    "Itinerary: " + (ctx.aiItinerary || 'N/A') + "\n" +
    "Focus Keyword: " + (ctx.focusKeyword || 'N/A') + "\n\n" +

    "🎯 CRITICAL RULES:\n" +
    "1. Generate EXACTLY 6 facts\n" +
    "2. RANDOMIZE fact selection - DO NOT use the same 6 facts for every trip\n" +
    "3. Select facts based on AVAILABLE DATA in trip context\n" +
    "4. NEVER use 'Not specified' - use sensible defaults:\n" +
    "   - If Meals unknown → 'As per itinerary'\n" +
    "   - If Language selected → 'English, French, German, Spanish, Italian'\n" +
    "   - If Best season unknown → 'Year-round'\n" +
    "   - If Accomodation unknown → 'As per itinerary'\n" +
    "   - If Pickup & Drop Off unknown → 'Available'\n" +
    "   - If Fitness level unknown → 'All levels'\n" +
    "   - If Permits unknown → 'Not required'\n" +
    "5. Prefer facts with SPECIFIC data from context over generic defaults\n" +
    "6. Keep values concise (max 50 characters)\n" +
    "7. Output in ENGLISH ONLY (no Arabic)\n" +
    "8. Do NOT invent specific details\n" +
    "9. AVOID repeating 'Fitness level: All levels' if possible - use other facts\n" +
    "10. The 'key' field in the JSON MUST always be one of the allowed FactKeys listed above.\n" +
    "11. MUSEUM DISTINCTION & LOGIC (CRITICAL):\n" +
    "    - The Egyptian Museum (Tahrir): Old museum, statues.\n" +
    "    - The Grand Egyptian Museum (GEM): New museum, Giza (Tutankhamun & Mummies as per user rule).\n" +
    "    - The National Museum of Egyptian Civilization (NMEC): Fustat (Civilization Museum).\n" +
    "    RULES:\n" +
    "    - IF trip originates from outside Cairo (e.g. Hurghada, Sharm) AND input mentions 'Egyptian Museum': REPLACE with 'Grand Egyptian Museum' (GEM).\n" +
    "    - DO NOT replace 'National Museum of Egyptian Civilization' (NMEC) with GEM. Treat it as a distinct visit.\n" +
    "    - IF trip is Cairo City Tour: Keep 'Egyptian Museum' unless context implies GEM.\n\n" +

    "OUTPUT FORMAT (JSON ONLY):\n" +
    "{\n" +
    "  \"facts\": [\n" +
    "    {\n" +
    "      \"label\": \"Duration\",\n" +
    "      \"key\": \"duration\",\n" +
    "      \"value\": \"8 hours\"\n" +
    "    },\n" +
    "    {\n" +
    "      \"label\": \"Tour Location\",\n" +
    "      \"key\": \"tour_location\",\n" +
    "      \"value\": \"Cairo, Giza\"\n" +
    "    },\n" +
    "    {\n" +
    "      \"label\": \"Meals\",\n" +
    "      \"key\": \"meals\",\n" +
    "      \"value\": \"As per itinerary\"\n" +
    "    },\n" +
    "    {\n" +
    "      \"label\": \"Language\",\n" +
    "      \"key\": \"language\",\n" +
    "      \"value\": \"English, French, German, Spanish, Italian\"\n" +
    "    },\n" +
    "    {\n" +
    "      \"label\": \"Fitness level\",\n" +
    "      \"key\": \"fitness_level\",\n" +
    "      \"value\": \"All levels\"\n" +
    "    },\n" +
    "    {\n" +
    "      \"label\": \"Tour Availability\",\n" +
    "      \"key\": \"tour_availability\",\n" +
    "      \"value\": \"Daily\"\n" +
    "    }\n" +
    "  ]\n" +
    "}\n";

  return prompt;
}

/************************************************************
 * HELPER FUNCTIONS
 ************************************************************/

/**
 * Normalize a single FactKey to the canonical Airtable FactKey.
 * Returns '' if it cannot be mapped.
 */
function normalizeFactKey_(rawKey) {
  if (!rawKey) return '';
  var k = rawKey.toString().trim().toLowerCase();

  // Replace spaces and hyphens with single underscore
  k = k.replace(/[\s\-]+/g, '_');

  // Special cases
  if (k === 'accommodation') k = 'accomodation';

  if (k === 'pickup_dropoff' || k === 'pickup_drop_off' || k === 'pickup___drop_off') {
    k = 'pickup__drop_off';
  }

  // Must be one of canonical keys
  if (CANONICAL_FACT_KEYS.indexOf(k) !== -1) {
    return k;
  }

  return '';
}

/**
 * Normalize keys for an array of facts in-place.
 */
function normalizeFactKeysArray_(facts, tripId) {
  if (!Array.isArray(facts)) return facts;

  facts.forEach(function(fact, idx) {
    var rawKey = (fact.key || '').toString().trim();
    var normalized = normalizeFactKey_(rawKey);

    if (!normalized && rawKey) {
      Logger.log('⚠️ NORMALIZE [Trip ' + tripId + ']: Unsupported FactKey "' + rawKey + '" - this fact may be skipped.');
    }

    fact.key = normalized;
  });

  return facts;
}

/**
 * Sanitize fact values - replace "Not specified" with sensible defaults
 */
function sanitizeFactValues_(facts, tripId) {
  if (!Array.isArray(facts)) return facts;

  var DEFAULT_VALUES = {
    'meals': 'As per itinerary',
    'language': 'English, French, German, Spanish, Italian',
    'best_season': 'Year-round',
    'accomodation': 'As per itinerary',
    'pickup__drop_off': 'Available',
    'fitness_level': 'All levels',
    'permits': 'Not required',
    'tour_availability': 'Daily',
    'transportation': 'As per itinerary',
    'group_size': 'Available'
  };

  var sanitizedCount = 0;

  facts.forEach(function(fact, idx) {
    var value = (fact.value || '').toString().trim();
    var key = normalizeFactKey_(fact.key || '');

    // FORCE Language to always include the fixed list
    if (key === 'language') {
       facts[idx].value = 'English, French, German, Spanish, Italian';
    }

    if (value.toLowerCase().indexOf('not specified') !== -1 ||
        value.toLowerCase().indexOf('not available') !== -1 ||
        value === 'N/A' || value === '') {

      var defaultValue = DEFAULT_VALUES[key];

      if (defaultValue) {
        Logger.log('🔧 SANITIZE [Trip ' + tripId + ']: Replacing \"'
                   + value + '\" with \"' + defaultValue + '\" for ' + fact.label);
        facts[idx].value = defaultValue;
        sanitizedCount++;
      } else {
        Logger.log('⚠️ SANITIZE [Trip ' + tripId + ']: No default for ' + fact.label + ', using generic value');
        facts[idx].value = 'As per itinerary';
        sanitizedCount++;
      }
    }

    // Ensure key is canonical in the fact object
    facts[idx].key = key;
  });

  if (sanitizedCount > 0) {
    Logger.log('✅ SANITIZE [Trip ' + tripId + ']: Replaced ' + sanitizedCount + ' \"Not specified\" values');
  }

  return facts;
}

function updateTripFactsStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[TRIP_FACTS_STATUS_FIELD] = status;
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

function deleteOldTripFactsForTrip_(tripId, tripCode) {
  if (!tripId) return;

  Logger.log('AI TripFacts: deleting old facts for Trip ' + tripId);

  try {
    while (true) {
      var tripKey = String(tripCode || '').trim();
      if (!tripKey) tripKey = String(tripId || '').trim();
      var safeTripKey = tripKey.replace(/'/g, "\\'");
      var params = {
        filterByFormula: "FIND('" + safeTripKey + "', ARRAYJOIN({Trip}))",
        pageSize: 100
      };

      var res = airtableGet_(TRIP_FACTS_IMPROVEMENT_TABLE, params);
      var recs = res && res.records ? res.records : [];

      if (!recs.length) {
        break;
      }

      var toDelete = recs.map(function(r) { return r.id; });
      Logger.log('AI TripFacts: deleting ' + toDelete.length + ' old facts for Trip ' + tripId);

      if (typeof airtableBatchDelete_ === 'function') {
        try {
          airtableBatchDelete_(TRIP_FACTS_IMPROVEMENT_TABLE, toDelete);
        } catch (e) {
           Logger.log('AI TripFacts: batch delete failed, falling back to single delete. ' + e.message);
           toDelete.forEach(function(id) {
             try { airtableDelete_(TRIP_FACTS_IMPROVEMENT_TABLE, id); } catch (e2) {}
           });
        }
      } else {
        toDelete.forEach(function(id) {
          try {
            airtableDelete_(TRIP_FACTS_IMPROVEMENT_TABLE, id);
          } catch (e) {
            Logger.log('AI TripFacts: failed to delete fact ' + id + ' — ' + e.message);
          }
        });
      }
      
      if (recs.length < 100) break;
    }
  } catch (e) {
    Logger.log('AI TripFacts: error deleting old facts for Trip ' + tripId + ': ' + e.message);
  }
}

/**
 * Fetch raw Trip Facts dictionary from TripFacts table
 * (FactId + FactLabel + FactKey, لا يوجد حقل Trip)
 */
function fetchRawTripFacts_() {
  var rawFacts = [];
  var offset = null;

  try {
    do {
      var params = { pageSize: 100 };
      if (offset) params.offset = offset;

      var res = airtableGet_(TRIP_FACTS_BASE_TABLE, params);
      var recs = res && res.records ? res.records : [];
      offset = res ? res.offset : null;

      Logger.log('AI TripFacts: loaded ' + recs.length +
                 ' facts from dictionary table (' + TRIP_FACTS_BASE_TABLE + ')');

      recs.forEach(function(rec) {
        var f = rec.fields || {};
        rawFacts.push({
          factId: f.FactId || null,
          label: (f.FactLabel || '').toString().trim(),
          key:   (f.FactKey  || '').toString().trim(),
          value: f.FactValue || ''
        });
      });
    } while (offset);

  } catch (e) {
    Logger.log('AI TripFacts: error fetching raw facts dictionary: ' + e.message);
  }

  return rawFacts;
}

/**
 * Match AI-generated fact to raw fact by label or key
 * Returns FactId if found, null otherwise
 */
function matchFactId_(rawFacts, label, key) {
  if (!Array.isArray(rawFacts) || !rawFacts.length) return null;

  var labelLower = (label || '').toLowerCase().trim();
  var keyLower = normalizeFactKey_(key || '');

  // Try exact label match first
  for (var i = 0; i < rawFacts.length; i++) {
    var raw = rawFacts[i];
    if (raw.label && raw.label.toLowerCase().trim() === labelLower) {
      Logger.log('AI TripFacts: Matched FactId ' + raw.factId +
                 ' for "' + label + '" (label match)');
      return raw.factId;
    }
  }

  // Try key match (canonical)
  for (var j = 0; j < rawFacts.length; j++) {
    var raw2 = rawFacts[j];
    var rawKeyCanonical = normalizeFactKey_(raw2.key || '');
    if (rawKeyCanonical && rawKeyCanonical === keyLower) {
      Logger.log('AI TripFacts: Matched FactId ' + raw2.factId +
                 ' for key "' + keyLower + '" (key match)');
      return raw2.factId;
    }
  }

  // Fallback: Check KNOWN_FACT_IDS map
  if (KNOWN_FACT_IDS[keyLower]) {
    Logger.log('AI TripFacts: Matched FactId ' + KNOWN_FACT_IDS[keyLower] +
               ' for key "' + keyLower + '" (fallback map)');
    return KNOWN_FACT_IDS[keyLower];
  }

  return null; // No match found
}

function fetchImprovedDataForTrip_(tripId, tripNumber, tripName) {
  var result = {
    description: '',
    overview: '',
    highlights: '',
    itinerary: '',
    focusKeyword: ''
  };

  if (!tripId) return result;

  try {
    // Fetch main improvement using robust search
    var recs = fetchRecordsByTrip_(IMPROVEMENT_TABLE, tripId, tripNumber, 1, tripName);
    
    if (recs && recs.length) {
      var f = recs[0].fields || {};
      result.description = f.AI_Trip_Description || '';
      result.overview = f.AI_Overview_Section_Title || '';
      result.focusKeyword = f.AI_SEO_FocusKeywords || '';
      // New: Duration (Handle both snake_case and space-separated)
      result.durationHours = f.Duration_Hours || f['Duration Hours'] || '';
      result.durationMinutes = f.Duration_Minutes || f['Duration Minutes'] || '';
      result.durationUnit = f.Duration_Unit || f['Duration Unit'] || '';
    }

    // Fetch highlights
    var highlightsRes = fetchRecordsByTrip_(HIGHLIGHTS_IMPROVEMENT_TABLE, tripId, tripNumber, 100, tripName);
    if (highlightsRes && highlightsRes.length) {
      var highlights = [];
      highlightsRes.forEach(function(r) {
        var h = (r.fields || {}).AI_Highlight || '';
        if (h) highlights.push(h);
      });
      result.highlights = highlights.join('; ');
    }

    // Fetch itinerary (only meals info at the moment)
    var itinRes = fetchRecordsByTrip_(ITINERARY_IMPROVEMENT_TABLE, tripId, tripNumber, 100, tripName);
    if (itinRes && itinRes.length) {
      var steps = [];
      itinRes.forEach(function(r) {
        var f = r.fields || {};
        var meals = f.AI_Meals_Included || '';
        if (meals && meals !== 'None') {
          steps.push('Meals: ' + meals);
        }
      });
      result.itinerary = steps.join('; ');
    }

  } catch (e) {
    Logger.log('AI TripFacts: error fetching improved data for Trip ' + tripId + ': ' + e.message);
  }

  return result;
}

/************************************************************
 * TRIGGER SETUP
 ************************************************************/
function createAiTripFactsEnhancerTrigger() {
  ScriptApp.newTrigger('runAiTripFactsEnhancementBatch')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('AI TripFacts: Trigger created to run every hour.');
}
