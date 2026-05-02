<?php
/**
 * FTS Currency Switcher - Standalone Implementation
 * 
 * Defines a custom currency switcher that works with WP Travel Engine.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
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
        wp_enqueue_style( 'fts-currency-style', get_stylesheet_directory_uri() . '/fts-currency-switcher/assets/css/style.css', array(), time() );
        wp_enqueue_script( 'fts-currency-script', get_stylesheet_directory_uri() . '/fts-currency-switcher/assets/js/script.js', array( 'jquery' ), time(), true );
        
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

        ob_start();
        ?>
        <div class="fts-currency-switcher">
            <div class="fts-cs-current">
                <span class="fts-cs-flag"><?php echo esc_html( $this->get_currency_symbol( $current_currency ) ); ?></span>
                <span class="fts-cs-code"><?php echo esc_html( $current_currency ); ?></span>
                <i class="fas fa-chevron-down fts-cs-arrow"></i>
            </div>
            <ul class="fts-cs-dropdown">
                <?php foreach ( $currencies as $code => $name ) : 
                    $active_class = ( $code === $current_currency ) ? 'active' : '';
                    $symbol = $this->get_currency_symbol( $code );
                ?>
                    <li class="fts-cs-item <?php echo esc_attr( $active_class ); ?>" data-currency="<?php echo esc_attr( $code ); ?>">
                        <span class="fts-cs-item-symbol"><?php echo esc_html( $symbol ); ?></span>
                        <span class="fts-cs-item-code fts-unique-currency-text"><?php echo esc_html( $code ); ?></span>
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
            'EUR' => 'Euro',
            'USD' => 'United States Dollar',
            'AUD' => 'Australian Dollar',
            'EGP' => 'Egyptian Pound'
        );

        $ordered_currencies = array();
        
        // First, add our essential currencies in the correct order
        foreach ( $essential as $code => $name ) {
            $ordered_currencies[$code] = $name;
        }

        // Add any other existing site currencies that weren't in our essential list
        foreach ( $currencies as $code => $name ) {
            if ( ! isset( $ordered_currencies[$code] ) ) {
                $ordered_currencies[$code] = $name;
            }
        }

        // 4. Ensure the main site currency is present if not already added
        if ( function_exists('wp_travel_engine_get_currency_code') ) {
            $main_code = wp_travel_engine_get_currency_code();
            if ( ! isset( $ordered_currencies[$main_code] ) ) {
                 // Prepend if it's the site default, but keep our order first if possible
                 $ordered_currencies = array_merge( array( $main_code => $main_code ), $ordered_currencies );
            }
        }

        return $ordered_currencies;
    }

    private function get_current_currency() {
        if ( isset( $_COOKIE['wte_currency_code'] ) && ! empty( $_COOKIE['wte_currency_code'] ) ) {
            return sanitize_text_field( $_COOKIE['wte_currency_code'] );
        }
        
        // Fallback to WTE default currency
        if ( function_exists( 'wp_travel_engine_get_currency_code' ) ) {
            return wp_travel_engine_get_currency_code();
        }
        
        return 'USD';
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
