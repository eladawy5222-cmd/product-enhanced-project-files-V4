<?php
/**
 * Booking Modal V2 — 4-Step Wizard Booking Overlay
 * Step 1: Choose a Date  |  Step 2: Number of Travelers
 * Step 3: Select a Package  |  Step 4: Review & Book
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$trip_title = get_the_title( $trip_id );
$whatsapp_link_html = '';
if ( ! empty( $whatsapp_number ) ) {
  $wa_number = preg_replace( '/[^0-9]/', '', $whatsapp_number );
  $wa_msg = fts_v2_safe_sprintf(
    __( 'Hi, I need help choosing a package for: %s', 'fts' ),
    array( $trip_title ),
    'Hi, I need help choosing a package for: ' . $trip_title
  );
  $whatsapp_link_html = '<a href="https://wa.me/' . esc_attr( $wa_number ) . '?text=' . rawurlencode( $wa_msg ) . '" target="_blank" rel="noopener">' . esc_html__( 'Chat with us on WhatsApp', 'fts' ) . '</a>';
}
?>

<div class="fts-bm-overlay fts-bm-tabs-mode" id="fts-booking-modal">
  <div class="fts-bm-container">

    <!-- ═══ Header ═══ -->
    <div class="fts-bm-header">
      <div class="fts-bm-header-left">
        <svg class="fts-bm-plane-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1l5.8 3.3-2 2.1-1.6-.7c-.4-.2-.9 0-1.1.4l-.2.3c-.1.3 0 .7.3.9l2.1 1.4 1.4 2.1c.2.3.6.4.9.3l.3-.2c.4-.2.6-.7.4-1.1l-.7-1.6 2.1-2 3.3 5.8c.2.4.7.5 1.1.3l.5-.3c.4-.2.6-.6.5-1.1z"/>
        </svg>
        <div>
          <h2 class="fts-bm-title"><?php echo esc_html( $trip_title ); ?></h2>
          <p class="fts-bm-subtitle"><?php echo esc_html__( 'Pyramids, Sphinx & Museum', 'fts' ); ?></p>
        </div>
      </div>
      <button type="button" class="fts-bm-close" aria-label="<?php echo esc_attr__( 'Close', 'fts' ); ?>">&times;</button>
    </div>

    <!-- ═══ Trust Bar (with inline urgency) ═══ -->
    <div class="fts-bm-trust-bar">
      <span class="fts-bm-trust-item fts-bm-trust-cancel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        <?php echo esc_html__( 'Free Cancellation', 'fts' ); ?>
      </span>
      <span class="fts-bm-trust-sep">&middot;</span>
      <span class="fts-bm-trust-item fts-bm-trust-secure">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
        <?php echo esc_html__( 'Secure Payment', 'fts' ); ?>
      </span>
      <span class="fts-bm-trust-sep">&middot;</span>
      <span class="fts-bm-trust-item fts-bm-trust-urgency" title="<?php echo esc_attr__( 'Spots left', 'fts' ); ?>">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.5-2.5 1.5-3.5"/></svg>
        <strong class="fts-bm-spots">4</strong>
      </span>
      <span class="fts-bm-trust-item fts-bm-trust-urgency" title="<?php echo esc_attr__( 'Currently viewing', 'fts' ); ?>">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <strong class="fts-bm-viewers">18</strong>
      </span>
    </div>

    <!-- ═══ Progress Bar ═══ -->
    <div class="fts-bm-progress" id="fts-bm-progress">
      <div class="fts-bm-progress-track">
        <div class="fts-bm-progress-seg active" data-seg="1"></div>
        <div class="fts-bm-progress-seg" data-seg="2"></div>
        <div class="fts-bm-progress-seg" data-seg="3"></div>
        <div class="fts-bm-progress-seg" data-seg="4"></div>
      </div>
      <div class="fts-bm-progress-labels">
        <span class="active" data-seg="1"><?php echo esc_html__( 'Date', 'fts' ); ?></span>
        <span data-seg="2"><?php echo esc_html__( 'Travelers', 'fts' ); ?></span>
        <span data-seg="3"><?php echo esc_html__( 'Package', 'fts' ); ?></span>
        <span data-seg="4"><?php echo esc_html__( 'Book', 'fts' ); ?></span>
      </div>
    </div>

    <!-- ═══ Scrollable Body ═══ -->
    <div class="fts-bm-body" id="fts-bm-body">

      <!-- ══════════════════════════════════════════
           Step 1: Choose a Date
           ══════════════════════════════════════════ -->
      <div class="fts-bm-step active" data-step="1" id="fts-bm-step-1">
        <div class="fts-bm-step-head" data-step="1">
          <div class="fts-bm-step-circle">
            <span class="fts-bm-step-num">1</span>
            <svg class="fts-bm-step-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div class="fts-bm-step-title">
            <span class="fts-bm-step-label"><?php echo esc_html__( 'Choose a Date', 'fts' ); ?></span>
            <span class="fts-bm-step-summary" id="fts-bm-summary-1"></span>
          </div>
          <span class="fts-bm-step-edit"><?php echo esc_html__( 'Edit', 'fts' ); ?></span>
          <svg class="fts-bm-step-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="fts-bm-step-body">
          <div class="fts-bm-step-intro">
            <h3 class="fts-bm-step-intro-title"><?php echo esc_html__( 'Choose your date', 'fts' ); ?></h3>
            <p class="fts-bm-step-intro-desc"><?php echo esc_html__( 'Lock in your preferred departure date before continuing to the rest of the booking details.', 'fts' ); ?></p>
          </div>
          <div class="fts-bm-date-wrapper fts-bm-date-wrapper--inline-cal">
            <?php /* Hidden field holds ISO date + display for booking JS; calendar is the only visible control */ ?>
            <input type="hidden" id="fts-bm-date-input" value="" autocomplete="off">
            <p class="fts-bm-date-hint"><?php echo esc_html__( 'Select your preferred travel date', 'fts' ); ?></p>
            <div class="fts-bm-cal-card">
              <div class="fts-bm-datepicker-wrap">
                <div id="fts-bm-datepicker-inline" class="fts-bm-datepicker-inline" aria-label="<?php echo esc_attr__( 'Travel date calendar', 'fts' ); ?>"></div>
              </div>
              <div class="fts-bm-calendar-legend">
                <span class="fts-bm-legend-item fts-bm-legend-low"><span class="fts-bm-legend-dot" aria-hidden="true"></span> <?php echo esc_html__( 'Low availability', 'fts' ); ?></span>
                <span class="fts-bm-legend-item fts-bm-legend-best"><span class="fts-bm-legend-dot" aria-hidden="true"></span> <?php echo esc_html__( 'Best price', 'fts' ); ?></span>
              </div>
            </div>
          </div>
          <div class="fts-bm-selection-summary" id="fts-bm-date-summary" style="display:none;">
            <div class="fts-bm-selection-summary-left">
              <strong><?php echo esc_html__( 'Selected date', 'fts' ); ?></strong>
              <span id="fts-bm-date-summary-value"></span>
            </div>
            <button type="button" class="fts-bm-selection-change" id="fts-bm-date-summary-change"><?php echo esc_html__( 'Change', 'fts' ); ?></button>
          </div>
          <button type="button" class="fts-bm-continue" id="fts-bm-continue-1" disabled>
            <?php echo esc_html__( 'Continue', 'fts' ); ?> &rarr;
          </button>
        </div>
      </div>

      <!-- ══════════════════════════════════════════
           Step 2: Number of Travelers
           ══════════════════════════════════════════ -->
      <div class="fts-bm-step locked" data-step="2" id="fts-bm-step-2">
        <div class="fts-bm-step-head" data-step="2">
          <div class="fts-bm-step-circle">
            <span class="fts-bm-step-num">2</span>
            <svg class="fts-bm-step-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div class="fts-bm-step-title">
            <span class="fts-bm-step-label"><?php echo esc_html__( 'Number of Travelers', 'fts' ); ?></span>
            <span class="fts-bm-step-summary" id="fts-bm-summary-2"></span>
          </div>
          <span class="fts-bm-step-edit"><?php echo esc_html__( 'Edit', 'fts' ); ?></span>
          <svg class="fts-bm-step-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="fts-bm-step-body">
          <div class="fts-bm-step-intro">
            <h3 class="fts-bm-step-intro-title"><?php echo esc_html__( 'Travelers', 'fts' ); ?></h3>
            <p class="fts-bm-step-intro-desc"><?php echo esc_html__( 'After choosing the date, the traveler adjusts the party size using the same familiar counters before moving to the available package cards.', 'fts' ); ?></p>
          </div>
          <div class="fts-bm-travelers-list" id="fts-bm-travelers-list">
            <!-- Populated by JS from selected package categories -->
          </div>
          <div class="fts-bm-selection-summary" id="fts-bm-traveler-summary" style="display:none;">
            <div class="fts-bm-selection-summary-left">
              <strong><?php echo esc_html__( 'Traveler summary', 'fts' ); ?></strong>
              <span id="fts-bm-traveler-summary-value">1 Adult</span>
            </div>
            <button type="button" class="fts-bm-selection-change" id="fts-bm-traveler-summary-change"><?php echo esc_html__( 'Change', 'fts' ); ?></button>
          </div>
          <button type="button" class="fts-bm-continue" id="fts-bm-continue-2">
            <?php echo esc_html__( 'Continue', 'fts' ); ?> &mdash; <span id="fts-bm-trav-count">1 traveler</span> &rarr;
          </button>
        </div>
      </div>

      <!-- ══════════════════════════════════════════
           Step 3: Select a Package
           ══════════════════════════════════════════ -->
      <div class="fts-bm-step locked" data-step="3" id="fts-bm-step-3">
        <div class="fts-bm-step-head" data-step="3">
          <div class="fts-bm-step-circle">
            <span class="fts-bm-step-num">3</span>
            <svg class="fts-bm-step-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div class="fts-bm-step-title">
            <span class="fts-bm-step-label"><?php echo esc_html__( 'Select a Package', 'fts' ); ?></span>
            <span class="fts-bm-step-summary" id="fts-bm-summary-3"></span>
          </div>
          <span class="fts-bm-step-edit"><?php echo esc_html__( 'Edit', 'fts' ); ?></span>
          <svg class="fts-bm-step-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="fts-bm-step-body">
          <div class="fts-bm-step-intro">
            <h3 class="fts-bm-step-intro-title"><?php echo esc_html__( 'Choose your package', 'fts' ); ?></h3>
            <p class="fts-bm-step-intro-desc"><?php echo esc_html__( 'The package cards stay visually identical, but they now appear after date and traveller selection so the total value can be understood in context.', 'fts' ); ?></p>
          </div>
          <div class="fts-bm-pkg-info-bar" id="fts-bm-pkg-info-bar">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span id="fts-bm-pkg-date-text"></span>
            </span>
            <span>&middot;</span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <span id="fts-bm-pkg-trav-text"></span>
            </span>
          </div>

          <?php if ( ! empty( $packages_list ) ) : ?>
          <div class="fts-bm-packages-list" id="fts-bm-packages-list">
            <?php foreach ( $packages_list as $pkg_idx => $pkg ) :
              $card_cls = 'fts-bm-package-card';
              if ( $pkg_idx === 0 ) $card_cls .= ' selected';
              if ( $pkg['badge'] === 'most_popular' ) $card_cls .= ' fts-bm-popular';
              if ( $pkg['badge'] === 'best_value' )   $card_cls .= ' fts-bm-best-value';
            ?>
            <div class="<?php echo esc_attr( $card_cls ); ?>" data-package-id="<?php echo esc_attr( $pkg['id'] ); ?>">
              <?php if ( $pkg['badge'] === 'most_popular' ) : ?>
                <div class="fts-bm-badge fts-bm-badge-popular">&starf; <?php echo esc_html__( 'MOST POPULAR', 'fts' ); ?></div>
              <?php elseif ( $pkg['badge'] === 'best_value' ) : ?>
                <div class="fts-bm-badge fts-bm-badge-value"><?php echo esc_html__( 'BEST VALUE', 'fts' ); ?></div>
              <?php endif; ?>

              <div class="fts-bm-package-inner">
                <div class="fts-bm-package-radio">
                  <input type="radio" name="fts_bm_package"
                         value="<?php echo esc_attr( $pkg['id'] ); ?>"
                         <?php echo $pkg_idx === 0 ? 'checked' : ''; ?>>
                </div>
                <div class="fts-bm-package-info">
                  <h3 class="fts-bm-package-name"><?php echo esc_html( $pkg['name'] ); ?></h3>
                  <?php if ( ! empty( $pkg['description'] ) ) : ?>
                    <p class="fts-bm-package-desc"><?php echo esc_html( $pkg['description'] ); ?></p>
                  <?php endif; ?>
                  <?php if ( ! empty( $pkg['features'] ) ) : ?>
                    <p class="fts-bm-package-features"><?php echo esc_html__( 'Includes', 'fts' ); ?> <?php echo esc_html( implode( ' • ', $pkg['features'] ) ); ?></p>
                  <?php endif; ?>
                </div>
                <div class="fts-bm-package-price">
                  <?php if ( $pkg['old_price'] > 0 ) : ?>
                    <span class="fts-bm-price-old"><?php echo esc_html( wte_get_formated_price( $pkg['old_price'] ) ); ?></span>
                    <span class="fts-bm-price-save"><?php
                      $fts_save_pct = intval( $pkg['discount_pct'] );
                      echo '-' . $fts_save_pct . '%';
                    ?></span>
                  <?php endif; ?>
                  <span class="fts-bm-price-current"><?php echo esc_html( wte_get_formated_price( $pkg['display_price'] ) ); ?></span>
                  <span class="fts-bm-price-per">/ <?php echo esc_html__( 'person', 'fts' ); ?></span>
                </div>
              </div>
            </div>
            <?php endforeach; ?>
          </div>
          <?php endif; ?>

          <button type="button" class="fts-bm-continue" id="fts-bm-continue-3">
            <?php echo esc_html__( 'Continue with', 'fts' ); ?> <span id="fts-bm-pkg-name-btn"></span> &rarr;
          </button>
        </div>
      </div>

      <!-- ══════════════════════════════════════════
           Step 4: Review & Book
           ══════════════════════════════════════════ -->
      <div class="fts-bm-step locked" data-step="4" id="fts-bm-step-4">
        <div class="fts-bm-step-head" data-step="4">
          <div class="fts-bm-step-circle">
            <span class="fts-bm-step-num">4</span>
            <svg class="fts-bm-step-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div class="fts-bm-step-title">
            <span class="fts-bm-step-label"><?php echo esc_html__( 'Review & Book', 'fts' ); ?></span>
            <span class="fts-bm-step-summary" id="fts-bm-summary-4"></span>
          </div>
          <svg class="fts-bm-step-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="fts-bm-step-body">

          <!-- Intro -->
          <div class="fts-bm-step-intro">
            <h3 class="fts-bm-step-intro-title"><?php echo esc_html__( 'Checkout', 'fts' ); ?></h3>
            <p class="fts-bm-step-intro-desc"><?php echo esc_html__( 'The final step keeps the calm review layout while presenting the booking details and primary payment action in one focused checkout screen.', 'fts' ); ?></p>
          </div>

          <?php if ( ! empty( $extra_services ) ) : ?>
          <!-- Extra Services -->
          <div class="fts-bm-extras-section" id="fts-bm-extras-section">
            <div class="fts-bm-extras-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <?php echo esc_html__( 'Add Extra Services', 'fts' ); ?>
              <span class="fts-bm-extras-opt">(<?php echo esc_html__( 'optional', 'fts' ); ?>)</span>
            </div>
            <?php foreach ( $extra_services as $es ) : ?>
            <div class="fts-bm-extra-row" data-es-id="<?php echo esc_attr( $es['id'] ); ?>" data-es-cost="<?php echo esc_attr( $es['cost'] ); ?>" data-es-unit="<?php echo esc_attr( $es['unit'] ); ?>" data-es-name="<?php echo esc_attr( $es['name'] ); ?>">
              <div class="fts-bm-extra-info">
                <strong><?php echo esc_html( $es['name'] ); ?></strong>
                <span class="fts-bm-extra-price"><?php
                  if ( floatval( $es['cost'] ) == 0 ) {
                    echo esc_html__( 'Free', 'fts' );
                  } else {
                    echo esc_html( wte_get_formated_price( $es['cost'] ) ) . '/' . esc_html( $es['unit'] === 'unit' ? __( 'unit', 'fts' ) : __( 'person', 'fts' ) );
                  }
                ?></span>
              </div>
              <div class="fts-bm-extra-counter">
                <button type="button" class="fts-bm-counter-btn fts-bm-es-minus" data-es="<?php echo esc_attr( $es['id'] ); ?>" disabled>&#8722;</button>
                <span class="fts-bm-es-val" data-es="<?php echo esc_attr( $es['id'] ); ?>">0</span>
                <button type="button" class="fts-bm-counter-btn fts-bm-es-plus" data-es="<?php echo esc_attr( $es['id'] ); ?>">+</button>
              </div>
            </div>
            <?php endforeach; ?>
          </div>
          <?php endif; ?>

          <!-- Booking Summary Review Card -->
          <div class="fts-bm-review-card" id="fts-bm-review-card">
            <div class="fts-bm-review-row" data-review-step="1">
              <div class="fts-bm-review-left">
                <strong class="fts-bm-review-label"><?php echo esc_html__( 'Date', 'fts' ); ?></strong>
                <span class="fts-bm-review-value" id="fts-bm-review-date">&mdash;</span>
              </div>
              <button type="button" class="fts-bm-review-edit" data-goto-step="1"><?php echo esc_html__( 'Edit', 'fts' ); ?></button>
            </div>
            <div class="fts-bm-review-row" data-review-step="2">
              <div class="fts-bm-review-left">
                <strong class="fts-bm-review-label"><?php echo esc_html__( 'Travelers', 'fts' ); ?></strong>
                <span class="fts-bm-review-value" id="fts-bm-review-travelers">&mdash;</span>
              </div>
              <button type="button" class="fts-bm-review-edit" data-goto-step="2"><?php echo esc_html__( 'Edit', 'fts' ); ?></button>
            </div>
            <div class="fts-bm-review-row" data-review-step="3">
              <div class="fts-bm-review-left">
                <strong class="fts-bm-review-label"><?php echo esc_html__( 'Package', 'fts' ); ?></strong>
                <span class="fts-bm-review-value" id="fts-bm-review-package">&mdash;</span>
              </div>
              <button type="button" class="fts-bm-review-edit" data-goto-step="3"><?php echo esc_html__( 'Edit', 'fts' ); ?></button>
            </div>
            <div class="fts-bm-review-row fts-bm-review-row--total">
              <div class="fts-bm-review-left">
                <strong class="fts-bm-review-label"><?php echo esc_html__( 'Total due now', 'fts' ); ?></strong>
                <span class="fts-bm-review-detail" id="fts-bm-review-total-detail"></span>
              </div>
              <strong class="fts-bm-review-total-price" id="fts-bm-review-total"><?php echo esc_html( $currency_symbol ); ?>0</strong>
            </div>
          </div>

          <!-- Next Steps Info Card -->
          <div class="fts-bm-next-steps-card">
            <div class="fts-bm-next-steps-row">
              <div class="fts-bm-next-steps-left">
                <strong><?php echo esc_html__( 'Lead traveller', 'fts' ); ?></strong>
                <span><?php echo esc_html__( 'Full name, phone, and WhatsApp', 'fts' ); ?></span>
              </div>
              <span class="fts-bm-next-steps-badge"><?php echo esc_html__( 'Checkout form', 'fts' ); ?></span>
            </div>
            <div class="fts-bm-next-steps-row">
              <div class="fts-bm-next-steps-left">
                <strong><?php echo esc_html__( 'Payment', 'fts' ); ?></strong>
                <span><?php echo esc_html__( 'Secure confirmation after review', 'fts' ); ?></span>
              </div>
              <span class="fts-bm-next-steps-badge"><?php echo esc_html__( 'Next action', 'fts' ); ?></span>
            </div>
          </div>

          <!-- Hidden breakdown data (used by JS for price calculation) -->
          <div class="fts-bm-breakdown" id="fts-bm-breakdown" style="display:none !important;">
            <div class="fts-bm-breakdown-meta" id="fts-bm-breakdown-meta"></div>
            <div class="fts-bm-breakdown-lines" id="fts-bm-breakdown-lines"></div>
            <div class="fts-bm-breakdown-total">
              <strong class="fts-bm-total-amount" id="fts-bm-total-amount"><?php echo esc_html( $currency_symbol ); ?>0</strong>
            </div>
          </div>

          <!-- Book Button (hidden in tabs mode; sticky footer triggers it) -->
          <button type="button" class="fts-bm-submit" id="fts-bm-submit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
            <span><?php echo esc_html__( 'Secure Booking', 'fts' ); ?> &mdash; <span class="fts-bm-submit-price"><?php echo esc_html( $currency_symbol ); ?>0</span></span>
          </button>

          <!-- Trust Footer -->
          <div class="fts-bm-trust-footer">
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
              <?php echo esc_html__( 'SSL Secured', 'fts' ); ?>
            </span>
            <span class="fts-bm-footer-sep">&middot;</span>
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <?php echo esc_html__( 'Visa / MC / PayPal', 'fts' ); ?>
            </span>
            <span class="fts-bm-footer-sep">&middot;</span>
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <?php echo esc_html__( 'Free Cancellation', 'fts' ); ?>
            </span>
          </div>

        </div>
      </div>

    </div><!-- .fts-bm-body -->

    <!-- Sticky footer: summary card + Back + Continue (one screen per step) -->
    <div class="fts-bm-sticky-footer" id="fts-bm-sticky-footer">
      <div class="fts-bm-sticky-card fts-bm-sticky-row fts-bm-sticky-row--no-back" id="fts-bm-sticky-row">
        <div class="fts-bm-sticky-top">
          <div class="fts-bm-sticky-summary">
            <span class="fts-bm-sticky-total-label"><?php echo esc_html__( 'Total', 'fts' ); ?></span>
            <span class="fts-bm-sticky-price" id="fts-bm-sticky-price-display">&mdash;</span>
            <p class="fts-bm-sticky-meta" id="fts-bm-sticky-meta" aria-live="polite"></p>
          </div>
          <button type="button" class="fts-bm-sticky-back" id="fts-bm-sticky-back" aria-label="<?php echo esc_attr__( 'Back', 'fts' ); ?>">
            <?php echo esc_html__( 'Back', 'fts' ); ?>
          </button>
        </div>
        <button type="button" class="fts-bm-continue fts-bm-sticky-btn" id="fts-bm-sticky-continue">
          <?php echo esc_html__( 'Continue to travelers', 'fts' ); ?>
        </button>
      </div>
    </div>

  </div><!-- .fts-bm-container -->
</div><!-- .fts-bm-overlay -->
