// 2026-09-20 P0 최소 수정 — 실AI 100회(최종 코드)에서 남은 NO_CANDIDATE 5건·정정무시 1건의 확정 원인을 고정한다.
//   ej STEP 3·6 : quality:unsupported_anchor / not_question 로 후보 전멸 → 구제 없음 → NO_CANDIDATE (4건)
//   gsq followup: 내용 없는 거절 뒤 not_question·rejected_meaning 로 전멸 → 일반 모드 구제 없음 → NO_CANDIDATE (1건)
//   #58        : 정정 직후 correction_ignored 후보만 나와 구제가 '정정을 무시한 후보'를 그대로 냄 → 정정무시
// 원칙: 거절한 뜻 되살리기 금지 · 안전 규칙 완화 금지 · 없는 사실 만들기 금지 · 하드코딩 질문 배열 금지.
// 모든 후보가 막히면 '사용자 원문을 그대로 인용한 안전한 이어가기'로 대화를 잇는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { root, FakeDatabase, loadEdgeHandler, invoke, token, completeFreeStage } from './_edge-harness.mjs';

const GSQ = 'supabase/functions/get-step-question/index.ts';
const EJ = 'supabase/functions/echo-journey/index.ts';
const SINGLE = ['1. 오늘 하루는 어떻게 지내셨나요?', '2. 그때 몸은 어떤 상태였나요?', '3. 요즘 자주 떠오르는 생각은 무엇인가요?'].join('\n');
const oneQuestionMark = (t) => (t.match(/\?/g) ?? []).length === 1 && /\?\s*$/.test(t.trim());

async function loadRules(relativePath) {
  const absolutePath = resolve(root, relativePath);
  let source = await readFile(absolutePath, 'utf8');
  source = source.replace(/from "\.\/([\w.-]+\.ts)";/g, (_m, name) => `from ${JSON.stringify(pathToFileURL(resolve(absolutePath, '..', name)).href)};`);
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: absolutePath }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
function fakeAi(jsonCandidates, understanding = '마음이 편안하신 것 같아요.') {
  return {
    fetch: async (_url, options = {}) => {
      const request = JSON.parse(options.body);
      const system = String(request.messages?.[0]?.content ?? '');
      let content;
      if (request.response_format) content = JSON.stringify({ candidates: jsonCandidates });
      else if (system.includes('요약해라')) content = understanding;
      else content = SINGLE;
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  };
}

test('① ej STEP 3: 후보가 전부 근거 밖 앵커로 막혀도 사용자 원문을 인용해 이어간다', async () => {
  // 확정 원인: [내가 확인한 기억](AI 요약)이 프롬프트에 실려 모델이 거기서 앵커를 가져옴 → unsupported_anchor 전멸.
  const bad = { acknowledgement: '마음이 한결 가벼워지셨군요.', question: '그 가벼움은 어떤 순간에 가장 크게 느껴지나요?', anchor: '마음이 한결 가벼워', assumptions: [], meaning: '가벼움의 순간', keys: ['가벼움'], reply: '' };
  const ai = fakeAi([bad, bad, bad]);
  const db = new FakeDatabase();
  const early = await loadEdgeHandler(GSQ, db, ai);
  const journey = await loadEdgeHandler(EJ, db, ai);
  const conversationId = await completeFreeStage(early, 'gf1');
  const q = await invoke(journey, 'gf1', { action: 'ask', conversationId, token: token('gf1-q3') });
  assert.equal(q.body.ok, true, `막다른 길: ${q.body.code ?? ''}`);
  const shown = String(q.body.question ?? '');
  assert.ok(shown.trim(), '빈 화면');
  assert.ok(!shown.includes(bad.question), '근거 없는 후보가 화면에 나갔다');
  assert.ok(shown.includes('서두르지 않아도 된다는 여유야'), `사용자 최신 원문 인용이 없다: ${shown}`);
  assert.ok(oneQuestionMark(shown), `물음표 하나로 끝나야 저장·재표시 규칙을 통과한다: ${shown}`);
  // 이어서 답하면 단계가 정상 진행된다(막다른 길 아님)
  const a = await invoke(journey, 'gf1', { action: 'answer', conversationId, answer: '아침에 창문을 열 때요', token: token('gf1-a3') });
  assert.equal(a.body.ok, true);
});

test('② gsq 일반 모드: 내용 없는 거절 뒤 후보가 전부 막혀도 이어간다', async () => {
  const notQ = { acknowledgement: '', question: '그 마음을 조금 더 들려주시면 좋겠어요.', anchor: '일이 너무 많아', assumptions: [], meaning: '요청', keys: ['요청'], reply: '' };
  const ai = fakeAi([notQ, notQ, notQ], '요즘 너무 지치고 돈 걱정이 가장 크게 느껴지시는 것 같네요.');
  const db = new FakeDatabase();
  const early = await loadEdgeHandler(GSQ, db, ai);
  const u = 'gf2';
  const s = await invoke(early, u, { action: 'start', mindText: '요즘 너무 지쳐', token: token('gf2-s') });
  const cid = s.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf2-a1') });
  await invoke(early, u, { action: 'answer', conversationId: cid, answer: '일이 너무 많아서 잠을 못 자요', token: token('gf2-n1') });
  await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf2-a2') });
  await invoke(early, u, { action: 'answer', conversationId: cid, answer: '돈이 제일 크게 걸려요', token: token('gf2-n2') });
  await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf2-u') });
  const no = await invoke(early, u, { action: 'choose', conversationId: cid, choice: 'no', text: '그게 아니에요. 제가 말한 건 그런 뜻이 전혀 아니에요', token: token('gf2-c') });
  assert.equal(no.body.status, 'followup');
  const f = await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf2-f') });
  assert.equal(f.body.ok, true, `막다른 길: ${f.body.code ?? ''}`);
  const shown = String(f.body.question ?? '');
  assert.ok(shown.includes('돈이 제일 크게 걸려요') || shown.includes('일이 너무 많아서 잠을 못 자요'), `사용자 원문 인용이 없다: ${shown}`);
  assert.ok(oneQuestionMark(shown), `물음표 하나로 끝나야 한다: ${shown}`);
  // 거절한 해석(돈 걱정이 가장 크다)을 서버 문장이 되살리지 않는다
  assert.ok(!/걱정이 가장 크게 느껴지/.test(shown), '거절한 해석을 되살렸다');
});

test('③ #58 재현: 정정을 무시한 후보만 나오면 정정을 무시한 채 내보내지 않는다', async () => {
  const ignores = { acknowledgement: '돈이 제일 크게 걸린다고 하셨네요.', question: '돈 문제와 관련해서 어떤 부분이 가장 걱정되시나요?', anchor: '돈이 제일 크게', assumptions: [], meaning: '돈 걱정', keys: ['돈걱정'], reply: '' };
  const ai = fakeAi([ignores, ignores, ignores], '요즘 일이 너무 많아서 잠도 잘 못 주무시고, 특히 돈 문제로 걱정이 많으신 것 같아요.');
  const db = new FakeDatabase();
  const early = await loadEdgeHandler(GSQ, db, ai);
  const u = 'gf3';
  const s = await invoke(early, u, { action: 'start', mindText: '일이 너무 많아', token: token('gf3-s') });
  const cid = s.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf3-a1') });
  await invoke(early, u, { action: 'answer', conversationId: cid, answer: '일이 너무 많아서 잠을 못 자요', token: token('gf3-n1') });
  await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf3-a2') });
  await invoke(early, u, { action: 'answer', conversationId: cid, answer: '돈이 제일 크게 걸려요', token: token('gf3-n2') });
  await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf3-u') });
  await invoke(early, u, { action: 'choose', conversationId: cid, choice: 'explain', text: '제가 직접 설명할게요. 돈보다 시간이 없는 게 더 힘들어요', token: token('gf3-c') });
  const f = await invoke(early, u, { action: 'ask', conversationId: cid, token: token('gf3-f') });
  assert.equal(f.body.ok, true, `막다른 길: ${f.body.code ?? ''}`);
  const shown = String(f.body.question ?? '');
  assert.ok(shown.includes('시간'), `최신 정정(시간)이 반영되지 않았다: ${shown}`);
  // 정정 원문("돈보다 시간…")을 인용하는 것은 허용. 과거 근거("돈이 제일 크게")나 돈 중심 질문("돈 문제")으로 되돌아가면 실패.
  assert.ok(!/돈이 제일 크게|돈 문제/.test(shown), `과거 근거(돈)를 주된 문제로 되살렸다: ${shown}`);
  assert.ok(oneQuestionMark(shown), `물음표 하나로 끝나야 한다: ${shown}`);
});

test('④ 최신 정정 우선: 정정이 대기 중이면 앵커는 정정 문장에서 가져와야 한다 (양쪽 서버)', async () => {
  const gsq = await loadRules('supabase/functions/get-step-question/rules.ts');
  const ctx = { askedTexts: [], rejectedKeys: [], rejectedTexts: [], evidenceTexts: ['일이 너무 많아서 잠을 못 자요', '돈이 제일 크게 걸려요', '제가 직접 설명할게요. 돈보다 시간이 없는 게 더 힘들어요'], pendingCorrection: '제가 직접 설명할게요. 돈보다 시간이 없는 게 더 힘들어요' };
  const base = { acknowledgement: '', assumptions: [], meaning: '시간 부족', keys: ['시간부족'], reply: '', question: '시간이 부족할 때 어떤 점이 가장 힘드신가요?' };
  assert.equal(gsq.blockReasonFor({ ...base, anchor: '돈이 제일 크게' }, ctx, { relaxed: false }), 'correction_ignored', 'gsq: 과거 근거 앵커가 통과했다');
  assert.equal(gsq.blockReasonFor({ ...base, anchor: '시간이 없는' }, ctx, { relaxed: false }), null, 'gsq: 정정 앵커가 막혔다');
  assert.equal(gsq.blockReasonFor({ ...base, anchor: '돈이 제일 크게' }, ctx, { relaxed: true }), 'correction_ignored', 'gsq: 완화 시도에서도 과거 앵커는 막혀야 한다');
});

test('⑤ 양쪽 서버에 같은 구제·같은 기억 주의 문구가 있다', async () => {
  const gsq = await readFile(resolve(root, 'supabase/functions/get-step-question/ai.ts'), 'utf8');
  const ej = await readFile(resolve(root, EJ), 'utf8');
  for (const [name, src] of [['gsq', gsq], ['ej', ej]]) {
    assert.ok(src.includes('grounded_fallback'), `${name}: 원문 인용 이어가기 구제가 없다`);
    assert.ok(src.includes('앵커(anchor)는 이 기억에서 가져오지 않는다'), `${name}: 기억에서 앵커 금지 문구가 없다`);
  }
});
