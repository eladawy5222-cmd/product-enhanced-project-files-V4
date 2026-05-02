<?php
/**
 * FTS Top Experiences — Admin Dashboard Page
 *
 * Dedicated WP-Admin page for selecting trips to feature in the
 * Top Experiences homepage section. Each row allows a badge type;
 * everything else (prices, ratings, duration) is auto-fetched.
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Top_Experiences_Admin {

    const OPTION_KEY = 'fts_top_experiences';
    const NONCE_KEY  = 'fts_top_experiences_nonce';
    const CAPABILITY = 'manage_options';

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
        add_action( 'wp_ajax_fts_search_trips_te',      array( __CLASS__, 'ajax_search' ) );
        add_action( 'wp_ajax_fts_save_top_experiences',  array( __CLASS__, 'ajax_save' ) );
    }

    /* ── Menu ───────────────────────────────────────────── */

    public static function register_menu() {
        $hook = add_menu_page(
            __( 'Top Experiences', 'fts' ),
            __( 'Top Experiences', 'fts' ),
            self::CAPABILITY,
            'fts-top-experiences',
            array( __CLASS__, 'render_page' ),
            'dashicons-star-filled',
            27
        );

        add_action( "admin_print_styles-{$hook}",  array( __CLASS__, 'enqueue_assets' ) );
        add_action( "admin_print_scripts-{$hook}", array( __CLASS__, 'enqueue_assets' ) );
    }

    /* ── Assets ─────────────────────────────────────────── */

    public static function enqueue_assets() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/top-experiences/admin';
        $path = get_stylesheet_directory()     . '/home-page-sections/top-experiences/admin';

        wp_enqueue_style(
            'fts-te-admin-css',
            $base . '/top-experiences-admin.css',
            array(),
            file_exists( $path . '/top-experiences-admin.css' ) ? filemtime( $path . '/top-experiences-admin.css' ) : null
        );

        wp_enqueue_script( 'jquery-ui-sortable' );

        wp_enqueue_script(
            'fts-te-admin-js',
            $base . '/top-experiences-admin.js',
            array( 'jquery', 'jquery-ui-sortable' ),
            file_exists( $path . '/top-experiences-admin.js' ) ? filemtime( $path . '/top-experiences-admin.js' ) : null,
            true
        );

        wp_localize_script( 'fts-te-admin-js', 'ftsTEAdmin', array(
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( self::NONCE_KEY ),
            'i18n'     => array(
                'no_results' => __( 'No trips found.', 'fts' ),
                'saved'      => __( 'Saved successfully!', 'fts' ),
                'save_error' => __( 'Error saving.', 'fts' ),
            ),
        ) );
    }

    /* ── AJAX: Search ───────────────────────────────────── */

    public static function ajax_search() {
        check_ajax_referer( self::NONCE_KEY, 'nonce' );
        if ( ! current_user_can( self::CAPABILITY ) ) wp_send_json_error( 'Unauthorized' );

        $q = sanitize_text_field( wp_unslash( $_POST['query'] ?? '' ) );

        $posts = get_posts( array(
            'post_type'      => 'trip',
            'post_status'    => 'publish',
            'posts_per_page' => 15,
            's'              => $q,
            'orderby'        => 'title',
            'order'          => 'ASC',
        ) );

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

    /* ── AJAX: Save ─────────────────────────────────────── */

    public static function ajax_save() {
        check_ajax_referer( self::NONCE_KEY, 'nonce' );
        if ( ! current_user_can( self::CAPABILITY ) ) wp_send_json_error( 'Unauthorized' );

        $raw     = isset( $_POST['items'] ) ? wp_unslash( $_POST['items'] ) : '[]';
        $decoded = json_decode( $raw, true );

        if ( ! is_array( $decoded ) ) wp_send_json_error( 'Invalid data' );

        $clean = array();
        foreach ( $decoded as $i => $item ) {
            if ( empty( $item['trip_id'] ) ) continue;
            $clean[] = array(
                'trip_id' => absint( $item['trip_id'] ),
                'badge'   => sanitize_text_field( $item['badge'] ?? '' ),
                'order'   => $i,
            );
        }

        update_option( self::OPTION_KEY, $clean );
        wp_send_json_success();
    }

    /* ── Page Render ────────────────────────────────────── */

    public static function render_page() {
        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_die( __( 'You do not have permission to access this page.', 'fts' ) );
        }

        $items = get_option( self::OPTION_KEY, array() );
        if ( ! is_array( $items ) ) $items = array();

        $badge_options = array(
            ''            => __( '— None —', 'fts' ),
            'best_seller' => __( 'BEST SELLER', 'fts' ),
            'top_rated'   => __( 'TOP RATED', 'fts' ),
            'hot_deal'    => __( 'HOT DEAL', 'fts' ),
        );
        ?>
        <div class="wrap fts-te-wrap">
            <h1 class="fts-te-page-title">
                <span class="dashicons dashicons-star-filled"></span>
                <?php esc_html_e( 'Top Experiences', 'fts' ); ?>
            </h1>
            <p class="fts-te-page-desc"><?php esc_html_e( 'Select the trips to display in the Top Experiences section. Drag rows to reorder.', 'fts' ); ?></p>

            <div class="fts-te-search-wrap">
                <input type="text" id="fts-te-search" class="fts-te-search-input"
                       placeholder="<?php esc_attr_e( 'Search trips by name...', 'fts' ); ?>" autocomplete="off" />
                <div id="fts-te-search-results" class="fts-te-search-results" style="display:none;"></div>
            </div>

            <div id="fts-te-list" class="fts-te-list">
                <?php if ( ! empty( $items ) ) : ?>
                    <?php foreach ( $items as $item ) :
                        $trip_id = absint( $item['trip_id'] ?? 0 );
                        if ( ! $trip_id ) continue;
                        $post = get_post( $trip_id );
                        if ( ! $post || $post->post_type !== 'trip' ) continue;
                        $thumb = get_the_post_thumbnail_url( $trip_id, 'thumbnail' );
                    ?>
                    <div class="fts-te-row" data-trip-id="<?php echo esc_attr( $trip_id ); ?>">
                        <span class="fts-te-drag dashicons dashicons-menu"></span>
                        <div class="fts-te-row-thumb">
                            <?php if ( $thumb ) : ?>
                                <img src="<?php echo esc_url( $thumb ); ?>" alt="" />
                            <?php else : ?>
                                <span class="dashicons dashicons-format-image fts-te-no-thumb"></span>
                            <?php endif; ?>
                        </div>
                        <div class="fts-te-row-info">
                            <strong class="fts-te-row-title"><?php echo esc_html( $post->post_title ); ?></strong>
                            <span class="fts-te-row-id">#<?php echo esc_html( $trip_id ); ?></span>
                        </div>
                        <div class="fts-te-row-fields">
                            <label class="fts-te-field-label">
                                <?php esc_html_e( 'Badge', 'fts' ); ?>
                                <select class="fts-te-badge-select">
                                    <?php foreach ( $badge_options as $val => $lbl ) : ?>
                                        <option value="<?php echo esc_attr( $val ); ?>" <?php selected( $item['badge'] ?? '', $val ); ?>><?php echo esc_html( $lbl ); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </label>
                        </div>
                        <button type="button" class="fts-te-remove" title="<?php esc_attr_e( 'Remove', 'fts' ); ?>">
                            <span class="dashicons dashicons-trash"></span>
                        </button>
                    </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <p class="fts-te-empty-msg" id="fts-te-empty" <?php echo ! empty( $items ) ? 'style="display:none;"' : ''; ?>>
                <?php esc_html_e( 'No trips added yet. Use the search box above to add trips.', 'fts' ); ?>
            </p>

            <div class="fts-te-actions">
                <button type="button" id="fts-te-save" class="button button-primary button-large">
                    <?php esc_html_e( 'Save', 'fts' ); ?>
                </button>
                <span id="fts-te-status" class="fts-te-status"></span>
            </div>

            <div class="fts-te-shortcode-hint">
                <strong><?php esc_html_e( 'Shortcode:', 'fts' ); ?></strong>
                <code>[fts_top_experiences]</code>
            </div>

            <script type="text/html" id="tmpl-fts-te-row">
                <div class="fts-te-row" data-trip-id="{tripId}">
                    <span class="fts-te-drag dashicons dashicons-menu"></span>
                    <div class="fts-te-row-thumb">{thumbHtml}</div>
                    <div class="fts-te-row-info">
                        <strong class="fts-te-row-title">{title}</strong>
                        <span class="fts-te-row-id">#{tripId}</span>
                    </div>
                    <div class="fts-te-row-fields">
                        <label class="fts-te-field-label">
                            <?php esc_html_e( 'Badge', 'fts' ); ?>
                            <select class="fts-te-badge-select">
                                <?php foreach ( $badge_options as $val => $lbl ) : ?>
                                    <option value="<?php echo esc_attr( $val ); ?>"><?php echo esc_html( $lbl ); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </label>
                    </div>
                    <button type="button" class="fts-te-remove" title="<?php esc_attr_e( 'Remove', 'fts' ); ?>">
                        <span class="dashicons dashicons-trash"></span>
                    </button>
                </div>
            </script>
        </div>
        <?php
    }
}
