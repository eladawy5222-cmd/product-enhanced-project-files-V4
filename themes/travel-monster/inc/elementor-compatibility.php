<?php
/**
 * Helper functions for elementor widgets
 * 
 * @package Travel Monster
 */

if( ! function_exists( 'travel_monster_add_theme_colors' ) ) :
    /**
     * Travel Monster Theme Colors
     *
     * @param [type] $response
     * @param [type] $handler
     * @param [type] $request
     * @return void
     */
    function travel_monster_add_theme_colors( $response, $handler, $request ){
        $route = $request->get_route();
    
        if ( '/elementor/v1/globals' != $route ) {
            return $response;
        }
    
        $data = $response->get_data();

        $defaults = travel_monster_get_color_defaults();
        
        $data['colors']['primary_color'] = array(
            'id'    => 'primary_color',
            'title' => __( 'Primary Theme Color', 'travel-monster' ),
            'value' => get_theme_mod( 'primary_color',$defaults['primary_color'] ),
        );
    
        $data['colors']['secondary_color'] = array(
            'id'    => 'secondary_color',
            'title' => __( 'Secondary Theme Color', 'travel-monster' ),
            'value' => get_theme_mod( 'secondary_color',$defaults['secondary_color'] ),
        );
    
        $data['colors']['body_font_color'] = array(
            'id'    => 'body_font_color',
            'title' => __( 'Body Font Color', 'travel-monster' ),
            'value' => get_theme_mod( 'body_font_color',$defaults['body_font_color'] ),
        );
    
        $data['colors']['heading_color'] = array(
            'id'    => 'heading_color',
            'title' => __( 'Heading Color', 'travel-monster' ),
            'value' => get_theme_mod( 'heading_color',$defaults['heading_color'] ),
        );

        $data['colors']['section_bg_color'] = array(
            'id'    => 'section_bg_color',
            'title' => __( 'Section Background Color', 'travel-monster' ),
            'value' => get_theme_mod( 'section_bg_color',$defaults['section_bg_color'] ),
        );

        $data['colors']['site_bg_color'] = array(
            'id'    => 'site_bg_color',
            'title' => __( 'Site Background Color', 'travel-monster' ),
            'value' => get_theme_mod( 'site_bg_color',$defaults['site_bg_color'] ),
        );

        $data['colors']['accent_color_one'] = array(
            'id'    => 'accent_color_one',
            'title' => __( 'Accent Color One', 'travel-monster' ),
            'value' => get_theme_mod( 'accent_color_one',$defaults['accent_color_one'] ),
        );

        $data['colors']['accent_color_two'] = array(
            'id'    => 'accent_color_two',
            'title' => __( 'Accent Color Two', 'travel-monster' ),
            'value' => get_theme_mod( 'accent_color_two',$defaults['accent_color_two'] ),
        );
    
        $response->set_data( $data );
    
        return $response;
    }
endif;
add_action( 'rest_request_after_callbacks', 'travel_monster_add_theme_colors', 999, 3 );
    
if( ! function_exists( 'travel_monster_display_global_colors_elementor' ) ) :
    /**
     * Displays frontend Elementor colors function
     *
     * @param [type] $response
     * @param [type] $handler
     * @param [type] $request
     * @return void
     */
    function travel_monster_display_global_colors_elementor( $response, $handler, $request ) {
        $route = $request->get_route();
    
        if ( 0 !== strpos( $route, '/elementor/v1/globals' ) ) {
            return $response;
        }
    
        $slug_map = array();
    
        $slug_map['primary_color']     = 0;
        $slug_map['secondary_color']   = 1;
        $slug_map['heading_color']     = 2;
        $slug_map['body_font_color']   = 3;
        $slug_map['section_bg_color'] = 4;
        $slug_map['site_bg_color'] = 5;
        $slug_map['accent_color_one'] = 6;
        $slug_map['accent_color_two'] = 7;

        $rest_id = substr( $route, strrpos( $route, '/' ) + 1 );
    
        if ( ! in_array( $rest_id, array_keys( $slug_map ), true ) ) {
            return $response;
        }
        
        $defaults = travel_monster_get_color_defaults();

        $response = rest_ensure_response(
            array(
                'id'    => 'primary_color',
                'title' => 'primary_color',
                'value' => get_theme_mod( 'primary_color',$defaults['primary_color'] ),
            ),
            array(
                'id'    => 'secondary_color',
                'title' => 'secondary_color',
                'value' => get_theme_mod( 'secondary_color',$defaults['secondary_color'] ),
            ),
            array(
                'id'    => 'heading_color',
                'title' => 'heading_color',
                'value' => get_theme_mod( 'heading_color',$defaults['heading_color'] ),
            ),
            array(
                'id'    => 'body_font_color',
                'title' => 'body_font_color',
                'value' => get_theme_mod( 'body_font_color',$defaults['body_font_color'] ),
            ),
            array(
                'id'    => 'section_bg_color',
                'title' => 'section_bg_color',
                'value' => get_theme_mod( 'section_bg_color',$defaults['section_bg_color'] ),
            ),
            array(
                'id'    => 'site_bg_color',
                'title' => 'site_bg_color',
                'value' => get_theme_mod( 'site_bg_color',$defaults['site_bg_color'] ),
            ),
            array(
                'id'    => 'accent_color_one',
                'title' => 'accent_color_one',
                'value' => get_theme_mod( 'accent_color_one',$defaults['accent_color_one'] ),
            ),
            array(
                'id'    => 'accent_color_two',
                'title' => 'accent_color_two',
                'value' => get_theme_mod( 'accent_color_two',$defaults['accent_color_two'] ),
            ),
        );
        return $response;
    }
endif;
add_action( 'rest_request_after_callbacks', 'travel_monster_display_global_colors_elementor', 999, 3 );

if( travel_monster_is_elementor_activated() ){
    
    /**Disable Default Colours and Default Fonts of elementor on Theme Activation*/

    $fresh        = get_option( 'travel_monster_flag' );
    $flexbox      = get_option( 'travel_monster_flexbox' );
    if( ! $fresh ){
        update_option('elementor_disable_color_schemes', 'yes');
        update_option('elementor_disable_typography_schemes', 'yes');
        update_option( 'travel_monster_flag', true ); 
    }
    if( ! $flexbox ){
        update_option('elementor_experiment-container', 'active');
        update_option( 'travel_monster_flexbox', true ); 
    }
}

/**
 * Elementor – Header, Footer & Blocks Template compatibility
*/
if( defined( 'HFE_VER' ) ){

    if( ! function_exists( 'travel_monster_remove_header_and_footer' ) ) :
    /**
     * Removing header and footer from theme.
     */
    function travel_monster_remove_header_and_footer(){
        remove_action( 'travel_monster_header', 'travel_monster_header', 20 );
        remove_action( 'travel_monster_footer', 'travel_monster_footer_start', 20 );
        remove_action( 'travel_monster_footer', 'travel_monster_footer_top', 30 );
        remove_action( 'travel_monster_footer', 'travel_monster_footer_bottom', 40 );
        remove_action( 'travel_monster_footer', 'travel_monster_footer_end', 50 );
    }
    endif;
    add_action( 'init', 'travel_monster_remove_header_and_footer' ); 

    if( ! function_exists( 'travel_monster_render_hfe_header' ) ) :
    /**
     * Header
     */
    function travel_monster_render_hfe_header() {	
        if ( function_exists( 'hfe_render_header' ) ) {
            hfe_render_header();
        }
    }
    endif;
    add_action( 'travel_monster_header', 'travel_monster_render_hfe_header' );

    if( ! function_exists( 'travel_monster_render_hfe_footer' ) ) :
    /**
     * Header
     */
    function travel_monster_render_hfe_footer() {	
        if ( function_exists( 'hfe_render_footer' ) ) {
            hfe_render_footer();
        }
    }
    endif;
    add_action( 'travel_monster_footer', 'travel_monster_render_hfe_footer' );

    if( ! function_exists( 'travel_monster_header_footer_elementor_support' ) ) :
    /**
     * Theme Support for header footer elementor.
     */
    function travel_monster_header_footer_elementor_support() {
        add_theme_support( 'header-footer-elementor' );
    }
    endif;
    add_action( 'after_setup_theme', 'travel_monster_header_footer_elementor_support' );
}