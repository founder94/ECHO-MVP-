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
      const all = rows(); return { data: all.map((r) => structuredClone(r)), error: null, count: all.length };
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
  const failureMod = { exports: {} };
  vm.runInNewContext(compile('failure-intelligence.ts'), { module: failureMod, exports: failureMod.exports, console }, { filename: 'failure-intelligence.ts' });
  // 2026-10-03 3개 제공사 통합: 모델 호출은 providers.ts(연결부) → modelRouter.ts(서버 선택 규칙). 환경 = OpenAI 키만 → 기본 정책(지금 운영 그대로).
  const provMod = { exports: {} };
  const g = { console, setTimeout, clearTimeout, AbortController, JSON, Date, Math, Number, String, Array, Object, Map, Set, Promise, Error, RegExp, TextEncoder };
  vm.runInNewContext(compile('providers.ts'), { ...g, module: provMod, exports: provMod.exports }, { filename: 'providers.ts' });
  const routerMod = { exports: {} };
  vm.runInNewContext(compile('modelRouter.ts'), { ...g, module: routerMod, exports: routerMod.exports, require: (n) => { if (n === './providers.ts') return provMod.exports; throw new Error(`Unexpected dependency ${n}`); } }, { filename: 'modelRouter.ts' });
  // 2026-10-03 실행 기록(run.ts · 순수 함수 · agent.ts 만 씀)
  const runMod = { exports: {} };
  vm.runInNewContext(compile('run.ts'), { ...g, structuredClone, module: runMod, exports: runMod.exports, require: (n) => { if (n === './agent.ts') return agentMod.exports; throw new Error(`Unexpected dependency ${n}`); } }, { filename: 'run.ts' });
  // 2026-10-05 카드 읽기 모듈(card-reading.ts · agent.ts 만 씀 · 대화 상태와 분리)
  const cardMod = { exports: {} };
  vm.runInNewContext(compile('card-reading.ts'), { ...g, module: cardMod, exports: cardMod.exports, require: (n) => { if (n === './agent.ts') return agentMod.exports; throw new Error(`Unexpected dependency ${n}`); } }, { filename: 'card-reading.ts' });
  // 2026-10-05 참고 이야기 모듈(reference-talk.ts · agent.ts 만 씀 · 저장 0)
  const refMod = { exports: {} };
  vm.runInNewContext(compile('reference-talk.ts'), { ...g, module: refMod, exports: refMod.exports, require: (n) => { if (n === './agent.ts') return agentMod.exports; throw new Error(`Unexpected dependency ${n}`); } }, { filename: 'reference-talk.ts' });
  let handler = null;
  const logs = [];
  const sandbox = {
    module: { exports: {} }, exports: {}, console: { log: (s) => logs.push(String(s)), error: (s) => logs.push(String(s)) },
    // state.env 로 요청마다 환경을 바꿀 수 있다(2026-10-03 AI_POLICY · 제공사 키 있는지 — 값은 가짜).
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: '', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's', ...(state.env ?? {}) })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; if (name === './agent.ts') return agentMod.exports; if (name === './failure-intelligence.ts') return failureMod.exports; if (name === './modelRouter.ts') return routerMod.exports; if (name === './run.ts') return runMod.exports; if (name === './card-reading.ts') return cardMod.exports; if (name === './reference-talk.ts') return refMod.exports; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (url, init) => {
      // 2026-10-03 실행 단계의 도구(연결 서버 my_candidates) — state.connect 가 정한 응답(없으면 연결 실패)
      if (String(url).endsWith('/functions/v1/doit-connect')) {
        (state.connectCalls ??= []).push({ body: JSON.parse(init.body), auth: init.headers.Authorization });
        const plan = state.connect?.length ? state.connect.shift() : 'NETWORK';
        if (plan === 'NETWORK') throw new TypeError('fetch failed');
        if (plan?.gate) await plan.gate;
        return new Response(JSON.stringify(plan.body ?? plan), { status: plan.status ?? 200 });
      }
      // 2026-10-03 3개 제공사: 주소로 제공사를 가리고, 요청 모양(system · 사용자 입력)을 한 모양으로 읽은 뒤, 응답은 그 제공사 모양으로 돌려준다.
      const prov = String(url).includes('api.anthropic.com') ? 'anthropic' : String(url).includes('generativelanguage.googleapis.com') ? 'gemini' : 'openai';
      const raw = JSON.parse(init.body);
      const body = prov === 'openai' ? raw : { model: raw.model ?? String(url).match(/models\/([^:]+):/)?.[1], temperature: raw.temperature ?? raw.generationConfig?.temperature, top_p: raw.generationConfig?.topP, max_tokens: raw.max_tokens ?? raw.generationConfig?.maxOutputTokens,
        messages: prov === 'anthropic' ? [{ content: raw.system }, { content: raw.messages[0].content }] : [{ content: raw.systemInstruction.parts[0].text }, { content: raw.contents[0].parts[0].text }] };
      (state.providerCalls ??= []).push(prov);
      const plan = state.fail?.[prov]?.length ? state.fail[prov].shift() : null; // 제공사별 가짜 사고: 'HTTP500' · 'REFUSE' · { delay } · { gate: Promise }
      if (plan?.abort) { plan.abort.abort(); throw Object.assign(new Error('aborted'), { name: 'AbortError' }); } // 사용자가 끊음(바깥 요청 신호)
      if (plan === 'HTTP500') return new Response('{}', { status: 500 });
      if (plan === 'HTTP429') return new Response('{}', { status: 429 });
      if (plan?.truncValid) { (state.aiCalls ??= []).push({ provider: prov, truncated: true }); return new Response(JSON.stringify({ model: 'gpt-4o-mini-2024-07-18', usage: { prompt_tokens: 1000, completion_tokens: 768 }, choices: [{ message: { content: JSON.stringify(plan.truncValid) }, finish_reason: 'length' }] }), { status: 200 }); }
      if (plan === 'EMPTY_USAGE') return new Response(JSON.stringify({ model: 'gpt-4o-mini-2024-07-18', usage: { prompt_tokens: 2000, completion_tokens: 10 }, choices: [{ message: { content: '' }, finish_reason: 'stop' }] }), { status: 200 });
      if (plan === 'REFUSE') return new Response(JSON.stringify(prov === 'anthropic' ? { model: 'm', stop_reason: 'refusal', content: [] } : prov === 'gemini' ? { promptFeedback: { blockReason: 'SAFETY' } } : { model: 'm', choices: [{ message: { content: null, refusal: 'no' }, finish_reason: 'stop' }] }), { status: 200 });
      if (plan?.gate) await plan.gate;
      const wrap = (text, usage) => new Response(JSON.stringify(prov === 'anthropic' ? { model: `${body.model}-served`, stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: usage[0], output_tokens: usage[1] } }
        : prov === 'gemini' ? { modelVersion: `${body.model}-served`, candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: usage[0], candidatesTokenCount: usage[1] } }
        : { model: 'gpt-4o-mini-2024-07-18', usage: { prompt_tokens: usage[0], completion_tokens: usage[1] }, choices: [{ message: { content: text } }] }), { status: 200 });
      if (plan === 'BADJSON') return wrap('{"kind": "answer", "reply": "잘', [1000, 50]); // 깨진 JSON(형식 오류) — wrap 정의 뒤
      // 2026-10-01 구조대: 보기만 따로 청하는 호출(RESCUE_PROMPT)은 대화 출력 줄(state.ai)을 쓰지 않는다 — state.rescue 줄(없으면 빈 보기)로 답하고 따로 센다.
      if (String(body.messages[0].content).startsWith('너는 대화 질문 하나에 붙일 「고르기 보기」')) {
        (state.rescueCalls ??= []).push({ input: JSON.parse(body.messages[1].content) });
        const out = state.rescue?.length ? state.rescue.shift() : { choices: [] };
        return wrap(JSON.stringify(out), [100, 10]);
      }
      state.aiCalls.push({ provider: prov, system: body.messages[0].content, input: JSON.parse(body.messages[1].content), model: body.model, params: { t: body.temperature, p: body.top_p, m: body.max_tokens } });
      // v2.4 not_anchored 재시도: 예전 테스트의 가짜 질문은 답과 글자가 안 겹치므로, 따로 줄 세우지 않았으면(strictAnchor 아님) 같은 출력을 다시 준다.
      const input = JSON.parse(body.messages[1].content);
      const why = input.previous_attempt?.why ?? '';
      let next;
      if (!state.strictAnchor && state.lastAi !== undefined && /(설문|딱딱|사람 유형|분석·요약|짧은 맞장구)/.test(why)) {
        next = structuredClone(state.lastAi);
        next.reply = '오, 그렇구나.';
        if (next.next?.question) {
          const tokens = String(input.latest ?? '').split(/[\s,.!?~…]+/).map((x) => x.replace(/[^가-힣A-Za-z]/g, '')).filter((x) => x.length >= 2);
          const anchor = tokens.find((x) => !['사람','친구','좋아','그냥','저는','나는','내가','같이'].includes(x)) ?? tokens[0] ?? '그';
          next.next = { ...next.next, question: `${anchor} 얘기하다 보면 뭐가 제일 좋아요?` };
        }
      } else {
        next = why.startsWith('next.question 이 방금 답(latest)과 이어지지 않는다') && !state.strictAnchor && state.lastAi !== undefined ? state.lastAi : state.ai.shift();
      }
      state.lastAi = next;
      if (next === undefined) throw new Error('no fake AI output left');
      if (next === 'HTTP500') return new Response('{}', { status: 500 });
      return wrap(JSON.stringify(next), [1000, 100]);
    },
    crypto: globalThis.crypto, TextEncoder, Response, AbortController, setTimeout, clearTimeout, structuredClone, Date, JSON, Math, Number, String, Array, Object, Map, Set, Promise, Error, RegExp, URL,
  };
  vm.runInNewContext(compile('index.ts'), sandbox, { filename: 'index.ts' });
  return { call: async (body, { auth = true, signal } = {}) => { const res = await handler(new Request('http://x', { method: 'POST', headers: auth ? { Authorization: 'Bearer t', 'content-type': 'application/json' } : { 'content-type': 'application/json' }, body: JSON.stringify(body), ...(signal ? { signal } : {}) })); return { status: res.status, body: await res.json() }; }, logs, agent: agentMod.exports };
}

// 2026-10-03 Codex 리뷰 P1: 실패한 턴도 시도 수·사용량을 대화 예산(run.budget)에 남긴다 → 「상태 그대로」 = 예산 밖의 모든 것(대화 상태·프로필) 그대로 + 예산은 늘기만.
// 2026-10-03 Codex 리뷰 P1(5400366786): 예산만 접는 저장도 판 번호를 올려 비교 저장 → 판 번호는 같거나 커질 뿐(되돌아가지 않음).
function sameButBudget(after, before, msg) {
  const strip = (row) => { const c = structuredClone(row); const p = c.response_payload ?? c; delete p.run; if (c.response_payload) delete c.applied_revision; return c; };
  if (after.response_payload && before.response_payload) assert.ok(after.applied_revision >= before.applied_revision, `${msg ?? ''} · 판 번호는 줄지 않음`);
  assert.deepEqual(strip(after), strip(before), msg);
  const ba = (after.response_payload ?? after).run?.budget, bb = (before.response_payload ?? before).run?.budget;
  assert.ok(ba && (!bb || ba.calls > bb.calls), `${msg ?? ''} · 실패한 시도도 예산에 누적`);
}
const T = (o) => ({ kind: 'answer', understood: '', reply: '알겠어요.', // v2.4: 「그렇군요」는 상담 말투라 서버가 다시 청한다(대표 §8)
   extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
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
  // FI-018(v2.5.6): 준비 = 사용자 출처 확정 칸 3 — AI 가 물은 칸에 말 전체를 인용한 답은 원문(USER_DIRECT)으로도 남는다
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(start.status, 200); const sid = start.body.session.id;
  assert.equal(start.body.session.progress.asked, 2);
  assert.deepEqual(start.body.session.messages.map((m) => m.role), ['ai', 'user', 'ai', 'ai']);
  assert.equal(start.body.session.messages[0].text, '어떤 만남을 원하세요?');
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  assert.equal((await say('잘 웃는 사람')).body.session.progress.asked, 3);
  s.ai.push(T({ kind: 'skip', ...Q('relationship_style', '천천히 알아가는 게 편해요?') }));
  const sk = await say('다음 질문으로 넘어가요');
  assert.equal(sk.body.turn.saved, false); assert.equal(sk.body.session.progress.asked, 4);
  s.ai.push(T({ extracted: [X('relationship_style', '천천히', '네 천천히요')], ...Q('boundaries', '피하고 싶은 게 있어요?') }));
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

test('외국인등록번호 형식은 모델 호출 전에 차단되고 저장되지 않는다 · 기존 주민등록번호 1~4 형식 보호 유지(합성 값)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '친구랑은 주로 뭐 하면서 놀아요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), firstAnswer: '친구' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  for (const id of ['900101-5123456', '9001016123456', '900101 7123456', '900101-8123456', '900101-1234567', '9001014234567', '900101 - 5123456', '９００１０１－６１２３４５６']) {
    const before = s.aiCalls.length;
    const b = await say(`제 번호는 ${id} 예요`);
    assert.equal(b.body.turn.kind, 'blocked', id); assert.equal(s.aiCalls.length, before, `${id} AI 호출 0`);
    assert.ok(!JSON.stringify(s.tables).includes(id), `${id} 저장 0`);
  }
});
test('지침(stop): 들은 만큼 정리하고 마침 · 저장 금지 입력: 고정 안내·원문 저장 0', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '친구랑은 주로 뭐 하면서 놀아요?') })); // v2.5.4: 「어떤 사람이 편해요?」는 v2.5.1 부터 사람 유형 재정의 질문(서버가 다시 청함)
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

// v2.0(2026-09-26 AI OS · Failure Intelligence): 실패한 턴도 관리자 관측용으로 기존 표에 status failed 한 줄(코드·수치만)을 남긴다.
// 대화 상태·매칭 기록은 여전히 0 이고, 같은 요청을 다시 보내면 정상으로 이어진다.
test('AI 실패 → 502 · 상태·기록 저장 0 · 실패 관측 1줄(원문 0) · 다시 보낼 수 있음', async () => {
  const s = newState(); const h = load(s);
  s.ai.push('HTTP500');
  const requestId = rid();
  const r = await h.call({ action: 'agent_start', requestId, firstAnswer: '친구' });
  assert.equal(r.status, 502);
  const all = s.tables.doit_request_events ?? [];
  // 2026-10-05 AI 호출 전 자리 잡기: 사용자 잠금 줄(agent_admission)·놓은 자리 줄(agent_turn_claim · failed)은 대화 기록이 아니다 → 대화·턴 기록만 본다. 자리는 놓였어야 함(처리 중으로 남지 않음)
  assert.ok(all.filter((e) => e.action === 'agent_turn_claim').every((e) => e.status === 'failed'), '시작 자리는 놓임(다시 보내면 다시 잡음)');
  const events = all.filter((e) => ['agent_session', 'agent_turn'].includes(e.action));
  assert.equal(events.filter((e) => e.status === 'applied').length, 0, '대화 상태 저장 0');
  assert.equal((s.tables.doit_records ?? []).length, 0);
  const failed = events.filter((e) => e.status === 'failed');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].action, 'agent_turn'); assert.notEqual(failed[0].request_id, requestId, '다시 보낼 요청과 부딪히지 않는 새 id');
  assert.equal(failed[0].response_payload.record.kind, 'error'); assert.equal(failed[0].response_payload.record.error, 'PROVIDER');
  assert.ok(!JSON.stringify(failed[0]).includes('친구'), '사용자 원문 0');
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const again = await h.call({ action: 'agent_start', requestId, firstAnswer: '친구' });
  assert.equal(again.status, 200, '같은 요청을 다시 보내면 이어진다');
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

test('소스 규칙: 호출 주소 고정 · 모델은 기존 resolveModel(정책 없을 때) · 환경 이름은 정해진 것만 · 원문 로그 0', () => {
  const src = readFileSync(new URL('index.ts', DIR), 'utf8');
  // 2026-10-03: 호출 주소는 providers.ts 안에 글자로 고정(환경변수로 못 바꿈) · 환경 이름은 index(서버 설정) + modelRouter(키 있는지 · 정책)만
  const prov = readFileSync(new URL('providers.ts', DIR), 'utf8');
  const router = readFileSync(new URL('modelRouter.ts', DIR), 'utf8');
  assert.match(prov, /"https:\/\/api\.openai\.com\/v1\/chat\/completions"/);
  assert.match(prov, /"https:\/\/api\.anthropic\.com\/v1\/messages"/);
  assert.match(prov, /`https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/\$\{encodeURIComponent\(req\.model\)\}:generateContent`/);
  assert.ok(!/Deno\.env|_URL"\)/.test(prov), '연결부는 환경을 읽지 않는다');
  assert.ok(!/Deno\.env/.test(router), '라우터는 넘겨받은 get 으로만 읽는다');
  assert.deepEqual([...new Set([...router.matchAll(/get\("([A-Z_]+)"\)/g)].map((m) => m[1]))].sort(), ['AI_POLICY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL']);
  assert.match(src, /routerFromEnv\(\(k\) => Deno\.env\.get\(k\), A\.AGENT_PARAMS, AI_HEALTH, fetch, resolveModel, signal\)/);
  assert.match(src, /routerForRequest\(req\.signal\)/, '사용자 요청이 끊기면 모델 호출도 끊음');
  const envs = [...src.matchAll(/Deno\.env\.get\("([A-Z_]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(envs)], ['CORS_ALLOWED_ORIGINS', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']);
  for (const m of src.matchAll(/logDiag\(\{([^}]*)\}/g)) assert.ok(!/\btext\b(?!4)|user_raw|original/.test(m[1].replace(/text4/g, '')), `로그에 원문 칸 없음: ${m[1]}`);
});

// 운영 실측(2026-09-25 대표 Galaxy)과 같은 모양 — 문장은 합성(대표 원문 아님). 다섯 번째 답이 ask 로 읽혀 같은 질문이 다시 보였고,
// 「아까 말했는데」 뒤 그 답이 되살아나지 않은 채 끝났다. v1.3: 앞선 말에서 되살리고 · 같은 질문을 두 번 다시 보이지 않고 · 항의 문장은 답으로 남기지 않는다.
test('기억: 「아까 말했는데」 → 앞선 말에서 되살림 · 항의 문장 저장 0 · 앞선 말은 기록으로 · 같은 질문 재노출 1회까지', async () => {
  const s = newState(); const h = load(s);
  // FI-018(v2.5.6): 준비 = 사용자 출처 확정 칸 3 — 첫 답은 AI 가 말 전체를 인용(→ 원문도 USER_DIRECT 로 남음)
  s.ai.push(T({ extracted: [X('relationship_intent', '연애', '연애로 이어질 만남')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '연애로 이어질 만남' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.ai.push(T({ extracted: [], ...Q('values_character', '사람 볼 때 뭘 봐요?') })); // 막연한 답을 AI 가 놓침
  const r2 = await say('그냥 편한 사람');
  // v1.9(대표 2026-09-25 실기기): AI 가 놓쳐도 질문에 한 답은 원문 그대로 그 자리에서 남는다
  assert.equal(r2.body.turn.saved, true);
  const st2 = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  assert.deepEqual(st2.slots.attraction_comfort.items.map((i) => [i.quote, i.source]), [['그냥 편한 사람', 'answer_raw']]);
  // v2.4: 답이 모이면 5개 전에 마치므로, 이 흐름(다섯 번째 질문의 되묻기·항의)을 보려고 세 번째 답은 「글쎄요」(답 0)로 둔다.
  s.ai.push(T({ kind: 'unsure', extracted: [], ...Q('relationship_style', '어떻게 알아가는 게 좋아요?') }));
  await say('글쎄요');
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
  // 관리자 후보: 다시 보인 질문 뒤 항의 = ALREADY_ANSWERED_REASK, 되살림 = PRIOR_ANSWER_REUSED
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
  // FI-018(v2.5.6): 준비 = 사용자 출처 확정 칸 3 — AI 가 물은 칸에 말 전체를 인용한 답은 원문(USER_DIRECT)으로도 남는다
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
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
  assert.ok(sys.includes('밝고 가볍게') && sys.includes('이 문장을 옮겨 쓰지 않는다'));
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
  // FI-018(v2.5.6): 준비 = 사용자 출처 확정 칸 3 — AI 가 물은 칸에 말 전체를 인용한 답은 원문(USER_DIRECT)으로도 남는다
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
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
  assert.equal(r3.body.limited, true); assert.equal(s.aiCalls.length, n0 + 3, '상한 뒤 AI 0 (v2.4.1: HTTP 500 은 한 번 다시 부름 → r2 에서 2번)');
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
  s.ai.push(T({ extracted: [X('relationship_intent', '깊은 대화', '깊은 대화부터 시작하고 싶어요')], ...Q('attraction_comfort', '같이 있으면 편하고 끌리는 사람은 어떤 사람일까요?') })); // FI-018: 말 전체 인용 → 원문도 USER_DIRECT
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '깊은 대화부터 시작하고 싶어요' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  const state = () => s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  // ① 운영 실측: 답인데 AI 가 아무것도 못 뽑음 → 원문 그대로 그 질문의 답
  s.ai.push(T({ extracted: [], ...Q('values_character', '사람을 만날 때 가장 먼저 어떤 점을 보나요?') }));
  assert.equal((await say('능력이좀 있는사람')).body.turn.saved, true);
  assert.deepEqual(state().slots.attraction_comfort.items.map((i) => i.quote), ['능력이좀 있는사람']);
  s.ai.push(T({ extracted: [X('values_character', '능력 있는 사람', '능력이 있는 사람 내가 지금 능력이 없었기 때문에')], ...Q('relationship_style', '능력 있는 사람이면 어떤 점이 제일 끌려요?') }));
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

// 2026-09-27 출시 차단 P0-3·P0-5(서버 끝까지): 화면 정정 표시(body.correction) → 정정으로 확정 · 옛 값 밀림 · 소개도 지금 상태로(옛 값 문장 0) · 예전 앱 고정 머리도 같게 · 모르는 칸은 400.
test('P0-5·P0-3 서버: 끝난 뒤 화면 정정 → 프로필·소개 최신 값 · 예전 앱 문장 머리 · 모르는 칸 400', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_style', '매일 연락', '매일 연락하는 게 좋아요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', firstAnswer: '매일 연락하는 게 좋아요' })).body.session.id;
  s.ai.push(T({ kind: 'stop', reply: '여기까지 할게요.' }), { summary: [], closing: '정리해 둘게요.', intro: [{ text: '저는 매일 연락하는 관계가 좋아요.', basis: '매일 연락하는 게 좋아요' }] });
  const done = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '여기까지 할게요' });
  assert.equal(done.body.session.phase, 'done'); assert.match(JSON.stringify(done.body.session.intro), /매일/);
  s.ai.push(T({ kind: 'answer', reply: '주말로 고쳐 둘게요.', extracted: [X('relationship_style', '주말 연락', '주말에만 연락하는 게 좋아요')] }), { stale: [] } /* v2.2.4 정정 턴 옛 항목 고르기 호출 */, { intro: [{ text: '주말에만 연락하는 게 좋아요.', basis: '주말에만 연락하는 게 좋아요' }] });
  const fix = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '주말에만 연락하는 게 좋아요', correction: { purpose: 'relationship_style' } });
  assert.equal(fix.status, 200); assert.equal(fix.body.turn.kind, 'correction', '모델이 answer 라 해도 정정');
  const stored = s.tables.doit_request_events.find((x) => x.action === 'agent_session').response_payload;
  assert.deepEqual(stored.profile.relationship_style.items.map((i) => i.note), ['주말 연락']);
  assert.ok(!/매일/.test(JSON.stringify(fix.body.session.intro?.lines ?? [])), '소개에 옛 값 0');
  assert.match(JSON.stringify(fix.body.session.intro?.lines ?? []), /주말/);
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn').at(-1).response_payload.record;
  assert.equal(rec.flags.ui_correction, true, '관리자 기록에 화면 정정 표시');
  s.ai.push(T({ kind: 'repair', reply: '천천히로 고쳐 둘게요.', extracted: [] }), { stale: [] } /* v2.2.4 정정 턴 옛 항목 고르기 호출 */, 'HTTP500');
  const legacy = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '「알아가는 방식과 속도」 부분을 고칠게요. 천천히 알아가고 싶어요' });
  assert.equal(legacy.status, 200); assert.equal(legacy.body.turn.kind, 'correction');
  const p2 = s.tables.doit_request_events.find((x) => x.action === 'agent_session').response_payload.profile;
  assert.deepEqual(p2.relationship_style.items.map((i) => i.note), ['천천히 알아가고 싶어요'], '예전 앱 머리는 떼고 사용자 말만 새 값');
  assert.ok(!/매일|주말/.test(JSON.stringify(legacy.body.session.intro?.lines ?? [])), '소개 다시 쓰기가 실패해도 옛 값 문장 0');
  const bad = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '아무거나', correction: { purpose: 'drop_table' } });
  assert.equal(bad.status, 400);
});

// ── v2.4(2026-09-28 대표 「CONVERSATION QUALITY + PURPOSE ISOLATION + SESSION SAFETY」)
test('v2.4 세션 격리: 같은 계정 · 기기 A(친구)와 기기 B(연애)는 서로 다른 세션 · 같은 목적만 이어받음 · 기기가 기억한 세션 id 로 읽음', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '편하게')], ...Q('attraction_comfort', '친구랑 뭘 같이 하는 게 제일 자연스러워요?') }));
  const a = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '친구를 만나고 싶어요', firstAnswer: '친구를 만나고 싶어요. 편하게' });
  s.ai.push(T({ extracted: [X('relationship_intent', '진지한 연애', '진지하게')], ...Q('attraction_comfort', '어떤 사람에게 마음이 가요?') }));
  const b = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'romantic', goalLabel: '연애로 이어질 만남을 원해요', firstAnswer: '연애로 이어질 만남을 원해요. 진지하게' });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.notEqual(a.body.session.id, b.body.session.id, '다른 목적 = 다른 세션');
  assert.equal(b.body.existing, undefined, '연애 기기는 친구 세션을 이어받지 않는다');
  assert.equal(a.body.session.goal, 'friend'); assert.equal(b.body.session.goal, 'romantic');
  assert.equal(b.body.session.goal_label, '연애로 이어질 만남을 원해요');
  // 같은 목적으로 다시 시작하면 그 목적 세션을 이어받는다(새로 만들지 않음 · AI 호출 0)
  const calls = s.aiCalls.length;
  const again = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구' });
  assert.equal(again.body.session.id, a.body.session.id); assert.equal(again.body.existing, true); assert.equal(s.aiCalls.length, calls);
  // 기기가 기억한 id 로 읽으면 그 세션 — 가장 최근(연애)이 아니라 친구 세션
  const getA = await h.call({ action: 'agent_get', sessionId: a.body.session.id });
  assert.equal(getA.body.session.id, a.body.session.id); assert.equal(getA.body.session.goal, 'friend');
  // 두 세션에 동시에 말해도 서로의 턴·질문이 섞이지 않는다
  s.ai.push(T({ extracted: [X('attraction_comfort', '카페에서 얘기', '카페에서 얘기하는')], ...Q('relationship_style', '카페에서 보면 오래 얘기하는 편이에요?') })); // v2.5.4: 「얼마나 자주」는 정보 종류 질문(대표 HUMAN MIRROR)
  const ta = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: a.body.session.id, text: '카페에서 얘기하는 게 좋아' });
  s.ai.push(T({ extracted: [X('attraction_comfort', '다정한 사람', '다정한')], ...Q('relationship_style', '다정한 사람이면 어떤 말에 마음이 가요?') }));
  const tb = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: b.body.session.id, text: '다정한 사람이 좋아요' });
  const aUsers = ta.body.session.messages.filter((m) => m.role === 'user').map((m) => m.text).join('|');
  const bUsers = tb.body.session.messages.filter((m) => m.role === 'user').map((m) => m.text).join('|');
  assert.ok(!aUsers.includes('다정한') && !aUsers.includes('진지하게'), aUsers);
  assert.ok(!bUsers.includes('카페') && !bUsers.includes('편하게'), bUsers);
  // AI 입력에도 각 세션의 목적만 간다
  const lastTwo = s.aiCalls.slice(-2).map((c) => c.input.session_goal.id);
  assert.deepEqual(lastTwo, ['friend', 'romantic']);
  // 모르는 목적은 거절(서버가 아는 전략만)
  assert.equal((await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'x-unknown', firstAnswer: '뭐' })).status, 400);
});

test('v2.4 목적별 칸의 뜻: 친구 ≠ 연애 ≠ 동료(알아볼 것 자체가 다름 · 단어만 바꾼 같은 틀 0) · 목적 이름이 AI 입력으로', () => {
  const A = load(newState()).agent;
  const f = A.GOALS.friend.dims, r = A.GOALS.romantic.dims, c = A.GOALS.colleague.dims;
  for (const id of ['attraction_comfort', 'values_character', 'relationship_style', 'boundaries']) {
    assert.notEqual(f[id], r[id], id); assert.notEqual(c[id], f[id], id);
    assert.notEqual(f[id].replace(/친구/g, ''), r[id].replace(/연인|연애/g, ''), `${id}: 목적 이름만 바꾼 같은 문장이 아니다`);
  }
  assert.doesNotMatch(Object.values(f).join(' '), /연애|이상형|끌리|설레|호감/);
  assert.doesNotMatch(Object.values(c).join(' '), /연애|이상형|끌리|설레|호감/);
  const st = A.newState({ goal: 'friend' }); A.seedFirstQuestion(st);
  const inp = A.turnInput(st, '편하게 만나고 싶어');
  assert.equal(inp.session_goal.id, 'friend'); assert.equal(inp.session_goal.name, '친구');
  assert.ok(inp.open_purposes.every((p) => p.label === f[p.purpose]));
  assert.deepEqual([...inp.asked_before], ['어떤 만남을 원하세요?']);
});

test('v2.4 친구 세션: 연애 말이 든 질문은 보이지 않음(재시도 사유) · 정리·소개에서도 뺌', () => {
  const A = load(newState()).agent;
  const st = A.newState({ goal: 'friend' }); A.seedFirstQuestion(st);
  const out = { kind: 'answer', understood: '', reply: '편한 친구가 좋군요.', extracted: [{ purpose: 'relationship_intent', note: '편한 친구', quote: '편한 친구' }], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: '같이 있으면 편하고 끌리는 사람은 어떤 사람이에요?' } };
  assert.equal(A.retryReason(st, out, ['attraction_comfort'], false, '편한 친구'), 'goal_residue');
  const r = A.applyTurn(st, '편한 친구', out);
  assert.equal(r.question, null, '연애 말 질문은 보이지 않는다'); assert.equal(st.turns.at(-1).dropped, 'goal_residue');
  const rom = A.newState({ goal: 'romantic' }); A.seedFirstQuestion(rom);
  assert.equal(A.goalResidue(rom, '같이 있으면 편하고 끌리는 사람은 어떤 사람이에요?'), false, '연애 세션에서는 연애 말이 맞다');
  assert.equal(A.goalResidue(rom, '편하게 지낼 친구 사이를 원하시는군요'), true, '연애 세션 정리에 친구 목적 말 0');
});

test('v2.4 「연애 질문 아니야」: 항의로(답 저장 0) · 방금 칸은 넘기고 다른 칸으로 · 같은 칸을 다시 고르면 재시도 사유', () => {
  const A = load(newState()).agent;
  const st = A.newState({ goal: 'friend' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구', { kind: 'answer', understood: '', reply: '좋아요.', extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구' }], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 친구가 편해요?' } });
  assert.equal(A.guardKind('연애 질문 아니야', 'answer').rule, 'goal_mismatch');
  assert.equal(A.guardKind('친구 얘기인데', 'correction').kind, 'repair');
  const same = { kind: 'repair', understood: '', reply: '친구 이야기로 다시 물어볼게요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: '친구랑은 뭘 같이 해요?' } };
  assert.equal(A.retryReason(st, same, ['attraction_comfort', 'values_character'], false, '연애 질문 아니야'), 'goal_axis');
  const r = A.applyTurn(st, '연애 질문 아니야', { ...same, next: { type: 'core', purpose: 'relationship_style', question: '친구는 얼마나 자주 만나는 게 좋아요?' } });
  assert.equal(r.saved, false, '항의는 답으로 저장 0');
  assert.equal(st.slots.attraction_comfort.status, 'SKIPPED', '틀린 틀로 물은 칸은 넘긴다');
  assert.equal(r.question_purpose, 'relationship_style');
});

test('v2.4 같은 뜻 다른 말 반복 차단(서버 규칙) · 「모르겠어」는 저장 0', () => {
  const A = load(newState()).agent;
  const st = A.newState({ goal: 'friend' }); A.seedFirstQuestion(st);
  const base = { understood: '', reply: '알겠어요.', inferred: [], declared: null, wrong: [] };
  A.applyTurn(st, '친구', { ...base, kind: 'answer', extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구' }], next: { type: 'core', purpose: 'attraction_comfort', question: '친구랑 주말에 뭘 같이 하고 싶어요?' } });
  const r = A.applyTurn(st, '모르겠어', { ...base, kind: 'unsure', extracted: [], next: { type: 'core', purpose: 'values_character', question: '친구랑 주말에 뭘 같이 하고 싶어요!' } });
  assert.equal(r.question, null); assert.equal(st.turns.at(-1).dropped, 'asked_similar', '문장부호만 다른 같은 질문');
  assert.equal(st.slots.attraction_comfort.items.length, 0, '「모르겠어」는 성향으로 저장 0');
  const st2 = A.newState({ goal: 'friend' }); A.seedFirstQuestion(st2);
  A.applyTurn(st2, '친구', { ...base, kind: 'answer', extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구' }], next: { type: 'core', purpose: 'attraction_comfort', question: '친구랑 주말에 뭘 같이 하고 싶어요?' } });
  const out2 = { ...base, kind: 'answer', extracted: [], next: { type: 'core', purpose: 'values_character', question: '친구랑 주말엔 뭘 같이 하고 싶어요?' } };
  assert.equal(A.retryReason(st2, out2, ['values_character'], false, '음'), 'asked_similar');
});

test('v2.4 매칭 프로필에 세션 목적(goal)이 붙는다 · 예전 세션(목적 없음)은 open', () => {
  const A = load(newState()).agent;
  assert.equal(A.matchingProfile(A.newState({ goal: 'romantic' })).goal, 'romantic');
  const old = A.newState(); delete old.goal;
  assert.equal(A.matchingProfile(old).goal, 'open');
});

test('v2.4 받아주기 정리: 상담 말투 문장 · 다음 질문을 되풀이한 문장은 뺌 · 「잘 모르겠어」에 같은 질문 되풀이 0', () => {
  const A = load(newState()).agent;
  assert.equal(A.tidyReply('그렇군요. 그럼 편하게 이어지는 게 더 중요하겠네요.', '친구는 얼마나 자주 봐요?'), '그럼 편하게 이어지는 게 더 중요하겠네요.');
  assert.equal(A.tidyReply('친구 얘기로 할게요. 친구와 어떤 활동을 함께 하고 싶으신가요.', '친구와 어떤 활동을 함께 하고 싶으신가요?'), '친구 얘기로 할게요.');
  const st = A.newState({ goal: 'romantic' }); A.seedFirstQuestion(st);
  const base = { understood: '', reply: '괜찮아요.', inferred: [], declared: null, wrong: [] };
  A.applyTurn(st, '연애', { ...base, kind: 'answer', extracted: [{ purpose: 'relationship_intent', note: '연애', quote: '연애' }], next: { type: 'core', purpose: 'values_character', question: '연애에서 어떤 가치관을 중요하게 생각하세요?' } });
  const same = { ...base, kind: 'help', extracted: [], next: { type: 'core', purpose: 'values_character', question: '연애에서 어떤 가치관을 중요하게 생각하세요?' } };
  assert.equal(A.retryReason(st, same, ['values_character'], false, '잘 모르겠어'), 'help_same');
  const r = A.applyTurn(st, '잘 모르겠어', same);
  assert.notEqual(r.question, '연애에서 어떤 가치관을 중요하게 생각하세요?', '같은 질문을 되풀이하지 않는다');
  assert.notEqual(st.slots.values_character.status, 'CONFIRMED'); assert.equal(r.saved, false);
  assert.equal(A.retryReason(st, { ...base, kind: 'answer', reply: '그런 소통 방식이 중요하군요.', extracted: [], next: { type: 'none', purpose: '', question: '' } }, [], false, '의견이 다르면 바로 얘기해요'), 'counsel_tone');
});

test('v2.4 「잘 모르겠어」를 AI 가 묻는 말(ask)로 읽어도 같은 질문을 다시 보이지 않는다(unsure · 저장 0)', () => {
  const A = load(newState()).agent;
  assert.deepEqual({ ...A.guardKind('잘 모르겠어', 'ask') }, { kind: 'unsure', rule: 'unsure_only' });
  assert.deepEqual({ ...A.guardKind('글쎄요', 'answer') }, { kind: 'unsure', rule: 'unsure_only' });
  assert.equal(A.guardKind('잘 모르겠는데 어떤 걸 말하면 돼?', 'ask').kind, 'ask');
  const st = A.newState({ goal: 'colleague' }); A.seedFirstQuestion(st);
  const base = { understood: '', reply: '괜찮아요.', inferred: [], declared: null, wrong: [] };
  A.applyTurn(st, '앱 같이 만들 사람', { ...base, kind: 'answer', extracted: [{ purpose: 'relationship_intent', note: '앱 협업', quote: '앱 같이 만들 사람' }], next: { type: 'core', purpose: 'values_character', question: '앱 개발할 때 가장 중요하게 생각하는 점은 무엇인가요?' } });
  const r = A.applyTurn(st, '잘 모르겠어', { ...base, kind: 'ask', extracted: [], next: { type: 'core', purpose: 'values_character', question: '앱 개발할 때 가장 중요하게 생각하는 점은 무엇인가요?' } });
  assert.notEqual(r.question, '앱 개발할 때 가장 중요하게 생각하는 점은 무엇인가요?'); assert.equal(r.saved, false);
});

test('v2.4 「잘 모르겠어」를 AI 가 help 로 읽거나 새 질문 없이 help 를 내도 같은 질문을 다시 보이지 않는다(실제 AI run gu)', () => {
  const A = load(newState()).agent;
  assert.deepEqual({ ...A.guardKind('잘 모르겠어', 'help') }, { kind: 'unsure', rule: 'unsure_only' });
  assert.equal(A.guardKind('어렵네', 'help').kind, 'help');
  for (const t of ['딱히 생각 안 나', '생각이 잘 안 나요', '모르겠어']) assert.equal(A.guardKind(t, 'answer').kind, 'unsure', t);
  assert.equal(A.guardKind('딱히 없어', 'answer').kind, 'answer', '「딱히 없어」는 답(피하고 싶은 게 없음)일 수 있다');
  const base = { understood: '', reply: '괜찮아요.', inferred: [], declared: null, wrong: [] };
  const Q = '일할 때 어떤 점이 가장 중요하다고 생각하세요?';
  const mk = () => { const st = A.newState({ goal: 'colleague' }); A.seedFirstQuestion(st);
    A.applyTurn(st, '사이드 프로젝트', { ...base, kind: 'answer', extracted: [{ purpose: 'relationship_intent', note: '사이드 프로젝트', quote: '사이드 프로젝트' }], next: { type: 'core', purpose: 'values_character', question: Q } }); return st; };
  const st1 = mk();
  const r1 = A.applyTurn(st1, '잘 모르겠어', { ...base, kind: 'help', extracted: [], next: { type: 'core', purpose: 'values_character', question: Q } });
  assert.notEqual(r1.question, Q); assert.equal(r1.saved, false);
  // 「어렵네」에 AI 가 다시 물을 문장을 안 줬거나 다른 목적 질문을 줬으면 지금 질문을 그대로 되풀이하지 않는다.
  for (const next of [{ type: 'core', purpose: 'values_character', question: '' }, { type: 'core', purpose: 'boundaries', question: '같이 일할 때 피하고 싶은 건 뭐예요?' }]) {
    const st = mk();
    const r = A.applyTurn(st, '어렵네', { ...base, kind: 'help', extracted: [], next });
    assert.notEqual(r.question, Q);
  }
});

test('v2.4 방금 답과 이어지지 않는 질문은 한 번 다시 청한다(not_anchored) · 받아주기의 마침표 질문·「~군요」는 뺀다(실제 AI run gf)', async () => {
  const s = newState(); s.strictAnchor = true; const h = load(s);
  const A = h.agent;
  assert.equal(A.anchored('술보다는 카페에서 얘기하는 게 좋아', '친구와 연락은 자주 하시나요?'), false);
  assert.equal(A.anchored('술보다는 카페에서 얘기하는 게 좋아', '깊은 얘기까지 하는 친구가 좋아요, 가볍게 웃고 떠드는 쪽이 좋아요?'), true);
  assert.equal(A.anchored('응', '아무 질문?'), true, '낱말이 적은 짧은 답은 판단하지 않는다');
  assert.equal(A.tidyReply('그럼 친구와 대화할 때 어떤 주제로 이야기하는 걸 좋아하세요. 카페가 편하시네요.', '다른 질문?'), '카페가 편하시네요.');
  assert.equal(A.tidyReply('친구에 대한 이야기군요. 친구 얘기로 할게요.', null), '친구에 대한 이야기네요. 친구 얘기로 할게요.');
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '친구랑 뭐 하면서 놀고 싶어요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구' })).body.session.id;
  s.ai.push(T({ extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('relationship_style', '친구와 연락은 자주 하시나요?') }),
    T({ extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('values_character', '카페에서 깊은 얘기까지 하는 편이에요?') })); // v2.5.4: 34자 넘는 질문은 v2.5.3 부터 다시 청함
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '술보다는 카페에서 얘기하는 게 좋아' });
  assert.equal(r.body.turn.question, '카페에서 깊은 얘기까지 하는 편이에요?');
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn').at(-1).response_payload.record;
  assert.ok(rec.retry.includes('not_anchored'));
});

test('v2.4.1 받아주기가 비지 않는다(empty_ack · 앞선 시도의 받아주기) · 「~는군요」→「~네요」 · 「~예요」 받아주기는 남긴다(실제 AI run gg)', async () => {
  const s = newState(); s.strictAnchor = true; const h = load(s); const A = h.agent;
  assert.equal(A.tidyReply('그런 소통 방식을 선호하시는군요.', null), '그런 소통 방식을 선호하시네요.');
  assert.equal(A.tidyReply('한 달에 몇 번 편하게 보는 게 좋다는 거예요.', null), '한 달에 몇 번 편하게 보는 게 좋다는 거예요.');
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '친구랑 뭐 하면서 놀고 싶어요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구' })).body.session.id;
  // 첫 시도: 받아주기는 좋지만 질문이 답과 안 이어짐 → 둘째: 질문은 이어지지만 받아주기 칸이 질문뿐 → 첫 시도의 받아주기를 쓴다
  s.ai.push(T({ reply: '카페에서 얘기하는 시간이 편한 쪽이네요.', extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('relationship_style', '친구와 연락은 자주 하시나요?') }),
    T({ reply: '카페에서 어떤 얘기를 주로 하세요?', extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('values_character', '카페에서 깊은 얘기까지 하는 편이에요?') }),
    T({ reply: '카페에서 얘기하는 시간이 편한 쪽이네요.', extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('values_character', '카페에서 깊은 얘기까지 하는 편이에요?') }));
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '술보다는 카페에서 얘기하는 게 좋아' });
  assert.equal(r.body.turn.reply, '카페에서 얘기하는 시간이 편한 쪽이네요.');
  assert.equal(r.body.turn.question, '카페에서 깊은 얘기까지 하는 편이에요?');
  const feedback = s.aiCalls.map((x) => x.input?.previous_attempt?.why ?? '').join(' ');
  assert.ok(feedback.includes('이어지지 않는다'), '다시 청할 때 걸린 이유를 알린다');
});

test('v2.4.1 받아주기가 사용자 말을 그대로 옮기면 다시 청한다(ack_copy) · 이어지지 않은 질문엔 답의 낱말을 알려 준다(실제 AI run gh)', async () => {
  const s = newState(); s.strictAnchor = true; const h = load(s); const A = h.agent;
  assert.equal(A.ackCopies('한 달에 두세 번 편하게 보는 게 좋다고 하셨네요.', '한 달에 두세 번 편하게 보는 정도가 좋아'), true);
  assert.equal(A.ackCopies('자주보다는 부담 없이 이어지는 쪽이 편하네요.', '한 달에 두세 번 편하게 보는 정도가 좋아'), false);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '친구랑 뭐 하면서 놀고 싶어요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구' })).body.session.id;
  s.ai.push(
    T({ reply: '카페에서 얘기하는 게 좋으시네요.', extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('values_character', '친구에게서 어떤 모습이 잘 맞는다고 느끼세요?') }),
    T({ reply: '같이 뭘 하기보다 얘기가 잘 통하는 시간이 편한 쪽이네요.', extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('values_character', '카페에서 얘기가 잘 통한다 싶은 친구는 어떤 사람이에요?') }),
    T({ reply: '오, 카페 좋죠.', extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('values_character', '카페에서 얘기할 때 무슨 얘기가 제일 재밌어요?') })
  );
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '카페에서 얘기하는 게 좋아' });
  assert.equal(r.body.turn.reply, '오, 카페 좋죠.');
  const why = s.aiCalls.map((x) => x.input?.previous_attempt?.why ?? '').join(' ');
  assert.ok((why.includes('거의 그대로 옮겼다') || why.includes('분석·요약')) && why.includes('카페'), why);
});

test('v2.4.1 정리·소개에 AI 질문(「~는지 궁금해요」)이 사실처럼 들어가지 않는다 · 받아주기만 따로 다시 쓰기(ack) · AI 일시 오류 1번 다시(실제 AI run gi)', async () => {
  const A = load(newState()).agent;
  const st = A.newState({ goal: 'friend' }); A.seedFirstQuestion(st);
  st.asked.push({ id: 'x', type: 'core', purpose: 'values_character', text: '친구와 깊은 얘기까지 하는 사이가 좋아요, 가볍게 웃고 떠드는 쪽이 더 좋아요?' });
  assert.equal(A.askedEcho(st, '친구와 깊은 얘기까지 하는 사이가 좋은지, 가볍게 웃고 떠드는 쪽이 더 좋은지 궁금해요.'), true);
  assert.equal(A.askedEcho(st, '카페에서 얘기하는 게 좋아요.'), false);
  // 두 번 모두 사용자 말을 옮긴 받아주기 → ack 호출 한 번으로 바꾼다
  const s = newState(); s.strictAnchor = true; const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '친구랑 뭐 하면서 놀고 싶어요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구' })).body.session.id;
  const copy = T({ reply: '카페에서 얘기하는 게 좋으시네요.', extracted: [X('attraction_comfort', '카페 대화', '카페에서 얘기')], ...Q('values_character', '카페에서 얘기할 때 무슨 얘기가 제일 재밌어요?') });
  s.ai.push(copy, copy, copy, { reply: '오, 카페 좋죠.' });
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '카페에서 얘기하는 게 좋아' });
  assert.equal(r.body.turn.reply, '오, 카페 좋죠.');
  assert.equal(r.body.turn.question, '카페에서 얘기할 때 무슨 얘기가 제일 재밌어요?');
  // AI 일시 오류(500)는 한 번 다시 불러 대화가 멈추지 않는다
  s.ai.push('HTTP500', T({ extracted: [X('values_character', '말이 잘 통함', '말이 잘 통하는')], ...Q('boundaries', '말이 잘 통해도 이건 싫다 싶은 게 있어요?') })); // v2.5.4: 34자 이내
  const r2 = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '말이 잘 통하는 사람이면 좋겠어' });
  assert.equal(r2.status, 200); assert.equal(r2.body.turn.question, '말이 잘 통해도 이건 싫다 싶은 게 있어요?');
});


test('v2.5: 이미 충분히 들은 상태면 중복 후보를 더 생성하지 않고 먼저 마친다', async () => {
  const s = newState(); const h = load(s);
  const st = h.agent.newState({ goal: 'friend' });

  // 다섯 칸의 뜻은 이미 들었지만, 실제 저장된 사용자 답은 4개뿐인 상태.
  // GF-115 준비 기준 때문에 한 번 더 유효한 답을 받아야 한다.
  for (const [i, id] of h.agent.PIDS.entries()) {
    st.slots[id].status = 'CONFIRMED';
    st.slots[id].items.push({
      note: `확정-${id}`, quote: `원문-${id}`, turn: Math.min(i + 1, 4),
      source: 'answer', status: 'CONFIRMED', source_type: 'USER_DIRECT'
    });
  }
  st.turns = [1, 2, 3, 4].map((n) => ({
    n, ai: `질문-${n}`, question_purpose: h.agent.PIDS[Math.min(n - 1, 4)],
    question_type: 'core', user: `답-${n}`, kind: 'answer', saved: true
  }));
  st.asked = [
    { type: 'core', purpose: 'relationship_intent', text: '친구랑 보통 뭐 하고 싶어요?' },
    { type: 'core', purpose: 'attraction_comfort', text: '어떤 친구와 있으면 편해요?' },
    { type: 'core', purpose: 'values_character', text: '친구를 볼 때 뭘 중요하게 봐요?' },
    { type: 'core', purpose: 'relationship_style', text: '연락은 자주 하는 게 좋아요?' },
    { type: 'core', purpose: 'boundaries', text: '친구 사이에서 싫은 건 뭐예요?' },
  ];
  st.current = st.asked.at(-1);

  const dup = T({ kind: 'answer', reply: '주말에는 쉬는 편이시네요.', ...Q('relationship_intent', '친구랑 보통 뭐 하고 싶어요?') });
  const fresh = T({ kind: 'answer', reply: '주말에는 쉬는 편이시네요.', ...Q('relationship_style', '주말에 만나면 몇 시간 정도 같이 있는 게 편해요?') });
  const outs = [dup, dup, fresh];
  let calls = 0;
  const llm = async (kind) => {
    assert.equal(kind, 'turn');
    const out = outs[calls++];
    if (!out) throw new Error('unexpected extra call');
    return JSON.stringify(out);
  };

  const r = await h.agent.runTurn(st, '저는 주말에 쉬는 편이에요', llm);
  assert.ok(calls <= 3, `후보 재생성 상한 초과: ${calls}`);
  assert.equal(r.response.finish, true, '확정 영역이 충분하면 고정 5답을 채우지 않고 종료');
  assert.equal(r.response.question, null);
});

// ── FI-018(2026-10-01 대표 「AGENT ↔ MATCHING CONTRACT」): Agent 완료 판단 = 연결 서버 대화 자격과 같은 함수(conversationReadiness).
// QA 실서버(run 36841364057 · 재현 2026-10-01): A 는 대화를 마쳤는데 사용자 출처 칸이 2개라 연결 자격 0(candidate 0) — 같은 모양을 서버 흐름으로 다시 만든다.
const fi018Done = async (h, s) => {
  s.ai.push(T({ extracted: [X('relationship_intent', '깊은 대화부터 시작하고 싶어요', '깊은 대화부터 시작하고 싶어요')], ...Q('attraction_comfort', '깊은 대화는 어떤 순간에 제일 잘 통해요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'conversation', goalLabel: '깊은 대화부터 시작하고 싶어요', firstAnswer: '깊은 대화부터 시작하고 싶어요' })).body.session.id;
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  // 두 번째 답: AI 가 물은 칸(attraction)에 원문을 넣지 않고 다른 칸(style)에 정리 → 물은 칸에는 사용자 원문
  s.ai.push(T({ extracted: [X('relationship_style', '처음엔 카페에서 한두 시간', '카페에서 한두 시간')], ...Q('values_character', '카페에서 이야기하다 보면 뭐가 제일 좋아요?') }));
  await say('처음엔 카페에서 한두 시간 편하게 이야기하고 싶어요');
  return { sid, say };
};
test('FI-018 CASE 9(Agent): QA 실패 모양(물은 칸에 AI 가 원문 그대로 정리) → 사용자 출처 3칸 · 대화 완료 = conversation_ready', async () => {
  const s = newState(); const h = load(s);
  const { say } = await fi018Done(h, s);
  // 세 번째 답: AI 가 물은 칸(values)에 말 전체를 그대로 정리(QA 실서버 A 와 같은 모양 · 예전엔 AI 출처로만 남아 자격 0)
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  const end = await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요');
  assert.equal(end.status, 200);
  const p = end.body.session.profile;
  assert.ok(p.values_character.items.some((i) => i.source_type === 'USER_DIRECT'), '물은 칸의 사용자 원문이 남는다');
  assert.ok(!p.values_character.items.some((i) => i.source_type === 'AI_EXTRACTED' && i.note === '서로 말 끊지 않고 천천히 듣는 대화가 좋아요'), '같은 글자의 AI 정리는 원문으로 대신(두 번 0)');
  assert.equal(p.readiness.confirmed_areas, 3); assert.equal(p.readiness.ready, true);
  assert.equal(end.body.session.phase, 'done');
  assert.equal(p.readiness.conversation_ready, true, '대화를 마친 사용자 = 연결 서버가 보는 대화 조건 충족');
  // 같은 프로필을 연결 서버 재료 함수가 읽어도 같은 답(SSOT)
  assert.equal(h.agent.conversationReadiness(p, end.body.session.phase).conversation_ready, true);
});
test('FI-018 CASE 3(Agent): 준비 칸이 모자라면 대화가 끝나도 conversation_ready=false(준비 미완료로 멈춤 기록)', async () => {
  const s = newState(); const h = load(s);
  const { say } = await fi018Done(h, s);
  for (const [p, q] of [['values_character', 'Q3?'], ['relationship_style', 'Q4?'], ['boundaries', 'Q5?'], ['attraction_comfort', 'Q6?']]) s.ai.push(T({ kind: 'unsure', ...Q(p, q) }));
  s.ai.push({ summary: [], closing: '오늘은 여기까지 할게요.' });
  let last;
  for (let k = 0; k < 4 && (!last || last.body.session.phase === 'talk'); k++) last = await say('잘 모르겠어요');
  const p = last.body.session.profile;
  assert.equal(last.body.session.phase, 'done');
  assert.equal(p.readiness.conversation_ready, false); assert.ok(p.readiness.confirmed_areas < 3);
  assert.ok(last.body.session.messages.length > 0);
});
test('FI-018 CASE 7: Agent 완료 뒤 서버 오류(AI 실패) → 저장된 상태·확정 프로필 그대로(훼손 0) · 다시 보낼 수 있음', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  const done = await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요');
  assert.equal(done.body.session.phase, 'done');
  const stored = () => structuredClone(s.tables.doit_request_events.find((r) => r.action === 'agent_session' && r.request_id === sid)?.response_payload ?? s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload);
  const before = stored();
  s.ai.push('HTTP500');
  const bad = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '그리고 연락은 이틀에 한 번이 좋아요' });
  assert.equal(bad.status, 502);
  sameButBudget(stored(), before, '실패한 턴은 정상 상태를 덮어쓰지 않는다');
  assert.equal(before.profile.readiness.conversation_ready, true);
});
test('FI-018 CASE 8: 같은 사용자가 다시 들어옴 → 같은 세션 · AI 다시 안 부름 · 이미 확정한 질문 다시 묻기 0', async () => {
  const s = newState(); const h = load(s);
  const { sid } = await fi018Done(h, s);
  const calls = s.aiCalls.length;
  const asked = (await h.call({ action: 'agent_get' })).body.session.messages.filter((m) => m.role === 'ai').map((m) => m.text);
  const again = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'conversation', goalLabel: '깊은 대화부터 시작하고 싶어요', firstAnswer: '깊은 대화부터 시작하고 싶어요' });
  assert.equal(again.body.session.id, sid); assert.equal(again.body.existing, true); assert.equal(s.aiCalls.length, calls);
  const now = again.body.session.messages.filter((m) => m.role === 'ai').map((m) => m.text);
  assert.deepEqual(now, asked, '다시 들어와도 같은 질문을 새로 덧붙이지 않는다');
});

// 2026-10-01 대표 「P0 QUESTION UX CONTRACT RESTORE」: 서버 전 구간(가짜 AI) — 잘 모르겠어요(구조 요청 · 턴 0) → 보기 고름(사용자 직접 답) → 뒤로 복원(previous) → 고치기(옛 보기 밀림).
test('구조대 전 구간: agent_rescue 는 턴·기록 0 · 고른 보기는 USER_DIRECT 로 기록 · previous 로 복원 · 고치면 옛 보기 0', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ reply: '좋죠.', extracted: [X('relationship_intent', '친구', '친구')], next: { type: 'core', purpose: 'relationship_style', question: '친구 만나면 처음엔 뭐 하는 게 편해요?', choices: ['조용한 카페', '같이 걷기', '잘 모르겠어요'] } }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구 만나고 싶어요' });
  const sid = start.body.session.id;
  assert.deepEqual(start.body.session.current_rescue, { options: ['조용한 카페', '같이 걷기'], symbols: ['☕', '🚶'], show: false, fallback: false }, '보기는 들고 있되 먼저 펼치지 않음 · 「잘 모르겠어요」는 보기에서 빠짐');
  assert.equal(start.body.session.current_choices, null);
  const turnsBefore = s.tables.doit_request_events.filter((r) => r.action === 'agent_turn').length; const callsBefore = s.aiCalls.length;
  const rescue = await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid });
  assert.equal(rescue.status, 200); assert.equal(rescue.body.session.current_rescue.show, true);
  assert.equal(s.aiCalls.length, callsBefore, '들고 있던 보기 → AI 호출 0');
  assert.equal(s.tables.doit_request_events.filter((r) => r.action === 'agent_turn').length, turnsBefore, '구조 요청은 턴이 아니다');
  const recordsBefore = (s.tables.doit_records ?? []).length;
  s.ai.push(T({ reply: '좋아요.', extracted: [X('boundaries', '시끄러운 곳은 싫음', '조용한 카페')], ...Q('values_character', '조용한 카페면 약속 시간도 중요해요?') }));
  const pick = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '조용한 카페', choice: '조용한 카페', rescueOpen: true });
  assert.equal(pick.status, 200, JSON.stringify(pick.body) + JSON.stringify(s.aiCalls.slice(callsBefore).map((c) => [c.system.slice(0, 30), c.input.previous_attempt?.why ?? c.input.rejected?.why ?? ''])));
  assert.equal(pick.body.turn.saved, true);
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn').at(-1).response_payload.record;
  assert.equal(rec.flags.choice, true); assert.equal(rec.guard.rule, 'choice_pick');
  assert.equal((s.tables.doit_records ?? []).length, recordsBefore + 1); assert.equal(s.tables.doit_records.at(-1).text, '조용한 카페');
  const st = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  assert.equal(st.slots.relationship_style.items.find((i) => i.source === 'choice').source_type, 'USER_DIRECT');
  assert.equal(st.slots.boundaries.items.length, 0, 'AI 정리를 얹지 않는다');
  assert.deepEqual(pick.body.session.previous, { question: '친구 만나면 처음엔 뭐 하는 게 편해요?', options: ['조용한 카페', '같이 걷기'], chosen: '조용한 카페' }, '뒤로 = 질문 · 보기 · 고른 것 복원');
  for (let k = 0; k < 3; k++) s.ai.push(T({ kind: 'correction', reply: '아, 같이 걷기요.', extracted: [], ...Q('values_character', '같이 걸으면 약속 시간도 중요해요?') }));
  const fix = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '같이 걷기', correction: { purpose: null } });
  assert.equal(fix.status, 200, JSON.stringify(fix.body));
  const st2 = s.tables.doit_request_events.find((r) => r.action === 'agent_session').response_payload.state;
  assert.equal(st2.slots.relationship_style.items.find((i) => i.source === 'choice').status, 'SUPERSEDED');
  assert.ok(st2.slots.relationship_style.items.some((i) => i.status === 'CONFIRMED' && i.note === '같이 걷기'));
});

// ── 2026-10-03 대표 「3개 AI 제공사 통합」: 서버 선택 규칙(modelRouter)을 실제 doit-agent 흐름으로 — 가짜 DB · 가짜 제공사 응답(실제 AI 호출 0 · 실제 AI 품질 판정 아님).
// 정책·모델 이름은 시험용 가짜 이름이다(실제 승인 모델 아님).
const POLICY = (o = {}) => JSON.stringify({ version: 'p-test-1', providers: { anthropic: { model: 'fake-anthropic-model', allow_user_text: true }, openai: { model: 'fake-openai-model', allow_user_text: true }, gemini: { model: 'fake-gemini-model', allow_user_text: true, enabled: true }, ...(o.providers ?? {}) },
  tasks: o.tasks ?? { default: ['anthropic', 'openai'] }, switch_on_invalid: o.switch_on_invalid ?? false, limits: { retry_wait_ms: 0, same_provider_retries: 0, ...(o.limits ?? {}) }, ...(o.circuit ? { circuit: o.circuit } : {}) });
const ENV3 = (o) => ({ AI_POLICY: POLICY(o), ANTHROPIC_API_KEY: 'k2', GEMINI_API_KEY: 'k3' });
const sessionRow = (s) => s.tables.doit_request_events.find((x) => x.action === 'agent_session');
const startWith = async (s, h, first = '연애') => {
  s.ai.push(T({ extracted: [X('relationship_intent', first, first)], ...Q('attraction_comfort', '어떤 사람한테 끌려요?') }));
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', firstAnswer: first });
  assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.session.id;
};

test('AI3 기본 정책(AI_POLICY 없음) = 지금 운영 그대로: OpenAI 하나 · 다른 제공사 호출 0 · 기록에 정책판·제공사 · 원문 0', async () => {
  const s = newState(); s.env = { ANTHROPIC_API_KEY: 'k2', GEMINI_API_KEY: 'k3' }; // 키가 있어도 정책이 없으면 쓰지 않는다
  const h = load(s);
  const sid = await startWith(s, h, '편한 친구를 만나고 싶어요');
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  assert.equal((await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '잘 웃는 사람' })).status, 200);
  assert.deepEqual([...new Set(s.providerCalls)], ['openai']);
  assert.ok(s.aiCalls.every((c) => c.model === 'gpt-4o-mini'));
  const rec = s.tables.doit_request_events.filter((r) => r.action === 'agent_turn').at(-1).response_payload.record;
  assert.equal(rec.provider, 'openai'); assert.equal(rec.ai_policy_version, 'ai-policy-default-openai'); assert.equal(rec.fallback, 0);
  assert.ok(rec.ai_calls.length >= 1 && rec.ai_calls.every((c) => c.provider === 'openai' && c.policy_version === 'ai-policy-default-openai'));
  assert.ok(!JSON.stringify(rec.ai_calls).includes('잘 웃는') && !h.logs.join('\n').includes('잘 웃는'), '호출 기록·로그에 사용자 원문 0');
});

test('AI3 전환: 첫 후보 5xx → 다음 후보(다른 제공사)로 한 번 · 결과 하나만 반영 · 기록에 fallback 이유 · 한 호출에 세 제공사 0', async () => {
  const s = newState(); s.env = ENV3(); const h = load(s);
  const sid = await startWith(s, h);
  assert.deepEqual([...new Set(s.providerCalls)], ['anthropic'], '실패가 없으면 정책 첫 후보만 불림(호출 여러 번이어도 같은 곳)');
  s.providerCalls = []; s.fail = { anthropic: ['HTTP500'] };
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '잘 웃는 사람' });
  assert.equal(r.status, 200);
  assert.deepEqual(s.providerCalls.slice(0, 2), ['anthropic', 'openai']);
  assert.ok(!s.providerCalls.includes('gemini'), '정책에 없는 제공사는 부르지 않는다');
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn').at(-1).response_payload.record;
  assert.equal(rec.provider, 'openai'); assert.ok(rec.fallback >= 1);
  assert.deepEqual(rec.ai_calls.slice(0, 2).map((c) => [c.provider, c.ok, c.error, c.reason]), [['anthropic', false, 'http_5xx', 'policy_order'], ['openai', true, null, 'fallback_from:anthropic:http_5xx']]);
  assert.equal(s.tables.doit_records.length, 2, '같은 턴 기록은 한 번만(첫 답 + 이번 답)');
  assert.equal(sessionRow(s).applied_revision, 2, '저장은 한 번(판 번호 +1)');
});

test('AI3 모두 실패 → 502 · 기존 상태·판 번호·기록 그대로 · 실패 기록은 코드만 · 다시 보내면 이어짐', async () => {
  const s = newState(); s.env = ENV3(); const h = load(s);
  const sid = await startWith(s, h);
  const before = structuredClone(sessionRow(s)); const recs = s.tables.doit_records.length;
  s.fail = { anthropic: ['HTTP500'], openai: ['HTTP500'] };
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '잘 웃는 사람이 좋아요' });
  assert.equal(r.status, 502); assert.equal(r.body.code, 'AI_ERROR');
  sameButBudget(sessionRow(s), before, '상태·판 번호 그대로');
  assert.equal(s.tables.doit_records.length, recs, '답 기록 0');
  const failed = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn' && x.status === 'failed').at(-1).response_payload.record;
  assert.deepEqual(failed.ai_calls.map((c) => [c.provider, c.error]), [['anthropic', 'http_5xx'], ['openai', 'http_5xx']]);
  assert.ok(!JSON.stringify(failed).includes('잘 웃는'), '실패 기록에 원문 0');
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람이 좋아요')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  assert.equal((await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '잘 웃는 사람이 좋아요' })).status, 200);
});

test('AI3 안전상 거절(refusal) → 다른 제공사로 돌리지 않음 · 502 · 상태 그대로', async () => {
  for (const first of ['anthropic', 'gemini', 'openai']) {
    const s = newState(); s.env = ENV3({ tasks: { default: [first, ...['anthropic', 'gemini', 'openai'].filter((x) => x !== first)] } }); const h = load(s);
    const sid = await startWith(s, h);
    const before = structuredClone(sessionRow(s));
    s.providerCalls = []; s.fail = { [first]: ['REFUSE'] };
    const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '아무 말' });
    assert.equal(r.status, 502, first);
    assert.deepEqual(s.providerCalls, [first], `${first} 거절 뒤 다른 제공사 호출 0`);
    sameButBudget(sessionRow(s), before);
    const failed = s.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1).response_payload.record;
    assert.equal(failed.ai_calls[0].error, 'refused');
  }
});

test('AI3 전달 허용(allow_user_text) 없는 제공사 · 키 없는 제공사는 부르지 않음 · 쓸 수 있는 곳이 없으면 AI_NOT_CONFIGURED(호출 0)', async () => {
  const s = newState(); s.env = { ...ENV3({ providers: { anthropic: { model: 'fake-anthropic-model', allow_user_text: false } }, tasks: { default: ['anthropic', 'gemini', 'openai'] } }), GEMINI_API_KEY: '' };
  const h = load(s);
  await startWith(s, h);
  assert.deepEqual([...new Set(s.providerCalls)], ['openai'], '허용 없는 anthropic · 키 없는 gemini 건너뜀');
  const s2 = newState(); s2.env = { ...ENV3({ providers: { anthropic: { model: 'fake-anthropic-model', allow_user_text: false } }, tasks: { default: ['anthropic'] } }) };
  const h2 = load(s2);
  const r = await h2.call({ action: 'agent_start', requestId: rid(), tone: 'polite', firstAnswer: '연애' });
  assert.equal(r.status, 500); assert.equal(r.body.code, 'AI_NOT_CONFIGURED');
  assert.equal((s2.providerCalls ?? []).length, 0);
  assert.ok(!s2.tables.doit_request_events?.length, '세션 저장 0');
});

test('AI3 정정은 제공사가 바뀌어도 이어진다: 거절한 뜻은 다음 제공사 입력의 heard 에서 빠지고 · 정정 기록은 서버 상태에 남음', async () => {
  const s = newState(); s.env = ENV3(); const h = load(s);
  const sid = await startWith(s, h, '연애'); // anthropic 이 「연애」로 정리
  const say = (text) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text });
  s.fail = { anthropic: ['HTTP500'] }; // 이번 턴은 openai 가 받음
  s.ai.push(T({ kind: 'repair', reply: '제가 잘못 짚었네요.', wrong: ['연애'], ...Q('values_character', '사람 볼 때 뭘 봐요?') }));
  assert.equal((await say('그게 아니에요')).status, 200);
  assert.equal(sessionRow(s).response_payload.state.slots.relationship_intent.items[0].status, 'RETRACTED');
  s.aiCalls = [];
  s.ai.push(T({ extracted: [X('values_character', '솔직함', '솔직한 사람')], ...Q('relationship_style', '천천히 알아가는 게 편해요?') }));
  assert.equal((await say('솔직한 사람')).status, 200);
  const next = s.aiCalls.find((c) => c.provider === 'anthropic');
  assert.ok(next, '다음 턴은 다시 정책 첫 후보(anthropic)');
  assert.ok(!next.input.heard.some((x) => x.note === '연애'), '거절한 뜻은 다른 제공사에도 확인된 정보로 넘어가지 않음');
  assert.ok(next.input.disputed.length >= 1, '문제 삼은 질문 기록이 다음 제공사 입력에도 있음');
});

test('AI3 늦게 온 응답은 더 새로운 정정을 덮지 못함(판 번호 비교 저장) — 느린 제공사 응답 → 409 · 정정 상태 유지', async () => {
  const s = newState(); s.env = ENV3(); const h = load(s);
  const sid = await startWith(s, h, '연애');
  let release; const gate = new Promise((ok) => { release = ok; });
  s.fail = { anthropic: [{ gate }] }; // 첫 요청의 anthropic 응답이 늦게 온다
  const slow = h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '연애도 괜찮고요' });
  await new Promise((ok) => setTimeout(ok, 20));
  s.ai.push(T({ kind: 'repair', reply: '제가 잘못 짚었네요.', wrong: ['연애'], ...Q('values_character', '사람 볼 때 뭘 봐요?') }));
  const fix = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '그게 아니에요' });
  assert.equal(fix.status, 200);
  const afterFix = structuredClone(sessionRow(s));
  s.ai.push(T({ extracted: [X('relationship_intent', '연애', '연애도 괜찮고요')], ...Q('values_character', '사람 볼 때 뭘 봐요?') }));
  release();
  const late = await slow;
  assert.equal(late.status, 409); assert.equal(late.body.code, 'REQUEST_CONFLICT');
  sameButBudget(sessionRow(s), afterFix, '늦은 응답은 상태 저장 0 · 다만 부른 모델 사용량은 대화 예산에(2026-10-03 자체 점검 P1)');
  assert.equal(sessionRow(s).response_payload.state.slots.relationship_intent.items[0].status, 'RETRACTED');
});

test('AI3 요청당 호출 상한: 상한에 닿으면 더 부르지 않고 502 · 상태 그대로(무한 재시도·순환 0)', async () => {
  const s = newState(); s.env = ENV3(); const h = load(s);
  const sid = await startWith(s, h);
  s.env = ENV3({ limits: { max_calls_per_request: 1 } }); // 이번 요청부터 상한 1(정책은 요청마다 읽음)
  const before = structuredClone(sessionRow(s));
  s.providerCalls = []; s.fail = { anthropic: ['HTTP500'] };
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '잘 웃는 사람' });
  assert.equal(r.status, 502);
  assert.deepEqual(s.providerCalls, ['anthropic'], '상한 1 → 전환 호출도 하지 않음');
  sameButBudget(sessionRow(s), before);
  const failed = s.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1).response_payload.record;
  assert.equal(failed.ai_calls.at(-1).error, 'budget_exceeded');
});

// ── 2026-10-03 대표 「당일 구현 마감」 대표 시나리오: 목표 → 계획 → 도구 실행 → 결과 확인 → 재계획/종료 (가짜 AI · 가짜 연결 서버 · 실제 index.ts)
const RUNSEQ = async (s, h) => {
  // 다섯 질문 흐름과 같은 순서(답이 말 전체를 인용 → 사용자 출처 확정) — 목표(romantic)부터
  s.ai.push(T({ extracted: [X('relationship_intent', '진지한 연애', '연애로 이어질 만남을 원해요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'romantic', goalLabel: '연애로 이어질 만남을 원해요', firstAnswer: '연애로 이어질 만남을 원해요' });
  assert.equal(start.status, 200, JSON.stringify(start.body));
  return start.body.session.id;
};
const lastRun = (s) => sessionRow(s).response_payload.run;
const say3 = (h, sid, text, extra = {}) => h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text, ...extra });

test('RUN 대표 시나리오: 목표 → 아는 칸 다시 안 물음 → 「그게 아니에요」 → 계획·다음 질문 변경 → 마침 → 도구(후보 조회) → 없음=보류 · 정정 후 재계획 → 찾음=완료(고르는 건 사용자)', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  let run = lastRun(s);
  assert.equal(run.goal, 'romantic'); assert.equal(run.outcome, 'needs_user'); assert.equal(run.waiting, 'answer_question');
  assert.equal(run.steps.find((x) => x.id === 'understand:relationship_intent').status, 'done', '목표에서 들은 칸 = 끝남(근거 턴)');
  assert.ok(run.steps.find((x) => x.id === 'understand:relationship_intent').basis.length >= 1);
  // 둘째 답
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  assert.equal((await say3(h, sid, '잘 웃는 사람')).status, 200);
  assert.ok(!s.aiCalls.at(-1).input.open_purposes.some((p) => p.purpose === 'relationship_intent'), '이미 아는 칸은 다시 묻는 대상에 없음');
  const revBefore = lastRun(s).plan_rev;
  // 「그게 아니에요」: 방금 정리한 뜻을 거둠 → 그 칸 단계 무효 · 계획 판 올라감 · 다음 AI 입력에서 그 칸이 다시 물을 대상
  s.ai.push(T({ kind: 'repair', reply: '제가 잘못 짚었네요.', wrong: ['잘 웃는 사람'], ...Q('relationship_style', '천천히 알아가는 게 편해요?') }));
  const fix = await say3(h, sid, '그게 아니에요');
  assert.equal(fix.status, 200); assert.equal(fix.body.turn.saved, false);
  run = lastRun(s);
  assert.equal(run.steps.find((x) => x.id === 'understand:attraction_comfort').status, 'invalid', '정정 → 그 칸 단계 무효');
  assert.ok(run.plan_rev > revBefore); assert.ok(run.changes.some((c) => c.includes('understand:attraction_comfort:done>invalid')));
  s.ai.push(T({ extracted: [X('attraction_comfort', '조용히 들어주는 사람', '조용히 들어주는 사람')], ...Q('boundaries', '피하고 싶은 게 있어요?') }));
  assert.equal((await say3(h, sid, '조용히 들어주는 사람')).status, 200);
  const inp = s.aiCalls.filter((c) => c.input?.latest === '조용히 들어주는 사람')[0].input;
  assert.ok(inp.disputed.length >= 1, '다음 AI 입력에 문제 삼은 질문이 실림(같은 해석을 다시 내지 않게)');
  // (기존 규칙: 거둔 칸은 정보가 모자랄 때만 채우기 질문으로 다시 묻는다 — 이번 변경으로 바꾸지 않음)
  assert.ok(!inp.heard.some((x) => x.note === '잘 웃는 사람'), '거절한 뜻은 확인 정보로 넘어가지 않음');
  // 다른 질문 자리에서 AI 가 정리한 말(AI_EXTRACTED)만으로는 그 칸을 다시 「끝남」으로 치지 않는다(모델 응답 하나로 확정 0) → 무효 유지 · 계획에 남음
  assert.equal(lastRun(s).steps.find((x) => x.id === 'understand:attraction_comfort').status, 'invalid');
  // 남은 칸 → 마침
  // 다섯 번째 답 → 사용자 출처 확정 칸 3(목적·관계 방식·피하고 싶은 것)으로 준비됨 → 마침. 거둔 칸은 무효로 남고 매칭 재료에서 빠진다.
  s.ai.push(T({ extracted: [X('boundaries', '거짓말 싫음', '거짓말하는 사람은 싫어요')], ...Q('attraction_comfort', '같이 있을 때 편했던 사람은 어떤 사람이었어요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  const end = await say3(h, sid, '거짓말하는 사람은 싫어요');
  assert.equal(end.body.session.phase, 'done');
  assert.equal(lastRun(s).steps.find((x) => x.id === 'understand:attraction_comfort').status, 'invalid', '거둔 칸 = 끝까지 무효(다른 자리 AI 정리로 되살리지 않음)');
  const prof = sessionRow(s).response_payload.profile;
  assert.ok(!prof.confirmed_preferences.includes('잘 웃는 사람'), '거절한 뜻은 프로필 확정 정보에 없음');
  assert.ok(prof.rejected_meanings.includes('잘 웃는 사람'));
  assert.ok(!h.agent.conversationReadiness(prof, 'done').confirmed.includes('잘 웃는 사람'), '연결 서버가 쓰는 같은 판정(conversationReadiness)의 확정 목록에도 없음');
  run = lastRun(s);
  assert.equal(run.steps.find((x) => x.id === 'tool:readiness').status, 'done', JSON.stringify(run.steps));
  assert.equal(run.outcome, 'in_progress'); assert.equal(end.body.session.run.next, 'run');
  // 도구 실행 ①: 후보 없음 → 보류(조회 실패와 구분) · 같은 요청 재전송 = 저장된 결과(도구 다시 안 부름)
  s.connect = [{ ok: true, eligible: true, missing: [], candidates: [] }];
  const rq = rid(); const aiBefore = s.aiCalls.length;
  const r1 = await h.call({ action: 'agent_run', requestId: rq, sessionId: sid });
  assert.equal(r1.status, 200); assert.equal(r1.body.tool.outcome, 'none'); assert.equal(r1.body.run.outcome, 'on_hold'); assert.equal(r1.body.run.waiting, 'no_candidates_yet');
  assert.equal(s.aiCalls.length, aiBefore, '실행 단계는 모델 호출 0');
  assert.deepEqual(s.connectCalls.map((c) => [c.body.action, c.auth]), [['my_candidates', 'Bearer t']], '허용 도구 하나 · 사용자 본인 토큰');
  const dup = await h.call({ action: 'agent_run', requestId: rq, sessionId: sid });
  assert.equal(dup.body.duplicate, true); assert.equal(s.connectCalls.length, 1, '같은 요청 = 도구 다시 실행 0');
  const again = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(again.body.tool, null, '결과가 그대로 유효하면(확정 정보 같음) 다시 조회하지 않음'); assert.equal(s.connectCalls.length, 1);
  // 끝난 뒤 정정 → 확정 정보 바뀜 → 도구 결과 무효 → 재계획 → 다시 조회 → 찾음 = 완료(후보 id·이유는 상태에 없음)
  s.ai.push(T({ kind: 'correction', reply: '고친 뜻으로 둘게요.', extracted: [X('boundaries', '약속 어기는 것', '약속 어기는 게 더 싫어요')] }));
  await say3(h, sid, '거짓말보다 약속 어기는 게 더 싫어요');
  run = lastRun(s);
  assert.equal(run.steps.find((x) => x.id === 'tool:candidates').status, 'invalid'); assert.equal(run.outcome, 'in_progress');
  s.connect = [{ ok: true, eligible: true, candidates: [{ id: 'cand-secret-1', reasons: ['비밀 이유'] }, { id: 'cand-secret-2' }] }];
  const r2 = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(r2.body.tool.outcome, 'found'); assert.equal(r2.body.tool.count, 2);
  assert.equal(r2.body.run.outcome, 'done'); assert.equal(r2.body.run.next, 'open_candidates', '다음 = 사용자가 직접 후보를 봄');
  const blob = JSON.stringify(sessionRow(s)) + JSON.stringify(s.tables.doit_request_events.filter((x) => x.action === 'agent_run'));
  assert.ok(!blob.includes('cand-secret') && !blob.includes('비밀 이유'), '후보 id·이유 글을 Agent 기록에 넣지 않음');
  assert.ok(!h.logs.join('\n').includes('cand-secret'));
});

test('RUN 결과 구분: 준비 부족(사진 등) = 질문 · 조회 실패 = 보류(성공 주장 0) · 실패 직후 재시도 간격 · 늦은 도구 결과는 정정에 밀려 버림', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  for (const [p, np, q, a] of [['attraction_comfort', 'values_character', '사람 볼 때 뭘 먼저 봐요?', '잘 웃는 사람'], ['values_character', 'relationship_style', '천천히 알아가는 게 편해요?', '솔직한 사람'], ['relationship_style', 'boundaries', '피하고 싶은 게 있어요?', '네 천천히요']]) {
    s.ai.push(T({ extracted: [X(p, a, a)], ...Q(np, q) })); assert.equal((await say3(h, sid, a)).status, 200);
  }
  s.ai.push(T({ extracted: [X('boundaries', '거짓말', '거짓말은 싫어요')] }), { summary: [], closing: '고마워요.' });
  assert.equal((await say3(h, sid, '거짓말은 싫어요')).body.session.phase, 'done');
  // 조회 실패(연결 끊김) → 보류 · lookup_failed · 바로 다시 → 쉬는 중(도구 호출 0)
  s.connect = ['NETWORK'];
  const f = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(f.body.tool.outcome, 'failed'); assert.equal(f.body.tool.code, 'network'); assert.equal(f.body.run.outcome, 'on_hold'); assert.equal(f.body.run.waiting, 'lookup_failed');
  const cool = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(cool.body.tool, null); assert.equal(s.connectCalls.length, 1, '실패 직후 재시도 간격');
  // 서버 오류(500) 도 실패 · 준비 부족은 질문(무엇이 부족한지 코드만)
  const row = sessionRow(s); row.response_payload.run.tools.at(-1).at = new Date(Date.now() - 60_000).toISOString(); // 간격이 지났다고 둠
  s.connect = [{ status: 500, body: { ok: false, code: 'ERROR' } }];
  const e = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(e.body.tool.outcome, 'failed'); assert.equal(e.body.tool.code, 'http_500:ERROR');
  sessionRow(s).response_payload.run.tools.at(-1).at = new Date(Date.now() - 60_000).toISOString();
  s.connect = [{ ok: true, eligible: false, missing: ['photo', 'intro_confirmed'], candidates: [] }];
  const nr = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(nr.body.tool.outcome, 'not_ready'); assert.equal(nr.body.run.outcome, 'needs_user'); assert.equal(nr.body.run.waiting, 'profile_incomplete');
  assert.deepEqual(nr.body.run.missing, ['photo', 'intro_confirmed']); assert.equal(nr.body.run.next, 'complete_profile');
  // 늦은 도구 결과: 조회가 도는 사이 사용자가 정정 → 판 번호가 바뀜 → 그 결과는 저장 0(409)
  s.ai.push(T({ kind: 'correction', reply: '고친 뜻으로 둘게요.', extracted: [X('boundaries', '약속 어기는 것', '약속 어기는 게 더 싫어요')] }));
  await say3(h, sid, '약속 어기는 게 더 싫어요'); // 확정 정보가 바뀌어 다시 조회할 차례
  let release; const gate = new Promise((ok) => { release = ok; });
  s.connect = [{ gate, body: { ok: true, eligible: true, candidates: [{ id: 'x' }] } }];
  const slow = h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  await new Promise((ok) => setTimeout(ok, 20));
  s.ai.push(T({ kind: 'correction', reply: '그렇게 둘게요.', extracted: [X('relationship_style', '빨리 만나기', '아니 빨리 만나고 싶어요')] }));
  assert.equal((await say3(h, sid, '아니 빨리 만나고 싶어요')).status, 200);
  const afterFix = structuredClone(sessionRow(s));
  release();
  const late = await slow;
  assert.equal(late.status, 409); assert.equal(late.body.code, 'STATE_CHANGED');
  assert.deepEqual(sessionRow(s), afterFix, '늦은 도구 결과는 정정 뒤 상태를 덮지 않음');
  assert.notEqual(lastRun(s).outcome, 'done');
});

test('RUN 중단·재개 · 사용자 몫 행동 0 · 대화 단위 비용 상한', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  s.ai.push(T({ kind: 'stop', reply: '여기까지 할게요.' }), { summary: [], closing: '들은 만큼 정리해 둘게요.' });
  const st = await say3(h, sid, '질문이 너무 많아 그만할래');
  assert.equal(st.body.session.phase, 'done');
  assert.equal(st.body.session.run.outcome, 'stopped'); assert.equal(st.body.session.run.waiting, 'user_stopped');
  const r = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(r.body.tool, null); assert.equal((s.connectCalls ?? []).length, 0, '사용자가 멈추면 도구 실행 0');
  // 재개는 사용자가 직접 누른 것만 · 정보가 모자라면 질문으로(도구 0)
  const rs = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid, resume: true });
  assert.equal(rs.body.run.outcome, 'needs_user'); assert.equal(rs.body.run.waiting, 'more_info'); assert.ok(rs.body.run.missing.length >= 1);
  assert.equal((s.connectCalls ?? []).length, 0);
  // 소스 규칙: 연결 서버로 보내는 동작은 my_candidates 하나(상호 선택·동의·약속·관리자 동작 0)
  const src = readFileSync(new URL('index.ts', DIR), 'utf8');
  assert.deepEqual([...src.matchAll(/const CONNECT_ACTION = "([a-z_]+)"/g)].map((m) => m[1]), ['my_candidates']);
  assert.equal(src.split('/functions/v1/doit-connect').length - 1, 1, '연결 서버 호출 자리 하나');
  assert.match(src, /body: JSON\.stringify\(\{ action: CONNECT_ACTION \}\)/);
  // 대화 단위 누적 상한: 넘으면 모델 호출 0 · 429
  const s2 = newState(); const h2 = load(s2);
  const sid2 = await RUNSEQ(s2, h2);
  sessionRow(s2).response_payload.run.budget.calls = 150;
  const before = s2.aiCalls.length;
  const b = await say3(h2, sid2, '잘 웃는 사람');
  assert.equal(b.status, 429); assert.equal(b.body.code, 'AI_BUDGET'); assert.equal(s2.aiCalls.length, before);
});

test('사용자 하루 한도: 24시간 턴 기록 200개면 모델 호출 0 · 429 AI_DAILY_LIMIT · 실행 단계(agent_run)는 모델을 안 써서 막지 않음', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  const now = new Date().toISOString();
  for (let i = 0; i < 199; i++) s.tables.doit_request_events.push({ user_id: ID.user, request_id: `seed-${i}`, action: 'agent_turn', status: 'applied', created_at: now, updated_at: now, response_payload: { record: {} } });
  const before = s.aiCalls.length;
  const b = await say3(h, sid, '잘 웃는 사람');
  assert.equal(b.status, 429); assert.equal(b.body.code, 'AI_DAILY_LIMIT'); assert.equal(s.aiCalls.length, before);
  assert.equal((await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid })).status, 200);
});

test('PR103 Codex 결함 2건 — 실제 index.ts 경로: 실패 응답(빈 답)의 사용량이 턴 기록에 확인된 사용량으로 · 같은 곳 재시도 포함 한 번씩만 · 상태 그대로', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  const before = structuredClone(sessionRow(s));
  s.fail = { openai: ['EMPTY_USAGE', 'EMPTY_USAGE', 'EMPTY_USAGE'] }; // 빈 답은 같은 곳 재시도 대상 아님 → 후보 하나(기본 정책) → 실패
  const r = await say3(h, sid, '잘 웃는 사람');
  assert.equal(r.status, 502);
  sameButBudget(sessionRow(s), before, '상태 그대로');
  const failed = s.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1).response_payload.record;
  assert.equal(failed.ai_calls[0].usage, 'confirmed'); assert.equal(failed.ai_calls[0].error, 'empty');
  assert.equal(failed.ai_usage.tokens_in, 2000 * failed.ai_usage.attempts, '실패 시도마다 업체가 알려 준 사용량이 한 번씩');
  assert.equal(failed.ai_usage.unconfirmed_attempts, 0);
});

test('PR103 Codex 결함 — 실제 index.ts 경로: 사용량 모르는 실패(500)는 미확인으로 남고 0원으로 기록되지 않음', async () => {
  const s = newState(); s.env = ENV3({ limits: { same_provider_retries: 0 } }); const h = load(s);
  const sid = await RUNSEQ(s, h);
  s.fail = { anthropic: ['HTTP500'], openai: ['HTTP500'] };
  assert.equal((await say3(h, sid, '잘 웃는 사람')).status, 502);
  const u = s.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1).response_payload.record.ai_usage;
  assert.deepEqual([u.attempts, u.unconfirmed_attempts, u.tokens_in, u.cost_usd, u.cost_complete], [2, 2, 0, null, false]);
  assert.ok(u.tokens_reserved_unconfirmed > 0, '예약(추정)은 따로 · 청구액 아님');
});

test('RUN 실행 단계: 모델 호출 0 표시 · 기록한 결과 = 실제 도구 응답 · 멈춤→재개는 도구 한 번만(다시 재개해도 재실행 0)', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  for (const [p, np, q, a] of [['attraction_comfort', 'values_character', '사람 볼 때 뭘 먼저 봐요?', '잘 웃는 사람'], ['values_character', 'relationship_style', '천천히 알아가는 게 편해요?', '솔직한 사람']]) {
    s.ai.push(T({ extracted: [X(p, a, a)], ...Q(np, q) })); assert.equal((await say3(h, sid, a)).status, 200);
  }
  s.ai.push(T({ kind: 'stop', reply: '여기까지 할게요.' }), { summary: [], closing: '들은 만큼 정리해 둘게요.' });
  const st = await say3(h, sid, '이제 그만할래');
  assert.equal(st.body.session.run.outcome, 'stopped');
  assert.equal((await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid })).body.tool, null);
  s.connect = [{ ok: true, eligible: true, candidates: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] }];
  const aiBefore = s.aiCalls.length;
  const r1 = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid, resume: true });
  assert.equal(r1.body.model_calls, 0, '실행 단계 자체의 모델 호출 0'); assert.equal(s.aiCalls.length, aiBefore);
  assert.deepEqual([r1.body.tool.outcome, r1.body.tool.count], ['found', 3]);
  const stored = sessionRow(s).response_payload.run;
  assert.deepEqual([stored.tools.at(-1).outcome, stored.tools.at(-1).count, stored.outcome], ['found', 3, 'done'], '저장된 실행 상태 = 실제 도구 응답');
  const runRec = s.tables.doit_request_events.filter((x) => x.action === 'agent_run').at(-1).response_payload;
  assert.deepEqual([runRec.tool.outcome, runRec.tool.count, runRec.run.outcome], ['found', 3, 'done']);
  const r2 = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid, resume: true });
  assert.equal(r2.body.tool, null); assert.equal(s.connectCalls.length, 1, '재개를 다시 눌러도 같은 작업 재실행 0');
});

test('PR103 경계 — 잘렸지만 JSON 모양은 맞는 응답(실제 index.ts): 채택·저장 0 · Agent 가 다시 청한 정상 답만 저장 · 사용량은 둘 다 집계', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  const recs = s.tables.doit_records.length;
  s.fail = { openai: [{ truncValid: T({ extracted: [X('attraction_comfort', '잘린 해석', '잘린')], ...Q('values_character', '잘린 질문이에요?') }) }] };
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const r = await say3(h, sid, '잘 웃는 사람');
  assert.equal(r.status, 200);
  const st = sessionRow(s).response_payload.state;
  assert.ok(!JSON.stringify(st).includes('잘린 해석') && !JSON.stringify(st).includes('잘린 질문'), '잘린 응답 내용 저장 0');
  assert.equal(st.slots.attraction_comfort.items.find((i) => i.status === 'CONFIRMED').note, '잘 웃는 사람');
  assert.equal(s.tables.doit_records.length, recs + 1);
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn' && x.status === 'applied').at(-1).response_payload.record;
  assert.equal(rec.ai_calls[0].error, 'truncated_discarded'); assert.ok(rec.retry.includes('format'), 'Agent 형식 재요청 경로');
  assert.ok(rec.ai_usage.tokens_out >= 768 + 100, '잘린 호출 사용량도 집계');
});

test('PR103 복합 — Agent 형식 재요청 + 제공사 전환이 한 요청에서 같이 일어나도 하나의 예산 · 시도 수 = 실제 업체 호출 수 · 상한에서 멈추고 상태 그대로', async () => {
  // 요청 토큰 상한은 보장된 상한(입력 바이트 + 출력 상한)으로 본다(Codex 리뷰 5400556217 P1) → 사용량 없는 실패 2번이 각각 ~1.5만을 붙잡으므로
  // 이 검사의 1)·2)는 시도 수·전환을 보려고 토큰 상한을 6만으로 둔다. 기본 3만에서의 동작은 3)에서 따로 확인.
  // 이 검사는 예산·시도 수 상한을 본다 — 연속 오류 차단기(3번)는 따로 검사하므로 여기서는 열리지 않게 둔다(앞선 턴의 우연한 성공 호출 수에 기대지 않음 · 2026-10-05).
  const s = newState(); s.env = ENV3({ circuit: { open_after: 20, cooldown_ms: 60_000 }, limits: { same_provider_retries: 0, max_tokens_per_request: 60_000 } }); const h = load(s);
  const sid = await RUNSEQ(s, h);
  // 1) anthropic 500 → openai 깨진 JSON(형식) → Agent 가 previous_attempt 로 다시 청함 → anthropic 500 → openai 정상
  s.providerCalls = []; s.fail = { anthropic: ['HTTP500', 'HTTP500'], openai: ['BADJSON'] };
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const ok = await say3(h, sid, '잘 웃는 사람');
  assert.equal(ok.status, 200);
  const rec = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn' && x.status === 'applied').at(-1).response_payload.record;
  assert.deepEqual(s.providerCalls.slice(0, 4), ['anthropic', 'openai', 'anthropic', 'openai']);
  assert.equal(rec.ai_usage.attempts, s.providerCalls.length, '형식 재요청·전환 모두 같은 예산의 시도로 셈');
  assert.ok(rec.retry.includes('format'));
  // 2) 같은 모양인데 요청 상한 3 → 4번째 시도 전에 멈춤 → 502 · 상태 그대로
  s.env = ENV3({ circuit: { open_after: 20, cooldown_ms: 60_000 }, limits: { same_provider_retries: 0, max_calls_per_request: 3, max_tokens_per_request: 60_000 } });
  const before = structuredClone(sessionRow(s));
  s.providerCalls = []; s.fail = { anthropic: ['HTTP500', 'HTTP500'], openai: ['BADJSON'] };
  const capped = await say3(h, sid, '솔직한 사람');
  assert.equal(capped.status, 502); assert.equal(s.providerCalls.length, 3, '상한 3 = 실제 업체 호출 3');
  sameButBudget(sessionRow(s), before);
  const failed = s.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1).response_payload.record;
  assert.equal(failed.ai_calls.at(-1).error, 'budget_exceeded');
  // 3) 기본 요청 토큰 상한(3만): 사용량 없는 실패가 붙잡은 보장 상한 + 다음 시도 상한이 3만을 넘으면 보내지 않고 멈춤(request_budget) · 상태 그대로
  s.env = ENV3({ circuit: { open_after: 20, cooldown_ms: 60_000 }, limits: { same_provider_retries: 0 } });
  const before3 = structuredClone(sessionRow(s));
  s.providerCalls = []; s.fail = { anthropic: ['HTTP500', 'HTTP500'], openai: ['BADJSON'] };
  const tight = await say3(h, sid, '솔직한 사람');
  assert.equal(tight.status, 502);
  sameButBudget(sessionRow(s), before3);
  const f3 = s.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1).response_payload.record;
  assert.equal(f3.ai_calls.at(-1).error, 'budget_exceeded'); assert.equal(f3.ai_calls.at(-1).reason, 'request_budget');
  const sentTokens = f3.ai_calls.filter((c) => c.usage === 'confirmed').reduce((n, c) => n + c.input_tokens + c.output_tokens, 0);
  assert.ok(sentTokens <= 30_000, '확인된 사용량도 요청 상한 안');
});

// ── PR #103 Codex Code Review(리뷰 5399862208 · 4e04d36) 재현 3건 — 실제 index.ts 경로
test('Codex P1 실패한 턴의 사용량도 대화 예산(stored.run)에 남는다 — 실패를 되풀이해 60회/15만 토큰 상한을 우회 0 · 대화 내용(턴)은 그대로', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  const before = structuredClone(sessionRow(s).response_payload);
  s.fail = { openai: ['EMPTY_USAGE', 'EMPTY_USAGE', 'EMPTY_USAGE'] };
  assert.equal((await say3(h, sid, '잘 웃는 사람')).status, 502);
  const after = sessionRow(s).response_payload;
  assert.deepEqual(after.state, before.state, '대화 상태(턴·칸)는 그대로');
  const failed = s.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1).response_payload.record;
  assert.equal(after.run.budget.calls, before.run.budget.calls + failed.ai_usage.attempts, '실패한 시도 수가 누적');
  assert.equal(after.run.budget.tokens_in, before.run.budget.tokens_in + failed.ai_usage.tokens_in, '확인된 사용량이 누적');
});
test('Codex P2 하루 한도 경계에서 같은 요청 재전송 = 저장된 결과(429 아님)', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  const now = new Date().toISOString();
  const already = s.tables.doit_request_events.filter((r) => r.user_id === ID.user && r.action === 'agent_turn').length;
  for (let i = 0; i < 199 - already; i++) s.tables.doit_request_events.push({ user_id: ID.user, request_id: `seed-${i}`, action: 'agent_turn', status: 'applied', created_at: now, updated_at: now, response_payload: { record: {} } });
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const requestId = rid();
  const first = await h.call({ action: 'agent_turn', requestId, sessionId: sid, text: '잘 웃는 사람' });
  assert.equal(first.status, 200, '199 → 200번째 턴은 성공');
  const calls = s.aiCalls.length;
  const again = await h.call({ action: 'agent_turn', requestId, sessionId: sid, text: '잘 웃는 사람' }); // 응답을 잃어 같은 요청 재전송
  assert.equal(again.status, 200, JSON.stringify(again.body)); assert.equal(again.body.duplicate, true); assert.equal(s.aiCalls.length, calls, '재전송은 모델 호출 0');
  const fresh = await say3(h, sid, '새 말');
  assert.equal(fresh.status, 429); assert.equal(fresh.body.code, 'AI_DAILY_LIMIT', '새 요청은 여전히 막힘');
});
test('Codex P2 소개 다시 쓰기·구조대 보기의 모델 호출도 대화 예산에 누적', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  const sid = start.body.session.id;
  // 구조대: 들고 있는 보기가 없으면 보기를 청하는 모델 호출 1
  s.rescue = [{ choices: ['조용한 카페', '같이 걷기'] }];
  const b0 = structuredClone(sessionRow(s).response_payload.run.budget);
  assert.equal((await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid })).status, 200);
  const b1 = sessionRow(s).response_payload.run.budget;
  assert.equal((s.rescueCalls ?? []).length, 1, '보기 모델 호출 1');
  assert.equal(b1.calls, b0.calls + 1, '구조대 호출이 예산에'); assert.equal(b1.tokens_in, b0.tokens_in + 100);
  s.ai.push(T({ kind: 'stop' }), { summary: [], closing: '고마워요.', intro: [{ text: '저는 요리를 잘해요.', basis: '요리' }] });
  assert.equal((await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '그만할래요' })).status, 200);
  const b2 = structuredClone(sessionRow(s).response_payload.run.budget);
  s.ai.push({ intro: [{ text: '저는 편하게 만나는 사이가 좋아요.', basis: '편하게 만나고' }] });
  assert.equal((await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid })).status, 200);
  const b3 = sessionRow(s).response_payload.run.budget;
  assert.equal(b3.calls, b2.calls + 1, '소개 호출이 예산에'); assert.equal(b3.tokens_in, b2.tokens_in + 1000);
});
// ── PR #103 Codex Code Review(리뷰 5399945942 · d68c3cf) 재현 2건
const seedDaily = (s, n) => { s.tables.doit_request_events ??= []; const now = new Date().toISOString(); const have = s.tables.doit_request_events.filter((r) => r.user_id === ID.user && r.action === 'agent_turn').length; for (let i = 0; i < n - have; i++) s.tables.doit_request_events.push({ user_id: ID.user, request_id: `seed-${i}`, action: 'agent_turn', status: 'applied', created_at: now, updated_at: now, response_payload: { record: {} } }); };
test('Codex P2(리뷰 5401213108) 하루 한도는 모델을 실제로 부른 턴만 셈 — 모델 0 턴 200개 뒤에도 모델 턴 가능 · 모델 턴 200개면 막힘', async () => {
  const seed = (s, attempts) => { s.tables.doit_request_events ??= []; const now = new Date().toISOString(); for (let i = 0; i < 200; i++) s.tables.doit_request_events.push({ user_id: ID.user, request_id: `z-${attempts}-${i}`, action: 'agent_turn', status: 'applied', created_at: now, updated_at: now, response_payload: { record: { ai_usage: { attempts } } } }); };
  const s = newState(); const h = load(s); seed(s, 0);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const ok = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(ok.status, 200, '모델 0 턴은 하루 한도에 세지 않음');
  const s2 = newState(); const h2 = load(s2); seed(s2, 1);
  const no = await h2.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(no.status, 429, '모델 턴 200 = 막힘');
});
test('Codex P2(리뷰 5401309056) 첫 질문 만들기 중 사용자가 끊으면 499 CANCELLED(502 AI_ERROR 아님) · 세션 저장 0', async () => {
  const s = newState(); const h = load(s); const ctrl = new AbortController();
  s.fail = { openai: [{ abort: ctrl }] };
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT' }, { signal: ctrl.signal });
  assert.equal(r.status, 499, JSON.stringify(r.body)); assert.equal(r.body.code, 'CANCELLED');
  assert.ok(!(s.tables.doit_request_events ?? []).some((x) => x.action === 'agent_session'), '세션 저장 0');
});
test('Codex P2(리뷰 5401266902) 모델 0 턴이 읽기 상한(1,000줄)을 넘게 쌓여도 모델 턴이 빠져 한도를 우회 0(넘으면 전부 셈)', async () => {
  const s = newState(); const h = load(s); s.tables.doit_request_events ??= []; const now = new Date().toISOString();
  for (let i = 0; i < 1100; i++) s.tables.doit_request_events.push({ user_id: ID.user, request_id: `g-${i}`, action: 'agent_turn', status: 'applied', created_at: now, updated_at: now, response_payload: { record: { ai_usage: { attempts: 0 } } } });
  for (let i = 0; i < 200; i++) s.tables.doit_request_events.push({ user_id: ID.user, request_id: `m-${i}`, action: 'agent_turn', status: 'applied', created_at: now, updated_at: now, response_payload: { record: { ai_usage: { attempts: 1 } } } });
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(r.status, 429, '모델 턴 200 이 읽기 상한 밖에 있어도 막힘');
});
test('Codex P2 하루 한도: 이미 쓴 요청 id 로 구조대·소개를 불러도 한도 우회 0(재생 안 하는 동작)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const used = rid();
  const start = await h.call({ action: 'agent_start', requestId: used, tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  const sid = start.body.session.id;
  seedDaily(s, 200);
  s.rescue = [{ choices: ['조용한 카페', '같이 걷기'] }];
  const r = await h.call({ action: 'agent_rescue', requestId: used, sessionId: sid });
  assert.equal(r.status, 429); assert.equal(r.body.code, 'AI_DAILY_LIMIT'); assert.equal((s.rescueCalls ?? []).length, 0, '보기 모델 호출 0');
});
test('Codex P2 하루 한도: 같은 목적의 세션이 이미 있으면 새 요청 id 로 시작해도 그 세션을 돌려줌(모델 0 · 429 아님)', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  seedDaily(s, 200);
  const calls = s.aiCalls.length;
  const again = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'romantic', goalLabel: '연애로 이어질 만남을 원해요', firstAnswer: '연애로 이어질 만남을 원해요' });
  assert.equal(again.status, 200, JSON.stringify(again.body)); assert.equal(again.body.existing, true); assert.equal(again.body.session.id, sid); assert.equal(s.aiCalls.length, calls);
  const fresh = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구 만나고 싶어요' });
  assert.equal(fresh.status, 429, '새로 만들어야 하는 시작은 여전히 막힘'); assert.equal(fresh.body.code, 'AI_DAILY_LIMIT');
});
// ── PR #103 Codex Code Review(리뷰 5400022834 · 9a531dd) 재현 2건
test('Codex P2 하루 한도에서도 모델이 필요 없는 소개(상한 도달)·구조대(들고 있던 보기)는 막지 않음 · 모델이 필요하면 막음', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ reply: '좋죠.', extracted: [X('relationship_intent', '친구', '친구')], next: { type: 'core', purpose: 'relationship_style', question: '친구 만나면 처음엔 뭐 하는 게 편해요?', choices: ['조용한 카페', '같이 걷기', '잘 모르겠어요'] } }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구 만나고 싶어요' });
  const sid = start.body.session.id;
  seedDaily(s, 200);
  const r = await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.session.current_rescue.show, true, '들고 있던 보기는 모델 0 → 한도와 무관');
  sessionRow(s).response_payload.state.phase = 'done'; sessionRow(s).response_payload.state.intro = { status: 'failed', lines: [], dropped: {}, tries: 3, error: 'limit', used: null, used_at: null };
  const i = await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid });
  assert.equal(i.status, 200, JSON.stringify(i.body)); assert.equal(i.body.limited, true, '소개 상한 도달 = 모델 0 → limited');
});
test('Codex P2 첫 질문 만들기가 실패해도 시도가 하루 한도에 셈(새 요청 id 로 되풀이해 우회 0) · 같은 요청 재전송은 409 아님', async () => {
  const s = newState(); const h = load(s);
  seedDaily(s, 199);
  s.ai.push('HTTP500', 'HTTP500');
  const requestId = rid();
  const bad = await h.call({ action: 'agent_start', requestId, tone: 'polite', mode: 'TEXT' });
  assert.equal(bad.status, 502);
  const failed = s.tables.doit_request_events.filter((x) => x.action === 'agent_turn' && x.status === 'failed').at(-1);
  assert.ok(failed, '실패한 첫 질문 시도가 기록됨'); assert.ok(failed.response_payload.record.ai_usage.attempts >= 1);
  const again = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT' });
  assert.equal(again.status, 429, '199 + 실패 1 = 200 → 새 시작은 막힘'); assert.equal(again.body.code, 'AI_DAILY_LIMIT');
});
test('Codex P2 모델이 필요 없는 소개·구조대는 AI 설정 없음·대화 예산 소진에서도 평소 결과(설정·예산 확인은 모델을 부를 때만)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ reply: '좋죠.', extracted: [X('relationship_intent', '친구', '친구')], next: { type: 'core', purpose: 'relationship_style', question: '친구 만나면 처음엔 뭐 하는 게 편해요?', choices: ['조용한 카페', '같이 걷기', '잘 모르겠어요'] } }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구 만나고 싶어요' });
  const sid = start.body.session.id;
  sessionRow(s).response_payload.run.budget.calls = 150; // 대화 예산 소진
  const r = await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.session.current_rescue.show, true);
  sessionRow(s).response_payload.state.phase = 'done'; sessionRow(s).response_payload.state.intro = { status: 'failed', lines: [], dropped: {}, tries: 3, error: 'limit', used: null, used_at: null };
  const i = await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid });
  assert.equal(i.status, 200, JSON.stringify(i.body)); assert.equal(i.body.limited, true);
  s.env = { OPENAI_API_KEY: '' }; // AI 설정 없음
  const i2 = await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid });
  assert.equal(i2.status, 200, JSON.stringify(i2.body)); assert.equal(i2.body.limited, true);
});
test('Codex P2 대화 차례: 모델이 필요 없는 입력(개인정보 안내 · 보기 모두 아님)은 대화 예산·하루 한도에서도 평소 응답 · 모델이 필요하면 막음', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ reply: '좋죠.', extracted: [X('relationship_intent', '친구', '친구')], next: { type: 'core', purpose: 'relationship_style', question: '친구 만나면 처음엔 뭐 하는 게 편해요?', choices: ['조용한 카페', '같이 걷기', '잘 모르겠어요'] } }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구 만나고 싶어요' });
  const sid = start.body.session.id;
  sessionRow(s).response_payload.run.budget.calls = 150; // 대화 예산 소진
  seedDaily(s, 200);                                    // 하루 한도 도달
  const calls = s.aiCalls.length;
  const priv = await say3(h, sid, '제 번호는 010-1234-5678 이에요');
  assert.equal(priv.status, 200, JSON.stringify(priv.body)); assert.equal(s.aiCalls.length, calls, '개인정보 안내 = 모델 0');
  assert.equal((await h.call({ action: 'agent_rescue', requestId: rid(), sessionId: sid })).status, 200);
  const none = await say3(h, sid, '둘 다 아니에요', { rescueOpen: true });
  assert.equal(none.status, 200, JSON.stringify(none.body)); assert.equal(s.aiCalls.length, calls, '보기 모두 아님 = 모델 0');
  const normal = await say3(h, sid, '조용한 데가 좋아요');
  assert.equal(normal.status, 429, '모델이 필요한 말은 여전히 막힘');
});
// ── PR #103 Codex Code Review(리뷰 5400199738 · f52cea1) 재현 2건
test('Codex P1 대화 예산이 거의 찼으면 이번 요청도 남은 만큼만(재시도·전환 포함) — 대화 상한(60회)을 넘지 않음', async () => {
  const s = newState(); s.env = ENV3({ limits: { same_provider_retries: 0 } }); const h = load(s);
  const sid = await RUNSEQ(s, h);
  sessionRow(s).response_payload.run.budget.calls = 59; // 남은 호출 1
  s.providerCalls = []; s.fail = { anthropic: ['HTTP500'], openai: ['HTTP500'] };
  const r = await say3(h, sid, '잘 웃는 사람');
  assert.equal(r.status, 429, '대화 예산을 다 쓰면 「다시 보내 주세요」(502)가 아니라 AI_BUDGET(자체 점검 P2)'); assert.equal(r.body.code, 'AI_BUDGET');
  assert.equal(s.providerCalls.length, 1, '남은 1회만 보냄(전환 0)');
  assert.ok(sessionRow(s).response_payload.run.budget.calls <= 60, `대화 누적 ${sessionRow(s).response_payload.run.budget.calls} ≤ 60`);
});
test('Codex P2 첫 답과 함께 시작: 모델이 필요 없는 첫 답(개인정보 안내)은 AI 설정 없음·하루 한도에서도 평소 응답', async () => {
  const s = newState(); s.env = { OPENAI_API_KEY: '' }; const h = load(s);
  seedDaily(s, 200);
  const r = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '제 번호는 010-1234-5678 이에요' });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal((s.aiCalls ?? []).length, 0);
  s.env = {};
  const n = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구 만나고 싶어요' });
  assert.equal(n.status, 429, '모델이 필요한 첫 답은 여전히 막힘');
});
// ── 2026-10-03 자체 점검(Codex 넘기기 전) 재현
test('자체 P1 저장 경쟁에서 진 요청이 부른 모델도 하루 한도·대화 예산에 남음', async () => {
  const s = newState(); const h = load(s);
  const sid = await RUNSEQ(s, h);
  let release; const gate = new Promise((ok) => { release = ok; });
  s.fail = { openai: [{ gate }] };
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const sent = (s.providerCalls ?? []).length;
  const a = say3(h, sid, '잘 웃는 사람');
  for (let i = 0; i < 200 && (s.providerCalls ?? []).length <= sent; i++) await new Promise((r) => setTimeout(r, 5)); // A 가 업체를 부른 뒤(2026-10-05 AI 호출 전 자리 잡기 · 고정 5ms 대신)
  s.ai.push(T({ extracted: [X('attraction_comfort', '솔직한 사람', '솔직한 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const before = sessionRow(s).response_payload.run.budget.calls;
  assert.equal((await say3(h, sid, '솔직한 사람')).status, 200);
  release(); const ra = await a;
  assert.equal(ra.status, 409);
  const usageRows = s.tables.doit_request_events.filter((x) => x.action === 'agent_usage');
  assert.ok(usageRows.length >= 1, '진 요청의 사용 기록(하루 한도용)');
  assert.ok(sessionRow(s).response_payload.run.budget.calls >= before + 2, '이긴 쪽 + 진 쪽 호출 모두 대화 예산에');
});
test('자체 P1 첫 질문 만들기(성공)·소개·보기 호출도 하루 한도에 셈', async () => {
  const s = newState(); const h = load(s);
  seedDaily(s, 199);
  s.ai.push({ reply: '반가워요', question: '어떤 만남을 찾아요?' });
  const st = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.equal(s.tables.doit_request_events.filter((x) => x.action === 'agent_usage').length, 1, '첫 질문 사용 기록');
  const n = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', goal: 'friend', firstAnswer: '친구 만나고 싶어요' });
  assert.equal(n.status, 429, '199 + 첫 질문 1 = 200 → 막힘');
});
test('자체 P2 사용자가 끊은 소개 다시 쓰기는 쓰던 소개를 「실패」로 덮지 않음', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  const sid = start.body.session.id;
  s.ai.push(T({ kind: 'stop' }), { summary: [], closing: '고마워요.', intro: [{ text: '저는 편하게 만나는 사이가 좋아요.', basis: '편하게 만나고' }] });
  await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '그만할래요' });
  const before = structuredClone(sessionRow(s).response_payload.state.intro);
  { const b = sessionRow(s).response_payload.run.budget; b.tokens_in = 149_000 - b.tokens_out - (b.tokens_unconfirmed ?? 0); } // 대화 예산 안(modelAllowed=true)이지만 남은 1,000토큰 < 이번 호출 상한 → 보내기 전에 멈춤
  const r = await h.call({ action: 'agent_intro', requestId: rid(), sessionId: sid });
  assert.equal(r.status, 429); assert.equal(r.body.code, 'AI_BUDGET');
  assert.deepEqual(sessionRow(s).response_payload.state.intro, before, '쓰던 소개 그대로');
});
// ── PR #103 Codex Code Review(리뷰 5400366786 · effcc97) 재현
test('Codex P1 예산만 접는 저장도 판 번호를 올림 — 그 사이 시작된 정상 저장이 실패 요청의 사용량을 지우지 못함', async () => {
  const s = newState(); s.env = ENV3({ limits: { same_provider_retries: 0 } }); const h = load(s);
  const sid = await RUNSEQ(s, h);
  let release; const gate = new Promise((ok) => { release = ok; });
  s.fail = { anthropic: [{ gate }] }; // A: 느린 정상 턴
  s.ai.push(T({ extracted: [X('attraction_comfort', '잘 웃는 사람', '잘 웃는 사람')], ...Q('values_character', '사람 볼 때 뭘 먼저 봐요?') }));
  const before = (s.providerCalls ?? []).length;
  const a = say3(h, sid, '잘 웃는 사람');
  // A 가 실제로 업체를 부른 뒤(느린 응답 대기 중)에 B 를 보낸다 — 2026-10-05 AI 호출 전 자리 잡기(잠금·자리)가 생겨 고정 5ms 로는 A 가 아직 호출 전일 수 있다
  for (let i = 0; i < 200 && (s.providerCalls ?? []).length <= before; i++) await new Promise((r) => setTimeout(r, 5));
  s.fail = { anthropic: ['HTTP500'], openai: ['HTTP500'] }; // B: 같은 판에서 실패(사용량만 접음)
  const rb = await say3(h, sid, '솔직한 사람'); assert.equal(rb.status, 502, JSON.stringify(rb.body));
  const afterB = sessionRow(s).response_payload.run.budget.calls;
  release(); const ra = await a;
  assert.equal(ra.status, 409, 'B 가 판을 올렸으므로 늦은 A 는 저장 0');
  assert.ok(sessionRow(s).response_payload.run.budget.calls >= afterB, 'B 의 사용량이 지워지지 않음');
});
test('Codex P2 실행 재생 기록(agent_run 행)이 남지 않아도 같은 요청 재전송은 도구 재실행 0', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  s.connect = [{ ok: true, eligible: true, missing: [], candidates: [] }, { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const rq = rid();
  const r1 = await h.call({ action: 'agent_run', requestId: rq, sessionId: sid });
  assert.equal(r1.status, 200, JSON.stringify(r1.body)); assert.equal(r1.body.tool.outcome, 'none');
  s.tables.doit_request_events = s.tables.doit_request_events.filter((x) => !(x.action === 'agent_run' && x.request_id === rq)); // 재생 기록 저장 실패를 흉내
  const calls = s.connectCalls.length;
  const r2 = await h.call({ action: 'agent_run', requestId: rq, sessionId: sid });
  assert.equal(r2.status, 200); assert.equal(r2.body.duplicate, true); assert.equal(r2.body.tool.outcome, 'none');
  assert.equal(s.connectCalls.length, calls, '도구 다시 안 부름');
});
test('Codex P2(리뷰 5400441424) 재생 기록이 빠진 실행 요청 A 는 그 사이 다른 실행 B 가 있어도 재전송 = 저장된 결과(도구 재실행 0)', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  s.connect = ['NETWORK', { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const A = rid();
  const r1 = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(r1.body.tool.outcome, 'failed');
  s.tables.doit_request_events = s.tables.doit_request_events.filter((x) => !(x.action === 'agent_run' && x.request_id === A)); // A 의 재생 기록 저장 실패
  assert.equal((await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid })).status, 200); // B: 쉬는 시간이라 도구 0 · 기록만
  const calls = s.connectCalls.length;
  sessionRow(s).response_payload.run.tools.at(-1).at = '2000-01-01T00:00:00.000Z'; // 쉬는 시간이 지난 뒤 A 재전송
  const again = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(again.body.duplicate, true); assert.equal(again.body.tool.outcome, 'failed');
  assert.equal(s.connectCalls.length, calls, 'A 재전송 = 도구 다시 안 부름');
});
test('Codex P2(리뷰 5400588319) 같은 새 요청 id 로 실행 두 개가 겹쳐 들어와도 후보 조회 도구는 한 번만(나중 것 = 409)', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  s.connect = [{ ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }, { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const n = () => (s.connectCalls ?? []).length; const calls = n(); const A = rid();
  const [r1, r2] = await Promise.all([h.call({ action: 'agent_run', requestId: A, sessionId: sid }), h.call({ action: 'agent_run', requestId: A, sessionId: sid })]);
  assert.equal(n() - calls, 1, '도구(my_candidates) 실행 1번');
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  const again = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(again.status, 200); assert.equal(again.body.duplicate, true); assert.equal(n() - calls, 1, '끝난 뒤 재전송 = 저장된 결과');
});
test('Codex P1(리뷰 5400766764 · 4175329388) 대화가 바뀌어 실패(STATE_CHANGED)한 실행: 같은 요청 id 는 도구 재실행 0 · 새 요청이면 다시 실행(영구 409 아님)', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  let release; const gate = new Promise((r) => { release = r; });
  s.connect = [{ gate, body: { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] } }, { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const A = rid();
  const first = h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  sessionRow(s).applied_revision = Number(sessionRow(s).applied_revision ?? 0) + 1; // 도구가 도는 사이 다른 저장
  release();
  const r1 = await first;
  assert.equal(r1.status, 409); assert.equal(r1.body.code, 'STATE_CHANGED');
  // Codex P1(리뷰 4175329388): 도구가 이미 돈 뒤의 STATE_CHANGED 는 같은 요청 id 로 다시 잡지 않음(후보 준비 쓰기 재실행 0) — 앱은 STATE_CHANGED 에서 요청 id 를 내려놓는다
  const calls = (s.connectCalls ?? []).length;
  const same = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(same.status, 409); assert.equal(same.body.code, 'RUN_UNCERTAIN'); assert.equal((s.connectCalls ?? []).length, calls, '같은 요청 id = 도구 다시 실행 0');
  const B = rid(); // 다음 누름 = 새 요청(영구 409 아님)
  const r2 = await h.call({ action: 'agent_run', requestId: B, sessionId: sid });
  assert.equal(r2.status, 200, JSON.stringify(r2.body)); assert.equal(r2.body.duplicate, undefined);
  assert.equal(r2.body.tool.outcome, 'found');
  const r3 = await h.call({ action: 'agent_run', requestId: B, sessionId: sid });
  assert.equal(r3.body.duplicate, true, '성공한 뒤 재전송 = 저장된 결과');
});
test('Codex P2(리뷰 5400904667) 함수가 끊겨 오래 남은 pending 실행 요청 id = 임대 시간 뒤 다시 잡아 실행 · 임대 안이면 409(도구 0)', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  const user = sessionRow(s).user_id; const n = () => (s.connectCalls ?? []).length; const before = n();
  const A = rid(); const B = rid();
  const old = new Date(Date.now() - 10 * 60_000).toISOString(); const fresh = new Date().toISOString();
  s.tables.doit_request_events.push({ user_id: user, request_id: A, action: 'agent_run', target_id: sid, status: 'pending', payload_hash: 'x', response_payload: null, created_at: old, updated_at: old });
  s.tables.doit_request_events.push({ user_id: user, request_id: B, action: 'agent_run', target_id: sid, status: 'pending', payload_hash: 'x', response_payload: null, created_at: fresh, updated_at: fresh });
  const rb = await h.call({ action: 'agent_run', requestId: B, sessionId: sid });
  assert.equal(rb.status, 409, '임대 안의 pending = 아직 처리 중'); assert.equal(n(), before, '도구 0');
  s.connect = [{ ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const ra = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(ra.status, 200, JSON.stringify(ra.body)); assert.equal(ra.body.tool.outcome, 'found'); assert.equal(n(), before + 1, '도구 1번');
  assert.equal(s.tables.doit_request_events.find((x) => x.request_id === A && x.action === 'agent_run').status, 'applied');
});
test('Codex 5969458619 P2 대조 — 도구 실행·세션 저장 뒤 함수가 끊겨 pending 이 남아도, 임대가 지나 다시 보내면 저장된 그 결과(도구 재실행 0)', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  const n = () => (s.connectCalls ?? []).length;
  s.connect = [{ ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const A = rid();
  const r1 = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(r1.status, 200); const after = n();
  // 세션 저장까지 끝난 뒤 결과 기록(applied) 전에 끊긴 것처럼: 행을 오래된 pending 으로 되돌림
  const row = s.tables.doit_request_events.find((x) => x.request_id === A && x.action === 'agent_run');
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  Object.assign(row, { status: 'pending', response_payload: null, applied_revision: null, updated_at: old });
  const again = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(again.status, 200); assert.equal(again.body.duplicate, true, '세션에 남은 그 요청의 결과');
  assert.deepEqual(again.body.run, r1.body.run); assert.equal(n(), after, '도구 다시 실행 0');
});
test('Codex P1 중단된 agent_run은 임대 만료 뒤 후보 준비 쓰기를 다시 실행하지 않는다', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  const n = () => (s.connectCalls ?? []).length; const before = n();
  // 첫 실행: 도구(my_candidates · 후보 준비 쓰기 포함)가 불린 뒤 응답이 오지 않음 = 세션 저장 전에 함수가 끊긴 것과 같음
  s.connect = [{ gate: new Promise(() => {}), body: { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] } }, { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const A = rid();
  void h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  for (let i = 0; i < 20 && n() === before; i++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(n(), before + 1, '첫 실행에서 도구 1번');
  const row = s.tables.doit_request_events.find((x) => x.request_id === A && x.action === 'agent_run');
  assert.equal(row.status, 'pending');
  row.updated_at = new Date(Date.now() - 10 * 60_000).toISOString(); // 임대(7분) 만료
  const again = await h.call({ action: 'agent_run', requestId: A, sessionId: sid }); // 앱은 같은 id 를 다시 보낸다
  assert.equal(n(), before + 1, '임대 만료 뒤 같은 요청 = 도구(후보 준비 쓰기) 다시 실행 0');
  assert.equal(again.status, 409, JSON.stringify(again.body)); assert.equal(again.body.code, 'RUN_UNCERTAIN', '성공처럼 처리하지 않고 복구 가능한 409');
  const third = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(third.status, 409); assert.equal(third.body.code, 'RUN_UNCERTAIN'); assert.equal(n(), before + 1, '몇 번을 다시 보내도 도구 0');
  assert.ok(s.tables.doit_request_events.some((x) => x.request_id === A && x.action === 'agent_run'), '실행 기록 행 삭제 0');
  // 앱이 이 요청 id 를 내려놓고 새로 누르면(새 요청 id) 기존처럼 도구 1번
  const fresh = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(fresh.status, 200, JSON.stringify(fresh.body)); assert.equal(fresh.body.tool.outcome, 'found'); assert.equal(n(), before + 2, '새 요청 = 도구 1번');
});
test('결과 없는 오래된 예약은 도구 재실행 대신 복구 가능한 409를 반환한다', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  const user = sessionRow(s).user_id; const n = () => (s.connectCalls ?? []).length; const before = n();
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  const A = rid(); const B = rid();
  s.tables.doit_request_events.push({ user_id: user, request_id: A, action: 'agent_run', target_id: sid, status: 'pending', error_code: 'TOOL_STARTED', payload_hash: 'x', response_payload: null, created_at: old, updated_at: old });
  s.tables.doit_request_events.push({ user_id: user, request_id: B, action: 'agent_run', target_id: sid, status: 'failed', error_code: 'TOOL_UNCERTAIN', payload_hash: 'x', response_payload: null, created_at: old, updated_at: old });
  s.connect = [{ ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const ra = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(ra.status, 409); assert.equal(ra.body.code, 'RUN_UNCERTAIN');
  const rb = await h.call({ action: 'agent_run', requestId: B, sessionId: sid });
  assert.equal(rb.status, 409); assert.equal(rb.body.code, 'RUN_UNCERTAIN', '확인 못 한 실패는 다시 잡지 않음');
  assert.equal(n(), before, '도구 0');
  assert.equal(s.tables.doit_request_events.find((x) => x.request_id === A && x.action === 'agent_run').error_code, 'TOOL_UNCERTAIN');
});
test('저장된 동일 요청 결과가 있으면 도구 없이 duplicate로 재생한다 — 도구 시작 표시가 남은 행이어도', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  const n = () => (s.connectCalls ?? []).length;
  s.connect = [{ ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const A = rid();
  const r1 = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(r1.status, 200); const after = n();
  // 세션 저장 뒤 결과 기록(applied) 전에 끊긴 것처럼: 도구 시작 표시가 남은 오래된 pending
  const row = s.tables.doit_request_events.find((x) => x.request_id === A && x.action === 'agent_run');
  Object.assign(row, { status: 'pending', error_code: 'TOOL_STARTED', response_payload: null, applied_revision: null, updated_at: new Date(Date.now() - 10 * 60_000).toISOString() });
  const again = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(again.status, 200); assert.equal(again.body.duplicate, true); assert.deepEqual(again.body.run, r1.body.run); assert.equal(n(), after, '도구 0');
});
test('Codex P2(리뷰 5400766764) 첫 답 없는 시작은 첫 질문 만들기(opening) 경로로 확인 — 작업별 정책 존중', async () => {
  const s = newState();
  s.env = { ...ENV3({ providers: { anthropic: { model: 'fake-anthropic-model', allow_user_text: false } }, tasks: { default: ['anthropic'], opening: ['openai'] } }) };
  const h = load(s);
  s.ai.push({ reply: '반가워요', question: '어떤 만남을 찾아요?' });
  const st = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT' });
  assert.equal(st.status, 200, JSON.stringify(st.body));
  assert.deepEqual([...new Set(s.providerCalls)], ['openai'], 'opening 경로(openai)로 첫 질문');
  const s2 = newState();
  s2.env = { ...ENV3({ providers: { anthropic: { model: 'fake-anthropic-model', allow_user_text: false } }, tasks: { default: ['openai'], opening: ['anthropic'] } }) };
  const h2 = load(s2);
  const st2 = await h2.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT' });
  assert.equal(st2.status, 500); assert.equal(st2.body.code, 'AI_NOT_CONFIGURED', 'opening 경로가 못 쓰면 시작 전에 설정 필요');
  assert.equal((s2.providerCalls ?? []).length, 0);
});
test('Codex P2(리뷰 5400556217) 재생 기록이 빠진 실행 요청 A 를 다시 보내면, 그 사이 B 가 실행 기록을 바꿨어도 A 당시의 결과(outcome·next)를 돌려줌', async () => {
  const s = newState(); const h = load(s);
  const { sid, say } = await fi018Done(h, s);
  s.ai.push(T({ extracted: [X('values_character', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요', '서로 말 끊지 않고 천천히 듣는 대화가 좋아요')], ...Q('boundaries', '천천히 듣는 대화에서 싫은 건 뭐예요?') }), { summary: [], closing: '이제 조금 알 것 같아요.' });
  assert.equal((await say('서로 말 끊지 않고 천천히 듣는 대화가 좋아요')).body.session.phase, 'done');
  s.connect = ['NETWORK', { ok: true, eligible: true, missing: [], candidates: [{ id: 'x' }] }];
  const A = rid();
  const r1 = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(r1.body.run.outcome, 'on_hold'); assert.equal(r1.body.run.next, 'retry_later');
  s.tables.doit_request_events = s.tables.doit_request_events.filter((x) => !(x.action === 'agent_run' && x.request_id === A)); // A 의 재생 기록 저장 실패
  sessionRow(s).response_payload.run.tools.at(-1).at = '2000-01-01T00:00:00.000Z'; // 쉬는 시간이 지나 B 가 도구를 다시 실행 → 후보 있음
  const r2 = await h.call({ action: 'agent_run', requestId: rid(), sessionId: sid });
  assert.equal(r2.body.run.next, 'open_candidates', 'B 가 실행 기록을 바꿈');
  const again = await h.call({ action: 'agent_run', requestId: A, sessionId: sid });
  assert.equal(again.body.duplicate, true);
  assert.deepEqual(again.body.run, r1.body.run, 'A 재전송 = A 당시 실행 기록(최신 B 기록이 아님)');
  assert.deepEqual(again.body.tool, r1.body.tool);
});
