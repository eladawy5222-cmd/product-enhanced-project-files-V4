<?php
/**
 * Related Posts section.
 * Full-width grid on desktop (3 cols x 2 rows) / minimal snap slider on mobile.
 * Priority: same tags  ->  same category fallback  ->  latest posts.
 * Author info and comments are intentionally NOT rendered.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$current_id = get_the_ID();
$tag_ids    = wp_get_post_tags( $current_id, array( 'fields' => 'ids' ) );

$base_args = array(
	'post_type'           => 'post',
	'posts_per_page'      => 6,
	'post__not_in'        => array( $current_id ),
	'ignore_sticky_posts' => 1,
	'orderby'             => 'date',
	'order'               => 'DESC',
	'no_found_rows'       => false,
);

$related_query = null;

if ( ! empty( $tag_ids ) ) {
	$related_query = new WP_Query( array_merge( $base_args, array( 'tag__in' => $tag_ids ) ) );
}

if ( ! $related_query || $related_query->found_posts < 6 ) {
	$cat_ids = wp_get_post_categories( $current_id );
	if ( ! empty( $cat_ids ) ) {
		$related_query = new WP_Query( array_merge( $base_args, array( 'category__in' => $cat_ids ) ) );
	}
}

if ( ! $related_query || $related_query->found_posts < 6 ) {
	$related_query = new WP_Query( $base_args );
}

if ( ! $related_query || ! $related_query->have_posts() ) {
	return;
}
?>

<section class="fts-sp-related" aria-label="<?php esc_attr_e( 'You might also like', 'travel-monster-child' ); ?>">
	<div class="fts-sp-related__header">
		<p class="fts-sp-related__kicker"><?php esc_html_e( 'Keep exploring', 'travel-monster-child' ); ?></p>
		<h2 class="fts-sp-related__title"><?php esc_html_e( 'You might also like', 'travel-monster-child' ); ?></h2>
	</div>

	<div class="fts-sp-related__grid" role="list">
		<?php
		while ( $related_query->have_posts() ) :
			$related_query->the_post();

			$r_thumb = get_the_post_thumbnail_url( get_the_ID(), 'medium_large' );
			$r_cats  = get_the_category();
			$r_cat   = ! empty( $r_cats ) ? $r_cats[0] : null;
			$r_time  = fts_single_post_reading_time( get_post_field( 'post_content', get_the_ID() ) );
			?>
			<a class="fts-sp-related__card" href="<?php the_permalink(); ?>" role="listitem">
				<div class="fts-sp-related__thumb">
					<?php if ( $r_thumb ) : ?>
						<img src="<?php echo esc_url( $r_thumb ); ?>" alt="<?php echo esc_attr( get_the_title() ); ?>" loading="lazy" />
					<?php else : ?>
						<div class="fts-sp-related__thumb-fallback" aria-hidden="true"></div>
					<?php endif; ?>
					<?php if ( $r_cat ) : ?>
						<span class="fts-sp-related__cat"><?php echo esc_html( $r_cat->name ); ?></span>
					<?php endif; ?>
				</div>
				<div class="fts-sp-related__body">
					<h3 class="fts-sp-related__card-title"><?php the_title(); ?></h3>
					<p class="fts-sp-related__excerpt">
						<?php echo esc_html( wp_trim_words( get_the_excerpt(), 18, '…' ) ); ?>
					</p>
					<div class="fts-sp-related__meta">
						<span><?php echo esc_html( get_the_date() ); ?></span>
						<span class="fts-sp-related__dot" aria-hidden="true">&middot;</span>
						<span>
							<?php
							printf(
								/* translators: %d: reading time in minutes. */
								esc_html( _n( '%d min read', '%d min read', $r_time, 'travel-monster-child' ) ),
								(int) $r_time
							);
							?>
						</span>
					</div>
				</div>
			</a>
			<?php
		endwhile;
		wp_reset_postdata();
		?>
	</div>
</section>
