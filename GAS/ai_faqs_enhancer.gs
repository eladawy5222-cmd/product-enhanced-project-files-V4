/************************************************************
 * AI FAQs Generator (Trip-level Batch)
 * 
 * Generates 8-12 customer-focused FAQs per trip
 * Uses all raw and improved data sources
 * 
 * Pattern: Similar to ai_itinerary_enhancer.gs
 ************************************************************/

var TRIPS_TABLE = 'Trips';
var IMPROVEMENT_TABLE = 'Improvement With AI';
var FAQS_IMPROVEMENT_TABLE = 'FAQs Improvement With AI';
var HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
var ITINERARY_IMPROVEMENT_TABLE = 'Itinerary Improvement With AI';
var TRIP_INCLUDES_IMPROVEMENT_TABLE = 'TripIncludes Improvement With AI';
var TRIP_EXCLUDES_IMPROVEMENT_TABLE = 'TripExcludes Improvement With AI';
var TRIPFACTS_IMPROVEMENT_TABLE = 'TripFacts Improvement With AI';

var FAQS_STATUS_FIELD = 'AI_FAQs_Status';
var AI_FAQS_BATCH_LIMIT = 1;  // Process one trip at a time

// FAQ count limits
var MIN_FAQS_COUNT = 8;
var MAX_FAQS_COUNT = 12;

var CANCELLATION_Q_PATTERN = /cancel/i;

var CANCELLATION_QUESTION = 
  "What happens if I need to cancel my booking?";

var CANCELLATION_FIXED_ANSWER = 
  "If you need to cancel your booking, you’ll receive a full refund if you cancel at least 24 hours before the scheduled trip. Use the booking details provided after confirmation to cancel or reschedule.";

var PICKUP_Q_PATTERN = /(pickup|pick up|hotel pickup|where.*pickup|when.*pickup)/i;

var PICKUP_QUESTION = 
  "Where and when is the hotel pickup for this tour?";

var PICKUP_ANSWER_TEMPLATE_WITH_TIME = 
  "We provide convenient hotel pickup directly from your hotel lobby at {{TIME}}. Your guide will meet you there with comfortable air-conditioned transportation, ensuring a hassle-free start. You’ll receive confirmation details after booking.";

var PICKUP_ANSWER_TEMPLATE_GENERIC = 
  "We provide convenient hotel pickup directly from your hotel lobby in the morning. Your guide will meet you there with comfortable air-conditioned transportation, ensuring a hassle-free start. You’ll receive confirmation details after booking.";

var PYRAMIDS_KEYWORDS_PATTERN = /\bpyramids?\b/i;

var PYRAMIDS_QUESTION = 
  "Does this tour include entry inside any pyramid?";

var PYRAMIDS_FIXED_ANSWER = 
  "Your guided visit includes the main pyramid sites listed in the itinerary with plenty of time for photos and explanations. Entry inside any pyramid requires a separate ticket and is not included unless explicitly stated.";

/************************************************************
 * MAIN BATCH FUNCTION
 ************************************************************/
function runAiFaqsEnhancementBatch() {
  loadConfigSecrets_();
  Logger.log('AI FAQs Generator: starting batch...');
  
  try {
    // Fetch trips with AI_FAQs_Status = 'Pending'
    var formula = "AND({" + FAQS_STATUS_FIELD + "} = 'Pending', {AI_TripFacts_Status} = 'Done')";
    var params = {
      filterByFormula: formula,
      maxRecords: AI_FAQS_BATCH_LIMIT
    };
    
    var res = airtableGet_(TRIPS_TABLE, params);
    var trips = res && res.records ? res.records : [];
    
    if (!trips || !trips.length) {
      Logger.log('AI FAQs: no trips with ' + FAQS_STATUS_FIELD + " = 'Pending'.");
      return;
    }
    
    trips.forEach(function(tripRec) {
      var tripId = tripRec.id;
      var tripFields = tripRec.fields || {};
      
      try {
        Logger.log('AI FAQs: processing Trip ' + tripId);
        
        // 1) Update status to Processing
        updateTripFaqsStatus_(tripId, 'Processing');
        
        // 2) Delete old FAQs for this trip
        deleteOldFaqsForTrip_(tripId, tripFields.TripID || '');
        
        var ctx = buildFaqsContext_(tripFields, tripId);
        
        var prompt = buildFaqsPrompt_(ctx);
        
        var aiResult = callAi_(prompt);
        
        if (!aiResult || !aiResult.faqs || !Array.isArray(aiResult.faqs)) {
          throw new Error('Invalid AI result - expected faqs array');
        }
        
        var faqs = aiResult.faqs;
        
        // 1) سياسة الإلغاء الثابتة (أو الديناميكية حسب المدة)
        faqs = upsertCancellationFaq_(faqs, ctx);
        
        // 2) وقت الاستقبال (ديناميكي حسب الداتا)
        faqs = upsertPickupFaq_(faqs, ctx, tripFields);

        // 3) سؤال الأهرامات (إجباري لو الرحلة فيها أهرامات)
        faqs = upsertPyramidsFaq_(faqs, ctx);
        
        // 4) Sanitize & Dedupe
        faqs = sanitizeFaqs_(faqs);
        faqs = dedupeFaqs_(faqs);
        faqs = enforceFaqTruth_(faqs, ctx);

        // 6) Validate count (quality-first: do not pad with generic FAQs)
        if (faqs.length < MIN_FAQS_COUNT) {
          Logger.log('AI FAQs: WARNING - only ' + faqs.length + ' FAQs generated (minimum target is ' + MIN_FAQS_COUNT + ').');
          faqs = ensureMinimumFaqs_(faqs, ctx);
        }
        
        if (faqs.length > MAX_FAQS_COUNT) {
          Logger.log('AI FAQs: trimming from ' + faqs.length + ' to ' + MAX_FAQS_COUNT + ' FAQs');
          faqs = faqs.slice(0, MAX_FAQS_COUNT);
        }
        
        // 7) Create FAQ records
        var createdCount = 0;
        faqs.forEach(function(faq) {
          try {
            var question = (faq.question || '').toString().trim();
            var answer = (faq.answer || '').toString().trim();
            
            if (!question || !answer) {
              Logger.log('AI FAQs: skipping FAQ with empty question or answer');
              return;
            }
            
            var nowIso = new Date().toISOString();
            var fieldsCreate = {};
            fieldsCreate.Trip = [tripId];
            fieldsCreate.AI_Question = question;
            fieldsCreate.AI_Answer = answer;
            fieldsCreate.AI_Status = 'Done';
            fieldsCreate.AI_LastUpdated = nowIso;
            
            airtableCreate_(FAQS_IMPROVEMENT_TABLE, fieldsCreate);
            createdCount++;
            
          } catch (e) {
            Logger.log('AI FAQs: error creating FAQ — ' + e.message);
          }
        });
        
        Logger.log('AI FAQs: Trip ' + tripId + ' → created ' + createdCount + ' FAQs');
        
        try {
          var tripNumber0 = '';
          try { tripNumber0 = String((tripFields && tripFields.TripID) ? tripFields.TripID : '').trim(); } catch (eTn) {}
          var bestHours = ctx && isFinite(parseInt(ctx.cancellationWindowHours || 0, 10))
            ? parseInt(ctx.cancellationWindowHours || 0, 10)
            : 0;

          if (!bestHours || bestHours < 1) {
            faqs.forEach(function(faq) {
              var q = String(faq.question || '').toLowerCase();
              if (!q || q.indexOf('cancel') === -1) return;
              var a = String(faq.answer || '');
              var m = a.match(/at\s+least\s+(\d+)\s*hours?/i) || a.match(/(\d+)\s*hours?\s+before/i);
              if (!m) return;
              var n = parseInt(m[1], 10);
              if (!isFinite(n) || n <= 0) return;
              if (n > bestHours) bestHours = n;
            });
          }

          if (bestHours > 0) {
            var tripLinkValue0 = tripNumber0 || tripId;
            var safeTripLinkValue0 = String(tripLinkValue0).replace(/'/g, "\\'");
            var impParams2 = { filterByFormula: "FIND('" + safeTripLinkValue0 + "', ARRAYJOIN({Trip}))", pageSize: 100 };
            var impRes2 = airtableGet_(IMPROVEMENT_TABLE, impParams2);
            var impRecs2 = impRes2 && impRes2.records ? impRes2.records : [];
            if (impRecs2.length) {
              impRecs2.forEach(function(r) {
                try { airtableUpdate_(IMPROVEMENT_TABLE, r.id, { Cancellation_Window_Hours: bestHours }); } catch (eU) {}
              });
              Logger.log('AI FAQs: Updated Improvement With AI.Cancellation_Window_Hours = ' + bestHours + ' for trip ' + String(tripLinkValue0) + ' (records=' + impRecs2.length + ')');
            } else {
              Logger.log('AI FAQs: Could not find Improvement With AI records to set Cancellation_Window_Hours for trip ' + String(tripLinkValue0));
            }
          } else {
            Logger.log('AI FAQs: No cancellationWindowHours detected for trip ' + tripId + ' (multi-day or no policy hours).');
          }
        } catch (eCh) {
          Logger.log('AI FAQs: Failed setting Cancellation_Window_Hours for trip ' + tripId + ' — ' + eCh.message);
        }

        // 8) Update trip status
        updateTripFaqsStatus_(tripId, 'Done');
        
      } catch (e) {
        Logger.log('AI FAQs: error for Trip ' + tripId + ' — ' + e.message);
        updateTripFaqsStatus_(tripId, 'Error');
      }
    });
    
  } catch (e) {
    Logger.log('AI FAQs: fatal error — ' + e.message);
  }
  
  Logger.log('AI FAQs: batch finished.');
}

/************************************************************
 * CONTEXT BUILDING
 ************************************************************/
function buildFaqsContext_(tripFields, tripId) {
  var ctx = {};
  
  // Raw trip data
  ctx.tripTitle = tripFields.Title || '';
  ctx.tripDuration = tripFields.Duration || '';
  ctx.tripLocation = Array.isArray(tripFields.Cities) ? tripFields.Cities.join(', ') : '';
  ctx.tripType = tripFields.Tour_Type || '';
  ctx.tripCategory = tripFields.Category || '';
  ctx.groupSize = tripFields.Group_Size || '';
  ctx.languages = Array.isArray(tripFields.Languages) ? tripFields.Languages.join(', ') : '';
  var tripNumber = tripFields.TripID || '';
  
  // 1) Get improved trip data (Description + SEO)
  try {
    var tripLinkValue = String(tripNumber || tripId || '').trim();
    var safeTripLinkValue = tripLinkValue.replace(/'/g, "\\'");
    var impParams = { filterByFormula: "FIND('" + safeTripLinkValue + "', ARRAYJOIN({Trip}))", maxRecords: 1 };
    var impRes = airtableGet_(IMPROVEMENT_TABLE, impParams);
    if (impRes && impRes.records && impRes.records.length) {
      var impFields = impRes.records[0].fields || {};
      ctx.tripDescription = impFields.AI_Trip_Description || '';
      ctx.tripOverview = impFields.AI_Trip_Overview || '';
      ctx.seoTitle = impFields.AI_SEO_Title || '';
      ctx.seoMetaDescription = impFields.AI_SEO_Meta_Description || '';
      ctx.seoKeywords = impFields.AI_SEO_FocusKeywords || '';
    }
  } catch (e) {
    Logger.log('AI FAQs: error fetching improved data: ' + e.message);
  }

  var U = buildUnifiedTripContext_(tripId, tripFields);
  ctx.highlights = U.rawHighlightsArr.concat(U.improvedHighlightsArr);

  ctx.itinerary = U.itineraryArr;

  ctx.includes = U.includesArr;
  ctx.excludes = U.excludesArr;

  ctx.rawIncludes = U.includesRawArr || [];
  ctx.rawExcludes = U.excludesRawArr || [];

  var T = buildFaqTruth_(ctx);
  ctx.includesForFaq = T.includes;
  ctx.excludesForFaq = T.excludes;
  ctx.faqTruth = T.truth;
  
  // 5) Get trip facts
  ctx.facts = [];
  try {
    var factsRecs = fetchRecordsByTripLocal_(TRIPFACTS_IMPROVEMENT_TABLE, 'Trip', tripId, tripNumber, 100);
    if (factsRecs && factsRecs.length) {
      factsRecs.forEach(function(rec) {
        var f = rec.fields || {};
        if (f.AI_Fact_Label && f.AI_Fact_Value) {
          ctx.facts.push(f.AI_Fact_Label + ': ' + f.AI_Fact_Value);
        }
      });
    }
  } catch (e) {
    Logger.log('AI FAQs: error fetching trip facts: ' + e.message);
  }
  
  // 6) Get images (for visual context)
  ctx.imageCount = 0;
  try {
    var imgRecs = fetchRecordsByTripLocal_('Images Improvement With AI', 'Trip', tripId, tripNumber, 1);
    if (imgRecs && imgRecs.length) {
      ctx.imageCount = imgRecs.length;
    }
  } catch (e) {
    Logger.log('AI FAQs: error fetching images: ' + e.message);
  }
  
  // 7) Get pickup locations (if available)
  ctx.pickupLocations = [];
  try {
    var pickupRecs = fetchRecordsByTripLocal_('PickupLocations Improvement With AI', 'Trip', tripId, tripNumber, 100);
    if (pickupRecs && pickupRecs.length) {
      pickupRecs.forEach(function(rec) {
        var f = rec.fields || {};
        if (f.AI_Location) {
          ctx.pickupLocations.push(f.AI_Location);
        }
      });
    }
  } catch (e) {
    // Table might not exist, skip silently
  }
  
  // 8) Get itinerary steps (meals info)
  ctx.meals = [];
  try {
    var stepsRecs = fetchRecordsByTripLocal_('Itinerary Improvement With AI', 'Trip', tripId, tripNumber, 100);
    if (stepsRecs && stepsRecs.length) {
      stepsRecs.forEach(function(rec) {
        var f = rec.fields || {};
        var m = f.AI_Meals || f.AI_Meals_Included || '';
        if (m) ctx.meals.push(m);
      });
    }
  } catch (e) {
    // Table might not exist, skip silently
  }
  
  return ctx;
}

/************************************************************
 * AI PROMPT
 ************************************************************/
function buildFaqsPrompt_(ctx) {
  // Pre-scan for GEM to enforce strict rules
  var itineraryText = (ctx.itinerary || []).join(' ').toLowerCase();
  var hasNMEC = itineraryText.indexOf('national museum of egyptian civilization') > -1 || itineraryText.indexOf('egyptian civilization museum') > -1 || itineraryText.indexOf('museum of egyptian civilization') > -1 || itineraryText.indexOf('nmec') > -1 || itineraryText.indexOf('civilization museum') > -1;
  var hasGEM = itineraryText.indexOf('grand egyptian museum') > -1 || itineraryText.indexOf('gem') > -1 || itineraryText.indexOf('new museum') > -1;

  var museumConstraint = "";
  if (hasNMEC) {
    museumConstraint =
      "!!! CRITICAL MUSEUM INSTRUCTION !!!\n" +
      "The itinerary explicitly visits the National Museum of Egyptian Civilization (NMEC).\n" +
      "1. YOU MUST REFER TO THE 'National Museum of Egyptian Civilization (NMEC)' when answering museum questions.\n" +
      "2. YOU MUST NOT refer to this visit as the 'Egyptian Museum' (Tahrir).\n" +
      "3. YOU MUST NOT switch it to the Grand Egyptian Museum (GEM) unless the itinerary explicitly mentions GEM.\n\n";
  } else if (hasGEM) {
    museumConstraint = 
      "!!! CRITICAL MUSEUM INSTRUCTION !!!\n" +
      "The itinerary EXPLICITLY visits the 'Grand Egyptian Museum' (GEM) in Giza.\n" +
      "1. YOU MUST REFER TO THE 'GRAND EGYPTIAN MUSEUM' (GEM) in all answers about museums.\n" +
      "2. YOU MUST NOT MENTION the old 'Egyptian Museum in Tahrir Square'. Do not say the tour visits Tahrir.\n" +
      "3. If a user asks about 'Which museum', answer: 'You will visit the new Grand Egyptian Museum (GEM) in Giza...'\n" +
      "4. IGNORE any internal knowledge that associates 'Egyptian Museum' with Tahrir. For this trip, it means GEM.\n\n";
  } else {
    museumConstraint = 
      "!!! MUSEUM INSTRUCTION !!!\n" +
      "If the itinerary mentions 'Egyptian Museum' without specifying GEM/Grand, assume it is the classic museum in Tahrir Square.\n\n";
  }

  var prompt =
    "You are an expert travel content editor. Create a trip-specific FAQ section that answers real traveler questions, reduces booking hesitation, and stays grounded in the trip details.\n\n" +
    
    museumConstraint + 

    "TRIP INFORMATION:\n" +
    "Title: " + (ctx.tripTitle || 'N/A') + "\n" +
    "Duration: " + (ctx.tripDuration || 'N/A') + "\n" +
    "Location: " + (ctx.tripLocation || 'N/A') + "\n" +
    "Tour Type: " + (ctx.tripType || 'N/A') + "\n" +
    "Category: " + (ctx.tripCategory || 'N/A') + "\n" +
    "Group Size: " + (ctx.groupSize || 'N/A') + "\n" +
    "Languages: " + (ctx.languages || 'N/A') + "\n\n" +
    
    "DESCRIPTION:\n" + (ctx.tripDescription || 'N/A') + "\n\n" +
    
    "OVERVIEW:\n" + (ctx.tripOverview || 'N/A') + "\n\n" +
    
    "SEO CONTEXT:\n" +
    "SEO Title: " + (ctx.seoTitle || 'N/A') + "\n" +
    "SEO Description: " + (ctx.seoMetaDescription || 'N/A') + "\n" +
    "Keywords: " + (ctx.seoKeywords || 'N/A') + "\n\n" +
    
    "HIGHLIGHTS (" + ctx.highlights.length + " items):\n" + 
    (ctx.highlights.length ? ctx.highlights.slice(0, 10).join('\n') : 'N/A') + "\n\n" +
    
    "ITINERARY (" + ctx.itinerary.length + " days):\n" + 
    (ctx.itinerary.length ? ctx.itinerary.slice(0, 10).join('\n') : 'N/A') + "\n\n" +
    
    "WHAT'S INCLUDED (" + ctx.includes.length + " items):\n" + 
    (ctx.includes.length ? ctx.includes.join('\n') : 'N/A') + "\n\n" +
    
    "WHAT'S EXCLUDED (" + ctx.excludes.length + " items):\n" + 
    (ctx.excludes.length ? ctx.excludes.join('\n') : 'N/A') + "\n\n" +
    
    "TRIP FACTS (" + ctx.facts.length + " facts):\n" + 
    (ctx.facts.length ? ctx.facts.join('\n') : 'N/A') + "\n\n" +
    
    (ctx.pickupLocations.length ? "PICKUP LOCATIONS:\n" + ctx.pickupLocations.join(', ') + "\n\n" : "") +
    
    (ctx.meals.length ? "MEALS INFO:\n" + ctx.meals.slice(0, 5).join(', ') + "\n\n" : "") +
    
    "=== USER PSYCHOLOGY ===\n" +
    "Users read FAQs when they're:\n" +
    "1. *ALMOST READY TO BOOK* (Removing final doubts) -> Answer objections that stop them from clicking 'Book'\n" +
    "2. *PLANNING LOGISTICS* (Practical questions) -> Help them prepare for the tour\n" +
    "3. *COMPARING OPTIONS* (Research mode) -> Show why you're the better choice\n" +
    "4. *WORRIED ABOUT SOMETHING* (Anxiety reduction) -> Address fears and concerns directly\n\n" +

    "=== PRIORITY (ORDER) ===\n" +
    "Start with the highest-intent decision questions in this order:\n" +
    "1) What are the main stops / highlights on this tour (based on ITINERARY), and which museum is included?\n" +
    "2) What is included vs not included (based strictly on the lists above)?\n" +
    "3) Are there optional extras/add-ons (ONLY if extras exist in context), and how do they work (optional, extra charge)?\n" +
    "4) Where does it start (pickup/meeting point) and what to bring (ONLY if present in context)?\n\n" +

    "=== FAQ CATEGORIES TO COVER ===\n" +
    "Generate EXACTLY " + MIN_FAQS_COUNT + "-" + MAX_FAQS_COUNT + " FAQs covering these categories where relevant:\n" +
    "*CATEGORY 1: BOOKING & PAYMENT* 💳 (How to book, payment methods, instant confirmation)\n" +
    "*CATEGORY 2: CANCELLATION & CHANGES* 🔄 (ONLY if a cancellation/refund policy is explicitly present in the context. Otherwise omit.)\n" +
    "*CATEGORY 3: PICKUP & LOGISTICS* 🚐 (Pickup time/location or meeting point ONLY if present; do not invent contact info)\n" +
    "*CATEGORY 4: PHYSICAL & HEALTH* 💪 (Fitness level, elderly/children, accessibility)\n" +
    "*CATEGORY 5: WHAT TO BRING* 🎒 (Clothing, items, camera, storage)\n" +
    "*CATEGORY 6: TOUR EXPERIENCE* ⭐ (Group size, language, free time, customization)\n" +
    "*CATEGORY 7: FOOD & DIETARY* 🍽️ (Inclusions, restrictions, own food)\n" +
    "*CATEGORY 8: MONEY & EXTRAS* 💰 (Cash needed, tips, add-ons)\n" +
    "*CATEGORY 9: SAFETY & CONCERNS* 🛡️ (Safety, insurance, emergencies)\n" +
    "*CATEGORY 10: SPECIFIC TO TOUR* 🎯 (Tour/Attraction specific questions)\n\n" +

    "=== MUSEUM DISTINCTION & LOGIC (CRITICAL) ===\n" +
    "1. The Egyptian Museum (Tahrir): Old museum in Tahrir Square.\n" +
    "2. The Grand Egyptian Museum (GEM): New museum in Giza (Tutankhamun & Mummies).\n" +
    "3. The National Museum of Egyptian Civilization (NMEC): In Fustat.\n\n" +
    "RULES:\n" +
    "- PRIORITY 1 (ITINERARY CHECK): Scan the provided ITINERARY text. If it mentions 'Grand Egyptian Museum', 'GEM', or 'New Museum', you MUST refer to the Grand Egyptian Museum in your answers. DO NOT claim the tour visits Tahrir Museum in this case.\n" +
    "- PRIORITY 2 (DEFAULT): If the itinerary specifically mentions 'Egyptian Museum' (and NOT GEM), assume it is the Tahrir Museum.\n" +
    "- IF trip originates from outside Cairo (e.g. Hurghada, Sharm) AND input mentions generic 'Egyptian Museum': REPLACE with 'Grand Egyptian Museum' (GEM).\n" +
    "- DO NOT replace 'National Museum of Egyptian Civilization' (NMEC) with GEM.\n\n" +

    "=== CONDITIONAL VISIT RULES ===\n" +
    "- IF the itinerary involves visiting BOTH 'Pyramids' AND 'Grand Egyptian Museum' (GEM):\n" +
    "  -> The visit to 'Khan el-Khalili' (if present) MUST be marked as conditional.\n" +
    "  -> Add '(if time permits)' when mentioning Khan el-Khalili.\n" +
    "  -> Example: 'Khan el-Khalili Market (if time permits)'\n\n" +

    "=== WRITING RULES ===\n" +
    "1. *QUESTION FORMAT*: Write as users actually search (natural language). e.g., 'What is your cancellation policy?' instead of 'Cancellation Policy'.\n" +
    "2. *ANSWER LENGTH*: 2-4 sentences max (scannable).\n" +
    "3. *DIRECT ANSWERS*: First sentence answers the question directly.\n" +
    "4. *REASSURING TONE*: Calm concerns, don't create new ones.\n" +
    "5. *KEYWORDS*: Include SEO keywords naturally in Q&A.\n" +
    "6. *ACTIONABLE*: Tell them what to DO, not just information.\n" +
    "7. *POSITIVE FRAMING*: Turn negatives into positives.\n\n" +

    "=== QUESTION WRITING TIPS ===\n" +
    "Write questions as users ACTUALLY search:\n" +
    "❌ 'Fitness' (Too vague)\n" +
    "✅ 'What fitness level do I need for this tour?'\n" +
    "Include long-tail keyword questions.\n\n" +

    "=== ANSWER STRUCTURE ===\n" +
    "Formula: [Direct Answer] + [Supporting Detail] + [Reassurance/Action]\n" +
    "Do NOT include cancellation/refund promises unless they are explicitly present in the context.\n\n" +

    "=== MANDATORY WRITING RULES (HUMAN TOUCH) ===\n" +
    "1. Tone & Voice: Natural, conversational, like an experienced guide.\n" +
    "2. Break AI Patterns: No repetitive structures, no generic openings.\n" +
    "3. Experience & Trust: Reference real-world experience, highlight concerns.\n" +
    "4. Structure: Connect with intent -> Direct Answer -> Explanation/Tips -> Insight.\n" +
    "5. Direct Engagement: Speak to 'you'.\n" +
    "6. SEO: Focus on search intent, use synonyms.\n\n" +

    "CRITICAL CONSTRAINTS:\n" +
    "- Use ONLY information from context above (all improved data sources)\n" +
    "- Do NOT invent details (prices, specific times, contact info) if not in context\n" +
    "- Do NOT claim free cancellation, refunds, or a specific cancellation window unless explicitly present in the context\n" +
    "- ENTRANCE FEES: Do NOT state 'included' or 'not included' unless the Included/Excluded lists above explicitly say so. If uncertain, tell the user to rely on those lists.\n" +
    "- INCLUDED VS NOT INCLUDED: When answering this, do NOT list new items. Summarize by pointing to the Included/Not Included lists.\n" +
    "- CASH / WHAT TO BRING: Mention cash for personal purchases, tips, and optional extras. Only mention cash for tickets if the Excluded list explicitly says entrance fees/tickets are not included.\n" +
    "- GUIDE / EGYPTOLOGIST: Do NOT present an 'expert Egyptologist guide' as guaranteed unless it is explicitly listed in What's Included without conditions. If it appears as conditional (e.g. 'if selected'), say it depends on the option selected.\n" +
    "- LANGUAGES: Do NOT list specific languages unless they are explicitly provided in the context. If not provided, say language availability is confirmed at booking.\n" +
    "- OPTIONAL EXTRAS: Do NOT mention specific add-ons (e.g., photographer, scarves, Nile boat ride) unless they are explicitly present in the context above.\n" +
    "- If optional extras/add-ons exist in context, you may clarify they are optional and not included unless selected; do not list specific extras unless present in context\n" +
    "- Avoid support-template boilerplate (e.g., 'contact our customer service team', 'hotline', vague promises). Keep answers specific and practical.\n" +
    "- Output in ENGLISH ONLY\n" +
    "- Aim for " + MIN_FAQS_COUNT + " to " + MAX_FAQS_COUNT + " trip-specific FAQs, but quality is more important than count.\n" +
    "- Do NOT add generic filler FAQs just to reach a minimum.\n" +
    "- Try to use the Focus Keyword ('" + (ctx.seoKeywords || '') + "') naturally in 1-2 questions or answers.\n\n" +
    
    "OUTPUT FORMAT (JSON ONLY):\n" +
    "{\n" +
    "  \"faqs\": [\n" +
    "    {\n" +
    "      \"question\": \"How do I book this tour?\",\n" +
    "      \"answer\": \"You can book directly on this page. After you book, you’ll receive confirmation details and any pickup or meeting-point information (if applicable).\"\n" +
    "    },\n" +
    "    {\n" +
    "      \"question\": \"What is included in the tour price?\",\n" +
    "      \"answer\": \"Use the Included and Not Included lists on this page as the most accurate reference. If something is listed as an optional extra, it is only added if you select it during booking.\"\n" +
    "    }\n" +
    "  ]\n" +
    "}\n";
  
  return prompt;
}

/************************************************************
 * HELPER FUNCTIONS
 ************************************************************/

function upsertCancellationFaq_(faqs, ctx) {
  if (!Array.isArray(faqs)) return faqs;

  // Determine which policy to use
  var policyAnswer = CANCELLATION_FIXED_ANSWER; // Default (24h)
  var isMultiDay = false;
  var days = 0;

  // Logging for debug
  var durationRaw = (ctx && ctx.tripDuration) ? ctx.tripDuration.toString() : '';
  Logger.log('AI FAQs: Checking duration for cancellation policy. Raw Duration: "' + durationRaw + '"');

  // Helper to extract days from text
  function getDaysFromText(text) {
    if (!text) return 0;
    var s = text.toString().toLowerCase();
    
    // 🆕 Explicitly check for "Hours" or "Minutes" to avoid false positives in fallbacks
    if (s.indexOf('hour') !== -1 || s.indexOf('min') !== -1) {
      Logger.log('AI FAQs: Duration "' + text + '" implies short trip (hours/mins).');
      return -1; // Special flag for "Definitely Short"
    }

    // Check Weeks (e.g., "1 week", "2 weeks")
    if (s.indexOf('week') !== -1) {
      var m = s.match(/(\d+)\s*week/);
      if (m && m[1]) return parseInt(m[1], 10) * 7;
    }
    
    // Check Days (e.g., "7 Days", "7-Day", "7 days")
    var m = s.match(/(\d+)\s*(-|\s)?\s*day/);
    if (m && m[1]) return parseInt(m[1], 10);
    
    return 0;
  }

  function getDaysFromItinerary_(itineraryArr) {
    if (!Array.isArray(itineraryArr) || !itineraryArr.length) return 0;
    var maxDay = 0;
    var hasDayToken = false;
    itineraryArr.forEach(function(item) {
      var s = String(item || '');
      var m = s.match(/\bday\s*(\d+)\b/i);
      if (m && m[1]) {
        hasDayToken = true;
        var n = parseInt(m[1], 10);
        if (isFinite(n) && n > maxDay) maxDay = n;
        return;
      }
      if (/\bday\b/i.test(s)) hasDayToken = true;
    });
    if (maxDay > 0) return maxDay;
    if (hasDayToken) return 1;
    return 0;
  }

  // 1. Check Duration Field
  days = getDaysFromText(durationRaw);

  // 🆕 1.5 Check Facts if Duration is inconclusive
  // (Sometimes Duration is just "1" and the unit "Hours" is in facts)
  if (days === 0 && ctx && Array.isArray(ctx.facts)) {
     var factsText = ctx.facts.join(' | ');
     Logger.log('AI FAQs: Checking Facts for duration: ' + factsText);
     var daysFromFacts = getDaysFromText(factsText);
     
     if (daysFromFacts === -1) {
       days = -1; // Facts say it's short (hours)
     } else if (daysFromFacts > 0) {
       days = daysFromFacts; // Facts say it's X days
     }
  }
  
  // If explicitly short (-1), reset to 0 and skip fallbacks
  if (days === -1) {
     days = 0;
  } else {
      // 2. Fallback: Check Title if Duration failed (and not explicitly short)
      if (days === 0 && ctx && ctx.tripTitle) {
         Logger.log('AI FAQs: Duration field inconclusive, checking Title: "' + ctx.tripTitle + '"');
         days = getDaysFromText(ctx.tripTitle);
         if (days === -1) days = 0; // Handle title saying "4 hours"
      }
    
      // 3. Fallback: Check Itinerary length
      // ONLY if we still have 0 days and didn't find "hours" anywhere
      if (days === 0 && ctx && Array.isArray(ctx.itinerary) && ctx.itinerary.length > 0) {
         var daysFromItinerary = getDaysFromItinerary_(ctx.itinerary);
         Logger.log('AI FAQs: Duration/Title inconclusive, checking Itinerary Day markers → ' + daysFromItinerary);
         if (daysFromItinerary > 0) days = daysFromItinerary;
      }
  }

  if (days > 1) {
    isMultiDay = true;
    Logger.log('AI FAQs: Detected multi-day trip (' + days + ' days). Using STRICT policy.');
  } else {
    Logger.log('AI FAQs: Detected short trip (' + days + ' days). Using FLEXIBLE policy.');
  }
  
  if (isMultiDay) {
          policyAnswer = "We understand that travel plans can change, so we try to be as flexible as possible. Please see our cancellation policy below:\n\n" +
                         "✔ More than 60 days before the tour start date\n" +
                         "You can cancel your booking free of charge and receive a full refund.\n\n" +
                         "✔ From 30 to 60 days before the tour start date\n" +
                         "A 50% cancellation fee will apply, as flight tickets are non-refundable once issued.\n\n" +
                         "✔ Less than 30 days before the tour start date\n" +
                         "Unfortunately, no refund can be provided, as hotels, transportation, and other services will already be fully booked and confirmed.\n\n" +
                         "If you need assistance with cancellation, rescheduling, or have any questions, our customer service team will be happy to help.";
  }

  if (ctx) {
    ctx.cancellationWindowHours = isMultiDay ? 0 : 24;
  }

  var found = false;

  for (var i = 0; i < faqs.length; i++) {
    var q = (faqs[i].question || '').toString().trim();
    if (CANCELLATION_Q_PATTERN.test(q)) {
      faqs[i].question = "What happens if I need to cancel my booking?";
      faqs[i].answer = policyAnswer;
      found = true;
      break;
    }
  }

  // لو السؤال مش موجود، أضفه (ويفضل يكون ضمن أول 6 لأنه مهم للتحويل)
  if (!found) {
    faqs.unshift({
      question: "What happens if I need to cancel my booking?",
      answer: policyAnswer
    });
  }

  return faqs;
}

function extractPickupTimeFromContext_(ctx, tripFields) { 
  // 1) لو عندك حقل واضح في Trips مثل Pickup_Time / PickupTime / StartTime 
  var candidates = []; 

  if (tripFields) { 
    candidates.push(tripFields.Pickup_Time, tripFields.PickupTime, tripFields.StartTime, tripFields.Meeting_Time); 
  } 

  // 2) Trip Facts (AI_Fact_Label: AI_Fact_Value) 
  if (ctx && Array.isArray(ctx.facts)) { 
    candidates = candidates.concat(ctx.facts); 
  } 

  // 3) Itinerary text 
  if (ctx && Array.isArray(ctx.itinerary)) { 
    candidates = candidates.concat(ctx.itinerary); 
  } 

  // Regex لالتقاط وقت مثل 8:00 AM أو 8 AM أو 18:30 (لو عندك صيغة 24h) 
  var timeRegex = /\b(\d{1,2})(:\d{2})?\s?(AM|PM)\b/i; 
  var time24Regex = /\b([01]?\d|2[0-3]):[0-5]\d\b/; // 24-hour format 

  for (var i = 0; i < candidates.length; i++) { 
    var s = (candidates[i] || '').toString(); 
    if (!s) continue; 

    var m = s.match(timeRegex); 
    if (m && m[0]) return m[0].toUpperCase().replace(/\s+/g, ' ').trim(); 

    var m24 = s.match(time24Regex); 
    if (m24 && m24[0]) return m24[0].trim(); 
  } 

  return ""; // مش موجود 
} 

function upsertPickupFaq_(faqs, ctx, tripFields) { 
  if (!Array.isArray(faqs)) return faqs; 

  var pickupSignalText = [
    ctx && ctx.tripTitle ? ctx.tripTitle : '',
    ctx && ctx.tripDescription ? ctx.tripDescription : '',
    ctx && ctx.tripOverview ? ctx.tripOverview : '',
    (ctx && ctx.highlights ? ctx.highlights.join(' ') : ''),
    (ctx && ctx.itinerary ? ctx.itinerary.join(' ') : ''),
    (ctx && ctx.includes ? ctx.includes.join(' ') : ''),
    (ctx && ctx.excludes ? ctx.excludes.join(' ') : ''),
    tripFields && tripFields.Pickup ? String(tripFields.Pickup) : '',
    tripFields && tripFields.PickupTime ? String(tripFields.PickupTime) : '',
    tripFields && tripFields.Pickup_Time ? String(tripFields.Pickup_Time) : ''
  ].join(' ').toLowerCase();

  var hasPickupSignal = /\bpick\s*up\b|\bpickup\b|\bhotel\s+pick\s*up\b|\bhotel\s+pickup\b|\bhotel\s+transfer\b|\bmeeting\s+point\b/i.test(pickupSignalText);
  if (!hasPickupSignal) {
    for (var r = 0; r < faqs.length; r++) {
      var qq = (faqs[r].question || '').toString();
      if (PICKUP_Q_PATTERN.test(qq)) {
        faqs.splice(r, 1);
        r--;
      }
    }
    return faqs;
  }

  var pickupTime = extractPickupTimeFromContext_(ctx, tripFields); 
  var answer = pickupTime 
    ? PICKUP_ANSWER_TEMPLATE_WITH_TIME.replace("{{TIME}}", pickupTime) 
    : PICKUP_ANSWER_TEMPLATE_GENERIC; 

  var found = false; 

  for (var i = 0; i < faqs.length; i++) { 
    var q = (faqs[i].question || '').toString(); 
    if (PICKUP_Q_PATTERN.test(q)) { 
      faqs[i].question = PICKUP_QUESTION; 
      faqs[i].answer = answer; 
      found = true; 
      break; 
    } 
  } 

  // لو مش موجود، ضيفه بدري (FAQ مهم للتحويل) 
  if (!found) { 
    faqs.unshift({ 
      question: PICKUP_QUESTION, 
      answer: answer 
    }); 
  } 

  return faqs; 
} 

function upsertPyramidsFaq_(faqs, ctx) {
  if (!Array.isArray(faqs)) return faqs;

  function norm_(s) { return (s || '').toString().toLowerCase(); }
  var signalText = [
    ctx && ctx.tripTitle ? ctx.tripTitle : '',
    (ctx && ctx.highlights ? ctx.highlights.join(' ') : ''),
    (ctx && ctx.itinerary ? ctx.itinerary.join(' ') : ''),
    (ctx && ctx.facts ? ctx.facts.join(' ') : '')
  ].join(' ');
  signalText = norm_(signalText);

  function hasExplicitPyramidsSignal_(t) {
    if (!t) return false;
    if (/\bgreat\s+pyramids?\b/.test(t)) return true;
    if (/\bpyramids?\b/.test(t)) return true;
    if (/\bgiza\s+plateau\b/.test(t)) return true;
    if (/\bgiza\b/.test(t) && (/\bpyramids?\b/.test(t) || /\bsphinx\b/.test(t))) return true;
    if (/\bsphinx\b/.test(t) && /\bpyramids?\b/.test(t)) return true;
    return false;
  }

  var hasPyramids = hasExplicitPyramidsSignal_(signalText);
  if (!hasPyramids) {
    var removeRx = /(pyramids?|entry.*inside.*pyramid|inside.*pyramid|enter.*pyramid|giza|sphinx)/i;
    for (var r = 0; r < faqs.length; r++) {
      var qq = (faqs[r].question || '').toString();
      var aa = (faqs[r].answer || '').toString();
      if (removeRx.test(qq) || removeRx.test(aa)) {
        faqs.splice(r, 1);
        r--;
      }
    }
    return faqs;
  }

  // Remove existing similar question to avoid duplicates (AI might have generated one)
  var qPattern = /(entry.*inside.*pyramid|inside.*pyramid|enter.*pyramid)/i;
  for (var i = 0; i < faqs.length; i++) {
    var q = (faqs[i].question || '').toString();
    if (qPattern.test(q)) {
      faqs.splice(i, 1);
      i--;
    }
  }

  // Insert the fixed question (e.g., at index 2, after cancellation and pickup)
  faqs.splice(2, 0, {
    question: PYRAMIDS_QUESTION,
    answer: PYRAMIDS_FIXED_ANSWER
  });

  return faqs;
}

function dedupeFaqs_(faqs) { 
  if (!Array.isArray(faqs)) return faqs; 

  function norm_(s) { return String(s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function stem_(w) {
    var x = String(w || '').trim();
    if (x.length <= 3) return x;
    x = x.replace(/'s$/i, '');
    x = x.replace(/(ing|ed|es|s)$/i, function(m) { return m.length && x.length - m.length >= 3 ? '' : m; });
    return x;
  }
  var stop = {
    the: 1, a: 1, an: 1, and: 1, or: 1, to: 1, for: 1, of: 1, in: 1, on: 1, at: 1, with: 1, from: 1,
    is: 1, are: 1, do: 1, does: 1, can: 1, i: 1, we: 1, you: 1, your: 1, our: 1, this: 1, that: 1,
    tour: 1, trip: 1, excursion: 1, package: 1, booking: 1
  };
  function tokens_(q) {
    var t = norm_(q);
    if (!t) return [];
    t = t.replace(/\bhotel\s+pick\s*up\b/g, 'pickup').replace(/\bhotel\s+pickup\b/g, 'pickup').replace(/\bpick\s*up\b/g, 'pickup');
    var parts = t.split(' ').filter(function(w) { return !!w && !stop[w]; }).map(stem_);
    var out = [];
    var seen = {};
    for (var i = 0; i < parts.length; i++) {
      var w = parts[i];
      if (!w || stop[w]) continue;
      if (seen[w]) continue;
      seen[w] = true;
      out.push(w);
    }
    out.sort();
    return out;
  }
  function jaccard_(a, b) {
    if (!a.length || !b.length) return 0;
    var i = 0, j = 0;
    var inter = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { inter++; i++; j++; }
      else if (a[i] < b[j]) i++;
      else j++;
    }
    var union = a.length + b.length - inter;
    return union ? (inter / union) : 0;
  }

  var out = [];
  var sigs = [];
  for (var i = 0; i < faqs.length; i++) {
    var q = (faqs[i].question || '').toString().trim();
    var a = (faqs[i].answer || '').toString().trim();
    if (!q || !a) continue;
    var tks = tokens_(q);
    if (!tks.length) continue;
    var dup = false;
    for (var k = 0; k < sigs.length; k++) {
      if (jaccard_(tks, sigs[k]) >= 0.78) { dup = true; break; }
    }
    if (dup) continue;
    sigs.push(tks);
    out.push(faqs[i]);
  }
  return out;
} 

function sanitizeFaqAnswer_(text) { 
  var s = (text || '').toString(); 

  // أمثلة كلمات/وعود شائعة تسبب مشاكل (عدّل القائمة حسب احتياجك) 
  var banned = [ 
    /\b(?:our\s+)?professional\s+photographer\b/ig,
    /\bhotline\b/ig, 
    /\bguaranteed\b/ig, 
    /\b100%\b/ig 
  ]; 

  banned.forEach(function(rx) { 
    s = s.replace(rx, ''); 
  }); 

  s = s.replace(/[—–-]\s*will\s+also\s+capture[^.?!]*(?:[.?!]|$)/ig, '. ');
  s = s.replace(/[—–-]\s*our\s+will\s+also\s+capture[^.?!]*(?:[.?!]|$)/ig, '. ');
  s = s.replace(/[—–-]\s*our\s+will\b/ig, '. ');
  s = s.replace(/[—–-]\s*(?:will|would|can|could|should|may|might)\b[^.?!]*(?:[.?!]|$)/ig, '. ');
  s = s.replace(/(?:^|[.!?]\s+)\s*(?:and|but)\s+will\b[^.?!]*(?:[.?!]|$)/ig, '. ');
  s = s.replace(/(?:^|[.!?]\s+)\s*will\b[^.?!]*(?:[.?!]|$)/ig, '');
  s = s.replace(/\bour\s+will\s+also\s+capture[^.?!]*(?:[.?!]|$)/ig, '');
  s = s.replace(/\bour\s+will\b/ig, 'we will');
  s = s.replace(/\bwe\s+will\s+also\s+capture[^.?!]*(?:[.?!]|$)/ig, '');
  s = s.replace(/[—–-]\s*(?:and|but)\s+will\b[^.?!]*(?:[.?!]|$)/ig, '. ');
  s = s.replace(/\bRelated to [^.?!]*(?:[.?!]|$)/ig, '');
  s = s.replace(/\bcontact\s+our\s+customer\s+service\s+team\b/ig, 'book directly on this page');
  s = s.replace(/[—–-]\s*(?:will|and|but|also)\b[^.?!]*$/ig, '').trim();

  // تنظيف مسافات زائدة 
  s = s.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim(); 
  s = s.replace(/\.\s*\./g, '.').replace(/\s+([,.;:!?])/g, '$1').trim();
  if (s && !/[.!?]$/.test(s) && s.length >= 20) s += '.';
  return s; 
} 

function sanitizeFaqs_(faqs) { 
  if (!Array.isArray(faqs)) return faqs; 
  for (var i = 0; i < faqs.length; i++) { 
    faqs[i].answer = sanitizeFaqAnswer_(faqs[i].answer); 
  } 
  return faqs; 
} 

function buildFaqTruth_(ctx) {
  var rawInc = (ctx && Array.isArray(ctx.rawIncludes)) ? ctx.rawIncludes : [];
  var rawExc = (ctx && Array.isArray(ctx.rawExcludes)) ? ctx.rawExcludes : [];
  var impInc = (ctx && Array.isArray(ctx.includes)) ? ctx.includes : [];
  var impExc = (ctx && Array.isArray(ctx.excludes)) ? ctx.excludes : [];

  var incBase = rawInc.length ? rawInc : impInc;
  var excBase = rawExc.length ? rawExc : impExc;

  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function lc_(s) { return norm_(s).toLowerCase(); }
  function hasEntrance_(s) { return /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(s); }
  function hasGuide_(s) { return /\b(egyptologist|tour guide|guide)\b/.test(s); }
  function hasOptionalMarker_(s) { return /\b(optional|add-?on|extra|if selected|upon request)\b/.test(s); }
  function hasNile_(s) { return /\b(nile|boat|cruise|felucca)\b/.test(s); }
  function entranceDecisionByMajority_() {
    var includeCount = 0;
    var excludeCount = 0;

    function countByListRole_(items, role) {
      for (var i = 0; i < items.length; i++) {
        var t = lc_(items[i]);
        if (!t) continue;
        if (!hasEntrance_(t)) continue;
        if (role === 'include') includeCount++;
        else excludeCount++;
      }
    }

    function countByTextEvidence_(text) {
      var s = lc_(text);
      if (!s) return;
      if (!hasEntrance_(s)) return;
      if (/\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b[^.]{0,60}\b(not included|excluded)\b/.test(s)) excludeCount++;
      else if (/\b(not included|excluded)\b[^.]{0,60}\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(s)) excludeCount++;
      else if (/\byou(?:\s+will|\s*'ll)?\s+need\s+to\s+pay\b[^.]{0,80}\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(s)) excludeCount++;
      else if (/\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b[^.]{0,60}\b(included|covered)\b/.test(s)) includeCount++;
      else if (/\b(included|covered)\b[^.]{0,60}\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(s)) includeCount++;
    }

    countByListRole_(rawInc, 'include');
    countByListRole_(rawExc, 'exclude');
    countByListRole_(impInc, 'include');
    countByListRole_(impExc, 'exclude');

    var evidenceTexts = [
      (ctx && ctx.tripDescription) ? ctx.tripDescription : '',
      (ctx && ctx.aiTripDescription) ? ctx.aiTripDescription : '',
      (ctx && ctx.highlights) ? ctx.highlights.join(' ') : '',
      (ctx && ctx.itinerary) ? ctx.itinerary.join(' ') : ''
    ];
    for (var k = 0; k < evidenceTexts.length; k++) countByTextEvidence_(evidenceTexts[k]);

    if (includeCount > excludeCount) return 'include';
    if (excludeCount > includeCount) return 'exclude';
    if (includeCount > 0 && excludeCount > 0) return 'conflict';
    return 'unknown';
  }

  var incOut = [];
  for (var i = 0; i < incBase.length; i++) {
    var t = norm_(incBase[i]);
    if (!t) continue;
    var l = t.toLowerCase();
    if ((/\b(scarf|scarves|scarve)\b/.test(l) && /\bfts\b/.test(l)) || /\b(photographer|organic oils)\b/.test(l)) continue;
    if (hasNile_(l) && !hasNile_(lc_(rawInc.join(' ')))) continue;
    incOut.push(t);
  }

  var excOut = [];
  var incLc = lc_(incOut.join(' '));
  for (var j = 0; j < excBase.length; j++) {
    var x = norm_(excBase[j]);
    if (!x) continue;
    var xl = x.toLowerCase();
    if (hasEntrance_(xl) && hasEntrance_(incLc)) continue;
    if (hasGuide_(xl) && hasGuide_(incLc) && !hasOptionalMarker_(lc_(rawInc.join(' ')))) continue;
    excOut.push(x);
  }

  var rawIncLc = lc_(rawInc.join(' '));
  var rawExcLc = lc_(rawExc.join(' '));
  var impIncLc = lc_(impInc.join(' '));
  var impExcLc = lc_(impExc.join(' '));
  var excLc = lc_(excOut.join(' '));
  var entranceDecision = entranceDecisionByMajority_();
  var truth = {
    entrance_included: entranceDecision === 'include',
    entrance_excluded: entranceDecision === 'exclude',
    entrance_conflict: entranceDecision === 'conflict',
    guide_included: hasGuide_(rawIncLc) || hasGuide_(incLc) || hasGuide_(impIncLc),
    guide_conditional: hasGuide_(rawIncLc) && hasOptionalMarker_(rawIncLc),
    nile_evidence: hasNile_(lc_(((ctx && ctx.itinerary) ? ctx.itinerary.join(' ') : '') + ' ' + ((ctx && ctx.highlights) ? ctx.highlights.join(' ') : '') + ' ' + rawIncLc + ' ' + incLc))
  };

  if (truth.entrance_included) truth.entrance_excluded = false;
  return { includes: incOut, excludes: excOut, truth: truth };
}

function enforceFaqTruth_(faqs, ctx) {
  if (!Array.isArray(faqs)) return faqs;
  var T = (ctx && ctx.faqTruth) ? ctx.faqTruth : {};
  var inc = (ctx && Array.isArray(ctx.includesForFaq)) ? ctx.includesForFaq : (ctx.includes || []);
  var exc = (ctx && Array.isArray(ctx.excludesForFaq)) ? ctx.excludesForFaq : (ctx.excludes || []);
  var incText = inc.join('\n');
  var excText = exc.join('\n');

  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function lc_(s) { return norm_(s).toLowerCase(); }
  function isIncludedNotIncludedQ_(q) { return /\b(what'?s included|what is included|included in the|not included|included vs|included and what is not)\b/.test(q); }
  function isEntranceQ_(q) { return /\b(entrance|ticket|tickets|admission)\b/.test(q); }
  function isCashQ_(q) { return /\b(cash|money)\b/.test(q) && (/\bbring\b/.test(q) || /\bhow much\b/.test(q) || /\bneed\b/.test(q)); }
  function isBringQ_(q) { return /\bwhat should i bring|what to bring|what should i wear|dress|shoes\b/.test(q); }
  function isLanguagesQ_(q) { return /\b(language|languages)\b/.test(q); }

  function stripNileIfNoEvidence_(a) {
    if (T && T.nile_evidence) return a;
    var s = String(a || '');
    s = s.replace(/[^.?!]*\b(nile|boat|cruise|felucca)\b[^.?!]*(?:[.?!]|$)/ig, '').trim();
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function fixBroken_(a) {
    var s = String(a || '');
    s = s.replace(/,\s*a,\s*and\s+/ig, ', and ');
    s = s.replace(/,\s*,\s*/g, ', ');
    s = s.replace(/\s+,/g, ',');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function removeEntranceContradiction_(a) {
    var s = String(a || '');
    if (T && T.entrance_conflict) {
      s = s.replace(/[^.?!]*\b(entrance|ticket|tickets|admission)\b[^.?!]*(?:included|not included|excluded|cover(?:ed)?|pay|need to pay)\b[^.?!]*(?:[.?!]|$)/ig, '').trim();
      s = s.replace(/[^.?!]*\bbring\b[^.?!]*\b(cash|money)\b[^.?!]*\b(entrance|ticket|tickets|admission)\b[^.?!]*(?:[.?!]|$)/ig, '').trim();
    }
    if (T && T.entrance_included) {
      s = s.replace(/[^.?!]*\b(entrance|ticket|tickets|admission)\b[^.?!]*\bnot included\b[^.?!]*(?:[.?!]|$)/ig, '').trim();
      s = s.replace(/[^.?!]*\bbring\b[^.?!]*\b(cash|money)\b[^.?!]*\b(entrance|ticket|tickets|admission)\b[^.?!]*(?:[.?!]|$)/ig, '').trim();
    }
    if (T && T.entrance_excluded && !T.entrance_included) {
      s = s.replace(/[^.?!]*\b(entrance|ticket|tickets|admission)\b[^.?!]*\bincluded\b[^.?!]*(?:[.?!]|$)/ig, '').trim();
    }
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function buildEntranceLine_() {
    if (T && T.entrance_conflict) return "Entrance-fee coverage depends on the option selected. Please rely on the What's Included and What's Not Included lists.";
    if (T && T.entrance_included) return "Entrance fees are included as listed in What's Included.";
    if (T && T.entrance_excluded) return "Entrance fees/tickets are not included (see What's Not Included).";
    return "Please rely on the What's Included and What's Not Included lists for entrance-fee coverage.";
  }

  function buildGuideLine_() {
    if (T && T.guide_conditional) return "Guiding depends on the option selected.";
    if (T && T.guide_included) return "An Egyptologist guide is included as listed in What's Included.";
    return "";
  }

  for (var i = 0; i < faqs.length; i++) {
    var q = norm_(faqs[i].question);
    var a = norm_(faqs[i].answer);
    if (!q || !a) continue;
    var ql = q.toLowerCase();

    a = stripNileIfNoEvidence_(a);
    a = fixBroken_(a);
    a = removeEntranceContradiction_(a);

    if (isLanguagesQ_(ql)) {
      if (!(ctx && ctx.languages && String(ctx.languages).trim())) {
        a = 'Language availability is confirmed at booking.';
      }
    } else if (isIncludedNotIncludedQ_(ql)) {
      var lines = [];
      lines.push("What's included and not included is listed on this page under What's Included and What's Not Included.");
      lines.push(buildEntranceLine_());
      var gLine = buildGuideLine_();
      if (gLine) lines.push(gLine);
      a = lines.filter(Boolean).join(' ');
    } else if (isEntranceQ_(ql)) {
      a = buildEntranceLine_();
    } else if (isCashQ_(ql)) {
      var parts = ["Bring some cash for tips, personal purchases, and any optional extras."];
      if (T && T.entrance_excluded && !T.entrance_included) parts.push("You'll also want cash/card for entrance tickets if they're not included.");
      if (T && T.entrance_included) parts.push("You typically won't need cash for entrance tickets because they're included as listed in What's Included.");
      a = parts.join(' ');
    } else if (isBringQ_(ql)) {
      a = a;
    }

    if (!a) continue;
    faqs[i].question = q;
    faqs[i].answer = a;
  }

  return faqs;
}

/**
 * Delete old FAQ records for a trip
 */
function deleteOldFaqsForTrip_(tripId, tripNumber) {
  if (!tripId) return;
  Logger.log('AI FAQs: deleting old FAQs for Trip ' + tripId);
  try {
    var recs = [];
    if (tripNumber) {
      var paramsA = { filterByFormula: "FIND('" + String(tripNumber).replace(/'/g, "\\'") + "', ARRAYJOIN({Trip}))", pageSize: 100 };
      var resA = airtableGet_(FAQS_IMPROVEMENT_TABLE, paramsA);
      recs = resA && resA.records ? resA.records : [];
    }
    if (!recs.length) {
      var paramsB = { filterByFormula: "FIND('" + String(tripId).replace(/'/g, "\\'") + "', ARRAYJOIN({Trip}))", pageSize: 100 };
      var resB = airtableGet_(FAQS_IMPROVEMENT_TABLE, paramsB);
      recs = resB && resB.records ? resB.records : [];
    }
    var toDelete = [];
    for (var i = 0; i < recs.length; i++) {
      toDelete.push(recs[i].id);
    }
    if (toDelete.length > 0) {
      Logger.log('AI FAQs: deleting ' + toDelete.length + ' old FAQs for Trip ' + tripId);
      toDelete.forEach(function(id) {
        try { airtableDelete_(FAQS_IMPROVEMENT_TABLE, id); } catch (e) { Logger.log('AI FAQs: failed to delete FAQ ' + id + ' — ' + e.message); }
      });
    }
  } catch (e) {
    Logger.log('AI FAQs: error deleting old FAQs for Trip ' + tripId + ': ' + e.message);
  }
}

/**
 * Ensure minimum FAQ count by adding defaults if needed
 */
function ensureMinimumFaqs_(faqs, ctx) {
  if (faqs.length >= MIN_FAQS_COUNT) return faqs;
  
  var added = 0;
  var inc = (ctx && ctx.includesForFaq && ctx.includesForFaq.length) ? ctx.includesForFaq : (ctx && ctx.includes ? ctx.includes : []);
  if (inc && inc.length) {
    faqs.push({
      question: "What is included in the tour price?",
      answer: "What's included is listed on this page under What's Included."
    });
    added++;
  }
  if (added) Logger.log('AI FAQs: added ' + added + ' context-supported FAQs (no generic padding)');
  return faqs;
}

function fetchRecordsByTripLocal_(tableName, linkFieldName, tripId, tripNumber, pageSize) {
  var records = [];
  try {
    if (tripNumber) {
      var pA = { filterByFormula: "FIND('" + String(tripNumber).replace(/'/g, "\\'") + "', ARRAYJOIN({" + linkFieldName + "}))", pageSize: pageSize || 100 };
      var rA = airtableGet_(tableName, pA);
      records = rA && rA.records ? rA.records : [];
    }
    if (!records.length) {
      var pB = { filterByFormula: "FIND('" + String(tripId).replace(/'/g, "\\'") + "', ARRAYJOIN({" + linkFieldName + "}))", pageSize: pageSize || 100 };
      var rB = airtableGet_(tableName, pB);
      records = rB && rB.records ? rB.records : [];
    }
  } catch (e) {}
  return records;
}

/**
 * Update trip FAQs status
 */
function updateTripFaqsStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[FAQS_STATUS_FIELD] = status;
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

/************************************************************
 * TRIGGER SETUP
 ************************************************************/
function createAiFaqsEnhancerTrigger() {
  ScriptApp.newTrigger('runAiFaqsEnhancementBatch')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('AI FAQs: Trigger created to run every hour.');
}
