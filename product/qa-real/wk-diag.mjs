// WebKit 진단(읽기 전용): 두 빌드(기준 3f5f0d4 · 후보 4ba37ce)를 같은 방식으로 열어 언제·어디서 페이지가 닫히는지 1초 간격으로 기록한다.
import { webkit } from 'playwright';
const targets = process.argv.slice(2);
const out = {};
for (const base of targets) {
  for (const path of ['/', '/doit/start-journey', '/login']) {
    const b = await webkit.launch(); const key = `${base} ${path}`; const log = [];
    try {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const p = await ctx.newPage();
      p.on('crash', () => log.push('CRASH')); p.on('pageerror', (e) => log.push('pageerror ' + String(e).slice(0, 160)));
      p.on('console', (m) => { if (m.type() === 'error') log.push('console ' + m.text().slice(0, 160)); });
      p.on('framenavigated', (f) => { if (f === p.mainFrame()) log.push('nav ' + new URL(f.url()).pathname); });
      await p.goto(base + path, { timeout: 20000 });
      for (let i = 1; i <= 12; i++) { await p.waitForTimeout(1000); const s = await p.evaluate(() => `${location.pathname} root=${document.getElementById('root')?.children.length ?? 0} corner=${document.querySelectorAll('.echo-corner-button').length}`); if (i % 3 === 0) log.push(`t${i} ${s}`); }
      const step = async (name, fn) => { try { log.push(`${name}: ${JSON.stringify(await fn())}`); } catch (e) { log.push(`${name}: FAIL ${String(e).split('\n')[0].slice(0, 120)}`); } };
      await step('rect', () => p.evaluate(() => { const r = document.querySelector('.echo-corner-button')?.getBoundingClientRect(); return r ? [Math.round(r.top), Math.round(innerWidth - r.right), Math.round(r.width)] : null; }));
      await step('onTop', () => p.evaluate(() => { const b = document.querySelector('.echo-corner-button'); if (!b) return null; const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(h && b.contains(h)); }));
      await step('overlap', () => p.evaluate(() => { const b = document.querySelector('.echo-corner-button'); if (!b) return null; const r = b.getBoundingClientRect(); return [...document.querySelectorAll('a,button,input,textarea,h1,h2')].filter((el) => el !== b && !b.contains(el)).filter((el) => { const q = el.getBoundingClientRect(); return q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top; }).length; }));
      await step('press', async () => { const el = p.locator('button, a[href]').filter({ hasText: /계속하기|로그인|이메일/ }).first(); const box = await el.boundingBox(); if (!box) return 'no target'; await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(260); const v = await el.evaluate((e) => getComputedStyle(e).scale + ' ' + getComputedStyle(e).filter); await p.mouse.move(1, 1); await p.mouse.up(); return v; });
      await step('menu', async () => { const btn = p.locator('.echo-corner-button'); if (!(await btn.count())) return null; await btn.click(); await p.waitForTimeout(400); return p.$$eval('.echo-corner-label, .echo-corner-session', (a) => a.map((e) => e.innerText.trim())); });
      await step('alive', () => p.evaluate(() => location.pathname));
      out[key] = { ok: true, log };
    } catch (e) { out[key] = { ok: false, error: String(e).split('\n')[0].slice(0, 160), log }; }
    await b.close().catch(() => {});
  }
}
console.log(JSON.stringify(out, null, 1));
