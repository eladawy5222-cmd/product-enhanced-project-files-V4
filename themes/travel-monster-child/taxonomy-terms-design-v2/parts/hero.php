<?php
/**
 * Taxonomy Terms V2 - Minimal Page Header
 *
 * Variables via extract(): $title, $desc, $image_url, $total, $taxonomy
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$plural_map = array(
    'destination' => __( 'Destinations', 'flavor-starter' ),
    'activities'  => __( 'Activities', 'flavor-starter' ),
    'trip_types'  => __( 'Trip Types', 'flavor-starter' ),
);
$count_label = $total . ' ' . ( $plural_map[ $taxonomy ] ?? ucfirst( $taxonomy ) );
?>
<div class="fts-terms-v2-page-header">
    <div class="fts-terms-v2-page-header-inner">
        <div class="fts-terms-v2-page-header-left">
            <nav class="fts-terms-v2-breadcrumbs" aria-label="Breadcrumb">
                <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Home</a>
                <span class="sep">/</span>
                <span><?php echo esc_html( $title ); ?></span>
            </nav>
            <h1 class="fts-terms-v2-page-title"><?php echo esc_html( $title ); ?></h1>
            <?php if ( $desc ) : ?>
                <p class="fts-terms-v2-page-desc"><?php echo esc_html( wp_trim_words( $desc, 20 ) ); ?></p>
            <?php endif; ?>
        </div>
        <div class="fts-terms-v2-page-header-right">
            <span class="fts-terms-v2-page-count">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                <?php echo esc_html( $count_label ); ?>
            </span>
        </div>
    </div>
</div>
