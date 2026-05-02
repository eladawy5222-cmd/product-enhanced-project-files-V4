<?php
/**
 * Footer Settings
 *
 * @package Travel Monster
 */

function travel_monster_customize_register_footer_settings( $wp_customize ) {
    
    /** Footer */
    $wp_customize->add_panel( 
        'footer_panel',
         array(
            'priority'    => 31,
            'capability'  => 'edit_theme_options',
            'title'       => __( 'Footer Settings', 'travel-monster' ),
        ) 
    );
}
add_action( 'customize_register', 'travel_monster_customize_register_footer_settings' );