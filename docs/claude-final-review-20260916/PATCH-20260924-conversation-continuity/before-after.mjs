// Before(운영 버전 23 = v14.3) vs After(v14.4) — 같은 가짜 AI 답을 넣었을 때 사용자에게 나가는 질문. [가짜 AI 기준]
import { readFileSync } from 'node:fs'; import vm from 'node:vm'; import ts from '../scratchpad/check-v17/node_modules/typescript/lib/typescript.js';
const USER = '11111111-1111-4111-8111-111111111111';
const R = '22222222-2222-4222-8222-000000000001';
function load(path, ai, state) {
  const out = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler; const seen = [];
  const chain = (rows) => { let f = rows; const c = { select: () => c, order: () => c, limit: () => c, in: (k, v) => { f = f.filter((r) => !(k in r) || v.includes(r[k])); return c; }, eq: (k, v) => { f = f.filter((r) => !(k in r) || r[k] === v); return c; }, gte: () => c, maybeSingle: () => Promise.resolve({ data: f[0] ?? null, error: null }), then: (ok) => ok({ data: f, error: null }) }; return c; };
  const db = { auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: {} } }, error: null }) }, from: (t) => chain(({ doit_records: state.records, doit_insights: [], doit_request_events: state.events })[t] ?? []),
    rpc: async (name, a) => { const context = { record: state.records.find((r) => r.id === a.p_record_id), insights: [], purpose: { id: 'friend', label: '친구' }, context_hash: 'h' };
      if (name.startsWith('doit_begin')) return { data: { ok: true, lease_token: a.p_lease_token, context }, error: null };
      return { data: { ok: true, question: a.p_question ? { text: a.p_question, sourceRecordId: a.p_record_id } : null }, error: null }; } };
  const stage = (s) => s.includes('topics 의 각 항목') ? 'topic' : s.includes('사용자가 방금 한 말을 받아 준 뒤(ack)') ? 'followup' : s.includes('질문의 첫 줄(받아 주는 문장)') ? 'judge' : 'x';
  vm.runInNewContext(out, { exports: {}, console: { log: () => {} }, setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'x', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: () => ({ createClient: () => db }),
    fetch: async (_u, init) => { const b = JSON.parse(init.body); const st = stage(b.messages[0].content); if (st === 'followup') seen.push(JSON.parse(b.messages[1].content)); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(ai[st] ? ai[st]() : {}) } }] })); } });
  return async (body) => { const res = await handler(new Request('http://f/', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: JSON.stringify({ requestId: crypto.randomUUID(), ...body }) })); return { out: await res.json(), seen }; };
}
const scenes = [
  { name: 'A. 대표 예시: 긴 답 뒤 AI 가 딴 주제를 냄', q: '사람을 만날 때 무엇이 중요해요?', a: '편하게 대화가 되는 사람이요.', ai: { topic: () => ({ covered: [] }), followup: () => ({ ack: '', question: '쉬는 날에는 무엇을 하세요?', basis: '', keys: ['휴일'] }), judge: () => ({ allowed: true }) } },
  { name: 'B. 짧은 답 뒤 AI 가 딴 주제를 냄(새 갈래)', q: '어떤 사람한테 끌려요?', a: '잘 웃는 사람', ai: { topic: () => ({ covered: ['partner_style'] }), followup: () => ({ ack: '웃음이 좋으시군요.', question: '쉬는 날에는 무엇을 하세요?', basis: '웃음', keys: ['휴일'] }), judge: () => ({ allowed: true }) } },
  { name: 'C. AI 가 제대로 이어 물음', q: '어떤 사람한테 끌려요?', a: '잘 웃는 사람', ai: { topic: () => ({ covered: ['partner_style'] }), followup: () => ({ ack: '잘 웃는 사람이 좋으시군요.', link: '잘 웃는 사람', question: '그런 사람이랑 만나면 같이 뭐 하고 싶어요?', basis: '잘 웃는 사람', keys: ['잘 웃는 사람'] }), judge: () => ({ allowed: true }) } },
  { name: 'D. AI 가 답을 못 줌(시간 초과 등)', q: '어떤 사람한테 끌려요?', a: '잘 웃는 사람', ai: { topic: () => ({ covered: ['partner_style'] }), followup: () => ({}) } },
];
for (const sc of scenes) {
  console.log(`\n## ${sc.name}\n질문: ${sc.q}\n답: ${sc.a}`);
  for (const [label, path] of [['Before(운영 v23)', 'du-v14.3-deployed-v23.ts'], ['After(v14.4)', 'du-v144.ts']]) {
    const state = { records: [{ id: R, user_id: USER, text: sc.a, created_at: '2026-09-24T01:02:00Z' }], events: [{ user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-24T01:01:00Z', response_payload: { question: { text: sc.q } } }] };
    const { out, seen } = await load(path, sc.ai, state)({ action: 'followup_generate', recordId: R });
    const s = seen[0] ?? {};
    console.log(`- ${label}: "${(out.question?.text ?? '').replace(/\n/g, ' / ')}"  [AI 에 간 직전 질문: ${s.last_question ?? '없음'} · history: ${s.history ? s.history.length + '개' : '안 감'}]`);
  }
}
