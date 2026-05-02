<?php
/**
 * FTS Traveler Reviews Section — Static review cards + Trustindex embed.
 *
 * Shortcode: [fts_reviews]
 * Customizer: FTS Reviews (Trustindex embed code textarea)
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Reviews_Section {

    public static function init() {
        add_action( 'customize_register', array( __CLASS__, 'customizer' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_reviews', array( __CLASS__, 'render' ) );
    }

    /* ── Customizer ─────────────────────────────────────────── */

    public static function customizer( $wp_customize ) {
        $wp_customize->add_section( 'fts_reviews_settings', array(
            'title'    => __( 'FTS Reviews', 'fts' ),
            'priority' => 38,
        ) );

        $wp_customize->add_setting( 'fts_trustindex_code', array(
            'default'           => '',
            'sanitize_callback' => array( __CLASS__, 'sanitize_embed' ),
        ) );

        $wp_customize->add_control( 'fts_trustindex_code', array(
            'label'       => __( 'Trustindex Embed Code', 'fts' ),
            'description' => __( 'Paste the full Trustindex widget code (HTML + script).', 'fts' ),
            'section'     => 'fts_reviews_settings',
            'type'        => 'textarea',
        ) );
    }

    public static function sanitize_embed( $input ) {
        if ( current_user_can( 'unfiltered_html' ) ) {
            return $input;
        }
        return wp_kses_post( $input );
    }

    /* ── Assets ─────────────────────────────────────────────── */

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/reviews';
        $path = get_stylesheet_directory()     . '/home-page-sections/reviews';

        wp_enqueue_style(
            'fts-reviews-css',
            $base . '/css/reviews.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/reviews.css' ) ? filemtime( $path . '/css/reviews.css' ) : null
        );
    }

    /* ── Render ─────────────────────────────────────────────── */

    private static function get_cards() {
        return array(
            array(
                'text'    => "Absolutely incredible experience! The pyramids tour from Hurghada by plane was seamless. Our guide was knowledgeable and the whole day was perfectly organized. Highly recommend FTS Travels!",
                'trip'    => 'Giza Pyramids Tour by Plane',
                'name'    => 'Sarah M.',
                'country' => 'United Kingdom',
                'date'    => 'March 2026',
                'avatar'  => '#16a34a',
                'initials'=> 'SM',
            ),
            array(
                'text'    => "The Orange Bay yacht trip was the highlight of our holiday! Crystal clear water, amazing snorkeling, and the lunch on board was delicious. Great value for money.",
                'trip'    => 'Orange Bay Yacht Tour',
                'name'    => 'Thomas K.',
                'country' => 'Germany',
                'date'    => 'March 2026',
                'avatar'  => '#ea580c',
                'initials'=> 'TK',
            ),
            array(
                'text'    => "Desert safari was an unforgettable adventure! The quad biking, camel riding, and BBQ dinner under the stars were magical. The team was so friendly and professional.",
                'trip'    => 'Desert Safari & BBQ Dinner',
                'name'    => 'Maria L.',
                'country' => 'Italy',
                'date'    => 'February 2026',
                'avatar'  => '#8b5cf6',
                'initials'=> 'ML',
            ),
            array(
                'text'    => "Best diving experience I've ever had! The Red Sea coral reefs are breathtaking. The instructors were patient and made us feel safe. Will definitely book again!",
                'trip'    => 'Scuba Diving Day Trip',
                'name'    => 'James W.',
                'country' => 'Australia',
                'date'    => 'February 2026',
                'avatar'  => '#f59e0b',
                'initials'=> 'JW',
            ),
            array(
                'text'    => "Luxor day trip was worth every penny. Seeing the Valley of the Kings and Karnak Temple in person was a dream come true. FTS made it so easy from Hurghada!",
                'trip'    => 'Luxor Ancient Egypt Tour',
                'name'    => 'Anna P.',
                'country' => 'Poland',
                'date'    => 'January 2026',
                'avatar'  => '#ea580c',
                'initials'=> 'AP',
            ),
        );
    }

    private static function star_svg() {
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }

    private static function quote_svg() {
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="#e65100" opacity="0.3"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>';
    }

    public static function render() {
        $cards           = self::get_cards();
        $trustindex_code = get_theme_mod( 'fts_trustindex_code', '' );

        $platforms = array(
            array( 'name' => 'TripAdvisor', 'color' => '#34e0a1', 'letter' => 'T' ),
            array( 'name' => 'Google',      'color' => '#4285f4', 'letter' => 'G' ),
            array( 'name' => 'Trustpilot',  'color' => '#00b67a', 'letter' => 'T' ),
            array( 'name' => 'GetYourGuide','color' => '#e04848', 'letter' => 'G' ),
        );

        ob_start();
        ?>
        <section class="fts-reviews">
            <div class="fts-reviews-inner">

                <!-- Header -->
                <div class="fts-reviews-header">
                    <div class="fts-reviews-header-left">
                        <span class="fts-reviews-label"><?php esc_html_e( 'TRAVELER REVIEWS', 'fts' ); ?></span>
                        <h2 class="fts-reviews-heading"><?php esc_html_e( 'What Our Guests Say', 'fts' ); ?></h2>
                    </div>
                </div>

                <!-- Review Cards (static, hidden when Trustindex is active) -->
                <?php if ( ! $trustindex_code ) : ?>
                <div class="fts-reviews-grid">
                    <?php foreach ( $cards as $card ) : ?>
                    <div class="fts-reviews-card">
                        <div class="fts-reviews-card-top">
                            <?php echo self::quote_svg(); ?>
                            <div class="fts-reviews-stars">
                                <?php for ( $i = 0; $i < 5; $i++ ) echo self::star_svg(); ?>
                            </div>
                        </div>
                        <p class="fts-reviews-card-text">&ldquo;<?php echo esc_html( $card['text'] ); ?>&rdquo;</p>
                        <span class="fts-reviews-card-trip"><?php echo esc_html( $card['trip'] ); ?></span>
                        <div class="fts-reviews-card-author">
                            <span class="fts-reviews-avatar" style="background:<?php echo esc_attr( $card['avatar'] ); ?>">
                                <?php echo esc_html( $card['initials'] ); ?>
                            </span>
                            <div class="fts-reviews-author-info">
                                <strong><?php echo esc_html( $card['name'] ); ?></strong>
                                <span><?php echo esc_html( $card['country'] . ' · ' . $card['date'] ); ?></span>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>

                <!-- Trustindex Embed -->
                <?php if ( $trustindex_code ) : ?>
                <div class="fts-reviews-trustindex">
                    <?php echo $trustindex_code; ?>
                </div>
                <?php endif; ?>

                <!-- Trusted On -->
                <div class="fts-reviews-trusted">
                    <span class="fts-reviews-trusted-label"><?php esc_html_e( 'Trusted on:', 'fts' ); ?></span>
                    <?php foreach ( $platforms as $p ) : ?>
                    <span class="fts-reviews-platform">
                        <span class="fts-reviews-platform-icon" style="background:<?php echo esc_attr( $p['color'] ); ?>">
                            <?php echo esc_html( $p['letter'] ); ?>
                        </span>
                        <?php echo esc_html( $p['name'] ); ?>
                    </span>
                    <?php endforeach; ?>
                </div>

            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_Reviews_Section::init();
