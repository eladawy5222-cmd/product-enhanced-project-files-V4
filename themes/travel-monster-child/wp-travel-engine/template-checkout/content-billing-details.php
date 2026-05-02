<?php
/**
 * Billing Details — FTS checkout (optional block collapsible via native <details>).
 *
 * @var WPTravelEngine\Builders\FormFields\BillingFormFields $billing_form_fields
 * @var int                                                   $lead_travellers_fields_count
 * @var bool                                                  $show_title
 * @package FTS_Checkout
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$billing_desc = apply_filters(
	'fts_checkout_billing_description',
	__( 'We use these details to send your confirmation and important updates about your trip.', 'fts-checkout' )
);

$fts_guide = '';
$fts_hotel = '';
if ( ! empty( $_POST['billing'] ) && is_array( $_POST['billing'] ) ) {
	if ( isset( $_POST['billing']['fts_guide_language'] ) ) {
		$fts_guide = sanitize_text_field( wp_unslash( $_POST['billing']['fts_guide_language'] ) );
	}
	if ( isset( $_POST['billing']['fts_hotel_name'] ) ) {
		$fts_hotel = sanitize_text_field( wp_unslash( $_POST['billing']['fts_hotel_name'] ) );
	}
}

$fts_additional_note = '';
if ( isset( $_POST['wptravelengine_additional_note'] ) ) {
	$fts_additional_note = wp_unslash( $_POST['wptravelengine_additional_note'] );
} elseif ( function_exists( 'WTE' ) && WTE()->session ) {
	$fts_additional_note = (string) WTE()->session->get( 'additional_note', '' );
}
?>
<!-- Billing Details Form -->
<div class="wpte-checkout__box fts-checkout-billing fts-checkout-billing--static open">
	<?php if ( $show_title ) : ?>
		<header class="fts-checkout-billing__header">
			<div class="fts-checkout-billing__header-row">
				<div class="fts-checkout-billing__header-text">
					<p class="fts-checkout-billing__kicker"><?php esc_html_e( 'BILLING DETAILS', 'fts-checkout' ); ?></p>
					<h3 class="fts-checkout-billing__title" id="fts-billing-heading">
						<?php echo esc_html( apply_filters( 'wpte_billings_details_title', __( 'Billing Details', 'wp-travel-engine' ) ) ); ?>
					</h3>
					<?php if ( $billing_desc ) : ?>
						<p class="fts-checkout-billing__desc"><?php echo esc_html( $billing_desc ); ?></p>
					<?php endif; ?>
				</div>
				<button
					type="button"
					class="fts-checkout-billing__back"
					onclick="if (window.history.length > 1) { window.history.back(); }"
					aria-label="<?php esc_attr_e( 'Go back', 'fts-checkout' ); ?>"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</div>
		</header>
	<?php endif; ?>
	<div class="wpte-checkout__box-content fts-checkout-billing__content">
		<?php
		if ( wptravelengine_settings()->get( 'display_travellers_info' ) === 'yes' && wptravelengine_settings()->get( 'traveller_emergency_details_form' ) === 'on_checkout' && $payment_type !== 'due'
			&& $lead_travellers_fields_count > 0 ) :
			?>
			<div class="wpte-copy-from-lead-travelers fts-checkout-billing__copy-lead">
				<input type="checkbox" id="wpte-copy-from-lead-travelers" name="wpte-copy-from-lead-travelers" value="1">
				<label for="wpte-copy-from-lead-travelers">
					<?php esc_html_e( 'Same as Lead Traveller', 'wp-travel-engine' ); ?>
				</label>
			</div>
		<?php endif; ?>
		<?php $billing_form_fields->render(); ?>

		<details class="fts-checkout-billing__optional" open>
			<summary class="fts-checkout-billing__optional-summary">
				<span class="fts-checkout-billing__optional-text"><?php esc_html_e( 'Optional details only when needed', 'fts-checkout' ); ?></span>
				<span class="fts-checkout-billing__optional-chevron" aria-hidden="true">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</span>
			</summary>
			<div class="fts-checkout-billing__optional-panel">
				<div class="fts-checkout-billing__optional-grid">
					<div class="fts-checkout-billing__optional-field">
						<label for="fts-billing-guide-language"><?php esc_html_e( 'Guide language', 'fts-checkout' ); ?></label>
						<input
							type="text"
							class="wpte-checkout__input"
							id="fts-billing-guide-language"
							name="billing[fts_guide_language]"
							value="<?php echo esc_attr( $fts_guide ); ?>"
							placeholder="<?php esc_attr_e( 'English', 'fts-checkout' ); ?>"
							autocomplete="off"
						/>
					</div>
					<div class="fts-checkout-billing__optional-field">
						<label for="fts-billing-hotel-name"><?php esc_html_e( 'Hotel name - if you can add it now', 'fts-checkout' ); ?></label>
						<input
							type="text"
							class="wpte-checkout__input"
							id="fts-billing-hotel-name"
							name="billing[fts_hotel_name]"
							value="<?php echo esc_attr( $fts_hotel ); ?>"
							placeholder="<?php esc_attr_e( 'Optional', 'fts-checkout' ); ?>"
							autocomplete="organization"
						/>
					</div>
				</div>
				<div class="fts-checkout-billing__optional-field fts-checkout-billing__optional-field--full">
					<label for="wptravelengine_additional_note"><?php esc_html_e( 'Additional Notes', 'fts-checkout' ); ?></label>
					<textarea
						class="wpte-checkout__input fts-checkout-billing__optional-textarea"
						name="wptravelengine_additional_note"
						id="wptravelengine_additional_note"
						rows="5"
						placeholder="<?php esc_attr_e( 'Add any specific requests or extra details here...', 'fts-checkout' ); ?>"
					><?php echo esc_textarea( $fts_additional_note ); ?></textarea>
				</div>
			</div>
		</details>
	</div>
</div>
