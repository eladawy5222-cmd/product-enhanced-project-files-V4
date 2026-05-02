<?php
/**
 * The template for displaying 404 pages (not found)
 *
 * @link https://codex.wordpress.org/Creating_an_Error_404_Page
 *
 * @package Travel Monster
 */
$defaults    = travel_monster_get_general_defaults();
$error_image = get_theme_mod( '404_image', $defaults['404_image'] );
$bg_img      = wp_get_attachment_image_url( $error_image,'travel-monster-single-layout-two' );
$bg_style 	 = (!empty( $error_image ) ) ? 'style="background-image: url(' . esc_url( $bg_img ) . '); background-position: cover;"' : '';
get_header();
?>
<div class="site-content">
	<div class="fourofour-main-wrap"<?php echo ( $bg_style ); ?>>
		<div class="main-content-wrapper clear">
			<div class="container">
				<div class="error-content">
					<h2 class="error-title"><?php esc_html_e( '404', 'travel-monster' ); ?></h2>
					<p class="error-desc"><?php esc_html_e( 'The page you are looking for may have been moved, deleted, or possibly never existed.', 'travel-monster' ); ?></p>
					<a class="btn-readmore"
						href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'GO BACK TO HOMEPAGE', 'travel-monster' ); ?>
					</a>
				</div>
				<section class="error-search-wrapper">
					<?php get_search_form(); ?>
				</section>
			</div>
		</div><!-- .main-content-wrapper -->
	</div><!-- .fourofour-main-wrap -->

	<?php
	/**
	 * @see travel_monster_latest_posts
	*/
	do_action( 'travel_monster_latest_posts' ); ?>
</div><!-- .site-content -->
<?php
get_footer();