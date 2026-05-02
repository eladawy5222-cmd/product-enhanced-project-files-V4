<?php
/**
 * The header for our theme
 *
 * This is the template that displays all of the <head> section and everything up until <div id="content">
 *
 * @link https://developer.wordpress.org/themes/basics/template-files/#template-partials
 *
 * @package Travel Monster
*/
	/**
     * Doctype Hook
     * 
     * @hooked travel_monster_doctype
    */
    do_action( 'travel_monster_doctype' );
?>
<head <?php if ( function_exists( 'travel_monster_microdata' ) ) travel_monster_microdata( 'head' ); ?>>
<?php 
    /**
     * Before wp_head
     * 
     * @hooked travel_monster_head
    */
    do_action( 'travel_monster_before_wp_head' );

	wp_head(); ?>
</head>

<body <?php body_class(); if ( function_exists( 'travel_monster_microdata' ) ) travel_monster_microdata( 'body' ); ?>>
<?php 
	
	wp_body_open(); 

	/**
     * Before Header
     * 
     * @hooked travel_monster_page_start - 20 
    */
    do_action( 'travel_monster_before_header' );

	/**
     * Header
     * @hooked travel_monster_notification_topbar - 15
     * @hooked travel_monster_header - 20     
    */
    do_action( 'travel_monster_header' );
    
    /**
     * After Header
    */
    do_action( 'travel_monster_after_header' );
    
    /**
     * Content
     * 
     * @hooked travel_monster_content_start
    */
    do_action( 'travel_monster_content' );