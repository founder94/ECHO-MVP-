// 2026-09-27 대표 「AI TRUST MICROCOPY」 승인 문구 고정: 대화 시작 화면(첫 질문) 한 곳 · 작은 보조 글씨 · 경고·면책 표현 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const COPY = 'AI는 가끔 다르게 이해할 수 있어요. 틀리면 바로 고칠 수 있습니다.';
const root = new URL('../src/', import.meta.url).pathname;
const files = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) ? [p] : []; });
const all = files(root).map((p) => ({ p, s: readFileSync(p, 'utf8') }));

test('승인 문구는 첫 질문 화면(ConversationOpening) 한 곳에만 · echo-fine 보조 글씨', () => {
  const hits = all.filter((f) => f.s.includes(COPY));
  assert.deepEqual(hits.map((f) => path.basename(f.p)), ['ConversationOpening.tsx']);
  assert.equal(hits[0].s.split(COPY).length - 1, 1, '한 번만');
  assert.match(hits[0].s, new RegExp(`<p className="echo-fine">${COPY.replace(/[.]/g, '\\.')}</p>`));
});
test('면책문·경고 표현 0', () => {
  for (const bad of ['AI는 부정확할 수 있습니다', 'AI의 답변을 신뢰하지 마세요', 'AI는 오류를 발생시킬 수 있습니다']) assert.ok(!all.some((f) => f.s.includes(bad)), bad);
});
