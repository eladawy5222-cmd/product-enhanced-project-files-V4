/**
 * FTS Custom Checkout — interactions
 *
 * @package FTS_Checkout
 */
(function ($) {
	'use strict';

	var PAYABLE_SEL = '.wpte-checkout__booking-summary-payable td:last-child strong, .wpte-checkout__booking-summary-payable td:last-child';
	var TIMER_KEY = 'ftsCheckoutHoldExpires';

	function pad(n) {
		return n < 10 ? '0' + n : String(n);
	}

	/**
	 * Countdown for “hold your spot” (default 7 minutes).
	 */
	function initTimer() {
		var $el = $('[data-fts-checkout-timer]');
		var $display = $('[data-fts-timer-display]');
		if (!$el.length || !$display.length) {
			return;
		}

		var totalSec = parseInt($el.attr('data-fts-checkout-timer'), 10);
		if (!totalSec || totalSec < 1) {
			totalSec = 420;
		}

		var end = sessionStorage.getItem(TIMER_KEY);
		var now = Date.now();
		if (!end || parseInt(end, 10) < now) {
			end = now + totalSec * 1000;
			sessionStorage.setItem(TIMER_KEY, String(end));
		} else {
			end = parseInt(end, 10);
		}

		function tick() {
			var left = Math.max(0, Math.floor((end - Date.now()) / 1000));
			var m = Math.floor(left / 60);
			var s = left % 60;
			$display.text(pad(m) + ':' + pad(s));
			if (left <= 0) {
				clearInterval(iv);
			}
		}

		tick();
		var iv = setInterval(tick, 1000);
	}

	/**
	 * Move terms + submit into a fixed bar (still inside #wptravelengine-checkout__form).
	 */
	function initStickyCheckoutBar() {
		var $form = $('#wptravelengine-checkout__form');
		if (!$form.length) {
			return;
		}

		var $terms = $form.find('.wpte-checkout__term-condition').last();
		var $submit = $form.find('.wpte-checkout__form-submit').last();
		if (!$terms.length || !$submit.length) {
			return;
		}

		var $payRow = $(PAYABLE_SEL).last();
		var payText = $.trim($payRow.text()) || '';

		var $bar = $('<div class="fts-checkout-sticky--in-form" role="region" aria-label="Checkout actions"/>');
		var $right = $('<div class="fts-checkout-sticky__right"/>');
		var $payWrap = $('<div class="fts-checkout-sticky__payline"/>');
		$payWrap.append(
			$('<span class="fts-checkout-sticky__payline-label"/>').text(
				typeof ftsCheckoutL10n !== 'undefined' && ftsCheckoutL10n.payableNow
					? ftsCheckoutL10n.payableNow
					: 'PAYABLE NOW'
			)
		);
		$payWrap.append($('<span class="fts-checkout-sticky__payline-amt" data-fts-payable-copy/>').text(payText));

		$right.append($payWrap);
		$right.append($submit);

		$bar.append($terms);
		$bar.append($right);

		$form.append($bar);
		$('body').addClass('fts-checkout--sticky-active');

		// Keep amount in sync when cart fragments update (coupon, etc.).
		if (typeof MutationObserver !== 'undefined') {
			var mo = new MutationObserver(function () {
				var t = $.trim($(PAYABLE_SEL).last().text());
				if (t) {
					$('[data-fts-payable-copy]').text(t);
				}
			});
			var summary = document.querySelector('[data-cart-summary]');
			if (summary) {
				mo.observe(summary, { childList: true, subtree: true, characterData: true });
			}
		}
	}

	/**
	 * Clicking a payment card selects its radio.
	 */
	function initPaymentCards() {
		$(document).on('click', '.fts-checkout__main .wpte-checkout__payment-method', function (e) {
			var $t = $(this);
			if ($(e.target).is('input, label, a, button')) {
				return;
			}
			var $r = $t.find('input[type="radio"]').first();
			if ($r.length) {
				$r.prop('checked', true).trigger('change');
			}
		});

		$(document).on('change', 'input[name="wpte_checkout_paymnet_method"]', function () {
			var $methods = $('.fts-checkout__main .wpte-checkout__payment-method');
			$methods.find('.wpte-checkout__form-control').removeClass('checked');
			$(this).closest('.wpte-checkout__form-control').addClass('checked');
		});
	}

	/**
	 * Inject small kicker labels above Billing / Payment box titles.
	 */
	/**
	 * Optional billing <details>: closed on mobile, open on wider viewports (HTML has open by default for desktop).
	 */
	function syncBillingOptionalDetailsOpen() {
		var el = document.querySelector('.fts-checkout-billing__optional');
		if (!el || el.tagName !== 'DETAILS') {
			return;
		}
		if (window.matchMedia('(max-width: 768px)').matches) {
			el.removeAttribute('open');
		} else {
			el.setAttribute('open', '');
		}
	}

	function injectSectionKickers() {
		function kicker(text) {
			return $('<span class="fts-section-label fts-section-label--inject"/>').text(text);
		}

		var $payBox = $('.fts-checkout__main .wpte-checkout__box').has('[data-checkout-payment-methods]').first();
		if (
			$payBox.length &&
			!$payBox.find('.fts-checkout-payment__header').length &&
			!$payBox.find('.fts-section-label--inject').length
		) {
			$payBox.find('.wpte-checkout__box-title').first().prepend(
				kicker(typeof ftsCheckoutL10n !== 'undefined' && ftsCheckoutL10n.payment ? ftsCheckoutL10n.payment : 'PAYMENT')
			);
		}

		if ( ! $( '.fts-checkout-billing' ).length ) {
			$( '.fts-checkout__main .wpte-checkout__box' ).each( function () {
				var $box = $( this );
				if ( $box.find( '.fts-section-label--inject' ).length ) {
					return;
				}
				var title = ( $box.find( '.wpte-checkout__box-title' ).first().text() || '' ).toLowerCase();
				if ( title.indexOf( 'billing' ) !== -1 ) {
					$box.find( '.wpte-checkout__box-title' ).first().prepend(
						kicker( typeof ftsCheckoutL10n !== 'undefined' && ftsCheckoutL10n.billing ? ftsCheckoutL10n.billing : 'BILLING DETAILS' )
					);
					return false;
				}
			} );
		}
	}

	$(function () {
		if (!$('body').hasClass('fts-checkout-page')) {
			return;
		}
		initTimer();
		initStickyCheckoutBar();
		initPaymentCards();
		injectSectionKickers();
		syncBillingOptionalDetailsOpen();
		var resizeTimer;
		$(window).on('resize', function () {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(syncBillingOptionalDetailsOpen, 150);
		});
	});
})(jQuery);
