// 2026-10-10 Codex(PR #153 bc2943a) P1 4235843415 · P2 4235843417 — 화면 쪽 위기 안전 안내(소스 대조).
// 서버가 session: null + crisis 를 줄 때 대화 화면·프로필 확인(고치기) 모두 안내를 잃지 않고, 옛 회차 세션으로 이어 보내지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const CONV = readFileSync('src/doit/components/feature/AgentConversation.tsx', 'utf8');
const CHECK = readFileSync('src/doit/components/feature/AgentProfileCheck.tsx', 'utf8');
const API = readFileSync('src/doit/lib/agentApi.ts', 'utf8');

test('agentTurn: session null 은 위기 안내일 때만 받아들인다', () => {
  assert.match(API, /if \(r\.session === null && r\.turn\.kind === 'crisis'\) return r;\s*if \(!validSession\(r\.session\)\) throw new Error\('INVALID_RESPONSE'\);/);
});

test('대화 화면: 위기 안내는 별도 안전 줄 — 불러오는 중·다시 불러오기 실패·시작 전·대화 화면 모두에 보인다', () => {
  assert.match(CONV, /const safetyLine = safety && \(!session \|\| session\.messages\.length === safety\.at \|\| safety\.at < 0\) \? <p className="echo-notice" role="alert">\{safety\.line\}<\/p> : null;/, '안내는 대화가 이어질 때까지 보임');
  assert.equal((CONV.match(/\{safetyLine\}/g) ?? []).length, 3, '불러오는 중(+실패) · 시작 전 · 대화 화면');
  assert.match(CONV, /if \(!loaded\) return <section[^\n]*\n\s*\{header\}\n\s*\{safetyLine\}/, '불러오기 실패 화면에도 안내');
});

test('대화 화면(P2): 세션 없음이면 옛 세션을 먼저 지우고 다시 불러온다(실패해도 옛 회차로 이어 보내기 0)', () => {
  assert.match(CONV, /const reloadRound = \(\) => \{ setSession\(null\); setLoaded\(false\); return load\(\); \};/);
  assert.match(CONV, /if \(r\.turn\.kind === 'crisis'\) \{\s*showSafety\(r\.turn\.reply, r\.session\); setDraft\(''\);\s*if \(r\.session\) setSession\(r\.session\); else await reloadRound\(\);/);
});

test('프로필 확인(P1): 고치는 말이 위기면 정정으로 다루지 않고 부모가 안내 · 세션 없으면 다시 불러옴(notesOf(null) 0)', () => {
  const fn = CHECK.slice(CHECK.indexOf('const sendFix'), CHECK.indexOf('const [quotes'));
  const crisisAt = fn.indexOf("if (r.turn.kind === 'crisis')");
  assert.ok(crisisAt > 0 && crisisAt < fn.indexOf('notesOf(r.session'), '위기 처리가 notesOf 보다 먼저');
  assert.match(fn, /onCrisis\(r\.turn\.reply, !r\.session\)/);
  assert.match(CONV, /onCrisis=\{\(line, stale\) => \{ showSafety\(line, stale \? null : session\); if \(stale\) void reloadRound\(\); \}\}/);
});
