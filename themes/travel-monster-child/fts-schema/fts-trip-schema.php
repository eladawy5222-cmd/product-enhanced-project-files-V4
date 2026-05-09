<?php
/**
 * FTS Trip Schema — Single source of truth for JSON-LD on single trip pages.
 *
 * Builds a complete @graph with TouristTrip, AggregateOffer, AggregateRating
 * (conditional), Review[] (conditional), FAQPage (conditional), Organization,
 * BreadcrumbList, and TouristAttraction nodes for matched landmarks.
 *
 * Suppresses competing emitters on trip URLs:
 *   - Rank Math auto-Product/WebPage/BreadcrumbList/Organization
 *   - WTE Trip Reviews schema-data-inc.php (broken AggregateRating when count=0)
 *
 * Currency in the schema is ALWAYS the base DB currency, never the visitor's
 * cookie currency.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// DIAGNOSTIC: prove the file was included on every page render. Look for
// `FTS_SCHEMA_FILE_LOADED` in view-source. Remove after the module is verified.
add_action( 'wp_head', function() {
	echo "\n<!-- FTS_SCHEMA_FILE_LOADED at " . esc_html( gmdate( 'c' ) ) . " -->\n";
}, 0 );

if ( class_exists( 'FTS_Trip_Schema' ) ) return;

class FTS_Trip_Schema {

	/**
	 * Hard-coded landmark → [latitude, longitude] lookup. The ONLY hard-coded
	 * data in this module. Names are matched case-insensitively against
	 * itinerary titles, itinerary descriptions, the trip title, and the trip
	 * descriptions.
	 */
	const LANDMARK_GEO = array(
		'Pyramids of Giza'       => array( 29.9792, 31.1342 ),
		'Great Sphinx'           => array( 29.9753, 31.1376 ),
		'Sphinx'                 => array( 29.9753, 31.1376 ),
		'Grand Egyptian Museum'  => array( 29.9919, 31.1192 ),
		'Khan el-Khalili Bazaar' => array( 30.0477, 31.2625 ),
		'Khan el-Khalili'        => array( 30.0477, 31.2625 ),
		'Cairo Airport'          => array( 30.1219, 31.4056 ),
		'Hurghada Airport'       => array( 27.1783, 33.7994 ),
	);

	private static $matched_landmarks_cache = array();

	/* ─────────────────────────────────────────────
	   Bootstrap
	   ───────────────────────────────────────────── */

	public static function init() {
		add_filter( 'rank_math/json_ld', array( __CLASS__, 'disable_rank_math_for_trip' ), 99, 2 );
		add_action( 'template_redirect', array( __CLASS__, 'disable_wte_review_schema' ), 1 );
		add_action( 'wp_head', array( __CLASS__, 'output_schema' ), 1 );
	}

	/**
	 * Strip Rank Math's auto JSON-LD on trip URLs only — we emit our own
	 * complete graph (Product/WebPage/BreadcrumbList/Organization included).
	 */
	public static function disable_rank_math_for_trip( $data, $jsonld ) {
		if ( is_singular( 'trip' ) ) {
			return array();
		}
		return $data;
	}

	/**
	 * Strip the WTE Trip Reviews JSON-LD emitter on trip URLs. The plugin
	 * dispatches its broken AggregateRating script via the
	 * `wte_trip_review_schema_json` action from four call sites; removing all
	 * actions on that hook silences every one without touching plugin files.
	 */
	public static function disable_wte_review_schema() {
		if ( is_singular( 'trip' ) ) {
			remove_all_actions( 'wte_trip_review_schema_json' );
		}
	}

	public static function output_schema() {
		// Always emit a heartbeat so we can verify the hook fired even if we
		// bail early. Look for `<!-- FTS Trip Schema:` in view-source.
		$queried   = get_queried_object();
		$post_type = $queried && isset( $queried->post_type ) ? $queried->post_type : 'unknown';
		echo "\n<!-- FTS Trip Schema: hook fired, is_singular_trip=" . ( is_singular( 'trip' ) ? 'yes' : 'no' )
			. ", post_type={$post_type} -->\n";

		if ( ! is_singular( 'trip' ) ) return;

		try {
			$trip_id = (int) get_queried_object_id();
			if ( $trip_id <= 0 ) {
				echo "<!-- FTS Trip Schema: queried_object_id is 0, bailing -->\n";
				return;
			}

			$graph = self::build_graph( $trip_id );
			if ( empty( $graph ) ) {
				echo "<!-- FTS Trip Schema: graph is empty, bailing -->\n";
				return;
			}

			$payload = array(
				'@context' => 'https://schema.org',
				'@graph'   => $graph,
			);

			$json = wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT );
			if ( $json === false ) {
				echo "<!-- FTS Trip Schema: wp_json_encode failed -->\n";
				return;
			}

			echo "<!-- FTS Trip Schema: emitting JSON-LD -->\n";
			echo '<script type="application/ld+json">' . "\n";
			echo $json;
			echo "\n</script>\n";
		} catch ( \Throwable $e ) {
			echo "<!-- FTS Trip Schema ERROR: " . esc_html( $e->getMessage() ) . " in " . esc_html( basename( $e->getFile() ) ) . ':' . (int) $e->getLine() . " -->\n";
			error_log( 'FTS Trip Schema error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
		}
	}

	/* ─────────────────────────────────────────────
	   Graph assembly
	   ───────────────────────────────────────────── */

	private static function build_graph( $trip_id ) {
		$data  = self::get_trip_data( $trip_id );
		$graph = array();

		$trip_node = self::build_tourist_trip( $data );
		if ( $trip_node ) $graph[] = $trip_node;

		$agg_offer = self::build_aggregate_offer( $data );
		if ( $agg_offer ) $graph[] = $agg_offer;

		$agg_rating = self::build_aggregate_rating( $data );
		if ( $agg_rating ) $graph[] = $agg_rating;

		foreach ( self::build_reviews( $data ) as $review_node ) {
			$graph[] = $review_node;
		}

		$faq = self::build_faq_page( $data );
		if ( $faq ) $graph[] = $faq;

		$org = self::build_organization();
		if ( $org ) $graph[] = $org;

		$breadcrumbs = self::build_breadcrumbs( $data );
		if ( $breadcrumbs ) $graph[] = $breadcrumbs;

		foreach ( self::build_places( $data ) as $place_node ) {
			$graph[] = $place_node;
		}

		return array_values( array_filter( $graph ) );
	}

	/* ─────────────────────────────────────────────
	   Centralized data fetcher
	   ───────────────────────────────────────────── */

	private static function get_trip_data( $trip_id ) {
		$settings = get_post_meta( $trip_id, 'wp_travel_engine_setting', true );
		if ( ! is_array( $settings ) ) $settings = array();

		$permalink = get_permalink( $trip_id );
		$title     = self::decode_text( get_the_title( $trip_id ) );

		// Description: post_excerpt → fallback to tab_content[1_wpeditor]
		$short = self::decode_strip( get_post_field( 'post_excerpt', $trip_id ) );
		$long  = '';
		$tab_overview = $settings['tab_content']['1_wpeditor'] ?? '';
		if ( ! empty( trim( strip_tags( (string) $tab_overview ) ) ) ) {
			$long = self::decode_strip( $tab_overview );
			if ( strlen( $long ) > 5000 ) {
				$long = mb_substr( $long, 0, 4997 ) . '...';
			}
		}
		$description = $short !== '' ? $short : $long;

		// Images — featured first, then gallery (deduped)
		$images       = array();
		$featured_id  = (int) get_post_thumbnail_id( $trip_id );
		if ( $featured_id ) {
			$u = wp_get_attachment_image_url( $featured_id, 'full' );
			if ( $u ) $images[] = $u;
		}
		$gallery_meta = get_post_meta( $trip_id, 'wpte_gallery_id', true );
		if ( is_array( $gallery_meta ) ) {
			$enabled = ! isset( $gallery_meta['enable'] ) || ! empty( $gallery_meta['enable'] );
			unset( $gallery_meta['enable'] );
			if ( $enabled ) {
				foreach ( $gallery_meta as $gid ) {
					$gid = (int) $gid;
					if ( ! $gid ) continue;
					$u = wp_get_attachment_image_url( $gid, 'full' );
					if ( $u && ! in_array( $u, $images, true ) ) $images[] = $u;
				}
			}
		}

		// Duration (ISO 8601)
		$duration_iso = self::iso8601_duration(
			$settings['trip_duration']      ?? '',
			$settings['trip_duration_unit'] ?? ''
		);

		// Tourist type (activities + trip_types)
		$tourist_type = array();
		foreach ( array( 'activities', 'trip_types' ) as $tax ) {
			$terms = wp_get_post_terms( $trip_id, $tax, array( 'fields' => 'names' ) );
			if ( is_array( $terms ) && ! is_wp_error( $terms ) ) {
				foreach ( $terms as $name ) {
					$clean = self::decode_text( $name );
					if ( $clean !== '' && ! in_array( $clean, $tourist_type, true ) ) {
						$tourist_type[] = $clean;
					}
				}
			}
		}

		// Itinerary
		$itin_titles  = isset( $settings['itinerary']['itinerary_title'] )   && is_array( $settings['itinerary']['itinerary_title'] )   ? $settings['itinerary']['itinerary_title']   : array();
		$itin_content = isset( $settings['itinerary']['itinerary_content'] ) && is_array( $settings['itinerary']['itinerary_content'] ) ? $settings['itinerary']['itinerary_content'] : array();

		// Cost includes — split by newline
		$includes = array();
		$includes_raw = $settings['cost']['cost_includes'] ?? '';
		if ( is_string( $includes_raw ) && $includes_raw !== '' ) {
			foreach ( preg_split( '/\r\n|[\r\n]/', $includes_raw ) as $line ) {
				$line = self::decode_text( $line );
				if ( $line !== '' ) $includes[] = $line;
			}
		}

		// Trip facts → PropertyValue list
		$facts = array();
		$trip_facts_raw = $settings['trip_facts'] ?? array();
		if ( is_array( $trip_facts_raw ) ) {
			$field_names = is_array( $trip_facts_raw['field_id'] ?? null ) ? $trip_facts_raw['field_id'] : array();
			foreach ( $trip_facts_raw as $key => $val ) {
				if ( in_array( (string) $key, array( 'field_id', 'field_type', 'field_name' ), true ) ) continue;
				if ( ! is_array( $val ) ) continue;
				$value = '';
				foreach ( $val as $vv ) {
					if ( is_string( $vv ) || is_numeric( $vv ) ) {
						$value = (string) $vv;
						break;
					}
				}
				$name  = self::decode_text( (string) ( $field_names[ $key ] ?? '' ) );
				$value = self::decode_text( $value );
				if ( $name === '' || $value === '' ) continue;
				$facts[] = array( 'name' => $name, 'value' => $value );
			}
		}

		// Pax — current schema uses trip_min_pax / trip_max_pax; legacy uses trip_minimum_pax / trip_maximum_pax
		$min_pax = isset( $settings['trip_min_pax'] ) ? (int) $settings['trip_min_pax'] : 0;
		$max_pax = isset( $settings['trip_max_pax'] ) ? (int) $settings['trip_max_pax'] : 0;
		if ( ! $min_pax && isset( $settings['trip_minimum_pax'] ) ) $min_pax = (int) $settings['trip_minimum_pax'];
		if ( ! $max_pax && isset( $settings['trip_maximum_pax'] ) ) $max_pax = (int) $settings['trip_maximum_pax'];

		// Packages
		$package_ids = $settings['packages_ids'] ?? array();
		if ( ! is_array( $package_ids ) ) $package_ids = array();
		$package_ids = array_values( array_filter( array_map( 'intval', $package_ids ) ) );

		// FAQ
		$faq_titles  = isset( $settings['faq']['faq_title'] )   && is_array( $settings['faq']['faq_title'] )   ? $settings['faq']['faq_title']   : array();
		$faq_content = isset( $settings['faq']['faq_content'] ) && is_array( $settings['faq']['faq_content'] ) ? $settings['faq']['faq_content'] : array();

		// Reviews — approved + parent=0, with author/date/title enrichment
		$reviews_data = self::fetch_reviews( $trip_id );

		// Currency — base, never cookie
		$wte_opts = get_option( 'wp_travel_engine_settings', array() );
		$currency = is_array( $wte_opts ) && ! empty( $wte_opts['currency_code'] ) ? (string) $wte_opts['currency_code'] : 'USD';
		if ( $currency === '' ) $currency = 'USD';

		// Destination chain (parent → child)
		$dest_chain = array();
		$destination_terms = wp_get_post_terms( $trip_id, 'destination', array( 'fields' => 'all' ) );
		if ( is_array( $destination_terms ) && ! is_wp_error( $destination_terms ) && ! empty( $destination_terms ) ) {
			usort( $destination_terms, function( $a, $b ) {
				return count( get_ancestors( $a->term_id, 'destination' ) )
					 - count( get_ancestors( $b->term_id, 'destination' ) );
			} );
			foreach ( $destination_terms as $dt ) {
				$url = get_term_link( $dt );
				$dest_chain[] = array(
					'name' => self::decode_text( $dt->name ),
					'url'  => is_wp_error( $url ) ? '' : (string) $url,
				);
			}
		}

		// Available languages (WPML)
		$available_languages = array( 'en' );
		if ( has_filter( 'wpml_active_languages' ) ) {
			$langs = apply_filters( 'wpml_active_languages', null, array( 'skip_missing' => 1 ) );
			if ( is_array( $langs ) && ! empty( $langs ) ) {
				$codes = array();
				foreach ( $langs as $lang ) {
					if ( is_array( $lang ) && ! empty( $lang['language_code'] ) ) {
						$codes[] = (string) $lang['language_code'];
					}
				}
				if ( ! empty( $codes ) ) $available_languages = array_values( array_unique( $codes ) );
			}
		}

		// Validity / publish dates
		$expiry = (string) get_post_meta( $trip_id, 'trip_expiry_date', true );
		$post_date_gmt = get_post_field( 'post_date_gmt', $trip_id );
		if ( $post_date_gmt === '' || $post_date_gmt === '0000-00-00 00:00:00' ) {
			$post_date_gmt = get_post_field( 'post_date', $trip_id );
		}
		$valid_from = $post_date_gmt ? mysql2date( 'c', $post_date_gmt, false ) : '';

		return array(
			'trip_id'             => (int) $trip_id,
			'permalink'           => $permalink,
			'title'               => $title,
			'description'         => $description,
			'short_description'   => $short,
			'long_description'    => $long,
			'images'              => $images,
			'duration_iso'        => $duration_iso,
			'tourist_type'        => $tourist_type,
			'itin_titles'         => $itin_titles,
			'itin_content'        => $itin_content,
			'includes'            => $includes,
			'facts'               => $facts,
			'min_pax'             => $min_pax,
			'max_pax'             => $max_pax,
			'package_ids'         => $package_ids,
			'faq_titles'          => $faq_titles,
			'faq_content'         => $faq_content,
			'reviews_data'        => $reviews_data,
			'currency'            => $currency,
			'dest_chain'          => $dest_chain,
			'available_languages' => $available_languages,
			'expiry'              => $expiry,
			'valid_from'          => $valid_from,
		);
	}

	/* ─────────────────────────────────────────────
	   Builders
	   ───────────────────────────────────────────── */

	private static function build_tourist_trip( $d ) {
		if ( ! $d['permalink'] || $d['title'] === '' ) return null;

		$node = array(
			'@type' => 'TouristTrip',
			'@id'   => $d['permalink'] . '#trip',
			'name'  => $d['title'],
			'url'   => $d['permalink'],
		);

		if ( $d['description'] !== '' )       $node['description'] = $d['description'];
		if ( ! empty( $d['images'] ) )        $node['image']       = count( $d['images'] ) === 1 ? $d['images'][0] : $d['images'];
		if ( $d['duration_iso'] !== '' )      $node['duration']    = $d['duration_iso'];

		if ( ! empty( $d['tourist_type'] ) ) {
			$node['touristType'] = count( $d['tourist_type'] ) === 1 ? $d['tourist_type'][0] : $d['tourist_type'];
		}

		$node['inLanguage'] = 'en';
		if ( ! empty( $d['available_languages'] ) ) {
			$node['availableLanguage'] = count( $d['available_languages'] ) === 1
				? $d['available_languages'][0]
				: $d['available_languages'];
		}

		// Itinerary as ItemList
		if ( ! empty( $d['itin_titles'] ) ) {
			$items    = array();
			$position = 1;
			foreach ( $d['itin_titles'] as $key => $raw_title ) {
				$name = self::decode_text( $raw_title );
				$desc = self::decode_strip( $d['itin_content'][ $key ] ?? '' );
				if ( $name === '' && $desc === '' ) continue;

				$list_item = array(
					'@type'    => 'ListItem',
					'position' => $position,
				);

				$place_id = self::find_landmark_id_in_text( $d['permalink'], $name . ' ' . $desc );
				if ( $place_id ) {
					$attraction = array(
						'@type' => 'TouristAttraction',
						'@id'   => $place_id,
						'name'  => $name !== '' ? $name : $desc,
					);
					if ( $desc !== '' ) $attraction['description'] = $desc;
					$list_item['item'] = $attraction;
				} else {
					if ( $name !== '' ) $list_item['name'] = $name;
					if ( $desc !== '' ) $list_item['description'] = $desc;
				}

				$items[] = $list_item;
				$position++;
			}
			if ( ! empty( $items ) ) {
				$node['itinerary'] = array(
					'@type'           => 'ItemList',
					'numberOfItems'   => count( $items ),
					'itemListElement' => $items,
				);
			}
		}

		// Includes
		if ( ! empty( $d['includes'] ) ) {
			$list = array();
			foreach ( $d['includes'] as $inc ) {
				$list[] = array( '@type' => 'Thing', 'name' => $inc );
			}
			$node['includesObject'] = $list;
		}

		// Trip facts → additionalProperty
		if ( ! empty( $d['facts'] ) ) {
			$props = array();
			foreach ( $d['facts'] as $fact ) {
				$props[] = array(
					'@type' => 'PropertyValue',
					'name'  => $fact['name'],
					'value' => $fact['value'],
				);
			}
			$node['additionalProperty'] = $props;
		}

		$node['provider'] = array( '@id' => home_url( '/' ) . '#organization' );

		if ( ! empty( $d['package_ids'] ) ) {
			$node['offers'] = array( '@id' => $d['permalink'] . '#aggregateoffer' );
		}

		if ( ! empty( $d['faq_titles'] ) ) {
			$node['subjectOf'] = array( '@id' => $d['permalink'] . '#faq' );
		}

		if ( ! empty( $d['reviews_data']['count'] ) ) {
			$node['aggregateRating'] = array( '@id' => $d['permalink'] . '#aggregaterating' );
		}

		return $node;
	}

	private static function build_aggregate_offer( $d ) {
		if ( empty( $d['package_ids'] ) ) {
			return null;
		}

		$low_effective = null; // min sale-or-regular across all categories
		$high_regular  = null; // max regular across all categories
		$pkg_offers    = array();

		foreach ( $d['package_ids'] as $pkg_id ) {
			if ( get_post_status( $pkg_id ) !== 'publish' ) continue;

			$cats_raw = get_post_meta( $pkg_id, 'package-categories', true );
			if ( ! is_array( $cats_raw ) || empty( $cats_raw['c_ids'] ) ) continue;

			$c_ids        = (array) $cats_raw['c_ids'];
			$labels       = (array) ( $cats_raw['labels']        ?? array() );
			$regular      = (array) ( $cats_raw['prices']        ?? array() );
			$sale         = (array) ( $cats_raw['sale_prices']   ?? array() );
			$enabled_sale = (array) ( $cats_raw['enabled_sale']  ?? array() );

			$adult_price       = null;
			$lowest_in_package = null;

			foreach ( $c_ids as $idx => $cid ) {
				$reg = isset( $regular[ $idx ] ) ? (float) $regular[ $idx ] : 0.0;
				$sal = isset( $sale[ $idx ] )    ? (float) $sale[ $idx ]    : 0.0;
				$has_sale = ! empty( $enabled_sale[ $idx ] ) && $sal > 0 && $sal < $reg;
				$eff = $has_sale ? $sal : $reg;

				if ( $reg > 0 && ( $high_regular === null || $reg > $high_regular ) ) {
					$high_regular = $reg;
				}
				if ( $eff > 0 && ( $low_effective === null || $eff < $low_effective ) ) {
					$low_effective = $eff;
				}
				if ( $eff > 0 && ( $lowest_in_package === null || $eff < $lowest_in_package ) ) {
					$lowest_in_package = $eff;
				}

				$label_lc = strtolower( (string) ( $labels[ $idx ] ?? '' ) );
				if ( $adult_price === null && $eff > 0 && strpos( $label_lc, 'adult' ) !== false ) {
					$adult_price = $eff;
				}
			}

			$price_for_offer = $adult_price !== null ? $adult_price : $lowest_in_package;
			if ( $price_for_offer === null || $price_for_offer <= 0 ) continue;

			$pkg_offers[] = array(
				'@type'         => 'Offer',
				'name'          => self::decode_text( get_the_title( $pkg_id ) ),
				'price'         => self::format_price( $price_for_offer ),
				'priceCurrency' => $d['currency'],
				'availability'  => 'https://schema.org/InStock',
				'url'           => $d['permalink'],
			);
		}

		if ( $low_effective === null && $high_regular === null && empty( $pkg_offers ) ) {
			return null;
		}

		$node = array(
			'@type'         => 'AggregateOffer',
			'@id'           => $d['permalink'] . '#aggregateoffer',
			'priceCurrency' => $d['currency'],
			'availability'  => 'https://schema.org/InStock',
			'url'           => $d['permalink'],
		);
		if ( $low_effective !== null ) $node['lowPrice']  = self::format_price( $low_effective );
		if ( $high_regular !== null )  $node['highPrice'] = self::format_price( $high_regular );
		if ( ! empty( $pkg_offers ) ) {
			$node['offerCount'] = count( $pkg_offers );
			$node['offers']     = $pkg_offers;
		}
		if ( $d['valid_from'] !== '' ) $node['validFrom']        = $d['valid_from'];
		if ( $d['expiry'] !== '' )     $node['priceValidUntil']  = $d['expiry'];

		if ( $d['min_pax'] > 0 || $d['max_pax'] > 0 ) {
			$eq = array( '@type' => 'QuantitativeValue', 'unitText' => 'person' );
			if ( $d['min_pax'] > 0 ) $eq['minValue'] = $d['min_pax'];
			if ( $d['max_pax'] > 0 ) $eq['maxValue'] = $d['max_pax'];
			$node['eligibleQuantity'] = $eq;
		}

		return $node;
	}

	private static function build_aggregate_rating( $d ) {
		$rd = $d['reviews_data'];
		if ( empty( $rd['count'] ) ) return null;

		$avg = (float) $rd['average'];
		return array(
			'@type'        => 'AggregateRating',
			'@id'          => $d['permalink'] . '#aggregaterating',
			'itemReviewed' => array( '@id' => $d['permalink'] . '#trip' ),
			'ratingValue'  => (string) round( $avg, 1 ),
			'reviewCount'  => (int) $rd['count'],
			'bestRating'   => '5',
			'worstRating'  => '1',
		);
	}

	private static function build_reviews( $d ) {
		$out = array();
		$reviews = $d['reviews_data']['reviews'] ?? array();
		if ( empty( $reviews ) ) return $out;

		$reviews = array_slice( $reviews, 0, 10 );
		foreach ( $reviews as $r ) {
			$stars = (int) ( $r['stars'] ?? 0 );
			if ( $stars < 1 ) continue;

			$body  = self::decode_strip( $r['content'] ?? '' );
			$node  = array(
				'@type'        => 'Review',
				'itemReviewed' => array( '@id' => $d['permalink'] . '#trip' ),
				'author'       => array(
					'@type' => 'Person',
					'name'  => self::decode_text( $r['author_name'] ?? __( 'Anonymous', 'fts' ) ),
				),
				'reviewRating' => array(
					'@type'       => 'Rating',
					'ratingValue' => (string) $stars,
					'bestRating'  => '5',
					'worstRating' => '1',
				),
			);
			if ( ! empty( $r['date'] ) )  $node['datePublished'] = $r['date'];
			if ( ! empty( $r['title'] ) ) $node['name']          = self::decode_text( $r['title'] );
			if ( $body !== '' )           $node['reviewBody']    = $body;

			$out[] = $node;
		}
		return $out;
	}

	private static function build_faq_page( $d ) {
		if ( empty( $d['faq_titles'] ) ) return null;

		$main = array();
		foreach ( $d['faq_titles'] as $k => $q_raw ) {
			$q = self::decode_text( $q_raw );
			$a = self::decode_strip( $d['faq_content'][ $k ] ?? '' );
			if ( $q === '' || $a === '' ) continue;
			$main[] = array(
				'@type'          => 'Question',
				'name'           => $q,
				'acceptedAnswer' => array(
					'@type' => 'Answer',
					'text'  => $a,
				),
			);
		}
		if ( empty( $main ) ) return null;

		return array(
			'@type'      => 'FAQPage',
			'@id'        => $d['permalink'] . '#faq',
			'mainEntity' => $main,
		);
	}

	private static function build_organization() {
		$node = array(
			'@type' => array( 'Organization', 'TravelAgency' ),
			'@id'   => home_url( '/' ) . '#organization',
			'name'  => self::clean_org_name( get_bloginfo( 'name' ) ),
			'url'   => home_url( '/' ),
		);

		$slogan = self::decode_text( get_bloginfo( 'description' ) );
		if ( $slogan !== '' ) $node['slogan'] = $slogan;

		$logo_id = (int) get_theme_mod( 'custom_logo' );
		if ( $logo_id ) {
			$logo_url = wp_get_attachment_image_url( $logo_id, 'full' );
			if ( $logo_url ) {
				$logo = array( '@type' => 'ImageObject', 'url' => $logo_url );
				$meta = wp_get_attachment_metadata( $logo_id );
				if ( is_array( $meta ) ) {
					if ( ! empty( $meta['width'] ) )  $logo['width']  = (int) $meta['width'];
					if ( ! empty( $meta['height'] ) ) $logo['height'] = (int) $meta['height'];
				}
				$node['logo'] = $logo;
				$node['image'] = $logo_url;
			}
		}
		if ( empty( $node['image'] ) ) {
			$site_icon = get_site_icon_url( 512 );
			if ( is_string( $site_icon ) && $site_icon !== '' ) {
				$node['image'] = $site_icon;
			}
		}

		// Email — first valid address from WTE booking emails
		$wte_opts = get_option( 'wp_travel_engine_settings', array() );
		if ( is_array( $wte_opts ) && ! empty( $wte_opts['email']['emails'] ) ) {
			$first = trim( explode( ',', (string) $wte_opts['email']['emails'] )[0] );
			if ( is_email( $first ) ) $node['email'] = $first;
		}

		// Phone — best-effort scan of common option keys; omit if empty
		$phone_keys = array(
			'fts_company_phone', 'fts_phone_number', 'fts_phone',
			'company_phone', 'contact_phone', 'admin_phone',
		);
		foreach ( $phone_keys as $pk ) {
			$val = trim( (string) get_option( $pk, '' ) );
			if ( $val !== '' ) {
				$node['telephone'] = $val;
				break;
			}
		}
		if ( empty( $node['telephone'] ) ) {
			$node['telephone'] = '+201000479285';
		}

		$addr_raw = trim( (string) get_option( 'fts_company_address', '13H W/5, El Menshawy Street, Takseem El Lasilky, Maadi District, Cairo Governorate, 11824, Egypt' ) );
		if ( $addr_raw !== '' ) {
			$node['address'] = array(
				'@type'           => 'PostalAddress',
				'streetAddress'   => $addr_raw,
				'addressLocality' => 'Cairo',
				'addressRegion'   => 'Cairo Governorate',
				'postalCode'      => '11824',
				'addressCountry'  => 'EG',
			);
		}
		$node['priceRange'] = '€';

		// Social URLs from theme mods (best-effort, conservative)
		$same_as = self::collect_social_urls();
		if ( ! empty( $same_as ) ) $node['sameAs'] = $same_as;

		return $node;
	}

	private static function build_breadcrumbs( $d ) {
		$items    = array();
		$position = 1;

		$items[] = array(
			'@type'    => 'ListItem',
			'position' => $position++,
			'name'     => __( 'Home', 'fts' ),
			'item'     => home_url( '/' ),
		);

		foreach ( $d['dest_chain'] as $dest ) {
			if ( $dest['name'] === '' ) continue;
			$entry = array(
				'@type'    => 'ListItem',
				'position' => $position++,
				'name'     => $dest['name'],
			);
			if ( $dest['url'] !== '' ) $entry['item'] = $dest['url'];
			$items[] = $entry;
		}

		$items[] = array(
			'@type'    => 'ListItem',
			'position' => $position++,
			'name'     => $d['title'],
			'item'     => $d['permalink'],
		);

		if ( count( $items ) < 2 ) return null;

		return array(
			'@type'           => 'BreadcrumbList',
			'@id'             => $d['permalink'] . '#breadcrumbs',
			'itemListElement' => $items,
		);
	}

	private static function build_places( $d ) {
		$matched = self::matched_landmarks_for_trip( $d );
		$out     = array();
		foreach ( $matched as $name => $coords ) {
			$out[] = array(
				'@type' => 'TouristAttraction',
				'@id'   => self::landmark_place_id( $d['permalink'], $name ),
				'name'  => $name,
				'geo'   => array(
					'@type'     => 'GeoCoordinates',
					'latitude'  => $coords[0],
					'longitude' => $coords[1],
				),
			);
		}
		return $out;
	}

	/* ─────────────────────────────────────────────
	   Landmark matching
	   ───────────────────────────────────────────── */

	private static function matched_landmarks_for_trip( $d ) {
		$cache_key = (int) $d['trip_id'];
		if ( isset( self::$matched_landmarks_cache[ $cache_key ] ) ) {
			return self::$matched_landmarks_cache[ $cache_key ];
		}

		$haystack = ' ' . $d['title'] . ' ' . $d['short_description'] . ' ' . $d['long_description'];
		foreach ( $d['itin_titles']  as $t ) $haystack .= ' ' . (string) $t;
		foreach ( $d['itin_content'] as $c ) $haystack .= ' ' . (string) $c;
		foreach ( $d['includes']     as $i ) $haystack .= ' ' . (string) $i;

		// Match each landmark; prefer the most specific name when one is a
		// substring of another (e.g. "Sphinx" vs "Great Sphinx").
		$matched = array();
		foreach ( self::LANDMARK_GEO as $name => $coords ) {
			if ( stripos( $haystack, $name ) === false ) continue;

			$is_subset_of_existing = false;
			foreach ( array_keys( $matched ) as $existing ) {
				if ( $existing !== $name && stripos( $existing, $name ) !== false ) {
					$is_subset_of_existing = true;
					break;
				}
			}
			if ( $is_subset_of_existing ) continue;

			foreach ( array_keys( $matched ) as $existing ) {
				if ( $existing !== $name && stripos( $name, $existing ) !== false ) {
					unset( $matched[ $existing ] );
				}
			}
			$matched[ $name ] = $coords;
		}

		self::$matched_landmarks_cache[ $cache_key ] = $matched;
		return $matched;
	}

	private static function find_landmark_id_in_text( $permalink, $text ) {
		if ( $text === '' ) return null;
		$best = null;
		foreach ( self::LANDMARK_GEO as $name => $coords ) {
			if ( stripos( $text, $name ) === false ) continue;
			// Prefer the longest match (most specific)
			if ( $best === null || strlen( $name ) > strlen( $best ) ) {
				$best = $name;
			}
		}
		return $best === null ? null : self::landmark_place_id( $permalink, $best );
	}

	private static function landmark_place_id( $permalink, $name ) {
		return $permalink . '#place-' . sanitize_title( $name );
	}

	/* ─────────────────────────────────────────────
	   Reviews fetcher
	   ───────────────────────────────────────────── */

	private static function fetch_reviews( $trip_id ) {
		$out = array( 'reviews' => array(), 'average' => 0.0, 'count' => 0 );

		$m = get_post_meta( $trip_id, 'fts_reviews_data', true );
		if ( is_string( $m ) && trim( $m ) !== '' ) {
			$decoded = json_decode( $m, true );
			if ( is_array( $decoded ) ) $m = $decoded;
		}
		if ( is_object( $m ) ) {
			$decoded = json_decode( wp_json_encode( $m ), true );
			if ( is_array( $decoded ) ) $m = $decoded;
		}
		if ( is_array( $m ) ) {
			$avg = isset( $m['average'] ) ? (float) $m['average'] : 0.0;
			$cnt = isset( $m['count'] ) ? (int) $m['count'] : 0;
			$rev = isset( $m['reviews'] ) && is_array( $m['reviews'] ) ? $m['reviews'] : array();
			if ( $cnt > 0 && $avg > 0 && $avg <= 5 ) {
				$out['average'] = $avg;
				$out['count']   = $cnt;
				$out['reviews'] = $rev;
				return $out;
			}
		}

		$comments = get_comments( array(
			'post_id' => $trip_id,
			'status'  => 'approve',
			'parent'  => 0,
			'order'   => 'DESC',
			'orderby' => 'comment_date',
		) );

		if ( empty( $comments ) || ! is_array( $comments ) ) return $out;

		$enriched  = array();
		$stars_sum = 0;
		foreach ( $comments as $c ) {
			$stars = (int) get_comment_meta( $c->comment_ID, 'stars', true );
			if ( $stars < 1 ) continue;
			$title       = (string) get_comment_meta( $c->comment_ID, 'title', true );
			$enriched[] = array(
				'ID'          => (int) $c->comment_ID,
				'content'     => (string) $c->comment_content,
				'author_name' => (string) $c->comment_author,
				'date'        => mysql2date( 'c', $c->comment_date_gmt !== '0000-00-00 00:00:00' && $c->comment_date_gmt !== '' ? $c->comment_date_gmt : $c->comment_date, false ),
				'stars'       => $stars,
				'title'       => $title,
			);
			$stars_sum += $stars;
		}

		$out['reviews'] = $enriched;
		$out['count']   = count( $enriched );
		$out['average'] = $out['count'] > 0 ? ( $stars_sum / $out['count'] ) : 0.0;
		return $out;
	}

	/* ─────────────────────────────────────────────
	   String / value helpers
	   ───────────────────────────────────────────── */

	private static function clean_org_name( $blogname ) {
		$name = self::decode_text( (string) $blogname );
		if ( $name === '' ) return $name;
		if ( strpos( $name, ':' ) !== false ) {
			$first = trim( strstr( $name, ':', true ) );
			if ( $first !== '' ) return $first;
		}
		return $name;
	}

	private static function collect_social_urls() {
		$urls = array();
		$mods = get_theme_mods();
		if ( ! is_array( $mods ) ) return $urls;

		$pattern = '/social|facebook|instagram|twitter|x_url|youtube|tiktok|linkedin|pinterest|whatsapp/i';
		foreach ( $mods as $key => $val ) {
			if ( ! is_string( $val ) ) continue;
			if ( ! preg_match( $pattern, (string) $key ) ) continue;
			$val = trim( $val );
			if ( $val === '' ) continue;
			if ( filter_var( $val, FILTER_VALIDATE_URL ) ) {
				$urls[] = $val;
			}
		}
		return array_values( array_unique( $urls ) );
	}

	private static function iso8601_duration( $value, $unit ) {
		$n = is_numeric( $value ) ? (int) $value : 0;
		if ( $n <= 0 ) return '';
		$unit_key = strtolower( trim( (string) $unit ) );
		switch ( $unit_key ) {
			case 'hour':
			case 'hours':
				return 'PT' . $n . 'H';
			case 'minute':
			case 'minutes':
				return 'PT' . $n . 'M';
			case 'week':
			case 'weeks':
				return 'P' . $n . 'W';
			case 'month':
			case 'months':
				return 'P' . $n . 'M';
			case 'day':
			case 'days':
			default:
				return 'P' . $n . 'D';
		}
	}

	private static function decode_text( $s ) {
		$s = (string) $s;
		if ( $s === '' ) return '';
		$s = html_entity_decode( $s, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		return trim( $s );
	}

	private static function decode_strip( $s ) {
		$s = (string) $s;
		if ( $s === '' ) return '';
		$s = wp_strip_all_tags( $s );
		$s = html_entity_decode( $s, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$s = preg_replace( '/\s+/', ' ', $s );
		return trim( (string) $s );
	}

	private static function format_price( $price ) {
		return number_format( (float) $price, 2, '.', '' );
	}
}

FTS_Trip_Schema::init();
