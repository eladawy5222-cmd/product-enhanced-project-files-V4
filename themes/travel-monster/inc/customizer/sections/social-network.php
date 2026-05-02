<?php
/**
 * Social Network Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_footer_social_network( $wp_customize ){

    $defaults = travel_monster_get_general_defaults();

    /** Social Network */
    $wp_customize->add_section( 
        'social_network_settings',
         array(
            'priority' => 31,
            'title'    => __( 'Social Networks', 'travel-monster' ),
        ) 
    );

    $wp_customize->add_setting(
        'social_network_text',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses_post' 
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Note_Control( 
            $wp_customize,
            'social_network_text',
            array(
                'section'     => 'social_network_settings',
                'label'       => __('Social Network Accounts','travel-monster'),
                'description' => __( 'Add the links to your social media accounts and display them across your site.', 'travel-monster' ),
            )
        )
    );

    /** Facebook */
    $wp_customize->add_setting(
        'tmp_facebook',
        array(
            'default'           => $defaults['tmp_facebook'],
            'sanitize_callback' => 'esc_url_raw',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_facebook',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Facebook', 'travel-monster' ),
			)
		)
	);

    /** Twitter */
    $wp_customize->add_setting(
        'tmp_twitter',
        array(
            'default'           => $defaults['tmp_twitter'],
            'sanitize_callback' => 'esc_url_raw',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_twitter',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Twitter', 'travel-monster' ),
			)
		)
	);

     /** Instagram */
     $wp_customize->add_setting(
        'tmp_instagram',
        array(
            'default'           => $defaults['tmp_instagram'],
            'sanitize_callback' => 'esc_url_raw',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_instagram',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Instagram', 'travel-monster' ),
			)
		)
	);

    /** Pinterest */
    $wp_customize->add_setting(
        'tmp_pinterest',
        array(
            'default'           => $defaults['tmp_pinterest'],
            'sanitize_callback' => 'esc_url_raw',
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_pinterest',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Pinterest', 'travel-monster' ),
			)
		)
	);

    /** YouTube  */
    $wp_customize->add_setting(
        'tmp_youtube',
        array(
            'default'           => $defaults['tmp_youtube'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_youtube',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'YouTube', 'travel-monster' ),
			)
		)
	);

    /** TikTok  */
    $wp_customize->add_setting(
        'tmp_tiktok',
        array(
            'default'           => $defaults['tmp_tiktok'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_tiktok',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'TikTok', 'travel-monster' ),
			)
		)
	);

    /** Linkedin */
    $wp_customize->add_setting(
        'tmp_linkedin',
        array(
            'default'           => $defaults['tmp_linkedin'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_linkedin',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Linkedin', 'travel-monster' ),
			)
		)
	);

    /** Whatsapp */
    $wp_customize->add_setting(
        'tmp_whatsapp',
        array(
            'default'           => $defaults['tmp_whatsapp'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_whatsapp',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Whatsapp', 'travel-monster' ),
			)
		)
	);

    /** Viber */
    $wp_customize->add_setting(
        'tmp_viber',
        array(
            'default'           => $defaults['tmp_viber'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_viber',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Viber', 'travel-monster' ),
			)
		)
	);

    /** Telegram */
    $wp_customize->add_setting(
        'tmp_telegram',
        array(
            'default'           => $defaults['tmp_telegram'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_telegram',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Telegram', 'travel-monster' ),
			)
		)
	);

    /** Trip Advisor */
    $wp_customize->add_setting(
        'tmp_tripadvisor',
        array(
            'default'           => $defaults['tmp_tripadvisor'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_tripadvisor',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Trip Advisor', 'travel-monster' ),
			)
		)
	);

    /** We Chat */
    $wp_customize->add_setting(
        'tmp_wechat',
        array(
            'default'           => $defaults['tmp_wechat'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_wechat',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'We Chat', 'travel-monster' ),
			)
		)
	);

    /** Weibo */
    $wp_customize->add_setting(
        'tmp_weibo',
        array(
            'default'           => $defaults['tmp_weibo'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_weibo',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'Weibo', 'travel-monster' ),
			)
		)
	);

    /** QQ */
    $wp_customize->add_setting(
        'tmp_qq',
        array(
            'default'           => $defaults['tmp_qq'],
            'sanitize_callback' => 'esc_url_raw',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'tmp_qq',
			array(
				'section'         => 'social_network_settings',
				'label'           => __( 'QQ', 'travel-monster' ),
			)
		)
	);

}
add_action( 'customize_register', 'travel_monster_customize_register_footer_social_network' );