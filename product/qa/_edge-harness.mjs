// 공용 Edge 검사 장치 — 가짜 DB·Edge 핸들러 적재·호출 도우미.
// full-flow-edge-simulation 과 stress-messy-inputs 가 같은 장치를 쓰도록 분리했다(2026-09-17).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export const root = resolve(process.env.ECHO_PROJECT_ROOT || process.cwd());

const clone = (value) => structuredClone(value);

export class FakeQuery {
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

export class FakeDatabase {
  constructor() {
    this.rows = {
      conversations: [],
      emotions: [],
      messages: [],
      understanding_results: [],
      payments: [],
      reports: [],
      doit_insights: [],
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

// fixturePriceKrw: 검사 전용 가격 주입. 실제 가격이 아니다(현재 가격 미확정). 결제 서버의 금액 검증·멱등 계약만 확인할 때 쓴다.
export async function loadEdgeHandler(relativePath, db, aiFetch, { paymentEnabled = false, fixturePriceKrw = null } = {}) {
  const absolutePath = resolve(root, relativePath);
  let source = await readFile(absolutePath, 'utf8');
  source = source.replace(
    /import \{ createClient, type SupabaseClient \} from "npm:@supabase\/supabase-js@2\.57\.4";/,
    'const createClient = globalThis.__echoCreateClient;',
  );
  if (relativePath.includes('echo-payment') && paymentEnabled) {
    source = source.replace('const PAYMENT_MODE = "review_pending" as "review_pending" | "enabled";', 'const PAYMENT_MODE = "enabled" as "review_pending" | "enabled";');
  }
  if (relativePath.includes('echo-payment') && fixturePriceKrw !== null) {
    const unset = 'const PRICE_KRW: number | null = null as number | null;';
    if (!source.includes(unset)) throw new Error('echo-payment 가격 상수 형태가 바뀌어 검사용 가격을 넣지 못했어요.');
    source = source.replace(unset, `const PRICE_KRW: number | null = ${Number(fixturePriceKrw)} as number | null;`);
  }
  // 같은 폴더의 형제 모듈(./question-quality.ts, ./rules.ts, ./ai.ts)은 파일 URL 로 바꿔 실제로 불러온다.
  source = source.replace(/from "\.\/([\w.-]+\.ts)";/g, (_m, name) =>
    `from ${JSON.stringify(pathToFileURL(resolve(absolutePath, '..', name)).href)};`);
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

export async function invoke(handler, userId, body) {
  const response = await handler(new Request('https://fake.supabase.local/functions/v1/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userId}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { httpStatus: response.status, body: await response.json() };
}

export function token(label) {
  return `token-${label.padEnd(8, 'x')}`;
}

export async function completeFreeStage(early, userId = 'user-1') {
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
