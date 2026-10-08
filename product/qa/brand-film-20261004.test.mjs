// 2026-10-04 대표 「추가 필수 구현 — 홈페이지 안에 들어갈 DO IT 브랜드 영상」 — 소스 규칙 검사(모의 · 실제 재생·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const FILM = read('src/pages/do-it/brand-home/BrandFilm.tsx');
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const VTT = read('public/brand/film/captions.ko.vtt');
// 2026-10-08 대표 「GetLayers 코드 그대로 · 글만 넣어」: 홈페이지 = src/vesper 원본. 제작 과정 영상은 Einstein–Rosen 격자 장면(#making) 위에.
const LATTICE = read('src/vesper/views/home/sections/lattice-section.tsx');
const FOOT = read('src/vesper/views/home/sections/site-footer.tsx');

test('자리(2026-10-08 대표 「코드 그대로」 + PR #137 제작과정 영상): 제작 과정 영상은 격자 장면(#making) 하나 · 같은 영상을 여는 창 0', () => {
  assert.match(LATTICE, /<section ref=\{hostRef\} id="making" aria-label=\{BRAND_FILM_COPY\.title\}/);
  assert.equal((LATTICE.match(/<BrandFilm \/>/g) ?? []).length, 1, '같은 영상 한 번만');
  assert.equal((HOME.match(/<BrandFilm \/>/g) ?? []).length, 0, 'page.tsx 는 원본 틀만');
  assert.doesNotMatch(HOME + LATTICE, /kind: 'film'/, '같은 영상을 여는 「브랜드 영상」 창 0');
  assert.match(LATTICE, /import BrandFilm, \{ BRAND_FILM_COPY \} from "@\/pages\/do-it\/brand-home\/BrandFilm"/);
  assert.match(LATTICE, /<div className="bh [^"]*">[\s\S]*<BrandFilm \/>/, '영상 칸은 .bh 틀 안(brand-home.css 그대로)');
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

test('이용 안내를 열면 영상 멈춤 · 바닥글 「이용 안내」 단추로 연 안내를 닫으면 초점은 그 단추로(GuideHost 가 누른 요소를 기억)', () => {
  assert.match(FILM, /const onGuide = \(\) => \{ if \(!v\.paused\) v\.pause\(\); \};\n\s*window\.addEventListener\(GUIDE_OPEN_EVENT, onGuide\);/);
  assert.match(FILM, /window\.removeEventListener\(GUIDE_OPEN_EVENT, onGuide\)/);
  assert.match(FOOT, /<PressableButton\n\s*type="button"\n\s*onClick=\{\(\) => openGuide\(\)\}/);
  assert.match(read('src/components/guide/GuideHost.tsx'), /openerRef\.current = detail\?\.opener \?\? \(document\.activeElement instanceof HTMLElement/);
});
test('컴퓨터·휴대폰 모두 「웹 설치하기」 카드(#financial) = 설치 방법 글 · 설치는 앱 주소에서(이용 안내 설치 항목에 앱 주소 링크)', () => {
  const fin = read('src/vesper/views/home/sections/financial-section.tsx');
  assert.match(fin, /const TITLE = "홈 화면에서 바로 시작하세요\.";/);
  assert.match(fin, /아이폰은 공유 버튼 → 홈 화면에 추가, 안드로이드는 메뉴 → 홈 화면에 추가\./);
  assert.match(fin, /설치하지 않아도 웹에서 그대로 쓸 수 있어요\./);
  assert.match(HOME, /설치는 앱 주소\(\{APP_ORIGIN\.replace\('https:\/\/', ''\)\}\)에서 해요\. 이 회사 홈페이지는 설치하지 않아도 돼요\. <a href=\{appUrl\(INSTALL_PATH\)\}>앱 주소에서 설치하기/);
});
test('옛 장면 창(SceneLayer)은 더 쓰지 않음 · 격자 장면 글 = 이야기 8장면(연결의 속도) · Solaris 글 = 5장면(감정의 이유)', () => {
  assert.doesNotMatch(HOME, /openLayer|SceneLayer|layerOpener/);
  assert.match(LATTICE, /const STORY = STORIES\[7\];/);
  assert.match(read('src/vesper/views/home/sections/solaris-section.tsx'), /const STORY = STORIES\[4\];/);
});
test('2026-10-05 대표: 바닥글(이용 안내·이용약관·개인정보처리방침·문의)은 그대로 · 원본의 이름·이메일 입력 칸은 뺌(개인정보 받는 칸 0)', () => {
  assert.doesNotMatch(HOME, /className="bh-rows"/);
  for (const t of ['이용 안내', 'href="/legal/terms" className="underline underline-offset-4">이용약관', 'href="/legal/privacy" className="underline underline-offset-4">개인정보처리방침', 'href={`mailto:${LEGAL.email}`}']) assert.ok(FOOT.includes(t), t);
  assert.doesNotMatch(FOOT, /<input|<form|type="email"/, '원본 연락 폼 0');
});
