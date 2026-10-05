// 2026-10-04 대표 「추가 필수 구현 — 홈페이지 안에 들어갈 DO IT 브랜드 영상」 — 소스 규칙 검사(모의 · 실제 재생·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const FILM = read('src/pages/do-it/brand-home/BrandFilm.tsx');
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const VTT = read('public/brand/film/captions.ko.vtt');

test('자리(2026-10-05 대표 「핵심 4페이지만 스크롤 · 나머지는 버튼」 + PR #137 제작과정 영상): 제작 과정 영상은 3페이지(#bh-making) 하나 · 「모바일 시작하기」는 첫 화면 하나뿐', () => {
  const at = (s) => HOME.indexOf(s);
  const sec = HOME.slice(at('id="bh-making"'), at('id="bh-install"'));
  assert.ok(at('id="bh-making"') > 0 && sec.includes('<BrandFilm />'), '제작 과정 = BrandFilm');
  assert.equal((HOME.match(/<BrandFilm \/>/g) ?? []).length, 1, '같은 영상 한 번만');
  assert.doesNotMatch(HOME, /kind: 'film'/, '같은 영상을 여는 「브랜드 영상」 창 0');
  assert.equal((HOME.match(/\{BRAND_HOME_COPY\.start\}/g) ?? []).length, 1, '「모바일 시작하기」 = 첫 화면 하나');
  assert.doesNotMatch(HOME, /StartActions/);
  assert.match(FILM, /title: '홈페이지 제작과정', play: '영상 보기', error: '영상을 불러오지 못했어요\. 다시 시도해 주세요\.'/);
});

test('2026-10-05 대표 교체: 영상 = 홈페이지 제작과정(대표가 올린 16초) · 화면에 들어오면 소리 없이 저절로 재생', () => {
  assert.match(FILM, /mp4: '\/brand\/film\/homepage-making\.mp4'/);
  assert.match(FILM, /muted loop playsInline preload="metadata"/);
  assert.match(FILM, /if \(e\.intersectionRatio >= 0\.5\) tryPlay\(\);/, '절반 이상 보이면 재생');
  assert.match(FILM, /else if \(e\.intersectionRatio < 0\.25 && !v\.paused\) v\.pause\(\);/, '4분의 1 아래면 멈춤');
  assert.match(FILM, /if \(reduceMotion\(\) \|\| userPaused\.current\)/, '움직임 줄이기 · 직접 멈춘 사람은 저절로 재생 0');
  assert.match(FILM, /if \(\(e as \{ name\?: string \} \| null\)\?\.name === 'NotAllowedError'\) setAskPlay\(true\)/, '막힘(NotAllowedError)만 「영상 보기」 · 끊긴 시도(AbortError) 무시');
  assert.match(FILM, /const onPlaying = \(\) => setAskPlay\(false\);/, '재생되면 「영상 보기」 거둠');
  assert.match(FILM, /const onPlay = \(\) => setPlaying\(true\);[\s\S]*v\.addEventListener\('play', onPlay\)/, '버튼 글 = 실제 paused 상태(재생 기다리는 동안에도 「멈춤」)');
  assert.match(FILM, /<button type="button" className="bh-film-toggle" onClick=\{toggle\}/, '키보드로 누르는 멈춤/재생 버튼');
  assert.match(FILM, /rootMargin: '0px 0px 300px 0px'/, '가까이 오기 전 영상 파일 받지 않음');
  assert.match(FILM, /const onReduce = \(e: MediaQueryListEvent\) => \{ if \(e\.matches\) \{ if \(!v\.paused\) v\.pause\(\); setAskPlay\(true\); \} \};[\s\S]*rm\?\.addEventListener\?\.\('change', onReduce\)/, '보는 중 움직임 줄이기 켜면 멈춤');
  assert.match(FILM, /useState<State>\('waiting'\)/);
  assert.doesNotMatch(FILM, /<video[^>]*onError=/, '<video> React onError 는 <source> 오류까지 받아 대체 재생을 막는다');
  assert.match(FILM, /<source src=\{FILM\.mp4\} type="video\/mp4" onError=\{\(e\) => e\.stopPropagation\(\)\} \/>/);
  assert.match(FILM, /<source src=\{FILM\.webm\} type="video\/webm" onError=\{\(e\) => \{ e\.stopPropagation\(\); setState\('error'\); \}\} \/>/);
  assert.match(FILM, /v\.addEventListener\('error', fail\)/);
});

test('파일: 제작과정 mp4/webm · 대표 이미지 · 16초 안내 · 예전 영상 파일은 지우지 않음', () => {
  for (const ext of ['mp4', 'webm']) { const n = statSync(`public/brand/film/homepage-making.${ext}`).size; assert.ok(n > 100_000 && n < 3_000_000, `${ext} ${n}`); }
  assert.ok(statSync('public/brand/film/homepage-making-poster.jpg').size > 5_000);
  for (const o of ['landscape', 'portrait']) assert.ok(statSync(`public/brand/film/doit-brand-film-${o}.mp4`).size > 0, '예전 파일 보존');
  assert.ok(VTT.startsWith('WEBVTT'));
  assert.match(FILM, /16초 영상/);
});

test('이용 안내를 열면 영상 멈춤 · 홈페이지 메뉴로 연 안내를 닫으면 초점은 메뉴 버튼으로', () => {
  assert.match(FILM, /const onGuide = \(\) => \{ if \(!v\.paused\) v\.pause\(\); \};\n\s*window\.addEventListener\(GUIDE_OPEN_EVENT, onGuide\);/);
  assert.match(FILM, /window\.removeEventListener\(GUIDE_OPEN_EVENT, onGuide\)/);
  assert.match(HOME, /<button ref=\{menuBtnRef\} type="button" className="bh-menu-btn"/);
  assert.match(HOME, /openGuide\(undefined, menuBtnRef\.current\)/);
});

test('Codex PR #130 P2: QR 이 없는 빌드(QA 앱 주소)에서는 컴퓨터 「시작」 버튼이 막히지 않고 앱 주소로 · 주소 글자도 링크', () => {
  const home = readFileSync(new URL('../src/pages/do-it/brand-home/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /if \(!qr \|\| !qr\.querySelector\('img'\)\) return;\n  event\.preventDefault\(\);/);
  assert.match(home, /\{productionApp && <img src="\/brand\/app-qr\.svg"/, 'QR 그림은 운영 앱 주소일 때만');
  assert.match(home, /<p>주소는 <strong><a href=\{appUrl\('\/'\)\}>\{APP_ORIGIN\}<\/a><\/strong><\/p>/);
});

test('Codex PR #130 P2: 장면 창은 누른 단추(currentTarget)를 받아 닫으면 그 단추로 돌아감 — Safari 는 눌러도 초점을 주지 않음', () => {
  const home = readFileSync(new URL('../src/pages/do-it/brand-home/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /const openLayer = \(next: Layer, trigger\?: HTMLElement \| null\) => \{ layerOpener\.current = menuOpen \? menuBtnRef\.current : \(trigger \?\? /);
  assert.doesNotMatch(home, /onClick=\{\(\) => openLayer\(/, '모든 여는 단추가 currentTarget 을 넘김');
  assert.equal((home.match(/openLayer\(\{[^}]*\}, e\.currentTarget\)/g) ?? []).length, 5, '이야기 장면·회사 소개·대표 인사말(메뉴·더 알아보기)');
});

test('2026-10-05 대표: 회사 소개 칸의 서비스·문의·약관 줄 삭제 · 바닥글(이용 안내·이용약관·개인정보처리방침·문의)은 그대로', () => {
  assert.doesNotMatch(HOME, /className="bh-rows"/);
  const foot = HOME.slice(HOME.lastIndexOf('bh-legal-link'));
  for (const t of ['이용 안내', 'href="/legal/terms">이용약관', 'href="/legal/privacy">개인정보처리방침', 'mailto:0423doit@gmail.com']) assert.ok(foot.includes(t), t);
});
