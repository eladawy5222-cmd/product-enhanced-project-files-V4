<?php
/**
 * Override: Destination Template (FTS V2)
 *
 * Replaces the default WP Travel Engine destination listing
 * with the premium taxonomy terms design.
 */
get_header();
if ( class_exists( 'FTS_Taxonomy_Terms_V2' ) ) {
    FTS_Taxonomy_Terms_V2::render( 'destination' );
} else {
    wte_get_template( 'content--template-taxonomy.php', array( 'taxonomy' => 'destination' ) );
}
get_footer();
