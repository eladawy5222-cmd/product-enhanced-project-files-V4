# توثيق مشروع FTS Travel Automation

## نظرة عامة
هذا المشروع يهدف إلى أتمتة عملية إدارة ونشر الرحلات السياحية بين Airtable و WordPress (باستخدام إضافة WP Travel Engine). النظام يستخدم Google Apps Script كواجهة خلفية للمعالجة والربط، ويدعم تعدد اللغات (WPML) وتحسين المحتوى باستخدام الذكاء الاصطناعي.

---

## الهيكل العام للمشروع

ينقسم المشروع إلى جزئين رئيسيين:
1.  **Google Apps Script (GAS):** المسؤول عن سحب البيانات، معالجتها، تحسينها بالـ AI، وإرسالها إلى WordPress.
2.  **WordPress Plugin (PHP):** واجهة API مخصصة لاستقبال البيانات وتخزينها في قاعدة بيانات WordPress.

---

## 1. Google Apps Script (GAS)
الملفات الموجودة في مجلد المشروع (`d:\gas 2\`) وتصنيفها حسب الوظيفة:

### أ. إدارة النشر والتحديث (Core Logic)
*   **`updater.gs`**: (الملف الأهم) المسؤول عن إرسال بيانات الرحلات من Airtable إلى WordPress.
    *   يدعم تعدد اللغات (إنشاء الرحلة الإنجليزية أولاً ثم الترجمات).
    *   يقوم بتصنيف الأنشطة والرحلات باستخدام AI.
    *   يربط الترجمات ببعضها البعض.
    *   يدعم صور متعددة اللغات فعلياً عبر إنشاء attachments مستقلة لكل لغة مع Cache في `Image_Translation_Map`.
*   **`publisher.gs`**: يبدو أنه النسخة القديمة أو المخصصة للنشر الأولي (يجب التأكد من استخدامه أو الاعتماد على `updater.gs`).
*   **`sync_runner.gs`**: المسؤول عن تشغيل عمليات المزامنة الدورية.
*   **`enhancement_orchestrator.gs`**: مدير تسلسل مراحل التحسين (Pipeline) لضمان تشغيل AI Enhancers بالترتيب الصحيح.

### ب. تحسين المحتوى بالذكاء الاصطناعي (AI Enhancers)
تقوم هذه الملفات بقراءة بيانات الرحلة واستخدام LLM (مثل OpenAI/DeepSeek) لتحسينها:
*   **`ai_enhancer.gs`**: المحرك الرئيسي للتحسين.
*   **`ai_itinerary_enhancer.gs`**: تحسين وصف وخطوات خط سير الرحلة (Itinerary).
*   **`ai_seo_enhancer.gs`**: تحسين عناوين SEO والكلمات المفتاحية (RankMath).
*   **`ai_highlights.gs`**: استخراج وتحسين أبرز معالم الرحلة.
*   **`ai_faqs_enhancer.gs`**: توليد أسئلة شائعة (FAQ) بناءً على محتوى الرحلة.
*   **`ai_includes_excludes.gs`**: تحسين قوائم "ما يشمل" و "ما لا يشمل".
*   **`ai_trip_facts.gs`**: استخراج حقائق الرحلة (المدة، النوع، إلخ).
*   **`ai_addons_enhancer.gs`**: تحسين وصف الخدمات الإضافية.
*   **`ai_images_enhancer.gs`**: معالجة وتحسين بيانات الصور.

### ج. الأدوات المساعدة (Utilities)
*   **`utils_airtable.gs`**: دوال التعامل مع Airtable API (قراءة، كتابة، بحث).
*   **`utils_http.gs`**: دوال التعامل مع طلبات HTTP الخارجية.
*   **`config.gs`**: ملف الإعدادات (API Keys، الروابط، الثوابت).
*   **`mapper.gs`**: دوال تحويل البيانات من تنسيق Airtable إلى تنسيق WordPress.
*   **`state.gs`**: إدارة حالة التنفيذ (لتجنب التكرار أو التوقف).

### د. الهجرة والنقل (Migration)
*   **`migration_runner.gs`**: سكربت تشغيل عملية نقل البيانات القديمة.
*   **`migration_mapper.gs`**: خرائط تحويل البيانات القديمة للجديدة.
*   **`migration_config.gs`**: إعدادات خاصة بالهجرة.

---

## 2. WordPress Plugin (PHP)
*   **`fts-trip-api-update.php`**: ملف الإضافة المخصص (Custom Plugin).
    *   يضيف نقاط نهاية REST API جديدة: `POST /fts/v1/trip/{id}` و `POST /fts/v1/trips`.
    *   يضيف: `POST /fts/v1/media/clone` لعمل clone للـ attachments (للصور متعددة اللغات) بدون رفع ملف جديد.
    *   يضيف endpoints تشخيص: `GET /fts/v1/media/ping` و `GET /fts/v1/debug/routes`.
    *   يعالج تخزين البيانات في جداول `wp_posts` و `wp_postmeta`.
    *   يدعم **WP Travel Engine** (جداول الرحلات، الأسعار، الحجوزات).
    *   يدعم **RankMath** (بيانات SEO).
    *   يدعم **WPML** (ربط الترجمات وتحديد اللغة).
    *   **ميزة جديدة:** التوليد التلقائي لترجمة الرحلة (Auto-Translate Stub) في حال عدم وجودها عند الطلب.

---

## 3. تدفق البيانات (Data Flow)

1.  **Airtable**: يتم إدخال أو استيراد بيانات الرحلة الخام.
2.  **GAS (AI Enhancers)**: تعمل سكربتات التحسين لتوليد وصف جذاب، SEO، وخط سير رحلة مفصل، وتخزينها في جداول "Improvement".
3.  **GAS (Updater)**:
    *   يقرأ البيانات المحسنة.
    *   يحدد اللغات المطلوبة.
    *   يرسل الرحلة "الأساسية" (الإنجليزية) إلى WordPress عبر API.
    *   يرسل الرحلات "المترجمة" (الفرنسية، الروسية، إلخ) ويربطها بالرحلة الأساسية.
    *   يقوم بتحديث خريطة الترجمات (`language.translations`) في النهاية لضمان الربط الثنائي.
4.  **WordPress**: يستقبل البيانات، ينشئ/يحدث الرحلات، ويظهرها في الموقع مع دعم تعدد اللغات.

---

## 4. كيفية الاستخدام والنشر

### لتشغيل التحديث (Publish/Update):
1.  تأكد من أن حالة الرحلة في Airtable هي `Pending` في حقل `Publish_Status`.
2.  شغل دالة `runUpdaterBatch()` في ملف `updater.gs`.
3.  تابع الـ Logs في Apps Script للتأكد من نجاح العملية.

### لإضافة لغة جديدة:
1.  أضف اللغة في حقل `Languages` داخل Airtable (يمكن كتابة الاسم أو الـ alias).
2.  يدعم `updater.gs` resolver للغات مع aliases (مثل: `Français` أو `简体中文`) ويحوّلها لأكواد WPML (مثل `fr` و `zh-hans`).
3.  إذا كانت قيمة اللغة غير معروفة سيظهر log: `UNKNOWN LANGUAGE IN AIRTABLE: ...` وسيتم تجاهلها بدون توقف السكربت.

---

## 5. ملاحظات هامة للتطوير
*   **API Keys**: تأكد من سلامة مفاتيح API (OpenAI, Airtable, WordPress Application Password) في `config.gs`.
*   **Permalinks**: الروابط تعتمد على إعدادات WordPress/WPML. تأكد من إعداد WPML ليضيف كود اللغة في الرابط (مثلاً `/fr/tour/...`).
*   **Auto-Translate**: دالة `fts_auto_translate_trip` في PHP حالياً تقوم بنسخ المحتوى فقط. يجب ربطها بـ Translation API فعلي لترجمة المحتوى تلقائياً عند الطلب.
