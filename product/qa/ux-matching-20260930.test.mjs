// 2026-09-30 대표 「CLAUDE CODE FINAL MASTER」 화면 원본 검사 — 궁금증 단계 공개 · 대기 · 서로 골랐어요 · 첫 질문 안내 · 차단/신고 · 거짓 표시 0.
// 실제 화면 흐름은 브라우저 시나리오(scratchpad ux-flow.mjs · 서버 응답은 계약 그대로 대신 준다)가 따로 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const code = (p) => read(p).replace(/^\s*\/\/.*$/gm, '');
const CAND = code('src/doit/components/feature/ConnectionCandidates.tsx');
const MATCHES = code('src/doit/components/feature/ConnectionMatches.tsx');

test('후보는 한 번에 펼치지 않는다: 한 사람 → 이유가 있다는 것 → 「왜 이 사람인지 보기」 → 이유 → 선택', () => {
  assert.match(CAND, /한 사람을 발견했어요\./);
  assert.match(CAND, /이분의 이야기를 들어볼까요\? ECHO가 이어 본 이유부터 보여 드릴게요\./); // 2026-10-05 디자인 기준 §6 ⑥ 문구
  assert.match(CAND, /aria-expanded="false">더 알아보기</); // 2026-10-05 §6 ⑥ 「더 알아보기」 = 이유 열기(동작 그대로)
  const closed = CAND.indexOf('{!open && <>'), reasons = CAND.indexOf('c.reasons.map'), actions = CAND.indexOf("choose(c, 'yes')");
  assert.ok(closed > 0 && closed < reasons && reasons < actions, '이유와 선택은 연 뒤에만');
  assert.match(CAND, /const open = c\.waiting \|\| !!opened\[c\.id\];/, '이미 고른 후보는 열린 채');
});

test('거리·위치·점수·가짜 타이머 0 · 서버가 주지 않는 거리 문구를 만들지 않는다', () => {
  for (const s of [CAND, MATCHES]) {
    assert.doesNotMatch(s, /distance|latitude|longitude|\bkm\b|현재 위치|지도|생활권|가까운 곳/);
    assert.doesNotMatch(s, /%|점수|궁합|운명|완벽/);
    assert.doesNotMatch(s, /setTimeout|setInterval\(\(\) => set|Math\.random|mock|dummy/i);
  }
});

test('대기: 「선택을 보냈어요」(2026-10-04) · 상대가 관심 있다는 말 0 · 서로 골랐어요 보상은 서버 mutual 뒤에만', () => {
  assert.match(CAND, /선택을 보냈어요\. 상대도 선택하면 알려드릴게요/);
  assert.ok(!CAND.includes('내 선택은 전해졌어요'), '예전 문구 0');
  assert.doesNotMatch(CAND.slice(0, CAND.indexOf('if (mutual) return')), /상대도 (당신이 )?궁금|상대도 관심/);
  // 2026-10-01 대표 「COMPLETE PRODUCT FLOW」: 보상 화면 = ZZARIT(문구 「텔레파시가 통했어요.」 · 「서로 같은 선택을 했어요.」 · 「첫 이야기 시작하기」).
  const Z = read('src/doit/components/feature/ZzaritMoment.tsx');
  assert.match(CAND, /if \(out\.status === 'mutual'\) \{/);
  assert.match(CAND, /if \(typeof out\.match_id === 'string'\) \{ if \(claimZzarit\(out\.match_id\)\) setMutual\(\{ matchId: out\.match_id \}\); else onOpened\(out\.match_id\); \}/);
  // 2026-10-04 대표 「찌릿」: 문구 = 「찌릿! 텔레파시가 통했어요」 · 「서로 대화를 원했어요.」 · 다음 = 「다음 단계 보기」(실제 다음 단계 = 첫 질문)
  assert.match(Z, /title: '찌릿! 텔레파시가 통했어요'/);
  assert.match(Z, /body: '두 분 모두 대화를 원했어요\.'/); // 2026-10-05 디자인 기준 §6 ⑨
  assert.match(Z, /next: '다음 단계 보기'/);
  assert.doesNotMatch(CAND + Z, /축하|🎉|!!\s*<\/|요!!/);
  assert.doesNotMatch(Z, /nickname|photo_url|partner|\bbio\b/, 'ZZARIT 에도 상대 정보 0');
  assert.doesNotMatch(CAND, /nickname|photo_url|partner|\bbio\b/, '보상 화면에도 상대 정보 0');
});

test('연결: 서버가 준 match_id 로만 이동 · 첫 질문 안내 · blind-first(상대 정보는 revealed 뒤) · 차단/신고 따로', () => {
  assert.match(CAND, /onStart=\{\(\) => \{ onOpened\(mutual\.matchId\); setMutual\(null\); \}\}/, '서버가 준 match_id 로만 이동');
  assert.match(MATCHES, /document\.getElementById\(`match-\$\{focusId\}`\)/);
  assert.match(MATCHES, /두 분 모두 편하게 시작할 수 있게<br \/>ECHO가 하나만 물어볼게요\./);
  assert.match(MATCHES, /\{match\.revealed && match\.partner && <PartnerFrame /); // 2026-10-01 ECHO FRAME 으로 바뀜(공개 조건은 그대로)
  assert.match(MATCHES, /leave\(true, false\)\} disabled=\{busy\}>차단할게요/);
  assert.match(MATCHES, /setLeaving\('report'\)\} disabled=\{busy\}>신고할게요/); // 2026-10-02: 신고와 차단은 별도(차단은 체크로 고름)
  assert.match(MATCHES, /onClick=\{\(\) => void leave\(alsoBlock, true, code\)\} disabled=\{busy\}>\{label\}/, '신고는 사유를 골라야 보낸다 · 차단은 따로 고름');
  assert.match(MATCHES, /onFocus=\{e => keepVisible\(e\.currentTarget\)\}/, '글자판이 입력칸을 가리지 않게');
});

test('홈 카드·홈페이지: 재진입 첫 문장 · 실제 기능보다 앞서가는 말 0 · 가격 표시 0', () => {
  const api = code('src/doit/lib/connectApi.ts');
  assert.match(api, /당신이 잠든 사이, ECHO가 한 사람을 발견했어요/);
  const brand = read('src/pages/do-it/landing/components/BrandSections.tsx');
  assert.match(brand, /ECHO가 내 말과 겹치는 사람을 먼저 살펴봐요\. 두 사람이 모두 고를 때만 이어져요\./);
  for (const s of [CAND, MATCHES, api]) assert.doesNotMatch(s, /\d[\d,]*\s*원|4,900|결제|프리미엄/);
});

test('via_mutual(2026-10-01): 먼저 고른 사람도 서버가 via_mutual=true 를 줄 때만 「상대도 당신이 궁금했대요」 · 관리자 연결·예전 서버는 안 보임', () => {
  assert.match(MATCHES, /stage === 'ask' && match\.via_mutual === true && <p className="doit-mutual-title">상대도 당신이 궁금했대요\.<\/p>/);
  assert.equal((MATCHES.match(/상대도 당신이 궁금했대요/g) ?? []).length, 1, '다른 조건에서 이 문구를 쓰지 않는다');
  assert.match(code('src/doit/lib/connectApi.ts'), /via_mutual\?: boolean;/);
});
