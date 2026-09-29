// reply_quality 가 어느 하위 규칙 때문에 100% 막히는지 가리기 위한 감별 검사.
// 코드를 바꾸지 않고, 되물음 문장의 '내용어 양'만 바꿔서 답(reply)이 화면에 나오는지 본다.
// 답이 나오면 그 조건에서는 reply 검사를 통과한 것이고, 어떤 조건에서도 안 나오면 내용과 무관한 규칙이다.
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { login } from './live.mjs';

const URL = 'https://zyyhhxyupizcqhxqnxuu.supabase.co';
const ANON = 'sb_publishable_ZLm0g3z7ad2-N0--kB5uFQ_sho1OGtn';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function post(url, headers, body) {
  return new Promise((res) => {
    const a = ['-sS', '--max-time', '90', '-X', 'POST', url, '-w', '\n__H__%{http_code}'];
    for (const [k, v] of Object.entries(headers)) a.push('-H', `${k}: ${v}`);
    a.push('--data-binary', '@-');
    const c = spawn('curl', a, { stdio: ['pipe', 'pipe', 'pipe'] });
    let o = '';
    c.stdout.on('data', (d) => { o += d; });
    c.on('close', () => {
      const i = o.lastIndexOf('\n__H__');
      const t = i >= 0 ? o.slice(0, i) : o;
      let j = null; try { j = JSON.parse(t); } catch { j = { ok: false, code: 'BAD_JSON', raw: t.slice(0, 200) }; }
      res({ http: i >= 0 ? Number(o.slice(i + 6)) : 0, json: j });
    });
    c.stdin.on('error', () => {});
    c.stdin.end(JSON.stringify(body));
  });
}
const tok = (s) => `pr-${s}-${Math.random().toString(36).slice(2, 10)}`;

const CASES = [
  { id: 'bare_banmal',     q: '무슨 뜻이야?' },
  { id: 'bare_polite',     q: '무슨 뜻이에요?' },
  { id: 'howto_banmal',    q: '어떻게 해야 좋을까?' },
  { id: 'content_polite',  q: '제가 말한 돈 걱정을 줄이려면 무엇부터 보면 좋을까요?' },
  { id: 'content_banmal',  q: '내가 말한 돈 걱정을 줄이려면 뭐부터 보면 좋을까?' },
  { id: 'selfdirected',    q: '너 내 말 기억해?' },
  { id: 'long_content',    q: '돈 걱정이랑 일 걱정이 같이 있는데 둘 중에 무엇이 더 큰 문제인지 에코는 어떻게 보나요?' },
  { id: 'short_content',   q: '돈 걱정은 어떻게 보나요?' },
];

const OUT = process.env.OUT_FILE || 'probe-reply.jsonl';
writeFileSync(OUT, '');
const { token } = await login();
console.log('login ok');

for (const c of CASES) {
  const call = (fn, body) => post(`${URL}/functions/v1/${fn}`, { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body);
  const rec = { id: c.id, q: c.q };
  const s = await call('get-step-question', { action: 'start', mindText: '돈 걱정이 많아', token: tok('s') });
  if (!s.json?.conversationId) { rec.error = s.json?.code || `http${s.http}`; appendFileSync(OUT, JSON.stringify(rec) + '\n'); console.log(c.id, 'START FAIL', rec.error); continue; }
  const cid = s.json.conversationId;
  const q1 = await call('get-step-question', { action: 'ask', conversationId: cid, token: tok('q1') });
  rec.step1 = String(q1.json?.question ?? '');
  const a = await call('get-step-question', { action: 'answer', conversationId: cid, answer: c.q, token: tok('a') });
  if (a.json?.ok === false) { rec.error = 'answer:' + a.json.code; appendFileSync(OUT, JSON.stringify(rec) + '\n'); console.log(c.id, 'ANSWER FAIL', rec.error); continue; }
  const started = Date.now();
  const r = await call('get-step-question', { action: 'ask', conversationId: cid, token: tok('r') });
  rec.ms = Date.now() - started;
  if (r.json?.ok === false) { rec.error = 'ask:' + r.json.code; rec.replyPresent = false; }
  else {
    const shown = String(r.json?.question ?? '');
    rec.shown = shown;
    const head = (shown.split('\n\n')[0] ?? '').trim();
    rec.head = head;
    rec.replyPresent = Boolean(head) && !/^[^?]*\?\s*$/.test(head);
  }
  appendFileSync(OUT, JSON.stringify(rec) + '\n');
  console.log(`${c.id.padEnd(16)} reply=${rec.replyPresent ? 'YES' : 'no '} ${rec.error ? 'err=' + rec.error : ''} ms=${rec.ms}`);
  await sleep(1200);
}
console.log('done');
