# TREA Prompt: توسيع دالة localizePackageLabel_ لتشمل كل اللغات المدعومة

## المشكلة
دالة `localizePackageLabel_` في كلا الملفين (updater.gs سطر 3554 و updater.js سطر 3871) حالياً بتترجم labels الـ pricing categories (Adult, Child, Children, Infant, Passengers, Student (with ID)) **للألمانية فقط**. أي لغة تانية بترجع الـ label الإنجليزي كما هو — وده بيظهر في صفحة الحجز (booking form) كنص إنجليزي وسط صفحة مترجمة بالكامل (مثلاً "Child" ظاهرة بالإنجليزي في صفحة صينية).

كمان كلمة "Standard Package" في سطر 3650 (gs) و 3967 (js) بتمر على نفس الدالة بس مش مترجمة لغير الألمانية.

## المطلوب
وسّع دالة `localizePackageLabel_` عشان تدعم **كل الـ 16 لغة غير الإنجليزية** الموجودة في المشروع:

| Code | Language |
|------|----------|
| fr | French |
| de | German (موجود بالفعل) |
| es | Spanish |
| tr | Turkish |
| ru | Russian |
| ro | Romanian |
| zh-hans | Chinese (Simplified) |
| uk | Ukrainian |
| pt-br | Portuguese (Brazilian) |
| pl | Polish |
| nl | Dutch |
| ko | Korean |
| ja | Japanese |
| it | Italian |
| hu | Hungarian |
| cs | Czech |

## الكلمات المطلوب ترجمتها لكل لغة:
1. **Adult** (بالغ)
2. **Child** (طفل)
3. **Children** (أطفال)
4. **Infant** (رضيع)
5. **Passengers** (ركاب)
6. **Student (with ID)** (طالب مع هوية)
7. **Standard Package** (الباقة الأساسية)
8. **traveler** (مسافر) — لو موجودة في أي مكان
9. **travelers** (مسافرون)

## التنفيذ المطلوب

### الطريقة: بناء object واحد فيه كل اللغات بدل if/else لكل لغة

```javascript
function localizePackageLabel_(label, lang) {
  var l = String(label || '').trim();
  var c = String(lang || '').toLowerCase();
  if (!l || !c || c === 'en') return l;
  
  var translations = {
    'fr': {
      'Adult': 'Adulte',
      'Child': 'Enfant',
      'Children': 'Enfants',
      'Infant': 'Bébé',
      'Passengers': 'Passagers',
      'Student (with ID)': 'Étudiant (avec carte)',
      'Standard Package': 'Forfait Standard',
      'traveler': 'voyageur',
      'travelers': 'voyageurs'
    },
    'de': {
      'Adult': 'Erwachsene',
      'Child': 'Kinder',
      'Children': 'Kinder',
      'Infant': 'Kleinkind',
      'Passengers': 'Passagiere',
      'Student (with ID)': 'Student (mit Ausweis)',
      'Standard Package': 'Standardpaket',
      'traveler': 'Reisender',
      'travelers': 'Reisende'
    },
    'es': { ... },
    'tr': { ... },
    'ru': { ... },
    'ro': { ... },
    'zh-hans': { ... },
    'uk': { ... },
    'pt-br': { ... },
    'pl': { ... },
    'nl': { ... },
    'ko': { ... },
    'ja': { ... },
    'it': { ... },
    'hu': { ... },
    'cs': { ... }
  };
  
  var langMap = translations[c];
  if (langMap && langMap[l]) return langMap[l];
  return l;
}
```

## ملاحظات مهمة:
1. **التعديل لازم يتطبق على الملفين**: updater.gs (سطر 3554) و updater.js (سطر 3871) — نفس المنطق بالظبط
2. **الترجمات لازم تكون دقيقة ومناسبة لسياق السياحة والحجز** (مش ترجمة عامة)
3. **لغة zh-hans**: استخدم الصينية المبسطة
4. **لغة pt-br**: استخدم البرتغالية البرازيلية
5. **باقي الكود ما يتغيرش** — فقط استبدال دالة localizePackageLabel_ بالنسخة الجديدة
6. **CATEGORY_ID_MAP يفضل زي ما هو** — مش محتاج تعديل
