<?php
/**
 * FTS Smart Search - Modern Search Tooltip
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class FTS_Smart_Search {

    public function __construct() {
        // Register Shortcode
        add_shortcode( 'fts_smart_search', array( $this, 'render_search_tool' ) );

        // Enqueue Assets
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
    }

    public function enqueue_assets() {
        // Use time() as version to force cache clearing during development
        $version = time(); 
        wp_enqueue_style( 'fts-smart-search-style', get_stylesheet_directory_uri() . '/fts-smart-search/assets/css/style.css', array(), $version );
        wp_enqueue_script( 'fts-smart-search-script', get_stylesheet_directory_uri() . '/fts-smart-search/assets/js/script.js', array( 'jquery' ), $version, true );
    }

    public function render_search_tool() {
        ob_start();
        ?>
        <div class="fts-smart-search-wrapper">
            <!-- Trigger Icon -->
            <div class="fts-ss-trigger" title="Search Trips">
                <i class="fas fa-search"></i>
            </div>
            
            <!-- Tooltip Popup -->
            <div class="fts-ss-tooltip">
                <div class="fts-ss-tooltip-inner">
                    <!-- Close Button (Mobile Only) -->
                    <div class="fts-ss-close-btn"><i class="fas fa-times"></i></div>

                    <!-- Search Form -->
                    <form role="search" method="get" class="fts-ss-form" action="<?php echo esc_url( home_url( '/' ) ); ?>">
                        <input type="hidden" name="post_type" value="trip" />
                        <div class="fts-ss-input-group">
                            <input type="search" class="fts-ss-input" placeholder="Where do you want to go?" value="<?php echo get_search_query(); ?>" name="s" autocomplete="off" />
                            <button type="submit" class="fts-ss-submit-btn">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </form>

                    <!-- Popular Tags (Activities) -->
                    <div class="fts-ss-popular">
                        <span class="fts-ss-label">Popular Activities</span>
                        <div class="fts-ss-tags">
                            <?php 
                            $activities = get_terms( array(
                                'taxonomy' => 'activities', // Changed to activities
                                'hide_empty' => true,
                                'number' => 8, // Limit to 8 popular items
                                'orderby' => 'count',
                                'order' => 'DESC'
                            ) );

                            if ( ! empty( $activities ) && ! is_wp_error( $activities ) ) {
                                foreach ( $activities as $activity ) {
                                    $link = get_term_link( $activity );
                                    echo '<a href="' . esc_url( $link ) . '" class="fts-ss-tag">' . esc_html( $activity->name ) . '</a>';
                                }
                            } else {
                                echo '<span class="fts-ss-empty">No popular activities found.</span>';
                            }
                            ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}

new FTS_Smart_Search();