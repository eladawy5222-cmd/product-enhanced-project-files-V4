<?php
/**
 * Template for displaying Destination taxonomy archive
 * Created to support Load More and Filter functionality similar to Packages
 */

get_header();

if ( class_exists( 'FTS_Destination_V2' ) ) {
    FTS_Destination_V2::render();
    get_footer();
    return;
}

/**
 * FTS: Inject Featured Icon via Hook
 * This ensures the layout doesn't break while adding the icon
 */
add_action('wptravelengine_before_trip_archive_card', function() {
    if (get_post_meta(get_the_ID(), 'wp_travel_engine_featured_trip', true) === 'yes') {
        ?>
        <div class="featured-text-wrap fts-native-featured">
            <span class="featured-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0)">
                        <path d="M13.8081 4.12308C13.6427 3.98191 13.4093 3.95216 13.2137 4.04737L10.2211 5.50424L7.41314 2.26669C7.30929 2.14692 7.15855 2.07812 7.00001 2.07812C6.84147 2.07812 6.69075 2.14692 6.58687 2.26669L3.77888 5.50421L0.786276 4.04734C0.590686 3.95216 0.357334 3.98188 0.191904 4.12305C0.0264748 4.26423 -0.0395877 4.49004 0.0236584 4.69812L2.10178 11.5341C2.17181 11.7644 2.38424 11.9219 2.62501 11.9219H11.375C11.6157 11.9219 11.8282 11.7644 11.8982 11.5341L13.9763 4.69815C14.0396 4.49006 13.9735 4.26426 13.8081 4.12308ZM10.9696 10.8281H3.03032L1.43479 5.57955L3.67758 6.67141C3.90026 6.7798 4.16785 6.72506 4.33008 6.53803L7.00001 3.45967L9.66996 6.53803C9.83216 6.72509 10.0998 6.77977 10.3224 6.67141L12.5652 5.57955L10.9696 10.8281Z" fill="white"></path>
                    </g>
                    <defs>
                        <clipPath id="clip0">
                            <rect width="14" height="14" fill="white"></rect>
                        </clipPath>
                    </defs>
                </svg>
            </span>
            <span class="featured-text">Featured</span>
        </div>
        <?php
    }
});

$current_destination = get_queried_object();
?>

<div id="wte-crumbs">
    <?php
    do_action( 'wp_travel_engine_breadcrumb_holder' );
    ?>
</div>

<div class="wp-travel-engine-archive-outer-wrap collapsible-filter-panel">
    
    <!-- Custom Filter for Destination -->
    <div class='advanced-search-wrapper package-filter' id="destination-trip-filters">
        <button id="package-filterbar-close-btn" class="wte-filterbar-close-btn" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.87992 8.00009L15.6133 2.28008C15.8643 2.02901 16.0054 1.68849 16.0054 1.33342C16.0054 0.978349 15.8643 0.637823 15.6133 0.386751C15.3622 0.13568 15.0217 -0.00537109 14.6666 -0.00537109C14.3115 -0.00537109 13.971 0.13568 13.7199 0.386751L7.99992 6.12009L2.27992 0.386751C2.02885 0.13568 1.68832 -0.0053711 1.33325 -0.00537109C0.978183 -0.00537109 0.637657 0.13568 0.386585 0.386751C0.135514 0.637823 -0.00553703 0.978349 -0.00553703 1.33342C-0.00553704 1.68849 0.135514 2.02901 0.386585 2.28008L6.11992 8.00009L0.386585 13.7201C0.261614 13.844 0.162422 13.9915 0.0947304 14.154C0.0270388 14.3165 -0.0078125 14.4907 -0.0078125 14.6668C-0.0078125 14.8428 0.0270388 15.017 0.0947304 15.1795C0.162422 15.342 0.261614 15.4895 0.386585 15.6134C0.510536 15.7384 0.658004 15.8376 0.820483 15.9053C0.982962 15.973 1.15724 16.0078 1.33325 16.0078C1.50927 16.0078 1.68354 15.973 1.84602 15.9053C2.0085 15.8376 2.15597 15.7384 2.27992 15.6134L7.99992 9.88009L13.7199 15.6134C13.8439 15.7384 13.9913 15.8376 14.1538 15.9053C14.3163 15.973 14.4906 16.0078 14.6666 16.0078C14.8426 16.0078 15.0169 15.973 15.1794 15.9053C14.3418 15.8376 15.4893 15.7384 15.6133 15.6134C15.7382 15.4895 15.8374 15.342 15.9051 15.1795C15.9728 15.017 16.0077 14.8428 16.0077 14.6668C16.0077 14.4907 15.9728 14.3165 15.9051 14.154C15.8374 13.9915 15.7382 13.844 15.6133 13.7201L9.87992 8.00009Z" fill="currentColor" />
            </svg>
        </button>
        <div class="sidebar">
            <div class="advanced-search-header">
                <h2>Filter By</h2>
                <button class="clear-search-criteria" id="destination-reset-filters" style="display: none;">Clear all</button>
            </div>
            
            <?php
            // Sub-Destinations Filter
            $sub_destinations = get_terms(array(
                'taxonomy' => 'destination',
                'hide_empty' => false,
                'parent' => $current_destination->term_id,
            ));
            
            if (!empty($sub_destinations)) :
            ?>
            <div class='advanced-search-field search-trip-type wte-list-opn'>
                <h3 class='filter-section-title trip-type'>Destinations</h3>
                <div class="filter-section-content">
                    <ul class="wte-search-terms-list">
                        <?php 
                        foreach ($sub_destinations as $destination) :
                                $dest_count = get_posts(array(
                                    'post_type' => 'trip',
                                    'post_status' => 'publish',
                                    'posts_per_page' => -1,
                                    'fields' => 'ids',
                                    'tax_query' => array(
                                        'relation' => 'AND',
                                        array(
                                            'taxonomy' => 'destination',
                                            'field' => 'term_id',
                                            'terms' => $destination->term_id,
                                        ),
                                    ),
                                ));
                                
                                if (count($dest_count) > 0) :
                            ?>
                            <li>
                                <label>
                                    <input type="checkbox" value="<?php echo esc_attr($destination->slug); ?>" name="destination" class="destination destination-filter-item">
                                    <span><?php echo esc_html($destination->name); ?></span>
                                </label>
                                <span class="count"><?php echo count($dest_count); ?></span>
                            </li>
                            <?php 
                                endif;
                        endforeach;
                        ?>
                    </ul>
                </div>
            </div>
            <?php endif; ?>
            
            <?php
            // Activities Filter
            $destination_activities = get_terms(array(
                'taxonomy' => 'activities',
                'hide_empty' => false,
            ));
            
            if (!empty($destination_activities)) :
            ?>
            <div class='advanced-search-field search-trip-type wte-list-opn'>
                <h3 class='filter-section-title trip-type'>Activities</h3>
                <div class="filter-section-content">
                    <ul class="wte-search-terms-list">
                        <?php foreach ($destination_activities as $activity) :
                            $activity_count = get_posts(array(
                                'post_type' => 'trip',
                                'post_status' => 'publish',
                                'posts_per_page' => -1,
                                'fields' => 'ids',
                                'tax_query' => array(
                                    'relation' => 'AND',
                                    array(
                                        'taxonomy' => 'destination',
                                        'field' => 'slug',
                                        'terms' => $current_destination->slug,
                                    ),
                                    array(
                                        'taxonomy' => 'activities',
                                        'field' => 'term_id',
                                        'terms' => $activity->term_id,
                                    ),
                                ),
                            ));
                            
                            if (count($activity_count) > 0) :
                        ?>
                        <li>
                            <label>
                                <input type="checkbox" value="<?php echo esc_attr($activity->slug); ?>" name="activities" class="activities destination-filter-item">
                                <span><?php echo esc_html($activity->name); ?></span>
                            </label>
                            <span class="count"><?php echo count($activity_count); ?></span>
                        </li>
                        <?php endif; endforeach; ?>
                    </ul>
                </div>
            </div>
            <?php endif; ?>
            
            <?php
            // Trip Types Filter
            $destination_trip_types = get_terms(array(
                'taxonomy' => 'trip_types',
                'hide_empty' => false,
            ));
            
            if (!empty($destination_trip_types)) :
            ?>
            <div class='advanced-search-field search-trip-type wte-list-opn'>
                <h3 class='filter-section-title trip-type'>Trip Types</h3>
                <div class="filter-section-content">
                    <ul class="wte-search-terms-list">
                        <?php foreach ($destination_trip_types as $trip_type) :
                            $type_count = get_posts(array(
                                'post_type' => 'trip',
                                'post_status' => 'publish',
                                'posts_per_page' => -1,
                                'fields' => 'ids',
                                'tax_query' => array(
                                    'relation' => 'AND',
                                    array(
                                        'taxonomy' => 'destination',
                                        'field' => 'slug',
                                        'terms' => $current_destination->slug,
                                    ),
                                    array(
                                        'taxonomy' => 'trip_types',
                                        'field' => 'term_id',
                                        'terms' => $trip_type->term_id,
                                    ),
                                ),
                            ));
                            
                            if (count($type_count) > 0) :
                        ?>
                        <li>
                            <label>
                                <input type="checkbox" value="<?php echo esc_attr($trip_type->slug); ?>" name="trip_types" class="trip_types destination-filter-item">
                                <span><?php echo esc_html($trip_type->name); ?></span>
                            </label>
                            <span class="count"><?php echo count($type_count); ?></span>
                        </li>
                        <?php endif; endforeach; ?>
                    </ul>
                </div>
            </div>
            <?php endif; ?>
            
            <?php
            // Difficulty Filter
            $destination_difficulties = get_terms(array(
                'taxonomy' => 'difficulty',
                'hide_empty' => false,
            ));
            
            if (!empty($destination_difficulties)) :
            ?>
            <div class='advanced-search-field search-trip-type wte-list-opn'>
                <h3 class='filter-section-title trip-type'>Difficulties</h3>
                <div class="filter-section-content">
                    <ul class="wte-search-terms-list">
                        <?php foreach ($destination_difficulties as $difficulty) :
                            $difficulty_count = get_posts(array(
                                'post_type' => 'trip',
                                'post_status' => 'publish',
                                'posts_per_page' => -1,
                                'fields' => 'ids',
                                'tax_query' => array(
                                    'relation' => 'AND',
                                    array(
                                        'taxonomy' => 'destination',
                                        'field' => 'slug',
                                        'terms' => $current_destination->slug,
                                    ),
                                    array(
                                        'taxonomy' => 'difficulty',
                                        'field' => 'term_id',
                                        'terms' => $difficulty->term_id,
                                    ),
                                ),
                            ));
                            
                            if (count($difficulty_count) > 0) :
                        ?>
                        <li>
                            <label>
                                <input type="checkbox" value="<?php echo esc_attr($difficulty->slug); ?>" name="difficulty" class="difficulty destination-filter-item">
                                <span><?php echo esc_html($difficulty->name); ?></span>
                            </label>
                            <span class="count"><?php echo count($difficulty_count); ?></span>
                        </li>
                        <?php endif; endforeach; ?>
                    </ul>
                </div>
            </div>
            <?php endif; ?>
            
            <?php
            // Duration Filter
            $destination_durations = array();
            $duration_query = new WP_Query(array(
                'post_type' => 'trip',
                'post_status' => 'publish',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'tax_query' => array(
                    array(
                        'taxonomy' => 'destination',
                        'field' => 'slug',
                        'terms' => $current_destination->slug,
                    ),
                ),
            ));
            
            if ($duration_query->have_posts()) {
                foreach ($duration_query->posts as $trip_id) {
                    $trip_meta = get_post_meta($trip_id, 'wp_travel_engine_setting', true);
                    if (isset($trip_meta['trip_duration']) && !empty($trip_meta['trip_duration'])) {
                        $duration = intval($trip_meta['trip_duration']);
                        if ($duration > 0) {
                            $destination_durations[] = $duration;
                        }
                    }
                }
            }
            wp_reset_postdata();
            
            $duration_ranges = array();
            foreach ($destination_durations as $duration) {
                if ($duration >= 1 && $duration <= 3) {
                    $duration_ranges['1-3'] = isset($duration_ranges['1-3']) ? $duration_ranges['1-3'] + 1 : 1;
                } elseif ($duration >= 4 && $duration <= 7) {
                    $duration_ranges['4-7'] = isset($duration_ranges['4-7']) ? $duration_ranges['4-7'] + 1 : 1;
                } elseif ($duration >= 8 && $duration <= 14) {
                    $duration_ranges['8-14'] = isset($duration_ranges['8-14']) ? $duration_ranges['8-14'] + 1 : 1;
                } elseif ($duration >= 15) {
                    $duration_ranges['15+'] = isset($duration_ranges['15+']) ? $duration_ranges['15+'] + 1 : 1;
                }
            }
            
            if (!empty($duration_ranges)) :
            ?>
            <div class='advanced-search-field search-trip-type wte-list-opn'>
                <h3 class='filter-section-title trip-type'>Duration</h3>
                <div class="filter-section-content">
                    <ul class="wte-search-terms-list">
                        <?php foreach ($duration_ranges as $range => $count) : ?>
                        <li>
                            <label>
                                <input type="checkbox" value="<?php echo esc_attr($range); ?>" name="duration" class="duration destination-filter-item">
                                <span><?php 
                                    switch($range) {
                                        case '1-3': echo '1-3 Days'; break;
                                        case '4-7': echo '4-7 Days'; break;
                                        case '8-14': echo '8-14 Days'; break;
                                        case '15+': echo '15+ Days'; break;
                                    }
                                ?></span>
                            </label>
                            <span class="count"><?php echo $count; ?></span>
                        </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            </div>
            <?php endif; ?>
            
        </div>
    </div>
    
    <div class="wp-travel-engine-archive-repeater-wrap">
        <?php
        do_action( 'wp_travel_engine_header_filters' );
        ?>
        <!-- Destination Header -->
        <div class="package-header">
            <h1 class="page-title">
                <?php echo esc_html($current_destination->name); ?>
            </h1>
            <?php if ($current_destination->description) : ?>
                <div class="package-description">
                    <p><?php echo esc_html($current_destination->description); ?></p>
                </div>
            <?php endif; ?>
        </div>

        <div class="wte-category-outer-wrap">
            <?php
            $view_mode = wp_travel_engine_get_archive_view_mode();
            $classes = 'wte-col-2 category-grid'; 
            $view_class = 'grid' === $view_mode ? $classes : 'category-list';

            echo '<div class="category-main-wrap ' . esc_attr( $view_class ) . '">';
            
            $paged = (get_query_var('paged')) ? get_query_var('paged') : 1;
            
            /** 
             * FTS Custom Order: Featured Trips First
             * We use a named meta_query clause to force a LEFT JOIN so regular trips aren't excluded.
             */
            $destination_trips = new WP_Query(array(
                'post_type'      => 'trip',
                'post_status'    => 'publish',
                'posts_per_page' => get_option('posts_per_page', 10),
                'paged'          => $paged,
                'tax_query'      => array(
                    array(
                        'taxonomy' => 'destination',
                        'field'    => 'slug',
                        'terms'    => $current_destination->slug,
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
            ));
            
            if ($destination_trips->have_posts()) :
                while ($destination_trips->have_posts()) : $destination_trips->the_post();
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
                    } else {
                        // Fallback
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
                echo '<h3>' . sprintf(__('No trips found for %s.', 'wp-travel-engine'), $current_destination->name) . '</h3>';
                echo '<p>' . __('Please browse our other destinations.', 'wp-travel-engine') . '</p>';
                echo '</div>';
            endif;
            
            wp_reset_postdata();
            ?>
            </div>
            
            <?php
            // Load More Button
            if ($destination_trips->max_num_pages > 1) :
            ?>
                <div class="wte-load-more-wrapper">
                    <button type="button" class="wte-load-more-btn" 
                            data-page="1" 
                            data-max-pages="<?php echo $destination_trips->max_num_pages; ?>"
                            data-destination-slug="<?php echo $current_destination->slug; ?>">
                        <?php _e('Load More Trips', 'wp-travel-engine'); ?>
                    </button>
                    <div class="wte-loading" style="display: none;">
                        <?php _e('Loading...', 'wp-travel-engine'); ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<script>
jQuery(document).ready(function($) {
    // Filter Change
    $('.destination-filter-item').on('change', function() {
        filterDestinationTrips();
    });
    
    // Reset Filters
    $('#destination-reset-filters').on('click', function() {
        $('.destination-filter-item').prop('checked', false);
        filterDestinationTrips();
        $(this).hide();
    });
    
    $('.destination-filter-item').on('change', function() {
        var hasChecked = $('.destination-filter-item:checked').length > 0;
        $('#destination-reset-filters').toggle(hasChecked);
    });
    
    function filterDestinationTrips() {
        var selectedFilters = {
            destination: [],
            activities: [],
            trip_types: [],
            difficulty: [],
            duration: []
        };
        
        $('.destination-filter-item:checked').each(function() {
            var filterType = $(this).attr('name');
            var filterValue = $(this).val();
            if (selectedFilters[filterType]) {
                selectedFilters[filterType].push(filterValue);
            }
        });
        
        $('.category-main-wrap > *').hide();
        
        $.ajax({
            url: '<?php echo admin_url('admin-ajax.php'); ?>',
            type: 'POST',
            data: {
                action: 'filter_single_destination_trips',
                filters: selectedFilters,
                destination_slug: '<?php echo $current_destination->slug; ?>',
                nonce: '<?php echo wp_create_nonce('filter_single_destination_trips'); ?>'
            },
            beforeSend: function() {
                $('.category-main-wrap').addClass('loading');
            },
            success: function(response) {
                $('.category-main-wrap').removeClass('loading');
                if (response.success) {
                    $('.category-main-wrap').html(response.data.html);
                    
                    $('.category-main-wrap script[src*="trustindex"]').each(function() {
                        var script = document.createElement('script');
                        script.src = this.src;
                        script.defer = this.defer;
                        script.async = this.async;
                        document.head.appendChild(script);
                    });
                }
            },
            error: function() {
                $('.category-main-wrap').removeClass('loading');
                location.reload();
            }
        });
    }
    
    $('#package-filterbar-close-btn').on('click', function() {
        $('.package-filter').removeClass('active');
    });
    
    // Load More
    $('.wte-load-more-btn').on('click', function() {
        var $btn = $(this);
        var currentPage = parseInt($btn.data('page'));
        var maxPages = parseInt($btn.data('max-pages'));
        var destinationSlug = $btn.data('destination-slug');
        
        if (currentPage >= maxPages) {
            return;
        }
        
        $.ajax({
            url: '<?php echo admin_url('admin-ajax.php'); ?>',
            type: 'POST',
            data: {
                action: 'load_more_destination_trips',
                page: currentPage,
                destination_slug: destinationSlug,
                nonce: '<?php echo wp_create_nonce('load_more_destination_trips'); ?>'
            },
            beforeSend: function() {
                $btn.hide();
                $('.wte-loading').show();
            },
            success: function(response) {
                $('.wte-loading').hide();
                if (response.success) {
                    $('.category-main-wrap').append(response.data.html);
                    
                    $btn.data('page', currentPage + 1);
                    
                    if (response.data.has_more) {
                        $btn.show();
                    } else {
                        $btn.text('<?php _e('No more trips', 'wp-travel-engine'); ?>').prop('disabled', true);
                        $btn.show();
                    }
                    
                    $('.category-main-wrap script[src*="trustindex"]').each(function() {
                        var script = document.createElement('script');
                        script.src = this.src;
                        script.defer = this.defer;
                        script.async = this.async;
                        document.head.appendChild(script);
                    });
                } else {
                    $btn.show();
                }
            },
            error: function() {
                $('.wte-loading').hide();
                $btn.show();
            }
        });
    });
});
</script>

<style>
.wte-search-terms-list .parent-destination {
    font-weight: bold;
    border-bottom: 1px solid #eee;
    margin-bottom: 5px;
    padding-bottom: 5px;
}
.wte-search-terms-list .parent-destination label {
    font-weight: bold;
    color: #333;
}
.wte-search-terms-list .child-destination {
    margin-left: 10px;
    font-size: 0.95em;
    color: #666;
}
.wte-search-terms-list .child-destination label {
    color: #666;
    font-weight: normal;
}
.wte-search-terms-list li {
    margin-bottom: 3px;
}
.wte-search-terms-list .parent-destination:last-child {
    border-bottom: none;
}
.wte-load-more-wrapper {
    text-align: center;
    margin: 30px 0;
    padding: 20px;
}
.wte-load-more-btn {
    background: #007cba;
    color: white;
    border: none;
    padding: 12px 30px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.wte-load-more-btn:hover {
    background: #005a87;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 124, 186, 0.3);
}
.wte-load-more-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}
.fts-native-featured {
    position: absolute !important;
    top: 15px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    right: auto !important;
    background: #006b2b !important; /* Theme featured green */
    color: #fff !important;
    padding: 5px 15px !important;
    border-radius: 4px !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    z-index: 10 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    border: 1.5px solid rgba(255,255,255,0.4) !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    white-space: nowrap !important;
}
.fts-native-featured .featured-icon {
    display: flex !important;
    align-items: center !important;
}
.fts-native-featured .featured-icon svg {
    width: 14px !important;
    height: 14px !important;
    fill: #fff !important;
}
.fts-native-featured .featured-text {
    line-height: normal !important;
}
.category-trips-single-inner-wrap {
    position: relative !important;
}
.fts-featured-icon i {
    font-size: 14px !important;
}
</style>

<?php
get_footer();
