# FTS Travels — WPTE ↔ Airtable ↔ AI Enhancement System

## نظرة عامة
نظام متكامل لإدارة رحلات سياحية يربط بين WordPress (WP Travel Engine plugin) و Airtable كقاعدة بيانات وسيطة، مع 9 مراحل تحسين AI تلقائية باستخدام DeepSeek API، ثم نشر المحتوى المحسّن رجوعاً لـ WordPress.

---

## البنية العامة (Architecture)

```
WordPress (WPTE) ←→ GAS Scripts ←→ Airtable ←→ AI (DeepSeek/OpenAI)
     ↑                                              ↓
     └──────── Publisher/Updater ←── Enhanced Data ──┘
```

### المكونات الثلاثة:
1. **PHP Plugin** (`fts-trip-api-update.php`) — REST API مخصص على WordPress
2. **Google Apps Script (GAS)** — 26 ملف سكربت للأتمتة
3. **Airtable** — قاعدة بيانات وسيطة (Base ID: `apphGHAvy5IhAWVw9`)

---

## الـ PHP Plugin (WordPress Side)

**الملف:** `fts-trip-api-update.php`

### الـ REST API Endpoints:
| Method | Endpoint | الوظيفة |
|--------|----------|---------|
| GET | `/fts/v1/trips` | قائمة الرحلات (paginated) |
| GET | `/fts/v1/trip/{id}` | رحلة واحدة بالتفصيل |
| POST | `/fts/v1/trips` | إنشاء رحلة جديدة |
| POST | `/fts/v1/trip/{id}` | تحديث رحلة موجودة |

### البيانات المرجعة لكل رحلة:
- `core`: (id, title, slug, permalink, status, content_html)
- `general`: (duration, cutoff, trip_code, raw data)
- `meta`: (wp_travel_engine_setting, rank_math, wte_advanced_itinerary)
- `seo`: (rank_math data)
- `pricing`: (actual_price, currency, packages with categories & group_pricing)
- `featured_image` & `gallery`: (صور مع metadata)
- `language`: (translations via WPML)

---

## الـ GAS Scripts — التصنيف

### 1. Core Infrastructure (البنية التحتية)
| الملف | الوظيفة |
|-------|---------|
| `config.gs` | إعدادات المشروع (API URLs, Base ID, Table Names, Link Fields, Sync Limits) |
| `state.gs` | إدارة حالة الاستيراد (page, index, todayCount) عبر ScriptProperties |
| `utils_http.gs` | HTTP helpers (GET/POST/PATCH/DELETE) مع retry و backoff |
| `utils_airtable.gs` | Airtable API wrapper (CRUD + batch operations + find/upsert) |

### 2. Import Pipeline (WordPress → Airtable)
| الملف | الوظيفة |
|-------|---------|
| `wp_fetch.gs` | جلب رحلة واحدة أو متعددة من WP API + sync |
| `sync_runner.gs` | الاستيراد التلقائي المتزايد (paginated, daily limit 60, batch 200) |
| `mapper.gs` | تحويل JSON من WP لحقول Airtable (Trips + 12 جدول فرعي) |
| `upsert.gs` | كتابة البيانات في Airtable (create/update + replace children) |

### 3. AI Enhancement Pipeline (9 مراحل)
| المرحلة | الملف | الجدول المستهدف | الوظيفة |
|---------|-------|----------------|---------|
| 1 | `ai_seo_enhancer.gs` | Improvement With AI | SEO Title, Meta Desc, Permalink, Keywords, Excerpt |
| 2 | `ai_enhancer.gs` | Improvement With AI | Content: Overview, Description, Itinerary Desc, Tab Content, Duration |
| 3 | `ai_addons_enhancer.gs` | AddOns Improvement With AI | تحسين Add-ons + 3 fixed items |
| 4 | `ai_highlights.gs` | Highlights Improvement With AI | 5-10 highlights محسّنة |
| 5 | `ai_itinerary_enhancer.gs` | Itinerary Improvement With AI | 5-30 خطوة itinerary محسّنة |
| 6 | `ai_includes_excludes.gs` | TripIncludes/Excludes Improvement With AI | 4-16 includes, 4-6 excludes |
| 7 | `ai_trip_facts.gs` | TripFacts Improvement With AI | 6 trip facts بالظبط |
| 8 | `ai_faqs_enhancer.gs` | FAQs Improvement With AI | 8-12 FAQ |
| 9 | `ai_images_enhancer.gs` | Images Improvement With AI | Image SEO (Title, Caption, Alt) via OpenAI |

### 4. Pipeline Orchestration (التنسيق)
| الملف | الوظيفة |
|-------|---------|
| `enhancement_orchestrator.gs` | ينقل المراحل بالترتيب: Waiting → Pending → Processing → Done |
| `enhancement_helpers.gs` | Status updates, ImprovementRepository, claimStage_ (lease-based locking) |
| `context_utils.gs` | buildUnifiedTripContext_ — يجمع كل بيانات الرحلة من كل الجداول |

### 5. Publishing Pipeline (Airtable → WordPress)
| الملف | الوظيفة |
|-------|---------|
| `publisher.gs` | ينشر رحلات جديدة (ALWAYS_CREATE_NEW_TRIP = true) مع preservation workflow |
| `updater.gs` | يحدّث رحلات موجودة (ALWAYS_CREATE_NEW_TRIP = false) |

### 6. Migration (Old Base → New Base)
| الملف | الوظيفة |
|-------|---------|
| `migration_config.gs` | إعدادات الهجرة (old base → new base, TripID format 99xxxxx) |
| `migration_mapper.gs` | تحويل حقول القاعدة القديمة للجديدة |
| `migration_runner.gs` | تنفيذ الهجرة |
| `migration_test.gs` | اختبار الهجرة |

---

## Airtable Schema

### Core Tables:
| الجدول | الوظيفة |
|--------|---------|
| **Trips** | الجدول الرئيسي — كل رحلة بكل الحقول + حالات الـ Pipeline |
| **Packages** | باكجات التسعير لكل رحلة |
| **Prices** | تفاصيل الأسعار (categories, group pricing) |
| **Images** | صور الرحلة (featured + gallery) |
| **PickupLocations** | أماكن التجمع |

### Child Content Tables:
| الجدول | الوظيفة |
|--------|---------|
| **TripHighlights** | نقاط القوة الأصلية |
| **ItinerarySteps** | خطوات الرحلة الأصلية |
| **TripFAQs** | أسئلة شائعة أصلية |
| **TripIncludes** | ما يشمله السعر |
| **TripExcludes** | ما لا يشمله |
| **AddOns** | إضافات مدفوعة |
| **TripDetails** | تفاصيل إضافية (نوع الرحلة, cutoff) |
| **TripFacts** | حقائق الرحلة |

### AI Improvement Tables:
| الجدول | الوظيفة |
|--------|---------|
| **Improvement With AI** | المحتوى الرئيسي المحسّن + SEO |
| **Highlights Improvement With AI** | هايلايتس محسّنة |
| **Itinerary Improvement With AI** | Itinerary محسّن |
| **FAQs Improvement With AI** | FAQs محسّنة |
| **TripIncludes Improvement With AI** | Includes محسّنة |
| **TripExcludes Improvement With AI** | Excludes محسّنة |
| **TripFacts Improvement With AI** | Trip Facts محسّنة |
| **AddOns Improvement With AI** | Add-ons محسّنة |
| **Images Improvement With AI** | Image metadata محسّن |

### Management Tables:
- **Suppliers**, **PublishingSchedule**, **ExternalSources**, **FieldMappings**, **AuditLog**, **AIContent**

---

## Pipeline Flow (دورة حياة الرحلة)

```
1. IMPORT: WordPress API → fetchTripsPage_() → mapTripToTripsRow_() → upsertTrip_()
     ↓
2. INITIALIZE: initializeEnhancementPipeline_() → all statuses = "Waiting"
     ↓
3. ORCHESTRATE: checkAndProgressPipeline() [every 5 min trigger]
     ↓
   Stage 1: SEO (Pending → Processing → Done)
     ↓
   Stage 2: Content Enhancement (Pending → Processing → Done)
     ↓
   Stage 3: AddOns → Stage 4: Highlights → Stage 5: Itinerary
     ↓
   Stage 6: Inc/Exc → Stage 7: Trip Facts → Stage 8: FAQs → Stage 9: Images
     ↓
4. COMPLETE: Pipeline_Status = "Completed", Publish_Status = "Waiting"
     ↓
5. PUBLISH: publisher.gs / updater.gs → WordPress API (POST)
```

### Status Flow per Stage:
```
Waiting → Pending → Processing → Done (or Error)
```

---

## AI Configuration

| Setting | Value |
|---------|-------|
| Provider | DeepSeek (primary), OpenAI (images only) |
| Model | deepseek-chat |
| Endpoint | https://api.deepseek.com/chat/completions |
| Temperature | 0.7 |
| API Keys | Script Properties: DEEPSEEK_API_KEY, OPENAI_API_KEY |
| Output | JSON only (parsed from AI response) |

---

## GAS Script Properties (المفاتيح المطلوبة)

| Property | الوظيفة |
|----------|---------|
| `WP_API_USER` | WordPress API username |
| `WP_API_PASS` | WordPress API password (Application Password) |
| `AIRTABLE_API_KEY` | Airtable Personal Access Token |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `OPENAI_API_KEY` | OpenAI API key (للصور فقط) |
| `PUBLISHER_WORKFLOW_ENABLED` | true/false — تشغيل/إيقاف النشر |
| `WORKER_ID` | معرف الـ worker (للـ lease-based locking) |
| `WP_IMPORT_STATE` | JSON state for import progress |
| `MIGRATION_LAST_TRIP_ID` | آخر TripID في الهجرة |

---

## Time-Driven Triggers

| Function | Interval | الوظيفة |
|----------|----------|---------|
| `runImportStepSafe` | كل 10 دقائق | استيراد رحلات من WP |
| `checkAndProgressPipeline` | كل 5 دقائق | تقدم الـ AI pipeline |
| `detectStuckProcesses` | كل 30 دقيقة | كشف العمليات المعلقة |
| `runAiSeoEnhancementBatch` | كل 15 دقيقة | Stage 1: SEO |
| `runAiEnhancementBatch` | كل 10-15 دقيقة | Stage 2: Content |
| `runAiAddOnsEnhancementBatch` | trigger | Stage 3: AddOns |
| `runAiHighlightsEnhancementBatch` | trigger | Stage 4: Highlights |
| `runAiItineraryBatch` | trigger | Stage 5: Itinerary |
| `runAiIncludesExcludesBatch` | trigger | Stage 6: Inc/Exc |
| `runAiTripFactsBatch` | trigger | Stage 7: Trip Facts |
| `runAiFaqsBatch` | trigger | Stage 8: FAQs |
| `runAiImagesEnhancementBatch` | trigger | Stage 9: Images |
| `runPublisherBatch` | trigger | نشر المحتوى |

---

## Key Design Patterns

1. **Lease-based Stage Locking**: `claimStage_()` يستخدم UUID + TTL لمنع التنفيذ المتزامن
2. **Dual Identifier System**: TripID (WordPress ID) + Record ID (Airtable rec_xxx)
3. **Replace-on-Import**: الجداول الفرعية تُحذف وتُعاد إنشاؤها عند كل sync
4. **Improvement Repository**: `ImprovementRepository.getOrCreateActive()` — singleton pattern لكل رحلة
5. **Unified Context Builder**: `buildUnifiedTripContext_()` يجمع كل بيانات الرحلة (raw + improved) لتغذية الـ AI
6. **Batch Safety**: كل stage تعالج رحلة واحدة فقط (batch size = 1)

---

## WordPress (WP_API)
- **Domain**: ftstravels.com
- **Base URL**: `https://ftstravels.com/wp-json/fts/v1/trips`
- **Single Trip**: `https://ftstravels.com/wp-json/fts/v1/trip/{id}`
- **Auth**: Basic Auth (Application Password)
- **Plugin**: WP Travel Engine + custom FTS Trip API plugin
- **Translations**: WPML
