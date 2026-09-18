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
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { root, FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

// 순수 규칙 모듈이라 서버를 띄우지 않고 그대로 불러 쓴다(규칙을 재구현하지 않는다).
async function loadRules(relativePath) {
  const absolutePath = resolve(root, relativePath);
  let source = await readFile(absolutePath, 'utf8');
  // 형제 모듈(./rules.ts)은 파일 URL 로 바꿔야 data: 모듈에서 풀린다(_edge-harness 와 같은 방식).
  source = source.replace(/from "\.\/([\w.-]+\.ts)";/g, (_m, name) =>
    `from ${JSON.stringify(pathToFileURL(resolve(absolutePath, '..', name)).href)};`);
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

test('⑤ 새 질문이 고갈돼도 되물음에는 답한다 (질문 없이 답만)', async () => {
  // 2026-09-18 운영 캐너리: 같은 되물음이 반복되면 새 질문이 고갈돼
  // (reasons=repeat,not_question) 답이 멀쩡한데도 NO_CANDIDATE 로 대화가 끝났다.
  const REPLY = '지금 무엇부터 해야 할지 저도 단정하기는 어려워요. 우선 마음에 걸리는 하나부터 함께 정리해볼게요.';
  const ai = {
    fetch: async (_url, options = {}) => {
      const request = JSON.parse(options.body);
      const system = String(request.messages?.[0]?.content ?? '');
      let content;
      if (request.response_format) {
        // 질문은 이미 물은 것을 그대로 되풀이한다(서버가 repeat 으로 막는다). 답은 멀쩡하다.
        content = JSON.stringify({ candidates: [{
          acknowledgement: '',
          question: '오늘 하루는 어떻게 지내셨나요?',
          anchor: '일이 너무 많아',
          assumptions: [],
          meaning: '같은 질문 반복',
          keys: ['반복'],
          reply: REPLY,
        }] });
      } else if (system.includes('요약해라')) {
        content = '요즘 일이 많아 지치신 것 같아요.';
      } else {
        content = '1. 오늘 하루는 어떻게 지내셨나요?';
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  };
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'ra';
  const started = await invoke(early, u, { action: 'start', mindText: '일이 너무 많아', token: token('ra-s') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('ra-a1') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '어떻게 해야 좋을까?', token: token('ra-n1') });
  const back = await invoke(early, u, { action: 'ask', conversationId, token: token('ra-a2') });
  assert.equal(back.body.ok, true, `막다른 길: ${back.body.code ?? ''}`);
  const shown = String(back.body.question ?? '');
  assert.ok(shown.includes(REPLY.slice(0, 12)), `사용자 물음에 답하지 않았다: ${shown}`);
});

test('⑥ 관련성 규칙은 2번째 시도부터 풀린다 (빠져나갈 문을 예산 안에 둔다)', () => {
  const OFF = '오늘 날씨는 참 맑아요.';
  const Q = '눈치 보는 건 어떻게 하는 게 좋을까?';
  // 1번째 시도: 그대로 막는다.
  assert.equal(gsq.replyQualityReason(OFF, Q, false), 'reply_irrelevant');
  assert.equal(ej.replyQualityReason(OFF, Q, 160, false), 'reply_irrelevant');
  // 2번째 시도부터: 관련성만 푼다.
  assert.equal(gsq.replyQualityReason(OFF, Q, true), null);
  assert.equal(ej.replyQualityReason(OFF, Q, 160, true), null);
  // 완화해도 빈 답·물음표·길이는 그대로 막는다.
  assert.equal(gsq.replyQualityReason('', Q, true), 'reply_missing');
  assert.equal(gsq.replyQualityReason('그건 무슨 뜻일까요?', Q, true), 'reply_question_mark');
  assert.equal(gsq.replyQualityReason('가'.repeat(200), Q, true), 'reply_too_long');
  assert.equal(ej.replyQualityReason('', Q, 160, true), 'reply_missing');
});

test('⑦ 질문 고갈: 아직 다루지 않은 사용자 근거를 찾아낸다', async () => {
  const ai = await loadRules('supabase/functions/get-step-question/ai.ts');
  const ctx = {
    mindText: '돈 걱정이 많아',
    messages: [
      { role: 'ai', step: 1, content: '돈 걱정이 어떤 모습으로 오나요?', message_kind: 'step_question' },
      { role: 'user', step: 1, content: '돈 걱정이 많아요', message_kind: 'step_answer' },
      { role: 'user', step: 2, content: '사람들 눈치도 보여요', message_kind: 'step_answer' },
    ],
    understandings: [],
  };
  const unused = ai.unusedEvidenceParts(ctx);
  assert.ok(unused.some((part) => part.includes('눈치')), `아직 안 쓴 근거를 못 찾았다: ${JSON.stringify(unused)}`);
  assert.ok(!unused.some((part) => part.includes('돈 걱정이 많아요')), `이미 다룬 근거를 아직 안 쓴 것으로 봤다: ${JSON.stringify(unused)}`);
});

test('⑧ 질문이 다 막혀도 되물음에는 답하고 상태를 그대로 둔다 (P0-09)', async () => {
  // 2026-09-18 캐너리 #6(G): 같은 되물음을 17턴 넘게 반복하자 같은 근거로 만들 새 질문이
  // 고갈돼(reasons=repeat,not_question) NO_CANDIDATE 로 대화가 끝났다.
  const REPLY = '제가 그렇게 본 이유는 앞서 하신 말씀 때문이에요. 제가 짚은 게 어긋났다면 바로잡아 주세요.';
  const ai = {
    fetch: async (_url, options = {}) => {
      const request = JSON.parse(options.body);
      const system = String(request.messages?.[0]?.content ?? '');
      let content;
      if (request.response_format) {
        // 세 후보 모두 이미 물은 질문을 되풀이한다(서버가 repeat 으로 막는다).
        // 답은 물음의 낱말을 다시 쓰지 않는다(예전 관련성 규칙이면 여기서도 막혔다).
        content = JSON.stringify({ candidates: [0, 1, 2].map(() => ({
          acknowledgement: '',
          question: '돈 걱정이 어떤 모습으로 오나요?',
          anchor: '돈 걱정이 많아',
          assumptions: [],
          meaning: '같은 질문 반복',
          keys: ['반복'],
          reply: REPLY,
        })) });
      } else if (system.includes('요약해라')) {
        content = '돈 걱정이 크신 것 같아요.';
      } else {
        content = '1. 돈 걱정이 어떤 모습으로 오나요?';
      }
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  };
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'exhaust';
  const started = await invoke(early, u, { action: 'start', mindText: '돈 걱정이 많아', token: token('ex-s') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('ex-a1') });
  const answered = await invoke(early, u, { action: 'answer', conversationId, answer: '왜 그렇게 생각했어?', token: token('ex-n1') });
  const statusBefore = answered.body.status;

  const back = await invoke(early, u, { action: 'ask', conversationId, token: token('ex-a2') });
  assert.equal(back.body.ok, true, `막다른 길: ${back.body.code ?? ''}`);
  const shown = String(back.body.question ?? '');
  assert.ok(shown.includes(REPLY.slice(0, 14)), `사용자 물음에 답하지 않았다: ${shown}`);
  // 되물음은 단계를 올리지 않는다(상태를 안전하게 유지).
  assert.equal(back.body.status, statusBefore, '되물음인데 단계가 넘어갔다');
});

test('⑨ 아직 안 쓴 근거를 프롬프트에 실어 준다 (질문을 지어내 주지는 않는다)', async () => {
  const prompts = [];
  const ai = {
    fetch: async (_url, options = {}) => {
      const request = JSON.parse(options.body);
      const system = String(request.messages?.[0]?.content ?? '');
      prompts.push(system);
      let content;
      if (request.response_format) {
        content = JSON.stringify({ candidates: [{
          acknowledgement: '', question: '눈치를 보게 되는 때는 언제인가요?', anchor: '사람들 눈치도',
          assumptions: [], meaning: '눈치 상황', keys: ['눈치'], reply: '',
        }] });
      } else if (system.includes('요약해라')) content = '돈 걱정이 크신 것 같아요.';
      else content = [
        '1. 돈 걱정이 어떤 모습으로 오나요?',
        '2. 오늘 하루는 어떻게 지내셨나요?',
        '3. 그때 몸은 어떤 상태였나요?',
      ].join('\n');
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  };
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'fresh';
  const started = await invoke(early, u, { action: 'start', mindText: '돈 걱정이 많아', token: token('fr-s') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('fr-a1') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '돈이 자꾸 모자라요', token: token('fr-n1') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('fr-a2') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '사람들 눈치도 보여요', token: token('fr-n2') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('fr-u') });
  await invoke(early, u, { action: 'choose', conversationId, choice: 'explain', text: '제가 직접 설명할게요. 잠이 잘 안 와요', token: token('fr-c') });
  const before = prompts.length;
  await invoke(early, u, { action: 'ask', conversationId, token: token('fr-f') });
  const prompt = prompts.slice(before).join('\n');
  assert.ok(prompt.includes('아직 한 번도 다루지 않은 사용자 근거'), '아직 안 쓴 근거 블록이 프롬프트에 없다');
  assert.ok(prompt.includes('사람들 눈치도 보여요'), '아직 안 쓴 근거 원문이 프롬프트에 없다');
  // 서버가 질문을 지어내 주지 않는다: 후보 질문 문장 자체는 프롬프트에 없다.
  assert.ok(!prompt.includes('눈치를 보게 되는 때는 언제인가요?'), '서버가 질문을 하드코딩해 넣었다');
});

test('⑩ 질문이 필요한 턴에서는 "질문을 만들지 마라"고 말하지 않는다', async () => {
  // 2026-09-18 캐너리 #6(F) 재현: 아직 안 쓴 근거가 없을 때 서버가 "새 질문을 만들지 마라"고
  // 안내하자 모델이 질문 아닌 문장을 냈고 not_question 으로 3번 다 막혀 대화가 끊겼다.
  const prompts = [];
  const QUESTION = '그 긴 하루 끝에 무엇이 가장 남았나요?';
  const ai = {
    fetch: async (_url, options = {}) => {
      const request = JSON.parse(options.body);
      const system = String(request.messages?.[0]?.content ?? '');
      prompts.push(system);
      let content;
      if (request.response_format) {
        content = JSON.stringify({ candidates: [{
          acknowledgement: '', question: QUESTION, anchor: '오늘 하루가',
          assumptions: [], meaning: '시점', keys: ['시점'], reply: '',
        }] });
      } else if (system.includes('요약해라')) {
        // 요약이 근거를 전부 다룬 상태를 만든다 → '아직 안 쓴 근거'가 0이 되는 조건.
        content = '요즘 지쳐요, 오늘 하루가 길었어요, 몸이 무거웠어요 라고 하셨네요. 많이 힘드신 것 같아요.';
      } else content = ['1. 오늘 하루는 어떻게 지내셨나요?', '2. 그때 몸은 어떤 상태였나요?', '3. 요즘 떠오르는 생각은 무엇인가요?'].join('\n');
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  };
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'noq';
  const started = await invoke(early, u, { action: 'start', mindText: '요즘 지쳐요', token: token('nq-s') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('nq-a1') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '오늘 하루가 길었어요', token: token('nq-n1') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('nq-a2') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '몸이 무거웠어요', token: token('nq-n2') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('nq-u') });
  // 정정 내용을 이미 나온 근거로만 두어 '아직 안 쓴 근거'가 남지 않게 만든다.
  await invoke(early, u, { action: 'choose', conversationId, choice: 'explain', text: '제가 직접 설명할게요. 오늘 하루가 길었어요', token: token('nq-c') });
  const before = prompts.length;
  const follow = await invoke(early, u, { action: 'ask', conversationId, token: token('nq-f') });
  const prompt = prompts.slice(before).join('\n');

  assert.ok(prompt.includes('아직 다루지 않은 사용자 근거가 없다'), '검사 전제 불성립: 아직 안 쓴 근거가 남아 있다');
  assert.ok(!prompt.includes('억지로 새 질문을 만들지 말고'), '질문이 필요한 턴인데 질문을 만들지 말라고 했다');
  assert.equal(follow.body.ok, true, `막다른 길: ${follow.body.code ?? ''}`);
  assert.ok(String(follow.body.question ?? '').includes(QUESTION), '질문이 화면에 나가지 않았다');
});

test('⑪ P0-08: 답을 못 만들어도 사용자 질문을 질문으로 되받지 않는다', async () => {
  // 2026-09-18 캐너리 #6(G) 확정 경로: asked_reply_failed 1건.
  // 모델이 답 후보를 3번 다 만들지 못하면 replyOnly 구제가 '질문만' 돌려주어
  // 사용자의 직접 질문이 무시됐다(운영 실제: "내가 언제 그렇게 말했어?" → "어떤 생각에 대해 궁금하신 건가요?").
  // 문장 하나를 통과시키는 것이 아니라, 같은 의미군 전체에서 '질문으로 회피'가 없어야 한다.
  const ASKS_FOR_BASIS = ['내가 언제 그렇게 말했어?', '왜 그렇게 생각했어?', '그 판단은 어디서 나온 거야?', '난 그런 말 한 적 없는데 왜 그래?'];
  const USER_SAID = '돈이 자꾸 모자라요';

  for (const userQuestion of ASKS_FOR_BASIS) {
    const ai = {
      fetch: async (_url, options = {}) => {
        const request = JSON.parse(options.body);
        const system = String(request.messages?.[0]?.content ?? '');
        let content;
        if (request.response_format) {
          // 모델이 답(reply)을 끝까지 만들지 못하는 상황을 그대로 만든다. 질문은 멀쩡하다.
          content = JSON.stringify({ candidates: [{
            acknowledgement: '', question: '그때 어떤 장면이 먼저 떠오르나요?', anchor: '돈이 자꾸 모자라',
            assumptions: [], meaning: '장면', keys: ['장면'], reply: '',
          }] });
        } else if (system.includes('요약해라')) content = '많이 힘드신 것 같아요.';
        else content = ['1. 오늘은 어떤 하루였나요?', '2. 그때 몸은 어떤 상태였나요?', '3. 요즘 떠오르는 생각은 무엇인가요?'].join('\n');
        return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      },
    };
    const db = new FakeDatabase();
    const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
    const u = `basis-${ASKS_FOR_BASIS.indexOf(userQuestion)}`;
    const started = await invoke(early, u, { action: 'start', mindText: '돈 걱정이 많아', token: token(`${u}-s`) });
    const conversationId = started.body.conversationId;
    await invoke(early, u, { action: 'ask', conversationId, token: token(`${u}-a1`) });
    await invoke(early, u, { action: 'answer', conversationId, answer: USER_SAID, token: token(`${u}-n1`) });
    await invoke(early, u, { action: 'ask', conversationId, token: token(`${u}-a2`) });
    await invoke(early, u, { action: 'answer', conversationId, answer: userQuestion, token: token(`${u}-n2`) });

    const back = await invoke(early, u, { action: 'ask', conversationId, token: token(`${u}-a3`) });
    assert.equal(back.body.ok, true, `막다른 길(${userQuestion}): ${back.body.code ?? ''}`);
    const shown = String(back.body.question ?? '');
    const head = (shown.split('\n\n')[0] ?? '').trim();
    assert.ok(head, `빈 화면(${userQuestion})`);
    assert.ok(!/^[^?]*\?\s*$/.test(head), `사용자 물음을 질문으로 되받았다(${userQuestion}): ${shown}`);
    // 없는 사실을 만들지 않았는지: 답은 사용자가 실제로 한 말에 근거해야 한다.
    assert.ok(head.includes(USER_SAID) || head.includes(USER_SAID.replace(/요$/, '')),
      `사용자 원문 근거 없이 답했다(${userQuestion}): ${head}`);
  }
});

test('⑫ P0-04: 정정을 못 다루면 마지막 시도에서 근거를 정정 문장으로 좁힌다', async () => {
  // 2026-09-18 캐너리 #3(D): 정정("사실은 일보다 사람이 더 힘들어요") 직후 질문이 다시 일 중심이었다.
  // 규칙은 4번 막았지만 모델이 3번 다 정정을 다룬 후보를 못 만들어 구제로 넘어갔다(correction_unreflected).
  const CORRECTION = '조금 달라요. 반은 맞고 반은 아닌 것 같아요. 사실은 일보다 사람이 더 힘들어요';
  const userContents = [];
  const ai = {
    fetch: async (_url, options = {}) => {
      const request = JSON.parse(options.body);
      const system = String(request.messages?.[0]?.content ?? '');
      const userMsg = String(request.messages?.[1]?.content ?? '');
      let content;
      if (request.response_format) {
        userContents.push(userMsg);
        // 근거를 정정 문장으로 좁혀 주면 그제야 정정을 다룬 후보를 낸다(실모델의 행동을 흉내).
        const focused = userMsg.includes('이 문장 하나만 보고');
        content = JSON.stringify({ candidates: [focused
          ? { acknowledgement: '사람이 더 힘들다고 하셨네요.', question: '사람과 지내며 어떤 점이 무겁게 다가오나요?', anchor: '사람이 더 힘들', assumptions: [], meaning: '사람 관계', keys: ['사람관계'], reply: '' }
          : { acknowledgement: '일이 너무 많다고 하셨네요.', question: '일이 많아지면서 어떤 부분이 부담되나요?', anchor: '일이 너무 많아', assumptions: [], meaning: '일 부담', keys: ['일부담'], reply: '' }] });
      } else if (system.includes('요약해라')) content = '일이 많아 지치신 것 같아요.';
      else content = ['1. 오늘은 어떤 하루였나요?', '2. 그때 몸은 어떤 상태였나요?', '3. 요즘 떠오르는 생각은 무엇인가요?'].join('\n');
      return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  };
  const db = new FakeDatabase();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const u = 'corrfocus';
  const started = await invoke(early, u, { action: 'start', mindText: '일이 너무 많아', token: token('cf-s') });
  const conversationId = started.body.conversationId;
  await invoke(early, u, { action: 'ask', conversationId, token: token('cf-a1') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '일이 너무 많아서 잠을 못 자요', token: token('cf-n1') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('cf-a2') });
  await invoke(early, u, { action: 'answer', conversationId, answer: '돈이 제일 크게 걸려요', token: token('cf-n2') });
  await invoke(early, u, { action: 'ask', conversationId, token: token('cf-u') });
  await invoke(early, u, { action: 'choose', conversationId, choice: 'alittle', text: CORRECTION, token: token('cf-c') });

  const before = userContents.length;
  const follow = await invoke(early, u, { action: 'ask', conversationId, token: token('cf-f') });
  assert.equal(follow.body.ok, true, `막다른 길: ${follow.body.code ?? ''}`);
  const rounds = userContents.slice(before);
  assert.ok(rounds.length >= 2, `시도가 한 번뿐이라 마지막 시도를 확인할 수 없다(${rounds.length})`);
  assert.ok(rounds[rounds.length - 1].includes('이 문장 하나만 보고'), '마지막 시도에서 근거를 정정 문장으로 좁히지 않았다');
  assert.ok(String(follow.body.question ?? '').includes('사람'), `정정이 다음 질문에 반영되지 않았다: ${follow.body.question}`);
});
