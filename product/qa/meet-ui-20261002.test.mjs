// PR #99 마지막 구간 화면 계약(2026-10-02) — 화면은 서버 상태만 그린다 · 꺼짐/실패/모르는 모양 = 그리지 않음 · 기록 번호는 보이지 않음.
// 모의 검사다(실제 영상·저장 PASS 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

function loadApi(respond, { env = {}, meta = {} } = {}) {
  const src = readFileSync('src/doit/lib/connectApi.ts', 'utf8').replaceAll('import.meta.env', '__env');
  const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; const sent = []; const updates = [];
  class UnderstandingError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const supabase = { auth: {
    getSession: async () => ({ data: { session: { user: { user_metadata: meta } } } }),
    updateUser: async (u) => { updates.push(u); Object.assign(meta, u.data); return { error: null }; },
  } };
  const require = (n) => {
    if (n === '@/lib/supabase/client') return { supabase };
    if (n === '@/doit/lib/understandingApi') return { UnderstandingError, serverFunctionRequest: async (_fn, body) => { sent.push(body); return respond(body, UnderstandingError); } };
    throw new Error(n);
  };
  vm.runInNewContext(code, { exports: mod.exports, module: mod, require, crypto: globalThis.crypto, __env: env }, { filename: 'connectApi.ts' });
  return { api: mod.exports, sent, updates, meta };
}
const SID = '50000000-0000-4000-8000-00000000000e';
const MID = '70000000-0000-4000-8000-000000000071';
const plain = (o) => JSON.parse(JSON.stringify(o));

test('PR101 상태 읽기 3가지: 꺼짐(MEET_NOT_CONFIGURED) = off · 켜졌는데 실패·모르는 모양 = error(숨기지 않음) · 정상 = ready', async () => {
  const kind = async (respond) => (await loadApi(respond).api.loadMeetStatus('u', MID)).kind;
  assert.equal(await kind((_b, E) => { throw new E('MEET_NOT_CONFIGURED', 'x'); }), 'off');
  for (const respond of [(_b, E) => { throw new E('MEET_READ_FAILED', 'x'); }, () => { throw new Error('net'); }, () => ({ ok: true }), () => ({ ok: true, state: 'done', allowed: true }), () => ({ ok: false, state: 'allowed' })])
    assert.equal(await kind(respond), 'error');
  assert.equal(await kind(() => ({ ok: true, state: 'need_video', allowed: false })), 'ready');
});
test('PR101 영상 이용 동의: 빌드 판이 없으면 동의 화면 0 · 공개 동의만으로는 영상 동의 아님 · 동의/거두기는 영상 칸만 바꿈', async () => {
  const none = loadApi(() => ({}), { meta: { doit_connect_consent_version: 'connect-v1' } });
  assert.equal(none.api.VIDEO_CONSENT_VERSION, null); assert.equal(await none.api.hasVideoConsent(), false);
  const meta = { doit_connect_consent_version: 'connect-v1', doit_connect_consent_at: '2026-10-01T00:00:00Z' };
  const on = loadApi(() => ({}), { env: { VITE_VIDEO_CONSENT_VERSION: 'video-v1' }, meta });
  assert.equal(await on.api.hasVideoConsent(), false, '공개 동의가 영상 동의를 대신하지 않음');
  assert.equal(await on.api.setVideoConsent(true), null);
  assert.equal(await on.api.hasVideoConsent(), true);
  assert.equal(meta.doit_connect_consent_version, 'connect-v1', '공개 동의 칸 그대로');
  assert.deepEqual(Object.keys(on.updates[0].data).sort(), ['doit_video_consent_at', 'doit_video_consent_version']);
  assert.equal(await on.api.setVideoConsent(false), null);
  assert.equal(await on.api.hasVideoConsent(), false); assert.equal(meta.doit_connect_consent_version, 'connect-v1');
  meta.doit_video_consent_version = 'video-v0'; meta.doit_video_consent_at = '2026-10-01T00:00:00Z';
  assert.equal(await on.api.hasVideoConsent(), false, '옛 판 = 동의 아님');
  assert.deepEqual(JSON.parse(JSON.stringify(await on.api.videoConsentState())), { current: false, any: true }, '옛 판이라도 거두기 대상');
  // 빌드 판이 없어도(기능 꺼짐) 남아 있는 동의는 거둘 수 있다 · 영상 칸만
  const offMeta = { doit_connect_consent_version: 'connect-v1', doit_video_consent_version: 'video-v1', doit_video_consent_at: '2026-10-02T00:00:00Z' };
  const off = loadApi(() => ({}), { meta: offMeta });
  assert.deepEqual(JSON.parse(JSON.stringify(await off.api.videoConsentState())), { current: false, any: true });
  assert.equal(await off.api.setVideoConsent(false), null);
  assert.equal(offMeta.doit_video_consent_version, null); assert.equal(offMeta.doit_connect_consent_version, 'connect-v1');
  assert.notEqual(await off.api.setVideoConsent(true), null, '판 없이 새 동의는 받지 않음');
});
test('allowed 는 서버 state 가 allowed 이고 allowed:true 일 때만 · 다른 state 의 allowed:true 는 무시', async () => {
  const { api } = loadApi(() => ({}));
  assert.equal(api.parseMeetStatus({ ok: true, state: 'waiting_partner', allowed: true }).allowed, false);
  assert.equal(api.parseMeetStatus({ ok: true, state: 'allowed', allowed: false }).allowed, false);
  assert.equal(api.parseMeetStatus({ ok: true, state: 'allowed', allowed: true }).allowed, true);
});
test('sessionId: 지금 서버 응답(필드 없음) = null · 형식이 맞는 번호만 받음 · 가짜 번호를 만들지 않음', async () => {
  const { api } = loadApi(() => ({}));
  assert.deepEqual(plain(api.parseMeetStatus({ ok: true, state: 'need_my_check', allowed: false })), { state: 'need_my_check', allowed: false, sessionId: null, stateVersion: null });
  assert.equal(api.parseMeetStatus({ ok: true, state: 'need_my_check', allowed: false, sessionId: 'room-123' }).sessionId, null);
  assert.equal(api.parseMeetStatus({ ok: true, state: 'need_my_check', allowed: false, sessionId: SID }).sessionId, SID);
});
test('확인·의사 요청 모양: 서버 계약 이름 그대로 · 신원·allowed 를 보내지 않음', async () => {
  const V = 'abababababababababababababababababababababababababababababababab';
  const { api, sent } = loadApi(() => ({ ok: true, state: 'need_my_intent', allowed: false, sessionId: SID, stateVersion: V }));
  await api.confirmMeetCheck('u', MID, SID, V);
  await api.sendMeetIntent('u', MID, SID, V, 'yes', '60000000-0000-4000-8000-00000000000f');
  assert.deepEqual(plain(sent), [{ action: 'meet_check', matchId: MID, sessionId: SID, stateVersion: V }, { action: 'meet_intent', matchId: MID, sessionId: SID, intent: 'yes', requestId: '60000000-0000-4000-8000-00000000000f', stateVersion: V }]);
  assert.equal(api.parseMeetStatus({ ok: true, state: 'need_my_check', allowed: false, stateVersion: 'short' }).stateVersion, null, '모양이 다른 버전 = 없음');
});
test('화면 원문: 기록 번호를 그리지 않음 · 보증 표현 0 · 상대 의사 노출 문구 0 · 버튼은 서버 상태 분기 안에만', () => {
  const src = readFileSync('src/doit/components/feature/MeetStep.tsx', 'utf8');
  assert.ok(!/(?<!\$)\{\s*(status\.)?(sessionId|sid)\s*\}/.test(src), 'sessionId 를 글자로 그리지 않음(요청 id 를 만드는 ${…} 만 허용)');
  assert.ok(!/신원(이|을)? (확인|인증)(됐|되었|했)|안전(한|이)? (사람|상대)|보증(해요|합니다)|인증된/.test(src));
  assert.ok(!/상대가 (아니요|아직|거절)/.test(src));
  assert.ok(src.includes("if (load.kind === 'off') return withdrawable ?"), '꺼짐 = 거두기만(남은 동의가 있을 때) · 아니면 숨김');
  assert.equal((src.match(/\{withdrawButton\}/g) ?? []).length, 3, '꺼짐·실패·정상(지금은 어려움 포함) 모두 거두기 자리');
  assert.ok(src.includes("load.kind === 'error'") && src.includes('다시 불러오기'), '켜진 상태의 실패는 안내 + 다시 불러오기');
  assert.ok(!/act\([^)]*\)\s*;?\s*\n\s*setNote/.test(src) && !/reload\(\);\s*\n\s*await (confirmMeetCheck|sendMeetIntent|setVideoConsent)/.test(src), '바뀐 상태 뒤 저절로 다시 보내기 0');
  assert.ok(/status\.state === 'need_my_check' && sid && ver/.test(src) && /status\.state === 'need_my_intent' && sid && ver/.test(src), '번호·상태 버전 없으면 버튼 0');
  assert.ok(src.includes("e.code === 'STATE_CHANGED'"), '바뀐 상태면 다시 읽기');
  assert.ok(/status\.state === 'allowed' && status\.allowed/.test(src));
});
