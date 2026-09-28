// ADMIN WEB 서버(admin-web) 실제 코드를 가짜 DB 로 돌리는 검사 — 2026-09-28 대표 「ADMIN WEB FINAL BUILD ORDER」.
// 확인: 로그인 없음 401 · 일반 사용자 403(자료 0) · 관리자만 실제 줄에서 센 값 · 못 읽은 표는 0 이 아니라 null/오류 · 쓰기 0 · 품질 판정 · 확정 상태 여섯 가지.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const FN = new URL('../supabase/functions/', import.meta.url);
const ID = { admin: '00000000-0000-4000-8000-000000000001', a: '10000000-0000-4000-8000-00000000000a', b: '20000000-0000-4000-8000-00000000000b' };
const compile = (f) => ts.transpileModule(readFileSync(new URL(f, FN), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function load() {
  const agent = { exports: {} };
  vm.runInNewContext(compile('doit-agent/agent.ts'), { module: agent, exports: agent.exports, console }, { filename: 'agent.ts' });
  const logic = { exports: {} };
  vm.runInNewContext(compile('admin-web/logic.ts'), { module: logic, exports: logic.exports, require: (n) => { if (n === '../doit-agent/agent.ts') return agent.exports; throw new Error(n); } }, { filename: 'logic.ts' });
  const idx = { exports: {} };
  vm.runInNewContext(compile('admin-web/index.ts'), { module: idx, exports: idx.exports, console, Deno: { env: { get: () => '' } }, Response, Request, JSON, Date, Math, Number, String, Array, Object, Map, Set, Promise, Error, RegExp, fetch: async () => new Response(JSON.stringify({ external: { google: true } }), { status: 200 }),
    require: (n) => { if (n === '../doit-agent/agent.ts') return agent.exports; if (n === './logic.ts') return logic.exports; if (n.startsWith('npm:@supabase')) return { createClient: () => { throw new Error('no real client in test'); } }; throw new Error(n); } }, { filename: 'index.ts' });
  return { handle: idx.exports.handle, L: logic.exports, A: agent.exports };
}

// 가짜 DB: select 체인(eq · gte · in · order · limit · range · maybeSingle · head count). 쓰기 함수는 부르면 기록된다(0 이어야 함).
function fakeDb(tables, writes, missing = new Set()) {
  const q = (name) => {
    const f = []; let order = null; let lim = null; let rng = null; let head = false; let count = false;
    const rows = () => { let r = (tables[name] ?? []).filter((x) => f.every((g) => g(x))); if (order) r = r.slice().sort((a, b) => (a[order.c] < b[order.c] ? -1 : a[order.c] > b[order.c] ? 1 : 0) * (order.asc ? 1 : -1)); if (rng) r = r.slice(rng[0], rng[1] + 1); if (lim != null) r = r.slice(0, lim); return r; };
    const res = () => (missing.has(name) ? { data: null, error: { code: '42P01' }, count: null } : head ? { data: null, error: null, count: rows().length } : { data: structuredClone(rows()), error: null });
    const c = {
      select: (_s, o) => { if (o?.head) head = true; if (o?.count) count = true; return c; },
      eq: (k, v) => { f.push((r) => r[k] === v); return c; },
      gte: (k, v) => { f.push((r) => String(r[k] ?? '') >= String(v)); return c; },
      in: (k, vs) => { f.push((r) => vs.includes(r[k])); return c; },
      order: (k, o) => { order = { c: k, asc: o?.ascending !== false }; return c; },
      limit: (n) => { lim = n; return c; },
      range: (a, b) => { rng = [a, b]; return c; },
      maybeSingle: () => Promise.resolve(missing.has(name) ? { data: null, error: { code: '42P01' } } : { data: rows()[0] ?? null, error: null }),
      then: (ok, bad) => Promise.resolve(res()).then(ok, bad),
    };
    void count;
    return c;
  };
  const w = (op, name) => () => { writes.push(`${op}:${name}`); return Promise.resolve({ data: null, error: null }); };
  return { from: (name) => ({ ...q(name), insert: w('insert', name), update: w('update', name), upsert: w('upsert', name), delete: w('delete', name) }) };
}

const now = new Date().toISOString();
const old = new Date(Date.now() - 40 * 86400_000).toISOString();
function state(goal, extra = {}) {
  return {
    version: 'x', tone: 'polite', mode: 'TEXT', phase: 'done', goal, goal_label: goal === 'friend' ? '친구' : '연애',
    turns: [
      { n: 1, ai: '친구와 어떤 활동을 함께 하고 싶으세요?', question_purpose: null, question_type: null, user: '카페에서 얘기하는 게 좋아', kind: 'answer', reply: '얘기가 잘 통하는 시간이 편한 쪽이네요.', question: '깊은 얘기까지 하는 친구가 좋아요?' },
      { n: 2, ai: null, question_purpose: null, question_type: null, user: '잘 모르겠어', kind: 'unsure', guard: { from: 'help', to: 'unsure', rule: 'unsure_only' }, reply: '괜찮아요.', question: '깊은 얘기까지 하는 친구가 좋아요?' },
    ],
    slots: {
      relationship_intent: { status: 'CONFIRMED', items: [{ note: '친구', quote: '친구', turn: 0, source: 'answer', status: 'CONFIRMED', source_type: 'USER_DIRECT' }] },
      attraction_comfort: { status: 'CONFIRMED', items: [{ note: '카페 대화', quote: '카페', turn: 1, source: 'answer', status: 'CONFIRMED', source_type: 'USER_CORRECTED' }, { note: '술자리', quote: '술', turn: 1, source: 'answer', status: 'SUPERSEDED', source_type: 'AI_EXTRACTED' }] },
      values_character: { status: 'UNKNOWN', items: [{ note: '조용함', quote: '조용', turn: 1, source: 'answer', status: 'RETRACTED', source_type: 'AI_EXTRACTED' }, { note: '느긋함', quote: '느긋', turn: 1, source: 'answer', status: 'DISPUTED', source_type: 'AI_EXTRACTED' }] },
      relationship_style: { status: 'UNKNOWN', items: [] }, boundaries: { status: 'UNKNOWN', items: [] },
    },
    inferred: [{ trait: '내향적', basis: '카페', turn: 1, status: 'INFERRED' }], corrections: [], disputed: [], declared: { mbti: null, blood_type: null },
    asked: [{ type: 'core', purpose: 'relationship_intent', text: '친구와 어떤 활동을 함께 하고 싶으세요?' }, { type: 'core', purpose: 'attraction_comfort', text: '깊은 얘기까지 하는 친구가 좋아요?' }, { type: 'core', purpose: 'values_character', text: '깊은 얘기까지 하는 친구가 좋아요?' }],
    current: null, clarify: { total: 0, per: {} }, closing: '이제 조금 알 것 같아요.', summary: [{ purpose: 'relationship_intent', text: '친구를 만나고 싶어요.' }], after_turns: 0, opening_reply: null, ...extra,
  };
}
function world() {
  return {
    profiles: [
      { id: ID.admin, email: 'boss@do-it.company', nickname: '운영', role: 'admin', created_at: old, bio: '' },
      { id: ID.a, email: 'alice@example.com', nickname: '앨리스', role: 'user', created_at: now, bio: '안녕하세요', purpose_label: '친구', verification_status: 'verified' },
      { id: ID.b, email: 'bob@example.com', nickname: '밥', role: 'user', created_at: old, bio: '', purpose_label: null, verification_status: 'pending' },
    ],
    profile_photos: [{ user_id: ID.a }, { user_id: ID.a }, { user_id: ID.a }],
    doit_request_events: [
      { request_id: 's1', user_id: ID.a, action: 'agent_session', status: 'applied', created_at: now, updated_at: now, response_payload: { agent: 'echo-agent-v2.4.1', state: state('friend') } },
      { request_id: 's2', user_id: ID.a, action: 'agent_session', status: 'applied', created_at: now, updated_at: now, response_payload: { agent: 'echo-agent-v2.4.1', state: state('romantic', { turns: [], asked: [], summary: [{ purpose: 'relationship_intent', text: '친구 사이로 지내고 싶어요.' }] }) } },
      { request_id: 't1', user_id: ID.a, action: 'agent_turn', status: 'applied', target_id: 's1', created_at: now, response_payload: { record: { kind: 'answer', agent: 'echo-agent-v2.4.1', calls: [{ model: 'gpt-4o-mini' }], retry: [], saved: true } } },
      { request_id: 't2', user_id: ID.a, action: 'agent_turn', status: 'failed', target_id: 's1', created_at: now, response_payload: { record: { kind: 'error', error: 'PROVIDER', agent: 'echo-agent-v2.4.1' } } },
      { request_id: 't3', user_id: ID.a, action: 'agent_turn', status: 'applied', target_id: 's1', created_at: now, response_payload: { record: { kind: 'correction', saved: false, record_error: 'record_save_failed', agent: 'echo-agent-v2.4.1' } } },
    ],
    user_reports: [{ id: 'r1', reporter_id: ID.a, target_user_id: ID.b, reason: '협박 메시지', detail: '무서워요', status: 'open', created_at: now }],
    blocks: [{ id: 'b1', blocker_id: ID.a, blocked_user_id: ID.b, reason: 'connection', created_at: now }],
    doit_matches: [{ id: 'm1', status: 'closed', created_at: now }],
    purposes: [{ id: 'friend', label: '친구', is_active: true, sort_order: 1 }],
  };
}

async function call(handle, { as, body, tables = world(), missing } = {}) {
  const writes = [];
  const db = fakeDb(tables, writes, missing);
  const user = { auth: { getUser: async () => (as ? { data: { user: { id: as, email: 'x' } }, error: null } : { data: { user: null }, error: { message: 'no' } }) } };
  const req = new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json', Origin: 'http://localhost:5173' }, body: JSON.stringify(body) });
  const res = await handle(req, { url: 'http://db', anon: 'a', service: 's' }, { user, admin: db });
  return { status: res.status, body: await res.json(), writes, headers: res.headers };
}

test('ADMIN WEB 보안: 로그인 없음 401 · 일반 사용자 403 · 자료 0 · 토큰만 없으면 401', async () => {
  const { handle } = load();
  const none = await call(handle, { body: { action: 'overview' } });
  assert.equal(none.status, 401);
  for (const action of ['overview', 'users', 'sessions', 'session', 'safety', 'sources']) {
    const r = await call(handle, { as: ID.a, body: { action, id: '00000000-0000-4000-8000-000000000009' } });
    assert.equal(r.status, 403, action);
    assert.deepEqual(Object.keys(r.body).sort(), ['code', 'message', 'ok'], `${action}: 오류 모양만(자료 0)`);
  }
  const noBearer = await handle(new Request('http://x', { method: 'POST', body: '{}' }), { url: '', anon: '', service: 's' });
  assert.equal(noBearer.status, 401);
});

test('ADMIN WEB 대시보드: 실제 줄에서 센 값 · 품질 판정 · 결정 필요(최대 3) · 쓰기 0', async () => {
  const { handle } = load();
  const r = await call(handle, { as: ID.admin, body: { action: 'overview', period: 'today' } });
  assert.equal(r.status, 200);
  const d = r.body;
  assert.equal(d.users.total, 2, '관리자 제외');
  assert.equal(d.users.signups, 1, '오늘 가입 = 앨리스');
  assert.equal(d.users.conversations_started, 2);
  assert.equal(d.ai.turns, 3); assert.equal(d.ai.failed, 1);
  assert.equal(d.ai.correction_not_saved, 1); assert.equal(d.ai.profile_save_failed, 1);
  assert.equal(d.ai.quality.repeat, 1, '같은 질문 두 번 보임');
  assert.equal(d.ai.quality.unsure_repeat, 1, '「잘 모르겠어」 뒤 같은 질문');
  assert.equal(d.ai.quality.summary_mismatch, 1, '연애 세션 정리에 친구 목적 말');
  assert.equal(d.safety.severe, 1); assert.equal(d.safety.open, 1); assert.equal(d.safety.blocks, 1);
  assert.equal(d.health.level, '오류', '중대 의심 신고 → 오류');
  assert.ok(d.decisions.length <= 3 && d.decisions[0].includes('중대'));
  assert.equal(d.auth.google, true);
  assert.equal(d.ai.agent_seen[0], 'echo-agent-v2.4.1');
  assert.deepEqual(r.writes, [], '읽기만');
  assert.ok(!JSON.stringify(d).includes('alice@example.com'), '메일 원문 0');
});

test('ADMIN WEB: 표를 못 읽으면 0 이 아니라 null + 오류 표시(가짜 0 금지)', async () => {
  const { handle } = load();
  const r = await call(handle, { as: ID.admin, body: { action: 'overview' }, missing: new Set(['user_reports']) });
  assert.equal(r.status, 200);
  assert.equal(r.body.safety.reports, null); assert.equal(r.body.safety.open, null);
  assert.ok(r.body.errors.includes('신고'));
  assert.equal(r.body.health.level, '오류');
  const src = await call(handle, { as: ID.admin, body: { action: 'sources' }, missing: new Set(['audit_logs']) });
  const audit = src.body.tables.find((t) => t.table === 'audit_logs');
  assert.equal(audit.rows, null); assert.ok(audit.error, '감사 기록 표 없음 = 연결 필요');
  assert.equal(src.body.tables.find((t) => t.table === 'profiles').rows, 3);
});

test('ADMIN WEB 사용자: 메일 가림 · 사진 수 · 최근 활동 · 신고/차단 수 · 삭제 동작 없음', async () => {
  const { handle } = load();
  const r = await call(handle, { as: ID.admin, body: { action: 'users' } });
  assert.equal(r.status, 200);
  const a = r.body.users.find((u) => u.id === ID.a);
  assert.equal(a.email, 'a***@example.com'); assert.equal(a.photos, 3); assert.equal(a.intro_saved, true); assert.ok(a.last_active_at);
  const b = r.body.users.find((u) => u.id === ID.b);
  assert.equal(b.reported, 1); assert.equal(b.blocked_by, 1);
  const bad = await call(handle, { as: ID.admin, body: { action: 'delete_user', id: ID.b } });
  assert.equal(bad.status, 400, '알 수 없는 동작(삭제 없음)');
  assert.deepEqual([...r.writes, ...bad.writes], []);
});

test('ADMIN WEB 대화: 목록(목적·실패·같은 계정 여러 세션) · 상세(원문·서버 기록·확정 상태 여섯 가지·연결에 쓰는지)', async () => {
  const { handle } = load();
  const list = await call(handle, { as: ID.admin, body: { action: 'sessions', period: '7d' } });
  assert.equal(list.status, 200);
  assert.equal(list.body.total, 2); assert.equal(list.body.multi_session_users, 1, '같은 계정 친구·연애 두 세션');
  const s1 = list.body.sessions.find((s) => s.id === 's1');
  assert.equal(s1.goal, 'friend'); assert.equal(s1.failed_turns, 1); assert.deepEqual(s1.sessions_of_user.sort(), ['friend', 'romantic']);
  assert.ok(!('user_id' in s1), '목록에 전체 사용자 id 없음');
  const onlyRomantic = await call(handle, { as: ID.admin, body: { action: 'sessions', period: '7d', goal: 'romantic' } });
  assert.deepEqual(onlyRomantic.body.sessions.map((s) => s.id), ['s2']);
  const failed = await call(handle, { as: ID.admin, body: { action: 'sessions', period: '7d', failed: true } });
  assert.ok(failed.body.sessions.every((s) => s.failed_turns > 0 || s.quality_total > 0));
  const d = await call(handle, { as: ID.admin, body: { action: 'session', id: '00000000-0000-4000-8000-000000000000' } });
  assert.equal(d.status, 404);
  const { L } = load();
  const states = [...L.factsOf(state('friend')).map((f) => `${f.state}:${f.matching}`)].sort();
  assert.deepEqual(states, ['거절:false', '미확정:false', '분쟁 중:false', '사용자 정정:true', '폐기:false', '확정:true'].sort());
});

test('ADMIN WEB 신고·차단: 이름·짧은 번호만 · 중대 의심 표시 · 처리자 칸 없음을 알린다 · 쓰기 0', async () => {
  const { handle } = load();
  const r = await call(handle, { as: ID.admin, body: { action: 'safety' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.reports[0].severe, true); assert.equal(r.body.reports[0].target.nickname, '밥');
  assert.equal(r.body.reports[0].target.short, ID.b.slice(0, 8));
  assert.equal(r.body.handler_columns, false);
  assert.deepEqual(r.writes, []);
});

test('ADMIN WEB 서버 원본: 쓰기 코드 0 · 관리자 확인은 서비스 권한으로 profiles.role 을 다시 읽음', () => {
  const src = readFileSync(new URL('admin-web/index.ts', FN), 'utf8');
  assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\(/);
  assert.doesNotMatch(src, /rpc\(/);
  assert.match(src, /auth\.getUser\(\)/);
  assert.match(src, /from\("profiles"\)\.select\("role"\)\.eq\("id", user\.id\)/);
  assert.match(src, /!== "admin"\) return fail\("FORBIDDEN"/);
  assert.doesNotMatch(src, /SERVICE_ROLE_KEY[^)]*json\(/, '비밀값을 응답에 넣지 않음');
});
