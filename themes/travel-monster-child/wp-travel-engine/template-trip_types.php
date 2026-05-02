<?php
/**
 * Override: Trip Types Template (FTS V2)
 *
 * Replaces the default WP Travel Engine trip types listing
 * with the premium taxonomy terms design.
 */
get_header();
if ( class_exists( 'FTS_Taxonomy_Terms_V2' ) ) {
    FTS_Taxonomy_Terms_V2::render( 'trip_types' );
} else {
    wte_get_template( 'content--template-taxonomy.php', array( 'taxonomy' => 'trip_types' ) );
}
get_footer();
