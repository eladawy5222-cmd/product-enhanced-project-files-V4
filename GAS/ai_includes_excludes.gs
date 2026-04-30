/************************************************************
 * AI Includes / Excludes Extractor (SAFE MODE)
 *
 * - يشتغل على جدول Trips، يقرأ الرحلات اللي AI_IncExc_Status = 'Pending'
 * - يبعث نصوص الرحلة للـ AI باستخراج محافظ (بدون اختراع)
 * - يخزّن النتيجة في:
 *      TripIncludes Improvement With AI  (IncludeItem)
 *      TripExcludes Improvement With AI  (ExcludeItem)
 * - لا يلمس الجداول الخام TripIncludes / TripExcludes
 ************************************************************/

var TRIPS_TABLE                       = 'Trips';
var TRIP_INCLUDES_IMPROVEMENT_TABLE   = 'TripIncludes Improvement With AI';
var TRIP_EXCLUDES_IMPROVEMENT_TABLE   = 'TripExcludes Improvement With AI';
var TRIP_INCLUDES_BASE_TABLE          = 'TripIncludes';
var TRIP_EXCLUDES_BASE_TABLE          = 'TripExcludes';

var AI_INCEXC_BATCH_LIMIT             = 1; // Process one trip at a time

// حدود عدد السجلات لكل رحلة
var MIN_INCLUDES_COUNT                = 4;  // الحد الأدنى للعناصر المشمولة
var MAX_INCLUDES_COUNT                = 16; // الحد الأقصى للعناصر المشمولة
var MIN_EXCLUDES_COUNT                = 4;  // الحد الأدنى للعناصر غير المشمولة
var MAX_EXCLUDES_COUNT                = 6;  // الحد الأقصى للعناصر غير المشمولة (مخفّض)

// اسم حقل الـ Link في جداول الـ Improvement (link to Trips)
var TRIP_LINK_FIELD_IN_INCLUDES       = 'Trip';
var TRIP_LINK_FIELD_IN_EXCLUDES       = 'Trip';

// أسماء الحقول النصية في improvement tables
var INCLUDE_TEXT_FIELD                = 'IncludeItem';
var EXCLUDE_TEXT_FIELD                = 'ExcludeItem';

// اسم حقل الكنترول في Trips
var TRIP_INCEXC_STATUS_FIELD          = 'AI_IncExc_Status';

/**
 * ENTRY POINT
 */
function runAiIncludesExcludesExtractionBatch() {
  loadConfigSecrets_();
  Logger.log('AI Inc/Exc: starting batch...');

  try {
    var trips = fetchTripsNeedingIncExc_(AI_INCEXC_BATCH_LIMIT);

    if (!trips || !trips.length) {
      Logger.log('AI Inc/Exc: no Trips with ' + TRIP_INCEXC_STATUS_FIELD + " = 'Pending'.");
      return;
    }

    trips.forEach(function(tripRec) {
      var tripId = tripRec.id;  // Airtable Record ID (for linked records)
      var fields = tripRec.fields || {};
      var tripNumber = fields.TripID || '';  // The TripID field (e.g. 7583)
      var tripName   = fields.Title || '';   // Trip Name for linking

      try {
        Logger.log('AI Inc/Exc: processing Trip ' + tripId + ' (TripID: ' + tripNumber + ')');

        // 1) علامة "Processing"
        updateTripIncExcStatus_(tripId, 'Processing');
        
        if (!tripNumber) {
          Logger.log('⚠️ Warning: TripID is missing for Trip ' + tripId);
        }

        // 2) بناء Context
        var ctx = buildTripIncExcContext_(fields, tripId);

        var U = buildUnifiedTripContext_(tripId, fields);
        var combinedText = (ctx.tripDescription || '') +
                           (ctx.aiTripDescription || '') +
                           (ctx.itineraryDescription || '') +
                           (ctx.aiItineraryDescription || '') +
                           (ctx.tabContent || '') +
                           (ctx.aiTabContent || '');

        // 🆕 استخدام طريقة البحث المتقدمة (Robust Search) بدلاً من U.includesRawArr
        var rawIncludes = fetchRawIncludesForTrip_(tripId, tripNumber, tripName);
        var rawExcludes = fetchRawExcludesForTrip_(tripId, tripNumber, tripName);

        // 🔍 LOGGING RAW DATA (User Request)
        Logger.log('🔍 DATA CHECK [Trip ' + tripId + ']: Found ' + rawIncludes.length + ' items in TripIncludes (Raw).');
        if (rawIncludes.length > 0) {
          Logger.log('   Sample Raw Includes: ' + rawIncludes.slice(0, 3).join(' | '));
        } else {
          Logger.log('   ⚠️ Warning: TripIncludes (Raw) is empty! This is the primary source.');
        }

        Logger.log('🔍 DATA CHECK [Trip ' + tripId + ']: Found ' + rawExcludes.length + ' items in TripExcludes (Raw).');
        if (rawExcludes.length > 0) {
          Logger.log('   Sample Raw Excludes: ' + rawExcludes.slice(0, 3).join(' | '));
        } else {
          Logger.log('   ⚠️ Warning: TripExcludes (Raw) is empty!');
        }

        var linkedTextBlocks = [U.highlightsText, U.itineraryText, U.addonsText, U.detailsText, U.packagesText, U.faqsText, U.pickupText].filter(function(s){return !!s;});

        if (!combinedText.trim() && (!rawIncludes.length && !rawExcludes.length) && !(linkedTextBlocks && linkedTextBlocks.length)) {
          Logger.log('AI Inc/Exc: Trip ' + tripId + ' has no cost lists or text; marking as Empty.');
          updateTripIncExcStatus_(tripId, 'Empty');
          return;
        }

        // 🆕 حذف السجلات القديمة قبل الإنتاج الجديد
        deleteOldIncludesExcludesForTrip_(tripId, tripNumber);


        // 3) جلب البيانات المحسنة من الجداول الأخرى
        var improvedHighlights = U.highlightsText;
        var improvedItinerary = U.itineraryText;
        var improvedAddOns = U.addonsText;
        var improvedAddOnsData = fetchImprovedAddOnsDataForTrip_(tripId, tripNumber, tripName); // Get structured data

        // 4) بناء الـ Prompt مع مراعاة الاختيارية
        var prompt = buildIncExcExtractionPrompt_(ctx, rawIncludes, rawExcludes, linkedTextBlocks, improvedHighlights, improvedItinerary, improvedAddOns);

        // 4) استدعاء الـ AI (نفس دالة callAi_ اللي عندك)
        var aiResult = callAi_(prompt);

        if (!aiResult || typeof aiResult !== 'object') {
          throw new Error('Invalid AI result for Inc/Exc (not an object).');
        }

        var includes = aiResult.includes || [];
        var excludes = aiResult.excludes || [];

        if (!Array.isArray(includes)) includes = [];
        if (!Array.isArray(excludes)) excludes = [];
        
        // 🆕 Post-processing: إصلاح تنسيق AddOns تلقائياً
        includes = reformatAddOnsInIncludes_(includes, improvedAddOnsData, tripId);

        // 🆕 Post-processing: تصفية الكلمات المحظورة (مع السماح بما هو موجود في المصدر)
        includes = sanitizeTransportationWords_(includes, tripId, rawIncludes);
        excludes = sanitizeTransportationWords_(excludes, tripId, rawExcludes);

        // 🆕 Post-processing: تطبيق الحدود مع التجميع الذكي
        includes = enforceCountLimitsWithGrouping_(includes, MIN_INCLUDES_COUNT, MAX_INCLUDES_COUNT, 'includes', tripId);
        excludes = enforceCountLimitsWithGrouping_(excludes, MIN_EXCLUDES_COUNT, MAX_EXCLUDES_COUNT, 'excludes', tripId);

        // 🆕 ضمان الحد الأدنى للـ Excludes بإضافة excludes افتراضية
        if (excludes.length < MIN_EXCLUDES_COUNT) {
          var needed = MIN_EXCLUDES_COUNT - excludes.length;
          Logger.log('⚠️ Adding ' + needed + ' default excludes to meet minimum requirement');
          var defaultExcludes = getDefaultExcludes_(needed);
          
          // تجنب التكرار
          defaultExcludes.forEach(function(def) {
            if (excludes.indexOf(def) === -1 && excludes.length < MIN_EXCLUDES_COUNT) {
              excludes.push(def); 
            }
          });
          
          // 🆕 إعادة الفلترة للتأكد من عدم إضافة Entrance fees أو أشياء متعارضة عبر الـ Defaults
          excludes = filterConflictingExcludes_(excludes, includes, rawExcludes, tripId);
        }

        // 🆕 تحسين الجودة: إزالة التكرار واختصار النصوص الطويلة
        includes = deduplicateSimilarItems_(includes, 'includes', tripId);
        excludes = deduplicateSimilarItems_(excludes, 'excludes', tripId);
        
        includes = shortenLongTexts_(includes);
        excludes = shortenLongTexts_(excludes);
        
        // 🆕 إزالة التكرار الصارم وضمان وجود الـ AddOns الاختيارية بصيغة واحدة فقط
        includes = finalizeIncludesNoDup_(includes, improvedAddOnsData);
        excludes = finalizeNoDupStrict_(excludes);
        
        // 🆕 فلترة excludes الغريبة أو غير المناسبة
        excludes = filterInappropriateExcludes_(excludes, tripId);

        // 🆕 فلترة excludes المتعارضة مع includes (مثل Entrance fees)
        excludes = filterConflictingExcludes_(excludes, includes, rawExcludes, tripId);

        // 🆕 إعادة التحقق من الحد الأدنى بعد الفلترة
        if (excludes.length < MIN_EXCLUDES_COUNT) {
          var stillNeeded = MIN_EXCLUDES_COUNT - excludes.length;
          Logger.log('⚠️ After filtering, adding ' + stillNeeded + ' more default excludes');
          var moreDefaults = getDefaultExcludes_(MIN_EXCLUDES_COUNT);
          // تجنب التكرار
          moreDefaults.forEach(function(def) {
            if (excludes.indexOf(def) === -1 && excludes.length < MIN_EXCLUDES_COUNT) {
              excludes.push(def);
            }
          });
        }

        // 🆕 ضمان الحد الأدنى للـ Includes (7 عناصر)
        var MIN_INCLUDES_RECOMMENDED = 7;
        if (includes.length < MIN_INCLUDES_RECOMMENDED) {
          var includesNeeded = MIN_INCLUDES_RECOMMENDED - includes.length;
          Logger.log('⚠️ Only ' + includes.length + ' includes. Adding ' + includesNeeded + ' default includes');
          var defaultIncludes = getDefaultIncludes_(includesNeeded, includes);
          includes = includes.concat(defaultIncludes);
        }



        // 5) إنشاء Records في جداول الـ Improvement
        var createdIncludesCount = 0;
        var createdExcludesCount = 0;

        // إنشاء Includes الجديدة
        includes.forEach(function(text) {
          var trimmed = (text || '').toString().trim();
          if (!trimmed) return;
          var nowIso = new Date().toISOString();
          
          var fieldsCreate = {};
          fieldsCreate.Trip = [tripId];
          fieldsCreate[INCLUDE_TEXT_FIELD] = trimmed;
          fieldsCreate.AI_Status = 'Done';
          fieldsCreate.AI_LastUpdated = nowIso;
          airtableCreate_(TRIP_INCLUDES_IMPROVEMENT_TABLE, fieldsCreate);
          createdIncludesCount++;
        });

        // إنشاء Excludes الجديدة
        excludes.forEach(function(text) {
          var trimmed = (text || '').toString().trim();
          if (!trimmed) return;
          var nowIso = new Date().toISOString();
          
          var fieldsCreate = {};
          fieldsCreate.Trip = [tripId];
          fieldsCreate[EXCLUDE_TEXT_FIELD] = trimmed;
          fieldsCreate.AI_Status = 'Done';
          fieldsCreate.AI_LastUpdated = nowIso;
          airtableCreate_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, fieldsCreate);
          createdExcludesCount++;
        });
 Logger.log('AI Inc/Exc: Trip ' + tripId +
           ' → includes: ' + createdIncludesCount +
           ', excludes: ' + createdExcludesCount);

        // 6) تحديث الحالة
        updateTripIncExcStatus_(tripId, 'Done');



      } catch (e) {
        Logger.log('AI Inc/Exc: error for Trip ' + tripId + ' — ' + e.message);
        updateTripIncExcStatus_(tripId, 'Error');
      }
    });

  } catch (e) {
    Logger.log('AI Inc/Exc: fatal error — ' + e.message);
  }

  Logger.log('AI Inc/Exc: batch finished.');
}

/************************************************************
 * STEP 1: جلب Trips اللي محتاجة Extraction
 ************************************************************/

function fetchTripsNeedingIncExc_(limit) {
  var params = {
    filterByFormula: "AND({" + TRIP_INCEXC_STATUS_FIELD + "} = 'Pending', {AI_Itinerary_Status} = 'Done')",
    maxRecords:      limit || AI_INCEXC_BATCH_LIMIT
  };

  var res = airtableGet_(TRIPS_TABLE, params);
  if (!res || !res.records) return [];
  return res.records;
}

/************************************************************
 * STEP 2: بناء Context من بيانات Trip
 ************************************************************/

function buildTripIncExcContext_(fields, tripId) {
  var ctx = {
    title:                 fields.Title || '',
    overviewTitle:         fields.Overview_Section_Title || '',
    tripDescription:       fields.Trip_Description || '',
    aiTripDescription:     fields.AI_Trip_Description || '',
    itineraryDescription:  fields.Itinerary_Description || '',
    aiItineraryDescription:fields.AI_Itinerary_Description || '',
    whyPeopleLove:         fields.Why_People_Love_This_Trip_Section_Title || '',
    tabContent:            fields.Tab_Content || '',
    aiTabContent:          fields.AI_Tab_Content || '',
    seoKeywords:           ''
  };

  // 🆕 جلب البيانات المحسنة
  if (tripId) {
    var mainAiRec = fetchMainAiImprovementForTrip_(tripId);
    if (mainAiRec) {
      var f = mainAiRec.fields || {};
      var aiDesc = (f.AI_Trip_Description || '').toString();
      var aiOver = (f.AI_Overview_Section_Title || '').toString();
      var aiItin = (f.AI_Itinerary_Description || '').toString();
      var aiTab  = (f.AI_Tab_Content || '').toString();

      if (aiDesc) ctx.aiTripDescription = "IMPROVED: " + aiDesc + "\n(Original): " + ctx.aiTripDescription;
      if (aiOver) ctx.overviewTitle     = aiOver + " (Original: " + ctx.overviewTitle + ")";
      if (aiItin) ctx.aiItineraryDescription = "IMPROVED: " + aiItin + "\n(Original): " + ctx.aiItineraryDescription;
      if (aiTab)  ctx.aiTabContent      = "IMPROVED: " + aiTab + "\n(Original): " + ctx.aiTabContent;
      ctx.focusKeyword = f.AI_SEO_FocusKeywords || '';
    }
  }

  var seoList = fields.SEO_FocusKeywords_List || '';
  if (Array.isArray(seoList)) {
    ctx.seoKeywords = seoList.join(', ');
  } else {
    ctx.seoKeywords = seoList || '';
  }

  // 🆕 محاولة جلب البيانات المحسنة لو موجودة (نحتاج tripId هنا، لكن fields لا تحتوي عليه مباشرة عادة، 
  // لكن في runAiIncludesExcludesExtractionBatch عندنا tripId)
  // سنقوم بتعديل الدالة لتقبل tripId كبارامتر إضافي
  
  return ctx;
}

/************************************************************
 * STEP 3: الـ Prompt (مع الحفاظ على الاختيارية)
 ************************************************************/

function buildIncExcExtractionPrompt_(ctx, rawIncludes, rawExcludes, linkedTextBlocks, improvedHighlights, improvedItinerary, improvedAddOns) {
  var ri = Array.isArray(rawIncludes) ? rawIncludes : [];
  var re = Array.isArray(rawExcludes) ? rawExcludes : [];
  var riText = ri.join("\n");
  var reText = re.join("\n");
  var linkedText = Array.isArray(linkedTextBlocks) && linkedTextBlocks.length ? linkedTextBlocks.join("\n") : '';
  
  // 🆕 إضافة البيانات المحسنة
  var highlightsText = improvedHighlights || '';
  var itineraryText = improvedItinerary || '';
  var addOnsText = improvedAddOns || '';
  
  var prompt =
    "You are a careful, conservative assistant for a travel website.\n" +
    "Your ONLY job is to improve and rewrite what is clearly INCLUDED and what is clearly NOT INCLUDED in a tour.\n\n" +
    "🚨 CRITICAL SEPARATION RULE:\n" +
    "- Items in 'Cost includes list' MUST go to 'includes' output ONLY.\n" +
    "- Items in 'Cost excludes list' MUST go to 'excludes' output ONLY.\n" +
    "- NEVER move an item from includes to excludes or vice versa.\n" +
    "- If an item says 'Optional' or 'if selected', it is STILL INCLUDED (just conditional).\n\n" +

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

    "⛔⛔⛔ ABSOLUTE PROHIBITION - ADDONS REWRITING ⛔⛔⛔\n" +
    "DO NOT BE CREATIVE OR DESCRIPTIVE WITH ADDONS!\n" +
    "- NEVER rewrite AddOns in a descriptive way like:\n" +
    "  ❌ 'Cultural Egyptian scarves by FTS for an authentic touch'\n" +
    "  ❌ 'Professional photographer to capture unforgettable moments'\n" +
    "- ALWAYS keep the original AddOn name + format:\n" +
    "  ✅ 'FTS Scarve (Optional add-on - $XX)'\n" +
    "  ✅ 'Shared Photographer per person (Optional add-on - $XX)'\n" +
    "- You can be creative with OTHER items (tours, transportation, etc.)\n" +
    "- But AddOns MUST use the EXACT format specified below.\n\n" +
    "PRIMARY SOURCES (AUTHORITATIVE - USE THESE FIRST):\n" +
    "=== COST INCLUDES LIST (RAW) ===\n" + riText + "\n\n" +
    "=== COST EXCLUDES LIST (RAW) ===\n" + reText + "\n\n" +
    "LINKED CONTENT (ADDITIONAL EXPLICIT SOURCE):\n" + linkedText + "\n\n" +
    "IMPROVED AI CONTENT (HIGH-QUALITY SOURCE - USE IF RAW IS WEAK):\n" +
    "Improved Highlights:\n" + highlightsText + "\n\n" +
    "Improved Itinerary Steps (with meals info):\n" + itineraryText + "\n\n" +
    "Improved AddOns (OPTIONAL SERVICES - Only included if customer selects them, extra charge applies):\n" + addOnsText + "\n\n" +
    "SECONDARY CONTEXT:\n" +
    "Title: " + (ctx.title || 'N/A') + "\n" +
    "Overview section title: " + (ctx.overviewTitle || 'N/A') + "\n\n" +
    "Trip description:\n" + (ctx.tripDescription || 'N/A') + "\n\n" +
    "AI trip description (if any):\n" + (ctx.aiTripDescription || 'N/A') + "\n\n" +
    "Itinerary description:\n" + (ctx.itineraryDescription || 'N/A') + "\n\n" +
    "AI itinerary description (if any):\n" + (ctx.aiItineraryDescription || 'N/A') + "\n\n" +
    "Tab content:\n" + (ctx.tabContent || 'N/A') + "\n\n" +
    "AI tab content (if any):\n" + (ctx.aiTabContent || 'N/A') + "\n\n" +
    "Why people love this trip (if provided):\n" + (ctx.whyPeopleLove || 'N/A') + "\n\n" +
    "Focus Keyword: " + (ctx.focusKeyword || 'N/A') + "\n" +
    "SEO / focus keywords (optional):\n" + (ctx.seoKeywords || 'N/A') + "\n\n" +
    "PROCESSING RULES:\n" +
    "1. FOR INCLUDES OUTPUT:\n" +
    "   - PRIORITY 1: Take ALL items from 'Cost includes list (raw)'. These are MANDATORY.\n" +
    "   - PRIORITY 2: Only after processing Raw items, check 'Improved Itinerary Steps' and 'Highlights' for missing services.\n" +
    "   - Improve the wording to be clear and professional\n" +
    "   - Keep truly included conditional items only if they come from RAW includes (e.g. 'if selected')\n" +
    "   - ⛔ DO NOT include any items from 'Improved AddOns' in the INCLUDES output. AddOns must stay ONLY in Extra Services.\n" +
    "   - ⛔ DUPLICATION CHECK: DO NOT add an inferred item if it is already covered (in meaning) by a Raw item.\n" +
    "     * Example: If Raw says 'All transfers', DO NOT add 'Airport pickup' (it is redundant).\n" +
    "     * Example: If Raw says 'Lunch', DO NOT add 'Daily meals' (it is redundant).\n" +
    "   ✅ CORRECT NON-ADDON EXAMPLES (can be creative):\n" +
    "   'Professional driver for a smooth journey'\n" +
    "   'Comfortable air-conditioned transportation'\n" +
    "   'Expert Egyptologist tour guide (if selected)'\n\n" +
    "2. FOR EXCLUDES OUTPUT:\n" +
    "   - PRIORITY 1: Take ALL items from 'Cost excludes list (raw)'. These are MANDATORY.\n" +
    "   - Improve the wording to be clear and professional\n" +
    "   - PRIORITY 2: If the list is short or incomplete, you may add standard excludes ONLY IF they don't conflict with Includes.\n" +
    "   - ⛔ DUPLICATION CHECK: DO NOT add a generic exclude if it contradicts the Raw Includes or is already listed.\n" +
    "     * Example: If Includes says 'All tips included', DO NOT exclude 'Gratuities'.\n" +
    "     * 'Gratuities and tips'\n" +
    "     * 'Personal expenses and shopping'\n" +
    "     * 'Travel insurance'\n\n" +
    "3. GENERAL RULES:\n" +
    "   - Output must be in ENGLISH\n" +
    "   - Do NOT move items between includes and excludes\n" +
    "   - Do NOT invent items unless the raw list is empty\n" +
    "   - Do NOT list 'Entrance fees' in excludes UNLESS explicitly mentioned in 'Cost excludes list' (Raw)\n" +
    "   - Each item should be a short, clear phrase\n" +
    "   - Do NOT mention prices or booking steps\n" +
    "   - Ensure each item is a complete phrase and DOES NOT end with 'and', 'or', or ','\n\n" +
    "🚨 CRITICAL TRANSPORTATION SAFETY RULES:\n" +
    "- Do NOT mention 'flight', 'airplane', 'train', 'private car', 'bus', 'boat', 'ferry', 'cruise'\n" +
    "  UNLESS these EXACT words appear in the PRIMARY SOURCES.\n" +
    "- Use generic phrases like:\n" +
    "  * 'Transportation between cities as per itinerary'\n" +
    "  * 'Seamless transfers'\n" +
    "  * 'All transfers mentioned in the itinerary'\n" +
    "- When summarizing, GROUP similar items:\n" +
    "  * Instead of listing each attraction → 'Guided tours to major attractions'\n" +
    "  * Instead of listing each meal → 'Daily meals as per itinerary'\n\n" +
    "OUTPUT FORMAT (JSON ONLY):\n" +
    "{\n" +
    "  \"includes\": [\n" +
    "    \"Improved item from includes list\",\n" +
    "    \"Another included item\"\n" +
    "  ],\n" +
    "  \"excludes\": [\n" +
    "    \"Improved item from excludes list\",\n" +
    "    \"Another excluded item\"\n" +
    "  ]\n" +
    "}\n\n" +
    "EXAMPLE:\n" +
    "Input includes: 'Professional driver', 'Water', 'Photographer (optional)'\n" +
    "Input excludes: 'Drinks'\n" +
    "Output:\n" +
    "{\n" +
    "  \"includes\": [\n" +
    "    \"Professional driver for a smooth journey\",\n" +
    "    \"Complimentary drinking water\",\n" +
    "    \"Professional photographer (if selected)\"\n" +
    "  ],\n" +
    "  \"excludes\": [\n" +
    "    \"Drinks\",\n" +
    "    \"Gratuities and tips\",\n" +
    "    \"Personal expenses\"\n" +
    "  ]\n" +
    "}\n";
  return prompt;
}

/************************************************************
 * STEP 4: إنشاء Records في جداول الـ Improvement
 ************************************************************/

function createTripIncludeImprovementRecord_(tripId, text) {
  var nowIso = new Date().toISOString();
  var fields = {};
  fields[TRIP_LINK_FIELD_IN_INCLUDES] = [tripId];
  fields[INCLUDE_TEXT_FIELD]          = text;
  fields.AI_Status                    = 'Done';
  fields.AI_LastUpdated               = nowIso;

  var created = airtableCreate_(TRIP_INCLUDES_IMPROVEMENT_TABLE, fields);
  return created && created.id ? created.id : null;
}

function createTripExcludeImprovementRecord_(tripId, text) {
  var nowIso = new Date().toISOString();
  var fields = {};
  fields[TRIP_LINK_FIELD_IN_EXCLUDES] = [tripId];
  fields[EXCLUDE_TEXT_FIELD]          = text;
  fields.AI_Status                    = 'Done';
  fields.AI_LastUpdated               = nowIso;

  var created = airtableCreate_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, fields);
  return created && created.id ? created.id : null;
}

/************************************************************
 * STEP 5: تحديث حالة AI_IncExc_Status في Trips
 ************************************************************/

function updateTripIncExcStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[TRIP_INCEXC_STATUS_FIELD] = status;
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

/************************************************************
 * TRIGGER CREATOR
 ************************************************************/

function createAiIncludesExcludesExtractorTrigger() {
  ScriptApp.newTrigger('runAiIncludesExcludesExtractionBatch')
    .timeBased()
    .everyMinutes(15)
    .create();
}

function fetchRawTripIncludes_(tripId, tripNumber, tripFields) {
  if (!tripId) return [];
  var out = [];
  
  // Try with Record ID first
  var formulaByRecordId = "ARRAYJOIN({" + TRIP_LINK_FIELD_IN_INCLUDES + "}) = '" + tripId + "'";
  var res1 = airtableGet_(TRIP_INCLUDES_BASE_TABLE, { filterByFormula: formulaByRecordId, pageSize: 100 });
  var recs1 = res1 && res1.records ? res1.records : [];
  var recs = recs1;

  // Try with TripID if no results
  if (!recs1.length && tripNumber) {
    var formulaByTripId = "ARRAYJOIN({" + TRIP_LINK_FIELD_IN_INCLUDES + "}) = '" + tripNumber + "'";
    var res2 = airtableGet_(TRIP_INCLUDES_BASE_TABLE, { filterByFormula: formulaByTripId, pageSize: 100 });
    var recs2 = res2 && res2.records ? res2.records : [];
    recs = recs2;
  }
  
  // Try with display key if still no results
  if (!recs.length) {
    var displayKey = computeTripDisplayKey_(tripFields);
    if (displayKey) {
      var formulaByDisplay = "ARRAYJOIN({" + TRIP_LINK_FIELD_IN_INCLUDES + "}) = '" + AirtableUtils.escapeFormulaValue(displayKey) + "'";
      var res3 = airtableGet_(TRIP_INCLUDES_BASE_TABLE, { filterByFormula: formulaByDisplay, pageSize: 100 });
      var recs3 = res3 && res3.records ? res3.records : [];
      recs = recs3;
    }
  }

  for (var i = 0; i < (recs || []).length; i++) {
    var f = recs[i].fields || {};
    var t = (f[INCLUDE_TEXT_FIELD] || '').toString().trim();
    if (t) out.push(t);
  }
  return out;
}

function fetchRawTripExcludes_(tripId, tripNumber, tripFields) {
  if (!tripId) return [];
  var out = [];
  
  // Try with Record ID first
  var formulaByRecordId = "ARRAYJOIN({" + TRIP_LINK_FIELD_IN_EXCLUDES + "}) = '" + tripId + "'";
  var res1 = airtableGet_(TRIP_EXCLUDES_BASE_TABLE, { filterByFormula: formulaByRecordId, pageSize: 100 });
  var recs1 = res1 && res1.records ? res1.records : [];
  var recs = recs1;

  // Try with TripID if no results
  if (!recs1.length && tripNumber) {
    var formulaByTripId = "ARRAYJOIN({" + TRIP_LINK_FIELD_IN_EXCLUDES + "}) = '" + tripNumber + "'";
    var res2 = airtableGet_(TRIP_EXCLUDES_BASE_TABLE, { filterByFormula: formulaByTripId, pageSize: 100 });
    var recs2 = res2 && res2.records ? res2.records : [];
    recs = recs2;
  }
  
  // Try with display key if still no results
  if (!recs.length) {
    var displayKey = computeTripDisplayKey_(tripFields);
    if (displayKey) {
      var formulaByDisplay = "ARRAYJOIN({" + TRIP_LINK_FIELD_IN_EXCLUDES + "}) = '" + AirtableUtils.escapeFormulaValue(displayKey) + "'";
      var res3 = airtableGet_(TRIP_EXCLUDES_BASE_TABLE, { filterByFormula: formulaByDisplay, pageSize: 100 });
      var recs3 = res3 && res3.records ? res3.records : [];
      recs = recs3;
    }
  }

  for (var i = 0; i < (recs || []).length; i++) {
    var f = recs[i].fields || {};
    var t = (f[EXCLUDE_TEXT_FIELD] || '').toString().trim();
    if (t) out.push(t);
  }
  return out;
}

function computeTripDisplayKey_(tripFields) {
  var f = tripFields || {};
  var key = (f.TripID || f.Title || '').toString().trim();
  return key || '';
}

function fetchImprovementIncludes_(tripId) {
  if (!tripId) return [];
  var res = airtableGet_(TRIP_INCLUDES_IMPROVEMENT_TABLE, { pageSize: 100 });
  var recs = res && res.records ? res.records : [];
  var out = [];
  for (var i = 0; i < recs.length; i++) {
    var f = recs[i].fields || {};
    var links = f[TRIP_LINK_FIELD_IN_INCLUDES] || [];
    if (Array.isArray(links) && links.indexOf(tripId) !== -1) {
      var t = (f[INCLUDE_TEXT_FIELD] || '').toString().trim();
      if (t) out.push(t);
    }
  }
  return out;
}

function fetchImprovementExcludes_(tripId) {
  if (!tripId) return [];
  var res = airtableGet_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, { pageSize: 100 });
  var recs = res && res.records ? res.records : [];
  var out = [];
  for (var i = 0; i < recs.length; i++) {
    var f = recs[i].fields || {};
    var links = f[TRIP_LINK_FIELD_IN_EXCLUDES] || [];
    if (Array.isArray(links) && links.indexOf(tripId) !== -1) {
      var t = (f[EXCLUDE_TEXT_FIELD] || '').toString().trim();
      if (t) out.push(t);
    }
  }
  return out;
}

function normalizeText_(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\.,;:]+$/, '')
    .trim();
}

function findImprovementRecordByText_(tableName, linkFieldName, textFieldName, tripId, text) {
  if (!tripId || !text) return null;
  var res = airtableGet_(tableName, { pageSize: 100 });
  var recs = res && res.records ? res.records : [];
  var norm = normalizeText_(text);
  for (var i = 0; i < recs.length; i++) {
    var f = recs[i].fields || {};
    var links = f[linkFieldName] || [];
    if (!Array.isArray(links) || links.indexOf(tripId) === -1) continue;
    var t = (f[textFieldName] || '').toString();
    if (normalizeText_(t) === norm) return recs[i].id;
  }
  return null;
}

function findImprovementIncludeRecord_(tripId, text) {
  return findImprovementRecordByText_(TRIP_INCLUDES_IMPROVEMENT_TABLE, TRIP_LINK_FIELD_IN_INCLUDES, INCLUDE_TEXT_FIELD, tripId, text);
}

function findImprovementExcludeRecord_(tripId, text) {
  return findImprovementRecordByText_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, TRIP_LINK_FIELD_IN_EXCLUDES, EXCLUDE_TEXT_FIELD, tripId, text);
}

function generateSafeFallbackExcludes_(linkedTextBlocks, incSet, excSet, limit, rawExcludesCount) {
  var out = [];
  var textBlob = Array.isArray(linkedTextBlocks) ? linkedTextBlocks.join(' \n ').toLowerCase() : '';
  var candidates = [];
  if (!rawExcludesCount) {
    candidates.push('Anything not mentioned in the itinerary');
  }
  candidates.push('Optional extras unless selected');
  candidates.push('Personal expenses');
  candidates.push('Gratuities (tips)');
  candidates.push('Souvenirs');

  for (var i = 0; i < candidates.length && out.length < limit; i++) {
    var c = candidates[i];
    var n = normalizeText_(c);
    if (excSet[n] || incSet[n]) continue;
    out.push(c);
  }
  return out;
}

function fetchLinkedContextText_(tripId, tripFields) {
  if (!tripId) return [];
  var out = [];
  function pushVal(v) { if (!v) return; var t = String(v).trim(); if (!t) return; if (/https?:\/\//i.test(t)) return; out.push(t.length > 300 ? t.slice(0, 300) : t); }
  var linkField = CONFIG.DEFAULT_TRIP_LINK_FIELD;
  var tables = [];
  for (var k in CONFIG.LINK_FIELDS) { if (CONFIG.LINK_FIELDS.hasOwnProperty(k)) tables.push(k); }
  for (var i = 0; i < tables.length; i++) {
    var tname = tables[i];
    var lf = (CONFIG.LINK_FIELDS[tname] || linkField);
    var res1 = airtableGet_(tname, { filterByFormula: "ARRAYJOIN({" + lf + "}) = '" + tripId + "'", pageSize: 100 });
    var recs = res1 && res1.records ? res1.records : [];
    if (!recs.length) {
      var displayKey = computeTripDisplayKey_(tripFields);
      if (displayKey) {
        var res2 = airtableGet_(tname, { filterByFormula: "ARRAYJOIN({" + lf + "}) = '" + AirtableUtils.escapeFormulaValue(displayKey) + "'", pageSize: 100 });
        var recs2 = res2 && res2.records ? res2.records : [];
        recs = recs2;
      }
    }
    for (var j = 0; j < recs.length; j++) {
      var f = recs[j].fields || {};
      for (var fk in f) {
        if (!f.hasOwnProperty(fk)) continue;
        var val = f[fk];
        if (typeof val === 'string') {
          pushVal(val);
        } else if (Array.isArray(val)) {
          var joined = [];
          for (var a = 0; a < val.length; a++) {
            var v = val[a];
            if (typeof v === 'string') joined.push(v);
            else if (v && typeof v === 'object') {
              if (v.label) joined.push(String(v.label));
              if (v.title) joined.push(String(v.title));
              if (v.description) joined.push(String(v.description));
              if (v.Highlight) joined.push(String(v.Highlight));
              if (v.StepTitle) joined.push(String(v.StepTitle));
              if (v.StepDescription) joined.push(String(v.StepDescription));
            }
          }
          if (joined.length) pushVal(joined.join(' '));
        }
      }
    }
  }
  return out;
}

/**
 * جلب الهايلايتس المحسنة من جدول Highlights Improvement With AI
 */
function fetchImprovedHighlightsForTrip_(tripId) {
  if (!tripId) return "";
  
  var HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
  var params = {
    filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
    pageSize: 20
  };
  
  try {
    var res = airtableGet_(HIGHLIGHTS_IMPROVEMENT_TABLE, params);
    if (!res || !res.records || !res.records.length) return "";
    
    var texts = [];
    res.records.forEach(function(r) {
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
 * جلب خطوات الـ Itinerary المحسنة من جدول Itinerary Improvement With AI
 * مع التركيز على الوجبات والأنشطة
 */
function fetchImprovedItineraryForTrip_(tripId) {
  if (!tripId) return "";
  
  var ITINERARY_IMPROVEMENT_TABLE = 'Itinerary Improvement With AI';
  var params = {
    filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
    pageSize: 20
  };
  
  try {
    var res = airtableGet_(ITINERARY_IMPROVEMENT_TABLE, params);
    if (!res || !res.records || !res.records.length) return "";
    
    var texts = [];
    res.records.forEach(function(r) {
      var f = r.fields || {};
      var title = f.AI_Step_Title || "";
      var desc = f.AI_Step_Description || "";
      var meals = f.AI_Meals_Included || "";
      var label = f.AI_Step_Label || "";
      
      var line = "";
      if (title) line += title;
      if (desc) line += " | " + desc;
      if (meals && meals !== "None") line += " [Meals: " + meals + "]";
      if (label) line += " (Type: " + label + ")";
      
      if (line) texts.push("- " + line);
    });
    
    return texts.join("\n");
  } catch (e) {
    Logger.log("fetchImprovedItineraryForTrip_ error: " + e.message);
    return "";
  }
}

/**
 * جلب بيانات AddOns المنظمة (مع الأسعار والأسماء)
 * لاستخدامها في إصلاح التنسيق
 */
function fetchImprovedAddOnsDataForTrip_(tripId, tripNumber, tripName) {
  if (!tripId && !tripNumber) return [];
  
  var ADDONS_IMPROVEMENT_TABLE = 'AddOns Improvement With AI';
  
  var conditions = [];
  if (tripId) conditions.push("ARRAYJOIN({Trip}) = '" + tripId + "'");
  if (tripNumber) conditions.push("ARRAYJOIN({Trip}) = '" + tripNumber + "'");
  if (tripName) {
    var safeName = tripName.replace(/'/g, "\\'");
    conditions.push("FIND('" + safeName + "', ARRAYJOIN({Trip}))");
  }
  
  var formula = "OR(" + conditions.join(", ") + ")";
  
  var params = {
    filterByFormula: formula,
    pageSize: 20
  };
  
  try {
    Logger.log('AI Inc/Exc: fetching Improved AddOns for Trip ' + tripId + ' (Formula: ' + formula + ')');
    var res = airtableGet_(ADDONS_IMPROVEMENT_TABLE, params);
    if (!res || !res.records || !res.records.length) {
      Logger.log('AI Inc/Exc: No Improved AddOns found.');
      return [];
    }
    
    Logger.log('AI Inc/Exc: Found ' + res.records.length + ' Improved AddOns.');
    
    var addOns = [];
    res.records.forEach(function(r) {
      var f = r.fields || {};
      var title = f.AI_AddOn_Title || "";
      var price = f.AI_AddOn_Price || "";
      
      if (title) {
        addOns.push({
          title: title,
          price: price,
          keywords: extractKeywords_(title)
        });
      }
    });
    
    return addOns;
  } catch (e) {
    Logger.log("fetchImprovedAddOnsDataForTrip_ error: " + e.message);
    return [];
  }
}

/**
 * استخراج كلمات مفتاحية من اسم الخدمة للمطابقة
 * 🔥 محسّنة لتشمل كلمات وصفية قد يستخدمها الـ AI
 */
function extractKeywords_(text) {
  if (!text) return [];
  var lower = text.toLowerCase();
  var keywords = [];
  
  // 1. Hardcoded specific keywords (High value)
  if (lower.indexOf('scarve') !== -1 || lower.indexOf('scarf') !== -1) {
    keywords.push('scarve', 'scarf', 'egyptian', 'cultural');
  }
  if (lower.indexOf('fts') !== -1) keywords.push('fts');
  if (lower.indexOf('photographer') !== -1 || lower.indexOf('photography') !== -1) {
    keywords.push('photographer', 'photography', 'photo', 'capture', 'moment', 'shared', 'professional');
  }
  if (lower.indexOf('organic') !== -1) keywords.push('organic', 'pure');
  if (lower.indexOf('oil') !== -1) keywords.push('oil', 'oils');
  
  // 2. Generic keywords (split by space/punctuation)
  // Only words > 3 chars and not in stop list
  var words = lower.split(/[^a-z0-9]+/);
  var STOP_WORDS = [
    'the', 'and', 'for', 'from', 'with', 'per', 'person', 'tour', 'trip', 
    'day', 'days', 'optional', 'addon', 'add-on', 'price', 'cost', 'usd', 
    'extra', 'charge', 'selects', 'customer', 'include', 'exclude'
  ];
  
  words.forEach(function(w) {
    if (w.length > 3 && STOP_WORDS.indexOf(w) === -1) {
      // Avoid duplicates
      if (keywords.indexOf(w) === -1) {
        keywords.push(w);
      }
    }
  });
  
  return keywords;
}

/**
 * إصلاح تنسيق AddOns في قائمة Includes تلقائياً
 * يبحث عن العناصر التي تطابق AddOns ويُعيد تنسيقها بالشكل الصحيح
 * 🔥 محسّنة للتعرف على AddOns حتى لو تم إعادة كتابتها بطريقة وصفية
 */
function reformatAddOnsInIncludes_(includes, addOnsData, tripId) {
  var inputList = includes || [];
  var addons = addOnsData || [];
  if (!inputList.length) return [];

  var addonNorms = addons.map(function(a) {
    return a && a.title ? String(a.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  }).filter(function(x) { return !!x; });

  var out = [];
  for (var i = 0; i < inputList.length; i++) {
    var text = String(inputList[i] || '').trim();
    if (!text) continue;
    var lc = text.toLowerCase();
    if (lc.indexOf('(optional add-on') !== -1) continue;
    if (lc.indexOf('[optional') !== -1) continue;
    if (addonNorms.length) {
      var k = lc.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
      var isAddon = false;
      for (var j = 0; j < addonNorms.length; j++) {
        var a = addonNorms[j];
        if (!a) continue;
        if (k === a || k.indexOf(a) !== -1 || a.indexOf(k) !== -1) { isAddon = true; break; }
      }
      if (isAddon) continue;
    }
    out.push(text);
  }
  return out;
}

function ensureMandatoryAddOnsOptional_(includes, addOnsData) {
  return (includes || []).slice();
}

function normalizeKey_(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function detectMandatoryAddOnVariant_(text) {
  var t = String(text || '').toLowerCase();
  if (!t) return '';
  if ((t.indexOf('scarve') !== -1 || t.indexOf('scarf') !== -1) && t.indexOf('fts') !== -1) return 'scarve';
  if (t.indexOf('photograph') !== -1) return 'photographer';
  if (t.indexOf('oil') !== -1 && t.indexOf('organic') !== -1) return 'oils';
  return '';
}

function canonicalMandatoryAddOnTitle_(key) {
  if (key === 'scarve') return 'FTS Scarve';
  if (key === 'photographer') return 'Shared Photographer per person';
  if (key === 'oils') return 'FTS Organic oils - 100% pure';
  return '';
}

function formatCanonicalOptional_(title, addOnsData) {
  var price = '';
  for (var j = 0; j < (addOnsData || []).length; j++) {
    var a = addOnsData[j];
    var al = String(a.title || '').toLowerCase();
    if (title === 'FTS Scarve' && al.indexOf('scarve') !== -1) { price = a.price || ''; break; }
    if (title === 'Shared Photographer per person' && al.indexOf('photograph') !== -1) { price = a.price || ''; break; }
    if (title === 'FTS Organic oils - 100% pure' && (al.indexOf('oil') !== -1 && al.indexOf('organic') !== -1)) { price = a.price || ''; break; }
  }
  if (price) return title + ' (Optional add-on - $' + price + ')';
  return title + ' (Optional add-on)';
}

function finalizeIncludesNoDup_(includes, addOnsData) {
  var out = [];
  var seen = {};
  var addonNorms = (addOnsData || []).map(function(a) {
    return a && a.title ? String(a.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  }).filter(function(x) { return !!x; });
  for (var i = 0; i < (includes || []).length; i++) {
    var rawItem = (includes[i] || '').toString().trim();
    if (!rawItem) continue;
    var lower = rawItem.toLowerCase();
    if (lower.indexOf('(optional add-on') !== -1) continue;
    if (lower.indexOf('[optional') !== -1) continue;
    if (addonNorms.length) {
      var k2 = lower.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
      var isAddon = false;
      for (var j2 = 0; j2 < addonNorms.length; j2++) {
        var a2 = addonNorms[j2];
        if (!a2) continue;
        if (k2 === a2 || k2.indexOf(a2) !== -1 || a2.indexOf(k2) !== -1) { isAddon = true; break; }
      }
      if (isAddon) continue;
    }
    var key = normalizeKey_(rawItem);
    if (!key) continue;
    if (seen[key]) continue;
    seen[key] = true;
    out.push(rawItem);
  }
  out = ensureMandatoryAddOnsOptional_(out, addOnsData);
  var uniq = [];
  var seen2 = {};
  for (var j = 0; j < out.length; j++) {
    var it = (out[j] || '').toString().trim();
    var k = normalizeKey_(it);
    if (!k || seen2[k]) continue;
    seen2[k] = true;
    uniq.push(it);
  }
  return uniq;
}

function finalizeNoDupStrict_(items) {
  var out = [];
  var seen = {};
  for (var i = 0; i < (items || []).length; i++) {
    var item = (items[i] || '').toString().trim();
    var key = normalizeKey_(item);
    if (!key) continue;
    if (seen[key]) continue;
    seen[key] = true;
    out.push(item);
  }
  return out;
}

/**
 * جلب AddOns المحسنة من جدول AddOns Improvement With AI
 * لإضافتها كخدمات اختيارية في قائمة Includes
 * ⚠️ هذه الخدمات مشمولة فقط إذا اختارها العميل وبتكلفة إضافية
 */
function fetchImprovedAddOnsForTrip_(tripId) {
  if (!tripId) return "";
  
  var ADDONS_IMPROVEMENT_TABLE = 'AddOns Improvement With AI';
  var params = {
    filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
    pageSize: 20
  };
  
  try {
    var res = airtableGet_(ADDONS_IMPROVEMENT_TABLE, params);
    if (!res || !res.records || !res.records.length) return "";
    
    var texts = [];
    res.records.forEach(function(r) {
      var f = r.fields || {};
      var title = f.AI_AddOn_Title || "";
      var desc = f.AI_AddOn_Description || "";
      var price = f.AI_AddOn_Price || "";
      
      var line = "";
      if (title) {
        line += title;
        if (price) line += " ($" + price + ")";
        if (desc) line += " - " + desc;
        line += " [OPTIONAL - Customer selects - Extra charge]";
      }
      
      if (line) texts.push("- " + line);
    });
    
    return texts.join("\n");
  } catch (e) {
    Logger.log("fetchImprovedAddOnsForTrip_ error: " + e.message);
    return "";
  }
}


/**
 * تصفية الكلمات المحظورة المتعلقة بوسائل النقل
 * لمنع الـ AI من اختراع تفاصيل النقل
 * 🆕 تم التعديل للسماح بالكلمات إذا كانت موجودة في النص الأصلي (Raw Text)
 */
function sanitizeTransportationWords_(items, tripId, rawText) {
  if (!Array.isArray(items)) return [];
  
  var rawTextLower = (rawText || '').toString().toLowerCase();

  var FORBIDDEN_WORDS = [
    'flight', 'flights', 'airplane', 'plane', 'aircraft',
    'domestic flight', 'international flight',
    'train', 'sleeper train', 'railway',
    'private car', 'private transfer', 'private vehicle',
    'bus', 'coach', 'minibus',
    'boat', 'ferry', 'cruise ship', 'ship'
  ];
  
  var REPLACEMENT_PHRASE = 'Transportation between cities as per itinerary';
  
  var sanitized = [];
  var replacedCount = 0;
  
  items.forEach(function(item) {
    var text = (item || '').toString().trim();
    if (!text) return;
    
    var lower = text.toLowerCase();
    var hasForbiddenWord = false;
    
    // تحقق من وجود كلمات محظورة
    for (var i = 0; i < FORBIDDEN_WORDS.length; i++) {
      var forbiddenWord = FORBIDDEN_WORDS[i];
      if (lower.indexOf(forbiddenWord) !== -1) {
        // 🆕 تحقق مما إذا كانت الكلمة موجودة في المصدر الأصلي
        if (rawTextLower.indexOf(forbiddenWord) !== -1) {
           Logger.log('ℹ️ ALLOWING forbidden word "' + forbiddenWord + '" in item "' + text + '" because it exists in RAW source.');
           continue; // مسموح بها لأنها في المصدر
        }

        hasForbiddenWord = true;
        Logger.log('⚠️ SANITIZATION WARNING [Trip ' + tripId + ']: Forbidden word "' + 
                   forbiddenWord + '" detected in: "' + text + '" (NOT found in raw source)');
        replacedCount++;
        break;
      }
    }
    
    if (hasForbiddenWord) {
      // استبدل بعبارة عامة (لو لم تكن موجودة مسبقاً)
      if (sanitized.indexOf(REPLACEMENT_PHRASE) === -1) {
        sanitized.push(REPLACEMENT_PHRASE);
      }
    } else {
      sanitized.push(text);
    }
  });
  
  if (replacedCount > 0) {
    Logger.log('✅ SANITIZATION SUMMARY [Trip ' + tripId + ']: Replaced ' + 
               replacedCount + ' forbidden items with generic phrase.');
  }
  
  return sanitized;
}

/**
 * حذف جميع سجلات Includes/Excludes القديمة للرحلة قبل الإنتاج الجديد
 * يستخدم نفس الطريقة المجربة من ai_itinerary_enhancer.gs
 */
function deleteOldIncludesExcludesForTrip_(tripId, tripNumber) {
  if (!tripId) return;
  
  Logger.log('🔍 AI Inc/Exc: Starting deletion of old records for Trip ' + tripId + ' (TripID: ' + tripNumber + ')');
  
  var deletedIncludes = 0;
  var deletedExcludes = 0;
  
  try {
    // 🆕 حذف Includes القديمة - المحاولة الأولى بـ Record ID
    var includesFormula = "ARRAYJOIN({Trip}) = '" + tripId + "'";
    Logger.log('🔍 Includes Filter Formula (Record ID): ' + includesFormula);
    
    var includesParams = {
      filterByFormula: includesFormula,
      pageSize: 100
    };
    var includesRes = airtableGet_(TRIP_INCLUDES_IMPROVEMENT_TABLE, includesParams);
    var includesRecs = includesRes && includesRes.records ? includesRes.records : [];
    
    Logger.log('🔍 Found ' + includesRecs.length + ' includes records with Record ID');
    
    // 🆕 إذا لم نجد بـ Record ID، نحاول بـ TripID
    if (includesRecs.length === 0 && tripNumber) {
      var includesFormulaTripId = "ARRAYJOIN({Trip}) = '" + tripNumber + "'";
      Logger.log('🔍 Includes Filter Formula (TripID): ' + includesFormulaTripId);
      
      var includesParamsTripId = {
        filterByFormula: includesFormulaTripId,
        pageSize: 100
      };
      var includesResTripId = airtableGet_(TRIP_INCLUDES_IMPROVEMENT_TABLE, includesParamsTripId);
      includesRecs = includesResTripId && includesResTripId.records ? includesResTripId.records : [];
      
      Logger.log('🔍 Found ' + includesRecs.length + ' includes records with TripID');
    }
    
    if (includesRecs.length > 0) {
      Logger.log('AI Inc/Exc: found ' + includesRecs.length + ' old includes to delete for Trip ' + tripId);
      includesRecs.forEach(function(r) {
        try {
          Logger.log('🗑️ Deleting include record: ' + r.id);
          airtableDelete_(TRIP_INCLUDES_IMPROVEMENT_TABLE, r.id);
          deletedIncludes++;
        } catch (e) {
          Logger.log('❌ AI Inc/Exc: failed to delete include record ' + r.id + ' — ' + e.message);
        }
      });
    }
    
    // 🆕 حذف Excludes القديمة - المحاولة الأولى بـ Record ID
    var excludesFormula = "ARRAYJOIN({Trip}) = '" + tripId + "'";
    Logger.log('🔍 Excludes Filter Formula (Record ID): ' + excludesFormula);
    
    var excludesParams = {
      filterByFormula: excludesFormula,
      pageSize: 100
    };
    var excludesRes = airtableGet_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, excludesParams);
    var excludesRecs = excludesRes && excludesRes.records ? excludesRes.records : [];
    
    Logger.log('🔍 Found ' + excludesRecs.length + ' excludes records with Record ID');
    
    // 🆕 إذا لم نجد بـ Record ID، نحاول بـ TripID
    if (excludesRecs.length === 0 && tripNumber) {
      var excludesFormulaTripId = "ARRAYJOIN({Trip}) = '" + tripNumber + "'";
      Logger.log('🔍 Excludes Filter Formula (TripID): ' + excludesFormulaTripId);
      
      var excludesParamsTripId = {
        filterByFormula: excludesFormulaTripId,
        pageSize: 100
      };
      var excludesResTripId = airtableGet_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, excludesParamsTripId);
      excludesRecs = excludesResTripId && excludesResTripId.records ? excludesResTripId.records : [];
      
      Logger.log('🔍 Found ' + excludesRecs.length + ' excludes records with TripID');
    }
    
    if (excludesRecs.length > 0) {
      Logger.log('AI Inc/Exc: found ' + excludesRecs.length + ' old excludes to delete for Trip ' + tripId);
      excludesRecs.forEach(function(r) {
        try {
          Logger.log('🗑️ Deleting exclude record: ' + r.id);
          airtableDelete_(TRIP_EXCLUDES_IMPROVEMENT_TABLE, r.id);
          deletedExcludes++;
        } catch (e) {
          Logger.log('❌ AI Inc/Exc: failed to delete exclude record ' + r.id + ' — ' + e.message);
        }
      });
    }
    
    if (deletedIncludes === 0 && deletedExcludes === 0) {
      Logger.log('ℹ️ AI Inc/Exc: no old records to delete for Trip ' + tripId);
    } else {
      Logger.log('✅ AI Inc/Exc: SUCCESSFULLY deleted ' + deletedIncludes + ' includes and ' + deletedExcludes + ' excludes for Trip ' + tripId);
    }
  } catch (e) {
    Logger.log('❌ AI Inc/Exc: ERROR deleting old records for Trip ' + tripId + ': ' + e.message);
  }
}


/**
 * تطبيق الحدود الدنيا والقصوى مع التجميع الذكي
 * لو العدد أكثر من الحد الأقصى، يجمع العناصر المتشابهة
 */
function enforceCountLimitsWithGrouping_(items, minCount, maxCount, type, tripId) {
  if (!Array.isArray(items)) return [];
  
  var count = items.length;
  
  // لو أقل من الحد الأدنى → تحذير فقط
  if (count < minCount) {
    Logger.log('⚠️ WARNING [Trip ' + tripId + ']: Only ' + count + ' ' + type + 
               ' (minimum recommended: ' + minCount + ')');
    return items;
  }
  
  // لو ضمن الحدود → إرجاع كما هو
  if (count <= maxCount) {
    return items;
  }
  
  // لو أكثر من الحد الأقصى → تجميع ذكي
  Logger.log('📊 GROUPING [Trip ' + tripId + ']: ' + count + ' ' + type + 
             ' exceeds max (' + maxCount + '). Applying smart grouping...');
  
  var grouped = smartGroupItems_(items, maxCount, type);
  
  Logger.log('✅ GROUPING RESULT [Trip ' + tripId + ']: Reduced from ' + 
             count + ' to ' + grouped.length + ' ' + type);
  
  return grouped;
}

/**
 * تجميع ذكي للعناصر المتشابهة
 * يجمع العناصر بناءً على الكلمات المشتركة والموضوعات
 */
function smartGroupItems_(items, maxCount, type) {
  if (items.length <= maxCount) return items;
  
  // استراتيجية التجميع بناءً على الكلمات المفتاحية
  var groups = {};
  
  // كلمات مفتاحية للتجميع
  var GROUPING_KEYWORDS = {
    'meals': ['breakfast', 'lunch', 'dinner', 'meal', 'food'],
    'accommodation': ['hotel', 'accommodation', 'stay', 'overnight', 'room'],
    'transport': ['transfer', 'transportation', 'pickup', 'drop-off', 'transport'],
    'guide': ['guide', 'egyptologist', 'tour guide', 'expert'],
    'entrance': ['entrance', 'admission', 'ticket', 'entry fee'],
    'tours': ['tour', 'visit', 'excursion', 'sightseeing'],
    'personal': ['personal', 'expenses', 'shopping', 'souvenirs', 'tips'],
    'optional': ['optional', 'add-on', 'extra', 'additional']
  };
  
  // تصنيف العناصر
  items.forEach(function(item) {
    if (item.indexOf('(Optional add-on') !== -1) return;

    var lower = item.toLowerCase();
    var assigned = false;
    
    for (var category in GROUPING_KEYWORDS) {
      var keywords = GROUPING_KEYWORDS[category];
      for (var i = 0; i < keywords.length; i++) {
        if (lower.indexOf(keywords[i]) !== -1) {
          if (!groups[category]) groups[category] = [];
          groups[category].push(item);
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }
    
    // لو ما تم تصنيفه، يروح لمجموعة "other"
    if (!assigned) {
      if (!groups['other']) groups['other'] = [];
      groups['other'].push(item);
    }
  });
  
  // دمج المجموعات
  var result = [];
  
  for (var category in groups) {
    var groupItems = groups[category];
    
    if (groupItems.length === 1) {
      // لو عنصر واحد، أضفه كما هو
      result.push(groupItems[0]);
    } else if (groupItems.length === 2) {
      // لو عنصرين، ادمجهم بـ "and"
      result.push(groupItems[0] + ' and ' + groupItems[1]);
    } else {
      // لو أكثر من عنصرين، اختصرهم
      if (category === 'meals') {
        result.push('Daily meals as per itinerary');
      } else if (category === 'tours') {
        result.push('Guided tours to major attractions');
      } else if (category === 'entrance') {
        if (type === 'excludes') {
          // Do not suggest entrance fees in excludes via grouping
          // result.push('Entrance fees'); 
        } else {
          result.push('Entrance fees to all mentioned sites');
        }
      } else if (category === 'accommodation') {
        result.push('Hotel accommodation as per itinerary');
      } else if (category === 'transport') {
        result.push('All transfers as per itinerary');
      } else if (category === 'personal') {
        result.push('Personal expenses and optional purchases');
      } else {
        // للمجموعات الأخرى، خذ أول عنصرين وأضف "and more"
        result.push(groupItems[0] + ', ' + groupItems[1] + ', and more');
      }
    }
  }
  
  // لو لسه أكثر من الحد الأقصى، خذ الأهم
  // ملاحظة: العناصر المحمية تأتي أولاً، لذا سيتم الحفاظ عليها إلا إذا كان عددها كبيراً جداً
  if (result.length > maxCount) {
    Logger.log('⚠️ Still exceeding max after grouping. Taking top ' + maxCount + ' items.');
    result = result.slice(0, maxCount);
  }
  
  return result;
}

/**
 * توليد includes افتراضية لضمان الحد الأدنى (7 عناصر)
 * تستخدم عند عدم وجود includes كافية من الـ AI
 */
function getDefaultIncludes_(count, existingIncludes) {
  var defaults = [
    'Professional tour guide',
    'All transfers as mentioned',
    'Accommodation as per itinerary',
    'Daily breakfast',
    'Entrance fees to mentioned sites',
    'All taxes and service charges',
    'Meet and assist service',
    'Bottled water during tours'
  ];
  
  var result = [];
  var existingLower = existingIncludes.map(function(item) { 
    return item.toLowerCase(); 
  });
  
  // أضف فقط العناصر التي لا تتشابه مع الموجودة
  for (var i = 0; i < defaults.length && result.length < count; i++) {
    var defaultLower = defaults[i].toLowerCase();
    var isDuplicate = false;
    
    // تحقق من التشابه
    for (var j = 0; j < existingLower.length; j++) {
      if (existingLower[j].indexOf(defaultLower.split(' ')[0]) !== -1 ||
          defaultLower.indexOf(existingLower[j].split(' ')[0]) !== -1) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      result.push(defaults[i]);
    }
  }
  
  return result.slice(0, count);
}

/**
 * توليد excludes افتراضية لضمان الحد الأدنى
 * تستخدم عند عدم وجود excludes كافية من الـ AI
 */
function getDefaultExcludes_(count) {
  var defaults = [
    'Personal expenses and shopping',
    'Optional extras unless selected',
    'Gratuities and tips',
    'Travel insurance',
    'Visa fees (if applicable)',
    'Airport departure taxes (if not included)',
    'Any services not mentioned in the itinerary',
    'Beverages during meals (unless specified)'
  ];
  
  // أرجع العدد المطلوب فقط
  return defaults.slice(0, count);
}

/**
 * إزالة التكرار والعناصر المتشابهة
 * يحذف فقط لو التشابه > 70% (نفس الكلمات تقريباً)
 */
function deduplicateSimilarItems_(items, type, tripId) {
  if (!Array.isArray(items) || items.length === 0) return items;
  
  var result = [];
  var duplicatesRemoved = 0;
  
  items.forEach(function(item) {
    var isDuplicate = false;
    var itemWords = item.toLowerCase().split(/\s+/);
    
    // تحقق من التشابه مع العناصر الموجودة
    for (var i = 0; i < result.length; i++) {
      var existingWords = result[i].toLowerCase().split(/\s+/);
      var similarity = calculateSimilarity_(itemWords, existingWords);
      
      // لو التشابه > 70%، اعتبره تكرار
      if (similarity > 0.7) {
        if (item.length < result[i].length) {
          Logger.log('🔄 DEDUPLICATION [Trip ' + tripId + ']: Replacing "' + result[i] + '" with shorter "' + item + '"');
          result[i] = item;
        } else {
          Logger.log('🔄 DEDUPLICATION [Trip ' + tripId + ']: Skipping duplicate "' + item + '"');
        }
        
        isDuplicate = true;
        duplicatesRemoved++;
        break;
      }
    }
    
    if (!isDuplicate) {
      result.push(item);
    }
  });
  
  if (duplicatesRemoved > 0) {
    Logger.log('✅ DEDUPLICATION [Trip ' + tripId + ']: Removed ' + duplicatesRemoved + 
               ' duplicate/similar ' + type);
  }
  
  return result;
}

/**
 * حساب نسبة التشابه بين مجموعتين من الكلمات
 * يرجع رقم بين 0 و 1 (1 = متطابق تماماً)
 */
function calculateSimilarity_(words1, words2) {
  if (words1.length === 0 || words2.length === 0) return 0;
  
  var commonWords = 0;
  var totalWords = Math.max(words1.length, words2.length);
  
  words1.forEach(function(word) {
    if (words2.indexOf(word) !== -1) {
      commonWords++;
    }
  });
  
  return commonWords / totalWords;
}

/**
 * اختصار النصوص الطويلة جداً
 * مثل: "Professional Egyptologist guide throughout your Egypt Classic Tour" 
 *    → "Professional Egyptologist guide"
 */
function shortenLongTexts_(items) {
  if (!Array.isArray(items)) return items;
  
  var MAX_LENGTH = 120; // الحد الأقصى للطول
  
  return items.map(function(item) {
    // ⚠️ استثناء: لا تقم باختصار العناصر الاختيارية (Add-ons) للحفاظ على السعر والصيغة
    if (item.indexOf('(Optional add-on') !== -1) {
      return item;
    }
    
    if (item.length <= MAX_LENGTH) return item;
    
    // محاولة الاختصار الذكي
    var shortened = item;
    
    // إزالة العبارات الزائدة
    shortened = shortened.replace(/\s+throughout\s+your\s+.+$/i, '');
    shortened = shortened.replace(/\s+during\s+your\s+.+$/i, '');
    shortened = shortened.replace(/\s+as\s+per\s+itinerary$/i, '');
    shortened = shortened.replace(/\s+\(if\s+.+\)$/i, '');
    
    // لو لسه طويل، اقطع عند أول 60 حرف
    if (shortened.length > MAX_LENGTH) {
      shortened = shortened.substring(0, MAX_LENGTH).trim();
      // تأكد أنه ينتهي بكلمة كاملة
      var lastSpace = shortened.lastIndexOf(' ');
      if (lastSpace > MAX_LENGTH * 0.7) {
        shortened = shortened.substring(0, lastSpace);
      }
    }
    
    shortened = shortened.trim();
    
    // Remove trailing " and" or " or"
    if (shortened.toLowerCase().endsWith(' and')) shortened = shortened.slice(0, -4).trim();
    if (shortened.toLowerCase().endsWith(' or')) shortened = shortened.slice(0, -3).trim();
    if (shortened.endsWith(',')) shortened = shortened.slice(0, -1).trim();

    return shortened;
  });
}

/**
 * فلترة excludes الغريبة أو غير المناسبة
 * مثل: "Smoking the water pipe (Shisha)" ← غريب!
 */
function filterInappropriateExcludes_(items, tripId) {
  if (!Array.isArray(items)) return items;
  
  var INAPPROPRIATE_KEYWORDS = [
    'shisha', 'hookah', 'water pipe', 'smoking',
    'alcohol', 'alcoholic', 'beer', 'wine',
    'casino', 'gambling', 'nightclub'
  ];
  
  var filtered = [];
  var removedCount = 0;
  
  items.forEach(function(item) {
    var lower = item.toLowerCase();
    var isInappropriate = false;
    
    for (var i = 0; i < INAPPROPRIATE_KEYWORDS.length; i++) {
      if (lower.indexOf(INAPPROPRIATE_KEYWORDS[i]) !== -1) {
        isInappropriate = true;
        Logger.log('🚫 FILTER [Trip ' + tripId + ']: Removed inappropriate exclude: "' + item + '"');
        removedCount++;
        break;
      }
    }
    
    if (!isInappropriate) {
      filtered.push(item);
    }
  });
  
  return filtered;
}

/**
 * فلترة Excludes التي تتعارض مع Includes أو الواقع
 * أهم شيء: إزالة "Entrance fees" من Excludes لو الرحلة شاملة التذاكر
 */
function filterConflictingExcludes_(excludes, includes, rawExcludes, tripId) {
  if (!Array.isArray(excludes)) return excludes;
  
  var filtered = [];
  var removedCount = 0;
  
  // هل "Entrance fees" موجودة صراحة في Raw Excludes؟
  var explicitlyExcludedRaw = false;
  var rawExcludesLower = (rawExcludes || []).join(' ').toLowerCase();
  if (rawExcludesLower.indexOf('entrance') !== -1 || rawExcludesLower.indexOf('ticket') !== -1 || rawExcludesLower.indexOf('admission') !== -1) {
    explicitlyExcludedRaw = true;
  }

  // هل "Entrance fees" موجودة في Includes المولدة؟
  var implicitlyIncluded = false;
  var includesLower = (includes || []).join(' ').toLowerCase();
  if (includesLower.indexOf('entrance') !== -1 || includesLower.indexOf('ticket') !== -1 || includesLower.indexOf('admission') !== -1) {
    implicitlyIncluded = true;
  }

  excludes.forEach(function(item) {
    var lower = item.toLowerCase();
    
    // فحص Entrance Fees
    if (lower.indexOf('entrance') !== -1 || lower.indexOf('admission') !== -1 || lower.indexOf('ticket') !== -1) {
      // لو مش موجودة في Raw Excludes، و(موجودة في Includes أو مش موجودة خالص في Raw) -> احذفها
      // القاعدة: لا تضيفها للـ Excludes إلا لو ذكرت صراحة في Raw Excludes
      if (!explicitlyExcludedRaw) {
        Logger.log('🚫 CONFLICT FILTER [Trip ' + tripId + ']: Removed "' + item + '" from Excludes (Not in Raw Excludes)');
        removedCount++;
        return; // Skip adding this item
      }
      
      // لو موجودة في Includes، احذفها من Excludes قطعاً
      if (implicitlyIncluded) {
        Logger.log('🚫 CONFLICT FILTER [Trip ' + tripId + ']: Removed "' + item + '" from Excludes (Found in Includes)');
        removedCount++;
        return; // Skip adding this item
      }
    }
    
    filtered.push(item);
  });
  
  if (removedCount > 0) {
    Logger.log('✅ CONFLICT RESOLUTION [Trip ' + tripId + ']: Removed ' + removedCount + ' conflicting items from Excludes.');
  }
  
  return filtered;
}

/**
 * جلب بيانات Includes الخام بطريقة متقدمة (مثل AddOns)
 * تبحث بالاسم، TripID، و Record ID
 */
function fetchRawIncludesForTrip_(tripId, tripNumber, tripName) {
  var items = [];
  try {
    Logger.log('AI Inc/Exc: fetching raw Includes for Trip ' + tripId + ' (TripID: ' + tripNumber + ', Name: ' + tripName + ')');
    var conditions = [];
    if (tripName) {
      var safeName = tripName.replace(/'/g, "\\'");
      conditions.push("FIND('" + safeName + "', ARRAYJOIN({Trip}))");
    }
    if (tripNumber) {
      conditions.push("FIND('" + tripNumber + "', ARRAYJOIN({Trip}))");
    }
    if (tripId) {
      conditions.push("FIND('" + tripId + "', ARRAYJOIN({Trip}))");
    }
    var formula = "OR(" + conditions.join(", ") + ")";
    
    Logger.log('AI Inc/Exc: Includes filter formula: ' + formula);
    var res = airtableGet_(TRIP_INCLUDES_BASE_TABLE, { filterByFormula: formula, pageSize: 100 });
    var records = res && res.records ? res.records : [];
    
    Logger.log('AI Inc/Exc: found ' + records.length + ' raw Includes records');
    records.forEach(function(rec) {
      var f = rec.fields || {};
      var val = (f[INCLUDE_TEXT_FIELD] || '').toString().trim();
      if (val) items.push(val);
    });
  } catch (e) {
    Logger.log('AI Inc/Exc: error fetching raw Includes: ' + e.message);
  }
  return items;
}

/**
 * جلب بيانات Excludes الخام بطريقة متقدمة (مثل AddOns)
 * تبحث بالاسم، TripID، و Record ID
 */
function fetchRawExcludesForTrip_(tripId, tripNumber, tripName) {
  var items = [];
  try {
    Logger.log('AI Inc/Exc: fetching raw Excludes for Trip ' + tripId + ' (TripID: ' + tripNumber + ', Name: ' + tripName + ')');
    var conditions = [];
    if (tripName) {
      var safeName = tripName.replace(/'/g, "\\'");
      conditions.push("FIND('" + safeName + "', ARRAYJOIN({Trip}))");
    }
    if (tripNumber) {
      conditions.push("FIND('" + tripNumber + "', ARRAYJOIN({Trip}))");
    }
    if (tripId) {
      conditions.push("FIND('" + tripId + "', ARRAYJOIN({Trip}))");
    }
    var formula = "OR(" + conditions.join(", ") + ")";
    
    Logger.log('AI Inc/Exc: Excludes filter formula: ' + formula);
    var res = airtableGet_(TRIP_EXCLUDES_BASE_TABLE, { filterByFormula: formula, pageSize: 100 });
    var records = res && res.records ? res.records : [];
    
    Logger.log('AI Inc/Exc: found ' + records.length + ' raw Excludes records');
    records.forEach(function(rec) {
      var f = rec.fields || {};
      var val = (f[EXCLUDE_TEXT_FIELD] || '').toString().trim();
      if (val) items.push(val);
    });
  } catch (e) {
    Logger.log('AI Inc/Exc: error fetching raw Excludes: ' + e.message);
  }
  return items;
}
