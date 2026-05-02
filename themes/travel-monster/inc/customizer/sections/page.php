<?php
/**
 * Single Page Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_layout_page( $wp_customize ) {
	
	$defaults = travel_monster_get_general_defaults();

    /** Single Page */
    $wp_customize->add_section(
        'single_page',
        array(
            'title'      => __( 'Page', 'travel-monster' ),
            'priority'   => 70,
            'capability' => 'edit_theme_options',
        )
    );

    /** Page Title */
    $wp_customize->add_setting(
        'single_page_title_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'single_page_title_group',
            array(
                'id'          => 'single_page_title_group',
                'label'       => __( 'Page Title', 'travel-monster' ),
                'section'     => 'single_page',
                'type'        => 'group',
                'style'       => 'collapsible',
            )
        )
    );

    /** Page Title */
    $wp_customize->add_setting(
        'ed_page_title',
        array(
            'default'           => $defaults['ed_page_title'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_page_title',
			array(
				'section' => 'single_page',
				'label'   => __( 'Show Title', 'travel-monster' ),
				'group'   => 'single_page_title_group',
			)
		)
	);

     /** Horizontal Alignment */
     $wp_customize->add_setting( 
        'page_alignment', 
        array(
            'default'           =>  $defaults['page_alignment'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio',
            'transport'         => 'postMessage'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'page_alignment',
			array(
				'section'	  => 'single_page',
				'label'       => __( 'Horizontal Alignment', 'travel-monster' ),
                'group'       => 'single_page_title_group',
				'choices'	  => array(
					'left'   => __( 'Left', 'travel-monster' ),
					'center' => __( 'Center', 'travel-monster' ),
					'right'  => __( 'Right', 'travel-monster' ),
				),
			)
		)
	);

	
    /** Sidebar Layouts Title */
    $wp_customize->add_setting(
        'single_page_sidebar_layout_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'single_page_sidebar_layout_group',
            array(
                'id'          => 'single_page_sidebar_layout_group',
                'label'       => __( 'Sidebar Layouts', 'travel-monster' ),
                'section'     => 'single_page',
                'type'        => 'group',
                'style'       => 'collapsible',
            )
        )
    );
     /** Sidebar Layout */
     $wp_customize->add_setting( 
        'page_sidebar_layout', 
        array(
            'default'           => $defaults['page_sidebar_layout'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Image_Control(
			$wp_customize,
			'page_sidebar_layout',
			array(
				'section'	  => 'single_page',
				'label'		  => __( 'Page Sidebar Layout', 'travel-monster' ),
                'svg'         => true,
                'group'       => 'single_page_sidebar_layout_group',  
				'choices'	  => array(
                    'right-sidebar' => array(
                        'label' => __( 'Right Sidebar', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/><rect x="98" y="10" width="39" height="124" fill="black" fill-opacity="0.1"/><rect x="12" y="10" width="75" height="36" fill="#C7C6C6"/><rect x="12" y="50" width="75" height="3" fill="#E6E6E6"/><rect x="12" y="58" width="75" height="2" fill="#E6E6E6"/><rect x="12" y="62" width="70" height="2" fill="#E6E6E6"/><rect x="12" y="66" width="61" height="2" fill="#E6E6E6"/><path d="M47 20L56.5263 35.75H37.4737L47 20Z" fill="#E3E3E3"/><path d="M55.5 26L61.1292 35.75H49.8708L55.5 26Z" fill="#E3E3E3"/><circle cx="60" cy="22" r="2" fill="#E3E3E3"/><rect x="12" y="76" width="75" height="36" fill="black" fill-opacity="0.2"/><rect x="12" y="116" width="75" height="3" fill="#E6E6E6"/><rect x="12" y="124" width="75" height="2" fill="#E6E6E6"/><rect x="12" y="128" width="70" height="2" fill="#E6E6E6"/><rect x="12" y="132" width="61" height="2" fill="#E6E6E6"/><path d="M47 86L56.5263 101.75H37.4737L47 86Z" fill="#E3E3E3"/><path d="M55.5 92L61.1292 101.75H49.8708L55.5 92Z" fill="#E3E3E3"/><circle cx="60" cy="88" r="2" fill="#E3E3E3"/></svg>',
                    ),
                    'left-sidebar' => array(
                        'label' => __( 'Left Sidebar', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/><rect x="12" y="10" width="39" height="124" fill="black" fill-opacity="0.1"/><rect x="62" y="10" width="75" height="36" fill="#C7C6C6"/><rect x="62" y="50" width="75" height="3" fill="#E6E6E6"/><rect x="62" y="58" width="75" height="2" fill="#E6E6E6"/><rect x="62" y="62" width="70" height="2" fill="#E6E6E6"/><rect x="62" y="66" width="61" height="2" fill="#E6E6E6"/><path d="M97 20L106.526 35.75H87.4737L97 20Z" fill="#E3E3E3"/><path d="M105.5 26L111.129 35.75H99.8708L105.5 26Z" fill="#E3E3E3"/><circle cx="110" cy="22" r="2" fill="#E3E3E3"/><rect x="62" y="76" width="75" height="36" fill="black" fill-opacity="0.2"/><rect x="62" y="116" width="75" height="3" fill="#E6E6E6"/><rect x="62" y="124" width="75" height="2" fill="#E6E6E6"/><rect x="62" y="128" width="70" height="2" fill="#E6E6E6"/><rect x="62" y="132" width="61" height="2" fill="#E6E6E6"/><path d="M97 86L106.526 101.75H87.4737L97 86Z" fill="#E3E3E3"/><path d="M105.5 92L111.129 101.75H99.8708L105.5 92Z" fill="#E3E3E3"/><circle cx="110" cy="88" r="2" fill="#E3E3E3"/></svg>',
                    ),
                    'no-sidebar'    => array(
                        'label' => __( 'Full Width', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/><rect x="13" y="10" width="123" height="36" fill="#C7C6C6"/><rect x="13" y="50" width="123" height="3" fill="#E6E6E6"/><rect x="13" y="58" width="123" height="2" fill="#E6E6E6"/><rect x="13" y="62" width="114.8" height="2" fill="#E6E6E6"/><rect x="13" y="66" width="100.04" height="2" fill="#E6E6E6"/><path d="M70.4 20L86.0231 35.75H54.7769L70.4 20Z" fill="#E3E3E3"/><path d="M84.34 26L93.5718 35.75H75.1082L84.34 26Z" fill="#E3E3E3"/><ellipse cx="91.72" cy="22" rx="3.28" ry="2" fill="#E3E3E3"/><rect x="13" y="76" width="123" height="36" fill="black" fill-opacity="0.2"/><rect x="13" y="116" width="123" height="3" fill="#E6E6E6"/><rect x="13" y="124" width="123" height="2" fill="#E6E6E6"/><rect x="13" y="128" width="114.8" height="2" fill="#E6E6E6"/><rect x="13" y="132" width="100.04" height="2" fill="#E6E6E6"/><path d="M70.4 86L86.0231 101.75H54.7769L70.4 86Z" fill="#E3E3E3"/><path d="M84.34 92L93.5718 101.75H75.1082L84.34 92Z" fill="#E3E3E3"/><ellipse cx="91.72" cy="88" rx="3.28" ry="2" fill="#E3E3E3"/></svg>',
                    ),
                    'fullwidth-centered'=> array(
                        'label' => __( 'Fullwidth Centered', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/><rect x="38" y="13" width="75" height="36" fill="#C7C6C6"/><rect x="38" y="53" width="75" height="3" fill="#E6E6E6"/><rect x="38" y="61" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="76" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="91" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="107" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="123" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="65" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="80" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="95" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="111" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="127" width="75" height="2" fill="#E6E6E6"/><rect x="38" y="69" width="68" height="2" fill="#E6E6E6"/><rect x="38" y="84" width="69" height="2" fill="#E6E6E6"/><rect x="38" y="99" width="71" height="2" fill="#E6E6E6"/><rect x="38" y="115" width="68" height="2" fill="#E6E6E6"/><rect x="38" y="131" width="61" height="2" fill="#E6E6E6"/><path d="M73 23L82.5263 38.75H63.4737L73 23Z" fill="#E3E3E3"/><path d="M81.5 29L87.1292 38.75H75.8708L81.5 29Z" fill="#E3E3E3"/><circle cx="86" cy="25" r="2" fill="#E3E3E3"/></svg>',
                    ),
				)
			)
		)
    );

    /** Crop Feature Image */
    $wp_customize->add_setting(
        'ed_page_image',
        array(
            'default'           => $defaults['ed_page_image'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_page_image',
			array(
				'section' => 'single_page',
				'label'   => __( 'Show Featured Image', 'travel-monster' ),
			)
		)
	);

    /** Crop Feature Image */
    $wp_customize->add_setting(
        'ed_page_comments',
        array(
            'default'           => $defaults['ed_page_comments'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_page_comments',
			array(
				'section' => 'single_page',
				'label'   => __( 'Show Comments', 'travel-monster' ),
			)
		)
	);
}
add_action( 'customize_register', 'travel_monster_customize_register_layout_page' );