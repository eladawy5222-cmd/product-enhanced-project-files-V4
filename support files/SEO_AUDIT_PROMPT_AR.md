# SEO Audit Prompt — Travel & Tours (Arabic)
أنت خبير SEO متقدم متخصص في مواقع السياحة والجولات (Travel & Tours SEO) وتفهم SEO التقني وRankMath وSchema وWPML.
أريد منك إعداد تقرير SEO شامل للصفحة التالية:
[ضع الرابط هنا]

قواعد الإخراج (مهم جدًا):
- اكتب التقرير باللغة العربية وبأسلوب مهني.
- اعرض النتائج في أقسام واضحة مع تقييمات رقمية لكل قسم (0–100) + أولوية التنفيذ: (حرجة / عالية / متوسطة / منخفضة).
- لا تعطِ توصيات عامة؛ كل توصية لازم تكون قابلة للتنفيذ ومرتبطة بملاحظة محددة.
- عندما تذكر عنصرًا (Title / Meta / H1 / Canonical / Schema / Links / Images)، قدّم:
  - الوضع الحالي (ماذا يبدو أنه موجود)
  - لماذا هذا مهم
  - التوصية
  - معيار النجاح (Acceptance Criteria) مثل: طول/تنسيق/عدم قطع جملة/وجود Alt… إلخ.

1) On‑Page SEO (تحليل العناصر الداخلية)
1.1 Title Tag (العنوان)
- قيّم:
  - طول العنوان بالأحرف (هدف: 50–60)
  - وجود الكلمة المفتاحية الأساسية + 1–2 USP (مثل: Lunch / Hotel Pickup / Free Cancellation / Price)
  - صيغة CTR (مثل: “+ Lunch”, “Free Cancellation”, “From $…”, “Private/Small Group”)
- افحص الاتساق: هل Title متوافق مع H1 والـSlug والكيان المستهدف (مثال: Egyptian Civilization Museum/NMEC vs Egyptian Museum)؟
- أعطِ 3 بدائل Title جاهزة ضمن 60 حرف (بدون قطع كلمات).

1.2 Meta Description (الوصف)
- قيّم:
  - الطول (هدف: 150–155)
  - هل ينتهي بجملة كاملة؟ ممنوع ينتهي بكلمة معلّقة مثل “with”.
  - هل يحتوي CTA واضح (Book / Reserve / Check availability) بدون مبالغة
- أعطِ 3 بدائل Meta جاهزة ضمن 155 حرف، وتأكد أنها لا تُقطع وتنتهي بنقطة.

1.3 Heading Structure (H1/H2/H3)
- تحقّق:
  - وجود H1 واحد فقط
  - عدد تقريبي لـH2/H3 وهل الهرمية منطقية
  - هل H1 يعكس الكلمة المفتاحية الأساسية ويطابق نية الصفحة (Booking/Commercial)
- تحقّق من تضارب الرسائل بين H1 وTitle والـSlug.

1.4 Keyword Targeting & Intent
- حدّد:
  - الكلمة المفتاحية الأساسية (Primary)
  - 5–10 كلمات داعمة (LSI/Entities) مثل: Citadel, Old Cairo, NMEC, Royal Mummies Hall, Khan El‑Khalili…
- افحص توزيعها الطبيعي بدون حشو.
- قيّم: هل المحتوى يغطي نية الباحث (تجارية/شرائية + معلوماتية داعمة)؟

1.5 Internal & External Links
- أعطني:
  - تقدير عدد الروابط الداخلية والخارجية إن أمكن
  - أهم 5 روابط داخلية سياقية يجب إضافتها داخل النص (Destination Cairo / Related tours / Blog guides)
- افحص مشكلة Empty Anchors: روابط بلا نص/ARIA label (مثال: أيقونات/أزرار/صور).
  - قدّم توصيات لإصلاحها (إضافة نص وصفي/aria-label أو حذف الرابط).
- افحص الروابط الخارجية: هل من الأفضل إضافة رابط رسمي (متحف/موقع حكومي)؟ ومتى نستخدم nofollow؟

1.6 Image SEO
- أعطني:
  - عدد الصور التقريبي
  - نسبة الصور التي لديها Alt (Coverage %)
  - عدد الصور/الأيقونات التي تفتقد Alt أو لها Alt غير وصفي
- توصيات عملية:
  - قواعد صياغة Alt Text (Entity + سياق + بدون حشو)
  - تفعيل/تحسين Lazy Loading للصور تحت الـFold
  - ضغط الصور وWebP وأحجام مناسبة للعرض

2) Technical SEO & Core Web Vitals
2.1 Speed / CWV (LCP/INP/CLS)
- حدّد العوائق المحتملة في صفحات الجولات:
  - صور Hero كبيرة غير محسنة
  - Sliders/Lightbox
  - JS من الحجز/العملة/اللغات
  - CSS/JS غير مستخدم من إضافات متعددة
- قدّم Quick Wins تقنية:
  - Preload للـHero (لو مناسب)
  - تقليل JS
  - Lazy load + sizes/srcset
  - منع CLS (تحديد أبعاد الصور/الحاويات)

2.2 Mobile Friendliness
- قيّم تجربة الجوال:
  - CTA واضح؟ السعر ظاهر؟
  - Tabs/Accordion/FAQ سهلة؟
  - ازدحام أعلى الصفحة؟ تأثيره على التحويل؟

2.3 Crawlability & Indexability
- افحص (كمبدأ):
  - robots.txt/sitemap
  - canonical
  - noindex
  - pagination/parameters إن وجدت
- اذكر أي مخاطر Duplicate Content (خصوصًا مع تعدد اللغات).

3) Schema Markup & International SEO
3.1 Structured Data
- تحقّق من وجود/ملاءمة:
  - BreadcrumbList
  - FAQPage
  - TouristTrip أو Product/Offer (للأسعار/العروض)
- قيّم الجودة (حقول ناقصة؟ تناقضات؟)
- توصية متقدمة:
  - إضافة AggregateRating فقط إذا توجد تقييمات حقيقية موثقة (لا تفبرك).
  - ربط Offer بالعملة والسعر وتوفر الحجز إن ممكن.

3.2 Hreflang (تعدد اللغات)
- تحقّق من:
  - hreflang متبادل بين النسخ
  - وجود x-default
  - اتساق canonical
  - منع تكرار المحتوى عبر نسخ ضعيفة/غير مترجمة جيدًا

4) Content Quality & E‑E‑A‑T
- قيّم:
  - هل يوجد تفاصيل كافية (مدة، جدول، included/excluded، سياسة الإلغاء، وسائل نقل، نقاط الالتقاء، متطلبات اللبس)؟
  - إشارات الثقة: الشركة، التواصل، سياسات، مرشدين (Egyptologist) وكيف تُثبت ذلك
- اقترح تحسينات Conversion:
  - إضافة FAQ تستهدف أسئلة حجم بحث عالي (معلومة/قرار شراء)
  - إبراز Free cancellation/Payment/Instant confirmation

5) Action Plan (خطة تنفيذ)
في النهاية أعطني:
- Top 5 Quick Wins (مرتبة حسب التأثير)
- قائمة Bugs تقنية محتملة (مثل: Meta مقطوعة، Empty Anchors، Alt ناقص)
- Acceptance Criteria لكل عنصر (مثال: Meta 150–155 وتنتهي بجملة كاملة، Alt ≥ 90%…)
- نماذج جاهزة: 3 Titles + 3 Meta + صيغة H1 مقترحة متسقة مع Title/Slug والكيان المستهدف.
