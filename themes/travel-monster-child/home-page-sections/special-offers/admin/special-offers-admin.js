/**
 * FTS Special Offers — Admin Page JS
 *
 * Handles trip search, add/remove/reorder, and save via AJAX.
 */
(function ($) {
    'use strict';

    var $search      = $('#fts-so-search');
    var $results     = $('#fts-so-search-results');
    var $list        = $('#fts-so-list');
    var $empty       = $('#fts-so-empty');
    var $saveBtn     = $('#fts-so-save');
    var $status      = $('#fts-so-status');
    var searchTimer  = null;
    var rowTemplate  = $('#tmpl-fts-so-row').html();

    function getAddedIds() {
        var ids = [];
        $list.find('.fts-so-row').each(function () {
            ids.push( parseInt($(this).data('trip-id'), 10) );
        });
        return ids;
    }

    function toggleEmpty() {
        if ($list.find('.fts-so-row').length) {
            $empty.hide();
        } else {
            $empty.show();
        }
    }

    /* ── Search ─────────────────────────────────────────── */

    $search.on('input', function () {
        clearTimeout(searchTimer);
        var q = $.trim($(this).val());

        if (q.length < 2) {
            $results.hide().empty();
            return;
        }

        searchTimer = setTimeout(function () {
            $.post(ftsSOAdmin.ajax_url, {
                action: 'fts_search_trips',
                nonce:  ftsSOAdmin.nonce,
                query:  q
            }, function (res) {
                $results.empty();

                if (!res.success || !res.data.length) {
                    $results.html('<div class="fts-so-search-no-results">' + ftsSOAdmin.i18n.no_results + '</div>');
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
                        '<div class="fts-so-search-item' + (isAdded ? ' is-added' : '') + '" data-trip-id="' + trip.id + '">' +
                            thumbHtml +
                            '<span class="fts-so-search-item-title">' + trip.title + '</span>' +
                            '<span class="fts-so-search-item-id">#' + trip.id + '</span>' +
                        '</div>'
                    );

                    $item.data('trip', trip);
                    $results.append($item);
                });

                $results.show();
            });
        }, 300);
    });

    /* Close results on outside click */
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.fts-so-search-wrap').length) {
            $results.hide();
        }
    });

    /* ── Add Trip ───────────────────────────────────────── */

    $results.on('click', '.fts-so-search-item:not(.is-added)', function () {
        var trip = $(this).data('trip');
        if (!trip) return;

        var thumbHtml = trip.thumb
            ? '<img src="' + trip.thumb + '" alt="" />'
            : '<span class="dashicons dashicons-format-image fts-so-no-thumb"></span>';

        var html = rowTemplate
            .replace(/\{tripId\}/g, trip.id)
            .replace(/\{title\}/g, trip.title)
            .replace(/\{thumbHtml\}/g, thumbHtml);

        $list.append(html);
        $(this).addClass('is-added');
        toggleEmpty();
    });

    /* ── Remove Trip ────────────────────────────────────── */

    $list.on('click', '.fts-so-remove', function () {
        $(this).closest('.fts-so-row').fadeOut(200, function () {
            $(this).remove();
            toggleEmpty();
        });
    });

    /* ── Sortable ───────────────────────────────────────── */

    $list.sortable({
        handle: '.fts-so-drag',
        axis: 'y',
        placeholder: 'fts-so-row ui-sortable-placeholder',
        tolerance: 'pointer',
        cursor: 'grabbing'
    });

    /* ── Save ───────────────────────────────────────────── */

    $saveBtn.on('click', function () {
        var $btn = $(this);
        $btn.prop('disabled', true).text($btn.data('saving') || 'Saving...');
        $status.text('').removeClass('is-success is-error');

        var offers = [];
        $list.find('.fts-so-row').each(function (i) {
            offers.push({
                trip_id:  parseInt($(this).data('trip-id'), 10),
                badge:    $(this).find('.fts-so-badge-select').val() || '',
                end_date: $(this).find('.fts-so-date-input').val() || '',
                order:    i
            });
        });

        $.post(ftsSOAdmin.ajax_url, {
            action: 'fts_save_special_offers',
            nonce:  ftsSOAdmin.nonce,
            offers: JSON.stringify(offers)
        }, function (res) {
            $btn.prop('disabled', false).text('Save Offers');

            if (res.success) {
                $status.text(ftsSOAdmin.i18n.saved).addClass('is-success');
            } else {
                $status.text(ftsSOAdmin.i18n.save_error).addClass('is-error');
            }

            setTimeout(function () {
                $status.text('');
            }, 3000);
        }).fail(function () {
            $btn.prop('disabled', false).text('Save Offers');
            $status.text(ftsSOAdmin.i18n.save_error).addClass('is-error');
        });
    });

    toggleEmpty();

})(jQuery);
