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
  const tables = () => ({ doit_records: state.records, doit_insights: state.insights, profiles: state.profiles ?? [], profile_photos: state.photos ?? [] });
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
  const sandbox = {
    exports: {}, console: { log: (line) => state.logs.push(String(line)), error: () => {} },
    setTimeout, clearTimeout, AbortController, TextEncoder, crypto: globalThis.crypto, Request, Response, Headers, URL,
    Deno: { env: { get: (k) => ({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SUPABASE_URL: 'http://db', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' })[k] ?? '' }, serve: (h) => { handler = h; } },
    require: (name) => { if (name.startsWith('npm:@supabase/supabase-js')) return { createClient: () => fakeDb(state) }; throw new Error(`Unexpected dependency ${name}`); },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      const stage = stageOf(body.messages[0].content);
      calls.push(stage);
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
  return { call, calls };
}

const baseState = (over = {}) => ({ recordText: '조용한 사람', records: [{ id: 'r-old', text: '친구를 사귀고 싶어요', created_at: '2026-09-21T00:00:00Z' }], insights: [], purpose: { id: 'friend', label: '친구' }, rpcCalls: [], logs: [], gteCalls: [], ...over });
const noCandidates = () => ({ candidates: [] });
const dirRescue = () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '그 관계에서 상대의 어떤 성향이 중요하세요? (예: 약속을 잘 지키는 사람, 말이 잘 통하는 사람)' });

test('짧은 답 + 주제 판정이 "항목별 참/거짓 객체"로 와도 → 다음 주제 질문(ack 포함, topic 있음)', async () => {
  const state = baseState();
  const { call, calls } = loadServer({ gen: noCandidates, topic: () => ({ covered: { partner_style: true, partner_traits: false, self: false, mood: false } }), rescueDir: dirRescue }, state);
  const { status, body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.insights.length, 0);
  assert.equal(body.rescue.topic, 'partner_traits', '끌리는 스타일은 이미 나왔으니 다음 주제');
  assert.match(body.rescue.text, /^조용한 사람이 좋다고 하셨죠\.\n/);
  assert.ok(calls.includes('topic') && calls.includes('rescueDir'));
  assert.ok(!state.logs.some((l) => l.includes('topic_parse_failure')));
});

test('주제 판정이 "객체 목록"으로 와도 읽는다', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: [{ id: 'partner_style', covered: true }, { id: 'self', covered: false }] }), rescueDir: dirRescue }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'partner_traits');
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
  assert.equal(body.rescue.topic, 'partner_traits');
  assert.ok(!/구체적|자세히/.test(body.rescue.text));
});

test('구제 AI 까지 실패하면 그 주제를 그대로 묻는 고정 문장(topic 유지), 캐묻기 아님', async () => {
  const state = baseState();
  const { call } = loadServer({ gen: noCandidates, topic: () => ({ covered: [] }), rescueDir: () => 'TIMEOUT' }, state);
  const { body } = await call({ action: 'insight_generate', recordId: RECORD });
  assert.equal(body.rescue.topic, 'partner_style');
  assert.match(body.rescue.text, /끌리는 사람의 스타일은 어떤가요/);
  assert.ok(!body.rescue.text.includes('부분을 조금 더 들려주실'), 'v12 캐묻기 문장이 아니어야 한다');
});

test('다음 질문(followup): ack 가 기록을 인용하지 못해도 질문은 살린다(ack 만 제거), topic 있음', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '차분한 분위기를 좋아하시는군요.', question: '그 관계에서 상대의 어떤 성향이 중요하세요? (예: 약속을 지키는 사람, 잘 들어주는 사람)', basis: '차분한 분위기', meaning: '', keys: ['성향'] }),
    judge: () => ({ allowed: true }),
  }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.topic, 'partner_traits');
  assert.equal(body.question.text, '그 관계에서 상대의 어떤 성향이 중요하세요? (예: 약속을 지키는 사람, 잘 들어주는 사람)');
});

test('다음 질문: 판정이 불허해도 방향 질문은 ack 만 떼고 낸다', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style'] }),
    followup: () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '상대가 알아야 할 나의 모습은 무엇인가요? (예: 느긋한 편, 계획적인 편)', basis: '조용한 사람', meaning: '', keys: ['나의 모습'] }),
    judge: () => ({ allowed: false }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.question.text, '상대가 알아야 할 나의 모습은 무엇인가요? (예: 느긋한 편, 계획적인 편)');
  assert.equal(body.topic, 'partner_traits');
});

test('다음 질문: 거절한 말과 ack 가 겹치면 ack 를 떼고 질문만, 질문 자체가 겹치면 실패(거절 재등장 금지 우선)', async () => {
  const rejected = { id: 'i0', text: '조용한 사람이 좋다', ai_text: '조용한 사람이 좋다', status: 'rejected', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' };
  const state = baseState({ insights: [rejected] });
  const { call } = loadServer({
    topic: () => ({ covered: [] }),
    followup: () => ({ ack: '조용한 사람이 좋다고 하셨죠.', question: '요즘 사람을 만나는 일이 어떻게 느껴지세요? (예: 설렘, 부담)', basis: '조용한 사람', meaning: '', keys: ['만나는 일'] }),
    judge: () => ({ allowed: true }), semantic: () => ({ blocked: [] }),
  }, state);
  const { body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(body.question.text, '요즘 사람을 만나는 일이 어떻게 느껴지세요? (예: 설렘, 부담)');
  const state2 = baseState({ insights: [rejected] });
  const { call: call2 } = loadServer({
    topic: () => ({ covered: [] }),
    followup: () => ({ ack: '', question: '조용한 사람이 좋다는 건 어떤 뜻인가요?', basis: '조용한 사람', meaning: '', keys: ['조용한 사람'] }),
    judge: () => ({ allowed: true }),
  }, state2);
  const { status, body: b2 } = await call2({ action: 'followup_generate', recordId: RECORD });
  // v13.4: 질문이 거절한 뜻과 겹쳐 버려져도, 방향이 있으면 그 주제를 묻는 고정 문장으로 이어간다(멈추지 않는다).
  assert.equal(status, 200);
  assert.equal(b2.topic, 'partner_style');
  assert.match(b2.question.text, /끌리는 사람의 스타일은 어떤가요/);
  assert.ok(state2.logs.some((l) => l.includes('followup_failed') && l.includes('FOLLOWUP_REJECTED')));
});

test('주제가 다 나오면(5/5) 새로운 면을 여는 질문, topic 은 null', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '느긋한 편이다', status: 'confirmed', origin: 'self', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z' }] });
  const { call } = loadServer({
    topic: () => ({ covered: ['partner_style', 'partner_traits', 'self', 'mood'] }),
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
  assert.deepEqual(seen.topics, ['partner_style', 'partner_traits', 'self', 'mood']);
});

test('v13.4 다음 질문 생성이 어떤 이유로든 실패해도(예: AI 가 질문을 안 줌) 방향 주제를 묻는 고정 문장 + topic 으로 답한다', async () => {
  const state = baseState({ insights: [{ id: 'i1', text: '조용한 사람에게 끌린다', status: 'confirmed', origin: 'ai', source_record_id: RECORD, updated_at: '2026-09-22T00:00:00Z', created_at: '2026-09-22T00:00:00Z' }] });
  const { call } = loadServer({ topic: () => ({ covered: ['partner_style'] }), followup: () => ({ nothing: true }) }, state);
  const { status, body } = await call({ action: 'followup_generate', recordId: RECORD });
  assert.equal(status, 200);
  assert.equal(body.topic, 'partner_traits');
  assert.match(body.question.text, /그 관계에서 중요한 상대의 성향은 어떤가요/);
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
