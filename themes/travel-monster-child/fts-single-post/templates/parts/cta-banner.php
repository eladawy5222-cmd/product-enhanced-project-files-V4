<?php
/**
 * Global single-post CTA banner.
 * One source of truth; copy is intentionally hard-coded so it reads
 * as a consistent brand voice across the whole blog.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$trips_url = fts_single_post_trips_url();
?>

<section class="fts-sp-cta" aria-label="<?php esc_attr_e( 'Explore trips', 'travel-monster-child' ); ?>">
	<div class="fts-sp-cta__inner">
		<div class="fts-sp-cta__text">
			<p class="fts-sp-cta__kicker"><?php esc_html_e( 'Ready for the real thing?', 'travel-monster-child' ); ?></p>
			<h2 class="fts-sp-cta__title">
				<?php esc_html_e( 'Turn this read into your next trip.', 'travel-monster-child' ); ?>
			</h2>
			<p class="fts-sp-cta__desc">
				<?php esc_html_e( 'Browse curated, small-group journeys crafted by FTS Travels — local guides, hand-picked stays, and zero hassle.', 'travel-monster-child' ); ?>
			</p>
		</div>
		<div class="fts-sp-cta__action">
			<a class="fts-sp-cta__btn" href="<?php echo esc_url( $trips_url ); ?>">
				<?php esc_html_e( 'Explore Trips', 'travel-monster-child' ); ?>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
			</a>
		</div>
	</div>
</section>
