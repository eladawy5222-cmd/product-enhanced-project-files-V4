<?php
/**
 * FTS FAQ Section — Accordion with FAQ Schema JSON-LD for SEO.
 *
 * Shortcode: [fts_faq]
 * Data source: wp_options key 'fts_faq_items' (managed via Dashboard > FAQ Section)
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

require_once __DIR__ . '/admin/faq-admin.php';

class FTS_FAQ_Section {

    public static function init() {
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_faq', array( __CLASS__, 'render' ) );

        FTS_FAQ_Admin::init();

        $existing = get_option( FTS_FAQ_Admin::OPTION_KEY, array() );
        if ( empty( $existing ) ) {
            update_option( FTS_FAQ_Admin::OPTION_KEY, self::get_defaults() );
        }
    }

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/faq';
        $path = get_stylesheet_directory()     . '/home-page-sections/faq';

        wp_enqueue_style(
            'fts-faq-css',
            $base . '/css/faq.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/faq.css' ) ? filemtime( $path . '/css/faq.css' ) : null
        );

        wp_enqueue_script(
            'fts-faq-js',
            $base . '/js/faq.js',
            array(),
            file_exists( $path . '/js/faq.js' ) ? filemtime( $path . '/js/faq.js' ) : null,
            true
        );
    }

    private static function get_defaults() {
        return array(
            array(
                'question' => 'What are the best excursions in Egypt?',
                'answer'   => 'Top experiences include the Giza Pyramids day trip from Hurghada by plane, Orange Bay yacht tour, Luxor Valley of the Kings, Ras Mohammed snorkeling from Sharm El Sheikh, Nile cruises from Luxor to Aswan, desert safaris, and swimming with dolphins in Marsa Alam.',
            ),
            array(
                'question' => 'How do I book a trip with FTS Travels?',
                'answer'   => 'Booking is simple! Browse our trips, select your preferred date, and book online instantly. You can also contact us via WhatsApp, email, or phone for personalized assistance. No upfront payment required — pay cash on arrival for most trips.',
            ),
            array(
                'question' => 'What is your cancellation policy?',
                'answer'   => 'We offer free cancellation up to 12 hours before your trip starts. Simply contact us via WhatsApp or email, and we will process your full refund — no questions asked.',
            ),
            array(
                'question' => 'Are hotel transfers included?',
                'answer'   => 'Yes! All our excursions include free hotel pickup and drop-off from your hotel or resort. Our drivers will coordinate the exact pickup time with you the evening before your trip.',
            ),
            array(
                'question' => 'Is it safe to travel in Egypt?',
                'answer'   => 'Absolutely. Egypt is one of the safest tourist destinations in the region. Tourist areas are well-secured, and our experienced local guides ensure your comfort and safety throughout every excursion. We are ISO 9001 certified for quality and safety management.',
            ),
            array(
                'question' => 'Can I book a private tour?',
                'answer'   => 'Yes, we offer private tour options for most of our excursions. Private tours can be customized to your preferences and schedule. Contact us via WhatsApp or email for a personalized quote.',
            ),
        );
    }

    public static function render() {
        $items = get_option( FTS_FAQ_Admin::OPTION_KEY, array() );
        if ( ! is_array( $items ) || empty( $items ) ) {
            $items = self::get_defaults();
        }

        $whatsapp_url = 'https://wa.me/201000479285';
        $email        = 'booking@ftstravels.com';
        $phone        = '+201281255556';

        ob_start();
        ?>
        <section class="fts-faq">
            <div class="fts-faq-inner">

                <!-- Header -->
                <div class="fts-faq-header">
                    <span class="fts-faq-label"><?php esc_html_e( 'GOT QUESTIONS?', 'fts' ); ?></span>
                    <h2 class="fts-faq-heading"><?php esc_html_e( 'Frequently Asked Questions', 'fts' ); ?></h2>
                </div>

                <!-- Accordion -->
                <div class="fts-faq-accordion">
                    <?php foreach ( $items as $i => $item ) :
                        $q = $item['question'] ?? '';
                        $a = $item['answer'] ?? '';
                        if ( empty( $q ) ) continue;
                    ?>
                    <div class="fts-faq-item" data-index="<?php echo esc_attr( $i ); ?>">
                        <button type="button" class="fts-faq-question" aria-expanded="false">
                            <svg class="fts-faq-q-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            <span class="fts-faq-q-text"><?php echo esc_html( $q ); ?></span>
                            <svg class="fts-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div class="fts-faq-answer" aria-hidden="true">
                            <div class="fts-faq-answer-inner">
                                <?php echo wp_kses_post( wpautop( $a ) ); ?>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>

                <!-- Contact Bar -->
                <div class="fts-faq-contact">
                    <p class="fts-faq-contact-text"><?php esc_html_e( "Still have questions? We're here to help!", 'fts' ); ?></p>
                    <div class="fts-faq-contact-buttons">
                        <a href="<?php echo esc_url( $whatsapp_url ); ?>" class="fts-faq-contact-btn fts-faq-contact-btn--whatsapp" target="_blank" rel="noopener noreferrer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            <?php esc_html_e( 'WhatsApp', 'fts' ); ?>
                        </a>
                        <a href="mailto:<?php echo esc_attr( $email ); ?>" class="fts-faq-contact-btn fts-faq-contact-btn--email">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                            <?php esc_html_e( 'Email Us', 'fts' ); ?>
                        </a>
                        <a href="tel:<?php echo esc_attr( $phone ); ?>" class="fts-faq-contact-btn fts-faq-contact-btn--call">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            <?php esc_html_e( 'Call Us', 'fts' ); ?>
                        </a>
                    </div>
                </div>

            </div>
        </section>

        <?php // FAQ Schema JSON-LD for SEO ?>
        <script type="application/ld+json">
        <?php
            $schema_items = array();
            foreach ( $items as $item ) {
                $q = $item['question'] ?? '';
                $a = $item['answer'] ?? '';
                if ( empty( $q ) ) continue;
                $schema_items[] = array(
                    '@type'          => 'Question',
                    'name'           => $q,
                    'acceptedAnswer' => array(
                        '@type' => 'Answer',
                        'text'  => wp_strip_all_tags( $a ),
                    ),
                );
            }
            echo wp_json_encode( array(
                '@context'   => 'https://schema.org',
                '@type'      => 'FAQPage',
                'mainEntity' => $schema_items,
            ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT );
        ?>
        </script>
        <?php
        return ob_get_clean();
    }
}

FTS_FAQ_Section::init();
