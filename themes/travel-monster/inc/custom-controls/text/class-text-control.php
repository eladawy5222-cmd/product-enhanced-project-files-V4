<?php
/**
 * Travel Monster Customizer Text Control.
 * 
 * @package Travel_Monster
*/

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if( ! class_exists( 'Travel_Monster_Text_Control' ) ){

	class Travel_Monster_Text_Control extends WP_Customize_Control {
		public $group;
		public $collapsed = true;
		public $type      = 'text';
        public $id;
        public $description = '';
		
		public function to_json() {
			parent::to_json();
            $this->json['settings'] = array();
            foreach ( $this->settings as $key => $setting ) {
                $this->json['settings'][ $key ] = $setting->id;
            }
			$this->json['group']       = $this->group;
			$this->json['collapsed']   = $this->collapsed;
			$this->json['type']        = $this->type;
			$this->json['description'] = $this->description;
		}

		public function render_content(){
            $input_id       = '_customize-input-' . $this->id;
            $description_id = '_customize-description-' . $this->id;
            $describedby_attr = ( ! empty( $this->description ) ) ? ' aria-describedby="' . esc_attr( $description_id ) . '" ' : '';
         ?>
			<div class="<?php if ( $this->collapsed !== true ) echo 'is-active'; if ( $this->group ) echo '_' . $this->group; ?>">

                <?php
                    switch ( $this->type ) {
                        case 'text':
                            ?>
                            <?php if ( ! empty( $this->label ) ) : ?>
                                <label for="<?php echo esc_attr( $input_id ); ?>" class="customize-control-title"><?php echo esc_html( $this->label ); ?></label>
                            <?php endif; ?>
                            <?php if ( ! empty( $this->description ) ) : ?>
                                <span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo wp_kses_post( $this->description ); ?></span>
                            <?php endif; ?>
                            <input
                                type="text"
                                id="<?php echo esc_attr( $input_id ); ?>"
                                value="<?php echo esc_attr( $this->value() ); ?>"
                                <?php $this->link(); ?>
                            >
                            <?php 
                            break;
                        case 'textarea':
                            ?>
                            <?php if ( ! empty( $this->label ) ) : ?>
                                <label for="<?php echo esc_attr( $input_id ); ?>" class="customize-control-title"><?php echo esc_html( $this->label ); ?></label>
                            <?php endif; ?>
                            <?php if ( ! empty( $this->description ) ) : ?>
                                <span id="<?php echo esc_attr( $description_id ); ?>" class="description customize-control-description"><?php echo $this->description; ?></span>
                            <?php endif; ?>
                            <textarea
                                id="<?php echo esc_attr( $input_id ); ?>"
                                rows="5"
                                <?php echo $describedby_attr; ?>
                                <?php $this->input_attrs(); ?>
                                <?php $this->link(); ?>
                            ><?php echo esc_textarea( $this->value() ); ?></textarea>
                            <?php
                            break;
                    }
                ?>
                
            </div>
            <?php 
        }
	}
}