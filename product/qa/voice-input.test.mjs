// 대표 2026-09-25 음성 버튼 — 말한 글자를 칸에 합치는 순수 로직 검사(가짜 인식 결과). 실제 마이크·실기기 검사가 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const src = readFileSync(new URL('../src/doit/lib/voiceInput.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace(/^import .*$/m, 'const useCallback = (f) => f, useEffect = () => {}, useRef = (v) => ({ current: v }), useState = (v) => [v, () => {}];');
const lib = await import(`data:text/javascript,${encodeURIComponent(js)}`);
const r = (t, isFinal = true) => ({ isFinal, 0: { transcript: t } });

test('말하는 중(중간 결과)과 확정 결과를 이어 붙인다 · 먼저 적은 글 뒤에 붙인다', () => {
  assert.equal(lib.joinTranscript('', [r('능력이 있는'), r(' 사람', false)]), '능력이 있는 사람');
  assert.equal(lib.joinTranscript('연락은 자주 해요.', [r('천천히 알아가요')]), '연락은 자주 해요. 천천히 알아가요');
  assert.equal(lib.joinTranscript('그대로  ', []), '그대로  ', '아무 말도 없으면 적은 글을 바꾸지 않는다');
  assert.equal(lib.joinTranscript('', [r('  띄어쓰기   여러 번 ')]), '띄어쓰기 여러 번');
});

test('못 쓰는 기기에서는 버튼을 숨길 수 있게 알려 준다 · 목소리를 서버로 보내는 코드 0', () => {
  assert.equal(lib.canListen(), false);
  assert.doesNotMatch(src, /fetch\(|supabase|localStorage|sessionStorage|console\./);
  const ui = readFileSync(new URL('../src/doit/components/feature/AgentConversation.tsx', import.meta.url), 'utf8');
  assert.match(ui, /\{voice\.supported && <button type="button" className=\{voice\.listening/);
  assert.match(ui, /speakNew\(session, r\.session, spoke\)/, '음성으로 보낸 말에는 ECHO 대답도 소리로');
});
