const { test, expect } = require('@playwright/test');

const watch = page => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  return errors;
};

test('portfolio shows the real experience, resume and contact links', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/portfolio/');
  await expect(page.locator('h1')).toContainText('Rodriguez');
  await expect(page.locator('#work')).toContainText('Hats Off Hospitality');
  await expect(page.locator('#work')).toContainText('TGI Sport');
  await expect(page.locator('.ledger tbody tr')).toHaveCount(6);
  await expect(page.locator('.track img')).toHaveCount(7);
  await expect(page.locator('#contact a[href^="mailto:"]')).toBeVisible();

  // Every image file and the resume are really there.
  const sources = await page.locator('img').evaluateAll(imgs => imgs.map(img => img.src));
  for (const src of [...sources, new URL('resume.pdf', page.url()).href]) {
    expect((await page.request.get(src)).ok(), src).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test('portfolio photo strip moves sideways on scroll (wide screens)', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'the strip is a swipe row on phones');
  await page.goto('/portfolio/');
  const track = page.locator('.track');
  await track.scrollIntoViewIfNeeded();
  const x = () => track.evaluate(el => el.getBoundingClientRect().left);
  const before = await x();
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(120); }
  await page.waitForTimeout(800);
  expect(await x()).toBeLessThan(before - 300);
});

test('business tabs switch seasons and every scene draws', async ({ page }) => {
  const errors = watch(page);
  await page.goto('/rodriguez/');
  await expect(page.locator('.lead')).toContainText('North Side');
  const painted = () => page.locator('#fx').evaluate(cv => {
    const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) n++;
    return n;
  });
  for (const season of ['fall', 'lawn', 'snow']) {
    await page.click('#t-' + season);
    await expect(page.locator('html')).toHaveAttribute('data-season', season);
    await expect(page.locator('#p-' + season)).toBeVisible();
    await page.waitForTimeout(700);
    expect(await painted(), season + ' scene is drawn').toBeGreaterThan(2000);
  }
  expect(errors).toEqual([]);
});

test('snow blower clears the drift, then the snow comes back', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/rodriguez/');
  // Share of the bottom strip of the scene (just above the walk) that is covered in snow.
  const cover = () => page.locator('#fx').evaluate(cv => {
    const scale = cv.width / cv.clientWidth, y = Math.round((cv.clientHeight - 16 - 10) * scale);
    const row = cv.getContext('2d').getImageData(0, y, cv.width, 1).data;
    let white = 0;
    for (let i = 0; i < row.length; i += 4) if (row[i] > 195 && row[i + 1] > 210 && row[i + 2] > 225 && row[i + 3] > 200) white++;
    return white / cv.width;
  });
  expect(await cover()).toBeGreaterThan(0.8);
  await expect.poll(cover, { message: 'cleared after the pass', timeout: 30000 }).toBeLessThan(0.15);
  await expect.poll(cover, { message: 'snow has built up again', timeout: 30000 }).toBeGreaterThan(0.6);
});

test('quote form asks for the missing details', async ({ page }) => {
  await page.goto('/rodriguez/');
  await page.locator('#quote-form button').click();
  await expect(page.locator('.status')).toContainText('Add your name');
  await expect(page.locator('input[name="name"]')).toBeFocused();
});
