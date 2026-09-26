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

// ── v1.2 (대표 2026-09-24 "최종완성하라고"): 연결 동의 · 홈 「내 차례」 · 겹친 말 없는 후보 · 약관 초안 ──
function loadConnectApi(calls = []) {
  const out = ts.transpileModule(read('src/doit/lib/connectApi.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const supabase = { auth: { updateUser: async (x) => { calls.push(['updateUser', x]); return { error: null }; } } };
  const stubs = { '@/lib/supabase/client': { supabase }, '@/doit/lib/understandingApi': { serverFunctionRequest: async (fn, body) => { calls.push([fn, body]); return calls.reply ?? { ok: true }; } } };
  vm.runInNewContext(out, { exports, Date, Number, Math, JSON, Array, require: (n) => { if (!(n in stubs)) throw new Error(`Unexpected dependency ${n}`); return stubs[n]; } });
  return exports;
}

test('v1.2 연결 동의: 화면과 서버의 동의 판이 같고, 동의는 판과 시각을 함께 남긴다', async () => {
  const server = read('supabase/functions/doit-connect/index.ts');
  const serverVersion = server.match(/const CONNECT_CONSENT_VERSION = "([^"]+)"/)?.[1];
  const calls = [];
  const api = loadConnectApi(calls);
  assert.equal(api.CONNECT_CONSENT_VERSION, serverVersion);
  assert.equal(await api.giveConnectConsent(), null);
  const data = calls[0][1].data;
  assert.equal(data.doit_connect_consent_version, serverVersion);
  assert.ok(!Number.isNaN(Date.parse(data.doit_connect_consent_at)));
});

test('v1.2 연결 동의 칸: 서버가 상대에게 보내는 칸을 모두 알리고, 동의 전에는 답 입력창이 없다', () => {
  const s = read(MATCHES);
  const server = read('supabase/functions/doit-connect/index.ts');
  // 서버가 공개 뒤 내려 주는 상대 정보 칸 → 동의 문구에 모두 있어야 한다.
  const partnerBlock = server.slice(server.indexOf('item.partner = {'), server.indexOf('};', server.indexOf('item.partner = {')));
  const shown = { nickname: '닉네임', photo: '대표 사진', bio: '소개', purpose: '고른 만남', answer: '이 질문에 쓴 답' };
  for (const [key, words] of Object.entries(shown)) {
    assert.match(partnerBlock, new RegExp(`\\b${key}`), `서버가 ${key} 를 보낸다`);
    assert.ok(s.includes(words), `동의 문구에 「${words}」`);
  }
  assert.match(s, /\{stage === 'ask' && !consented && <div className="doit-match-consent"/);
  assert.match(s, /\{stage === 'ask' && consented && <>/, '답 입력창은 동의한 뒤에만');
  assert.match(s, /e\.code === 'CONSENT_REQUIRED'\) onConsentLost\(\)/, '서버가 동의를 다시 요구하면 동의 칸으로');
  assert.match(s, /아직 답하고 싶지 않으면 그대로 두셔도 돼요/, '빠져나갈 문');
  assert.match(s, /전화번호와 이메일은 보이지 않아요/);
});

test('v1.2 홈 「내 차례」: 먼저 할 일 하나만, 할 일이 없으면 아무것도 안 그린다', () => {
  const { turnsMessage } = loadConnectApi();
  assert.equal(turnsMessage({ answer: 0, reply: 0, opened: 0 }), null);
  assert.match(turnsMessage({ answer: 1, reply: 3, opened: 1 }).title, /첫 질문/);
  assert.match(turnsMessage({ answer: 2, reply: 0, opened: 0 }).title, /첫 질문 2개/);
  assert.match(turnsMessage({ answer: 0, reply: 2, opened: 1 }).title, /서로 열렸어요/);
  assert.match(turnsMessage({ answer: 0, reply: 1, opened: 0 }).title, /이야기를 보냈어요/);
  const card = read('src/doit/components/feature/ConnectionTurnsCard.tsx');
  assert.match(card, /if \(!message\) return null;/);
  assert.match(card, /\.catch\(\(\) => \{ if \(alive\) setTurns\(null\); \}\)/, '못 불러오면 조용히 숨긴다(홈을 막지 않음)');
  assert.match(card, /to="\/doit\/connections"/);
  assert.match(read('src/doit/pages/do-it/home/page.tsx'), /\{A_STRUCTURE_SERVER_ENABLED && user && <ConnectionTurnsCard userId=\{user\.id\} \/>\}/);
});

test('v1.2 fetchMyTurns: 서버 값이 이상하면 0 으로 읽는다(음수·글자·빈 값)', async () => {
  const calls = [];
  calls.reply = { ok: true, open: '3', turns: { answer: -1, reply: 2.7, opened: null } };
  const api = loadConnectApi(calls);
  const out = await api.fetchMyTurns('u1');
  assert.equal(JSON.stringify(out), JSON.stringify({ open: 0, turns: { answer: 0, reply: 2, opened: 0 } }));
  assert.equal(JSON.stringify(calls[0][1]), JSON.stringify({ action: 'my_turns' }));
});

test('v1.2 연결 승인: 겹친 말 없는 쌍은 표시하고, 두 번 눌러야 noCommonOk 로 승인한다', async () => {
  const v = read('src/doit/pages/do-it/admin/views/ConnectionApprovals.tsx');
  assert.match(v, /<Pill tone="secondary">겹친 말 없음<\/Pill>/);
  assert.match(v, /c\.no_common && confirmKey !== key/, '첫 누름은 확인 단계로만');
  assert.match(v, /decideMatch\(c\.user_a, c\.user_b, decision, decision === "approve" && c\.no_common === true\)/);
  const calls = [];
  const api = loadConnectApi(calls);
  await api.decideMatch('a', 'b', 'approve');
  await api.decideMatch('a', 'b', 'approve', true);
  assert.equal('noCommonOk' in calls[0][1], false, '겹친 쌍 승인에는 확인값을 보내지 않는다');
  assert.equal(calls[1][1].noCommonOk, true);
});

test('v1.2 약관 초안: 연결되면 무엇이 보이는지·전화번호 수집·운영자 확인을 적고, "준비 중" 문장은 뺐다', () => {
  const d = read('src/lib/legal/documents.ts');
  assert.ok(!/사람 연결 기능은 현재 준비 중/.test(d));
  // 2026-09-26 MVP FINAL PATCH: 전화 인증을 아직 제공하지 않아 「지금은 번호를 받지 않음」으로 바로잡았다(도입 시 먼저 알림).
  assert.match(d, /전화 인증: 지금은 제공하지 않아 휴대폰 번호를 받지 않습니다/);
  assert.match(d, /닉네임·대표 사진·소개·고른 만남·첫 답/);
  assert.match(d, /운영자가 직접 확인해 승인합니다/);
  assert.match(d, /문자 발송 업체 — 지금은 없음/, '없는 업체를 지어내지 않는다(도입하면 먼저 적는다)');
  assert.match(d, /export const LEGAL_VERSION = 'v1\.0';/, '판 올리기(재동의)는 대표 결정 — 이번에 바꾸지 않음');
});
