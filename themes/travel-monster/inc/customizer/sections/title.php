<?php
/**
 * Title Setting
 *
 * @package Travel Monster
 */

function travel_monster_customize_register_titleofcustomizer_section( $wp_customize ) {

    $wp_customize->add_section(
		new Travel_Monster_Group_Title(
			$wp_customize,
			'core',
            array(
                'title'    => __( 'Core', 'travel-monster' ),
                'priority' => 99,
            )
		)
	);

	$wp_customize->add_section(
		new Travel_Monster_Group_Title(
			$wp_customize,
			'general',
            array(
                'title' => __( 'General Settings', 'travel-monster' ),
				'priority' => 5,
            )
		)
	);

	$wp_customize->add_section(
		new Travel_Monster_Group_Title(
			$wp_customize,
			'posts',
            array(
                'title' => __( 'Posts & Pages', 'travel-monster' ),
				'priority' => 61,
            )
		)
	);

	if( travel_monster_pro_is_activated() ){
		$wp_customize->add_section(
			new Travel_Monster_Group_Title(
				$wp_customize,
				'misc_settings',
				array(
					'title' => __( 'Misc Settings', 'travel-monster' ),
					'priority' => 90,
				)
			)
		);
	}

}
add_action( 'customize_register', 'travel_monster_customize_register_titleofcustomizer_section' );