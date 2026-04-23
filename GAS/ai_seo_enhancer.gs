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
var AI_SEO_KEYWORDS_MAX_LIST_ = 16;

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
    s = s.replace(/[^a-zA-Z0-9).!?]+$/g, '').trim();
  }
  return s;
}

function stripDanglingEndTokensSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return s;
  var weak = {
    and: 1, or: 1, but: 1, with: 1, for: 1, to: 1, from: 1, of: 1, in: 1, on: 1, at: 1, by: 1,
    your: 1, our: 1, the: 1, a: 1, an: 1,
    cultural: 1, historic: 1, historical: 1, guided: 1, unforgettable: 1, immersive: 1, premium: 1, scenic: 1, authentic: 1,
    perfect: 1, ideal: 1, great: 1
  };
  for (var i = 0; i < 6; i++) {
    var cleaned = s.replace(/[|—–\-:;,]+$/g, '').trim();
    var parts = cleaned.split(' ').filter(function(x) { return !!x; });
    if (!parts.length) break;
    var last = String(parts[parts.length - 1] || '').toLowerCase().replace(/[.!?]+$/g, '');
    if (!weak[last]) break;
    parts.pop();
    s = parts.join(' ').trim();
  }
  return s;
}

function stripDanglingCtaTailSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return s;
  var verbs = '(?:book|discover|explore|enjoy|visit|experience|reserve|plan|join|start|learn)';
  var det = '(?:your|our|the|a|an)';
  var weakTail = '(?:cultural|historic|historical|guided|unforgettable|immersive|premium|scenic|authentic|perfect|ideal|great)';
  var before = s;
  s = s.replace(/[|—–\-:;,]+$/g, '').trim();
  s = s.replace(new RegExp('\\b' + verbs + '\\b\\s*$', 'i'), '').trim();
  s = s.replace(new RegExp('\\b' + verbs + '\\s+' + det + '\\b\\s*$', 'i'), '').trim();
  s = s.replace(new RegExp('\\b' + verbs + '\\s+' + det + '\\s+' + weakTail + '(?:\\s+' + weakTail + ')?\\b\\s*$', 'i'), '').trim();
  s = s.replace(new RegExp('\\b' + verbs + '\\s+' + weakTail + '(?:\\s+' + weakTail + ')?\\b\\s*$', 'i'), '').trim();
  s = s.replace(/\b(?:perfect|ideal|great)\s+for\b(?:\s+(?:your|our|the|a|an))?\s*$/i, '').trim();
  s = s.replace(/\bbook\s+your\b\s*$/i, '').trim();
  s = s.replace(/[|—–\-:;,]+$/g, '').trim();
  return s === before ? s : s;
}

function stripTrailingPunctuationNoiseSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return s;
  s = s.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim();
  s = s.replace(/\s*[,;:|—–\-]+\s*$/g, '').trim();
  s = s.replace(/([.!?]){2,}\s*$/g, '$1').trim();
  s = s.replace(/[…]+$/g, '').trim();
  return s;
}

function normalizePunctuationNoiseSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return s;
  s = s.replace(/\s+([,.;!?])/g, '$1');
  s = s.replace(/,\s*([.!?])/g, '$1');
  s = s.replace(/([.!?])\s*,/g, '$1');
  s = s.replace(/\.{2,}/g, '.').replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?');
  s = s.replace(/\s*\.\s*\./g, '.').replace(/\s*,\s*,/g, ',');
  s = s.replace(/\s+,/g, ',');
  return s;
}

function isCivilizationMuseumContextSeoEn_(title, slug, meta) {
  var s = String(slug || '').toLowerCase();
  var t = String(title || '').toLowerCase();
  var m = String(meta || '').toLowerCase();
  if (s && s.indexOf('civilization') !== -1 && s.indexOf('museum') !== -1) return true;
  if (t.indexOf('civilization museum') !== -1 || /\bnmec\b/.test(t)) return true;
  if (m.indexOf('civilization museum') !== -1) return true;
  if (m.indexOf('national museum of egyptian civilization') !== -1) return true;
  return false;
}

function normalizeCivilizationMuseumPhraseSeoEn_(text, isCivilizationContext) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return '';
  if (!isCivilizationContext) return s;
  if (/egyptian civilization museum/i.test(s)) return s;
  if (/museum of egyptian civilization/i.test(s)) return s;
  if (/\bnmec\b/i.test(s)) return s;
  if (/\bcivilization museum\b/i.test(s) && !/\begyptian\b/i.test(s)) {
    s = s.replace(/\bCivilization Museum\b/gi, 'Egyptian Civilization Museum');
  }
  return s;
}

function isWeakEndingFragmentSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return false;
  var t = s.replace(/[\s"')\]]+$/g, '').trim();
  t = t.replace(/[|—–\-:;,]+$/g, '').trim();
  var noTerm = t.replace(/[.!?]+$/g, '').trim();
  if (!noTerm) return true;

  var lowered = noTerm.toLowerCase();
  var verbEnding = /(?:\bbook|\bdiscover|\bexplore|\bexperience|\benjoy|\bvisit|\bplan|\bstart|\bjoin)\b(?:\s+(?:your|our|the|a|an))?(?:\s+[a-z]{2,}){0,2}$/.test(lowered);
  if (verbEnding) return true;

  var parts = lowered.split(' ').filter(function(x) { return !!x; });
  if (!parts.length) return true;
  var last = String(parts[parts.length - 1] || '').replace(/[.!?]+$/g, '');
  var weakLast = {
    and: 1, or: 1, but: 1, with: 1, for: 1, to: 1, from: 1, of: 1, in: 1, on: 1, at: 1, by: 1,
    your: 1, our: 1, the: 1, a: 1, an: 1,
    cultural: 1, historic: 1, historical: 1, guided: 1, unforgettable: 1, immersive: 1, premium: 1, scenic: 1, authentic: 1,
    perfect: 1, ideal: 1, great: 1
  };
  if (weakLast[last]) return true;
  if (parts.length >= 2) {
    var last2 = parts[parts.length - 2] + ' ' + parts[parts.length - 1];
    if (/^(?:book your|plan your|start your|join our)$/.test(last2)) return true;
  }
  return false;
}

function trimToLastCompleteSentenceWithinLimitSeoEn_(text, maxLen) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return s;
  var n = Number(maxLen || 0);
  if (n > 0 && s.length > n) s = s.substring(0, n + 1);
  var last = -1;
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '.' || ch === '!' || ch === '?') last = i;
  }
  if (last < 0) return '';
  var cut = s.substring(0, last + 1).trim();
  cut = stripTrailingPunctuationNoiseSeoEn_(cut);
  return cut;
}

function truncatePreferSentenceBoundarySeoEn_(text, maxLen) {
  var s = normalizeWhitespaceSeoEn_(text);
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
  return truncateAtWordBoundarySeoEn_(s, n);
}

function fallbackToCompleteSentenceSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return s;
  var idx = Math.max(s.lastIndexOf('.'), s.lastIndexOf('!'), s.lastIndexOf('?'));
  if (idx >= 0 && idx >= Math.floor(s.length * 0.55)) return s.substring(0, idx + 1).trim();
  return s;
}

function finalizeSeoTextFieldEn_(text, maxLen) {
  var before = String(text || '');
  var s = stripTrailingConnectorsSeoEn_(truncateAtWordBoundarySeoEn_(before, maxLen));
  s = normalizePunctuationNoiseSeoEn_(s);
  s = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(s));
  s = normalizePunctuationNoiseSeoEn_(s);
  s = s.replace(/[.!?]+$/g, '').trim();
  return s;
}

function joinListWithAmpSeoEn_(items) {
  var xs = (Array.isArray(items) ? items : []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (xs.length <= 1) return xs.join('');
  if (xs.length === 2) return xs[0] + ' & ' + xs[1];
  return xs.slice(0, xs.length - 1).join(', ') + ' & ' + xs[xs.length - 1];
}

function extractAttractionsFromTitleSeoEn_(title) {
  var t = normalizeWhitespaceSeoEn_(title);
  if (!t) return [];
  var rhs = t;
  if (t.indexOf(':') !== -1) rhs = String(t.split(':').slice(1).join(':') || '').trim();
  rhs = rhs.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  rhs = rhs.replace(/&\s*amp;?/gi, '&').replace(/&amp;?/gi, '&');
  rhs = rhs.replace(/\s*&\s*/g, ', ').replace(/\s+and\s+/gi, ', ');
  rhs = rhs.replace(/\s*\+\s*/g, ' ').replace(/\s+/g, ' ').trim();
  var parts = rhs.split(',').map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x && !/^amp;?$/i.test(x); });
  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p) continue;
    if (p.length > 48) continue;
    if (/\blunch\b/i.test(p)) continue;
    if (/\bhotel\s+pick\s*-?\s*up\b/i.test(p)) continue;
    if (/\bpick\s*-?\s*up\b/i.test(p)) continue;
    if (/\bpickup\b/i.test(p)) continue;
    var key = p.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(p);
    if (out.length >= 3) break;
  }
  return out;
}

function extractPrimaryFromTitleSeoEn_(title) {
  var t = normalizeWhitespaceSeoEn_(title);
  if (!t) return '';
  if (t.indexOf(':') !== -1) return String(t.split(':')[0] || '').trim();
  if (t.indexOf(' - ') !== -1) return String(t.split(' - ')[0] || '').trim();
  if (t.indexOf(' | ') !== -1) return String(t.split(' | ')[0] || '').trim();
  return '';
}

function detectUspSuffixFromTextSeoEn_(text) {
  var t = String(text || '').toLowerCase();
  if (!t) return '';
  var hasLunch = /\blunch\b/.test(t);
  var hasPickup = /\b(hotel\s+pick\s*-?\s*up|hotel\s+pickup|pick\s*-?\s*up|pickup)\b/.test(t);
  if (hasLunch && hasPickup) return 'with Lunch & Hotel Pickup';
  if (hasLunch) return 'with Lunch';
  if (hasPickup) return 'with Hotel Pickup';
  return '';
}

function fixTripTypeCasingSeoEn_(text) {
  var s = normalizeWhitespaceSeoEn_(text);
  if (!s) return '';
  s = s.replace(/\bday tour\b/ig, 'Day Tour');
  return s;
}

function buildH1FromSeoSignalsSeoEn_(focusKeyword, seoTitle, tripTitle, uspSuffix) {
  var primary = normalizeWhitespaceSeoEn_(focusKeyword);
  if (!primary) primary = extractPrimaryFromTitleSeoEn_(seoTitle);
  if (!primary) primary = extractPrimaryFromTitleSeoEn_(tripTitle);
  if (!primary) primary = normalizeWhitespaceSeoEn_(seoTitle) || normalizeWhitespaceSeoEn_(tripTitle) || '';
  if (!primary) return '';
  primary = fixTripTypeCasingSeoEn_(primary);

  var atts = extractAttractionsFromTitleSeoEn_(seoTitle);
  if (!atts.length) atts = extractAttractionsFromTitleSeoEn_(tripTitle);
  var maxLen = 90;
  var usp = normalizeWhitespaceSeoEn_(uspSuffix);

  var base = primary;
  if (atts.length) base = primary + ': ' + joinListWithAmpSeoEn_(atts);
  base = truncateAtWordBoundarySeoEn_(base, maxLen);
  base = stripTrailingPunctuationNoiseSeoEn_(base);

  if (!usp) return base;
  if ((/\blunch\b/i.test(usp) && /\bwith\s+lunch\b/i.test(base)) || (/\bhotel pickup\b/i.test(usp) && /\bhotel\s+pick\s*-?\s*up\b/i.test(base))) return base;

  var reserved = usp.length + 1;
  var baseMax = maxLen - reserved;
  if (baseMax < 12) return base;

  var best = '';
  var startCount = Math.min(3, atts.length);
  for (var n = startCount; n >= 0; n--) {
    var b = primary;
    if (n > 0) b = primary + ': ' + joinListWithAmpSeoEn_(atts.slice(0, n));
    b = truncateAtWordBoundarySeoEn_(b, baseMax);
    b = stripTrailingPunctuationNoiseSeoEn_(b);
    if (!b) continue;
    var cand = (b + ' ' + usp).replace(/\s+/g, ' ').trim();
    if (cand.length <= maxLen) {
      best = cand;
      break;
    }
  }

  if (!best) {
    var b2 = truncateAtWordBoundarySeoEn_(primary, baseMax);
    b2 = stripTrailingPunctuationNoiseSeoEn_(b2);
    if (b2) best = (b2 + ' ' + usp).replace(/\s+/g, ' ').trim();
  }

  if (best) return best;
  return base;
}

function tryUpdateImprovementH1FieldSeoEn_(improvementId, h1Value) {
  var v = normalizeWhitespaceSeoEn_(h1Value);
  if (!improvementId || !v) return;
  try {
    airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, { AI_Titel_H1: v });
    return;
  } catch (e1) {}
  try {
    airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, { 'AI Titel H1': v });
    return;
  } catch (e1b) {}
  try {
    airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, { 'AI Title H1': v });
    return;
  } catch (e2) {}
  try {
    airtableUpdate_(AI_IMPROVEMENT_TABLE, improvementId, { AI_Title_H1: v });
    return;
  } catch (e3) {
    Logger.log('AI SEO Enhancer: could not save H1 field — ' + String(e3 && e3.message ? e3.message : e3));
  }
}

function finalizeSeoMetaDescriptionEn_Result_(text, maxLen) {
  var before = String(text || '');
  var raw = normalizeWhitespaceSeoEn_(before);
  var base0 = truncatePreferSentenceBoundarySeoEn_(raw, maxLen);
  base0 = normalizePunctuationNoiseSeoEn_(base0);
  base0 = stripTrailingPunctuationNoiseSeoEn_(base0);
  var base = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(base0));

  var repaired = false;
  var danglingDetected = false;
  var weakCtaRemoved = false;
  var trimmedToSentence = false;
  var fallbackUsed = false;

  var s = base;

  var afterCta = stripDanglingCtaTailSeoEn_(s);
  if (afterCta !== s) {
    weakCtaRemoved = true;
    s = afterCta;
  }

  var afterDangling = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(s));
  if (afterDangling !== s) {
    danglingDetected = true;
    s = afterDangling;
  }

  s = stripTrailingPunctuationNoiseSeoEn_(s);
  if (isWeakEndingFragmentSeoEn_(s)) {
    danglingDetected = true;
    var loop = 0;
    while (loop < 6 && isWeakEndingFragmentSeoEn_(s)) {
      var prev = s;
      s = stripDanglingCtaTailSeoEn_(s);
      s = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(s));
      s = stripTrailingPunctuationNoiseSeoEn_(s);
      if (s === prev) break;
      loop++;
    }
  }

  if (isWeakEndingFragmentSeoEn_(s)) {
    var sentence = trimToLastCompleteSentenceWithinLimitSeoEn_(raw, maxLen);
    if (sentence) {
      var candidate = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(sentence));
      candidate = stripTrailingPunctuationNoiseSeoEn_(candidate);
      if (candidate && !isWeakEndingFragmentSeoEn_(candidate)) {
        s = candidate;
        trimmedToSentence = true;
      }
    }
  }

  if (isWeakEndingFragmentSeoEn_(s)) {
    var fallback = fallbackToCompleteSentenceSeoEn_(base0);
    fallback = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(fallback));
    fallback = stripTrailingPunctuationNoiseSeoEn_(fallback);
    if (fallback && !isWeakEndingFragmentSeoEn_(fallback)) {
      s = fallback;
      fallbackUsed = true;
    }
  }

  if (!s) {
    s = base;
    s = stripDanglingCtaTailSeoEn_(s);
    s = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(s));
    s = stripTrailingPunctuationNoiseSeoEn_(s);
  }
  s = truncatePreferSentenceBoundarySeoEn_(s, maxLen);
  s = normalizePunctuationNoiseSeoEn_(s);
  s = stripTrailingPunctuationNoiseSeoEn_(s);
  s = stripDanglingCtaTailSeoEn_(s);
  s = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(s));
  s = normalizePunctuationNoiseSeoEn_(s);
  s = stripTrailingPunctuationNoiseSeoEn_(s);
  if (isWeakEndingFragmentSeoEn_(s)) {
    var guard = 0;
    while (guard < 6 && isWeakEndingFragmentSeoEn_(s)) {
      var prev2 = s;
      s = stripDanglingCtaTailSeoEn_(s);
      s = stripDanglingEndTokensSeoEn_(stripTrailingConnectorsSeoEn_(s));
      s = normalizePunctuationNoiseSeoEn_(s);
      s = stripTrailingPunctuationNoiseSeoEn_(s);
      if (s === prev2) break;
      guard++;
    }
    if (isWeakEndingFragmentSeoEn_(s)) s = '';
  }

  if (s !== base) repaired = true;
  return { text: s, repaired: repaired, danglingDetected: danglingDetected, weakCtaRemoved: weakCtaRemoved, trimmedToSentence: trimmedToSentence, fallbackUsed: fallbackUsed };
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
function isLatinScriptSeoKeywordPhrase_(s) {
  var t = String(s || '').trim();
  if (!t) return false;
  if (/[\u0600-\u06FF]/.test(t)) return false;
  if (/[\u0400-\u04FF]/.test(t)) return false;
  if (/[\u4E00-\u9FFF]/.test(t)) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/[^A-Za-z0-9 '&\-\.,/()]/.test(t)) return false;
  return true;
}

function englishSeoTokenize_(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .split(/[\s\-\/,.;:()&]+/)
    .map(function(x) { return String(x || '').trim(); })
    .filter(function(x) { return !!x; });
}

function detectLanguageSafeSeo_Keyword_(text) {
  try {
    var s = String(text || '');
    if (!s) return '';
    if(/[\u0400-\u04FF]/.test(s)) return 'ru';
    if(/[\u4E00-\u9FFF]/.test(s)) return 'zh';
    if(/[\u3040-\u30FF]/.test(s)) return 'ja';
    if(/[\uAC00-\uD7AF]/.test(s)) return 'ko';
    if (/[ğşıçöüİ]/i.test(s)) return 'tr';
    if (/[áéíóúñ¿¡]/i.test(s)) return 'es';
    if (/[àâçéèêëîïôûùüÿœ]/i.test(s)) return 'fr';
    if (/[äöüß]/i.test(s)) return 'de';
    return '';
  } catch (e) {
    return '';
  }
}

function normalizeForLocalePhraseMatchSeo_Keyword_(text) {
  var s = String(text || '').toLowerCase();
  s = s.replace(/['"]/g, '');
  s = s.replace(/[^a-z0-9\s\-]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function detectTranslatedLocaleMarkerForEnglishKeyword_(phrase) {
  var t = String(phrase || '').trim();
  if (!t) return '';
  var det = detectLanguageSafeSeo_Keyword_(t);
  if (det && det !== 'en') return 'detected_lang_' + det;
  var n = normalizeForLocalePhraseMatchSeo_Keyword_(t);
  if (!n) return '';
  if (n.indexOf('kairo') !== -1) return 'locale_de_kairo';
  if (n.indexOf('ausflug') !== -1) return 'locale_de_ausflug';
  if (n.indexOf('pyramiden') !== -1) return 'locale_de_pyramiden';
  if (n.indexOf('kahire') !== -1) return 'locale_tr_kahire';
  if (n.indexOf('turu') !== -1) return 'locale_tr_turu';
  if (n.indexOf('turlari') !== -1 || n.indexOf('turlari') !== -1) return 'locale_tr_turlari';
  if (n.indexOf('misir') !== -1) return 'locale_tr_misir';
  if (n.indexOf('gunubirlik') !== -1) return 'locale_tr_gunubirlik';
  if (n.indexOf('gezilecek') !== -1) return 'locale_tr_gezilecek';
  if (n.indexOf('yerler') !== -1) return 'locale_tr_yerler';
  if (n.indexOf('piramit') !== -1) return 'locale_tr_piramit';
  if (n.indexOf('musee') !== -1) return 'locale_fr_musee';
  if (n.indexOf('visite') !== -1) return 'locale_fr_visite';
  if (n.indexOf('museo') !== -1) return 'locale_es_museo';
  if (n.indexOf('visita') !== -1) return 'locale_es_visita';
  return '';
}

function getEnglishSeoAllowedTokens_() {
  return {
    cairo: true, giza: true, luxor: true, aswan: true, hurghada: true, sharm: true, dahab: true, alexandria: true, marsa: true, alam: true, siwa: true,
    egypt: true, nile: true,
    tour: true, tours: true, trip: true, package: true, itinerary: true, excursion: true, excursions: true, transfer: true,
    day: true, full: true, half: true, private: true, guided: true, vip: true, group: true,
    museum: true, museums: true, civilization: true, grand: true, egyptian: true, national: true,
    pyramids: true, pyramid: true, sphinx: true, citadel: true, bazaar: true, market: true, mosque: true, church: true,
    cruise: true, snorkeling: true, safari: true, desert: true, quad: true, biking: true, boat: true,
    from: true, to: true, in: true, on: true, at: true, of: true, and: true, with: true, for: true, by: true
  };
}

function getEnglishSeoDenyTokens_() {
  return {
    // German
    kairo: true, ausflug: true, pyramiden: true,
    // Turkish
    kahire: true, turu: true, tur: true, turlar: true, turlari: true, gezilecek: true, yerler: true, gezi: true, gezisi: true, piramit: true, piramitler: true,
    // French/Spanish common travel tokens
    visite: true, visita: true, musee: true, museo: true, excursiones: true,
    // Common non-English stopwords that frequently leak
    und: true, oder: true, mit: true, ohne: true, fur: true, von: true, zum: true, zur: true
  };
}

function passesEnglishLexicalGuard_(phrase) {
  var tokens = englishSeoTokenize_(phrase);
  if (!tokens.length) return false;
  var localeMarker = detectTranslatedLocaleMarkerForEnglishKeyword_(phrase);
  if (localeMarker) return false;
  var allow = getEnglishSeoAllowedTokens_();
  var deny = getEnglishSeoDenyTokens_();
  var allowCount = 0;
  var unknownCount = 0;
  for (var i = 0; i < tokens.length; i++) {
    var w = tokens[i];
    if (!w) continue;
    if (deny[w]) return false;
    if (/^\d+$/.test(w)) continue;
    if (allow[w]) { allowCount++; continue; }
    if (w.length <= 2) continue;
    unknownCount++;
  }
  if (allowCount === 0) return false;
  if (unknownCount >= 2 && allowCount <= 1) return false;
  return true;
}

function isEnglishSeoKeywordPhrase_(s) {
  if (!isLatinScriptSeoKeywordPhrase_(s)) return false;
  return passesEnglishLexicalGuard_(s);
}

function normalizeEnglishSeoKeywordPhrase_(value) {
  var s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (!isEnglishSeoKeywordPhrase_(s)) return '';
  return s;
}

function parseRawKeywordsListForCount_(value) {
  var raw = value;
  var list = [];
  if (Array.isArray(raw)) {
    list = raw.map(function(x) { return String(x || '').trim(); });
  } else if (raw) {
    list = String(raw).split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); });
  }
  list = list.filter(function(x) { return !!x; });
  return list;
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

  if (uniq.length > AI_SEO_KEYWORDS_MAX_LIST_) uniq = uniq.slice(0, AI_SEO_KEYWORDS_MAX_LIST_);
  return uniq;
}

function filterEnglishKeywordsWithLocaleDiagnostics_(rawList, label) {
  var list = Array.isArray(rawList) ? rawList : parseRawKeywordsListForCount_(rawList);
  var out = [];
  var rejectedLocale = 0;
  var rejectedScript = 0;
  var examples = [];
  for (var i = 0; i < list.length; i++) {
    var p = String(list[i] || '').trim();
    if (!p) continue;
    if (!isLatinScriptSeoKeywordPhrase_(p)) { rejectedScript++; continue; }
    var marker = detectTranslatedLocaleMarkerForEnglishKeyword_(p);
    if (marker) {
      rejectedLocale++;
      if (examples.length < 3) examples.push({ phrase: p.substring(0, 70), marker: marker });
      continue;
    }
    if (!passesEnglishLexicalGuard_(p)) continue;
    out.push(p);
  }
  var seen = {};
  var uniq = [];
  out.forEach(function(x) {
    var k = x.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    uniq.push(x);
  });
  if (rejectedLocale) Logger.log('AI SEO Enhancer: rejected locale phrases (' + label + '): ' + rejectedLocale + (examples.length ? (' examples=' + JSON.stringify(examples)) : ''));
  return { list: uniq, rejectedLocale: rejectedLocale, rejectedScript: rejectedScript };
}

function buildRawKeywordCandidatePoolSeoEn_(fields) {
  var f = fields || {};
  var pool = [];
  var focus = String(f.SEO_FocusKeywords || '').trim();
  if (focus) pool.push(focus);
  var listRaw = parseRawKeywordsListForCount_(f.SEO_FocusKeywords_List || '');
  listRaw.forEach(function(x) { if (x) pool.push(String(x).trim()); });
  pool = pool.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  var seen = {};
  var uniq = [];
  pool.forEach(function(x) {
    var k = x.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    uniq.push(x);
  });
  return uniq.slice(0, 40);
}

function buildKeywordCleaningPromptSeoEn_(fields, linkedTextBlocks, rawPool) {
  var f = fields || {};
  var title = String(f.Title || '').trim();
  var desc = String(f.AI_Trip_Description || f.Trip_Description || '').trim();
  if (desc.length > 420) desc = desc.substring(0, 420);
  var ctx = String(desc || '').trim();
  var candidates = (rawPool || []).map(function(x) { return '- ' + String(x || '').trim(); }).join('\n');

  return (
    "You are an English SEO keyword curator for Egypt travel/tour pages.\n" +
    "Your job: from the mixed-language candidate pool, EXTRACT ALL valid ENGLISH SEO-safe keyword phrases.\n\n" +
    "STRICT RULES:\n" +
    "- Output ENGLISH ONLY. Reject any non-English phrase even if it uses Latin letters.\n" +
    "- Reject translated locale phrases (e.g. German/French/Turkish travel wording).\n" +
    "- Keep every trip-relevant English phrase from the pool; do NOT over-prune to a tiny shortlist.\n" +
    "- Preserve attraction-specific/destination/landmark English phrases when relevant.\n" +
    "- Prefer phrases that match the trip title/context.\n" +
    "- Keep phrases short and SEO-friendly (2-6 words).\n" +
    "- Do NOT invent unrelated keywords.\n" +
    "- If none are valid, return an empty list and empty primary.\n\n" +
    "TRIP TITLE: " + title + "\n" +
    (ctx ? ("TRIP CONTEXT (excerpt): " + ctx + "\n") : "") +
    "\nCANDIDATE KEYWORDS:\n" + candidates + "\n\n" +
    "OUTPUT JSON ONLY:\n" +
    "{\n" +
    '  "primary": "....",\n' +
    '  "list": ["....", "...."]\n' +
    "}\n"
  );
}

function mergeKeywordListsPreserveBreadthSeoEn_(aiList, sourceList, maxCount) {
  var m = Number(maxCount || AI_SEO_KEYWORDS_MAX_LIST_ || 16);
  if (m <= 0) m = 16;
  var out = [];
  var seen = {};
  function pushMany(arr) {
    (arr || []).forEach(function(x) {
      var v = String(x || '').trim();
      if (!v) return;
      var k = v.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(v);
    });
  }
  pushMany(aiList || []);
  pushMany(sourceList || []);
  if (out.length > m) out = out.slice(0, m);
  return out;
}

function detectTranslatedLocaleMarkerStrictFinalSeoEn_(phrase) {
  var n = normalizeForLocalePhraseMatchSeo_Keyword_(phrase);
  if (!n) return '';
  if (/\bexcursion\s+le\s+caire\b/.test(n)) return 'final_fr_excursion_le_caire';
  if (/\bexcursion\s+el\s+cairo\b/.test(n)) return 'final_es_excursion_el_cairo';
  if (/\ble\s+caire\b/.test(n)) return 'final_fr_le_caire';
  if (/\bdepuis\b/.test(n)) return 'final_fr_depuis';
  if (/\bpiramides\b/.test(n)) return 'final_es_piramides';
  if (/\bde\s+giza\b/.test(n)) return 'final_romance_de_giza';
  return '';
}

function isStrictFinalEnglishKeywordPhraseSeoEn_(phrase) {
  var p = String(phrase || '').trim();
  if (!p) return false;
  if (!isEnglishSeoKeywordPhrase_(p)) return false;
  if (detectTranslatedLocaleMarkerStrictFinalSeoEn_(p)) return false;
  return true;
}

function applyFinalEnglishKeywordGateSeoEn_(candidateList, sourceSafePool) {
  var list = Array.isArray(candidateList) ? candidateList : parseRawKeywordsListForCount_(candidateList);
  var rawCount = list.length;
  var rejected = 0;
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var p = String(list[i] || '').trim();
    if (!p) continue;
    if (!isStrictFinalEnglishKeywordPhraseSeoEn_(p)) { rejected++; continue; }
    var k = p.toLowerCase();
    if (seen[k]) continue;
    seen[k] = true;
    out.push(p);
  }
  var refillUsed = 0;
  var pool = Array.isArray(sourceSafePool) ? sourceSafePool : [];
  for (var j = 0; j < pool.length && out.length < AI_SEO_KEYWORDS_MAX_LIST_; j++) {
    var s = String(pool[j] || '').trim();
    if (!s) continue;
    if (!isStrictFinalEnglishKeywordPhraseSeoEn_(s)) continue;
    var ks = s.toLowerCase();
    if (seen[ks]) continue;
    seen[ks] = true;
    out.push(s);
    refillUsed++;
  }
  if (out.length > AI_SEO_KEYWORDS_MAX_LIST_) out = out.slice(0, AI_SEO_KEYWORDS_MAX_LIST_);
  return { rawCount: rawCount, rejected: rejected, refillUsed: refillUsed, list: out };
}

function cleanEnglishKeywordsWithAiSeoEn_(combinedFields, linkedTextBlocks) {
  var rawPool = buildRawKeywordCandidatePoolSeoEn_(combinedFields);
  Logger.log('AI SEO Enhancer: keyword candidates pool=' + rawPool.length);
  if (!rawPool.length) return { primary: '', list: [] };

  var prompt = buildKeywordCleaningPromptSeoEn_(combinedFields, linkedTextBlocks, rawPool);
  var ai = null;
  try { ai = callAi_(prompt); } catch (e) { ai = null; }
  if (!ai || typeof ai !== 'object') {
    Logger.log('AI SEO Enhancer: keyword cleaning AI output invalid; using fallback');
    var fallback = filterEnglishKeywordsWithLocaleDiagnostics_(rawPool, 'source_fallback');
    var p = fallback.list.length ? fallback.list[0] : '';
    return { primary: p, list: fallback.list.slice(0, AI_SEO_KEYWORDS_MAX_LIST_), sourceSafeList: fallback.list.slice(0, AI_SEO_KEYWORDS_MAX_LIST_) };
  }

  var aiPrimary = normalizeEnglishSeoKeywordPhrase_(ai.primary);
  var aiListDiag = filterEnglishKeywordsWithLocaleDiagnostics_(ai.list || [], 'ai_keyword_cleaning');
  var aiList = aiListDiag.list.slice(0, AI_SEO_KEYWORDS_MAX_LIST_);
  var sourceDiag = filterEnglishKeywordsWithLocaleDiagnostics_(rawPool, 'source_preserve');
  var mergedList = mergeKeywordListsPreserveBreadthSeoEn_(aiList, sourceDiag.list, AI_SEO_KEYWORDS_MAX_LIST_);
  var preserved = Math.max(0, mergedList.length - aiList.length);
  if (preserved > 0) Logger.log('AI SEO Enhancer: preserved valid English phrases from source pool: ' + preserved);
  aiList = mergedList;
  if (!aiPrimary && aiList.length) aiPrimary = normalizeEnglishSeoKeywordPhrase_(aiList[0]);
  Logger.log('AI SEO Enhancer: cleaned English extraction count=' + aiList.length);
  Logger.log('AI SEO Enhancer: AI-cleaned primary="' + (aiPrimary || '') + '" list=' + aiList.length);

  if (!aiPrimary && !aiList.length) {
    Logger.log('AI SEO Enhancer: keyword cleaning produced empty; using fallback');
    var fallback2 = filterEnglishKeywordsWithLocaleDiagnostics_(rawPool, 'source_fallback');
    var p2 = fallback2.list.length ? fallback2.list[0] : '';
    return { primary: p2, list: fallback2.list.slice(0, AI_SEO_KEYWORDS_MAX_LIST_), sourceSafeList: fallback2.list.slice(0, AI_SEO_KEYWORDS_MAX_LIST_) };
  }
  if (!aiList.length && aiPrimary) aiList = [aiPrimary];
  return { primary: aiPrimary || '', list: aiList, sourceSafeList: sourceDiag.list.slice(0, AI_SEO_KEYWORDS_MAX_LIST_) };
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
          var retried = false;
          try {
            var impStatus = '';
            if (improvementId) {
              try {
                var impRes = airtableGet_(AI_IMPROVEMENT_TABLE, { filterByFormula: "RECORD_ID() = '" + String(improvementId) + "'", maxRecords: 1 });
                if (impRes && impRes.records && impRes.records.length) {
                  impStatus = String((impRes.records[0].fields || {}).AI_SEO_Status || '');
                }
              } catch (eImpFetch) {}
            }
            if (!impStatus) impStatus = String((improvementFields && improvementFields.AI_SEO_Status) ? improvementFields.AI_SEO_Status : '');
            if (impStatus === 'Pending') {
              if (clearStageLeaseIfRecoverableForRequestedStage_(tripId, 'SEO')) {
                Logger.log('AI SEO Enhancer: cleared stale stage lease before SEO claim retry for Trip ' + tripId);
                retried = true;
              }
            }
          } catch (eRecover) {}

          if (!(retried && claimStage_(tripId, 'SEO', 20 * 60))) {
            Logger.log('AI SEO Enhancer: stage already claimed; skipping Trip ' + tripId);
            return;
          }
          Logger.log('AI SEO Enhancer: recovered stale SEO claim; proceeding Trip ' + tripId);
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

        // 5) Keyword cleaning (AI-only selection for enhanced fields)
        var cleanedKw = cleanEnglishKeywordsWithAiSeoEn_(combinedFields, linkedTextBlocks);
        combinedFields._EN_Cleaned_Seo_Focus = cleanedKw.primary || '';
        combinedFields._EN_Cleaned_Seo_Keywords_List = cleanedKw.list || [];

        var prompt = buildSeoPromptFromImprovedContent_(combinedFields, linkedTextBlocks);

        // 6) Call AI
        if (typeof callAi_ !== 'function') {
          throw new Error('callAi_ function is not defined');
        }
        
        var aiResult = callAi_(prompt);

        if (!aiResult || typeof aiResult !== 'object') {
          throw new Error('Invalid AI SEO result (not an object)');
        }

        if (aiResult.AI_SEO_FocusKeywords_List !== undefined) {
          var rawAiList = parseRawKeywordsListForCount_(aiResult.AI_SEO_FocusKeywords_List);
          var rawAiCount = rawAiList.length;
          var diagAi = filterEnglishKeywordsWithLocaleDiagnostics_(rawAiList, 'ai_output');
          var englishList = diagAi.list;
          Logger.log('AI SEO Enhancer: final AI keyword list raw=' + rawAiCount + ' english=' + englishList.length);
          if (!englishList.length && aiResult.AI_SEO_FocusKeywords) {
            var fk = String(aiResult.AI_SEO_FocusKeywords || '').trim();
            if (fk && isEnglishSeoKeywordPhrase_(fk)) englishList = [fk];
          }
          aiResult.AI_SEO_FocusKeywords_List = englishList;
        }

        var sourceEnglishListForRecovery = normalizeKeywordsListToEnglish_(combinedFields.SEO_FocusKeywords_List || '');
        var sourceEnglishFocusForRecovery = normalizeEnglishSeoKeywordPhrase_(combinedFields.SEO_FocusKeywords || '');

        var aiFocus = normalizeEnglishSeoKeywordPhrase_(aiResult.AI_SEO_FocusKeywords);
        if (!aiFocus) {
          if (aiResult.AI_SEO_FocusKeywords) Logger.log('AI SEO Enhancer: AI focus keyword rejected as non-English: ' + String(aiResult.AI_SEO_FocusKeywords));
          if (aiResult.AI_SEO_FocusKeywords_List && Array.isArray(aiResult.AI_SEO_FocusKeywords_List) && aiResult.AI_SEO_FocusKeywords_List.length) {
            aiFocus = normalizeEnglishSeoKeywordPhrase_(aiResult.AI_SEO_FocusKeywords_List[0]);
            if (aiFocus) Logger.log('AI SEO Enhancer: recovered English primary keyword from AI keyword list');
          }
          if (!aiFocus && sourceEnglishFocusForRecovery) {
            aiFocus = sourceEnglishFocusForRecovery;
            Logger.log('AI SEO Enhancer: recovered English primary keyword from source focus keyword');
          }
          if (!aiFocus && sourceEnglishListForRecovery.length) {
            aiFocus = normalizeEnglishSeoKeywordPhrase_(sourceEnglishListForRecovery[0]);
            if (aiFocus) Logger.log('AI SEO Enhancer: recovered English primary keyword from source keyword list');
          }
        }
        aiResult.AI_SEO_FocusKeywords = aiFocus || '';
        if (!Array.isArray(aiResult.AI_SEO_FocusKeywords_List)) aiResult.AI_SEO_FocusKeywords_List = [];
        aiResult.AI_SEO_FocusKeywords_List = normalizeKeywordsListToEnglish_(aiResult.AI_SEO_FocusKeywords_List);
        if (!aiResult.AI_SEO_FocusKeywords_List.length && sourceEnglishListForRecovery.length) {
          aiResult.AI_SEO_FocusKeywords_List = sourceEnglishListForRecovery;
          Logger.log('AI SEO Enhancer: recovered final English keyword list from clean source');
        }
        if (!aiResult.AI_SEO_FocusKeywords_List.length && aiResult.AI_SEO_FocusKeywords) {
          aiResult.AI_SEO_FocusKeywords_List = [aiResult.AI_SEO_FocusKeywords];
        }

        var sourceSafePoolFinal = (cleanedKw && cleanedKw.sourceSafeList && cleanedKw.sourceSafeList.length) ? cleanedKw.sourceSafeList : sourceEnglishListForRecovery;
        var extractedList = (cleanedKw && cleanedKw.list && cleanedKw.list.length) ? cleanedKw.list : aiResult.AI_SEO_FocusKeywords_List;
        var finalGate = applyFinalEnglishKeywordGateSeoEn_(extractedList, sourceSafePoolFinal);
        Logger.log('AI SEO Enhancer: AI extracted phrase count=' + finalGate.rawCount);
        if (finalGate.rejected) Logger.log('AI SEO Enhancer: final English gate rejected extracted phrases=' + finalGate.rejected);
        if (finalGate.refillUsed) Logger.log('AI SEO Enhancer: refill used clean English-safe pool count=' + finalGate.refillUsed);
        aiResult.AI_SEO_FocusKeywords_List = finalGate.list;

        var finalPrimary = (cleanedKw && cleanedKw.primary) ? cleanedKw.primary : aiResult.AI_SEO_FocusKeywords;
        if (!isStrictFinalEnglishKeywordPhraseSeoEn_(finalPrimary)) finalPrimary = '';
        if (!finalPrimary && aiResult.AI_SEO_FocusKeywords_List.length) finalPrimary = aiResult.AI_SEO_FocusKeywords_List[0];
        if (!finalPrimary && isStrictFinalEnglishKeywordPhraseSeoEn_(sourceEnglishFocusForRecovery)) finalPrimary = sourceEnglishFocusForRecovery;
        aiResult.AI_SEO_FocusKeywords = finalPrimary || '';
        if (!aiResult.AI_SEO_FocusKeywords_List.length && aiResult.AI_SEO_FocusKeywords) aiResult.AI_SEO_FocusKeywords_List = [aiResult.AI_SEO_FocusKeywords];
        Logger.log('AI SEO Enhancer: final saved keyword list count=' + (Array.isArray(aiResult.AI_SEO_FocusKeywords_List) ? aiResult.AI_SEO_FocusKeywords_List.length : 0));

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

        var slugNowForSeo = String(combinedFields.Slug || combinedFields.slug || aiResult.AI_SEO_Permalink || combinedFields.Permalink || '').trim();
        var civCtxSeo = isCivilizationMuseumContextSeoEn_(combinedFields.Title || '', slugNowForSeo, (aiResult.AI_SEO_Meta_Description || '') + ' ' + (aiResult.AI_SEO_Title || ''));

        if (aiResult.AI_SEO_Title) {
          var beforeTitle = String(aiResult.AI_SEO_Title || '').trim();
          aiResult.AI_SEO_Title = normalizeCivilizationMuseumPhraseSeoEn_(aiResult.AI_SEO_Title, civCtxSeo);
          aiResult.AI_SEO_Title = finalizeSeoTextFieldEn_(aiResult.AI_SEO_Title, AI_SEO_TITLE_MAX_LEN_);
          if (beforeTitle !== aiResult.AI_SEO_Title) Logger.log('AI SEO Enhancer: SEO title cleaned');
        }
        if (aiResult.AI_SEO_Meta_Description) {
          var beforeMeta = String(aiResult.AI_SEO_Meta_Description || '').trim();
          var metaRes = finalizeSeoMetaDescriptionEn_Result_(aiResult.AI_SEO_Meta_Description, AI_SEO_META_MAX_LEN_);
          var normalizedMeta = normalizeCivilizationMuseumPhraseSeoEn_(metaRes.text, civCtxSeo);
          if (normalizedMeta !== metaRes.text) metaRes = finalizeSeoMetaDescriptionEn_Result_(normalizedMeta, AI_SEO_META_MAX_LEN_);
          aiResult.AI_SEO_Meta_Description = metaRes.text;
          if (metaRes.danglingDetected) Logger.log('AI SEO Enhancer: SEO description dangling ending detected');
          if (metaRes.weakCtaRemoved) Logger.log('AI SEO Enhancer: SEO description weak CTA tail removed');
          if (metaRes.trimmedToSentence) Logger.log('AI SEO Enhancer: SEO description trimmed to last complete sentence');
          if (metaRes.fallbackUsed) Logger.log('AI SEO Enhancer: SEO description fallback complete sentence used');
          if (beforeMeta !== aiResult.AI_SEO_Meta_Description) Logger.log('AI SEO Enhancer: SEO meta description cleaned');
        }
        if (aiResult.AI_SEO_Permalink) {
          var beforeSlug = String(aiResult.AI_SEO_Permalink || '').trim();
          var originalPermalink = combinedFields.Permalink || '';
          aiResult.AI_SEO_Permalink = finalizeSeoSlugEn_(aiResult.AI_SEO_Permalink, originalPermalink, combinedFields.Title || '');
          if (beforeSlug !== aiResult.AI_SEO_Permalink) Logger.log('AI SEO Enhancer: slug trimmed/repaired');
        }

        var uspTextPool = []
          .concat(linkedTextBlocks || [])
          .concat(improvedSignals || [])
          .join(' | ');
        var uspSuffix = detectUspSuffixFromTextSeoEn_(uspTextPool);
        var computedH1 = buildH1FromSeoSignalsSeoEn_(aiResult.AI_SEO_FocusKeywords, aiResult.AI_SEO_Title, combinedFields.Title || '', uspSuffix);
        if (computedH1) aiResult.AI_Titel_H1 = normalizeCivilizationMuseumPhraseSeoEn_(computedH1, civCtxSeo);

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
          if (aiResult.AI_Titel_H1) tryUpdateImprovementH1FieldSeoEn_(improvementId, aiResult.AI_Titel_H1);
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
  var originalSeoFocusRaw     = fields._EN_Cleaned_Seo_Focus ? fields._EN_Cleaned_Seo_Focus : (fields.SEO_FocusKeywords || '');
  var originalSeoKeywordsList = fields.SEO_FocusKeywords_List || '';

  var rawCount = parseRawKeywordsListForCount_(originalSeoKeywordsList).length;
  var seoKeywordsJoined = '';
  var rawList = parseRawKeywordsListForCount_(originalSeoKeywordsList);
  var englishProvidedList = [];
  if (fields._EN_Cleaned_Seo_Keywords_List && Array.isArray(fields._EN_Cleaned_Seo_Keywords_List) && fields._EN_Cleaned_Seo_Keywords_List.length) {
    englishProvidedList = filterEnglishKeywordsWithLocaleDiagnostics_(fields._EN_Cleaned_Seo_Keywords_List, 'cleaned_override').list;
  } else {
    var diagSrc = filterEnglishKeywordsWithLocaleDiagnostics_(rawList, 'source');
    englishProvidedList = diagSrc.list;
  }
  Logger.log('AI SEO Enhancer: source keyword list raw=' + rawCount + ' english=' + englishProvidedList.length);
  if (englishProvidedList.length) {
    seoKeywordsJoined = englishProvidedList.join(', ');
  }
  var originalSeoFocus = normalizeEnglishSeoKeywordPhrase_(originalSeoFocusRaw);
  if (originalSeoFocusRaw && !originalSeoFocus) {
    Logger.log('AI SEO Enhancer: original focus keyword rejected as non-English: ' + String(originalSeoFocusRaw));
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
