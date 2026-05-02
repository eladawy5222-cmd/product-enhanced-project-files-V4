<?php
/**
 * Header Layout One
 * 
 * @package Travel Monster
*/
$defaults           = travel_monster_get_general_defaults();
$siteDefaults       = travel_monster_get_site_defaults();
$header_width       = get_theme_mod( 'header_width_layout', $defaults['header_width_layout']);
$add_class          = 'fullwidth' === $header_width ? 'container-full' : 'container';
$ed_social_media    = get_theme_mod( 'ed_social_media', $defaults ['ed_social_media'] );
$email              = get_theme_mod( 'tmp_email', $defaults['tmp_email'] );
$phone              = get_theme_mod( 'tmp_phone', $defaults['tmp_phone'] );
$header_button_text = get_theme_mod('header_button_label', $defaults['header_button_label']);
$header_button_link = get_theme_mod('header_button_link', $defaults['header_button_link']);
$siteBlogname       = get_option('blogname');
$hideblogname       = get_theme_mod('hide_title', $siteDefaults['hide_title']);
$blogdesc           = get_option('blogdescription');
$hideblogdesc       = get_theme_mod('hide_tagline', $siteDefaults['hide_tagline']);
$transparent_header    = get_theme_mod( 'ed_transparent_header', false );
$ed_bg_effect          = get_theme_mod( 'ed_bg_effect', false );
$header_type           = get_theme_mod( 'wpte_header_type', 'prebuilt' );
$get_transparent_pages = get_theme_mod( 'transparent_pages_list', array( 'homepage' ) );
$is_transparent_page   = ( in_array( 'homepage', $get_transparent_pages ) && is_front_page() ) ||
                         ( in_array( 'all_pages', $get_transparent_pages ) && is_page() ) ||
                         ( in_array( 'archive', $get_transparent_pages ) && is_archive() ) ||
                         ( in_array( 'search', $get_transparent_pages ) && is_search() ) ||
                         ( in_array( 'blog', $get_transparent_pages ) && is_home() ) ||
                         in_array( get_the_id(), $get_transparent_pages );
$is_transparent_active = $transparent_header && $is_transparent_page;
$class                 = ( $is_transparent_active && $ed_bg_effect ) ? 'tm-transparent-header tm-background-effect' : ( $is_transparent_active ? 'tm-transparent-header' : '' );
/**
 * Desktop Header
 */   
?>
<header id="masthead" class="site-header header-layout-1 <?php echo esc_attr( $class ); ?>"<?php travel_monster_microdata( 'header' ); ?>>
    <?php if( $ed_social_media || $email || $phone || has_nav_menu('secondary') || travel_monster_is_currency_converter_activated() || travel_monster_is_polylang_active() || travel_monster_is_wpml_active() ) { ?>
        <div class="header-m">
            <div class="<?php echo esc_attr($add_class); ?>">
                <?php if( $ed_social_media || $email || $phone ) { ?>
                    <div class="header-t-rght-wrap">
                        <?php if( $ed_social_media ){ ?>
                            <div class="social-media-wrap">
                                <?php
                                    $social_icons = new Travel_Monster_Social_Lists;
                                    $social_icons->travel_monster_social_links();
                                ?>
                            </div>
                        <?php }
                            travel_monster_header_phone(); 
                            travel_monster_header_email(); 
                        ?>
                    </div>
                <?php } if( has_nav_menu('secondary') || travel_monster_is_currency_converter_activated() || travel_monster_is_polylang_active() || travel_monster_is_wpml_active() ){ ?>
                    <div class="header-t-lft-wrap">
                        <?php travel_monster_secondary_navigation(); ?>
                        <?php if( travel_monster_is_currency_converter_activated() || travel_monster_is_polylang_active() || travel_monster_is_wpml_active() ){ ?>
                            <div class="languagendcurrency-wrap">
                                <?php 
                                /**
                                 * Language Switcher
                                */ 
                                do_action( 'travel_monster_language_switcher' ); ?>
                                <?php 
                                /**
                                 * Currency Converter
                                */ 
                                do_action( 'travel_monster_currency_converter' ); ?>
                            </div>
                        <?php } ?>
                    </div>
                <?php } ?>
            </div>
        </div> <!-- header-t -->
    <?php } ?>
    <!-- <div class="header-m"></div> -->
    <?php if( has_nav_menu( 'primary') || has_custom_logo() || ($header_button_text && $header_button_link) || (!empty($siteBlogname) && !$hideblogname) || ( !empty($blogdesc) && !$hideblogdesc) ){ ?>
        <div class="header-b">
            <div class="<?php echo esc_attr($add_class); ?>">
                <?php travel_monster_site_branding( false ); ?>
                <div class="navigation-wrap">
                    <?php travel_monster_primary_navigation(); ?>
                    <?php travel_monster_primary_header_button(); ?>
                </div>
            </div><!-- container -->
        </div> <!-- header-b -->
    <?php } ?>
    <?php travel_monster_sticky_header(); ?>
</header><!-- #masthead -->
<?php
/**
 * Mobile Header
 */
travel_monster_mobile_header();  