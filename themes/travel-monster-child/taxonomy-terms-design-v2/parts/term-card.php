<?php
/**
 * Taxonomy Terms V2 - Term Card (Image Overlay Style)
 *
 * Variables via extract(): $term, $taxonomy
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$name      = esc_html( $term->name );
$link      = esc_url( $term->link );
$image_url = $term->image_url;
$count     = (int) $term->count;
$children  = $term->children;

$count_text = sprintf( _n( '%d Trip', '%d Trips', $count, 'flavor-starter' ), $count );
?>
<a href="<?php echo $link; ?>" class="fts-terms-v2-card" data-term-id="<?php echo esc_attr( $term->term_id ); ?>">
    <?php if ( $image_url ) : ?>
        <img src="<?php echo esc_url( $image_url ); ?>" alt="<?php echo esc_attr( $name ); ?>" class="fts-terms-v2-card-img" loading="lazy">
    <?php else : ?>
        <div class="fts-terms-v2-card-placeholder">
            <div class="fts-terms-v2-placeholder-content">
                <svg class="fts-terms-v2-placeholder-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/><path d="M2 12h20"/></svg>
                <span class="fts-terms-v2-placeholder-text">FTS TRAVEL</span>
            </div>
        </div>
    <?php endif; ?>

    <div class="fts-terms-v2-card-overlay">
        <div class="fts-terms-v2-card-bottom">
            <h3 class="fts-terms-v2-card-title"><?php echo $name; ?></h3>
            <span class="fts-terms-v2-card-count"><?php echo esc_html( $count_text ); ?></span>
        </div>
        <?php if ( ! empty( $children ) ) : ?>
            <div class="fts-terms-v2-card-children">
                <?php
                $max_show = 3;
                $shown    = 0;
                foreach ( $children as $child ) :
                    if ( $shown >= $max_show ) break;
                    $shown++;
                ?>
                    <span class="fts-terms-v2-child-tag"><?php echo esc_html( $child->name ); ?></span>
                <?php endforeach;
                $remaining = count( $children ) - $shown;
                if ( $remaining > 0 ) : ?>
                    <span class="fts-terms-v2-child-more">+<?php echo $remaining; ?></span>
                <?php endif; ?>
            </div>
        <?php endif; ?>
    </div>
</a>
