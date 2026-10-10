// 2026-10-10 출시 차단 P1(Codex G1): WebGL 을 못 쓰면 3D 장면만 정지 이미지로 바꾸고 홈페이지(제목·메뉴·시작 버튼)는 그대로.
// 실제 브라우저 확인(로컬 Chromium · WebGL 끔 · 390/1440)은 PR 기록에 남긴다 — 이 검사는 고친 자리가 다시 사라지지 않게 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SceneHost: 장면 오류는 장면 칸 안에서 막고 정지 이미지로 바꾼다(전역 오류 화면으로 올리지 않음)', () => {
  const b = read('src/vesper/views/home/scene/scene-boundary.tsx');
  assert.match(b, /class SceneBoundary extends Component/);
  assert.match(b, /getDerivedStateFromError\(\)\s*\{\s*return \{ failed: true \}/);
  assert.match(b, /this\.state\.failed \? <SceneStill \/> : this\.props\.children/);
  const s = read('src/vesper/views/home/scene/scene-host.tsx');
  assert.match(s, /<SceneBoundary>\s*<SceneCanvasLazy \/>\s*<\/SceneBoundary>/, '페이지 스레드 장면은 경계 안에서만');
  assert.match(s, /canMainThreadRender \?/, 'WebGL 이 없으면 처음부터 정지 이미지');
  assert.match(s, /getContext\("webgl2"\) \?\? probe\.getContext\("webgl"\)/);
});

test('장면 청크(SceneHostLazy) 자체 실패도 장면 칸에서 막는다 — 경계는 청크 밖(scroll-stage)에서 감싼다', () => {
  const st = read('src/vesper/views/home/scroll-stage.tsx');
  assert.match(st, /<SceneBoundary>\s*<SceneHostLazy \/>\s*<\/SceneBoundary>/);
  assert.match(st, /import \{ SceneBoundary \} from "\.\/scene\/scene-boundary"/);
});

test('전역 ErrorBoundary 는 그대로 둔다(다른 오류는 예전처럼 잡는다)', () => {
  assert.match(read('src/App.tsx'), /ErrorBoundary/);
  assert.match(read('src/components/ErrorBoundary.tsx'), /getDerivedStateFromError/);
});

test('Codex HOME-W01: 워커를 만든 뒤 첫 init 전송이 실패해도 그 워커를 닫는다', () => {
  const s = read('src/vesper/views/home/scene/scene-host.tsx');
  assert.match(s, /let created: Worker \| null = null;/);
  assert.match(s, /worker = created = new Worker\(/);
  assert.match(s, /\} catch \{\s*created\?\.terminate\(\);\s*setFallback\(true\);/);
});

test('Codex P2 4236779305: 로더 별 떨어짐은 떠날 때 resize 듣기를 지운다', () => {
  const s = read('src/vesper/views/home/loader/star-fall.tsx');
  assert.match(s, /window\.addEventListener\("resize", resize/);
  assert.match(s, /return \(\) => \{\s*unsubscribe\(\);\s*window\.removeEventListener\("resize", resize\);\s*\};\s*\}, \[intensity\]\);/);
});

test('Codex P2 4236801008: 로더는 다 채운 뒤 진행률 구독을, 숨긴 뒤 퇴장 구독을 끊는다', () => {
  const s = read('src/vesper/views/home/loader/loader.tsx');
  assert.match(s, /useEffect\(\(\) => \{\s*if \(done\) return;\s*startedAt\.current \?\?= performance\.now\(\);/);
  assert.match(s, /\(\) => 0,\s*\);\s*\}, \[done\]\);/);
  assert.match(s, /if \(!done \|\| hidden\) return;/);
  assert.match(s, /return stop;\s*\}, \[done, hidden\]\);/);
});
