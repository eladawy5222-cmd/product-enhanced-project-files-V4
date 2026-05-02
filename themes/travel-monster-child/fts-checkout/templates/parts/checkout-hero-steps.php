<?php
/**
 * Checkout hero + progress stepper (pixel-spec from design).
 *
 * @package FTS_Checkout
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="fts-checkout__top">
	<div class="fts-checkout__top-inner">
		<div class="fts-checkout__card fts-checkout__card--hero">
			<p class="fts-checkout__card-kicker"><?php esc_html_e( 'CLOSER TO THE LIVE SITE', 'fts-checkout' ); ?></p>
			<h1 class="fts-checkout__card-title"><?php esc_html_e( 'Checkout', 'fts-checkout' ); ?></h1>
		</div>

		<div class="fts-checkout__card fts-checkout__card--steps">
			<div class="fts-steps" role="navigation" aria-label="<?php esc_attr_e( 'Checkout progress', 'fts-checkout' ); ?>">
				<div class="fts-steps__track">
					<div class="fts-steps__group">
						<span class="fts-steps__badge fts-steps__badge--done" aria-hidden="true">
							<svg class="fts-steps__check" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M1 5.2L4.2 8.4L11 1.2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
							</svg>
						</span>
						<span class="fts-steps__label"><?php esc_html_e( 'Select a Date', 'wp-travel-engine' ); ?></span>
					</div>
					<span class="fts-steps__rule" aria-hidden="true"></span>
					<div class="fts-steps__group">
						<span class="fts-steps__badge fts-steps__badge--done" aria-hidden="true">
							<svg class="fts-steps__check" width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M1 5.2L4.2 8.4L11 1.2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
							</svg>
						</span>
						<span class="fts-steps__label"><?php esc_html_e( 'Choose Package', 'wp-travel-engine' ); ?></span>
					</div>
					<span class="fts-steps__rule" aria-hidden="true"></span>
					<div class="fts-steps__group fts-steps__group--current">
						<span class="fts-steps__badge fts-steps__badge--num" aria-hidden="true">3</span>
						<span class="fts-steps__label fts-steps__label--muted"><?php esc_html_e( 'Payment', 'wp-travel-engine' ); ?></span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
