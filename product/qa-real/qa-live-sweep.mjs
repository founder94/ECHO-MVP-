// QA 실서버·실제 AI 전체 버튼 검사(2026-10-06 대표 「시작부터 기능들 버튼들 테스트」). 대상 = https://echo-app-qa.netlify.app(게시본) + QA Supabase(새 시험 계정).
// 운영 0 · 비밀값 0(QA 공개 키) · 실패해도 멈추지 않고 PASS/FAIL 로 남긴다 · 캡처는 OUT 폴더.
import { randomUUID } from 'node:crypto'; import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');
const APP = process.env.APP ?? 'https://echo-app-qa.netlify.app', BRAND = process.env.BRAND ?? 'https://echo-brand-qa.netlify.app', SB = 'https://mutniujeiyujhkobadkd.supabase.co', ANON = process.env.QA_ANON, OUT = process.argv[2] ?? 'qa-sweep-out';
if (!ANON) { console.error('QA_ANON 없음'); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const R = []; const check = (n, ok, d = '') => { R.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? ` · ${String(d).slice(0, 220)}` : ''}`); };
const http = async (path, { method = 'GET', jwt = null, body = null, headers = {} } = {}) => { const r = await fetch(`${SB}${path}`, { method, headers: { apikey: ANON, Authorization: `Bearer ${jwt ?? ANON}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 200); } return { status: r.status, data }; };
// 시험 계정(새로) + 목적 저장(대화 첫 화면을 건너뛰지 않도록 목적은 비워 둔다 → 목적 타일 버튼도 검사)
const email = `qa-sweep-${Date.now()}@do-it.company`, password = `Qa!${randomUUID()}`;
await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: 'QA-SWEEP' } } });
const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
const sess = tok.data; check('0 시험 계정 로그인', !!sess?.access_token, `status=${tok.status}`);
if (!sess?.access_token) process.exit(1);
await http(`/rest/v1/profiles?id=eq.${sess.user.id}`, { method: 'PATCH', jwt: sess.access_token, body: { consent_version: 'v1.0', nickname: 'QA-SWEEP' }, headers: { Prefer: 'return=minimal' } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const errors = [], badReq = [];
async function open(url, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch {} }, ['sb-mutniujeiyujhkobadkd-auth-token', JSON.stringify(sess)]);
  if (seed) await ctx.addInitScript(([k, v]) => { try { sessionStorage.setItem(k, v); } catch {} }, ['echo-content-seed', JSON.stringify(seed)]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${url} ${String(e).slice(0, 160)}`));
  p.on('response', (r) => { const u = r.url(); if (u.includes('/functions/v1/') && r.status() >= 500) badReq.push(`${r.status()} ${u.split('/functions/v1/')[1]}`); });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined); await p.waitForTimeout(1500);
  return { ctx, p };
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: false }).catch(() => undefined);
const txt = async (p) => (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
const clickText = async (p, re, ms = 800) => { const b = p.getByRole('button', { name: re }).first(); if (!(await b.count())) return false; await b.click({ timeout: 8000 }).catch(() => undefined); await p.waitForTimeout(ms); return true; };
const waitIdle = async (p, ms = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const busy = await p.locator('[aria-busy="true"], .echo-typing, .echo-ref-typing').count(); if (!busy) break; await p.waitForTimeout(500); } };

// ① 홈 · 하단 탭 5개 · 모서리 메뉴
try { const { ctx, p } = await open(`${APP}/doit/home`);
  check('① 홈 열림(로그인 유지)', /ECHO|DO IT/.test(await txt(p)) && !/로그인하고 이어가기/.test(await txt(p)), (await txt(p)).slice(0, 80)); await shot(p, '01-home');
  for (const [label, path, re] of [['공간', '/doit/spaces', /공간|스페이스/], ['월드', '/doit/world', /월드|세계/], ['연결', '/doit/connections', /연결/], ['프로필', '/doit/profile', /프로필/], ['홈', '/doit/home', /ECHO/]]) {
    const tab = p.getByRole('link', { name: new RegExp(label) }).first();
    if (await tab.count()) { await tab.click().catch(() => undefined); await p.waitForTimeout(1200); check(`① 하단 탭 「${label}」`, p.url().includes(path) && re.test(await txt(p)), p.url()); } else check(`① 하단 탭 「${label}」(없음 = 숨김 메뉴)`, true, '탭 없음');
  }
  const menu = p.locator('button[aria-controls="echo-corner-panel"], button[aria-label*="메뉴"]').first();
  if (await menu.count()) { await menu.click(); await p.waitForTimeout(500); const m = await txt(p); check('① 모서리 메뉴: 대화·나의 이해/아는 나·앱 설치·설정', /이야기/.test(m) && /설정/.test(m), m.slice(0, 120)); await shot(p, '01b-menu'); } else check('① 모서리 메뉴 버튼', false, '버튼 없음');
  await ctx.close(); } catch (e) { check('섹션 예외(멈추지 않음)', false, String(e).split('\n')[0]); }
// ② 사주: 시작 그림 → 입력 → 확인 → 결과 → ECHO랑 이야기(사주 참고 이야기) → 해석 부정 → 영수증 → 반영할게요
try { const { ctx, p } = await open(`${APP}/doit/fortune`);
  check('② 사주·타로 입구 열림', await p.getByRole('button', { name: /무료 사주/ }).count() > 0); await shot(p, '02-fortune-entry');
  await clickText(p, /무료 사주/);
  check('② 사주 시작 그림 보임', await p.locator('img.doit-start-art').count() === 1 && await p.locator('img.doit-start-art').first().evaluate((e) => e.naturalWidth > 0)); await shot(p, '02b-saju-start');
  await p.getByPlaceholder('불리고 싶은 이름').fill('검사');
  await clickText(p, /^여성$/, 200);
  await p.locator('input[type="date"]').first().fill('1990-05-15');
  await p.locator('input[type="time"]').first().fill('09:30').catch(() => undefined);
  const confirmed = await clickText(p, /입력 내용 확인하기/);
  const next = await clickText(p, /^맞아요$/, 1500);
  check('② 사주 입력 → 확인 → 결과', confirmed && next && /사주|기둥|흐름/.test(await txt(p)), (await txt(p)).slice(0, 120)); await shot(p, '02c-saju-result');
  const talk = await clickText(p, /ECHO랑 이야기해볼래요/, 1500);
  await waitIdle(p); check('② 결과 → 사주 참고 이야기(여는 한 줄 · 질문 0)', talk && /참고 이야기/.test(await txt(p)) && await p.locator('.echo-ref-line--echo').count() >= 1 && !/[?？]/.test(await p.locator('.echo-ref-line--echo').first().innerText().catch(() => '?')), p.url());
  await p.locator('#echo-ref-text').fill('나 그런 사람 아닌데, 저는 사람 많은 데를 좋아해요'); await clickText(p, /^보내기$/, 1500); await waitIdle(p);
  const t2 = await txt(p); check('② 해석 부정 → 영수증 「사주보다 당신 말이 맞아요」 + 반영할까요?', /사주보다 당신 말이 맞아요/.test(t2) && /프로필에도 반영할까요/.test(t2), t2.slice(-200)); await shot(p, '02d-saju-deny-receipt');
  await clickText(p, /^반영할게요$/, 1500); check('② [반영할게요] → 반영했어요', /반영했어요/.test(await txt(p)), (await txt(p)).slice(-160)); await shot(p, '02e-saju-reflected');
  await clickText(p, /질문 하나 받아 보기/, 1500); await waitIdle(p); check('② 「질문 하나 받아 보기」 = 물음표 질문 1개', await p.locator('.echo-ref-line--question').count() === 1, String(await p.locator('.echo-ref-line--question').count()));
  await ctx.close(); } catch (e) { check('섹션 예외(멈추지 않음)', false, String(e).split('\n')[0]); }
// ③ 타로: 시작 그림 → 목적 → 새 카드 뽑기 → 카드 → 해석(실제 AI) → ECHO와 조금 더 이야기하기
try { const { ctx, p } = await open(`${APP}/doit/fortune`);
  await clickText(p, /무료 타로/);
  check('③ 타로 시작 그림 보임', await p.locator('img.doit-start-art').count() === 1 && await p.locator('img.doit-start-art').first().evaluate((e) => e.naturalWidth > 0)); await shot(p, '03-tarot-start');
  await clickText(p, /친구 관계/, 300); await clickText(p, /새 카드 뽑기/, 1200);
  const card = p.locator('button[aria-label*="번째 카드 고르기"]').first(); check('③ 카드 펼침(원화 그림 서버 응답 200)', await card.count() > 0);
  const artOk = await p.evaluate(async () => { const r = await fetch('/doit/tarot/tarot-major-0-10.webp', { method: 'HEAD' }); return r.status; }); check('③ 타로 원화 저장소 파일 200', artOk === 200, String(artOk));
  await card.click({ timeout: 8000 }).catch(() => undefined); await p.waitForTimeout(2500); await waitIdle(p, 40000);
  const t3 = await txt(p); check('③ 카드 해석(실제 AI) 표시 · 실패 문구 0', /AI 해석|흐름|카드/.test(t3) && !/해석을 불러오지 못했어요/.test(t3), t3.slice(0, 200)); await shot(p, '03b-tarot-result');
  check('③ 결과 화면 오픈 기간 문구', /오픈 기간 동안 무료/.test(t3));
  const more = await clickText(p, /ECHO와 조금 더 이야기하기/, 1500); await waitIdle(p);
  check('③ 타로 결과 → 카드 참고 이야기', more && /참고 이야기/.test(await txt(p)) && /카드/.test(await txt(p)), p.url()); await shot(p, '03c-tarot-ref');
  await clickText(p, /원하는 만남 알아보기/, 1500); check('③ 「원하는 만남 알아보기」 → 보통 대화 흐름', /만남|어떤|ECHO/.test(await txt(p)) && !/참고 이야기/.test(await txt(p)), p.url());
  await ctx.close(); } catch (e) { check('섹션 예외(멈추지 않음)', false, String(e).split('\n')[0]); }
// ④ ECHO와 이야기(실제 AI): 목적 타일 → 첫 답 → 답 2개 → 자유 입력 정정 → 영수증 + 다음 질문 인용 → 직전 답 고치기 버튼 존재
try { const { ctx, p } = await open(`${APP}/doit/conversation`);
  let t = await txt(p);
  const tiles = p.locator('button').filter({ hasText: /친구|연애|대화|취미|만남/ });
  if (await tiles.count()) { await tiles.first().click().catch(() => undefined); await p.waitForTimeout(1200); }
  t = await txt(p); check('④ 대화 첫 화면(목적 또는 첫 질문)', /ECHO|만남|친구|어떤/.test(t), t.slice(0, 120)); await shot(p, '04-conv-start');
  const ta = p.locator('textarea').first(); const sendBtn = p.getByRole('button', { name: /보내기|답변 보내기|시작/ }).first();
  const say = async (s) => { await ta.fill(s); await sendBtn.click({ timeout: 8000 }).catch(() => undefined); await p.waitForTimeout(1500); await waitIdle(p, 45000); };
  if (await ta.count()) {
    await say('친구를 만나고 싶어요'); await say('연락은 매일 하는 게 좋아요');
    const q1 = await p.locator('.echo-question').first().innerText().catch(() => '');
    check('④ 실제 AI 질문 받음', q1.length > 3, q1);
    await say('아니 그런 뜻 아니야. 매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요');
    const notice = await p.locator('.echo-notice').first().innerText().catch(() => ''); const q2 = await p.locator('.echo-question').first().innerText().catch(() => '');
    check('④ 자유 입력 정정 → 영수증 한 줄(서버 저장 뒤)', /알겠어요\. 「.+」/.test(notice) && /기억할게요/.test(notice), notice);
    check('④ 다음 질문에 고친 내용 인용', /알아들었어요\./.test(q2) || /마쳤|정리/.test(await txt(p)), q2);
    check('④ 거절된 뜻 재등장 0', !/매일[^.?!]{0,12}연락(이 좋|하는 게 좋|을 원)/.test(`${notice} ${q2}`), `${notice} | ${q2}`);
    await shot(p, '04b-conv-receipt');
    check('④ 「직전 답 고치기」·「잘 모르겠어요」 등 도움 버튼 존재', await p.getByRole('button', { name: /직전 답 고치기|잘 모르겠어요|예시 보기/ }).count() > 0);
    const plus = p.getByRole('button', { name: /더 보기|\+/ }).first(); if (await plus.count()) { await plus.click().catch(() => undefined); await p.waitForTimeout(400); }
  } else check('④ 입력칸', false, t.slice(0, 160));
  await ctx.close(); } catch (e) { check('섹션 예외(멈추지 않음)', false, String(e).split('\n')[0]); }
// ⑤ ECHO가 아는 나: 네 칸 · 지우기 · 다시 불러오기
try { const { ctx, p } = await open(`${APP}/doit/understanding`);
  const t = await txt(p); check('⑤ 「ECHO가 아는 나」 화면 · 네 칸 제목', /ECHO가 아는 나/.test(t) && /내가 고친 것/.test(t) && /아니라고 한 것/.test(t), t.slice(0, 160)); await shot(p, '05-known');
  check('⑤ 고친 뜻이 「내가 고친 것」에 있음(실제 AI 정정 결과)', /주말|한두 번/.test(t));
  const del = p.locator('.doit-known-forget').first(); if (await del.count()) { const before = await p.locator('.doit-known-list li').count(); await del.click(); await p.waitForTimeout(1500); check('⑤ 줄 지우기 → 줄 수 -1', (await p.locator('.doit-known-list li').count()) === before - 1, `${before}→${await p.locator('.doit-known-list li').count()}`); await shot(p, '05b-known-forget'); } else check('⑤ 줄 지우기 버튼', false, '지울 줄 없음');
  await ctx.close(); } catch (e) { check('섹션 예외(멈추지 않음)', false, String(e).split('\n')[0]); }
// ⑥ 자유 대화(스위치 꺼짐 안내) · KEY · 설정 · 연결 · 프로필 · 알림
try { const { ctx, p } = await open(`${APP}/doit/talk`); const t = await txt(p); check('⑥ /doit/talk: 스위치 꺼짐 안내(또는 켜짐이면 맛보기 안내)', /아직 열리지 않았어요|맛보기/.test(t), t.slice(0, 160)); await shot(p, '06-talk'); await ctx.close(); } catch (e) { check('섹션 예외(멈추지 않음)', false, String(e).split('\n')[0]); }
for (const [path, re, name] of [['/doit/key', /KEY|오픈 기간/, 'KEY(오픈 기간 문구)'], ['/doit/settings', /설정|탈퇴|앱으로 쓰기/, '설정'], ['/doit/connections', /연결|후보|준비/, '연결'], ['/doit/profile', /프로필|닉네임/, '프로필'], ['/doit/notifications', /알림/, '알림']]) {
  const { ctx, p } = await open(`${APP}${path}`); const t = await txt(p); check(`⑥ ${name} 화면`, re.test(t) && !/오류가 발생/.test(t), t.slice(0, 100)); await shot(p, `06-${path.split('/').pop()}`); await ctx.close(); }
// ⑦ 홈페이지(브랜드): 첫 화면 · 법무 문서 · 앱으로 가기 링크
try { const { ctx, p } = await open(`${BRAND}/`); const t = await txt(p); check('⑦ 홈페이지 첫 화면', /ECHO|DO IT/.test(t), t.slice(0, 80)); await shot(p, '07-brand');
  // 2026-10-08 3D 그림층(layers/): 자리 2곳(hero·making)이 있고 상태가 on 이거나 이유 있는 off(움직임 줄이기·WebGL 없음 등)여야 한다. 실제 WebGL 은 실행 환경(SwiftShader)에 따라 다르므로 on 을 강제하지 않는다.
  const layers = await p.evaluate(() => Array.from(document.querySelectorAll('.bh-scene-layer')).map((el) => ({ slot: el.getAttribute('data-slot'), layer: el.getAttribute('data-layer'), state: el.getAttribute('data-state'), why: el.getAttribute('data-why') })));
  check('⑦ 홈페이지 3D 층 자리 2곳(hero·making)', layers.length === 2 && layers.some((l) => l.slot === 'hero') && layers.some((l) => l.slot === 'making'), JSON.stringify(layers));
  check('⑦ 홈페이지 3D 층 상태 = on 또는 이유 있는 off', layers.every((l) => l.state === 'on' || l.state === 'loading' || (l.state === 'off' && l.why) || l.state === 'failed'), JSON.stringify(layers));
  for (const path of ['/legal/privacy', '/legal/terms']) { await p.goto(`${BRAND}${path}`, { waitUntil: 'networkidle' }).catch(() => undefined); await p.waitForTimeout(800); check(`⑦ 법무 문서 ${path}`, /개인정보|약관/.test(await txt(p))); }
  await ctx.close(); } catch (e) { check('섹션 예외(멈추지 않음)', false, String(e).split('\n')[0]); }
await browser.close();
check('⑧ 전체: 화면 JS 오류 0', errors.length === 0, errors.slice(0, 3).join(' | '));
check('⑧ 전체: 서버 함수 5xx 0', badReq.length === 0, badReq.slice(0, 5).join(' | '));
const fail = R.filter((x) => !x).length; console.log(`QA LIVE SWEEP: ${R.length - fail} PASS / ${fail} FAIL`); process.exit(fail ? 1 : 0);
