// 히어로(앱 첫 화면 /) 전후 픽셀 비교 — 움직임을 멈춘 같은 조건에서 두 빌드를 찍어 다른 픽셀 수를 센다.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const serve = (dir, port) => new Promise((r) => { const s = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = join(dir, p); if (!existsSync(f) || statSync(f).isDirectory()) f = join(dir, 'index.html'); res.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f)); }); s.listen(port, '127.0.0.1', () => r(s)); });
const [A, B] = [await serve('out-before', 4710), await serve(process.env.AFTER || 'out-pastel', 4711)];
mkdirSync('shots/hero', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function shot(port, w, h, path) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', isMobile: w < 800 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('doit:intro-seen', '1'); } catch {} });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdnjs|jsdelivr|supabase\.co|readdy/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await ctx.newPage(); await p.goto(`http://127.0.0.1:${port}${path}`); await p.waitForTimeout(3500);
  await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' }); await p.waitForTimeout(300);
  const png = await p.screenshot({ fullPage: false }); await ctx.close(); return png;
}
const probe = await browser.newPage();
let total = 0;
for (const [w, h] of [[360, 780], [390, 844], [430, 932], [1440, 900]]) {
  const a = await shot(4710, w, h, '/'); const b = await shot(4711, w, h, '/');
  const diff = await probe.evaluate(async ([x, y]) => { const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const d1 = await load(x), d2 = await load(y); let n = 0; for (let k = 0; k < d1.length; k += 4) if (d1[k] !== d2[k] || d1[k + 1] !== d2[k + 1] || d1[k + 2] !== d2[k + 2]) n++; return { n, px: d1.length / 4 }; }, [a.toString('base64'), b.toString('base64')]);
  (await import('node:fs')).writeFileSync(`shots/hero/${w}-before.png`, a); (await import('node:fs')).writeFileSync(`shots/hero/${w}-after.png`, b);
  console.log(`히어로 ${w}px: 다른 픽셀 ${diff.n} / ${diff.px}`); total += diff.n;
}
console.log('합계 다른 픽셀', total);
await browser.close(); A.close(); B.close();
