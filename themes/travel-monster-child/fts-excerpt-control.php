<?php
/**
 * FTS Custom Excerpt Control
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// 1. Force the word limit on any excerpt calls
function fts_custom_excerpt_length( $length ) {
    return 10; 
}
add_filter( 'excerpt_length', 'fts_custom_excerpt_length', 999 );

function fts_excerpt_more( $more ) {
    return '...';
}
add_filter( 'excerpt_more', 'fts_excerpt_more' );

// 2. Targeted fix for manual excerpts and WP Travel Engine specific calls
function fts_limit_trip_content_words( $excerpt, $post = null ) {
    // If $post is not provided, try to get current post
    if ( ! $post ) {
        global $post;
    }
    
    $post_id = is_object( $post ) ? $post->ID : ( is_numeric( $post ) ? $post : get_the_ID() );
    $post_type = get_post_type( $post_id );

    if ( $post_type === 'trip' ) {
        // We use 10 words as requested
        return wp_trim_words( $excerpt, 10, '...' );
    }
    
    return $excerpt;
}

// Applying it to multiple hooks for maximum coverage
add_filter( 'get_the_excerpt', 'fts_limit_trip_content_words', 999, 2 );
add_filter( 'wp_trim_excerpt', 'fts_limit_trip_content_words', 999, 2 );
add_filter( 'the_excerpt', 'fts_limit_trip_content_words', 999 );
