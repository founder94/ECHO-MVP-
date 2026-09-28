// QA 「처음부터 다시 시작하기」 실제 동작(2026-09-28 대표 「처음부터 다시 시작하기 UX 수정」) — QA 사이트·QA DB 전용.
// 새 QA 시험 계정(가입) → 목적 저장 → 실제 대화 세션 1개 시작(QA doit-agent) → 로그인 상태로 「나의 이해」 → 「처음부터 다시 시작하기」 한 번 탭
// → ECHO 첫 대화 화면(어떤 만남을 원하세요?)에 바로 도착하는지, 그리고 초기화가 진짜인지(새 회차 시각 · 서버가 옛 세션을 돌려주지 않음 · 목적·확정 정보 유지) 확인.
// 운영 0 · 비밀값 0(QA 공개 키만) · Galaxy·iPhone 크기 Chrome·WebKit.
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
const DEVICES = [
  ['webkit', webkit, 'iphone', { viewport: { width: 390, height: 844 }, userAgent: devices['iPhone 13'].userAgent, hasTouch: true, deviceScaleFactor: 3 }],
  ['chrome', chromium, 'galaxy', { viewport: { width: 412, height: 915 }, userAgent: devices['Galaxy S9+'].userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
];

for (const [bname, type, dname, opts] of DEVICES) {
  const tag = `${bname} ${dname}`;
  // 1) QA 시험 계정(QA 는 메일 확인 끔) · 목적 저장 · 실제 대화 세션 1개
  const email = `qa-restart-${Date.now()}-${dname}@do-it.company`; const password = `Qa!${randomUUID()}`;
  const su = await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { nickname: `QA-RESTART-${dname}` } } });
  const tok = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  const session = tok.data; const jwt = session?.access_token; const uid = session?.user?.id;
  check(`${tag}: QA 시험 계정 가입·로그인`, su.status === 200 && tok.status === 200 && !!jwt, `signup=${su.status} login=${tok.status}`);
  if (!jwt) continue;
  const pp = await http(`/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', jwt, body: { purpose_id: 'friend', purpose_label: '친구를 만나고 싶어요', consent_version: 'v1.0' }, headers: { Prefer: 'return=minimal' } });
  const st = await http('/functions/v1/doit-agent', { method: 'POST', jwt, body: { action: 'agent_start', requestId: randomUUID(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구를 만나고 싶어요' } });
  const oldSid = st.data?.session?.id ?? null;
  check(`${tag}: 준비 — 약관 동의(v1.0)·목적 저장 · 대화 세션 1개 시작(QA 서버)`, pp.status === 204 && st.status === 200 && !!oldSid, `profile=${pp.status} agent_start=${st.status}`);

  // 2) 로그인된 브라우저로 「나의 이해」 → 「처음부터 다시 시작하기」 한 번 탭
  const b = await type.launch();
  const ctx = await b.newContext({ ...opts, ...(bname === 'webkit' ? { isMobile: undefined } : {}) });
  await ctx.addInitScript(([key, value]) => { try { localStorage.setItem(key, value); sessionStorage.setItem('doit_intro_seen', '1'); } catch { /* 무시 */ } }, [`sb-${QA_REF}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
  const nav = []; p.on('framenavigated', (f) => { if (f === p.mainFrame()) nav.push(new URL(f.url()).pathname); });
  await p.goto(`${APP}/doit/understanding`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const btn = p.getByRole('button', { name: /처음부터 다시 시작하기/ });
  await btn.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
  const visible = await btn.isVisible().catch(() => false);
  check(`${tag}: 나의 이해에 「처음부터 다시 시작하기」 버튼`, visible, `path=${new URL(p.url()).pathname}`);
  if (visible) {
    const t0 = Date.now(); const navBefore = nav.length;
    await btn.tap().catch(async () => btn.click());                 // ← 한 번 탭(그 뒤 사용자 조작 0)
    const opening = p.getByRole('heading', { name: /어떤 만남을\s*원하세요\?/ });
    const arrived = await opening.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
    const path = new URL(p.url()).pathname; const passed = nav.slice(navBefore);
    check(`${tag}: 한 번 탭 → ECHO 첫 대화 화면(어떤 만남을 원하세요?) 도착`, arrived && path === '/doit/conversation', `path=${path} ms=${Date.now() - t0}`);
    check(`${tag}: 경유 화면 0(홈·나의 이해·요약을 거치지 않음) · 확인 창 0`, !passed.some((x) => /\/doit\/home|summary|understanding/.test(x)) && !(await p.getByText('계속할게요').isVisible().catch(() => false)), JSON.stringify(passed));
    // 3) 진짜 초기화인지(화면만 옮긴 가짜 아님)
    const me = await http('/auth/v1/user', { jwt });
    const round = me.data?.user_metadata?.doit_round_started_at ?? null;
    check(`${tag}: 새 회차 시각이 기록됨(서버가 읽는 값)`, !!round && Date.parse(round) >= t0 - 5000, `round=${round}`);
    const tok2 = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } }).catch(() => null);
    const jwt2 = tok2?.data?.access_token ?? jwt;
    const get = await http('/functions/v1/doit-agent', { method: 'POST', jwt: jwt2, body: { action: 'agent_get' } });
    check(`${tag}: 서버가 옛 대화 세션을 이번 회차로 돌려주지 않음(새 세션부터)`, get.status === 200 && (get.data?.session === null || get.data?.session?.id !== oldSid), `status=${get.status} session=${get.data?.session?.id?.slice(0, 8) ?? null} old=${oldSid?.slice(0, 8)}`);
    const prof = await http(`/rest/v1/profiles?id=eq.${uid}&select=purpose_id,nickname`, { jwt: jwt2 });
    check(`${tag}: 계정·Profile 유지(목적 지우지 않음)`, prof.data?.[0]?.purpose_id === 'friend' && me.status === 200, JSON.stringify(prof.data?.[0] ?? prof.status));
  }
  check(`${tag}: 페이지 오류 0`, errs.length === 0, JSON.stringify(errs.slice(0, 2)));
  await b.close();
}
const fail = results.filter((x) => !x).length;
console.log(`QA RESTART CHECK: ${results.length - fail} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
