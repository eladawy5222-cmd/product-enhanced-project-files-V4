<?php
/**
 * Colors
 *
 * @package Travel Monster
 */

function travel_monster_customize_register_colors_panel( $wp_customize ) {

    $defaults = travel_monster_get_color_defaults();

    /** Move Background Image section to appearance panel */
    $wp_customize->get_section( 'colors' )->priority = 22;


    /** Color Preset */
    $wp_customize->add_setting(
		'color_preset_style',
		array(
			'default'           => 'one',
			'sanitize_callback' => 'travel_monster_sanitize_select_radio',
			'transport'         => 'postMessage',
		)
	);

	$wp_customize->add_control(
		new Travel_Monster_Radio_Image_Control(
			$wp_customize,
			'color_preset_style',
			array(
				'section'  => 'colors',
				'label'    => __( 'Choose Color Presets', 'travel-monster' ),
				'col'      => 'col-1',
				'svg'      => true,
				'priority' => 10,
				'choices'  => array(
					'one'   => array(
						'label' => esc_html__( 'Default Style', 'travel-monster' ),
						'path'  => travel_monster_color_preset_style_list( 'one' ),
					),
					'two'   => array(
						'label' => esc_html__( 'Style Two', 'travel-monster' ),
						'path'  => travel_monster_color_preset_style_list( 'two' ),
					),
					'three' => array(
						'label' => esc_html__( 'Style Three', 'travel-monster' ),
						'path'  => travel_monster_color_preset_style_list( 'three' ),
					),
					'four'  => array(
						'label' => esc_html__( 'Style Four', 'travel-monster' ),
						'path'  => travel_monster_color_preset_style_list( 'four' ),
					),
				),
			)
		)
	);

    /** Primary Color*/
    $wp_customize->add_setting( 
        'primary_color', 
        array(
            'default'           =>  $defaults['primary_color'],
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
            'transport'         => 'postMessage',
        ) 
    );

    $wp_customize->add_control( 
        new Travel_Monster_Alpha_Color_Customize_Control( 
            $wp_customize, 
            'primary_color', 
            array(
                'label'    => __( 'Primary Color', 'travel-monster' ),
                'section'  => 'colors',
                'priority' => 10,
            )
        )
    );

    /** Secondary Color*/
    $wp_customize->add_setting( 
        'secondary_color', 
        array(
            'default'           =>  $defaults['secondary_color'],
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
            'transport'         => 'postMessage',
        ) 
    );

    $wp_customize->add_control( 
        new Travel_Monster_Alpha_Color_Customize_Control( 
            $wp_customize, 
            'secondary_color', 
            array(
                'label'       => __( 'Secondary Color', 'travel-monster' ),
                'section'     => 'colors',
                'priority'    => 10,
            )
        )
    );

    /** Body Font Color*/
    $wp_customize->add_setting( 
        'body_font_color', 
        array(
            'default'           =>  $defaults['body_font_color'],
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
            'transport'         => 'postMessage',
        ) 
    );

    $wp_customize->add_control( 
        new Travel_Monster_Alpha_Color_Customize_Control( 
            $wp_customize, 
            'body_font_color', 
            array(
                'label'       => __( 'Body Font Color', 'travel-monster' ),
                'section'     => 'colors',
                'priority'    => 10,
            )
        )
    );

    /** Heading Color*/
    $wp_customize->add_setting( 
        'heading_color', 
        array(
            'default'           =>  $defaults['heading_color'],
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
            'transport'         => 'postMessage',
        ) 
    );

    $wp_customize->add_control( 
        new Travel_Monster_Alpha_Color_Customize_Control( 
            $wp_customize, 
            'heading_color', 
            array(
                'label'       => __( 'Heading Color', 'travel-monster' ),
                'section'     => 'colors',
                'priority'    => 10,
            )
        )
    );

    /** Section Background Color*/
    $wp_customize->add_setting(
        'section_bg_color', 
        array(
            'default'           =>  $defaults['section_bg_color'],
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
            'transport'         => 'postMessage',
        ) 
    );

    $wp_customize->add_control( 
        new Travel_Monster_Alpha_Color_Customize_Control( 
            $wp_customize, 
            'section_bg_color', 
            array(
                'label'       => __( 'Section Background Color', 'travel-monster' ),
                'section'     => 'colors',
                'priority'    => 10,
            )
        )
    );

    /** Accent Color One*/
    $wp_customize->add_setting(
		'accent_color_one',
		array(
			'default'           => $defaults['accent_color_one'],
			'sanitize_callback' => 'travel_monster_sanitize_rgba',
			'transport'         => 'postMessage',
		)
	);

    $wp_customize->add_control(
		new Travel_Monster_Alpha_Color_Customize_Control(
			$wp_customize,
			'accent_color_one',
			array(
				'label'       => __( 'Accent Color One', 'travel-monster' ),
				'section'     => 'colors',
				'priority'    => 10,
			)
		)
	);

    /** Accent Color Two*/
	$wp_customize->add_setting(
		'accent_color_two',
		array(
			'default'           => $defaults['accent_color_two'],
			'sanitize_callback' => 'travel_monster_sanitize_rgba',
			'transport'         => 'postMessage',
		)
	);

    $wp_customize->add_control(
		new Travel_Monster_Alpha_Color_Customize_Control(
			$wp_customize,
			'accent_color_two',
			array(
				'label'       => __( 'Accent Color Two', 'travel-monster' ),
				'section'     => 'colors',
				'priority'    => 10,
			)
		)
	);

    /** Site Background Color*/
    $wp_customize->add_setting( 
        'site_bg_color', 
        array(
            'default'           =>  $defaults['site_bg_color'],
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
            'transport'         => 'postMessage',
        ) 
    );

    $wp_customize->add_control( 
        new Travel_Monster_Alpha_Color_Customize_Control( 
            $wp_customize, 
            'site_bg_color', 
            array(
                'label'       => __( 'Site Background', 'travel-monster' ),
                'section'     => 'colors',
                'priority'    => 10,
            )
        )
    );

    /** Remove site background color*/
    $wp_customize->remove_control( 'background_color' );

}
add_action( 'customize_register', 'travel_monster_customize_register_colors_panel' );