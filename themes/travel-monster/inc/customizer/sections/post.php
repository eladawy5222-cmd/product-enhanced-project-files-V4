<?php
/**
 * Single Post Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_layout_post( $wp_customize ) {
	
	$defaults = travel_monster_get_general_defaults();

    /** Single Post */
    $wp_customize->add_section(
        'single_post',
        array(
            'title'    => __( 'Single Post', 'travel-monster' ),
            'priority' => 70,
            'capability' => 'edit_theme_options',
        )
    );

     /** Sidebar Layouts Title */
     $wp_customize->add_setting(
        'single_post_sidebar_layout_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'single_post_sidebar_layout_group',
            array(
                'id'          => 'single_post_sidebar_layout_group',
                'label'       => __( 'Sidebar Layouts', 'travel-monster' ),
                'section'     => 'single_post',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priority'    => 20,
            )
        )
    );
     /** Single Post Sidebar Layout */
     $wp_customize->add_setting( 
        'post_sidebar_layout', 
        array(
            'default'           => $defaults[ 'post_sidebar_layout' ],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Image_Control(
			$wp_customize,
			'post_sidebar_layout',
			array(
				'section'	  => 'single_post',
				'label'		  => __( 'Single Sidebar Layout', 'travel-monster' ),
                'svg'         => true,
                'group'       => 'single_post_sidebar_layout_group',  
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
        'ed_crop_single_image',
        array(
            'default'           => $defaults[ 'ed_crop_single_image' ],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_crop_single_image',
			array(
				'section'     => 'single_post',
				'label'       => __( 'Crop Featured Image', 'travel-monster' ),
				'description' => __( 'This setting crops the featured image to recommended size. If set to false, it displays the image exactly as uploaded.', 'travel-monster' ),
                'priority'    => 25,
			)
		)
	);

    /** Single Crop Feature Image */
    $wp_customize->add_setting(
        'single_post_meta_settings_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'single_post_meta_settings_group',
            array(
                'id'          => 'single_post_meta_settings_group',
                'label'       => __( 'Post Meta Settings', 'travel-monster' ),
                'section'     => 'single_post',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priority'    => 30,
            )
        )
    );
    
    /** Meta Order */
    $wp_customize->add_setting(
		'single_post_meta_order', 
		array(
			'default'           => $defaults['single_post_meta_order'], 
			'sanitize_callback' => 'travel_monster_sanitize_sortable',
		)
	);

	$wp_customize->add_control(
		new Travel_Monster_Sortable_Control(
			$wp_customize,
			'single_post_meta_order',
			array(
				'section'     => 'single_post',
				'label'       => __( 'Meta Order', 'travel-monster' ),
				'choices'     => array(
            		'author'  => __( 'Author', 'travel-monster' ),
            		'date'    => __( 'Date', 'travel-monster' ),
            		'comment' => __( 'Comment', 'travel-monster' ),
            	),
                'group' => 'single_post_meta_settings_group',
                'priority'    => 40,
			)
		)
    );

    /** Show Author Tags */
    $wp_customize->add_setting(
        'ed_author',
        array(
            'default'           => $defaults['ed_author'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
            )
        );
        
    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control( 
            $wp_customize,
            'ed_author',
            array(
                'section'     => 'single_post',
                'label'       => __( 'Show Author Box', 'travel-monster' ),
                'priority'    => 50,
            )
        )
    );

    /** Display post tags */
    $wp_customize->add_setting(
        'ed_post_tags',
        array(
            'default'           => $defaults['ed_post_tags'], 
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control( 
            $wp_customize,
            'ed_post_tags',
            array(
                'section'     => 'single_post',
                'label'       => __( 'Display Post Tags', 'travel-monster' ),
                'priority'    => 60,
            )
        )
    );

     /** Show Pagination */
     $wp_customize->add_setting(
        'ed_post_pagination',
        array(
            'default'           => $defaults['ed_post_pagination'], 
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control( 
            $wp_customize,
            'ed_post_pagination',
            array(
                'section'     => 'single_post',
                'label'       => __( 'Show Pagination', 'travel-monster' ),
                'priority'    => 70,
            )
        )
    );

	/** Related Posts */
    $wp_customize->add_setting(
        'single_related_posts_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'single_related_posts_group',
            array(
                'id'          => 'single_related_posts_group',
                'label'       => __( 'Related Posts', 'travel-monster' ),
                'section'     => 'single_post',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priority'    => 80,
            )
        )
    );
	
    $wp_customize->add_setting(
        'ed_post_related',
        array(
            'default'           => $defaults['ed_post_related'], 
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control( 
            $wp_customize,
            'ed_post_related',
            array(
                'section'     => 'single_post',
                'label'       => __( 'Show Related Posts', 'travel-monster' ),
                'group'       => 'single_related_posts_group',
            )
        )
    );

	$wp_customize->add_setting(
        'single_related_title',
        array(
            'default'           => $defaults['single_related_title'],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage',
        )
    );
    
    
    $wp_customize->add_control(
        new Travel_Monster_Text_Control( 
            $wp_customize,
			'single_related_title',
			array(
                'label'   => __( 'Related Posts Section Title', 'travel-monster' ),
                'section' => 'single_post',
				'group'   => 'single_related_posts_group',
                )
        )
    );

    $wp_customize->selective_refresh->add_partial( 'single_related_title', array(
        'selector'        => '.related-post .title',
        'render_callback' => 'travel_monster_get_single_related_title',
    ) );

    /** Related Post Taxonomy */    
    $wp_customize->add_setting( 
        'related_taxonomy', 
        array(
            'default'           => $defaults['related_taxonomy'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'related_taxonomy',
			array(
				'section'	  => 'single_post',
				'label'       => __( 'Related Post Taxonomy', 'travel-monster' ),
                'description' => __( 'Choose the taxonomy to show related posts based on.', 'travel-monster' ),
				'choices'	  => array(
					'cat'   => __( 'Category', 'travel-monster' ),
                    'tag'   => __( 'Tags', 'travel-monster' ),
				),
                'group'   => 'single_related_posts_group',
			)
		)
	);

    /** Number of Realetd Posts */
    $wp_customize->add_setting(
        'related_post_num',
        array(
            'default'           => $defaults['related_post_num'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint'
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'related_post_num',
            array(
                'label'    => __( 'Number of Posts', 'travel-monster' ),
                'section'  => 'single_post',
                'settings' => array(
                    'desktop' => 'related_post_num',
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 1,
                        'max'  => 12,
                        'step' => 1,
                        'edit' => true,
                        'unit' => '',
                    ),
                ),
                'group'   => 'single_related_posts_group',
            )
        )
    );  

    /** Related Posts Per Row */
    $wp_customize->add_setting(
        'related_post_row',
        array(
            'default'           => $defaults['related_post_row'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint'
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'related_post_row',
            array(
                'label'    => __( 'Posts per row', 'travel-monster' ),
                'section'  => 'single_post',
                'settings' => array(
                    'desktop' => 'related_post_row',
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 1,
                        'max'  => 4,
                        'step' => 1,
                        'unit' => '',
                        'edit' => true
                    ),
                ),
                'group'   => 'single_related_posts_group',
            )
        )
    );  

    /** Location */    
    $wp_customize->add_setting( 
        'related_posts_location', 
        array(
            'default'           => $defaults['related_posts_location'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio',
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'related_posts_location',
			array(
				'section'	  => 'single_post',
				'label'       => __( 'Location', 'travel-monster' ),
				'choices'	  => array(
					'below' => __( 'Below Content', 'travel-monster' ),
					'end'   => __( 'At End', 'travel-monster' ),
				),
                'group'   => 'single_related_posts_group',
			)
		)
	);

    /** Show Related Posts */
    $wp_customize->add_setting(
        'single_comments_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'single_comments_group',
            array(
                'id'          => 'single_comments_group',
                'label'       => __( 'Comments Settings', 'travel-monster' ),
                'section'     => 'single_post',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priority'    => 90,
            )
        )
    );

     $wp_customize->add_setting(
        'ed_single_comments',
        array(
            'default'           => $defaults['ed_single_comments'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_single_comments',
			array(
				'section'     => 'single_post',
				'label'       => __( 'Show Comments', 'travel-monster' ),
				'group'       => 'single_comments_group',
			)
		)
	);
    
    /** Comment Form */    
    $wp_customize->add_setting( 
        'single_comment_form', 
        array(
            'default'           => $defaults['single_comment_form'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'single_comment_form',
			array(
				'section'	  => 'single_post',
				'label'       => __( 'Comment Form', 'travel-monster' ),
				'choices'	  => array(
					'above' => __( 'Above', 'travel-monster' ),
					'below' => __( 'Below', 'travel-monster' ),
				),
                'group'   => 'single_comments_group',
			)
		)
	);

    /** Location */    
    $wp_customize->add_setting( 
        'single_comment_location', 
        array(
            'default'           => $defaults['single_comment_location'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'single_comment_location',
			array(
				'section'	  => 'single_post',
				'label'       => __( 'Location', 'travel-monster' ),
				'choices'	  => array(
					'below' => __( 'Below Content', 'travel-monster' ),
					'end'   => __( 'At End', 'travel-monster' ),
				),
                'group'   => 'single_comments_group',
			)
		)
	);

}
add_action( 'customize_register', 'travel_monster_customize_register_layout_post' );