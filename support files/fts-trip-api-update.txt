/*
Plugin Name: FTS Trip API
Description: Custom REST API for FTS Trips
Version: 1.1
Author: FTS
*/

if (!defined('FTS_TRIP_DEFAULT_CURRENCY')) {
    define('FTS_TRIP_DEFAULT_CURRENCY', 'EUR');
}

function fts_wpml_element_type_for_post_type($post_type) {
    if ($post_type === 'trip') return 'post_trip';
    return 'post_' . $post_type;
}

add_filter('wpml_use_advanced_translation_editor', function($use, $post_id) {
    if (get_post_type($post_id) === 'trip') {
        return false;
    }
    return $use;
}, 10, 2);

add_filter('wpml_should_use_tm_editor', function($use, $post_id) {
    if (get_post_type($post_id) === 'trip') {
        return false;
    }
    return $use;
}, 10, 2);

/**
 * Register REST API routes
 */
add_action('rest_api_init', function () {
    // 🔹 GET list of trips (existing)
    register_rest_route('fts/v1', '/trips', [
        'methods' => WP_REST_Server::READABLE, // GET
        'callback' => 'fts_list_trips',
        'permission_callback' => '__return_true',
        'args' => [
            'page' => ['type' => 'integer', 'required' => true],
            'per_page' => ['type' => 'integer', 'required' => true],
        ],
    ]);

    // 🔹 GET single trip (existing)
    register_rest_route('fts/v1', '/trip/(?P<id>\d+)', [
        'methods' => WP_REST_Server::READABLE, // GET
        'callback' => 'fts_get_trip_endpoint',
        'permission_callback' => '__return_true',
    ]);

    // 🔹 CREATE trip (POST)
    register_rest_route('fts/v1', '/trips', [
        'methods'  => WP_REST_Server::CREATABLE, // POST
        'callback' => 'fts_create_trip',
        'permission_callback' => 'fts_trips_permission',
    ]);

    // 🔹 UPDATE trip (PUT/PATCH/POST)
    // Enhanced to support complex meta updates
    register_rest_route('fts/v1', '/trip/(?P<id>\d+)', [
        'methods'  => WP_REST_Server::EDITABLE, // POST, PUT, PATCH
        'callback' => 'fts_update_trip',
        'permission_callback' => 'fts_trips_permission',
    ]);

    // 🔹 DELETE trip (DELETE)
    register_rest_route('fts/v1', '/trip/(?P<id>\d+)', [
        'methods'  => WP_REST_Server::DELETABLE, // DELETE
        'callback' => 'fts_delete_trip',
        'permission_callback' => 'fts_trips_permission',
    ]);

    // 🔹 CREATE package (POST)
    register_rest_route('fts/v1', '/packages', [
        'methods'  => WP_REST_Server::CREATABLE, // POST
        'callback' => 'fts_create_package',
        'permission_callback' => 'fts_trips_permission',
    ]);

    // 🔹 CLONE media attachment without uploading (POST)
    register_rest_route('fts/v1', '/media/clone', [
        'methods'  => WP_REST_Server::CREATABLE, // POST
        'callback' => 'fts_clone_media_attachment',
        'permission_callback' => 'fts_trips_permission',
    ]);

    // 🔹 Rename media file + update attachment record (POST)
    register_rest_route('fts/v1', '/media/ensure-filename', [
        'methods'  => WP_REST_Server::CREATABLE, // POST
        'callback' => 'fts_ensure_media_filename',
        'permission_callback' => 'fts_trips_permission',
    ]);

    // 🔹 Simple ping for debugging routes (GET)
    register_rest_route('fts/v1', '/media/ping', [
        'methods'  => WP_REST_Server::READABLE, // GET
        'callback' => function () {
            return rest_ensure_response(['success' => true, 'message' => 'fts media ping ok']);
        },
        'permission_callback' => '__return_true',
    ]);

    // 🔹 Debug: list fts routes (GET)
    register_rest_route('fts/v1', '/debug/routes', [
        'methods'  => WP_REST_Server::READABLE, // GET
        'callback' => function () {
            $server = rest_get_server();
            $routes = $server ? $server->get_routes() : [];
            $out = [];
            foreach ($routes as $route => $def) {
                if (strpos($route, '/fts/v1/') !== false) {
                    $out[] = $route;
                }
            }
            return rest_ensure_response(['success' => true, 'routes' => $out]);
        },
        'permission_callback' => '__return_true',
    ]);
});

function fts_ensure_media_filename(WP_REST_Request $request) {
    $params = $request->get_json_params();
    if (!$params) $params = $request->get_params();

    $source_id = intval($params['source_id'] ?? 0);
    $new_title = sanitize_text_field($params['title'] ?? '');

    if ($source_id <= 0) {
        return new WP_Error('invalid_source_id', 'Invalid source_id', ['status' => 400]);
    }

    $src = get_post($source_id);
    if (!$src || $src->post_type !== 'attachment') {
        return new WP_Error('not_found', 'Source attachment not found', ['status' => 404]);
    }

    $final_title = $new_title ? $new_title : $src->post_title;
    $final_slug = $final_title ? sanitize_title($final_title) : '';

    $upload_dir = wp_get_upload_dir();
    if (empty($upload_dir['basedir']) || empty($upload_dir['baseurl'])) {
        return new WP_Error('upload_dir_missing', 'Upload dir missing', ['status' => 500]);
    }

    $src_file = get_attached_file($source_id);
    if (!$src_file || !file_exists($src_file)) {
        $src_url = wp_get_attachment_url($source_id);
        if (!$src_url) {
            return new WP_Error('missing_source_file', 'Source attachment file missing', ['status' => 400]);
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';

        $tmp = download_url($src_url);
        if (is_wp_error($tmp)) {
            return new WP_Error('download_failed', $tmp->get_error_message(), ['status' => 500]);
        }

        $path_part = parse_url($src_url, PHP_URL_PATH);
        $ext = $path_part ? pathinfo($path_part, PATHINFO_EXTENSION) : '';
        $ext = $ext ? strtolower($ext) : 'jpg';

        $base_for_file = $final_slug ? $final_slug : ('attachment-' . $source_id);
        $orig_filename = $base_for_file . '-' . $source_id . '.' . $ext;
        $orig_filename = wp_unique_filename($upload_dir['path'], $orig_filename);
        $dest_original = trailingslashit($upload_dir['path']) . $orig_filename;

        if (!@rename($tmp, $dest_original)) {
            if (!@copy($tmp, $dest_original)) {
                @unlink($tmp);
                return new WP_Error('download_move_failed', 'Failed to store downloaded source file', ['status' => 500]);
            }
            @unlink($tmp);
        }

        $basedir = rtrim($upload_dir['basedir'], '/\\');
        $relative_original = ltrim(str_replace($basedir, '', $dest_original), '/\\');
        update_attached_file($source_id, $relative_original);

        $new_guid = trailingslashit($upload_dir['baseurl']) . str_replace('\\', '/', $relative_original);
        wp_update_post([
            'ID' => $source_id,
            'guid' => $new_guid
        ]);

        $src_file = $dest_original;
    }

    $dir = dirname($src_file);
    $ext = pathinfo($src_file, PATHINFO_EXTENSION);
    $ext = $ext ? strtolower($ext) : 'jpg';

    $base = $final_slug ? $final_slug : pathinfo($src_file, PATHINFO_FILENAME);
    $base = $base ? ($base . '-' . $source_id) : ('attachment-' . $source_id);
    $desired_basename = $base . '.' . $ext;
    $current_basename = basename($src_file);
    if ($current_basename === $desired_basename) {
        $filename = $desired_basename;
    } else {
        $filename = wp_unique_filename($dir, $desired_basename);
    }
    $dest_file = trailingslashit($dir) . $filename;

    if ($dest_file !== $src_file) {
        if (!@copy($src_file, $dest_file)) {
            return new WP_Error('copy_failed', 'Failed to create renamed copy', ['status' => 500]);
        }
    } else {
        $update = [
            'ID' => $source_id,
            'post_title' => $final_title,
        ];
        if ($final_slug) $update['post_name'] = $final_slug;
        wp_update_post($update);

        return rest_ensure_response([
            'success' => true,
            'source_id' => $source_id,
            'filename' => $filename,
            'url' => wp_get_attachment_url($source_id),
        ]);
    }

    $basedir = rtrim($upload_dir['basedir'], '/\\');
    $relative = ltrim(str_replace($basedir, '', $dest_file), '/\\');
    update_attached_file($source_id, $relative);

    $new_url = trailingslashit($upload_dir['baseurl']) . str_replace('\\', '/', $relative);

    $update = [
        'ID' => $source_id,
        'post_title' => $final_title,
        'guid' => $new_url,
    ];
    if ($final_slug) $update['post_name'] = $final_slug;
    wp_update_post($update);

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $metadata = wp_generate_attachment_metadata($source_id, $dest_file);
    if (!empty($metadata)) {
        wp_update_attachment_metadata($source_id, $metadata);
    }

    return rest_ensure_response([
        'success' => true,
        'source_id' => $source_id,
        'filename' => $filename,
        'url' => wp_get_attachment_url($source_id),
        'relative' => $relative,
    ]);
}

function fts_clone_media_attachment(WP_REST_Request $request) {
    $params = $request->get_json_params();
    if (!$params) $params = $request->get_params();

    $source_id = intval($params['source_id'] ?? 0);
    $target_lang = sanitize_text_field($params['lang'] ?? ($params['target_lang'] ?? ''));

    if ($source_id <= 0) {
        return new WP_Error('invalid_source_id', 'Invalid source_id', ['status' => 400]);
    }
    $src = get_post($source_id);
    if (!$src || $src->post_type !== 'attachment') {
        return new WP_Error('not_found', 'Source attachment not found', ['status' => 404]);
    }

    $src_url = wp_get_attachment_url($source_id);
    $src_file = get_attached_file($source_id);
    $mime = get_post_mime_type($source_id);

    if (!$src_url || !$src_file) {
        return new WP_Error('missing_source_file', 'Source attachment file data missing', ['status' => 400]);
    }

    $upload_dir = wp_get_upload_dir();
    $relative_file = $src_file;
    if (!empty($upload_dir['basedir'])) {
        $basedir = rtrim($upload_dir['basedir'], '/\\');
        $relative_file = ltrim(str_replace($basedir, '', $src_file), '/\\');
    }

    $new_post = [
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'post_mime_type' => $mime,
        'post_title' => $src->post_title,
        'post_excerpt' => $src->post_excerpt,
        'post_content' => $src->post_content,
        'guid' => $src_url,
    ];

    $new_id = wp_insert_post($new_post, true);
    if (is_wp_error($new_id)) return $new_id;

    update_post_meta($new_id, '_wp_attached_file', $relative_file);
    $meta = wp_get_attachment_metadata($source_id);
    if (!empty($meta)) {
        update_post_meta($new_id, '_wp_attachment_metadata', $meta);
    }
    $alt = get_post_meta($source_id, '_wp_attachment_image_alt', true);
    if ($alt !== '') {
        update_post_meta($new_id, '_wp_attachment_image_alt', $alt);
    }

    if (defined('ICL_SITEPRESS_VERSION') && !empty($target_lang)) {
        $element_type = fts_wpml_element_type_for_post_type('attachment');
        $src_details = apply_filters('wpml_element_language_details', null, [
            'element_id' => $source_id,
            'element_type' => $element_type
        ]);
        if ($src_details && !is_wp_error($src_details) && !empty($src_details->trid)) {
            do_action('wpml_set_element_language_details', [
                'element_id' => intval($new_id),
                'element_type' => $element_type,
                'trid' => $src_details->trid,
                'language_code' => $target_lang,
                'source_language_code' => $src_details->language_code ?: null
            ]);
        }
    }

    return rest_ensure_response([
        'success' => true,
        'source_id' => $source_id,
        'new_id' => intval($new_id),
        'url' => wp_get_attachment_url($new_id),
    ]);
}

/**
 * Permission callback for write operations
 */
function fts_trips_permission(WP_REST_Request $request) {
    return current_user_can('edit_posts');
}

/**
 * List trips (GET /fts/v1/trips)
 */
function fts_list_trips(WP_REST_Request $request) {
    $page = max(1, intval($request->get_param('page')));
    $per_page = max(1, intval($request->get_param('per_page')));
    $args = [
        'post_type' => 'trip',
        'post_status' => ['publish', 'draft'],
        'posts_per_page' => $per_page,
        'paged' => $page,
        'fields' => 'ids',
        'no_found_rows' => false,
        'update_post_meta_cache' => true,
        'update_post_term_cache' => true,
    ];
    $q = new WP_Query($args);
    $items = [];
    foreach ($q->posts as $id) {
        $items[] = fts_format_trip($id);
    }
    $total = intval($q->found_posts);
    $total_pages = $per_page > 0 ? intval(ceil($total / $per_page)) : 1;
    return rest_ensure_response([
        'pagination' => [
            'page' => $page,
            'per_page' => $per_page,
            'total_count' => $total,
            'total_pages' => $total_pages,
        ],
        'data' => $items,
    ]);
}

/**
 * Get single trip (GET /fts/v1/trip/{id})
 */
function fts_get_trip_endpoint($request) {
    $trip_id = intval($request['id']);
    $lang = $request->get_param('lang'); // Check for language param

    $post = get_post($trip_id);
    if (!$post || $post->post_type !== 'trip') {
        return new WP_Error('not_found', 'Trip not found', ['status' => 404]);
    }

    // Handle translation request
    if ($lang) {
        // 1. Check if translation exists
        $translated_id = fts_get_trip_translation_id($trip_id, $lang);
        
        if ($translated_id) {
            $trip_id = $translated_id;
        } else {
            // 2. If not found, try to auto-translate
            $new_translation_id = fts_auto_translate_trip($trip_id, $lang);
            if ($new_translation_id && !is_wp_error($new_translation_id)) {
                $trip_id = $new_translation_id;
            }
        }
    }

    return rest_ensure_response(fts_format_trip($trip_id));
}

/**
 * CREATE trip (POST /fts/v1/trips)
 */
function fts_create_trip(WP_REST_Request $request) {
    $title   = sanitize_text_field($request->get_param('title'));
    $slug    = sanitize_text_field($request->get_param('slug')); // ✅ Add slug support
    $content = $request->get_param('content');
    $excerpt = $request->get_param('excerpt'); // ✅ Add excerpt
    $status  = $request->get_param('status') ?: 'publish';

    if (empty($title)) {
        return new WP_Error('rest_invalid_param', 'title is required', ['status' => 400]);
    }

    $postarr = [
        'post_title'   => $title,
        'post_name'    => $slug, // ✅ Set slug/permalink
        'post_content' => is_string($content) ? wp_kses_post($content) : '',
        'post_excerpt' => is_string($excerpt) ? wp_kses_post($excerpt) : '', // ✅ Add excerpt
        'post_status'  => $status,
        'post_type'    => 'trip',
    ];

    $trip_id = wp_insert_post($postarr, true);

    if (is_wp_error($trip_id)) {
        return $trip_id;
    }

    // ✅ FORCE LANGUAGE ASSIGNMENT (WPML)
    $lang_code = 'en'; // Default
    $translation_links = [];

    // Check for nested language object
    $params = $request->get_json_params();
    if (!$params) $params = $request->get_params();

    // 1. Determine Language Code
    if (isset($params['language']['code'])) {
        $lang_code = sanitize_text_field($params['language']['code']);
    } elseif ($request->get_param('lang')) {
        $lang_code = sanitize_text_field($request->get_param('lang'));
    }

    // 2. Extract Translation Links (if provided)
    if (isset($params['language']['translations']) && is_array($params['language']['translations'])) {
        $translation_links = $params['language']['translations'];
    }

    $translation_of = isset($params['translation_of']) ? intval($params['translation_of']) : 0;

    $debug_translation = [
        'received_translation_of' => $translation_of,
        'received_lang' => $lang_code,
        'received_language_object' => isset($params['language']) ? $params['language'] : 'not_set',
        'parent_lang_details' => null,
        'wpml_action_payload' => null,
        'did_call_wpml_set_element_language_details' => false,
        'translations_after_create_link' => []
    ];

    if (defined('ICL_SITEPRESS_VERSION')) {
        $element_type = fts_wpml_element_type_for_post_type('trip');

        if ($translation_of > 0) {
            $parent_lang_details = apply_filters('wpml_element_language_details', null, [
                'element_id' => $translation_of,
                'element_type' => $element_type
            ]);
            $debug_translation['parent_lang_details'] = $parent_lang_details;

            if ($parent_lang_details && !is_wp_error($parent_lang_details) && !empty($parent_lang_details->trid) && !empty($parent_lang_details->language_code)) {
                $payload = [
                    'element_id' => $trip_id,
                    'element_type' => $element_type,
                    'trid' => $parent_lang_details->trid,
                    'language_code' => $lang_code,
                    'source_language_code' => $parent_lang_details->language_code
                ];
                $debug_translation['wpml_action_payload'] = $payload;
                do_action('wpml_set_element_language_details', $payload);
                $debug_translation['did_call_wpml_set_element_language_details'] = true;
            }
        } else {
            $payload = [
                'element_id' => $trip_id,
                'element_type' => $element_type,
                'trid' => false,
                'language_code' => $lang_code,
                'source_language_code' => null
            ];
            $debug_translation['wpml_action_payload'] = $payload;
            do_action('wpml_set_element_language_details', $payload);
            $debug_translation['did_call_wpml_set_element_language_details'] = true;
        }

        $details_after = apply_filters('wpml_element_language_details', null, [
            'element_id' => $trip_id,
            'element_type' => $element_type
        ]);

        if ($details_after && !is_wp_error($details_after) && !empty($details_after->trid)) {
            $translations = apply_filters('wpml_get_element_translations', null, $details_after->trid, $element_type);
            $out_trans = [];
            if ($translations && is_array($translations)) {
                foreach ($translations as $t) {
                    if (!empty($t->language_code) && !empty($t->element_id)) {
                        $out_trans[$t->language_code] = strval($t->element_id);
                    }
                }
            }
            $debug_translation['translations_after_create_link'] = $out_trans;
        }
    }

    // Handle meta from request
    $meta = $request->get_param('meta');
    if (is_array($meta)) {
        $incoming_trip_code = null;
        if (isset($meta['trip_code'])) {
            $incoming_trip_code = sanitize_text_field($meta['trip_code']);
        } elseif (isset($meta['wp_travel_engine_setting']) && is_array($meta['wp_travel_engine_setting']) && isset($meta['wp_travel_engine_setting']['trip_code'])) {
            $incoming_trip_code = sanitize_text_field($meta['wp_travel_engine_setting']['trip_code']);
        }

        foreach ($meta as $key => $value) {
            $meta_key = sanitize_key($key);
            update_post_meta($trip_id, $meta_key, $value);
        }

        if (!empty($incoming_trip_code)) {
            update_post_meta($trip_id, 'trip_code', $incoming_trip_code);
            $current_settings = get_post_meta($trip_id, 'wp_travel_engine_setting', true);
            if (!is_array($current_settings)) {
                $current_settings = [];
            }
            $current_settings['trip_code'] = $incoming_trip_code;
            update_post_meta($trip_id, 'wp_travel_engine_setting', $current_settings);
        }
    }
    
    if (is_array($meta) && isset($meta['_thumbnail_id'])) {
        $thumb_id = intval($meta['_thumbnail_id']);
        if ($thumb_id > 0) {
            set_post_thumbnail($trip_id, $thumb_id);
        }
    }

    $response_data = fts_format_trip($trip_id);
    // Inject debug info into response
    if (is_array($response_data)) {
        $response_data['debug_translation'] = $debug_translation;
        if (isset($debug_translation['translations_after_create_link']) && is_array($debug_translation['translations_after_create_link'])) {
            $response_data['language']['translations'] = $debug_translation['translations_after_create_link'];
        }
    }
    
    return rest_ensure_response($response_data);
}

/**
 * UPDATE trip (PUT/PATCH/POST /fts/v1/trip/{id})
 * Enhanced to handle complex nested meta like wp_travel_engine_setting
 */
function fts_update_trip(WP_REST_Request $request) {
    $trip_id = intval($request['id']);
    $post    = get_post($trip_id);

    if (!$post || $post->post_type !== 'trip') {
        return new WP_Error('not_found', 'Trip not found', ['status' => 404]);
    }

    $request_json = $request->get_json_params();
    $params = $request_json;
    if (!$params) {
        // Fallback to standard params if JSON body is empty or not parsed
        $params = $request->get_params();
    }

    $update = ['ID' => $trip_id];
    $update_core = false;
    $debug_slug_update = [
        'received_slug' => null,
        'sanitized_slug' => null,
        'unique_slug_generated' => null,
        'post_name_sent_to_wp_update_post' => null,
        'final_post_name_after_update' => null,
        'used_direct_db_fallback' => false,
        'final_post_name_after_fallback' => null,
        'slug_source_used' => 'none'
    ];

    // 1. Update Core Fields
    // Support both direct keys (legacy) and nested 'core' keys (new publisher)
    
    // Title
    if (isset($params['core']['title'])) {
        $update['post_title'] = $params['core']['title'];
        $update_core = true;
    } elseif (isset($params['title'])) {
        $update['post_title'] = sanitize_text_field($params['title']);
        $update_core = true;
    }

    // Content
    if (isset($params['content'])) {
        $update['post_content'] = wp_kses_post($params['content']);
        $update_core = true;
    }

    $received_slug = null;
    if (!empty($params['core']['slug'])) {
        $received_slug = $params['core']['slug'];
        $debug_slug_update['slug_source_used'] = 'params.core.slug';
    } elseif (!empty($params['slug'])) {
        $received_slug = $params['slug'];
        $debug_slug_update['slug_source_used'] = 'params.slug';
    } elseif (!empty($request_json['core']['slug'])) {
        $received_slug = $request_json['core']['slug'];
        $debug_slug_update['slug_source_used'] = 'request_json.core.slug';
    } elseif (!empty($request_json['slug'])) {
        $received_slug = $request_json['slug'];
        $debug_slug_update['slug_source_used'] = 'request_json.slug';
    }
    $debug_slug_update['received_slug'] = $received_slug;
    if ($received_slug !== null) {
        $debug_slug_update['sanitized_slug'] = sanitize_title($received_slug);
        if (!empty($debug_slug_update['sanitized_slug'])) {
            $unique_slug = wp_unique_post_slug(
                $debug_slug_update['sanitized_slug'],
                $trip_id,
                $post->post_status ? $post->post_status : 'publish',
                'trip',
                0
            );
            $debug_slug_update['unique_slug_generated'] = $unique_slug;
            if (!empty($unique_slug)) {
                $update['post_name'] = $unique_slug;
            } else {
                $update['post_name'] = $debug_slug_update['sanitized_slug'];
            }
            $update_core = true;
        }
    }

    // Excerpt
    if (isset($params['core']['excerpt'])) {
        $update['post_excerpt'] = $params['core']['excerpt'];
        $update_core = true;
    }

    // Status
    if (isset($params['status'])) {
        $update['post_status'] = sanitize_text_field($params['status']);
        $update_core = true;
    }

    // Always update the post to refresh modified timestamp, even if only meta is changing
    // This ensures WordPress shows the trip as "updated"
    if ($update_core) {
        $result = wp_update_post($update, true);
        if (is_wp_error($result)) {
            return $result;
        }
    } else {
        // Even if no core fields changed, update the post to refresh modified date
        $result = wp_update_post(['ID' => $trip_id], true);
        if (is_wp_error($result)) {
            return $result;
        }
        $update_core = true; // Mark as updated for debug
    }
    
    if (isset($update['post_name'])) {
        $debug_slug_update['post_name_sent_to_wp_update_post'] = $update['post_name'];
    }
    $post_after_slug = get_post($trip_id);
    $debug_slug_update['final_post_name_after_update'] = $post_after_slug ? $post_after_slug->post_name : null;

    $final_post_name_for_log = $debug_slug_update['final_post_name_after_update'];
    if (
        !empty($debug_slug_update['unique_slug_generated']) &&
        $debug_slug_update['final_post_name_after_update'] !== $debug_slug_update['unique_slug_generated']
    ) {
        global $wpdb;
        $wpdb->update(
            $wpdb->posts,
            ['post_name' => $debug_slug_update['unique_slug_generated']],
            ['ID' => $trip_id],
            ['%s'],
            ['%d']
        );

        clean_post_cache($trip_id);
        wp_cache_delete($trip_id, 'posts');

        $final_post = get_post($trip_id);
        $debug_slug_update['used_direct_db_fallback'] = true;
        $debug_slug_update['final_post_name_after_fallback'] = $final_post ? $final_post->post_name : null;
        $final_post_name_for_log = $debug_slug_update['final_post_name_after_fallback'];
    }
    
    $debug_slug_summary = [
        'trip_id' => $trip_id,
        'received' => $debug_slug_update['received_slug'],
        'sanitized' => $debug_slug_update['sanitized_slug'],
        'unique' => $debug_slug_update['unique_slug_generated'],
        'final' => $final_post_name_for_log
    ];
    
    error_log(
        'SLUG UPDATE RESULT: trip_id=' . $trip_id .
        ' | received=' . ($debug_slug_update['received_slug'] === null ? 'null' : $debug_slug_update['received_slug']) .
        ' | sanitized=' . ($debug_slug_update['sanitized_slug'] === null ? 'null' : $debug_slug_update['sanitized_slug']) .
        ' | unique=' . ($debug_slug_update['unique_slug_generated'] === null ? 'null' : $debug_slug_update['unique_slug_generated']) .
        ' | final=' . ($final_post_name_for_log === null ? 'null' : $final_post_name_for_log)
    );

    // 2. Update Meta
    $meta_input = isset($params['meta']) ? $params['meta'] : [];

    $incoming_trip_code = null;
    if (isset($meta_input['trip_code'])) {
        $incoming_trip_code = sanitize_text_field($meta_input['trip_code']);
    } elseif (isset($meta_input['wp_travel_engine_setting']) && is_array($meta_input['wp_travel_engine_setting']) && isset($meta_input['wp_travel_engine_setting']['trip_code'])) {
        $incoming_trip_code = sanitize_text_field($meta_input['wp_travel_engine_setting']['trip_code']);
    }
    
    // Handle WP Travel Engine Settings (Merge logic)
    if (isset($meta_input['wp_travel_engine_setting'])) {
        $new_settings = $meta_input['wp_travel_engine_setting'];
        $current_settings = get_post_meta($trip_id, 'wp_travel_engine_setting', true);
        
        if (!is_array($current_settings)) {
            $current_settings = [];
        }

        // Merge new settings into current settings
        foreach ($new_settings as $key => $value) {
            $current_settings[$key] = $value;
        }

        update_post_meta($trip_id, 'wp_travel_engine_setting', $current_settings);
        
        // Remove from generic loop to avoid overwriting with partial data
        unset($meta_input['wp_travel_engine_setting']);
    }

    if (!empty($incoming_trip_code)) {
        update_post_meta($trip_id, 'trip_code', $incoming_trip_code);
        $current_settings = get_post_meta($trip_id, 'wp_travel_engine_setting', true);
        if (!is_array($current_settings)) {
            $current_settings = [];
        }
        $current_settings['trip_code'] = $incoming_trip_code;
        update_post_meta($trip_id, 'wp_travel_engine_setting', $current_settings);
    }

    // Handle RankMath SEO
    if (isset($meta_input['rank_math_title'])) {
        update_post_meta($trip_id, 'rank_math_title', $meta_input['rank_math_title']);
        unset($meta_input['rank_math_title']);
    }
    if (isset($meta_input['rank_math_description'])) {
        update_post_meta($trip_id, 'rank_math_description', $meta_input['rank_math_description']);
        unset($meta_input['rank_math_description']);
    }
    if (isset($meta_input['rank_math_focus_keyword'])) {
        update_post_meta($trip_id, 'rank_math_focus_keyword', $meta_input['rank_math_focus_keyword']);
        unset($meta_input['rank_math_focus_keyword']);
    }

    // 3. Update Taxonomies (Activities & Trip Types)
    // Supports WP Travel Engine standard taxonomies ('trip_activities', 'trip_types')
    // with fallback to common alternatives ('activity', 'trip_type').
    $debug_tax_log = [];

    if (isset($params['activities'])) {
        $act_ids = array_map('intval', (array) $params['activities']);
        
        // Try 'activities' (Seen in user's API response)
        $res = wp_set_object_terms($trip_id, $act_ids, 'activities');
        
        if (is_wp_error($res)) {
             // Fallback to 'trip_activities' (Standard WTE)
             $res = wp_set_object_terms($trip_id, $act_ids, 'trip_activities');
        }
        if (is_wp_error($res)) {
             // Fallback to 'activity'
             $res = wp_set_object_terms($trip_id, $act_ids, 'activity');
        }
        $debug_tax_log['activities'] = is_wp_error($res) ? $res->get_error_message() : 'updated (' . count($act_ids) . ' ids)';
    }

    if (isset($params['trip_types'])) {
        $type_ids = array_map('intval', (array) $params['trip_types']);
        // Try 'trip_types' (Standard WTE)
        $res = wp_set_object_terms($trip_id, $type_ids, 'trip_types');
        if (is_wp_error($res)) {
             // Fallback to 'trip_type'
             $res = wp_set_object_terms($trip_id, $type_ids, 'trip_type');
        }
        $debug_tax_log['trip_types'] = is_wp_error($res) ? $res->get_error_message() : 'updated (' . count($type_ids) . ' ids)';
    }

    if (isset($params['destinations'])) {
        $dest_ids = array_filter(array_map('intval', (array) $params['destinations']), function ($v) {
            return $v > 0;
        });

        $res = wp_set_object_terms($trip_id, $dest_ids, 'destination');
        if (is_wp_error($res)) {
            $res = wp_set_object_terms($trip_id, $dest_ids, 'destinations');
        }
        if (is_wp_error($res)) {
            $res = wp_set_object_terms($trip_id, $dest_ids, 'trip_destination');
        }
        if (is_wp_error($res)) {
            $res = wp_set_object_terms($trip_id, $dest_ids, 'trip_destinations');
        }
        if (is_wp_error($res)) {
            $res = wp_set_object_terms($trip_id, $dest_ids, 'location');
        }
        if (is_wp_error($res)) {
            $res = wp_set_object_terms($trip_id, $dest_ids, 'locations');
        }
        $debug_tax_log['destinations'] = is_wp_error($res) ? $res->get_error_message() : 'updated (' . count($dest_ids) . ' ids)';
    }

    // 4. Set Language (Polylang / WPML)
    // Support 'lang' OR nested language.code (updater sends language.code)
    $current_lang = null;
    $translation_links = [];

    // Debug params for language
    $debug_tax_log['received_params_lang'] = isset($params['lang']) ? $params['lang'] : 'not_set';
    $debug_tax_log['received_params_language'] = isset($params['language']) ? $params['language'] : 'not_set';

    if (!empty($params['lang'])) {
        $current_lang = sanitize_text_field($params['lang']);
    } elseif (!empty($params['language']['code'])) {
        $current_lang = sanitize_text_field($params['language']['code']);
    } elseif (isset($params['language']) && is_object($params['language']) && !empty($params['language']->code)) {
        $current_lang = sanitize_text_field($params['language']->code);
    }
    if (isset($params['language']['translations']) && is_array($params['language']['translations'])) {
        $translation_links = $params['language']['translations'];
    } elseif (isset($params['language']) && is_object($params['language']) && isset($params['language']->translations) && is_array($params['language']->translations)) {
        $translation_links = $params['language']->translations;
    }

    $element_type = fts_wpml_element_type_for_post_type('trip');
    $current_lang_details = null;
    if (defined('ICL_SITEPRESS_VERSION')) {
        $current_lang_details = apply_filters('wpml_element_language_details', null, [
            'element_id' => $trip_id,
            'element_type' => $element_type
        ]);
    }

    if (!$current_lang && $current_lang_details && !is_wp_error($current_lang_details) && !empty($current_lang_details->language_code)) {
        $current_lang = $current_lang_details->language_code;
    }

    $debug_translation_update = [
        'current_trip_id' => $trip_id,
        'current_lang_details' => $current_lang_details,
        'received_language_object' => isset($params['language']) ? $params['language'] : 'not_set',
        'received_translation_links_raw' => $translation_links,
        'sanitized_translation_links' => [],
        'final_valid_map_before_save' => [],
        'final_wpml_actions' => [],
        'did_call_wpml_set_element_language_details' => false
    ];

    if (defined('ICL_SITEPRESS_VERSION') && $current_lang && !empty($translation_links)) {
        $trid = null;
        if ($current_lang_details && !is_wp_error($current_lang_details) && !empty($current_lang_details->trid)) {
            $trid = $current_lang_details->trid;
        }

        if (!$trid && !empty($params['translation_of'])) {
            $parent_id = intval($params['translation_of']);
            if ($parent_id > 0) {
                $parent_details = apply_filters('wpml_element_language_details', null, [
                    'element_id' => $parent_id,
                    'element_type' => $element_type
                ]);
                if ($parent_details && !is_wp_error($parent_details) && !empty($parent_details->trid)) {
                    $trid = $parent_details->trid;
                }
            }
        }

        if (!$trid) {
            foreach ($translation_links as $l_code => $l_id) {
                $l_id = intval($l_id);
                if ($l_id > 0) {
                    $t_details = apply_filters('wpml_element_language_details', null, [
                        'element_id' => $l_id,
                        'element_type' => $element_type
                    ]);
                    if ($t_details && !is_wp_error($t_details) && !empty($t_details->trid)) {
                        $trid = $t_details->trid;
                        break;
                    }
                }
            }
        }

        $valid_map = [];
        $used_ids = [];
        $valid_map[$current_lang] = $trip_id;
        $used_ids[$trip_id] = true;

        foreach ($translation_links as $l_code => $l_id) {
            $l_code = sanitize_text_field($l_code);
            $l_id = intval($l_id);
            $debug_translation_update['sanitized_translation_links'][$l_code] = $l_id;

            if ($l_id <= 0) continue;
            if ($l_code === $current_lang) continue;
            if ($l_id === $trip_id) continue;
            if (isset($used_ids[$l_id])) continue;

            $t_post = get_post($l_id);
            if (!$t_post || $t_post->post_type !== 'trip') continue;

            $valid_map[$l_code] = $l_id;
            $used_ids[$l_id] = true;
        }

        $debug_translation_update['final_valid_map_before_save'] = $valid_map;

        if ($trid && count($valid_map) >= 2) {
            $original_lang = $current_lang;
            if ($current_lang_details && !is_wp_error($current_lang_details) && !empty($current_lang_details->source_language_code)) {
                $original_lang = $current_lang_details->source_language_code;
            }
            if (isset($valid_map['en']) && !empty($valid_map['en'])) {
                $original_lang = 'en';
            }

            foreach ($valid_map as $l_code => $l_id) {
                $payload = [
                    'element_id' => intval($l_id),
                    'element_type' => $element_type,
                    'trid' => $trid,
                    'language_code' => $l_code,
                    'source_language_code' => ($l_code === $original_lang) ? null : $original_lang
                ];
                $debug_translation_update['final_wpml_actions'][] = $payload;
                do_action('wpml_set_element_language_details', $payload);
            }

            $debug_translation_update['did_call_wpml_set_element_language_details'] = true;
        }
    }

    // Handle generic meta updates
    $meta_keys_updated = [];
    foreach ($meta_input as $key => $value) {
        $meta_key = sanitize_key($key);
        $update_result = update_post_meta($trip_id, $meta_key, $value);
        $meta_keys_updated[] = $meta_key . ' (' . ($update_result ? 'updated' : 'unchanged') . ')';
    }
    
    $thumb_value = null;
    if (isset($params['meta']) && is_array($params['meta']) && isset($params['meta']['_thumbnail_id'])) {
        $thumb_value = $params['meta']['_thumbnail_id'];
    } elseif (isset($meta_input['_thumbnail_id'])) {
        $thumb_value = $meta_input['_thumbnail_id'];
    }
    if ($thumb_value !== null) {
        $thumb_id = intval($thumb_value);
        if ($thumb_id > 0) {
            set_post_thumbnail($trip_id, $thumb_id);
        }
    }

    // DEBUG RESPONSE
    return array(
        'success' => true,
        'trip_id' => $trip_id,
        'message' => 'Trip updated successfully',
        'debug_received' => $params,
        'debug_slug_summary' => $debug_slug_summary,
        'debug_slug_update' => $debug_slug_update,
        'debug_update_core' => $update_core,
        'debug_core_result' => isset($result) ? $result : 'not_run',
        'debug_meta_keys_updated' => $meta_keys_updated,
        'debug_tax_log' => $debug_tax_log,
        'debug_translation_update' => isset($debug_translation_update) ? $debug_translation_update : 'not_run',
        'debug_wte_setting_updated' => isset($params['meta']['wp_travel_engine_setting']) ? 'yes' : 'no',
        'debug_wte_setting_keys' => isset($params['meta']['wp_travel_engine_setting']) ? array_keys($params['meta']['wp_travel_engine_setting']) : []
    );
}

/**
 * DELETE trip (DELETE /fts/v1/trip/{id})
 */
function fts_delete_trip(WP_REST_Request $request) {
    $trip_id = intval($request['id']);
    $post    = get_post($trip_id);

    if (!$post || $post->post_type !== 'trip') {
        return new WP_Error('not_found', 'Trip not found', ['status' => 404]);
    }

    $force = filter_var($request->get_param('force'), FILTER_VALIDATE_BOOLEAN);
    if ($force) {
        $deleted = wp_delete_post($trip_id, true);
    } else {
        $deleted = wp_trash_post($trip_id);
    }

    if (!$deleted) {
        return new WP_Error('could_not_delete', 'Could not delete trip', ['status' => 500]);
    }

    return rest_ensure_response([
        'deleted' => true,
        'id'      => $trip_id,
        'force'   => $force,
    ]);
}

/**
 * Format trip data
 */
function fts_format_trip($id) {
    $post = get_post($id);
    if (!$post) return null;

    $core = [
        'id' => $post->ID,
        'title' => get_the_title($post),
        'slug' => $post->post_name,
        'status' => $post->post_status,
        'type' => $post->post_type,
        'link' => get_permalink($post),
        'permalink' => get_permalink($post),
        'permalink_slug' => $post->post_name,
        'permalink_path' => wp_parse_url(get_permalink($post), PHP_URL_PATH),
        'date' => get_post_time('c', false, $post),
        'date_gmt' => get_post_time('c', true, $post),
        'modified' => get_post_modified_time('c', false, $post),
        'modified_gmt' => get_post_modified_time('c', true, $post),
        'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
        'content_html' => apply_filters('the_content', $post->post_content),
        'author_id' => $post->post_author,
        'template' => get_page_template_slug($post) ?: '',
        'comment_status' => $post->comment_status,
    ];

    $raw_meta = get_post_meta($id);
    $meta = [];
    foreach ($raw_meta as $key => $values) {
        $out = [];
        foreach ($values as $v) {
            $out[] = maybe_unserialize($v);
        }
        $meta[$key] = count($out) === 1 ? $out[0] : $out;
    }

    $taxonomies = [];
    $taxes = get_object_taxonomies($post->post_type, 'names');
    foreach ($taxes as $tax) {
        $terms = wp_get_post_terms($id, $tax);
        $taxonomies[$tax] = [];
        if (!is_wp_error($terms) && !empty($terms)) {
            foreach ($terms as $t) {
                $taxonomies[$tax][] = ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug];
            }
        }
    }

    $featured_image = null;
    if (has_post_thumbnail($id)) {
        $thumb_id = get_post_thumbnail_id($id);
        $img = wp_get_attachment_metadata($thumb_id);
        $url = wp_get_attachment_url($thumb_id);
        $featured_image = [
            'id' => $thumb_id,
            'url' => $url,
            'width' => isset($img['width']) ? $img['width'] : null,
            'height' => isset($img['height']) ? $img['height'] : null,
            'title' => get_the_title($thumb_id),
            'caption' => wp_get_attachment_caption($thumb_id),
            'alt' => get_post_meta($thumb_id, '_wp_attachment_image_alt', true),
            'mime_type' => get_post_mime_type($thumb_id),
        ];
    }

    $gallery = [];
    $attachments = get_attached_media('image', $id);
    $exclude = $featured_image ? $featured_image['id'] : 0;
    foreach ($attachments as $att) {
        if ($att->ID === $exclude) continue;
        $meta_att = wp_get_attachment_metadata($att->ID);
        $url_att = wp_get_attachment_url($att->ID);
        if ($url_att) {
            $gallery[] = [
                'id' => $att->ID,
                'url' => $url_att,
                'width' => isset($meta_att['width']) ? $meta_att['width'] : null,
                'height' => isset($meta_att['height']) ? $meta_att['height'] : null,
                'title' => get_the_title($att->ID),
                'caption' => wp_get_attachment_caption($att->ID),
                'alt' => get_post_meta($att->ID, '_wp_attachment_image_alt', true),
                'mime_type' => get_post_mime_type($att->ID),
            ];
        }
    }

    $seo = [
        'permalink' => [
            'slug' => $core['slug'],
            'full' => $core['permalink'],
            'path' => $core['permalink_path'],
        ],
        'yoast' => [
            'primary_destination' => get_post_meta($id, '_yoast_wpseo_primary_destination', true),
            'primary_activities' => get_post_meta($id, '_yoast_wpseo_primary_activities', true),
            'primary_trip_types' => get_post_meta($id, '_yoast_wpseo_primary_trip_types', true),
            'primary_difficulty' => get_post_meta($id, '_yoast_wpseo_primary_difficulty', true),
            'reading_time_minutes' => get_post_meta($id, '_yoast_wpseo_estimated-reading-time-minutes', true),
            'title' => get_post_meta($id, '_yoast_wpseo_title', true),
            'description' => get_post_meta($id, '_yoast_wpseo_metadesc', true),
            'focus_keyword' => get_post_meta($id, '_yoast_wpseo_focuskw', true),
        ],
        'rank_math' => [
            'title' => get_post_meta($id, 'rank_math_title', true),
            'description' => get_post_meta($id, 'rank_math_description', true),
            'focus_keyword' => get_post_meta($id, 'rank_math_focus_keyword', true),
            'primary_destination' => get_post_meta($id, 'rank_math_primary_destination', true),
            'primary_activities' => get_post_meta($id, 'rank_math_primary_activities', true),
            'primary_trip_types' => get_post_meta($id, 'rank_math_primary_trip_types', true),
            'primary_difficulty' => get_post_meta($id, 'rank_math_primary_difficulty', true),
            'news_sitemap_robots' => get_post_meta($id, 'rank_math_news_sitemap_robots', true),
            'robots' => get_post_meta($id, 'rank_math_robots', true),
            'seo_score' => get_post_meta($id, 'rank_math_seo_score', true),
            'internal_links_processed' => get_post_meta($id, 'rank_math_internal_links_processed', true),
            'analytic_object_id' => get_post_meta($id, 'rank_math_analytic_object_id', true),
        ],
    ];

    $pricing = fts_collect_pricing_from_meta($meta);
    $general = fts_collect_general_from_meta($meta);

    // Get Language Info (WPML)
    $language = [
        'code' => 'en', // default
        'locale' => 'en_US',
        'translations' => []
    ];

    if (defined('ICL_SITEPRESS_VERSION')) {
        $element_type = fts_wpml_element_type_for_post_type('trip');
        $details = apply_filters('wpml_element_language_details', null, [
            'element_id' => $id,
            'element_type' => $element_type
        ]);
        if ($details && !is_wp_error($details)) {
            if (!empty($details->language_code)) $language['code'] = $details->language_code;
        }

        if ($details && !is_wp_error($details) && !empty($details->trid)) {
            $translations = apply_filters('wpml_get_element_translations', null, $details->trid, $element_type);
            $out_trans = [];
            if ($translations && is_array($translations)) {
                foreach ($translations as $t) {
                    if (!empty($t->language_code) && !empty($t->element_id)) {
                        $out_trans[$t->language_code] = strval($t->element_id);
                    }
                }
            }
            $language['translations'] = $out_trans;
        }
    }

    return [
        'core' => $core,
        'language' => $language, // ✅ Added Language Info
        'meta' => $meta,
        'seo' => $seo,
        'taxonomies' => $taxonomies,
        'featured_image' => $featured_image,
        'gallery' => $gallery,
        'general' => $general,
        'pricing' => $pricing,
    ];
}

function fts_pick($settings, $meta, $keys) {
    foreach ($keys as $k) {
        if (is_array($settings) && array_key_exists($k, $settings)) return $settings[$k];
        if (array_key_exists($k, $meta)) return $meta[$k];
    }
    return null;
}

function fts_bool($v) {
    if (is_bool($v)) return $v;
    if (is_numeric($v)) return intval($v) === 1;
    $s = is_string($v) ? strtolower(trim($v)) : '';
    if (in_array($s, ['1', 'true', 'yes', 'on'])) return true;
    if (in_array($s, ['0', 'false', 'no', 'off'])) return false;
    return null;
}

function fts_collect_general_from_meta($meta) {
    $general = [
        'trip_code' => null,
        'duration_type' => null,
        'duration' => ['hours' => null, 'minutes' => null],
        'cutoff' => ['enabled' => null, 'value' => null, 'unit' => null],
        'age' => ['min' => null, 'max' => null],
        'raw' => null
    ];
    $settings = null;
    if (isset($meta['wp_travel_engine_setting'])) $settings = $meta['wp_travel_engine_setting'];
    if (!$settings && isset($meta['wpte_trip_settings'])) $settings = $meta['wpte_trip_settings'];
    if (is_string($settings)) {
        $tmp = json_decode($settings, true);
        if (is_array($tmp)) $settings = $tmp;
    }

    $general['trip_code'] = fts_pick($settings, $meta, ['trip_code', 'wpte_trip_code', 'code', 'wp_travel_trip_code']);
    $general['duration_type'] = fts_pick($settings, $meta, ['duration_type', 'wpte_duration_type', 'trip_duration_type', 'trip_duration_unit']);
    $dur_val = fts_pick($settings, $meta, ['trip_duration', 'wp_travel_engine_setting_trip_duration', 'duration_hours', 'wpte_trip_duration_hours', 'trip_duration_hour', 'trip_duration_hours']);
    $dur_unit = $general['duration_type'];
    if ($dur_val !== null) {
        $dv = intval($dur_val);
        if ($dur_unit === 'hours') {
            $general['duration']['hours'] = $dv;
            $general['duration']['minutes'] = 0;
        } elseif ($dur_unit === 'minutes') {
            $general['duration']['hours'] = 0;
            $general['duration']['minutes'] = $dv;
        } elseif ($dur_unit === 'days') {
            $general['duration']['hours'] = $dv * 24;
            $general['duration']['minutes'] = 0;
        }
    } else {
        $general['duration']['hours'] = intval(fts_pick($settings, $meta, ['duration_hours', 'wpte_trip_duration_hours', 'trip_duration_hour', 'trip_duration_hours']));
        $general['duration']['minutes'] = intval(fts_pick($settings, $meta, ['duration_minutes', 'wpte_trip_duration_minutes', 'trip_duration_minute', 'trip_duration_minutes']));
    }
    $general['cutoff']['enabled'] = fts_bool(fts_pick($settings, $meta, ['trip_cutoff_enable', 'cut_off_enable', 'cutoff_enabled', 'wpte_cutoff_enabled']));
    $general['cutoff']['value'] = intval(fts_pick($settings, $meta, ['trip_cut_off_time', 'cut_off_value', 'cutoff_value', 'wpte_cutoff_value']));
    $general['cutoff']['unit'] = fts_pick($settings, $meta, ['trip_cut_off_unit', 'cut_off_unit', 'cutoff_unit', 'wpte_cutoff_unit', 'cutoff_days', 'cut_off_days']);
    $general['age']['min'] = intval(fts_pick($settings, $meta, ['min_age', 'minimum_age', 'wpte_min_age']));
    $general['age']['max'] = intval(fts_pick($settings, $meta, ['max_age', 'maximum_age', 'wpte_max_age']));
    $general['raw'] = is_array($settings) ? $settings : null;
    return $general;
}

function fts_collect_pricing_from_meta($meta) {
    $pricing = [
        'currency' => null,
        'base_price' => null,
        'actual_price' => null,
        'package_ids' => [],
        'packages' => [],
        'dates' => [],
        'raw' => []
    ];
    $settings = null;
    if (isset($meta['wp_travel_engine_setting'])) $settings = $meta['wp_travel_engine_setting'];
    if (!$settings && isset($meta['wpte_trip_settings'])) $settings = $meta['wpte_trip_settings'];
    if (is_string($settings)) {
        $tmp = json_decode($settings, true);
        if (is_array($tmp)) $settings = $tmp;
    }
    if (is_array($settings)) {
        $pricing['currency'] = $settings['currency'] ?? ($settings['trip_currency'] ?? null);
        $pricing['base_price'] = $settings['trip_price'] ?? ($settings['price'] ?? null);
        $pricing['raw']['settings'] = $settings;
        foreach (['packages_ids', 'package_ids', 'packages'] as $k) {
            if (isset($settings[$k])) {
                $ids = $settings[$k];
                if (is_string($ids)) {
                    $decoded = json_decode($ids, true);
                    if (is_array($decoded)) $ids = $decoded;
                }
                $pricing['package_ids'] = array_map('intval', (array)$ids);
                break;
            }
        }
    }
    if (isset($meta['wp_travel_engine_setting_trip_price'])) {
        $pricing['base_price'] = $meta['wp_travel_engine_setting_trip_price'];
    }
    if (isset($meta['wp_travel_engine_setting_trip_actual_price'])) {
        $pricing['actual_price'] = $meta['wp_travel_engine_setting_trip_actual_price'];
    }
    if (!$pricing['currency']) {
        $pricing['currency'] = fts_get_global_currency();
    }
    if (isset($meta['packages_ids'])) {
        $ids = $meta['packages_ids'];
        if (is_string($ids)) {
            $decoded = json_decode($ids, true);
            if (is_array($decoded)) $ids = $decoded;
        }
        $pricing['package_ids'] = array_map('intval', (array)$ids);
    }
    foreach ($meta as $key => $val) {
        $lk = strtolower($key);
        if (preg_match('/price|pricing|package|date|availability|currency/', $lk)) {
            $pricing['raw'][$key] = $val;
        }
    }
    if (!empty($pricing['package_ids'])) {
        $pricing['packages'] = fts_collect_package_details($pricing['package_ids']);
    }
    return $pricing;
}

function fts_collect_package_details($ids) {
    $out = [];
    foreach ($ids as $pid) {
        $p = get_post($pid);
        if (!$p) continue;
        $core = [
            'id' => $p->ID,
            'title' => get_the_title($p),
            'slug' => $p->post_name,
            'status' => $p->post_status,
            'type' => $p->post_type,
            'link' => get_permalink($p),
            'date' => get_post_time('c', false, $p),
            'modified' => get_post_modified_time('c', false, $p),
            'excerpt' => wp_strip_all_tags(get_the_excerpt($p)),
            'content_html' => apply_filters('the_content', $p->post_content),
        ];
        $raw_meta = get_post_meta($pid);
        $meta = [];
        foreach ($raw_meta as $key => $values) {
            $vals = [];
            foreach ($values as $v) {
                $vals[] = maybe_unserialize($v);
            }
            $meta[$key] = count($vals) === 1 ? $vals[0] : $vals;
        }
        $taxonomies = [];
        $taxes = get_object_taxonomies($p->post_type, 'names');
        foreach ($taxes as $tax) {
            $terms = wp_get_post_terms($pid, $tax);
            $taxonomies[$tax] = [];
            if (!is_wp_error($terms) && !empty($terms)) {
                foreach ($terms as $t) {
                    $taxonomies[$tax][] = ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug];
                }
            }
        }
        $pricing = [
            'categories' => [],
            'dates' => [],
        ];
        $currency = fts_get_global_currency();
        if (isset($meta['package-categories']) && is_array($meta['package-categories'])) {
            $pc = $meta['package-categories'];
            $keys = [];
            if (isset($pc['labels']) && is_array($pc['labels'])) $keys = array_keys($pc['labels']);
            elseif (isset($pc['prices']) && is_array($pc['prices'])) $keys = array_keys($pc['prices']);
            elseif (isset($pc['c_ids']) && is_array($pc['c_ids'])) $keys = array_keys($pc['c_ids']);
            foreach ($keys as $k) {
                $pricing['categories'][] = [
                    'id' => isset($pc['c_ids'][$k]) ? intval($pc['c_ids'][$k]) : (is_numeric($k) ? intval($k) : null),
                    'label' => isset($pc['labels'][$k]) ? $pc['labels'][$k] : null,
                    'regular_price' => fts_num(isset($pc['prices'][$k]) ? $pc['prices'][$k] : null),
                    'sale_enabled' => isset($pc['enabled_sale'][$k]) ? ($pc['enabled_sale'][$k] === '1') : null,
                    'sale_price' => fts_num(isset($pc['sale_prices'][$k]) ? $pc['sale_prices'][$k] : null),
                    'pricing_type' => isset($pc['pricing_types'][$k]) ? $pc['pricing_types'][$k] : null,
                    'min_pax' => fts_num(isset($pc['min_paxes'][$k]) ? $pc['min_paxes'][$k] : null),
                    'max_pax' => fts_num(isset($pc['max_paxes'][$k]) ? $pc['max_paxes'][$k] : null),
                    'group_pricing' => isset($meta['group-pricing'][$k]) && is_array($meta['group-pricing'][$k]) ? $meta['group-pricing'][$k] : [],
                    'currency' => $currency,
                ];
            }
        }
        if (isset($meta['package-dates']) && is_array($meta['package-dates'])) {
            $pricing['dates'] = $meta['package-dates'];
        }
        $out[] = [
            'core' => $core,
            'meta' => $meta,
            'taxonomies' => $taxonomies,
            'pricing' => $pricing,
        ];
    }
    return $out;
}

function fts_num($v) {
    if ($v === null || $v === '') return null;
    if (is_numeric($v)) return 0 + $v;
    return null;
}

function fts_get_global_currency() {
    if (defined('FTS_TRIP_DEFAULT_CURRENCY') && FTS_TRIP_DEFAULT_CURRENCY) return FTS_TRIP_DEFAULT_CURRENCY;
    $opt_names = [
        'wp_travel_engine_settings',
        'wptravelengine_settings',
        'wptravelengine_options',
        'wpte_settings',
        'wte_settings',
        'wp_travel_engine_option',
    ];
    foreach ($opt_names as $name) {
        $opt = get_option($name);
        if (!$opt) continue;
        if (is_string($opt)) {
            $decoded = json_decode($opt, true);
            if (is_array($decoded)) $opt = $decoded; else $opt = null;
        }
        if (is_array($opt)) {
            foreach (['currency', 'trip_currency', 'default_currency', 'wte_currency'] as $k) {
                if (isset($opt[$k]) && $opt[$k]) return $opt[$k];
            }
        }
    }
    $wc = get_option('woocommerce_currency');
    if (is_string($wc) && $wc !== '') return $wc;
    return null;
}
/**
 * Enable REST API for WP Travel Engine Extra Services CPT
 */
add_action('init', function () {
    global $wp_post_types;

    // CPT name used by WP Travel Engine
    $cpt = 'wte-extra-services';

    if (isset($wp_post_types[$cpt])) {
        $wp_post_types[$cpt]->show_in_rest = true;
        $wp_post_types[$cpt]->rest_base = 'wte-extra-services';
        $wp_post_types[$cpt]->rest_controller_class = 'WP_REST_Posts_Controller';
    }
});

/**
 * Register custom trip facts for WordPress Travel Engine
 * This ensures all trip facts published via API appear in the backend Trip Info dropdown
 */
add_filter('wp_travel_engine_default_trip_facts', function($default_facts) {
    // Ensure default facts is an array
    if (!is_array($default_facts)) {
        $default_facts = [];
    }
    
    // Core trip facts with their WordPress FactIDs
    $custom_facts = [
        '12647846' => [
            'name' => 'Language',
            'icon' => 'fas fa-language',
            'fid'  => '12647846',
            'select_options' => ['English', 'Arabic', 'French', 'Spanish', 'German']
        ],
        '35550118' => [
            'name' => 'Transportation',
            'icon' => 'fas fa-bus',
            'fid'  => '35550118',
            'select_options' => ['As per itinerary', 'Air-conditioned vehicle', 'Private vehicle']
        ],
        '90730383' => [
            'name' => 'Tour Type',
            'icon' => 'fas fa-users',
            'fid'  => '90730383',
            'select_options' => ['Private Tour', 'Group Tour', 'Small Group']
        ],
        '97932390' => [
            'name' => 'Duration',
            'icon' => 'fas fa-clock',
            'fid'  => '97932390',
            'select_options' => ['6 hours', '8 hours', 'Full day', 'Half day', 'Multi-day']
        ],
        '97943192' => [
            'name' => 'Tour Availability',
            'icon' => 'fas fa-calendar-check',
            'fid'  => '97943192',
            'select_options' => ['Daily', 'Everyday', 'On request']
        ],
        '97950890' => [
            'name' => 'Pickup & Drop Off',
            'icon' => 'fas fa-map-marker-alt',
            'fid'  => '97950890',
            'select_options' => ['Available', 'Hotel pickup included', 'Meeting point provided']
        ],
        '69801669' => [
            'name' => 'Meals',
            'icon' => 'fas fa-utensils',
            'fid'  => '69801669',
            'select_options' => ['VIP Lunch included', 'As per itinerary', 'Breakfast included', 'Not included']
        ],
        '97927509' => [
            'name' => 'Guiding method',
            'icon' => 'fas fa-user-tie',
            'fid'  => '97927509',
            'select_options' => ['Professional guide', 'Audio guide', 'Self-guided']
        ],
        '93988162' => [
            'name' => 'Group Size',
            'icon' => 'fas fa-users',
            'fid'  => '93988162',
            'select_options' => ['Small group', 'Private', 'Large group']
        ],
        '28890066' => [
            'name' => 'Accomodation',
            'icon' => 'fas fa-hotel',
            'fid'  => '28890066',
            'select_options' => ['As per itinerary', '4-star hotels', '5-star hotels', 'Not included']
        ]
    ];
    
    // Merge custom facts with default facts
    // Custom facts will override defaults if same key exists
    foreach ($custom_facts as $fid => $fact_data) {
        $default_facts[$fid] = $fact_data;
    }
    
    return $default_facts;
}, 10, 1);

/**
 * Alternative filter for older WP Travel Engine versions
 */
add_filter('wte_trip_facts_field_options', function($options) {
    if (!is_array($options)) {
        $options = [];
    }
    
    // Simple key-value mapping for dropdown
    $custom_options = [
        '12647846' => 'Language',
        '35550118' => 'Transportation',
        '90730383' => 'Tour Type',
        '97932390' => 'Duration',
        '97943192' => 'Tour Availability',
        '97950890' => 'Pickup & Drop Off',
        '69801669' => 'Meals',
        '97927509' => 'Guiding method',
        '93988162' => 'Group Size',
        '28890066' => 'Accomodation'
    ];
    
    foreach ($custom_options as $fid => $label) {
        $options[$fid] = $label;
    }
    
    return $options;
}, 10, 1);

/**
 * Helper: Check for existing translation
 */
function fts_get_trip_translation_id($trip_id, $lang) {
    if (defined('ICL_SITEPRESS_VERSION')) {
        return apply_filters('wpml_object_id', $trip_id, 'trip', false, $lang);
    }
    return null;
}

/**
 * Helper: Auto-translate trip if missing
 * This is a placeholder for actual AI translation logic
 */
function fts_auto_translate_trip($trip_id, $target_lang) {
    // 1. Get original post
    $original_post = get_post($trip_id);
    if (!$original_post) return null;

    // 2. Check if we already have a translation (double check)
    $existing = fts_get_trip_translation_id($trip_id, $target_lang);
    if ($existing) return $existing;

    // 3. Prepare translated content (PLACEHOLDER)
    // Here you would call Google Translate API / DeepSeek API
    // For now, we will just duplicate the post and append language code
    // TODO: Integrate actual Translation API here
    
    $translated_title = $original_post->post_title . ' [' . strtoupper($target_lang) . ']';
    // Example: $translated_title = my_translation_api_function($original_post->post_title, $target_lang);
    
    // Generate Translated Slug (Important for Permalink structure)
    // Placeholder: append language code to original slug if real translation is not available
    // In production, you should translate the title and sanitize it to create a proper slug
    $translated_slug = $original_post->post_name . '-' . $target_lang; 
    // Example: $translated_slug = sanitize_title($translated_title);

    $translated_content = $original_post->post_content; 
    // Example: $translated_content = my_translation_api_function($original_post->post_content, $target_lang);
    
    $translated_excerpt = $original_post->post_excerpt;

    // 4. Create new post
    $new_post_id = wp_insert_post([
        'post_title'   => $translated_title,
        'post_name'    => $translated_slug, // Set slug explicitly
        'post_content' => $translated_content,
        'post_excerpt' => $translated_excerpt,
        'post_status'  => 'draft', // Keep as draft for review
        'post_type'    => 'trip',
        'post_author'  => $original_post->post_author
    ]);

    if (is_wp_error($new_post_id)) return null;

    // 5. Copy Meta Data
    $meta = get_post_meta($trip_id);
    foreach ($meta as $key => $values) {
        // Skip internal or specific meta keys if needed
        foreach ($values as $v) {
            add_post_meta($new_post_id, $key, maybe_unserialize($v));
        }
    }

    // 6. Link Translations (WPML)
    if (defined('ICL_SITEPRESS_VERSION')) {
        $element_type = fts_wpml_element_type_for_post_type('trip');
        $original_lang = 'en';
        $trid = null;

        $details = apply_filters('wpml_element_language_details', null, [
            'element_id' => $trip_id,
            'element_type' => $element_type
        ]);

        if ($details && !is_wp_error($details)) {
            if (!empty($details->language_code)) $original_lang = $details->language_code;
            if (!empty($details->trid)) $trid = $details->trid;
        }

        do_action('wpml_set_element_language_details', [
            'element_id' => $new_post_id,
            'element_type' => $element_type,
            'trid' => $trid,
            'language_code' => $target_lang,
            'source_language_code' => $original_lang
        ]);
    }

    return $new_post_id;
}

/**
 * CREATE package (POST /fts/v1/packages)
 */
function fts_create_package(WP_REST_Request $request) {
    $title = sanitize_text_field($request->get_param('title'));
    $status = $request->get_param('status') ?: 'publish';
    $trip_id = intval($request->get_param('trip_id')); // Optional: for future use or logging

    if (empty($title)) {
        return new WP_Error('rest_invalid_param', 'title is required', ['status' => 400]);
    }
    
    // Create Post
    $post_id = wp_insert_post([
        'post_title' => $title,
        'post_type' => 'trip-packages',
        'post_status' => $status
    ]);
    
    if (is_wp_error($post_id)) {
        return $post_id;
    }
    
    // Transform and Save Pricing Categories
    $pricing_cats = $request->get_param('pricing_categories');
    if (is_array($pricing_cats)) {
        $wte_cats = [
            'c_ids' => [],
            'labels' => [],
            'prices' => [],
            'sale_prices' => [],
            'min_paxes' => [],
            'max_paxes' => [],
            'pricing_types' => [],
            'enabled_sale' => [],
            'enabled_group_discount' => []
        ];
        
        $group_pricing = [];
        
        foreach ($pricing_cats as $idx => $cat) {
             // Use provided ID if available, otherwise generate one
             if (isset($cat['id']) && !empty($cat['id'])) {
                 $cid_str = (string)$cat['id'];
             } else {
                 // Generate a simple numeric ID (safe for WTE JS compatibility)
                 // Using values > 10 to resemble typical IDs
                 $cid_str = (string)($idx + 11);
             }
             $cid = $cid_str; // Key is string
             
             $wte_cats['c_ids'][$cid] = (int)$cid_str; // Value is integer
             $wte_cats['labels'][$cid] = isset($cat['label']) ? sanitize_text_field($cat['label']) : 'Standard';
             // Save as is (sanitized) to avoid floatval converting "100" to 100.0 if WTE prefers strings, 
             // but ensure it's numeric-ish.
             $wte_cats['prices'][$cid] = isset($cat['regular_price']) ? (string)$cat['regular_price'] : '0';
             $wte_cats['sale_prices'][$cid] = isset($cat['sale_price']) ? (string)$cat['sale_price'] : '0';
             $wte_cats['min_paxes'][$cid] = isset($cat['min_pax']) ? intval($cat['min_pax']) : 0;
             $wte_cats['max_paxes'][$cid] = isset($cat['max_pax']) ? intval($cat['max_pax']) : 100;
             $wte_cats['pricing_types'][$cid] = isset($cat['pricing_type']) ? sanitize_text_field($cat['pricing_type']) : 'per-person';
             $wte_cats['enabled_sale'][$cid] = (isset($cat['sale_price']) && $cat['sale_price'] > 0) ? '1' : '0';
             
             if (isset($cat['group_pricing']) && is_array($cat['group_pricing'])) {
                 $group_pricing[$cid] = $cat['group_pricing'];
                 
                 // Only enable group discount flag if there are actual prices > 0
                 $has_valid_gp = false;
                 foreach($cat['group_pricing'] as $gp) {
                    if (isset($gp['price']) && floatval($gp['price']) > 0) {
                        $has_valid_gp = true;
                        break;
                    }
                 }
                 if ($has_valid_gp) {
                    $wte_cats['enabled_group_discount'][$cid] = '1';
                 }
             }
        }
        
        update_post_meta($post_id, 'package-categories', $wte_cats);
        
        if (!empty($group_pricing)) {
            update_post_meta($post_id, 'group-pricing', $group_pricing);
        }
    }
    
    return rest_ensure_response(['id' => $post_id]);
}

/**
 * Rank Math Content Analysis Integration for WP Travel Engine
 * Merges trip details (Overview, Itinerary, etc.) into the analysis content.
 */
add_filter( 'rank_math/frontend/content', function( $content ) {
    global $post;
    
    // Check if we are analyzing a Trip
    if ( ! $post || 'trip' !== $post->post_type ) {
        return $content;
    }

    // Get WP Travel Engine Settings
    $settings = get_post_meta( $post->ID, 'wp_travel_engine_setting', true );
    
    if ( ! empty( $settings ) && is_array( $settings ) ) {
        
        // 1. Overview & Tab Content
        if ( isset( $settings['tab_content'] ) && is_array( $settings['tab_content'] ) ) {
            foreach ( $settings['tab_content'] as $tab_text ) {
                $content .= ' ' . $tab_text;
            }
        }
        
        // 2. Itinerary
        if ( isset( $settings['trip_itinerary'] ) && is_array( $settings['trip_itinerary'] ) ) {
            foreach ( $settings['trip_itinerary'] as $day ) {
                $content .= ' ' . ( isset( $day['title'] ) ? $day['title'] : '' );
                $content .= ' ' . ( isset( $day['content'] ) ? $day['content'] : '' );
            }
        }
        
        // 3. Highlights
        if ( isset( $settings['trip_highlights'] ) && is_array( $settings['trip_highlights'] ) ) {
            foreach ( $settings['trip_highlights'] as $highlight ) {
                 $content .= ' ' . ( isset( $highlight['highlight_text'] ) ? $highlight['highlight_text'] : '' );
            }
        }
    }

    return $content;
});

/**
 * Helper to extract WTE content
 */
function fts_get_wte_content_for_seo($post_id) {
    // Try both meta keys
    $settings = get_post_meta($post_id, 'wp_travel_engine_setting', true);
    if (!$settings) {
        $settings = get_post_meta($post_id, 'wpte_trip_settings', true);
    }
    
    // Decode if it's a JSON string (some versions store as string)
    if (is_string($settings)) {
        $decoded = json_decode($settings, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $settings = $decoded;
        }
    }

    $extra_content = '';

    if (!empty($settings) && is_array($settings)) {
        // 1. Overview & Tab Content
        if (isset($settings['tab_content']) && is_array($settings['tab_content'])) {
            foreach ($settings['tab_content'] as $tab_text) {
                $extra_content .= ' ' . $tab_text . "\n";
            }
        }
        
        // 2. Itinerary
        if (isset($settings['trip_itinerary']) && is_array($settings['trip_itinerary'])) {
            foreach ($settings['trip_itinerary'] as $day) {
                $extra_content .= ' ' . (isset($day['title']) ? $day['title'] : '') . "\n";
                $extra_content .= ' ' . (isset($day['content']) ? $day['content'] : '') . "\n";
            }
        }
        
        // 3. Highlights
        if (isset($settings['trip_highlights']) && is_array($settings['trip_highlights'])) {
            foreach ($settings['trip_highlights'] as $highlight) {
                 $extra_content .= ' ' . (isset($highlight['highlight_text']) ? $highlight['highlight_text'] : '') . "\n";
            }
        }
    }
    return $extra_content;
}

/**
 * Inject WTE Content into Rank Math JS Analysis (Editor Side)
 */
add_action('enqueue_block_editor_assets', function() {
    global $post;
    if (!$post && isset($_GET['post'])) {
        $post = get_post($_GET['post']);
    }
    
    if (!$post || 'trip' !== $post->post_type) {
        return;
    }

    $extra_content = fts_get_wte_content_for_seo($post->ID);
    
    if (empty($extra_content)) {
        return;
    }

    // Sanitize for JS string
    // Use JSON_UNESCAPED_UNICODE to preserve Arabic/special chars
    $js_content_var = json_encode($extra_content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    // Register a dummy script handle to attach inline script
    wp_register_script('fts-rm-injector', false, ['wp-hooks', 'wp-data', 'wp-plugins']);
    wp_enqueue_script('fts-rm-injector');
    
    // Inject the JS hook with robust retry and multiple hooks
    wp_add_inline_script('fts-rm-injector', "
        (function() {
            var wteSeoContent = {$js_content_var};
            var retries = 0;
            
            function initRankMathHook() {
                if (typeof wp !== 'undefined' && typeof wp.hooks !== 'undefined') {
                    // Hook into Rank Math content analysis (Standard)
                    wp.hooks.addFilter('rank_math_content', 'fts/wte_content_merger', function(content) {
                        return (content || '') + ' ' + wteSeoContent;
                    });
                    
                    // Force refresh analysis if RankMath API is available
                    if (window.rankMathEditor && window.rankMathEditor.refresh) {
                         window.rankMathEditor.refresh('content');
                    }
                    
                    // Fallback: Dispatch a harmless change to trigger watchers
                    // (Changing a meta field slightly or just reading state)
                    if (typeof wp.data !== 'undefined') {
                        // Check if we can trigger an update
                        var select = wp.data.select('core/editor');
                        if (select) {
                            var currentContent = select.getEditedPostAttribute('content');
                            // Just accessing it might be enough in some cases, but usually need an action.
                            // We avoid dispatching 'editPost' to avoid dirtying the state if not needed.
                        }
                    }

                } else {
                    if (retries < 20) {
                        retries++;
                        setTimeout(initRankMathHook, 500);
                    }
                }
            }
            
            // Wait for DOM ready as well
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initRankMathHook);
            } else {
                initRankMathHook();
            }
        })();
    ");
});
