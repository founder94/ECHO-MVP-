// 2026-09-28 대표 「FINAL MVP IMPLEMENTATION MASTER」 §15–§19 화면 원본 검사 — 당신이 잠든 사이 후보 · 상호선택 · 결과 기록.
// 서버 동작은 qa/connect-server.test.mjs(v2.0) 가, 실제 QA 서버 관통은 qa-real/qa-live.mjs 가 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CAND = read('src/doit/components/feature/ConnectionCandidates.tsx').replace(/^\s*\/\/.*$/gm, ''); // 주석 제외
const MATCHES = read('src/doit/components/feature/ConnectionMatches.tsx');
const API = read('src/doit/lib/connectApi.ts');
const SERVER = read('supabase/functions/doit-connect/index.ts');

test('후보 화면: 서버가 준 이유만 그림 · 상대 이름·사진·소개 칸 0 · 점수·퍼센트 0 · 가짜 타이머 0', () => {
  assert.match(CAND, /fetchMyCandidates\(userId\)/);
  assert.match(CAND, /c\.reasons\.map/);
  assert.doesNotMatch(CAND, /nickname|photo_url|partner|\bbio\b/, '후보 단계에 상대 정보 칸 없음');
  assert.doesNotMatch(CAND, /%|점수|궁합|사주|타로/);
  assert.doesNotMatch(CAND, /setTimeout|Math\.random|mock|dummy/i);
  assert.match(CAND, /당신이 잠든 사이,<br \/>ECHO가 먼저 살펴봤어요\./);
  assert.match(CAND, /ECHO가 연결을 준비하고 있어요\./);
  assert.match(CAND, /이어지고 싶어요/);
  assert.match(CAND, /이번엔 넘길게요/);
  assert.match(CAND, /숨기기/);
  assert.match(CAND, /최종 선택은 언제나 내가 해요/);
});

test('연결은 서버가 mutual 이라고 할 때만 열림 표시 · 화면이 성공을 스스로 정하지 않음', () => {
  assert.match(CAND, /out\.status === 'mutual'/);
  assert.match(CAND, /out\.status === 'waiting'/);
  assert.match(SERVER, /f\.a_choice === "yes" && f\.b_choice === "yes"/);
});

test('결과 기록: 네 가지(대화·만남·다시·도움) · 본인만 · 프로필로 올리지 않는다는 안내', () => {
  for (const f of ["'talked'", "'met'", "'again'", "'helpful'"]) assert.match(MATCHES, new RegExp(`field: ${f}`));
  assert.match(MATCHES, /sendOutcome\(userId, matchId/);
  assert.match(MATCHES, /상대에게 보이지 않고, 내 소개나 확정한 이야기로 바뀌지 않아요/);
  assert.match(API, /action: 'outcome'/);
});

test('서버: 결과·후보 표는 서버 함수만 씀 · 결과를 확정 말(doit_insights)·프로필로 쓰는 코드 0', () => {
  const outcome = SERVER.slice(SERVER.indexOf('if (action === "outcome")'), SERVER.indexOf('// ── 여기부터 관리자 전용 ──'));
  assert.doesNotMatch(outcome, /doit_insights|doit_records|from\("profiles"\)/);
  const mig = read('supabase/migrations/20260928120000_doit_connect_v2_mutual.sql');
  assert.match(mig, /revoke all on table public\.doit_match_candidates from anon, authenticated/);
  assert.match(mig, /revoke all on table public\.doit_match_outcomes from anon, authenticated/);
  assert.doesNotMatch(mig, /create policy|alter table public\.(profiles|doit_matches)/i, '기존 표·정책 변경 0');
});

test('추천 이유 재료: 직접 고른 목적 + 내가 직접 한 말(겹친 말) — AI 추정·사주·타로·점수 0', () => {
  const fn = SERVER.slice(SERVER.indexOf('function reasonsFor'), SERVER.indexOf('async function openConnection'));
  assert.match(fn, /common_a : c\.common_b/);
  assert.doesNotMatch(fn, /score|%|inferred|사주|타로/i);
});
