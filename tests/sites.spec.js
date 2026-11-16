const { test, expect } = require('@playwright/test');
test('portfolio renders', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('/portfolio/');
  await expect(page.locator('h1')).toContainText('Rodriguez');
  expect(errs).toEqual([]);
});
test('business tabs switch seasons', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('/rodriguez/');
  for (const s of ['fall', 'lawn', 'snow']) {
    await page.click('#t-' + s);
    await expect(page.locator('body')).toHaveAttribute('data-season', s);
    await expect(page.locator('#p-' + s)).toBeVisible();
  }
  expect(errs).toEqual([]);
});
