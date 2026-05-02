<?php
/**
 * Single Trip Customizations
 * 
 * - Adds "Trip Video URL" meta box
 * - Injects Video into Gallery
 * - FIXES: Mobile Slider Robust Display & Native Touch Scrolling
 */

// 1. ADD VIDEO URL FIELD
add_action('add_meta_boxes', function() {
    add_meta_box('fts_video_meta_box', __('Trip Video URL', 'travel-monster-child'), function($post) {
        $video_url = get_post_meta($post->ID, '_fts_featured_video_url', true);
        wp_nonce_field('fts_save_video_meta', 'fts_video_meta_nonce');
        echo '<p><label style="font-weight:bold;">Video URL (YouTube/Vimeo):</label>';
        echo '<input type="url" name="fts_featured_video_url" value="'.esc_url($video_url).'" class="widefat" style="margin-top:5px;"></p>';
    }, 'trip', 'normal', 'high');
});
add_action('save_post', function($post_id) {
    if (isset($_POST['fts_featured_video_url']) && wp_verify_nonce($_POST['fts_video_meta_nonce'], 'fts_save_video_meta')) {
        update_post_meta($post_id, '_fts_featured_video_url', esc_url_raw($_POST['fts_featured_video_url']));
    }
});

// 2. INJECT VIDEO HTML (Server Side)
// 2. INJECT VIDEO THUMBNAIL (Server Side) - REMOVED
// We will handle the image swap and overlay entirely via JS to guarantee the Grid Layout remains 100% intact.

// 3. CSS & JS (Run LAST with Priority 9999)
// 3. CSS & JS (User's Mobile Slider + Video Support)
add_action('wp_footer', function() {
    if (!is_singular('trip')) return;
    
    $v_url = get_post_meta(get_the_ID(), '_fts_featured_video_url', true);
    $embed = '';
    $thumb = '';
    
    if ($v_url) {
        // Embed & Thumb Logic
        $thumb = get_the_post_thumbnail_url(get_the_ID(), 'full') ?: WP_TRAVEL_ENGINE_IMG_URL.'/public/css/images/single-trip-featured-img.jpg';
        
        if (strpos($v_url, 'youtube')!==false) { 
            preg_match('/([a-zA-Z0-9_-]{11})/', $v_url, $m); 
            $embed='https://www.youtube.com/embed/'.($m[1]??'').'?autoplay=1'; 
            if(!empty($m[1])) $thumb = 'https://img.youtube.com/vi/'.$m[1].'/hqdefault.jpg'; // hqdefault is safer than maxres
        }
        elseif (strpos($v_url, 'vimeo')!==false) { 
            preg_match('/(\d+)/', $v_url, $m); 
            $embed='https://player.vimeo.com/video/'.($m[1]??'').'?autoplay=1'; 
            // Try fetch vimeo thumb (server-side to avoid JS async complexity)
            $hash = unserialize(file_get_contents("http://vimeo.com/api/v2/video/".($m[1]??'').".php"));
            if(isset($hash[0]['thumbnail_large'])) $thumb = $hash[0]['thumbnail_large'];
        }
    }
    ?>
    <style>
        /* ... existing styles ... */
        .fts-video-slide { height: 100%; position: relative; }
        .fts-play-button-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 10; pointer-events: none; background: rgba(0,0,0,0.1); }
        .fts-play-button { width:60px; height:60px; background:rgba(0,0,0,0.7); border-radius:50%; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .fts-play-button::before { content:''; display:block; width:0; height:0; border:solid 12px transparent; border-left:solid 20px #fff; margin-left:6px; }

        /* USER'S CSS (Optimized) */
        .fts-hide { display: none !important; }
        @media (max-width: 767px) {
            .mobile-slider .ms-item[data-type="video"]::after {
                 /* Optional overlay gradient for better contrast */
                 content: ''; position: absolute; top:0; left:0; width:100%; height:100%;
                 background: rgba(0,0,0,0.2); pointer-events:none; z-index: 1;
            }
            .mobile-slider { position: relative; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 10px; padding: 10px 0; -webkit-overflow-scrolling: touch; }
            .mobile-slider .ms-item { width: 80%; flex: 0 0 auto; scroll-snap-align: start; border-radius: 10px; position: relative; overflow: hidden; height: 220px; }
            .mobile-slider img { width: 100%; height: 100%; object-fit: cover; }
            
            /* Arrows */
            .mobile-slider .ms-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0, 0, 0, 0.6); color: #fff; border: none; padding: 0; cursor: pointer; font-size: 16px; z-index: 10; border-radius: 50px; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }
            .mobile-slider .ms-arrow:hover { background: rgba(0, 0, 0, 0.8); transform: translateY(-50%) scale(1.1); }
            .mobile-slider .ms-arrow.prev { left: 10px; }
            .mobile-slider .ms-arrow.next { right: 10px; }
        }
        @media (min-width: 768px) {
            .mobile-slider { display: none !important; }
        }

        /* POPUP STYLES */
        .image-popup-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.95); display: flex; align-items: center; justify-content: center; z-index: 99999; animation: fadeIn 0.3s ease; }
        .image-popup-container { position: relative; width: 95vw; max-width: 1000px; height: auto; max-height: 90vh; display: flex; align-items: center; justify-content: center; }
        .popup-image { max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 8px; user-select: none; }
        .popup-iframe { width: 100%; height: 50vh; border: none; border-radius: 8px; background: #000; }
        .popup-close { position: absolute; top: -50px; right: 0; background: rgba(255, 255, 255, 0.2); color: #fff; border: none; font-size: 30px; width: 40px; height: 40px; border-radius: 50px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 100; }
        .popup-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255, 255, 255, 0.2); color: white; border: none; font-size: 20px; width: 50px; height: 50px; border-radius: 50px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s ease; z-index: 100; }
        .popup-prev { left: -60px; } .popup-next { right: -60px; }
        .popup-counter { position: absolute; bottom: -40px; left: 50%; transform: translateX(-50%); color: white; font-size: 16px; background: rgba(0, 0, 0, 0.7); padding: 8px 16px; border-radius: 20px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        @media (max-width: 768px) {
            .popup-prev { left: 10px; } .popup-next { right: 10px; }
            .popup-close { top: 10px; right: 10px; background: rgba(0,0,0,0.5); }
        }
    </style>
    <script>
    // ROBUST INITIALIZATION (Self-Healing)
    var ftsInitAttempts = 0;
    var ftsSliderInited = false;
    
    function ftsInitGalleryFeatures() {
        var videoUrl = '<?php echo esc_js($embed); ?>';
        var videoThumb = '<?php echo esc_js($thumb); ?>';
        var isMobile = window.innerWidth < 768; // Dynamic check
        
        // 1. DESKTOP GRID FIX (Run once)
        if (!isMobile && videoUrl) {
           // Desktop logic is stable, run it immediately if element exists
           var targetContainer = document.querySelector('.wpte-multi-banner-image') || document.querySelector('.wpte-trip-feat-img');
           if(targetContainer && !targetContainer.classList.contains('fts-processed')) {
               targetContainer.classList.add('fts-processed'); // Mark as done
               
               // Swap Image
               var img = targetContainer.querySelector('img');
               if (img && videoThumb) { img.src = videoThumb; img.srcset = ''; }

               // Visuals
               if (getComputedStyle(targetContainer).position === 'static') targetContainer.style.position = 'relative';
               targetContainer.style.cursor = 'pointer';
               var btn = document.createElement('div');
               btn.className = 'fts-play-button-overlay';
               btn.innerHTML = '<div class="fts-play-button"></div>';
               targetContainer.appendChild(btn);
               
               // Trigger
               var trig = document.querySelector('.wte-trip-image-gal-popup-trigger');
               targetContainer.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); if(trig) trig.click(); });
               if(img) img.addEventListener('click', function(e){ e.preventDefault(); if(trig) trig.click(); });
               
               // Inject Video Data
               if(trig) {
                   try {
                       var raw = trig.getAttribute('data-items') || '[]';
                       var data = JSON.parse(raw.replace(/&quot;/g, '"'));
                       var v = {src: videoUrl, type: 'iframe', opts: {caption: 'Video'}};
                       if(data.length===0 || (data.length>0 && data[0].type!=='iframe')) {
                           data.unshift(v);
                           trig.setAttribute('data-items', JSON.stringify(data));
                       }
                   } catch(e){}
               }
           }
        }

        // 2. MOBILE SLIDER BUILDER (Polling)
        if (isMobile) {
            // Check if already exists
            if (document.querySelector('.mobile-slider')) return;
            
            const galleryTrigger = document.querySelector('.wte-trip-image-gal-popup-trigger');
            const featuredImage = document.querySelector('.wpte-trip-feat-img');
            
            // If elements ready
            if (galleryTrigger && featuredImage) {
                 // Build Slider Logic (Same as before, just wrapped)
                 ftsBuildMobileSlider(galleryTrigger, featuredImage, videoUrl, videoThumb);
            }
        }
    }

    function ftsBuildMobileSlider(galleryTrigger, featuredImage, videoUrl, videoThumb) {
        // [Existing Slider Builder Code Wrapper]
        // Re-scrape data
        try {
            const jsonStr = galleryTrigger.getAttribute('data-items');
            if(!jsonStr) return;
            // Inject video if needed (ensure data has video)
            var images = JSON.parse(jsonStr.replace(/&quot;/g, '"'));
            
             // Video Object injection check locally for this scope
             if(videoUrl) {
                var v = {src: videoUrl, type: 'iframe', opts: {caption: 'Video'}};
                if(images.length===0 || (images.length>0 && images[0].type!=='iframe')) {
                    images.unshift(v);
                }
             }

            const slider = document.createElement('div');
            slider.classList.add('mobile-slider');

            images.forEach((item, index) => {
                const slide = document.createElement('div');
                slide.classList.add('ms-item');
                let content = '';
                
                // Video Slide
                if (item.type === 'iframe' || (item.src && (item.src.indexOf('youtube') > -1 || item.src.indexOf('vimeo') > -1))) {
                    let tSrc = videoThumb || '<?php echo WP_TRAVEL_ENGINE_IMG_URL . "/public/css/images/single-trip-featured-img.jpg"; ?>';
                    content = `<img src="${tSrc}" style="width:100%;height:100%;object-fit:cover;">
                               <div class="fts-play-button"></div>`;
                    slide.setAttribute('data-type', 'video');
                } else {
                    content = `<img src="${item.src}" loading="lazy">`;
                }
                
                slide.innerHTML = content;
                slide.addEventListener('click', (e) => { openImagePopup(item, images, index); });
                slider.appendChild(slide);
            });

            // Insert & Arrows
            featuredImage.parentNode.insertBefore(slider, featuredImage);
            
            // HIDE ORIGINAL ONLY NOW (Safe Fallback)
            featuredImage.classList.add('fts-hide');
            
            const prevArrow = document.createElement('button'); prevArrow.className = 'ms-arrow prev'; prevArrow.innerHTML = '❮';
            const nextArrow = document.createElement('button'); nextArrow.className = 'ms-arrow next'; nextArrow.innerHTML = '❯';
            slider.appendChild(prevArrow); slider.appendChild(nextArrow);
            
            // Logic
            let currentSlide = 0;
            const totalSlides = images.length;
            
            function updateArrows() {
                requestAnimationFrame(() => {
                   prevArrow.style.left = (slider.scrollLeft + 10) + 'px';
                   nextArrow.style.left = (slider.scrollLeft + slider.offsetWidth - 45) + 'px';
                   nextArrow.style.right = 'auto'; 
                });
            }
            
            function goToSlide(index) {
                const item = slider.querySelector('.ms-item');
                if(!item) return;
                const width = item.offsetWidth + 10;
                slider.scrollTo({ left: index * width, behavior: 'smooth' });
                currentSlide = index;
            }
            
            nextArrow.addEventListener('click', (e) => { e.preventDefault(); goToSlide((currentSlide + 1) % totalSlides); });
            prevArrow.addEventListener('click', (e) => { e.preventDefault(); goToSlide((currentSlide - 1 + totalSlides) % totalSlides); });
            slider.addEventListener('scroll', updateArrows, { passive: true });
            setTimeout(updateArrows, 100);
            
            // Mark as done
            ftsSliderInited = true;
            if(window.ftsPoll) clearInterval(window.ftsPoll); // Stop polling immediately if we succeed
            
        } catch(e) { console.error('FTS Slider Error', e); }
    }
    
    // Universal Popup Logic (Global)
    function openImagePopup(currentItem, allItems, startIndex) {
        // [Existing Popup Code]
        const popup = document.createElement('div');
        popup.className = 'image-popup-overlay';
        popup.innerHTML = `<div class="image-popup-container">
                <button class="popup-close">&times;</button>
                <button class="popup-arrow popup-prev">❮</button>
                <div class="popup-content-wrapper" style="width:100%;display:flex;justify-content:center;"></div>
                <button class="popup-arrow popup-next">❯</button>
                <div class="popup-counter"><span class="cur"></span> / <span class="tot"></span></div>
            </div>`;
        document.body.appendChild(popup);
        
        let cIndex = startIndex;
        const wrapper = popup.querySelector('.popup-content-wrapper');
        
        function updateContent() {
            const item = allItems[cIndex];
            popup.querySelector('.cur').textContent = cIndex + 1;
            popup.querySelector('.tot').textContent = allItems.length;
            
            wrapper.innerHTML = '';
            
            if (item.type === 'iframe' || (item.src && (item.src.indexOf('youtube') > -1 || item.src.indexOf('vimeo') > -1))) {
                 let s = item.src;
                 if(s.indexOf('?')===-1) s+='?autoplay=1'; else s+='&autoplay=1';
                 wrapper.innerHTML = `<iframe class="popup-iframe" src="${s}" allow="autoplay; fullscreen" allowfullscreen style="background:#000;"></iframe>`;
            } else {
                 wrapper.innerHTML = `<img class="popup-image" src="${item.src}">`;
            }
        }
        updateContent();
        const close = () => document.body.removeChild(popup);
        popup.querySelector('.popup-close').addEventListener('click', close);
        popup.addEventListener('click', (e) => { if(e.target === popup) close(); });
        popup.querySelector('.popup-next').addEventListener('click', () => { cIndex = (cIndex+1)%allItems.length; updateContent(); });
        popup.querySelector('.popup-prev').addEventListener('click', () => { cIndex = (cIndex-1+allItems.length)%allItems.length; updateContent(); });
    }

    // --- EXECUTION STRATEGY ---
    // 1. Run on Load
    window.addEventListener('load', ftsInitGalleryFeatures);
    
    // 2. Run on DOMContent (Early attempt)
    document.addEventListener('DOMContentLoaded', ftsInitGalleryFeatures);
    
    // 3. Polling (The Mobile Fix - Try every 500ms for 3s)
    window.ftsPoll = setInterval(function(){
        ftsInitGalleryFeatures();
        ftsInitAttempts++;
        if(ftsInitAttempts > 6) clearInterval(window.ftsPoll); // Stop after 3s
    }, 500);

    </script>
    <?php
}, 9999);
