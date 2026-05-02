<?php
// No direct access, please
if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! class_exists( 'Travel_Monster_Alpha_Color_Customize_Control' ) ) :
class Travel_Monster_Alpha_Color_Customize_Control extends WP_Customize_Control {
	/**
	 * Official control name.
	 */
	public $type = 'travel-monster-color-alpha';
	/**
	 * Add support for palettes to be passed in.
	 *
	 * Supported palette values are true, false, or an array of RGBa and Hex colors.
	 */
	public $palette;
	/**
	 * Add support for showing the opacity value on the slider handle.
	 */
	public $show_opacity;
	/**
	 * Enqueue scripts and styles.
	 *
	 * Ideally these would get registered and given proper paths before this control object
	 * gets initialized, then we could simply enqueue them here, but for completeness as a
	 * stand alone class we'll register and enqueue them here.
	 */

	public $group;
	public $collapsed = true;
	
	public function enqueue() {
		wp_enqueue_script(
			'travel-monster-color-alpha-picker',
			trailingslashit( get_template_directory_uri() ) . 'inc/custom-controls/coloralpha/color-alpha-picker.js',
			array( 'jquery', 'wp-color-picker' ),
			TRAVEL_MONSTER_THEME_VERSION,
			true
		);
		wp_enqueue_style(
			'travel-monster-color-alpha-picker',
			trailingslashit( get_template_directory_uri() ) . 'inc/custom-controls/coloralpha/color-alpha-picker.css',
			array( 'wp-color-picker' ),
			TRAVEL_MONSTER_THEME_VERSION
		);
		wp_localize_script(
			'travel-monster-color-alpha-picker',
			'travel_monster_color_presets',
			array(
				'preset_one'   => travel_monster_get_default_color_preset( 'one' ),
				'preset_two'   => travel_monster_get_default_color_preset( 'two' ),
				'preset_three' => travel_monster_get_default_color_preset( 'three' ),
				'preset_four'  => travel_monster_get_default_color_preset( 'four' ),
				'default'      => travel_monster_get_default_color_preset( 'default' ),
				'companion'    => travel_monster_pro_is_activated(),
				'extensions'   => get_option( 'tmp_active_extensions', array() ),
			)
		);
	}

	public function to_json() {
		parent::to_json();
		$this->json['palette']      = $this->palette;
		$this->json['defaultValue'] = $this->setting->default;
		$this->json['link']         = $this->get_link();
		$this->json['show_opacity'] = $this->show_opacity;
		$this->json['group']        = $this->group;
		$this->json['collapsed']    = $this->collapsed;

		if ( is_array( $this->json['palette'] ) ) {
			$this->json['palette'] = implode( ',', $this->json['palette'] );
		} else {
			// Default to true.
			$this->json['palette'] = ( false === $this->json['palette'] || 'false' === $this->json['palette'] ) ? 'false' : 'true';
		}

		// Support passing show_opacity as string or boolean. Default to true.
		$this->json[ 'show_opacity' ] = ( false === $this->json[ 'show_opacity' ] || 'false' === $this->json[ 'show_opacity' ] ) ? 'false' : 'true';
	}

	/**
	 * Render the control.
	 */
	public function render_content() {}

	public function content_template() {
		?>
		<div class="tmp-alpha-color <# if ( ! data.collapsed ) { #>is-active<# } #><# if ( data.group ) { #>_{{ data.group }}<# } #>">
			<# if ( data.label && '' !== data.label ) { #>
				<span class="customize-control-title">{{ data.label }}</span>
			<# } #>
			<input class="travel-monster-color-alpha-control" type="text" data-palette="{{{ data.palette }}}" data-default-color="{{ data.defaultValue }}" {{{ data.link }}} />
		</div>
		<?php
	}
}
endif;