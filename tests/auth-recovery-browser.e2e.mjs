import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

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
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  const forgot = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await forgot.goto('http://127.0.0.1:4200/auth/forgot-password');
  await forgot.locator('#reset-email').fill(`unknown.${Date.now()}@medicare.test`);
  await forgot.getByRole('button', { name: 'Send Reset Link' }).click();
  await forgot.getByRole('status').waitFor();
  assert.equal(await forgot.getByRole('link', { name: 'Back to Sign In' }).count(), 1);
  assert.equal(await forgot.getByRole('button', { name: /Back to Sign In/i }).count(), 0);
  assert.equal(
    await forgot.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    false,
  );
  await forgot.close();

  const profile = await browser.newPage({ viewport: { width: 1280, height: 600 } });
  await profile.goto('http://127.0.0.1:4200/auth/login');
  await profile.locator('#login-email').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await profile.locator('#login-password').fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await profile.getByRole('button', { name: /Sign In/i }).click();
  await profile.waitForURL(/dashboard/);
  await profile.goto('http://127.0.0.1:4200/profile');
  await profile.getByRole('button', { name: 'Change password' }).click();
  const dialog = profile.getByRole('dialog', { name: 'Change Password' });
  await dialog.waitFor();
  assert.equal(await dialog.locator('.crud-modal__header-icon').count(), 1);
  assert.match(await dialog.locator('.crud-modal__header').innerText(), /keep your account secure/i);
  await dialog.getByRole('button', { name: 'Show current password' }).click();
  assert.equal(await dialog.getByPlaceholder('Enter current password').getAttribute('type'), 'text');
  assert.equal(await dialog.getByPlaceholder('Enter new password').getAttribute('type'), 'password');
  await dialog.getByPlaceholder('Enter current password').fill('CurrentPassword123!');
  await dialog.getByPlaceholder('Enter new password').fill('NewPassword456!');
  await dialog.getByText('Strong', { exact: true }).waitFor();
  await dialog.getByPlaceholder('Confirm new password').fill('DifferentPassword456!');
  await dialog.getByRole('button', { name: 'Update Password' }).click();
  await dialog.getByText('Passwords do not match.').waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Update Password' }).isEnabled(), true);
  assert.equal(await dialog.locator('.crud-modal__footer').isVisible(), true);
  assert.equal(await dialog.getByText(/Security Tip:/).isVisible(), true);
  await profile.close();
} finally {
  await browser.close();
}
