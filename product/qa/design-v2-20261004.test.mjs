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

test('홈페이지 문구(2026-10-04 최신 대표 지시): 첫 화면 「말이 통하는 사람을 만나는 일.」 · ECHO 슬로건·설명 + 「관련 기능 준비 중」 · 회사 소개 · 모바일 시작하기 · 앱 설치 안내', () => {
  for (const t of ["heroTitle: '말이 통하는 사람을 만나는 일.'", "heroLine: '그 시작을 ECHO가 함께합니다.'", "echoLead: ['어떤 사람과 무엇을 함께하고 싶은지,', 'ECHO에게 들려주세요.']", "companyLead: ['사람과 사람이 만나는', '서비스를 만듭니다.']", "echoTitle: ['당신이 잠든 사이,', 'AI가 먼저 만나봅니다.']", "echoSoon: '관련 기능 준비 중'", "start: '모바일 시작하기'", "install: '앱 설치 안내'"]) assert.ok(HOME.includes(t), t);
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

test('홈페이지: 「모바일 시작하기」는 첫 화면 포함 전부 앱 주소로 바로 이동(컴퓨터 QR 강제 분기 폐지 · 2026-10-04 대표 지시)', () => {
  const starts = HOME.match(/<a [^>]*href=\{appUrl\(START_PATH\)\}[^>]*>\{BRAND_HOME_COPY\.start\}/g) ?? [];
  assert.ok(starts.length >= 2, `시작 링크 ${starts.length}`);
  for (const a of starts) assert.doesNotMatch(a, /onClick/, a);
  assert.doesNotMatch(noComments(HOME), /goStart|preventDefault|DESKTOP_QUERY/, '컴퓨터 강제 분기 0');
  assert.match(HOME, /id="bh-start-qr"/, 'QR 은 보조 안내로 남음');
  assert.match(HOME, /<a className="bh-btn bh-btn--text" href=\{appUrl\(START_PATH\)\}>이 컴퓨터에서 열기<\/a>/, '「이 컴퓨터에서 열기」는 앱으로 바로(빠져나갈 길)');
});

test('홈페이지 첫 화면: 주 행동 = 「모바일 시작하기」(테두리 버튼) · 「ECHO 알아보기」 = 보조(글자 링크) · 명세 「홈페이지」', () => {
  const hero = HOME.slice(HOME.indexOf('className="bh-sec bh-hero"'), HOME.indexOf('id="bh-echo"'));
  assert.match(hero, /<a className="bh-btn bh-btn--outline" href=\{appUrl\(START_PATH\)\}>\{BRAND_HOME_COPY\.start\}/);
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

test('모바일 상태 문구(2026-10-04 2차): 찌릿 본문·후보 문구·시작 화면·입력창·가입 안내가 대표 지시 그대로', () => {
  assert.ok(read('src/doit/components/feature/ZzaritMoment.tsx').includes("body: '두 분 모두 대화를 원했어요.'"));
  const cand = read('src/doit/components/feature/ConnectionCandidates.tsx');
  for (const t of ['이분의 이야기를 들어볼까요?', '더 알아보기', "no: '다음에 볼게요'", '선택을 보냈어요. 상대도 선택하면 알려드릴게요.']) assert.ok(cand.includes(t), t);
  const home = read('src/doit/pages/do-it/home/page.tsx');
  assert.match(home, /같이 하고 싶은 일이<br \/>있나요/); assert.match(home, /어떤 만남을 원하는지 들려주세요/);
  assert.ok(read('src/doit/components/feature/AgentConversation.tsx').includes("'편하게 적어주세요.'"));
  assert.match(read('src/pages/signup/page.tsx'), /반가워요\. ECHO를 시작해 볼까요\?[\s\S]*계속하려면 약관을 확인해 주세요\./);
});

test('개별 선택(waiting)에는 찌릿 전류 0 — mutual 분기에서만 ZZARIT', () => {
  const cand = read('src/doit/components/feature/ConnectionCandidates.tsx');
  const at = cand.indexOf("out.status === 'waiting'");
  assert.ok(at > 0);
  assert.doesNotMatch(cand.slice(at, at + 230), /setMutual|Zzarit/);
});

test('홈페이지 메뉴·패널: 초점 이동·복귀, Escape, 뒤로가기, 기기별 설치 안내(가짜 스토어 배지 0)', () => {
  const s = noComments(HOME);
  // 2026-10-04 이용 안내 통합: 설치 문구는 공통 모듈(guideContent.ts) 한 곳 — 홈페이지는 그 모듈을 읽는다.
  for (const t of ['menuBtnRef', 'cardRefs', 'closePanel', "e.key !== 'Escape'", 'popstate', 'currentInstallContext', 'INSTALL_STEPS']) assert.ok(s.includes(t), t);
  const guide = noComments(read('src/lib/guide/guideContent.ts'));
  for (const t of ['detectInstallContext', "'ios-safari'", "'ios-other'", 'android', "'in-app'", 'desktop', 'installed']) assert.ok(guide.includes(t), t);
  assert.doesNotMatch(s + guide, /apps\.apple\.com|play\.google\.com|App Store/i);
  assert.match(HCSS, /prefers-reduced-motion: reduce/);
});

test('모바일 배치 교체 CSS: 앱 전용 · 파스텔 루트 아래만 · 전역 0 · 고정 입력 판 · 홈페이지 시간 범위', () => {
  const css = noComments(read('src/doit/components/feature/mobile-layout-v2.css'));
  assert.doesNotMatch(css, /(^|\})\s*(body|html|:root)\b/, '전역 규칙 0');
  assert.match(css, /\.echo-dialogue\.echo-dialogue--pastel \.echo-composer\{position:sticky;bottom:max\(8px,env\(safe-area-inset-bottom/, '입력 판이 키보드·안전 영역에 안 가림(자손 선택자)');
  for (const f of ['ConnectionCandidates', 'ConnectionMatches', 'AgentConversation', 'CoreConversation']) assert.match(read(`src/doit/components/feature/${f}.tsx`), /mobile-layout-v2\.css/, f);
  assert.doesNotMatch(HOME, /mobile-layout-v2/);
  assert.doesNotMatch(noComments(HCSS), /\b(450|1400)ms/, '홈페이지 패널 240~360ms · 배경 600~900ms 밖 값 0');
});

// 4차(P1 결함): 루트(section.echo-dialogue.echo-dialogue--pastel) 한 요소에 자손 클래스를 붙여 쓰면 어떤 요소에도 맞지 않는다. 자손 결합자가 있어야 한다.
test('선택자가 실제 DOM 과 맞다: 루트 클래스 뒤에 자손 클래스를 같은 요소로 붙이지 않는다', () => {
  const css = noComments(read('src/doit/components/feature/mobile-layout-v2.css'));
  assert.doesNotMatch(css, /\.echo-dialogue--pastel\.echo-(?!dialogue--)/, '.echo-dialogue--pastel.echo-xxx (같은 요소 결합) 금지');
  const tsx = ['CoreConversation', 'AgentConversation', 'ConversationOpening'].map((f) => read(`src/doit/components/feature/${f}.tsx`)).join('\n');
  assert.match(tsx, /<section className="echo-dialogue echo-dialogue--pastel"/, '루트는 section 한 요소');
  for (const cls of ['echo-dialogue-header', 'echo-steps', 'echo-composer', 'echo-question-card', 'echo-bubble--me', 'echo-error', 'echo-done']) {
    assert.ok(tsx.includes(cls), `${cls} 은 실제 컴포넌트에 존재`);
    assert.ok(css.includes(`.echo-dialogue.echo-dialogue--pastel .${cls}`) || css.includes(`.echo-bubble.${cls}`) || new RegExp(`:is\\([^)]*\\.${cls}`).test(css), `${cls} 규칙은 루트의 자손`);
  }
});

test('앱 공통 틀(app-glass-v2.css): 앱 모든 화면이 app-pastel.css 로 받고 · 홈페이지 번들 0 · 전역 0 · 44px · 16px', () => {
  const g = noComments(read('src/doit/components/feature/app-glass-v2.css'));
  assert.match(read('src/doit/components/feature/app-pastel.css'), /@import "\.\/app-glass-v2\.css";/);
  assert.doesNotMatch(g, /(^|\})\s*(body|html|:root)\b/);
  assert.match(g, /rgb\(8 70 80\/\.82\)/, '짙은 청록 유리(흰 글자 대비 7:1 이상 계산값)');
  assert.match(g, /min-height:44px/);
  assert.match(g, /font-size:16px/);
  for (const f of ['pages/login/page.tsx', 'pages/signup/page.tsx', 'pages/legal/LegalDocument.tsx', 'doit/components/feature/MobileLayout.tsx']) {
    assert.match(read(`src/${f}`), /app-pastel\.css|product-brand\.css/, f);
  }
  assert.doesNotMatch(HOME, /app-glass-v2|app-pastel/);
  assert.match(read('src/components/app-back-button.css'), /min-height:44px;min-width:44px/, '뒤로 알약 44px');
  assert.doesNotMatch(read('src/components/app-back-button.css'), /height:32px/);
});

test('홈페이지 메뉴 이력 소유권: 안 링크는 앵커 이동을 되돌리지 않고 · 닫기/Back 은 걷고 · Back 뒤 초점 복귀', () => {
  const s = noComments(HOME);
  assert.match(s, /menuOwnsHistory/);
  assert.match(s, /releaseMenuHistory\(\); setMenuOpen\(false\)/, '안 링크 누르면 기록 칸을 일반 기록으로 바꾸고 history.back 안 부름');
  assert.match(s, /if \(menuOwnsHistory\.current && /, '걷기는 소유권이 있을 때만');
  assert.match(s, /menuBtnRef\.current\?\.focus\(\)/, 'Back 으로 닫힌 뒤 메뉴 버튼으로 초점');
});
