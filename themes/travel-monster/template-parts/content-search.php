<?php
/**
 * Template part for displaying results in search pages
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package Travel Monster
*/
?>
<article id="post-<?php the_ID(); ?>" <?php post_class(); travel_monster_microdata( 'article' ); ?>>
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