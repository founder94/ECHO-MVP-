// 사주 계산 엔진 검사(2026-09-26 대표 「SAJU / TAROT FINAL LOCK」 §27·§33). 계산은 engine.ts, 해설은 explain.ts 규칙 — AI 0.
// 기준값(fixture)은 널리 공개된 값만: 2000-01-01 일주 戊午 · 1900-01-01 일주 甲戌(같은 60갑자 순환) · 입춘 시각(한국천문연구원 발표 값, 분 단위).
// 이 엔진의 절기 계산 오차는 약 ±10분이라, 입춘 시각은 ±15분 안이면 통과로 본다. 전문 만세력과의 전수 대조는 사람 확인이 필요하다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'saju-'));
const tr = (p) => ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
writeFileSync(path.join(dir, 'engine.mjs'), tr('src/doit/lib/saju/engine.ts'));
writeFileSync(path.join(dir, 'explain.mjs'), tr('src/doit/lib/saju/explain.ts').replace("from './engine'", "from './engine.mjs'"));
const E = await import(pathToFileURL(path.join(dir, 'engine.mjs')).href);
const X = await import(pathToFileURL(path.join(dir, 'explain.mjs')).href);
const NOW = new Date('2026-09-26T03:00:00Z');
const calc = (date, time, gender = 'male') => E.calculateSaju({ date, time, gender, calendar: 'solar' }, NOW);
const hanja = (r) => [r.four_pillars.year.hanja, r.four_pillars.month.hanja, r.four_pillars.day.hanja, r.four_pillars.hour?.hanja ?? '-'].join(' ');

test('일주 기준값: 2000-01-01 戊午 · 60갑자 순환 연속(다음 날 己未)', () => {
  assert.equal(calc('2000-01-01', '12:00').four_pillars.day.hanja, '戊午');
  assert.equal(calc('2000-01-02', '12:00').four_pillars.day.hanja, '己未');
  assert.equal(E.pillarOf(2415021 + 49).hanja, '甲戌', '1900-01-01 甲戌(율리우스 적일 공식)');
});

test('입춘 시각(한국천문연구원 공개 값) ±15분', () => {
  const kst = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 9, mi);
  for (const [y, ref] of [[2024, kst(2024, 2, 4, 17, 27)], [2025, kst(2025, 2, 3, 23, 10)], [2026, kst(2026, 2, 4, 5, 2)], [1984, kst(1984, 2, 5, 0, 19)]]) {
    assert.ok(Math.abs(E.lichunOf(y) - ref) <= 15 * 60000, `${y} 입춘 오차 ${(E.lichunOf(y) - ref) / 60000}분`);
  }
});

test('연주·월주: 입춘 전후로 해가 바뀜 · 월간은 연간 규칙(甲己년 丙寅)', () => {
  assert.equal(hanja(calc('2024-02-04', '12:00')), '癸卯 乙丑 戊戌 戊午', '입춘(17:27) 전 = 계묘년 을축월');
  assert.equal(hanja(calc('2024-02-04', '20:00')).slice(0, 5), '甲辰 丙寅', '입춘 뒤 = 갑진년 병인월');
  assert.equal(hanja(calc('2000-01-01', '12:00')), '己卯 丙子 戊午 戊午');
  assert.equal(hanja(calc('1984-02-05', '10:30')).slice(0, 5), '甲子 丙寅');
});

test('시주·날짜 경계: 밤 11시 반부터 다음 날 자시 · 1987/88 서머타임 반영 · 같은 입력 = 같은 결과', () => {
  const a = calc('1990-03-10', '23:20'), b = calc('1990-03-10', '23:40');
  assert.equal(a.four_pillars.hour.hanja[1], '亥'); assert.equal(b.four_pillars.hour.hanja[1], '子');
  assert.notEqual(a.four_pillars.day.hanja, b.four_pillars.day.hanja, '23:30 에 날이 바뀐다');
  assert.equal(calc('1988-06-15', '23:40').four_pillars.hour.hanja[1], '亥', '서머타임(UTC+10) 반영');
  assert.equal(calc('1988-06-15', '23:40').calendar_basis.utc_offset_minutes, 600);
  assert.deepEqual(calc('1979-07-21', '08:15', 'female'), calc('1979-07-21', '08:15', 'female'));
});

test('시간 모름: 시주 없음 · 오행 6글자 · 안내 문구', () => {
  const r = calc('1978-11-03', null);
  assert.equal(r.four_pillars.hour, null); assert.equal(r.ten_gods.hour, null);
  assert.equal(Object.values(r.five_elements).reduce((a, b) => a + b, 0), 6);
  assert.ok(r.calculation_meta.notes.some((n) => /시주는 비워/.test(n)));
  assert.equal(Object.values(calc('1978-11-03', '09:00').five_elements).reduce((a, b) => a + b, 0), 8);
});

test('대운: 양남·음녀 순행 · 음남·양녀 역행 · 성별 선택 안 함이면 계산 0 · 10개', () => {
  assert.equal(calc('1984-02-05', '10:30', 'male').major_cycles.direction, 'forward', '甲(양)년 남 = 순행');
  assert.equal(calc('1984-02-05', '10:30', 'female').major_cycles.direction, 'backward');
  assert.equal(calc('1983-06-01', '10:30', 'male').major_cycles.direction, 'backward', '癸(음)년 남 = 역행');
  const r = calc('1984-02-05', '10:30', 'male');
  assert.equal(r.major_cycles.cycles.length, 10);
  assert.equal(r.major_cycles.cycles[0].pillar.hanja, '丁卯', '월주 丙寅 다음');
  assert.equal(E.calculateSaju({ date: '1984-02-05', time: '10:30', gender: 'unspecified', calendar: 'solar' }, NOW).major_cycles, null);
});

test('입력 오류·음력: 결과를 만들지 않고 이유만(가짜 성공 0)', () => {
  assert.throws(() => E.calculateSaju({ date: '1990-05-01', time: null, gender: 'male', calendar: 'lunar' }), /음력/);
  assert.throws(() => E.calculateSaju({ date: '1990-02-30', time: null, gender: 'male', calendar: 'solar' }), /생년월일/);
  assert.throws(() => E.calculateSaju({ date: '1990-02-10', time: '25:00', gender: 'male', calendar: 'solar' }), /시간/);
  assert.throws(() => E.calculateSaju({ date: '1850-02-10', time: null, gender: 'male', calendar: 'solar' }), /1920/);
});

test('해설: 계산값에서만 · 점수 0 · 단정·예언 말 0 · 다섯 주제', () => {
  const r = calc('1984-02-05', '10:30', 'male');
  const all = [...X.topics(r, NOW).flatMap((t) => t.lines), ...X.summaryLines(r, NOW), ...X.currentFlow(r, NOW).lines].join(' ');
  assert.deepEqual(X.topics(r, NOW).map((t) => t.title), ['나', '관계', '일', '돈', '생활 흐름']);
  assert.doesNotMatch(all, /\d+\s*점|반드시|결혼한다|큰돈|사고가|귀하|보유하고 있습니다|전반적으로|에너지가 작용/);
  const g = X.godCounts(r); assert.equal(Object.values(g).reduce((a, b) => a + b, 0), 7, '일간 뺀 7자리');
  assert.match(all, new RegExp(`명식에 ${g.wealth}개`));
});

test('화면·정책: 예시 명식·「준비 중」 문구 0 · 저장/전송 0 · 매칭·나의 이해 반영 0 · 타로 파일 변경 0', () => {
  const ui = read('src/doit/app/plan-a/screens/SajuResult.tsx').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(ui, /예시|준비 중|時|supabase|localStorage|sessionStorage|fetch\(|agentTurn|understanding/);
  assert.match(ui, /calculateSaju\(input\)/);
  assert.match(ui, /나의 이해나 사람 연결에는 쓰지 않아요/);
  const input = read('src/doit/app/plan-a/screens/SajuInput.tsx');
  assert.match(input, /disabled=\{value !== "solar"\}/);
  assert.doesNotMatch(input, /사주 계산은 아직 준비 중|시연입니다|사주 준비 상태 보기/);
  const page = read('src/doit/pages/do-it/fortune/page.tsx');
  assert.match(page, /<SajuResult input=\{sajuInput\}/);
  assert.match(page, /<TaroCardSelect/); assert.match(page, /<FreeResult/);
  const engine = read('src/doit/lib/saju/engine.ts').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(engine, /openai|fetch|supabase|import /, '엔진은 외부 호출·의존성 0');
});
