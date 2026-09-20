// 실AI 100회에서 난 P0 6건(NO_CANDIDATE 5 + 정정무시 #58)을 같은 입력 순서로 재현한다.
// 자동 재시도 없음(화면과 같은 조건). 비밀번호·토큰·원문은 로그에 남기지 않는다.
import { appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { login } from './live.mjs';
const URL = 'https://zyyhhxyupizcqhxqnxuu.supabase.co';
const ANON = 'sb_publishable_ZLm0g3z7ad2-N0--kB5uFQ_sho1OGtn';
const EARLY = new Set(['step1', 'step2', 'understanding', 'followup']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function post(url, h, b) { return new Promise((res) => { const a = ['-sS', '--max-time', '90', '-X', 'POST', url, '-w', '\n__H__%{http_code}']; for (const [k, v] of Object.entries(h)) a.push('-H', `${k}: ${v}`); a.push('--data-binary', '@-'); const c = spawn('curl', a, { stdio: ['pipe', 'pipe', 'pipe'] }); let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', () => { const i = o.lastIndexOf('\n__H__'); const t = i >= 0 ? o.slice(0, i) : o; let j = null; try { j = JSON.parse(t); } catch { j = { ok: false, code: 'BAD_JSON' }; } res({ http: i >= 0 ? Number(o.slice(i + 6)) : 0, json: j }); }); c.stdin.on('error', () => {}); c.stdin.end(JSON.stringify(b)); }); }
const tok = (s) => `rp-${s}-${Math.random().toString(36).slice(2, 10)}`;
const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 100회 결과 파일에서 그대로 옮긴 입력 순서. steps: answer=답, choose=버튼.
const SCENARIOS = {
  '#10': { mind: '맑지만 걱정이야 ㅠ', steps: [['a', '요즘 일이 너무 많고 돈 문제까지 겹쳐서 정신이 없어'], ['a', '밤에 잠이 안 오고 아침마다 몸이 무거워요'], ['c', 'agree', ''], ['a', '돈 나갈 데는 많은데 일은 줄어서 불안해요']], watch: 'step3' },
  '#14': { mind: '사람이 힘들어', steps: [['a', '요즘 일이 너무 많고 돈 문제까지 겹쳐서 정신이 없어'], ['a', '밤에 잠이 안 오고 아침마다 몸이 무거워요'], ['c', 'agree', ''], ['a', '돈 나갈 데는 많은데 일은 줄어서 불안해요'], ['a', '요즘 일이 너무 많고 돈 문제까지 겹쳐서 정신이 없어'], ['a', '밤에 잠이 안 오고 아침마다 몸이 무거워요'], ['a', '돈 나갈 데는 많은데 일은 줄어서 불안해요']], watch: 'step6' },
  '#24': { mind: '사람이 힘들어', steps: [['a', '잘 모르겠어'], ['a', '아직 모르겠어'], ['c', 'agree', ''], ['a', '애매해']], watch: 'step3' },
  '#41': { mind: '요즘 너무 지쳐', steps: [['a', '일이 너무 많아서 잠을 못 자요'], ['a', '돈이 제일 크게 걸려요'], ['c', 'no', '그게 아니에요. 제가 말한 건 그런 뜻이 전혀 아니에요'], ['a', '조금 쉬고 싶어요']], watch: 'followup' },
  '#96': { mind: '요즘 너무 지쳐', steps: [['a', '내가 말한 뜻은 그게 아니야'], ['a', '아까 말한 건 좀 달라'], ['c', 'agree', ''], ['a', '완전히 잘못 이해했어']], watch: 'step3' },
  '#58': { mind: '일이 너무 많아', steps: [['a', '일이 너무 많아서 잠을 못 자요'], ['a', '돈이 제일 크게 걸려요'], ['c', 'explain', '제가 직접 설명할게요. 돈보다 시간이 없는 게 더 힘들어요'], ['a', '주말에도 일 생각이 나요']], watch: 'followup', correction: '돈보다 시간이 없는 게 더 힘들어요' },
};
const only = (process.env.ONLY || Object.keys(SCENARIOS).join(',')).split(',');
const REPS = Number(process.env.REPS || 1);
const OUT = process.env.OUT_FILE || 'repro-p0.jsonl';
const GAP_MS = Number(process.env.GAP_MS || 66_000); // 서버 보호(10분 10회) 안쪽으로 시작 간격을 둔다
const { token } = await login();
const call = (fn, body) => post(`${URL}/functions/v1/${fn}`, { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body);
let first = true;
for (let rep = 0; rep < REPS; rep++) for (const id of only) {
  const sc = SCENARIOS[id]; if (!sc) continue;
  if (!first) await sleep(GAP_MS); first = false;
  const rec = { id, rep, result: 'ok', stuckAt: null, code: null, flags: [], watched: '' };
  const s = await call('get-step-question', { action: 'start', mindText: sc.mind, token: tok('s') });
  if (!s.json?.conversationId) { rec.result = 'start_fail'; rec.code = s.json?.code; appendFileSync(OUT, JSON.stringify(rec) + '\n'); console.log(id, rep, 'START', rec.code); continue; }
  const cid = s.json.conversationId; let status = s.json.status;
  let lastShown = ''; let pendingCorrection = sc.correction || '';
  for (const step of sc.steps) {
    const fn = EARLY.has(status) ? 'get-step-question' : 'echo-journey';
    const q = await call(fn, { action: 'ask', conversationId: cid, token: tok('q') });
    if (q.json?.ok === false) { rec.result = 'stuck'; rec.stuckAt = status; rec.code = q.json.code; break; }
    lastShown = String(q.json.understanding ?? q.json.question ?? '');
    if (!lastShown.trim()) rec.flags.push('빈응답');
    if (status === sc.watch) rec.watched = lastShown.replace(/\n\n/g, ' / ').slice(0, 120);
    if (step[0] === 'c') {
      const c = await call(fn, { action: 'choose', conversationId: cid, choice: step[1], text: step[2], token: tok('c') });
      if (c.json?.ok === false) { rec.result = 'stuck'; rec.stuckAt = 'choose'; rec.code = c.json.code; break; }
      status = c.json.status;
      if (step[1] === 'explain' || step[1] === 'alittle') {
        // 정정 직후 첫 서버 문장을 본다
        const fn2 = EARLY.has(status) ? 'get-step-question' : 'echo-journey';
        const n = await call(fn2, { action: 'ask', conversationId: cid, token: tok('n') });
        if (n.json?.ok === false) { rec.result = 'stuck'; rec.stuckAt = status; rec.code = n.json.code; break; }
        const shown = String(n.json.question ?? '');
        rec.watched = shown.replace(/\n\n/g, ' / ').slice(0, 140);
        const words = pendingCorrection.replace(/(?:제가\s*직접\s*설명할게요|조금\s*달라요|사실은)/g, ' ').match(/[가-힣]{2,}/gu) ?? [];
        const w = words.map((x) => x.replace(/(?:이|가|은|는|을|를|에|의|도|보다|로|와|과)$/u, '')).filter((x) => x.length >= 2);
        const reflected = w.some((x) => norm(shown).includes(norm(x)));
        if (!reflected) rec.flags.push('정정무시');
        // 최신 정정(돈보다 시간)인데 '돈'을 주된 문제로 되살렸는지
        if (/돈/.test(shown.split('\n\n').at(-1) ?? '') && !/시간/.test(shown)) rec.flags.push('구근거재승격');
        break;
      }
      continue;
    }
    const a = await call(fn, { action: 'answer', conversationId: cid, answer: step[1], token: tok('a') });
    if (a.json?.ok === false) { rec.result = 'stuck'; rec.stuckAt = `answer:${status}`; rec.code = a.json.code; break; }
    status = a.json.status;
  }
  if (rec.result === 'ok' && !rec.watched) {
    const fn = EARLY.has(status) ? 'get-step-question' : 'echo-journey';
    const q = await call(fn, { action: 'ask', conversationId: cid, token: tok('w') });
    if (q.json?.ok === false) { rec.result = 'stuck'; rec.stuckAt = status; rec.code = q.json.code; }
    else rec.watched = String(q.json.question ?? q.json.understanding ?? '').replace(/\n\n/g, ' / ').slice(0, 120);
  }
  appendFileSync(OUT, JSON.stringify(rec) + '\n');
  console.log(`${id} rep${rep} ${rec.result}${rec.code ? ' ' + rec.code + '@' + rec.stuckAt : ''} ${rec.flags.join(',')} | ${rec.watched}`);
}
