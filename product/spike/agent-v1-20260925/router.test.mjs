// ECHO Model Router 검사(대표 「3-MODEL ROUTER LOCAL BUILD」 §6 A~G · §7, 2026-09-27). 실제 AI·네트워크 0 — 업체 자리에 가짜 부품만.
// 실행: node --experimental-strip-types --test spike/agent-v1-20260925/router.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const R = await import('./router/router.ts');
const P = await import('./router/providers.ts');
const A = await import(process.env.ECHO_AGENT_FILE ?? './candidates/agent-v3.2.ts'); // v3.2 기본 · ECHO_AGENT_FILE=./candidates/agent-v3.1.ts 로 run 34 판도 검사

const REG = { version: 't', provisional: true, roles: { PRIMARY: { provider: 'openai', model: 'p-model' }, SPECIALIST: { provider: 'anthropic', model: 's-model' }, FALLBACK: { provider: 'gemini', model: 'f-model' } }, timeout_ms: 1000, max_tokens: 768, temperature: 0.2, top_p: 0.9 };
const BUDGET = { max_calls_per_conversation: 999, max_tokens_per_conversation: 1e9 };
const QS = ['주말엔 보통 뭐 하고 지내요', '요즘 제일 재밌는 일이 뭐예요', '처음 만나면 어떤 얘기부터 해요', '약속 잡을 때 어떤 편이에요', '연락은 언제 하는 게 편해요', '같이 가 보고 싶은 곳 있어요'];
// v3.1 호출 모양대로 무난한 후보(이해 = 분류 · 말하기 = 받아주기+질문 · 마침 = 소개).
function agentLike(tag = '', classify = (t) => (/상관없이|몇번째/.test(t) ? 'COMPLAINT' : /고정질문/.test(t) ? 'META_QUESTION' : /^아니/.test(t) ? 'CORRECTION' : 'NORMAL_ANSWER')) {
  let n = 0;
  return (req) => {
    const i = req.input ?? {};
    if (req.stage === 'understand') { const it = classify(i.latest ?? ''); return JSON.stringify({ input_type: it, extracted: it === 'NORMAL_ANSWER' && i.latest?.length > 6 ? [{ purpose: 'relationship_intent', note: '만남', quote: i.latest }] : [], wrong: [], content_rejected: false, declared: null, inferred: [], about: '' }); }
    if (i.action) { n++; return JSON.stringify({ reply: `${tag}그 말 들었어요.`, question: i.action === 'AFTER_ACK' || i.action === 'BRIDGE' ? '' : `${tag}${QS[(n + tag.length) % QS.length]}?`, purpose: i.action === 'ASK_GAP' ? i.gaps?.[0]?.purpose ?? '' : '' }); }
    if (Array.isArray(i.statements)) return JSON.stringify({ lines: i.statements.map((x) => ({ id: x.id, text: `저는 ${x.quote} 쪽이 좋아요.` })) });
    const h = (i.heard ?? []).find((x) => x.quote);
    return JSON.stringify({ summary: [], closing: '이제 조금 알 것 같아요.', intro: h ? [{ text: `저는 ${h.quote} 쪽이 좋아요.`, basis: h.quote }] : [] });
  };
}
const trio = (o, a, g) => ({ openai: P.fakeProvider('openai', o), anthropic: P.fakeProvider('anthropic', a), gemini: P.fakeProvider('gemini', g) });
const begin = () => { const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st); return st; };
const factQuotes = (st) => A.PIDS.flatMap((id) => st.slots[id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.quote));

test('단계 읽기: v3.1 이 넘기는 호출 모양만으로 단계를 안다(Agent 수정 0)', () => {
  assert.deepEqual(R.stageOf('turn', { latest: '안녕' }), { stage: 'understand', action: null, retry: false });
  assert.deepEqual(R.stageOf('turn', { latest: '안녕', previous_attempt: { why: 'x' } }), { stage: 'understand', action: null, retry: true });
  assert.deepEqual(R.stageOf('turn', { action: 'REPAIR' }), { stage: 'speak', action: 'REPAIR', retry: false });
  assert.deepEqual(R.stageOf('turn', { action: 'REPAIR', recovery: { type: 'COMPLAINT' }, previous_attempt: {} }), { stage: 'recovery', action: 'REPAIR', retry: true });
  assert.equal(R.stageOf('closing', {}).stage, 'closing');
  assert.equal(R.stageOf('intro', { heard: [] }).stage, 'intro');
  assert.equal(R.stageOf('intro', { statements: [] }).stage, 'rebuild');
});

test('역할 결정: 보통 = PRIMARY · 불만/메타/정정(행동 또는 입력 종류) = SPECIALIST · 서버 검사 뒤 다시 = FALLBACK · 복구·소개 다시 만들기 = SPECIALIST · 역할 비면 PRIMARY', () => {
  const d = (s, it = null, over = false) => R.decide(REG, s, it, over);
  assert.equal(d({ stage: 'understand', action: null, retry: false }).role, 'PRIMARY');
  assert.equal(d({ stage: 'speak', action: 'ASK_GAP', retry: false }).role, 'PRIMARY');
  for (const a of ['REPAIR', 'ANSWER_USER', 'ACK_CORRECTION']) assert.equal(d({ stage: 'speak', action: a, retry: false }).role, 'SPECIALIST', a);
  assert.equal(d({ stage: 'speak', action: 'CLOSE', retry: false }, 'CORRECTION').role, 'SPECIALIST', '입력 종류로도');
  assert.equal(d({ stage: 'speak', action: 'ASK_GAP', retry: true }).role, 'FALLBACK');
  assert.equal(d({ stage: 'recovery', action: 'REPAIR', retry: true }).role, 'SPECIALIST');
  assert.equal(d({ stage: 'rebuild', action: null, retry: false }).role, 'SPECIALIST');
  const b = d({ stage: 'speak', action: 'REPAIR', retry: false }, null, true);
  assert.equal(b.role, 'PRIMARY'); assert.equal(b.budget_downgrade, true);
  assert.equal(R.decide({ ...REG, roles: { PRIMARY: REG.roles.PRIMARY } }, { stage: 'speak', action: 'REPAIR', retry: false }, null, false).role, 'PRIMARY');
});

test('A · PRIMARY 정상 → 다른 모델 호출 0(보통 턴 = 업체 1곳 · 이해 1 + 말하기 1)', async () => {
  const pv = trio(agentLike(), agentLike(), agentLike());
  const r = R.createRouter({ registry: REG, providers: pv, budget: BUDGET });
  await A.runTurn(begin(), '친구처럼 편한 만남이요', r.llm);
  assert.equal(pv.openai.calls.length, 2);
  assert.equal(pv.anthropic.calls.length + pv.gemini.calls.length, 0);
});

test('B · PRIMARY 시간 초과 → FALLBACK 호출 · 사용자에게 오류 0 · 대체 이유 기록', async () => {
  const pv = trio(() => ({ error: 'timeout' }), agentLike(), agentLike('F'));
  const r = R.createRouter({ registry: REG, providers: pv, budget: BUDGET });
  const st = begin();
  const res = await A.runTurn(st, '친구처럼 편한 만남이요', r.llm);
  assert.equal(res.response.error, undefined);
  const u = r.log.filter((x) => x.stage === 'understand');
  assert.deepEqual(u.map((x) => [x.provider, x.error, x.fallback_from, x.fallback_reason]), [['openai', 'timeout', null, null], ['gemini', null, 'openai', 'timeout']]);
  assert.ok(factQuotes(st).includes('친구처럼 편한 만남이요'), '대체 모델 결과도 같은 서버 규칙으로 저장');
});

test('C · PRIMARY 형식 깨진 출력 → 서버가 못 읽음 → 다시 청할 때 FALLBACK', async () => {
  const broken = (req) => (req.stage === 'understand' ? 'not json at all' : agentLike()(req));
  const pv = trio(broken, agentLike(), agentLike('F'));
  const r = R.createRouter({ registry: REG, providers: pv, budget: BUDGET });
  await A.runTurn(begin(), '친구처럼 편한 만남이요', r.llm);
  const u = r.log.filter((x) => x.stage === 'understand');
  assert.deepEqual(u.map((x) => [x.role, x.provider, x.retry]), [['PRIMARY', 'openai', false], ['FALLBACK', 'gemini', true]]);
  assert.deepEqual(R.acceptance(r.log).filter((x) => x.stage === 'understand').map((x) => x.validation), ['rejected_by_server', 'accepted']);
});

test('C2 · 말하기 빈 출력(v3.1 empty_turn) → 다시 청할 때 FALLBACK · 채택 기록', async () => {
  const bad = (req) => (req.stage === 'speak' ? JSON.stringify({ reply: '', question: '', purpose: '' }) : agentLike()(req));
  const pv = trio(bad, agentLike('S'), agentLike('F'));
  const r = R.createRouter({ registry: REG, providers: pv, budget: BUDGET });
  const res = await A.runTurn(begin(), '친구처럼 편한 만남이요', r.llm);
  assert.deepEqual(r.log.filter((x) => x.stage === 'speak').map((x) => [x.role, x.provider]), [['PRIMARY', 'openai'], ['FALLBACK', 'gemini']]);
  assert.match(res.response.reply, /^F/);
});

test('D · 불만·메타·정정 → SPECIALIST 업체 선택(이해는 PRIMARY)', async () => {
  for (const [text, action] of [['내가 적는거랑 상관없이 질문하네', 'REPAIR'], ['고정질문으로 바뀐거니?', 'ANSWER_USER'], ['아니 그게 아니라 주말에 한 번 보면 좋겠어', 'ACK_CORRECTION']]) {
    const pv = trio(agentLike('P'), agentLike('S'), agentLike('F'));
    const r = R.createRouter({ registry: REG, providers: pv, budget: BUDGET });
    const st = begin();
    await A.runTurn(st, '친구처럼 편한 만남이요', r.llm);
    const n = r.log.length;
    const res = await A.runTurn(st, text, r.llm);
    assert.equal(res.response.action, action, text);
    assert.deepEqual(r.log.slice(n, n + 2).map((x) => [x.stage, x.role, x.provider]), [['understand', 'PRIMARY', 'openai'], ['speak', 'SPECIALIST', 'anthropic']], text);
  }
});

test('E · 세 업체 모두 실패 → Canonical State 손상 0 · v3.1 이 오류로 돌려준다', async () => {
  const down = () => ({ error: 'http_5xx' });
  const r = R.createRouter({ registry: REG, providers: trio(down, down, down), budget: BUDGET });
  const st = begin(); const before = JSON.stringify(st);
  const res = await A.runTurn(st, '친구처럼 편한 만남이요', r.llm);
  assert.equal(res.response.error, 'PROVIDER');
  assert.equal(JSON.stringify(st), before);
});
test('E2 · 말하기에서 세 업체 모두 실패 → v3.1 서버 복구 문장(빈 턴 0 · 불만이면 일반 듣기 문장 0)', async () => {
  const onlyUnderstand = (req) => (req.stage === 'understand' ? agentLike()(req) : { error: 'http_5xx' });
  const r = R.createRouter({ registry: REG, providers: trio(onlyUnderstand, onlyUnderstand, onlyUnderstand), budget: BUDGET });
  const st = begin();
  await A.runTurn(st, '친구처럼 편한 만남이요', r.llm);
  const res = await A.runTurn(st, '몇번째 같은말이야!!', r.llm);
  assert.equal(res.response.action, 'REPAIR');
  assert.ok(res.response.reply.length > 0);
  assert.ok(!/이어서 편하게 말해/.test(res.response.reply));
});

test('F · 대체 성공 → provider · model · fallback_reason 관측 가능(Model Performance 한 줄)', async () => {
  const pv = trio(() => ({ error: 'http_429' }), agentLike(), agentLike());
  const r = R.createRouter({ registry: REG, providers: pv, budget: BUDGET });
  await A.runTurn(begin(), '친구처럼 편한 만남이요', r.llm);
  const rows = R.performanceRows(r.log);
  const fb = rows.find((x) => x.fallback);
  assert.equal(fb.provider, 'gemini'); assert.equal(fb.model, 'f-model'); assert.equal(fb.fallback_reason, 'http_429'); assert.equal(fb.success, true);
  for (const k of ['provider', 'provider_kind', 'model', 'task', 'action', 'input_type', 'role', 'retry', 'fallback', 'fallback_reason', 'validation', 'success', 'humanity', 'input_tokens', 'cached_tokens', 'output_tokens', 'latency_ms', 'cost_usd']) assert.ok(k in fb, k);
  assert.equal(fb.cost_usd, null); assert.match(fb.cost_basis, /확인 불가/);
});

test('G · 불만·메타·정정 턴에서 모델이 바뀌어도 서버 사실 저장 규칙 그대로(Router 있음 = Router 없음, 상태 동일)', async () => {
  const flow = ['친구처럼 편한 만남이요', '내가 적는거랑 상관없이 질문하네', '고정질문으로 바뀐거니?', '매일 연락하는 게 좋아요 진짜로', '아니 그게 아니라 주말에 한 번 보면 좋겠어', '몇번째 같은말이야!!', '여기까지만 할래'];
  // 업체마다 같은 대본 → Router 를 거치든 안 거치든 서버 결정이 같아야 한다.
  const plainScript = agentLike('');
  const stPlain = begin();
  for (const t of flow) await A.runTurn(stPlain, t, async (kind, system, input) => ({ text: plainScript({ stage: R.stageOf(kind, input).stage, input }) }));
  const shared = agentLike(''); // 업체는 달라도 같은 대본(모델 글자가 같으면 서버 결정도 같아야 한다)
  const pv = trio(shared, shared, shared);
  const r = R.createRouter({ registry: REG, providers: pv, budget: BUDGET });
  const stR = begin();
  for (const t of flow) await A.runTurn(stR, t, r.llm);
  const norm = (st) => JSON.stringify(st, (k, v) => (/(^|_)at$/.test(k) ? undefined : v)); // 시각 칸은 비교에서 뺀다
  assert.ok(pv.anthropic.calls.length > 0, 'SPECIALIST 업체가 실제로 쓰였다');
  assert.equal(norm(stR), norm(stPlain), '상태 같음');
  assert.ok(!factQuotes(stR).some((q) => /상관없이|고정질문|몇번째/.test(q)), '불만·메타 사실 0');
  assert.equal(stR.phase, stPlain.phase);
});

test('Gemini·Claude 는 가짜(미연결) 자리 — 역할에 들어가 있어도 부르면 not_connected → 다음 업체(실제 호출 0)', async () => {
  const o = P.fakeProvider('openai', agentLike());
  const r = R.createRouter({ registry: REG, providers: { openai: o, anthropic: P.notConnected('anthropic'), gemini: P.notConnected('gemini') }, budget: BUDGET });
  const st = begin();
  await A.runTurn(st, '친구처럼 편한 만남이요', r.llm);
  const res = await A.runTurn(st, '내가 적는거랑 상관없이 질문하네', r.llm);
  assert.equal(res.response.action, 'REPAIR');
  const sp = r.log.filter((x) => x.stage === 'speak').at(-1);
  assert.equal(sp.provider, 'openai'); assert.equal(sp.fallback_reason, 'not_connected');
  assert.ok(r.log.filter((x) => x.provider !== 'openai').every((x) => x.error === 'not_connected' && x.provider_kind === 'fake'));
});

test('run 34 구성: 역할 = PRIMARY(OpenAI) 하나 → 모든 호출이 OpenAI · 대체 0 · 가짜 업체 호출 0', async () => {
  const reg = { ...REG, roles: { PRIMARY: { provider: 'openai', model: 'gpt-4.1-mini' } } };
  const o = P.fakeProvider('openai', agentLike());
  const g = P.fakeProvider('gemini', agentLike()), a = P.fakeProvider('anthropic', agentLike());
  const r = R.createRouter({ registry: reg, providers: { openai: o, gemini: g, anthropic: a }, budget: BUDGET });
  const st = begin();
  for (const t of ['친구처럼 편한 만남이요', '내가 적는거랑 상관없이 질문하네', '여기까지만 할래']) await A.runTurn(st, t, r.llm);
  assert.ok(r.log.length > 0 && r.log.every((x) => x.provider === 'openai' && x.role === 'PRIMARY' && x.chain_index === 0));
  assert.equal(g.calls.length + a.calls.length, 0);
});

test('자꾸 실패하는 업체는 잠시 건너뛴다(3번 연속 오류 → 쉬는 시간 · 미연결은 세지 않음)', async () => {
  let t = 0; const o = P.fakeProvider('openai', () => ({ error: 'http_5xx' })), g = P.fakeProvider('gemini', agentLike());
  const r = R.createRouter({ registry: REG, providers: { openai: o, gemini: g }, budget: BUDGET, unhealthyAfter: 3, cooldownMs: 1000, now: () => t });
  for (let i = 0; i < 4; i++) await r.llm('turn', 'x', { latest: 'x' });
  assert.equal(o.calls.length, 3);
  assert.deepEqual(r.log.at(-1).skipped_unhealthy, ['openai']);
  t = 2000; await r.llm('turn', 'x', { latest: 'x' });
  assert.equal(o.calls.length, 4);
});

test('개인정보 칸(생년월일·출생시간·연락처)이 든 입력은 어느 업체에도 보내지 않는다 · v3.1 사주 씨앗은 원래 넘기지 않는다', async () => {
  const o = P.fakeProvider('openai', agentLike());
  const r = R.createRouter({ registry: REG, providers: { openai: o }, budget: BUDGET });
  await assert.rejects(r.llm('turn', 'x', { latest: 'a', seed: { birth_date: '1990-01-01' } }), (e) => e.code === 'pii_blocked');
  assert.equal(o.calls.length, 0);
  assert.ok(!JSON.stringify(r.log).includes('1990'));
  const st = A.newState({ tone: 'polite', seed: { source: 'SAJU', key: 'peer_none', birth_date: '1990-01-01', birth_time: '12:00' } });
  assert.deepEqual(R.piiKeys(st.seed), []);
});

test('비용 상한을 넘으면 SPECIALIST 로 올리지 않는다', async () => {
  const o = P.fakeProvider('openai', agentLike()), a = P.fakeProvider('anthropic', agentLike());
  const r = R.createRouter({ registry: REG, providers: { openai: o, anthropic: a }, budget: { max_calls_per_conversation: 1, max_tokens_per_conversation: 1e9 } });
  await r.llm('turn', 'x', { latest: 'x' });
  await r.llm('turn', 's', { action: 'REPAIR' });
  assert.equal(a.calls.length, 0);
  assert.equal(r.log.at(-1).budget_downgrade, true);
});

// OpenAI 부품: 가짜 fetch 로 요청 모양·관측 읽기만(실제 호출 0).
function fakeFetch(status, body) { const seen = []; return { seen, f: async (url, init) => { seen.push({ url, init }); return { ok: status < 400, status, json: async () => body }; } }; }
const REQ = { stage: 'speak', action: 'ASK_GAP', input_type: 'NORMAL_ANSWER', model: 'm', system: 'sys', input: { latest: 'a' }, maxTokens: 768, temperature: 0.2, topP: 0.9, timeoutMs: 1000, output: 'json_object' };
test('OpenAI 부품: 운영 doit-agent 와 같은 요청(json_object · max_tokens 768 · top_p) · 캐시 토큰 읽기 · 주소에 키 0', async () => {
  const x = fakeFetch(200, { model: 'm-2024', choices: [{ message: { content: ' {"a":1} ' } }], usage: { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 4 } } });
  const res = await P.openAIProvider('KEY', x.f).call(REQ);
  assert.deepEqual([res.text, res.cached_tokens, res.model_served, res.provider], ['{"a":1}', 4, 'm-2024', 'openai']);
  const b = JSON.parse(x.seen[0].init.body);
  assert.deepEqual([b.response_format.type, b.max_tokens, b.top_p, b.temperature, b.messages.length], ['json_object', 768, 0.9, 0.2, 2]);
  assert.ok(!x.seen[0].url.includes('KEY'));
});
test('OpenAI 부품 오류 코드: 429 · 5xx · 빈 응답 · 키 없음 · 시간 초과(오류에 원문·키 0)', async () => {
  await assert.rejects(P.openAIProvider('K', fakeFetch(429, {}).f).call(REQ), (e) => e.code === 'http_429' && !String(e.message).includes('K:'));
  await assert.rejects(P.openAIProvider('K', fakeFetch(503, {}).f).call(REQ), (e) => e.code === 'http_5xx');
  await assert.rejects(P.openAIProvider('K', fakeFetch(200, { choices: [] }).f).call(REQ), (e) => e.code === 'empty');
  await assert.rejects(P.openAIProvider('', fakeFetch(200, {}).f).call(REQ), (e) => e.code === 'no_key');
  const slow = async (_u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  await assert.rejects(P.openAIProvider('K', slow).call({ ...REQ, timeoutMs: 20 }), (e) => e.code === 'timeout');
});

// ── PANEL + JUDGE(실험 · 기본 꺼짐 · 대표 「FINAL IMPLEMENTATION MASTER」 §21).
const PANEL_REG = (judge = null) => ({ ...REG, panel: { stages: ['rebuild'], members: [{ provider: 'openai', model: 'p' }, { provider: 'gemini', model: 'g' }, { provider: 'anthropic', model: 'c' }], judge } });
const REB = { statements: [{ id: 0, quote: '약속 잘 지키는 사람' }] };
test('PANEL: 지정 단계에서만 세 업체 후보 · 서버 검사 탈락 후보 제외 · 판정 없으면 서버 점수 1등', async () => {
  const o = P.fakeProvider('openai', () => 'not json'), g = P.fakeProvider('gemini', () => JSON.stringify({ lines: [{ id: 0, text: '약속을 잘 지키는 사람이 좋아요.' }] })), a = P.fakeProvider('anthropic', () => JSON.stringify({ lines: [] }));
  const score = (_s, t) => { try { return (JSON.parse(t).lines ?? []).length; } catch { return 0; } };
  const r = R.createRouter({ registry: PANEL_REG(), providers: { openai: o, gemini: g, anthropic: a }, budget: BUDGET, panelScore: score });
  const out = await r.llm('intro', 'x', REB);
  assert.match(out.text, /좋아요/);
  assert.equal(r.log.filter((x) => x.role === 'PANEL').length, 3);
  await r.llm('turn', 'x', { latest: '안녕' }); // 다른 단계는 한 업체만
  assert.equal(o.calls.length, 2); assert.equal(g.calls.length + a.calls.length, 2);
});
test('JUDGE: 판정 선택은 서버 통과 후보 안에서만 · 엉뚱한 선택·오류면 서버 점수 1등', async () => {
  const good1 = JSON.stringify({ lines: [{ id: 0, text: '약속을 잘 지키는 사람이 좋아요.' }] }), good2 = JSON.stringify({ lines: [{ id: 0, text: '약속 잘 지키는 분이 좋아요.' }] });
  const mk = (choice) => ({ openai: P.fakeProvider('openai', () => good1), gemini: P.fakeProvider('gemini', () => good2), anthropic: P.fakeProvider('anthropic', (req) => (req.action === 'JUDGE' ? JSON.stringify({ choice }) : 'broken')) });
  const pick = async (choice) => { const r = R.createRouter({ registry: PANEL_REG({ provider: 'anthropic', model: 'j' }), providers: mk(choice), budget: BUDGET }); return { out: await r.llm('intro', 'x', REB), log: r.log }; };
  const b = await pick('B');
  assert.equal(b.out.text, good2, '판정 B = 두 번째 통과 후보');
  assert.ok(b.log.some((x) => x.role === 'JUDGE' && !x.error));
  assert.equal((await pick('C')).out.text, good1, '탈락 후보(C=broken)는 고를 수 없음 → 서버 1등');
  assert.equal((await pick('Z')).out.text, good1);
});
test('PANEL 은 기본 꺼짐(registry.panel 없음) · 비용 상한이면 PANEL 대신 한 업체', async () => {
  const o = P.fakeProvider('openai', () => '{"lines":[]}'), g = P.fakeProvider('gemini', () => '{}');
  const r1 = R.createRouter({ registry: REG, providers: { openai: o, gemini: g }, budget: BUDGET });
  await r1.llm('intro', 'x', REB);
  assert.equal(r1.log.filter((x) => x.role === 'PANEL').length, 0);
  const r2 = R.createRouter({ registry: PANEL_REG(), providers: { openai: o, gemini: g }, budget: { max_calls_per_conversation: 0, max_tokens_per_conversation: 1e9 } });
  await r2.llm('intro', 'x', REB);
  assert.equal(r2.log.filter((x) => x.role === 'PANEL').length, 0, '비용 상한 → 한 업체');
});
