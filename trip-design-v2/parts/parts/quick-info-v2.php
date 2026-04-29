<?php
/**
 * Quick Info V2 - Price Bar + Social Proof + Trust Badges + Sticky Tabs
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$dest_names_list = ( ! empty( $destination_terms ) && ! is_wp_error( $destination_terms ) )
    ? wp_list_pluck( $destination_terms, 'name' )
    : array();
$trending_location = ! empty( $dest_names_list ) ? implode( ', ', array_slice( $dest_names_list, 0, 2 ) ) : '';
$at_items = isset( $trip_fact_items ) && is_array( $trip_fact_items ) ? $trip_fact_items : array();
?>

<!-- Quick Price + Hook -->
<div class="fts-v2-quick-bar">
    <div class="fts-v2-container">
        <div class="fts-v2-quick-bar-inner">
            <div class="fts-v2-quick-text">
                <p class="fts-v2-hook-text"><?php echo esc_html( $overview_excerpt ); ?></p>
                <?php if ( ! empty( $at_items ) ) : ?>
                <ul class="fts-v2-at-a-glance">
                    <?php foreach ( $at_items as $it ) : ?>
                        <li><strong><?php echo esc_html( $it['label'] ); ?>:</strong> <?php echo esc_html( $it['value'] ); ?></li>
                    <?php endforeach; ?>
                </ul>
                <?php endif; ?>
            </div>
            <div class="fts-v2-quick-price-cta">
                <div class="fts-v2-price-block">
                    <?php if ( $old_price > 0 ) : ?>
                        <span class="fts-v2-price-old"><?php echo esc_html( wte_get_formated_price( $old_price ) ); ?></span>
                    <?php endif; ?>
                    <?php if ( $display_price > 0 ) : ?>
                        <span class="fts-v2-price-current"><?php echo esc_html( wte_get_formated_price( $display_price ) ); ?></span>
                        <span class="fts-v2-price-person"><?php echo esc_html__( '/ person', 'fts' ); ?></span>
                    <?php endif; ?>
                    <?php if ( $discount_pct > 0 ) : ?>
                        <span class="fts-v2-discount-badge">-<?php echo intval( $discount_pct ); ?>%</span>
                    <?php endif; ?>
                </div>
                <a href="#" class="fts-v2-book-now-btn fts-bm-trigger"><?php echo esc_html__( 'Book Now', 'fts' ); ?></a>
            </div>
        </div>
    </div>
</div>

<?php if ( $avg_rating > 0 ) : ?>
<!-- Trust Badges (Dark Navy Bar) -->
<div class="fts-v2-trust-bar">
    <div class="fts-v2-container">
        <div class="fts-v2-trust-items">
            <div class="fts-v2-trust-item">
                <svg class="fts-v2-icon-star" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span><strong><?php echo number_format( $avg_rating, 1 ); ?>/5</strong> (<?php echo esc_html( sprintf( _n( '%s review', '%s reviews', $review_count, 'fts' ), number_format_i18n( $review_count ) ) ); ?>)</span>
            </div>
        </div>
    </div>
</div>
<?php endif; ?>

<?php if ( ! empty( $trustindex_code ) ) : ?>
<div class="fts-v2-trust-tidx-row">
    <div class="fts-v2-container">
        <?php echo wp_kses_post( $trustindex_code ); ?>
    </div>
</div>
<?php endif; ?>

<!-- Sticky Tabs Navigation -->
<div class="fts-v2-tabs-nav" id="fts-v2-tabs-nav">
    <div class="fts-v2-container">
        <div class="fts-v2-tabs-scroll">
            <?php foreach ( $tab_sections as $id => $label ) : ?>
                <a href="#fts-v2-sec-<?php echo esc_attr( $id ); ?>" class="fts-v2-tab-link" data-section="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></a>
            <?php endforeach; ?>
        </div>
    </div>
</div>
