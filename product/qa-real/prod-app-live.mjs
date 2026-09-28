// 운영 APP 실사이트 확인(2026-09-28 대표 GO 「운영 APP QA Supabase 혼입 수정」) — 로그인 없음 · 읽기 전용(입력·저장·가입 0).
// app.do-it.company 를 Galaxy·iPhone 크기 Chrome·WebKit 로 열어 (1) 화면이 실제로 뜨는지 (2) 브라우저가 부르는 Supabase 가 운영 하나뿐인지 본다.
import { chromium, webkit, devices } from 'playwright';
const APP = 'https://app.do-it.company';
const BRAND = 'https://do-it.company';
const PROD_SB = 'zyyhhxyupizcqhxqnxuu.supabase.co';
const MIXED = /thriving-melba|netlify\.app|mutniujeiyujhkobadkd|echo-(app|brand|admin)-qa/;
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };

const DEVICES = [
  ['galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
];
const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');

for (const [bname, type] of [['chrome', chromium], ['webkit', webkit]]) {
  for (const [dname, opts] of DEVICES) {
    const b = await type.launch();
    const ctx = await b.newContext({ ...opts, ...(bname === 'webkit' ? { isMobile: undefined } : {}) });
    const p = await ctx.newPage();
    const tag = `${bname} ${dname}`;
    const sbHosts = new Set(); const mixed = new Set(); const errs = []; const purposes = [];
    p.on('request', (r) => { const u = r.url(); if (/\.supabase\.co\//.test(u)) sbHosts.add(new URL(u).host); if (MIXED.test(u)) mixed.add(u.slice(0, 90)); });
    p.on('response', (r) => { if (r.url().includes('/rest/v1/purposes')) purposes.push(`${new URL(r.url()).host} ${r.status()}`); });
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));

    // 1) 브랜드 → 「ECHO 시작하기」 → 앱 (실제 사람 경로)
    await p.goto(`${BRAND}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const cta = p.locator('a:has-text("ECHO 시작하기")').first();
    await cta.waitFor({ state: 'visible', timeout: 30000 }).catch(async () => { await p.goto(`${BRAND}/do-it/landing`, { waitUntil: 'domcontentloaded' }); await cta.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {}); });
    await Promise.all([p.waitForURL((u) => u.href.startsWith(APP), { timeout: 30000 }).catch(() => {}), cta.click({ timeout: 10000 }).catch(() => {})]);
    await p.waitForLoadState('domcontentloaded').catch(() => {}); await p.waitForTimeout(7000);
    const t1 = await text(p);
    check(`${tag}: 브랜드 「ECHO 시작하기」 → ${APP} 도착 · 화면 글자 있음 · Site not found 아님`, p.url().startsWith(APP) && t1.length > 20 && !/Site not found/i.test(t1), `landed=${p.url()} text=${t1.slice(0, 40)}`);

    // 2) 앱 첫 화면 · 로그인 화면 직접 열기
    const r2 = await p.goto(`${APP}/`, { waitUntil: 'domcontentloaded', timeout: 45000 }); await p.waitForTimeout(5000);
    const t2 = await text(p);
    check(`${tag}: ${APP}/ 200 · 화면 글자 있음`, r2?.status() === 200 && t2.length > 20 && !/Site not found/i.test(t2), `status=${r2?.status()} path=${new URL(p.url()).pathname} text=${t2.slice(0, 40)}`);
    const r3 = await p.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 }); await p.waitForTimeout(5000);
    const inputs = await p.locator('input[type="email"], input[type="password"], button').count();
    check(`${tag}: ${APP}/login 200 · 로그인 화면(입력칸·버튼) 보임`, r3?.status() === 200 && inputs > 0, `status=${r3?.status()} controls=${inputs} path=${new URL(p.url()).pathname}`);

    // 3) 연결 대상: 브라우저가 실제로 부른 Supabase
    check(`${tag}: 브라우저가 부른 Supabase = 운영(${PROD_SB}) 하나뿐`, sbHosts.size > 0 && [...sbHosts].every((h) => h === PROD_SB), JSON.stringify([...sbHosts]));
    check(`${tag}: 운영 목적 목록(purposes) 운영 Supabase 에서 200`, purposes.length > 0 && purposes.every((x) => x === `${PROD_SB} 200`), JSON.stringify(purposes.slice(0, 3)));
    check(`${tag}: QA Supabase · thriving-melba · echo-*-qa · netlify.app 요청 0 · 페이지 오류 0`, mixed.size === 0 && errs.length === 0, JSON.stringify({ mixed: [...mixed], errs: errs.slice(0, 2) }));
    await b.close();
  }
}

// 4) 운영 APP 파일 전수(첫 화면 + 거기서 이어지는 모든 js 조각)
const seen = new Set(); const queue = ['/']; let all = '';
while (queue.length) {
  const path = queue.shift(); if (seen.has(path)) continue; seen.add(path);
  const body = await (await fetch(`${APP}${path}`)).text(); all += body + '\n';
  for (const m of body.matchAll(/(?:\/assets\/|\.\/)([A-Za-z0-9_.-]+\.js)/g)) { const next = `/assets/${m[1]}`; if (!seen.has(next)) queue.push(next); }
}
const count = (re) => (all.match(re) ?? []).length;
check(`운영 APP 파일(${seen.size}개) 운영 Supabase 포함`, count(/zyyhhxyupizcqhxqnxuu/g) > 0, `prodSupabase=${count(/zyyhhxyupizcqhxqnxuu/g)}`);
check(`운영 APP 파일(${seen.size}개) QA Supabase 0 · thriving-melba 0 · echo-*-qa 0 · netlify.app 0`, count(/mutniujeiyujhkobadkd/g) === 0 && count(/thriving-melba/g) === 0 && count(/echo-(app|brand|admin)-qa/g) === 0 && count(/netlify\.app/g) === 0, `qa=${count(/mutniujeiyujhkobadkd/g)} thriving=${count(/thriving-melba/g)} echoQA=${count(/echo-(app|brand|admin)-qa/g)} netlify=${count(/netlify\.app/g)} index=${[...all.matchAll(/\/assets\/index-[^"]+\.js/g)].map((m) => m[0])[0]}`);
const fail = results.filter((x) => !x).length;
console.log(`PROD APP LIVE CHECK: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
