<?php
/**
 * FTS Custom Footer Section — 4-column footer with brand, links, contact.
 *
 * Shortcode: [fts_footer]
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Footer_Section {

    public static function init() {
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_footer', array( __CLASS__, 'render' ) );
    }

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/footer';
        $path = get_stylesheet_directory()     . '/home-page-sections/footer';

        wp_enqueue_style(
            'fts-footer-css',
            $base . '/css/footer.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/footer.css' ) ? filemtime( $path . '/css/footer.css' ) : null
        );
    }

    public static function render() {
        $site_url = home_url();

        $socials = array(
            array(
                'label' => 'Facebook',
                'url'   => 'https://facebook.com/ftstravels',
                'icon'  => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
            ),
            array(
                'label' => 'Instagram',
                'url'   => 'https://instagram.com/ftstravels',
                'icon'  => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>',
            ),
            array(
                'label' => 'YouTube',
                'url'   => 'https://youtube.com/ftstravels',
                'icon'  => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>',
            ),
            array(
                'label' => 'Twitter',
                'url'   => 'https://twitter.com/ftstravels',
                'icon'  => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>',
            ),
        );

        $destinations = array(
            array( 'name' => 'Hurghada',       'url' => $site_url . '/destinations/egypt/hurghada/' ),
            array( 'name' => 'Cairo',           'url' => $site_url . '/destinations/egypt/cairo/' ),
            array( 'name' => 'Luxor',           'url' => $site_url . '/destinations/egypt/luxor/' ),
            array( 'name' => 'Sharm el-Sheikh', 'url' => $site_url . '/destinations/egypt/sharm-el-sheikh/' ),
            array( 'name' => 'Marsa Alam',      'url' => $site_url . '/destinations/egypt/marsa-alam/' ),
        );

        $quick_links = array(
            array( 'name' => 'About FTS Travels',  'url' => $site_url . '/about/' ),
            array( 'name' => 'Travel Packages',     'url' => $site_url . '/travel-packages/' ),
            array( 'name' => 'Blog',                'url' => $site_url . '/blog/' ),
            array( 'name' => 'Privacy Policy',      'url' => $site_url . '/privacy-policy/' ),
            array( 'name' => 'Terms & Conditions',  'url' => $site_url . '/terms-and-conditions/' ),
            array( 'name' => 'ISO Certification',   'url' => $site_url . '/iso-certification/' ),
        );

        $contacts = array(
            array(
                'type' => 'link',
                'url'  => 'tel:+201281255556',
                'text' => '(+20) 128 125 5556',
                'icon' => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
            ),
            array(
                'type' => 'link',
                'url'  => 'tel:+201000479285',
                'text' => '(+20) 100 047 9285',
                'icon' => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
            ),
            array(
                'type' => 'link',
                'url'  => 'mailto:booking@ftstravels.com',
                'text' => 'booking@ftstravels.com',
                'icon' => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
            ),
            array(
                'type' => 'text',
                'text' => 'Hurghada, Red Sea, Egypt',
                'icon' => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
            ),
            array(
                'type' => 'text',
                'text' => 'Available 24/7',
                'icon' => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            ),
        );

        ob_start();
        ?>
        <footer class="fts-footer">
            <div class="fts-footer-inner">
                <div class="fts-footer-grid">

                    <!-- Col 1: Brand -->
                    <div class="fts-footer-brand">
                        <div class="fts-footer-logo">
                            <div class="fts-footer-logo-letters">
                                <span class="fts-footer-letter" style="background:#06d6a0">F</span>
                                <span class="fts-footer-letter" style="background:#ff6b35">T</span>
                                <span class="fts-footer-letter" style="background:#ffd166;color:#1a1a2e">S</span>
                            </div>
                            <span class="fts-footer-logo-text"><?php esc_html_e( 'Travels', 'fts' ); ?></span>
                        </div>
                        <p class="fts-footer-desc">
                            <?php esc_html_e( 'Trusted by thousands of travelers worldwide. Over 20,000 glowing reviews highlighting our exceptional service and unforgettable experiences.', 'fts' ); ?>
                        </p>
                        <div class="fts-footer-socials">
                            <?php foreach ( $socials as $s ) : ?>
                            <a href="<?php echo esc_url( $s['url'] ); ?>" class="fts-footer-social" target="_blank" rel="noopener noreferrer" aria-label="<?php echo esc_attr( $s['label'] ); ?>">
                                <?php echo $s['icon']; ?>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    </div>

                    <!-- Col 2: Destinations -->
                    <div class="fts-footer-col">
                        <h4 class="fts-footer-heading"><?php esc_html_e( 'Destinations', 'fts' ); ?></h4>
                        <ul class="fts-footer-links">
                            <?php foreach ( $destinations as $d ) : ?>
                            <li><a href="<?php echo esc_url( $d['url'] ); ?>"><?php echo esc_html( $d['name'] ); ?></a></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>

                    <!-- Col 3: Quick Links -->
                    <div class="fts-footer-col">
                        <h4 class="fts-footer-heading"><?php esc_html_e( 'Quick Links', 'fts' ); ?></h4>
                        <ul class="fts-footer-links">
                            <?php foreach ( $quick_links as $l ) : ?>
                            <li><a href="<?php echo esc_url( $l['url'] ); ?>"><?php echo esc_html( $l['name'] ); ?></a></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>

                    <!-- Col 4: Contact Us -->
                    <div class="fts-footer-col fts-footer-contact">
                        <h4 class="fts-footer-heading"><?php esc_html_e( 'Contact Us', 'fts' ); ?></h4>
                        <ul class="fts-footer-contact-list">
                            <?php foreach ( $contacts as $c ) : ?>
                            <li>
                                <?php if ( $c['type'] === 'link' ) : ?>
                                <a href="<?php echo esc_url( $c['url'] ); ?>" class="fts-footer-contact-item">
                                    <?php echo $c['icon']; ?>
                                    <?php echo esc_html( $c['text'] ); ?>
                                </a>
                                <?php else : ?>
                                <span class="fts-footer-contact-item">
                                    <?php echo $c['icon']; ?>
                                    <?php echo esc_html( $c['text'] ); ?>
                                </span>
                                <?php endif; ?>
                            </li>
                            <?php endforeach; ?>
                        </ul>
                    </div>

                </div>
            </div>

            <!-- Bottom Bar -->
            <div class="fts-footer-bottom">
                <div class="fts-footer-bottom-inner">
                    <p class="fts-footer-copyright">&copy; <?php echo esc_html( date( 'Y' ) ); ?> <?php esc_html_e( 'FTS Travels. All rights reserved.', 'fts' ); ?></p>
                    <div class="fts-footer-payments">
                        <span class="fts-footer-payments-label"><?php esc_html_e( 'Payment Methods:', 'fts' ); ?></span>
                        <span class="fts-footer-payment-badge">Visa</span>
                        <span class="fts-footer-payment-badge">MC</span>
                        <span class="fts-footer-payment-badge">PayPal</span>
                    </div>
                </div>
            </div>
        </footer>
        <?php
        return ob_get_clean();
    }
}

FTS_Footer_Section::init();
