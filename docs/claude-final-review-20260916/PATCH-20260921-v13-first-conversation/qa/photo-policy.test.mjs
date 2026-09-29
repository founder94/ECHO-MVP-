// 사진 정책(필수 3장·종류·완료 규칙) 검사 — 가짜 데이터. 서버·저장소·AI 호출 없음.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(rel, deps) {
  const src = readFileSync(path.join(root, rel), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: (name) => { if (name in deps) return deps[name]; throw new Error('Unexpected dependency ' + name); } }, { filename: rel });
  return module.exports;
}
const policy = load('src/doit/lib/photoPolicy.ts', {
  '@/lib/supabase/client': { supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, functions: { invoke: async () => { throw new Error('must not be called'); } } } },
  '@/doit/lib/photoStorage': { PHOTO_SLOT_COUNT: 6 },
});

test('칸 6개 = 필수 3(전신·패션·취미) + 자유 3. 슬롯 번호가 곧 종류다', () => {
  assert.equal(policy.PHOTO_SLOTS.length, 6);
  assert.deepEqual([...policy.PHOTO_REQUIRED_SLOTS], [0, 1, 2]);
  assert.equal(policy.PHOTO_REQUIRED_COUNT, 3);
  assert.equal(policy.categoryForSlot(0), 'full_body');
  assert.equal(policy.categoryForSlot(1), 'fashion');
  assert.equal(policy.categoryForSlot(2), 'hobby');
  assert.equal(policy.categoryForSlot(5), 'free');
  assert.equal(policy.categoryForSlot(99), 'free');
});

test('완료 = 필수 3칸 저장 + 대표 1장. 자유 칸은 없어도 되고, 6장 있어도 대표가 없으면 미완료', () => {
  const p = (slot, isPrimary = false) => ({ slot, isPrimary });
  assert.equal(policy.photoSetComplete([p(0, true), p(1), p(2)]), true);
  assert.equal(policy.photoSetComplete([p(0), p(1), p(2)]), false, '대표 없음');
  assert.equal(policy.photoSetComplete([p(0, true), p(1), p(3), p(4), p(5)]), false, '취미(2) 없음');
  assert.equal(policy.photoSetComplete([p(0), p(1), p(2), p(3), p(4), p(5, true)]), true, '자유 칸이 대표여도 됨');
  assert.equal(policy.photoSetComplete([]), false);
  assert.equal(policy.requiredFilledCount([p(0), p(5)]), 1);
});

test('AI 판별 호출: 로그인 세션이 없으면 서버를 부르지 않고 unchecked(막지 않음)', async () => {
  const result = await policy.requestPhotoCheck('u1', '00000000-0000-0000-0000-000000000000', 0);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { verdict: 'unchecked', reasons: [] });
});

test('AI 판별 응답 해석: 알 수 없는 판정은 unchecked, 이유 코드는 사용자 문장으로 바뀐다', async () => {
  const withServer = (data) => load('src/doit/lib/photoPolicy.ts', {
    '@/lib/supabase/client': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' }, access_token: 't' } } }) }, functions: { invoke: async () => ({ data, error: null }) } } },
    '@/doit/lib/photoStorage': { PHOTO_SLOT_COUNT: 6 },
  });
  const ok = await withServer({ ok: true, verdict: 'ok', reasons: [], category: 'full_body' }).requestPhotoCheck('u1', '00000000-0000-0000-0000-000000000000', 0);
  assert.equal(ok.verdict, 'ok');
  const review = await withServer({ ok: true, verdict: 'review', reasons: ['category_mismatch', 'multiple_people'] }).requestPhotoCheck('u1', 'x', 1);
  assert.equal(review.verdict, 'review');
  assert.deepEqual([...review.reasons], ['이 칸의 종류와 달라 보여요.', '여러 사람이 함께 있어요. 나 혼자 나온 사진이 좋아요.']);
  const weird = await withServer({ ok: true, verdict: 'perfect' }).requestPhotoCheck('u1', 'x', 1);
  assert.equal(weird.verdict, 'unchecked');
  const notOk = await withServer({ ok: false, code: 'AI_ERROR' }).requestPhotoCheck('u1', 'x', 1);
  assert.equal(notOk.verdict, 'unchecked');
});

test('서버 함수 초안: 본인 행·슬롯 검사, 서명 주소 60초, 이미지·주소를 로그에 남기지 않는다', () => {
  const server = readFileSync(path.join(root, 'supabase/functions/doit-photo-check/index.ts'), 'utf8');
  assert.ok(server.includes('row.user_id !== user.id'));
  assert.ok(server.includes('SIGNED_URL_SECONDS = 60'));
  assert.ok(server.includes('sb.auth.getUser()'));
  assert.ok(!/logDiag\([^)]*(signedUrl|imageUrl|storage_path)/.test(server), '서명 주소·경로를 로그에 남기지 않는다');
  assert.ok(server.includes('신원·나이·매력·성격을 추측하거나 평가하지 않는다'));
  assert.ok(server.includes('42703'), '결과 칸이 없으면 건너뛴다(초안 SQL 실행 전)');
});
