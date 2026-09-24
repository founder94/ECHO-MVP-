// 서버(doit-understanding) 실제 코드를 가짜 AI·가짜 DB로 끝까지 돌리는 흐름 검사 (가짜 AI 기준).
// 목적: 대표가 실기기에서 겪은 갈림길을 전부 재현한다 — AI 가 주제 판정을 이상한 형식으로 답할 때, 짧은 답, "모르겠어요",
//       거절한 말과 겹칠 때, 받아 주는 문장이 근거를 인용 못 할 때, 판정 불허, AI 실패. 어느 길이든 "다음 주제 질문 + topic" 이 나와야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const USER = '11111111-1111-4111-8111-111111111111';
const RECORD = '22222222-2222-4222-8222-222222222222';
const uuid = () => globalThis.crypto.randomUUID();

// 가짜 DB: 기록·이해·목적을 시나리오가 준다. RPC 는 서버가 넘긴 값을 그대로 돌려준다(진짜 RPC 계약의 모양만 흉내).
function fakeDb(state) {
  const chain = (rows) => {
    let filtered = rows;
    const c = {
      select: () => c, order: () => c, limit: () => c,
      in: (col, vals) => { filtered = filtered.filter((r) => !(col in r) || vals.includes(r[col])); return c; },
      eq: (col, v) => { filtered = filtered.filter((r) => !(col in r) || r[col] === v); return c; },
      neq: (col, v) => { filtered = filtered.filter((r) => r[col] !== v); return c; },
      gte: (col, v) => { state.gteCalls.push({ col, v }); filtered = filtered.filter((r) => !(col in r) || r[col] >= v); return c; },
      maybeSingle: () => Promise.resolve({ data: filtered[0] ?? null, error: null }),
      then: (ok) => ok({ data: filtered, error: null }),
    };
    return c;
  };
  const tables = () => ({ doit_records: state.records, doit_insights: state.insights, profiles: state.profiles ?? [], profile_photos: state.photos ?? [], doit_request_events: state.events ?? [] });
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER, user_metadata: state.userMeta ?? {} } }, error: null }) },
    from: (table) => chain(tables()[table] ?? []),
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args });
      const context = { record: { id: RECORD, text: state.recordText }, insights: state.insights, purpose: state.purpose, context_hash: 'h1' };
      if (name === 'doit_begin_insight_generate' || name === 'doit_begin_followup') return { data: { ok: true, duplicate: false, lease_token: args.p_lease_token, context }, error: null };
      if (name === 'doit_finish_insight_generate') {
        if (args.p_error_code) return { data: { ok: false, code: args.p_error_code }, error: null };
        const insights = (args.p_candidates ?? []).map((c, i) => ({ id: `ins-${i}`, text: c.text, category: c.category, status: 'candidate', origin: 'ai', source_record_id: RECORD, revision: 1 }));
        return { data: { ok: true, duplicate: false, insights, ...(args.p_rescue ? { rescued: true, rescue: args.p_rescue } : {}), trace: args.p_trace }, error: null };
      }
      if (name === 'doit_finish_followup') {
        if (args.p_error_code) return { data: { ok: false, code: args.p_error_code }, error: null };
        return { data: { ok: true, duplicate: false, question: args.p_question ? { text: args.p_question, sourceRecordId: args.p_record_id } : null }, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
}

// 가짜 AI: 시스템 프롬프트의 문구로 어떤 단계인지 알아내고 시나리오가 준 답을 돌려준다.
function stageOf(system) {
  if (system.includes('가장 분명한 이해를')) return 'gen';
  if (system.includes('각 후보가 grounds')) return 'ground';
  if (system.includes("두 문장이 '같은 뜻'")) return 'semantic';
  if (system.includes('topics 의 각 항목')) return 'topic';
  if (system.includes('아래 기록은 사용자의 답이며')) return 'rescueDir';
  if (system.includes('아래 기록 안에 실제로 있는 내용만')) return 'rescuePlain';
  if (system.includes('사용자가 방금 한 말을 받아 준 뒤(ack)')) return 'followup';
  if (system.includes('질문의 첫 줄(받아 주는 문장)')) return 'judge';
  // v15 이어 묻기·구제는 한 후보 생성기(composeQuestion)를 쓴다. 판정도 새 문구다.
  if (system.includes('너는 다음 질문의 후보만 만든다')) return 'followup';
  if (system.includes('다음 질문 후보(question)가 대화에 내보내도 되는지')) return 'judge';
  if (system.includes('reply 를 하나로 분류하라')) return 'classify';
  if (system.includes('"내가 이렇게 이해했어요" 카드')) return 'synthesis';
  if (system.includes('자기소개를')) return 'draft';
  return 'unknown';
}

function loadServer(ai, state) {
  const source = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const calls = [];
  const payloads = []; // { stage, user }: LLM 에 실제로 넘어간 사용자 자료(가짜 AI 기준 검사용)
  const sandbox = {
    exports: {}, console: { log: (line) => state.logs.push(String(line)), error: () => {} },
    setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      const stage = stageOf(body.messages[0].content);
      calls.push(stage);
      payloads.push({ stage, user: body.messages[1].content });
      // v15: 구제(insight_generate 에서 후보가 없을 때)도 같은 후보 생성기를 쓴다 — 시나리오의 rescueDir/rescuePlain 답을 그대로 준다.
      const fn = ai[stage] ?? (stage === 'followup' ? ai.rescueDir ?? ai.rescuePlain : undefined);
      let answer = fn ? fn(body) : null;
      // v15 후보 계약(명세 §4)은 continuation_reason·source_meaning 을 요구한다. v14.4 모양의 시나리오 후보(link = 이어받는 구절)는
      //   그 구절을 이어받은 뜻으로 옮긴다. link·basis 가 없는 후보(= v14.4 에서도 "끊긴 질문")는 옮기지 않는다 — 새 규칙이 그대로 막는다.
      if (stage === 'followup' && answer && typeof answer === 'object' && !('continuation_reason' in answer)) {
        const meaning = answer.link || answer.basis || '';
        if (meaning) answer = { ...answer, continuation_reason: '직전 답을 이어받는다', source_meaning: meaning };
      }
      if (answer === 'HTTP500') return new Response(JSON.stringify({ error: { code: 'x' } }), { status: 500 });
      if (answer === 'TIMEOUT') return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
      const content = typeof answer === 'string' ? answer : JSON.stringify(answer ?? {});
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: 'doit-understanding.ts' });
  assert.ok(handler, 'Deno.serve 가 핸들러를 등록해야 한다');
  const call = async (payload) => {
    const res = await handler(new Request('http://fn/', { method: 'POST', headers: { Authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ requestId: uuid(), ...payload }) }));
    return { status: res.status, body: await res.json() };
  };
  return { call, calls, payloads };
}

// v15 명시적 실패: 502 AI_ERROR, 기록은 보관, 고정 안전문장·사용자 원문 없음.
const GENERIC = /조금만 더 들려줄래요|한 가지만 더 들려줄래요|라고 하셨죠|방금 한 말/;
function assertExplicitFailure(status, body, reason, logs) {
  assert.equal(status, 502);
  assert.equal(body.code, 'AI_ERROR');
  assert.equal(body.question, undefined);
  assert.equal(body.rescue, undefined);
  assert.doesNotMatch(JSON.stringify(body), GENERIC, '고정 안전문장으로 덮지 않는다');
  if (reason) assert.ok(logs.some((l) => l.includes('"stage":"compose"') && l.includes(`"reason":"${reason}"`)), `떨어진 이유 기록: ${reason}`);
}
const baseState = (over = {}) => ({ recordText: '조용한 사람', records: [{ id: 'r-old', text: '친구를 사귀고 싶어요', created_at: '2026-09-21T00:00:00Z' }], insights: [], purpose: { id: 'friend', label: '친구' }, rpcCalls: [], logs: [], gteCalls: [], ...over });
// v15 계약 변경 근거(명세 2026-09-24 §6·§7): v14.4 까지는 AI 후보가 떨어지면 고정 안전문장("…라고 하셨죠. 조금만 더 들려줄래요?" 등)을 냈고
//   아래 옛 검사들은 그 문장을 정답으로 기대했다. 운영 실기기에서 그 문장이 다섯 번 중 두 번 나가 대화 피로의 원인이 됐다(2026-09-24 09:17~09:21 KST 이벤트 기록).
//   새 계약: 떨어진 이유를 알려 주고 다시 만든다(최대 3번) → 그래도 안 되면 AI_ERROR(502, 기록은 보관) — 고정 문장으로 덮지 않는다.
//   받아 주는 첫 줄의 "…라고 하셨죠" 는 기계적 받아 주기로 쓰지 않는다(§6).
const noCandidates = () => ({ candidates: [] });
// v15 구제 질문도 이어 묻기와 같은 후보 생성·검사(판정 포함)를 거친다. 새 갈래는 방금 답을 받아 주는 첫 줄이 있어야 한다.
const dirRescue = () => ({ ack: '조용한 사람이 좋으시군요.', link: '조용한 사람', basis: '조용한 사람', question: '그런 사람이랑 만나면 같이 뭐 하고 싶어요?' });

test('짧은 답 + 주제 판정이 "항목별 참/거짓 객체"로 와도 → 다음 주제 질문(ack 포함, topic 있음)', async () => {
  const state = baseState();
  const { call, calls } = loadServer({ gen: noCandidates, topic: () => ({ covered: { partner_style: true, together: false, self: false, pace: false } }), rescueDir: dirRescue, judge: () => ({ allowed: true }) }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.insights.length, 0);
  assert.equal(body.rescue.topic, 'together', '끌리는 스타일은 이미 나왔으니 다음 주제');
  assert.match(body.rescue.text, /^조용한 사람이 좋으시군요\.\n/);
  assert.ok(calls.includes('topic') && calls.includes('followup') && calls.includes('judge'), 'v15 구제도 같은 후보 생성기(followup 단계)와 판정을 거친다');
  assert.ok(!state.logs.some((l) => l.includes('topic_parse_failure')));
});

test('주제 판정이 "객체 목록"으로 와도 읽는다', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: [{ id: 'partner_style', covered: true }, { id: 'self', covered: false }] }), rescueDir: dirRescue, judge: () => ({ allowed: true }) }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'together');
});

test('주제 판정이 완전히 엉뚱한 형식이면 → 첫 주제부터 묻고 실패 모양만 로그(원문 없음)', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ result: 'yes', explanation: '조용한 사람' }), rescueDir: dirRescue, judge: () => ({ allowed: true }) }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'partner_style', '목적은 서버 사실로 나왔으니 그 다음 주제');
  const log = state.logs.find((l) => l.includes('topic_parse_failure'));
  assert.ok(log, '실패 로그가 있어야 한다');
  assert.ok(!log.includes('조용한 사람'), '로그에 사용자 원문이 없어야 한다');
});

test('주제 판정 AI 가 HTTP 500 이어도 캐묻기로 떨어지지 않는다', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => 'HTTP500', rescueDir: dirRescue, judge: () => ({ allowed: true }) }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.rescue.topic, 'partner_style');
});

test('"모르겠어요" 도 정상 입력: 이해 후보를 만들지 않고(사실 아님) 다음 주제의 쉬운 질문', async () => {
  const state = baseState({ recordText: '모르겠어요' });
  const { call, calls } = loadServer({ gen: () => { throw new Error('후보 생성을 부르면 안 된다'); }, topic: () => ({ covered: ['partner_style'] }), rescueDir: () => ({ ack: '괜찮아요.', link: '모르겠어요', question: '천천히 떠올려도 돼요. 같이 뭐 하면 좋을까요?' }), judge: () => ({ allowed: true }) }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.insights.length, 0);
  assert.ok(!calls.includes('gen'), 'v15 "모르겠어요"는 나에 대한 이해 후보로 만들지 않는다');
  assert.equal(body.rescue.topic, 'together');
  assert.ok(!/구체적|자세히/.test(body.rescue.text));
});

test('v15 구제 AI 까지 실패하면 고정 안전문장·주제별 고정 질문으로 덮지 않고 명시적 실패(AI_ERROR)', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: [] }), rescueDir: () => 'TIMEOUT' }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assertExplicitFailure(status, body, 'timeout', state.logs);
  assert.ok(!/끌려요|같이 뭐 하고 싶어요/.test(JSON.stringify(body)), 'v14.3 주제별 고정 질문으로 건너뛰지 않는다');
});

test('v14.4 다음 질문(새 갈래): 짧은 답 → CHANGE_DIRECTION. 첫 줄이 방금 답을 받아 주고 그 답에서 이어 넘어갈 때만 나간다', async () => {
  const state = baseState();
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '조용한 사람이 좋으시군요.', link: '조용한 사람', question: '그런 사람이랑 만나면 같이 뭐 하고 싶어요?', basis: '조용한 사람', meaning: '', keys: ['조용한 사람'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'CHANGE_DIRECTION');
  assert.equal(body.topic, 'together');
  assert.equal(body.question.text, '조용한 사람이 좋으시군요.\n그런 사람이랑 만나면 같이 뭐 하고 싶어요?');
});

test('v15 새 갈래라도 방금 답을 받아 주는 첫 줄이 없으면 나가지 않는다(근거 없는 첫 줄·첫 줄 없음) → 세 번 다 떨어지면 명시적 실패', async () => {
  const cases = [
    // 전(v13.3~v14.3)에는 첫 줄만 떼고 이 질문이 그대로 나갔다 = 대표 실기기 P0("왜 갑자기 이걸 묻지?")
    { ack: '차분한 분위기를 좋아하시는군요.', question: '어떤 사람한테 마음이 가요?', basis: '차분한 분위기', meaning: '', keys: ['성향'] },
    { ack: '', link: '조용한 사람', question: '조용한 사람이랑 같이 뭐 하고 싶어요?', basis: '', meaning: '', keys: ['조용한 사람'] },
    { ack: '좋아요.', link: '조용한 사람', question: '쉬는 날에는 주로 뭐 하세요?', basis: '', meaning: '', keys: ['휴일'] },
  ];
  for (const answer of cases) {
    const state = baseState();
    let gens = 0;
    const { call } = loadServer({ topic: () => ({ covered: ['partner_style'] }), followup: () => { gens++; return answer; }, judge: () => ({ allowed: true }) }, state);
    const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
    assertExplicitFailure(status, body, answer.question.includes('쉬는 날') || !answer.link ? null : 'no_bridge', state.logs);
    assert.equal(gens, 3, '떨어진 이유를 알려 주고 세 번까지 다시 만든다');
    assert.ok(!JSON.stringify(body).includes(answer.question), answer.question);
  }
});

test('다음 질문(한 단계 더): 확인한 이해가 있으면 DEEPEN. 질문은 사용자 말과 이어져야 하고(핵심어 겹침), topic 은 없다', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call, payloads } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '조용한 사람이 좋다고 하셨죠.', link: '조용한 사람', question: '조용한 사람과 있을 때 어떤 장면이 제일 편하게 떠올라요?', basis: '조용한 사람', meaning: '', keys: ['조용한 사람'], proposed_strategy: 'DEEPEN', evidence: [{ claim: '조용한 사람이 좋다', supporting_user_text: '조용한 사람' }] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'DEEPEN');
  assert.equal(body.topic, null);
  assert.equal(body.question.text, '조용한 사람이 좋다고 하셨죠.\n조용한 사람과 있을 때 어떤 장면이 제일 편하게 떠올라요?');
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.equal(sent.strategy, 'DEEPEN');
  assert.equal(sent.record, '조용한 사람');
  assert.ok(Array.isArray(sent.hints) && !sent.hints.includes('끌리는 사람'), 'hints 는 아직 안 나온 주제만');
});

test('v15 판정이 "앞뒤가 안 맞는다"고 불허하면 새 갈래든 이어 묻기든 나가지 않는다(첫 줄만 떼고 내보내지 않는다) → 명시적 실패', async () => {
  const state = baseState();
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '조용한 사람이 좋으시군요.', link: '조용한 사람', question: '상대가 알아 두면 좋은 내 모습이 있어요?', basis: '조용한 사람', meaning: '', keys: ['나의 모습'] }),
    judge: () => ({ allowed: false }),
  }, state);
  const r1 = await call({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(r1.status, r1.body, 'not_coherent', state.logs);
  assert.ok(!JSON.stringify(r1.body).includes('상대가 알아 두면'), '전: 첫 줄만 떼고 이 질문이 나갔다');
  const state2 = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call: call2 } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '', link: '조용한 사람', question: '조용한 사람이 좋은 건 혹시 외로워서인가요?', basis: '조용한 사람', meaning: '외로움', keys: ['조용한 사람'] }),
    judge: () => ({ allowed: false }),
  }, state2);
  const r2 = await call2({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(r2.status, r2.body, 'not_coherent', state2.logs);
  assert.ok(!/외로/.test(JSON.stringify(r2.body)), '단정(외로움)을 전제로 한 질문은 나가지 않는다');
});

test('다음 질문: 거절 뒤에는 RECOVER_FROM_REJECTION. 기계적 첫 줄("…라고 하셨죠")은 떼고 질문만, 질문 자체가 거절과 겹치면 나가지 않는다(고정 되돌리기 문장 없음 → 명시적 실패)', async () => {
  const rejected = { id: 'i0', text: '조용한 사람이 좋다', ai_text: '조용한 사람이 좋다', status: 'rejected', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ insights: [rejected] });
  const { call } = loadServer({
    topic: () => ({ covered: [] }),
    followup: () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '요즘 새로운 사람 만나는 건 어때요?', basis: '조용한 사람', meaning: '', keys: ['만나는 일'] }),
    judge: () => ({ allowed: true }), semantic: () => ({ blocked: [] }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'RECOVER_FROM_REJECTION');
  assert.equal(body.question.text, '요즘 새로운 사람 만나는 건 어때요?');
  const state2 = baseState({ insights: [rejected] });
  const { call: call2 } = loadServer({
    topic: () => ({ covered: [] }),
    followup: () => ({ ack: '', question: '조용한 사람이 좋다는 건 어떤 뜻인가요?', basis: '조용한 사람', meaning: '', keys: ['조용한 사람'] }),
    judge: () => ({ allowed: true }),
  }, state2);
  const r2 = await call2({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(r2.status, r2.body, 'rejected', state2.logs);
  assert.ok(!JSON.stringify(r2.body).includes('조용한 사람이 좋다는'), '거절한 뜻이 되살아나지 않는다');
});

test('주제가 다 나오면(5/5) 새로운 면을 여는 질문, topic 은 null · 기계적 첫 줄("…라고 하셨죠")은 떼고 질문만', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '느긋한 편이다', status: 'confirmed', origin: 'self', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style', 'together', 'self', 'pace'] }),
    followup: () => ({ ack: '느긋한 편이라고 하셨죠.', link: '느긋한 편', question: '느긋하게 만나면 어떤 순간이 제일 편해요?', basis: '느긋한 편', meaning: '', keys: ['느긋'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.topic, null);
  assert.equal(body.question.text, '느긋하게 만나면 어떤 순간이 제일 편해요?');
});

test('후보가 살아남으면 구제 없이 후보 카드(4버튼)로 간다 — 첫 이야기(limit 1)', async () => {
  const state = baseState({ recordText: '말이 잘 통하는 조용한 사람이 좋아요' });
  const { call } = loadServer({
    gen: () => ({ candidates: [{ category: 'value', text: '말이 잘 통하는 사람을 원한다', basis: '말이 잘 통하는', keys: ['말이 잘 통하는'] }] }),
    ground: () => ({ grounded: [0] }),
  }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD, limit: 1 });
  assert.equal(body.insights.length, 1);
  assert.equal(body.rescue, undefined);
});

test('주제 판정에 최근 기록들이 함께 들어간다(같은 주제를 또 묻지 않기 위한 재료)', async () => {
  const state = baseState();
  let seen = null;
  const { call } = loadServer({ gen: noCandidates, topic: (body) => { seen = JSON.parse(body.messages[1].content); return { covered: [] }; }, rescueDir: dirRescue, judge: () => ({ allowed: true }) }, state);
  await call({ action: 'insight_generate', recordId: RECORD });
  assert.deepEqual(seen.records, ['친구를 사귀고 싶어요']);
  assert.equal(seen.record, '조용한 사람');
  assert.deepEqual(seen.topics, ['partner_style', 'together', 'self', 'pace']);
});

test('v15 다음 질문 생성이 어떤 이유로든 실패하면(예: AI 가 질문을 안 줌) 세 번 다시 만들고, 그래도 없으면 명시적 실패 — 고정 문장 없음', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z', created_at: '2026-09-22T00:00:00Z' }] });
  let gens = 0;
  const { call } = loadServer({ topic: () => ({ covered: ['partner_style'] }), followup: () => { gens++; return { nothing: true }; } }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(status, body, 'no_question', state.logs);
  assert.equal(gens, 3);
  const finish = state.rpcCalls.find((c) => c.name === 'doit_finish_followup');
  assert.equal(finish.args.p_error_code, 'AI_ERROR', 'DB 에는 실패로 남는다(질문으로 저장하지 않는다)');
});

test('v13.4 회차: "처음부터 다시" 시각 이후의 기록·확인만 주제 판정에 들어간다(이전 회차는 지우지 않는다)', async () => {
  const since = '2026-09-22T05:00:00Z';
  const state = baseState({
    userMeta: { doit_round_started_at: since },
    records: [{ id: 'r-old', user_id: USER, text: '지난 회차 말', created_at: '2026-09-21T00:00:00Z' }, { id: 'r-new', user_id: USER, text: '이번 회차 말', created_at: '2026-09-22T06:00:00Z' }],
    insights: [{ id: 'i-old', text: '지난 회차 확인', status: 'confirmed', origin: 'ai', source_record_id: 'r-old', updated_at: '2026-09-21T01:00:00Z', created_at: '2026-09-21T01:00:00Z' },
               { id: 'i-new', text: '이번 회차 확인', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T06:30:00Z', created_at: '2026-09-22T06:30:00Z' }],
  });
  let seen = null;
  const { call } = loadServer({ gen: noCandidates, topic: (body) => { seen = JSON.parse(body.messages[1].content); return { covered: [] }; }, rescueDir: dirRescue, judge: () => ({ allowed: true }) }, state);
  await call({ action: 'insight_generate', recordId: RECORD });
  assert.deepEqual(seen.records, ['이번 회차 말']);
  assert.deepEqual(seen.confirmed, ['이번 회차 확인']);
  assert.ok(state.gteCalls.some((g) => g.col === 'created_at' && Date.parse(g.v) === Date.parse(since)));
});

test('v13.4 connection_preview: 준비 상태 + 같은 목적 대기 인원 + 겹치는 후보 수 + 겹친 내 말. 다른 사람 정보는 없다', async () => {
  const state = baseState({
    profiles: [
      { id: USER, purpose_id: 'friend', purpose_label: '친구', bio: '조용히 대화하는 걸 좋아해요', verification_status: 'none' },
      { id: 'u2', purpose_id: 'friend', purpose_label: '친구', bio: 'x', verification_status: 'verified' },
      { id: 'u3', purpose_id: 'friend', purpose_label: '친구', bio: 'y', verification_status: 'verified' },
      { id: 'u4', purpose_id: 'romantic', purpose_label: '연인', bio: 'z', verification_status: 'verified' },
    ],
    photos: [{ user_id: USER, slot: 1 }, { user_id: USER, slot: 2 }, { user_id: USER, slot: 5 }],
    insights: [
      { id: 'a', user_id: USER, text: '조용한 곳을 선호한다', status: 'confirmed', created_at: '2026-09-22T00:00:00Z' },
      { id: 'b', user_id: USER, text: '서로를 알아가는 것이 중요하다', status: 'confirmed', created_at: '2026-09-22T00:00:00Z' },
      { id: 'c', user_id: 'u2', text: '조용한 곳을 선호한다', status: 'confirmed', created_at: '2026-09-22T00:00:00Z' },
      { id: 'd', user_id: 'u3', text: '시끄러운 파티가 좋다', status: 'confirmed', created_at: '2026-09-22T00:00:00Z' },
    ],
  });
  const { call } = loadServer({}, state);
  const { status, body } = await call({ action: 'connection_preview' });
  assert.equal(status, 200);
  assert.equal(body.purpose, '친구');
  assert.deepEqual(body.readiness, { answers: 1, answers_needed: 5, confirmed: 2, photos: 2, photos_needed: 3, intro: true, phone_verified: false });
  assert.equal(body.eligible, false);
  assert.equal(body.waiting, 2, '같은 목적(friend) 다른 사람 2명');
  assert.equal(body.candidates, 1, '확인한 말이 겹치는 사람 1명');
  assert.deepEqual(body.common, ['조용한 곳을 선호한다']);
  const dumped = JSON.stringify(body);
  assert.ok(!dumped.includes('u2') && !dumped.includes('시끄러운'), '다른 사람의 id·글은 나가지 않는다');
});

// ── 지시서 §17 필수 QA 시나리오(가짜 AI 기준) ──────────────────────────────
const PERSON = '예전에 친했던 사람이 자꾸 생각나요.';
const cov = () => ({ covered: [] });

test('TEST A 정상 맥락 연결: 첫 자유 답 → 서버 전략 EXPLORE_USER_MEANING, LLM 에 원문·전략이 넘어가고, 두 갈래 되묻기(CLARIFY)는 사용자 말에서 나왔을 때만 받는다', async () => {
  const state = baseState({ recordText: PERSON, records: [] });
  const { call, payloads } = loadServer({
    topic: cov,
    followup: () => ({ ack: '', link: '친했던 사람', question: '친했던 사람을 다시 만나고 싶어요? 아니면 추억 쪽이에요?', basis: '', meaning: '', keys: ['그 사람'], proposed_strategy: 'CLARIFY', evidence: [{ claim: '특정 사람이 떠오른다', supporting_user_text: '친했던 사람' }] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'CLARIFY');
  assert.match(body.question.text, /^친했던 사람을 다시 만나고 싶어요\? 아니면/);
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.equal(sent.record, PERSON);
  assert.equal(sent.strategy, 'EXPLORE_USER_MEANING');
  assert.deepEqual(sent.rejected, []);
});

test('TEST B 잘못된 해석 거절: 거절한 뜻이 LLM 자료에 "거절"로 넘어가고, 같은 뜻의 질문은 나가지 않으며, 전략이 실제로 바뀐다', async () => {
  const rejected = { id: 'i0', text: '다시 가까워지고 싶은 마음', ai_text: '다시 가까워지고 싶은 마음', status: 'rejected', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ recordText: PERSON, insights: [rejected] });
  const { call, payloads } = loadServer({
    topic: cov,
    // v15 후보 계약 모양(이어받는 이유 포함) — 거절 검사가 떨어뜨리는지 본다.
    followup: () => ({ ack: '', question: '다시 가까워지고 싶은 마음이 큰가요?', basis: '친했던 사람', meaning: '재회 바람', keys: ['가까워지고'], continuation_reason: '떠오르는 사람을 이어받는다', source_meaning: '친했던 사람이 생각난다' }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  // v15: 같은 뜻만 계속 오면 세 번 다시 만든 뒤 명시적 실패(전: 고정 되돌리기 문장 "제가 잘못 알아들었네요").
  assertExplicitFailure(status, body, 'rejected', state.logs);
  assert.ok(!JSON.stringify(body).includes('가까워지'), '거절한 뜻이 다음 질문에 다시 나오면 안 된다');
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.deepEqual(sent.rejected, ['다시 가까워지고 싶은 마음']);
  assert.equal(sent.strategy, 'RECOVER_FROM_REJECTION');
  assert.equal(state.recordText, PERSON, '사용자 원문은 그대로');
});

test('TEST C 사용자 정정: 고친 말이 최우선 근거, 정정 전 AI 문장은 superseded 로 넘어가고, 여전히 "좋아한다"고 전제한 질문은 나가지 않는다', async () => {
  const corrected = { id: 'i1', text: '좋아하는 게 아니라 그냥 미안한 거예요', ai_text: '그 사람을 아직 좋아한다', status: 'corrected', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ recordText: PERSON, insights: [corrected] });
  const { call, payloads } = loadServer({
    topic: cov,
    followup: () => ({ ack: '', question: '아직 좋아하는 마음이 남아 있어서 그런 걸까요?', basis: '', meaning: '아직 좋아함', keys: ['좋아하는'] }),
    judge: (body) => ({ allowed: !JSON.parse(body.messages[1].content).question.includes('좋아') }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(status, body, null, state.logs); // v15 정정 무시 질문만 오면 나가지 않고 명시적 실패
  assert.ok(!JSON.stringify(body).includes('좋아'), '정정 무시 질문은 나가지 않는다');
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.equal(sent.strategy, 'ACKNOWLEDGE_CORRECTION');
  assert.equal(sent.confirmed[0].text, '좋아하는 게 아니라 그냥 미안한 거예요');
  assert.equal(sent.confirmed[0].kind, 'corrected');
  assert.deepEqual(sent.superseded, ['그 사람을 아직 좋아한다']);
});

test('TEST D 직접 설명: 자유 입력 원문이 다음 맥락의 중심(confirmed 첫 항목, kind self)이고, 그 말을 인용한 질문이 나간다', async () => {
  const self = { id: 'i2', text: '좋아하는 건 아니고, 그때 제가 너무 무심했던 게 자꾸 걸려요', status: 'confirmed', origin: 'self', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ recordText: PERSON, insights: [self] });
  const { call, payloads } = loadServer({
    topic: cov,
    followup: () => ({ ack: '무심했던 게 걸린다고 하셨죠.', link: '무심했던', question: '지금 그 사람에게 하고 싶은 말이 있다면 뭐예요?', basis: '무심했던', meaning: '', keys: ['그 사람'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.strategy, 'EXPLORE_USER_MEANING');
  assert.equal(body.question.text, '무심했던 게 걸린다고 하셨죠.\n지금 그 사람에게 하고 싶은 말이 있다면 뭐예요?');
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.equal(sent.confirmed[0].kind, 'self');
  assert.equal(sent.confirmed[0].text, self.text);
});

test('TEST E 완전히 다른 주제: LLM 이 사용자 원문 인용과 함께 CHANGE_DIRECTION 을 제안하면 서버가 받는다. 인용이 원문에 없으면 받지 않는다', async () => {
  const WORK = '사람보다 요즘 제 일이 더 걱정돼요.';
  const state = baseState({ recordText: WORK, records: [{ id: 'r-old', text: PERSON, created_at: '2026-09-21T00:00:00Z' }] });
  const { call } = loadServer({
    topic: cov,
    followup: () => ({ ack: '요즘 일이 더 걱정되시는군요.', link: '일이 더 걱정', question: '일에서 지금 제일 걱정되는 건 어떤 부분이에요?', basis: '일이 더 걱정', meaning: '', keys: ['일'], proposed_strategy: 'CHANGE_DIRECTION', evidence: [{ claim: '일이 더 걱정', supporting_user_text: '제 일이 더 걱정' }] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.strategy, 'CHANGE_DIRECTION');
  assert.equal(body.topic, null);
  assert.equal(body.question.text, '요즘 일이 더 걱정되시는군요.\n일에서 지금 제일 걱정되는 건 어떤 부분이에요?', '사용자가 스스로 옮긴 새 주제도 첫 줄로 받아 준 뒤 따라간다');
  const state2 = baseState({ recordText: WORK });
  const { call: call2 } = loadServer({
    topic: cov,
    followup: () => ({ ack: '', link: '걱정', question: '일에서 지금 제일 걱정되는 건 어떤 부분이에요?', basis: '', meaning: '', keys: ['걱정'], proposed_strategy: 'CHANGE_DIRECTION', evidence: [{ claim: '연애가 걱정', supporting_user_text: '연애가 걱정' }] }),
    judge: () => ({ allowed: true }),
  }, state2);
  const { body: b2 } = await call2({ action: 'followup_generate', recordId: RECORD });
  assert.equal(b2.strategy, 'EXPLORE_USER_MEANING', '원문에 없는 인용으로는 전략을 바꾸지 못한다');
  assert.equal(b2.question.text, '일에서 지금 제일 걱정되는 건 어떤 부분이에요?', '질문 자체는 사용자 말(걱정)과 이어지므로 나간다');
});

test('TEST F 반복 방지: 이미 물은 질문(이벤트 저장분)이 LLM 자료로 넘어가고, 같은 뜻의 질문이 다시 오면 버리고 다른 문장으로 이어간다', async () => {
  const askedText = '받아요.\n그 사람이 떠오르면 제일 먼저 어떤 생각이 들어요?';
  const state = baseState({ recordText: PERSON, events: [{ user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T01:00:00Z', response_payload: { question: { text: askedText, sourceRecordId: RECORD } } }] });
  const { call, payloads } = loadServer({
    topic: cov,
    followup: () => ({ ack: '', question: '그 사람이 떠오르면 제일 먼저 어떤 생각이 드나요?', basis: '', meaning: '', keys: ['그 사람'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(status, body, 'repeat', state.logs);
  assert.ok(!JSON.stringify(body).includes('제일 먼저 어떤 생각'), '같은 질문을 다시 묻지 않는다');
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.deepEqual(sent.asked_questions, ['그 사람이 떠오르면 제일 먼저 어떤 생각이 들어요?']);
  const retry = JSON.parse(payloads.filter((p) => p.stage === 'followup')[1].user);
  assert.match(retry.rejected_candidates[0].why, /이미 물은 질문/, 'v15 떨어진 이유를 알려 주고 다시 만든다');
});

test('질문 하나 규칙(§8): 물음표 둘("아니면" 없음)·의문사 셋 문장은 버린다(v15: 대체 문장 없이 명시적 실패)', async () => {
  for (const q of ['왜 생각나요? 그때 기분은 어땠어요?', '그 사람이 왜 생각나고 그때 어떤 기분이었고 어떻게 하고 싶은지 알려주세요.']) {
    const state = baseState({ recordText: PERSON });
    const { call } = loadServer({ topic: cov, followup: () => ({ ack: '', question: q, basis: '', meaning: '', keys: ['그 사람'] }), judge: () => ({ allowed: true }) }, state);
    const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
    assertExplicitFailure(status, body, 'multi', state.logs);
    assert.ok(!JSON.stringify(body).includes(q), q);
  }
});

test('§21-11 화면 응답에는 내부 진단(trace)·구제 종류(kind)가 없다. 거절 뒤 후보가 없으면 구제도 되돌리기 전략', async () => {
  const rejected = { id: 'i0', text: '다시 가까워지고 싶은 마음', ai_text: '다시 가까워지고 싶은 마음', status: 'rejected', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ recordText: PERSON, insights: [rejected] });
  let n = 0;
  const { call } = loadServer({ gen: noCandidates, topic: cov, semantic: () => ({ blocked: [] }), judge: () => ({ allowed: true }),
    rescuePlain: () => (++n === 1 ? { question: '다시 가까워지고 싶은 마음이 큰가요?' } : { ack: '', question: '그 사람이 생각날 때 어떤 장면이 먼저 떠올라요?', basis: '친했던 사람', keys: ['그 사람'], continuation_reason: '떠오르는 사람을 이어받는다', source_meaning: '친했던 사람이 생각난다' }) }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.trace, undefined);
  assert.equal(body.rescue.kind, undefined);
  assert.equal(body.rescue.strategy, 'RECOVER_FROM_REJECTION');
  assert.ok(!body.rescue.text.includes('가까워지'), '거절한 뜻은 첫 후보에서 떨어졌다');
  assert.equal(body.rescue.text, '그 사람이 생각날 때 어떤 장면이 먼저 떠올라요?', '두 번째 후보로 이어 간다(고정 되돌리기 문장 아님)');
});

// ── v13.6 대표 실기기 발견(2026-09-22 09:50 KST): "연애에서 중요한 점?" → "진실된마음" → "방금 남긴 기록에서 가장 마음에 남는 부분은…"(생뚱맞음) ──
const LAST_Q = '연애에 대해 어떤 점이 가장 중요하다고 생각하나요?';
const allCovered = () => ({ covered: ['partner_style', 'together', 'self', 'pace'] });
const answeredState = (over = {}) => baseState({ recordText: '진실된마음', events: [
  { user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T00:50:24Z', response_payload: { question: { text: LAST_Q, sourceRecordId: 'r-old' } } },
  { user_id: USER, action: 'insight_generate', status: 'applied', created_at: '2026-09-22T00:40:00Z', response_payload: { rescue: { text: '방금 남긴 기록에서 "친구" 부분을 조금 더 들려주실 수 있을까요?', kind: 'quoted_question' } } },
], ...over });

test('v13.6 근거 인용이 띄어쓰기만 다르면("진실된 마음" vs "진실된마음") 후보를 버리지 않는다', async () => {
  const state = answeredState();
  const { call } = loadServer({
    gen: () => ({ candidates: [{ category: 'value', text: '진실된 마음을 중요하게 여긴다', basis: '진실된 마음', keys: ['진실된마음'] }] }),
    ground: () => ({ grounded: [0] }),
  }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD, limit: 1 });
  assert.equal(status, 200);
  assert.equal(body.insights.length, 1, '후보가 살아남아 4버튼 카드로 간다');
});

test('v13.6 주제가 다 나온 뒤 짧은 답: 새 갈래 대신 직전 질문과 답을 함께 읽고 이어 묻는다(AI 자료에 직전 질문 포함, 일반 문장으로 안 떨어짐)', async () => {
  const state = answeredState();
  const { call, payloads } = loadServer({
    gen: noCandidates, topic: allCovered, judge: () => ({ allowed: true }),
    rescuePlain: () => ({ ack: '', link: '진실된마음', question: '진실된 마음을 느꼈던 순간이 있다면 언제였어요?' }),
  }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.strategy, 'EXPLORE_USER_MEANING');
  assert.equal(body.rescue.text, '진실된 마음을 느꼈던 순간이 있다면 언제였어요?');
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.equal(sent.last_question, LAST_Q, 'AI 자료에 직전 질문이 들어간다');
  assert.ok(state.logs.some((l) => l.includes('"stage":"compose"') && l.includes('"step":"accepted"')));
});

test('v15 AI 구제가 반복 질문을 내면 버리고, 떨어진 이유를 알려 준 뒤 다시 만든 질문으로 이어간다(고정·인용 문장 아님)', async () => {
  const state = answeredState();
  let n = 0;
  const { call, payloads } = loadServer({ gen: noCandidates, topic: allCovered, judge: () => ({ allowed: true }),
    rescuePlain: () => (++n === 1
      ? { ack: '진실된 마음이 중요하시군요.', link: '진실된마음', question: '연애에 대해 어떤 점이 가장 중요하다고 생각하세요?' }
      : { ack: '', link: '진실된마음', question: '그런 마음이 느껴지는 사람은 어떤 행동을 해요?' }) }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.text, '그런 마음이 느껴지는 사람은 어떤 행동을 해요?');
  assert.doesNotMatch(body.rescue.text, GENERIC);
  const second = JSON.parse(payloads.filter((p) => p.stage === 'followup')[1].user);
  assert.match(second.rejected_candidates[0].why, /이미 물은 질문/);
  assert.ok(state.logs.some((l) => l.includes('"reason":"repeat"')));
});

test('v15 고정 대체 문장이 없다: 한 글자 답("음")에 AI 가 질문을 못 주면 "방금 한 말…"·"그 이야기…" 대신 명시적 실패', async () => {
  const state = baseState({ recordText: '음', events: [{ user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T00:50:24Z', response_payload: { question: { text: '어떤 사람한테 끌려요?', sourceRecordId: 'r-old' } } }] });
  const { call } = loadServer({ topic: () => ({ covered: [] }), followup: () => ({ ack: '', question: '' }) }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(status, body, 'no_question', state.logs);
});

// ── v13.7 대표 실기기 발견(2026-09-22 15:16 KST): 긴 답에 고정 문장이 나가 "상대에게 바라는 [긴 문장]는 어떤 모습인가요?"로 깨졌다 ──
const LONG_ANSWER = '나도 진실하게 대하면 상대도 진실하게 대해줬으면 하는 바램이있어';
const PREV_Q = '상대에게 어떤 진실한 마음을 바라나요?';
const longState = (over = {}) => baseState({ recordText: LONG_ANSWER, events: [
  { user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T06:14:50Z', response_payload: { question: { text: `진실된 마음이 마음에 남는다고 하셨죠.\n${PREV_Q}`, sourceRecordId: 'r-old' } } },
], insights: [{ id: 'i1', text: '진실된 마음을 중요하게 여긴다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T06:15:00Z' }], ...over });

test('v13.7 이어 묻기가 판정 불허여도 ack 를 떼고 다시 판정해 통과하면 질문만 내보낸다(고정 문장으로 안 떨어짐)', async () => {
  const state = longState();
  let call = 0;
  const { call: post } = loadServer({
    topic: allCovered,
    followup: () => ({ ack: '진실하게 대하고 싶다고 하셨죠.', link: '진실하게 대하면', question: '진실하게 대해 준다고 느꼈던 순간이 있었어요?', basis: '진실하게', meaning: '', keys: ['진실'] }),
    judge: () => (++call === 1 ? { allowed: false } : { allowed: true }),
  }, state);
  const { status, body } = await post({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.question.text, '진실하게 대해 준다고 느꼈던 순간이 있었어요?', '첫 줄을 떼도 질문 스스로 방금 답을 이어받을 때만 첫 줄 없이 나간다');
  assert.ok(state.logs.some((l) => l.includes('ack_dropped_pass')));
});

test('v15 판정이 두 번 다 불허면(첫 줄 떼고도) 나가지 않는다 — 긴 답을 끼워 넣은 대체 문장도 없다(명시적 실패)', async () => {
  const state = longState();
  const { call } = loadServer({
    topic: allCovered,
    followup: () => ({ ack: '진실하게 대하고 싶다고 하셨죠.', link: '진실하게', question: '아직 그 사람을 좋아하는 건가요?', basis: '진실하게', meaning: '', keys: ['진실'] }),
    judge: () => ({ allowed: false }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(status, body, 'not_coherent', state.logs);
  assert.ok(!JSON.stringify(body).includes(LONG_ANSWER));
});

// ── v14 대표 실기기 발견(2026-09-22 16:29 KST) ──────────────────────────────
// v13.7 은 "14자 이하면 그대로 인용" 이었는데, 구절이 들어오면 조사 자리에서 그대로 깨졌다.
// 운영에 실제로 나간 문장: "상대에게 바라는 에너지가 뺏기가 싫어서는 어떤 모습일까요?"
// v14 규칙: 인용은 `"..."라고 하셨죠.` 한 줄로만. 질문 줄에는 사용자 말을 넣지 않는다.
const BROKEN_CASE = '에너지가 뺏기가 싫어서'; // 12자 — v13.7 의 14자 문턱을 통과해 버렸다
for (const quote of [BROKEN_CASE, '배려', '그냥 아무생각없어', '좋은 에너지면 같이 시너지를 느낄수있지만 싸우고 그럼 에너지가 서비된다']) {
  test(`v15 AI 가 실패해도 사용자 말을 끼워 넣은 대체 문장을 만들지 않는다(대체 문장 자체가 없다): "${quote}"`, async () => {
    const state = baseState({ recordText: quote, events: [{ user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T06:14:50Z', response_payload: { question: { text: PREV_Q, sourceRecordId: 'r-old' } } }] });
    const { call } = loadServer({ topic: allCovered, followup: () => ({ ack: '', question: '' }) }, state);
    const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
    assertExplicitFailure(status, body, 'no_question', state.logs);
    assert.ok(!JSON.stringify(body).includes(quote), '응답에 사용자 말을 끼워 넣지 않는다');
    assert.ok(!JSON.stringify(body).includes('상대에게 바라는'), '옛 깨진 틀이 살아 있지 않다');
  });
}

test('v14 질문 말투 규칙: 짧게, 예시 없이, 무거운 추상 물음 금지', () => {
  const src = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const style = src.slice(src.indexOf('const QUESTION_STYLE'), src.indexOf('const ACK_STYLE'));
  assert.match(style, /45자 이내/);
  assert.match(style, /예시는 붙이지 않는다/);
  for (const banned of ['어떤 모습일까요', '어떤 태도를 기대하나요', '어떤 마음인가요']) {
    assert.ok(style.includes(banned), `금지 목록에 "${banned}" 가 없다`);
  }
  // 조사 끼워 넣기 도우미는 없앴다.
  assert.ok(!src.includes('function particle('), 'particle 이 남아 있으면 조사 끼워 넣기가 되살아날 수 있다');
  assert.ok(!src.includes('SHORT_QUOTE_MAX'), 'v13.7 의 글자수 문턱이 남아 있다');
});

// ── v14.1 소개글 「AI가 대신 작성하기」(profile_draft) — 가짜 AI 기준 ──
const ANSWERS = [
  { id: 'a1', text: '친구처럼 편하게 지낼 사람을 만나고 싶어요', created_at: '2026-09-23T01:00:00Z' },
  { id: 'a2', text: '말이 잘 통하고 약속을 잘 지키는 사람이 좋아요', created_at: '2026-09-23T01:01:00Z' },
  { id: 'a3', text: '주말에 같이 산책하고 전시 보러 가고 싶어요', created_at: '2026-09-23T01:02:00Z' },
  { id: 'a4', text: '저는 처음엔 조용한데 친해지면 말이 많아요', created_at: '2026-09-23T01:03:00Z' },
  { id: 'a5', text: '천천히 알아가는 게 좋아요', created_at: '2026-09-23T01:04:00Z' },
];
const draftState = (over = {}) => baseState({ records: ANSWERS, insights: [], profiles: [{ id: USER, purpose_label: '친구' }], ...over });
const draftPayload = (payloads) => JSON.parse(payloads.find((p) => p.stage === 'draft').user);

test('v14.1 소개 초안: 맞다고 한 말이 없어도 다섯 가지 내 답으로 쓴다(재료 = 내 답 + 고른 목적)', async () => {
  const state = draftState();
  const { call, calls, payloads } = loadServer({ draft: () => ({ lines: [
    { text: '저는 처음엔 조용하지만 친해지면 말이 많아요.', basis: '처음엔 조용한데 친해지면 말이 많아요' },
    { text: '주말에 같이 산책하고 전시를 볼 친구를 찾고 있어요.', basis: '주말에 같이 산책하고 전시 보러 가고 싶어요' },
  ] }) }, state);
  const { status, body } = await call({ action: 'profile_draft' });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.lines.length, 2);
  assert.ok(calls.includes('draft'));
  const sent = draftPayload(payloads);
  assert.equal(sent.answers.length, 5, '다섯 가지 답이 모두 재료로 간다');
  assert.equal(sent.purpose, '친구');
});

test('v14.1 소개 초안: 확인 안 한 AI 후보·아니라고 한 해석은 재료로 보내지 않는다', async () => {
  const state = draftState({ insights: [
    { text: '사람들 앞에서 긴장을 많이 하는 편', status: 'candidate', created_at: '2026-09-23T01:05:00Z' },
    { text: '혼자 있는 시간을 싫어하는 사람', status: 'rejected', created_at: '2026-09-23T01:06:00Z' },
    { text: '약속을 지키는 게 나에게 중요하다', status: 'confirmed', created_at: '2026-09-23T01:07:00Z' },
  ] });
  const { call, payloads } = loadServer({ draft: () => ({ lines: [{ text: '저는 약속을 지키는 걸 중요하게 여겨요.', basis: '약속을 지키는 게 나에게 중요하다' }] }) }, state);
  const { body } = await call({ action: 'profile_draft' });
  assert.equal(body.ok, true);
  const sent = draftPayload(payloads);
  assert.deepEqual(sent.confirmed, ['약속을 지키는 게 나에게 중요하다']);
  assert.ok(!JSON.stringify(sent).includes('긴장을 많이'), '확인 안 한 후보는 재료가 아니다');
  assert.ok(!JSON.stringify(sent).includes('혼자 있는 시간을 싫어하는'), '거절한 해석은 재료가 아니다');
});

test('v14.1 소개 초안: 근거 없는 문장·거절한 해석과 같은 문장·연락처·쓰지 않는 단어는 버리고 남은 것만 준다', async () => {
  const state = draftState({ insights: [{ text: '혼자 있는 시간을 싫어하는 사람', status: 'rejected', created_at: '2026-09-23T01:06:00Z' }] });
  const { call } = loadServer({ draft: () => ({ lines: [
    { text: '저는 요리를 아주 잘해요.', basis: '요리를 잘해요' },                                  // 근거 없음(지어냄)
    { text: '저는 혼자 있는 시간을 싫어하는 사람이에요.', basis: '천천히 알아가는 게 좋아요' },          // 거절한 해석과 같음
    { text: '연락은 010-1234-5678 로 주세요.', basis: '친구처럼 편하게 지낼 사람을 만나고 싶어요' },     // 저장 금지 입력
    { text: '소개팅처럼 부담 없이 만나요.', basis: '친구처럼 편하게 지낼 사람을 만나고 싶어요' },         // 쓰지 않는 단어
    { text: '저는 천천히 알아가는 만남이 좋아요.', basis: '천천히 알아가는 게 좋아요' },                 // 통과
  ] }) }, state);
  const { body } = await call({ action: 'profile_draft' });
  assert.equal(body.ok, true);
  assert.deepEqual(body.lines.map((l) => l.text), ['저는 천천히 알아가는 만남이 좋아요.']);
});

test('v14.1 소개 초안: 합쳐서 소개란 200자를 넘지 않는다', async () => {
  const long = '저는 ' + '가'.repeat(140) + '.';
  const state = draftState();
  const { call } = loadServer({ draft: () => ({ lines: [
    { text: long, basis: '천천히 알아가는 게 좋아요' },
    { text: long, basis: '말이 잘 통하고 약속을 잘 지키는 사람이 좋아요' },
  ] }) }, state);
  const { body } = await call({ action: 'profile_draft' });
  assert.equal(body.lines.length, 1);
  assert.ok(body.lines.map((l) => l.text).join(' ').length <= 200);
});

test('v14.1 소개 초안: 「처음부터 다시」 이전 회차의 답은 재료로 쓰지 않는다', async () => {
  const state = draftState({
    userMeta: { doit_round_started_at: '2026-09-23T00:30:00Z' },
    records: [{ id: 'old', text: '예전 회차에 한 말', created_at: '2026-09-22T00:00:00Z' }, ...ANSWERS],
  });
  const { call, payloads } = loadServer({ draft: () => ({ lines: [{ text: '저는 천천히 알아가는 게 좋아요.', basis: '천천히 알아가는 게 좋아요' }] }) }, state);
  await call({ action: 'profile_draft' });
  assert.ok(!draftPayload(payloads).answers.includes('예전 회차에 한 말'));
});

test('v14.1 소개 초안: 답이 모자라면 AI 를 부르지 않고 「먼저 답해 주세요」(NOT_ENOUGH)', async () => {
  const state = draftState({ records: [ANSWERS[0]], profiles: [] });
  const { call, calls } = loadServer({}, state);
  const { body } = await call({ action: 'profile_draft' });
  assert.equal(body.ok, false);
  assert.equal(body.code, 'NOT_ENOUGH');
  assert.match(body.error, /다섯 가지 질문에 먼저 답해 주세요/);
  assert.ok(!calls.includes('draft'));
});

test('v14.1 소개 초안: AI 가 엉뚱한 형식·오류를 내면 멈추지 않고 「다시 눌러 주세요」', async () => {
  for (const answer of [() => ({ text: '형식이 다름' }), () => 'HTTP500']) {
    const state = draftState();
    const { call } = loadServer({ draft: answer }, state);
    const { status, body } = await call({ action: 'profile_draft' });
    assert.equal(status, 502);
    assert.equal(body.code, 'AI_ERROR');
    assert.match(body.error, /다시 눌러 주세요/);
    assert.ok(!state.logs.some((l) => l.includes('천천히 알아가는')), '로그에 사용자 원문이 없어야 한다');
  }
});

test('v14.2 연결 자격 = 이번 회차 다섯 가지 질문에 모두 답함(맞아요 수와 무관) · 아니라고 한 기록·지난 회차 답은 세지 않음', async () => {
  const answer = (i, extra = {}) => ({ id: `ans-${i}`, user_id: USER, text: `답 ${i}`, status: 'confirmed', created_at: '2026-09-23T10:00:00Z', ...extra });
  const base = {
    profiles: [{ id: USER, purpose_id: 'friend', purpose_label: '친구', bio: '안녕하세요', verification_status: 'verified' }],
    photos: [1, 2, 3].map((slot) => ({ user_id: USER, slot })),
    insights: [],
  };
  let state = baseState({ ...base, records: [1, 2, 3, 4, 5].map((i) => answer(i)) });
  let body = (await loadServer({}, state).call({ action: 'connection_preview' })).body;
  assert.equal(body.readiness.answers, 5);
  assert.equal(body.readiness.confirmed, 0, '맞아요를 하나도 안 눌러도');
  assert.equal(body.eligible, true, '다섯 가지에 답했으면 자격 칸은 통과');
  state = baseState({ ...base, records: [...[1, 2, 3, 4].map((i) => answer(i)), answer(5, { status: 'rejected' })] });
  body = (await loadServer({}, state).call({ action: 'connection_preview' })).body;
  assert.equal(body.readiness.answers, 4, '아니라고 한 기록은 세지 않는다');
  assert.equal(body.eligible, false);
  state = baseState({ ...base, userMeta: { doit_round_started_at: '2026-09-23T12:00:00Z' }, records: [1, 2, 3, 4, 5].map((i) => answer(i)) });
  body = (await loadServer({}, state).call({ action: 'connection_preview' })).body;
  assert.equal(body.readiness.answers, 0, '「처음부터 다시」 이전 답은 세지 않는다');
  assert.equal(body.eligible, false);
});

test('v14.2 연결 자격 기준(5)이 질문 수(TOPICS)와 같다 — 화면의 n / 5 와 어긋날 수 없다', () => {
  const src = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const need = Number(src.match(/CONNECT_ANSWERS_NEEDED: (\d+)/)[1]);
  const topics = src.slice(src.indexOf('export const TOPICS = ['), src.indexOf('] as const;', src.indexOf('export const TOPICS = ['))).match(/\{ id: "/g).length;
  assert.equal(need, topics);
});

// ── v14.3 대표 실기기(2026-09-24 07:30 KST 무렵) "질문이 앞뒤도 안 맞고 … 오타도 있는 것 같고 너무 딥해 … 가볍게" ──
const DEEP_SCREENSHOT = '내가 방금 한 말이 상대방에게 도움이 될 수 있을까? 예를 들어, 내가 좋아하는 취미를 공유하면 상대방이 나를 더 잘 이해할 수 있을까?';
const REPHRASE_STAGE = (ai) => ({ ...ai, unknown: ai.rephrase }); // 되묻기 프롬프트는 가짜 AI 가 따로 구분하지 않는다(unknown)

test('v14.4 주제별 고정 질문 목록이 없다(하드코딩 질문 배열 금지) — 대체 문장은 "방금 한 말"만 가리킨다', () => {
  const src = readFileSync('supabase/functions/doit-understanding/index.ts', 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'); // 설명 주석(옛 문장 기록)은 빼고 코드만 본다
  assert.ok(!code.includes('EASY_QUESTION'), '주제별 고정 질문(EASY_QUESTION) 삭제');
  assert.ok(!code.includes('GENERIC_RESCUE'), '앞 답과 무관한 일반 질문 삭제');
  assert.ok(!code.includes('fixedDirectionQuestion'), '주제로 건너뛰는 고정 문장 삭제');
  assert.doesNotMatch(code, /\$\{label\}은 어떤가요|은 어떤가요\? 떠오르는 대로/, '주제 이름 조립 문장 삭제');
  assert.doesNotMatch(code, /그런 사람과 같이 뭘 하고 싶으세요/, '주제를 가정한 고정 문장 삭제');
  assert.doesNotMatch(code, /앞 말과 억지로 잇지 않아도 된다/, 'v14.4 원인 문구 삭제');
});

test('v14.3→v15 장면 재현: 「같이 하고 싶은 것」 답 뒤 AI 가 실패하면 깨진 문장·새 주제 고정 질문·안전문장 없이 명시적 실패', async () => {
  const state = baseState({ recordText: '취미생활이 같으면 좋지' });
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: ['partner_style', 'together'] }), rescueDir: () => 'TIMEOUT' }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assertExplicitFailure(status, body, 'timeout', state.logs);
});

test('v14.3 장면 재현: AI 가 길고 두 번 묻는 반말·예시 질문을 내면 버린다(구제·이어 묻기 모두) — v15 대체 문장 없이 다시 만들고, 그래도 무거우면 명시적 실패', async () => {
  for (const heavyOne of [DEEP_SCREENSHOT, '주말에 뭐 하고 싶어?', '같이 하고 싶은 걸 적어 주세요 (예: 산책, 영화)?', '상대에게 바라는 진심은 어떤 모습일까요?', '당신의 가치관과 내면에서 가장 중요한 부분은 무엇이라고 생각하시는지 들려주실 수 있을까요?']) {
    const state = baseState({ recordText: '취미생활이 같으면 좋지' });
    const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: ['partner_style', 'together'] }), rescueDir: () => ({ ack: '취미가 같으면 좋군요.', link: '취미생활', question: heavyOne }) }, state);
    const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
    assertExplicitFailure(status, body, null, state.logs);
    assert.ok(state.logs.some((l) => l.includes('"reason":"heavy"') || l.includes('"reason":"multi"')), heavyOne);
  }
  // 두 번째 시도에서 가벼운 질문이 오면 그 질문으로 이어 간다.
  const state = baseState({ insights: [{ id: 'i1', text: '취미가 같으면 좋다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z', created_at: '2026-09-22T00:00:00Z' }] });
  let n = 0;
  const { call } = loadServer({ topic: () => ({ covered: ['partner_style', 'together'] }), judge: () => ({ allowed: true }),
    followup: () => (++n === 1 ? { ack: '', link: '조용한 사람', question: DEEP_SCREENSHOT, basis: '', keys: ['취미'] } : { ack: '', link: '조용한 사람', question: '조용한 사람이랑은 주로 어디서 만나고 싶어요?', basis: '조용한 사람', keys: ['조용한 사람'] }) }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.question.text, '조용한 사람이랑은 주로 어디서 만나고 싶어요?');
});

test('v14.3 장면 재현: 이미 답한 「같이 하고 싶은 것」을 고정 문장으로 다시 묻지 않는다, 되묻기·불평은 인용하지 않는다(v15: 불평 뒤 AI 실패 = 명시적 실패)', async () => {
  const state = baseState({ recordText: '딥하네', events: [{ user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T00:50:24Z', response_payload: { question: { text: '어떤 사람한테 끌려요?', sourceRecordId: 'r-old' } } }] });
  const { call } = loadServer({ topic: () => ({ covered: ['purpose', 'partner_style', 'together', 'self', 'pace'] }), followup: () => ({ ack: '', question: '' }) }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assertExplicitFailure(status, body, 'no_question', state.logs);
  assert.doesNotMatch(JSON.stringify(body), /같이 뭘 하고 싶으세요|그런 사람|"딥하네"/);
});

test('v14.4 되묻기: "활동?질문이 머이래" → 기록 없이 쉬운 말로. AI 가 무거운 질문을 내면 주제를 바꾸지 않고 앞 질문 그대로', async () => {
  let state = baseState();
  let { call } = loadServer(REPHRASE_STAGE({ rephrase: () => ({ question: DEEP_SCREENSHOT }) }), state);
  let r = await call({ action: 'rephrase', question: '천천히 깊게 알고 싶으시군요.\n어떤 활동을 함께 하고 싶나요?', text: '활동?질문이 머이래', topic: 'together' });
  assert.equal(r.status, 200);
  assert.equal(r.body.meta, true);
  assert.equal(r.body.kind, 'rephrase');
  assert.equal(r.body.question, '천천히 깊게 알고 싶으시군요.\n어떤 활동을 함께 하고 싶나요?', 'v14.4 새 주제 고정 질문으로 바꾸지 않는다');
  assert.equal(r.body.fallback, true);
  assert.ok(!state.rpcCalls.some((c) => /record|finish/.test(c.name)), '되묻기는 기록을 만들지 않는다');
  ({ call } = loadServer(REPHRASE_STAGE({ rephrase: () => ({ question: '만나서 같이 하고 싶은 게 있어요?' }) }), state = baseState()));
  r = await call({ action: 'rephrase', question: '어떤 활동을 함께 하고 싶나요?', text: '무슨 말이야 글자 오타아니야?', topic: 'together' });
  assert.equal(r.body.question, '만나서 같이 하고 싶은 게 있어요?', '가벼운 질문이면 AI 문장을 그대로');
  ({ call } = loadServer(REPHRASE_STAGE({ rephrase: () => ({ question: 'x' }) }), state = baseState()));
  r = await call({ action: 'rephrase', question: '어떤 활동을 함께 하고 싶나요?', text: '취미생활이 같으면 좋지', topic: 'together' });
  assert.equal(r.body.meta, false, '진짜 답은 되묻기가 아니다');
  r = await call({ action: 'rephrase', question: '어떤 활동을 함께 하고 싶나요?', text: '딥하네', topic: 'nope' });
  assert.equal(r.body.meta, true);
  assert.equal(r.body.question, '어떤 활동을 함께 하고 싶나요?', 'AI 가 실패하면 앞 질문 그대로(빠져나갈 문)');
  assert.equal(r.body.fallback, true);

});
