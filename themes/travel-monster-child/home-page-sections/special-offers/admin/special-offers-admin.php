<?php
/**
 * FTS Special Offers — Admin Dashboard Page
 *
 * Provides a dedicated WP-Admin page for selecting trips to feature
 * in the Special Offers homepage section. Each trip row allows setting
 * a badge type and offer end date; everything else is auto-fetched.
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Special_Offers_Admin {

    const OPTION_KEY  = 'fts_special_offers';
    const NONCE_KEY   = 'fts_special_offers_nonce';
    const CAPABILITY  = 'manage_options';

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
        add_action( 'wp_ajax_fts_search_trips',         array( __CLASS__, 'ajax_search_trips' ) );
        add_action( 'wp_ajax_fts_save_special_offers',  array( __CLASS__, 'ajax_save' ) );
    }

    /* ── Menu Registration ──────────────────────────────── */

    public static function register_menu() {
        $hook = add_menu_page(
            __( 'Special Offers', 'fts' ),
            __( 'Special Offers', 'fts' ),
            self::CAPABILITY,
            'fts-special-offers',
            array( __CLASS__, 'render_page' ),
            'dashicons-tag',
            26
        );

        add_action( "admin_print_styles-{$hook}",  array( __CLASS__, 'enqueue_assets' ) );
        add_action( "admin_print_scripts-{$hook}", array( __CLASS__, 'enqueue_assets' ) );
    }

    /* ── Assets ─────────────────────────────────────────── */

    public static function enqueue_assets() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/special-offers/admin';
        $path = get_stylesheet_directory()     . '/home-page-sections/special-offers/admin';

        wp_enqueue_style(
            'fts-special-offers-admin-css',
            $base . '/special-offers-admin.css',
            array(),
            file_exists( $path . '/special-offers-admin.css' ) ? filemtime( $path . '/special-offers-admin.css' ) : null
        );

        wp_enqueue_script( 'jquery-ui-sortable' );

        wp_enqueue_script(
            'fts-special-offers-admin-js',
            $base . '/special-offers-admin.js',
            array( 'jquery', 'jquery-ui-sortable' ),
            file_exists( $path . '/special-offers-admin.js' ) ? filemtime( $path . '/special-offers-admin.js' ) : null,
            true
        );

        wp_localize_script( 'fts-special-offers-admin-js', 'ftsSOAdmin', array(
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( self::NONCE_KEY ),
            'i18n'     => array(
                'search_placeholder' => __( 'Search trips by name...', 'fts' ),
                'no_results'         => __( 'No trips found.', 'fts' ),
                'saved'              => __( 'Offers saved successfully!', 'fts' ),
                'save_error'         => __( 'Error saving offers.', 'fts' ),
                'confirm_remove'     => __( 'Remove this trip from Special Offers?', 'fts' ),
            ),
        ) );
    }

    /* ── AJAX: Search Trips ─────────────────────────────── */

    public static function ajax_search_trips() {
        check_ajax_referer( self::NONCE_KEY, 'nonce' );

        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $q = sanitize_text_field( wp_unslash( $_POST['query'] ?? '' ) );

        $args = array(
            'post_type'      => 'trip',
            'post_status'    => 'publish',
            'posts_per_page' => 15,
            's'              => $q,
            'orderby'        => 'title',
            'order'          => 'ASC',
        );

        $posts = get_posts( $args );
        $results = array();

        foreach ( $posts as $p ) {
            $thumb = get_the_post_thumbnail_url( $p->ID, 'thumbnail' );
            $results[] = array(
                'id'    => $p->ID,
                'title' => $p->post_title,
                'thumb' => $thumb ? $thumb : '',
            );
        }

        wp_send_json_success( $results );
    }

    /* ── AJAX: Save Offers ──────────────────────────────── */

    public static function ajax_save() {
        check_ajax_referer( self::NONCE_KEY, 'nonce' );

        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $raw = isset( $_POST['offers'] ) ? wp_unslash( $_POST['offers'] ) : '[]';
        $decoded = json_decode( $raw, true );

        if ( ! is_array( $decoded ) ) {
            wp_send_json_error( 'Invalid data format' );
        }

        $clean = array();
        foreach ( $decoded as $i => $item ) {
            if ( empty( $item['trip_id'] ) ) continue;

            $clean[] = array(
                'trip_id'  => absint( $item['trip_id'] ),
                'badge'    => sanitize_text_field( $item['badge'] ?? '' ),
                'end_date' => sanitize_text_field( $item['end_date'] ?? '' ),
                'order'    => $i,
            );
        }

        update_option( self::OPTION_KEY, $clean );
        wp_send_json_success();
    }

    /* ── Admin Page Render ──────────────────────────────── */

    public static function render_page() {
        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_die( __( 'You do not have permission to access this page.', 'fts' ) );
        }

        $offers = get_option( self::OPTION_KEY, array() );
        if ( ! is_array( $offers ) ) $offers = array();

        $badge_options = array(
            ''               => __( '— None —', 'fts' ),
            'limited_seats'  => __( 'LIMITED SEATS', 'fts' ),
            'best_seller'    => __( 'BEST SELLER', 'fts' ),
            'hot_deal'       => __( 'HOT DEAL', 'fts' ),
        );
        ?>
        <div class="wrap fts-so-wrap">
            <h1 class="fts-so-page-title">
                <span class="dashicons dashicons-tag"></span>
                <?php esc_html_e( 'Special Offers', 'fts' ); ?>
            </h1>
            <p class="fts-so-page-desc"><?php esc_html_e( 'Select the trips to display in the Special Offers section on the homepage. Drag rows to reorder.', 'fts' ); ?></p>

            <!-- Search Box -->
            <div class="fts-so-search-wrap">
                <input type="text"
                       id="fts-so-search"
                       class="fts-so-search-input"
                       placeholder="<?php esc_attr_e( 'Search trips by name...', 'fts' ); ?>"
                       autocomplete="off" />
                <div id="fts-so-search-results" class="fts-so-search-results" style="display:none;"></div>
            </div>

            <!-- Offers List -->
            <div id="fts-so-list" class="fts-so-list">
                <?php if ( ! empty( $offers ) ) : ?>
                    <?php foreach ( $offers as $offer ) :
                        $trip_id = absint( $offer['trip_id'] ?? 0 );
                        if ( ! $trip_id ) continue;
                        $post = get_post( $trip_id );
                        if ( ! $post || $post->post_type !== 'trip' ) continue;
                        $thumb = get_the_post_thumbnail_url( $trip_id, 'thumbnail' );
                    ?>
                    <div class="fts-so-row" data-trip-id="<?php echo esc_attr( $trip_id ); ?>">
                        <span class="fts-so-drag dashicons dashicons-menu"></span>
                        <div class="fts-so-row-thumb">
                            <?php if ( $thumb ) : ?>
                                <img src="<?php echo esc_url( $thumb ); ?>" alt="" />
                            <?php else : ?>
                                <span class="dashicons dashicons-format-image fts-so-no-thumb"></span>
                            <?php endif; ?>
                        </div>
                        <div class="fts-so-row-info">
                            <strong class="fts-so-row-title"><?php echo esc_html( $post->post_title ); ?></strong>
                            <span class="fts-so-row-id">#<?php echo esc_html( $trip_id ); ?></span>
                        </div>
                        <div class="fts-so-row-fields">
                            <label class="fts-so-field-label">
                                <?php esc_html_e( 'Badge', 'fts' ); ?>
                                <select class="fts-so-badge-select">
                                    <?php foreach ( $badge_options as $val => $lbl ) : ?>
                                        <option value="<?php echo esc_attr( $val ); ?>" <?php selected( $offer['badge'] ?? '', $val ); ?>><?php echo esc_html( $lbl ); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </label>
                            <label class="fts-so-field-label">
                                <?php esc_html_e( 'Offer Ends', 'fts' ); ?>
                                <input type="date" class="fts-so-date-input" value="<?php echo esc_attr( $offer['end_date'] ?? '' ); ?>" />
                            </label>
                        </div>
                        <button type="button" class="fts-so-remove" title="<?php esc_attr_e( 'Remove', 'fts' ); ?>">
                            <span class="dashicons dashicons-trash"></span>
                        </button>
                    </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <p class="fts-so-empty-msg" id="fts-so-empty" <?php echo ! empty( $offers ) ? 'style="display:none;"' : ''; ?>>
                <?php esc_html_e( 'No trips added yet. Use the search box above to add trips.', 'fts' ); ?>
            </p>

            <!-- Save -->
            <div class="fts-so-actions">
                <button type="button" id="fts-so-save" class="button button-primary button-large">
                    <?php esc_html_e( 'Save Offers', 'fts' ); ?>
                </button>
                <span id="fts-so-status" class="fts-so-status"></span>
            </div>

            <div class="fts-so-shortcode-hint">
                <strong><?php esc_html_e( 'Shortcode:', 'fts' ); ?></strong>
                <code>[fts_special_offers]</code>
            </div>

            <!-- Hidden template for JS to clone -->
            <script type="text/html" id="tmpl-fts-so-row">
                <div class="fts-so-row" data-trip-id="{tripId}">
                    <span class="fts-so-drag dashicons dashicons-menu"></span>
                    <div class="fts-so-row-thumb">
                        {thumbHtml}
                    </div>
                    <div class="fts-so-row-info">
                        <strong class="fts-so-row-title">{title}</strong>
                        <span class="fts-so-row-id">#{tripId}</span>
                    </div>
                    <div class="fts-so-row-fields">
                        <label class="fts-so-field-label">
                            <?php esc_html_e( 'Badge', 'fts' ); ?>
                            <select class="fts-so-badge-select">
                                <?php foreach ( $badge_options as $val => $lbl ) : ?>
                                    <option value="<?php echo esc_attr( $val ); ?>"><?php echo esc_html( $lbl ); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </label>
                        <label class="fts-so-field-label">
                            <?php esc_html_e( 'Offer Ends', 'fts' ); ?>
                            <input type="date" class="fts-so-date-input" value="" />
                        </label>
                    </div>
                    <button type="button" class="fts-so-remove" title="<?php esc_attr_e( 'Remove', 'fts' ); ?>">
                        <span class="dashicons dashicons-trash"></span>
                    </button>
                </div>
            </script>
        </div>
        <?php
    }
}
