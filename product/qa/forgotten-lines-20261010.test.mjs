// 2026-10-10 「ECHO가 아는 나」 지운 줄 수 — 사용자가 지운 「줄」마다 1(같이 숨긴 원문 복사본 제외) · 자기 문장(self:) 지우기도 센다(Codex P2 4236014724).
// 가짜 DB·가짜 AI(qa/agent-server.test.mjs 의 장치를 그대로 씀) — 실제 DB·제공사 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
let helper = readFileSync(new URL('./agent-server.test.mjs', import.meta.url), 'utf8');
helper = helper.slice(0, helper.indexOf("test('로그인 안 함"));
helper = helper.replace("import ts from 'typescript';", `import ts from ${JSON.stringify(pathToFileURL(path.resolve('node_modules/typescript/lib/typescript.js')).href)};`)
  .replace("const DIR = new URL('../supabase/functions/doit-agent/', import.meta.url);", `const DIR = new URL(${JSON.stringify(new URL('../supabase/functions/doit-agent/', import.meta.url).href)});`);
helper += '\nexport {load,newState,T,Q,X,rid};\n';
const file = pathToFileURL(path.join(mkdtempSync(path.join(tmpdir(), 'forgotten-')), 'helpers.mjs'));
writeFileSync(file, helper);
const { load, newState, T, Q, X, rid } = await import(file.href);

test('지운 줄 수: 자기 문장 지우기 +1 · 문장 추가는 수를 지우지 않음 · 대화 줄 지우기와 합산', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '편한 친구', '친구. 편하게 만나고 싶어요')], ...Q('attraction_comfort', '어떤 사람이 편해요?') }));
  const start = await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구. 편하게 만나고 싶어요' });
  assert.equal(start.status, 200); const sid = start.body.session.id;
  const n1 = await h.call({ action: 'agent_self_note', requestId: rid(), text: '저는 사람 많은 데를 좋아해요', origin: 'ref_correction' });
  const n2 = await h.call({ action: 'agent_self_note', requestId: rid(), text: '아침에 산책하는 걸 좋아해요', origin: 'self' });
  assert.equal(n1.status, 200); assert.equal(n2.status, 200);
  const selfLine = n2.body.known.corrected.find((l) => l.text === '저는 사람 많은 데를 좋아해요');
  assert.ok(selfLine?.key.startsWith('self:'));
  assert.equal(n2.body.known.forgotten, 0);
  const f1 = await h.call({ action: 'agent_forget', requestId: rid(), sessionId: sid, key: selfLine.key });
  assert.equal(f1.status, 200);
  assert.equal(f1.body.known.forgotten, 1, '자기 문장 지우기 = +1');
  assert.equal(f1.body.session.known.forgotten, 1, '세션 화면 값도 같음');
  assert.ok(!f1.body.known.corrected.some((l) => l.key === selfLine.key));
  // 새 문장을 더해도 지운 수는 그대로
  const n3 = await h.call({ action: 'agent_self_note', requestId: rid(), text: '조용한 카페를 좋아해요', origin: 'self' });
  assert.equal(n3.body.known.forgotten, 1, '문장 추가가 지운 수를 지우지 않음');
  // 대화 줄 지우기와 합산
  const g = await h.call({ action: 'agent_get', sessionId: sid });
  assert.equal(g.body.known.forgotten, 1);
  const line = [...g.body.known.confirmed, ...g.body.known.guesses].find((l) => l.key.startsWith('item:'));
  assert.ok(line, '지울 대화 줄');
  const f2 = await h.call({ action: 'agent_forget', requestId: rid(), sessionId: sid, key: line.key });
  assert.equal(f2.status, 200);
  assert.equal(f2.body.session.known.forgotten, 2, '대화 줄 1 + 자기 문장 1');
  const g2 = await h.call({ action: 'agent_get', sessionId: sid });
  assert.equal(g2.body.known.forgotten, 2);
  // 없는 자기 문장 지우기 = 404 · 수 그대로
  const miss = await h.call({ action: 'agent_forget', requestId: rid(), sessionId: sid, key: 'self:없는-줄' });
  assert.equal(miss.status, 404);
  assert.equal((await h.call({ action: 'agent_get', sessionId: sid })).body.known.forgotten, 2);
});
