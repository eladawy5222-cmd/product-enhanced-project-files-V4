/**
 * Alpha Color Picker JS
 *
 * This file includes several helper functions and the core control JS.
 */

/**
 * Override the stock color.js toString() method to add support for
 * outputting RGBa or Hex.
 */
Color.prototype.toString = function (flag) {

	// If our no-alpha flag has been passed in, output RGBa value with 100% opacity.
	// This is used to set the background color on the opacity slider during color changes.
	if ('no-alpha' == flag) {
		return this.toCSS('rgba', '1').replace(/\s+/g, '');
	}

	// If we have a proper opacity value, output RGBa.
	if (1 > this._alpha) {
		return this.toCSS('rgba', this._alpha).replace(/\s+/g, '');
	}

	// Proceed with stock color.js hex output.
	var hex = parseInt(this._color, 10).toString(16);
	if (this.error) { return ''; }
	if (hex.length < 6) {
		for (var i = 6 - hex.length - 1; i >= 0; i--) {
			hex = '0' + hex;
		}
	}

	return '#' + hex;
};

/**
 * Given an RGBa, RGB, or hex color value, return the alpha channel value.
 */
function travel_monster_get_alpha_value_from_color(value) {
	var alphaVal;

	// Remove all spaces from the passed in value to help our RGBa regex.
	value = value.toString().replace(/ /g, '');

	if (value.match(/rgba\(\d+\,\d+\,\d+\,([^\)]+)\)/)) {
		alphaVal = parseFloat(value.match(/rgba\(\d+\,\d+\,\d+\,([^\)]+)\)/)[1]).toFixed(2) * 100;
		alphaVal = parseInt(alphaVal);
	} else {
		alphaVal = 100;
	}

	return alphaVal;
}

/**
 * Force update the alpha value of the color picker object and maybe the alpha slider.
 */
function travel_monster_update_alpha_value_on_color_control(alpha, $control, $alphaSlider, update_slider) {
	var iris, colorPicker, color;

	iris = $control.data('a8cIris');
	colorPicker = $control.data('wpWpColorPicker');

	// Bail early if the color picker isn't initialized for this control.
	if (!iris || !iris._color || !colorPicker) {
		return;
	}

	// Set the alpha value on the Iris object.
	iris._color._alpha = alpha;

	// Store the new color value.
	color = iris._color.toString();

	// Set the value of the input.
	$control.val(color);

	// Update the background color of the color picker.
	colorPicker.toggler.css({
		'background-color': color
	});

	// Maybe update the alpha slider itself.
	if (update_slider) {
		travel_monster_update_alpha_value_on_alpha_slider(alpha, $alphaSlider);
	}

	// Update the color value of the color picker object.
	$control.wpColorPicker('color', color);
}

/**
 * Update the slider handle position and label.
 */
function travel_monster_update_alpha_value_on_alpha_slider(alpha, $alphaSlider) {
	$alphaSlider.slider('value', alpha);
	//$alphaSlider.find( '.ui-slider-handle' ).text( alpha.toString() );
}

/**
 * Initialization trigger.
 */
jQuery(document).ready(function ($) {

	// Loop over each control and transform it into our color picker.
	$('.travel-monster-color-alpha-control').each(function () {

		// Scope the vars.
		var $control, startingColor, paletteInput, showOpacity, defaultColor, palette,
			colorPickerOptions, $container, $alphaSlider, alphaVal, sliderOptions, savedValue;

		// Store the control instance.
		$control = $(this);

		// Get our saved value
		savedValue = wp.customize.value($control.attr('data-customize-setting-link'))();

		// Get a clean starting value for the option.
		startingColor = savedValue.toString().replace(/\s+/g, '');

		// Get some data off the control.
		paletteInput = $control.attr('data-palette');
		showOpacity = $control.attr('data-show-opacity');
		defaultColor = $control.attr('data-default-color');

		// Process the palette.
		if (paletteInput.indexOf('|') !== -1) {
			palette = paletteInput.split('|');
		} else if ('false' == paletteInput) {
			palette = false;
		} else {
			palette = true;
		}

		// Set up the options that we'll pass to wpColorPicker().
		colorPickerOptions = {
			change: function (event, ui) {
				var key, value, alpha, $transparency;

				key = $control.attr('data-customize-setting-link');
				value = $control.wpColorPicker('color');

				// Send ajax request to wp.customize to trigger the Save action.
				wp.customize(key, function (obj) {
					obj.set(value);
				});

				$transparency = $container.find('.transparency');

				// Always show the background color of the opacity slider at 100% opacity.
				$alphaSlider.closest('.travel-monster-color-alpha-picker-container').css('background-color', ui.color.toString('no-alpha'));
			},
			palettes: palette
		};

		// Create the colorpicker.
		$control.val(savedValue).wpColorPicker(colorPickerOptions);

		$container = $control.parents('.wp-picker-container:first');

		// Insert our opacity slider.
		$('<div class="travel-monster-color-alpha-picker-container iris-slider iris-strip">' +
			'<div class="alpha-slider iris-slider-offset"></div>' +
			'</div>').appendTo($container.find('.iris-picker-inner'));

		$alphaSlider = $container.find('.alpha-slider');

		// If starting value is in format RGBa, grab the alpha channel.
		alphaVal = travel_monster_get_alpha_value_from_color(startingColor);

		// Get the solid color
		solidColor = startingColor.toString().replace('0.' + alphaVal, '100');

		// Set up jQuery UI slider() options.
		sliderOptions = {
			create: function (event, ui) {
				var value = $(this).slider('value');

				// Set up initial values.
				//$( this ).find( '.ui-slider-handle' ).text( value );
				$(this).closest('.iris-slider').css('background-color', solidColor);
			},
			value: alphaVal,
			range: 'max',
			step: 1,
			min: 0,
			max: 100,
			animate: 300,
			orientation: "vertical"
		};

		// Initialize jQuery UI slider with our options.
		$alphaSlider.slider(sliderOptions);

		// Bind event handler for clicking on a palette color.
		$container.find('.iris-palette').on('click', function () {
			var color, alpha;

			color = $(this).css('background-color');
			alpha = travel_monster_get_alpha_value_from_color(color);

			travel_monster_update_alpha_value_on_alpha_slider(alpha, $alphaSlider);

			// Sometimes Iris doesn't set a perfect background-color on the palette,
			// for example rgba(20, 80, 100, 0.3) becomes rgba(20, 80, 100, 0.298039).
			// To compensante for this we round the opacity value on RGBa colors here
			// and save it a second time to the color picker object.
			if (alpha != 100) {
				color = color.toString().replace(/[^,]+(?=\))/, (alpha / 100).toFixed(2));
			}

			$control.wpColorPicker('color', color);
		});

		// Bind event handler for clicking on the 'Clear' button.
		$container.find('.button.wp-picker-clear').on('click', function () {
			var key = $control.attr('data-customize-setting-link');

			// The #fff color is delibrate here. This sets the color picker to white instead of the
			// defult black, which puts the color picker in a better place to visually represent empty.
			$control.wpColorPicker('color', '#ffffff');

			// Set the actual option value to empty string.
			wp.customize(key, function (obj) {
				obj.set('');
			});

			travel_monster_update_alpha_value_on_alpha_slider(100, $alphaSlider);
		});

		// Bind event handler for clicking on the 'Default' button.
		$container.find('.button.wp-picker-default').on('click', function () {
			var alpha = travel_monster_get_alpha_value_from_color(defaultColor);

			travel_monster_update_alpha_value_on_alpha_slider(alpha, $alphaSlider);
		});

		// Bind event handler for typing or pasting into the input.
		$control.on('input', function () {
			var value = $(this).val();

			if ('' === value) {
				var key = $control.attr('data-customize-setting-link');

				// The #fff color is delibrate here. This sets the color picker to white instead of the
				// defult black, which puts the color picker in a better place to visually represent empty.
				$control.wpColorPicker('color', '');

				// Set the actual option value to empty string.
				wp.customize(key, function (obj) {
					obj.set('');
				});

				travel_monster_update_alpha_value_on_alpha_slider(100, $alphaSlider);
			} else {
				var alpha = travel_monster_get_alpha_value_from_color(value);

				travel_monster_update_alpha_value_on_alpha_slider(alpha, $alphaSlider);
			}
		});

		// Update all the things when the slider is interacted with.
		$alphaSlider.slider().on('slide', function (event, ui) {
			var alpha = parseFloat(ui.value) / 100.0;

			travel_monster_update_alpha_value_on_color_control(alpha, $control, $alphaSlider, false);
		});

	});

	/**
	 * Update Alpha Color picker on the basis of selected style presets in the customizer.
	 * @param {string} preset ID of the control whose value needs to be changed
	 * @param {boolean} button Whether to change button value
	 * @param {boolean} revert Whether to reset to default value
	 */
	function travel_monster_update_color_preset_style(preset, button = false, revert = false) {

		let color = '';
		if (revert) {
			color = travel_monster_color_presets['default'][preset];
		} else {
			let checkedInput = document.querySelector('input[name="_customize-radio-color_preset_style"]:checked');
			let style = 'preset_' + checkedInput.value;
			color = travel_monster_color_presets[style][preset];
		}

		let alpha = travel_monster_get_alpha_value_from_color(color);
		// Sometimes Iris doesn't set a perfect background-color on the palette,
		// for example rgba(20, 80, 100, 0.3) becomes rgba(20, 80, 100, 0.298039).
		// To compensante for this we round the opacity value on RGBa colors here
		// and save it a second time to the color picker object.
		if (alpha != 100) {
			color = color.toString().replace(/[^,]+(?=\))/, (alpha / 100).toFixed(2));
		}

		if (button) {
			let btnColor = 'primary_color' == preset ? 'initial' : 'hover';
			let colorControl = [
				'#customize-control-' + preset + ' .travel-monster-color-alpha-control',
				'#customize-control-btn_bg_color_' + btnColor + ' .travel-monster-color-alpha-control',
				'#customize-control-btn_border_color_' + btnColor + ' .travel-monster-color-alpha-control',
			];

			if (travel_monster_color_presets.companion) {

				if (preset == 'secondary_color') {
					if (travel_monster_color_presets.extensions.includes('notification-bar')) {
						colorControl.push(
							'#customize-control-notification_bg_color .travel-monster-color-alpha-control',
						);
					}
				}
			}

			colorControl.forEach(function (selector) {
				let item = $(selector);
				let $container = item.parents('.wp-picker-container:first');
				let $alphaSlider = $container.find('.alpha-slider');
				item.wpColorPicker('color', color);
				travel_monster_update_alpha_value_on_color_control(alpha, item, $alphaSlider, true)
			});
		} else {
			let colorControl = $('#customize-control-' + preset + ' .travel-monster-color-alpha-control');
			$container = colorControl.parents('.wp-picker-container:first');
			$alphaSlider = $container.find('.alpha-slider');
			colorControl.wpColorPicker('color', color);
			travel_monster_update_alpha_value_on_color_control(alpha, colorControl, $alphaSlider, true)
		}
	}

	// Update the color picker when a new preset is selected.
	$('body').on('click', '#input_color_preset_style', function (event) {
		travel_monster_update_color_preset_style('primary_color', true);
		travel_monster_update_color_preset_style('secondary_color', true);
		travel_monster_update_color_preset_style('body_font_color');
		travel_monster_update_color_preset_style('section_bg_color');
		travel_monster_update_color_preset_style('site_bg_color');
		travel_monster_update_color_preset_style('heading_color');
		travel_monster_update_color_preset_style('accent_color_one');
		travel_monster_update_color_preset_style('accent_color_two');
	});

	$('body').on('click', '.color-revert-change', function (event) {
		travel_monster_update_color_preset_style('primary_color', true, true);
		travel_monster_update_color_preset_style('secondary_color', true, true);
		travel_monster_update_color_preset_style('body_font_color', false, true);
		travel_monster_update_color_preset_style('section_bg_color', false, true);
		travel_monster_update_color_preset_style('site_bg_color', false, true);
		travel_monster_update_color_preset_style('heading_color', false, true);
		travel_monster_update_color_preset_style('accent_color_one', false, true);
		travel_monster_update_color_preset_style('accent_color_two', false, true);
	});
});

// Move the opacity bar next to the hue bar
jQuery(document).ready(function ($) {
	var container_width = $('.customize-control-travel-monster-color-alpha .iris-picker').width();
	var square_width = $('.customize-control-travel-monster-color-alpha .iris-square').width();
	var available_space = container_width - square_width;
	var strip_width = (available_space / 2) - 20;
	var strip_height = $('.customize-control-travel-monster-color-alpha .iris-strip').height();
	$('.customize-control-travel-monster-color-alpha .iris-strip, .travel-monster-color-alpha-picker-container').css('width', strip_width + 'px');
	$('.travel-monster-color-alpha-picker-container').css('height', strip_height + 'px');

});