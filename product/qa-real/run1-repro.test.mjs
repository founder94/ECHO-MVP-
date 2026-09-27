// 출시 차단(2026-09-27 대표 「CROSS-SLOT CORRECTION + REAL REJECTION VALIDATION」) — 정정한 옛 뜻이 다른 칸에 숨어 남지 않는가 · 다른 사실은 보존되는가.
// 근거는 서버가 가진 출처(같은 사용자 말 turn · 같은 원문 quote)만 — 뜻 유사도로 사용자 사실을 지우지 않는다.
// 가짜 AI 출력(LLM 후보)만 넣는다(실제 AI 품질 판정 아님 · Mock). 실행: node --test qa/cross-slot-correction.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'xslot-'));
const emit = (src, out, fix = (x) => x) => { const f = path.join(dir, out); writeFileSync(f, fix(ts.transpileModule(readFileSync(new URL(src, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText)); return pathToFileURL(f).href; };
const A = await import(emit('../supabase/functions/doit-agent/agent.ts', 'agent.mjs'));
emit('../supabase/functions/doit-agent/matching.ts', 'matching.mjs');
const M = await import(emit('../supabase/functions/doit-connect/agentSource.ts', 'agentSource.mjs', (x) => x.replace('"../doit-agent/matching.ts"', '"./matching.mjs"')));

const X = (purpose, note, quote) => ({ purpose, note, quote });
const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '그렇군요.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'none', purpose: '', question: '' }, ...o });
const live = (st) => A.PURPOSES.flatMap((p) => st.slots[p.id].items.filter((i) => i.status === 'CONFIRMED').map((i) => i.note));
const status = (st, id, note) => st.slots[id].items.find((i) => i.note === note)?.status;
const introText = (st) => (st.intro?.lines ?? []).map((l) => l.text).join(' ');
const src = (st) => M.sourceFromProfile(A.matchingProfile(st), 'done', null);
const UI_STYLE = { correction: true, purpose: 'relationship_style' };
const OLD = '연락은 매일 하는 게 좋아요';
const NEW = '매일은 부담스럽고 주말에 한두 번 연락하는 게 좋아요';
const fixLlm = (intro = null) => async (kind) => JSON.stringify(kind === 'turn' ? T({ kind: 'correction', extracted: [X('relationship_style', '주말에 한두 번 연락이 좋음', NEW)] }) : kind === 'intro' ? (intro ?? {}) : {});
const at = (st, purpose) => { st.current = { type: 'core', purpose, text: `${purpose} 질문` }; };
const CAFE = '조용한 카페에서 오래 이야기하는 걸 좋아해요';
// QA 1차(base) 실제 상태 재현: 턴3 에서 AI 가 아무것도 뽑지 않음 → 지금 질문 칸(values_character)에 원문(USER_DIRECT)만 저장.
function run1() {
  const st = A.newState({ tone: 'polite' }); A.seedFirstQuestion(st);
  A.applyTurn(st, '친구처럼 편하게 대화하는 사이를 원해요', T({ extracted: [X('relationship_intent', '친구처럼 편하게 대화하는 사이를 원함', '친구처럼 편하게 대화하는 사이를 원해요')] }));
  at(st, 'attraction_comfort'); A.applyTurn(st, CAFE, T({ extracted: [] }));
  at(st, 'values_character'); A.applyTurn(st, OLD, T({ extracted: [] }));
  assert.equal(st.slots.values_character.items[0]?.source_type, 'USER_DIRECT');
  assert.equal(st.slots.relationship_style.items.length, 0, '전제: relationship_style 에 A 출처 값 없음');
  st.phase = 'done'; st.current = null; return st;
}
const llm = (wrong) => async (kind) => JSON.stringify(kind === 'turn' ? T({ kind: 'correction', extracted: [X('relationship_style', NEW, NEW)], wrong }) : kind === 'intro' ? { intro: null } : { reply: '네.' });
test('REPRO-1 현재 코드 · AI wrong 비움(1차 실제) → A 가 values_character 에 CONFIRMED 로 남음(제품 결함 재현)', async () => {
  const st = run1(); await A.runTurn(st, NEW, llm([]), { ui: UI_STYLE });
  assert.equal(status(st, 'values_character', OLD), 'CONFIRMED');
  assert.ok(src(st).confirmed.includes(OLD), 'Matching source 에도 A 사용');
});
test('REPRO-2 현재 코드 · AI 가 wrong 에 A note 를 그대로 적으면 → A 제외 · B 사용 · 카페 보존', async () => {
  const st = run1(); await A.runTurn(st, NEW, llm([OLD]), { ui: UI_STYLE });
  assert.notEqual(status(st, 'values_character', OLD), 'CONFIRMED');
  assert.equal(status(st, 'attraction_comfort', CAFE), 'CONFIRMED');
  const s = src(st).confirmed; assert.ok(!s.includes(OLD) && s.includes(NEW) && s.includes(CAFE), JSON.stringify(s));
});
test('REPRO-3 현재 코드 · AI 가 없는 note 를 wrong 에 적어도 → 아무것도 안 지움', async () => {
  const st = run1(); await A.runTurn(st, NEW, llm(['연락은 자주']), { ui: UI_STYLE });
  assert.equal(status(st, 'attraction_comfort', CAFE), 'CONFIRMED'); assert.equal(status(st, 'values_character', OLD), 'CONFIRMED');
});
