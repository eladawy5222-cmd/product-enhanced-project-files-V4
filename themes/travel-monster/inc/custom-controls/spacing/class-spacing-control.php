<?php
// No direct access, please
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'Travel_Monster_Spacing_Control' ) ) :
class Travel_Monster_Spacing_Control extends WP_Customize_Control {

	public $type = 'travel-monster-spacing';

	public $l10n = array();

	public $element = '';

	public function __construct( $manager, $id, $args = array() ) {
		// Let the parent class do its thing.
		parent::__construct( $manager, $id, $args );
	}

	public function enqueue() {
		wp_enqueue_script( 'travel-monster-spacing-customizer', trailingslashit( get_template_directory_uri() )  . 'inc/custom-controls/spacing/spacing-customizer.js', array( 'customize-controls' ), TRAVEL_MONSTER_THEME_VERSION, true );
		wp_enqueue_style( 'travel-monster-spacing-customizer-controls-css', trailingslashit( get_template_directory_uri()  ) . 'inc/custom-controls/spacing/spacing-customizer.css', array(), TRAVEL_MONSTER_THEME_VERSION );
	}

	public function to_json() {
		parent::to_json();
		// Loop through each of the settings and set up the data for it.
		foreach ( $this->settings as $setting_key => $setting_id ) {
			$this->json[ $setting_key ] = array(
				'link'  => $this->get_link( $setting_key ),
				'value' => $this->value( $setting_key )
			);
		}

		$this->json[ 'element' ] = $this->element;
		$this->json[ 'title' ] = __( 'Link values', 'travel-monster' );
		$this->json[ 'unlink_title' ] = __( 'Un-link values', 'travel-monster' );

		$this->json['label_top'] = esc_html__( 'Top', 'travel-monster' );
		$this->json['label_right'] = esc_html__( 'Right', 'travel-monster' );
		$this->json['label_bottom'] = esc_html__( 'Bottom', 'travel-monster' );
		$this->json['label_left'] = esc_html__( 'Left', 'travel-monster' );
		$this->json['desktop_label'] = esc_html__( 'Desktop', 'travel-monster' );
		$this->json['tablet_label'] = esc_html__( 'Tablet', 'travel-monster' );
		$this->json['mobile_label'] = esc_html__( 'Mobile', 'travel-monster' );
	}

	public function content_template() {
		?>
		<div class="travel-monster-spacing-control-section">
			<div class="travel-monster-spacing-control-section-title-area">
				<# if ( data.label || data.description ) { #>
					<div class="travel-monster-spacing-control-title-info">
						<# if ( data.label ) { #>
							<label for="{{{ data.element }}}-{{{ data.top_label }}}">
								<span class="customize-control-title">{{ data.label }}</span>
							</label>
						<# } #>

						<# if ( data.description ) { #>
							<span class="description customize-control-description">{{{ data.description }}}</span>
						<# } #>
					</div>
				<# } #>

				<div class="travel-monster-range-slider-controls">
					<span class="travel-monster-device-controls">
						<# if ( 'undefined' !== typeof ( data.desktop_top ) ) { #>
							<span class="travel-monster-device-desktop dashicons dashicons-desktop" data-option="desktop" title="{{ data.desktop_label }}"></span>
						<# } #>

						<# if ( 'undefined' !== typeof (data.tablet_top) ) { #>
							<span class="travel-monster-device-tablet dashicons dashicons-tablet" data-option="tablet" title="{{ data.tablet_label }}"></span>
						<# } #>

						<# if ( 'undefined' !== typeof (data.mobile_top) ) { #>
							<span class="travel-monster-device-mobile dashicons dashicons-smartphone" data-option="mobile" title="{{ data.mobile_label }}"></span>
						<# } #>
					</span>
				</div>
			</div>

			<div class="spacing-values-container">
				<div class="spacing-values-desktop spacing-values-area" data-option="desktop" style="display: none;">
					<div class="travel-monster-spacing-section">
						<input id="{{{ data.element }}}-{{{ data.label_top }}}" min="0" class="travel-monster-number-control spacing-top" type="number" style="text-align: center;" {{{ data.desktop_top.link }}} value="{{{ data.desktop_top.value }}}" />
						<# if ( data.label_top ) { #>
							<label for="{{{ data.element }}}-{{{ data.label_top }}}" class="description" style="font-style:normal;">{{ data.label_top }}</label>
						<# } #>
					</div>

					<div class="travel-monster-spacing-section">
						<input id="{{{ data.element }}}-{{{ data.label_right }}}" min="0" class="travel-monster-number-control spacing-right" type="number" style="text-align: center;" {{{ data.desktop_right.link }}} value="{{{ data.desktop_right.value }}}" />
						<# if ( data.label_right ) { #>
							<label for="{{{ data.element }}}-{{{ data.label_right }}}" class="description" style="font-style:normal;">{{ data.label_right }}</label>
						<# } #>
					</div>

					<div class="travel-monster-spacing-section">
						<input id="{{{ data.element }}}-{{{ data.label_bottom }}}" min="0" class="travel-monster-number-control spacing-bottom" type="number" style="text-align: center;" {{{ data.desktop_bottom.link }}} value="{{{ data.desktop_bottom.value }}}" />
						<# if ( data.label_bottom ) { #>
							<label for="{{{ data.element }}}-{{{ data.label_bottom }}}" class="description" style="font-style:normal;">{{ data.label_bottom }}</label>
						<# } #>
					</div>

					<div class="travel-monster-spacing-section">
						<input id="{{{ data.element }}}-{{{ data.label_left }}}" min="0" class="travel-monster-number-control spacing-left" type="number" style="text-align: center;" {{{ data.desktop_left.link }}} value="{{{ data.desktop_left.value }}}" />
						<# if ( data.label_left ) { #>
							<label for="{{{ data.element }}}-{{{ data.label_left }}}" class="description" style="font-style:normal;">{{ data.label_left }}</label>
						<# } #>
					</div>

					<# if ( data.element ) { #>
						<div class="travel-monster-spacing-section travel-monster-link-spacing-section">
							<span class="dashicons dashicons-editor-unlink travel-monster-link-spacing" data-element="{{ data.element }}" title="{{ data.title }}"></span>
							<span class="dashicons dashicons-admin-links travel-monster-unlink-spacing" style="display:none" data-element="{{ data.element }}" title="{{ data.unlink_title }}"></span>
						</div>
					<# } #>
				</div>

				<# if ( 'undefined' !== typeof ( data.mobile_top ) ) { #>
					<div class="spacing-values-mobile spacing-values-area" data-option="mobile" style="display: none;">
						<div class="travel-monster-spacing-section">
							<input id="{{{ data.element }}}-mobile-{{{ data.label_top }}}" min="0" class="travel-monster-number-control mobile-spacing-top" type="number" style="text-align: center;" {{{ data.mobile_top.link }}} value="{{{ data.mobile_top.value }}}" />
							<# if ( data.label_top ) { #>
								<label for="{{{ data.element }}}-mobile-{{{ data.label_top }}}" class="description" style="font-style:normal;">{{ data.label_top }}</label>
							<# } #>
						</div>

						<div class="travel-monster-spacing-section">
							<input id="{{{ data.element }}}-mobile-{{{ data.label_right }}}" min="0" class="travel-monster-number-control mobile-spacing-right" type="number" style="text-align: center;" {{{ data.mobile_right.link }}} value="{{{ data.mobile_right.value }}}" />
							<# if ( data.label_right ) { #>
								<label for="{{{ data.element }}}-mobile-{{{ data.label_right }}}" class="description" style="font-style:normal;">{{ data.label_right }}</label>
							<# } #>
						</div>

						<div class="travel-monster-spacing-section">
							<input id="{{{ data.element }}}-mobile-{{{ data.label_bottom }}}" min="0" class="travel-monster-number-control mobile-spacing-bottom" type="number" style="text-align: center;" {{{ data.mobile_bottom.link }}} value="{{{ data.mobile_bottom.value }}}" />
							<# if ( data.label_bottom ) { #>
								<label for="{{{ data.element }}}-mobile-{{{ data.label_bottom }}}" class="description" style="font-style:normal;">{{ data.label_bottom }}</label>
							<# } #>
						</div>

						<div class="travel-monster-spacing-section">
							<input id="{{{ data.element }}}-mobile-{{{ data.label_left }}}" min="0" class="travel-monster-number-control mobile-spacing-left" type="number" style="text-align: center;" {{{ data.mobile_left.link }}} value="{{{ data.mobile_left.value }}}" />
							<# if ( data.label_left ) { #>
								<label for="{{{ data.element }}}-mobile-{{{ data.label_left }}}" class="description" style="font-style:normal;">{{ data.label_left }}</label>
							<# } #>
						</div>

						<# if ( data.element ) { #>
							<div class="travel-monster-spacing-section travel-monster-link-spacing-section">
								<span class="dashicons dashicons-editor-unlink travel-monster-link-spacing" data-element="{{ data.element }}" title="{{ data.title }}"></span>
								<span class="dashicons dashicons-admin-links travel-monster-unlink-spacing" style="display:none" data-element="{{ data.element }}" title="{{ data.unlink_title }}"></span>
							</div>
						<# } #>
					</div>
				<# } #>
			</div>
		</div>
		<?php
	}
}
endif;
