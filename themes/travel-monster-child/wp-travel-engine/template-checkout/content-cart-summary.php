<?php
/**
 * Content cart summary — FTS sidebar: coupon panel + pricing panel (child theme override).
 *
 * @var array $cart_line_items
 * @var float $deposit_amount
 * @var float $due_amount
 * @var bool $is_partial_payment
 * @var bool $show_title
 * @var bool $show_coupon_form
 * @var Checkout $checkout
 * @var \WPTravelEngine\Core\Cart\Cart $cart
 * @package FTS_Checkout
 */

use WPTravelEngine\Pages\Checkout;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

global $wte_cart;

$cart     = $_wte_cart ?? $wte_cart;
$checkout = new Checkout( $cart );
if ( ! isset( $coupons ) ) {
	$coupons = array();
}
?>
<?php if ( $show_coupon_form || ! empty( $coupons ) ) : ?>
<div class="fts-checkout-tour-details__panel fts-checkout-tour-details__panel--coupon">
	<?php wptravelengine_get_template( 'template-checkout/content-coupon-form.php' ); ?>
</div>
<?php endif; ?>
<div class="fts-checkout-tour-details__panel fts-checkout-tour-details__panel--pricing">
	<div class="wpte-checkout__booking-summary">
		<?php if ( $show_title ) : ?>
			<h5 class="wpte-checkout__booking-summary-title"><?php esc_html_e( 'Package', 'wp-travel-engine' ); ?></h5>
		<?php endif; ?>
		<div class="wpte-checkout__table-wrap">
			<table class="wpte-checkout__booking-summary-table">
				<?php
				do_action( 'wptravelengine_cart_before_line_items', $cart_line_items );
				foreach ( $cart_line_items as $key => $lines ) {
					do_action( "wptravelengine_cart_before_{$key}_line_items", $cart_line_items );
					if ( 'line_items' === $key ) {
						foreach ( $lines as $line ) {
							foreach ( $line as $_key => $row ) {
								do_action( "wptravelengine_cart_before_{$_key}_line_items", $cart_line_items );
								echo wp_kses(
									is_array( $row ) ? implode( '', $row ) : $row,
									array_merge(
										wp_kses_allowed_html( 'post' ),
										array( 'svg' => array() ),
										array( 'use' => array( 'xlink:href' => array() ) )
									)
								);
								do_action( "wptravelengine_cart_after_{$_key}_line_items", $cart_line_items );
							}
						}
						continue;
					}
					echo wp_kses(
						is_array( $lines ) ? implode( '', $lines ) : $lines,
						array_merge(
							wp_kses_allowed_html( 'post' ),
							array( 'svg' => array() ),
							array( 'use' => array( 'xlink:href' => array() ) )
						)
					);
					do_action( "wptravelengine_cart_after_{$key}_line_items", $cart_line_items );
				}
				do_action( 'wptravelengine_cart_after_line_items', $cart_line_items );

				if ( $wte_cart->is_curr_cart() ) :
					$rows_after_line_items = $checkout->get_fragments_after_line_items();
					foreach ( $rows_after_line_items as $row ) {
						echo wp_kses(
							is_array( $row ) ? implode( '', $row ) : $row,
							array_merge(
								wp_kses_allowed_html( 'post' ),
								array( 'svg' => array() ),
								array( 'use' => array( 'xlink:href' => array() ) )
							)
						);
					}
				elseif ( $is_partial_payment ) :
					if ( 'due' === $wte_cart->get_payment_type() ) :
						?>
						<tr class="wpte-checkout__booking-summary-deposit">
							<td><strong><?php echo esc_html__( 'Deposited:', 'wp-travel-engine' ); ?></strong></td>
							<td><strong>- <?php wptravelengine_the_price( $deposit_amount ); ?></strong></td>
						</tr>
					<?php else : ?>
						<tr class="wpte-checkout__booking-summary-deposit">
							<td><strong><?php echo esc_html__( 'Deposit Today:', 'wp-travel-engine' ); ?></strong></td>
							<td><strong>- <?php wptravelengine_the_price( $deposit_amount ); ?></strong></td>
						</tr>
					<?php endif; ?>
					<tr>
						<td><strong><?php echo esc_html__( 'Amount Due:', 'wp-travel-engine' ); ?></strong></td>
						<td><strong><?php wptravelengine_the_price( $due_amount ); ?></strong></td>
					</tr>
					<?php
				endif;
				do_action( 'wptravelengine_at_cart_summary_end' );
				?>
			</table>
		</div>
	</div>
</div>
