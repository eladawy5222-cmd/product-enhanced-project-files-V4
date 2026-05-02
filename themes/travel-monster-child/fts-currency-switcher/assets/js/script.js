jQuery(document).ready(function ($) {
    var $switcher = $('.fts-currency-switcher');

    // Toggle Dropdown
    $switcher.find('.fts-cs-current').on('click', function (e) {
        e.stopPropagation();
        var $parent = $(this).closest('.fts-currency-switcher');

        // Close other switchers if any
        $('.fts-currency-switcher').not($parent).removeClass('open');

        $parent.toggleClass('open');
    });

    // Close on click outside
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.fts-currency-switcher').length) {
            $('.fts-currency-switcher').removeClass('open');
        }
    });

    // Select Currency Item
    $('.fts-cs-item').on('click', function () {
        var currencyCode = $(this).data('currency');

        // Set both cookies with 30-day expiry for consistency
        setCookie('cc_code', currencyCode, 30);
        setCookie('wte_currency_code', currencyCode, 30);

        try {
            // Plugin updates query string 'wte_cc'
            var queryParams = new URLSearchParams(window.location.search);
            queryParams.set("wte_cc", currencyCode);
            history.replaceState(null, null, "?" + queryParams.toString());
        } catch (e) {
            console.log("History API not supported");
        }

        // Reload page to apply changes
        window.location.reload();
    });

    function setCookie(cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = "expires=" + d.toUTCString();
        document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
    }
});
