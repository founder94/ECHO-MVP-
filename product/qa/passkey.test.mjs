// 얼굴·지문 로그인(패스키) 약속 (대표 2026-09-24 "얼굴로그인 진행해").
// 실제 브라우저 전 과정(가상 얼굴 인식 장치 + 가짜 로그인 서버)은 scratchpad/passkey-harness 에서 23/23 — 여기서는 순수 함수·화면 약속·보안 약속을 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = (p) => readFileSync(p, 'utf8');
const LIB = 'src/lib/auth/passkey.ts';

function load(stubAuth = {}) {
  const compile = (p) => ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const installExports = {};
  vm.runInNewContext(compile('src/doit/lib/installContext.ts'), { exports: installExports });
  const exports = {};
  const supabase = { auth: { passkey: {}, ...stubAuth } };
  const stubs = { '@/lib/supabase/client': { supabase }, '@/doit/lib/installContext': installExports };
  vm.runInNewContext(compile(LIB), { exports, require: (n) => { if (!(n in stubs)) throw new Error(`Unexpected dependency ${n}`); return stubs[n]; } });
  return exports;
}

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  galaxyChrome: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  samsungInternet: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  kakao: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.0',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0',
};

test('기기·브라우저 판단: 아이폰 사파리·갤럭시 크롬·삼성 인터넷·홈 화면 앱 = 가능, 앱 안 브라우저 = 밖으로, 미지원 = 숨김', () => {
  const { passkeySupport } = load();
  const env = (ua, extra = {}) => ({ ua, standalone: false, maxTouchPoints: 5, hasWebAuthn: true, ...extra });
  assert.equal(passkeySupport(env(UA.iphoneSafari)), 'ok');
  assert.equal(passkeySupport(env(UA.galaxyChrome)), 'ok');
  assert.equal(passkeySupport(env(UA.samsungInternet)), 'ok');
  assert.equal(passkeySupport(env(UA.iphoneSafari, { standalone: true })), 'ok', '홈 화면에 받은 앱');
  for (const ua of [UA.kakao, UA.androidWebview, UA.instagram]) assert.equal(passkeySupport(env(ua)), 'in-app', ua);
  assert.equal(passkeySupport(env(UA.galaxyChrome, { hasWebAuthn: false })), 'unsupported');
});

test('오류를 사람이 할 일로 바꾼다(서버 꺼짐·등록 없음·취소·이미 등록·개수 초과·시간 초과·이메일 미인증)', () => {
  const { passkeyErrorKind, PASSKEY_ERROR_TEXT } = load();
  const cases = [
    [{ code: 'passkey_disabled' }, 'disabled'],
    [{ code: 'webauthn_credential_not_found' }, 'not_found'],
    [{ code: 'webauthn_credential_exists' }, 'exists'],
    [{ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' }, 'exists'],
    [{ code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', cause: { name: 'InvalidStateError' } }, 'exists'],
    [{ code: 'too_many_passkeys' }, 'too_many'],
    [{ code: 'webauthn_challenge_expired' }, 'expired'],
    [{ code: 'email_not_confirmed' }, 'unconfirmed'],
    [{ code: 'ERROR_CEREMONY_ABORTED' }, 'cancelled'],
    [{ code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', cause: { name: 'NotAllowedError' } }, 'cancelled'],
    [{ name: 'NotAllowedError', message: 'The operation either timed out or was not allowed.' }, 'cancelled'],
    [new Error('boom'), 'unknown'],
    [null, 'unknown'],
    ['문자열', 'unknown'],
  ];
  for (const [err, kind] of cases) assert.equal(passkeyErrorKind(err), kind, JSON.stringify(err));
  for (const [kind, text] of Object.entries(PASSKEY_ERROR_TEXT)) {
    assert.ok(text.length > 15, kind);
    assert.doesNotMatch(text, /error|Error|null|undefined|webauthn|passkey/i, `${kind}: 기계 말 없음`);
  }
  // 빠져나갈 문: 로그인이 막히는 경우는 기존 로그인으로 안내한다.
  for (const k of ['cancelled', 'disabled', 'not_found', 'unknown']) assert.match(PASSKEY_ERROR_TEXT[k], /이메일|Google|아래 방법|로그인한 뒤/, k);
});

test('로그인·등록 결과: 서버 오류·예외·세션 없음 모두 실패로, 세션이 있을 때만 성공', async () => {
  let lib = load({ signInWithPasskey: async () => ({ data: { session: { access_token: 't' }, user: {} }, error: null }) });
  assert.equal(JSON.stringify(await lib.signInWithFace()), JSON.stringify({ ok: true, kind: null }));
  lib = load({ signInWithPasskey: async () => ({ data: { session: null, user: null }, error: null }) });
  assert.equal((await lib.signInWithFace()).ok, false, '세션 없으면 성공으로 치지 않는다');
  lib = load({ signInWithPasskey: async () => ({ data: null, error: { code: 'passkey_disabled' } }) });
  assert.equal((await lib.signInWithFace()).kind, 'disabled');
  lib = load({ signInWithPasskey: async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }); } });
  assert.equal((await lib.signInWithFace()).kind, 'cancelled', '예외도 멈추지 않고 안내로');
  lib = load({ registerPasskey: async () => ({ data: null, error: { code: 'webauthn_credential_exists' } }) });
  assert.equal((await lib.registerFace()).kind, 'exists');
  lib = load({ passkey: { list: async () => ({ data: [{ id: 'p1', created_at: '2026-09-24T00:00:00Z' }], error: null }), delete: async () => ({ data: null, error: null }) } });
  const out = await lib.listFaces();
  assert.equal(out.devices[0].name, '이름 없는 기기');
  assert.equal((await lib.removeFace('p1')).ok, true);
});

test('보안: 얼굴 로그인 코드는 로그·브라우저 저장소에 아무것도 남기지 않고, 설정 없이도 기존 로그인이 남는다', () => {
  const lib = read(LIB);
  const settings = read('src/doit/pages/do-it/settings/FaceLoginSettings.tsx');
  const login = read('src/pages/login/page.tsx');
  for (const s of [lib, settings]) {
    assert.doesNotMatch(s, /console\.|localStorage|sessionStorage/);
  }
  assert.doesNotMatch(login, /console\./);
  // 로그인 화면: 지원될 때만 버튼, 기존 로그인 버튼 그대로.
  assert.match(login, /\{PASSKEY_LOGIN_ENABLED && faceSupport === 'ok' && \(/, '대표 2026-09-25: 서버가 켜지기 전까지 얼굴·지문 로그인 버튼은 숨긴다');
  assert.match(read('src/lib/auth/passkey.ts'), /export const PASSKEY_LOGIN_ENABLED = false;/);
  assert.match(login, /Google로 계속하기/);
  assert.match(login, /type="submit"/);
  assert.match(login, /navigate\(from, \{ replace: true \}\);\n      return;/, '얼굴 로그인 성공 뒤 이메일 로그인과 같은 곳으로');
  // 설정: 로그인한 사람만, 지우기는 한 번 더 묻는다.
  assert.match(read('src/doit/pages/do-it/settings/page.tsx'), /\{!loading && user && PASSKEY_LOGIN_ENABLED && <FaceLoginSettings \/>\}/);
  assert.match(settings, /그대로 둘게요/);
});

test('로그인 부품: 얼굴 로그인이 들어간 판(2.105.0 이상)으로 고정돼 있다', () => {
  const pkg = JSON.parse(read('package.json'));
  const v = pkg.dependencies['@supabase/supabase-js'];
  assert.match(v, /^\d+\.\d+\.\d+$/, '정확한 판으로 고정(^ 없음)');
  const [maj, min] = v.split('.').map(Number);
  assert.ok(maj > 2 || (maj === 2 && min >= 105), v);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages['node_modules/@supabase/supabase-js'].version, v);
  assert.ok(!Object.keys(lock.packages).some((k) => k.startsWith('../')), '설치 목록에 다른 폴더 주소가 섞여 있지 않다');
});

test('쓰지 않는 단어가 새 화면에 없다', () => {
  const banned = /데이팅|소개팅|궁합|점술|심리치료|성격검사/;
  for (const p of [LIB, 'src/doit/pages/do-it/settings/FaceLoginSettings.tsx', 'src/pages/login/page.tsx']) assert.doesNotMatch(read(p), banned, p);
});
