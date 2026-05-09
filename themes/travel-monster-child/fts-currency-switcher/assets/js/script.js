(function () {
    function parseCookieString(cookieString, name) {
        try {
            var all = String(cookieString || '');
            if (!all) return '';
            var parts = all.split('; ');
            for (var i = 0; i < parts.length; i++) {
                var p = parts[i];
                var eq = p.indexOf('=');
                if (eq <= 0) continue;
                var k = p.slice(0, eq);
                if (k !== name) continue;
                return decodeURIComponent(p.slice(eq + 1));
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    function resolveCurrencyCodeFromSources(search, cookieString) {
        try {
            var q = '';
            try {
                q = new URLSearchParams(String(search || '')).get('wte_cc') || '';
            } catch (e) {
                q = '';
            }
            q = String(q || '').trim().toUpperCase();
            if (q) return q;

            var cc = String(parseCookieString(cookieString, 'cc_code') || '').trim().toUpperCase();
            if (cc) return cc;

            var wc = String(parseCookieString(cookieString, 'wte_currency_code') || '').trim().toUpperCase();
            if (wc) return wc;

            return '';
        } catch (e) {
            return '';
        }
    }

    if (typeof module === 'object' && module.exports) {
        module.exports = {
            parseCookieString: parseCookieString,
            resolveCurrencyCodeFromSources: resolveCurrencyCodeFromSources,
        };
        return;
    }

    if (window.__ftsCurrencySwitcherBound) return;
    window.__ftsCurrencySwitcherBound = true;

    function qsGet(name) {
        try {
            return new URLSearchParams(window.location.search).get(name) || '';
        } catch (e) {
            return '';
        }
    }

    function getCookie(name) {
        return parseCookieString(document.cookie || '', name);
    }

    function setCookie(name, value, days) {
        try {
            var d = new Date();
            d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
            document.cookie = name + '=' + encodeURIComponent(String(value || '')) + ';expires=' + d.toUTCString() + ';path=/';
        } catch (e) {}
    }

    function resolveCurrencyCode() {
        return resolveCurrencyCodeFromSources(window.location.search, document.cookie || '');
    }

    function syncUI(code) {
        if (!code) return;
        var switchers = document.querySelectorAll('.fts-currency-switcher');
        for (var i = 0; i < switchers.length; i++) {
            var sw = switchers[i];
            var items = sw.querySelectorAll('.fts-cs-item');
            for (var j = 0; j < items.length; j++) {
                items[j].classList.remove('active');
            }
            var found = null;
            for (var k = 0; k < items.length; k++) {
                var v = String(items[k].getAttribute('data-currency') || '').trim().toUpperCase();
                if (v === code) { found = items[k]; break; }
            }
            if (found) {
                found.classList.add('active');
                var symEl = found.querySelector('.fts-cs-item-symbol');
                var sym = symEl ? String(symEl.textContent || '').trim() : '';
                if (sym) {
                    var flag = sw.querySelector('.fts-cs-flag');
                    if (flag) flag.textContent = sym;
                }
            }
            var codeEl = sw.querySelector('.fts-cs-code');
            if (codeEl) codeEl.textContent = code;
        }
    }

    function closeAll(exceptEl) {
        var switchers = document.querySelectorAll('.fts-currency-switcher.open');
        for (var i = 0; i < switchers.length; i++) {
            if (exceptEl && switchers[i] === exceptEl) continue;
            switchers[i].classList.remove('open');
            var btn = switchers[i].querySelector('.fts-cs-current');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        }

        var langWrap = document.getElementById('fts-v2-lang-switcher');
        if (langWrap && (!exceptEl || !langWrap.contains(exceptEl))) {
            langWrap.classList.remove('open');
            var langBtn = langWrap.querySelector('.fts-v2-lang-current');
            if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
        }
    }

    function onDocClick(e) {
        var t = e.target;
        if (!t) return;
        var current = t.closest ? t.closest('.fts-currency-switcher .fts-cs-current') : null;
        if (current) {
            e.preventDefault();
            e.stopPropagation();
            var sw = current.closest('.fts-currency-switcher');
            if (!sw) return;
            var isOpen = sw.classList.contains('open');
            closeAll(sw);
            sw.classList.toggle('open', !isOpen);
            return;
        }

        var item = t.closest ? t.closest('.fts-currency-switcher .fts-cs-item') : null;
        if (item) {
            e.preventDefault();
            e.stopPropagation();
            var code = String(item.getAttribute('data-currency') || '').trim().toUpperCase();
            if (!code) return;
            setCookie('cc_code', code, 30);
            setCookie('wte_currency_code', code, 30);
            try {
                var params = new URLSearchParams(window.location.search);
                params.set('wte_cc', code);
                window.location.assign(window.location.pathname + '?' + params.toString() + (window.location.hash || ''));
                return;
            } catch (err) {
                window.location.reload();
            }
            return;
        }

        var inside = t.closest ? t.closest('.fts-currency-switcher') : null;
        if (!inside) closeAll(null);
    }

    function toggleSwitcher(sw) {
        if (!sw) return;
        var isOpen = sw.classList.contains('open');
        closeAll(sw);
        sw.classList.toggle('open', !isOpen);
        var btn = sw.querySelector('.fts-cs-current');
        if (btn) btn.setAttribute('aria-expanded', String(!isOpen));
    }

    function handleCurrentClick(e) {
        e.preventDefault();
        e.stopPropagation();
        var cur = e.currentTarget;
        if (!cur) return;
        var sw = cur.closest ? cur.closest('.fts-currency-switcher') : null;
        toggleSwitcher(sw);
    }

    function handleCurrentKeydown(e) {
        var key = e.key || e.keyCode;
        if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 13 || key === 32) {
            e.preventDefault();
            e.stopPropagation();
            handleCurrentClick(e);
            return;
        }
        if (key === 'ArrowDown' || key === 'Down' || key === 40) {
            e.preventDefault();
            e.stopPropagation();
            var cur = e.currentTarget;
            var sw = cur && cur.closest ? cur.closest('.fts-currency-switcher') : null;
            if (!sw) return;
            if (!sw.classList.contains('open')) toggleSwitcher(sw);
            var first = sw.querySelector('.fts-cs-dropdown .fts-cs-item');
            if (first && first.focus) first.focus();
            return;
        }
        if (key === 'Escape' || key === 'Esc' || key === 27) {
            e.preventDefault();
            e.stopPropagation();
            closeAll(null);
        }
    }

    function handleItemClick(e) {
        e.preventDefault();
        e.stopPropagation();
        var item = e.currentTarget;
        if (!item) return;
        var code = String(item.getAttribute('data-currency') || '').trim().toUpperCase();
        if (!code) return;
        syncUI(code);
        closeAll(null);
        setCookie('cc_code', code, 30);
        setCookie('wte_currency_code', code, 30);
        try {
            var params = new URLSearchParams(window.location.search);
            params.set('wte_cc', code);
            window.location.assign(window.location.pathname + '?' + params.toString() + (window.location.hash || ''));
            return;
        } catch (err) {
            window.location.reload();
        }
    }

    function handleItemKeydown(e) {
        var key = e.key || e.keyCode;
        var item = e.currentTarget;
        var sw = item && item.closest ? item.closest('.fts-currency-switcher') : null;

        if (key === 'Escape' || key === 'Esc' || key === 27) {
            e.preventDefault();
            e.stopPropagation();
            closeAll(null);
            if (sw) {
                var btn = sw.querySelector('.fts-cs-current');
                if (btn && btn.focus) btn.focus();
            }
            return;
        }

        if (key === 'ArrowDown' || key === 'Down' || key === 40 || key === 'ArrowUp' || key === 'Up' || key === 38) {
            e.preventDefault();
            e.stopPropagation();
            if (!sw) return;
            var items = sw.querySelectorAll('.fts-cs-dropdown .fts-cs-item');
            if (!items || !items.length) return;

            var idx = -1;
            for (var i = 0; i < items.length; i++) {
                if (items[i] === item) { idx = i; break; }
            }
            if (idx < 0) return;

            var nextIdx = idx + ((key === 'ArrowDown' || key === 'Down' || key === 40) ? 1 : -1);
            if (nextIdx < 0) nextIdx = items.length - 1;
            if (nextIdx >= items.length) nextIdx = 0;
            if (items[nextIdx] && items[nextIdx].focus) items[nextIdx].focus();
            return;
        }

        if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 13 || key === 32) {
            handleItemClick(e);
        }
    }

    function bindSwitchers() {
        var switchers = document.querySelectorAll('.fts-currency-switcher');
        for (var i = 0; i < switchers.length; i++) {
            var sw = switchers[i];
            if (sw.dataset && sw.dataset.ftsBound === '1') continue;
            if (sw.dataset) sw.dataset.ftsBound = '1';

            var cur = sw.querySelector('.fts-cs-current');
            if (cur) {
                cur.addEventListener('click', handleCurrentClick, true);
                cur.addEventListener('touchend', handleCurrentClick, true);
                cur.addEventListener('keydown', handleCurrentKeydown, true);
            }
            var items = sw.querySelectorAll('.fts-cs-item');
            for (var j = 0; j < items.length; j++) {
                items[j].addEventListener('click', handleItemClick, true);
                items[j].addEventListener('touchend', handleItemClick, true);
                items[j].addEventListener('keydown', handleItemKeydown, true);
            }
        }
    }

    function init() {
        try {
            document.addEventListener('click', onDocClick, true);
        } catch (e) {}
        try {
            document.addEventListener('click', onDocClick, false);
        } catch (e) {}

        bindSwitchers();

        var last = '';
        var n = 0;
        var timer = window.setInterval(function () {
            n += 1;
            bindSwitchers();
            var c = resolveCurrencyCode();
            if (c && c !== last) {
                last = c;
                syncUI(c);
            } else if (c && c === last) {
                syncUI(c);
            }
            if (n >= 20) window.clearInterval(timer);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
