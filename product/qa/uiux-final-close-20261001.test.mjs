// 2026-10-01 대표 「CLAUDE UI/UX FINAL CLOSE」: 화면이 서버 상태를 지어내지 않는다 · 사주/타로는 참고 콘텐츠.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');

test('타로 결과: 연결(매칭)을 약속하지 않고, 대화의 주체는 ECHO', () => {
  const s = read('src/doit/app/plan-a/screens/FreeResult.tsx');
  assert.doesNotMatch(s, /잘 맞는 사람을 찾는 데/, '타로가 연결을 돕는다는 약속');
  assert.doesNotMatch(s, /AI와 조금 더 이야기하기/, 'AI 가 주체인 버튼');
  assert.match(s, /ECHO와 조금 더 이야기하기/);
  assert.match(s, /카드는 재미로 보는 참고예요\./);
});

test('연결 준비 「다음 할 일」: 목적·자격은 서버 readiness 값 — 서버가 자격 없음이면 「모두 마쳤어요」 0', () => {
  const s = read('src/doit/components/feature/AsleepConnections.tsx');
  assert.match(s, /const purposeLeft = sr \? !sr\.purpose : false;/);
  assert.match(s, /\{next \? next\.title : eligible \? '연결 준비를 모두 마쳤어요' : 'ECHO가 연결 준비를 확인하고 있어요'\}/);
});

test('첫 화면: 온보딩이 도는 동안 다음 화면(/doit 틀 + 시작 흐름) 조각을 미리 받는다 — 앱 빌드만(브랜드 빌드에 앱 화면 0)', () => {
  const s = read('src/pages/do-it/intro/page.tsx');
  assert.match(s, /if \(import\.meta\.env\.VITE_SITE_ROLE !== 'brand' && toProduct\) \{/);
  assert.match(s, /void import\('@\/doit\/DoitApp'\)\.catch\(\(\) => \{\}\);/);
  assert.match(s, /void import\('@\/doit\/pages\/do-it\/start-journey\/page'\)\.catch\(\(\) => \{\}\);/);
  // 미리 받는 경로가 실제 라우트의 지연 조각과 같은 모듈이어야 효과가 있다
  assert.match(read('src/doit/routes.tsx'), /const DoitApp = lazy\(\(\) => import\("@\/doit\/DoitApp"\)\);/);
  assert.match(read('src/doit/routes.tsx'), /const StartJourney = lazy\(\(\) => import\("@\/doit\/pages\/do-it\/start-journey\/page"\)\);/);
});

test('DESIGN 100%: 서로 선택 화면 효과는 하나(신호 맞춤) · 탈퇴 최종 버튼은 흰 판 + 적갈색 글씨(붉은 경고 판 0)', () => {
  const connect = read('src/doit/components/feature/connect.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const settleRule = connect.match(/([^{}]+)\{animation:echo-settle/)[1];
  assert.doesNotMatch(settleRule, /\.doit-mutual/, '서로 선택 화면에 올라오기 효과가 겹침');
  assert.match(connect, /\.echo-mutual-align i:first-child\{[^}]*animation:echo-align-left/);
  const settings = read('src/doit/pages/do-it/settings/settings.css');
  assert.match(settings, /\.doit-app-pastel \.doit-leave-confirm\{background:#fff;border-color:#fff;color:#8a3a32;/);
});
