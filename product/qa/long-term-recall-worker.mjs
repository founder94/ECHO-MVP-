// Run as a separate Node process. The reader receives a store path, not old dialogue in its prompt.
import { readFileSync, writeFileSync } from 'node:fs'; import { createHash } from 'node:crypto';
import { load } from './memory-harness.mjs';
const [mode, file, output] = process.argv.slice(2);
if (!['write','read'].includes(mode) || !file) throw new Error('fixture arguments');
const codeHash = createHash('sha256').update(readFileSync(new URL('../supabase/functions/doit-agent/history-retrieval.ts', import.meta.url))).digest('hex');
if (mode === 'write') {
  const source = JSON.parse(readFileSync(new URL('./fixtures/long-term-memory-synthetic.json', import.meta.url), 'utf8'));
  // Existing persisted synthetic fixture was saved by the original HTTP handler/kernel audit.
  // Persist and read this exact store in separate processes; no in-memory context shared.
  writeFileSync(file, JSON.stringify({ writer_pid: process.pid, fixture: source.a, codeHash }));
} else {
  const disk = JSON.parse(readFileSync(file, 'utf8'));
  if (disk.codeHash !== codeHash || disk.writer_pid === process.pid) throw new Error('not a separate reader of same code');
  disk.fixture.aiCalls = [];
  const response = await load(disk.fixture).call({ action: 'agent_recall', query: '처음 정한 회사 가치 목표가 얼마였나요?', intent: 'history' });
  const old = response.body.memory?.evidence.find(e => e.quote === '10년 뒤 회사가치 500억 원이면 매각을 검토한다');
  if (response.status !== 200 || !old || disk.fixture.aiCalls.length) throw new Error('cold recall failed');
  writeFileSync(output, JSON.stringify({ writer_pid: disk.writer_pid, reader_pid: process.pid, codeHash, pass: true, provider_calls: 0, turn: old.turn, source_id: old.source_id, source: 'separate-process synthetic file store; mocked DB adapter; no live DB/model' }, null, 2));
}
