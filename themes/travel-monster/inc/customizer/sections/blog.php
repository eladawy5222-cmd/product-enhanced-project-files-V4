<?php
/**
 * Blog Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_layout_blog( $wp_customize ) {
    
    $defaults = travel_monster_get_general_defaults();

    /** Blog Page Layout Settings */
    $wp_customize->add_section(
        'blog_layout',
        array(
            'title'      => __( 'Blog Page', 'travel-monster' ),
            'priority'   => 65,
            'capability' => 'edit_theme_options',
        )
    );

    /** Page Title */
    $wp_customize->add_setting(
        'blog_page_title_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'blog_page_title_group',
            array(
                'id'          => 'blog_page_title_group',
                'label'       => __( 'Page Title', 'travel-monster' ),
                'section'     => 'blog_layout',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priority'    => 10,
            )
        )
    );

    /** Page Title */
    $wp_customize->add_setting(
        'ed_blog_title',
        array(
            'default'           => $defaults['ed_blog_title'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_blog_title',
			array(
				'section' => 'blog_layout',
				'label'   => __( 'Show Title', 'travel-monster' ),
				'group'   => 'blog_page_title_group',
			)
		)
	);

    $wp_customize->selective_refresh->add_partial( 'ed_blog_title', array(
        'selector'        => '.blog .page-header-wrap .page-title',
        'render_callback' => 'travel_monster_get_ed_blog_title',
    ) );

    /** Blog Page description */
    $wp_customize->add_setting(
        'ed_blog_desc',
        array(
            'default'           => $defaults['ed_blog_desc'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'ed_blog_desc',
			array(
				'section' => 'blog_layout',
				'label'   => __( 'Page Description', 'travel-monster' ),
                'group'   => 'blog_page_title_group',
			)
		)
	);

    $wp_customize->selective_refresh->add_partial( 'ed_blog_desc', array(
        'selector'        => '.blog .page-header-wrap .archive-description',
        'render_callback' => 'travel_monster_get_ed_blog_desc',
    ) );

     /** Horizontal Alignment */
     $wp_customize->add_setting( 
        'blog_alignment', 
        array(
            'default'           => $defaults['blog_alignment'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio',
            'transport'         => 'postMessage'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Buttonset_Control(
			$wp_customize,
			'blog_alignment',
			array(
				'section'	  => 'blog_layout',
				'label'       => __( 'Horizontal Alignment', 'travel-monster' ),
                'group'       => 'blog_page_title_group',
				'choices'	  => array(
					'left'   => __( 'Left', 'travel-monster' ),
					'center' => __( 'Center', 'travel-monster' ),
					'right'  => __( 'Right', 'travel-monster' ),
				),
			)
		)
	);

    /** Post Featured Image Group */
    $wp_customize->add_setting(
        'blog_image_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'blog_image_group',
            array(
                'id'          => 'blog_image_group',
                'label'       => __( 'Image Setting', 'travel-monster' ),
                'section'     => 'blog_layout',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priority'    => 20,
            )
        )
    );

    /** Crop Feature Image */
    $wp_customize->add_setting(
        'blog_crop_image',
        array(
            'default'           => $defaults['blog_crop_image'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Toggle_Control( 
			$wp_customize,
			'blog_crop_image',
			array(
				'section'     => 'blog_layout',
				'label'       => __( 'Crop Featured Image', 'travel-monster' ),
				'description' => __( 'This setting crops the featured image to recommended size. If set to false, it displays the image exactly as uploaded.', 'travel-monster' ),
				'group'       => 'blog_image_group'
            )
		)
	);

    /** Post Content Group */
    $wp_customize->add_setting(
        'blog_content_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'blog_content_group',
            array(
                'id'          => 'blog_content_group',
                'label'       => __( 'Post Settings', 'travel-monster' ),
                'section'     => 'blog_layout',
                'type'        => 'group',
                'style'       => 'collapsible',
                'priority'    => 30,
            )
        )
    );

     /** Banner Options */
     $wp_customize->add_setting(
		'blog_content',
		array(
			'default'			=> $defaults['blog_content'],
			'sanitize_callback' => 'travel_monster_sanitize_select'
		)
	);

	$wp_customize->add_control(
		new Travel_Monster_Select_Control(
    		$wp_customize,
    		'blog_content',
    		array(
                'label'   => __( 'Post Content', 'travel-monster' ),
                'section' => 'blog_layout',
                'group'   => 'blog_content_group',
                'choices' => array(
                    'content' => __( 'Content', 'travel-monster' ),
                    'excerpt' => __( 'Excerpt', 'travel-monster' ),
                ),
     		)            
		)
	);

    /** Excerpt Length in percentage */
    $wp_customize->add_setting(
        'excerpt_length',
        array(
            'default'           => $defaults['excerpt_length'],
            'sanitize_callback' => 'travel_monster_sanitize_empty_absint',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Range_Slider_Control(
            $wp_customize,
            'excerpt_length',
            array(
                'label'           => __( 'Excerpt Length', 'travel-monster' ),
                'description'     => __( 'Choose the number of words to display in excerpt', 'travel-monster' ),
                'section'         => 'blog_layout',
                'group'           => 'blog_content_group',
                'settings' => array(
                    'desktop' => 'excerpt_length',
                ),
                'choices' => array(
                    'desktop' => array(
                        'min'  => 1,
                        'max'  => 100,
                        'step' => 1,
                        'edit' => true,
                        'unit' => '',
                    ),
                ),
            )
        )
    );

    /** Meta Order */
    $wp_customize->add_setting(
		'blog_meta_order', 
		array(
			'default'           => $defaults['blog_meta_order'], 
			'sanitize_callback' => 'travel_monster_sanitize_sortable',
		)
	);

	$wp_customize->add_control(
		new Travel_Monster_Sortable_Control(
			$wp_customize,
			'blog_meta_order',
			array(
				'section' => 'blog_layout',
				'label'   => __( 'Meta Order', 'travel-monster' ),
				'group'   => 'blog_content_group',
				'choices' => array(
            		'author'    => __( 'Author', 'travel-monster' ),
            		'date'      => __( 'Date', 'travel-monster' ),
            		'comment'   => __( 'Comment', 'travel-monster' ),
            	),
			)
		)
    );

    /** Blog Enable/Disable Category */
    $wp_customize->add_setting(
        'blog_ed_category',
        array(
            'default'           => $defaults['blog_ed_category'],
            'sanitize_callback' => 'travel_monster_sanitize_checkbox'
        )
    );
    
    $wp_customize->add_control(
        new Travel_Monster_Toggle_Control( 
            $wp_customize,
            'blog_ed_category',
            array(
                'section'     => 'blog_layout',
                'label'       => __( 'Show Category', 'travel-monster' ),
                'description' => __( 'Enable/Disable Category in the blog page.', 'travel-monster' ),
                'group'       => 'blog_content_group',
            )
        )
    );

    /** Read more button text */
    $wp_customize->add_setting(
        'blog_read_more',
        array(
            'default'           => $defaults['blog_read_more'],
            'sanitize_callback' => 'sanitize_text_field',
            'transport'         => 'postMessage'
        )
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Text_Control( 
			$wp_customize,
			'blog_read_more',
			array(
				'section' => 'blog_layout',
				'label'   => __( 'Read More Text', 'travel-monster' ),
				'group'   => 'blog_content_group',
			)
		)
	);

    $wp_customize->selective_refresh->add_partial( 'blog_read_more', array(
        'selector'        => '.blog .entry-footer .readmore-btn-wrap .read-more-text',
        'render_callback' => 'travel_monster_get_blog_read_more',
    ) );

    /** Sidebar Group */
    $wp_customize->add_setting(
        'blog_page_sidebar_group',
        array(
            'default'           => '',
            'sanitize_callback' => 'wp_kses',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Group_Control( 
            $wp_customize,
            'blog_page_sidebar_group',
            array(
                'id'       => 'blog_page_sidebar_group',
                'label'    => __( 'Sidebar Layouts', 'travel-monster' ),
                'section'  => 'blog_layout',
                'type'     => 'group',
                'style'    => 'collapsible',
                'priority' => 50,
            )
        )
    );
     /** Blog Sidebar Layout */
     $wp_customize->add_setting( 
        'blog_sidebar_layout', 
        array(
            'default'           => $defaults['blog_sidebar_layout'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );
    
    $wp_customize->add_control(
		new Travel_Monster_Radio_Image_Control(
			$wp_customize,
			'blog_sidebar_layout',
			array(
				'section'	  => 'blog_layout',
				'label'		  => __( 'Blog Sidebar Layout', 'travel-monster' ),
                'svg'         => true,
                'group'       => 'blog_page_sidebar_group',  
				'choices'	  => array(
                    'default-sidebar' => array(
                        'label' => __( 'Default', 'travel-monster' ),
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="#F7F7F7"/><path d="M51.8523 77H48.7585V68.2727H51.8778C52.7557 68.2727 53.5114 68.4474 54.1449 68.7969C54.7784 69.1435 55.2656 69.642 55.6065 70.2926C55.9503 70.9432 56.1222 71.7216 56.1222 72.6278C56.1222 73.5369 55.9503 74.3182 55.6065 74.9716C55.2656 75.625 54.7756 76.1264 54.1364 76.4759C53.5 76.8253 52.7386 77 51.8523 77ZM50.6037 75.419H51.7756C52.321 75.419 52.7798 75.3224 53.152 75.1293C53.527 74.9332 53.8082 74.6307 53.9957 74.2216C54.1861 73.8097 54.2812 73.2784 54.2812 72.6278C54.2812 71.983 54.1861 71.456 53.9957 71.0469C53.8082 70.6378 53.5284 70.3366 53.1562 70.1435C52.7841 69.9503 52.3253 69.8537 51.7798 69.8537H50.6037V75.419ZM57.489 77V68.2727H63.3697V69.794H59.3342V71.8736H63.0671V73.3949H59.3342V75.4787H63.3867V77H57.489ZM64.8366 77V68.2727H70.6151V69.794H66.6818V71.8736H70.2315V73.3949H66.6818V77H64.8366ZM72.2706 77H70.2933L73.3061 68.2727H75.6839L78.6925 77H76.7152L74.5291 70.267H74.4609L72.2706 77ZM72.147 73.5696H76.8175V75.0099H72.147V73.5696ZM85.1335 68.2727H86.9787V73.9403C86.9787 74.5767 86.8267 75.1335 86.5227 75.6108C86.2216 76.0881 85.7997 76.4602 85.2571 76.7273C84.7145 76.9915 84.0824 77.1236 83.3608 77.1236C82.6364 77.1236 82.0028 76.9915 81.4602 76.7273C80.9176 76.4602 80.4957 76.0881 80.1946 75.6108C79.8935 75.1335 79.7429 74.5767 79.7429 73.9403V68.2727H81.5881V73.7827C81.5881 74.1151 81.6605 74.4105 81.8054 74.669C81.9531 74.9276 82.1605 75.1307 82.4276 75.2784C82.6946 75.4261 83.0057 75.5 83.3608 75.5C83.7188 75.5 84.0298 75.4261 84.294 75.2784C84.5611 75.1307 84.767 74.9276 84.9119 74.669C85.0597 74.4105 85.1335 74.1151 85.1335 73.7827V68.2727ZM88.4968 77V68.2727H90.342V75.4787H94.0835V77H88.4968ZM93.8832 69.794V68.2727H101.051V69.794H98.3789V77H96.555V69.794H93.8832Z" fill="#656565"/></svg>'
                    ),
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
                        'path'  => '<svg width="150" height="145" viewBox="0 0 150 145" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="150" height="145" fill="white"/><rect x="13" y="10" width="123" height="36" fill="#C7C6C6"/><rect x="13" y="50" width="123" height="3" fill="#E6E6E6"/><rect x="13" y="58" width="123" height="2" fill="#E6E6E6"/><rect x="13" y="62" width="114.8" height="2" fill="#E6E6E6"/><rect x="13" y="66" width="100.04" height="2" fill="#E6E6E6"/><path d="M70.4 20L86.0231 35.75H54.7769L70.4 20Z" fill="#E3E3E3"/><path d="M84.34 26L93.5718 35.75H75.1082L84.34 26Z" fill="#E3E3E3"/><ellipse cx="91.72" cy="22" rx="3.28" ry="2" fill="#E3E3E3"/><rect x="13" y="76" width="123" height="36" fill="black" fill-opacity="0.2"/><rect x="13" y="116" width="123" height="3" fill="#E6E6E6"/><rect x="13" y="124" width="123" height="2" fill="#E6E6E6"/><rect x="13" y="128" width="114.8" height="2" fill="#E6E6E6"/><rect x="13" y="132" width="100.04" height="2" fill="#E6E6E6"/><path d="M70.4 86L86.0231 101.75H54.7769L70.4 86Z" fill="#E3E3E3"/><path d="M84.34 92L93.5718 101.75H75.1082L84.34 92Z" fill="#E3E3E3"/><ellipse cx="91.72" cy="88" rx="3.28" ry="2" fill="#E3E3E3"/></svg>',
                    )
				)
			)
		)
    );

    $wp_customize->add_setting(
        'blog_header_image',
        array(
            'default'           => $defaults['blog_header_image'],
            'sanitize_callback' => 'absint',
        )
    );

    $wp_customize->add_control(
        new WP_Customize_Cropped_Image_Control (
            $wp_customize,
            'blog_header_image',
                array(
                    'label'       => __( 'Header Background Image', 'travel-monster' ),
                    'description' => __( 'Upload an image for blog page', 'travel-monster' ),
                    'section'     => 'blog_layout',
                    'flex_width'  => true,
                    'flex_height' => true,
                    'width'       => 1920,
                    'height'      => 350,
                    'priority'    => 70,
                )
        )
    );
}
add_action( 'customize_register', 'travel_monster_customize_register_layout_blog' );