// ADMIN WEB QA 검사(2026-09-28 대표 「ADMIN WEB FINAL BUILD ORDER」 §20) — QA 프로젝트 전용 · 비밀값 출력 0.
// 1) 서버: 로그인 없음 401 · 일반 사용자 403(자료 0) · 관리자 200(실제 값) — admin-web 여섯 동작 + doit-connect admin_members.
// 2) 화면(러너 안에서 띄운 관리자 빌드 · Chrome·WebKit · 390/1280): 관리자 로그인 → 대시보드·메뉴 14개 · 대화 원문 열기 / 일반 사용자 → 거절 화면·자료 호출 0 / 로그인 없음 → 로그인 화면.
import { createHash } from 'node:crypto';
const { QA_REF, QA_ANON, QA_PW_SEED, ADMIN_BASE, ADMIN_EMAIL, USER_EMAIL, USER_ACCT, ADMIN_ACCT } = process.env;
if (QA_REF !== 'mutniujeiyujhkobadkd' || !QA_ANON || !QA_PW_SEED) { console.error('QA 환경값 없음/불일치'); process.exit(2); }
const URL0 = `https://${QA_REF}.supabase.co`;
const pw = (run, tag) => `Qa!${createHash('sha256').update(`${QA_PW_SEED}:${run}:${tag}`).digest('base64url').slice(0, 24)}`;
const results = []; const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`); };
async function login(email, password) {
  const r = await fetch(`${URL0}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: QA_ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return r.ok ? await r.json() : null;
}
async function fn(name, jwt, body) {
  const r = await fetch(`${URL0}/functions/v1/${name}`, { method: 'POST', headers: { apikey: QA_ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Origin: 'http://localhost:8790' }, body: JSON.stringify(body) });
  let d = null; try { d = await r.json(); } catch { /* 빈 응답 */ }
  return { status: r.status, data: d };
}

const admin = await login(ADMIN_EMAIL, pw(ADMIN_ACCT, 'admin'));
const user = await login(USER_EMAIL, pw(USER_ACCT, 'user'));
check('QA 관리자 계정 로그인', admin?.access_token);
check('QA 일반 사용자 계정 로그인', user?.access_token);
if (!admin?.access_token || !user?.access_token) process.exit(1);

// ── 1) 서버
const none = await fn('admin-web', QA_ANON, { action: 'overview' });
check('로그인 없음(공개 키만) → 401', none.status === 401, `HTTP ${none.status}`);
for (const action of ['overview', 'users', 'sessions', 'safety', 'sources']) {
  const r = await fn('admin-web', user.access_token, { action });
  check(`일반 사용자 admin-web ${action} → 403 · 자료 0`, r.status === 403 && r.data && !('users' in r.data) && !('sessions' in r.data), `HTTP ${r.status}`);
}
const um = await fn('doit-connect', user.access_token, { action: 'admin_members' });
check('일반 사용자 doit-connect admin_members → 403', um.status === 403, `HTTP ${um.status}`);
const ov = await fn('admin-web', admin.access_token, { action: 'overview', period: '30d' });
check('관리자 overview 200', ov.status === 200 && ov.data?.ok, `HTTP ${ov.status}`);
const d = ov.data ?? {};
check('대시보드 값이 실제 값(사용자·대화·신고 null 아님)', d.users?.total > 0 && d.users?.conversations_started !== null && d.safety?.reports !== null, JSON.stringify({ users: d.users, ai: { turns: d.ai?.turns, failed: d.ai?.failed, quality: d.ai?.quality }, safety: d.safety, health: d.health, google: d.auth?.google, decisions: d.decisions }));
const ss = await fn('admin-web', admin.access_token, { action: 'sessions', period: '30d' });
check('관리자 AI 대화 목록 · 실제 대화 있음', ss.status === 200 && ss.data?.total > 0, `대화 ${ss.data?.total} · 여러 목적 계정 ${ss.data?.multi_session_users}`);
const first = ss.data?.sessions?.[0];
const one = first ? await fn('admin-web', admin.access_token, { action: 'session', id: first.id }) : { status: 0 };
check('관리자 대화 상세 · 원문 턴 · 확정 상태 · 서버 기록', one.status === 200 && Array.isArray(one.data?.session?.turns) && one.data.session.turns.length > 0 && Array.isArray(one.data?.session?.facts), `턴 ${one.data?.session?.turns?.length} · 사실 ${one.data?.session?.facts?.length} · 기록 ${one.data?.records?.length}`);
const us = await fn('admin-web', admin.access_token, { action: 'users' });
check('관리자 사용자 목록 · 메일 가림', us.status === 200 && us.data?.users?.length > 0 && us.data.users.every((u) => !u.email || u.email.includes('***')), `${us.data?.users?.length}명`);
const sf = await fn('admin-web', admin.access_token, { action: 'safety' });
check('관리자 신고·차단', sf.status === 200 && Array.isArray(sf.data?.reports), `신고 ${sf.data?.reports?.length} · 차단 ${sf.data?.blocks?.length}`);
const src = await fn('admin-web', admin.access_token, { action: 'sources' });
check('관리자 데이터 확인 · 표별 상태', src.status === 200 && src.data?.tables?.length > 0, JSON.stringify(src.data?.tables?.map((t) => [t.table, t.rows ?? t.error])));
const mem = await fn('doit-connect', admin.access_token, { action: 'admin_members' });
check('관리자 연결 준비(사람별)', mem.status === 200 && Array.isArray(mem.data?.members), `${mem.data?.members?.length}명 · 준비 ${mem.data?.members?.filter((m) => m.eligible).length}`);

// ── 2) 화면
if (ADMIN_BASE) {
  const { chromium, webkit } = await import('playwright');
  const session = (s) => JSON.stringify({ access_token: s.access_token, token_type: 'bearer', expires_in: s.expires_in, expires_at: s.expires_at, refresh_token: s.refresh_token, user: s.user });
  for (const [bname, type] of [['chrome', chromium], ['webkit', webkit]]) {
    for (const [w, h] of [[390, 844], [1280, 900]]) {
      for (const who of ['admin', 'user', 'none']) {
        const b = await type.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
        const errs = []; const calls = [];
        p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
        p.on('request', (r) => { if (r.url().includes('/functions/v1/admin-web')) calls.push(r.url()); });
        const s = who === 'admin' ? admin : who === 'user' ? user : null;
        if (s) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${QA_REF}-auth-token`, session(s)]);
        const tag = `${bname} ${w} ${who}`;
        const settle = async () => { await p.waitForSelector('.aw-top h1, .aw-card', { timeout: 20000 }).catch(() => {}); await p.waitForFunction(() => !document.querySelector('.aw-loading'), null, { timeout: 30000 }).catch(() => {}); };
        await p.goto(`${ADMIN_BASE}/?m=users`); await settle(); await p.waitForTimeout(500);
        const txt = await p.evaluate(() => document.body.innerText);
        if (who === 'none') check(`화면 ${tag}: 로그인 없음 → 로그인 화면`, p.url().endsWith('/login') && txt.includes('관리자 계정만'), p.url());
        if (who === 'user') check(`화면 ${tag}: 일반 사용자 직접 주소 → 거절 · 관리자 자료 호출 0`, txt.includes('관리자 권한이 없습니다') && calls.length === 0, `calls=${calls.length}`);
        if (who === 'admin') {
          check(`화면 ${tag}: 사용자 목록(실제)`, txt.includes('사용자') && (await p.locator('.aw-table tbody tr').count()) > 0);
          await p.goto(`${ADMIN_BASE}/`); await settle(); await p.waitForSelector('.aw-level--big', { timeout: 30000 }).catch(() => {});
          const dash = await p.evaluate(() => ({ level: document.querySelector('.aw-level--big')?.textContent ?? null, stats: document.querySelectorAll('.aw-stat').length, overflow: document.documentElement.scrollWidth > innerWidth + 1, missing: [...document.querySelectorAll('.aw-missing')].map((e) => e.textContent) }));
          check(`화면 ${tag}: 대시보드 상태 글자 · 숫자 칸 · 가로 넘침 없음`, /정상|주의|오류/.test(dash.level ?? '') && dash.stats >= 20 && !dash.overflow, JSON.stringify(dash));
          await p.goto(`${ADMIN_BASE}/?m=conversations`); await settle(); await p.waitForSelector('.aw-row', { timeout: 20000 }).catch(() => {});
          const rows = await p.locator('.aw-row').count();
          if (rows) { await p.locator('.aw-row').first().click(); await p.getByRole('button', { name: '원문 보기' }).click({ timeout: 20000 }).catch(() => {}); await p.waitForTimeout(300); }
          const turns = await p.locator('.aw-turn').count();
          check(`화면 ${tag}: AI 대화 목록·원문 조회`, rows > 0 && turns > 0, `대화 ${rows} · 턴 ${turns}`);
          let menuFail = [];
          for (const m of ['facts', 'profiles', 'connect', 'safety', 'status', 'release', 'failures', 'alerts', 'settings', 'audit', 'data']) {
            await p.goto(`${ADMIN_BASE}/?m=${m}`); await settle();
            const bad = await p.evaluate(() => ({ h1: document.querySelector('.aw-top h1')?.textContent, err: [...document.querySelectorAll('.aw-notice--bad')].map((e) => e.textContent), overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
            if (!bad.h1 || bad.overflow || bad.err.length) menuFail.push(`${m}:${bad.err.join('/') || (bad.overflow ? 'overflow' : 'noh1')}`);
          }
          check(`화면 ${tag}: 나머지 메뉴 11개 오류 0 · 넘침 0`, menuFail.length === 0, menuFail.join(' | '));
        }
        check(`화면 ${tag}: 페이지 오류 0`, errs.length === 0, errs.join(' | '));
        await b.close();
      }
    }
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`ADMIN CHECK: ${results.length - failed.length} PASS / ${failed.length} FAIL`);
process.exit(failed.length ? 1 : 0);
