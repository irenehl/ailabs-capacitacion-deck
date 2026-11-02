import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const withShots = process.argv.includes('--screenshots');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await page.addInitScript(() => { window.__PRINT__ = true; });
await page.goto(pathToFileURL(resolve(root, 'index.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

// Rasterize each slide so the PDF matches the on-screen deck exactly
// (Chrome's print pipeline flattens transparent canvases onto white).
const frames = await page.$$('.frame');
const slides = [];
const links = await page.$$eval('.frame', fs => fs.map(f => {
  const o = f.getBoundingClientRect();
  return [...f.querySelectorAll('a[href]')].map(a => { const r = a.getBoundingClientRect(); return { href: a.href, x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }; });
}));
if (withShots) await mkdir(resolve(root, '.render'), { recursive: true });
for (let i = 0; i < frames.length; i++) {
  const buf = await frames[i].screenshot({ type: 'jpeg', quality: 92 });
  slides.push(buf.toString('base64'));
  if (withShots) await frames[i].screenshot({ path: resolve(root, '.render', `slide-${String(i + 1).padStart(2, '0')}.png`) });
}

const pdfPage = await browser.newPage();
await pdfPage.setContent(`<!DOCTYPE html><html><head><style>
  @page { size: 1920px 1080px; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .pg { position: relative; width: 1920px; height: 1080px; break-after: page; overflow: hidden; }
  .pg:last-child { break-after: auto; }
  .pg img { display: block; width: 100%; height: 100%; }
  .pg a { position: absolute; display: block; }
</style></head><body>${slides.map((b, i) => `<div class="pg"><img src="data:image/jpeg;base64,${b}">${links[i].map(l => `<a href="${l.href}" style="left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.h}px"></a>`).join('')}</div>`).join('')}</body></html>`, { waitUntil: 'load' });
await pdfPage.pdf({
  path: resolve(root, 'AiLabs-Capacitacion-IA.pdf'),
  width: '1920px',
  height: '1080px',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log(`PDF generated: AiLabs-Capacitacion-IA.pdf (${slides.length} slides)`);
