<?php
/**
 * Google Fonts
 *  
 * Return an array of all Google Fonts.
*/

function travel_monster_get_all_google_fonts(){
  
  	$google_fonts = apply_filters( 'travel_monster_google_lists', get_template_directory() . '/inc/typography/google-fonts-lists.php' );

  	$google_fonts_list = include $google_fonts;

  	// Loop through them and put what we need into our fonts array
  	$fonts = array();

  	foreach ( $google_fonts_list as $item ) {

		// Grab what we need from our big list
		$atts = array(
			'name'     => $item['family'],
			'category' => $item['category'],
			'variants' => $item['variants'],
		);

		// Create an ID using our font family name
		$id = strtolower( str_replace( ' ', '_', $item['family'] ) );

		// Add our attributes to our new array
		$fonts[ $id ] = $atts;    
  	}

	// Alphabetize our fonts
	if ( apply_filters( 'travel_monster_alphabetize_google_fonts', true ) ) {
		asort( $fonts );
	}

	// Filter to allow us to modify the fonts array
	return apply_filters( 'travel_monster_google_fonts_array', $fonts );
}