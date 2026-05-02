<?php
/**
 * Travel Monster functions and definitions
 *
 * @link https://developer.wordpress.org/themes/basics/theme-functions/
 *
 * @package Travel Monster
 */

$travel_monster_theme_data = wp_get_theme();
if( ! defined( 'TRAVEL_MONSTER_THEME_VERSION' ) ) define( 'TRAVEL_MONSTER_THEME_VERSION', $travel_monster_theme_data->get( 'Version' ) );
if( ! defined( 'TRAVEL_MONSTER_THEME_NAME' ) ) define( 'TRAVEL_MONSTER_THEME_NAME', $travel_monster_theme_data->get( 'Name' ) );
if( ! defined( 'TRAVEL_MONSTER_THEME_TEXTDOMAIN' ) ) define( 'TRAVEL_MONSTER_THEME_TEXTDOMAIN', $travel_monster_theme_data->get( 'TextDomain' ) );

/**
 * Custom Functions.
 */
require get_template_directory() . '/inc/custom-functions.php';

/**
 * Standalone Functions.
 */
require get_template_directory() . '/inc/extras.php';

/**
 * Functions which enhance the theme by hooking into WordPress.
 */
require get_template_directory() . '/inc/template-functions.php';

/**
 * Dynamic Styles
 */
require get_template_directory() . '/css/style.php';

/**
 * Custom functions for selective refresh.
 */
require get_template_directory() . '/inc/customizer/partial-refresh.php';

/**
 * Custom Controls
 */
require get_template_directory() . '/inc/custom-controls/custom-control.php';

/**
 * Customizer additions.
 */
require get_template_directory() . '/inc/customizer/customizer.php';

/**
 * Customizer defaults.
 */
require get_template_directory() . '/inc/defaults.php';

/**
 * Widgets
 */
require get_template_directory() . '/inc/widgets.php';

/**
 * Metabox
 */
require get_template_directory() . '/inc/metabox/metabox.php';
/**
 * Social Links
 */
require get_template_directory() . '/inc/social-links.php';

/**
 * Typography Functions
 */
require get_template_directory() . '/inc/typography/typography.php';

require get_template_directory() . '/inc/class-webfont-loader.php';
/**
 * Implement the Custom Header feature.
 */
require get_template_directory() . '/inc/custom-header.php';

/**
 * Plugin Recommendation
*/
require get_template_directory() . '/inc/tgmpa/recommended-plugins.php';

/**
 * Dashboard
*/
require get_template_directory() . '/inc/dashboard/dashboard.php';

/**
 * Load Jetpack compatibility file.
 */
if ( defined( 'JETPACK__VERSION' ) ) {
	require get_template_directory() . '/inc/jetpack.php';
}
/**
 * Add theme compatibility function for elementor if active
*/
if( travel_monster_is_elementor_activated() ){
	require get_template_directory() . '/inc/elementor-compatibility.php';   
}

/**
 * Add theme compatibility function for WP travel engine
*/
if( travel_monster_is_wpte_activated() ){
	require get_template_directory() . '/inc/wte/wte-compatibility.php';
}