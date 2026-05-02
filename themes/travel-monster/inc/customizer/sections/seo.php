<?php
/**
 * SEO Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_seo_setting( $wp_customize ){
    $defaults = travel_monster_get_general_defaults();

    /** SEO */
    $wp_customize->add_section( 
        'seo_settings',
         array(
            'priority' => 31,
            'title'    => __( 'SEO Settings', 'travel-monster' ),
        ) 
    );
    
    /** Enable breadcrumb */
    $wp_customize->add_setting( 
        'ed_breadcrumb', 
        array(
            'default'           => $defaults['ed_breadcrumb'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_breadcrumb',
			array(
				'section'     => 'seo_settings',
				'label'	      => __( 'Show Breadcrumb', 'travel-monster' ),
			)
		)
	);
    
    /** Breadcrumb Home Text */
    $wp_customize->add_setting(
        'home_text',
        array(
            'default'           => $defaults[ 'home_text' ],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Text_Control( 
			$wp_customize,
            'home_text',
            array(
                'type'            => 'text',
                'section'         => 'seo_settings',
                'label'           => __( 'Breadcrumb Home Text', 'travel-monster' ),
                'active_callback' => 'travel_monster_seo_breadcrumb_ac'
            )
        )
    );

    $wp_customize->selective_refresh->add_partial( 'home_text', array(
        'selector'        => '.travel-monster-breadcrumbs .home-text',
        'render_callback' => 'travel_monster_get_home_text',
    ) );

    /** Separator Text */
    $wp_customize->add_setting( 
        'separator_icon', 
        array(
            'default'           => $defaults[ 'separator_icon' ],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio',
            'transport'         => 'postMessage'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Image_Control(
			$wp_customize,
			'separator_icon',
			array(
				'section'     => 'seo_settings',
				'label'       => __( 'Separator', 'travel-monster' ),
				'svg'         => true,
				'col'         => 'col-3',
				'choices'     => array(
                    'one' => array(
                        'label' => __( 'Type 1', 'travel-monster' ),
                        'path'  => '<svg width="15" height="15" viewBox="0 0 20 20"><path d="M7.7,20c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1.1,0-1.5l8.1-8.1L6.7,1.8c-0.4-0.4-0.4-1.1,0-1.5
                        c0.4-0.4,1.1-0.4,1.5,0l9.1,9.1c0.4,0.4,0.4,1.1,0,1.5l-8.8,8.9C8.2,19.9,7.9,20,7.7,20z" opacity="0.7"/></svg>',
                    ),
                    'two' => array(
                        'label' => __( 'Type 2', 'travel-monster' ),                        
                        'path'  => '<svg width="15" height="15" viewBox="0 0 20 20"><polygon points="7,0 18,10 7,20 " opacity="0.7"/></svg>',
                    ),
                    'three' => array(
                        'label' => __( 'Type 3', 'travel-monster' ),
                        'path'  => '<svg width="15" height="15" viewBox="0 0 20 20"><path d="M6.1,20c-0.2,0-0.3,0-0.5-0.1c-0.5-0.2-0.7-0.8-0.4-1.3l9.5-17.9C15,0.1,15.6,0,16.1,0.2
                        c0.5,0.2,0.7,0.8,0.4,1.3L6.9,19.4C6.8,19.8,6.5,19.9,6.1,20z" opacity="0.7"/></svg>',
                    )
                ),
                'active_callback' => 'travel_monster_seo_breadcrumb_ac'
			)
		)
    );

    /** Enable last updated date */
    $wp_customize->add_setting( 
        'ed_post_update_date', 
        array(
            'default'           => $defaults[ 'ed_post_update_date' ],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_post_update_date',
			array(
				'section'     => 'seo_settings',
				'label'	      => __( 'Show Last Updated Post Date', 'travel-monster' ),
                'description' => __( 'Enable to show last updated post date on listing as well as in single post.', 'travel-monster' ),
			)
		)
	);
}
add_action( 'customize_register', 'travel_monster_customize_register_seo_setting' );