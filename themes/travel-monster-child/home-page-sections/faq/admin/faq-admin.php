<?php
/**
 * FTS FAQ — Admin Dashboard Page
 *
 * Provides a WP-Admin page for managing FAQ items (questions & answers)
 * displayed on the homepage FAQ section. Supports add, edit, remove, reorder.
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_FAQ_Admin {

    const OPTION_KEY = 'fts_faq_items';
    const NONCE_KEY  = 'fts_faq_nonce';
    const CAPABILITY = 'manage_options';

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
        add_action( 'wp_ajax_fts_save_faq', array( __CLASS__, 'ajax_save' ) );
    }

    public static function register_menu() {
        $hook = add_menu_page(
            __( 'FAQ Section', 'fts' ),
            __( 'FAQ Section', 'fts' ),
            self::CAPABILITY,
            'fts-faq',
            array( __CLASS__, 'render_page' ),
            'dashicons-editor-help',
            28
        );

        add_action( "admin_print_styles-{$hook}",  array( __CLASS__, 'enqueue_assets' ) );
        add_action( "admin_print_scripts-{$hook}", array( __CLASS__, 'enqueue_assets' ) );
    }

    public static function enqueue_assets() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/faq/admin';
        $path = get_stylesheet_directory()     . '/home-page-sections/faq/admin';

        wp_enqueue_style(
            'fts-faq-admin-css',
            $base . '/faq-admin.css',
            array(),
            file_exists( $path . '/faq-admin.css' ) ? filemtime( $path . '/faq-admin.css' ) : null
        );

        wp_enqueue_script( 'jquery-ui-sortable' );

        wp_enqueue_script(
            'fts-faq-admin-js',
            $base . '/faq-admin.js',
            array( 'jquery', 'jquery-ui-sortable' ),
            file_exists( $path . '/faq-admin.js' ) ? filemtime( $path . '/faq-admin.js' ) : null,
            true
        );

        wp_localize_script( 'fts-faq-admin-js', 'ftsFaqAdmin', array(
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( self::NONCE_KEY ),
            'i18n'     => array(
                'saved'          => __( 'FAQ saved successfully!', 'fts' ),
                'save_error'     => __( 'Error saving FAQ.', 'fts' ),
                'confirm_remove' => __( 'Remove this question?', 'fts' ),
                'question_ph'    => __( 'Enter the question...', 'fts' ),
                'answer_ph'      => __( 'Enter the answer...', 'fts' ),
            ),
        ) );
    }

    public static function ajax_save() {
        check_ajax_referer( self::NONCE_KEY, 'nonce' );

        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $raw     = isset( $_POST['faq_items'] ) ? wp_unslash( $_POST['faq_items'] ) : '[]';
        $decoded = json_decode( $raw, true );

        if ( ! is_array( $decoded ) ) {
            wp_send_json_error( 'Invalid data format' );
        }

        $clean = array();
        foreach ( $decoded as $i => $item ) {
            $q = sanitize_text_field( $item['question'] ?? '' );
            $a = wp_kses_post( $item['answer'] ?? '' );
            if ( empty( $q ) ) continue;

            $clean[] = array(
                'question' => $q,
                'answer'   => $a,
                'order'    => $i,
            );
        }

        update_option( self::OPTION_KEY, $clean );
        wp_send_json_success();
    }

    public static function render_page() {
        if ( ! current_user_can( self::CAPABILITY ) ) {
            wp_die( __( 'You do not have permission to access this page.', 'fts' ) );
        }

        $items = get_option( self::OPTION_KEY, array() );
        if ( ! is_array( $items ) ) $items = array();
        ?>
        <div class="wrap fts-faq-wrap">
            <h1 class="fts-faq-page-title">
                <span class="dashicons dashicons-editor-help"></span>
                <?php esc_html_e( 'FAQ Section', 'fts' ); ?>
            </h1>
            <p class="fts-faq-page-desc"><?php esc_html_e( 'Manage the questions and answers displayed in the homepage FAQ section. Drag rows to reorder.', 'fts' ); ?></p>

            <!-- FAQ List -->
            <div id="fts-faq-list" class="fts-faq-list">
                <?php if ( ! empty( $items ) ) : ?>
                    <?php foreach ( $items as $item ) : ?>
                    <div class="fts-faq-row">
                        <span class="fts-faq-drag dashicons dashicons-menu"></span>
                        <div class="fts-faq-row-fields">
                            <input type="text"
                                   class="fts-faq-question-input"
                                   value="<?php echo esc_attr( $item['question'] ?? '' ); ?>"
                                   placeholder="<?php esc_attr_e( 'Enter the question...', 'fts' ); ?>" />
                            <textarea class="fts-faq-answer-input"
                                      rows="3"
                                      placeholder="<?php esc_attr_e( 'Enter the answer...', 'fts' ); ?>"><?php echo esc_textarea( $item['answer'] ?? '' ); ?></textarea>
                        </div>
                        <button type="button" class="fts-faq-remove" title="<?php esc_attr_e( 'Remove', 'fts' ); ?>">
                            <span class="dashicons dashicons-trash"></span>
                        </button>
                    </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <p class="fts-faq-empty-msg" id="fts-faq-empty" <?php echo ! empty( $items ) ? 'style="display:none;"' : ''; ?>>
                <?php esc_html_e( 'No questions added yet. Click "Add Question" to get started.', 'fts' ); ?>
            </p>

            <!-- Add & Save -->
            <div class="fts-faq-actions">
                <button type="button" id="fts-faq-add" class="button button-secondary">
                    <span class="dashicons dashicons-plus-alt2"></span>
                    <?php esc_html_e( 'Add Question', 'fts' ); ?>
                </button>
                <button type="button" id="fts-faq-save" class="button button-primary button-large">
                    <?php esc_html_e( 'Save FAQ', 'fts' ); ?>
                </button>
                <span id="fts-faq-status" class="fts-faq-status"></span>
            </div>

            <div class="fts-faq-shortcode-hint">
                <strong><?php esc_html_e( 'Shortcode:', 'fts' ); ?></strong>
                <code>[fts_faq]</code>
            </div>
        </div>
        <?php
    }
}
