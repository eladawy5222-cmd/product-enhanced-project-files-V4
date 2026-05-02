<?php
/**
 * FTS CTA Section — Full-width call-to-action with pyramids background.
 *
 * Shortcode: [fts_cta]
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_CTA_Section {

    public static function init() {
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_cta', array( __CLASS__, 'render' ) );
    }

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/cta';
        $path = get_stylesheet_directory()     . '/home-page-sections/cta';

        wp_enqueue_style(
            'fts-cta-css',
            $base . '/css/cta.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/cta.css' ) ? filemtime( $path . '/css/cta.css' ) : null
        );
    }

    public static function render() {
        $bg_url       = 'https://ftstravels.com/wp-content/uploads/2026/04/pyramids-cairo.webp';
        $explore_url  = 'https://ftstravels.com/things-to-do/';
        $whatsapp_url = 'https://wa.me/201000479285';

        ob_start();
        ?>
        <section class="fts-cta" style="background-image:url(<?php echo esc_url( $bg_url ); ?>)">
            <div class="fts-cta-overlay"></div>
            <div class="fts-cta-inner">

                <!-- Badge -->
                <span class="fts-cta-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <?php esc_html_e( 'Limited Time: Up to 50% Off Selected Tours', 'fts' ); ?>
                </span>

                <!-- Heading -->
                <h2 class="fts-cta-heading">
                    <?php echo wp_kses_post( __( 'Ready for Your <span>Egyptian</span> Adventure?', 'fts' ) ); ?>
                </h2>

                <!-- Subtitle -->
                <p class="fts-cta-subtitle">
                    <?php esc_html_e( 'Book today and save up to 50% on the best excursions in Egypt. Free cancellation on most trips.', 'fts' ); ?>
                </p>

                <!-- Buttons -->
                <div class="fts-cta-buttons">
                    <a href="<?php echo esc_url( $explore_url ); ?>" class="fts-cta-btn fts-cta-btn--primary">
                        <?php esc_html_e( 'Explore All Trips', 'fts' ); ?>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </a>
                    <a href="<?php echo esc_url( $whatsapp_url ); ?>" class="fts-cta-btn fts-cta-btn--whatsapp" target="_blank" rel="noopener noreferrer">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <?php esc_html_e( 'Chat on WhatsApp', 'fts' ); ?>
                    </a>
                </div>

                <!-- Trust Points -->
                <div class="fts-cta-trust">
                    <span class="fts-cta-trust-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                        <?php esc_html_e( 'Free Cancellation', 'fts' ); ?>
                    </span>
                    <span class="fts-cta-trust-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <?php esc_html_e( 'Best Price Guaranteed', 'fts' ); ?>
                    </span>
                    <span class="fts-cta-trust-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                        <?php esc_html_e( 'Instant Confirmation', 'fts' ); ?>
                    </span>
                </div>

            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_CTA_Section::init();
