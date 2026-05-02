<?php
/**
 * Pagination Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_general_pagination( $wp_customize ){
    
    $defaults = travel_monster_get_general_defaults();

    /** Pagination Settings */
    $wp_customize->add_section(
        'general_pagination_section',
        array(
            'title'    => __( 'Pagination', 'travel-monster' ),
            'priority' => 60,
            'panel'    => 'general_panel',
        )
    );

    /** Pagination Type */
    $wp_customize->add_setting( 
        'post_navigation', 
        array(
            'default'           => $defaults['post_navigation'],
            'sanitize_callback' => 'travel_monster_sanitize_select_radio'
        ) 
    );

    $wp_customize->add_control(
        'post_navigation',
        array(
            'type'    => 'radio',
            'section' => 'general_pagination_section',
            'label'   => __( 'Pagination Type', 'travel-monster' ),
            'description' => __( 'Select pagination type.', 'travel-monster' ),
            'choices' => array(
                'default'         => __( 'Default (Next / Previous)', 'travel-monster' ),
                'numbered'        => __( 'Numbered (1 2 3 4...)', 'travel-monster' ),
                'load_more'       => __( 'AJAX (Load More Button)', 'travel-monster' ),
                'infinite_scroll' => __( 'AJAX (Auto Infinite Scroll)', 'travel-monster' ),
            )
        )
    );

     
    /** Load More Label */
    $wp_customize->add_setting(
        'load_more_label',
        array(
            'default'           => $defaults['load_more_label'],
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    
    $wp_customize->add_control(
	   'load_more_label',
		array(
			'section'         => 'general_pagination_section',
			'label'	          => __( 'Load More Label', 'travel-monster' ),
			'type'            => 'text',
            'active_callback' => 'travel_monster_loading_ac' 
		)		
	);
    
    /** Loading Label */
    $wp_customize->add_setting(
        'loading_label',
        array(
            'default'           => $defaults['loading_label'],
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    
    $wp_customize->add_control(
	   'loading_label',
		array(
			'section'         => 'general_pagination_section',
			'label'	          => __( 'Loading Label', 'travel-monster' ),
			'type'            => 'text',
            'active_callback' => 'travel_monster_loading_ac' 
		)		
	);
    
    /** No more Label */
    $wp_customize->add_setting(
        'no_more_label',
        array(
            'default'           => $defaults['no_more_label'],
            'sanitize_callback' => 'sanitize_text_field',
        )
    );
    
    $wp_customize->add_control(
	   'no_more_label',
		array(
			'section'         => 'general_pagination_section',
			'label'	          => __( 'No More Label', 'travel-monster' ),
			'type'            => 'text',
            'active_callback' => 'travel_monster_loading_ac' 
		)		
	);
}
add_action( 'customize_register', 'travel_monster_customize_register_general_pagination' );