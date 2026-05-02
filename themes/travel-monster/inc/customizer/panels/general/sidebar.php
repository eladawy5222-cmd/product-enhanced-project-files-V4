<?php
/**
 * Sidebar Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_general_sidebar( $wp_customize ){
    
    $defaults = travel_monster_get_general_defaults();

    /** Sidebar */
    $wp_customize->add_section( 
        'general_sidebar_section',
         array(
            'priority' => 20,
            'title'    => __( 'Sidebar', 'travel-monster' ),
            'panel'    => 'general_panel'
        ) 
    );

    /*Sidebar layouts*/
    $wp_customize->add_setting( 
        'layout_style', 
        array(
            'default'           => $defaults['layout_style'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Image_Control(
			$wp_customize,
			'layout_style',
			array(
				'section'     => 'general_sidebar_section',
				'label'       => __( 'Sidebar Layout', 'travel-monster' ),
				'description' => __( 'Choose the sidebar layout for your site.', 'travel-monster' ),
				'svg'         => true,
				'col'         => 'col-2',
				'choices'     => array(
                    'right-sidebar' => array(
                        'label' => __( 'Right Sidebar', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/><rect x="98" y="10" width="39" height="124" fill="black" fill-opacity="0.1"/><rect x="12" y="10" width="75" height="36" fill="#C7C6C6"/><rect x="12" y="50" width="75" height="3" fill="#E6E6E6"/><rect x="12" y="58" width="75" height="2" fill="#E6E6E6"/><rect x="12" y="62" width="70" height="2" fill="#E6E6E6"/><rect x="12" y="66" width="61" height="2" fill="#E6E6E6"/><path d="M47 20L56.5263 35.75H37.4737L47 20Z" fill="#E3E3E3"/><path d="M55.5 26L61.1292 35.75H49.8708L55.5 26Z" fill="#E3E3E3"/><circle cx="60" cy="22" r="2" fill="#E3E3E3"/><rect x="12" y="76" width="75" height="36" fill="black" fill-opacity="0.2"/><rect x="12" y="116" width="75" height="3" fill="#E6E6E6"/><rect x="12" y="124" width="75" height="2" fill="#E6E6E6"/><rect x="12" y="128" width="70" height="2" fill="#E6E6E6"/><rect x="12" y="132" width="61" height="2" fill="#E6E6E6"/><path d="M47 86L56.5263 101.75H37.4737L47 86Z" fill="#E3E3E3"/><path d="M55.5 92L61.1292 101.75H49.8708L55.5 92Z" fill="#E3E3E3"/><circle cx="60" cy="88" r="2" fill="#E3E3E3"/></svg>',
                    ),
                    'left-sidebar' => array(
                        'label' => __( 'Left Sidebar', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/><rect x="12" y="10" width="39" height="124" fill="black" fill-opacity="0.1"/><rect x="62" y="10" width="75" height="36" fill="#C7C6C6"/><rect x="62" y="50" width="75" height="3" fill="#E6E6E6"/><rect x="62" y="58" width="75" height="2" fill="#E6E6E6"/><rect x="62" y="62" width="70" height="2" fill="#E6E6E6"/><rect x="62" y="66" width="61" height="2" fill="#E6E6E6"/><path d="M97 20L106.526 35.75H87.4737L97 20Z" fill="#E3E3E3"/><path d="M105.5 26L111.129 35.75H99.8708L105.5 26Z" fill="#E3E3E3"/><circle cx="110" cy="22" r="2" fill="#E3E3E3"/><rect x="62" y="76" width="75" height="36" fill="black" fill-opacity="0.2"/><rect x="62" y="116" width="75" height="3" fill="#E6E6E6"/><rect x="62" y="124" width="75" height="2" fill="#E6E6E6"/><rect x="62" y="128" width="70" height="2" fill="#E6E6E6"/><rect x="62" y="132" width="61" height="2" fill="#E6E6E6"/><path d="M97 86L106.526 101.75H87.4737L97 86Z" fill="#E3E3E3"/><path d="M105.5 92L111.129 101.75H99.8708L105.5 92Z" fill="#E3E3E3"/><circle cx="110" cy="88" r="2" fill="#E3E3E3"/></svg>',
                    ),
                    'no-sidebar'    => array(
                        'label' => __( 'No Sidebar', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/>\<rect x="13" y="10" width="123" height="36" fill="#C7C6C6"/><rect x="13" y="50" width="123" height="3" fill="#E6E6E6"/><rect x="13" y="58" width="123" height="2" fill="#E6E6E6"/><rect x="13" y="62" width="114.8" height="2" fill="#E6E6E6"/><rect x="13" y="66" width="100.04" height="2" fill="#E6E6E6"/><path d="M70.4 20L86.0231 35.75H54.7769L70.4 20Z" fill="#E3E3E3"/><path d="M84.34 26L93.5718 35.75H75.1082L84.34 26Z" fill="#E3E3E3"/><ellipse cx="91.72" cy="22" rx="3.28" ry="2" fill="#E3E3E3"/><rect x="13" y="76" width="123" height="36" fill="black" fill-opacity="0.2"/><rect x="13" y="116" width="123" height="3" fill="#E6E6E6"/><rect x="13" y="124" width="123" height="2" fill="#E6E6E6"/><rect x="13" y="128" width="114.8" height="2" fill="#E6E6E6"/><rect x="13" y="132" width="100.04" height="2" fill="#E6E6E6"/><path d="M70.4 86L86.0231 101.75H54.7769L70.4 86Z" fill="#E3E3E3"/><path d="M84.34 92L93.5718 101.75H75.1082L84.34 92Z" fill="#E3E3E3"/><ellipse cx="91.72" cy="88" rx="3.28" ry="2" fill="#E3E3E3"/></svg>',
                    )
                ),
			)
		)
    );

    /** Sidebar Width */
    $wp_customize->add_setting(
        'sidebar_width',
        array(
            'default'           => $defaults['sidebar_width'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    /** Sidebar Width */
    $wp_customize->add_setting(
        'tablet_sidebar_width',
        array(
            'default'           => $defaults['tablet_sidebar_width'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'sidebar_width',
            array(
                'label'    => __( 'Sidebar Width', 'travel-monster' ),
                'section'  => 'general_sidebar_section',
                'settings' => array(
                    'desktop' => 'sidebar_width',
                    'tablet' => 'tablet_sidebar_width'
                ),
                'choices' => array(
                    'desktop' => array(
                        'max'  => 50,
                        'step' => 1,
                        'edit' => true,
                        'unit' => '%',
                    ),
                    'tablet' => array(
                        'max'  => 50,
                        'step' => 1,
                        'edit' => true,
                        'unit' => '%',
                    ),
                ),
            )
        )
    );  

    /** Widget Spacing */
    $wp_customize->add_setting(
        'widgets_spacing',
        array(
            'default'           => $defaults['widgets_spacing'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'tablet_widgets_spacing',
        array(
            'default'           => $defaults['tablet_widgets_spacing'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_setting(
        'mobile_widgets_spacing',
        array(
            'default'           => $defaults['mobile_widgets_spacing'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
            'transport'         => 'postMessage',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'widgets_spacing',
            array(
                'label'    => __( 'Widget Spacing', 'travel-monster' ),
                'section'  => 'general_sidebar_section',
                'settings' => array(
                    'desktop' => 'widgets_spacing',
                    'tablet'  => 'tablet_widgets_spacing',
                    'mobile'  => 'mobile_widgets_spacing'
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 5,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'tablet' => array(
                        'min'  => 5,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                    'mobile' => array(
                        'min'  => 5,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => 'px',
                    ),
                ),
            )
        )
    );

     /** Enable Last Widget Sticky */
     $wp_customize->add_setting(
        'ed_last_widget_sticky',
        array(
            'default'           => $defaults['ed_last_widget_sticky'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_last_widget_sticky',
			array(
				'section'	  => 'general_sidebar_section',
				'label'		  => __( 'Last Widget Sticky', 'travel-monster' ),
			)
		)
	);

}
add_action( 'customize_register', 'travel_monster_customize_register_general_sidebar' );