// 2026-10-10 대표 「모바일웹 = Flora」로 바탕 값이 Flora 밤 들판으로 바뀜(아래 네 검사). 상태 토큰·화면별 새 바탕 0 검사는 그대로.
// 2026-10-01 대표 「ECHO MOBILE BACKGROUND FINAL LOCK」 검사 · 2026-10-05 대표 「배경색부터 내가 보낸 사진 똑같이」로 색 값만 새 기준 시안 실측값으로 바뀜.
// - 모든 파스텔 모바일 화면 = pastel-bg.css 한 벌(화면별 새 바탕 0).
// - 색 흐름: 위 Aqua/Cyan + Pastel Blue → 가운데 Mint/Green + Aqua → 아래 Soft Yellow → Coral/Peach. 갈색·올리브 0.
//   값은 대표 기준 이미지(2026-10-01 「이 색감」)를 실측한 것 — 왼쪽은 민트→노랑→코랄, 오른쪽은 아쿠아가 길게 내려와 피치로.
// - 띠 경계가 보이지 않게: 띠는 흐림(blur 40px) 아래에서만 쓴다. 띠 사이 색 차이가 너무 크면 흐림으로도 경계가 남는다.
// - 상태 변화는 색 교체가 아니라 밝기·채도·움직임 토큰으로만.
// 실제 화면 픽셀 측정(390px · 15개 후반부 화면)은 qa-browser 측정 도구로 했다 — 이 파일은 코드 계약만 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const read = (f) => readFileSync(f, 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const BG = 'src/doit/components/feature/pastel-bg.css';
const STATES = 'src/doit/components/feature/pastel-states.css';
const bg = strip(read(BG));

// 2026-10-10 대표 「기존 모바일디자인 데이터에서 지워 … Flora 코드·시안 그대로」: 파스텔 띠(11줄 × 5색 · 흐림 40px)와 시안 그림 바탕을 지웠다.
// 바탕 한 벌 원칙은 그대로 — 이제 그 한 벌은 Flora 「Kindle」 밤 들판(움직이는 캔버스 하나 + 같은 땅색 #010b24).
const FLORA_GROUND = '#010b24';
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

test('바탕은 한 벌: Flora 밤 들판 캔버스 하나(앱 뿌리에서 한 번) + 같은 땅색 · 옛 파스텔 띠·흐림 0', () => {
  assert.equal((bg.match(/linear-gradient\(90deg/g) ?? []).length, 0, '파스텔 띠 0');
  assert.doesNotMatch(bg, /blur\(40px\)/, '띠 흐림 0');
  assert.ok(bg.includes(`--pastel-underlay:${FLORA_GROUND}`));
  const app = read('src/doit/DoitApp.tsx');
  assert.equal((app.match(/<FloraBackdrop \/>/g) ?? []).length, 1, '캔버스는 앱 뿌리에서 한 번');
  const flora = strip(read('src/doit/components/feature/flora-theme.css'));
  assert.match(flora, /\.doit-flora-backdrop\{position:fixed;inset:0;/);
});

test('색 흐름(Flora 원본 --scene-field-*): 땅 #010b24 → 깊은 남색 → 파랑 → 빛 #9fc2ff · 어두운 쪽부터 밝아진다', () => {
  const fb = read('src/doit/flora/FloraBackdrop.tsx');
  const field = fb.match(/const FIELD: BackdropTokens = \{ ground: "(#[0-9a-f]{6})", deep: "(#[0-9a-f]{6})", mid: "(#[0-9a-f]{6})", hot: "(#[0-9a-f]{6})", light: "(#[0-9a-f]{6})" \};/);
  assert.ok(field, 'FIELD 토큰');
  const [, ground, deep, mid, hot, light] = field;
  assert.equal(ground, FLORA_GROUND);
  assert.equal(light, '#9fc2ff');
  const L = [ground, deep, mid, hot, light].map(lum);
  for (let i = 1; i < L.length; i++) assert.ok(L[i] > L[i - 1], `밝기 순서 ${i}`);
});

test('옛 파스텔 바탕 그림·리본 그림·사주/타로 시작 그림 0: 파일도 참조도 없다(2026-10-10 「심볼만 살려」)', () => {
  const gone = ['public/doit/bg/echo-mobile-bg.webp', 'public/doit/echo-ribbon.webp', ...['ribbon-01', 'ribbon-02', 'ribbon-03', 'candidate-gallery', 'wait-avatars', 'wait-ribbons', 'zzarit-current', 'key-glass', 'saju-start', 'tarot-start'].map((n) => `public/doit/art/${n}.webp`)];
  for (const f of gone) assert.throws(() => statSync(f), f);
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk('src').filter((f) => /\.(tsx?|css)$/.test(f))) {
    const code = strip(read(f)).replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /echo-mobile-bg\.webp|echo-ribbon\.webp|\/doit\/art\/(ribbon-0\d|candidate-gallery|wait-avatars|wait-ribbons|zzarit-current|key-glass|saju-start|tarot-start)\.webp/, f);
  }
});

test('스크롤 바탕(밑깔림) 네 곳이 같은 땅색 = 앱 첫 바탕색(#010b24)', () => {
  assert.ok(bg.includes(`--pastel-underlay:${FLORA_GROUND}`));
  assert.ok(read('src/components/route-fallback.css').includes(`.echo-route-fallback--pastel{background:${FLORA_GROUND}`));
  assert.match(read('src/doit/doit.css'), new RegExp(`background:\\s*${FLORA_GROUND};`));
  assert.match(read('src/lib/themeColor.ts'), new RegExp(`APP_PASTEL = '${FLORA_GROUND}'`));
  assert.match(read('vite.config.ts'), new RegExp(`APP_START_COLOR = "${FLORA_GROUND}"`));
});

test('상태 변화 = 밝기·채도·움직임 토큰만(색·바탕 교체 0)', () => {
  const st = strip(read(STATES));
  assert.match(read('src/doit/components/feature/app-pastel.css'), /@import "\.\/pastel-states\.css";/);
  for (const m of st.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const [sel, body] = [m[1].trim(), m[2]];
    if (sel.startsWith('@media')) continue;
    assert.match(sel, /^\.doit-app-pastel(:has\([^{}]*\))?$/, sel);
    for (const decl of body.split(';').map((d) => d.trim()).filter(Boolean)) assert.match(decl, /^--echo-pastel-(light|sat|drift|shift):/, `${sel} ${decl}`);
  }
  for (const k of ['.echo-waiting', '.doit-mutual', '.doit-match[data-state="ask"]', '.doit-match[data-state="wait"]', '.doit-match[data-state="talk"]', '.doit-match-messages li[data-mine]', '.doit-match[data-state="closed"]', '.doit-settings', '.doit-leave-preview']) assert.ok(st.includes(k), k);
  // data-state 값은 연결 카드가 실제로 쓰는 값(ask·wait·talk·closed)
  const cm = read('src/doit/components/feature/ConnectionMatches.tsx');
  assert.match(cm, /const stage = !match\.my_answer \? 'ask' : !match\.revealed \? 'wait' : 'talk';/);
  assert.match(cm, /data-state="closed"/);
  // 대화(채팅)는 효과만 약하게 · 설정은 더 밝게 · 탈퇴는 채도를 낮춘다(같은 색)
  const tok = (sel, k) => Number(st.match(new RegExp(`${sel.replace(/[.()[\]"=]/g, '\\$&')}\\{[^}]*--echo-pastel-${k}:([\\d.]+)`))?.[1]);
  assert.ok(tok('.doit-app-pastel:has(.doit-match-messages li[data-mine])', 'sat') < 1);
  assert.ok(tok('.doit-app-pastel:has(.doit-settings)', 'light') > 1);
  assert.ok(tok('.doit-app-pastel:has(.doit-leave-preview)', 'sat') < 1 && tok('.doit-app-pastel:has(.doit-leave[role="status"])', 'sat') < tok('.doit-app-pastel:has(.doit-leave-preview)', 'sat'));
});

test('화면별 새 바탕 0: 다른 파일은 전체 화면 그라데이션 바탕을 새로 만들지 않는다', () => {
  // 회사 홈페이지(검정 테마 · 파스텔 앱 화면 아님)의 장면 창 사진 위 어두운 막은 대상 아님(2026-10-05 대표 「버튼 누르면 배경 그림이 뜨고 설명」).
  const allowed = new Set([BG, 'src/components/route-fallback.css', 'src/doit/doit.css', 'src/doit/pages/do-it/fortune/fortune-space.css', 'src/pages/do-it/brand-home/brand-home.css']);
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk('src').filter((f) => f.endsWith('.css'))) {
    if (allowed.has(f)) continue;
    const css = strip(read(f));
    // 전체 화면을 덮는 판(고정·inset:0·화면 높이)이 그라데이션 바탕을 새로 깔면 실패(버튼·카드 같은 작은 판은 대상 아님)
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const body = m[2]; if (!/background(-image)?:[^;]*gradient\(/.test(body)) continue;
      const fullScreen = /position:\s*fixed/.test(body) && /inset:\s*0/.test(body) || /min-height:\s*100(d?vh|%)/.test(body);
      assert.ok(!fullScreen, `${f}: ${m[1].trim().slice(0, 80)}`);
    }
  }
  // 사주·타로: 같은 파스텔 위 조명만(어두운 세계 0) — 덮개는 옅게(≤ .15)
  const fs = strip(read('src/doit/pages/do-it/fortune/fortune-space.css'));
  assert.ok(Number(fs.match(/--echo-pastel-veil:([\d.]+)/)[1]) <= 0.15);
  assert.match(read('src/doit/pages/do-it/fortune/page.tsx'), /className="doit-app-pastel echo-fortune-space"/);
});
