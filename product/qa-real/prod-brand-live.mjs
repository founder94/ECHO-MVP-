import { safeDetail } from './safe-detail.mjs'; // 실패 출력에도 비밀값 0
// 운영 BRAND 실사이트 확인(2026-09-28 대표 「BRAND → APP P0」) — 로그인 없음 · 읽기 전용(입력·저장 0).
// 실제 사람처럼 https://do-it.company 첫 화면 → (온보딩) → 「ECHO 시작하기」 → 앱 도착까지 Galaxy·iPhone 크기 Chrome·WebKit 로 따라간다.
import { chromium, webkit, devices } from 'playwright';
const BRAND = 'https://do-it.company';
const APP = 'https://app.do-it.company';
const results = []; const appFindings = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${safeDetail(detail)}` : ''}`); };
const MIXED = /thriving-melba|netlify\.app|mutniujeiyujhkobadkd/; // 옛 QA 주소 · QA 사이트 주소 · QA Supabase

const DEVICES = [
  ['galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
];
for (const [bname, type] of [['chrome', chromium], ['webkit', webkit]]) {
  for (const [dname, opts] of DEVICES) {
    const b = await type.launch();
    const ctx = await b.newContext({ ...opts, ...(bname === 'webkit' ? { isMobile: undefined } : {}) });
    const p = await ctx.newPage();
    const tag = `${bname} ${dname}`;
    const mixed = new Set(); const appMixed = new Set(); const errs = [];
    // 브랜드 화면에서 나간 요청과 앱 화면(app.do-it.company)에 도착한 뒤의 요청을 나눠 센다.
    p.on('request', (r) => { if (!MIXED.test(r.url())) return; (p.url().startsWith(APP) ? appMixed : mixed).add(r.url().slice(0, 80)); });
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
    const res = await p.goto(`${BRAND}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // 온보딩(심볼)이 끝나고 랜딩의 「ECHO 시작하기」가 보일 때까지 기다린다(없으면 랜딩으로 바로).
    const cta = p.locator('a:has-text("ECHO 시작하기")').first();
    await cta.waitFor({ state: 'visible', timeout: 30000 }).catch(async () => { await p.goto(`${BRAND}/do-it/landing`, { waitUntil: 'domcontentloaded' }); await cta.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {}); });
    const links = await p.evaluate(() => [...document.querySelectorAll('a[href^="http"]')].map((a) => a.href));
    const appLinks = links.filter((h) => /do-it\.company|netlify\.app/.test(h) && !h.startsWith('https://do-it.company'));
    check(`${tag}: do-it.company 접속 200 · 첫 화면 → 랜딩`, res?.status() === 200 && (await cta.count()) > 0, `status=${res?.status()} path=${new URL(p.url()).pathname}`);
    check(`${tag}: 랜딩의 앱 이동 링크 전부 ${APP}`, appLinks.length > 0 && appLinks.every((h) => h.startsWith(APP)), JSON.stringify([...new Set(appLinks)]));
    const href = await cta.getAttribute('href').catch(() => null);
    await Promise.all([p.waitForURL((u) => !u.href.startsWith(BRAND), { timeout: 30000 }).catch(() => {}), cta.click({ timeout: 10000 }).catch(() => {})]);
    await p.waitForLoadState('domcontentloaded').catch(() => {}); await p.waitForTimeout(6000);
    const landed = p.url();
    const body = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 60)).catch(() => '');
    check(`${tag}: 「ECHO 시작하기」 → 앱 도착(${APP}) · Site not found 아님`, landed.startsWith(APP) && body.length > 0 && !/Site not found/i.test(body), `href=${href} landed=${landed} text=${body.slice(0, 40)}`);
    check(`${tag}: [BRAND] 옛 QA·QA 주소 요청 0 · 페이지 오류 0`, mixed.size === 0 && errs.length === 0, JSON.stringify({ mixed: [...mixed], errs: errs.slice(0, 2) }));
    appFindings.push({ tag, appMixed: [...appMixed] });
    await b.close();
  }
}
// 서버 이동(_redirects): 제품 경로는 화면 전에 앱 주소로
for (const path of ['/doit/start-journey', '/login', '/signup', '/doit/connections', '/auth/callback']) {
  const r = await fetch(`${BRAND}${path}`, { redirect: 'manual' });
  check(`서버 이동 ${path}`, [301, 302].includes(r.status) && (r.headers.get('location') ?? '').startsWith(APP), `${r.status} → ${r.headers.get('location')}`);
}
const html = await (await fetch(`${BRAND}/`)).text();
const js = await Promise.all([...html.matchAll(/\/assets\/[^"]+\.js/g)].map(async (m) => (await fetch(`${BRAND}${m[0]}`)).text()));
const all = html + js.join('\n');
check('운영 BRAND 파일 안 thriving-melba 0 · netlify.app 0 · QA Supabase 0', !/thriving-melba/.test(all) && !/netlify\.app/.test(all) && !/mutniujeiyujhkobadkd/.test(all), `thriving=${(all.match(/thriving-melba/g) ?? []).length} netlify=${(all.match(/netlify\.app/g) ?? []).length} qaSupabase=${(all.match(/mutniujeiyujhkobadkd/g) ?? []).length}`);
// 참고(판정 밖 · 운영 APP 은 이번 수정 범위 아님): 도착한 운영 APP 이 어느 Supabase 를 부르는지 파일에서 직접 센다.
const appHtml = await (await fetch(`${APP}/`)).text();
const appJs = (await Promise.all([...appHtml.matchAll(/\/assets\/[^"]+\.js/g)].map(async (m) => (await fetch(`${APP}${m[0]}`)).text()))).join('\n');
console.log(`INFO 운영 APP(app.do-it.company) 파일: QA Supabase=${(appJs.match(/mutniujeiyujhkobadkd/g) ?? []).length} 운영 Supabase=${(appJs.match(/zyyhhxyupizcqhxqnxuu/g) ?? []).length} thriving-melba=${(appJs.match(/thriving-melba/g) ?? []).length} echo-*-qa=${(appJs.match(/echo-(app|brand|admin)-qa\.netlify\.app/g) ?? []).length} index=${[...appHtml.matchAll(/\/assets\/index-[^"]+\.js/g)].map((m) => m[0]).join(',')}`);
console.log(`INFO 앱 도착 뒤 QA 주소 요청: ${JSON.stringify(appFindings)}`);
const fail = results.filter((x) => !x).length;
console.log(`PROD BRAND LIVE CHECK: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
