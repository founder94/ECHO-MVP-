// 대표 실기기 P0 세 건 — 「대표가 실제로 도달한 상태」 재현 검사(QA 사이트·QA DB 전용 · 새 시험 계정 · 운영 0).
//  ② 대화를 끝까지 마친 계정(phase=done)으로 start-journey 「오늘은 무엇부터 할까요?」(대표 화면: 사진과 소개 채우기 · 대화 다시 보기 · 홈으로)
//     → 「처음부터 다시 시작하기」가 화면에 실제로 보이고(뷰포트 안 · 다른 요소에 가리지 않음) 한 번 탭 → 확인 창 0 → 첫 질문 · 목적·지난 대화 유지
//  ③ 같은 계정으로 소개 쓰기 화면 → 「AI가 대신 작성하기」·「이 글로 바꾸기」·생활 리듬 칩의 실제 계산된 색(불투명 채움 0 · 흰 글자 · 고른 칩은 막이 더 진함)
//  ① 로그인 화면 「Google로 계속하기」 → 실제로 Google 로 나가는지 + 보낸 redirectTo(서버가 받은 값은 러너 밖에서 flow_state 로 대조)
import { chromium, webkit, devices } from 'playwright';
import { randomUUID } from 'node:crypto';
const QA_REF = 'mutniujeiyujhkobadkd';
const SB = `https://${QA_REF}.supabase.co`;
const APP = 'https://echo-app-qa.netlify.app';
const ANON = process.env.QA_ANON;
if (!ANON) { console.error('QA_ANON 없음'); process.exit(2); }
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };
const http = async (path, { method = 'GET', jwt = null, body = null, headers = {} } = {}) => {
  const r = await fetch(`${SB}${path}`, { method, headers: { apikey: ANON, Authorization: `Bearer ${jwt ?? ANON}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t.slice(0, 200); }
  return { status: r.status, data };
};
const agent = (jwt, body) => http('/functions/v1/doit-agent', { method: 'POST', jwt, body });
const ANSWERS = ['주말에 편하게 만나서 이야기 나눌 친구를 찾고 있어요', '카페에서 오래 이야기하는 걸 좋아해요', '연락은 이틀에 한 번 정도가 편해요', '솔직하고 배려 있는 사람이 좋아요', '처음엔 천천히 알아가고 싶어요', '산책이나 전시 보는 걸 좋아해요', '약속 시간을 잘 지키는 게 중요해요', '오늘은 여기까지 할게요'];
const alphaOf = (rgba) => { const m = String(rgba).match(/rgba?\(([^)]+)\)/); if (!m) return rgba === 'transparent' ? 0 : 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
const DEVICES = [
  ['webkit', webkit, 'iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
  ['chrome', chromium, 'galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
];

for (const [bname, type, dname, opts] of DEVICES) {
  const tag = `${bname} ${dname}`;
  // ── 대표와 같은 상태 만들기: 가입 · 약관 동의 · 목적 · 실제 대화를 끝까지(QA 서버 · 실제 AI) ──
  const email = `qa-realstate-${Date.now()}-${dname}@do-it.company`; const password = `Qa!${randomUUID()}`;
  await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-RS-${dname}` } } });
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  const session = tok.data; const jwt = session?.access_token; const uid = session?.user?.id;
  if (!jwt) { check(`${tag}: QA 시험 계정`, false, `login=${tok.status}`); continue; }
  await http(`/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', jwt, body: { purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', consent_version: 'v1.0' }, headers: { Prefer: 'return=minimal' } });
  const st = await agent(jwt, { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구를 만나고 싶어요' });
  let s = st.data?.session; let turns = 0;
  for (const a of ANSWERS) { if (!s || s.phase === 'done') break; const r = await agent(jwt, { action: 'agent_turn', requestId: randomUUID(), sessionId: s.id, text: a }); s = r.data?.session ?? s; turns++; }
  const oldSid = s?.id;
  check(`${tag}: 대표와 같은 상태 — 실제 대화를 끝까지 마침(phase=done)`, s?.phase === 'done', `turns=${turns} phase=${s?.phase} asked=${s?.progress?.asked}`);
  const recBefore = await http(`/rest/v1/doit_records?select=id&user_id=eq.${uid}`, { jwt });

  const b = await type.launch();
  const ctx = await b.newContext({ ...opts, ...(bname === 'webkit' ? { isMobile: undefined } : {}) });
  await ctx.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); sessionStorage.setItem('doit_intro_seen', '1'); } catch { /* 무시 */ } }, [`sb-${QA_REF}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
  const agentNet = []; p.on('response', async (x) => { if (!x.url().includes('/functions/v1/doit-agent')) return; let t = ''; try { t = await x.text(); } catch { /* 무시 */ } let act = ''; try { act = JSON.parse(x.request().postData() || '{}').action ?? ''; } catch { /* 무시 */ } const code = (t.match(/"(?:code|error)"\s*:\s*"([^"]{0,40})"/) || [])[1] ?? ''; agentNet.push(`${x.status()} ${act} ${code} phase=${(t.match(/"phase"\s*:\s*"(\w+)"/) || [])[1] ?? '-'} intro=${(t.match(/"intro"\s*:\s*\{"status"\s*:\s*"(\w+)"/) || [])[1] ?? '-'}`); });
  const dump = async (label) => { const txt = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400); const btns = await p.locator('button').allInnerTexts().catch(() => []); console.log(`  DIAG ${label}: url=${new URL(p.url()).pathname}${new URL(p.url()).search} text="${txt}" buttons=${JSON.stringify(btns.map((x) => x.trim()).filter(Boolean).slice(0, 12))} agent=${JSON.stringify(agentNet.slice(-6))}`); };

  // ── ③ 버튼 시스템: 대표가 본 소개 쓰기 화면의 실제 계산된 색 ──
  await p.goto(`${APP}/doit/start-journey?edit=profile`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const ai = p.getByRole('button', { name: /AI가 대신 작성하기|AI로 다시 쓰기/ });
  await ai.waitFor({ timeout: 30000 }).catch(() => {});
  const css = (loc) => loc.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, img: c.backgroundImage, color: c.color, border: c.borderTopColor }; }).catch(() => null);
  const aiStyle = await css(ai);
  check(`${tag}: 「AI가 대신 작성하기」 = 유리(불투명 흰 채움·그라데이션 0 · 흰 글자 · 흰 테두리)`, !!aiStyle && alphaOf(aiStyle.bg) <= 0.3 && aiStyle.img === 'none' && aiStyle.color === 'rgb(255, 255, 255)', JSON.stringify(aiStyle));
  if (aiStyle) {
    await ai.click().catch(() => {});
    // 소개 칸이 비어 있으면 첫 탭은 초안을 바로 채운다(「AI로 다시 쓰기」). 「이 글로 바꾸기」는 이미 글이 있을 때 나오는 비교 화면 → 한 번 더 누른다(대표 화면과 같은 상황).
    const again = p.getByRole('button', { name: 'AI로 다시 쓰기' });
    if (await again.waitFor({ timeout: 45000 }).then(() => true).catch(() => false)) await again.click().catch(() => {});
    const swap = p.getByRole('button', { name: '이 글로 바꾸기' });
    const shown = await swap.waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
    if (!shown) await dump(`${tag} AI 초안`);
    const swapStyle = shown ? await css(swap) : null;
    check(`${tag}: 「이 글로 바꾸기」 = 유리(불투명 금색 0 · 흰 글자)`, !!swapStyle && alphaOf(swapStyle.bg) <= 0.3 && swapStyle.color === 'rgb(255, 255, 255)', JSON.stringify(swapStyle ?? 'AI 초안 안 나옴'));
  }
  // 고른 상태가 눈에 보인다(막이 더 진함) — 생활 리듬 칩
  const chips = p.locator('button[aria-pressed]');
  if (await chips.count()) {
    const before = await css(chips.first());
    await chips.first().click().catch(() => {});
    await p.waitForTimeout(300);
    const after = await css(chips.first());
    check(`${tag}: 고른 상태 구분(유리 막이 진해짐 · 채움 아님)`, !!before && !!after && alphaOf(after.bg) > alphaOf(before.bg) && alphaOf(after.bg) <= 0.4, `${before?.bg} → ${after?.bg}`);
  }
  // 이 화면의 모든 보이는 버튼: 불투명 채움 0(글자 대비 유지 = 흰 글자)
  const opaque = await p.evaluate(() => [...document.querySelectorAll('button')].filter((el) => el.offsetParent && !el.closest('[data-visual="art"]')).map((el) => { const c = getComputedStyle(el); return { t: el.textContent.trim().slice(0, 20), bg: c.backgroundColor, img: c.backgroundImage }; }));
  const bad = opaque.filter((x) => { const m = x.bg.match(/rgba?\(([^)]+)\)/); const a = m ? (m[1].split(/[ ,/]+/).filter(Boolean)[3] ?? 1) : 0; return Number(a) > 0.6 || /gradient/.test(x.img); });
  check(`${tag}: 소개 쓰기 화면의 보이는 버튼 ${opaque.length}개 중 불투명 채움 0`, bad.length === 0, JSON.stringify(bad.slice(0, 3)));

  // 대표 상태 맞추기: 앱이 소개를 저장할 때 부르는 것과 같은 서버 호출(agent_intro_mark) — 대표 화면 = 소개 확인까지 끝난 상태
  const mk = await agent(jwt, { action: 'agent_intro_mark', requestId: randomUUID(), sessionId: oldSid, how: 'as_is' });
  check(`${tag}: 소개 확인 기록(앱 저장과 같은 서버 호출)`, mk.status === 200 && !!mk.data?.session?.intro?.used, `status=${mk.status} used=${mk.data?.session?.intro?.used}`);

  // ── ② 대표 화면 그대로: start-journey 선택 화면 ──
  await p.goto(`${APP}/doit/start-journey`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.getByRole('heading', { name: /무엇부터 할까요/ }).waitFor({ timeout: 30000 }).catch(() => {});
  // 서버에서 대화 상태를 읽는 동안(「지난 대화를 확인하고 있어요…」)은 판정하지 않는다 — 읽기 전 잘못된 버튼이 잠깐 보이던 문제는 앱에서 막았다.
  const flashed = await p.getByRole('button', { name: '대화 시작하기' }).isVisible().catch(() => false);
  const loading = p.getByText('지난 대화를 확인하고 있어요');
  await loading.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  check(`${tag}: 화면이 처음 뜰 때 틀린 버튼(대화 시작하기) 0 — 서버 상태를 읽은 뒤에만 버튼`, !flashed);
  const same = await p.getByRole('button', { name: '대화 다시 보기' }).isVisible().catch(() => false);
  if (!(same && await p.getByRole('button', { name: '사진과 소개 채우기' }).isVisible().catch(() => false))) await dump(`${tag} 대표 화면`);
  check(`${tag}: 대표가 본 화면과 같은 상태(사진과 소개 채우기 · 대화 다시 보기 · 홈으로)`, same && await p.getByRole('button', { name: '사진과 소개 채우기' }).isVisible().catch(() => false), `path=${new URL(p.url()).pathname}`);
  const restart = p.getByRole('button', { name: /처음부터 다시 시작하기/ });
  await restart.scrollIntoViewIfNeeded().catch(() => {});
  const box = await restart.boundingBox().catch(() => null);
  const onTop = box ? await p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el && !!el.closest('button') && /처음부터 다시 시작하기/.test(el.closest('button').textContent); }, [box.x + box.width / 2, box.y + box.height / 2]) : false;
  const vp = p.viewportSize();
  check(`${tag}: 실제 렌더 — 「처음부터 다시 시작하기」가 보이고 · 화면 안 · 가리는 것 0 · 누를 수 있는 크기`, !!box && onTop && box.y >= 0 && box.y + box.height <= vp.height && box.height >= 40, JSON.stringify(box && { y: Math.round(box.y), h: Math.round(box.height), w: Math.round(box.width) }));
  const style = await restart.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, color: c.color, border: c.borderTopColor }; }).catch(() => null);
  check(`${tag}: 다시 시작 버튼도 유리 버튼(채움 0 · 흰 글자)`, !!style && alphaOf(style.bg) <= 0.3 && style.color === 'rgb(255, 255, 255)', JSON.stringify(style));
  const t0 = Date.now();
  await restart.tap().catch(async () => restart.click());
  const arrived = await p.getByRole('heading', { name: /어떤 만남을\s*원하세요\?/ }).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
  check(`${tag}: 한 번 탭 → 확인 창 없이 첫 질문(어떤 만남을 원하세요?)`, arrived && !(await p.getByText('계속할게요').isVisible().catch(() => false)), `path=${new URL(p.url()).pathname} ms=${Date.now() - t0}`);
  const me = await http('/auth/v1/user', { jwt });
  const round = me.data?.user_metadata?.doit_round_started_at;
  const tok2 = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
  const jwt2 = tok2.data?.access_token ?? jwt;
  const get = await agent(jwt2, { action: 'agent_get' });
  const prof = await http(`/rest/v1/profiles?id=eq.${uid}&select=purpose_id`, { jwt: jwt2 });
  const recAfter = await http(`/rest/v1/doit_records?select=id&user_id=eq.${uid}`, { jwt: jwt2 });
  check(`${tag}: 진짜 새 회차(서버 시각 기록 · 옛 세션 안 돌아옴)`, !!round && Date.parse(round) >= t0 - 5000 && (get.data?.session === null || get.data?.session?.id !== oldSid), `round=${round} session=${get.data?.session?.id?.slice(0, 8) ?? null}`);
  check(`${tag}: 목적·Profile 유지 · 지난 대화 기록 유지(지운 것 0)`, prof.data?.[0]?.purpose_id === 'friend' && (recBefore.status !== 200 || (recAfter.data?.length ?? -1) === (recBefore.data?.length ?? -2)), `purpose=${prof.data?.[0]?.purpose_id} records ${recBefore.data?.length ?? recBefore.status}→${recAfter.data?.length ?? recAfter.status}`);

  // ── ① Google 로그인 시작: 앱이 보내는 redirectTo · 실제로 Google 로 나감 ──
  const ctx2 = await b.newContext({ ...opts, ...(bname === 'webkit' ? { isMobile: undefined } : {}) });
  const p2 = await ctx2.newPage();
  const authorize = []; p2.on('request', (r) => { if (r.url().includes('/auth/v1/authorize')) authorize.push(r.url()); });
  await p2.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const g = p2.getByRole('button', { name: /Google로 계속하기/ });
  await g.waitFor({ timeout: 20000 }).catch(() => {});
  const gStart = new Date().toISOString();
  await Promise.all([p2.waitForURL(/accounts\.google\.com/, { timeout: 30000 }).catch(() => {}), g.click().catch(() => {})]);
  const sent = authorize[0] ? new URL(authorize[0]).searchParams.get('redirect_to') : null;
  check(`${tag}: Google 로그인 시작 → Google 로 이동 · 앱이 보낸 redirectTo = ${APP}/auth/callback`, /accounts\.google\.com/.test(p2.url()) && sent === `${APP}/auth/callback`, `redirect_to=${sent} at=${gStart}`);
  console.log(`OAUTH_PROBE ${tag} started_at=${gStart}`);
  check(`${tag}: 페이지 오류 0`, errs.length === 0, JSON.stringify(errs.slice(0, 2)));
  await b.close();
}
const fail = results.filter((x) => !x).length;
console.log(`QA REAL-STATE P0 CHECK: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
