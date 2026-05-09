# Currency & Language Switchers (Trip V2 Header) — Technical Documentation

## Overview
Trip V2 header now contains two separate dropdown buttons:
- Currency: shows `Currency` + current currency symbol + current currency code (USD/EUR/SAR/…).
- Language: shows `Language` + current language flag + current language code.

Both dropdowns follow the same interaction rules (one open at a time, click-outside + ESC close, keyboard accessible).

## Files
- Header markup (Trip V2): `themes/travel-monster-child/trip-design-v2/parts/trip-header-bar-v2.php`
- Header behavior (language + mobile menu + close-currency): `themes/travel-monster-child/trip-design-v2/assets/header-bar.js`
- Header styles (responsive + dropdown transitions + focus): `themes/travel-monster-child/trip-design-v2/assets/css/header.css` and `themes/travel-monster-child/trip-design-v2/assets/css/trip-header-bar.css`
- Currency switcher markup + currency list: `themes/travel-monster-child/fts-currency-switcher/fts-currency-switcher.php`
- Currency switcher behavior (cookies/query + ARIA + keyboard): `themes/travel-monster-child/fts-currency-switcher/assets/js/script.js`

## Currency Integration (Prices / WP Travel Engine)
### State sources (priority)
Currency code is resolved in this order:
1) Query string: `?wte_cc=USD`
2) Cookie: `cc_code=USD`
3) Cookie: `wte_currency_code=USD`

### What happens on change
When a user selects a currency:
- UI updates immediately (button symbol + code).
- Cookies are written (`cc_code`, `wte_currency_code`, 30 days).
- Page navigates to the same URL with `wte_cc=<CODE>` to ensure server-side price rendering is consistent.

### Supported currencies
The switcher supports any currencies configured in the WP Travel Engine currency converter settings.
Additionally, the UI enforces a minimum set (shown first when available):
`USD`, `EUR`, `GBP`, `SAR`, `EGP`

`AUD` is explicitly excluded from the dropdown.

## Language Integration (WPML)
### Data source
Language items are sourced from WPML when available:
- `icl_get_languages('skip_missing=0&orderby=code')`
- Uses `country_flag_url` when provided by WPML, otherwise falls back to WPML plugin flags under:
  `wp-content/plugins/sitepress-multilingual-cms/res/flags/<code>.svg`

### What happens on change
When a user clicks a language option:
- UI updates immediately (flag + code).
- Browser then navigates to the selected language URL provided by WPML.

If WPML is not available, a fallback list is used (supports 5+ languages).

## Accessibility (WCAG 2.1)
Implemented behaviors:
- Buttons include `aria-expanded`, `aria-controls`, and `aria-haspopup="menu"`.
- Dropdown containers use `role="menu"`.
- ESC closes open menus.
- Keyboard support:
  - Language button: ArrowDown opens and focuses first item.
  - Currency button: Enter/Space toggles, ArrowDown opens and focuses first item, ArrowUp/Down navigates between items, ESC closes.
- Visible focus styles via `:focus-visible`.
- `prefers-reduced-motion: reduce` disables long transitions.

## Performance Notes
- No external JS libraries were added for currency behavior (vanilla JS).
- No extra large images are loaded; flags use WPML-provided small assets.
- Dropdowns rely on CSS transitions (opacity/transform) for smooth animation.

## Testing Checklist (Devices & Browsers)
### Desktop
- Chrome / Firefox / Edge / Safari:
  - Open/close each dropdown
  - Ensure only one dropdown open at a time
  - Click-outside + ESC close
  - Keyboard navigation for currency (ArrowDown/ArrowUp/Enter/ESC)
  - Currency change updates prices after navigation
  - Language change navigates to correct localized URL

### Mobile & Tablet
- iOS Safari + Android Chrome:
  - Tap to open dropdown
  - Tap an item to select
  - Verify dropdown positions remain within viewport
  - Verify header remains responsive without overflow

## Unit Tests
Unit tests target pure helper logic (cookie/query parsing) using Node’s built-in test runner:
- `npm run test:unit`

