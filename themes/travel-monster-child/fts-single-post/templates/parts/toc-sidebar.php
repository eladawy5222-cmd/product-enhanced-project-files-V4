<?php
/**
 * Table of Contents sidebar shell.
 * The list is built on the client by fts-single-post.js from H2/H3 headings
 * inside .fts-sp-article .entry-content-wrap.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>

<aside class="fts-sp-toc" aria-label="<?php esc_attr_e( 'On this page', 'travel-monster-child' ); ?>">
	<div class="fts-sp-toc__inner">
		<p class="fts-sp-toc__label">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
			<?php esc_html_e( 'On this page', 'travel-monster-child' ); ?>
		</p>
		<ul class="fts-sp-toc__list" role="list"></ul>
		<p class="fts-sp-toc__empty" hidden><?php esc_html_e( 'No sections on this page yet.', 'travel-monster-child' ); ?></p>
	</div>
</aside>
