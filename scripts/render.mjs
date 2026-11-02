import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const withShots = process.argv.includes('--screenshots');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(() => { window.__PRINT__ = true; });
await page.goto(pathToFileURL(resolve(root, 'index.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

if (withShots) {
  await mkdir(resolve(root, '.render'), { recursive: true });
  const frames = await page.$$('.frame');
  for (let i = 0; i < frames.length; i++) {
    await frames[i].screenshot({ path: resolve(root, '.render', `slide-${String(i + 1).padStart(2, '0')}.png`) });
  }
}

await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: resolve(root, 'AiLabs-Capacitacion-IA.pdf'),
  width: '1920px',
  height: '1080px',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log('PDF generated: AiLabs-Capacitacion-IA.pdf');
