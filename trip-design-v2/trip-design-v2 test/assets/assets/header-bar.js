/**
 * FTS Header Bar
 * Final clean version:
 * - Mobile menu toggle
 * - Language dropdown toggle
 * - Mobile submenu accordion
 * - Only one menu open at a time
 * - Outside click closes everything
 * - ESC closes everything
 * - Uses span toggle to avoid theme button styling conflicts
 */
(function($) {
    'use strict';

    $(document).ready(function() {
        var $header       = $('#fts-v2-trip-header');
        var $burger       = $('#fts-v2-thb-burger');
        var $mobileMenu   = $('#fts-v2-thb-mobile-menu');
        var $langWrap     = $('#fts-v2-lang-switcher');
        var $langButton   = $langWrap.find('.fts-v2-lang-current');
        var $langDropdown = $('#fts-v2-lang-dropdown');

        if (!$header.length) return;

        /* ----------------------------------------------------------
         * Helpers
         * -------------------------------------------------------- */
        function isDesktop() {
            return window.innerWidth > 1100;
        }

        function closeLangDropdown() {
            if (!$langWrap.length || !$langButton.length) return;

            $langWrap.removeClass('open');
            $langButton.attr('aria-expanded', 'false');
        }

        function openLangDropdown() {
            if (!$langWrap.length || !$langButton.length) return;

            $langWrap.addClass('open');
            $langButton.attr('aria-expanded', 'true');
        }

        function closeMobileSubmenus() {
            if (!$mobileMenu.length) return;

            $mobileMenu.find('.sub-open').removeClass('sub-open');
            $mobileMenu.find('.sub-menu').stop(true, true).slideUp(0);
            $mobileMenu.find('.fts-v2-mob-submenu-toggle').attr('aria-expanded', 'false');
        }

        function closeMobileMenu() {
            if (!$burger.length || !$mobileMenu.length) return;

            $burger.removeClass('active').attr('aria-expanded', 'false');
            $mobileMenu.removeClass('open').prop('hidden', true);
            $('body').removeClass('fts-mobile-menu-open');

            closeMobileSubmenus();
        }

        function openMobileMenu() {
            if (!$burger.length || !$mobileMenu.length) return;

            $burger.addClass('active').attr('aria-expanded', 'true');
            $mobileMenu.addClass('open').prop('hidden', false);
            $('body').addClass('fts-mobile-menu-open');
        }

        function closeAllMenus() {
            closeLangDropdown();
            closeMobileMenu();
        }

        function toggleMobileMenu() {
            if ($burger.hasClass('active')) {
                closeMobileMenu();
            } else {
                closeAllMenus();
                openMobileMenu();
            }
        }

        function toggleLangDropdown() {
            if ($langWrap.hasClass('open')) {
                closeLangDropdown();
            } else {
                closeAllMenus();
                openLangDropdown();
            }
        }

        /* ----------------------------------------------------------
         * Burger toggle
         * -------------------------------------------------------- */
        if ($burger.length && $mobileMenu.length) {
            $burger.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleMobileMenu();
            });
        }

        /* ----------------------------------------------------------
         * Language dropdown toggle
         * -------------------------------------------------------- */
        if ($langButton.length && $langDropdown.length) {
            $langButton.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleLangDropdown();
            });
        }

        /* ----------------------------------------------------------
         * Click outside closes everything
         * -------------------------------------------------------- */
        $(document).on('click', function(e) {
            var $target = $(e.target);

            if (!$target.closest('#fts-v2-trip-header').length) {
                closeAllMenus();
            }
        });

        /* ----------------------------------------------------------
         * ESC closes everything
         * -------------------------------------------------------- */
        $(document).on('keydown', function(e) {
            var key = e.key || e.keyCode;

            if (key === 'Escape' || key === 'Esc' || key === 27) {
                closeAllMenus();
            }
        });

        /* ----------------------------------------------------------
         * Build mobile submenu toggles
         * -------------------------------------------------------- */
        function initMobileSubmenus() {
            if (!$mobileMenu.length) return;

            $mobileMenu.find('.fts-v2-thb-mobile-nav > li').each(function() {
                var $li  = $(this);
                var $sub = $li.children('.sub-menu');
                var $link;

                if (!$sub.length) return;

                $link = $li.children('a').first();
                if (!$link.length) return;

                /* امنع تكرار السهم لو السكربت اشتغل أكثر من مرة */
                if ($link.find('.fts-v2-mob-submenu-toggle').length) return;

                $sub.hide();

                var $toggle = $(
                    '<span class="fts-v2-mob-submenu-toggle" role="button" tabindex="0" aria-expanded="false" aria-label="Toggle submenu">' +
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                            '<path d="m6 9 6 6 6-6"></path>' +
                        '</svg>' +
                    '</span>'
                );

                $link.append($toggle);

                function toggleSubmenu(event) {
                    var isOpen;

                    event.preventDefault();
                    event.stopPropagation();

                    isOpen = $li.hasClass('sub-open');

                    /* اغلق أي submenu مفتوح آخر */
                    $mobileMenu.find('.sub-open').not($li).removeClass('sub-open')
                        .children('.sub-menu').stop(true, true).slideUp(200);

                    $mobileMenu.find('.fts-v2-mob-submenu-toggle').not($toggle)
                        .attr('aria-expanded', 'false');

                    /* افتح/اغلق الحالي */
                    $li.toggleClass('sub-open', !isOpen);
                    $toggle.attr('aria-expanded', String(!isOpen));
                    $sub.stop(true, true).slideToggle(250);
                }

                $toggle.on('click', function(e) {
                    toggleSubmenu(e);
                });

                $toggle.on('keydown', function(e) {
                    var key = e.key || e.keyCode;

                    if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 13 || key === 32) {
                        toggleSubmenu(e);
                    }
                });
            });
        }

        initMobileSubmenus();

        /* ----------------------------------------------------------
         * Reset on resize
         * -------------------------------------------------------- */
        $(window).on('resize', function() {
            if (isDesktop()) {
                closeMobileMenu();
            }
        });
    });
})(jQuery);