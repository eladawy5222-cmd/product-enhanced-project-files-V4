<?php
/**
 * Travel Monster Typography Related Functions
 *
 * @package Travel Monster
*/

/**
 * Google Fonts
 */
require get_template_directory() . '/inc/typography/google-fonts.php';


if ( ! function_exists( 'travel_monster_typography_default_fonts' ) ) :
/**
 * Set the default system fonts.
 */
function travel_monster_typography_default_fonts() {
	$fonts = array(
		'Default Family',
		'System Stack',
		'Arial, Helvetica, sans-serif',
		'Century Gothic',
		'Comic Sans MS',
		'Courier New',
		'Georgia, Times New Roman, Times, serif',
		'Helvetica',
		'Impact',
		'Lucida Console',
		'Lucida Sans Unicode',
		'Palatino Linotype',
		'Segoe UI, Helvetica Neue, Helvetica, sans-serif',
		'Tahoma, Geneva, sans-serif',
		'Trebuchet MS, Helvetica, sans-serif',
		'Verdana, Geneva, sans-serif',
	);

	return apply_filters( 'travel_monster_typography_default_fonts', $fonts );
}
endif;

if( ! function_exists( 'travel_monster_get_font_family' ) ) :
/**
 * Get font family 
 */
function travel_monster_get_font_family( $font ){
	$output = '';
	$no_quotes = array(
		'inherit',
		'Arial, Helvetica, sans-serif',
		'Georgia, Times New Roman, Times, serif',
		'Helvetica',
		'Impact',
		'Segoe UI, Helvetica Neue, Helvetica, sans-serif',
		'Tahoma, Geneva, sans-serif',
		'Trebuchet MS, Helvetica, sans-serif',
		'Verdana, Geneva, sans-serif',		
	);

	if( $font['family'] === 'System Stack' ){
		$output = apply_filters( 'travel_monster_typography_system_stack', '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"' );
	}else{
		if( in_array( $font['family'], $no_quotes ) || ( $font['family'] ==='System Stack' ) ){
			$wrapper_start = null;
			$wrapper_end = null;
		}else{
			$wrapper_start = '"';
			$wrapper_end = ( $font['category'] ) ? '", ' . $font['category'] : '"';
		}
		$output = $wrapper_start . $font['family'] . $wrapper_end;
	}

	return $output;
}
endif;

if ( ! function_exists( 'travel_monster_typography_custom_fonts' ) ) :
/**
 * Creating a filter to add custom fonts for external plugins
 */
function travel_monster_typography_custom_fonts() {
	$fonts = array(
	);

	return apply_filters( 'travel_monster_typography_get_custom_fonts', $fonts );
}
endif;


if ( ! function_exists( 'travel_monster_google_fonts_url' ) ) :	
/**
 * Google Fonts url
 */
function travel_monster_google_fonts_url() {
	$defaults  			= travel_monster_get_typography_defaults();
	$generalDefaults    = travel_monster_get_general_defaults();

	$fonts_url = '';
	$settings  = array();

	$settings['primary_font']  = wp_parse_args( get_theme_mod( 'primary_font' ), $defaults['primary_font'] );
	$settings['site_title']    = wp_parse_args( get_theme_mod( 'site_title' ), $defaults['site_title'] );
	$settings['button']        = wp_parse_args( get_theme_mod( 'button' ), $defaults['button'] );
	$settings['heading_one']   = wp_parse_args( get_theme_mod( 'heading_one' ), $defaults['heading_one'] );
	$settings['heading_two']   = wp_parse_args( get_theme_mod( 'heading_two' ), $defaults['heading_two'] );
	$settings['heading_three'] = wp_parse_args( get_theme_mod( 'heading_three' ), $defaults['heading_three'] );
	$settings['heading_four']  = wp_parse_args( get_theme_mod( 'heading_four' ), $defaults['heading_four'] );
	$settings['heading_five']  = wp_parse_args( get_theme_mod( 'heading_five' ), $defaults['heading_five'] );
	$settings['heading_six']   = wp_parse_args( get_theme_mod( 'heading_six' ), $defaults['heading_six'] );

	$not_google = str_replace( ' ', '+', travel_monster_typography_default_fonts() );
	$custom_fonts = (!empty( travel_monster_typography_custom_fonts())) ? str_replace( ' ', '+', travel_monster_typography_custom_fonts() ) : [];

	$font_settings = array(
		'primary_font',
		'site_title',
		'button',
		'heading_one',
		'heading_two',
		'heading_three',
		'heading_four',
		'heading_five',
		'heading_six',
	);

	$google_fonts = array();		

	foreach( $font_settings as $key ){

		$value = str_replace( ' ', '+', $settings[ $key ]['family'] );

		$variants = $settings[ $key ]['variants'];

		$value = ! empty( $variants ) ? $value . ':' . $variants : $value;
		
		// Make sure we don't add the same font twice.
		if ( ! in_array( $value, $google_fonts ) ) {
			$google_fonts[] = $value;
		}
	}
	// Ignore any non-Google fonts.
	$google_fonts = array_diff( $google_fonts, $not_google );
	
	$google_fonts = implode( '|', $google_fonts );
	$google_fonts = apply_filters( 'travel_monster_typography_google_fonts', $google_fonts );

	$subset = apply_filters( 'travel_monster_fonts_subset', '' );

	$font_args = array();
	$font_args['family'] = $google_fonts;
	
	if ( '' !== $subset ) {
		$font_args['subset'] = rawurlencode( $subset );
	}
	
	$display = apply_filters( 'travel_monster_google_font_display', 'swap' );

	if ( $display ) {
		$font_args['display'] = $display;
	}
			
	if ( $google_fonts ) {
		$fonts_url = add_query_arg( $font_args, '//fonts.googleapis.com/css' );			
	}

	if( get_theme_mod( 'ed_localgoogle_fonts', $generalDefaults['ed_localgoogle_fonts'] ) ) {
        $fonts_url = travel_monster_get_webfont_url( add_query_arg( $font_args, 'https://fonts.googleapis.com/css' ) );
    }

	return esc_url( $fonts_url );
}
endif;

if ( ! function_exists( 'travel_monster_get_all_google_fonts_ajax' ) ) :
/**
 * Return an array of all of our Google Fonts.
 */
function travel_monster_get_all_google_fonts_ajax() {
	
	// Do another nonce check
	check_ajax_referer( 'travel_monster_customize_nonce', 'travel_monster_customize_nonce' );

	// Bail if user can't edit theme options
	if ( ! current_user_can( 'edit_theme_options' ) ) {
		wp_send_json_error( 'Insufficient permissions' );
	}

	// Get all of our fonts
	$fonts = travel_monster_get_all_google_fonts();

	// Send all of our fonts in JSON format
	echo wp_json_encode( $fonts );

	// Exit
	wp_die();
}
endif;
add_action( 'wp_ajax_travel_monster_get_all_google_fonts_ajax', 'travel_monster_get_all_google_fonts_ajax' );

if( ! function_exists( 'travel_monster_flush_local_google_fonts' ) ){
	/**
	 * Ajax Callback for flushing the local font
	 */
  	function travel_monster_flush_local_google_fonts() {
		// Verify nonce to prevent CSRF attacks
		check_ajax_referer( 'travel-monster-local-fonts-flush', 'nonce' );

		// Verify user has permission to modify theme options
		if ( ! current_user_can( 'edit_theme_options' ) ) {
			wp_send_json_error( 'Insufficient permissions' );
		}

		$WebFontLoader = new Travel_Monster_WebFont_Loader();
		//deleting the fonts folder using ajax
		$WebFontLoader->delete_fonts_folder();
		wp_die();
  	}
}
add_action( 'wp_ajax_flush_local_google_fonts', 'travel_monster_flush_local_google_fonts' );