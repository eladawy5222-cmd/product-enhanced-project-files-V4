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
function runAiAddOnsEnhancementBatch() {
  loadConfigSecrets_();
  Logger.log('AI AddOns Enhancer: starting batch...');
  
  try {
    // Fetch trips with AI_AddOns_Status = 'Pending' AND AI_Status = 'Done' (Strict Sequential)
    var formula = "AND({" + ADDONS_STATUS_FIELD + "} = 'Pending', {AI_Status} = 'Done')";
    var params = {
      filterByFormula: formula,
      maxRecords: AI_ADDONS_BATCH_LIMIT
    };
    
    var res = airtableGet_(TRIPS_TABLE, params);
    var trips = res && res.records ? res.records : [];
    
    if (!trips || !trips.length) {
      Logger.log('AI AddOns: no trips with ' + ADDONS_STATUS_FIELD + " = 'Pending'.");
      return;
    }
    
    trips.forEach(function(tripRec) {
      var tripId = tripRec.id;
      var tripFields = tripRec.fields || {};
      var tripNumber = tripFields.TripID || ''; // The ID used for linking (e.g. 7495)
      
      try {
        Logger.log('AI AddOns: processing Trip ' + tripId + ' (ID: ' + tripNumber + ')');
        
        // 1) Update status to Processing
        updateTripAddOnsStatus_(tripId, 'Processing');
        
        if (!tripNumber) {
          throw new Error('TripID is missing for this trip');
        }
        
        // 2) Delete old AddOns for this trip
        deleteOldAddOnsForTrip_(tripId, tripNumber);
        
        // 3) Fetch Raw AddOns using unified context (linked Trip or fallback)
        var rawAddOns = fetchRawAddOnsForTrip_(tripId, tripNumber);
        
        // 4) Build Context
        var ctx = buildAddOnsContext_(tripFields, tripId);
        
        // 5) Prepare List (Fixed + Raw)
        var addOnsList = prepareAddOnsList_(rawAddOns);
        
        // 6) Enhance with AI
        var enhancedAddOns = enhanceAddOnsWithAi_(addOnsList, ctx);
        
        // 7) Create Records
        createAddOnRecords_(enhancedAddOns, tripId);
        
        // 8) Update trip status
        updateTripAddOnsStatus_(tripId, 'Done');
        
      } catch (e) {
        Logger.log('AI AddOns: error for Trip ' + tripId + ' — ' + e.message);
        updateTripAddOnsStatus_(tripId, 'Error');
      }
    });
    
  } catch (e) {
    Logger.log('AI AddOns: fatal error — ' + e.message);
  }
  
  Logger.log('AI AddOns: batch finished.');
}

/************************************************************
 * DATA FETCHING & PREPARATION
 ************************************************************/

/**
 * Fetch raw AddOns from AddOns table where Trip matches.
 * Supports TripID (string), Trip Name (Primary Field), or Record ID.
 */
function fetchRawAddOnsForTrip_(tripId, tripNumber, tripName) {
  var addOns = [];
  try {
    Logger.log('AI AddOns: fetching raw AddOns for Trip ' + tripId + ' (TripID: ' + tripNumber + ', Name: ' + tripName + ')');
    
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
    
    Logger.log('AI AddOns: using filter formula: ' + formula);

    var res = airtableGet_(ADDONS_TABLE, { filterByFormula: formula, pageSize: 100 });
    var records = res && res.records ? res.records : [];
    
    // Fallback: If formula fails (e.g. too complex or empty), try fetch by Trip Name EXACT match if simple
    if (!records.length && tripName) {
       // ... (Optional fallback logic could go here, but let's trust the OR formula first)
    }

    Logger.log('AI AddOns: found ' + records.length + ' raw records');
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
    Logger.log('AI AddOns: error fetching raw AddOns: ' + e.message);
  }
  return addOns;
}

/**
 * Prepare combined list of Fixed + Raw AddOns (deduplicated)
 */
function prepareAddOnsList_(rawAddOns) {
  var list = [];
  var seenNames = {};
  
  Logger.log('AI AddOns: DEBUG - Preparing list. Raw count: ' + rawAddOns.length);
  
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
      Logger.log('AI AddOns: DEBUG - Added raw item: ' + item.name);
    } else {
      Logger.log('AI AddOns: DEBUG - Skipped duplicate: ' + item.name);
    }
  });
  
  Logger.log('AI AddOns: DEBUG - Final list count: ' + list.length);
  return list;
}

/**
 * Build context from trip and improved tables
 */
function buildAddOnsContext_(tripFields, tripId) {
  var ctx = {};
  ctx.tripTitle = tripFields.Title || '';
  ctx.tripLocation = Array.isArray(tripFields.Cities) ? tripFields.Cities.join(', ') : '';
  
  // Get improved description
  try {
    var impParams = {
      filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
      maxRecords: 1
    };
    var impRes = airtableGet_(IMPROVEMENT_TABLE, impParams);
    if (impRes && impRes.records && impRes.records.length) {
      var f = impRes.records[0].fields || {};
      ctx.tripDescription = f.AI_Trip_Description || '';
      ctx.focusKeyword = f.AI_SEO_FocusKeywords || '';
    }
  } catch (e) {
    // ignore
  }
  var U = buildUnifiedTripContext_(tripId, tripFields);
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

function enhanceAddOnsWithAi_(addOnsList, ctx) {
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
    
  var aiResult = callAi_(prompt);
  
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

function createAddOnRecords_(addOns, tripId) {
  var createdCount = 0;
  var nowIso = new Date().toISOString();
  
  addOns.forEach(function(item) {
    try {
      var fields = {};
      fields.Trip = [tripId];
      if (item.addOnId) fields.AddOnID = item.addOnId; // Preserve original WordPress ID
      fields.AI_AddOn_Title = item.name;
      fields.AI_AddOn_Description = item.description;
      if (item.price) fields.AI_AddOn_Price = item.price; // If available
      fields.AI_Status = 'Done';
      fields.AI_LastUpdated = nowIso;
      
      airtableCreate_(ADDONS_IMPROVEMENT_TABLE, fields);
      createdCount++;
    } catch (e) {
      Logger.log('AI AddOns: failed to create record for ' + item.name);
    }
  });
  
  Logger.log('AI AddOns: created ' + createdCount + ' records for Trip ' + tripId);
}

/************************************************************
 * HELPER FUNCTIONS
 ************************************************************/

function deleteOldAddOnsForTrip_(tripId, tripNumber) {
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
    var res = airtableGet_(ADDONS_IMPROVEMENT_TABLE, params);
    var recs = res && res.records ? res.records : [];
    if (!recs.length) {
      Logger.log('AI AddOns: no old records to delete for Trip ' + tripId);
      break;
    }
    var toDelete = recs.map(function(r){ return r.id; });
    Logger.log('AI AddOns: deleting ' + toDelete.length + ' old records for Trip ' + tripId);
    
    if (typeof airtableBatchDelete_ === 'function') {
      try { airtableBatchDelete_(ADDONS_IMPROVEMENT_TABLE, toDelete); } catch (e) {}
    } else {
      for (var j = 0; j < toDelete.length; j++) {
        var recId = toDelete[j];
        try { airtableDelete_(ADDONS_IMPROVEMENT_TABLE, recId); } catch (e) {
          Logger.log('AI AddOns: failed to delete record ' + recId + ' — ' + e.message);
        }
      }
    }
  }
}

function updateTripAddOnsStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[ADDONS_STATUS_FIELD] = status;
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

function createAiAddOnsEnhancerTrigger() {
  ScriptApp.newTrigger('runAiAddOnsEnhancementBatch')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('AI AddOns: Trigger created.');
}
