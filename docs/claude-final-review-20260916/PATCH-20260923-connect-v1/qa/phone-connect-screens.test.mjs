// 전화 인증 · 내 연결 · 연결 승인 화면 쪽 약속 (2026-09-23). 서버 판단은 qa/connect-server.test.mjs 가 가짜 DB 로 돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (p) => readFileSync(p, 'utf8');
const VERIFY = 'src/doit/pages/do-it/verify/page.tsx';
const MATCHES = 'src/doit/components/feature/ConnectionMatches.tsx';
const ASLEEP = 'src/doit/components/feature/AsleepConnections.tsx';

function loadPhone(calls = []) {
  const out = ts.transpileModule(read('src/doit/lib/phoneVerify.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const supabase = { auth: {
    updateUser: async (x) => { calls.push(['updateUser', x]); return { error: null }; },
    verifyOtp: async (x) => { calls.push(['verifyOtp', x]); return { error: null }; },
  } };
  const stubs = { '@/lib/supabase/client': { supabase }, '@/doit/lib/understandingApi': { serverFunctionRequest: async (fn, body) => { calls.push([fn, body]); return { ok: true, verified: true }; } } };
  vm.runInNewContext(out, { exports, require: (n) => { if (!(n in stubs)) throw new Error(`Unexpected dependency ${n}`); return stubs[n]; } });
  return exports;
}

test('휴대폰 번호: 사람들이 실제로 적는 모양을 모두 +82 로 바꾼다', () => {
  const { normalizeKrPhone } = loadPhone();
  for (const input of ['010-1234-5678', '01012345678', '010 1234 5678', '010.1234.5678', '+82 10-1234-5678', '82-10-1234-5678', '０１０-１２３４-５６７８', ' 010-1234-5678 ']) {
    assert.equal(normalizeKrPhone(input), '+821012345678', input);
  }
  assert.equal(normalizeKrPhone('011-123-4567'), '+82111234567');
});

test('휴대폰 번호가 아니면 받지 않는다(집 전화·짧은 번호·글자·이모지)', () => {
  const { normalizeKrPhone } = loadPhone();
  for (const input of ['02-123-4567', '1234', '', '모르겠어요', '📱', '010-1234-567', '010-1234-56789', '015-1234-5678']) {
    assert.equal(normalizeKrPhone(input), null, input);
  }
});

test('번호를 되비출 때는 가운데를 가리고, 인증 숫자는 6자리 숫자만 남긴다', () => {
  const { maskPhone, onlyCodeDigits } = loadPhone();
  assert.equal(maskPhone('+821012345678'), '010-****-5678');
  assert.equal(onlyCodeDigits('12 34-56'), '123456');
  assert.equal(onlyCodeDigits('１２３４５６７'), '123456');
  assert.equal(onlyCodeDigits('abc'), '');
});

test('Supabase 오류를 할 일로 바꾼다(문자 서비스 준비 전·너무 잦음·틀린 숫자·이미 쓴 번호)', () => {
  const { phoneErrorKind, PHONE_ERROR_TEXT } = loadPhone();
  assert.equal(phoneErrorKind({ code: 'phone_provider_disabled' }), 'not_ready');
  assert.equal(phoneErrorKind({ code: 'sms_send_failed' }), 'not_ready');
  assert.equal(phoneErrorKind({ message: 'Unsupported phone provider' }), 'not_ready');
  assert.equal(phoneErrorKind({ code: 'over_sms_send_rate_limit' }), 'too_many');
  assert.equal(phoneErrorKind({ status: 429 }), 'too_many');
  assert.equal(phoneErrorKind({ code: 'otp_expired' }), 'wrong_code');
  assert.equal(phoneErrorKind({ message: 'Token has expired or is invalid' }), 'wrong_code');
  assert.equal(phoneErrorKind({ code: 'phone_exists' }), 'taken');
  assert.equal(phoneErrorKind({ message: 'A user with this phone number has already been registered' }), 'taken');
  assert.equal(phoneErrorKind(new Error('boom')), 'unknown');
  assert.equal(phoneErrorKind(null), 'unknown');
  for (const text of Object.values(PHONE_ERROR_TEXT)) assert.ok(text.length > 10 && !/error|Error|null|undefined/.test(text), text);
});

test('문자 보내기·확인·서버 반영이 정해진 길로만 간다(phone_change, doit-connect phone_sync)', async () => {
  const calls = [];
  const { sendPhoneCode, confirmPhoneCode, syncPhoneVerification } = loadPhone(calls);
  await sendPhoneCode('+821012345678');
  await confirmPhoneCode('+821012345678', '123456');
  assert.equal(await syncPhoneVerification('u1'), true);
  assert.deepEqual(calls.map((c) => c[0]), ['updateUser', 'verifyOtp', 'doit-connect']);
  assert.equal(calls[1][1].type, 'phone_change');
  assert.equal(JSON.stringify(calls[2][1]), JSON.stringify({ action: 'phone_sync' }), '화면은 인증됐다는 값을 보내지 않는다');
});

test('인증 화면: 데모 대기(setTimeout 가짜 완료)가 없고, 실제 확인 뒤에만 끝 화면', () => {
  const s = read(VERIFY);
  assert.ok(!/데모 본인인증|본인인증 완료 \(데모\)|setVerifying/.test(s), '예전 데모 흐름 제거');
  assert.match(s, /await withTimeout\(confirmPhoneCode\(step\.phone, code\)/);
  assert.match(s, /setStep\(\{ kind: "done" \}\)/);
  assert.match(s, /나중에 할게요/, '빠져나갈 문');
  assert.match(s, /autoComplete="one-time-code"/, '문자 숫자 자동 채우기');
  assert.ok(!/console\./.test(s + read('src/doit/lib/phoneVerify.ts')), '번호를 로그에 남기지 않는다');
  assert.match(s, /const SAFE_NEXT = \/\^\\\/doit\\\//, '돌아갈 주소는 앱 안(/doit/…)만');
});

test('인증 화면이 실제로 열린다(라우터) · 연결 화면 전화 인증 칸이 인증 화면으로 간다', () => {
  const routes = read('src/doit/routes.tsx');
  assert.match(routes, /\{ path: "verify", element: <Verify \/> \}/);
  assert.match(read(ASLEEP), /to: '\/doit\/verify\?next=\/doit\/connections'/);
  assert.ok(!/detail: r\.phone_verified \? '완료' : '준비 중'/.test(read(ASLEEP)), '「준비 중」 표시 제거');
});

test('내 연결: 상대 정보는 서버가 revealed 로 보낸 뒤에만 그린다 · 저장 금지 안내 · 그만하기 확인', () => {
  const s = read(MATCHES);
  assert.match(s, /\{match\.revealed && match\.partner && <header/);
  assert.match(s, /match\.revealed && match\.partner\s*\n?\s*\? <p><span>\{match\.partner\.nickname\}의 답/);
  assert.match(s, /연락처·링크는 보낼 수 없어요/);
  assert.match(s, /그만하면 서로의 이야기가 더 보이지 않고, 다시 이어지지 않아요/);
  assert.match(s, /차단하고 신고할게요/);
  assert.match(s, /계속할게요/, '확인 창에도 빠져나갈 문');
  assert.match(read(ASLEEP), /<ConnectionMatches userId=\{user\.id\} \/>/);
});

test('연결 승인 메뉴: 관리자 화면에 있고, 이야기 내용은 보여 주지 않는다', () => {
  assert.match(read('src/doit/pages/do-it/admin/meta.ts'), /key: "connections", label: "연결 승인"/);
  assert.match(read('src/doit/pages/do-it/admin/components/AdminShell.tsx'), /case "connections":\s*\n\s*return <ConnectionApprovals \/>;/);
  const v = read('src/doit/pages/do-it/admin/views/ConnectionApprovals.tsx');
  assert.ok(!/messages\.map|\.body\b/.test(v), '관리자 화면에 이야기 본문 없음');
});

test('새 화면 문구에 쓰지 않는 단어가 없다', () => {
  const banned = /데이팅|소개팅|궁합|점술|심리치료|성격검사/;
  for (const p of [VERIFY, MATCHES, ASLEEP, 'src/doit/pages/do-it/admin/views/ConnectionApprovals.tsx', 'src/doit/lib/phoneVerify.ts']) assert.ok(!banned.test(read(p)), p);
});
