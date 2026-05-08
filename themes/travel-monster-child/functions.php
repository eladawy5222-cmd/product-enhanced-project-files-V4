<?php
// Exit if accessed directly
if ( !defined( 'ABSPATH' ) ) exit;

// BEGIN ENQUEUE PARENT ACTION
// AUTO GENERATED - Do not modify or remove comment markers above or below:

if ( !function_exists( 'chld_thm_cfg_locale_css' ) ):
    function chld_thm_cfg_locale_css( $uri ){
        if ( empty( $uri ) && is_rtl() && file_exists( get_template_directory() . '/rtl.css' ) )
            $uri = get_template_directory_uri() . '/rtl.css';
        return $uri;
    }
endif;
add_filter( 'locale_stylesheet_uri', 'chld_thm_cfg_locale_css' );
         
if ( !function_exists( 'child_theme_configurator_css' ) ):
    function child_theme_configurator_css() {
        $dependencies = array( 'travel-monster-style' );
        if ( wp_style_is( 'travel-monster-elementor', 'registered' ) ) {
            $dependencies[] = 'travel-monster-elementor';
        }
        wp_enqueue_style( 'chld_thm_cfg_child', trailingslashit( get_stylesheet_directory_uri() ) . 'style.css', $dependencies );
    }
endif;
add_action( 'wp_enqueue_scripts', 'child_theme_configurator_css', 20 );

// END ENQUEUE PARENT ACTION

add_action( 'wp_enqueue_scripts', function() {
    if ( ! is_singular( 'trip' ) ) return;
    if ( ! function_exists( 'get_field' ) ) return;
    $trip_id = get_the_ID();
    if ( ! $trip_id ) return;

    $code = (string) get_field( 'trustindex_code', $trip_id );
    if ( trim( $code ) === '' ) return;

    wp_enqueue_script(
        'fts-trustindex-loader',
        'https://cdn.trustindex.io/loader.js?49f81de492564412a126bfa9e75',
        array(),
        null,
        array( 'in_footer' => true, 'strategy' => 'defer' )
    );
}, 99 );


function fts_v2_default_free_cancellation_text( $trip_id = 0 ) {

    $v = '';
    if ( $trip_id > 0 ) {
        if ( function_exists( 'get_field' ) ) {
            $v = (string) get_field( 'free_cancellation_text', $trip_id );
        }
        if ( trim( $v ) === '' ) {
            $v = (string) get_post_meta( $trip_id, 'free_cancellation_text', true );
        }
    }

    $v = trim( $v );
    if ( $v !== '' ) return $v;

    $h = $trip_id > 0 ? intval( get_post_meta( $trip_id, 'fts_cancel_hours', true ) ) : 0;
    if ( $h > 0 ) {
        return 'Free cancellation up to ' . $h . ' hours before the tour start time (unless otherwise stated).';
    }
    return '';
}

add_filter( 'fts_v2_free_cancellation_text', function( $text, $trip_id, $settings ) {
    $text = is_string( $text ) ? trim( $text ) : '';
    if ( $text !== '' ) return $text;
    return fts_v2_default_free_cancellation_text( $trip_id );
}, 10, 3 );

add_filter( 'fts_v2_sidebar_trust_items', function( $items, $trip_id, $settings ) {
    $items = is_array( $items ) ? $items : array();
    $out = array();

    foreach ( $items as $it ) {
        if ( ! is_array( $it ) ) continue;
        $t = isset( $it['text'] ) ? trim( (string) $it['text'] ) : '';
        $lc = strtolower( $t );
        if ( $t !== '' && strpos( $lc, 'cancellation' ) !== false ) continue;
        $out[] = $it;
    }

    $fc = fts_v2_default_free_cancellation_text( $trip_id );
    if ( is_string( $fc ) && trim( $fc ) !== '' ) {
        $out[] = array( 'type' => 'clock', 'text' => trim( $fc ) );
    }

    return $out;
}, 10, 3 );

function fts_v2_get_trip_last_booked_timestamp( $trip_id = 0 ) {
    $trip_id = intval( $trip_id );
    if ( $trip_id <= 0 ) return 0;

    $ts = intval( get_post_meta( $trip_id, 'fts_last_booked_ts', true ) );
    if ( $ts > 0 ) return $ts;

    $q = new WP_Query( array(
        'post_type'              => 'booking',
        'posts_per_page'         => 1,
        'post_status'            => 'any',
        'orderby'                => 'date',
        'order'                  => 'DESC',
        'no_found_rows'          => true,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
        'meta_query'             => array(
            array(
                'key'     => 'trip_id',
                'value'   => $trip_id,
                'compare' => '=',
                'type'    => 'NUMERIC',
            ),
        ),
    ) );

    if ( ! empty( $q->posts ) ) {
        $p = $q->posts[0];
        if ( $p && isset( $p->post_date_gmt ) && $p->post_date_gmt ) {
            $t = strtotime( $p->post_date_gmt . ' GMT' );
            if ( $t ) return intval( $t );
        }
        if ( $p && isset( $p->post_date ) && $p->post_date ) {
            $t = strtotime( $p->post_date );
            if ( $t ) return intval( $t );
        }
    }

    return 0;
}

function fts_v2_get_trip_last_booked_minutes( $trip_id = 0 ) {
    $ts = fts_v2_get_trip_last_booked_timestamp( $trip_id );
    if ( $ts <= 0 ) return 0;
    $now = time();
    if ( $now < $ts ) return 0;
    $mins = intval( floor( ( max( 0, $now - $ts ) ) / 60 ) );
    if ( $mins < 1 ) $mins = 1;
    if ( $mins > 10080 ) return 0;
    return $mins;
}

add_filter( 'fts_v2_social_proof', function( $data, $trip_id, $settings ) {
    $data = is_array( $data ) ? $data : array();
    $mins = fts_v2_get_trip_last_booked_minutes( $trip_id );
    if ( $mins > 0 ) $data['last_booked_minutes'] = $mins;
    if ( ! isset( $data['viewer_count'] ) ) $data['viewer_count'] = 0;
    return $data;
}, 10, 3 );

add_filter( 'fts_v2_enable_social_proof', function( $enabled, $trip_id, $settings ) {
    return fts_v2_get_trip_last_booked_timestamp( $trip_id ) > 0;
}, 10, 3 );


/* ================ بيانات الريڤيو اليدوية ================ */
function ft_static_trip_reviews() {
    return [
        // اضف سطر لكل رحلة (الـ slug = آخر جزء من الرابط بدون slash)
        'hurghada-luxor-valley-of-the-kings-tutankhamun-tomb-day-trip' => [
            'rating' => 4.5,
            'count'  => 958,
        ],
        // 'slug-تاني' => ['rating'=>4.2,'count'=>120],
    ];
}

function ft_get_trip_review_data( $post_id ) {
    // slug بدون slash فى آخره
    $slug = untrailingslashit( basename( get_permalink( $post_id ) ) );
    $data = ft_static_trip_reviews();
    return isset( $data[ $slug ] ) ? $data[ $slug ] : false;
}

add_action('wp_travel_engine_after_booking_inserted', function($booking_id, $booking_data) {
    $trip_id = isset($booking_data['trip_id']) ? intval($booking_data['trip_id']) : 0;

    if ($trip_id > 0) {
        update_post_meta($trip_id, 'fts_last_booked_ts', time());

        // 1. نحاول أولًا جلب Trip Code من حقل ACF أو WP Travel Engine
        $trip_code = '';
        
        // لو في WP Travel Engine أو ACF، غالبًا يكون اسمه 'trip_code'
        if (function_exists('get_field')) {
            $trip_code = get_field('trip_code', $trip_id);
        }

        // 2. لو لم تنجح نحاول من الحقول العادية
        if (!$trip_code) {
            $trip_code = get_post_meta($trip_id, 'trip_code', true);
        }

        // 3. كخطوة أخيرة نجرب post meta باسم 'code'
        if (!$trip_code) {
            $trip_code = get_post_meta($trip_id, 'code', true);
        }

        // 4. نحفظها في الحجز إن وجدت
        if ($trip_code) {
            update_post_meta($booking_id, 'trip_code', sanitize_text_field($trip_code));
        }
    }
}, 10, 2);

function fts_v2_touch_last_booked_ts_on_inventory_change( $meta_id, $object_id, $meta_key, $_meta_value ) {
    if ( $meta_key !== '_booking_inventory' ) return;
    $object_id = intval( $object_id );
    if ( $object_id <= 0 ) return;
    if ( get_post_type( $object_id ) !== 'trip' ) return;
    update_post_meta( $object_id, 'fts_last_booked_ts', time() );
}

add_action( 'added_post_meta', 'fts_v2_touch_last_booked_ts_on_inventory_change', 10, 4 );
add_action( 'updated_post_meta', 'fts_v2_touch_last_booked_ts_on_inventory_change', 10, 4 );

function fts_v2_sync_last_booked_ts_from_inventory( $trip_id = 0 ) {
    $trip_id = intval( $trip_id );
    if ( $trip_id <= 0 ) return;

    $inv = get_post_meta( $trip_id, '_booking_inventory', true );
    $has_inv = is_array( $inv ) ? ! empty( $inv ) : ( trim( (string) $inv ) !== '' );
    if ( ! $has_inv ) return;

    $hash = md5( maybe_serialize( $inv ) );
    $prev = (string) get_post_meta( $trip_id, 'fts_booking_inventory_hash', true );

    if ( $prev !== $hash ) {
        update_post_meta( $trip_id, 'fts_booking_inventory_hash', $hash );
        update_post_meta( $trip_id, 'fts_last_booked_ts', time() );
        return;
    }

    $ts = intval( get_post_meta( $trip_id, 'fts_last_booked_ts', true ) );
    if ( $ts <= 0 ) {
        update_post_meta( $trip_id, 'fts_last_booked_ts', time() );
    }
}

add_action( 'wp', function() {
    if ( ! is_singular( 'trip' ) ) return;
    $trip_id = get_queried_object_id();
    if ( ! $trip_id ) return;
    fts_v2_sync_last_booked_ts_from_inventory( $trip_id );
}, 9 );

function fts_v2_trip_viewers_route() {
    register_rest_route(
        'fts/v1',
        '/trip-viewers',
        array(
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => function( WP_REST_Request $req ) {
                $trip_id   = intval( $req->get_param( 'trip_id' ) );
                $viewer_id = (string) $req->get_param( 'viewer_id' );
                $viewer_id = preg_replace( '/[^a-zA-Z0-9_-]/', '', $viewer_id );
                if ( $trip_id <= 0 || $viewer_id === '' || strlen( $viewer_id ) > 64 ) {
                    return new WP_REST_Response( array( 'viewer_count' => 0 ), 200 );
                }

                $key = 'fts_v2_viewers_' . $trip_id;
                $now = time();

                $data = get_site_transient( $key );
                if ( ! is_array( $data ) ) $data = array();

                $cutoff = $now - 120;
                foreach ( $data as $k => $ts ) {
                    if ( intval( $ts ) < $cutoff ) unset( $data[ $k ] );
                }

                $data[ $viewer_id ] = $now;

                if ( count( $data ) > 250 ) {
                    asort( $data );
                    $data = array_slice( $data, -200, null, true );
                }

                set_site_transient( $key, $data, 10 * MINUTE_IN_SECONDS );

                return new WP_REST_Response(
                    array(
                        'viewer_count' => count( $data ),
                        'window_sec'   => 120,
                    ),
                    200
                );
            },
        )
    );
}

add_action( 'rest_api_init', 'fts_v2_trip_viewers_route' );
// Register the "trip_code" meta to appear in the REST API response
function register_trip_code_api_field() {
    register_rest_field('booking', 'trip_code', array(
        'get_callback'    => function($object) {
            return get_post_meta($object['id'], 'trip_code', true);
        },
        'update_callback' => null,
        'schema'          => null,
    ));
}
add_action('rest_api_init', 'register_trip_code_api_field');

/* ================ Package Taxonomy & Functionality ================ */

// 1. إنشاء Taxonomy للـ Package
function create_package_taxonomy() {
    $labels = array(
        'name'              => 'Packages',
        'singular_name'     => 'Package',
        'search_items'      => 'Search Packages',
        'all_items'         => 'All Packages',
        'edit_item'         => 'Edit Package',
        'update_item'       => 'Update Package',
        'add_new_item'      => 'Add New Package',
        'new_item_name'     => 'New Package Name',
        'menu_name'         => 'Packages',
    );

    $args = array(
        'hierarchical'      => true,
        'labels'            => $labels,
        'show_ui'           => true,
        'show_admin_column' => true,
        'query_var'         => true,
        'rewrite'           => array(
            'slug' => 'packages',
            'with_front' => false,
            'hierarchical' => true,
        ),
        'show_in_rest'      => true,
        'public'            => true,
        'show_in_nav_menus' => true,
        'publicly_queryable' => true,
    );

    register_taxonomy('packages', 'trip', $args);
}
add_action('init', 'create_package_taxonomy');

// إضافة Packages للفلتر الأصلي في WP Travel Engine
function add_packages_to_archive_filter($taxonomies) {
    $taxonomies['packages'] = array(
        'taxonomy' => 'packages',
        'title' => __('Packages', 'wp-travel-engine'),
    );
    return $taxonomies;
}
add_filter('wte_advanced_search_filter_taxonomies', 'add_packages_to_archive_filter');

// AJAX handler لفلترة جميع رحلات الـ Packages
function filter_all_package_trips_ajax() {
    // تحقق من الأمان
    if (!wp_verify_nonce($_POST['nonce'], 'filter_all_package_trips')) {
        wp_die('Security check failed');
    }
    
    $filters = $_POST['filters'];
    
    // بناء الـ tax_query
    $tax_query = array('relation' => 'AND');
    
    // إضافة شرط أن الرحلة لازم تكون في أي package (فقط لو مفيش packages محددة)
    if (empty($filters['packages'])) {
        $tax_query[] = array(
            'taxonomy' => 'packages',
            'operator' => 'EXISTS',
        );
    }
    
    // إضافة فلاتر إضافية
    if (!empty($filters['destination']) && is_array($filters['destination'])) {
        $tax_query[] = array(
            'taxonomy' => 'destination',
            'field' => 'slug',
            'terms' => $filters['destination'],
        );
    }
    
    if (!empty($filters['activities']) && is_array($filters['activities'])) {
        $tax_query[] = array(
            'taxonomy' => 'activities',
            'field' => 'slug',
            'terms' => $filters['activities'],
        );
    }
    
    if (!empty($filters['trip_types']) && is_array($filters['trip_types'])) {
        $tax_query[] = array(
            'taxonomy' => 'trip_types',
            'field' => 'slug',
            'terms' => $filters['trip_types'],
        );
    }
    
    if (!empty($filters['packages']) && is_array($filters['packages'])) {
        $tax_query[] = array(
            'taxonomy' => 'packages',
            'field' => 'slug',
            'terms' => $filters['packages'],
        );
    }
    
    if (!empty($filters['difficulty']) && is_array($filters['difficulty'])) {
        $tax_query[] = array(
            'taxonomy' => 'difficulty',
            'field' => 'slug',
            'terms' => $filters['difficulty'],
        );
    }
    
    // إضافة meta query للـ Duration والـ Price
    $meta_query = array('relation' => 'AND');
    
    // فلتر المدة
    if (!empty($filters['duration']) && is_array($filters['duration'])) {
        $duration_conditions = array('relation' => 'OR');
        foreach ($filters['duration'] as $duration_range) {
            switch ($duration_range) {
                case '1-3':
                    $duration_conditions[] = array(
                        'key' => 'wp_travel_engine_setting',
                        'value' => array(1, 2, 3),
                        'compare' => 'IN',
                        'type' => 'NUMERIC'
                    );
                    break;
                case '4-7':
                    $duration_conditions[] = array(
                        'key' => 'wp_travel_engine_setting',
                        'value' => array(4, 5, 6, 7),
                        'compare' => 'IN',
                        'type' => 'NUMERIC'
                    );
                    break;
                case '8-14':
                    $duration_conditions[] = array(
                        'relation' => 'AND',
                        array(
                            'key' => 'wp_travel_engine_setting',
                            'value' => 8,
                            'compare' => '>=',
                            'type' => 'NUMERIC'
                        ),
                        array(
                            'key' => 'wp_travel_engine_setting',
                            'value' => 14,
                            'compare' => '<=',
                            'type' => 'NUMERIC'
                        )
                    );
                    break;
                case '15+':
                    $duration_conditions[] = array(
                        'key' => 'wp_travel_engine_setting',
                        'value' => 15,
                        'compare' => '>=',
                        'type' => 'NUMERIC'
                    );
                    break;
            }
        }
        if (count($duration_conditions) > 1) {
            $meta_query[] = $duration_conditions;
        }
    }
    
    
    // Query للرحلات
    $args = array(
        'post_type' => 'trip',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'tax_query' => $tax_query,
    );
    
    if (count($meta_query) > 1) {
        $args['meta_query'] = $meta_query;
    }
    
    $trips = new WP_Query($args);
    
    ob_start();
    if ($trips->have_posts()) :
        while ($trips->have_posts()) : $trips->the_post();
            if (function_exists('wptravelengine_get_template')) {
                // Initialize WP Travel Engine variables properly
                global $post;
                $all_args = wte_get_trip_details( $post->ID );
                $all_args['user_wishlists'] = wptravelengine_user_wishlists();
                $all_args['related_query'] = true;
                foreach ( $all_args as $key => $value ) {
                    wptravelengine_set_template_args( array( $key => $value ) );
                }
                wptravelengine_get_template('content-related-trip.php');
            } else {
                // Fallback display
                ?>
                <div class="category-trips-single-wrap">
                    <div class="category-trips-single">
                        <figure class="category-trip-fig">
                            <a href="<?php the_permalink(); ?>">
                                <?php
                                if (has_post_thumbnail()) {
                                    the_post_thumbnail('medium');
                                } else {
                                    echo '<div class="no-image">No Image</div>';
                                }
                                ?>
                            </a>
                        </figure>
                        <div class="category-trip-detail">
                            <h3 class="category-trip-title">
                                <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                            </h3>
                            
                            <?php
                            // إضافة سكريبت Trustindex من الـ custom field
                            $trustindex_code = get_field('trustindex_code', get_the_ID());
                            if (!empty($trustindex_code)) {
                                echo $trustindex_code;
                            }
                            ?>
                            
                            <div class="category-trip-excerpt">
                                <?php the_excerpt(); ?>
                            </div>
                        </div>
                    </div>
                </div>
                <?php
            }
        endwhile;
    else :
        echo '<div class="no-trips-found">';
        echo '<h3>No trips found with the selected filters.</h3>';
        echo '<p>Please try different filter options.</p>';
        echo '</div>';
    endif;
    
    wp_reset_postdata();
    $html = ob_get_clean();
    
    wp_send_json_success(array('html' => $html));
}
add_action('wp_ajax_filter_all_package_trips', 'filter_all_package_trips_ajax');
add_action('wp_ajax_nopriv_filter_all_package_trips', 'filter_all_package_trips_ajax');

// AJAX handler للفلترة في صفحة Package منفردة
function filter_single_package_trips_ajax() {
    // التحقق من الـ nonce
    if (!wp_verify_nonce($_POST['nonce'], 'filter_single_package_trips')) {
        wp_die('Security check failed');
    }
    
    $filters = $_POST['filters'];
    $package_slug = sanitize_text_field($_POST['package_slug']);
    
    // بناء الـ tax_query
    $tax_query = array('relation' => 'AND');
    
    // إضافة Package الحالي
    $tax_query[] = array(
        'taxonomy' => 'packages',
        'field' => 'slug',
        'terms' => $package_slug,
    );
    
    if (!empty($filters['destination']) && is_array($filters['destination'])) {
        $tax_query[] = array(
            'taxonomy' => 'destination',
            'field' => 'slug',
            'terms' => $filters['destination'],
        );
    }
    
    if (!empty($filters['activities']) && is_array($filters['activities'])) {
        $tax_query[] = array(
            'taxonomy' => 'activities',
            'field' => 'slug',
            'terms' => $filters['activities'],
        );
    }
    
    if (!empty($filters['trip_types']) && is_array($filters['trip_types'])) {
        $tax_query[] = array(
            'taxonomy' => 'trip_types',
            'field' => 'slug',
            'terms' => $filters['trip_types'],
        );
    }
    
    if (!empty($filters['difficulty']) && is_array($filters['difficulty'])) {
        $tax_query[] = array(
            'taxonomy' => 'difficulty',
            'field' => 'slug',
            'terms' => $filters['difficulty'],
        );
    }
    
    // إضافة meta query للـ Duration
    $meta_query = array('relation' => 'AND');
    
    // فلتر المدة
    if (!empty($filters['duration']) && is_array($filters['duration'])) {
        $duration_conditions = array('relation' => 'OR');
        foreach ($filters['duration'] as $duration_range) {
            switch ($duration_range) {
                case '1-3':
                    $duration_conditions[] = array(
                        'key' => 'wp_travel_engine_setting',
                        'value' => array(1, 2, 3),
                        'compare' => 'IN',
                        'type' => 'NUMERIC'
                    );
                    break;
                case '4-7':
                    $duration_conditions[] = array(
                        'key' => 'wp_travel_engine_setting',
                        'value' => array(4, 5, 6, 7),
                        'compare' => 'IN',
                        'type' => 'NUMERIC'
                    );
                    break;
                case '8-14':
                    $duration_conditions[] = array(
                        'relation' => 'AND',
                        array(
                            'key' => 'wp_travel_engine_setting',
                            'value' => 8,
                            'compare' => '>=',
                            'type' => 'NUMERIC'
                        ),
                        array(
                            'key' => 'wp_travel_engine_setting',
                            'value' => 14,
                            'compare' => '<=',
                            'type' => 'NUMERIC'
                        )
                    );
                    break;
                case '15+':
                    $duration_conditions[] = array(
                        'key' => 'wp_travel_engine_setting',
                        'value' => 15,
                        'compare' => '>=',
                        'type' => 'NUMERIC'
                    );
                    break;
            }
        }
        if (count($duration_conditions) > 1) {
            $meta_query[] = $duration_conditions;
        }
    }
    
    // Query للرحلات
    $args = array(
        'post_type' => 'trip',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'tax_query' => $tax_query,
    );
    
    if (count($meta_query) > 1) {
        $args['meta_query'] = $meta_query;
    }
    
    $trips = new WP_Query($args);
    
    ob_start();
    if ($trips->have_posts()) :
        while ($trips->have_posts()) : $trips->the_post();
            if (function_exists('wptravelengine_get_template')) {
                // Initialize WP Travel Engine variables properly
                global $post;
                $all_args = wte_get_trip_details( $post->ID );
                $all_args['user_wishlists'] = wptravelengine_user_wishlists();
                $all_args['related_query'] = true;
                foreach ( $all_args as $key => $value ) {
                    wptravelengine_set_template_args( array( $key => $value ) );
                }
                wptravelengine_get_template('content-related-trip.php');
            } else {
                // Fallback display
                ?>
                <div class="category-trips-single-wrap">
                    <div class="category-trips-single">
                        <figure class="category-trip-fig">
                            <a href="<?php the_permalink(); ?>">
                                <?php
                                if (has_post_thumbnail()) {
                                    the_post_thumbnail('medium');
                                } else {
                                    echo '<div class="no-image">No Image</div>';
                                }
                                ?>
                            </a>
                        </figure>
                        <div class="category-trip-detail">
                            <h3 class="category-trip-title">
                                <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                            </h3>
                            
                            <?php
                            // إضافة سكريبت Trustindex من الـ custom field
                            $trustindex_code = get_field('trustindex_code', get_the_ID());
                            if (!empty($trustindex_code)) {
                                echo $trustindex_code;
                            }
                            ?>
                            
                            <div class="category-trip-excerpt">
                                <?php the_excerpt(); ?>
                            </div>
                            <div class="category-trip-meta">
                                <?php
                                $trip_meta = get_post_meta(get_the_ID(), 'wp_travel_engine_setting', true);
                                if (isset($trip_meta['trip_duration']) && !empty($trip_meta['trip_duration'])) {
                                    echo '<span class="trip-duration">' . esc_html($trip_meta['trip_duration']) . ' Days</span>';
                                }
                                ?>
                            </div>
                        </div>
                    </div>
                </div>
                <?php
            }
        endwhile;
    else :
        echo '<div class="no-trips-found">';
        echo '<h3>' . __('No trips found with selected filters.', 'wp-travel-engine') . '</h3>';
        echo '<p>' . __('Please try different filter options.', 'wp-travel-engine') . '</p>';
        echo '</div>';
    endif;
    
    wp_reset_postdata();
    $html = ob_get_clean();
    
    wp_send_json_success(array(
        'html' => $html,
        'count' => $trips->found_posts
    ));
}

add_action('wp_ajax_filter_single_package_trips', 'filter_single_package_trips_ajax');
add_action('wp_ajax_nopriv_filter_single_package_trips', 'filter_single_package_trips_ajax');

// AJAX handler للـ Load More
function load_more_package_trips_ajax() {
    // التحقق من الـ nonce
    if (!wp_verify_nonce($_POST['nonce'], 'load_more_package_trips')) {
        wp_die('Security check failed');
    }
    
    $page = intval($_POST['page']);
    $type = sanitize_text_field($_POST['type']);
    $package_slug = isset($_POST['package_slug']) ? sanitize_text_field($_POST['package_slug']) : '';
    
    // إعداد الـ query حسب النوع
    $args = array(
        'post_type' => 'trip',
        'post_status' => 'publish',
        'posts_per_page' => get_option('posts_per_page', 10),
        'paged' => $page + 1, // الصفحة التالية
    );
    
    if ($type === 'all-packages') {
        // جميع الـ packages
        $args['tax_query'] = array(
            array(
                'taxonomy' => 'packages',
                'operator' => 'EXISTS',
            ),
        );
    } else {
        // package محدد
        $args['tax_query'] = array(
            array(
                'taxonomy' => 'packages',
                'field' => 'slug',
                'terms' => $package_slug,
            ),
        );
    }
    
    $trips = new WP_Query($args);
    
    ob_start();
    if ($trips->have_posts()) :
        while ($trips->have_posts()) : $trips->the_post();
            if (function_exists('wptravelengine_get_template')) {
                // Initialize WP Travel Engine variables properly
                global $post;
                $all_args = wte_get_trip_details( $post->ID );
                $all_args['user_wishlists'] = wptravelengine_user_wishlists();
                $all_args['related_query'] = true;
                foreach ( $all_args as $key => $value ) {
                    wptravelengine_set_template_args( array( $key => $value ) );
                }
                wptravelengine_get_template('content-related-trip.php');
            }
        endwhile;
    endif;
    
    wp_reset_postdata();
    $html = ob_get_clean();
    
    wp_send_json_success(array(
        'html' => $html,
        'has_more' => ($page + 1) < $trips->max_num_pages
    ));
}

add_action('wp_ajax_load_more_package_trips', 'load_more_package_trips_ajax');
add_action('wp_ajax_nopriv_load_more_package_trips', 'load_more_package_trips_ajax');

// 3. إضافة Packages للقائمة الرئيسية تلقائياً — معطّل، المنيو بيسحب من Primary بالظبط
// function add_packages_to_menu($items, $args) { ... }
// add_filter('wp_nav_menu_items', 'add_packages_to_menu', 10, 2);

// 4. إصلاح مشكلة 404 للصفحة /packages/
add_action('init', function() {
    // إضافة rewrite rule للـ packages archive
    add_rewrite_rule('^packages/?$', 'index.php?post_type=trip&packages_archive=1', 'top');
    
    // flush rewrite rules مرة واحدة فقط
    if (get_option('packages_rewrite_flushed') !== 'yes') {
        flush_rewrite_rules();
        update_option('packages_rewrite_flushed', 'yes');
    }
});

// إضافة query var للـ packages archive
add_filter('query_vars', function($vars) {
    $vars[] = 'packages_archive';
    return $vars;
});

// معالجة template للـ packages archive
add_action('template_redirect', function() {
    if (get_query_var('packages_archive')) {
        $template = get_stylesheet_directory() . '/archive-packages.php';
        if (file_exists($template)) {
            include($template);
            exit;
        }
    }
});

// 5. إضافة Trustindex code تحت عنوان الرحلة في جميع القوالب
function add_trustindex_code_after_title() {
    if (function_exists('get_field')) {
        $trustindex_code = get_field('trustindex_code', get_the_ID());
        if (!empty($trustindex_code)) {
            echo '<div class="trip-trustindex-wrapper">' . $trustindex_code . '</div>';
        }
    }
}
add_action('wptravelengine_after_trip_title', 'add_trustindex_code_after_title');
add_action('wptravelengine_after_archive_trip_title', 'add_trustindex_code_after_title');

// Package functionality is now complete and working with WP Travel Engine integration!

/* ================ تحسين البوب اب - كل الصور تفتح Gallery (للديسك توب فقط) ================ */
add_action('wp_footer', function() {
    if (!is_singular('trip') || wp_is_mobile()) return;
    ?>
    <script>
    jQuery(function($) {
        // إزالة data-fancybox من صور الـ Grid
        $('a[data-fancybox="gallery"]').removeAttr('data-fancybox');
        
        // فتح زر Gallery عند النقر على أي صورة
        $(document).on('click', '.wpte-multi-banner-image a, .wpte-multi-banner-image img, .splide__slide img', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            $('.wte-trip-image-gal-popup-trigger')[0]?.click();
            return false;
        });
        
        // تحسين المظهر
        $('.wpte-multi-banner-image, .splide__slide img').css('cursor', 'pointer');
    });
    </script>
    <style>
    @media (min-width: 769px) {
        .wpte-multi-banner-image, .wpte-multi-banner-image a, .wpte-multi-banner-image img, .splide__slide img {
            cursor: pointer !important;
        }
        .wpte-multi-banner-image:hover img, .splide__slide:hover img {
            transform: scale(1.02);
            transition: transform 0.3s ease;
        }
    }
    </style>
    <?php
}, 999);

/* ================ Featured Trips Widget - عرض رحلات من نفس الـ Destination ================ */
/*
 * تخصيص Featured Trips Widget ليعرض رحلات من نفس الـ Destination في صفحات الرحلات
 * - يستبعد الـ Parent Destinations ويستخدم الـ Child فقط
 * - إذا لم يجد رحلات featured، يعرض رحلات عادية من نفس الـ Destination
 * - يستبعد الرحلة الحالية من النتائج
 */
class Custom_WTE_Featured_Trips_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'wte_featured_trips_widget',
            'WP Travel Engine: Featured Trips Widget',
            array('description' => __('A Featured Trips Widget for WP Travel Engine.', 'wp-travel-engine'))
        );
    }
    
    public function widget($args, $instance) {
        extract($args);
        $title = apply_filters('widget_title', isset($instance['title']) ? $instance['title'] : '');
        $num_post = !empty($instance['num_post']) ? $instance['num_post'] : 3;
        
        echo $before_widget;
        if (!empty($title)) {
            echo $before_title . $title . $after_title;
        }
        
        // فلترة حسب الـ destination في صفحات الرحلات
        $tax_query = array();
        
        if (is_singular('trip')) {
            global $post;
            $current_destinations = wp_get_post_terms($post->ID, 'destination', array('fields' => 'ids'));
            
            if (!empty($current_destinations)) {
                // فلترة الـ destinations - استبعاد الـ parent واستخدام الـ child فقط
                $filtered_destinations = array();
                
                foreach ($current_destinations as $dest_id) {
                    $term = get_term($dest_id, 'destination');
                    if ($term && $term->parent != 0) {
                        $filtered_destinations[] = $dest_id;
                    }
                }
                
                // إذا لم يتم العثور على child destinations، استخدم الكل
                if (empty($filtered_destinations)) {
                    $filtered_destinations = $current_destinations;
                }
                
                $tax_query = array(
                    array(
                        'taxonomy' => 'destination',
                        'field'    => 'term_id',
                        'terms'    => $filtered_destinations,
                    ),
                );
            }
        }
        
        // محاولة جلب رحلات featured أولاً
        $query_args = array(
            'post_type'      => 'trip',
            'posts_per_page' => $num_post,
            'meta_key'       => 'wp_travel_engine_featured_trip',
            'meta_value'     => 'yes',
            'meta_compare'   => '=',
        );
        
        // إضافة فلتر الـ destination
        if (!empty($tax_query)) {
            $query_args['tax_query'] = $tax_query;
            if (is_singular('trip')) {
                global $post;
                $query_args['post__not_in'] = array($post->ID);
            }
        }
        
        $query = new WP_Query($query_args);
        
        // إذا لم يتم العثور على رحلات featured، جرب بدون شرط featured
        if (!$query->have_posts() && !empty($tax_query)) {
            wp_reset_postdata();
            unset($query_args['meta_key']);
            unset($query_args['meta_value']);
            unset($query_args['meta_compare']);
            $query = new WP_Query($query_args);
        }
        
        // عرض الرحلات
        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $details = wte_get_trip_details(get_the_ID());
                wte_get_template('widgets/content-widget-feat-trip.php', $details);
            }
        }
        wp_reset_postdata();
        
        echo $after_widget;
    }
    
    public function form($instance) {
        $title = isset($instance['title']) ? $instance['title'] : __('Featured Trips', 'wp-travel-engine');
        $num_post = isset($instance['num_post']) ? $instance['num_post'] : 3;
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_name('title')); ?>"><?php esc_html_e('Title:', 'wp-travel-engine'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" name="<?php echo esc_attr($this->get_field_name('title')); ?>" type="text" value="<?php echo esc_attr($title); ?>" />
        </p>
        <p>
            <label for="<?php echo esc_attr($this->get_field_name('num_post')); ?>"><?php esc_html_e('Number of Posts:', 'wp-travel-engine'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('num_post')); ?>" name="<?php echo esc_attr($this->get_field_name('num_post')); ?>" type="text" value="<?php echo esc_attr($num_post); ?>" />
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = !empty($new_instance['title']) ? strip_tags($new_instance['title']) : '';
        $instance['num_post'] = !empty($new_instance['num_post']) ? absint($new_instance['num_post']) : '';
        return $instance;
    }
}

// إلغاء تسجيل الـ Widget الأصلي وتسجيل الجديد
function replace_featured_trips_widget() {
    unregister_widget('WTE_Featured_Trips_Widget');
    register_widget('Custom_WTE_Featured_Trips_Widget');
}
add_action('widgets_init', 'replace_featured_trips_widget', 999); // أعلى priority

// استبدال الـ Widget الأصلي بالـ Custom Widget في صفحات الرحلات
add_filter('widget_display_callback', function($instance, $widget, $args) {
    if ($widget->id_base === 'wte_featured_trips_widget' && is_singular('trip')) {
        ob_start();
        $custom_widget = new Custom_WTE_Featured_Trips_Widget();
        $custom_widget->widget($args, $instance);
        $output = ob_get_clean();
        echo $output;
        return false;
    }
    return $instance;
}, 999, 3);

// تعديل query الـ Featured Trips Widget في صفحات الرحلات
add_action('pre_get_posts', function($query) {
    if (!is_admin() && 
        !$query->is_main_query() && 
        $query->get('post_type') === 'trip' && 
        $query->get('meta_key') === 'wp_travel_engine_featured_trip' &&
        is_singular('trip')) {
        
        global $post;
        $current_destinations = wp_get_post_terms($post->ID, 'destination', array('fields' => 'ids'));
        
        if (!empty($current_destinations)) {
            // فلترة الـ destinations - استبعاد الـ parent واستخدام الـ child فقط
            $filtered_destinations = array();
            foreach ($current_destinations as $dest_id) {
                $term = get_term($dest_id, 'destination');
                if ($term && $term->parent != 0) {
                    $filtered_destinations[] = $dest_id;
                }
            }
            
            if (empty($filtered_destinations)) {
                $filtered_destinations = $current_destinations;
            }
            
            $query->set('tax_query', array(
                array(
                    'taxonomy' => 'destination',
                    'field'    => 'term_id',
                    'terms'    => $filtered_destinations,
                ),
            ));
            
            $query->set('post__not_in', array($post->ID));
        }
    }
}, 999);

/* ================ Related Trips - عرض رحلات من نفس الـ Destination ================ */
add_filter('option_wp_travel_engine_settings', function($settings) {
    if (is_singular('trip')) {
        $settings['related_trip_show_by'] = 'destination';
    }
    return $settings;
});

/* ===============================================================================
   Related Trips - عرض رحلات من نفس الـ Destination فقط
   =============================================================================== */

// تغيير إعداد Related Trips ليعرض حسب Destination
add_filter('option_wp_travel_engine_settings', function($settings) {
    if (is_singular('trip')) {
        $settings['related_trip_show_by'] = 'destination';
    }
    return $settings;
});

// تعديل query الـ Related Trips لاستبعاد Parent Destinations
add_action('pre_get_posts', function($query) {
    // التحقق من أنه query الـ Related Trips
    if (!is_admin() && 
        !$query->is_main_query() && 
        $query->get('post_type') === 'trip' &&
        is_singular('trip') &&
        isset($query->query_vars['tax_query'])) {
        
        global $post;
        $current_destinations = wp_get_post_terms($post->ID, 'destination', array('fields' => 'ids'));
        
        if (!empty($current_destinations)) {
            // فلترة الـ destinations - استبعاد الـ parent واستخدام الـ child فقط
            $filtered_destinations = array();
            
            foreach ($current_destinations as $dest_id) {
                $term = get_term($dest_id, 'destination');
                // استخدام الـ child destinations فقط (اللي لها parent)
                if ($term && $term->parent != 0) {
                    $filtered_destinations[] = $dest_id;
                }
            }
            
            // إذا لم يتم العثور على child destinations، استخدم الكل
            if (empty($filtered_destinations)) {
                $filtered_destinations = $current_destinations;
            }
            
            // تحديث الـ tax_query
            $query->set('tax_query', array(
                array(
                    'taxonomy' => 'destination',
                    'field'    => 'term_id',
                    'terms'    => $filtered_destinations,
                ),
            ));
        }
    }
}, 20);
/* ===============================================================================
   FTS Custom Video & Single Trip Features (Robust V3)
   =============================================================================== */
require_once get_stylesheet_directory() . '/single-trip-custom.php';
require_once get_stylesheet_directory() . '/fts-enquiry-sidebar.php';
function add_font_awesome() {
    wp_enqueue_style('font-awesome-6', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css' );
}
add_action('wp_enqueue_scripts', 'add_font_awesome');

// Disabled: old single trip layout replaced by V2
// require_once get_stylesheet_directory() . '/fts-single-trip-layout.php';
require_once get_stylesheet_directory() . '/fts-excerpt-control.php';
require_once get_stylesheet_directory() . '/destination-functions.php';
/* ===============================================================================
   Fix 1: During AJAX, wp_travel_engine_currency_code returns DB currency (EGP)
   because is_admin()=true in admin-ajax.php. But wte_before_formatting_price_figure
   reads cc_code cookie directly and converts the price. This mismatch causes
   format_number to think currencies are the same → preserves all decimal places.
   We fix this by returning the correct currency from the cc_code cookie during AJAX.
   =============================================================================== */
add_filter( 'wp_travel_engine_currency_code', function ( $code, $use_default ) {
    if ( $use_default ) {
        return $code;
    }
    if ( wp_doing_ajax() && isset( $_COOKIE['cc_code'] ) && ! empty( $_COOKIE['cc_code'] ) ) {
        return sanitize_text_field( strtoupper( $_COOKIE['cc_code'] ) );
    }
    return $code;
}, 20, 2 );

/* ===============================================================================
   Fix 2: Safety-net for price formatting – always enforce max decimal places.
   Catches any case where wptravelengine_handle_currency_conversion() would
   otherwise preserve excessive decimals from currency conversion.
   =============================================================================== */
add_filter( 'wte_currency_converter_format_number', function ( $formatted, $args ) {
    $num      = isset( $args['num'] ) ? (float) $args['num'] : 0;
    $dec_sep  = isset( $args['decimal_separator'] )   ? $args['decimal_separator']   : '.';
    $th_sep   = isset( $args['thousands_separator'] ) ? $args['thousands_separator'] : ',';

    // Determine max decimals: use WTE setting or default to 2.
    $wte_settings = get_option( 'wp_travel_engine_settings', array() );
    $max_dec      = isset( $wte_settings['decimal_digits'] ) && is_numeric( $wte_settings['decimal_digits'] )
                    ? (int) $wte_settings['decimal_digits']
                    : 2;

    // For zero-decimal currencies keep 0 decimals.
    $currency_code           = function_exists( 'wp_travel_engine_get_currency_code' ) ? wp_travel_engine_get_currency_code() : '';
    $zero_decimal_currencies = function_exists( 'wptravelengine_cart_zero_decimal_currencies' ) ? wptravelengine_cart_zero_decimal_currencies() : array();
    if ( in_array( $currency_code, $zero_decimal_currencies, true ) ) {
        $max_dec = 0;
    }

    // If the converter already formatted it, check if decimals are excessive.
    if ( null !== $formatted ) {
        $clean = str_replace( $th_sep, '', $formatted );
        if ( strpos( $clean, $dec_sep ) !== false ) {
            $dec_part = substr( strrchr( $clean, $dec_sep ), 1 );
            if ( strlen( $dec_part ) <= $max_dec ) {
                return $formatted;
            }
        } else {
            return $formatted;
        }
    }

    $num       = round( $num, $max_dec );
    $formatted = number_format( $num, $max_dec, $dec_sep, $th_sep );

    // Strip trailing zeros after decimal (e.g. 3,233.00 → 3,233).
    if ( $max_dec > 0 && strpos( $formatted, $dec_sep ) !== false ) {
        $parts   = explode( $dec_sep, $formatted, 2 );
        $decimal = rtrim( $parts[1], '0' );
        $formatted = '' !== $decimal ? $parts[0] . $dec_sep . $decimal : $parts[0];
    }

    return $formatted;
}, 99, 2 );

/* ===============================================================================
   Currency Switcher Shortcode Alias
   =============================================================================== */
// التأكد من وجود الكلاس الخاص بالإضافة لتجنب أي أخطاء
add_shortcode('my_currency_switcher', function() {
    if ( shortcode_exists( 'wte_currency_converter' ) ) {
        return do_shortcode('[wte_currency_converter]');
    }
    return '';
});
/* ===============================================================================
   FTS Premium Currency Switcher (Standalone)
   =============================================================================== */
require_once get_stylesheet_directory() . '/fts-currency-switcher/fts-currency-switcher.php';

/* ===============================================================================
   FTS Smart Search (Tooltip)
   =============================================================================== */
require_once get_stylesheet_directory() . '/fts-smart-search/fts-smart-search.php';

/* ===============================================================================
   FTS Live Chat (Tawk.to)
   =============================================================================== */
require_once get_stylesheet_directory() . '/fts-live-chat/fts-live-chat.php';

/**
 * FTS Trip Redesign V2 - Modular Layout
 */
require_once get_stylesheet_directory() . '/trip-design-v2/layout-controller.php';

/**
 * FTS Destination V2 - Premium Destination Archive
 */
require_once get_stylesheet_directory() . '/destination-design-v2/layout-controller.php';

/**
 * FTS Taxonomy Terms V2 - Premium Taxonomy Term Listings
 */
require_once get_stylesheet_directory() . '/taxonomy-terms-design-v2/layout-controller.php';

/**
 * FTS Custom Checkout — Premium checkout page redesign
 */
require_once get_stylesheet_directory() . '/fts-checkout/fts-checkout.php';

/**
 * FTS Home Page Sections — auto-loads all sections from home-page-sections/
 */
require_once get_stylesheet_directory() . '/home-page-sections/loader.php';

/**
 * FTS Single Post — minimal magazine-style single post template
 */
require_once get_stylesheet_directory() . '/fts-single-post/fts-single-post.php';

/**
 * FTS Trip Schema — single source of truth for JSON-LD on single trip pages
 * (suppresses Rank Math auto-Product and the WTE Trip Reviews emitter).
 */
require_once get_stylesheet_directory() . '/fts-schema/fts-trip-schema.php';

/**
 * Fallback: inject ExtraService line items when the wte-services post type
 * is not registered (common in AJAX context with the Extra Services add-on).
 * WTE's own add_extra_services hook silently fails in this case because
 * Trip::get_services() returns [] when post_type_exists('wte-services') is false.
 * We use the legacy trip_extras payload (always present) to build the line items.
 */
add_action( 'wptravelengine_after_items_added_to_cart', function ( $items, $cart ) {
    if ( ! class_exists( '\WPTravelEngine\Core\Cart\Items\ExtraService' ) ) {
        return;
    }
    foreach ( $items as $item ) {
        $line_items = $item->get_additional_line_items();
        if ( ! empty( $line_items['extra_service'] ) ) {
            continue;
        }
        $trip_extras = $item->trip_extras ?? array();
        if ( empty( $trip_extras ) || ! is_array( $trip_extras ) ) {
            continue;
        }
        foreach ( $trip_extras as $te ) {
            $qty   = (int) ( $te['qty'] ?? 0 );
            $price = (float) ( $te['price'] ?? 0 );
            $label = (string) ( $te['extra_service'] ?? '' );
            if ( $qty < 1 || $label === '' ) {
                continue;
            }
            $item->add_additional_line_items(
                new \WPTravelEngine\Core\Cart\Items\ExtraService(
                    $cart,
                    array(
                        'label'    => $label,
                        'quantity' => $qty,
                        'price'    => $price,
                    )
                )
            );
        }
    }
}, 20, 2 );

// #region agent log
add_action('wp_ajax_wte_add_trip_to_cart', function() {
    $__dbg = ABSPATH . 'wp-content/debug-529f49.log';
    $__raw = @file_get_contents('php://input');
    $__json = json_decode($__raw, true);
    @file_put_contents($__dbg, json_encode(array(
        'sessionId'=>'529f49','hypothesisId'=>'H1_client_payload','timestamp'=>round(microtime(true)*1000),
        'location'=>'functions.php:ajax_hook',
        'message'=>'RAW client AJAX payload (what form sent)',
        'data'=>array(
            'cartTotal'=>$__json['cartTotal'] ?? 'N/A',
            'pricingOptions'=>$__json['pricingOptions'] ?? array(),
            'travelers'=>$__json['travelers'] ?? array(),
            'tripID'=>$__json['tripID'] ?? 'N/A',
            'packageID'=>$__json['packageID'] ?? 'N/A',
            'extraServices'=>$__json['extraServices'] ?? array(),
        ),
    ))."\n", FILE_APPEND);
}, 1);

add_action('wp_ajax_nopriv_wte_add_trip_to_cart', function() {
    $__dbg = ABSPATH . 'wp-content/debug-529f49.log';
    $__raw = @file_get_contents('php://input');
    $__json = json_decode($__raw, true);
    @file_put_contents($__dbg, json_encode(array(
        'sessionId'=>'529f49','hypothesisId'=>'H1_client_payload','timestamp'=>round(microtime(true)*1000),
        'location'=>'functions.php:ajax_hook_nopriv',
        'message'=>'RAW client AJAX payload (what form sent)',
        'data'=>array(
            'cartTotal'=>$__json['cartTotal'] ?? 'N/A',
            'pricingOptions'=>$__json['pricingOptions'] ?? array(),
            'travelers'=>$__json['travelers'] ?? array(),
            'tripID'=>$__json['tripID'] ?? 'N/A',
            'packageID'=>$__json['packageID'] ?? 'N/A',
            'extraServices'=>$__json['extraServices'] ?? array(),
        ),
    ))."\n", FILE_APPEND);
}, 1);

add_action('wptravelengine_after_add_to_cart', function($cart) {
    $__dbg = ABSPATH . 'wp-content/debug-529f49.log';
    $__items_log = array();
    foreach ($cart->getItems() as $item_id => $item_data) {
        $__il = array('id' => $item_id);
        $__il['trip_id'] = $item_data['trip_id'] ?? 'N/A';
        $__il['trip_price'] = $item_data['trip_price'] ?? 'N/A';
        $__il['pax'] = $item_data['pax'] ?? array();
        $__il['pax_cost'] = $item_data['pax_cost'] ?? array();
        $__il['category_info'] = array();
        if (!empty($item_data['category_info'])) {
            foreach ($item_data['category_info'] as $cid => $cinfo) {
                $__il['category_info'][$cid] = array(
                    'label' => $cinfo['label'] ?? '?',
                    'price' => $cinfo['price'] ?? 0,
                    'salePrice' => $cinfo['salePrice'] ?? 0,
                    'enabledSale' => $cinfo['enabledSale'] ?? false,
                );
            }
        }
        $__il['line_items'] = array();
        if (!empty($item_data['line_items'])) {
            foreach ($item_data['line_items'] as $type => $lis) {
                foreach ($lis as $li) {
                    $__il['line_items'][] = array('type'=>$type,'label'=>$li['label']??'?','quantity'=>$li['quantity']??0,'price'=>$li['price']??0,'total'=>$li['total']??0);
                }
            }
        }
        $__items_log[] = $__il;
    }
    $__cart_totals = $cart->get_totals();
    $__payable = method_exists($cart,'get_total_payable_amount') ? $cart->get_total_payable_amount() : 'N/A';
    $__base_curr = function_exists('wptravelengine_settings') ? wptravelengine_settings()->get('currency_code','USD') : 'N/A';
    $__active_curr = function_exists('fts_v2_get_active_currency_code') ? fts_v2_get_active_currency_code() : $__base_curr;
    $__payment_type = $cart->get_payment_type();
    @file_put_contents($__dbg, json_encode(array(
        'sessionId'=>'529f49','hypothesisId'=>'H3_server_cart','timestamp'=>round(microtime(true)*1000),
        'location'=>'functions.php:after_add_to_cart',
        'message'=>'SERVER cart after add_to_cart',
        'data'=>array('items'=>$__items_log,'cart_totals'=>$__cart_totals,'payable_amount'=>$__payable,'payment_type'=>$__payment_type,'base_currency'=>$__base_curr,'active_currency'=>$__active_curr),
    ))."\n", FILE_APPEND);
}, 5);

add_action('wp_footer', function() {
    global $wte_cart;
    if (!$wte_cart || empty($wte_cart->getItems())) return;
    $__page_id = get_the_ID();
    $__checkout_id = function_exists('wptravelengine_get_checkout_page_id') ? wptravelengine_get_checkout_page_id() : 0;
    if (!$__checkout_id) {
        $__settings = get_option('wp_travel_engine_settings', array());
        $__checkout_id = $__settings['pages']['wp_travel_engine_place_order'] ?? 0;
    }
    if (intval($__page_id) !== intval($__checkout_id) && !is_page('checkout')) return;
    $__dbg = ABSPATH . 'wp-content/debug-529f49.log';
    $__totals = $wte_cart->get_totals();
    $__subtotal = $wte_cart->get_subtotal();
    $__cart_total = $wte_cart->get_cart_total();
    $__payable = method_exists($wte_cart,'get_total_payable_amount') ? $wte_cart->get_total_payable_amount() : 'N/A';
    $__payment_type = $wte_cart->get_payment_type();
    $__formatted_total = function_exists('wte_get_formated_price') ? wte_get_formated_price($__cart_total) : $__cart_total;
    $__formatted_payable = is_numeric($__payable) ? (function_exists('wte_get_formated_price') ? wte_get_formated_price($__payable) : $__payable) : $__payable;
    $__version = property_exists($wte_cart, 'version') ? $wte_cart->version : 'N/A';
    $__pg = property_exists($wte_cart, 'payment_gateway') ? $wte_cart->payment_gateway : 'N/A';
    @file_put_contents($__dbg, json_encode(array(
        'sessionId'=>'529f49','hypothesisId'=>'H4_checkout_page','timestamp'=>round(microtime(true)*1000),
        'location'=>'functions.php:wp_footer_checkout',
        'message'=>'CHECKOUT page state (wp_footer)',
        'data'=>array(
            'page_id'=>$__page_id,'checkout_page_id'=>$__checkout_id,
            'raw_totals'=>$__totals,'raw_subtotal'=>$__subtotal,'raw_cart_total'=>$__cart_total,
            'raw_payable'=>$__payable,'formatted_total'=>$__formatted_total,'formatted_payable'=>$__formatted_payable,
            'payment_type'=>$__payment_type,'cart_version'=>$__version,'payment_gateway'=>$__pg,
        ),
    ))."\n", FILE_APPEND);
});
// #endregion

/* ================ Expose booking currency on Thank You page ================ */
add_action( 'wp_footer', 'fts_wte_thankyou_booking_currency' );
function fts_wte_thankyou_booking_currency() {
    if ( ! function_exists( 'wptravelengine_get_thankyou_page_id' ) ) {
        return;
    }
    if ( ! is_page( wptravelengine_get_thankyou_page_id() ) ) {
        return;
    }

    $booking_id = 0;

    if ( isset( $_GET['payment_key'] ) && class_exists( '\WPTravelEngine\Core\Models\Post\Payment' ) ) {
        try {
            $payment = \WPTravelEngine\Core\Models\Post\Payment::from_payment_key(
                sanitize_text_field( wp_unslash( $_GET['payment_key'] ) )
            );
            $booking = \WPTravelEngine\Core\Models\Post\Booking::from_payment( $payment );
            $booking_id = $booking->get_id();
        } catch ( \Exception $e ) {}
    }

    if ( ! $booking_id && class_exists( '\WTE_Booking' ) ) {
        $data = \WTE_Booking::get_callback_token_payload( 'thankyou' );
        if ( is_array( $data ) && isset( $data['bid'] ) ) {
            $booking_id = (int) $data['bid'];
        }
    }

    if ( ! $booking_id ) {
        return;
    }

    $cart_info = get_post_meta( $booking_id, 'cart_info', true );
    $currency  = is_array( $cart_info ) && ! empty( $cart_info['currency'] ) ? $cart_info['currency'] : '';

    if ( $currency ) {
        printf( '<script>window.ftsBookingCurrency=%s;</script>', wp_json_encode( $currency ) );
    }
}
/* Change Rank Math Breadcrumb Schema: Trips to Tours */
add_filter( 'rank_math/json_ld', function( $data, $jsonld ) {
    foreach ( $data as &$entity ) {
        if (
            isset( $entity['@type'] )
            && $entity['@type'] === 'BreadcrumbList'
            && isset( $entity['itemListElement'] )
            && is_array( $entity['itemListElement'] )
        ) {
            foreach ( $entity['itemListElement'] as &$item ) {
                if (
                    isset( $item['item']['name'], $item['item']['@id'] )
                    && $item['item']['name'] === 'Trips'
                    && strpos( $item['item']['@id'], '/tours/' ) !== false
                ) {
                    $item['item']['name'] = 'Tours';
                }
            }
        }
    }

    return $data;
}, 99, 2 );
