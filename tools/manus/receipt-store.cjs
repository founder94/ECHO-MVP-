'use strict';
const { createHash } = require('node:crypto');
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Adapt PR118's existing load()/save(expectedRevision,state) CAS store; do not replace that queue.
// The caller obtains binding from trusted workflow metadata and its approved READY task.
function receiptStore(existingStore, binding) {
  if (!existingStore?.load || !existingStore?.save || !binding || !/^[0-9a-f]{40}$/.test(binding.source_sha ?? '') || !binding.task_id || !binding.owner || !['User','Bot'].includes(binding.principal_type) || !binding.principal_login) throw new Error('INVALID_QUEUE_BINDING');
  const immutable = structuredClone(binding); const fingerprint = digest(immutable);
  const read = async key => {
    if (typeof key !== 'string' || !/^[A-Za-z0-9:_-]{1,180}$/.test(key)) throw new Error('INVALID_RECEIPT_KEY');
    const snapshot = await existingStore.load();
    if (!snapshot || !snapshot.state || !Array.isArray(snapshot.state.tasks)) throw new Error('QUEUE_READ_FAILED');
    const record = snapshot.state.manus_receipts?.[key];
    if (record && record.binding_sha256 !== fingerprint) throw new Error('STALE_OR_FOREIGN_RECEIPT');
    return { snapshot, value: record?.value ?? null };
  };
  return {
    async get(key) { return structuredClone((await read(key)).value); },
    async cas(key, expected, next) {
      const { snapshot, value } = await read(key);
      if (digest(value) !== digest(expected)) return false;
      const state = structuredClone(snapshot.state);
      state.manus_receipts = { ...(state.manus_receipts ?? {}), [key]: { binding_sha256: fingerprint, binding: immutable, value: structuredClone(next) } };
      return await existingStore.save(snapshot.rev, state) === true;
    },
  };
}
module.exports = { receiptStore };
