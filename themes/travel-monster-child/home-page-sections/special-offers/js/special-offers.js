(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var sections = document.querySelectorAll('.fts-special-offers');

        sections.forEach(function (section) {
            var track = section.querySelector('.fts-so-track');
            var prev  = section.querySelector('.fts-so-arrow--prev');
            var next  = section.querySelector('.fts-so-arrow--next');

            if (!track) return;

            function getScrollAmount() {
                var card = track.querySelector('.fts-so-card');
                if (!card) return 360;
                var style = getComputedStyle(track);
                var gap = parseInt(style.gap, 10) || 20;
                return card.offsetWidth + gap;
            }

            if (prev) {
                prev.addEventListener('click', function () {
                    track.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
                });
            }

            if (next) {
                next.addEventListener('click', function () {
                    track.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
                });
            }
        });
    });
})();
