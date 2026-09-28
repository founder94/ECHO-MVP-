// ADMIN WEB 화면·빌드 분리 원본 검사 — 2026-09-28 대표 「ADMIN WEB FINAL BUILD ORDER」.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const adminFiles = ['src/admin/AdminApp.tsx', ...readdirSync(new URL('../src/admin/views/', import.meta.url)).map((f) => `src/admin/views/${f}`), 'src/admin/ui.tsx', 'src/admin/releaseStatus.ts'];

test('메뉴 14개 · 모두 한국어(영어 메인 이름 0)', () => {
  const src = read('src/admin/AdminApp.tsx');
  const labels = [...src.matchAll(/\{ key: '([a-z]+)', label: '([^']+)' \}/g)].map((m) => m[2]);
  assert.deepEqual(labels, ['대시보드', '사용자', 'AI 대화', '사용자 확정 상태', '프로필', '연결/매칭', '신고·차단', '서비스 상태', '배포 관리', '오류·실패', '알림', '운영 설정', '감사 기록', '데이터 확인']);
  for (const l of labels) assert.doesNotMatch(l.replace(/^AI /, ''), /[A-Za-z]/, l);
});

test('화면 제목(섹션·h1)에 영어 단어 제목 0 — 허용: 고유 이름(Google · ECHO · DO IT · AI · QA · PASS · HOLD)만', () => {
  const allowed = /^(Google|ECHO|DO|IT|AI|QA|PASS|HOLD|iPhone|Galaxy|Chrome|WebKit|Netlify|Supabase)$/;
  for (const f of adminFiles) {
    const src = read(f);
    for (const m of src.matchAll(/title="([^"]+)"|title=\{`([^`]+)`\}|<h[123][^>]*>([^<{]+)/g)) {
      const text = m[1] ?? m[2] ?? m[3];
      const words = text.match(/[A-Za-z]{2,}/g) ?? [];
      for (const w of words) assert.match(w, allowed, `${f}: 「${text}」`);
    }
  }
});

test('가짜 구현 금지: 값이 없으면 숫자 대신 「데이터 없음 · 연결 필요 · 확인 필요」 · 0 으로 바꾸지 않음', () => {
  const ui = read('src/admin/ui.tsx');
  assert.match(ui, /value === null \|\| value === undefined/);
  assert.match(ui, /'데이터 없음' \| '연결 필요' \| '확인 필요'/);
  const all = adminFiles.map(read).join('\n');
  assert.doesNotMatch(all, /\?\? 0\}/, '화면에서 없는 값을 0 으로 채우지 않음');
  assert.doesNotMatch(all, /Math\.random|mock|dummy|lorem|sample(Data|Rows|Users|Sessions)/i, "가짜 자료 0");
  assert.match(read('src/admin/views/Dashboard.tsx'), /실제 만남[\s\S]{0,80}데이터 없음/);
  assert.match(read('src/admin/views/Ops.tsx'), /Netlify[\s\S]{0,120}연결 필요/);
});

test('관리자 화면에 계정 삭제·영구정지 버튼 없음 · 연결 승인은 확인 창 뒤', () => {
  const all = adminFiles.map(read).join('\n');
  assert.doesNotMatch(all, /delete_me|delete_user|>\s*(계정 삭제|영구\s*정지|정지하기)\s*</);
  assert.match(read('src/admin/views/Connect.tsx'), /window\.confirm\(/);
});

test('보호: 화면은 로그인 → profiles.role 확인 · 관리자 아니면 자료 호출 없이 「관리자 권한이 없습니다」', () => {
  const src = read('src/admin/AdminApp.tsx');
  assert.match(src, /from\('profiles'\)\.select\('role'\)\.eq\('id', user\.id\)/);
  assert.match(src, /관리자 권한이 없습니다/);
  const denied = src.slice(src.indexOf("gate.kind === 'denied'"), src.indexOf('return <Shell'));
  assert.doesNotMatch(denied, /adminCall|<Dashboard/, '거절 화면은 관리자 자료를 부르지 않음');
});

test('빌드 분리: 관리자 빌드 = 입구 src/admin/main.tsx · 검색 제외 · 설치(manifest) 없음 · 앱·브랜드 빌드에는 관리자 화면 없음', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /siteRole === "admin"\) return ADMIN_HTML/);
  assert.match(vite, /<meta name="robots" content="noindex, nofollow" \/>/);
  assert.match(vite, /src="\/src\/admin\/main\.tsx"/);
  const adminHtml = vite.slice(vite.indexOf('const ADMIN_HTML'), vite.indexOf('const siteRolePlugin'));
  assert.doesNotMatch(adminHtml, /manifest|apple-touch-icon|og:/);
  assert.match(vite, /"manifest\.webmanifest", "pwa", "brand"/);
  const router = read('src/router/config.tsx');
  assert.match(router, /ROLE === 'app'\s*\n?\s*\? \[\{ path: '\/admin', element: <AdminRedirect \/> \}, \{ path: '\/admin\/\*', element: <AdminRedirect \/> \}\]/);
  const doit = read('src/doit/routes.tsx');
  assert.match(doit, /APP_BUILD \? null : lazy\(\(\) => import\("@\/doit\/pages\/do-it\/admin\/page"\)\)/);
  assert.match(read('src/lib/siteRole.ts'), /'https:\/\/admin\.do-it\.company'/);
  assert.doesNotMatch(read('src/lib/siteRole.ts') + vite, /echo\.do-it\.company/);
});
