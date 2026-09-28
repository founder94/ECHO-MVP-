import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const agent = readFileSync(new URL('../supabase/functions/doit-agent/agent.ts', import.meta.url), 'utf8');
const server = readFileSync(new URL('../supabase/functions/doit-agent/index.ts', import.meta.url), 'utf8');
const fi = readFileSync(new URL('../supabase/functions/doit-agent/failure-intelligence.ts', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../../.github/workflows/echo-netlify-deploy.yml', import.meta.url), 'utf8');

const P0 = [
  'direction_lock',
  'correction_supersede',
  'information_status',
  'rejected_semantic_block',
  'release_evidence_gate',
  'prod_qa_guard',
];
const P1 = [
  'action_router_one_next',
  'failed_solution_block',
  'public_boundary',
  'human_cost_capture',
];

test('Failure Intelligence contract has valid TypeScript syntax', () => {
  const out = ts.transpileModule(fi, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const errors = (out.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
});

test('Failure Intelligence 10-rule contract is versioned and present', () => {
  assert.match(fi, /FAILURE_INTELLIGENCE_VERSION\s*=\s*"fi-2026-09-28-v1"/);
  for (const key of [...P0, ...P1]) assert.match(fi, new RegExp('\\b' + key + '\\b'));
});

test('server turn observability carries Failure Intelligence version', () => {
  assert.match(server, /failure_intelligence_version:\s*FAILURE_INTELLIGENCE_VERSION/);
  assert.match(server, /from "\.\/failure-intelligence\.ts"/);
});

test('correction and rejected-meaning protections remain in agent code', () => {
  // Functional behavior is covered by the existing agent-server suite.
  // This contract test prevents accidental removal of the state primitives it depends on.
  assert.match(agent, /SUPERSEDED/);
  assert.match(agent, /rejectedForAi/);
  assert.match(agent, /pickStale/);
  assert.match(agent, /confirmedSignature/);
  assert.match(agent, /matchingProfile/);
});

test('release workflow keeps PROD and QA separated', () => {
  assert.match(workflow, /QA_SUPABASE_URL/);
  assert.match(workflow, /PROD_SUPABASE_URL/);
  assert.match(workflow, /운영 빌드에 QA 주소/);
  assert.match(workflow, /QA 빌드에 운영 Supabase/);
  assert.match(workflow, /github\.event\.inputs\.go == 'GO'/);
});

test('Failure Intelligence is internal quality state, never a user fact', () => {
  assert.match(fi, /never user\/profile\/matching facts/i);
});
