<?php 
/**
* Travel Monster Metabox for Sidebar Layout
*
* @package Travel Monster
*
*/ 

function travel_monster_add_sidebar_layout_box(){

    $post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;

    /**
     * Check template only for existing posts.
     * For new posts, always show the metabox.
    */
    if ( $post_id ) {
        $template  = get_post_meta( $post_id, '_wp_page_template', true );
        $templates = array( 'templates/template-destination.php', 'templates/template-activities.php', 'templates/template-trip_types.php' );

        /**
         * Remove sidebar metabox in specific page template.
        */
        if ( in_array( $template, $templates ) ) {
            return;
        }
    }

    add_meta_box(
        'travel_monster_sidebar_layout',
        __( 'Sidebar Layout', 'travel-monster' ),
        'travel_monster_sidebar_layout_callback',
        array( 'page', 'post' ),
        'normal',
        'high'
    );
}
add_action( 'add_meta_boxes', 'travel_monster_add_sidebar_layout_box' );

if( ! function_exists( 'travel_monster_get_sidebar_layout_data' ) ){
    function travel_monster_get_sidebar_layout_data(){
        return array(    
            'default-sidebar'=> array(
                 'value'     => 'default-sidebar',
                 'label'     => __( 'Default Sidebar', 'travel-monster' ),
                 'thumbnail' => get_template_directory_uri() . '/images/default-sidebar.png'
               ),
            'right-sidebar' => array(
                 'value'     => 'right-sidebar',
                 'label'     => __( 'Right Sidebar', 'travel-monster' ),
                 'thumbnail' => get_template_directory_uri() . '/images/right-sidebar.png'
            ),
            'left-sidebar' => array(
                'value'     => 'left-sidebar',
                'label'     => __( 'Left Sidebar', 'travel-monster' ),
                'thumbnail' => get_template_directory_uri() . '/images/left-sidebar.png'
            ),
            'no-sidebar'     => array(
                'value'     => 'no-sidebar',
                'label'     => __( 'Full Width', 'travel-monster' ),
                'thumbnail' => get_template_directory_uri() . '/images/full-width.png'
            ),
            'fullwidth-centered' => array(
                'value'     => 'fullwidth-centered',
                'label'     => __( 'Full Width Centered', 'travel-monster' ),
                'thumbnail' => get_template_directory_uri() . '/images/full-width-centered.png'
            )
        );
    }
}


function travel_monster_sidebar_layout_callback(){
    global $post;
    $travel_monster_sidebar_layout = travel_monster_get_sidebar_layout_data();
    wp_nonce_field( basename( __FILE__ ), 'travel_monster_nonce' ); 
    if( get_post_meta( $post->ID, '_travel_monster_sidebar_layout', true ) ){
        $layout = get_post_meta( $post->ID, '_travel_monster_sidebar_layout', true );
    }else{
        $layout = 'default-sidebar';
    }
    ?>     
    <table class="form-table">
        <tr>
            <td colspan="4"><em class="f13"><?php esc_html_e( 'Choose Sidebar Template', 'travel-monster' ); ?></em></td>
        </tr>    
        <tr>
            <td>
                <?php  
                    foreach( $travel_monster_sidebar_layout as $field ){ ?>
                        <div class="hide-radio radio-image-wrapper" style="float:left; margin-right:30px;">
                            <input id="<?php echo esc_attr( $field['value'] ); ?>" type="radio" name="travel_monster_sidebar_layout" value="<?php echo esc_attr( $field['value'] ); ?>" <?php checked( $layout, $field['value'] ); ?>/>
                            <label class="description" for="<?php echo esc_attr( $field['value'] ); ?>">
                                <img src="<?php echo esc_url( $field['thumbnail'] ); ?>" alt="<?php echo esc_attr( $field['label'] ); ?>" />                               
                            </label>
                        </div>
                        <?php 
                    } // end foreach 
                ?>
                <div class="clear"></div>
            </td>
        </tr>
    </table>
 <?php 
}

function travel_monster_save_sidebar_layout( $post_id ){
    $travel_monster_sidebar_layout = travel_monster_get_sidebar_layout_data();

    // Verify the nonce before proceeding.
    if( !isset( $_POST[ 'travel_monster_nonce' ] ) || !wp_verify_nonce( $_POST[ 'travel_monster_nonce' ], basename( __FILE__ ) ) )
        return;
    
    // Stop WP from clearing custom fields on autosave
    if( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE )  
        return;

    $post_type = isset( $_POST['post_type'] ) ? sanitize_key( $_POST['post_type'] ) : '';
    if( 'page' === $post_type ){  
        if( ! current_user_can( 'edit_page', $post_id ) ) return $post_id;  
    }elseif( ! current_user_can( 'edit_post', $post_id ) ){  
        return $post_id;  
    }
    
    $layout = isset( $_POST['travel_monster_sidebar_layout'] ) ? sanitize_key( $_POST['travel_monster_sidebar_layout'] ) : 'default-sidebar';

    if( array_key_exists( $layout, $travel_monster_sidebar_layout ) ){
        update_post_meta( $post_id, '_travel_monster_sidebar_layout', $layout );
    }else{
        delete_post_meta( $post_id, '_travel_monster_sidebar_layout' );
    }   
}
add_action( 'save_post' , 'travel_monster_save_sidebar_layout' );