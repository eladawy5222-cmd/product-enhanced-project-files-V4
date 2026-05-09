<?php
/**
 * Gallery V2 - 3-Photo Grid with Lightbox + Video
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;

if ( empty( $all_images ) ) return;
?>

<div class="fts-v2-gallery-section">
    <div class="fts-v2-container">
        <?php if ( count( $all_images ) > 1 ) : ?>
        <div class="fts-v2-gallery-slider" data-count="<?php echo esc_attr( count( $all_images ) ); ?>">
            <div class="fts-v2-gallery-slider-track">
                <?php foreach ( $all_images as $sidx => $simg_id ) :
                    $simg_url = wp_get_attachment_image_url( $simg_id, 'large' );
                    if ( ! $simg_url ) continue;
                    $salt = get_post_meta( $simg_id, '_wp_attachment_image_alt', true ) ?: get_the_title();
                ?>
                <div class="fts-v2-gallery-slide" data-index="<?php echo esc_attr( $sidx ); ?>">
                    <img src="<?php echo esc_url( $simg_url ); ?>" alt="<?php echo esc_attr( $salt ); ?>" loading="eager"<?php echo $sidx === 0 ? ' fetchpriority="high"' : ''; ?>>
                    <?php if ( $sidx === 0 && ! empty( $video_url ) ) : ?>
                    <div class="fts-v2-video-play" data-video="<?php echo esc_url( $video_url ); ?>">
                        <div class="fts-v2-play-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endforeach; ?>
            </div>
            <div class="fts-v2-gallery-dots" aria-hidden="true"></div>
        </div>
        <?php endif; ?>

        <div class="fts-v2-gallery-grid fts-v2-gallery-count-<?php echo intval( $grid_count ); ?>">
            <?php foreach ( $grid_images as $idx => $img_id ) :
                $img_url = wp_get_attachment_image_url( $img_id, 'large' );
                if ( ! $img_url ) continue;
                $alt = get_post_meta( $img_id, '_wp_attachment_image_alt', true ) ?: get_the_title();
                $cls = $idx === 0 ? 'fts-v2-gallery-main' : 'fts-v2-gallery-side';
            ?>
            <div class="fts-v2-gallery-cell <?php echo esc_attr( $cls ); ?>" data-index="<?php echo esc_attr( $idx ); ?>">
                <img src="<?php echo esc_url( $img_url ); ?>" alt="<?php echo esc_attr( $alt ); ?>" loading="<?php echo $idx === 0 ? 'eager' : 'lazy'; ?>">

                <?php if ( $idx === 0 && ! empty( $video_url ) ) : ?>
                <div class="fts-v2-video-play" data-video="<?php echo esc_url( $video_url ); ?>">
                    <div class="fts-v2-play-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                </div>
                <?php endif; ?>

                <?php if ( $extra_photos > 0 && $idx === $grid_count - 1 ) : ?>
                <div class="fts-v2-gallery-more" data-action="lightbox">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span><?php echo esc_html( sprintf( _n( '+%d photo', '+%d photos', $extra_photos, 'fts' ), $extra_photos ) ); ?></span>
                </div>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
</div>

<!-- Lightbox -->
<div id="fts-v2-lightbox" class="fts-v2-lightbox">
    <div class="fts-v2-lb-close" role="button" tabindex="0" aria-label="<?php echo esc_attr__( 'Close', 'fts' ); ?>">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
    <div class="fts-v2-lb-prev" role="button" tabindex="0" aria-label="<?php echo esc_attr__( 'Previous', 'fts' ); ?>">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </div>
    <div class="fts-v2-lb-next" role="button" tabindex="0" aria-label="<?php echo esc_attr__( 'Next', 'fts' ); ?>">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="fts-v2-lb-stage">
        <img id="fts-v2-lb-img" src="" alt="">
    </div>
    <div class="fts-v2-lb-footer">
        <div class="fts-v2-lb-title" id="fts-v2-lb-title"></div>
        <div class="fts-v2-lb-counter" id="fts-v2-lb-counter"></div>
        <div class="fts-v2-lb-thumbs" id="fts-v2-lb-thumbs"></div>
    </div>
</div>

<!-- Video Modal -->
<div id="fts-v2-video-modal" class="fts-v2-video-modal">
    <button class="fts-v2-video-close">&times;</button>
    <div class="fts-v2-video-wrap">
        <iframe id="fts-v2-video-iframe" src="" allowfullscreen title="<?php echo esc_attr__( 'Trip video', 'fts' ); ?>"></iframe>
    </div>
</div>
