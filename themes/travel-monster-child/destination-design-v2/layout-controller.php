<?php
/**
 * Layout Controller for FTS Destination V2
 *
 * Handles asset loading, rendering, and AJAX for the
 * premium destination archive pages.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Destination_V2 {

    public static function init() {
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 99 );
        add_action( 'wp_ajax_fts_dest_v2_filter',        array( __CLASS__, 'ajax_filter' ) );
        add_action( 'wp_ajax_nopriv_fts_dest_v2_filter', array( __CLASS__, 'ajax_filter' ) );
        add_action( 'wp_ajax_fts_dest_v2_load_more',        array( __CLASS__, 'ajax_load_more' ) );
        add_action( 'wp_ajax_nopriv_fts_dest_v2_load_more', array( __CLASS__, 'ajax_load_more' ) );
    }

    /* ─── Assets ─── */

    private static $css_modules = array(
        'destination', 'hero', 'toolbar', 'filters', 'trip-card', 'responsive',
    );

    private static function ver( $file ) {
        return file_exists( $file ) ? (string) filemtime( $file ) : '1.0';
    }

    private static $supported_taxonomies = array( 'destination', 'trip_types', 'activities' );

    public static function enqueue_assets() {
        $match = false;
        foreach ( self::$supported_taxonomies as $tax ) {
            if ( is_tax( $tax ) ) { $match = true; break; }
        }
        if ( ! $match ) return;

        $dir = get_stylesheet_directory()     . '/destination-design-v2/assets/';
        $uri = get_stylesheet_directory_uri() . '/destination-design-v2/assets/';
        $v2  = get_stylesheet_directory()     . '/trip-design-v2/assets/css/';
        $v2u = get_stylesheet_directory_uri() . '/trip-design-v2/assets/css/';

        wp_enqueue_style( 'fts-dest-v2-vars', $v2u . 'variables.css', array(), self::ver( $v2 . 'variables.css' ) );

        $prev = array( 'fts-dest-v2-vars' );
        foreach ( self::$css_modules as $m ) {
            $h = 'fts-dest-v2-' . $m;
            $f = $dir . 'css/' . $m . '.css';
            if ( ! file_exists( $f ) ) continue;
            wp_enqueue_style( $h, $uri . 'css/' . $m . '.css', $prev, self::ver( $f ) );
            $prev = array( $h );
        }

        $js = $dir . 'destination-v2.js';
        wp_enqueue_script( 'fts-dest-v2-js', $uri . 'destination-v2.js', array( 'jquery' ), self::ver( $js ), true );
        $current_term = get_queried_object();
        wp_localize_script( 'fts-dest-v2-js', 'ftsDestV2', array(
            'ajax'     => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'fts_dest_v2' ),
            'taxonomy' => ( $current_term && is_a( $current_term, 'WP_Term' ) ) ? $current_term->taxonomy : 'destination',
        ) );
    }

    /* ─── Render ─── */

    public static function render() {
        $term = get_queried_object();
        if ( ! $term || ! is_a( $term, 'WP_Term' ) ) return;

        $data = self::get_destination_data( $term );
        $base = get_stylesheet_directory() . '/destination-design-v2/parts/';

        echo '<div id="fts-dest-v2-root" class="fts-dest-v2-root">';

            self::inc( $base . 'hero-v2.php', $data );
            self::inc( $base . 'toolbar-v2.php', $data );

            echo '<div class="fts-dest-v2-container fts-dest-v2-layout" id="fts-dest-v2-layout">';
                echo '<aside class="fts-dest-v2-sidebar">';
                    self::inc( $base . 'filters-v2.php', $data );
                echo '</aside>';
                echo '<main class="fts-dest-v2-main">';
                    echo '<div class="fts-dest-v2-grid" id="fts-dest-v2-grid">';
                        if ( ! empty( $data['trips'] ) ) {
                            foreach ( $data['trips'] as $trip ) {
                                self::inc( $base . 'trip-card-v2.php', $trip );
                            }
                        } else {
                            self::inc( $base . 'no-results-v2.php', $data );
                        }
                    echo '</div>';
                    if ( $data['max_pages'] > 1 ) {
                        echo '<div class="fts-dest-v2-load-more-wrap" id="fts-dest-v2-load-more-wrap">';
                        echo '<button type="button" class="fts-dest-v2-load-more" id="fts-dest-v2-load-more" ';
                        echo 'data-page="1" data-max="' . esc_attr( $data['max_pages'] ) . '" ';
                        echo 'data-slug="' . esc_attr( $term->slug ) . '">Load More Trips</button>';
                        echo '</div>';
                    }
                echo '</main>';
            echo '</div>';

        echo '</div>';

        echo '<button class="fts-dest-v2-filter-fab" id="fts-dest-v2-filter-fab" aria-label="Filters">';
        echo '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>';
        echo '<span>Filters</span>';
        echo '</button>';
        echo '<div class="fts-dest-v2-drawer-backdrop" id="fts-dest-v2-backdrop"></div>';
    }

    /* ─── Data fetching ─── */

    private static function get_destination_data( $term ) {
        $paged    = max( 1, get_query_var( 'paged' ) );
        $per      = get_option( 'posts_per_page', 12 );
        $taxonomy = $term->taxonomy;

        $query = new WP_Query( array(
            'post_type'      => 'trip',
            'post_status'    => 'publish',
            'posts_per_page' => $per,
            'paged'          => $paged,
            'tax_query'      => array( array(
                'taxonomy' => $taxonomy,
                'field'    => 'slug',
                'terms'    => $term->slug,
            ) ),
            'meta_query'     => array(
                'relation' => 'OR',
                'featured_clause' => array( 'key' => 'wp_travel_engine_featured_trip', 'compare' => '=', 'value' => 'yes' ),
                'regular_clause'  => array( 'key' => 'wp_travel_engine_featured_trip', 'compare' => 'NOT EXISTS' ),
            ),
            'orderby' => array( 'featured_clause' => 'DESC', 'date' => 'DESC' ),
        ) );

        $trips = array();
        if ( $query->have_posts() ) {
            while ( $query->have_posts() ) {
                $query->the_post();
                $trips[] = self::build_card_data( get_the_ID() );
            }
        }
        wp_reset_postdata();

        $image_id  = get_term_meta( $term->term_id, 'category-image-id', true );
        $image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'full' ) : '';
        if ( ! $image_url ) {
            $image_url = get_term_meta( $term->term_id, 'thumbnail', true );
        }

        $sub_terms    = self::get_filter_terms( $taxonomy, $term );
        $activities   = ( $taxonomy !== 'activities' )  ? self::get_scoped_terms( 'activities',  $taxonomy, $term->slug ) : array();
        $trip_types   = ( $taxonomy !== 'trip_types' )  ? self::get_scoped_terms( 'trip_types',  $taxonomy, $term->slug ) : array();
        $destinations = ( $taxonomy !== 'destination' ) ? self::get_scoped_terms( 'destination', $taxonomy, $term->slug ) : array();
        $difficulties = self::get_scoped_terms( 'difficulty', $taxonomy, $term->slug );
        $durations    = self::get_duration_ranges( $taxonomy, $term->slug );

        $all_tags = self::build_all_tags( $term, $sub_terms, $activities, $trip_types, $difficulties, $destinations );

        return array(
            'term'         => $term,
            'image_url'    => $image_url,
            'total'        => $query->found_posts,
            'max_pages'    => $query->max_num_pages,
            'trips'        => $trips,
            'sub_dests'    => $sub_terms,
            'activities'   => $activities,
            'trip_types'   => $trip_types,
            'destinations' => $destinations,
            'difficulties' => $difficulties,
            'durations'    => $durations,
            'all_tags'     => $all_tags,
        );
    }

    public static function build_card_data( $id ) {
        $settings = get_post_meta( $id, 'wp_travel_engine_setting', true );
        if ( ! is_array( $settings ) ) $settings = array();

        $price = 0; $sale = 0; $has_sale = false;
        if ( class_exists( '\WPTravelEngine\Core\Models\Post\Trip' ) ) {
            try {
                $obj = new \WPTravelEngine\Core\Models\Post\Trip( get_post( $id ) );
                $price    = method_exists( $obj, 'get_price' )      ? $obj->get_price()      : 0;
                $sale     = method_exists( $obj, 'get_sale_price' ) ? $obj->get_sale_price() : 0;
                $has_sale = method_exists( $obj, 'has_sale' )       ? $obj->has_sale()       : false;
            } catch ( \Throwable $e ) {}
        }
        if ( ! $price ) {
            $price    = floatval( get_post_meta( $id, 'wp_travel_engine_setting_trip_price', true ) );
            $sale     = floatval( get_post_meta( $id, 'wp_travel_engine_setting_trip_prev_price', true ) );
            $has_sale = ( $sale > 0 && $sale < $price );
        }

        $duration      = $settings['trip_duration'] ?? '';
        $nights        = $settings['trip_duration_nights'] ?? '';
        $duration_unit = $settings['trip_duration_unit'] ?? 'days';
        $dur_text      = '';
        if ( $duration ) {
            if ( 'hours' === $duration_unit ) {
                $dur_text = $duration . ( (int) $duration === 1 ? ' Hour' : ' Hours' );
            } else {
                $dur_text = $duration . ' Days';
                if ( $nights ) $dur_text = $duration . ' Days / ' . $nights . ' Nights';
            }
        }

        $review = function_exists( 'ft_get_trip_review_data' ) ? ft_get_trip_review_data( $id ) : null;

        $dest_terms = wp_get_post_terms( $id, 'destination', array( 'fields' => 'names' ) );
        $diff_terms = wp_get_post_terms( $id, 'difficulty', array( 'fields' => 'names' ) );
        $act_terms  = wp_get_post_terms( $id, 'activities', array( 'fields' => 'names' ) );
        $featured   = get_post_meta( $id, 'wp_travel_engine_featured_trip', true ) === 'yes';
        $discount   = ( $has_sale && $price > 0 ) ? round( ( ( $price - $sale ) / $price ) * 100 ) : 0;

        $group = $settings['trip_maximum_pax'] ?? '';
        $trustindex = function_exists( 'get_field' ) ? get_field( 'trustindex_code', $id ) : '';

        return array(
            'id'          => $id,
            'title'       => get_the_title( $id ),
            'url'         => get_permalink( $id ),
            'image_id'    => get_post_thumbnail_id( $id ),
            'price'       => $price,
            'sale_price'  => $has_sale ? $sale : 0,
            'has_sale'    => $has_sale,
            'discount'    => $discount,
            'display'     => $has_sale ? $sale : $price,
            'duration'    => $dur_text,
            'destination' => ! empty( $dest_terms ) && ! is_wp_error( $dest_terms ) ? implode( ', ', $dest_terms ) : '',
            'difficulty'  => ! empty( $diff_terms ) && ! is_wp_error( $diff_terms ) ? $diff_terms[0] : '',
            'group_size'  => $group ? 'Up to ' . $group : '',
            'rating'      => $review ? $review['rating'] : 0,
            'review_count' => $review ? $review['count'] : 0,
            'featured'    => $featured,
            'trustindex'  => $trustindex,
            'trip_type'   => ! empty( $act_terms ) && ! is_wp_error( $act_terms ) ? $act_terms[0] : '',
        );
    }

    /* ─── Filter helpers ─── */

    private static function get_filter_terms( $taxonomy, $parent_term ) {
        $children = get_terms( array(
            'taxonomy'   => $taxonomy,
            'hide_empty' => true,
            'parent'     => $parent_term->term_id,
        ) );
        if ( empty( $children ) || is_wp_error( $children ) ) return array();
        return $children;
    }

    private static function get_scoped_terms( $taxonomy, $source_taxonomy, $source_slug ) {
        $terms = get_terms( array( 'taxonomy' => $taxonomy, 'hide_empty' => true ) );
        if ( empty( $terms ) || is_wp_error( $terms ) ) return array();

        $scoped = array();
        foreach ( $terms as $t ) {
            $count = get_posts( array(
                'post_type' => 'trip', 'post_status' => 'publish',
                'posts_per_page' => 1, 'fields' => 'ids',
                'tax_query' => array( 'relation' => 'AND',
                    array( 'taxonomy' => $source_taxonomy, 'field' => 'slug', 'terms' => $source_slug ),
                    array( 'taxonomy' => $taxonomy, 'field' => 'term_id', 'terms' => $t->term_id ),
                ),
            ) );
            if ( ! empty( $count ) ) {
                $t->trip_count = count( $count );
                $scoped[] = $t;
            }
        }
        return $scoped;
    }

    private static function get_duration_ranges( $taxonomy, $term_slug ) {
        $ids = get_posts( array(
            'post_type' => 'trip', 'post_status' => 'publish',
            'posts_per_page' => -1, 'fields' => 'ids',
            'tax_query' => array( array( 'taxonomy' => $taxonomy, 'field' => 'slug', 'terms' => $term_slug ) ),
        ) );
        $ranges = array( '1-3' => 0, '4-7' => 0, '8-14' => 0, '15+' => 0 );
        foreach ( $ids as $tid ) {
            $m = get_post_meta( $tid, 'wp_travel_engine_setting', true );
            $d = intval( $m['trip_duration'] ?? 0 );
            if ( $d >= 1 && $d <= 3 )       $ranges['1-3']++;
            elseif ( $d >= 4 && $d <= 7 )   $ranges['4-7']++;
            elseif ( $d >= 8 && $d <= 14 )  $ranges['8-14']++;
            elseif ( $d >= 15 )             $ranges['15+']++;
        }
        return array_filter( $ranges );
    }

    private static function build_all_tags( $term, $sub_terms, $activities, $trip_types, $difficulties, $destinations = array() ) {
        $tags     = array();
        $taxonomy = $term->taxonomy;

        foreach ( $sub_terms as $t )    $tags[] = array( 'taxonomy' => $taxonomy,     'slug' => $t->slug, 'name' => $t->name );
        foreach ( $destinations as $t ) $tags[] = array( 'taxonomy' => 'destination', 'slug' => $t->slug, 'name' => $t->name );
        foreach ( $activities as $t )   $tags[] = array( 'taxonomy' => 'activities',  'slug' => $t->slug, 'name' => $t->name );
        foreach ( $trip_types as $t )   $tags[] = array( 'taxonomy' => 'trip_types',  'slug' => $t->slug, 'name' => $t->name );
        foreach ( $difficulties as $t ) $tags[] = array( 'taxonomy' => 'difficulty',  'slug' => $t->slug, 'name' => $t->name );

        if ( ! empty( $tags ) ) return $tags;

        $trip_ids = get_posts( array(
            'post_type' => 'trip', 'post_status' => 'publish',
            'posts_per_page' => -1, 'fields' => 'ids',
            'tax_query' => array( array( 'taxonomy' => $taxonomy, 'field' => 'slug', 'terms' => $term->slug ) ),
        ) );
        if ( empty( $trip_ids ) ) return $tags;

        $tax_list = array( 'destination', 'activities', 'trip_types', 'difficulty' );
        foreach ( $tax_list as $tax ) {
            $seen = array();
            foreach ( $trip_ids as $pid ) {
                $pt = wp_get_post_terms( $pid, $tax, array( 'fields' => 'all' ) );
                if ( is_wp_error( $pt ) ) continue;
                foreach ( $pt as $t ) {
                    if ( $tax === $taxonomy && $t->term_id === $term->term_id ) continue;
                    if ( isset( $seen[ $t->term_id ] ) ) continue;
                    $seen[ $t->term_id ] = true;
                    $tags[] = array( 'taxonomy' => $tax, 'slug' => $t->slug, 'name' => $t->name );
                }
            }
        }
        return $tags;
    }

    /* ─── AJAX: Filter ─── */

    public static function ajax_filter() {
        check_ajax_referer( 'fts_dest_v2', 'nonce' );
        self::sync_currency_cookie();

        $slug     = sanitize_text_field( $_POST['destination_slug'] ?? $_POST['term_slug'] ?? '' );
        $taxonomy = sanitize_text_field( $_POST['taxonomy'] ?? 'destination' );
        $filters  = $_POST['filters'] ?? array();
        $sort     = sanitize_text_field( $_POST['sort'] ?? 'featured' );

        if ( ! in_array( $taxonomy, self::$supported_taxonomies, true ) ) $taxonomy = 'destination';

        $tax = array( 'relation' => 'AND', array( 'taxonomy' => $taxonomy, 'field' => 'slug', 'terms' => $slug ) );
        if ( ! empty( $filters['destination'] ) )  $tax[] = array( 'taxonomy' => 'destination', 'field' => 'slug', 'terms' => (array) $filters['destination'] );
        if ( ! empty( $filters['activities'] ) )    $tax[] = array( 'taxonomy' => 'activities',  'field' => 'slug', 'terms' => (array) $filters['activities'] );
        if ( ! empty( $filters['trip_types'] ) )    $tax[] = array( 'taxonomy' => 'trip_types',  'field' => 'slug', 'terms' => (array) $filters['trip_types'] );
        if ( ! empty( $filters['difficulty'] ) )    $tax[] = array( 'taxonomy' => 'difficulty',  'field' => 'slug', 'terms' => (array) $filters['difficulty'] );

        $meta = array(
            'relation' => 'OR',
            'featured_clause' => array( 'key' => 'wp_travel_engine_featured_trip', 'compare' => '=', 'value' => 'yes' ),
            'regular_clause'  => array( 'key' => 'wp_travel_engine_featured_trip', 'compare' => 'NOT EXISTS' ),
        );

        $q = new WP_Query( array(
            'post_type' => 'trip', 'post_status' => 'publish',
            'posts_per_page' => -1,
            'tax_query'  => $tax,
            'meta_query' => $meta,
            'orderby'    => array( 'featured_clause' => 'DESC', 'date' => 'DESC' ),
        ) );

        $cards = array();
        if ( $q->have_posts() ) {
            while ( $q->have_posts() ) { $q->the_post(); $cards[] = self::build_card_data( get_the_ID() ); }
        }
        wp_reset_postdata();

        switch ( $sort ) {
            case 'latest':
                usort( $cards, function( $a, $b ) { return $b['id'] <=> $a['id']; } );
                break;
            case 'price':
                usort( $cards, function( $a, $b ) { return $a['display'] <=> $b['display']; } );
                break;
            case 'price-desc':
                usort( $cards, function( $a, $b ) { return $b['display'] <=> $a['display']; } );
                break;
            case 'days':
                usort( $cards, function( $a, $b ) {
                    $da = intval( $a['duration'] );
                    $db = intval( $b['duration'] );
                    return $da <=> $db;
                } );
                break;
            case 'rating':
                usort( $cards, function( $a, $b ) {
                    if ( $b['rating'] == $a['rating'] ) return $b['review_count'] <=> $a['review_count'];
                    return $b['rating'] <=> $a['rating'];
                } );
                break;
        }

        ob_start();
        if ( ! empty( $cards ) ) {
            $base = get_stylesheet_directory() . '/destination-design-v2/parts/';
            foreach ( $cards as $trip ) { self::inc( $base . 'trip-card-v2.php', $trip ); }
        } else {
            self::inc( get_stylesheet_directory() . '/destination-design-v2/parts/no-results-v2.php', array() );
        }
        $html = ob_get_clean();

        wp_send_json_success( array( 'html' => $html, 'count' => $q->found_posts ) );
    }

    /* ─── AJAX: Load More ─── */

    public static function ajax_load_more() {
        check_ajax_referer( 'fts_dest_v2', 'nonce' );
        self::sync_currency_cookie();

        $slug     = sanitize_text_field( $_POST['destination_slug'] ?? $_POST['term_slug'] ?? '' );
        $taxonomy = sanitize_text_field( $_POST['taxonomy'] ?? 'destination' );
        $page     = intval( $_POST['page'] ?? 1 );

        if ( ! in_array( $taxonomy, self::$supported_taxonomies, true ) ) $taxonomy = 'destination';

        $q = new WP_Query( array(
            'post_type' => 'trip', 'post_status' => 'publish',
            'posts_per_page' => get_option( 'posts_per_page', 12 ),
            'paged'     => $page + 1,
            'tax_query' => array( array( 'taxonomy' => $taxonomy, 'field' => 'slug', 'terms' => $slug ) ),
            'meta_query' => array(
                'relation' => 'OR',
                'featured_clause' => array( 'key' => 'wp_travel_engine_featured_trip', 'compare' => '=', 'value' => 'yes' ),
                'regular_clause'  => array( 'key' => 'wp_travel_engine_featured_trip', 'compare' => 'NOT EXISTS' ),
            ),
            'orderby' => array( 'featured_clause' => 'DESC', 'date' => 'DESC' ),
        ) );

        ob_start();
        if ( $q->have_posts() ) {
            $base = get_stylesheet_directory() . '/destination-design-v2/parts/';
            while ( $q->have_posts() ) {
                $q->the_post();
                self::inc( $base . 'trip-card-v2.php', self::build_card_data( get_the_ID() ) );
            }
        }
        wp_reset_postdata();
        $html = ob_get_clean();

        wp_send_json_success( array( 'html' => $html, 'has_more' => ( $page + 1 ) < $q->max_num_pages ) );
    }

    /* ─── Helpers ─── */

    private static function sync_currency_cookie() {
        if ( ! empty( $_POST['currency_code'] ) ) {
            $code = sanitize_text_field( $_POST['currency_code'] );
            $_COOKIE['cc_code']            = $code;
            $_COOKIE['wte_currency_code']   = $code;
        }
    }

    private static function inc( $file, $data = array() ) {
        if ( ! file_exists( $file ) ) return;
        if ( ! empty( $data ) ) extract( $data );
        include $file;
    }

    public static function format_price( $amount ) {
        if ( function_exists( 'wte_get_formated_price' ) ) return wte_get_formated_price( $amount );
        return '$' . number_format( floatval( $amount ), 0 );
    }
}

FTS_Destination_V2::init();
