<?php 
/**
 * New React Dashboard page
 * 
 * @package Travel Monster
 */

/**
 * Init Admin Menu.
 *
 * @return void
 */
function travel_monster_dashboard_menu() { 
    add_theme_page(
		TRAVEL_MONSTER_THEME_NAME,
		TRAVEL_MONSTER_THEME_NAME,
		'manage_options',
		'travel-monster-dashboard',
		'travel_monster_dashboard_page'
	);
}
add_action( 'admin_menu', 'travel_monster_dashboard_menu' );

/**
 * Callback function for React Dashboard Admin Page.
 * 
 * @return void
 */
function travel_monster_dashboard_page() { ?>
    <div id="cw-dashboard" class="cw-dashboard"></div>
    <?php
}

/**
 * Enqueue scripts and styles for admin scripts.
 * 
 * @return void
 */
function travel_monster_dashboard_scripts() {

    $admin_page = isset($_GET['page']) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : null;

    if( $admin_page === 'travel-monster-dashboard' && current_user_can( 'manage_options' ) ){
        $dependencies_file_path = get_template_directory() . '/build/dashboard.asset.php';
        if ( file_exists( $dependencies_file_path ) ) {
            $dashboard_assets  = require $dependencies_file_path;
            $js_dependencies   = ( ! empty( $dashboard_assets['dependencies'] ) ) ? $dashboard_assets['dependencies'] : [];
            $version           = ( ! empty( $dashboard_assets['version'] ) ) ? $dashboard_assets['version'] : '2.0.0';
            $js_dependencies[] = 'updates';

            wp_enqueue_script(
                'travel-monster-react-dashboard',
                get_template_directory_uri() . '/build/dashboard.js',
                $js_dependencies,
                $version,
                true
            );

            // Add Translation support for Dashboard 
            wp_set_script_translations( 'travel-monster-react-dashboard', 'travel-monster' );
            
            $arrayargs = [
                'ajax_url'           => esc_url( admin_url( 'admin-ajax.php' ) ),
                'admin_url'          => esc_url( admin_url( ) ),
                'blog_name'          => TRAVEL_MONSTER_THEME_NAME,
                'theme_version'      => TRAVEL_MONSTER_THEME_VERSION,
                'nonce'              => wp_create_nonce( 'travel_monster_dashboard_nonce' ),
                'inactivePlugins'    => travel_monster_get_inactive_plugins(),
                'activePlugins'      => travel_monster_get_active_plugins(),
                'review'             => esc_url('https://wordpress.org/support/theme/travel-monster/reviews/'),
                'documentation'       => esc_url('https://docs.wptravelengine.com/docs-category/travel-monster/?utm_source=travel_monster&utm_medium=dashboard&utm_campaign=docs'),
                'support'            => esc_url('https://wptravelengine.com/support-ticket/?utm_source=travel_monster&utm_medium=dashboard&utm_campaign=support'),
                'videotutorial'      => esc_url('https://www.youtube.com/@wptravelengine'),
                'get_pro'            => esc_url('https://wptravelengine.com/wordpress-travel-themes/travel-monster-pro/?utm_source=travel_monster&utm_medium=dashboard&utm_campaign=upgrade_theme'),
                'website'            => esc_url('https://wptravelengine.com/?utm_source=travel_monster&utm_medium=dashboard&utm_campaign=upgrade_to_pro'),
                'customizer_url'     => esc_url( admin_url( 'customize.php' ) ),
                'custom_logo'        => esc_url( admin_url( 'customize.php?autofocus[control]=custom_logo' ) ),
                'colors'             => esc_url( admin_url( 'customize.php?autofocus[section]=colors' ) ),
                'layout'             => esc_url( admin_url( 'customize.php?autofocus[panel]=layout_settings' ) ),
                'blog'               => esc_url( admin_url( 'customize.php?autofocus[section]=blog_layout' ) ),
                'general'            => esc_url( admin_url( 'customize.php?autofocus[panel]=general_panel' ) ),
                'footer'             => esc_url( admin_url( 'customize.php?autofocus[section]=footer_settings' ) ),
            ];

            wp_localize_script( 'travel-monster-react-dashboard','cw_dashboard',$arrayargs );
        }
        wp_enqueue_style( 'travel-monster-react-dashboard', get_template_directory_uri() . '/build/dashboard.css' );
    }
}
add_action( 'admin_enqueue_scripts', 'travel_monster_dashboard_scripts' );

/**
 * Get the inactive plugins.
 *
 * @return array
 */
function travel_monster_get_inactive_plugins() {
    if (!current_user_can('install_plugins') && !current_user_can('activate_plugins')) {
        return new \WP_Error( 'rest_forbidden', esc_html__( 'Sorry, you are not allowed to do that.', 'travel-monster' ), array( 'status' => 403 ) );
    }

    // Get the list of all installed plugins
    $all_plugins = get_plugins();

    // Fetch the row from the options table containing active plugins
    $active_plugins_option = get_option('active_plugins');

    // Unserialize the active plugins data
    $active_plugins = is_array($active_plugins_option) ? $active_plugins_option : [];

    // Get the slugs of active plugins
    $active_plugin_slugs = array_map(function($plugin) {
        return plugin_basename($plugin);
    }, $active_plugins);

    // Get the slugs of inactive plugins
    $inactive_plugin_slugs = array_diff(array_keys($all_plugins), $active_plugin_slugs);

    // Get the details of inactive plugins
    $inactive_plugins = array_intersect_key($all_plugins, array_flip($inactive_plugin_slugs));

    // Initialize an empty array to hold the modified inactive plugins
    $modified_inactive_plugins = array();
    // Iterate over each inactive plugin
    foreach ($inactive_plugins as $key => $plugin_data) {
        $extract = explode( '/', $key );
        // Extract the necessary information
        $name = $plugin_data['Name'];
        $slug = $extract[0];

        // Add the plugin to the modified array
        $modified_inactive_plugins[] = array(
            'name' => esc_html($name),
            'slug' => sanitize_title($slug),
            'url'  => travel_monster_get_activation_url($slug)
        );
    }

    // Return the modified array
    return $modified_inactive_plugins;
}

/**
 * Get the activation URL for a plugin.
 *
 * @param string $plugin_slug The plugin slug.
 *
 * @return string|bool The activation URL if the plugin exists, false otherwise.
 */
function travel_monster_get_activation_url($plugin_slug) {
    if ( file_exists( WP_PLUGIN_DIR . '/' . $plugin_slug ) ) {
        $plugins = get_plugins( '/' . $plugin_slug );
        if ( ! empty( $plugins ) ) {
            $keys        = array_keys( $plugins );
            $plugin_file = $plugin_slug . '/' . $keys[0];
            $url         = wp_nonce_url(
                add_query_arg(
                    array(
                        'action' => 'activate',
                        'plugin' => $plugin_file,
                    ),
                    admin_url( 'plugins.php' )
                ),
                'activate-plugin_' . $plugin_file
            );
            return $url;
        }
    }
    return false;
}

/**
 * Get the active plugins.
 *
 * @return array
 */
function travel_monster_get_active_plugins() {
    $active_plugins = get_plugins();
    $plugins = array();

    foreach ($active_plugins as $key => $plugin) {
        if ( is_plugin_active( $key ) ) {
            $extract = explode( '/', $key );
            $path    = ABSPATH . 'wp-content/plugins/' . $key;
            $plugin_data = get_plugin_data($path);
            $plugins[] = array(
                'name'    => esc_html($plugin_data['Name']),
                'slug'    => sanitize_title($extract[0]),
                'version' => esc_html($plugin_data['Version']),
            );
        }
    }

    return $plugins;
}