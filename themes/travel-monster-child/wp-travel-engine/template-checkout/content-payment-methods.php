<?php
/**
 * Payment methods — FTS card layout (radio names/values preserved; copy keyed by gateway id).
 *
 * @var array $payment_methods
 * @package FTS_Checkout
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $wte_cart;

// Avoid fatal errors if cart is not initialized (would surface as 502/500 on some hosts).
$fts_current_gateway = '';
if ( is_object( $wte_cart ) && isset( $wte_cart->payment_gateway ) ) {
	$fts_current_gateway = (string) $wte_cart->payment_gateway;
}

/**
 * Static copy and badge metadata for known gateways; falls back to WTE labels/descriptions.
 *
 * @param string $key Gateway id.
 * @return array{badge:string,badge_label:string,subtitle:string,body:string}|null
 */
if ( ! function_exists( 'fts_checkout_payment_method_meta' ) ) {
	function fts_checkout_payment_method_meta( $key ) {
		$map = array(
			'stripe_payment' => array(
				'badge'       => 'recommended',
				'badge_label' => __( 'Recommended', 'fts-checkout' ),
				'subtitle'    => __( 'Pay now with card', 'fts-checkout' ),
				'body'        => __( 'Fastest path to completion with a familiar and secure payment experience.', 'fts-checkout' ),
			),
			'booking_only' => array(
				'badge'       => 'friction',
				'badge_label' => __( 'Lower friction', 'fts-checkout' ),
				'subtitle'    => __( 'Reserve first, pay later', 'fts-checkout' ),
				'body'        => __( 'Useful for hesitant users, but it should be explained clearly to avoid confusion.', 'fts-checkout' ),
			),
		);

		if ( isset( $map[ $key ] ) ) {
			return $map[ $key ];
		}

		if ( strpos( (string) $key, 'stripe' ) !== false && isset( $map['stripe_payment'] ) ) {
			return $map['stripe_payment'];
		}

		return null;
	}
}

/**
 * Prefer icon URL/markup from registered gateway (get_args()['icon_url']).
 * WTE core Checkout::get_active_payment_methods() overwrites this with a default PNG path when
 * display_icon is empty — that file often does not exist for addons (e.g. Stripe), so icons 404.
 *
 * @param array $payment_method Method row from Checkout (may have wrong icon_url).
 * @param string $key Gateway id.
 * @return array
 */
function fts_checkout_resolve_payment_method_icon( array $payment_method, $key ) {
	if ( ! function_exists( 'wp_travel_engine_get_active_payment_gateways' ) ) {
		return $payment_method;
	}
	static $fts_gateway_args = null;
	if ( null === $fts_gateway_args ) {
		$fts_gateway_args = wp_travel_engine_get_active_payment_gateways( true );
	}
	if ( empty( $fts_gateway_args[ $key ]['icon_url'] ) || ! is_string( $fts_gateway_args[ $key ]['icon_url'] ) ) {
		return $payment_method;
	}
	$raw = trim( $fts_gateway_args[ $key ]['icon_url'] );
	if ( $raw === '' ) {
		return $payment_method;
	}
	$payment_method['icon_url'] = $raw;
	return $payment_method;
}

/**
 * Inline SVG icons (no raster) for known gateways — avoids double border visual weight from img boxes.
 *
 * @param string $key Gateway id.
 * @return string Safe SVG markup or empty string.
 */
function fts_checkout_payment_method_icon_svg( $key ) {
	$key = (string) $key;
	// Stripe "S" monogram (brand purple).
	if ( 'stripe_payment' === $key || strpos( $key, 'stripe' ) !== false ) {
		return '<svg class="fts-checkout-payment-method__icon-svg fts-checkout-payment-method__icon-svg--stripe" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" role="img" aria-hidden="true" focusable="false"><path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/></svg>';
	}
	// Book now / pay later — calendar + clock motif.
	if ( 'booking_only' === $key ) {
		return '<svg class="fts-checkout-payment-method__icon-svg fts-checkout-payment-method__icon-svg--booking" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="24" height="24" role="img" aria-hidden="true" focusable="false"><path stroke="#15803d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M8 2v4m8-4v4"/><path stroke="#15803d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 10h18"/><path stroke="#15803d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/><circle cx="12" cy="16" r="1" fill="#15803d"/></svg>';
	}
	return '';
}

/**
 * @param string $svg Raw SVG.
 * @return string
 */
function fts_checkout_kses_svg( $svg ) {
	$allowed = array(
		'svg'    => array(
			'class'       => true,
			'xmlns'       => true,
			'viewbox'     => true,
			'width'       => true,
			'height'      => true,
			'role'        => true,
			'aria-hidden' => true,
			'focusable'   => true,
			'fill'        => true,
			'stroke'      => true,
		),
		'path'   => array(
			'd'               => true,
			'fill'            => true,
			'stroke'          => true,
			'stroke-width'    => true,
			'stroke-linecap'  => true,
			'stroke-linejoin' => true,
		),
		'circle' => array(
			'cx'           => true,
			'cy'           => true,
			'r'            => true,
			'stroke'       => true,
			'stroke-width' => true,
		),
	);
	return wp_kses( $svg, $allowed );
}
?>
<div class="wpte-checkout__payment-methods">
	<?php foreach ( $payment_methods as $key => $payment_method ) : ?>
		<?php
		$payment_method = fts_checkout_resolve_payment_method_icon( $payment_method, $key );
		$meta        = fts_checkout_payment_method_meta( $key );
		$subtitle    = is_array( $meta ) ? ( $meta['subtitle'] ?? '' ) : '';
		$body        = '';
		$badge       = is_array( $meta ) ? ( $meta['badge'] ?? '' ) : '';
		$badge_label = is_array( $meta ) ? ( $meta['badge_label'] ?? '' ) : '';
		if ( is_array( $meta ) && ! empty( $meta['body'] ) ) {
			$body = $meta['body'];
		} elseif ( ! empty( $payment_method['description'] ) ) {
			$body = $payment_method['description'];
		}
		?>
		<?php
		$fts_method_class = 'fts-checkout-payment-method';
		if ( 'booking_only' === $key ) {
			$fts_method_class .= ' fts-checkout-payment-method--booking';
		}
		?>
		<div class="wpte-checkout__payment-method <?php echo esc_attr( $fts_method_class ); ?>">
			<div class="fts-checkout-payment-method__row">
				<?php
				$fts_pm_svg = fts_checkout_payment_method_icon_svg( $key );
				if ( $fts_pm_svg ) :
					?>
					<div class="fts-checkout-payment-method__media wpte-checkout__payment-method-logo fts-checkout-payment-method__media--svg">
						<?php echo fts_checkout_kses_svg( $fts_pm_svg ); ?>
					</div>
				<?php elseif ( isset( $payment_method['icon_url'] ) ) : ?>
					<div class="fts-checkout-payment-method__media wpte-checkout__payment-method-logo">
						<?php
						wptravelengine_display_icon(
							$payment_method['icon_url'],
							$payment_method['label'] ?? 'Payment Method',
							true
						);
						?>
					</div>
				<?php else : ?>
					<div class="fts-checkout-payment-method__media fts-checkout-payment-method__media--empty" aria-hidden="true"></div>
				<?php endif; ?>

				<div class="fts-checkout-payment-method__body">
					<div class="fts-checkout-payment-method__title-row">
						<span class="fts-checkout-payment-method__label"><?php echo esc_html( $payment_method['label'] ?? '' ); ?></span>
						<?php if ( $badge && $badge_label ) : ?>
							<span class="fts-payment-badge <?php echo esc_attr( 'fts-payment-badge--' . $badge ); ?>"><?php echo esc_html( $badge_label ); ?></span>
						<?php endif; ?>
					</div>
					<?php if ( $subtitle ) : ?>
						<p class="fts-checkout-payment-method__subtitle"><?php echo esc_html( $subtitle ); ?></p>
					<?php endif; ?>
					<?php if ( $body ) : ?>
						<div class="fts-checkout-payment-method__desc wpte-checkout__payment-method-info">
							<?php echo wp_kses_post( $body ); ?>
						</div>
					<?php endif; ?>
				</div>

				<div class="fts-checkout-payment-method__control">
					<div class="wpte-checkout__form-control <?php echo esc_attr( $fts_current_gateway === (string) $key ? 'checked' : '' ); ?>">
						<input
							type="radio"
							name="wpte_checkout_paymnet_method"
							value="<?php echo esc_attr( $key ); ?>"
							id="<?php echo esc_attr( $key ); ?>"
							<?php checked( $fts_current_gateway === (string) $key, true ); ?>
						>
						<label class="fts-sr-only" for="<?php echo esc_attr( $key ); ?>">
							<?php echo esc_html( $payment_method['label'] ?? __( 'Select payment method', 'fts-checkout' ) ); ?>
						</label>
					</div>
				</div>
			</div>
			<?php do_action( "wptravelengine_{$key}_payment_cc" ); ?>
		</div>
	<?php endforeach; ?>
</div>
