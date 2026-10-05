// 2026-10-05 대표 「승인 시안과 실제 구현의 시각 일치」 — 소스 규칙 검사(모의 · 실기기 아님).
// 이번 범위는 생김새·문구 표현만: 정정 네 버튼의 뜻·순서·서버 호출, 서버 계약은 그대로인지 같이 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');
const CSS = read('src/doit/components/feature/visual-parity.css');
const CHECK = read('src/doit/components/feature/AgentProfileCheck.tsx');
const MATCHES = read('src/doit/components/feature/ConnectionMatches.tsx');

test('앱 화면에서만 불러옴(mobile-polish 바로 뒤) · 홈페이지 빌드 0', () => {
  for (const f of ['src/doit/DoitApp.tsx', 'src/pages/login/page.tsx', 'src/pages/signup/page.tsx', 'src/pages/legal/consent/page.tsx']) {
    const s = read(f); const a = s.indexOf('mobile-polish.css'), b = s.indexOf('visual-parity.css');
    assert.ok(a > 0 && b > a, `${f}: mobile-polish 뒤에 visual-parity`);
  }
  assert.doesNotMatch(read('src/pages/do-it/brand-home/page.tsx'), /visual-parity/);
});

test('전역 오염 0: 모든 규칙이 앱 화면 틀(.doit-app-pastel · .echo-dialogue) 아래에서만', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((sel) => sel && !sel.startsWith('@'));
  assert.ok(rules.length > 20, String(rules.length));
  const top = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } return [...out, cur]; };
  for (const sel of rules) for (const part of top(sel)) {
    assert.match(part, /doit-app-pastel|echo-dialogue|echo-chat|echo-check/, `범위 밖 선택자: ${part}`);
    assert.doesNotMatch(part.replace(/:root:root\s*/g, ''), /^\s*(:root|html|body)\s*[{,]?\s*$/, `전역: ${part}`);
  }
});

test('유리: 짙은 판(62%) → 비치는 유리(42%) + 흐림 · 정정 화면 바깥 판 0', () => {
  assert.match(CSS, /--echo-glass:rgb\(26 52 60\/\.42\)/);
  assert.match(CSS, /--echo-glass-blur:blur\(18px\)/);
  assert.match(CSS, /\.echo-done\{background:transparent!important;border:0!important/);
  assert.match(CSS, /prefers-reduced-transparency:reduce/, '투명도 줄이기 사용자는 더 진한 판');
});

test('정정 네 버튼: 글·순서·하는 일 그대로(맞아요 → 조금 달라요 → 그게 아니에요 → 직접 설명할게요)', () => {
  const at = (s) => CHECK.indexOf(s);
  const order = ["onClick={confirm}>맞아요", "setView({ kind: 'pick' })}>조금 달라요", "setView({ kind: 'pick', reject: true })}>그게 아니에요", "setView({ kind: 'retell', text: '' })}>직접 설명할게요"].map(at);
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), String(order));
  assert.match(CHECK, /await agentTurn\(userId, session\.id, t, \{ purpose \}\)/, '정정 = 같은 서버 호출');
});

test('정보량: 이해한 뜻만 카드 한 장 · 내가 한 말은 「내가 한 말 보기」로(지우지 않음) · 말하지 않은 칸은 한 줄', () => {
  assert.match(CHECK, /quotes && i\.quote && <small>내 말 「\{i\.quote\}」<\/small>/);
  assert.match(CHECK, /\{quotes \? '내가 한 말 접기' : '내가 한 말 보기'\}/);
  assert.match(CHECK, /아직 말하지 않은 것 · \{rest\.map/);
  assert.match(CHECK, /const shown = ids\.length === 1 \? ids : ids\.filter/, '고칠 칸 하나를 볼 때는 빈 칸도 그대로');
  assert.match(CHECK, /<label className="echo-check-label" htmlFor="echo-profile-fix">/, '고치기 안내는 입력칸 위');
});

test('연결 대화: 「입력칸 · 보내기」 한 줄 · 이름표는 화면 읽기용으로 남김', () => {
  assert.match(MATCHES, /rows=\{1\} placeholder="편하게 이야기해 주세요\."/);
  assert.match(MATCHES, /<label className="doit-connect-label" htmlFor=\{`message-\$\{match\.id\}`\}>이어서 이야기하기<\/label>/);
  assert.match(CSS, /\.doit-match-send\{display:grid!important;grid-template-columns:1fr auto/);
});
