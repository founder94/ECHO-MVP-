// BRAND QA 빌드 확인(읽기 전용): Chrome·WebKit 에서 히어로 · 「ECHO 시작하기」 대상 · 제품/관리자 경로의 QA 앱 이동 · 공통 메뉴 0 · manifest 링크 0.
import { chromium, webkit } from 'playwright';
const base = process.argv[2]; const out = {};
for (const [name, type] of [['chrome', chromium], ['webkit', webkit]]) {
  const b = await type.launch(); const log = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: name === 'chrome', hasTouch: true });
    await ctx.route(/thriving-melba/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>QA APP</p>' }));
    const p = await ctx.newPage(); p.on('pageerror', (e) => log.push('pageerror ' + String(e).slice(0, 140)));
    await p.goto(base + '/'); await p.waitForTimeout(10000);
    const info = await p.evaluate(() => ({ path: location.pathname, hero: document.body.innerText.includes('좋아하는 사람보다'), cta: [...new Set([...document.querySelectorAll('a')].filter((a) => /ECHO 시작하기/.test(a.innerText)).map((a) => a.getAttribute('href')))], corner: document.querySelectorAll('.echo-corner-button').length, manifest: !!document.querySelector('link[rel=manifest]'), motion: document.body.innerText.includes('움직임 줄이기') }));
    await p.goto(base + '/doit/start-journey'); await p.waitForTimeout(3000); info.productTo = p.url();
    await p.goto(base + '/admin/mobile'); await p.waitForTimeout(3000); info.adminTo = p.url();
    out[name] = { ...info, log };
  } catch (e) { out[name] = { error: String(e).split('\n')[0].slice(0, 160), log }; }
  await b.close().catch(() => {});
}
console.log(JSON.stringify(out, null, 1));
