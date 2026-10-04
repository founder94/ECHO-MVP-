// 2026-10-04 대표 「홈페이지·모바일 디자인 교체」 — 소스 규칙 검사(모의 · 실제 렌더·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const HCSS = read('src/pages/do-it/brand-home/brand-home.css');

test('홈페이지: 순서 = 브랜드 → ECHO → 회사 정보 → 대표 인사말(맨 마지막) → 법적 고지', () => {
  const at = (s) => HOME.indexOf(s);
  const order = ['className="bh-sec bh-hero"', 'id="bh-echo"', 'id="bh-company"', 'id="bh-greeting"', '<footer className="bh-legal">'].map(at);
  order.forEach((v) => assert.ok(v > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order, '순서');
});

test('홈페이지 문구: 첫 화면 「대화로 시작하는 만남.」 · ECHO 원래 문구 + 「관련 기능 준비 중」 · 모바일 시작하기 · 앱 설치 안내', () => {
  for (const t of ["heroTitle: '대화로 시작하는 만남.'", "heroLine: '말이 통하는 사람을 만나는 일.'", "echoTitle: ['당신이 잠든 사이,', 'AI가 먼저 만나봅니다.']", "echoSoon: '관련 기능 준비 중'", "start: '모바일 시작하기'", "install: '앱 설치 안내'"]) assert.ok(HOME.includes(t), t);
  assert.match(HOME, /\{BRAND_HOME_COPY\.echoSoon\}/, '준비 중을 문구 바로 옆에 표시');
  assert.doesNotMatch(noComments(HOME), /AI가 (대신|최종) (선택|고르)/, 'AI가 대신 고른다는 설명 0');
});

test('홈페이지: 대표 인사말은 기존 승인 원문 그대로(시안 제안 문구로 바꾸지 않음) · 법적 고지·문의 보존', () => {
  assert.match(HOME, /import \{[^}]*GREETING[^}]*GREETING_CLOSING[^}]*GREETING_TITLE[^}]*\} from '@\/pages\/do-it\/landing\/components\/brandGreeting'/);
  assert.ok(!HOME.includes('기술보다 먼저'), '시안의 제안 인사말은 넣지 않음(대표 확인 대기)');
  for (const t of ['/legal/terms', '/legal/privacy', 'mailto:0423doit@gmail.com', '사업자등록번호 121-46-51503']) assert.ok(HOME.includes(t), t);
});

test('홈페이지 색·움직임: 보라·네온·옆 스침·회전 0 · 움직임 줄이기면 모두 정지 · 공식 로고 원본 사용', () => {
  const css = noComments(HCSS);
  assert.doesNotMatch(css, /#(8|9|a)[0-9a-f]{2}(f|e)[0-9a-f]{2}\b|purple|violet|magenta|neon/i, '보라·네온 0');
  assert.doesNotMatch(css, /rotate\(|translateX\(\s*-?\d{2,}|marquee|infinite/, '회전·옆 스침·무한 반복 0');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*animation: none !important; transition: none !important;/);
  assert.match(HOME, /src="\/brand\/doit-earth-original\.png"/, '공식 로고 그림(다시 그리지 않음)');
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

test('홈페이지: 「모바일 시작하기」는 첫 화면 포함 전부 같은 처리(컴퓨터 = QR 구간 · 휴대폰 = 앱) · Codex PR #123', () => {
  const starts = HOME.match(/<a [^>]*href=\{appUrl\(START_PATH\)\}[^>]*>\{BRAND_HOME_COPY\.start\}/g) ?? [];
  assert.ok(starts.length >= 2, `시작 링크 ${starts.length}`);
  for (const a of starts) assert.match(a, /onClick=\{goStart\}/, a);
  assert.match(HOME, /id="bh-start-qr"/, 'QR 구간');
  assert.match(HOME, /<a className="bh-btn bh-btn--text" href=\{appUrl\(START_PATH\)\}>이 컴퓨터에서 열기<\/a>/, '「이 컴퓨터에서 열기」는 앱으로 바로(빠져나갈 길)');
});

test('홈페이지 첫 화면: 주 행동 = 「모바일 시작하기」(테두리 버튼) · 「ECHO 알아보기」 = 보조(글자 링크) · 명세 「홈페이지」', () => {
  const hero = HOME.slice(HOME.indexOf('className="bh-sec bh-hero"'), HOME.indexOf('id="bh-echo"'));
  assert.match(hero, /<a className="bh-btn bh-btn--outline" href=\{appUrl\(START_PATH\)\} onClick=\{goStart\}>\{BRAND_HOME_COPY\.start\}/);
  assert.match(hero, /<a className="bh-btn bh-btn--text" href="#bh-echo">\{BRAND_HOME_COPY\.learn\}<\/a>/);
  assert.ok(hero.indexOf('BRAND_HOME_COPY.start') < hero.indexOf('BRAND_HOME_COPY.learn'), '모바일 시작하기가 먼저');
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
