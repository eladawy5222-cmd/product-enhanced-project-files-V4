/**
 * File group.js.
 *
 * Theme Group customizer.
 * 
 * @package Travel_Monster
 */

(function ($) {
    "use strict";
    $(document).on("click", ".wte-customizer-group-collapsible .head-label", (function () {
        var container = $(this).closest(".wte-customizer-group");
        container.find(" > .group-content").slideToggle(200);
        container.toggleClass("is-active");
        return false;
    }));

})(jQuery);