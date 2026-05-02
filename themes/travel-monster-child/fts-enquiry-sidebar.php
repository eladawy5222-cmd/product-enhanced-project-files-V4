<?php
/**
 * FTS Enquiry in Sidebar Feature
 * 
 * Adds a per-trip option to display the Enquiry Contact Form at the top of the sidebar.
 */

// 1. ADD META BOX TO TRIP POST TYPE
add_action('add_meta_boxes', function() {
    add_meta_box(
        'fts_enquiry_sidebar_meta_box',
        __('Enquiry Display Options', 'travel-monster-child'),
        'fts_render_enquiry_sidebar_meta_box',
        'trip',
        'side', // Place in the side column for better accessibility
        'high'
    );
});

function fts_render_enquiry_sidebar_meta_box($post) {
    $enabled = get_post_meta($post->ID, '_fts_enable_enquiry_sidebar', true);
    wp_nonce_field('fts_save_enquiry_sidebar_meta', 'fts_enquiry_sidebar_nonce');
    ?>
    <p>
        <label>
            <input type="checkbox" name="fts_enable_enquiry_sidebar" value="on" <?php checked($enabled, 'on'); ?>>
            <?php _e('Show Enquiry Form in Sidebar', 'travel-monster-child'); ?>
        </label>
    </p>
    <p class="description">
        <?php _e('If enabled, the Enquiry Contact Form will appear at the top of the sticky sidebar on this trip page.', 'travel-monster-child'); ?>
    </p>
    <?php
}

// 2. SAVE META BOX DATA
add_action('save_post', function($post_id) {
    if (!isset($_POST['fts_enquiry_sidebar_nonce']) || !wp_verify_nonce($_POST['fts_enquiry_sidebar_nonce'], 'fts_save_enquiry_sidebar_meta')) {
        return;
    }
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (!current_user_can('edit_post', $post_id)) return;

    if (isset($_POST['fts_enable_enquiry_sidebar'])) {
        update_post_meta($post_id, '_fts_enable_enquiry_sidebar', 'on');
    } else {
        delete_post_meta($post_id, '_fts_enable_enquiry_sidebar');
    }
});

// 3. INJECT FORM INTO SIDEBAR (Defensive Layout Fix)
add_action('wp_travel_engine_trip_secondary_wrap', function() {
    if (!is_singular('trip')) return;

    $enabled = get_post_meta(get_the_ID(), '_fts_enable_enquiry_sidebar', true);
    if ($enabled !== 'on') return;

    ?>
    <div class="fts-sidebar-enquiry-container widget">
        <h2 class="widget-title">
            <?php _e('Check Availability', 'travel-monster-child'); ?>
        </h2>
        <div class="fts-sidebar-enquiry-form">
            <?php 
                echo do_shortcode('[WP_TRAVEL_ENGINE_TRIP_ENQUIRY_FORM use_current="yes"]');
            ?>
        </div>
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            var $sidebarContainer = $('.fts-sidebar-enquiry-container');
            var $sidebarForm = $sidebarContainer.find('form');
            
            // Give it a unique identity
            $sidebarForm.addClass('fts-sidebar-form-instance');

            // Handle Country dropdown label shortening
            $sidebarForm.find('select[name="enquiry_country"]').each(function() {
                $(this).find('option:first-child').text('Country *');
            });

            // Update Submit Button Text
            $sidebarForm.find('.enquiry-submit').val('<?php _e("SEND YOUR INQUIRY", "travel-monster-child"); ?>');

            // Handle submission manually to ensure it works even with ID conflicts
            $sidebarForm.on('submit', function(e) {
                // If the plugin's JS is already handling it, it might have preventDefault() called.
                // We'll check if we need to take over.
                
                var $form = $(this);
                var $submitBtn = $form.find('.enquiry-submit');
                var $msgContainer = $form.find('.confirm-msg');
                var $successMsg = $msgContainer.find('.success-msg');
                var $failedMsg = $msgContainer.find('.failed-msg');

                // Basic validation check
                var isValid = true;
                $form.find('input[required], textarea[required], select[required]').each(function() {
                    if (!$(this).val()) {
                        isValid = false;
                        $(this).css('border-color', 'red');
                    } else {
                        $(this).css('border-color', '');
                    }
                });

                if (!isValid) return;

                e.preventDefault();
                
                $submitBtn.prop('disabled', true).val('<?php _e("Sending...", "travel-monster-child"); ?>');
                
                var formData = $form.serialize();
                
                $.ajax({
                    type: 'POST',
                    url: '<?php echo admin_url("admin-ajax.php"); ?>',
                    data: formData,
                    success: function(response) {
                        if (response.success) {
                            $successMsg.text(response.data.message || '<?php _e("Thank you! Your enquiry has been sent.", "travel-monster-child"); ?>').show();
                            $failedMsg.hide();
                            $form[0].reset();
                            
                            /* Optional: redirect disabled to keep user on the trip page
                            if (response.data.redirect) {
                                setTimeout(function() {
                                    window.location.href = response.data.redirect;
                                }, 2000);
                            }
                            */
                        } else {
                            $failedMsg.text(response.data.message || '<?php _e("Submission failed. Please try again.", "travel-monster-child"); ?>').show();
                            $successMsg.hide();
                        }
                    },
                    error: function() {
                        $failedMsg.text('<?php _e("An error occurred. Please try again.", "travel-monster-child"); ?>').show();
                        $successMsg.hide();
                    },
                    complete: function() {
                        $submitBtn.prop('disabled', false).val('<?php _e("SEND YOUR INQUIRY", "travel-monster-child"); ?>');
                    }
                });
            });
        });
        </script>
    </div>
    <style>
        /* Force container to stay within sidebar bounds */
        .fts-sidebar-enquiry-container.widget {
            margin-bottom: 30px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            display: block !important;
            clear: both !important;
            overflow: hidden !important; /* Prevent any child from pushing width */
        }
        .fts-sidebar-enquiry-container .wte_enquiry_contact_form-wrap { 
            padding: 0 !important; 
            border: none !important; 
            box-shadow: none !important; 
            background: transparent !important; 
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-sizing: border-box !important;
        }

        .fts-sidebar-enquiry-container .enquiry-form-title { display: none !important; }
        
        .fts-sidebar-enquiry-container .row-form label { 
            display: block; 
            margin-bottom: 6px; 
            font-weight: 500; 
            font-size: 13px !important; 
        }

        /* Consistent input styling for sidebar */
        .fts-sidebar-enquiry-container input[type="text"], 
        .fts-sidebar-enquiry-container input[type="email"], 
        .fts-sidebar-enquiry-container input[type="tel"], 
        .fts-sidebar-enquiry-container input[type="number"], 
        .fts-sidebar-enquiry-container select,
        .fts-sidebar-enquiry-container textarea { 
            border: 1px solid rgba(0,0,0,0.1); 
            padding: 10px 12px !important; 
            border-radius: 4px; 
            background: #fdfdfd; 
            box-sizing: border-box !important;
            font-size: 13px !important;
            height: auto !important;
        }
        .fts-sidebar-enquiry-container .enquiry-submit { 
            width: 100% !important; 
            max-width: 100% !important;
            background: var(--tmp-primary-color, #ff5722); 
            color: #fff; 
            padding: 12px; 
            border: none; 
            border-radius: 4px; 
            font-weight: 600; 
            cursor: pointer; 
            transition: all 0.3s ease; 
            text-transform: uppercase;
            box-sizing: border-box !important;
        }
        .fts-sidebar-enquiry-container .enquiry-submit:hover { 
            background: var(--tmp-primary-color-hover, #e64a19); 
            opacity: 0.9;
        }

        /* Hide Select Trip field in Sidebar Enquiry */
        .fts-sidebar-enquiry-container .row-repeater.package-name-holder,
        .fts-sidebar-enquiry-container .row-form:has([name="package_id"]),
        .fts-sidebar-enquiry-container [name="package_id"] {
            display: none !important;
        }

        /* Hide Specific Sidebar Widgets on Single Trip Pages */
        #secondary #block-2,
        #secondary #block-3,
        #secondary #block-4,
        #secondary #block-7,
        #secondary #travel_booking_toolkit_taxonomy_list-1,
        #secondary #travel_booking_toolkit_taxonomy_list-2,
        #secondary #wte_featured_trips_widget-1,
        #secondary #travel_booking_toolkit_recent_post-1,
        #secondary #block-5,
        #secondary #block-6 {
            display: none !important;
        }
		.fts-sidebar-enquiry-container .wte_enquiry_contact_form {
         padding: 0;
         background: transparent;
          }
		.fts-sidebar-enquiry-container .enquiry-submit {
			background:#1c74e9 !important;
		}

        /* Desktop Only Logic */
        @media screen and (max-width: 1024px) {
            .fts-sidebar-enquiry-container.widget { 
                display: none !important; 
            }
        }
    </style>
    <?php
}, 6); // Priority 6 (WP Travel Engine opens wrap at priority 5)
