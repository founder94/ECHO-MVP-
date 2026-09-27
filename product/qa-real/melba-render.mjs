// QA 사이트 실측(읽기 전용): Chrome·WebKit 에서 / 를 열어 최종 경로·히어로 여부·움직임 줄이기·페이지 오류를 기록한다. 로그인·쓰기 0.
import { chromium, webkit } from 'playwright';
const base = process.argv[2];
const out = {};
for (const [name, type] of [['chrome', chromium], ['webkit', webkit]]) {
  const b = await type.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: name === 'chrome', hasTouch: true });
  const p = await ctx.newPage(); const pageErrors = []; const failed = [];
  p.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));
  p.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  let status = null;
  try { const r = await p.goto(`${base}/`, { waitUntil: 'load', timeout: 30000 }); status = r?.status() ?? null; } catch (e) { pageErrors.push(`goto: ${String(e).slice(0, 120)}`); }
  await p.waitForTimeout(10000);
  const txt = await p.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  out[name] = { status, final: new URL(p.url()).pathname, mounted: await p.evaluate(() => (document.getElementById('root')?.children.length ?? 0) > 0).catch(() => false),
    hero: /좋아하는 사람보다|JUST TRY|ECHO 시작하기/.test(txt), motionBtn: txt.includes('움직임 줄이기'), productEntry: txt.includes('내 계정으로'), pageErrors, failed: failed.slice(0, 10), text: txt.replace(/\s+/g, ' ').slice(0, 100) };
  await p.screenshot({ path: `melba-${name}.png` });
  await b.close();
}
console.log(JSON.stringify(out, null, 1));
