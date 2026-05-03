/**
 * FTS Trip Design V2 — Consolidated Interactions
 * Uses ftsV2Data (wp_localize_script) for PHP data.
 */
(function() {
    'use strict';

    function ftsT(key, fallback) {
        var fb = (fallback === undefined || fallback === null) ? '' : String(fallback);
        var root = (typeof window !== 'undefined') ? window : this;
        var data = root && root.ftsV2Data ? root.ftsV2Data : null;
        var i18n = data && data.i18n ? data.i18n : null;
        var value = i18n ? i18n[key] : null;
        if (typeof value === 'string') {
            var s = value.trim();
            if (s) return s;
        }
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
            console.warn('[fts-i18n] Missing key: ' + key);
        }
        return fb;
    }

    function ftsTArray(key, expectedLen) {
        var root = (typeof window !== 'undefined') ? window : this;
        var data = root && root.ftsV2Data ? root.ftsV2Data : null;
        var i18n = data && data.i18n ? data.i18n : null;
        var value = i18n ? i18n[key] : null;
        if (Array.isArray(value) && (!expectedLen || value.length === expectedLen)) return value;
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
            console.warn('[fts-i18n] Missing/invalid key: ' + key);
        }
        var len = expectedLen || 0;
        var out = [];
        for (var i = 0; i < len; i++) out.push('');
        return out;
    }

    function ftsV2Boot($) {

        var data      = (typeof ftsV2Data !== 'undefined') ? ftsV2Data : {};
        var allUrls   = data.galleryUrls  || [];
        var allThumbs = data.galleryThumbs || [];
        var allTitles = data.galleryTitles || [];
        var fsdDates  = data.fsdDates      || {};
        var excludedDates = data.excludedDates || {};
        var excludedDatesYearly = data.excludedDatesYearly || {};
        var tripId    = data.tripId        || 0;

        function isDateExcluded(dateKey) {
            if (excludedDates[dateKey]) return true;
            var md = dateKey.replace(/-/g, '').substring(4);
            if (excludedDatesYearly[md]) return true;
            return false;
        }
        var esData    = data.extraServices || [];
        var mobPerPerson = ftsT('per_person');
        var mobFreeCancellation = ftsT('free_cancellation');
        var mobBookNow = ftsT('book_now');
        var selectTravelersText = ftsT('select_travelers');
        var adultSing = ftsT('adult_singular');
        var adultPlur = ftsT('adult_plural');
        var childSing = ftsT('child_singular');
        var childPlur = ftsT('child_plural');
        var perPersonCompact = ftsT('per_person_compact');
        var secureBookingText = ftsT('secure_booking');
        var secureBookingWithPriceTpl = ftsT('secure_booking_with_price');
        var notAvailableText = ftsT('not_available');
        var processingText = ftsT('processing');
        var bookingDataNaText = ftsT('booking_data_na');
        var errorGenericText = ftsT('error_generic');
        var errorConnectionText = ftsT('error_connection');
        var ageAdultText = ftsT('age_adult', 'Age 12+');
        var ageYearsText = ftsT('age_years', 'years');
        var discountOffTpl = ftsT('discount_off', '%s OFF');
        var monthsShort = ftsTArray('months_short', 12);
        var daysFull = ftsTArray('days_full', 7);
        var daysMin = ftsTArray('days_min', 7);

        function ensureBookingModalFallbackStyles() {
            if (document.getElementById('fts-bm-js-fallback-style')) return;
            var css = '' +
                '#fts-booking-modal,#fts-booking-modal *{box-sizing:border-box!important}' +
                '#fts-booking-modal .fts-bm-container{max-width:920px!important;max-height:90vh!important;border-radius:16px!important}' +
                '#fts-booking-modal .fts-bm-body{padding:20px!important;overflow-y:auto!important}' +
                '#fts-booking-modal .fts-bm-step{margin-bottom:22px!important}' +
                '#fts-booking-modal .fts-bm-step-header{display:flex!important;align-items:center!important;gap:12px!important;margin-bottom:14px!important}' +
                '#fts-booking-modal .fts-bm-step-num{width:32px!important;height:32px!important;border-radius:50%!important;background:var(--v2-primary,#ff6b35)!important;color:#fff!important;font-size:16px!important;font-weight:700!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important}' +
                '#fts-booking-modal .fts-bm-step-header>span:last-child{font-family:var(--v2-font-heading,Outfit,sans-serif)!important;font-size:24px!important;font-weight:700!important;color:#1a2332!important;line-height:1.2!important}' +
                '#fts-booking-modal .fts-bm-package-card{border:1.5px solid #e2e8f0!important;border-radius:12px!important;margin-bottom:12px!important;overflow:hidden!important;background:#fff!important}' +
                '#fts-booking-modal .fts-bm-package-card.selected{border-color:#e2e8f0!important;border-left:4px solid var(--v2-primary,#ff6b35)!important;background:#fff!important}' +
                '#fts-booking-modal .fts-bm-package-inner{display:flex!important;align-items:center!important;padding:14px!important;gap:12px!important}' +
                '#fts-booking-modal .fts-bm-package-radio input[type=radio]{width:20px!important;height:20px!important;accent-color:var(--v2-primary,#ff6b35)!important;margin:0!important}' +
                '#fts-booking-modal .fts-bm-package-name{font-family:var(--v2-font-heading,Outfit,sans-serif)!important;font-size:14px!important;font-weight:700!important;color:#1a2332!important;margin:0 0 2px!important;line-height:1.3!important}' +
                '#fts-booking-modal .fts-bm-package-desc{font-size:12px!important;color:#64748b!important;margin:0!important;line-height:1.45!important}' +
                '#fts-booking-modal .fts-bm-package-price{text-align:right!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:2px!important}' +
                '#fts-booking-modal .fts-bm-price-current{display:block!important;font-family:var(--v2-font-heading,Outfit,sans-serif)!important;font-size:22px!important;font-weight:800!important;color:#1a2332!important;line-height:1.2!important;margin-top:2px!important}' +
                '#fts-booking-modal .fts-bm-price-per{font-size:11px!important;color:#718096!important;display:block!important;line-height:1.1!important}' +
                '#fts-booking-modal .fts-bm-travelers-list{display:flex!important;flex-direction:column!important;gap:10px!important}' +
                '#fts-booking-modal .fts-bm-traveler-row{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:14px 16px!important;border:1.5px solid #e2e8f0!important;border-radius:10px!important;margin-bottom:0!important;background:#fff!important}' +
                '#fts-booking-modal .fts-bm-traveler-info{text-align:left!important;flex:1!important;min-width:0!important}' +
                '#fts-booking-modal .fts-bm-traveler-info strong{display:block!important;font-size:14px!important;font-weight:700!important;color:#1a2332!important}' +
                '#fts-booking-modal .fts-bm-traveler-meta{font-size:12px!important;color:#718096!important;margin-top:1px!important}' +
                '#fts-booking-modal .fts-bm-counter{display:flex!important;align-items:center!important;gap:12px!important}' +
                '#fts-booking-modal .fts-bm-counter-btn{width:36px!important;height:36px!important;border-radius:50%!important;border:1.5px solid #d1d5db!important;background:#fff!important;color:#374151!important;font-size:18px!important;font-weight:500!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;line-height:1!important}' +
                '#fts-booking-modal .fts-bm-counter-value{font-size:16px!important;font-weight:700!important;color:#1a2332!important;min-width:20px!important;text-align:center!important}' +
                '@media(max-width:768px){#fts-booking-modal .fts-bm-step-header>span:last-child{font-size:20px!important}#fts-booking-modal .fts-bm-package-name{font-size:13px!important}#fts-booking-modal .fts-bm-price-current{font-size:20px!important}#fts-booking-modal .fts-bm-price-per{font-size:11px!important}}';
            var style = document.createElement('style');
            style.id = 'fts-bm-js-fallback-style';
            style.textContent = css;
            document.head.appendChild(style);
        }

        /* ══════════════════════════════════════════════
           Sticky Tabs Navigation
           ══════════════════════════════════════════════ */
        var $tabsNav    = $('#fts-v2-tabs-nav');
        var $tabLinks   = $('.fts-v2-tab-link');
        var sections    = [];
        var $headerBar  = $('#fts-v2-trip-header');
        var headerH     = $headerBar.length ? $headerBar.outerHeight() : 56;
        var navHeight   = $tabsNav.length ? $tabsNav.outerHeight() + headerH + 10 : 60;

        $tabLinks.each(function() {
            var sec = $(this).attr('data-section');
            var $el = $('#fts-v2-sec-' + sec);
            if ($el.length) sections.push({ id: sec, $el: $el });
        });

        function updateActiveTab() {
            var scrollTop = $(window).scrollTop() + navHeight + 40;
            var current   = '';
            for (var i = 0; i < sections.length; i++) {
                if (sections[i].$el.offset().top <= scrollTop) current = sections[i].id;
            }
            $tabLinks.removeClass('active');
            if (current) $tabLinks.filter('[data-section="' + current + '"]').addClass('active');
        }

        $(window).on('scroll', function() {
            if ($tabsNav.length) {
                $tabsNav.toggleClass('scrolled', $(window).scrollTop() > $tabsNav.offset().top);
            }
            updateActiveTab();
        });

        $tabLinks.on('click', function(e) {
            e.preventDefault();
            var target = $(this.getAttribute('href'));
            if (target.length) $('html, body').animate({ scrollTop: target.offset().top - navHeight }, 500);
        });

        $('.fts-v2-root a[href^="#fts-v2-"]').not('.fts-v2-tab-link').on('click', function(e) {
            var target = $(this.getAttribute('href'));
            if (target.length) {
                e.preventDefault();
                $('html, body').animate({ scrollTop: target.offset().top - navHeight }, 500);
            }
        });

        /* ══════════════════════════════════════════════
           Gallery Lightbox
           ══════════════════════════════════════════════ */
        var currentIdx    = 0;
        var thumbsBuilt   = false;

        function buildThumbs() {
            if (thumbsBuilt || !allThumbs.length) return;
            var $c = $('#fts-v2-lb-thumbs');
            $.each(allThumbs, function(i, src) {
                $c.append('<div class="fts-v2-lb-thumb" data-idx="' + i + '"><img src="' + src + '" alt=""></div>');
            });
            $c.on('click', '.fts-v2-lb-thumb', function(e) {
                e.stopPropagation();
                openLightbox(parseInt($(this).data('idx'), 10));
            });
            thumbsBuilt = true;
        }

        function openLightbox(idx) {
            if (!allUrls[idx]) return;
            buildThumbs();
            currentIdx = idx;
            $('#fts-v2-lb-img').attr('src', allUrls[idx]);
            $('#fts-v2-lb-title').text(allTitles[idx] || '');
            $('#fts-v2-lb-counter').text((idx + 1) + ' / ' + allUrls.length);
            $('.fts-v2-lb-thumb').removeClass('active').eq(idx).addClass('active');

            var $thumbs = $('#fts-v2-lb-thumbs');
            var $active = $thumbs.find('.active');
            if ($active.length) {
                var scrollPos = $active[0].offsetLeft - ($thumbs.width() / 2) + ($active.outerWidth() / 2);
                $thumbs.animate({ scrollLeft: scrollPos }, 200);
            }

            $('#fts-v2-lightbox').addClass('active');
            $('body').css('overflow', 'hidden');
        }

        function closeLightbox() {
            $('#fts-v2-lightbox').removeClass('active');
            $('body').css('overflow', '');
        }

        $('.fts-v2-gallery-cell').on('click', function(e) {
            if ($(e.target).closest('.fts-v2-video-play').length) return;
            if ($(e.target).closest('[data-action="lightbox"]').length) {
                openLightbox(0);
                return;
            }
            openLightbox(parseInt($(this).data('index'), 10));
        });

        $('.fts-v2-gallery-show-all').on('click', function() { openLightbox(0); });

        $('.fts-v2-lb-close').on('click', closeLightbox);
        $('#fts-v2-lightbox').on('click', function(e) {
            if ($(e.target).closest('.fts-v2-lb-stage, .fts-v2-lb-footer, .fts-v2-lb-prev, .fts-v2-lb-next, .fts-v2-lb-close').length) return;
            closeLightbox();
        });

        $('.fts-v2-lb-next').on('click', function(e) {
            e.stopPropagation();
            openLightbox((currentIdx + 1) % allUrls.length);
        });

        $('.fts-v2-lb-prev').on('click', function(e) {
            e.stopPropagation();
            openLightbox((currentIdx - 1 + allUrls.length) % allUrls.length);
        });

        $('.fts-v2-photo-item').on('click', function() {
            var idx = $(this).index();
            var galleryOffset = allUrls.length - $('.fts-v2-photo-item').length;
            openLightbox(Math.max(0, galleryOffset) + idx);
        });

        /* ══════════════════════════════════════════════
           Video Modal
           ══════════════════════════════════════════════ */
        function closeVideo() {
            $('#fts-v2-video-iframe').attr('src', '');
            $('#fts-v2-video-modal').removeClass('active');
            $('body').css('overflow', '');
        }

        $('.fts-v2-video-play').on('click', function(e) {
            e.stopPropagation();
            var url = $(this).data('video'), embedUrl = '';
            if (url.match(/youtube\.com|youtu\.be/)) {
                var yid = url.match(/(?:v=|youtu\.be\/)([^&\?]+)/);
                if (yid) embedUrl = 'https://www.youtube.com/embed/' + yid[1] + '?autoplay=1';
            } else if (url.match(/vimeo\.com/)) {
                var vid = url.match(/vimeo\.com\/(\d+)/);
                if (vid) embedUrl = 'https://player.vimeo.com/video/' + vid[1] + '?autoplay=1';
            }
            if (embedUrl) {
                $('#fts-v2-video-iframe').attr('src', embedUrl);
                $('#fts-v2-video-modal').addClass('active');
                $('body').css('overflow', 'hidden');
            } else {
                window.open(url, '_blank');
            }
        });

        $('.fts-v2-video-close').on('click', closeVideo);
        $('#fts-v2-video-modal').on('click', function(e) { if (e.target === this) closeVideo(); });

        /* ══════════════════════════════════════════════
           Keyboard Shortcuts
           ══════════════════════════════════════════════ */
        $(document).on('keydown', function(e) {
            if ($('#fts-v2-lightbox').hasClass('active')) {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowRight') $('.fts-v2-lb-next').click();
                if (e.key === 'ArrowLeft') $('.fts-v2-lb-prev').click();
            }
            if ($('#fts-v2-video-modal').hasClass('active') && e.key === 'Escape') closeVideo();
        });

        /* ── Touch swipe for lightbox ── */
        (function() {
            var startX = 0;
            var $lb = document.getElementById('fts-v2-lightbox');
            if (!$lb) return;
            $lb.addEventListener('touchstart', function(e) {
                startX = e.changedTouches[0].clientX;
            }, { passive: true });
            $lb.addEventListener('touchend', function(e) {
                var diff = e.changedTouches[0].clientX - startX;
                if (Math.abs(diff) > 50) {
                    if (diff < 0) openLightbox((currentIdx + 1) % allUrls.length);
                    else openLightbox((currentIdx - 1 + allUrls.length) % allUrls.length);
                }
            }, { passive: true });
        })();

        /* ══════════════════════════════════════════════
           Social Proof Counters
           ══════════════════════════════════════════════ */
        var viewerCounts = [8, 11, 14, 9, 16, 12, 7, 13, 10, 15];
        var viewerIdx    = 0;
        setInterval(function() {
            viewerIdx = (viewerIdx + 1) % viewerCounts.length;
            $('.fts-v2-viewer-count').text(viewerCounts[viewerIdx]);
        }, 8000);

        setInterval(function() {
            $('.fts-v2-last-booked').text(Math.floor(Math.random() * 40) + 5);
        }, 15000);

        /* ══════════════════════════════════════════════
           Itinerary Accordion (single-open)
           ══════════════════════════════════════════════ */
        $('.fts-v2-timeline-header').on('click', function() {
            var $item = $(this).closest('.fts-v2-timeline-item');
            var $desc = $item.find('.fts-v2-timeline-desc');
            if (!$desc.length) return;

            var isActive = $item.hasClass('active');

            $item.siblings('.fts-v2-timeline-item.active')
                .removeClass('active')
                .find('.fts-v2-timeline-desc').slideUp(250);

            if (!isActive) {
                $item.addClass('active');
                $desc.slideDown(250);
            } else {
                $item.removeClass('active');
                $desc.slideUp(250);
            }
        });

        /* ══════════════════════════════════════════════
           FAQ Accordion (single-open)
           ══════════════════════════════════════════════ */
        $('.fts-v2-faq-question').on('click', function() {
            var $item   = $(this).closest('.fts-v2-faq-item');
            var $answer = $item.find('.fts-v2-faq-answer');

            var isActive = $item.hasClass('active');

            $item.siblings('.fts-v2-faq-item.active').each(function() {
                $(this).removeClass('active')
                    .find('.fts-v2-faq-answer').slideUp(250);
                $(this).find('.fts-v2-faq-question i')
                    .removeClass('fa-chevron-up').addClass('fa-chevron-down');
            });

            if (!isActive) {
                $item.addClass('active');
                $answer.slideDown(250);
                $(this).find('i').removeClass('fa-chevron-down').addClass('fa-chevron-up');
            } else {
                $item.removeClass('active');
                $answer.slideUp(250);
                $(this).find('i').removeClass('fa-chevron-up').addClass('fa-chevron-down');
            }
        });

        /* ══════════════════════════════════════════════
           Calendar Accordion
           ══════════════════════════════════════════════ */
        var $calAccordion = $('#fts-v2-cal-accordion');
        var $calSelected  = $('#fts-v2-cal-selected');
        var $calToggle    = $('#fts-v2-cal-toggle');

        function closeTravelers() {
            var $acc = $('#fts-v2-travelers-accordion');
            if (!$acc.hasClass('fts-v2-trav-collapsed')) {
                $acc.addClass('fts-v2-trav-collapsed');
            }
        }

        function closeCalendar() {
            if (!$calAccordion.hasClass('fts-v2-cal-collapsed')) {
                $calAccordion.addClass('fts-v2-cal-collapsed');
            }
        }

        $calToggle.on('click', function() {
            var isCollapsed = $calAccordion.hasClass('fts-v2-cal-collapsed');
            if (isCollapsed) {
                closeTravelers();
                $calAccordion.removeClass('fts-v2-cal-collapsed');
            } else {
                $calAccordion.addClass('fts-v2-cal-collapsed');
            }
        });

        function updateCalSelectedText(dateText) {
            if (!dateText) return;
            var parts = dateText.split('-');
            var d = new Date(parts[0], parts[1] - 1, parts[2]);
            var dayName = daysFull[d.getDay()];
            var monthName = monthsShort[d.getMonth()];
            var formatted = (dayName && monthName) ? (dayName + ', ' + monthName + ' ' + parseInt(parts[2], 10) + ', ' + parts[0]) : dateText;
            $calSelected.text(formatted).addClass('has-date');
        }

        var $cancelCountdown = $('#fts-v2-cancel-countdown');
        var $cancelCountdownTimer = $('#fts-v2-cancel-countdown-timer');
        var cancelHours = parseInt(String(data.cancelHours || '').trim(), 10);
        if (!isFinite(cancelHours) || cancelHours < 1) cancelHours = 0;
        var cancelTick = null;

        function clearCancelCountdownTimer() {
            if (cancelTick) {
                clearInterval(cancelTick);
                cancelTick = null;
            }
        }

        function formatCountdown(ms) {
            var s = Math.floor(ms / 1000);
            var days = Math.floor(s / 86400);
            s -= days * 86400;
            var h = Math.floor(s / 3600);
            s -= h * 3600;
            var m = Math.floor(s / 60);
            s -= m * 60;
            var hh = String(h).padStart(2, '0');
            var mm = String(m).padStart(2, '0');
            var ss = String(s).padStart(2, '0');
            return (days > 0 ? (days + 'd ') : '') + hh + ':' + mm + ':' + ss;
        }

        function showCancelCountdownForDate(dateText) {
            if (!$cancelCountdown.length || !$cancelCountdownTimer.length) return;
            if (!cancelHours || !dateText) {
                clearCancelCountdownTimer();
                $cancelCountdown.hide();
                return;
            }

            var parts = dateText.split('-');
            var y = parseInt(parts[0], 10);
            var mo = parseInt(parts[1], 10) - 1;
            var da = parseInt(parts[2], 10);
            if (!isFinite(y) || !isFinite(mo) || !isFinite(da)) {
                clearCancelCountdownTimer();
                $cancelCountdown.hide();
                return;
            }

            var tripDate = new Date(y, mo, da);
            tripDate.setHours(0, 0, 0, 0);
            var deadline = new Date(tripDate.getTime() - (cancelHours * 60 * 60 * 1000));

            function tick() {
                var now = new Date();
                var diff = deadline.getTime() - now.getTime();
                if (diff <= 0) {
                    clearCancelCountdownTimer();
                    $cancelCountdown.hide();
                    return;
                }
                $cancelCountdownTimer.text(formatCountdown(diff));
                $cancelCountdown.show();
            }

            clearCancelCountdownTimer();
            tick();
            cancelTick = setInterval(tick, 1000);
        }

        /* ══════════════════════════════════════════════
           Datepicker (jQuery UI)
           ══════════════════════════════════════════════ */
        var $dpEl = $('#fts-v2-datepicker');

        if ($dpEl.length && $.fn.datepicker) {
            $dpEl.datepicker({
                firstDay: 1,
                minDate: 0,
                showOtherMonths: true,
                selectOtherMonths: false,
                dateFormat: 'yy-mm-dd',
                dayNamesMin: daysMin,
                beforeShowDay: function(date) {
                    var key = date.getFullYear() + '-' +
                              String(date.getMonth() + 1).padStart(2, '0') + '-' +
                              String(date.getDate()).padStart(2, '0');

                    if (isDateExcluded(key)) return [false, 'fts-v2-dp-disabled', ''];
                    if (fsdDates[key]) {
                        var cls = (fsdDates[key].type === 'low') ? 'fts-v2-dp-low' : 'fts-v2-dp-best';
                        return [true, cls, fsdDates[key].label];
                    }
                    if (Object.keys(fsdDates).length > 0) return [false, 'fts-v2-dp-disabled', ''];
                    return [true, '', ''];
                },
                onChangeMonthYear: function() { setTimeout(injectAnnotations, 80); },
                onSelect: function(dateText) {
                    $(this).data('selectedDate', dateText);
                    updateCalSelectedText(dateText);
                    showCancelCountdownForDate(dateText);
                    setTimeout(injectAnnotations, 80);
                }
            });

            function injectAnnotations() {
                var el = $dpEl[0];
                if (!el) return;
                var inst = $.datepicker._getInst(el);
                if (!inst) return;

                var curYear  = inst.drawYear;
                var curMonth = inst.drawMonth;

                $dpEl.find('.ui-datepicker-calendar td').each(function() {
                    var $td = $(this);
                    if ($td.find('.fts-v2-dp-dot').length || $td.hasClass('ui-datepicker-other-month')) return;

                    var $a  = $td.find('a, span.ui-state-default');
                    if (!$a.length) return;
                    var day = parseInt($a.text(), 10);
                    if (isNaN(day)) return;

                    var key = curYear + '-' + String(curMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    if (fsdDates[key]) {
                        var dotCls = (fsdDates[key].type === 'low') ? 'fts-v2-dp-dot-low' : 'fts-v2-dp-dot-best';
                        $td.append('<span class="fts-v2-dp-dot ' + dotCls + '"></span>');
                    }
                });
            }

            setTimeout(injectAnnotations, 300);
        }

        /* ══════════════════════════════════════════════
           Travelers Accordion (Adults / Children)
           ══════════════════════════════════════════════ */
        var sidebarAdults = 1, sidebarChildren = 0;
        var $adultsCount = $('#fts-v2-adults-count');
        var $childrenCount = $('#fts-v2-children-count');
        var $travSummary = $('#fts-v2-trav-summary');
        var travelers = sidebarAdults + sidebarChildren;

        function updateTravSummary() {
            travelers = sidebarAdults + sidebarChildren;
            var parts = [];
            if (sidebarAdults > 0) parts.push(sidebarAdults + ' ' + (sidebarAdults === 1 ? adultSing : adultPlur));
            if (sidebarChildren > 0) parts.push(sidebarChildren + ' ' + (sidebarChildren === 1 ? childSing : childPlur));
            $travSummary.text(parts.join(', ') || selectTravelersText);
        }

        $('#fts-v2-trav-toggle').on('click', function() {
            var $acc = $('#fts-v2-travelers-accordion');
            if ($acc.hasClass('fts-v2-trav-collapsed')) {
                closeCalendar();
                $acc.removeClass('fts-v2-trav-collapsed');
            } else {
                $acc.addClass('fts-v2-trav-collapsed');
            }
        });

        $(document).on('click', '.fts-v2-trav-btn', function() {
            var type = $(this).data('type');
            var dir = $(this).data('dir');
            if (type === 'adults') {
                if (dir === 'plus' && sidebarAdults < 20) sidebarAdults++;
                if (dir === 'minus' && sidebarAdults > 1) sidebarAdults--;
                $adultsCount.text(sidebarAdults);
            } else if (type === 'children') {
                if (dir === 'plus' && sidebarChildren < 10) sidebarChildren++;
                if (dir === 'minus' && sidebarChildren > 0) sidebarChildren--;
                $childrenCount.text(sidebarChildren);
            }
            updateTravSummary();
        });

        /* ══════════════════════════════════════════════
           Extra Services Helpers
           ══════════════════════════════════════════════ */
        var esCounts = {};
        if (esData.length > 0) {
            for (var ei = 0; ei < esData.length; ei++) esCounts[esData[ei].id] = 0;
        }
        function esGetData(esId) {
            for (var i = 0; i < esData.length; i++) { if (String(esData[i].id) === String(esId)) return esData[i]; }
            return null;
        }
        function esUpdateRow(esId) {
            var cnt = esCounts[esId] || 0;
            $('.fts-bm-es-val[data-es="' + esId + '"]').text(cnt);
            $('.fts-bm-es-minus[data-es="' + esId + '"]').prop('disabled', cnt <= 0);
        }
        function esGetTotal() {
            var t = 0;
            for (var k in esCounts) { if (esCounts.hasOwnProperty(k) && esCounts[k] > 0) { var es = esGetData(k); if (es) t += esCounts[k] * es.cost; } }
            return t;
        }

        /* ══════════════════════════════════════════════
           4-Step Wizard Booking Modal
           ══════════════════════════════════════════════ */
        var $bm = $('#fts-booking-modal');

        if ($bm.length) {
            var bmData      = data.bookingModal || {};
            var packages    = data.packages || [];
            var symbol      = data.currencySymbol || '$';
            var selectedPkg = null;
            var tCounts     = {};
            var currentStep = 1;
            var completedSteps = {};

            function fmtPrice(amt) {
                var n = parseFloat(amt) || 0;
                var whole = Math.round(n);
                return symbol + whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }

            var _decodeEl = document.createElement('textarea');
            function decodeHtml(str) {
                _decodeEl.innerHTML = str || '';
                return _decodeEl.value;
            }

            function detectTravelerRole(cat) {
                var r = String((cat && cat.role) || '').toLowerCase();
                if (r === 'adult' || r === 'child') return r;
                var l = String((cat && cat.label) || '').toLowerCase();
                if (/(adult|adults|adulto|erwachsen|adulte)/.test(l)) return 'adult';
                if (/(child|children|niñ|nino|kind|kinder|enfant|infant)/.test(l)) return 'child';
                return '';
            }

            function formatDateDisplay(dateStr) {
                if (!dateStr) return '';
                var d = new Date(dateStr + 'T00:00:00');
                if (isNaN(d.getTime())) return dateStr;
                var months = (data.i18n && data.i18n.months_short) || ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
            }

            /* ── Progress Bar ── */
            function updateProgressBar(step) {
                $('.fts-bm-progress-seg').each(function() {
                    var s = parseInt($(this).data('seg'));
                    $(this).removeClass('active done');
                    if (s < step) $(this).addClass('done');
                    else if (s === step) $(this).addClass('active');
                });
                $('.fts-bm-progress-labels span').each(function() {
                    var s = parseInt($(this).data('seg'));
                    $(this).removeClass('active done');
                    if (s < step) $(this).addClass('done');
                    else if (s === step) $(this).addClass('active');
                });
            }

            /* ── Step Navigation ── */
            var _stepScrollTimer = null;

            function scrollBodyToStep($step) {
                var $body = $bm.find('.fts-bm-body');
                $body.stop(true);
                if (_stepScrollTimer) { clearTimeout(_stepScrollTimer); _stepScrollTimer = null; }

                _stepScrollTimer = setTimeout(function() {
                    _stepScrollTimer = null;
                    requestAnimationFrame(function() {
                        var bodyEl = $body[0];
                        var stepEl = $step[0];
                        var target = bodyEl.scrollTop + stepEl.getBoundingClientRect().top - bodyEl.getBoundingClientRect().top;
                        bodyEl.scrollTop = Math.max(0, target - 4);
                    });
                }, 60);
            }

            function goToStep(step) {
                if (step < 1 || step > 4) return;

                $('.fts-bm-step').each(function() {
                    var s = parseInt($(this).data('step'));
                    $(this).removeClass('active completed locked');
                    if (s < step && completedSteps[s]) {
                        $(this).addClass('completed');
                    } else if (s === step) {
                        $(this).addClass('active');
                    } else {
                        $(this).addClass('locked');
                    }
                });

                currentStep = step;
                updateProgressBar(step);
                updateStickyFooter();

                var $activeStep = $('.fts-bm-step[data-step="' + step + '"]');
                if ($activeStep.length) {
                    scrollBodyToStep($activeStep);
                }
                if (step === 1) {
                    requestAnimationFrame(function() {
                        if (typeof bmFixInlineCalWidth === 'function') bmFixInlineCalWidth();
                    });
                    setTimeout(function() {
                        if (typeof bmFixInlineCalWidth === 'function') bmFixInlineCalWidth();
                    }, 80);
                }
            }

            function getStepSummary(step) {
                if (step === 1) {
                    return formatDateDisplay(bmDateGetVal());
                }
                if (step === 2) {
                    var parts = [];
                    if (selectedPkg) {
                        var cats = selectedPkg.categories;
                        for (var i = 0; i < cats.length; i++) {
                            var cnt = tCounts[cats[i].id] || 0;
                            if (cnt > 0) parts.push(cnt + ' ' + cats[i].label);
                        }
                    }
                    return parts.join(', ') || '1 Adult';
                }
                if (step === 3) {
                    if (!selectedPkg) return '';
                    return decodeHtml(selectedPkg.name) + ' \u00b7 ' + fmtPrice(selectedPkg.display_price) + '/pp';
                }
                return '';
            }

            function completeStep(step) {
                completedSteps[step] = true;
                var summary = getStepSummary(step);
                $('#fts-bm-summary-' + step).text(summary);
            }

            function getTotalTravelers() {
                var n = 0;
                for (var k in tCounts) { if (tCounts.hasOwnProperty(k)) n += (tCounts[k] || 0); }
                return n;
            }

            function getTravelerSummaryForSticky() {
                if (!selectedPkg) return '';
                var parts = [];
                var cats = selectedPkg.categories;
                for (var i = 0; i < cats.length; i++) {
                    var cnt = tCounts[cats[i].id] || 0;
                    if (cnt > 0) parts.push(cnt + ' ' + cats[i].label);
                }
                return parts.join(' \u2022 ');
            }

            function getStickyMetaLine() {
                var dateFmt = formatDateDisplay(bmDateGetVal());
                var trav = getTravelerSummaryForSticky();
                var pkg = selectedPkg ? decodeHtml(selectedPkg.name) : '';
                if (currentStep === 1) {
                    return dateFmt || '';
                }
                if (currentStep === 2) {
                    var b2 = [];
                    if (trav) b2.push(trav);
                    if (pkg) b2.push(pkg);
                    return b2.join(' \u2022 ');
                }
                if (currentStep === 3 || currentStep === 4) {
                    var b3 = [];
                    if (dateFmt) b3.push(dateFmt);
                    if (trav) b3.push(trav);
                    if (pkg) b3.push(pkg);
                    return b3.join(' \u2022 ');
                }
                return '';
            }

            function updateStickyFooter() {
                var $stickyRow = $('#fts-bm-sticky-row');
                if ($stickyRow.length) {
                    if (currentStep > 1) {
                        $stickyRow.removeClass('fts-bm-sticky-row--no-back');
                    } else {
                        $stickyRow.addClass('fts-bm-sticky-row--no-back');
                    }
                    $stickyRow.toggleClass('fts-bm-sticky-card--step4', currentStep === 4);
                }
                var totalAmt = calculateTotal();
                var priceText = totalAmt > 0 ? fmtPrice(totalAmt) : '\u2014';
                $('#fts-bm-sticky-price-display').text(priceText);
                $('#fts-bm-sticky-meta').text(getStickyMetaLine());

                var $stickyBtn = $('#fts-bm-sticky-continue');
                if (currentStep === 4) {
                    $stickyBtn.addClass('fts-bm-sticky-btn--submit');
                    $stickyBtn.text(ftsT('proceed_to_payment', 'Proceed to payment'));
                    $stickyBtn.data('action', 'submit');
                    $stickyBtn.prop('disabled', false);
                } else {
                    $stickyBtn.removeClass('fts-bm-sticky-btn--submit');
                    if (currentStep === 1) {
                        $stickyBtn.text(ftsT('continue_to_travelers', 'Continue to travelers'));
                        $stickyBtn.data('action', 'next');
                        $stickyBtn.prop('disabled', !bmDateGetVal());
                    } else if (currentStep === 2) {
                        $stickyBtn.text(ftsT('continue_to_package', 'Continue to package'));
                        $stickyBtn.data('action', 'next');
                        $stickyBtn.prop('disabled', false);
                    } else if (currentStep === 3) {
                        $stickyBtn.text(ftsT('continue_to_checkout', 'Continue to checkout'));
                        $stickyBtn.data('action', 'next');
                        $stickyBtn.prop('disabled', false);
                    }
                }
            }

            /* ── Travelers ── */
            function bmRenderTravelers(cats) {
                var $list = $('#fts-bm-travelers-list');
                $list.empty();
                tCounts = {};

                cats = cats.slice().sort(function(a, b) {
                    var prio = { adult: 0, child: 1 };
                    var ap = prio[detectTravelerRole(a)] !== undefined ? prio[detectTravelerRole(a)] : 2;
                    var bp = prio[detectTravelerRole(b)] !== undefined ? prio[detectTravelerRole(b)] : 2;
                    if (ap !== bp) return ap - bp;
                    return String(a.label || '').localeCompare(String(b.label || ''));
                });

                for (var i = 0; i < cats.length; i++) {
                    var c   = cats[i];
                    var def = (i === 0) ? Math.max(1, c.min_pax) : c.min_pax;
                    tCounts[c.id] = def;
                    var role = detectTravelerRole(c);
                    var displayLabel = c.label || '';
                    var ageGroup = c.age_group || '';
                    if (role === 'adult') displayLabel = adultSing || displayLabel || 'Adult';
                    else if (role === 'child') displayLabel = c.label || childSing || 'Child';

                    var metaHtml = ageGroup || '';
                    if (c.has_sale && c.price > c.display_price) {
                        var pct = Math.round(((c.price - c.display_price) / c.price) * 100);
                        metaHtml += (metaHtml ? ' ' : '') + '<span class="fts-bm-traveler-discount">' + pct + '% OFF</span>';
                    }

                    var html =
                        '<div class="fts-bm-traveler-row" data-cat-id="' + c.id + '">' +
                            '<div class="fts-bm-traveler-info">' +
                                '<span class="fts-bm-traveler-label">' + displayLabel + '</span>' +
                                (metaHtml ? '<span class="fts-bm-traveler-meta">' + metaHtml + '</span>' : '') +
                            '</div>' +
                            '<div class="fts-bm-counter">' +
                                '<button type="button" class="fts-bm-counter-btn fts-bm-minus" data-cat="' + c.id + '"' +
                                    (def <= c.min_pax ? ' disabled' : '') + '>\u2212</button>' +
                                '<span class="fts-bm-counter-value" data-cat="' + c.id + '">' + def + '</span>' +
                                '<button type="button" class="fts-bm-counter-btn fts-bm-plus" data-cat="' + c.id + '"' +
                                    (def >= c.max_pax ? ' disabled' : '') + '>+</button>' +
                            '</div>' +
                        '</div>';
                    $list.append(html);
                }
            }

            function bmGetCat(catId) {
                if (!selectedPkg) return null;
                for (var i = 0; i < selectedPkg.categories.length; i++) {
                    if (selectedPkg.categories[i].id == catId) return selectedPkg.categories[i];
                }
                return null;
            }

            function bmUpdateCounter(catId, cat) {
                var cnt = tCounts[catId];
                $('.fts-bm-counter-value[data-cat="' + catId + '"]').text(cnt);
                $('.fts-bm-minus[data-cat="' + catId + '"]').prop('disabled', cnt <= cat.min_pax);
                $('.fts-bm-plus[data-cat="' + catId + '"]').prop('disabled', cnt >= cat.max_pax);
            }

            /* ── Package Selection ── */
            function bmSelectPkg(pkgId, skipRender) {
                var pkg = null;
                for (var i = 0; i < packages.length; i++) {
                    if (packages[i].id == pkgId) { pkg = packages[i]; break; }
                }
                if (!pkg) return;
                selectedPkg = pkg;
                $('.fts-bm-package-card').removeClass('selected');
                $('.fts-bm-package-card[data-package-id="' + pkgId + '"]').addClass('selected');
                $('input[name="fts_bm_package"][value="' + pkgId + '"]').prop('checked', true);
                $('#fts-bm-pkg-name-btn').text(decodeHtml(pkg.name));
                if (!skipRender) bmRenderTravelers(pkg.categories);
            }

            /* ── Price Calculation & Breakdown ── */
            function getApplicablePrice(cat, pax) {
                if (cat.group_discount && cat.group_pricing && cat.group_pricing.length > 0 && pax > 0) {
                    for (var g = 0; g < cat.group_pricing.length; g++) {
                        var tier = cat.group_pricing[g];
                        var from = parseInt(tier.from) || 0;
                        var to = tier.to ? parseInt(tier.to) : 0;
                        if (from <= pax && (!to || to >= pax)) {
                            return parseFloat(tier.price) || cat.display_price;
                        }
                    }
                }
                return cat.display_price;
            }

            function calculateTotal() {
                if (!selectedPkg) return 0;
                var total = 0;
                var cats = selectedPkg.categories;
                for (var i = 0; i < cats.length; i++) {
                    var cnt = tCounts[cats[i].id] || 0;
                    if (cnt > 0) total += cnt * getApplicablePrice(cats[i], cnt);
                }
                total += esGetTotal();
                return total;
            }

            function bmUpdateBreakdown() {
                if (!selectedPkg) return;
                var $meta  = $('#fts-bm-breakdown-meta');
                var $lines = $('#fts-bm-breakdown-lines');
                $meta.empty();
                $lines.empty();
                var total = 0;

                var dateVal = bmDateGetVal();
                var dateFmt = formatDateDisplay(dateVal);
                if (dateFmt) {
                    $meta.append('<div class="fts-bm-bd-line"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ' + dateFmt + '</div>');
                }
                $meta.append('<div class="fts-bm-bd-line"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg> ' + decodeHtml(selectedPkg.name) + ' \u2014 ' + fmtPrice(selectedPkg.display_price) + '/pp</div>');

                var cats = selectedPkg.categories;
                for (var i = 0; i < cats.length; i++) {
                    var c   = cats[i];
                    var cnt = tCounts[c.id] || 0;
                    if (cnt === 0) continue;
                    var unitPrice = getApplicablePrice(c, cnt);
                    var sub = cnt * unitPrice;
                    total += sub;
                    $lines.append(
                        '<div class="fts-bm-bd-item">' +
                            '<span>' + cnt + '\u00d7 ' + c.label + '</span>' +
                            '<span class="fts-bm-bd-item-price">' + fmtPrice(sub) + '</span>' +
                        '</div>'
                    );
                }

                for (var esId in esCounts) {
                    if (!esCounts.hasOwnProperty(esId) || esCounts[esId] <= 0) continue;
                    var esInfo = esGetData(esId);
                    if (!esInfo) continue;
                    var esSub = esCounts[esId] * esInfo.cost;
                    total += esSub;
                    $lines.append(
                        '<div class="fts-bm-bd-item">' +
                            '<span>' + esCounts[esId] + '\u00d7 ' + esInfo.name + '</span>' +
                            '<span class="fts-bm-bd-item-price">' + fmtPrice(esSub) + '</span>' +
                        '</div>'
                    );
                }

                var totalFmt = fmtPrice(total);
                $('#fts-bm-total-amount').text(totalFmt);
                $('.fts-bm-submit-price').text(totalFmt);

                $('#fts-bm-review-date').text(dateFmt || '\u2014');
                $('#fts-bm-review-travelers').text(getStepSummary(2));
                $('#fts-bm-review-package').text(decodeHtml(selectedPkg.name));
                $('#fts-bm-review-total').text(totalFmt);

                var detailParts = [];
                for (var di = 0; di < cats.length; di++) {
                    var dc = cats[di], dn = tCounts[dc.id] || 0;
                    if (dn > 0) detailParts.push(fmtPrice(getApplicablePrice(dc, dn)) + ' \u00d7 ' + dn + ' ' + dc.label);
                }
                $('#fts-bm-review-total-detail').text(detailParts.join(', '));

                updateStickyFooter();

                if (selectedPkg) {
                    var mobPrimary = null;
                    for (var mi = 0; mi < selectedPkg.categories.length; mi++) {
                        if (detectTravelerRole(selectedPkg.categories[mi]) === 'adult') { mobPrimary = selectedPkg.categories[mi]; break; }
                    }
                    if (!mobPrimary && selectedPkg.categories.length > 0) mobPrimary = selectedPkg.categories[0];
                    if (mobPrimary) {
                        $('.fts-v2-mob-current').text(fmtPrice(mobPrimary.display_price));
                        var mobOld = (mobPrimary.has_sale && mobPrimary.price > mobPrimary.display_price) ? fmtPrice(mobPrimary.price) : '';
                        if (mobOld) { $('.fts-v2-mob-old').text(mobOld).show(); } else { $('.fts-v2-mob-old').hide(); }
                    }
                }
            }

            /* ── Date: inline calendar + summary field (same rules as sidebar datepicker) ── */
            var $bmDate = $('#fts-bm-date-input');
            var $bmInlineDp = $('#fts-bm-datepicker-inline');
            var bmDateReady = false;

            function bmInjectInlineAnnotations() {
                var el = $bmInlineDp[0];
                if (!el) return;
                var inst = $.datepicker._getInst(el);
                if (!inst) return;
                var curYear  = inst.drawYear;
                var curMonth = inst.drawMonth;
                $bmInlineDp.find('.ui-datepicker-calendar td').each(function() {
                    var $td = $(this);
                    if ($td.find('.fts-v2-dp-dot').length || $td.hasClass('ui-datepicker-other-month')) return;
                    var $a = $td.find('a, span.ui-state-default');
                    if (!$a.length) return;
                    var day = parseInt($a.text(), 10);
                    if (isNaN(day)) return;
                    var key = curYear + '-' + String(curMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                    if (fsdDates[key]) {
                        var dotCls = (fsdDates[key].type === 'low') ? 'fts-v2-dp-dot-low' : 'fts-v2-dp-dot-best';
                        $td.append('<span class="fts-v2-dp-dot ' + dotCls + '"></span>');
                    }
                });
            }

            function bmSyncInlineDateToField(dateText) {
                if (!dateText) return;
                var display = formatDateDisplay(dateText);
                $bmDate.val(display);
                $bmDate.data('dateVal', dateText);
                $('#fts-bm-continue-1').prop('disabled', false);
                $('#fts-bm-date-summary-value').text(display);
                $('#fts-bm-date-summary').show();
                updateStickyFooter();
            }

            /* jQuery UI sets inline width (~17em); force full width of .fts-bm-cal-card */
            function bmFixInlineCalWidth() {
                if (!$bmInlineDp.length) return;
                var el = $bmInlineDp[0];
                if (el && el.style && el.style.setProperty) {
                    el.style.setProperty('width', '100%', 'important');
                    el.style.setProperty('max-width', '100%', 'important');
                    el.style.setProperty('min-width', '0', 'important');
                    el.style.setProperty('box-sizing', 'border-box', 'important');
                    el.style.setProperty('display', 'block', 'important');
                } else {
                    $bmInlineDp.css({
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        display: 'block'
                    });
                }
                $bmInlineDp.find('table.ui-datepicker-calendar').each(function() {
                    var tbl = this;
                    if (tbl.style && tbl.style.setProperty) {
                        tbl.style.setProperty('width', '100%', 'important');
                        tbl.style.setProperty('table-layout', 'fixed', 'important');
                    } else {
                        $(tbl).css({ width: '100%', tableLayout: 'fixed' });
                    }
                });
            }

            if ($bmInlineDp.length && $.fn.datepicker) {
                $bmInlineDp.datepicker({
                    firstDay: 1,
                    minDate: 0,
                    showOtherMonths: true,
                    selectOtherMonths: false,
                    dateFormat: 'yy-mm-dd',
                    dayNamesMin: daysMin,
                    beforeShowDay: function(date) {
                        var key = date.getFullYear() + '-' +
                                  String(date.getMonth() + 1).padStart(2, '0') + '-' +
                                  String(date.getDate()).padStart(2, '0');
                        if (isDateExcluded(key)) return [false, 'fts-v2-dp-disabled', ''];
                        if (fsdDates[key]) {
                            var cls = (fsdDates[key].type === 'low') ? 'fts-v2-dp-low' : 'fts-v2-dp-best';
                            return [true, cls, fsdDates[key].label];
                        }
                        if (Object.keys(fsdDates).length > 0) return [false, 'fts-v2-dp-disabled', ''];
                        return [true, '', ''];
                    },
                    onChangeMonthYear: function() {
                        setTimeout(function() {
                            bmFixInlineCalWidth();
                            bmInjectInlineAnnotations();
                        }, 80);
                    },
                    onSelect: function(dateText) {
                        bmSyncInlineDateToField(dateText);
                        setTimeout(function() {
                            bmFixInlineCalWidth();
                            bmInjectInlineAnnotations();
                        }, 80);
                    }
                });
                bmDateReady = true;
                bmFixInlineCalWidth();
                setTimeout(function() {
                    bmFixInlineCalWidth();
                    bmInjectInlineAnnotations();
                }, 300);
            }

            $(window).on('resize orientationchange', function() {
                if ($bm.hasClass('active')) bmFixInlineCalWidth();
            });

            function bmDateGetVal() {
                return $bmDate.data('dateVal') || '';
            }

            /* ── Step 2: Traveler Continue Text ── */
            function updateStep2Btn() {
                var tc = getTotalTravelers();
                $('#fts-bm-trav-count').text(tc + ' traveler' + (tc !== 1 ? 's' : ''));
                var summaryText = getStepSummary(2);
                $('#fts-bm-traveler-summary-value').text(summaryText);
                if (tc > 0) $('#fts-bm-traveler-summary').show();
                updateStickyFooter();
            }

            /* ── Step 3: Info Bar ── */
            function updateStep3Info() {
                var dateVal = bmDateGetVal();
                $('#fts-bm-pkg-date-text').text(formatDateDisplay(dateVal));
                var travStr = getStepSummary(2);
                $('#fts-bm-pkg-trav-text').text(travStr);
            }

            /* ── Continue Button Handlers ── */
            $('#fts-bm-continue-1').on('click', function() {
                if (!bmDateGetVal()) return;
                completeStep(1);
                goToStep(2);
            });
            $('#fts-bm-continue-2').on('click', function() {
                completeStep(2);
                updateStep3Info();
                goToStep(3);
            });
            $('#fts-bm-continue-3').on('click', function() {
                if (!selectedPkg) return;
                completeStep(3);
                bmUpdateBreakdown();
                goToStep(4);
            });

            /* ── Edit Handlers ── */
            $(document).on('click', '.fts-bm-step-edit', function(e) {
                e.stopPropagation();
                var step = parseInt($(this).closest('.fts-bm-step').data('step'));
                goToStep(step);
            });
            $(document).on('click', '.fts-bm-step.completed .fts-bm-step-head', function() {
                var step = parseInt($(this).data('step'));
                goToStep(step);
            });
            $(document).on('click', '.fts-bm-review-edit', function(e) {
                e.preventDefault();
                var step = parseInt($(this).data('goto-step'));
                if (step >= 1 && step <= 3) goToStep(step);
            });

            /* ── Summary row "Change" buttons ── */
            $('#fts-bm-date-summary-change').on('click', function() {
                var $cal = $('#fts-bm-datepicker-inline');
                if ($cal.length) {
                    var body = $bm.find('.fts-bm-body')[0];
                    if (body) {
                        var top = $cal[0].getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
                        body.scrollTop = Math.max(0, top - 8);
                    }
                }
            });
            $('#fts-bm-traveler-summary-change').on('click', function() {
                var $list = $('#fts-bm-travelers-list');
                if ($list.length) {
                    var body = $bm.find('.fts-bm-body')[0];
                    if (body) {
                        var top = $list[0].getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
                        body.scrollTop = Math.max(0, top - 8);
                    }
                }
            });

            /* ── Sticky Footer ── */
            $('#fts-bm-sticky-continue').on('click', function() {
                var action = $(this).data('action');
                if (action === 'submit') {
                    $('#fts-bm-submit').trigger('click');
                } else {
                    if (currentStep === 1) $('#fts-bm-continue-1').trigger('click');
                    else if (currentStep === 2) $('#fts-bm-continue-2').trigger('click');
                    else if (currentStep === 3) $('#fts-bm-continue-3').trigger('click');
                }
            });

            $('#fts-bm-sticky-back').on('click', function() {
                if (currentStep > 1) {
                    goToStep(currentStep - 1);
                }
            });

            /* ── Traveler +/- ── */
            $(document).on('click', '.fts-bm-minus', function() {
                var catId = $(this).data('cat'), cat = bmGetCat(catId);
                if (cat && tCounts[catId] > cat.min_pax) {
                    tCounts[catId]--;
                    bmUpdateCounter(catId, cat);
                    updateStep2Btn();
                }
            });
            $(document).on('click', '.fts-bm-plus', function() {
                var catId = $(this).data('cat'), cat = bmGetCat(catId);
                if (cat && tCounts[catId] < cat.max_pax) {
                    tCounts[catId]++;
                    bmUpdateCounter(catId, cat);
                    updateStep2Btn();
                }
            });

            /* ── Package Card Click ── */
            $(document).on('click', '.fts-bm-package-card', function() {
                bmSelectPkg($(this).data('package-id'), true);
                updateStickyFooter();
            });


            /* ── Extra Services +/- ── */
            $(document).on('click', '.fts-bm-es-plus', function() {
                var esId = String($(this).data('es'));
                esCounts[esId] = (esCounts[esId] || 0) + 1;
                esUpdateRow(esId);
                bmUpdateBreakdown();
            });
            $(document).on('click', '.fts-bm-es-minus', function() {
                var esId = String($(this).data('es'));
                if ((esCounts[esId] || 0) > 0) {
                    esCounts[esId]--;
                    esUpdateRow(esId);
                    bmUpdateBreakdown();
                }
            });

            /* ── Init: pre-select primary package ── */
            if (packages.length > 0) bmSelectPkg(packages[0].id);

            /* ── Scroll lock helpers ── */
            var _scrollY = 0;
            function lockScroll() {
                _scrollY = window.pageYOffset || document.documentElement.scrollTop;
                $('html, body').css({
                    'overflow': 'hidden',
                    'position': 'fixed',
                    'top': -_scrollY + 'px',
                    'left': '0',
                    'right': '0',
                    'width': '100%'
                });
            }
            function unlockScroll() {
                $('html, body').css({
                    'overflow': '',
                    'position': '',
                    'top': '',
                    'left': '',
                    'right': '',
                    'width': ''
                });
                window.scrollTo(0, _scrollY);
            }

            /* ── Open / Close ── */
            function bmOpen() {
                $bm.removeClass('closing');
                $bm.addClass('active');
                lockScroll();

                if (packages.length > 0 && !selectedPkg) bmSelectPkg(packages[0].id);

                var startStep = 1;
                if ($dpEl.length) {
                    var sidebarDateText = $dpEl.data('selectedDate');
                    if (sidebarDateText) {
                        if (bmDateReady && $bmInlineDp.length) {
                            $bmInlineDp.datepicker('setDate', sidebarDateText);
                            bmSyncInlineDateToField(sidebarDateText);
                            setTimeout(function() {
                                bmFixInlineCalWidth();
                                bmInjectInlineAnnotations();
                            }, 80);
                        }
                    }
                }

                if (selectedPkg && selectedPkg.categories.length > 0) {
                    var cats = selectedPkg.categories;
                    for (var si = 0; si < cats.length; si++) {
                        var syncRole = detectTravelerRole(cats[si]);
                        if (syncRole === 'adult' && sidebarAdults > 0) {
                            tCounts[cats[si].id] = Math.max(cats[si].min_pax, Math.min(sidebarAdults, cats[si].max_pax));
                            bmUpdateCounter(cats[si].id, cats[si]);
                        } else if (syncRole === 'child' && sidebarChildren > 0) {
                            tCounts[cats[si].id] = Math.max(cats[si].min_pax, Math.min(sidebarChildren, cats[si].max_pax));
                            bmUpdateCounter(cats[si].id, cats[si]);
                        }
                    }
                }

                if (bmDateGetVal()) {
                    completeStep(1);
                    startStep = 2;
                    if (getTotalTravelers() > 0) {
                        completeStep(2);
                        startStep = 3;
                    }
                }

                completedSteps = {};
                for (var s = 1; s < startStep; s++) completedSteps[s] = true;
                for (var ss = 1; ss <= 4; ss++) {
                    if (ss < startStep) $('#fts-bm-summary-' + ss).text(getStepSummary(ss));
                }

                goToStep(startStep);
                if (startStep === 3) updateStep3Info();

                requestAnimationFrame(function() {
                    bmFixInlineCalWidth();
                    if (startStep === 1) {
                        $bm.find('.fts-bm-body')[0].scrollTop = 0;
                    }
                });
                setTimeout(bmFixInlineCalWidth, 100);
                setTimeout(bmFixInlineCalWidth, 350);
            }

            function bmClose() {
                if (!$bm.hasClass('active')) {
                    return;
                }
                if ($bm.hasClass('closing')) {
                    return;
                }
                if (window.innerWidth >= 769) {
                    $bm.addClass('closing');
                    setTimeout(function() {
                        $bm.removeClass('active closing');
                        unlockScroll();
                    }, 350);
                } else {
                    $bm.removeClass('active');
                    unlockScroll();
                }
            }

            $(document).on('ftsBookingModalClose', bmClose);

            $(document).on('click', '.fts-bm-trigger', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var pkgId = $(this).data('package-id');
                if (pkgId && packages.length > 0) bmSelectPkg(pkgId);
                bmOpen();
            });

            $('.fts-bm-close').on('click', bmClose);
            $bm.on('click', function(e) { if (e.target === this) bmClose(); });
            $(document).on('keydown', function(e) {
                if (e.key === 'Escape' && $bm.hasClass('active')) bmClose();
            });

            /* ── Submit (Step 4) ── */
            $(document).on('click', '#fts-bm-submit', function() {
                if (!selectedPkg) return;
                if (!bmData.nonce || !bmData.wpXHR) {
                    if (bookingDataNaText) alert(bookingDataNaText);
                    return;
                }

                var selDate = bmDateGetVal();
                if (!selDate) return;

                var $btn = $(this);
                var spinnerHtml = '<span class="fts-bm-spinner"></span> ' + processingText;
                $btn.prop('disabled', true).html(spinnerHtml);
                $('#fts-bm-sticky-continue').prop('disabled', true);
                $('#fts-bm-sticky-back').prop('disabled', true);

                var travelersPayload = {}, pricingOptions = {}, cartTotal = 0;
                var cats = selectedPkg.categories;
                for (var i = 0; i < cats.length; i++) {
                    var c = cats[i], cnt = tCounts[c.id] || 0;
                    if (cnt > 0) {
                        travelersPayload[c.id] = cnt;
                        var unitPrice = getApplicablePrice(c, cnt);
                        var cost = cnt * unitPrice;
                        pricingOptions[c.id] = { pax: cnt, cost: cost, categoryInfo: { id: c.id, label: c.label, price: unitPrice } };
                        cartTotal += cost;
                    }
                }

                var extraServicesPayload = [], subtotalExtraServices = [];
                for (var esKey in esCounts) {
                    if (!esCounts.hasOwnProperty(esKey) || esCounts[esKey] <= 0) continue;
                    var esInfo = esGetData(esKey);
                    if (!esInfo) continue;
                    extraServicesPayload.push({ extra_service: esInfo.name, qty: esCounts[esKey], price: esInfo.cost, service_cost_total: esCounts[esKey] * esInfo.cost });
                    if (esInfo.wte_key) subtotalExtraServices.push({ id: esInfo.wte_key, quantity: esCounts[esKey] });
                    cartTotal += esCounts[esKey] * esInfo.cost;
                }

                var ajaxUrl = bmData.wpXHR + '?action=wte_add_trip_to_cart&cart_version=' + encodeURIComponent(bmData.cartVersion || '4.0') + '&_nonce=' + encodeURIComponent(bmData.nonce);

                $.ajax({
                    url: ajaxUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        tripID: tripId, packageID: selectedPkg.id, tripDate: selDate, tripTime: '', timeRange: [],
                        travelers: travelersPayload, pricingOptions: pricingOptions, cartTotal: cartTotal,
                        extraServices: extraServicesPayload,
                        subtotalReservations: { extraServices: subtotalExtraServices },
                        nonce: bmData.nonce, cartVersion: bmData.cartVersion || '4.0'
                    }),
                    success: function(resp) {
                        if (resp.success && resp.data && resp.data.redirect) {
                            window.location.href = resp.data.redirect;
                        } else {
                            var msg = (resp.data && resp.data.message) ? String(resp.data.message) : errorGenericText;
                            if (msg) alert(msg);
                            bmResetSubmit(cartTotal);
                        }
                    },
                    error: function() {
                        if (errorConnectionText) alert(errorConnectionText);
                        bmResetSubmit(cartTotal);
                    }
                });
            });

            function bmResetSubmit(total) {
                var lockSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';
                $('#fts-bm-submit').prop('disabled', false).html(lockSvg + ' <span>' + secureBookingText + ' \u2014 <span class="fts-bm-submit-price">' + fmtPrice(total) + '</span></span>');
                $('#fts-bm-sticky-continue').prop('disabled', false);
                $('#fts-bm-sticky-back').prop('disabled', false);
                updateStickyFooter();
            }

            /* ── Urgency Randomizer ── */
            var bmSpots   = [2, 3, 4, 5, 3];
            var bmViewers = [8, 11, 14, 9, 16, 12, 18];
            setInterval(function() {
                if ($bm.hasClass('active')) {
                    $('.fts-bm-spots').text(bmSpots[Math.floor(Math.random() * bmSpots.length)]);
                    $('.fts-bm-viewers').text(bmViewers[Math.floor(Math.random() * bmViewers.length)]);
                }
            }, 10000);
        }

        /* ══════════════════════════════════════════════
           Countdown Timer
           ══════════════════════════════════════════════ */
        if ($('.fts-v2-countdown-timer').length) {
            var totalSecs = 2 * 60 * 60;
            var stored    = sessionStorage.getItem('fts_v2_countdown_' + tripId);
            if (stored) totalSecs = parseInt(stored, 10);

            function updateCountdown() {
                if (totalSecs <= 0) totalSecs = 2 * 60 * 60;
                var h = Math.floor(totalSecs / 3600);
                var m = Math.floor((totalSecs % 3600) / 60);
                var s = totalSecs % 60;
                $('.fts-v2-countdown-timer').text(
                    String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
                );
                totalSecs--;
                sessionStorage.setItem('fts_v2_countdown_' + tripId, totalSecs);
            }

            updateCountdown();
            setInterval(updateCountdown, 1000);
        }

        /* ══════════════════════════════════════════════
           Random Urgency Spots
           ══════════════════════════════════════════════ */
        var spots = [2, 3, 4, 5, 3, 2, 4];
        setInterval(function() {
            $('.fts-v2-spots-left').text(spots[Math.floor(Math.random() * spots.length)]);
        }, 30000);

        /* ══════════════════════════════════════════════
           Trustindex → Scroll to Reviews
           ══════════════════════════════════════════════ */
        $(document).on('click', '.fts-v2-meta-tidx, .fts-v2-trust-tidx-row, .fts-bm-trust-tidx', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if ($('#fts-booking-modal').hasClass('active')) {
                $(document).trigger('ftsBookingModalClose');
            }

            var $target = $('#fts-v2-sec-reviews');
            if ($target.length) {
                $('html, body').animate({ scrollTop: $target.offset().top - 80 }, 500);
            }
        });

        var ftsTiBadHost = 'admin.trustindex.test';
        var ftsTiGoodHost = 'admin.trustindex.io';
        function ftsTiRewriteUrl(u) {
            if (!u || typeof u !== 'string') return u;
            return u.indexOf(ftsTiBadHost) !== -1 ? u.replace(ftsTiBadHost, ftsTiGoodHost) : u;
        }
        function ftsTiFixEl(el) {
            if (!el || el.nodeType !== 1) return;
            var attrs = ['src', 'href', 'data-src', 'data-href'];
            for (var i = 0; i < attrs.length; i++) {
                var a = attrs[i];
                if (el.hasAttribute(a)) {
                    var v = el.getAttribute(a);
                    var nv = ftsTiRewriteUrl(v);
                    if (nv !== v) el.setAttribute(a, nv);
                }
            }
        }
        function ftsTiFixTree(root) {
            if (!root || root.nodeType !== 1) return;
            ftsTiFixEl(root);
            var sel = '[src*="' + ftsTiBadHost + '"],[href*="' + ftsTiBadHost + '"],[data-src*="' + ftsTiBadHost + '"],[data-href*="' + ftsTiBadHost + '"]';
            var nodes = root.querySelectorAll(sel);
            for (var i = 0; i < nodes.length; i++) ftsTiFixEl(nodes[i]);
        }
        ftsTiFixTree(document.documentElement);
        if (typeof MutationObserver !== 'undefined' && document.body) {
            var ftsTiObserver = new MutationObserver(function(muts) {
                for (var i = 0; i < muts.length; i++) {
                    var added = muts[i].addedNodes;
                    if (!added) continue;
                    for (var j = 0; j < added.length; j++) {
                        ftsTiFixTree(added[j]);
                    }
                }
            });
            ftsTiObserver.observe(document.body, { childList: true, subtree: true });
        }

        /* ══════════════════════════════════════════════
           Mobile Sticky Book Now Bar
           ══════════════════════════════════════════════ */
        if ($(window).width() <= 768) {
            var curPrice = $('.fts-v2-booking-current-price').first().text() || '';
            var oldPrice = $('.fts-v2-booking-old-price').first().text() || '';

            var barHtml = '<div class="fts-v2-mobile-book-bar">' +
                '<div class="fts-v2-mob-left">' +
                    '<div class="fts-v2-mob-price-row">' +
                        (oldPrice ? '<span class="fts-v2-mob-old">' + oldPrice + '</span> ' : '') +
                        '<span class="fts-v2-mob-current">' + curPrice + '</span>' +
                        '<span class="fts-v2-mob-per"> ' + mobPerPerson + '</span>' +
                    '</div>' +
                    '<div class="fts-v2-mob-cancel">' +
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38a169" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
                        ' ' + mobFreeCancellation +
                    '</div>' +
                '</div>' +
                '<a href="#" class="fts-v2-mob-btn fts-bm-trigger">' + mobBookNow + '</a>' +
            '</div>';

            $('body').append(barHtml);
        }

    }

    function ftsV2Init() {
        /* تشغيل السكربت فقط في صفحات الرحلات */
        if (!document.getElementById('fts-v2-trip-header')) {
            return;
        }

        if (typeof jQuery !== 'undefined') {
            jQuery(document).ready(function() {
                ftsV2Boot(jQuery);
            });
        } else {
            var attempts = 0;
            var waitForJQ = setInterval(function() {
                attempts++;
                if (typeof jQuery !== 'undefined') {
                    clearInterval(waitForJQ);
                    jQuery(document).ready(function() {
                        ftsV2Boot(jQuery);
                    });
                } else if (attempts > 50) {
                    clearInterval(waitForJQ);
                }
            }, 200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ftsV2Init);
    } else {
        ftsV2Init();
    }

})();
