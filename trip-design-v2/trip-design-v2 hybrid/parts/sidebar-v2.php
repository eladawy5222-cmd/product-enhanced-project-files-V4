<?php
/**
 * Sidebar V2 — Sticky Booking Sidebar
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$sidebar_facts = array();
if ( isset( $trip_facts ) && is_array( $trip_facts ) ) {
    foreach ( array( 'duration', 'meeting_point', 'group_size' ) as $k ) {
        if ( isset( $trip_facts[ $k ] ) ) {
            $v = trim( wp_strip_all_tags( (string) $trip_facts[ $k ] ) );
            if ( $v !== '' ) $sidebar_facts[ $k ] = $v;
        }
    }
}
?>

<div class="fts-v2-sidebar-wrapper" id="fts-v2-booking-sidebar">
    <div class="fts-v2-sidebar-sticky">

        <!-- ═══ Main Booking Card ═══ -->
        <div class="fts-v2-booking-card">

            <!-- Price Header — Dark Navy -->
            <div class="fts-v2-booking-price-top">
                <div class="fts-v2-booking-price-header">
                    <div class="fts-v2-booking-from"><?php echo esc_html__( 'From', 'fts' ); ?></div>
                    <?php if ( $avg_rating > 0 ) : ?>
                    <div class="fts-v2-booking-rating">
                        <i class="fa fa-star"></i> <?php echo esc_html( number_format( (float) $avg_rating, 1 ) ); ?>
                        <span>(<?php echo intval( $review_count ); ?>)</span>
                    </div>
                    <?php endif; ?>
                </div>
                <div class="fts-v2-booking-price-row">
                    <?php if ( $old_price > 0 ) : ?>
                        <span class="fts-v2-booking-old-price"><?php echo wte_get_formated_price( $old_price ); ?></span>
                    <?php endif; ?>
                    <span class="fts-v2-booking-current-price"><?php echo wte_get_formated_price( $display_price ); ?></span>
                    <span class="fts-v2-booking-per-person"><?php echo esc_html__( '/ person', 'fts' ); ?></span>
                </div>
                <?php if ( $discount_pct > 0 ) : ?>
                <div class="fts-v2-booking-save-badge"><?php echo esc_html__( 'SAVE', 'fts' ); ?> <?php echo intval( $discount_pct ); ?>%</div>
                <?php endif; ?>
            </div>

            <!-- ═══ Calendar Accordion ═══ -->
            <div class="fts-v2-calendar-section fts-v2-cal-collapsed" id="fts-v2-cal-accordion">
                <button type="button" class="fts-v2-cal-toggle" id="fts-v2-cal-toggle">
                    <div class="fts-v2-cal-toggle-left">
                        <div class="fts-v2-cal-icon-wrap">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <div class="fts-v2-cal-toggle-text">
                            <span class="fts-v2-cal-label"><?php echo esc_html__( 'Select Date', 'fts' ); ?></span>
                            <span class="fts-v2-cal-selected" id="fts-v2-cal-selected"><?php echo esc_html__( 'Tap to choose your travel date', 'fts' ); ?></span>
                        </div>
                    </div>
                    <svg class="fts-v2-cal-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                <div class="fts-v2-cal-body" id="fts-v2-cal-body">
                    <div id="fts-v2-datepicker"></div>
                    <div class="fts-v2-calendar-legend">
                        <span class="fts-v2-legend-item fts-v2-legend-low"><span class="fts-v2-legend-dot"></span> <?php echo esc_html__( 'Low availability', 'fts' ); ?></span>
                        <span class="fts-v2-legend-item fts-v2-legend-best"><span class="fts-v2-legend-dot"></span> <?php echo esc_html__( 'Best price', 'fts' ); ?></span>
                    </div>
                </div>
            </div>

            <!-- ═══ Travelers Accordion ═══ -->
            <div class="fts-v2-travelers-accordion fts-v2-trav-collapsed" id="fts-v2-travelers-accordion">
                <button type="button" class="fts-v2-trav-toggle" id="fts-v2-trav-toggle">
                    <div class="fts-v2-trav-toggle-left">
                        <div class="fts-v2-trav-icon-wrap">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div class="fts-v2-trav-toggle-text">
                            <span class="fts-v2-trav-label"><?php echo esc_html__( 'Travelers', 'fts' ); ?></span>
                            <span class="fts-v2-trav-summary" id="fts-v2-trav-summary"><?php echo esc_html__( '1 Adult', 'fts' ); ?></span>
                        </div>
                    </div>
                    <svg class="fts-v2-trav-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                <div class="fts-v2-trav-body" id="fts-v2-trav-body">
                    <div class="fts-v2-trav-row">
                        <div class="fts-v2-trav-row-info">
                            <span class="fts-v2-trav-row-label"><?php echo esc_html__( 'Adults', 'fts' ); ?></span>
                            <span class="fts-v2-trav-row-hint"><?php echo esc_html__( 'Age 12+', 'fts' ); ?></span>
                        </div>
                        <div class="fts-v2-trav-row-counter">
                            <button type="button" class="fts-v2-trav-btn" data-type="adults" data-dir="minus">−</button>
                            <span class="fts-v2-trav-num" id="fts-v2-adults-count">1</span>
                            <button type="button" class="fts-v2-trav-btn" data-type="adults" data-dir="plus">+</button>
                        </div>
                    </div>
                    <div class="fts-v2-trav-row">
                        <div class="fts-v2-trav-row-info">
                            <span class="fts-v2-trav-row-label"><?php echo esc_html__( 'Children', 'fts' ); ?></span>
                            <span class="fts-v2-trav-row-hint"><?php echo esc_html__( 'Age 2–11', 'fts' ); ?></span>
                        </div>
                        <div class="fts-v2-trav-row-counter">
                            <button type="button" class="fts-v2-trav-btn" data-type="children" data-dir="minus">−</button>
                            <span class="fts-v2-trav-num" id="fts-v2-children-count">0</span>
                            <button type="button" class="fts-v2-trav-btn" data-type="children" data-dir="plus">+</button>
                        </div>
                    </div>
                </div>
            </div>

            <?php if ( ! empty( $sidebar_facts ) ) : ?>
            <div class="fts-v2-booking-trust">
                <?php if ( ! empty( $sidebar_facts['duration'] ) ) : ?>
                <div class="fts-v2-booking-trust-item">
                    <svg class="fts-v2-trust-svg" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="10"/></svg>
                    <?php echo esc_html( $sidebar_facts['duration'] ); ?>
                </div>
                <?php endif; ?>
                <?php if ( ! empty( $sidebar_facts['meeting_point'] ) ) : ?>
                <div class="fts-v2-booking-trust-item">
                    <svg class="fts-v2-trust-svg" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-4.35 7-11a7 7 0 0 0-14 0c0 6.65 7 11 7 11z"/><circle cx="12" cy="10" r="2"/></svg>
                    <?php echo esc_html( $sidebar_facts['meeting_point'] ); ?>
                </div>
                <?php endif; ?>
                <?php if ( ! empty( $sidebar_facts['group_size'] ) ) : ?>
                <div class="fts-v2-booking-trust-item">
                    <svg class="fts-v2-trust-svg" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <?php echo esc_html( $sidebar_facts['group_size'] ); ?>
                </div>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <!-- Check Availability — opens custom booking modal -->
            <div class="fts-v2-booking-cta">
                <button type="button"
                        class="fts-v2-check-btn fts-bm-trigger"
                ><?php echo esc_html__( 'Check Availability', 'fts' ); ?></button>
            </div>

            <!-- Payment — Visa | Mastercard | PayPal -->
            <div class="fts-v2-payment-icons">
                <i class="fa fa-credit-card"></i>
                <span class="fts-v2-payment-text">Visa</span>
                <span class="fts-v2-payment-sep">|</span>
                <span class="fts-v2-payment-text">Mastercard</span>
                <span class="fts-v2-payment-sep">|</span>
                <span class="fts-v2-payment-text">PayPal</span>
            </div>
        </div>

        <?php if ( $enquiry_enabled === 'on' ) : ?>
        <div class="fts-v2-enquiry-card">
            <h4><i class="fa fa-comments-o"></i> <?php echo esc_html__( 'Have a Question?', 'fts' ); ?></h4>
            <p><?php echo esc_html__( 'Our travel experts are here to help.', 'fts' ); ?></p>
            <?php echo do_shortcode( '[WP_TRAVEL_ENGINE_TRIP_ENQUIRY_FORM use_current="yes"]' ); ?>
        </div>
        <?php endif; ?>

    </div>
</div>
