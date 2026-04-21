/************************************************************
 * AI SEO ENHANCER — Independent batch for SEO & marketing
 * 
 * - يقرأ سجلات من جدول "Improvement With AI" حيث AI_SEO_Status = 'Pending'
 * - يستخدم المحتوى المحسن (AI_Trip_Description, AI_Overview_Section_Title, ...)
 *   + بيانات SEO الأصلية من Trips (Permalink, SEO_FocusKeywords, SEO_FocusKeywords_List)
 * - يبني:
 *   - AI_SEO_Title
 *   - AI_SEO_Meta_Description
 *   - AI_Marketing_Tagline
 *   - AI_Short_Summary
 *   - AI_SEO_Permalink
 *   - AI_SEO_FocusKeywords
 *   - AI_SEO_FocusKeywords_List
 *   - AI_Excerpt
 * - يحفظ النتيجة في جدول "Improvement With AI"
 * - ويحدّث حقل Slug في جدول Trips بالـ AI_SEO_Permalink المحسّن
 ************************************************************/

/*********************** CONFIG ******************************/

// نتأكد إن اسم جدول التحسين موجود (إما من ai_enhancer.gs أو نستخدم الافتراضي)
if (typeof AI_IMPROVEMENT_TABLE === 'undefined') {
  var AI_IMPROVEMENT_TABLE = 'Improvement With AI';
}

// عدد السجلات التي يتم تحسينها في كل تشغيل
var AI_SEO_BATCH_SIZE = 1;  // Process one trip at a time

var AI_SEO_TITLE_MAX_LEN_ = 100;
var AI_SEO_META_MAX_LEN_ = 160;
var AI_SEO_SLUG_MAX_LEN_ = 75;
var AI_SEO_SLUG_MIN_LEN_ = 18;

function normalizeWhitespaceSeoEn_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function truncateAtWordBoundarySeoEn_(text, maxLen) {
  var s = normalizeWhitespaceSeoEn_(text);
  var n = Number(maxLen || 0);
  if (!n || n <= 0) return s;
  if (s.length <= n) return s;
  var slice = s.substring(0, n + 1);
  var cut = slice.lastIndexOf(' ');
  if (cut < Math.floor(n * 0.7)) cut = n;
  return s.substring(0, cut).trim();
}

function stripTrailingConnectorsSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return s;
  var badSuffixes = [
    ' &', ' -', ':', ';', ',', '|',
    ' and', ' or', ' but',
    ' with', ' for', ' to', ' of', ' in', ' on', ' at', ' by', ' from'
  ];
  var changed = true;
  while (changed) {
    changed = false;
    for (var i = 0; i < badSuffixes.length; i++) {
      var suf = badSuffixes[i];
      if (s.length > suf.length && s.toLowerCase().lastIndexOf(suf) === s.length - suf.length) {
        s = s.substring(0, s.length - suf.length).trim();
        changed = true;
      }
    }
    s = s.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim();
    s = s.replace(/[^a-zA-Z0-9)]+$/g, '').trim();
  }
  return s;
}

function finalizeSeoTextFieldEn_(text, maxLen) {
  var before = String(text || '');
  var s = stripTrailingConnectorsSeoEn_(truncateAtWordBoundarySeoEn_(before, maxLen));
  s = stripTrailingConnectorsSeoEn_(s);
  return s;
}

function normalizeSlugEn_(slug) {
  var s = String(slug || '').toLowerCase().trim();
  s = s.replace(/\s+/g, '-');
  s = s.replace(/[^a-z0-9\-]/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

function finalizeSeoSlugEn_(candidate, fallbackSlug, tripTitle) {
  var s = normalizeSlugEn_(candidate);
  var fb = normalizeSlugEn_(fallbackSlug);
  var tt = normalizeSlugEn_(tripTitle);
  if (s.length > AI_SEO_SLUG_MAX_LEN_) {
    var cut = s.substring(0, AI_SEO_SLUG_MAX_LEN_);
    var lastHyphen = cut.lastIndexOf('-');
    if (lastHyphen > Math.floor(AI_SEO_SLUG_MAX_LEN_ * 0.6)) cut = cut.substring(0, lastHyphen);
    s = cut.replace(/-+$/g, '');
  }
  if (s.length < AI_SEO_SLUG_MIN_LEN_) {
    if (fb.length >= AI_SEO_SLUG_MIN_LEN_) s = fb;
    else if (tt.length >= AI_SEO_SLUG_MIN_LEN_) s = tt;
  }
  return s;
}

/************************************************************
 * KEYWORDS HELPERS
 ************************************************************/
function isEnglishSeoKeywordPhrase_(s) {
  var t = String(s || '').trim();
  if (!t) return false;
  if (/[\u0600-\u06FF]/.test(t)) return false;
  if (/[\u0400-\u04FF]/.test(t)) return false;
  if (/[\u4E00-\u9FFF]/.test(t)) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/[^A-Za-z0-9 '&\-\.,/()]/.test(t)) return false;
  return true;
}

function normalizeKeywordsListToEnglish_(value) {
  var raw = value;
  var list = [];
  if (Array.isArray(raw)) {
    list = raw.map(function(x) { return String(x || '').trim(); });
  } else if (raw) {
    list = String(raw).split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); });
  }

  list = list.filter(function(x) { return !!x; });
  list = list.filter(isEnglishSeoKeywordPhrase_);

  var seen = {};
  var uniq = [];
  list.forEach(function(x) {
    var k = x.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    uniq.push(x);
  });

  if (uniq.length > 8) uniq = uniq.slice(0, 8);
  return uniq;
}

/************************************************************
 * ENTRY POINT — لتشغيله بالـ Trigger
 ************************************************************/

/**
 * Main function: Run AI SEO enhancement batch
 * Trigger this every 10–15 minutes via time-driven trigger
 */
function runAiSeoEnhancementBatch() {
  loadConfigSecrets_();
  Logger.log('AI SEO Enhancer: starting batch...');

  try {
    var trips = fetchTripsNeedingSeo_(AI_SEO_BATCH_SIZE);

    if (!trips || !trips.length) {
      Logger.log('AI SEO Enhancer: no trips with AI_SEO_Status = Pending');
      return;
    }

    trips.forEach(function (tripRec) {
      var tripId = tripRec.id;
      var fields = tripRec.fields || {};
      
      // Extract improvement record info if available
      var improvementId = fields._improvementRecordId;
      var improvementFields = fields._improvementFields || {};

      try {
        Logger.log('AI SEO Enhancer: processing Trip ' + tripId);

        if (!claimStage_(tripId, 'SEO', 20 * 60)) {
          Logger.log('AI SEO Enhancer: stage already claimed; skipping Trip ' + tripId);
          return;
        }

        // 1) Update status to Processing (in Improvement table)
        if (improvementId) {
          airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, { AI_SEO_Status: 'Processing' });
        }

        // 2) Fetch actual Trip record to get full fields
        var tripRecord = airtableGet_('Trips', {
          filterByFormula: "RECORD_ID() = '" + tripId + "'",
          maxRecords: 1
        });
        
        if (!tripRecord || !tripRecord.records || !tripRecord.records.length) {
          throw new Error('Could not fetch Trip record for ID: ' + tripId);
        }
        
        var tripFields = tripRecord.records[0].fields;

        // 3) Fetch linked context text
        var U = buildUnifiedTripContext_(tripId, tripFields);
        var linkedTextBlocks = [
          U && U.highlightsText ? U.highlightsText : '',
          U && U.itineraryText ? U.itineraryText : '',
          U && U.includesText ? U.includesText : '',
          U && U.excludesText ? U.excludesText : '',
          U && U.addonsText ? U.addonsText : '',
          U && U.detailsText ? U.detailsText : '',
          U && U.packagesText ? U.packagesText : '',
          U && U.faqsText ? U.faqsText : '',
          U && U.pickupText ? U.pickupText : ''
        ].filter(function(s){ return !!s; });

        // 4) Build Prompt
        // Merge trip fields and improvement fields for the prompt builder
        var combinedFields = {};
        for (var k in tripFields) {
          if (tripFields.hasOwnProperty(k)) {
            combinedFields[k] = tripFields[k];
          }
        }
        for (var k2 in improvementFields) {
          if (improvementFields.hasOwnProperty(k2)) {
            combinedFields[k2] = improvementFields[k2];
          }
        }

        var prompt = buildSeoPromptFromImprovedContent_(combinedFields, linkedTextBlocks);

        // 5) Call AI
        if (typeof callAi_ !== 'function') {
          throw new Error('callAi_ function is not defined');
        }
        
        var aiResult = callAi_(prompt);

        if (!aiResult || typeof aiResult !== 'object') {
          throw new Error('Invalid AI SEO result (not an object)');
        }

        if (aiResult.AI_SEO_FocusKeywords_List !== undefined) {
          var englishList = normalizeKeywordsListToEnglish_(aiResult.AI_SEO_FocusKeywords_List);
          if (!englishList.length && aiResult.AI_SEO_FocusKeywords) {
            var fk = String(aiResult.AI_SEO_FocusKeywords || '').trim();
            if (fk && isEnglishSeoKeywordPhrase_(fk)) englishList = [fk];
          }
          aiResult.AI_SEO_FocusKeywords_List = englishList;
        }

        // --- DUPLICATE CHECK SYSTEM ---
        // Verify keyword uniqueness and resolve if necessary
        // DISABLED per user request
        // ensureUniqueKeyword_(aiResult, tripId, improvementId);
        // ------------------------------

        var improvedSignals = [
          combinedFields.AI_Trip_Description,
          combinedFields.AI_Overview_Section_Title,
          combinedFields.AI_Itinerary_Description,
          combinedFields.AI_Tab_Content,
          combinedFields.AI_Why_People_Love_This_Trip_Section_Title
        ].map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
        if (improvedSignals.length) Logger.log('AI SEO Enhancer: Using improved content as primary SEO source');
        else Logger.log('AI SEO Enhancer: Using raw fallback content for SEO source');

        if (aiResult.AI_SEO_Title) {
          var beforeTitle = String(aiResult.AI_SEO_Title || '').trim();
          aiResult.AI_SEO_Title = finalizeSeoTextFieldEn_(aiResult.AI_SEO_Title, AI_SEO_TITLE_MAX_LEN_);
          if (beforeTitle !== aiResult.AI_SEO_Title) Logger.log('AI SEO Enhancer: SEO title cleaned');
        }
        if (aiResult.AI_SEO_Meta_Description) {
          var beforeMeta = String(aiResult.AI_SEO_Meta_Description || '').trim();
          aiResult.AI_SEO_Meta_Description = finalizeSeoTextFieldEn_(aiResult.AI_SEO_Meta_Description, AI_SEO_META_MAX_LEN_);
          if (beforeMeta !== aiResult.AI_SEO_Meta_Description) Logger.log('AI SEO Enhancer: SEO meta description cleaned');
        }
        if (aiResult.AI_SEO_Permalink) {
          var beforeSlug = String(aiResult.AI_SEO_Permalink || '').trim();
          var originalPermalink = combinedFields.Permalink || '';
          aiResult.AI_SEO_Permalink = finalizeSeoSlugEn_(aiResult.AI_SEO_Permalink, originalPermalink, combinedFields.Title || '');
          if (beforeSlug !== aiResult.AI_SEO_Permalink) Logger.log('AI SEO Enhancer: slug trimmed/repaired');
        }

        // 6) Prepare Update for Improvement With AI
        var updateFields = {
          AI_SEO_Title:              aiResult.AI_SEO_Title || '',
          AI_SEO_Meta_Description:   aiResult.AI_SEO_Meta_Description || '',
          AI_Marketing_Tagline:      aiResult.AI_Marketing_Tagline || '',
          AI_Short_Summary:          aiResult.AI_Short_Summary || '',
          
          // New SEO fields
          AI_SEO_Permalink:          aiResult.AI_SEO_Permalink || '',
          AI_SEO_FocusKeywords:      aiResult.AI_SEO_FocusKeywords || '',
          AI_SEO_FocusKeywords_List: aiResult.AI_SEO_FocusKeywords_List || '',
          AI_Excerpt:                aiResult.AI_Excerpt || '',

          AI_SEO_Status:             'Done',
          AI_SEO_LastUpdated:        new Date().toISOString()
        };

        // 7) Update Improvement Record
        if (improvementId) {
          airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, updateFields);
          // 8) Ensure status is Done
          airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, { AI_SEO_Status: 'Done' });
        }

        // 9) Update Trips table with new optimized Slug
        if (tripId) {
          var tripUpdates = {};
          
          if (aiResult.AI_SEO_Permalink) {
            tripUpdates.Slug = String(aiResult.AI_SEO_Permalink);
          }
          
          airtableUpdate_('Trips', tripId, tripUpdates);
        }

        Logger.log('AI SEO Enhancer: completed Trip ' + tripId);

      } catch (recErr) {
        Logger.log('AI SEO Enhancer: error processing Trip ' + tripId + ' — ' + recErr.message);
        
        // Log error to improvement record
        if (improvementId) {
          airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, {
            AI_SEO_Status: 'Error',
            AI_SEO_LastUpdated: new Date().toISOString(),
            AI_SEO_Error_Message: String(recErr.message).slice(0, 1000)
          });
        }
      }
    });

  } catch (e) {
    Logger.log('AI SEO Enhancer: fatal batch error — ' + e.message);
  }

  Logger.log('AI SEO Enhancer: batch finished.');
}

/**
 * Fetch trips that need SEO enhancement
 * Queries the Improvement With AI table where AI_SEO_Status = 'Pending'
 */
function fetchTripsNeedingSeo_(limit) {
  var formula = "{AI_SEO_Status} = 'Pending'";

  var res = airtableGet_(AI_IMPROVEMENT_TABLE, {
    filterByFormula: formula,
    maxRecords: limit || 1
  });
  
  if (!res || !res.records) {
    return [];
  }
  
  // Convert Improvement records to trip-like format for compatibility
  var trips = [];
  for (var i = 0; i < res.records.length; i++) {
    var impRec = res.records[i];
    var tripLinks = impRec.fields.Trip;
    
    if (tripLinks && tripLinks.length > 0) {
      trips.push({
        id: tripLinks[0], // Trip Record ID
        fields: {
          _improvementRecordId: impRec.id,
          _improvementFields: impRec.fields
        }
      });
    }
  }
  
  return trips;
}

/**
 * buildSeoPromptFromImprovedContent_
 * 
 * Generates a prompt for AI to produce RankMath-compliant SEO data.
 * - Title: HARD MAX 60 characters
 * - Slug (AI_SEO_Permalink): HARD MAX 70 characters
 * - Meta Description: HARD MAX 160 characters
 */
function buildSeoPromptFromImprovedContent_(fields, linkedTextBlocks) {
  // 1. Determine Content Source (Improved vs Raw)
  // This stage is designed to benefit from improved content when available.
  // Fallback to raw fields only if improved fields are missing.
  
  var overviewTitle   = fields.AI_Overview_Section_Title || fields.Overview_Section_Title || '';
  var tripDescription = fields.AI_Trip_Description || fields.Trip_Description || '';
  var itineraryDesc   = fields.AI_Itinerary_Description || fields.Itinerary_Description || '';
  var tabContent      = fields.AI_Tab_Content || fields.Tab_Content || '';
  var whyLoveTitle    = fields.AI_Why_People_Love_This_Trip_Section_Title || fields.Why_People_Love_This_Trip_Section_Title || '';
  var tripTitle       = fields.Title || ''; // Raw Title is very important for SEO
  var destination     = fields.Destination || ''; // If available

  // Duration Logic (Use calculated values from AI Enhancer if available)
  var dHours = fields.Duration_Hours || fields.Duration_Hours_Raw || '';
  var dMinutes = fields.Duration_Minutes || fields.Duration_Minutes_Raw || '';
  var dUnit = fields.Duration_Unit || fields.Duration_Unit_Raw || '';
  
  var durationString = '';
  if (dHours || dMinutes) {
      if (dUnit === 'days') {
          durationString = dHours + ' Days';
      } else {
          // Format as "X.Y Hours" or "X Hours Y Minutes"
          // If minutes is 30, use 0.5 hours or just say 4.5 Hours?
          // Let's stick to what's natural for titles: "4.5-Hour" or "5-Hour"
          var h = Number(dHours || 0);
          var m = Number(dMinutes || 0);
          var totalHours = h + (m / 60);
          // Round to 1 decimal place if needed
          var niceHours = Math.round(totalHours * 10) / 10; 
          durationString = niceHours + ' Hours';
          
          if (m === 0) durationString = h + ' Hours'; // 4 Hours
          else if (m === 30) durationString = h + '.5 Hours'; // 4.5 Hours
      }
  }

  var linkedText = Array.isArray(linkedTextBlocks) && linkedTextBlocks.length
    ? linkedTextBlocks.join("\n")
    : '';

  // Original SEO data (for reference)
  var originalSeoTitle        = fields.SEO_Title || '';
  var originalMetaDesc        = fields.SEO_Meta_Description || '';
  var originalPermalink       = fields.Permalink || '';
  var originalSeoFocus        = fields.SEO_FocusKeywords || '';
  var originalSeoKeywordsList = fields.SEO_FocusKeywords_List || '';

  var seoKeywordsJoined = '';
  var englishProvidedList = normalizeKeywordsListToEnglish_(originalSeoKeywordsList);
  if (englishProvidedList.length) {
    seoKeywordsJoined = englishProvidedList.join(', ');
  }

  var prompt =
    "You are an expert travel SEO copywriter and strategist specializing in RankMath optimization.\n\n" +
    "TASK 0: DURATION ANALYSIS (CRITICAL FIRST STEP)\n" +
    "- The 'Trip Duration' provided above might be Raw/Inaccurate. You MUST verify it.\n" +
    "- Analyze the 'Extra Context' (specifically Itinerary Steps) below.\n" +
    "- SUM the time of activities mathematically (e.g. 25 mins + 2.5 hours = 2 hours 55 mins -> Round to 3 Hours or 3.5 Hours? No, use 3 Hours).\n" +
    "- Example: If Raw says '3 Hours' but Itinerary has steps summing to 4.5 Hours, USE 4.5 HOURS.\n" +
    "- If the Itinerary is missing or vague, stick to the provided 'Trip Duration'.\n" +
    "- This Calculated Duration is the one you MUST use if you mention duration in the Title.\n\n" +
    "INPUT DATA (Raw Trip Info):\n" +
    "Trip Title: " + tripTitle + "\n" +
    "Trip Duration: " + durationString + "\n" +
    "Overview Title: " + overviewTitle + "\n" +
    "Trip Description: " + tripDescription + "\n" +
    "Itinerary Description: " + itineraryDesc + "\n" +
    "Tab Content: " + tabContent + "\n" +
    "Why People Love This: " + whyLoveTitle + "\n" +
    "Extra Context: " + linkedText + "\n" +
    "Original SEO Title: " + originalSeoTitle + "\n" +
    "Original Meta Description: " + originalMetaDesc + "\n" +
    "Original Permalink: " + originalPermalink + "\n" +
    "Original SEO Focus Keyword: " + originalSeoFocus + "\n" +
    "Original SEO Keywords List: " + seoKeywordsJoined + "\n\n" +
    
    "YOUR TASK:\n" +
    (originalSeoFocus && originalSeoFocus.trim().length > 0
      ? "1. STRICTLY USE THE PROVIDED FOCUS KEYWORD: You MUST use '" + originalSeoFocus + "' as your main Focus Keyword. Do NOT generate a new one. All optimization must be based on this exact keyword.\n"
      : "1. ANALYZE the trip content and DETERMINE the single best 'Focus Keyword' (2-4 words).\n" +
        "   - PRIORITIZE TRANSACTIONAL/COMMERCIAL INTENT: The keyword must target users looking to BOOK a trip (e.g., 'Luxor day tour', 'Nile cruise booking', 'Hurghada snorkeling trip').\n" +
        "   - Avoid purely informational keywords (e.g., 'History of Luxor', 'What to do in Hurghada').\n" +
        "   - It must be high-volume, relevant, and natural.\n"
    ) +
    "2. GENERATE a list of 3-8 related keywords.\n" +
    "3. CREATE highly optimized SEO fields (Title, Slug, Meta Description) based on that Focus Keyword.\n" +
    "   - You must strictly follow RankMath constraints.\n" +
    "   - CRITICAL: Ensure the Focus Keyword appears in the Meta Description and if possible in the Title.\n\n" +

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

    "TITLE FORMATTING STRATEGY (STRICTLY FOLLOW ONE OF THESE PATTERNS):\n" +
    "Determine the 'Trip Type' based on the Input Data and apply the corresponding format:\n\n" +
    "TYPE 1: Day Trip (Travel from Origin -> Different Destination)\n" +
    "   - Format: 'From [Origin]: [Destination] [Highlights] Tour'\n" +
    "   - Example: 'From Hurghada: Cairo and Giza Highlights Full-Day Tour'\n" +
    "TYPE 2: Same City Tour (Activity within the same city/region)\n" +
    "   - Format: '[City]: [Highlights] Tour'\n" +
    "   - Example: 'Cairo: Pyramids & Great Sphinx Private Tour'\n" +
    "TYPE 3: Multi-Day Package (Duration > 1 Day, multiple cities)\n" +
    "   - Format: '[Number] Days [City1], [City2] & [City3] Package'\n" +
    "   - Note: List cities in itinerary order. Use ',' between cities and '&' before the last one.\n" +
    "   - Example: '6 Days Cairo, Luxor, Aswan & Abu Simbel Package'\n" +
    "TYPE 4: Shore Excursion (From Port)\n" +
    "   - Format: 'From [Port]: [Destination] & [Highlights] Excursion'\n" +
    "   - Example: 'From Alexandria Port: Cairo Pyramids & Sphinx Excursion'\n" +
    "TYPE 5: Nile Cruise (Specific Cruise Trips)\n" +
    "   - Format: '[Number] Nights Nile Cruise from [StartCity] to [EndCity]'\n" +
    "   - Example: '4 Nights Nile Cruise from Luxor to Aswan'\n" +
    "TYPE 6: Transfers (Airport/City Transfers)\n" +
    "   - Format: 'Transfer from [Origin] to [Destination] ([VehicleType])'\n" +
    "   - Example: 'Transfer from Cairo Airport to Giza Hotel (Private Van)'\n\n" +

    "GENERAL HARD LIMITS (STRICT – DO NOT BREAK):\n" +
    "- AI_SEO_Title: Target 50-60 characters. Ensure the title is COMPLETE and NOT cut off.\n" +
    "  * CRITICAL: Follow the 'TITLE FORMATTING STRATEGY' above.\n" +
    "  * Use '&' instead of 'and' to save space. Use ':' to separate location from activity.\n" +
    "  * OPTIONAL: You may include a positive sentiment word (e.g., Amazing, Exclusive, Top, Best) ONLY if it fits naturally and adds value. Do NOT force it if it makes the title unnatural or too long.\n" +
    "- AI_SEO_Permalink (slug only, without domain): Target 50-70 characters (RankMath safe limit is 75).\n" +
    "  * CRITICAL: The slug MUST contain the Focus Keyword (slugified). This is a Pass/Fail check in RankMath.\n" +
    "  * MUST be lowercase, use hyphens (-) as separators, NO spaces.\n" +
    "  * Example: if keyword is 'Cairo Day Tour', slug MUST contain 'cairo-day-tour'.\n" +
    "- AI_SEO_Meta_Description: ABSOLUTE HARD MAX 160 characters. You are NOT allowed to exceed 160 characters.\n" +
    "- BEFORE returning the JSON, you MUST mentally count/estimate characters and REWRITE any text that is too long until it is inside the limit.\n" +
    "- Do NOT include character counts or extra notes in the output, only the final clean text.\n\n" +

    "DETAILED REQUIREMENTS PER FIELD:\n" +
    "1) AI_SEO_FocusKeywords (THE STRATEGY):\n" +
    (originalSeoFocus && originalSeoFocus.trim().length > 0
      ? "- You MUST use the provided keyword: '" + originalSeoFocus + "'. Do not change it.\n"
      : "- Choose the MAIN keyword for this trip.\n") +
    "- This keyword will be used by subsequent AI agents to write the full content.\n\n" +

    "2) AI_SEO_Title:\n" +
    "- Original SEO Title: '" + originalSeoTitle + "'\n" +
    "- CRITICAL: FIRST, evaluate if the original SEO title is ALREADY RankMath-compliant:\n" +
    "  ✓ Is it 60 characters or less?\n" +
    "  ✓ Does it START with the Focus Keyword phrase EXACTLY (Verbatim)?\n" +
    "  ✓ Does it contain at least one NUMBER (digit 0-9)?\n" +
    "  ✓ Is it catchy, clear, and clickable?\n" +
    "- IF ALL CHECKS PASS → YOU MUST KEEP the original SEO title unchanged (return it exactly as-is in AI_SEO_Title).\n" +
    "  * This preserves brand consistency and avoids unnecessary changes to working titles.\n" +
    "- IF ANY CHECK FAILS → GENERATE a NEW optimized title following these rules:\n" +
    "  * Language: ENGLISH only.\n" +
    "  * STRICT TEMPLATE: You MUST use one of these formats:\n" +
    "      1. '[Power Word] [Focus Keyword]: [Benefit/Hook]'\n" +
    "      2. '[Power Word] [Focus Keyword] [Benefit/Hook]'\n" +
    "      3. '[Focus Keyword]: [Power Word] [Benefit/Hook]'\n" +
    "  * DURATION RULE:\n" +
    "    - IF you include the duration in the title (e.g. '4 Hours' or '2 Days'), you MUST use the VERIFIED DURATION from TASK 0.\n" +
    "    - Do NOT blindly trust the 'Trip Duration' input if your analysis proves it wrong.\n" +
    "    - Do NOT invent or round the duration differently.\n" +
    "  * SENTIMENT WORD GUIDANCE (OPTIONAL):\n" +
    "    - You MAY include a sentiment word if it fits naturally and enhances the title.\n" +
    "    - Do NOT force it if it makes the title too long or awkward.\n" +
    "    - Suggested words (use only if appropriate):\n" +
    "      \n" +
    "      [General]: Amazing, Wonderful, Stunning, Incredible, Unforgettable, Unique, Special, Beautiful, Magical, Best, Top, Perfect, Dream, Ultimate, Exclusive, Guide, Private\n" +
    "      [Nature/Relax]: Relaxing, Scenic, Breathtaking, Peaceful, Refreshing, Natural, Serene\n" +
    "      [Adventure]: Adventurous, Exciting, Thrilling, Epic, Daring, Action-Packed\n" +
    "      [Culture]: Historic, Authentic, Cultural, Classic, Timeless, Traditional\n" +
    "      [Food]: Delicious, Tasty, Flavorful, Gourmet\n" +
    "      [Luxury]: Luxury, Premium, Exclusive, VIP, Private, Elegant\n" +
    "\n" +
    "    - EXAMPLE: 'Amazing Bianca Island Trip: Utopia Island Adventure'\n" +
    "    - EXAMPLE: 'Desert Safari: Dubai Adventure' (No sentiment word is fine too)\n" +
    "    - EXAMPLE: 'Luxury VIP Yacht Tour: Dubai Exclusive Trip'\n" +
    "    - EXAMPLE: 'Walking Tour: Rome Cultural Trip'\n" +
    "  * RULE #1: The Focus Keyword phrase MUST appear early in the title.\n" +
    "  * RULE #2: Do NOT break the Focus Keyword with colons, adjectives, or other words if possible.\n" +
    "  * The title MUST include at least one NUMBER (digit 0–9) IF space permits (e.g. '1-Day', '5-Hour').\n" +
    "  * Length target: 50–60 characters. HARD MAX 60 characters.\n" +
    "  * TRIMMING STRATEGY:\n" +
    "    1. Swap long words for short ones (e.g. 'Ultimate' -> 'Top').\n" +
    "    2. Use '&' instead of 'and'.\n" +
    "    3. Remove generic words like 'Tour' or 'Trip' if context is clear.\n" +
    "    4. CRITICAL: NEVER end a title with a symbol like '&', '-', ':', or whitespace.\n" +
    "       - WRONG: 'Amazing Trip: 4-Hour Cultural &'\n" +
    "       - RIGHT: 'Amazing Trip: 4-Hour Cultural Tour'\n" +
    "       - RIGHT: 'Amazing Trip: 4-Hour Culture'\n" +
    "  * Do NOT add brand or website name; only the trip title itself.\n\n" +

    "3) AI_SEO_Permalink:\n" +
    "- Original Permalink: '" + originalPermalink + "'\n" +
    "- CRITICAL: FIRST, evaluate if the original permalink is ALREADY SEO-FRIENDLY:\n" +
    "  ✓ Is it 75 characters or less?\n" +
    "  ✓ Is it in lowercase English with hyphens only (no underscores, no spaces, no special chars)?\n" +
    "  ✓ Does it contain the Focus Keyword or semantically related terms?\n" +
    "  ✓ Is it clear, descriptive, and uses important words only?\n" +
    "  ✓ Does it avoid unnecessary stop words and repetition?\n" +
    "- IF ALL 5 CHECKS PASS → YOU MUST KEEP the original permalink unchanged (return it exactly as-is in AI_SEO_Permalink).\n" +
    "  * This is CRITICAL for SEO: changing URLs damages Google rankings and creates broken links.\n" +
    "- IF ANY CHECK FAILS → GENERATE a NEW optimized permalink following these rules:\n" +
    "  * PRIORITY #1: The slug MUST include the Focus Keyword (converted to lowercase with hyphens).\n" +
    "    - If Focus Keyword is 'Luxor Day Trip', slug MUST be 'luxor-day-trip' or 'best-luxor-day-trip'.\n" +
    "  * PRIORITY #2: Keep it short (Target 50-60 chars, Max 75 chars).\n" +
    "  * If the Focus Keyword itself is very long (>60 chars), use its main words, but otherwise INCLUDE IT ALL.\n" +
    "  * Must be in ENGLISH, lowercase, words separated by hyphens '-'.\n" +
    "  * Remove unnecessary stop words (a, the, of, in) UNLESS they are part of the Focus Keyword.\n" +
    "  * Example style: hurghada-luxor-day-tour or luxor-day-trip-hurghada.\n\n" +

    "4) AI_SEO_Meta_Description:\n" +
    "- Original Meta Description: '" + originalMetaDesc + "'\n" +
    "- CRITICAL: FIRST, evaluate if the original meta description is ALREADY RankMath-compliant:\n" +
    "  ✓ Is it 160 characters or less?\n" +
    "  ✓ Is it in ENGLISH and contains the Focus Keyword at least once?\n" +
    "  ✓ Is it clear, compelling, and informative?\n" +
    "  ✓ Does it include a soft call-to-action?\n" +
    "  ✓ Is it free from keyword stuffing and reads naturally?\n" +
    "- IF ALL 5 CHECKS PASS → YOU MUST KEEP the original meta description unchanged (return it exactly as-is in AI_SEO_Meta_Description).\n" +
    "  * This preserves proven CTR performance in search results.\n" +
    "- IF ANY CHECK FAILS → GENERATE a NEW optimized meta description following these rules:\n" +
    "  * Language: ENGLISH only.\n" +
    "  * STRICT RULE: The text MUST contain the Focus Keyword phrase EXACTLY as written (Verbatim). Do not change a single letter.\n" +
    "    - If the Focus Keyword is 'Cairo Day Tour', you MUST use 'Cairo Day Tour' inside the description. Do NOT use 'Cairo day tours' or 'tour in Cairo'.\n" +
    "  * PRIORITY: Including the Focus Keyword verbatim is MORE IMPORTANT than perfect grammar or extra adjectives.\n" +
    "  * WRONG: '...historical day tour in Cairo...'\n" +
    "  * RIGHT: '...Cairo Historical Day Tour...'\n" +
    "  * RULE #2: Try to include the Focus Keyword near the beginning (first sentence) if natural.\n" +
    "  * Length: ideally 130–150 characters, and it is a HARD RULE that you NEVER exceed 160 characters.\n" +
    "  * If your first version is longer than 160 characters, you MUST rewrite it shorter BEFORE returning the JSON.\n" +
    "    - When shortening, NEVER remove the Focus Keyword. Remove adjectives or the CTA instead.\n" +
    "  * Use one or two short sentences, clear, compelling, and informative with a soft call-to-action like 'Book now', 'Discover more', 'Enjoy this experience'.\n" +
    "  * Avoid keyword stuffing. Keep it human and smooth.\n" +
    "  * START with an Action Verb if possible (e.g. 'Explore', 'Book', 'Discover', 'Experience').\n\n" +

    "5) AI_Excerpt:\n" +
    "- Short, catchy summary suitable for the post excerpt.\n" +
    "- MUST start with the Focus Keyword or include it in the first sentence.\n" +
    "- Length: about 40–50 words (no hard character limit, but avoid very long text).\n\n" +

    "6) AI_Marketing_Tagline:\n" +
    "- Very short slogan, 6–12 words.\n" +
    "- Attractive and benefit-oriented.\n" +
    "- Can include the Focus Keyword but not required.\n\n" +

    "7) AI_Short_Summary:\n" +
    "- One compact paragraph (30–50 words).\n" +
    "- Quick overview of what the traveler will experience.\n" +
    "- Include the Focus Keyword once if possible.\n\n" +

    "8) AI_SEO_FocusKeywords_List:\n" +
    (seoKeywordsJoined && seoKeywordsJoined.trim().length > 0
      ? "- You MUST use the provided list: [" + seoKeywordsJoined + "]. Return it as a JSON array of strings. Do not add new ones unless the list is empty.\n" +
        "- IMPORTANT: Use ENGLISH ONLY.\n"
      : "- Provide 3–8 related keywords/phrases, in ENGLISH.\n" +
        "- They must all be semantically related to the Focus Keyword and to the trip content.\n") + "\n" +

    "CONSISTENCY CHECK (CRITICAL):\n" +
    "- The 'AI_SEO_FocusKeywords' you decide on MUST be the EXACT SAME one you use in the Title, Slug, Description, and Excerpt.\n" +
    "- Do not use one keyword for the Focus Keyword field and a different synonym for the Title/Slug.\n" +
    "- Consistency is key for RankMath scoring.\n\n" +

    "STRICT OUTPUT FORMAT:\n" +
    "- Return ONLY a valid JSON object.\n" +
    "- NO markdown, NO explanations, NO extra text before or after the JSON.\n" +
    "- Respect ALL length limits BEFORE returning the JSON.\n\n" +

    "JSON OUTPUT SHAPE:\n" +
    "{\n" +
    '  "AI_SEO_Title": "...",\n' +
    '  "AI_SEO_Meta_Description": "...",\n' +
    '  "AI_Marketing_Tagline": "...",\n' +
    '  "AI_Short_Summary": "...",\n' +
    '  "AI_Excerpt": "...",\n' +
    '  "AI_SEO_Permalink": "...",\n' +
    '  "AI_SEO_FocusKeywords": "...",\n' +
    '  "AI_SEO_FocusKeywords_List": ["...","...", "..."]\n' +
    "}\n";

  return prompt;
}

/************************************************************
 * TRIGGER CREATOR (تشغيل مرة واحدة فقط)
 ************************************************************/

/**
 * createAiSeoEnhancerTrigger
 * شغّل هذه الدالة مرة واحدة لإنشاء Trigger كل 15 دقيقة.
 */
function createAiSeoEnhancerTrigger() {
  ScriptApp.newTrigger('runAiSeoEnhancementBatch')
    .timeBased()
    .everyMinutes(15) // عدّلها لو حابب
    .create();
}

/************************************************************
 * FETCH LINKED CONTEXT TEXT FOR Trip
 ************************************************************/

/**
 * fetchLinkedContextTextForTrip_
 * 
 * - تعتمد على CONFIG.LINK_FIELDS و CONFIG.DEFAULT_TRIP_LINK_FIELD
 * - تمر على الجداول المرتبطة بالرحلة وتجمع نصوص مفيدة لتغذية الـ SEO Prompt
 * - ترجع Array من النصوص القصيرة (max ~300 char لكل بلوك)
 */
function fetchLinkedContextTextForTrip_(tripId) {
  if (!tripId) return [];

  var out = [];

  function pushVal(v) {
    if (!v) return;
    var t = String(v).trim();
    if (!t) return;
    // نتجنب التكرار
    if (out.indexOf(t) !== -1) return;
    // نحد طول كل بلوك
    if (t.length > 300) {
      t = t.slice(0, 300);
    }
    out.push(t);
  }

  var linkField = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_TRIP_LINK_FIELD)
    ? CONFIG.DEFAULT_TRIP_LINK_FIELD
    : 'Trip';

  var tables = [];
  if (typeof CONFIG !== 'undefined' && CONFIG.LINK_FIELDS) {
    for (var k in CONFIG.LINK_FIELDS) {
      if (CONFIG.LINK_FIELDS.hasOwnProperty(k)) {
        tables.push(k);
      }
    }
  }

  // لو مفيش CONFIG.LINK_FIELDS هنرجع فاضي
  if (!tables.length) {
    return out;
  }

  for (var i = 0; i < tables.length; i++) {
    var tname = tables[i];
    var lf    = CONFIG.LINK_FIELDS[tname] || linkField;

    var res1 = airtableGet_(tname, {
      filterByFormula: "ARRAYJOIN({" + lf + "}) = '" + tripId + "'",
      pageSize: 100
    });

    var recs = res1 && res1.records ? res1.records : [];
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
            if (typeof v === 'string') {
              joined.push(v);
            } else if (v && typeof v === 'object') {
              // نحاول نستخدم بعض الحقول الشائعة في Records المرتبطة
              if (v.name)            joined.push(String(v.name));
              if (v.title)           joined.push(String(v.title));
              if (v.description)     joined.push(String(v.description));
              if (v.Highlight)       joined.push(String(v.Highlight));
              if (v.StepTitle)       joined.push(String(v.StepTitle));
              if (v.StepDescription) joined.push(String(v.StepDescription));
            }
          }
          if (joined.length) {
            pushVal(joined.join(' '));
          }
        }
      }
    }
  }

  return out;
}

/**
 * Ensures the Focus Keyword is unique across Trips and Improvement tables.
 * If duplicate, attempts to resolve it and updates related SEO fields.
 */
function ensureUniqueKeyword_(aiResult, tripId, improvementId) {
  var originalKeyword = aiResult.AI_SEO_FocusKeywords;
  if (!originalKeyword) return; // Nothing to check

  originalKeyword = String(originalKeyword).trim();
  
  // If unique, we are good
  if (!checkKeywordExists_(originalKeyword, tripId, improvementId)) {
    return;
  }

  Logger.log('AI SEO Enhancer: Keyword "' + originalKeyword + '" is duplicate. Resolving...');

  var newKeyword = null;

  // 1. Try Related Keywords
  var relatedKeywords = [];
  if (Array.isArray(aiResult.AI_SEO_FocusKeywords_List)) {
    relatedKeywords = aiResult.AI_SEO_FocusKeywords_List;
  } else if (typeof aiResult.AI_SEO_FocusKeywords_List === 'string') {
    relatedKeywords = aiResult.AI_SEO_FocusKeywords_List.split(',').map(function(s){ return s.trim(); });
  }

  for (var i = 0; i < relatedKeywords.length; i++) {
    var candidate = String(relatedKeywords[i]).trim();
    if (candidate && candidate.toLowerCase() !== originalKeyword.toLowerCase()) {
       if (!checkKeywordExists_(candidate, tripId, improvementId)) {
         newKeyword = candidate;
         Logger.log('AI SEO Enhancer: Resolved with related keyword: ' + newKeyword);
         break;
       }
    }
  }

  // 2. Add Year
  if (!newKeyword) {
    var year = new Date().getFullYear();
    var candidateYear = originalKeyword + " " + year;
    if (!checkKeywordExists_(candidateYear, tripId, improvementId)) {
      newKeyword = candidateYear;
      Logger.log('AI SEO Enhancer: Resolved with year: ' + newKeyword);
    }
  }
  
  // 3. Add "Trip" or "Tour"
  if (!newKeyword) {
    var suffixes = ["Trip", "Tour", "Day Tour", "Excursion"];
    for (var j = 0; j < suffixes.length; j++) {
      var suffix = suffixes[j];
      // Avoid "Tour Tour"
      if (originalKeyword.toLowerCase().endsWith(suffix.toLowerCase())) continue;
      
      var candidateSuffix = originalKeyword + " " + suffix;
      if (!checkKeywordExists_(candidateSuffix, tripId, improvementId)) {
        newKeyword = candidateSuffix;
        Logger.log('AI SEO Enhancer: Resolved with suffix: ' + newKeyword);
        break;
      }
    }
  }

  // 4. Last Resort: Add Year to one of the suffixes or just random ID? 
  if (!newKeyword) {
     var year = new Date().getFullYear();
     // Fallback to year even if it seemed taken (unlikely to be taken if we just tried it? Wait, I tried it in step 2).
     // Try appending "Trip " + year
     newKeyword = originalKeyword + " Trip " + year;
     Logger.log('AI SEO Enhancer: Resolved with fallback: ' + newKeyword);
  }

  // Apply the new keyword
  if (newKeyword) {
    aiResult.AI_SEO_FocusKeywords = newKeyword;
    
    // Update other fields
    // Simple string replacement of the *phrase*.
    // We need to be careful about case-insensitive replacement but preserving case of the text.
    
    var escapedOld = originalKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var reg = new RegExp(escapedOld, 'gi');
    
    if (aiResult.AI_SEO_Title) {
      aiResult.AI_SEO_Title = aiResult.AI_SEO_Title.replace(reg, newKeyword);
    }
    if (aiResult.AI_SEO_Meta_Description) {
      aiResult.AI_SEO_Meta_Description = aiResult.AI_SEO_Meta_Description.replace(reg, newKeyword);
    }
    // For Permalink, we need to slugify the new keyword
    if (aiResult.AI_SEO_Permalink) {
      // Generate new slug from the new keyword
      var newSlug = newKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      
      // Enforce 45 char limit here as well
      if (newSlug.length > 45) {
         newSlug = newSlug.substring(0, 45).replace(/-$/, '');
      }
      
      aiResult.AI_SEO_Permalink = newSlug;
    }
  }
}

/**
 * Checks if a keyword exists in Trips or Improvement With AI tables.
 * Returns true if duplicate found.
 */
function checkKeywordExists_(keyword, currentTripId, currentImprovementId) {
  if (!keyword) return false;
  
  // Normalize keyword to lower case for comparison to ensure case-insensitivity
  var lowerKeyword = String(keyword).toLowerCase().trim();
  var escaped = lowerKeyword.replace(/'/g, "\\'");
  
  // 1. Check Trips
  // We want to find any Trip that has this keyword, EXCLUDING the current trip.
  // Formula: AND(LOWER({SEO_FocusKeywords}) = 'keyword', RECORD_ID() != 'currentTripId')
  var formula1 = "AND(LOWER({SEO_FocusKeywords}) = '" + escaped + "', RECORD_ID() != '" + currentTripId + "')";
  
  var res1 = airtableGet_('Trips', {
    filterByFormula: formula1,
    maxRecords: 1
  });
  
  if (res1 && res1.records && res1.records.length > 0) {
    return true; // Found duplicate in another trip
  }

  // 2. Check Improvement With AI
  // We want to find any Improvement record that has this keyword, EXCLUDING the current improvement record.
  // Formula: AND(LOWER({AI_SEO_FocusKeywords}) = 'keyword', RECORD_ID() != 'currentImprovementId')
  if (currentImprovementId) {
    var formula2 = "AND(LOWER({AI_SEO_FocusKeywords}) = '" + escaped + "', RECORD_ID() != '" + currentImprovementId + "')";
    var res2 = airtableGet_(AI_IMPROVEMENT_TABLE, {
      filterByFormula: formula2,
      maxRecords: 1
    });
    
    if (res2 && res2.records && res2.records.length > 0) {
      return true; // Found duplicate in another improvement record
    }
  }
  
  return false;
}
