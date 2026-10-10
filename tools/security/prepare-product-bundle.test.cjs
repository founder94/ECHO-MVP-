'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { prepareProductBundle } = require('./prepare-product-bundle.cjs');
const guardPath = path.join(__dirname, 'patch-braces.cjs');
const implementation = path.join(__dirname, 'prepare-product-bundle.cjs');
const commitLabel = 'a'.repeat(40); // Synthetic label; never a claim about actual Git history.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-private-bundle-test-'));
  fs.chmodSync(root, 0o700);
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); // Only this synthetic test directory.
  const repo = path.join(root, 'repo');
  fs.mkdirSync(path.join(repo, 'product/src'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(repo, 'tools/security'), { recursive: true, mode: 0o700 });
  const scripts = Object.fromEntries(['postinstall', 'prebuild', 'prebuild:app', 'prebuild:brand'].map(name => [name, 'node ../tools/security/patch-braces.cjs .']));
  fs.writeFileSync(path.join(repo, 'product/package.json'), JSON.stringify({ name: 'synthetic-bundle-test', scripts }), { mode: 0o600 });
  fs.writeFileSync(path.join(repo, 'product/src/auth.ts'), 'export const ordinaryAuthCode = 1;\n', { mode: 0o600 });
  fs.copyFileSync(guardPath, path.join(repo, 'tools/security/patch-braces.cjs'));
  return { root, repo, output: path.join(root, 'wrapper') };
}
const bundle = f => prepareProductBundle({ sourceRoot: f.repo, outputRoot: f.output, sourceCommit: commitLabel });
test('preserve exact bytes and describe the commit label as unverified', t => {
  const f = fixture(t), manifest = bundle(f);
  assert.equal(manifest.sourceCommitVerification, 'DECLARED_NOT_GIT_VERIFIED');
  assert.equal(manifest.sensitivityReview, 'NOT_PERFORMED');
  assert.equal(manifest.privateOnly, true);
  for (const entry of manifest.files) {
    const copy = path.join(f.output, entry.path);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(copy)).digest('hex'), entry.sha256);
    assert.deepEqual(fs.readFileSync(copy), fs.readFileSync(path.join(f.repo, entry.path)));
    assert.equal(fs.statSync(copy).mode & 0o777, 0o600);
  }
  assert.equal(fs.statSync(f.output).mode & 0o777, 0o700);
});
test('exclude credentials, backup configuration and synthetic session files; keep auth code', t => {
  const f = fixture(t);
  const names = ['.env', '.env.local', '.envrc', '.npmrc.backup', '.aws/credentials', '.ssh/id_ed25519', 'credentials.json', 'secrets.json', 'storageState.json', 'session.sqlite3', 'test-results/session.json', 'node_modules/package/index.js'];
  for (const name of names) { const p = path.join(f.repo, 'product', name); fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 }); fs.writeFileSync(p, 'SYNTHETIC_TEST_ONLY\n', { mode: 0o600 }); }
  bundle(f);
  for (const name of names) assert.equal(fs.existsSync(path.join(f.output, 'product', name)), false, name);
  assert.equal(fs.existsSync(path.join(f.output, 'product/src/auth.ts')), true);
});
test('reject output ancestor aliases before creating an in-source wrapper', t => {
  const f = fixture(t), alias = path.join(f.root, 'alias');
  fs.symlinkSync(f.repo, alias, 'dir');
  f.output = path.join(alias, 'inside-source');
  assert.throws(() => bundle(f), /SYMLINK_OUTPUT_FORBIDDEN|OUTPUT_INSIDE_SOURCE_FORBIDDEN/);
  assert.equal(fs.existsSync(path.join(f.repo, 'inside-source')), false);
});
test('reject a guard reached through a symlink even when its bytes are pinned', t => {
  const f = fixture(t), external = path.join(f.root, 'external');
  fs.mkdirSync(path.join(external, 'security'), { recursive: true, mode: 0o700 });
  fs.copyFileSync(guardPath, path.join(external, 'security/patch-braces.cjs'));
  fs.renameSync(path.join(f.repo, 'tools'), path.join(f.repo, 'original-tools'));
  fs.symlinkSync(external, path.join(f.repo, 'tools'), 'dir');
  assert.throws(() => bundle(f), /SYMLINK_SOURCE_FORBIDDEN/);
  assert.equal(fs.existsSync(f.output), false);
});
test('reject a root alias and an included source symlink without producing output', t => {
  for (const variation of ['root', 'file']) {
    const f = fixture(t);
    if (variation === 'root') { const alias = path.join(f.root, 'source-alias'); fs.symlinkSync(f.repo, alias, 'dir'); f.repo = alias; }
    else fs.symlinkSync(path.join(f.repo, 'product/package.json'), path.join(f.repo, 'product/src/alias.json'));
    assert.throws(() => bundle(f), /SYMLINK_SOURCE_FORBIDDEN/);
    assert.equal(fs.existsSync(f.output), false);
  }
});
test('reject guard drift, existing output and lifecycle drift before copying', t => {
  for (const variation of ['guard', 'existing', 'lifecycle']) {
    const f = fixture(t);
    if (variation === 'guard') fs.appendFileSync(path.join(f.repo, 'tools/security/patch-braces.cjs'), '// altered\n');
    if (variation === 'existing') fs.mkdirSync(f.output);
    if (variation === 'lifecycle') fs.writeFileSync(path.join(f.repo, 'product/package.json'), JSON.stringify({ scripts: { postinstall: 'echo skip-guard' } }));
    assert.throws(() => bundle(f), new RegExp(variation === 'guard' ? 'GUARD_REVIEW_REQUIRED' : variation === 'existing' ? 'OUTPUT_ALREADY_EXISTS' : 'LIFECYCLE_REVIEW_REQUIRED'));
    if (variation !== 'existing') assert.equal(fs.existsSync(f.output), false);
  }
});
test('validate inputs and print only a fixed code for invalid source JSON', t => {
  assert.throws(() => prepareProductBundle(), /SOURCE_AND_OUTPUT_REQUIRED/);
  const f = fixture(t);
  assert.throws(() => prepareProductBundle({ sourceRoot: f.repo, outputRoot: f.output, sourceCommit: 'short' }), /FULL_SOURCE_COMMIT_REQUIRED/);
  fs.writeFileSync(path.join(f.repo, 'product/package.json'), 'SYNTHETIC_TEST_ONLY_ACCOUNT_MESSAGE', { mode: 0o600 });
  const r = spawnSync(process.execPath, [implementation, f.repo, f.output, commitLabel], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(r.error, undefined, 'CLI must execute; a spawn permission error is not an application failure');
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr.trim(), 'INVALID_PACKAGE_JSON');
  assert.equal(fs.existsSync(f.output), false);
});
