// 실AI 실행 결과(result.md, Actions 로그에서 옮긴 것)로 대표 블라인드 검수표를 다시 만든다(2026-09-25, run1).
// 왜: Actions 요약 페이지의 검수표는 하네스 결함(GF-63)으로 A 의 「질문을 못 만듦」 표시가 빠졌고, 열쇠는 첨부물(7일)에만 있어 이 환경에서 받지 못한다.
// - 출력 문장은 result.md 그대로 쓴다(고치지 않는다). 더하는 표시는 v27·B-1.0 코드 경로로 확정한 상태뿐이다:
//   ① A 가 질문을 못 만든 턴(재시도가 있고 질문·되묻기 유지가 없음, 종류가 answer·unsure·complaint) = 「다음 질문을 만들지 못함」
//      (v27 index.ts 2086·2106 줄: 이 경우 questionError 를 돌려준다)
//   ② 다섯 번째 답이 저장된 턴 = 「대화 끝(다섯 답)」, 그 뒤 턴 = 「대화가 이미 끝남」(A: willFinish/finishedAlready · B: B_VALID_ANSWERS)
// - X·Y 배정은 입력마다 무작위. 열쇠는 base64 로 봉해 따로 둔다(대표가 무심코 열어 보지 않게 — 보안 장치가 아니다).
// 실행: node spike/ab-20260925/blind-from-result.mjs --result <result.md> --sheet <검수표.md> --key <열쇠.sealed.json>
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

export function parseResult(md) {
  const flows = []; let cur = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^## (FLOW\d+) — (.*)$/);
    if (h) { cur = { id: h[1], note: h[2], purpose: '', rows: [] }; flows.push(cur); continue; }
    if (cur && line.startsWith('목적: ')) { cur.purpose = line.slice(4); continue; }
    if (!cur || !/^\| \d+ \|/.test(line)) continue;
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    const kindA = c[4].match(/^([^(·]+)/)?.[1] ?? '-';
    cur.rows.push({ i: Number(c[0]), origin: c[1], text: c[2], expect: c[3],
      A: { kind: kindA, saved: c[4].endsWith('·저장'), out: c[5], retry: c[7] },
      B: { kind: c[9].split('·')[0], saved: c[9].endsWith('·저장'), out: c[10], retry: c[13] } });
  }
  return flows;
}

const seg = (out) => {
  const parts = out ? out.split(' / ') : [];
  const get = (p) => parts.filter((x) => x.startsWith(p)).map((x) => x.slice(p.length).trim());
  return { reply: get('💬 ')[0] ?? '', question: get('❓ ')[0] ?? '', kept: get('(같은 질문 유지) ')[0] ?? '' };
};

export function outputs(flow) {
  let aSaved = 0, bSaved = 0, aDone = false, bDone = false;
  return flow.rows.map((r) => {
    const a = seg(r.A.out), b = seg(r.B.out);
    const aNote = [], bNote = [];
    if (aDone) aNote.push('(대화가 이미 끝남)');
    else {
      if (r.A.saved) aSaved += 1;
      if (r.A.saved && aSaved >= 5) { aDone = true; aNote.push('(대화 끝 — 다섯 답이 모임)'); }
      else if (r.A.retry && !a.question && !a.kept && ['answer', 'unsure', 'complaint'].includes(r.A.kind)) aNote.push('(다음 질문을 만들지 못함)');
    }
    if (bDone) bNote.push('(대화가 이미 끝남)');
    else if (r.B.saved && (r.B.kind === 'answer' || r.B.kind === 'correction')) { bSaved += 1; if (bSaved >= 5) { bDone = true; bNote.push('(대화 끝 — 다섯 답이 모임)'); } }
    const fmt = (s, note) => [s.reply, s.question, s.kept ? `(같은 질문 다시: ${s.kept})` : '', ...note].filter(Boolean).join(' / ') || '(출력 없음)';
    return { i: r.i, origin: r.origin, text: r.text, A: fmt(a, aNote), B: fmt(b, bNote) };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flows = parseResult(readFileSync(arg('--result'), 'utf8'));
  const L = ['# 대표 블라인드 검수표 — 실제 AI A/B run1 (2026-09-25)', '',
    '- 실제 OpenAI(gpt-4o-mini) 로 같은 입력을 두 방식에 넣은 결과다. X·Y 가 어느 방식인지는 칸마다 무작위이고, 검수가 끝난 뒤에만 연다.',
    '- 칸마다 하나만 고른다: **X가 낫다 / Y가 낫다 / 둘 다 별로다**. 고르기 어려우면 비워 둔다(미선택으로 센다).',
    '- 보는 기준: 방금 말에 먼저 반응했나 · 이미 말한 걸 다시 묻지 않았나 · 따지면 인정하고 방향을 바꿨나 · 사람처럼 들리나. 질문이 없어도 괜찮다.',
    '- 괄호 안 표시는 화면에 나온 상태다(예: 「다음 질문을 만들지 못함」 = 앱에 실패 안내가 뜸).', ''];
  const key = [];
  for (const f of flows) {
    L.push(`## ${f.id} (목적: ${f.purpose})`, '');
    for (const o of outputs(f)) {
      const flip = globalThis.crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 1;
      key.push({ flow: f.id, turn: o.i, X: flip ? 'B' : 'A', Y: flip ? 'A' : 'B' });
      L.push(`**${f.id}-${o.i}** (${o.origin})`, '', `- USER: ${o.text}`, `- OUTPUT X: ${flip ? o.B : o.A}`, `- OUTPUT Y: ${flip ? o.A : o.B}`, '- 선택: ☐ X가 낫다  ☐ Y가 낫다  ☐ 둘 다 별로다', '- 메모:', '');
    }
  }
  writeFileSync(arg('--sheet'), L.join('\n'));
  writeFileSync(arg('--key'), JSON.stringify({ note: '블라인드 열쇠(base64). 대표 검수 전에는 풀지 않는다. 집계: score-blind.mjs --key 에 풀어서 넣는다.', sealed: Buffer.from(JSON.stringify(key)).toString('base64') }, null, 1));
  console.log(`items=${key.length}`);
}
