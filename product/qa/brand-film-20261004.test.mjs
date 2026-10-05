// 2026-10-04 대표 「추가 필수 구현 — 홈페이지 안에 들어갈 DO IT 브랜드 영상」 — 소스 규칙 검사(모의 · 실제 재생·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const FILM = read('src/pages/do-it/brand-home/BrandFilm.tsx');
const HOME = read('src/pages/do-it/brand-home/page.tsx');
const VTT = read('public/brand/film/captions.ko.vtt');

test('자리(2026-10-05 대표 「핵심 4페이지만 스크롤 · 나머지는 버튼」): 브랜드 영상은 「더 알아보기」·메뉴의 버튼으로 여는 장면 창 안 · 시작 버튼 0', () => {
  const at = (s) => HOME.indexOf(s);
  assert.match(HOME, /if \(l\.kind === 'film'\) return \(\n\s*<SceneLayer opener=\{layerOpener\.current\} label=\{BRAND_FILM_COPY\.title\}/);
  const film = HOME.slice(at("if (l.kind === 'film')"), at("if (l.kind === 'company')"));
  assert.ok(film.includes('<BrandFilm />'));
  assert.doesNotMatch(film, /BRAND_HOME_COPY\.start|StartActions/, '시작 버튼은 히어로 하나만');
  assert.match(HOME, /onClick=\{\(\) => openLayer\(\{ kind: 'film' \}\)\}/, '버튼으로 연다');
  assert.match(FILM, /title: '이야기가 연결이 되기까지', play: '영상 보기', error: '영상을 불러오지 못했어요\. 다시 시도해 주세요\.'/);
});

test('첫 화면에서 영상을 받지 않음: 누르기 전 <video> 0 · 대표 이미지 lazy · 자동 재생·소리 0', () => {
  assert.match(FILM, /useState<State>\('idle'\)/);
  assert.match(FILM, /\{state === 'playing'\n\s*\? <video /);
  assert.match(FILM, /<img src=\{film\.poster\} alt="" loading="lazy"/);
  assert.doesNotMatch(FILM, /autoPlay|autoplay/);
  assert.match(FILM, /controls playsInline preload="metadata"/);
});

test('재생: 앞 원본 실패는 뒤 원본으로 · 마지막 원본/영상 오류만 실패 안내 · 화면 밖 25% 미만이면 멈춤', () => {
  assert.doesNotMatch(FILM, /<video[^>]*onError=/, '<video> React onError 는 <source> 오류까지 받아 대체 재생을 막는다');
  assert.match(FILM, /<source src=\{film\.mp4\} type="video\/mp4" onError=\{\(e\) => e\.stopPropagation\(\)\} \/>/);
  assert.match(FILM, /<source src=\{film\.webm\} type="video\/webm" onError=\{\(e\) => \{ e\.stopPropagation\(\); goError\(\); \}\} \/>/);
  assert.match(FILM, /const fail = goError;/);
  assert.match(FILM, /v\.addEventListener\('error', fail\)/);
  assert.match(FILM, /if \(next !== null && next !== portraitRef\.current\) \{ portraitRef\.current = next; setPortrait\(next\); \}\n\s*setState\('error'\);/, '실패할 때도 돌려 둔 방향 반영');
  assert.match(FILM, /e\.intersectionRatio < 0\.25 && !v\.paused\) v\.pause\(\)/);
  assert.match(FILM, /<track kind="captions" srcLang="ko"/);
});

test('파일: 가로·세로 mp4/webm · 대표 이미지 · 자막 6개 · 합성/준비 중 표시', () => {
  for (const o of ['landscape', 'portrait']) {
    for (const ext of ['mp4', 'webm']) {
      const n = statSync(`public/brand/film/doit-brand-film-${o}.${ext}`).size;
      assert.ok(n > 100_000 && n < 3_000_000, `${o}.${ext} ${n}`);
    }
    assert.ok(statSync(`public/brand/film/poster-${o}.jpg`).size > 5_000);
  }
  assert.ok(VTT.startsWith('WEBVTT'));
  assert.equal((VTT.match(/-->/g) ?? []).length, 6);
  for (const t of ['서비스 이용 예시', '이렇게 이해했는데, 맞나요?', '찌릿! 텔레파시가 통했어요', '당신이 잠든 사이, AI가 먼저 만나봅니다.', '관련 기능 준비 중']) assert.ok(VTT.includes(t), t);
  assert.match(FILM, /서비스 이용 예시 · 합성 화면/);
});

test('휴대폰을 돌리면 세로/가로 영상을 다시 고름 · 재생 중·전체화면이면 기억했다가 멈추거나 끝날 때 반영', () => {
  assert.match(FILM, /if \(isActive\(videoRef\.current\)\) \{ pendingRef\.current = e\.matches; return; \}/);
  assert.match(FILM, /const isActive = \(v: HTMLVideoElement \| null\) => !!v && \(\(!v\.paused && !v\.ended\) \|\| document\.fullscreenElement === v\);/);
  assert.match(FILM, /v\.addEventListener\('pause', onStop\);\n\s*v\.addEventListener\('ended', onStop\);/);
  assert.match(FILM, /if \(videoRef\.current\) setState\('idle'\);/, '바꾸면 대표 이미지로 — 저절로 재생 0');
  assert.match(FILM, /mq\.addEventListener\?\.\('change', onChange\)/);
  assert.doesNotMatch(FILM, /if \(state === 'playing' \|\| typeof window\.matchMedia/, '재생 뒤에도 구독 유지');
});

test('이용 안내를 열면 영상 멈춤 · 홈페이지 메뉴로 연 안내를 닫으면 초점은 메뉴 버튼으로', () => {
  assert.match(FILM, /const onGuide = \(\) => \{ if \(!v\.paused\) v\.pause\(\); \};\n\s*window\.addEventListener\(GUIDE_OPEN_EVENT, onGuide\);/);
  assert.match(FILM, /window\.removeEventListener\(GUIDE_OPEN_EVENT, onGuide\)/);
  assert.match(HOME, /<button ref=\{menuBtnRef\} type="button" className="bh-menu-btn"/);
  assert.match(HOME, /openGuide\(undefined, menuBtnRef\.current\)/);
});
