import { safeDetail } from './safe-detail.mjs'; // 실패 출력에도 비밀값 0
// 배포된 QA 사이트(앱·브랜드) 실사이트 확인 — 로그인 없음 · 읽기 전용(클릭·입력·저장 0) · Chrome·WebKit 390/1280.
// 역할 분리(대표 「BRAND / APP / ADMIN / SERVER 분리」): 브랜드 = 브랜드 화면만(제품 경로는 앱 주소로), 앱 = 제품(관리자 경로는 관리자 주소로).
import { chromium, webkit } from 'playwright';
const APP = 'https://echo-app-qa.netlify.app';
const BRAND = 'https://echo-brand-qa.netlify.app';
const ADMIN = 'https://echo-admin-qa.netlify.app';
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${safeDetail(detail)}` : ''}`); };
const PROD = /(^|\.)do-it\.company$/;

for (const [bname, type] of [['chrome', chromium], ['webkit', webkit]]) {
  for (const [w, h] of [[390, 844], [1280, 900]]) {
    const b = await type.launch();
    for (const [site, base] of [['app', APP], ['brand', BRAND]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      const errs = []; const prodCalls = []; const bad = [];
      p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
      p.on('request', (r) => { try { const host = new URL(r.url()).host; if (PROD.test(host) || host.includes('zyyhhxyupizcqhxqnxuu')) prodCalls.push(host); } catch { /* 무시 */ } });
      p.on('response', (r) => { if (r.status() >= 500) bad.push(`${r.status()} ${r.url().slice(0, 80)}`); });
      const tag = `${bname} ${w} ${site}`;
      await p.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await p.waitForTimeout(9000);
      const info = await p.evaluate(() => ({
        path: location.pathname, text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 80),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        manifest: !!document.querySelector('link[rel=manifest]'),
        appTitle: document.querySelector('meta[name=apple-mobile-web-app-title]')?.getAttribute('content') ?? null,
        qaLabel: /DO IT QA|ECHO QA|QA BUILD/.test(document.body.innerText),
      }));
      check(`${tag}: 첫 화면 표시(글자 있음) · 가로 넘침 0 · QA 표시 0`, info.text.length > 0 && !info.overflow && !info.qaLabel, JSON.stringify({ path: info.path, text: info.text.slice(0, 40) }));
      if (site === 'app') check(`${tag}: 앱 설치 정보(manifest · 이름 ECHO)`, info.manifest && info.appTitle === 'ECHO', JSON.stringify({ manifest: info.manifest, appTitle: info.appTitle }));
      if (site === 'brand') check(`${tag}: 브랜드에 앱 설치 정보 없음`, !info.manifest, `manifest=${info.manifest}`);
      if (site === 'brand') {
        await p.goto(`${BRAND}/doit/connections`, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(4000);
        check(`${tag}: 브랜드의 제품 경로 → 앱 QA 주소로 이동`, p.url().startsWith(APP), p.url());
      }
      if (site === 'app') {
        await p.goto(`${APP}/admin`, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(4000);
        check(`${tag}: 앱의 관리자 경로 → 관리자 QA 주소로 이동(앱에 관리자 화면 0)`, p.url().startsWith(ADMIN), p.url());
      }
      check(`${tag}: 페이지 오류 0 · 서버 5xx 0 · 운영 주소 호출 0`, errs.length === 0 && bad.length === 0 && prodCalls.length === 0, JSON.stringify({ errs: errs.slice(0, 2), bad: bad.slice(0, 2), prod: [...new Set(prodCalls)] }));
      await ctx.close();
    }
    await b.close();
  }
}
const fail = results.filter((x) => !x).length;
console.log(`LIVE SITES CHECK: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
