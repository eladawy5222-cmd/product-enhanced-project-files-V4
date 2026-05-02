<?php
/**
 * Destination V2 - Hero Banner
 *
 * Variables provided via extract(): $term, $image_url, $total
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$name = esc_html( $term->name );
$desc = $term->description ? wp_kses_post( $term->description ) : '';
$bg   = $image_url ? 'background-image:url(' . esc_url( $image_url ) . ')' : '';

$breadcrumbs = array();
$breadcrumbs[] = '<a href="' . esc_url( home_url( '/' ) ) . '">Home</a>';
if ( $term->parent ) {
    $parent = get_term( $term->parent, $term->taxonomy );
    if ( $parent && ! is_wp_error( $parent ) ) {
        $breadcrumbs[] = '<a href="' . esc_url( get_term_link( $parent ) ) . '">' . esc_html( $parent->name ) . '</a>';
    }
}
$breadcrumbs[] = '<span>' . $name . '</span>';
?>
<section class="fts-dest-v2-hero" <?php echo $bg ? 'style="' . esc_attr( $bg ) . '"' : ''; ?>>
    <div class="fts-dest-v2-hero-overlay"></div>
    <div class="fts-dest-v2-hero-inner">
        <nav class="fts-dest-v2-breadcrumbs" aria-label="Breadcrumb">
            <?php echo implode( ' <span class="sep">/</span> ', $breadcrumbs ); ?>
        </nav>
        <h1 class="fts-dest-v2-hero-title"><?php echo $name; ?></h1>
        <?php if ( $desc ) : ?>
            <p class="fts-dest-v2-hero-desc"><?php echo $desc; ?></p>
        <?php endif; ?>
        <span class="fts-dest-v2-hero-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <?php echo esc_html( $total ); ?> trips available
        </span>
    </div>
</section>
