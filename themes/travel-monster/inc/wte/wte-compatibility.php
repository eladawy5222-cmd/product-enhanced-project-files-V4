<?php
/**
 *
 * This file is used to make changes to contents displayed by the WTE plugin as needed by the Theme
 *
 * @since 1.0.0
 * @package    Travel_Monster
 */

if( ! function_exists( 'travel_monster_get_currency_converter_template' ) ) :
/**
 * Get template for WTE currency converter dropdown
 */
function travel_monster_get_currency_converter_template(){
	$template = get_template_directory() . '/inc/wte/wte-currency-converter-public-display-alt.php';
	return $template;
}
endif;

/**
 * Add the filter only if WTE currency converter is activated
 */
if ( travel_monster_is_currency_converter_activated() ){
	add_filter( 'wte_cc_display_list', 'travel_monster_get_currency_converter_template' );
}

/**
 * Display archive description only
 */
add_filter( 'wte_trip_archive_description_page_header', function(){ 
	if ( is_archive( 'trip' ) ) return ; ?>
	<header class="tmp-page-header">
		<?php the_archive_description( '<div class="taxonomy-description" itemprop="description">', '</div>' ); ?>
	</header>
	<?php
});

/**
 * Remove search page title
 */
add_filter( 'wte-trip-search-page-title', function(){
	return '';
});


if ( class_exists( 'Wte_Trip_Review_Init' ) ) {
	add_action( 'wte_average_review_wrap_open', function(){
		echo '<div id="tmp-average-rating"></div>';
	});
	add_action( 'wp_travel_engine_header_hook', 'travel_monster_add_review_below_title');
}

function travel_monster_add_review_below_title(){
	$idNum         = get_the_ID();
    $review_obj    = new Wte_Trip_Review_Init();
    $comment_datas = $review_obj->pull_comment_data( $idNum );
	if ( ! empty( $comment_datas ) ){ ?>
        <div class="average-rating">
            <?php
            $icon_type               = '';
            $icon_fill_color         = '#F39C12'; ?>
            <div
                class="agg-rating trip-review-stars <?php echo ! empty( $review_icon_type ) ? 'svg-trip-adv' : 'trip-review-default'; ?>"
                data-icon-type='<?php echo esc_attr( $icon_type ); ?>' data-rating-value="<?php echo esc_attr( $comment_datas['aggregate'] ); ?>"
                data-rateyo-rated-fill="<?php echo esc_attr( $icon_fill_color ); ?>"
                data-rateyo-read-only="true"
            >
            </div>
            <a class="tmp-rating-text" href="#tmp-average-rating">
                <?php echo esc_html( $comment_datas['i'] );
                if( $comment_datas['i']=="1" ) { 
                    echo esc_html__( ' Review','travel-monster' ); 
                }else{
                    echo esc_html__( ' Reviews','travel-monster' ); 
                } ?>
            </a>
        </div>
	<?php }
}