// 2026-10-04 대표 「전체 디자인 교체 + 사용자 이용 안내 통합」 검사 — 모의(가짜 서버·브라우저 없음) 기준.
// 공통 내용 모듈은 실제로 실행해서 확인하고(문구·준비 상태·설치 판단·열기 신호), 오버레이 동작은 소스 계약으로 고정한다.
// 실제 화면 열기→닫기→입력 이어가기·키보드·초점·Back 은 브라우저 검수 몫(이 검사로 PASS 라고 하지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

function load(file, requireMap = {}, sandbox = {}) {
  const js = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: (id) => requireMap[id], CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }, ...sandbox }, { filename: file });
  return module.exports;
}
const installContext = load('src/doit/lib/installContext.ts', {}, { encodeURIComponent });
const emitted = [];
const fakeWindow = { dispatchEvent: (e) => { emitted.push(e); return true; }, matchMedia: () => ({ matches: false }) };
const guide = load('src/lib/guide/guideContent.ts', { '@/doit/lib/installContext': installContext }, { window: fakeWindow, navigator: { userAgent: '', maxTouchPoints: 0 } });

test('이용 안내: 8개 항목이 지정한 순서·제목 그대로', () => {
  assert.deepEqual([...guide.GUIDE_SECTIONS.map((s) => s.id)], ['start', 'talk', 'correct', 'choose', 'key', 'zzarit', 'install', 'safety']);
  assert.deepEqual([...guide.GUIDE_SECTIONS.map((s) => s.title)], [
    '처음이라면, 여기부터 보세요.', '잘 정리해서 말하지 않아도 괜찮아요.', '내 생각과 다르면, 고쳐주세요.', '추천을 받아도, 선택은 내가 해요.',
    'KEY, 어디에 쓰나요?', '‘찌릿!’은 서로 선택했다는 뜻이에요.', '홈 화면에서 바로 시작하세요.', '불편한 일이 있으면 알려주세요.',
  ]);
  assert.equal(guide.GUIDE_TITLE, '이용 안내');
});

test('이용 안내: 정정 네 버튼 설명 · 선택/공개 순서 · 문의 주소가 실제 계약과 같다', () => {
  const by = Object.fromEntries(guide.GUIDE_SECTIONS.map((s) => [s.id, s]));
  assert.equal(by.correct.points.length, 4);
  for (const label of ['맞아요', '조금 달라요', '그게 아니에요', '직접 설명할게요']) assert.ok(by.correct.points.some((p) => p.startsWith(label)), label);
  assert.equal(by.choose.note, '추천을 받았다고 바로 연결되는 것은 아니에요.');
  assert.ok(by.choose.points[0].includes('이름·사진·소개가 보이지 않아요'), '한쪽 선택 = 대기');
  assert.ok(by.choose.points[2].includes('공개에 동의한 뒤'), '공개는 둘 다 답 + 동의 뒤');
  assert.equal(guide.GUIDE_CONTACT, '0423doit@gmail.com');
  assert.ok(by.safety.note.includes('자동으로 보내지 않아요'));
});

test('이용 안내: 거짓 약속·옛 내용 0 (가격·결제·%·보상·사주·타로·완료 약속·AI 판정)', () => {
  const all = JSON.stringify(guide.GUIDE_SECTIONS) + guide.KEY_PENDING_TEXT + guide.KEY_READY_TEXT;
  assert.doesNotMatch(all, /\d[\d,]*\s*원|결제|가격|\d+\s*%|보상|무료 지급|사주|타로|궁합|운명|속마음|5번|다섯 번/);
  assert.doesNotMatch(all, /OpenAI|GPT|Supabase|doit_|서버 구조/i, '내부 구조·제공사 나열 0');
  assert.doesNotMatch(all, /바로 (연결|채팅|대화)할 수 있/, '바로 대화 가능 약속 0');
});

test('KEY 항목: 준비 중 문구와 열림 문구가 다르고, 수량·0개 표시는 없다', () => {
  assert.equal(guide.KEY_PENDING_TEXT, '현재 KEY 사용 기능은 준비 중이에요.');
  assert.notEqual(guide.KEY_PENDING_TEXT, guide.KEY_READY_TEXT);
  assert.doesNotMatch(guide.KEY_PENDING_TEXT + guide.KEY_READY_TEXT, /\d/);
  const comp = noComments(read('src/components/UsageGuide.tsx'));
  assert.match(comp, /visibleInRelease\('\/doit\/key'\)/, 'KEY 준비 상태는 실제 출시 범위 플래그에서 읽는다');
  assert.doesNotMatch(comp, /useKeyWallet|balance|잔액/, '안내가 KEY 값을 만들지 않는다');
});

test('설치 항목: 기기별 문구 · 컴퓨터는 사용자가 iPhone/Android 선택 · 스토어 배지 0 · 웹으로 계속', () => {
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const kakao = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 KAKAOTALK 10.4.3';
  const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
  const ctx = (ua, standalone = false) => installContext.detectInstallContext({ ua, standalone, maxTouchPoints: ua === ios ? 5 : 0 });
  assert.equal(guide.INSTALL_STEPS[ctx(ios)], guide.INSTALL_IPHONE);
  assert.ok(guide.INSTALL_IPHONE.includes('공유') && guide.INSTALL_IPHONE.includes('홈 화면에 추가'));
  assert.ok(guide.INSTALL_STEPS[ctx(kakao)].includes('설치할 수 없어요'));
  assert.equal(ctx(ios, true), 'installed');
  assert.equal(guide.installNeedsPicker(ctx(desktop)), true);
  assert.equal(guide.installNeedsPicker(ctx(ios)), false);
  assert.equal(guide.INSTALL_CONTINUE_WEB, '웹으로 계속 이용하기');
  assert.doesNotMatch(JSON.stringify(guide.INSTALL_STEPS), /apps\.apple\.com|play\.google\.com|App Store|Google Play/i);
});

test('openGuide: 창 이벤트로 항목을 전달하고, 이벤트를 못 보내도 예외를 내지 않는다', () => {
  emitted.length = 0;
  guide.openGuide('install');
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].type, guide.GUIDE_OPEN_EVENT);
  assert.equal(emitted[0].detail.topic, 'install');
  guide.openGuide();
  assert.equal(emitted[1].detail.topic, undefined);
  fakeWindow.dispatchEvent = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => guide.openGuide('start'));
});

test('오버레이 계약(소스): 포털 · aria-modal · inert · Esc · Tab 가둠 · 이력 소유권 · 스크롤 복원 · 초점 복귀 · 아래 화면 unmount 0', () => {
  const c = noComments(read('src/components/UsageGuide.tsx'));
  for (const t of ['createPortal', 'aria-modal="true"', 'aria-labelledby="ug-title"', "setAttribute('inert'", "event.key === 'Escape'", "event.key !== 'Tab'", 'event.shiftKey', 'ugOpen', 'window.history.back()', 'popstate', 'window.scrollTo(0, scrollY)', 'data-guide-open', 'opener.current', 'name="ug-accordion"']) assert.ok(c.includes(t), t);
  // 안내 열기·닫기가 라우터 이동·입력 값을 건드리지 않는다.
  assert.doesNotMatch(c, /useNavigate|navigate\(|localStorage|sessionStorage|\.value\s*=/);
  // 메뉴 이력 칸과 안내 이력 칸은 서로 다른 키(bhMenu / ugOpen)로 센다.
  assert.ok(read('src/pages/do-it/brand-home/page.tsx').includes('bhMenu'));
  assert.ok(!c.includes('bhMenu'));
});

test('진입점: 홈페이지 메뉴·푸터 「이용 안내」 · 앱 메뉴/설정/첫 화면 · 홈페이지에서 설치 창 호출 0', () => {
  const home = noComments(read('src/pages/do-it/brand-home/page.tsx'));
  assert.ok((home.match(/\{GUIDE_TITLE\}/g) ?? []).length >= 2, '메뉴 + 푸터');
  assert.ok(home.includes("openGuide('install')"), '앱 설치 안내는 공통 안내의 설치 항목을 연다');
  assert.doesNotMatch(home, /beforeinstallprompt|\.prompt\(\)/);
  assert.ok(read('src/lib/guide/guideContent.ts').includes("GUIDE_TITLE = '이용 안내'"));
  assert.ok(read('src/doit/pages/do-it/welcome/page.tsx').includes("openGuide('start')"));
  assert.match(read('src/components/AppCornerMenu.tsx'), /<UsageGuideHost variant="app" \/>/);
});

test('디자인 FAIL 3개: 홈페이지 시작 = 앱 루트 · 배경은 안쪽으로 확대 · 앱 인트로는 민트·유리(홈페이지는 검정 유지)', () => {
  const home = read('src/pages/do-it/brand-home/page.tsx');
  assert.match(home, /const START_PATH = '\/';/);
  const css = noComments(read('src/pages/do-it/brand-home/brand-home.css'));
  const from = Number(css.match(/\[data-depth\] \.bh-bg \{ transform: scale\(([\d.]+)\)/)[1]);
  const to = Number(css.match(/\[data-depth\]\[data-in\] \.bh-bg \{ transform: scale\(([\d.]+)\)/)[1]);
  assert.ok(to > from, `배경 확대 방향: ${from} → ${to}`);
  const frame = read('src/components/DoItIntroFrame.ts');
  assert.match(frame, /IS_APP_SITE \? APP_BG : 'radial-gradient\(120% 120% at 50% 45%, #08070C/);
  assert.ok(frame.includes('data-doit-intro-disc'));
});

test('안내 CSS: .ug-root 범위 · 불투명 버튼 0 · 글자 16px 이상 · 터치 44px · 움직임 280ms/240ms · 움직임 줄이기 정지 · 아래 애니메이션 멈춤', () => {
  const css = noComments(read('src/components/usage-guide.css'));
  assert.doesNotMatch(css, /(^|\})\s*(body|html:not|:root)\b/);
  for (const m of css.matchAll(/font-size:(\d+)px/g)) assert.ok(Number(m[1]) >= 16, `글자 ${m[1]}px`);
  assert.match(css, /\.ug-close\{min-width:44px;min-height:44px/);
  assert.match(css, /ug-up 280ms/);
  assert.match(css, /ug-fade 240ms/);
  assert.match(css, /@media\(prefers-reduced-motion:no-preference\)/);
  assert.match(css, /html\[data-guide-open\] #root \*/);
  assert.match(css, /min-width:900px/, '넓은 화면 옆 패널');
});
