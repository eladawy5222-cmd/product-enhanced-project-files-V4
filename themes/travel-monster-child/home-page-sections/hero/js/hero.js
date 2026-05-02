(function ($) {
    'use strict';

    if (typeof ftsHeroData === 'undefined') return;

    var ajaxUrl    = ftsHeroData.ajaxUrl || '';
    var nonce      = ftsHeroData.nonce || '';
    var archiveUrl = ftsHeroData.archiveUrl || '/trips/';
    var currency   = ftsHeroData.currency || '$';
    var i18n       = ftsHeroData.i18n || {};

    var $form      = $('#fts-hero-search-form');
    var $input     = $('#fts-hero-search-input');
    var $results   = $('#fts-hero-results');
    var currentXHR = null;
    var debounceTimer = null;

    function fmtPrice(v) {
        var n = parseFloat(v);
        if (isNaN(n) || n <= 0) return '';
        return currency + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    /* ── Loading / Empty States ───────────────────────────── */

    function showLoading() {
        $results.html(
            '<div class="fts-hero-loading">' +
                '<div class="fts-hero-spinner"></div>' +
                '<span>' + (i18n.searching || 'Searching...') + '</span>' +
            '</div>'
        ).addClass('is-visible');
    }

    function showNoResults() {
        $results.html(
            '<div class="fts-hero-no-results">' +
                '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="8" y2="14"/></svg>' +
                '<p>' + (i18n.no_results || 'No trips found. Try different keywords.') + '</p>' +
            '</div>'
        ).addClass('is-visible');
    }

    function hideResults() {
        $results.removeClass('is-visible').empty();
    }

    /* ── Render Trip Results ──────────────────────────────── */

    function renderTrips(data) {
        var trips = data.trips || [];
        var total = data.total || 0;

        if (!trips.length) { showNoResults(); return; }

        var html = '';
        for (var i = 0; i < trips.length; i++) {
            var t = trips[i];

            var thumbHtml = t.thumbnail
                ? '<img src="' + t.thumbnail + '" alt="' + t.title + '" loading="lazy">'
                : '<div class="fts-hero-result-thumb-placeholder"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';

            var metaParts = [];
            if (t.destination) {
                metaParts.push(
                    '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                    t.destination + '</span>'
                );
            }
            if (t.duration_text) {
                metaParts.push(
                    '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
                    t.duration_text + '</span>'
                );
            }
            if (t.rating > 0) {
                metaParts.push(
                    '<span><svg viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
                    '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
                    t.rating.toFixed(1) + '</span>'
                );
            }

            var priceHtml = '';
            if (t.price > 0) {
                if (t.old_price > 0 && t.old_price > t.price) {
                    priceHtml += '<span class="fts-hero-result-old-price">' + fmtPrice(t.old_price) + '</span>';
                }
                priceHtml += '<span class="fts-hero-result-current-price">' + fmtPrice(t.price) + '</span>';
                priceHtml += '<span class="fts-hero-result-price-label">' + (i18n.per_person || '/person') + '</span>';
            }

            html +=
                '<a href="' + t.url + '" class="fts-hero-result-card" role="option">' +
                    '<div class="fts-hero-result-thumb">' + thumbHtml + '</div>' +
                    '<div class="fts-hero-result-info">' +
                        '<div class="fts-hero-result-title">' + t.title + '</div>' +
                        '<div class="fts-hero-result-meta">' + metaParts.join('') + '</div>' +
                    '</div>' +
                    (priceHtml ? '<div class="fts-hero-result-price">' + priceHtml + '</div>' : '') +
                '</a>';
        }

        if (total > trips.length) {
            var keyword = $.trim($input.val());
            var sep     = archiveUrl.indexOf('?') > -1 ? '&' : '?';
            var viewUrl = archiveUrl + sep + 's=' + encodeURIComponent(keyword) + '&post_type=trip';
            var viewAllText = (i18n.view_all || 'View All %s Results').replace('%s', total);

            html +=
                '<a href="' + viewUrl + '" class="fts-hero-view-all">' +
                    viewAllText +
                    ' <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>' +
                '</a>';
        }

        $results.html(html).addClass('is-visible');
    }

    /* ── AJAX Search ──────────────────────────────────────── */

    function doSearch() {
        var keyword = $.trim($input.val());

        if (keyword.length < 2) {
            hideResults();
            return;
        }

        if (currentXHR) currentXHR.abort();
        showLoading();

        currentXHR = $.ajax({
            url:  ajaxUrl,
            type: 'POST',
            data: {
                action:  'fts_hero_search',
                nonce:   nonce,
                keyword: keyword
            },
            dataType: 'json',
            success: function (res) {
                currentXHR = null;
                if (res && res.success) {
                    renderTrips(res.data);
                } else {
                    showNoResults();
                }
            },
            error: function (xhr, status) {
                currentXHR = null;
                if (status !== 'abort') showNoResults();
            }
        });
    }

    /* ── Event Bindings ───────────────────────────────────── */

    $input.on('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(doSearch, 300);
    });

    $form.on('submit', function (e) {
        if ($.trim($input.val()).length < 2) {
            e.preventDefault();
        }
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('.fts-hero-search-wrap').length) {
            hideResults();
        }
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape') {
            hideResults();
            $input.blur();
        }
    });

    $input.on('focus', function () {
        if ($.trim($input.val()).length >= 2 && $results.children().length > 0) {
            $results.addClass('is-visible');
        }
    });

    /* ── Scroll Indicator ─────────────────────────────────── */

    $('.fts-hero-scroll').on('click', function () {
        var heroBottom = $('.fts-hero').offset().top + $('.fts-hero').outerHeight();
        $('html, body').animate({ scrollTop: heroBottom }, 600, 'swing');
    });

})(jQuery);
