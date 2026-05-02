<?php
/**
 * Travel Monster Theme Customizer
 *
 * @package Travel Monster
 */

/**
 * Requiring customizer panels & sections
*/

$travel_monster_sections     = array( 'header', 'site','title','blog','archive','page','post', 'typography', 'seo', 'social-network', 'colors' );
$travel_monster_panels       = array( 'general', 'footer' );
$travel_monster_sub_sections = array(
    'general'     => array( 'container', 'sidebar', 'button', 'scroll-to-top', 'pagination', '404', ),
	'footer'     => array( 'upper-footer', 'bottom-footer' )
);

foreach( $travel_monster_panels as $panel ){
   require get_template_directory() . '/inc/customizer/panels/' . $panel . '.php';
}

foreach( $travel_monster_sub_sections as $key => $sections ){
    foreach( $sections as $section ){        
        require get_template_directory() . '/inc/customizer/panels/' . $key . '/' . $section . '.php';
    }
}

foreach( $travel_monster_sections as $section ){
    require get_template_directory() . '/inc/customizer/sections/' . $section . '.php';
}

/**
 * Sanitization Functions
*/
require get_template_directory() . '/inc/customizer/sanitization-functions.php';

/**
 * Active Callbacks
*/
require get_template_directory() . '/inc/customizer/active-callback.php';

/**
 * Binds JS handlers to make Theme Customizer preview reload changes asynchronously.
 */
function travel_monster_customize_preview_js() {
	$build        = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '/build' : '';
	$suffix       = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
	wp_enqueue_script( 'travel-monster-customizer', get_template_directory_uri() . '/js' . $build . '/customizer' . $suffix . '.js', array( 'customize-preview' ), TRAVEL_MONSTER_THEME_VERSION, true );

	wp_localize_script(
		'travel-monster-customizer',
		'travel_monster_view_port',
		array(
			'mobile'               => travel_monster_get_media_query( 'mobile' ),
			'tablet'               => travel_monster_get_media_query( 'tablet' ),
			'desktop'              => travel_monster_get_media_query( 'desktop' ),
			'googlefonts'          => apply_filters( 'travel_monster_typography_customize_list', travel_monster_get_all_google_fonts() ),
			'systemfonts'          => apply_filters( 'travel_monster_typography_system_stack', '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"' ),
			'breadcrumb_sep_one'   => travel_monster_breadcrumb_icons_list('one'),
			'breadcrumb_sep_two'   => travel_monster_breadcrumb_icons_list('two'),
			'breadcrumb_sep_three' => travel_monster_breadcrumb_icons_list('three'),
		)
	);

}
add_action( 'customize_preview_init', 'travel_monster_customize_preview_js' );

/**
 * Get the requested media query.
 *
 * @param string $name Name of the media query.
 */
function travel_monster_get_media_query( $name ) {

	// If the theme function doesn't exist, build our own queries.
	$desktop     = apply_filters( 'travel_monster_desktop_media_query', '(min-width:1024px)' );
	$tablet      = apply_filters( 'travel_monster_tablet_media_query', '(min-width: 720px) and (max-width: 1024px)' );
	$mobile      = apply_filters( 'travel_monster_mobile_media_query', '(max-width:719px)' );

	$queries = apply_filters(
		'travel_monster_media_queries',
		array(
			'desktop'     => $desktop,
			'tablet'      => $tablet,
			'mobile'      => $mobile,
		)
	);

	return $queries[ $name ];
}

/**
 * Add misc inline scripts to our controls.
 *
 * We don't want to add these to the controls themselves, as they will be repeated
 * each time the control is initialized.
 */
function travel_monster_control_inline_scripts() {

	wp_enqueue_style('travel-monster-customize', get_template_directory_uri() . '/inc/css/customize.css', array(), TRAVEL_MONSTER_THEME_VERSION );
	wp_enqueue_script('travel-monster-customize', get_template_directory_uri() . '/inc/js/customize.js', array('jquery', 'customize-controls'), TRAVEL_MONSTER_THEME_VERSION, true);
	
	wp_localize_script( 'travel-monster-customize', 'travel_monster_data',
		array(
			'primary'  => has_nav_menu( 'primary' ),
			'nonce'    => wp_create_nonce( 'travel-monster-local-fonts-flush' ),
			'ajax_url' => admin_url( 'admin-ajax.php' ),
			'flushit'  => __( 'Successfully Flushed!','travel-monster' ),
		)
	);

	wp_localize_script( 'travel-monster-typography-customizer', 'travel_monster_customize',
		array(
			'nonce' => wp_create_nonce( 'travel_monster_customize_nonce' ),
			'proActivated' => travel_monster_pro_is_activated(),
			'addons' => get_option( 'tmp_active_extensions', array() ),
		)
	);

	wp_localize_script(
		'travel-monster-typography-customizer',
		'travelMonsterTypography',
		array(
			'googleFonts' => apply_filters( 'travel_monster_typography_customize_list', travel_monster_get_all_google_fonts() )
		)
	);

	wp_localize_script( 'travel-monster-typography-customizer', 'typography_defaults', travel_monster_typography_default_fonts() );
}
add_action( 'customize_controls_enqueue_scripts', 'travel_monster_control_inline_scripts', 100 );

/*
 * Notifications in customizer
 */
require get_template_directory() . '/inc/customizer-plugin-recommend/customizer-notice/class-customizer-notice.php';

require get_template_directory() . '/inc/customizer-plugin-recommend/plugin-install/class-plugin-install-helper.php';

require get_template_directory() . '/inc/customizer-plugin-recommend/plugin-install/class-plugin-recommend.php';

if( ! function_exists( 'travel_monster_customizer_notice_init' ) ) {
	function travel_monster_customizer_notice_init() {
		$config_customizer = array(
			'recommended_plugins' => array(
				//change the slug for respective plugin recomendation
				'wp-travel-engine' => array(
					'recommended' => true,
					'description' => sprintf(
						/* translators: %s: plugin name */
						esc_html__( 'If you want to take full advantage of the features this theme has to offer, please install and activate %s plugin.', 'travel-monster' ), '<strong>WP Travel Engine</strong>'
					),
				),
			),
			'recommended_plugins_title' => esc_html__( 'Recommended Plugin', 'travel-monster' ),
			'install_button_label'      => esc_html__( 'Install and Activate', 'travel-monster' ),
			'activate_button_label'     => esc_html__( 'Activate', 'travel-monster' ),
			'deactivate_button_label'   => esc_html__( 'Deactivate', 'travel-monster' ),
		);
		Travel_Monster_Customizer_Notice::init( apply_filters( 'travel_monster_customizer_notice_array', $config_customizer ) );
	}
}
add_action('init', 'travel_monster_customizer_notice_init');

/**
 * Functions that removes default section in wp
 *
 * @param [type] $wp_customize
 * @return void
 */
function travel_monster_removing_default_sections( $wp_customize ){
	$wp_customize->remove_section('header_image');
	$wp_customize->remove_section('background_image');
}
add_action( 'customize_register','travel_monster_removing_default_sections' );