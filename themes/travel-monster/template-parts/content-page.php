<?php
/**
 * Template part for displaying page content in page.php
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package Travel Monster
*/
$defaults       = travel_monster_get_general_defaults();
$page_alignment = get_theme_mod( 'page_alignment', $defaults[ 'page_alignment' ] );
?>
<article id="post-<?php the_ID(); ?>" <?php post_class(); travel_monster_microdata( 'article' ); ?> data-alignment="title-<?php echo esc_attr( $page_alignment ); ?>">
	<?php
		/**
		 * @hooked travel_monster_post_thumbnail - 15
		 * @hooked travel_monster_entry_header   - 20 
		*/
		do_action( 'travel_monster_before_page_entry_content' );

		/**
		 * @hooked travel_monster_entry_content - 15
		 * @hooked travel_monster_entry_footer  - 20
		*/
		do_action( 'travel_monster_page_entry_content' );
	?>
</article><!-- #post-## -->