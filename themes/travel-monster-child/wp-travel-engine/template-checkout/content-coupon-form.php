<?php
/**
 * Coupon form / applied coupons — FTS accordion header on form state (child theme override).
 *
 * @var array $attributes
 * @var array $coupons
 * @var bool $show_coupon_form
 * @package FTS_Checkout
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( isset( $coupons[0] ) ) :
	foreach ( $coupons as $coupon ) :
		?>
		<div class="wpte-checkout__coupon-card">
			<div class="wpte-checkout__coupon-title">
			<?php
			esc_html_e( 'YAY! You saved ', 'wp-travel-engine' );
				wptravelengine_the_price( $coupon['amount'] ?? 0 );
			?>
				</div>
			<div class="wpte-checkout__coupon-content">
			<?php
			esc_html_e( 'Coupon ', 'wp-travel-engine' );
				echo esc_html( $coupon['label'] ?? '' );
				esc_html_e( ' Applied', 'wp-travel-engine' );
			?>
				</div>
			<button class="wpte-checkout__coupon-cancel-button"
					data-coupon-nonce="<?php echo esc_attr( wp_create_nonce( 'wte_session_cart_reset_coupon' ) ); ?>"
					data-remove-coupon
			>
				<svg>
					<use xlink:href="#x-circle"></use>
				</svg>
			</button>
		</div>
		<?php
	endforeach;
elseif ( $show_coupon_form ) :
	?>
	<details class="fts-checkout-coupon-details" open>
		<summary class="fts-checkout-coupon-details__summary">
			<span class="fts-checkout-coupon-details__summary-main" aria-hidden="true">
				<span class="fts-checkout-coupon-details__icon">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<path d="M4 9V6a2 2 0 012-2h2l1-1h6l1 1h2a2 2 0 012 2v3M4 9h16M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9M9 13h6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
					</svg>
				</span>
				<span class="fts-checkout-coupon-details__summary-text"><?php esc_html_e( 'Have a coupon code?', 'wp-travel-engine' ); ?></span>
			</span>
			<span class="fts-checkout-coupon-details__chev" aria-hidden="true">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</span>
		</summary>
		<div class="fts-checkout-coupon-details__body">
			<form action="" class="wpte-checkout__coupon-form">
				<div class="wpte-checkout__form-control wpte-material-ui-input-control">
					<input type="text" id="wpte-checkout__coupon" name="wpte-checkout__coupon"
							class="wpte-checkout__input wpte-checkout__coupon-code-input"
							data-coupon-code
							placeholder="<?php esc_attr_e( 'Coupon code', 'wp-travel-engine' ); ?>">
					<label for="wpte-checkout__coupon"><?php esc_html_e( 'Coupon code', 'wp-travel-engine' ); ?></label>
					<fieldset>
						<legend><span><?php esc_html_e( 'Coupon code', 'wp-travel-engine' ); ?></span></legend>
					</fieldset>
				</div>
				<div class="wpte-checkout__form-submit">
					<button type="submit"
							data-apply-coupon
							data-coupon-source="[data-coupon-code]"
							data-coupon-nonce="<?php echo esc_attr( wp_create_nonce( 'wte_session_cart_apply_coupon' ) ); ?>"
							class="wpte-checkout__form-submit-button"><?php esc_html_e( 'Apply', 'wp-travel-engine' ); ?></button>
				</div>
				<span style="display: none;"
						class="wpte-checkout__form-invalid-text"
						data-coupon-error-message><?php esc_html_e( 'Enter valid coupon code.', 'wp-travel-engine' ); ?></span>
			</form>
		</div>
	</details>
	<?php
endif;
