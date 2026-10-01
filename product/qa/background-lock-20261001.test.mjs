// 2026-10-01 대표 「ECHO MOBILE BACKGROUND FINAL LOCK」 검사.
// - 모든 파스텔 모바일 화면 = pastel-bg.css 한 벌(화면별 새 바탕 0).
// - 색 흐름: 위 Aqua/Cyan + Pastel Blue → 가운데 Mint/Green + Aqua → 아래 Soft Yellow → Coral/Peach. 갈색·올리브 0.
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

const hsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
};
const rows = [...bg.matchAll(/linear-gradient\(90deg,([^)]*\)[^)]*\)[^)]*\)[^)]*\)[^)]*\))/g)].map((m) => m[1].match(/#[0-9a-f]{6}/g));

test('바탕은 한 벌: 띠 11줄 × 5색 · 흐림 40px 아래', () => {
  assert.equal(rows.length, 11);
  for (const r of rows) assert.equal(r.length, 5);
  assert.match(bg, /filter:blur\(40px\) saturate\(var\(--echo-pastel-sat,1\)\) brightness\(var\(--echo-pastel-light,1\)\);/);
});

test('색 흐름: 위 Aqua/Cyan+Pastel Blue · 가운데 Mint/Green+Aqua · 아래 Soft Yellow→Coral/Peach', () => {
  const top = rows.slice(0, 3).flat().map(hsl), mid = rows.slice(3, 6).flat().map(hsl), bot = rows.slice(7).flat().map(hsl);
  // 위: 청록~하늘(160°~205°) · 맨 위 오른쪽은 파스텔 파랑(190° 이상)
  for (const c of top) assert.ok(c.h >= 160 && c.h <= 205, `위 색상 ${c.h.toFixed(0)}°`);
  assert.ok(hsl(rows[0][4]).h >= 190 && hsl(rows[1][4]).h >= 190, '위 오른쪽 파스텔 파랑');
  // 가운데: 민트·초록~청록(95°~185° · 아래쪽 끝은 노랑으로 넘어가는 연두까지)
  for (const c of mid) assert.ok(c.h >= 95 && c.h <= 185, `가운데 색상 ${c.h.toFixed(0)}°`);
  // 아래: 노랑~산호·복숭아(5°~95° · 마지막 열은 청록 잔향 허용 없음 → 맨 아래 3줄은 전부 따뜻한 색)
  for (const c of rows.slice(8).flat().map(hsl)) assert.ok(c.h >= 5 && c.h <= 60, `맨 아래 색상 ${c.h.toFixed(0)}°`);
  // 갈색·올리브 0: 따뜻한 색은 밝고(명도 ≥ 66%) 탁하지 않다(채도 ≥ 60%)
  for (const c of bot.filter((c) => c.h <= 70)) { assert.ok(c.l >= 0.66, `어두운 갈색 명도 ${(c.l * 100).toFixed(0)}%`); assert.ok(c.s >= 0.6, `탁한 색 채도 ${(c.s * 100).toFixed(0)}%`); }
});

test('띠 경계가 보이지 않게: 위아래 이웃 띠의 같은 칸 색 차이가 흐림으로 섞이는 범위 안', () => {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 1; i < rows.length; i++) for (let c = 0; c < 5; c++) {
    const a = rgb(rows[i - 1][c]), b = rgb(rows[i][c]);
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    assert.ok(dist <= 125, `띠 ${i - 1}→${i} 칸 ${c} 차이 ${dist.toFixed(0)}`);
  }
});

test('스크롤 바탕(밑깔림) 세 곳이 같은 줄기 · 첫 색 = 앱 첫 바탕색(#3fdcb3)', () => {
  const under = '#3fdcb3 0%,#4ee5b4 25%,#a5e3a5 45%,#efe39d 60%,#f1bf8f 78%,#e68b77 100%';
  assert.ok(bg.includes(`--pastel-underlay:linear-gradient(180deg,${under})`));
  assert.ok(read('src/components/route-fallback.css').includes(`linear-gradient(180deg,${under})`));
  assert.ok(read('src/doit/doit.css').includes(`linear-gradient(180deg, ${under.replaceAll(',', ', ')})`));
  assert.match(read('src/lib/themeColor.ts'), /APP_PASTEL = '#3fdcb3'/);
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
  const allowed = new Set([BG, 'src/components/route-fallback.css', 'src/doit/doit.css', 'src/doit/pages/do-it/fortune/fortune-space.css']);
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
