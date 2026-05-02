<?php
/**
 * Custom Single Trip Template Override (V2)
 * 
 * This template completely replaces the default WP Travel Engine single trip layout
 * with the FTS premium landing page design.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

get_header(); 

if ( have_posts() ) {
    while ( have_posts() ) {
        the_post();
        
        $fts_v2_rendered = false;
        
        if ( class_exists( 'FTS_Trip_Redesign_V2' ) ) {
            try {
                FTS_Trip_Redesign_V2::render_nuclear_custom_layout();
                $fts_v2_rendered = true;
            } catch ( \Throwable $e ) {
                error_log( 'FTS V2 TEMPLATE CRASH: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
            }
        }
        
        if ( ! $fts_v2_rendered ) {
            echo '<div style="max-width:900px;margin:40px auto;padding:20px;">';
            echo '<h1>' . get_the_title() . '</h1>';
            the_content();
            if ( function_exists( 'wte_get_formated_price' ) ) {
                $fallback_price = get_post_meta( get_the_ID(), 'wp_travel_engine_setting_trip_price', true );
                if ( $fallback_price ) {
                    echo '<p style="font-size:24px;font-weight:bold;">Price: ' . wte_get_formated_price( $fallback_price ) . '</p>';
                }
            }
            do_action( 'wp_travel_engine_trip_price' );
            echo '</div>';
        }
    }
}

get_footer();
