<?php
/**
 * FTS Trust Badges Section — 4 trust/USP badges below the hero.
 *
 * Shortcode: [fts_trust_badges]
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Trust_Badges_Section {

    public static function init() {
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_trust_badges', array( __CLASS__, 'render' ) );
    }

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/trust-badges';
        $path = get_stylesheet_directory()     . '/home-page-sections/trust-badges';

        wp_enqueue_style(
            'fts-trust-badges-css',
            $base . '/css/trust-badges.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/trust-badges.css' ) ? filemtime( $path . '/css/trust-badges.css' ) : null
        );
    }

    public static function render() {
        $badges = array(
            array(
                'icon'     => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
                'color'    => 'green',
                'title'    => __( 'Free Cancellation', 'fts' ),
                'subtitle' => __( 'Up to 12h Before', 'fts' ),
            ),
            array(
                'icon'     => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m14 14-4 4"/><path d="m10 14 4 4"/></svg>',
                'color'    => 'blue',
                'title'    => __( 'Flexible Dates', 'fts' ),
                'subtitle' => __( 'Change Up to 4h Before', 'fts' ),
            ),
            array(
                'icon'     => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
                'color'    => 'orange',
                'title'    => __( 'Book Now, Pay Cash', 'fts' ),
                'subtitle' => __( 'On Arrival', 'fts' ),
            ),
            array(
                'icon'     => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
                'color'    => 'teal',
                'title'    => __( 'Direct Local Team', 'fts' ),
                'subtitle' => __( 'No Overseas Call Centers', 'fts' ),
            ),
        );

        ob_start();
        ?>
        <section class="fts-trust-badges">
            <div class="fts-trust-badges-inner">
                <?php foreach ( $badges as $badge ) : ?>
                <div class="fts-trust-badge-item">
                    <div class="fts-trust-badge-icon fts-trust-badge-icon--<?php echo esc_attr( $badge['color'] ); ?>">
                        <?php echo $badge['icon']; ?>
                    </div>
                    <div class="fts-trust-badge-text">
                        <strong><?php echo esc_html( $badge['title'] ); ?></strong>
                        <span><?php echo esc_html( $badge['subtitle'] ); ?></span>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_Trust_Badges_Section::init();
