// MODEL GATE 블라인드 집계(2026-09-25). 대표가 페이지에서 고른 것(model-picks/Mnn.json = 페이지 db 그대로)과 봉한 열쇠만 읽는다.
// - 대표 선택을 고치거나 해석하지 않는다. 「모두 별로」도 그대로 센다.
// - 실제 입력 칸만 따로 센다(예문 = FLOW4, p0-blind 와 같은 기준).
// 실행: node spike/ab-20260925/model-blind-score.mjs --picks <model-picks 폴더> --key <열쇠.json> [--json 출력.json]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GOLDEN } from './harness-lib.mjs';
import { P0_RULES } from './p0-blind.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MARK = ['①', '②', '③', '④', '⑤', '⑥'];
export const NONE = '모두 별로';

export function score(key, picks) {
  const models = [...new Set(key.flatMap((k) => k.order))].sort();
  const rows = key.map((k) => {
    const choice = picks[k.id]?.choice;
    if (choice == null) throw new Error(`선택 없음: ${k.id}`);
    const i = MARK.indexOf(choice);
    if (i < 0 && choice !== NONE) throw new Error(`알 수 없는 선택: ${k.id} ${choice}`);
    const g = GOLDEN.find((x) => x.id === k.flow);
    const example = !String(g.steps[k.turn - 1][2]).startsWith('ACTUAL');
    const why = P0_RULES.find(([f, t]) => f === k.flow && t === k.turn)?.[2] ?? '';
    return { id: k.id, flow: k.flow, turn: k.turn, why, example, choice, winner: i < 0 ? NONE : k.order[i] };
  });
  const count = (list) => Object.fromEntries([...models, NONE].map((m) => [m, list.filter((r) => r.winner === m).length]));
  return { models, rows, all: count(rows), actual: count(rows.filter((r) => !r.example)), n: rows.length, n_actual: rows.filter((r) => !r.example).length };
}

export function load(picksDir, keyFile) {
  const key = JSON.parse(Buffer.from(JSON.parse(readFileSync(keyFile, 'utf8')).sealed, 'base64').toString('utf8'));
  const picks = Object.fromEntries(key.map((k) => [k.id, JSON.parse(readFileSync(path.join(picksDir, `${k.id}.json`), 'utf8'))]));
  return score(key, picks);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = load(arg('--picks'), arg('--key'));
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(r, null, 1));
  for (const x of r.rows) console.log(`${x.id} ${x.flow}#${x.turn}${x.example ? ' (예문)' : ''} ${x.choice} → ${x.winner} · ${x.why}`);
  console.log('전체', r.n, JSON.stringify(r.all));
  console.log('실제 입력', r.n_actual, JSON.stringify(r.actual));
}
