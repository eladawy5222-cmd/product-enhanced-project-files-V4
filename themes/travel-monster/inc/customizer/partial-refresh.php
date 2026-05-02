<?php
/**
 * Travel Monster Customizer Partials
 *
 * @package Travel Monster
*/

if ( ! function_exists( 'travel_monster_customize_partial_blogname' ) ) :
/**
 * Render the site title for the selective refresh partial.
 *
 * @return void
 */
function travel_monster_customize_partial_blogname() {
	bloginfo( 'name' );
}
endif;

if ( ! function_exists( 'travel_monster_customize_partial_blogdescription' ) ) :
/**
 * Render the site tagline for the selective refresh partial.
 *
 * @return void
 */
function travel_monster_customize_partial_blogdescription() {
	bloginfo( 'description' );
}
endif;

if( ! function_exists( 'travel_monster_header_phone_label' ) ) :
/**
 * Header Email
*/
function travel_monster_header_phone_label(){
    $defaults    = travel_monster_get_general_defaults();
    $phone_label = get_theme_mod( 'tmp_phone_label', $defaults['tmp_phone_label'] );
    if( $phone_label ) echo '<div class="contact-phone-label">' . esc_html( $phone_label ) . '</div>';
}
endif;

if( ! function_exists( 'travel_monster_header_phone' ) ) :
/**
 * Header Phone
*/
function travel_monster_header_phone(){    
    if( travel_monster_pro_is_activated() && travel_monster_has_contact_image() ){
        $class = 'head-5-dtls';
    }else{
        $class = 'tel-link';
    }
    $defaults         = travel_monster_get_general_defaults();
    $phone            = get_theme_mod( 'tmp_phone', $defaults['tmp_phone'] );
    $ed_open_whatsapp = get_theme_mod( 'ed_open_whatsapp', $defaults['ed_open_whatsapp'] );
    $whatsapp_msg_lbl = get_theme_mod( 'whatsapp_msg_lbl', $defaults['whatsapp_msg_lbl'] );
    
    if ( $phone ) {
        $clean_phone = preg_replace( '/[^\d+]/', '', $phone );
    
        // Build WhatsApp URL if enabled
        $link = 'tel:' . $clean_phone;
        if ( $ed_open_whatsapp ) {
            $link = 'https://wa.me/' . $clean_phone;
            if ( ! empty( $whatsapp_msg_lbl ) ) {
                $link .= '?text=' . urlencode( $whatsapp_msg_lbl );
            }
        }
        ?>
        <div class="contact-phone-wrap">
            <?php if ( $ed_open_whatsapp && travel_monster_pro_is_activated() && travel_monster_has_contact_image() ) { ?>
                <span class="head-cont-whats">
                    <svg xmlns="http://www.w3.org/2000/svg" width="19.785" height="19.785" viewBox="0 0 19.785 19.785">
                        <path d="M709.89,360a9.886,9.886,0,0,0-8.006,15.691l-1.232,3.676,3.8-1.215A9.891,9.891,0,1,0,709.9,360Zm-2.762,5.025c-.192-.459-.337-.477-.628-.488q-.166-.011-.331-.011a1.435,1.435,0,0,0-1.012.354,3.159,3.159,0,0,0-1.012,2.408,5.653,5.653,0,0,0,1.174,2.984,12.385,12.385,0,0,0,4.924,4.35c2.273.942,2.948.855,3.465.744a2.787,2.787,0,0,0,1.942-1.4,2.456,2.456,0,0,0,.169-1.373c-.07-.122-.262-.192-.552-.337s-1.7-.843-1.971-.936a.552.552,0,0,0-.709.215,12.075,12.075,0,0,1-.773,1.023.624.624,0,0,1-.7.11,7.288,7.288,0,0,1-2.32-1.43,8.8,8.8,0,0,1-1.6-1.995c-.169-.291-.017-.459.116-.616.146-.181.285-.308.43-.477a1.756,1.756,0,0,0,.32-.453.591.591,0,0,0-.041-.536c-.069-.145-.651-1.564-.889-2.14Z" transform="translate(-700 -360)" fill="#67c15e" fill-rule="evenodd"/>
                    </svg>
                </span>
            <?php } 
            
             if (  travel_monster_pro_is_activated() && travel_monster_has_contact_image() ) { ?>
                <span class="head-cont-vib">
                    <svg xmlns="http://www.w3.org/2000/svg" width="19.785" height="19.785" viewBox="0 0 19.785 19.785">
                        <path d="M607.893-810a9.892,9.892,0,0,1,9.893,9.893,9.892,9.892,0,0,1-9.893,9.893A9.892,9.892,0,0,1,598-800.107,9.892,9.892,0,0,1,607.893-810Zm.592,4.029a5.457,5.457,0,0,1,1.813.537,4.93,4.93,0,0,1,1.459,1.052,4.735,4.735,0,0,1,1,1.369,6.54,6.54,0,0,1,.635,2.677c.014.342,0,.418-.074.516a.363.363,0,0,1-.587-.055.955.955,0,0,1-.057-.4,7.086,7.086,0,0,0-.107-1.016,4.673,4.673,0,0,0-1.815-3.014,4.76,4.76,0,0,0-2.749-.97c-.372-.022-.436-.035-.52-.1a.382.382,0,0,1-.014-.547c.092-.084.156-.1.475-.086.166.006.411.026.544.041Zm-4.47.211a1.329,1.329,0,0,1,.235.117,9.47,9.47,0,0,1,1.744,2.228,1.243,1.243,0,0,1,.2.863c-.063.223-.166.34-.63.713a3.409,3.409,0,0,0-.387.345.909.909,0,0,0-.128.441,3.28,3.28,0,0,0,.491,1.372,5.88,5.88,0,0,0,.982,1.154,5.418,5.418,0,0,0,1.289.91c.573.285.923.358,1.179.238a.938.938,0,0,0,.154-.086c.019-.017.17-.2.334-.4.317-.4.389-.463.606-.537a1.049,1.049,0,0,1,.841.076c.215.111.684.4.987.613a14.508,14.508,0,0,1,1.367,1.113.887.887,0,0,1,.1.923,4.325,4.325,0,0,1-1.1,1.371,1.558,1.558,0,0,1-.941.388,1.365,1.365,0,0,1-.737-.154,15.508,15.508,0,0,1-6.677-5.135,14.532,14.532,0,0,1-2.075-3.768c-.276-.759-.289-1.089-.063-1.478a4.343,4.343,0,0,1,.818-.8,2.823,2.823,0,0,1,.923-.553,1.069,1.069,0,0,1,.489.045Zm4.605,1.2a3.782,3.782,0,0,1,2.708,1.619,3.879,3.879,0,0,1,.622,1.73,3.231,3.231,0,0,1,0,.727.444.444,0,0,1-.178.193.436.436,0,0,1-.328-.011c-.151-.076-.2-.2-.2-.525a3.132,3.132,0,0,0-.358-1.453,2.969,2.969,0,0,0-1.091-1.134,3.729,3.729,0,0,0-1.5-.451.5.5,0,0,1-.37-.139.355.355,0,0,1-.029-.441C608-804.6,608.153-804.625,608.62-804.555Zm.416,1.474a1.867,1.867,0,0,1,.933.465,1.931,1.931,0,0,1,.581,1.21c.053.347.031.484-.092.6a.379.379,0,0,1-.458.01c-.094-.071-.123-.145-.145-.346a1.852,1.852,0,0,0-.152-.629,1.108,1.108,0,0,0-.987-.623c-.241-.029-.313-.056-.391-.149a.363.363,0,0,1,.11-.546c.074-.037.105-.041.27-.032A2.6,2.6,0,0,1,609.036-803.081Z" transform="translate(-598 810)" fill="#7f4da0" fill-rule="evenodd"/>
                    </svg>
                </span>
            <?php } ?>
            
            <a href="<?php echo esc_url( $link ); ?>" class="<?php echo esc_attr( $class ); ?>" target="_blank" rel="noopener noreferrer">
                <?php echo esc_html( $phone ); ?>
            </a>
        </div>
    <?php
    }
}
endif;

if( ! function_exists( 'travel_monster_header_email_label' ) ) :
/**
 * Header Email Label
*/
function travel_monster_header_email_label(){
    $defaults    = travel_monster_get_general_defaults();
    $email_label = get_theme_mod( 'tmp_email_label', $defaults['tmp_email_label'] );
    if( $email_label ) echo '<div class="contact-email-label">' . esc_html( $email_label ) . '</div>';
}
endif;

if( ! function_exists( 'travel_monster_header_email' ) ) :
/**
 * Header Email
*/
function travel_monster_header_email(){
    $defaults = travel_monster_get_general_defaults();
    $email    = get_theme_mod( 'tmp_email', $defaults['tmp_email'] );
    if( $email ) echo '<div class="contact-email-wrap"><a href="' . esc_url( 'mailto:' . sanitize_email( $email ) ) . '" class="email-link">' . esc_html( $email ) . '</a></div>';
}
endif;

if( ! function_exists( 'travel_monster_header_mobile_menu_label' ) ) :
/**
 * Menu Label
*/
function travel_monster_header_mobile_menu_label(){
    $defaults   = travel_monster_get_general_defaults();
    $menu_label = get_theme_mod( 'mobile_menu_label', $defaults['mobile_menu_label'] );
    if( $menu_label ) echo '<span class="mob-menu-op-txt">' . esc_html( $menu_label ) . '</span>';
}
endif;

if ( ! function_exists( 'travel_monster_get_header_button' ) ) :
    /**
     * Header Button Text
     */
    function travel_monster_get_header_button() {
        $defaults = travel_monster_get_general_defaults();
        return esc_html( get_theme_mod( 'header_button_label', $defaults['header_button_label'] ) );
    }
    
endif;

if ( ! function_exists( 'travel_monster_get_home_text' ) ) :
/**
 * Breadcrumb Home Text
 */
function travel_monster_get_home_text() {
    $defaults = travel_monster_get_general_defaults();
    return esc_html( get_theme_mod( 'home_text', $defaults['home_text'] ) );
}
endif;

if ( ! function_exists( 'travel_monster_get_single_related_title' ) ) :
    /**
     * Single Related Title
     */
    function travel_monster_get_single_related_title() {
        $defaults = travel_monster_get_general_defaults();
        return esc_html( get_theme_mod( 'single_related_title', $defaults['single_related_title'] ) );
    }
    
endif;

if( ! function_exists( 'travel_monster_get_footer_copyright' ) ) :
/**
 * Footer Copyright
*/
function travel_monster_get_footer_copyright(){
    $defaults  = travel_monster_get_general_defaults();
    $copyright = get_theme_mod( 'footer_copyright', $defaults['footer_copyright'] );
    echo '<span class="copyright">';
    if( $copyright ){
        if( travel_monster_pro_is_activated() ){
            echo wp_kses_post( travel_monster_apply_theme_shortcode( $copyright ) );
        } else {
            echo wp_kses_post( $copyright);
        }
    }else{
        esc_html_e( '&copy; Copyright ', 'travel-monster' );
        echo date_i18n( esc_html( 'Y', 'travel-monster' ) );
        echo ' <a href="' . esc_url( home_url( '/' ) ) . '">' . esc_html( get_bloginfo( 'name' ) ) . '</a>. ';
    }
    echo '</span>'; 
}
endif;

if( ! function_exists( 'travel_monster_payment_label' ) ) :
/**
 * Header Email
*/
function travel_monster_payment_label(){
    $defaults      = travel_monster_get_general_defaults();
    $payment_label = get_theme_mod( 'payment_label', $defaults['payment_label'] );
    if( $payment_label ) echo '<span>'.esc_html( $payment_label ).'</span>';
}
endif;

if( ! function_exists( 'travel_monster_get_blog_read_more' ) ) :
/**
 * Blog Read More Button
*/
function travel_monster_get_blog_read_more(){
    $defaults      = travel_monster_get_general_defaults();
    return esc_html( get_theme_mod( 'blog_read_more',  $defaults['blog_read_more'] ) );
}
endif;

if( ! function_exists( 'travel_monster_get_ed_blog_title' ) ) :
/**
 * Blog Page Title
*/
function travel_monster_get_ed_blog_title(){
    $defaults      = travel_monster_get_general_defaults();
    $ed_blog_title = get_theme_mod( 'ed_blog_title', $defaults['ed_blog_title'] );
    if( $ed_blog_title ){
        echo '<h1 class="page-title">';
            single_post_title();
        echo '</h1>';
    }
}
endif;

if( ! function_exists( 'travel_monster_get_ed_blog_desc' ) ) :
/**
 * Blog Page Description
*/
function travel_monster_get_ed_blog_desc(){
    $defaults     = travel_monster_get_general_defaults();
    $ed_blog_desc = get_theme_mod( 'ed_blog_desc', $defaults['ed_blog_desc'] );
    if( $ed_blog_desc ){
        $posts_id   = get_option('page_for_posts');
        $posts_desc = get_post_field( 'post_content', $posts_id );
        echo '<div class="archive-description">'. wp_kses_post( $posts_desc ) .'</div>';
    }
}
endif;

if( ! function_exists( 'travel_monster_get_ed_archive_title' ) ) :
/**
 * Archive Page Title
*/
function travel_monster_get_ed_archive_title(){
    $defaults         = travel_monster_get_general_defaults();
    $ed_archive_title = get_theme_mod( 'ed_archive_title', $defaults['ed_archive_title'] );
    if( $ed_archive_title ){  
        the_archive_title();
    }
}
endif;

if( ! function_exists( 'travel_monster_get_ed_archive_description' ) ) :
/**
 * Archive Page Description
*/
function travel_monster_get_ed_archive_description(){
    $defaults               = travel_monster_get_general_defaults();
    $ed_archive_description = get_theme_mod( 'ed_archive_description', $defaults['ed_archive_description'] );
    if( $ed_archive_description ){
        the_archive_description( '<div class="archive-description">', '</div>' );
    }
}
endif;

if( ! function_exists( 'travel_monster_get_ed_archive_post_count' ) ) :
/**
 * Archive Page Post Count
*/
function travel_monster_get_ed_archive_post_count(){
    $defaults               = travel_monster_get_general_defaults();
    $ed_archive_post_count = get_theme_mod( 'ed_archive_post_count', $defaults['ed_archive_post_count'] );
    if( $ed_archive_post_count ){      
        travel_monster_search_post_count();
    }
}
endif;

if ( ! function_exists( 'travel_monster_get_social_share_text' ) ) :
/**
 * Social Share Text
 */
function travel_monster_get_social_share_text() {
    $defaults = travel_monster_get_general_defaults();
    return esc_html( get_theme_mod( 'social_share_text', $defaults['social_share_text'] ) );
}
endif;