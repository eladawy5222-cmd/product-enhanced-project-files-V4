<?php
/**
 * Travel Monster Widget Areas
 * 
 * @link https://developer.wordpress.org/themes/functionality/sidebars/#registering-a-sidebar
 * @package Travel Monster
*/

if( ! function_exists( 'travel_monster_widgets_init' ) ):
/**
 * Register Widget Areas
*/
function travel_monster_widgets_init() {
    $title_class = '';

    $sidebars = array(
        'sidebar'   => array(
            'name'        => __( 'Sidebar', 'travel-monster' ),
            'id'          => 'sidebar', 
            'description' => __( 'Default Sidebar', 'travel-monster' ),
        ),
        'footer-one'=> array(
            'name'        => __( 'Footer One', 'travel-monster' ),
            'description' => __( 'Add footer one widgets here.', 'travel-monster' ),
        ),
        'footer-two'=> array(
            'name'        => __( 'Footer Two', 'travel-monster' ),
            'description' => __( 'Add footer two widgets here.', 'travel-monster' ),
        ),
        'footer-three'=> array(
            'name'        => __( 'Footer Three', 'travel-monster' ),
            'description' => __( 'Add footer three widgets here.', 'travel-monster' ),
        ),
        'footer-four'=> array(
            'name'        => __( 'Footer Four', 'travel-monster' ),
            'description' => __( 'Add footer four widgets here.', 'travel-monster' ),
        )
    );
    
    foreach( $sidebars as $id => $sidebar ){
        register_sidebar( array(
            'name'          => esc_html( $sidebar['name'] ),
            'id'            => esc_attr( $id ),
            'description'   => esc_html( $sidebar['description'] ),
            'before_widget' => '<section id="%1$s" class="widget ' . esc_attr( $title_class ) . ' %2$s">',
            'after_widget'  => '</section>',
            'before_title'  => apply_filters( 'travel_monster_widget_before_title', '<h2 class="widget-title" itemprop="name">' ),
            'after_title'   => apply_filters( 'travel_monster_widget_after_title', '</h2>' ),
        ) );
    }
}
endif;
add_action( 'widgets_init', 'travel_monster_widgets_init' );