<?php
/**
 * Travel Monster Dynamic Styles
 * 
 * @package Travel Monster
*/

function travel_monster_dynamic_root_css(){
	$typo_defaults   = travel_monster_get_typography_defaults();
	$defaults        = travel_monster_get_color_defaults();
	$site_defaults   = travel_monster_get_site_defaults();
	$layout_defaults = travel_monster_get_general_defaults();
	$button_defaults = travel_monster_get_button_defaults();

	$logo_width        = get_theme_mod( 'logo_width', $site_defaults['logo_width'] );
	$tablet_logo_width = get_theme_mod( 'tablet_logo_width', $site_defaults['tablet_logo_width'] );
	$mobile_logo_width = get_theme_mod( 'mobile_logo_width', $site_defaults['mobile_logo_width'] );
    
	$primary_font   = wp_parse_args( get_theme_mod( 'primary_font' ), $typo_defaults['primary_font'] );
	$sitetitle      = wp_parse_args( get_theme_mod( 'site_title' ), $typo_defaults['site_title'] );
	$button         = wp_parse_args( get_theme_mod( 'button' ), $typo_defaults['button'] );
	$heading_one    = wp_parse_args( get_theme_mod( 'heading_one' ), $typo_defaults['heading_one'] );
	$heading_two    = wp_parse_args( get_theme_mod( 'heading_two' ), $typo_defaults['heading_two'] );
	$heading_three  = wp_parse_args( get_theme_mod( 'heading_three' ), $typo_defaults['heading_three'] );
	$heading_four   = wp_parse_args( get_theme_mod( 'heading_four' ), $typo_defaults['heading_four'] );
	$heading_five   = wp_parse_args( get_theme_mod( 'heading_five' ), $typo_defaults['heading_five'] );
	$heading_six    = wp_parse_args( get_theme_mod( 'heading_six' ), $typo_defaults['heading_six'] );

    //Primary Font variables
    $primarydesktopFontSize = isset(  $primary_font['desktop']['font_size'] ) ? $primary_font['desktop']['font_size'] : $typo_defaults['primary_font']['desktop']['font_size'];
    $primarydesktopSpacing = isset(  $primary_font['desktop']['letter_spacing'] ) ? $primary_font['desktop']['letter_spacing'] : $typo_defaults['primary_font']['desktop']['letter_spacing'];
    $primarydesktopHeight = isset(  $primary_font['desktop']['line_height'] ) ? $primary_font['desktop']['line_height'] : $typo_defaults['primary_font']['desktop']['line_height'];
    $primarytabletFontSize = isset(  $primary_font['tablet']['font_size'] ) ? $primary_font['tablet']['font_size'] : $typo_defaults['primary_font']['tablet']['font_size'];
    $primarytabletSpacing = isset(  $primary_font['tablet']['letter_spacing'] ) ? $primary_font['tablet']['letter_spacing'] : $typo_defaults['primary_font']['tablet']['letter_spacing'];
    $primarytabletHeight = isset(  $primary_font['tablet']['line_height'] ) ? $primary_font['tablet']['line_height'] : $typo_defaults['primary_font']['tablet']['line_height'];
    $primarymobileFontSize = isset(  $primary_font['mobile']['font_size'] ) ? $primary_font['mobile']['font_size'] : $typo_defaults['primary_font']['mobile']['font_size'];
    $primarymobileSpacing = isset(  $primary_font['mobile']['letter_spacing'] ) ? $primary_font['mobile']['letter_spacing'] : $typo_defaults['primary_font']['mobile']['letter_spacing'];
    $primarymobileHeight = isset(  $primary_font['mobile']['line_height'] ) ? $primary_font['mobile']['line_height'] : $typo_defaults['primary_font']['mobile']['line_height'];
    
    //Site Title variables
    $sitedesktopFontSize = isset(  $sitetitle['desktop']['font_size'] ) ? $sitetitle['desktop']['font_size'] : $typo_defaults['site_title']['desktop']['font_size'];
    $sitedesktopSpacing = isset(  $sitetitle['desktop']['letter_spacing'] ) ? $sitetitle['desktop']['letter_spacing'] : $typo_defaults['site_title']['desktop']['letter_spacing'];
    $sitedesktopHeight = isset(  $sitetitle['desktop']['line_height'] ) ? $sitetitle['desktop']['line_height'] : $typo_defaults['site_title']['desktop']['line_height'];
    $sitetabletFontSize = isset(  $sitetitle['tablet']['font_size'] ) ? $sitetitle['tablet']['font_size'] : $typo_defaults['site_title']['tablet']['font_size'];
    $sitetabletSpacing = isset(  $sitetitle['tablet']['letter_spacing'] ) ? $sitetitle['tablet']['letter_spacing'] : $typo_defaults['site_title']['tablet']['letter_spacing'];
    $sitetabletHeight = isset(  $sitetitle['tablet']['line_height'] ) ? $sitetitle['tablet']['line_height'] : $typo_defaults['site_title']['tablet']['line_height'];
    $sitemobileFontSize = isset(  $sitetitle['mobile']['font_size'] ) ? $sitetitle['mobile']['font_size'] : $typo_defaults['site_title']['mobile']['font_size'];
    $sitemobileSpacing = isset(  $sitetitle['mobile']['letter_spacing'] ) ? $sitetitle['mobile']['letter_spacing'] : $typo_defaults['site_title']['mobile']['letter_spacing'];
    $sitemobileHeight = isset(  $sitetitle['mobile']['line_height'] ) ? $sitetitle['mobile']['line_height'] : $typo_defaults['site_title']['mobile']['line_height'];
    
    //Button variables
    $btndesktopFontSize = isset(  $button['desktop']['font_size'] ) ? $button['desktop']['font_size'] : $typo_defaults['button']['desktop']['font_size'];
    $btndesktopSpacing = isset(  $button['desktop']['letter_spacing'] ) ? $button['desktop']['letter_spacing'] : $typo_defaults['button']['desktop']['letter_spacing'];
    $btndesktopHeight = isset(  $button['desktop']['line_height'] ) ? $button['desktop']['line_height'] : $typo_defaults['button']['desktop']['line_height'];
    $btntabletFontSize = isset(  $button['tablet']['font_size'] ) ? $button['tablet']['font_size'] : $typo_defaults['button']['tablet']['font_size'];
    $btntabletSpacing = isset(  $button['tablet']['letter_spacing'] ) ? $button['tablet']['letter_spacing'] : $typo_defaults['button']['tablet']['letter_spacing'];
    $btntabletHeight = isset(  $button['tablet']['line_height'] ) ? $button['tablet']['line_height'] : $typo_defaults['button']['tablet']['line_height'];
    $btnmobileFontSize = isset(  $button['mobile']['font_size'] ) ? $button['mobile']['font_size'] : $typo_defaults['button']['mobile']['font_size'];
    $btnmobileSpacing = isset(  $button['mobile']['letter_spacing'] ) ? $button['mobile']['letter_spacing'] : $typo_defaults['button']['mobile']['letter_spacing'];
    $btnmobileHeight = isset(  $button['mobile']['line_height'] ) ? $button['mobile']['line_height'] : $typo_defaults['button']['mobile']['line_height'];
    
    //Heading 1 variables
    $h1desktopFontSize = isset(  $heading_one['desktop']['font_size'] ) ? $heading_one['desktop']['font_size'] : $typo_defaults['heading_one']['desktop']['font_size'];
    $h1desktopSpacing = isset(  $heading_one['desktop']['letter_spacing'] ) ? $heading_one['desktop']['letter_spacing'] : $typo_defaults['heading_one']['desktop']['letter_spacing'];
    $h1desktopHeight = isset(  $heading_one['desktop']['line_height'] ) ? $heading_one['desktop']['line_height'] : $typo_defaults['heading_one']['desktop']['line_height'];
    $h1tabletFontSize = isset(  $heading_one['tablet']['font_size'] ) ? $heading_one['tablet']['font_size'] : $typo_defaults['heading_one']['tablet']['font_size'];
    $h1tabletSpacing = isset(  $heading_one['tablet']['letter_spacing'] ) ? $heading_one['tablet']['letter_spacing'] : $typo_defaults['heading_one']['tablet']['letter_spacing'];
    $h1tabletHeight = isset(  $heading_one['tablet']['line_height'] ) ? $heading_one['tablet']['line_height'] : $typo_defaults['heading_one']['tablet']['line_height'];
    $h1mobileFontSize = isset(  $heading_one['mobile']['font_size'] ) ? $heading_one['mobile']['font_size'] : $typo_defaults['heading_one']['mobile']['font_size'];
    $h1mobileSpacing = isset(  $heading_one['mobile']['letter_spacing'] ) ? $heading_one['mobile']['letter_spacing'] : $typo_defaults['heading_one']['mobile']['letter_spacing'];
    $h1mobileHeight = isset(  $heading_one['mobile']['line_height'] ) ? $heading_one['mobile']['line_height'] : $typo_defaults['heading_one']['mobile']['line_height'];
    
    //Heading 2 variables
    $h2desktopFontSize = isset(  $heading_two['desktop']['font_size'] ) ? $heading_two['desktop']['font_size'] : $typo_defaults['heading_two']['desktop']['font_size'];
    $h2desktopSpacing = isset(  $heading_two['desktop']['letter_spacing'] ) ? $heading_two['desktop']['letter_spacing'] : $typo_defaults['heading_two']['desktop']['letter_spacing'];
    $h2desktopHeight = isset(  $heading_two['desktop']['line_height'] ) ? $heading_two['desktop']['line_height'] : $typo_defaults['heading_two']['desktop']['line_height'];
    $h2tabletFontSize = isset(  $heading_two['tablet']['font_size'] ) ? $heading_two['tablet']['font_size'] : $typo_defaults['heading_two']['tablet']['font_size'];
    $h2tabletSpacing = isset(  $heading_two['tablet']['letter_spacing'] ) ? $heading_two['tablet']['letter_spacing'] : $typo_defaults['heading_two']['tablet']['letter_spacing'];
    $h2tabletHeight = isset(  $heading_two['tablet']['line_height'] ) ? $heading_two['tablet']['line_height'] : $typo_defaults['heading_two']['tablet']['line_height'];
    $h2mobileFontSize = isset(  $heading_two['mobile']['font_size'] ) ? $heading_two['mobile']['font_size'] : $typo_defaults['heading_two']['mobile']['font_size'];
    $h2mobileSpacing = isset(  $heading_two['mobile']['letter_spacing'] ) ? $heading_two['mobile']['letter_spacing'] : $typo_defaults['heading_two']['mobile']['letter_spacing'];
    $h2mobileHeight = isset(  $heading_two['mobile']['line_height'] ) ? $heading_two['mobile']['line_height'] : $typo_defaults['heading_two']['mobile']['line_height'];
    
    //Heading 3 variables
    $h3desktopFontSize = isset(  $heading_three['desktop']['font_size'] ) ? $heading_three['desktop']['font_size'] : $typo_defaults['heading_three']['desktop']['font_size'];
    $h3desktopSpacing = isset(  $heading_three['desktop']['letter_spacing'] ) ? $heading_three['desktop']['letter_spacing'] : $typo_defaults['heading_three']['desktop']['letter_spacing'];
    $h3desktopHeight = isset(  $heading_three['desktop']['line_height'] ) ? $heading_three['desktop']['line_height'] : $typo_defaults['heading_three']['desktop']['line_height'];
    $h3tabletFontSize = isset(  $heading_three['tablet']['font_size'] ) ? $heading_three['tablet']['font_size'] : $typo_defaults['heading_three']['tablet']['font_size'];
    $h3tabletSpacing = isset(  $heading_three['tablet']['letter_spacing'] ) ? $heading_three['tablet']['letter_spacing'] : $typo_defaults['heading_three']['tablet']['letter_spacing'];
    $h3tabletHeight = isset(  $heading_three['tablet']['line_height'] ) ? $heading_three['tablet']['line_height'] : $typo_defaults['heading_three']['tablet']['line_height'];
    $h3mobileFontSize = isset(  $heading_three['mobile']['font_size'] ) ? $heading_three['mobile']['font_size'] : $typo_defaults['heading_three']['mobile']['font_size'];
    $h3mobileSpacing = isset(  $heading_three['mobile']['letter_spacing'] ) ? $heading_three['mobile']['letter_spacing'] : $typo_defaults['heading_three']['mobile']['letter_spacing'];
    $h3mobileHeight = isset(  $heading_three['mobile']['line_height'] ) ? $heading_three['mobile']['line_height'] : $typo_defaults['heading_three']['mobile']['line_height'];
    
    //Heading 4 variables
    $h4desktopFontSize = isset(  $heading_four['desktop']['font_size'] ) ? $heading_four['desktop']['font_size'] : $typo_defaults['heading_four']['desktop']['font_size'];
    $h4desktopSpacing = isset(  $heading_four['desktop']['letter_spacing'] ) ? $heading_four['desktop']['letter_spacing'] : $typo_defaults['heading_four']['desktop']['letter_spacing'];
    $h4desktopHeight = isset(  $heading_four['desktop']['line_height'] ) ? $heading_four['desktop']['line_height'] : $typo_defaults['heading_four']['desktop']['line_height'];
    $h4tabletFontSize = isset(  $heading_four['tablet']['font_size'] ) ? $heading_four['tablet']['font_size'] : $typo_defaults['heading_four']['tablet']['font_size'];
    $h4tabletSpacing = isset(  $heading_four['tablet']['letter_spacing'] ) ? $heading_four['tablet']['letter_spacing'] : $typo_defaults['heading_four']['tablet']['letter_spacing'];
    $h4tabletHeight = isset(  $heading_four['tablet']['line_height'] ) ? $heading_four['tablet']['line_height'] : $typo_defaults['heading_four']['tablet']['line_height'];
    $h4mobileFontSize = isset(  $heading_four['mobile']['font_size'] ) ? $heading_four['mobile']['font_size'] : $typo_defaults['heading_four']['mobile']['font_size'];
    $h4mobileSpacing = isset(  $heading_four['mobile']['letter_spacing'] ) ? $heading_four['mobile']['letter_spacing'] : $typo_defaults['heading_four']['mobile']['letter_spacing'];
    $h4mobileHeight = isset(  $heading_four['mobile']['line_height'] ) ? $heading_four['mobile']['line_height'] : $typo_defaults['heading_four']['mobile']['line_height'];
    
    //Heading 5 variables
    $h5desktopFontSize = isset(  $heading_five['desktop']['font_size'] ) ? $heading_five['desktop']['font_size'] : $typo_defaults['heading_five']['desktop']['font_size'];
    $h5desktopSpacing = isset(  $heading_five['desktop']['letter_spacing'] ) ? $heading_five['desktop']['letter_spacing'] : $typo_defaults['heading_five']['desktop']['letter_spacing'];
    $h5desktopHeight = isset(  $heading_five['desktop']['line_height'] ) ? $heading_five['desktop']['line_height'] : $typo_defaults['heading_five']['desktop']['line_height'];
    $h5tabletFontSize = isset(  $heading_five['tablet']['font_size'] ) ? $heading_five['tablet']['font_size'] : $typo_defaults['heading_five']['tablet']['font_size'];
    $h5tabletSpacing = isset(  $heading_five['tablet']['letter_spacing'] ) ? $heading_five['tablet']['letter_spacing'] : $typo_defaults['heading_five']['tablet']['letter_spacing'];
    $h5tabletHeight = isset(  $heading_five['tablet']['line_height'] ) ? $heading_five['tablet']['line_height'] : $typo_defaults['heading_five']['tablet']['line_height'];
    $h5mobileFontSize = isset(  $heading_five['mobile']['font_size'] ) ? $heading_five['mobile']['font_size'] : $typo_defaults['heading_five']['mobile']['font_size'];
    $h5mobileSpacing = isset(  $heading_five['mobile']['letter_spacing'] ) ? $heading_five['mobile']['letter_spacing'] : $typo_defaults['heading_five']['mobile']['letter_spacing'];
    $h5mobileHeight = isset(  $heading_five['mobile']['line_height'] ) ? $heading_five['mobile']['line_height'] : $typo_defaults['heading_five']['mobile']['line_height'];
    
    //Heading 6 variables
    $h6desktopFontSize = isset(  $heading_six['desktop']['font_size'] ) ? $heading_six['desktop']['font_size'] : $typo_defaults['heading_six']['desktop']['font_size'];
    $h6desktopSpacing = isset(  $heading_six['desktop']['letter_spacing'] ) ? $heading_six['desktop']['letter_spacing'] : $typo_defaults['heading_six']['desktop']['letter_spacing'];
    $h6desktopHeight = isset(  $heading_six['desktop']['line_height'] ) ? $heading_six['desktop']['line_height'] : $typo_defaults['heading_six']['desktop']['line_height'];
    $h6tabletFontSize = isset(  $heading_six['tablet']['font_size'] ) ? $heading_six['tablet']['font_size'] : $typo_defaults['heading_six']['tablet']['font_size'];
    $h6tabletSpacing = isset(  $heading_six['tablet']['letter_spacing'] ) ? $heading_six['tablet']['letter_spacing'] : $typo_defaults['heading_six']['tablet']['letter_spacing'];
    $h6tabletHeight = isset(  $heading_six['tablet']['line_height'] ) ? $heading_six['tablet']['line_height'] : $typo_defaults['heading_six']['tablet']['line_height'];
    $h6mobileFontSize = isset(  $heading_six['mobile']['font_size'] ) ? $heading_six['mobile']['font_size'] : $typo_defaults['heading_six']['mobile']['font_size'];
    $h6mobileSpacing = isset(  $heading_six['mobile']['letter_spacing'] ) ? $heading_six['mobile']['letter_spacing'] : $typo_defaults['heading_six']['mobile']['letter_spacing'];
    $h6mobileHeight = isset(  $heading_six['mobile']['line_height'] ) ? $heading_six['mobile']['line_height'] : $typo_defaults['heading_six']['mobile']['line_height'];

	$primary_font_family       = travel_monster_get_font_family( $primary_font );
	$sitetitle_font_family     = travel_monster_get_font_family( $sitetitle );
	$btn_font_family           = travel_monster_get_font_family( $button );
	$heading_one_font_family   = travel_monster_get_font_family( $heading_one );
	$heading_two_font_family   = travel_monster_get_font_family( $heading_two );
	$heading_three_font_family = travel_monster_get_font_family( $heading_three );
	$heading_four_font_family  = travel_monster_get_font_family( $heading_four );
	$heading_five_font_family  = travel_monster_get_font_family( $heading_five );
	$heading_six_font_family   = travel_monster_get_font_family( $heading_six );

    $siteFontFamily = $sitetitle_font_family === '"Default Family"' ? 'inherit' : $sitetitle_font_family;
    $btnFontFamily  = $btn_font_family === '"Default Family"' ? 'inherit' : $btn_font_family;
    $h1FontFamily   = $heading_one_font_family === '"Default Family"' ? 'inherit' : $heading_one_font_family;
    $h2FontFamily   = $heading_two_font_family === '"Default Family"' ? 'inherit' : $heading_two_font_family;
    $h3FontFamily   = $heading_three_font_family === '"Default Family"' ? 'inherit' : $heading_three_font_family;
    $h4FontFamily   = $heading_four_font_family === '"Default Family"' ? 'inherit' : $heading_four_font_family;
    $h5FontFamily   = $heading_five_font_family === '"Default Family"' ? 'inherit' : $heading_five_font_family;
    $h6FontFamily   = $heading_six_font_family === '"Default Family"' ? 'inherit' : $heading_six_font_family;

	$container_width        = get_theme_mod( 'container_width', $layout_defaults['container_width'] );
	$tablet_container_width = get_theme_mod( 'tablet_container_width', $layout_defaults['tablet_container_width'] );
	$mobile_container_width = get_theme_mod( 'mobile_container_width', $layout_defaults['mobile_container_width'] );

    $fullwidth_centered        = get_theme_mod( 'fullwidth_centered', $layout_defaults['fullwidth_centered']);
    $tablet_fullwidth_centered = get_theme_mod( 'tablet_fullwidth_centered', $layout_defaults['tablet_fullwidth_centered']);
    $mobile_fullwidth_centered = get_theme_mod( 'mobile_fullwidth_centered', $layout_defaults['mobile_fullwidth_centered']);

    $sidebar_width        = get_theme_mod( 'sidebar_width', $layout_defaults['sidebar_width']);
    $tablet_sidebar_width = get_theme_mod( 'tablet_sidebar_width', $layout_defaults['tablet_sidebar_width']);

    $widgets_spacing        = get_theme_mod( 'widgets_spacing', $layout_defaults['widgets_spacing']);
    $tablet_widgets_spacing = get_theme_mod( 'tablet_widgets_spacing', $layout_defaults['tablet_widgets_spacing']);
    $mobile_widgets_spacing = get_theme_mod( 'mobile_widgets_spacing', $layout_defaults['mobile_widgets_spacing']);

    $scroll_top_size        = get_theme_mod( 'scroll_top_size', $layout_defaults['scroll_top_size']);
    $tablet_scroll_top_size = get_theme_mod( 'tablet_scroll_top_size', $layout_defaults['tablet_scroll_top_size']);
    $mobile_scroll_top_size = get_theme_mod( 'mobile_scroll_top_size', $layout_defaults['mobile_scroll_top_size']);

    $scroll_top_bottom_offset        = get_theme_mod( 'scroll_top_bottom_offset', $layout_defaults['scroll_top_bottom_offset']);
    $tablet_scroll_top_bottom_offset = get_theme_mod( 'tablet_scroll_top_bottom_offset', $layout_defaults['tablet_scroll_top_bottom_offset']);
    $mobile_scroll_top_bottom_offset = get_theme_mod( 'mobile_scroll_top_bottom_offset', $layout_defaults['mobile_scroll_top_bottom_offset']);

    $scroll_top_side_offset        = get_theme_mod( 'scroll_top_side_offset', $layout_defaults['scroll_top_side_offset']);
    $tablet_scroll_top_side_offset = get_theme_mod( 'tablet_scroll_top_side_offset', $layout_defaults['tablet_scroll_top_side_offset']);
    $mobile_scroll_top_side_offset = get_theme_mod( 'mobile_scroll_top_side_offset', $layout_defaults['mobile_scroll_top_side_offset']);

	$menu_item_spacing = get_theme_mod( 'header_items_spacing', $layout_defaults['header_items_spacing'] );
	$menu_dropdown_width = get_theme_mod( 'header_dropdown_width', $layout_defaults['header_dropdown_width'] );

	$primary_color      = get_theme_mod( 'primary_color', $defaults['primary_color'] );
	$rgb                = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $primary_color ) );
	$secondary_color    = get_theme_mod( 'secondary_color', $defaults['secondary_color'] );
	$rgb2               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $secondary_color ) );
	$body_font_color    = get_theme_mod( 'body_font_color', $defaults['body_font_color'] );
	$rgb3               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $body_font_color ) );
	$heading_color      = get_theme_mod( 'heading_color', $defaults['heading_color'] );
	$rgb4               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $heading_color ) );
	$section_bg_color   = get_theme_mod( 'section_bg_color', $defaults['section_bg_color'] );
	$rgb5               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $section_bg_color ) );
	$background_color   = get_theme_mod( 'site_bg_color', $defaults['site_bg_color'] );
	$rgb6               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $background_color ) );
	$accent_color_one   = get_theme_mod( 'accent_color_one', $defaults['accent_color_one'] );
	$accent_color_two   = get_theme_mod( 'accent_color_two', $defaults['accent_color_two'] );

	$header_btn_text_color         = get_theme_mod( 'header_btn_text_color', $defaults['header_btn_text_color'] );
	$header_btn_bg_color           = get_theme_mod( 'header_btn_bg_color', $defaults['header_btn_bg_color'] );
	$header_btn_text_hover_color   = get_theme_mod( 'header_btn_text_hover_color', $defaults['header_btn_text_hover_color'] );
	$header_btn_bg_hover_color     = get_theme_mod( 'header_btn_bg_hover_color', $defaults['header_btn_bg_hover_color'] );

    $top_header_bg_color   = get_theme_mod( 'top_header_bg_color', $defaults['top_header_bg_color'] );
    $top_header_text_color = get_theme_mod( 'top_header_text_color', $defaults['top_header_text_color'] );
	$rgb7                  = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $top_header_text_color ) );
    
    $transparent_header = get_theme_mod( 'ed_transparent_header', false );
    $ed_bg_effect       = get_theme_mod( 'ed_bg_effect', false );
    if ( $transparent_header ){
        $transparent_top_header_bg_color   = get_theme_mod( 'transparent_top_header_bg_color', $defaults['transparent_top_header_bg_color'] );
        $transparent_top_header_text_color = get_theme_mod( 'transparent_top_header_text_color', $defaults['transparent_top_header_text_color'] );
        $rgb8                              = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $transparent_top_header_text_color ) );
    }

    if ( $transparent_header && $ed_bg_effect ){
        $background_blur                   = get_theme_mod( 'background_blur', $layout_defaults['background_blur'] );
    }
    

	$button_roundness = get_theme_mod( 'btn_roundness', $button_defaults['btn_roundness'] );
	$button_padding   = get_theme_mod( 'button_padding', $button_defaults['button_padding'] );
	
	//Button Color
	$btn_text_color         = get_theme_mod( 'btn_text_color_initial', $defaults['btn_text_color_initial'] );
	$btn_bg_color           = get_theme_mod( 'btn_bg_color_initial', $defaults['btn_bg_color_initial'] );
	$btn_text_hover_color   = get_theme_mod( 'btn_text_color_hover', $defaults['btn_text_color_hover'] );
	$btn_bg_hover_color     = get_theme_mod( 'btn_bg_color_hover', $defaults['btn_bg_color_hover'] );
	$btn_border_color       = get_theme_mod( 'btn_border_color_initial', $defaults['btn_border_color_initial'] );
	$btn_border_hover_color = get_theme_mod( 'btn_border_color_hover', $defaults['btn_border_color_hover'] );
	
    //Notification Bar Color
    $notifi_text_color = get_theme_mod( 'notification_text_color', $defaults['notification_text_color'] );
    $notifi_bg_color   = get_theme_mod( 'notification_bg_color', $defaults['notification_bg_color'] );

    //Upper Footer Color
    $uf_text_color         = get_theme_mod( 'upper_footer_text_color', $defaults['upper_footer_text_color'] );
	$uf_bg_color           = get_theme_mod( 'upper_footer_bg_color', $defaults['upper_footer_bg_color'] );
	$uf_link_hover_color   = get_theme_mod( 'upper_footer_link_hover_color', $defaults['upper_footer_link_hover_color'] );
	$uf_heading_color      = get_theme_mod( 'upper_footer_widget_heading_color', $defaults['upper_footer_widget_heading_color'] );

    //Bottom Footer Color
    $bf_text_color         = get_theme_mod( 'bottom_footer_text_color', $defaults['bottom_footer_text_color'] );
    $bf_bg_color           = get_theme_mod( 'bottom_footer_bg_color', $defaults['bottom_footer_bg_color'] );
    $bf_link_initial_color = get_theme_mod( 'bottom_footer_link_initial_color', $defaults['bottom_footer_link_initial_color'] );
    $bf_link_hover_color   = get_theme_mod( 'bottom_footer_link_hover_color', $defaults['bottom_footer_link_hover_color'] );
    
    ob_start();
    
    if( travel_monster_is_elementor_activated()){ ?>
		:root {
			--e-global-color-primary_color  : <?php echo travel_monster_sanitize_rgba( $primary_color ); ?>;
            --e-global-color-secondary_color: <?php echo travel_monster_sanitize_rgba( $secondary_color ); ?>;
            --e-global-color-body_font_color: <?php echo travel_monster_sanitize_rgba( $body_font_color ); ?>;
            --e-global-color-heading_color  : <?php echo travel_monster_sanitize_rgba( $heading_color ); ?>;
            --e-global-color-section_bg_color  : <?php echo travel_monster_sanitize_rgba( $section_bg_color ); ?>;
            --e-global-color-site_bg_color  : <?php echo travel_monster_sanitize_rgba( $background_color ); ?>;
            --e-global-color-accent_color_one  : <?php echo travel_monster_sanitize_rgba( $accent_color_one ); ?>;
            --e-global-color-accent_color_two  : <?php echo travel_monster_sanitize_rgba( $accent_color_two ); ?>;
        }
    <?php } ?>

    :root {
		--tmp-primary-color             : <?php echo travel_monster_sanitize_rgba( $primary_color ); ?>;
		--tmp-primary-color-rgb         : <?php printf('%1$s, %2$s, %3$s', $rgb[0], $rgb[1], $rgb[2] ); ?>;
		--tmp-secondary-color           : <?php echo travel_monster_sanitize_rgba( $secondary_color ); ?>;
		--tmp-secondary-color-rgb       : <?php printf('%1$s, %2$s, %3$s', $rgb2[0], $rgb2[1], $rgb2[2] ); ?>;
		--tmp-body-font-color           : <?php echo travel_monster_sanitize_rgba( $body_font_color ); ?>;
		--tmp-body-font-color-rgb       : <?php printf('%1$s, %2$s, %3$s', $rgb3[0], $rgb3[1], $rgb3[2] ); ?>;
		--tmp-heading-color             : <?php echo travel_monster_sanitize_rgba( $heading_color ); ?>;
		--tmp-heading-color-rgb         : <?php printf('%1$s, %2$s, %3$s', $rgb4[0], $rgb4[1], $rgb4[2] ); ?>;
		--tmp-section-bg-color          : <?php echo travel_monster_sanitize_rgba( $section_bg_color ); ?>;
		--tmp-section-bg-color-rgb      : <?php printf('%1$s, %2$s, %3$s', $rgb5[0], $rgb5[1], $rgb5[2] ); ?>;
		--tmp-background-color          : <?php echo travel_monster_sanitize_rgba( $background_color ); ?>;
		--tmp-background-color-rgb      : <?php printf('%1$s, %2$s, %3$s', $rgb6[0], $rgb6[1], $rgb6[2] ); ?>;

        --tmp-btn-text-initial-color: <?php echo travel_monster_sanitize_rgba( $btn_text_color ); ?>;
        --tmp-btn-text-hover-color: <?php echo travel_monster_sanitize_rgba( $btn_text_hover_color ); ?>;
        --tmp-btn-bg-initial-color: <?php echo travel_monster_sanitize_rgba( $btn_bg_color ); ?>;
        --tmp-btn-bg-hover-color: <?php echo travel_monster_sanitize_rgba( $btn_bg_hover_color ); ?>;
        --tmp-btn-border-initial-color: <?php echo travel_monster_sanitize_rgba( $btn_border_color ); ?>;
        --tmp-btn-border-hover-color: <?php echo travel_monster_sanitize_rgba( $btn_border_hover_color ); ?>;

        --tmp-primary-font-family: <?php echo wp_kses_post( $primary_font_family ); ?>;     
        --tmp-primary-font-weight: <?php echo esc_html( $primary_font['weight'] ); ?>;
        --tmp-primary-font-transform: <?php echo esc_html( $primary_font['transform'] ); ?>;

        --tmp-btn-font-family: <?php echo wp_kses_post( $btnFontFamily ); ?>;     
        --tmp-btn-font-weight: <?php echo esc_html( $button['weight'] ); ?>;
        --tmp-btn-font-transform: <?php echo esc_html( $button['transform'] ); ?>;
        --tmp-btn-roundness-top: <?php echo absint( $button_roundness['top'] ); ?>px;
        --tmp-btn-roundness-right: <?php echo absint( $button_roundness['right'] ); ?>px;
        --tmp-btn-roundness-bottom: <?php echo absint( $button_roundness['bottom'] ); ?>px;
        --tmp-btn-roundness-left: <?php echo absint( $button_roundness['left'] ); ?>px;
        --tmp-btn-padding-top: <?php echo absint( $button_padding['top'] ); ?>px;
        --tmp-btn-padding-right: <?php echo absint( $button_padding['right'] ); ?>px;
        --tmp-btn-padding-bottom: <?php echo absint( $button_padding['bottom'] ); ?>px;
        --tmp-btn-padding-left: <?php echo absint( $button_padding['left'] ); ?>px;
	}

    .site-header, 
    .mobile-header{
        --tmp-menu-items-spacing: <?php echo absint( $menu_item_spacing ); ?>px;
        --tmp-menu-dropdown-width: <?php echo absint( $menu_dropdown_width ); ?>px;
        --tmp-btn-text-initial-color: <?php echo travel_monster_sanitize_rgba( $header_btn_text_color ); ?>;
        --tmp-btn-text-hover-color: <?php echo travel_monster_sanitize_rgba( $header_btn_text_hover_color ); ?>;
        --tmp-btn-bg-initial-color: <?php echo travel_monster_sanitize_rgba( $header_btn_bg_color ); ?>;
        --tmp-btn-bg-hover-color: <?php echo travel_monster_sanitize_rgba( $header_btn_bg_hover_color ); ?>;
    }

    .notification-bar{
        --tmp-bg-color: <?php echo travel_monster_sanitize_rgba( $notifi_bg_color ); ?>;
        --tmp-text-color: <?php echo travel_monster_sanitize_rgba( $notifi_text_color ); ?>;
    }

	.site-header .custom-logo{
		width : <?php echo absint( $logo_width ); ?>px;
	}
    
    .site-footer{
        --tmp-uf-text-color: <?php echo travel_monster_sanitize_rgba( $uf_text_color ); ?>;
        --tmp-uf-bg-color: <?php echo travel_monster_sanitize_rgba( $uf_bg_color ); ?>;
        --tmp-uf-link-hover-color: <?php echo travel_monster_sanitize_rgba( $uf_link_hover_color ); ?>;
        --tmp-uf-widget-heading-color: <?php echo travel_monster_sanitize_rgba( $uf_heading_color ); ?>;
        --tmp-bf-text-color: <?php echo travel_monster_sanitize_rgba( $bf_text_color ); ?>;
        --tmp-bf-bg-color: <?php echo travel_monster_sanitize_rgba( $bf_bg_color ); ?>;
        --tmp-bf-link-initial-color: <?php echo travel_monster_sanitize_rgba( $bf_link_initial_color ); ?>;
        --tmp-bf-link-hover-color: <?php echo travel_monster_sanitize_rgba( $bf_link_hover_color ); ?>;
    }

    .header-layout-1 .header-m{
        --tmp-top-header-bg-color: <?php echo travel_monster_sanitize_rgba( $top_header_bg_color ); ?>;
        --tmp-top-header-text-color: <?php echo travel_monster_sanitize_rgba( $top_header_text_color ); ?>;
		--tmp-top-header-text-color-rgb: <?php printf('%1$s, %2$s, %3$s', $rgb7[0], $rgb7[1], $rgb7[2] ); ?>;
    }

    <?php if ( $transparent_header ){ ?>
        .tm-transparent-header, .site-header.wte-header-builder{
        --tmp-transparent-header-bg-color: <?php echo travel_monster_sanitize_rgba( $transparent_top_header_bg_color ); ?>;
        --tmp-transparent-header-text-color: <?php echo travel_monster_sanitize_rgba(  $transparent_top_header_text_color ); ?>;
		--tmp-transparent-header-text-color-rgb: <?php printf('%1$s, %2$s, %3$s', $rgb8[0], $rgb8[1], $rgb8[2] ); ?>;
    }

    <?php } 
    if ( $transparent_header && $ed_bg_effect ){ ?>
        .tm-background-effect, .site-header.wte-header-builder{
            --tmp-transparent-header-bg-blur: <?php echo absint($background_blur); ?>px;
        }
    <?php } ?>
    

    /*Typography*/
    .site-branding .site-title{
        font-family   : <?php echo wp_kses_post( $siteFontFamily ); ?>;
        font-weight   : <?php echo esc_html( $sitetitle['weight'] ); ?>;
        text-transform: <?php echo esc_html( $sitetitle['transform'] ); ?>;
    }
    
    h1{
        font-family : <?php echo wp_kses_post( $h1FontFamily ); ?>;
        text-transform: <?php echo esc_html( $heading_one['transform'] ); ?>;      
        font-weight: <?php echo esc_html( $heading_one['weight'] ); ?>;
    }
    h2{
        font-family : <?php echo wp_kses_post( $h2FontFamily ); ?>;
        text-transform: <?php echo esc_html( $heading_two['transform'] ); ?>;      
        font-weight: <?php echo esc_html( $heading_two['weight'] ); ?>;
    }
    h3{
        font-family : <?php echo wp_kses_post( $h3FontFamily ); ?>;
        text-transform: <?php echo esc_html( $heading_three['transform'] ); ?>;      
        font-weight: <?php echo esc_html( $heading_three['weight'] ); ?>;
    }
    h4{
        font-family : <?php echo wp_kses_post( $h4FontFamily ); ?>;
        text-transform: <?php echo esc_html( $heading_four['transform'] ); ?>;      
        font-weight: <?php echo esc_html( $heading_four['weight'] ); ?>;
    }
    h5{
        font-family : <?php echo wp_kses_post( $h5FontFamily ); ?>;
        text-transform: <?php echo esc_html( $heading_five['transform'] ); ?>;      
        font-weight: <?php echo esc_html( $heading_five['weight'] ); ?>;
    }
    h6{
        font-family : <?php echo wp_kses_post( $h6FontFamily ); ?>;
        text-transform: <?php echo esc_html( $heading_six['transform'] ); ?>;      
        font-weight: <?php echo esc_html( $heading_six['weight'] ); ?>;
    }

    @media (min-width: 1024px){
        :root{
            --tmp-primary-font-size   : <?php echo absint( $primarydesktopFontSize ); ?>px;
            --tmp-primary-font-height : <?php echo floatval( $primarydesktopHeight ); ?>em;
            --tmp-primary-font-spacing: <?php echo absint( $primarydesktopSpacing ); ?>px;

            --tmp-container-width  : <?php echo absint($container_width); ?>px;
            --tmp-centered-maxwidth: <?php echo absint($fullwidth_centered); ?>px;

            --tmp-btn-font-size   : <?php echo absint( $btndesktopFontSize ); ?>px;
            --tmp-btn-font-height : <?php echo floatval( $btndesktopHeight ); ?>em;
            --tmp-btn-font-spacing: <?php echo absint( $btndesktopSpacing ); ?>px;
        }

        .main-content-wrapper{
            --tmp-sidebar-width: <?php echo absint($sidebar_width); ?>%;
        }

        aside.widget-area {
            --tmp-widget-spacing: <?php echo absint($widgets_spacing); ?>px;
        }

        .to_top{
            --tmp-scroll-to-top-size: <?php echo absint($scroll_top_size); ?>px;
            --tmp-scroll-to-top-bottom-offset: <?php echo absint($scroll_top_bottom_offset); ?>px;
            --tmp-scroll-to-top-side-offset: <?php echo absint($scroll_top_side_offset); ?>px;
        }

        .site-header .site-branding .site-title {
            font-size     : <?php echo absint( $sitedesktopFontSize ); ?>px;
            line-height   : <?php echo floatval( $sitedesktopHeight ); ?>em;
            letter-spacing: <?php echo absint( $sitedesktopSpacing ); ?>px;
        }

        .elementor-page h1,
        h1{
            font-size   : <?php echo absint( $h1desktopFontSize ); ?>px;
            line-height   : <?php echo floatval( $h1desktopHeight ); ?>em;
            letter-spacing: <?php echo absint( $h1desktopSpacing ); ?>px;
        }

        .elementor-page h2,
        h2{
            font-size   : <?php echo absint( $h2desktopFontSize ); ?>px;
            line-height   : <?php echo floatval( $h2desktopHeight ); ?>em;
            letter-spacing: <?php echo absint( $h2desktopSpacing ); ?>px;
        }

        .elementor-page h3,
        h3{
            font-size   : <?php echo absint( $h3desktopFontSize ); ?>px;
            line-height   : <?php echo floatval( $h3desktopHeight ); ?>em;
            letter-spacing: <?php echo absint( $h3desktopSpacing ); ?>px;
        }

        .elementor-page h4,
        h4{
            font-size   : <?php echo absint( $h4desktopFontSize ); ?>px;
            line-height   : <?php echo floatval( $h4desktopHeight ); ?>em;
            letter-spacing: <?php echo absint( $h4desktopSpacing ); ?>px;
        }

        .elementor-page h5,
        h5{
            font-size   : <?php echo absint( $h5desktopFontSize ); ?>px;
            line-height   : <?php echo floatval( $h5desktopHeight ); ?>em;
            letter-spacing: <?php echo absint( $h5desktopSpacing ); ?>px;
        }

        .elementor-page h6,
        h6{
            font-size   : <?php echo absint( $h6desktopFontSize ); ?>px;
            line-height   : <?php echo floatval( $h6desktopHeight ); ?>em;
            letter-spacing: <?php echo absint( $h6desktopSpacing ); ?>px;
        }
    }

    @media (min-width: 767px) and (max-width: 1024px){
        :root{
            --tmp-primary-font-size: <?php echo absint( $primarytabletFontSize ); ?>px;
            --tmp-primary-font-height: <?php echo floatval( $primarytabletHeight ); ?>em;
            --tmp-primary-font-spacing: <?php echo absint( $primarytabletSpacing ); ?>px;

            --tmp-container-width  : <?php echo absint($tablet_container_width); ?>px;
            --tmp-centered-maxwidth: <?php echo absint($tablet_fullwidth_centered); ?>px;

            --tmp-btn-font-size   : <?php echo absint( $btntabletFontSize ); ?>px;
            --tmp-btn-font-height : <?php echo floatval( $btntabletHeight ); ?>em;
            --tmp-btn-font-spacing: <?php echo absint( $btntabletSpacing ); ?>px;
        }

        .main-content-wrapper{
            --tmp-sidebar-width: <?php echo absint($tablet_sidebar_width); ?>%;
        }

        aside.widget-area {            
            --tmp-widget-spacing: <?php echo absint($tablet_widgets_spacing); ?>px;
        }

        .to_top{
            --tmp-scroll-to-top-size: <?php echo absint($tablet_scroll_top_size); ?>px;
            --tmp-scroll-to-top-bottom-offset: <?php echo absint($tablet_scroll_top_bottom_offset); ?>px;
            --tmp-scroll-to-top-side-offset: <?php echo absint($tablet_scroll_top_side_offset); ?>px;
        }

        .site-branding .site-title {
            font-size   : <?php echo absint( $sitetabletFontSize ); ?>px;
            line-height   : <?php echo floatval( $sitetabletHeight ); ?>em;
            letter-spacing: <?php echo absint( $sitetabletSpacing ); ?>px;
        }

        .site-branding .custom-logo-link img{
			width: <?php echo absint( $tablet_logo_width ); ?>px;
        }

        .elementor-page h1,
        h1{
            font-size   : <?php echo absint( $h1tabletFontSize ); ?>px;
            line-height   : <?php echo floatval( $h1tabletHeight ); ?>em;
            letter-spacing: <?php echo absint( $h1tabletSpacing ); ?>px;
        }

        .elementor-page h2,
        h2{
            font-size   : <?php echo absint( $h2tabletFontSize ); ?>px;
            line-height   : <?php echo floatval( $h2tabletHeight ); ?>em;
            letter-spacing: <?php echo absint( $h2tabletSpacing ); ?>px;
        }

        .elementor-page h3,
        h3{
            font-size   : <?php echo absint( $h3tabletFontSize ); ?>px;
            line-height   : <?php echo floatval( $h3tabletHeight ); ?>em;
            letter-spacing: <?php echo absint( $h3tabletSpacing ); ?>px;
        }

        .elementor-page h4,
        h4{
            font-size   : <?php echo absint( $h4tabletFontSize ); ?>px;
            line-height   : <?php echo floatval( $h4tabletHeight ); ?>em;
            letter-spacing: <?php echo absint( $h4tabletSpacing ); ?>px;
        }

        .elementor-page h5,
        h5{
            font-size   : <?php echo absint( $h5tabletFontSize ); ?>px;
            line-height   : <?php echo floatval( $h5tabletHeight ); ?>em;
            letter-spacing: <?php echo absint( $h5tabletSpacing ); ?>px;
        }

        .elementor-page h6,
        h6{
            font-size   : <?php echo absint( $h6tabletFontSize ); ?>px;
            line-height   : <?php echo floatval( $h6tabletHeight ); ?>em;
            letter-spacing: <?php echo absint( $h6tabletSpacing ); ?>px;
        }
    }

    @media (max-width: 767px){
        :root{
            --tmp-primary-font-size: <?php echo absint( $primarymobileFontSize ); ?>px;
            --tmp-primary-font-height: <?php echo floatval( $primarymobileHeight ); ?>em;
            --tmp-primary-font-spacing: <?php echo absint( $primarymobileSpacing ); ?>px;

            --tmp-container-width  : <?php echo absint($mobile_container_width); ?>px;
            --tmp-centered-maxwidth: <?php echo absint($mobile_fullwidth_centered); ?>px;

            --tmp-btn-font-size   : <?php echo absint( $btnmobileFontSize ); ?>px;
            --tmp-btn-font-height : <?php echo floatval( $btnmobileHeight ); ?>em;
            --tmp-btn-font-spacing: <?php echo absint( $btnmobileSpacing ); ?>px;
        }
        
        aside.widget-area {
            --tmp-widget-spacing: <?php echo absint($mobile_widgets_spacing); ?>px;
        }

        .site-branding .site-title{
            font-size   : <?php echo absint( $sitemobileFontSize ); ?>px;
            line-height   : <?php echo floatval( $sitemobileHeight ); ?>em;
            letter-spacing: <?php echo absint( $sitemobileSpacing ); ?>px;
        }

        .to_top{
            --tmp-scroll-to-top-size: <?php echo absint($mobile_scroll_top_size); ?>px;
            --tmp-scroll-to-top-bottom-offset: <?php echo absint($mobile_scroll_top_bottom_offset); ?>px;
            --tmp-scroll-to-top-side-offset: <?php echo absint($mobile_scroll_top_side_offset); ?>px;
        }

        .site-branding .custom-logo-link img{
            width: <?php echo absint( $mobile_logo_width ); ?>px;
        }

        .elementor-page h1,
        h1{
            font-size   : <?php echo absint( $h1mobileFontSize ); ?>px;
            line-height   : <?php echo floatval( $h1mobileHeight ); ?>em;
            letter-spacing: <?php echo absint( $h1mobileSpacing ); ?>px;
        }

        .elementor-page h2,
        h2{
            font-size   : <?php echo absint( $h2mobileFontSize ); ?>px;
            line-height   : <?php echo floatval( $h2mobileHeight ); ?>em;
            letter-spacing: <?php echo absint( $h2mobileSpacing ); ?>px;
        }

        .elementor-page h3,
        h3{
            font-size   : <?php echo absint( $h3mobileFontSize ); ?>px;
            line-height   : <?php echo floatval( $h3mobileHeight ); ?>em;
            letter-spacing: <?php echo absint( $h3mobileSpacing ); ?>px;
        }

        .elementor-page h4,
        h4{
            font-size   : <?php echo absint( $h4mobileFontSize ); ?>px;
            line-height   : <?php echo floatval( $h4mobileHeight ); ?>em;
            letter-spacing: <?php echo absint( $h4mobileSpacing ); ?>px;
        }

        .elementor-page h5,
        h5{
            font-size   : <?php echo absint( $h5mobileFontSize ); ?>px;
            line-height   : <?php echo floatval( $h5mobileHeight ); ?>em;
            letter-spacing: <?php echo absint( $h5mobileSpacing ); ?>px;
        }

        .elementor-page h6,
        h6{
            font-size   : <?php echo absint( $h6mobileFontSize ); ?>px;
            line-height   : <?php echo floatval( $h6mobileHeight ); ?>em;
            letter-spacing: <?php echo absint( $h6mobileSpacing ); ?>px;
        }
    }

	<?php
	
	$css = ob_get_clean();
	return $css;
}

/**
 * Add SVG to WP Head
 *
 * @return void
 */
function travel_monster_dynamic_other_css(){
    echo "<style id='travel-monster-dynamic-css' type='text/css' media='all'>"; ?>
        .comments-area ol.comment-list li .comment-body .text-holder .reply a:before {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 11H18C19.1046 11 20 11.8954 20 13V17' stroke='%23E48E45' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M8 7L4 11L8 15' stroke='%23E48E45' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M4 11H18C19.1046 11 20 11.8954 20 13V17' stroke='%23E48E45' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M8 7L4 11L8 15' stroke='%23E48E45' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E%0A");
        }
        .comments-area ol.comment-list li.bypostauthor .comment-author:after {
            -webkit-mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2300AB0B' viewBox='0 0 512 512'%3E%3Cpath d='M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2300AB0B' viewBox='0 0 512 512'%3E%3Cpath d='M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z'/%3E%3C/svg%3E");
        }
        .wp-block-read-more:after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
        }
        blockquote::before,
        .wp-block-quote::before {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='112' height='112' viewBox='0 0 112 112' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30.3333 46.6666C29.2927 46.6666 28.294 46.8253 27.3 46.97C27.622 45.8873 27.9533 44.786 28.4853 43.7966C29.0173 42.3593 29.848 41.1133 30.674 39.858C31.3647 38.5 32.5827 37.5806 33.4787 36.4186C34.4167 35.2893 35.6953 34.538 36.708 33.6C37.702 32.62 39.004 32.13 40.04 31.4393C41.1227 30.8186 42.0653 30.1326 43.0733 29.806L45.5887 28.77L47.8007 27.8506L45.5373 18.8066L42.7513 19.4786C41.86 19.7026 40.7727 19.964 39.536 20.2766C38.2713 20.51 36.9227 21.1493 35.42 21.7326C33.936 22.3953 32.2187 22.8433 30.6227 23.9073C29.0173 24.9246 27.1647 25.774 25.5313 27.1366C23.9493 28.5413 22.0407 29.7593 20.6313 31.5466C19.0913 33.2173 17.57 34.972 16.3893 36.9693C15.022 38.8733 14.0933 40.964 13.1133 43.0313C12.2267 45.0986 11.5127 47.2126 10.9293 49.266C9.82334 53.382 9.32867 57.2926 9.13734 60.6386C8.97867 63.9893 9.07201 66.7753 9.26801 68.7913C9.33801 69.7433 9.46867 70.6673 9.56201 71.3066L9.67867 72.0906L9.80001 72.0626C10.63 75.9398 12.5408 79.5028 15.3112 82.3395C18.0816 85.1761 21.5985 87.1705 25.455 88.0918C29.3115 89.0132 33.3501 88.8239 37.1035 87.5459C40.857 86.2678 44.1719 83.9533 46.6648 80.87C49.1578 77.7866 50.7269 74.0605 51.1906 70.1227C51.6544 66.1848 50.9938 62.1962 49.2853 58.6181C47.5768 55.04 44.8902 52.0187 41.5364 49.9037C38.1825 47.7887 34.2984 46.6664 30.3333 46.6666V46.6666ZM81.6667 46.6666C80.626 46.6666 79.6273 46.8253 78.6333 46.97C78.9553 45.8873 79.2867 44.786 79.8187 43.7966C80.3507 42.3593 81.1813 41.1133 82.0073 39.858C82.698 38.5 83.916 37.5806 84.812 36.4186C85.75 35.2893 87.0287 34.538 88.0413 33.6C89.0353 32.62 90.3373 32.13 91.3733 31.4393C92.456 30.8186 93.3987 30.1326 94.4067 29.806L96.922 28.77L99.134 27.8506L96.8707 18.8066L94.0847 19.4786C93.1933 19.7026 92.106 19.964 90.8693 20.2766C89.6047 20.51 88.256 21.1493 86.7533 21.7326C85.274 22.4 83.552 22.8433 81.956 23.912C80.3507 24.9293 78.498 25.7786 76.8647 27.1413C75.2827 28.546 73.374 29.764 71.9647 31.5466C70.4247 33.2173 68.9033 34.972 67.7227 36.9693C66.3553 38.8733 65.4267 40.964 64.4467 43.0313C63.56 45.0986 62.846 47.2126 62.2627 49.266C61.1567 53.382 60.662 57.2926 60.4707 60.6386C60.312 63.9893 60.4053 66.7753 60.6013 68.7913C60.6713 69.7433 60.802 70.6673 60.8953 71.3066L61.012 72.0906L61.1333 72.0626C61.9634 75.9398 63.8741 79.5028 66.6445 82.3395C69.4149 85.1761 72.9318 87.1705 76.7883 88.0918C80.6448 89.0132 84.6834 88.8239 88.4369 87.5459C92.1903 86.2678 95.5052 83.9533 97.9982 80.87C100.491 77.7866 102.06 74.0605 102.524 70.1227C102.988 66.1848 102.327 62.1962 100.619 58.6181C98.9101 55.04 96.2236 52.0187 92.8697 49.9037C89.5158 47.7887 85.6317 46.6664 81.6667 46.6666V46.6666Z' fill='%232355D3' fill-opacity='0.1'/%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg width='112' height='112' viewBox='0 0 112 112' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30.3333 46.6666C29.2927 46.6666 28.294 46.8253 27.3 46.97C27.622 45.8873 27.9533 44.786 28.4853 43.7966C29.0173 42.3593 29.848 41.1133 30.674 39.858C31.3647 38.5 32.5827 37.5806 33.4787 36.4186C34.4167 35.2893 35.6953 34.538 36.708 33.6C37.702 32.62 39.004 32.13 40.04 31.4393C41.1227 30.8186 42.0653 30.1326 43.0733 29.806L45.5887 28.77L47.8007 27.8506L45.5373 18.8066L42.7513 19.4786C41.86 19.7026 40.7727 19.964 39.536 20.2766C38.2713 20.51 36.9227 21.1493 35.42 21.7326C33.936 22.3953 32.2187 22.8433 30.6227 23.9073C29.0173 24.9246 27.1647 25.774 25.5313 27.1366C23.9493 28.5413 22.0407 29.7593 20.6313 31.5466C19.0913 33.2173 17.57 34.972 16.3893 36.9693C15.022 38.8733 14.0933 40.964 13.1133 43.0313C12.2267 45.0986 11.5127 47.2126 10.9293 49.266C9.82334 53.382 9.32867 57.2926 9.13734 60.6386C8.97867 63.9893 9.07201 66.7753 9.26801 68.7913C9.33801 69.7433 9.46867 70.6673 9.56201 71.3066L9.67867 72.0906L9.80001 72.0626C10.63 75.9398 12.5408 79.5028 15.3112 82.3395C18.0816 85.1761 21.5985 87.1705 25.455 88.0918C29.3115 89.0132 33.3501 88.8239 37.1035 87.5459C40.857 86.2678 44.1719 83.9533 46.6648 80.87C49.1578 77.7866 50.7269 74.0605 51.1906 70.1227C51.6544 66.1848 50.9938 62.1962 49.2853 58.6181C47.5768 55.04 44.8902 52.0187 41.5364 49.9037C38.1825 47.7887 34.2984 46.6664 30.3333 46.6666V46.6666ZM81.6667 46.6666C80.626 46.6666 79.6273 46.8253 78.6333 46.97C78.9553 45.8873 79.2867 44.786 79.8187 43.7966C80.3507 42.3593 81.1813 41.1133 82.0073 39.858C82.698 38.5 83.916 37.5806 84.812 36.4186C85.75 35.2893 87.0287 34.538 88.0413 33.6C89.0353 32.62 90.3373 32.13 91.3733 31.4393C92.456 30.8186 93.3987 30.1326 94.4067 29.806L96.922 28.77L99.134 27.8506L96.8707 18.8066L94.0847 19.4786C93.1933 19.7026 92.106 19.964 90.8693 20.2766C89.6047 20.51 88.256 21.1493 86.7533 21.7326C85.274 22.4 83.552 22.8433 81.956 23.912C80.3507 24.9293 78.498 25.7786 76.8647 27.1413C75.2827 28.546 73.374 29.764 71.9647 31.5466C70.4247 33.2173 68.9033 34.972 67.7227 36.9693C66.3553 38.8733 65.4267 40.964 64.4467 43.0313C63.56 45.0986 62.846 47.2126 62.2627 49.266C61.1567 53.382 60.662 57.2926 60.4707 60.6386C60.312 63.9893 60.4053 66.7753 60.6013 68.7913C60.6713 69.7433 60.802 70.6673 60.8953 71.3066L61.012 72.0906L61.1333 72.0626C61.9634 75.9398 63.8741 79.5028 66.6445 82.3395C69.4149 85.1761 72.9318 87.1705 76.7883 88.0918C80.6448 89.0132 84.6834 88.8239 88.4369 87.5459C92.1903 86.2678 95.5052 83.9533 97.9982 80.87C100.491 77.7866 102.06 74.0605 102.524 70.1227C102.988 66.1848 102.327 62.1962 100.619 58.6181C98.9101 55.04 96.2236 52.0187 92.8697 49.9037C89.5158 47.7887 85.6317 46.6664 81.6667 46.6666V46.6666Z' fill='%232355D3' fill-opacity='0.1'/%3E%3C/svg%3E%0A");
        }

        .header-layout-1 .contact-email-wrap a::before,
        .header-layout-3 .contact-email-wrap a::before,
        .header-layout-5 .contact-email-wrap a::before {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='15' height='13' viewBox='0 0 15 13' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7.9032 7.04984C7.78316 7.13784 7.64157 7.18179 7.50002 7.18179C7.35839 7.18179 7.21684 7.13784 7.0968 7.04984L1.36363 2.84553L4.54544e-05 1.84558L0 11.5C4.54544e-05 11.8765 0.305272 12.1818 0.681816 12.1818L14.3182 12.1818C14.6948 12.1818 15 11.8765 15 11.5V1.84554L13.6363 2.84553L7.9032 7.04984Z' fill='%23454545'/%3E%3Cpath d='M7.50003 5.65452L14.0948 0.818222L0.905045 0.818176L7.50003 5.65452Z' fill='%23454545'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml,%3Csvg width='15' height='13' viewBox='0 0 15 13' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7.9032 7.04984C7.78316 7.13784 7.64157 7.18179 7.50002 7.18179C7.35839 7.18179 7.21684 7.13784 7.0968 7.04984L1.36363 2.84553L4.54544e-05 1.84558L0 11.5C4.54544e-05 11.8765 0.305272 12.1818 0.681816 12.1818L14.3182 12.1818C14.6948 12.1818 15 11.8765 15 11.5V1.84554L13.6363 2.84553L7.9032 7.04984Z' fill='%23454545'/%3E%3Cpath d='M7.50003 5.65452L14.0948 0.818222L0.905045 0.818176L7.50003 5.65452Z' fill='%23454545'/%3E%3C/svg%3E");
        }

        .header-layout-1 .contact-phone-wrap a::before,
        .header-layout-3 .contact-phone-wrap a::before,
        .header-layout-5 .contact-phone-wrap a::before {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='13' height='12' viewBox='0 0 13 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.61806 4.78724C3.65806 6.52528 5.33 7.94702 7.3775 8.83139L8.96639 7.4772C9.165 7.30831 9.45028 7.25918 9.69944 7.32673C10.5083 7.55397 11.3786 7.6768 12.2778 7.6768C12.6786 7.6768 13 7.95009 13 8.29094V10.4404C13 10.7813 12.6786 11.0546 12.2778 11.0546C5.49611 11.0546 0 6.38095 0 0.61413C0 0.273279 0.325 -1.52588e-05 0.722222 -1.52588e-05H3.25C3.65083 -1.52588e-05 3.97222 0.273279 3.97222 0.61413C3.97222 1.37874 4.11667 2.11879 4.38389 2.80663C4.46333 3.01851 4.40556 3.26109 4.20694 3.42998L2.61806 4.78724Z' fill='%23454545'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml,%3Csvg width='13' height='12' viewBox='0 0 13 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.61806 4.78724C3.65806 6.52528 5.33 7.94702 7.3775 8.83139L8.96639 7.4772C9.165 7.30831 9.45028 7.25918 9.69944 7.32673C10.5083 7.55397 11.3786 7.6768 12.2778 7.6768C12.6786 7.6768 13 7.95009 13 8.29094V10.4404C13 10.7813 12.6786 11.0546 12.2778 11.0546C5.49611 11.0546 0 6.38095 0 0.61413C0 0.273279 0.325 -1.52588e-05 0.722222 -1.52588e-05H3.25C3.65083 -1.52588e-05 3.97222 0.273279 3.97222 0.61413C3.97222 1.37874 4.11667 2.11879 4.38389 2.80663C4.46333 3.01851 4.40556 3.26109 4.20694 3.42998L2.61806 4.78724Z' fill='%23454545'/%3E%3C/svg%3E");
        }

        .header-t-currnc #wte-cc-currency-list-container .wte-cc-currency-list-display::after,
        body.wpte-cc-sticky-converter .header-t-currnc #wte-cc-currency-list-container .wte-cc-currency-list-display::after {
            -webkit-mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23FFFFFF' viewBox='0 0 320 512'%3E%3Cpath d='M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23FFFFFF' viewBox='0 0 320 512'%3E%3Cpath d='M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z'/%3E%3C/svg%3E");
        }

        .language-dropdown ul li.pll-parent-menu-item > a:after {
            -webkit-mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23FFFFFF' viewBox='0 0 320 512'%3E%3Cpath d='M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23FFFFFF' viewBox='0 0 320 512'%3E%3Cpath d='M31.3 192h257.3c17.8 0 26.7 21.5 14.1 34.1L174.1 354.8c-7.8 7.8-20.5 7.8-28.3 0L17.2 226.1C4.6 213.5 13.5 192 31.3 192z'/%3E%3C/svg%3E");
        }

        header .search-toggle-form input[type=submit] {
            -webkit-mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2300b98b' viewBox='0 0 512 512'%3E%3Cpath d='M508.5 468.9L387.1 347.5c-2.3-2.3-5.3-3.5-8.5-3.5h-13.2c31.5-36.5 50.6-84 50.6-136C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c52 0 99.5-19.1 136-50.6v13.2c0 3.2 1.3 6.2 3.5 8.5l121.4 121.4c4.7 4.7 12.3 4.7 17 0l22.6-22.6c4.7-4.7 4.7-12.3 0-17zM208 368c-88.4 0-160-71.6-160-160S119.6 48 208 48s160 71.6 160 160-71.6 160-160 160z'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2300b98b' viewBox='0 0 512 512'%3E%3Cpath d='M508.5 468.9L387.1 347.5c-2.3-2.3-5.3-3.5-8.5-3.5h-13.2c31.5-36.5 50.6-84 50.6-136C416 93.1 322.9 0 208 0S0 93.1 0 208s93.1 208 208 208c52 0 99.5-19.1 136-50.6v13.2c0 3.2 1.3 6.2 3.5 8.5l121.4 121.4c4.7 4.7 12.3 4.7 17 0l22.6-22.6c4.7-4.7 4.7-12.3 0-17zM208 368c-88.4 0-160-71.6-160-160S119.6 48 208 48s160 71.6 160 160-71.6 160-160 160z'/%3E%3C/svg%3E");
        }

        header .search-toggle-form .btn-form-close:before {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20.395' height='20.395' viewBox='0 0 20.395 20.395'%3E%3Cg id='Group_2043' data-name='Group 2043' transform='translate(-1270.493 -68.493)' opacity='0.6'%3E%3Cg id='Group_2042' data-name='Group 2042' transform='translate(1270.847 68.847)'%3E%3Cpath id='Path_23706' data-name='Path 23706' d='M0,0V27.841' transform='translate(19.687 0.001) rotate(45)' fill='none' stroke='%23B4B4B4' stroke-width='1'/%3E%3Cpath id='Path_23707' data-name='Path 23707' d='M0,27.842V0' transform='translate(19.688 19.687) rotate(135)' fill='none' stroke='%23B4B4B4' stroke-width='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20.395' height='20.395' viewBox='0 0 20.395 20.395'%3E%3Cg id='Group_2043' data-name='Group 2043' transform='translate(-1270.493 -68.493)' opacity='0.6'%3E%3Cg id='Group_2042' data-name='Group 2042' transform='translate(1270.847 68.847)'%3E%3Cpath id='Path_23706' data-name='Path 23706' d='M0,0V27.841' transform='translate(19.687 0.001) rotate(45)' fill='none' stroke='%23B4B4B4' stroke-width='1'/%3E%3Cpath id='Path_23707' data-name='Path 23707' d='M0,27.842V0' transform='translate(19.688 19.687) rotate(135)' fill='none' stroke='%23B4B4B4' stroke-width='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E%0A");
        }

        .primary-navigation ul > li.menu-item-has-children > a::after, .primary-navigation ul > li.mega-menu-item::after,
        .secondary-navigation ul > li.menu-item-has-children > a::after,
        .secondary-navigation ul > li.mega-menu-item::after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='12' height='6' viewBox='0 0 12 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.978478 0.313439C1.15599 0.135928 1.43376 0.11979 1.62951 0.265027L1.68558 0.313439L5.9987 4.62632L10.3118 0.313439C10.4893 0.135928 10.7671 0.11979 10.9628 0.265027L11.0189 0.313439C11.1964 0.49095 11.2126 0.768726 11.0673 0.964466L11.0189 1.02055L6.35225 5.68721C6.17474 5.86472 5.89697 5.88086 5.70122 5.73562L5.64514 5.68721L0.978478 1.02055C0.783216 0.825283 0.783216 0.508701 0.978478 0.313439Z' fill='currentColor'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml,%3Csvg width='12' height='6' viewBox='0 0 12 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.978478 0.313439C1.15599 0.135928 1.43376 0.11979 1.62951 0.265027L1.68558 0.313439L5.9987 4.62632L10.3118 0.313439C10.4893 0.135928 10.7671 0.11979 10.9628 0.265027L11.0189 0.313439C11.1964 0.49095 11.2126 0.768726 11.0673 0.964466L11.0189 1.02055L6.35225 5.68721C6.17474 5.86472 5.89697 5.88086 5.70122 5.73562L5.64514 5.68721L0.978478 1.02055C0.783216 0.825283 0.783216 0.508701 0.978478 0.313439Z' fill='currentColor'/%3E%3C/svg%3E");
        }

        .mobile-header .primary-navigation ul.primary-menu-wrapper .arrow-down::after,
        .mobile-header .secondary-navigation ul.secondary-menu-wrapper .arrow-down::after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='12' height='6' viewBox='0 0 12 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.978478 0.313439C1.15599 0.135928 1.43376 0.11979 1.62951 0.265027L1.68558 0.313439L5.9987 4.62632L10.3118 0.313439C10.4893 0.135928 10.7671 0.11979 10.9628 0.265027L11.0189 0.313439C11.1964 0.49095 11.2126 0.768726 11.0673 0.964466L11.0189 1.02055L6.35225 5.68721C6.17474 5.86472 5.89697 5.88086 5.70122 5.73562L5.64514 5.68721L0.978478 1.02055C0.783216 0.825283 0.783216 0.508701 0.978478 0.313439Z' fill='currentColor'/%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml,%3Csvg width='12' height='6' viewBox='0 0 12 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0.978478 0.313439C1.15599 0.135928 1.43376 0.11979 1.62951 0.265027L1.68558 0.313439L5.9987 4.62632L10.3118 0.313439C10.4893 0.135928 10.7671 0.11979 10.9628 0.265027L11.0189 0.313439C11.1964 0.49095 11.2126 0.768726 11.0673 0.964466L11.0189 1.02055L6.35225 5.68721C6.17474 5.86472 5.89697 5.88086 5.70122 5.73562L5.64514 5.68721L0.978478 1.02055C0.783216 0.825283 0.783216 0.508701 0.978478 0.313439Z' fill='currentColor'/%3E%3C/svg%3E");
        }

        .pagination .nav-links .prev::after, .pagination .nav-links .prev::before,
        .pagination .nav-links .next::after,
        .pagination .nav-links .next::before,
        .pagination .nav-links .nav-previous::after,
        .pagination .nav-links .nav-previous::before,
        .pagination .nav-links .nav-next::after,
        .pagination .nav-links .nav-next::before,
        .posts-navigation .nav-links .prev::after,
        .posts-navigation .nav-links .prev::before,
        .posts-navigation .nav-links .next::after,
        .posts-navigation .nav-links .next::before,
        .posts-navigation .nav-links .nav-previous::after,
        .posts-navigation .nav-links .nav-previous::before,
        .posts-navigation .nav-links .nav-next::after,
        .posts-navigation .nav-links .nav-next::before {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9px' height='9px' viewBox='0 0 15 15'%3E%3Cpath class='st0' d='M4.1,15c0.2,0,0.4-0.1,0.6-0.2L11.4,8c0.3-0.3,0.3-0.8,0-1.1L4.8,0.2C4.5-0.1,4-0.1,3.7,0.2C3.4,0.5,3.4,1,3.7,1.3l6.1,6.1l-6.2,6.2c-0.3,0.3-0.3,0.8,0,1.1C3.7,14.9,3.9,15,4.1,15z'%3E%3C/path%3E%3C/svg%3E");
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9px' height='9px' viewBox='0 0 15 15'%3E%3Cpath class='st0' d='M4.1,15c0.2,0,0.4-0.1,0.6-0.2L11.4,8c0.3-0.3,0.3-0.8,0-1.1L4.8,0.2C4.5-0.1,4-0.1,3.7,0.2C3.4,0.5,3.4,1,3.7,1.3l6.1,6.1l-6.2,6.2c-0.3,0.3-0.3,0.8,0,1.1C3.7,14.9,3.9,15,4.1,15z'%3E%3C/path%3E%3C/svg%3E");
        }

        .post-navigation .nav-previous .meta-nav a::before, .post-navigation .nav-previous .meta-nav a::after,
        .post-navigation .nav-next .meta-nav a::before,
        .post-navigation .nav-next .meta-nav a::after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
        }

        .site-footer .footer-b .payments-showcase span::before {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='25' height='29' viewBox='0 0 25 29' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24.6603 3.93835C24.61 3.57554 24.3502 3.27709 23.9991 3.179L12.7452 0.033658C12.5848 -0.0112193 12.4153 -0.0112193 12.2548 0.033658L1.00089 3.179C0.649753 3.27709 0.390001 3.57541 0.339734 3.93835C0.274461 4.41006 -1.21463 15.5553 2.60478 21.0998C6.41968 26.6376 12.0475 28.0567 12.2851 28.1145C12.3558 28.1317 12.4278 28.1401 12.5 28.1401C12.5722 28.1401 12.6442 28.1315 12.7149 28.1145C12.9526 28.0567 18.5804 26.6376 22.3952 21.0998C26.2146 15.5555 24.7255 4.41018 24.6603 3.93835ZM19.7573 10.4451L12.081 18.1597C11.9024 18.3392 11.6682 18.4291 11.434 18.4291C11.1999 18.4291 10.9656 18.3393 10.787 18.1597L6.04085 13.3898C5.86919 13.2174 5.77281 12.9835 5.77281 12.7396C5.77281 12.4957 5.86931 12.2618 6.04085 12.0894L6.98323 11.1423C7.34059 10.7833 7.92 10.7831 8.27723 11.1423L11.434 14.3148L17.5209 8.19741C17.6925 8.02489 17.9253 7.92802 18.1679 7.92802C18.4106 7.92802 18.6434 8.02489 18.8149 8.19741L19.7573 9.1445C20.1147 9.50364 20.1147 10.0859 19.7573 10.4451Z' fill='%2328B558'/%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg width='25' height='29' viewBox='0 0 25 29' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24.6603 3.93835C24.61 3.57554 24.3502 3.27709 23.9991 3.179L12.7452 0.033658C12.5848 -0.0112193 12.4153 -0.0112193 12.2548 0.033658L1.00089 3.179C0.649753 3.27709 0.390001 3.57541 0.339734 3.93835C0.274461 4.41006 -1.21463 15.5553 2.60478 21.0998C6.41968 26.6376 12.0475 28.0567 12.2851 28.1145C12.3558 28.1317 12.4278 28.1401 12.5 28.1401C12.5722 28.1401 12.6442 28.1315 12.7149 28.1145C12.9526 28.0567 18.5804 26.6376 22.3952 21.0998C26.2146 15.5555 24.7255 4.41018 24.6603 3.93835ZM19.7573 10.4451L12.081 18.1597C11.9024 18.3392 11.6682 18.4291 11.434 18.4291C11.1999 18.4291 10.9656 18.3393 10.787 18.1597L6.04085 13.3898C5.86919 13.2174 5.77281 12.9835 5.77281 12.7396C5.77281 12.4957 5.86931 12.2618 6.04085 12.0894L6.98323 11.1423C7.34059 10.7833 7.92 10.7831 8.27723 11.1423L11.434 14.3148L17.5209 8.19741C17.6925 8.02489 17.9253 7.92802 18.1679 7.92802C18.4106 7.92802 18.6434 8.02489 18.8149 8.19741L19.7573 9.1445C20.1147 9.50364 20.1147 10.0859 19.7573 10.4451Z' fill='%2328B558'/%3E%3C/svg%3E%0A");
        }
        .blog .readmore-btn-wrap a:after,
        .archive .readmore-btn-wrap a:after,
        .search .readmore-btn-wrap a:after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
        }

        .author-wrapper .view-all-auth:after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='17.867' height='8.733' viewBox='0 0 17.867 8.733'%3E%3Cg id='Group_5838' data-name='Group 5838' transform='translate(14.75 -1.999)'%3E%3Cpath id='Path_4' data-name='Path 4' d='M3290.464,377.064l4.366-4.367-4.366-4.367Z' transform='translate(-3291.713 -366.333)' fill='%235081f5'/%3E%3Cline id='Line_5' data-name='Line 5' x2='14.523' transform='translate(-14 6.499)' fill='none' stroke='%235081f5' stroke-linecap='round' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E%0A");
        }

        .error404 .error-content .btn-readmore:after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M14 6L20 12L14 18' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M14 6L20 12L14 18' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E%0A");
        }
        .wpte-bf-outer .wpte-bf-booking-steps .wpte-bf-step-content-wrap .wpte-bf-checkout-form .wpte-bf-submit input:after {
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M14 6L20 12L14 18' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E%0A");
            mask-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='4' y1='12' x2='20' y2='12' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M14 6L20 12L14 18' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E%0A");
        }

    <?php echo "</style>";
}
add_action( 'wp_head', 'travel_monster_dynamic_other_css', 99 );

/**
* Function for sanitizing Hex color 
*/
function travel_monster_sanitize_hex_color( $color ){
    if ( '' === $color )
        return '';

// 3 or 6 hex digits, or the empty string.
    if ( preg_match('|^#([A-Fa-f0-9]{3}){1,2}$|', $color ) )
        return $color;
}

/**
 * convert hex to rgb
 * @link http://bavotasan.com/2011/convert-hex-color-to-rgb-using-php/
*/
function travel_monster_hex2rgb($hex) {
    if(empty($hex)) {
        return array(0, 0, 0);
    }

    if($hex[0] === '#' ){
        $hex = str_replace("#", "", $hex);

        if(strlen($hex) == 3) {
            $r = hexdec(substr($hex,0,1).substr($hex,0,1));
            $g = hexdec(substr($hex,1,1).substr($hex,1,1));
            $b = hexdec(substr($hex,2,1).substr($hex,2,1));
        } else {
            $r = hexdec(substr($hex,0,2));
            $g = hexdec(substr($hex,2,2));
            $b = hexdec(substr($hex,4,2));
        }
        $rgb = array($r, $g, $b);
        return $rgb;
    } else {
        $hex = str_replace("rgba(", "", $hex);
        $hex = str_replace(")", "", $hex);
        $rgb = explode(",", $hex );
        $opacity = array_pop($rgb); //removing opacity value from rgba

        return $rgb;
    }
}
/**
 * Convert '#' to '%23'
*/
function travel_monster_hash_to_percent23( $color_code ){
    $color_code = str_replace( "#", "%23", $color_code );
    return $color_code;
}


if ( ! function_exists( 'travel_monster_gutenberg_inline_style' ) ) : 
    /**
     * Gutenberg Dynamic Style
     */
    function travel_monster_gutenberg_inline_style(){
        
        $typo_defaults   = travel_monster_get_typography_defaults();
        $defaults        = travel_monster_get_color_defaults();
        $button_defaults = travel_monster_get_button_defaults();
        
        $primary_font   = wp_parse_args( get_theme_mod( 'primary_font' ), $typo_defaults['primary_font'] );
        $button         = wp_parse_args( get_theme_mod( 'button' ), $typo_defaults['button'] );

        $primary_font_family = travel_monster_get_font_family( $primary_font );
        $btn_font_family     = travel_monster_get_font_family( $button );
        $heading_one         = wp_parse_args( get_theme_mod( 'heading_one' ), $typo_defaults['heading_one'] );
        $heading_two         = wp_parse_args( get_theme_mod( 'heading_two' ), $typo_defaults['heading_two'] );
        $heading_three       = wp_parse_args( get_theme_mod( 'heading_three' ), $typo_defaults['heading_three'] );
        $heading_four        = wp_parse_args( get_theme_mod( 'heading_four' ), $typo_defaults['heading_four'] );
        $heading_five        = wp_parse_args( get_theme_mod( 'heading_five' ), $typo_defaults['heading_five'] );
        $heading_six         = wp_parse_args( get_theme_mod( 'heading_six' ), $typo_defaults['heading_six'] );

        $heading_one_font_family   = travel_monster_get_font_family( $heading_one );
        $heading_two_font_family   = travel_monster_get_font_family( $heading_two );
        $heading_three_font_family = travel_monster_get_font_family( $heading_three );
        $heading_four_font_family  = travel_monster_get_font_family( $heading_four );
        $heading_five_font_family  = travel_monster_get_font_family( $heading_five );
        $heading_six_font_family   = travel_monster_get_font_family( $heading_six );

        $btnFontFamily = $btn_font_family === '"Default Family"' ? 'inherit' : $btn_font_family;
        $h1FontFamily   = $heading_one_font_family === '"Default Family"' ? 'inherit' : $heading_one_font_family;
        $h2FontFamily   = $heading_two_font_family === '"Default Family"' ? 'inherit' : $heading_two_font_family;
        $h3FontFamily   = $heading_three_font_family === '"Default Family"' ? 'inherit' : $heading_three_font_family;
        $h4FontFamily   = $heading_four_font_family === '"Default Family"' ? 'inherit' : $heading_four_font_family;
        $h5FontFamily   = $heading_five_font_family === '"Default Family"' ? 'inherit' : $heading_five_font_family;
        $h6FontFamily   = $heading_six_font_family === '"Default Family"' ? 'inherit' : $heading_six_font_family;

        //Heading 1 variables
        $h1desktopFontSize = isset(  $heading_one['desktop']['font_size'] ) ? $heading_one['desktop']['font_size'] : $typo_defaults['heading_one']['desktop']['font_size'];
        $h1desktopSpacing  = isset(  $heading_one['desktop']['letter_spacing'] ) ? $heading_one['desktop']['letter_spacing'] : $typo_defaults['heading_one']['desktop']['letter_spacing'];
        $h1desktopHeight   = isset(  $heading_one['desktop']['line_height'] ) ? $heading_one['desktop']['line_height'] : $typo_defaults['heading_one']['desktop']['line_height'];
        $h1tabletFontSize  = isset(  $heading_one['tablet']['font_size'] ) ? $heading_one['tablet']['font_size'] : $typo_defaults['heading_one']['tablet']['font_size'];
        $h1tabletSpacing   = isset(  $heading_one['tablet']['letter_spacing'] ) ? $heading_one['tablet']['letter_spacing'] : $typo_defaults['heading_one']['tablet']['letter_spacing'];
        $h1tabletHeight    = isset(  $heading_one['tablet']['line_height'] ) ? $heading_one['tablet']['line_height'] : $typo_defaults['heading_one']['tablet']['line_height'];
        $h1mobileFontSize  = isset(  $heading_one['mobile']['font_size'] ) ? $heading_one['mobile']['font_size'] : $typo_defaults['heading_one']['mobile']['font_size'];
        $h1mobileSpacing   = isset(  $heading_one['mobile']['letter_spacing'] ) ? $heading_one['mobile']['letter_spacing'] : $typo_defaults['heading_one']['mobile']['letter_spacing'];
        $h1mobileHeight    = isset(  $heading_one['mobile']['line_height'] ) ? $heading_one['mobile']['line_height'] : $typo_defaults['heading_one']['mobile']['line_height'];
        
        //Heading 2 variables
        $h2desktopFontSize = isset(  $heading_two['desktop']['font_size'] ) ? $heading_two['desktop']['font_size'] : $typo_defaults['heading_two']['desktop']['font_size'];
        $h2desktopSpacing  = isset(  $heading_two['desktop']['letter_spacing'] ) ? $heading_two['desktop']['letter_spacing'] : $typo_defaults['heading_two']['desktop']['letter_spacing'];
        $h2desktopHeight   = isset(  $heading_two['desktop']['line_height'] ) ? $heading_two['desktop']['line_height'] : $typo_defaults['heading_two']['desktop']['line_height'];
        $h2tabletFontSize  = isset(  $heading_two['tablet']['font_size'] ) ? $heading_two['tablet']['font_size'] : $typo_defaults['heading_two']['tablet']['font_size'];
        $h2tabletSpacing   = isset(  $heading_two['tablet']['letter_spacing'] ) ? $heading_two['tablet']['letter_spacing'] : $typo_defaults['heading_two']['tablet']['letter_spacing'];
        $h2tabletHeight    = isset(  $heading_two['tablet']['line_height'] ) ? $heading_two['tablet']['line_height'] : $typo_defaults['heading_two']['tablet']['line_height'];
        $h2mobileFontSize  = isset(  $heading_two['mobile']['font_size'] ) ? $heading_two['mobile']['font_size'] : $typo_defaults['heading_two']['mobile']['font_size'];
        $h2mobileSpacing   = isset(  $heading_two['mobile']['letter_spacing'] ) ? $heading_two['mobile']['letter_spacing'] : $typo_defaults['heading_two']['mobile']['letter_spacing'];
        $h2mobileHeight    = isset(  $heading_two['mobile']['line_height'] ) ? $heading_two['mobile']['line_height'] : $typo_defaults['heading_two']['mobile']['line_height'];
        
        //Heading 3 variables
        $h3desktopFontSize = isset(  $heading_three['desktop']['font_size'] ) ? $heading_three['desktop']['font_size'] : $typo_defaults['heading_three']['desktop']['font_size'];
        $h3desktopSpacing  = isset(  $heading_three['desktop']['letter_spacing'] ) ? $heading_three['desktop']['letter_spacing'] : $typo_defaults['heading_three']['desktop']['letter_spacing'];
        $h3desktopHeight   = isset(  $heading_three['desktop']['line_height'] ) ? $heading_three['desktop']['line_height'] : $typo_defaults['heading_three']['desktop']['line_height'];
        $h3tabletFontSize  = isset(  $heading_three['tablet']['font_size'] ) ? $heading_three['tablet']['font_size'] : $typo_defaults['heading_three']['tablet']['font_size'];
        $h3tabletSpacing   = isset(  $heading_three['tablet']['letter_spacing'] ) ? $heading_three['tablet']['letter_spacing'] : $typo_defaults['heading_three']['tablet']['letter_spacing'];
        $h3tabletHeight    = isset(  $heading_three['tablet']['line_height'] ) ? $heading_three['tablet']['line_height'] : $typo_defaults['heading_three']['tablet']['line_height'];
        $h3mobileFontSize  = isset(  $heading_three['mobile']['font_size'] ) ? $heading_three['mobile']['font_size'] : $typo_defaults['heading_three']['mobile']['font_size'];
        $h3mobileSpacing   = isset(  $heading_three['mobile']['letter_spacing'] ) ? $heading_three['mobile']['letter_spacing'] : $typo_defaults['heading_three']['mobile']['letter_spacing'];
        $h3mobileHeight    = isset(  $heading_three['mobile']['line_height'] ) ? $heading_three['mobile']['line_height'] : $typo_defaults['heading_three']['mobile']['line_height'];
        
        //Heading 4 variables
        $h4desktopFontSize = isset(  $heading_four['desktop']['font_size'] ) ? $heading_four['desktop']['font_size'] : $typo_defaults['heading_four']['desktop']['font_size'];
        $h4desktopSpacing  = isset(  $heading_four['desktop']['letter_spacing'] ) ? $heading_four['desktop']['letter_spacing'] : $typo_defaults['heading_four']['desktop']['letter_spacing'];
        $h4desktopHeight   = isset(  $heading_four['desktop']['line_height'] ) ? $heading_four['desktop']['line_height'] : $typo_defaults['heading_four']['desktop']['line_height'];
        $h4tabletFontSize  = isset(  $heading_four['tablet']['font_size'] ) ? $heading_four['tablet']['font_size'] : $typo_defaults['heading_four']['tablet']['font_size'];
        $h4tabletSpacing   = isset(  $heading_four['tablet']['letter_spacing'] ) ? $heading_four['tablet']['letter_spacing'] : $typo_defaults['heading_four']['tablet']['letter_spacing'];
        $h4tabletHeight    = isset(  $heading_four['tablet']['line_height'] ) ? $heading_four['tablet']['line_height'] : $typo_defaults['heading_four']['tablet']['line_height'];
        $h4mobileFontSize  = isset(  $heading_four['mobile']['font_size'] ) ? $heading_four['mobile']['font_size'] : $typo_defaults['heading_four']['mobile']['font_size'];
        $h4mobileSpacing   = isset(  $heading_four['mobile']['letter_spacing'] ) ? $heading_four['mobile']['letter_spacing'] : $typo_defaults['heading_four']['mobile']['letter_spacing'];
        $h4mobileHeight    = isset(  $heading_four['mobile']['line_height'] ) ? $heading_four['mobile']['line_height'] : $typo_defaults['heading_four']['mobile']['line_height'];
        
        //Heading 5 variables
        $h5desktopFontSize = isset(  $heading_five['desktop']['font_size'] ) ? $heading_five['desktop']['font_size'] : $typo_defaults['heading_five']['desktop']['font_size'];
        $h5desktopSpacing  = isset(  $heading_five['desktop']['letter_spacing'] ) ? $heading_five['desktop']['letter_spacing'] : $typo_defaults['heading_five']['desktop']['letter_spacing'];
        $h5desktopHeight   = isset(  $heading_five['desktop']['line_height'] ) ? $heading_five['desktop']['line_height'] : $typo_defaults['heading_five']['desktop']['line_height'];
        $h5tabletFontSize  = isset(  $heading_five['tablet']['font_size'] ) ? $heading_five['tablet']['font_size'] : $typo_defaults['heading_five']['tablet']['font_size'];
        $h5tabletSpacing   = isset(  $heading_five['tablet']['letter_spacing'] ) ? $heading_five['tablet']['letter_spacing'] : $typo_defaults['heading_five']['tablet']['letter_spacing'];
        $h5tabletHeight    = isset(  $heading_five['tablet']['line_height'] ) ? $heading_five['tablet']['line_height'] : $typo_defaults['heading_five']['tablet']['line_height'];
        $h5mobileFontSize  = isset(  $heading_five['mobile']['font_size'] ) ? $heading_five['mobile']['font_size'] : $typo_defaults['heading_five']['mobile']['font_size'];
        $h5mobileSpacing   = isset(  $heading_five['mobile']['letter_spacing'] ) ? $heading_five['mobile']['letter_spacing'] : $typo_defaults['heading_five']['mobile']['letter_spacing'];
        $h5mobileHeight    = isset(  $heading_five['mobile']['line_height'] ) ? $heading_five['mobile']['line_height'] : $typo_defaults['heading_five']['mobile']['line_height'];
        
        //Heading 6 variables
        $h6desktopFontSize = isset(  $heading_six['desktop']['font_size'] ) ? $heading_six['desktop']['font_size'] : $typo_defaults['heading_six']['desktop']['font_size'];
        $h6desktopSpacing  = isset(  $heading_six['desktop']['letter_spacing'] ) ? $heading_six['desktop']['letter_spacing'] : $typo_defaults['heading_six']['desktop']['letter_spacing'];
        $h6desktopHeight   = isset(  $heading_six['desktop']['line_height'] ) ? $heading_six['desktop']['line_height'] : $typo_defaults['heading_six']['desktop']['line_height'];
        $h6tabletFontSize  = isset(  $heading_six['tablet']['font_size'] ) ? $heading_six['tablet']['font_size'] : $typo_defaults['heading_six']['tablet']['font_size'];
        $h6tabletSpacing   = isset(  $heading_six['tablet']['letter_spacing'] ) ? $heading_six['tablet']['letter_spacing'] : $typo_defaults['heading_six']['tablet']['letter_spacing'];
        $h6tabletHeight    = isset(  $heading_six['tablet']['line_height'] ) ? $heading_six['tablet']['line_height'] : $typo_defaults['heading_six']['tablet']['line_height'];
        $h6mobileFontSize  = isset(  $heading_six['mobile']['font_size'] ) ? $heading_six['mobile']['font_size'] : $typo_defaults['heading_six']['mobile']['font_size'];
        $h6mobileSpacing   = isset(  $heading_six['mobile']['letter_spacing'] ) ? $heading_six['mobile']['letter_spacing'] : $typo_defaults['heading_six']['mobile']['letter_spacing'];
        $h6mobileHeight    = isset(  $heading_six['mobile']['line_height'] ) ? $heading_six['mobile']['line_height'] : $typo_defaults['heading_six']['mobile']['line_height'];

        $primary_color      = get_theme_mod( 'primary_color', $defaults['primary_color'] );
        $rgb                = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $primary_color ) );
        $secondary_color    = get_theme_mod( 'secondary_color', $defaults['secondary_color'] );
        $rgb2               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $secondary_color ) );
        $body_font_color    = get_theme_mod( 'body_font_color', $defaults['body_font_color'] );
        $rgb3               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $body_font_color ) );
        $heading_color      = get_theme_mod( 'heading_color', $defaults['heading_color'] );
        $rgb4               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $heading_color ) );
        $section_bg_color   = get_theme_mod( 'section_bg_color', $defaults['section_bg_color'] );
        $rgb5               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $section_bg_color ) );
        $background_color   = get_theme_mod( 'site_bg_color', $defaults['site_bg_color'] );
        $rgb6               = travel_monster_hex2rgb( travel_monster_sanitize_rgba( $background_color ) );

        $button_roundness = get_theme_mod( 'btn_roundness', $button_defaults['btn_roundness'] );
        $button_padding   = get_theme_mod( 'button_padding', $button_defaults['button_padding'] );
	
        //Button Color
        $btn_text_color         = get_theme_mod( 'btn_text_color_initial', $defaults['btn_text_color_initial'] );
        $btn_bg_color           = get_theme_mod( 'btn_bg_color_initial', $defaults['btn_bg_color_initial'] );
        $btn_text_hover_color   = get_theme_mod( 'btn_text_color_hover', $defaults['btn_text_color_hover'] );
        $btn_bg_hover_color     = get_theme_mod( 'btn_bg_color_hover', $defaults['btn_bg_color_hover'] );
        $btn_border_color       = get_theme_mod( 'btn_border_color_initial', $defaults['btn_border_color_initial'] );
        $btn_border_hover_color = get_theme_mod( 'btn_border_color_hover', $defaults['btn_border_color_hover'] );

        $custom_css = ':root {
            --tmp-primary-color   : ' . travel_monster_sanitize_rgba( $primary_color ) . ';
            --tmp-primary-color-rgb: ' . $rgb[0] . ',' . $rgb[1] .',' . $rgb[2] . ';
            --tmp-secondary-color : ' . travel_monster_sanitize_rgba( $secondary_color ) . ';
            --tmp-secondary-color-rgb:' . $rgb2[0] . ',' . $rgb2[1] .',' . $rgb2[2] . ';
            --tmp-body-font-color : ' . travel_monster_sanitize_rgba( $body_font_color ) . ';
            --tmp-body-font-color-rgb:' . $rgb3[0] . ',' . $rgb3[1] .',' . $rgb3[2] . ';
            --tmp-heading-color   : ' . travel_monster_sanitize_rgba( $heading_color ) . ';
            --tmp-heading-color-rgb:' . $rgb4[0] . ',' . $rgb4[1] .',' . $rgb4[2] . ';
            --tmp-section-bg-color: ' . travel_monster_sanitize_rgba( $section_bg_color ) . ';
            --tmp-section-bg-color-rgb:' . $rgb5[0] . ',' . $rgb5[1] .',' . $rgb5[2] . ';
            --tmp-background-color: ' . travel_monster_sanitize_rgba( $background_color ) . ';
            --tmp-background-color-rgb:' . $rgb6[0] . ',' . $rgb6[1] .',' . $rgb6[2] . ';

            --tmp-btn-text-initial-color  : ' . travel_monster_sanitize_rgba( $btn_text_color ) . ';
            --tmp-btn-text-hover-color    : ' . travel_monster_sanitize_rgba( $btn_text_hover_color ) . ';
            --tmp-btn-bg-initial-color    : ' . travel_monster_sanitize_rgba( $btn_bg_color ) . ';
            --tmp-btn-bg-hover-color      : ' . travel_monster_sanitize_rgba( $btn_bg_hover_color ) . ';
            --tmp-btn-border-initial-color: ' . travel_monster_sanitize_rgba( $btn_border_color ) . ';
            --tmp-btn-border-hover-color  : ' . travel_monster_sanitize_rgba( $btn_border_hover_color ) . ';

            --tmp-primary-font-family   : ' . wp_kses_post( $primary_font_family ) . ';
            --tmp-primary-font-weight   : ' . esc_html( $primary_font['weight'] ) . ';
            --tmp-primary-font-transform: ' . esc_html( $primary_font['transform'] ) . ';

            --tmp-btn-font-family     : ' . wp_kses_post( $btnFontFamily ) . ';
            --tmp-btn-font-weight     : ' . esc_html( $button['weight'] ) . ';
            --tmp-btn-font-transform  : ' . esc_html( $button['transform'] ) . ';
            --tmp-btn-roundness-top   : ' . absint( $button_roundness['top'] ) . 'px;
            --tmp-btn-roundness-right : ' . absint( $button_roundness['right'] ) . 'px;
            --tmp-btn-roundness-bottom: ' . absint( $button_roundness['bottom'] ) . 'px;
            --tmp-btn-roundness-left  : ' . absint( $button_roundness['left'] ) . 'px;
            --tmp-btn-padding-top     : ' . absint( $button_padding['top'] ) . 'px;
            --tmp-btn-padding-right   : ' . absint( $button_padding['right'] ) . 'px;
            --tmp-btn-padding-bottom  : ' . absint( $button_padding['bottom'] ) . 'px;
            --tmp-btn-padding-left    : ' . absint( $button_padding['left'] ) . 'px;

        }
        .editor-styles-wrapper h1{
            font-family :' . wp_kses_post( $h1FontFamily ) . '; 
            text-transform:' . esc_html( $heading_one['transform'] ) . ';       
            font-weight:' . esc_html( $heading_one['weight'] ) . '; 
        }
        .editor-styles-wrapper h2{
            font-family :' . wp_kses_post( $h2FontFamily ) . '; 
            text-transform:' . esc_html( $heading_two['transform'] ) . ';       
            font-weight:' . esc_html( $heading_two['weight'] ) . '; 
        }
        .editor-styles-wrapper h3{
            font-family :' . wp_kses_post( $h3FontFamily ) . '; 
            text-transform:' . esc_html( $heading_three['transform'] ) . ';       
            font-weight:' . esc_html( $heading_three['weight'] ) . '; 
        }
        .editor-styles-wrapper h4{
            font-family :' . wp_kses_post( $h4FontFamily ) . '; 
            text-transform:' . esc_html( $heading_four['transform'] ) . ';       
            font-weight:' . esc_html( $heading_four['weight'] ) . '; 
        }
        .editor-styles-wrapper h5{
            font-family :' . wp_kses_post( $h5FontFamily ) . '; 
            text-transform:' . esc_html( $heading_five['transform'] ) . ';       
            font-weight:' . esc_html( $heading_five['weight'] ) . '; 
        }
        .editor-styles-wrapper h6{
            font-family :' . wp_kses_post( $h6FontFamily ) . '; 
            text-transform:' . esc_html( $heading_six['transform'] ) . ';       
            font-weight:' . esc_html( $heading_six['weight'] ) . '; 
        }
            
        @media (min-width: 1024px){
            .editor-styles-wrapper h1{
                font-size   : ' . floatval( $h1desktopFontSize ) . 'px;
                line-height   : ' . floatval( $h1desktopHeight ) . 'em;
                letter-spacing: ' . absint( $h1desktopSpacing ) . 'px;
            }
            .editor-styles-wrapper h2{
                font-size   : ' . floatval( $h2desktopFontSize ) . 'px;
                line-height   : ' . floatval( $h2desktopHeight ) . 'em;
                letter-spacing: ' . absint( $h2desktopSpacing ) . 'px;
            }
            .editor-styles-wrapper h3{
                font-size   : ' . floatval( $h3desktopFontSize ) . 'px;
                line-height   : ' . floatval( $h3desktopHeight ) . 'em;
                letter-spacing: ' . absint( $h3desktopSpacing ) . 'px;
            }
            .editor-styles-wrapper h4{
                font-size   : ' . floatval( $h4desktopFontSize ) . 'px;
                line-height   : ' . floatval( $h4desktopHeight ) . 'em;
                letter-spacing: ' . absint( $h4desktopSpacing ) . 'px;
            }
            .editor-styles-wrapper h5{
                font-size   : ' . floatval( $h5desktopFontSize ) . 'px;
                line-height   : ' . floatval( $h5desktopHeight ) . 'em;
                letter-spacing: ' . absint( $h5desktopSpacing ) . 'px;
            }
            .editor-styles-wrapper h6{
                font-size   : ' . floatval( $h6desktopFontSize ) . 'px;
                line-height   : ' . floatval( $h6desktopHeight ) . 'em;
                letter-spacing: ' . absint( $h6desktopSpacing ) . 'px;
            }
        }
        @media (min-width: 767px) and (max-width: 1024px){
            .editor-styles-wrapper h1{
                font-size   : ' . floatval( $h1tabletFontSize ) . 'px;
                line-height   : ' . floatval( $h1tabletHeight ) . 'em;
                letter-spacing: ' . absint( $h1tabletSpacing ) . 'px;
            }
            .editor-styles-wrapper h2{
                font-size   : ' . floatval( $h2tabletFontSize ) . 'px;
                line-height   : ' . floatval( $h2tabletHeight ) . 'em;
                letter-spacing: ' . absint( $h2tabletSpacing ) . 'px;
            }
            .editor-styles-wrapper h3{
                font-size   : ' . floatval( $h3tabletFontSize ) . 'px;
                line-height   : ' . floatval( $h3tabletHeight ) . 'em;
                letter-spacing: ' . absint( $h3tabletSpacing ) . 'px;
            }
            .editor-styles-wrapper h4{
                font-size   : ' . floatval( $h4tabletFontSize ) . 'px;
                line-height   : ' . floatval( $h4tabletHeight ) . 'em;
                letter-spacing: ' . absint( $h4tabletSpacing ) . 'px;
            }
            .editor-styles-wrapper h5{
                font-size   : ' . floatval( $h5tabletFontSize ) . 'px;
                line-height   : ' . floatval( $h5tabletHeight ) . 'em;
                letter-spacing: ' . absint( $h5tabletSpacing ) . 'px;
            }
            .editor-styles-wrapper h6{
                font-size   : ' . floatval( $h6tabletFontSize ) . 'px;
                line-height   : ' . floatval( $h6tabletHeight ) . 'em;
                letter-spacing: ' . absint( $h6tabletSpacing ) . 'px;
            }
        }
        @media (max-width: 767px){
            .editor-styles-wrapper h1{
                font-size   : ' . floatval( $h1mobileFontSize ) . 'px;
                line-height   : ' . floatval( $h1mobileHeight ) . 'em;
                letter-spacing: ' . absint( $h1mobileSpacing ) . 'px;
            }
            .editor-styles-wrapper h2{
                font-size   : ' . floatval( $h2mobileFontSize ) . 'px;
                line-height   : ' . floatval( $h2mobileHeight ) . 'em;
                letter-spacing: ' . absint( $h2mobileSpacing ) . 'px;
            }
            editor-styles-wrapper h3{
                font-size   : ' . floatval( $h3mobileFontSize ) . 'px;
                line-height   : ' . floatval( $h3mobileHeight ) . 'em;
                letter-spacing: ' . absint( $h3mobileSpacing ) . 'px;
            }
            editor-styles-wrapper h4{
                font-size   : ' . floatval( $h4mobileFontSize ) . 'px;
                line-height   : ' . floatval( $h4mobileHeight ) . 'em;
                letter-spacing: ' . absint( $h4mobileSpacing ) . 'px;
            }
            editor-styles-wrapper h5{
                font-size   : ' . floatval( $h5mobileFontSize ) . 'px;
                line-height   : ' . floatval( $h5mobileHeight ) . 'em;
                letter-spacing: ' . absint( $h5mobileSpacing ) . 'px;
            }
            editor-styles-wrapper h6{
                font-size   : ' . floatval( $h6mobileFontSize ) . 'px;
                line-height   : ' . floatval( $h6mobileHeight ) . 'em;
                letter-spacing: ' . absint( $h6mobileSpacing ) . 'px;
            }
        }';
    
        return $custom_css;
    }
endif;


/**
 * Enqueue our dynamic CSS.
 *
 * @since 1.0.0
 */
function travel_monster_enqueue_dynamic_css() {
	if ( ! get_option( 'travel_monster_dynamic_css', false ) || is_customize_preview() || apply_filters( 'travel_monster_dynamic_css_skip_cache', false ) ) {
		$css = travel_monster_dynamic_root_css();
	} else {
		$css = get_option( 'travel_monster_dynamic_css' ) . '/* End cached CSS */';
	}

	wp_add_inline_style( 'travel-monster-style', wp_strip_all_tags( $css ) );
}
add_action( 'wp_enqueue_scripts', 'travel_monster_enqueue_dynamic_css', 50 );


/**
 * Sets our dynamic CSS cache if it doesn't exist.
 *
 * If the theme version changed, bust the cache.
 *
 * @since 1.0.0
 */
function travel_monster_set_dynamic_css_cache() {
	if ( apply_filters( 'travel_monster_dynamic_css_skip_cache', false ) ) {
		return;
	}

	$cached_css = get_option( 'travel_monster_dynamic_css', false );
	$cached_version = get_option( 'travel_monster_dynamic_css_cached_version', '' );

	if ( ! $cached_css || TRAVEL_MONSTER_THEME_VERSION !== $cached_version ) {
		$css = travel_monster_dynamic_root_css();

		update_option( 'travel_monster_dynamic_css', wp_strip_all_tags( $css ) );
		update_option( 'travel_monster_dynamic_css_cached_version', esc_html( TRAVEL_MONSTER_THEME_VERSION ) );
	}
}
add_action( 'init', 'travel_monster_set_dynamic_css_cache' );


/**
 * Update our CSS cache when done importing contents from Demo Importer Plus.
 *
 * @since 1.0.0
 */
add_action( 'wp_ajax_demo-importer-plus-import-end', function(){
    
    $css = travel_monster_dynamic_root_css();
    update_option( 'travel_monster_dynamic_css', wp_strip_all_tags( $css ) );
} );

/**
 * Update our CSS cache when done saving Customizer options.
 *
 * @since 1.0.0
 */
function travel_monster_update_dynamic_css_cache() {
	if ( apply_filters( 'travel_monster_dynamic_css_skip_cache', false ) ) {
		return;
	}

	$css = travel_monster_dynamic_root_css();
	update_option( 'travel_monster_dynamic_css', wp_strip_all_tags( $css ) );
}
add_action( 'customize_save_after', 'travel_monster_update_dynamic_css_cache' );
    