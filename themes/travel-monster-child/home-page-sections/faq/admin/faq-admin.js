(function ($) {
    'use strict';

    var $list   = $('#fts-faq-list');
    var $empty  = $('#fts-faq-empty');
    var $status = $('#fts-faq-status');

    function toggleEmpty() {
        $empty.toggle($list.children('.fts-faq-row').length === 0);
    }

    function createRow(question, answer) {
        var $row = $('<div class="fts-faq-row"></div>');
        $row.append('<span class="fts-faq-drag dashicons dashicons-menu"></span>');

        var $fields = $('<div class="fts-faq-row-fields"></div>');
        $fields.append(
            $('<input type="text" class="fts-faq-question-input">').attr('placeholder', ftsFaqAdmin.i18n.question_ph).val(question || '')
        );
        $fields.append(
            $('<textarea class="fts-faq-answer-input" rows="3"></textarea>').attr('placeholder', ftsFaqAdmin.i18n.answer_ph).val(answer || '')
        );
        $row.append($fields);

        $row.append(
            '<button type="button" class="fts-faq-remove" title="Remove"><span class="dashicons dashicons-trash"></span></button>'
        );

        return $row;
    }

    // Sortable
    $list.sortable({
        handle: '.fts-faq-drag',
        placeholder: 'fts-faq-row-placeholder',
        opacity: 0.7,
        cursor: 'grabbing'
    });

    // Add row
    $('#fts-faq-add').on('click', function () {
        $list.append(createRow('', ''));
        toggleEmpty();
        $list.find('.fts-faq-row:last .fts-faq-question-input').focus();
    });

    // Remove row
    $list.on('click', '.fts-faq-remove', function () {
        if (!confirm(ftsFaqAdmin.i18n.confirm_remove)) return;
        $(this).closest('.fts-faq-row').fadeOut(200, function () {
            $(this).remove();
            toggleEmpty();
        });
    });

    // Save
    $('#fts-faq-save').on('click', function () {
        var $btn = $(this);
        $btn.prop('disabled', true);
        $status.text('').removeClass('success error');

        var items = [];
        $list.find('.fts-faq-row').each(function () {
            var q = $(this).find('.fts-faq-question-input').val().trim();
            var a = $(this).find('.fts-faq-answer-input').val().trim();
            if (q) {
                items.push({ question: q, answer: a });
            }
        });

        $.post(ftsFaqAdmin.ajax_url, {
            action: 'fts_save_faq',
            nonce: ftsFaqAdmin.nonce,
            faq_items: JSON.stringify(items)
        })
        .done(function (res) {
            if (res.success) {
                $status.text(ftsFaqAdmin.i18n.saved).addClass('success');
            } else {
                $status.text(ftsFaqAdmin.i18n.save_error).addClass('error');
            }
        })
        .fail(function () {
            $status.text(ftsFaqAdmin.i18n.save_error).addClass('error');
        })
        .always(function () {
            $btn.prop('disabled', false);
            setTimeout(function () { $status.fadeOut(300, function () { $(this).text('').show(); }); }, 3000);
        });
    });

    toggleEmpty();
})(jQuery);
