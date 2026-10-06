// STEP 1 부터 7 까지, 끝(리포트 직전)까지 여러 번 완주시키는 검사.
// 한계: 진짜 OpenAI 가 아니라 '보통 수준으로 제대로 답하는 가짜 모델' 이다.
//   진짜 모델이 실제로 뭐라고 쓰는지는 이 검사로 알 수 없다(실계정 실행이 필요).
// 그래도 이 검사로 알 수 있는 것: 서버의 단계 진행·차단 규칙이 끝까지 사람을 통과시키는가.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase, loadEdgeHandler, invoke, token } from './_edge-harness.mjs';

const GSQ = 'supabase/functions/get-step-question/index.ts';
const EJ = 'supabase/functions/echo-journey/index.ts';
let journeyResult = null;

const MIND = [
  '맑지만 걱정이야 ㅠ', '요즘 너무 지쳐', '돈 걱정이 많아', '자꾸 눈물이 나', '화가 나',
  '괜찮은 것 같기도 하고', '아무 생각이 없어', '일이 너무 많아', '사람이 힘들어', '잠이 안 와',
];
// 실사용자가 실제로 칠 법한 답변. 짧은 것, 되묻기, 정정, 모르겠어요를 섞는다.
const ANSWERS = [
  '돈때문에', '일이 너무 많아서', '모르겠어요', '어떻게 해야 좋을까?', 'ㅇㅇ',
  '그 뜻이 아니라 쉬고 싶다는 뜻이야', '사람 때문에 지쳐요', '잘 모르겠어요', '쉬고 싶어요',
  '너 내 말 기억해?', '시간이 없어서', '그냥 답답해요',
];

// 사용자가 실제로 쓴 표현만 골라 인용하는, 상식적인 수준의 가짜 모델.
function userParts(userContent) {
  const text = String(userContent || '');
  const i = text.indexOf('[사용자 근거]');
  const region = i >= 0 ? text.slice(i + '[사용자 근거]'.length) : text;
  const lines = [];
  for (const line of region.split('\n')) {
    if (line.trim().startsWith('[')) break;
    const value = line.replace(/^\s*\d+\.\s*/, '').trim();
    if (!value) { if (lines.length) break; continue; }
    lines.push(value);
  }
  return lines;
}
function fragmentsOf(lines) {
  const out = [];
  for (const line of lines) for (const m of line.match(/[가-힣]{2,}/g) || []) out.push(m);
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}

function createReasonableAi(seed = 0) {
  let n = seed;
  const stats = { calls: 0 };
  // 후보마다 다른 표현을 붙잡고, 서로 다른 의도로 묻는다. 말투는 해요체.
  // 진짜 모델은 매번 새 문장을 쓴다. 같은 6문장만 돌리면 '같은 질문 반복'으로 막히는 게 당연하므로
  // 문장 틀을 넉넉히 두고 턴마다 다른 표현을 쓰게 한다.
  const SHAPES = [
    (f, t) => `${f}라고 하셨는데, 그때 어떤 마음이었는지 조금 더 들려줄 수 있을까요?`,
    (f, t) => `${f}는 언제부터 그렇게 느껴졌는지 궁금해요.`,
    (f, t) => `${f} 중에서 가장 마음에 걸리는 건 무엇인가요?`,
    (f, t) => `${f}에 대해 어떤 점이 가장 무겁게 느껴지나요?`,
    (f, t) => `${f}가 어떤 의미인지 조금만 더 말해줄 수 있을까요?`,
    (f, t) => `${f}와 관련해서 무엇이 달라지면 좋겠나요?`,
    (f, t) => `${f} 이야기를 할 때 몸에서는 무엇이 느껴지나요?`,
    (f, t) => `${f}를 떠올리면 어떤 장면이 같이 떠오르나요?`,
    (f, t) => `${f} 말고 지금 더 급하게 느껴지는 건 무엇인가요?`,
    (f, t) => `${f}에 대해 주변 사람은 무엇을 모르고 있나요?`,
    (f, t) => `${f}가 편해지려면 무엇이 먼저 필요할까요?`,
    (f, t) => `${f}를 다른 말로 바꾼다면 어떤 말이 가까운가요?`,
    (f, t) => `${f} 때문에 요즘 무엇을 미루고 있나요?`,
    (f, t) => `${f}에 대해 스스로에게 하고 싶은 말은 무엇인가요?`,
    (f, t) => `${f}가 가장 크게 느껴졌던 순간은 언제인가요?`,
    (f, t) => `${f}와 지금의 마음은 얼마나 닮아 있나요?`,
    (f, t) => `${f} 이야기에서 아직 말하지 않은 건 무엇인가요?`,
    (f, t) => `${f}에 대해 어떤 도움이 있으면 좋겠나요?`,
  ];
  const LEADS = ['', '그 이야기에서 ', '조금만 더 여쭤볼게요. ', '혹시 ', '방금 말씀 중에 ', '괜찮으시다면 ', '이어서 여쭤볼게요. '];

  const fetch = async (url, options = {}) => {
    stats.calls += 1;
    const request = JSON.parse(options.body);
    const system = String(request.messages?.[0]?.content ?? '');
    const lines = userParts(request.messages?.[1]?.content);
    const frags = fragmentsOf(lines);
    const pick = (k) => frags[(n + k) % Math.max(frags.length, 1)] || '지금 마음';
    n += 1;

    if (request.response_format?.type === 'json_object') {
      const candidates = [0, 1, 2].map((k) => {
        const f = pick(k);
        return {
          acknowledgement: `${f}라고 말해주셨네요.`,
          question: `${LEADS[(n * 5 + k) % LEADS.length]}${SHAPES[(n * 3 + k) % SHAPES.length](f, n)}`,
          anchor: f,
          assumptions: [],
          meaning: `의도-${(n + k) % SHAPES.length}`,
          keys: [f],
          // 사용자가 물었을 때만 쓰이는 답. 물음 속 표현을 실제로 다룬다.
          reply: `제가 대신 정하지는 않을게요. 저는 ${f}에 대해 들은 만큼만 알고 있어요.`,
        };
      });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates }) }, finish_reason: 'stop' }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    // 평문 호출: 이해 확인 요약이면 요약을, 아니면 질문을 준다.
    const f = pick(0);
    const SUMMARIES = [
      (x) => `${x} 때문에 마음이 무거우신 것 같아요.`,
      (x) => `${x} 이야기를 하실 때 힘이 빠지시는 것 같아요.`,
      (x) => `${x}를 혼자 감당하고 계신 것 같아요.`,
      (x) => `${x}에 대해 아직 정리가 안 된 마음이신 것 같아요.`,
      (x) => `${x}가 계속 신경 쓰이시는 것 같아요.`,
      (x) => `${x} 앞에서 말을 고르고 계신 것 같아요.`,
    ];
    const content = /요약/.test(system)
      ? SUMMARIES[(n * 2) % SUMMARIES.length](f)
      : SHAPES[(n * 3) % SHAPES.length](f, n);
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, stats };
}

const EARLY_STATUS = new Set(['step1', 'step2', 'understanding', 'followup']);
function isBanmalLine(text) {
  return String(text || '')
    .split(/(?<=[.?!…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && /[가-힣]/.test(s))
    .some((s) => !/(요|죠|쇼|니다|니까)\s*[?.!]?$/u.test(s));
}

test('STEP 1 → 7 완주 100회: 끊김 없이 리포트 앞까지 도착한다', async () => {
  const RUNS = Number(process.env.JOURNEY_RUNS || 100);
  const report = { runs: 0, completed: 0, stuck: [], banmal: [], errors: [], turns: 0, statusSeen: {} };

  const ONLY = process.env.JOURNEY_ONLY ? Number(process.env.JOURNEY_ONLY) : null;
  for (let i = ONLY ?? 0; i < (ONLY !== null ? ONLY + 1 : RUNS); i++) {
    const db = new FakeDatabase();
    const ai = createReasonableAi(i * 5);
    const early = await loadEdgeHandler(GSQ, db, ai);
    const journey = await loadEdgeHandler(EJ, db, ai);
    const user = `j-${i}`;
    report.runs += 1;

    const started = await invoke(early, user, { action: 'start', mindText: MIND[i % MIND.length], token: token(`js${i}`) });
    if (started.body?.ok === false) { report.errors.push({ i, at: 'start', code: started.body.code }); continue; }
    const cid = started.body.conversationId;

    let status = started.body.status;
    let done = false;
    let choseOnce = false;

    for (let turn = 0; turn < 40 && !done; turn++) {
      const handler = EARLY_STATUS.has(status) ? early : journey;
      report.statusSeen[status] = (report.statusSeen[status] ?? 0) + 1;

      if (status === 'understanding') {
        const u = await invoke(handler, user, { action: 'ask', conversationId: cid, token: token(`ju${i}-${turn}`) });
        if (u.body?.ok === false) { report.stuck.push({ i, at: 'understanding', code: u.body.code }); break; }
        if (u.body.understanding) {
          if (isBanmalLine(u.body.understanding)) report.banmal.push({ i, at: 'understanding', text: u.body.understanding });
          const choice = choseOnce ? 'agree' : ['agree', 'alittle', 'no', 'explain'][i % 4];
          choseOnce = true;
          const c = await invoke(handler, user, {
            action: 'choose', conversationId: cid, choice,
            text: choice === 'agree' ? '' : '사실은 좀 쉬고 싶다는 뜻이에요',
            token: token(`jc${i}-${turn}`),
          });
          if (c.body?.ok === false) { report.errors.push({ i, at: 'choose', code: c.body.code }); break; }
          status = c.body.status;
          continue;
        }
        status = u.body.status;
        continue;
      }

      const q = await invoke(handler, user, { action: 'ask', conversationId: cid, token: token(`jq${i}-${turn}`) });
      if (q.body?.ok === false) { report.stuck.push({ i, at: status, turn, code: q.body.code }); break; }
      report.turns += 1;
      const text = String(q.body.question ?? '');
      if (text && isBanmalLine(text)) report.banmal.push({ i, at: status, text });
      if (q.body.status === 'report_ready' || q.body.status === 'report_done') { report.completed += 1; done = true; break; }
      if (q.body.understanding) { status = q.body.status; continue; }

      const answer = ANSWERS[(i + turn) % ANSWERS.length];
      const r = await invoke(handler, user, { action: 'answer', conversationId: cid, answer, token: token(`ja${i}-${turn}-${answer.length}`) });
      if (r.body?.ok === false) { report.errors.push({ i, at: `answer:${status}`, code: r.body.code }); break; }
      status = r.body.status;
      if (status === 'report_ready' || status === 'report_done') { report.completed += 1; done = true; }
    }
    if (!done && !report.stuck.some((s) => s.i === i) && !report.errors.some((e) => e.i === i)) {
      report.stuck.push({ i, at: status, code: 'NEVER_FINISHED' });
    }
  }

  console.log('[journey]', JSON.stringify({
    runs: report.runs, completed: report.completed, stuck: report.stuck.length,
    banmal: report.banmal.length, errors: report.errors.length, questions: report.turns,
  }));
  console.log('[journey] statusSeen', JSON.stringify(report.statusSeen));
  if (report.stuck.length) console.log('[journey] stuck', JSON.stringify(report.stuck.slice(0, 8)));
  if (report.errors.length) console.log('[journey] errors', JSON.stringify(report.errors.slice(0, 8)));
  if (report.banmal.length) console.log('[journey] banmal', JSON.stringify(report.banmal.slice(0, 5)));

  journeyResult = report;
  assert.equal(report.banmal.length, 0, `반말: ${JSON.stringify(report.banmal.slice(0, 4))}`);
  assert.equal(report.errors.length, 0, `오류: ${JSON.stringify(report.errors.slice(0, 4))}`);
  // 완주율 바닥선. 100회 기준 97 완주를 확인했다(2026-09-17). 여기서 크게 떨어지면 새 결함이다.
  const floor = Math.floor(report.runs * 0.95);
  assert.ok(report.completed >= floor, `완주 ${report.completed}/${report.runs} (바닥선 ${floor}) 막힘: ${JSON.stringify(report.stuck.slice(0, 6))}`);
});

// 남은 실패는 '가짜 모델이 쓸 문장을 다 써버린 것'으로 보인다. 문장 종류를 늘릴 때마다 실패가 줄었다(0→7→9.4→9.7/10).
// 다만 진짜 모델도 같은 자리에서 막히는지는 확인 못 했다. 통과로 세지 않고 todo 로 남긴다.
test('[미확정] STEP 1 → 7 완주율 100%', { todo: '남은 실패가 가짜 모델의 표현 고갈인지, 진짜 모델에서도 나는지 실계정으로 확인 필요' }, () => {
  assert.ok(journeyResult, '완주 검사가 먼저 돌아야 한다');
  assert.equal(journeyResult.completed, journeyResult.runs, `완주 ${journeyResult.completed}/${journeyResult.runs}: ${JSON.stringify(journeyResult.stuck.slice(0, 6))}`);
});
