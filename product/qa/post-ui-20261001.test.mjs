// 2026-10-01 대표 「POST-IMPLEMENTATION UI/STATE MASTER」 — 후반부(후보 → 서로 골랐어요 → 첫 질문 → 공개 → 이야기 → 결과 · 설정) 화면 원본 검사.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const css = read('src/doit/components/feature/connect.css');
const pastel = css.slice(css.lastIndexOf('/*', css.indexOf('POST-IMPLEMENTATION UI/STATE MASTER'))).replace(/\/\*[\s\S]*?\*\//g, '');
const CAND = read('src/doit/components/feature/ConnectionCandidates.tsx');
const MATCH = read('src/doit/components/feature/ConnectionMatches.tsx');
const SET = read('src/doit/pages/do-it/settings/page.tsx');

test('배경 유지 · 파스텔 안에서 후반부 어두운 판 0(대화 화면과 같은 투명 판 + 흰 테두리)', () => {
  for (const sel of ['.doit-candidate', '.doit-match', '.doit-turns']) assert.match(pastel, new RegExp(`\\.doit-app-pastel :is\\([^)]*\\${sel}[^)]*\\)\\{background:var\\(--echo-surface-soft\\)`));
  assert.match(pastel, /\.doit-app-pastel :is\(\.doit-match-consent,\.doit-match-leave,\.doit-outcome\)\{background:transparent/);
  assert.match(pastel, /\.doit-match-messages li\[data-mine=true\]\{background:rgb\(255 255 255\/\.24\)[^}]*color:#fff\}/, '내 말풍선 흰 글자 대비');
  assert.doesNotMatch(pastel, /#14171c|#1c1f25|#22262d|#090a0c/, '파스텔 덮개에 어두운 색 0');
  assert.doesNotMatch(pastel, /(^|[\s,}])(body|html|:root)\s*[{,]/, '전역 규칙 0');
});

test('모션: 토큰(180·280·420·700ms · 3 곡선) · opacity/transform 만 · 줄이기 설정이면 움직임 0 · 유리는 서로 골랐어요 하나', () => {
  for (const t of ['--echo-dur-fast:180ms', '--echo-dur-base:280ms', '--echo-dur-medium:420ms', '--echo-dur-slow:700ms', '--echo-ease-standard', '--echo-ease-emphasized', '--echo-ease-decelerate']) assert.ok(pastel.includes(t), t);
  for (const k of pastel.matchAll(/@keyframes [\w-]+\{([^@]*?)\}\}/g)) assert.doesNotMatch(k[1], /width|height|top|left:|margin|filter/, `레이아웃 움직임 0: ${k[0].slice(0, 40)}`);
  assert.match(pastel, /@media\(prefers-reduced-motion:reduce\)\{[^@]*animation:none/);
  assert.equal((pastel.match(/(?<!-webkit-)backdrop-filter:blur/g) ?? []).length, 1, '유리 흐림은 한 곳');
  assert.match(pastel, /\.doit-app-pastel \.doit-mutual\{[^}]*backdrop-filter:blur\(12px\)/);
  assert.doesNotMatch(pastel + CAND, /confetti|🎉|heart|하트/i, '폭죽·하트 보상 0');
});

test('기다림 = 숨 쉬는 점(돌아가는 표시 0) · 서로 골랐어요 = 두 신호 정렬 · 서버 mutual 뒤에만', () => {
  assert.match(CAND, /className="doit-connect-note echo-waiting"><span className="echo-signal-pulse" aria-hidden="true" \/>선택을 보냈어요\. 상대도 선택하면 알려드릴게요\./); // 2026-10-04 대표 디자인 교체 문구
  assert.match(MATCH, /className="doit-connect-note echo-waiting"><span className="echo-signal-pulse" aria-hidden="true" \/>상대의 답을 기다리고 있어요\./);
  assert.doesNotMatch(CAND + MATCH, /spinner|animate-spin/);
  // 2026-10-01 ZZARIT 로 바뀜: 두 신호 맞춤은 ZzaritMoment 안에만, 그 화면은 서버 mutual + match_id 뒤에만 연다.
  const mutualAt = CAND.indexOf('if (mutual) return');
  assert.ok(CAND.indexOf('<ZzaritMoment') > mutualAt, 'ZZARIT 은 서버 mutual 화면 안에만');
  // 2026-10-10 대표 「B로 채택」: 찌릿 = 두 구슬 + 전류(FxStage storm-pair) 하나 · 기다림 = 익명 노드 둘 + 점선(아직 이어지지 않음)
  const Z = read('src/doit/components/feature/ZzaritMoment.tsx');
  assert.match(Z, /<FxStage fx="storm-pair"/);
  assert.match(Z, /<AnonNode \/>\s*<span className="echo-wait-link" \/>\s*<AnonNode \/>/);
});

test('사용자 화면에 내부 설계 말 0(65% · 35% · Reveal · Lock · KEY Unlock · 상태 이름)', () => {
  const ui = [CAND, MATCH, SET].map((s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')).join('\n');
  const strings = [...ui.matchAll(/>([^<>{}]+)</g), ...ui.matchAll(/'([^'\n]{4,})'/g)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(strings, /\d+\s*%|Reveal|Lock|KEY Unlock|candidate_scene|blind_first|partial_reveal|full_reveal/);
});

test('설정: 누가 무엇을 보나(서버 규칙 그대로 · 스위치 0) · 사주·타로 · 도움말 · 로그아웃 뒤 남는 것 · 알림 칸 0(없는 기능 0)', () => {
  assert.match(SET, /두 사람이 모두 「이어지고 싶어요」를 고르면 연결이 열려요/);
  assert.match(SET, /닉네임·대표 사진·소개·고른 만남·그 답이 서로 보여요/);
  assert.doesNotMatch(SET, /type="checkbox"|role="switch"|toggle/i, '공개 범위를 바꾸는 척하는 스위치 0');
  assert.match(SET, /to="\/doit\/fortune"[^>]*title="사주 보기"/);
  assert.match(SET, /입력한 생년월일은 저장하지 않아요\./);
  assert.match(SET, /mailto:0423doit@gmail\.com/);
  assert.match(SET, /로그아웃해도 대화·연결·사진은 내 계정에 그대로 남아요/);
  assert.doesNotMatch(SET.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''), /알림 설정|푸시 알림/);
});
