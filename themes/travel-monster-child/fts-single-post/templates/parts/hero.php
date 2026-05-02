<?php
/**
 * Single post hero - featured image, category, title, meta.
 * Author is intentionally NOT rendered.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $post;

$thumb_url    = get_the_post_thumbnail_url( $post, 'full' );
$categories   = get_the_category( $post->ID );
$primary_cat  = ! empty( $categories ) ? $categories[0] : null;
$date_iso     = get_the_date( 'c', $post );
$date_display = get_the_date( '', $post );
$reading_time = fts_single_post_reading_time( $post->post_content );
?>

<section class="fts-sp-hero <?php echo $thumb_url ? 'fts-sp-hero--image' : 'fts-sp-hero--plain'; ?>">
	<?php if ( $thumb_url ) : ?>
		<div class="fts-sp-hero__bg" style="background-image: url('<?php echo esc_url( $thumb_url ); ?>');" aria-hidden="true"></div>
		<div class="fts-sp-hero__overlay" aria-hidden="true"></div>
	<?php endif; ?>

	<div class="fts-sp-hero__inner">
		<?php if ( $primary_cat ) : ?>
			<a class="fts-sp-hero__category" href="<?php echo esc_url( get_category_link( $primary_cat->term_id ) ); ?>">
				<?php echo esc_html( $primary_cat->name ); ?>
			</a>
		<?php endif; ?>

		<h1 class="fts-sp-hero__title"><?php the_title(); ?></h1>

		<div class="fts-sp-hero__meta">
			<span class="fts-sp-hero__meta-item fts-sp-hero__meta-date">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
				<time datetime="<?php echo esc_attr( $date_iso ); ?>"><?php echo esc_html( $date_display ); ?></time>
			</span>
			<span class="fts-sp-hero__meta-item fts-sp-hero__meta-read">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
				<?php
				printf(
					/* translators: %d: reading time in minutes. */
					esc_html( _n( '%d min read', '%d min read', $reading_time, 'travel-monster-child' ) ),
					(int) $reading_time
				);
				?>
			</span>
		</div>
	</div>
</section>
