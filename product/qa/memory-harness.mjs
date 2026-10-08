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
    let range = null;
    const rows = () => { let r = table(name).filter((row) => filters.every((f) => f(row))); if (order) r = r.slice().sort((a, b) => (a[order.col] < b[order.col] ? -1 : a[order.col] > b[order.col] ? 1 : 0) * (order.asc ? 1 : -1)); if (range) r = r.slice(range[0], range[1]+1); if (lim != null) r = r.slice(0, lim); return r; };
    const run = () => {
      if (state.failReads?.includes(name) && op === 'select') return {data:null,error:{code:'SYNTHETIC_READ_FAILURE'},count:null};
      if (op === 'update') { const hit = rows(); for (const r of hit) Object.assign(r, structuredClone(patch)); return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null }; }
      const all = rows(); return { data: all.map((r) => structuredClone(r)), error: null, count: all.length };
    };
    const c = {
      select: () => { if (op !== 'select') returning = true; return c; },
      eq: (col, v) => { filters.push((r) => r[col] === v); return c; },
      gte: (col, v) => { filters.push((r) => String(r[col] ?? '') >= String(v)); return c; },
      in: (col, vals) => { filters.push((r) => vals.includes(r[col])); return c; },
      order: (col, o) => { order = { col, asc: o?.ascending !== false }; return c; },
      range: (a,b) => { range = [a,b]; return c; },
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
  const historyMod = { exports: {} };
  vm.runInNewContext(compile('history-retrieval.ts'), { module: historyMod, exports: historyMod.exports, console, Date, Number, String, Array, Object, Set, Error }, { filename: 'history-retrieval.ts' });
  const agentMod = { exports: {} };
  vm.runInNewContext(compile('agent.ts'), { module: agentMod, exports: agentMod.exports, console, require: n => { if(n==='./history-retrieval.ts') return historyMod.exports; throw new Error(n); } }, { filename: 'agent.ts' });
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
  // 2026-10-05 회사 예산 장부 모듈(company-budget.ts · 환경값으로 켤 때만 · state.env 를 요청마다 읽음)
  const cbMod = { exports: {} };
  vm.runInNewContext(compile('company-budget.ts'), { ...g, module: cbMod, exports: cbMod.exports, Deno: { env: { get: (k) => (state.env ?? {})[k] } } }, { filename: 'company-budget.ts' });
  // 2026-10-05 참고 이야기 모듈(reference-talk.ts · agent.ts 만 씀 · 저장 0)
  const refMod = { exports: {} };
  vm.runInNewContext(compile('reference-talk.ts'), { ...g, module: refMod, exports: refMod.exports, require: (n) => { if (n === './agent.ts') return agentMod.exports; throw new Error(`Unexpected dependency ${n}`); } }, { filename: 'reference-talk.ts' });
  // 2026-10-06 유료 자유 대화 모듈(free-talk.ts · agent.ts + reference-talk.ts 만 씀 · 스위치 기본 꺼짐)
  const freeMod = { exports: {} };
  vm.runInNewContext(compile('free-talk.ts'), { ...g, module: freeMod, exports: freeMod.exports, require: (n) => { if (n === './agent.ts') return agentMod.exports; if (n === './reference-talk.ts') return refMod.exports; throw new Error(`Unexpected dependency ${n}`); } }, { filename: 'free-talk.ts' });
  let handler = null;
  const logs = [];
  const sandbox = {
    module: { exports: {} }, exports: {}, console: { log: (s) => logs.push(String(s)), error: (s) => logs.push(String(s)) },
    // state.env 로 요청마다 환경을 바꿀 수 있다(2026-10-03 AI_POLICY · 제공사 키 있는지 — 값은 가짜).
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: '', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's', ...(state.env ?? {}) })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; if (name === './agent.ts') return agentMod.exports; if (name === './history-retrieval.ts') return historyMod.exports; if (name === './failure-intelligence.ts') return failureMod.exports; if (name === './modelRouter.ts') return routerMod.exports; if (name === './run.ts') return runMod.exports; if (name === './card-reading.ts') return cardMod.exports; if (name === './reference-talk.ts') return refMod.exports; if (name === './company-budget.ts') return cbMod.exports; if (name === './free-talk.ts') return freeMod.exports; throw new Error(`Unexpected dependency ${name}`); },
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

export { load, newState, ID, rid, T, Q, X, fakeDb };
