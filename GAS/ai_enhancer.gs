/************************************************************
 * AI ENHANCER — Improve trip content using DeepSeek (or OpenAI)
 * 
 * - يقرأ رحلات من جدول Trips حيث AI_Status = "Pending"
 * - يبني Prompt من محتوى الرحلة
 * - يستدعي API (DeepSeek كـ default)
 * - يحذف كل سجلات التحسين السابقة لنفس الرحلة من جدول "Improvement With AI"
 * - يحفظ نتيجة جديدة واحدة في جدول "Improvement With AI"
 * - يحدّث Trips.AI_Status
 ************************************************************/

/*********************** CONFIG ******************************/

// اسم جدول الرحلات و جدول التحسين:
var AI_TRIPS_TABLE       = 'Trips';
var AI_IMPROVEMENT_TABLE = 'Improvement With AI';

// حجم الباتش في كل تشغيل
var AI_BATCH_SIZE = 1;  // Process one trip at a time

// إعدادات DeepSeek (يمكنك تغييرها لاحقاً لـ OpenAI)
var AI_PROVIDER = 'deepseek'; // 'deepseek' أو 'openai'

// DeepSeek config
var DEEPSEEK_API_KEY  = ''; // Script Properties: DEEPSEEK_API_KEY
var DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
var DEEPSEEK_MODEL    = 'deepseek-chat';  // عدّل حسب الموديل المتاح لديك

function getDeepseekApiKey_() {
  var v = DEEPSEEK_API_KEY;
  if (v) return v;
  try {
    v = PropertiesService.getScriptProperties().getProperty('DEEPSEEK_API_KEY') || '';
  } catch (e) {
    v = '';
  }
  DEEPSEEK_API_KEY = v;
  return v;
}

/************************************************************
 * ENTRY POINT — لتشغيله بالـ Trigger
 ************************************************************/

/**
 * الدالة الرئيسية: تشغّل باتش تحسين AI
 * اربط هذه الدالة بـ time-driven trigger (كل 10-15 دقيقة)
 */
function runAiEnhancementBatch() {
  loadConfigSecrets_();
  Logger.log('AI Enhancer: starting batch...');

  try {
    var trips = fetchTripsNeedingAi_(AI_BATCH_SIZE);

    if (!trips || !trips.length) {
      Logger.log('AI Enhancer: no trips with AI_Status = "Pending"');
      return;
    }

    trips.forEach(function (tripRecord) {
      var tripRecordId = tripRecord.id;
      var fields       = tripRecord.fields || {};

      try {
        Logger.log('AI Enhancer: processing trip record ' + tripRecordId);

        if (!claimStage_(tripRecordId, 'Content', 25 * 60)) {
          Logger.log('AI Enhancer: stage already claimed; skipping Trip ' + tripRecordId);
          return;
        }

        // 1) علّم الرحلة إنها "Processing"
        updateTripContentAiStatus_(tripRecordId, 'Processing');

        var improvementId = ensureImprovementRecordIdForTrip_(tripRecordId, fields);

        // 2) Fetch SEO Keywords from Improvement Record (Stage 1)
        // Use direct linked record ID if available (Best practice)
        var improvementRec = ImprovementRepository.fetchImprovementRecordForTrip({
          tripRecordId: tripRecordId,
          tripPublicId: fields.TripID,
          directRecordId: improvementId,
          tripName: fields.Title,
          tableName: AI_IMPROVEMENT_TABLE,
          tripLinkField: 'Trip'
        });
        var seoKeywords = '';
        var seoKeywordsList = [];
        
        if (improvementRec) {
          seoKeywords = improvementRec.fields.AI_SEO_FocusKeywords || '';
          seoKeywordsList = improvementRec.fields.AI_SEO_FocusKeywords_List || [];
          Logger.log('AI Enhancer: Found SEO Focus Keyword: "' + seoKeywords + '"');
        } else {
          Logger.log('AI Enhancer: ❌ WARNING: Could not fetch Improvement Record. SEO Focus Keyword will be missing.');
        }

        // 3) Calculate Duration from ItinerarySteps (New)
        // DISABLED Fallback: User requested strictly AI-based calculation based on content, not step count.
        var durationInfo = { hours: 0, minutes: 0, unit: '' }; 
        // var durationInfo = calculateDurationFromItinerary_(tripRecordId, fields.TripID);
        // Logger.log('AI Enhancer: Calculated Duration: ' + JSON.stringify(durationInfo));

        // 3) بناء الـ Prompt اعتماداً على حقول الرحلة + SEO Keywords
        var U = buildUnifiedTripContext_(tripRecordId, fields);
        
        if (isDebugEnabled_()) {
          Logger.log('AI Enhancer DEBUG: Itinerary Context Size = ' + (U.itineraryText ? U.itineraryText.length : 0));
          if (U.itineraryText) {
            Logger.log('AI Enhancer DEBUG: Sample Itinerary Text:\n' + U.itineraryText.substring(0, 500) + '...');
          } else {
            Logger.log('AI Enhancer DEBUG: ❌ No Itinerary Text found!');
          }
        }
        
        var prompt = buildTripPrompt_(fields, tripRecordId, seoKeywords, seoKeywordsList, U);

        // 4) استدعاء الـ AI
        var aiResult = callAi_(prompt);  // يرجع Object

        if (!aiResult || typeof aiResult !== 'object') {
          throw new Error('Invalid AI result (not an object)');
        }
        
        // Merge duration info into aiResult ONLY if AI didn't return valid duration
        // This prioritizes AI calculation (as requested) but keeps a fallback based on step count
        // FALLBACK DISABLED: trusting AI Task 7 results strictly.
        Logger.log('AI Enhancer: Using AI-determined duration: ' + aiResult.Duration_Hours + ' ' + aiResult.Duration_Unit);

        // 4) حذف كل سجلات التحسين القديمة + إنشاء سجل جديد واحد
        var saved = upsertImprovementRecordForTrip_(tripRecordId, aiResult, fields.TripID, improvementId);
        if (!saved) {
          throw new Error('Missing Improvement record id; cannot save AI content');
        }

        // 5) تحديث حالة الرحلة في Trips
        updateTripContentAiStatus_(tripRecordId, 'Done');

        Logger.log('AI Enhancer: successfully processed trip ' + tripRecordId);

      } catch (e) {
        Logger.log('AI Enhancer: error for trip ' + tripRecordId + ' — ' + e.message);
        // لو حصل خطأ → نحدّث حالة الرحلة
        updateTripContentAiStatus_(tripRecordId, 'Error');

        // نحاول نضيف سجل Error في جدول التحسين
        try {
          upsertImprovementErrorRecordForTrip_(tripRecordId, e);
        } catch (inner) {
          Logger.log('AI Enhancer: failed to log error record for trip ' + tripRecordId + ' — ' + inner.message);
        }
      }
    });

  } catch (e) {
    Logger.log('AI Enhancer: fatal error — ' + e.message);
  }

  Logger.log('AI Enhancer: batch finished.');
}

/************************************************************
 * FETCH TRIPS WITH AI_Status = Pending
 ************************************************************/

/**
 * fetchTripsNeedingAi_
 * يستخدم airtableGet_ لجلب رحلات تحتاج تحسين.
 */
function fetchTripsNeedingAi_(limit) {
  var tripRes = airtableGet_(AI_TRIPS_TABLE, {
    filterByFormula: "{AI_Status} = 'Pending'",
    maxRecords:      limit || AI_BATCH_SIZE
  });

  if (!tripRes || !tripRes.records || !tripRes.records.length) {
    Logger.log('AI Enhancer: no trips with AI_Status = "Pending"');
    return [];
  }

  return tripRes.records;
}

/************************************************************
 * DELETE OLD IMPROVEMENT RECORDS FOR TRIP
 ************************************************************/

/**
 * deleteImprovementsForTrip_
 * تمسح كل السجلات في جدول "Improvement With AI" المرتبطة بنفس Trip
 * نعتمد على recordId بتاع الرحلة (tripId) زي ما عاملين في سكربت الهايلايتس
 */
function deleteImprovementsForTrip_(tripId) {
  if (!tripId) return;

  var toDelete = [];
  var offset = null;
  do {
    var params = { pageSize: 100 };
    if (offset) params.offset = offset;
    var res  = airtableGet_(AI_IMPROVEMENT_TABLE, params);
    var recs = res && res.records ? res.records : [];
    for (var i = 0; i < recs.length; i++) {
      var r     = recs[i];
      var f     = r.fields || {};
      var links = f.Trip; // حقل الـ Link إلى Trips (array of recordIds)
      if (Array.isArray(links) && links.indexOf(tripId) !== -1) {
        toDelete.push(r.id);
      }
    }
    offset = res && res.offset ? res.offset : null;
  } while (offset);

  if (!toDelete.length) {
    Logger.log('AI Enhancer: no old improvement records to delete for Trip ' + tripId);
    return;
  }

  Logger.log('AI Enhancer: deleting ' + toDelete.length +
             ' old improvement records for Trip ' + tripId);

  // لو عندك batch delete استخدمه، لو مش موجود استخدم delete عادي
  if (typeof airtableBatchDelete_ === 'function') {
    airtableBatchDelete_(AI_IMPROVEMENT_TABLE, toDelete);
  } else {
    for (var j = 0; j < toDelete.length; j++) {
      var recId = toDelete[j];
      try {
        airtableDelete_(AI_IMPROVEMENT_TABLE, recId);
      } catch (e) {
        Logger.log('AI Enhancer: failed to delete improvement record ' +
                   recId + ' — ' + e.message);
      }
    }
  }
}

/************************************************************
 * BUILD PROMPT FROM TRIP FIELDS
 ************************************************************/

/**
 * buildTripPrompt_
 * يبني Prompt غني من حقول الرحلة + أمثلة من رحلات أخرى
 * - دائماً يطلب الكتابة بالإنجليزية
 * - يولّد نص جديد للحقل الفاضي
 * - يحدد أسلوب وطول كل حقل محسن
 */
function buildTripPrompt_(fields, tripId, preGeneratedFocusKeyword, preGeneratedKeywordsList, U) {
  var title                = fields.Title || '';
  var overviewTitle        = fields.Overview_Section_Title || '';
  var tripDescription      = fields.Trip_Description || '';
  var itineraryTitle       = fields.Itinerary_Section_Title || '';
  var itineraryDescription = fields.Itinerary_Description || '';
  var whyLoveTitle         = fields.Why_People_Love_This_Trip_Section_Title || '';
  var tabContent           = fields.Tab_Content || '';

  // 🆕 عناوين الأقسام الإضافية من جدول Trips:
  var tripHighlightsTitle  = fields.Trip_Highlights_Section_Title || '';
  var costSectionTitle     = fields.Cost_Section_Title || '';
  var costIncludesTitle    = fields.Cost_Includes_Title || '';
  var costExcludesTitle    = fields.Cost_Excludes_Title || '';
  var tripFactsTitle       = fields.Trip_Facts_Section_Title || '';
  var faqSectionTitle      = fields.FAQ_Section_Title || '';

  // سياق إضافي (اختياري)
  var durationHours = fields.Duration_Hours || '';
  var durationUnit  = fields.Duration_Unit || '';
  var seoKeywords   = fields.SEO_FocusKeywords_List || '';
  var languages     = fields.Languages || '';
  var slug          = fields.Slug || '';

  if (Array.isArray(seoKeywords)) {
    seoKeywords = seoKeywords.join(', ');
  }
  if (Array.isArray(languages)) {
    languages = languages.join(', ');
  }

  // نبني بلوك الأمثلة من رحلات أخرى
  var examplesBlock = buildExamplesFromExistingTrips_(fields);

  // 🆕 جلب الهايلايتس المرتبطة بالرحلة (إن وجدت) لتقليل الهلوسة
  var linkedHighlights = U && U.highlightsText ? U.highlightsText : "";

  function normPrompt_(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function isBannedPromptToken_(s) {
    var t = normPrompt_(s).toLowerCase();
    if (!t) return true;
    if (t.indexOf('generate one if missing') !== -1) return true;
    if (t === 'n/a') return true;
    if (t === 'undefined' || t === 'null') return true;
    return false;
  }
  function sanitizePromptList_(list) {
    var arr = [];
    if (Array.isArray(list)) arr = list.slice(0);
    else if (list != null) arr = normPrompt_(list).split(/[,;\n]+/);
    arr = arr.map(function(x) { return normPrompt_(x); }).filter(function(x) { return !!x && !isBannedPromptToken_(x); });
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = arr[i].toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      out.push(arr[i]);
    }
    return out;
  }

  var focusKw = normPrompt_(preGeneratedFocusKeyword);
  if (isBannedPromptToken_(focusKw)) focusKw = '';
  var relatedList = sanitizePromptList_(preGeneratedKeywordsList);
  var focusBlock =
    "TASK 1: FOCUS KEYWORD (CRITICAL)\n" +
    (focusKw
      ? ("- Focus Keyword (use verbatim as the primary phrase): '" + focusKw + "'\n")
      : ("- Focus Keyword: (not provided)\n" +
         "- Choose ONE focus keyword phrase based on the Trip Title/Slug/SEO keywords.\n" +
         "- Use the chosen focus keyword consistently and naturally throughout the output.\n")) +
    (relatedList.length ? ("- Related Keywords (optional, use naturally): " + relatedList.join(', ') + "\n") : "") +
    "- Do NOT output any placeholder or instruction text as if it were a keyword.\n\n";

  var prompt =
    "You are an expert travel copywriter and SEO specialist.\n\n" +
    focusBlock +
    
    "TASK 2: GENERATE OPTIMIZED WHY PEOPLE LOVE THIS TRIP (AI_Tab_Content)\n" +
    "You are an SEO expert and persuasive copywriter. Create a compelling 'Why People Love This Trip' section that converts hesitant browsers into confident bookers.\n" +
    "=== TOUR DETAILS (Infer these from the Trip Info below) ===\n" +
     "- Tour title (infer from Trip Title)\n" +
     "- Destination/location (infer from Trip Title/Description)\n" +
     "- Main attractions (infer from context)\n" +
     "- Duration (infer from itinerary)\n" +
     "- Unique selling points (infer from context)\n" +
     "- Target audience (infer from trip style)\n" +
     "- Common pain points solved (infer from context)\n\n" +
     
     "=== USER PSYCHOLOGY ===\n" +
     "When users read 'Why People Love This Trip', they're asking:\n" +
     "1. 'Will I love it too?' (Social Proof)\n" +
     "2. 'Is this the right tour for me?' (Self-identification)\n" +
     "3. 'What makes this special?' (Differentiation)\n" +
     "4. 'Am I making a good decision?' (Reassurance)\n" +
     "5. 'What will I remember?' (Emotional Outcome)\n\n" +
     
     "=== SECTION STRUCTURE ===\n" +
     "This section should have 5-7 'reasons' or 'points' that answer:\n" +
     "- What makes the EXPERIENCE special?\n" +
     "- What makes the SERVICE special?\n" +
     "- What makes the VALUE special?\n" +
     "- Who is this PERFECT for?\n\n" +
     
     "=== THE 7 LOVE POINTS FRAMEWORK ===\n" +
     "*POINT 1: THE HERO EXPERIENCE* ⭐ (What's the ONE thing everyone raves about?)\n" +
     "*POINT 2: THE CONVENIENCE FACTOR* 🚐 (How do you make their life easier?)\n" +
     "*POINT 3: THE EXPERT TOUCH* 👨‍🏫 (Why your guides/service is exceptional?)\n" +
     "*POINT 4: THE VALUE PROPOSITION* 💰 (Why it's worth every penny?)\n" +
     "*POINT 5: THE UNIQUE DIFFERENTIATOR* 🎯 (What do YOU offer that others don't?)\n" +
     "*POINT 6: THE EMOTIONAL PAYOFF* ❤️ (How will they FEEL during/after?)\n" +
     "*POINT 7: THE PERFECT FIT* 👨‍👩‍👧‍👦 (Who specifically loves this tour?)\n\n" +
     
     "=== WRITING RULES ===\n" +
     "1. USE POINT TITLES (NO HEADINGS): Each point needs a catchy title, but do NOT use any HTML headings (<h2>/<h3>/<h4>).\n" +
     "2. BENEFIT-FOCUSED: Not features, but what they GET\n" +
     "3. EMOTIONAL LANGUAGE: Make them FEEL something\n" +
     "4. SPECIFIC DETAILS: Concrete examples, not vague claims\n" +
     "5. SOCIAL PROOF HINTS: 'Travelers love...', 'Guests rave about...'\n" +
     "6. SHORT PARAGRAPHS: 2-3 sentences max per point\n" +
     "7. VARIED STRUCTURE: Mix short punchy points with slightly longer ones\n\n" +
     
     "=== OUTPUT FORMAT ===\n" +
     "IMPORTANT: Do NOT repeat any section title inside body fields that already have a dedicated title field.\n" +
     "Do NOT include headings or title lines like 'Why People Love This Trip ❤️'. Start directly with the content.\n\n" +
     "<p><strong>Expertly Guided Highlights</strong> ⭐ — Enjoy a well-paced experience with the key sights covered in a way that feels effortless and memorable.</p>\n" +
     "<p><strong>Comfortable, Seamless Logistics</strong> 🚐 — Clear timing, easy transfers, and thoughtful pacing help you focus on the experience instead of the details.</p>\n\n" +

     "TASK 7: CALCULATE DURATION FROM ITINERARY (STRICT MATH REQUIRED)\n" +
     "- Analyze the '=== RAW ITINERARY STEPS ===' section in the context.\n" +
     "- IGNORE the 'Recorded Duration' if it contradicts the sum of steps.\n" +
     "- IDENTIFY every time duration mentioned in the step titles or descriptions (e.g., '(25 minutes)', '2.5 hours', '45 mins').\n" +
     "- SUM them up mathematically.\n" +
     "- Example: 25 mins + 25 mins + 25 mins + 45 mins + 2.5 hours (150 mins) = 270 minutes = 4.5 hours.\n" +
     "- Output the result in 'Duration_Hours', 'Duration_Minutes', and 'Duration_Unit'.\n" +
     "  * Duration_Unit must be 'hours' or 'days'.\n" +
     "- In 'Duration_Calculation_Reasoning', explain your math: list the steps you found and their durations, then the total sum.\n" +
     "- Analyze the content of each itinerary step in 'Itinerary Context' carefully.\n" +
     "- Estimate the time required for each activity described in the steps (e.g., 'Visit Pyramids' ≈ 2-3 hours, 'Lunch' ≈ 1 hour).\n" +
     "- SUM these estimated durations to determine the total trip duration.\n" +
     "- Pay close attention to step titles that contain time info, e.g. '(25 minutes)', '(2.5 hours)', or '45 mins'.\n" +
     "- Parse '25 minutes' as 25 min, '2.5 hours' as 150 min. Sum them all up carefully.\n" +
     "- IMPORTANT: The 'Recorded Duration' above is likely WRONG. Ignore it. Trust YOUR calculated sum of the steps.\n" +
     "- If the itinerary explicitly mentions start/end times (e.g., '8 AM to 4 PM'), use that difference.\n" +
     "- If the itinerary lists multiple days (Day 1, Day 2...), count the days.\n" +
     "- Output the result in 'Duration_Hours', 'Duration_Minutes', and 'Duration_Unit'.\n" +
     "  * Duration_Unit must be 'hours' or 'days'.\n" +
     "  * If Unit is 'days', put the number of days in Duration_Hours (e.g. 5 days -> Hours=5, Minutes=0, Unit='days').\n\n" +
     
     "TASK 6: IMPROVE REMAINING CONTENT USING THE FOCUS KEYWORD\n" +
     "- Rewrite all trip content in ENGLISH only, even if original is in another language.\n" +
     "- You MUST use the Focus Keyword naturally at least 15 times throughout the content (High Density for SEO):\n" +
     "  * MUST appear in the first paragraph (first 10% of content)\n" +
     "  * MUST appear in at least TWO section titles (e.g., AI_Overview_Section_Title AND AI_Itinerary_Section_Title)\n" +
     "  * Use 5-6 times in AI_Trip_Description\n" +
     "  * Use 5-6 times in AI_Tab_Content\n" +
     "  * Use 3-4 times in AI_Itinerary_Description\n" +
     "  * Include in the last paragraph if possible\n" +
     "- Make content clear, persuasive, engaging, and informative.\n" +
     "- Structure content for SEO and readability.\n" +
     "- If any field is empty, generate new high-quality English content.\n" +
     "- DO NOT leave any improved field empty.\n" +
     "- DO NOT invent unrealistic details.\n\n" +
     "PARAGRAPH RULES (CRITICAL FOR RANKMATH):\n" +
    "- Keep ALL paragraphs VERY SHORT (MAX 3 sentences, 40-50 words).\n" +
    "- Break long explanations into multiple short paragraphs.\n" +
    "- Use bullet points for lists.\n" +
    "- Create scannable, easy-to-read sections.\n\n" +

    "=== ITINERARY FORMATTING RULES (HTML REQUIRED) ===\n" +
    "- DO NOT return the itinerary as a single solid block of text.\n" +
    "- YOU MUST FORMAT THE ITINERARY USING HTML TAGS for clarity.\n" +
    "- For each Day, use this EXACT structure (NO HEADINGS):\n" +
    "  <p><strong>Day X: Day Title</strong> — Day Description</p>\n" +
    "- Ensure there is a <br> or <p> break between days.\n" +
    "- Use <strong> for key highlights within the description.\n" +
    "- Example Output:\n" +
    "  <p><strong>Day 1: Arrival in Cairo</strong> — Meet and greet at Cairo International Airport. Transfer to your hotel.</p>\n" +
    "  <p><strong>Day 2: Pyramids Tour</strong> — Visit the <strong>Great Pyramids</strong> and Sphinx. Enjoy lunch at a local restaurant.</p>\n" +
    "- This formatting is CRITICAL for the website display.\n\n" +

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

    "REALISM & SAFETY RULES:\n" +
     "- You MUST NOT invent transportation types that are not clearly stated in the context.\n" +
     "- Do NOT mention flights, airplanes, domestic flights, trains, sleeper trains, cruises, ferries, private cars, buses, small boats, or ships\n" +
     "  unless words like 'flight', 'fly', 'plane', 'train', 'cruise', 'boat', 'ship', 'car', 'bus' or similar explicitly appear\n" +
     "  in the trip title, slug, or provided descriptions OR in the provided 'Linked Highlights'.\n" +
     "- If you are not sure about the transport, use neutral verbs like:\n" +
     "  'Travel to', 'Head to', 'Go to', or 'Continue to the next destination'.\n" +
     "- Do NOT invent specific times (e.g., 'at 8:00 AM') or specific days for transfers unless explicitly stated in the source.\n" +
     "  * Use general timing terms like 'Morning', 'Afternoon', 'Evening' or 'Later'.\n" +
     "- Do NOT invent new cities, regions or destinations that are not clearly mentioned in the trip context.\n" +
     "- Do NOT invent highly specific or risky activities.\n\n" +
     "Style and length guidelines for each output field:\n" +
     "GLOBAL RULE FOR BODY FIELDS (CRITICAL):\n" +
     "- Do not include headings (<h2>/<h3>/<h4>) or repeated section titles in body fields that already have a dedicated title field.\n" +
     "- Do not start the body with the section title, even with emojis.\n\n" +
     "- AI_Overview_Section_Title:\n" +
     "  * You MUST use exactly: 'Overview'.\n" +
     "- AI_Trip_Description:\n" +
    "  * CRITICAL: Must NOT include any headings. Must NOT repeat 'Overview'. Start directly with useful content.\n" +
    "  * Write with strong PURCHASE INTENT to encourage booking immediately.\n" +
    "  * Use persuasive language that drives conversion.\n" +
    "  * Focus on the most compelling aspects of the trip.\n" +
    "  * Focus on the experience, mood, and what the traveler will enjoy.\n" +
    "- AI_Itinerary_Section_Title:\n" +
    "  * You MUST use exactly: 'Itinerary'.\n" +
    "- AI_Itinerary_Description:\n" +
    "  * CRITICAL: Must NOT include any headings. Must NOT repeat 'Itinerary'. Start directly with the itinerary content.\n" +
    "  * Structured, detailed explanation of the day's flow.\n" +
    "  * Prefer bullet points or clearly separated short paragraphs for each step (pickup, main sites, lunch, free time, return, etc.).\n" +
    "  * Typically 4–10 steps, depending on the trip.\n" +
    "- AI_Why_People_Love_This_Trip_Section_Title:\n" +
    "  * You MUST use exactly: 'Why People Love This Trip'.\n" +
    "- AI_Tab_Content:\n" +
    "  * CRITICAL: Must NOT include any headings. Must NOT repeat 'Why People Love This Trip'. Start directly with the first point.\n" +
    "  * Do NOT use markdown headers (like ## or ###) anywhere in this section.\n" +
    "  * THIS IS THE 'Why People Love This Trip' SECTION GENERATED IN TASK 5.\n" +
    "  * Use the content generated in TASK 5 here.\n" +
    "  * Ensure it has 5-7 points with bolded point titles.\n" +
    "  * Medium-to-long explanatory text (150-300 words).\n\n" +
     "- AI_Trip_Highlights_Section_Title:\n" +
     "  * You MUST use exactly: 'Highlights'.\n" +
     "- AI_Cost_Section_Title:\n" +
     "  * Short section title for pricing, e.g. 'Prices & Details' or 'Tour Pricing'.\n" +
     "- AI_Cost_Includes_Title:\n" +
     "  * You MUST use exactly: 'What's Included'.\n" +
     "- AI_Cost_Excludes_Title:\n" +
     "  * Short section title, e.g. 'What's Not Included'.\n" +
     "- AI_Trip_Facts_Section_Title:\n" +
     "  * Short section title, e.g. 'Good to Know' or 'Trip Facts'.\n" +
     "- AI_FAQ_Section_Title:\n" +
     "  * You MUST use exactly: 'FAQ'.\n\n" +
     "When generating new text for empty fields, base your writing on:\n" +
     "- The trip title\n" +
     "- The destination or context implied by the title and other fields\n" +
     "- The duration\n" +
     "- Any available non-empty fields\n" +
     "- Standard travel copywriting best practices\n\n" +
     "Trip basic info:\n" +
    "Title: " + title + "\n" +
    "Slug: " + slug + "\n" +
    "Duration: " + durationHours + " " + durationUnit + "\n" +
    "Languages (original content): " + languages + "\n" +
    "SEO focus keywords (original): " + seoKeywords + "\n\n" +
    "Linked Highlights (raw + improved):\n" + linkedHighlights + "\n\n" +
    (U && U.itineraryText ? ("Itinerary Context (RAW Steps):\n" + U.itineraryText + "\n\n") : "") +
    (U && U.includesText ? ("Includes Context (raw + improved):\n" + U.includesText + "\n\n") : "") +
    (U && U.excludesText ? ("Excludes Context (raw + improved):\n" + U.excludesText + "\n\n") : "") +
    (U && U.addonsText ? ("AddOns Context (raw + improved):\n" + U.addonsText + "\n\n") : "") +
    "Original fields (some may be empty):\n\n" +
    "Overview_Section_Title:\n<<<OVERVIEW_TITLE>>>\n\n" +
    "Trip_Description:\n<<<TRIP_DESCRIPTION>>>\n\n" +
    "Itinerary_Section_Title:\n<<<ITINERARY_TITLE>>>\n\n" +
    "Itinerary_Description:\n<<<ITINERARY_DESCRIPTION>>>\n\n" +
    "Why_People_Love_This_Trip_Section_Title:\n<<<WHY_LOVE_TITLE>>>\n\n" +
    "Tab_Content:\n<<<TAB_CONTENT>>>\n\n" +
    "Trip_Highlights_Section_Title:\n<<<HIGHLIGHTS_SECTION_TITLE>>>\n\n" +
    "Cost_Section_Title:\n<<<COST_SECTION_TITLE>>>\n\n" +
    "Cost_Includes_Title:\n<<<COST_INCLUDES_TITLE>>>\n\n" +
    "Cost_Excludes_Title:\n<<<COST_EXCLUDES_TITLE>>>\n\n" +
    "Trip_Facts_Section_Title:\n<<<TRIP_FACTS_SECTION_TITLE>>>\n\n" +
    "FAQ_Section_Title:\n<<<FAQ_SECTION_TITLE>>>\n\n";

  if (examplesBlock && examplesBlock.trim()) {
    prompt +=
      "Below are some EXAMPLES of good trip content from our existing database.\n" +
      "IMPORTANT: Do NOT copy these texts word-for-word. Use them ONLY as inspiration for the style, tone, and structure of your English output.\n\n" +
      examplesBlock + "\n";
  }

  prompt +=
    "Output:\n" +
    "Return ONLY a valid JSON object with the following fields, no extra text, no explanations, no markdown.\n" +
    "IMPORTANT: Include Focus Keyword fields FIRST:\n\n" +
    "{\n" +
    '  "AI_Overview_Section_Title": "...",\n' +
    '  "AI_Trip_Description": "...",\n' +
    '  "AI_Itinerary_Section_Title": "...",\n' +
    '  "AI_Itinerary_Description": "...",\n' +
    '  "AI_Why_People_Love_This_Trip_Section_Title": "...",\n' +
    '  "AI_Tab_Content": "...",\n' +
    '  "AI_Trip_Highlights_Section_Title": "...",\n' +
    '  "AI_Cost_Section_Title": "...",\n' +
    '  "AI_Cost_Includes_Title": "...",\n' +
    '  "AI_Cost_Excludes_Title": "...",\n' +
    '  "AI_Trip_Facts_Section_Title": "...",\n' +
    '  "AI_FAQ_Section_Title": "...",\n' +
    '  "Duration_Hours": 0,\n' +
    '  "Duration_Minutes": 0,\n' +
    '  "Duration_Unit": "days",\n' +
    '  "Duration_Calculation_Reasoning": "Explain step-by-step how you calculated the total duration from the RAW itinerary steps..."\n' +
    "}\n";

  prompt = prompt
    .replace('<<<OVERVIEW_TITLE>>>',            overviewTitle)
    .replace('<<<TRIP_DESCRIPTION>>>',          tripDescription)
    .replace('<<<ITINERARY_TITLE>>>',           itineraryTitle)
    .replace('<<<ITINERARY_DESCRIPTION>>>',     itineraryDescription)
    .replace('<<<WHY_LOVE_TITLE>>>',            whyLoveTitle)
    .replace('<<<TAB_CONTENT>>>',               tabContent)
    .replace('<<<HIGHLIGHTS_SECTION_TITLE>>>',  tripHighlightsTitle)
    .replace('<<<COST_SECTION_TITLE>>>',        costSectionTitle)
    .replace('<<<COST_INCLUDES_TITLE>>>',       costIncludesTitle)
    .replace('<<<COST_EXCLUDES_TITLE>>>',       costExcludesTitle)
    .replace('<<<TRIP_FACTS_SECTION_TITLE>>>',  tripFactsTitle)
    .replace('<<<FAQ_SECTION_TITLE>>>',         faqSectionTitle);

  return prompt;
}

/************************************************************
 * CALL AI PROVIDER
 ************************************************************/

function sanitizeAiPromptPlaceholders_(prompt) {
  var s = String(prompt || '');
  if (!s) return s;
  var before = s;

  s = s.replace(/GENERATE ONE IF MISSING/ig, '');
  s = s.replace(/\bPLACEHOLDER\b/ig, '');
  s = s.replace(/\bTBD\b/ig, '');
  s = s.replace(/\bTODO\b/ig, '');
  s = s.replace(/'\s*'/g, "''");
  s = s.replace(/\s+\n/g, "\n");

  if (s !== before) Logger.log('AI: prompt placeholder leakage prevented');
  return s;
}

/**
 * callAi_
 * يختار الـ provider (DeepSeek الآن، ويمكن إضافة OpenAI لاحقاً)
 */
function callAi_(prompt) {
  prompt = sanitizeAiPromptPlaceholders_(prompt);
  if (AI_PROVIDER === 'deepseek') {
    return callDeepseek_(prompt);
  } else if (AI_PROVIDER === 'openai') {
    throw new Error('OpenAI provider not implemented yet — please implement callOpenAi_ first.');
  } else {
    throw new Error('Unknown AI_PROVIDER: ' + AI_PROVIDER);
  }
}

/**
 * callDeepseek_
 * يستدعي DeepSeek Chat API ويرجع JSON Object للنتيجة.
 */
function callDeepseek_(prompt) {
  var apiKey = getDeepseekApiKey_();
  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY in Script Properties');
  }
  var payload = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: 'You are a helpful AI that returns ONLY valid JSON for trip content improvement.' },
      { role: 'user',   content: prompt }
    ],
    temperature: 0.7
  };

  var options = {
    method:  'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(DEEPSEEK_ENDPOINT, options);
  var status   = response.getResponseCode();
  var text     = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('DeepSeek API error: HTTP ' + status + ' — ' + text);
  }

  var json = JSON.parse(text);
  if (!json.choices || !json.choices.length) {
    throw new Error('DeepSeek API: missing choices[]');
  }

  var content = json.choices[0].message && json.choices[0].message.content;
  if (!content) {
    throw new Error('DeepSeek API: empty content');
  }

  var trimmed = content.trim();

  // نحاول parse JSON بشكل مباشر
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // لو الـ model كتب كلام قبل/بعد JSON نحاول نلقط أول {...} أو [...]
    var match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) {
      throw new Error('Failed to parse AI JSON: ' + e.message + ' | content snippet: ' + trimmed.slice(0, 300));
    }
    return JSON.parse(match[1]);
  }
}

/************************************************************
 * UPSERT RECORD IN "Improvement With AI"
 ************************************************************/

/**
 * upsertImprovementRecordForTrip_
 * Updates existing Improvement record instead of creating duplicates
 */
function upsertImprovementRecordForTrip_(tripRecordId, aiResult, tripPublicId, directRecordId) {
  if (!tripRecordId) return false;

  // لازم يكون في Linked record في حقل "Improvement With AI" داخل Trips
  if (!directRecordId) {
    Logger.log('AI Enhancer: ❌ No direct Improvement record ID linked to this Trip. Skipping UPDATE.');
    return false;
  }

  Logger.log('AI Enhancer: ✅ Updating Improvement record by DIRECT ID: ' + directRecordId);

  var improvementFields = {
    // المحتوى المحسّن:
    AI_Overview_Section_Title:                  aiResult.AI_Overview_Section_Title || '',
    AI_Trip_Description:                        aiResult.AI_Trip_Description || '',
    AI_Itinerary_Section_Title:                 aiResult.AI_Itinerary_Section_Title || '',
    AI_Itinerary_Description:                   aiResult.AI_Itinerary_Description || '',
    AI_Why_People_Love_This_Trip_Section_Title: aiResult.AI_Why_People_Love_This_Trip_Section_Title || '',
    AI_Tab_Content:                             aiResult.AI_Tab_Content || '',

    // عناوين الأقسام الإضافية:
    AI_Trip_Highlights_Section_Title:           aiResult.AI_Trip_Highlights_Section_Title || '',
    AI_Cost_Section_Title:                      aiResult.AI_Cost_Section_Title || '',
    AI_Cost_Includes_Title:                     aiResult.AI_Cost_Includes_Title || '',
    AI_Cost_Excludes_Title:                     aiResult.AI_Cost_Excludes_Title || '',
    AI_Trip_Facts_Section_Title:                aiResult.AI_Trip_Facts_Section_Title || '',
    AI_FAQ_Section_Title:                       aiResult.AI_FAQ_Section_Title || '',

    // Duration (Calculated)
    Duration_Hours:   aiResult.Duration_Hours || 0,
    Duration_Minutes: aiResult.Duration_Minutes || 0,
    Duration_Unit:    aiResult.Duration_Unit || '',
    
    // Debugging (Optional, if field exists in Airtable)
    // AI_Duration_Reasoning: aiResult.Duration_Calculation_Reasoning || '',

    // حالة AI داخل جدول Improvement With AI:
    AI_Status:      'Done',
    AI_LastUpdated: new Date().toISOString()
  };

  // ✅ تحديث مباشر للسجل المرتبط
  airtableUpdate_(AI_IMPROVEMENT_TABLE, directRecordId, improvementFields);
  
  if (aiResult.Duration_Calculation_Reasoning) {
    Logger.log('AI Enhancer: Duration Calculation Reasoning:\n' + aiResult.Duration_Calculation_Reasoning);
  }
  
  Logger.log('AI Enhancer: ✅ Updated Improvement record ' + directRecordId + ' (no search, no create, no delete)');
  return true;
}

function isDebugEnabled_() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.DEBUG) return true;
  } catch (e) {}
  return false;
}

function ensureImprovementRecordIdForTrip_(tripRecordId, tripFields) {
  var f = tripFields || {};
  var id = '';
  var linked = f['Improvement With AI'];
  if (Array.isArray(linked) && linked.length) id = String(linked[0] || '').trim();
  if (!id && f.ImprovementRecordId) id = String(f.ImprovementRecordId || '').trim();
  if (id && String(id) === String(tripRecordId)) id = '';

  if (!id) {
    var rec = null;
    try {
      rec = ImprovementRepository.getOrCreateActive({
        tripRecordId: String(tripRecordId || ''),
        tripFields: f,
        tableName: AI_IMPROVEMENT_TABLE,
        tripLinkField: 'Trip',
        initialFields: { AI_SEO_Status: 'Waiting' }
      });
    } catch (e1) {
      rec = null;
    }
    if (rec && rec.id) id = String(rec.id || '').trim();
  }

  if (id && (!Array.isArray(linked) || !linked.length)) {
    try {
      airtableUpdate_(AI_TRIPS_TABLE, tripRecordId, { 'Improvement With AI': [id] });
    } catch (e2) {}
  }
  return id || null;
}

/************************************************************
 * CALCULATE DURATION FROM ITINERARY
 ************************************************************/

/**
 * Calculates duration based on ItinerarySteps count
 * Assumes 1 step = 1 day if unit is days.
 */
function calculateDurationFromItinerary_(tripId, tripPublicId) {
  try {
    // Use fetchRecordsByTrip_ from context_utils.gs (assumed available globally)
    var itinRecs = fetchRecordsByTrip_('ItinerarySteps', tripId, tripPublicId, 100);
    
    if (!itinRecs || !itinRecs.length) {
      return { hours: 0, minutes: 0, unit: 'days' }; // Default
    }

    var count = itinRecs.length;

    // Default assumption: 1 Step = 1 Day
    // If you need more complex logic (e.g. reading duration field from step), add it here.
    
    return {
      hours: count,       // Store days in Hours field as per WPTE convention for 'days' unit
      minutes: 0,
      unit: 'days'
    };

  } catch (e) {
    Logger.log('AI Enhancer: Error calculating duration from itinerary: ' + e.message);
    return { hours: 0, minutes: 0, unit: 'days' };
  }
}

/************************************************************
 * MISSING HELPER FUNCTIONS
 ************************************************************/

/**
 * Updates the AI_Status field in the Trips table
 */
function updateTripContentAiStatus_(tripId, status) {
  if (!tripId) return;
  var fields = { 'AI_Status': status };
  try {
    airtableUpdate_(AI_TRIPS_TABLE, tripId, fields);
  } catch(e) {
    Logger.log('AI Enhancer: Failed to update trip status ' + tripId + ' to ' + status);
  }
}

/**
 * Creates or updates an error record in Improvement table
 */
function upsertImprovementErrorRecordForTrip_(tripId, errorObj) {
  var errorMsg = (errorObj && errorObj.message) ? errorObj.message : String(errorObj);
  
  var fields = {
    'Trip': [tripId],
    'AI_Status': 'Error',
    'AI_Error_Log': errorMsg,
    'AI_LastUpdated': new Date().toISOString()
  };
  
  try {
    airtableCreate_(AI_IMPROVEMENT_TABLE, fields);
  } catch(e) {
    Logger.log('AI Enhancer: Failed to create error record for ' + tripId);
  }
}

/**
 * Builds examples block from existing good trips
 */
function buildExamplesFromExistingTrips_(fields) {
  return ""; 
}
