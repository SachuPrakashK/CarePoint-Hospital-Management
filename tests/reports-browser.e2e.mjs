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
const baseUrl = process.argv[2] || process.env.E2E_BASE_URL || 'http://localhost:4200';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email address').fill(env.SEED_HOSPITAL_ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(env.SEED_HOSPITAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto(`${baseUrl}/reports`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Reports & Analytics' }).waitFor();

  const legend = page.locator('.department-legend');
  const legendItems = legend.locator('.department-legend__item');
  const legendCount = await legendItems.count();
  if (!legendCount) throw new Error('Department legend has no accessible entries');
  const desktopClipped = await legend.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  if (desktopClipped) throw new Error('Department legend is horizontally clipped on desktop');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  if (!/^medicare-report-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()))
    throw new Error(`Unexpected report filename: ${download.suggestedFilename()}`);
  const downloadPath = await download.path();
  const csv = fs.readFileSync(downloadPath);
  if (!csv.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])))
    throw new Error('Report CSV is missing its UTF-8 BOM');
  if (!csv.toString('utf8').includes('Department,Appointments,Admissions,Total Activity'))
    throw new Error('Report CSV is missing department performance headings');

  await page.setViewportSize({ width: 390, height: 844 });
  await legend.scrollIntoViewIfNeeded();
  const mobile = await legend.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
    maxHeight: getComputedStyle(element).maxHeight,
  }));
  if (mobile.overflowY !== 'auto' || mobile.horizontalOverflow)
    throw new Error(`Mobile legend is not usable: ${JSON.stringify(mobile)}`);
  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log(
    JSON.stringify({
      legendItems: legendCount,
      desktopLegend: 'visible',
      mobileLegend: 'scrollable',
      csvDownload: 'passed',
      consoleErrors: 0,
    }),
  );
} finally {
  await browser.close();
}
