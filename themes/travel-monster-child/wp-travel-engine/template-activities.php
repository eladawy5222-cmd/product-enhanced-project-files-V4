<?php
/**
 * Override: Activities Template (FTS V2)
 *
 * Replaces the default WP Travel Engine activities listing
 * with the premium taxonomy terms design.
 */
get_header();
if ( class_exists( 'FTS_Taxonomy_Terms_V2' ) ) {
    FTS_Taxonomy_Terms_V2::render( 'activities' );
} else {
    wte_get_template( 'content--template-taxonomy.php', array( 'taxonomy' => 'activities' ) );
}
get_footer();
