<?php
/**
 * The template for displaying all pages
 *
 * This is the template that displays all pages by default.
 * Please note that this is the WordPress construct of pages
 * and that other 'pages' on your WordPress site may use a
 * different template.
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package Travel Monster
 */
$defaults         = travel_monster_get_general_defaults();
$ed_page_comments = get_theme_mod( 'ed_page_comments', $defaults['ed_page_comments'] );

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

					get_template_part( 'template-parts/content', 'page' );					

				endwhile; // End of the loop.

				if( ( comments_open() || get_comments_number() ) && $ed_page_comments ) :
					comments_template();
				endif;
			?>
		</div>
	</main><!-- #main -->
<?php

if( apply_filters( 'travel_monster_display_page_sidebar', true ) ) {
	get_sidebar();
}

get_footer();
