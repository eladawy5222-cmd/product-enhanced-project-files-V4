<?php
/**
 * Trip Header Bar V2 — Improved multilingual slim header for single trip pages
 * Logo | Navigation | Currency | Language | Search
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/* -------------------------------------------------------
 * Base URLs / Logo
 * ----------------------------------------------------- */
$logo_id  = get_theme_mod( 'custom_logo' );
$logo_url = $logo_id ? wp_get_attachment_image_url( $logo_id, 'medium' ) : '';
$site_url = home_url( '/' );

/* -------------------------------------------------------
 * Detect current language safely
 * ----------------------------------------------------- */
if ( ! function_exists( 'fts_detect_current_lang' ) ) {
    function fts_detect_current_lang() {
        $lang_code = '';

        if ( defined( 'ICL_LANGUAGE_CODE' ) && ICL_LANGUAGE_CODE ) {
            $lang_code = strtolower( (string) ICL_LANGUAGE_CODE );
        }

        if ( $lang_code === '' ) {
            $locale = function_exists( 'determine_locale' ) ? (string) determine_locale() : (string) get_locale();
            $locale = strtolower( str_replace( '_', '-', $locale ) );

            if ( strpos( $locale, 'zh-hans' ) === 0 || strpos( $locale, 'zh-cn' ) === 0 ) {
                $lang_code = 'zh-hans';
            } else {
                $lang_code = strtok( $locale, '-' );
            }
        }

        if ( ! $lang_code ) {
            $lang_code = 'en';
        }

        return $lang_code;
    }
}

$lang_code = fts_detect_current_lang();

/* -------------------------------------------------------
 * Translate header labels
 * ----------------------------------------------------- */
$label_defaults = array(
    'travel_packages' => 'Travel Packages',
    'packages'        => 'Packages',
    'menu'            => 'Menu',
    'trip_navigation' => 'Trip page navigation',
    'home'            => 'Home',
);

$label_by_lang = array(
    'de' => array(
        'travel_packages' => 'Reisepakete',
        'packages'        => 'Pakete',
        'menu'            => 'Menü',
        'trip_navigation' => 'Navigation der Reiseseite',
        'home'            => 'Startseite',
    ),
    'es' => array(
        'travel_packages' => 'Paquetes de viaje',
        'packages'        => 'Paquetes',
        'menu'            => 'Menú',
        'trip_navigation' => 'Navegación de la página del tour',
        'home'            => 'Inicio',
    ),
    'fr' => array(
        'travel_packages' => 'Forfaits voyage',
        'packages'        => 'Forfaits',
        'menu'            => 'Menu',
        'trip_navigation' => 'Navigation de la page du circuit',
        'home'            => 'Accueil',
    ),
    'ru' => array(
        'travel_packages' => 'Турпакеты',
        'packages'        => 'Пакеты',
        'menu'            => 'Меню',
        'trip_navigation' => 'Навигация по странице тура',
        'home'            => 'Главная',
    ),
    'tr' => array(
        'travel_packages' => 'Seyahat Paketleri',
        'packages'        => 'Paketler',
        'menu'            => 'Menü',
        'trip_navigation' => 'Tur sayfası gezinmesi',
        'home'            => 'Ana Sayfa',
    ),
    'ro' => array(
        'travel_packages' => 'Pachete de călătorie',
        'packages'        => 'Pachete',
        'menu'            => 'Meniu',
        'trip_navigation' => 'Navigarea paginii turului',
        'home'            => 'Acasă',
    ),
    'ja' => array(
        'travel_packages' => '旅行パッケージ',
        'packages'        => 'パッケージ',
        'menu'            => 'メニュー',
        'trip_navigation' => 'ツアーページのナビゲーション',
        'home'            => 'ホーム',
    ),
    'zh-hans' => array(
        'travel_packages' => '旅游套餐',
        'packages'        => '套餐',
        'menu'            => '菜单',
        'trip_navigation' => '行程页面导航',
        'home'            => '首页',
    ),
);

$labels = $label_defaults;
if ( isset( $label_by_lang[ $lang_code ] ) ) {
    $labels = array_merge( $labels, $label_by_lang[ $lang_code ] );
}

/* Register strings in WPML */
if ( function_exists( 'icl_register_string' ) ) {
    foreach ( $label_defaults as $key => $val ) {
        icl_register_string( 'fts', 'trip_header_' . $key, $val );
    }
}

/* Translate through WPML if available */
if ( function_exists( 'icl_t' ) ) {
    foreach ( $labels as $key => $val ) {
        $labels[ $key ] = icl_t( 'fts', 'trip_header_' . $key, $val );
    }
} elseif ( function_exists( 'apply_filters' ) ) {
    foreach ( $labels as $key => $val ) {
        $labels[ $key ] = apply_filters( 'wpml_translate_single_string', $val, 'fts', 'trip_header_' . $key );
    }
}

/* -------------------------------------------------------
 * Localized URLs
 * ----------------------------------------------------- */
$packages_url = home_url( '/packages/' );
if ( function_exists( 'apply_filters' ) ) {
    $packages_url = apply_filters( 'wpml_permalink', $packages_url, $lang_code );
}

/* -------------------------------------------------------
 * Language switcher helper
 * ----------------------------------------------------- */
if ( ! function_exists( 'fts_get_language_switcher_items' ) ) {
    function fts_get_language_switcher_items() {
        $flag_base = content_url( '/plugins/sitepress-multilingual-cms/res/flags/' );
        $langs     = array();

        if ( function_exists( 'icl_get_languages' ) ) {
            $raw = icl_get_languages( 'skip_missing=0&orderby=code' );
            if ( ! empty( $raw ) && is_array( $raw ) ) {
                foreach ( $raw as $l ) {
                    $code = ! empty( $l['language_code'] ) ? strtolower( (string) $l['language_code'] ) : '';
                    if ( ! $code ) {
                        continue;
                    }

                    $langs[] = array(
                        'code'   => $code,
                        'name'   => ! empty( $l['native_name'] ) ? $l['native_name'] : strtoupper( $code ),
                        'url'    => ! empty( $l['url'] ) ? $l['url'] : home_url( '/' ),
                        'flag'   => ! empty( $l['country_flag_url'] ) ? $l['country_flag_url'] : $flag_base . $code . '.svg',
                        'active' => ! empty( $l['active'] ),
                    );
                }
            }
        }

        if ( empty( $langs ) ) {
            $site_base = home_url();
            $langs = array(
                array( 'code' => 'en',      'name' => 'English',  'url' => $site_base . '/',          'flag' => $flag_base . 'en.svg', 'active' => true  ),
                array( 'code' => 'ar',      'name' => 'العربية',  'url' => $site_base . '/ar/',       'flag' => $flag_base . 'ar.svg', 'active' => false ),
                array( 'code' => 'de',      'name' => 'Deutsch',  'url' => $site_base . '/de/',       'flag' => $flag_base . 'de.svg', 'active' => false ),
                array( 'code' => 'es',      'name' => 'Español',  'url' => $site_base . '/es/',       'flag' => $flag_base . 'es.svg', 'active' => false ),
                array( 'code' => 'fr',      'name' => 'Français', 'url' => $site_base . '/fr/',       'flag' => $flag_base . 'fr.svg', 'active' => false ),
                array( 'code' => 'it',      'name' => 'Italiano', 'url' => $site_base . '/it/',       'flag' => $flag_base . 'it.svg', 'active' => false ),
                array( 'code' => 'ro',      'name' => 'Română',   'url' => $site_base . '/ro/',       'flag' => $flag_base . 'ro.svg', 'active' => false ),
                array( 'code' => 'ru',      'name' => 'Русский',  'url' => $site_base . '/ru/',       'flag' => $flag_base . 'ru.svg', 'active' => false ),
                array( 'code' => 'tr',      'name' => 'Türkçe',   'url' => $site_base . '/tr/',       'flag' => $flag_base . 'tr.svg', 'active' => false ),
                array( 'code' => 'ja',      'name' => '日本語',     'url' => $site_base . '/ja/',       'flag' => $flag_base . 'ja.svg', 'active' => false ),
                array( 'code' => 'zh-hans', 'name' => '简体中文',   'url' => $site_base . '/zh-hans/',  'flag' => $flag_base . 'zh-hans.svg', 'active' => false ),
            );
        }

        return $langs;
    }
}

$fts_langs = fts_get_language_switcher_items();
$current_lang = $fts_langs[0];
foreach ( $fts_langs as $fl ) {
    if ( ! empty( $fl['active'] ) ) {
        $current_lang = $fl;
        break;
    }
}

/* -------------------------------------------------------
 * Menu fallback helper
 * ----------------------------------------------------- */
if ( ! function_exists( 'fts_build_fallback_menu_html' ) ) {
    function fts_build_fallback_menu_html( $menu_class, $labels, $packages_url ) {
        $home_url_localized = home_url( '/' );
        if ( function_exists( 'apply_filters' ) ) {
            $home_url_localized = apply_filters( 'wpml_permalink', $home_url_localized );
        }

        $items = array(
            array(
                'label' => $labels['home'],
                'url'   => $home_url_localized,
            ),
            array(
                'label' => $labels['packages'],
                'url'   => $packages_url,
            ),
        );

        $html = '<ul class="' . esc_attr( $menu_class ) . '">';
        foreach ( $items as $item ) {
            $html .= '<li class="menu-item">';
            $html .= '<a href="' . esc_url( $item['url'] ) . '">' . esc_html( $item['label'] ) . '</a>';
            $html .= '</li>';
        }
        $html .= '</ul>';

        return $html;
    }
}

/* -------------------------------------------------------
 * Normalize and improve menu HTML
 * - Keep WPML-generated links
 * - Translate some hardcoded English labels safely
 * ----------------------------------------------------- */
if ( ! function_exists( 'fts_normalize_menu_html' ) ) {
    function fts_normalize_menu_html( $html, $labels ) {
        if ( ! is_string( $html ) || trim( $html ) === '' ) {
            return '';
        }

        $replace_map = array(
            'Travel Packages' => $labels['travel_packages'],
            'Packages'        => $labels['packages'],
        );

        foreach ( $replace_map as $from => $to ) {
            $pattern = '/>\s*' . preg_quote( $from, '/' ) . '\s*</u';
            $html    = preg_replace( $pattern, '>' . esc_html( $to ) . '<', $html );
        }

        return $html;
    }
}

/* -------------------------------------------------------
 * Get desktop and mobile menu HTML
 * ----------------------------------------------------- */
$desktop_menu_html = wp_nav_menu( array(
    'theme_location' => 'primary',
    'container'      => false,
    'menu_class'     => 'fts-v2-thb-menu',
    'depth'          => 2,
    'fallback_cb'    => false,
    'echo'           => false,
) );

$mobile_menu_html = wp_nav_menu( array(
    'theme_location' => 'primary',
    'container'      => false,
    'menu_class'     => 'fts-v2-thb-mobile-nav',
    'depth'          => 2,
    'fallback_cb'    => false,
    'echo'           => false,
) );

if ( empty( $desktop_menu_html ) ) {
    $desktop_menu_html = fts_build_fallback_menu_html( 'fts-v2-thb-menu', $labels, $packages_url );
}
if ( empty( $mobile_menu_html ) ) {
    $mobile_menu_html = fts_build_fallback_menu_html( 'fts-v2-thb-mobile-nav', $labels, $packages_url );
}

$desktop_menu_html = fts_normalize_menu_html( $desktop_menu_html, $labels );
$mobile_menu_html  = fts_normalize_menu_html( $mobile_menu_html, $labels );

?>

<header class="fts-v2-trip-header-bar" id="fts-v2-trip-header">
    <div class="fts-v2-thb-inner">

        <!-- Logo -->
        <div class="fts-v2-thb-logo">
            <a href="<?php echo esc_url( $site_url ); ?>" aria-label="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>">
                <?php if ( $logo_url ) : ?>
                    <img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php echo esc_attr( get_bloginfo( 'name' ) ); ?>" class="fts-v2-thb-logo-image">
                <?php else : ?>
                    <span class="fts-v2-thb-logo-text">FTS TRAVEL</span>
                <?php endif; ?>
            </a>
        </div>

        <!-- Desktop Navigation -->
        <nav class="fts-v2-thb-nav" aria-label="<?php echo esc_attr( $labels['trip_navigation'] ); ?>">
            <?php echo $desktop_menu_html; ?>
        </nav>

        <!-- Right-side utilities -->
        <div class="fts-v2-thb-utils">

            <!-- Currency Switcher -->
            <div class="fts-v2-thb-item fts-v2-thb-currency">
                <?php
                if ( shortcode_exists( 'fts_currency_switcher' ) ) {
                    echo do_shortcode( '[fts_currency_switcher]' );
                }
                ?>
            </div>

            <!-- Language Switcher -->
            <div class="fts-v2-thb-item fts-v2-thb-lang">
                <div class="fts-v2-lang-switcher" id="fts-v2-lang-switcher">
                    <button type="button" class="fts-v2-lang-current" id="fts-v2-lang-current" aria-expanded="false" aria-haspopup="menu" aria-controls="fts-v2-lang-dropdown">
                        <span class="fts-v2-switcher-label">Language</span>
                        <img class="fts-v2-lang-flag" src="<?php echo esc_url( $current_lang['flag'] ); ?>" alt="" width="18" height="14" decoding="async">
                        <span class="fts-v2-switcher-code"><?php echo esc_html( strtoupper( $current_lang['code'] ) ); ?></span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path d="m6 9 6 6 6-6"/>
                        </svg>
                    </button>

                    <ul class="fts-v2-lang-dropdown" id="fts-v2-lang-dropdown" role="menu" aria-labelledby="fts-v2-lang-current">
                        <?php foreach ( $fts_langs as $fl ) : ?>
                            <li class="<?php echo ! empty( $fl['active'] ) ? 'active' : ''; ?>">
                                <a href="<?php echo esc_url( $fl['url'] ); ?>" hreflang="<?php echo esc_attr( $fl['code'] ); ?>" lang="<?php echo esc_attr( $fl['code'] ); ?>" role="menuitem">
                                    <img class="fts-v2-lang-flag" src="<?php echo esc_url( $fl['flag'] ); ?>" alt="" width="18" height="14" decoding="async">
                                    <span class="fts-v2-lang-native"><?php echo esc_html( $fl['name'] ); ?></span>
                                </a>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            </div>

            <!-- Search -->
            <div class="fts-v2-thb-item fts-v2-thb-search">
                <?php
                if ( shortcode_exists( 'fts_smart_search' ) ) {
                    echo do_shortcode( '[fts_smart_search]' );
                }
                ?>
            </div>

        </div>

        <!-- Mobile Hamburger -->
        <button
            class="fts-v2-thb-burger"
            id="fts-v2-thb-burger"
            aria-label="<?php echo esc_attr( $labels['menu'] ); ?>"
            aria-expanded="false"
            aria-controls="fts-v2-thb-mobile-menu"
            type="button"
        >
            <span></span><span></span><span></span>
        </button>

    </div>

    <!-- Mobile Dropdown -->
    <div class="fts-v2-thb-mobile-menu" id="fts-v2-thb-mobile-menu" hidden>
        <?php echo $mobile_menu_html; ?>

        <div class="fts-v2-thb-mobile-utils">
            <div class="fts-v2-thb-item fts-v2-thb-lang">
                <div class="fts-v2-lang-switcher">
                    <?php foreach ( $fts_langs as $fl ) : ?>
                        <?php
                        $mobile_lang_code = strtolower( (string) $fl['code'] );
                        $mobile_lang_label = strtoupper( (string) $fl['code'] );
                        if ( $mobile_lang_code === 'zh-hans' ) {
                            $mobile_lang_label = '中文';
                        }
                        ?>
                        <a
                            href="<?php echo esc_url( $fl['url'] ); ?>"
                            class="fts-v2-mob-lang-link <?php echo ! empty( $fl['active'] ) ? 'active' : ''; ?>"
                            hreflang="<?php echo esc_attr( $fl['code'] ); ?>"
                            lang="<?php echo esc_attr( $fl['code'] ); ?>"
                        >
                            <img class="fts-v2-lang-flag" src="<?php echo esc_url( $fl['flag'] ); ?>" alt="" width="18" height="14">
                            <?php echo esc_html( $mobile_lang_label ); ?>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
</header>
