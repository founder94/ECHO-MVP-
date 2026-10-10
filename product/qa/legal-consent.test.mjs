// 약관 동의 순수 로직 검사(가짜 서버·가짜 브라우저 저장소). 실제 서버·실기기 검사가 아니다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const plain = (v) => JSON.parse(JSON.stringify(v));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadTs(rel, extra = {}) {
  const src = readFileSync(path.join(root, rel), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const requireStub = (name) => {
    if (name === './documents' || name === '@/lib/legal/documents') return loadTs('src/lib/legal/documents.ts');
    // 2026-10-10: Google 왕복 임시값은 localStorage + 10분 만료(roundtripStorage)로 옮겼다(qa/compat-auth-20261010.test.mjs).
    if (name === '@/lib/auth/roundtripStorage') return loadTs('src/lib/auth/roundtripStorage.ts');
    if (name in extra) return extra[name];
    throw new Error('Unexpected dependency ' + name);
  };
  vm.runInNewContext(js, { module, exports: module.exports, require: requireStub, sessionStorage: globalThis.sessionStorage, localStorage: globalThis.localStorage, Date, JSON, console }, { filename: rel });
  return module.exports;
}

function fakeSessionStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

const docs = loadTs('src/lib/legal/documents.ts');
const gate = loadTs('src/lib/legal/gatePaths.ts');

test('필수 3개(약관·개인정보·만19세)가 전부 켜져야 계속할 수 있다; 마케팅은 선택', () => {
  globalThis.sessionStorage = fakeSessionStorage();
  globalThis.localStorage = fakeSessionStorage();
  const c = loadTs('src/lib/legal/consent.ts');
  assert.equal(c.requiredAllChecked(c.EMPTY_CONSENT), false);
  assert.equal(c.requiredAllChecked({ terms: true, privacy: true, age19: false, marketing: true }), false);
  assert.equal(c.requiredAllChecked({ terms: true, privacy: true, age19: true, marketing: false }), true);
  // 2026-09-25 대표 MASTER §14: 마케팅 발송 기능이 없는 동안 마케팅 항목은 묻지 않는다(MARKETING_ENABLED = false) → 「모두 동의」는 필수 3개, 마케팅 값은 늘 false.
  assert.equal(c.MARKETING_ENABLED, false);
  assert.equal(c.allChecked({ terms: true, privacy: true, age19: true, marketing: false }), true);
  assert.deepEqual(plain(c.setAll(true)), { terms: true, privacy: true, age19: true, marketing: false });
  assert.deepEqual(plain(c.setAll(false)), plain(c.EMPTY_CONSENT));
});

test('동의 메타데이터는 문서 버전과 같은 버전을 쓰고 비밀값을 담지 않는다', () => {
  globalThis.sessionStorage = fakeSessionStorage();
  globalThis.localStorage = fakeSessionStorage();
  const c = loadTs('src/lib/legal/consent.ts');
  const meta = c.consentMetadata({ terms: true, privacy: true, age19: true, marketing: true }, new Date('2026-09-21T10:00:00Z'));
  assert.deepEqual(plain(meta), { consent_version: docs.LEGAL_VERSION, consented_at: '2026-09-21T10:00:00.000Z', marketing_opt_in: true });
  assert.deepEqual(Object.keys(meta).sort(), ['consent_version', 'consented_at', 'marketing_opt_in']);
  assert.equal(c.readConsentMetadata({ consent_version: 'v1.0', consented_at: 'x' }).marketing_opt_in, false);
  assert.equal(c.readConsentMetadata({ display_name: '사용자' }), null);
  assert.equal(c.readConsentMetadata(null), null);
});

test('Google 이동 전 임시 보관 → 돌아온 뒤 한 번만 꺼내지고, 다른 버전은 버린다', () => {
  globalThis.sessionStorage = fakeSessionStorage();
  globalThis.localStorage = fakeSessionStorage();
  const c = loadTs('src/lib/legal/consent.ts');
  c.rememberPendingConsent({ terms: true, privacy: true, age19: true, marketing: false });
  const first = c.consumePendingConsent();
  assert.equal(first?.consent_version, c.CONSENT_VERSION);
  assert.equal(c.consumePendingConsent(), null, '두 번째 꺼내기는 비어 있어야 한다');
  globalThis.sessionStorage.setItem('echo:consent-pending', JSON.stringify({ consent_version: 'v0.9', consented_at: 'x', marketing_opt_in: false }));
  assert.equal(c.consumePendingConsent(), null, '다른 버전은 무시');
  globalThis.sessionStorage.setItem('echo:consent-pending', '{broken');
  assert.equal(c.consumePendingConsent(), null, '깨진 값은 무시');
});

function fakeSupabase(state) {
  const calls = [];
  const from = (table) => {
    assert.equal(table, 'profiles');
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => { calls.push('select'); return state.selectError ? { data: null, error: { message: 'x' } } : { data: state.row, error: null }; } }) }),
      update: (values) => ({ eq: async () => { calls.push('update:' + values.consent_version); if (state.updateError) return { error: { message: 'x' }, count: null }; if (state.row) { state.row = { ...state.row, ...values }; return { error: null, count: 1 }; } return { error: null, count: 0 }; } }),
      insert: async (values) => { calls.push('insert'); if (state.insertError) return { error: state.insertError }; state.row = { ...values }; return { error: null }; },
    };
  };
  return { client: { from, auth: { updateUser: async (arg) => { calls.push('updateUser'); state.meta = arg.data; return { data: {}, error: null }; } } }, calls, state };
}

test('서버 동의 상태: 현재 버전=ok, 다른 버전/없음=required, 조회 실패=unknown(막지 않음)', async () => {
  globalThis.sessionStorage = fakeSessionStorage();
  globalThis.localStorage = fakeSessionStorage();
  const c = loadTs('src/lib/legal/consent.ts');
  assert.equal(await c.fetchConsentStatus(fakeSupabase({ row: { consent_version: c.CONSENT_VERSION } }).client, 'u1'), 'ok');
  assert.equal(await c.fetchConsentStatus(fakeSupabase({ row: { consent_version: 'v0.9' } }).client, 'u1'), 'required');
  assert.equal(await c.fetchConsentStatus(fakeSupabase({ row: { consent_version: null } }).client, 'u1'), 'required');
  assert.equal(await c.fetchConsentStatus(fakeSupabase({ row: null }).client, 'u1'), 'required');
  assert.equal(await c.fetchConsentStatus(fakeSupabase({ row: null, selectError: true }).client, 'u1'), 'unknown');
});

test('동의 저장: 행이 있으면 update, 없으면 insert, 중복(23505)이면 update 재시도, 실패는 문구로 돌려준다', async () => {
  globalThis.sessionStorage = fakeSessionStorage();
  globalThis.localStorage = fakeSessionStorage();
  const c = loadTs('src/lib/legal/consent.ts');
  const meta = c.consentMetadata({ terms: true, privacy: true, age19: true, marketing: true });

  const a = fakeSupabase({ row: { consent_version: null } });
  assert.equal(await c.persistConsent(a.client, 'u1', meta), null);
  assert.equal(a.state.row.consent_version, c.CONSENT_VERSION);
  assert.deepEqual(a.calls, ['update:' + c.CONSENT_VERSION, 'updateUser']);
  assert.equal(a.state.meta.marketing_opt_in, true);

  const b = fakeSupabase({ row: null });
  assert.equal(await c.persistConsent(b.client, 'u1', meta), null);
  assert.deepEqual(b.calls, ['update:' + c.CONSENT_VERSION, 'insert', 'updateUser']);
  assert.equal(b.state.row.id, 'u1');

  const d = fakeSupabase({ row: null, insertError: { code: '23505' } });
  assert.equal(await c.persistConsent(d.client, 'u1', meta), null);
  assert.deepEqual(d.calls, ['update:' + c.CONSENT_VERSION, 'insert', 'update:' + c.CONSENT_VERSION, 'updateUser']);

  const e = fakeSupabase({ row: { consent_version: null }, updateError: true });
  const msg = await c.persistConsent(e.client, 'u1', meta);
  assert.match(msg, /저장하지 못했어요/);
  assert.ok(!e.calls.includes('updateUser'), '실패했으면 메타데이터를 쓰지 않는다');
});

test('동의 문(ConsentGate)이 막지 않는 경로: 홈·문서·로그인·가입·인증 복귀·운영센터 / 막는 경로: 제품 화면', () => {
  for (const p of ['/', '/home', '/do-it/landing', '/legal/terms', '/legal/consent', '/login', '/signup', '/auth/callback', '/admin/mobile', '/coming-soon/story']) {
    assert.equal(gate.isConsentGateOpenPath(p), true, p);
  }
  for (const p of ['/doit/start-journey', '/doit/conversation', '/weather', '/story-start', '/step/2', '/report', '/locker', '/doit/settings']) {
    assert.equal(gate.isConsentGateOpenPath(p), false, p);
  }
});

test('문서: 버전·시행일이 있고, 금지어(데이팅·소개팅·궁합)를 서비스 설명으로 쓰지 않으며, 지어낸 회사 정보가 없다', () => {
  for (const doc of [docs.TERMS_DOCUMENT, docs.PRIVACY_DOCUMENT]) {
    assert.equal(doc.version, docs.LEGAL_VERSION);
    assert.match(doc.effectiveDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(doc.sections.length >= 8, doc.key);
  }
  const terms = JSON.stringify(docs.TERMS_DOCUMENT);
  // 2026-10-05 대표 승인 「4,900원 삭제」: 약관에 리포트 가격을 적지 않는다(지금 판매하는 유료 콘텐츠 없음 · 결제 전 가격 안내)
  assert.ok(!/4,?900\s*원/.test(terms), '약관에 4,900원 문구 0');
  assert.ok(terms.includes('현재 판매하는 유료 콘텐츠가 없습니다'));
  assert.ok(!terms.includes('Stripe'));
  assert.ok(terms.includes('[대표 입력: 사업자등록번호]'), '모르는 값은 지어내지 않는다');
  assert.equal(docs.COMPANY.email, '0423doit@gmail.com');
});

test('2026-10-05 대표 「4,900원 영구 삭제」: 앱·서버 코드의 글·주석에 4,900 0(결제 기능 안 숫자 상수 두 곳만 남음) · 결제 화면 주소 = 앱 홈', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : [p]; });
  const root = new URL('../', import.meta.url).pathname;
  const hits = [...walk(`${root}src`), ...walk(`${root}supabase/functions`)].filter((p) => /\.(tsx?|css|html|json)$/.test(p))
    .flatMap((p) => readFileSync(p, 'utf8').split('\n').map((l, i) => [p.slice(root.length), i + 1, l]).filter(([, , l]) => /4,?900|4천9백|사천구백/.test(l)));
  const allowed = hits.filter(([p, , l]) => (p === 'src/lib/echo/api.ts' && /^export const REPORT_PRICE_KRW = 4900;$/.test(l)) || (p === 'supabase/functions/echo-payment/index.ts' && /^const PRICE_KRW = 4900;$/.test(l)));
  assert.equal(hits.length, allowed.length, JSON.stringify(hits.filter((h) => !allowed.includes(h))));
  assert.match(readFileSync(`${root}src/router/config.tsx`, 'utf8'), /\{ path: '\/payment', element: <Navigate to="\/doit\/home" replace \/> \}/);  // Codex P2(4184535769): 관리자 체크 표도 결제 화면을 「PASS(보임)」로 두지 않는다 — 숨김 = 해당 없음
  const row = readFileSync(`${root}src/doit/pages/do-it/admin/views/FeatureChecklist.tsx`, 'utf8').split('\n').map((l, i, a) => l + a[i + 1]).find((l) => l.trimStart().startsWith('{ name: "결제('));
  assert.match(row, /결제 화면은 숨겨 두었어요/); assert.match(row, /ui: "NA"/); assert.doesNotMatch(row, /ui: "PASS"/);
});
