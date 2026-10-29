import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  for (const viewport of [
    { width: 1440, height: 900, mobile: false },
    { width: 1280, height: 720, mobile: false },
    { width: 390, height: 844, mobile: true },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.route('**/api/v1/languages/public', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'en',
              code: 'en',
              name: 'English',
              nativeName: 'English',
              enabled: true,
              isDefault: true,
              translationCoverage: 100,
              translations: [],
            },
            {
              id: 'ar',
              code: 'ar',
              name: 'Arabic',
              nativeName: 'العربية',
              enabled: true,
              isDefault: false,
              translationCoverage: 100,
              translations: [],
            },
            {
              id: 'pt-br',
              code: 'pt-BR',
              name: 'Portuguese (Brazil)',
              nativeName: 'Português',
              enabled: true,
              isDefault: false,
              translationCoverage: 100,
              translations: [],
            },
          ],
        }),
      }),
    );
    await page.goto('http://127.0.0.1:4200/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('.login-submit').waitFor();
    const layout = await page.evaluate(() => ({
      documentOverflow:
        document.documentElement.scrollHeight > document.documentElement.clientHeight,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      brandVisible: getComputedStyle(document.querySelector('.login-brand')).display !== 'none',
      submitVisible: Boolean(document.querySelector('.login-submit')),
      brandLogoLoaded: window.matchMedia('(max-width: 720px)').matches
        ? document.querySelector('.login-mobile-brand img')?.naturalWidth > 0
        : document.querySelector('.login-brand__logo')?.naturalWidth > 0,
      primaryColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim(),
      panelBackground: getComputedStyle(document.querySelector('.login-panel')).backgroundImage,
      faviconSizes: [...document.querySelectorAll('link[rel="icon"]')].map(
        (link) => link.sizes.value,
      ),
      faviconHrefs: [...document.querySelectorAll('link[rel="icon"]')].map((link) => link.href),
      title: document.title,
      heading: document.querySelector('.login-card h2')?.textContent?.trim(),
      benefitCount: document.querySelectorAll('.login-brand__benefits span').length,
      brandBackground: getComputedStyle(document.querySelector('.login-brand')).backgroundImage,
      inputBackgrounds: [...document.querySelectorAll('.login-input')].map(
        (element) => getComputedStyle(element).backgroundColor,
      ),
      wordmark: {
        visible: getComputedStyle(document.querySelector('.login-brand__logo')).visibility,
        opacity: getComputedStyle(document.querySelector('.login-brand__logo')).opacity,
        source: document.querySelector('.login-brand__logo')?.getAttribute('src'),
      },
      panelWidths: {
        brand: document.querySelector('.login-brand').getBoundingClientRect().width,
        form: document.querySelector('.login-panel').getBoundingClientRect().width,
      },
    }));
    assert.equal(
      layout.horizontalOverflow,
      false,
      `${viewport.width}x${viewport.height} has horizontal overflow`,
    );
    assert.equal(layout.submitVisible, true);
    assert.equal(
      layout.brandLogoLoaded,
      true,
      `${viewport.width}x${viewport.height} logo did not load`,
    );
    assert.equal(layout.primaryColor, '#0f4c75');
    assert.ok(layout.inputBackgrounds.every((color) => color === 'rgba(0, 0, 0, 0)'));
    assert.equal(layout.wordmark.visible, 'visible');
    assert.equal(layout.wordmark.opacity, '1');
    assert.equal(layout.wordmark.source, 'logo-full-light.svg');
    assert.equal(layout.title, 'Login | MediCare+');
    assert.equal(layout.heading, 'Welcome Back');
    assert.equal(layout.benefitCount, 3);
    const languageTrigger = page.getByRole('button', { name: 'Language' });
    assert.equal((await languageTrigger.textContent()).replace(/\s+/g, ' ').trim(), 'English (EN)');
    assert.equal(
      await page.locator('.auth-language').getByText('Language', { exact: true }).count(),
      0,
    );
    await languageTrigger.click();
    const languageOptions = await page.getByRole('option').allTextContents();
    assert.deepEqual(
      languageOptions.map((value) => value.replace(/\s+/g, ' ').trim()),
      ['English (EN)', 'العربية (AR)', 'Português (PT-BR)'],
    );
    if (!viewport.mobile) {
      assert.match(layout.panelBackground, /linear-gradient/);
    }
    assert.ok(layout.faviconSizes.includes('16x16'));
    assert.ok(layout.faviconSizes.includes('32x32'));
    assert.ok(layout.faviconHrefs.some((href) => href.includes('favicon-32.png?v=3')));
    if (!viewport.mobile) {
      assert.match(layout.brandBackground, /medicare-login-hospital\.png/);
      if (viewport.width >= 1000) assert.ok(layout.panelWidths.brand > layout.panelWidths.form);
      assert.equal(
        layout.documentOverflow,
        false,
        `${viewport.width}x${viewport.height} has desktop document overflow`,
      );
      assert.equal(layout.brandVisible, true);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
