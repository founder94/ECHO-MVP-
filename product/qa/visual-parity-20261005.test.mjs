// 2026-10-05 대표 「승인 시안과 실제 구현의 시각 일치」 — 소스 규칙 검사(모의 · 실기기 아님).
// 이번 범위는 생김새·문구 표현만: 정정 네 버튼의 뜻·순서·서버 호출, 서버 계약은 그대로인지 같이 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((sel) => sel && !sel.startsWith('@') && !/^(from|to|\d+%)$/.test(sel));
  assert.ok(rules.length > 20, String(rules.length));
  const top = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } return [...out, cur]; };
  for (const sel of rules) for (const part of top(sel)) {
    assert.match(part, /doit-app-pastel|echo-dialogue|echo-chat|echo-check/, `범위 밖 선택자: ${part}`);
    assert.doesNotMatch(part.replace(/:root:root\s*/g, ''), /^\s*(:root|html|body)\s*[{,]?\s*$/, `전역: ${part}`);
  }
});

test('유리: 짙은 판(62%) → 비치는 유리(42%) + 흐림 · 정정 화면 바깥 판 0', () => {
  assert.match(CSS, /--echo-glass:rgb\(8 22 28\/\.58\)/);
  // 대비 계산: 파스텔 바탕(pastel-bg.css 의 모든 색) 위에 판을 겹친 색 vs 흰 글자 ≥ 4.5:1
  const cols = [...new Set(read('src/doit/components/feature/pastel-bg.css').match(/#[0-9a-fA-F]{6}/g))].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  for (const name of ['--echo-glass', '--echo-glass-soft', '--echo-glass-btn']) {
    const m = CSS.match(new RegExp(`${name}:rgb\\((\\d+) (\\d+) (\\d+)\\/(\\.\\d+)\\)`)); assert.ok(m, name);
    const g = [m[1], m[2], m[3]].map(Number), a = Number(m[4]);
    // 바탕 = 대표 승인 그림(#131) + 대체 파스텔 색. 그림의 가장 밝은 점은 따로 재어 둔 값(그림이 바뀌면 지문이 달라져 이 검사가 다시 재라고 실패한다).
    const BG_SHA = 'f52e14b6af9bc8f39019f7117d66f487a5668c74984f8d69408534e5c63cdca3', BRIGHTEST = [247, 253, 183];
    assert.equal(createHash('sha256').update(readFileSync('public/doit/bg/echo-mobile-bg.webp')).digest('hex'), BG_SHA, '바탕 그림이 바뀜 → 가장 밝은 점을 다시 재고 판 투명도를 확인');
    const worst = Math.min(...[...cols, BRIGHTEST].map((c) => { const mix = c.map((v, i) => a * g[i] + (1 - a) * v); return 1.05 / (lum(mix) + 0.05); }));
    assert.ok(worst >= 4.5, `${name} 흰 글자 대비 ${worst.toFixed(2)}:1`);
  }
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

test('이용 안내 열쇠 그림: 모바일만 유리 열쇠 그림 · 홈페이지는 예전 아이콘(모바일 그림이 홈페이지로 새지 않음)', () => {
  assert.match(read('src/components/guide/GuideHost.tsx'), /s\.id === 'key' && \(theme === 'app' \? <img className="echo-guide-key-art" src="\/doit\/art\/key-glass\.webp"[^>]*\/> : <KeyIcon size=\{22\} \/>\)/);
});
