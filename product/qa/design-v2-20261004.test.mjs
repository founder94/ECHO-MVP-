// 2026-10-04 대표 「홈페이지·모바일 디자인 교체」 — 소스 규칙 검사(모의 · 실제 렌더·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const HCSS = read('src/pages/do-it/brand-home/brand-home.css');

test('홈페이지(2026-10-05 대표 「너무 길다 · 핵심 4페이지만 스크롤」): 스크롤 = 히어로 → 이야기 고르기 → 제작 과정 → 웹 설치하기 → 더 알아보기 → 법적 고지 · 나머지는 장면 창', () => {
  const at = (s) => HOME.indexOf(s);
  const order = ['className="bh-sec bh-hero"', 'id="bh-story"', 'id="bh-making"', 'id="bh-install"', '<nav className="bh-more"', '<footer className="bh-legal">'].map(at);
  order.forEach((v) => assert.ok(v > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order, '순서');
  assert.equal((HOME.match(/<section className="bh-sec/g) ?? []).length, 4, '스크롤 화면 4장');
  for (const k of ['story', 'film', 'company', 'greeting']) assert.match(HOME, new RegExp(`kind: '${k}'`), `장면 창 ${k}`);
  const layer = read('src/pages/do-it/brand-home/SceneLayer.tsx');
  assert.match(layer, /role="dialog" aria-modal="true"/);
  assert.match(layer, /if \(e\.key === 'Escape'\)/, 'Esc 로 닫기');
  assert.match(layer, /opener\?\.focus\?\.\(\{ preventScroll: true \}\)/, '닫으면 누른 버튼으로 초점');
  assert.match(layer, /root\.style\.overflow = before/, '닫으면 뒤 화면 스크롤 원래대로');
  // Codex PR #130 P2 4건: 메뉴로 연 창의 초점 복귀 · 휴대폰 빈 곳 탭 닫기 · 창 밖으로 빠진 초점 되돌리기 · 자동 재생 거절 시 재생 막대
  assert.match(HOME, /layerOpener\.current = menuOpen \? menuBtnRef\.current : \(trigger \?\? \(document\.activeElement as HTMLElement \| null\)\); close\(\); setLayer\(next\);/);
  assert.match(layer, /const opener = openerProp \?\? \(document\.activeElement as HTMLElement \| null\);/);
  assert.match(layer, /if \(!\(e\.target as HTMLElement\)\.closest\('\.bh-layer-body > \*'\)\) onClose\(\);/);
  assert.match(layer, /if \(!boxRef\.current\.contains\(document\.activeElement\)\) \{ e\.preventDefault\(\); closeRef\.current\?\.focus\(\); return; \}/);
  const making = read('src/pages/do-it/brand-home/MakingFilm.tsx');
  assert.match(making, /void v\.play\(\)\.catch\(\(\) => setBlocked\(true\)\)/); assert.match(making, /controls=\{still \|\| blocked\}/);
});

test('홈페이지 문구(2026-10-05 대표 시안 그대로): ECHO · ONLINE SERENDIPITY · DO IT · 「당신이 잠든 사이」 · 버튼 글자만 「모바일로 시작하기」 · 이야기 9장면 원문', () => {
  for (const t of ["eyebrow: 'ECHO · ONLINE SERENDIPITY'", "heroTitle: ['당신이 잠든 사이,', 'AI가 먼저 만나봅니다.']", "heroLine: ['오늘의 나를 남겨두세요.', '내일, 뜻밖의 연결이 기다립니다.']", "start: '모바일로 시작하기'", "install: '웹 설치하기'"]) assert.ok(HOME.includes(t), t);
  // 시안의 「사주 또는 타로로 가볍게 시작해요」는 시작 흐름(사주·타로 없음)과 달라 쓰지 않고, 지금 되는 일만 적는다.
  assert.doesNotMatch(noComments(HOME), /사주|타로|무료로 시작하기/);
  assert.match(HOME, /heroNote: '지금은 당신의 이야기를 듣는 데서 시작합니다\.'/);
  assert.match(HOME, /\{BRAND_HOME_COPY\.heroNote\}/, '시작 버튼 바로 아래에 지금 되는 일');
  assert.equal((HOME.match(/\{ no: '0\d', label:/g) ?? []).length, 9, '이야기 9장면');
  for (const t of ['잘 쓴 소개보다,', '내 이야기는,', '마지막 말은, 나에게.', '대화가 끝나도,', '오늘의 감정에도', '어제와 다른 나여도,', '조금 다른 시선으로,', '연결의 속도는,', '어떤 사람을']) assert.ok(HOME.includes(t), t);
  assert.doesNotMatch(noComments(HOME), /AI가 (대신|최종) (선택|고르)/, 'AI가 대신 고른다는 설명 0');
});

test('홈페이지: 대표 인사말은 기존 승인 원문 그대로(시안 제안 문구로 바꾸지 않음) · 법적 고지·문의 보존', () => {
  assert.match(HOME, /import \{[^}]*GREETING[^}]*GREETING_CLOSING[^}]*GREETING_TITLE[^}]*\} from '@\/pages\/do-it\/landing\/components\/brandGreeting'/);
  assert.ok(!HOME.includes('기술보다 먼저'), '시안의 제안 인사말은 넣지 않음(대표 확인 대기)');
  for (const t of ['/legal/terms', '/legal/privacy', 'mailto:0423doit@gmail.com', '사업자등록번호 121-46-51503']) assert.ok(HOME.includes(t), t);
});

test('홈페이지 색·움직임: 보라·네온·옆 스침·회전 0 · 움직임 줄이기면 모두 정지 · 지구 그림 · 점 글자 슬로건', () => {
  const css = noComments(HCSS);
  assert.doesNotMatch(css, /#(8|9|a)[0-9a-f]{2}(f|e)[0-9a-f]{2}\b|purple|violet|magenta|neon/i, '보라·네온 0');
  assert.doesNotMatch(css, /rotate\(|translateX\(\s*-?\d{2,}|marquee|infinite/, '회전·옆 스침·무한 반복 0');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none !important; transition: none !important;/);
  // 2026-10-05: 히어로 = 대표가 준 지구 그림 · 심볼 = 공식 D(다시 그리지 않음) · 왼쪽 위 JUST TRY. 도장
  assert.match(HOME, /src="\/brand\/hero-earth\.webp"/, '대표가 준 지구 그림');
  assert.match(HOME, /<h1 className="bh-wordmark"><span className="bh-sr">DO IT<\/span><img src="\/brand\/doit-wordmark\.webp"/, '브랜드 글자 = 공식 접힌 종이 DOIT 그림(대표 「폰트 브랜드 이미지」)');
  assert.match(HOME, /<p className="bh-stamp"><DotText text="JUST TRY\." className="bh-dots" \/><\/p>/, '왼쪽 위 슬로건 = 빛나는 점 글자(대표 「점박으로 · 크게 말고」)');
  assert.match(HCSS, /\.bh-dots \{ display: block; height: 15px;/, '상단 글자 크기에 맞춘 작은 점 글자');
});

test('라우터: 새 홈페이지는 brand 빌드에서만(앱·통합 빌드 영향 0)', () => {
  const r = read('src/router/config.tsx');
  assert.match(r, /BrandHomePage \? <BrandHomePage \/> : <DoItLandingPage \/>/);
  assert.match(r, /const BrandHomePage = import\.meta\.env\.VITE_SITE_ROLE === 'brand' \? lazy\(\(\) => import\('@\/pages\/do-it\/brand-home\/page'\)\) : null;/, 'brand 빌드에서만 홈페이지 조각(app 빌드 0 · Codex PR #123)');
});

test('모바일: 정정 네 버튼 · 「이렇게 이해했는데, 맞나요?」 · 시작 문구 · 대기 문구', () => {
  const c = read('src/doit/components/feature/AgentProfileCheck.tsx');
  const order = ['>맞아요<', '>조금 달라요<', '>그게 아니에요<', '>직접 설명할게요<'].map((t) => c.indexOf(t));
  order.forEach((v) => assert.ok(v > 0)); assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(c, /CHECK_TITLE = '이렇게 이해했는데, 맞나요\?'/);
  assert.match(read('src/doit/components/feature/ConversationOpening.tsx'), /같이 하고 싶은 일이<br \/>있나요\?/);
  assert.match(read('src/doit/components/feature/ConnectionCandidates.tsx'), /선택을 보냈어요\. 상대도 선택하면 알려드릴게요\./);
});

test('KEY: 둥근 고리 · 줄기 · 톱니가 있는 열쇠 아이콘 · 잔액·차감은 다루지 않음(서버 정책 없음 = 쓰는 기능 잠김)', () => {
  const k = read('src/doit/components/feature/KeyIcon.tsx');
  assert.match(k, /\{\/\* 고리 \*\/\}\s*<circle/); assert.match(k, /\{\/\* 줄기 \*\/\}\s*<path/); assert.match(k, /\{\/\* 톱니 \*\/\}\s*<path/);
  assert.doesNotMatch(noComments(k), /balance|spend|차감|잔액/);
  assert.match(read('src/doit/lib/releaseScope.ts'), /key/, 'KEY 화면은 여전히 숨김 목록');
});

test('찌릿: 서버 mutual + match_id 뒤에만 · 같은 연결에서 한 번만(기존 계약 그대로)', () => {
  const cand = read('src/doit/components/feature/ConnectionCandidates.tsx');
  assert.match(cand, /if \(typeof out\.match_id === 'string'\) \{ if \(claimZzarit\(out\.match_id\)\) setMutual/);
  assert.ok(cand.indexOf('<ZzaritMoment') > cand.indexOf('if (mutual) return'));
});

test('홈페이지: 「모바일로 시작하기」는 히어로 하나만 · 다른 버튼은 장면 창을 여는 것뿐 · 컴퓨터 = 웹 설치하기 QR · Codex PR #123', () => {
  const starts = HOME.match(/<a [^>]*href=\{appUrl\(START_PATH\)\}[^>]*>\{BRAND_HOME_COPY\.start\}/g) ?? [];
  assert.equal(starts.length, 1, `시작 링크 ${starts.length}`);
  assert.doesNotMatch(HOME, /StartActions/, '섹션마다 붙던 시작 버튼 묶음 0');
  for (const a of starts) assert.match(a, /onClick=\{goStart\}/, a);
  const body = HOME.slice(HOME.indexOf('id="bh-story"'), HOME.indexOf('<footer className="bh-legal">'));
  for (const b of body.match(/<button[^\n]*?onClick=\{[^\n]*?\}\}>/g) ?? []) assert.match(b, /onClick=\{\(e\) => openLayer\(\{[^}]*\}, e\.currentTarget\)\}/, `장면 창 여는 버튼만: ${b}`);
  assert.equal((body.match(/<button /g) ?? []).length, (body.match(/onClick=\{\(e\) => openLayer\(/g) ?? []).length, '본문 버튼 수 = 장면 창 여는 버튼 수');
  assert.doesNotMatch(body, /className="bh-btn/, '본문에 시작류 버튼 0');
  const install = HOME.slice(HOME.indexOf('id="bh-install"'), HOME.indexOf('<nav className="bh-more"'));
  assert.match(install, /id="bh-start-qr"/, '컴퓨터에서 시작하면 웹 설치하기 QR 로');
});

test('홈페이지 첫 화면: 시안 그대로 둥근 유리 버튼 하나(「모바일로 시작하기」) · 보조 링크 0', () => {
  const hero = HOME.slice(HOME.indexOf('className="bh-sec bh-hero"'), HOME.indexOf('id="bh-story"'));
  assert.match(hero, /<a className="bh-btn bh-btn--start" href=\{appUrl\(START_PATH\)\} onClick=\{goStart\}>\{BRAND_HOME_COPY\.start\}/);
  assert.equal((hero.match(/className="bh-btn/g) ?? []).length, 1, '첫 화면 버튼 하나');
  assert.match(HCSS, /\.bh-btn--start \{ width: 100%; max-width: 360px; min-height: 60px; margin-top: 40px; border-radius: 999px;/, '시안의 둥근 버튼');
});

test('홈페이지 움직임 줄이기: 화면 부드러운 굴림(html smooth)도 이 홈페이지에서만 끔 · 전역 index.css 수정 0 · Codex PR #123', () => {
  assert.match(HCSS, /@media \(prefers-reduced-motion: reduce\) \{[^@]*html:has\(main\.bh\) \{ scroll-behavior: auto; \}/);
  assert.match(HOME, /<main ref=\{rootRef\} className="bh">/);
});

test('모바일 시안 7 선택 대기: 익명 두 노드 + 점선(움직임 0) · 상대가 골랐는지 추정 표시 0', () => {
  const Z = read('src/doit/components/feature/ZzaritMoment.tsx');
  const C = read('src/doit/components/feature/ConnectionCandidates.tsx');
  assert.match(Z, /export function WaitingMark\(\)/);
  assert.match(C, /\? <><WaitingMark \/><p className="doit-connect-note echo-waiting">/, '대기 후보에만');
  const css = read('src/doit/components/feature/zzarit.css');
  assert.match(css, /\.echo-wait-link\{[^}]*border-top:2px dashed/);
  assert.doesNotMatch(css.match(/\.echo-wait[^{]*\{[^}]*\}/g).join(''), /animation/, '대기 표시는 움직임 0');
});

test('모바일 시안 8 찌릿: 연결 카드 안 이중 판 0 · 「다음 단계 보기」가 아래 메뉴에 가리지 않게 화면 안으로', () => {
  const css = read('src/doit/components/feature/zzarit.css');
  assert.match(css, /\.doit-match\[data-state="zzarit"\]\{background:none!important;border:0!important;padding:0!important/);
  assert.match(css, /\.echo-zzarit-cta\{[^}]*scroll-margin-bottom:calc\(112px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(read('src/doit/components/feature/ZzaritMoment.tsx'), /startRef\.current\?\.scrollIntoView\(\{ block: 'nearest', behavior: 'auto' \}\)/);
});

test('모바일 시안 3 Agent 대화: 직전 내 답 = 오른쪽 말풍선 · 질문 = ECHO 말풍선 · 글은 서버가 준 그대로', () => {
  const A = read('src/doit/components/feature/AgentConversation.tsx');
  assert.match(A, /<p className="echo-bubble echo-bubble--me"><span className="echo-sr">내가 한 말: <\/span>\{myAnswers\.at\(-1\)\}<\/p>/);
  assert.match(A, /<div className="echo-question-card echo-bubble--echo">\s*<p className="echo-question">\{question\}<\/p>/);
  const css = read('src/doit/components/feature/core-conversation.css');
  assert.ok(css.indexOf('.echo-bubble--me') > 0 && css.indexOf('.echo-bubble--me') < css.indexOf('/* ── 2026-09-24 대화 화면 파스텔 배경'), '파스텔 배경 규칙 구역 밖');
});

test('시작 흐름 공통 주요 버튼(PrimaryButton · .echo-primary-button)도 흰 바탕 + 깊은 청록 글자 · Codex PR #123', () => {
  const ui = read('src/doit/components/feature/echo-ui.css');
  assert.match(ui, /\.echo-primary-button\{background:#fff!important;border:1px solid #fff!important;color:var\(--echo-cta-ink\)!important/);
  assert.match(ui, /\.echo-primary-button:not\(:disabled\):active\{background:#e3f3f1!important\}/);
  assert.doesNotMatch(ui, /\.echo-primary-button\{background:var\(--echo-glass-strong\)/, '예전 흰 막 주요 버튼 0');
});

test('역할 분리: 홈페이지 빌드에도 들어가는 echo-ui.css 에 앱·관리자 코드 이름 0(CI 「브랜드에 앱·관리자 코드」 검사 · 2026-10-04 QA 게시 실패 원인)', () => {
  const ui = read('src/doit/components/feature/echo-ui.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const k of ['doit-connect', 'DoitApp', 'admin-web']) assert.ok(!ui.includes(k), k);
  assert.match(read('src/doit/components/feature/connect.css'), /\.doit-app-pastel \.doit-connect-note\{font-size:14px!important;line-height:1\.55\}/, '연결 안내 14px 는 앱 전용 connect.css 로');
});

test('2026-10-05 PM 보강: 홈페이지는 히어로 승인 원문을 두고 지금 되는 범위를 한 줄로 · 보장 말 0', () => {
  const page = readFileSync(new URL('../src/pages/do-it/brand-home/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /heroLine: \['오늘의 나를 남겨두세요\.', '내일, 뜻밖의 연결이 기다립니다\.'\]/, '히어로 승인 원문 그대로');
  const scope = page.match(/scope: '([^']+)'/)?.[1] ?? '';
  assert.ok(scope.includes('보여 드릴 사람이 있는지 확인') && scope.includes('서로 원할 때만'), '준비 → 확인 → 서로 원할 때');
  assert.doesNotMatch(scope, /내일|반드시|자동|알림|보장|매일|무조건/, '내일·자동·알림·보장 말 0');
  assert.match(page, /<p className="bh-scope">\{BRAND_HOME_COPY\.scope\}<\/p>/);
});
