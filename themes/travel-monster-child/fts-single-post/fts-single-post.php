<?php
/**
 * FTS Single Post Module
 *
 * Overrides the default WordPress single.php for standard `post` content
 * with a minimal, magazine-style template featuring:
 *   - Hero with featured image (no author block)
 *   - Sticky Table of Contents sidebar (desktop only)
 *   - Global CTA banner at the end of the content
 *   - Full-width Related Posts section (mobile: snap slider)
 *
 * @package travel-monster-child
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Route single blog posts to our custom template.
 */
add_filter( 'single_template', 'fts_single_post_template' );
function fts_single_post_template( $template ) {
	if ( is_singular( 'post' ) ) {
		$custom = __DIR__ . '/templates/single-post.php';
		if ( file_exists( $custom ) ) {
			return $custom;
		}
	}
	return $template;
}

/**
 * Enqueue module-scoped CSS and JS only on blog single posts.
 */
add_action( 'wp_enqueue_scripts', 'fts_single_post_enqueue_assets' );
function fts_single_post_enqueue_assets() {
	if ( ! is_singular( 'post' ) ) {
		return;
	}

	$base_url  = trailingslashit( get_stylesheet_directory_uri() ) . 'fts-single-post';
	$base_path = trailingslashit( get_stylesheet_directory() )     . 'fts-single-post';

	$css_file = $base_path . '/css/fts-single-post.css';
	$js_file  = $base_path . '/js/fts-single-post.js';

	wp_enqueue_style(
		'fts-single-post',
		$base_url . '/css/fts-single-post.css',
		array(),
		file_exists( $css_file ) ? filemtime( $css_file ) : null
	);

	wp_enqueue_script(
		'fts-single-post',
		$base_url . '/js/fts-single-post.js',
		array(),
		file_exists( $js_file ) ? filemtime( $js_file ) : null,
		true
	);
}

/**
 * Compute an approximate reading time (in minutes) for a given post content.
 *
 * @param string $content Raw post content.
 * @return int Minutes, minimum 1.
 */
function fts_single_post_reading_time( $content ) {
	$words   = str_word_count( wp_strip_all_tags( (string) $content ) );
	$minutes = (int) ceil( $words / 200 );
	return max( 1, $minutes );
}

/**
 * Return the best available "Explore Trips" URL for CTAs.
 *
 * @return string
 */
function fts_single_post_trips_url() {
	$url = get_post_type_archive_link( 'trip' );
	if ( ! $url ) {
		$url = home_url( '/trips/' );
	}
	return $url;
}
