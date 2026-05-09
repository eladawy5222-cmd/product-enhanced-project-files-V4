<?php
/**
 * FTS Currency Switcher - Standalone Implementation
 * 
 * Defines a custom currency switcher that works with WP Travel Engine.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

if ( ! function_exists( 'fts_currency_switcher_resolve_code' ) ) {
    function fts_currency_switcher_resolve_code( $cookies = null, $query = null ) {
        $cookies = is_array( $cookies ) ? $cookies : $_COOKIE;
        $query   = is_array( $query ) ? $query : $_GET;

        $q = isset( $query['wte_cc'] ) ? strtoupper( trim( (string) $query['wte_cc'] ) ) : '';
        if ( $q !== '' ) return sanitize_text_field( $q );

        $cc = isset( $cookies['cc_code'] ) ? strtoupper( trim( (string) $cookies['cc_code'] ) ) : '';
        if ( $cc !== '' ) return sanitize_text_field( $cc );

        $cc2 = isset( $cookies['wte_currency_code'] ) ? strtoupper( trim( (string) $cookies['wte_currency_code'] ) ) : '';
        if ( $cc2 !== '' ) return sanitize_text_field( $cc2 );

        if ( function_exists( 'fts_v2_get_active_currency_code' ) ) {
            $c = (string) fts_v2_get_active_currency_code();
            $c = strtoupper( trim( $c ) );
            if ( $c !== '' ) return $c;
        }

        if ( function_exists( 'wp_travel_engine_get_currency_code' ) ) {
            $c = (string) wp_travel_engine_get_currency_code();
            $c = strtoupper( trim( $c ) );
            if ( $c !== '' ) return $c;
        }

        return 'USD';
    }
}

class FTS_Currency_Switcher {

    public function __construct() {
        // Register Shortcode
        add_shortcode( 'fts_currency_switcher', array( $this, 'render_switcher' ) );

        // Enqueue Scripts & Styles
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        
        // Handle Currency Change (if needed server-side, though JS cookie is usually enough)
        // WTE usually reads the 'wte_currency_code' or 'cc_code' cookie directly.
    }

    public function enqueue_assets() {
        $css_file = get_stylesheet_directory() . '/fts-currency-switcher/assets/css/style.css';
        $js_file  = get_stylesheet_directory() . '/fts-currency-switcher/assets/js/script.js';
        $css_ver  = file_exists( $css_file ) ? (string) filemtime( $css_file ) : null;
        $js_ver   = file_exists( $js_file ) ? (string) filemtime( $js_file ) : null;

        wp_enqueue_style( 'fts-currency-style', get_stylesheet_directory_uri() . '/fts-currency-switcher/assets/css/style.css', array(), $css_ver );
        wp_enqueue_script( 'fts-currency-script', get_stylesheet_directory_uri() . '/fts-currency-switcher/assets/js/script.js', array(), $js_ver, true );
        
        // Pass PHP data to JS
        wp_localize_script( 'fts-currency-script', 'ftsCurrencyConfig', array(
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'cookieName' => 'wte_currency_code', // Standard WP Travel Engine cookie name
        ));
    }

    public function render_switcher() {
        // Get Currencies from WP Travel Engine Settings
        $currencies = $this->get_available_currencies();
        $current_currency = $this->get_current_currency();
        
        if ( empty( $currencies ) ) {
            return ''; 
        }

        $uid = function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : uniqid( 'fts', true );
        $dropdown_id = 'fts-cs-dropdown-' . preg_replace( '/[^a-z0-9\-_]/i', '', (string) $uid );
        $button_id   = 'fts-cs-current-' . preg_replace( '/[^a-z0-9\-_]/i', '', (string) $uid );

        ob_start();
        ?>
        <style>
            .fts-currency-switcher{position:relative;display:inline-block;z-index:9999}
            .fts-currency-switcher .fts-cs-current{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
            .fts-currency-switcher .fts-cs-dropdown{position:absolute;top:calc(100% + 8px);right:0;left:auto;background:#fff;border:1px solid rgba(15,23,42,0.08);border-radius:12px;box-shadow:0 16px 32px rgba(0,0,0,0.16);padding:6px 0;margin:0;list-style:none;min-width:160px;opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease,visibility .18s ease;pointer-events:none}
            .fts-currency-switcher.open .fts-cs-dropdown{opacity:1;visibility:visible;transform:translateY(0);pointer-events:auto}
            .fts-currency-switcher .fts-cs-item{cursor:pointer;width:100%;background:transparent;border:0;padding:8px 12px;display:flex;align-items:center;gap:7px;text-align:left}
            .fts-currency-switcher .fts-cs-label{font:inherit;font-weight:700}
        </style>
        <div class="fts-currency-switcher">
            <button
                type="button"
                class="fts-cs-current"
                id="<?php echo esc_attr( $button_id ); ?>"
                aria-expanded="false"
                aria-haspopup="menu"
                aria-controls="<?php echo esc_attr( $dropdown_id ); ?>"
            >
                <span class="fts-cs-label">Currency</span>
                <span class="fts-cs-flag" aria-hidden="true"><?php echo esc_html( $this->get_currency_symbol( $current_currency ) ); ?></span>
                <span class="fts-cs-code"><?php echo esc_html( $current_currency ); ?></span>
                <span class="screen-reader-text"><?php echo esc_html( 'Current currency: ' . $current_currency ); ?></span>
                <svg class="fts-cs-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <ul class="fts-cs-dropdown" id="<?php echo esc_attr( $dropdown_id ); ?>" role="menu" aria-labelledby="<?php echo esc_attr( $button_id ); ?>">
                <?php foreach ( $currencies as $code => $name ) : 
                    $is_active = ( $code === $current_currency );
                    $active_class = $is_active ? 'active' : '';
                    $symbol = $this->get_currency_symbol( $code );
                ?>
                    <li role="none">
                        <button
                            type="button"
                            class="fts-cs-item <?php echo esc_attr( $active_class ); ?>"
                            role="menuitemradio"
                            aria-checked="<?php echo $is_active ? 'true' : 'false'; ?>"
                            data-currency="<?php echo esc_attr( $code ); ?>"
                        >
                            <span class="fts-cs-item-symbol" aria-hidden="true"><?php echo esc_html( $symbol ); ?></span>
                            <span class="fts-cs-item-code fts-unique-currency-text"><?php echo esc_html( $code ); ?></span>
                        </button>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
        <?php
        return ob_get_clean();
    }

    private function get_available_currencies() {
        $currencies = array();

        // 1. Try official helper
        if ( class_exists( 'Wte_Currency_Converter_Helper_Functions' ) ) {
            $helper = \Wte_Currency_Converter_Helper_Functions::get_instance();
            $settings = $helper->get_currency_converter_list();
            
            if ( ! empty( $settings['code'] ) ) {
                $all_currencies_data = array();
                if ( class_exists( 'Wp_Travel_Engine_Functions' ) ) {
                     $obj = new \Wp_Travel_Engine_Functions();
                     $all_currencies_data = $obj->wp_travel_engine_currencies();
                }

                foreach ( $settings['code'] as $code ) {
                    $currencies[$code] = isset( $all_currencies_data[$code] ) ? $all_currencies_data[$code] : $code;
                }
            }
        }
        
        // 2. Comprehensive manual retrieval from settings
        if ( empty( $currencies ) ) {
            $wte_settings = get_option( 'wp_travel_engine_settings', array() );
            $all_currencies_data = array();
            if ( class_exists( 'Wp_Travel_Engine_Functions' ) ) {
                 $obj = new \Wp_Travel_Engine_Functions();
                 $all_currencies_data = $obj->wp_travel_engine_currencies();
            }

            // Path A: The flattened 'code' array
            if ( isset( $wte_settings['currency_converter']['code'] ) && is_array( $wte_settings['currency_converter']['code'] ) ) {
                 foreach( $wte_settings['currency_converter']['code'] as $code ) {
                     if( !empty($code) ) $currencies[$code] = isset( $all_currencies_data[$code] ) ? $all_currencies_data[$code] : $code;
                 }
            }
            
            // Path B: The 'currency_rate' object array
            if ( empty($currencies) && isset( $wte_settings['currency_converter']['currency_rate'] ) && is_array( $wte_settings['currency_converter']['currency_rate'] ) ) {
                foreach ( $wte_settings['currency_converter']['currency_rate'] as $item ) {
                    if ( isset($item['code']) ) {
                        $code = $item['code'];
                        $currencies[$code] = isset( $all_currencies_data[$code] ) ? $all_currencies_data[$code] : $code;
                    }
                }
            }
        }
        
        // 3. Define the exact requested order
        $essential = array(
            'USD' => 'United States Dollar',
            'EUR' => 'Euro',
            'GBP' => 'British Pound Sterling',
            'SAR' => 'Saudi Riyal',
            'EGP' => 'Egyptian Pound',
        );

        $ordered_currencies = array();
        
        // First, add our essential currencies in the correct order
        foreach ( $essential as $code => $name ) {
            $ordered_currencies[$code] = $name;
        }

        // Add any other existing site currencies that weren't in our essential list
        foreach ( $currencies as $code => $name ) {
            if ( strtoupper( (string) $code ) === 'AUD' ) continue;
            if ( ! isset( $ordered_currencies[$code] ) ) {
                $ordered_currencies[$code] = $name;
            }
        }

        // 4. Ensure the main site currency is present if not already added
        if ( function_exists('wp_travel_engine_get_currency_code') ) {
            $main_code = wp_travel_engine_get_currency_code();
            if ( strtoupper( (string) $main_code ) === 'AUD' ) {
                return $ordered_currencies;
            }
            if ( ! isset( $ordered_currencies[$main_code] ) ) {
                 // Prepend if it's the site default, but keep our order first if possible
                 $ordered_currencies = array_merge( array( $main_code => $main_code ), $ordered_currencies );
            }
        }

        return $ordered_currencies;
    }

    private function get_current_currency() {
        return fts_currency_switcher_resolve_code();
    }

    private function get_currency_symbol( $code ) {
        if ( function_exists( 'fts_v2_get_currency_symbol' ) ) {
            return fts_v2_get_currency_symbol( $code );
        }
        if ( function_exists( 'wp_travel_engine_get_currency_symbol' ) ) {
            return html_entity_decode(
                (string) wp_travel_engine_get_currency_symbol( $code ),
                ENT_QUOTES | ENT_HTML5,
                'UTF-8'
            );
        }
        return $code;
    }

}

new FTS_Currency_Switcher();

add_action( 'init', function() {
    if ( empty( $_GET['fts_test_currency'] ) ) return;
    if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
        status_header( 403 );
        exit;
    }

    $cases = array(
        array(
            'name' => 'cc_code has priority over wte_currency_code',
            'cookies' => array( 'cc_code' => 'EUR', 'wte_currency_code' => 'USD' ),
            'query' => array(),
            'expected' => 'EUR',
        ),
        array(
            'name' => 'wte_currency_code used when cc_code missing',
            'cookies' => array( 'wte_currency_code' => 'AUD' ),
            'query' => array(),
            'expected' => 'AUD',
        ),
        array(
            'name' => 'wte_cc query used when present',
            'cookies' => array( 'cc_code' => 'EGP' ),
            'query' => array( 'wte_cc' => 'USD' ),
            'expected' => 'USD',
        ),
        array(
            'name' => 'default fallback non-empty',
            'cookies' => array(),
            'query' => array(),
            'expected' => 'non_empty',
        ),
    );

    $results = array();
    foreach ( $cases as $c ) {
        $got = fts_currency_switcher_resolve_code( $c['cookies'], $c['query'] );
        $pass = $c['expected'] === 'non_empty' ? ( is_string( $got ) && trim( $got ) !== '' ) : ( $got === $c['expected'] );
        $results[] = array(
            'name' => $c['name'],
            'expected' => $c['expected'],
            'got' => $got,
            'pass' => $pass,
        );
    }

    wp_send_json(
        array(
            'ok' => ! in_array( false, array_map( fn( $r ) => $r['pass'], $results ), true ),
            'results' => $results,
        )
    );
}, 1 );
