// 2026-10-05 대표 「모바일은 조금 더 사람냄새나게 다듬어서 폰트 글자 크기 정렬」 — 소스 규칙 검사(모의 · 실제 렌더·실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const CSS = read('src/doit/components/feature/mobile-polish.css');
const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

test('글자 토큰: 제목 22~24px · 본문·입력 16px · 보조 14px · 작은 글 13px · 줄 높이 1.6/1.34 · 가는 글자 0', () => {
  for (const t of ['--echo-fs-title:clamp(22px,6.2vw,24px)', '--echo-fs-body:16px', '--echo-fs-sub:14px', '--echo-fs-caption:13px', '--echo-lh-body:1.6', '--echo-lh-title:1.34', '--echo-fw-body:400', '--echo-fw-title:400']) assert.ok(bare.includes(t), t);
  assert.doesNotMatch(bare, /font-weight:\s*(100|200|300)\b/, '가는 글자 0(400 = 주아체 한 굵기 · 2026-10-09)');
  assert.doesNotMatch(bare, /font-size:\s*(9|10|11)px/, '11px 이하 글자 0');
  assert.match(bare, /word-break:keep-all/);
});

test('입력칸 16px(아이폰 확대 방지) · 안내 글씨 white/.86', () => {
  assert.match(bare, /:is\(textarea,input:not\(\[type="checkbox"\]\)[^{]*\{[^}]*font-size:var\(--echo-fs-body\)!important/);
  assert.match(bare, /::placeholder\{color:rgb\(255 255 255\/\.86\)!important/);
});

// 2026-10-10 대표 「모바일웹 = Flora」: 판 = Flora 유리(흰 6%) · 바탕 = Flora 밤 들판.
// 실측(390×844 · 손가락 기기 설정 · 6장면): 바탕 99.9% 밝기 0.0197 — Flora 「mid」(#0a2a7a, 0.031)보다 어둡다. 그래서 ground·deep·mid 를 최악 경우로 잰다.
// 「hot」(#2e6bff)은 이번 실측에서 나오지 않았다(PC 마우스 반응 구간은 확인 불가). 그 색 위라면 흰 글자는 3.85:1(유리 10%)로 기준 미달 — 남은 위험으로 보고.
test('대비: 흰 글자 판 = Flora 유리 rgb(255 255 255/.06) — Flora 바탕 위 흰 글자 4.5:1 이상(계산)', () => {
  assert.match(bare, /--echo-glass:rgb\(255 255 255\/\.06\)/);
  assert.match(bare, /--echo-glass-soft:rgb\(255 255 255\/\.10\)/);
  const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const field = read('src/doit/flora/FloraBackdrop.tsx').match(/const FIELD[^;]*;/)[0];
  const [ground, deep, mid] = ['ground', 'deep', 'mid'].map((k) => hex(field.match(new RegExp(`${k}: "(#[0-9a-f]{6})"`))[1]));
  const worst = Math.min(...[ground, deep, mid].flatMap((bg) => [0.06, 0.10].map((a) => { const mix = bg.map((v) => 255 * a + v * (1 - a)); return 1.05 / (L(mix) + 0.05); })));
  assert.ok(worst >= 4.5, `최저 대비 ${worst.toFixed(2)}`);
});

test('홈페이지(brand) 빌드에 안 들어간다: 앱 화면 입구에서만 불러온다', () => {
  assert.match(read('src/doit/DoitApp.tsx'), /import "@\/doit\/components\/feature\/mobile-polish\.css";/);
  for (const f of ['src/pages/login/page.tsx', 'src/pages/signup/page.tsx', 'src/pages/legal/consent/page.tsx']) assert.match(read(f), /import '@\/doit\/components\/feature\/mobile-polish\.css';/, f);
  for (const f of ['src/doit/components/feature/echo-ui.css', 'src/doit/components/feature/app-pastel.css', 'src/pages/legal/LegalDocument.tsx']) assert.ok(!read(f).includes('mobile-polish'), f);
});

test('문구(디자인 기준 §6): ② 시작 · ④ 입력 안내 · ⑥ 후보 · ⑨ 찌릿', () => {
  const sc = read('src/doit/app/plan-a/screens/SignupConsent.tsx');
  // 2026-10-10 대표 「모바일웹 전부 최종 후킹」: 첫 화면 제목 = 승인 히어로 문장 · 버튼 = 「내 이야기 시작하기」 · 「반가워요」는 아래 안내 첫머리로
  assert.match(sc, /<h1>당신이 잠든 사이<br \/>AI가 먼저 만나봅니다<\/h1>/); assert.match(sc, /반가워요\. 로그인해 두면/); assert.match(sc, /계속하려면 약관을 확인해 주세요\./); assert.match(sc, />내 이야기 시작하기 <span aria-hidden="true" className="echo-flora-arrow">↗<\/span><\/button>/);
  assert.match(sc, /동의나 본인 인증으로 저장되지 않아요/, '저장하지 않은 것을 저장했다고 말하지 않음');
  assert.match(read('src/doit/components/feature/AgentConversation.tsx'), /: '편하게 적어주세요\.'\}/);
  assert.match(read('src/doit/components/feature/CoreConversation.tsx'), /placeholder="편하게 적어주세요\."/);
  const c = read('src/doit/components/feature/ConnectionCandidates.tsx');
  assert.match(c, /이분의 이야기를 들어볼까요\?/); assert.match(c, />더 알아보기</);
  assert.match(read('src/doit/components/feature/ZzaritMoment.tsx'), /body: '두 분 모두 연결을 선택했어요\.'/); // 2026-10-09 「추가 효과 배치」 §2 확정 문구
  assert.match(read('src/doit/components/feature/ConversationOpening.tsx'), /어떤 만남을 원하는지 들려주세요\./);
  assert.ok(!read('src/pages/signup/page.tsx').includes('여정'), '추상 문구 「여정」 0');
});

test('누르는 칸 44px: 대화 머리 링크 · 펼치기 · 연결 준비 줄 · 결과 칩 · 뒤로 알약', () => {
  for (const s of ['.echo-dialogue-header>a{display:inline-flex;align-items:center;min-height:44px', '.echo-history summary{display:list-item;min-height:44px', '.doit-asleep-check :is(a,button){display:inline-flex;align-items:center;min-height:44px}', '.doit-outcome-chips button{min-height:44px}', '.doit-back-pill{height:44px']) assert.ok(bare.includes(s), s);
});
