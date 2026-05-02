/*!
 * FTS Single Post — Table of Contents builder + scrollspy + smooth scroll.
 * Mobile slider is CSS-only (scroll-snap); no JS needed there.
 */
(function () {
	'use strict';

	function ready(fn) {
		if (document.readyState !== 'loading') {
			fn();
		} else {
			document.addEventListener('DOMContentLoaded', fn);
		}
	}

	function slugify(text) {
		return String(text || '')
			.toLowerCase()
			.trim()
			.replace(/[\s\W-]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	function getScrollOffset() {
		// Try to respect a fixed/sticky site header if present.
		var header = document.querySelector('header.site-header, header#masthead, .site-header, #masthead');
		var headerH = 0;
		if (header) {
			var r = header.getBoundingClientRect();
			// Consider it a header if it sits near the top of the viewport.
			if (r.top <= 4 && r.height > 0) {
				headerH = r.height;
			}
		}
		return headerH + 24; // a little breathing room
	}

	function buildToc() {
		var article = document.querySelector('.fts-sp-article .fts-sp-article__content');
		var listEl = document.querySelector('.fts-sp-toc__list');
		var emptyEl = document.querySelector('.fts-sp-toc__empty');
		var tocEl = document.querySelector('.fts-sp-toc');

		if (!article || !listEl || !tocEl) return null;

		var headings = article.querySelectorAll('h2, h3');
		if (!headings.length) {
			if (emptyEl) emptyEl.hidden = false;
			listEl.hidden = true;
			tocEl.classList.add('is-empty');
			return null;
		}

		var usedIds = Object.create(null);
		var items = [];
		var currentH2Li = null;
		var currentH3List = null;

		headings.forEach(function (h) {
			var text = (h.textContent || '').trim();
			if (!text) return;

			var id = h.id;
			if (!id) {
				var base = slugify(text) || 'section';
				id = base;
				var i = 2;
				while (document.getElementById(id) || usedIds[id]) {
					id = base + '-' + i++;
				}
				h.id = id;
			}
			usedIds[id] = true;
			// Offset anchor so sticky header doesn't overlap heading.
			h.classList.add('fts-sp-anchor');

			var li = document.createElement('li');
			li.className = 'fts-sp-toc__item fts-sp-toc__item--' + h.tagName.toLowerCase();

			var a = document.createElement('a');
			a.className = 'fts-sp-toc__link';
			a.href = '#' + id;
			a.textContent = text;
			a.setAttribute('data-target', id);
			li.appendChild(a);

			if (h.tagName === 'H2') {
				listEl.appendChild(li);
				currentH2Li = li;
				currentH3List = null;
			} else {
				// H3
				if (!currentH2Li) {
					// orphan H3: place at top level
					listEl.appendChild(li);
				} else {
					if (!currentH3List) {
						currentH3List = document.createElement('ul');
						currentH3List.className = 'fts-sp-toc__sublist';
						currentH2Li.appendChild(currentH3List);
					}
					currentH3List.appendChild(li);
				}
			}

			items.push({ id: id, el: h, link: a, li: li });
		});

		// Click -> smooth scroll with header offset.
		listEl.addEventListener('click', function (e) {
			var link = e.target.closest('a.fts-sp-toc__link');
			if (!link) return;
			var id = link.getAttribute('data-target');
			var target = document.getElementById(id);
			if (!target) return;
			e.preventDefault();
			var offset = getScrollOffset();
			var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
			window.scrollTo({ top: top, behavior: 'smooth' });
			// update hash without jumping
			if (history.replaceState) {
				history.replaceState(null, '', '#' + id);
			}
		});

		return items;
	}

	function initScrollspy(items) {
		if (!items || !items.length || !('IntersectionObserver' in window)) return;

		var linkById = Object.create(null);
		items.forEach(function (it) {
			linkById[it.id] = it.link;
		});

		var activeId = null;

		function setActive(id) {
			if (activeId === id) return;
			activeId = id;
			items.forEach(function (it) {
				it.link.classList.toggle('is-active', it.id === id);
				// Highlight ancestor H2 when a nested H3 is active.
				var parentH2Li = it.li.closest('.fts-sp-toc__item--h2');
				if (parentH2Li) {
					var parentLink = parentH2Li.querySelector(':scope > a.fts-sp-toc__link');
					if (parentLink) {
						var anyActiveChild = parentH2Li.querySelector('.fts-sp-toc__sublist .fts-sp-toc__link.is-active');
						parentLink.classList.toggle('is-parent-active', !!anyActiveChild && parentLink !== linkById[id]);
					}
				}
			});
		}

		var visible = new Map();

		var observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting) {
					visible.set(entry.target.id, entry.boundingClientRect.top);
				} else {
					visible.delete(entry.target.id);
				}
			});

			if (visible.size > 0) {
				// Active = heading with the smallest (closest to top) positive-ish top.
				var bestId = null;
				var bestTop = Infinity;
				visible.forEach(function (top, id) {
					if (Math.abs(top) < bestTop) {
						bestTop = Math.abs(top);
						bestId = id;
					}
				});
				if (bestId) setActive(bestId);
			}
		}, {
			rootMargin: '-20% 0px -70% 0px',
			threshold: [0, 1]
		});

		items.forEach(function (it) {
			observer.observe(it.el);
		});

		// Fallback: on scroll, if nothing is intersecting, pick the last heading above the fold.
		var ticking = false;
		window.addEventListener('scroll', function () {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(function () {
				ticking = false;
				if (visible.size > 0) return;
				var offset = getScrollOffset() + 10;
				var current = null;
				for (var i = 0; i < items.length; i++) {
					var top = items[i].el.getBoundingClientRect().top;
					if (top - offset <= 0) {
						current = items[i].id;
					} else {
						break;
					}
				}
				if (current) setActive(current);
			});
		}, { passive: true });
	}

	ready(function () {
		var items = buildToc();
		if (items) initScrollspy(items);
	});
})();
