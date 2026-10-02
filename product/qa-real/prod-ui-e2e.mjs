import { safeDetail } from './safe-detail.mjs'; // 실패 출력에도 비밀값 0
// PROD UI E2E(2026-09-29 대표 GO · 7단계) — 게시본과 같은 파일(index 해시 577d3823732bd05e 로 확인한 3f0c591 PROD 빌드)을
// 실제 주소 app.do-it.company 로 브라우저에 넣고, 서버는 진짜 PROD(Supabase·doit-agent·실제 AI). 시험 계정 a 만 · 비밀값 출력 0.
import { chromium, webkit, devices } from 'playwright';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
const APP = 'https://app.do-it.company';
const DIST = resolve(process.env.LOCAL_DIST); const A = JSON.parse(readFileSync(process.env.ACCT_FILE, 'utf8')).a;
const PROXY = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const MIXED = /thriving-melba|netlify\.app|mutniujeiyujhkobadkd|echo-(app|brand|admin)-qa/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const results = []; const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${safeDetail(detail)}` : ''}`); };
const DEVICES = [
  ['chrome', chromium, 'galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['webkit', webkit, 'iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
  ['chrome', chromium, 'iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
  ['webkit', webkit, 'galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const [bname, type, dname, opts] of DEVICES) {
  const tag = `${bname} ${dname}`; if (ONLY && !ONLY.includes(tag.replace(' ', '-'))) continue;
  const b = await type.launch({ proxy: PROXY, ...(bname === 'chrome' && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const ctx = await b.newContext({ ...opts, ...(bname === 'webkit' ? { isMobile: undefined } : {}) });
  await ctx.route(`${APP}/**`, (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    let file = join(DIST, path); if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    return route.fulfill({ status: 200, body: readFileSync(file), headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' } });
  });
  // 시험 환경 한계(제품 아님): 이 샌드박스 프록시는 외부 글꼴·아이콘 CSS(Google Fonts·cdnjs·jsdelivr)를 못 받아 렌더가 멈춘다 → 그 세 곳만 빈 응답으로 둔다.
  await ctx.route(/https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//, (route) => route.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
  // 시험 환경 한계(제품 아님): 이 샌드박스의 Chromium 은 프록시 인증서를 믿지 않는다(ERR_CERT_AUTHORITY_INVALID). TLS 검사를 끄지 않고,
  // PROD Supabase 요청만 Node(프록시 CA 로 TLS 검사)로 대신 보내 응답을 그대로 돌려준다. 요청·응답 내용은 바꾸지 않는다.
  await ctx.route(/https:\/\/zyyhhxyupizcqhxqnxuu\.supabase\.co\//, async (route) => {
    const q = route.request(); const h = { ...q.headers() }; delete h['host'];
    try {
      const r = await fetch(q.url(), { method: q.method(), headers: h, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() ?? undefined });
      const buf = Buffer.from(await r.arrayBuffer()); const rh = {}; r.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) rh[k] = v; });
      await route.fulfill({ status: r.status, headers: rh, body: buf });
    } catch (e) { await route.abort('failed'); }
  });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('doit_intro_seen', '1'); } catch { /* 무시 */ } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  const sbHosts = new Set(); const mixed = new Set(); const agentNet = [];
  p.on('request', (r) => { const u = r.url(); if (/\.supabase\.co\//.test(u)) sbHosts.add(new URL(u).host); if (MIXED.test(u)) mixed.add(u.slice(0, 90)); });
  p.on('response', async (x) => { if (!x.url().includes('/functions/v1/doit-agent')) return; let t = ''; try { t = await x.text(); } catch { /* 무시 */ } let act = ''; try { act = JSON.parse(x.request().postData() || '{}').action ?? ''; } catch { /* 무시 */ } agentNet.push({ s: x.status(), act, kind: (t.match(/"turn"\s*:\s*\{"kind"\s*:\s*"(\w+)"/) || [])[1] ?? '', phase: (t.match(/"phase"\s*:\s*"(\w+)"/) || [])[1] ?? '' }); });
  const dump = async (label) => { const txt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300); const btns = await p.locator('button').allInnerTexts().catch(() => []); console.log(`  DIAG ${tag} ${label}: path=${new URL(p.url()).pathname} text="${txt}" buttons=${JSON.stringify(btns.map((x) => x.trim()).filter(Boolean).slice(0, 12))} agent=${JSON.stringify(agentNet.slice(-4))}`); };
  const waitAgent = async (n0, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (agentNet.length > n0) { await p.waitForTimeout(600); return agentNet.at(-1); } await p.waitForTimeout(200); } return null; };
  let consented = false;
  const passConsent = async () => {
    await p.waitForTimeout(1500);
    if (!new URL(p.url()).pathname.startsWith('/legal/consent')) return true;
    await p.getByText('모두 동의합니다').click();
    await p.getByRole('button', { name: '동의하고 계속하기' }).click();
    const ok = await p.waitForURL((u) => !u.pathname.startsWith('/legal/consent'), { timeout: 30000 }).then(() => true).catch(() => false);
    if (!consented) { check(`${tag}: 약관 동의 화면(v1.0) → 동의 저장 → 다음 화면`, ok, `path=${new URL(p.url()).pathname}`); consented = true; }
    return ok;
  };
  try {
    // 1) 로그인(이메일 화면 · 실제 PROD Auth)
    await p.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.locator('#email').fill(A.email); await p.locator('#password').fill(A.password);
    await p.locator('form button[type="submit"]').first().click();
    const logged = await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 }).then(() => true).catch(() => false);
    check(`${tag}: 로그인(PROD Auth · 이메일)`, logged, `path=${new URL(p.url()).pathname}`);
    if (!logged) { await dump('login'); continue; }
    // 2) 대화 화면 → 새 회차(처음부터 다시 시작하기) → 첫 질문(목적 타일)
    await passConsent();
    await p.goto(`${APP}/doit/conversation`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!(await passConsent())) { await dump('consent'); continue; }
    if (!new URL(p.url()).pathname.startsWith('/doit/conversation')) await p.goto(`${APP}/doit/conversation`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const opening = p.getByRole('heading', { name: /어떤 만남을\s*원하세요\?/ });
    const restart = p.getByRole('button', { name: /처음부터 다시 시작하기/ }).first();
    await Promise.race([opening.waitFor({ timeout: 30000 }), restart.waitFor({ timeout: 30000 })]).catch(() => {});
    if (!(await opening.isVisible().catch(() => false)) && await restart.isVisible().catch(() => false)) { await restart.scrollIntoViewIfNeeded().catch(() => {}); await restart.click(); }
    const startBtn = p.getByRole('button', { name: '대화 시작하기' });
    const atOpen = await Promise.race([opening.waitFor({ timeout: 30000 }).then(() => 'opening'), startBtn.waitFor({ timeout: 30000 }).then(() => 'start')]).catch(() => null);
    if (!atOpen) await dump('opening');
    check(`${tag}: 새 회차 첫 화면(목적 고르기 또는 대화 시작)`, !!atOpen, `screen=${atOpen}`);
    if (!atOpen) continue;
    // 3) 목적(친구) + 한 줄 → 대화 시작 화면 → 대화 시작(실제 AI)
    if (atOpen === 'opening') {
      await p.getByRole('radio', { name: /친구를 만나고 싶어요/ }).click();
      await p.locator('#echo-opening-line').fill('주말에 편하게 이야기 나눌 친구를 찾고 있어요');
      await p.locator('form.echo-opening-line button[type="submit"]').click();
      check(`${tag}: 목적 타일(친구) + 한 줄 저장`, await startBtn.waitFor({ timeout: 30000 }).then(() => true).catch(() => false) || await p.locator('#echo-message').isVisible().catch(() => false));
    }
    let n0 = agentNet.length; let r = null;
    if (await startBtn.isVisible().catch(() => false)) { await startBtn.click(); const t0 = Date.now(); while (Date.now() - t0 < 60000 && !agentNet.slice(n0).some((x) => x.act === 'agent_start')) await p.waitForTimeout(250); r = agentNet.slice(n0).find((x) => x.act === 'agent_start') ?? null; }
    await p.locator('#echo-message').waitFor({ timeout: 30000 }).catch(() => {});
    if (!(await p.locator('#echo-message').isVisible().catch(() => false))) await dump('start');
    check(`${tag}: 대화 시작(agent_start) · AI 질문과 입력칸 표시`, r?.s === 200 && await p.locator('#echo-message').isVisible().catch(() => false), JSON.stringify(r));
    const send = async (text) => { const k = agentNet.length; await p.locator('#echo-message').fill(text); await p.locator('form.echo-composer button[type="submit"]').first().click().catch(async () => p.locator('#echo-message').press('Enter')); return waitAgent(k); };
    r = await send('연락은 매일 하는 게 좋아요');
    check(`${tag}: 답 보내기`, r?.s === 200, JSON.stringify(r));
    r = await send('아니 그런 뜻 아니야. 매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요');
    check(`${tag}: 정정(서버가 정정으로 처리)`, r?.s === 200 && r?.kind === 'correction', JSON.stringify(r));
    r = await send('그런 뜻 아니야');
    check(`${tag}: 거절(저장 0 처리 · 200)`, r?.s === 200 && ['repair', 'correction'].includes(r?.kind), JSON.stringify(r));
    // 사용자 말은 접힌 「이번에 한 말 N개」 목록 안에 있다(화면 설계) — 목록 글자를 읽는다.
    const hist = await p.locator('details.echo-history').textContent().catch(() => '');
    check(`${tag}: 사용자 원문이 「이번에 한 말」에 그대로(답·정정·거절)`, hist.includes('연락은 매일 하는 게 좋아요') && hist.includes('매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요') && hist.includes('그런 뜻 아니야'), `history_len=${hist.length}`);
    // 4) 마치기 → 「ECHO가 이해한 나」
    for (const t of ['카페에서 오래 이야기하는 걸 좋아해요', '솔직하고 배려 있는 사람이 좋아요']) { if (!(await p.locator('#echo-message').isVisible().catch(() => false))) break; await send(t); }
    if (await p.locator('#echo-message').isVisible().catch(() => false)) { const k = agentNet.length; await p.getByRole('button', { name: '여기까지 할게요' }).click(); await waitAgent(k); }
    const card = await p.getByRole('button', { name: '맞아요' }).first().waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
    if (!card) await dump('profile-check');
    const doneText = await p.locator('body').innerText().catch(() => '');
    check(`${tag}: 대화 마침 → 「ECHO가 이해한 나」 확인(맞아요 버튼)`, card, `phase=${agentNet.at(-1)?.phase}`);
    check(`${tag}: 이해한 나·요약에 거절된 뜻(매일 연락을 원함) 0`, !/매일\s*연락(하는 게 좋|을 원|하고 싶)/.test(doneText));
    // 5) 프로필 · 연결 준비 화면
    await p.goto(`${APP}/doit/connections`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const conn = await p.getByText(/연결 준비|당신이 잠든 사이|ECHO가 먼저 살펴봤어요|연결까지/).first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    if (!conn) await dump('connections');
    check(`${tag}: 연결 준비 화면(당신이 잠든 사이) 표시`, conn);
    check(`${tag}: 브라우저 Supabase = PROD 하나 · QA/임시 주소 0`, [...sbHosts].every((h) => h === 'zyyhhxyupizcqhxqnxuu.supabase.co') && sbHosts.size >= 1 && mixed.size === 0, `${[...sbHosts].join(',')} mixed=${mixed.size}`);
    check(`${tag}: 페이지 오류 0`, errs.length === 0, errs.slice(0, 2).join(' | '));
  } catch (e) { check(`${tag}: 실행`, false, String(e).slice(0, 160)); await dump('exception'); }
  finally { await b.close(); }
}
const fail = results.filter((x) => !x).length;
console.log(`PROD UI E2E: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
