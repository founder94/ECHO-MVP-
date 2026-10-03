const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reserve } = require('./reserve.cjs');
test('reservation above limit is rejected without changing usage', () => {
  assert.deepEqual(reserve(10, 8, 3), { allowed: false, used: 8 });
});
test('reservation within limit succeeds', () => {
  assert.deepEqual(reserve(10, 8, 2), { allowed: true, used: 10 });
});
