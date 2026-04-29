<?php
/**
 * Destination V2 - Toolbar Bar (3 rows)
 *
 * Variables via extract(): $term, $total, $sub_dests, $activities, $trip_types, $difficulties, $all_tags
 */
if ( ! defined( 'ABSPATH' ) ) exit;
?>
<div class="fts-dest-v2-toolbar-bar" id="fts-dest-v2-toolbar-bar">

    <!-- ROW 1: USP Trust Badges -->
    <div class="fts-dest-v2-usp-row">
        <div class="fts-dest-v2-usp">
            <span class="fts-dest-v2-usp-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v2-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
            </span>
            <div class="fts-dest-v2-usp-text">
                <strong>Free Cancellation</strong>
                <span>Up to 12h Before</span>
            </div>
        </div>
        <div class="fts-dest-v2-usp">
            <span class="fts-dest-v2-usp-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v2-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>
            </span>
            <div class="fts-dest-v2-usp-text">
                <strong>Flexible Dates</strong>
                <span>Change Up to 4h Before</span>
            </div>
        </div>
        <div class="fts-dest-v2-usp">
            <span class="fts-dest-v2-usp-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v2-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </span>
            <div class="fts-dest-v2-usp-text">
                <strong>Book Now, Pay Cash</strong>
                <span>On Arrival</span>
            </div>
        </div>
        <div class="fts-dest-v2-usp">
            <span class="fts-dest-v2-usp-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--v2-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            </span>
            <div class="fts-dest-v2-usp-text">
                <strong>Direct Local Team</strong>
                <span>No Overseas Call Centers</span>
            </div>
        </div>
    </div>

    <!-- ROW 2: Filter Controls + Tag Pills + Sort -->
    <div class="fts-dest-v2-tags-row">
        <button type="button" class="fts-dest-v2-tag-pill fts-dest-v2-tag-filter-btn" id="fts-dest-v2-tag-filter-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            Filters
            <span class="fts-dest-v2-tag-count" id="fts-dest-v2-tag-count" style="display:none;">0</span>
        </button>

        <div class="fts-dest-v2-tags-divider"></div>

        <button type="button" class="fts-dest-v2-scroll-arrow fts-dest-v2-scroll-left" id="fts-dest-v2-scroll-left" aria-label="Scroll left">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div class="fts-dest-v2-tags-scroll" id="fts-dest-v2-tags-scroll">
            <?php if ( ! empty( $all_tags ) ) : ?>
                <?php foreach ( $all_tags as $tag ) : ?>
                    <button type="button"
                        class="fts-dest-v2-tag-pill fts-dest-v2-tag-item"
                        data-taxonomy="<?php echo esc_attr( $tag['taxonomy'] ); ?>"
                        data-slug="<?php echo esc_attr( $tag['slug'] ); ?>">
                        <?php echo esc_html( $tag['name'] ); ?>
                    </button>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <button type="button" class="fts-dest-v2-scroll-arrow fts-dest-v2-scroll-right" id="fts-dest-v2-scroll-right" aria-label="Scroll right">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <select class="fts-dest-v2-sort fts-dest-v2-tag-sort" id="fts-dest-v2-sort">
            <option value="featured">Recommended</option>
            <option value="latest">Latest</option>
            <option value="price">Price: Low &rarr; High</option>
            <option value="price-desc">Price: High &rarr; Low</option>
            <option value="days">Duration: Short &rarr; Long</option>
            <option value="rating">Top Rated</option>
        </select>
    </div>

    <!-- ROW 3: Results Count + Active Chips + Clear All -->
    <div class="fts-dest-v2-results-row">
        <div class="fts-dest-v2-results-left">
            <span class="fts-dest-v2-count" id="fts-dest-v2-count">
                <?php echo intval( $total ); ?> results
            </span>
            <span class="fts-dest-v2-results-info" id="fts-dest-v2-results-info"></span>
            <div class="fts-dest-v2-active-chips" id="fts-dest-v2-active-chips"></div>
        </div>
        <button type="button" class="fts-dest-v2-clear-link" id="fts-dest-v2-clear-link">Clear All</button>
    </div>

</div>
