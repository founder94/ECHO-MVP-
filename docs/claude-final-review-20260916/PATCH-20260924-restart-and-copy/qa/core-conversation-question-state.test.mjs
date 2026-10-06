import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real component's handlers, state and effect cleanup. The tiny hook
// runner needs no DOM/browser and all server/AI operations stay in memory.
const path = 'src/doit/components/feature/CoreConversation.tsx';
const source = readFileSync(path, 'utf8');
const record = id => ({ id, text: `내 이야기 ${id}`, original_text: `내 원문 ${id}`, status: 'confirmed', revision: 1, created_at: '2026-09-21T00:00:00Z' });
const insight = (recordId, status = 'confirmed') => ({ id: `insight-${recordId}`, source_record_id: recordId, text: '약속을 지키는 것이 중요해요.', category: 'value', status, origin: 'ai', revision: 1, created_at: '2026-09-21T00:00:00Z' });
const question = (recordId, text) => ({ sourceRecordId: recordId, text });
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function componentHarness(overrides = {}, { followup = true, server = true, pending = null, transport = null, props = {} } = {}) {
  const slots = [];
  // 통합안: 직접 설명 예약(conversationRecovery)은 메모리 저장소로, 전송 계층은 필요할 때만 주입한다.
  const store = { pending };
  let port = null;
  class UnderstandingError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const pendingEffects = [];
  let cursor = 0;
  let dirty = true;
  let tree;
  const calls = [];
  const defaultApi = {
    load: async () => ({ records: [], insights: [] }),
    record: async () => record('new'),
    generate: async () => ({ insights: [] }),
    savedQuestion: async () => null,
    nextQuestion: async () => { throw new Error('Unexpected question generation'); },
    react: async () => { throw new Error('Unexpected reaction'); },
    explain: async () => { throw new Error('Unexpected explanation'); },
  };
  const api = Object.fromEntries(Object.entries({ ...defaultApi, ...overrides }).map(([name, fn]) => [name, (...args) => {
    calls.push({ name, args });
    return fn(...args);
  }]));
  const unchanged = (before, after) => before && after && before.length === after.length && before.every((value, index) => Object.is(value, after[index]));
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(make, deps) {
      const index = cursor++;
      if (!slots[index] || !unchanged(slots[index].deps, deps)) slots[index] = { value: make(), deps };
      return slots[index].value;
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !unchanged(slots[index].deps, deps)) {
        const cleanup = slots[index]?.cleanup;
        slots[index] = { deps, cleanup: undefined };
        pendingEffects.push(() => { cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const element = (type, props, key) => ({ type, props: props ?? {}, key });
  const dependencies = {
    react: hooks,
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    'lucide-react': Object.fromEntries(['ArrowUp', 'Check', 'ChevronRight', 'PencilLine'].map(name => [name, `icon-${name}`])),
    'react-router-dom': { Link: 'link' },
    '@/components/DoItSymbol': { default: 'brand-symbol' },
    '@/components/SymbolLoader': { default: 'symbol-loader' },
    '@/doit/lib/introDraft': { draftToIntro: (lines) => lines.map((line) => line.text.trim()).filter(Boolean).join(' ').slice(0, 200) },
    '@/doit/hooks/useUnderstanding': { useUnderstanding: () => ({ reload: async () => undefined }) },
    '@/doit/lib/understandingApi': {
      A_STRUCTURE_SERVER_ENABLED: server,
      UnderstandingError,
      prepareUnderstandingRequest: transport ? transport.prepare : () => { throw new Error('External request forbidden'); },
      understandingRequest: transport ? transport.request : () => { throw new Error('External request forbidden'); },
    },
    '@/doit/lib/coreConversation': { createCoreConversation: given => { port = given; return api; } },
    // v13 되묻기 규칙은 qa/conversation-rules.test.mjs 가 따로 검사한다. 여기서는 최소 판정만 흉내 낸다.
    // v14.1 주제 개수가 곧 질문 개수(ASK_TOTAL)라, 가짜 목록도 실제와 같은 5개여야 한다.
    '@/doit/lib/conversationRules': { TOPICS: [{ id: 'purpose', label: '원하는 만남' }, { id: 'partner_style', label: '끌리는 사람' }, { id: 'together', label: '같이 하고 싶은 것' }, { id: 'self', label: '상대가 알면 좋을 나' }, { id: 'pace', label: '만나는 방식' }], isMetaReply: text => /무슨\s*뜻/.test(String(text)), blockedContentReason: () => null, blockedContentMessage: () => '' },
    '@/doit/lib/conversationRecovery': {
      loadPendingSelf: () => store.pending,
      savePendingSelf: (_userId, next) => { store.pending = next; },
      clearPendingSelf: () => { store.pending = null; },
    },
    './core-conversation.css': {},
  };
  const compiled = ts.transpileModule(source.replaceAll('import.meta.env.VITE_ECHO_FOLLOWUP_ENABLED', JSON.stringify(String(followup))), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: name => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  }, { filename: path });
  function render() { cursor = 0; dirty = false; tree = exports.default({ userId: 'owner', ...props }); }
  async function flush() {
    for (let turn = 0; turn < 32; turn++) {
      if (dirty) render();
      while (pendingEffects.length) pendingEffects.shift()();
      await Promise.resolve();
    }
    assert.equal(dirty, false, 'Component should settle without a render loop');
  }
  function nodes(node = tree) {
    if (Array.isArray(node)) return node.flatMap(child => nodes(child ?? null));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children ?? null)];
  }
  function content(node = tree) {
    if (Array.isArray(node)) return node.map(child => content(child ?? null)).join('');
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return content(node.props?.children ?? null);
  }
  function button(label) {
    const found = nodes().find(node => node.type === 'button' && (content(node) === label || node.props['aria-label'] === label));
    assert.ok(found, `Missing button: ${label}`);
    assert.equal(!!found.props.disabled, false, `Disabled button: ${label}`);
    return found;
  }
  function click(label) { button(label).props.onClick?.(); }
  function type(id, text) {
    const input = nodes().find(node => node.props.id === id);
    assert.ok(input, `Missing input: ${id}`);
    input.props.onChange({ target: { value: text } });
  }
  async function send(text) {
    type('echo-message', text);
    await flush();
    const form = nodes().find(node => node.type === 'form');
    form.props.onSubmit({ preventDefault() {} });
    await flush();
  }
  function value(id) {
    const input = nodes().find(node => node.props.id === id);
    assert.ok(input, `Missing input: ${id}`);
    return input.props.value;
  }
  return {
    api, calls, flush, click, type, send, content, value, store, UnderstandingError, port: () => port,
    renderBeforeEffects: render,
    questions: () => nodes().filter(node => node.props.className === 'echo-question').map(node => content(node)),
    contentNodes: () => nodes(),
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('live generation rescue survives a later saved-question null response', async () => {
  const generation = deferred();
  const restored = [];
  const h = componentHarness({
    generate: () => generation.promise,
    savedQuestion: () => { const request = deferred(); restored.push(request); return request.promise; },
  });
  await h.flush();
  await h.send('나에게 중요한 건 약속이에요.');
  assert.equal(restored.length, 1);
  generation.resolve({ insights: [], rescue: { text: '약속을 지킨다는 건 어떤 행동일까요?', kind: 'quoted_question' } });
  await h.flush();
  for (const request of restored) request.resolve(null);
  await h.flush();
  assert.deepEqual(h.questions(), ['약속을 지킨다는 건 어떤 행동일까요?']);
  assert.match(h.content(), /내 원문 new/);
  assert.equal(h.calls.filter(call => call.name === 'record').length, 1);
  assert.equal(h.calls.filter(call => call.name === 'savedQuestion').length, 1, 'An unchanged insight context does not refetch');
});

test('retry rescue remains visible after load returns a new but equivalent insights array', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('saved')], insights: [] }),
    generate: async () => ({ insights: [], rescue: { text: '어떤 때 그렇게 느끼셨나요?', kind: 'quoted_question' } }),
  });
  await h.flush();
  h.click('저장한 이야기 다시 살펴보기');
  await h.flush();
  assert.deepEqual(h.questions(), ['어떤 때 그렇게 느끼셨나요?']);
  assert.equal(h.calls.some(call => call.name === 'record'), false, 'Retry must not duplicate the original record');
});

test('server-saved follow-up still restores for the active record', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [insight('a')] }),
    savedQuestion: async id => question(id, '약속을 지켜준 경험을 들려주실래요?'),
  });
  await h.flush();
  assert.deepEqual(h.questions(), ['약속을 지켜준 경험을 들려주실래요?']);
  assert.equal(h.calls.some(call => call.name === 'nextQuestion'), false, 'Restoration is read-only');
});

for (const oldResponse of [null, question('a', '오래된 질문')]) {
  test(`newly generated follow-up wins over a late restoration ${oldResponse ? 'question' : 'null'}`, async () => {
    const restoration = deferred();
    const h = componentHarness({
      load: async () => ({ records: [record('a')], insights: [insight('a')] }),
      savedQuestion: () => restoration.promise,
      nextQuestion: async id => question(id, '지금의 생각을 더 들려주실래요?'),
    });
    await h.flush();
    h.click('이어서 이야기하기 ');
    await h.flush();
    restoration.resolve(oldResponse);
    await h.flush();
    assert.deepEqual(h.questions(), ['지금의 생각을 더 들려주실래요?']);
  });
}

test('record switch hides a rescue immediately and never shows another record question', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('a'), record('b')], insights: [] }),
    generate: async () => ({ insights: [], rescue: { text: 'A 기록에만 해당하는 질문', kind: 'quoted_question' } }),
  });
  await h.flush();
  h.click('저장한 이야기 다시 살펴보기');
  await h.flush();
  assert.deepEqual(h.questions(), ['A 기록에만 해당하는 질문']);
  h.click('내 이야기 b');
  h.renderBeforeEffects();
  assert.deepEqual(h.questions(), [], 'Do not flash A question before B effect runs');
  await h.flush();
  assert.deepEqual(h.questions(), []);
  h.click('내 이야기 a');
  await h.flush();
  assert.deepEqual(h.questions(), ['A 기록에만 해당하는 질문']);
});

test('late saved question from a previous record cannot leak after switching records', async () => {
  const restoration = deferred();
  const h = componentHarness({
    load: async () => ({ records: [record('a'), record('b')], insights: [insight('a'), insight('b')] }),
    savedQuestion: id => id === 'a' ? restoration.promise : Promise.resolve(question('b', 'B 기록의 질문')),
  });
  await h.flush();
  h.click('내 이야기 b');
  await h.flush();
  restoration.resolve(question('a', 'A 기록의 오래된 질문'));
  await h.flush();
  assert.deepEqual(h.questions(), ['B 기록의 질문']);
});

test('a saved user correction clears its old follow-up and restores the new context', async () => {
  let corrected = false;
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [insight('a')] }),
    savedQuestion: async id => corrected ? null : question(id, '정정하기 전 질문'),
    react: async (item, decision, text) => { corrected = true; return { ...item, text, status: 'corrected', revision: 2 }; },
  });
  await h.flush();
  assert.deepEqual(h.questions(), ['정정하기 전 질문']);
  h.click('지금의 나에 맞게 고치기');
  await h.flush();
  h.type('echo-correction', '매일 연락보다 약속을 지키는 게 중요해요.');
  await h.flush();
  h.click('이렇게 저장할게요 ');
  await h.flush();
  assert.deepEqual(h.questions(), []);
  assert.match(h.content(), /매일 연락보다 약속을 지키는 게 중요해요/);
  assert.equal(h.calls.filter(call => call.name === 'savedQuestion').length, 2);
});

test('a correction to another record invalidates the active follow-up on reload', async () => {
  let otherRecordCorrected = false;
  const h = componentHarness({
    load: async () => ({
      records: [record('a'), record('b')],
      insights: [insight('a'), otherRecordCorrected ? { ...insight('b'), status: 'corrected', revision: 2 } : insight('b')],
    }),
    savedQuestion: async id => otherRecordCorrected ? null : question(id, '과거 이해를 바탕으로 만든 A 질문'),
    record: async () => { throw new Error('NETWORK_ERROR'); },
  });
  await h.flush();
  assert.deepEqual(h.questions(), ['과거 이해를 바탕으로 만든 A 질문']);
  // Another screen corrects B. A failed write then refreshes the server state,
  // without changing the selected A record or clearing questions in send().
  otherRecordCorrected = true;
  await h.send('아직 전송되지 않은 새 이야기');
  assert.match(h.content(), /내 원문 a/);
  assert.deepEqual(h.questions(), []);
  assert.equal(h.calls.filter(call => call.name === 'savedQuestion').length, 2);
});

test('generation failure preserves the original without inventing a question', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [] }),
    generate: async () => { throw new Error('AI_ERROR'); },
  });
  await h.flush();
  h.click('저장한 이야기 다시 살펴보기');
  await h.flush();
  assert.deepEqual(h.questions(), []);
  assert.match(h.content(), /내 원문 a/);
  assert.match(h.content(), /아직 답을 받지 못했어요/);
});

test('rescue remains available when follow-up generation is disabled', async () => {
  const h = componentHarness({ generate: async () => ({ insights: [], rescue: { text: '조금 더 들려주실래요?', kind: 'quoted_question' } }) }, { followup: false });
  await h.flush();
  await h.send('나의 이야기');
  assert.deepEqual(h.questions(), ['조금 더 들려주실래요?']);
  assert.equal(h.calls.some(call => call.name === 'savedQuestion' || call.name === 'nextQuestion'), false);
});

test('server-disabled screen performs no requests and shows no fabricated question', async () => {
  const h = componentHarness({}, { server: false });
  await h.flush();
  assert.deepEqual(h.questions(), []);
  assert.deepEqual(h.calls, []);
});

// ── 통합안(r2 이식) 추가 검사 ──

test('pending direct explanation reopens the editor with its text after reload and saves without a second rejection', async () => {
  const rejected = insight('r1', 'rejected');
  const saved = { ...insight('r1', 'confirmed'), id: 'self-1', origin: 'self', text: '장소만 조용했으면 해요' };
  const h = componentHarness({
    load: async () => ({ records: [record('r1')], insights: [rejected] }),
    explain: async () => saved,
  }, { pending: { insightId: rejected.id, recordId: 'r1', category: 'value', text: '장소만 조용했으면 해요' } });
  await h.flush();
  assert.equal(h.value('echo-correction'), '장소만 조용했으면 해요');
  assert.match(h.content(), /AI가 들은 문장은 뺐어요/);
  h.click('이렇게 저장할게요 ');
  await h.flush();
  assert.deepEqual(h.calls.filter(c => c.name === 'react'), [], 'already rejected → no second rejection');
  assert.deepEqual(h.calls.filter(c => c.name === 'explain').map(c => c.args), [['r1', 'value', '장소만 조용했으면 해요']]);
  assert.equal(h.store.pending, null, 'reservation cleared after success');
  assert.match(h.content(), /내 말로 바꿔 저장했어요/);
  h.unmount();
});

test('explanation failure keeps the reservation with the typed text; success clears it', async () => {
  const candidate = insight('r1', 'candidate');
  const rejected = { ...candidate, status: 'rejected', revision: 2 };
  // 서버 정본을 흉내: 거절이 저장되면 이후 load 는 거절된 행(revision 2)을 돌려준다.
  const server = { insights: [candidate] };
  let explainCalls = 0;
  const h = componentHarness({
    load: async () => ({ records: [record('r1')], insights: server.insights }),
    react: async () => { server.insights = [rejected]; return rejected; },
    explain: async () => { explainCalls += 1; if (explainCalls === 1) throw new Error('ERROR'); return { ...rejected, id: 'self-1', origin: 'self', status: 'confirmed', text: '내 설명' }; },
  });
  await h.flush();
  h.click('직접 설명할게요');
  await h.flush();
  h.type('echo-correction', '내 설명');
  await h.flush();
  h.click('이렇게 저장할게요 ');
  await h.flush();
  // 컴포넌트는 vm 별도 렌름에서 객체를 만들므로(프로토타입 다름) 값만 비교한다.
  assert.deepEqual(JSON.parse(JSON.stringify(h.store.pending)), { insightId: candidate.id, recordId: 'r1', category: 'value', text: '내 설명' }, 'reserved after reject, kept after explain failure');
  assert.equal(h.value('echo-correction'), '내 설명', 'typed text preserved');
  h.click('이렇게 저장할게요 ');
  await h.flush();
  assert.equal(h.calls.filter(c => c.name === 'react').length, 1, 'reject sent exactly once');
  assert.equal(explainCalls, 2);
  assert.equal(h.store.pending, null);
  h.unmount();
});

test('STALE_CONTEXT write drops the stored request id and retries exactly once with a fresh id', async () => {
  const ids = []; const completed = []; const seen = [];
  const h = componentHarness({}, { transport: {
    prepare: async (_userId, body) => { const id = `id-${ids.length + 1}`; ids.push(id); return { body: { ...body, requestId: id }, complete: () => completed.push(id) }; },
    request: async body => { seen.push(body.requestId); if (body.requestId === 'id-1') throw new h.UnderstandingError('STALE_CONTEXT', 'stale'); return { ok: true, echoed: body.requestId }; },
  } });
  await h.flush();
  const result = await h.port().write({ action: 'followup_generate', recordId: 'r1' });
  assert.deepEqual(seen, ['id-1', 'id-2']);
  assert.deepEqual(completed, ['id-1', 'id-2'], 'stale id discarded, fresh id completed');
  assert.equal(result.echoed, 'id-2');
  h.unmount();
});

test('a second STALE_CONTEXT is reported, not retried forever', async () => {
  const seen = [];
  const h = componentHarness({}, { transport: {
    prepare: async (_userId, body) => ({ body: { ...body, requestId: `id-${seen.length + 1}` }, complete: () => undefined }),
    request: async body => { seen.push(body.requestId); throw new h.UnderstandingError('STALE_CONTEXT', 'stale'); },
  } });
  await h.flush();
  await assert.rejects(h.port().write({ action: 'followup_generate', recordId: 'r1' }), error => error.code === 'STALE_CONTEXT');
  assert.equal(seen.length, 2, 'exactly two attempts');
  h.unmount();
});

// ── v14.1 대화에 끝이 있다 (대표 2026-09-22 "언제까지 내가 너랑 대화만 해야해?" / "질문 다섯개면 충분해") ──
const manyRecords = (count) => Array.from({ length: count }, (_, i) => ({
  id: `r${i}`, text: `답 ${i}`, original_text: `답 ${i}`, status: 'active', revision: 1, created_at: `2026-09-22T0${i}:00:00Z`,
}));

test('v14.1 시작 화면에 왜 묻는지·몇 개 묻는지 설명이 먼저 나온다', async () => {
  const h = componentHarness({ load: async () => ({ records: [], insights: [] }) });
  await h.flush();
  const text = h.content();
  assert.match(text, /다섯 가지만/, '몇 개를 묻는지 먼저 알려 준다');
  assert.match(text, /어떤 사람을 소개할지/, '왜 답해야 하는지 알려 준다');
  assert.match(text, /딱 다섯 개만 묻고 끝낼게요/, '끝이 있다는 약속');
  // 아직 없는 기능(사람 찾기)을 한다고 약속하지 않는다.
  assert.doesNotMatch(text, /찾기 시작해요/);
  // 다섯 칸을 모두 미리 보여 준다.
  for (const item of ['어떤 만남을 원하는지', '어떤 사람에게 끌리는지', '같이 뭘 하고 싶은지', '상대가 알면 좋을 내 모습', '어떻게 만나고 싶은지']) {
    assert.ok(text.includes(item), `시작 안내에 "${item}" 이 없다`);
  }
});

test('v14.1 진행은 화면 맨 위에 한 곳에서만 보인다', async () => {
  const h = componentHarness({ load: async () => ({ records: manyRecords(2), insights: [] }) });
  await h.flush();
  const steps = h.contentNodes().filter(node => node.props.className === 'echo-steps');
  assert.equal(steps.length, 1, '진행 표시는 하나여야 한다(두 개면 숫자가 엇갈린다)');
  assert.match(h.content(), /3 \/ 5/, '두 개 답했으면 지금은 세 번째 질문이다');
});

test('v14.1 다섯 개를 채우면 질문과 입력창을 닫고 끝났다고 알린다', async () => {
  const h = componentHarness({ load: async () => ({ records: manyRecords(5), insights: [] }) });
  await h.flush();
  const text = h.content();
  assert.match(text, /다섯 가지, 다 들었어요/);
  assert.match(text, /이제 나를 보여 줄 차례예요/);
  // 2026-09-24 연결이 열렸다(연결 v1). 끝 화면은 남은 것을 사실대로 말하고, "아직 안 열림"이라는 옛말은 하지 않는다.
  assert.match(text, /사진·소개·전화 인증까지 마치면 연결을 받을 수 있어요/);
  assert.doesNotMatch(text, /연결은 아직 열리지 않았/);
  assert.match(text, /다섯 가지 답을 모두 저장했어요/);
  // 더 묻지 않는다.
  assert.deepEqual(h.questions(), [], '끝난 뒤에는 질문을 더 내지 않는다');
  assert.equal(h.contentNodes().some(node => node.props.id === 'echo-message'), false, '끝난 뒤에는 입력창을 닫는다');
  assert.equal(h.contentNodes().some(node => node.props.className === 'echo-steps'), false, '끝난 뒤에는 진행 막대를 숨긴다');
  // 다음에 할 일을 알려 준다.
  assert.match(text, /사진과 소개 채우기/);
  assert.match(text, /연결까지 남은 것 보기/);
  // 다시 시작할 길이 있다.
  assert.match(text, /「처음부터 다시」/);
});

test('v14.1 다섯 개를 채우면 다음 질문을 서버에 더 요청하지 않는다', async () => {
  const h = componentHarness({ load: async () => ({ records: manyRecords(5), insights: [] }) });
  await h.flush();
  assert.equal(h.calls.filter(call => call.name === 'nextQuestion').length, 0, '끝난 뒤 다음 질문 요청 0건');
});

// v14.3 (대표 실기기 "처음부터 다시 하기도 없어"): 맨 아래에만 있어 화면 위에서 안 보였다.
test('v14.3 처음부터 다시 — 화면 위쪽에 버튼이 있고, 누르면 그 자리에 확인 창이 뜬다', async () => {
  let restarted = 0;
  const h = componentHarness({ load: async () => ({ records: manyRecords(2), insights: [] }) }, { props: { onRestart: async () => { restarted++; return null; } } });
  await h.flush();
  const nodes = h.contentNodes();
  const top = nodes.findIndex(node => node.props.className === 'echo-restart-top');
  const eyebrow = nodes.findIndex(node => node.props.className === 'echo-eyebrow');
  assert.ok(top > -1, '위쪽 버튼이 없다');
  assert.ok(top < eyebrow, '위쪽 버튼이 제목보다 위에 있어야 한다');
  h.click('처음부터 다시 하기');
  await h.flush();
  assert.match(h.content(), /지금까지 이야기는 그대로 남고, 첫 질문부터 새로 시작해요/);
  h.click('처음부터 다시');
  await h.flush();
  assert.equal(restarted, 1, '확인을 누르면 실제로 새 회차를 시작한다');
});

test('v14.3 앱 홈에서 들어오면(restartPrompt) 확인 창이 바로 열려 있고, 취소하면 버튼으로 돌아간다', async () => {
  const h = componentHarness({ load: async () => ({ records: manyRecords(5), insights: [] }) }, { props: { onRestart: async () => null, restartPrompt: true } });
  await h.flush();
  assert.match(h.content(), /지금까지 이야기는 그대로 남고, 첫 질문부터 새로 시작해요/);
  h.click('계속 이어가기');
  await h.flush();
  assert.doesNotMatch(h.content(), /첫 질문부터 새로 시작해요/);
  // 취소 뒤 끝 화면 버튼·아래 버튼 모두 다시 누를 수 있다(굳지 않는다). 끝 화면에서는 위 버튼 대신 끝 화면 버튼을 쓴다.
  h.click('처음부터 다시 답하기');
  await h.flush();
  h.click('계속 이어가기');
  await h.flush();
  h.click('처음부터 다시 시작하기');
  await h.flush();
  assert.match(h.content(), /첫 질문부터 새로 시작해요/);
});

test('v14.3 기록이 없는 새 회차에서는 위쪽 버튼을 보이지 않는다(다시 할 게 없다)', async () => {
  const h = componentHarness({ load: async () => ({ records: [], insights: [] }) }, { props: { onRestart: async () => null } });
  await h.flush();
  assert.equal(h.contentNodes().some(node => node.props.className === 'echo-restart-top'), false);
});

test('2026-09-24 끝 화면에서도 「처음부터 다시 답하기」가 바로 보이고, 확인하면 실제로 새 회차를 시작한다', async () => {
  let restarted = 0;
  const h = componentHarness({ load: async () => ({ records: manyRecords(5), insights: [] }) }, { props: { onRestart: async () => { restarted++; return null; } } });
  await h.flush();
  assert.match(h.content(), /다섯 가지, 다 들었어요/);
  assert.equal(h.contentNodes().some(node => node.props.className === 'echo-restart-top'), false, '끝 화면에서는 위 버튼을 겹쳐 두지 않는다');
  h.click('처음부터 다시 답하기');
  await h.flush();
  assert.match(h.content(), /다섯 가지를 다시 답할 때까지는 새 연결 후보에서 잠시 빠져요/, '연결 후보에서 빠진다는 사실을 먼저 알린다');
  h.click('처음부터 다시');
  await h.flush();
  assert.equal(restarted, 1);
});
