// P0-08 되물음 처리 실패 — 2026-09-18 운영 로그로 확정된 원인을 고정한다.
//   asked 모드 차단 사유: reply_missing 39 → (서식 수정 후) 0,
//   그다음 남은 절대다수가 reply_irrelevant 였다.
//   원인: 관련성 규칙이 '답이 질문의 글자를 다시 쓸 것'을 요구하는데,
//        "무슨 뜻이야?" 같은 되물음은 의문사·지시어뿐이라 겹칠 낱말 자체가 없다.
//        → 어떤 답도 통과하지 못하고 사용자의 물음이 영영 답을 못 받는다.
// 두 서버(get-step-question · echo-journey)에 같은 규칙이 있으므로 둘 다 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { root, FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

// 순수 규칙 모듈이라 서버를 띄우지 않고 그대로 불러 쓴다(규칙을 재구현하지 않는다).
async function loadRules(relativePath) {
  const absolutePath = resolve(root, relativePath);
  const source = await readFile(absolutePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: absolutePath,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const gsq = await loadRules('supabase/functions/get-step-question/rules.ts');
const ej = await loadRules('supabase/functions/echo-journey/question-quality.ts');

// 운영 캐너리가 실제로 보낸 되물음들(G·H 그룹).
const CONTENT_FREE = ['무슨 뜻이야?', '왜 그렇게 생각했어?', '그래서 어떻게 해?', '어떻게 해야 좋을까?', '그럼 난 뭘 하면 돼?'];
const HAS_CONTENT = ['돈 걱정은 어떻게 보나요?', '제가 말한 시간 문제는 어떻게 생각하세요?'];
// 실제 모델이 낼 법한, 물음에 응답하는 자연스러운 답.
const NATURAL = '지금 무엇부터 해야 할지 저도 단정하기는 어려워요. 우선 가장 마음에 걸리는 하나부터 함께 정리해볼게요.';
// 물음과 아무 상관 없는 답(막혀야 한다).
const OFF_TOPIC = '오늘 날씨가 참 맑네요.';

test('① 내용어 없는 되물음에는 관련성 규칙을 걸지 않는다 (두 서버 동일)', () => {
  for (const question of CONTENT_FREE) {
    assert.equal(gsq.questionHasContent(question), false, `gsq: 내용어가 있다고 잘못 봤다 — ${question}`);
    assert.equal(ej.questionHasContent(question), false, `ej: 내용어가 있다고 잘못 봤다 — ${question}`);
    assert.equal(gsq.replyQualityReason(NATURAL, question), null, `gsq: 자연스러운 답이 막혔다 — ${question}`);
    assert.equal(ej.replyQualityReason(NATURAL, question, 160), null, `ej: 자연스러운 답이 막혔다 — ${question}`);
  }
});

test('② 과소차단 금지: 내용어가 있는 물음에는 규칙이 그대로 살아 있다', () => {
  for (const question of HAS_CONTENT) {
    assert.equal(gsq.questionHasContent(question), true, `gsq: 내용어를 못 찾았다 — ${question}`);
    assert.equal(ej.questionHasContent(question), true, `ej: 내용어를 못 찾았다 — ${question}`);
    assert.equal(gsq.replyQualityReason(OFF_TOPIC, question), 'reply_irrelevant', `gsq: 무관한 답이 통과했다 — ${question}`);
    assert.equal(ej.replyQualityReason(OFF_TOPIC, question, 160), 'reply_irrelevant', `ej: 무관한 답이 통과했다 — ${question}`);
  }
});

test('③ 나머지 답 품질 규칙은 그대로다', () => {
  assert.equal(gsq.replyQualityReason('', '무슨 뜻이야?'), 'reply_missing');
  assert.equal(gsq.replyQualityReason('그건 무슨 뜻일까요?', '무슨 뜻이야?'), 'reply_question_mark');
  assert.equal(gsq.replyQualityReason('가'.repeat(200), '무슨 뜻이야?'), 'reply_too_long');
  assert.equal(ej.replyQualityReason('', '무슨 뜻이야?', 160), 'reply_missing');
  assert.equal(ej.replyQualityReason('그건 무슨 뜻일까요?', '무슨 뜻이야?', 160), 'reply_question_mark');
});

test('④ 거절 뒤 요약을 세 번 다 못 만들어도 대화가 끊기지 않는다 (P0-09)', async () => {
  // 2026-09-18 운영 캐너리 E(강한 거절): 사용자가 새 내용 없이 거절하자 같은 근거로 다시 쓴 요약이
  // 매번 거절한 뜻과 닮아 understanding_reject ×3 → NO_CANDIDATE 로 화면이 끝났다.
  const SUMMARY = '요즘 일이 많아 많이 지치신 것 같아요.';
  const ai = {
    fetch: async (_url, options = {}) => {
      const request = JSON.parse(options.body);
      const system = String(request.messages?.[0]?.content ?? '');
      // 요약은 늘 같은 문장을 낸다(거절한 뜻이 계속 되살아나는 운영 상황 그대로).
      let content;
      if (request.response_format) {
        content = JSON.stringify({ candidates: [{
          acknowledgement: '잠을 못 주무신다고 하셨군요.',
          question: '잠자리에 들 때 어떤 생각이 스치나요?',
          anchor: '잠을 못 자',
          assumptions: [],
          meaning: '잠들 무렵의 생각을 묻는다',
          keys: ['수면'],
          reply: '',
        }] });
      } else if (system.includes('요약해라')) {
        content = SUMMARY;
      } else {
        content = ['1. 오늘 하루는 어떻게 지내셨나요?', '2. 그때 몸은 어떤 상태였나요?', '3. 요즘 자주 떠오르는 생각은 무엇인가요?'].join('\n');
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  };
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'p09';
  const started = await invoke(early, u, { action: 'start', mindText: '일이 너무 많아', token: token('p09-s') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('p09-a1') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '일이 너무 많아서 잠을 못 자요', token: token('p09-n1') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('p09-a2') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '돈이 제일 크게 걸려요', token: token('p09-n2') });
  const summary = await invoke(early, u, { action: 'ask', conversationId, token: token('p09-u') });
  assert.equal(summary.body.understanding, SUMMARY);

  // 새 내용 없는 강한 거절 — 실사용자가 실제로 치는 말.
  const chose = await invoke(early, u, { action: 'choose', conversationId, choice: 'no', text: '그게 아니에요. 제가 말한 건 그런 뜻이 전혀 아니에요', token: token('p09-c') });
  assert.equal(chose.body.ok, true);

  // 거절 → followup 질문 → 답 → 다시 요약 차례. 이 요약이 운영에서 3번 다 막혀 대화가 끝났다.
  const follow = await invoke(early, u, { action: 'ask', conversationId, token: token('p09-f') });
  assert.equal(follow.body.ok, true, `followup 막힘: ${follow.body.code ?? ''}`);
  await invoke(early, u, { action: 'answer', conversationId, answer: '새벽에 자꾸 깨요', token: token('p09-n3') });

  const again = await invoke(early, u, { action: 'ask', conversationId, token: token('p09-u2') });
  assert.equal(again.body.ok, true, `막다른 길: ${again.body.code ?? ''}`);
  const shown = String(again.body.understanding ?? again.body.question ?? '');
  assert.ok(shown.trim(), '빈 화면이 나갔다');
  assert.notEqual(shown, SUMMARY, '거절한 해석이 그대로 다시 나왔다');
});
