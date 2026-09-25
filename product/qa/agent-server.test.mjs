// doit-agent(운영 대화 에이전트) 실제 코드를 가짜 DB·가짜 AI로 끝까지 돌리는 검사 — 가짜 AI 기준(실제 AI 품질 판정 아님).
// 확인: 다섯 질문 끝·여섯 번째 없음 · 말투 유지(입력) · 먼저 답하기 · 정정·거절·넘기기·지침 · 매칭 프로필·넘기기 · 턴 기록(관측) · 관리자 권한 · 같은 요청 재전송 · 로그에 원문 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);
const ID = { user: '10000000-0000-4000-8000-00000000000a', admin: '00000000-0000-4000-8000-000000000001', other: '20000000-0000-4000-8000-00000000000b' };
let seq = 0;
const rid = () => `${String(++seq).padStart(8, '0')}-0000-4000-8000-${String(seq).padStart(12, '0')}`;

function fakeDb(state) {
  const table = (n) => (state.tables[n] ??= []);
  const q = (name) => {
    let filters = []; let op = 'select'; let patch = null; let order = null; let lim = null; let returning = false;
    const rows = () => { let r = table(name).filter((row) => filters.every((f) => f(row))); if (order) r = r.slice().sort((a, b) => (a[order.col] < b[order.col] ? -1 : a[order.col] > b[order.col] ? 1 : 0) * (order.asc ? 1 : -1)); if (lim != null) r = r.slice(0, lim); return r; };
    const run = () => {
      if (op === 'update') { const hit = rows(); for (const r of hit) Object.assign(r, structuredClone(patch)); return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null }; }
      return { data: rows().map((r) => structuredClone(r)), error: null };
    };
    const c = {
      select: () => { if (op !== 'select') returning = true; return c; },
      eq: (col, v) => { filters.push((r) => r[col] === v); return c; },
      gte: (col, v) => { filters.push((r) => String(r[col] ?? '') >= String(v)); return c; },
      in: (col, vals) => { filters.push((r) => vals.includes(r[col])); return c; },
      order: (col, o) => { order = { col, asc: o?.ascending !== false }; return c; },
      limit: (n) => { lim = n; return c; },
      update: (p) => { op = 'update'; patch = p; return c; },
      maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }),
      then: (ok, bad) => Promise.resolve(run()).then(ok, bad),
    };
    return c;
  };
  return {
    auth: { getUser: async () => (state.authUser ? { data: { user: state.authUser }, error: null } : { data: { user: null }, error: { message: 'no' } }) },
    from: (name) => ({
      ...q(name),
      insert: (row) => {
        const t = table(name);
        if (name === 'doit_request_events' && t.some((r) => r.user_id === row.user_id && r.request_id === row.request_id)) return Promise.resolve({ data: null, error: { code: '23505' } });
        const now = new Date(Date.now() + t.length).toISOString();
        t.push({ created_at: now, updated_at: now, ...structuredClone(row) });
        return Promise.resolve({ data: null, error: null });
      },
    }),
    rpc: async (fn, args) => {
      assert.equal(fn, 'doit_apply_record_create');
      const recs = table('doit_records');
      const dup = recs.find((r) => r.user_id === args.p_user_id && r.request_id === args.p_request_id);
      if (dup) return { data: { ok: true, duplicate: true, record: dup }, error: null };
      const rec = { id: `rec-${recs.length + 1}`, user_id: args.p_user_id, request_id: args.p_request_id, text: args.p_text, original_text: args.p_original_text, status: args.p_status };
      recs.push(rec); return { data: { ok: true, duplicate: false, record: rec }, error: null };
    },
  };
}

function load(state) {
  const compile = (f) => ts.transpileModule(readFileSync(new URL(f, DIR), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const agentMod = { exports: {} };
  vm.runInNewContext(compile('agent.ts'), { module: agentMod, exports: agentMod.exports, console }, { filename: 'agent.ts' });
  let handler = null;
  const logs = [];
  const sandbox = {
    module: { exports: {} }, exports: {}, console: { log: (s) => logs.push(String(s)), error: (s) => logs.push(String(s)) },
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: '', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; if (name === './agent.ts') return agentMod.exports; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      state.aiCalls.push({ system: body.messages[0].content, input: JSON.parse(body.messages[1].content), model: body.model, params: { t: body.temperature, p: body.top_p, m: body.max_tokens } });
      const next = state.ai.shift();
      if (next === undefined) throw new Error('no fake AI output left');
      if (next === 'HTTP500') return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ model: 'gpt-4o-mini-2024-07-18', usage: { prompt_tokens: 1000, completion_tokens: 100 }, choices: [{ message: { content: JSON.stringify(next) } }] }), { status: 200 });
    },
    crypto: globalThis.crypto, TextEncoder, Response, AbortController, setTimeout, clearTimeout, Date, JSON, Math, Number, String, Array, Object, Map, Set, Promise, Error, RegExp, URL,
  };
  vm.runInNewContext(compile('index.ts'), sandbox, { filename: 'index.ts' });
  return { call: async (body, { auth = true } = {}) => { const res = await handler(new Request('http://x', { method: 'POST', headers: auth ? { Authorization: 'Bearer t', 'content-type': 'application/json' } : { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: res.status, body: await res.json() }; }, logs, agent: agentMod.exports };
}

const T = (o) => ({ kind: 'answer', understood: '', reply: '그렇군요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const Q = (purpose, question) => ({ next: { type: 'core', purpose, question } });
const X = (purpose, note, quote) => ({ purpose, note, quote });
const newState = (role = 'user') => ({ tables: { profiles: [{ id: ID.user, role: 'user', nickname: '나' }, { id: ID.admin, role: 'admin', nickname: '관리' }] }, ai: [], aiCalls: [], authUser: { id: role === 'admin' ? ID.admin : ID.user, user_metadata: {} } });

test('로그인 안 함 → 401 · 모르는 동작 → 400', async () => {
  const s = newState(); const h = load(s);
  assert.equal((await h.call({ action: 'agent_get' }, { auth: false })).status, 401);
  s.authUser = null; assert.equal((await h.call({ action: 'agent_get' })).status, 401);
  s.authUser = { id: ID.user, user_metadata: {} }; assert.equal((await h.call({ action: 'drop_table' })).status, 400);
});

test('다섯 질문 흐름: 목적 타일이 첫 답 → 핵심 질문 5개에서 멈춤 · 여섯 번째 없음 · 매칭 프로필 · 넘기기 · 기록 저장', async () => {
  const s = newState(); const h = load(s);
  assert.equal((await h.call({ action: 'agent_get' })).body.session, null);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '편하게')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(start.status, 200); const sid = start.body.session.id;
  assert.equal(start.body.session.progress.asked, 2);
  assert.deepEqual(start.body.session.messages.map((m) => m.role), ['ai', 'user', 'ai', 'ai']);
  assert.equal(start.body.session.messages[0].text, '어떤 만남을 원하세요?');
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  assert.equal((await say('잘 웃는 사람')).body.session.progress.asked, 3);
  s.ai.push(T({ kind: 'skip', ...Q('relationship_style', '천천히 알아가는 게 편해요?') }));
  const sk = await say('다음 질문으로 넘어가요');
  assert.equal(sk.body.turn.saved, false); assert.equal(sk.body.session.progress.asked, 4);
  s.ai.push(T({ extracted: [X('relationship_style', '천천히', '천천히')], ...Q('boundaries', '피하고 싶은 게 있어요?') }));
  assert.equal((await say('네 천천히요')).body.session.progress.asked, 5);
  // 다섯 번째 답: AI 가 여섯 번째 질문을 내도(이미 물은 목적) 서버가 받지 않고 마친다.
  s.ai.push(T({ extracted: [X('boundaries', '거짓말 싫음', '거짓말')], ...Q('values_character', '하나만 더 물어봐도 돼요?') }), { summary: [{ purpose: 'boundaries', text: '거짓말은 싫어요' }], closing: '이제 조금 알 것 같아요.' });
  const end = await say('거짓말하는 사람은 싫어요');
  assert.equal(end.body.turn.finish, true); assert.equal(end.body.session.phase, 'done');
  assert.equal(end.body.session.progress.asked, 5);
  assert.ok(!end.body.session.messages.some((m) => m.text === '하나만 더 물어봐도 돼요?'), '여섯 번째 질문 0');
  const p = end.body.session.profile;
  assert.equal(p.relationship_intent.status, 'CONFIRMED'); assert.equal(p.values_character.status, 'SKIPPED'); assert.equal(p.boundaries.items[0].quote, '거짓말');
  assert.equal(end.body.session.handoff.status, 'NOT_CONNECTED'); assert.deepEqual(end.body.session.handoff.candidates, []);
  // 저장: 뜻을 뽑은 답만 doit_records 에(넘기기 제외) = 4개
  assert.equal(s.tables.doit_records.length, 4);
  assert.ok(!s.tables.doit_records.some((r) => r.text.includes('넘어가')));
  // 끝난 뒤 말은 고치기로만(질문 0)
  s.ai.push(T({ kind: 'correction', reply: '고친 뜻으로 둘게요.', extracted: [X('boundaries', '약속 어기는 것', '약속')] }));
  const after = await say('거짓말보다 약속 어기는 게 싫어요');
  assert.equal(after.body.turn.question, null); assert.equal(after.body.turn.after, true);
  // 턴 기록: 모델·토큰·지연·흐름 표시
  const turns = s.tables.doit_request_events.filter((r) => r.action === 'agent_turn');
  assert.equal(turns.length, 6);
  const rec = turns[0].response_payload.record;
  assert.equal(rec.calls[0].model, 'gpt-4o-mini-2024-07-18'); assert.equal(rec.calls[0].input_tokens, 1000); assert.equal(rec.provider, 'openai');
  assert.ok(turns.some((t) => t.response_payload.record.flags.skip));
  // 파라미터·모델: 기존 승인 모델(빈 값 → gpt-4o-mini) · temperature 0.2 · top_p 0.9 · max 768
  assert.ok(s.aiCalls.every((c) => c.model === 'gpt-4o-mini' && c.params.t === 0.2 && c.params.p === 0.9 && c.params.m === 768));
  // 로그에 사용자 원문 0
  assert.ok(!h.logs.some((l) => /편하게|잘 웃는|거짓말|약속/.test(l)), '로그에 원문 없음');
});

test('말투: 고른 말투가 매 턴 AI 지시에 들어가고, 예시 문장은 넣지 않는다(베끼기 방지)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해?') }));
  const st = await h.call({ action: 'agent_start', requestId: rid(), tone: 'casual', mode: 'VOICE', firstAnswer: '친구' });
  assert.equal(st.body.session.tone, 'casual'); assert.equal(st.body.session.mode, 'VOICE');
  s.ai.push(T({ extracted: [X('attraction_comfort', '조용한 사람', '조용한')], ...Q('values_character', '뭘 제일 먼저 봐?') }));
  await h.call({ action: 'agent_turn', requestId: rid(), sessionId: st.body.session.id, text: '조용한 사람이 좋아요' });
  assert.ok(s.aiCalls.every((c) => c.system.includes('편한 반말')));
  assert.ok(s.aiCalls.every((c) => !c.system.includes('편한 게 제일 중요')), '말투 예시 문장 없음');
});

test('먼저 답하기·정정·항의: 저장 0 · 틀린 기억 거둠 · 문제 삼은 질문은 disputed 로', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '연애', '연애')], ...Q('attraction_comfort', '어떤 사람한테 끌려요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', firstAnswer: '연애' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.ai.push(T({ kind: 'ask', reply: '핵심 질문은 다섯 개까지만 해요.', ...Q('attraction_comfort', '어떤 사람한테 끌려요?') }));
  const a = await say('질문 몇 개예요?');
  assert.equal(a.body.turn.kind, 'ask'); assert.equal(a.body.turn.saved, false); assert.equal(a.body.session.progress.asked, 2, '먼저 답한 뒤 같은 핵심 질문으로 이어짐(질문 수 안 늘어남)');
  s.ai.push(T({ kind: 'repair', reply: '제가 잘못 짚었네요.', wrong: ['연애'], ...Q('values_character', '사람 볼 때 뭘 봐요?') }));
  const r = await say('그게 아니라니까요');
  assert.equal(r.body.turn.saved, false);
  const stored = s.tables.doit_request_events.find((x) => x.action === 'agent_session').response_payload.state;
  assert.equal(stored.slots.relationship_intent.items[0].status, 'RETRACTED');
  assert.ok(stored.disputed.includes('어떤 사람한테 끌려요?'));
  assert.equal(s.tables.doit_records.length, 1, '항의·질문은 기록 0(첫 답만)');
});

test('지침(stop): 들은 만큼 정리하고 마침 · 저장 금지 입력: 고정 안내·원문 저장 0', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  const b = await say('제 번호 010-1234-5678 이에요');
  assert.equal(b.body.turn.kind, 'blocked'); assert.equal(s.aiCalls.length, 1, 'AI 호출 0');
  assert.ok(!JSON.stringify(s.tables).includes('010-1234-5678'), '번호 저장 0');
  s.ai.push(T({ kind: 'stop', reply: '여기까지 할게요.' }), { summary: [], closing: '들은 만큼 정리해 둘게요.' });
  const st = await say('질문이 너무 많아 그만할래');
  assert.equal(st.body.session.phase, 'done'); assert.equal(st.body.session.progress.asked, 2);
});

test('같은 요청 재전송 → 저장된 결과 · AI 다시 안 부름 · 이번 회차에 대화가 있으면 새로 안 만듦', async () => {
  const s = newState(); const h = load(s);
  const startId = rid();
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const a = await h.call({ action: 'agent_start', requestId: startId, firstAnswer: '친구' });
  const again = await h.call({ action: 'agent_start', requestId: startId, firstAnswer: '친구' });
  assert.equal(again.body.session.id, a.body.session.id); assert.equal(again.body.existing, true);
  const turnId = rid();
  s.ai.push(T({ extracted: [X('attraction_comfort', '조용함', '조용한')], ...Q('values_character', '뭘 봐요?') }));
  const t1 = await h.call({ action: 'agent_turn', requestId: turnId, sessionId: a.body.session.id, text: '조용한 사람' });
  const calls = s.aiCalls.length;
  const t2 = await h.call({ action: 'agent_turn', requestId: turnId, sessionId: a.body.session.id, text: '조용한 사람' });
  assert.equal(t2.body.duplicate, true); assert.equal(s.aiCalls.length, calls); assert.deepEqual(t2.body.turn, t1.body.turn);
  // 처음부터 다시(회차 시각이 뒤로) → 옛 대화는 이번 회차가 아님
  s.authUser.user_metadata = { doit_round_started_at: new Date(Date.now() + 60_000).toISOString() };
  assert.equal((await h.call({ action: 'agent_get' })).body.session, null);
  s.ai.push(T({}));
  const old = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: a.body.session.id, text: '더 할래요' });
  assert.equal(old.status, 409); assert.equal(old.body.code, 'ROUND_CHANGED');
});

test('AI 실패 → 502 · 상태·기록 저장 0(다시 보낼 수 있음)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push('HTTP500');
  const r = await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구' });
  assert.equal(r.status, 502);
  assert.equal((s.tables.doit_request_events ?? []).length, 0); assert.equal((s.tables.doit_records ?? []).length, 0);
});

test('관리자: 일반 사용자 403 · 관리자는 실제 저장된 세션·턴 기록만 읽음(쓰기 0)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구' })).body.session.id;
  assert.equal((await h.call({ action: 'admin_sessions' })).status, 403);
  assert.equal((await h.call({ action: 'admin_session', sessionId: sid })).status, 403);
  s.tables.profile_photos = [{ user_id: ID.user, slot: 1, is_primary: true, storage_path: 'photos/u1/a.jpg', updated_at: '2026-09-19T00:00:00Z' }, { user_id: ID.user, slot: 2, is_primary: false, storage_path: 'photos/u1/b.jpg', updated_at: '2026-09-20T00:00:00Z' }];
  s.tables.profiles[0].verification_status = 'verified'; s.tables.profiles[0].bio = '비밀 소개 문장'; s.tables.profiles[0].phone = '01012345678';
  s.authUser = { id: ID.admin, user_metadata: {} };
  const before = JSON.stringify(s.tables);
  const list = await h.call({ action: 'admin_sessions' });
  assert.equal(list.status, 200); assert.equal(list.body.sessions.length, 1); assert.equal(list.body.sessions[0].nickname, '나');
  assert.equal(list.body.turns.length, 1); assert.equal(list.body.turns[0].record.calls[0].input_tokens, 1000);
  assert.deepEqual(JSON.parse(JSON.stringify(list.body.sessions[0].photos)), { count: 2, primary: true, last_updated_at: '2026-09-20T00:00:00Z' }, '사진은 있는 칸(장수·대표·올린 시각)만');
  assert.ok(!JSON.stringify(list.body).includes('storage_path') && !JSON.stringify(list.body).includes('photos/u1'), '사진 파일 주소 0');
  // MASTER §20: 연결 준비 부족 조건은 참·거짓만(전화번호·소개 글 0)
  assert.deepEqual(JSON.parse(JSON.stringify(list.body.sessions[0].readiness)), { phone_verified: true, intro_saved: true });
  assert.ok(!JSON.stringify(list.body).includes('비밀 소개 문장') && !JSON.stringify(list.body).includes('01012345678'), '소개 글·번호 0');
  const one = await h.call({ action: 'admin_session', sessionId: sid });
  assert.equal(one.body.session.stored.state.turns[0].user, '친구');
  assert.equal(JSON.stringify(s.tables), before, '관리자 읽기는 쓰기 0');
});

test('소스 규칙: 호출 주소 고정 · 모델은 기존 resolveModel · 새 Secret 이름 0 · 원문 로그 0', () => {
  const src = readFileSync(new URL('index.ts', DIR), 'utf8');
  assert.match(src, /const OPENAI_URL = "https:\/\/api\.openai\.com\/v1\/chat\/completions";/);
  assert.ok(!/Deno\.env\.get\("OPENAI_URL/.test(src));
  const envs = [...src.matchAll(/Deno\.env\.get\("([A-Z_]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(envs)], ['CORS_ALLOWED_ORIGINS', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']);
  for (const m of src.matchAll(/logDiag\(\{([^}]*)\}/g)) assert.ok(!/\btext\b(?!4)|user_raw|original/.test(m[1].replace(/text4/g, '')), `로그에 원문 칸 없음: ${m[1]}`);
});

// 운영 실측(2026-09-25 대표 Galaxy)과 같은 모양 — 문장은 합성(대표 원문 아님). 다섯 번째 답이 ask 로 읽혀 같은 질문이 다시 보였고,
// 「아까 말했는데」 뒤 그 답이 되살아나지 않은 채 끝났다. v1.3: 앞선 말에서 되살리고 · 같은 질문을 두 번 다시 보이지 않고 · 항의 문장은 답으로 남기지 않는다.
test('기억: 「아까 말했는데」 → 앞선 말에서 되살림 · 항의 문장 저장 0 · 앞선 말은 기록으로 · 같은 질문 재노출 1회까지', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '연애', '연애로')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '연애로 이어질 만남' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.ai.push(T({ extracted: [], ...Q('values_character', '사람 볼 때 뭘 봐요?') })); // 막연한 답을 AI 가 놓침
  const r2 = await say('그냥 편한 사람');
  // v1.9(대표 2026-09-25 실기기): AI 가 놓쳐도 질문에 한 답은 원문 그대로 그 자리에서 남는다
  assert.equal(r2.body.turn.saved, true);
  const st2 = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  assert.deepEqual(st2.slots.attraction_comfort.items.map((i) => [i.quote, i.source]), [['그냥 편한 사람', 'answer_raw']]);
  s.ai.push(T({ extracted: [X('values_character', '성격', '성격')], ...Q('relationship_style', '어떻게 알아가는 게 좋아요?') }));
  await say('성격');
  s.ai.push(T({ extracted: [X('relationship_style', '자연스럽게', '자연스럽게')], ...Q('boundaries', '꼭 있었으면 하는 건 뭐예요?') }));
  await say('자연스럽게');
  // 다섯 번째: 바람을 말했는데 AI 가 ask 로 읽음 → 같은 질문 한 번 다시(먼저 답하기)
  s.ai.push(T({ kind: 'ask', reply: '네.', extracted: [], next: { type: 'core', purpose: 'boundaries', question: '꼭 있었으면 하는 건 뭐예요?' } }));
  const k5 = await say('외모도 좀 받쳐줬으면 해');
  assert.equal(k5.body.turn.question, '꼭 있었으면 하는 건 뭐예요?');
  // 「아까 말했는데」: AI 가 앞선 말에서 두 목적을 되살림 · 이번 말 자체에서 뽑은 척한 인용은 이번 말에 없으니 받지 않음
  s.ai.push(T({ kind: 'repair', reply: '맞아요, 외모도 받쳐줬으면 한다고 하셨죠.', extracted: [X('boundaries', '외모도 어느 정도', '외모도 좀 받쳐줬으면'), X('attraction_comfort', '편한 사람', '편한 사람'), X('boundaries', '지어낸 말', '돈 많은 사람')] }),
    { summary: [], closing: '이제 조금 알 것 같아요.' });
  const r6 = await say('아까 말했는데');
  const p = r6.body.session.profile;
  assert.equal(p.boundaries.status, 'CONFIRMED'); assert.equal(p.boundaries.items.length, 1); assert.equal(p.boundaries.items[0].quote, '외모도 좀 받쳐줬으면');
  assert.equal(p.attraction_comfort.status, 'CONFIRMED', '앞서 놓친 막연한 답은 그때 원문으로 남아 있다');
  assert.equal(p.attraction_comfort.items.length, 1, '되살린 「편한 사람」은 이미 남은 원문과 같은 말이라 겹쳐 넣지 않는다');
  assert.equal(r6.body.turn.saved, false, '항의 문장은 답으로 저장 0');
  assert.equal(r6.body.turn.question, null); assert.equal(r6.body.session.phase, 'done');
  const texts = s.tables.doit_records.map((r) => r.text);
  assert.ok(texts.includes('외모도 좀 받쳐줬으면 해') && texts.includes('그냥 편한 사람'), '되살린 앞선 말은 기록으로');
  assert.ok(!texts.includes('아까 말했는데'), '항의 문장은 기록 0');
  const st = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  const t6 = st.turns.at(-1);
  assert.deepEqual([...t6.recovered].sort(), ['boundaries']); assert.deepEqual([...t6.recovered_from].sort(), [5]);
  const rec = s.tables.doit_request_events.filter((r) => r.action === 'agent_turn').at(-1).response_payload.record;
  assert.deepEqual([...rec.recovered].sort(), ['boundaries']);
  // 같은 요청을 다시 보내도 기록이 늘지 않는다
  assert.equal(s.tables.doit_records.length, new Set(s.tables.doit_records.map((r) => r.request_id)).size);
  // 관리자 후보: 다시 보인 질문 뒤 항의 = ALREADY_ANSWERED_REASK, 되살림 = MEMORY_RECOVERED
  s.authUser = { id: ID.admin, user_metadata: {} };
  const adm = await h.call({ action: 'admin_sessions' });
  assert.equal(adm.status, 200);
});

test('같은 질문 재노출은 질문마다 한 번뿐 · 이미 한 질문과 같은 새 질문은 다시 청함', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.ai.push(T({ kind: 'ask', reply: '다섯 개까지만 물어요.', next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이 편해요?' } }));
  assert.equal((await say('몇 개 물어봐요?')).body.turn.question, '어떤 사람이 편해요?');
  // 두 번째 ask: 같은 질문을 또 내면 서버가 다시 청하고(asked_before), 두 번째 답의 새 질문을 쓴다
  s.ai.push(T({ kind: 'ask', reply: '저장은 대화 안에서만 써요.', next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이 편해요?' } }));
  s.ai.push(T({ kind: 'ask', reply: '저장은 대화 안에서만 써요.', ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const r = await say('저장돼요?');
  assert.equal(r.body.turn.question, '사람 볼 때 뭘 먼저 봐요?');
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn').at(-1).response_payload.record;
  assert.ok(rec.retry.includes('asked_before'));
  const shown = r.body.session.messages.filter((m) => m.text === '어떤 사람이 편해요?').length;
  assert.ok(shown <= 2, `같은 질문 화면 노출 ${shown}번(처음 + 먼저 답하기 1번)`);
});

// 실제 외부 사용자 피드백(2026-09-25 「질문이 좀 모호한거 같네 … 예시같은게 있어도 좋을것 같구」) — 가짜 AI 기준.
test('「예를 들면?」(help): 저장 0 · 질문 수 0 · 같은 목적을 더 쉽게 다시 · 질문마다 2번까지 · 예시 한 줄(형식만 확인)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이랑 있으면 편해요?', hint: '예: 말투, 연락 방식, 취미처럼요.' } }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구 만나고 싶어요' });
  const sid = start.body.session.id;
  assert.equal(start.body.session.current_hint, '예: 말투, 연락 방식, 취미처럼요.');
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  // 1번째 help: 쉬운 같은 목적 질문 · 새 예시
  s.ai.push(T({ kind: 'help', reply: '편하다고 느끼는 사람의 모습을 말하면 돼요. 예를 들면 말투나 연락하는 방식 같은 거예요.', extracted: [X('attraction_comfort', '지어낸', '예를 들면')], next: { type: 'core', purpose: 'attraction_comfort', question: '같이 있으면 마음이 놓이는 사람은 어떤 사람이에요?', hint: '예: 말이 잘 통함, 조용함처럼요.' } }));
  const r1 = await say('예를 들면?');
  assert.equal(r1.body.turn.saved, false, 'help 는 저장 0'); assert.equal(r1.body.session.progress.asked, 2, '질문 수 그대로');
  assert.equal(r1.body.turn.question, '같이 있으면 마음이 놓이는 사람은 어떤 사람이에요?');
  assert.equal(r1.body.session.current_hint, '예: 말이 잘 통함, 조용함처럼요.');
  // 형식에 안 맞는 예시(물음표·너무 김)는 버리고 앞 예시를 둔다
  s.ai.push(T({ kind: 'help', reply: '편한 사람의 특징이면 뭐든 괜찮아요.', next: { type: 'core', purpose: 'attraction_comfort', question: '편한 사람 하면 누가 떠올라요?', hint: '예를 들어 이렇게 답해 보면 어떨까요? 배려심 있고 연락 잘하는 사람이요' } }));
  const r2 = await say('무슨 뜻이야?');
  assert.equal(r2.body.session.progress.asked, 2); assert.equal(r2.body.session.current_hint, '예: 말이 잘 통함, 조용함처럼요.');
  // 3번째 help: 한도(2) → 같은 질문을 또 보이지 않고 다음 목적으로
  s.ai.push(T({ kind: 'help', reply: '괜찮아요, 다른 걸 물어볼게요.', next: { type: 'core', purpose: 'values_character', question: '약속 시간 잘 지키는 게 중요해요?', hint: '예: 시간 약속, 말투처럼요.' } }));
  const r3 = await say('잘 모르겠는데 무슨 말이야');
  assert.equal(r3.body.session.progress.asked, 3, '한도 뒤에는 다음 목적(질문 수 +1)'); assert.equal(r3.body.turn.question, '약속 시간 잘 지키는 게 중요해요?');
  const st = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  assert.equal(st.slots.attraction_comfort.status, 'UNKNOWN', 'help 에서 뽑은 척한 정보는 받지 않음');
  assert.ok(!s.tables.doit_records?.some((r) => /예를 들면|무슨 뜻|무슨 말/.test(r.text)), '되묻는 말은 기록 0');
  const recs = s.tables.doit_request_events.filter((r) => r.action === 'agent_turn').map((r) => r.response_payload.record);
  assert.ok(recs.slice(1, 3).every((r) => r.flags.help && r.decision === 'help_rephrase'));
  // AI 입력: 지금 질문의 help 횟수를 보인다
  assert.equal(s.aiCalls.at(-1).input.current_question.helps, 2, '세 번째 help 때 AI 는 한도에 닿았음을 본다');
  assert.equal(s.aiCalls.at(-2).input.current_question.helps, 1);
  assert.ok(!st.current.helps, '새 질문은 help 0부터');
});

test('help 에 쉬운 질문이 없으면 한 번 다시 청한다(help_question) · 질문 5개 상한 그대로', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구' })).body.session.id;
  s.ai.push(T({ kind: 'help', reply: '편한 사람 이야기를 하면 돼요.', next: { type: 'none', purpose: '', question: '' } }), T({ kind: 'help', reply: '편한 사람 이야기를 하면 돼요.', next: { type: 'core', purpose: 'attraction_comfort', question: '같이 있으면 편한 사람은 어떤 사람이에요?', hint: '' } }));
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '예를 들면?' });
  assert.equal(r.body.turn.question, '같이 있으면 편한 사람은 어떤 사람이에요?');
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn').at(-1).response_payload.record;
  assert.ok(rec.retry.includes('help_question'));
  assert.equal(r.body.session.current_hint, null, '예시가 없으면 버튼도 없다');
  assert.ok(s.aiCalls[0].system.includes('concrete') && s.aiCalls[0].system.includes('answerable') && s.aiCalls[0].system.includes('help'), '말투 기준·help 는 같은 호출의 지시에 들어 있다(심사 호출 추가 0)');
  assert.ok(s.aiCalls.every((c) => !/심사|judge/i.test(c.system.slice(0, 40))));
});


// ── v1.6(2026-09-25 대표 MASTER §2·§4): 밝고 가벼운 말투 지침 · 대화를 마칠 때 같은 호출에서 소개 초안 · 다시 쓰기 · 고른 것 기록.
async function finishedSession(s, h, closingOut) {
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '편하게')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  const sid = start.body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.ai.push(T({ kind: 'stop' }), closingOut);
  const end = await say('오늘은 여기까지 할게요');
  return { sid, end };
}

test('v1.6 말투: 밝고 가볍게 지침 · 좋은 것/싫은 것 이름이 AI 지시에 들어간다(그대로 옮겨 쓰지 말라는 문장 포함)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구' });
  const sys = s.aiCalls[0].system; const input = s.aiCalls[0].input;
  assert.ok(sys.includes('밝고 가볍게') && sys.includes('그대로 옮겨 쓸 문장이 아니다'));
  assert.ok(input.open_purposes.some((p) => p.label === '이건 좋고 이건 싫다 싶은 것'));
});

test('v1.6 소개 초안: 마칠 때 같은 호출 · 근거(내가 친 글자) 있는 문장만 · 개인 정보·금지어 버림 · 버린 이유는 코드로만 · 로그에 원문 0', async () => {
  const s = newState(); const h = load(s);
  const { end } = await finishedSession(s, h, { summary: [], closing: '이제 조금 알 것 같아요.', intro: [
    { text: '저는 편하게 만날 수 있는 친구를 찾고 있어요.', basis: '편하게' },
    { text: '저는 요리를 아주 잘해요.', basis: '요리' },                // 근거 없음(말한 적 없음)
    { text: '연락은 010-1234-5678 로 주세요.', basis: '편하게' },       // 개인 정보
    { text: '소개팅 말고 편한 만남이 좋아요.', basis: '편하게' },        // 쓰지 않는 단어
  ] });
  assert.equal(s.aiCalls.at(-1).system.includes('intro'), true);
  assert.equal(s.aiCalls.filter((c) => c.system.includes('소개 초안')).length, 1, '마칠 때 AI 1번(추가 호출 0)');
  assert.ok(s.aiCalls.at(-1).input.heard.every((x) => typeof x.quote === 'string'), '근거 확인용 원문 인용이 들어간다');
  const intro = end.body.session.intro;
  assert.equal(intro.status, 'ready'); assert.deepEqual(intro.lines, ['저는 편하게 만날 수 있는 친구를 찾고 있어요.']);
  assert.equal(intro.text, '저는 편하게 만날 수 있는 친구를 찾고 있어요.'); assert.equal(intro.tries_left, 2); assert.equal(intro.used, null);
  const stored = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state.intro;
  assert.deepEqual(stored.dropped, { no_basis: 1, private_data: 1, banned_word: 1 });
  const log = h.logs.map((l) => JSON.parse(l)).find((l) => l.step === 'turn' && l.intro);
  assert.equal(log.intro, 'ready'); assert.equal(log.intro_lines, 1); assert.deepEqual(log.intro_dropped, { no_basis: 1, private_data: 1, banned_word: 1 });
  assert.ok(!h.logs.some((l) => /요리|010-1234|편하게 만날/.test(l)), '로그에 문장 원문 0');
});

test('v1.6 소개 다시 쓰기: 대화 중 409 · 실패 → 다시 쓰기 AI 1번 · 3번 상한 뒤 AI 0 · 들은 말 없으면 none(AI 0) · 고른 것 기록', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '편하게')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  const sid = start.body.session.id;
  assert.equal((await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid })).status, 409, '대화 중에는 쓰지 않는다');
  s.ai.push(T({ kind: 'stop' }), { summary: [], closing: '고마워요.', intro: [{ text: '저는 요리를 잘해요.', basis: '요리' }] });
  const end = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '그만할래요' });
  assert.equal(end.body.session.intro.status, 'failed'); assert.equal(end.body.session.intro.text, '');
  const n0 = s.aiCalls.length;
  s.ai.push({ intro: [{ text: '저는 편하게 만나는 사이가 좋아요.', basis: '편하게 만나고' }] });
  const r1 = await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid });
  assert.equal(r1.status, 200); assert.equal(s.aiCalls.length, n0 + 1); assert.equal(r1.body.session.intro.status, 'ready'); assert.equal(r1.body.session.intro.tries_left, 1);
  s.ai.push('HTTP500');
  const r2 = await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid });
  assert.equal(r2.body.session.intro.status, 'failed'); assert.equal(r2.body.session.intro.tries_left, 0);
  const r3 = await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid });
  assert.equal(r3.body.limited, true); assert.equal(s.aiCalls.length, n0 + 2, '상한 뒤 AI 0');
  assert.equal((await h.call({ action: 'agent_intro_mark', requestId: rid(), sessionId: sid, how: 'hack' })).status, 400);
  const m = await h.call({ action: 'agent_intro_mark', requestId: rid(), sessionId: sid, how: 'own' });
  assert.equal(m.body.session.intro.used, 'own');
  const st = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state.intro;
  assert.equal(st.used, 'own'); assert.ok(st.used_at);
  assert.equal(s.tables.doit_request_events.filter((r) => r.action === 'agent_turn').length, 2, '소개 동작은 턴 기록을 만들지 않는다');

  // 들은 말이 없는 대화: 소개를 쓰지 않는다(AI 0).
  const s2 = newState(); const h2 = load(s2);
  s2.ai.push(T({ kind: 'skip', ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const st2 = await h2.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '음' });
  s2.ai.push(T({ kind: 'stop' }), { summary: [], closing: '고마워요.', intro: [] });
  const e2 = await h2.call({ action: 'agent_turn', requestId: rid(), sessionId: st2.body.session.id, text: '그만' });
  assert.equal(e2.body.session.intro.status, 'none');
  const k = s2.aiCalls.length;
  const again = await h2.call({ action: 'agent_intro', requestId: rid(), sessionId: st2.body.session.id });
  assert.equal(again.body.session.intro.status, 'none'); assert.equal(s2.aiCalls.length, k, '재료가 없으면 AI 를 부르지 않는다');
});

test('v1.9 대표 실기기 재현(2026-09-25): AI 가 놓친 답은 원문으로 · 항의+새 이야기는 새 이야기 저장 · 「모르겠어요」는 저장 0', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '깊은 대화', '깊은 대화부터')], ...Q('attraction_comfort', '같이 있으면 편하고 끌리는 사람은 어떤 사람일까요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '깊은 대화부터 시작하고 싶어요' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  const state = () => s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  // ① 운영 실측: 답인데 AI 가 아무것도 못 뽑음 → 원문 그대로 그 질문의 답
  s.ai.push(T({ extracted: [], ...Q('values_character', '사람을 만날 때 가장 먼저 어떤 점을 보나요?') }));
  assert.equal((await say('능력이좀 있는사람')).body.turn.saved, true);
  assert.deepEqual(state().slots.attraction_comfort.items.map((i) => i.quote), ['능력이좀 있는사람']);
  s.ai.push(T({ extracted: [X('values_character', '능력 있는 사람', '능력이 있는 사람')], ...Q('relationship_style', '연락은 자주 하는 편인가요?') }));
  await say('능력이 있는 사람 내가 지금 능력이 없었기 때문에');
  // ② 항의 + 새 이야기: 새 이야기(이번 말에 실제로 있는 글자)는 저장 · 항의 문장 원문 저장 0
  s.ai.push(T({ kind: 'repair', reply: '네, 아까 말씀하셨죠.', extracted: [X('relationship_style', '연락 자주', '연락은 자주하는 편')], ...Q('boundaries', '이건 좋고 이건 싫다 싶은 게 있나요?') }));
  const r4 = await say('아까 내가 능력이없기때문이라고 말했고 연락은 자주하는 편이야');
  assert.equal(r4.body.turn.saved, true);
  assert.deepEqual(state().slots.relationship_style.items.map((i) => i.quote), ['연락은 자주하는 편']);
  // ③ 「모르겠어요」류 짧은 말은 원문 저장 0(아직 몰라요로 남는다)
  s.ai.push(T({ extracted: [], next: { type: 'none', purpose: '', question: '' } }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  const r5 = await say('딱히 없는 것 같아요.'); // AI 가 answer 로 잘못 읽어도 원문 저장 0
  assert.equal(r5.body.turn.saved, false);
  const p = r5.body.session.profile;
  assert.equal(p.attraction_comfort.status, 'CONFIRMED'); assert.equal(p.relationship_style.status, 'CONFIRMED');
  assert.notEqual(p.boundaries.status, 'CONFIRMED', '모르겠다는 답은 채운 척하지 않는다');
});

test('v1.9 AI 지시: 받아주기에서 이유를 되묻지 않는다 · 항의에 섞인 새 이야기도 뽑는다', () => {
  const src = readFileSync(new URL('agent.ts', DIR), 'utf8');
  assert.match(src, /reply 에서 이유·설명을 되묻지 않는다/);
  assert.match(src, /항의와 함께 지금 질문에 대한 새 이야기가 있으면/);
  assert.match(src, /const FROM_LATEST = new Set<Kind>\(\["answer", "correction", "ask", "repair"\]\);/);
});
