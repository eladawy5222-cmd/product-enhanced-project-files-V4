<?php
/**
 * FTS Custom Checkout — full page template (WP Travel Engine).
 *
 * Loaded via template_include. Preserves WTE booking form, gateways, coupons, and partial payment.
 *
 * @package FTS_Checkout
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $wte_cart, $post;

// ── Login requirement (same logic as WTE CheckoutV2) ─────────────────────────
$wptravelengine_settings     = get_option( 'wp_travel_engine_settings', array() );
$generate_user_account       = $wptravelengine_settings['generate_user_account'] ?? 'yes';
$require_login_to_checkout   = $wptravelengine_settings['enable_checkout_customer_registration'] ?? 'no';

if ( 'no' === $generate_user_account && 'yes' === $require_login_to_checkout && ! is_user_logged_in() ) {
	if ( class_exists( '\WPTravelEngine\Assets' ) ) {
		\WPTravelEngine\Assets::instance()
			->enqueue_style( 'my-account' )
			->enqueue_script( 'my-account' );
	}
	get_header();
	if ( function_exists( 'wte_get_template' ) ) {
		wte_get_template( 'account/form-login.php' );
	}
	get_footer();
	return;
}

// ── URL discount (same behaviour as WTE CheckoutV2) ─────────────────────────
if ( class_exists( 'FTS_Checkout' ) ) {
	FTS_Checkout::maybe_apply_url_discount( $wte_cart );
}

// ── Empty cart ─────────────────────────────────────────────────────────────
if ( empty( $wte_cart ) || empty( $wte_cart->getItems() ) ) {
	get_header();
	?>
	<div class="fts-checkout fts-checkout--empty">
		<div class="fts-checkout__inner">
			<p class="fts-checkout__empty-msg">
				<?php esc_html_e( 'Sorry, you may not have selected the number of travellers for this trip. Please select number of travellers and confirm your booking. Thank you.', 'wp-travel-engine' ); ?>
			</p>
		</div>
	</div>
	<?php
	get_footer();
	return;
}

// ── Invalid booking ref / paid in full (CheckoutV2) ────────────────────────
$booking_ref = $wte_cart->get_booking_ref();
if ( $booking_ref && function_exists( 'wptravelengine_get_booking' ) ) {
	$booking = wptravelengine_get_booking( $booking_ref );
	if ( ! $booking ) {
		get_header();
		echo '<p class="fts-checkout__error">' . esc_html__( 'This booking reference is invalid.', 'wp-travel-engine' ) . '</p>';
		get_footer();
		return;
	}
	$due_amount = $booking->get_total_due_amount();
	if ( round( (float) $due_amount, 2 ) <= 0 ) {
		get_header();
		echo '<p class="fts-checkout__notice">' . esc_html__( 'Thank you! Your payment has been received in full. No further action is required.', 'wp-travel-engine' ) . '</p>';
		get_footer();
		return;
	}
}

// ── Merge WTE template args (billing, tour, cart lines, payment, etc.) ─────
if ( ! function_exists( 'wptravelengine_get_checkout_template_args' ) ) {
	get_header();
	echo '<p>' . esc_html__( 'WP Travel Engine is required for checkout.', 'fts-checkout' ) . '</p>';
	get_footer();
	return;
}

$checkout_args = wptravelengine_get_checkout_template_args(
	array(
		'deposit_amount' => $wte_cart->get_totals()['partial_total'] ?? 0,
		'due_amount'     => $wte_cart->get_totals()['due_total'] ?? 0,
		'show_title'     => true,
	)
);
// Additional Notes are rendered inside FTS billing (collapsible); hide WTE default block.
$checkout_args['attributes'] = array_merge(
	$checkout_args['attributes'] ?? array(),
	array( 'additional_note' => 'hide' )
);
wptravelengine_set_template_args( $checkout_args );

// Used by some partials via $args['attributes']
$attributes = $checkout_args['attributes'] ?? array();

// content-checkout-note.php expects $args['attributes'] (nested).
wptravelengine_set_template_args(
	array(
		'args' => array(
			'attributes' => $attributes,
		),
	)
);

$fts_sidebar_tour_on = 'show' === ( $attributes['tour-details'] ?? 'show' );
$fts_sidebar_cart_on = 'show' === ( $attributes['cart-summary'] ?? 'show' );

get_header();
?>

<div class="fts-checkout" id="fts-checkout-page">
	<?php
	if ( 'show' === ( $attributes['checkout-steps'] ?? 'show' ) ) {
		$fts_hero_steps = get_stylesheet_directory() . '/fts-checkout/templates/parts/checkout-hero-steps.php';
		if ( file_exists( $fts_hero_steps ) ) {
			include $fts_hero_steps;
		}
	} else {
		?>
		<div class="fts-checkout__top fts-checkout__top--steps-hidden">
			<div class="fts-checkout__top-inner">
				<div class="fts-checkout__card fts-checkout__card--hero">
					<p class="fts-checkout__card-kicker"><?php esc_html_e( 'CLOSER TO THE LIVE SITE', 'fts-checkout' ); ?></p>
					<h1 class="fts-checkout__card-title"><?php esc_html_e( 'Checkout', 'fts-checkout' ); ?></h1>
				</div>
			</div>
		</div>
		<?php
	}
	?>

	<div class="fts-checkout__inner">

		<div class="fts-checkout__grid">
			<div class="fts-checkout__main">
				<?php
				/**
				 * Entire checkout form (billing, travellers, payment, terms, submit).
				 * Hook registered by WTE CheckoutPageTemplate::print_checkout_form.
				 */
				do_action( 'checkout_template_parts_checkout-form' );
				?>
			</div>

			<aside class="fts-checkout__sidebar" aria-label="<?php esc_attr_e( 'Tour details and booking summary', 'fts-checkout' ); ?>">
				<div class="fts-checkout-tour-details">
					<header class="fts-checkout-tour-details__header">
						<p class="fts-checkout-tour-details__kicker"><?php esc_html_e( 'TOUR DETAILS', 'fts-checkout' ); ?></p>
						<h2 class="fts-checkout-tour-details__title"><?php esc_html_e( 'Tour Details', 'fts-checkout' ); ?></h2>
					</header>
					<div class="fts-checkout-tour-details__stack">
						<div class="fts-checkout-tour-details__panel fts-checkout-tour-details__panel--timer">
							<div class="fts-checkout-timer" data-fts-checkout-timer="420" role="timer" aria-live="polite">
								<span class="fts-checkout-timer__icon" aria-hidden="true">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>
								</span>
								<p class="fts-checkout-timer__label"><?php esc_html_e( "We'll hold your spot for", 'fts-checkout' ); ?></p>
								<strong class="fts-checkout-timer__value" data-fts-timer-display>07:00</strong>
								<span class="fts-checkout-timer__unit"><?php esc_html_e( 'min', 'fts-checkout' ); ?></span>
							</div>
						</div>

						<?php if ( $fts_sidebar_tour_on ) : ?>
							<div class="fts-checkout-tour-details__panel fts-checkout-tour-details__panel--tour">
								<?php
								do_action(
									'checkout_template_parts_tour-details',
									array(
										'content_only' => true,
										'show_title'   => false,
									)
								);
								?>
							</div>
						<?php endif; ?>

						<?php if ( $fts_sidebar_cart_on ) : ?>
							<div class="fts-checkout__cart-summary" data-cart-summary>
								<?php do_action( 'checkout_template_parts_cart-summary' ); ?>
							</div>
						<?php endif; ?>
					</div>
				</div>
			</aside>
		</div>
	</div>
</div>

<?php
if ( function_exists( 'wptravelengine_get_template' ) ) {
	wptravelengine_get_template( 'template-checkout/content-sprite-svg.php' );
}

get_footer();
