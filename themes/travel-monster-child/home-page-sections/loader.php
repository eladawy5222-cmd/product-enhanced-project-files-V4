<?php
/**
 * FTS Home Page Sections — Central Loader
 *
 * Single entry-point required once from functions.php.
 * Each section lives in its own sub-folder following the convention:
 *
 *   {section-name}/
 *   ├── {section-name}.php   PHP class with static init() — hooks, shortcode, AJAX
 *   ├── css/
 *   │   └── {section-name}.css
 *   └── js/
 *       └── {section-name}.js
 *
 * To add a new section:
 *   1. Create a folder, e.g.  featured-trips/
 *   2. Inside it add  featured-trips.php  with a class that calls ::init()
 *   3. Add css/ and js/ sub-folders with matching asset files
 *   4. The loader auto-discovers it — no edits to functions.php needed
 *
 * The shared/ folder holds design tokens & utilities used by every section.
 *
 * @package FTS_Home_Sections
 */
if ( ! defined( 'ABSPATH' ) ) exit;

/* ── Shared CSS (design tokens, section utilities) ────────── */

add_action( 'wp_enqueue_scripts', function () {
    $dir = get_stylesheet_directory()     . '/home-page-sections/shared/css/sections-common.css';
    $uri = get_stylesheet_directory_uri() . '/home-page-sections/shared/css/sections-common.css';

    if ( file_exists( $dir ) ) {
        wp_enqueue_style(
            'fts-sections-common',
            $uri,
            array(),
            filemtime( $dir )
        );
    }
} );

/* ── Auto-discover & load section modules ─────────────────── */

$_fts_hp_root = get_stylesheet_directory() . '/home-page-sections';

$_fts_hp_entries = @scandir( $_fts_hp_root );
if ( is_array( $_fts_hp_entries ) ) {
    foreach ( $_fts_hp_entries as $_fts_hp_entry ) {
        if ( $_fts_hp_entry[0] === '.' || $_fts_hp_entry === 'shared' ) {
            continue;
        }
        $_fts_hp_file = $_fts_hp_root . '/' . $_fts_hp_entry . '/' . $_fts_hp_entry . '.php';
        if ( is_file( $_fts_hp_file ) ) {
            require_once $_fts_hp_file;
        }
    }
}

unset( $_fts_hp_root, $_fts_hp_entries, $_fts_hp_entry, $_fts_hp_file );
