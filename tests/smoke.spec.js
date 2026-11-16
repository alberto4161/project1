const { test, expect } = require('@playwright/test');
test('home page loads', async ({ page }) => {
  const res = await page.goto('/');
  expect(res.ok()).toBeTruthy();
});
