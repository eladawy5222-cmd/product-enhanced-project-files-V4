const { sleep } = require('../core/runtime')
const { escapeFormulaValue } = require('../core/airtable-client')

let airtable
let http
let config
let CONFIG
let logger
let lock
let store
let aiProvider

function initHighlightsEnhancer(options) {
  if (!options) throw new Error('createHighlightsEnhancer: missing options')
  airtable = options.airtable
  http = options.http
  config = options.config
  logger = options.logger
  lock = options.lock
  store = options.store
  aiProvider = options.aiProvider

  if (!airtable) throw new Error('createHighlightsEnhancer: missing options.airtable')
  if (!http) throw new Error('createHighlightsEnhancer: missing options.http')
  if (!config) throw new Error('createHighlightsEnhancer: missing options.config')
  if (!logger) throw new Error('createHighlightsEnhancer: missing options.logger')
  if (!store) throw new Error('createHighlightsEnhancer: missing options.store')
  if (!aiProvider) throw new Error('createHighlightsEnhancer: missing options.aiProvider')

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
      const name = String(f.Title || f.AddOn || f.Name || '').trim()
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
 * TRIP-LEVEL AI HIGHLIGHTS GENERATOR (full rebuild + random)
 *
 * - التحكم من جدول Trips بحقل AI_Highlights_Status
 * - لكل Trip = Pending:
 *    1) يمسح كل سجلاتها من جدول "Highlights Improvement With AI"
 *    2) يجمع سياق الرحلة من كل الجداول
 *    3) يختار رقم عشوائي بين 5 و 10 كهدف للهايلايتس
 *    4) يولّد الهايلايتس الجديدة باستخدام كل مصادر الرحلة
 *    5) يملأ Order بناء على TripHighlights لو موجود
 ************************************************************/

var TRIPS_TABLE                  = 'Trips';
var HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
var TRIP_HIGHLIGHTS_TABLE        = 'TripHighlights';

// الحد الأدنى والأقصى لعدد الهايلايت لكل رحلة
var MIN_HIGHLIGHTS_PER_TRIP      = 5;
var MAX_HIGHLIGHTS_PER_TRIP      = 10;

// اسم حقل الحالة في جدول Trips
var TRIP_AI_STATUS_FIELD         = 'AI_Highlights_Status';

// عدد الرحلات في كل تشغيل للباتش
var AI_TRIPS_BATCH_LIMIT         = 1;  // Process one trip at a time

/************************************************************
 * ENTRY POINT
 ************************************************************/
async function runAiHighlightsEnhancementBatch() {
  log('AI Highlights (TRIP-level): starting batch...');

  try {
    const trips = await fetchTripsNeedingHighlights_(AI_TRIPS_BATCH_LIMIT)

    if (!trips || !trips.length) {
      log('AI Highlights: no Trips with ' + TRIP_AI_STATUS_FIELD + " = 'Pending'.");
      return;
    }

    for (let t = 0; t < trips.length; t++) {
      const tripRec = trips[t]
      const tripId = tripRec.id
      const tripFields = tripRec.fields || {}

      log('AI Highlights: processing Trip ' + tripId);

      // نعلّم الرحلة إنها تحت المعالجة
      await updateTripAiStatus_(tripId, 'Processing')

      try {
        /****************************************************
         * 1) حذف أي هايلايتس قديمة للرحلة من جدول التحسين
         ****************************************************/
        await deleteAiHighlightsForTrip_(tripId, tripFields.TripID || '')

        /****************************************************
         * 2) بناء سياق الرحلة من كل الجداول
         ****************************************************/
        var ctx = await buildTripLevelContext_(tripId, tripFields)

        /****************************************************
         * 3) بعد الحذف، جلب الهايلايتس الموجودة (غالبًا صفر)
         ****************************************************/
        var existingAiHighlightsSet  = await fetchExistingAiHighlightsForTrip_(tripId)
        var existingAiTexts          = await fetchExistingAiHighlightsTextForTrip_(tripId)

        /****************************************************
         * 4) تحديد عدد الهايلايت المطلوب (عشوائي من 5 إلى 10)
         ****************************************************/
        var currentCount = existingAiTexts.length;

        var target = getRandomIntInclusive_(MIN_HIGHLIGHTS_PER_TRIP, MAX_HIGHLIGHTS_PER_TRIP);

        log('AI Highlights: Trip ' + tripId +
                   ' random target AI highlights = ' + target);

        if (currentCount >= target) {
          log('AI Highlights: Trip ' + tripId +
                     ' already has ' + currentCount +
                     ' AI highlights (>= target ' + target + '). Marking as Done.');
          await updateTripAiStatus_(tripId, 'Done')
          continue;
        }

        var toGenerate = target - currentCount;
        log('AI Highlights: Trip ' + tripId +
                   ' needs ' + toGenerate + ' new highlights (current ' +
                   currentCount + ', target ' + target + ').');

        /****************************************************
         * 5) حساب قيم Order الجديدة من TripHighlights
         ****************************************************/
        var newOrders = await computeOrdersForNewHighlights_(tripId, toGenerate)
        log('AI Highlights: Trip ' + tripId +
                   ' new Order slots = ' + JSON.stringify(newOrders));

        /****************************************************
         * 6) توليد الهايلايتس الجديدة
         ****************************************************/
        var hadError = false;

        for (var i = 0; i < toGenerate; i++) {
          var orderVal = newOrders[i];  // ممكن يكون undefined في حالات قليلة
          var success = false;
          var lastError = null;
          var maxRetries = 3;

          for (var attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // نحدّث الـ context بآخر الهايلايتس الموجودة
              ctx.existingHighlightsAi = existingAiTexts.join("\n");

              var prompt   = buildHighlightAiPrompt_(ctx);
              var aiResult = await callAi_(prompt)

              if (!aiResult || typeof aiResult !== 'object') {
                throw new Error('Invalid AI result (not an object).');
              }

              var aiHighlight = aiResult.AI_Highlight || aiResult.ai_highlight || '';
              if (!aiHighlight) {
                throw new Error('AI result missing "AI_Highlight" field.');
              }

              var norm = normalizeText_(aiHighlight);
              if (!norm) {
                throw new Error('Empty AI highlight after normalization.');
              }
              if (existingAiHighlightsSet[norm]) {
                throw new Error('Duplicate highlight detected for this trip.');
              }

              var newId = await createAiHighlightForTrip_(tripId, aiHighlight, orderVal)

              log(
                'AI Highlights: created AI highlight record ' +
                newId + ' for Trip ' + tripId +
                ' with Order=' + orderVal
              );

              existingAiHighlightsSet[norm] = true;
              existingAiTexts.push(aiHighlight);
              success = true;
              break; // Success, exit retry loop

            } catch (eOne) {
              lastError = eOne;
              if (eOne.message.indexOf('Duplicate') !== -1) {
                log('AI Highlights: duplicate detected (Order=' + orderVal + ', Attempt ' + attempt + '), retrying...');
              } else {
                log('AI Highlights: error generating (Order=' + orderVal + ', Attempt ' + attempt + ') — ' + eOne.message);
              }
            }
          }

          if (!success) {
            hadError = true;
            log('AI Highlights: failed to generate highlight for Order ' + orderVal + 
                       ' after ' + maxRetries + ' attempts. Last error: ' + (lastError ? lastError.message : 'unknown'));
          }
        }

        /****************************************************
         * 7) تحديث حالة الرحلة بعد انتهاء المحاولة
         ****************************************************/
        if (!hadError && existingAiTexts.length >= MIN_HIGHLIGHTS_PER_TRIP) {
          await updateTripAiStatus_(tripId, 'Done')
        } else if (existingAiTexts.length < MIN_HIGHLIGHTS_PER_TRIP) {
          await updateTripAiStatus_(tripId, 'Error')
        } else {
          await updateTripAiStatus_(tripId, 'Error')
        }

      } catch (tripErr) {
        log('AI Highlights: fatal error at trip level ' +
                   tripId + ' — ' + tripErr.message);
        await updateTripAiStatus_(tripId, 'Error')
      }
    }

  } catch (e) {
    log('AI Highlights: fatal batch error — ' + e.message);
  }

  log('AI Highlights (TRIP-level): batch finished.');
}

/************************************************************
 * TRIGGER CREATOR
 ************************************************************/
async function createAiHighlightsTripLevelTrigger() {
  log('AI Highlights: createAiHighlightsTripLevelTrigger is not supported in Node runtime')
}

/************************************************************
 * HELPERS: Trips
 ************************************************************/

async function fetchTripsNeedingHighlights_(limit) {
  var params = {
    filterByFormula: "{" + TRIP_AI_STATUS_FIELD + "} = 'Pending'",
    maxRecords:      limit || 10
  };
  var res = await airtableGet_(TRIPS_TABLE, params)
  if (!res || !res.records) return [];
  return res.records;
}

async function updateTripAiStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[TRIP_AI_STATUS_FIELD] = status;
  await airtableUpdate_(TRIPS_TABLE, tripId, fields)
}

/************************************************************
 * HELPERS: حذف كل الهايلايتس القديمة للرحلة
 * فلترة في JS باستخدام Trip كـ array من recordIds
 ************************************************************/

async function deleteAiHighlightsForTrip_(tripId, tripNumber) {
  if (!tripId) return;

  while (true) {
    var params = tripNumber ? {
      filterByFormula: "FIND('" + tripNumber + "', ARRAYJOIN({Trip}))",
      pageSize: 100
    } : {
      filterByFormula: "FIND('" + tripId + "', ARRAYJOIN({Trip}))",
      pageSize: 100
    };
    var res = await airtableGet_(HIGHLIGHTS_IMPROVEMENT_TABLE, params)
    var recs = res && res.records ? res.records : [];
    if (!recs.length) {
      log('AI Highlights: no old AI highlights to delete for Trip ' + tripId);
      break;
    }
    var toDelete = recs.map(function(r){ return r.id; });
    log('AI Highlights: deleting ' + toDelete.length + ' old AI highlights for Trip ' + tripId);
    try {
      await airtableBatchDelete_(HIGHLIGHTS_IMPROVEMENT_TABLE, toDelete)
    } catch (e) {
      for (var j = 0; j < toDelete.length; j++) {
        var recId = toDelete[j];
        try {
          await airtableDelete_(HIGHLIGHTS_IMPROVEMENT_TABLE, recId)
        } catch (inner) {
          log('AI Highlights: failed to delete AI highlight record ' + recId + ' — ' + inner.message)
        }
      }
    }
  }
}

/************************************************************
 * HELPERS: Highlights Improvement With AI
 ************************************************************/

// Set بالنصوص الموجودة (normalized) عشان نمنع التكرار
async function fetchExistingAiHighlightsForTrip_(tripId) {
  var set = {};
  if (!tripId) return set;

  var res  = await airtableGet_(HIGHLIGHTS_IMPROVEMENT_TABLE, { pageSize: 100 })
  var recs = res && res.records ? res.records : [];

  for (var i = 0; i < recs.length; i++) {
    var r     = recs[i];
    var f     = r.fields || {};
    var links = f.Trip;
    if (!Array.isArray(links) || links.indexOf(tripId) === -1) continue;

    var t = (f.AI_Highlight || '').toString();
    var n = normalizeText_(t);
    if (n) set[n] = true;
  }
  return set;
}

// Array بالنصوص الموجودة (AI_Highlight) لنفس الرحلة
async function fetchExistingAiHighlightsTextForTrip_(tripId) {
  var out = [];
  if (!tripId) return out;

  var res  = await airtableGet_(HIGHLIGHTS_IMPROVEMENT_TABLE, { pageSize: 100 })
  var recs = res && res.records ? res.records : [];

  for (var i = 0; i < recs.length; i++) {
    var r     = recs[i];
    var f     = r.fields || {};
    var links = f.Trip;
    if (!Array.isArray(links) || links.indexOf(tripId) === -1) continue;

    var t = (f.AI_Highlight || '').toString().trim();
    if (t) out.push(t);
  }
  return out;
}

// Set بقيم Order المستخدمة بالفعل في جدول التحسين لنفس الرحلة
async function fetchExistingAiOrdersForTrip_(tripId) {
  var set = {};
  if (!tripId) return set;

  var res  = await airtableGet_(HIGHLIGHTS_IMPROVEMENT_TABLE, { pageSize: 100 })
  var recs = res && res.records ? res.records : [];

  for (var i = 0; i < recs.length; i++) {
    var r     = recs[i];
    var f     = r.fields || {};
    var links = f.Trip;
    if (!Array.isArray(links) || links.indexOf(tripId) === -1) continue;

    var ord = f.Order;
    if (typeof ord === 'number') {
      set[ord] = true;
    }
  }
  return set;
}

// إنشاء سطر جديد للهايلايت في جدول Highlights Improvement With AI
async function createAiHighlightForTrip_(tripId, aiHighlightText, orderVal) {
  var nowIso = new Date().toISOString();

  if (typeof orderVal !== 'number') {
    orderVal = null;
  }

  var fieldsCreate = {
    Trip:           [tripId],
    AI_Highlight:   aiHighlightText,
    AI_Status:      'Done',
    AI_LastUpdated: nowIso
  };

  if (orderVal !== null) {
    fieldsCreate.Order = orderVal;
  }

  var created = await airtableCreate_(HIGHLIGHTS_IMPROVEMENT_TABLE, fieldsCreate)
  return created && created.records && created.records.length
    ? created.records[0].id
    : (created && created.id ? created.id : null);
}

/************************************************************
 * TripHighlights: النص + Order (فلترة في JS على Trip)
 ************************************************************/

async function collectTripRawHighlightsText_(tripId) {
  var out = [];
  if (!tripId) return out;

  var res  = await airtableGet_(TRIP_HIGHLIGHTS_TABLE, { pageSize: 100 })
  var recs = res && res.records ? res.records : [];

  for (var i = 0; i < recs.length; i++) {
    var r     = recs[i];
    var f     = r.fields || {};
    var links = f.Trip;
    if (!Array.isArray(links) || links.indexOf(tripId) === -1) continue;

    var v = (f.Highlight || '').toString().trim(); // اسم الحقل من السكريم شوت
    if (v) out.push(v);
  }

  return out;
}

async function fetchTripRawHighlightOrders_(tripId) {
  var orders = [];
  if (!tripId) return orders;

  var res  = await airtableGet_(TRIP_HIGHLIGHTS_TABLE, { pageSize: 100 })
  var recs = res && res.records ? res.records : [];

  for (var i = 0; i < recs.length; i++) {
    var r     = recs[i];
    var f     = r.fields || {};
    var links = f.Trip;
    if (!Array.isArray(links) || links.indexOf(tripId) === -1) continue;

    var ord = f.Order;
    if (typeof ord === 'number') {
      orders.push(ord);
    }
  }

  orders.sort(function(a, b) { return a - b; });
  return orders;
}

/************************************************************
 * ORDER SLOT COMPUTATION
 ************************************************************/

/**
 * يعيد ترقيم الهايلايتس الجديدة من 1 إلى N بشكل متسلسل
 * بدون الاعتماد على أي Orders سابقة
 */
async function computeOrdersForNewHighlights_(tripId, toGenerate) {
  var result = [];
  if (toGenerate <= 0) return result;

  for (var i = 1; i <= toGenerate; i++) {
    result.push(i);
  }
  return result;
}


/************************************************************
 * HELPERS: تجميع النصوص من باقي الجداول (فلترة في JS)
 ************************************************************/

async function collectLinkedTextFromTable_(tableName, textFieldNames, tripId, pageSize) {
  var out = [];
  if (!tripId) return out;

  var res  = await airtableGet_(tableName, { pageSize: pageSize || 100 })
  var recs = res && res.records ? res.records : [];

  for (var i = 0; i < recs.length; i++) {
    var r     = recs[i];
    var f     = r.fields || {};
    var links = f.Trip;
    if (!Array.isArray(links) || links.indexOf(tripId) === -1) continue;

    for (var j = 0; j < textFieldNames.length; j++) {
      var fn = textFieldNames[j];
      var v  = (f[fn] || '').toString().trim();
      if (v) out.push(v);
    }
  }

  return out;
}

// ItinerarySteps + Itinerary Improvement With AI
async function collectItineraryTextForTrip_(tripId) {
  var rawSteps = await collectLinkedTextFromTable_(
    'ItinerarySteps',
    ['StepTitle', 'StepDescription'],
    tripId,
    100
  );

  var improvedSteps = await collectLinkedTextFromTable_(
    'Itinerary Improvement With AI',
    ['AI_Step_Title', 'AI_Step_Description'],
    tripId,
    100
  );

  return rawSteps.concat(improvedSteps);
}

// TripIncludes + TripIncludes Improvement With AI
async function collectTripIncludesText_(tripId) {
  var rawInc = await collectLinkedTextFromTable_(
    'TripIncludes',
    ['IncludeItem'],
    tripId,
    50
  );

  var improvedInc = await collectLinkedTextFromTable_(
    'TripIncludes Improvement With AI',
    ['AI_IncludeItem', 'AI_IncludeText'],
    tripId,
    50
  );

  return rawInc.concat(improvedInc);
}

// TripExcludes + TripExcludes Improvement With AI
async function collectTripExcludesText_(tripId) {
  var rawEx = await collectLinkedTextFromTable_(
    'TripExcludes',
    ['ExcludeItem'],
    tripId,
    50
  );

  var improvedEx = await collectLinkedTextFromTable_(
    'TripExcludes Improvement With AI',
    ['AI_ExcludeItem', 'AI_ExcludeText'],
    tripId,
    50
  );

  return rawEx.concat(improvedEx);
}

// TripFAQs + FAQs Improvement With AI
async function collectTripFaqsText_(tripId) {
  var rawFaqs = await collectLinkedTextFromTable_(
    'TripFAQs',
    ['Question', 'Answer'],
    tripId,
    100
  );

  var improvedFaqs = await collectLinkedTextFromTable_(
    'FAQs Improvement With AI',
    ['AI_Question', 'AI_Answer'],
    tripId,
    100
  );

  return rawFaqs.concat(improvedFaqs);
}

// AddOns
async function collectTripAddOnsText_(tripId) {
  return collectLinkedTextFromTable_(
    'AddOns',
    ['AddOnTitle', 'AddOnDescription'],
    tripId,
    50
  );
}

// PickupLocations
async function collectPickupLocationsText_(tripId) {
  return collectLinkedTextFromTable_(
    'PickupLocations',
    ['LocationName', 'LocationNotes'],
    tripId,
    50
  );
}

// Packages
async function collectPackagesText_(tripId) {
  return collectLinkedTextFromTable_(
    'Packages',
    ['PackageName', 'ShortDescription'],
    tripId,
    50
  );
}

// TripDetails
async function collectTripDetailsText_(tripId) {
  return collectLinkedTextFromTable_(
    'TripDetails',
    ['DetailTitle', 'DetailText'],
    tripId,
    50
  );
}

/************************************************************
 * BUILD TRIP CONTEXT
 ************************************************************/

async function buildTripLevelContext_(tripId, tripFields) {
  var ctx = {
    tripTitle:       '',
    tripOverview:    '',
    tripDescription: '',
    tripSeoKeywords: '',

    rawHighlights:   '',
    itineraryText:   '',
    includesText:    '',
    excludesText:    '',
    addonsText:      '',
    pickupText:      '',
    packagesText:    '',
    detailsText:     '',
    faqsText:        '',
    existingHighlightsAi: '',
    requiredAngle:   ''
  };

  // من جدول Trips
  ctx.tripTitle       = (tripFields.Title || '').toString();
  ctx.tripOverview    = (tripFields.Overview_Section_Title || '').toString();
  ctx.tripDescription = (tripFields.Trip_Description || '').toString();

  var seoList = tripFields.SEO_FocusKeywords_List || '';
  if (Array.isArray(seoList)) {
    ctx.tripSeoKeywords = seoList.join(', ');
  } else {
    ctx.tripSeoKeywords = seoList || '';
  }

  var U = await buildUnifiedTripContext_(tripId, tripFields)

  // 🆕 جلب البيانات المحسنة من جدول "Improvement With AI" (الوصف العام المحسن)
  var tripNumber = tripFields && tripFields.TripID ? tripFields.TripID : ''
  var mainAiRec = await fetchMainAiImprovementForTrip_(tripId, tripNumber)
  if (mainAiRec) {
    var f = mainAiRec.fields || {};
    // لو فيه وصف محسن، نستخدمه بدل الوصف الخام أو نضيفه
    var aiDesc = (f.AI_Trip_Description || '').toString();
    var aiOver = (f.AI_Overview_Section_Title || '').toString();
    var aiFocusKeyword = (f.AI_SEO_FocusKeywords || '').toString();  // 🆕 Focus Keyword
    
    if (aiDesc) {
      // نستخدم الوصف المحسن لأنه أدق وأشمل
      ctx.tripDescription = "IMPROVED DESCRIPTION:\n" + aiDesc + "\n\n(Original Raw):\n" + ctx.tripDescription;
    }
    if (aiOver) {
      ctx.tripOverview = aiOver + " (Original: " + ctx.tripOverview + ")";
    }
    if (aiFocusKeyword) {
      ctx.focusKeyword = aiFocusKeyword;  // 🆕 Add to context
    }
  }

  ctx.rawHighlights = U.highlightsText;
  ctx.itineraryText = U.itineraryText;
  ctx.includesText  = U.includesText;
  ctx.excludesText  = U.excludesText;
  ctx.addonsText    = U.addonsText;
  ctx.pickupText    = U.pickupText;
  ctx.packagesText  = U.packagesText;
  ctx.detailsText   = U.detailsText;
  ctx.faqsText      = U.faqsText;

  return ctx;
}

/**
 * جلب سجل واحد من جدول Improvement With AI مرتبط بالرحلة
 */
async function fetchMainAiImprovementForTrip_(tripId, tripNumber) {
  if (!tripId) return null
  var tableName = 'Improvement With AI'
  var conditions = []
  conditions.push("FIND('" + String(tripId).replace(/'/g, "\\'") + "', ARRAYJOIN({Trip}))")
  if (tripNumber) {
    conditions.push("FIND('" + String(tripNumber).replace(/'/g, "\\'") + "', ARRAYJOIN({Trip}))")
  }
  var formula = conditions.length > 1 ? 'OR(' + conditions.join(', ') + ')' : conditions[0]
  var params = { filterByFormula: formula, maxRecords: 1 }
  var res = await airtableGet_(tableName, params)
  if (!res || !res.records || !res.records.length) return null
  return res.records[0]
}

/************************************************************
 * PROMPT BUILDER
 ************************************************************/

function buildHighlightAiPrompt_(ctx) {
  var tripTitle        = ctx.tripTitle || '';
  var tripOverview     = ctx.tripOverview || '';
  var tripDescription  = ctx.tripDescription || '';
  var tripSeoKeywords  = ctx.tripSeoKeywords || '';
  var focusKeyword     = ctx.focusKeyword || '';  // 🆕 AI-generated Focus Keyword

  var rawHighlights    = ctx.rawHighlights || '';
  var itineraryText    = ctx.itineraryText || '';
  var includesText     = ctx.includesText || '';
  var excludesText     = ctx.excludesText || '';
  var addonsText       = ctx.addonsText || '';
  var pickupText       = ctx.pickupText || '';
  var packagesText     = ctx.packagesText || '';
  var detailsText      = ctx.detailsText || '';
  var faqsText         = ctx.faqsText || '';

  var existingHighlightsAi = ctx.existingHighlightsAi || '';

  var prompt = 
     "You are a high-conversion travel copywriter and SEO specialist for Egypt tours. Write punchy, premium-sounding highlights that feel non-repetitive and genuinely useful.\n\n" + 
 
     "TASK:\n" + 
     "Create ONE NEW tour highlight sentence for this trip.\n\n" + 
 
     "HARD OUTPUT RULES:\n" + 
     "- Write in fluent, natural ENGLISH.\n" + 
     "- EXACTLY 15–25 words.\n" + 
     "- ONE sentence only. No line breaks.\n" + 
     "- No HTML, no markdown, no bullet symbols, no quotes.\n" + 
     "- Must be specific and vivid, not generic.\n\n" + 
 
     "STRICT FACT CHECKING (CRITICAL):\n" +
     "- You must ONLY use locations, activities, and details explicitly mentioned in the provided context (Itinerary, Includes, Description).\n" +
     "- Do NOT hallucinate or invent visits to Saqqara, Memphis, Dahshur, Step Pyramid, or any other site NOT listed in the input context.\n" +
     "- If the context says 'Pyramids of Giza', do NOT add 'Saqqara' or 'Memphis' just because they are nearby.\n" +
     "- Verify every location and activity against the 'TRIP CORE INFO' and 'ITINERARY' sections before writing.\n\n" +

     "MUSEUM DISTINCTION & LOGIC (CRITICAL):\n" +
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

     "NON-REPETITION (CRITICAL):\n" + 
     "Your highlight MUST be clearly different in MEANING and WORDING from the existing AI highlights.\n" + 
     "Avoid repeating the same core idea (even with synonyms). Examples of repeated ideas:\n" + 
     "- transport/pickup convenience\n" + 
     "- market shopping/bargaining\n" + 
     "- mosque architecture\n" + 
     "- relaxing café/drinks\n" + 
     "If an idea already appears, choose a DIFFERENT angle from the Angle Bank below.\n\n" + 
     
     "TOPIC & ENTITY DIVERSITY (MANDATORY):\n" + 
     "- Do NOT reuse the same MAIN SUBJECT more than once across the trip highlights.\n" + 
     "  Main subjects include: a specific mosque, the market bargaining, artisans/workshops, café/tea break, spices/smells, bakeries/food.\n" + 
     "- Do NOT mention the same PLACE name twice across highlights (e.g., Al Mustafa Mosque, El Sahaba Mosque, Old Market, New Panorama Café).\n" + 
     "- If a place is already used in existing highlights, pick a different place OR describe a different part of the experience without naming it again.\n" + 
     "- Avoid repeating the same 'experience pattern' like: 'hidden workshops', 'local guide reveals', 'learn bargaining tips' in multiple lines.\n\n" + 
     
     "PLACE UNIQUENESS (MANDATORY):\n" + 
     "- Each physical place (café, market area, terrace, workshop, alley, quarter) may appear ONLY ONCE per trip.\n" + 
     "- If a place name or clear reference appears in existing highlights, you MUST avoid mentioning it again.\n" + 
     "- Do NOT paraphrase the same place using synonyms (e.g., 'terrace', 'balcony', 'café seating').\n" + 
     "- Avoid repeating the same area label (e.g., 'historic quarter') more than twice.\n" + 
     "- Use varied references or implied context instead.\n\n" + 
     
     "EXPERIENCE PATTERN DIVERSITY (CRITICAL):\n" + 
     "- Do NOT repeat the same core experience pattern.\n" + 
     "Examples of repeated patterns:\n" + 
     "- watching artisans craft items\n" + 
     "- photographing sunsets or views\n" + 
     "- sipping tea or drinks in cafés\n" + 
     "- wandering market alleys\n" + 
     "If a pattern already exists, choose a completely different traveler action.\n\n" + 

     "ANGLE BANK (pick ONE and commit to it):\n" + 
     "A) Iconic Landmark Moment (specific site + what you do + why it matters)\n" + 
     "B) Local Interaction (guide/locals/artisans/story)\n" + 
     "C) Food & Atmosphere (meal + setting + feeling)\n" + 
     "D) Cultural Insight (history/architecture/customs explained)\n" + 
     "E) Time-Saving / Ease (only if explicitly stated in context)\n" + 
     "F) Photo-Worthy Scene (viewpoint/lighting/setting)\n" + 
     "G) Comfort & Pace (small-group/relaxed pace ONLY if stated)\n" + 
     "H) Unique Add-on / Option (ONLY if stated)\n" + 
     "REQUIRED ANGLE FOR THIS HIGHLIGHT: " + (ctx.requiredAngle || "Choose any one angle") + "\n\n" + 
 
     (focusKeyword ? "SEO:\n- Naturally include the Focus Keyword if it fits the chosen angle (never force it).\n\n" : "") + 
 
     "STYLE (make it sell):\n" + 
     "- Start with a strong action verb.\n" + 
     "- Use concrete nouns (place names, landmark names, market names) ONLY if present in the context.\n" + 
     "- Add one sensory/emotional phrase (sound, scent, view, atmosphere) without clichés.\n" + 
     "- Emphasize traveler benefit (ease, authenticity, memorable moments, confidence, insight).\n\n" + 
 
     "BANNED / AVOID:\n" + 
     "- Overused clichés: 'unforgettable', 'once-in-a-lifetime', 'ancient wonders' (unless you add a concrete detail).\n" + 
     "- Prices, discounts, booking/cancellation, contact details.\n" + 
     "- Specific times (8:00 AM) unless stated.\n" + 
     "- Transport modes (flight/bus/private car/boat) unless explicitly stated.\n" + 
     "- Inventing new cities, sites, services, or guarantees not in the context (e.g. do not add Saqqara if not in itinerary).\n\n" + 
 
     "QUALITY GATE (self-check before finalizing):\n" + 
     "☐ 15–25 words exactly\n" + 
     "☐ Different angle vs existing highlights\n" + 
     "☐ Uses ONLY context facts (NO hallucinations)\n" + 
     "☐ Sounds premium and persuasive\n\n" + 
 
     "TRIP CORE INFO:\n" + 
     "Trip title: " + tripTitle + "\n" + 
     "Overview section title: " + tripOverview + "\n" + 
     (focusKeyword ? "Focus Keyword: " + focusKeyword + "\n" : "") + 
     "Trip description:\n" + tripDescription + "\n\n" + 
 
     "RAW HIGHLIGHTS (supplier text):\n" + rawHighlights + "\n\n" + 
     "ITINERARY:\n" + itineraryText + "\n\n" + 
     "INCLUDES:\n" + includesText + "\n\n" + 
     "EXCLUDES:\n" + excludesText + "\n\n" + 
     "ADD-ONS:\n" + addonsText + "\n\n" + 
     "PICKUP LOCATIONS:\n" + pickupText + "\n\n" + 
     "PACKAGES / OPTIONS:\n" + packagesText + "\n\n" + 
     "TRIP DETAILS:\n" + detailsText + "\n\n" + 
     "FAQs:\n" + faqsText + "\n\n" + 
     "SEO / keywords:\n" + tripSeoKeywords + "\n\n" + 
 
     "RULES:\n" +
     "USED SUBJECTS & PLACES (avoid repeating them):\n" + 
     existingHighlightsAi + "\n\n" + 
     "- Create a NEW highlight that is clearly different in meaning and wording from all existing highlights above.\n" + 
 
     "OUTPUT FORMAT:\n" + 
     "Return ONLY a valid JSON object with exactly this structure:\n" + 
     "{\n" + 
     '  \"AI_Highlight\": \"your new highlight here\"\n' + 
     "}\n";

  return prompt;
}

/************************************************************
 * NORMALIZATION + RANDOM HELPERS
 ************************************************************/

function normalizeText_(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\.,;:!\?'"،]+$/g, '')
    .trim();
}

/**
 * يرجّع رقم صحيح عشوائي بين min و max (شامل الطرفين)
 */
function getRandomIntInclusive_(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * جلب الإضافات المحسنة من جدول AddOns Improvement With AI (Stage 2)
 */
async function fetchImprovedAddOnsForTrip_(tripId) {
  if (!tripId) return '';
  
  var tableName = 'AddOns Improvement With AI';
  var params = {
    filterByFormula: "ARRAYJOIN({Trip}) = '" + tripId + "'",
    pageSize: 50
  };
  
  try {
    var res = await airtableGet_(tableName, params)
    if (!res || !res.records || !res.records.length) return '';
    
    var addOnsText = res.records.map(function(r) {
      var f = r.fields || {};
      var title = f.AddOnTitle || f.AI_AddOn_Title || '';
      var desc = f.AI_AddOn_Description || '';
      return title + (desc ? ': ' + desc : '');
    }).join('\n');
    
    return addOnsText;
  } catch (e) {
    log('fetchImprovedAddOnsForTrip_ error: ' + e.message);
    return '';
  }
}

function createHighlightsEnhancer(options) {
  let inited = false
  async function ensureInit() {
    if (inited) return
    initHighlightsEnhancer(options)
    inited = true
  }

  return {
    runAiHighlightsEnhancementBatch: async (...args) => {
      await ensureInit()
      return runAiHighlightsEnhancementBatch(...args)
    }
  }
}

module.exports = { createHighlightsEnhancer }
