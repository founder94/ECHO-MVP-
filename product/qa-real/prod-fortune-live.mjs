// 운영 사주·타로 실제 동작 확인(2026-09-28 대표 「사주·타로 상태 확인 · 수정 금지」) — 로그인 없음 · 저장 0.
// app.do-it.company/doit/fortune 에서 사람처럼: 사주 = 생일 입력 → 계산 결과(명식) 표시 / 타로 = 목적 → 카드 뽑기 → 해석 표시.
// 타로는 운영 openai-chat 을 실제로 부른다(기기마다 1회). 입력한 생일·카드는 저장하지 않는다(화면 상태만).
import { chromium, webkit, devices } from 'playwright';
const APP = 'https://app.do-it.company';
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };
const DEVICES = [
  ['galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
];
const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');

for (const [bname, type] of [['chrome', chromium], ['webkit', webkit]]) {
  for (const [dname, opts] of DEVICES) {
    const tag = `${bname} ${dname}`;
    const b = await type.launch();
    const ctx = await b.newContext({ ...opts, ...(bname === 'webkit' ? { isMobile: undefined } : {}) });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('doit_intro_seen', '1'); } catch { /* 무시 */ } });
    const p = await ctx.newPage();
    const errs = []; const tarotCalls = [];
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
    p.on('response', async (r) => { if (r.url().includes('/functions/v1/openai-chat') && r.request().method() === 'POST') { let body = ''; try { body = (await r.text()).slice(0, 160); } catch { /* 무시 */ } tarotCalls.push({ status: r.status(), body }); } });

    // ── 사주: 입력 → 계산 → 표시
    await p.goto(`${APP}/doit/fortune`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(4000);
    const landed = new URL(p.url()).pathname;
    const sajuCard = p.getByText('무료 사주').first();
    const entryOk = await sajuCard.isVisible().catch(() => false);
    check(`${tag}: /doit/fortune 진입(로그인 없이) · 사주/타로 선택 보임`, entryOk, `path=${landed}`);
    if (entryOk) {
      await sajuCard.click();
      await p.waitForTimeout(1500);
      await p.locator('input[type="date"]').first().fill('1990-05-15').catch(() => {});
      await p.locator('input[type="time"]').first().fill('09:30').catch(() => {});
      await p.getByText('여성', { exact: true }).first().click().catch(() => {});
      await p.getByText('입력 내용 확인하기').first().click().catch(() => {});
      await p.waitForTimeout(800);
      await p.getByText('맞아요', { exact: true }).first().click().catch(() => {});
      await p.waitForTimeout(2500);
      const t = await text(p);
      const shown = /내 사주 명식/.test(t) && /일주/.test(t) && /년주/.test(t);
      check(`${tag}: 사주 양력 1990-05-15 09:30 → 계산 결과(명식·일주·년주) 표시`, shown && !/지금 계산하지 못했어요/.test(t), t.slice(0, 90));
    }

    // ── 타로: 목적 → 카드 → 해석
    await p.goto(`${APP}/doit/fortune`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(3000);
    const taroCard = p.getByText('무료 타로').first();
    if (await taroCard.isVisible().catch(() => false)) {
      await taroCard.click(); await p.waitForTimeout(1500);
      await p.locator('div.grid button').first().click().catch(() => {});     // 관계 목적 하나
      await p.getByText('새 카드 뽑기').first().click().catch(() => {});
      await p.waitForTimeout(2000);
      await p.locator('[aria-label*="번째 카드 고르기"]').first().click().catch(() => {});
      await p.waitForTimeout(2500);
      await p.getByText('카드 이야기 듣기').first().click().catch(() => {});
      await p.waitForTimeout(12000);
      const t = await text(p);
      const failMsg = /잠시 후 다시 시도해 주세요|해석을 불러오지 못했어요|카드 정보를 찾을 수 없어요/.test(t);
      const call = tarotCalls.at(-1);
      check(`${tag}: 타로 카드 선택 → 운영 openai-chat 호출 200`, call?.status === 200, JSON.stringify(call ?? 'no call'));
      check(`${tag}: 타로 해석(요약) 화면 표시 · 오류 문구 없음`, call?.status === 200 && !failMsg, t.slice(0, 120));
    } else check(`${tag}: 타로 선택 보임`, false, `path=${new URL(p.url()).pathname}`);
    check(`${tag}: 페이지 오류 0`, errs.length === 0, JSON.stringify(errs.slice(0, 2)));
    await b.close();
  }
}
const fail = results.filter((x) => !x).length;
console.log(`PROD FORTUNE LIVE CHECK: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
