const { sleep } = require('../core/runtime')

let airtable
let http
let config
let CONFIG
let logger
let lock
let store
let aiProvider

function initAddonsEnhancer(options) {
  if (!options) throw new Error('createAddonsEnhancer: missing options')
  airtable = options.airtable
  http = options.http
  config = options.config
  logger = options.logger
  lock = options.lock
  store = options.store
  aiProvider = options.aiProvider

  if (!airtable) throw new Error('createAddonsEnhancer: missing options.airtable')
  if (!http) throw new Error('createAddonsEnhancer: missing options.http')
  if (!config) throw new Error('createAddonsEnhancer: missing options.config')
  if (!logger) throw new Error('createAddonsEnhancer: missing options.logger')
  if (!store) throw new Error('createAddonsEnhancer: missing options.store')
  if (!aiProvider) throw new Error('createAddonsEnhancer: missing options.aiProvider')

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
  const itinerary = await fetchRecordsByTrip_('ItinerarySteps', tripId, tripPublicId, 100, tripName)
  const highlights = await fetchRecordsByTrip_('TripHighlights', tripId, tripPublicId, 100, tripName)
  const details = await fetchRecordsByTrip_('TripDetails', tripId, tripPublicId, 100, tripName)
  const includes = await fetchRecordsByTrip_('TripIncludes', tripId, tripPublicId, 100, tripName)
  const excludes = await fetchRecordsByTrip_('TripExcludes', tripId, tripPublicId, 100, tripName)
  const addons = await fetchRecordsByTrip_('AddOns', tripId, tripPublicId, 100, tripName)

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

  const highlightsText = highlights
    .map((r) => {
      const f = r.fields || {}
      return String(f.Highlight || f.Title || f.Name || '').trim()
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
      return String(f.AddOnTitle || f.Title || f.Name || '').trim()
    })
    .filter(Boolean)
    .join('\n')

  return { itineraryText, highlightsText, detailsText, includesText, excludesText, addonsText }
}

/************************************************************
 * AI AddOns Enhancer (Trip-level Batch)
 * 
 * Generates enhanced AddOns for trips
 * Includes 3 MANDATORY FIXED items + Raw AddOns from database
 * Uses TripID for linking (not Record ID)
 ************************************************************/

var TRIPS_TABLE = 'Trips';
var ADDONS_TABLE = 'AddOns';
var ADDONS_IMPROVEMENT_TABLE = 'AddOns Improvement With AI';
var IMPROVEMENT_TABLE = 'Improvement With AI';

var ADDONS_STATUS_FIELD = 'AI_AddOns_Status';
var AI_ADDONS_BATCH_LIMIT = 1;  // Process one trip at a time

// Mandatory Fixed AddOns (with fixed WordPress IDs)
var FIXED_ADDONS = [
  {
    addOnId: 6273,  // WordPress ID
    name: "FTS Scarve",
    description: "Authentic Egyptian scarf, perfect for desert protection and style.",
    price: 10,
    isFixed: true
  },
  {
    addOnId: 20339,  // WordPress ID
    name: 'FTS Organic oils " Organic 100%',
    description: "Pure, high-quality organic oils sourced locally.",
    price: 10,
    isFixed: true
  },
  {
    addOnId: 6274,  // WordPress ID
    name: "Shared Photographer per person",
    description: "Professional photography service to capture your best moments.",
    price: 30,
    isFixed: true
  }
];

/************************************************************
 * MAIN BATCH FUNCTION
 ************************************************************/
async function runAiAddOnsEnhancementBatch() {
  loadConfigSecrets_();
  log('AI AddOns Enhancer: starting batch...');
  
  try {
    // Fetch trips with AI_AddOns_Status = 'Pending' AND AI_Status = 'Done' (Strict Sequential)
    var formula = "AND({" + ADDONS_STATUS_FIELD + "} = 'Pending', {AI_Status} = 'Done')";
    var params = {
      filterByFormula: formula,
      maxRecords: AI_ADDONS_BATCH_LIMIT
    };
    
    var res = await airtableGet_(TRIPS_TABLE, params)
    var trips = res && res.records ? res.records : [];
    
    if (!trips || !trips.length) {
      log('AI AddOns: no trips with ' + ADDONS_STATUS_FIELD + " = 'Pending'.");
      return;
    }
    
    for (let i = 0; i < trips.length; i++) {
      const tripRec = trips[i]
      const tripId = tripRec.id
      const tripFields = tripRec.fields || {}
      const tripNumber = tripFields.TripID || ''

      try {
        log('AI AddOns: processing Trip ' + tripId + ' (ID: ' + tripNumber + ')');
        
        // 1) Update status to Processing
        await updateTripAddOnsStatus_(tripId, 'Processing')
        
        if (!tripNumber) {
          throw new Error('TripID is missing for this trip');
        }
        
        // 2) Delete old AddOns for this trip
        await deleteOldAddOnsForTrip_(tripId, tripNumber)
        
        // 3) Fetch Raw AddOns using unified context (linked Trip or fallback)
        var rawAddOns = await fetchRawAddOnsForTrip_(tripId, tripNumber, tripFields.Title || '')
        
        // 4) Build Context
        var ctx = await buildAddOnsContext_(tripFields, tripId)
        
        // 5) Prepare List (Fixed + Raw)
        var addOnsList = prepareAddOnsList_(rawAddOns);
        
        // 6) Enhance with AI
        var enhancedAddOns = await enhanceAddOnsWithAi_(addOnsList, ctx)
        
        // 7) Create Records
        await createAddOnRecords_(enhancedAddOns, tripId)
        
        // 8) Update trip status
        await updateTripAddOnsStatus_(tripId, 'Done')
        
      } catch (e) {
        log('AI AddOns: error for Trip ' + tripId + ' — ' + e.message);
        await updateTripAddOnsStatus_(tripId, 'Error')
      }
    }
    
  } catch (e) {
    log('AI AddOns: fatal error — ' + e.message);
  }
  
  log('AI AddOns: batch finished.');
}

/************************************************************
 * DATA FETCHING & PREPARATION
 ************************************************************/

/**
 * Fetch raw AddOns from AddOns table where Trip matches.
 * Supports TripID (string), Trip Name (Primary Field), or Record ID.
 */
async function fetchRawAddOnsForTrip_(tripId, tripNumber, tripName) {
  var addOns = [];
  try {
    log('AI AddOns: fetching raw AddOns for Trip ' + tripId + ' (TripID: ' + tripNumber + ', Name: ' + tripName + ')');
    
    // Build a robust formula:
    // In Airtable, {Trip} (linked field) returns the PRIMARY FIELD VALUE of the linked record, not the Record ID.
    // So we must search for the Trip Name or Trip Number (if that's the primary field).
    // We also keep the Record ID search just in case.
    
    var conditions = [];
    
    // 1. Search by Trip Name (Primary Field usually)
    if (tripName) {
      // Escape single quotes in name
      var safeName = tripName.replace(/'/g, "\\'");
      conditions.push("FIND('" + safeName + "', ARRAYJOIN({Trip}))");
    }
    
    // 2. Search by Trip Number (in case Primary Field is ID)
    if (tripNumber) {
      conditions.push("FIND('" + tripNumber + "', ARRAYJOIN({Trip}))");
    }
    
    // 3. Search by Record ID (Unlikely to work in formula unless Primary Field is Record ID, but harmless)
    if (tripId) {
      conditions.push("FIND('" + tripId + "', ARRAYJOIN({Trip}))");
    }
    
    var formula = "OR(" + conditions.join(", ") + ")";
    
    log('AI AddOns: using filter formula: ' + formula);

    var res = await airtableGet_(ADDONS_TABLE, { filterByFormula: formula, pageSize: 100 })
    var records = res && res.records ? res.records : [];
    
    // Fallback: If formula fails (e.g. too complex or empty), try fetch by Trip Name EXACT match if simple
    if (!records.length && tripName) {
       // ... (Optional fallback logic could go here, but let's trust the OR formula first)
    }

    log('AI AddOns: found ' + records.length + ' raw records');
    records.forEach(function(rec) {
      var f = rec.fields || {};
      var addOnId = f.AddOnID || null;
      var name = f.AddOnTitle || f.AddOn_Name || f.Name || f.Title || '';
      var price = f.AddOnPrice || f.Price || f.Cost || '';
      if (name) {
        addOns.push({ addOnId: addOnId, name: name, price: price, isFixed: false });
      }
    });
  } catch (e) {
    log('AI AddOns: error fetching raw AddOns: ' + e.message);
  }
  return addOns;
}

/**
 * Prepare combined list of Fixed + Raw AddOns (deduplicated)
 */
function prepareAddOnsList_(rawAddOns) {
  var list = [];
  var seenNames = {};
  
  log('AI AddOns: DEBUG - Preparing list. Raw count: ' + rawAddOns.length);
  
  // 1. Add Fixed AddOns first
  FIXED_ADDONS.forEach(function(item) {
    list.push(item);
    seenNames[item.name.toLowerCase()] = true;
  });
  
  // 2. Add Raw AddOns if not duplicate
  rawAddOns.forEach(function(item) {
    if (!seenNames[item.name.toLowerCase()]) {
      list.push(item);
      seenNames[item.name.toLowerCase()] = true;
      log('AI AddOns: DEBUG - Added raw item: ' + item.name);
    } else {
      log('AI AddOns: DEBUG - Skipped duplicate: ' + item.name);
    }
  });
  
  log('AI AddOns: DEBUG - Final list count: ' + list.length);
  return list;
}

/**
 * Build context from trip and improved tables
 */
async function buildAddOnsContext_(tripFields, tripId) {
  var ctx = {};
  ctx.tripTitle = tripFields.Title || '';
  ctx.tripLocation = Array.isArray(tripFields.Cities) ? tripFields.Cities.join(', ') : '';
  
  // Get improved description
  try {
    var impParams = {
      filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
      maxRecords: 1
    };
    var impRes = await airtableGet_(IMPROVEMENT_TABLE, impParams)
    if (impRes && impRes.records && impRes.records.length) {
      var f = impRes.records[0].fields || {};
      ctx.tripDescription = f.AI_Trip_Description || '';
      ctx.focusKeyword = f.AI_SEO_FocusKeywords || '';
    }
  } catch (e) {
    // ignore
  }
  var U = await buildUnifiedTripContext_(tripId, tripFields)
  ctx.highlightsText = U && U.highlightsText ? U.highlightsText : '';
  ctx.itineraryText = U && U.itineraryText ? U.itineraryText : '';
  ctx.includesText = U && U.includesText ? U.includesText : '';
  ctx.excludesText = U && U.excludesText ? U.excludesText : '';
  ctx.addonsText = U && U.addonsText ? U.addonsText : '';
  
  return ctx;
}

/************************************************************
 * AI ENHANCEMENT
 ************************************************************/

async function enhanceAddOnsWithAi_(addOnsList, ctx) {
  // If list is empty (shouldn't be, has fixed items), return
  if (!addOnsList.length) return [];
  
  // Build prompt
  var itemsText = addOnsList.map(function(item, index) {
    return (index + 1) + ". " + item.name + (item.description ? " (" + item.description + ")" : "");
  }).join("\n");
  
  var prompt = 
    "You are a travel expert. Enhance the descriptions for these trip Add-Ons.\n\n" +
    "TRIP CONTEXT:\n" +
    "Title: " + ctx.tripTitle + "\n" +
    "Location: " + ctx.tripLocation + "\n" +
    "Focus Keyword: " + (ctx.focusKeyword || 'N/A') + "\n" +
    "Description: " + (ctx.tripDescription || 'N/A') + "\n\n" +
    "ADDITIONAL CONTEXT (raw + improved):\n" +
    (ctx.highlightsText || '') + "\n" +
    (ctx.itineraryText || '') + "\n" +
    (ctx.includesText || '') + "\n" +
    (ctx.excludesText || '') + "\n" +
    
    "ADD-ONS TO ENHANCE:\n" + itemsText + "\n\n" +

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
    "  -> Add '(if time permits)' when mentioning Khan el-Khalili.\n" +
    "  -> Example: 'Khan el-Khalili Market (if time permits)'\n\n" +
    
    "INSTRUCTIONS:\n" +
    "- For each add-on, write a persuasive, appealing description (1-2 sentences).\n" +
    "- Highlight the benefit to the traveler.\n" +
    "- Keep the exact Name provided.\n" +
    "- Output JSON format.\n\n" +
    
    "OUTPUT FORMAT:\n" +
    "{\n" +
    "  \"addons\": [\n" +
    "    {\n" +
    "      \"name\": \"AddOn Name\",\n" +
    "      \"description\": \"Enhanced description...\"\n" +
    "    }\n" +
    "  ]\n" +
    "}";
    
  var aiResult = await callAi_(prompt)
  
  if (aiResult && aiResult.addons && Array.isArray(aiResult.addons)) {
    // Map back to preserve original properties (like price, isFixed)
    return addOnsList.map(function(origItem) {
      var enhanced = aiResult.addons.find(function(aiItem) {
        return aiItem.name.toLowerCase() === origItem.name.toLowerCase(); // Simple match
      });
      
      return {
        addOnId: origItem.addOnId,  // Preserve the original ID
        name: origItem.name,
        description: enhanced ? enhanced.description : (origItem.description || origItem.name), // Fallback
        price: origItem.price,
        isFixed: origItem.isFixed
      };
    });
  }
  
  return addOnsList; // Fallback to original if AI fails
}

/************************************************************
 * RECORD CREATION
 ************************************************************/

async function createAddOnRecords_(addOns, tripId) {
  var createdCount = 0;
  var nowIso = new Date().toISOString();
  
  for (let i = 0; i < addOns.length; i++) {
    const item = addOns[i]
    try {
      var fields = {};
      fields.Trip = [tripId];
      if (item.addOnId) fields.AddOnID = item.addOnId; // Preserve original WordPress ID
      fields.AI_AddOn_Title = item.name;
      fields.AI_AddOn_Description = item.description;
      if (item.price) fields.AI_AddOn_Price = item.price; // If available
      fields.AI_Status = 'Done';
      fields.AI_LastUpdated = nowIso;
      
      await airtableCreate_(ADDONS_IMPROVEMENT_TABLE, fields)
      createdCount++;
    } catch (e) {
      log('AI AddOns: failed to create record for ' + item.name);
    }
  }
  
  log('AI AddOns: created ' + createdCount + ' records for Trip ' + tripId);
}

/************************************************************
 * HELPER FUNCTIONS
 ************************************************************/

async function deleteOldAddOnsForTrip_(tripId, tripNumber) {
  if (!tripId) return;

  while (true) {
    // Build a robust formula: Find by TripNumber OR TripID (Record ID)
    var formula = "OR(";
    if (tripNumber) {
      formula += "FIND('" + tripNumber + "', ARRAYJOIN({Trip})), ";
    }
    formula += "FIND('" + tripId + "', ARRAYJOIN({Trip})))";

    var params = {
      filterByFormula: formula,
      pageSize: 100
    };
    var res = await airtableGet_(ADDONS_IMPROVEMENT_TABLE, params)
    var recs = res && res.records ? res.records : [];
    if (!recs.length) {
      log('AI AddOns: no old records to delete for Trip ' + tripId);
      break;
    }
    var toDelete = recs.map(function(r){ return r.id; });
    log('AI AddOns: deleting ' + toDelete.length + ' old records for Trip ' + tripId);
    
    try {
      await airtableBatchDelete_(ADDONS_IMPROVEMENT_TABLE, toDelete)
    } catch (e) {
      for (var j = 0; j < toDelete.length; j++) {
        var recId = toDelete[j];
        try {
          await airtableDelete_(ADDONS_IMPROVEMENT_TABLE, recId)
        } catch (inner) {
          log('AI AddOns: failed to delete record ' + recId + ' — ' + inner.message)
        }
      }
    }
  }
}

async function updateTripAddOnsStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[ADDONS_STATUS_FIELD] = status;
  await airtableUpdate_(TRIPS_TABLE, tripId, fields)
}

async function createAiAddOnsEnhancerTrigger() {
  log('AI AddOns: createAiAddOnsEnhancerTrigger is not supported in Node runtime')
}

function createAddonsEnhancer(options) {
  let inited = false
  async function ensureInit() {
    if (inited) return
    initAddonsEnhancer(options)
    inited = true
  }

  return {
    runAiAddOnsEnhancementBatch: async (...args) => {
      await ensureInit()
      return runAiAddOnsEnhancementBatch(...args)
    }
  }
}

module.exports = { createAddonsEnhancer }
