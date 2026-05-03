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

function isImageIneligibleKeywordPhrase_AiImages_(phrase) {
  var s = String(phrase || '').replace(/\s+/g, ' ').trim();
  if (!s) return true;
  var low = s.toLowerCase();

  if (low.length > 52) return true;
  var wc = s.split(' ').filter(function(x) { return !!x; }).length;
  if (wc > 7) return true;

  if (/\b(things\s+to\s+do|what\s+to\s+do|best|top|cheap|discount|deal|offers?)\b/.test(low)) return true;
  if (/\b(day\s+(tour|trip)s?|tours?|excursions?)\b/.test(low)) return true;
  if (/\b(sightseeing|attractions?)\b/.test(low)) return true;
  if (/\b(book|booking|tickets?|price|prices)\b/.test(low)) return true;
  if (/^(?:from|to|near|around)\b/.test(low)) return true;
  if (wc >= 3 && /\b(?:from|to)\b/.test(low)) return true;

  return false;
}

function filterImageKeywordListEligibility_AiImages_(list, limit) {
  var items = normalizeKeywordList_AiImages_(list || [], typeof limit === 'number' ? limit : 30);
  var seen = {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var raw = String(items[i] || '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    var key = raw.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    if (isImageIneligibleKeywordPhrase_AiImages_(raw)) continue;
    out.push(raw);
  }
  var max = typeof limit === 'number' && limit > 0 ? limit : 30;
  if (out.length > max) out = out.slice(0, max);
  return out;
}

function buildTripKeywordPlans_AiImages_(tripFields, ctx) {
  var f = tripFields || {};

  var imp = ctx || {};
  var focusRaw = (f.AI_SEO_FocusKeywords != null && String(f.AI_SEO_FocusKeywords).trim()) ? String(f.AI_SEO_FocusKeywords) : String(imp.seoKeywords || '');
  var listRaw = (f.AI_SEO_FocusKeywords_List != null && (Array.isArray(f.AI_SEO_FocusKeywords_List) ? f.AI_SEO_FocusKeywords_List.length : String(f.AI_SEO_FocusKeywords_List).trim())) ? f.AI_SEO_FocusKeywords_List : (imp.seoKeywordsList || '');

  var listFromFieldRaw = extractEnglishKeywordsFromListFieldValue_AiImages_(listRaw);
  listFromFieldRaw = normalizeKeywordList_AiImages_(listFromFieldRaw, 30);
  var listFromField = filterImageKeywordListEligibility_AiImages_(listFromFieldRaw, 30);
  if (listFromField.length !== listFromFieldRaw.length) {
    Logger.log('AI Images: filtered ineligible SEO phrases for image keywords: removed ' + (listFromFieldRaw.length - listFromField.length));
  }

  Logger.log('AI IMAGES KEYWORD FALLBACK DISABLED');

  Logger.log('AI IMAGES KEYWORD SOURCE (PRIMARY): ' + (((f.AI_SEO_FocusKeywords != null && String(f.AI_SEO_FocusKeywords).trim()) ? 'Trips.AI_SEO_FocusKeywords' : 'ImprovementWithAI.AI_SEO_FocusKeywords')));
  Logger.log('AI IMAGES KEYWORD SOURCE (LIST): ' + (((f.AI_SEO_FocusKeywords_List != null && (Array.isArray(f.AI_SEO_FocusKeywords_List) ? f.AI_SEO_FocusKeywords_List.length : String(f.AI_SEO_FocusKeywords_List).trim())) ? 'Trips.AI_SEO_FocusKeywords_List' : 'ImprovementWithAI.AI_SEO_FocusKeywords_List')));

  var focusItemsRaw = normalizeKeywordList_AiImages_(splitKeywordsCsv_AiImages_(focusRaw), 10);
  var focusItems = filterImageKeywordListEligibility_AiImages_(focusItemsRaw, 10);
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

  var remove = {
    day: true, tour: true, tours: true, trip: true, excursions: true, excursion: true,
    from: true, to: true, in: true, on: true, at: true, the: true, a: true, an: true, of: true,
    city: true, sightseeing: true, attractions: true
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
  var role = String((ctx && ctx.imageRole) ? ctx.imageRole : '').toLowerCase().trim() || 'gallery';

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

  function tokensSet_(metaObj) {
    var s = norm_([metaObj.title, metaObj.alt, metaObj.caption, metaObj.description].join(' ')).toLowerCase();
    s = s.replace(/[^a-z0-9\s]/g, ' ');
    var parts = s.split(/\s+/).filter(function(x) { return !!x; });
    var stop = { the: 1, a: 1, an: 1, and: 1, or: 1, but: 1, with: 1, for: 1, to: 1, from: 1, of: 1, in: 1, on: 1, at: 1, by: 1, as: 1 };
    var set = {};
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i];
      if (t.length <= 2) continue;
      if (stop[t]) continue;
      set[t] = 1;
    }
    return set;
  }
  function keywordTokens_(phrase) {
    var s = norm_(phrase).toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    var parts = s.split(/\s+/).filter(function(x) { return !!x; });
    var stop = { the: 1, a: 1, an: 1, and: 1, or: 1, but: 1, with: 1, for: 1, to: 1, from: 1, of: 1, in: 1, on: 1, at: 1, by: 1, as: 1 };
    return parts.filter(function(t) { return t.length > 2 && !stop[t]; });
  }
  function isEligibleForImageUse_(phrase, field) {
    var x = norm_(phrase);
    if (!x) return false;
    if (isImageIneligibleKeywordPhrase_AiImages_(x)) return false;
    if (role === 'featured') {
      if (field === 'alt' && wordCount_(x) > 3) return false;
      if (field === 'title' && wordCount_(x) > 4) return false;
    }
    var toks = keywordTokens_(x);
    if (!toks.length) return false;
    var hits = 0;
    for (var i = 0; i < toks.length; i++) {
      if (metaTokens[toks[i]]) hits++;
    }
    if (!hits) return false;
    if (role === 'featured' && toks.length > 1 && hits < 2) return false;
    return true;
  }

  var metaTokens = tokensSet_(out);
  var eligiblePrimary = (kp && kp.primary && isEligibleForImageUse_(kp.primary, 'title')) ? String(kp.primary).trim() : '';
  var eligibleSecondary = [];
  if (kp && kp.secondary && Array.isArray(kp.secondary)) {
    for (var si = 0; si < kp.secondary.length; si++) {
      var kw = String(kp.secondary[si] || '').trim();
      if (!kw) continue;
      if (!isEligibleForImageUse_(kw, 'title')) continue;
      eligibleSecondary.push(kw);
      if (eligibleSecondary.length >= 12) break;
    }
  }
  kp = { all: kp && kp.all ? kp.all : [], primary: eligiblePrimary, secondary: eligibleSecondary };
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
        var allowAppend = !(/[A-Z]/.test(altKeyword)) && wordCount_(altKeyword) <= 2 && isEligibleForImageUse_(altKeyword, 'alt');
        if (!allowAppend) {
          log_('FEATURED ALT KEYWORD SKIPPED (TOO RISKY TO APPEND)');
        } else {
          var kwLow = lc_(altKeyword);
          var prep = (/\b(river|sea|lake|canal|beach)\b/.test(kwLow) ? ' on the ' : ' at the ');
          var suffix = prep + altKeyword;
          var candidateAlt = fitWithSuffix_(currentAlt, suffix, 125);
          if (candidateAlt) {
            out.alt = candidateAlt;
            log_('FEATURED ALT KEYWORD INCLUDED: ' + altKeyword);
          } else {
            log_('FEATURED ALT KEYWORD SKIPPED (NO ROOM): ' + altKeyword);
          }
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
    return '';
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
    log_('PRIMARY SEO SENTENCE SKIPPED (QUALITY-FIRST): ' + primary);
  }

  var wantExactFeaturedPrimary = role === 'featured' && options && options.featuredExactPrimary === true;
  if (wantExactFeaturedPrimary && primary) {
    if (containsPhrase_(desc, primary)) {
      log_('FEATURED EXACT PRIMARY ALREADY PRESENT: ' + primary);
    } else if (isExactFeaturedOk_(primary)) {
      log_('FEATURED EXACT PRIMARY SKIPPED (QUALITY-FIRST): ' + primary);
    } else {
      log_('FEATURED EXACT PRIMARY SKIPPED (ROUTEY/HEAVY): ' + primary);
    }
  }

  var descSentences = sentenceCount_(desc);
  descSentences = descSentences;

  out.description = cleanupEndPunctuation_(desc);

  out.title = norm_(out.title) || 'Travel photo';
  out.alt = norm_(out.alt) || 'Travel photo';
  out.caption = norm_(out.caption);
  out.description = norm_(out.description);

  out.title = truncateAtWordBoundaryImageEn_AiImages_(out.title, 60);
  out.caption = truncateAtWordBoundaryImageEn_AiImages_(out.caption, 150);
  out.description = truncatePreferSentenceBoundaryImageEn_AiImages_(out.description, 300);
  out.alt = truncateAtWordBoundaryImageEn_AiImages_(out.alt, 125);

  out.title = stripTrailingPunctuationNoiseImageEn_AiImages_(stripDanglingEndTokensImageEn_AiImages_(out.title));
  out.caption = stripTrailingPunctuationNoiseImageEn_AiImages_(stripDanglingEndTokensImageEn_AiImages_(out.caption));
  out.description = stripTrailingPunctuationNoiseImageEn_AiImages_(stripDanglingEndTokensImageEn_AiImages_(out.description));
  out.alt = stripTrailingPunctuationNoiseImageEn_AiImages_(stripDanglingEndTokensImageEn_AiImages_(out.alt));

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

function normalizeEnglishImageFluencyWhitespace_AiImages_(text) {
  var s = String(text || '');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s+([,.;:!?])/g, '$1');
  s = s.replace(/([,.;:!?])([A-Za-z])/g, '$1 $2');
  return s.trim();
}

function stripDanglingEndTokensImageEn_AiImages_(text) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  var weak = { and: 1, or: 1, but: 1, with: 1, for: 1, to: 1, from: 1, of: 1, in: 1, on: 1, at: 1, by: 1, as: 1, your: 1, our: 1, the: 1, a: 1, an: 1 };
  for (var i = 0; i < 3; i++) {
    var cleaned = s.replace(/[|—–\-:;,]+$/g, '').trim();
    var parts = cleaned.split(' ').filter(function(x) { return !!x; });
    if (!parts.length) break;
    var last = String(parts[parts.length - 1] || '').toLowerCase().replace(/[.!?]+$/g, '');
    if (!weak[last]) break;
    parts.pop();
    s = parts.join(' ').trim();
  }
  s = s.replace(/[|—–\-:;,]+$/g, '').trim();
  return s;
}

function stripTrailingTruncatedWordFragmentImageEn_AiImages_(text) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  s = stripTrailingPunctuationNoiseImageEn_AiImages_(s);
  var parts = s.split(' ').filter(function(x) { return !!x; });
  if (!parts.length) return s;

  var last = String(parts[parts.length - 1] || '').replace(/[.!?]+$/g, '');
  var lastLower = last.toLowerCase();
  var allowedShort = { a: 1, an: 1, in: 1, of: 1, to: 1, at: 1, by: 1, on: 1, as: 1 };
  if (lastLower.length <= 2 && /^[a-z]+$/i.test(lastLower) && !allowedShort[lastLower]) {
    parts.pop();
    s = parts.join(' ').trim();
  }

  s = s.replace(/\bas\s+a\s*$/i, '').trim();
  s = s.replace(/\bas\s+an\s*$/i, '').trim();
  s = stripTrailingPunctuationNoiseImageEn_AiImages_(s);
  s = stripDanglingEndTokensImageEn_AiImages_(s);
  return stripTrailingPunctuationNoiseImageEn_AiImages_(s);
}

function stripTrailingPunctuationNoiseImageEn_AiImages_(text) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  s = s.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim();
  s = s.replace(/\s*[,;:|—–\-]+\s*$/g, '').trim();
  s = s.replace(/([.!?]){2,}\s*$/g, '$1').trim();
  s = s.replace(/[…]+$/g, '').trim();
  return s;
}

function truncateAtWordBoundaryImageEn_AiImages_(text, maxLen) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  var n = Number(maxLen || 0);
  if (!n || n <= 0) return s;
  if (s.length <= n) return s;
  var slice = s.substring(0, n + 1);
  var cut = slice.lastIndexOf(' ');
  if (cut < Math.floor(n * 0.7)) cut = n;
  return s.substring(0, cut).trim();
}

function truncatePreferSentenceBoundaryImageEn_AiImages_(text, maxLen) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  var n = Number(maxLen || 0);
  if (!n || n <= 0) return s;
  if (s.length <= n) return s;
  var prefix = s.substring(0, n + 1);
  var last = -1;
  for (var i = 0; i < prefix.length; i++) {
    var ch = prefix.charAt(i);
    if (ch === '.' || ch === '!' || ch === '?') last = i;
  }
  if (last >= Math.floor(n * 0.55)) return prefix.substring(0, last + 1).trim();
  return truncateAtWordBoundaryImageEn_AiImages_(s, n);
}

function trimToLastCompleteSentenceWithinLimitImageEn_AiImages_(text, maxLen) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  var n = Number(maxLen || 0);
  if (n > 0 && s.length > n) s = s.substring(0, n + 1);
  var last = -1;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '.' || ch === '!' || ch === '?') last = i;
  }
  if (last < 0) return '';
  return stripTrailingPunctuationNoiseImageEn_AiImages_(s.substring(0, last + 1).trim());
}

function removeGenericItinerarySentenceImageEn_AiImages_(text) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  var before = s;
  s = s.replace(/\bA great addition to (?:a\s+)?[^.]{0,65} itinerary\.?\s*/ig, '').trim();
  s = s.replace(/\bA memorable highlight on (?:a\s+)?[^.]{0,65} tour\.?\s*/ig, '').trim();
  s = s.replace(/\bA memorable highlight on (?:a\s+)?[^.]{0,65}\.\s*/ig, '').trim();
  s = s.replace(/\bA memorable highlight for travelers interested in [^.]{0,85}\.\s*/ig, '').trim();
  s = s.replace(/\bRelated to [^.]{0,85}\.\s*/ig, '').trim();
  s = s.replace(/\bA must-visit\b[^.]{0,65}\.\s*/ig, '').trim();
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (!s) return before;
  return s;
}

function repairMalformedImageEnglishPhrases_AiImages_(text, ctx) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  var before = s;

  s = s.replace(/\bin\s+'s\s+museum\b/ig, 'in the museum');
  s = s.replace(/\b(at|in|of)\s+'s\s+\b/ig, '$1 the ');
  s = s.replace(/\bthe\s*'s\b/ig, 'the');
  s = s.replace(/\.\s+(in|at|on|with|from|for|to)\b/ig, ', $1');
  s = s.replace(/\bstands\s+majestically\s+by\s+the\s+water\s+its\b/ig, 'stands majestically by the water, with its');
  s = s.replace(/\bby\s+the\s+water\s+its\b/ig, 'by the water, with its');
  s = s.replace(/\bsurrounds\s+the\s+enhancing\b/ig, 'surrounds it, enhancing');
  s = s.replace(/\bstands\s+proudly\s+in\s+showcasing\b/ig, 'stands proudly, showcasing');
  s = s.replace(/\bstands\s+in\s+showcasing\b/ig, 'stands, showcasing');
  s = s.replace(/\b(National\s+Museum\s+of)\s+(?:the\s+)?\1\b/ig, '$1');
  s = s.replace(/\s+'\s*s\b/g, "'s");

  if (/^The\s+in\s+[A-Z]/.test(s) && /\b(houses|showcases|displays|exhibits|features)\b/i.test(s)) {
    s = s.replace(/^The\s+in\s+([A-Z][A-Za-z]+)/, 'The museum in $1');
  }

  if (before !== s) return normalizeEnglishImageFluencyWhitespace_AiImages_(s);
  return s;
}

function normalizeIncompleteEntityPhraseImageEn_AiImages_(text, ctx) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  var canonical = 'National Museum of Egyptian Civilization';
  var hay = String(s || '').toLowerCase();
  if (hay.indexOf('national museum of egyptian civilization') !== -1) return s;
  if (hay.indexOf('nmec') !== -1) return s;
  if (hay.indexOf('museum') !== -1 && hay.indexOf('egyptian civilization') === -1) return s;

  var ctxHay = String((ctx && ctx.tripTitle ? ctx.tripTitle : '') + ' ' + (ctx && ctx.seoTitle ? ctx.seoTitle : '') + ' ' + (ctx && ctx.seoDesc ? ctx.seoDesc : '')).toLowerCase();
  if (ctxHay.indexOf('egyptian civilization') === -1 && ctxHay.indexOf('nmec') === -1 && ctxHay.indexOf('national museum of egyptian civilization') === -1) return s;

  var before = s;
  s = s.replace(/\bEgyptian\s+Civilization\s+Museum\b/ig, canonical);
  s = s.replace(/\bThe\s+Egyptian\s+Civilization\s+Museum\b/ig, 'The ' + canonical);
  s = s.replace(/\bNational\s+Museum\s+of\s+National\s+Museum\b/ig, canonical);
  s = s.replace(/\bNational\s+Museum\s+of\s+the\s+National\s+Museum\b/ig, canonical);
  s = s.replace(/\bThe\s+Egyptian\s+Civilization\b(?=\s+(?:houses|showcases|displays|exhibits|features|stands|is|was|illuminated)\b)/i, 'The ' + canonical);
  s = s.replace(/\bEgyptian\s+Civilization\b(?=\s+(?:houses|showcases|displays|exhibits|features|stands|is|was|illuminated)\b)/i, canonical);
  if (before !== s) return normalizeEnglishImageFluencyWhitespace_AiImages_(s);
  return s;
}

function isWeakEndingFragmentImageEn_AiImages_(text) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return true;
  var t = s.replace(/[\s"')\]]+$/g, '').trim();
  t = t.replace(/[|—–\-:;,]+$/g, '').trim();
  var noTerm = t.replace(/[.!?]+$/g, '').trim();
  if (!noTerm) return true;

  var lowered = noTerm.toLowerCase();
  if (/\bmaking\s+it\s+a\s+must\b$/.test(lowered)) return true;
  if (/\bas\s+a\s+[a-z]{1,3}\b$/.test(lowered)) return true;
  if (/\bon\s+display\s+in\b$/.test(lowered)) return true;
  if (/\bhighlighting\s+the\s+rich\s+history\b$/.test(lowered)) return true;
  if (/\brich\s+history\b$/.test(lowered) && !/[.!?]$/.test(t)) return true;

  var parts = lowered.split(' ').filter(function(x) { return !!x; });
  if (!parts.length) return true;
  var last = String(parts[parts.length - 1] || '').replace(/[.!?]+$/g, '');
  var weakLast = {
    and: 1, or: 1, but: 1, with: 1, for: 1, to: 1, from: 1, of: 1, in: 1, on: 1, at: 1, by: 1,
    your: 1, our: 1, the: 1, a: 1, an: 1,
    cultural: 1, historic: 1, historical: 1, guided: 1, unforgettable: 1, immersive: 1, premium: 1, scenic: 1, authentic: 1,
    must: 1
  };
  if (weakLast[last]) return true;
  if (last.length <= 2 && !weakLast[last]) return true;
  return false;
}

function repairObviousJoinedWordsImageEn_AiImages_(text) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  s = s.replace(/\bstaffin\b/ig, 'staff in');
  s = s.replace(/\bmuseumin\b/ig, 'museum in');
  s = s.replace(/\bmuseum\s+in\s+cairo\s+museum\b/ig, 'museum in Cairo');
  s = s.replace(/\bin\s+cairo\s+museum\b/ig, 'in a museum');
  s = s.replace(/\b(cairo)\s+museum\b/ig, 'museum in Cairo');
  s = s.replace(/\b([a-z]{4,})(in)\s+([A-Z][a-z]{2,})\b/g, function(m, w, prep, loc) {
    var ww = String(w || '');
    if (/^(begin|origin|within|again|cousin|muffin)$/i.test(ww)) return m;
    return ww + ' ' + prep + ' ' + loc;
  });
  s = s.replace(/\bstands\s+proudly\s+in\s+showcasing\b/ig, 'stands proudly, showcasing');
  s = s.replace(/\bstands\s+in\s+showcasing\b/ig, 'stands, showcasing');
  s = s.replace(/\b(a|an)\s+(El\s+)/g, '$2');
  s = s.replace(/\b(\w+)\s+\1\b/ig, '$1');
  return normalizeEnglishImageFluencyWhitespace_AiImages_(s);
}

function isWeakGenericCaptionOrDescImageEn_AiImages_(text) {
  var s = String(text || '').trim();
  if (!s) return true;
  if (/^A great addition to (?:a\s+)?[^.]{0,65} itinerary\.?$/i.test(s)) return true;
  if (/^A memorable highlight on (?:a\s+)?[^.]{0,65}(?: tour)?\.?$/i.test(s)) return true;
  if (/^A memorable highlight for travelers interested in [^.]{0,85}\.?$/i.test(s)) return true;
  if (/^Related to [^.]{0,85}\.?$/i.test(s)) return true;
  if (/^A timeless scene for travelers\.?$/i.test(s)) return true;
  return false;
}

function finalizeAltTextEnglishImageEn_AiImages_(text) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;
  var before = s;

  s = s.replace(/\bfor\s+travelers\s+interested\s+in\s+[^.]{0,140}\.?$/i, '').trim();
  s = s.replace(/\brelated\s+to\s+[^.]{0,140}\.?$/i, '').trim();
  s = s.replace(/\b(part\s+of|included\s+in)\s+[^.]{0,140}\.?$/i, '').trim();
  s = s.replace(/\b(a\s+great\s+addition\s+to)\s+[^.]{0,140}\.?$/i, '').trim();
  s = s.replace(/\b(a\s+memorable\s+highlight)\s+[^.]{0,140}\.?$/i, '').trim();

  s = s.replace(/,\s*in\s+a\s+museum\s+in\s+cairo\.?$/i, ' on display in a museum').trim();
  s = s.replace(/\s+in\s+a\s+museum\s+in\s+cairo\.?$/i, ' on display in a museum').trim();
  s = s.replace(/,\s*in\s+a\s+museum\.?$/i, ' on display in a museum').trim();
  s = s.replace(/\s+in\s+a\s+museum\.?$/i, ' on display in a museum').trim();
  s = s.replace(/\bmuseum\s+in\s+cairo\b/ig, 'museum');
  s = s.replace(/\bcairo\s+museum\b/ig, 'museum');
  s = s.replace(/\s+in\s+cairo\.?$/i, '').trim();

  function trimToWords_(str, maxWords) {
    var t = normalizeEnglishImageFluencyWhitespace_AiImages_(str);
    if (!t) return t;
    var parts = t.split(' ').filter(function(x) { return !!x; });
    if (parts.length <= maxWords) return t;
    parts = parts.slice(0, maxWords);
    var weak = { and: 1, or: 1, but: 1, with: 1, for: 1, to: 1, from: 1, of: 1, in: 1, on: 1, at: 1, by: 1, as: 1, the: 1, a: 1, an: 1 };
    while (parts.length) {
      var last = String(parts[parts.length - 1] || '').toLowerCase().replace(/[.!?]+$/g, '');
      if (!weak[last]) break;
      parts.pop();
    }
    return parts.join(' ').trim();
  }

  s = trimToWords_(s, 12);
  s = stripTrailingPunctuationNoiseImageEn_AiImages_(s);
  s = stripDanglingEndTokensImageEn_AiImages_(s);
  s = stripTrailingPunctuationNoiseImageEn_AiImages_(s);
  if (before !== s) Logger.log('AI Images Enhancer: alt finalized for naturalness');
  return s;
}

function finalizeTitleEnglishImageEn_AiImages_(text, ctx, maxLen) {
  var s = normalizeEnglishImageFluencyWhitespace_AiImages_(text);
  if (!s) return s;

  s = s.replace(/\bCivilizatio\b/ig, 'Civilization');
  s = s.replace(/\bCivilizati\b/ig, 'Civilization');

  var n = Number(maxLen || 0);
  if (!n || n <= 0) return s;

  var ctxHay = String((ctx && ctx.tripTitle ? ctx.tripTitle : '') + ' ' + (ctx && ctx.seoTitle ? ctx.seoTitle : '') + ' ' + (ctx && ctx.seoDesc ? ctx.seoDesc : '')).toLowerCase();
  var hasCiv = ctxHay.indexOf('egyptian civilization') !== -1 || ctxHay.indexOf('nmec') !== -1 || ctxHay.indexOf('national museum of egyptian civilization') !== -1;
  var long = 'National Museum of Egyptian Civilization';
  var short = 'Egyptian Civilization Museum';

  if (hasCiv) {
    s = s.replace(/\bNational\s+Museum\s+of\s+Egyptian\b(?!\s+Civilization)/ig, long);
    s = s.replace(/\bArtifacts\s+Displayed\s+at\s+the\s+National\s+Museum\s+of\s+Egyptian\b/ig, 'Artifacts at the ' + long);
    if (/\bNational\s+Museum\s+of\s+Egyptian\s*$/i.test(s)) s = s.replace(/\bNational\s+Museum\s+of\s+Egyptian\s*$/i, long);
  }

  if (s.length > n && hasCiv && s.toLowerCase().indexOf(long.toLowerCase()) !== -1) {
    var subject = '';
    if (/\bartifacts?\b/i.test(s)) subject = 'Artifacts';
    else if (/\bstatues?\b|\bstatue\b/i.test(s)) subject = 'Statue';
    else if (/\bexhibits?\b|\bexhibit\b/i.test(s)) subject = 'Exhibits';
    else subject = 'Museum';

    var candidate = subject + ' at ' + long;
    if (candidate.length <= n) s = candidate;
    else {
      candidate = subject + ' at ' + short;
      if (candidate.length <= n) s = candidate;
      else {
        candidate = subject + ' — ' + short;
        if (candidate.length <= n) s = candidate;
      }
    }
  }

  s = truncateAtWordBoundaryImageEn_AiImages_(s, n);
  s = stripTrailingPunctuationNoiseImageEn_AiImages_(s);
  s = stripDanglingEndTokensImageEn_AiImages_(s);
  s = stripTrailingPunctuationNoiseImageEn_AiImages_(s);
  return s;
}

function fluencyCleanupEnglishImageMeta_AiImages_(meta, ctx) {
  var m = meta || {};
  var out = {
    title: String(m.title || '').trim(),
    caption: String(m.caption || '').trim(),
    description: String(m.description || '').trim(),
    alt: String(m.alt || '').trim()
  };

  function finalizeField_Result_(field, value, maxLen) {
    var v0 = String(value || '').trim();
    var v = normalizeEnglishImageFluencyWhitespace_AiImages_(v0);

    var malformedBefore = v;
    v = repairObviousJoinedWordsImageEn_AiImages_(v);
    v = repairMalformedImageEnglishPhrases_AiImages_(v, ctx);
    var malformedRepaired = (v !== malformedBefore);

    var entityBefore = v;
    v = normalizeIncompleteEntityPhraseImageEn_AiImages_(v, ctx);
    var entityNormalized = (v !== entityBefore);

    var maxWords = field === 'title' ? 16 : (field === 'caption' ? 28 : (field === 'description' ? 60 : 40));
    v = collapseRepeatedPhrases_AiImages_(v, maxWords);

    v = removeGenericItinerarySentenceImageEn_AiImages_(v);
    v = stripTrailingPunctuationNoiseImageEn_AiImages_(v);
    if (field === 'alt') v = finalizeAltTextEnglishImageEn_AiImages_(v);
    if (field === 'title') v = finalizeTitleEnglishImageEn_AiImages_(v, ctx, maxLen);

    var truncatedBefore = v;
    if (field === 'description') v = truncatePreferSentenceBoundaryImageEn_AiImages_(v, maxLen);
    else v = truncateAtWordBoundaryImageEn_AiImages_(v, maxLen);
    var midTruncFixed = (v !== truncatedBefore);

    var danglingRemoved = false;
    var sentenceTrimmed = false;

    var beforeDangling = v;
    v = stripTrailingTruncatedWordFragmentImageEn_AiImages_(v);
    v = stripDanglingEndTokensImageEn_AiImages_(v);
    v = stripTrailingPunctuationNoiseImageEn_AiImages_(v);
    danglingRemoved = (v !== beforeDangling);

    if (field === 'description' && isWeakEndingFragmentImageEn_AiImages_(v)) {
      var sentence = trimToLastCompleteSentenceWithinLimitImageEn_AiImages_(v0, maxLen);
      if (sentence) {
        var cand = stripDanglingEndTokensImageEn_AiImages_(stripTrailingPunctuationNoiseImageEn_AiImages_(sentence));
        cand = stripTrailingPunctuationNoiseImageEn_AiImages_(cand);
        if (cand && !isWeakEndingFragmentImageEn_AiImages_(cand)) {
          v = cand;
          sentenceTrimmed = true;
        }
      }
    }

    if ((field === 'caption' || field === 'description') && v && !/[.!?]$/.test(v) && !isWeakEndingFragmentImageEn_AiImages_(v)) {
      if (!maxLen || (v.length + 1) <= maxLen) v = v + '.';
    }

    v = stripTrailingPunctuationNoiseImageEn_AiImages_(v);
    v = stripDanglingEndTokensImageEn_AiImages_(v);
    v = stripTrailingPunctuationNoiseImageEn_AiImages_(v);

    if ((field === 'caption' || field === 'description') && isWeakGenericCaptionOrDescImageEn_AiImages_(v)) {
      var subject = String(out.alt || out.title || (ctx && ctx.tripTitle ? ctx.tripTitle : '') || 'Travel photo').trim();
      if (field === 'caption') v = String(out.title || subject).trim();
      else v = ('Photo of ' + subject).trim();
      v = (field === 'description' ? truncatePreferSentenceBoundaryImageEn_AiImages_(v, maxLen) : truncateAtWordBoundaryImageEn_AiImages_(v, maxLen));
      if (v && !/[.!?]$/.test(v) && (!maxLen || (v.length + 1) <= maxLen)) v += '.';
      Logger.log('AI Images Enhancer: repaired generic weak ' + field);
    }

    if (field !== 'description' && isWeakEndingFragmentImageEn_AiImages_(v)) {
      var cleaned = stripDanglingEndTokensImageEn_AiImages_(v);
      cleaned = stripTrailingPunctuationNoiseImageEn_AiImages_(cleaned);
      if (cleaned && !isWeakEndingFragmentImageEn_AiImages_(cleaned)) v = cleaned;
    }

    v = normalizeEnglishImageFluencyWhitespace_AiImages_(v);
    if (maxLen) {
      v = (field === 'description' ? truncatePreferSentenceBoundaryImageEn_AiImages_(v, maxLen) : truncateAtWordBoundaryImageEn_AiImages_(v, maxLen));
    }
    v = stripTrailingPunctuationNoiseImageEn_AiImages_(v);
    v = stripDanglingEndTokensImageEn_AiImages_(v);
    v = stripTrailingPunctuationNoiseImageEn_AiImages_(v);

    var changed = (v0 !== v);
    var danglingDetected = danglingRemoved || isWeakEndingFragmentImageEn_AiImages_(v0);
    return { text: v, changed: changed, danglingDetected: danglingDetected, malformedRepaired: malformedRepaired, entityNormalized: entityNormalized, sentenceTrimmed: sentenceTrimmed, midTruncFixed: midTruncFixed };
  }

  function apply_(field, maxLen) {
    var res = finalizeField_Result_(field, out[field], maxLen);
    out[field] = res.text;
    if (!out[field]) {
      if (field === 'title' || field === 'alt') out[field] = 'Travel photo';
      else if (field === 'caption') out[field] = String(out.title || 'Travel photo').trim();
      else if (field === 'description') {
        var subj = String(out.alt || out.title || (ctx && ctx.tripTitle ? ctx.tripTitle : '') || 'travel scene').trim();
        out[field] = ('Photo of ' + subj).trim();
        out[field] = truncatePreferSentenceBoundaryImageEn_AiImages_(out[field], maxLen);
        if (out[field] && !/[.!?]$/.test(out[field]) && (!maxLen || (out[field].length + 1) <= maxLen)) out[field] += '.';
      }
    }
    if (res.changed) Logger.log('AI Images Enhancer: fluency cleanup applied (' + field + ')');
    if (res.danglingDetected && res.changed) Logger.log('AI Images Enhancer: dangling ending removed (' + field + ')');
    if (res.malformedRepaired && res.changed) Logger.log('AI Images Enhancer: malformed phrase repaired (' + field + ')');
    if (res.entityNormalized && res.changed) Logger.log('AI Images Enhancer: incomplete entity phrase normalized (' + field + ')');
    if (res.sentenceTrimmed && res.changed) Logger.log('AI Images Enhancer: description trimmed to last complete thought');
  }

  apply_('title', 60);
  apply_('caption', 150);
  apply_('description', 300);
  apply_('alt', 125);
  return out;
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
    "You are an expert travel content editor specializing in high-quality English image metadata for tourism websites.\n" +
    "You can SEE the image. Describe only what is visible. Do NOT invent details.\n" +
    "Use the trip context only for naming/grounding; do NOT claim something is visible unless it is.\n" +
    "\n" +
    "CRITICAL RULES (STRICT):\n" +
    "1) Natural, fluent English ONLY. No fragments. No abrupt endings. Every sentence must end properly.\n" +
    "2) No repetition (no duplicated words/phrases, no 'X of X').\n" +
    "3) No generic filler (avoid 'and more', 'and beyond', 'etc.'). Avoid robotic SEO-stuffed writing.\n" +
    "4) Visual specificity: describe what is visible (architecture, artifacts, people, atmosphere, setting).\n" +
    "5) Avoid trailing clipped phrases like: 'the rich...', 'a glimpse into...', 'making it a perfect stop on...', 'immersed in the...'.\n" +
    "\n" +
    "LENGTH GUIDANCE:\n" +
    "- Title: 6–10 words (max 60 chars)\n" +
    "- Alt: 8–12 words (max 125 chars)\n" +
    "- Caption: 1 short complete sentence (max 150 chars)\n" +
    "- Description: 1–2 full sentences (max 300 chars)\n" +
    "\n" +
    "CONTEXT-AWARE NAMING (only if relevant): Egyptian Civilization Museum / National Museum of Egyptian Civilization, Citadel of Saladin, Old Cairo, Khan El-Khalili, Nile.\n" +
    "Do NOT force keywords unnaturally.\n" +
    "\n" +
    "TITLE: short, natural, specific. Prefer a visible subject. Optionally add ONE light context mention if it fits.\n" +
    "CAPTION/DESCRIPTION: complete, natural sentences. Avoid marketing fluff.\n" +
    "ALT: natural description of what is visible. No comma-separated keyword lists.\n" +
    (forbiddenTitles.length ? ("TITLE UNIQUENESS (STRICT): Do NOT reuse any of these titles: " + JSON.stringify(forbiddenTitles) + "\n") : "") +
    (forbiddenTitles.length ? "If the title would repeat, focus on a DIFFERENT visible detail/angle and produce a different title.\n" : "") +
    "KEYWORDS: soft topic grounding only. Do NOT copy-paste keyword phrases. No keyword stuffing.\n" +
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
        var retried = false;
        try {
          var statusNow = '';
          try {
            var tripRecord2 = airtableGet_('Trips', { filterByFormula: "RECORD_ID() = '" + String(tripId) + "'", maxRecords: 1 });
            if (tripRecord2 && tripRecord2.records && tripRecord2.records.length) {
              statusNow = String((tripRecord2.records[0].fields || {})[IMAGES_STATUS_FIELD] || '');
            }
          } catch (eTripFetch) {}
          if (!statusNow) statusNow = String(tripFields[IMAGES_STATUS_FIELD] || '');
          if (statusNow === 'Pending') {
            if (clearStageLeaseIfRecoverableForRequestedStage_(tripId, 'Images')) {
              Logger.log('AI Images: cleared stale stage lease before Images claim retry for Trip ' + tripId);
              retried = true;
            }
          }
        } catch (eRecover) {}
        if (!(retried && claimStage_(tripId, 'Images', 25 * 60))) {
          Logger.log('AI Images: stage already claimed; skipping Trip ' + tripId);
          return;
        }
        Logger.log('AI Images: recovered stale Images claim; proceeding Trip ' + tripId);
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
      var images = fetchRecordsByTrip_(IMAGES_TABLE, tripId, tripNumber, 100, tripFields.Title) || [];
      
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
          natural0 = enforceCanonicalMuseumEntityForEnglishImageMeta_AiImages_(natural0, ctx, tripFields, tripImprovement);
          title = natural0.title;
          caption = natural0.caption;
          description = natural0.description;
          alt = natural0.alt;
          
          // Validate lengths
          if (title.length > 60) title = title.substring(0, 60).trim();
          if (caption.length > 150) caption = caption.substring(0, 150).trim();
          if (description.length > 300) description = description.substring(0, 300).trim();
          if (alt.length > 125) alt = alt.substring(0, 125).trim();
          var flu0 = fluencyCleanupEnglishImageMeta_AiImages_({ title: title, caption: caption, description: description, alt: alt }, ctx);
          title = flu0.title;
          caption = flu0.caption;
          description = flu0.description;
          alt = flu0.alt;
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
                  natural1 = enforceCanonicalMuseumEntityForEnglishImageMeta_AiImages_(natural1, ctx, tripFields, tripImprovement);
                  title = natural1.title;
                  caption = natural1.caption;
                  description = natural1.description;
                  alt = natural1.alt;
                  
                  if (title.length > 60) title = title.substring(0, 60).trim();
                  if (caption.length > 150) caption = caption.substring(0, 150).trim();
                  if (description.length > 300) description = description.substring(0, 300).trim();
                  if (alt.length > 125) alt = alt.substring(0, 125).trim();
                  var flu1 = fluencyCleanupEnglishImageMeta_AiImages_({ title: title, caption: caption, description: description, alt: alt }, ctx);
                  title = flu1.title;
                  caption = flu1.caption;
                  description = flu1.description;
                  alt = flu1.alt;
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
                  natural2 = enforceCanonicalMuseumEntityForEnglishImageMeta_AiImages_(natural2, ctx, tripFields, tripImprovement);
                  title = natural2.title;
                  caption = natural2.caption;
                  description = natural2.description;
                  alt = natural2.alt;
                  
                  if (title.length > 60) title = title.substring(0, 60).trim();
                  if (caption.length > 150) caption = caption.substring(0, 150).trim();
                  if (description.length > 300) description = description.substring(0, 300).trim();
                  if (alt.length > 125) alt = alt.substring(0, 125).trim();
                  var flu2 = fluencyCleanupEnglishImageMeta_AiImages_({ title: title, caption: caption, description: description, alt: alt }, ctx);
                  title = flu2.title;
                  caption = flu2.caption;
                  description = flu2.description;
                  alt = flu2.alt;
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
    "You are an expert travel content editor specializing in high-quality English image metadata for tourism websites.\n" +
    "Generate clean, natural, and complete English metadata for a tour image.\n\n" +
    
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
    
    "CRITICAL RULES (STRICT):\n" +
    "1) Natural, human-like English ONLY. Grammatically complete. No fragments. No abrupt endings.\n" +
    "2) No repetition (no duplicated words/phrases).\n" +
    "3) No generic filler (avoid 'and more', 'and beyond', 'etc.').\n" +
    "4) Visual specificity: describe what is actually visible (architecture, people, artifacts, atmosphere, setting).\n" +
    "5) Do NOT end with trailing clipped phrases like: 'the rich...', 'a glimpse into...', 'making it a perfect stop on...', 'immersed in the...'.\n" +
    "6) Context-aware naming if relevant (do NOT force): Egyptian Civilization Museum / National Museum of Egyptian Civilization, Citadel of Saladin, Old Cairo, Khan El-Khalili, Nile.\n\n" +

    "LENGTH RULES (GUIDANCE):\n" +
    "- title: 6–10 words (max 60 chars)\n" +
    "- alt: 8–12 words (max 125 chars)\n" +
    "- caption: 1 short complete sentence (max 150 chars)\n" +
    "- description: 1–2 full sentences (max 300 chars)\n\n" +

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
    var tripNumber = tripFields && tripFields.TripID ? String(tripFields.TripID).trim() : '';
    var tripKey = tripNumber || id;
    var safeTripKey = String(tripKey || '').replace(/'/g, "\\'");
    var impParams = {
      filterByFormula: "FIND('" + safeTripKey + "', ARRAYJOIN({Trip}))",
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
    var recs = fetchRecordsByTrip_(IMAGES_IMPROVEMENT_TABLE, tripId, tripNumber, 100) || [];
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
