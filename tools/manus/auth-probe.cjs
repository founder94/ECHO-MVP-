'use strict';
const { client } = require('./client.cjs');
async function main() {
  try { await client({ apiKey: process.env.MANUS_API_KEY }).auth(); process.stdout.write(JSON.stringify({ credential_present: true, authentication: 'PASS', paid_tasks: 0 }) + '\n'); }
  catch (error) { process.stdout.write(JSON.stringify({ credential_present: !!process.env.MANUS_API_KEY, authentication: 'FAIL', code: /^[A-Z_]+$/.test(error.code ?? '') ? error.code : 'UNKNOWN', paid_tasks: 0 }) + '\n'); process.exitCode = 1; }
}
if (require.main === module) void main();
module.exports = { main };
