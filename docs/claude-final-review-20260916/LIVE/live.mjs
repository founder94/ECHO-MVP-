// 실계정·실서버·실제 AI 로 ECHO 여정을 돌린다. 비밀번호는 환경변수로만 받고 파일에 남기지 않는다.
import { spawn } from 'node:child_process';

const URL = 'https://zyyhhxyupizcqhxqnxuu.supabase.co';
const ANON = 'sb_publishable_ZLm0g3z7ad2-N0--kB5uFQ_sho1OGtn';

const MIND = ['맑지만 걱정이야 ㅠ','요즘 너무 지쳐','돈 걱정이 많아','자꾸 눈물이 나','화가 나','괜찮은 것 같기도 하고','아무 생각이 없어','일이 너무 많아','사람이 힘들어','잠이 안 와'];
const ANSWERS = ['돈때문에','일이 너무 많아서','모르겠어요','어떻게 해야 좋을까?','ㅇㅇ','그 뜻이 아니라 쉬고 싶다는 뜻이야','사람 때문에 지쳐요','잘 모르겠어요','쉬고 싶어요','너 내 말 기억해?','시간이 없어서','그냥 답답해요'];
const EARLY = new Set(['step1','step2','understanding','followup']);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 이 환경에서는 Node 의 fetch 가 프록시를 타지 않는다(curl 은 탄다). 그래서 curl 로 보낸다.
// 본문은 stdin 으로 넘기고 반드시 닫아준다. 안 닫으면 curl 이 영원히 기다린다(2026-09-17 겪음).
function post(url, headers, body) {
  return new Promise((resolve) => {
    const args = ['-sS', '--max-time', '90', '-X', 'POST', url, '-w', '\n__HTTP__%{http_code}'];
    for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
    args.push('--data-binary', '@-');
    const child = spawn('curl', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const guard = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 100_000);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => { clearTimeout(guard); resolve({ http: 0, json: { ok: false, code: 'SPAWN_FAIL' } }); });
    child.on('close', () => {
      clearTimeout(guard);
      const cut = out.lastIndexOf('\n__HTTP__');
      const text = cut >= 0 ? out.slice(0, cut) : out;
      const http = cut >= 0 ? Number(out.slice(cut + 9).trim()) : 0;
      let json = null;
      try { json = JSON.parse(text); } catch { json = { ok: false, code: 'BAD_JSON', raw: (text || err).slice(0, 160) }; }
      resolve({ http, json });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(body));
  });
}

export async function login() {
  const { http, json } = await post(`${URL}/auth/v1/token?grant_type=password`,
    { apikey: ANON, 'Content-Type': 'application/json' },
    { email: process.env.ECHO_EMAIL, password: process.env.ECHO_PW });
  if (http !== 200 || !json?.access_token) {
    throw new Error(`login http=${http} ${String(json?.error_description || json?.msg || json?.code || json?.raw || '').slice(0, 100)}`);
  }
  return { token: json.access_token, userId: json.user?.id };
}

async function call(fn, token, body) {
  const started = Date.now();
  const { http, json } = await post(`${URL}/functions/v1/${fn}`,
    { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body);
  return { ms: Date.now() - started, http, body: json };
}

function isBanmal(text) {
  return String(text || '').split(/(?<=[.?!…])\s+/).map((s) => s.trim())
    .filter((s) => s.length >= 3 && /[가-힣]/.test(s))
    .some((s) => !/(요|죠|쇼|니다|니까)\s*[?.!]?$/u.test(s));
}

const tok = (s) => `lt-${s}-${Math.random().toString(36).slice(2, 10)}`;

export async function runOne(token, i) {
  const rec = { i, turns: [], stuck: null, completed: false, banmal: [], slowest: 0, calls: 0, timings: [] };
  const mark = (action, status, r) => { rec.timings.push({ action, status, ms: r.ms, ok: r.body?.ok !== false }); };
  const s = await call('get-step-question', token, { action: 'start', mindText: MIND[i % MIND.length], token: tok(`s${i}`) });
  rec.calls++; rec.slowest = Math.max(rec.slowest, s.ms); mark('start', 'new', s);
  if (s.body?.ok === false || !s.body?.conversationId) {
    rec.stuck = { at: 'start', code: s.body?.code ?? `http${s.http}`, raw: s.body?.raw };
    return rec;
  }
  const cid = s.body.conversationId;
  rec.conversationId = cid;
  let status = s.body.status, chose = false;

  for (let turn = 0; turn < 40 && !rec.completed; turn++) {
    const fn = EARLY.has(status) ? 'get-step-question' : 'echo-journey';
    const q = await call(fn, token, { action: 'ask', conversationId: cid, token: tok(`q${i}-${turn}`) });
    rec.calls++; rec.slowest = Math.max(rec.slowest, q.ms); mark('ask', status, q);
    if (q.body?.ok === false) { rec.stuck = { at: status, turn, code: q.body.code, ms: q.ms }; break; }

    const shown = String(q.body.understanding ?? q.body.question ?? '');
    rec.turns.push({ status, ms: q.ms, text: shown });
    if (process.env.LIVE_VERBOSE) console.log(`   #${i} [${status}] ${q.ms}ms ${shown.replace(/\n/g, ' / ').slice(0, 70)}`);
    if (shown && isBanmal(shown)) rec.banmal.push({ status, text: shown });
    if (q.body.status === 'report_ready' || q.body.status === 'report_done') { rec.completed = true; break; }

    if (q.body.understanding) {
      const choice = chose ? 'agree' : ['agree','alittle','no','explain'][i % 4];
      chose = true;
      const c = await call(fn, token, { action: 'choose', conversationId: cid, choice, text: choice === 'agree' ? '' : '사실은 좀 쉬고 싶다는 뜻이에요', token: tok(`c${i}-${turn}`) });
      rec.calls++; rec.slowest = Math.max(rec.slowest, c.ms); mark('choose', status, c);
      if (c.body?.ok === false) { rec.stuck = { at: 'choose', code: c.body.code }; break; }
      status = c.body.status; continue;
    }

    const answer = ANSWERS[(i + turn) % ANSWERS.length];
    const a = await call(fn, token, { action: 'answer', conversationId: cid, answer, token: tok(`a${i}-${turn}`) });
    rec.calls++; rec.slowest = Math.max(rec.slowest, a.ms); mark('answer', status, a);
    if (a.body?.ok === false) { rec.stuck = { at: `answer:${status}`, code: a.body.code }; break; }
    status = a.body.status;
    if (status === 'report_ready' || status === 'report_done') rec.completed = true;
  }
  if (!rec.completed && !rec.stuck) rec.stuck = { at: status, code: 'NEVER_FINISHED' };
  return rec;
}
