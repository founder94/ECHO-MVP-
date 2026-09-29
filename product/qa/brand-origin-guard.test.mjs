// BRAND → APP 링크 P0(2026-09-28 · Galaxy 실기기 do-it.company 「모바일/시작」 → Netlify 「Site not found」) 재발 방지 검사.
// 실측 원인: 운영 do-it.company 가 QA BRAND 빌드(index-DSyzgFVO.js · VITE_APP_ORIGIN=https://thriving-melba-b1449a.netlify.app · QA Supabase)를 내보내고 있었다.
//           thriving-melba 는 echo-app-qa 로 이름이 바뀌어 404 → 모든 앱 이동(버튼·_redirects 302)이 깨짐.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINS, brandOriginProblem, targetOf } from '../scripts/brand-origin-guard.mjs';

const PROD_SB = 'https://zyyhhxyupizcqhxqnxuu.supabase.co';
const QA_SB = 'https://mutniujeiyujhkobadkd.supabase.co';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('재현: 문제의 빌드 설정(QA Supabase + thriving-melba 앱 주소)은 이제 빌드가 막힌다', () => {
  const p = brandOriginProblem({ siteRole: 'brand', supabaseUrl: QA_SB, appOrigin: 'https://thriving-melba-b1449a.netlify.app', brandOrigin: 'https://thriving-melba-b1449a.netlify.app' });
  assert.match(p, /사라진 옛 QA 주소/);
});

test('운영 BRAND: 앱 = app.do-it.company 만 · QA 앱 주소가 섞이면 막힘', () => {
  assert.equal(brandOriginProblem({ siteRole: 'brand', supabaseUrl: PROD_SB, appOrigin: ORIGINS.prod.app, brandOrigin: ORIGINS.prod.brand, adminOrigin: ORIGINS.prod.admin }), null);
  assert.equal(brandOriginProblem({ siteRole: 'brand', supabaseUrl: PROD_SB }), null, '비우면 코드 기본값 = 운영 주소');
  for (const bad of ['https://echo-app-qa.netlify.app', 'https://thriving-melba-b1449a.netlify.app', 'https://app.do-it.company.evil.com', 'http://app.do-it.company']) {
    assert.ok(brandOriginProblem({ siteRole: 'brand', supabaseUrl: PROD_SB, appOrigin: bad }), bad);
  }
  assert.ok(brandOriginProblem({ siteRole: 'brand', supabaseUrl: PROD_SB, adminOrigin: ORIGINS.qa.admin }));
});

test('QA BRAND: 앱 = echo-app-qa 만 · 운영 주소가 섞이거나 비어 있으면 막힘(비우면 운영으로 샘)', () => {
  assert.equal(brandOriginProblem({ siteRole: 'brand', supabaseUrl: QA_SB, appOrigin: ORIGINS.qa.app, brandOrigin: ORIGINS.qa.brand, adminOrigin: ORIGINS.qa.admin }), null);
  assert.match(brandOriginProblem({ siteRole: 'brand', supabaseUrl: QA_SB }), /비어 있음/);
  assert.match(brandOriginProblem({ siteRole: 'brand', supabaseUrl: QA_SB, appOrigin: ORIGINS.prod.app, brandOrigin: ORIGINS.qa.brand, adminOrigin: ORIGINS.qa.admin }), /QA 주소가 아님/);
});

test('BRAND 역할만 잠근다(APP · ADMIN 빌드는 이 검사로 바뀌지 않음) · 대상 판별은 Supabase 주소로만', () => {
  assert.equal(brandOriginProblem({ siteRole: 'app', supabaseUrl: PROD_SB, appOrigin: ORIGINS.qa.app }), null);
  assert.equal(brandOriginProblem({ siteRole: 'admin', supabaseUrl: QA_SB }), null);
  assert.equal(targetOf(PROD_SB), 'prod');
  assert.equal(targetOf(QA_SB), 'qa');
  assert.equal(targetOf('http://localhost:54321'), 'other');
});

test('vite 설정이 운영 빌드에서 이 검사를 실제로 부른다 · 코드 안 BRAND 링크는 모두 appUrl(빌드 값) 경유 · QA 주소 하드코딩 0', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /import \{ brandOriginProblem \} from "\.\/scripts\/brand-origin-guard\.mjs"/);
  assert.match(vite, /if \(problem\) throw new Error\(`BRAND build blocked: \$\{problem\}`\)/);
  for (const f of ['src/lib/siteRole.ts', 'src/components/DoItBrandHero.tsx', 'src/pages/do-it/landing/components/BrandSections.tsx', 'src/pages/do-it/landing/page.tsx', 'src/pages/do-it/intro/DoItEntry.tsx', 'src/components/ExternalRedirect.tsx', 'vite.config.ts']) {
    assert.doesNotMatch(read(f), /netlify\.app/, `${f}: QA 주소 하드코딩 0`);
  }
  assert.match(read('src/lib/siteRole.ts'), /\|\| 'https:\/\/app\.do-it\.company'/, '빌드 값이 없으면 운영 앱 주소');
});
