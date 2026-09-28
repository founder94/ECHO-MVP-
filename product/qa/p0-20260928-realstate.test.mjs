// 2026-09-28 대표 실기기(iPhone) P0 세 건 재발 방지 — 실측 근거로 고정.
//  ① STALE_REDIRECT(GF-97): 폐기 도메인이 인증 설정에 남아 Google 로그인 뒤 죽은 사이트로 → Stale Redirect Guard
//  ② REAL_STATE_FAIL(GF-98): 대화를 마친 사용자가 오는 start-journey 선택 화면에 「처음부터 다시 시작하기」 없음
//  ③ DESIGN_SYSTEM_LOCK_IGNORED(GF-99): 화면마다 불투명 흰색·금색 버튼 → 공통 유리 버튼 + 전수 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENVIRONMENTS, allowEntryCovers, oauthRedirectProblems, retiredDomainHits } from '../scripts/oauth-redirect-guard.mjs';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

// ── ① Stale Redirect Guard ────────────────────────────────────────────────
// 2026-09-28 실측(auth.flow_state.referrer): 어떤 redirectTo 를 보내도 QA 는 폐기 주소, 운영은 브랜드 주소로 떨어졌다.
const MEASURED_QA = { siteUrl: 'https://thriving-melba-b1449a.netlify.app', allowList: ['https://thriving-melba-b1449a.netlify.app/', 'https://thriving-melba-b1449a.netlify.app/auth/callback'] };
const MEASURED_PROD = { siteUrl: 'https://do-it.company', allowList: ['https://do-it.company/auth/callback'] };
const TARGET_QA = { siteUrl: 'https://echo-app-qa.netlify.app', allowList: ['https://echo-app-qa.netlify.app/auth/callback', 'https://echo-app-qa.netlify.app/**', 'https://echo-admin-qa.netlify.app/**'] };
const TARGET_PROD = { siteUrl: 'https://app.do-it.company', allowList: ['https://app.do-it.company/auth/callback', 'https://app.do-it.company/**', 'https://admin.do-it.company/**'] };

test('Stale Redirect Guard: 실측한 지금 QA 설정(Site URL·허용 목록이 폐기 주소)은 FAIL — 원인 세 가지를 모두 짚는다', () => {
  const p = oauthRedirectProblems(MEASURED_QA, ENVIRONMENTS.qa);
  assert.ok(p.some((x) => /Site URL 이 APP 주소가 아님/.test(x)));
  assert.ok(p.some((x) => /허용 목록에 https:\/\/echo-app-qa\.netlify\.app\/auth\/callback 없음/.test(x)));
  assert.ok(p.some((x) => /폐기 주소가 남아 있음/.test(x)));
});

test('Stale Redirect Guard: 실측한 지금 운영 설정(Site URL = 브랜드 · 앱 콜백 미허용)도 FAIL', () => {
  const p = oauthRedirectProblems(MEASURED_PROD, ENVIRONMENTS.prod);
  assert.ok(p.some((x) => /Site URL 이 APP 주소가 아님: https:\/\/do-it\.company/.test(x)));
  assert.ok(p.some((x) => /허용 목록에 https:\/\/app\.do-it\.company\/auth\/callback 없음/.test(x)));
});

test('Stale Redirect Guard: 목표 설정(QA·운영)은 PASS · 다른 환경 주소·localhost·옛 미리보기 주소가 섞이면 FAIL', () => {
  assert.deepEqual(oauthRedirectProblems(TARGET_QA, ENVIRONMENTS.qa), []);
  assert.deepEqual(oauthRedirectProblems(TARGET_PROD, ENVIRONMENTS.prod), []);
  assert.ok(oauthRedirectProblems({ ...TARGET_PROD, allowList: [...TARGET_PROD.allowList, 'https://echo-app-qa.netlify.app/**'] }, ENVIRONMENTS.prod).length > 0, 'QA 주소가 운영 허용 목록에');
  assert.ok(oauthRedirectProblems({ ...TARGET_PROD, allowList: [...TARGET_PROD.allowList, 'http://localhost:3000'] }, ENVIRONMENTS.prod).length > 0);
  assert.ok(allowEntryCovers('https://app.do-it.company/**', 'https://app.do-it.company/auth/callback'));
  assert.ok(!allowEntryCovers('https://app.do-it.company/*', 'https://app.do-it.company/a/b'));
  assert.ok(!allowEntryCovers('https://do-it.company/auth/callback', 'https://app.do-it.company/auth/callback'));
});

test('Stale Redirect Guard: 앱 코드의 redirectTo 는 지금 주소(origin)에서 만든다 — 박아 둔 옛 주소 0', () => {
  assert.match(read('src/doit/hooks/useAuth.tsx'), /redirectTo: `\$\{window\.location\.origin\}\$\{base\}\$\{OAUTH_CALLBACK_PATH\}`/);
  // 폐기 도메인은 막는 규칙·검사 안에만(주소로 쓰는 곳 0).
  const allowed = new Set(['scripts/brand-origin-guard.mjs', 'scripts/oauth-redirect-guard.mjs', 'qa/brand-origin-guard.test.mjs', 'qa/p0-20260928-realstate.test.mjs']);
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'supabase')), ...walk(join(ROOT, 'public')), ...walk(join(ROOT, 'scripts'))].filter((f) => /\.(ts|tsx|js|mjs|json|toml|html|css|txt)$|_redirects$|_headers$/.test(f));
  for (const f of files) {
    const rel = f.slice(ROOT.length);
    if (allowed.has(rel)) continue;
    assert.deepEqual(retiredDomainHits(readFileSync(f, 'utf8')), [], `${rel} 에 폐기 도메인`);
  }
});

test('Stale Redirect Guard 가 배포 흐름에 들어가 있다 — 운영 배포는 OAuth 설정 검사 PASS 없이 못 올라간다', () => {
  const wf = readFileSync(join(ROOT, '../.github/workflows/echo-netlify-deploy.yml'), 'utf8');
  assert.match(wf, /oauth-redirect-guard\.mjs prod/);
  assert.match(wf, /oauth-redirect-guard\.mjs qa/);
  assert.match(wf, /melba-b1449a/, '빌드 산출물 폐기 도메인 검사(두 이름 모두 덮는 조각)');
});

// ── ② 실제 상태: start-journey 선택 화면의 「처음부터 다시 시작하기」 ────────────
test('실제 상태(GF-98): 대화를 시작·완료한 사용자가 오는 start-journey 선택 화면에 공통 다시 시작 버튼이 있다', () => {
  const page = read('src/doit/pages/do-it/start-journey/page.tsx');
  const choice = page.slice(page.indexOf('if (step === "conversation-choice")'), page.indexOf('if (step === "profile-build")'));
  assert.match(choice, /대화 다시 보기/, '대표가 본 화면(사진과 소개 채우기 · 대화 다시 보기 · 홈으로)');
  assert.match(choice, /\{\(talkDone \|\| answered > 0\) && user && <RestartConversationButton userId=\{user\.id\} className="echo-restart-pill" \/>\}/);
  // Real-State Replay 에서 찾은 것: 서버 상태를 읽기 전 「대화 시작하기」가 잠깐 보였다 → 읽는 동안에는 행동 버튼 0(홈으로만).
  const loading = choice.slice(choice.indexOf('agentSession === undefined'), choice.indexOf('</section>;') + 11);
  assert.match(loading, /지난 대화를 확인하고 있어요/);
  assert.doesNotMatch(loading, /대화 시작하기|사진과 소개|RestartConversationButton/);
  assert.ok(choice.indexOf('agentSession === undefined') < choice.indexOf('"대화 시작하기"'), '읽는 중 분기가 버튼보다 먼저');
  // 사용자가 도달하는 화면 목록(대화를 시작한 뒤): 모두 공통 버튼을 쓴다.
  for (const f of ['src/doit/pages/do-it/home/page.tsx', 'src/doit/pages/do-it/understanding/page.tsx', 'src/doit/pages/do-it/start-journey/page.tsx']) assert.match(read(f), /<RestartConversationButton /, f);
  assert.match(read('src/doit/components/feature/AsleepConnections.tsx'), /useRestartConversation\(userId\)/);
});

// ── ③ 버튼 시스템 잠금 ─────────────────────────────────────────────────────
const APP_TSX = walk(join(ROOT, 'src')).filter((f) => f.endsWith('.tsx') && !f.includes('/admin') && !f.includes('/pages/do-it/landing/'));
function inlineSolidButtons() {
  const hits = [];
  for (const f of APP_TSX) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<(button|motion\.button)\b/g)) {
      let depth = 0; let i = m.index + m[0].length;
      for (; i < s.length; i++) { const c = s[i]; if (c === '{') depth++; else if (c === '}') depth--; else if (c === '>' && depth === 0) break; }
      const tag = s.slice(m.index, i);
      if (tag.includes('data-visual="art"')) continue; // 카드 그림(타로 카드 뒷면) — 버튼 스타일이 아니라 그림
      const st = tag.match(/style=\{\{([\s\S]*?)\}\}/);
      if (!st) continue;
      for (const b of st[1].matchAll(/\b(background(?:Color|Image)?)\s*:\s*([^,}\n]+)/g)) if (!/transparent|none|var\(--/.test(b[2])) hits.push(`${f.slice(ROOT.length)}:${s.slice(0, m.index).split('\n').length} ${b[1]}: ${b[2].trim().slice(0, 50)}`);
    }
  }
  return hits;
}
const OPAQUE = /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|\brgb\(\s*\d+[ ,]+\d+[ ,]+\d+\s*\)|\bwhite\b|\bblack\b|\bgold\b/;
function cssSolidButtons() {
  const hits = [];
  const css = walk(join(ROOT, 'src')).filter((f) => f.endsWith('.css') && !f.includes('/admin') && !f.includes('/pages/do-it/landing/'));
  for (const f of css) {
    const s = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim(); if (!/button|-btn\b|-action|primary|-pill|cta|choice-confirm|reactions/i.test(sel) || sel.includes('glass-btn')) continue;
      for (const d of m[2].matchAll(/(?:^|;)\s*(background(?:-color|-image)?)\s*:\s*([^;]+)/g)) if (!/var\(--echo-glass|transparent|none/.test(d[2]) && OPAQUE.test(d[2])) hits.push(`${f.slice(ROOT.length)}: ${sel.slice(0, 60)} ${d[1]}: ${d[2].trim().slice(0, 40)}`);
    }
  }
  return hits;
}

test('버튼 시스템 잠금(GF-99): 앱 전체 버튼에 인라인 불투명 채움 0(흰색·금색·검정·회색 그라데이션 모두)', () => {
  assert.deepEqual(inlineSolidButtons(), []);
});

test('버튼 시스템 잠금: 앱 CSS 의 버튼 규칙에 불투명 채움 0', () => {
  assert.deepEqual(cssSolidButtons(), []);
});

test('버튼 시스템 잠금: 공통 유리 버튼 한 벌 — 채움 0 · 인라인 색도 이김 · 비활성도 회색 채움 아님 · 대표가 본 두 버튼이 유리 버튼', () => {
  const css = read('src/doit/components/feature/glass-button.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /background[^;]*:(?![^;]*(var\(--glass|transparent|none))[^;]*(#[0-9a-f]{3,6}\b|white|black|gold)/i);
  assert.match(css, /\.echo-glass-btn\{[^}]*background:var\(--glass-film\)!important/);
  assert.match(css, /\.echo-glass-btn:disabled[^{]*\{opacity:\.45/);
  assert.match(read('src/doit/components/feature/echo-ui.css'), /@import "\.\/glass-button\.css";/);
  const pb = read('src/doit/app/plan-a/screens/ProfileBuild.tsx');
  for (const label of ['AI가 대신 작성하기', '이 글로 바꾸기']) {
    const at = pb.lastIndexOf(label); const open = pb.lastIndexOf("<button", at); // 주석이 아니라 실제 버튼 글자
    assert.match(pb.slice(open, at), /className="echo-glass-btn echo-glass-btn--primary /, label);
  }
  assert.match(read('src/doit/components/feature/GlassButton.tsx'), /className=\{`echo-glass-btn echo-glass-btn--\$\{variant\}/);
});

test('반대 검사: 불투명 채움 버튼을 하나 되돌리면 전수 검사가 잡는다', () => {
  const sample = '<button type="button" style={{ backgroundColor: colors.accent, color: colors.onAccent }}>이 글로 바꾸기</button>';
  const st = sample.match(/style=\{\{([\s\S]*?)\}\}/)[1];
  assert.ok([...st.matchAll(/\b(background(?:Color|Image)?)\s*:\s*([^,}\n]+)/g)].some((b) => !/transparent|none|var\(--/.test(b[2])));
  assert.ok(OPAQUE.test('linear-gradient(115deg,#f0f2f4,#bbc4d0)'));
});

// 사용자가 실제로 닿는 앱 화면(출시 범위 · releaseScope 로 숨긴 예전 화면 제외)의 버튼 Tailwind 채움 클래스 0.
const HIDDEN_DIRS = ['/pages/home/', '/pages/do-it/weather', '/pages/do-it/white-door', '/pages/do-it/understanding-check', '/pages/do-it/locker', '/pages/do-it/fortune/', '/pages/do-it/photo/', '/pages/do-it/grade/', '/pages/do-it/components/', '/pages/do-it/hero/', '/pages/do-it/1/', '/pages/do-it/2/', '/pages/do-it/3/', '/pages/do-it/4/', '/doit/pages/do-it/room/', '/pages/do-it/landing/', '/admin', 'components/MusicPlayer.tsx'];
const SOLID_TW = /(?<![\w-])(?:hover:|active:)?bg-(?:white|black)(?![/\w-])|(?<![\w-])(?:hover:|active:)?bg-\[#[0-9a-fA-F]{3,6}\](?!\/)|(?<![\w-])(?:hover:|active:)?bg-(?:red|pink|amber|yellow|gray|slate|zinc|neutral|stone|orange|green|blue|indigo|purple|secondary)-\d{2,3}(?:\/(?:[6-9]\d|100))?(?![/\d])/;
test('버튼 시스템 잠금: 사용자가 닿는 앱 화면의 버튼에 Tailwind 불투명 채움 클래스 0(bg-white·bg-[#금색] 등)', () => {
  const hits = [];
  for (const f of APP_TSX.filter((p) => !HIDDEN_DIRS.some((h) => p.includes(h)))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<(button|motion\.button)\b/g)) {
      let depth = 0; let i = m.index + m[0].length;
      for (; i < s.length; i++) { const c = s[i]; if (c === '{') depth++; else if (c === '}') depth--; else if (c === '>' && depth === 0) break; }
      const tag = s.slice(m.index, i);
      const cls = [...tag.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((x) => x[1] ?? x[2]).join(' ');
      const hit = cls.match(SOLID_TW);
      if (hit) hits.push(`${f.slice(ROOT.length)}:${s.slice(0, m.index).split('\n').length} ${hit[0]}`);
    }
  }
  assert.deepEqual(hits, []);
  assert.ok(SOLID_TW.test('bg-white') && SOLID_TW.test('bg-[#C9A24B]') && !SOLID_TW.test('bg-white/10'), '반대 검사: 채움 클래스는 잡고 옅은 막은 통과');
});

test('운영 빌드 주소 잠금: 앱·브랜드·관리자 소스에 QA 주소(netlify.app · QA ref) 글자 0 — 운영 빌드에 섞이면 운영 게이트가 막힌다(관리자 배포 기록표 사례)', () => {
  const hits = [];
  const walk = (dir) => { for (const e of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(tsx?|css|html)$/.test(e.name) && /netlify\.app|mutniujeiyujhkobadkd/.test(read(p))) hits.push(p); } };
  walk('src');
  assert.deepEqual(hits, []);
  const rel = read('src/admin/releaseStatus.ts');
  assert.match(rel, /IS_PROD_BUILD \? \[\] :/, 'QA 줄은 QA 빌드에서만');
});
