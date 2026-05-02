<?php
/**
 * Scroll to Top Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_general_scroll_to_top( $wp_customize ){
    
    $defaults = travel_monster_get_general_defaults();

    /** Scroll to Top */
    $wp_customize->add_section( 
        'general_scroll_top_section',
         array(
            'priority' => 50,
            'title'    => __( 'Scroll to Top', 'travel-monster' ),
            'panel'    => 'general_panel'
        ) 
    );

    $wp_customize->add_setting(
        'ed_scroll_top',
        array(
            'default'           => $defaults['ed_scroll_top'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control( 
            $wp_customize,
            'ed_scroll_top',
            array(
				'section' => 'general_scroll_top_section',
				'label'   => __( 'Show Scroll to Top', 'travel-monster' ),
			)
        )
    );

    /** Scroll to Top Icon size */
    $wp_customize->add_setting(
        'scroll_top_size',
        array(
            'default'           => $defaults['scroll_top_size'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'tablet_scroll_top_size',
        array(
            'default'           => $defaults['tablet_scroll_top_size'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'mobile_scroll_top_size',
        array(
            'default'           => $defaults['mobile_scroll_top_size'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'scroll_top_size',
            array(
                'label'    => __( 'Icon Size', 'travel-monster' ),
                'section'  => 'general_scroll_top_section',
                'settings' => array(
                    'desktop' => 'scroll_top_size',
                    'tablet'  => 'tablet_scroll_top_size',
                    'mobile'  => 'mobile_scroll_top_size'
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 1,
                        'max'  => 50,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'tablet' => array(
                        'min'  => 1,
                        'max'  => 50,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'mobile' => array(
                        'min'  => 1,
                        'max'  => 50,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
                'active_callback' => 'travel_monster_scroll_to_top_ac'
            )
        )
    );

    /*Scroll to Top*/
    $wp_customize->add_setting( 
        'scroll_top_alignment', 
        array(
            'default'           => $defaults['scroll_top_alignment'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio',
            'transport'         => 'postMessage'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'scroll_top_alignment',
			array(
				'section' => 'general_scroll_top_section',
				'label'   => __( 'Alignment', 'travel-monster' ),
				'choices' => array(
					'left'  => __( 'Left', 'travel-monster' ),
					'right' => __( 'Right', 'travel-monster' ),
                ),
                'active_callback' => 'travel_monster_scroll_to_top_ac',
			)
		)
	);

    /** Scroll to Top Bottom Offset */
    $wp_customize->add_setting(
        'scroll_top_bottom_offset',
        array(
            'default'           => $defaults['scroll_top_bottom_offset'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'tablet_scroll_top_bottom_offset',
        array(
            'default'           => $defaults['tablet_scroll_top_bottom_offset'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'mobile_scroll_top_bottom_offset',
        array(
            'default'           => $defaults['mobile_scroll_top_bottom_offset'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'scroll_top_bottom_offset',
            array(
                'label'    => __( 'Bottom Offset', 'travel-monster' ),
                'section'  => 'general_scroll_top_section',
                'settings' => array(
                    'desktop' => 'scroll_top_bottom_offset',
                    'tablet'  => 'tablet_scroll_top_bottom_offset',
                    'mobile'  => 'mobile_scroll_top_bottom_offset'
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 5,
                        'max'  => 500,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'tablet' => array(
                        'min'  => 5,
                        'max'  => 500,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'mobile' => array(
                        'min'  => 5,
                        'max'  => 500,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
                'active_callback' => 'travel_monster_scroll_to_top_ac'
            )
        )
    );

    /** Scroll to Top Side Offset */
    $wp_customize->add_setting(
        'scroll_top_side_offset',
        array(
            'default'           => $defaults['scroll_top_side_offset'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'tablet_scroll_top_side_offset',
        array(
            'default'           => $defaults['tablet_scroll_top_side_offset'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'mobile_scroll_top_side_offset',
        array(
            'default'           => $defaults['mobile_scroll_top_side_offset'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'scroll_top_side_offset',
            array(
                'label'    => __( 'Side Offset', 'travel-monster' ),
                'section'  => 'general_scroll_top_section',
                'settings' => array(
                    'desktop' => 'scroll_top_side_offset',
                    'tablet'  => 'tablet_scroll_top_side_offset',
                    'mobile'  => 'mobile_scroll_top_side_offset'
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 5,
                        'max'  => 500,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'tablet' => array(
                        'min'  => 5,
                        'max'  => 500,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'mobile' => array(
                        'min'  => 5,
                        'max'  => 500,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
                'active_callback' => 'travel_monster_scroll_to_top_ac'
            )
        )
    );

}
add_action( 'customize_register', 'travel_monster_customize_register_general_scroll_to_top' );