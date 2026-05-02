<?php
/**
 * FTS Hero Section — Homepage hero with trust badge, text search & stats.
 *
 * Shortcode: [fts_hero_section]
 * Customizer: FTS Hero Section
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Hero_Section {

    private static $currency_symbol = null;

    public static function init() {
        add_action( 'customize_register', array( __CLASS__, 'customizer' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_hero_section', array( __CLASS__, 'render' ) );
        add_action( 'wp_ajax_fts_hero_search', array( __CLASS__, 'ajax_search' ) );
        add_action( 'wp_ajax_nopriv_fts_hero_search', array( __CLASS__, 'ajax_search' ) );
    }

    /* ── Customizer ─────────────────────────────────────── */

    public static function customizer( $wp_customize ) {
        $wp_customize->add_section( 'fts_hero_settings', array(
            'title'    => __( 'FTS Hero Section', 'fts' ),
            'priority' => 30,
        ) );

        $wp_customize->add_setting( 'fts_hero_bg_image', array(
            'default'           => 'https://fts-travel.com/wp-content/uploads/2026/04/hero-hurghada.webp',
            'sanitize_callback' => 'esc_url_raw',
        ) );
        $wp_customize->add_control( new WP_Customize_Image_Control( $wp_customize, 'fts_hero_bg_image', array(
            'label'   => __( 'Hero Background Image', 'fts' ),
            'section' => 'fts_hero_settings',
        ) ) );

        $wp_customize->add_setting( 'fts_hero_trust_badge', array(
            'default'           => '#1 Rated Tour Operator in Egypt 2026',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
        $wp_customize->add_control( 'fts_hero_trust_badge', array(
            'label'   => __( 'Trust Badge Text', 'fts' ),
            'section' => 'fts_hero_settings',
            'type'    => 'text',
        ) );

        $wp_customize->add_setting( 'fts_hero_heading', array(
            'default'           => 'Discover',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
        $wp_customize->add_control( 'fts_hero_heading', array(
            'label'   => __( 'Heading', 'fts' ),
            'section' => 'fts_hero_settings',
            'type'    => 'text',
        ) );

        $wp_customize->add_setting( 'fts_hero_heading_highlight', array(
            'default'           => 'Egypt',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
        $wp_customize->add_control( 'fts_hero_heading_highlight', array(
            'label'       => __( 'Heading Highlight Word (orange)', 'fts' ),
            'section'     => 'fts_hero_settings',
            'type'        => 'text',
        ) );

        $wp_customize->add_setting( 'fts_hero_subheading', array(
            'default'           => 'Explore 140+ unforgettable excursions across Hurghada, Cairo, Luxor, Sharm El Sheikh & Marsa Alam. Best prices guaranteed.',
            'sanitize_callback' => 'sanitize_text_field',
        ) );
        $wp_customize->add_control( 'fts_hero_subheading', array(
            'label'   => __( 'Subheading', 'fts' ),
            'section' => 'fts_hero_settings',
            'type'    => 'textarea',
        ) );

        $stats_fields = array(
            'travelers'   => array( '20,000+', 'Happy Travelers' ),
            'experiences' => array( '140+', 'Unique Experiences' ),
            'rating'      => array( '4.9', 'Average Rating' ),
        );
        foreach ( $stats_fields as $key => $defaults ) {
            $wp_customize->add_setting( "fts_hero_stat_{$key}", array(
                'default'           => $defaults[0],
                'sanitize_callback' => 'sanitize_text_field',
            ) );
            $wp_customize->add_control( "fts_hero_stat_{$key}", array(
                'label'   => sprintf( __( 'Stat: %s — Value', 'fts' ), ucfirst( $key ) ),
                'section' => 'fts_hero_settings',
                'type'    => 'text',
            ) );
            $wp_customize->add_setting( "fts_hero_stat_{$key}_label", array(
                'default'           => $defaults[1],
                'sanitize_callback' => 'sanitize_text_field',
            ) );
            $wp_customize->add_control( "fts_hero_stat_{$key}_label", array(
                'label'   => sprintf( __( 'Stat: %s — Label', 'fts' ), ucfirst( $key ) ),
                'section' => 'fts_hero_settings',
                'type'    => 'text',
            ) );
        }
    }

    /* ── Assets ─────────────────────────────────────────── */

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/hero';
        $path = get_stylesheet_directory()     . '/home-page-sections/hero';

        wp_enqueue_style(
            'fts-hero-css',
            $base . '/css/hero.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/hero.css' ) ? filemtime( $path . '/css/hero.css' ) : null
        );

        wp_enqueue_script(
            'fts-hero-js',
            $base . '/js/hero.js',
            array( 'jquery' ),
            file_exists( $path . '/js/hero.js' ) ? filemtime( $path . '/js/hero.js' ) : null,
            true
        );

        $archive_url = get_post_type_archive_link( 'trip' );
        if ( ! $archive_url ) {
            $archive_url = home_url( '/trips/' );
        }

        wp_localize_script( 'fts-hero-js', 'ftsHeroData', array(
            'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
            'nonce'      => wp_create_nonce( 'fts_hero_search' ),
            'archiveUrl' => $archive_url,
            'currency'   => self::get_currency_symbol(),
            'i18n'       => array(
                'searching'  => __( 'Searching...', 'fts' ),
                'no_results' => __( 'No trips found. Try different keywords.', 'fts' ),
                'view_all'   => __( 'View All %s Results', 'fts' ),
                'per_person' => __( '/person', 'fts' ),
            ),
        ) );
    }

    /* ── Currency helper ────────────────────────────────── */

    private static function get_currency_symbol() {
        if ( self::$currency_symbol !== null ) return self::$currency_symbol;
        if ( function_exists( 'fts_v2_get_active_currency_symbol' ) ) {
            self::$currency_symbol = fts_v2_get_active_currency_symbol();
        } elseif ( function_exists( 'wp_travel_engine_get_currency_symbol' ) && function_exists( 'wp_travel_engine_get_currency_code' ) ) {
            self::$currency_symbol = html_entity_decode(
                (string) wp_travel_engine_get_currency_symbol( wp_travel_engine_get_currency_code() ),
                ENT_QUOTES | ENT_HTML5,
                'UTF-8'
            );
        } else {
            self::$currency_symbol = '$';
        }
        return self::$currency_symbol;
    }

    /* ── Shortcode ──────────────────────────────────────── */

    public static function render() {
        $bg_image    = get_theme_mod( 'fts_hero_bg_image', 'https://fts-travel.com/wp-content/uploads/2026/04/hero-hurghada.webp' );
        $trust_badge = get_theme_mod( 'fts_hero_trust_badge', '#1 Rated Tour Operator in Egypt 2026' );
        $heading     = get_theme_mod( 'fts_hero_heading', 'Discover' );
        $highlight   = get_theme_mod( 'fts_hero_heading_highlight', 'Egypt' );
        $subheading  = get_theme_mod( 'fts_hero_subheading', 'Explore 140+ unforgettable excursions across Hurghada, Cairo, Luxor, Sharm El Sheikh & Marsa Alam. Best prices guaranteed.' );

        $stat_travelers         = get_theme_mod( 'fts_hero_stat_travelers', '20,000+' );
        $stat_travelers_label   = get_theme_mod( 'fts_hero_stat_travelers_label', 'Happy Travelers' );
        $stat_experiences       = get_theme_mod( 'fts_hero_stat_experiences', '140+' );
        $stat_experiences_label = get_theme_mod( 'fts_hero_stat_experiences_label', 'Unique Experiences' );
        $stat_rating            = get_theme_mod( 'fts_hero_stat_rating', '4.9' );
        $stat_rating_label      = get_theme_mod( 'fts_hero_stat_rating_label', 'Average Rating' );

        $dest_count = wp_count_terms( array( 'taxonomy' => 'destination', 'hide_empty' => true ) );
        if ( is_wp_error( $dest_count ) ) {
            $dest_count = 0;
        }

        $activities = get_terms( array(
            'taxonomy'   => 'activities',
            'hide_empty' => true,
            'orderby'    => 'count',
            'order'      => 'DESC',
            'number'     => 5,
        ) );

        $full_heading = trim( $heading . ' ' . $highlight );
        $bg_alt = sprintf(
            '%s — %s',
            $full_heading,
            wp_strip_all_tags( $subheading )
        );

        ob_start();
        ?>
        <section class="fts-hero" itemscope itemtype="https://schema.org/TravelAgency">

            <?php if ( $bg_image ) : ?>
            <img class="fts-hero-bg"
                 src="<?php echo esc_url( $bg_image ); ?>"
                 alt="<?php echo esc_attr( $bg_alt ); ?>"
                 width="1920" height="1080"
                 loading="eager"
                 fetchpriority="high"
                 decoding="async">
            <?php endif; ?>

            <div class="fts-hero-overlay"></div>

            <div class="fts-hero-inner">
                <div class="fts-hero-content">

                    <?php if ( $trust_badge ) : ?>
                    <div class="fts-hero-badge">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                        <span><?php echo esc_html( $trust_badge ); ?></span>
                    </div>
                    <?php endif; ?>

                    <h1 class="fts-hero-heading" itemprop="name">
                        <?php echo esc_html( $heading ); ?>
                        <?php if ( $highlight ) : ?>
                            <span class="fts-hero-highlight"><?php echo esc_html( $highlight ); ?></span>
                        <?php endif; ?>
                    </h1>

                    <p class="fts-hero-sub" itemprop="description"><?php echo esc_html( $subheading ); ?></p>

                    <div class="fts-hero-search-wrap">
                        <form role="search" class="fts-hero-search-form" id="fts-hero-search-form"
                              action="<?php echo esc_url( home_url( '/' ) ); ?>" method="get">
                            <input type="hidden" name="post_type" value="trip">
                            <label for="fts-hero-search-input" class="screen-reader-text"><?php esc_html_e( 'Search trips', 'fts' ); ?></label>
                            <div class="fts-hero-search-field">
                                <svg class="fts-hero-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                                <input type="search"
                                       id="fts-hero-search-input"
                                       class="fts-hero-search-input"
                                       name="s"
                                       placeholder="<?php esc_attr_e( 'Search trips... e.g. Pyramids, Snorkeling', 'fts' ); ?>"
                                       autocomplete="off"
                                       aria-label="<?php esc_attr_e( 'Search trips', 'fts' ); ?>">
                            </div>
                            <button type="submit" class="fts-hero-search-btn" aria-label="<?php esc_attr_e( 'Search', 'fts' ); ?>">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                                <?php esc_html_e( 'Search', 'fts' ); ?>
                            </button>
                        </form>
                        <div class="fts-hero-results" id="fts-hero-results" role="listbox"
                             aria-label="<?php esc_attr_e( 'Search results', 'fts' ); ?>"></div>
                    </div>

                    <?php if ( ! empty( $activities ) && ! is_wp_error( $activities ) ) : ?>
                    <nav class="fts-hero-popular" aria-label="<?php esc_attr_e( 'Popular activities', 'fts' ); ?>">
                        <span class="fts-hero-popular-label"><?php esc_html_e( 'Popular:', 'fts' ); ?></span>
                        <?php foreach ( $activities as $act ) :
                            $act_link = get_term_link( $act );
                            if ( is_wp_error( $act_link ) ) continue;
                        ?>
                            <a href="<?php echo esc_url( $act_link ); ?>" class="fts-hero-chip"><?php echo esc_html( $act->name ); ?></a>
                        <?php endforeach; ?>
                    </nav>
                    <?php endif; ?>

                    <div class="fts-hero-stats" role="list">
                        <div class="fts-hero-stat" role="listitem">
                            <strong><?php echo esc_html( $stat_travelers ); ?></strong>
                            <span><?php echo esc_html( $stat_travelers_label ); ?></span>
                        </div>
                        <div class="fts-hero-stat" role="listitem">
                            <strong><?php echo esc_html( $stat_experiences ); ?></strong>
                            <span><?php echo esc_html( $stat_experiences_label ); ?></span>
                        </div>
                        <div class="fts-hero-stat" role="listitem">
                            <strong><?php echo esc_html( $stat_rating ); ?></strong>
                            <span><?php echo esc_html( $stat_rating_label ); ?></span>
                        </div>
                        <div class="fts-hero-stat" role="listitem">
                            <strong><?php echo intval( $dest_count ); ?></strong>
                            <span><?php esc_html_e( 'Destinations', 'fts' ); ?></span>
                        </div>
                    </div>
                </div>

                <div class="fts-hero-scroll" aria-hidden="true" title="Scroll down">
                    <svg width="24" height="34" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="22" height="32" rx="11" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
                        <circle class="fts-hero-scroll-dot" cx="12" cy="10" r="3" fill="rgba(255,255,255,0.8)"/>
                    </svg>
                </div>
            </div>
        </section>

        <script type="application/ld+json">
        <?php
        echo wp_json_encode( array(
            '@context'        => 'https://schema.org',
            '@type'           => 'TravelAgency',
            'name'            => get_bloginfo( 'name' ),
            'description'     => $subheading,
            'url'             => home_url( '/' ),
            'aggregateRating' => array(
                '@type'       => 'AggregateRating',
                'ratingValue' => floatval( $stat_rating ),
                'bestRating'  => 5,
                'ratingCount' => 20000,
            ),
        ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT );
        ?>
        </script>
        <?php
        return ob_get_clean();
    }

    /* ── AJAX handler ───────────────────────────────────── */

    public static function ajax_search() {
        check_ajax_referer( 'fts_hero_search', 'nonce' );

        $keyword = sanitize_text_field( $_POST['keyword'] ?? '' );

        if ( strlen( $keyword ) < 2 ) {
            wp_send_json_success( array( 'trips' => array(), 'total' => 0 ) );
        }

        $args = array(
            'post_type'      => 'trip',
            'post_status'    => 'publish',
            'posts_per_page' => 6,
            's'              => $keyword,
            'orderby'        => 'relevance',
            'order'          => 'DESC',
        );

        if ( taxonomy_exists( 'packages' ) ) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'packages',
                    'operator' => 'NOT EXISTS',
                ),
            );
        }

        $query = new WP_Query( $args );
        $trips = array();

        if ( $query->have_posts() ) {
            while ( $query->have_posts() ) {
                $query->the_post();
                $id       = get_the_ID();
                $settings = get_post_meta( $id, 'wp_travel_engine_setting', true );
                $settings = is_array( $settings ) ? $settings : array();

                $trip_obj = null;
                if ( class_exists( '\WPTravelEngine\Core\Models\Post\Trip' ) ) {
                    try {
                        $trip_obj = new \WPTravelEngine\Core\Models\Post\Trip( get_post( $id ) );
                    } catch ( \Throwable $e ) {
                        $trip_obj = null;
                    }
                }

                $t_price     = 0;
                $t_old_price = 0;
                if ( $trip_obj && method_exists( $trip_obj, 'get_price' ) && method_exists( $trip_obj, 'has_sale' ) ) {
                    try {
                        $has_sale    = $trip_obj->has_sale();
                        $t_price     = $has_sale ? $trip_obj->get_sale_price() : $trip_obj->get_price();
                        $t_old_price = $has_sale ? $trip_obj->get_price() : 0;
                    } catch ( \Throwable $e ) {}
                }
                if ( ! $t_price ) {
                    $t_price = floatval( get_post_meta( $id, 'wp_travel_engine_setting_trip_price', true ) );
                }

                $t_duration      = $settings['trip_duration'] ?? '';
                $t_duration_i    = is_numeric( $t_duration ) ? intval( $t_duration ) : 0;
                $t_duration_unit = $settings['trip_duration_unit'] ?? 'days';
                $t_duration_text = '';
                if ( $t_duration_i > 0 ) {
                    $unit_key   = strtolower( (string) $t_duration_unit );
                    $unit_label = ( $unit_key === 'hours' || $unit_key === 'hour' )
                        ? _n( 'Hour', 'Hours', $t_duration_i, 'fts' )
                        : _n( 'Day', 'Days', $t_duration_i, 'fts' );
                    $t_duration_text = $t_duration_i . ' ' . $unit_label;
                }

                $dest_terms = wp_get_post_terms( $id, 'destination', array( 'number' => 1 ) );
                $dest_name  = ( ! empty( $dest_terms ) && ! is_wp_error( $dest_terms ) )
                    ? $dest_terms[0]->name : '';
                $thumb = get_the_post_thumbnail_url( $id, 'medium' );

                $r_review = function_exists( 'wptravelengine_reviews_get_trip_reviews' )
                    ? wptravelengine_reviews_get_trip_reviews( $id ) : null;

                $trips[] = array(
                    'id'            => $id,
                    'title'         => get_the_title(),
                    'url'           => get_the_permalink(),
                    'thumbnail'     => $thumb ? $thumb : '',
                    'price'         => floatval( $t_price ),
                    'old_price'     => floatval( $t_old_price ),
                    'duration_text' => $t_duration_text,
                    'rating'        => floatval( $r_review['average'] ?? 0 ),
                    'destination'   => $dest_name,
                );
            }
        }

        $total = $query->found_posts;
        wp_reset_postdata();

        wp_send_json_success( array(
            'trips' => $trips,
            'total' => $total,
        ) );
    }
}

FTS_Hero_Section::init();
