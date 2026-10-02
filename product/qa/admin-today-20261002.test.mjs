// 2026-10-02 대표 「QA 마감 v1.1」 §13 — 관리자 첫 화면 「오늘」 판정(순수 함수)과 화면 원본 계약.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'brief-'));
const out = path.join(dir, 'brief.mjs');
writeFileSync(out, ts.transpileModule(read('src/admin/brief.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { envOf, stateOf, firstTask, oldestOpenHours } = await import(pathToFileURL(out).href);

test('환경: 지금 열린 관리자 사이트 이름으로 QA·운영·알 수 없음 구분(소스에 QA 주소 0)', () => {
  assert.equal(envOf('echo-admin-qa.netlify.app'), '시험용 QA');
  assert.equal(envOf('admin.do-it.company'), '실제 운영');
  assert.equal(envOf('localhost'), '알 수 없음');
  assert.equal(envOf(undefined), '알 수 없음');
  assert.equal(envOf('quality.example.com'), '알 수 없음', 'qa 가 단어 일부일 때는 아님');
  assert.doesNotMatch(read('src/admin/brief.ts'), /supabase\.co|netlify\.app|[a-z]{20}/, 'QA·운영 주소·프로젝트 id 글자 0');
});

test('상태: 못 읽으면 확인 불가 · 안전·연결 자료를 못 읽었으면 「정상」 금지 · 오류=일부 중단', () => {
  assert.equal(stateOf({ overviewOk: false, health: null, safetyOk: true, connectOk: true }).state, '확인 불가');
  assert.equal(stateOf({ overviewOk: true, health: '정상', safetyOk: false, connectOk: true }).state, '확인 필요');
  assert.equal(stateOf({ overviewOk: true, health: '정상', safetyOk: true, connectOk: false }).state, '확인 필요');
  assert.equal(stateOf({ overviewOk: true, health: '오류', safetyOk: true, connectOk: true }).state, '일부 중단');
  assert.equal(stateOf({ overviewOk: true, health: '주의', safetyOk: true, connectOk: true }).state, '확인 필요');
  assert.equal(stateOf({ overviewOk: true, health: '정상', safetyOk: true, connectOk: true }).state, '정상');
});

test('먼저 할 일 1건: 이유·영향·담당·이동 메뉴 · 안전 자료를 못 읽었으면 그게 먼저 · 일이 없으면 null', () => {
  const t = firstTask(['중대 의심 신고 2건을 직접 확인하세요.', 'AI 가 답을 못 만든 대화 3건을 확인하세요.'], true, true);
  assert.deepEqual([t.owner, t.menu], ['대표', 'safety']); assert.ok(t.why && t.impact);
  assert.equal(firstTask(['AI 가 답을 못 만든 대화 3건을 확인하세요.'], true, true).menu, 'failures');
  assert.equal(firstTask([], false, true).menu, 'safety');
  assert.equal(firstTask([], true, false).menu, 'connect');
  assert.equal(firstTask([], true, true), null);
});

test('가장 오래 기다린 신고: 열린 신고만 · 시간 단위 · 없으면 null', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  assert.equal(oldestOpenHours([{ status: 'open', created_at: '2026-10-02T02:00:00Z' }, { status: 'closed', created_at: '2026-09-01T00:00:00Z' }], now), 10);
  assert.equal(oldestOpenHours([{ status: 'closed', created_at: '2026-09-01T00:00:00Z' }], now), null);
});

test('화면 계약: 없는 기능은 0 이 아니라 「기능 없음/연결 필요」 · 약속은 자기 기록이라고 밝힘 · 상위 묶음 다섯 개 · 기존 메뉴 보존', () => {
  const today = read('src/admin/views/Today.tsx');
  assert.match(today, /영상으로 서로 확인<\/span><strong className="aw-missing">기능 없음/);
  assert.match(today, /약속\(사용자 자기 기록\)/);
  assert.equal((today.match(/연결 필요/g) ?? []).length, 3, '수익 세 칸 = 연결 필요');
  assert.doesNotMatch(today, /450|\?\? 0\b/, '규모 숫자 하드코딩 0 · 없는 값을 0 으로 0');
  const app = read('src/admin/AdminApp.tsx');
  assert.deepEqual([...app.matchAll(/\{ label: '([^']+)', items: /g)].map((m) => m[1]), ['오늘', '연결', '안전', '수익', '관리']);
  const keys = [...app.matchAll(/\{ key: '([a-z]+)', label: /g)].map((m) => m[1]);
  const grouped = [...app.matchAll(/items: \[([^\]]+)\]/g)].flatMap((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]));
  assert.deepEqual([...grouped].sort(), [...keys].sort(), '모든 상세 메뉴가 어느 묶음에든 있다(삭제 0)');
  assert.match(read('src/admin/admin-web.css'), /\.aw-today \{[^}]*background: #fff;[^}]*color: #111;/, '밝은 불투명 판 · 진한 글씨');
});
