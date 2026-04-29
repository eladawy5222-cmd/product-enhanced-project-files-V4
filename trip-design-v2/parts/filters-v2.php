<?php
/**
 * Destination V2 - Filter Sidebar
 *
 * Variables via extract(): $term, $sub_dests, $activities, $trip_types, $difficulties, $durations, $destinations (optional)
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$sections    = array();
$current_tax = $term->taxonomy;

$sub_label_map = array(
    'destination' => 'Sub-destinations',
    'trip_types'  => 'Sub-types',
    'activities'  => 'Sub-activities',
);

if ( ! empty( $sub_dests ) ) {
    $items = '';
    foreach ( $sub_dests as $t ) {
        $items .= '<label class="fts-dest-v2-filter-item">'
            . '<input type="checkbox" name="' . esc_attr( $current_tax ) . '" value="' . esc_attr( $t->slug ) . '">'
            . '<span class="fts-dest-v2-cb"></span>'
            . '<span class="fts-dest-v2-filter-label">' . esc_html( $t->name ) . '</span>'
            . '<span class="fts-dest-v2-filter-count">' . intval( $t->count ) . '</span>'
            . '</label>';
    }
    $sections[] = array( 'title' => $sub_label_map[ $current_tax ] ?? 'Sub-categories', 'body' => $items );
}

if ( ! empty( $destinations ) ) {
    $items = '';
    foreach ( $destinations as $t ) {
        $items .= '<label class="fts-dest-v2-filter-item">'
            . '<input type="checkbox" name="destination" value="' . esc_attr( $t->slug ) . '">'
            . '<span class="fts-dest-v2-cb"></span>'
            . '<span class="fts-dest-v2-filter-label">' . esc_html( $t->name ) . '</span>'
            . '<span class="fts-dest-v2-filter-count">' . intval( $t->trip_count ?? $t->count ) . '</span>'
            . '</label>';
    }
    $sections[] = array( 'title' => 'Destinations', 'body' => $items );
}

if ( ! empty( $activities ) ) {
    $items = '';
    foreach ( $activities as $t ) {
        $items .= '<label class="fts-dest-v2-filter-item">'
            . '<input type="checkbox" name="activities" value="' . esc_attr( $t->slug ) . '">'
            . '<span class="fts-dest-v2-cb"></span>'
            . '<span class="fts-dest-v2-filter-label">' . esc_html( $t->name ) . '</span>'
            . '<span class="fts-dest-v2-filter-count">' . intval( $t->trip_count ?? $t->count ) . '</span>'
            . '</label>';
    }
    $sections[] = array( 'title' => 'Activities', 'body' => $items );
}

if ( ! empty( $trip_types ) ) {
    $items = '';
    foreach ( $trip_types as $t ) {
        $items .= '<label class="fts-dest-v2-filter-item">'
            . '<input type="checkbox" name="trip_types" value="' . esc_attr( $t->slug ) . '">'
            . '<span class="fts-dest-v2-cb"></span>'
            . '<span class="fts-dest-v2-filter-label">' . esc_html( $t->name ) . '</span>'
            . '<span class="fts-dest-v2-filter-count">' . intval( $t->trip_count ?? $t->count ) . '</span>'
            . '</label>';
    }
    $sections[] = array( 'title' => 'Trip Types', 'body' => $items );
}

if ( ! empty( $difficulties ) ) {
    $items = '';
    foreach ( $difficulties as $t ) {
        $items .= '<label class="fts-dest-v2-filter-item">'
            . '<input type="checkbox" name="difficulty" value="' . esc_attr( $t->slug ) . '">'
            . '<span class="fts-dest-v2-cb"></span>'
            . '<span class="fts-dest-v2-filter-label">' . esc_html( $t->name ) . '</span>'
            . '<span class="fts-dest-v2-filter-count">' . intval( $t->trip_count ?? $t->count ) . '</span>'
            . '</label>';
    }
    $sections[] = array( 'title' => 'Difficulty', 'body' => $items );
}

if ( ! empty( $durations ) ) {
    $labels = array( '1-3' => '1 – 3 Days', '4-7' => '4 – 7 Days', '8-14' => '8 – 14 Days', '15+' => '15+ Days' );
    $items  = '';
    foreach ( $durations as $range => $count ) {
        $items .= '<label class="fts-dest-v2-filter-item">'
            . '<input type="checkbox" name="duration" value="' . esc_attr( $range ) . '">'
            . '<span class="fts-dest-v2-cb"></span>'
            . '<span class="fts-dest-v2-filter-label">' . esc_html( $labels[ $range ] ?? $range ) . '</span>'
            . '<span class="fts-dest-v2-filter-count">' . intval( $count ) . '</span>'
            . '</label>';
    }
    $sections[] = array( 'title' => 'Duration', 'body' => $items );
}
?>
<div class="fts-dest-v2-filters" id="fts-dest-v2-filters" data-slug="<?php echo esc_attr( $term->slug ); ?>" data-taxonomy="<?php echo esc_attr( $term->taxonomy ); ?>">
    <div class="fts-dest-v2-filters-header">
        <h3 class="fts-dest-v2-filters-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            Filters
        </h3>
        <button type="button" class="fts-dest-v2-filters-close" id="fts-dest-v2-filters-close" aria-label="Close filters">&times;</button>
        <button type="button" class="fts-dest-v2-clear-all" id="fts-dest-v2-clear-all">Clear All</button>
    </div>
    <?php foreach ( $sections as $i => $sec ) : ?>
    <div class="fts-dest-v2-filter-section <?php echo $i === 0 ? 'is-open' : ''; ?>">
        <button type="button" class="fts-dest-v2-filter-toggle">
            <span><?php echo esc_html( $sec['title'] ); ?></span>
            <svg class="fts-dest-v2-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="fts-dest-v2-filter-body">
            <?php echo $sec['body']; ?>
        </div>
    </div>
    <?php endforeach; ?>
</div>
