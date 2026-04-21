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

function getImageRoleFromCaption_AiImages_(caption) {
  var c = String(caption || '').toLowerCase().trim();
  if (!c) return '';
  if (c.indexOf('imported from trip featuredimage') !== -1) return 'featured';
  if (c.indexOf('imported from trip featured image') !== -1) return 'featured';
  if (c.indexOf('imported from trip gallery') !== -1) return 'gallery';
  return '';
}

function resolveImageRole_AiImages_(tripFields, imageFields) {
  var f = imageFields || {};
  var imageUrl = extractFirstImageUrl_AiImages_(f);
  var byUrl = resolveImageRoleForUrl_AiImages_(tripFields, imageUrl);
  if (byUrl) return byUrl;

  var declared = String(f.Type || '').toLowerCase().trim();
  if (declared) {
    if (declared.indexOf('featured') !== -1) return 'featured';
    if (declared.indexOf('gallery') !== -1) return 'gallery';
  }

  var byCaption = getImageRoleFromCaption_AiImages_(f.Caption || f.Notes || '');
  if (byCaption) return byCaption;

  return '';
}

function splitKeywordsCsv_AiImages_(raw) {
  var s = String(raw || '').trim();
  if (!s) return [];
  return s.split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
}

function extractEnglishKeywordsFromListFieldValue_AiImages_(v) {
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

function extractEnglishKeywordsForGallery_AiImages_(tripFields) {
  var f = tripFields || {};
  return extractEnglishKeywordsFromListFieldValue_AiImages_(f.AI_SEO_FocusKeywords_List);
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

  var imp = ctx || {};
  var focusRaw = (f.AI_SEO_FocusKeywords != null && String(f.AI_SEO_FocusKeywords).trim()) ? String(f.AI_SEO_FocusKeywords) : String(imp.seoKeywords || '');
  var listRaw = (f.AI_SEO_FocusKeywords_List != null && (Array.isArray(f.AI_SEO_FocusKeywords_List) ? f.AI_SEO_FocusKeywords_List.length : String(f.AI_SEO_FocusKeywords_List).trim())) ? f.AI_SEO_FocusKeywords_List : (imp.seoKeywordsList || '');

  var listFromField = extractEnglishKeywordsFromListFieldValue_AiImages_(listRaw);
  listFromField = normalizeKeywordList_AiImages_(listFromField, 30);

  Logger.log('AI IMAGES KEYWORD FALLBACK DISABLED');

  Logger.log('AI IMAGES KEYWORD SOURCE (PRIMARY): ' + (((f.AI_SEO_FocusKeywords != null && String(f.AI_SEO_FocusKeywords).trim()) ? 'Trips.AI_SEO_FocusKeywords' : 'ImprovementWithAI.AI_SEO_FocusKeywords')));
  Logger.log('AI IMAGES KEYWORD SOURCE (LIST): ' + (((f.AI_SEO_FocusKeywords_List != null && (Array.isArray(f.AI_SEO_FocusKeywords_List) ? f.AI_SEO_FocusKeywords_List.length : String(f.AI_SEO_FocusKeywords_List).trim())) ? 'Trips.AI_SEO_FocusKeywords_List' : 'ImprovementWithAI.AI_SEO_FocusKeywords_List')));

  var focusItems = normalizeKeywordList_AiImages_(splitKeywordsCsv_AiImages_(focusRaw), 10);
  var featuredPrimary = (focusItems && focusItems.length) ? focusItems[0] : '';
  if (focusItems && focusItems.length > 1) {
    Logger.log('AI IMAGES: Ignoring extra tokens in AI_SEO_FocusKeywords (primary only): ' + JSON.stringify(focusItems.slice(1)));
  }

  var galleryPrimary = listFromField.length ? listFromField[0] : '';
  if (!galleryPrimary) galleryPrimary = featuredPrimary;

  var gallerySecondary = listFromField.length > 1 ? listFromField.slice(1) : [];

  var all = [];
  if (featuredPrimary) all.push(featuredPrimary);
  listFromField.forEach(function(x) { all.push(x); });
  all = normalizeKeywordList_AiImages_(all, 30);

  if (featuredPrimary) {
    Logger.log('AI IMAGES KEYWORD SOURCE: AI_SEO_FocusKeywords');
    Logger.log('AI IMAGES PRIMARY KEYWORD: ' + featuredPrimary);
  } else {
    Logger.log('AI IMAGES KEYWORD SOURCE: AI_SEO_FocusKeywords');
    Logger.log('AI IMAGES PRIMARY KEYWORD: (empty)');
  }
  Logger.log('AI IMAGES KEYWORD SOURCE: AI_SEO_FocusKeywords_List');
  Logger.log('AI IMAGES ADDITIONAL KEYWORDS: ' + JSON.stringify(listFromField.slice(0, 25)));
  if (!featuredPrimary && (!listFromField || !listFromField.length)) {
    Logger.log('AI Images: WARNING - No keywords found in AI_SEO_FocusKeywords or AI_SEO_FocusKeywords_List');
  }

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

function deriveSoftTopicHint_AiImages_(phrase) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  var low = raw.toLowerCase();

  function cap_(s) {
    var w = String(s || '').trim();
    if (!w) return '';
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  if (low.indexOf('alexandria') !== -1) return 'Alexandria';
  if (low.indexOf('luxor') !== -1) return 'Luxor';
  if (low.indexOf('coptic') !== -1 && low.indexOf('cairo') !== -1) return 'Coptic Cairo';
  if (low.indexOf('old') !== -1 && low.indexOf('cairo') !== -1) return 'Old Cairo';

  var remove = {
    day: true, tour: true, tours: true, trip: true, excursions: true, excursion: true,
    from: true, to: true, in: true, on: true, at: true, the: true, a: true, an: true, of: true,
    cairo: true, egypt: true
  };
  var parts = raw.split(/\s+/).map(function(x) { return String(x || '').replace(/[^A-Za-z0-9\u00C0-\u024F]/g, '').trim(); }).filter(function(x) { return !!x; });
  var kept = [];
  for (var i = 0; i < parts.length; i++) {
    var w = parts[i];
    var k = w.toLowerCase();
    if (remove[k]) continue;
    kept.push(cap_(w));
    if (kept.length >= 3) break;
  }
  return kept.length ? kept.join(' ') : cap_(parts[0] || '');
}

function applyNaturalSeoPlacementForEnglishImageMetadata_AiImages_(meta, ctx, keywordPlan, opts) {
  var m = meta || {};
  var out = {
    title: String(m.title || '').trim(),
    alt: String(m.alt || '').trim(),
    caption: String(m.caption || '').trim(),
    description: String(m.description || '').trim()
  };
  var kp = keywordPlan || {};
  var options = opts || {};

  function log_(msg) { Logger.log(String(msg || '')); }
  function escRe_(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function lc_(s) { return norm_(s).toLowerCase(); }
  function wordCount_(s) { var x = norm_(s); return x ? x.split(' ').filter(function(w) { return !!w; }).length : 0; }
  function isRoutey_(phrase) {
    var x = lc_(phrase);
    if (!x) return false;
    if (/\bfrom\b/.test(x) || /\bto\b/.test(x)) return true;
    if (/\bday\s+tours?\b/.test(x)) return true;
    return false;
  }
  function isExactFeaturedOk_(phrase) {
    var x = norm_(phrase);
    if (!x) return false;
    if (isGeneric_(x)) return false;
    if (/\bfrom\b|\bto\b/i.test(x)) return false;
    if (x.length > 34) return false;
    if (wordCount_(x) > 6) return false;
    return true;
  }
  function isGeneric_(phrase) {
    var x = lc_(phrase);
    if (!x) return true;
    if (x === 'tour' || x === 'tours' || x === 'day tour' || x === 'day tours') return true;
    return false;
  }
  function isBadContextWord_(phrase) {
    var x = lc_(phrase);
    if (!x) return true;
    if (x === 'day' || x === 'tour' || x === 'tours' || x === 'trip' || x === 'travel' || x === 'photo') return true;
    return false;
  }
  function tooHeavyForTitleAlt_(phrase) {
    var x = norm_(phrase);
    if (!x) return true;
    if (isRoutey_(x)) return true;
    if (x.length > 32) return true;
    if (wordCount_(x) > 6) return true;
    return false;
  }
  function isAltKeywordOk_(phrase) {
    var x = norm_(phrase);
    if (!x) return false;
    if (isGeneric_(x)) return false;
    if (/\bfrom\b|\bto\b/i.test(x)) return false;
    if (/\bday\b/i.test(x) && /\btours?\b/i.test(x)) return false;
    if (/\btours?\b/i.test(x)) return false;
    if (x.length > 28) return false;
    if (wordCount_(x) > 4) return false;
    return true;
  }
  function containsPhrase_(text, phrase) {
    var t = norm_(text);
    var p = norm_(phrase);
    if (!t || !p) return false;
    var re = new RegExp("\\b" + escRe_(p).replace(/\\s+/g, "\\\\s+") + "\\b", 'i');
    return re.test(t);
  }
  function countPhrase_(text, phrase) {
    var t = norm_(text);
    var p = norm_(phrase);
    if (!t || !p) return 0;
    var re = new RegExp("\\b" + escRe_(p).replace(/\\s+/g, "\\\\s+") + "\\b", 'ig');
    var m = t.match(re);
    return m ? m.length : 0;
  }
  function removePhraseAll_(text, phrase) {
    var t = norm_(text);
    var p = norm_(phrase);
    if (!t || !p) return t;
    var re = new RegExp("\\b" + escRe_(p).replace(/\\s+/g, "\\\\s+") + "\\b", 'ig');
    t = t.replace(re, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/\s+[.,;:]+/g, '');
    t = t.replace(/[.,;:]+\s+/g, ' ');
    return norm_(t);
  }
  function cleanupEndPunctuation_(s) {
    var x = norm_(s);
    if (!x) return '';
    x = x.replace(/\s+([,.;:!?])/g, '$1');
    x = x.replace(/([,;:])(\S)/g, '$1 $2');
    x = x.replace(/\s+/g, ' ').trim();
    return x;
  }
  function removeSeoAppendages_(field, text) {
    var before = norm_(text);
    if (!before) return before;
    var s = before;

    if (field === 'alt') {
      if (/,/.test(s)) {
        s = s.replace(/,\s*/g, ' ');
      }
    }

    var last = s;
    for (var i = 0; i < 4; i++) {
      s = s.replace(/\s*(?:[.?!]\s*)?(?:Part of|Included in)\s+[^.?!]+[.?!]?\s*$/i, '').trim();
      s = s.replace(/\s*(?:[.?!]\s*)?(?:Part of|Included in)\s+[^.?!]+[.?!]?\s*(?=$)/i, '').trim();
      if (s === last) break;
      last = s;
    }

    s = s.replace(/(^|[.!?]\s+)(Part of|Included in)\s+/ig, '$1');

    if (field === 'title') {
      if (/\s*\([^)]*\)\s*$/.test(s)) {
        s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    } else if (/\s*\([^)]*\)\s*$/.test(s)) {
      var par = s.match(/\(([^)]*)\)\s*$/);
      var inside = par && par[1] ? lc_(par[1]) : '';
      if (inside && (/\bday\s+tours?\b/.test(inside) || /\btours?\b/.test(inside) || /\bfrom\b|\bto\b/.test(inside))) {
        s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
      }
    }

    var dashMatch = s.match(/^(.*?)(?:\s[—–-]\s)([^—–-]+)\s*$/);
    if (dashMatch && dashMatch[1] && dashMatch[2]) {
      var right = norm_(dashMatch[2]);
      var rightLow = lc_(right);
      var seoishRight = /\bday\s+tours?\b/.test(rightLow) || /\btours?\b/.test(rightLow) || /\bfrom\b|\bto\b/.test(rightLow);
      if (seoishRight) {
        s = norm_(dashMatch[1]);
      }
    }

    s = cleanupEndPunctuation_(s);
    if (before !== s) {
      log_('SEO APPENDAGE REMOVED');
    }
    return s;
  }
  function ensureSentenceEnd_(s) {
    var x = norm_(s);
    if (!x) return '';
    if (/[.!?]$/.test(x)) return x;
    return x + '.';
  }
  function addSentenceIfFits_(base, sentence, maxLen) {
    var b = norm_(base);
    var s = norm_(sentence);
    if (!s) return b;
    if (!b) return s.length <= maxLen ? s : (s.substring(0, maxLen).trim());
    var join = /[.!?]$/.test(b) ? ' ' : '. ';
    var out2 = (b + join + s).trim();
    if (out2.length <= maxLen) return out2;
    return b;
  }
  function fitWithSuffix_(base, suffix, maxLen) {
    var b = norm_(base);
    var s = norm_(suffix);
    if (!b) return '';
    if (!s) return b.length <= maxLen ? b : b.substring(0, maxLen).trim();
    var out2 = (b + s).trim();
    if (out2.length <= maxLen) return out2;
    return '';
  }
  function sentenceCount_(s) {
    var x = norm_(s);
    if (!x) return 0;
    var parts = x.split(/[.!?]+/).map(function(z) { return norm_(z); }).filter(function(z) { return !!z; });
    return parts.length;
  }

  function collectCandidates_() {
    var all = [];
    function push_(x) { var s = norm_(x); if (s) all.push(s); }
    if (Array.isArray(options.extraCandidates)) options.extraCandidates.forEach(push_);
    if (kp.secondary && Array.isArray(kp.secondary)) kp.secondary.forEach(push_);
    if (kp.primary) push_(kp.primary);
    if (kp.all && Array.isArray(kp.all)) kp.all.forEach(push_);
    var seen = {};
    var outL = [];
    all.forEach(function(x) {
      var k = lc_(x);
      if (!k || seen[k]) return;
      seen[k] = true;
      outL.push(x);
    });
    return outL;
  }

  var candidates = collectCandidates_();
  var primary = '';
  for (var c = 0; c < candidates.length; c++) {
    var cand = candidates[c];
    if (!cand) continue;
    if (isGeneric_(cand)) continue;
    if (isRoutey_(cand) && wordCount_(cand) > 4) continue;
    primary = cand;
    break;
  }
  if (!primary) primary = norm_(kp.primary) || '';

  var ctxLocation = norm_(ctx && ctx.tripLocation ? ctx.tripLocation : '');
  var secondary = '';
  if (ctxLocation && ctxLocation.length <= 24 && wordCount_(ctxLocation) <= 3) secondary = ctxLocation;
  if (!secondary) secondary = deriveSoftTopicHint_AiImages_(primary) || '';
  if (secondary && primary && lc_(secondary) === lc_(primary)) secondary = '';
  if (secondary && isRoutey_(secondary)) secondary = '';
  if (secondary && (isGeneric_(secondary) || isBadContextWord_(secondary) || secondary.length < 3)) secondary = '';

  log_('PRIMARY IMAGE KEYWORD SELECTED: ' + (primary || ''));
  log_('SECONDARY IMAGE CONTEXT KEYWORD SELECTED: ' + (secondary || ''));

  var beforeTitle = out.title;
  var beforeAlt = out.alt;
  var beforeCaption = out.caption;
  var beforeDesc = out.description;

  out.title = removeSeoAppendages_('title', out.title);
  out.alt = removeSeoAppendages_('alt', out.alt);
  out.caption = removeSeoAppendages_('caption', out.caption);
  out.description = removeSeoAppendages_('description', out.description);

  out.title = collapseRepeatedPhrases_AiImages_(out.title, 16);
  out.alt = collapseRepeatedPhrases_AiImages_(out.alt, 40);
  out.caption = collapseRepeatedPhrases_AiImages_(out.caption, 28);
  out.description = collapseRepeatedPhrases_AiImages_(out.description, 60);

  function enforceFieldKeywordLimits_() {
    var fields = ['title', 'alt', 'caption', 'description'];
    function get_(f) { return norm_(out[f]); }
    function set_(f, v) { out[f] = cleanupEndPunctuation_(norm_(v)); }

    if (primary) {
      fields.forEach(function(f) {
        var v = get_(f);
        if (countPhrase_(v, primary) > 1) {
          set_(f, removePhraseAll_(v, primary));
          log_('EXACT PHRASE STUFFING REMOVED');
        }
      });
    }
    if (secondary) {
      fields.forEach(function(f) {
        var v = get_(f);
        if (countPhrase_(v, secondary) > 1) {
          set_(f, removePhraseAll_(v, secondary));
          log_('EXACT PHRASE STUFFING REMOVED');
        }
      });
    }

    if (primary) {
      var present = fields.filter(function(f) { return containsPhrase_(get_(f), primary); });
      if (present.length > 2) {
        fields.forEach(function(f) {
          if (f === 'description') return;
          if (f === 'caption') return;
          if (containsPhrase_(get_(f), primary)) {
            set_(f, removePhraseAll_(get_(f), primary));
            log_('EXACT PHRASE STUFFING REMOVED');
          }
        });
      } else if (present.length > 1) {
        if (containsPhrase_(get_('title'), primary)) {
          set_('title', removePhraseAll_(get_('title'), primary));
          log_('EXACT PHRASE STUFFING REMOVED');
        }
        if (containsPhrase_(get_('alt'), primary)) {
          set_('alt', removePhraseAll_(get_('alt'), primary));
          log_('EXACT PHRASE STUFFING REMOVED');
        }
      }
    }

    if (secondary) {
      var present2 = fields.filter(function(f) { return containsPhrase_(get_(f), secondary); });
      if (present2.length > 1) {
        fields.forEach(function(f) {
          if (f === 'title') return;
          if (containsPhrase_(get_(f), secondary)) {
            set_(f, removePhraseAll_(get_(f), secondary));
            log_('EXACT PHRASE STUFFING REMOVED');
          }
        });
      }
    }

    ['title', 'alt', 'caption'].forEach(function(f) {
      var v = get_(f);
      if (!v) return;
      var hasP = primary ? containsPhrase_(v, primary) : false;
      var hasS = secondary ? containsPhrase_(v, secondary) : false;
      if (hasP && hasS) {
        if (tooHeavyForTitleAlt_(primary) || f === 'alt') {
          set_(f, removePhraseAll_(v, primary));
        } else {
          set_(f, removePhraseAll_(v, secondary));
        }
        log_('EXACT PHRASE STUFFING REMOVED');
      }
    });
  }

  enforceFieldKeywordLimits_();

  var role = norm_(ctx && ctx.imageRole ? ctx.imageRole : '');
  var wantFeaturedAltKeyword = role === 'featured' && options && options.featuredAltKeyword === true;
  if (wantFeaturedAltKeyword) {
    var altKeyword = '';
    var pick = [];
    if (kp.primary) pick.push(kp.primary);
    if (kp.secondary && Array.isArray(kp.secondary)) pick = pick.concat(kp.secondary);
    if (kp.all && Array.isArray(kp.all)) pick = pick.concat(kp.all);
    for (var pk = 0; pk < pick.length; pk++) {
      var cand2 = norm_(pick[pk]);
      if (!cand2) continue;
      if (isAltKeywordOk_(cand2)) { altKeyword = cand2; break; }
    }
    if (!altKeyword) {
      var hint2 = deriveSoftTopicHint_AiImages_(primary);
      if (isAltKeywordOk_(hint2)) altKeyword = hint2;
    }

    if (altKeyword) {
      log_('FEATURED ALT KEYWORD SELECTED: ' + altKeyword);
      var currentAlt = norm_(out.alt) || 'Travel photo';
      if (!containsPhrase_(currentAlt, altKeyword)) {
        var kwLow = lc_(altKeyword);
        var useIn = /\bcairo\b|\bluxor\b|\balexandria\b|\begypt\b|\bgiza\b|\baswan\b|\bhurghada\b|\bsharm\b|\bdahab\b/.test(kwLow) || /^old\s+/i.test(altKeyword) || /^coptic\s+/i.test(altKeyword);
        var suffix = (useIn ? (' in ' + altKeyword) : (' at ' + altKeyword));
        var candidateAlt = fitWithSuffix_(currentAlt, suffix, 125);
        if (candidateAlt) {
          out.alt = candidateAlt;
          log_('FEATURED ALT KEYWORD INCLUDED: ' + altKeyword);
        } else {
          log_('FEATURED ALT KEYWORD SKIPPED (NO ROOM): ' + altKeyword);
        }
      } else {
        log_('FEATURED ALT KEYWORD ALREADY PRESENT: ' + altKeyword);
      }
    } else {
      log_('FEATURED ALT KEYWORD SKIPPED (NOT SUITABLE)');
    }
  }

  function simplifySeoKeywordToNaturalPhrase_(phrase) {
    var raw = norm_(phrase);
    if (!raw) return '';
    var low = raw.toLowerCase();
    function titleCaseWords_(s) {
      return String(s || '').split(/\s+/).map(function(w) {
        var x = String(w || '').trim();
        if (!x) return '';
        return x.charAt(0).toUpperCase() + x.slice(1);
      }).filter(function(x) { return !!x; }).join(' ');
    }
    if (/\bcoptic\s+cairo\b/.test(low)) return 'Coptic Cairo';
    if (/\bold\s+cairo\b/.test(low)) return 'Old Cairo';
    var m = low.match(/^(.+?)\s+day\s+tours?$/);
    if (m && m[1]) {
      var city = m[1].trim();
      if (/\begypt\b/.test(city)) {
        city = city.replace(/\begypt\b/g, '').replace(/\s+/g, ' ').trim();
        city = titleCaseWords_(city);
        return (city ? (city + ' day tour in Egypt') : 'a day tour in Egypt');
      }
      return titleCaseWords_(city) + ' day tour';
    }
    m = low.match(/^day\s+tours?\s+(.+?)$/);
    if (m && m[1]) {
      var loc = m[1].trim();
      if (/\begypt\b/.test(loc)) {
        loc = loc.replace(/\begypt\b/g, '').replace(/\s+/g, ' ').trim();
        loc = titleCaseWords_(loc);
        return (loc ? ('a day tour in ' + loc + ', Egypt') : 'a day tour in Egypt');
      }
      return 'a day tour in ' + titleCaseWords_(loc);
    }
    m = low.match(/^day\s+tours?\s+from\s+(.+?)$/);
    if (m && m[1]) {
      var fromCity = m[1].trim();
      fromCity = titleCaseWords_(fromCity);
      return 'a day tour from ' + fromCity;
    }
    m = low.match(/^(.+?)\s+day\s+tour\s+from\s+(.+?)$/);
    if (m && m[1] && m[2]) {
      var dest = m[1].trim();
      var from2 = m[2].trim();
      dest = titleCaseWords_(dest);
      from2 = titleCaseWords_(from2);
      return 'a day trip from ' + from2 + ' to ' + dest;
    }
    m = low.match(/^(.+?)\s+to\s+(.+?)\s+day\s+tour$/);
    if (m && m[1] && m[2]) {
      var from3 = m[1].trim();
      var to3 = m[2].trim();
      from3 = titleCaseWords_(from3);
      to3 = titleCaseWords_(to3);
      return 'a day trip from ' + from3 + ' to ' + to3;
    }
    if (/\bday\s+tours?\b/.test(low)) return 'a day tour';
    if (/\btour\b/.test(low) && low.indexOf('tour') === low.lastIndexOf('tour')) return raw.replace(/\btour\b/i, '').replace(/\s+/g, ' ').trim();
    return raw;
  }

  function buildPrimarySeoSentence_() {
    if (!primary) return '';
    var useExact = !(isRoutey_(primary) || /\bday\s+tours?\b/.test(lc_(primary)));
    var mention = useExact ? primary : simplifySeoKeywordToNaturalPhrase_(primary);
    mention = norm_(mention);
    if (!mention) mention = primary;
    var mLow = lc_(mention);
    if (/^(a|an)\b/.test(mLow)) return 'A memorable stop on ' + mention + '.';
    if (/\bday\s+tour\b/.test(mLow) || /\bday\s+trip\b/.test(mLow)) return 'A memorable stop on a ' + mention + '.';
    if (/\btours\b/.test(mLow)) return 'A popular highlight for ' + mention + '.';
    if (/\btour\b/.test(mLow)) return 'A memorable highlight on a ' + mention + '.';
    return 'A memorable highlight for travelers interested in ' + mention + '.';
  }

  var desc = norm_(out.description);
  var captionBase = norm_(out.caption);
  var altBase = norm_(out.alt);
  var titleBase = norm_(out.title);

  if (!desc) {
    var seed = captionBase || altBase || titleBase || 'Travel photo';
    desc = ensureSentenceEnd_(seed);
  } else if (sentenceCount_(desc) === 0) {
    desc = ensureSentenceEnd_(desc);
  }

  var needPrimaryInDesc = primary ? !containsPhrase_(desc, primary) : false;
  if (primary && needPrimaryInDesc) {
    desc = addSentenceIfFits_(desc, buildPrimarySeoSentence_(), 300);
  }

  var wantExactFeaturedPrimary = role === 'featured' && options && options.featuredExactPrimary === true;
  if (wantExactFeaturedPrimary && primary) {
    if (containsPhrase_(desc, primary)) {
      log_('FEATURED EXACT PRIMARY ALREADY PRESENT: ' + primary);
    } else if (isExactFeaturedOk_(primary)) {
      var candidateExact = addSentenceIfFits_(desc, 'A popular highlight for ' + primary + '.', 300);
      if (candidateExact !== desc && containsPhrase_(candidateExact, primary)) {
        desc = candidateExact;
        log_('FEATURED EXACT PRIMARY INCLUDED: ' + primary);
      } else {
        log_('FEATURED EXACT PRIMARY SKIPPED (NO ROOM): ' + primary);
      }
    } else {
      log_('FEATURED EXACT PRIMARY SKIPPED (ROUTEY/HEAVY): ' + primary);
    }
  }

  var descSentences = sentenceCount_(desc);
  if (descSentences < 2) {
    if (secondary && !containsPhrase_(desc, secondary)) {
      desc = addSentenceIfFits_(desc, 'A great addition to a ' + secondary + ' itinerary.', 300);
    } else if (primary && containsPhrase_(desc, primary)) {
      desc = addSentenceIfFits_(desc, 'A timeless scene for travelers.', 300);
    }
  } else if (descSentences < 3) {
    if (secondary && !containsPhrase_(desc, secondary)) {
      desc = addSentenceIfFits_(desc, 'A great addition to a ' + secondary + ' itinerary.', 300);
    }
  }

  out.description = cleanupEndPunctuation_(desc);

  out.title = norm_(out.title) || 'Travel photo';
  out.alt = norm_(out.alt) || 'Travel photo';
  out.caption = norm_(out.caption);
  out.description = norm_(out.description);

  if (out.title.length > 60) out.title = out.title.substring(0, 60).trim();
  if (out.caption.length > 150) out.caption = out.caption.substring(0, 150).trim();
  if (out.description.length > 300) out.description = out.description.substring(0, 300).trim();
  if (out.alt.length > 125) out.alt = out.alt.substring(0, 125).trim();

  if (beforeTitle !== out.title) log_('TITLE NORMALIZED FOR NATURAL SEO');
  if (beforeAlt !== out.alt) log_('ALT TEXT NORMALIZED FOR NATURAL SEO');
  if (beforeCaption !== out.caption) log_('CAPTION NORMALIZED FOR NATURAL SEO');
  if (beforeDesc !== out.description) log_('DESCRIPTION NORMALIZED FOR NATURAL SEO');

  log_('NATURAL SEO PLACEMENT APPLIED');
  return out;
}

function shouldEnforceCivilizationMuseumEntity_AiImages_(ctx, tripFields, tripImprovement) {
  var parts = [];
  parts.push(ctx && ctx.tripTitle ? ctx.tripTitle : '');
  parts.push(ctx && ctx.seoTitle ? ctx.seoTitle : '');
  parts.push(ctx && ctx.seoDesc ? ctx.seoDesc : '');
  parts.push(ctx && ctx.overview ? ctx.overview : '');
  parts.push(ctx && ctx.itinerary ? ctx.itinerary : '');
  parts.push(tripFields && tripFields.Title ? tripFields.Title : '');
  parts.push(tripImprovement && tripImprovement.AI_SEO_Title ? tripImprovement.AI_SEO_Title : '');
  parts.push(tripImprovement && tripImprovement.AI_SEO_Meta_Description ? tripImprovement.AI_SEO_Meta_Description : '');
  var hay = parts.join(' ').toLowerCase();
  if (!hay) return false;
  if (hay.indexOf('nmec') !== -1) return true;
  if (hay.indexOf('national museum of egyptian civilization') !== -1) return true;
  if (hay.indexOf('egyptian civilization') !== -1) return true;
  if (hay.indexOf('civilization museum') !== -1) return true;
  return false;
}

function enforceCanonicalMuseumEntityForEnglishImageMeta_AiImages_(meta, ctx, tripFields, tripImprovement) {
  var m = meta || {};
  if (!shouldEnforceCivilizationMuseumEntity_AiImages_(ctx, tripFields, tripImprovement)) return m;

  var canonical = 'National Museum of Egyptian Civilization';
  function hasCivilization_(s) {
    var x = String(s || '').toLowerCase();
    return x.indexOf('civilization') !== -1 || x.indexOf('nmec') !== -1;
  }
  function fix_(field, value) {
    var v = String(value || '');
    if (!v) return v;
    if (hasCivilization_(v)) return v;
    var before = v;
    v = v.replace(/\bthe\s+egyptian\s+museum\b/ig, canonical);
    v = v.replace(/\begyptian\s+museum\b/ig, canonical);
    if (v !== before) Logger.log('AI Images Enhancer: entity rewrite (' + field + '): egyptian museum -> civilization museum family');
    return v;
  }
  return {
    title: fix_('title', m.title),
    caption: fix_('caption', m.caption),
    description: fix_('description', m.description),
    alt: fix_('alt', m.alt)
  };
}

function englishImageSeoStuffingGuard_AiImages_(meta, ctx, keywordPlan) {
  var m = meta || {};
  var out = {
    title: String(m.title || '').trim(),
    caption: String(m.caption || '').trim(),
    description: String(m.description || '').trim(),
    alt: String(m.alt || '').trim()
  };

  function escRe_(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function isSeoish_(p) {
    var x = String(p || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!x) return false;
    if (x.length < 6) return false;
    if (/\b(day\s+tours?|tours?|tour|from)\b/.test(x)) return true;
    if (/\bcairo\b/.test(x) && /\b(day\s+tours?|tours?|tour)\b/.test(x)) return true;
    return false;
  }

  var phrases = [
    'day tours cairo',
    'day tours from cairo',
    'cairo day tours',
    'cairo egypt day tours',
    'day tours cairo egypt',
    'alexandria day tour from cairo',
    'old cairo tour',
    'coptic cairo tour',
    'cairo to luxor day tour',
    'day tour',
    'day tours'
  ];

  var kp = keywordPlan || {};
  var cand = [];
  if (kp.primary) cand.push(kp.primary);
  if (kp.secondary && Array.isArray(kp.secondary)) {
    for (var i = 0; i < kp.secondary.length; i++) cand.push(kp.secondary[i]);
  }
  if (kp.all && Array.isArray(kp.all)) {
    for (var j = 0; j < kp.all.length; j++) cand.push(kp.all[j]);
  }

  var seen = {};
  var extra = [];
  cand.forEach(function(x) {
    var s = norm_(x);
    var k = s.toLowerCase();
    if (!s || seen[k]) return;
    seen[k] = true;
    if (isSeoish_(s)) extra.push(s);
  });
  extra.forEach(function(x) { phrases.push(x); });

  var uniq = {};
  var finalPhrases = [];
  phrases.forEach(function(x) {
    var s = norm_(x);
    var k = s.toLowerCase();
    if (!s || uniq[k]) return;
    uniq[k] = true;
    finalPhrases.push(s);
  });
  finalPhrases.sort(function(a, b) { return b.length - a.length; });

  function stripPhrases_(text) {
    var s = norm_(text);
    if (!s) return s;
    for (var i = 0; i < finalPhrases.length; i++) {
      var p = finalPhrases[i];
      if (!p) continue;
      var re = new RegExp("\\b" + escRe_(p).replace(/\\s+/g, "\\\\s+") + "\\b", 'ig');
      s = s.replace(re, ' ');
    }
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/\s+[.,;:]+/g, '');
    s = s.replace(/[.,;:]+\s+/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  var applied = false;

  function cleanField_(field, value) {
    var before = norm_(value);
    if (!before) return before;

    var s = before;
    if (field === 'alt') {
      s = s.replace(/,\s*/g, ' ');
    }

    s = stripPhrases_(s);

    var maxWords = field === 'title' ? 16 : (field === 'caption' ? 28 : (field === 'description' ? 60 : 40));
    s = collapseRepeatedPhrases_AiImages_(s, maxWords);
    s = norm_(s);

    if (field === 'title') {
      var low = s.toLowerCase();
      if (/\b(day\s+tours?|tours?|tour)\b/.test(low)) {
        s = s.replace(/\b(Day\s+Tours?|Tours?|Tour)\b/gi, ' ');
        s = norm_(s);
      }
    }

    if (!s) {
      if (field === 'title') s = 'Travel photo';
      else if (field === 'alt') s = 'Travel photo';
    }

    if (before !== s) {
      applied = true;
      if (field === 'title') Logger.log('TITLE KEYWORD STUFFING CLEANED: "' + before + '" -> "' + s + '"');
      else if (field === 'alt') Logger.log('ALT TEXT KEYWORD STUFFING CLEANED: "' + before + '" -> "' + s + '"');
      else if (field === 'caption') Logger.log('CAPTION KEYWORD STUFFING CLEANED');
      else if (field === 'description') Logger.log('DESCRIPTION KEYWORD STUFFING CLEANED');
    }
    return s;
  }

  out.title = cleanField_('title', out.title);
  out.alt = cleanField_('alt', out.alt);
  out.caption = cleanField_('caption', out.caption);
  out.description = cleanField_('description', out.description);

  if (applied) Logger.log('ENGLISH IMAGE SEO STUFFING GUARD APPLIED');
  return out;
}

function blendExactPhraseNaturally_AiImages_(caption, description, phrase) {
  var c = String(caption || '').trim();
  var d = String(description || '').trim();
  var p = String(phrase || '').replace(/\s+/g, ' ').trim();
  if (!p) return { caption: c, description: d };

  function escRe_(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function count_(text, phraseText) {
    var t = String(text || '');
    if (!t) return 0;
    var re = new RegExp(escRe_(phraseText), 'ig');
    var m = t.match(re);
    return m ? m.length : 0;
  }
  function removeAll_(text, phraseText) {
    var t = String(text || '');
    if (!t) return '';
    var re = new RegExp(escRe_(phraseText), 'ig');
    t = t.replace(re, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/\s+[.,;:]+/g, '');
    t = t.replace(/[.,;:]+\s+/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }
  function appendSentence_(text, sentence, maxLen) {
    var s = String(text || '').trim();
    var add = String(sentence || '').trim();
    if (!add) return s;
    if (!s) return add.length <= maxLen ? add : add.substring(0, maxLen).trim();
    var join = /[.!?]$/.test(s) ? ' ' : '. ';
    var out = s + join + add;
    if (out.length <= maxLen) return out;
    return '';
  }

  function ensureInField_(value, maxLen, sentence, fieldLabel) {
    var s = String(value || '').trim();
    var cnt = count_(s, p);
    if (cnt > 1) s = removeAll_(s, p);
    if (cnt === 1) return s;

    var appended = appendSentence_(s, sentence, maxLen);
    if (appended) {
      Logger.log('EXACT KEYWORD PHRASE NATURALIZED IN ' + fieldLabel + ': ' + p);
      return appended;
    }

    var base = String(s || '').trim();
    var join = (!base ? '' : (/[.!?]$/.test(base) ? ' ' : '. '));
    var allowedBaseLen = maxLen - (join.length + String(sentence || '').length);
    if (allowedBaseLen > 10 && base && base.length > allowedBaseLen) {
      try { base = truncateByWords_AiImages_(base, allowedBaseLen); } catch (eT) { base = base.substring(0, allowedBaseLen).trim(); }
      base = String(base || '').trim();
      appended = appendSentence_(base, sentence, maxLen);
      if (appended) {
        Logger.log('EXACT KEYWORD PHRASE NATURALIZED IN ' + fieldLabel + ' (TRIMMED): ' + p);
        return appended;
      }
    }

    if (String(sentence || '').length <= maxLen) {
      Logger.log('EXACT KEYWORD PHRASE INSERTED AS SENTENCE IN ' + fieldLabel + ': ' + p);
      return String(sentence || '').trim();
    }

    return s;
  }

  c = ensureInField_(c, 150, 'Part of ' + p + '.', 'CAPTION');
  d = ensureInField_(d, 300, 'Included in ' + p + '.', 'DESCRIPTION');
  return { caption: c, description: d };
}

function naturalizeTitleAltWithPhrase_AiImages_(title, alt, phrase) {
  var t = String(title || '').trim();
  var a = String(alt || '').trim();
  var p = String(phrase || '').replace(/\s+/g, ' ').trim();
  if (!p) return { title: t, alt: a };

  function escRe_(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function fitWithSuffix_(base, suffix, maxLen) {
    var b = norm_(base);
    var s = String(suffix || '');
    if (!b) return '';
    if (b.length + s.length <= maxLen) return (b + s).trim();
    var allowed = maxLen - s.length;
    if (allowed < 8) return '';
    try { b = truncateByWords_AiImages_(b, allowed); } catch (e) { b = b.substring(0, allowed).trim(); }
    b = norm_(b);
    if (!b) return '';
    if (b.length + s.length <= maxLen) return (b + s).trim();
    return '';
  }

  function ensureInTitle_(text) {
    var before = norm_(text);
    if (!before) {
      var hint = deriveSoftTopicHint_AiImages_(p);
      before = hint ? (hint + ' photo') : 'Travel photo';
    }
    var out = before;
    var re = new RegExp(escRe_(p), 'ig');
    var m = out.match(re);
    var count = m ? m.length : 0;
    if (count === 1 && out.length <= 60) return out;
    if (count > 1) out = out.replace(re, ' ');
    out = norm_(out);

    var suffix = ' (' + p + ')';
    var maxBase = 60 - suffix.length;
    if (maxBase < 8) maxBase = 8;

    function splitDash_(s) {
      var x = norm_(s);
      if (!x) return { left: '', right: '' };
      var parts = x.split('—').map(function(z) { return norm_(z); }).filter(function(z) { return !!z; });
      if (parts.length > 1) {
        return { left: parts.slice(0, parts.length - 1).join(' — '), right: parts[parts.length - 1] };
      }
      parts = x.split(/\s[-–]\s/).map(function(z) { return norm_(z); }).filter(function(z) { return !!z; });
      if (parts.length > 1) {
        return { left: parts.slice(0, parts.length - 1).join(' - '), right: parts[parts.length - 1] };
      }
      return { left: x, right: '' };
    }

    function buildBaseKeepingRight_(base, maxLenBase) {
      var sp = splitDash_(base);
      var left = norm_(sp.left);
      var right = norm_(sp.right);
      if (!right) return left;
      if (right.length > maxLenBase) right = right.substring(0, maxLenBase).trim();
      var join = ' — ';
      var remaining = maxLenBase - right.length;
      if (!left || remaining <= join.length + 8) return right;
      var allowedLeft = remaining - join.length;
      try { left = truncateByWords_AiImages_(left, allowedLeft); } catch (eL) { left = left.substring(0, allowedLeft).trim(); }
      left = norm_(left);
      if (!left) return right;
      return (left + join + right).trim();
    }

    var base2 = buildBaseKeepingRight_(out, maxBase);
    var dashSuffix = ' — ' + p;
    var maxBaseDash = 60 - dashSuffix.length;
    if (maxBaseDash < 8) maxBaseDash = 8;
    var baseDash = buildBaseKeepingRight_(out, maxBaseDash);
    var spR = splitDash_(out);
    var rightPart = norm_(spR && spR.right ? spR.right : '');
    var redundantDash = false;
    if (rightPart) {
      var reRight = new RegExp("\\b" + escRe_(rightPart).replace(/\\s+/g, "\\\\s+") + "\\b", 'i');
      if (reRight.test(p)) redundantDash = true;
    }
    if (!redundantDash) {
      var candidateDash = fitWithSuffix_(baseDash, dashSuffix, 60);
      if (candidateDash) return candidateDash;
    }

    var candidateParen = fitWithSuffix_(base2, suffix, 60);
    if (candidateParen) return candidateParen;

    return base2 && base2.length <= 60 ? base2 : (out.length <= 60 ? out : out.substring(0, 60).trim());
  }

  function ensureInAlt_(text) {
    var before = norm_(text);
    if (!before) before = 'Travel photo';
    var out = before;
    var re = new RegExp(escRe_(p), 'ig');
    var m = out.match(re);
    var count = m ? m.length : 0;
    if (count === 1 && out.length <= 125) return out;
    if (count > 1) out = out.replace(re, ' ');
    out = norm_(out);

    var sentence = ' Part of ' + p + '.';
    var candidate2 = fitWithSuffix_(out, sentence, 125);
    if (candidate2) return candidate2;
    return out.length <= 125 ? out : out.substring(0, 125).trim();
  }

  var beforeT = t;
  var beforeA = a;
  t = ensureInTitle_(t);
  a = ensureInAlt_(a);
  if (beforeT !== t) Logger.log('TITLE KEYWORD STUFFING CLEANED: "' + String(beforeT || '').trim() + '" -> "' + t + '"');
  if (beforeA !== a) Logger.log('ALT TEXT KEYWORD STUFFING CLEANED: "' + String(beforeA || '').trim() + '" -> "' + a + '"');
  if (!t) t = 'Travel photo';
  if (!a) a = 'Travel photo';
  return { title: t, alt: a };
}

function enrichThinDescription_AiImages_(title, caption, alt, description, phrase) {
  var t = String(title || '').trim();
  var c = String(caption || '').trim();
  var a = String(alt || '').trim();
  var d = String(description || '').trim();
  var p = String(phrase || '').replace(/\s+/g, ' ').trim();
  if (!p) return d;

  function escRe_(s) { return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function stripPartOf_(s) {
    var x = norm_(s);
    if (!x) return '';
    x = x.replace(new RegExp("\\bPart of\\s+" + escRe_(p) + "\\.?$", 'i'), '').trim();
    x = x.replace(new RegExp("\\bIncluded in\\s+" + escRe_(p) + "\\.?$", 'i'), '').trim();
    return norm_(x);
  }
  function hasOnlyPhraseSentence_(s) {
    var x = norm_(s);
    if (!x) return true;
    var re = new RegExp("^(Included in|Part of)\\s+" + escRe_(p) + "\\.?$", 'i');
    return re.test(x);
  }
  function wordCount_(s) {
    var x = norm_(s);
    if (!x) return 0;
    return x.split(' ').filter(function(w) { return !!w; }).length;
  }
  function ensurePeriod_(s) {
    var x = norm_(s);
    if (!x) return '';
    if (/[.!?]$/.test(x)) return x;
    return x + '.';
  }
  function addSentence_(base, sentence, maxLen) {
    var b = norm_(base);
    var s = norm_(sentence);
    if (!s) return b;
    if (!b) return s.length <= maxLen ? s : (s.substring(0, maxLen).trim());
    var join = /[.!?]$/.test(b) ? ' ' : '. ';
    var out = (b + join + s).trim();
    if (out.length <= maxLen) return out;
    return b;
  }

  var tooThin = hasOnlyPhraseSentence_(d) || wordCount_(stripPartOf_(d)) < 10;
  if (!tooThin) return d;

  var base = stripPartOf_(d);
  var capBase = stripPartOf_(c);
  var altBase = stripPartOf_(a);
  if (!capBase && altBase) capBase = altBase;

  var out = '';
  if (capBase) out = addSentence_(out, ensurePeriod_(capBase), 300);
  if (altBase && altBase !== capBase) out = addSentence_(out, ensurePeriod_(altBase), 300);
  if (!out) {
    var t2 = stripPartOf_(t);
    if (t2) out = addSentence_(out, ensurePeriod_(t2), 300);
  }
  out = addSentence_(out, 'Included in ' + p + '.', 300);
  out = norm_(out);
  if (out && out !== d) Logger.log('DESCRIPTION ENRICHED FROM CAPTION/ALT');
  return out || d;
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

  if (role === 'featured') {
    var raw = f.AI_SEO_FocusKeywords || '';
    var items = splitKeywordsCsv_AiImages_(raw);
    return items;
  }

  if (role === 'gallery') {
    var en = extractEnglishKeywordsForGallery_AiImages_(f);
    return en;
  }

  return [];
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
  var primaryTopic = deriveSoftTopicHint_AiImages_(primaryKeyword) || primaryKeyword;
  var secondaryTopic = deriveSoftTopicHint_AiImages_(secondaryKeywords && secondaryKeywords.length ? secondaryKeywords[0] : '') || (secondaryKeywords && secondaryKeywords.length ? secondaryKeywords[0] : '');

  var text =
    "You are generating SEO + accessibility metadata for a travel photo.\n" +
    "You can SEE the image. Describe only what is visible. Do NOT invent details.\n" +
    "You MAY use the provided trip context for naming, but do NOT claim it is visible unless it is.\n" +
    "Write like a premium global travel brand (clear, natural, non-spammy).\n" +
    "TITLE: Keep it short and natural. Prefer a visible subject. Optionally add ONE light trip context phrase if it fits naturally.\n" +
    "TITLE FORMAT (suggested): '<Visible Subject> — <Place>' or '<Visible Subject>'\n" +
    "Avoid filler like 'Experience'/'Enjoy'.\n" +
    "Avoid generic filler like: 'Experience the magic', 'Immerse yourself', 'Unforgettable moment'.\n" +
    "Avoid repeating the same word or phrase back-to-back (e.g., 'tour tour' or 'desert tour desert tour').\n" +
    (forbiddenTitles.length ? ("TITLE UNIQUENESS (STRICT): Do NOT reuse any of these titles: " + JSON.stringify(forbiddenTitles) + "\n") : "") +
    (forbiddenTitles.length ? "If the title would repeat, focus on a DIFFERENT visible detail/angle and produce a different title.\n" : "") +
    "KEYWORDS: Use as soft topic grounding only. Do NOT copy-paste keyword phrases. No keyword stuffing.\n" +
    "ALT: Natural description of what is visible. Do NOT output comma-separated keyword lists.\n" +
    "CAPTION/DESCRIPTION: Natural language. At most one light contextual mention. Do NOT repeat phrases.\n" +
    "Return ONLY valid JSON with keys: title, caption, description, alt.\n" +
    "Limits: title<=60 chars, caption<=150 chars, description<=300 chars, alt<=125 chars.\n\n" +
    "Trip Title: " + tripTitle + "\n" +
    "Trip SEO Title: " + tripSeoTitle + "\n" +
    "Location: " + tripLocation + "\n" +
    "Tour Type: " + tripType + "\n" +
    "Image Role: " + role + "\n" +
    "Primary Topic: " + JSON.stringify(primaryTopic) + "\n" +
    "Optional related topic: " + JSON.stringify(secondaryTopic) + "\n" +
    "All Keywords (trip): " + JSON.stringify(allKeywords) + "\n" +
    (preferredTitleKeyword ? ("Topic hint (soft, do NOT copy-paste): " + JSON.stringify(preferredTitleKeyword) + "\n") : "");

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
        var wr = resolveImageRole_AiImages_(tripFields, wf) || 'gallery';
        if (wr === 'gallery') galleryCountHint++;
      }
      var secondary = (tripKeywordPlans && tripKeywordPlans.gallery && tripKeywordPlans.gallery.secondary) ? tripKeywordPlans.gallery.secondary : [];
      var perGallery = (galleryCountHint > 0 && secondary.length > 0) ? Math.ceil(secondary.length / galleryCountHint) : 0;
      if (perGallery < 1) perGallery = 1;
      if (perGallery > 12) perGallery = 12;
      var galleryCursor = 0;
      var galleryPhrasePool = [];
      try {
        var gp = [];
        if (tripKeywordPlans && tripKeywordPlans.gallery) {
          if (tripKeywordPlans.gallery.primary) gp.push(String(tripKeywordPlans.gallery.primary));
          if (tripKeywordPlans.gallery.secondary && Array.isArray(tripKeywordPlans.gallery.secondary)) {
            tripKeywordPlans.gallery.secondary.forEach(function(x) { gp.push(String(x || '').trim()); });
          }
        }
        galleryPhrasePool = normalizeKeywordList_AiImages_(gp, 30);
      } catch (eGpp) {}
      var galleryPhraseCursor = 0;
      
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
          var role = resolveImageRole_AiImages_(tripFields, imageFields) || 'gallery';
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
            preferredTitleKeywordForImage = deriveSoftTopicHint_AiImages_(basePrimary) || basePrimary || '';
          } else {
            if (secondary && secondary.length) {
              var chunk = [];
              for (var kk = 0; kk < perGallery; kk++) {
                var idx = (galleryCursor + kk) % secondary.length;
                if (secondary[idx]) chunk.push(secondary[idx]);
              }
              kwPlanForImage.secondary = normalizeKeywordList_AiImages_(chunk, 12);
              keywordSuffixSecondary = (kwPlanForImage.secondary && kwPlanForImage.secondary.length) ? String(kwPlanForImage.secondary[0] || '') : '';
              var hint = deriveSoftTopicHint_AiImages_(keywordSuffixSecondary) || deriveSoftTopicHint_AiImages_(basePrimary) || '';
              preferredTitleKeywordForImage = hint || basePrimary || '';
              galleryCursor = (galleryCursor + perGallery) % secondary.length;
            } else {
              preferredTitleKeywordForImage = deriveSoftTopicHint_AiImages_(basePrimary) || basePrimary || '';
            }
          }
          
          var phraseForNaturalUseForImage = '';
          if (role === 'gallery' && galleryPhrasePool && galleryPhrasePool.length) {
            phraseForNaturalUseForImage = String(galleryPhrasePool[galleryPhraseCursor % galleryPhrasePool.length] || '').trim();
            galleryPhraseCursor++;
          }
          if (!phraseForNaturalUseForImage) phraseForNaturalUseForImage = keywordSuffixSecondary || basePrimary || '';

          if (openAiKey && imageUrl) {
            aiResult = callOpenAiVisionForImageMeta_AiImages_(imageUrl, ctx, kwPlanForImage, { preferredTitleKeyword: preferredTitleKeywordForImage });
          } else {
            var prompt = buildImagesPrompt_(ctx, kwPlanForImage, { forbiddenTitles: usedTitles, preferredTitleKeyword: preferredTitleKeywordForImage });
            aiResult = callAi_(prompt);
          }
          
          if (!aiResult || typeof aiResult !== 'object') {
            throw new Error('Invalid AI result for Image ' + imageId);
          }
          
          var title = (aiResult.title || '').toString().trim();
          var caption = (aiResult.caption || '').toString().trim();
          var description = (aiResult.description || '').toString().trim();
          var alt = (aiResult.alt || '').toString().trim();

          title = cleanupImageTitle_AiImages_(title);
          title = collapseRepeatedPhrases_AiImages_(title, 16);
          caption = collapseRepeatedPhrases_AiImages_(caption, 28);
          description = collapseRepeatedPhrases_AiImages_(description, 60);
          alt = collapseRepeatedPhrases_AiImages_(alt, 40);
          caption = removeDashesFromText_AiImages_(caption);
          description = removeDashesFromText_AiImages_(description);
          
          var guarded0 = englishImageSeoStuffingGuard_AiImages_({ title: title, caption: caption, description: description, alt: alt }, ctx, kwPlanForImage);
          title = guarded0.title;
          caption = guarded0.caption;
          description = guarded0.description;
          alt = guarded0.alt;
          var natural0 = applyNaturalSeoPlacementForEnglishImageMetadata_AiImages_(
            { title: title, caption: caption, description: description, alt: alt },
            ctx,
            kwPlanForImage,
            { extraCandidates: phraseForNaturalUseForImage ? [phraseForNaturalUseForImage] : [], featuredExactPrimary: role === 'featured', featuredAltKeyword: role === 'featured' }
          );
          natural0 = enforceCanonicalMuseumEntityForEnglishImageMeta_AiImages_(natural0, ctx, f, tripImprovement);
          title = natural0.title;
          caption = natural0.caption;
          description = natural0.description;
          alt = natural0.alt;
          
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
                  title = cleanupImageTitle_AiImages_(title);
                  title = collapseRepeatedPhrases_AiImages_(title, 16);
                  caption = collapseRepeatedPhrases_AiImages_(caption, 28);
                  description = collapseRepeatedPhrases_AiImages_(description, 60);
                  alt = collapseRepeatedPhrases_AiImages_(alt, 40);
                  caption = removeDashesFromText_AiImages_(caption);
                  description = removeDashesFromText_AiImages_(description);
                  
                  var guarded1 = englishImageSeoStuffingGuard_AiImages_({ title: title, caption: caption, description: description, alt: alt }, ctx, kwPlanForImage);
                  title = guarded1.title;
                  caption = guarded1.caption;
                  description = guarded1.description;
                  alt = guarded1.alt;
                  var natural1 = applyNaturalSeoPlacementForEnglishImageMetadata_AiImages_(
                    { title: title, caption: caption, description: description, alt: alt },
                    ctx,
                    kwPlanForImage,
                    { extraCandidates: phraseForNaturalUseForImage ? [phraseForNaturalUseForImage] : [], featuredExactPrimary: role === 'featured', featuredAltKeyword: role === 'featured' }
                  );
                  natural1 = enforceCanonicalMuseumEntityForEnglishImageMeta_AiImages_(natural1, ctx, f, tripImprovement);
                  title = natural1.title;
                  caption = natural1.caption;
                  description = natural1.description;
                  alt = natural1.alt;
                  
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
                  title = cleanupImageTitle_AiImages_(title);
                  title = collapseRepeatedPhrases_AiImages_(title, 16);
                  caption = collapseRepeatedPhrases_AiImages_(caption, 28);
                  description = collapseRepeatedPhrases_AiImages_(description, 60);
                  alt = collapseRepeatedPhrases_AiImages_(alt, 40);
                  caption = removeDashesFromText_AiImages_(caption);
                  description = removeDashesFromText_AiImages_(description);
                  
                  var guarded2 = englishImageSeoStuffingGuard_AiImages_({ title: title, caption: caption, description: description, alt: alt }, ctx, kwPlanForImage);
                  title = guarded2.title;
                  caption = guarded2.caption;
                  description = guarded2.description;
                  alt = guarded2.alt;
                  var natural2 = applyNaturalSeoPlacementForEnglishImageMetadata_AiImages_(
                    { title: title, caption: caption, description: description, alt: alt },
                    ctx,
                    kwPlanForImage,
                    { extraCandidates: phraseForNaturalUseForImage ? [phraseForNaturalUseForImage] : [], featuredExactPrimary: role === 'featured', featuredAltKeyword: role === 'featured' }
                  );
                  natural2 = enforceCanonicalMuseumEntityForEnglishImageMeta_AiImages_(natural2, ctx, f, tripImprovement);
                  title = natural2.title;
                  caption = natural2.caption;
                  description = natural2.description;
                  alt = natural2.alt;
                  
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
    var primaryRaw = (tripFields && tripFields.AI_SEO_FocusKeywords) ? String(tripFields.AI_SEO_FocusKeywords) : (imp.seoKeywords || '');
    var listRaw = (tripFields && tripFields.AI_SEO_FocusKeywords_List) ? tripFields.AI_SEO_FocusKeywords_List : (imp.seoKeywordsList || '');
    var primaryItems = normalizeKeywordList_AiImages_(splitKeywordsCsv_AiImages_(primaryRaw), 10);
    var primary = primaryItems && primaryItems.length ? primaryItems[0] : '';
    var listItems = [];
    if (listRaw) {
      if (Array.isArray(listRaw)) listItems = listItems.concat(listRaw.map(function(x) { return String(x || '').trim(); }));
      else listItems = listItems.concat(String(listRaw).split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); }));
    }
    listItems = normalizeKeywordList_AiImages_(listItems, 30);
    ctx.seoKeywords = normalizeKeywordList_AiImages_([primary].concat(listItems), 30).join(', ');
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
  var p = keywordPlan && keywordPlan.primary ? String(keywordPlan.primary) : '';
  var secondary = keywordPlan && keywordPlan.secondary && Array.isArray(keywordPlan.secondary) ? keywordPlan.secondary : [];
  secondary = secondary.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (secondary.length > 12) secondary = secondary.slice(0, 12);
  var forbiddenTitles = opts && opts.forbiddenTitles && Array.isArray(opts.forbiddenTitles) ? opts.forbiddenTitles : [];
  forbiddenTitles = forbiddenTitles.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (forbiddenTitles.length > 25) forbiddenTitles = forbiddenTitles.slice(0, 25);
  var preferredTitleKeyword = opts && opts.preferredTitleKeyword ? String(opts.preferredTitleKeyword) : '';
  preferredTitleKeyword = preferredTitleKeyword.trim();
  var seoTitle = ctx && ctx.seoTitle ? String(ctx.seoTitle) : '';
  var primaryTopic = deriveSoftTopicHint_AiImages_(p) || p;
  var secondaryTopic = deriveSoftTopicHint_AiImages_(secondary.length ? secondary[0] : '') || (secondary.length ? secondary[0] : '');

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
    
    "SEO CONTEXT (topic grounding only; do NOT stuff keywords):\n" +
    "SEO Title: " + (ctx.seoTitle || 'N/A') + "\n" +
    "SEO Meta Description: " + (ctx.seoMetaDescription || 'N/A') + "\n" +
    "SEO Keywords: " + (ctx.seoKeywords || 'N/A') + "\n\n" +

    "KEYWORDS (SOFT GUIDANCE):\n" +
    "- Primary Topic: " + primaryTopic + "\n" +
    (secondaryTopic ? ("- Optional related topic: " + secondaryTopic + "\n\n") : "\n") +
    (preferredTitleKeyword ? ("TOPIC HINT (soft, do NOT copy-paste): " + JSON.stringify(preferredTitleKeyword) + "\n\n") : "") +
    (forbiddenTitles.length ? ("TITLE UNIQUENESS (STRICT): Do NOT reuse any of these titles: " + JSON.stringify(forbiddenTitles) + "\n\n") : "") +
    
    "🎯 ENHANCEMENT RULES:\n" +
    "1. Title (max 60 chars):\n" +
    "   - Must be SHORT and strongly linked to the trip SEO title\n" +
    "   - Format: '<Short Trip Name> <Visible Subject>'\n" +
    "   - Clear and concise\n" +
    "   - Optionally include ONE light context mention if natural\n" +
    "   - Avoid generic filler like: 'Experience the magic', 'Immerse yourself', 'Unforgettable moment'\n" +
    "   - Avoid repeated words/phrases\n" +
    "   - Avoid SEO stacking like 'Day Tours Cairo Egypt Day Tours ...'\n\n" +
    
    "2. Caption (max 150 chars):\n" +
    "   - Short, simple, and quick context\n" +
    "   - Natural language\n" +
    "   - Example: 'The Al-Hakim Mosque in Cairo, built in 1013 AD'\n\n" +
    
    "3. Description (max 300 chars):\n" +
    "   - Detailed and helpful, but natural (no SEO keyword stuffing)\n" +
    "   - Useful for Gallery/Slider context\n" +
    "   - Include historical/cultural context\n" +
    "   - Example: 'The Al-Hakim Mosque in Cairo is a stunning example of Fatimid architecture built in 1013 AD. It features unique minarets and a large courtyard, making it a key site for Islamic heritage tours.'\n\n" +
    
    "4. Alt Text (max 125 chars):\n" +
    "   - Descriptive for accessibility, describing only what is visible\n" +
    "   - Natural sentence, no comma-separated keyword list\n" +
    "   - Do NOT force-insert keywords or exact-match SEO phrases\n\n" +

    "- Use current data as base, enhance with trip context\n" +
    "- Do NOT invent details not in context\n" +
    "- Keywords are guidance only; avoid copying keyword phrases verbatim\n" +
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
      out.seoKeywordsList = impFields.AI_SEO_FocusKeywords_List || '';
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
