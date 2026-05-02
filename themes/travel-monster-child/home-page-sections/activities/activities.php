<?php
/**
 * FTS Activities Carousel Section — Horizontal scrollable activity cards.
 *
 * Shortcode: [fts_activities_carousel]
 * Customizer: FTS Activities Carousel
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Activities_Carousel_Section {

    private static $svg_kses = array(
        'svg'      => array( 'width' => true, 'height' => true, 'viewBox' => true, 'viewbox' => true, 'fill' => true, 'xmlns' => true, 'class' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true ),
        'path'     => array( 'd' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true, 'fill-rule' => true, 'clip-rule' => true ),
        'circle'   => array( 'cx' => true, 'cy' => true, 'r' => true, 'fill' => true, 'stroke' => true ),
        'rect'     => array( 'x' => true, 'y' => true, 'width' => true, 'height' => true, 'rx' => true, 'ry' => true, 'fill' => true, 'stroke' => true ),
        'line'     => array( 'x1' => true, 'y1' => true, 'x2' => true, 'y2' => true, 'stroke' => true, 'stroke-width' => true ),
        'polyline' => array( 'points' => true, 'fill' => true, 'stroke' => true, 'stroke-width' => true ),
        'polygon'  => array( 'points' => true, 'fill' => true, 'stroke' => true ),
        'g'        => array( 'fill' => true, 'stroke' => true, 'transform' => true ),
        'defs'     => array(),
        'clipPath' => array( 'id' => true ),
        'use'      => array( 'href' => true, 'xlink:href' => true ),
    );

    public static function init() {
        add_action( 'customize_register', array( __CLASS__, 'customizer' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_activities_carousel', array( __CLASS__, 'render' ) );

        add_action( 'activities_add_form_fields', array( __CLASS__, 'add_icon_field' ) );
        add_action( 'activities_edit_form_fields', array( __CLASS__, 'edit_icon_field' ), 10, 2 );
        add_action( 'created_activities', array( __CLASS__, 'save_icon_field' ) );
        add_action( 'edited_activities', array( __CLASS__, 'save_icon_field' ) );
    }

    /* ── Customizer ─────────────────────────────────────── */

    public static function customizer( $wp_customize ) {
        $wp_customize->add_section( 'fts_activities_settings', array(
            'title'    => __( 'FTS Activities Carousel', 'fts' ),
            'priority' => 33,
        ) );

        $fields = array(
            'fts_act_label'   => array( 'Explore by Category', __( 'Section Label (orange)', 'fts' ) ),
            'fts_act_heading' => array( 'What Would You Like to Do?', __( 'Section Heading', 'fts' ) ),
        );

        foreach ( $fields as $key => $meta ) {
            $wp_customize->add_setting( $key, array(
                'default'           => $meta[0],
                'sanitize_callback' => 'sanitize_text_field',
            ) );
            $wp_customize->add_control( $key, array(
                'label'   => $meta[1],
                'section' => 'fts_activities_settings',
                'type'    => 'text',
            ) );
        }
    }

    /* ── SVG Icon Term Meta ─────────────────────────────── */

    public static function add_icon_field() {
        ?>
        <div class="form-field">
            <label for="fts_activity_icon_svg"><?php esc_html_e( 'Card Icon (SVG)', 'fts' ); ?></label>
            <textarea name="fts_activity_icon_svg" id="fts_activity_icon_svg" rows="4" cols="40" style="font-family:monospace;font-size:12px;"></textarea>
            <p class="description"><?php esc_html_e( 'Paste SVG markup for the icon shown on the homepage card. Leave empty for no icon.', 'fts' ); ?></p>
        </div>
        <?php
    }

    public static function edit_icon_field( $term, $taxonomy ) {
        $value = get_term_meta( $term->term_id, 'fts_activity_icon_svg', true );
        ?>
        <tr class="form-field">
            <th scope="row"><label for="fts_activity_icon_svg"><?php esc_html_e( 'Card Icon (SVG)', 'fts' ); ?></label></th>
            <td>
                <textarea name="fts_activity_icon_svg" id="fts_activity_icon_svg" rows="4" cols="50" style="font-family:monospace;font-size:12px;"><?php echo esc_textarea( $value ); ?></textarea>
                <p class="description"><?php esc_html_e( 'Paste SVG markup for the icon shown on the homepage card. Leave empty for no icon.', 'fts' ); ?></p>
            </td>
        </tr>
        <?php
    }

    public static function save_icon_field( $term_id ) {
        if ( ! isset( $_POST['fts_activity_icon_svg'] ) ) return;
        $raw = wp_unslash( $_POST['fts_activity_icon_svg'] );
        $clean = wp_kses( $raw, self::$svg_kses );
        update_term_meta( $term_id, 'fts_activity_icon_svg', $clean );
    }

    /* ── Assets ─────────────────────────────────────────── */

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/activities';
        $path = get_stylesheet_directory()     . '/home-page-sections/activities';

        wp_enqueue_style(
            'fts-activities-css',
            $base . '/css/activities.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/activities.css' ) ? filemtime( $path . '/css/activities.css' ) : null
        );

        wp_enqueue_script(
            'fts-activities-js',
            $base . '/js/activities.js',
            array(),
            file_exists( $path . '/js/activities.js' ) ? filemtime( $path . '/js/activities.js' ) : null,
            true
        );
    }

    /* ── Helpers ─────────────────────────────────────────── */

    private static function get_image( $term_id ) {
        $img_id = get_term_meta( $term_id, 'category-image-id', true );
        if ( $img_id ) {
            $url = wp_get_attachment_image_url( intval( $img_id ), 'medium_large' );
            if ( $url ) return $url;
        }
        $url = get_term_meta( $term_id, 'thumbnail', true );
        return $url ? $url : '';
    }

    /* ── Shortcode ──────────────────────────────────────── */

    public static function render() {
        $label   = get_theme_mod( 'fts_act_label', 'Explore by Category' );
        $heading = get_theme_mod( 'fts_act_heading', 'What Would You Like to Do?' );

        $terms = get_terms( array(
            'taxonomy'   => 'activities',
            'hide_empty' => true,
            'orderby'    => 'count',
            'order'      => 'DESC',
            'number'     => 0,
        ) );

        if ( empty( $terms ) || is_wp_error( $terms ) ) return '';

        $cards = array();
        foreach ( $terms as $term ) {
            $link = get_term_link( $term );
            if ( is_wp_error( $link ) ) continue;

            $desc_raw = wp_strip_all_tags( $term->description );
            $desc = wp_trim_words( $desc_raw, 8, '...' );
            $icon = get_term_meta( $term->term_id, 'fts_activity_icon_svg', true );

            $cards[] = array(
                'name'  => $term->name,
                'link'  => $link,
                'image' => self::get_image( $term->term_id ),
                'desc'  => $desc,
                'count' => intval( $term->count ),
                'icon'  => $icon ? $icon : '',
            );
        }

        if ( empty( $cards ) ) return '';

        ob_start();
        ?>
        <section class="fts-activities">
            <div class="fts-activities-inner">

                <div class="fts-activities-header">
                    <div class="fts-activities-header-text">
                        <?php if ( $label ) : ?>
                            <span class="fts-activities-label"><?php echo esc_html( strtoupper( $label ) ); ?></span>
                        <?php endif; ?>
                        <h2 class="fts-activities-heading"><?php echo esc_html( $heading ); ?></h2>
                    </div>
                    <div class="fts-activities-arrows">
                        <button type="button" class="fts-activities-arrow fts-activities-arrow--prev" aria-label="<?php esc_attr_e( 'Previous', 'fts' ); ?>">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <button type="button" class="fts-activities-arrow fts-activities-arrow--next" aria-label="<?php esc_attr_e( 'Next', 'fts' ); ?>">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>

                <div class="fts-activities-viewport">
                    <div class="fts-activities-track">
                        <?php foreach ( $cards as $card ) : ?>
                        <a class="fts-act-card"
                           href="<?php echo esc_url( $card['link'] ); ?>"
                           <?php if ( $card['image'] ) : ?>style="background-image:url(<?php echo esc_url( $card['image'] ); ?>)"<?php endif; ?>>
                            <div class="fts-act-card-overlay"></div>
                            <div class="fts-act-card-content">
                                <?php if ( ! empty( $card['icon'] ) ) : ?>
                                    <span class="fts-act-card-icon"><?php echo $card['icon']; ?></span>
                                <?php endif; ?>
                                <h3 class="fts-act-card-name"><?php echo esc_html( $card['name'] ); ?></h3>
                                <?php if ( $card['desc'] ) : ?>
                                    <p class="fts-act-card-desc"><?php echo esc_html( $card['desc'] ); ?></p>
                                <?php endif; ?>
                                <span class="fts-act-card-count">
                                    <?php echo esc_html( sprintf( _n( '%d experience', '%d experiences', $card['count'], 'fts' ), $card['count'] ) ); ?>
                                </span>
                            </div>
                        </a>
                        <?php endforeach; ?>
                    </div>
                    <div class="fts-activities-fade"></div>
                </div>

            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_Activities_Carousel_Section::init();
