import { chromium } from 'playwright-core';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const baseUrl = process.argv[2] || 'http://localhost:4200';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Welcome Back' }).waitFor();

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Page Not Found' }).waitFor();
  if ((await page.title()) !== '404 - Page Not Found | MediCare+')
    throw new Error(`Unexpected /login title: ${await page.title()}`);
  if (!(await page.getByRole('button', { name: 'Go to Login' }).isVisible()))
    throw new Error('Guest login fallback is missing');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Page Not Found' }).waitFor();
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
  )
    throw new Error('404 page has horizontal overflow on mobile');

  await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Page Not Found' }).waitFor();

  await page.getByRole('button', { name: 'Go to Login' }).click();
  await page.waitForURL('**/auth/login');
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click({ force: true });
  await page.waitForURL('**/dashboard');

  await page.goto(`${baseUrl}/auth/sign-in`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Page Not Found' }).waitFor();
  await page.getByRole('button', { name: 'Go to Dashboard' }).click();
  await page.waitForURL('**/dashboard');

  await page.goto(`${baseUrl}/definitely-not-a-real-route`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Page Not Found' }).waitFor();
  if (!(await page.getByRole('button', { name: 'Go to Dashboard' }).isVisible()))
    throw new Error('Authenticated dashboard fallback is missing');
  await page.getByRole('button', { name: 'Go Back' }).click();
  await page.waitForURL('**/dashboard');

  console.log(
    JSON.stringify({
      canonicalLogin: 'passed',
      removedLoginRoute: 'passed',
      removedSignInAlias: 'passed',
      guest404: 'passed',
      authenticated404: 'passed',
      directRefresh: 'passed',
      goBack: 'passed',
      mobile: 'passed',
    }),
  );
} finally {
  await browser.close();
}
