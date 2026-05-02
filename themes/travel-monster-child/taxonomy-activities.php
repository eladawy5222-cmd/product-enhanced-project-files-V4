<?php
/**
 * Template for displaying Activities taxonomy archive
 * Uses the same FTS Destination V2 design as destination archives.
 */

get_header();

if ( class_exists( 'FTS_Destination_V2' ) ) {
    FTS_Destination_V2::render();
    get_footer();
    return;
}

get_footer();
