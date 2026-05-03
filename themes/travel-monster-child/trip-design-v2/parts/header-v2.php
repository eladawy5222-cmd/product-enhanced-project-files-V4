<?php
/**
 * Header V2 - Breadcrumbs + Hero Title + Rating + Meta Badges
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;
?>

<div class="fts-v2-hero-section">
    <div class="fts-v2-container">

        <!-- Breadcrumbs -->
        <nav class="fts-v2-breadcrumbs">
            <a href="<?php echo esc_url( home_url() ); ?>"><?php echo esc_html__( 'Home', 'fts' ); ?></a>
            <?php foreach ( $dest_chain as $dc ) : ?>
                <span class="fts-v2-bc-sep">/</span>
                <a href="<?php echo esc_url( $dc['url'] ); ?>"><?php echo esc_html( $dc['name'] ); ?></a>
            <?php endforeach; ?>
            <?php if ( $last_crumb ) : ?>
                <span class="fts-v2-bc-sep">/</span>
                <span class="fts-v2-bc-current"><?php echo esc_html( $last_crumb ); ?></span>
            <?php endif; ?>
        </nav>

        <!-- Title Row -->
        <div class="fts-v2-title-row">
            <h1 class="fts-v2-trip-title"><?php the_title(); ?></h1>
            <div class="fts-v2-title-actions">
                <button class="fts-v2-action-btn" onclick="if(navigator.share){navigator.share({title:document.title,url:location.href})}else{navigator.clipboard.writeText(location.href);this.querySelector('span').textContent='<?php echo esc_js( __( 'Copied!', 'fts' ) ); ?>'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    <span><?php echo esc_html__( 'Share', 'fts' ); ?></span>
                </button>
            </div>
        </div>
        <?php if ( ! empty( $bold_promise ) ) : ?>
        <p class="fts-v2-bold-promise"><?php echo esc_html( $bold_promise ); ?></p>
        <?php endif; ?>

        <!-- Meta Row -->
        <div class="fts-v2-meta-row">
            <?php if ( $avg_rating > 0 ) : ?>
            <div class="fts-v2-meta-item fts-v2-meta-rating">
                <div class="fts-v2-stars-inline">
                    <?php for ( $i = 1; $i <= 5; $i++ ) : ?>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="<?php echo $i <= round( $avg_rating ) ? '#FF8C00' : 'none'; ?>" stroke="#FF8C00" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <?php endfor; ?>
                </div>
                <strong><?php echo number_format( $avg_rating, 1 ); ?></strong>
                <span>(<?php echo esc_html( sprintf( _n( '%s review', '%s reviews', $review_count, 'fts' ), number_format_i18n( $review_count ) ) ); ?>)</span>
            </div>
            <span class="fts-v2-meta-sep">|</span>
            <?php endif; ?>

            <?php if ( $duration_text ) : ?>
            <div class="fts-v2-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span><?php echo esc_html( $duration_text ); ?></span>
            </div>
            <span class="fts-v2-meta-sep">|</span>
            <?php endif; ?>

            <?php if ( $group_text ) : ?>
            <div class="fts-v2-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span><?php echo esc_html( $group_text ); ?></span>
            </div>
            <span class="fts-v2-meta-sep">|</span>
            <?php endif; ?>

            <?php if ( $location ) : ?>
            <div class="fts-v2-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span><?php echo esc_html( $location ); ?></span>
            </div>
            <?php endif; ?>
        </div>

    </div>
</div>
