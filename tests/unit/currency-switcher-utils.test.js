const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseCookieString,
  resolveCurrencyCodeFromSources,
} = require('../../themes/travel-monster-child/fts-currency-switcher/assets/js/script.js');

test('parseCookieString extracts a cookie value (including URL decoding)', () => {
  const cookie = 'a=1; cc_code=EGP; note=E%26F';
  assert.equal(parseCookieString(cookie, 'cc_code'), 'EGP');
  assert.equal(parseCookieString(cookie, 'note'), 'E&F');
  assert.equal(parseCookieString(cookie, 'missing'), '');
});

test('resolveCurrencyCodeFromSources prefers wte_cc query over cookies', () => {
  const cookie = 'cc_code=EUR; wte_currency_code=USD';
  assert.equal(resolveCurrencyCodeFromSources('?wte_cc=sar', cookie), 'SAR');
});

test('resolveCurrencyCodeFromSources prefers cc_code over wte_currency_code when query missing', () => {
  const cookie = 'cc_code=EUR; wte_currency_code=USD';
  assert.equal(resolveCurrencyCodeFromSources('', cookie), 'EUR');
});

test('resolveCurrencyCodeFromSources falls back to empty string when nothing is present', () => {
  assert.equal(resolveCurrencyCodeFromSources('', ''), '');
  assert.equal(resolveCurrencyCodeFromSources(null, null), '');
});

