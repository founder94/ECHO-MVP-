import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const root = resolve(process.env.ECHO_PROJECT_ROOT || process.cwd());
const read = (path) => readFile(resolve(root, path), 'utf8');

function functionDeclaration(source, name) {
  const start = source.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(start >= 0, `missing function: ${name}`);

  const parametersStart = source.indexOf('(', start);
  let parametersDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === '(') parametersDepth += 1;
    if (source[index] === ')') parametersDepth -= 1;
    if (parametersDepth === 0) {
      parametersEnd = index;
      break;
    }
  }

  // A TypeScript return type can contain object shapes. Only a brace outside its
  // generic angle brackets starts the implementation body.
  let genericDepth = 0;
  let bodyStart = -1;
  for (let index = parametersEnd + 1; index < source.length; index += 1) {
    if (source[index] === '<') genericDepth += 1;
    if (source[index] === '>') genericDepth -= 1;
    if (source[index] === '{' && genericDepth === 0) {
      bodyStart = index;
      break;
    }
  }
  assert.ok(bodyStart >= 0, `missing function body: ${name}`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated function body: ${name}`);
}

function compileDeclarations(source, names, extra = '') {
  const declarations = names.map((name) => functionDeclaration(source, name)).join('\n');
  const output = ts.transpileModule(`${extra}\n${declarations}`, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  // The selected helpers are pure and have no Deno/Supabase dependency.
  return Function(`${output}\nreturn { ${names.join(', ')} };`)();
}

function selectedColumns(source) {
  return [...source.matchAll(/\.select\(\s*(["'])([^"']*)\1/g)]
    .flatMap((match) => match[2].split(',').map((column) => column.trim()));
}

async function readTree(relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = await Promise.all(entries.map(async (entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = absolute.slice(root.length + 1);
      return readTree(nested);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) ? readFile(absolute, 'utf8') : '';
  }));
  return sources.flat(Infinity).join('\n');
}

function visibleText(markup) {
  return markup.replace(/<[^>]*>/g, '').replaceAll('&nbsp;', ' ').trim();
}

test('admin snapshot rejects untrusted origins and requires a verified current admin', async () => {
  const server = await read('supabase/functions/admin-dashboard/index.ts');
  const allowlist = server.match(/const ALLOWED_ORIGINS = new Set\(\[[\s\S]*?\]\);/)?.[0];
  assert.ok(allowlist, 'missing explicit origin allowlist');

  const { isAllowedOrigin, cors } = compileDeclarations(
    server,
    ['isAllowedOrigin', 'cors'],
    allowlist,
  );

  assert.equal(isAllowedOrigin('https://do-it.company'), true);
  assert.equal(isAllowedOrigin('https://www.do-it.company'), true);
  assert.equal(isAllowedOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:4173'), true);
  assert.equal(isAllowedOrigin('http://[::1]:5173'), true);
  assert.equal(isAllowedOrigin('https://localhost:5173'), false);
  assert.equal(isAllowedOrigin('https://do-it.company.evil.example'), false);
  assert.equal(isAllowedOrigin('https://evil.example'), false);

  const allowedHeaders = cors(new Request('https://edge.example', {
    headers: { Origin: 'https://do-it.company' },
  }));
  const deniedHeaders = cors(new Request('https://edge.example', {
    headers: { Origin: 'https://evil.example' },
  }));
  assert.equal(allowedHeaders['Access-Control-Allow-Origin'], 'https://do-it.company');
  assert.equal(allowedHeaders.Vary, 'Origin');
  assert.equal('Access-Control-Allow-Origin' in deniedHeaders, false);
  assert.doesNotMatch(server, /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']/);

  const originGuard = server.indexOf('if (origin && !isAllowedOrigin(origin))');
  const preflight = server.indexOf('if (req.method === "OPTIONS")');
  assert.ok(originGuard >= 0 && preflight > originGuard, 'origin must be rejected before preflight');
  assert.match(server, /FORBIDDEN_ORIGIN[\s\S]*?,\s*403\)/);
  assert.match(server, /req\.method !== "POST"[\s\S]*METHOD_NOT_ALLOWED[\s\S]*405/);

  const auth = functionDeclaration(server, 'requireAdmin');
  assert.match(auth, /authHeader\.startsWith\("Bearer "\)/);
  assert.match(auth, /createClient\(supabaseUrl, anonKey,[\s\S]*Authorization: authHeader/);
  assert.match(auth, /auth\.getUser\(\)/);
  assert.match(auth, /createClient\(supabaseUrl, serviceKey/);
  assert.match(auth, /\.from\("profiles"\)[\s\S]*\.select\("role"\)[\s\S]*\.eq\("id", user\.id\)/);
  assert.match(auth, /\.maybeSingle\(\)/);
  assert.match(auth, /profile\.role !== "admin"[\s\S]*FORBIDDEN[\s\S]*403/);
  assert.doesNotMatch(auth, /user_metadata|app_metadata[^\n]*role|body\.|request[^\n]*role/i);
  assert.ok(
    auth.indexOf('auth.getUser()') < auth.indexOf('createClient(supabaseUrl, serviceKey'),
    'service-role reads must happen only after JWT verification',
  );

  const authCall = server.indexOf('const auth = await requireAdmin(req)');
  const bodyRead = server.indexOf('await req.json()', authCall);
  const dataLoad = server.indexOf('loadUsers(auth.admin, period)', authCall);
  assert.ok(authCall >= 0 && bodyRead > authCall && dataLoad > bodyRead, 'auth must precede parsing and data reads');
});

test('admin snapshot selects only aggregate metadata and masks identifiers before returning them', async () => {
  const server = await read('supabase/functions/admin-dashboard/index.ts');
  const projections = selectedColumns(server);
  const selectCalls = [...server.matchAll(/\.select\s*\(/g)].length;
  const literalSelectCalls = [...server.matchAll(/\.select\(\s*(["'])([^"']*)\1/g)].length;
  const forbiddenColumns = [
    '*',
    'ai_text',
    'content',
    'body',
    'detail',
    'details',
    'fail_code',
    'metadata',
    'mind_text',
    'original_text',
    'payment_key',
    'payload_hash',
    'report_text',
    'receipt_url',
    'raw_payload',
    'provider_payload',
    'reason',
    'report_content',
    'source_text',
    'summary',
    'text',
    'title',
  ];

  assert.ok(projections.length >= 10, 'expected explicit projections for admin queries');
  assert.equal(selectCalls, literalSelectCalls, 'every admin select must use an auditable literal projection');
  for (const column of forbiddenColumns) {
    assert.equal(projections.includes(column), false, `admin query must not select ${column}`);
  }

  const users = functionDeclaration(server, 'loadUsers');
  assert.match(users, /id:\s*maskIdentifier\(row\.id\)/);
  assert.match(users, /emailMasked:\s*maskEmail\(row\.email\)/);
  assert.match(users, /nickname:\s*maskNickname\(row\.nickname \?\? row\.display_name\)/);

  const payments = functionDeclaration(server, 'loadPayments');
  assert.match(payments, /orderIdMasked:\s*maskOrderId\(row\.order_id\)/);
  assert.doesNotMatch(payments, /payment_key|receipt_url|secret/i);

  const client = await read('src/pages/admin/hooks/useAdminData.ts');
  assert.doesNotMatch(client, /raw\.email(?!Masked|_masked)/);
  assert.doesNotMatch(client, /raw\.(?:paymentKey|payment_key|receipt|content|body)/);
  const paymentRow = client.match(/export interface AdminPaymentRow\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(paymentRow, /orderIdMasked:\s*string \| null/);
  assert.doesNotMatch(paymentRow, /^\s*(?:paymentKey|receiptUrl|orderId)\??\s*:/m);
  assert.doesNotMatch(server, /\.(?:insert|update|upsert|delete)\s*\(/);
});

test('period windows use inclusive KST calendar starts and a captured exclusive end', async () => {
  const server = await read('supabase/functions/admin-dashboard/index.ts');
  const offset = server.match(/const KST_OFFSET_MS\s*=\s*[^;]+;/)?.[0];
  assert.ok(offset, 'missing KST offset declaration');
  const { periodWindow } = compileDeclarations(
    server,
    ['kstDayStart', 'periodWindow'],
    offset,
  );

  const beforeKstMidnight = new Date('2026-09-16T14:59:59.999Z');
  assert.deepEqual(periodWindow('today', beforeKstMidnight), {
    key: 'today',
    startAt: '2026-09-15T15:00:00.000Z',
    endAt: '2026-09-16T14:59:59.999Z',
    timezone: 'Asia/Seoul',
  });

  const atKstMidnight = new Date('2026-09-16T15:00:00.000Z');
  assert.equal(periodWindow('today', atKstMidnight).startAt, '2026-09-16T15:00:00.000Z');
  assert.equal(periodWindow('7d', atKstMidnight).startAt, '2026-09-10T15:00:00.000Z');
  assert.equal(periodWindow('30d', atKstMidnight).startAt, '2026-08-18T15:00:00.000Z');
  assert.equal(periodWindow('30d', atKstMidnight).endAt, atKstMidnight.toISOString());

  assert.match(server, /const asOf = period\.endAt/);
  assert.match(server, /\.gte\("created_at", period\.startAt\)\.lt\("created_at", period\.endAt\)/);
  assert.match(server, /\.gte\("approved_at", period\.startAt\)\.lt\("approved_at", period\.endAt\)/);
  assert.doesNotMatch(server, /\.lte\("(?:created_at|approved_at)", period\.endAt\)/);

  const periodStarts = [...server.matchAll(/\.gte\("([^"]+)", period\.startAt\)/g)]
    .map((match) => match[1]);
  const boundedPeriods = [...server.matchAll(
    /\.gte\("([^"]+)", period\.startAt\)\s*\.lt\("\1", period\.endAt\)/g,
  )].map((match) => match[1]);
  assert.deepEqual(boundedPeriods, periodStarts, 'every period lower bound needs the same-column exclusive end');
});

test('ECHO funnel and payment totals come from verified database results', async () => {
  const server = await read('supabase/functions/admin-dashboard/index.ts');
  const echo = functionDeclaration(server, 'loadEcho');
  const payments = functionDeclaration(server, 'loadPayments');

  assert.match(echo, /Array\.from\(\{ length: 7 \}/);
  assert.match(echo, /\.eq\("current_step", step\)/);
  assert.match(echo, /\.eq\("role", "user"\)/);
  assert.match(echo, /\.eq\("step", 7\)/);
  assert.match(echo, /\.in\("message_kind", STEP_ANSWER_KINDS\)/);
  assert.match(echo, /\.in\("status", COMPLETED_STATUSES\)/);
  assert.match(server, /const COMPLETED_STATUSES = \["report_ready", "report_done"\]/);
  assert.doesNotMatch(echo, /white_door_ready/);
  assert.match(echo, /whiteDoorReached:\s*step7Completed/);

  assert.match(payments, /\.eq\("status", "paid"\)\.eq\("amount", 4_900\)/);
  assert.match(payments, /periodPaid:\s*periodResult\.count/);
  assert.match(payments, /lifetimePaid:\s*lifetimeResult\.count/);
  assert.match(payments, /status:\s*periodResult\.count === 0 \? "empty" : "success"/);
  assert.match(payments, /status:\s*"error"[\s\S]*periodPaid:\s*null[\s\S]*lifetimePaid:\s*null/);
});

test('admin UI consumes snapshot values instead of static checklist, funnel, or payment placeholders', async () => {
  const [adminClient, hook, dashboard, paymentsView] = await Promise.all([
    readTree('src/pages/admin'),
    read('src/pages/admin/hooks/useAdminData.ts'),
    read('src/pages/admin/views/Dashboard.tsx'),
    read('src/pages/admin/views/Payments.tsx'),
  ]);

  assert.doesNotMatch(
    adminClient,
    /\b(?:const|let|var)\s+(?:CHECKLIST|FEATURE_STATUS|ECHO_STEPS|DOIT_STEPS)\b/,
  );
  assert.doesNotMatch(dashboard, /\bFEATURE_STATUS\b/);
  assert.match(hook, /supabase\.functions\.invoke\('admin-dashboard'/);
  assert.match(hook, /const snapshot = parseSnapshot\(response, period\)/);
  assert.match(hook, /payments:\s*parsePayments\(value\.payments\)/);

  assert.match(dashboard, /value=\{data\.users\.periodNew\}/);
  assert.match(dashboard, /value=\{data\.echo\.started\}/);
  assert.match(dashboard, /value=\{data\.echo\.step7Completed\}/);
  assert.match(dashboard, /value=\{data\.echo\.whiteDoorReached\}/);
  assert.match(dashboard, /value=\{data\.payments\.periodPaid\}/);
  assert.match(dashboard, /data\.echo\.currentByStep\.map\(\(item\) =>/);
  assert.match(dashboard, /value=\{item\.count\}/);

  assert.match(paymentsView, /value=\{payments\.periodPaid\}/);
  assert.match(paymentsView, /value=\{payments\.lifetimePaid\}/);
  assert.match(paymentsView, /payments\.recent\.map\(\(payment, index\) =>/);
  assert.doesNotMatch(paymentsView, /status=["']missing["']/);
});

test('successful zero values and unavailable payment data keep distinct truthful states', async () => {
  const hook = await read('src/pages/admin/hooks/useAdminData.ts');
  const { parsePayments, parseSnapshot } = compileDeclarations(hook, [
    'isRecord',
    'nullableString',
    'nullableCount',
    'nullableAmount',
    'sectionStatus',
    'sumKnown',
    'parseCurrentByStep',
    'parseUsers',
    'parseOperationRows',
    'parsePayments',
    'parseFeatureStatus',
    'parseSnapshot',
  ]);

  assert.deepEqual(parsePayments(undefined), {
    status: 'unavailable',
    periodPaid: null,
    lifetimePaid: null,
    recent: [],
    paymentMode: 'unavailable',
    purchaseAvailable: null,
  });

  const snapshot = parseSnapshot({
    ok: true,
    asOf: '2026-09-16T06:00:00.000Z',
    period: {
      key: 'today',
      startAt: '2026-09-15T15:00:00.000Z',
      endAt: '2026-09-16T06:00:00.000Z',
      timezone: 'Asia/Seoul',
    },
    users: {
      status: 'success',
      total: 3,
      periodNew: 0,
      recent: [{ id: 'masked', emailMasked: 'a***@example.com', nickname: '홍*', createdAt: null }],
    },
    echo: {
      status: 'success',
      started: 0,
      step7Completed: 0,
      whiteDoorReached: 0,
      currentByStep: Array.from({ length: 7 }, (_, index) => ({ step: index + 1, count: 0 })),
    },
    payments: {
      status: 'empty',
      periodPaid: 0,
      lifetimePaid: 0,
      recent: [],
      paymentMode: 'review_pending',
      purchaseAvailable: false,
    },
    doIt: {
      status: 'empty',
      records: 0,
      insights: 0,
      handoffs: 0,
      requestErrors: 0,
      purposes: 0,
      spaces: 0,
      routeTelemetry: 'not_collected',
    },
    operations: {
      status: 'empty',
      reportsOpen: 0,
      blocks: 0,
      auditRecords: 0,
      auditRecent: [],
      reportRecent: [],
      diagnosticsStatus: 'unavailable',
    },
    features: [{ id: 'database', label: '운영 데이터베이스', status: 'ok', detail: '확인됨' }],
  }, 'today');

  assert.ok(snapshot);
  assert.equal(snapshot.users.status, 'success');
  assert.equal(snapshot.users.total, 3);
  assert.equal(snapshot.users.periodNew, 0);
  assert.equal(snapshot.echo.status, 'empty');
  assert.deepEqual(snapshot.echo.currentByStep.map((item) => item.count), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(snapshot.payments.status, 'empty');
  assert.equal(snapshot.payments.periodPaid, 0);
  assert.equal(snapshot.payments.lifetimePaid, 0);
  assert.equal(snapshot.payments.paymentMode, 'review_pending');
  assert.equal(snapshot.payments.purchaseAvailable, false);
  assert.equal(snapshot.doIt.status, 'empty');
  assert.equal(snapshot.operations.status, 'empty');
  assert.equal(snapshot.features.status, 'success');
  assert.equal(
    [snapshot.users, snapshot.echo, snapshot.payments, snapshot.doIt, snapshot.operations, snapshot.features]
      .some((section) => section.status === 'missing'),
    false,
  );
});

test('recent users remain truthful when the selected period has no new signups', async () => {
  const [server, usersView] = await Promise.all([
    read('supabase/functions/admin-dashboard/index.ts'),
    read('src/pages/admin/views/Users.tsx'),
  ]);
  const users = functionDeclaration(server, 'loadUsers');

  assert.match(users, /const nonAdmin = "role\.is\.null,role\.neq\.admin"/);
  assert.equal([...users.matchAll(/\.or\(nonAdmin\)/g)].length, 3);
  assert.equal(
    [...users.matchAll(/\.gte\("created_at", period\.startAt\)/g)].length,
    1,
    'only the period-new count, not the recent-user list, may use the selected period',
  );
  const recentQuery = users.match(
    /select\("id, email, nickname, display_name, created_at"\)[\s\S]*?\.limit\(RECENT_LIMIT\)/,
  )?.[0];
  assert.ok(recentQuery, 'missing all-time recent-user query');
  assert.match(recentQuery, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.doesNotMatch(recentQuery, /period\.(?:startAt|endAt)/);
  assert.match(users, /status:\s*"error",\s*total:\s*null,\s*periodNew:\s*null,\s*recent:\s*\[\]/);

  assert.match(usersView, /선택 기간과 관계없이 최근 가입 순서입니다/);
  assert.match(usersView, /전체 \{users\.total\?\.toLocaleString\('ko-KR'\) \?\? '—'\}명/);
  assert.match(usersView, /\{periodLabel\} 신규/);
  assert.match(usersView, /unavailableList\s*=\s*users\.recent\.length === 0 && users\.total !== null && users\.total > 0/);
  assert.match(usersView, /users\.total === 0[\s\S]*status="empty"/);
  assert.match(usersView, /users\.recent\.map\(\(user\) =>/);
  const unavailableBranch = usersView.indexOf(') : unavailableList ? (');
  const zeroBranch = usersView.indexOf(') : users.total === 0 ? (');
  const emptyListBranch = usersView.indexOf(') : users.recent.length === 0 ? (');
  assert.ok(
    unavailableBranch >= 0 && zeroBranch > unavailableBranch && emptyListBranch > zeroBranch,
    'unknown recent-list data must be distinguished before actual zero and generic empty-list states',
  );
});

test('StatCard renders unknown non-success values as states, never as zero', async () => {
  const source = await read('src/pages/admin/components/ui.tsx');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  Function('exports', 'require', 'module', '__filename', '__dirname', output)(
    module.exports,
    require,
    module,
    resolve(root, 'src/pages/admin/components/ui.tsx'),
    dirname(resolve(root, 'src/pages/admin/components/ui.tsx')),
  );
  const { StatCard } = module.exports;

  const cases = [
    ['loading', '불러오는 중'],
    ['blocked', '권한 없음'],
    ['missing', '서버 자료 없음'],
    ['unavailable', '확인할 수 없음'],
    ['error', '불러오기 실패'],
    ['needs_check', '운영 점검 대상'],
    ['empty', '확인할 수 없음'],
    ['success', '확인할 수 없음'],
  ];
  for (const [status, expected] of cases) {
    const text = visibleText(renderToStaticMarkup(React.createElement(StatCard, {
      label: '측정값',
      status,
      value: null,
    })));
    assert.match(text, new RegExp(expected));
    assert.doesNotMatch(text, /(?:^|\s)0(?:건|명|개)?(?:$|\s)/, `${status} null rendered as zero`);
  }

  const realZero = visibleText(renderToStaticMarkup(React.createElement(StatCard, {
    label: '측정값',
    status: 'empty',
    value: 0,
  })));
  assert.match(realZero, /0건/);
});
