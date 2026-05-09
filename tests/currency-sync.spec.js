const { test, expect } = require('playwright/test');

function cookieBase(urlString) {
  const u = new URL(urlString);
  return { domain: u.hostname, path: '/', secure: u.protocol === 'https:' };
}

function validateBaseUrl() {
  const raw = process.env.BASE_URL;
  if (!raw) return { ok: false, reason: 'missing' };
  let u;
  try {
    u = new URL(raw);
  } catch (e) {
    return { ok: false, reason: 'invalid' };
  }
  if (u.hostname === 'your-staging-domain.com') return { ok: false, reason: 'placeholder' };
  return { ok: true, url: u.toString().replace(/\/+$/, '') };
}

test.describe('Currency state sync', () => {
  const v = validateBaseUrl();
  test.skip(!v.ok, v.reason === 'placeholder'
    ? 'BASE_URL is set to a placeholder. Set BASE_URL to a real deployed domain (staging/live).'
    : 'Set BASE_URL to a real deployed domain (staging/live) that includes these code changes.'
  );

  test('Currency switcher header matches active currency cookies', async ({ page, context, baseURL }) => {
  const base = baseURL;
  const c = cookieBase(base);
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

  await context.addCookies([
    { ...c, name: 'cc_code', value: 'EUR', expires },
    { ...c, name: 'wte_currency_code', value: 'USD', expires },
  ]);

  await page.goto('/tours/hurghada-cairo-giza-by-bus/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('.fts-currency-switcher .fts-cs-code')).toHaveText('EUR');
  await expect(page.locator('.fts-v2-booking-current-price')).toContainText('€');
  });

  test('wte_cc query parameter takes precedence for currency display', async ({ page, context, baseURL }) => {
  const base = baseURL;
  const c = cookieBase(base);
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

  await context.addCookies([
    { ...c, name: 'cc_code', value: 'EUR', expires },
    { ...c, name: 'wte_currency_code', value: 'EUR', expires },
  ]);

  await page.goto('/tours/hurghada-cairo-giza-by-bus/?wte_cc=USD', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('.fts-currency-switcher .fts-cs-code')).toHaveText('USD');
  });

  test('Currency switcher opens on click', async ({ page, baseURL }) => {
    await page.goto('/tours/hurghada-cairo-giza-by-bus/', { waitUntil: 'domcontentloaded' });
    const pill = page.locator('.fts-currency-switcher .fts-cs-current');
    await expect(pill).toBeVisible();
    await pill.click();
    const dropdown = page.locator('.fts-currency-switcher .fts-cs-dropdown');
    await expect(page.locator('.fts-currency-switcher')).toHaveClass(/open/);
    await expect(dropdown).toBeVisible();
  });

  test('Currency switcher selection navigates with wte_cc', async ({ page }) => {
    await page.goto('/tours/hurghada-cairo-giza-by-bus/', { waitUntil: 'domcontentloaded' });
    await page.locator('.fts-currency-switcher .fts-cs-current').click();
    const firstItem = page.locator('.fts-currency-switcher .fts-cs-item').first();
    const code = (await firstItem.getAttribute('data-currency')) || '';
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      firstItem.click(),
    ]);
    await expect(page).toHaveURL(new RegExp(`[?&]wte_cc=${code}`));
  });
});
