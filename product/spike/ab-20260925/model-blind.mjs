// MODEL GATE 블라인드 검수 자료(2026-09-25). run-models.mjs 의 slim JSON(Actions 로그에서 옮김)으로 P0 17칸을 모델 수만큼 나란히 만든다.
// - 칸은 run1 P0 세트와 같다(p0-blind.mjs 의 P0_RULES). 출력 문장은 slim JSON 그대로(고치지 않음).
// - 칸마다 모델 순서를 무작위로 섞어 ①②③④ 로만 보인다. 열쇠는 base64 로 봉해 따로 둔다. Claude 는 승자를 고르지 않는다.
// 실행: node spike/ab-20260925/model-blind.mjs --slim models-slim.json --data 페이지용.json --key 열쇠.json --md 검수표.md
import { readFileSync, writeFileSync } from 'node:fs';
import { GOLDEN } from './harness-lib.mjs';
import { P0_RULES } from './p0-blind.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MARK = ['①', '②', '③', '④', '⑤', '⑥'];

// 한 모델의 한 흐름 → 칸별 {before, reply, question, kept, note}
export function sideRows(rows) {
  let shown = '어떤 만남을 원하세요?'; let ended = false;
  return rows.map(([kind, saved, reply, question, kept, finished, dropped, error]) => {
    const note = []; const before = shown;
    if (finished) { note.push(ended ? '대화가 이미 끝남' : '대화 끝 — 다섯 답이 모임'); ended = true; }
    if (error) note.push('말을 읽지 못함');
    if (question) shown = question;
    return { before, reply, question, kept, note };
  });
}

export function build(slim, rand = Math.random) {
  const models = Object.keys(slim);
  const items = P0_RULES.map(([f, t, why], n) => {
    const k = GOLDEN.findIndex((g) => g.id === f); const flow = GOLDEN[k];
    const order = [...models].sort(() => rand() - 0.5);
    return { id: `M${String(n + 1).padStart(2, '0')}`, why, example: !String(flow.steps[t - 1][2]).startsWith('ACTUAL'), purpose: flow.purpose, prevUser: t > 1 ? flow.steps[t - 2][0] : null, text: flow.steps[t - 1][0],
      answers: order.map((m, j) => ({ label: MARK[j], ...sideRows(slim[m][k])[t - 1] })), _key: { flow: f, turn: t, order } };
  });
  return { models, items };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { models, items } = build(JSON.parse(readFileSync(arg('--slim'), 'utf8')));
  writeFileSync(arg('--data'), JSON.stringify({ items: items.map(({ _key, ...x }) => x) }));
  writeFileSync(arg('--key'), JSON.stringify({ note: 'MODEL GATE 블라인드 열쇠(base64). 대표 검수 전에는 풀지 않는다.', sealed: Buffer.from(JSON.stringify(items.map((i) => ({ id: i.id, ...i._key })))).toString('base64') }, null, 1));
  const line = (a) => [a.reply && `반응: ${a.reply}`, a.question && `질문: ${a.question}`, a.kept && `같은 질문을 다시 띄움: ${a.kept}`, ...a.note.map((x) => `(${x})`)].filter(Boolean).join(' / ') || '(아무 말도 하지 않음)';
  const L = ['# MODEL GATE 블라인드 검수 — 같은 B, 다른 모델', '', `- 칸마다 답 ${models.length}개. 어느 모델인지는 가렸고 순서도 섞었다. 가장 나은 답 하나를 고르거나 「모두 별로」.`, ''];
  for (const it of items) { L.push(`## ${it.id}${it.example ? ' (예문)' : ''}`, '', `- 목적 「${it.purpose}」${it.prevUser ? ` · 바로 앞 말 「${it.prevUser}」` : ' · 첫 답'}`, `- 사용자: ${it.text}`, ...it.answers.map((a) => `- ${a.label} ${line(a)}`), `- 판정: [ ${it.answers.map((a) => a.label).join(' / ')} / 모두 별로 ]`, ''); }
  if (arg('--md')) writeFileSync(arg('--md'), L.join('\n'));
  console.log(`items=${items.length} models=${models.join(',')}`);
}

// Actions 로그에서 옮긴 models-result.md(표) → slim 구조. 출력 칸 모양: 「💬 반응 / ❓ 질문 / (같은 질문 유지) … / (질문 버림:…) / (대화 끝) / ⚠️ …」
export function parseModelsMd(md) {
  const models = (md.match(/모델\(요청 이름\): ([^—]+)—/)?.[1] ?? '').split('·').map((x) => x.trim()).filter(Boolean);
  const slim = Object.fromEntries(models.map((m) => [m, []]));
  let cur = -1;
  for (const line of md.split('\n')) {
    if (/^## FLOW\d+/.test(line)) { cur += 1; for (const m of models) slim[m].push([]); continue; }
    if (cur < 0 || !/^\| \d+ \|/.test(line)) continue;
    const c = line.split(' | '); c[0] = c[0].replace(/^\| /, ''); c[c.length - 1] = c[c.length - 1].replace(/ \|$/, '');
    models.forEach((m, j) => {
      const ks = c[2 + j * 2], out = c[3 + j * 2] ?? '';
      const parts = out ? out.split(' / ') : [];
      const get = (p) => (parts.find((x) => x.startsWith(p)) ?? '').slice(p.length).trim().replace(/ ⏎ /g, '\n');
      slim[m][cur].push([ks.split('·')[0], ks.endsWith('·저장') ? 1 : 0, get('💬 '), get('❓ '), get('(같은 질문 유지) '), parts.includes('(대화 끝)') ? 1 : 0, (parts.find((x) => x.startsWith('(질문 버림:')) ?? '').replace(/^\(질문 버림:|\)$/g, ''), get('⚠️ ')]);
    });
  }
  return slim;
}
