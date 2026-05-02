<?php
/**
 * Header Setting
 *
 * @package Travel Monster
 */

function travel_monster_customize_register_layout_header( $wp_customize ) {
    
    $defaults      = travel_monster_get_general_defaults();
    $colorDefaults = travel_monster_get_color_defaults();

    $wp_customize->add_panel(
        'layout_header',
        array(
            'title'      => __( 'Main Header', 'travel-monster' ),
            'priority'   => 30,
            'capability' => 'edit_theme_options',
        )
    );

    /** General Settings */
    $wp_customize->add_section(
        'main_header_general_settings',
        array(
            'title'             => __( 'General Settings', 'travel-monster' ),
            'panel'             => 'layout_header',
            'active_callback'   => 'travel_monster_header_type_prebuilt_ac',
        )
    );


    /*Header Width*/
    $wp_customize->add_setting( 
        'header_width_layout', 
        array(
            'default'           => $defaults['header_width_layout'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio',
            'transport'         => 'postMessage'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'header_width_layout',
			array(
				'label'   => __( 'Header Width', 'travel-monster' ),
				'choices' => array(
					'boxed'     => __( 'Boxed', 'travel-monster' ),
					'fullwidth' => __( 'Fullwidth', 'travel-monster' ),
                ),
                'section' => 'main_header_general_settings',
			)
		)
	);

    /** Header Search Menu */
    $wp_customize->add_setting(
        'ed_header_search',
        array(
            'default'           => $defaults['ed_header_search'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_header_search',
			array(
				'section'  => 'main_header_general_settings',
				'label'    => __( 'Header Search', 'travel-monster' ),
				'priority' => 15
			)
		)
    );

    /** Top Header Background Color */
    $wp_customize->add_setting(
        'top_header_bg_color',
        array(
            'default'           => $colorDefaults['top_header_bg_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'top_header_bg_color',
            array(
                'label'    => __( 'Top Header Color', 'travel-monster' ),
                'section'    => 'main_header_general_settings',
                'priority' => 25
            )
        )
    );

    /** Top Header Text Color */
    $wp_customize->add_setting(
        'top_header_text_color',
        array(
            'default'           => $colorDefaults['top_header_text_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'top_header_text_color',
            array(
                'label'   => __( 'Text Color', 'travel-monster' ),
                'section'   => 'main_header_general_settings',
                'priority' => 30
            )
        )
    );

    /** Sticky Header Settings */
    $wp_customize->add_section(
        'main_header_sticky_header_settings',
        array(
            'title'             => __( 'Sticky Header Settings', 'travel-monster' ),
            'panel'             => 'layout_header',
        )
    );

    /** Sticky Header Menu */
    $wp_customize->add_setting(
        'ed_sticky_header',
        array(
            'default'           => $defaults['ed_sticky_header'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_sticky_header',
			array(
				'label'    => __( 'Sticky Header', 'travel-monster' ),
				'section'    => 'main_header_sticky_header_settings',
				'priority' => 10
			)
		)
	);


    /** Navigation Menu Settings */
    $wp_customize->add_section(
        'main_header_navigation_menu',
        array(
            'title'             => __( 'Navigation Menu', 'travel-monster' ),
            'panel'             => 'layout_header',
            'active_callback'   => 'travel_monster_header_type_prebuilt_ac',
        )
    );

    /** Items Spacing */
    $wp_customize->add_setting(
        'header_items_spacing',
        array(
            'default'           => $defaults['header_items_spacing'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'header_items_spacing',
            array(
                'label'    => __( 'Items Spacing', 'travel-monster' ),
                'settings' => array(
                    'desktop' => 'header_items_spacing',
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 0,
                        'max'  => 50,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
                'section' => 'main_header_navigation_menu', 
            )
        )
    );

    /** Header Strech Menu */
    $wp_customize->add_setting(
        'header_strech_menu',
        array(
            'default'           => $defaults['header_strech_menu'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
            'transport' => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'header_strech_menu',
			array(
				'label'   => __( 'Stretch Menu', 'travel-monster' ),
				'section'   => 'main_header_navigation_menu',
			)
		)
	);

    /** Dropdown Width */
    $wp_customize->add_setting(
        'header_dropdown_width',
        array(
            'default'           => $defaults['header_dropdown_width'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'header_dropdown_width',
            array(
                'label'    => __( 'Dropdown Width', 'travel-monster' ),
                'settings' => array(
                    'desktop' => 'header_dropdown_width',
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 0,
                        'max'  => 350,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
                'section' => 'main_header_navigation_menu', 
            )
        )
    );

    /** Contact Information */
    $wp_customize->add_section(
        'main_header_contact_information',
        array(
            'title'             => __( 'Contact Information', 'travel-monster' ),
            'panel'             => 'layout_header',
            'active_callback'   => 'travel_monster_header_type_prebuilt_ac',
        )
    );

     /** Phone */
     $wp_customize->add_setting(
        'tmp_phone',
        array(
            'default'           => $defaults['tmp_phone'],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_phone',
			array(
				'priority' => 8,
				'label'    => __( 'Phone', 'travel-monster' ),
				'section'   => 'main_header_contact_information',
			)
		)
	);

    $wp_customize->selective_refresh->add_partial( 'tmp_phone', array(
        'selector'        => '.header-m .contact-phone-wrap',
        'render_callback' => 'travel_monster_header_phone',
    ) );

    
    $wp_customize->add_setting(
        'ed_open_whatsapp',
        array(
            'default'           => $defaults['ed_open_whatsapp'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control( 
            $wp_customize,
            'ed_open_whatsapp',
            array(
                'section'  => 'main_header_contact_information',
                'label'    => __( 'Link to WhatsApp', 'travel-monster' ),
                'priority' => 9
            )
        )
    );

    /** Default WhatsApp Message */
    $wp_customize->add_setting(
        'whatsapp_msg_lbl',
        array(
            'default'           => $defaults['whatsapp_msg_lbl'],
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Text_Control(
            $wp_customize,
            'whatsapp_msg_lbl',
            array(
                'section'  => 'main_header_contact_information',
                'label'    => __( 'Default WhatsApp Message', 'travel-monster' ),
                'priority' => 9,
            )
        )
	);

    /** Email */
    $wp_customize->add_setting(
        'tmp_email',
        array(
            'default'           => $defaults['tmp_email'],
            'sanitize_callback' => 'sanitize_email',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_email',
			array(
				'section'  => 'main_header_contact_information',
				'label'   => __( 'Email', 'travel-monster' ),
			)
		)
	);

    $wp_customize->selective_refresh->add_partial( 'tmp_email', array(
        'selector'        => '.header-m .contact-email-wrap',
        'render_callback' => 'travel_monster_header_email',
    ) );

    /** Header Button */
    $wp_customize->add_section(
        'main_header_header_button',
        array(
            'title'             => __( 'Header Button', 'travel-monster' ),
            'panel'             => 'layout_header',
            'active_callback'   => 'travel_monster_header_type_prebuilt_ac',
        )
    );

     /** Phone */
     $wp_customize->add_setting(
        'header_button_label',
        array(
            'default'           => $defaults['header_button_label'],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'header_button_label',
			array(
				'section' => 'main_header_header_button',
				'label'   => __( 'Button Label', 'travel-monster' ),
			)
		)
	);

    $wp_customize->selective_refresh->add_partial( 'header_button_label', array(
        'selector'        => '.site-header .btn-book .btn-primary',
        'render_callback' => 'travel_monster_get_header_button',
    ) );

    /** Phone */
    $wp_customize->add_setting(
        'header_button_link',
        array(
            'default'           => $defaults['header_button_link'],
            'sanitize_callback' => 'esc_url_raw',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'header_button_link',
			array(
				'section' => 'main_header_header_button',
				'label'   => __( 'Button URL', 'travel-monster' ),
			)
		)
	);
    
    $wp_customize->add_setting(
        'ed_header_button_newtab',
        array(
            'default'           => $defaults['ed_header_button_newtab'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_header_button_newtab',
			array(
				'section' => 'main_header_header_button',
				'label'   => __( 'Open link in new Tab', 'travel-monster' ),
			)
		)
	);

    $wp_customize->add_setting(
        'ed_header_button_sticky',
        array(
            'default'           => $defaults['ed_header_button_sticky'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_header_button_sticky',
			array(
				'section' => 'main_header_header_button',
				'label'   => __( 'Show in Sticky Header', 'travel-monster' ),
			)
		)
	);

    /** Background Color */
    $wp_customize->add_setting(
        'header_btn_bg_color',
        array(
            'default'           => $colorDefaults['header_btn_bg_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );
    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'header_btn_bg_color',
            array(
                'label'   => __( 'Background Color', 'travel-monster' ),
                'section' => 'main_header_header_button',
            )
        )
    );

    /** Background Hover Color */
    $wp_customize->add_setting(
        'header_btn_bg_hover_color',
        array(
            'default'           =>  $colorDefaults['header_btn_bg_hover_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'header_btn_bg_hover_color',
            array(
                'label'   => __( 'Background Hover Color', 'travel-monster' ),
                'section' => 'main_header_header_button',
            )
        )
    );
    
    /** Text Color */
    $wp_customize->add_setting(
        'header_btn_text_color',
        array(
            'default'           => $colorDefaults['header_btn_text_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'header_btn_text_color',
            array(
                'label'   => __( 'Text Color', 'travel-monster' ),
                'section' => 'main_header_header_button',
            )
        )
    );

    /** Text Hover Color */
    $wp_customize->add_setting(
        'header_btn_text_hover_color',
        array(
            'default'           => $colorDefaults['header_btn_text_hover_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );
    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'header_btn_text_hover_color',
            array(
                'label'   => __( 'Text Hover Color', 'travel-monster' ),
                'section' => 'main_header_header_button',
            )
        )
    );

    /** Currency Converter Settings */
    $wp_customize->add_section(
        'main_header_currency',
        array(
            'title'             => __( 'Currency Converter Settings', 'travel-monster' ),
            'priority'          => 10,
            'panel'             => 'layout_header',
            'active_callback' => 'travel_monster_is_currency_converter_activated'
        )
    );


    /** Currency Code */
    $wp_customize->add_setting(
        'ed_currency_code',
        array(
            'default'           => $defaults['ed_currency_code'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_currency_code',
			array(
				'section' => 'main_header_currency',
				'label'   => __( 'Currency Code', 'travel-monster' ),
			)
		)
	);

    /** Currency Symbol */
    $wp_customize->add_setting(
        'ed_currency_symbol',
        array(
            'default'           => $defaults['ed_currency_symbol'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_currency_symbol',
			array(
				'section' => 'main_header_currency',
				'label'   => __( 'Currency Symbol', 'travel-monster' ),
			)
		)
	);
    
    /** Currency Name */
      $wp_customize->add_setting(
        'ed_currency_name',
        array(
            'default'           => $defaults['ed_currency_name'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_currency_name',
			array(
				'section' => 'main_header_currency',
				'label'   => __( 'Currency Name', 'travel-monster' ),
			)
		)
	);

    /** Social Media Settings */
    $wp_customize->add_section(
        'main_header_social_media',
        array(
            'title'             => __( 'Social Media Settings', 'travel-monster' ),
            'panel'             => 'layout_header',
            'active_callback'   => 'travel_monster_header_type_prebuilt_ac',
        )
    );

    /** Social Media */
    $wp_customize->add_setting(
        'ed_social_media',
        array(
            'default'           => $defaults['ed_social_media'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_social_media',
			array(
				'section' => 'main_header_social_media',
				'label'   => __( 'Social Media', 'travel-monster' ),
			)
		)
	);

    /* Open in new tab */

    $wp_customize->add_setting(
        'ed_social_media_newtab',
        array(
            'default'           => $defaults['ed_social_media_newtab'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_social_media_newtab',
			array(
				'section' => 'main_header_social_media',
				'label'   => __( 'Open in new tab', 'travel-monster' ),
			)
		)
	);

    $wp_customize->add_setting(
		'social_media_order', 
		array(
			'default'           => $defaults['social_media_order'], 
			'sanitize_callback' => 'travel_monster_sanitize_sortable',
		)
	);

	$wp_customize->add_control(
		new Travel_Monster_Sortable_Control(
			$wp_customize,
			'social_media_order',
			array(
				'section'     => 'main_header_social_media',
				'label'       => __( 'Social Media', 'travel-monster' ),
				'choices'     => array(
            		'tmp_facebook'    => __( 'Facebook', 'travel-monster'),
            		'tmp_twitter'     => __( 'Twitter', 'travel-monster'),
            		'tmp_instagram'   => __( 'Instagram', 'travel-monster'),
            		'tmp_pinterest'   => __( 'Pinterest', 'travel-monster'),
            		'tmp_youtube'     => __( 'Youtube', 'travel-monster'),
            		'tmp_tiktok'      => __( 'TikTok', 'travel-monster'),
            		'tmp_linkedin'    => __( 'LinkedIn', 'travel-monster'),
            		'tmp_whatsapp'    => __( 'WhatsApp', 'travel-monster'),
            		'tmp_viber'       => __( 'Viber', 'travel-monster'),
            		'tmp_telegram'    => __( 'Telegram', 'travel-monster'),
            		'tmp_tripadvisor' => __( 'Trip Advisor', 'travel-monster'),
            		'tmp_wechat'      => __( 'WeChat', 'travel-monster'),
            		'tmp_weibo'       => __( 'Weibo', 'travel-monster'),
            		'tmp_qq'          => __( 'QQ', 'travel-monster')
            	),
			)
		)
    );

    $wp_customize->add_setting(
        'header_social_media_text',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses_post' 
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Note_Control( 
            $wp_customize,
            'header_social_media_text',
            array(
                'section'         => 'main_header_social_media',
                'description'     => sprintf(__( 'You can add links to your social media profiles %1$s here. %2$s', 'travel-monster' ), '<span class="text-inner-link header_social_media_text">', '</span>'),
            )
        )
    );

     /** Mobile Header Settings */
     $wp_customize->add_section(
        'mobile_header_settings',
        array(
            'title'             => __( 'Mobile Header Settings', 'travel-monster' ),
            'panel'           => 'layout_header',
        )
    );

    /** Menu Label */
    $wp_customize->add_setting(
        'mobile_menu_label',
        array(
            'default'           => $defaults['mobile_menu_label'],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'mobile_menu_label',
			array(
				'section' => 'mobile_header_settings',
				'label'   => __( 'Menu Label', 'travel-monster' ),
			)
		)
	);

    $wp_customize->selective_refresh->add_partial( 'mobile_menu_label', array(
        'selector'        => '.mobile-header .mob-menu-op-txt',
        'render_callback' => 'travel_monster_header_mobile_menu_label',
    ) );

    /** Mobile Menu Search */
    $wp_customize->add_setting(
        'ed_mobile_search',
        array(
            'default'           => $defaults['ed_mobile_search'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_mobile_search',
			array(
				'section' => 'mobile_header_settings',
				'label'   => __( 'Show Search', 'travel-monster' ),
			)
		)
	);

    /** Mobile Menu Phone */
    $wp_customize->add_setting(
        'ed_mobile_phone',
        array(
            'default'           => $defaults['ed_mobile_phone'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_mobile_phone',
			array(
				'section' => 'mobile_header_settings',
				'label'   => __( 'Show Phone Number', 'travel-monster' ),
			)
		)
	);

    /** Mobile Menu Email*/
    $wp_customize->add_setting(
        'ed_mobile_email',
        array(
            'default'           => $defaults['ed_mobile_email'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_mobile_email',
			array(
				'section' => 'mobile_header_settings',
				'label'   => __( 'Show Email Address', 'travel-monster' ),
			)
		)
	);

    /** Mobile Menu Social Media */
    $wp_customize->add_setting(
        'ed_mobile_social_media',
        array(
            'default'           => $defaults['ed_mobile_social_media'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_mobile_social_media',
			array(
				'section' => 'mobile_header_settings',
				'label'   => __( 'Show Social Media', 'travel-monster' ),
			)
		)
	);

    /** Mobile Menu Button */
    $wp_customize->add_setting(
        'ed_mobile_button',
        array(
            'default'           => $defaults['ed_mobile_button'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_mobile_button',
			array(
				'section' => 'mobile_header_settings',
				'label'   => __( 'Show Header Button', 'travel-monster' ),
			)
		)
	);

    /** Transparent Header Settings */
    $wp_customize->add_section(
        'main_header_transparent_header',
        array(
            'title'             => __( 'Transparent Header Settings', 'travel-monster' ),
            'panel'           => 'layout_header',
        )
    );

    /** Enable Transparent Header */
    $wp_customize->add_setting(
        'ed_transparent_header',
        array(
            'default'           => false,
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_transparent_header',
			array(
				'section' => 'main_header_transparent_header',
				'label'   => __( 'Enable Transparent Header', 'travel-monster' ),
			)
		)
	);

    $wp_customize->add_setting( 'transparent_logo_upload',
        array(
            'default'           => '',
            'sanitize_callback' => 'travel_monster_sanitize_image',
        )
    );
    
    $wp_customize->add_control( 
        new WP_Customize_Image_Control( $wp_customize, 'transparent_logo_upload',
            array(
                'label'         => esc_html__( 'Transparent Logo', 'travel-monster' ),
                'description'   => esc_html__( 'Choose logo for transparent header.', 'travel-monster' ),
                'section'       => 'main_header_transparent_header',
                'type'          => 'image',
                'active_callback' => 'travel_monster_transparent_header_ac',
            )
        )
    );

    $wp_customize->add_setting(
		'transparent_pages_list',
		array(
			'default'           => array( 'homepage' ),
			'sanitize_callback' => 'travel_monster_sanitize_select',
		)
	);

	$wp_customize->add_control(
		new Travel_Monster_Select_Control(
			$wp_customize,
			'transparent_pages_list',
			array(
				'label'           => __( 'Choose Pages', 'travel-monster' ),
				'section'         => 'main_header_transparent_header',
				'description'     => __( 'Select pages where you want to enable transparent header.', 'travel-monster' ),
				'multiple'        => 8,
				'choices'         => array(
					'homepage'  => __( 'Homepage', 'travel-monster' ),
					'all_pages' => __( 'All Pages', 'travel-monster' ),
					'archive'   => __( 'Archive', 'travel-monster' ),
					'search'    => __( 'Search', 'travel-monster' ),
					'blog'      => __( 'Blog', 'travel-monster' ),
				) + travel_monster_get_pages(),
                'active_callback' => 'travel_monster_transparent_header_ac',
			)
		)
	);

    /** Top Header Background Color */
    $wp_customize->add_setting(
        'transparent_top_header_bg_color',
        array(
            'default'           => $colorDefaults['transparent_top_header_bg_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'transparent_top_header_bg_color',
            array(
                'label'           => __( 'Transparent Background Color', 'travel-monster' ),
                'section'         => 'main_header_transparent_header',
                'active_callback' => 'travel_monster_transparent_header_ac',
            )
        )
    );

    /** Transparent Text Color */
    $wp_customize->add_setting(
        'transparent_top_header_text_color',
        array(
            'default'           => $colorDefaults['transparent_top_header_text_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'transparent_top_header_text_color',
            array(
                'label'           => __( 'Text Color', 'travel-monster' ),
                'section'         => 'main_header_transparent_header',
                'active_callback' => 'travel_monster_transparent_header_ac',
            )
        )
    );

    /** Enable Transparent Header */
    $wp_customize->add_setting(
        'ed_bg_effect',
        array(
            'default'           => false,
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_bg_effect',
			array(
				'section'         => 'main_header_transparent_header',
				'label'           => __( 'Enable Background Effect', 'travel-monster' ),
				'active_callback' => 'travel_monster_transparent_header_ac',
			)
		)
	);

     /** Background Blur */
    $wp_customize->add_setting(
        'background_blur',
        array(
            'default'           => $defaults['background_blur'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'background_blur',
            array(
                'label'           => __( 'Background Blur', 'travel-monster' ),
                'section'         => 'main_header_transparent_header',
                'active_callback' => 'travel_monster_transparent_header_ac',
                'settings'        => array( 'desktop' => 'background_blur' ),
                'choices'         => array(
                    'desktop' => array(
                        'min'  => 1,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
            )
        )
    );

}
add_action( 'customize_register', 'travel_monster_customize_register_layout_header' );