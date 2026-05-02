<?php
/**
 * Upper Footer Settings
 *
 * @package Travel Monster
*/

function travel_monster_customize_register_upper_footer( $wp_customize ){
    $colorDefaults = travel_monster_get_color_defaults();

    /** Footer */
    $wp_customize->add_section( 
        'upper_footer_settings',
         array(
            'priority' => 10,
            'title'    => __( 'Upper Footer', 'travel-monster' ),
            'panel'    => 'footer_panel'
        ) 
    );

    $wp_customize->add_setting(
        'upper_footer_bg_color',
        array(
            'default'           => $colorDefaults['upper_footer_bg_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'upper_footer_bg_color',
            array(
                'label'   => __( 'Background Color', 'travel-monster' ),
                'section' => 'upper_footer_settings',
            )
        )
    );
    
    $wp_customize->add_setting(
        'upper_footer_text_color',
        array(
            'default'           => $colorDefaults['upper_footer_text_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'upper_footer_text_color',
            array(
                'label'   => __( 'Text Color', 'travel-monster' ),
                'section' => 'upper_footer_settings',
            )
        )
    );

    $wp_customize->add_setting(
        'upper_footer_link_hover_color',
        array(
            'default'           => $colorDefaults['upper_footer_link_hover_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'upper_footer_link_hover_color',
            array(
                'label'   => __( 'Link Hover Color', 'travel-monster' ),
                'section' => 'upper_footer_settings',
            )
        )
    );

    
    $wp_customize->add_setting(
        'upper_footer_widget_heading_color',
        array(
            'default'           => $colorDefaults['upper_footer_widget_heading_color'],
            'transport'         => 'postMessage',
            'sanitize_callback' => 'travel_monster_sanitize_rgba',
        )
    );

    $wp_customize->add_control(
        new Travel_Monster_Alpha_Color_Customize_Control(
            $wp_customize,
            'upper_footer_widget_heading_color',
            array(
                'label'   => __( 'Widget Heading Color', 'travel-monster' ),
                'section' => 'upper_footer_settings',
            )
        )
    );

}
add_action( 'customize_register', 'travel_monster_customize_register_upper_footer' );