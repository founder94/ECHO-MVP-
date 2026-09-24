// 회사 홈페이지 브랜딩 (2026-09-23, 대표 "모바일 말고는 회사 홈페이지 브랜딩용. 핵심 차별점과 브랜딩, 모바일로 연결해서 시작. 지금 둘 다 똑같잖아").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const SECTIONS = 'src/pages/do-it/landing/components/BrandSections.tsx';

test('홈페이지에만 차별점·휴대폰 시작 구간이 있고, 앱에는 없다', () => {
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /\{!IS_APP_SITE && <BrandDifference \/>\}/);
  assert.match(landing, /\{!IS_APP_SITE && <BrandMobileStart \/>\}/);
  // 차별점은 히어로 바로 아래, 휴대폰 시작은 사진 이야기 뒤·바닥글 앞
  assert.ok(landing.indexOf('<DoItBrandHero') < landing.indexOf('<BrandDifference />'));
  assert.ok(landing.indexOf('<BrandDifference />') < landing.indexOf('id="doit-stories"'));
  assert.ok(landing.lastIndexOf('<BrandMobileStart />') < landing.indexOf('<footer className="doit-brand-legal">'));
});

test('사진 9장 이야기는 그대로 남아 있다', () => {
  const landing = read('src/pages/do-it/landing/page.tsx');
  for (let i = 1; i <= 9; i += 1) assert.match(landing, new RegExp(`eyebrow="0${i} — `), `${i}번째 이야기`);
});

test('휴대폰으로 넘어가기 — 휴대폰은 앱 버튼, 컴퓨터는 앱 주소 QR', () => {
  const s = read(SECTIONS);
  assert.match(s, /const startUrl = appUrl\('\/doit\/start-journey'\);/);
  assert.match(s, /className="doit-brand-handoff-phone"/);
  assert.match(s, /className="doit-brand-handoff-desk"/);
  assert.match(s, /src="\/brand\/app-qr\.svg"/);
  const qr = 'public/brand/app-qr.svg';
  assert.ok(existsSync(path.join(root, qr)));
  assert.match(read(qr), /<svg[\s\S]*<path/);
  const css = read('src/pages/do-it/landing/components/brand-sections.css');
  assert.match(css, /@media \(min-width:900px\) and \(hover:hover\) and \(pointer:fine\)/);
});

test('아직 없는 기능은 「준비 중」으로 표시하고, 쓰면 안 되는 단어가 없다', () => {
  const s = read(SECTIONS);
  // 대표 최종 승인 2026-09-24 두 번째 구역: 운영에서 아직 아무도 받을 수 없는 「한 사람을 보여드립니다」만 「준비 중」.
  assert.match(s, /line: '때가 되면, 한 사람을 보여드립니다\.', soon: true/);
  for (const t of ['당신의 말을 기억하고.', '당신과 어울리는 결을 알아가고.']) assert.ok(s.includes(`{ line: '${t}' }`), `${t} 는 지금 되는 것`);
  assert.match(s, /title: '당신이 잠든 사이'[^}]*soon: true/);
  assert.match(s, /const SOON_LABEL = '준비 중';/);
  for (const word of ['데이팅', '소개팅', '궁합', '점술', '심리치료', '성격검사', '찾기 시작해요']) assert.ok(!s.includes(word), word);
});

test('스타일은 .doit-editorial 안에서만 — 전역·히어로를 건드리지 않는다(@media 안쪽까지)', () => {
  const css = read('src/pages/do-it/landing/components/brand-sections.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // 모든 { 앞의 머리(선택자)를 모은다. @media 안쪽 선택자도 따로 잡힌다.
  const preludes = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter(Boolean);
  assert.ok(preludes.length > 40, String(preludes.length));
  let checked = 0;
  for (const prelude of preludes) {
    if (prelude.startsWith('@') || /^(from|to|\d+%)$/.test(prelude)) continue;
    for (const part of prelude.split(',')) {
      checked += 1;
      assert.match(part.trim(), /^\.doit-editorial(\[data-motion=paused\])? \.doit-brand-(section|why|mobile|soon|verse|steps|step|handoff|qr|scene|scened|closing|about|greeting)/, part);
    }
  }
  assert.ok(checked > 40, String(checked));
  assert.doesNotMatch(css, /\.doit-brand-(hero|start|art|bottom|company)\b/);
});

test('모바일로 시작하기 — 점 DOIT 지구 그림, 버튼 이름 통일, 컴퓨터는 QR 로 내려간다', () => {
  const s = read(SECTIONS);
  assert.match(s, /export const MOBILE_START_LABEL = '모바일로 시작하기';/);
  assert.match(s, /className="doit-brand-handoff-action" href=\{startUrl\}>\{MOBILE_START_LABEL\}</);
  assert.match(s, /const DOTS_EARTH_SRC = '\/brand\/doit-dots-earth\.webp';/);
  assert.ok(existsSync(path.join(root, 'public/brand/doit-dots-earth.webp')));
  assert.match(s, /alt="[^"]*DOIT[^"]*"/);
  // CSS 의 QR 조건과 JS 의 컴퓨터 판단이 같은 식이어야 한다(어긋나면 QR 이 안 보이는데 내려가기만 한다)
  assert.match(s, /export const DESKTOP_QUERY = '\(min-width:900px\) and \(hover:hover\) and \(pointer:fine\)';/);
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /if \(IS_BRAND_SITE && isDesktop\(\)\)/);
  assert.match(landing, /getElementById\('doit-start-qr'\)/);
  assert.match(s, /className="doit-brand-handoff-desk" id="doit-start-qr"/);
  // 앱에서는 기존 「시작하기」 그대로
  assert.match(landing, /actionLabel=\{IS_BRAND_SITE \? MOBILE_START_LABEL : '시작하기'\}/);
  // 히어로 파일은 이번 작업에서 건드리지 않는다
  assert.doesNotMatch(read('src/components/DoItBrandHero.tsx'), /모바일로 시작하기/);
});

test('이야기 사진 9칸은 사이트 안 파란 사진을 쓴다(9칸 모두 다른 사진)', () => {
  const landing = read('src/pages/do-it/landing/page.tsx');
  const uses = [...landing.matchAll(/imageUrl=\{STORY_IMAGES\.(story_\d\d)\}/g)].map((m) => m[1]);
  assert.deepEqual(uses, ['story_01', 'story_02', 'story_03', 'story_04', 'story_05', 'story_06', 'story_07', 'story_08', 'story_09']);
  assert.doesNotMatch(landing, /imageUrl="https?:/, '이야기 사진이 바깥 서버에 기대지 않는다');
  const storyFiles = [...landing.matchAll(/story_\d\d: '(\/brand\/stories\/story-\d\d\.webp)'/g)];
  assert.equal(storyFiles.length, 9, '사진 파일 주소 9개');
  for (const m of storyFiles) {
    const file = path.join(root, 'public', m[1]);
    assert.ok(existsSync(file), m[1]);
    const head = readFileSync(file).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.endsWith('WEBP'), `${m[1]} 는 WebP`);
  }
});

test('홈페이지 배경 사진 4장 — 사이트 안 파일, 꾸밈이라 읽기 도구에 숨김, 히어로·앱에는 없음', () => {
  const s = read(SECTIONS);
  const scenes = [...s.matchAll(/src: '(\/brand\/scenes\/scene-[a-z]+\.webp)'/g)].map((m) => m[1]);
  assert.equal(scenes.length, 4);
  for (const src of scenes) assert.ok(existsSync(path.join(root, 'public', src)), src);
  for (const k of ['why', 'steps', 'handoff', 'closing']) assert.match(s, new RegExp(`<SceneBackdrop scene="${k}" />`));
  assert.match(s, /className="doit-brand-scene" src=\{src\} alt="" aria-hidden="true" loading="lazy"/);
  // 이야기 사진과 배경 사진이 겹치지 않는다
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.doesNotMatch(landing, /\/brand\/scenes\//);
  assert.doesNotMatch(read('src/components/DoItBrandHero.tsx'), /\/brand\/scenes\//);
});

test('글꼴은 이야기 01~09 와 같은 Pretendard 를 굵게 — 가는 바탕체·은빛 그라데이션 글자 없음', () => {
  const css = read('src/pages/do-it/landing/components/brand-sections.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /Gowun/);
  assert.doesNotMatch(css, /background-clip:text/);
  assert.match(css, /\.doit-brand-section-title\{[^}]*font-weight:800/);
  assert.match(css, /\.doit-brand-section\{[^}]*font-family:"Pretendard"/);
});

test('회사 소개 — 홈페이지에만, 바닥글 바로 위, 약관·문의 연결, 없는 기능 약속 없음', () => {
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /\{!IS_APP_SITE && <BrandAbout \/>\}/);
  assert.ok(landing.indexOf('<BrandMobileStart />') < landing.indexOf('<BrandAbout />'));
  assert.ok(landing.indexOf('<BrandAbout />') < landing.indexOf('<footer className="doit-brand-legal">'));
  const s = read(SECTIONS);
  const about = s.slice(s.indexOf('export function BrandAbout'));
  assert.match(about, /href="\/legal\/terms"/);
  assert.match(about, /href="\/legal\/privacy"/);
  assert.match(about, /mailto:0423doit@gmail\.com/);
  for (const word of ['데이팅', '소개팅', '궁합', '점술', '심리치료', '성격검사', '찾아 드려요', '매칭해']) assert.ok(!about.includes(word), word);
});

test('대표 인사말 — 홈페이지 맨 마지막(바닥글 바로 위), 이름, 없는 기능 약속·금지어 없음', () => {
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /\{!IS_APP_SITE && <BrandGreeting \/>\}/);
  assert.ok(landing.indexOf('<BrandAbout />') < landing.indexOf('<BrandGreeting />'));
  assert.ok(landing.indexOf('<BrandGreeting />') < landing.indexOf('<footer className="doit-brand-legal">'));
  const s = read(SECTIONS);
  const g = s.slice(s.indexOf('const GREETING'));
  assert.match(g, /대표<\/span> <strong>박진욱<\/strong>/);
  // 뼈대는 대표가 예전에 직접 쓴 인사말 문장 그대로다(지어낸 일화 없음)
  const original = read('src/pages/home/components/FounderMessageSection.tsx').replace(/&ldquo;|&rdquo;/g, '"').replace(/\s+/g, ' ');
  for (const phrase of ['제가 직접 겪은 경험에서 시작됐습니다', '같은 이야기를 다시 설명하거나', '정정한 내용이 제대로 반영되지 않는 경험을 반복했습니다', 'AI가 나를 대신 판단하는 게 아니라, 내가 나를 이해할 수 있게 도와주면 어떨까', '사람을 정의하거나 정답을 내려주는 AI가 되기를 원하지 않습니다', '내가 나를 알아가게 하는 AI']) {
    assert.ok(original.includes(phrase), `원문에 있음: ${phrase}`);
    assert.ok(g.includes(phrase), `새 인사말에 있음: ${phrase}`);
  }
  // 지금 DO IT 에 없는 기능은 약속하지 않는다
  for (const gone of ['마음날씨', '마음의 날씨', '노래']) assert.ok(!g.includes(gone), gone);
  for (const word of ['데이팅', '소개팅', '궁합', '점술', '심리치료', '성격검사', '찾아 드려요', '매칭해', '—']) assert.ok(!g.includes(word), word);
});

test('휴대폰에서 앱으로 갔다가 「뒤로」로 돌아와도 시작 버튼이 살아 있다(bfcache 잠금 풀기)', () => {
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /window\.addEventListener\('pageshow', unlock\)/);
  assert.match(landing, /window\.removeEventListener\('pageshow', unlock\)/);
  assert.match(landing, /const unlock = \(\) => \{ navLock\.current = false; \};/);
});

// 대표 최종 승인 2026-09-24 「ECHO AGENT v1 / HOMEPAGE FINAL LOCK」(Hero 1안 · Quiet Luxury)
test('HERO FINAL LOCK: Hero 1안 문구·버튼, 자리·클래스(디자인)는 그대로, 「소개팅」 예외 없음', () => {
  const hero = read('src/components/DoItBrandHero.tsx');
  assert.match(hero, /<p className="doit-brand-line">좋아하는 사람보다,<br \/> 편해지는 사람은<br className="doit-brand-mobile-break" \/> 다를 수 있으니까\.<\/p>/);
  assert.match(hero, /onClick=\{start\}>ECHO 시작하기 <svg/);
  assert.match(hero, /<p className="doit-brand-status">ECHO는 당신의 말을 조금씩 기억하며,<br \/> 어떤 관계가 자연스러운지 알아갑니다\.<\/p>/);
  for (const cls of ['doit-brand-badge', 'doit-brand-art', 'doit-brand-intro', 'doit-brand-invitation', 'doit-brand-start', 'doit-brand-bottom']) assert.match(hero, new RegExp(`className="${cls}"`), cls);
  assert.match(hero, /JUST TRY\./);
  // 옛 「소개팅」 히어로 문구와 그 예외는 없어졌다 — 히어로 전체에 금지어 0.
  for (const word of ['데이팅', '소개팅', '궁합', '점술', '심리치료', '성격검사', '찾아오는 인연', 'ECHO와 시작하기']) assert.ok(!hero.includes(word), word);
});
test('두 번째 구역·Trust·Just Try: 대표 문장 그대로, 카드·번호 없이, 기술어 없이', () => {
  const s = read(SECTIONS);
  assert.match(s, /좋은 인연은<br \/>많이 보는 것보다,<br \/>조금 더 알아가는 데서 시작되니까\./);
  for (const t of ['당신의 말을 기억하고.', '당신과 어울리는 결을 알아가고.', '때가 되면, 한 사람을 보여드립니다.']) assert.ok(s.includes(`line: '${t}'`), t);
  assert.match(s, /당신을 함부로<br \/>정의하지 않습니다\./);
  for (const t of ['틀리면 고치고,', '아니라고 한 것은 다시 단정하지 않고,', '아직 모르는 것은 모르는 채로 둡니다.']) assert.ok(s.includes(`'${t}'`), t);
  assert.ok(s.includes("const TRUST_CLOSING = ['천천히 알아가는 것.', '사람에게도, AI에게도 필요하니까.'];"));
  assert.match(s, /<p className="doit-brand-section-kicker">JUST TRY<\/p>/);
  assert.match(s, /좋은 관계가 시작되는 데<br \/>거창한 용기는<br \/>필요하지 않을지도 모릅니다\./);
  assert.ok(s.includes("const JUST_TRY: string[] = ['한 번의 대답.', '한 번의 선택.', '한 번의 만남.'];"));
  assert.match(s, /작은 시도에서 시작됩니다\./);
  // Quiet Luxury: 기능 카드·번호 나열 없음(옛 카드 틀 0), Just Try 에 버튼 없음.
  assert.ok(!s.includes('doit-brand-card'), '카드 없음');
  const justTry = s.slice(s.indexOf('export function BrandJustTry'), s.indexOf('export function BrandMobileStart'));
  assert.ok(!/<a |<button/.test(justTry), 'Just Try 에 버튼·링크 없음');
  for (const word of ['State Machine', 'Correction Engine', 'Semantic', 'Information Status', 'LLM', 'Vector', 'Agent', '상태머신', '벡터', 'Mission', 'KEY', 'Outcome']) assert.ok(!s.includes(word), word);
  const landing = read('src/pages/do-it/landing/page.tsx');
  assert.match(landing, /\{!IS_APP_SITE && <BrandTrust \/>\}/);
  assert.match(landing, /\{!IS_APP_SITE && <BrandJustTry \/>\}/);
  assert.ok(landing.indexOf('<BrandTrust />') > landing.indexOf('id="doit-stories"') && landing.indexOf('<BrandJustTry />') < landing.indexOf('<BrandMobileStart />'));
  assert.ok(!/brand-sections\.css/.test(read('src/pages/do-it/landing/page.tsx')), '새 스타일 파일 없음');
});
test('§7 상태 문구: 옛 「사람 연결은 준비 중」·「목적 선택과 프로필 준비까지」를 지우고 운영보다 앞서가지 않는 문장만', () => {
  const landing = read('src/pages/do-it/landing/page.tsx').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.ok(!landing.includes('사람 연결은 준비 중입니다'));
  assert.ok(!landing.includes('목적 선택과 프로필 준비까지'));
  assert.match(landing, /<p>지금은 당신의 이야기를 듣는 데서 시작합니다\.<br \/>다음 단계는 ECHO가 준비하고 있습니다\.<\/p>/);
  // 연결을 약속하는 말(찾아 드려요·매칭·연결해 드려요)을 쓰지 않는다.
  for (const word of ['찾아 드려요', '매칭', '연결해 드려요', '연결됩니다']) assert.ok(!landing.includes(word), word);
});
