import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  for (const [size, filename] of [
    [16, 'favicon-16.png'],
    [32, 'favicon-32.png'],
    [180, 'apple-touch-icon.png'],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>*{margin:0}html,body,img{width:${size}px;height:${size}px;display:block}</style><img src="${source}">`,
    );
    await page.locator('img').screenshot({
      path: new URL(`../public/${filename}`, import.meta.url).pathname.slice(1),
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
