<?php
/**
 * Quick Info V2 - Price Bar + Social Proof + Trust Badges + Sticky Tabs
 * Variables provided by layout-controller.php via extract()
 */
if ( ! defined( 'ABSPATH' ) ) exit;

$trip_title = get_the_title( $trip_id );
$whatsapp_link = '';
if ( ! empty( $whatsapp_number ) ) {
    $wa_number = preg_replace( '/[^0-9]/', '', (string) $whatsapp_number );
    if ( $wa_number !== '' ) {
        $wa_msg = fts_v2_safe_sprintf(
            __( 'Hi, I have a question about: %s', 'fts' ),
            array( $trip_title ),
            'Hi, I have a question about: ' . $trip_title
        );
        $whatsapp_link = 'https://wa.me/' . rawurlencode( $wa_number ) . '?text=' . rawurlencode( $wa_msg );
    }
}

$dest_names_list = ( ! empty( $destination_terms ) && ! is_wp_error( $destination_terms ) )
    ? wp_list_pluck( $destination_terms, 'name' )
    : array();
$trending_location = ! empty( $dest_names_list ) ? implode( ', ', array_slice( $dest_names_list, 0, 2 ) ) : '';
$hook_text = isset( $overview_excerpt ) ? trim( (string) $overview_excerpt ) : '';
if ( $hook_text === '' && isset( $bold_promise ) ) {
    $hook_text = trim( (string) $bold_promise );
}
$at_items = array();
if ( ! empty( $has_trip_facts ) && ! empty( $trip_facts_items ) && is_array( $trip_facts_items ) ) {
    foreach ( $trip_facts_items as $tf ) {
        $lbl = isset( $tf['label'] ) ? trim( (string) $tf['label'] ) : '';
        $val = isset( $tf['value'] ) ? trim( (string) $tf['value'] ) : '';
        if ( $lbl === '' || $val === '' ) continue;
        $at_items[] = array( 'label' => $lbl, 'value' => $val, 'icon' => $tf['icon'] ?? 'fa-info-circle' );
    }
} elseif ( is_array( $at_a_glance ) ) {
    $duration_val = '';
    if ( isset( $duration_text ) && is_string( $duration_text ) ) {
        $duration_val = trim( $duration_text );
    }
    if ( $duration_val === '' ) {
        $duration_val = isset( $at_a_glance['duration'] ) ? trim( (string) $at_a_glance['duration'] ) : '';
    }

    $meeting_val = isset( $at_a_glance['meeting_point'] ) ? trim( (string) $at_a_glance['meeting_point'] ) : '';
    $group_val   = isset( $at_a_glance['group_size'] ) ? trim( (string) $at_a_glance['group_size'] ) : '';

    if ( $duration_val !== '' ) $at_items[] = array( 'label' => __( 'Duration', 'fts' ), 'value' => $duration_val, 'icon' => 'fa-clock-o' );
    if ( $meeting_val !== '' ) $at_items[]  = array( 'label' => __( 'Meeting point', 'fts' ), 'value' => $meeting_val, 'icon' => 'fa-map-marker' );
    if ( $group_val !== '' ) $at_items[]    = array( 'label' => __( 'Group size', 'fts' ), 'value' => $group_val, 'icon' => 'fa-users' );
}
$at_items = array_slice( $at_items, 0, 4 );
?>

<!-- Quick Price + Hook -->
<div class="fts-v2-quick-bar">
    <div class="fts-v2-container">
        <div class="fts-v2-quick-bar-inner">
            <div class="fts-v2-quick-text">
                <?php if ( $hook_text !== '' ) : ?>
                <p class="fts-v2-hook-text"><?php echo esc_html( $hook_text ); ?></p>
                <?php endif; ?>
                <?php if ( ! empty( $at_items ) ) : ?>
                <ul class="fts-v2-facts-list">
                    <?php foreach ( $at_items as $it ) :
                        $lbl = isset( $it['label'] ) ? trim( (string) $it['label'] ) : '';
                        $val = isset( $it['value'] ) ? trim( (string) $it['value'] ) : '';
                        if ( $lbl === '' || $val === '' ) continue;
                        $icon = isset( $it['icon'] ) ? trim( (string) $it['icon'] ) : 'fa-info-circle';
                    ?>
                        <li class="fts-v2-fact">
                            <span class="fts-v2-fact-icon"><i class="fa <?php echo esc_attr( $icon ); ?>"></i></span>
                            <span class="fts-v2-fact-text">
                                <span class="fts-v2-fact-label"><?php echo esc_html( $lbl ); ?></span>
                                <span class="fts-v2-fact-value"><?php echo esc_html( $val ); ?></span>
                            </span>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <?php endif; ?>
            </div>
            <div class="fts-v2-quick-price-cta">
                <div class="fts-v2-price-block">
                    <?php if ( $old_price > 0 ) : ?>
                        <span class="fts-v2-price-old"><?php echo esc_html( wte_get_formated_price( $old_price ) ); ?></span>
                    <?php endif; ?>
                    <?php if ( $display_price > 0 ) : ?>
                        <span class="fts-v2-price-current"><?php echo esc_html( wte_get_formated_price( $display_price ) ); ?></span>
                        <span class="fts-v2-price-person"><?php echo esc_html__( '/ person', 'fts' ); ?></span>
                    <?php endif; ?>
                    <?php if ( $discount_pct > 0 ) : ?>
                        <span class="fts-v2-discount-badge">-<?php echo intval( $discount_pct ); ?>%</span>
                    <?php endif; ?>
                </div>
                <div class="fts-v2-quick-cta-buttons">
                    <a href="#" class="fts-v2-book-now-btn fts-bm-trigger"><?php echo esc_html__( 'Check Availability', 'fts' ); ?></a>
                    <?php if ( $whatsapp_link ) : ?>
                        <a href="<?php echo esc_url( $whatsapp_link ); ?>" target="_blank" rel="noopener noreferrer nofollow" class="fts-v2-quick-whatsapp-btn" data-fts-wa-source="quick_bar">
                            <i class="fa fa-whatsapp"></i> <?php echo esc_html__( 'WhatsApp', 'fts' ); ?>
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Social Proof -->
<div class="fts-v2-social-proof">
    <div class="fts-v2-container">
        <div class="fts-v2-proof-items" data-trip-id="<?php echo intval( $trip_id ); ?>" data-last-booked-tpl="<?php echo esc_attr__( 'Last booked %s minutes ago', 'fts' ); ?>">
            <span class="fts-v2-proof-item fts-v2-proof-pulse fts-v2-viewer-proof" style="<?php echo ! empty( $viewer_count ) ? '' : 'display:none;'; ?>"><svg class="fts-v2-icon-eye" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> <span class="fts-v2-viewer-count"><?php echo intval( $viewer_count ); ?></span> <?php echo esc_html__( 'people viewing now', 'fts' ); ?></span>
            <?php if ( ! empty( $last_booked_minutes ) ) : ?>
            <span class="fts-v2-proof-item fts-v2-last-booked"><svg class="fts-v2-icon-clock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <?php echo esc_html( sprintf( __( 'Last booked %s minutes ago', 'fts' ), intval( $last_booked_minutes ) ) ); ?></span>
            <?php endif; ?>
            <?php if ( $trending_location ) : ?>
            <span class="fts-v2-proof-item"><svg class="fts-v2-icon-trend" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> <?php echo esc_html( sprintf( __( 'Trending in %s', 'fts' ), $trending_location ) ); ?></span>
            <?php endif; ?>
        </div>
    </div>
</div>
<script>
(function(){
  var items=document.querySelector('.fts-v2-proof-items[data-trip-id]');
  if(!items) return;
  var tripId=items.getAttribute('data-trip-id');
  if(!tripId) return;

  function ensureViewerId(){
    try{
      var k='fts_v2_viewer_id';
      var v=localStorage.getItem(k);
      if(v) return v;
      var r='';
      if(window.crypto&&crypto.getRandomValues){
        var a=new Uint8Array(16);
        crypto.getRandomValues(a);
        for(var i=0;i<a.length;i++) r+=a[i].toString(16).padStart(2,'0');
      }else{
        r=(Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2)).slice(0,32);
      }
      localStorage.setItem(k,r);
      return r;
    }catch(e){
      return (Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2)).slice(0,32);
    }
  }

  function updateLastBooked(){
    var url='/wp-json/fts/v1/trip/'+encodeURIComponent(tripId)+'?nocache=1';
    fetch(url,{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
      var meta=d&&d.meta?d.meta:null;
      var ts=meta&&meta.fts_last_booked_ts?parseInt(meta.fts_last_booked_ts,10):0;
      if(!ts||isNaN(ts)) return;
      var mins=Math.floor((Date.now()/1000-ts)/60);
      if(mins<1) mins=1;
      if(mins>10080) return;
      var existing=items.querySelector('.fts-v2-last-booked');
      if(!existing){
        existing=document.createElement('span');
        existing.className='fts-v2-proof-item fts-v2-last-booked';
        items.appendChild(existing);
      }
      var tpl=items.getAttribute('data-last-booked-tpl')||'Last booked %s minutes ago';
      existing.innerHTML='<svg class="fts-v2-icon-clock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> '+tpl.replace('%s', String(mins));
    })['catch'](function(){});
  }

  function updateViewers(){
    var viewerId=ensureViewerId();
    var url='/wp-json/fts/v1/trip-viewers?trip_id='+encodeURIComponent(tripId)+'&viewer_id='+encodeURIComponent(viewerId)+'&t='+(Date.now());
    fetch(url,{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
      var c=d&&d.viewer_count?parseInt(d.viewer_count,10):0;
      if(!c||isNaN(c)||c<1) return;
      var wrap=items.querySelector('.fts-v2-viewer-proof');
      var num=items.querySelector('.fts-v2-viewer-count');
      if(wrap){ wrap.style.display='inline-flex'; }
      if(num){ num.textContent=String(c); }
    })['catch'](function(){});
  }

  updateLastBooked();
  updateViewers();
  setInterval(updateViewers, 20000);
})();
</script>

<!-- Trust Badges (Dark Navy Bar) -->
<div class="fts-v2-trust-bar">
    <div class="fts-v2-container">
        <div class="fts-v2-trust-items">
            <?php if ( $avg_rating > 0 ) : ?>
            <div class="fts-v2-trust-item">
                <svg class="fts-v2-icon-star" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span><strong><?php echo number_format( $avg_rating, 1 ); ?>/5</strong> (<?php echo esc_html( sprintf( _n( '%s review', '%s reviews', $review_count, 'fts' ), number_format_i18n( $review_count ) ) ); ?>)</span>
            </div>
            <?php endif; ?>
            <?php if ( ! empty( $company_travelers_text ) ) : ?>
            <div class="fts-v2-trust-item">
                <svg class="fts-v2-icon-users" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span><?php echo esc_html( $company_travelers_text ); ?></span>
            </div>
            <?php endif; ?>
            <?php if ( ! empty( $company_certification_text ) ) : ?>
            <div class="fts-v2-trust-item">
                <svg class="fts-v2-icon-shield" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                <span><?php echo esc_html( $company_certification_text ); ?></span>
            </div>
            <?php endif; ?>
            <?php if ( ! empty( $free_cancellation_text ) ) : ?>
            <div class="fts-v2-trust-item">
                <svg class="fts-v2-icon-cancel" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                <a href="<?php echo esc_url( $terms_url ?? home_url( '/terms-and-conditions/' ) ); ?>" target="_blank" rel="noopener noreferrer nofollow"><?php echo esc_html( $free_cancellation_text ); ?></a>
            </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Sticky Tabs Navigation -->
<div class="fts-v2-tabs-nav" id="fts-v2-tabs-nav">
    <div class="fts-v2-container">
        <div class="fts-v2-tabs-scroll">
            <?php foreach ( $tab_sections as $id => $label ) : ?>
                <a href="#fts-v2-sec-<?php echo esc_attr( $id ); ?>" class="fts-v2-tab-link" data-section="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></a>
            <?php endforeach; ?>
        </div>
    </div>
</div>
