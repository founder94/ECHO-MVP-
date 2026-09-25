// 대표 블라인드 검수표 집계(2026-09-25). 검수가 끝난 표와 열쇠 파일을 합쳐 A/B 선택 수를 센다. Claude 는 승자를 고르지 않는다 — 이 스크립트는 대표가 고른 것만 센다.
// 표 쓰는 법: 각 칸의 「선택:」 줄에서 고른 칸의 ☐ 를 ☑(또는 ✔·✅·■·[x]·v) 로 바꾸거나, 줄을 「선택: X」·「선택: Y」·「선택: 둘 다」로 고쳐 쓴다.
// 실행: node spike/ab-20260925/score-blind.mjs --sheet 검수표.md --key 열쇠.json [--out 집계.md]
import { readFileSync, writeFileSync } from 'node:fs';

const OPTIONS = [['X', 'X가 낫다'], ['Y', 'Y가 낫다'], ['BOTH_BAD', '둘 다 별로다']];
const MARK = /(☑|✔|✅|■|●|\[x\]|\[X\]|v\s)/;

export function readChoice(line) {
  const body = line.replace(/^\s*-\s*선택\s*:\s*/, '');
  const picked = OPTIONS.filter(([, label]) => { const at = body.indexOf(label); return at > 0 && MARK.test(body.slice(Math.max(0, at - 4), at)); }).map(([k]) => k);
  if (picked.length === 1) return picked[0];
  if (picked.length > 1) return 'INVALID';
  const plain = body.replace(/☐[^☐]*/g, '').trim(); // 표시가 없는 칸은 지우고 남은 글자로 읽는다
  if (/^둘\s*다/.test(plain)) return 'BOTH_BAD';
  if (/^X\b/i.test(plain)) return 'X';
  if (/^Y\b/i.test(plain)) return 'Y';
  return null;
}

export function parseSheet(md) {
  const items = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const head = line.match(/^\*\*(FLOW\d+)-(\d+)\*\*\s*\(([^)]*)\)/);
    if (head) { cur = { flow: head[1], turn: Number(head[2]), origin: head[3], choice: null }; items.push(cur); continue; }
    if (cur && /^\s*-\s*선택\s*:/.test(line)) cur.choice = readChoice(line);
  }
  return items;
}

export function score(items, key) {
  const byId = new Map(key.map((k) => [`${k.flow}-${k.turn}`, k]));
  const tally = (list) => {
    const t = { A: 0, B: 0, BOTH_BAD: 0, NONE: 0, INVALID: 0, total: list.length };
    for (const it of list) {
      const k = byId.get(`${it.flow}-${it.turn}`);
      if (!k) { t.INVALID++; continue; }
      if (it.choice === 'X') t[k.X]++; else if (it.choice === 'Y') t[k.Y]++; else if (it.choice === 'BOTH_BAD') t.BOTH_BAD++; else if (it.choice === 'INVALID') t.INVALID++; else t.NONE++;
    }
    return t;
  };
  return { all: tally(items), actual: tally(items.filter((i) => i.origin.startsWith('ACTUAL'))), synthetic: tally(items.filter((i) => !i.origin.startsWith('ACTUAL'))) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const items = parseSheet(readFileSync(arg('--sheet'), 'utf8'));
  const s = score(items, JSON.parse(readFileSync(arg('--key'), 'utf8')));
  const row = (name, t) => `| ${name} | ${t.total} | ${t.A} | ${t.B} | ${t.BOTH_BAD} | ${t.NONE} | ${t.INVALID} |`;
  const text = ['# 블라인드 검수 집계', '', '- 대표가 고른 것만 센다. 미선택·잘못 표시한 칸은 따로 센다.', '',
    '| 범위 | 칸 | A 가 낫다 | B 가 낫다 | 둘 다 별로 | 미선택 | 표시 오류 |', '|---|---|---|---|---|---|---|', row('전체', s.all), row('ACTUAL 만', s.actual), row('SYNTHETIC 만', s.synthetic)].join('\n');
  if (arg('--out')) writeFileSync(arg('--out'), text); else console.log(text);
}
