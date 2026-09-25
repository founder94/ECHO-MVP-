// 대화 에이전트 화면·관리자 관측 검사(가짜 데이터 기준 — 실제 사용자 기록 아님).
// 관리자 계산(agentAdmin.ts)은 실제 코드를 변환해 돌리고, 화면은 소스 약속(빌드 스위치·빠져나갈 문·원문 가림·쓰기 0)을 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
function loadAdmin() {
  const js = ts.transpileModule(src('src/doit/lib/agentAdmin.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: (n) => { if (n === '@/doit/lib/understandingApi') return { serverFunctionRequest: async () => { throw new Error('no network in test'); } }; throw new Error(n); } });
  return mod.exports;
}
const call = (kind, ms, extra = {}) => ({ kind, ms, model: 'gpt-4o-mini-2024-07-18', input_tokens: 1200, output_tokens: 90, error: null, ...extra });
const rec = (n, o = {}) => ({ turn_index: n, kind: 'answer', saved: true, decision: 'core', question_index: n + 1, question_purpose: null, flags: { correction: false, rejection: false, complaint: false, skip: false, fatigue: false, ask: false }, provider: 'openai', model_requested: 'gpt-4o-mini', calls: [call('turn', 1000 + n)], retry: [], fallback: 0, tone_mismatch_observed: false, id_leak: false, record_error: null, total_ms: 1100, ...o });
const raw = (id, phase, turns, extra = {}) => ({ id, user: id.slice(0, 8), nickname: null, created_at: '2026-09-25T01:00:00Z', updated_at: '2026-09-25T01:05:00Z',
  stored: { agent: 'echo-agent-v1.2', state: { tone: 'polite', mode: 'TEXT', phase, closing: phase === 'talk' ? null : '정리해 둘게요.', corrections: [], disputed: [], asked: turns.map((_, k) => ({ type: 'core', purpose: 'p', text: `q${k}?` })), turns }, profile: null, handoff: null, ...extra } });

test('관리자 대시보드: 실제 기록의 숫자만 · 토큰은 usage 합계 · 비용은 확인 불가', () => {
  const M = loadAdmin();
  const s1 = raw('aaaaaaaa-1', 'done', [{ n: 1, ai: '어떤 만남을 원하세요?', question_purpose: 'relationship_intent', user: '친구', kind: 'answer', reply: '좋아요.', question: '어떤 사람이 편해요?', decision: 'core' }, { n: 2, ai: '어떤 사람이 편해요?', question_purpose: 'attraction_comfort', user: '넘어갈래', kind: 'skip', reply: '', question: null, decision: 'finish' }],
    { profile: { relationship_intent: { status: 'CONFIRMED', items: [] }, user_corrections: [] }, handoff: { status: 'NOT_CONNECTED' } });
  const s2 = raw('bbbbbbbb-2', 'talk', [{ n: 1, ai: 'x?', question_purpose: 'relationship_intent', user: '그만', kind: 'stop', reply: '', question: null, decision: 'finish' }]);
  s2.stored.state.phase = 'talk';
  const turns = [{ session_id: 'aaaaaaaa-1', created_at: '1', record: rec(1) }, { session_id: 'aaaaaaaa-1', created_at: '2', record: rec(2, { kind: 'skip', saved: false, flags: { skip: true }, calls: [call('turn', 900), call('closing', 700)] }) },
    { session_id: 'bbbbbbbb-2', created_at: '3', record: rec(1, { flags: { fatigue: true }, calls: [call('turn', 500, { error: 'timeout', input_tokens: null, output_tokens: null })] }) }];
  const sessions = [M.normalize(s1, turns), M.normalize(s2, turns)];
  const d = M.dashboard(sessions);
  assert.equal(d.sessions, 2); assert.equal(d.done, 1); assert.equal(d.in_progress, 1);
  assert.equal(d.ai_calls, 4); assert.equal(d.ai_errors, 1);
  assert.equal(d.input_tokens, 3600, '오류 호출은 토큰 합에서 뺀다'); assert.equal(d.output_tokens, 270);
  assert.match(d.cost, /확인 불가/);
  assert.equal(d.flags.skip, 1); assert.equal(d.flags.fatigue, 1);
  assert.equal(JSON.stringify(d.matching_status), '["NOT_CONNECTED"]');
  const c = M.candidates(sessions[1]);
  assert.ok(c.failure.some((f) => f.type === 'TURN_ERROR' && f.evidence === 'ACTUAL'));
  assert.ok(c.failure.some((f) => f.type === 'QUESTION_FATIGUE'));
  assert.ok([...c.failure, ...M.candidates(sessions[0]).success].every((x) => x.status === 'CANDIDATE'), '자동 VERIFIED 0');
  const o = M.observability(sessions);
  assert.equal(o.rows.reduce((n, r) => n + r.calls, 0), 4); assert.ok(o.rows.every((r) => r.cost === '확인 불가'));
});

test('같은 질문 되풀이 후보: 먼저 답한 뒤 같은 질문을 다시 보인 것(ask)은 반복으로 세지 않는다', () => {
  const M = loadAdmin();
  const t = (n, kind, q) => ({ n, ai: null, question_purpose: 'p', user: `u${n}`, kind, reply: '', question: q, decision: 'core' });
  const s = M.normalize(raw('cccccccc-3', 'talk', [t(1, 'answer', '어떤 사람이 편해요?'), t(2, 'ask', '어떤 사람이 편해요?'), t(3, 'answer', '어떤 사람이 편해요?')]), []);
  const f = M.candidates(s).failure.filter((x) => x.type === 'SAME_QUESTION_REPEATED');
  assert.equal(f.length, 1); assert.equal(f[0].turn, 3);
});

test('화면 약속: 앱 빌드에서만 켬 · 말투 3종(기본 편한 존댓말) · 글/말 · 빠져나갈 문 · 처음부터 · 목소리 저장 0', () => {
  const pkg = JSON.parse(src('package.json'));
  assert.match(pkg.scripts['build:app'], /VITE_ECHO_AGENT_ENABLED=true/); assert.doesNotMatch(pkg.scripts['build:brand'], /VITE_ECHO_AGENT_ENABLED/);
  const ui = src('src/doit/components/feature/AgentConversation.tsx');
  const api = src('src/doit/lib/agentApi.ts');
  assert.match(api, /DEFAULT_AGENT_TONE: AgentTone = 'polite'/);
  for (const label of ['편한 존댓말', '정중한 존댓말', '편한 반말']) assert.ok(api.includes(label));
  for (const t of ['글로 대화하기', '말로 대화하기', '정중한 존댓말', '이 질문 넘어가기', '여기까지 할게요', '처음부터 시작하기', '사진과 소개 채우기', '연결까지 남은 것 보기', '다시 듣기']) assert.ok((ui + api).includes(t), t);
  assert.ok(!/getUserMedia|MediaRecorder|AudioContext/.test(ui), '마이크 녹음·음성 원본 수집 코드 0(기기 받아쓰기만)');
  assert.ok(!/데이팅|소개팅|궁합|점술|심리치료|성격검사/.test(ui + api), '금지어 0');
  assert.ok(!/setTimeout/.test(ui), '가짜 진행 타이머 0');
  // 대표 지시(2026-09-25 「기존 UI/브랜딩/레이아웃 변경 금지」): 기존 대화 화면 CSS 만 쓰고 새 CSS 파일·새 클래스를 만들지 않는다.
  const imports = [...ui.matchAll(/import '\.\/([^']+\.css)'/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['core-conversation.css', 'agent-choice.css']);
  // 새 CSS 는 선택창 하나(.echo-choice-*)뿐이고, 대화 화면 루트 아래로만 적용된다.
  const choice = src('src/doit/components/feature/agent-choice.css');
  for (const sel of choice.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map((x) => x.trim()).filter((x) => !x.startsWith('@'))) for (const part of sel.split(',')) assert.match(part.trim(), /^\.echo-dialogue \.echo-choice-/, `선택창 밖 규칙: ${part}`);
  assert.ok(!/body|:root|html/.test(choice.replace(/\/\*[\s\S]*?\*\//g, '')), '전역 규칙 0');
  const css = choice + src('src/doit/components/feature/core-conversation.css') + src('src/doit/components/feature/metal-silver.css') + src('src/doit/components/feature/doit-type.css');
  const classes = [...new Set([...ui.matchAll(/className=["{]['"]?([^"'}]+)/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => c.startsWith('echo-')))];
  const unknown = classes.filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(unknown, [], `기존 CSS 에 없는 클래스: ${unknown.join(',')}`);
  // 이 화면은 질문을 만들지 않는다: 고정 질문 배열·질문 문장 목록 0
  assert.ok(!/\?['"`],\s*['"`]/.test(ui), '질문 문장 배열 없음');
  const page = src('src/doit/pages/do-it/conversation/page.tsx');
  assert.match(page, /if \(ECHO_AGENT_ENABLED\)/); assert.match(page, /restartPrompt=\{restartPrompt\}/);
});

test('관리자 화면: 메뉴 등록 · 원문 기본 가림 · 쓰기 호출 0 · 서버 역할 확인', () => {
  const view = src('src/doit/pages/do-it/admin/views/AgentConversations.tsx');
  assert.match(view, /useState\(false\)/); assert.match(view, /원문 보기/);
  assert.ok(!/\.(insert|update|delete|upsert)\(|agent_turn|agent_start/.test(view + src('src/doit/lib/agentAdmin.ts')), '관리자 쪽 쓰기·대화 호출 0');
  assert.match(src('src/doit/pages/do-it/admin/meta.ts'), /key: "agent"/);
  assert.match(src('src/doit/pages/do-it/admin/components/AdminShell.tsx'), /case "agent":\s*\n\s*return <AgentConversations \/>/);
  assert.match(src('supabase/functions/doit-agent/index.ts'), /if \(!\(await isAdmin\(admin, userId\)\)\) return fail\("FORBIDDEN"/);
});

test('앱 홈 진행: 에이전트 대화가 있으면 서버 상태(몇 번째 질문·끝남)로 센다', () => {
  const home = src('src/doit/pages/do-it/home/page.tsx');
  assert.match(home, /const done = useAgent \? agent\.session\?\.phase === 'done'/);
  assert.match(home, /agentGet\(userId\)/);
});
