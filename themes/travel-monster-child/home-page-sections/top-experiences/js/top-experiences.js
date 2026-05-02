(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var sections = document.querySelectorAll('.fts-top-exp');

        sections.forEach(function (section) {
            initCarousel(section);
            initSocialProof(section);
        });
    });

    /* ── Carousel Arrows ────────────────────────────────── */

    function initCarousel(section) {
        var track = section.querySelector('.fts-te-track');
        var prev  = section.querySelector('.fts-te-arrow--prev');
        var next  = section.querySelector('.fts-te-arrow--next');

        if (!track) return;

        function getScrollAmount() {
            var card = track.querySelector('.fts-te-card');
            if (!card) return 300;
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
    }

    /* ── Social Proof Animation ─────────────────────────── */

    function initSocialProof(section) {
        var cfg = (typeof ftsTE !== 'undefined') ? ftsTE : {};
        var minV = parseInt(cfg.viewersMin, 10) || 15;
        var maxV = parseInt(cfg.viewersMax, 10) || 50;

        var viewersEl = section.querySelector('[data-type="viewers"]');
        var bookedEl  = section.querySelector('[data-type="booked"]');

        function rand(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        function animateNum(el, value) {
            if (!el) return;
            el.classList.add('is-fading');
            setTimeout(function () {
                el.textContent = value;
                el.classList.remove('is-fading');
            }, 300);
        }

        if (viewersEl) {
            viewersEl.textContent = rand(minV, maxV);
            setInterval(function () {
                animateNum(viewersEl, rand(minV, maxV));
            }, 8000);
        }

        if (bookedEl) {
            bookedEl.textContent = rand(3, 15);
            setInterval(function () {
                animateNum(bookedEl, rand(3, 15));
            }, 12000);
        }
    }

})();
