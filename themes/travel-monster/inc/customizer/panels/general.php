<?php
/**
 * General
 *
 * @package Travel Monster
 */

function travel_monster_customize_register_general_settings( $wp_customize ) {
    
    /** General */
    $wp_customize->add_panel( 
        'general_panel',
         array(
            'priority'    => 20,
            'capability'  => 'edit_theme_options',
            'title'       => __( 'General', 'travel-monster' ),
        ) 
    );
}
add_action( 'customize_register', 'travel_monster_customize_register_general_settings' );