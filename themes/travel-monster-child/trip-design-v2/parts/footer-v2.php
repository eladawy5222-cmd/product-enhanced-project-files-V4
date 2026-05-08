<?php
/**
 * Footer V2 - Related Trips Section
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$dest_ids = ( ! empty( $destination_terms ) && ! is_wp_error( $destination_terms ) )
    ? wp_list_pluck( $destination_terms, 'term_id' )
    : array();

$related_args = array(
    'post_type'      => 'trip',
    'posts_per_page' => 4,
    'post__not_in'   => array( $trip_id ),
    'post_status'    => 'publish',
    'orderby'        => 'date',
    'order'          => 'DESC',
);

if ( ! empty( $dest_ids ) ) {
    $related_args['tax_query'] = array( array(
        'taxonomy' => 'destination',
        'field'    => 'term_id',
        'terms'    => $dest_ids,
    ) );
}

$related = new WP_Query( $related_args );

if ( ! $related->have_posts() && ! empty( $dest_ids ) ) {
    unset( $related_args['tax_query'] );
    $related = new WP_Query( $related_args );
}

if ( ! $related->have_posts() ) {
    wp_reset_postdata();
    return;
}

$dest_names = ( ! empty( $destination_terms ) && ! is_wp_error( $destination_terms ) )
    ? wp_list_pluck( $destination_terms, 'name' )
    : array();
$from_text = ! empty( $dest_names ) ? $dest_names[0] : esc_html__( 'This Destination', 'fts' );
?>

<section class="fts-v2-related-section">
    <div class="fts-v2-container">
        <h2 class="fts-v2-section-title"><?php echo esc_html( fts_v2_safe_sprintf( __( 'More trips from %s', 'fts' ), array( $from_text ), 'More trips from ' . $from_text ) ); ?></h2>

        <div class="fts-v2-related-grid">
            <?php while ( $related->have_posts() ) : $related->the_post();
                $r_id       = get_the_ID();
                $r_settings = get_post_meta( $r_id, 'wp_travel_engine_setting', true );
                $r_settings = is_array( $r_settings ) ? $r_settings : array();

                $r_trip = null;
                if ( class_exists( '\WPTravelEngine\Core\Models\Post\Trip' ) ) {
                    try { $r_trip = new \WPTravelEngine\Core\Models\Post\Trip( get_post( $r_id ) ); } catch ( \Throwable $e ) { $r_trip = null; }
                }

                $r_price_raw = floatval( get_post_meta( $r_id, 'wp_travel_engine_setting_trip_price', true ) );
                $r_sale_raw  = floatval( get_post_meta( $r_id, 'wp_travel_engine_setting_trip_actual_price', true ) );
                $r_has_sale  = false;
                if ( $r_trip && method_exists( $r_trip, 'has_sale' ) ) {
                    try { $r_has_sale = $r_trip->has_sale(); } catch ( \Throwable $e ) {}
                }
                if ( ! $r_has_sale ) $r_has_sale = ( $r_sale_raw > 0 && $r_sale_raw < $r_price_raw );
                $r_price = $r_has_sale ? $r_sale_raw : $r_price_raw;
                $r_old   = $r_has_sale ? $r_price_raw : 0;
                $r_disc = ( $r_old > 0 && $r_price > 0 ) ? round( ( ( $r_old - $r_price ) / $r_old ) * 100 ) : 0;

                $r_duration = $r_settings['trip_duration'] ?? '';
                $r_unit     = $r_settings['trip_duration_unit'] ?? 'days';
                $r_thumb    = get_the_post_thumbnail_url( $r_id, 'medium_large' );
                $r_duration_text = '';
                $r_duration_i = is_numeric( $r_duration ) ? intval( $r_duration ) : 0;
                if ( $r_duration_i > 0 ) {
                    $r_unit_key = strtolower( (string) $r_unit );
                    if ( $r_unit_key === 'hours' || $r_unit_key === 'hour' ) {
                        $r_unit_label = _n( 'Hour', 'Hours', $r_duration_i, 'fts' );
                    } elseif ( $r_unit_key === 'weeks' || $r_unit_key === 'week' ) {
                        $r_unit_label = _n( 'Week', 'Weeks', $r_duration_i, 'fts' );
                    } elseif ( $r_unit_key === 'months' || $r_unit_key === 'month' ) {
                        $r_unit_label = _n( 'Month', 'Months', $r_duration_i, 'fts' );
                    } else {
                        $r_unit_label = _n( 'Day', 'Days', $r_duration_i, 'fts' );
                    }
                    $r_duration_text = fts_v2_safe_sprintf( __( '%1$d %2$s', 'fts' ), array( $r_duration_i, $r_unit_label ), $r_duration_i . ' ' . $r_unit_label );
                }

                $r_review = function_exists( 'wptravelengine_reviews_get_trip_reviews' ) ? wptravelengine_reviews_get_trip_reviews( $r_id ) : null;
                $r_rating = $r_review['average'] ?? 0;
            ?>
            <a href="<?php the_permalink(); ?>" class="fts-v2-related-card">
                <div class="fts-v2-related-card-img<?php echo $r_thumb ? '' : ' fts-v2-related-no-img'; ?>">
                    <?php if ( $r_thumb ) : ?>
                    <img src="<?php echo esc_url( $r_thumb ); ?>" alt="<?php the_title_attribute(); ?>" loading="lazy">
                    <?php else : ?>
                    <div class="fts-v2-related-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    </div>
                    <?php endif; ?>
                    <?php if ( $r_disc > 0 ) : ?>
                    <?php
                        $fts_rel_disc = '';
                        try {
                            $fts_rel_disc = sprintf( __( '%d%% OFF', 'fts' ), intval( $r_disc ) );
                        } catch ( \Throwable $e ) {
                            $fts_rel_disc = intval( $r_disc ) . '% OFF';
                        }
                    ?>
                    <span class="fts-v2-related-discount"><?php echo esc_html( $fts_rel_disc ); ?></span>
                    <?php endif; ?>
                </div>
                <div class="fts-v2-related-card-body">
                    <h3><?php the_title(); ?></h3>
                    <div class="fts-v2-related-card-meta">
                        <?php if ( $r_duration_text ) : ?>
                        <span><i class="fa fa-clock-o"></i> <?php echo esc_html( $r_duration_text ); ?></span>
                        <?php endif; ?>
                        <?php if ( $r_rating > 0 ) : ?>
                        <span><i class="fa fa-star"></i> <?php echo number_format( $r_rating, 1 ); ?></span>
                        <?php endif; ?>
                    </div>
                    <?php if ( $r_price > 0 ) : ?>
                    <div class="fts-v2-related-card-price">
                        <?php if ( $r_old > 0 ) : ?>
                        <span class="fts-v2-related-old"><?php echo wte_get_formated_price( $r_old ); ?></span>
                        <?php endif; ?>
                        <span class="fts-v2-related-current"><?php echo esc_html( fts_v2_safe_sprintf( __( 'From %s', 'fts' ), array( wte_get_formated_price( $r_price ) ), 'From ' . wte_get_formated_price( $r_price ) ) ); ?></span>
                    </div>
                    <?php endif; ?>
                    <span class="fts-v2-related-view-btn"><?php echo esc_html__( 'View', 'fts' ); ?> <i class="fa fa-arrow-right"></i></span>
                </div>
            </a>
            <?php endwhile; wp_reset_postdata(); ?>
        </div>
    </div>
</section>
