/************************************************************
 * AI Images Enhancement
 *
 * Enhances image metadata (Title, Caption, Alt) for:
 * - Better SEO
 * - Improved accessibility
 * - More descriptive content
 *
 * Uses raw image data + trip context
 ************************************************************/

var IMAGES_TABLE = 'Images';
var IMAGES_IMPROVEMENT_TABLE = 'Images Improvement With AI';
var TRIPS_TABLE = 'Trips';
var IMPROVEMENT_TABLE = 'Improvement With AI';

var IMAGES_STATUS_FIELD = 'AI_Images_Status';
var AI_IMAGES_BATCH_LIMIT = 1;  // Process one trip at a time

var AI_IMAGES_OPENAI_API_KEY_ = '';
var AI_IMAGES_TRIP_IMPROVEMENT_CACHE_ = {};

function getOpenAiApiKey_AiImages_() {
  var v = AI_IMAGES_OPENAI_API_KEY_;
  if (v) return v;
  try {
    v = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || '';
  } catch (e) {
    v = '';
  }
  AI_IMAGES_OPENAI_API_KEY_ = v;
  return v;
}

function getOpenAiVisionModel_AiImages_() {
  try {
    return PropertiesService.getScriptProperties().getProperty('OPENAI_VISION_MODEL') || 'gpt-4o-mini';
  } catch (e) {
    return 'gpt-4o-mini';
  }
}

function extractFirstImageUrl_AiImages_(imageFields) {
  var f = imageFields || {};
  var url = (f.URL || f.Url || f.url);
  if (url) return String(url).trim();

  var candidates = f.Image || f.Attachments || f.File || f.Gallery || f.FeaturedImage;
  if (Array.isArray(candidates) && candidates.length && candidates[0] && candidates[0].url) {
    return String(candidates[0].url || '').trim();
  }
  return '';
}

function normalizeImageUrl_AiImages_(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  var q = u.indexOf('?');
  if (q !== -1) u = u.substring(0, q);
  return u;
}

function getTripAttachmentUrlsByRole_AiImages_(tripFields) {
  var f = tripFields || {};
  var featured = (f.FeaturedImage && Array.isArray(f.FeaturedImage)) ? f.FeaturedImage : ((f['Featured Image'] && Array.isArray(f['Featured Image'])) ? f['Featured Image'] : []);
  var gallery = (f.Gallery && Array.isArray(f.Gallery)) ? f.Gallery : [];

  var out = { featured: [], gallery: [] };
  featured.forEach(function(att) {
    if (att && att.url) out.featured.push(normalizeImageUrl_AiImages_(att.url));
  });
  gallery.forEach(function(att) {
    if (att && att.url) out.gallery.push(normalizeImageUrl_AiImages_(att.url));
  });

  out.featured = out.featured.filter(function(x) { return !!x; });
  out.gallery = out.gallery.filter(function(x) { return !!x; });
  return out;
}

function resolveImageRoleForUrl_AiImages_(tripFields, imageUrl) {
  var u = normalizeImageUrl_AiImages_(imageUrl);
  if (!u) return '';
  var urls = getTripAttachmentUrlsByRole_AiImages_(tripFields);
  if (urls.featured.indexOf(u) !== -1) return 'featured';
  if (urls.gallery.indexOf(u) !== -1) return 'gallery';
  return '';
}

function splitKeywordsCsv_AiImages_(raw) {
  var s = String(raw || '').trim();
  if (!s) return [];
  return s.split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
}

function extractEnglishKeywordsForGallery_AiImages_(tripFields) {
  var f = tripFields || {};
  var v = f.SEO_FocusKeywords_List;
  var list = [];
  if (v) {
    if (Array.isArray(v)) {
      list = list.concat(v.map(function(x) { return String(x || '').trim(); }));
    } else {
      list = list.concat(String(v).split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); }));
    }
  }
  list = list.filter(function(x) { return !!x; });

  var english = list.filter(function(x) {
    var s = String(x || '').trim();
    if (!s) return false;
    if (/[\u0600-\u06FF]/.test(s)) return false;
    if (/[\u0400-\u04FF]/.test(s)) return false;
    if (!/[A-Za-z\u00C0-\u024F]/.test(s)) return false;
    if (!/^[A-Za-z0-9\u00C0-\u024F '&\-.,/()]+$/.test(s)) return false;
    return true;
  });

  var seen = {};
  var uniq = [];
  english.forEach(function(s) {
    var k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    uniq.push(s);
  });

  if (uniq.length > 30) uniq = uniq.slice(0, 30);
  return uniq;
}

function normalizeKeywordList_AiImages_(list, limit) {
  var items = (list || []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  var seen = {};
  var out = [];
  items.forEach(function(s) {
    var k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push(s);
  });
  var max = typeof limit === 'number' && limit > 0 ? limit : 30;
  if (out.length > max) out = out.slice(0, max);
  return out;
}

function buildTripKeywordPlans_AiImages_(tripFields, ctx) {
  var f = tripFields || {};

  var listFromField = extractEnglishKeywordsForGallery_AiImages_(f);
  listFromField = normalizeKeywordList_AiImages_(listFromField, 30);

  var focus = f.SEO_FocusKeywords || f['Focus Keyword'] || f.FocusKeyword || f['FocusKeyword'] || '';
  var focusItems = normalizeKeywordList_AiImages_(splitKeywordsCsv_AiImages_(focus), 10);

  var fallback = ctx && ctx.seoKeywords ? String(ctx.seoKeywords) : '';
  var fallbackItems = normalizeKeywordList_AiImages_(splitKeywordsCsv_AiImages_(fallback), 10);

  var featuredPrimary = (focusItems && focusItems.length) ? focusItems[0] : '';
  if (!featuredPrimary && listFromField.length) featuredPrimary = listFromField[0];
  if (!featuredPrimary && fallbackItems.length) featuredPrimary = fallbackItems[0];

  var galleryPrimary = listFromField.length ? listFromField[0] : '';
  if (!galleryPrimary) galleryPrimary = featuredPrimary;
  if (!galleryPrimary && fallbackItems.length) galleryPrimary = fallbackItems[0];

  var gallerySecondary = listFromField.length > 1 ? listFromField.slice(1) : [];

  var all = [];
  if (featuredPrimary) all.push(featuredPrimary);
  listFromField.forEach(function(x) { all.push(x); });
  if (!all.length) fallbackItems.forEach(function(x) { all.push(x); });
  all = normalizeKeywordList_AiImages_(all, 30);

  return {
    all: all,
    featured: { primary: featuredPrimary, secondary: gallerySecondary },
    gallery: { primary: galleryPrimary, secondary: gallerySecondary }
  };
}

function enforceAltKeywordSuffix_AiImages_(alt, primary, secondary) {
  var base = String(alt || '').trim();
  var p = String(primary || '').trim();
  var s = String(secondary || '').trim();
  if (!p) return base;

  var suffix = s ? (p + ', ' + s) : p;

  if (suffix.length > 125) {
    suffix = p.length <= 125 ? p : p.substring(0, 125).trim();
  }

  if (base === suffix) return base;
  if (base.length >= suffix.length && base.slice(base.length - suffix.length) === suffix) return base;

  var joiner = base ? ' ' : '';
  var out = (base + joiner + suffix).trim();

  if (out.length <= 125) return out;

  var allowedBaseLen = 125 - suffix.length - 1;
  if (allowedBaseLen < 0) {
    return suffix.substring(0, 125).trim();
  }

  var trimmedBase = base.substring(0, allowedBaseLen).trim();
  return (trimmedBase ? (trimmedBase + ' ' + suffix) : suffix).trim().substring(0, 125).trim();
}

function normalizeTitleKey_AiImages_(title) {
  var s = String(title || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/[^a-z0-9]+/g, '');
  return s;
}

function shortenTripNameForImageTitle_AiImages_(raw, maxLen) {
  var s = String(raw || '').trim();
  if (!s) return '';
  var limit = typeof maxLen === 'number' && maxLen > 0 ? maxLen : 28;

  s = s.replace(/\s+/g, ' ').trim();
  var idx = s.indexOf(':');
  if (idx !== -1 && idx + 1 < s.length) {
    var left = s.substring(0, idx).trim();
    var right = s.substring(idx + 1).trim();
    if (left && left.length >= 12) s = left;
    else if (right) s = right;
  }

  s = s.replace(/\s*[-–—]\s*/g, ' ');
  s = s.replace(/[:]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= limit) return s;

  var words = s.split(' ').filter(function(w) { return !!w; });
  if (!words.length) return '';
  var out = '';
  for (var i = 0; i < words.length; i++) {
    var next = out ? (out + ' ' + words[i]) : words[i];
    if (next.length > limit) break;
    out = next;
  }
  if (!out) {
    return words[0].length > limit ? words[0].substring(0, limit).trim() : words[0];
  }
  return out.trim();
}

function cleanupImageTitle_AiImages_(title) {
  var s = String(title || '').trim();
  if (!s) return '';
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(experience|enjoy|discover|immerse yourself in|immerse yourself|unforgettable)\b[:\-\s]*/i, '');
  s = s.replace(/[:]+/g, ' ');
  s = s.replace(/\s+[.,;:]+$/g, '');
  s = s.replace(/\s*[-–—]\s*$/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function trimTrailingStopwords_AiImages_(text) {
  var s = String(text || '').trim();
  if (!s) return '';
  var stop = {
    'a': true, 'an': true, 'the': true, 'and': true, 'or': true,
    'at': true, 'in': true, 'on': true, 'of': true, 'for': true, 'to': true,
    'with': true, 'by': true, 'during': true, 'from': true, 'into': true
  };
  var words = s.split(' ').filter(function(w) { return !!w; });
  while (words.length) {
    var last = String(words[words.length - 1]).toLowerCase();
    last = last.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    if (!last) {
      words.pop();
      continue;
    }
    if (!stop[last]) break;
    words.pop();
  }
  return words.join(' ').trim();
}

function truncateByWords_AiImages_(text, maxLen) {
  var s = String(text || '').trim();
  var limit = typeof maxLen === 'number' && maxLen > 0 ? maxLen : 60;
  if (!s) return '';
  if (s.length <= limit) return s;
  var words = s.split(' ').filter(function(w) { return !!w; });
  if (!words.length) return s.substring(0, limit).trim();
  var out = '';
  for (var i = 0; i < words.length; i++) {
    var next = out ? (out + ' ' + words[i]) : words[i];
    if (next.length > limit) break;
    out = next;
  }
  out = trimTrailingStopwords_AiImages_(out);
  if (out && out.length <= limit) return out;
  return s.substring(0, limit).trim();
}

function ensureTitleLinkedToTripSeo_AiImages_(title, ctx, maxLen) {
  var limit = typeof maxLen === 'number' && maxLen > 0 ? maxLen : 60;
  var baseTitle = cleanupImageTitle_AiImages_(title);
  if (!baseTitle) baseTitle = 'Travel photo';

  var seo = ctx && ctx.seoTitle ? String(ctx.seoTitle) : '';
  var trip = ctx && ctx.tripTitle ? String(ctx.tripTitle) : '';
  var tripShort = shortenTripNameForImageTitle_AiImages_(seo || trip, 28);
  if (!tripShort) return truncateByWords_AiImages_(baseTitle, limit);

  var lowTitle = baseTitle.toLowerCase();
  var lowTrip = tripShort.toLowerCase();
  if (lowTitle.indexOf(lowTrip) !== -1) {
    return truncateByWords_AiImages_(baseTitle, limit);
  }

  var sep = ' ';
  var maxTripLen = Math.min(28, Math.max(12, limit - 12));
  tripShort = shortenTripNameForImageTitle_AiImages_(tripShort, maxTripLen);
  tripShort = trimTrailingStopwords_AiImages_(tripShort);
  if (!tripShort) return truncateByWords_AiImages_(baseTitle, limit);

  var allowed = limit - (tripShort.length + sep.length);
  if (allowed < 8) {
    return truncateByWords_AiImages_(tripShort, limit);
  }

  var subject = trimTrailingStopwords_AiImages_(baseTitle);
  subject = truncateByWords_AiImages_(subject, allowed);
  subject = trimTrailingStopwords_AiImages_(subject);
  if (!subject) return truncateByWords_AiImages_(tripShort, limit);

  var out = (tripShort + sep + subject).trim();
  out = truncateByWords_AiImages_(out, limit);
  return out;
}

function makeUniqueTitleWithCounter_AiImages_(baseTitle, usedKeys, limit) {
  var maxLen = typeof limit === 'number' && limit > 0 ? limit : 60;
  var base = String(baseTitle || '').trim();
  if (!base) base = 'Travel photo';
  base = truncateByWords_AiImages_(base, maxLen);

  var baseKey = normalizeTitleKey_AiImages_(base);
  if (baseKey && !usedKeys[baseKey]) return base;

  for (var i = 2; i <= 50; i++) {
    var suffix = ' - ' + i;
    var allowed = maxLen - suffix.length;
    var candidate = (allowed > 0 ? truncateByWords_AiImages_(base, allowed) : '').trim();
    if (!candidate) candidate = 'Photo';
    candidate = (candidate + suffix).trim();
    var k = normalizeTitleKey_AiImages_(candidate);
    if (k && !usedKeys[k]) return candidate;
  }

  return truncateByWords_AiImages_(base, maxLen);
}

function collapseRepeatedPhrases_AiImages_(text, maxWords) {
  var s = String(text || '').trim();
  if (!s) return '';
  var raw = s.replace(/\s+/g, ' ');
  var tokens = raw.split(' ').filter(function(t) { return !!t; });
  if (!tokens.length) return '';

  var cleaned = [];
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    var prev = cleaned.length ? cleaned[cleaned.length - 1] : '';
    if (prev && prev.toLowerCase() === t.toLowerCase()) continue;
    cleaned.push(t);
  }

  function collapseNGram(arr, n) {
    var out = [];
    var i = 0;
    while (i < arr.length) {
      if (i + (2 * n) <= arr.length) {
        var same = true;
        for (var j = 0; j < n; j++) {
          if (String(arr[i + j]).toLowerCase() !== String(arr[i + n + j]).toLowerCase()) {
            same = false;
            break;
          }
        }
        if (same) {
          for (var k = 0; k < n; k++) out.push(arr[i + k]);
          i += 2 * n;
          continue;
        }
      }
      out.push(arr[i]);
      i++;
    }
    return out;
  }

  cleaned = collapseNGram(cleaned, 3);
  cleaned = collapseNGram(cleaned, 2);

  if (typeof maxWords === 'number' && maxWords > 0 && cleaned.length > maxWords) {
    cleaned = cleaned.slice(0, maxWords);
  }

  return cleaned.join(' ').trim();
}

function removeKeywordsFromAltBody_AiImages_(alt, primary, secondary) {
  var p = String(primary || '').trim();
  if (!p) return String(alt || '').trim();
  var s = String(secondary || '').trim();
  var suffix = s ? (p + ', ' + s) : p;
  if (suffix.length > 125) suffix = p.length <= 125 ? p : p.substring(0, 125).trim();

  var full = String(alt || '').trim();
  if (!full) return full;

  var escSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var reSuffix = new RegExp("\\s*" + escSuffix + "\\s*$", 'i');
  if (reSuffix.test(full)) {
    var body = full.replace(reSuffix, '').trim();
    if (body) {
      var escP = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var reP = new RegExp(escP, 'ig');
      body = body.replace(reP, '').replace(/\s+/g, ' ').trim();
      if (s) {
        var escS = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var reS = new RegExp(escS, 'ig');
        body = body.replace(reS, '').replace(/\s+/g, ' ').trim();
      }
    }
    body = cleanupAltBody_AiImages_(body);
    return (body ? (body + ' ' + suffix) : suffix).trim();
  }

  return full;
}

function cleanupAltBody_AiImages_(body) {
  var s = String(body || '').trim();
  if (!s) return '';

  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s+[.,;:]\s+/g, ' ');
  s = s.replace(/\s+[.,;:]+$/g, '');
  s = s.replace(/\b(a|an|the)\s*[.,;:]+/gi, '');
  s = s.replace(/\b(during|on|in|for)\s+(a|an|the)\s*[.,;:]*\s*$/i, '');
  s = s.replace(/\b(during|on|in|for)\s*[.,;:]*\s*$/i, '');
  s = s.replace(/\b(a|an|the)\s*[.,;:]*\s*$/i, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function cleanupAltPunctuation_AiImages_(alt, primary, secondary) {
  var p = String(primary || '').trim();
  var s = String(secondary || '').trim();
  var full = String(alt || '').trim();
  if (!p || !full) return full;

  var suffix = s ? (p + ', ' + s) : p;
  if (suffix.length > 125) suffix = p.length <= 125 ? p : p.substring(0, 125).trim();

  var esc = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp("\\s*" + esc + "\\s*$", 'i');
  if (!re.test(full)) return full;

  var body = full.replace(re, '').trim();
  body = cleanupAltBody_AiImages_(body);
  return (body ? (body + ' ' + suffix) : suffix).trim();
}

function ensureKeywordIncludedOnce_AiImages_(text, keyword, maxChars) {
  var kw = String(keyword || '').trim();
  var s = String(text || '').trim();
  var maxLen = typeof maxChars === 'number' && maxChars > 0 ? maxChars : 300;
  if (!kw) return s;
  if (!s) {
    return kw.length <= maxLen ? kw : kw.substring(0, maxLen).trim();
  }
  if (s.toLowerCase().indexOf(kw.toLowerCase()) !== -1) return s;

  var add = '. ' + kw;
  if ((s + add).length <= maxLen) return (s + add).trim();

  add = ' (' + kw + ')';
  if ((s + add).length <= maxLen) return (s + add).trim();

  var allowed = maxLen - add.length;
  if (allowed < 10) return s.substring(0, maxLen).trim();
  var trimmed = s.substring(0, allowed).trim();
  return (trimmed + add).trim().substring(0, maxLen).trim();
}

function removeDashesFromText_AiImages_(text) {
  var s = String(text || '').trim();
  if (!s) return '';
  s = s.replace(/\s*[–—]\s*/g, '. ');
  s = s.replace(/\.\s*\./g, '. ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s+\./g, '.');
  s = s.replace(/\s+,/g, ',');
  return s.trim();
}

function resolveKeywordCandidatesForImage_AiImages_(imageRole, tripFields, ctx) {
  var role = String(imageRole || '').toLowerCase();
  var f = tripFields || {};
  var fallback = ctx && ctx.seoKeywords ? String(ctx.seoKeywords) : '';

  if (role === 'featured') {
    var raw = f.SEO_FocusKeywords || '';
    var items = splitKeywordsCsv_AiImages_(raw);
    if (!items.length && fallback) items = splitKeywordsCsv_AiImages_(fallback);
    return items;
  }

  if (role === 'gallery') {
    var en = extractEnglishKeywordsForGallery_AiImages_(f);
    if (!en.length && fallback) en = splitKeywordsCsv_AiImages_(fallback);
    return en;
  }

  return fallback ? splitKeywordsCsv_AiImages_(fallback) : [];
}

function callOpenAiVisionForImageMeta_AiImages_(imageUrl, ctx, keywordPlan, opts) {
  var apiKey = getOpenAiApiKey_AiImages_();
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY in Script Properties');

  var model = getOpenAiVisionModel_AiImages_();
  var url = String(imageUrl || '').trim();
  if (!url) throw new Error('Missing imageUrl');

  var tripTitle = ctx && ctx.tripTitle ? String(ctx.tripTitle) : '';
  var tripLocation = ctx && ctx.tripLocation ? String(ctx.tripLocation) : '';
  var tripType = ctx && ctx.tripType ? String(ctx.tripType) : '';
  var role = ctx && ctx.imageRole ? String(ctx.imageRole) : '';
  var tripSeoTitle = ctx && ctx.seoTitle ? String(ctx.seoTitle) : '';
  var forbiddenTitles = opts && opts.forbiddenTitles && Array.isArray(opts.forbiddenTitles) ? opts.forbiddenTitles : [];
  forbiddenTitles = forbiddenTitles.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (forbiddenTitles.length > 25) forbiddenTitles = forbiddenTitles.slice(0, 25);
  var primaryKeyword = keywordPlan && keywordPlan.primary ? String(keywordPlan.primary) : '';
  var secondaryKeywords = keywordPlan && keywordPlan.secondary && Array.isArray(keywordPlan.secondary) ? keywordPlan.secondary : [];
  secondaryKeywords = secondaryKeywords.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (secondaryKeywords.length > 12) secondaryKeywords = secondaryKeywords.slice(0, 12);
  var allKeywords = keywordPlan && keywordPlan.all && Array.isArray(keywordPlan.all) ? keywordPlan.all : [];
  allKeywords = allKeywords.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (allKeywords.length > 30) allKeywords = allKeywords.slice(0, 30);

  var preferredTitleKeyword = opts && opts.preferredTitleKeyword ? String(opts.preferredTitleKeyword) : '';
  preferredTitleKeyword = preferredTitleKeyword.trim();

  var text =
    "You are generating SEO + accessibility metadata for a travel photo.\n" +
    "You can SEE the image. Describe only what is visible. Do NOT invent details.\n" +
    "You MAY use the provided trip context for naming, but do NOT claim it is visible unless it is.\n" +
    "Write like a premium global travel brand (clear, natural, non-spammy).\n" +
    "TITLE RULE (STRICT): Title must be very short and strongly linked to the trip SEO title.\n" +
    "TITLE FORMAT: '<Short Trip Name> <Visible Subject>'.\n" +
    "Avoid filler like 'Experience'/'Enjoy'.\n" +
    "Avoid generic filler like: 'Experience the magic', 'Immerse yourself', 'Unforgettable moment'.\n" +
    "Avoid repeating the same word or phrase back-to-back (e.g., 'tour tour' or 'desert tour desert tour').\n" +
    (forbiddenTitles.length ? ("TITLE UNIQUENESS (STRICT): Do NOT reuse any of these titles: " + JSON.stringify(forbiddenTitles) + "\n") : "") +
    (forbiddenTitles.length ? "If the title would repeat, focus on a DIFFERENT visible detail/angle and produce a different title.\n" : "") +
    (preferredTitleKeyword ? ("TITLE SEO HINT: If it fits naturally, include this exact phrase ONCE in the title: " + JSON.stringify(preferredTitleKeyword) + "\n") : "") +
    "PRIMARY KEYWORD RULE (STRICT): The alt text MUST end with the Primary Keyword verbatim.\n" +
    "SECONDARY KEYWORD RULE (STRICT): If a secondary keyword is provided, include it verbatim ONCE in caption OR description (not in alt).\n" +
    "Do NOT repeat keywords. No keyword stuffing.\n" +
    "Return ONLY valid JSON with keys: title, caption, description, alt.\n" +
    "Limits: title<=60 chars, caption<=150 chars, description<=300 chars, alt<=125 chars.\n\n" +
    "Trip Title: " + tripTitle + "\n" +
    "Trip SEO Title: " + tripSeoTitle + "\n" +
    "Location: " + tripLocation + "\n" +
    "Tour Type: " + tripType + "\n" +
    "Image Role: " + role + "\n" +
    "Primary Keyword: " + JSON.stringify(primaryKeyword) + "\n" +
    "Secondary Keyword (optional): " + JSON.stringify(secondaryKeywords && secondaryKeywords.length ? secondaryKeywords[0] : '') + "\n" +
    "All Keywords (trip): " + JSON.stringify(allKeywords) + "\n" +
    (preferredTitleKeyword ? ("Preferred Title Keyword: " + JSON.stringify(preferredTitleKeyword) + "\n") : "");

  var payload = {
    model: model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: text },
          { type: 'image_url', image_url: { url: url } }
        ]
      }
    ],
    temperature: 0.4,
    presence_penalty: 0.2,
    max_tokens: 300
  };

  var resp = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = resp.getResponseCode();
  var body = resp.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('OpenAI Vision error: HTTP ' + status + ' — ' + body);
  }

  var json = JSON.parse(body);
  var content = json && json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : '';
  content = String(content || '').trim();
  if (!content) throw new Error('OpenAI Vision: empty content');

  try {
    return JSON.parse(content);
  } catch (e) {
    var clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
    var first = clean.indexOf('{');
    var last = clean.lastIndexOf('}');
    if (first !== -1 && last !== -1) clean = clean.substring(first, last + 1);
    return JSON.parse(clean);
  }
}

/************************************************************
 * MAIN BATCH FUNCTION
 ************************************************************/
function runAiImagesEnhancementBatch() {
  loadConfigSecrets_();
  Logger.log('AI Images: starting batch...');
  
  // Fetch trips with AI_Images_Status = 'Pending'
  var formula = "{" + IMAGES_STATUS_FIELD + "} = 'Pending'";
  var params = {
    filterByFormula: formula,
    maxRecords: AI_IMAGES_BATCH_LIMIT
  };
  
  var res = airtableGet_(TRIPS_TABLE, params);
  var trips = res && res.records ? res.records : [];
  
  if (!trips || !trips.length) {
    Logger.log('AI Images: no trips with ' + IMAGES_STATUS_FIELD + " = 'Pending'.");
    return;
  }
  
  trips.forEach(function(tripRec) {
    var tripId = tripRec.id;
    var tripFields = tripRec.fields || {};
    
    try {
      Logger.log('AI Images: processing Trip ' + tripId);

      if (!claimStage_(tripId, 'Images', 25 * 60)) {
        Logger.log('AI Images: stage already claimed; skipping Trip ' + tripId);
        return;
      }
      
      // 1) Update status to Processing
      updateTripImagesStatus_(tripId, 'Processing');
      
      // 2) Get TripID from trip fields
      var tripNumber = tripFields.TripID || '';
      if (!tripNumber) {
        Logger.log('AI Images: Trip ' + tripId + ' has no TripID field');
        updateTripImagesStatus_(tripId, 'Error');
        return;
      }
      
      Logger.log('AI Images: searching for images with SourceTrip = ' + tripNumber);
      
      // 3) Delete old improved records for this trip
      deleteOldImprovedImagesForTrip_(tripId, tripNumber);
      
      // 4) Get all images for this trip
      // Support both TripID (string) and Record ID (starts with "rec")
      var imagesFormula;
      var tripIdNeedle = String(tripId || '').replace(/'/g, "\\'");
      var tripNumberNeedle = String(tripNumber || '').replace(/'/g, "\\'");
      if (tripNumber && tripNumber.indexOf('rec') === 0) {
        // It's a Record ID - use exact match
        imagesFormula =
          "OR(" +
          "FIND('" + tripIdNeedle + "', ARRAYJOIN({SourceTrip})), " +
          "ARRAYJOIN({SourceTrip}) = '" + tripNumberNeedle + "'" +
          ")";
      } else {
        // It's a TripID - use FIND for partial match (legacy support)
        imagesFormula =
          "OR(" +
          "FIND('" + tripIdNeedle + "', ARRAYJOIN({SourceTrip})), " +
          "FIND('" + tripNumberNeedle + "', ARRAYJOIN({SourceTrip}))" +
          ")";
      }
      
      Logger.log('AI Images: searching with formula: ' + imagesFormula);
      
      var imagesParams = {
        filterByFormula: imagesFormula
      };
      
      var imagesRes = airtableGet_(IMAGES_TABLE, imagesParams);
      var images = imagesRes && imagesRes.records ? imagesRes.records : [];
      
      var existingTitles = images.map(function(r) { return (r.fields.Title || '').toString().trim(); });
      var existingUrls = images.map(function(r) { return (r.fields.URL || '').toString().trim(); });

      var featuredImages = (tripFields.FeaturedImage && Array.isArray(tripFields.FeaturedImage)) ? tripFields.FeaturedImage : (tripFields['Featured Image'] && Array.isArray(tripFields['Featured Image']) ? tripFields['Featured Image'] : []);
      var galleryImages = (tripFields.Gallery && Array.isArray(tripFields.Gallery)) ? tripFields.Gallery : [];

      var allAtts = [];
      featuredImages.forEach(function(x) { allAtts.push({ role: 'FeaturedImage', att: x }); });
      galleryImages.forEach(function(x) { allAtts.push({ role: 'Gallery', att: x }); });

      if (allAtts.length) {
        Logger.log('AI Images: syncing ' + allAtts.length + ' attachments from Trip fields...');

        allAtts.forEach(function(entry) {
          var galImg = entry && entry.att ? entry.att : null;
          if (!galImg) return;

          var filename = (galImg.filename || '').toString().trim();
          var url = (galImg.url || '').toString().trim();
          if (!url) return;

          if (filename && existingTitles.indexOf(filename) !== -1) return;
          if (existingUrls.indexOf(url) !== -1) return;

          try {
            var newImageFields = {
              'SourceTrip': [tripId],
              'Title': filename || ('Imported ' + entry.role),
              'URL': url,
              'Caption': 'Imported from Trip ' + entry.role
            };

            var createRes = airtableCreate_(IMAGES_TABLE, newImageFields);
            var newRec = (createRes && createRes.records && createRes.records.length > 0) ? createRes.records[0] : null;

            if (newRec && newRec.id) {
              images.push(newRec);
              if (filename) existingTitles.push(filename);
              if (url) existingUrls.push(url);
              Logger.log('AI Images: created Image record ' + newRec.id + ' from ' + entry.role);
            }
          } catch (e) {
            Logger.log('AI Images: failed to create Image record from ' + entry.role + ' — ' + e.message);
          }
        });
      }
      
      if (!images || !images.length) {
        Logger.log('AI Images: no images found for Trip ' + tripId);
        updateTripImagesStatus_(tripId, 'Done');
        return;
      }
      
      Logger.log('AI Images: found ' + images.length + ' images for Trip ' + tripId);
      
      var processedCount = 0;
      var errorCount = 0;

      var tripImprovement = getTripImprovementCached_AiImages_(tripId, tripFields);
      var tripKeywordPlans = buildTripKeywordPlans_AiImages_(tripFields, tripImprovement);
      var usedTitleKeys = {};
      var usedTitles = [];
      var galleryCountHint = 0;
      for (var w = 0; w < images.length; w++) {
        var wf = images[w] && images[w].fields ? images[w].fields : {};
        var wu = extractFirstImageUrl_AiImages_(wf);
        var wr = resolveImageRoleForUrl_AiImages_(tripFields, wu) || 'gallery';
        if (wr === 'gallery') galleryCountHint++;
      }
      var secondary = (tripKeywordPlans && tripKeywordPlans.gallery && tripKeywordPlans.gallery.secondary) ? tripKeywordPlans.gallery.secondary : [];
      var perGallery = (galleryCountHint > 0 && secondary.length > 0) ? Math.ceil(secondary.length / galleryCountHint) : 0;
      if (perGallery < 1) perGallery = 1;
      if (perGallery > 12) perGallery = 12;
      var galleryCursor = 0;
      
      // 3) Process each image
      images.forEach(function(imageRec) {
        var imageId = imageRec.id;
        var imageFields = imageRec.fields || {};
        
        try {
          // Build context
          var ctx = buildImageContext_(imageFields, tripFields, imageId, tripId);
          
          // Determine image URL and role (featured / gallery) up-front
          var openAiKey = getOpenAiApiKey_AiImages_();
          var imageUrl = extractFirstImageUrl_AiImages_(imageFields);
          var role = resolveImageRoleForUrl_AiImages_(tripFields, imageUrl) || 'gallery';
          ctx.imageRole = role;

          // Call AI (Vision if available)
          var aiResult = null;
          var keywordSuffixSecondary = '';
          var preferredTitleKeywordForImage = '';

          var basePlan = (role === 'featured') ? (tripKeywordPlans && tripKeywordPlans.featured ? tripKeywordPlans.featured : null) : (tripKeywordPlans && tripKeywordPlans.gallery ? tripKeywordPlans.gallery : null);
          var basePrimary = basePlan && basePlan.primary ? String(basePlan.primary) : '';
          var kwPlanForImage = { all: (tripKeywordPlans && tripKeywordPlans.all) ? tripKeywordPlans.all : [], primary: basePrimary, secondary: [] };
          if (role === 'featured') {
            if (secondary && secondary.length) kwPlanForImage.secondary = secondary.slice(0, Math.min(12, secondary.length));
            keywordSuffixSecondary = (kwPlanForImage.secondary && kwPlanForImage.secondary.length) ? String(kwPlanForImage.secondary[0] || '') : '';
            preferredTitleKeywordForImage = basePrimary || '';
          } else {
            if (secondary && secondary.length) {
              var chunk = [];
              for (var kk = 0; kk < perGallery; kk++) {
                var idx = (galleryCursor + kk) % secondary.length;
                if (secondary[idx]) chunk.push(secondary[idx]);
              }
              kwPlanForImage.secondary = normalizeKeywordList_AiImages_(chunk, 12);
              keywordSuffixSecondary = (kwPlanForImage.secondary && kwPlanForImage.secondary.length) ? String(kwPlanForImage.secondary[0] || '') : '';
              preferredTitleKeywordForImage = keywordSuffixSecondary || basePrimary || '';
              galleryCursor = (galleryCursor + perGallery) % secondary.length;
            } else {
              preferredTitleKeywordForImage = basePrimary || '';
            }
          }

          if (openAiKey && imageUrl) {
            aiResult = callOpenAiVisionForImageMeta_AiImages_(imageUrl, ctx, kwPlanForImage, { preferredTitleKeyword: preferredTitleKeywordForImage });
          } else {
            var prompt = buildImagesPrompt_(ctx, tripKeywordPlan, { preferredTitleKeyword: preferredTitleKeywordForImage });
            aiResult = callAi_(prompt);
          }
          
          if (!aiResult || typeof aiResult !== 'object') {
            throw new Error('Invalid AI result for Image ' + imageId);
          }
          
          var title = (aiResult.title || '').toString().trim();
          var caption = (aiResult.caption || '').toString().trim();
          var description = (aiResult.description || '').toString().trim();
          var alt = (aiResult.alt || '').toString().trim();

          var altSecondaryForImage = (role === 'gallery' && keywordSuffixSecondary) ? keywordSuffixSecondary : '';
          alt = enforceAltKeywordSuffix_AiImages_(alt, basePrimary, altSecondaryForImage);
          alt = removeKeywordsFromAltBody_AiImages_(alt, basePrimary, altSecondaryForImage);
          title = ensureTitleLinkedToTripSeo_AiImages_(title, ctx, 60);
          title = collapseRepeatedPhrases_AiImages_(title, 16);
          caption = collapseRepeatedPhrases_AiImages_(caption, 28);
          description = collapseRepeatedPhrases_AiImages_(description, 60);
          alt = collapseRepeatedPhrases_AiImages_(alt, 40);
          caption = removeDashesFromText_AiImages_(caption);
          description = removeDashesFromText_AiImages_(description);
          alt = cleanupAltPunctuation_AiImages_(alt, basePrimary, altSecondaryForImage);
          if (keywordSuffixSecondary && !altSecondaryForImage) {
            var beforeDesc = description;
            description = ensureKeywordIncludedOnce_AiImages_(description, keywordSuffixSecondary, 300);
            if (description === beforeDesc) {
              caption = ensureKeywordIncludedOnce_AiImages_(caption, keywordSuffixSecondary, 150);
            }
          }
          
          // Validate lengths
          if (title.length > 60) title = title.substring(0, 60).trim();
          if (caption.length > 150) caption = caption.substring(0, 150).trim();
          if (description.length > 300) description = description.substring(0, 300).trim();
          if (alt.length > 125) alt = alt.substring(0, 125).trim();

          var titleKey = normalizeTitleKey_AiImages_(title);
          if (!titleKey) {
            title = makeUniqueTitleWithCounter_AiImages_(ctx.tripTitle || 'Travel photo', usedTitleKeys, 60);
            titleKey = normalizeTitleKey_AiImages_(title);
          }

          if (titleKey && usedTitleKeys[titleKey]) {
            try {
              if (openAiKey && imageUrl) {
                var retry = callOpenAiVisionForImageMeta_AiImages_(imageUrl, ctx, (typeof kwPlanForImage !== 'undefined' ? kwPlanForImage : { all: (tripKeywordPlans && tripKeywordPlans.all) ? tripKeywordPlans.all : [], primary: basePrimary, secondary: [] }), { forbiddenTitles: usedTitles, preferredTitleKeyword: preferredTitleKeywordForImage });
                if (retry && typeof retry === 'object') {
                  title = (retry.title || title || '').toString().trim();
                  caption = (retry.caption || caption || '').toString().trim();
                  description = (retry.description || description || '').toString().trim();
                  alt = (retry.alt || alt || '').toString().trim();
                  var altSecondaryForRetry = (role === 'gallery' && keywordSuffixSecondary) ? keywordSuffixSecondary : '';
                  alt = enforceAltKeywordSuffix_AiImages_(alt, basePrimary, altSecondaryForRetry);
                  alt = removeKeywordsFromAltBody_AiImages_(alt, basePrimary, altSecondaryForRetry);
                  title = ensureTitleLinkedToTripSeo_AiImages_(title, ctx, 60);
                  title = collapseRepeatedPhrases_AiImages_(title, 16);
                  caption = collapseRepeatedPhrases_AiImages_(caption, 28);
                  description = collapseRepeatedPhrases_AiImages_(description, 60);
                  alt = collapseRepeatedPhrases_AiImages_(alt, 40);
                  caption = removeDashesFromText_AiImages_(caption);
                  description = removeDashesFromText_AiImages_(description);
                  alt = cleanupAltPunctuation_AiImages_(alt, basePrimary, altSecondaryForRetry);
                  if (keywordSuffixSecondary && !altSecondaryForRetry) {
                    var beforeDesc2 = description;
                    description = ensureKeywordIncludedOnce_AiImages_(description, keywordSuffixSecondary, 300);
                    if (description === beforeDesc2) {
                      caption = ensureKeywordIncludedOnce_AiImages_(caption, keywordSuffixSecondary, 150);
                    }
                  }
                  if (title.length > 60) title = title.substring(0, 60).trim();
                  if (caption.length > 150) caption = caption.substring(0, 150).trim();
                  if (description.length > 300) description = description.substring(0, 300).trim();
                  if (alt.length > 125) alt = alt.substring(0, 125).trim();
                  titleKey = normalizeTitleKey_AiImages_(title);
                }
              } else {
                var retryPrompt = buildImagesPrompt_(ctx, { primary: basePrimary, secondary: secondary }, { forbiddenTitles: usedTitles, preferredTitleKeyword: preferredTitleKeywordForImage });
                var retryRes = callAi_(retryPrompt);
                if (retryRes && typeof retryRes === 'object') {
                  title = (retryRes.title || title || '').toString().trim();
                  caption = (retryRes.caption || caption || '').toString().trim();
                  description = (retryRes.description || description || '').toString().trim();
                  alt = (retryRes.alt || alt || '').toString().trim();
                  var altSecondaryForRetry2 = (role === 'gallery' && keywordSuffixSecondary) ? keywordSuffixSecondary : '';
                  alt = enforceAltKeywordSuffix_AiImages_(alt, basePrimary, altSecondaryForRetry2);
                  alt = removeKeywordsFromAltBody_AiImages_(alt, basePrimary, altSecondaryForRetry2);
                  title = ensureTitleLinkedToTripSeo_AiImages_(title, ctx, 60);
                  title = collapseRepeatedPhrases_AiImages_(title, 16);
                  caption = collapseRepeatedPhrases_AiImages_(caption, 28);
                  description = collapseRepeatedPhrases_AiImages_(description, 60);
                  alt = collapseRepeatedPhrases_AiImages_(alt, 40);
                  caption = removeDashesFromText_AiImages_(caption);
                  description = removeDashesFromText_AiImages_(description);
                  alt = cleanupAltPunctuation_AiImages_(alt, basePrimary, altSecondaryForRetry2);
                  if (keywordSuffixSecondary && !altSecondaryForRetry2) {
                    var beforeDesc3 = description;
                    description = ensureKeywordIncludedOnce_AiImages_(description, keywordSuffixSecondary, 300);
                    if (description === beforeDesc3) {
                      caption = ensureKeywordIncludedOnce_AiImages_(caption, keywordSuffixSecondary, 150);
                    }
                  }
                  if (title.length > 60) title = title.substring(0, 60).trim();
                  if (caption.length > 150) caption = caption.substring(0, 150).trim();
                  if (description.length > 300) description = description.substring(0, 300).trim();
                  if (alt.length > 125) alt = alt.substring(0, 125).trim();
                  titleKey = normalizeTitleKey_AiImages_(title);
                }
              }
            } catch (eTitleRetry) {}
          }

          if (!titleKey || (titleKey && usedTitleKeys[titleKey])) {
            title = makeUniqueTitleWithCounter_AiImages_(title, usedTitleKeys, 60);
            titleKey = normalizeTitleKey_AiImages_(title);
          }
          if (titleKey) usedTitleKeys[titleKey] = true;
          usedTitles.push(title);
          
          // Create/Update record
          var nowIso = new Date().toISOString();
          var fieldsCreate = {};
          fieldsCreate.Image = [imageId];
          fieldsCreate.Trip = [tripId];  // 🆕 Link to trip
          // Save the image type (Featured/Gallery) for later publishing stages
          fieldsCreate.Type = (role === 'featured') ? 'Featured' : 'Gallery';
          fieldsCreate.AI_Title = title;
          fieldsCreate.AI_Caption = caption;
          fieldsCreate.AI_Description = description;
          fieldsCreate.AI_Alt = alt;
          fieldsCreate.AI_Status = 'Done';
          fieldsCreate.AI_LastUpdated = nowIso;
          
          // Create new record (old ones deleted beforehand)
          airtableCreate_(IMAGES_IMPROVEMENT_TABLE, fieldsCreate);
          
          processedCount++;
          
        } catch (e) {
          Logger.log('AI Images: error for Image ' + imageId + ' — ' + e.message);
          errorCount++;
        }
      });
      
      Logger.log('AI Images: Trip ' + tripId + ' → processed ' + processedCount + ' images (' + errorCount + ' errors)');
      
      // 4) Update trip status
      updateTripImagesStatus_(tripId, 'Done');
      
    } catch (e) {
      Logger.log('AI Images: error for Trip ' + tripId + ' — ' + e.message);
      updateTripImagesStatus_(tripId, 'Error');
    }
  });
  
  Logger.log('AI Images: batch finished.');
}

/************************************************************
 * CONTEXT BUILDING
 ************************************************************/
function buildImageContext_(imageFields, tripFields, imageId, tripId) {
  var ctx = {};
  
  // Raw image data
  ctx.currentTitle = imageFields.Title || '';
  ctx.currentCaption = imageFields.Caption || '';
  ctx.currentAlt = imageFields.Alt || '';
  ctx.url = imageFields.URL || '';
  
  // Trip context (already provided)
  ctx.tripTitle = tripFields.Title || '';
  ctx.tripLocation = Array.isArray(tripFields.Cities) ? tripFields.Cities.join(', ') : '';
  ctx.tripType = tripFields.Tour_Type || '';
  ctx.tripCategory = tripFields.Category || '';
  
  var imp = getTripImprovementCached_AiImages_(tripId, tripFields);
  if (imp) {
    ctx.tripDescription = imp.tripDescription || '';
    ctx.seoTitle = imp.seoTitle || '';
    ctx.seoMetaDescription = imp.seoMetaDescription || '';
    ctx.seoKeywords = imp.seoKeywords || '';
  }

    // Fallback: If no SEO keywords in Improvement table, check Trip record
    if (!ctx.seoKeywords && tripFields) {
      Logger.log('AI Images: Focus Keyword not found in Improvement table, checking Trip record fallback...');
      // Try common field names for Focus Keyword
      // Note: 'FocusKeyword' is the field name in Trips table based on user confirmation/observation
      var rawKw = tripFields['Focus Keyword'] || tripFields['FocusKeyword'] || tripFields['SEO_FocusKeywords'] || tripFields['SEO_FocusKeywords_List'];
      
      // Additional fallback: Check for Lookup fields that might return an array of IDs or values
      if (!rawKw && tripFields['Focus Keyword (from Improvement With AI)']) {
         rawKw = tripFields['Focus Keyword (from Improvement With AI)'];
      }

      if (rawKw) {
         if (Array.isArray(rawKw)) ctx.seoKeywords = rawKw[0];
         else ctx.seoKeywords = String(rawKw);
         Logger.log('AI Images: Found Focus Keyword in Trip record: ' + ctx.seoKeywords);
      } else {
         // Log available keys to help debugging
         Logger.log('AI Images: WARNING - No Focus Keyword found in Trip record either. Available keys: ' + Object.keys(tripFields).join(', '));
      }
    } else if (ctx.seoKeywords) {
       Logger.log('AI Images: Found Focus Keyword in Improvement table: ' + ctx.seoKeywords);
    }
  var U = buildUnifiedTripContext_(tripId, tripFields);
  ctx.highlightsText = U && U.highlightsText ? U.highlightsText : '';
  ctx.itineraryText = U && U.itineraryText ? U.itineraryText : '';
  ctx.includesText = U && U.includesText ? U.includesText : '';
  
  return ctx;
}

/************************************************************
 * AI PROMPT
 ************************************************************/
function buildImagesPrompt_(ctx, keywordPlan, opts) {
  var p = keywordPlan && keywordPlan.primary ? String(keywordPlan.primary) : (ctx && ctx.seoKeywords ? String(ctx.seoKeywords) : '');
  var secondary = keywordPlan && keywordPlan.secondary && Array.isArray(keywordPlan.secondary) ? keywordPlan.secondary : [];
  secondary = secondary.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (secondary.length > 12) secondary = secondary.slice(0, 12);
  var forbiddenTitles = opts && opts.forbiddenTitles && Array.isArray(opts.forbiddenTitles) ? opts.forbiddenTitles : [];
  forbiddenTitles = forbiddenTitles.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (forbiddenTitles.length > 25) forbiddenTitles = forbiddenTitles.slice(0, 25);
  var preferredTitleKeyword = opts && opts.preferredTitleKeyword ? String(opts.preferredTitleKeyword) : '';
  preferredTitleKeyword = preferredTitleKeyword.trim();
  var seoTitle = ctx && ctx.seoTitle ? String(ctx.seoTitle) : '';

  var prompt =
    "You are an SEO and accessibility expert for a premium global travel website. Enhance the metadata for this travel image.\n\n" +
    
    "CURRENT IMAGE DATA:\n" +
    "Title: " + (ctx.currentTitle || 'N/A') + "\n" +
    "Caption: " + (ctx.currentCaption || 'N/A') + "\n" +
    "Alt: " + (ctx.currentAlt || 'N/A') + "\n\n" +
    
    "TRIP CONTEXT:\n" +
    "Trip Title: " + (ctx.tripTitle || 'N/A') + "\n" +
    "Location: " + (ctx.tripLocation || 'N/A') + "\n" +
    "Tour Type: " + (ctx.tripType || 'N/A') + "\n" +
    "Category: " + (ctx.tripCategory || 'N/A') + "\n" +
    "Description: " + (ctx.tripDescription || 'N/A') + "\n\n" +
    (ctx.highlightsText ? ("HIGHLIGHTS CONTEXT:\n" + ctx.highlightsText + "\n\n") : "") +
    (ctx.itineraryText ? ("ITINERARY CONTEXT:\n" + ctx.itineraryText + "\n\n") : "") +
    (ctx.includesText ? ("INCLUDES CONTEXT:\n" + ctx.includesText + "\n\n") : "") +
    
    "SEO CONTEXT (use for keyword optimization):\n" +
    "SEO Title: " + (ctx.seoTitle || 'N/A') + "\n" +
    "SEO Meta Description: " + (ctx.seoMetaDescription || 'N/A') + "\n" +
    "SEO Keywords: " + (ctx.seoKeywords || 'N/A') + "\n\n" +

    "KEYWORDS (STRICT):\n" +
    "- Primary Keyword (verbatim): " + p + "\n" +
    (secondary.length ? ("- Secondary Keyword for this image (verbatim, optional): " + secondary[0] + "\n\n") : "\n") +
    (preferredTitleKeyword ? ("TITLE SEO HINT: If it fits naturally, include this exact phrase ONCE in the title: " + JSON.stringify(preferredTitleKeyword) + "\n\n") : "") +
    (forbiddenTitles.length ? ("TITLE UNIQUENESS (STRICT): Do NOT reuse any of these titles: " + JSON.stringify(forbiddenTitles) + "\n\n") : "") +
    
    "🎯 ENHANCEMENT RULES:\n" +
    "1. Title (max 60 chars):\n" +
    "   - Must be SHORT and strongly linked to the trip SEO title\n" +
    "   - Format: '<Short Trip Name> <Visible Subject>'\n" +
    "   - Clear and concise\n" +
    "   - Include location if relevant\n" +
    "   - Avoid generic filler like: 'Experience the magic', 'Immerse yourself', 'Unforgettable moment'\n" +
    "   - Avoid repeated words/phrases\n" +
    "   - Example: 'Al-Hakim Mosque - Cairo Islamic Heritage Tour'\n\n" +
    
    "2. Caption (max 150 chars):\n" +
    "   - Short, simple, and quick context\n" +
    "   - Natural language\n" +
    "   - Example: 'The Al-Hakim Mosque in Cairo, built in 1013 AD'\n\n" +
    
    "3. Description (max 300 chars):\n" +
    "   - Detailed and SEO-oriented\n" +
    "   - Useful for Gallery/Slider context\n" +
    "   - Include historical/cultural context\n" +
    "   - Example: 'The Al-Hakim Mosque in Cairo is a stunning example of Fatimid architecture built in 1013 AD. It features unique minarets and a large courtyard, making it a key site for Islamic heritage tours.'\n\n" +
    
    "4. Alt Text (max 125 chars):\n" +
    "   - Descriptive for accessibility, describing only what is visible\n" +
    "   - End with the Primary Keyword verbatim.\n" +
    "   - Do NOT add secondary keywords to alt.\n" +
    "   - Example: 'Guests stargazing by a campfire under the stars " + p + "'\n\n" +

    "SECONDARY KEYWORD RULE (STRICT):\n" +
    (secondary.length ? ("- Include EXACTLY ONE secondary keyword verbatim ONCE in caption OR description: " + secondary[0] + "\n\n") : "- No secondary keyword provided.\n\n") +

    "- Use current data as base, enhance with trip context\n" +
    "- Do NOT invent details not in context\n" +
    "- Include location keywords for SEO\n" +
    "- STRICT REQUIREMENT: The Alt Text MUST contain the Primary Keyword '" + p + "' EXACTLY (verbatim). Do NOT translate or modify it.\n" +
    "- Output in ENGLISH ONLY\n\n" +
    
    "OUTPUT FORMAT (JSON ONLY):\n" +
    "{\n" +
    "  \"title\": \"Enhanced title here\",\n" +
    "  \"caption\": \"Enhanced short caption here\",\n" +
    "  \"description\": \"Enhanced detailed description here\",\n" +
    "  \"alt\": \"Enhanced alt text here\"\n" +
    "}\n";
  
  return prompt;
}

function getTripImprovementCached_AiImages_(tripId, tripFields) {
  var id = String(tripId || '').trim();
  if (!id) return {};
  if (AI_IMAGES_TRIP_IMPROVEMENT_CACHE_ && AI_IMAGES_TRIP_IMPROVEMENT_CACHE_.hasOwnProperty(id)) {
    return AI_IMAGES_TRIP_IMPROVEMENT_CACHE_[id] || {};
  }

  var out = {};
  try {
    var impParams = {
      filterByFormula: "ARRAYJOIN({Trip}) = '" + id + "'",
      maxRecords: 1
    };
    var impRes = airtableGet_(IMPROVEMENT_TABLE, impParams);

    if ((!impRes || !impRes.records || !impRes.records.length) && tripFields && tripFields['Improvement With AI']) {
      var impLinked = tripFields['Improvement With AI'];
      if (Array.isArray(impLinked) && impLinked.length > 0) {
        var impRecId = impLinked[0];
        impRes = airtableGet_(IMPROVEMENT_TABLE, { filterByFormula: "RECORD_ID() = '" + impRecId + "'" });
      }
    }

    if (impRes && impRes.records && impRes.records.length) {
      var impFields = impRes.records[0].fields || {};
      out.tripDescription = impFields.AI_Trip_Description || '';
      out.seoTitle = impFields.AI_SEO_Title || '';
      out.seoMetaDescription = impFields.AI_SEO_Meta_Description || '';
      out.seoKeywords = impFields.AI_SEO_FocusKeywords || '';
    }
  } catch (e) {}

  if (!AI_IMAGES_TRIP_IMPROVEMENT_CACHE_) AI_IMAGES_TRIP_IMPROVEMENT_CACHE_ = {};
  AI_IMAGES_TRIP_IMPROVEMENT_CACHE_[id] = out;
  return out;
}

/************************************************************
 * HELPER FUNCTIONS
 ************************************************************/

/**
 * Delete old improved image records for a trip
 */
function deleteOldImprovedImagesForTrip_(tripId, tripNumber) {
  if (!tripId) return;
  
  Logger.log('AI Images: deleting old improved records for Trip ' + tripId);
  
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
    var res = airtableGet_(IMAGES_IMPROVEMENT_TABLE, params);
    var recs = res && res.records ? res.records : [];
    if (!recs.length) {
      Logger.log('AI Images: no old records to delete for Trip ' + tripId);
      break;
    }
    var toDelete = recs.map(function(r){ return r.id; });
    Logger.log('AI Images: deleting ' + toDelete.length + ' old records for Trip ' + tripId);
    
    if (typeof airtableBatchDelete_ === 'function') {
      try { airtableBatchDelete_(IMAGES_IMPROVEMENT_TABLE, toDelete); } catch (e) {}
    } else {
      for (var j = 0; j < toDelete.length; j++) {
        var recId = toDelete[j];
        try { airtableDelete_(IMAGES_IMPROVEMENT_TABLE, recId); } catch (e) {
          Logger.log('AI Images: failed to delete record ' + recId + ' — ' + e.message);
        }
      }
    }
  }
}

function updateTripImagesStatus_(tripId, status) {
  if (!tripId) return;
  var fields = {};
  fields[IMAGES_STATUS_FIELD] = status;
  airtableUpdate_(TRIPS_TABLE, tripId, fields);
}

/************************************************************
 * TRIGGER SETUP
 ************************************************************/
function createAiImagesEnhancerTrigger() {
  ScriptApp.newTrigger('runAiImagesEnhancementBatch')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('AI Images: Trigger created to run every hour.');
}
