<?php
/**
 * Layout Controller for FTS Taxonomy Terms V2
 *
 * Handles asset loading, rendering, and data for the
 * premium taxonomy term listing pages (Destinations, Trip Types, Activities).
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Taxonomy_Terms_V2 {

    private static $page_templates = array(
        'templates/template-destination.php' => 'destination',
        'templates/template-activities.php'  => 'activities',
        'templates/template-trip_types.php'  => 'trip_types',
    );

    private static $css_modules = array(
        'hero', 'terms-page', 'term-card', 'responsive',
    );

    public static function init() {
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 99 );
    }

    /* ─── Helpers ─── */

    private static function ver( $file ) {
        return file_exists( $file ) ? (string) filemtime( $file ) : '1.0';
    }

    private static function base_dir() {
        return get_stylesheet_directory() . '/taxonomy-terms-design-v2/';
    }

    private static function base_uri() {
        return get_stylesheet_directory_uri() . '/taxonomy-terms-design-v2/';
    }

    private static function inc( $part, $vars = array() ) {
        if ( ! empty( $vars ) ) extract( $vars );
        include self::base_dir() . 'parts/' . $part . '.php';
    }

    /**
     * Check if the current page uses one of the WTE taxonomy page templates.
     */
    private static function is_terms_page() {
        if ( ! is_page() ) return false;
        global $post;
        if ( ! $post ) return false;
        $tpl = get_post_meta( $post->ID, '_wp_page_template', true );
        return isset( self::$page_templates[ $tpl ] ) ? $tpl : false;
    }

    /* ─── Assets ─── */

    public static function enqueue_assets() {
        if ( ! self::is_terms_page() ) return;

        $dir = self::base_dir() . 'assets/';
        $uri = self::base_uri() . 'assets/';

        $v2css  = get_stylesheet_directory()     . '/trip-design-v2/assets/css/';
        $v2uri  = get_stylesheet_directory_uri() . '/trip-design-v2/assets/css/';

        wp_enqueue_style( 'fts-terms-v2-vars', $v2uri . 'variables.css', array(), self::ver( $v2css . 'variables.css' ) );

        $prev = array( 'fts-terms-v2-vars' );
        foreach ( self::$css_modules as $m ) {
            $handle = 'fts-terms-v2-' . $m;
            $file   = $dir . 'css/' . $m . '.css';
            if ( ! file_exists( $file ) ) continue;
            wp_enqueue_style( $handle, $uri . 'css/' . $m . '.css', $prev, self::ver( $file ) );
            $prev = array( $handle );
        }

        $js = $dir . 'terms-v2.js';
        if ( file_exists( $js ) ) {
            wp_enqueue_script( 'fts-terms-v2-js', $uri . 'terms-v2.js', array( 'jquery' ), self::ver( $js ), true );
        }
    }

    /* ─── Data ─── */

    private static function get_terms_data( $taxonomy ) {
        $raw = get_terms( array(
            'taxonomy'   => $taxonomy,
            'orderby'    => 'name',
            'order'      => 'ASC',
            'hide_empty' => false,
        ) );

        if ( is_wp_error( $raw ) || empty( $raw ) ) return array();

        $by_id = array();
        foreach ( $raw as $t ) {
            $t->children  = array();
            $t->link      = get_term_link( $t );
            $t->thumbnail = (int) get_term_meta( $t->term_id, 'category-image-id', true );
            $t->image_url = $t->thumbnail
                ? wp_get_attachment_image_url( $t->thumbnail, 'medium_large' )
                : '';
            $by_id[ $t->term_id ] = $t;
        }

        foreach ( $by_id as $id => $t ) {
            if ( ! empty( $t->parent ) && isset( $by_id[ $t->parent ] ) ) {
                $by_id[ $t->parent ]->children[] = $t;
            }
        }

        return $by_id;
    }

    private static function taxonomy_label( $taxonomy ) {
        $labels = array(
            'destination' => __( 'Destinations', 'flavor-starter' ),
            'activities'  => __( 'Activities', 'flavor-starter' ),
            'trip_types'  => __( 'Trip Types', 'flavor-starter' ),
        );
        return isset( $labels[ $taxonomy ] ) ? $labels[ $taxonomy ] : ucfirst( $taxonomy );
    }

    /* ─── Render ─── */

    public static function render( $taxonomy ) {
        global $post;

        $terms  = self::get_terms_data( $taxonomy );
        $top    = array_filter( $terms, function( $t ) { return empty( $t->parent ); } );
        $total  = count( $top );
        $label  = self::taxonomy_label( $taxonomy );

        $page_image = '';
        if ( $post && has_post_thumbnail( $post->ID ) ) {
            $page_image = get_the_post_thumbnail_url( $post->ID, 'full' );
        }
        $page_desc = ( $post && ! empty( $post->post_content ) )
            ? wp_strip_all_tags( $post->post_content )
            : '';

        ?>
        <div class="fts-terms-v2-root">
            <?php self::inc( 'hero', array(
                'title'     => $label,
                'desc'      => $page_desc,
                'image_url' => $page_image,
                'total'     => $total,
                'taxonomy'  => $taxonomy,
            ) ); ?>

            <div class="fts-terms-v2-container">
                <?php if ( $total > 0 ) : ?>
                    <div class="fts-terms-v2-grid">
                        <?php foreach ( $top as $term ) :
                            self::inc( 'term-card', array(
                                'term'      => $term,
                                'taxonomy'  => $taxonomy,
                            ) );
                        endforeach; ?>
                    </div>
                <?php else : ?>
                    <div class="fts-terms-v2-empty">
                        <p><?php esc_html_e( 'No items found.', 'flavor-starter' ); ?></p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }
}

FTS_Taxonomy_Terms_V2::init();
