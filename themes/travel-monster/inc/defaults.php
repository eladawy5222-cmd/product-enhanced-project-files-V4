<?php
/**
 * Customizer Settings Defaults 
 * 
 * @package Travel Monster
 */

if( ! function_exists( 'travel_monster_get_site_defaults' ) ) :
/**
 * Site Defaults
 * 
 * @return array
 */
function travel_monster_get_site_defaults(){

    $defaults = array(
        'hide_title'        => false,
        'hide_tagline'      => true,
        'logo_width'        => '50',
        'tablet_logo_width' => '50',
        'mobile_logo_width' => '50',
    );

    return apply_filters( 'travel_monster_site_options_defaults', $defaults );
}
endif;

if( ! function_exists( 'travel_monster_get_typography_defaults' ) ) :
/**
 * Typography Defaults
 * 
 * @return array
 */
function travel_monster_get_typography_defaults(){
    $defaults = array(
        
        'primary_font' => array(
            'family'         => 'Poppins',
            'variants'       => '',
            'category'       => '',
            'weight'         => '400',
            'transform'      => 'none',
            'desktop' => array(
                'font_size'      => 16,
                'line_height'    => 1.75,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 16,
                'line_height'    => 1.75,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 16,
                'line_height'    => 1.75,
                'letter_spacing' => 0,
            )
        ),
        'site_title' => array(
            'family'    => 'Default Family',
            'variants'  => '',
            'category'  => '',
            'weight'    => 'bold',
            'transform' => 'none',
            'desktop' => array(
                'font_size'      => 18,
                'line_height'    => 1.5,
                'letter_spacing' => 0
            ),
            'tablet' => array(
                'font_size'      => 18,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 18,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            )
        ),
        'button' => array(
            'family'         => 'Default Family',
            'variants'       => '',
            'category'       => '',
            'weight'         => '400',
            'transform'      => 'none',
            'desktop' => array(
                'font_size'      => 16,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 16,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 16,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            )
        ),
        'heading_one' => array(
            'family'      => 'Default Family',
            'variants'    => '',
            'category'    => '',
            'weight'      => '700',
            'transform'   => 'none',
            'desktop' => array(
                'font_size'      => 40,
                'line_height'    => 1.3,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 40,
                'line_height'    => 1.3,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 36,
                'line_height'    => 1.3,
                'letter_spacing' => 0,
            )
        ),
        'heading_two' => array(
            'family'      => 'Default Family',
            'variants'    => '',
            'category'    => '',
            'weight'      => '700',
            'transform'   => 'none',
            'desktop' => array(
                'font_size'      => 32,
                'line_height'    => 1.3,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 32,
                'line_height'    => 1.3,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 30,
                'line_height'    => 1.3,
                'letter_spacing' => 0,
            )
        ),
        'heading_three' => array(
            'family'      => 'Default Family',
            'variants'    => '',
            'category'    => '',
            'weight'      => '700',
            'transform'   => 'none',
            'desktop' => array(
                'font_size'      => 28,
                'line_height'    => 1.4,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 28,
                'line_height'    => 1.4,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 26,
                'line_height'    => 1.4,
                'letter_spacing' => 0,
            )
        ),
        'heading_four' => array(
            'family'      => 'Default Family',
            'variants'    => '',
            'category'    => '',
            'weight'      => '700',
            'transform'   => 'none',
            'desktop' => array(
                'font_size'      => 24,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 24,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 22,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            )
        ),
        'heading_five' => array(
            'family'      => 'Default Family',
            'variants'    => '',
            'category'    => '',
            'weight'      => '700',
            'transform'   => 'none',
            'desktop' => array(
                'font_size'      => 20,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 20,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 18,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            )
        ),
        'heading_six' => array(
            'family'      => 'Default Family',
            'variants'    => '',
            'category'    => '',
            'weight'      => '700',
            'transform'   => 'none',
            'desktop' => array(
                'font_size'      => 16,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'tablet' => array(
                'font_size'      => 16,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            ),
            'mobile' => array(
                'font_size'      => 16,
                'line_height'    => 1.5,
                'letter_spacing' => 0,
            )
        )
    );

    return apply_filters( 'travel_monster_typography_options_defaults', $defaults ); 
}
endif;

if( ! function_exists( 'travel_monster_get_color_defaults' ) ) :
/**
 * Color Defaults
 * 
 * @return array
 */
function travel_monster_get_color_defaults(){
    $defaults = array(
        'primary_color'                     => '#28B5A4',
        'secondary_color'                   => '#e48e45',
        'body_font_color'                   => '#494d41',
        'heading_color'                     => '#232323',
        'section_bg_color'                  => 'rgba(40, 181, 164, 0.05)',
        'site_bg_color'                     => '#FFFFFF',
        'accent_color_one'                  => '#F5FBF6',
        'accent_color_two'                  => '#FCF7EF',
        'site_title_color'                  => '#232323',
        'site_tagline_color'                => '#232323',
        'header_btn_text_color'             => '#ffffff',
        'header_btn_text_hover_color'       => '#ffffff',
        'header_btn_bg_color'               => '#e48e45',
        'header_btn_bg_hover_color'         => 'rgba(40,181,164,0.92)',
        'btn_text_color_initial'            => '#ffffff',
        'btn_text_color_hover'              => '#ffffff',
        'btn_bg_color_initial'              => '#e48e45',
        'btn_bg_color_hover'                => '#28B5A4',
        'btn_border_color_initial'          => '#e48e45',
        'btn_border_color_hover'            => '#28B5A4',
        'notification_bg_color'             => '#28B5A4',
        'notification_text_color'           => '#ffffff',
        'upper_footer_bg_color'             => '#26786e',
        'upper_footer_text_color'           => '#ffffff',
        'upper_footer_link_hover_color'     => 'rgba(255, 255, 255, 0.8)',
        'upper_footer_widget_heading_color' => '#ffffff',
        'bottom_footer_bg_color'            => '#26786e',
        'bottom_footer_text_color'          => '#ffffff',
        'bottom_footer_link_initial_color'  => '#ffffff',
        'bottom_footer_link_hover_color'    => 'rgba(255, 255, 255, 0.8)',
        'theme_white_color'                 => '#ffffff',
        'theme_black_color'                 => '#000000',
        'top_header_bg_color'               => '#28b5a4',
        'top_header_text_color'             => '#ffffff',
        'transparent_top_header_bg_color'   => '',
        'transparent_top_header_text_color' => '',
    );

    return apply_filters( 'travel_monster_color_options_defaults', $defaults );
}
endif;

if( ! function_exists( 'travel_monster_get_button_defaults' ) ) :
/**
 * Button Defaults
 * 
 * @return array
 */
function travel_monster_get_button_defaults(){

    $defaults = array(
        'btn_roundness' => array(
            'top'    => 4,
            'right'  => 4,
            'bottom' => 4,
            'left'   => 4,
        ),
        'button_padding'   => array(
            'top'    => 16,
            'right'  => 32,
            'bottom' => 16,
            'left'   => 32,
        )
    );

    return apply_filters( 'travel_monster_button_options_defaults', $defaults );
}
endif;

if( ! function_exists( 'travel_monster_get_general_defaults' ) ) :
/**
 * General Defaults
 * 
 * @return array
 */
function travel_monster_get_general_defaults(){

    $defaults = array(
        'ed_blog_title'                   => true,
        'ed_blog_desc'                    => false,
        'blog_alignment'                  => 'left',
        'blog_crop_image'                 => true,
        'blog_content'                    => 'excerpt',
        'excerpt_length'                  => 55,
        'blog_meta_order'                 => array( 'author', 'date' ),
        'blog_ed_category'                => true,
        'blog_read_more'                  => __( 'Read More', 'travel-monster' ),
        'blog_page_layout'                => 'one',
        'blog_sidebar_layout'             => 'default-sidebar',
        'ed_archive_prefix'               => false,
        'ed_archive_title'                => true,
        'ed_archive_description'          => true,
        'ed_archive_post_count'           => true,
        'archive_alignment'               => 'left',
        'archive_page_layout'             => 'one',
        'archive_sidebar_layout'          => 'default-sidebar',
        'archive_header_image'            => '',
        'ed_page_title'                   => true,
        'page_alignment'                  => 'left',
        'page_sidebar_layout'             => 'right-sidebar',
        'ed_page_image'                   => true,
        'ed_page_comments'                => false,
        'single_post_layout'              => 'one',
        'post_sidebar_layout'             => 'right-sidebar',
        'ed_crop_single_image'            => false,
        'single_post_meta_order'          => array( 'author', 'date' ),
        'ed_author'                       => true,
        'ed_post_tags'                    => true,
        'ed_post_pagination'              => true,
        'ed_post_related'                 => true,
        'single_related_title'            => __( 'Recommended Articles','travel-monster' ),
        'related_taxonomy'                => 'cat',
        'related_post_num'                => 4,
        'related_post_row'                => 4,
        'related_posts_location'          => 'end',
        'ed_single_comments'              => true,
        'single_comment_form'             => 'below',
        'single_comment_location'         => 'below',
        'ed_social_sharing'               => true,
        'ed_og_tags'                      => true,
        'social_share_text'               => __( 'SHARE THIS ARTICLE:', 'travel-monster' ),
        'social_share'                    => array( 'facebook', 'twitter', 'pinterest', 'linkedin' ),
        'no_of_posts_404'                 => 3,
        'ed_latest_post'                  => true,
        'posts_per_row_404'               => 3,
        'read_more_style'                 => 'text',
        'post_navigation'                 => 'numbered',
        'load_more_label'                 => __( 'Load More Posts', 'travel-monster' ),
        'loading_label'                   => __( 'Loading...', 'travel-monster' ),
        'no_more_label'                   => __( 'No More Post', 'travel-monster' ),
        'home_text'                       => __( 'Home', 'travel-monster' ),
        'separator_icon'                  => 'one',
        'ed_post_update_date'             => true,
        'container_width'                 => 1320,
        'tablet_container_width'          => 992,
        'mobile_container_width'          => 420,
        'fullwidth_centered'              => 780,
        'tablet_fullwidth_centered'       => 780,
        'mobile_fullwidth_centered'       => 780,
        'layout'                          => 'boxed',
        'page_layout'                     => 'default',
        'layout_style'                    => 'right-sidebar',
        'ed_header_search'                => false,
        'header_layout'                   => 'one',
        'header_button_label'             => __( 'Book Now','travel-monster' ),
        'header_button_link'              => '',
        'ed_header_button_newtab'         => true,
        'ed_header_button_sticky'         => true,
        'ed_currency_code'                => true,
        'ed_currency_symbol'              => true,
        'ed_currency_name'                => false,
        'ed_social_media'                 => false,
        'ed_social_media_newtab'          => false,
        'social_media_order'              => array( 'tmp_facebook', 'tmp_twitter', 'tmp_instagram'),
        'header_strech_menu'              => false,
        'header_items_spacing'            => 30,
        'header_dropdown_width'           => 230,
        'sidebar_width'                   => 28,
        'tablet_sidebar_width'            => 28,
        'widgets_spacing'                 => 32,
        'tablet_widgets_spacing'          => 32,
        'mobile_widgets_spacing'          => 20,
        'ed_last_widget_sticky'           => false,
        'ed_scroll_top'                   => true,
        'scroll_top_alignment'            => 'right',
        'scroll_top_size'                 => 20,
        'tablet_scroll_top_size'          => 20,
        'mobile_scroll_top_size'          => 20,
        'scroll_top_bottom_offset'        => 25,
        'tablet_scroll_top_bottom_offset' => 25,
        'mobile_scroll_top_bottom_offset' => 25,
        'scroll_top_side_offset'          => 25,
        'tablet_scroll_top_side_offset'   => 25,
        'mobile_scroll_top_side_offset'   => 25,
        'tablet_posts_per_row_404'        => 2,
        'mobile_posts_per_row_404'        => 1,
        'header_width_layout'             => 'boxed',
        'ed_sticky_header'                => false,
        'tmp_phone_label'                 => '',
        'tmp_phone'                       => '',
        'ed_open_whatsapp'                => false,
        'whatsapp_msg_lbl'                => '',
        'tmp_email_label'                 => '',
        'tmp_email'                       => '',
        'mobile_menu_label'               => __('Menu', 'travel-monster'),
        'ed_mobile_search'                => true,
        'ed_mobile_phone'                 => true,
        'ed_mobile_email'                 => true,
        'ed_mobile_social_media'          => true,
        'ed_mobile_button'                => false,
        'header_contact_image'            => '',
        'header_trip_advisor_image'       => '',
        'ed_breadcrumb'                   => true,
        'tmp_facebook'                    => '#',
        'tmp_twitter'                     => '#',
        'tmp_instagram'                   => '#',
        'tmp_pinterest'                   => '',
        'tmp_youtube'                     => '',
        'tmp_tiktok'                      => '',
        'tmp_linkedin'                    => '',
        'tmp_whatsapp'                    => '',
        'tmp_viber'                       => '',
        'tmp_telegram'                    => '',
        'tmp_tripadvisor'                 => '',
        'tmp_wechat'                      => '',
        'tmp_weibo'                       => '',
        'tmp_qq'                          => '',
        'footer_copyright'                => '',
        'ed_author_link'                  => false,
        'ed_wp_link'                      => false,
        'payment_label'                   => __( 'Secured Payment:','travel-monster' ),
        'payment_image'                   => '',
        '404_image'                       => '',
        'blog_header_image'               => '',
        'ed_localgoogle_fonts'            => false,
        'ed_preload_local_fonts'          => false,
        'background_blur'                 => 16,
    );
    return apply_filters( 'travel_monster_general_defaults', $defaults );
}
endif;

if ( ! function_exists( 'travel_monster_get_default_color_preset' ) ) :
	/**
	 * Check the style preset and return the color array
	 *
	 * @param string $preset
	 * @return array
	 */
	function travel_monster_get_default_color_preset( $preset = 'one' ) {
		// Initialize the color preset array
		$color_preset = array(
			'one'     => array(
				'primary_color'    => '#4285F4',
				'secondary_color'  => '#E67D3C',
				'body_font_color'  => '#4D4E55',
				'heading_color'    => '#1A161F',
				'section_bg_color' => '#F5F5F5',
				'site_bg_color'    => '#FFFFFF',
				'accent_color_one' => '#F4F8FE',
				'accent_color_two' => '#FDF5EF',
			),
			'two'     => array(
				'primary_color'    => '#51B66D',
				'secondary_color'  => '#DEA035',
				'body_font_color'  => '#556259',
				'heading_color'    => '#232C26',
				'section_bg_color' => '#F5F5F5',
				'site_bg_color'    => '#FFFFFF',
				'accent_color_one' => '#F5FBF6',
				'accent_color_two' => '#FCF7EF',
			),
			'three'   => array(
				'primary_color'    => '#084D2A',
				'secondary_color'  => '#E67D3C',
				'body_font_color'  => '#0C713E',
				'heading_color'    => '#084D2A',
				'section_bg_color' => '#F7F2EC',
				'site_bg_color'    => '#FFFFFF',
				'accent_color_one' => '#DEED58',
				'accent_color_two' => '#FDF5EF',
			),
			'four'    => array(
				'primary_color'    => '#0682B4',
				'secondary_color'  => '#B4A97F',
				'body_font_color'  => '#505155',
				'heading_color'    => '#191919',
				'section_bg_color' => '#EDEBE5',
				'site_bg_color'    => '#FFFFFF',
				'accent_color_one' => '#EDEBE5',
				'accent_color_two' => '#F0F7FA',
			),
			'default' => array(
				'primary_color'    => get_theme_mod( 'primary_color', travel_monster_get_color_defaults()['primary_color'] ),
				'secondary_color'  => get_theme_mod( 'secondary_color', travel_monster_get_color_defaults()['secondary_color'] ),
				'body_font_color'  => get_theme_mod( 'body_font_color', travel_monster_get_color_defaults()['body_font_color'] ),
				'heading_color'    => get_theme_mod( 'heading_color', travel_monster_get_color_defaults()['heading_color'] ),
				'section_bg_color' => get_theme_mod( 'section_bg_color', travel_monster_get_color_defaults()['section_bg_color'] ),
				'site_bg_color'    => get_theme_mod( 'site_bg_color', travel_monster_get_color_defaults()['site_bg_color'] ),
				'accent_color_one' => get_theme_mod( 'accent_color_one', travel_monster_get_color_defaults()['accent_color_one'] ),
				'accent_color_two' => get_theme_mod( 'accent_color_two', travel_monster_get_color_defaults()['accent_color_two'] ),
			),
		);

		return $color_preset[ $preset ];
	}
endif;

if ( ! function_exists( 'travel_monster_typography_preset_array' ) ) :
	/**
	 * Check the style preset and return the typography array
	 *
	 * @param string $preset
	 * @return array
	 */
	function travel_monster_typography_preset_array( $preset = 'one' ) {
		// Initialize the typography preset array
		$typography_preset = array(
			'one'     => array(
				'primary_font'  => 'System Stack',
				'heading_one'   => 'System Stack',
				'heading_two'   => 'System Stack',
				'heading_three' => 'System Stack',
				'heading_four'  => 'System Stack',
				'heading_five'  => 'System Stack',
				'heading_six'   => 'System Stack',
			),
			'two'     => array(
				'primary_font'  => 'Fira Sans',
				'heading_one'   => 'Ubuntu Sans',
				'heading_two'   => 'Ubuntu Sans',
				'heading_three' => 'Ubuntu Sans',
				'heading_four'  => 'Ubuntu Sans',
				'heading_five'  => 'Ubuntu Sans',
				'heading_six'   => 'Ubuntu Sans',
			),
			'three'   => array(
				'primary_font'  => 'Fira Sans',
				'heading_one'   => 'SUSE',
				'heading_two'   => 'SUSE',
				'heading_three' => 'SUSE',
				'heading_four'  => 'SUSE',
				'heading_five'  => 'SUSE',
				'heading_six'   => 'SUSE',
			),
			'four'    => array(
				'primary_font'  => 'Inclusive Sans',
				'heading_one'   => 'Anybody',
				'heading_two'   => 'Anybody',
				'heading_three' => 'Anybody',
				'heading_four'  => 'Anybody',
				'heading_five'  => 'Anybody',
				'heading_six'   => 'Anybody',
			),
			'five'    => array(
				'primary_font'  => 'Noto Sans',
				'heading_one'   => 'Syne',
				'heading_two'   => 'Syne',
				'heading_three' => 'Syne',
				'heading_four'  => 'Syne',
				'heading_five'  => 'Syne',
				'heading_six'   => 'Syne',
			),
			'six'     => array(
				'primary_font'  => 'Noto Sans',
				'heading_one'   => 'Amita',
				'heading_two'   => 'Amita',
				'heading_three' => 'Amita',
				'heading_four'  => 'Amita',
				'heading_five'  => 'Amita',
				'heading_six'   => 'Amita',
			),
			'seven'   => array(
				'primary_font'  => 'Inclusive Sans',
				'heading_one'   => 'K2D',
				'heading_two'   => 'K2D',
				'heading_three' => 'K2D',
				'heading_four'  => 'K2D',
				'heading_five'  => 'K2D',
				'heading_six'   => 'K2D',
			),
            'eight'   => array(
                'primary_font'  => 'DM Sans',
                'heading_one'   => 'DM Serif Text',
                'heading_two'   => 'DM Serif Text',
                'heading_three' => 'DM Serif Text',
                'heading_four'  => 'DM Serif Text',
                'heading_five'  => 'DM Serif Text',
                'heading_six'   => 'DM Serif Text',
            ),
			'default' => array(
				'primary_font'  => get_theme_mod( 'primary_font', travel_monster_get_typography_defaults()['primary_font'] )['family'],
				'heading_one'   => get_theme_mod( 'heading_one', travel_monster_get_typography_defaults()['heading_one'] )['family'],
				'heading_two'   => get_theme_mod( 'heading_two', travel_monster_get_typography_defaults()['heading_two'] )['family'],
				'heading_three' => get_theme_mod( 'heading_three', travel_monster_get_typography_defaults()['heading_three'] )['family'],
				'heading_four'  => get_theme_mod( 'heading_four', travel_monster_get_typography_defaults()['heading_four'] )['family'],
				'heading_five'  => get_theme_mod( 'heading_five', travel_monster_get_typography_defaults()['heading_five'] )['family'],
				'heading_six'   => get_theme_mod( 'heading_six', travel_monster_get_typography_defaults()['heading_six'] )['family'],
			),
		);

		return $typography_preset[ $preset ];
	}
	endif;