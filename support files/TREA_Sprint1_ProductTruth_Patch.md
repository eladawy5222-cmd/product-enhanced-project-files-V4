# TREA Patch: FTS Trip Template Sprint 1 — Product Truth + Facts Layer

Repo: `eladawy5222-cmd/product-enhanced-project-files-V4`
Branch recommendation: `sprint-1-product-truth-facts-layer`

## Goal
Remove hardcoded commercial/social-proof claims from the trip template and make all visible product facts data-driven. If a fact is not present in trip data, hide it instead of inventing it.

## Files to edit
1. `trip-design-v2/layout-controller.php`
2. `trip-design-v2/parts/parts/quick-info-v2.php`
3. `trip-design-v2/parts/parts/sidebar-v2.php`
4. `trip-design-v2/parts/parts/booking-modal-v2.php`
5. Optional follow-up check: `trip-design-v2/parts/parts/tabs-accordion-v2.php`
6. Optional follow-up check: `trip-design-v2/assets/assets/script-v2.js`

---

## 1) `layout-controller.php` — add a centralized facts builder

### Insert this private helper inside `class FTS_Trip_Redesign_V2`, before `get_trip_data()`:

```php
private static function build_trip_facts( $settings, $at_a_glance, $duration_text, $group_text, $cost_includes, $cost_excludes, $location ) {
    $facts = array(
        'items'               => array(),
        'by_key'              => array(),
        'trust_items'         => array(),
        'modal_subtitle'      => '',
        'cancellation_policy' => '',
        'payment_terms'       => '',
        'pickup'              => '',
        'languages'           => '',
    );

    $add_fact = function( $key, $label, $value, $icon = '' ) use ( &$facts ) {
        $value = trim( wp_strip_all_tags( (string) $value ) );
        if ( $value === '' ) return;
        $item = array(
            'key'   => sanitize_key( $key ),
            'label' => (string) $label,
            'value' => $value,
            'icon'  => (string) $icon,
        );
        $facts['items'][] = $item;
        $facts['by_key'][ $item['key'] ] = $item;
    };

    $get_ag = function( $keys ) use ( $at_a_glance ) {
        if ( ! is_array( $at_a_glance ) ) return '';
        foreach ( (array) $keys as $key ) {
            if ( isset( $at_a_glance[ $key ] ) && trim( (string) $at_a_glance[ $key ] ) !== '' ) {
                return trim( (string) $at_a_glance[ $key ] );
            }
        }
        return '';
    };

    $duration = $get_ag( array( 'duration' ) );
    if ( $duration === '' ) $duration = $duration_text;
    $add_fact( 'duration', __( 'Duration', 'fts' ), $duration, 'clock' );

    $pickup = $get_ag( array( 'pickup', 'hotel_pickup', 'meeting_point', 'departure_point' ) );
    $facts['pickup'] = $pickup;
    $add_fact( 'pickup', __( 'Pickup / Meeting point', 'fts' ), $pickup, 'pin' );

    $group = $get_ag( array( 'group_size', 'group' ) );
    if ( $group === '' ) $group = $group_text;
    $add_fact( 'group_size', __( 'Group size', 'fts' ), $group, 'users' );

    $languages = $get_ag( array( 'languages', 'language', 'guide_language' ) );
    $facts['languages'] = $languages;
    $add_fact( 'languages', __( 'Languages', 'fts' ), $languages, 'language' );

    $includes = $get_ag( array( 'includes', 'included' ) );
    if ( $includes === '' && trim( wp_strip_all_tags( (string) $cost_includes ) ) !== '' ) {
        $includes = wp_trim_words( wp_strip_all_tags( $cost_includes ), 14, '...' );
    }
    $add_fact( 'includes', __( 'Includes', 'fts' ), $includes, 'check' );

    $excludes = $get_ag( array( 'excludes', 'excluded' ) );
    if ( $excludes === '' && trim( wp_strip_all_tags( (string) $cost_excludes ) ) !== '' ) {
        $excludes = wp_trim_words( wp_strip_all_tags( $cost_excludes ), 14, '...' );
    }
    $add_fact( 'excludes', __( 'Excludes', 'fts' ), $excludes, 'x' );

    $cancellation = $get_ag( array( 'cancellation', 'cancellation_policy', 'free_cancellation' ) );
    $facts['cancellation_policy'] = $cancellation;
    if ( $cancellation !== '' ) {
        $add_fact( 'cancellation', __( 'Cancellation', 'fts' ), $cancellation, 'shield' );
        $facts['trust_items'][] = array(
            'key'   => 'cancellation',
            'label' => $cancellation,
            'icon'  => 'check',
        );
    }

    $payment_terms = $get_ag( array( 'payment', 'payment_terms', 'pay_later', 'reserve_now_pay_later' ) );
    $facts['payment_terms'] = $payment_terms;
    if ( $payment_terms !== '' ) {
        $facts['trust_items'][] = array(
            'key'   => 'payment_terms',
            'label' => $payment_terms,
            'icon'  => 'shield',
        );
    }

    $subtitle_parts = array();
    if ( $location !== '' ) $subtitle_parts[] = $location;
    if ( $duration !== '' ) $subtitle_parts[] = $duration;
    if ( $pickup !== '' ) $subtitle_parts[] = $pickup;
    $facts['modal_subtitle'] = implode( ' • ', array_slice( $subtitle_parts, 0, 3 ) );

    return $facts;
}
```

### Then, inside `get_trip_data()`, after `$cost_includes` and `$cost_excludes` are defined, add:

```php
$trip_facts = self::build_trip_facts(
    $settings,
    $at_a_glance,
    $duration_text,
    $group_text,
    $cost_includes,
    $cost_excludes,
    $location
);
```

### Finally, in the returned `$data` array, add:

```php
'trip_facts' => $trip_facts,
```

If there is already a returned array, add it near `at_a_glance`, `duration_text`, `group_text`, `cost_includes`, or similar product data keys.

---

## 2) `quick-info-v2.php` — remove fake social proof and use `trip_facts`

### Remove these lines / blocks:

- `$last_booked_html = '<span class="fts-v2-last-booked">23</span>';`
- The full `<!-- Social Proof -->` block containing:
  - `people viewing now`
  - `Last booked ... minutes ago`
  - `Trending in ...`
- In the trust bar remove hardcoded:
  - `20,000+ travelers`
  - `ISO 9001 Certified`
  - `Free Cancellation`

### Replace the local `$at_items` builder with:

```php
$trip_facts = isset( $trip_facts ) && is_array( $trip_facts ) ? $trip_facts : array();
$at_items   = ! empty( $trip_facts['items'] ) && is_array( $trip_facts['items'] ) ? $trip_facts['items'] : array();
$trust_items = ! empty( $trip_facts['trust_items'] ) && is_array( $trip_facts['trust_items'] ) ? $trip_facts['trust_items'] : array();
```

### Update the At-a-glance loop to keep using label/value:

```php
<?php if ( ! empty( $at_items ) ) : ?>
<ul class="fts-v2-at-a-glance">
    <?php foreach ( $at_items as $it ) : ?>
        <li><strong><?php echo esc_html( $it['label'] ); ?>:</strong> <?php echo esc_html( $it['value'] ); ?></li>
    <?php endforeach; ?>
</ul>
<?php endif; ?>
```

### In the trust bar, keep only real rating/reviews and data-driven trust items:

```php
<?php if ( $avg_rating > 0 ) : ?>
<div class="fts-v2-trust-item">
    <svg class="fts-v2-icon-star" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    <span><strong><?php echo number_format( $avg_rating, 1 ); ?>/5</strong> (<?php echo esc_html( sprintf( _n( '%s review', '%s reviews', $review_count, 'fts' ), number_format_i18n( $review_count ) ) ); ?>)</span>
</div>
<?php endif; ?>

<?php foreach ( $trust_items as $trust_item ) : ?>
<div class="fts-v2-trust-item">
    <svg class="fts-v2-icon-shield" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
    <span><strong><?php echo esc_html( $trust_item['label'] ); ?></strong></span>
</div>
<?php endforeach; ?>
```

If there are no rating and no trust items, hide the whole trust bar by wrapping it:

```php
<?php if ( $avg_rating > 0 || ! empty( $trust_items ) ) : ?>
<!-- Trust Bar -->
...
<?php endif; ?>
```

---

## 3) `sidebar-v2.php` — remove urgency/countdown and data-drive trust points

### Remove these blocks entirely:

- `<!-- Urgency — light red -->` block with `Only 3 spots left for tomorrow!`
- `<!-- Countdown — light orange -->` block with `Special offer ends in: 02:00:00`

### Before HTML output, add after the guard:

```php
$trip_facts  = isset( $trip_facts ) && is_array( $trip_facts ) ? $trip_facts : array();
$trust_items = ! empty( $trip_facts['trust_items'] ) && is_array( $trip_facts['trust_items'] ) ? $trip_facts['trust_items'] : array();
```

### Replace the `<!-- Trust Points -->` block with:

```php
<?php if ( ! empty( $trust_items ) ) : ?>
<div class="fts-v2-booking-trust">
    <?php foreach ( $trust_items as $trust_item ) : ?>
    <div class="fts-v2-booking-trust-item">
        <svg class="fts-v2-trust-svg" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <?php echo esc_html( $trust_item['label'] ); ?>
    </div>
    <?php endforeach; ?>
</div>
<?php endif; ?>
```

This removes unsupported claims like `Best Price Guaranteed`, `Free cancellation (24h before)`, and `Reserve now & pay later` unless they are provided as real facts.

---

## 4) `booking-modal-v2.php` — remove generic subtitle and fake modal urgency

### Add after `$trip_title = get_the_title( $trip_id );`:

```php
$trip_facts = isset( $trip_facts ) && is_array( $trip_facts ) ? $trip_facts : array();
$modal_subtitle = ! empty( $trip_facts['modal_subtitle'] ) ? $trip_facts['modal_subtitle'] : '';
$trust_items = ! empty( $trip_facts['trust_items'] ) && is_array( $trip_facts['trust_items'] ) ? $trip_facts['trust_items'] : array();
```

### Replace the hardcoded subtitle:

From:

```php
<p class="fts-bm-subtitle"><?php echo esc_html__( 'Pyramids, Sphinx & Museum', 'fts' ); ?></p>
```

To:

```php
<?php if ( $modal_subtitle !== '' ) : ?>
  <p class="fts-bm-subtitle"><?php echo esc_html( $modal_subtitle ); ?></p>
<?php endif; ?>
```

### Replace the `<!-- Trust Bar (with inline urgency) -->` block.

Remove the current hardcoded block containing:
- `Free Cancellation`
- `Secure Payment`
- `<strong class="fts-bm-spots">4</strong>`
- `<strong class="fts-bm-viewers">18</strong>`

Replace with:

```php
<?php if ( ! empty( $trust_items ) ) : ?>
<div class="fts-bm-trust-bar">
  <?php foreach ( $trust_items as $idx => $trust_item ) : ?>
    <?php if ( $idx > 0 ) : ?><span class="fts-bm-trust-sep">&middot;</span><?php endif; ?>
    <span class="fts-bm-trust-item">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      <?php echo esc_html( $trust_item['label'] ); ?>
    </span>
  <?php endforeach; ?>
</div>
<?php endif; ?>
```

### Also scan the lower `Trust Footer` in the same file.
Remove or data-drive any repeated hardcoded text such as:
- `Free Cancellation`
- `Secure Payment`
- unsupported guarantees

Keep generic security only if it describes the checkout system truthfully. Do not keep commercial promises unless they come from `$trust_items` or verified payment config.

---

## 5) Optional checks: tabs/script

Search these files for hardcoded commercial claims and remove/data-drive them:

```bash
grep -RIn "Free Cancellation\|Reserve now\|pay later\|spots left\|people viewing\|Last booked\|Special offer\|Best Price Guaranteed" trip-design-v2
```

If found in:
- `trip-design-v2/parts/parts/tabs-accordion-v2.php`
- `trip-design-v2/assets/assets/script-v2.js`

Then either:
1. Remove the UI text, or
2. Render it only from `$trip_facts['trust_items']` / real data.

---

## Acceptance Criteria

1. No hardcoded fake urgency remains:
   - no `people viewing now`
   - no `Last booked X minutes ago`
   - no `spots left`
   - no countdown offer timer unless backed by real data
2. No hardcoded commercial claims remain:
   - no unconditional `Free Cancellation`
   - no unconditional `Reserve now & pay later`
   - no unconditional `Best Price Guaranteed`
3. Quick bar, sidebar, and booking modal use the same `$trip_facts` source.
4. Missing facts are hidden, not invented.
5. `booking-modal-v2.php` subtitle is no longer `Pyramids, Sphinx & Museum` unless that is actually the current trip.
6. Run checks:

```bash
php -l trip-design-v2/layout-controller.php
php -l trip-design-v2/parts/parts/quick-info-v2.php
php -l trip-design-v2/parts/parts/sidebar-v2.php
php -l trip-design-v2/parts/parts/booking-modal-v2.php
grep -RIn "people viewing now\|Last booked\|spots left\|Special offer ends\|Pyramids, Sphinx & Museum\|Reserve now & pay later\|Best Price Guaranteed\|Free cancellation (24h before)" trip-design-v2
```

Expected grep result: no matches except comments/changelog, if any.

## Commit message

```text
Sprint 1: make trip template facts data-driven
```

## PR description

```markdown
### What changed
- Added a centralized trip facts layer for duration, pickup/meeting point, group size, languages, includes/excludes, cancellation, and payment terms.
- Removed hardcoded social-proof and urgency claims from the trip page template.
- Updated quick bar, sidebar, and booking modal to show only data-backed facts.
- Removed generic booking modal subtitle and replaced it with trip-specific facts.

### Why
This aligns the trip page template with product-truth rules: every commercial or trust claim must come from data, otherwise it is hidden.

### Validation
- PHP lint passes for edited files.
- Grep confirms no unsupported hardcoded urgency or commercial claims remain.
- Manual staging check required on a live trip page.
```
