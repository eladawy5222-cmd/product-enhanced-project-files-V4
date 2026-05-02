(function($) {
    'use strict';

    if (typeof $ === 'undefined') return;

    $(function() {
        var $cards = $('.fts-terms-v2-card');
        if (!$cards.length) return;

        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    var el = entry.target;
                    var idx = $(el).index();
                    var delay = Math.min(idx * 60, 300);
                    setTimeout(function() {
                        el.classList.add('is-visible');
                    }, delay);
                    observer.unobserve(el);
                }
            });
        }, { threshold: 0.1 });

        $cards.each(function() {
            this.style.opacity = '0';
            this.style.transform = 'translateY(20px)';
            observer.observe(this);
        });

        var style = document.createElement('style');
        style.textContent =
            '.fts-terms-v2-card{transition:opacity .45s ease,transform .45s ease,box-shadow .4s ease!important}' +
            '.fts-terms-v2-card.is-visible{opacity:1!important;transform:translateY(0)!important}' +
            '.fts-terms-v2-card.is-visible:hover{transform:translateY(-6px)!important}';
        document.head.appendChild(style);
    });

})(jQuery);
