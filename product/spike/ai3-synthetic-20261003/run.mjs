// 2026-10-03 대표 승인 「3개 AI 합성 입력 검증」(전체 최대 5달러 · 실제 사용자 데이터 0 · 운영 0).
// 검수된 커밋의 실제 서버 코드(doit-agent index·agent·providers·modelRouter·run)를 메모리 DB 로 돌리고, AI 만 실제 업체로 보낸다.
// - 입력: 이 파일에 적힌 합성 문장뿐(사람 정보 0). 키: 환경변수(GitHub 시험 키) — 출력·저장 0.
// - 지출 상한: 업체 호출 「보내기 전」에 최악 비용(입력 바이트 + 출력 상한, 단가 2배)을 더해 SPEND_CAP_USD 를 넘으면 보내지 않는다. 실패·재시도 호출도 같이 센다.
// - 결과: 제공사별 연결·대화 품질 원문(합성)·정정 반영·실행 기록·지연·사용량·추정 비용을 JSON/요약으로(키·토큰 0).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const SRC = process.env.AGENT_SRC; // 검수 커밋의 product/supabase/functions/doit-agent
const OUT = process.env.OUT_DIR ?? 'ai3-out';
const SPEND_CAP_USD = Number(process.env.SPEND_CAP_USD ?? '4');
// 단가(100만 토큰당 USD · 2026-10-03 확인): OpenAI gpt-4o-mini 0.15/0.60 · Anthropic claude-haiku-4-5 1/5 · Google gemini-2.5-flash 0.30/2.50(생각 토큰 포함 출력)
const PROVIDERS = [
  { id: 'openai', model: 'gpt-4o-mini', key: 'OPENAI_API_KEY', price: { in_usd_per_1m: 0.15, out_usd_per_1m: 0.60 } },
  { id: 'anthropic', model: 'claude-haiku-4-5', key: 'ANTHROPIC_API_KEY', price: { in_usd_per_1m: 1.0, out_usd_per_1m: 5.0 } },
  // gemini-2.5-flash 는 새 사용자 404(run 37121277472) → 예전 승인된 비교 검사(run 35·36)에서 쓴 gemini-3.5-flash-lite 를 GEMINI_MODEL 로 지정(가격 0.30/2.50 · 공식 페이지 미확인 → 2배 안전계수)
  { id: 'gemini', model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', key: 'GEMINI_API_KEY', price: { in_usd_per_1m: 0.30, out_usd_per_1m: 2.50 } },
];
const SAFETY = 2; // 단가 2배로 최악 비용을 잡는다(공식 페이지를 이 환경에서 직접 못 연 값 포함)
const HOSTS = { 'api.openai.com': 'openai', 'api.anthropic.com': 'anthropic', 'generativelanguage.googleapis.com': 'gemini' };

let spent = 0; let blocked = 0; const ledger = [];
const priceOf = (id) => PROVIDERS.find((p) => p.id === id).price;
// DRY_RUN=1: 업체 대신 가짜 응답(검사 장치 자체 확인용 · 실제 호출 0 · 비용 0)
const fakeAi = (prov) => { const out = JSON.stringify({ kind: 'answer', understood: '', reply: '좋네요.', extracted: [], next: { type: 'core', purpose: 'values_character', question: '주말에 만나면 뭘 하고 싶어요?' } });
  const body = prov === 'anthropic' ? { model: 'm', stop_reason: 'end_turn', content: [{ type: 'text', text: out }], usage: { input_tokens: 900, output_tokens: 80 } }
    : prov === 'gemini' ? { modelVersion: 'm', candidates: [{ content: { parts: [{ text: out }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 80 } }
    : { model: 'm', usage: { prompt_tokens: 900, completion_tokens: 80 }, choices: [{ message: { content: out } }] };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); };
const realFetch = process.env.DRY_RUN === '1' ? async (url) => fakeAi(HOSTS[new URL(String(url)).host]) : globalThis.fetch;
async function cappedFetch(url, init) {
  const host = new URL(String(url)).host; const prov = HOSTS[host];
  if (!prov) return realFetch(url, init); // 업체가 아닌 곳(없어야 함)
  const body = String(init?.body ?? ''); const bytes = Buffer.byteLength(body);
  const maxOut = Number(JSON.parse(body).max_tokens ?? JSON.parse(body).generationConfig?.maxOutputTokens ?? 1024);
  const pr = priceOf(prov);
  const worst = ((bytes + 64) * pr.in_usd_per_1m + maxOut * pr.out_usd_per_1m) / 1e6 * SAFETY;
  if (spent + worst > SPEND_CAP_USD) { blocked++; throw new Error('SPEND_CAP'); }
  spent += worst; // 보내기 전에 최악값으로 잡아 두고, 실제 사용량이 오면 바꾼다
  const t0 = Date.now(); let res;
  try { res = await realFetch(url, init); } catch (e) { ledger.push({ prov, ok: false, status: 'network', ms: Date.now() - t0, reserved: worst }); throw e; }
  const clone = res.clone(); let usage = null; let err = null;
  try { const d = await clone.json(); const u = d.usage ?? d.usageMetadata ?? {};
    // 실패 원인 구분용: 업체 오류 종류·짧은 설명만(키·요청 본문은 남기지 않음)
    if (!res.ok) err = `${d.error?.status ?? d.error?.type ?? d.error?.code ?? ''}:${String(d.error?.message ?? '').replace(/key=[^&\s]+/gi, 'key=***').slice(0, 160)}`;
    const tin = u.prompt_tokens ?? u.input_tokens ?? u.promptTokenCount; const tout = u.completion_tokens ?? u.output_tokens ?? ((u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || undefined);
    if (Number.isFinite(tin) && Number.isFinite(tout)) usage = { tin, tout };
  } catch { /* 본문 없음 */ }
  const actual = usage ? (usage.tin * pr.in_usd_per_1m + usage.tout * pr.out_usd_per_1m) / 1e6 : null;
  if (actual != null) spent += actual - worst; // 확인된 사용량이면 실제값으로(아니면 최악값 유지)
  ledger.push({ prov, ok: res.ok, status: res.status, ms: Date.now() - t0, tin: usage?.tin ?? null, tout: usage?.tout ?? null, usd: actual, reserved: actual == null ? worst : 0, ...(err ? { err } : {}) });
  return res;
}

// 서버 코드 적재(agent-server.test.mjs 와 같은 방식 · fetch = 상한 걸린 실제 fetch)
function fakeDb(state) {
  const table = (n) => (state.tables[n] ??= []);
  const q = (name) => {
    let filters = []; let op = 'select'; let patch = null; let order = null; let lim = null; let returning = false;
    const rows = () => { let r = table(name).filter((row) => filters.every((f) => f(row))); if (order) r = r.slice().sort((a, b) => (a[order.col] < b[order.col] ? -1 : a[order.col] > b[order.col] ? 1 : 0) * (order.asc ? 1 : -1)); if (lim != null) r = r.slice(0, lim); return r; };
    const run = () => { if (op === 'update') { const hit = rows(); for (const r of hit) Object.assign(r, structuredClone(patch)); return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null }; } const all = rows(); return { data: all.map((r) => structuredClone(r)), error: null, count: all.length }; };
    const c = { select: () => { if (op !== 'select') returning = true; return c; }, eq: (col, v) => { filters.push((r) => r[col] === v); return c; }, gte: (col, v) => { filters.push((r) => String(r[col] ?? '') >= String(v)); return c; }, in: (col, vals) => { filters.push((r) => vals.includes(r[col])); return c; },
      order: (col, o) => { order = { col, asc: o?.ascending !== false }; return c; }, limit: (n) => { lim = n; return c; }, update: (p) => { op = 'update'; patch = p; return c; }, maybeSingle: () => Promise.resolve({ data: run().data?.[0] ?? null, error: null }), then: (ok, bad) => Promise.resolve(run()).then(ok, bad) };
    return c;
  };
  return { auth: { getUser: async () => ({ data: { user: state.authUser }, error: null }) },
    from: (name) => ({ ...q(name), insert: (row) => { const t = table(name); if (name === 'doit_request_events' && t.some((r) => r.user_id === row.user_id && r.request_id === row.request_id)) return Promise.resolve({ data: null, error: { code: '23505' } }); const now = new Date(Date.now() + t.length).toISOString(); t.push({ created_at: now, updated_at: now, ...structuredClone(row) }); return Promise.resolve({ data: null, error: null }); } }),
    rpc: async (_fn, args) => { const recs = table('doit_records'); const rec = { id: `rec-${recs.length + 1}`, request_id: args.p_request_id, text: args.p_text, status: args.p_status }; recs.push(rec); return { data: { ok: true, record: rec }, error: null }; } };
}
function load(env) {
  const compile = (f) => ts.transpileModule(readFileSync(path.join(SRC, f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const g = { console, setTimeout, clearTimeout, AbortController, JSON, Date, Math, Number, String, Array, Object, Map, Set, Promise, Error, RegExp, TextEncoder, structuredClone };
  const mod = (file, req) => { const m = { exports: {} }; vm.runInNewContext(compile(file), { ...g, fetch: cappedFetch, module: m, exports: m.exports, require: req }, { filename: file }); return m.exports; };
  const agent = mod('agent.ts', () => { throw new Error('dep'); });
  const fi = mod('failure-intelligence.ts', () => { throw new Error('dep'); });
  const prov = mod('providers.ts', () => { throw new Error('dep'); });
  const router = mod('modelRouter.ts', (n) => { if (n === './providers.ts') return prov; throw new Error(n); });
  const run = mod('run.ts', (n) => { if (n === './agent.ts') return agent; throw new Error(n); });
  const state = { tables: { profiles: [{ id: '00000000-0000-4000-8000-000000000001', role: 'user' }] }, authUser: { id: '00000000-0000-4000-8000-000000000001', user_metadata: {} } };
  let handler = null;
  const sandbox = { ...g, module: { exports: {} }, exports: {}, crypto: globalThis.crypto, Response, URL,
    console: { log: () => {}, error: () => {} },
    Deno: { env: { get: (k) => ({ SUPABASE_URL: 'http://db.invalid', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's', ...env })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (n) => { if (n.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; return { './agent.ts': agent, './failure-intelligence.ts': fi, './modelRouter.ts': router, './run.ts': run }[n] ?? (() => { throw new Error(n); })(); },
    fetch: async (url, init) => { if (String(url).includes('/functions/v1/doit-connect')) return new Response(JSON.stringify({ ok: true, eligible: true, missing: [], candidates: [] }), { status: 200 }); return cappedFetch(url, init); } };
  vm.runInNewContext(compile('index.ts'), sandbox, { filename: 'index.ts' });
  let n = 0; const rid = () => `${String(++n).padStart(8, '0')}-0000-4000-8000-${String(Date.now() % 1e12).padStart(12, '0')}`;
  const call = async (body) => { const t0 = Date.now(); const res = await handler(new Request('http://x', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ requestId: rid(), ...body }) })); return { status: res.status, body: await res.json(), ms: Date.now() - t0 }; };
  return { call, state };
}

// 합성 시나리오(사람 정보 0): 시작 → 답 → 「그게 아니에요」식 정정 → 답 → 마침 시도 → 실행 단계
const TURNS = ['주말에 같이 산책하거나 카페에서 이야기할 친구면 좋겠어요', '아니 그게 아니라, 매일 연락하는 건 부담스럽고 주말에만 보는 게 좋아요', '솔직하고 약속을 잘 지키는 사람이요', '거짓말하는 사람은 싫어요'];
const results = [];
// ONLY=anthropic,openai 처럼 주면 그 업체만(재검사 비용 줄이기)
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
for (const p of PROVIDERS.filter((x) => !ONLY.length || ONLY.includes(x.id))) {
  const key = process.env[p.key];
  if (!key) { results.push({ provider: p.id, model: p.model, status: 'NO_KEY(미검증)' }); continue; }
  const policy = { version: `synthetic-${p.id}-20261003`, providers: { [p.id]: { model: p.model, allow_user_text: true, enabled: true, price: p.price } }, tasks: { default: [p.id] }, switch_on_invalid: false, limits: { max_cost_usd_per_request: 0.25, same_provider_retries: 1 } };
  const env = { AI_POLICY: JSON.stringify(policy), [p.key]: key };
  if (p.id !== 'openai') env.OPENAI_API_KEY = ''; // 다른 업체로 새지 않게
  const h = load(env);
  const r = { provider: p.id, model: p.model, turns: [], errors: [] };
  try {
    const st = await h.call({ action: 'agent_start', tone: 'polite', mode: 'TEXT', goal: 'friend', goalLabel: '편한 친구를 만나고 싶어요', firstAnswer: '편하게 대화할 친구를 찾고 싶어요' });
    r.connect = { status: st.status, ms: st.ms, code: st.body.code ?? null };
    if (st.status !== 200) throw new Error(`start ${st.status} ${st.body.code}`);
    const sid = st.body.session.id; r.turns.push({ ai: st.body.session.current_question });
    let before = st.body.session.current_question;
    for (const text of TURNS) {
      const t = await h.call({ action: 'agent_turn', sessionId: sid, text });
      const q = t.body.session?.current_question ?? null;
      r.turns.push({ user: text, status: t.status, ms: t.ms, kind: t.body.turn?.kind ?? t.body.code, reply: t.body.turn?.reply ?? null, question: q, question_changed: q !== before, phase: t.body.session?.phase });
      if (t.status !== 200) { // 실패 원인: 그 요청의 AI 호출 기록(오류 종류·까닭·토큰 수만 · 글 없음)
        const f = h.state.tables.doit_request_events.filter((x) => x.status === 'failed').at(-1)?.response_payload?.record;
        r.failed_calls = (f?.ai_calls ?? []).map((c) => ({ kind: c.kind, provider: c.provider, error: c.error, reason: c.reason, in: c.input_tokens, out: c.output_tokens, usage: c.usage }));
        r.failed_summary = f?.ai_usage ?? null;
      }
      before = q; if (t.status !== 200 || t.body.session?.phase === 'done') break;
    }
    const sess = h.state.tables.doit_request_events.find((x) => x.action === 'agent_session')?.response_payload;
    const turnRecs = h.state.tables.doit_request_events.filter((x) => x.action === 'agent_turn').map((x) => x.response_payload.record);
    r.correction_applied = turnRecs.some((x) => x.kind === 'correction' || x.flags?.correction === true);
    r.rejected_daily_contact_absent = !JSON.stringify(sess?.profile?.confirmed_preferences ?? []).includes('매일');
    // '매일'이 「매일 연락은 부담」처럼 정정된 뜻으로 남았을 수도 있어 사람이 판단하도록 해당 항목(합성 문장)만 그대로 남긴다
    r.daily_mentions = (sess?.profile?.confirmed_preferences ?? []).map((x) => JSON.stringify(x)).filter((x) => x.includes('매일')).map((x) => x.slice(0, 160));
    r.run = sess?.run ? { outcome: sess.run.outcome, waiting: sess.run.waiting, plan_rev: sess.run.plan_rev, budget: sess.run.budget } : null;
    r.served = [...new Set(turnRecs.flatMap((x) => (x.ai_calls ?? []).map((c) => `${c.provider}:${c.model_served ?? c.model_requested}`)))];
    r.refusals = turnRecs.flatMap((x) => (x.ai_calls ?? []).filter((c) => c.error === 'refused')).length;
  } catch (e) { r.errors.push(String(e.message ?? e).slice(0, 120)); }
  results.push(r);
}
mkdirSync(OUT, { recursive: true });
const byProv = Object.fromEntries(PROVIDERS.map((p) => [p.id, ledger.filter((x) => x.prov === p.id)]));
const summary = { spend_cap_usd: SPEND_CAP_USD, estimated_spend_usd: Number(spent.toFixed(4)), blocked_by_cap: blocked,
  per_provider: Object.fromEntries(Object.entries(byProv).map(([k, v]) => [k, { calls: v.length, ok: v.filter((x) => x.ok).length, tokens_in: v.reduce((n, x) => n + (x.tin ?? 0), 0), tokens_out: v.reduce((n, x) => n + (x.tout ?? 0), 0), usd_confirmed: Number(v.reduce((n, x) => n + (x.usd ?? 0), 0).toFixed(5)), usd_unconfirmed_reserved: Number(v.reduce((n, x) => n + (x.reserved ?? 0), 0).toFixed(5)), p50_ms: v.map((x) => x.ms).sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? null, statuses: [...new Set(v.map((x) => x.status))], errors: [...new Set(v.map((x) => x.err).filter(Boolean))] }])) };
writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
for (const r of results) console.log(`\n## ${r.provider} (${r.model}) connect=${JSON.stringify(r.connect ?? r.status)} correction=${r.correction_applied} rejected_absent=${r.rejected_daily_contact_absent} daily_mentions=${JSON.stringify(r.daily_mentions ?? [])} run=${JSON.stringify(r.run)} errors=${JSON.stringify(r.errors)} failed_calls=${JSON.stringify(r.failed_calls ?? null)} failed_summary=${JSON.stringify(r.failed_summary ?? null)}\n` + (r.turns ?? []).map((t) => `- ${t.user ? `사용자: ${t.user}\n  ` : ''}[${t.kind ?? 'start'} ${t.status ?? ''} ${t.ms ?? ''}ms] 받아주기: ${t.reply ?? '-'} / 질문: ${t.question ?? t.ai ?? '-'}`).join('\n'));
if (spent > SPEND_CAP_USD) process.exit(2);
