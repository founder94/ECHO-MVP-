// 관리자 파이프라인(2026-09-26 대표 ADMIN OPERATIONS FINAL + END-TO-END PIPELINE LOCK) — 사용자별로 어디서 막혔는지 · 거짓 PASS 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// 서버 호출 import 만 가짜로 바꿔 순수 계산 함수를 불러온다(네트워크 0).
const src = read('src/doit/lib/agentAdmin.ts').replace(/^import \{ serverFunctionRequest \} from '@\/doit\/lib\/understandingApi';$/m, 'const serverFunctionRequest = async () => ({});');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const file = path.join(mkdtempSync(path.join(tmpdir(), 'admin-pipe-')), 'agentAdmin.mjs');
writeFileSync(file, js);
const A = await import(pathToFileURL(file).href);

const baseRaw = (over = {}) => ({ id: 's1', user: 'u1', nickname: '나', created_at: '2026-09-26T00:00:00Z', updated_at: '2026-09-26T00:00:00Z',
  photos: { count: 0, primary: false, last_updated_at: null }, readiness: { phone_verified: false, intro_saved: false },
  stored: { agent: 'echo-agent-v2.0', state: { tone: 'polite', mode: 'TEXT', phase: 'talk', turns: [{ n: 1, ai: 'Q', question_purpose: 'relationship_intent', user: '친구', kind: 'answer' }], asked: [{ type: 'core', purpose: 'relationship_intent', text: 'Q' }], closing: null, corrections: [], disputed: [] }, profile: null, handoff: null }, ...over });
const rec = (over = {}) => ({ session_id: 's1', created_at: '2026-09-26T00:00:01Z', record: { turn_index: 1, kind: 'answer', saved: true, decision: 'core', question_index: 1, question_purpose: 'relationship_intent', flags: {}, provider: 'openai', model_requested: 'gpt-4o-mini', calls: [{ kind: 'turn', ms: 900, model: 'gpt-4o-mini', input_tokens: 10, output_tokens: 5, error: null }], retry: [], fallback: 0, tone_mismatch_observed: false, id_leak: false, record_error: null, total_ms: 950, ...over } });

test('대화 중인 사람: 대화 단계에서 멈춤 · 뒤 단계는 PASS 가 아니다', () => {
  const s = A.normalize(baseRaw(), [rec()]);
  const p = A.pipeline(s);
  assert.equal(p.stuck.key, 'conversation');
  assert.equal(p.stages.find((x) => x.key === 'conversation').state, 'WAIT');
  for (const k of ['ai_profile', 'photo', 'phone', 'matching_ready', 'candidate']) assert.notEqual(p.stages.find((x) => x.key === k).state, 'PASS', k);
});

test('전화 인증 안 됨 = 막힘(BLOCKED · 문자 업체 미연결) · 후보는 늘 막힘(가짜 후보 0)', () => {
  const raw = baseRaw({ photos: { count: 3, primary: true, last_updated_at: '2026-09-26T00:00:00Z' } });
  raw.stored.state.phase = 'done'; raw.stored.state.intro = { status: 'ready', lines: [{ text: '저는…', basis: '친구' }], dropped: {}, tries: 1, error: null, used: 'as_is', used_at: '2026-09-26T00:00:00Z' };
  raw.stored.profile = Object.fromEntries(A.PURPOSE_IDS.map((id) => [id, { status: 'CONFIRMED', items: [{ note: 'x', quote: 'x' }] }]));
  raw.stored.handoff = { status: 'NOT_CONNECTED' };
  const p = A.pipeline(A.normalize(raw, [rec()]));
  const by = (k) => p.stages.find((x) => x.key === k);
  assert.equal(by('conversation').state, 'PASS'); assert.equal(by('ai_profile').state, 'PASS'); assert.equal(by('photo').state, 'PASS'); assert.equal(by('state').state, 'PASS');
  assert.equal(by('phone').state, 'BLOCKED'); assert.match(by('phone').note, /문자 발송 업체/);
  assert.equal(by('matching_ready').state, 'BLOCKED'); assert.equal(by('candidate').state, 'BLOCKED');
  assert.equal(p.stuck.key, 'phone');
});

test('기록이 없으면 UNKNOWN(모름) — PASS 로 채우지 않는다', () => {
  const raw = baseRaw({ photos: undefined, readiness: undefined }); raw.stored.state.mode = undefined;
  const p = A.pipeline(A.normalize(raw, []));
  assert.equal(p.stages.find((x) => x.key === 'input').state, 'UNKNOWN');
  assert.equal(p.stages.find((x) => x.key === 'ai_os').state, 'UNKNOWN');
  assert.equal(p.stages.find((x) => x.key === 'photo').state, 'UNKNOWN');
  assert.equal(p.stages.find((x) => x.key === 'phone').state, 'UNKNOWN');
});

test('AI OS 관측: 서버 가드·정정 교체·실패 턴을 세고, 문제 후보가 있으면 PARTIAL', () => {
  const s = A.normalize(baseRaw(), [rec({ guard: { from: 'answer', to: 'repair', rule: 'past_reference' }, superseded: 1 }), rec({ turn_index: null, kind: 'error', error: 'PROVIDER', calls: [{ kind: 'turn', ms: 18000, model: null, input_tokens: null, output_tokens: null, error: 'timeout' }] })]);
  const p = A.pipeline(s);
  assert.equal(p.aiOs.guard, 1); assert.equal(p.aiOs.superseded, 1); assert.equal(p.aiOs.errors, 1);
  assert.equal(A.dashboard([s]).ai_errors, 1, '실패 턴의 호출 오류도 AI 오류로 센다');
});

test('병목 TOP 3 = 가장 많이 멈춘 단계', () => {
  const a = A.normalize(baseRaw({ id: 'a' }), []); const b = A.normalize(baseRaw({ id: 'b' }), []);
  const sum = A.pipelineSummary([a, b]);
  assert.equal(sum.total, 2); assert.equal(sum.top[0].key, 'conversation'); assert.equal(sum.top[0].n, 2);
});

test('점검표: 기능마다 여섯 칸(화면·서버·저장·외부·실기기·출시 준비) · 전화 인증은 출시 준비 STOP · TOP 3 표시', () => {
  const list = read('src/doit/pages/do-it/admin/views/FeatureChecklist.tsx');
  for (const w of ['화면', '서버', '저장', '외부 서비스', '실기기', '출시 준비', '지금 막힌 곳 TOP 3']) assert.match(list, new RegExp(w));
  const rows = [...list.matchAll(/\{ name: "([^"]+)"[\s\S]*?axes: \{ ui: "(\w+)", server: "(\w+)", db: "(\w+)", ext: "(\w+)", device: "(\w+)", ready: "(\w+)" \} \}/g)];
  assert.equal(rows.length, 17, '모든 기능에 여섯 칸(2026-09-26 MVP: ECHO가 이해한 나 · DO IT MUSIC 순간 · 약관·AI 고지 추가)');
  const phone = rows.find((r) => r[1] === '전화 인증'); assert.equal(phone[7], 'STOP'); assert.equal(phone[5], 'NOT_CONNECTED');
  const conn = rows.find((r) => r[1].startsWith('사람 연결')); assert.notEqual(conn[7], 'PASS');
  // 「작동 중」 배지인데 화면만 있고 서버가 안 되는 줄은 없어야 한다(거짓 PASS 0).
  for (const r of rows) if (/state: "ok"/.test(r[0])) assert.equal(r[3], 'PASS', `${r[1]} 은 작동 중인데 서버가 PASS 가 아님`);
});

test('관리자 대화 화면: 파이프라인 탭이 첫 화면 · 글자로 상태(색만 X) · 서버 가드 표시', () => {
  const v = read('src/doit/pages/do-it/admin/views/AgentConversations.tsx');
  assert.match(v, /useState<Tab>\("pipeline"\)/);
  assert.match(v, /STAGE_TEXT\[x\.state\]/);
  assert.match(v, /서버가 바로잡음/);
  assert.match(read('src/doit/pages/do-it/admin/components/AdminShell.tsx'), /search\.get\("menu"\)/);
});

test('출시 준비(RELEASE GATE): 여섯 관문 A~F · 신뢰(전화)·매칭은 PASS 아님 · 하나라도 PASS 가 아니면 「열 수 없어요」', () => {
  const list = read('src/doit/pages/do-it/admin/views/FeatureChecklist.tsx');
  const gates = [...list.matchAll(/\{ id: "([A-F])", name: "([^"]+)", state: "(\w+)"/g)].map((m) => [m[1], m[3]]);
  assert.deepEqual(gates.map((g) => g[0]), ['A', 'B', 'C', 'D', 'E', 'F']);
  const by = Object.fromEntries(gates);
  assert.notEqual(by.C, 'PASS'); assert.notEqual(by.E, 'PASS');
  assert.match(list, /RELEASE_GATES\.every\(\(g\) => g\.state === "PASS"\) \? "일반 사용자에게 사람 연결을 열 수 있어요\." : `일반 사용자에게 사람 연결을 아직 열 수 없어요/);
  assert.ok(list.indexOf('출시 준비(RELEASE READINESS)') < list.lastIndexOf('>지금 막힌 곳 TOP 3<'), '화면에서 TOP 3 보다 위');
});

test('실패 후보마다 판(에이전트·프롬프트·모델)', () => {
  const rec2 = rec({ agent_version: 'echo-agent-v2.1', prompt_version: 'p-1234abcd', calls: [{ kind: 'turn', ms: 1, model: 'gpt-4o-mini', input_tokens: 1, output_tokens: 1, error: 'timeout' }] });
  const c = A.candidates(A.normalize(baseRaw(), [rec2]));
  assert.equal(c.failure[0].type, 'TURN_ERROR');
  assert.equal(c.failure[0].version, 'echo-agent-v2.1 · p-1234abcd · gpt-4o-mini');
  assert.match(A.candidates(A.normalize(baseRaw(), [rec({ calls: [{ kind: 'turn', ms: 1, model: null, input_tokens: null, output_tokens: null, error: 'x' }] })])).failure[0].version, /판 기록 없음/);
});

test('성공 후보 이름(§22) · 늘 CANDIDATE', () => {
  const raw = baseRaw({ photos: { count: 1, primary: true, last_updated_at: null }, readiness: { phone_verified: true, intro_saved: true } });
  raw.stored.state.phase = 'done'; raw.stored.state.intro = { status: 'ready', lines: [], dropped: {}, tries: 1, error: null, used: 'edited', used_at: null };
  const c = A.candidates(A.normalize(raw, [rec()]));
  const types = c.success.map((x) => x.type);
  for (const t of ['FIVE_TURN_COMPLETED', 'AI_PROFILE_CONFIRMED', 'MATCHING_READY']) assert.ok(types.includes(t), t);
  assert.ok(c.success.every((x) => x.status === 'CANDIDATE'));
  const noPhone = A.candidates(A.normalize({ ...raw, readiness: { phone_verified: false, intro_saved: true } }, [rec()]));
  assert.ok(!noPhone.success.some((x) => x.type === 'MATCHING_READY'), '전화 인증 없으면 MATCHING_READY 아님');
});

test('AI OS 6개 엔진 관측: 기록 0 이면 모두 UNKNOWN · 문제 증거가 있으면 PARTIAL(이름만으로 PASS 0)', () => {
  const empty = A.aiOsEngines([A.normalize(baseRaw(), [])]);
  assert.equal(empty.length, 6); assert.ok(empty.every((e) => e.state === 'UNKNOWN'));
  const raw = baseRaw(); raw.stored.state.turns = [1, 2, 3].map((n) => ({ n, ai: 'Q', question_purpose: 'relationship_intent', user: '-', kind: 'answer', question: '같은 질문?' }));
  const s = A.normalize(raw, [rec({ turn_index: 1 }), rec({ turn_index: 2 })]);
  s.turns.forEach((t) => { t.assistant = '같은 질문?'; });
  const rows = Object.fromEntries(A.aiOsEngines([s]).map((e) => [e.key, e.state]));
  assert.equal(rows.rejection, 'PARTIAL', '글자까지 같은 질문 반복 = 문제 증거');
});
