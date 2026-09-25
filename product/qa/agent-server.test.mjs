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
  s.authUser = { id: ID.admin, user_metadata: {} };
  const before = JSON.stringify(s.tables);
  const list = await h.call({ action: 'admin_sessions' });
  assert.equal(list.status, 200); assert.equal(list.body.sessions.length, 1); assert.equal(list.body.sessions[0].nickname, '나');
  assert.equal(list.body.turns.length, 1); assert.equal(list.body.turns[0].record.calls[0].input_tokens, 1000);
  assert.deepEqual(JSON.parse(JSON.stringify(list.body.sessions[0].photos)), { count: 2, primary: true, last_updated_at: '2026-09-20T00:00:00Z' }, '사진은 있는 칸(장수·대표·올린 시각)만');
  assert.ok(!JSON.stringify(list.body).includes('storage_path') && !JSON.stringify(list.body).includes('photos/u1'), '사진 파일 주소 0');
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
  await say('그냥 편한 사람');
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
  assert.equal(p.attraction_comfort.status, 'CONFIRMED', '앞서 놓친 막연한 답도 되살림');
  assert.equal(r6.body.turn.saved, false, '항의 문장은 답으로 저장 0');
  assert.equal(r6.body.turn.question, null); assert.equal(r6.body.session.phase, 'done');
  const texts = s.tables.doit_records.map((r) => r.text);
  assert.ok(texts.includes('외모도 좀 받쳐줬으면 해') && texts.includes('그냥 편한 사람'), '되살린 앞선 말은 기록으로');
  assert.ok(!texts.includes('아까 말했는데'), '항의 문장은 기록 0');
  const st = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  const t6 = st.turns.at(-1);
  assert.deepEqual([...t6.recovered].sort(), ['attraction_comfort', 'boundaries']); assert.deepEqual([...t6.recovered_from].sort(), [2, 5]);
  const rec = s.tables.doit_request_events.filter((r) => r.action === 'agent_turn').at(-1).response_payload.record;
  assert.deepEqual([...rec.recovered].sort(), ['attraction_comfort', 'boundaries']);
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
