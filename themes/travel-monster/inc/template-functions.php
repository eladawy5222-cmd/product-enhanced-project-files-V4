<?php
/**
 * Functions which enhance the theme by hooking into WordPress
 *
 * @package Travel Monster
*/

if( ! function_exists( 'travel_monster_doctype' ) ) :
/**
 * Doctype Declaration
*/
function travel_monster_doctype(){ ?>
	<!DOCTYPE html>
	<html <?php language_attributes(); ?>>
	<?php
}
endif;
add_action( 'travel_monster_doctype', 'travel_monster_doctype' );

if( ! function_exists( 'travel_monster_head' ) ) :
/**
 * Before wp_head 
*/
function travel_monster_head(){ ?>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="profile" href="https://gmpg.org/xfn/11">
	<?php
}
endif;
add_action( 'travel_monster_before_wp_head', 'travel_monster_head' );

if( ! function_exists( 'travel_monster_page_start' ) ) :
/**
 * Page Start
*/
function travel_monster_page_start(){ ?>
	<div id="page" class="site">
		<a class="skip-link screen-reader-text" href="#primary"><?php esc_html_e( 'Skip to content', 'travel-monster' ); ?></a>
	<?php
}
endif;
add_action( 'travel_monster_before_header', 'travel_monster_page_start', 20 );

if( ! function_exists( 'travel_monster_header' ) ) :
/**
 * Header Start
*/
function travel_monster_header(){ 
	$defaults     = travel_monster_get_general_defaults();
	$header_array = array( 'one' );
	if( travel_monster_pro_is_activated() && defined( 'TRAVEL_MONSTER_PRO_PATH' ) ){
		$header_array = array( 'one', 'two', 'three', 'four', 'five', 'six' );
		$header       = get_theme_mod( 'header_layout', $defaults['header_layout'] );
		if( in_array( $header, $header_array ) ){       
		 	/**
			 * Typography Functions
			 */
			require TRAVEL_MONSTER_PRO_PATH . 'headers/'.$header.'.php';
		}
	}else{
		get_template_part( 'headers/one' );
	}
	
}
endif;
add_action( 'travel_monster_header', 'travel_monster_header', 20 );

if( ! function_exists( 'travel_monster_polylang_language_switcher' ) ) :
/**
 * Template for Polylang Language Switcher
*/
function travel_monster_polylang_language_switcher(){
	if( travel_monster_is_polylang_active() || travel_monster_is_wpml_active() ){ ?>
		<div class="header-t-lang">
			<nav class="language-dropdown">
				<?php
					wp_nav_menu( array(
						'theme_location' => 'language',
						'menu_class'     => 'languages',
						'fallback_cb'    => false,
					) );
				?>
			</nav><!-- .language-dropdown -->
		</div><!-- .header-t-lang -->
		<?php        
	}
}
endif;
add_action( 'travel_monster_language_switcher', 'travel_monster_polylang_language_switcher' );

if( ! function_exists( 'travel_monster_currency_converter' ) ) :
/**
 * Currency Converter
*/
function travel_monster_currency_converter(){
	if( travel_monster_is_currency_converter_activated() ){
		$helper_functions = Wte_Currency_Converter_Helper_Functions::get_instance();
		$currency_converter_enabled = $helper_functions->is_currency_converter_enabled();
		if( $currency_converter_enabled ){ ?>
			<div class="header-t-currnc">			
				<?php echo do_shortcode( '[wte_currency_converter]' ); ?>	
			</div>
		<?php        
		}
	}
}
endif;
add_action( 'travel_monster_currency_converter', 'travel_monster_currency_converter' );

if( ! function_exists( 'travel_monster_content_start' ) ) :
/**
 * Content Start
*/
function travel_monster_content_start(){ 
	$defaults            = travel_monster_get_general_defaults();
	$ed_breadcrumb       = get_theme_mod( 'ed_breadcrumb', $defaults['ed_breadcrumb'] );
	$ed_blog_title       = get_theme_mod( 'ed_blog_title', $defaults['ed_blog_title'] );
	$ed_blog_desc        = get_theme_mod( 'ed_blog_desc', $defaults['ed_blog_desc'] );
	$blog_alignment      = get_theme_mod( 'blog_alignment', $defaults['blog_alignment'] );
	$archive_title       = get_theme_mod( 'ed_archive_title', $defaults['ed_archive_title'] );
	$archive_desc        = get_theme_mod( 'ed_archive_description', $defaults['ed_archive_description'] );
	$archive_count       = get_theme_mod( 'ed_archive_post_count', $defaults['ed_archive_post_count'] );
	$archive_alignment   = get_theme_mod( 'archive_alignment', $defaults['archive_alignment'] );
	$container_layout    = get_theme_mod( 'layout', $defaults['layout'] );
	$archive_image       = get_theme_mod( 'archive_header_image', $defaults['archive_header_image']);
	$blog_image          = get_theme_mod( 'blog_header_image', $defaults['blog_header_image']);
	$single_post_layout  = get_theme_mod( 'single_post_layout', $defaults['single_post_layout'] );
	$post_meta_structure = get_theme_mod( 'single_post_meta_order', $defaults['single_post_meta_order'] );

	$class = '';
	$page_hdr_class = '';
	if( is_archive() || is_search() ) {
		$class = $archive_alignment;
		$page_hdr_class = ($ed_breadcrumb || $archive_title || $archive_desc) ? 'page-header-wrap' : 'no-header-text';
	}
	if( is_home() ) {
		$class = $blog_alignment;
		$page_hdr_class = ($ed_breadcrumb || $ed_blog_title || $ed_blog_desc) ? 'page-header-wrap' : 'no-header-text';
	}

	if( ( !is_404() && ! is_front_page() && !travel_monster_is_elementor_activated_post())){
		travel_monster_page_header_banner( $archive_image, $blog_image ); 
			?>
			<div class="container">
				<?php 
				travel_monster_breadcrumb();
				
				if( !is_page()) echo '<div class="' . esc_attr( $page_hdr_class ) . '" data-alignment="title-' . esc_attr( $class ) . '">';
					if( is_home() ){
						travel_monster_get_ed_blog_title();								
						travel_monster_get_ed_blog_desc();
					}
					
					if( is_archive() ){
						if( is_author() ){
							if( get_the_author_meta( 'description' ) ){ ?>
								<section class="travel-monster-author-box">
									<div class="author-section">
										<div class="author-top-wrap">
											<div class="img-holder">
												<?php echo get_avatar( get_the_author_meta( 'ID' ), 100 ); ?>
											</div>
											<div class="author-meta">
												<?php printf( esc_html__( '%1$s %2$s%3$s%4$s', 'travel-monster' ), '<h3 class="author-name">', '<span class="vcard">', esc_html( get_the_author_meta( 'display_name' ) ), '</span></h3>' );                
													echo '<div class="author-description">' . wp_kses_post( get_the_author_meta( 'description' ) ) . '</div>';
												?>
											</div>
										</div>
									</div>
								</section>
								<?php 
							}
						}else{			
							if( $archive_title ) the_archive_title();
							if(!is_post_type_archive('trip')) travel_monster_get_ed_archive_description();
						} 
					}
					
					if( is_page_template( 'templates/template-trip-listing.php') ){
						the_archive_description( '<div class="archive-description">', '</div>' );
					}

					// Check if Travel Monster Pro is active and ed_trip_search is enabled
					$ed_trip_search = false;
					if( travel_monster_pro_is_activated() ) {
						$ed_trip_search = get_theme_mod( 'ed_trip_search', false );
					}
					
					// Show search form on regular searches, or when Travel Monster Pro trip search is enabled
					$show_search_form = false;
					if( is_search() ) {
						$post_type = get_query_var( 'post_type' );
						$get_post_type = isset( $_GET['post_type'] ) ? sanitize_text_field( $_GET['post_type'] ) : '';
						
						// Show if Travel Monster Pro trip search is enabled (even when post_type is trip)
						if( $ed_trip_search ) {
							$show_search_form = true;
						}
						// Or show if post_type is not trip (regular search)
						elseif( $post_type !== 'trip' && ( ! isset( $_GET['post_type'] ) || $get_post_type !== 'trip' ) ) {
							$show_search_form = true;
						}
					}
					
					if( $show_search_form ){ 
						?>
						<section class="search-result-wrapper">
							<div class="travel-monster-searchres-inner">
								<?php get_search_form(); ?>
							</div>
						</section>
						<?php
					}
					/**
					 * Show post count on search and archive pages
					 */
					$show_post_count = false;
					if( $archive_count && ( is_category() || is_tag() || is_author() ) ) {
						$show_post_count = true;
					} elseif( is_search() ) {
						$post_type = get_query_var( 'post_type' );
						$get_post_type = isset( $_GET['post_type'] ) ? sanitize_text_field( $_GET['post_type'] ) : '';
						
						// Show if Travel Monster Pro trip search is enabled (even when post_type is trip)
						if( $ed_trip_search ) {
							$show_post_count = true;
						}
						// Or show if post_type is not trip (regular search)
						elseif( $post_type !== 'trip' && ( ! isset( $_GET['post_type'] ) || $get_post_type !== 'trip' ) ) {
							$show_post_count = true;
						}
					}
					
					if( $show_post_count ) {
						echo '<section class="travel-monster-search-count">';
						travel_monster_get_ed_archive_post_count();
						echo '</section>';
					}

					if( travel_monster_is_wpte_activated() && version_compare( WP_TRAVEL_ENGINE_VERSION, '6.2.3', '<' ) ) {
						if( travel_monster_is_wte_advanced_search_active() && wte_advanced_search_is_search_page()){
							the_title( '<h1 class="page-title">', '</h1>' );
							echo '<span class="tmp-no-of-trips">';
							echo '</span>';
						}
					}
					

					if( is_page_template( array( 'templates/template-destination.php','templates/template-activities.php','templates/template-trip_types.php','templates/review.php','templates/template-trip-listing.php' ) ) ){
                        the_title( '<h1 class="page-title">', '</h1>' );
                    }
				if( !is_page() ) echo '</div>'; ?>
			</div>
		</div><!-- page-header-top -->
	<?php }
	
	if( is_page() ){
		$page_layout      = get_theme_mod( 'page_layout', $defaults['page_layout'] );
		$container_layout = ( $page_layout === 'default' ) ? $container_layout : $page_layout;
	}

	if( is_home() || is_archive() || is_search() ){
		$archive_layout   = get_theme_mod( 'archive_page_layout', $defaults['archive_page_layout'] );
		$container_layout = ( $archive_layout === 'default' ) ? $container_layout : $archive_layout;
	}

	$class  = ( $container_layout == 'full_width_stretched' && !is_404() ) ? 'container-full' : 'container'; 

	if( is_singular('post') && $single_post_layout === 'two' ){
		
		$post_crop_img  = get_theme_mod( 'ed_crop_single_image', $defaults[ 'ed_crop_single_image' ] );
		$image_size 	= ( ! $post_crop_img ) ? 'full' : 'travel-monster-single-layout-two'; ?>
		<div class="banner-wrapper">
			<?php if( has_post_thumbnail() ){
				echo '<div class="post-thumbnail">'; 
					the_post_thumbnail( $image_size, 'itemprop=image' );  
				echo '</div>';
			} else {
				travel_monster_get_fallback_svg( $image_size );
			} ?>
			<div class="content-wrap">
				<div class="container">
					<?php travel_monster_categories(); ?>
					<header class="entry-header">
						<?php the_title( '<h1 class="entry-title">', '</h1>' ); ?>
					</header>     
					<div class="entry-meta-pri">
						<div class="entry-meta-sec">
							<?php foreach( $post_meta_structure as $post_meta ){
								if( $post_meta == 'author' ) travel_monster_posted_by();
								if( $post_meta == 'date' ) travel_monster_posted_on();				
								if( $post_meta == 'comment' ) travel_monster_comment_link();				
							} ?>
						</div>
					</div>
				</div>
			</div>
		</div>
		<?php 
	}

	if( !is_404() ) { ?>
		<div class="site-content">		
			<div class="<?php echo esc_attr( $class ); ?>">
				<div class="main-content-wrapper clear">
					 <?php travel_monster_archive_tax_description(); ?>
				
	<?php	
	}
}
endif;
add_action( 'travel_monster_content', 'travel_monster_content_start',20 );

if( ! function_exists( 'travel_monster_navigation' ) ) :
/**
 * Navigation
*/
function travel_monster_navigation(){
	$defaults = travel_monster_get_general_defaults();
	$ed_post_pagination = get_theme_mod( 'ed_post_pagination',$defaults['ed_post_pagination'] );

	if( is_singular( 'post' ) && $ed_post_pagination ){

		if( ! $ed_post_pagination ) return;
		$next_post = get_next_post();
        $prev_post = get_previous_post();
		
		if( $prev_post || $next_post ){?>            
			<nav class="navigation post-navigation" role="navigation">
				<h2 class="screen-reader-text"><?php esc_html_e( 'Post Navigation', 'travel-monster' ); ?></h2>
				<div class="post-nav-links">
					<?php if( $prev_post ){ ?>
						<div class="nav-holder nav-previous">
							<div class="meta-nav"><a href="<?php echo esc_url( get_permalink( $prev_post->ID ) ); ?>"><?php esc_html_e( 'Previous Article', 'travel-monster' ); ?></a></div>
							<span class="entry-title"><a href="<?php echo esc_url( get_permalink( $prev_post->ID ) ); ?>"><?php echo esc_html( get_the_title( $prev_post->ID ) ); ?></a></span>
						</div>
					<?php } if( $next_post ){ ?>
						<div class="nav-holder nav-next">
							<div class="meta-nav"><a href="<?php echo esc_url( get_permalink( $next_post->ID ) ); ?>"><?php esc_html_e( 'Next Article', 'travel-monster' ); ?></a></div>
							<span class="entry-title"><a href="<?php echo esc_url( get_permalink( $next_post->ID ) ); ?>"><?php echo esc_html( get_the_title( $next_post->ID ) ); ?></a></span>
						</div>
					<?php } ?>
				</div>
			</nav>        
			<?php
		}
	}else{
		$pagination = get_theme_mod( 'post_navigation', $defaults['post_navigation'] );
		
		switch( $pagination ){	
			
			case 'numbered': // Numbered Pagination
			
			the_posts_pagination( array(
				'prev_text'          => __( 'Previous', 'travel-monster' ),
				'next_text'          => __( 'Next', 'travel-monster' ),
				'before_page_number' => '<span class="meta-nav screen-reader-text">' . __( 'Page', 'travel-monster' ) . ' </span>',
			) );
			
			break;
			
			case 'load_more': // Load More Button
			case 'infinite_scroll': // Auto Infinite Scroll
			
			echo '<div class="ajax-pagination"></div>';
			
			break;
			
			default:
			
			the_posts_navigation();
			
			break;
		}
	}
}
endif;
add_action( 'travel_monster_after_posts_content', 'travel_monster_navigation' );
add_action( 'travel_monster_after_post_loop', 'travel_monster_navigation', 10 );

if ( ! function_exists( 'travel_monster_post_thumbnail' ) ) :
/**
 * Displays an optional post thumbnail.
 *
 * Wraps the post thumbnail in an anchor element on index views, or a div
 * element when on single views.
 */
function travel_monster_post_thumbnail() {
	$defaults           = travel_monster_get_general_defaults();
	$ed_page_image      = get_theme_mod( 'ed_page_image', $defaults[ 'ed_page_image' ] );
	$post_crop_img      = get_theme_mod( 'ed_crop_single_image', $defaults[ 'ed_crop_single_image' ] );
	$blog_layout        = get_theme_mod( 'blog_page_layout', $defaults[ 'blog_page_layout' ]  );
	$archive_layout     = get_theme_mod( 'archive_page_layout', $defaults[ 'archive_page_layout' ]  );
	$single_post_layout = get_theme_mod( 'single_post_layout', $defaults['single_post_layout'] );

	if ( post_password_required() || is_attachment() ) {
		return;
	}

	$sidebar            = travel_monster_sidebar();
	$blog_image_size    = travel_monster_blog_layout_image_size();
	$archive_image_size = travel_monster_archive_layout_image_size();

	if( ( is_singular('post') && ! $post_crop_img ) ){
		$image_size = 'full';
	}else{
		$image_size = $sidebar ? 'travel-monster-withsidebar' : 'travel-monster-fullwidth';
	}

	if( is_singular('post') && $single_post_layout === 'one' ){
		if( has_post_thumbnail() ){
			echo '<div class="post-thumbnail">'; 
				the_post_thumbnail( $image_size, 'itemprop=image' );  
			echo '</div>';
		}
	}elseif( is_page() ){
		if( has_post_thumbnail() && $ed_page_image ){
			echo '<div class="post-thumbnail">'; 
				the_post_thumbnail( $image_size, 'itemprop=image' );  
			echo '</div>';
		}
	}elseif( is_search() || is_archive() || is_home() ){

		$image_size = is_home() ? $blog_image_size : $archive_image_size;
		if( has_post_thumbnail() ){ 
			if( (is_home() && $blog_layout === 'three') || ( (is_search() || is_archive()) && $archive_layout === 'three') ) 
			echo '<div class="feature-wrap">';
				echo '<div class="post-thumbnail"><a href="'.esc_url( get_the_permalink() ).'">';
						the_post_thumbnail(
							$image_size,
							array(
								'alt' => the_title_attribute(
									array(
										'echo' => false,
									)
								),
							)
						);
				echo '</a></div>';
			if( (is_home() && $blog_layout === 'three') || ( (is_search() || is_archive()) && $archive_layout === 'three') ) {
				travel_monster_categories();
				echo '</div>';	
			}
		}
	}elseif( is_singular('trip') ){
		$image_size = 'travel-monster-single-layout-two';
		if( has_post_thumbnail() ){
			echo '<div class="post-thumbnail">';
			the_post_thumbnail( $image_size, array( 'itemprop' => 'image' ) );
			echo '</div>';    
		}
	}else{
		if( has_post_thumbnail() && ! is_single()){ 
			echo '<div class="post-thumbnail"><a href="'.esc_url( get_the_permalink() ).'">';
					the_post_thumbnail(
						$image_size,
						array(
							'alt' => the_title_attribute(
								array(
									'echo' => false,
								)
							),
						)
					);
			echo '</a></div>';
		}elseif(! is_single()){
			travel_monster_get_fallback_svg( $image_size );
		}
	}
}
endif;
add_action( 'travel_monster_before_page_entry_content', 'travel_monster_post_thumbnail', 15 );
add_action( 'travel_monster_before_post_entry_content', 'travel_monster_post_thumbnail', 15 );
add_action( 'travel_monster_before_trip_entry_content', 'travel_monster_post_thumbnail', 10 );

if( ! function_exists( 'travel_monster_entry_header' ) ) :
/**
 * Entry Header
*/
function travel_monster_entry_header(){ 
	$defaults            = travel_monster_get_general_defaults();
	$meta_structure      = get_theme_mod( 'blog_meta_order', $defaults['blog_meta_order'] );
	$post_meta_structure = get_theme_mod( 'single_post_meta_order', $defaults['single_post_meta_order'] );
	$page_title          = get_theme_mod( 'ed_page_title', $defaults['ed_page_title'] );
	$blog_layout         = get_theme_mod( 'blog_page_layout', $defaults[ 'blog_page_layout' ]  );
	$blog_ed_category    = get_theme_mod( 'blog_ed_category', $defaults[ 'blog_ed_category' ]  );
	$archive_layout      = get_theme_mod( 'archive_page_layout', $defaults[ 'archive_page_layout' ]  );
	$single_post_layout  = get_theme_mod( 'single_post_layout', $defaults['single_post_layout'] );

	if( is_single() &&  $single_post_layout === 'one') travel_monster_categories();

	if ( ! is_singular() ) echo '<div class="archive-outer-wrap">'; 

	echo '<header class="entry-header">';
		if( is_home() || is_archive() || is_search() ){
			if( (is_home() && $blog_ed_category && $blog_layout !== 'three') || ((is_search() || is_archive()) && $archive_layout !== 'three') ){
				travel_monster_categories();
			} 
			the_title( '<h2 class="entry-title"><a href="' . esc_url( get_permalink() ) . '" rel="bookmark">', '</a></h2>' );
		}elseif( is_page() ){
			if( $page_title ) the_title( '<h1 class="entry-title">', '</h1>' );
		}elseif( is_single() &&  $single_post_layout === 'one' ){
			the_title( '<h1 class="entry-title">', '</h1>' );
		}
	echo '</header>';     

	if ( ! is_page() ) : ?>
		<div class="entry-meta-pri">
			<div class="entry-meta-sec">
				<?php
					if( is_home() ){
						foreach( $meta_structure as $meta ){
							if( $meta == 'author' ) travel_monster_posted_by();
							if( $meta == 'date' ) travel_monster_posted_on();				
							if( $meta == 'comment' ) travel_monster_comment_link();				
						}
					}elseif( is_single() &&  $single_post_layout === 'one' ){
						foreach( $post_meta_structure as $post_meta ){
							if( $post_meta == 'author' ) travel_monster_posted_by();
							if( $post_meta == 'date' ) travel_monster_posted_on();				
							if( $post_meta == 'comment' ) travel_monster_comment_link();				
						}
					}elseif( !is_single() ){
						travel_monster_posted_by();
						travel_monster_posted_on();				
						travel_monster_comment_link();	
					}					
				?>
			</div>
		</div><!-- .entry-meta-pri -->
		<?php
	endif; 
}
endif;
add_action( 'travel_monster_before_page_entry_content', 'travel_monster_entry_header', 20 );
add_action( 'travel_monster_before_post_entry_content', 'travel_monster_entry_header', 20 );

if( ! function_exists( 'travel_monster_entry_content' ) ) :
/**
 * Entry Header
*/
function travel_monster_entry_content(){  
	$defaults     = travel_monster_get_general_defaults();
	$itemprop     = ( travel_monster_get_schema_type() === 'microdata' ) ? ' itemprop="text"' : '';
	$content_type = get_theme_mod( 'blog_content', $defaults['blog_content'] );
	
	echo '<div class="entry-content-wrap clear"'. $itemprop .'>';	
		if( ( is_home() && $content_type == 'content' && ! has_excerpt() ) || is_singular() ){ 
			the_content(
				sprintf(
					wp_kses(
						/* translators: %s: Name of current post. Only visible to screen readers */
						__( 'Continue reading<span class="screen-reader-text"> "%s"</span>', 'travel-monster' ),
						array(
							'span' => array(
								'class' => array(),
							),
						)
					),
					wp_kses_post( get_the_title() )
				)
			);
				
			wp_link_pages(
				array(
					'before' => '<div class="page-links">' . esc_html__( 'Pages:', 'travel-monster' ),
					'after'  => '</div>',
				)
			);
		}else{ 
			the_excerpt();
		}
	echo '</div>'; 
}
endif;
add_action( 'travel_monster_page_entry_content', 'travel_monster_entry_content', 15 );
add_action( 'travel_monster_post_entry_content', 'travel_monster_entry_content', 15 );

if ( ! function_exists( 'travel_monster_entry_footer' ) ) :
/**
 * Prints HTML with meta information for the categories, tags and comments.
 */
function travel_monster_entry_footer() {
	$defaults          = travel_monster_get_general_defaults();
	$ed_post_tags      = get_theme_mod( 'ed_post_tags', $defaults['ed_post_tags'] );
	$ed_social_sharing = get_theme_mod( 'ed_social_sharing', $defaults['ed_social_sharing'] );

	if( ! is_singular() ){
		echo '<footer class="entry-footer travel-monster-flex">';
			$read_more      = get_theme_mod( 'blog_read_more', $defaults['blog_read_more'] );
			$readmore_style = get_theme_mod( 'read_more_style', $defaults['read_more_style'] );
			$class          = ( $readmore_style == 'button' ) ? ' button-style' : '';

			if( $read_more ) echo '<div class="readmore-btn-wrap"><a href="' . esc_url( get_the_permalink() ) . '" class="btn-readmore' . esc_attr( $class )  . '"><span class="read-more-text">' . esc_html( $read_more ) . '</span></a></div>';
		echo '</footer>'; ?>
		</div><!-- .archive-outer-wrap -->
		<?php
	}

	if( is_single() && $ed_social_sharing && function_exists( 'travel_monster_social_share' ) ) travel_monster_social_share();

	if( is_single() && $ed_post_tags ) {
		?>
		<div class="post-tags-wrap">
			<span class="post-tags">
				<?php travel_monster_tags(); ?>
			</span>
		</div>
		<?php 
	}
}
endif;
add_action( 'travel_monster_page_entry_content', 'travel_monster_entry_footer', 20 );
add_action( 'travel_monster_post_entry_content', 'travel_monster_entry_footer', 20 );

if( ! function_exists( 'travel_monster_author' ) ) :
/**
 * Author Section
*/
function travel_monster_author(){ 
	$defaults           = travel_monster_get_general_defaults();
	$ed_author          = get_theme_mod( 'ed_author', $defaults['ed_author'] );
	$author_title       = get_the_author_meta( 'display_name' );
	$author_description = get_the_author_meta( 'description' );

	if( $ed_author && $author_title && $author_description ) { ?>
		<div class="author-wrapper">
			<div class="img-holder">
				<?php echo get_avatar( get_the_author_meta( 'ID' ), 100 ); ?>
			</div>
			<div class="author-top-wrap">
				<div class="author-meta">
					<?php 
						echo '<h3 class="author-name"><span class="vcard">' . esc_html( get_the_author_meta( 'display_name' ) ) . '</span></h3>';
						echo '<div class="author-description">' . wp_kses_post( get_the_author_meta( 'description' ) ) . '</div>';
					?>
				</div>
				<?php 
					if( travel_monster_pro_is_activated() && function_exists( 'travel_monster_author_social' ) ){
						?>
							<div class="author-social-links"><?php travel_monster_author_social(); ?></div>
						<?php 
					}
				?>
				
				<a href="<?php echo esc_url( get_author_posts_url( get_the_author_meta( 'ID' ) ) ); ?>" class="view-all-auth"><?php esc_html_e( 'View All Articles', 'travel-monster' ); ?></a>
			</div>
		</div>
	<?php
	}
}
endif;
add_action( 'travel_monster_after_post_loop', 'travel_monster_author', 20 );

if( ! function_exists( 'travel_monster_related_posts' ) ) :
/**
 * Related Posts 
*/
function travel_monster_related_posts(){ 
	$defaults = travel_monster_get_general_defaults();
	$ed_post_related = get_theme_mod( 'ed_post_related', $defaults['ed_post_related'] ); 
	
	if( $ed_post_related ) travel_monster_get_posts_list( 'related' );    
}
endif;

if( ! function_exists( 'travel_monster_related_post_location' ) ) :
/**
 * Related Posts Location
*/
function travel_monster_related_post_location(){
	$defaults 			   = travel_monster_get_general_defaults();
	$related_post_location = get_theme_mod( 'related_posts_location', $defaults['related_posts_location']  );
	$location_hook 	  	   = $related_post_location === 'below' ? 'travel_monster_after_post_loop' : 'travel_monster_before_footer_post_loop';
	add_action( $location_hook, 'travel_monster_related_posts', 5 );
}
endif;
add_action( 'wp', 'travel_monster_related_post_location', 10 );

if( ! function_exists( 'travel_monster_comment' ) ) :
/**
 * Comments Template 
*/
function travel_monster_comment(){
	$defaults = travel_monster_get_general_defaults();
	$ed_single_comments = get_theme_mod( 'ed_single_comments', $defaults['ed_single_comments'] ); 

	// If comments are open or we have at least one comment, load up the comment template.
	if( $ed_single_comments && ( comments_open() || get_comments_number() ) ) :
		comments_template();
	endif;
}
endif;

if( ! function_exists( 'travel_monster_comment_location' ) ) :
/**
 * Comments Template Location
*/
function travel_monster_comment_location(){
	$defaults 		  = travel_monster_get_general_defaults();
	$comment_location = get_theme_mod( 'single_comment_location', $defaults['single_comment_location']  );
	$location_hook 	  = $comment_location === 'below' ? 'travel_monster_after_post_loop' : 'travel_monster_before_footer_post_loop';
	add_action( $location_hook, 'travel_monster_comment', 10 );
}
endif;
add_action( 'wp', 'travel_monster_comment_location', 10 );

if( ! function_exists( 'travel_monster_latest_posts' ) ) :
/**
 * Latest Posts
*/
function travel_monster_latest_posts(){ 
	$defaults       = travel_monster_get_general_defaults();
	$ed_latest_post = get_theme_mod( 'ed_latest_post', $defaults['ed_latest_post'] );
	
	if( $ed_latest_post ) travel_monster_get_posts_list( 'latest' );
}
endif;
add_action( 'travel_monster_latest_posts', 'travel_monster_latest_posts' );

if( ! function_exists( 'travel_monster_content_end' ) ) :
/**
 * Content End
*/
function travel_monster_content_end(){ 
	if( !is_404()){ ?>
				</div><!-- .main-content-wrapper -->
			</div><!-- .container -->
		</div><!-- .site-content -->
	<?php }
}
endif;
add_action( 'travel_monster_before_footer', 'travel_monster_content_end', 20 );

if( ! function_exists( 'travel_monster_footer_start' ) ) :
/**
 * Footer Start
*/
function travel_monster_footer_start(){ ?>
	<footer id="colophon" class="site-footer" <?php travel_monster_microdata( 'footer' ); ?>>
	<?php
}
endif;
add_action( 'travel_monster_footer', 'travel_monster_footer_start', 20 );

if( ! function_exists( 'travel_monster_footer_top' ) ) :
/**
 * Footer Top
*/
function travel_monster_footer_top(){   
	
	$footer_sidebars = array( 'footer-one', 'footer-two', 'footer-three', 'footer-four' );
	$active_sidebars = array();
	$col             = 0;

	foreach ( $footer_sidebars as $sidebar ) {
		if( is_active_sidebar( $sidebar ) ){
			array_push( $active_sidebars, $sidebar );
		}
	}
	
	$sidebar_count = count( $active_sidebars );
	switch( $sidebar_count ){
		case 1:
			$col = 12;
		break;
		case 2:
			$col = 6;
		break;
		case 3:
			$col = 4;
		break;
		case 4:
			$col = 3;
		break;
	}
					
	if( $active_sidebars ){ ?>
		<div class="footer-wrap-main">
			<div class="travel-monster-footer-adjs">
				<div class="container">
					<div class="travel-monster-flex travel-monster-col-<?php echo esc_attr( $col ); ?>">
						<?php foreach( $active_sidebars as $active ){ ?>
							<div class="travel-monster-foot-main-col">
								<?php dynamic_sidebar( $active ); ?>	
							</div>
						<?php } ?>
					</div>
				</div><!-- .container -->
			</div><!-- .travel-monster-footer-adjs -->
		</div><!-- .footer-wrap-main -->
		<?php 
	}
}
endif;
add_action( 'travel_monster_footer', 'travel_monster_footer_top', 30 );

if( ! function_exists( 'travel_monster_footer_bottom' ) ) :
/**
 * Footer Bottom
*/
function travel_monster_footer_bottom(){ ?>
	<div class="footer-b">
		<div class="container">             
			<div class="footer-b-wrap">
				<div class="site-info">
					<div class="footer-cop">
						<?php 
							travel_monster_get_footer_copyright();
							if( travel_monster_pro_is_activated() ){
								$partials = new Travel_Monster_Pro_Partials;
								$partials->travel_monster_pro_ed_author_link();
								$partials->travel_monster_pro_ed_wp_link();
							} else {
								echo '<span class="author-link">'.
								__( ' Travel Monster by ', 'travel-monster' ) .'
								<a href="' . esc_url( 'https://wptravelengine.com/' ) .'" rel="nofollow" target="_blank">' . esc_html__( 'WP Travel Engine', 'travel-monster' ) . '.</a></span>';
								printf( esc_html__( '%1$s Powered by %2$s%3$s', 'travel-monster' ), '<span class="wp-link">', '<a href="'. esc_url( 'https://wordpress.org/', 'travel-monster' ) .'" rel="nofollow" target="_blank">WordPress</a>.', '</span>' );
							}
						?> 
					</div>
					<?php if( has_nav_menu( 'footer' ) || current_user_can( 'manage_options' ) || function_exists( 'the_privacy_policy_link' ) ){ ?>
						<nav class="footer-inf">
							<?php
								wp_nav_menu( array(
									'theme_location' => 'footer',
									'menu_class'     => 'footer_menu',
									'fallback_cb'    => false,
								) );
								if ( function_exists( 'the_privacy_policy_link' ) ) {
									the_privacy_policy_link();
								}
							?>
						</nav><!-- Footer Privacy -->
					<?php }
					?>
				</div>
			</div>   
			<?php travel_monster_footer_payments(); ?>        
		</div>
	</div>			            
	<?php	
	
}
endif;
add_action( 'travel_monster_footer', 'travel_monster_footer_bottom', 40 );

if( ! function_exists( 'travel_monster_footer_end' ) ) :
/**
 * Footer End 
*/
function travel_monster_footer_end(){ ?>
	</footer><!-- #colophon -->
	<?php
}
endif;
add_action( 'travel_monster_footer', 'travel_monster_footer_end', 50 );

if( ! function_exists( 'travel_monster_scrolltotop' ) ) :
	/**
	 * Scroll To Top
	 */
	function travel_monster_scrolltotop(){
		$defaults    = travel_monster_get_general_defaults();
		$scrolltotop = get_theme_mod( 'ed_scroll_top', $defaults['ed_scroll_top'] );
		$scroll_top_alignment = get_theme_mod( 'scroll_top_alignment', $defaults['scroll_top_alignment'] );
		if( $scrolltotop ){ ?>
			<div class="to_top" data-align="<?php echo esc_attr( $scroll_top_alignment ); ?>">
				<span class="icon-arrow-up">
					<svg xmlns="http://www.w3.org/2000/svg" width="19.555" height="11.1" viewBox="0 0 19.555 11.1">
				  <g id="Group_5791" data-name="Group 5791" transform="translate(-1287.75 -692.239)">
					<g id="Group_5789" data-name="Group 5789" transform="translate(1 2.98)">
					  <rect id="Rectangle_1779" data-name="Rectangle 1779" width="2" height="13.698" rx="1" transform="translate(1295.205 690.672) rotate(-45)"/>
					</g>
					<rect id="Rectangle_1779-2" data-name="Rectangle 1779" width="2" height="13.698" rx="1" transform="translate(1297.436 692.239) rotate(45)"/>
				  </g>
				</svg>
				</span>
			</div>
			<?php
		}
	}
endif;
add_action( 'travel_monster_after_footer', 'travel_monster_scrolltotop', 20 );

if( ! function_exists( 'travel_monster_page_end' ) ) :
/**
 * Page End
*/
function travel_monster_page_end(){ ?>
		</div><!-- #page -->
	<?php
}
endif;
add_action( 'travel_monster_after_footer', 'travel_monster_page_end', 30 );