<?php
/**
 * Travel Monster Custom Control
 * 
 * @package Travel Monster
*/

if( ! function_exists( 'travel_monster_register_custom_controls' ) ) :
/**
 * Register Custom Controls
*/
function travel_monster_register_custom_controls( $wp_customize ){   

    require_once get_template_directory() . '/inc/custom-controls/range/class-range-control.php';
    require_once get_template_directory() . '/inc/custom-controls/grouptitle/class-group-title.php';
    require_once get_template_directory() . '/inc/custom-controls/radiobtn/class-radio-buttonset-control.php';
    require_once get_template_directory() . '/inc/custom-controls/radioimg/class-radio-image-control.php';
    require_once get_template_directory() . '/inc/custom-controls/sortable/class-sortable-control.php';
    require_once get_template_directory() . '/inc/custom-controls/coloralpha/class-color-alpha-control.php';
    require_once get_template_directory() . '/inc/custom-controls/spacing/class-spacing-control.php';
    require_once get_template_directory() . '/inc/custom-controls/select/class-select-control.php';
    require_once get_template_directory() . '/inc/custom-controls/group/class-group-control.php';    
    require_once get_template_directory() . '/inc/custom-controls/typography/class-typography-control.php';
    require_once get_template_directory() . '/inc/custom-controls/toggle/class-toggle-control.php';    
    require_once get_template_directory() . '/inc/custom-controls/note/class-note-control.php';
    require_once get_template_directory() . '/inc/custom-controls/text/class-text-control.php';

    $wp_customize->register_control_type( 'Travel_Monster_Range_Slider_Control' );
    $wp_customize->register_control_type( 'Travel_Monster_Radio_Image_Control' );   
    $wp_customize->register_control_type( 'Travel_Monster_Sortable_Control' ); 
    $wp_customize->register_control_type( 'Travel_Monster_Alpha_Color_Customize_Control' ); 
    $wp_customize->register_control_type( 'Travel_Monster_Radio_Buttonset_Control' );
    $wp_customize->register_control_type( 'Travel_Monster_Spacing_Control' );
    $wp_customize->register_control_type( 'Travel_Monster_Select_Control' );
    $wp_customize->register_control_type( 'Travel_Monster_Group_Control' );
    $wp_customize->register_control_type( 'Travel_Monster_Typography_Customize_Control' );
    $wp_customize->register_control_type( 'Travel_Monster_Toggle_Control' );
    
}
endif;
add_action( 'customize_register', 'travel_monster_register_custom_controls' );