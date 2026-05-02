/**
 * FTS Top Experiences — Admin Page JS
 */
(function ($) {
    'use strict';

    var $search     = $('#fts-te-search');
    var $results    = $('#fts-te-search-results');
    var $list       = $('#fts-te-list');
    var $empty      = $('#fts-te-empty');
    var $saveBtn    = $('#fts-te-save');
    var $status     = $('#fts-te-status');
    var searchTimer = null;
    var rowTemplate = $('#tmpl-fts-te-row').html();

    function getAddedIds() {
        var ids = [];
        $list.find('.fts-te-row').each(function () {
            ids.push(parseInt($(this).data('trip-id'), 10));
        });
        return ids;
    }

    function toggleEmpty() {
        $list.find('.fts-te-row').length ? $empty.hide() : $empty.show();
    }

    /* ── Search ─────────────────────────────────────────── */

    $search.on('input', function () {
        clearTimeout(searchTimer);
        var q = $.trim($(this).val());
        if (q.length < 2) { $results.hide().empty(); return; }

        searchTimer = setTimeout(function () {
            $.post(ftsTEAdmin.ajax_url, {
                action: 'fts_search_trips_te',
                nonce:  ftsTEAdmin.nonce,
                query:  q
            }, function (res) {
                $results.empty();
                if (!res.success || !res.data.length) {
                    $results.html('<div class="fts-te-search-no-results">' + ftsTEAdmin.i18n.no_results + '</div>');
                    $results.show();
                    return;
                }

                var addedIds = getAddedIds();
                $.each(res.data, function (_, trip) {
                    var isAdded = addedIds.indexOf(trip.id) !== -1;
                    var thumbHtml = trip.thumb
                        ? '<img src="' + trip.thumb + '" alt="" />'
                        : '<span class="dashicons dashicons-format-image"></span>';

                    var $item = $(
                        '<div class="fts-te-search-item' + (isAdded ? ' is-added' : '') + '" data-trip-id="' + trip.id + '">' +
                            thumbHtml +
                            '<span class="fts-te-search-item-title">' + trip.title + '</span>' +
                            '<span class="fts-te-search-item-id">#' + trip.id + '</span>' +
                        '</div>'
                    );
                    $item.data('trip', trip);
                    $results.append($item);
                });
                $results.show();
            });
        }, 300);
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('.fts-te-search-wrap').length) $results.hide();
    });

    /* ── Add ─────────────────────────────────────────────── */

    $results.on('click', '.fts-te-search-item:not(.is-added)', function () {
        var trip = $(this).data('trip');
        if (!trip) return;

        var thumbHtml = trip.thumb
            ? '<img src="' + trip.thumb + '" alt="" />'
            : '<span class="dashicons dashicons-format-image fts-te-no-thumb"></span>';

        var html = rowTemplate
            .replace(/\{tripId\}/g, trip.id)
            .replace(/\{title\}/g, trip.title)
            .replace(/\{thumbHtml\}/g, thumbHtml);

        $list.append(html);
        $(this).addClass('is-added');
        toggleEmpty();
    });

    /* ── Remove ──────────────────────────────────────────── */

    $list.on('click', '.fts-te-remove', function () {
        $(this).closest('.fts-te-row').fadeOut(200, function () {
            $(this).remove();
            toggleEmpty();
        });
    });

    /* ── Sortable ────────────────────────────────────────── */

    $list.sortable({
        handle: '.fts-te-drag',
        axis: 'y',
        placeholder: 'fts-te-row ui-sortable-placeholder',
        tolerance: 'pointer',
        cursor: 'grabbing'
    });

    /* ── Save ────────────────────────────────────────────── */

    $saveBtn.on('click', function () {
        var $btn = $(this);
        $btn.prop('disabled', true).text('Saving...');
        $status.text('').removeClass('is-success is-error');

        var items = [];
        $list.find('.fts-te-row').each(function (i) {
            items.push({
                trip_id: parseInt($(this).data('trip-id'), 10),
                badge:   $(this).find('.fts-te-badge-select').val() || '',
                order:   i
            });
        });

        $.post(ftsTEAdmin.ajax_url, {
            action: 'fts_save_top_experiences',
            nonce:  ftsTEAdmin.nonce,
            items:  JSON.stringify(items)
        }, function (res) {
            $btn.prop('disabled', false).text('Save');
            if (res.success) {
                $status.text(ftsTEAdmin.i18n.saved).addClass('is-success');
            } else {
                $status.text(ftsTEAdmin.i18n.save_error).addClass('is-error');
            }
            setTimeout(function () { $status.text(''); }, 3000);
        }).fail(function () {
            $btn.prop('disabled', false).text('Save');
            $status.text(ftsTEAdmin.i18n.save_error).addClass('is-error');
        });
    });

    toggleEmpty();

})(jQuery);
