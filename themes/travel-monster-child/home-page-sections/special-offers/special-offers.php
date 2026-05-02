<?php
/**
 * FTS Special Offers Section — Handpicked deals displayed on the homepage.
 *
 * Trips are selected from a dedicated WP-Admin page (Special Offers).
 * Prices, discount %, images, and destinations are pulled automatically.
 * Badge type and offer end date are set manually per trip.
 *
 * Shortcode: [fts_special_offers]
 * Customizer: FTS Special Offers
 * Admin page: WP Admin → Special Offers
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

require_once __DIR__ . '/admin/special-offers-admin.php';

class FTS_Special_Offers_Section {

    const OPTION_KEY = 'fts_special_offers';

    private static $badge_map = array(
        'limited_seats' => 'LIMITED SEATS',
        'best_seller'   => 'BEST SELLER',
        'hot_deal'      => 'HOT DEAL',
    );

    public static function init() {
        FTS_Special_Offers_Admin::init();

        add_action( 'customize_register', array( __CLASS__, 'customizer' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_special_offers', array( __CLASS__, 'render' ) );
    }

    /* ── Customizer ─────────────────────────────────────── */

    public static function customizer( $wp_customize ) {
        $wp_customize->add_section( 'fts_special_offers_settings', array(
            'title'    => __( 'FTS Special Offers', 'fts' ),
            'priority' => 34,
        ) );

        $fields = array(
            'fts_so_label'      => array( 'Special Offers', __( 'Section Label (orange)', 'fts' ) ),
            'fts_so_heading'    => array( "Deals You Don't Want to Miss", __( 'Section Heading', 'fts' ) ),
            'fts_so_view_url'   => array( '', __( 'View All Offers URL (leave empty to hide)', 'fts' ) ),
            'fts_so_view_text'  => array( 'View All Offers', __( 'View All Link Text', 'fts' ) ),
        );

        foreach ( $fields as $key => $meta ) {
            $wp_customize->add_setting( $key, array(
                'default'           => $meta[0],
                'sanitize_callback' => 'sanitize_text_field',
            ) );
            $wp_customize->add_control( $key, array(
                'label'   => $meta[1],
                'section' => 'fts_special_offers_settings',
                'type'    => 'text',
            ) );
        }
    }

    /* ── Assets ─────────────────────────────────────────── */

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/special-offers';
        $path = get_stylesheet_directory()     . '/home-page-sections/special-offers';

        wp_enqueue_style(
            'fts-special-offers-css',
            $base . '/css/special-offers.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/special-offers.css' ) ? filemtime( $path . '/css/special-offers.css' ) : null
        );

        wp_enqueue_script(
            'fts-special-offers-js',
            $base . '/js/special-offers.js',
            array(),
            file_exists( $path . '/js/special-offers.js' ) ? filemtime( $path . '/js/special-offers.js' ) : null,
            true
        );
    }

    /* ── Price Helpers ──────────────────────────────────── */

    private static function get_trip_pricing( $trip_id ) {
        $price = 0;
        $sale_price = 0;
        $has_sale = false;

        if ( class_exists( '\WPTravelEngine\Core\Models\Post\Trip' ) ) {
            try {
                $trip_obj = new \WPTravelEngine\Core\Models\Post\Trip( get_post( $trip_id ) );
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
            ? fts_v2_get_active_currency_symbol()
            : '$';

        return compact( 'price', 'sale_price', 'has_sale', 'display_price', 'old_price', 'discount_pct', 'symbol' );
    }

    private static function get_trip_destination( $trip_id ) {
        $terms = wp_get_post_terms( $trip_id, 'destination', array( 'fields' => 'all' ) );
        if ( empty( $terms ) || is_wp_error( $terms ) ) return '';
        usort( $terms, function ( $a, $b ) {
            return count( get_ancestors( $a->term_id, 'destination' ) )
                 - count( get_ancestors( $b->term_id, 'destination' ) );
        } );
        return $terms[0]->name;
    }

    /* ── Badge SVG Icons ────────────────────────────────── */

    private static function badge_icon( $type ) {
        if ( $type === 'best_seller' ) {
            return '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
        }
        return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    }

    /* ── Shortcode Render ───────────────────────────────── */

    public static function render() {
        $offers = get_option( self::OPTION_KEY, array() );
        if ( empty( $offers ) || ! is_array( $offers ) ) return '';

        usort( $offers, function ( $a, $b ) {
            return ( $a['order'] ?? 0 ) - ( $b['order'] ?? 0 );
        } );

        $cards = array();
        foreach ( $offers as $offer ) {
            $trip_id = absint( $offer['trip_id'] ?? 0 );
            if ( ! $trip_id ) continue;

            $post = get_post( $trip_id );
            if ( ! $post || $post->post_status !== 'publish' ) continue;

            $pricing     = self::get_trip_pricing( $trip_id );
            $destination = self::get_trip_destination( $trip_id );
            $thumb       = get_the_post_thumbnail_url( $trip_id, 'large' );
            $excerpt     = '';

            if ( function_exists( 'wptravelengine_get_the_trip_excerpt' ) ) {
                $excerpt = wptravelengine_get_the_trip_excerpt( $trip_id );
            }
            if ( ! $excerpt ) {
                $excerpt = get_the_excerpt( $trip_id );
            }
            $excerpt = wp_trim_words( wp_strip_all_tags( $excerpt ), 12, '...' );

            $days_left = 0;
            $end_date  = $offer['end_date'] ?? '';
            if ( $end_date ) {
                $diff = strtotime( $end_date ) - time();
                $days_left = $diff > 0 ? (int) ceil( $diff / 86400 ) : 0;
            }

            $cards[] = array(
                'trip_id'     => $trip_id,
                'title'       => get_the_title( $trip_id ),
                'url'         => get_permalink( $trip_id ),
                'thumb'       => $thumb,
                'destination' => $destination,
                'excerpt'     => $excerpt,
                'pricing'     => $pricing,
                'badge'       => sanitize_text_field( $offer['badge'] ?? '' ),
                'days_left'   => $days_left,
                'end_date'    => $end_date,
            );
        }

        if ( empty( $cards ) ) return '';

        $label     = get_theme_mod( 'fts_so_label', 'Special Offers' );
        $heading   = get_theme_mod( 'fts_so_heading', "Deals You Don't Want to Miss" );
        $view_url  = get_theme_mod( 'fts_so_view_url', '' );
        $view_text = get_theme_mod( 'fts_so_view_text', 'View All Offers' );

        ob_start();
        ?>
        <section class="fts-special-offers">
            <div class="fts-special-offers-inner">

                <!-- Header -->
                <div class="fts-so-header">
                    <div class="fts-so-header-left">
                        <?php if ( $label ) : ?>
                        <span class="fts-so-label">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                            </svg>
                            <?php echo esc_html( strtoupper( $label ) ); ?>
                        </span>
                        <?php endif; ?>
                        <h2 class="fts-so-heading"><?php echo esc_html( $heading ); ?></h2>
                    </div>
                    <div class="fts-so-header-right">
                        <?php if ( $view_url ) : ?>
                        <a href="<?php echo esc_url( $view_url ); ?>" class="fts-so-view-all">
                            <?php echo esc_html( $view_text ); ?>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </a>
                        <?php endif; ?>
                        <div class="fts-so-arrows">
                            <button type="button" class="fts-so-arrow fts-so-arrow--prev" aria-label="<?php esc_attr_e( 'Previous', 'fts' ); ?>">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <button type="button" class="fts-so-arrow fts-so-arrow--next" aria-label="<?php esc_attr_e( 'Next', 'fts' ); ?>">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Carousel -->
                <div class="fts-so-viewport">
                    <div class="fts-so-track">
                        <?php foreach ( $cards as $card ) : $p = $card['pricing']; ?>
                        <div class="fts-so-card">

                            <!-- Image -->
                            <a href="<?php echo esc_url( $card['url'] ); ?>" class="fts-so-card-image-wrap">
                                <?php if ( $card['thumb'] ) : ?>
                                    <img src="<?php echo esc_url( $card['thumb'] ); ?>" alt="<?php echo esc_attr( $card['title'] ); ?>" class="fts-so-card-img" loading="lazy" />
                                <?php endif; ?>

                                <?php if ( ! empty( $card['badge'] ) && isset( self::$badge_map[ $card['badge'] ] ) ) : ?>
                                <span class="fts-so-badge fts-so-badge--type">
                                    <?php echo self::badge_icon( $card['badge'] ); ?>
                                    <?php echo esc_html( self::$badge_map[ $card['badge'] ] ); ?>
                                </span>
                                <?php endif; ?>

                                <?php if ( $p['discount_pct'] > 0 ) : ?>
                                <span class="fts-so-badge fts-so-badge--discount">
                                    <?php echo esc_html( $p['discount_pct'] . '% OFF' ); ?>
                                </span>
                                <?php endif; ?>

                                <?php if ( $card['days_left'] > 0 ) : ?>
                                <span class="fts-so-countdown">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <?php echo esc_html( sprintf(
                                        _n( 'Offer ends in %d day', 'Offer ends in %d days', $card['days_left'], 'fts' ),
                                        $card['days_left']
                                    ) ); ?>
                                </span>
                                <?php endif; ?>
                            </a>

                            <!-- Body -->
                            <div class="fts-so-card-body">
                                <?php if ( $card['destination'] ) : ?>
                                <span class="fts-so-card-dest">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    <?php echo esc_html( $card['destination'] ); ?>
                                </span>
                                <?php endif; ?>

                                <h3 class="fts-so-card-title">
                                    <a href="<?php echo esc_url( $card['url'] ); ?>"><?php echo esc_html( $card['title'] ); ?></a>
                                </h3>

                                <?php if ( $card['excerpt'] ) : ?>
                                    <p class="fts-so-card-excerpt"><?php echo esc_html( $card['excerpt'] ); ?></p>
                                <?php endif; ?>

                                <div class="fts-so-card-footer">
                                    <div class="fts-so-card-prices">
                                        <?php if ( $p['old_price'] > 0 ) : ?>
                                            <span class="fts-so-card-old-price"><?php echo esc_html( $p['symbol'] . number_format( $p['old_price'], 0 ) ); ?></span>
                                        <?php endif; ?>
                                        <div class="fts-so-card-current">
                                            <span class="fts-so-card-from"><?php esc_html_e( 'From', 'fts' ); ?></span>
                                            <span class="fts-so-card-price"><?php echo esc_html( $p['symbol'] . number_format( $p['display_price'], 0 ) ); ?></span>
                                        </div>
                                    </div>
                                    <a href="<?php echo esc_url( $card['url'] ); ?>" class="fts-so-card-btn">
                                        <?php esc_html_e( 'Book Now', 'fts' ); ?>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    <div class="fts-so-fade"></div>
                </div>

            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_Special_Offers_Section::init();
