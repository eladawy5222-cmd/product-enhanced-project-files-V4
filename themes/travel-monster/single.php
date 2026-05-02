<?php
/**
 * The template for displaying all single posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/#single-post
 *
 * @package Travel Monster
 */

get_header(); ?>	
	<main id="primary" class="site-main">
		<div class="travel-monster-container-wrap">
			<?php 
				/**
				 * Travel Monster After Container Wrap
				*/
				do_action( 'travel_monster_after_container_wrap' );
			
				while ( have_posts() ) :
					the_post();

					get_template_part( 'template-parts/content', 'single' );

				endwhile; // End of the loop.

				/**
				* After post loop
				* @hooked travel_monster_related_posts  - 5 //Comment location "Below Content"
				* @hooked travel_monster_comment  - 10 //Comment location "Below Content"
				* @hooked ravel_monster_pro_author  - 20
				*/
				do_action( 'travel_monster_after_post_loop' );
			?>
		</div>
	</main><!-- #main -->	
<?php
get_sidebar();
/**
 * @hooked travel_monster_related_posts  - 5 //Comment location "At End"
 * @hooked travel_monster_comment  - 10 //Comment location "At End"
 */
do_action( 'travel_monster_before_footer_post_loop' );

get_footer();