FTS Trip Design V2 Hybrid Patch for Trea

Use this as the full implementation brief. Do not summarize it. Execute it exactly.

```text
Task: Create a new hybrid trip design folder that keeps the strongest conversion patterns from `trip-design-v2 live`, imports the data-truth improvements from `trip-design-v2 test`, and pushes the page closer to the decision quality and information density of Viator / GetYourGuide trip pages without inventing any facts.

Repository context:
- Base repo structure already exists.
- Do not modify the existing folders:
  - `trip-design-v2/trip-design-v2 live`
  - `trip-design-v2/trip-design-v2 test`
- Create a brand new folder:
  - `trip-design-v2/trip-design-v2 hybrid`

Core priorities in this exact order:
1. Data accuracy
2. Do not break the pipeline
3. SEO
4. Conversion

Important constraints:
- Do not invent operational facts such as free cancellation, pickup, lunch, tickets, limited spots, viewers now, booked X minutes ago, countdown timers, best price guarantee, reserve now pay later, or similar claims unless they already come from real data already available in the page pipeline.
- Keep the page commercially strong, but every visible claim must be data-backed or technically true.
- Keep changes minimal and patch-driven.
- Use `trip-design-v2 live` as the implementation base, not `test`.
- The new folder must keep the same internal file naming pattern as the live folder:
  - `layout-controller.php`
  - `assets/header-bar.js`
  - `assets/script-v2.js`
  - `assets/css/*.css`
  - `parts/*.php`
- Do not use the nested `parts/parts` or `assets/assets` structure from `test`. The new `hybrid` folder should be clean and stable like `live`.

Implementation strategy:
- Copy the full `trip-design-v2 live` folder into `trip-design-v2/trip-design-v2 hybrid`.
- Then selectively port only the needed logic and UI behavior from `test` into `hybrid`.
- Do not blindly copy `test` over `live`.

Files to create inside the new folder:
- `trip-design-v2/trip-design-v2 hybrid/layout-controller.php`
- `trip-design-v2/trip-design-v2 hybrid/assets/header-bar.js`
- `trip-design-v2/trip-design-v2 hybrid/assets/script-v2.js`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/base.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/booking-modal.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/content.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/faq.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/gallery.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/header.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/layout.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/packages.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/quick-info.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/related.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/responsive.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/reviews.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/sidebar.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/theme-overrides.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/trip-header-bar.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/variables.css`
- `trip-design-v2/trip-design-v2 hybrid/parts/booking-modal-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/footer-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/gallery-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/header-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/quick-info-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/sidebar-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/tabs-accordion-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/trip-header-bar-v2.php`

Required behavioral goals:

1. Make the page more globally competitive without fake persuasion
- The page should feel closer to Viator / GYG in clarity, scannability, and decision support.
- That means:
  - strong above-the-fold title + imagery + rating + price + CTA
  - clear package comparison
  - strong review visibility
  - strong itinerary clarity
  - faster decision-making layout
- It does NOT mean copying fake urgency patterns.

2. Keep the conversion strength from `live`
- Keep:
  - sticky booking sidebar on desktop
  - mobile sticky booking bar
  - prominent price treatment
  - strong package cards
  - booking modal flow
  - WhatsApp CTA if configured
- Improve them only where needed.

3. Port the data-truth improvements from `test`
- In `layout-controller.php`, port the trip facts builder logic from `test`:
  - `normalize_fact_text`
  - `normalize_glance_value`
  - `normalize_at_a_glance`
  - `extract_items_from_html_or_text`
  - `build_trip_facts`
  - `build_trip_fact_items`
  - `build_booking_modal_subtitle`
- Build these fields from real data only:
  - `duration`
  - `meeting_point`
  - `group_size`
  - `includes`
  - `excludes`
- Pass these through trip data for rendering.

4. Keep the better currency handling from `live`
- Do NOT replace the `live` currency symbol logic with the manual symbol map from `test`.
- Keep the `live` helper that uses `wp_travel_engine_get_currency_symbol()` when available.

5. In `parts/quick-info-v2.php`
- Remove fake social proof and fake trend widgets from `live`:
  - viewers now
  - last booked X minutes ago
  - trending in X
- Replace that band with real, compact `at a glance` items built from `trip_fact_items`.
- Keep the quick price + CTA area strong.
- Keep the rating / review trust bar only when rating data exists.
- Do not show trust items that are not data-backed.

6. In `parts/sidebar-v2.php`
- Remove fake urgency bar and fake countdown bar from `live`.
- Replace the trust list with real factual summary items using:
  - duration
  - meeting point
  - group size
- Keep:
  - rating if real
  - price
  - save badge if computed from real prices
  - date selector
  - traveler selector
  - strong check availability CTA
  - payment icons
- Do not claim:
  - best price guaranteed
  - free cancellation
  - reserve now pay later
  unless real data for those claims exists in the current data source and can be rendered safely.

7. In `parts/booking-modal-v2.php`
- Replace the hardcoded modal subtitle with the real `booking_modal_subtitle` built from trip facts.
- Replace fake trust/urgency items with:
  - duration if available
  - meeting point if available
  - group size if available
  - secure payment
- Remove fake:
  - free cancellation
  - spots left
  - current viewers
- Keep the booking flow itself intact.

8. In `parts/tabs-accordion-v2.php`
- Keep the package comparison section visible and strong.
- Use the cleaner `test` package rendering approach where it improves markup hygiene and data safety.
- Keep package cards comparison-oriented.
- Subtitle should be generic and truthful, for example:
  - compare package options and pick the one that fits your trip best
- Do not mention inclusions like lunch / guide / transfers in the subtitle unless the packages actually prove that.
- Keep review visibility stronger than `test`:
  - do NOT fully remove the review summary cards if the live version is already built from real review data
  - keep the review summary block from `live` if it is data-backed
  - also keep the reviews tab content/embed block
- Keep CTA messaging persuasive but factual.

9. In `assets/script-v2.js`
- Remove all fake-randomized persuasion logic:
  - viewer counters
  - last booked randomizer
  - sidebar spots-left randomizer
  - modal spots/viewers randomizer
  - countdown timer
- Keep:
  - sticky navigation
  - lightbox
  - accordions
  - booking modal flow
  - mobile sticky CTA bar
- In the mobile sticky CTA bar:
  - keep price + CTA
  - remove free cancellation text unless real data exists

10. CSS direction for the new hybrid version
- Use the visual improvements from `test` selectively where they improve scanability and premium feel:
  - stronger title hierarchy
  - cleaner quick facts presentation
  - stronger booking sidebar card
  - more mature package cards
  - cleaner spacing between sections
- But do NOT weaken reviews visibility.
- Recommended merge behavior:
  - `content.css`: port the stronger hero spacing and section spacing from `test`
  - `quick-info.css`: port the real `at-a-glance` layout, but do not remove rating trust styling
  - `sidebar.css`: port the improved card, CTA, and factual trust layout
  - `packages.css`: port the cleaner package card layout from `test`
  - `responsive.css`: port only the responsive rules needed for the new factual quick-info/sidebar/package layout; preserve mobile usability
  - `reviews.css`: keep the live review summary card styles and only adjust spacing if needed
- The page should feel premium and conversion-focused, not plain.

11. Keep path stability
- In `trip-design-v2 hybrid/layout-controller.php`, all paths must point to the new hybrid folder itself, using the clean structure:
  - `/trip-design-v2/trip-design-v2 hybrid/parts/`
  - `/trip-design-v2/trip-design-v2 hybrid/assets/`
- Do not introduce broken nested paths.

12. SEO / competition goal
- Build the page so it competes more directly with Viator / GetYourGuide trip pages on:
  - clear information hierarchy
  - fast package comparison
  - visible review proof
  - high decision confidence
  - stronger factual summary above the fold
- Do not imitate their branding.
- The page should look like a serious international booking page, not a blog post or a local theme page.

Required acceptance criteria:

A. Folder creation
- A new folder exists:
  - `trip-design-v2/trip-design-v2 hybrid`
- Existing `live` and `test` folders remain untouched.

B. Pipeline safety
- The hybrid layout loads its own files from its own folder correctly.
- No broken include path.
- No broken asset path.

C. Data accuracy
- No fake viewers, fake bookings, fake countdowns, fake urgency claims.
- No free cancellation text unless current real data supports it.
- No package benefit text invented beyond actual package data.

D. Conversion quality
- Price and CTA remain highly visible on desktop and mobile.
- Package comparison remains clear and stronger than the current live version.
- Review proof remains visible and not downgraded vs live when real review data exists.

E. Competitive UX
- Above-the-fold experience is cleaner, faster, and more decision-oriented.
- User can understand:
  - what the trip is
  - what it costs
  - how it is rated
  - what package options exist
  - what the main factual trip details are
  within the first screen and immediate scroll.

F. Technical verification
- Run a diff summary of the new hybrid folder against live and list modified files.
- Confirm which files were copied unchanged and which files were changed.
- Confirm there are no references to:
  - fake viewer counts
  - fake spots left
  - fake countdown
- Confirm there are no `parts/parts` or `assets/assets` references in the hybrid files.

Files that should almost certainly be modified in the hybrid version:
- `trip-design-v2/trip-design-v2 hybrid/layout-controller.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/quick-info-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/sidebar-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/booking-modal-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/parts/tabs-accordion-v2.php`
- `trip-design-v2/trip-design-v2 hybrid/assets/script-v2.js`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/content.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/quick-info.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/sidebar.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/packages.css`
- `trip-design-v2/trip-design-v2 hybrid/assets/css/responsive.css`
- maybe spacing-only adjustments in `reviews.css` if needed, but preserve review proof strength

Files likely to remain copied unchanged from live unless needed:
- `assets/header-bar.js`
- `parts/footer-v2.php`
- `parts/gallery-v2.php`
- `parts/header-v2.php`
- `parts/trip-header-bar-v2.php`
- most base/shared CSS files unless hybrid styling requires adjustment

Final output required from you:
1. The new `trip-design-v2/trip-design-v2 hybrid` folder fully created.
2. A short implementation summary.
3. A list of changed files.
4. A short verification summary against the acceptance criteria above.
```
