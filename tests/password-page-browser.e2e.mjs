import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:4200/auth/reset-password?token=browser-test-token', {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('#new-password').waitFor();
    const layout = await page.evaluate(() => ({
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      heading: document.querySelector('.login-card h2')?.textContent?.trim(),
      brandBackground: getComputedStyle(document.querySelector('.login-brand')).backgroundImage,
      inputBackgrounds: [...document.querySelectorAll('.login-input')].map(
        (element) => getComputedStyle(element).backgroundColor,
      ),
      logoLoaded: window.matchMedia('(max-width: 720px)').matches
        ? document.querySelector('.login-mobile-brand img')?.naturalWidth > 0
        : document.querySelector('.login-brand__logo')?.naturalWidth > 0,
    }));
    assert.equal(layout.horizontalOverflow, false);
    assert.equal(layout.heading, 'Create New Password');
    assert.equal(layout.logoLoaded, true);
    assert.ok(layout.inputBackgrounds.every((color) => color === 'rgba(0, 0, 0, 0)'));
    if (viewport.width > 720) assert.match(layout.brandBackground, /medicare-login-hospital\.png/);

    await page.locator('button[aria-label="Show new password"]').click();
    await page.waitForFunction(
      () => document.querySelector('#new-password')?.getAttribute('type') === 'text',
    );
    assert.equal(await page.locator('#new-password').getAttribute('type'), 'text');
    await page.close();
  }

  const missingTokenPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await missingTokenPage.goto('http://127.0.0.1:4200/auth/reset-password', {
    waitUntil: 'domcontentloaded',
  });
  await missingTokenPage.getByText('Request New Link').waitFor();
  assert.match(await missingTokenPage.locator('[role="alert"]').innerText(), /incomplete/i);
  assert.equal(await missingTokenPage.locator('#new-password').count(), 0);
  await missingTokenPage.close();
} finally {
  await browser.close();
}
