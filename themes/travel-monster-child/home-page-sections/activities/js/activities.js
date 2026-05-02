(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var sections = document.querySelectorAll('.fts-activities');

        sections.forEach(function (section) {
            var track = section.querySelector('.fts-activities-track');
            var prev  = section.querySelector('.fts-activities-arrow--prev');
            var next  = section.querySelector('.fts-activities-arrow--next');

            if (!track) return;

            function getScrollAmount() {
                var card = track.querySelector('.fts-act-card');
                if (!card) return 220;
                var style = getComputedStyle(track);
                var gap = parseInt(style.gap, 10) || 16;
                return card.offsetWidth + gap;
            }

            if (prev) {
                prev.addEventListener('click', function () {
                    track.scrollBy({ left: -getScrollAmount() * 2, behavior: 'smooth' });
                });
            }

            if (next) {
                next.addEventListener('click', function () {
                    track.scrollBy({ left: getScrollAmount() * 2, behavior: 'smooth' });
                });
            }
        });
    });
})();
