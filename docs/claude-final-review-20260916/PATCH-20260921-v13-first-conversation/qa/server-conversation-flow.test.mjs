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
      const answer = ai[stage] ? ai[stage](body) : null;
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

const baseState = (over = {}) => ({ recordText: '조용한 사람', records: [{ id: 'r-old', text: '친구를 사귀고 싶어요', created_at: '2026-09-21T00:00:00Z' }], insights: [], purpose: { id: 'friend', label: '친구' }, rpcCalls: [], logs: [], gteCalls: [], ...over });
const noCandidates = () => ({ candidates: [] });
const dirRescue = () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '그 관계에서 상대의 어떤 성향이 중요하세요? (예: 약속을 잘 지키는 사람, 말이 잘 통하는 사람)' });

test('짧은 답 + 주제 판정이 "항목별 참/거짓 객체"로 와도 → 다음 주제 질문(ack 포함, topic 있음)', async () => {
  const state = baseState();
  const { call, calls } = loadServer({ gen: noCandidates, topic: () => ({ covered: { partner_style: true, together: false, self: false, pace: false } }), rescueDir: dirRescue }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.insights.length, 0);
  assert.equal(body.rescue.topic, 'together', '끌리는 스타일은 이미 나왔으니 다음 주제');
  assert.match(body.rescue.text, /^조용한 사람이 좋다고 하셨죠\.\n/);
  assert.ok(calls.includes('topic') && calls.includes('rescueDir'));
  assert.ok(!state.logs.some((l) => l.includes('topic_parse_failure')));
});

test('주제 판정이 "객체 목록"으로 와도 읽는다', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: [{ id: 'partner_style', covered: true }, { id: 'self', covered: false }] }), rescueDir: dirRescue }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'together');
});

test('주제 판정이 완전히 엉뚱한 형식이면 → 첫 주제부터 묻고 실패 모양만 로그(원문 없음)', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ result: 'yes', explanation: '조용한 사람' }), rescueDir: dirRescue }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'partner_style', '목적은 서버 사실로 나왔으니 그 다음 주제');
  const log = state.logs.find((l) => l.includes('topic_parse_failure'));
  assert.ok(log, '실패 로그가 있어야 한다');
  assert.ok(!log.includes('조용한 사람'), '로그에 사용자 원문이 없어야 한다');
});

test('주제 판정 AI 가 HTTP 500 이어도 캐묻기로 떨어지지 않는다', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => 'HTTP500', rescueDir: dirRescue }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.rescue.topic, 'partner_style');
});

test('"모르겠어요" 도 정상 입력: 후보 없음 → 다음 주제 질문', async () => {
  const state = baseState({ recordText: '모르겠어요' });
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: ['partner_style'] }), rescueDir: () => ({ ack: '아직 잘 모르겠다고 하셨죠.', question: '그 관계에서 상대의 어떤 성향이 중요하세요? (예: 솔직한 사람, 배려하는 사람)' }) }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'together');
  assert.ok(!/구체적|자세히/.test(body.rescue.text));
});

test('구제 AI 까지 실패하면 그 주제를 그대로 묻는 고정 문장(topic 유지), 캐묻기 아님', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: [] }), rescueDir: () => 'TIMEOUT' }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'partner_style');
  assert.match(body.rescue.text, /끌리는 사람은 어떤가요/);
  assert.ok(!body.rescue.text.includes('부분을 조금 더 들려주실'), 'v12 캐묻기 문장이 아니어야 한다');
});

test('다음 질문(새 갈래): 짧은 답 + 행동 없음 → CHANGE_DIRECTION. ack 가 기록을 인용하지 못해도 질문은 살린다(ack 만 제거), topic 있음', async () => {
  const state = baseState();
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '차분한 분위기를 좋아하시는군요.', question: '그 관계에서 상대의 어떤 성향이 중요하세요? (예: 약속을 지키는 사람, 잘 들어주는 사람)', basis: '차분한 분위기', meaning: '', keys: ['성향'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'CHANGE_DIRECTION');
  assert.equal(body.topic, 'together');
  assert.equal(body.question.text, '그 관계에서 상대의 어떤 성향이 중요하세요? (예: 약속을 지키는 사람, 잘 들어주는 사람)');
});

test('다음 질문(한 단계 더): 확인한 이해가 있으면 DEEPEN. 질문은 사용자 말과 이어져야 하고(핵심어 겹침), topic 은 없다', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call, payloads } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '조용한 사람과 있을 때 어떤 장면이 제일 편하게 떠올라요?', basis: '조용한 사람', meaning: '', keys: ['조용한 사람'], proposed_strategy: 'DEEPEN', evidence: [{ claim: '조용한 사람이 좋다', supporting_user_text: '조용한 사람' }] }),
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

test('다음 질문: 판정이 불허해도 새 갈래 질문은 ack 만 떼고 낸다. 이어 묻기(DEEPEN)가 불허면 고정 대체 문장으로 이어간다(멈추지 않는다)', async () => {
  const state = baseState();
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '상대가 알면 좋을 나은 무엇인가요? (예: 느긋한 편, 계획적인 편)', basis: '조용한 사람', meaning: '', keys: ['나의 모습'] }),
    judge: () => ({ allowed: false }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.question.text, '상대가 알면 좋을 나은 무엇인가요? (예: 느긋한 편, 계획적인 편)');
  assert.equal(body.topic, 'together');
  const state2 = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call: call2 } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '', question: '조용한 사람이 좋은 건 혹시 외로워서인가요?', basis: '조용한 사람', meaning: '외로움', keys: ['조용한 사람'] }),
    judge: () => ({ allowed: false }),
  }, state2);
  const { status, body: b2 } = await call2({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.ok(!/외로/.test(b2.question.text), '단정(외로움)을 전제로 한 질문은 나가지 않는다');
  assert.equal(b2.strategy, 'CHANGE_DIRECTION');
  assert.ok(state2.logs.some((l) => l.includes('followup_failed') && l.includes('FOLLOWUP_NOT_GROUNDED')));
});

test('다음 질문: 거절 뒤에는 RECOVER_FROM_REJECTION. ack 가 거절과 겹치면 ack 를 떼고 질문만, 질문 자체가 겹치면 고정 되돌리기 문장(거절 재등장 금지 우선)', async () => {
  const rejected = { id: 'i0', text: '조용한 사람이 좋다', ai_text: '조용한 사람이 좋다', status: 'rejected', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ insights: [rejected] });
  const { call } = loadServer({
    topic: () => ({ covered: [] }),
    followup: () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '요즘 사람을 만나는 일이 어떻게 느껴지세요? (예: 설렘, 부담)', basis: '조용한 사람', meaning: '', keys: ['만나는 일'] }),
    judge: () => ({ allowed: true }), semantic: () => ({ blocked: [] }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.strategy, 'RECOVER_FROM_REJECTION');
  assert.equal(body.question.text, '요즘 사람을 만나는 일이 어떻게 느껴지세요? (예: 설렘, 부담)');
  const state2 = baseState({ insights: [rejected] });
  const { call: call2 } = loadServer({
    topic: () => ({ covered: [] }),
    followup: () => ({ ack: '', question: '조용한 사람이 좋다는 건 어떤 뜻인가요?', basis: '조용한 사람', meaning: '', keys: ['조용한 사람'] }),
    judge: () => ({ allowed: true }),
  }, state2);
  const { status, body: b2 } = await call2({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(b2.strategy, 'RECOVER_FROM_REJECTION');
  assert.match(b2.question.text, /방향을 잘못 잡았네요/);
  assert.ok(!b2.question.text.includes('조용한 사람'), '거절한 뜻이 되살아나지 않는다');
  assert.ok(state2.logs.some((l) => l.includes('followup_failed') && l.includes('FOLLOWUP_REJECTED')));
});

test('주제가 다 나오면(5/5) 새로운 면을 여는 질문, topic 은 null', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '느긋한 편이다', status: 'confirmed', origin: 'self', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style', 'together', 'self', 'pace'] }),
    followup: () => ({ ack: '느긋한 편이라고 하셨죠.', question: '만남 뒤에 어떤 변화를 바라세요? (예: 주말이 기다려지는 것, 편하게 연락할 사람)', basis: '느긋한 편', meaning: '', keys: ['변화'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.topic, null);
  assert.match(body.question.text, /^느긋한 편이라고 하셨죠\.\n/);
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
  const { call } = loadServer({ gen: noCandidates, topic: (body) => { seen = JSON.parse(body.messages[1].content); return { covered: [] }; }, rescueDir: dirRescue }, state);
  await call({ action: 'insight_generate', recordId: RECORD });
  assert.deepEqual(seen.records, ['친구를 사귀고 싶어요']);
  assert.equal(seen.record, '조용한 사람');
  assert.deepEqual(seen.topics, ['partner_style', 'together', 'self', 'pace']);
});

test('v13.4 다음 질문 생성이 어떤 이유로든 실패해도(예: AI 가 질문을 안 줌) 방향 주제를 묻는 고정 문장 + topic 으로 답한다', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z', created_at: '2026-09-22T00:00:00Z' }] });
  const { call } = loadServer({ topic: () => ({ covered: ['partner_style'] }), followup: () => ({ nothing: true }) }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.topic, 'together');
  assert.match(body.question.text, /같이 하고 싶은 것은 어떤가요/);
  assert.ok(state.logs.some((l) => l.includes('followup_failed') && l.includes('FOLLOWUP_NO_QUESTION')));
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
  const { call } = loadServer({ gen: noCandidates, topic: (body) => { seen = JSON.parse(body.messages[1].content); return { covered: [] }; }, rescueDir: dirRescue }, state);
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
  assert.deepEqual(body.readiness, { confirmed: 2, confirmed_needed: 5, photos: 2, photos_needed: 3, intro: true, phone_verified: false });
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
    followup: () => ({ ack: '', question: '그 사람이 떠오를 때, 다시 가까워지고 싶은 마음에 더 가까워요? 아니면 그때의 시간이 그리운 쪽에 가까워요?', basis: '', meaning: '', keys: ['그 사람'], proposed_strategy: 'CLARIFY', evidence: [{ claim: '특정 사람이 떠오른다', supporting_user_text: '친했던 사람' }] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'CLARIFY');
  assert.match(body.question.text, /^그 사람이 떠오를 때/);
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
    followup: () => ({ ack: '', question: '다시 가까워지고 싶은 마음이 큰가요?', basis: '', meaning: '재회 바람', keys: ['가까워지고'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.strategy, 'RECOVER_FROM_REJECTION');
  assert.ok(!body.question.text.includes('가까워지'), '거절한 뜻이 다음 질문에 다시 나오면 안 된다');
  assert.match(body.question.text, /방향을 잘못 잡았네요/);
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
  assert.equal(status, 200);
  assert.ok(!body.question.text.includes('좋아'), '정정 무시 질문은 나가지 않는다');
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
    followup: () => ({ ack: '무심했던 게 걸린다고 하셨죠.', question: '지금 그 사람에게 하고 싶은 말이 있다면 뭐예요?', basis: '무심했던', meaning: '', keys: ['그 사람'] }),
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
    followup: () => ({ ack: '', question: '일에서 지금 제일 걱정되는 건 어떤 부분이에요?', basis: '', meaning: '', keys: ['일'], proposed_strategy: 'CHANGE_DIRECTION', evidence: [{ claim: '일이 더 걱정', supporting_user_text: '제 일이 더 걱정' }] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.strategy, 'CHANGE_DIRECTION');
  assert.equal(body.topic, null);
  assert.equal(body.question.text, '일에서 지금 제일 걱정되는 건 어떤 부분이에요?');
  const state2 = baseState({ recordText: WORK });
  const { call: call2 } = loadServer({
    topic: cov,
    followup: () => ({ ack: '', question: '일에서 지금 제일 걱정되는 건 어떤 부분이에요?', basis: '', meaning: '', keys: ['걱정'], proposed_strategy: 'CHANGE_DIRECTION', evidence: [{ claim: '연애가 걱정', supporting_user_text: '연애가 걱정' }] }),
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
  assert.equal(status, 200);
  assert.ok(!body.question.text.includes('제일 먼저 어떤 생각'), '같은 질문을 다시 묻지 않는다');
  const sent = JSON.parse(payloads.find((p) => p.stage === 'followup').user);
  assert.deepEqual(sent.asked_questions, ['그 사람이 떠오르면 제일 먼저 어떤 생각이 들어요?']);
  assert.ok(state.logs.some((l) => l.includes('FOLLOWUP_REPEATED')));
});

test('질문 하나 규칙(§8): 물음표 둘("아니면" 없음)·의문사 셋 문장은 버리고 대체 문장으로 이어간다', async () => {
  for (const q of ['왜 생각나요? 그때 기분은 어땠어요?', '그 사람이 왜 생각나고 그때 어떤 기분이었고 어떻게 하고 싶은지 알려주세요.']) {
    const state = baseState({ recordText: PERSON });
    const { call } = loadServer({ topic: cov, followup: () => ({ ack: '', question: q, basis: '', meaning: '', keys: ['그 사람'] }), judge: () => ({ allowed: true }) }, state);
    const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
    assert.equal(status, 200);
    assert.notEqual(body.question.text, q);
    assert.ok(state.logs.some((l) => l.includes('FOLLOWUP_MULTI')), q);
  }
});

test('§21-11 화면 응답에는 내부 진단(trace)·구제 종류(kind)가 없다. 거절 뒤 후보가 없으면 구제도 되돌리기 전략', async () => {
  const rejected = { id: 'i0', text: '다시 가까워지고 싶은 마음', ai_text: '다시 가까워지고 싶은 마음', status: 'rejected', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ recordText: PERSON, insights: [rejected] });
  const { call } = loadServer({ gen: noCandidates, topic: cov, rescuePlain: () => ({ question: '다시 가까워지고 싶은 마음이 큰가요?' }) }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.trace, undefined);
  assert.equal(body.rescue.kind, undefined);
  assert.equal(body.rescue.strategy, 'RECOVER_FROM_REJECTION');
  assert.match(body.rescue.text, /방향을 잘못 잡았네요/);
  assert.ok(!body.rescue.text.includes('가까워지'));
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
    gen: noCandidates, topic: allCovered,
    rescuePlain: () => ({ question: '진실된 마음을 느꼈던 순간이 있다면 언제였어요?' }),
  }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.strategy, 'EXPLORE_USER_MEANING');
  assert.equal(body.rescue.text, '진실된 마음을 느꼈던 순간이 있다면 언제였어요?');
  const sent = payloads.find((p) => p.stage === 'rescuePlain').user;
  assert.ok(sent.includes('[직전 질문') && sent.includes(LAST_Q), 'AI 자료에 직전 질문이 들어간다');
  assert.ok(state.logs.some((l) => l.includes('"stage":"rescue"') && l.includes('"step":"ai"')));
});

test('v13.6 AI 구제가 반복 질문을 내면 버리고, 사용자 답을 인용한 대체 문장으로 이어간다(일반 문장 아님)', async () => {
  const state = answeredState();
  const { call } = loadServer({ gen: noCandidates, topic: allCovered, rescuePlain: () => ({ question: '연애에 대해 어떤 점이 가장 중요하다고 생각하세요?' }) }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.match(body.rescue.text, /^"진실된마음"라고 하셨죠\./); // v13.7 말투 조정
  assert.ok(!body.rescue.text.includes('가장 마음에 남는 부분'));
  assert.ok(state.logs.some((l) => l.includes('"step":"ai_dropped"')) && state.logs.some((l) => l.includes('"step":"quoted"')));
});

test('v13.6 고정 대체 문장끼리는 반복으로 오인하지 않는다: 첫 주제 문장을 이미 물었으면 다음 주제 문장으로', async () => {
  const asked = '방금 하신 말은 저장했어요.\n끌리는 사람은 어떤가요? 떠오르는 대로 짧게 적어도 돼요.';
  const state = baseState({ recordText: '음', events: [{ user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T00:50:24Z', response_payload: { question: { text: asked, sourceRecordId: 'r-old' } } }] });
  const { call } = loadServer({ topic: () => ({ covered: [] }), followup: () => ({ ack: '', question: '' }) }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.match(body.question.text, /같이 하고 싶은 것은 어떤가요/);
  assert.equal(body.topic, 'together');
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
    followup: () => ({ ack: '진실하게 대하고 싶다고 하셨죠.', question: '그런 믿음이 오간다고 느꼈던 순간이 있었어요?', basis: '진실하게', meaning: '', keys: ['진실'] }),
    judge: () => (++call === 1 ? { allowed: false } : { allowed: true }),
  }, state);
  const { status, body } = await post({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.question.text, '그런 믿음이 오간다고 느꼈던 순간이 있었어요?');
  assert.ok(state.logs.some((l) => l.includes('ack_dropped_pass')));
});

test('v14 두 번 다 불허면 대체 문장으로 가되, 사용자 답을 질문 문장에 끼워 넣지 않는다', async () => {
  const state = longState();
  const { call } = loadServer({
    topic: allCovered,
    followup: () => ({ ack: '진실하게 대하고 싶다고 하셨죠.', question: '아직 그 사람을 좋아하는 건가요?', basis: '진실하게', meaning: '', keys: ['진실'] }),
    judge: () => ({ allowed: false }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.ok(!body.question.text.includes(LONG_ANSWER), '긴 답은 인용 줄에도 넣지 않는다(화면이 무거워진다)');
  assert.ok(body.question.text.length <= 45, `대체 문장이 너무 길다: ${body.question.text.length}자`);
  assert.ok(state.logs.some((l) => l.includes('FOLLOWUP_NOT_GROUNDED')));
});

// ── v14 대표 실기기 발견(2026-09-22 16:29 KST) ──────────────────────────────
// v13.7 은 "14자 이하면 그대로 인용" 이었는데, 구절이 들어오면 조사 자리에서 그대로 깨졌다.
// 운영에 실제로 나간 문장: "상대에게 바라는 에너지가 뺏기가 싫어서는 어떤 모습일까요?"
// v14 규칙: 인용은 `"..."라고 하셨죠.` 한 줄로만. 질문 줄에는 사용자 말을 넣지 않는다.
const BROKEN_CASE = '에너지가 뺏기가 싫어서'; // 12자 — v13.7 의 14자 문턱을 통과해 버렸다
for (const quote of [BROKEN_CASE, '배려', '그냥 아무생각없어', '좋은 에너지면 같이 시너지를 느낄수있지만 싸우고 그럼 에너지가 서비된다']) {
  test(`v14 대체 문장은 사용자 말을 조사 자리에 넣지 않는다: "${quote}"`, async () => {
    const state = baseState({ recordText: quote, events: [{ user_id: USER, action: 'followup_generate', status: 'applied', created_at: '2026-09-22T06:14:50Z', response_payload: { question: { text: PREV_Q, sourceRecordId: 'r-old' } } }] });
    const { call } = loadServer({ topic: allCovered, followup: () => ({ ack: '', question: '' }) }, state);
    const { body } = await call({ action: 'followup_generate', recordId: RECORD });
    const text = body.question.text;
    // 사용자 말은 `"..."라고 하셨죠.` 안에서만 쓸 수 있다. 이 틀은 어떤 말이 와도 문장이 성립한다.
    const withoutQuoteLine = text.split('\n').filter((line) => !/^"[^"]*"라고 하셨죠\.$/.test(line.trim())).join('\n');
    assert.ok(!withoutQuoteLine.includes(quote), `인용 틀 밖에 사용자 말이 들어갔다: ${withoutQuoteLine}`);
    // 깨진 채 운영에 나갔던 틀이 다시 나오면 안 된다.
    assert.ok(!text.includes('상대에게 바라는'), `옛 깨진 틀이 살아 있다: ${text}`);
    const askLine = text.split('\n').filter((line) => line.trim()).pop() ?? '';
    assert.ok(askLine.length <= 45, `질문이 너무 길다(${askLine.length}자): ${askLine}`);
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
