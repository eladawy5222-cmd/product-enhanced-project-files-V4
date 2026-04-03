# TREA FEEDBACK — إصلاح 3 مشاكل في نشر/تحديث الصور (updater.js + updater.gs)

## السياق
عند نشر رحلة (Trip 26144) وترجمتها للصينية (zh-hans)، ظهرت 3 مشاكل في الصور:
1. الصورة المميزة (Featured) لم تُعيّن (Featured: None) في أول تشغيلين
2. الـ Alt Text فاضي على WordPress رغم أن اللوج يقول "Updated Media"
3. بعد التحديث، الصور المترجمة لا يُعاد تحديث metadata لها لأن الكود بيعمل skip

---

## المشكلة 1: Featured Image = None

### الموقع
`updater.js` — دالة `publishImagesSafe_Updater_` — حوالي سطر 4272

### المشكلة
```javascript
var declaredType = getTypeNameFromAirtable_Updater_(f.Type).trim().toLowerCase();
if (declaredType === 'featured') {
    if (!featId) featId = wpMediaId;
} else if (declaredType === 'gallery') {
    galleryIds.push(wpMediaId);
} else {
    continue;  // ← لو Type فاضي أو undefined، بيتخطى الصورة بالكامل
}
```

حقل `Type` في جدول "Images Improvement With AI" ممكن يكون فاضي أو يحتوي على قيمة غير متوقعة. الكود بيعمل `continue` ومش بيعمل logging — فمفيش طريقة نعرف إن الصورة اتخطت.

### الحل المطلوب

1. **أضف logging قبل الـ Type check** عشان نعرف القيمة الفعلية:
```javascript
log('Updater: Image record ' + imgRec.id + ' Type raw value: ' + JSON.stringify(f.Type) + ', wpMediaId: ' + wpMediaId);
```

2. **أضف fallback ذكي**: لو `Type` فاضي وفيه صورة واحدة بس من نوع featured مش موجودة، اعتبر أول صورة هي الـ featured. وكمان لو `Type` فاضي لكن الصورة مربوطة بـ Raw Image اللي `Caption` بتاعها فيها "featuredimage":
```javascript
var declaredType = getTypeNameFromAirtable_Updater_(f.Type).trim().toLowerCase();

// Fallback: لو Type فاضي، حاول نستنتجه من الـ Raw Image record
if (!declaredType && linkedIdForRaw) {
    var rawRec = rawImagesRecords ? rawImagesRecords.find(function(r) { return r.id === linkedIdForRaw; }) : null;
    if (rawRec) {
        var role = getImageRoleFromCaption_Updater_(rawRec.fields.Caption || rawRec.fields.Notes || '');
        if (role) {
            declaredType = role;
            log('Updater: Type inferred from raw image caption: ' + declaredType);
        }
    }
}

// Fallback 2: لو لسه فاضي، اعتبرها gallery (بدل ما نعمل continue ونخسرها)
if (!declaredType) {
    declaredType = 'gallery';
    log('Updater: WARNING - Image ' + imgRec.id + ' has no Type. Defaulting to gallery.');
}
```

3. **طبّق نفس الحل** في `updater.gs` في الدالة المقابلة.

---

## المشكلة 2: Alt Text لا يُحفظ فعلياً على WordPress

### الموقع
`updater.js` — دالة `updateMediaOnWordPress_Updater_` — حوالي سطر 4367

### المشكلة
الدالة بترسل `alt_text` في الـ JSON payload لكن WordPress REST API `/wp/v2/media/{id}` **بيتجاهل `alt_text` أحياناً** لأن الـ Alt Text في WordPress يُخزن في `wp_postmeta` كـ `_wp_attachment_image_alt` وليس في `wp_posts` — وده بيحتاج معاملة خاصة.

المشكلة إن الكود بيعمل log "Updated Media" بناءً على HTTP 200 بدون ما يتأكد إن الـ alt فعلاً اتحفظ.

### الحل المطلوب

1. **أضف verification بعد التحديث** — اقرأ الـ media مرة تانية وتأكد إن الـ alt اتحفظ:
```javascript
async function updateMediaOnWordPress_Updater_(mediaId, data) {
  // ... الكود الحالي للبناء والإرسال ...
  
  try {
      var resp = await fetchUrl(mediaUrl, options);
      if (resp.getResponseCode() === 200) {
          log('Updater: Updated Media ' + mediaId + ' metadata (Title: ' + (data.title ? 'Yes' : 'No') + ', Alt: ' + (data.alt_text ? 'Yes' : 'No') + ')');
          
          // === NEW: Verify alt_text was actually saved ===
          if (data.alt_text) {
              await sleep(500); // Wait for WP to process
              try {
                  var verifyJson = await getMediaFromWordPress_Updater_(String(mediaId));
                  var savedAlt = verifyJson && verifyJson.alt_text ? String(verifyJson.alt_text).trim() : '';
                  if (!savedAlt) {
                      warn('Updater: Alt text NOT saved for Media ' + mediaId + ' despite 200 OK. Retrying...');
                      // Retry with a direct meta update approach
                      var retryPayload = JSON.stringify({ alt_text: data.alt_text });
                      var retryResp = await fetchUrl(mediaUrl, {
                          method: 'post',
                          contentType: 'application/json',
                          payload: retryPayload,
                          headers: { 'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS) },
                          muteHttpExceptions: true
                      });
                      if (retryResp.getResponseCode() === 200) {
                          log('Updater: Alt text retry for Media ' + mediaId + ' completed.');
                      } else {
                          error('Updater: Alt text retry FAILED for Media ' + mediaId + ': ' + retryResp.getContentText());
                      }
                  }
              } catch (eVerify) {
                  warn('Updater: Could not verify alt for Media ' + mediaId + ': ' + eVerify.message);
              }
          }
          // === END NEW ===
          
      } else {
          log('Updater: Failed to update Media ' + mediaId + ': ' + resp.getContentText());
      }
  } catch (e) {
      log('Updater: Error updating Media ' + mediaId + ': ' + e.message);
  }
}
```

2. **أضف logging للـ payload الفعلي** اللي بيتبعت:
```javascript
// بعد بناء الـ payload وقبل الإرسال
log('Updater: Media ' + mediaId + ' update payload: ' + JSON.stringify(payload));
```

3. **طبّق نفس التعديل** في `updater.gs`.

---

## المشكلة 3: الصور المترجمة لا يُعاد تحديث metadata لها عند إعادة التشغيل

### الموقع
`updater.js` — دالة `localizeTripImagesMetadataForLang_Updater_` — حوالي سطر 5183-5189

### المشكلة
```javascript
var detectSample = [current.alt, current.title, current.caption, current.description].join(' ').trim();
var detected = detectLanguageSafe_Updater_(detectSample);
var keywordMissing = false;
if (keywordToUse) {
    keywordMissing = current.alt.toLowerCase().indexOf(String(keywordToUse).toLowerCase()) === -1;
}
if (detected && langMatchesOrBase_Updater_(detected, lang) && !keywordMissing) continue;
```

المشكلة: لو الـ metadata بالصيني خلاص (من تشغيل سابق) لكن الـ **alt فاضي فعلياً على WordPress** (بسبب المشكلة 2)، الكود بيكتشف إن title/caption/description بالصيني فـ `detected = zh` ثم بيعمل `keywordMissing` check على الـ alt الفاضي... لكن لأن الـ `keywordToUse` ممكن يكون فاضي أيضاً، `keywordMissing = false` وبالتالي بيعمل **skip** والـ alt يفضل فاضي.

### الحل المطلوب

1. **أضف check إضافي**: لو أي حقل من الـ 4 (خصوصاً alt) فاضي، لا تعمل skip:
```javascript
// قبل سطر الـ continue
var hasEmptyFields = !current.alt || !current.title || !current.caption || !current.description;
if (hasEmptyFields) {
    log('IMAGE METADATA INCOMPLETE (' + lang + '): ' + targetId + ' — will re-translate (alt: ' + (current.alt ? 'OK' : 'EMPTY') + ', title: ' + (current.title ? 'OK' : 'EMPTY') + ')');
    // لا تعمل continue — كمّل الترجمة
} else if (detected && langMatchesOrBase_Updater_(detected, lang) && !keywordMissing) {
    continue;
}
```

2. **طبّق نفس التعديل** في `updater.gs` في الدالة المقابلة.

---

## ملخص التعديلات

| # | الملف | الدالة | نوع التعديل |
|---|-------|--------|-------------|
| 1 | updater.js + updater.gs | `publishImagesSafe_Updater_` | إضافة fallback لـ Type فاضي + logging |
| 2 | updater.js + updater.gs | `updateMediaOnWordPress_Updater_` | إضافة verification + retry للـ alt_text + logging للـ payload |
| 3 | updater.js + updater.gs | `localizeTripImagesMetadataForLang_Updater_` | إضافة check للـ empty fields قبل الـ skip |

## القيود
- لا تغيّر أي منطق آخر في الملفات
- لا تحذف أي logging موجود
- حافظ على نفس أسلوب الكود (var بدل const/let في updater.gs)
- التعديلات لازم تكون متطابقة في updater.js و updater.gs
- بعد التعديل، أخبرني بأرقام الأسطر اللي اتعدّلت في كل ملف
