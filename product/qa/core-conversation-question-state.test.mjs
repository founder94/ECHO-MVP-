import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the real component's handlers, state and effect cleanup. The tiny hook
// runner needs no DOM/browser and all server/AI operations stay in memory.
const path = 'src/doit/components/feature/CoreConversation.tsx';
const source = readFileSync(path, 'utf8');
// v15.1 「내용 있는 답」 판정은 가짜로 흉내 내지 않고 실제 규칙 파일의 함수를 쓴다(화면·서버와 같은 규칙).
const realRules = (() => {
  const js = ts.transpileModule(readFileSync('src/doit/lib/conversationRules.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports }, { filename: 'conversationRules.ts' });
  return module.exports;
})();
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
    // v15 한 턴 분류·통합 이해 카드. 기본은 "답" · "카드를 이미 다 정함".
    classify: async () => ({ kind: 'answer' }),
    synthesize: async () => ({ items: [], done: true, empty: false }),
    decideSynthesis: async () => { throw new Error('Unexpected synthesis decision'); },
    reviseSynthesis: async () => { throw new Error('Unexpected synthesis revision'); },
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
    'lucide-react': Object.fromEntries(['ArrowUp', 'Check', 'ChevronRight', 'PencilLine', 'RotateCcw'].map(name => [name, `icon-${name}`])),
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
    '@/doit/lib/coreConversation': { createCoreConversation: given => { port = given; return api; }, questionBodyOf: text => { const parts = String(text).trim().split('\n'); return (parts.length > 1 ? parts.slice(1).join(' ') : parts[0] ?? '').trim(); } },
    // v13 되묻기 규칙은 qa/conversation-rules.test.mjs 가 따로 검사한다. 여기서는 최소 판정만 흉내 낸다.
    // v14.1 주제 개수가 곧 질문 개수(ASK_TOTAL)라, 가짜 목록도 실제와 같은 5개여야 한다.
    '@/doit/lib/conversationRules': { TOPICS: [{ id: 'purpose', label: '원하는 만남' }, { id: 'partner_style', label: '끌리는 사람' }, { id: 'together', label: '같이 하고 싶은 것' }, { id: 'self', label: '상대가 알면 좋을 나' }, { id: 'pace', label: '만나는 방식' }], isMetaReply: text => /무슨\s*뜻/.test(String(text)), isAskingAi: text => /왜\s*(이런\s*걸\s*)?물어/.test(String(text)), blockedContentReason: () => null, blockedContentMessage: () => '', informativeAnswer: realRules.informativeAnswer },
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
  // 같은 이름 버튼이 여러 개일 때(예: 위·끝 화면·아래의 「처음부터 시작하기」) 순서로 고른다.
  function clickNth(label, index) {
    const found = nodes().filter(node => node.type === 'button' && content(node) === label)[index];
    assert.ok(found, `Missing button #${index}: ${label}`);
    assert.equal(!!found.props.disabled, false, `Disabled button #${index}: ${label}`);
    found.props.onClick?.();
  }
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
    api, calls, flush, click, clickNth, type, send, content, value, store, UnderstandingError, port: () => port,
    renderBeforeEffects: render,
    questions: () => nodes().filter(node => node.props.className === 'echo-question').map(node => content(node)),
    contentNodes: () => nodes(),
    unmount: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

// v15 계약 변경 근거(명세 2026-09-24 §2): 답마다 이해 후보(insight_generate)를 만들고 후보가 없으면 구제 질문을 보여 주던 흐름은 없다.
//   답을 기록하면 곧바로 다음 질문(nextQuestion)을 받는다. 아래 옛 "구제(rescue)" 검사들은 같은 약속(늦게 온 응답이 새 질문을 덮지 않는다 ·
//   기록을 두 번 만들지 않는다 · 실패하면 질문을 지어내지 않는다)을 새 흐름으로 옮긴 것이다.
test('live next question survives a later saved-question null response', async () => {
  const next = deferred();
  const restored = [];
  const h = componentHarness({
    nextQuestion: () => next.promise,
    savedQuestion: () => { const request = deferred(); restored.push(request); return request.promise; },
  });
  await h.flush();
  await h.send('나에게 중요한 건 약속이에요.');
  // v15 방금 만든 기록에는 저장된 질문이 있을 수 없다 → 복원 조회를 하지 않는다(늦은 조회가 새 질문을 지우던 경합 제거).
  assert.equal(restored.length, 0);
  next.resolve(question('new', '약속을 지키는 사람이랑 뭐 하고 싶어요?'));
  await h.flush();
  for (const request of restored) request.resolve(null);
  await h.flush();
  assert.deepEqual(h.questions(), ['약속을 지키는 사람이랑 뭐 하고 싶어요?']);
  assert.match(h.content(), /내 원문 new/);
  assert.equal(h.calls.filter(call => call.name === 'record').length, 1);
  assert.equal(h.calls.some(call => call.name === 'generate'), false, 'v15 답마다 이해 후보(4버튼 카드)를 만들지 않는다');
});

test('"다음 질문 받기" retry asks the server again without duplicating the record', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('saved')], insights: [] }),
    nextQuestion: async id => question(id, '어떤 때 그렇게 느끼셨나요?'),
  });
  await h.flush();
  h.click('다음 질문 받기 ');
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
    h.click('다음 질문 받기 ');
    await h.flush();
    restoration.resolve(oldResponse);
    await h.flush();
    assert.deepEqual(h.questions(), ['지금의 생각을 더 들려주실래요?']);
  });
}

test('record switch hides a question immediately and never shows another record question', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('a'), record('b')], insights: [] }),
    nextQuestion: async id => question(id, 'A 기록에만 해당하는 질문'),
  });
  await h.flush();
  h.click('다음 질문 받기 ');
  await h.flush();
  assert.deepEqual(h.questions(), ['A 기록에만 해당하는 질문']);
  h.click('내 이야기 b');
  h.renderBeforeEffects();
  assert.deepEqual(h.questions(), [], 'Do not flash A question before B effect runs');
  await h.flush();
  assert.deepEqual(h.questions(), []);
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

test('next-question failure preserves the original, shows the server reason, and invents no question', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [] }),
    nextQuestion: async () => { throw new h.UnderstandingError('AI_ERROR', '다음 질문을 아직 만들지 못했어요. 적은 답은 저장돼 있어요. 한 번 더 눌러 주세요.'); },
  });
  await h.flush();
  h.click('다음 질문 받기 ');
  await h.flush();
  assert.deepEqual(h.questions(), []);
  assert.match(h.content(), /내 원문 a/);
  assert.match(h.content(), /다음 질문을 아직 만들지 못했어요/);
  assert.doesNotMatch(h.content(), /조금만 더 들려줄래요/, '고정 안전문장으로 덮지 않는다');
  h.click('다음 질문 받기 '); // 빠져나갈 문: 다시 받기 버튼이 그대로 있다
});

test('follow-up disabled build records the answer but asks no question', async () => {
  const h = componentHarness({}, { followup: false });
  await h.flush();
  await h.send('나의 이야기');
  assert.equal(h.calls.filter(call => call.name === 'record').length, 1);
  assert.equal(h.calls.some(call => call.name === 'savedQuestion' || call.name === 'nextQuestion' || call.name === 'generate'), false);
});

test('server-disabled screen performs no requests and shows no fabricated question', async () => {
  const h = componentHarness({}, { server: false });
  await h.flush();
  assert.deepEqual(h.questions(), []);
  assert.deepEqual(h.calls, []);
});

// ── 통합안(r2 이식) 추가 검사 ──

// ── v15 「ECHO AI 대화구조 최종 구현명세」 회귀(가짜 서버 기준 — 진짜 AI 결과가 아니다) ──
const five = (i) => ({ id: `n${i}`, text: `답 ${i}`, original_text: `답 ${i}`, status: 'confirmed', revision: 1, created_at: `2026-09-24T0${i}:00:00Z` });
const synthItem = (id, text) => ({ id, text, category: 'value', status: 'candidate', origin: 'ai', source_record_id: 'n4', revision: 1, created_at: '2026-09-24T05:00:00Z' });
const REACTIONS = ['맞아요', '조금 달라요', '그게 아니에요', '직접 설명할게요'];
const reactionButtons = (h) => h.contentNodes().filter(node => node.type === 'button' && REACTIONS.includes(h.content(node)));

test('v15 CASE F: 다섯 답 동안은 답마다 4버튼 카드가 없고, 다섯 번째 답 뒤 통합 카드에서만 4버튼이 한 번 나온다', async () => {
  let n = 0;
  const items = [synthItem('s1', '천천히 알아가는 관계를 원해요.'), synthItem('s2', '대화가 편한 사람을 중요하게 봐요.')];
  const h = componentHarness({
    record: async () => five(n++),
    nextQuestion: async (id) => question(id, `질문 ${n + 1}이에요?`),
    synthesize: async () => ({ items, done: false, empty: false }),
    decideSynthesis: async (decision, ids) => items.filter(i => ids.includes(i.id)).map(i => ({ ...i, status: 'confirmed', revision: 2 })),
  });
  await h.flush();
  for (let turn = 1; turn <= 5; turn++) {
    assert.equal(reactionButtons(h).length, 0, `턴 ${turn}: 답하기 전 4버튼 없음`);
    await h.send(`내 답 ${turn}`);
    if (turn < 5) {
      assert.equal(reactionButtons(h).length, 0, `턴 ${turn}: 답한 뒤에도 4버튼 없음`);
      assert.match(h.content(), new RegExp(`${turn + 1} / 5`), `턴 ${turn}: 진행 표시`);
    }
  }
  assert.equal(h.calls.filter(c => c.name === 'record').length, 5);
  assert.equal(h.calls.filter(c => c.name === 'nextQuestion').length, 4, '다섯 번째 답 뒤에는 다음 질문을 요청하지 않는다');
  assert.equal(h.calls.some(c => c.name === 'generate'), false, '답마다 이해 후보를 만들지 않는다');
  assert.equal(h.calls.filter(c => c.name === 'synthesize').length, 1, '통합 카드는 한 번');
  assert.match(h.content(), /내가 이렇게 이해했어요/);
  assert.match(h.content(), /천천히 알아가는 관계를 원해요/);
  assert.equal(reactionButtons(h).length, 4, '통합 카드 아래에서만 4버튼');
  h.click('맞아요');
  await h.flush();
  assert.deepEqual(h.calls.find(c => c.name === 'decideSynthesis').args, ['confirm', ['s1', 's2']]);
  assert.equal(reactionButtons(h).length, 0, '다 정하면 4버튼이 사라진다');
  assert.match(h.content(), /다섯 가지 답을 모두 저장했어요/);
});

test('v15 CASE D: "뭘더 얘길해야해 너가 내 내용을 반영해서…" = 불만 → 기록하지 않고(다섯 칸 그대로) 짧게 인정한 뒤 같은 답에서 새 질문', async () => {
  const D = '뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야?';
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [] }),
    savedQuestion: async id => question(id, '방금 한 말, 조금만 더 들려줄래요?'),
    classify: async () => ({ kind: 'complaint', reply: '맞아요. 앞에서 한 말을 이어서 다시 여쭤볼게요.' }),
    nextQuestion: async (id) => question(id, '진지하게 알아가려면 어떤 사람이면 좋겠어요?'),
  });
  await h.flush();
  assert.match(h.content(), /2 \/ 5/);
  await h.send(D);
  assert.equal(h.calls.filter(c => c.name === 'record').length, 0, '관계 답변으로 저장하지 않는다');
  assert.deepEqual(h.calls.find(c => c.name === 'classify').args[0], D);
  const next = h.calls.find(c => c.name === 'nextQuestion');
  assert.equal(next.args[2].skip, true, '같은 답에서 새 질문(다른 질문 받기)');
  assert.deepEqual(h.questions(), ['진지하게 알아가려면 어떤 사람이면 좋겠어요?']);
  assert.match(h.content(), /앞에서 한 말을 이어서 다시 여쭤볼게요/, '먼저 답한다');
  assert.match(h.content(), /2 \/ 5/, '진행 숫자가 오르지 않는다');
});

test('v15 CASE E: "할말이없다 휴" = 지친 말 → 기록하지 않고(성향으로 해석 안 함) 다른 질문 받기·오늘은 여기까지', async () => {
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [] }),
    savedQuestion: async id => question(id, '어떤 사람한테 끌려요?'),
    classify: async () => ({ kind: 'fatigue', reply: '괜찮아요. 지금 떠오르지 않으면 이 질문은 넘어가도 돼요.' }),
    nextQuestion: async (id) => question(id, '처음 만나면 어디서 보는 게 편해요?'),
  });
  await h.flush();
  await h.send('할말이없다 휴');
  assert.equal(h.calls.filter(c => c.name === 'record').length, 0, '지친 말은 기록하지 않는다');
  assert.equal(h.calls.some(c => c.name === 'generate'), false, '「할 말이 없다」 이해 후보를 만들지 않는다');
  assert.doesNotMatch(h.content(), /할 말이 없다\./);
  assert.match(h.content(), /넘어가도 돼요/);
  assert.match(h.content(), /오늘은 여기까지 할게요/, '빠져나갈 문');
  assert.equal(reactionButtons(h).length, 0);
  h.click('다른 질문 받기');
  await h.flush();
  assert.equal(h.calls.find(c => c.name === 'nextQuestion').args[2].skip, true);
  assert.deepEqual(h.questions(), ['처음 만나면 어디서 보는 게 편해요?']);
  assert.match(h.content(), /2 \/ 5/, '진행 숫자가 오르지 않는다');
});

test('v15 정정: "그 뜻 아니야"만 오면 기록하지 않고 어떤 뜻이었는지 묻고, 다음 답을 기록할 때 아니라고 한 AI 문장을 함께 보낸다', async () => {
  let kind = 'correction';
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [] }),
    savedQuestion: async id => question(id, '사람을 진지하게 알아가고 싶군요.\n어떤 사람과 진지하게 알아가고 싶어요?'),
    classify: async () => (kind === 'correction' ? { kind, reply: '제가 잘못 짚었네요.\n어떤 뜻이었는지 한 줄로 알려 줄래요?' } : { kind: 'answer' }),
    record: async () => record('b'),
    nextQuestion: async (id) => question(id, '천천히라면 처음엔 어떻게 만나고 싶어요?'),
  });
  await h.flush();
  await h.send('그 뜻 아니야');
  assert.equal(h.calls.filter(c => c.name === 'record').length, 0);
  assert.deepEqual(h.questions(), ['어떤 뜻이었는지 한 줄로 알려 줄래요?']);
  kind = 'answer';
  await h.send('천천히 알아가고 싶다는 거야');
  assert.equal(h.calls.filter(c => c.name === 'record').length, 1, '설명은 원문 그대로 기록한다');
  const next = h.calls.find(c => c.name === 'nextQuestion');
  assert.equal(next.args[2].correction, '사람을 진지하게 알아가고 싶군요.', '아니라고 한 AI 문장(받아 주는 첫 줄)을 서버에 알린다');
});

test('v15 AI 에게 한 질문(ask): 기록하지 않고 먼저 답한 뒤 같은 질문(첫 질문에서도) · 예전 서버면 v14.4 되묻기로', async () => {
  const FIRST = '당신이 잠든 사이, 요즘 가장 자주 떠오르는 사람이나 마음은 뭐예요?';
  const h = componentHarness({
    classify: async (text, shown) => ({ kind: 'ask', reply: '여기에 답한 말로 어떤 사람을 소개할지 정해요.', question: shown }),
  });
  await h.flush();
  assert.deepEqual(h.questions(), [FIRST]);
  await h.send('근데 왜 이런 걸 물어봐');
  assert.equal(h.calls.filter((c) => c.name === 'record').length, 0, 'AI 에게 한 질문은 답으로 저장하지 않는다');
  assert.deepEqual(h.questions(), [FIRST], '새 질문이 아니라 같은 질문');
  assert.match(h.content(), /여기에 답한 말로 어떤 사람을 소개할지 정해요\./, '먼저 답한다');
  // 예전 서버(분류 계약 없음 → BAD_REQUEST): v14.4 규칙 + 되묻기 계약으로 같은 약속을 지킨다.
  const old = componentHarness({
    classify: async () => { throw new old.UnderstandingError('BAD_REQUEST', 'unknown'); },
    rephrase: async (q) => ({ meta: true, kind: 'ask', reply: '여기에 답한 말로 어떤 사람을 소개할지 정해요.', question: q, fallback: false }),
  });
  await old.flush();
  await old.send('근데 왜 이런 걸 물어봐');
  assert.equal(old.calls.filter((c) => c.name === 'record').length, 0);
  assert.equal(old.calls.filter((c) => c.name === 'rephrase').length, 1);
});

test('v15 통합 카드 — 조금 달라요(한 문장 골라 고침) · 그게 아니에요(모두 빼고 원문 보존) · 직접 설명(설명 우선으로 다시 정리)', async () => {
  const records = [0, 1, 2, 3, 4].map(five);
  const items = () => [synthItem('s1', '천천히 알아가는 관계를 원해요.'), synthItem('s2', '조용한 곳을 좋아해요.')];
  // 조금 달라요
  let h = componentHarness({
    load: async () => ({ records, insights: [] }),
    synthesize: async () => ({ items: items(), done: false, empty: false }),
    react: async (item, decision, text) => ({ ...item, text, status: 'corrected', revision: 2 }),
    decideSynthesis: async (decision, ids) => items().filter(i => ids.includes(i.id)).map(i => ({ ...i, status: 'confirmed', revision: 2 })),
  });
  await h.flush();
  h.click('조금 달라요');
  await h.flush();
  h.click('조용한 곳을 좋아해요.이 문장 고치기');
  await h.flush();
  h.type('echo-synthesis-text', '시끄럽지 않은 곳이면 괜찮아요.');
  await h.flush();
  h.click('이렇게 저장할게요 ');
  await h.flush();
  assert.deepEqual(h.calls.find(c => c.name === 'react').args.slice(1), ['correct', '시끄럽지 않은 곳이면 괜찮아요.']);
  assert.match(h.content(), /내가 고친 말/);
  assert.equal(reactionButtons(h).length, 4, '남은 항목이 있으니 카드와 4버튼이 그대로');
  h.click('맞아요');
  await h.flush();
  assert.deepEqual(h.calls.find(c => c.name === 'decideSynthesis').args, ['confirm', ['s1']], '고친 항목은 다시 확인하지 않는다');
  // 그게 아니에요 → 직접 설명
  h = componentHarness({
    load: async () => ({ records, insights: [] }),
    synthesize: async () => ({ items: items(), done: false, empty: false }),
    decideSynthesis: async (decision, ids) => items().filter(i => ids.includes(i.id)).map(i => ({ ...i, status: 'rejected', revision: 2 })),
    reviseSynthesis: async (text) => ({ self: { ...synthItem('self1', text), origin: 'self', status: 'confirmed' }, items: [synthItem('s3', '대화가 편한 사람을 원해요.')] }),
  });
  await h.flush();
  h.click('그게 아니에요');
  await h.flush();
  assert.deepEqual(h.calls.find(c => c.name === 'decideSynthesis').args, ['reject', ['s1', 's2']]);
  assert.match(h.content(), /처음 적은 답은 그대로 뒀어요/);
  assert.doesNotMatch(h.content(), /천천히 알아가는 관계를 원해요/, '뺀 문장은 카드에서 사라진다');
  h.click('직접 설명할게요');
  await h.flush();
  h.type('echo-synthesis-text', '편하게 대화되는 사람이 제일 중요해요');
  await h.flush();
  h.click('이렇게 저장할게요 ');
  await h.flush();
  assert.deepEqual(h.calls.find(c => c.name === 'reviseSynthesis').args, ['편하게 대화되는 사람이 제일 중요해요']);
  assert.match(h.content(), /내가 직접 설명한 말/);
  assert.match(h.content(), /대화가 편한 사람을 원해요/, '설명을 앞에 두고 다시 정리한 카드');
  assert.equal(reactionButtons(h).length, 4);
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
  assert.match(text, /딱 다섯 개만 묻고, 끝나면 한 번에 확인할게요/, '끝이 있다는 약속 · v15 확인은 끝에 한 번');
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
  assert.match(text, /「처음부터 시작하기」/);
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
  h.click('처음부터 시작하기');
  await h.flush();
  assert.match(h.content(), /지금 대화를 여기서 끝내고 처음부터 다시 시작할까요\?/);
  h.click('처음부터 시작할게요');
  await h.flush();
  assert.equal(restarted, 1, '확인을 누르면 실제로 새 회차를 시작한다');
});

test('v14.3 앱 홈에서 들어오면(restartPrompt) 확인 창이 바로 열려 있고, 취소하면 버튼으로 돌아간다', async () => {
  const h = componentHarness({ load: async () => ({ records: manyRecords(5), insights: [] }) }, { props: { onRestart: async () => null, restartPrompt: true } });
  await h.flush();
  assert.match(h.content(), /지금 대화를 여기서 끝내고 처음부터 다시 시작할까요\?/);
  h.click('계속할게요');
  await h.flush();
  assert.doesNotMatch(h.content(), /지금 대화를 여기서 끝내고/);
  // 취소 뒤 끝 화면 버튼·아래 버튼 모두 다시 누를 수 있다(굳지 않는다). 끝 화면에서는 위 버튼 대신 끝 화면 버튼을 쓴다.
  h.clickNth('처음부터 시작하기', 0);
  await h.flush();
  h.click('계속할게요');
  await h.flush();
  h.clickNth('처음부터 시작하기', 1);
  await h.flush();
  assert.match(h.content(), /지금 대화를 여기서 끝내고/);
});

// v15.2(대표 2026-09-24): 전에는 기록이 없으면 위 버튼을 숨겼다. 이제 대화에 들어온 순간부터 보인다(TEST C — 정상 대화 중 첫 답 전).
test('v15.2 TEST C 대화에 들어온 순간(첫 답 전)부터 위쪽 「처음부터 시작하기」가 있다', async () => {
  const h = componentHarness({ load: async () => ({ records: [], insights: [] }) }, { props: { onRestart: async () => null } });
  await h.flush();
  assert.ok(h.contentNodes().some(node => node.props.className === 'echo-restart-top'));
});

test('2026-09-24 끝 화면에서도 「처음부터 시작하기」가 바로 보이고, 확인하면 실제로 새 회차를 시작한다', async () => {
  let restarted = 0;
  const h = componentHarness({ load: async () => ({ records: manyRecords(5), insights: [] }) }, { props: { onRestart: async () => { restarted++; return null; } } });
  await h.flush();
  assert.match(h.content(), /다섯 가지, 다 들었어요/);
  assert.equal(h.contentNodes().some(node => node.props.className === 'echo-restart-top'), false, '끝 화면에서는 위 버튼을 겹쳐 두지 않는다');
  h.clickNth('처음부터 시작하기', 0);
  await h.flush();
  assert.match(h.content(), /지금 대화를 여기서 끝내고 처음부터 다시 시작할까요\?/);
  h.click('처음부터 시작할게요');
  await h.flush();
  assert.equal(restarted, 1);
});

// ── v15.2 대표 실기기 실제 실패(2026-09-24 "그냥 편한친구 부담없이" → "다음 질문을 아직 만들지 못했어요") — 「처음부터 시작하기」 ──
test('v15.2 TEST B 다음 질문을 못 만든 오류 상태에서도 위쪽 「처음부터 시작하기」가 눌린다(막다른 길 없음)', async () => {
  let restarted = 0;
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [] }),
    nextQuestion: async () => { throw new h.UnderstandingError('AI_ERROR', '다음 질문을 아직 만들지 못했어요. 적은 답은 저장돼 있어요. 한 번 더 눌러 주세요.'); },
  }, { props: { onRestart: async () => { restarted++; return null; } } });
  await h.flush();
  h.click('다음 질문 받기 ');
  await h.flush();
  assert.match(h.content(), /다음 질문을 아직 만들지 못했어요/);
  assert.ok(h.contentNodes().some(node => node.props.className === 'echo-restart-top'), '오류 상태에서도 위쪽 버튼이 있다');
  h.clickNth('처음부터 시작하기', 0);
  await h.flush();
  h.click('처음부터 시작할게요');
  await h.flush();
  assert.equal(restarted, 1);
});

test('v15.2 TEST D·E 「처음부터 시작할게요」는 새 회차만 시작한다 — 한 번 누르면 한 번, 기록을 지우거나 고치는 요청은 0건', async () => {
  let restarted = 0;
  const h = componentHarness({ load: async () => ({ records: manyRecords(2), insights: [] }) }, { props: { onRestart: async () => { restarted++; return null; } } });
  await h.flush();
  const before = h.calls.map(c => c.name);
  h.clickNth('처음부터 시작하기', 0);
  await h.flush();
  // 1차 선택만으로는 아무것도 바뀌지 않는다(실수 방지 — 두 번째 확인이 있어야 한다).
  assert.equal(restarted, 0);
  h.click('처음부터 시작할게요');
  await h.flush();
  assert.equal(restarted, 1);
  const after = h.calls.map(c => c.name).slice(before.length);
  assert.equal(after.some(name => /delete|update|reject|correct|confirm/i.test(name)), false, `기록을 지우거나 바꾸는 요청이 없다: ${after.join(',')}`);
  assert.match(h.content(), /지난 이야기는 지우지 않았어요/);
});

test('v15.2 TEST F 새로고침 뒤: 새 회차 시작 시각이 지난 답보다 뒤면 이번 회차 0개 — 첫 질문부터, 지난 답은 「이전 회차」로 남는다', async () => {
  const h = componentHarness({ load: async () => ({ records: manyRecords(3), insights: [] }) }, { props: { onRestart: async () => null, roundStartedAt: '2026-09-24T10:00:00.000Z' } });
  await h.flush();
  assert.match(h.content(), /당신이 잠든 사이, 요즘 가장 자주 떠오르는 사람이나 마음은 뭐예요\?/, '새 회차의 첫 질문');
  assert.match(h.content(), /답 0/, '지난 답은 지우지 않고 남아 있다');
  assert.equal(h.calls.filter(call => call.name === 'nextQuestion').length, 0, '지난 회차 답으로 다음 질문을 만들지 않는다');
});

// ── v14.4 대화 연결성(대표 긴급 정정 2026-09-24) — 화면 쪽 약속 ──


test('v14.4 답을 보낼 때 그 답이 받은 질문(화면에 떠 있던 문장)을 서버에 함께 보낸다 — 분류·다음 질문 요청 모두', async () => {
  const FIRST = '당신이 잠든 사이, 요즘 가장 자주 떠오르는 사람이나 마음은 뭐예요?';
  const h = componentHarness({
    record: async () => record('n1'),
    nextQuestion: async (id) => question(id, '다음 질문이에요?'),
  }, { props: { autoQuestion: true } });
  await h.flush();
  await h.send('요즘 친구 생각이 자주 나요');
  assert.equal(h.calls.find((c) => c.name === 'classify').args[1], FIRST, '분류도 떠 있던 질문과 함께');
  const next = h.calls.find((c) => c.name === 'nextQuestion');
  assert.ok(next, '기록하면 곧바로 다음 질문을 요청한다');
  assert.equal(next.args[1], FIRST, '첫 답은 첫 고정 질문에 대한 답');
});


// v15.1 대표 결정 「모르겠어요 ×5 연결 자격 금지」: 다섯 칸은 끝났어도, 넘긴 답이 있으면 연결 자격에 세지 않는다고 끝 화면에서 말한다.
test('v15.1 끝 화면: 「모르겠어요」로 넘긴 답 수를 알리고 다시 답할 길을 알려 준다 · 넘긴 답이 없으면 알리지 않는다', async () => {
  const texts = ['진지하게 알아가고싶어', '모르겠어요', '잘 웃는 사람', '몰라', '산책이요'];
  const recs = manyRecords(5).map((r, i) => ({ ...r, text: texts[i], original_text: texts[i] }));
  const h = componentHarness({ load: async () => ({ records: recs, insights: [] }) });
  await h.flush();
  assert.match(h.content(), /「모르겠어요」처럼 넘긴 답 2개는 연결 자격에 세지 않아요/);
  assert.match(h.content(), /처음부터 시작하기/);
  const plain = componentHarness({ load: async () => ({ records: manyRecords(5), insights: [] }) });
  await plain.flush();
  assert.doesNotMatch(plain.content(), /넘긴 답/);
});

// v15.1 대표 결정 2·3 [가짜 서버 기준]: "그게 아니에요"를 분류할 때 지금 떠 있는 AI 문장을 서버에 함께 보낸다(서버가 설명을 묻기 전에 거절로 저장).
// 안내를 보인 뒤 또 "아니야"만 오면 같은 안내를 되풀이하지 않고 다른 질문으로 넘어간다(사용자가 AI 를 관리하게 만들지 않는다).
test('v15.1 정정: 분류 요청에 떠 있는 AI 문장·기록 번호를 함께 보내고, 두 번째 "아니야"는 안내를 되풀이하지 않고 다른 질문으로 넘어간다', async () => {
  const PROMPT = '제가 잘못 짚었네요.\n어떤 뜻이었는지 한 줄로 알려 줄래요?';
  let n = 0;
  const h = componentHarness({
    load: async () => ({ records: [record('a')], insights: [] }),
    savedQuestion: async id => question(id, '밝은 에너지를 주는 사람이 좋으시군요.\n그런 사람이랑 만나면 같이 뭐 하고 싶어요?'),
    classify: async () => (++n === 1 ? { kind: 'correction', reply: PROMPT, rejected: true } : { kind: 'correction', reply: '알겠어요. 다른 걸 여쭤볼게요.', again: true, rejected: false }),
    nextQuestion: async (id, _answered, opts) => question(id, opts?.skip ? '잘 웃는 사람과 뭐 하고 싶어요?' : 'x'),
  });
  await h.flush();
  await h.send('그게 아니에요');
  const first = h.calls.find(c => c.name === 'classify');
  assert.equal(first.args[2].correction, '밝은 에너지를 주는 사람이 좋으시군요.', '떠 있는 AI 해석(첫 줄)을 보낸다');
  assert.equal(first.args[2].recordId, 'a');
  assert.deepEqual(h.questions(), ['어떤 뜻이었는지 한 줄로 알려 줄래요?']);
  await h.send('아니야');
  assert.equal(h.calls.filter(c => c.name === 'record').length, 0, '"아니야"는 답으로 저장하지 않는다');
  const skip = h.calls.find(c => c.name === 'nextQuestion');
  assert.equal(skip?.args[2]?.skip, true, '같은 안내 대신 다른 질문을 받는다');
  assert.deepEqual(h.questions(), ['잘 웃는 사람과 뭐 하고 싶어요?']);
  assert.doesNotMatch(h.content(), /어떤 뜻이었는지 한 줄로/, '정정 안내를 되풀이하지 않는다');
});
