<?php
/**
 * The template for displaying search results pages in the child theme.
 * Interactive Tabs for Trips and Articles.
 */

get_header(); 
$search_query_str = get_search_query();

// Prepare Queries
$trips_query = new WP_Query(array(
    's'           => $search_query_str,
    'post_type'   => 'trip',
    'posts_per_page' => -1,
    'post_status' => 'publish'
));

$posts_query = new WP_Query(array(
    's'           => $search_query_str,
    'post_type'   => 'post',
    'posts_per_page' => -1,
    'post_status' => 'publish'
));

$has_trips = $trips_query->have_posts();
$has_posts = $posts_query->have_posts();
?>

<div id="wte-crumbs">
    <?php do_action( 'wp_travel_engine_breadcrumb_holder' ); ?>
</div>

<header class="page-header search-results-header container">
    <h1 class="page-title">
        <?php printf( esc_html__( 'Search Results for: %s', 'travel-monster' ), '<span>' . esc_html($search_query_str) . '</span>' ); ?>
    </h1>
    
    <!-- Tab Navigation -->
    <div class="fts-search-tabs-nav container">
        <button class="fts-tab-btn active" data-target="trips-tab">
            <span class="fts-tab-label"><?php esc_html_e( 'Trips', 'travel-monster' ); ?></span>
            <span class="fts-tab-count"><?php echo $trips_query->found_posts; ?></span>
        </button>
        <button class="fts-tab-btn" data-target="articles-tab">
            <span class="fts-tab-label"><?php esc_html_e( 'Articles & Blog', 'travel-monster' ); ?></span>
            <span class="fts-tab-count"><?php echo $posts_query->found_posts; ?></span>
        </button>
    </div>
</header>

<div class="wp-travel-engine-archive-outer-wrap">
    <div class="wp-travel-engine-archive-repeater-wrap" style="width: 100%;">
        <div class="wte-category-outer-wrap">
            
            <div class="fts-tabs-content">
                <!-- SECTION 1: TRIPS TAB -->
                <div id="trips-tab" class="fts-tab-pane active">
                    <?php if ( $has_trips ) : ?>
                        <div class="category-main-wrap wte-col-3 category-grid">
                            <?php while ( $trips_query->have_posts() ) : $trips_query->the_post(); 
                                $all_args = wte_get_trip_details( get_the_ID() );
                                $all_args['user_wishlists'] = wptravelengine_user_wishlists();
                                $all_args['related_query'] = true;
                                foreach ( $all_args as $key => $value ) { 
                                    wptravelengine_set_template_args( array( $key => $value ) ); 
                                }
                                wptravelengine_get_template('content-related-trip.php');
                            endwhile; ?>
                        </div>
                    <?php else : ?>
                        <div class="fts-no-results-box">
                            <p><?php esc_html_e( 'No trips found matching your search.', 'travel-monster' ); ?></p>
                        </div>
                    <?php endif; wp_reset_postdata(); ?>
                </div>

                <!-- SECTION 2: ARTICLES TAB -->
                <div id="articles-tab" class="fts-tab-pane">
                    <?php if ( $has_posts ) : ?>
                        <div class="fts-articles-grid">
                            <?php while ( $posts_query->have_posts() ) : $posts_query->the_post(); ?>
                                <article class="fts-article-card">
                                    <?php if ( has_post_thumbnail() ) : ?>
                                        <div class="fts-article-thumb">
                                            <a href="<?php the_permalink(); ?>"><?php the_post_thumbnail('medium'); ?></a>
                                        </div>
                                    <?php endif; ?>
                                    <div class="fts-article-body">
                                        <h3 class="fts-article-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
                                        <div class="fts-article-excerpt"><?php echo wp_trim_words(get_the_excerpt(), 15); ?></div>
                                        <a href="<?php the_permalink(); ?>" class="fts-read-more"><?php esc_html_e('Read More', 'travel-monster'); ?> →</a>
                                    </div>
                                </article>
                            <?php endwhile; ?>
                        </div>
                    <?php else : ?>
                        <div class="fts-no-results-box">
                            <p><?php esc_html_e( 'No articles found matching your search.', 'travel-monster' ); ?></p>
                        </div>
                    <?php endif; wp_reset_postdata(); ?>
                </div>
            </div>

        </div>
    </div>
</div>

<style>
.search-results-header { padding: 40px 0 20px; text-align: center; }
.search-results-header h1 { font-size: 2.2rem; font-weight: 800; margin-bottom: 30px; }
.search-results-header h1 span { color: #ff7f50; }

/* Tabs Navigation */
.fts-search-tabs-nav { display: flex; justify-content: center; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 1px; }
.fts-tab-btn { background: none; border: none; padding: 12px 25px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 700; color: #555; position: relative; transition: all 0.3s !important; }
.fts-tab-btn:hover { background-color: #f5f5f5 !important; border-radius: 8px 8px 0 0 !important; }
.fts-tab-btn:hover .fts-tab-label { color: #ff7f50 !important; }
.fts-tab-btn:after { content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px; background: #ff7f50; transform: scaleX(0); transition: transform 0.3s !important; }
.fts-tab-btn.active { 
    color: #ff7f50 !important; 
    background-color: #f5f5f5 !important; 
    border-radius: 8px 8px 0 0 !important;
}
.fts-tab-btn.active:after { transform: scaleX(1); }
.fts-tab-count { background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 20px; font-size: 13px; font-weight: 600; transition: all 0.3s !important; }
.fts-tab-btn.active .fts-tab-count, .fts-tab-btn:hover .fts-tab-count { background: #ff7f501a; color: #ff7f50; }

/* Tabs Content */
.fts-tab-pane { display: none; animation: ftsFadeIn 0.4s ease !important; }
.fts-tab-pane.active { display: block; }

@keyframes ftsFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Shared Styles */
.fts-no-results-box { text-align: center; padding: 60px 0; background: #fcfdfe; border: 1px dashed #eee; border-radius: 12px; color: #888; }
.fts-search-section { padding-top: 20px; }

/* Articles Grid Layout */
.fts-articles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 30px; padding: 20px 0; }
.fts-article-card { background: #fff; border: 1px solid #eee; border-radius: 12px; overflow: hidden; transition: box-shadow 0.3s ease !important; }
.fts-article-card:hover { box-shadow: 0 10px 30px rgba(0,0,0,0.08) !important; }
.fts-article-thumb img { width: 100%; height: 210px; object-fit: cover; }
.fts-article-body { padding: 25px; }
.fts-article-title { font-size: 19px; font-weight: 700; margin-bottom: 12px; line-height: 1.4; }
.fts-article-title a { color: #2d3436; text-decoration: none; transition: color 0.3s !important; }
.fts-article-title a:hover { color: #ff7f50 !important; }
.fts-article-excerpt { font-size: 15px; color: #636e72; margin-bottom: 18px; line-height: 1.6; }
.fts-read-more { font-weight: 700; color: #ff7f50; font-size: 14px; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.3s !important; }
.fts-read-more:hover { border-bottom-color: #ff7f50 !important; }

@media (max-width: 768px) {
    .search-results-header h1 { font-size: 1.8rem; }
    .fts-tab-btn { padding: 10px 15px; font-size: 14px; }
    .fts-articles-grid { grid-template-columns: 1fr; }
}
</style>

<script>
jQuery(document).ready(function($) {
    $('.fts-tab-btn').on('click', function() {
        const target = $(this).data('target');
        
        // Buttons
        $('.fts-tab-btn').removeClass('active');
        $(this).addClass('active');
        
        // Panes
        $('.fts-tab-pane').removeClass('active');
        $('#' + target).addClass('active');
        
        // Trigger resize for lazy load images if any
        $(window).trigger('resize');
    });
});
</script>

<?php get_footer(); ?>
