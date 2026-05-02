<?php
// Exit if accessed directly
if ( !defined( 'ABSPATH' ) ) exit;

// AJAX handler for filtering trips on a single Destination page
function filter_single_destination_trips_ajax() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'filter_single_destination_trips')) {
        wp_die('Security check failed');
    }
    
    $filters = isset($_POST['filters']) ? $_POST['filters'] : array();
    $destination_slug = isset($_POST['destination_slug']) ? sanitize_text_field($_POST['destination_slug']) : '';
    
    // Build tax_query
    $tax_query = array('relation' => 'AND');
    
    // Add current Destination
    $tax_query[] = array(
        'taxonomy' => 'destination',
        'field' => 'slug',
        'terms' => $destination_slug,
    );
    
    // Add additional filters
    
    // Filter by Destination (sub-destinations)
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
    
    // Meta query construction
    $meta_query = array(
        'relation' => 'AND',
        'featured_logic' => array(
            'relation' => 'OR',
            'featured_clause' => array(
                'key'     => 'wp_travel_engine_featured_trip',
                'compare' => '=',
                'value'   => 'yes',
            ),
            'regular_clause' => array(
                'key'     => 'wp_travel_engine_featured_trip',
                'compare' => 'NOT EXISTS',
            ),
        )
    );
    
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
    
    // Query Trips
    $args = array(
        'post_type'      => 'trip',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'tax_query'      => $tax_query,
        'meta_query'     => $meta_query,
        'orderby'        => array(
            'featured_clause' => 'DESC',
            'date'            => 'DESC'
        ),
    );
    
    $trips = new WP_Query($args);
    
    ob_start();
    if ($trips->have_posts()) :
        while ($trips->have_posts()) : $trips->the_post();
            $is_featured = get_post_meta(get_the_ID(), 'wp_travel_engine_featured_trip', true) === 'yes';
            // Use same template logic as original
            if (function_exists('wptravelengine_get_template')) {
                global $post;
                $all_args = wte_get_trip_details( $post->ID );
                $all_args['user_wishlists'] = wptravelengine_user_wishlists();
                $all_args['related_query'] = true;
                foreach ( $all_args as $key => $value ) {
                    wptravelengine_set_template_args( array( $key => $value ) );
                }
                wptravelengine_get_template('content-related-trip.php');
            } else {
                 // Fallback HTML if template function doesn't exist
                 ?>
                 <div class="category-trips-single-wrap <?php echo $is_featured ? 'is-featured' : ''; ?>">
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
add_action('wp_ajax_filter_single_destination_trips', 'filter_single_destination_trips_ajax');
add_action('wp_ajax_nopriv_filter_single_destination_trips', 'filter_single_destination_trips_ajax');

// AJAX handler for Load More on Destination page
function load_more_destination_trips_ajax() {
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'load_more_destination_trips')) {
        wp_die('Security check failed');
    }
    
    $page = intval($_POST['page']);
    $destination_slug = isset($_POST['destination_slug']) ? sanitize_text_field($_POST['destination_slug']) : '';
    
    $args = array(
        'post_type'      => 'trip',
        'post_status'    => 'publish',
        'posts_per_page' => get_option('posts_per_page', 10),
        'paged'          => $page + 1,
        'tax_query'      => array(
            array(
                'taxonomy' => 'destination',
                'field'    => 'slug',
                'terms'    => $destination_slug,
            ),
        ),
        'meta_query'     => array(
            'relation' => 'OR',
            'featured_clause' => array(
                'key'     => 'wp_travel_engine_featured_trip',
                'compare' => '=',
                'value'   => 'yes',
            ),
            'regular_clause' => array(
                'key'     => 'wp_travel_engine_featured_trip',
                'compare' => 'NOT EXISTS',
            ),
        ),
        'orderby'        => array(
            'featured_clause' => 'DESC',
            'date'            => 'DESC'
        ),
    );
    
    $trips = new WP_Query($args);
    
    ob_start();
    if ($trips->have_posts()) :
        while ($trips->have_posts()) : $trips->the_post();
            $is_featured = get_post_meta(get_the_ID(), 'wp_travel_engine_featured_trip', true) === 'yes';
            if (function_exists('wptravelengine_get_template')) {
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
add_action('wp_ajax_load_more_destination_trips', 'load_more_destination_trips_ajax');
add_action('wp_ajax_nopriv_load_more_destination_trips', 'load_more_destination_trips_ajax');
