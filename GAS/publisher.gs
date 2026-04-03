/************************************************************
 * PUBLISHER: Airtable -> WordPress
 * 
 * Pushes enhanced content back to WordPress.
 * Requires the custom PHP endpoint: POST /wp-json/fts/v1/trips/{id}
 ************************************************************/

var PUBLISH_BATCH_SIZE = 1;
var TRIPS_TABLE = 'Trips';
var IMPROVEMENT_TABLE = 'Improvement With AI';
var ITINERARY_IMPROVEMENT_TABLE = 'Itinerary Improvement With AI';
var HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
var FAQS_IMPROVEMENT_TABLE = 'FAQs Improvement With AI';
var TRIP_INCLUDES_IMPROVEMENT_TABLE = 'TripIncludes Improvement With AI';
var TRIP_EXCLUDES_IMPROVEMENT_TABLE = 'TripExcludes Improvement With AI';
var TRIP_FACTS_IMPROVEMENT_TABLE = 'TripFacts Improvement With AI';
var ADDONS_IMPROVEMENT_TABLE = 'AddOns Improvement With AI';
var IMAGES_IMPROVEMENT_TABLE = 'Images Improvement With AI';
var TRIP_DETAILS_TABLE = 'TripDetails';

var PUBLISH_STATUS_FIELD = 'Publish_Status'; // Field in Trips table

var PRESERVATION_WORKFLOW_STATUS_FIELD = 'Preservation_Workflow_Status';
var PRESERVATION_ERROR_FIELD = 'Preservation_Error';
var PRESERVATION_LAST_RUN_AT_FIELD = 'Preservation_LastRunAt';

// If true: always CREATE a new WordPress trip on publish (never update existing)
var ALWAYS_CREATE_NEW_TRIP = true;

var PUBLISHER_WORKFLOW_ENABLED_PROPERTY = 'PUBLISHER_WORKFLOW_ENABLED';

function isPublisherWorkflowEnabled_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(PUBLISHER_WORKFLOW_ENABLED_PROPERTY);
    return String(v || '').toLowerCase() === 'true';
  } catch (e) {
    return false;
  }
}

function enablePublisherWorkflow() {
  PropertiesService.getScriptProperties().setProperty(PUBLISHER_WORKFLOW_ENABLED_PROPERTY, 'true');
  Logger.log('Publisher: workflow enabled');
}

function disablePublisherWorkflow() {
  PropertiesService.getScriptProperties().setProperty(PUBLISHER_WORKFLOW_ENABLED_PROPERTY, 'false');
  Logger.log('Publisher: workflow disabled');
}

function runPreservationPublisherBatch() {
  runPublisherBatch();
}

function runPublisherBatch() {
  if (!isPublisherWorkflowEnabled_()) {
    Logger.log('Publisher: workflow is disabled; skipping runPublisherBatch');
    return;
  }
  loadConfigSecrets_();
  Logger.log('Publisher: Starting batch...');
  
  // 1. Find trips ready to publish
  // Criteria: AI_Status = 'Done' AND Publish_Status = 'Pending' (or 'Ready')
  // Adjust criteria as needed.
  var formula = "{" + PRESERVATION_WORKFLOW_STATUS_FIELD + "}='Pending'";
  var trips = null;
  try {
    trips = airtableGet_(TRIPS_TABLE, {
      filterByFormula: formula,
      maxRecords: PUBLISH_BATCH_SIZE
    });
  } catch (e) {
    var msg = e && e.message ? String(e.message) : String(e);
    if (msg.indexOf('INVALID_FILTER_BY_FORMULA') !== -1 && msg.toLowerCase().indexOf('unknown field') !== -1) {
      Logger.log('Publisher: Missing Airtable field ' + PRESERVATION_WORKFLOW_STATUS_FIELD + ' on Trips; skipping');
      return;
    }
    throw e;
  }
  
  if (!trips || !trips.records || !trips.records.length) {
    Logger.log('Publisher: No trips found ready to publish.');
    return;
  }
  
  trips.records.forEach(function(tripRec) {
    var tripId = tripRec.id;
    var f = tripRec.fields;
    var tripIDValue = f.TripID; // Could be WordPress ID or Migration ID (99xxxxx)
    
    try {
      // Determine if this is a migrated trip (TripID starts with 99) or WordPress trip
      var isMigratedTrip = tripIDValue && String(tripIDValue).indexOf('99') === 0;
      var wpId = (ALWAYS_CREATE_NEW_TRIP || isMigratedTrip) ? null : tripIDValue; // force create when enabled
      
      Logger.log('Publisher: Processing Trip ' + tripId + ' (TripID: ' + (tripIDValue || 'NONE') + ', Type: ' + (isMigratedTrip ? 'MIGRATED' : 'WORDPRESS') + ')');
      updatePreservationWorkflowStatus_(tripId, 'Processing');
      
      // 2. Fetch all enhanced data
      var enhancedData = fetchCompleteTripData_(tripId);
      
      // 3. Map to WordPress Payload
      var payload = mapAirtableToWordPress_(enhancedData, f);
      
      // 4. Push to WordPress (create or update)
      if (!wpId) {
        // Create new trip on WordPress
        Logger.log('Publisher: Creating NEW trip on WordPress for Airtable Trip ' + tripId);
        // Generate a brand-new unique TripCode for every publish
        var newTripCode = 'TRIP-' + Utilities.getUuid().slice(0, 8).toUpperCase();

        // Ensure payload carries the new trip_code (important if the API upserts by trip_code)
        payload.meta = payload.meta || {};
        payload.meta.trip_code = newTripCode;
        
        // Force WP status to publish (optional but recommended so you "see" it as published)
        payload.core = payload.core || {};
        payload.core.status = 'publish';

        var newWpId = createNewTripOnWordPress_(payload);
        
        // Update Airtable with the new WordPress ID
        airtableUpdate_('Trips', tripId, { TripID: newWpId });
        Logger.log('Publisher: Created new trip with WP ID: ' + newWpId + ' (replaced TripID: ' + tripIDValue + ')');
        
        wpId = newWpId;
      } else {
        // Update existing WordPress trip
        pushToWordPress_(wpId, payload);
      }
      
      // 5. Publish Packages & Images (Added)
      publishPackagesSafe_(tripId, wpId);
      publishImagesSafe_(tripId, wpId, f);

      // 6. Update Status
      updatePreservationWorkflowStatus_(tripId, 'Done');
      Logger.log('Publisher: Successfully published Trip ' + tripId);
      
    } catch (e) {
      Logger.log('Publisher: Error publishing Trip ' + tripId + ': ' + e.message);
      updatePreservationWorkflowStatus_(tripId, 'Error', e);
    }
  });
}

function updatePreservationWorkflowStatus_(tripId, status, err) {
  var fields = {};
  fields[PRESERVATION_WORKFLOW_STATUS_FIELD] = status;
  fields[PRESERVATION_LAST_RUN_AT_FIELD] = new Date().toISOString();
  if (status === 'Error' && err) {
    var msg = (err && err.message) ? String(err.message) : String(err);
    fields[PRESERVATION_ERROR_FIELD] = msg.slice(0, 1000);
  } else if (status === 'Processing' || status === 'Done') {
    fields[PRESERVATION_ERROR_FIELD] = '';
  }
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

// ----------------------------------------------------------
// DATA FETCHING
// ----------------------------------------------------------

function fetchCompleteTripData_(tripId) {
  var data = {};
  
  // Strategy: Client-Side Filtering by ID.
  // Formulas failed for ID (resolves to Name) and Name (character mismatches).
  // We will fetch records and find the match in JS. This is 100% robust.
  
  Logger.log('Publisher: Fetching General Improvement using Client-Side ID Check: ' + tripId);
  
  var impRec = findRecordByLinkedId_(IMPROVEMENT_TABLE, 'Trip', tripId);
  
  if (!impRec) {
    Logger.log('Publisher: WARNING - No General Improvement record found for Trip ' + tripId);
  } else {
    Logger.log('Publisher: Found General Improvement record: ' + impRec.id);
  }

  data.general = impRec ? impRec.fields : {};

  // 1b. TripDetails (One-to-One) - Critical for TourType
  var detailsRec = findRecordByLinkedId_(TRIP_DETAILS_TABLE, 'Trip', tripId);
  data.tripDetails = detailsRec ? detailsRec.fields : {};
  if (detailsRec) {
    Logger.log('Publisher: Found TripDetails record: ' + detailsRec.id);
  } else {
    Logger.log('Publisher: WARNING - No TripDetails record found for Trip ' + tripId);
  }
  
  // 2. Highlights (One-to-Many)
  data.highlights = findRecordsByLinkedId_(HIGHLIGHTS_IMPROVEMENT_TABLE, 'Trip', tripId, 'Order');
  
  // 3. Itinerary (One-to-Many)
  data.itinerary = findRecordsByLinkedId_(ITINERARY_IMPROVEMENT_TABLE, 'Trip', tripId, 'StepOrder');
  
  // 4. FAQs (One-to-Many)
  data.faqs = findRecordsByLinkedId_(FAQS_IMPROVEMENT_TABLE, 'Trip', tripId);
  
  // 5. Includes/Excludes (One-to-Many)
  data.includes = findRecordsByLinkedId_(TRIP_INCLUDES_IMPROVEMENT_TABLE, 'Trip', tripId);
  data.excludes = findRecordsByLinkedId_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, 'Trip', tripId);
  
  // 6. Facts (One-to-Many)
  try {
    data.facts = findRecordsByLinkedId_(TRIP_FACTS_IMPROVEMENT_TABLE, 'Trip', tripId);
  } catch (e) {
    Logger.log('Publisher: Warning - Failed to fetch Trip Facts: ' + e.message);
    data.facts = [];
  }
  
  // 7. AddOns (One-to-Many)
  try {
    data.addons = findRecordsByLinkedId_(ADDONS_IMPROVEMENT_TABLE, 'Trip', tripId);
  } catch (e) {
     Logger.log('Publisher: Warning - Failed to fetch AddOns: ' + e.message);
     data.addons = [];
  }
  
  Logger.log('Publisher: Full Enhanced Data for ' + tripId + ': ' + JSON.stringify(data));
  
  return data;
}

// Helper: Find SINGLE record by Linked Record ID (Client-Side) with Pagination
function findRecordByLinkedId_(tableName, linkFieldName, targetId) {
  var offset = null;
  
  do {
    var params = { pageSize: 100 };
    if (offset) params.offset = offset;
    
    var res = airtableGet_(tableName, params);
    var records = (res && res.records) ? res.records : [];
    
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var links = rec.fields[linkFieldName];
      
      // Check if links array contains the target ID
      if (Array.isArray(links)) {
        if (links.indexOf(targetId) !== -1) return rec;
      }
      // Fallback: Check if it's a single string (robustness)
      else if (typeof links === 'string') {
        if (links === targetId) return rec;
      }
    }
    
    offset = res ? res.offset : null;
    if (offset) Utilities.sleep(50); // Small delay to be polite to API
    
  } while (offset);

  return null;
}

// Helper: Find MULTIPLE records by Linked Record ID (Client-Side)
// Modified to support PAGINATION to ensure we scan all records, not just the first page.
function findRecordsByLinkedId_(tableName, linkFieldName, targetId, sortField) {
  var matches = [];
  var offset = null;
  
  do {
    // Fetch a page of records (Airtable default is 100 per page)
    var params = {};
    if (offset) params.offset = offset;
    
    // We don't use maxRecords here to allow pagination through the whole table if needed
    // But we should be careful about large tables. 
    // Ideally, we would use a server-side formula, but linked record IDs are tricky in formulas.
    
    var res = airtableGet_(tableName, params);
    
    if (res && res.records) {
      for (var i = 0; i < res.records.length; i++) {
        var rec = res.records[i];
        var links = rec.fields[linkFieldName];
        
        // Check if links array contains the target ID
        if (links && Array.isArray(links) && links.indexOf(targetId) !== -1) {
          matches.push(rec);
        }
      }
      
      // Get next page offset
      offset = res.offset;
    } else {
      offset = null;
    }
    
    // Safety break to prevent infinite loops in massive tables (e.g. stop after 50 pages = 5000 records)
    // You can adjust this limit based on your table size
    // For now, let's trust we need to find them. But let's add a small sleep to be nice to API.
    if (offset) Utilities.sleep(200);
    
  } while (offset);
  
  // Sort if needed
  if (sortField && matches.length > 0) {
    matches.sort(function(a, b) {
      var valA = a.fields[sortField];
      var valB = b.fields[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
      if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB);
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      return 0;
    });
  }
  
  return matches;
}

// ----------------------------------------------------------
// GOLDEN TEMPLATE: TRIP FACTS
// ----------------------------------------------------------

/**
 * Load the golden template for trip_facts structure
 * This ensures 100% WordPress compatibility by using the exact format
 * that WordPress expects for WP Travel Engine trip facts.
 * 
 * Based on successful manual data entry in WordPress (Trip 16215)
 * 
 * @return {Object} Template with structure and mapping
 */
function loadTripFactsTemplate_() {
  return {
    // Complete WordPress-compatible structure - 6 core fields
    "structure": {
      "12647846": {
        "12647846": "English"
      },
      "35550118": {
        "35550118": "As per itinerary"
      },
      "90730383": {
        "90730383": "Private Tour"
      },
      "97932390": {
        "97932390": "6 hours"
      },
      "97943192": {
        "97943192": "Daily"
      },
      "97950890": {
        "97950890": "Available"
      },
      "field_id": {
        "12647846": "Language",
        "35550118": "Transportation",
        "90730383": "Tour Type",
        "97932390": "Duration",
        "97943192": "Tour Availability",
        "97950890": "Pickup & Drop Off"
      },
      "field_type": {
        "12647846": "text",
        "35550118": "text",
        "90730383": "text",
        "97932390": "text",
        "97943192": "text",
        "97950890": "text"
      }
    },
    
    // Label to FactID mapping (for easy lookup from Airtable data)
    "mapping": {
      "Language": "12647846",
      "Transportation": "35550118",
      "Tour Type": "90730383",
      "Duration": "97932390",
      "Tour Availability": "97943192",
      "Pickup & Drop Off": "97950890",
      "Meals": "69801669",
      "Guiding method": "97927509",
      "Group Size": "93988162",
      "Accomodation": "28890066",
      "Maximum Altitude": "89526429",
      "Fitness level": "69738162",
      "Arrival on": "12660073",
      "Departure from": "32070658",
      "Best season": "33257212",
      "Permits": "31652972",
      "Tour Location": "97941245"
    }
  };
}

// Removed old unused function

function unused_fetchRelatedRecords_(tableName, tripId, tripName, sortField) {
  return [];
}

// ----------------------------------------------------------
// MAPPING
// ----------------------------------------------------------

function mapAirtableToWordPress_(data, tripFields) {
  var g = data.general; // General improvement fields
  
  var payload = {
    core: {},
    meta: {
      wp_travel_engine_setting: {
        cost: {},
        faq: {},
        itinerary: {}
      }
    }
  };

  // --- General Duration Logic (Direct Mapping) ---
  // MODIFIED: Prefer values from Improvement With AI (data.general) if available
  // Also check for space-separated field names (common Airtable issue)
  var dUnit = g.Duration_Unit || g['Duration Unit'] || tripFields.Duration_Unit || tripFields['Duration Unit'] || '';
  var dHours = Number(g.Duration_Hours || g['Duration Hours'] || tripFields.Duration_Hours || tripFields['Duration Hours'] || 0);
  var dMinutes = Number(g.Duration_Minutes || g['Duration Minutes'] || tripFields.Duration_Minutes || tripFields['Duration Minutes'] || 0);
  
  // Prioritize TourType from TripDetails as requested
  var tourType = '';
  if (data.tripDetails && data.tripDetails.TourType) {
    tourType = data.tripDetails.TourType;
  } else {
    tourType = tripFields.TourType || '';
  }

  Logger.log('Publisher: Direct Mapping - dUnit: ' + dUnit + ', dHours: ' + dHours + ', dMinutes: ' + dMinutes + ', tourType: ' + tourType + ', Title: ' + (g.AI_SEO_Title || 'No Title'));

  payload.general = {
    trip_code: tripFields.TripCode || '',
    duration_type: dUnit,
    duration: {
      hours: dHours,
      minutes: dMinutes
    }
  };

  // Map TourType to meta.trip_type
  payload.meta.trip_type = tourType;
  
  // --- Core Fields ---
  // Only update if AI generated a new title/slug, otherwise keep original?
  // Usually we want to use the AI SEO Title if available, or fallback to existing.
  if (g.AI_SEO_Title) payload.core.title = g.AI_SEO_Title;
  
  // 🆕 Use Slug from Trips table (for migrated trips) or AI SEO Permalink
  if (tripFields.Slug) {
    payload.core.slug = tripFields.Slug;
  } else if (g.AI_SEO_Permalink) {
    payload.core.slug = g.AI_SEO_Permalink;
  }
  
  // 🆕 Use StatusWorkflow from Trips table (for migrated trips)
  if (tripFields.StatusWorkflow) {
    payload.core.status = tripFields.StatusWorkflow;
  }
  
  // 🆕 Use AI_Excerpt for WordPress Excerpt if available
  if (g.AI_Excerpt) {
    payload.core.excerpt = g.AI_Excerpt;
  } else if (g.AI_Short_Summary) {
    payload.core.excerpt = g.AI_Short_Summary;
  }
  
  // --- RankMath SEO ---
  if (g.AI_SEO_Title) payload.meta.rank_math_title = g.AI_SEO_Title;
  if (g.AI_SEO_Meta_Description) payload.meta.rank_math_description = g.AI_SEO_Meta_Description;
  
  // Combine Focus Keyword and Keywords List (comma-separated) for RankMath
  var allKeywords = [];
  if (g.AI_SEO_FocusKeywords) allKeywords.push(g.AI_SEO_FocusKeywords);
  
  if (g.AI_SEO_FocusKeywords_List) {
    var list = g.AI_SEO_FocusKeywords_List;
    if (typeof list === 'string') {
        // If string, split and trim
        var parts = list.split(',').map(function(s){ return s.trim(); });
        parts.forEach(function(p){ if(p && allKeywords.indexOf(p) === -1) allKeywords.push(p); });
    } else if (Array.isArray(list)) {
        // If array, add unique items
        list.forEach(function(p){ 
           var s = String(p).trim();
           if(s && allKeywords.indexOf(s) === -1) allKeywords.push(s); 
        });
    }
  }
  
  if (allKeywords.length > 0) {
      payload.meta.rank_math_focus_keyword = allKeywords.join(', ');
  }
  
  // 🆕 TripCode for migrated trips
  if (tripFields.TripCode) {
    payload.meta.trip_code = tripFields.TripCode;
  }

  // 🆕 Force trip_duration_minutes in root meta to override WP calc
  if (dMinutes) {
    payload.meta.trip_duration_minutes = dMinutes;
    payload.meta.trip_duration_minute = dMinutes; // Fallback variant
  } else {
    // Explicitly set to 0 if no minutes to prevent ghost values
    payload.meta.trip_duration_minutes = 0;
    payload.meta.trip_duration_minute = 0;
  }
  
  // --- WP Travel Engine Settings ---
  var wte = payload.meta.wp_travel_engine_setting;

  // --- Duration Mapping (Fix for Duration Update) ---
  // Direct mapping using the values we extracted earlier (L352-354)
  
  // Use the raw unit from Airtable if available, otherwise fallback based on tourType
  if (dUnit) {
     wte.trip_duration_unit = dUnit;
  } else {
     wte.trip_duration_unit = (tourType.indexOf('multi') !== -1) ? 'days' : 'hours';
  }
  
  // Map the values
  wte.trip_duration = dHours; // The primary value is usually stored in Hours field in Airtable
  
  // For single day trips (or if unit is hours), map the specific hour/minute fields
  if (wte.trip_duration_unit === 'hours' || wte.trip_duration_unit === 'hour') {
      wte.trip_duration_hour = dHours;
      wte.trip_duration_hours = dHours;
      wte.trip_duration_minute = dMinutes;
      wte.trip_duration_minutes = dMinutes;
  }

  // --- CRITICAL AVAILABILITY FIX ---
  // Ensure the trip is bookable by default.
  // "No Fixed Departure Available" error appears if trip_fixed_dates is enabled but no dates exist.
  // We force it to 'no' (Open Availability) unless we actually have fixed dates.
  wte.trip_fixed_dates = 'no'; 
  wte.trip_cut_off_time = '0'; // No cutoff time
  wte.trip_min_pax = '1';
  wte.trip_max_pax = '100';
  wte.trip_price_display = 'from'; // Show "From $XXX"

  // Overview
  if (g.AI_Overview_Section_Title) wte.overview_section_title = g.AI_Overview_Section_Title;
  
  // Tab Content (Overview & Why People Love)
  wte.tab_content = {};
  if (g.AI_Trip_Description) wte.tab_content['1_wpeditor'] = g.AI_Trip_Description; // Assuming 1 is Overview
  
  if (g.AI_Why_People_Love_This_Trip_Section_Title) wte.tab_8_title = g.AI_Why_People_Love_This_Trip_Section_Title;
  if (g.AI_Tab_Content) wte.tab_content['8_wpeditor'] = g.AI_Tab_Content; // Assuming 8 is "Why People Love"
  
  // Highlights
  if (g.AI_Trip_Highlights_Section_Title) wte.trip_highlights_title = g.AI_Trip_Highlights_Section_Title;
  if (data.highlights.length > 0) {
    wte.trip_highlights = data.highlights.map(function(rec) {
      return { highlight_text: rec.fields.AI_Highlight };
    });
  }
  
  // Cost (Includes/Excludes)
  if (g.AI_Cost_Section_Title) wte.cost.cost_section_title = g.AI_Cost_Section_Title;
  if (g.AI_Cost_Includes_Title) wte.cost.includes_title = g.AI_Cost_Includes_Title;
  if (g.AI_Cost_Excludes_Title) wte.cost.excludes_title = g.AI_Cost_Excludes_Title;
  
  if (data.includes.length > 0) {
    // WPTE expects a newline-separated string or array? 
    // JSON example shows: "Professional driver...\nHigh-quality..." (String with newlines)
    wte.cost.cost_includes = data.includes.map(function(r){ return r.fields.IncludeItem; }).join('\n');
  }
  if (data.excludes.length > 0) {
    wte.cost.cost_excludes = data.excludes.map(function(r){ return r.fields.ExcludeItem; }).join('\n');
  }
  
  // FAQs
  if (g.AI_FAQ_Section_Title) wte.faq_section_title = g.AI_FAQ_Section_Title;
  if (data.faqs.length > 0) {
    wte.faq.faq_title = [];
    wte.faq.faq_content = [];
    data.faqs.forEach(function(rec) {
      wte.faq.faq_title.push(rec.fields.AI_Question);
      wte.faq.faq_content.push(rec.fields.AI_Answer);
    });
  }
  
  // Itinerary
  // Note: JSON shows `trip_itinerary_title` (section title) vs `itinerary_title` (object of day titles)
  if (g.AI_Itinerary_Section_Title) wte.trip_itinerary_title = g.AI_Itinerary_Section_Title; 
  if (g.AI_Itinerary_Description) wte.trip_itinerary_description = g.AI_Itinerary_Description;
  
  if (data.itinerary.length > 0) {
    wte.itinerary.itinerary_title = {};
    wte.itinerary.itinerary_days_label = {};
    wte.itinerary.itinerary_content = {};
    // wte.itinerary.itinerary_duration = {}; // If supported
    
    data.itinerary.forEach(function(rec, index) {
      // WPTE usually uses 0-based or 1-based index keys. JSON example uses "1", "2".
      // Let's assume 1-based index matching the day number or step order.
      var key = String(index + 1); 
      
      wte.itinerary.itinerary_title[key] = rec.fields.AI_Step_Title;
      wte.itinerary.itinerary_days_label[key] = rec.fields.AI_Step_Label || ('Day ' + key);
      wte.itinerary.itinerary_content[key] = rec.fields.AI_Step_Description;
    });
  }
  
  // Trip Facts - Use Golden Template Structure
  if (g.AI_Trip_Facts_Section_Title) wte.trip_facts_title = g.AI_Trip_Facts_Section_Title;
  
  // Load the golden template structure (WordPress-compatible format)
  var template = loadTripFactsTemplate_();
  
  // Start with empty structure (populate strictly from Airtable to avoid merging duplicates)
  wte.trip_facts = {
    field_id: {},
    field_type: {}
  };
  
  // Update values from Airtable enhanced data
  if (data.facts.length > 0) {
    data.facts.forEach(function(rec) {
      var factLabel = rec.fields.AI_Fact_Label;
      var factValue = rec.fields.AI_Fact_Value;
      var airtableFactId = rec.fields.AI_Fact_ID; // WordPress FactID stored in Airtable
      
      if (factLabel && factValue) {
        // Find the FactID from label mapping
        var factId = template.mapping[factLabel];
        
        // If we have AI_Fact_ID from Airtable, use it (more reliable)
        if (airtableFactId) {
          factId = airtableFactId;
          Logger.log('Publisher: Using AI_Fact_ID from Airtable: ' + airtableFactId + ' for "' + factLabel + '"');
        }
        
        if (factId && wte.trip_facts[factId]) {
          // Update the value in template structure
          wte.trip_facts[factId][factId] = factValue;
          Logger.log('Publisher: Mapped fact "' + factLabel + '" (' + factId + ') = "' + factValue + '"');
        } else if (factId) {
          // FactID not in template - add it dynamically
          Logger.log('Publisher: Adding new fact "' + factLabel + '" (' + factId + ') to template');
          wte.trip_facts[factId] = {};
          wte.trip_facts[factId][factId] = factValue;
          wte.trip_facts.field_id[factId] = factLabel;
          wte.trip_facts.field_type[factId] = 'text';
        } else {
          Logger.log('Publisher: WARNING - Unknown fact label "' + factLabel + '" - skipping');
        }
      } else {
        Logger.log('Publisher: WARNING - Fact missing label or value: ' + JSON.stringify(rec.fields));
      }
    });
  }
  
  Logger.log('Publisher: Trip Facts structure ready with ' + Object.keys(wte.trip_facts).length + ' fields');
  
  // AddOns (Extra Services)
  if (data.addons.length > 0) {
    var serviceIds = [];
    wte.trip_extra_services = data.addons.map(function(rec) {
      var price = rec.fields.AI_AddOn_Price || 0;
      var desc = rec.fields.AI_AddOn_Description || "";
      
      var addon = {
        label: rec.fields.AI_AddOn_Title,
        type: "Default",
        prices: [ price ], // Simple array: [10]
        descriptions: [ desc ], // Simple array: ["text"]
        options: [""] 
      };
      
      if (rec.fields.AddOnID) {
        addon.id = rec.fields.AddOnID;
        serviceIds.push(addon.id);
      }
      
      return addon;
    });
    
    // Set the comma-separated string of active service IDs
    if (serviceIds.length > 0) {
      wte.wte_services_ids = serviceIds.join(',');
    }
  }
  
  // --- Advanced Itinerary (Duration, Meals) ---
  // This is a separate meta field: wte_advanced_itinerary
  if (data.itinerary.length > 0) {
    payload.meta.wte_advanced_itinerary = {
      advanced_itinerary: {
        itinerary_duration: {},
        itinerary_duration_type: {},
        meals_included: []
      }
    };
    
    var advItinerary = payload.meta.wte_advanced_itinerary.advanced_itinerary;
    
    // Build meals_included object (keyed by day number)
    var mealsIncluded = {};
    
    data.itinerary.forEach(function(rec, index) {
      var key = String(index + 1);
      
      // Duration Value (e.g., "4", "8")
      if (rec.fields.AI_Duration_Value) {
        advItinerary.itinerary_duration[key] = String(rec.fields.AI_Duration_Value);
      }
      
      // Duration Type (e.g., "hours", "days", "minutes")
      if (rec.fields.AI_Duration_Unit) {
        // Convert plural to singular if needed (WordPress uses singular)
        var unit = rec.fields.AI_Duration_Unit.toLowerCase();
        if (unit === 'hours') unit = 'hour';
        if (unit === 'days') unit = 'day';
        if (unit === 'minutes') unit = 'minute';
        advItinerary.itinerary_duration_type[key] = unit;
      }
      
      // Meals Included
      // AI_Meals_Included can be:
      // - Multiple Select (array): ["Breakfast", "Lunch"]
      // - Single Line Text: "Breakfast, Lunch"
      // - Single Select: "Breakfast"
      if (rec.fields.AI_Meals_Included) {
        var meals = rec.fields.AI_Meals_Included;
        
        // If it's a string, split by comma
        if (typeof meals === 'string') {
          meals = meals.split(',').map(function(m) { return m.trim(); });
        }
        
        // If it's already an array, convert to lowercase
        if (Array.isArray(meals) && meals.length > 0) {
          // WordPress expects lowercase keys: breakfast, lunch, dinner
          mealsIncluded[key] = meals.map(function(m) { 
            return m.toLowerCase(); 
          });
        }
      }
    });
    
    // Set meals_included (WordPress expects object keyed by day, or array)
    // Based on the JSON structure, it seems to be an object
    advItinerary.meals_included = mealsIncluded;
  }
  
  return payload;
}

// ----------------------------------------------------------
// API TRANSMISSION
// ----------------------------------------------------------

function pushToWordPress_(wpId, payload) {
  // Handle base URL that might end in /trips (as seen in config.gs)
  var baseUrl = CONFIG.WP_API_BASE;
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6); // Remove '/trips' suffix
  
  var url = baseUrl + '/trip/' + wpId; // Construct singular endpoint: .../fts/v1/trip/{id}
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  
  if (code !== 200) {
    throw new Error('WP API Error (' + code + '): ' + text);
  }
  
  var json = JSON.parse(text);
  Logger.log('Publisher: API Response for ' + wpId + ': ' + JSON.stringify(json)); // Log full response for debugging
  
  // Log detailed debug information if available
  if (json.debug_update_core !== undefined) {
    Logger.log('Publisher: DEBUG - Core fields updated: ' + json.debug_update_core);
    Logger.log('Publisher: DEBUG - Core update result: ' + json.debug_core_result);
  }
  if (json.debug_meta_keys_updated) {
    Logger.log('Publisher: DEBUG - Meta keys updated: ' + JSON.stringify(json.debug_meta_keys_updated));
  }
  if (json.debug_wte_setting_updated) {
    Logger.log('Publisher: DEBUG - WTE Setting updated: ' + json.debug_wte_setting_updated);
    Logger.log('Publisher: DEBUG - WTE Setting keys: ' + JSON.stringify(json.debug_wte_setting_keys));
  }
  
  // The PHP endpoint returns the full trip object on success (with 'core', 'meta', etc.)
  // It does NOT return {success: true}.
  // If we got here (HTTP 200), and we have a valid object, it's a success.
  if (!json || (!json.core && !json.success)) {
    // Fallback: if it somehow returns the old format or an error without HTTP error code
    throw new Error('WP API returned unexpected response: ' + text.substring(0, 200) + '...');
  }
}

// ----------------------------------------------------------
// CREATE NEW TRIP ON WORDPRESS
// ----------------------------------------------------------

/**
 * Create a new trip on WordPress
 * @param {Object} payload - Trip data payload
 * @return {string} - WordPress Post ID of the created trip
 */
function createNewTripOnWordPress_(payload) {
  // Handle base URL
  var baseUrl = CONFIG.WP_API_BASE;
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6);
  
  // Use /trips endpoint (plural) for creating new trips
  var url = baseUrl + '/trips'; // Plural = create new
  
  // Prepare payload for creation
  // The endpoint expects: title, content, status, meta
  var createPayload = {
    title: payload.core.title || 'New Trip',
    slug: payload.core.slug || '', // ✅ Ensure Slug is sent on creation
    content: payload.core.content || '',
    status: payload.core.status || 'draft',
    excerpt: payload.core.excerpt || '', // ✅ Add excerpt
    meta: payload.meta || {}
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(createPayload),
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  
  if (code !== 200 && code !== 201) {
    throw new Error('WP API Create Error (' + code + '): ' + text);
  }
  
  var json = JSON.parse(text);
  Logger.log('Publisher: Create API Response: ' + JSON.stringify(json));
  
  // Extract the WordPress Post ID from response
  // The fts_format_trip response has: { core: { id: ... } }
  if (json.core && json.core.id) {
    return String(json.core.id);
  } else if (json.id) {
    return String(json.id);
  } else if (json.post_id) {
    return String(json.post_id);
  } else {
    throw new Error('Could not extract WordPress Post ID from create response');
  }
}

function updatePublishStatus_(tripId, status) {
  var fields = {};
  fields[PUBLISH_STATUS_FIELD] = status;
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

/**
 * Create time-driven trigger for the publisher
 * Run this once to set up automatic publishing
 */
function createPublisherTrigger() {
  if (!isPublisherWorkflowEnabled_()) {
    Logger.log('Publisher: workflow is disabled; not creating trigger');
    return;
  }
  // Delete existing trigger first
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    var funcName = trigger.getHandlerFunction();
    if (funcName === 'runPublisherBatch') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing trigger: runPublisherBatch');
    }
  });
  
  // Create new trigger - runs every 15 minutes
  ScriptApp.newTrigger('runPublisherBatch')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  Logger.log('✅ Created trigger: runPublisherBatch (every 15 minutes)');
}

// ----------------------------------------------------------
// EXTENDED PUBLISHING: PACKAGES & IMAGES
// ----------------------------------------------------------

function publishPackagesSafe_(tripId, wpTripId) {
   try {
     // 1. Fetch Packages & Prices from Airtable
     // Using findRecordsByLinkedId_ for reliable client-side filtering (ignores formula pitfalls)
     var pkgRecords = findRecordsByLinkedId_('Packages', 'Trip', tripId);
     var priceRecords = findRecordsByLinkedId_('Prices', 'Trip', tripId);
     
     if (pkgRecords.length === 0 && priceRecords.length === 0) {
       Logger.log('Publisher: No packages or prices found for Trip ' + tripId);
       return;
     }

     Logger.log('Publisher: Found ' + pkgRecords.length + ' packages and ' + priceRecords.length + ' prices for Trip ' + tripId);

     // Map Price records by PackageID
     var pricesByPkgId = {}; 
     var defaultPrices = []; 
    
    priceRecords.forEach(function(r) {
       var f = r.fields;
       var pidRaw = f.PackageID;
       // Handle Airtable Linked Record array format
       var pid = (Array.isArray(pidRaw) && pidRaw.length > 0) ? pidRaw[0] : pidRaw;
       if (pid) pid = String(pid).trim(); // Normalize ID

       if (pid) {
          if (!pricesByPkgId[pid]) pricesByPkgId[pid] = [];
          pricesByPkgId[pid].push(r); // Store FULL record, not just fields
       } else {
          defaultPrices.push(r); // Store FULL record
       }
    });

    var generatedPackageIds = [];
    
    // Map of known Category Labels to IDs (User Provided)
    var CATEGORY_ID_MAP = {
      'Adult': 11,
      'Child': 12,
      'Children': 330,
      'Infant': 87,
      'Passengers': 88,
      'Student (with ID)': 264
    };
    
    function processPackage(pkgFields, linkedPrices) {
       var payload = {
         trip_id: wpTripId,
         title: pkgFields.PackageTitle || ("Package for Trip " + wpTripId),
         status: 'publish', 
         pricing_categories: [] 
       };
       
       if (linkedPrices && linkedPrices.length > 0) {
          linkedPrices.forEach(function(prRecord) {
             var pr = prRecord.fields; // Access fields here
             
             // Normalize Pricing Type
             var pType = 'per-person'; // Fix: WTE expects 'per-person'
             if (pr.PricingType) {
                var rawType = String(pr.PricingType).toLowerCase();
                if (rawType.indexOf('group') !== -1) pType = 'per-group';
             }
             
             var catLabel = pr.Label || pr.Title || 'Standard';
             var cat = {
                label: catLabel,
                regular_price: (Number(pr.RegularPrice) || 0) === 0 ? "" : Number(pr.RegularPrice),
                sale_price: (Number(pr.SalePrice) || 0) === 0 ? "" : Number(pr.SalePrice),
                min_pax: (pr.MinPax !== undefined && pr.MinPax !== null && pr.MinPax !== "") ? Number(pr.MinPax) : 1,
                max_pax: Number(pr.MaxPax) || 100,
                pricing_type: pType
             };
             
             // Inject ID if mapped
             if (CATEGORY_ID_MAP[catLabel]) {
                cat.id = CATEGORY_ID_MAP[catLabel];
             }
             
             if (pr.GroupPricing) {
                try { 
                   var gpData = JSON.parse(pr.GroupPricing);
                   if (Array.isArray(gpData) && gpData.length > 0) {
                      // Check for dummy group pricing (price 0) when regular price is set
                      var gpPrice = gpData[0].price;
                      var gpPriceNum = Number(gpPrice);
                      
                      // Robust check: include loose equality for '0' string
                      // If either regular_price or sale_price is set, we consider this a priced package and skip dummy (0) group pricing.
                      var isDummy = (gpData.length === 1 && (cat.regular_price > 0 || cat.sale_price > 0) && (gpPrice == 0 || gpPriceNum === 0 || isNaN(gpPriceNum)));
                      
                      if (!isDummy) {
                         cat.group_pricing = gpData;
                      } else {
                         Logger.log('Publisher: Skipping dummy group pricing for ' + cat.label + ' (Regular: ' + cat.regular_price + ')');
                      }
                   }
                } catch(e) {}
             }
             
             // Skip category if price is 0 (and no valid group pricing)
             var hasPrice = (cat.regular_price > 0 || cat.sale_price > 0);
             var hasValidGroupPrice = false;
             
             if (cat.group_pricing && Array.isArray(cat.group_pricing) && cat.group_pricing.length > 0) {
                 // Check if any group pricing entry has a price > 0
                 hasValidGroupPrice = cat.group_pricing.some(function(gp) {
                     var p = Number(gp.price);
                     return !isNaN(p) && p > 0;
                 });
             }
             
             if (hasPrice || hasValidGroupPrice) {
                payload.pricing_categories.push(cat);
             } else {
                Logger.log('Publisher: Skipping category ' + cat.label + ' because price is 0 and no valid group pricing');
             }
          });
       } else {
          var mainCat = {
             label: pkgFields.PackageTitle || 'Standard Package',
             regular_price: Number(pkgFields.RegularPrice) || 0,
             sale_price: Number(pkgFields.SalePrice) || 0,
             min_pax: (pkgFields.MinPax !== undefined && pkgFields.MinPax !== null && pkgFields.MinPax !== "") ? Number(pkgFields.MinPax) : 1,
             max_pax: Number(pkgFields.MaxPax) || 100,
             pricing_type: 'per-person' 
          };
          if (pkgFields.GroupPricing) {
             try { 
                var gpData = JSON.parse(pkgFields.GroupPricing);
                if (Array.isArray(gpData) && gpData.length > 0) {
                   // Check for dummy group pricing
                   var gpPrice = gpData[0].price;
                   var gpPriceNum = Number(gpPrice);
                   
                   // Robust check for dummy/default group pricing
                   var isDummy = (gpData.length === 1 && (mainCat.regular_price > 0 || mainCat.sale_price > 0) && (gpPrice == 0 || gpPriceNum === 0 || isNaN(gpPriceNum)));
                   
                   if (!isDummy) {
                      mainCat.group_pricing = gpData;
                   } else {
                      Logger.log('Publisher: Skipping dummy group pricing for Main Package (Regular: ' + mainCat.regular_price + ')');
                   }
                }
             } catch(e) {
                Logger.log('Publisher: Error parsing GroupPricing for Main Package: ' + e.message);
             }
          }
          if (pkgFields.PricingCategories) {
             try { 
                var parsedCats = JSON.parse(pkgFields.PricingCategories);
                if (Array.isArray(parsedCats)) payload.pricing_categories = parsedCats;
                else payload.pricing_categories.push(mainCat);
             } catch(e) { payload.pricing_categories.push(mainCat); }
          } else {
             payload.pricing_categories.push(mainCat);
          }
       }
       
       Logger.log('Publisher: Built Package Payload: ' + JSON.stringify(payload));
       return payload;
    }

    // 2. Process Existing Packages
    if (pkgRecords.length > 0) {
        pkgRecords.forEach(function(pkg) {
           var f = pkg.fields || {};
           var pkId = pkg.id; // Airtable Record ID
           var pkTextId = f.PackageID; // Text/Number ID
           if (pkTextId) pkTextId = String(pkTextId).trim(); // Normalize

           // Get linked prices - Match by Record ID OR Text ID
           var linked = [];
           if (pricesByPkgId[pkId]) linked = linked.concat(pricesByPkgId[pkId]);
           if (pkTextId && pricesByPkgId[pkTextId]) {
               // Avoid duplicates if both match
               pricesByPkgId[pkTextId].forEach(function(p) {
                   var exists = linked.some(function(l) { return l.id === p.id; });
                   if (!exists) linked.push(p);
               });
           }
           
           // Fallback: If ONLY ONE package exists, assume ALL prices for this trip belong to it.
           if (pkgRecords.length === 1) {
               Logger.log('Publisher: Single package detected. Linking ALL ' + priceRecords.length + ' prices to it.');
               linked = priceRecords;
           }

           var payload = processPackage(f, linked); // Pass linked prices!
           
           Logger.log('Publisher: Sending package "' + payload.title + '" to WP...');
           var newId = sendPackageToWp(payload);
           
           if (newId) {
              Logger.log('Publisher: Package created with ID: ' + newId + '. Updating Airtable...');
              generatedPackageIds.push(newId);
              
              // 1. Update Package Record
              try {
                  airtableUpdate_('Packages', pkg.id, { PackageID: String(newId) });
                  Logger.log('Publisher: Updated Packages table for record ' + pkg.id);
              } catch (e) {
                  Logger.log('Publisher: ERROR updating Packages table: ' + e.message);
              }
              
              // 2. Update Linked Prices Records
              // If single package mode, use ALL priceRecords, otherwise use 'linked' subset
              var pricesToUpdate = (pkgRecords.length === 1) ? priceRecords : linked;
              
              if (pricesToUpdate.length > 0) {
                  Logger.log('Publisher: Updating ' + pricesToUpdate.length + ' prices with new PackageID ' + newId + '...');
                  pricesToUpdate.forEach(function(prRecord) {
                      try {
                          var currentPid = prRecord.fields.PackageID;
                          // Force update if ID is different OR if it's missing
                           if (String(currentPid) !== String(newId)) {
                              airtableUpdate_('Prices', prRecord.id, { PackageID: String(newId) });
                              Logger.log('Publisher: Updated Price ' + prRecord.id + ' with PackageID ' + newId);
                              // Add delay to avoid Airtable rate limits (5 req/sec)
                              Utilities.sleep(400);
                           } else {
                             Logger.log('Publisher: Price ' + prRecord.id + ' already has correct PackageID');
                          }
                      } catch(e) {
                          Logger.log('Publisher: Warning - Failed to update Price ' + prRecord.id + ': ' + e.message);
                      }
                  });
              }
           } else {
              Logger.log('Publisher: ERROR - Failed to create package on WordPress. Skipping Airtable updates.');
           }
        });
    } else if (priceRecords.length > 0) {
       // 3. Fallback: If NO Packages table records but we have Prices records
       Logger.log('Publisher: Found Prices but no Packages. Creating default package.');
       var payload = processPackage({ PackageTitle: "Standard Options" }, priceRecords);
       var newId = sendPackageToWp(payload);
       if (newId) generatedPackageIds.push(newId);
    }

    // 4. Link Packages to Trip
    if (generatedPackageIds.length > 0) {
       var metaUpdate = {
         meta: {
           packages_ids: generatedPackageIds,
           wp_travel_engine_setting: {
             packages_ids: generatedPackageIds
           }
         }
       };
       pushToWordPress_(wpTripId, metaUpdate);
       Logger.log('Publisher: Linked packages ' + generatedPackageIds.join(',') + ' to Trip ' + wpTripId);
    }

  } catch (e) {
    Logger.log('Publisher: Error in publishPackagesForTrip - ' + e.message);
  }
}

function sendPackageToWp(payload) {
      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        headers: {
          'Authorization': 'Basic ' + Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
        },
        muteHttpExceptions: true
      };
      
      var baseUrl = CONFIG.WP_API_BASE;
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      // Fix: If base URL ends with /trips, remove it to get the root API path
      // This is crucial because packages endpoint is likely /wp-json/wp/v2/trip_packages or similar
      // BUT based on the logic, the user expects /wp-json/fts/v1/packages
      if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6);
      
      var url = baseUrl + '/packages';

      var resp = UrlFetchApp.fetch(url, options);
      var json = JSON.parse(resp.getContentText());

      if (json && json.id) {
         Logger.log('Publisher: Created Package ' + json.id);
         return json.id;
      } else {
         Logger.log('Publisher: Failed to create package ' + JSON.stringify(json));
         return null;
      }
}

function publishImagesSafe_(tripId, wpTripId, tripFields) {
   // 1. Fetch Improvement Records (for Metadata & Gallery)
   var impRecords = findRecordsByLinkedId_(IMAGES_IMPROVEMENT_TABLE, 'Trip', tripId);
   
   // 2. Fetch Raw Images Records (for Featured Image Matching by Attachment)
   // We need this because Improvement table has IDs but NOT the attachment files for matching
   var rawImagesRecords = findRecordsByLinkedId_('Images', 'SourceTrip', tripId);
   if (!rawImagesRecords || rawImagesRecords.length === 0) {
      Logger.log('Publisher: No images found in Images table using SourceTrip, trying Trip column...');
      rawImagesRecords = findRecordsByLinkedId_('Images', 'Trip', tripId);
   }
   
   if (rawImagesRecords && rawImagesRecords.length > 0) {
       Logger.log('Publisher: Found ' + rawImagesRecords.length + ' raw images. First record fields: ' + JSON.stringify(rawImagesRecords[0].fields));
   }

   // Map Airtable Record ID -> WP Media ID
   var imageMap = {};
   if (rawImagesRecords) {
       rawImagesRecords.forEach(function(r) {
           var wpId = r.fields.ImageID || r.fields.IMAGE || r.fields.ID;
           if (Array.isArray(wpId)) wpId = wpId[0];
           if (wpId) imageMap[r.id] = wpId;
       });
   }
   
   // Check if we have a Featured Image in the Trip record itself
   var hasFeaturedImage = tripFields && (tripFields.FeaturedImage || tripFields['Featured Image']) && (tripFields.FeaturedImage || tripFields['Featured Image']).length > 0;

   if ((!impRecords || impRecords.length === 0) && (!rawImagesRecords || rawImagesRecords.length === 0) && !hasFeaturedImage) {
      Logger.log('Publisher: No images found linked to Trip ' + tripId + ' and no Featured Image in trip fields.');
      return;
   }
   
   var galleryIds = [];
   var featId = null;
   
   // --- Step A: Try to find Featured Image ID from Raw Images Table ---
   if (tripFields) {
       var tripFeaturedImg = tripFields.FeaturedImage || tripFields['Featured Image'];
       
       if (tripFeaturedImg && tripFeaturedImg.length > 0) {
           var targetAtt = tripFeaturedImg[0];
           var targetId = targetAtt.id;
           var targetFilename = targetAtt.filename ? targetAtt.filename.toLowerCase() : '';
           var targetSize = targetAtt.size;
           
           Logger.log('Publisher: Looking for FeaturedImage match. Target ID: ' + targetId + ', Filename: ' + targetFilename);
           
           if (rawImagesRecords && rawImagesRecords.length > 0) {
               Logger.log('Publisher: Searching in ' + rawImagesRecords.length + ' raw image records...');
               for (var i = 0; i < rawImagesRecords.length; i++) {
                   var rawRec = rawImagesRecords[i];
                   var rawF = rawRec.fields;
                   
                   // Assuming the attachment field in Images table is named 'Image' (standard)
                   var rawAtts = rawF.Image || rawF.Attachments || rawF.File; 
                   var rawUrl = rawF.URL || rawF.Url || rawF.url;
    
                   if ((!rawAtts || !rawAtts.length) && !rawUrl) continue;
                   
                   var candAtt = (rawAtts && rawAtts.length) ? rawAtts[0] : null;
                   var isMatch = false;
                   
                   // Match Logic
                   // 1. Exact Attachment ID Match (only if candidate has attachment)
                   if (candAtt && candAtt.id === targetId) {
                       isMatch = true;
                       Logger.log('Publisher: Found FeaturedImage match by Attachment ID! WP_ID: ' + (rawF.ImageID || rawF.IMAGE));
                   }
                   // 2. Exact Filename Match (only if candidate has attachment)
                   else if (candAtt && targetFilename && candAtt.filename && candAtt.filename.toLowerCase() === targetFilename) {
                       isMatch = true;
                       Logger.log('Publisher: Found FeaturedImage match by Filename! WP_ID: ' + (rawF.ImageID || rawF.IMAGE));
                   }
                   // 3. Backup Match: File Size (Exact) (only if candidate has attachment)
                   else if (candAtt && targetSize && candAtt.size === targetSize) {
                       isMatch = true;
                       Logger.log('Publisher: Found FeaturedImage match by File Size! WP_ID: ' + (rawF.ImageID || rawF.IMAGE));
                   }
                   // 4. Fuzzy Match: File Size (within 100 bytes) (only if candidate has attachment)
                   else if (candAtt && targetSize && Math.abs(candAtt.size - targetSize) < 100) {
                       isMatch = true;
                       Logger.log('Publisher: Found FeaturedImage match by Fuzzy File Size! WP_ID: ' + (rawF.ImageID || rawF.IMAGE));
                   }
                   // 5. Fuzzy Match: Filename (Substring) (only if candidate has attachment)
                   else if (candAtt) {
                       var candName = candAtt.filename ? candAtt.filename.toLowerCase() : '';
                       if (candName && targetFilename && (candName.indexOf(targetFilename) !== -1 || targetFilename.indexOf(candName) !== -1)) {
                           isMatch = true;
                           Logger.log('Publisher: Found FeaturedImage match by Filename Substring! WP_ID: ' + (rawF.ImageID || rawF.IMAGE));
                       }
                   }
                   // 6. URL Match (Fallback if no attachment or attachment match failed)
                   if (!isMatch && rawUrl && targetFilename) {
                       // Check if target filename exists in the raw URL
                       // targetFilename: "my-image.jpg"
                       // rawUrl: "https://site.com/.../my-image-scaled.jpg"
                       var cleanUrl = rawUrl.toLowerCase();
                       // Remove extension from target to match against scaled versions in URL if needed?
                       // Or just check substring
                       if (cleanUrl.indexOf(targetFilename) !== -1) {
                           isMatch = true;
                           Logger.log('Publisher: Found FeaturedImage match by URL Substring! WP_ID: ' + (rawF.ImageID || rawF.IMAGE));
                       }
                   }
                   
                   if (isMatch) {
                       // Found the record! Now get the WP ID
                       var foundId = rawF.ImageID || rawF.IMAGE || rawF.ID; // Try multiple field names
                       
                       // Handle Lookup/Array values (if ImageID is a lookup)
                       if (Array.isArray(foundId)) foundId = foundId[0];
                       
                       if (foundId) {
                           featId = foundId;
                           Logger.log('Publisher: ✅ Found Featured Image ID in Raw Images table: ' + featId);
                           break;
                       } else {
                           Logger.log('Publisher: Match found but ImageID field is empty in Raw Images table.');
                       }
                   }
               }
           }
           
           // FALLBACK: If we have a URL but no ID found (or no raw records), UPLOAD IT!
           if (!featId && targetAtt && targetAtt.url) {
              Logger.log('Publisher: No matching WP ID found for Featured Image (or no Raw Images records). Uploading from URL...');
              var newMediaId = uploadMediaFromUrl_(targetAtt.url, (tripFields.Title || 'trip') + '-featured');
              if (newMediaId) {
                 featId = newMediaId;
                 Logger.log('Publisher: ✅ Uploaded and set new Featured Image ID: ' + featId);

                 // --- NEW: AI Enhancement for Featured Image ---
                 try {
                     Logger.log('Publisher: Enhancing Featured Image Metadata (AI)...');
                     
                     var fakeImageFields = {
                         Title: targetFilename || 'Featured Image',
                         URL: targetAtt.url,
                         Caption: '',
                         Alt: ''
                     };
                     
                     // Build context (imageId is null)
                     var ctx = buildImageContext_(fakeImageFields, tripFields, null, tripId);
                     
                     // Build prompt
                     var prompt = buildImagesPrompt_(ctx);
                     
                     // Call AI
                     var aiResult = callAi_(prompt);
                     
                     if (aiResult && typeof aiResult === 'object') {
                         var title = (aiResult.title || '').toString().trim();
                         var caption = (aiResult.caption || '').toString().trim();
                         var description = (aiResult.description || '').toString().trim();
                         var alt = (aiResult.alt || '').toString().trim();
                         
                         // Validate lengths
                         if (title.length > 60) title = title.substring(0, 60).trim();
                         if (caption.length > 150) caption = caption.substring(0, 150).trim();
                         if (description.length > 300) description = description.substring(0, 300).trim();
                         if (alt.length > 125) alt = alt.substring(0, 125).trim();
                         
                         Logger.log('Publisher: AI Metadata Generated -> Title: ' + title);
                         
                         updateMediaOnWordPress_(newMediaId, {
                             title: title,
                             caption: caption,
                             alt_text: alt,
                             description: description || caption
                         });
                         Logger.log('Publisher: ✅ Featured Image Metadata updated on WordPress.');
                     }
                 } catch (e) {
                     Logger.log('Publisher: Warning - Failed to enhance Featured Image metadata: ' + e.message);
                 }
              }
           }
       }
   }
   
   // --- Step B: Build Gallery from Improvement Records ---
   // (And fallback to finding featured image here if not found above)
   
   var processedRawIds = [];

   if (impRecords && impRecords.length > 0) {
       impRecords.forEach(function(imgRec) {
           var f = imgRec.fields;
           var wpMediaId = f.ImageID || f.IMAGE; 
           
           if (Array.isArray(wpMediaId)) wpMediaId = wpMediaId[0];
           
           // If it looks like an Airtable ID (starts with rec), try to resolve it
           if (wpMediaId && String(wpMediaId).indexOf('rec') === 0) {
               if (imageMap[wpMediaId]) {
                   wpMediaId = imageMap[wpMediaId];
               } else {
                   wpMediaId = null; // Can't use Airtable ID directly
               }
           }
           
           // If no direct WP ID, try to resolve via Linked Record
           if (!wpMediaId) {
               var linkedImage = f.Image || f.Images;
               if (Array.isArray(linkedImage) && linkedImage.length > 0) {
                   var linkedId = linkedImage[0];
                   if (imageMap[linkedId]) {
                       wpMediaId = imageMap[linkedId];
                   }
               }
           }
           
           // --- NEW: Upload from URL if ID missing but URL available ---
           // This handles gallery images that are in Airtable but not yet in WordPress
           if (!wpMediaId) {
              // Try to find the raw record to get the URL
              var linkedImage = f.Image || f.Images;
              if (Array.isArray(linkedImage) && linkedImage.length > 0) {
                 var linkedId = linkedImage[0];
                 
                 // Mark as processed so we don't duplicate it in Step B.2
                 processedRawIds.push(linkedId);
                 
                 // Find the raw record in rawImagesRecords
                 var rawRec = rawImagesRecords ? rawImagesRecords.find(function(r) { return r.id === linkedId; }) : null;
                 
                 if (rawRec) {
                    var rawAtts = rawRec.fields.Image || rawRec.fields.Attachments || rawRec.fields.File;
                    var rawUrl = rawRec.fields.URL || rawRec.fields.Url || rawRec.fields.url;
                    
                    var targetUrl = null;
                    if (rawAtts && rawAtts.length > 0) targetUrl = rawAtts[0].url;
                    else if (rawUrl) targetUrl = rawUrl;
                    
                    if (targetUrl) {
                       Logger.log('Publisher: Gallery Image ' + linkedId + ' missing WP ID. Uploading from URL...');
                       var newId = uploadMediaFromUrl_(targetUrl, (tripFields.Title || 'trip') + '-gallery-' + linkedId);
                       if (newId) {
                          wpMediaId = newId;
                          // Update the mapping so we don't upload it again if referenced twice
                          imageMap[linkedId] = newId;
                          
                          // Optional: Update the Raw Images table with the new ID to avoid re-uploading next time
                          try {
                             airtableUpdate_('Images', linkedId, { ImageID: String(newId) });
                          } catch(e) {
                             Logger.log('Publisher: Warning - Failed to save new ImageID to Images table: ' + e.message);
                          }
                       }
                    }
                 }
              }
           } else {
               // If we have a wpMediaId, we should also mark the linked raw record as processed if possible
               var linkedImage = f.Image || f.Images;
               if (Array.isArray(linkedImage) && linkedImage.length > 0) {
                   processedRawIds.push(linkedImage[0]);
               }
           }
           
           if (wpMediaId) {
               // If we found a featured ID above, we don't need to look for 'Featured' type here
               if (f.Type === 'Featured') {
                   // Only override if we didn't find one by exact match, OR if we trust this explicit tag more?
                   // Let's say explicit tag in Improvement table is strong signal, but maybe exact match is better?
                   // Use it if we don't have one yet.
                   if (!featId) featId = wpMediaId;
               }
               
               galleryIds.push(wpMediaId);

               // --- NEW: Update Image Metadata (Title, Caption, Alt) ---
               // We use the standard WordPress REST API for this: /wp-json/wp/v2/media/{id}
               if (f.AI_Title || f.AI_Caption || f.AI_Alt || f.AI_Description) {
                   updateMediaOnWordPress_(wpMediaId, {
                       title: f.AI_Title,
                       caption: f.AI_Caption,
                       alt_text: f.AI_Alt,
                       description: f.AI_Description || f.AI_Caption // Use Description if available, else fallback to Caption
                   });
                   // Add a small delay to avoid overwhelming the server if many images
                   Utilities.sleep(200); 
               }
           }
       });
   }

   // --- Step B.2: Fallback for Raw Images not in Improvement Table ---
   if (rawImagesRecords && rawImagesRecords.length > 0) {
       Logger.log('Publisher: Checking ' + rawImagesRecords.length + ' raw images for missing gallery items...');
       rawImagesRecords.forEach(function(rawRec) {
           if (processedRawIds.indexOf(rawRec.id) !== -1) {
               return; // Already processed via improvement record
           }
           
           var f = rawRec.fields;
           var wpMediaId = f.ImageID || f.IMAGE || f.ID;
           
           if (Array.isArray(wpMediaId)) wpMediaId = wpMediaId[0];
           
           // If missing, try upload
           if (!wpMediaId) {
                var rawAtts = f.Image || f.Attachments || f.File;
                var rawUrl = f.URL || f.Url || f.url;
                
                var targetUrl = null;
                if (rawAtts && rawAtts.length > 0) targetUrl = rawAtts[0].url;
                else if (rawUrl) targetUrl = rawUrl;
                
                if (targetUrl) {
                   Logger.log('Publisher: Raw Image ' + rawRec.id + ' missing WP ID. Uploading from URL...');
                   var newId = uploadMediaFromUrl_(targetUrl, (tripFields.Title || 'trip') + '-gallery-raw-' + rawRec.id);
                   if (newId) {
                      wpMediaId = newId;
                      // Save back to Airtable
                      try {
                         airtableUpdate_('Images', rawRec.id, { ImageID: String(newId) });
                      } catch(e) {}
                   }
                }
           }
           
           if (wpMediaId) {
               galleryIds.push(wpMediaId);
           }
       });
   }

   // --- Step C: Finalize Payload ---
   if (featId || galleryIds.length > 0) {
     // Deduplicate Gallery IDs
     var uniqueGalleryIds = [];
     var seenIds = {};
     for (var g = 0; g < galleryIds.length; g++) {
         var gid = String(galleryIds[g]);
         if (!seenIds[gid]) {
             seenIds[gid] = true;
             uniqueGalleryIds.push(galleryIds[g]);
         }
     }
     galleryIds = uniqueGalleryIds;

     var payload = { meta: { wp_travel_engine_setting: {} } };
     
     if (featId) {
        payload.meta._thumbnail_id = featId;
        // Remove featId from galleryIds to avoid duplication
        galleryIds = galleryIds.filter(function(id) { return String(id) !== String(featId); });
     }
     
     if (galleryIds.length) {
        var galObj = { "enable": "1" };
        galleryIds.forEach(function(id, idx) { galObj[String(idx)] = id; });
        payload.meta.wpte_gallery_id = galObj;
     }
     
     pushToWordPress_(wpTripId, payload);
     Logger.log('Publisher: Published Images for Trip ' + wpTripId + ' (Featured: ' + (featId || 'None') + ', Gallery: ' + galleryIds.length + ')');
   }
}

/**
 * Update WordPress Media/Attachment Metadata
 * Uses standard WP API: POST /wp-json/wp/v2/media/{id}
 */
function updateMediaOnWordPress_(mediaId, data) {
  // Construct standard WP API URL
  // Assume CONFIG.WP_API_BASE is like "https://site.com/wp-json/fts/v1"
  // We want "https://site.com/wp-json/wp/v2/media/{id}"
  
  var baseUrl = CONFIG.WP_API_BASE;
  var rootUrl = baseUrl;
  
  if (baseUrl.indexOf('/wp-json/') !== -1) {
    rootUrl = baseUrl.split('/wp-json/')[0];
  } else {
    // Fallback if structure is different
    Logger.log('Publisher: Warning - Could not determine WP root URL from ' + baseUrl);
    return;
  }
  
  var mediaUrl = rootUrl + '/wp-json/wp/v2/media/' + mediaId;
  
  var payload = {};
  if (data.title) payload.title = data.title;
  if (data.caption) payload.caption = data.caption;
  if (data.alt_text) payload.alt_text = data.alt_text;
  if (data.description) payload.description = data.description;
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };
  
  try {
      var resp = UrlFetchApp.fetch(mediaUrl, options);
      if (resp.getResponseCode() === 200) {
          Logger.log('Publisher: Updated Media ' + mediaId + ' metadata (Title: ' + (data.title ? 'Yes' : 'No') + ')');
      } else {
          Logger.log('Publisher: Failed to update Media ' + mediaId + ': ' + resp.getContentText());
      }
  } catch (e) {
      Logger.log('Publisher: Error updating Media ' + mediaId + ': ' + e.message);
  }
}

/**
 * Upload an image from an external URL to WordPress Media Library
 * @param {string} imageUrl - Direct URL to the image
 * @param {string} title - Optional title/filename for the image
 * @return {string|null} - The new WordPress Media ID, or null if failed
 */
function uploadMediaFromUrl_(imageUrl, title) {
  if (!imageUrl) return null;
  
  // Clean URL
  imageUrl = imageUrl.trim();
  
  // FIX: Convert Google Drive Viewer URL to Direct Download URL
  if (imageUrl.indexOf('drive.google.com') !== -1) {
    // Pattern: https://drive.google.com/file/d/[FILE_ID]/view...
    var idMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      imageUrl = 'https://drive.google.com/uc?export=download&id=' + idMatch[1];
      Logger.log('Publisher: Converted Google Drive URL to: ' + imageUrl);
    }
  }
  
  // Set filename
  var filename = 'image.jpg';
  if (title) {
    // Sanitize title for filename
    filename = title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.jpg';
  } else {
    // Try to get filename from URL
    var parts = imageUrl.split('/');
    var lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.indexOf('.') !== -1) {
      filename = lastPart.split('?')[0]; // Remove query params
    }
  }
  
  Logger.log('Publisher: Attempting to upload image from URL: ' + imageUrl);
  
  try {
    // 1. Download image from URL
    var imageBlob = UrlFetchApp.fetch(imageUrl).getBlob();
    imageBlob.setName(filename);
    
    // 2. Prepare upload to WordPress
    var baseUrl = CONFIG.WP_API_BASE;
    var rootUrl = baseUrl;
    if (baseUrl.indexOf('/wp-json/') !== -1) {
      rootUrl = baseUrl.split('/wp-json/')[0];
    }
    
    var uploadUrl = rootUrl + '/wp-json/wp/v2/media';
    
    var options = {
      method: 'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS),
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Content-Type': imageBlob.getContentType() || 'image/jpeg'
      },
      payload: imageBlob.getBytes(), // Send raw bytes
      muteHttpExceptions: true
    };
    
    // 3. Send Request
    var resp = UrlFetchApp.fetch(uploadUrl, options);
    var code = resp.getResponseCode();
    var text = resp.getContentText();
    
    if (code === 201 || code === 200) {
      var json = JSON.parse(text);
      if (json && json.id) {
        Logger.log('Publisher: ✅ Successfully uploaded image. New WP ID: ' + json.id);
        return String(json.id);
      }
    }
    
    Logger.log('Publisher: Failed to upload image. Code: ' + code + ', Response: ' + text);
    return null;
    
  } catch (e) {
    Logger.log('Publisher: Error uploading image from URL: ' + e.message);
    return null;
  }
}
