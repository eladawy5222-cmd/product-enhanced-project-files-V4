<?php
/**
 * FTS Single Trip Layout Customizations
 * This file handles the conversion of trip tabs into a modern accordion layout,
 * adds breadcrumbs, and manages inter-tab navigation.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/* =========================================================================
   1. TRIP BREADCRUMBS
   ========================================================================= */
function fts_add_breadcrumb_to_single_trip() {
    if (is_singular('trip') && function_exists('travel_monster_breadcrumb')) {
        echo '<div class="fts-trip-breadcrumb-area"><div class="container">';
        travel_monster_breadcrumb();
        echo '</div></div>';
    }
}
add_action('wp_travel_engine_before_trip_content', 'fts_add_breadcrumb_to_single_trip', 1);

/* =========================================================================
   2. HOOK REGISTRATION: TABS TO ACCORDION
   ========================================================================= */
function fts_customize_trip_tabs_to_accordion() {
    if ( ! is_singular( 'trip' ) ) return;

    if ( class_exists( 'WP_Travel_Engine_Template_Hooks' ) ) {
        $wte_instance = WP_Travel_Engine_Template_Hooks::get_instance();
        // Remove default tab content to replace with accordion
        remove_action( 'wte_single_trip_content', array( $wte_instance, 'display_single_trip_tabs_content' ), 25 );
    }

    add_action( 'wte_single_trip_content', 'fts_display_trip_accordion', 25 );
}
add_action( 'template_redirect', 'fts_customize_trip_tabs_to_accordion' );

/* =========================================================================
   3. MAIN DISPLAY LOGIC (ACCORDION & REVIEWS)
   ========================================================================= */
function fts_display_trip_accordion() {
    $settings = wte_get_active_single_trip_tabs();
    if ( false === $settings || empty( $settings['trip_tabs']['id'] ) ) return;

    $tabs = $settings['trip_tabs'];
    $allowed_info_fields = array('itinerary', 'cost', 'faqs', 'wp_editor', 'guides', 'map', 'dates');
    
    // START: Accordion Wrapper
    echo '<div class="fts-trip-accordion-wrapper">';
    $first_info_tab = true;

    foreach ( array_values( $tabs['id'] ) as $id ) {
        $field = isset($tabs['field'][ $id ]) ? $tabs['field'][ $id ] : '';
        $name  = isset($tabs['name'][ $id ]) ? $tabs['name'][ $id ] : '';
        $icon  = isset( $tabs['icon'][ $id ] ) ? $tabs['icon'][ $id ] : '';

        // Check if tab is a review tab
        $is_review = ( 
            strpos(strtolower($field), 'review') !== false || 
            strpos(strtolower($id), 'review') !== false || 
            strpos(strtolower($name), 'review') !== false || 
            strpos($name, 'تقييم') !== false || 
            strpos($name, 'آراء') !== false 
        );

        if ( $is_review || ! in_array($field, $allowed_info_fields) ) continue;

        $is_open = $first_info_tab ? 'active' : '';
        $icon_char = $first_info_tab ? '−' : '+';
        if ($is_open) $first_info_tab = false;

        echo '<div id="fts-sec-' . esc_attr($id) . '" class="fts-accordion-item ' . $is_open . '" data-tab-id="' . esc_attr($id) . '">';
        echo '<h2 class="fts-accordion-header">';
        echo esc_html( $name );
        echo '<span class="fts-accordion-icon">' . $icon_char . '</span>';
        echo '</h2>';
        echo '<div class="fts-accordion-content">';
        echo '<div class="fts-content-inner">';
        do_action( "wte_single_trip_tab_content_{$field}", $id, $field, $name, $icon );
        echo '</div>';
        echo '</div>';
        echo '</div>';
    }
    echo '</div>'; // END: Accordion Wrapper

    // START: Separate Reviews Section
    foreach ( array_values( $tabs['id'] ) as $id ) {
        $field = isset($tabs['field'][ $id ]) ? $tabs['field'][ $id ] : '';
        $name  = isset($tabs['name'][ $id ]) ? $tabs['name'][ $id ] : '';
        $is_review = ( strpos(strtolower($field), 'review') !== false || strpos(strtolower($id), 'review') !== false || strpos(strtolower($name), 'review') !== false );
        
        if ( $is_review ) {
            $icon  = isset( $tabs['icon'][ $id ] ) ? $tabs['icon'][ $id ] : '';
            echo '<div id="fts-sec-' . esc_attr($id) . '" class="fts-reviews-section-original">';
            echo '<h2 class="wte-tab-title">' . esc_html( $name ) . '</h2>';
            do_action( "wte_single_trip_tab_content_{$field}", $id, $field, $name, $icon );
            echo '</div>';
        }
    }
    ?>
    
    <!-- =========================================================================
         4. CSS STYLING
         ========================================================================= -->
    <style>
        :root { 
            --fts-prm: #ff7f50; 
            --fts-border: #eef2f6; 
            --fts-text-main: #2d3436;
        }

        /* 2. Accordion Styling */
        .fts-trip-breadcrumb-area { padding: 20px 0 0; }
        .fts-trip-accordion-wrapper { margin-top: 25px; }

        .fts-accordion-item {
            background: #fff !important;
            border: 1px solid var(--fts-border) !important;
            border-radius: 12px !important;
            margin-bottom: 15px !important;
            overflow: hidden !important;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 2px 10px rgba(0,0,0,0.03) !important;
            scroll-margin-top: 130px; 
        }
        .fts-accordion-item.active { 
            border-color: var(--fts-prm) !important; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.06) !important; 
        }

        .fts-accordion-header {
            cursor: pointer !important;
            padding: 20px 25px !important;
            background: #fff !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            font-size: 18px !important;
            font-weight: 700 !important;
            color: var(--fts-text-main) !important;
            transition: all 0.3s ease !important;
        }
        .fts-accordion-item.active .fts-accordion-header { 
            color: var(--fts-prm) !important; 
            background: #fcfdfe !important;
            border-bottom: 1px solid var(--fts-border) !important;
            border-radius: 12px 12px 0 0 !important;
        }

        .fts-accordion-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .fts-accordion-item.active .fts-accordion-content { max-height: 4000px; }
        .fts-content-inner { padding: 25px; font-size: 16px; line-height: 1.8; color: #4b5563; }
        
        /* Heading Size Adjustments inside Accordion */
        .fts-content-inner h1, .fts-content-inner h2, .fts-content-inner h3 { 
            font-size: 24px !important; 
            margin-top: 10px !important; 
            margin-bottom: 15px !important;
            color: var(--fts-text-main) !important;
        }
        .fts-content-inner h4, .fts-content-inner h5 { 
            font-size: 20px !important; 
            margin-top: 10px !important; 
        }
        
        /* Optional: Hide the redundant title if it exactly matches the tab name */
        .fts-content-inner .wte-tab-title { display: none !important; }

        .fts-accordion-icon {

            width: 34px; height: 34px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; font-size: 20px;
        }
        .fts-accordion-item.active .fts-accordion-icon { background: var(--fts-prm); color: #fff; transform: rotate(180deg); }

        .fts-reviews-section-original {
            margin-top: 60px;
            border-top: 2px solid var(--fts-border);
            padding-top: 40px;
            scroll-margin-top: 130px;
        }
        .fts-reviews-section-original .wte-tab-title { margin-bottom: 25px; font-size: 28px; font-weight: 800; color: var(--fts-text-main); }

        html, body { scroll-behavior: smooth !important; }
    </style>

    <!-- =========================================================================
         5. JAVASCRIPT: INTERACTIVITY & SMOOTH SCROLLING
         ========================================================================= -->
    <script>
        document.addEventListener('DOMContentLoaded', function() {

            var ftsScrolling = false;

            // 5.1 Toggle accordion (single-open)
            function toggleAccordion(item, forceOpen) {
                forceOpen = forceOpen || false;
                var isOpen = item.classList.contains('active');

                if (!isOpen || forceOpen) {
                    document.querySelectorAll('.fts-accordion-item.active').forEach(function(ai) {
                        if (ai !== item) {
                            ai.classList.remove('active');
                            var ic = ai.querySelector('.fts-accordion-icon');
                            if (ic) ic.textContent = '+';
                        }
                    });
                }

                if (isOpen && !forceOpen) {
                    item.classList.remove('active');
                    var icon = item.querySelector('.fts-accordion-icon');
                    if (icon) icon.textContent = '+';
                    return false;
                } else {
                    item.classList.add('active');
                    var icon2 = item.querySelector('.fts-accordion-icon');
                    if (icon2) icon2.textContent = '−';
                    return true;
                }
            }

            // 5.2 Smooth scroll to element (accounts for fixed headers)
            function ftsScrollTo(element) {
                if (!element) return;
                ftsScrolling = true;

                var adminBar    = document.querySelector('#wpadminbar');
                var adminBarH   = adminBar ? adminBar.offsetHeight : 0;

                var stickyHeader = document.querySelector('.sticky-holder.sticky')
                                || document.querySelector('.site-header.is-sticky');
                var headerH = stickyHeader ? stickyHeader.offsetHeight : 0;

                var stickyTabsH = 0;
                var tabsContainer = document.querySelector('.wpte-tabs-container.wpte-tabs-sticky');
                if (tabsContainer) {
                    var navBar = tabsContainer.querySelector('.nav-tab-wrapper');
                    stickyTabsH = navBar ? navBar.offsetHeight : 0;
                }

                var totalOffset = adminBarH + headerH + stickyTabsH + 20;
                var rect = element.getBoundingClientRect();
                var targetY = rect.top + window.pageYOffset - totalOffset;

                window.scrollTo({ top: targetY, behavior: 'smooth' });

                // Safety re-check after animation
                setTimeout(function() {
                    var rect2 = element.getBoundingClientRect();
                    if (Math.abs(rect2.top - totalOffset) > 50) {
                        var targetY2 = rect2.top + window.pageYOffset - totalOffset;
                        window.scrollTo({ top: targetY2, behavior: 'smooth' });
                    }
                    setTimeout(function() { ftsScrolling = false; }, 600);
                }, 500);
            }

            // 5.3 Block WTE's scrollIntoView on removed tab panels
            var origScrollIntoView = Element.prototype.scrollIntoView;
            Element.prototype.scrollIntoView = function() {
                if (ftsScrolling) return;
                if (this.id && this.id.indexOf('nb-') === 0 && this.id.indexOf('-configurations') !== -1) return;
                return origScrollIntoView.apply(this, arguments);
            };

            // 5.4 Accordion header clicks
            document.querySelectorAll('.fts-accordion-header').forEach(function(hdr) {
                hdr.addEventListener('click', function() {
                    var item = this.parentElement;
                    if (toggleAccordion(item)) {
                        setTimeout(function() { ftsScrollTo(item); }, 200);
                    }
                });
            });

            // 5.5 Override WTE tab handlers (delayed to run after WTE jQuery init)
            setTimeout(function() {
                var tabs = document.querySelectorAll('.nb-tab-trigger');

                function attachCleanHandler(tab) {
                    tab.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopImmediatePropagation();

                        var configId = this.getAttribute('data-configuration');
                        if (!configId) return;

                        var targetSec = document.getElementById('fts-sec-' + configId);
                        if (!targetSec) return;

                        // Mark active tab
                        document.querySelectorAll('.nav-tab.nb-tab-trigger').forEach(function(t) {
                            t.classList.remove('nav-tab-active');
                        });
                        this.classList.add('nav-tab-active');

                        var parentWrap = this.closest('.tab-anchor-wrapper');
                        if (parentWrap) {
                            document.querySelectorAll('.tab-anchor-wrapper').forEach(function(w) {
                                w.classList.remove('nav-tab-active');
                            });
                            parentWrap.classList.add('nav-tab-active');
                        }

                        // Open accordion
                        if (targetSec.classList.contains('fts-accordion-item')) {
                            toggleAccordion(targetSec, true);
                        }

                        // Scroll after accordion animation settles
                        setTimeout(function() { ftsScrollTo(targetSec); }, 600);
                    });
                }

                tabs.forEach(function(oldTab) {
                    var newTab = oldTab.cloneNode(true);
                    newTab.setAttribute('href', 'javascript:void(0)');
                    oldTab.parentNode.replaceChild(newTab, oldTab);
                    attachCleanHandler(newTab);
                });

            }, 800);

        });
    </script>
    <?php
}

/************************************************************************************
 *                                                                                  *
 *  ↓↓↓↓↓↓↓↓  FTS NUCLEAR MOBILE BOOKING AREA - V3 (PRICE FIX & ROBUST)  ↓↓↓↓↓↓↓↓  *
 *                                                                                  *
 *  - Hides original sidebar booking area on mobile.                                *
 *  - Injects a new fixed footer using core Trip object price data.                *
 *  - Guaranteed accurate pricing matching trip card logic.                         *
 *                                                                                  *
 ************************************************************************************/

add_action('wp_footer', function() {
    if ( ! is_singular('trip') ) return;
    
    // 1. Get real data from Trip Model (Source of Truth)
    $trip_id = get_the_ID();
    $trip = new \WPTravelEngine\Core\Models\Post\Trip( $trip_id );
    
    // Matching Card Price logic for 100% accuracy
    $has_sale = $trip->has_sale();
    $regular_price = $trip->get_price();
    $sale_price = $trip->get_sale_price();
    
    // Booking modal data
    $trip_booking_data = wptravelengine_trip_booking_modal_data( $trip_id );
    $has_date = $trip->has_date();

    ?>
    <div class="fts-mobile-fixed-booking">
        <div class="fts-mfb-wrap">
            <!-- Top Line: Cancellation -->
            <div class="fts-mfb-top">
                 <span class="fts-mfb-badge">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#12b76a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M9 16l2 2 4-4"></path></svg>
                     Free cancellation
                 </span>
            </div>
            
            <!-- Main Content: Price & Button -->
            <div class="fts-mfb-main">
                <div class="fts-mfb-price-col">
                    <?php if ( $has_sale && $regular_price > $sale_price ) : ?>
                        <div class="fts-p-old">From <del><?php \wte_the_formated_price( $regular_price ); ?></del></div>
                        <div class="fts-p-new">
                            <ins><?php \wte_the_formated_price( $sale_price ); ?></ins>
                            <span>per person</span>
                        </div>
                    <?php else : ?>
                        <div class="fts-p-new">
                            <ins><?php \wte_the_formated_price( $regular_price ); ?></ins>
                            <span>per person</span>
                        </div>
                    <?php endif; ?>
                </div>
                
                <div class="fts-mfb-btn-col">
                    <?php if ( $has_date ) : ?>
                        <button type="button"
                                class="wpte-bf-btn fts-bm-trigger fts-mfb-book-btn">Check availability</button>
                    <?php else : ?>
                        <button type="button" class="wpte-bf-btn wpte-button-disabled" disabled>Sold Out</button>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <style id="fts-footer-nuclear-v3">
        @media (max-width: 1024px) {
            /* Hide the original sidebar booking area + toggle buttons */
            .widget.wpte-booking-area-wrapper.wpte-bf-outer,
            button#wpte_price-toggle-btn-mb,
            .wpte_price-toggle-btn-mb { 
                display: none !important; 
            }
            
            .fts-mobile-fixed-booking {
                position: fixed !important;
                bottom: 0 !important;
                left: 0 !important;
                width: 100% !important;
                background: #fff !important;
                z-index: 9999999 !important;
                box-shadow: 0 -10px 40px rgba(0,0,0,0.12) !important;
                border-radius: 20px 20px 0 0 !important;
                box-sizing: border-box !important;
                padding-bottom: env(safe-area-inset-bottom, 15px);
                z-index:50 !important;
            }
            
            .fts-mfb-wrap {
                padding: 10px 15px 8px;
                display: flex;
                flex-direction: column;
            }
            
            .fts-mfb-top { margin-bottom: 4px; }
            .fts-mfb-badge {
                display: flex;
                align-items: center;
                gap: 6px;
                color: #0f1d23;
                font-weight: 600;
                font-size: 13px;
            }
            .fts-mfb-badge svg { width: 16px; height: 16px; }
            
            .fts-mfb-main {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                gap: 12px !important;
            }
            
            .fts-mfb-price-col { flex: 1; }
            .fts-p-old { color: #718096; font-size: 12px; margin-bottom: 0px; }
            .fts-p-new { display: flex; align-items: baseline; gap: 4px; }
            .fts-p-new ins { 
                font-size: 20px !important; 
                font-weight: 800 !important; 
                color: #d32f2f !important; 
                text-decoration: none !important;
                background: none !important;
            }
            .fts-p-new span { font-size: 12px; color: #4a5568; font-weight: 500; }
            
            .fts-mfb-btn-col { flex: 1.1; }
            .fts-mfb-book-btn {
                background: #006ce4 !important;
                border-radius: 50px !important;
                padding: 10px 8px !important;
                font-size: 14px !important;
                font-weight: 600 !important;
                text-transform: none !important;
                width: 100% !important;
                box-shadow: 0 4px 10px rgba(0,108,228,0.2) !important;
                color: #fff !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: none !important;
                line-height: 1.2 !important;
            }
            
            body { padding-bottom: 140px !important; }
        }
         /* Hide fixed footer when booking modal is open */
            body.wpte-bf-active .fts-mobile-fixed-booking,
            body.modal-open .fts-mobile-fixed-booking,
            body.overflow-hidden .fts-mobile-fixed-booking {
                display: none !important;
            }
        @media (min-width: 1025px) {
            .fts-mobile-fixed-booking { display: none !important; }
        }
    </style>
    <script>
    (function(){
        var bar = document.querySelector('.fts-mobile-fixed-booking');
        if (!bar) return;
        var observer = new MutationObserver(function(){
            var modal = document.querySelector('[role="dialog"], .wpte-bf-booking-form, .wpte-trip-booking-modal, [data-wp-component="Modal"]');
            if (modal) {
                bar.style.display = 'none';
            } else {
                bar.style.display = '';
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    })();
    </script>
    <?php
}, 999);

/************************************************************************************
 *  ↑↑↑  END OF FTS CUSTOM MOBILE BOOKING AREA FIX (V3)  ↑↑↑  
 ************************************************************************************/