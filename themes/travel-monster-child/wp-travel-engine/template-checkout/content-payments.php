<?php
/**
 * Payment section — FTS checkout (header matches Billing pattern; SSL banner omitted to avoid redundancy).
 *
 * @var WPTravelEngine\Builders\FormFields\PrivacyPolicyFields $privacy_policy_fields
 * @var bool                                                 $show_title
 * @var array                                                $payment_methods
 * @package FTS_Checkout
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!-- Payment Form -->
<div class="wpte-checkout__box fts-checkout-payment">
	<?php if ( $show_title ) : ?>
		<header class="fts-checkout-payment__header">
			<p class="fts-checkout-payment__kicker"><?php esc_html_e( 'PAYMENT', 'fts-checkout' ); ?></p>
			<h3 class="fts-checkout-payment__title wpte-checkout__box-title" id="fts-payment-heading">
				<?php echo esc_html( __( 'Payment', 'wp-travel-engine' ) ); ?>
			</h3>
			<p class="fts-checkout-payment__desc">
				<?php
				echo esc_html__(
					'Trust signals and payment choices are intentionally kept close to the final action instead of being scattered across the page.',
					'fts-checkout'
				);
				?>
			</p>
		</header>
	<?php endif; ?>
	<div class="wpte-checkout__box-content fts-checkout-payment__content" data-checkout-payment-methods>
		<div data-checkout-payment-modes>
			<?php do_action( 'wptravelengine_checkout_payment_modes' ); ?>
		</div>
		<div data-checkout-payment-methods-details>
			<?php do_action( 'wptravelengine_checkout_payment_methods' ); ?>
		</div>
		<?php
		/*
		 * Trust row lives OUTSIDE [data-checkout-payment-methods-details] so WTE AJAX fragment
		 * updates (cart / payment modes) do not strip it — see Checkout.php fragments.
		 */
		?>
		<div class="fts-checkout-trust" aria-label="<?php esc_attr_e( 'Trust and support', 'fts-checkout' ); ?>">
			<div class="fts-checkout-trust__card">
				<span class="fts-checkout-trust__icon fts-checkout-trust__icon--ok" aria-hidden="true"></span>
				<h4 class="fts-checkout-trust__card-title"><?php esc_html_e( 'Secure payment', 'fts-checkout' ); ?></h4>
				<p class="fts-checkout-trust__card-desc">
					<?php esc_html_e( 'Industry-standard encryption keeps your card details protected at checkout.', 'fts-checkout' ); ?>
				</p>
			</div>
			<div class="fts-checkout-trust__card">
				<span class="fts-checkout-trust__icon fts-checkout-trust__icon--ok" aria-hidden="true"></span>
				<h4 class="fts-checkout-trust__card-title"><?php esc_html_e( 'Free cancellation', 'fts-checkout' ); ?></h4>
				<p class="fts-checkout-trust__card-desc">
					<?php esc_html_e( 'Many trips include flexible terms—check the policy before you complete payment.', 'fts-checkout' ); ?>
				</p>
			</div>
			<a
				class="fts-checkout-trust__card fts-checkout-trust__card--wa"
				href="https://wa.me/201000479285"
				target="_blank"
				rel="noopener noreferrer"
			>
				<span class="fts-checkout-trust__icon fts-checkout-trust__icon--chat" aria-hidden="true"></span>
				<span class="fts-checkout-trust__card-title"><?php esc_html_e( 'WhatsApp', 'fts-checkout' ); ?></span>
				<span class="fts-checkout-trust__card-desc"><?php esc_html_e( 'Message us for quick answers about your booking.', 'fts-checkout' ); ?></span>
			</a>
		</div>
		<div class="wpte-checkout__term-condition">
			<?php $privacy_policy_fields->render(); ?>
		</div>
		<div class="wpte-checkout__form-submit" data-checkout-form-submit>
			<?php do_action( 'wptravelengine_checkout_form_submit_button' ); ?>
		</div>
	</div>

</div>
