// 2026-10-05 대표 「타로 해석 실패 이유를 알아내서 최종 완성」 — 앱 쪽 소스 검사(모의 · 실제 서버·실기기 아님).
// 원인: QA 서버에 openai-chat 함수가 없음(목록·로그 확인) · 앱은 모든 실패를 같은 「잠시 후」로 숨김 · 같은 카드로 다시 보기 버튼 없음.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const OAI = src('src/doit/lib/openai.ts');
const API = src('src/doit/lib/agentApi.ts');
const FREE = src('src/doit/app/plan-a/screens/FreeResult.tsx');

test('타로 해석 = ECHO 서버(agent_card) · 로그인 사용자만 · 예전 openai-chat 타로 호출 0', () => {
  const fn = OAI.slice(OAI.indexOf('export async function generateTarotInterpretation('));
  assert.match(fn, /return await agentTarot\(userId, cardName, purpose\);/);
  assert.doesNotMatch(fn, /invokeChat|openai-chat|tarot_reading/);
  assert.match(fn, /if \(!userId\) throw new TarotError\("login", TAROT_ERROR\.login\);/);
  assert.match(API, /write<\{ reading: TarotReading \}>\(userId, \{ action: 'agent_card', cardName, purpose \}/, '같은 카드 재시도 = 같은 요청 id(write 보관)');
});

test('실패 종류별 안내(로그인 · 준비 중 · 한도 · 몰림 · 실패) — 모든 실패를 같은 「잠시 후」로 숨기지 않음', () => {
  const kinds = { UNAUTHORIZED: 'login', AI_NOT_CONFIGURED: 'not_ready', NOT_FOUND: 'not_ready', AI_DAILY_LIMIT: 'limit', BUSY: 'busy', RATE_LIMITED: 'busy', AI_FORMAT: 'failed', AI_ERROR: 'failed', NETWORK_ERROR: 'failed', AI_COMPANY_BUDGET: 'paused' };
  const body = OAI.match(/export const tarotErrorKind = \(code: string \| undefined\): TarotErrorKind =>([\s\S]*?);\n/)[1];
  const kindOf = new Function('code', `return (${body});`);
  for (const [code, kind] of Object.entries(kinds)) assert.equal(kindOf(code), kind, code);
  for (const k of ['login', 'not_ready', 'limit', 'busy', 'paused', 'failed']) assert.match(OAI, new RegExp(`  ${k}: "[^"]+",`), k);
  assert.doesNotMatch(OAI.match(/export const TAROT_ERROR[\s\S]*?\};/)[0], /잠시 후 다시 시도해 주세요/);
});

test('FreeResult: 실패하면 같은 카드로 다시 보기(누를 때만 · 불러오는 중 막음) · 로그인 필요면 로그인 뒤 운세로 돌아옴', () => {
  assert.match(FREE, /\}, \[mode, tarotTry\]\);/);
  assert.match(FREE, /disabled=\{tarotLoading\}\n\s*onClick=\{\(\) => \{ if \(!tarotLoading\) setTarotTry\(\(n\) => n \+ 1\); \}\}/);
  assert.match(FREE, /tarotErrorKind === "failed" \|\| tarotErrorKind === "busy"/);
  assert.match(FREE, /<Link [^>]*to="\/login" state=\{\{ from: "\/doit\/fortune\?view=taro" \}\}>/);
  // Codex PR #140 P2(4184790623): 로그인 뒤 운세 처음 화면이 아니라 고른 카드의 타로 결과로 돌아옴
  const FORT = src('src/doit/pages/do-it/fortune/page.tsx');
  assert.match(FORT, /const backToTaro = params\.get\("view"\) === "taro" && readSelectedCard\(\) !== null;/);
  assert.match(FORT, /useState<Step>\(backToTaro \? "result" : "entry"\)/);
  assert.match(FORT, /useState<Mode>\(backToTaro \? "taro" : "saju"\)/);
  assert.match(FREE, /setTarotErrorKind\(err instanceof TarotError \? err\.kind : "failed"\);/);
});
