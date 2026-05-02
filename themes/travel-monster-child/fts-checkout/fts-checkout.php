<?php
/**
 * FTS Custom Checkout — Main Controller
 *
 * @package FTS_Checkout
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class FTS_Checkout {

	private static $base_dir;
	private static $base_uri;

	public static function init() {
		self::$base_dir = get_stylesheet_directory() . '/fts-checkout';
		self::$base_uri = get_stylesheet_directory_uri() . '/fts-checkout';

		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_wte_checkout_assets' ), 12 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 20 );
		add_filter( 'body_class', array( __CLASS__, 'body_class' ) );
		add_filter( 'template_include', array( __CLASS__, 'override_checkout_template' ), 999 );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_remove_theme_footer' ), 99 );
		add_action( 'wp', array( __CLASS__, 'maybe_remove_theme_footer' ), 99 );
	}

	/**
	 * Remove theme (and HFE) footer output on checkout; keeps content wrappers + wp_footer().
	 */
	public static function maybe_remove_theme_footer() {
		if ( ! self::is_checkout_page() ) {
			return;
		}

		if ( function_exists( 'travel_monster_render_hfe_footer' ) ) {
			remove_action( 'travel_monster_footer', 'travel_monster_render_hfe_footer', 10 );
			remove_action( 'travel_monster_footer', 'travel_monster_render_hfe_footer' );
		}

		if ( function_exists( 'travel_monster_footer_start' ) ) {
			remove_action( 'travel_monster_footer', 'travel_monster_footer_start', 20 );
			remove_action( 'travel_monster_footer', 'travel_monster_footer_top', 30 );
			remove_action( 'travel_monster_footer', 'travel_monster_footer_bottom', 40 );
			remove_action( 'travel_monster_footer', 'travel_monster_footer_end', 50 );
		}
	}

	/**
	 * Mirror WTE CheckoutV2 asset loading so checkout works when the shortcode does not run.
	 */
	public static function enqueue_wte_checkout_assets() {
		if ( ! self::is_checkout_page() ) {
			return;
		}

		if ( ! class_exists( '\WPTravelEngine\Assets' ) ) {
			return;
		}

		// FTS template uses Checkout V2 hooks (CheckoutPageTemplate); load the same bundle as CheckoutV2.
		\WPTravelEngine\Assets::instance()
			->enqueue_script( 'trip-checkout' )
			->enqueue_style( 'trip-checkout' )
			->enqueue_script( 'parsley' )
			->enqueue_script( 'wptravelengine-validatejs' )
			->dequeue_script( 'wp-travel-engine' )
			->dequeue_style( 'wp-travel-engine' );
	}

	/**
	 * Enqueue FTS checkout CSS & JS.
	 */
	public static function enqueue_assets() {
		if ( ! self::is_checkout_page() ) {
			return;
		}

		$css_file = self::$base_dir . '/css/fts-checkout.css';
		wp_enqueue_style(
			'fts-checkout-fonts',
			'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap',
			array(),
			null
		);

		if ( file_exists( $css_file ) ) {
			wp_enqueue_style(
				'fts-checkout-styles',
				self::$base_uri . '/css/fts-checkout.css',
				array( 'fts-checkout-fonts' ),
				filemtime( $css_file )
			);
		}

		$js_file = self::$base_dir . '/js/fts-checkout.js';
		if ( file_exists( $js_file ) ) {
			wp_enqueue_script(
				'fts-checkout-scripts',
				self::$base_uri . '/js/fts-checkout.js',
				array( 'jquery' ),
				filemtime( $js_file ),
				true
			);
			wp_localize_script(
				'fts-checkout-scripts',
				'ftsCheckoutL10n',
				array(
					'payableNow' => __( 'PAYABLE NOW', 'fts-checkout' ),
					'billing'    => __( 'BILLING DETAILS', 'fts-checkout' ),
					'payment'    => __( 'PAYMENT', 'fts-checkout' ),
				)
			);
		}
	}

	/**
	 * Add body class for scoped CSS.
	 *
	 * @param string[] $classes Body classes.
	 * @return string[]
	 */
	public static function body_class( $classes ) {
		if ( self::is_checkout_page() ) {
			$classes[] = 'fts-checkout-page';
		}
		return $classes;
	}

	/**
	 * Apply ?discount= coupon to cart (same logic as WTE CheckoutV2::maybe_apply_discount).
	 *
	 * @param \WPTravelEngine\Core\Cart\Cart $wte_cart Cart.
	 */
	public static function maybe_apply_url_discount( $wte_cart ) {
		if ( ! isset( $_GET['discount'] ) || ! is_object( $wte_cart ) || ! method_exists( $wte_cart, 'has_discounts' ) || $wte_cart->has_discounts() ) {
			return;
		}

		if ( ! class_exists( '\WPTravelEngine\Core\Models\Post\Coupons' ) ) {
			return;
		}

		$code     = sanitize_text_field( wp_unslash( $_GET['discount'] ) );
		$trip_ids = $wte_cart->get_cart_trip_ids();
		if ( empty( $trip_ids ) ) {
			return;
		}

		$coupon = \WPTravelEngine\Core\Models\Post\Coupons::by_code( $code );
		if ( ! $coupon || $coupon->is_valid() ) {
			return;
		}

		$trip_id = is_array( $trip_ids ) ? array_shift( $trip_ids ) : 0;
		if ( ! $trip_id || $coupon->is_valid( $trip_id ) ) {
			return;
		}

		$limit = $coupon->get_coupon_limit_number();
		if ( (bool) $limit && ( (int) $limit <= $coupon->get_coupon_usage_count() ) ) {
			return;
		}

		$type  = $coupon->get_coupon_type();
		$value = $coupon->get_coupon_value();

		$wte_cart->add_discount_values( 'coupon', $code, $type, $value );
	}

	/**
	 * Replace the default page template with the FTS checkout template.
	 *
	 * @param string $template Default template path.
	 * @return string
	 */
	public static function override_checkout_template( $template ) {
		if ( ! self::is_checkout_page() ) {
			return $template;
		}

		$custom = self::$base_dir . '/templates/checkout-page.php';
		if ( file_exists( $custom ) ) {
			return $custom;
		}

		return $template;
	}

	/**
	 * Detect WTE checkout page.
	 */
	public static function is_checkout_page() {
		if ( is_admin() || wp_doing_ajax() ) {
			return false;
		}

		$checkout_page_id = 0;
		if ( function_exists( 'wptravelengine_get_checkout_page_id' ) ) {
			$checkout_page_id = wptravelengine_get_checkout_page_id();
		}
		if ( ! $checkout_page_id ) {
			$settings         = get_option( 'wp_travel_engine_settings', array() );
			$checkout_page_id = $settings['pages']['wp_travel_engine_place_order'] ?? 0;
		}

		if ( $checkout_page_id && is_page( (int) $checkout_page_id ) ) {
			return true;
		}

		return is_page( 'checkout' );
	}
}

FTS_Checkout::init();
