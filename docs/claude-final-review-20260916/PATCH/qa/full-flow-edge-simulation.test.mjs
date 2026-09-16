import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(process.env.ECHO_PROJECT_ROOT || process.cwd());

const clone = (value) => structuredClone(value);

class FakeQuery {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.op = 'select';
    this.payload = null;
    this.filters = [];
    this.orGroups = [];
    this.orderBy = null;
    this.maxRows = null;
    this.selectOptions = null;
    this.returning = false;
  }

  select(_columns = '*', options = undefined) {
    this.returning = this.op !== 'select';
    this.selectOptions = options ?? null;
    return this;
  }

  insert(payload) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  gte(column, value) {
    this.filters.push((row) => String(row[column] ?? '') >= String(value));
    return this;
  }

  is(column, value) {
    this.filters.push((row) => value === null ? row[column] == null : row[column] === value);
    return this;
  }

  in(column, values) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  or(expression) {
    const checks = expression.split(',').map((part) => {
      const match = part.match(/^([^.]+)\.(is|neq|lt)\.(.*)$/);
      assert.ok(match, `unsupported fake .or condition: ${part}`);
      const [, column, operator, raw] = match;
      if (operator === 'is') return (row) => raw === 'null' ? row[column] == null : String(row[column]) === raw;
      if (operator === 'neq') return (row) => String(row[column] ?? '') !== raw;
      return (row) => String(row[column] ?? '') < raw;
    });
    this.orGroups.push((row) => checks.some((check) => check(row)));
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderBy = { column, ascending };
    return this;
  }

  limit(value) {
    this.maxRows = value;
    return this;
  }

  maybeSingle() {
    return this.execute('maybeSingle');
  }

  single() {
    return this.execute('single');
  }

  then(resolvePromise, rejectPromise) {
    return this.execute('many').then(resolvePromise, rejectPromise);
  }

  matchingRows() {
    let rows = this.db.rows[this.table] ?? [];
    rows = rows.filter((row) => this.filters.every((filter) => filter(row)) && this.orGroups.every((group) => group(row)));
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = [...rows].sort((a, b) => String(a[column] ?? '').localeCompare(String(b[column] ?? '')) * (ascending ? 1 : -1));
    }
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
    return rows;
  }

  async execute(mode) {
    const failure = this.db.consumeFailure({ table: this.table, op: this.op, payload: this.payload });
    if (failure) return { data: null, error: new Error(failure), count: null };

    if (this.op === 'select') {
      const rows = this.matchingRows().map(clone);
      if (this.selectOptions?.count === 'exact' && this.selectOptions?.head) {
        return { data: null, error: null, count: rows.length };
      }
      if (mode === 'single') {
        return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: new Error('single row expected') };
      }
      if (mode === 'maybeSingle') {
        return rows.length <= 1 ? { data: rows[0] ?? null, error: null } : { data: null, error: new Error('multiple rows') };
      }
      return { data: rows, error: null };
    }

    if (this.op === 'insert') {
      const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = inputs.map((input) => this.db.makeRow(this.table, input));
      this.db.rows[this.table].push(...inserted);
      this.db.mutations.push({ op: 'insert', table: this.table, count: inserted.length });
      if (mode === 'single') return { data: clone(inserted[0]), error: null };
      if (mode === 'maybeSingle') return { data: inserted.length === 1 ? clone(inserted[0]) : null, error: inserted.length <= 1 ? null : new Error('multiple rows') };
      return { data: this.returning ? inserted.map(clone) : null, error: null };
    }

    const matched = this.matchingRows();
    if (this.op === 'update') {
      for (const row of matched) Object.assign(row, clone(this.payload));
      this.db.mutations.push({ op: 'update', table: this.table, count: matched.length, payload: clone(this.payload) });
      return { data: this.returning ? matched.map(clone) : null, error: null };
    }

    if (this.op === 'delete') {
      const ids = new Set(matched.map((row) => row.id));
      this.db.rows[this.table] = this.db.rows[this.table].filter((row) => !ids.has(row.id));
      this.db.mutations.push({ op: 'delete', table: this.table, count: matched.length });
      return { data: this.returning ? matched.map(clone) : null, error: null };
    }

    throw new Error(`unsupported fake operation: ${this.op}`);
  }
}

class FakeDatabase {
  constructor() {
    this.rows = {
      conversations: [],
      emotions: [],
      messages: [],
      understanding_results: [],
      payments: [],
      reports: [],
    };
    this.mutations = [];
    this.failures = [];
    this.sequence = 0;
  }

  from(table) {
    assert.ok(table in this.rows, `unknown fake table: ${table}`);
    return new FakeQuery(this, table);
  }

  makeRow(table, input) {
    const sequence = ++this.sequence;
    const timestamp = new Date(Date.UTC(2026, 8, 15, 10, 0, sequence)).toISOString();
    return {
      id: input.id ?? `${table}-${sequence}`,
      created_at: input.created_at ?? timestamp,
      updated_at: input.updated_at ?? timestamp,
      ...clone(input),
    };
  }

  seed(table, input) {
    const row = this.makeRow(table, input);
    this.rows[table].push(row);
    return row;
  }

  failOnce(predicate, message = 'simulated database failure') {
    this.failures.push({ predicate, message });
  }

  consumeFailure(context) {
    const index = this.failures.findIndex((failure) => failure.predicate(context));
    if (index < 0) return '';
    return this.failures.splice(index, 1)[0].message;
  }
}

function createAiFetch({ tossApproved = false } = {}) {
  const questions = [
    '편안한 마음에서 지금 가장 또렷한 감정은 무엇인가요?',
    '그 편안함이 오늘 생활에 어떻게 나타났는지 말해줄 수 있나요?',
    '그 마음에서 지금 더 들려주고 싶은 부분은 무엇인가요?',
    '오늘의 편안함이 나에게 어떤 의미인지 말해줄 수 있나요?',
    '지금 가장 중요하게 느끼는 것은 무엇인가요?',
    '그 마음을 설명하는 다른 말이 있다면 무엇인가요?',
    '오늘 이야기에서 내가 기억하고 싶은 한 가지는 무엇인가요?',
    '지금의 편안함을 위해 할 수 있는 작은 선택은 무엇인가요?',
    '오늘 천천히 쉬고 싶은 이유는 무엇인가요?',
    '오늘 마음에서 이전과 다른 점은 무엇인가요?',
    '그 한마디에서 더 설명하고 싶은 부분은 무엇인가요?',
    '그 부분이 나에게 왜 중요하다고 느껴지나요?',
  ];
  let questionIndex = 0;
  let summaryIndex = 0;
  let failNextOpenAi = false;
  const calls = { openai: 0, toss: 0, questionCandidates: [] };

  const fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes('tosspayments.com')) {
      calls.toss += 1;
      if (!tossApproved) throw new Error('Toss must not be called while review_pending');
      const request = JSON.parse(options.body);
      return new Response(JSON.stringify({
        status: 'DONE',
        orderId: request.orderId,
        totalAmount: request.amount,
        method: '카드',
        approvedAt: '2026-09-15T10:30:00.000Z',
        receipt: { url: 'https://example.test/receipt' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    assert.equal(address, 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    if (failNextOpenAi) {
      failNextOpenAi = false;
      throw new Error('simulated OpenAI connection failure');
    }

    const request = JSON.parse(options.body);
    const system = String(request.messages?.[0]?.content ?? '');
    let content;
    if (system.includes('자기이해 리포트')) {
      content = JSON.stringify({
        title: '오늘의 편안함을 이해하는 기록',
        summary: '나는 편안함을 중요하게 느꼈어요. 오늘의 말을 바탕으로 나를 이해해 봤어요.',
        sections: [
          { heading: '지금의 마음', body: '나는 오늘 편안하다고 직접 말했어요. 이 감정은 지금 확인된 내용이에요. 이 마음을 천천히 살펴볼 수 있어요.', status: 'confirmed', anchor: '편안' },
          { heading: '내가 중요하게 여긴 것', body: '나는 여유가 중요하다고 말했어요. 이것은 내 표현에서 확인한 내용이에요. 다른 뜻을 억지로 붙이지 않았어요.', status: 'confirmed', anchor: '여유' },
          { heading: '다음에 살펴볼 것', body: '이 편안함을 이어갈 방법은 아직 후보예요. 나에게 맞는지 천천히 확인해 볼 수 있을 것 같아요. 지금 정답을 정할 필요는 없어요.', status: 'candidate' },
          // AI 가 confirmed 라고 주장하지만 사용자 근거에 없는 표현(관계) → 서버가 candidate 로 내려야 한다
          { heading: '반복되는 패턴', body: '나는 관계에서 늘 먼저 물러나는 편이에요. 이것은 여러 번 확인된 사실이에요. 앞으로도 같은 선택을 할 가능성이 커요.', status: 'confirmed', anchor: '관계에서 물러나' },
        ],
        next_step: '오늘 편안했던 이유를 한 줄로 남겨볼 수 있어요.',
      });
    } else if (system.includes('요약해라')) {
      content = summaryIndex++ === 0
        ? '오늘은 마음이 편안하고, 여유를 중요하게 느끼는 것 같아요.'
        : '일을 마친 뒤 스스로 정한 속도를 중요하게 여기는 것 같아요.';
    } else if (request.response_format) {
      const question = questions[questionIndex++ % questions.length];
      calls.questionCandidates.push(question);
      content = JSON.stringify({
        candidates: [{
          acknowledgement: '편안하다고 말해주셨네요.',
          question,
          anchor: '편안',
          assumptions: [],
          meaning: `새로운 질문 ${questionIndex}`,
          keys: [`새의미${questionIndex}`],
        }],
      });
    } else {
      content = questions[questionIndex++ % questions.length];
    }
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return {
    fetch,
    calls,
    failNext() {
      failNextOpenAi = true;
    },
  };
}

function createLowInformationRepeatAiFetch() {
  const candidates = [
    { question: '편안함이 나에게 어떤 의미인지 말해줄 수 있나요?', anchor: '편안함' },
    { question: '오늘 마음을 색으로 고르면 무엇인가요?', anchor: '오늘 마음' },
    { question: '오늘 마음을 색으로 고르면 무엇인가요?', anchor: '오늘 마음' },
    { question: '편안해진 때 몸이 먼저 하고 싶은 작은 행동은 무엇인가요?', anchor: '편안해' },
    { question: '편안해진 때 몸이 먼저 하고 싶은 작은 행동은 무엇인가요?', anchor: '편안해' },
    { question: '오늘 대화 끝에 남기고 싶은 짧은 말은 무엇인가요?', anchor: '오늘' },
  ];
  let index = 0;
  const calls = { openai: 0, userPrompts: [], systemPrompts: [] };

  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const request = JSON.parse(options.body);
    const systemPrompt = String(request.messages?.[0]?.content ?? '');
    const userPrompt = String(request.messages?.[1]?.content ?? '');
    calls.systemPrompts.push(systemPrompt);
    calls.userPrompts.push(userPrompt);
    const candidate = candidates[index++];
    assert.ok(candidate, `unexpected OpenAI call ${index}`);
    const content = JSON.stringify({
      candidates: [{
        acknowledgement: `${candidate.anchor}이라고 말해주셨네요.`,
        question: candidate.question,
        anchor: candidate.anchor,
        assumptions: [],
        meaning: candidate.question,
        keys: [candidate.anchor],
      }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetch, calls };
}

function createProductionIncidentRecoveryAiFetch() {
  const candidates = [
    {
      question: '잘 살아가려고 노력하는 방법 중 요즘 가장 중요한 것은 무엇인가요?',
      anchor: '잘 살아가려고 노력',
    },
    {
      question: '하고 싶은 일 중 요즘 가장 손이 가는 것은 무엇인가요?',
      anchor: '묵묵히 제가 하고 싶은 일들을 하며 하루를 보낼때',
    },
    {
      question: '하고 싶은 일에서 더 이야기하고 싶은 부분은 무엇인가요?',
      anchor: '하고 싶은 일',
    },
    {
      question: '오늘 대화 끝에 남기고 싶은 짧은 말은 무엇인가요?',
      anchor: '오늘',
    },
  ];
  let index = 0;
  const calls = { openai: 0, userPrompts: [], systemPrompts: [] };

  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const request = JSON.parse(options.body);
    calls.systemPrompts.push(String(request.messages?.[0]?.content ?? ''));
    calls.userPrompts.push(String(request.messages?.[1]?.content ?? ''));
    const candidate = candidates[index++];
    assert.ok(candidate, `unexpected OpenAI call ${index}`);
    const content = JSON.stringify({
      candidates: [{
        acknowledgement: `${candidate.anchor}이라고 말해주셨네요.`,
        question: candidate.question,
        anchor: candidate.anchor,
        assumptions: [],
        meaning: candidate.question,
        keys: [candidate.anchor],
      }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetch, calls };
}

function createPlanBRepairAiFetch() {
  const calls = { openai: 0, userPrompts: [], systemPrompts: [] };
  const fetch = async (url, options = {}) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    calls.openai += 1;
    const request = JSON.parse(options.body);
    calls.systemPrompts.push(String(request.messages?.[0]?.content ?? ''));
    calls.userPrompts.push(String(request.messages?.[1]?.content ?? ''));
    const content = JSON.stringify({
      candidates: [{
        acknowledgement: '일이 끝나서 편안하다고 바로잡아 주셨네요.',
        question: '일이 끝난 뒤 가장 먼저 달라진 점은 무엇인가요?',
        anchor: '일이 끝나서 편안한 거야',
        assumptions: [],
        meaning: '정정된 사실에서 변화 한 가지를 묻기',
        keys: ['일이 끝남', '달라진 점'],
      }],
    });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

async function loadEdgeHandler(relativePath, db, aiFetch, { paymentEnabled = false } = {}) {
  const absolutePath = resolve(root, relativePath);
  let source = await readFile(absolutePath, 'utf8');
  source = source.replace(
    /import \{ createClient, type SupabaseClient \} from "npm:@supabase\/supabase-js@2\.57\.4";/,
    'const createClient = globalThis.__echoCreateClient;',
  );
  if (relativePath.includes('echo-payment') && paymentEnabled) {
    source = source.replace('const PAYMENT_MODE = "review_pending" as "review_pending" | "enabled";', 'const PAYMENT_MODE = "enabled" as "review_pending" | "enabled";');
  }
  if (relativePath.includes('echo-journey')) {
    const qualityUrl = pathToFileURL(resolve(absolutePath, '..', 'question-quality.ts')).href;
    source = source.replace('from "./question-quality.ts";', `from ${JSON.stringify(qualityUrl)};`);
  }
  source += `\n//# sourceURL=${absolutePath}?simulation=${Date.now()}-${Math.random()}\n`;
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: absolutePath,
  }).outputText;

  let captured = null;
  globalThis.__echoCreateClient = (_url, key, options = {}) => {
    if (key === 'service') return db;
    const authHeader = options?.global?.headers?.Authorization ?? '';
    const userId = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    return {
      auth: {
        getUser: async () => userId
          ? { data: { user: { id: userId } }, error: null }
          : { data: { user: null }, error: new Error('unauthorized') },
      },
    };
  };
  globalThis.Deno = {
    env: {
      get: (name) => ({
        SUPABASE_URL: 'https://fake.supabase.local',
        SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        OPENAI_API_KEY: 'test-openai-key',
        OPENAI_MODEL: 'gpt-40-mini',
        TOSS_SECRET_KEY: 'test_fixture_secret',
      })[name] ?? '',
    },
    serve: (handler) => {
      captured = handler;
    },
  };
  globalThis.fetch = aiFetch.fetch;
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  assert.equal(typeof captured, 'function', `${relativePath} did not register an Edge handler`);
  return captured;
}

async function invoke(handler, userId, body) {
  const response = await handler(new Request('https://fake.supabase.local/functions/v1/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userId}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { httpStatus: response.status, body: await response.json() };
}

function token(label) {
  return `token-${label.padEnd(8, 'x')}`;
}

async function completeFreeStage(early, userId = 'user-1') {
  const started = await invoke(early, userId, { action: 'start', mindText: '오늘은 마음이 편안해', token: token(`${userId}-start`) });
  assert.equal(started.body.status, 'step1');
  const conversationId = started.body.conversationId;
  assert.ok(conversationId);

  const step1Question = await invoke(early, userId, { action: 'ask', conversationId, token: token(`${userId}-ask1`) });
  assert.equal(step1Question.body.status, 'step1');
  assert.equal(step1Question.body.needsQuestion, false);
  const step1Answer = await invoke(early, userId, { action: 'answer', conversationId, answer: '편안해서 조금 여유가 생겼어', token: token(`${userId}-answer1`) });
  assert.equal(step1Answer.body.status, 'step2');

  await invoke(early, userId, { action: 'ask', conversationId, token: token(`${userId}-ask2`) });
  const step2Answer = await invoke(early, userId, { action: 'answer', conversationId, answer: '서두르지 않아도 된다는 여유야', token: token(`${userId}-answer2`) });
  assert.equal(step2Answer.body.status, 'understanding');

  const understanding = await invoke(early, userId, { action: 'ask', conversationId, token: token(`${userId}-under`) });
  assert.equal(understanding.body.status, 'understanding');
  assert.match(understanding.body.understanding, /편안/);
  const agreed = await invoke(early, userId, { action: 'choose', conversationId, choice: 'agree', text: '', token: token(`${userId}-agree`) });
  assert.equal(agreed.body.status, 'step3');
  return conversationId;
}

test('review_pending allows STEP 1~7 for free and makes zero orders or Toss calls', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai);

  const conversationId = await completeFreeStage(early);
  const resumed = await invoke(journey, 'user-1', { action: 'resume', conversationId });
  assert.equal(resumed.body.status, 'step3');

  const earlyPayment = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(earlyPayment.body.code, 'INVALID_STATE');
  assert.equal(db.rows.payments.length, 0);
  assert.equal(ai.calls.toss, 0);

  for (const step of [3, 4, 5, 6, 7]) {
    const asked = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token(`free-ask-${step}`) });
    assert.equal(asked.body.status, `step${step}`);
    const answered = await invoke(journey, 'user-1', {
      action: 'answer', conversationId, answer: `무료 대화 ${step}단계에서 새롭게 답한 내용`, token: token(`free-answer-${step}`),
    });
    assert.equal(answered.body.status, step < 7 ? `step${step + 1}` : 'report_ready');
  }

  const paymentCreate = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(paymentCreate.body.code, 'PAYMENT_NOT_CONFIGURED');
  assert.equal(db.rows.payments.length, 0);
  assert.equal(ai.calls.toss, 0);

  const crossUser = await invoke(journey, 'user-2', { action: 'resume', conversationId });
  assert.equal(crossUser.httpStatus, 403);
  assert.equal(crossUser.body.code, 'FORBIDDEN');
});

test('enabled payment fixture charges only after STEP 7 and preserves the completed journey', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch({ tossApproved: true });
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai, { paymentEnabled: true });
  const conversationId = await completeFreeStage(early);

  const earlyOrder = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(earlyOrder.body.code, 'INVALID_STATE');
  assert.equal(db.rows.payments.length, 0);

  await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask3') });
  const step3 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '내가 숨을 고를 수 있다는 뜻이야', token: token('answer3') });
  assert.equal(step3.body.status, 'step4');

  const forged = await invoke(journey, 'user-1', {
    action: 'answer', conversationId, answer: '프론트가 완료라고 보냄', status: 'report_ready', paid: true, token: token('forged2'),
  });
  assert.equal(forged.body.ok, false);
  assert.equal(forged.body.code, 'INVALID_STATE');
  assert.equal(db.rows.conversations[0].status, 'step4');

  await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask4') });
  const feedback = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '같은 질문이잖아', token: token('feedback4') });
  assert.equal(feedback.body.status, 'step4');
  assert.equal(feedback.body.needsQuestion, true);
  const repaired = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('repair4') });
  assert.equal(repaired.body.status, 'step4');
  assert.match(repaired.body.question, /^맞아요\. 같은 내용을 되묻지 않고 질문을 바꿔볼게요\./);
  const step4 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '내가 조급해지지 않는 게 중요해', token: token('answer4') });
  assert.equal(step4.body.status, 'step5');

  const asked5 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask5') });
  assert.equal(asked5.body.status, 'step5');
  assert.doesNotMatch(asked5.body.question, /^맞아요\. 같은 내용을 되묻지 않고 질문을 바꿔볼게요\./, 'old feedback must not leak into later steps');
  const step5 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '모르겠어요', token: token('answer5') });
  assert.equal(step5.body.status, 'step6');

  const asked6 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask6') });
  assert.equal(asked6.body.status, 'step6');
  assert.match(asked6.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
  db.failOnce(({ table, op, payload }) => table === 'conversations' && op === 'update' && payload?.request_action === 'answer');
  const failedSave = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 천천히 쉬고 싶어', token: token('savefail6') });
  assert.equal(failedSave.body.ok, false);
  assert.equal(db.rows.conversations[0].status, 'step6');
  assert.equal(db.rows.messages.some((message) => message.content === '오늘은 천천히 쉬고 싶어'), false);

  const step6Token = token('answer6');
  const step6 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 천천히 쉬고 싶어', token: step6Token });
  assert.equal(step6.body.status, 'step7');
  const duplicateStep6 = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 천천히 쉬고 싶어', token: step6Token });
  assert.equal(duplicateStep6.body.status, 'step7');
  assert.equal(db.rows.messages.filter((message) => message.content === '오늘은 천천히 쉬고 싶어').length, 1);

  const asked7 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('ask7') });
  assert.equal(asked7.body.status, 'step7', JSON.stringify({ body: asked7.body, questionCandidates: ai.calls.questionCandidates }));
  const step7Feedback = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '이게 무슨 말이야', token: token('feedback7') });
  assert.equal(step7Feedback.body.status, 'step7');
  const repaired7 = await invoke(journey, 'user-1', { action: 'ask', conversationId, token: token('repair7') });
  assert.equal(repaired7.body.status, 'step7', JSON.stringify({ body: repaired7.body, questionCandidates: ai.calls.questionCandidates }));
  const completed = await invoke(journey, 'user-1', { action: 'answer', conversationId, answer: '오늘은 내 속도를 존중하고 싶어', token: token('answer7') });
  assert.equal(completed.body.status, 'report_ready');
  assert.equal(completed.body.needsQuestion, false);

  const order = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(order.body.ok, true);
  assert.equal(order.body.amount, 4900);
  assert.equal(db.rows.payments.length, 1);
  assert.equal(ai.calls.toss, 0);

  const wrongAmount = await invoke(payment, 'user-1', { action: 'confirm', paymentKey: 'fixture_key_123', orderId: order.body.orderId, amount: 990 });
  assert.equal(wrongAmount.body.code, 'AMOUNT_MISMATCH');
  assert.equal(db.rows.payments[0].status, 'ready');
  assert.equal(ai.calls.toss, 0);

  const confirmed = await invoke(payment, 'user-1', { action: 'confirm', paymentKey: 'fixture_key_123', orderId: order.body.orderId, amount: 4900 });
  assert.equal(confirmed.body.ok, true);
  assert.equal(confirmed.body.paid, true);
  assert.equal(confirmed.body.status, 'report_ready');
  assert.equal(db.rows.conversations[0].status, 'report_ready');
  assert.equal(ai.calls.toss, 1);

  const duplicateConfirm = await invoke(payment, 'user-1', { action: 'confirm', paymentKey: 'fixture_key_123', orderId: order.body.orderId, amount: 4900 });
  assert.equal(duplicateConfirm.body.status, 'report_ready');
  assert.equal(ai.calls.toss, 1);

  const crossUser = await invoke(journey, 'user-2', { action: 'resume', conversationId });
  assert.equal(crossUser.httpStatus, 403);
  assert.equal(crossUser.body.code, 'FORBIDDEN');

  const existingBuyer = await invoke(payment, 'user-1', { action: 'create', conversationId });
  assert.equal(existingBuyer.body.alreadyPaid, true);
  assert.equal(existingBuyer.body.reportEntitled, true);
  assert.equal(ai.calls.toss, 1);

  ai.failNext();
  const failedReport = await invoke(journey, 'user-1', { action: 'report', conversationId, token: token('reportfail') });
  assert.equal(failedReport.body.ok, false);
  assert.equal(db.rows.payments[0].status, 'paid');
  assert.equal(db.rows.reports.length, 0);
  const generated = await invoke(journey, 'user-1', { action: 'report', conversationId, token: token('report2') });
  assert.equal(generated.body.status, 'report_done');
  // 2026-09-16: '확정' 은 서버가 결정한다. anchor 가 사용자 근거·본문에 모두 있는 항목만 confirmed, 근거 없는 '반복 패턴' 주장은 candidate.
  assert.deepEqual(
    generated.body.report.content.sections.map((section) => section.status),
    ['confirmed', 'confirmed', 'candidate', 'candidate'],
  );
  assert.equal(generated.body.hasReport, true);
  assert.match(generated.body.report.title, /편안함/);
  const reopened = await invoke(journey, 'user-1', { action: 'report', conversationId, token: token('report3') });
  assert.equal(reopened.body.status, 'report_done');
  assert.equal(db.rows.reports.length, 1);

  assert.equal(db.rows.conversations.length, 1);
  assert.equal(db.rows.emotions.length, 1);
  assert.equal(db.rows.conversations[0].status, 'report_done');
  assert.equal(db.rows.payments.length, 1);
  assert.equal(ai.calls.toss, 1);
});

test('paid report entitlement survives refresh without moving the conversation or charging again', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch({ tossApproved: true });
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai, { paymentEnabled: true });
  const conversation = db.seed('conversations', { user_id: 'user-retry', status: 'report_ready', current_step: 8, request_token: null, request_action: null });
  const conversationId = conversation.id;
  const order = await invoke(payment, 'user-retry', { action: 'create', conversationId });
  const confirmed = await invoke(payment, 'user-retry', { action: 'confirm', paymentKey: 'fixture_retry_123', orderId: order.body.orderId, amount: 4900 });
  assert.equal(confirmed.body.paid, true);
  assert.equal(confirmed.body.status, 'report_ready');
  assert.equal(db.rows.payments[0].status, 'paid');

  const recovered = await invoke(payment, 'user-retry', { action: 'status', conversationId });
  assert.equal(recovered.body.status, 'report_ready');
  assert.equal(recovered.body.reportEntitled, true);
  assert.equal(db.rows.payments.length, 1);
  assert.equal(ai.calls.toss, 1);
});

test('uncertain, brief, and skip replies change direction through STEP 7 without repetition', async () => {
  const db = new FakeDatabase();
  const ai = createLowInformationRepeatAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'uncertain-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step4',
    current_step: 4,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘 마음은 편안함' });
  const originalQuestion = '편안함이라고 말해주셨네요.\n\n편안함이 나에게 어떤 의미인지 말해줄 수 있나요?';
  db.seed('messages', {
    conversation_id: conversation.id,
    user_id: userId,
    role: 'ai',
    step: 4,
    content: originalQuestion,
    message_kind: 'journey_question',
  });

  const shown = [originalQuestion.split(/\n\s*\n/).at(-1)];
  const answers = new Map([
    [4, '잘 모르겠다'],
    [5, '편안해'],
    [6, '이번 질문은 넘어갈게요'],
  ]);
  for (const step of [4, 5, 6]) {
    const answered = await invoke(journey, userId, {
      action: 'answer', conversationId: conversation.id, answer: answers.get(step), token: token(`low-effort-answer-${step}`),
    });
    assert.equal(answered.body.status, `step${step + 1}`);
    const asked = await invoke(journey, userId, {
      action: 'ask', conversationId: conversation.id, token: token(`uncertain-ask-${step + 1}`),
    });
    assert.equal(asked.body.status, `step${step + 1}`);
    if (step === 4) {
      assert.match(asked.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
    } else {
      assert.match(asked.body.question, /^괜찮아요\. 더 깊이 묻지 않고 가볍게 이어갈게요\./);
    }
    shown.push(asked.body.question.split(/\n\s*\n/).at(-1));
  }

  const completed = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '잘 모르겠다', token: token('uncertain-answer-7'),
  });
  assert.equal(completed.body.status, 'report_ready');
  assert.equal(new Set(shown).size, 4);
  assert.equal(shown.every((question) => question.length <= 80), true);
  assert.equal(ai.calls.openai, 6, 'each repeated candidate must be blocked before a different question is accepted');
  assert.equal(ai.calls.userPrompts.every((prompt) => !prompt.includes('잘 모르겠다')), true, 'uncertainty must not become factual evidence');
  assert.equal(ai.calls.userPrompts.every((prompt) => !prompt.includes('이번 질문은 넘어갈게요')), true, 'skip must not become factual evidence');
  assert.equal(ai.calls.userPrompts.some((prompt) => prompt.includes('편안해')), true, 'a short meaningful reply must remain evidence');
  assert.equal(ai.calls.systemPrompts.some((prompt) => prompt.includes('이미 한 질문') && prompt.includes('어떤 의미')), true);
  assert.equal(ai.calls.systemPrompts.some((prompt) => prompt.includes('대화 피로 회복')), true);
});

test('production incident: repeated effort theme is abandoned after 모르겠어요 and STEP 7 closes on a new topic', async () => {
  const db = new FakeDatabase();
  const ai = createProductionIncidentRecoveryAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'incident-regression-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step6',
    current_step: 6,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘은 걱정과 기대감이 함께 있어요' });
  const history = [
    ['user', 1, '걱정이 산더미이긴 하지만 나름 잘 살아가려고 노력중이거든요', 'step_answer'],
    ['user', 2, '묵묵히 제가 하고 싶은 일들을 하며 하루를 보낼때', 'step_answer'],
    ['ai', 3, '걱정과 기대감이 함께 느껴진다는 건 복잡한 감정이네요.\n\n기대감은 어디에서 오는 것 같나요?', 'journey_question'],
    ['user', 3, '잘 모르겠어요', 'journey_answer'],
    ['ai', 4, '걱정과 기대감이 함께 느껴진다는 건 복잡한 감정이네요.\n\n잘 살아가려고 노력하는 방법은 어떤 것들이 있나요?', 'journey_question'],
    ['user', 4, '하루하루를 열심히 살아내는거죠', 'journey_answer'],
    ['ai', 5, '걱정과 기대감이 함께 느껴진다는 건 복잡한 감정이네요.\n\n잘 살아가려는 노력 중 어떤 부분이 가장 중요하다고 느끼시나요?', 'journey_question'],
    ['user', 5, '모르겠어요', 'journey_answer'],
  ];
  for (const [role, step, content, messageKind] of history) {
    db.seed('messages', {
      conversation_id: conversation.id,
      user_id: userId,
      role,
      step,
      content,
      message_kind: messageKind,
    });
  }

  const step6 = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('incident-ask-6'),
  });
  assert.equal(step6.body.status, 'step6');
  assert.match(step6.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
  assert.match(step6.body.question, /하고 싶은 일/);
  assert.doesNotMatch(step6.body.question, /잘 살아가/);

  const answer6 = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '모르겠어요', token: token('incident-answer-6'),
  });
  assert.equal(answer6.body.status, 'step7');

  const step7 = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('incident-ask-7'),
  });
  assert.equal(step7.body.status, 'step7');
  assert.match(step7.body.question, /^괜찮아요\. 더 깊이 묻지 않고 가볍게 이어갈게요\./);
  assert.match(step7.body.question, /오늘 대화 끝/);
  assert.doesNotMatch(step7.body.question, /잘 살아가|하고 싶은 일/);
  assert.equal(ai.calls.openai, 4, 'same-theme candidates must be rejected before a fresh topic is shown');
  assert.equal(ai.calls.userPrompts.every((prompt) => !prompt.includes('모르겠어요')), true, '모르겠어요 must not become user evidence');
});

test('Plan B discards a wrong frame and continues from the user correction in the same step', async () => {
  const db = new FakeDatabase();
  const ai = createPlanBRepairAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'plan-b-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step4',
    current_step: 4,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘은 날씨가 좋아서 편안해' });
  db.seed('messages', {
    conversation_id: conversation.id,
    user_id: userId,
    role: 'ai',
    step: 4,
    content: '날씨가 좋아서 편안한 마음이 중요한 이유는 무엇인가요?',
    message_kind: 'journey_question',
  });

  const corrected = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '그게 아니고 일이 끝나서 편안한 거야', token: token('plan-b-correction'),
  });
  assert.equal(corrected.body.status, 'step4');
  assert.equal(corrected.body.needsQuestion, true);

  const repaired = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('plan-b-ask'),
  });
  assert.equal(repaired.body.status, 'step4');
  assert.match(repaired.body.question, /^알겠어요\. 방금 바로잡아 준 내용에서 다시 이어갈게요\./);
  assert.match(repaired.body.question, /일이 끝난 뒤/);
  assert.equal(ai.calls.userPrompts[0].includes('일이 끝나서 편안한 거야'), true);
  assert.equal(ai.calls.userPrompts[0].includes('그게 아니고 일이 끝나서 편안한 거야'), true, 'raw feedback is passed only in the non-factual feedback block');
  assert.equal(ai.calls.systemPrompts[0].includes('따옴표 안의 말'), true);
});

test('current human-conversation engine preserves the normal answer path', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const userId = 'normal-answer-user';
  const conversation = db.seed('conversations', {
    user_id: userId,
    status: 'step4',
    current_step: 4,
    request_token: null,
    request_action: null,
  });
  db.seed('emotions', { conversation_id: conversation.id, user_id: userId, mind_text: '오늘 마음은 편안함' });
  db.seed('messages', {
    conversation_id: conversation.id,
    user_id: userId,
    role: 'ai',
    step: 4,
    content: '편안함이 나에게 어떤 의미인지 말해줄 수 있나요?',
    message_kind: 'journey_question',
  });

  const answered = await invoke(journey, userId, {
    action: 'answer', conversationId: conversation.id, answer: '오늘 산책할 때 편안했어', token: token('normal-answer-4'),
  });
  assert.equal(answered.body.status, 'step5');

  const asked = await invoke(journey, userId, {
    action: 'ask', conversationId: conversation.id, token: token('normal-ask-5'),
  });
  assert.equal(asked.body.status, 'step5');
  assert.match(asked.body.question, /^편안하다고 말해주셨네요\./);
  assert.doesNotMatch(asked.body.question, /^괜찮아요\. 바로 떠오르지 않아도 돼요\./);
});

test('legacy progress and completed buyers are preserved', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const payment = await loadEdgeHandler('supabase/functions/echo-payment/index.ts', db, ai);

  const legacy = db.seed('conversations', { user_id: 'legacy-user', status: 'step6', current_step: 6, request_token: null, request_action: null });
  db.seed('emotions', { conversation_id: legacy.id, user_id: 'legacy-user', mind_text: '기존 기록' });
  db.seed('messages', { conversation_id: legacy.id, user_id: 'legacy-user', role: 'ai', step: 6, content: '기존 질문에서 더 들려주고 싶은 부분은 무엇인가요?', message_kind: 'journey_question' });
  const resumed = await invoke(journey, 'legacy-user', { action: 'resume', conversationId: legacy.id });
  assert.equal(resumed.body.status, 'step6');
  assert.match(resumed.body.question, /무엇인가요\?$/);

  const completed = db.seed('conversations', { user_id: 'buyer', status: 'report_done', current_step: 8, request_token: null, request_action: null });
  db.seed('payments', { user_id: 'buyer', conversation_id: completed.id, order_id: 'echo-222222222222222222222222', amount: 4900, status: 'paid', payment_key: 'saved-key', approved_at: '2026-09-01T00:00:00.000Z' });
  db.seed('reports', { user_id: 'buyer', conversation_id: completed.id, title: '보존된 리포트', summary: '보존됨', content: { title: '보존된 리포트', summary: '보존됨', sections: [], next_step: '다음' } });
  const status = await invoke(payment, 'buyer', { action: 'status', conversationId: completed.id });
  assert.equal(status.body.paid, true);
  assert.equal(status.body.status, 'report_done');
  const report = await invoke(journey, 'buyer', { action: 'resume', conversationId: completed.id });
  assert.equal(report.body.hasReport, true);
  assert.equal(report.body.report.title, '보존된 리포트');
});

test('understanding rejection is saved first and a different follow-up reaches free STEP 3', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'correction-user', { action: 'start', mindText: '오늘은 마음이 편안해', token: token('corr-start') });
  const conversationId = started.body.conversationId;
  await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-ask1') });
  await invoke(early, 'correction-user', { action: 'answer', conversationId, answer: '편안한 이유를 아직 모르겠어', token: token('corr-ans1') });
  await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-ask2') });
  await invoke(early, 'correction-user', { action: 'answer', conversationId, answer: '그냥 일이 끝나서 그런 것 같아', token: token('corr-ans2') });
  await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-under1') });

  const rejected = await invoke(early, 'correction-user', {
    action: 'choose', conversationId, choice: 'no', text: '날씨 때문이 아니라 일이 끝나서 편안한 거야', token: token('corr-no'),
  });
  assert.equal(rejected.body.status, 'followup');
  assert.equal(db.rows.understanding_results[0].choice, 'no');
  assert.equal(db.rows.understanding_results[0].correction_text, '날씨 때문이 아니라 일이 끝나서 편안한 거야');

  const followup = await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-follow') });
  assert.equal(followup.body.status, 'followup');
  assert.match(followup.body.question, /\?$/);
  await invoke(early, 'correction-user', { action: 'answer', conversationId, answer: '할 일을 마치고 내 속도로 쉴 수 있어서야', token: token('corr-answer') });
  const revised = await invoke(early, 'correction-user', { action: 'ask', conversationId, token: token('corr-under2') });
  assert.equal(revised.body.status, 'understanding');
  assert.match(revised.body.understanding, /스스로 정한 속도/);
  const agreed = await invoke(early, 'correction-user', { action: 'choose', conversationId, choice: 'agree', text: '', token: token('corr-agree') });
  assert.equal(agreed.body.status, 'step3');
  assert.equal(db.rows.understanding_results.length, 2);
});

test('unpaid completed conversation cannot read, generate, or list report content', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const journey = await loadEdgeHandler('supabase/functions/echo-journey/index.ts', db, ai);
  const completed = db.seed('conversations', { user_id: 'unpaid-user', status: 'report_ready', current_step: 8, request_token: null, request_action: null });
  db.seed('reports', { user_id: 'unpaid-user', conversation_id: completed.id, title: '노출되면 안 됨', summary: '비공개', content: { title: '비공개', summary: '비공개', sections: [], next_step: '비공개' } });

  const resumed = await invoke(journey, 'unpaid-user', { action: 'resume', conversationId: completed.id });
  assert.equal(resumed.body.reportEntitled, false);
  assert.equal('report' in resumed.body, false);
  const generated = await invoke(journey, 'unpaid-user', { action: 'report', conversationId: completed.id, token: token('unpaid-report') });
  assert.equal(generated.httpStatus, 403);
  assert.equal(generated.body.code, 'PAYMENT_REQUIRED');
  assert.equal('report' in generated.body, false);
  const listed = await invoke(journey, 'unpaid-user', { action: 'list' });
  assert.deepEqual(listed.body.items, []);

  const otherUser = await invoke(journey, 'other-user', { action: 'resume', conversationId: completed.id });
  assert.equal(otherUser.httpStatus, 403);
  assert.equal(otherUser.body.code, 'FORBIDDEN');
});

test('AI failure after a saved answer preserves the new step and allows a question retry', async () => {
  const db = new FakeDatabase();
  const ai = createAiFetch();
  const early = await loadEdgeHandler('supabase/functions/get-step-question/index.ts', db, ai);

  const started = await invoke(early, 'user-1', { action: 'start', mindText: '오늘은 마음이 편안해', token: token('retry-start') });
  const conversationId = started.body.conversationId;
  await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('retry-ask1') });
  const saved = await invoke(early, 'user-1', { action: 'answer', conversationId, answer: '답변은 먼저 안전하게 저장해', token: token('retry-answer1') });
  assert.equal(saved.body.status, 'step2');
  assert.equal(db.rows.messages.filter((message) => message.content === '답변은 먼저 안전하게 저장해').length, 1);

  ai.failNext();
  const failedQuestion = await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('retry-ask2') });
  assert.equal(failedQuestion.body.ok, false);
  assert.equal(failedQuestion.body.code, 'AI_ERROR');
  assert.equal(db.rows.conversations[0].status, 'step2');
  assert.equal(db.rows.messages.filter((message) => message.content === '답변은 먼저 안전하게 저장해').length, 1);

  const retry = await invoke(early, 'user-1', { action: 'ask', conversationId, token: token('retry-ask3') });
  assert.equal(retry.body.status, 'step2');
  assert.equal(retry.body.needsQuestion, false);
  assert.match(retry.body.question, /\?$/);
});
