<?php
/**
 * The sidebar containing the main widget area
 *
 * @link https://developer.wordpress.org/themes/basics/template-files/#template-partials
 *
 * @package Travel Monster
 */

$sidebar = travel_monster_sidebar();

if ( ! $sidebar ) {
	return;
}
?>

<aside id="secondary" class="widget-area" <?php travel_monster_microdata( 'sidebar' ); ?>>
	<div class="sidebar-wrap-main">
		<?php dynamic_sidebar( $sidebar ); ?>
	</div>
</aside><!-- #secondary -->