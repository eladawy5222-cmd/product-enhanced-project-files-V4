<?php
/**
 * @var \WPTravelEngine\Core\Models\Post\Trip $trip_instance
 */

$actual_price = $trip_instance->has_sale() ? $trip_instance->get_sale_price() : $trip_instance->get_price();
$saved_price  = $trip_instance->has_sale() ? $trip_instance->get_price() - $trip_instance->get_sale_price() : 0;

// Force rounding to 2 decimals to fix Load More issue
$actual_price = round( (float) $actual_price, 2 );
$saved_price = round( (float) $saved_price, 2 );
$regular_price = round( (float) $trip_instance->get_price(), 2 );

?>
<span class="price-holder">
	<?php if ( $trip_instance->has_sale() ) : ?>
		<span class="regular-price">
			<?php esc_html_e( 'From ', 'wp-travel-engine' ); ?>
			<span class="striked-price"><?php \wte_the_formated_price( $regular_price ); ?></span>
		</span>
	<?php endif; ?>
	<span class="actual-price"><?php \wte_the_formated_price( $actual_price ); ?></span>
	<?php if ( $saved_price > 0 ) { ?>
		<span class="saved-price">
			<?php esc_html_e( 'You save ', 'wp-travel-engine' ); ?>
			<?php \wte_the_formated_price( $saved_price ); ?>
		</span>
	<?php } ?>
</span>
