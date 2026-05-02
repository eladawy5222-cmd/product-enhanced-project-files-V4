<?php
/**
 * The template for displaying search results pages
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/#search-result
 *
 * @package Travel Monster
 */

get_header();

	/**
	 * Before Posts hook
	*/
	do_action( 'travel_monster_before_primary_content' ); ?>

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
			?>
			<div class="posts-wrap">
				<?php if ( have_posts() ) : ?>

					<?php
					/**
					 * Before Loop Hook
					*/
					do_action( 'travel_monster_before_loop' );

					/* Start the Loop */
					while ( have_posts() ) :
						the_post();

						/**
						 * Run the loop for the search to output the results.
						 * If you want to overload this in a child theme then include a file
						 * called content-search.php and that will be used instead.
						 */
						get_template_part( 'template-parts/content', 'search' );

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