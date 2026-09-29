// LEVEL 2 검사 — 실제 OpenAI + 현재 ECHO 서버 코드(doit-understanding/index.ts 그대로).
// 운영 DB·운영 함수·운영 키를 쓰지 않는다: DB 는 이 파일 안의 메모리 가짜 DB, 서버 코드는 로컬 파일, 키는 환경변수 OPENAI_API_KEY.
// 키는 읽기만 하고 출력·저장·로그하지 않는다. 결과 파일에는 검사용 문장(대표 실사용 문장)과 AI 질문만 남는다.
//
// 실행:  OPENAI_API_KEY=… [OPENAI_MODEL=…] node --experimental-strip-types qa/level2/level2-real-ai.mjs [--out 결과.md]
// 연습:  node qa/level2/level2-real-ai.mjs --dry      (가짜 AI 로 이 스크립트의 배관만 확인 — LEVEL 2 결과가 아니다)
//
// 판정: 기계로 볼 수 있는 것(질문 반복·거절 문장 재등장·고정 문장·명시적 실패 수·카드의 「모르겠다」)만 자동으로 적고,
//       "앞 답을 알아들었는가·이어졌는가"는 사람이 대화 기록을 읽고 판정한다(칸을 비워 둔다).
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const DRY = process.argv.includes('--dry');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : null;
const KEY = process.env.OPENAI_API_KEY ?? '';
if (!DRY && !KEY) { console.error('OPENAI_API_KEY 가 없습니다 → LEVEL 2 = 확인 불가. (--dry 로 배관만 확인할 수 있습니다)'); process.exit(2); }

const USER = '11111111-1111-4111-8111-111111111111';
const uuid = () => globalThis.crypto.randomUUID();
let clock = Date.UTC(2026, 8, 24, 0, 0);
const now = () => new Date((clock += 1000)).toISOString();

// ── 메모리 가짜 DB(서버가 부르는 표·RPC 모양만) ──
function fakeDb(state) {
  const tables = { doit_records: state.records, doit_insights: state.insights, doit_request_events: state.events, profiles: state.profiles, profile_photos: [] };
  const chain = (table) => {
    let rows = tables[table] ?? [];
    let insertRow = null;
    const c = {
      select: () => c, order: () => c, limit: () => c, not: () => c,
      eq: (col, v) => { rows = rows.filter((r) => r[col] === v); return c; },
      in: (col, vals) => { rows = rows.filter((r) => vals.includes(r[col])); return c; },
      gte: (col, v) => { rows = rows.filter((r) => String(r[col] ?? '') >= v); return c; },
      insert: (row) => { insertRow = row; return c; },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (ok) => {
        if (insertRow) {
          if (tables[table].some((r) => r.user_id === insertRow.user_id && r.request_id === insertRow.request_id)) return ok({ data: null, error: { code: '23505' } });
          tables[table].push({ ...insertRow, created_at: now() });
          return ok({ data: null, error: null });
        }
        return ok({ data: rows, error: null });
      },
    };
    return c;
  };
  const seen = (args) => state.events.find((e) => e.request_id === args.p_request_id);
  const mark = (args, extra = {}) => state.events.push({ user_id: USER, request_id: args.p_request_id, action: args.p_action, status: 'applied', created_at: now(), ...extra });
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: {} } }, error: null }) },
    from: (table) => chain(table),
    rpc: async (name, args) => {
      const rec = state.records.find((r) => r.id === args.p_record_id);
      const context = { ok: true, record: rec, insights: state.insights, purpose: state.purpose, context_hash: 'h' };
      if (name === 'doit_apply_record_create') {
        const row = { id: uuid(), user_id: USER, text: args.p_text, original_text: args.p_original_text, status: args.p_status, revision: 1, created_at: now(), updated_at: now() };
        state.records.push(row); mark(args, { target_id: row.id });
        return { data: { ok: true, record: row }, error: null };
      }
      if (name === 'doit_followup_context') return { data: rec ? context : { ok: false, code: 'FORBIDDEN' }, error: null };
      if (name === 'doit_begin_followup' || name === 'doit_begin_insight_generate') return { data: { ok: true, duplicate: false, lease_token: args.p_lease_token, context }, error: null };
      if (name === 'doit_finish_followup') {
        if (args.p_error_code) return { data: { ok: false, code: args.p_error_code }, error: null };
        state.events.push({ user_id: USER, request_id: args.p_request_id, action: 'followup_generate', status: 'applied', target_id: args.p_record_id, created_at: now(), response_payload: { question: { text: args.p_question } } });
        return { data: { ok: true, duplicate: false, question: { text: args.p_question, sourceRecordId: args.p_record_id } }, error: null };
      }
      if (name === 'doit_apply_insight_generate') {
        if (seen(args)) return { data: { ok: true, duplicate: true, insights: state.insights.filter((i) => i.request_id === args.p_request_id) }, error: null };
        mark(args, { target_id: args.p_record_id });
        const insights = args.p_candidates.map((c) => ({ id: uuid(), user_id: USER, text: c.text, ai_text: c.text, category: c.category, status: 'candidate', origin: 'ai', source_record_id: args.p_record_id, revision: 1, request_id: args.p_request_id, created_at: now(), updated_at: now() }));
        state.insights.push(...insights);
        return { data: { ok: true, duplicate: false, insights }, error: null };
      }
      if (name === 'doit_apply_insight_transition') {
        const row = state.insights.find((i) => i.id === args.p_insight_id);
        if (seen(args)) return { data: { ok: true, duplicate: true, insight: row }, error: null };
        mark(args);
        Object.assign(row, { status: args.p_new_status, revision: row.revision + 1, request_id: args.p_request_id, updated_at: now() });
        return { data: { ok: true, duplicate: false, insight: row }, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

// ── 연습용 가짜 AI(--dry). LEVEL 2 결과로 쓰지 않는다. ──
function dryAnswer(system, user) {
  const u = JSON.parse(user);
  if (system.includes('너는 다음 질문의 후보만 만든다')) {
    const word = (String(u.record).match(/[가-힣]{2,}/) ?? ['그'])[0];
    return { ack: '', candidate_question: `${word}라면 같이 뭐 하고 싶어요?`, continuation_reason: '방금 답을 이어받는다', source_meaning: word, basis: word, keys: [word] };
  }
  if (system.includes('다음 질문 후보(question)가 대화에 내보내도 되는지')) return { allowed: true };
  if (system.includes('"내가 이렇게 이해했어요" 카드')) return { items: (u.pairs ?? []).slice(0, 2).map((p) => ({ text: `${p.a.slice(0, 20)}을 말했어요.`, basis: p.a.slice(0, 6), source: p.i, category: 'value' })) };
  if (system.includes('topics 의 각 항목')) return { covered: [] };
  if (system.includes("두 문장이 '같은 뜻'")) return { blocked: [] };
  if (system.includes('reply 를 하나로 분류하라')) return { kind: 'answer' };
  return {};
}

function loadServer(state, logs) {
  const source = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const env = { OPENAI_API_KEY: DRY ? 'dry' : KEY, OPENAI_MODEL: process.env.OPENAI_MODEL ?? '', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' };
  const sandbox = {
    exports: {}, console: { log: (line) => logs.push(String(line)), error: () => {} },
    setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => env[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; throw new Error(`Unexpected dependency ${name}`); },
    fetch: DRY
      ? async (_u, init) => { const b = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(dryAnswer(b.messages[0].content, b.messages[1].content)) } }] }), { status: 200 }); }
      : (url, init) => globalThis.fetch(url, init),
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-understanding.ts' });
  return async (payload) => {
    const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ requestId: uuid(), ...payload }) }));
    return { status: res.status, body: await res.json() };
  };
}

const OPENING = '어떤 만남을 원하세요?';
const splitAck = (text) => { const t = String(text ?? ''); const i = t.indexOf('\n'); return i < 0 ? { ack: '', body: t } : { ack: t.slice(0, i).trim(), body: t.slice(i + 1).trim() }; };

// 사용자 차례: 분류 → (답이면) 기록 → 다음 질문. 화면(CoreConversation)과 같은 순서. refresh=true 면 화면이 정정 대상을 잊은 상태(새로고침)를 흉내 낸다.
async function turn(ctx, text, { refresh = false } = {}) {
  const shown = ctx.question ?? OPENING;
  const { ack, body } = splitAck(shown);
  const target = ctx.question ? (ack || body) : null;
  const c = await ctx.call({ action: 'turn_classify', text, question: shown, ...(target ? { correction: target, recordId: ctx.activeId } : {}) });
  const entry = { user: text, shown, kind: c.body.kind, reply: c.body.reply ?? null, rejectedSaved: c.body.rejected ?? null, next: null, strategy: null, error: null };
  ctx.log.push(entry);
  if (!c.body.ok && c.status !== 200) { entry.error = c.body.code; return; }
  const kind = c.body.kind;
  if (kind === 'ask' || kind === 'meta') { ctx.question = kind === 'ask' ? `${c.body.reply}\n${c.body.question ?? body}` : c.body.question; entry.next = ctx.question; return; }
  if (kind === 'fatigue') { entry.next = '(쉬어 가기 안내 — 다른 질문 받기 누름)'; if (ctx.activeId) await next(ctx, entry, { skip: true }); return; }
  if (kind === 'complaint') { if (ctx.activeId) await next(ctx, entry, { skip: true }); return; }
  if (kind === 'correction' && !c.body.rest) {
    if (c.body.again) { if (ctx.activeId) await next(ctx, entry, { skip: true }); return; }
    ctx.pendingCorrection = target; ctx.question = c.body.reply; entry.next = ctx.question; return;
  }
  const correction = refresh ? null : (kind === 'correction' ? target : ctx.pendingCorrection);
  const r = await ctx.call({ action: 'record_create', text, originalText: text, status: 'confirmed' });
  ctx.activeId = r.body.record.id; ctx.pendingCorrection = null; ctx.turns += 1;
  if (ctx.turns >= 5) { entry.next = '(다섯 칸 끝)'; ctx.question = null; return; }
  await next(ctx, entry, { answeredQuestion: body, correction });
}
async function next(ctx, entry, { skip = false, answeredQuestion = null, correction = null } = {}) {
  const r = await ctx.call({ action: 'followup_generate', recordId: ctx.activeId, ...(skip ? { skip: true } : {}), ...(answeredQuestion ? { answeredQuestion } : {}), ...(correction ? { correction } : {}) });
  if (r.body.ok && r.body.question) { ctx.question = r.body.question.text; entry.next = ctx.question; entry.strategy = r.body.strategy ?? null; }
  else { entry.error = r.body.code ?? `HTTP_${r.status}`; }
}

// 대표 실사용 문장(2026-09-24 실기기·지시서). 시나리오마다 새 사용자·새 DB.
const SCENARIOS = [
  { name: 'S1 천천히 알아가기 + 정정(설명 붙음)', purpose: { id: 'romance', label: '연애로 이어질 만남을 원해요' }, steps: [
    '진지하게 알아가고싶어',
    '나는 사람을 빨리 만나는 것보다 천천히 알아가고 싶어.',
    '그 뜻이 아니야. 오래 대화한다는 뜻이 아니라 만나기 전에 부담 없이 알아가고 싶다는 뜻이야.',
    '잘 웃는 사람',
    '주말에 산책하면서 이야기하는 거요',
  ] },
  { name: 'S2 되묻기·불만·지친 말·모르겠어요', purpose: { id: 'romance', label: '연애로 이어질 만남을 원해요' }, steps: [
    '사람을 진지하게 알아가고싶다고',
    '왜 이런 걸 물어봐?',
    '여자를 천천히 진지하게 알아가고싶다고',
    '뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야?',
    '할말이없다 휴',
    '모르겠어요',
    '편하게 대화가 되는 사람이요.',
    '같이 맛있는 거 먹으러 다니고 싶어요',
  ] },
  { name: 'S3 설명 없는 거절 → 새로고침 → 설명', purpose: { id: 'friend', label: '편하게 지낼 친구를 원해요' }, steps: [
    '취미가 비슷한 친구요',
    '잘 웃는 사람',
    { text: '그게 아니에요' },
    { text: '밝은 게 아니라 잘 웃어 주는 게 좋다는 거예요', refresh: true },
    '보드게임 같은 거 같이 하고 싶어요',
    '한 달에 두 번 정도요',
  ] },
];

const results = [];
for (const sc of SCENARIOS) {
  const state = { records: [], insights: [], events: [], profiles: [{ id: USER, purpose_label: sc.purpose.label }], purpose: sc.purpose };
  const logs = [];
  const ctx = { call: loadServer(state, logs), question: null, activeId: null, pendingCorrection: null, turns: 0, log: [] };
  for (const s of sc.steps) {
    if (ctx.turns >= 5) break;
    const step = typeof s === 'string' ? { text: s } : s;
    await turn(ctx, step.text, { refresh: !!step.refresh });
  }
  const synth = ctx.turns >= 5 ? await ctx.call({ action: 'synthesis_generate' }) : null;
  const questions = ctx.log.map((e) => e.next).filter((q) => q && !q.startsWith('('));
  const bodies = questions.map((q) => splitAck(q).body);
  const rejected = state.events.filter((e) => e.action === 'followup_reject').map((e) => e.response_payload?.rejected).filter(Boolean);
  const drops = logs.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((l) => l?.stage === 'compose' && l.step === 'dropped').map((l) => l.reason);
  const auto = {
    '같은 질문 반복 0': new Set(bodies).size === bodies.length,
    '거절한 AI 문장 재등장 0': !rejected.some((x) => questions.some((q) => q.includes(x))),
    '고정 문장("조금만 더 들려줄래요" 등) 0': !questions.some((q) => /조금만 더 들려|한 가지만 더 들려|라고 하셨죠/.test(q)),
    '명시적 실패 수': ctx.log.filter((e) => e.error).length,
    '되묻기·불만·지친 말이 답으로 저장된 수': state.records.filter((r) => /왜 이런 걸|뭘더|할말이없다/.test(r.text)).length,
    '카드에 「모르겠다·할 말 없다」 0': !((synth?.body?.items ?? []).some((i) => /모르겠|할 말이 없/.test(i.text))),
    '[톤] 질문 본문 45자 넘는 것 0': bodies.filter((b) => b.length > 45).length === 0,
    '[톤] 물음표 두 개 이상 0': bodies.filter((b) => (b.match(/\?/g) ?? []).length > 1).length === 0,
    '[톤] 「왜」 연속 0': !bodies.some((b, i) => i > 0 && /왜/.test(b) && /왜/.test(bodies[i - 1])),
    '다섯 칸 뒤 추가 질문 0': ctx.turns < 5 || !ctx.log.slice(ctx.log.findIndex((e) => e.next === '(다섯 칸 끝)') + 1).some((e) => e.next && !e.next.startsWith('(')),
  };
  results.push({ sc, ctx, synth, drops, rejected, auto, informative: state.records.length });
}

const lines = [`# LEVEL 2 결과 ${DRY ? '(연습 — 가짜 AI, LEVEL 2 결과 아님)' : '(실제 OpenAI)'}`, '', `- 모델: ${DRY ? '가짜' : (process.env.OPENAI_MODEL || '서버 기본값')}`, `- 서버 코드: 로컬 doit-understanding/index.ts · DB: 메모리 가짜 DB(운영 DB 아님)`, ''];
for (const r of results) {
  lines.push(`## ${r.sc.name}`, '', '| # | 사용자 | 분류 | 거절 저장 | 다음에 보인 문장 | 전략 | 오류 | 사람 판정: 알아들음·이어짐 |', '|---|---|---|---|---|---|---|---|');
  r.ctx.log.forEach((e, i) => lines.push(`| ${i + 1} | ${e.user} | ${e.kind} | ${e.rejectedSaved ?? ''} | ${(e.next ?? '').replace(/\n/g, ' / ')} | ${e.strategy ?? ''} | ${e.error ?? ''} |  |`));
  lines.push('', `- 통합 카드: ${r.synth ? (r.synth.body.items ?? []).map((i) => i.text).join(' · ') || `(빈 카드 ${r.synth.body.code ?? ''})` : '(다섯 칸 전)'}`);
  lines.push(`- 서버가 떨어뜨린 후보 이유: ${r.drops.join(', ') || '없음'}`);
  lines.push(`- 저장된 거절: ${r.rejected.join(' / ') || '없음'}`);
  for (const [k, v] of Object.entries(r.auto)) lines.push(`- [자동] ${k}: ${v}`);
  lines.push('');
}
const text = lines.join('\n');
if (OUT) writeFileSync(OUT, text); else console.log(text);
