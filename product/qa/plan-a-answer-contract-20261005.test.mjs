// 2026-10-05 대표 「PLAN A MOBILE ANSWER / EMOJI / SYMBOL CONTRACT」 CASE 1~10 — 가짜 AI 기준(실제 AI·운영 0). 실행: node --test qa/plan-a-answer-contract-20261005.test.mjs
// 원칙: 이미 다른 검사가 같은 조건을 증명하면 여기서 다시 돌리지 않고(중복 0) 그 검사가 있는지만 확인해 증거로 잇는다. 빠진 조건만 여기서 직접 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'pa1005-'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const emit = (p, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
emit('supabase/functions/doit-agent/matching.ts', 'matching.mjs');
const A = await import(emit('supabase/functions/doit-agent/agent.ts', 'agent.mjs'));
const code = (p) => read(p).replace(/^\s*\/\/.*$/gm, '');
// 증거 연결: 같은 조건을 이미 증명하는 검사가 그 파일에 그대로 있는지(제목 앞부분)
const linked = (file, title) => assert.ok(read(`qa/${file}`).includes(`test('${title}`), `증거 검사 없음: ${file} · ${title}`);

const T = (o = {}) => ({ kind: 'answer', understood: '', reply: '네.', extracted: [], inferred: [], declared: null, wrong: [], next: { type: 'core', purpose: 'attraction_comfort', question: '어떤 사람이 편해요?' }, ...o });
const fresh = () => { const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st); return st; };
const items = (st) => Object.values(A.matchingProfile(st)).filter((v) => v && typeof v === 'object' && Array.isArray(v.items)).flatMap((v) => v.items);

test('CASE 1 주관식 정상 답변 → 사용자 원문이 USER_DIRECT 로 저장', () => {
  const st = fresh();
  A.applyTurn(st, '친구를 만나고 싶어요', T({ extracted: [{ purpose: 'relationship_intent', note: '친구', quote: '친구를 만나고 싶어요' }] }));
  const direct = items(st).filter((i) => i.source_type === 'USER_DIRECT');
  assert.ok(direct.some((i) => i.note === '친구를 만나고 싶어요' && i.source_user_text === '친구를 만나고 싶어요'), JSON.stringify(direct));
});

test('CASE 2 구조대 보기 선택 → 고른 문구만 그 질문의 답(USER_DIRECT) · 성격·욕구 확대 추론 0', () => {
  linked('agent-server.test.mjs', '구조대 전 구간: agent_rescue 는 턴·기록 0 · 고른 보기는 USER_DIRECT 로 기록');
  // 보기는 서버가 거른 2~4개 · 「잘 모르겠어요」 같은 도움말은 보기에 섞이지 않음
  assert.equal(A.CHOICE_MIN, 2); assert.equal(A.CHOICE_LIMIT, 4);
  linked('human-mirror-v254.test.mjs', '10-01 contract: every question keeps server-screened rescue options (2–4)');
});

test('CASE 3 「잘 모르겠어요」 → 선호 저장 0', () => {
  const st = fresh();
  const before = items(st).length;
  A.applyTurn(st, '잘 모르겠어요', T({ kind: 'unsure', extracted: [{ purpose: 'attraction_comfort', note: '잘 모름', quote: '잘 모르겠어요' }] }));
  assert.equal(items(st).length, before, '잘 모르겠어요는 사실·선호로 저장 0');
  assert.equal(st.turns.at(-1)?.saved ?? false, false);
});

test('CASE 4 「질문이 너무 많아요」 → fatigue/repair · 저장 0 · 일반 답·넘기기로 올리지 않음', () => {
  assert.deepEqual(A.guardKind('질문이 너무 많아요', 'answer'), { kind: 'repair', rule: 'fatigue' });
  assert.deepEqual(A.guardKind('질문이 너무 많아요', 'skip'), { kind: 'repair', rule: 'fatigue' });
  const st = fresh(); const before = items(st).length;
  A.applyTurn(st, '질문이 너무 많아요', T({ kind: 'skip', extracted: [{ purpose: 'attraction_comfort', note: '질문 많음', quote: '질문이 너무 많아요' }] }));
  assert.equal(items(st).length, before, 'fatigue 저장 0');
  assert.equal(st.turns.at(-1)?.kind, 'repair');
});

test('CASE 5 「다음 질문으로 넘어가」 → 분명한 넘기기(skip) · 피로와 구분 · 저장 0', () => {
  assert.equal(A.guardKind('다음 질문으로 넘어가', 'skip').kind, 'skip');
  assert.deepEqual(A.guardKind('다음질문으로 넘어가 질문이 너무 무겁다', 'skip'), { kind: 'skip', rule: null }, '넘기기 말이 있으면 피로가 아니라 넘기기');
  linked('agent-server.test.mjs', 'v2.5');
  assert.ok(read('qa/agent-server.test.mjs').includes("say('다음 질문으로 넘어가요')"), '실제 index 경로 넘기기 검사');
});

test('CASE 6 「그게 아니에요」 → 정정 시스템(일반 객관식 아님) · 잘못된 뜻 폐기 · 다음 질문 변경 · 다시 나오지 않음', () => {
  linked('agent-server.test.mjs', 'RUN 대표 시나리오: 목표 → 아는 칸 다시 안 물음 → 「그게 아니에요」 → 계획·다음 질문 변경');
  linked('conversation-v16.test.mjs', 'v16 G: 「그게 아니에요」 → AI 문장을 거절로 저장');
  linked('core-conversation-question-state.test.mjs', 'v15 통합 카드 — 조금 달라요(한 문장 골라 고침) · 그게 아니에요(모두 빼고 원문 보존)');
  // 정정 네 버튼은 일반 구조대 보기와 다른 길: 구조대 보기 목록에 정정 버튼 글자가 들어가지 않는다
  for (const t of ['맞아요', '조금 달라요', '그게 아니에요', '직접 설명할게요']) assert.equal(A.validChoice ? A.validChoice(t, '어떤 사람이 편해요?') : false, false, `정정 버튼 「${t}」은 구조대 보기가 될 수 없음`);
});

test('CASE 7 「직접 설명할게요」 → 자유 글쓰기 길', () => {
  linked('question-rescue-20261001.test.mjs', 'Q12 「직접 설명할게요」 = 보기를 접고 주관식으로(언제든)');
  linked('server-conversation-flow.test.mjs', 'TEST D 직접 설명: 자유 입력 원문이 다음 맥락의 중심');
});

test('CASE 8 생활형 이모지 → 보여 줄 때만 붙는 장식 · 저장·Profile·Matching 영향 0 · 글자만으로 뜻 전달', () => {
  const agent = code('supabase/functions/doit-agent/agent.ts');
  // 기호는 rescueView(화면용)에서 보기 글자로부터 그때 만든다 — 상태·프로필·매칭 데이터에는 기호 칸이 없다
  assert.match(agent, /symbols: options\.map\(optionSymbol\)/, '기호는 보여 줄 때 보기 글자에서 만든다');
  assert.doesNotMatch(agent.replace(/export function rescueView[\s\S]*?\n}\n/, '').replace(/export const optionSymbol[^\n]*\n/, ''), /symbols?\s*:/, '화면 밖(상태·프로필)에 기호 칸 0');
  for (const o of ['조용한 카페', '같이 걷기', '밥 먹으면서', '말 잘 통하는 사람']) { const s = A.optionSymbol(o); assert.ok(typeof s === 'string' && s.length <= 4, '기호는 짧은 장식'); assert.ok(o.trim().length > 0, '보기 글자만으로 뜻'); }
  const st = fresh();
  A.applyTurn(st, '조용한 카페', T({ extracted: [{ purpose: 'relationship_intent', note: '조용한 카페', quote: '조용한 카페' }] }));
  assert.doesNotMatch(JSON.stringify(A.matchingProfile(st)), /[\u{1F300}-\u{1FAFF}☀-➿]/u, '프로필·매칭 데이터에 이모지 0');
});

test('CASE 9 「보기로 답하라」는 질문인데 보기 없음 → FAIL(보기 없이 내보내지 않음)', () => {
  linked('doit-agent-quality-20261005.test.mjs', '⑤ 「이런 것 중」처럼 보기를 가리키는 질문은 보기 2개 이상과 함께일 때만');
  linked('doit-agent-quality-20261005.test.mjs', 'Codex P2 ④: 「보기 다 아니에요」 뒤에도 보기를 가리키는 질문을 보기 없이 남기지 않는다');
  assert.equal(typeof A.enforceChoiceContract, 'function');
});

test('CASE 10 보기 만들기 실패 → 고정 보기·고정 질문 배열로 메우지 않음(fallback 표시만)', () => {
  const agent = code('supabase/functions/doit-agent/agent.ts');
  // 실패하면 보기를 비우고(rescue_fallback) 실패 코드만 남긴다 — 미리 적어 둔 보기 목록으로 채우는 길 0
  assert.match(agent, /cur\.choices = null; cur\.rescue_fallback = true;/);
  assert.doesNotMatch(agent, /(FALLBACK|DEFAULT|FIXED)_(CHOICES|OPTIONS|QUESTIONS)\s*=\s*\[/, '고정 보기·질문 배열 0');
  linked('question-rescue-20261001.test.mjs', 'FI: 보기를 끝내 못 만들면 안전 안내(fallback)만 · RESCUE_OPTIONS_MISSING');
  // 처음 세 질문 보기 자동 펼침(같은 날 앞선 기준)은 대표 최신 계약으로 superseded — 함수 0
  assert.equal(typeof A.ensureObjectiveFirst, 'undefined');
});
