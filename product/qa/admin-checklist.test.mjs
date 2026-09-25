// 대표 2026-09-25 관리자 점검 — 초보 대표가 읽는 화면에 영어 표 이름·개발 용어를 보이지 않고, 기능 상태를 한 줄로 보인다(파일 규칙 검사).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const A = 'src/doit/pages/do-it/admin/';

test('대시보드 맨 위에 한눈에 점검표 · 네 가지 상태(작동 중·준비 중·꺼 둠·대표 결정 필요)', () => {
  const dash = read(`${A}views/Dashboard.tsx`);
  assert.ok(dash.indexOf('<FeatureChecklist') < dash.indexOf('<AnalyticsSection'), '점검표가 맨 위');
  const list = read(`${A}views/FeatureChecklist.tsx`);
  for (const s of ['작동 중', '준비 중', '꺼 둠', '대표 결정 필요']) assert.match(list, new RegExp(s));
  for (const name of ['전화 인증', '얼굴 · 지문 로그인', 'AI 대화', '결제', 'KEY']) assert.match(list, new RegExp(name));
});

test('관리자 화면 글자에 영어 표 이름·RLS·미구현 0 (코드 주석 제외)', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
  const dash = strip(read(`${A}views/Dashboard.tsx`));
  assert.doesNotMatch(dash, /note="[^"]*(missions|member_selections|key_orders|key_balances|saju_taro_records|consents|space_members|openai_rate_limits|SELECT|RLS|미구현)/);
  const ui = strip(read(`${A}components/ui.tsx`));
  assert.doesNotMatch(ui, />미구현<|>권한 오류<|>조회 실패</);
  assert.doesNotMatch(strip(read(`${A}components/AdminShell.tsx`)), /\{activeMenu\.table\}/, '머리말에 표 이름 0');
});

test('동의 기록은 프로필의 약관 판으로 센다(없는 consents 표를 찾지 않는다) · 두 관리자 화면이 서로 이어진다', () => {
  const hook = read(`${A}hooks/useAdminData.ts`);
  assert.match(hook, /from\("profiles"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("consent_version", CONSENT_VERSION\)/);
  assert.doesNotMatch(hook, /attemptCount\(supabase, "consents"\)/);
  assert.match(read(`${A}components/AdminShell.tsx`), /to="\/admin\/mobile"/);
  assert.match(read('src/pages/admin/components/AdminShell.tsx'), /to="\/doit\/admin\/mobile"/);
});
