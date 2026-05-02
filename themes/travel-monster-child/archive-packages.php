<?php
/**
 * Template for displaying all packages archive
 * Shows all trips from all packages when visiting /packages/
 */

get_header();

// تغيير عنوان التاب
?>
<script>
document.addEventListener('DOMContentLoaded', function() {
    document.title = 'Packages - <?php echo get_bloginfo('name'); ?>';
});
</script>
<?php

// Get all packages for display
$all_packages = get_terms(array(
    'taxonomy' => 'packages',
    'hide_empty' => true,
));
?>

<div id="wte-crumbs">
    <?php
    /**
     * wp_travel_engine_archive_sidebar hook
     */
    do_action( 'wp_travel_engine_breadcrumb_holder' );
    ?>
</div>

<div class="wp-travel-engine-archive-outer-wrap collapsible-filter-panel">
    
    <!-- فلتر مخصص للـ All Packages -->
    <div class='advanced-search-wrapper package-filter' id="package-trip-filters">
        <button id="package-filterbar-close-btn" class="wte-filterbar-close-btn" type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.87992 8.00009L15.6133 2.28008C15.8643 2.02901 16.0054 1.68849 16.0054 1.33342C16.0054 0.978349 15.8643 0.637823 15.6133 0.386751C15.3622 0.13568 15.0217 -0.00537109 14.6666 -0.00537109C14.3115 -0.00537109 13.971 0.13568 13.7199 0.386751L7.99992 6.12009L2.27992 0.386751C2.02885 0.13568 1.68832 -0.0053711 1.33325 -0.00537109C0.978183 -0.00537109 0.637657 0.13568 0.386585 0.386751C0.135514 0.637823 -0.00553703 0.978349 -0.00553703 1.33342C-0.00553704 1.68849 0.135514 2.02901 0.386585 2.28008L6.11992 8.00009L0.386585 13.7201C0.261614 13.844 0.162422 13.9915 0.0947304 14.154C0.0270388 14.3165 -0.0078125 14.4907 -0.0078125 14.6668C-0.0078125 14.8428 0.0270388 15.017 0.0947304 15.1795C0.162422 15.342 0.261614 15.4895 0.386585 15.6134C0.510536 15.7384 0.658004 15.8376 0.820483 15.9053C0.982962 15.973 1.15724 16.0078 1.33325 16.0078C1.50927 16.0078 1.68354 15.973 1.84602 15.9053C2.0085 15.8376 2.15597 15.7384 2.27992 15.6134L7.99992 9.88009L13.7199 15.6134C13.8439 15.7384 13.9913 15.8376 14.1538 15.9053C14.3163 15.973 14.4906 16.0078 14.6666 16.0078C14.8426 16.0078 15.0169 15.973 15.1794 15.9053C14.3418 15.8376 15.4893 15.7384 15.6133 15.6134C15.7382 15.4895 15.8374 15.342 15.9051 15.1795C15.9728 15.017 16.0077 14.8428 16.0077 14.6668C16.0077 14.4907 15.9728 14.3165 15.9051 14.154C15.8374 13.9915 15.7382 13.844 15.6133 13.7201L9.87992 8.00009Z" fill="currentColor" />
            </svg>
        </button>
        <div class="sidebar">
            <div class="advanced-search-header">
                <h2>Filter By</h2>
                <button class="clear-search-criteria" id="package-reset-filters" style="display: none;">Clear all</button>
            </div>
            
            <?php
            // فلتر الـ Packages - أول فلتر
            if (!empty($all_packages)) :
            ?>
            <div class='advanced-search-field search-trip-type wte-list-opn'>
                <h3 class='filter-section-title trip-type'>Packages</h3>
                <div class="filter-section-content">
                    <ul class="wte-search-terms-list">
                        <?php foreach ($all_packages as $package) :
                            // حساب عدد الرحلات في هذا الـ Package
                            $package_count = get_posts(array(
                                'post_type' => 'trip',
                                'post_status' => 'publish',
                                'posts_per_page' => -1,
                                'fields' => 'ids',
                                'tax_query' => array(
                                    array(
                                        'taxonomy' => 'packages',
                                        'field' => 'term_id',
                                        'terms' => $package->term_id,
                                    ),
                                ),
                            ));
                            
                            if (count($package_count) > 0) :
                        ?>
                        <li>
                            <label>
                                <input type="checkbox" value="<?php echo esc_attr($package->slug); ?>" name="packages" class="packages package-filter-item">
                                <span><?php echo esc_html($package->name); ?></span>
                            </label>
                            <span class="count"><?php echo count($package_count); ?></span>
                        </li>
                        <?php endif; endforeach; ?>
                    </ul>
                </div>
            </div>
            <?php endif; ?>
            
            <?php
            // فلتر الوجهات لجميع الـ Packages مع hierarchy
            $package_destinations = get_terms(array(
                'taxonomy' => 'destination',
                'hide_empty' => false,
                'hierarchical' => true,
                'parent' => 0, // البداية بالـ parent terms
            ));
            
            if (!empty($package_destinations)) :
            ?>
            <div class='advanced-search-field search-trip-type wte-list-opn'>
                <h3 class='filter-section-title trip-type'>Destination</h3>
                <div class="filter-section-content">
                    <ul class="wte-search-terms-list">
                        <?php 
                        function display_destination_hierarchy($destinations, $all_packages, $parent_id = 0, $level = 0) {
                            foreach ($destinations as $destination) :
                                if ($destination->parent != $parent_id) continue;
                                
                                // حساب عدد الرحلات في هذه الوجهة داخل جميع الـ Packages
                                $dest_count = get_posts(array(
                                    'post_type' => 'trip',
                                    'post_status' => 'publish',
                                    'posts_per_page' => -1,
                                    'fields' => 'ids',
                                    'tax_query' => array(
                                        'relation' => 'AND',
                                        array(
                                            'taxonomy' => 'packages',
                                            'field' => 'term_id',
                                            'terms' => wp_list_pluck($all_packages, 'term_id'),
                                            'operator' => 'IN',
                                        ),
                                        array(
                                            'taxonomy' => 'destination',
                                            'field' => 'term_id',
                                            'terms' => $destination->term_id,
                                        ),
                                    ),
                                ));
                                
                                if (count($dest_count) > 0) :
                                    $indent = str_repeat('&nbsp;&nbsp;&nbsp;&nbsp;', $level);
                                    $class = $level == 0 ? 'parent-destination' : 'child-destination';
                            ?>
                            <li class="<?php echo $class; ?>">
                                <label>
                                    <input type="checkbox" value="<?php echo esc_attr($destination->slug); ?>" name="destination" class="destination package-filter-item">
                                    <span><?php echo $indent . esc_html($destination->name); ?></span>
                                </label>
                                <span class="count"><?php echo count($dest_count); ?></span>
                            </li>
                            <?php 
                                endif;
                                
                                // عرض الـ children
                                display_destination_hierarchy($destinations, $all_packages, $destination->term_id, $level + 1);
                            endforeach;
                        }
                        
                        // جلب جميع الـ destinations مع الـ children
                        $all_destinations = get_terms(array(
                            'taxonomy' => 'destination',
                            'hide_empty' => false,
                            'hierarchical' => true,
                        ));
                        
                        display_destination_hierarchy($all_destinations, $all_packages);
                        ?>
                    </ul>
                </div>
            </div>
            <?php endif; ?>
            
            <?php
            // فلتر المدة (Duration) - Dynamic
            // جلب جميع المدد من الرحلات في الـ packages
            $package_durations = array();
            $duration_query = new WP_Query(array(
                'post_type' => 'trip',
                'post_status' => 'publish',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'tax_query' => array(
                    array(
                        'taxonomy' => 'packages',
                        'field' => 'term_id',
                        'terms' => wp_list_pluck($all_packages, 'term_id'),
                        'operator' => 'IN',
                    ),
                ),
            ));
            
            if ($duration_query->have_posts()) {
                foreach ($duration_query->posts as $trip_id) {
                    $trip_meta = get_post_meta($trip_id, 'wp_travel_engine_setting', true);
                    if (isset($trip_meta['trip_duration']) && !empty($trip_meta['trip_duration'])) {
                        $duration = intval($trip_meta['trip_duration']);
                        if ($duration > 0) {
                            $package_durations[] = $duration;
                        }
                    }
                }
            }
            wp_reset_postdata();
            
            // تجميع المدد في ranges
            $duration_ranges = array();
            foreach ($package_durations as $duration) {
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
                                <input type="checkbox" value="<?php echo esc_attr($range); ?>" name="duration" class="duration package-filter-item">
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
        // إظهار الهيدر فلتر في صفحة All Packages
        do_action( 'wp_travel_engine_header_filters' );
        ?>
        <!-- عنوان صفحة جميع الـ Packages -->
        <?php /* 
        <div class="package-header">
            <h1 class="page-title">
                All Package Trips
            </h1>
            <div class="package-description">
                <p>Discover all trips from our travel packages</p>
            </div>
        </div>
        */ ?>

        <div class="wte-category-outer-wrap">
            <?php
            $view_mode = wp_travel_engine_get_archive_view_mode();
            $classes = 'wte-col-2 category-grid'; // عرض عمودين مع sidebar
            $view_class = 'grid' === $view_mode ? $classes : 'category-list';

            echo '<div class="category-main-wrap ' . esc_attr( $view_class ) . '">';
            
            // Custom query لعرض جميع رحلات الـ packages
            $paged = (get_query_var('paged')) ? get_query_var('paged') : 1;
            $package_trips = new WP_Query(array(
                'post_type' => 'trip',
                'post_status' => 'publish',
                'posts_per_page' => get_option('posts_per_page', 10),
                'paged' => $paged,
                'tax_query' => array(
                    array(
                        'taxonomy' => 'packages',
                        'operator' => 'EXISTS', // فقط الرحلات اللي عندها packages
                    ),
                ),
            ));
            
            if ($package_trips->have_posts()) :
                while ($package_trips->have_posts()) : $package_trips->the_post();
                    // Use WP Travel Engine's standard trip display
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
                        // Fallback to basic display
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
                echo '<h3>' . __('No package trips found.', 'wp-travel-engine') . '</h3>';
                echo '<p>' . __('Please check back later or browse our other trips.', 'wp-travel-engine') . '</p>';
                echo '</div>';
            endif;
            
            wp_reset_postdata();
            ?>
            </div>
            
            <?php
            // Load More Button
            if ($package_trips->max_num_pages > 1) :
            ?>
                <div class="wte-load-more-wrapper">
                    <button type="button" class="wte-load-more-btn" 
                            data-page="1" 
                            data-max-pages="<?php echo $package_trips->max_num_pages; ?>"
                            data-type="all-packages">
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

<!-- JavaScript للفلتر المخصص -->
<script>
jQuery(document).ready(function($) {
    // فلترة الرحلات عند تغيير الفلتر
    $('.package-filter-item').on('change', function() {
        filterAllPackageTrips();
    });
    
    // مسح جميع الفلاتر
    $('#package-reset-filters').on('click', function() {
        $('.package-filter-item').prop('checked', false);
        filterAllPackageTrips();
        $(this).hide();
    });
    
    // إظهار/إخفاء زر المسح
    $('.package-filter-item').on('change', function() {
        var hasChecked = $('.package-filter-item:checked').length > 0;
        $('#package-reset-filters').toggle(hasChecked);
    });
    
    // دالة فلترة الرحلات لجميع الـ Packages
    function filterAllPackageTrips() {
        var selectedFilters = {
            destination: [],
            activities: [],
            trip_types: [],
            packages: [],
            difficulty: [],
            duration: []
        };
        
        // جمع الفلاتر المختارة
        $('.package-filter-item:checked').each(function() {
            var filterType = $(this).attr('name');
            var filterValue = $(this).val();
            if (selectedFilters[filterType]) {
                selectedFilters[filterType].push(filterValue);
            }
        });
        
        // إخفاء جميع الرحلات أولاً
        $('.category-main-wrap > *').hide();
        
        // فلترة باستخدام AJAX
        $.ajax({
            url: '<?php echo admin_url('admin-ajax.php'); ?>',
            type: 'POST',
            data: {
                action: 'filter_all_package_trips',
                filters: selectedFilters,
                nonce: '<?php echo wp_create_nonce('filter_all_package_trips'); ?>'
            },
            beforeSend: function() {
                $('.category-main-wrap').addClass('loading');
            },
            success: function(response) {
                $('.category-main-wrap').removeClass('loading');
                if (response.success) {
                    $('.category-main-wrap').html(response.data.html);
                    
                    // إعادة تحميل Trustindex scripts
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
                // في حالة الخطأ، أعد تحميل الصفحة
                location.reload();
            }
        });
    }
    
    // إغلاق الفلتر على الموبايل
    $('#package-filterbar-close-btn').on('click', function() {
        $('.package-filter').removeClass('active');
    });
    
    // Load More functionality
    $('.wte-load-more-btn').on('click', function() {
        var $btn = $(this);
        var currentPage = parseInt($btn.data('page'));
        var maxPages = parseInt($btn.data('max-pages'));
        var type = $btn.data('type');
        
        if (currentPage >= maxPages) {
            return;
        }
        
        $.ajax({
            url: '<?php echo admin_url('admin-ajax.php'); ?>',
            type: 'POST',
            data: {
                action: 'load_more_package_trips',
                page: currentPage,
                type: type,
                nonce: '<?php echo wp_create_nonce('load_more_package_trips'); ?>'
            },
            beforeSend: function() {
                $btn.hide();
                $('.wte-loading').show();
            },
            success: function(response) {
                $('.wte-loading').hide();
                if (response.success) {
                    $('.category-main-wrap').append(response.data.html);
                    
                    // تحديث رقم الصفحة
                    $btn.data('page', currentPage + 1);
                    
                    // إخفاء الزر إذا لم تعد هناك صفحات
                    if (response.data.has_more) {
                        $btn.show();
                    } else {
                        $btn.text('<?php _e('No more trips', 'wp-travel-engine'); ?>').prop('disabled', true);
                        $btn.show();
                    }
                    
                    // إعادة تحميل Trustindex scripts
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
/* تمييز الـ parent destinations */
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

/* تحسين المظهر العام */
.wte-search-terms-list li {
    margin-bottom: 3px;
}

.wte-search-terms-list .parent-destination:last-child {
    border-bottom: none;
}

/* Load More Button Styling */
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

.wte-loading {
    color: #007cba;
    font-size: 16px;
    font-weight: 600;
}
</style>

<?php
get_footer();
