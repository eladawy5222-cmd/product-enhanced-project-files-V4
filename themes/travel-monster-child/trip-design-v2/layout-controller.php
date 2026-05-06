<?php
/**
 * Layout Controller V2 for FTS Single Trip Redesign
 *
 * Centralizes data fetching, manages hook removal, and renders
 * the premium landing page layout for single trip pages.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! function_exists( 'wte_get_formated_price' ) ) {
    function wte_get_formated_price( $price ) {
        $symbol = fts_v2_get_active_currency_symbol();
        $n = floatval( $price );
        return $symbol . number_format( $n, 0 );
    }
}

if ( ! function_exists( 'fts_v2_get_active_currency_code' ) ) {
    function fts_v2_get_active_currency_code() {
        $cc = isset( $_COOKIE['cc_code'] ) ? sanitize_text_field( $_COOKIE['cc_code'] ) : '';
        if ( ! empty( $cc ) ) return $cc;
        $cc = isset( $_COOKIE['wte_currency_code'] ) ? sanitize_text_field( $_COOKIE['wte_currency_code'] ) : '';
        if ( ! empty( $cc ) ) return $cc;
        $wte_opts = get_option( 'wp_travel_engine_settings', array() );
        return $wte_opts['currency_code'] ?? 'USD';
    }
}

if ( ! function_exists( 'fts_v2_get_currency_symbol' ) ) {
    function fts_v2_get_currency_symbol( $code ) {
        $code = is_string( $code ) ? trim( $code ) : '';
        if ( $code === '' ) return '';
        if ( function_exists( 'wp_travel_engine_get_currency_symbol' ) ) {
            $raw = (string) wp_travel_engine_get_currency_symbol( $code );
            if ( $raw !== '' ) {
                return html_entity_decode( $raw, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
            }
        }
        return $code;
    }
}

if ( ! function_exists( 'fts_v2_get_active_currency_symbol' ) ) {
    function fts_v2_get_active_currency_symbol() {
        return fts_v2_get_currency_symbol( fts_v2_get_active_currency_code() );
    }
}

if ( ! function_exists( 'fts_v2_convert_price' ) ) {
    function fts_v2_convert_price( $price ) {
        if ( ! class_exists( 'Wte_Currency_Converter_Helper_Functions' ) ) return $price;
        $helper = \Wte_Currency_Converter_Helper_Functions::get_instance();
        if ( ! $helper->is_currency_converter_enabled() ) return $price;
        $to_code = fts_v2_get_active_currency_code();
        $base_code = function_exists( 'wte_currency_code_in_db' ) ? wte_currency_code_in_db() : 'USD';
        if ( $to_code === $base_code ) return $price;
        return round( $helper->get_price( $base_code, $to_code, floatval( $price ) ), 2 );
    }
}

if ( ! function_exists( 'fts_v2_safe_sprintf' ) ) {
    function fts_v2_safe_sprintf( $format, $args, $fallback = '' ) {
        try {
            return vsprintf( (string) $format, (array) $args );
        } catch ( \Throwable $e ) {
            return $fallback !== '' ? (string) $fallback : (string) $format;
        }
    }
}

class FTS_Trip_Redesign_V2 {

    private static $debug     = false;
    private static $trip_data = null;

    private static function safe_sprintf( $format, $args, $fallback = '' ) {
        try {
            return vsprintf( (string) $format, (array) $args );
        } catch ( \Throwable $e ) {
            return $fallback !== '' ? (string) $fallback : (string) $format;
        }
    }

    private static function infer_traveler_role( $label, $term_id = 0 ) {
        $txt = strtolower( trim( (string) $label ) );
        if ( $txt !== '' ) {
            if ( preg_match( '/adult|adults|adulto|adultos|erwachsen|erwachsene|adulte|adultes|volwassen|volwassene/u', $txt ) ) return 'adult';
            if ( preg_match( '/child|children|niñ|nino|nina|kind|kinder|enfant|infant|infantil|junior/u', $txt ) ) return 'child';
        }
        if ( $term_id ) {
            $term = get_term( intval( $term_id ) );
            if ( $term && ! is_wp_error( $term ) ) {
                $probe = strtolower( (string) ( $term->slug . ' ' . $term->name ) );
                if ( preg_match( '/adult|adults|adulto|adultos|erwachsen|erwachsene|adulte|adultes|volwassen|volwassene/u', $probe ) ) return 'adult';
                if ( preg_match( '/child|children|niñ|nino|nina|kind|kinder|enfant|infant|infantil|junior/u', $probe ) ) return 'child';
            }
        }
        return '';
    }

    public static function init() {
        add_action( 'template_redirect', array( __CLASS__, 'cleanup_and_setup' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 99 );
        add_filter( 'gettext', array( __CLASS__, 'filter_booking_button_text' ), 10, 3 );
        add_action( 'wp_body_open', array( __CLASS__, 'render_global_header' ), 5 );
        add_action( 'rest_api_init', array( __CLASS__, 'register_trustindex_rest_route' ) );

        add_filter( 'rocket_exclude_js', array( __CLASS__, 'wp_rocket_exclude_js' ) );
        add_filter( 'rocket_delay_js_exclusions', array( __CLASS__, 'wp_rocket_exclude_js' ) );
        add_filter( 'rocket_exclude_defer_js', array( __CLASS__, 'wp_rocket_exclude_js' ) );
        add_filter( 'rocket_rucss_safelist', array( __CLASS__, 'wp_rocket_safelist_css' ) );
    }

    public static function register_trustindex_rest_route() {
        register_rest_route( 'fts/v1', '/trustindex', array(
            'methods'             => 'GET',
            'callback'            => array( __CLASS__, 'rest_get_trustindex' ),
            'permission_callback' => '__return_true',
            'args'                => array(
                'permalink' => array(
                    'required' => true,
                    'type'     => 'string',
                ),
            ),
        ) );
    }

    public static function rest_get_trustindex( $request ) {
        $permalink = trim( (string) $request->get_param( 'permalink' ) );
        $fallback  = '<span class="fts-trustindex-empty" aria-hidden="true"></span>';
        if ( $permalink === '' ) {
            return rest_ensure_response( array( 'html' => $fallback ) );
        }

        $normalized = esc_url_raw( $permalink );
        if ( $normalized === '' ) {
            return rest_ensure_response( array( 'html' => $fallback ) );
        }

        $cache_key = 'fts_tidx_' . md5( $normalized );
        $cached    = get_transient( $cache_key );
        if ( is_string( $cached ) && $cached !== '' ) {
            return rest_ensure_response( array( 'html' => $cached ) );
        }

        $post_id = url_to_postid( $normalized );
        $html    = $fallback;
        if ( $post_id > 0 && get_post_type( $post_id ) === 'trip' ) {
            $code = function_exists( 'get_field' ) ? get_field( 'trustindex_code', $post_id ) : '';
            if ( is_string( $code ) && trim( $code ) !== '' ) {
                $html = $code;
            }
        }

        set_transient( $cache_key, $html, 12 * HOUR_IN_SECONDS );
        return rest_ensure_response( array( 'html' => $html ) );
    }

    public static function wp_rocket_exclude_js( $excluded ) {
        $excluded[] = 'script-v2.js';
        $excluded[] = 'header-bar.js';
        $excluded[] = 'destination-v2.js';
        $excluded[] = 'jquery-ui-datepicker';
        $excluded[] = '/wp-content/plugins/wp-travel-engine/assets/lib/flatpickr';
        $excluded[] = '/wp-content/plugins/wp-travel-engine-trip-fixed-starting-dates/';
        $excluded[] = '/wp-content/plugins/wp-travel-engine-trip-reviews/';
        $excluded[] = 'wte-fsd-public.js';
        $excluded[] = 'wte-trip-review-public';
        $excluded[] = '/wp-content/cache/min/1/wp-content/plugins/wp-travel-engine/';
        return $excluded;
    }

    public static function wp_rocket_safelist_css( $safelist ) {
        $safelist[] = '.fts-v2-(.*)';
        $safelist[] = '.fts-dest-v2-(.*)';
        $safelist[] = '.fts-bm-(.*)';
        $safelist[] = '.fts-modern-chat-hub(.*)';
        $safelist[] = 'body.single-trip(.*)';
        return $safelist;
    }

    public static function render_global_header() {
        $file = get_stylesheet_directory() . '/trip-design-v2/parts/trip-header-bar-v2.php';
        if ( file_exists( $file ) ) {
            include $file;
        }
    }

    public static function filter_booking_button_text( $translated, $text, $domain ) {
        if ( $domain === 'wp-travel-engine' && is_singular( 'trip' ) ) {
            if ( $text === 'Continue' ) return __( 'Check Availability', 'fts' );
        }
        return $translated;
    }

    public static function cleanup_and_setup() {
        if ( ! is_singular( 'trip' ) ) return;
        try {
            remove_all_actions( 'wte_single_trip_content' );
            remove_all_actions( 'wte_single_trip_footer' );
            remove_all_actions( 'wp_travel_engine_before_trip_content' );
            remove_all_actions( 'wp_travel_engine_after_trip_content' );
            remove_all_actions( 'wptravelengine_after_trip_title' );
            remove_all_actions( 'wptravelengine_display_trip_gallery' );
        } catch ( \Throwable $e ) {
            error_log( 'FTS V2 cleanup error: ' . $e->getMessage() );
        }
    }

    /* ─────────────────────────────────────────────────
       Centralized Data — fetched once, cached in static
       ───────────────────────────────────────────────── */
    public static function get_trip_data() {
        if ( self::$trip_data !== null ) return self::$trip_data;

        $trip_id  = get_the_ID();
        $settings = get_post_meta( $trip_id, 'wp_travel_engine_setting', true );
        if ( ! is_array( $settings ) ) $settings = array();

        $bold_promise = '';
        if ( array_key_exists( 'bold_promise', $settings ) && is_string( $settings['bold_promise'] ) ) {
            $bold_promise = trim( $settings['bold_promise'] );
        }
        if ( $bold_promise === '' ) {
            $bold_promise = trim( (string) get_post_meta( $trip_id, 'AI_Bold_Promise', true ) );
        }
        if ( $bold_promise === '' ) {
            $bold_promise = trim( (string) get_post_meta( $trip_id, 'ai_bold_promise', true ) );
        }

        $at_a_glance = array();
        $at_raw = null;
        if ( array_key_exists( 'at_a_glance', $settings ) ) $at_raw = $settings['at_a_glance'];
        if ( empty( $at_raw ) ) $at_raw = get_post_meta( $trip_id, 'AI_At_A_Glance', true );
        if ( empty( $at_raw ) ) $at_raw = get_post_meta( $trip_id, 'ai_at_a_glance', true );
        if ( is_array( $at_raw ) ) {
            $at_a_glance = $at_raw;
        } elseif ( is_string( $at_raw ) && trim( $at_raw ) !== '' ) {
            $decoded = json_decode( $at_raw, true );
            if ( is_array( $decoded ) ) $at_a_glance = $decoded;
        }

        $trip_obj = null;
        if ( class_exists( '\WPTravelEngine\Core\Models\Post\Trip' ) ) {
            try {
                $trip_obj = new \WPTravelEngine\Core\Models\Post\Trip( get_post( $trip_id ) );
            } catch ( \Throwable $e ) { $trip_obj = null; }
        }

        // ── Pricing ──
        $price = 0; $sale_price = 0; $has_sale = false;
        if ( $trip_obj ) {
            try {
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
        $display_price = $has_sale ? $sale_price : $price;
        $old_price     = $has_sale ? $price : 0;
        $discount_pct  = ( $has_sale && $price > 0 ) ? round( ( ( $price - $sale_price ) / $price ) * 100 ) : 0;

        // ── Reviews ──
        $review_data = null;
        if ( function_exists( 'wptravelengine_reviews_get_trip_reviews' ) ) {
            $review_data = wptravelengine_reviews_get_trip_reviews( $trip_id );
        }
        $avg_rating   = $review_data['average'] ?? 0;
        $review_count = $review_data['count']   ?? 0;
        $reviews      = $review_data['reviews'] ?? array();

        // ── Custom WTE Tabs ──
        $reviews_tab_content = '';
        $why_love_content    = '';
        $why_love_tab_title  = '';
        $wte_global = get_option( 'wp_travel_engine_settings', array() );
        $trip_tabs  = $wte_global['trip_tabs'] ?? array();
        if ( ! empty( $trip_tabs['name'] ) ) {
            foreach ( $trip_tabs['name'] as $tk => $tname ) {
                $field_type = $trip_tabs['field'][ $tk ] ?? '';
                $tab_id     = $trip_tabs['id'][ $tk ] ?? $tk;

                if ( stripos( $tname, 'review' ) !== false && $field_type === 'wp_editor' ) {
                    $raw_rtc = $settings['tab_content'][ $tab_id . '_wpeditor' ] ?? '';
                    if ( ! empty( trim( $raw_rtc ) ) ) {
                        $reviews_tab_content = $raw_rtc;
                    }
                }

                if ( (string) $tab_id === '8' ) {
                    $why_love_tab_title = trim( $settings['tab_8_title'] ?? $tname );
                    if ( $field_type === 'wp_editor' ) {
                        $raw_wl = $settings['tab_content'][ $tab_id . '_wpeditor' ] ?? '';
                        if ( ! empty( trim( strip_tags( $raw_wl ) ) ) ) {
                            $why_love_content = apply_filters( 'the_content', $raw_wl );
                        }
                    } elseif ( $field_type === 'textarea' ) {
                        $raw_wl = $settings['tab_content'][ $tab_id . '_textarea' ] ?? '';
                        if ( ! empty( trim( $raw_wl ) ) ) {
                            $why_love_content = wpautop( $raw_wl );
                        }
                    }
                } elseif ( stripos( $tname, 'love' ) !== false || stripos( $tname, 'why' ) !== false ) {
                    $why_love_tab_title = trim( $tname );
                    if ( $field_type === 'wp_editor' ) {
                        $raw_wl = $settings['tab_content'][ $tab_id . '_wpeditor' ] ?? '';
                        if ( ! empty( trim( strip_tags( $raw_wl ) ) ) ) {
                            $why_love_content = apply_filters( 'the_content', $raw_wl );
                        }
                    } elseif ( $field_type === 'textarea' ) {
                        $raw_wl = $settings['tab_content'][ $tab_id . '_textarea' ] ?? '';
                        if ( ! empty( trim( $raw_wl ) ) ) {
                            $why_love_content = wpautop( $raw_wl );
                        }
                    }
                }
            }
        }

        $ti_reviews = $settings['tab_content']['9_wpeditor'] ?? '';
        if ( is_string( $ti_reviews ) && trim( $ti_reviews ) !== '' ) {
            $reviews_tab_content = $ti_reviews;
        }

        // ── Duration ──
        $duration      = $settings['trip_duration'] ?? '';
        $duration_unit = $settings['trip_duration_unit'] ?? 'days';
        $nights        = $settings['trip_duration_nights'] ?? '';
        $duration_text = '';
        $duration_i = is_numeric( $duration ) ? intval( $duration ) : 0;
        $nights_i   = is_numeric( $nights ) ? intval( $nights ) : 0;
        if ( $duration_i > 0 ) {
            $unit_key = strtolower( (string) $duration_unit );
            if ( $unit_key === 'hours' || $unit_key === 'hour' ) {
                $unit_label = _n( 'Hour', 'Hours', $duration_i, 'fts' );
            } elseif ( $unit_key === 'weeks' || $unit_key === 'week' ) {
                $unit_label = _n( 'Week', 'Weeks', $duration_i, 'fts' );
            } elseif ( $unit_key === 'months' || $unit_key === 'month' ) {
                $unit_label = _n( 'Month', 'Months', $duration_i, 'fts' );
            } else {
                $unit_label = _n( 'Day', 'Days', $duration_i, 'fts' );
            }

            if ( $nights_i > 0 && ( $unit_key === 'days' || $unit_key === 'day' ) ) {
                $night_label  = _n( 'Night', 'Nights', $nights_i, 'fts' );
                $duration_text = self::safe_sprintf(
                    __( '%1$d %2$s / %3$d %4$s', 'fts' ),
                    array( $duration_i, $unit_label, $nights_i, $night_label ),
                    $duration_i . ' ' . $unit_label . ' / ' . $nights_i . ' ' . $night_label
                );
            } else {
                $duration_text = self::safe_sprintf(
                    __( '%1$d %2$s', 'fts' ),
                    array( $duration_i, $unit_label ),
                    $duration_i . ' ' . $unit_label
                );
            }
        }

        // ── Group Size ──
        $min_pax = $settings['trip_minimum_pax'] ?? '';
        $max_pax = $settings['trip_maximum_pax'] ?? '';
        $group_text = '';
        $min_pax_i = is_numeric( $min_pax ) ? intval( $min_pax ) : 0;
        $max_pax_i = is_numeric( $max_pax ) ? intval( $max_pax ) : 0;
        if ( $min_pax_i > 0 && $max_pax_i > 0 ) {
            $group_text = self::safe_sprintf(
                __( '%1$d-%2$d people', 'fts' ),
                array( $min_pax_i, $max_pax_i ),
                $min_pax_i . '-' . $max_pax_i . ' people'
            );
        } elseif ( $max_pax_i > 0 ) {
            $group_text = self::safe_sprintf(
                __( 'Up to %d people', 'fts' ),
                array( $max_pax_i ),
                'Up to ' . $max_pax_i . ' people'
            );
        }

        // ── Destinations ──
        $destination_terms = wp_get_post_terms( $trip_id, 'destination', array( 'fields' => 'all' ) );
        $location   = '';
        $dest_chain = array();
        if ( ! empty( $destination_terms ) && ! is_wp_error( $destination_terms ) ) {
            usort( $destination_terms, function( $a, $b ) {
                return count( get_ancestors( $a->term_id, 'destination' ) )
                     - count( get_ancestors( $b->term_id, 'destination' ) );
            });
            foreach ( $destination_terms as $dt ) {
                $term_url = get_term_link( $dt );
                $dest_chain[] = array( 'name' => $dt->name, 'url' => is_wp_error( $term_url ) ? '' : $term_url );
            }
            $location = implode( ' → ', wp_list_pluck( $destination_terms, 'name' ) );
        }

        // ── Activities (breadcrumb) ──
        $activity_terms = wp_get_post_terms( $trip_id, 'activities', array( 'fields' => 'names' ) );
        $last_crumb = ( ! empty( $activity_terms ) && ! is_wp_error( $activity_terms ) ) ? $activity_terms[0] : '';

        // ── Gallery ──
        $featured_img_id = get_post_thumbnail_id( $trip_id );
        $gallery_meta    = get_post_meta( $trip_id, 'wpte_gallery_id', true );
        $gallery_ids     = array();
        if ( is_array( $gallery_meta ) ) {
            if ( $gallery_meta['enable'] ?? 1 ) {
                $g = $gallery_meta;
                unset( $g['enable'] );
                $gallery_ids = array_values( array_filter( $g, 'is_numeric' ) );
            }
        }
        $video_url = get_post_meta( $trip_id, '_fts_trip_video_url', true );
        if ( ! $video_url ) $video_url = get_post_meta( $trip_id, '_fts_featured_video_url', true );

        $all_images = array();
        if ( $featured_img_id ) $all_images[] = $featured_img_id;
        foreach ( $gallery_ids as $gid ) {
            $gid = intval( $gid );
            if ( $gid && ! in_array( $gid, $all_images ) ) $all_images[] = $gid;
        }
        $all_urls   = array();
        $all_thumbs = array();
        $all_titles = array();
        foreach ( $all_images as $img_id ) {
            $url = wp_get_attachment_image_url( $img_id, 'full' );
            if ( $url ) {
                $all_urls[]   = $url;
                $all_thumbs[] = wp_get_attachment_image_url( $img_id, 'thumbnail' ) ?: $url;
                $alt = get_post_meta( $img_id, '_wp_attachment_image_alt', true );
                $all_titles[] = $alt ?: get_the_title( $img_id );
            }
        }
        $grid_images  = array_slice( $all_images, 0, 3 );
        $grid_count   = count( $grid_images );
        $extra_photos = count( $all_images ) - $grid_count;

        // ── Overview Content ──
        $overview_content = '';

        $wte_tab_content = $settings['tab_content']['1_wpeditor'] ?? '';
        if ( ! empty( trim( strip_tags( $wte_tab_content ) ) ) ) {
            $overview_content = apply_filters( 'the_content', $wte_tab_content );
        }

        if ( empty( trim( strip_tags( $overview_content ) ) ) ) {
            $raw = get_the_content();
            if ( ! empty( trim( strip_tags( $raw ) ) ) ) {
                $overview_content = apply_filters( 'the_content', $raw );
            }
        }

        if ( empty( trim( strip_tags( $overview_content ) ) ) && ! empty( $settings['overview'] ) ) {
            $overview_content = apply_filters( 'the_content', $settings['overview'] );
        }

        if ( empty( trim( strip_tags( $overview_content ) ) ) ) {
            $raw_content = get_post_field( 'post_content', $trip_id );
            if ( ! empty( $raw_content ) ) $overview_content = apply_filters( 'the_content', $raw_content );
        }

        $overview_content = preg_replace( '/<h[1-3][^>]*>\s*Overview\s*<\/h[1-3]>/i', '', $overview_content );

        $overview_excerpt = '';
        if ( ! empty( trim( strip_tags( $overview_content ) ) ) ) {
            $overview_excerpt = wp_trim_words( strip_tags( $overview_content ), 30, '...' );
        }
        if ( empty( $overview_excerpt ) ) {
            $overview_excerpt = get_the_excerpt() ?: wp_trim_words( get_the_content(), 30, '...' );
        }

        // ── Highlights ──
        $highlights_title = $settings['trip_highlights_title'] ?? '';
        if ( empty( $highlights_title ) ) $highlights_title = __( 'Why People Love This Trip', 'fts' );
        $raw_highlights = $settings['trip_highlights'] ?? array();
        if ( ! is_array( $raw_highlights ) ) $raw_highlights = array();
        $highlights = array();
        foreach ( $raw_highlights as $rh ) {
            if ( is_array( $rh ) && ! empty( $rh['highlight_text'] ) ) {
                $highlights[] = $rh['highlight_text'];
            } elseif ( is_string( $rh ) && ! empty( $rh ) ) {
                $highlights[] = $rh;
            }
        }

        // ── Itinerary ──
        $itinerary       = $settings['itinerary'] ?? array();
        $itin_titles     = $itinerary['itinerary_title'] ?? array();
        $itin_content    = ! empty( $itinerary['itinerary_content_inner'] )
            ? $itinerary['itinerary_content_inner']
            : ( $itinerary['itinerary_content'] ?? array() );
        $itin_days_label = $itinerary['itinerary_days_label'] ?? array();

        // ── Cost ──
        $cost_data     = $settings['cost'] ?? array();
        $cost_includes = $cost_data['cost_includes'] ?? '';
        $cost_excludes = $cost_data['cost_excludes'] ?? '';

        // ── FAQ ──
        $faq_data    = $settings['faq'] ?? array();
        $faq_titles  = $faq_data['faq_title'] ?? array();
        $faq_content = $faq_data['faq_content'] ?? array();

        // ── Trip Facts ──
        $trip_facts_title = $settings['trip_facts_title'] ?? '';
        if ( $trip_facts_title === '' ) $trip_facts_title = esc_html__( 'Trip Facts', 'ftstravels' );
        $trip_facts_items = array();
        $trip_facts_raw = $settings['trip_facts'] ?? array();
        if ( is_array( $trip_facts_raw ) ) {
            $field_ids = ( isset( $trip_facts_raw['field_id'] ) && is_array( $trip_facts_raw['field_id'] ) ) ? $trip_facts_raw['field_id'] : array();
            foreach ( $field_ids as $fid => $label ) {
                $fid = (string) $fid;
                $label = is_string( $label ) ? trim( $label ) : '';
                if ( $fid === '' || $label === '' ) continue;
                $val = '';
                if ( isset( $trip_facts_raw[ $fid ] ) && is_array( $trip_facts_raw[ $fid ] ) ) {
                    if ( isset( $trip_facts_raw[ $fid ][ $fid ] ) ) {
                        $vv = $trip_facts_raw[ $fid ][ $fid ];
                        if ( is_string( $vv ) || is_numeric( $vv ) ) $val = trim( (string) $vv );
                    }
                    if ( $val === '' ) {
                        foreach ( $trip_facts_raw[ $fid ] as $vv2 ) {
                            if ( is_string( $vv2 ) || is_numeric( $vv2 ) ) { $val = trim( (string) $vv2 ); break; }
                        }
                    }
                }
                if ( $val === '' ) continue;
                $icon = 'fa-info-circle';
                $l = strtolower( $label );
                if ( strpos( $l, 'duration' ) !== false || strpos( $l, 'time' ) !== false || strpos( $l, 'length' ) !== false || strpos( $l, 'مدة' ) !== false ) {
                    $icon = 'fa-clock-o';
                } elseif ( strpos( $l, 'pickup' ) !== false || strpos( $l, 'meeting' ) !== false || strpos( $l, 'start' ) !== false || strpos( $l, 'meet' ) !== false || strpos( $l, 'استلام' ) !== false || strpos( $l, 'نقطة' ) !== false || strpos( $l, 'التقاء' ) !== false ) {
                    $icon = 'fa-map-marker';
                } elseif ( strpos( $l, 'language' ) !== false || strpos( $l, 'languages' ) !== false || strpos( $l, 'لغة' ) !== false ) {
                    $icon = 'fa-language';
                } elseif ( strpos( $l, 'cancel' ) !== false || strpos( $l, 'cancellation' ) !== false || strpos( $l, 'refund' ) !== false || strpos( $l, 'إلغاء' ) !== false || strpos( $l, 'استرداد' ) !== false ) {
                    $icon = 'fa-undo';
                } elseif ( strpos( $l, 'wheelchair' ) !== false || strpos( $l, 'access' ) !== false || strpos( $l, 'accessible' ) !== false || strpos( $l, 'كرسي' ) !== false ) {
                    $icon = 'fa-wheelchair';
                } elseif ( strpos( $l, 'group' ) !== false || strpos( $l, 'pax' ) !== false || strpos( $l, 'people' ) !== false || strpos( $l, 'max' ) !== false || strpos( $l, 'min' ) !== false || strpos( $l, 'مجموعة' ) !== false || strpos( $l, 'أشخاص' ) !== false ) {
                    $icon = 'fa-users';
                } elseif ( strpos( $l, 'ticket' ) !== false || strpos( $l, 'entry' ) !== false || strpos( $l, 'admission' ) !== false || strpos( $l, 'تذكرة' ) !== false || strpos( $l, 'دخول' ) !== false ) {
                    $icon = 'fa-ticket';
                }
                $trip_facts_items[] = array( 'label' => $label, 'value' => $val, 'icon' => $icon );
            }
        }
        if ( ! empty( $trip_facts_items ) ) {
            foreach ( $trip_facts_items as $i => $it ) {
                $lbl = isset( $it['label'] ) ? strtolower( trim( (string) $it['label'] ) ) : '';
                $prio = 90;
                if ( $lbl !== '' ) {
                    if ( strpos( $lbl, 'duration' ) !== false || strpos( $lbl, 'time' ) !== false || strpos( $lbl, 'length' ) !== false || strpos( $lbl, 'مدة' ) !== false ) {
                        $prio = 10;
                    } elseif ( strpos( $lbl, 'pickup' ) !== false || strpos( $lbl, 'meeting' ) !== false || strpos( $lbl, 'start' ) !== false || strpos( $lbl, 'meet' ) !== false || strpos( $lbl, 'استلام' ) !== false || strpos( $lbl, 'نقطة' ) !== false || strpos( $lbl, 'التقاء' ) !== false ) {
                        $prio = 20;
                    } elseif ( strpos( $lbl, 'meal' ) !== false || strpos( $lbl, 'meals' ) !== false || strpos( $lbl, 'lunch' ) !== false || strpos( $lbl, 'breakfast' ) !== false || strpos( $lbl, 'dinner' ) !== false || strpos( $lbl, 'وجبة' ) !== false || strpos( $lbl, 'وجبات' ) !== false ) {
                        $prio = 30;
                    } elseif ( strpos( $lbl, 'language' ) !== false || strpos( $lbl, 'languages' ) !== false || strpos( $lbl, 'لغة' ) !== false ) {
                        $prio = 40;
                    } elseif ( strpos( $lbl, 'location' ) !== false || strpos( $lbl, 'city' ) !== false || strpos( $lbl, 'place' ) !== false || strpos( $lbl, 'المكان' ) !== false || strpos( $lbl, 'المدينة' ) !== false ) {
                        $prio = 50;
                    } elseif ( strpos( $lbl, 'group' ) !== false || strpos( $lbl, 'pax' ) !== false || strpos( $lbl, 'people' ) !== false || strpos( $lbl, 'max' ) !== false || strpos( $lbl, 'min' ) !== false || strpos( $lbl, 'مجموعة' ) !== false || strpos( $lbl, 'أشخاص' ) !== false ) {
                        $prio = 60;
                    } elseif ( strpos( $lbl, 'cancel' ) !== false || strpos( $lbl, 'cancellation' ) !== false || strpos( $lbl, 'refund' ) !== false || strpos( $lbl, 'إلغاء' ) !== false || strpos( $lbl, 'استرداد' ) !== false ) {
                        $prio = 70;
                    } elseif ( strpos( $lbl, 'ticket' ) !== false || strpos( $lbl, 'entry' ) !== false || strpos( $lbl, 'admission' ) !== false || strpos( $lbl, 'تذكرة' ) !== false || strpos( $lbl, 'دخول' ) !== false ) {
                        $prio = 80;
                    }
                }
                $trip_facts_items[ $i ]['_prio'] = $prio;
                $trip_facts_items[ $i ]['_ord'] = $i;
            }
            usort( $trip_facts_items, function( $a, $b ) {
                $pa = isset( $a['_prio'] ) ? intval( $a['_prio'] ) : 90;
                $pb = isset( $b['_prio'] ) ? intval( $b['_prio'] ) : 90;
                if ( $pa === $pb ) {
                    $oa = isset( $a['_ord'] ) ? intval( $a['_ord'] ) : 0;
                    $ob = isset( $b['_ord'] ) ? intval( $b['_ord'] ) : 0;
                    return $oa <=> $ob;
                }
                return $pa <=> $pb;
            } );
            foreach ( $trip_facts_items as $i => $it ) {
                if ( isset( $trip_facts_items[ $i ]['_prio'] ) ) unset( $trip_facts_items[ $i ]['_prio'] );
                if ( isset( $trip_facts_items[ $i ]['_ord'] ) ) unset( $trip_facts_items[ $i ]['_ord'] );
            }
        }
        $has_trip_facts = ! empty( $trip_facts_items );

        // ── Tab Sections ──
        $has_overview_text = ! empty( trim( strip_tags( $overview_content ) ) );
        $has_highlights    = ! empty( $highlights );
        $has_why_love      = ! empty( $why_love_content );
        $has_overview      = $has_overview_text || $has_highlights || $has_why_love;
        $has_itinerary     = ! empty( $itin_titles );
        $has_cost          = ! empty( trim( $cost_includes ) ) || ! empty( trim( $cost_excludes ) );
        $has_gallery       = count( $all_images ) > 1;
        $has_reviews       = $review_count > 0 || ! empty( $reviews_tab_content );
        $has_faq           = ! empty( $faq_titles );

        $tab_sections = array();
        if ( $has_overview_text ) $tab_sections['overview']   = ! empty( $settings['overview_section_title'] ) ? $settings['overview_section_title'] : esc_html__( 'Overview', 'ftstravels' );
        if ( $has_highlights )   $tab_sections['highlights']  = $highlights_title;
        $tab_sections['itinerary'] = ! empty( $settings['trip_itinerary_title'] ) ? $settings['trip_itinerary_title'] : esc_html__( 'Itinerary', 'ftstravels' );
        $tab_sections['includes']  = ! empty( $cost_data['includes_title'] ) ? $cost_data['includes_title'] : esc_html__( 'Includes', 'ftstravels' );
        if ( $has_trip_facts )  $tab_sections['facts']       = $trip_facts_title;
        if ( $has_why_love )     $tab_sections['why-love']    = ! empty( $why_love_tab_title ) ? $why_love_tab_title : esc_html__( 'Why People Love This Trip', 'ftstravels' );
        $tab_sections['pricing']   = ! empty( $cost_data['cost_section_title'] ) ? $cost_data['cost_section_title'] : esc_html__( 'Pricing', 'ftstravels' );
        $tab_sections['gallery']   = esc_html__( 'Gallery', 'ftstravels' );
        $tab_sections['reviews']   = esc_html__( 'Reviews', 'ftstravels' );
        $tab_sections['faq']       = ! empty( $settings['faq_section_title'] ) ? $settings['faq_section_title'] : esc_html__( 'FAQ', 'ftstravels' );
        if ( ! $has_itinerary ) unset( $tab_sections['itinerary'] );
        if ( ! $has_cost )      unset( $tab_sections['includes'] );
        if ( ! $has_reviews )   unset( $tab_sections['reviews'] );
        if ( ! $has_faq )       unset( $tab_sections['faq'] );

        // ── Extra Services ──
        $extra_services = array();
        if ( defined( 'WTE_EXTRA_SERVICE_PATH' ) || defined( 'WTE_EXTRA_SERVICES_VERSION' ) ) {
            $es_names = $settings['extra_service'] ?? array();
            $es_costs = $settings['extra_service_cost'] ?? array();
            $es_descs = $settings['extra_service_desc'] ?? array();
            $es_units = $settings['extra_service_unit'] ?? array();
            if ( is_array( $es_names ) && ! empty( $es_names ) ) {
                foreach ( $es_names as $ei => $es_name ) {
                    $es_name = trim( (string) $es_name );
                    if ( $es_name === '' ) continue;
                    $es_cost = floatval( $es_costs[ $ei ] ?? 0 );
                    $extra_services[] = array(
                        'id'          => 'legacy_' . $ei,
                        'name'        => $es_name,
                        'description' => trim( (string) ( $es_descs[ $ei ] ?? '' ) ),
                        'cost'        => $es_cost,
                        'unit'        => $es_units[ $ei ] ?? 'person',
                        'type'        => 'default',
                    );
                }
            }

            $global_ids_str = $settings['wte_services_ids'] ?? '';
            if ( ! empty( $global_ids_str ) ) {
                $global_ids = array_map( 'intval', array_filter( explode( ',', $global_ids_str ) ) );
                if ( ! empty( $global_ids ) ) {
                    $svc_posts = get_posts( array( 'post_type' => 'wte-services', 'include' => $global_ids, 'post_status' => 'publish', 'numberposts' => 50 ) );
                    foreach ( $svc_posts as $svc_post ) {
                        $svc_meta     = get_post_meta( $svc_post->ID, 'wte_services', true );
                        $svc_meta     = is_array( $svc_meta ) ? $svc_meta : array();
                        $svc_type     = $svc_meta['service_type'] ?? 'default';
                        $svc_unit     = $svc_meta['service_unit'] ?? 'unit';
                        $svc_cost     = floatval( $svc_meta['service_cost'] ?? 0 );
                        $svc_desc     = wp_strip_all_tags( $svc_post->post_content );

                        if ( $svc_type === 'default' ) {
                            $wte_key = function_exists( 'wptravelengine_generate_key' )
                                ? wptravelengine_generate_key( (string) $svc_post->ID )
                                : '';
                            $extra_services[] = array(
                                'id'          => 'global_' . $svc_post->ID,
                                'wte_key'     => $wte_key,
                                'name'        => $svc_post->post_title,
                                'description' => $svc_desc,
                                'cost'        => $svc_cost,
                                'unit'        => $svc_unit,
                                'type'        => 'default',
                            );
                        }
                    }
                }
            }
        }
        $has_extra_services = ! empty( $extra_services );

        // ── Excluded / Blocked Dates ──
        $excluded_dates_map = array();
        $excluded_dates_yearly = array();
        $global_excluded = get_option( 'wptravelengine_exclude_dates', array() );
        $trip_excluded   = get_post_meta( $trip_id, 'wptravelengine_exclude_dates', true );
        if ( ! is_array( $global_excluded ) ) $global_excluded = array();
        if ( ! is_array( $trip_excluded ) )   $trip_excluded   = array();
        $all_excluded = $global_excluded + $trip_excluded;

        $dur_days_for_block = 0;
        if ( strtolower( (string) $duration_unit ) === 'days' && is_numeric( $duration ) && intval( $duration ) > 1 ) {
            $dur_days_for_block = intval( $duration ) - 1;
        }

        foreach ( $all_excluded as $ex_key => $ex_data ) {
            if ( empty( $ex_data ) ) continue;
            $ex_date_str   = isset( $ex_data['date'] ) ? $ex_data['date'] : (string) $ex_key;
            $is_single_day = ( isset( $ex_data['exclude_single_day'] ) && in_array( $ex_data['exclude_single_day'], array( 'yes', '1', true, 1 ), true ) );
            $range         = $is_single_day ? array( 0 ) : range( -$dur_days_for_block, 0 );
            foreach ( $range as $offset ) {
                $ts = strtotime( $ex_date_str . " {$offset} days" );
                if ( $ts ) {
                    $excluded_dates_map[ date( 'Y-m-d', $ts ) ] = true;
                }
            }
            $is_yearly = ( isset( $ex_data['repeat_yearly'] ) && in_array( $ex_data['repeat_yearly'], array( 'yes', '1', true, 1 ), true ) );
            if ( $is_yearly ) {
                $md = substr( str_replace( '-', '', $ex_date_str ), 4 );
                $excluded_dates_yearly[ $md ] = true;
            }
        }

        // ── Fixed Starting Dates ──
        $fsd_dates = array();
        if ( class_exists( 'WTE_Fixed_Starting_Dates_Functions' ) ) {
            try {
                $raw_fsds = WTE_Fixed_Starting_Dates_Functions::generate_fsds( $trip_id );
                if ( is_array( $raw_fsds ) ) {
                    foreach ( $raw_fsds as $fsd ) {
                        $seats = $fsd['seats_left'] ?? '';
                        if ( $seats !== '' && intval( $seats ) <= 0 ) continue;

                        $date_key = $fsd['start_date'];
                        if ( isset( $excluded_dates_map[ $date_key ] ) ) continue;
                        $date_md = substr( str_replace( '-', '', $date_key ), 4 );
                        if ( isset( $excluded_dates_yearly[ $date_md ] ) ) continue;

                        $avail = $fsd['availability'] ?? '';
                        if ( $avail === 'guaranteed' || $avail === 'available' ) {
                            $label = __( 'Low $', 'fts' ); $type = 'best';
                        } elseif ( $avail === 'limited' ) {
                            $label = ( $seats !== '' ) ? self::safe_sprintf( __( '%d left', 'fts' ), array( intval( $seats ) ), intval( $seats ) . ' left' ) : __( 'Limited', 'fts' ); $type = 'low';
                        } else {
                            $seats_int = intval( $seats );
                            $label = ( $seats !== '' && $seats_int <= 5 ) ? self::safe_sprintf( __( '%d left', 'fts' ), array( $seats_int ), $seats_int . ' left' ) : __( 'Low $', 'fts' );
                            $type  = ( $seats !== '' && $seats_int <= 3 ) ? 'low' : 'best';
                        }
                        $fsd_dates[ $date_key ] = array( 'label' => $label, 'type' => $type, 'seats' => $seats );
                    }
                }
            } catch ( \Throwable $e ) {
                error_log( 'FTS V2 FSD error: ' . $e->getMessage() );
            }
        }

        // ── Booking Modal ──
        $booking_modal_data = '';
        if ( function_exists( 'wptravelengine_trip_booking_modal_data' ) ) {
            try {
                $booking_modal_data = wp_json_encode( wptravelengine_trip_booking_modal_data( $trip_id ) );
            } catch ( \Throwable $e ) {
                error_log( 'FTS V2 booking modal error: ' . $e->getMessage() );
            }
        }

        // ── Packages for Custom Booking Modal ──
        $packages_list = array();
        $checkout_url = function_exists( 'wptravelengine_get_checkout_url' ) ? wptravelengine_get_checkout_url() : '';
        $currency_symbol = fts_v2_get_active_currency_symbol();

        if ( $trip_obj ) {
            try {
                $package_ids = get_post_meta( $trip_id, 'packages_ids', true );
                if ( is_array( $package_ids ) ) {
                    $pkg_i = 0;
                    foreach ( $package_ids as $pkg_id ) {
                        $pkg_id = intval( $pkg_id );
                        if ( ! $pkg_id || get_post_status( $pkg_id ) !== 'publish' ) continue;

                        $pkg_cats_raw = get_post_meta( $pkg_id, 'package-categories', true );
                        $categories = array();

                        if ( is_array( $pkg_cats_raw ) && ! empty( $pkg_cats_raw['c_ids'] ) ) {
                            $c_ids = (array) $pkg_cats_raw['c_ids'];
                            $lab   = (array) ( $pkg_cats_raw['labels']       ?? array() );
                            $pri   = (array) ( $pkg_cats_raw['prices']       ?? array() );
                            $spr   = (array) ( $pkg_cats_raw['sale_prices']  ?? array() );
                            $esl   = (array) ( $pkg_cats_raw['enabled_sale'] ?? array() );
                            $mnp   = (array) ( $pkg_cats_raw['min_paxes']    ?? array() );
                            $mxp   = (array) ( $pkg_cats_raw['max_paxes']    ?? array() );
                            $egd   = (array) ( $pkg_cats_raw['enabled_group_discount'] ?? array() );
                            $gp_meta = get_post_meta( $pkg_id, 'group-pricing', true );
                            if ( ! is_array( $gp_meta ) ) $gp_meta = array();

                            foreach ( $c_ids as $ci => $cid ) {
                                $cp  = floatval( $pri[ $ci ] ?? 0 );
                                $csp = floatval( $spr[ $ci ] ?? 0 );
                                $chs = ! empty( $esl[ $ci ] );
                                $cdp = ( $chs && $csp > 0 && $csp < $cp ) ? $csp : $cp;
                                $c_label = $lab[ $ci ] ?? __( 'Adult', 'fts' );
                                $c_role  = self::infer_traveler_role( $c_label, $cid );
                                $c_age   = (string) get_term_meta( intval( $cid ), 'age_group', true );

                                $cid_int = intval( $cid );
                                $c_gd_enabled = ! empty( $egd[ $ci ] ) || ! empty( $egd[ $cid_int ] );
                                $c_gp_tiers   = array();
                                if ( $c_gd_enabled && ! empty( $gp_meta[ $cid_int ] ) && is_array( $gp_meta[ $cid_int ] ) ) {
                                    foreach ( $gp_meta[ $cid_int ] as $gpt ) {
                                        $c_gp_tiers[] = array(
                                            'from'  => intval( $gpt['from'] ?? 0 ),
                                            'to'    => ! empty( $gpt['to'] ) ? intval( $gpt['to'] ) : 0,
                                            'price' => floatval( $gpt['price'] ?? 0 ),
                                        );
                                    }
                                }

                                $categories[] = array(
                                    'id'            => $cid_int,
                                    'label'         => $c_label,
                                    'role'          => $c_role,
                                    'age_group'     => $c_age,
                                    'price'         => $cp,
                                    'sale_price'    => $csp,
                                    'has_sale'      => $chs,
                                    'display_price' => $cdp,
                                    'min_pax'       => max( 0, intval( $mnp[ $ci ] ?? 0 ) ),
                                    'max_pax'       => max( 1, intval( $mxp[ $ci ] ?? 20 ) ),
                                    'group_discount'=> $c_gd_enabled,
                                    'group_pricing' => $c_gp_tiers,
                                );
                            }
                        }

                        usort( $categories, function( $a, $b ) {
                            $prio = array( 'adult' => 0, 'child' => 1 );
                            $a_role = isset( $a['role'] ) ? (string) $a['role'] : '';
                            $b_role = isset( $b['role'] ) ? (string) $b['role'] : '';
                            $a_p = array_key_exists( $a_role, $prio ) ? $prio[ $a_role ] : 2;
                            $b_p = array_key_exists( $b_role, $prio ) ? $prio[ $b_role ] : 2;
                            if ( $a_p !== $b_p ) return $a_p - $b_p;
                            return strcasecmp( (string) ( $a['label'] ?? '' ), (string) ( $b['label'] ?? '' ) );
                        } );
                        $primary_cat = null;
                        foreach ( $categories as $cc ) {
                            if ( ( $cc['role'] ?? '' ) === 'adult' ) { $primary_cat = $cc; break; }
                        }
                        if ( ! $primary_cat && ! empty( $categories ) ) $primary_cat = $categories[0];

                        $f_dp  = $primary_cat ? floatval( $primary_cat['display_price'] ?? 0 ) : 0;
                        $f_old = 0;
                        $f_pct = 0;
                        if ( $primary_cat && ! empty( $primary_cat['has_sale'] ) && $primary_cat['price'] > $primary_cat['display_price'] ) {
                            $f_old = floatval( $primary_cat['price'] );
                            $f_pct = round( ( ( $primary_cat['price'] - $primary_cat['display_price'] ) / $primary_cat['price'] ) * 100 );
                        }

                        $pkg_content = get_post_field( 'post_content', $pkg_id );
                        $features = array();
                        if ( ! empty( $pkg_content ) ) {
                            if ( preg_match_all( '/<li[^>]*>(.*?)<\/li>/si', $pkg_content, $fm ) ) {
                                $features = array_map( 'wp_strip_all_tags', $fm[1] );
                            } else {
                                foreach ( preg_split( '/[\r\n]+/', wp_strip_all_tags( $pkg_content ) ) as $fl ) {
                                    $fl = trim( $fl );
                                    if ( $fl !== '' ) $features[] = $fl;
                                }
                            }
                        }
                        if ( empty( $features ) && ! empty( $cost_includes ) ) {
                            if ( preg_match_all( '/<li[^>]*>(.*?)<\/li>/si', $cost_includes, $fm ) ) {
                                $features = array_map( 'wp_strip_all_tags', $fm[1] );
                            } else {
                                foreach ( preg_split( '/\r\n|[\r\n]/', $cost_includes ) as $fl ) {
                                    $fl = trim( strip_tags( $fl ) );
                                    if ( $fl !== '' ) $features[] = $fl;
                                }
                            }
                        }

                        $packages_list[] = array(
                            'id'            => $pkg_id,
                            'name'          => get_the_title( $pkg_id ),
                            'description'   => wp_trim_words( wp_strip_all_tags( $pkg_content ), 8, '' ),
                            'features'      => array_map( function( $f ) { return wp_trim_words( $f, 4, '' ); }, array_slice( $features, 0, 4 ) ),
                            'display_price' => $f_dp,
                            'old_price'     => $f_old,
                            'discount_pct'  => $f_pct,
                            'is_primary'    => ( $pkg_i === 0 ),
                            'badge'         => '',
                            'categories'    => $categories,
                        );

                        $pkg_i++;
                    }
                }
            } catch ( \Throwable $e ) {
                error_log( 'FTS V2 packages error: ' . $e->getMessage() );
            }
        }

        if ( count( $packages_list ) > 1 ) {
            usort(
                $packages_list,
                function( $a, $b ) {
                    $pa = floatval( $a['display_price'] ?? 0 );
                    $pb = floatval( $b['display_price'] ?? 0 );
                    if ( $pa !== $pb ) {
                        return $pa <=> $pb;
                    }
                    return intval( $a['id'] ?? 0 ) <=> intval( $b['id'] ?? 0 );
                }
            );
            foreach ( $packages_list as $pi => &$pkg_sort ) {
                $pkg_sort['is_primary'] = ( $pi === 0 );
            }
            unset( $pkg_sort );
        }

        if ( count( $packages_list ) > 1 ) {
            $ch_idx = 0;
            $ch_pr  = PHP_INT_MAX;
            foreach ( $packages_list as $pi => $pk ) {
                if ( $pk['display_price'] > 0 && $pk['display_price'] < $ch_pr ) {
                    $ch_pr  = $pk['display_price'];
                    $ch_idx = $pi;
                }
            }
            $packages_list[ $ch_idx ]['badge'] = 'best_value';
            if ( $packages_list[0]['badge'] === '' ) {
                $packages_list[0]['badge'] = 'most_popular';
            }
        }

        // ── Trustindex Widget ──
        $trustindex_code = function_exists( 'get_field' ) ? get_field( 'trustindex_code', $trip_id ) : '';
        if ( ! is_string( $trustindex_code ) || trim( $trustindex_code ) === '' ) {
            $trustindex_code = get_post_meta( $trip_id, 'trustindex_code', true );
        }
        $trustindex_quickbar_code = $settings['tab_content']['9_wpeditor'] ?? '';
        if ( ! is_string( $trustindex_quickbar_code ) || strpos( $trustindex_quickbar_code, 'cdn.trustindex.io/loader.js' ) === false ) {
            $trustindex_quickbar_code = '';
        }
        $trustindex_loader = '';
        $trustindex_has_loader = false;
        if ( is_string( $trustindex_code ) && trim( $trustindex_code ) !== '' ) {
            $trustindex_has_loader = ( strpos( $trustindex_code, 'cdn.trustindex.io/loader.js' ) !== false );
        }
        if ( is_string( $trustindex_code ) && trim( $trustindex_code ) !== '' && ! $trustindex_has_loader && $trustindex_quickbar_code === '' ) {
            $trustindex_loader = 'https://cdn.trustindex.io/loader.js?49f81de492564412a126bfa9e75';
        }

        $social_proof_enabled = (bool) apply_filters( 'fts_v2_enable_social_proof', false, $trip_id, $settings );
        $social_proof         = apply_filters( 'fts_v2_social_proof', array(), $trip_id, $settings );
        $viewer_count         = ( is_array( $social_proof ) && isset( $social_proof['viewer_count'] ) ) ? intval( $social_proof['viewer_count'] ) : 0;
        $last_booked_minutes  = ( is_array( $social_proof ) && isset( $social_proof['last_booked_minutes'] ) ) ? intval( $social_proof['last_booked_minutes'] ) : 0;

        $company_travelers_text      = (string) apply_filters( 'fts_v2_company_travelers_text', '', $trip_id, $settings );
        $company_certification_text  = (string) apply_filters( 'fts_v2_company_certification_text', '', $trip_id, $settings );
        $free_cancellation_text      = (string) apply_filters( 'fts_v2_free_cancellation_text', '', $trip_id, $settings );

        $cancel_hours = intval( get_post_meta( $trip_id, 'fts_cancel_hours', true ) );
        if ( $cancel_hours <= 0 ) $cancel_hours = 0;
        $terms_url = home_url( '/terms-and-conditions/' );

        $pp_enabled = false;
        if ( isset( $settings['partial_payment_enable'] ) ) {
            $raw_pp = $settings['partial_payment_enable'];
            if ( is_bool( $raw_pp ) ) $pp_enabled = $raw_pp;
            else $pp_enabled = in_array( strtolower( (string) $raw_pp ), array( '1', 'yes', 'true', 'on' ), true );
        }

        $default_sidebar_trust_items = array(
            array( 'type' => 'shield', 'text' => esc_html__( 'Secure Booking', 'fts' ) ),
        );
        if ( $pp_enabled ) {
            $default_sidebar_trust_items[] = array( 'type' => 'clock', 'text' => esc_html__( 'Reserve now & pay later', 'fts' ) );
        }
        if ( is_string( $free_cancellation_text ) && trim( $free_cancellation_text ) !== '' ) {
            $default_sidebar_trust_items[] = array( 'type' => 'check', 'text' => trim( $free_cancellation_text ) );
        }

        $sidebar_trust_items = apply_filters(
            'fts_v2_sidebar_trust_items',
            $default_sidebar_trust_items,
            $trip_id,
            $settings
        );

        // ── Enquiry / WhatsApp ──
        $enquiry_enabled = get_post_meta( $trip_id, '_fts_enable_enquiry_sidebar', true );
        $whatsapp_number = apply_filters( 'fts_whatsapp_number', '' );

        self::$trip_data = compact(
            'trip_id', 'settings', 'trip_obj',
            'bold_promise', 'at_a_glance',
            'price', 'sale_price', 'has_sale', 'display_price', 'old_price', 'discount_pct',
            'review_data', 'avg_rating', 'review_count', 'reviews', 'reviews_tab_content',
            'duration', 'duration_unit', 'nights', 'duration_text',
            'min_pax', 'max_pax', 'group_text',
            'destination_terms', 'dest_chain', 'location',
            'activity_terms', 'last_crumb',
            'featured_img_id', 'all_images', 'all_urls', 'all_thumbs', 'all_titles', 'video_url',
            'grid_images', 'grid_count', 'extra_photos',
            'overview_content', 'overview_excerpt', 'has_overview_text', 'has_highlights', 'highlights', 'highlights_title',
            'itin_titles', 'itin_content', 'itin_days_label',
            'cost_includes', 'cost_excludes',
            'faq_titles', 'faq_content',
            'trip_facts_title', 'trip_facts_items', 'has_trip_facts',
            'tab_sections',
            'has_overview', 'has_why_love', 'why_love_content', 'why_love_tab_title', 'has_itinerary', 'has_cost', 'has_gallery', 'has_reviews', 'has_faq',
            'extra_services', 'has_extra_services',
            'fsd_dates', 'excluded_dates_map', 'excluded_dates_yearly', 'booking_modal_data', 'enquiry_enabled', 'whatsapp_number',
            'packages_list', 'checkout_url', 'currency_symbol',
            'trustindex_code', 'trustindex_quickbar_code', 'trustindex_loader',
            'social_proof_enabled', 'viewer_count', 'last_booked_minutes',
            'company_travelers_text', 'company_certification_text', 'free_cancellation_text',
            'cancel_hours', 'terms_url',
            'sidebar_trust_items'
        );

        return self::$trip_data;
    }

    /* ─────────────────────────────────────────────────
       Safe Include — extracts shared data into scope
       ───────────────────────────────────────────────── */
    private static function safe_include( $file, $__data = array() ) {
        if ( ! file_exists( $file ) ) {
            error_log( 'FTS V2: File not found: ' . $file );
            return;
        }
        try {
            if ( ! empty( $__data ) ) extract( $__data, EXTR_SKIP );
            include $file;
            if ( self::$debug ) {
                echo '<!-- FTS V2 OK: ' . basename( $file ) . ' -->';
            }
        } catch ( \Throwable $e ) {
            $msg = 'FTS V2 Error in ' . basename( $file ) . ': ' . $e->getMessage() . ' on line ' . $e->getLine();
            error_log( $msg );
            echo '<!-- ' . esc_html( $msg ) . ' -->';
        }
    }

    /* ─────────────────────────────────────────────────
       Render
       ───────────────────────────────────────────────── */
    public static function render_nuclear_custom_layout() {
        $base = get_stylesheet_directory() . '/trip-design-v2/parts/';
        $data = self::get_trip_data();

        self::$debug = isset( $_GET['fts_debug'] ) && current_user_can( 'manage_options' );
        register_shutdown_function( array( __CLASS__, 'catch_fatal' ) );

        if ( self::$debug ) {
            echo '<!-- FTS V2 DEBUG MODE -->';
            echo '<!-- PHP: ' . PHP_VERSION . ' -->';
            echo '<!-- WP: ' . get_bloginfo( 'version' ) . ' -->';
            echo '<!-- Parts dir: ' . ( is_dir( $base ) ? 'EXISTS' : 'MISSING' ) . ' -->';
            $parts = array( 'header-v2.php', 'gallery-v2.php', 'quick-info-v2.php', 'tabs-accordion-v2.php', 'sidebar-v2.php', 'footer-v2.php' );
            foreach ( $parts as $p ) {
                echo '<!-- ' . $p . ': ' . ( file_exists( $base . $p ) ? 'OK' : 'MISSING' ) . ' -->';
            }
        }

        $bm_raw = ! empty( $data['booking_modal_data'] ) ? json_decode( $data['booking_modal_data'], true ) : array();

        $packages_for_js = array();
        foreach ( $data['packages_list'] as $pkg_js ) {
            $pkg_js['display_price'] = fts_v2_convert_price( $pkg_js['display_price'] );
            $pkg_js['old_price']     = fts_v2_convert_price( $pkg_js['old_price'] );
            if ( ! empty( $pkg_js['categories'] ) ) {
                foreach ( $pkg_js['categories'] as &$cat_js ) {
                    $cat_js['price']         = fts_v2_convert_price( $cat_js['price'] );
                    $cat_js['sale_price']    = fts_v2_convert_price( $cat_js['sale_price'] );
                    $cat_js['display_price'] = fts_v2_convert_price( $cat_js['display_price'] );
                    if ( ! empty( $cat_js['group_pricing'] ) ) {
                        foreach ( $cat_js['group_pricing'] as &$gp_js ) {
                            $gp_js['price'] = fts_v2_convert_price( $gp_js['price'] );
                        }
                        unset( $gp_js );
                    }
                }
                unset( $cat_js );
            }
            $packages_for_js[] = $pkg_js;
        }

        wp_localize_script( 'fts-trip-v2-script', 'ftsV2Data', array(
            'tripId'         => $data['trip_id'],
            'galleryUrls'    => $data['all_urls'],
            'galleryThumbs'  => $data['all_thumbs'],
            'galleryTitles'  => $data['all_titles'],
            'fsdDates'       => (object) $data['fsd_dates'],
            'excludedDates'  => (object) $data['excluded_dates_map'],
            'excludedDatesYearly' => (object) $data['excluded_dates_yearly'],
            'cancelHours'    => intval( $data['cancel_hours'] ?? 0 ),
            'termsUrl'       => esc_url_raw( $data['terms_url'] ?? home_url( '/terms-and-conditions/' ) ),
            'packages'       => $packages_for_js,
            'bookingModal'   => $bm_raw,
            'extraServices'  => $data['extra_services'],
            'checkoutUrl'    => $data['checkout_url'],
            'currencySymbol' => fts_v2_get_active_currency_symbol(),
            'i18n'           => array(
                'per_person'        => __( '/ person', 'fts' ),
                'per_person_cap'    => __( '/ Person', 'fts' ),
                'per_person_compact'=> __( '/person', 'fts' ),
                'free_cancellation' => __( 'Free Cancellation', 'fts' ),
                'book_now'          => __( 'Book Now', 'fts' ),
                'select_travelers'  => __( 'Select travelers', 'fts' ),
                'adult_singular'    => __( 'Adult', 'fts' ),
                'adult_plural'      => __( 'Adults', 'fts' ),
                'child_singular'    => __( 'Child', 'fts' ),
                'child_plural'      => __( 'Children', 'fts' ),
                'secure_booking'    => __( 'Secure Booking', 'fts' ),
                'secure_booking_with_price' => __( 'Secure Booking — %s', 'fts' ),
                'not_available'     => __( 'Not available', 'fts' ),
                'processing'        => __( 'Processing...', 'fts' ),
                'booking_data_na'   => __( 'Booking data not available. Please refresh the page.', 'fts' ),
                'error_generic'     => __( 'Something went wrong. Please try again.', 'fts' ),
                'error_connection'  => __( 'Connection error. Please check your internet and try again.', 'fts' ),
                'age_adult'         => __( 'Age 12+', 'fts' ),
                'age_years'         => __( 'years', 'fts' ),
                'continue'          => __( 'Continue', 'fts' ),
                'total_label'       => __( 'Total', 'fts' ),
                'continue_to_travelers' => __( 'Continue to travelers', 'fts' ),
                'continue_to_package'   => __( 'Continue to package', 'fts' ),
                'continue_to_checkout'  => __( 'Continue to checkout', 'fts' ),
                'proceed_to_payment'    => __( 'Proceed to payment', 'fts' ),
                'total_due_now'         => __( 'Total due now', 'fts' ),
                'back'              => __( 'Back', 'fts' ),
                'discount_off'      => __( '%s OFF', 'fts' ),
                'months_short'      => array(
                    __( 'Jan', 'fts' ), __( 'Feb', 'fts' ), __( 'Mar', 'fts' ), __( 'Apr', 'fts' ),
                    __( 'May', 'fts' ), __( 'Jun', 'fts' ), __( 'Jul', 'fts' ), __( 'Aug', 'fts' ),
                    __( 'Sep', 'fts' ), __( 'Oct', 'fts' ), __( 'Nov', 'fts' ), __( 'Dec', 'fts' ),
                ),
                'days_full'         => array(
                    __( 'Sunday', 'fts' ), __( 'Monday', 'fts' ), __( 'Tuesday', 'fts' ), __( 'Wednesday', 'fts' ),
                    __( 'Thursday', 'fts' ), __( 'Friday', 'fts' ), __( 'Saturday', 'fts' ),
                ),
                'days_min'          => array(
                    __( 'Su', 'fts' ), __( 'Mo', 'fts' ), __( 'Tu', 'fts' ), __( 'We', 'fts' ),
                    __( 'Th', 'fts' ), __( 'Fr', 'fts' ), __( 'Sa', 'fts' ),
                ),
            ),
        ) );

        echo '<div id="fts-v2-root" class="fts-v2-root">';

            self::safe_include( $base . 'header-v2.php', $data );
            self::safe_include( $base . 'gallery-v2.php', $data );
            self::safe_include( $base . 'quick-info-v2.php', $data );

            echo '<div class="fts-v2-container fts-v2-main-layout">';
                echo '<div class="fts-v2-content-col">';
                    self::safe_include( $base . 'tabs-accordion-v2.php', $data );
                echo '</div>';
                echo '<div class="fts-v2-sidebar-col">';
                    self::safe_include( $base . 'sidebar-v2.php', $data );
                echo '</div>';
            echo '</div>';

            self::safe_include( $base . 'footer-v2.php', $data );

        echo '</div>';

        self::safe_include( $base . 'booking-modal-v2.php', $data );
    }

    public static function catch_fatal() {
        $error = error_get_last();
        if ( $error && in_array( $error['type'], array( E_ERROR, E_PARSE, E_COMPILE_ERROR, E_CORE_ERROR ) ) ) {
            error_log( sprintf( 'FTS V2 FATAL: [%s] %s in %s on line %d', $error['type'], $error['message'], $error['file'], $error['line'] ) );
        }
    }

    /* ─────────────────────────────────────────────────
       Assets
       ───────────────────────────────────────────────── */
    private static $global_css = array(
        'variables', 'trip-header-bar', 'header',
    );

    private static $trip_css = array(
        'theme-overrides', 'base', 'gallery',
        'quick-info', 'layout', 'content', 'packages', 'reviews',
        'faq', 'sidebar', 'booking-modal', 'related', 'responsive',
    );

    private static function safe_version( $file ) {
        if ( ! file_exists( $file ) ) return '1.0.0';
        $mtime = @filemtime( $file );
        return $mtime ? $mtime : '1.0.0';
    }

    public static function enqueue_assets() {
        try {
            $base_dir = get_stylesheet_directory() . '/trip-design-v2/assets/';
            $base_uri = get_stylesheet_directory_uri() . '/trip-design-v2/assets/';
            $css_dir  = $base_dir . 'css/';
            $css_uri  = $base_uri . 'css/';

            wp_enqueue_style( 'fts-v2-fonts', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap' );

            $prev = array();
            foreach ( self::$global_css as $module ) {
                $handle = 'fts-v2-' . $module;
                $file   = $css_dir . $module . '.css';
                if ( ! file_exists( $file ) ) continue;
                wp_enqueue_style( $handle, $css_uri . $module . '.css', $prev, self::safe_version( $file ) );
                $prev = array( $handle );
            }

            wp_enqueue_style( 'fts-v2-global-header-hide', false, $prev );
            wp_add_inline_style( 'fts-v2-global-header-hide',
                '#masthead,' .
                '.site-header,' .
                '.header-layout-1,' .
                '.header-layout-2,' .
                '.header-layout-3,' .
                '.sticky-header,' .
                '.page-header-top,' .
                '.elementor-location-header,' .
                '[data-elementor-type="header"]{display:none!important}'
            );

            $hb_file = $base_dir . 'header-bar.js';
            wp_enqueue_script( 'fts-v2-header-bar', $base_uri . 'header-bar.js', array( 'jquery' ), self::safe_version( $hb_file ), true );

            if ( ! is_singular( 'trip' ) ) return;

            $trip_data = self::get_trip_data();
            if ( ! empty( $trip_data['trustindex_loader'] ) ) {
                wp_enqueue_script(
                    'fts-trustindex-loader',
                    $trip_data['trustindex_loader'],
                    array(),
                    null,
                    array( 'in_footer' => true, 'strategy' => 'defer' )
                );
            }

            foreach ( self::$trip_css as $module ) {
                $handle = 'fts-v2-' . $module;
                $file   = $css_dir . $module . '.css';
                if ( ! file_exists( $file ) ) continue;
                wp_enqueue_style( $handle, $css_uri . $module . '.css', $prev, self::safe_version( $file ) );
                $prev = array( $handle );
            }

            wp_enqueue_script( 'jquery-ui-datepicker' );

            $js_file = $base_dir . 'script-v2.js';
            if ( file_exists( $js_file ) ) {
                wp_enqueue_script( 'fts-trip-v2-script', $base_uri . 'script-v2.js', array( 'jquery' ), self::safe_version( $js_file ), true );
            }

            wp_enqueue_style( 'fts-v2-fa', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css' );

            wp_dequeue_style( 'font-awesome-6' );
            wp_deregister_style( 'font-awesome-6' );

            wp_enqueue_style( 'fts-v2-sticky-critical', false, $prev );
            wp_add_inline_style( 'fts-v2-sticky-critical',
                'body.single-trip{overflow:visible!important}' .
                'body.single-trip .site-content,' .
                'body.single-trip .site-content>.container,' .
                'body.single-trip .site-content>.container-full,' .
                'body.single-trip .site-content .main-content-wrapper,' .
                'body.single-trip #primary,' .
                'body.single-trip #primary>article,' .
                'body.single-trip #page,' .
                'body.single-trip .fts-v2-root,' .
                'body.single-trip .entry-content,' .
                'body.single-trip .post-inner,' .
                'body.single-trip .entry-content>*:not(.fts-v2-root){overflow:visible!important}' .
                '.fts-v2-sidebar-wrapper{position:sticky!important;top:100px!important;align-self:flex-start!important}' .
                '.fts-v2-tabs-nav{position:sticky!important;top:56px!important;z-index:1000!important}' .
                '#fts-booking-modal .fts-bm-step-header{display:flex!important;align-items:center!important;gap:12px!important;margin-bottom:16px!important;font-size:28px!important;font-weight:700!important;line-height:1.2!important;color:#1a2332!important}' .
                '#fts-booking-modal .fts-bm-step-num{width:34px!important;height:34px!important;border-radius:50%!important;background:var(--v2-primary,#ff6b35)!important;color:#fff!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:18px!important;font-weight:700!important;flex:0 0 34px!important}' .
                '#fts-booking-modal .fts-bm-package-inner{display:grid!important;grid-template-columns:auto 1fr auto!important;gap:14px!important;align-items:flex-start!important;padding:16px!important}' .
                '#fts-booking-modal .fts-bm-package-name{font-family:var(--v2-font-heading,Outfit,sans-serif)!important;font-size:22px!important;font-weight:700!important;line-height:1.2!important;margin:0 0 4px!important;color:#1a2332!important}' .
                '#fts-booking-modal .fts-bm-package-desc{font-size:14px!important;line-height:1.45!important;color:#64748b!important;margin:0!important}' .
                '#fts-booking-modal .fts-bm-package-price{display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:2px!important;text-align:right!important}' .
                '#fts-booking-modal .fts-bm-price-current{font-size:22px!important;line-height:1.2!important;font-weight:800!important;color:#1a2332!important}' .
                '#fts-booking-modal .fts-bm-price-per{font-size:11px!important;color:#718096!important;line-height:1.1!important}' .
                '#fts-booking-modal .fts-bm-travelers-list{display:flex!important;flex-direction:column!important;gap:12px!important}' .
                '#fts-booking-modal .fts-bm-traveler-row{display:flex!important;justify-content:space-between!important;align-items:center!important;padding:12px 16px!important;border:1px solid #e2e8f0!important;border-radius:12px!important;background:#fff!important}' .
                '#fts-booking-modal .fts-bm-counter{display:flex!important;align-items:center!important;gap:12px!important}' .
                '#fts-booking-modal .fts-bm-counter-btn{width:44px!important;height:44px!important;border-radius:10px!important;border:none!important;background:var(--v2-primary,#ff6b35)!important;color:#fff!important;font-size:26px!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important}' .
                '#fts-booking-modal .fts-bm-counter-value{min-width:22px!important;text-align:center!important;font-size:22px!important;font-weight:700!important;color:#1a2332!important}' .
                '#fts-booking-modal .ui-datepicker{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;background:transparent!important;border:0!important;box-shadow:none!important}' .
                '@media(max-width:768px){#fts-booking-modal .fts-bm-step-header{font-size:20px!important}#fts-booking-modal .fts-bm-package-name{font-size:18px!important}#fts-booking-modal .fts-bm-price-current{font-size:18px!important}#fts-booking-modal .fts-bm-price-per{font-size:11px!important}}'
            );

        } catch ( \Throwable $e ) {
            error_log( 'FTS V2 enqueue error: ' . $e->getMessage() );
        }
    }
}

FTS_Trip_Redesign_V2::init();
