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
  assert.match(r, /ROLE === 'brand' \? <BrandHomePage \/> : <DoItLandingPage \/>/);
  assert.match(r, /const BrandHomePage = lazy\(\(\) => import\('@\/pages\/do-it\/brand-home\/page'\)\);/);
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
