import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const api = 'http://localhost:3000/api/v1';
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  return { response, body: await response.json().catch(() => null) };
};

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
    password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
  }),
});
assert.equal(login.response.status, 200);
const headers = { authorization: `Bearer ${login.body.data.access_token}` };
const configuration = await call('/languages/configuration', { headers });
const arabic = configuration.body.data.find((item) => item.code === 'ar' && item.enabled);
assert.ok(arabic, 'Arabic must be enabled for the RTL browser verification.');
const existing = await call(`/languages/${arabic.id}/translations`, { headers });
assert.equal(existing.response.status, 200);
const seededValues = {
  'ui.1c9089485a36': 'مرحباً بعودتك',
  'ui.341b4b67bb6b': 'سجّل الدخول إلى حسابك للمتابعة',
  'ui.09ba557fd106': 'عنوان البريد الإلكتروني',
  'ui.8be3c943b160': 'كلمة المرور',
  'ui.c09924a9f455': 'أدخل عنوان بريدك الإلكتروني',
  'ui.1378167d5266': 'أدخل كلمة المرور',
  'ui.f8492cc1deac': 'تسجيل الدخول',
  'ui.1cc8d1815154': 'هل نسيت كلمة المرور؟',
};
const restoreValues = Object.fromEntries(
  Object.keys(seededValues).map((key) => [key, existing.body.data.values[key] ?? '']),
);
const seeded = await call(`/languages/${arabic.id}/translations`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ values: seededValues }),
});
assert.equal(seeded.response.status, 200);

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const selectLanguage = async (name) => {
  await page.getByRole('button', { name: 'Language' }).click();
  await page.getByRole('option', { name }).click();
};
try {
  const publicLanguages = page.waitForResponse((response) =>
    response.url().endsWith('/languages/public'),
  );
  await page.goto('http://localhost:4200/auth/login');
  assert.equal((await publicLanguages).status(), 200);
  const selector = page.getByRole('button', { name: 'Language' });
  await selector.waitFor();
  await selectLanguage(/العربية \(AR\)/);
  await page.getByRole('heading', { name: 'مرحباً بعودتك' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'ar');
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(
    await page.locator('#login-email').evaluate((element) => getComputedStyle(element).direction),
    'ltr',
  );
  assert.equal(
    await page.locator('#login-email').getAttribute('placeholder'),
    'أدخل عنوان بريدك الإلكتروني',
  );
  assert.equal(
    await page
      .locator('.login-shell')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    true,
  );

  await page.reload();
  await page.getByRole('heading', { name: 'مرحباً بعودتك' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('medicare.language')), 'ar');
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  await selectLanguage('English (EN)');
  await page.getByRole('heading', { name: 'Welcome Back' }).waitFor();
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');

  await page.goto('http://localhost:4200/auth/forgot-password');
  await selectLanguage(/العربية \(AR\)/);
  await page.getByRole('heading', { name: 'هل نسيت كلمة المرور؟' }).waitFor();

  console.log(
    JSON.stringify({
      publicLanguages: true,
      enabledArabicVisible: true,
      loginTranslatedWithoutReload: true,
      arabicRtl: true,
      mobileNoOverflow: true,
      preferenceSurvivedRefresh: true,
      englishLtrRestored: true,
      forgotPasswordTranslated: true,
    }),
  );
} finally {
  await browser.close();
  await call(`/languages/${arabic.id}/translations`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: restoreValues }),
  });
}
