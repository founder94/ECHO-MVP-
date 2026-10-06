// 2026-10-05 PR #132 c61ff12 Codex P2 3건 재현 — 가짜 AI 기준(실제 AI·운영 0). 실행: node --test qa/agent-codex-p2-20261005b.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const dir = mkdtempSync(path.join(tmpdir(), 'p2b-'));
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const emit = (p, out) => { const f = path.join(dir, out); writeFileSync(f, ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText); return pathToFileURL(f).href; };
emit('supabase/functions/doit-agent/matching.ts', 'matching.mjs');
const A = await import(emit('supabase/functions/doit-agent/agent.ts', 'agent.mjs'));

test('Codex P2 4180947117: 「고르면·골라」만 있는 보통 질문은 보기를 먼저 펼치지 않는다', () => {
  for (const q of ['같이 메뉴 고르면 편해요?', '옷을 골라 주는 사람이 좋아요?']) assert.equal(A.rescueAuto('answer', null, q), false, q);
  assert.equal(A.rescueAuto('answer', null, '이런 느낌 중엔 뭐가 가까워요?'), true, '진짜 고르기 모양은 그대로');
  assert.equal(A.rescueAuto('answer', null, '이 중에서 하나 골라 줄래요?'), true, '보기 가리킴은 그대로');
});

test('Codex P2 4181005175: 목적 타일 + 직접 친 한 줄은 버튼 글자가 아니다(한 줄에 잇는다)', () => {
  assert.equal(A.buttonInput(A.FIRST_QUESTION, false, '친구'), true, '타일만 누름 = 버튼');
  assert.equal(A.buttonInput(A.FIRST_QUESTION, false, '친구. 음악 얘기가 잘 통하는 사람이 좋아요'), false);
  const st = A.newState({ tone: 'polite', goal: 'friend' }); A.seedFirstQuestion(st);
  assert.equal(A.turnInput(st, '친구. 음악 얘기가 잘 통하는 사람이 좋아요').latest_is_button, undefined);
  assert.equal(A.turnInput(st, '친구').latest_is_button, true);
});

test('Codex P2 4181005183: 같은 질문 피하기 재요청도 button 플래그를 넘긴다', () => {
  const src = readFileSync(new URL('../supabase/functions/doit-agent/agent.ts', import.meta.url), 'utf8');
  const dup = src.slice(src.indexOf('v2.4.7 GF-118'), src.indexOf('const limitReached'));
  assert.match(dup, /turnInput\(st, work, \{ button \}\)/);
  assert.doesNotMatch(dup, /turnInput\(st, work\)/);
});
