<?php
/**
 * Group title
 *
 * @package Travel Monster
 */

/**
 * Implement group title
 */
class Travel_Monster_Group_Title extends WP_Customize_Section {
	/**
	 * Type of this section.
	 *
	 * @var string
	 */
	public $type = 'travel-monster-group-title';

	/**
	 * Special categorization for the section.
	 *
	 * @var string
	 */
	public $kind = 'default';
	

	/**
	 * Output
	 */
	public function render() {
		$description = $this->description;
		?>
		<li id="accordion-section-<?php echo esc_attr( $this->id ); ?>" class="accordion-section travel-monster-group-title">
			<h3><?php echo esc_html( $this->title ); ?></h3>
			<?php if ( ! empty( $description ) ) { ?>
				<span class="description"><?php echo esc_html( $description ); ?></span>
			<?php } ?>
		</li>
		<?php
	}
}
