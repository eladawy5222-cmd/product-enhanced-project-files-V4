document.addEventListener('DOMContentLoaded', function () {
    var items = document.querySelectorAll('.fts-faq-item');

    items.forEach(function (item) {
        var btn    = item.querySelector('.fts-faq-question');
        var answer = item.querySelector('.fts-faq-answer');
        if (!btn || !answer) return;

        btn.addEventListener('click', function () {
            var isOpen = item.classList.contains('is-open');

            // Close all others
            items.forEach(function (other) {
                if (other === item) return;
                other.classList.remove('is-open');
                var otherBtn = other.querySelector('.fts-faq-question');
                var otherAns = other.querySelector('.fts-faq-answer');
                if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
                if (otherAns) {
                    otherAns.style.maxHeight = '0';
                    otherAns.setAttribute('aria-hidden', 'true');
                }
            });

            // Toggle current
            if (isOpen) {
                item.classList.remove('is-open');
                btn.setAttribute('aria-expanded', 'false');
                answer.style.maxHeight = '0';
                answer.setAttribute('aria-hidden', 'true');
            } else {
                item.classList.add('is-open');
                btn.setAttribute('aria-expanded', 'true');
                answer.style.maxHeight = answer.scrollHeight + 'px';
                answer.setAttribute('aria-hidden', 'false');
            }
        });
    });
});
