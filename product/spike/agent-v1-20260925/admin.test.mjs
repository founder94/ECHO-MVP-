// 관리자 관측 함수 검사 — 가짜 AI 로 만든 세션과 옛 core-0.1 모양 문서(지어낸 예시 문장)로 본다. 실제 대표 기록은 쓰지 않는다(공개 저장소).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from './agent.mjs';
import * as M from './admin.mjs';

const fake = (...outs) => async () => JSON.stringify(outs.shift());
const T = (o) => ({ kind: 'answer', understood: '', reply: '그렇군요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const Q = (purpose, question) => ({ next: { type: 'core', purpose, question } });

async function v11Doc() {
  const st = A.newState({ tone: 'polite', mode: 'TEXT' });
  await A.runOpening(st, fake({ reply: '', question: '어떤 만남을 원해요?' }));
  const llm = fake(
    T({ extracted: [{ purpose: 'relationship_intent', note: '편한 만남', quote: '편한' }], ...Q('attraction_comfort', '어떤 사람이 편해요?') }),
    T({ kind: 'skip', ...Q('values_character', '사람 볼 때 뭘 봐요?') }),
    T({ extracted: [{ purpose: 'values_character', note: '배려', quote: '배려' }, { purpose: 'relationship_style', note: '천천히', quote: '천천히' }], ...Q('boundaries', '피하고 싶은 게 있어요?') }),
    T({ extracted: [{ purpose: 'boundaries', note: '거짓말 싫음', quote: '거짓말' }] }), { summary: [], closing: '정리해 둘게요.' });
  const records = []; let handoff = null;
  for (const t of ['편한 만남', '다음 질문', '배려하고 천천히', '거짓말 싫어']) {
    const { response, obs } = await A.runTurn(st, t, llm);
    const last = st.turns.at(-1);
    records.push({ turn_index: records.length + 1, user_raw_text: t, assistant_text: [response.reply, response.closing, response.question].filter(Boolean).join('\n'), question_index: st.asked.filter((q) => q.type === 'core').length,
      question_purpose: last.question_purpose, agent_action: response.kind, correction: false, rejection: false, complaint: false, skip: response.kind === 'skip', fatigue: false, model_tier_applied: 'quick', latency_ms: 1000, retry: obs.retry, error: null, tone_mismatch_observed: false });
    if (response.handoff) handoff = response.handoff;
  }
  return { agent: A.AGENT_VERSION, started: 2, updated: 2, mode: 'TEXT', tone: 'polite', phase: st.phase, asked: st.asked, profile: A.matchingProfile(st), handoff, records, calls: [{ kind: 'turn', ms: 1200, tier: 'quick' }, { kind: 'turn', ms: 1800, tier: 'quick' }] };
}
const legacy = { core: 'core-0.1', started: 1, updated: 1, phase: 'talk', facts: [{ area: 'intent', note: 'x' }],
  turns: Array.from({ length: 7 }, (_, k) => ({ n: k + 1, ai: '질문?', user: `답 ${k}`, kind: k === 3 ? 'repair' : 'answer', reply: '네.', question: k === 0 ? 'RELATIONSHIP_INTENT' : '같은 질문?' })),
  calls: Array.from({ length: 8 }, (_, k) => ({ kind: k ? 'turn' : 'opening', ms: 2000 + k, tier: 'quick' })) };

test('두 모양(옛 core-0.1 · 에이전트 v1.1)을 모두 읽는다 · 대시보드 숫자는 실제 문서에서만', async () => {
  const s = [M.normalizeSession('b', await v11Doc()), M.normalizeSession('a', legacy)];
  const d = M.dashboard(s);
  assert.equal(d.sessions, 2); assert.equal(d.done, 1); assert.equal(d.in_progress, 1);
  assert.equal(d.progress_unknown, 1); assert.equal(d.progress[4], 1, '한 답이 두 목적을 채워 핵심 질문 4개로 끝남');
  assert.equal(d.matching_ready, 1); assert.deepEqual(d.matching_status, ['TEST_NOT_CONNECTED']);
  assert.equal(d.ai_calls, 10); assert.match(d.tokens, /확인 불가/); assert.match(d.cost, /확인 불가/);
});

test('자동 후보: 기록에 그대로 보이는 것은 ACTUAL · 추정은 HYPOTHESIS · 모두 CANDIDATE(자동 VERIFIED 0)', async () => {
  const old = M.candidates(M.normalizeSession('a', legacy));
  const types = old.failure.map((f) => f.type);
  assert.ok(types.includes('CONVERSATION_EXIT_FAILURE')); assert.ok(types.includes('PROMPT_ID_LEAK')); assert.ok(types.includes('SAME_QUESTION_REPEATED')); assert.ok(types.includes('USER_COMPLAINT'));
  const now = M.candidates(M.normalizeSession('b', await v11Doc()));
  assert.deepEqual(now.success.map((x) => x.type).sort(), ['FINISHED_WITHIN_5', 'PROFILE_READY', 'SKIP_HONORED'].sort());
  assert.ok([...old.failure, ...now.success].every((x) => x.status === 'CANDIDATE'));
  assert.ok(!JSON.stringify([old, now]).includes('VERIFIED'));
});

test('AI 관측: 경로별 호출·오류·지연 · 토큰·비용은 확인 불가로 표시(숫자를 지어내지 않음)', async () => {
  const o = M.observability([M.normalizeSession('b', await v11Doc()), M.normalizeSession('a', legacy)]);
  assert.equal(o.rows.reduce((n, r) => n + r.calls, 0), 10);
  assert.ok(o.rows.every((r) => r.tokens === '확인 불가' && r.cost === '확인 불가'));
});

test('페이지는 admin.mjs 를 글자 그대로 담고, 관리자 화면에 쓰기 호출이 없다(관측 전용)', async () => {
  const { readFileSync } = await import('node:fs');
  const { inlineAgent } = await import('./build-page.mjs');
  const page = readFileSync(new URL('page.html', import.meta.url), 'utf8');
  assert.ok(page.includes(inlineAgent(readFileSync(new URL('admin.mjs', import.meta.url), 'utf8'))));
  const adminUi = page.slice(page.indexOf('// ── 관리자(관측 전용)'), page.indexOf('showSetup(false);'));
  assert.ok(adminUi.length > 1000);
  assert.ok(!/\.(set|update|delete)\(/.test(adminUi), '관리자 화면은 읽기만');
});
