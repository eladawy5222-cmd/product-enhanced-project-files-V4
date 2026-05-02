<?php
/**
 * FTS "Why Us" Section — 6 trust/feature cards on dark background + review bar.
 *
 * Shortcode: [fts_why_us]
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Why_Us_Section {

    public static function init() {
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_why_us', array( __CLASS__, 'render' ) );
    }

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/why-us';
        $path = get_stylesheet_directory()     . '/home-page-sections/why-us';

        wp_enqueue_style(
            'fts-why-us-css',
            $base . '/css/why-us.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/why-us.css' ) ? filemtime( $path . '/css/why-us.css' ) : null
        );
    }

    public static function render() {
        $cards = array(
            array(
                'icon'  => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>',
                'color' => 'orange',
                'title' => __( 'Best Price Guarantee', 'fts' ),
                'desc'  => __( "Find a lower price? We'll match it. No questions asked.", 'fts' ),
            ),
            array(
                'icon'  => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
                'color' => 'teal',
                'title' => __( 'Free Cancellation', 'fts' ),
                'desc'  => __( 'Plans change. Cancel up to 12 hours before for a full refund.', 'fts' ),
            ),
            array(
                'icon'  => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
                'color' => 'orange',
                'title' => __( 'ISO 9001 Certified', 'fts' ),
                'desc'  => __( 'Internationally certified quality management for your peace of mind.', 'fts' ),
            ),
            array(
                'icon'  => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
                'color' => 'teal',
                'title' => __( '20,000+ Happy Travelers', 'fts' ),
                'desc'  => __( "Join thousands who've trusted us with their Egyptian adventure.", 'fts' ),
            ),
            array(
                'icon'  => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
                'color' => 'coral',
                'title' => __( '24/7 Local Support', 'fts' ),
                'desc'  => __( 'Direct local teams across Egypt. No overseas call centers.', 'fts' ),
            ),
            array(
                'icon'  => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
                'color' => 'green',
                'title' => __( 'Book Now, Pay Later', 'fts' ),
                'desc'  => __( 'Reserve your spot today and pay cash on arrival. Zero risk.', 'fts' ),
            ),
        );

        $avatars = array(
            array( 'initials' => 'BN', 'bg' => '#16a34a' ),
            array( 'initials' => 'TG', 'bg' => '#0ea5e9' ),
            array( 'initials' => 'ML', 'bg' => '#8b5cf6' ),
            array( 'initials' => 'JW', 'bg' => '#f59e0b' ),
        );

        ob_start();
        ?>
        <section class="fts-why-us">
            <div class="fts-why-us-inner">

                <div class="fts-why-us-header">
                    <span class="fts-why-us-label"><?php esc_html_e( 'WHY FTS TRAVELS', 'fts' ); ?></span>
                    <h2 class="fts-why-us-heading">
                        <?php echo wp_kses_post( __( 'Your Trusted Partner for <span>Egyptian Adventures</span>', 'fts' ) ); ?>
                    </h2>
                    <p class="fts-why-us-subtitle">
                        <?php esc_html_e( 'With over 12 years of experience and 20,000+ happy travelers, we deliver unforgettable experiences with the highest standards of safety and service.', 'fts' ); ?>
                    </p>
                </div>

                <div class="fts-why-us-grid">
                    <?php foreach ( $cards as $card ) : ?>
                    <div class="fts-why-us-card">
                        <div class="fts-why-us-icon fts-why-us-icon--<?php echo esc_attr( $card['color'] ); ?>">
                            <?php echo $card['icon']; ?>
                        </div>
                        <h3 class="fts-why-us-card-title"><?php echo esc_html( $card['title'] ); ?></h3>
                        <p class="fts-why-us-card-desc"><?php echo esc_html( $card['desc'] ); ?></p>
                    </div>
                    <?php endforeach; ?>
                </div>

                <div class="fts-why-us-trust-bar">
                    <div class="fts-why-us-avatars">
                        <?php foreach ( $avatars as $av ) : ?>
                        <span class="fts-why-us-avatar" style="background:<?php echo esc_attr( $av['bg'] ); ?>">
                            <?php echo esc_html( $av['initials'] ); ?>
                        </span>
                        <?php endforeach; ?>
                    </div>
                    <div class="fts-why-us-stars">
                        <?php for ( $i = 0; $i < 5; $i++ ) : ?>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <?php endfor; ?>
                        <strong class="fts-why-us-rating">4.9</strong>
                    </div>
                    <span class="fts-why-us-review-count"><?php esc_html_e( 'Based on 20,000+ reviews', 'fts' ); ?></span>
                </div>

            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_Why_Us_Section::init();
