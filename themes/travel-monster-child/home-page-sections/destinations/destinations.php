<?php
/**
 * FTS Top Destinations Section — Dynamic bento grid of top destinations.
 *
 * Shortcode: [fts_top_destinations]
 * Customizer: FTS Top Destinations
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

class FTS_Top_Destinations_Section {

    public static function init() {
        add_action( 'customize_register', array( __CLASS__, 'customizer' ) );
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
        add_shortcode( 'fts_top_destinations', array( __CLASS__, 'render' ) );
    }

    public static function customizer( $wp_customize ) {
        $wp_customize->add_section( 'fts_destinations_settings', array(
            'title'    => __( 'FTS Top Destinations', 'fts' ),
            'priority' => 32,
        ) );

        $fields = array(
            'fts_dest_label'    => array( 'Top Destinations', __( 'Section Label (orange)', 'fts' ) ),
            'fts_dest_heading'  => array( "Explore Egypt's Best Destinations", __( 'Section Heading', 'fts' ) ),
            'fts_dest_subtitle' => array( 'From the ancient pyramids of Cairo to the crystal-clear waters of the Red Sea — choose your perfect Egyptian adventure.', __( 'Section Subtitle', 'fts' ) ),
            'fts_dest_country'  => array( 'Egypt', __( 'Country Badge Label', 'fts' ) ),
        );

        foreach ( $fields as $key => $meta ) {
            $wp_customize->add_setting( $key, array(
                'default'           => $meta[0],
                'sanitize_callback' => 'sanitize_text_field',
            ) );
            $type = ( $key === 'fts_dest_subtitle' ) ? 'textarea' : 'text';
            $wp_customize->add_control( $key, array(
                'label'   => $meta[1],
                'section' => 'fts_destinations_settings',
                'type'    => $type,
            ) );
        }

        $wp_customize->add_setting( 'fts_dest_count', array(
            'default'           => 5,
            'sanitize_callback' => 'absint',
        ) );
        $wp_customize->add_control( 'fts_dest_count', array(
            'label'   => __( 'Number of Destinations', 'fts' ),
            'section' => 'fts_destinations_settings',
            'type'    => 'number',
            'input_attrs' => array( 'min' => 2, 'max' => 10 ),
        ) );
    }

    public static function enqueue() {
        $base = get_stylesheet_directory_uri() . '/home-page-sections/destinations';
        $path = get_stylesheet_directory()     . '/home-page-sections/destinations';

        wp_enqueue_style(
            'fts-destinations-css',
            $base . '/css/destinations.css',
            array( 'fts-sections-common' ),
            file_exists( $path . '/css/destinations.css' ) ? filemtime( $path . '/css/destinations.css' ) : null
        );
    }

    private static function get_dest_image( $term_id ) {
        $img_id = get_term_meta( $term_id, 'category-image-id', true );
        if ( $img_id ) {
            $url = wp_get_attachment_image_url( intval( $img_id ), 'large' );
            if ( $url ) return $url;
        }
        $url = get_term_meta( $term_id, 'thumbnail', true );
        return $url ? $url : '';
    }

    public static function render() {
        $label    = get_theme_mod( 'fts_dest_label', 'Top Destinations' );
        $heading  = get_theme_mod( 'fts_dest_heading', "Explore Egypt's Best Destinations" );
        $subtitle = get_theme_mod( 'fts_dest_subtitle', 'From the ancient pyramids of Cairo to the crystal-clear waters of the Red Sea — choose your perfect Egyptian adventure.' );
        $country  = get_theme_mod( 'fts_dest_country', 'Egypt' );
        $count    = absint( get_theme_mod( 'fts_dest_count', 5 ) );
        if ( $count < 2 ) $count = 5;

        $parent_id = 0;
        if ( $country ) {
            $parent_term = get_term_by( 'name', $country, 'destination' );
            if ( $parent_term && ! is_wp_error( $parent_term ) ) {
                $parent_id = $parent_term->term_id;
            }
        }

        $terms = get_terms( array(
            'taxonomy'   => 'destination',
            'hide_empty' => true,
            'parent'     => $parent_id ? $parent_id : 0,
            'orderby'    => 'count',
            'order'      => 'DESC',
            'number'     => $count,
        ) );

        if ( empty( $terms ) || is_wp_error( $terms ) ) return '';

        $cards = array();
        foreach ( $terms as $term ) {
            $link = get_term_link( $term );
            if ( is_wp_error( $link ) ) continue;

            $desc_raw = wp_strip_all_tags( $term->description );
            $desc = wp_trim_words( $desc_raw, 12, '...' );

            $cards[] = array(
                'name'  => $term->name,
                'link'  => $link,
                'image' => self::get_dest_image( $term->term_id ),
                'desc'  => $desc,
                'count' => intval( $term->count ),
            );
        }

        if ( empty( $cards ) ) return '';

        $total = count( $cards );
        $top_row_count = ( $total >= 5 ) ? 2 : min( $total, 2 );

        ob_start();
        ?>
        <section class="fts-destinations">
            <div class="fts-destinations-inner">

                <div class="fts-destinations-header">
                    <?php if ( $label ) : ?>
                        <span class="fts-destinations-label"><?php echo esc_html( strtoupper( $label ) ); ?></span>
                    <?php endif; ?>
                    <h2 class="fts-destinations-heading"><?php echo esc_html( $heading ); ?></h2>
                    <?php if ( $subtitle ) : ?>
                        <p class="fts-destinations-subtitle"><?php echo esc_html( $subtitle ); ?></p>
                    <?php endif; ?>
                </div>

                <div class="fts-destinations-grid" data-total="<?php echo $total; ?>">
                    <?php foreach ( $cards as $i => $card ) :
                        $is_large = ( $i < $top_row_count && $total > 3 );
                        $cls = 'fts-dest-card';
                        if ( $is_large ) $cls .= ' fts-dest-card--large';
                    ?>
                    <a class="<?php echo esc_attr( $cls ); ?>"
                       href="<?php echo esc_url( $card['link'] ); ?>"
                       <?php if ( $card['image'] ) : ?>style="background-image:url(<?php echo esc_url( $card['image'] ); ?>)"<?php endif; ?>>
                        <div class="fts-dest-card-overlay"></div>
                        <div class="fts-dest-card-content">
                            <?php if ( $country ) : ?>
                            <span class="fts-dest-card-badge">
                                <span class="fts-dest-card-badge-dot"></span>
                                <?php echo esc_html( strtoupper( $country ) ); ?>
                            </span>
                            <?php endif; ?>
                            <h3 class="fts-dest-card-name"><?php echo esc_html( $card['name'] ); ?></h3>
                            <?php if ( $card['desc'] ) : ?>
                                <p class="fts-dest-card-desc"><?php echo esc_html( $card['desc'] ); ?></p>
                            <?php endif; ?>
                            <span class="fts-dest-card-count">
                                <?php echo esc_html( sprintf( _n( '%d experience', '%d experiences', $card['count'], 'fts' ), $card['count'] ) ); ?>
                            </span>
                        </div>
                    </a>
                    <?php endforeach; ?>
                </div>

            </div>
        </section>
        <?php
        return ob_get_clean();
    }
}

FTS_Top_Destinations_Section::init();
