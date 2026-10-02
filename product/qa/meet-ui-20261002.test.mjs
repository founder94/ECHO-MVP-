// PR #99 마지막 구간 화면 계약(2026-10-02) — 화면은 서버 상태만 그린다 · 꺼짐/실패/모르는 모양 = 그리지 않음 · 기록 번호는 보이지 않음.
// 모의 검사다(실제 영상·저장 PASS 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function loadApi(respond) {
  const code = ts.transpileModule(readFileSync('src/doit/lib/connectApi.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; const sent = [];
  class UnderstandingError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const require = (n) => {
    if (n === '@/lib/supabase/client') return { supabase: {} };
    if (n === '@/doit/lib/understandingApi') return { UnderstandingError, serverFunctionRequest: async (_fn, body) => { sent.push(body); return respond(body, UnderstandingError); } };
    throw new Error(n);
  };
  vm.runInNewContext(code, { exports: mod.exports, module: mod, require, crypto: globalThis.crypto }, { filename: 'connectApi.ts' });
  return { api: mod.exports, sent };
}
const SID = '50000000-0000-4000-8000-00000000000e';
const MID = '70000000-0000-4000-8000-000000000071';
const plain = (o) => JSON.parse(JSON.stringify(o));

test('꺼짐(MEET_NOT_CONFIGURED) · 네트워크 실패 · 모르는 모양 = null(화면 없음)', async () => {
  for (const respond of [(_b, E) => { throw new E('MEET_NOT_CONFIGURED', 'x'); }, () => { throw new Error('net'); }, () => ({ ok: true }), () => ({ ok: true, state: 'done', allowed: true }), () => ({ ok: false, state: 'allowed' })]) {
    const { api } = loadApi(respond);
    assert.equal(await api.fetchMeetStatus('u', MID), null);
  }
});
test('allowed 는 서버 state 가 allowed 이고 allowed:true 일 때만 · 다른 state 의 allowed:true 는 무시', async () => {
  const { api } = loadApi(() => ({}));
  assert.equal(api.parseMeetStatus({ ok: true, state: 'waiting_partner', allowed: true }).allowed, false);
  assert.equal(api.parseMeetStatus({ ok: true, state: 'allowed', allowed: false }).allowed, false);
  assert.equal(api.parseMeetStatus({ ok: true, state: 'allowed', allowed: true }).allowed, true);
});
test('sessionId: 지금 서버 응답(필드 없음) = null · 형식이 맞는 번호만 받음 · 가짜 번호를 만들지 않음', async () => {
  const { api } = loadApi(() => ({}));
  assert.deepEqual(plain(api.parseMeetStatus({ ok: true, state: 'need_my_check', allowed: false })), { state: 'need_my_check', allowed: false, sessionId: null });
  assert.equal(api.parseMeetStatus({ ok: true, state: 'need_my_check', allowed: false, sessionId: 'room-123' }).sessionId, null);
  assert.equal(api.parseMeetStatus({ ok: true, state: 'need_my_check', allowed: false, sessionId: SID }).sessionId, SID);
});
test('확인·의사 요청 모양: 서버 계약 이름 그대로 · 신원·allowed 를 보내지 않음', async () => {
  const { api, sent } = loadApi(() => ({ ok: true, state: 'need_my_intent', allowed: false, sessionId: SID }));
  await api.confirmMeetCheck('u', MID, SID);
  await api.sendMeetIntent('u', MID, SID, 'yes', '60000000-0000-4000-8000-00000000000f');
  assert.deepEqual(plain(sent), [{ action: 'meet_check', matchId: MID, sessionId: SID }, { action: 'meet_intent', matchId: MID, sessionId: SID, intent: 'yes', requestId: '60000000-0000-4000-8000-00000000000f' }]);
});
test('화면 원문: 기록 번호를 그리지 않음 · 보증 표현 0 · 상대 의사 노출 문구 0 · 버튼은 서버 상태 분기 안에만', () => {
  const src = readFileSync('src/doit/components/feature/MeetStep.tsx', 'utf8');
  assert.ok(!/(?<!\$)\{\s*(status\.)?(sessionId|sid)\s*\}/.test(src), 'sessionId 를 글자로 그리지 않음(요청 id 를 만드는 ${…} 만 허용)');
  assert.ok(!/신원(이|을)? (확인|인증)(됐|되었|했)|안전(한|이)? (사람|상대)|보증(해요|합니다)|인증된/.test(src));
  assert.ok(!/상대가 (아니요|아직|거절)/.test(src));
  assert.ok(src.includes("if (!status || status.state === 'unavailable') return null;"));
  assert.ok(/status\.state === 'need_my_check' && sid/.test(src) && /status\.state === 'need_my_intent' && sid/.test(src), '번호 없으면 버튼 0');
  assert.ok(/status\.state === 'allowed' && status\.allowed/.test(src));
});
