import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authReadExitCode, oauthRedirectProblems, ENVIRONMENTS } from '../scripts/oauth-redirect-guard.mjs';

test('QA OAuth permission HOLD applies only to missing/read-forbidden credentials', () => {
  assert.equal(authReadExitCode(401), 3);
  assert.equal(authReadExitCode(403), 3);
  for (const status of [400, 404, 429, 500, 503]) assert.equal(authReadExitCode(status), 1);
});

test('stale or mismatched OAuth redirect remains a failure', () => {
  const qa = ENVIRONMENTS.qa;
  assert.ok(oauthRedirectProblems({ siteUrl: 'https://thriving-melba-b1449a.netlify.app', allowList: [`${qa.app}/auth/callback`] }, qa).length);
  assert.deepEqual(oauthRedirectProblems({ siteUrl: qa.app, allowList: [`${qa.app}/auth/callback`, `${qa.admin}/auth/callback`] }, qa), []);
});

test('QA workflow only turns permission exit 3 into a non-blocking HOLD', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/echo-netlify-deploy.yml', import.meta.url), 'utf8');
  const guard = workflow.slice(workflow.indexOf('  oauth_guard_qa:'), workflow.indexOf('  deploy_prod:'));
  assert.match(guard, /if \[ "\$code" -eq 3 \]; then[\s\S]*?exit 0/);
  assert.match(guard, /if \[ "\$code" -ne 0 \]; then[\s\S]*?exit "\$code"/);
});
