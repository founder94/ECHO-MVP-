// run1 P0 블라인드 검수 세트(2026-09-25, 대표 「블라인드 검수 간소화」). 34칸 중 P0 핵심 항목만 골라 휴대폰용 검수표를 만든다.
// - 출력 문장은 result.md 그대로(고치지 않음). 괄호 표시는 blind-from-result.mjs 와 같은 규칙(화면에 나온 상태).
// - 고르는 기준(P0_RULES): 대표가 지정한 P0 실패 — 같은 질문 반복 · 「활동」 점프 · 대표 실제 항의 문장 · 「취미생활?」 · AI 에게 직접 질문 · 정정 · 거절.
//   두 답이 똑같은 칸(대화가 이미 끝나 AI 에 가지 않은 칸)은 고를 것이 없어 검수에서 빼고 따로 적는다.
// - X·Y 배정은 항목마다 무작위, 열쇠는 base64 로 봉해 따로 둔다(34칸 검수표 열쇠와 별개).
// 실행: node spike/ab-20260925/p0-blind.mjs --result <result.md> --md <P0.md> --key <열쇠.json> --data <페이지용.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { parseResult } from './blind-from-result.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// [flow, turn, 이유] — 이유는 대표 P0 목록의 이름 그대로.
export const P0_RULES = [
  ['FLOW1', 2, '대표 실제 항의 「나 진심이라고 적은거 같은데」 · 같은 질문 반복'],
  ['FLOW1', 5, '대표 실제 항의 「적었자네」'],
  ['FLOW2', 1, '「활동」 점프'],
  ['FLOW2', 2, '「활동」 점프 뒤 되물음 · 같은 질문 반복'],
  ['FLOW3', 2, '「취미생활?」'],
  ['FLOW3', 3, '거절 · 질문 방향 제안'],
  ['FLOW3', 4, '정상 답(취미 셋) 뒤 반응'],
  ['FLOW4', 2, '거절 「왜 또 물어봐?」'],
  ['FLOW4', 4, '정정 「활동 말고 …」'],
  ['FLOW4', 5, '거절 「그 질문 말고」'],
  ['FLOW5', 5, '「활동」 점프 뒤 항의'],
  ['FLOW6', 1, 'AI 에게 직접 질문'],
  ['FLOW6', 2, 'AI 에게 직접 질문'],
  ['FLOW6', 3, 'AI 에게 직접 질문 · 항의'],
  ['FLOW7', 1, '「활동」 점프'],
  ['FLOW7', 2, '같은 질문 반복'],
  ['FLOW7', 3, '거절 · 반영 요구'],
];
export const P0_NO_DIFF = [['FLOW1', 6], ['FLOW1', 7]]; // 「몇번째 같은말이야!!」·「행동이라고!!」 — 두 답 모두 대화 끝(AI 호출 0)

const seg = (out) => {
  const parts = out ? out.split(' / ') : [];
  const get = (p) => parts.filter((x) => x.startsWith(p)).map((x) => x.slice(p.length).trim().replace(/ ⏎ /g, '\n'))[0] ?? '';
  return { reply: get('💬 '), question: get('❓ '), kept: get('(같은 질문 유지) ') };
};

// 한 흐름을 칸별 구조로: 반응·질문·같은 질문 다시·상태 표시 + 그 쪽이 바로 앞에 띄워 둔 질문.
export function structured(flow) {
  const side = (k) => { let saved = 0, done = false, shown = '어떤 만남을 원하세요?';
    return flow.rows.map((r) => {
      const s = seg(r[k].out); const note = []; const before = shown;
      // 앱은 질문의 첫 줄(받아 주는 말)을 질문 위에 따로 보여 준다 — 화면 그대로 반응 줄로 옮긴다(두 쪽 같은 규칙).
      if (s.question.includes('\n')) { const i = s.question.indexOf('\n'); const ack = s.question.slice(0, i).trim(); s.question = s.question.slice(i + 1).trim(); s.reply = [s.reply, ack].filter(Boolean).join(' '); }
      if (done) note.push('대화가 이미 끝남');
      else {
        if (k === 'A' ? r.A.saved : r.B.saved && (r.B.kind === 'answer' || r.B.kind === 'correction')) saved += 1;
        if ((k === 'A' ? r.A.saved : r.B.saved && (r.B.kind === 'answer' || r.B.kind === 'correction')) && saved >= 5) { done = true; note.push('대화 끝 — 다섯 답이 모임'); }
        else if (k === 'A' && r.A.retry && !s.question && !s.kept && ['answer', 'unsure', 'complaint'].includes(r.A.kind)) note.push('다음 질문을 만들지 못함');
      }
      if (s.question) shown = s.question;
      return { before, reply: s.reply, question: s.question, kept: s.kept, note };
    }); };
  const A = side('A'), B = side('B');
  return flow.rows.map((r, n) => ({ flow: flow.id, turn: r.i, origin: r.origin, purpose: flow.purpose, text: r.text, prevUser: n ? flow.rows[n - 1].text : null, A: A[n], B: B[n] }));
}

export function buildP0(md, rand = () => globalThis.crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 1) {
  const all = parseResult(md).flatMap(structured);
  const find = (f, t) => all.find((x) => x.flow === f && x.turn === t);
  const items = P0_RULES.map(([f, t, why], n) => {
    const it = find(f, t); if (!it) throw new Error(`없는 칸 ${f}-${t}`);
    const flip = rand();
    return { id: `P${String(n + 1).padStart(2, '0')}`, why, example: !it.origin.startsWith('ACTUAL'), purpose: it.purpose, prevUser: it.prevUser, text: it.text,
      X: flip ? it.B : it.A, Y: flip ? it.A : it.B, _key: { flow: f, turn: t, X: flip ? 'B' : 'A', Y: flip ? 'A' : 'B' } };
  });
  const noDiff = P0_NO_DIFF.map(([f, t]) => find(f, t));
  return { items, noDiff };
}

const answerMd = (a) => [a.before ? `  - _바로 앞에 띄운 질문:_ ${a.before}` : '', a.reply ? `  - 반응: ${a.reply.replace(/\n/g, ' / ')}` : '', a.question ? `  - 질문: ${a.question.replace(/\n/g, ' / ')}` : '', a.kept ? `  - 같은 질문을 다시 띄움: ${a.kept}` : '', ...a.note.map((x) => `  - (${x})`), !a.reply && !a.question && !a.kept && !a.note.length ? '  - (아무 말도 하지 않음)' : ''].filter(Boolean);

if (import.meta.url === `file://${process.argv[1]}`) {
  const { items, noDiff } = buildP0(readFileSync(arg('--result'), 'utf8'));
  const L = ['# P0 블라인드 검수 — 실제 AI 1회차 (2026-09-25)', '',
    `- 같은 사용자 말에 두 AI 가 답했다. 어느 쪽이 어느 방식인지는 숨겼다(항목마다 무작위).`,
    `- 항목마다 하나만 고른다: **X가 낫다 / Y가 낫다 / 둘 다 별로**. 헷갈리면 비워 둔다.`,
    `- 보는 기준: 방금 한 말에 먼저 반응했나 · 이미 한 말을 다시 묻지 않았나 · 따지면 인정하고 방향을 바꿨나 · 사람처럼 들리나. 질문이 없어도 괜찮다.`,
    `- 검수하지 않는 칸: ${noDiff.map((x) => `「${x.text}」`).join('·')} — 두 답 모두 대화가 이미 끝나 AI 가 답하지 않았다(두 쪽이 같음).`, ''];
  for (const it of items) {
    L.push(`## ${it.id}${it.example ? ' (예문)' : ''}`, '', `- 상황: 만남 목적 「${it.purpose}」${it.prevUser ? ` · 바로 앞 사용자 말 「${it.prevUser}」` : ' · 첫 답'}`, '', `**사용자:** ${it.text}`, '', '**답변 X:**', ...answerMd(it.X), '', '**답변 Y:**', ...answerMd(it.Y), '', '**판정:** [ X / Y / 둘 다 별로 ]', '');
  }
  writeFileSync(arg('--md'), L.join('\n'));
  writeFileSync(arg('--key'), JSON.stringify({ note: 'P0 블라인드 열쇠(base64). 대표 검수 전에는 풀지 않는다.', sealed: Buffer.from(JSON.stringify(items.map((i) => ({ id: i.id, ...i._key })))).toString('base64') }, null, 1));
  if (arg('--data')) writeFileSync(arg('--data'), JSON.stringify({ items: items.map(({ _key, ...x }) => x), noDiff: noDiff.map((x) => x.text) }));
  console.log(`items=${items.length}`);
}
