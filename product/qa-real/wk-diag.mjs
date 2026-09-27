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
      out[key] = { ok: true, log };
    } catch (e) { out[key] = { ok: false, error: String(e).split('\n')[0].slice(0, 160), log }; }
    await b.close().catch(() => {});
  }
}
console.log(JSON.stringify(out, null, 1));
