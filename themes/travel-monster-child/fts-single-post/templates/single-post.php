<?php
/**
 * FTS Single Post — minimal magazine-style template.
 * Loaded via the single_template filter from fts-single-post.php.
 *
 * We bypass the parent theme's content-single.php (and its
 * travel_monster_post_entry_content hooks) to fully control markup
 * and to guarantee the author block is never rendered.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<main id="primary" class="site-main fts-sp">
	<?php
	while ( have_posts() ) :
		the_post();
		?>

		<article id="post-<?php the_ID(); ?>" <?php post_class( 'fts-sp__article-root' ); ?>>

			<?php include __DIR__ . '/parts/hero.php'; ?>

			<div class="fts-sp__container">
				<div class="fts-sp__layout">
					<?php include __DIR__ . '/parts/toc-sidebar.php'; ?>

					<div class="fts-sp-article">
						<div class="entry-content-wrap fts-sp-article__content">
							<?php
							the_content();

							wp_link_pages( array(
								'before' => '<nav class="fts-sp-article__pagination">' . esc_html__( 'Pages:', 'travel-monster-child' ),
								'after'  => '</nav>',
							) );

							$tags = get_the_tags();
							if ( $tags ) :
								?>
								<div class="fts-sp-article__tags" aria-label="<?php esc_attr_e( 'Tags', 'travel-monster-child' ); ?>">
									<?php foreach ( $tags as $tag ) : ?>
										<a class="fts-sp-article__tag" href="<?php echo esc_url( get_tag_link( $tag->term_id ) ); ?>">
											#<?php echo esc_html( $tag->name ); ?>
										</a>
									<?php endforeach; ?>
								</div>
							<?php endif; ?>
						</div>
					</div>
				</div>
			</div>

			<?php include __DIR__ . '/parts/cta-banner.php'; ?>

			<?php include __DIR__ . '/parts/related-posts.php'; ?>

		</article>

		<?php
	endwhile;
	?>
</main>

<?php
get_footer();
