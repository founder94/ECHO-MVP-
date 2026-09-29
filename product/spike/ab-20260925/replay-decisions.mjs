// Replay Evaluation — 서버 판정 재생(2026-09-25). 실제 AI 를 부르지 않는다.
// 운영에서 실제로 나온 문장(사용자 원문 · 운영 AI 질문)을 A(운영 v27 원본 함수)·B(B-1.0 서버 결정)에 그대로 넣어,
// "모델이 이 문장을 냈을 때 서버가 무엇을 결정하는가"만 결정적으로 다시 본다(Evaluation · Orchestration 층 분리용).
// - 모델 품질은 이 재생으로 판정하지 않는다. B 의 질문 의도(question_intent)는 운영 기록에 없으므로 두 가지 이름 붙이기를 가정해 한계를 드러낸다.
// 실행: node spike/ab-20260925/replay-decisions.mjs [--out 결과.md] [--json 결과.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { A_FILE, GOLDEN, recorder, loadA } from './harness-lib.mjs';
import { decideQuestion, newBState } from './agentB.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const source = readFileSync(A_FILE, 'utf8');
const limit = (name) => Number(source.match(new RegExp(`${name}:\\s*([0-9.]+)`))[1]); // A 의 LIMITS 값을 원본에서 그대로 읽는다(복사 숫자 0)
const REPEAT_SIM = limit('REPEAT_SIM');
const REPEAT_OVERLAP = limit('REPEAT_OVERLAP');

// 정상 사례 역검사 입력(SYNTHETIC). 분명한 답 16개는 product/qa/conversation-rules.test.mjs(v15.1)에서 그대로 가져왔다.
export const COUNTER_CLEAR_SYNTHETIC = ['보드게임 같은 거 같이 하고 싶어요', '맛있는 거 먹는 거 같은 거요', '같은 얘기를 해도 웃어 주는 사람', '비슷한 말을 해도 잘 들어주는 사람',
  '연애에 지쳐서 천천히 만나고 싶어요', '가볍게 만나는 건 지쳐서 그런 것 같아요', '일이 피곤해서 주말엔 쉬고 싶어요', '귀찮게 연락 자주 하는 사람은 싫어요',
  '연락 그만하자고 하면 서운해요', '싸우면 그만하고 싶어져요', '다 얘기했던 친구가 떠났어요', '친구한테 다 말했어요', '네 알아서 해 주는 사람이 좋아요',
  '패스트푸드 말고 집밥 좋아해요', '지친 날엔 조용히 있고 싶어요', '아니요, 대화가 많은 게 좋아요'];
// 「같이 뭐 하고 싶어요?」 뒤에 올 수 있는 짧은 물음표 답(「취미생활?」과 같은 모양). 정답 없음.
export const COUNTER_AMBIGUOUS_SYNTHETIC = ['산책?', '운동?', '여행?', '영화?', '맛집?', '독서?', '드라이브?', '카페?'];

export function replay() {
  const { sandbox } = loadA('아직 정하지 않았어요', recorder(), []);
  const A = sandbox; // v27 의 최상위 function 선언(ruleKind·looksSame·overlapStats·questionBody·askFallback)

  // R1 — A 규칙 분류 층: 고정 입력 전체에 대해 AI 없이 규칙이 먼저 정하는 종류
  const rules = GOLDEN.flatMap((f) => f.steps.map(([text, expect, origin]) => ({ flow: f.id, text, expect, origin, a_rule: A.ruleKind(text) ?? null })));

  // R2 — GF-01: 운영(실제 AI)에서 연달아 나간 같은 뜻 질문 4개(04:22:21 → 04:23:41 KST, 순서만 실제 · 답과의 1:1 짝은 미확정)
  const PROD_Q = [
    '사람을 알아가는 데 어떤 점이 가장 중요하다고 생각해요?',
    '사람을 알아가면서 어떤 점이 가장 즐거운 것 같아요?',
    '진심으로 사람을 알아가는 데 어떤 점이 특별하다고 느끼나요?',
    '사람을 진심으로 알아가는 과정에서 어떤 점이 가장 마음에 드나요?',
  ];
  const aRepeat = PROD_Q.map((q, i) => {
    const asked = PROD_Q.slice(0, i);
    const pairs = asked.map((p) => ({ with: p, ...A.overlapStats(A.questionBody(q), p) }));
    const blocked = asked.some((p) => A.looksSame(A.questionBody(q), p, REPEAT_SIM, REPEAT_OVERLAP));
    return { q, blocked, max_sim: Math.max(0, ...pairs.map((p) => p.sim)), max_overlap: Math.max(0, ...pairs.map((p) => p.overlap)) };
  });
  // B: 질문 의도 이름을 모델이 (i) 같은 뜻에 같은 이름으로 붙였을 때 (ii) 표현마다 다른 이름으로 붙였을 때
  const bRegime = (labels) => {
    const s = newBState('아직 정하지 않았어요');
    return PROD_Q.map((q, i) => {
      const why = decideQuestion({ question: q, intent: labels[i], sameAs: '' }, s);
      if (!why) s.answeredIntents.push(labels[i]); // 사이에 사용자가 답했다고 본다(운영 순서와 같다)
      return { q, intent: labels[i], decision: why || 'pass' };
    });
  };
  const bSame = bRegime(Array(4).fill('사람을 알아갈 때 중요한 점'));
  const bDiff = bRegime(['알아갈 때 가장 중요한 점', '알아가며 즐거운 점', '진심으로 알아갈 때 특별한 점', '진심으로 알아가는 과정의 좋은 점']);

  // R3 — GF-06: 질문 방향을 고쳐 달라는 말이 ask 로 가면 A 가 내는 고정 사실문(AI 답이 비었거나 걸러졌을 때)
  const complaint = GOLDEN.find((f) => f.id === 'FLOW3').steps.find(([, , origin]) => origin.startsWith('ACTUAL(캡처'))[0];
  const askFallback = A.askFallback(complaint);

  // R4 — Counter-test(정상 사례 역검사): 규칙 층이 정상 답을 답이 아닌 것으로 강제하는지.
  //   (a) 분명한 답 = ACTUAL 정상 답(고정 입력의 expect=answer·ACTUAL) + SYNTHETIC 실사용 말투 16개(v15.1 검사에서 가져옴) → 규칙은 비워 둬야 한다(null).
  //   (b) 애매한 짧은 물음표 답 = SYNTHETIC. 답일 수도 되물음일 수도 있어 정답이 없다 → "규칙이 강제로 정하는 수"만 센다(오탐으로 세지 않음).
  const actualAnswers = [...new Set(GOLDEN.flatMap((f) => f.steps.filter(([, expect, origin]) => expect === 'answer' && origin === 'ACTUAL').map(([text]) => text)))];
  const synthAnswers = COUNTER_CLEAR_SYNTHETIC;
  const clear = [...actualAnswers.map((text) => ({ text, origin: 'ACTUAL' })), ...synthAnswers.map((text) => ({ text, origin: 'SYNTHETIC' }))].map((x) => ({ ...x, a_rule: A.ruleKind(x.text) ?? null }));
  const ambiguous = COUNTER_AMBIGUOUS_SYNTHETIC.map((text) => ({ text, origin: 'SYNTHETIC', a_rule: A.ruleKind(text) ?? null }));

  return { limits: { REPEAT_SIM, REPEAT_OVERLAP }, rules, aRepeat, bSame, bDiff, complaint_rule: A.ruleKind(complaint) ?? null, askFallback, counter: { clear, ambiguous } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = replay();
  const flat = (x) => String(x ?? '').replace(/\|/g, '/').replace(/\n/g, ' ⏎ ');
  const L = ['# Replay Evaluation — 서버 판정 재생 (실제 AI 호출 0 · 운영 실제 문장 입력)', '',
    '- A = 운영 v27 원본 함수(지문 확인). B = B-1.0 `decideQuestion`. 결과는 결정적이다(몇 번 돌려도 같다).',
    `- A 반복 기준(원본에서 읽음): sim > ${REPEAT_SIM} 또는 overlap > ${REPEAT_OVERLAP}.`, '',
    '## R1 · A 규칙 분류 층(AI 전에 규칙이 강제하는 종류)', '', '| Flow | 출처 | 사용자 말 | 사람이 붙인 기대 | A 규칙 결과 | 일치 |', '|---|---|---|---|---|---|'];
  const agree = (e, k) => (k === null ? '— (AI 분류로 넘어감)' : (e === k || (e === 'repair' && ['complaint', 'meta'].includes(k)) ? '○' : '✕'));
  for (const x of r.rules) L.push(`| ${x.flow} | ${x.origin} | ${flat(x.text)} | ${x.expect} | ${x.a_rule ?? '규칙 없음'} | ${agree(x.expect, x.a_rule)} |`);
  L.push('', '- repair 기대에 A 의 complaint·meta 는 같은 계열로 본다(A 에는 repair 라는 이름이 없다).', '',
    '## R2 · GF-01 운영 실제 질문 4개에 대한 반복 판정', '', '| # | 운영 질문(실제 AI) | A: 앞 질문과 최대 sim / overlap | A 판정 | B(같은 이름) | B(다른 이름) |', '|---|---|---|---|---|---|');
  r.aRepeat.forEach((a, i) => L.push(`| ${i + 1} | ${a.q} | ${a.max_sim.toFixed(2)} / ${a.max_overlap.toFixed(2)} | ${a.blocked ? '막음(repeat)' : '통과'} | ${r.bSame[i].decision} | ${r.bDiff[i].decision} |`));
  L.push('', '- B(같은 이름) = 모델이 같은 뜻에 같은 의도 이름을 붙였다고 가정. B(다른 이름) = 표현마다 다른 이름을 붙였다고 가정. **어느 쪽이 실제인지는 실제 AI 로만 알 수 있다.**',
    '- **[HEURISTIC / EXPERIMENT ONLY]** B 의 의도 비교는 이름이 정규화 뒤 같을 때만 막는다 → 다른 이름이면 미탐.', '',
    '## R3 · GF-06 질문 방향 제안', '', `- 입력(ACTUAL, 캡처 재구성): ${r.complaint_rule === null ? 'A 규칙 없음 → AI 분류로 넘어감(운영에서는 ask 로 분류됨)' : `A 규칙 = ${r.complaint_rule}`}`,
    `- A 의 ask 대체 문장(AI 답이 비었거나 걸러질 때): 「${flat(r.askFallback)}」`);
  const cf = r.counter.clear.filter((x) => x.a_rule !== null);
  L.push('', '## R4 · Counter-test — 정상 사례 역검사(규칙 층)', '',
    `- 분명한 답 ${r.counter.clear.length}개(ACTUAL ${r.counter.clear.filter((x) => x.origin === 'ACTUAL').length} · SYNTHETIC ${r.counter.clear.filter((x) => x.origin === 'SYNTHETIC').length}) 중 A 규칙이 답이 아닌 것으로 강제: **${cf.length}개**${cf.length ? ' — ' + cf.map((x) => `「${x.text}」→${x.a_rule}`).join(', ') : ''}`,
    `- 애매한 짧은 물음표 답 ${r.counter.ambiguous.length}개(SYNTHETIC) 중 A 규칙이 강제로 정함: **${r.counter.ambiguous.filter((x) => x.a_rule !== null).length}개** (${r.counter.ambiguous.map((x) => `「${x.text}」→${x.a_rule ?? '규칙 없음'}`).join(', ')})`,
    '- 애매한 입력은 정답이 없어 오탐으로 세지 않는다. 다만 규칙이 모델보다 먼저 한쪽(되묻기)으로 정해 버린다는 것은 사실이다(GF-05 와 같은 모양).',
    '- B-1.0 은 문자열 분류 규칙이 없어 이 층의 강제는 0 이다. 그 대신 모델이 가르며, 모델이 맞게 가르는지는 실제 AI 로만 알 수 있다(BLOCKED_BY_ENVIRONMENT).');
  const text = L.join('\n');
  if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(r, null, 1));
}
