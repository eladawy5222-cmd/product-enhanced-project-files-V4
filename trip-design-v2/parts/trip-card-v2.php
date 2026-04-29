<?php
/**
 * Destination V2 - Trip Card
 *
 * Variables via extract(): id, title, url, image_id, price, sale_price, has_sale,
 *   discount, display, duration, destination, difficulty, group_size,
 *   rating, review_count, featured, trip_type
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$image = $image_id ? wp_get_attachment_image( $image_id, 'medium_large', false, array(
    'class'   => 'fts-dest-v2-card-img',
    'loading' => 'lazy',
) ) : '<div class="fts-dest-v2-card-no-img">No Image</div>';
?>
<article class="fts-dest-v2-card<?php echo $featured ? ' is-featured' : ''; ?>" data-id="<?php echo esc_attr( $id ); ?>">
    <a href="<?php echo esc_url( $url ); ?>" class="fts-dest-v2-card-link" aria-label="<?php echo esc_attr( $title ); ?>">
        <div class="fts-dest-v2-card-media">
            <?php echo $image; ?>
            <div class="fts-dest-v2-card-badges">
                <?php if ( $featured ) : ?>
                    <span class="fts-dest-v2-badge fts-dest-v2-badge-featured">
                        <svg class="fts-dest-v2-badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                        Featured
                    </span>
                <?php endif; ?>
                <?php if ( $discount > 0 ) : ?>
                    <span class="fts-dest-v2-badge fts-dest-v2-badge-discount"><?php echo $discount; ?>% OFF</span>
                <?php endif; ?>
            </div>
            <?php if ( $featured ) : ?>
                <div class="fts-dest-v2-featured-glow"></div>
            <?php endif; ?>
            <?php if ( $duration ) : ?>
            <span class="fts-dest-v2-card-duration">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <?php echo esc_html( $duration ); ?>
            </span>
            <?php endif; ?>
        </div>
        <div class="fts-dest-v2-card-body">
            <div class="fts-dest-v2-card-mobile-meta">
                <?php if ( $duration ) : ?>
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        <?php echo esc_html( $duration ); ?>
                    </span>
                <?php endif; ?>
                <?php if ( ! empty( $trip_type ) ) : ?>
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
                        <?php echo esc_html( $trip_type ); ?>
                    </span>
                <?php endif; ?>
            </div>
            <?php if ( $destination ) : ?>
                <span class="fts-dest-v2-card-dest"><?php echo esc_html( $destination ); ?></span>
            <?php endif; ?>
            <h3 class="fts-dest-v2-card-title"><?php echo esc_html( $title ); ?></h3>
            <?php if ( ! empty( $trustindex ) ) : ?>
                <div class="fts-dest-v2-card-tidx"><?php echo $trustindex; ?></div>
            <?php endif; ?>
            <div class="fts-dest-v2-card-meta">
                <?php if ( $difficulty ) : ?>
                    <span class="fts-dest-v2-card-difficulty">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>
                        <?php echo esc_html( $difficulty ); ?>
                    </span>
                <?php endif; ?>
                <?php if ( $group_size ) : ?>
                    <span class="fts-dest-v2-card-group">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                        <?php echo esc_html( $group_size ); ?>
                    </span>
                <?php endif; ?>
            </div>
            <?php if ( $rating > 0 ) : ?>
            <div class="fts-dest-v2-card-rating">
                <?php
                $full  = floor( $rating );
                $half  = ( $rating - $full ) >= 0.5 ? 1 : 0;
                $empty = 5 - $full - $half;
                for ( $s = 0; $s < $full; $s++ )  echo '<span class="star full">★</span>';
                for ( $s = 0; $s < $half; $s++ )  echo '<span class="star half">★</span>';
                for ( $s = 0; $s < $empty; $s++ ) echo '<span class="star empty">☆</span>';
                ?>
                <span class="fts-dest-v2-card-review-count">(<?php echo intval( $review_count ); ?>)</span>
            </div>
            <?php endif; ?>
        </div>
        <div class="fts-dest-v2-card-footer">
            <div class="fts-dest-v2-card-price">
                <?php if ( $has_sale ) : ?>
                    <span class="fts-dest-v2-card-price-old"><?php echo FTS_Destination_V2::format_price( $price ); ?></span>
                <?php endif; ?>
                <span class="fts-dest-v2-card-price-current">
                    <span class="fts-dest-v2-card-from">From</span>
                    <?php echo FTS_Destination_V2::format_price( $display ); ?>
                </span>
                <?php if ( $discount > 0 ) : ?>
                    <span class="fts-dest-v2-card-discount-inline">-<?php echo $discount; ?>%</span>
                <?php endif; ?>
            </div>
            <span class="fts-dest-v2-card-cta">View Trip →</span>
        </div>
    </a>
</article>
