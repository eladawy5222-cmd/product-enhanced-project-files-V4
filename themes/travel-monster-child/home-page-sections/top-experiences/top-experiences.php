<?php
/**
 * FTS Top Experiences Section — Curated trip carousel with social proof.
 *
 * Trips are selected from a dedicated WP-Admin page (Top Experiences).
 * Prices, ratings, duration, images, and destinations are pulled automatically.
 * Badge type is set manually per trip.
 *
 * Shortcode: [fts_top_experiences]
 * Customizer: FTS Top Experiences
 * Admin page: WP Admin → Top Experiences
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

require_once __DIR__ . '/admin/top-experiences-admin.php';

class FTS_Top_Experiences_Section {

    const OPTION_KEY = 'fts_top_experiences';

    private static $badge_map = array(
        'best_seller' => 'BEST SELLER',
        'top_rated'   => 'TOP RATED',
        'hot_deal'    => 'HOT DEAL',
    );

    public static function init() {
        FTS_Top_Experiences_Admin::init();

        add_action( 'customize_register', array( __CLASS__, 'customizer' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_top_experiences', array( __CLASS__, 'render' ) );
    }

    /* ── Customizer ─────────────────────────────────────── */

    public static function customizer( $wp_customize ) {
        $wp_customize->add_section( 'fts_top_experiences_settings', array(
            'title'    => __( 'FTS Top Experiences', 'fts' ),
            'priority' => 35,
        ) );

        $text_fields = array(
            'fts_te_label'         => array( 'Top Experiences', __( 'Section Label (orange)', 'fts' ) ),
            'fts_te_heading'       => array( 'Best Egypt Excursions & Day Tours', __( 'Section Heading', 'fts' ) ),
            'fts_te_view_url'      => array( '', __( 'View All URL (empty to hide)', 'fts' ) ),
            'fts_te_view_text'     => array( 'View All Trips', __( 'View All Link Text', 'fts' ) ),
            'fts_te_trending_text' => array( 'Trending in Egypt', __( 'Trending Text', 'fts' ) ),
        );

        foreach ( $text_fields as $key => $meta ) {
            $wp_customize->add_setting( $key, array(
                'default'           => $meta[0],
                'sanitize_callback' => 'sanitize_text_field',
            ) );
            $wp_customize->add_control( $key, array(
                'label'   => $meta[1],
                'section' => 'fts_top_experiences_settings',
                'type'    => 'text',
            ) );
        }

        $num_fields = array(
            'fts_te_viewers_min' => array( 15, __( 'Viewers Min', 'fts' ) ),
            'fts_te_viewers_max' => array( 50, __( 'Viewers Max', 'fts' ) ),
        );

        foreach ( $num_fields as $key => $meta ) {
            $wp_customize->add_setting( $key, array(
                'default'           => $meta[0],
                'sanitize_callback' => 'absint',
            ) );
            $wp_customize->add_control( $key, array(
                'label'       => $meta[1],
                'section'     => 'fts_top_experiences_settings',
                'type'        => 'number',
                'input_attrs' => array( 'min' => 1, 'max' => 200 ),
            ) );
        }
    }

    /* ── Assets ─────────────────────────────────────────── */

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/top-experiences';
        $path = get_stylesheet_directory()     . '/home-page-sections/top-experiences';

        wp_enqueue_style(
            'fts-top-experiences-css',
            $base . '/css/top-experiences.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/top-experiences.css' ) ? filemtime( $path . '/css/top-experiences.css' ) : null
        );

        wp_enqueue_script(
            'fts-top-experiences-js',
            $base . '/js/top-experiences.js',
            array(),
            file_exists( $path . '/js/top-experiences.js' ) ? filemtime( $path . '/js/top-experiences.js' ) : null,
            true
        );

        wp_localize_script( 'fts-top-experiences-js', 'ftsTE', array(
            'viewersMin' => absint( get_theme_mod( 'fts_te_viewers_min', 15 ) ),
            'viewersMax' => absint( get_theme_mod( 'fts_te_viewers_max', 50 ) ),
        ) );
    }

    /* ── Pricing Helper (shared pattern with Special Offers) ── */

    private static function get_trip_pricing( $trip_id ) {
        $price = 0; $sale_price = 0; $has_sale = false;

        if ( class_exists( '\WPTravelEngine\Core\Models\Post\Trip' ) ) {
            try {
                $trip_obj   = new \WPTravelEngine\Core\Models\Post\Trip( get_post( $trip_id ) );
                $price      = method_exists( $trip_obj, 'get_price' )      ? $trip_obj->get_price()      : 0;
                $sale_price = method_exists( $trip_obj, 'get_sale_price' ) ? $trip_obj->get_sale_price() : 0;
                $has_sale   = method_exists( $trip_obj, 'has_sale' )       ? $trip_obj->has_sale()       : false;
            } catch ( \Throwable $e ) {}
        }

        if ( ! $price ) {
            $price      = floatval( get_post_meta( $trip_id, 'wp_travel_engine_setting_trip_price', true ) );
            $sale_price = floatval( get_post_meta( $trip_id, 'wp_travel_engine_setting_trip_prev_price', true ) );
            $has_sale   = ( $sale_price > 0 && $sale_price < $price );
        }

        if ( function_exists( 'fts_v2_convert_price' ) ) {
            $price      = fts_v2_convert_price( $price );
            $sale_price = fts_v2_convert_price( $sale_price );
        }

        $display_price = $has_sale ? $sale_price : $price;
        $old_price     = $has_sale ? $price : 0;
        $discount_pct  = ( $has_sale && $price > 0 ) ? round( ( ( $price - $sale_price ) / $price ) * 100 ) : 0;

        $symbol = function_exists( 'fts_v2_get_active_currency_symbol' )
            ? fts_v2_get_active_currency_symbol() : '$';

        return compact( 'price', 'sale_price', 'has_sale', 'display_price', 'old_price', 'discount_pct', 'symbol' );
    }

    /* ── Duration Helper ────────────────────────────────── */

    private static function get_trip_duration( $trip_id ) {
        $settings = get_post_meta( $trip_id, 'wp_travel_engine_setting', true );
        if ( ! is_array( $settings ) ) return '';

        $dur  = $settings['trip_duration'] ?? '';
        $unit = $settings['trip_duration_unit'] ?? 'days';
        $dur_i = is_numeric( $dur ) ? intval( $dur ) : 0;
        if ( $dur_i <= 0 ) return '';

        $key = strtolower( (string) $unit );
        if ( $key === 'hours' || $key === 'hour' ) {
            $label = _n( 'Hour', 'Hours', $dur_i, 'fts' );
        } elseif ( $key === 'weeks' || $key === 'week' ) {
            $label = _n( 'Week', 'Weeks', $dur_i, 'fts' );
        } else {
            $label = _n( 'Day', 'Days', $dur_i, 'fts' );
        }

        return $dur_i . ' ' . $label;
    }

    /* ── Destination Helper ─────────────────────────────── */

    private static function get_trip_destination( $trip_id ) {
        $terms = wp_get_post_terms( $trip_id, 'destination', array( 'fields' => 'all' ) );
        if ( empty( $terms ) || is_wp_error( $terms ) ) return '';
        usort( $terms, function ( $a, $b ) {
            return count( get_ancestors( $a->term_id, 'destination' ) )
                 - count( get_ancestors( $b->term_id, 'destination' ) );
        } );
        $names = wp_list_pluck( $terms, 'name' );
        return strtoupper( implode( ', ', $names ) );
    }

    /* ── Reviews Helper ─────────────────────────────────── */

    private static function get_trip_reviews( $trip_id ) {
        if ( function_exists( 'wptravelengine_reviews_get_trip_reviews' ) ) {
            $data = wptravelengine_reviews_get_trip_reviews( $trip_id );
            return array(
                'average' => floatval( $data['average'] ?? 0 ),
                'count'   => intval( $data['count'] ?? 0 ),
            );
        }
        return array( 'average' => 0, 'count' => 0 );
    }

    /* ── Star SVGs ──────────────────────────────────────── */

    private static function render_stars( $avg ) {
        $full  = (int) floor( $avg );
        $half  = ( $avg - $full ) >= 0.3 ? 1 : 0;
        $empty = 5 - $full - $half;
        $html  = '';

        $star_full = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
        $star_half = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="1"><defs><linearGradient id="sh"><stop offset="50%" stop-color="#fbbf24"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#sh)"/></svg>';
        $star_empty = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

        for ( $i = 0; $i < $full; $i++ )  $html .= $star_full;
        for ( $i = 0; $i < $half; $i++ )  $html .= $star_half;
        for ( $i = 0; $i < $empty; $i++ ) $html .= $star_empty;

        return $html;
    }

    /* ── Shortcode Render ───────────────────────────────── */

    public static function render() {
        $items = get_option( self::OPTION_KEY, array() );
        if ( empty( $items ) || ! is_array( $items ) ) return '';

        usort( $items, function ( $a, $b ) {
            return ( $a['order'] ?? 0 ) - ( $b['order'] ?? 0 );
        } );

        $cards = array();
        foreach ( $items as $item ) {
            $trip_id = absint( $item['trip_id'] ?? 0 );
            if ( ! $trip_id ) continue;
            $post = get_post( $trip_id );
            if ( ! $post || $post->post_status !== 'publish' ) continue;

            $pricing     = self::get_trip_pricing( $trip_id );
            $destination = self::get_trip_destination( $trip_id );
            $duration    = self::get_trip_duration( $trip_id );
            $reviews     = self::get_trip_reviews( $trip_id );
            $thumb       = get_the_post_thumbnail_url( $trip_id, 'large' );
            $is_featured = get_post_meta( $trip_id, 'wp_travel_engine_featured_trip', true ) === 'yes';

            $cards[] = array(
                'trip_id'     => $trip_id,
                'title'       => get_the_title( $trip_id ),
                'url'         => get_permalink( $trip_id ),
                'thumb'       => $thumb,
                'destination' => $destination,
                'duration'    => $duration,
                'pricing'     => $pricing,
                'reviews'     => $reviews,
                'badge'       => sanitize_text_field( $item['badge'] ?? '' ),
                'is_featured' => $is_featured,
            );
        }

        if ( empty( $cards ) ) return '';

        $label         = get_theme_mod( 'fts_te_label', 'Top Experiences' );
        $heading       = get_theme_mod( 'fts_te_heading', 'Best Egypt Excursions & Day Tours' );
        $view_url      = get_theme_mod( 'fts_te_view_url', '' );
        $view_text     = get_theme_mod( 'fts_te_view_text', 'View All Trips' );
        $trending_text = get_theme_mod( 'fts_te_trending_text', 'Trending in Egypt' );

        ob_start();
        ?>
        <section class="fts-top-exp">
            <div class="fts-top-exp-inner">

                <!-- Header -->
                <div class="fts-te-header">
                    <div class="fts-te-header-left">
                        <?php if ( $label ) : ?>
                        <span class="fts-te-label">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            <?php echo esc_html( strtoupper( $label ) ); ?>
                        </span>
                        <?php endif; ?>
                        <h2 class="fts-te-heading"><?php echo esc_html( $heading ); ?></h2>
                    </div>
                    <div class="fts-te-header-right">
                        <?php if ( $view_url ) : ?>
                        <a href="<?php echo esc_url( $view_url ); ?>" class="fts-te-view-all">
                            <?php echo esc_html( $view_text ); ?>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </a>
                        <?php endif; ?>
                        <div class="fts-te-arrows">
                            <button type="button" class="fts-te-arrow fts-te-arrow--prev" aria-label="<?php esc_attr_e( 'Previous', 'fts' ); ?>">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <button type="button" class="fts-te-arrow fts-te-arrow--next" aria-label="<?php esc_attr_e( 'Next', 'fts' ); ?>">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Social Proof Bar -->
                <div class="fts-te-proof-bar">
                    <span class="fts-te-proof-item fts-te-proof-viewers">
                        <span class="fts-te-proof-dot"></span>
                        <span class="fts-te-proof-num" data-type="viewers">24</span>
                        <?php esc_html_e( 'people viewing now', 'fts' ); ?>
                    </span>
                    <span class="fts-te-proof-item fts-te-proof-booked">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
                        <?php esc_html_e( 'Last booked', 'fts' ); ?>
                        <strong><span class="fts-te-proof-num" data-type="booked">8</span> <?php esc_html_e( 'min ago', 'fts' ); ?></strong>
                    </span>
                    <?php if ( $trending_text ) : ?>
                    <span class="fts-te-proof-item fts-te-proof-trending">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        <?php echo esc_html( $trending_text ); ?>
                    </span>
                    <?php endif; ?>
                </div>

                <!-- Carousel -->
                <div class="fts-te-viewport">
                    <div class="fts-te-track">
                        <?php foreach ( $cards as $card ) : $p = $card['pricing']; $r = $card['reviews']; ?>
                        <div class="fts-te-card">

                            <a href="<?php echo esc_url( $card['url'] ); ?>" class="fts-te-card-image-wrap">
                                <?php if ( $card['thumb'] ) : ?>
                                    <img src="<?php echo esc_url( $card['thumb'] ); ?>" alt="<?php echo esc_attr( $card['title'] ); ?>" class="fts-te-card-img" loading="lazy" />
                                <?php endif; ?>

                                <?php if ( $card['is_featured'] ) : ?>
                                <span class="fts-te-badge fts-te-badge--featured"><?php esc_html_e( 'FEATURED', 'fts' ); ?></span>
                                <?php endif; ?>

                                <?php if ( ! empty( $card['badge'] ) && isset( self::$badge_map[ $card['badge'] ] ) ) : ?>
                                <span class="fts-te-badge fts-te-badge--type"><?php echo esc_html( self::$badge_map[ $card['badge'] ] ); ?></span>
                                <?php endif; ?>

                                <?php if ( $p['discount_pct'] > 0 ) : ?>
                                <span class="fts-te-badge fts-te-badge--discount"><?php echo esc_html( $p['discount_pct'] . '% OFF' ); ?></span>
                                <?php endif; ?>

                                <?php if ( $card['duration'] ) : ?>
                                <span class="fts-te-duration">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <?php echo esc_html( $card['duration'] ); ?>
                                </span>
                                <?php endif; ?>
                            </a>

                            <div class="fts-te-card-body">
                                <?php if ( $card['destination'] ) : ?>
                                <span class="fts-te-card-dest">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <?php echo esc_html( $card['destination'] ); ?>
                                </span>
                                <?php endif; ?>

                                <h3 class="fts-te-card-title">
                                    <a href="<?php echo esc_url( $card['url'] ); ?>"><?php echo esc_html( $card['title'] ); ?></a>
                                </h3>

                                <?php if ( $r['average'] > 0 ) : ?>
                                <div class="fts-te-card-rating">
                                    <span class="fts-te-card-stars"><?php echo self::render_stars( $r['average'] ); ?></span>
                                    <span class="fts-te-card-avg"><?php echo esc_html( number_format( $r['average'], 1 ) ); ?></span>
                                    <span class="fts-te-card-count">(<?php echo esc_html( number_format( $r['count'] ) ); ?>)</span>
                                </div>
                                <?php endif; ?>

                                <div class="fts-te-card-footer">
                                    <div class="fts-te-card-prices">
                                        <?php if ( $p['old_price'] > 0 ) : ?>
                                            <span class="fts-te-card-old-price"><?php echo esc_html( $p['symbol'] . number_format( $p['old_price'], 0 ) ); ?></span>
                                        <?php endif; ?>
                                        <div class="fts-te-card-current">
                                            <span class="fts-te-card-from"><?php esc_html_e( 'From', 'fts' ); ?></span>
                                            <span class="fts-te-card-price"><?php echo esc_html( $p['symbol'] . number_format( $p['display_price'], 0 ) ); ?></span>
                                        </div>
                                    </div>
                                    <a href="<?php echo esc_url( $card['url'] ); ?>" class="fts-te-card-link">
                                        <?php esc_html_e( 'View Trip', 'fts' ); ?>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <div class="fts-te-fade"></div>
                </div>

            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_Top_Experiences_Section::init();
