<?php
/**
 * Travel Monster Custom functions and definitions
 *
 * @package Travel Monster
*/

if ( ! function_exists( 'travel_monster_setup' ) ) :
	/**
	 * Sets up theme defaults and registers support for various WordPress features.
	 *
	 * Note that this function is hooked into the after_setup_theme hook, which
	 * runs before the init hook. The init hook is too late for some features, such
	 * as indicating support for post thumbnails.
	 */
	function travel_monster_setup() {
		$build  = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '/build' : '';
    	$suffix = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
		/*
		 * Make theme available for translation.
		 * Translations can be filed in the /languages/ directory.
		 * If you're building a theme based on Travel Monster, use a find and replace
		 * to change 'travel-monster' to the name of your theme in all the template files.
		 */
		load_theme_textdomain( 'travel-monster', get_template_directory() . '/languages' );

		// Add default posts and comments RSS feed links to head.
		add_theme_support( 'automatic-feed-links' );

		/*
		 * Let WordPress manage the document title.
		 * By adding theme support, we declare that this theme does not use a
		 * hard-coded <title> tag in the document head, and expect WordPress to
		 * provide it for us.
		 */
		add_theme_support( 'title-tag' );

		/*
		 * Enable support for Post Thumbnails on posts and pages.
		 *
		 * @link https://developer.wordpress.org/themes/functionality/featured-images-post-thumbnails/
		 */
		add_theme_support( 'post-thumbnails' );

		// This theme uses wp_nav_menu() in one location.
		$menus = array(
			'primary'   => esc_html__( 'Primary', 'travel-monster' ),
			'secondary' => esc_html__( 'Secondary', 'travel-monster' ),
			'footer'    => esc_html__( 'Footer', 'travel-monster' ),
		);
	
		if( travel_monster_is_polylang_active() ){
			$menus['language'] = esc_html__( 'Language', 'travel-monster' ); 
		}
	
		register_nav_menus( $menus );

		/*
		 * Switch default core markup for search form, comment form, and comments
		 * to output valid HTML5.
		 */
		add_theme_support(
			'html5',
			array(
				'search-form',
				'comment-form',
				'comment-list',
				'gallery',
				'caption',
				'style',
				'script',
			)
		);

		// Set up the WordPress core custom background feature.
		add_theme_support(
			'custom-background',
			apply_filters(
				'travel_monster_custom_background_args',
				array(
					'default-color' => 'ffffff',
					'default-image' => '',
				)
			)
		);

		// Add theme support for selective refresh for widgets.
		add_theme_support( 'customize-selective-refresh-widgets' );

		/**
		 * Add support for core custom logo.
		 *
		 * @link https://codex.wordpress.org/Theme_Logo
		 */
		add_theme_support(
			'custom-logo',
			array(
				'height'      => 250,
				'width'       => 250,
				'flex-width'  => true,
				'flex-height' => true,
			)
		);

		add_image_size( 'travel-monster-fullwidth', 1290, 670, true ); 
		add_image_size( 'travel-monster-withsidebar', 860, 510, true );
		add_image_size( 'travel-monster-blog-grid', 415, 260, true );
		add_image_size( 'travel-monster-latest-post', 970, 655, true );
		add_image_size( 'travel-monster-blog-list', 300, 440, true );
		add_image_size( 'travel-monster-header-bg-img', 1920, 350, true );
		add_image_size( 'travel-monster-single-layout-two', 1920, 600, true );

		/** Starter Content */
		$starter_content = array(
			// Specify the core-defined pages to create and add custom thumbnails to some of them.
			'posts' => array( 
				'home', 
				'blog',
			),
			
			// Default to a static front page and assign the front and posts pages.
			'options' => array(
				'show_on_front' => 'page',
				'page_on_front' => '{{home}}',
				'page_for_posts' => '{{blog}}',
			),
			
			// Set up nav menus for each of the two areas registered in the theme.
			'nav_menus' => array(
				// Assign a menu to the "top" location.
				'primary' => array(
					'name' => __( 'Primary', 'travel-monster' ),
					'items' => array(
						'page_home',
						'page_blog',
					)
				)
			),
		);
		
		$starter_content = apply_filters( 'travel_monster_starter_content', $starter_content );
		
		add_theme_support( 'starter-content', $starter_content );

		// Add theme support for Responsive Videos.
		add_theme_support( 'jetpack-responsive-videos' );

		// Add excerpt support for pages
		add_post_type_support( 'page', 'excerpt' );

		// Add support for full and wide align images.
		add_theme_support( 'align-wide' );

		// Add support for editor styles.
		add_theme_support( 'editor-styles' );
	
		// Add support for responsive embeds.
		add_theme_support( 'responsive-embeds' );

		// Add support for block editor styles.
		add_theme_support( 'wp-block-styles' );

		// Add support for padding control
		add_theme_support( 'custom-spacing' );
		
		// Add support for border
		add_theme_support( 'border' );

		// Add support for link color
		add_theme_support( 'link-color' );

		// Add support for custom line height
		add_theme_support( 'custom-line-height' );

	}
endif;
add_action( 'after_setup_theme', 'travel_monster_setup' );

if( ! function_exists( 'travel_monster_admin_notice' ) ) :
/**
 * Addmin notice for getting started page
*/
function travel_monster_admin_notice(){
	global $pagenow;
	$theme_args      = wp_get_theme();
	$meta            = get_option( 'travel_monster_admin_notice' );
	$name            = $theme_args->__get( 'Name' );
	$current_screen  = get_current_screen();
	$dismissnonce    = wp_create_nonce( 'travel_monster_admin_notice' );
	
	if( 'themes.php' == $pagenow && !$meta ){
		
		if( $current_screen->id !== 'dashboard' && $current_screen->id !== 'themes' ){
			return;
		}

		if( is_network_admin() ){
			return;
		}

		if( ! current_user_can( 'manage_options' ) ){
			return;
		} ?>

		<div class="welcome-message notice notice-info">
			<div class="notice-wrapper">
				<div class="notice-text">
					<h3><?php esc_html_e( 'Congratulations!', 'travel-monster' ); ?></h3>
					<p><?php printf( __( '%1$s is now installed and ready to use. Click below to see theme documentation, plugins to install and other details to get started.', 'travel-monster' ), esc_html( $name ) ); ?></p>
					<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=travel-monster-dashboard' ) ); ?>" class="button button-primary"><?php esc_html_e( 'Go to the dashboard.', 'travel-monster' ); ?></a></p>
					<p class="dismiss-link"><strong><a href="?travel_monster_admin_notice=1&_wpnonce=<?php echo esc_attr( $dismissnonce ); ?>"><?php esc_html_e( 'Dismiss', 'travel-monster' ); ?></a></strong></p>
				</div>
			</div>
		</div>
	<?php }
}
endif;
add_action( 'admin_notices', 'travel_monster_admin_notice' );

if( ! function_exists( 'travel_monster_update_admin_notice' ) ) :
/**
 * Updating admin notice on dismiss
*/
function travel_monster_update_admin_notice(){

	if (!current_user_can('manage_options')) {
        return;
    }

    // Bail if the nonce doesn't check out
    if ( ( isset( $_GET['travel_monster_admin_notice'] ) && $_GET['travel_monster_admin_notice'] === '1' ) && wp_verify_nonce( $_GET['_wpnonce'], 'travel_monster_admin_notice' ) ) {
        update_option( 'travel_monster_admin_notice', true );
    }

}
endif;
add_action( 'admin_init', 'travel_monster_update_admin_notice' );

/**
 * Set the content width in pixels, based on the theme's design and stylesheet.
 *
 * Priority 0 to make it available to lower priority callbacks.
 *
 * @global int $content_width
 */
function travel_monster_content_width() {
	// This variable is intended to be overruled from themes.
	// Open WPCS issue: {@link https://github.com/WordPress-Coding-Standards/WordPress-Coding-Standards/issues/1043}.
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
	$GLOBALS['content_width'] = apply_filters( 'travel_monster_content_width', 780 );
}
add_action( 'after_setup_theme', 'travel_monster_content_width', 0 );

if( ! function_exists( 'travel_monster_template_redirect_content_width' ) ) :
/**
* Adjust content_width value according to template.
*
* @return void
*/
function travel_monster_template_redirect_content_width(){
	$sidebar = travel_monster_sidebar();
	if( $sidebar ){	   
		$GLOBALS['content_width'] = 780;       
	}else{
	
		if( is_singular() ){
			if( travel_monster_sidebar( true ) === 'full-width centered' ){
				$GLOBALS['content_width'] = 780;
			}else{
				$GLOBALS['content_width'] = 1170;                
			}                
		}else{
			$GLOBALS['content_width'] = 1170;
		}
	}
}
endif;
add_action( 'template_redirect', 'travel_monster_template_redirect_content_width' );

if( ! function_exists( 'travel_monster_scripts') ) :
/**
 * Enqueue scripts and styles.
 * 
 * @return void
 */
function travel_monster_scripts() {

	$defaults     = travel_monster_get_general_defaults();
	$build        = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '/build' : '';
	$suffix       = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';

	// Add parameters for the JS
    global $wp_query;
    $max = $wp_query->max_num_pages;
	$paged = ( get_query_var( 'paged' ) > 1 ) ? get_query_var( 'paged' ) : 1;

	/** Ajax Pagination */
    $pagination       = get_theme_mod( 'post_navigation', $defaults['post_navigation'] );
    $loadmore         = get_theme_mod( 'load_more_label', $defaults['load_more_label'] );
    $loading          = get_theme_mod( 'loading_label', $defaults['loading_label']);
    $nomore           = get_theme_mod( 'no_more_label', $defaults['no_more_label'] );

	$ed_localgoogle_fonts   = get_theme_mod( 'ed_localgoogle_fonts', $defaults['ed_localgoogle_fonts'] );
	$ed_preload_local_fonts = get_theme_mod( 'ed_preload_local_fonts', $defaults['ed_preload_local_fonts'] );

    wp_enqueue_style( 'travel-monster-google-fonts', travel_monster_google_fonts_url(), array(), null );
	wp_enqueue_style( 'travel-monster-style', get_template_directory_uri() . '/style' . $suffix . '.css', array(), TRAVEL_MONSTER_THEME_VERSION );
	wp_style_add_data( 'travel-monster-style', 'rtl', 'replace' );
	if( $suffix ){
		wp_style_add_data( 'travel-monster-style', 'suffix', $suffix );
	}

	if( travel_monster_is_elementor_activated() ){
		// Only load on pages built with Elementor
		if ( travel_monster_is_elementor_activated_post() ) {
			wp_enqueue_style( 'travel-monster-elementor', get_template_directory_uri(). '/css' . $build . '/elementor' . $suffix . '.css', array(), TRAVEL_MONSTER_THEME_VERSION );
		}
    }

	if( $pagination === 'load_more' || $pagination === 'infinite_scroll' ){
		wp_enqueue_script( 'travel-monster-ajax', get_template_directory_uri() . '/js' . $build . '/ajax' . $suffix . '.js', array('jquery'), TRAVEL_MONSTER_THEME_VERSION, true );
		wp_localize_script( 
			'travel-monster-ajax',
			'travel_monster_ajax',
			array( 
				'url'       => admin_url( 'admin-ajax.php' ),
				'startPage' => $paged,
				'maxPages'  => $max,
				'nextLink'  => next_posts( $max, false ),
				'autoLoad'  => $pagination,
				'loadmore'  => $loadmore,
				'loading'   => $loading,
				'nomore'    => $nomore,
			) 
		);	
	}
	wp_enqueue_script( 'travel-monster-custom', get_template_directory_uri() . '/js' . $build . '/custom' . $suffix . '.js', array( 'jquery' ), TRAVEL_MONSTER_THEME_VERSION, true );
	
	wp_localize_script( 
		'travel-monster-custom',
		'travel_monster_custom',
		array( 
			'url'              => admin_url( 'admin-ajax.php' ),
			'rtl'              => is_rtl(),
			'sticky_widget'    => get_theme_mod( 'ed_last_widget_sticky', $defaults['ed_last_widget_sticky'] ),
			'ed_sticky_header' => get_theme_mod( 'ed_sticky_header', $defaults['ed_sticky_header'] ),
		) 
	);	

	if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) {
		wp_enqueue_script( 'comment-reply' );
	}

	if (  $ed_localgoogle_fonts && 
		! is_customize_preview() && 
		! is_admin() && 
		$ed_preload_local_fonts ) {
			travel_monster_preload_local_fonts( travel_monster_google_fonts_url() );
	}

	if ( travel_monster_is_elementor_activated() ) {
		wp_dequeue_style( 'elementor-frontend' );
		wp_enqueue_style( 'elementor-frontend' );
	}
}
endif;
add_action( 'wp_enqueue_scripts', 'travel_monster_scripts' );

if( ! function_exists( 'travel_monster_admin_scripts' ) ) :
/**
 * Enqueue admin scripts and styles.
 * 
 * @return void
*/
function travel_monster_admin_scripts( $hook ){   

	if( $hook == 'post-new.php' || $hook == 'post.php' || $hook == 'user-new.php' || $hook == 'user-edit.php' || $hook == 'profile.php' || $hook == 'widgets.php' ){
		wp_enqueue_style( 'travel-monster-admin', get_template_directory_uri() . '/inc/css/admin.css', '', TRAVEL_MONSTER_THEME_VERSION );
		wp_enqueue_script( 'travel-monster-admin', get_template_directory_uri() . '/inc/js/admin.js', array( 'jquery', 'jquery-ui-sortable' ), TRAVEL_MONSTER_THEME_VERSION, false );
	}
}
endif; 
add_action( 'admin_enqueue_scripts', 'travel_monster_admin_scripts' );

if( ! function_exists( 'travel_monster_block_editor_styles' ) ) :
/**
 * Enqueue editor styles for Gutenberg
 * 
 * @return void
 */
function travel_monster_block_editor_styles() {
	// Use minified libraries if SCRIPT_DEBUG is false
	$build  = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '/build' : '';
	$suffix = ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min';
	
	// Block styles.
    wp_enqueue_style( 'travel-monster-block-editor-style', get_template_directory_uri() . '/css' . $build . '/editor-block' . $suffix . '.css' );

    wp_add_inline_style( 'travel-monster-block-editor-style', travel_monster_gutenberg_inline_style() );

    // Add custom fonts.
    wp_enqueue_style( 'travel-monster-google-fonts', travel_monster_google_fonts_url(), array(), null );

}
endif;
add_action( 'enqueue_block_editor_assets', 'travel_monster_block_editor_styles' );

if( ! function_exists( 'travel_monster_body_classes' ) ) :
/**
 * Adds custom classes to the array of body classes.
 *
 * @param array $classes Classes for the body element.
 * @return array
 */
function travel_monster_body_classes( $classes ) {
	$defaults              = travel_monster_get_general_defaults();
	$container_layout      = get_theme_mod( 'layout', $defaults['layout'] );
	$blog_page_layout      = get_theme_mod( 'blog_page_layout', $defaults['blog_page_layout'] );
	$archive_layout        = get_theme_mod( 'archive_page_layout', $defaults['archive_page_layout'] );
	$editor_options        = get_option( 'classic-editor-replace' );
	$allow_users_options   = get_option( 'classic-editor-allow-users' );
	$ed_last_widget_sticky = get_theme_mod( 'ed_last_widget_sticky',$defaults['ed_last_widget_sticky'] );
	$stickyheader          = get_theme_mod( 'ed_sticky_header', $defaults['ed_sticky_header'] );
	$ed_transparent_header = get_theme_mod( 'ed_transparent_header', false );
	$get_transparent_pages = get_theme_mod( 'transparent_pages_list', array( 'homepage' ) );


	//Adds a class of hfeed to non-singular pages.
	if ( ! is_singular() ) {
		$classes[] = 'hfeed';
	}
	
	if( is_page() ){
		$page_layout      = get_theme_mod( 'page_layout', $defaults['page_layout'] );
		$container_layout = ( $page_layout === 'default' ) ? $container_layout : $page_layout;
	}
	
	if( is_archive() || is_search() ){
		$classes[] = 'archive-layout-'.$archive_layout;
	}
	if( is_single() ){
		$single_post_layout = get_theme_mod( 'single_post_layout', $defaults['single_post_layout'] );
		$classes[] = 'post-layout-'.$single_post_layout;
	}

	if( is_home() || is_archive() || is_search() ){
		$archive_layout   = get_theme_mod( 'archive_page_layout', $defaults['archive_page_layout'] );
		$container_layout = ( $archive_layout === 'default' ) ? $container_layout : $archive_layout;
	}	
	
	switch( $container_layout ){
		case 'boxed':
			$classes[] = 'box-layout';
		break;
		case 'content_boxed':
			$classes[] = 'content-box-layout';
		break;
		case 'full_width_contained':
			$classes[] = 'default-layout';
		break;
		case 'full_width_stretched':
			$classes[] = 'fluid-layout';
		break;
	}
	
	if( is_home() ){
		$classes[] = 'blog-layout-'.$blog_page_layout;
	}

	if( $ed_last_widget_sticky ){
        $classes[] = 'ed_last_widget_sticky';
    }

	if( ! travel_monster_is_classic_editor_activated() || ( travel_monster_is_classic_editor_activated() && $editor_options == 'block' ) || ( travel_monster_is_classic_editor_activated() && $allow_users_options == 'allow' && has_blocks() ) ){
        $classes[] = 'travel-monster-has-blocks';
	}
	
	if(!is_singular('trip')){
		$classes[] = travel_monster_sidebar( true );	
	}
	
	if( $stickyheader ){
		$classes[] = 'sticky-header';
    }

	if( is_singular( 'trip' ) ){
        $classes[] = 'fix-tabbar-enabled';
    }

	$header_type = get_theme_mod( 'wpte_header_type', 'prebuilt' );

	if ( $ed_transparent_header && $header_type === 'builder' ) {
		if ( in_array( 'homepage', $get_transparent_pages ) ) {
			if ( is_front_page() ) {
				$classes[] = 'transparent-header-active';
			}
		}

		if ( in_array( 'all_pages', $get_transparent_pages ) ) {
			if ( is_page() ) {
				$classes[] = 'transparent-header-active';
			}
		}

		if ( in_array( 'archive', $get_transparent_pages ) && is_archive() ) {
			$classes[] = 'transparent-header-active';
		}

		if ( in_array( 'search', $get_transparent_pages ) && is_search() ) {
			$classes[] = 'transparent-header-active';
		}

		if ( in_array( 'blog', $get_transparent_pages ) && is_home() ) {
			$classes[] = 'transparent-header-active';
		}

		if ( in_array( get_the_id(), $get_transparent_pages ) ) {
			$classes[] = 'transparent-header-active';
		}
	}


	return $classes;
}
endif;
add_filter( 'body_class', 'travel_monster_body_classes' );

if( ! function_exists( 'travel_monster_pingback_header' ) ) :
/**
 * Add a pingback url auto-discovery header for single posts, pages, or attachments.
 */
function travel_monster_pingback_header() {
	if ( is_singular() && pings_open() ) {
		printf( '<link rel="pingback" href="%s">', esc_url( get_bloginfo( 'pingback_url' ) ) );
	}
}
endif;
add_action( 'wp_head', 'travel_monster_pingback_header' );

if( ! function_exists( 'travel_monster_post_classes' ) ) :
/**
 * Add custom classes to the array of post classes.
 * 
 * @return array
*/
function travel_monster_post_classes( $classes, $class, $post_id ){
	
	$classes[] = 'travel-monster-post';

	if( ! has_post_thumbnail( $post_id ) ){
		$classes[] = 'no-post-thumbnail';
	}

	if( is_single() ){
		$classes[] = 'travel-monster-single';
	}
	
	$classes[] = 'latest_post';
	
	return $classes;
}
endif;
add_filter( 'post_class', 'travel_monster_post_classes', 10, 3 );

if ( ! function_exists( 'travel_monster_excerpt_length' ) ) :
/**
 * Changes the default 55 character in excerpt 
 * 
 * @return void
*/
function travel_monster_excerpt_length( $length ) {
	$defaults = travel_monster_get_general_defaults();
	$excerpt_length = get_theme_mod( 'excerpt_length', $defaults['excerpt_length'] );
	return is_admin() ? $length : absint( $excerpt_length );    
}
endif;
add_filter( 'excerpt_length', 'travel_monster_excerpt_length', 999 );

if( ! function_exists( 'travel_monster_archive_heading' ) ) :
/**
 * Prefix for archive heading
 *
 * @param string $title
 * @return string
 */
function travel_monster_archive_heading( $title ){ 
	$defaults  = travel_monster_get_general_defaults();
	$ed_prefix = get_theme_mod( 'ed_archive_prefix', $defaults['ed_archive_prefix'] );
	$ed_title  = get_theme_mod( 'ed_archive_title', $defaults['ed_archive_title'] );
	
	if( is_category() ){
		$page_title =  $ed_title ? '<h1 class="page-title">'. esc_html( single_cat_title( '', false ) ) .'</h1>' : '';
		
		if( $ed_prefix ){
			$title = '<div class="archive-title-wrapper"><span class="sub-title">'. esc_html__( 'Category:', 'travel-monster' ) . '</span>' . $page_title . '</div>';
		}else{
			$title = $page_title;
		}			
	}elseif( is_tag() ){
		$page_title =  $ed_title ? '<h1 class="page-title">' . esc_html( single_tag_title( '', false ) ) . '</h1>' : '';

		if( $ed_prefix ) {
			$title = '<div class="archive-title-wrapper"><span class="sub-title">'. esc_html__( 'Tag', 'travel-monster' ) . '</span>'. $page_title .'</div>';
		}else{
			$title = $page_title;
		}
	}elseif( is_year() ){
		$page_title =  $ed_title ? '<h1 class="page-title">' . get_the_date( _x( 'Y', 'yearly archives date format', 'travel-monster' ) ) . '</h1>' : '';

		if( $ed_prefix ){
			$title = '<div class="archive-title-wrapper"><span class="sub-title">'. esc_html__( 'Year', 'travel-monster' ) . '</span>'. $page_title .'</div>';
		}else{
			$title = $page_title;                   
		}
	}elseif( is_month() ){
		$page_title =  $ed_title ? '<h1 class="page-title">' . get_the_date( _x( 'F Y', 'monthly archives date format', 'travel-monster' ) ) . '</h1>' : '';

		if( $ed_prefix ){
			$title = '<div class="archive-title-wrapper"><span class="sub-title">'. esc_html__( 'Month', 'travel-monster' ) . '</span>'. $page_title .'</div>';
		}else{
			$title = $page_title;                                   
		}
	}elseif( is_day() ){
		$page_title =  $ed_title ? '<h1 class="page-title">' . get_the_date( _x( 'F j, Y', 'daily archives date format', 'travel-monster' ) ) . '</h1>' : '';

		if( $ed_prefix ){
			$title = '<div class="archive-title-wrapper"><span class="sub-title">'. esc_html__( 'Day', 'travel-monster' ) . '</span>'. $page_title .'</div>';
		}else{
			$title = $page_title;                                   
		}
	}elseif( is_tax() ) {
		$tax            = get_taxonomy( get_queried_object()->taxonomy );
		$wte_taxonomies = array( 'destination', 'activities', 'trip_types', 'difficulty', 'trip_tag' );

		if ( travel_monster_is_wpte_activated() && in_array( get_queried_object()->taxonomy, $wte_taxonomies ) ) {
			$wte_settings       = get_option( 'wp_travel_engine_settings', array() );
			$wte_show_title     = ! isset( $wte_settings['hide_term_title'] ) || 'yes' !== $wte_settings['hide_term_title'];
			$archive_title_type = $wte_settings['archive']['title_type'] ?? 'default';

			if ( $wte_show_title ) {
				if ( $archive_title_type === 'custom' && ! empty( $wte_settings['archive']['title'] ) ) {
					$page_title = '<h1 class="page-title">' . esc_html( $wte_settings['archive']['title'] ) . '</h1>';
				} else {
					$page_title = '<h1 class="page-title">' . single_term_title( '', false ) . '</h1>';
				}
				if ( $ed_prefix ) {
					$title = '<div class="archive-title-wrapper"><span class="sub-title">' . $tax->labels->singular_name . '</span>' . $page_title . '</div>';
				} else {
					$title = $page_title;
				}
			} else {
				$title = '';
			}
		} else {
			$page_title = $ed_title ? '<h1 class="page-title">' . single_term_title( '', false ) . '</h1>' : '';

			if( $ed_prefix ){
				$title = '<div class="archive-title-wrapper"><span class="sub-title">' . $tax->labels->singular_name . '</span>'. $page_title .'</div>';
			}else{
				$title = $page_title;
			}
		}
	}elseif( is_post_type_archive( 'trip' ) ){
		if ( travel_monster_is_wpte_activated() ) {
			$wte_settings       = get_option( 'wp_travel_engine_settings', array() );
			$wte_show_title     = ! isset( $wte_settings['hide_term_title'] ) || 'yes' !== $wte_settings['hide_term_title'];
			$archive_title_type = $wte_settings['archive']['title_type'] ?? 'default';

			if ( $wte_show_title ) {
				if ( $archive_title_type === 'custom' && ! empty( $wte_settings['archive']['title'] ) ) {
					$title = '<h1 class="page-title">' . esc_html( $wte_settings['archive']['title'] ) . '</h1>';
				} else {
					$title = '<h1 class="page-title">' . post_type_archive_title( '', false ) . '</h1>';
				}
			} else {
				$title = '';
			}
		} else {
			$title = '<h1 class="page-title">' . post_type_archive_title( '', false ) . '</h1>';
		}
	}

	return $title;
}
endif;
add_filter( 'get_the_archive_title', 'travel_monster_archive_heading' );

if ( ! function_exists( 'travel_monster_dynamic_mce_css' ) ) :
/**
 * Add Editor Style 
 * Add Link Color Option in Editor Style (MCE CSS)
 */
function travel_monster_dynamic_mce_css( $mce_css ){
	$mce_css .= ', ' . add_query_arg( array( 'action' => 'travel_monster_dynamic_mce_css', '_nonce' => wp_create_nonce( 'travel_monster_dynamic_mce_nonce', __FILE__ ) ), admin_url( 'admin-ajax.php' ) );
	return $mce_css;
}
endif;
add_filter( 'mce_css', 'travel_monster_dynamic_mce_css' );
	
if ( ! function_exists( 'travel_monster_dynamic_mce_css_ajax_callback' ) ) : 
/**
 * Ajax Callback
 * 
 * @return void
 */
function travel_monster_dynamic_mce_css_ajax_callback(){
	
	/* Check nonce for security */
	$nonce = isset( $_REQUEST['_nonce'] ) ? $_REQUEST['_nonce'] : '';
	if( ! wp_verify_nonce( $nonce, 'travel_monster_dynamic_mce_nonce' ) ){
		wp_die(); // don't print anything
	}
	
	/* Get Link Color */
	$typo_defaults   = travel_monster_get_typography_defaults();
	$primary_font    = wp_parse_args( get_theme_mod( 'primary_font' ), $typo_defaults['primary_font'] );
	$primary_fonts   = travel_monster_get_font_family( $primary_font );
	
	/* Set File Type and Print the CSS Declaration */
	header( 'Content-type: text/css' );
	echo ':root .mce-content-body {
		--primary-font: ' . wp_kses_post( $primary_fonts ) . ';
	}';
	wp_die(); // end ajax process.
}
endif;
add_action( 'wp_ajax_travel_monster_dynamic_mce_css', 'travel_monster_dynamic_mce_css_ajax_callback' );
add_action( 'wp_ajax_no_priv_travel_monster_dynamic_mce_css', 'travel_monster_dynamic_mce_css_ajax_callback' );	