<?php
/**
 * Sidebar V2 — Sticky Booking Sidebar
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;
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

            <!-- Urgency — light red -->
            <div class="fts-v2-urgency-bar">
                <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.5-2.5 1.5-3.5"/></svg> <?php echo wp_kses_post( sprintf( __( 'Only %s spots left for tomorrow!', 'fts' ), '<strong class="fts-v2-spots-left">3</strong>' ) ); ?></span>
            </div>

            <!-- Countdown — light orange -->
            <div class="fts-v2-countdown-bar">
                <span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <?php echo esc_html__( 'Special offer ends in:', 'fts' ); ?></span>
                <span class="fts-v2-countdown-timer" data-hours="2">02:00:00</span>
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

            <!-- Trust Points -->
            <div class="fts-v2-booking-trust">
                <div class="fts-v2-booking-trust-item">
                    <svg class="fts-v2-trust-svg" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    <?php echo esc_html__( 'Best Price Guaranteed', 'fts' ); ?>
                </div>
                <div class="fts-v2-booking-trust-item">
                    <svg class="fts-v2-trust-svg" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    <?php echo esc_html__( 'Free cancellation (24h before)', 'fts' ); ?>
                </div>
                <div class="fts-v2-booking-trust-item">
                    <svg class="fts-v2-trust-svg" viewBox="0 0 24 24" fill="none" stroke="#43a047" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                    <?php echo esc_html__( 'Reserve now & pay later', 'fts' ); ?>
                </div>
            </div>

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