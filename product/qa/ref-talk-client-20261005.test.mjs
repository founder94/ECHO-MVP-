// 2026-10-05 Codex echo-spec 20261005 B — 사주·타로 결과 뒤 참고 이야기(앱 쪽). 소스 검사 + 이야기 거리 저장 함수 실행(가짜 sessionStorage · 실기기 아님).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const PAGE = src('src/doit/pages/do-it/conversation/page.tsx');
const TALK = src('src/doit/app/plan-a/screens/RefTalk.tsx');
const API = src('src/doit/lib/agentApi.ts');

async function seedModule() {
  const store = new Map();
  globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const dir = mkdtempSync(path.join(tmpdir(), 'seed-'));
  const f = path.join(dir, 'contentSeed.mjs');
  writeFileSync(f, ts.transpileModule(src('src/doit/lib/contentSeed.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return { m: await import(pathToFileURL(f).href), store };
}

test('이야기 거리: 들여다보기(peek)는 지우지 않음 · 처음 본 계정을 적고 다른 계정이면 버림 · clear 로 지움 · 옛 take 는 그대로', async () => {
  const { m, store } = await seedModule();
  m.setContentSeed({ source: 'TAROT', card: '별' });
  assert.deepEqual(m.peekContentSeed('u1'), { source: 'TAROT', card: '별' });
  assert.deepEqual(m.peekContentSeed('u1'), { source: 'TAROT', card: '별' }, '로그인 복귀·다시 그리기에도 유지');
  assert.equal(m.peekContentSeed('u2'), null, '다른 계정 = 버림');
  assert.equal(store.size, 0);
  m.setContentSeed({ source: 'SAJU', key: 'peer_none' });
  assert.deepEqual(m.peekContentSeed('u2'), { source: 'SAJU', key: 'peer_none' });
  m.clearContentSeed(); assert.equal(m.peekContentSeed('u2'), null);
  m.setContentSeed({ source: 'SAJU', key: 'peer_all' }); assert.equal(m.peekContentSeed('u1'), null, '틀린 키 = 저장 0');
  m.setContentSeed({ source: 'TAROT', card: '달' }); assert.deepEqual(m.takeContentSeed(), { source: 'TAROT', card: '달' }); assert.equal(m.takeContentSeed(), null);
});

test('대화 화면: 결과에서 왔으면(이 계정의 이야기 거리) 목적 고르기·Plan A 대화보다 먼저 참고 이야기 · 「원하는 만남 알아보기」면 보통 흐름', () => {
  assert.match(PAGE, /const refSeed = useMemo\(\(\) => \(userId && ECHO_AGENT_ENABLED && !refDone \? peekContentSeed\(userId\) : null\), \[userId, refDone\]\);/);
  const at = (s) => PAGE.indexOf(s);
  assert.ok(at('if (refSeed) return <RefTalk') > at("if (!user) return"), '로그인 뒤(로그인 화면은 이야기 거리를 지우지 않음)');
  assert.ok(at('if (refSeed) return <RefTalk') < at('<ConversationOpening'), '목적 고르기보다 먼저');
  assert.ok(at('if (refSeed) return <RefTalk') < at('<AgentConversation'));
  assert.match(PAGE, /onLeave=\{\(to\) => \{ setRefDone\(true\); if \(to === 'home'\) navigate\('\/doit\/home'\); \}\}/);
});

test('참고 이야기 화면: 말은 서버가 줌(화면이 받아주기·질문을 만들지 않음) · 여는 한 줄 받은 뒤에 이야기 거리 지움 · 실패 = 적은 말 보존 · 다시 보내기는 누를 때만', () => {
  assert.match(TALK, /const r = await agentRef\(userId, ref, history\.map/);
  assert.match(TALK, /\{ role: "echo", text: r\.reply \}/);
  assert.match(TALK, /if \(r\.question\) next\.push\(\{ role: "echo", text: r\.question, question: true \}\);/);
  assert.equal((TALK.match(/role: "echo", text: /g) ?? []).length, 2, '화면에 박힌 ECHO 말 0');
  assert.match(TALK, /if \(!text\) \{ setOpened\(true\); clearContentSeed\(\); \}/);
  assert.match(TALK, /if \(text\) setDraft\(text\); \/\/ 적은 말 보존/);
  assert.match(TALK, /useEffect\(\(\) => \{ void ask\("", \[\]\); \}, \[\]\);/);
  assert.match(TALK, /disabled=\{busy \|\| !opened\} onClick=\{\(\) => send\(ASK_TEXT\)\}>질문 하나 받아 보기/);
  assert.match(TALK, /const send = \(text: string\) => \{ const t = text\.trim\(\); if \(!t \|\| busy \|\| !opened\) return;/, '보내는 중 연타 = 한 번');
  for (const t of ['원하는 만남 알아보기', '오늘은 여기까지']) assert.ok(TALK.includes(t), t);
  // Codex P2(4186782778): 회사 예산 멈춤 = 따로 안내 · 「다시 보내기」는 실패·몰림일 때만
  assert.match(TALK, /code === "AI_COMPANY_BUDGET" \? "paused"/);
  assert.match(TALK, /code === "PRIVATE_DATA" \? "private"/); // Codex P1(4187208757): 서버가 보내지 않은 말 → 적은 말 보존 · 「다시 보내기」 0(고쳐 보내야 함)
  assert.match(TALK, /\(fail\.kind === "failed" \|\| fail\.kind === "busy"\) && \(/);
  assert.doesNotMatch(TALK, /localStorage|profile|matching|agentTurn|agentStart/, '저장·대화 서버·매칭 0');
  assert.match(API, /write<RefReply>\(userId, \{ action: 'agent_ref', ref, history: history\.slice\(-8\), text \}, \['AI_FORMAT', 'AI_ERROR', 'PRIVATE_DATA'\]\)/);
  assert.match(API, /seed\.source === 'TAROT' \? \{ kind: 'card', label: seed\.card \} : \{ kind: 'pattern', key: seed\.key \}/);
});
