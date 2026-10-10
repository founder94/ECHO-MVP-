'use strict';
// Private source wrapper only: preserve the existing lifecycle guard, never run install/deploy.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const GUARD_BLOB = 'b6ab1f40332998cc3fe29cf109948691fd947aa6';
const blob = data => crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
const excluded = name =>
  /^(?:\.env(?:\..*)?|\.envrc|\.npmrc(?:\..*)?|\.pypirc|\.netrc|\.git-credentials|\.git|\.aws|\.ssh|\.gnupg|\.config|\.codex|\.claude|\.manus|\.credentials|\.secrets|credentials?(?:[._-].*)?|secrets?(?:[._-].*)?|storageState(?:[._-].*)?|node_modules|dist|out(?:-.*)?|playwright-report|test-results|auth-state(?:[._-].*)?|\.auth|\.cache|\.DS_Store)$/i.test(name) ||
  /\.(?:pem|p12|pfx|key|log|sqlite3?|db)(?:[.-].*)?$/i.test(name);

// Check every existing component, including parents. Never follow a source/output alias.
function noSymlinks(target, code, allowMissing = false) {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (allowMissing && error.code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(code);
  }
}
function prepareProductBundle({ sourceRoot, outputRoot, sourceCommit } = {}) {
  if (typeof sourceRoot !== 'string' || !sourceRoot.trim() ||
      typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('SOURCE_AND_OUTPUT_REQUIRED');
  if (typeof sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('FULL_SOURCE_COMMIT_REQUIRED');
  const resolvedSource = path.resolve(sourceRoot);
  noSymlinks(resolvedSource, 'SYMLINK_SOURCE_FORBIDDEN');
  const root = fs.realpathSync(resolvedSource);
  const product = path.join(root, 'product');
  noSymlinks(product, 'SYMLINK_SOURCE_FORBIDDEN');
  const output = path.resolve(outputRoot);
  noSymlinks(output, 'SYMLINK_OUTPUT_FORBIDDEN', true);
  if (output === root || output.startsWith(root + path.sep)) throw new Error('OUTPUT_INSIDE_SOURCE_FORBIDDEN');
  if (fs.existsSync(output)) throw new Error('OUTPUT_ALREADY_EXISTS');
  const guardPath = path.join(root, 'tools/security/patch-braces.cjs');
  noSymlinks(guardPath, 'SYMLINK_SOURCE_FORBIDDEN');
  const guard = fs.readFileSync(guardPath);
  if (blob(guard) !== GUARD_BLOB) throw new Error('GUARD_REVIEW_REQUIRED');
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(product, 'package.json'), 'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error('INVALID_PACKAGE_JSON');
    throw error;
  }
  for (const name of ['postinstall', 'prebuild', 'prebuild:app', 'prebuild:brand']) {
    if (pkg?.scripts?.[name] !== 'node ../tools/security/patch-braces.cjs .') throw new Error('LIFECYCLE_REVIEW_REQUIRED');
  }
  const files = [], skipped = [];
  // Validate before creating output. Use a quiescent source snapshot; this is not a live-tree lock.
  function collect(dir, prefix = 'product') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${prefix}/${entry.name}`;
      if (excluded(entry.name)) { skipped.push(relative); continue; }
      if (entry.isSymbolicLink()) throw new Error('SYMLINK_SOURCE_FORBIDDEN');
      const input = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(input, relative);
      else if (entry.isFile()) files.push({ input, relative, sha256: hash(fs.readFileSync(input)) });
      else throw new Error('NON_FILE_SOURCE_FORBIDDEN');
    }
  }
  collect(product);
  fs.mkdirSync(output, { mode: 0o700 });
  for (const file of files) {
    const dest = path.join(output, file.relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    fs.copyFileSync(file.input, dest, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(dest, 0o600);
    if (hash(fs.readFileSync(dest)) !== file.sha256) throw new Error('COPY_HASH_MISMATCH');
  }
  const guardName = 'tools/security/patch-braces.cjs';
  fs.mkdirSync(path.join(output, 'tools/security'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(output, guardName), guard, { mode: 0o600, flag: 'wx' });
  const manifest = {
    sourceCommit, sourceCommitVerification: 'DECLARED_NOT_GIT_VERIFIED',
    privateOnly: true, sensitivityReview: 'NOT_PERFORMED',
    layout: 'wrapper/product plus wrapper/tools/security',
    verification: 'copy file bytes only; not Git provenance, install, model, server, device or deployment',
    files: [...files.map(({ relative, sha256 }) => ({ path: relative, sha256 })), { path: guardName, sha256: hash(guard) }],
    excluded: skipped,
  };
  fs.writeFileSync(path.join(output, 'SOURCE_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(path.join(output, 'README.txt'),
    'Private source bundle. Keep product/ and tools/ together.\n' +
    'From product/: npm ci, then npm run build:app or npm run build:brand.\n' +
    'No install or deployment has been performed by the bundler.\n' +
    'The source commit is a caller label, not independently verified Git provenance.\n' +
    'Name exclusions are not a complete secret or personal-data content scan. Do not share without review.\n',
    { mode: 0o600, flag: 'wx' });
  return manifest;
}
module.exports = { prepareProductBundle };
if (require.main === module) {
  const [, , sourceRoot, outputRoot, sourceCommit] = process.argv;
  try {
    const manifest = prepareProductBundle({ sourceRoot, outputRoot, sourceCommit });
    console.log(JSON.stringify({ packagedFiles: manifest.files.length, sourceCommit: manifest.sourceCommit, sourceCommitVerification: manifest.sourceCommitVerification }));
  } catch (error) {
    const candidate = error.code || error.message;
    const code = typeof candidate === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(candidate) ? candidate : 'BUNDLE_PREPARATION_FAILED';
    console.error(code);
    process.exitCode = 1;
  }
}
