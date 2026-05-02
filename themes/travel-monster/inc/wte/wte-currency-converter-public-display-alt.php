<?php
/**
 * Provide a public-facing view for the plugin
 *
 * This file is used to markup the public-facing aspects of the plugin.
 *
 * @link       https://wptravelengine.com
 * @since      1.0.0
 *
 * @package    Wte_Currency_Converter
 * @subpackage Wte_Currency_Converter/public/partials
 */
?>
<div class="wte-currency-switcher-drpdown" id="wte-cc-currency-list-container">
    <select class="wte-cc-currency-list-display lp-bf-altd tmp-theme">
    <?php 
    $default_code = wp_travel_engine_get_currency_code();
    $defaults           = travel_monster_get_general_defaults();
    $ed_currency_code   = get_theme_mod( 'ed_currency_code', $defaults['ed_currency_code'] );
    $ed_currency_symbol = get_theme_mod( 'ed_currency_symbol', $defaults['ed_currency_symbol'] );
    $ed_currency_name   = get_theme_mod( 'ed_currency_name', $defaults['ed_currency_name'] );
    
    foreach( $currencies['code'] as $index => $code ) : 
        $symbol   = wp_travel_engine_get_currency_symbol( $code );
        $obj      = new Wp_Travel_Engine_Functions();
        $currency = $obj->wp_travel_engine_currencies();
        $cur_name = isset( $currency[$code] ) ? $currency[$code] : $code;
        $is_base_currency = ( isset( $code_in_db ) && $code_in_db === $code );
        $default_label = $is_base_currency ? __( ' (Default)', 'travel-monster' ) : '';
        
        // Build text components based on theme customizer settings
        $text_parts = array();
        
        if( $ed_currency_symbol ) {
            $text_parts[] = $symbol;
        }
        
        if( $ed_currency_code ) {
            $text_parts[] = $code;
        }
        
        if( $ed_currency_name ) {
            $text_parts[] = $cur_name;
        }
        
        // Build display text (symbol + code only, no Default label) for data attributes
        $display_text = $symbol . ' ' . $code;
        
        // Build full text (includes currency name and Default label) for data attributes
        $full_text = $symbol . ' ' . $code . '  ' . $cur_name . $default_label;
        
        // Build option text based on enabled theme mods
        $option_text = ! empty( $text_parts ) ? implode( ' ', $text_parts ) : $display_text;
        ?>
        <option data-display="<?php echo esc_attr( $display_text ); ?>" data-full-text="<?php echo esc_attr( $full_text ); ?>" value="<?php echo esc_attr( $code ); ?>"
            <?php echo esc_attr( $default_code === $code ? 'selected' : '' ); ?> >
                <?php echo esc_html( $option_text ); ?>
        </option>
    <?php endforeach; ?>
    </select>
</div>