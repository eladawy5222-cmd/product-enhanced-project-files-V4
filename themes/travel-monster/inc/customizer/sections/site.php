<?php
/**
 * Site Title Setting
 *
 * @package Travel Monster
 */

/**
 * Add postMessage support for site title and description for the Theme Customizer.
 *
 * @param WP_Customize_Manager $wp_customize Theme Customizer object.
 */
function travel_monster_customize_register( $wp_customize ) {

    $defaults      = travel_monster_get_site_defaults();
    $typoDefaults  = travel_monster_get_typography_defaults();
    $colorDefaults = travel_monster_get_color_defaults();

	$wp_customize->get_setting( 'blogname' )->transport         = 'postMessage';
	$wp_customize->get_setting( 'blogdescription' )->transport  = 'postMessage';
	$wp_customize->get_setting( 'header_textcolor' )->transport = 'postMessage';
	$wp_customize->get_section( 'title_tagline' )->priority     = 1;
	$wp_customize->get_section( 'header_image' )->priority      = 117;
	$wp_customize->get_section( 'background_image' )->priority  = 119;
	$wp_customize->get_control( 'custom_logo' )->priority       = 5;
	$wp_customize->get_control( 'blogname' )->priority          = 7;
	$wp_customize->get_control( 'blogdescription' )->priority   = 8;
	$wp_customize->get_control( 'site_icon' )->priority         = 9;
	$widgetsPanel           = (object)$wp_customize->get_panel( 'widgets' );
	$widgetsPanel->priority = 118;

	if ( isset( $wp_customize->selective_refresh ) ) {
		$wp_customize->selective_refresh->add_partial(
			'blogname',
			array(
				'selector'        => '.site-title a',
				'render_callback' => 'travel_monster_customize_partial_blogname',
			)
		);
		$wp_customize->selective_refresh->add_partial(
			'blogdescription',
			array(
				'selector'        => '.site-description',
				'render_callback' => 'travel_monster_customize_partial_blogdescription',
			)
		);
    }

    $wp_customize->add_setting(
        'hide_title',
        array(
            'default'           => $defaults['hide_title'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control(
            $wp_customize,
            'hide_title',
            array(
                'label'    => __( 'Hide Site Title', 'travel-monster' ),
                'section'  => 'title_tagline',
                'priority' => 7,
            )
        )
    );

    $wp_customize->add_setting(
        'hide_tagline',
        array(
            'default'           => $defaults['hide_tagline'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control(
            $wp_customize,
            'hide_tagline',
            array(
                'label'    => __( 'Hide Site Tagline', 'travel-monster' ),
                'section'  => 'title_tagline',
                'priority' => 8,
            )
        )
    );

    /** Logo Width */
    $wp_customize->add_setting(
        'logo_width',
        array(
            'default'           => $defaults['logo_width'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'tablet_logo_width',
        array(
            'default'           => $defaults['tablet_logo_width'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'mobile_logo_width',
        array(
            'default'           => $defaults['mobile_logo_width'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'logo_width',
            array(
                'label'    => __( 'Logo Width', 'travel-monster' ),
                'section'  => 'title_tagline',
                'priority' => 6,
                'settings' => array(
                    'desktop' => 'logo_width',
                    'tablet'  => 'tablet_logo_width',
                    'mobile'  => 'mobile_logo_width'
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 30,
                        'max'  => 400,
                        'step' => 10,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'tablet' => array(
                        'min'  => 30,
                        'max'  => 400,
                        'step' => 10,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'mobile' => array(
                        'min'  => 30,
                        'max'  => 400,
                        'step' => 10,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
            )
        )
    );

    /** Site Title Hr */
    $wp_customize->add_setting(
        'site_title_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'site_title_group',
            array(
                'id'          => 'site_title_group',
                'label'       => __( 'Site Title Typography', 'travel-monster' ),
                'section'     => 'title_tagline',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priorit'     => 13,
            )
        )
    );

    $wp_customize->add_setting(
        'site_title[family]',
        array(
            'default'           => $typoDefaults['site_title']['family'],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage',
        )
    );
    
    $wp_customize->add_setting(
        'site_title[variants]',
        array(
            'default'           => $typoDefaults['site_title']['variants'],
            'sanitize_callback' => 'travel_monster_sanitize_variants',
            'transport'         => 'postMessage',
        )
    );
    $wp_customize->add_setting(
        'site_title[category]',
        array(
            'default'           => $typoDefaults['site_title']['category'],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage',
        )
    );
    
    $wp_customize->add_setting(
        'site_title[weight]',
        array(
            'default'           => $typoDefaults['site_title']['weight'],
            'sanitize_callback' => 'sanitize_key',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'site_title[transform]',
        array(
            'default'           => $typoDefaults['site_title']['transform'],
            'sanitize_callback' => 'sanitize_key',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Typography_Customize_Control(
            $wp_customize,
            'site_title_typography',
            array(
                'section'  => 'title_tagline',
                'settings' => array(
                    'family'    => 'site_title[family]',
                    'variant'   => 'site_title[variants]',
                    'category'  => 'site_title[category]'
                ),
                'priority' => 13,
                'group'    => 'site_title_group',
            )
        )
    );
    
    /** site_title Font Size */
    $wp_customize->add_setting(
        'site_title[desktop][font_size]',
        array(
            'default'           => $typoDefaults['site_title']['desktop']['font_size'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'site_title[tablet][font_size]',
        array(
            'default'           => $typoDefaults['site_title']['tablet']['font_size'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'site_title[mobile][font_size]',
        array(
            'default'           => $typoDefaults['site_title']['mobile']['font_size'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'site_title[font_size]',
            array(
                'label'    => __( 'Font Size', 'travel-monster' ),
                'section'  => 'title_tagline',
                'settings' => array(
                    'desktop' => 'site_title[desktop][font_size]',
                    'tablet'  => 'site_title[tablet][font_size]',
                    'mobile'  => 'site_title[mobile][font_size]',
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 1,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'tablet' => array(
                        'min'  => 1,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'mobile' => array(
                        'min'  => 1,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),    
                ),
                'priority' => 13,
                'group'    => 'site_title_group',
            )
        )
    );

    /** site_title Line Height */
    $wp_customize->add_setting(
        'site_title[desktop][line_height]',
        array(
            'default'           => $typoDefaults['site_title']['desktop']['line_height'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_floatval',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'site_title[tablet][line_height]',
        array(
            'default'           => $typoDefaults['site_title']['tablet']['line_height'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_floatval',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'site_title[mobile][line_height]',
        array(
            'default'           => $typoDefaults['site_title']['mobile']['line_height'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_floatval',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'site_title[line_height]',
            array(
                'label'    => __( 'Line Height', 'travel-monster' ),
                'section'  => 'title_tagline',
                'settings' => array(
                    'desktop' => 'site_title[desktop][line_height]',
                    'tablet' => 'site_title[tablet][line_height]',
                    'mobile' => 'site_title[mobile][line_height]',
                ),
                'priority' => 13,
                'group'    => 'site_title_group',
                'choices' => array(
                    'desktop' => array(
                        'min'  => 1,
                        'max'  => 20,
                        'step' => 0.01,
                        'edit' => true,
                        'unit' => 'em',
                    ),
                    'tablet' => array(
                        'min'  => 1,
                        'max'  => 20,
                        'step' => 0.01,
                        'edit' => true,
                        'unit' => 'em',
                    ),
                    'mobile' => array(
                        'min'  => 1,
                        'max'  => 20,
                        'step' => 0.01,
                        'edit' => true,
                        'unit' => 'em',
                    ),
                ),
            )
        )
    );

    /** site_title Letter Spacing */
    $wp_customize->add_setting(
        'site_title[desktop][letter_spacing]',
        array(
            'default'           => $typoDefaults['site_title']['desktop']['letter_spacing'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'site_title[tablet][letter_spacing]',
        array(
            'default'           => $typoDefaults['site_title']['tablet']['letter_spacing'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'site_title[mobile][letter_spacing]',
        array(
            'default'           => $typoDefaults['site_title']['mobile']['letter_spacing'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'site_title[letter_spacing]',
            array(
                'label'    => __( 'Letter Spacing', 'travel-monster' ),
                'section'  => 'title_tagline',
                'settings' => array(
                    'desktop' => 'site_title[desktop][letter_spacing]',
                    'tablet'  => 'site_title[tablet][letter_spacing]',
                    'mobile'  => 'site_title[mobile][letter_spacing]',
                ),
                'priority' => 13,
                'group'    => 'site_title_group',
                'choices' => array(
                    'desktop' => array(
                        'max'  => 20,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'tablet' => array(
                        'max'  => 20,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'mobile' => array(
                        'max'  => 20,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
            )
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Typography_Customize_Control(
            $wp_customize,
            'site_title_typography_weight',
            array(
                'section'  => 'title_tagline',
                'settings' => array(
                    'weight'    => 'site_title[weight]'
                ),
                'priority' => 13,
                'group'    => 'site_title_group',
            )
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Typography_Customize_Control(
            $wp_customize,
            'site_title_typography_transform',
            array(
                'section'  => 'title_tagline',
                'settings' => array(
                    'transform' => 'site_title[transform]',
                ),
                'priority' => 13,
                'group'    => 'site_title_group',
            )
        )
    );

     /** Site Title Color Group */
     $wp_customize->add_setting(
        'site_title_color_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'site_title_color_group',
            array(
                'id'          => 'site_title_color_group',
                'label'       => __( 'Site Title Colors', 'travel-monster' ),
                'section'     => 'title_tagline',
                'type'        => 'group',
                'style'       => 'collapsible',
            )
        )
    );

      /** Site Title Color*/
      $wp_customize->add_setting(
        'site_title_color',
        array(
            'default'           => $colorDefaults['site_title_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );
    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'site_title_color',
            array(
                'label'    => __( 'Site Title Color', 'travel-monster' ),
                'section'  => 'title_tagline',
                'priority' => 14,
                'group'    => 'site_title_color_group'
            )
        )
    );

    /** Site Title Color*/
    $wp_customize->add_setting( 
        'site_tagline_color', 
        array(
            'default'           => $colorDefaults['site_tagline_color'],
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
            'transport'         => 'postMessage',
        ) 
    );

    $wp_customize->add_control( 
        new Travel_Monster_Alpha_Color_Customize_Control( 
            $wp_customize, 
            'site_tagline_color', 
            array(
                'label'       => __( 'Site Tagline Color', 'travel-monster' ),
                'section'     => 'title_tagline',
                'priority'    => 14,
                'group'    => 'site_title_color_group'
            )
        )
    );

}
add_action( 'customize_register', 'travel_monster_customize_register' );