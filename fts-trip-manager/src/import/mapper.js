/************************************************************
 * MAPPER — from WPTE JSON "trip" → Airtable fields
 * Adapted to the actual structure from fts-trip-api (fts/v1/trips)
 ************************************************************/

/**
 * Safe getter for nested paths: get_(obj, "a.b.c", defaultVal)
 */
function get_(obj, path, def) {
  if (!obj) return def;
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur == null) return def;
    cur = cur[parts[i]];
  }
  return cur == null ? def : cur;
}

var TextUtils = (function() {
  function htmlToPlain(html) {
    if (!html) return '';
    var text = String(html)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  }

  return {
    htmlToPlain: htmlToPlain
  };
})();

/**
 * Parse comma-separated string into array of trimmed values.
 */
function parseCSV_(s) {
  if (!s) return [];
  return String(s)
    .split(',')
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x; });
}

/**
 * Build main Trips fields from a WPTE trip JSON.
 * Returns an object of {fieldName: value}
 */
function mapTripToTripsRow_(trip) {
  var f = {};

  var core    = trip.core    || {};
  var general = trip.general || {};
  var meta    = trip.meta    || {};

  var wpteSetting = get_(meta, 'wp_travel_engine_setting', {}) || {};

  // --- SEO ---
  var seoRank  = get_(trip, 'seo.rank_math', {})  || {};
  var metaRank = get_(trip, 'meta.rank_math', {}) || {};
  var seo = {};
  for (var k in metaRank) { if (metaRank.hasOwnProperty(k)) seo[k] = metaRank[k]; }
  for (var k2 in seoRank) { if (seoRank.hasOwnProperty(k2)) seo[k2] = seoRank[k2]; }

  // --- Trip Basic ---
  var tripId = core.id;
  f.TripID = String(tripId || '');

  // TripCode
  var tripCode =
    wpteSetting.trip_code ||
    general.trip_code     ||
    core.trip_code        || '';
  f.TripCode = String(tripCode || '');

  f.Title  = core.title || '';
  f.Slug   = core.slug  || '';
  f.Permalink = core.permalink || core.link || '';
  f.StatusWorkflow = core.status || '';

  // --- Featured image ---
  var feat = trip.featured_image || {};
  if (feat && (feat.url || feat.src)) {
    f.FeaturedImage = feat.url || feat.src;
  }

  // --- Gallery (attachment) ---
  var galleryArr = trip.gallery || [];
  if (Array.isArray(galleryArr) && galleryArr.length) {
    var attachments = galleryArr
      .map(function (g) {
        if (!g) return null;
        var u = g.url || g.src || '';
        if (!u) return null;
        return { url: u };
      })
      .filter(function (x) { return x; });

    if (attachments.length) {
      f.Gallery = attachments;
    }
  }

  // ==========================
  // Section Fields (6 الأساسية)
  // ==========================
  var tabContent = wpteSetting.tab_content || {};

  // 1) overview_section_title
  f.Overview_Section_Title = sanitizeTemplateTokens_(wpteSetting.overview_section_title || '');

  // 2) Trip Description (Tab 1)
  f.Trip_Description = sanitizeTemplateTokens_(tabContent['1_wpeditor'] || core.content_html || '');

  // 3) Itinerary Title
  f.Itinerary_Section_Title = sanitizeTemplateTokens_(wpteSetting.trip_itinerary_title || '');

  // 4) Itinerary Description
  f.Itinerary_Description =
    sanitizeTemplateTokens_(wpteSetting.trip_itinerary_description ||
    get_(general, 'raw.trip_itinerary_description', '') ||
    '');

  // 5) Why People Love This Trip - Title
  f.Why_People_Love_This_Trip_Section_Title = sanitizeTemplateTokens_(wpteSetting.tab_8_title || '');

  // 6) Tab 8 Content (HTML)
  f.Tab_Content = sanitizeTemplateTokens_(tabContent['8_wpeditor'] || '');
    // ==========================
  // Extra Section Titles
  // ==========================

  // 7) Trip Highlights Section Title
  f.Trip_Highlights_Section_Title = wpteSetting.trip_highlights_title || '';

  // 8) Trip Facts Section Title
  f.Trip_Facts_Section_Title = wpteSetting.trip_facts_title || '';


  // ==========================
  // FAQ + Cost Titles ONLY
  // ==========================

  // FAQ Section Title
  f.FAQ_Section_Title = wpteSetting.faq_section_title || '';

  // Cost Titles ONLY
  var cost = wpteSetting.cost || {};

  f.Cost_Section_Title  = wpteSetting.cost_tab_sec_title || '';
  f.Cost_Includes_Title = cost.includes_title || '';
  f.Cost_Excludes_Title = cost.excludes_title || '';

  // ==========================
  // Duration
  // ==========================
  var dur = general.duration || {};
  var dUnit = general.duration_type || '';
  f.Duration_Unit  = dUnit;

  // Direct mapping as requested: Duration_Hours = duration.hours
  f.Duration_Hours = dur.hours || '';
  f.Duration_Minutes = dur.minutes || '';

  // ==========================
  // Pricing
  // ==========================
  var pricing = trip.pricing || {};
  f.Price_From = pricing.actual_price || '';
  f.Currency   = pricing.currency     || '';

  // ==========================
  // SEO
  // ==========================
  f.SEO_Title       = seo.title       || f.Title || '';
  f.SEO_Description = seo.description || '';
  f.RankMathScore   = seo.seo_score   || seo.score || '';

  var focusKW = seo.focus_keyword || meta.rank_math_focus_keyword || '';
  var parsedKW = parseCSV_(focusKW);

  var agg = trip && trip._seoFocusKeywordsAggregate ? trip._seoFocusKeywordsAggregate : null;
  if (agg && Array.isArray(agg.list)) {
    f.SEO_FocusKeywords = agg.primary || (parsedKW.length > 0 ? parsedKW[0] : '');
    f.SEO_FocusKeywords_List = agg.list;
  } else {
    // Use the first keyword as the main Focus Keyword
    f.SEO_FocusKeywords      = parsedKW.length > 0 ? parsedKW[0] : '';
    f.SEO_FocusKeywords_List = parsedKW.length > 1 ? parsedKW.slice(1) : [];
  }

  // ==========================
  // Languages & Meals
  // ==========================
  var facts = get_(meta, 'wp_travel_engine_setting.trip_facts', null);
  if (!facts || Array.isArray(facts)) {
    f.Languages = [];
    f.Meals = '';
  } else {
    var langVal  = facts['12647846'] && facts['12647846']['12647846'] || '';
    var mealsVal = facts['69801669'] && facts['69801669']['69801669'] || '';
    f.Languages = parseCSV_(langVal);
    f.Meals     = mealsVal || '';
  }

  f.LastSynced = new Date().toISOString();
  return f;
}

/********************* CHILD MAPPERS *************************/

/**
 * TripHighlights table: each record has
 * - TripID (string)
 * - Highlight (long text)
 * - Order (number)
 *
 * We try general.raw.trip_highlights (new API structure).
 */
function extractHighlights_(trip) {
  var tripId = get_(trip, 'core.id', '');
  var arr = get_(trip, 'general.raw.trip_highlights', []) || [];
  if (!Array.isArray(arr)) arr = [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var h = arr[i];
    // In some versions it's {highlight_text:"..."}; in others it might be plain string.
    var text = '';
    if (h && typeof h === 'object') {
      text = h.highlight_text || h.title || '';
    } else if (typeof h === 'string') {
      text = h;
    }
    text = TextUtils.htmlToPlain(text);
    if (!text) continue;
    out.push({
      TripID: tripId,
      Highlight: text,
      Order: i + 1
    });
  }
  return out;
}

/**
 * Extract full Itinerary steps for a trip.
 * يعتمد على:
 *  trip.meta.wp_travel_engine_setting.itinerary
 *  trip.meta.wte_advanced_itinerary.advanced_itinerary
 *
 * بيرجع Array من Objects – كل Object = Step واحدة.
 */
function extractItinerarySteps_(trip) {
  var results = [];

  if (!trip || !trip.meta) {
    return results;
  }

  var meta = trip.meta || {};
  var wteSettings = meta.wp_travel_engine_setting || {};
  var itinerary = wteSettings.itinerary || {};

  // البيانات الأساسية
  var titles = itinerary.itinerary_title || {};            // { "1": "Starting/pickup location", ... }
  var labels = itinerary.itinerary_days_label || {};       // { "1": "Pickup", "2": "Drop-off", ... }
  var contents = itinerary.itinerary_content || {};        // { "1": "<p>Depends on ...</p>", ... }

  // البيانات المتقدمة (مدة – صور – Overnight – الخ)
  var wteAdvancedWrapper = meta.wte_advanced_itinerary || {};
  var advanced = wteAdvancedWrapper.advanced_itinerary || {};

  var durations        = advanced.itinerary_duration || {};           // { "1": "30", "2": "30", ... }
  var durationTypes    = advanced.itinerary_duration_type || {};      // { "1": "minute", "2": "minute", ... }
  var imageMaxCount    = advanced.itinerary_image_max_count || {};    // { "1": 0, "2": 0, ... }
  var images           = advanced.itinerary_image || {};              // { "1": [ ... ], "2": [ ... ] }
  var overnight        = advanced.overnight || {};                    // { "1": { at: "", altitude: "" }, ... }
  var mealsIncluded    = advanced.meals_included || [];               // غالبًا Array أو Object

  var tripId = (trip.core && trip.core.id) ? trip.core.id : trip.id;

  // نمشي على كل الـ keys (1,2,3,...) حسب العناوين
  Object.keys(titles).forEach(function (key) {
    var rawTitle   = titles[key] || '';
    var rawLabel   = labels[key] || '';
    var rawHtml    = contents[key] || '';

    var plainText  = stripHtml_(rawHtml);  // وصف بدون HTML
    var order      = parseInt(key, 10) || 0;

    var durRaw     = (durations && key in durations) ? String(durations[key]) : '';
    var durValue   = durRaw && !isNaN(durRaw) ? Number(durRaw) : null;
    var durUnit    = (durationTypes && durationTypes[key]) || '';

    var imgCount   = (imageMaxCount && key in imageMaxCount) ? imageMaxCount[key] : null;
    var stepImages = (images && images[key]) ? images[key] : [];
    if (!Array.isArray(stepImages)) {
      stepImages = [];
    }

    var overnightObj      = (overnight && overnight[key]) ? overnight[key] : {};
    var overnightAt       = overnightObj.at || '';
    var overnightAltitude = overnightObj.altitude || '';

    var mealsForStep = '';
    if (Array.isArray(mealsIncluded)) {
      // لو النظام بيخزن الوجبات كـ Array عامة لكل الرحلة – نحطها كما هي نص
      mealsForStep = mealsIncluded.join(', ');
    } else if (mealsIncluded && mealsIncluded[key]) {
      // لو فيه شكل per-step
      if (Array.isArray(mealsIncluded[key])) {
        mealsForStep = mealsIncluded[key].join(', ');
      } else {
        mealsForStep = String(mealsIncluded[key]);
      }
    }

    results.push({
      // أساسي لربط الجدول الفرعي بالرحلة
      TripID: tripId,

      // مفتاح داخلي (مثلاً "1" أو "2") – مفيد لو احتجت تتبع الترتيب الأصلي
      StepKey: key,

      // الترتيب الرقمي
      StepOrder: order,

      // بيانات العنوان / اللابل
      StepTitle: decodeHtml_(rawTitle),
      StepLabel: decodeHtml_(rawLabel),

      // الوصف
      StepDescription: plainText,          // نص بدون HTML – ممتاز لأيرتيبل و البحث
      StepDescriptionHtml: rawHtml,        // الخام لو حبيت تستعمله مستقبلاً في واجهة

      // المدة
      DurationValue: durValue,             // رقم (مثلاً 30)
      DurationRaw: durRaw,                 // نفس القيمة كما هي (نص)
      DurationUnit: durUnit,               // minute / hour / ...

      // الوجبات
      MealsIncluded: mealsForStep,
    });
  });

  // تأكيد الترتيب
  results.sort(function (a, b) {
    return (a.StepOrder || 0) - (b.StepOrder || 0);
  });

  return results;
}

/**
 * إزالة الـ HTML tags و الـ comments من النص
 */
function stripHtml_(html) {
  if (!html) return '';
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')  // نزيل تعليقات Gutenberg <!-- wp:... -->
    .replace(/<[^>]+>/g, ' ')         // نزيل كل الـ tags
    .replace(/\s+/g, ' ')             // نوحد المسافات
    .trim();
}

/**
 * فك ترميزات HTML البسيطة (لو ظهرت)
 */
function decodeHtml_(text) {
  if (!text) return '';
  var map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'"
  };
  return String(text).replace(/(&amp;|&lt;|&gt;|&quot;|&#039;)/g, function (m) {
    return map[m] || m;
  });
}



/**
 * TripFAQs
 * - TripID
 * - Question
 * - Answer
 *
 * New structure has:
 * meta.wp_travel_engine_setting.faq.faq_title[]
 * and older one may have faq_content as well (or under general.raw.faq)
 */
function extractFAQs_(trip) {
  var tripId = get_(trip, 'core.id', '');

  var metaFaq = get_(trip, 'meta.wp_travel_engine_setting.faq', {}) || {};
  var rawFaq  = get_(trip, 'general.raw.faq', {}) || {};

  var titles   = metaFaq.faq_title   || rawFaq.faq_title   || [];
  var contents = metaFaq.faq_content || rawFaq.faq_content || [];

  if (!Array.isArray(titles))   titles   = [];
  if (!Array.isArray(contents)) contents = [];

  var maxLen = Math.max(titles.length, contents.length);
  var out = [];
  for (var i = 0; i < maxLen; i++) {
    var q = titles[i]   || '';
    var a = contents[i] || '';
    q = TextUtils.htmlToPlain(q);
    a = TextUtils.htmlToPlain(a);
    if (!q && !a) continue;
    out.push({
      TripID: tripId,
      Question: q,
      Answer: a
    });
  }
  return out;
}

/**
 * TripIncludes: cost_includes as multiple lines or array.
 * We prioritize meta.wp_travel_engine_setting.cost, then general.raw.cost
 */
function extractIncludes_(trip) {
  var tripId = get_(trip, 'core.id', '');

  var raw = get_(trip, 'meta.wp_travel_engine_setting.cost.cost_includes', null);
  if (raw == null || raw === '') {
    raw = get_(trip, 'general.raw.cost.cost_includes', '');
  }

  var items = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string') {
    items = raw.split(/\r?\n/);
  }

  var out = [];
  for (var i = 0; i < items.length; i++) {
    var t = TextUtils.htmlToPlain(items[i]);
    if (!t) continue;
    out.push({
      TripID: tripId,
      IncludeItem: t
    });
  }
  return out;
}

/**
 * TripExcludes
 */
function extractExcludes_(trip) {
  var tripId = get_(trip, 'core.id', '');

  var raw = get_(trip, 'meta.wp_travel_engine_setting.cost.cost_excludes', null);
  if (raw == null || raw === '') {
    raw = get_(trip, 'general.raw.cost.cost_excludes', '');
  }

  var items = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string') {
    items = raw.split(/\r?\n/);
  }

  var out = [];
  for (var i = 0; i < items.length; i++) {
    var t = TextUtils.htmlToPlain(items[i]);
    if (!t) continue;
    out.push({
      TripID: tripId,
      ExcludeItem: t
    });
  }
  return out;
}

/**
 * AddOns table
 *  - AddOnTitle
 *  - AddOnType
 *  - AddOnOption
 *  - AddOnPrice
 *  - AddOnCurrency
 *  - AddOnDescription
 */
function extractAddOns_(trip) {
  var tripId = get_(trip, 'core.id', '');
  if (!tripId) return [];

  // المكان الصحيح للـ extra services في JSON
  var extras = get_(trip, 'meta.wp_travel_engine_setting.trip_extra_services', null);
  if (!Array.isArray(extras) || !extras.length) {
    return [];
  }

  var tripCurrency = get_(trip, 'pricing.currency', '') || '';

  var out = [];

  for (var i = 0; i < extras.length; i++) {
    var ex = extras[i] || {};
    var prices = ex.prices || [];
    var descs  = ex.descriptions || [];

    var priceVal = null;
    if (Array.isArray(prices) && prices.length) {
      var p0 = prices[0];
      if (p0 != null && typeof p0 === 'object' && p0.price != null) {
        priceVal = p0.price;
      } else {
        priceVal = p0;
      }
    }

    out.push({
      TripID: tripId,
      AddOnID: ex.id || null,
      AddOnTitle: ex.label || '',
      AddOnType: ex.type || '',
      AddOnPrice: priceVal,
      AddOnCurrency: tripCurrency,
      Description: (Array.isArray(descs) && descs.length ? descs[0] : '')
    });
  }

  return out;
}


/**
 * PickupLocations
 * - TripID
 * - Location
 * - Price
 * - Currency
 * - Type
 * - Note
 */
function extractPickupLocations_(trip) {
  var tripId = get_(trip, 'core.id', '');
  var arr = get_(trip, 'meta.wptravelengine_pickup_points', []) || [];
  if (!Array.isArray(arr)) arr = [];

  // نجيب عملة الرحلة العامة كـ fallback لـ Currency
  var tripCurrency = get_(trip, 'pricing.currency', '') || '';

  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i] || {};
    if (!p.location) continue;

    // دعم الشكل الحالي (pickup_type) والشكل القديم (type) لو وُجد
    var pickupType = p.pickup_type || p.type || '';

    // مفيش currency جوّه pickup point, فنستخدم اللي على مستوى الرحلة لو حابب
    var currency = p.currency || tripCurrency || '';

    out.push({
      TripID: tripId,
      Location: p.location || '',
      Price: p.price || '',
      Currency: currency,
      Type: pickupType,
      Note: p.note || '' // هيبقى فاضي حالياً لأن مفيش note في JSON
    });
  }
  return out;
}

/**
 * Generic Trip Facts
 * ترجع سطر واحد لكل Fact في جدول TripFacts
 */
function extractTripFacts_(trip) {
  var tripId = get_(trip, 'core.id', '');
  if (!tripId) return [];

  var facts = get_(trip, 'meta.wp_travel_engine_setting.trip_facts', null);
  if (!facts) return [];

  var fieldIdMap = facts.field_id || {};
  if (!fieldIdMap) return [];

  var out = [];
  var conflictIds = ['90730383', '97952084']; // Private Tour, Cultural Tour
  var seenConflict = false;

  for (var fid in fieldIdMap) {
    if (!fieldIdMap.hasOwnProperty(fid)) continue;

    var labelRaw = fieldIdMap[fid] || '';
    var label = String(labelRaw).replace(/\s+/g, ' ').replace(/\t/g, ' ').trim();
    if (!label) continue;

    // Check for mutual exclusivity
    if (conflictIds.indexOf(String(fid)) !== -1) {
      if (seenConflict) continue;
      seenConflict = true;
    }

    // القيمة الحقيقية للفيلد
    var bucket = facts[fid] || {};
    var rawValue = bucket[fid] || '';

    var plainValue = TextUtils.htmlToPlain(rawValue);

    // Normalized key (ex: "Tour Location" => "tour_location")
    var factKey = label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w_]+/g, '');

    out.push({
      TripID: tripId,         // للربط الداخلي
      FactId: fid,            // ID الداخلي في WTE
      FactLabel: label,       // اسم الفاكت زي اللي في الصورة
      FactKey: factKey,       // نسخة Normalized (مفيدة في الفلاتر / الفورمولا)
      FactValue: plainValue,  // القيمة المقروءة
      FactRaw: rawValue,      // الخام (لو فيه HTML)
    });
  }

  // Enforce max 6 facts as per AI generation rules
  if (out.length > 6) {
    out = out.slice(0, 6);
  }

  return out;
}

function sanitizeTemplateTokens_(s) {
  if (!s) return '';
  var t = String(s);
  t = t.replace(/GENERATE ONE IF MISSING/gi, '').trim();
  return t;
}

/**
 * TripDetails
 * - TripID
 * - TourType
 * - PickupInstructions
 * - CutoffEnabled
 * - CutoffTime
 * - CutoffUnit
 * - ExpiryDate
 */
function extractTripDetails_(trip) {
  var tripId = get_(trip, 'core.id', '');
  var meta = trip.meta || {};
  var general = trip.general || {};

  // Tour type: from meta.trip_type (as per request)
  var tourType = meta.trip_type || '';

  // Pickup instructions: might come from trip_facts in some installs, but for now we leave it empty.
  var pickupInstructions = '';

  // Cutoff: new structure under general.cutoff
  var cutoff = general.cutoff || {};
  var cutoffEnabled = !!cutoff.enabled;
  var cutoffTime = cutoff.value || '';
  var cutoffUnit = cutoff.unit  || '';

  // Expiry date: if provided by API (older setup had trip.trip_expiry_date)
  var expiryDate = get_(trip, 'trip_expiry_date', '') || '';

  return [{
    TripID: tripId,
    TourType: tourType,
    PickupInstructions: TextUtils.htmlToPlain(pickupInstructions),
    CutoffEnabled: cutoffEnabled,
    CutoffTime: cutoffTime,
    CutoffUnit: cutoffUnit,
    ExpiryDate: expiryDate
  }];
}
/**
 * Packages table
 *  - PackageID
 *  - PackageTitle
 *  - RegularPrice
 *  - SalePrice
 *  - Currency
 *  - PricingCategories (JSON text of categories)
 *  - GroupPricing (JSON text of group_pricing per category)
 *  - PackageLink
 *  - Status
 *  - MaxPax / MinPax (اختياري الآن)
 */
function extractPackages_(trip) {
  var tripId = get_(trip, 'core.id', '');
  var tripCurrency = get_(trip, 'pricing.currency', '');
  var pkgs = get_(trip, 'pricing.packages', []) || [];

  if (!Array.isArray(pkgs) || !pkgs.length) return [];

  var out = [];

  for (var i = 0; i < pkgs.length; i++) {
    var pkg = pkgs[i] || {};
    var core = pkg.core || {};
    var pricing = pkg.pricing || {};
    var cats = pricing.categories || [];

    var regular = null;
    var sale = null;
    var currency = tripCurrency || '';

    if (Array.isArray(cats) && cats.length) {
      for (var j = 0; j < cats.length; j++) {
        var c = cats[j] || {};
        if (currency === '' && c.currency) currency = c.currency;
        if (regular == null && c.regular_price != null) regular = c.regular_price;
        if (sale == null && c.sale_price != null) sale = c.sale_price;
      }
    }

    var pricingCatsText = cats && cats.length ? JSON.stringify(cats) : '';
    var groupPricingArr = [];
    if (Array.isArray(cats)) {
      for (var j = 0; j < cats.length; j++) {
        var c = cats[j] || {};
        if (!c.label && !c.group_pricing) continue;
        groupPricingArr.push({
          label: c.label || '',
          group_pricing: c.group_pricing || []
        });
      }
    }
    var groupPricingText = groupPricingArr.length ? JSON.stringify(groupPricingArr) : '';

    out.push({
      PackageID: String(core.id || ''),
      PackageTitle: core.title || '',
      RegularPrice: regular,
      SalePrice: sale,
      Currency: currency,
      PricingCategories: pricingCatsText,
      GroupPricing: groupPricingText,
      PackageLink: core.link || '',
      Status: core.status || '',
      MaxPax: null, // ممكن نكمله بعدين لو حبّينا نحسبه من الكاتيجوريز
      MinPax: null
      // حقل الربط Trip هيتضاف في upsert من خلال replaceChildRecordsForTrip_
    });
  }

  return out;
}
/**
 * Images table
 *  - ImageID (Number)
 *  - URL
 *  - Width
 *  - Height
 *  - Title
 *  - Caption
 *  - Alt
 *  - MimeType
 *  - SourceTrip (Linked → Trips)  <-- بيتضاف في upsert تلقائي
 */
function extractImages_(trip) {
  var tripId = get_(trip, 'core.id', '');
  if (!tripId) return [];

  var out = [];

  function pushImage(img) {
    if (!img || !img.id || !img.url) return;
    out.push({
      ImageID: img.id,
      URL: img.url || '',
      Width: img.width != null ? img.width : null,
      Height: img.height != null ? img.height : null,
      Title: img.title || '',
      Caption: img.caption || '',
      Alt: img.alt || '',
      MimeType: img.mime_type || ''
      // SourceTrip هيتحط في replaceChildRecordsForTrip_ كـ linked record
    });
  }

  // featured_image
  var feat = trip.featured_image;
  if (feat) {
    pushImage(feat);
  }

  // gallery array
  var gallery = trip.gallery || [];
  if (Array.isArray(gallery)) {
    gallery.forEach(function (g) {
      pushImage(g);
    });
  }

  return out;
}
/**
 * Prices table
 *  - PackageID
 *  - CategoryID
 *  - Label
 *  - RegularPrice
 *  - SalePrice
 *  - Currency
 *  - MinPax
 *  - MaxPax
 *  - PricingType
 *  - GroupPricing (JSON)
 *  - Trip (linked → Trips)  <-- بيتضاف تلقائي
 */
function extractPrices_(trip) {
  var tripId = get_(trip, 'core.id', '');
  if (!tripId) return [];

  var tripCurrency = get_(trip, 'pricing.currency', '') || '';
  var pkgs = get_(trip, 'pricing.packages', []) || [];
  if (!Array.isArray(pkgs) || !pkgs.length) return [];

  var out = [];

  pkgs.forEach(function (pkg) {
    var pkgId = get_(pkg, 'core.id', '');
    var pricing = pkg.pricing || {};
    var cats = pricing.categories || [];
    if (!Array.isArray(cats) || !cats.length) return;

    cats.forEach(function (cat) {
      if (!cat) return;
      var currency = cat.currency || tripCurrency || '';

      var row = {
        PackageID: String(pkgId || ''),
        CategoryID: cat.id != null ? cat.id : null,
        Label: cat.label || '',
        RegularPrice: cat.regular_price != null ? cat.regular_price : null,
        SalePrice: cat.sale_price != null ? cat.sale_price : null,
        Currency: currency,
        MinPax: cat.min_pax != null ? cat.min_pax : null,
        MaxPax: cat.max_pax != null ? cat.max_pax : null,
        PricingType: cat.pricing_type || '',
        GroupPricing: ''
      };

      var gp = cat.group_pricing || [];
      if (Array.isArray(gp) && gp.length) {
        row.GroupPricing = JSON.stringify(gp);
      }

      out.push(row);
    });
  });

  return out;
}

module.exports = {
  get_,
  TextUtils,
  parseCSV_,
  stripHtml_,
  decodeHtml_,
  sanitizeTemplateTokens_,
  mapTripToTripsRow_,
  extractHighlights_,
  extractItinerarySteps_,
  extractFAQs_,
  extractIncludes_,
  extractExcludes_,
  extractAddOns_,
  extractPickupLocations_,
  extractTripFacts_,
  extractTripDetails_,
  extractPackages_,
  extractImages_,
  extractPrices_
}
