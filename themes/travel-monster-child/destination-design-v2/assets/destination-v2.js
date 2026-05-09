(function ($) {

    'use strict';



    /* ─── Currency cookie helpers ─── */

    function getCookie(name) {

        var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');

        return v ? v.pop() : '';

    }

    function setCookie(name, value, days) {
        try {
            var d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = name + '=' + encodeURIComponent(String(value || '')) + ';expires=' + d.toUTCString() + ';path=/';
        } catch (e) {}
    }
    function getQueryParam(name) {
        try {
            return new URLSearchParams(window.location.search).get(name) || '';
        } catch (e) {
            return '';
        }
    }
    function resolveCurrencyCode() {
        var q = String(getQueryParam('wte_cc') || '').trim().toUpperCase();
        if (q) return q;
        var cc = String(getCookie('cc_code') || '').trim().toUpperCase();
        if (cc) return cc;
        var wte = String(getCookie('wte_currency_code') || '').trim().toUpperCase();
        if (wte) return wte;
        return '';
    }
    function syncCurrencyCookie() {

        var resolved = resolveCurrencyCode();
        if (resolved) {
            setCookie('cc_code', resolved, 30);
            setCookie('wte_currency_code', resolved, 30);
        }
        return resolved;
    }



    var $grid       = $('#fts-dest-v2-grid'),

        $count      = $('#fts-dest-v2-count'),

        $sort       = $('#fts-dest-v2-sort'),

        $filters    = $('#fts-dest-v2-filters'),

        $loadWrap   = $('#fts-dest-v2-load-more-wrap'),

        $sidebar    = $('.fts-dest-v2-sidebar'),

        $layout     = $('#fts-dest-v2-layout'),

        $fab        = $('#fts-dest-v2-filter-fab'),

        $backdrop   = $('#fts-dest-v2-backdrop'),

        $closeBtn   = $('#fts-dest-v2-filters-close'),

        $filterBtn  = $('#fts-dest-v2-tag-filter-btn'),

        $tagCount   = $('#fts-dest-v2-tag-count'),

        $chips      = $('#fts-dest-v2-active-chips'),

        $clearLink  = $('#fts-dest-v2-clear-link'),

        $tagsScroll = $('#fts-dest-v2-tags-scroll'),

        $scrollL    = $('#fts-dest-v2-scroll-left'),

        $scrollR    = $('#fts-dest-v2-scroll-right'),

        slug        = $filters.data('slug'),

        taxonomy    = $filters.data('taxonomy') || ftsDestV2.taxonomy || 'destination',

        debounce    = null;



    /* ─── Tag pills scroll arrows ─── */

    $scrollL.on('click', function () {

        $tagsScroll[0].scrollBy({ left: -200, behavior: 'smooth' });

    });

    $scrollR.on('click', function () {

        $tagsScroll[0].scrollBy({ left: 200, behavior: 'smooth' });

    });



    /* ─── Filter accordion ─── */

    $filters.on('click', '.fts-dest-v2-filter-toggle', function () {

        $(this).closest('.fts-dest-v2-filter-section').toggleClass('is-open');

    });



    /* ─── Collect active filters ─── */

    function gatherFilters() {

        var f = {};

        $filters.find('input[type="checkbox"]:checked').each(function () {

            var name = $(this).attr('name');

            if (!f[name]) f[name] = [];

            f[name].push($(this).val());

        });

        return f;

    }



    /* ─── Reload Trustindex scripts after AJAX ─── */

    function reloadTrustindex() {

        $grid.find('script[src*="trustindex"]').each(function () {

            var s = document.createElement('script');

            s.src = this.src;

            s.defer = true;

            document.body.appendChild(s);

        });

    }



    /* ─── Skeleton loader ─── */

    function showSkeletons(n) {

        var html = '';

        for (var i = 0; i < (n || 6); i++) {

            html += '<div class="fts-dest-v2-skeleton">' +

                '<div class="fts-dest-v2-skeleton-media"></div>' +

                '<div class="fts-dest-v2-skeleton-body">' +

                '<div class="fts-dest-v2-skeleton-line"></div>' +

                '<div class="fts-dest-v2-skeleton-line"></div>' +

                '<div class="fts-dest-v2-skeleton-line"></div>' +

                '</div></div>';

        }

        $grid.html(html);

    }



    /* ─── Count active filters & update badge ─── */

    function updateFilterCount() {

        var total = $filters.find('input[type="checkbox"]:checked').length;

        if (total > 0) {

            $tagCount.text(total).show();

        } else {

            $tagCount.hide();

        }

    }



    /* ─── Build active chips from checked checkboxes ─── */

    function buildChips() {

        $chips.empty();

        $filters.find('input[type="checkbox"]:checked').each(function () {

            var $cb = $(this);

            var label = $cb.closest('.fts-dest-v2-filter-item').find('.fts-dest-v2-filter-label').text().trim();

            var tax = $cb.attr('name');

            var val = $cb.val();

            var chip = $('<span class="fts-dest-v2-chip"></span>')

                .text(label)

                .append(

                    $('<button type="button" class="fts-dest-v2-chip-x" aria-label="Remove">&times;</button>')

                        .on('click', function (e) {

                            e.stopPropagation();

                            $cb.prop('checked', false);

                            syncTagPill(tax, val, false);

                            triggerFilter();

                        })

                );

            $chips.append(chip);

        });

    }



    /* ─── Sync a tag pill active state ─── */

    function syncTagPill(taxonomy, slug, active) {

        $('.fts-dest-v2-tag-item').each(function () {

            var $p = $(this);

            if ($p.data('taxonomy') === taxonomy && $p.data('slug') === slug) {

                $p.toggleClass('is-active', active);

            }

        });

    }



    /* ─── Sync all tag pills from checkboxes ─── */

    function syncAllTagPills() {

        $('.fts-dest-v2-tag-item').each(function () {

            var $p = $(this);

            var tax = $p.data('taxonomy');

            var sl = $p.data('slug');

            var $cb = $filters.find('input[name="' + tax + '"][value="' + sl + '"]');

            $p.toggleClass('is-active', $cb.length > 0 && $cb.is(':checked'));

        });

    }



    /* ─── Run filter (central) ─── */

    function triggerFilter() {

        clearTimeout(debounce);

        debounce = setTimeout(runFilter, 300);

    }



    /* ─── AJAX filter ─── */

    function runFilter() {

        var filters = gatherFilters();

        showSkeletons(6);

        $loadWrap.hide();

        updateFilterCount();

        buildChips();

        syncAllTagPills();



        var ccCode = syncCurrencyCookie();

        $.post(ftsDestV2.ajax, {

            action: 'fts_dest_v2_filter',

            nonce: ftsDestV2.nonce,

            destination_slug: slug,

            term_slug: slug,

            taxonomy: taxonomy,

            filters: filters,

            sort: $sort.val(),

            currency_code: ccCode

        }, function (res) {

            if (res.success) {

                $grid.html(res.data.html);

                $count.text(res.data.count + ' results');

                updateURL(filters);

                reloadTrustindex();

            }

        }).fail(function () {

            $grid.html('<p style="text-align:center;padding:40px;color:#999;">Something went wrong. Please try again.</p>');

        });

    }



    /* Sidebar checkbox changes */

    $filters.on('change', 'input[type="checkbox"]', function () {

        var $cb = $(this);

        syncTagPill($cb.attr('name'), $cb.val(), $cb.is(':checked'));

        triggerFilter();

    });



    $sort.on('change', function () {

        triggerFilter();

    });



    /* ─── Tag pill click → toggle sidebar checkbox ─── */

    $(document).on('click', '.fts-dest-v2-tag-item', function () {

        var $pill = $(this);

        var tax = $pill.data('taxonomy');

        var sl = $pill.data('slug');

        var $cb = $filters.find('input[name="' + tax + '"][value="' + sl + '"]');



        if ($cb.length) {

            var isChecked = $cb.is(':checked');

            $cb.prop('checked', !isChecked);

            $pill.toggleClass('is-active', !isChecked);

            $cb.closest('.fts-dest-v2-filter-section').addClass('is-open');

            triggerFilter();

        }

    });



    /* ─── Filters toggle button: drawer on mobile, sidebar slide on desktop ─── */

    $filterBtn.on('click', function () {

        if (window.innerWidth <= 768) {

            openDrawer();

        } else {

            $layout.toggleClass('sidebar-open');

            $(this).toggleClass('is-active');

        }

    });



    /* ─── Clear All ─── */

    function clearAll() {

        $filters.find('input[type="checkbox"]').prop('checked', false);

        $sort.val('featured');

        $('.fts-dest-v2-tag-item').removeClass('is-active');

        $chips.empty();

        updateFilterCount();

        runFilter();

    }



    $clearLink.on('click', clearAll);

    $(document).on('click', '#fts-dest-v2-clear-all, #fts-dest-v2-no-results-clear', clearAll);



    /* ─── Load More ─── */

    $loadWrap.on('click', '#fts-dest-v2-load-more', function () {

        var $btn  = $(this),

            page  = parseInt($btn.data('page'), 10);



        $btn.addClass('is-loading').text('Loading...');



        var ccCode = syncCurrencyCookie();

        $.post(ftsDestV2.ajax, {

            action: 'fts_dest_v2_load_more',

            nonce: ftsDestV2.nonce,

            destination_slug: slug,

            term_slug: slug,

            taxonomy: taxonomy,

            page: page,

            currency_code: ccCode

        }, function (res) {

            if (res.success) {

                $grid.append(res.data.html);

                var next = page + 1;

                $btn.data('page', next).text('Load More Trips').removeClass('is-loading');

                if (!res.data.has_more) {

                    $loadWrap.fadeOut(300);

                }

                reloadTrustindex();

            }

        }).fail(function () {

            $btn.text('Load More Trips').removeClass('is-loading');

        });

    });



    /* ─── Mobile drawer (FAB) ─── */

    function openDrawer() {

        $sidebar.addClass('is-open');

        $backdrop.addClass('is-visible');

        $('body').css('overflow', 'hidden');

    }



    function closeDrawer() {

        $sidebar.removeClass('is-open');

        $backdrop.removeClass('is-visible');

        $('body').css('overflow', '');

    }



    $fab.on('click', openDrawer);

    $closeBtn.on('click', closeDrawer);

    $backdrop.on('click', closeDrawer);



    /* ─── URL state ─── */

    function updateURL(filters) {

        if (!window.history || !window.history.replaceState) return;

        var params = new URLSearchParams();

        $.each(filters, function (key, vals) {

            params.set(key, vals.join(','));

        });

        var sortVal = $sort.val();

        if (sortVal && sortVal !== 'featured') params.set('sort', sortVal);

        var qs = params.toString();

        var url = window.location.pathname + (qs ? '?' + qs : '');

        window.history.replaceState(null, '', url);

    }



    function restoreFromURL() {

        var params = new URLSearchParams(window.location.search);

        var hasFilters = false;

        params.forEach(function (value, key) {

            if (key === 'sort') {

                $sort.val(value);

                return;

            }

            var vals = value.split(',');

            vals.forEach(function (v) {

                var $cb = $filters.find('input[name="' + key + '"][value="' + v + '"]');

                if ($cb.length) {

                    $cb.prop('checked', true);

                    $cb.closest('.fts-dest-v2-filter-section').addClass('is-open');

                    hasFilters = true;

                }

            });

        });

        if (hasFilters || params.has('sort')) {

            syncAllTagPills();

            updateFilterCount();

            buildChips();

            runFilter();

        }

    }



    restoreFromURL();



})(jQuery);

