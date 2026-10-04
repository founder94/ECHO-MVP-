import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [mode, w, h, out, fps = '30'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await p.goto('http://localhost:4320/film.html', { waitUntil: 'load' });
await p.evaluate(() => window.__ready);
const T = await p.evaluate(() => window.FILM_T);
const times = mode === 'keys' ? [0.8, 2.5, 4.4, 6.5, 8.6, 10.3, 12.4, 14.9, 16.4, 18.3, 19.6, 21.6, 23.6] : Array.from({ length: Math.round(T * +fps) }, (_, i) => i / +fps);
let i = 0;
for (const t of times) {
  await p.evaluate((x) => window.renderAt(x), t);
  await p.screenshot({ path: `${out}/${String(i++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
}
console.log('frames', i);
await b.close();
