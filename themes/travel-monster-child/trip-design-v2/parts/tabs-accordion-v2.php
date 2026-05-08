<?php
/**
 * Content Sections V2 - Overview, Itinerary, Includes, Pricing, Gallery, Reviews, FAQ
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;
?>

<div class="fts-v2-content-sections">

    <!-- ==================== OVERVIEW ==================== -->
    <?php if ( $has_overview_text ) : ?>
    <section id="fts-v2-sec-overview" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html__( 'Trip Overview', 'fts' ); ?></h2>
        <div class="fts-v2-overview-text"><?php echo wp_kses_post( $overview_content ); ?></div>
    </section>
    <?php endif; ?>

    <!-- ==================== TRIP HIGHLIGHTS ==================== -->
    <?php if ( ! empty( $highlights ) ) :
        $hl_icon_map = array(
            array( 'keys' => array( 'flight', 'fly', 'plane', 'air', 'domestic' ), 'icon' => 'fa-plane',      'color' => '#e67e22' ),
            array( 'keys' => array( 'pyramid', 'giza', 'sphinx', 'ancient' ),      'icon' => 'fa-university', 'color' => '#2c3e50' ),
            array( 'keys' => array( 'museum', 'gem', 'exhibit' ),                   'icon' => 'fa-building',   'color' => '#2980b9' ),
            array( 'keys' => array( 'nile', 'boat', 'river', 'cruise', 'sail' ),    'icon' => 'fa-ship',       'color' => '#27ae60' ),
            array( 'keys' => array( 'lunch', 'food', 'meal', 'dinner', 'cuisine' ), 'icon' => 'fa-cutlery',    'color' => '#e67e22' ),
            array( 'keys' => array( 'guide', 'expert', 'egyptologist' ),            'icon' => 'fa-user',       'color' => '#c0392b' ),
            array( 'keys' => array( 'transfer', 'vehicle', 'car', 'bus', 'van' ),   'icon' => 'fa-car',        'color' => '#27ae60' ),
            array( 'keys' => array( 'hotel', 'accommodation', 'stay', 'resort' ),   'icon' => 'fa-bed',        'color' => '#8e44ad' ),
            array( 'keys' => array( 'snorkel', 'dive', 'sea', 'beach', 'swim' ),    'icon' => 'fa-tint',       'color' => '#2980b9' ),
            array( 'keys' => array( 'photo', 'camera', 'picture' ),                 'icon' => 'fa-camera',     'color' => '#e67e22' ),
            array( 'keys' => array( 'temple', 'church', 'mosque', 'tomb' ),         'icon' => 'fa-university', 'color' => '#c0392b' ),
            array( 'keys' => array( 'mountain', 'trek', 'hike', 'climb' ),          'icon' => 'fa-flag',       'color' => '#27ae60' ),
            array( 'keys' => array( 'safari', 'desert', 'camel', 'quad' ),          'icon' => 'fa-sun-o',      'color' => '#e67e22' ),
            array( 'keys' => array( 'ticket', 'entry', 'fee', 'inclusive' ),         'icon' => 'fa-ticket',     'color' => '#2980b9' ),
        );
        $hl_fallback_icons = array(
            array( 'icon' => 'fa-star',  'color' => '#e67e22' ),
            array( 'icon' => 'fa-gem',   'color' => '#2980b9' ),
            array( 'icon' => 'fa-leaf',  'color' => '#27ae60' ),
            array( 'icon' => 'fa-heart', 'color' => '#c0392b' ),
        );
        $hl_idx = 0;
    ?>
    <section id="fts-v2-sec-highlights" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html( $highlights_title ); ?></h2>
        <div class="fts-v2-highlights">
            <div class="fts-v2-highlights-grid">
                <?php foreach ( $highlights as $h ) : if ( empty( $h ) ) continue;
                    $lower = strtolower( $h );
                    $matched_icon  = null;
                    $matched_color = null;
                    foreach ( $hl_icon_map as $map ) {
                        foreach ( $map['keys'] as $kw ) {
                            if ( strpos( $lower, $kw ) !== false ) {
                                $matched_icon  = $map['icon'];
                                $matched_color = $map['color'];
                                break 2;
                            }
                        }
                    }
                    if ( ! $matched_icon ) {
                        $fb = $hl_fallback_icons[ $hl_idx % count( $hl_fallback_icons ) ];
                        $matched_icon  = $fb['icon'];
                        $matched_color = $fb['color'];
                    }
                    $hl_idx++;
                ?>
                <div class="fts-v2-highlight-item">
                    <span class="fts-v2-hl-icon" style="color:<?php echo esc_attr( $matched_color ); ?>"><i class="fa <?php echo esc_attr( $matched_icon ); ?>"></i></span>
                    <span><?php echo esc_html( $h ); ?></span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </section>
    <?php endif; ?>

    <!-- ==================== ITINERARY ==================== -->
    <?php if ( $has_itinerary ) : ?>
    <section id="fts-v2-sec-itinerary" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html__( 'Day Itinerary', 'fts' ); ?></h2>
        <div class="fts-v2-itinerary-timeline">
            <?php $day_num = 0; foreach ( $itin_titles as $key => $title ) : if ( empty( $title ) ) continue; $day_num++;
                $is_first   = ( $day_num === 1 );
                $has_desc   = ! empty( $itin_content[ $key ] );
                $item_class = $is_first && $has_desc ? 'fts-v2-timeline-item active' : 'fts-v2-timeline-item';
            ?>
            <div class="<?php echo esc_attr( $item_class ); ?>">
                <div class="fts-v2-timeline-marker">
                    <span class="fts-v2-timeline-num"><?php echo intval( $day_num ); ?></span>
                    <div class="fts-v2-timeline-line"></div>
                </div>
                <div class="fts-v2-timeline-content">
                    <div class="fts-v2-timeline-header">
                        <div class="fts-v2-timeline-header-text">
                            <?php if ( ! empty( $itin_days_label[ $key ] ) ) : ?>
                                <span class="fts-v2-timeline-label"><?php echo esc_html( $itin_days_label[ $key ] ); ?></span>
                            <?php endif; ?>
                            <h3 class="fts-v2-timeline-title"><?php echo wp_kses_post( $title ); ?></h3>
                        </div>
                        <?php if ( $has_desc ) : ?>
                        <span class="fts-v2-timeline-toggle"><i class="fa fa-chevron-down"></i></span>
                        <?php endif; ?>
                    </div>
                    <?php if ( $has_desc ) : ?>
                    <div class="fts-v2-timeline-desc"<?php if ( $is_first ) echo ' style="display:block"'; ?>><?php echo wp_kses_post( $itin_content[ $key ] ); ?></div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <!-- ==================== INCLUDES / EXCLUDES ==================== -->
    <?php if ( $has_cost ) : ?>
    <section id="fts-v2-sec-includes" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html__( "What's Included", 'fts' ); ?></h2>
        <div class="fts-v2-includes-grid">
            <?php if ( ! empty( trim( $cost_includes ) ) ) :
                $inc_list = preg_split( '/\r\n|[\r\n]/', $cost_includes );
            ?>
            <div class="fts-v2-includes-col fts-v2-col-included">
                <h3><i class="fa fa-check-circle"></i> <?php echo esc_html__( 'Included', 'fts' ); ?></h3>
                <ul>
                    <?php foreach ( $inc_list as $item ) : if ( empty( trim( $item ) ) ) continue; ?>
                    <li><i class="fa fa-check"></i> <?php echo esc_html( $item ); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
            <?php endif; ?>

            <?php if ( ! empty( trim( $cost_excludes ) ) ) :
                $exc_list = preg_split( '/\r\n|[\r\n]/', $cost_excludes );
            ?>
            <div class="fts-v2-includes-col fts-v2-col-excluded">
                <h3><i class="fa fa-times-circle"></i> <?php echo esc_html__( 'Not Included', 'fts' ); ?></h3>
                <ul>
                    <?php foreach ( $exc_list as $item ) : if ( empty( trim( $item ) ) ) continue; ?>
                    <li><i class="fa fa-times"></i> <?php echo esc_html( $item ); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
            <?php endif; ?>
        </div>

        <!-- CTA Banner -->
        <div class="fts-v2-cta-banner">
            <div class="fts-v2-cta-text">
                <h3><?php echo esc_html__( 'Ready to Book This Trip?', 'fts' ); ?></h3>
                <p><?php echo esc_html__( 'Secure your spot now. Free cancellation available.', 'fts' ); ?></p>
            </div>
            <div class="fts-v2-cta-actions">
                <a href="#" class="fts-v2-cta-btn-primary fts-bm-trigger"><?php echo esc_html__( 'Book Now', 'fts' ); ?></a>
                <?php if ( ! empty( $whatsapp_number ) ) : ?>
                <?php $wa_number = preg_replace( '/[^0-9]/', '', (string) $whatsapp_number ); ?>
                <a href="https://wa.me/<?php echo esc_attr( $wa_number ); ?>" target="_blank" rel="noopener noreferrer nofollow" class="fts-v2-cta-btn-secondary" data-fts-wa-source="cta_banner"><i class="fa fa-whatsapp"></i> <?php echo esc_html__( 'Chat on WhatsApp', 'fts' ); ?></a>
                <?php endif; ?>
            </div>
        </div>
    </section>
    <?php endif; ?>

    <!-- ==================== TRIP FACTS ==================== -->
    <?php if ( ! empty( $has_trip_facts ) && ! empty( $trip_facts_items ) ) : ?>
    <section id="fts-v2-sec-facts" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html( ! empty( $trip_facts_title ) ? $trip_facts_title : __( 'Trip Facts', 'ftstravels' ) ); ?></h2>
        <div class="fts-v2-facts-grid">
            <?php foreach ( $trip_facts_items as $tf ) :
                $lbl = isset( $tf['label'] ) ? trim( (string) $tf['label'] ) : '';
                $val = isset( $tf['value'] ) ? trim( (string) $tf['value'] ) : '';
                if ( $lbl === '' || $val === '' ) continue;
                $icon = isset( $tf['icon'] ) ? trim( (string) $tf['icon'] ) : 'fa-info-circle';
            ?>
                <div class="fts-v2-fact-card">
                    <div class="fts-v2-fact-card-icon"><i class="fa <?php echo esc_attr( $icon ); ?>"></i></div>
                    <div class="fts-v2-fact-card-body">
                        <div class="fts-v2-fact-card-label"><?php echo esc_html( $lbl ); ?></div>
                        <div class="fts-v2-fact-card-value"><?php echo esc_html( $val ); ?></div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <!-- ==================== WHY PEOPLE LOVE THIS TRIP (Custom Tab) ==================== -->
    <?php if ( $has_why_love ) : ?>
    <section id="fts-v2-sec-why-love" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html( ! empty( $why_love_tab_title ) ? $why_love_tab_title : __( 'Why People Love This Trip', 'fts' ) ); ?></h2>
        <div class="fts-v2-why-love-content"><?php echo wp_kses_post( $why_love_content ); ?></div>
    </section>
    <?php endif; ?>

    <!-- ==================== PRICING / PACKAGES ==================== -->
    <section id="fts-v2-sec-pricing" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html__( 'Choose Your Package', 'fts' ); ?></h2>
        <?php
        $has_packages = false;
        $packages     = null;
        $primary_id   = 0;
        if ( $trip_obj && method_exists( $trip_obj, 'has_package' ) ) {
            try {
                $has_packages = $trip_obj->has_package();
                if ( $has_packages && method_exists( $trip_obj, 'packages' ) ) {
                    $packages   = $trip_obj->packages();
                    $primary_id = $trip_obj->get_meta( 'primary_package' );
                }
            } catch ( \Throwable $e ) {
                $has_packages = false;
            }
        }
        ?>
        <?php if ( ! empty( $packages_list ) ) : ?>
        <p class="fts-v2-section-subtitle"><?php echo esc_html__( 'Compare inclusions like transfers, guide & lunch below.', 'fts' ); ?></p>
        <?php
            $pkg_min_price = null;
            foreach ( (array) $packages_list as $p0 ) {
                $p0_price = floatval( $p0['display_price'] ?? 0 );
                if ( $p0_price <= 0 ) continue;
                if ( $pkg_min_price === null || $p0_price < $pkg_min_price ) $pkg_min_price = $p0_price;
            }

            $pkg_feature_maps = array();
            $pkg_feature_freq = array();
            foreach ( (array) $packages_list as $pi => $pk0 ) {
                $m = array();
                $ff = $pk0['features_full'] ?? ( $pk0['features'] ?? array() );
                foreach ( (array) $ff as $f0 ) {
                    $label = trim( (string) $f0 );
                    if ( $label === '' ) continue;
                    $k = strtolower( $label );
                    $m[ $k ] = true;
                    if ( ! isset( $pkg_feature_freq[ $k ] ) ) $pkg_feature_freq[ $k ] = array( 'label' => $label, 'count' => 0 );
                    $pkg_feature_freq[ $k ]['count']++;
                }
                $pkg_feature_maps[ $pi ] = $m;
            }
            uasort( $pkg_feature_freq, function( $a, $b ) {
                $ca = intval( $a['count'] ?? 0 );
                $cb = intval( $b['count'] ?? 0 );
                if ( $ca !== $cb ) return $cb <=> $ca;
                return strcasecmp( (string) ( $a['label'] ?? '' ), (string) ( $b['label'] ?? '' ) );
            } );
            $pkg_compare_rows = array_slice( $pkg_feature_freq, 0, 10, true );
        ?>
        <div class="fts-v2-packages-actions">
            <button type="button" class="fts-v2-pkg-compare-toggle" data-state="collapsed" data-more="<?php echo esc_attr__( 'Compare packages', 'fts' ); ?>" data-less="<?php echo esc_attr__( 'Hide comparison', 'fts' ); ?>">
                <?php echo esc_html__( 'Compare packages', 'fts' ); ?>
            </button>
        </div>
        <div class="fts-v2-packages-grid">
            <?php foreach ( $packages_list as $pkg ) :
                $card_cls = 'fts-v2-package-card';
                if ( $pkg['badge'] === 'most_popular' ) $card_cls .= ' fts-v2-package-popular';
                if ( $pkg['badge'] === 'best_value' )   $card_cls .= ' fts-v2-package-best-value';
            ?>
            <div class="<?php echo esc_attr( $card_cls ); ?>">
                <?php if ( $pkg['badge'] === 'most_popular' ) : ?>
                <div class="fts-v2-package-badge fts-v2-badge-popular"><span>&#9733;</span> <?php echo esc_html__( 'Most Popular', 'fts' ); ?></div>
                <?php elseif ( $pkg['badge'] === 'best_value' ) : ?>
                <div class="fts-v2-package-badge fts-v2-badge-value"><span>&#9889;</span> <?php echo esc_html__( 'Best Value', 'fts' ); ?></div>
                <?php endif; ?>

                <h3 class="fts-v2-package-name"><?php echo esc_html( $pkg['name'] ); ?></h3>
                <?php if ( ! empty( $pkg['description'] ) ) : ?>
                <p class="fts-v2-package-desc"><?php echo esc_html( $pkg['description'] ); ?></p>
                <?php endif; ?>

                <div class="fts-v2-package-price">
                    <?php if ( $pkg['old_price'] > 0 ) : ?>
                    <span class="fts-v2-pkg-old"><?php echo wte_get_formated_price( $pkg['old_price'] ); ?></span>
                    <?php endif; ?>
                    <span class="fts-v2-pkg-current"><?php echo wte_get_formated_price( $pkg['display_price'] ); ?></span>
                    <span class="fts-v2-pkg-per"><?php echo esc_html__( '/ person', 'fts' ); ?></span>
                </div>

                <?php if ( ! empty( $pkg['discount_pct'] ) && intval( $pkg['discount_pct'] ) > 0 ) : ?>
                    <div class="fts-v2-pkg-save"><?php echo esc_html( sprintf( __( 'Save %s%%', 'fts' ), intval( $pkg['discount_pct'] ) ) ); ?></div>
                <?php endif; ?>

                <?php
                    $dp = floatval( $pkg['display_price'] ?? 0 );
                    $diff = ( $pkg_min_price !== null && $dp > 0 ) ? ( $dp - floatval( $pkg_min_price ) ) : 0;
                ?>
                <?php if ( $pkg_min_price !== null && $dp > 0 ) : ?>
                    <?php if ( $diff <= 0.01 ) : ?>
                        <div class="fts-v2-pkg-delta is-lowest"><?php echo esc_html__( 'Lowest price', 'fts' ); ?></div>
                    <?php else : ?>
                        <div class="fts-v2-pkg-delta"><?php echo esc_html( sprintf( __( '+%s vs lowest', 'fts' ), wte_get_formated_price( $diff ) ) ); ?></div>
                    <?php endif; ?>
                <?php endif; ?>

                <?php if ( ! empty( $pkg['features'] ) ) : ?>
                <ul class="fts-v2-package-features">
                    <?php foreach ( $pkg['features'] as $feat ) : ?>
                    <li>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38a169" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        <?php echo esc_html( $feat ); ?>
                    </li>
                    <?php endforeach; ?>
                </ul>
                <?php endif; ?>

                <a href="#" class="fts-v2-package-select-btn fts-bm-trigger" data-package-id="<?php echo esc_attr( $pkg['id'] ); ?>"><?php echo esc_html__( 'Select Package', 'fts' ); ?></a>
            </div>
            <?php endforeach; ?>
        </div>

        <?php if ( ! empty( $pkg_compare_rows ) ) : ?>
        <div class="fts-v2-package-compare" data-state="collapsed" style="--fts-v2-pkg-cols: <?php echo esc_attr( count( (array) $packages_list ) ); ?>;">
            <div class="fts-v2-package-compare-inner" role="region" aria-label="<?php echo esc_attr__( 'Package comparison', 'fts' ); ?>">
                <div class="fts-v2-package-compare-head">
                    <div class="fts-v2-package-compare-cell fts-v2-package-compare-feature"><?php echo esc_html__( 'Inclusions', 'fts' ); ?></div>
                    <?php foreach ( (array) $packages_list as $pkh ) : ?>
                        <div class="fts-v2-package-compare-cell">
                            <div class="fts-v2-package-compare-name"><?php echo esc_html( $pkh['name'] ?? '' ); ?></div>
                            <?php if ( ! empty( $pkh['display_price'] ) ) : ?>
                                <div class="fts-v2-package-compare-price"><?php echo esc_html( wte_get_formated_price( $pkh['display_price'] ) ); ?></div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
                <?php foreach ( $pkg_compare_rows as $k => $row ) : ?>
                    <div class="fts-v2-package-compare-row">
                        <div class="fts-v2-package-compare-cell fts-v2-package-compare-feature"><?php echo esc_html( $row['label'] ?? '' ); ?></div>
                        <?php foreach ( (array) $packages_list as $pi => $pkc ) : ?>
                            <?php $hasf = ! empty( $pkg_feature_maps[ $pi ][ $k ] ); ?>
                            <div class="fts-v2-package-compare-cell">
                                <?php if ( $hasf ) : ?>
                                    <span class="fts-v2-compare-yes" aria-label="<?php echo esc_attr__( 'Included', 'fts' ); ?>">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38a169" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                    </span>
                                <?php else : ?>
                                    <span class="fts-v2-compare-no" aria-hidden="true">&mdash;</span>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>
        <?php else : ?>
        <div class="fts-v2-single-price-card">
            <div class="fts-v2-booking-form-wrap">
                <?php do_action( 'wp_travel_engine_trip_price' ); ?>
            </div>
        </div>
        <?php endif; ?>
    </section>

    <!-- ==================== PHOTO GALLERY ==================== -->
    <?php if ( $has_gallery ) : ?>
    <section id="fts-v2-sec-gallery" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html__( 'Photo Gallery', 'fts' ); ?></h2>
        <div class="fts-v2-photo-grid">
            <?php foreach ( array_slice( $all_images, 0, 8 ) as $gi => $gimg_id ) :
                $gimg_url  = wp_get_attachment_image_url( $gimg_id, 'medium_large' );
                $gimg_full = wp_get_attachment_image_url( $gimg_id, 'full' );
                $gimg_alt  = get_post_meta( $gimg_id, '_wp_attachment_image_alt', true ) ?: '';
                if ( ! $gimg_url ) continue;
            ?>
            <div class="fts-v2-photo-item" data-full="<?php echo esc_url( $gimg_full ); ?>">
                <img src="<?php echo esc_url( $gimg_url ); ?>" alt="<?php echo esc_attr( $gimg_alt ); ?>" loading="lazy">
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

    <!-- ==================== REVIEWS ==================== -->
    <?php if ( $has_reviews ) : ?>
    <section id="fts-v2-sec-reviews" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html__( 'What Travelers Say', 'fts' ); ?></h2>

        <?php if ( $review_count > 0 ) : ?>
        <?php
            $stars_dist = array( 1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0 );
            foreach ( (array) $reviews as $rev0 ) {
                $s0 = isset( $rev0['stars'] ) ? intval( $rev0['stars'] ) : 0;
                if ( $s0 < 1 || $s0 > 5 ) continue;
                $stars_dist[ $s0 ]++;
            }
        ?>
        <div class="fts-v2-reviews-shell">
            <div class="fts-v2-reviews-summary">
                <div class="fts-v2-reviews-scoreline">
                    <div class="fts-v2-score-big"><?php echo number_format( (float) $avg_rating, 1 ); ?></div>
                    <div class="fts-v2-score-meta">
                        <div class="fts-v2-score-stars">
                            <?php for ( $i = 1; $i <= 5; $i++ ) : ?>
                                <i class="fa fa-star<?php echo $i <= round( (float) $avg_rating ) ? '' : '-o'; ?>"></i>
                            <?php endfor; ?>
                        </div>
                        <div class="fts-v2-score-count"><?php echo esc_html( sprintf( _n( '%s review', '%s reviews', (int) $review_count, 'fts' ), number_format_i18n( (int) $review_count ) ) ); ?></div>
                    </div>
                </div>
                <div class="fts-v2-reviews-breakdown">
                    <?php for ( $r = 5; $r >= 1; $r-- ) : ?>
                        <?php
                            $cnt = isset( $stars_dist[ $r ] ) ? intval( $stars_dist[ $r ] ) : 0;
                            $pct = $review_count > 0 ? ( $cnt * 100.0 / $review_count ) : 0;
                        ?>
                        <div class="fts-v2-break-row">
                            <div class="fts-v2-break-label"><?php echo esc_html( $r ); ?></div>
                            <div class="fts-v2-break-stars"><i class="fa fa-star"></i></div>
                            <div class="fts-v2-break-bar" aria-hidden="true">
                                <span class="fts-v2-break-fill" style="width: <?php echo esc_attr( max( 0, min( 100, $pct ) ) ); ?>%;"></span>
                            </div>
                            <div class="fts-v2-break-count"><?php echo esc_html( number_format_i18n( $cnt ) ); ?></div>
                        </div>
                    <?php endfor; ?>
                </div>
            </div>
            <?php $fts_reviews_limit = 6; ?>
            <div class="fts-v2-reviews-items" data-limit="<?php echo esc_attr( (int) $fts_reviews_limit ); ?>">
                <?php foreach ( (array) $reviews as $idx => $rev ) : ?>
                    <?php
                        $author = isset( $rev['title'] ) ? (string) $rev['title'] : '';
                        $author = trim( $author ) !== '' ? $author : __( 'Traveler', 'fts' );
                        $first  = mb_strtoupper( mb_substr( $author, 0, 1 ) );
                        $stars  = isset( $rev['stars'] ) ? intval( $rev['stars'] ) : 5;
                        $stars  = $stars >= 1 && $stars <= 5 ? $stars : 5;
                        $d_raw  = isset( $rev['date'] ) ? (string) $rev['date'] : '';
                        $d_txt  = '';
                        if ( $d_raw !== '' ) {
                            $ts = strtotime( $d_raw );
                            if ( $ts ) $d_txt = date_i18n( 'M j, Y', $ts );
                        }
                        $content = isset( $rev['content'] ) ? (string) $rev['content'] : '';
                    ?>
                    <article class="fts-v2-review-item<?php echo $idx >= $fts_reviews_limit ? ' is-hidden' : ''; ?>">
                        <div class="fts-v2-review-top">
                            <div class="fts-v2-review-avatar"><?php echo esc_html( $first !== '' ? $first : 'R' ); ?></div>
                            <div class="fts-v2-review-head">
                                <div class="fts-v2-review-headline">
                                    <strong class="fts-v2-review-name"><?php echo esc_html( $author ); ?></strong>
                                    <?php if ( $d_txt !== '' ) : ?>
                                        <span class="fts-v2-review-date"><?php echo esc_html( $d_txt ); ?></span>
                                    <?php endif; ?>
                                </div>
                                <div class="fts-v2-review-stars">
                                    <?php for ( $s = 1; $s <= 5; $s++ ) : ?>
                                        <i class="fa fa-star<?php echo $s <= $stars ? '' : '-o'; ?>"></i>
                                    <?php endfor; ?>
                                </div>
                            </div>
                        </div>
                        <div class="fts-v2-review-body">
                            <p class="fts-v2-review-text"><?php echo esc_html( wp_trim_words( $content, 45 ) ); ?></p>
                        </div>
                    </article>
                <?php endforeach; ?>
                <?php if ( $review_count > $fts_reviews_limit ) : ?>
                    <div class="fts-v2-reviews-actions">
                        <button type="button" class="fts-v2-reviews-toggle" data-state="collapsed" data-more="<?php echo esc_attr__( 'View all reviews', 'fts' ); ?>" data-less="<?php echo esc_attr__( 'Show less', 'fts' ); ?>">
                            <?php echo esc_html__( 'View all reviews', 'fts' ); ?>
                        </button>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        <?php endif; ?>

        <?php if ( $review_count <= 0 && ! empty( $reviews_tab_content ) ) : ?>
        <div class="fts-v2-reviews-tab-content">
            <?php echo do_shortcode( $reviews_tab_content ); ?>
        </div>
        <?php endif; ?>

    </section>
    <?php endif; ?>

    <!-- ==================== FAQ ==================== -->
    <?php if ( $has_faq ) : ?>
    <section id="fts-v2-sec-faq" class="fts-v2-section">
        <h2 class="fts-v2-section-title"><?php echo esc_html__( 'Frequently Asked Questions', 'fts' ); ?></h2>
        <div class="fts-v2-faq-list">
            <?php foreach ( $faq_titles as $key => $faq_title ) : if ( empty( $faq_title ) ) continue; ?>
            <div class="fts-v2-faq-item">
                <div class="fts-v2-faq-question">
                    <span><?php echo esc_html( $faq_title ); ?></span>
                    <i class="fa fa-chevron-down"></i>
                </div>
                <?php if ( ! empty( $faq_content[ $key ] ) ) : ?>
                <div class="fts-v2-faq-answer">
                    <?php echo wp_kses_post( $faq_content[ $key ] ); ?>
                </div>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php endif; ?>

</div>
