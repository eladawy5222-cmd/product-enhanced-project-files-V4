<?php
/**
 * The main template file
 *
 * This is the most generic template file in a WordPress theme
 * and one of the two required files for a theme (the other being style.css).
 * It is used to display a page when nothing more specific matches a query.
 * E.g., it puts together the home page when no home.php file exists.
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package Travel Monster
 */

get_header(); ?>

	<main id="primary" class="site-main">
		<?php 
			/**
			 * Before Posts hook
			*/
			do_action( 'travel_monster_before_posts_content' );
        ?>

		<div class="travel-monster-container-wrap">
			<?php 
				/**
				 * Travel Monster After Container Wrap
				*/
				do_action( 'travel_monster_before_container_wrap' );
			
				if ( have_posts() ) :

					/**
					 * Before Loop Hook
					*/
					do_action( 'travel_monster_before_loop' );

					/* Start the Loop */
					while ( have_posts() ) :
						the_post();

						/*
						* Include the Post-Type-specific template for the content.
						* If you want to override this in a child theme, then include a file
						* called content-___.php (where ___ is the Post Type name) and that will be used instead.
						*/
						get_template_part( 'template-parts/content', get_post_type() );

					endwhile;

					/**
					 * After Loop Hook
					*/
					do_action( 'travel_monster_after_loop' );

				else :

					get_template_part( 'template-parts/content', 'none' );

				endif;
			?>
		</div>

		<?php
			/**
			 * After Posts hook
			 * 
			 * @hooked travel_monster_navigation - 10
			*/
			do_action( 'travel_monster_after_posts_content' );
        ?>	

	</main><!-- #main -->

<?php
get_sidebar();
get_footer();