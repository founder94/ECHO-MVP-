'use strict';
// Reproducible, hash-checked temporary mitigation for the unpatched braces 3.0.3 parser.
// Never patch an unknown package version. CI/build must fail on drift.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || '.');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const originalHash = 'e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310';
const guard = `  // ECHO_SECURITY_BRACES_20261008: conservative bounds before recursive parsing.
  if (input.length > 4096) throw new RangeError('PATTERN_TOO_LONG');
  const securityStack = [];
  const securityPair = { '}': '{', ')': '(', ']': '[' };
  for (const char of input) {
    if ('{(['.includes(char)) {
      securityStack.push(char);
      if (securityStack.length > 64) throw new RangeError('PATTERN_TOO_DEEP');
    } else if (securityPair[char] === securityStack[securityStack.length - 1]) {
      securityStack.pop();
    }
  }

`;
const marker = '  const opts = options || {};';
const sum = s => crypto.createHash('sha256').update(s).digest('hex');
let count = 0;
for (const [relative, info] of Object.entries(lock.packages || {})) {
  if (!relative.endsWith('node_modules/braces')) continue;
  if (info.version !== '3.0.3') throw new Error('BRACES_VERSION_REVIEW_REQUIRED');
  const directory = path.resolve(root, relative);
  if (!directory.startsWith(root + path.sep)) throw new Error('INVALID_LOCK_PATH');
  const file = path.join(directory, 'lib/parse.js');
  const current = fs.readFileSync(file, 'utf8');
  if (current.includes(guard)) {
    if (sum(current.replace(guard, '')) !== originalHash) throw new Error('BRACES_PATCH_DRIFT');
  } else {
    if (sum(current) !== originalHash || !current.includes(marker)) throw new Error('BRACES_SOURCE_DRIFT');
    fs.writeFileSync(file, current.replace(marker, guard + marker));
  }
  count++;
}
if (!count) throw new Error('BRACES_PACKAGE_NOT_FOUND');
console.log(`braces bounded parser verified: ${count} package(s)`);
