jQuery(document).ready(function ($) {
    // Open/Close Tooltip
    $('.fts-ss-trigger').on('click', function (e) {
        e.stopPropagation();
        var $wrapper = $(this).closest('.fts-smart-search-wrapper');
        $('.fts-smart-search-wrapper').not($wrapper).removeClass('active'); // Close others if any
        $wrapper.toggleClass('active');

        // Focus input if opening
        if ($wrapper.hasClass('active')) {
            setTimeout(function () {
                $wrapper.find('.fts-ss-input').focus();
            }, 100);
        }
    });

    // Close on Click Outside or Close Button
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.fts-smart-search-wrapper').length) {
            $('.fts-smart-search-wrapper').removeClass('active');
        }
    });

    // Close Button Action
    $('.fts-ss-close-btn').on('click', function (e) {
        e.stopPropagation();
        $('.fts-smart-search-wrapper').removeClass('active');
    });

    // Prevent closing when clicking inside tooltip
    $('.fts-ss-tooltip').on('click', function (e) {
        e.stopPropagation();
    });
});
