// 지시서 §23·§24·§40: 유형을 섞어 실AI 100회. 속도와 품질을 같이 센다.
// 판정은 자동 측정 가능한 것만 하고, 나머지는 '확인 불가'로 남긴다.
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { login } from './live.mjs';

const URL = 'https://zyyhhxyupizcqhxqnxuu.supabase.co';
const ANON = 'sb_publishable_ZLm0g3z7ad2-N0--kB5uFQ_sho1OGtn';
const EARLY = new Set(['step1', 'step2', 'understanding', 'followup']);
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
      let j = null; try { j = JSON.parse(t); } catch { j = { ok: false, code: 'BAD_JSON' }; }
      res({ http: i >= 0 ? Number(o.slice(i + 6)) : 0, json: j });
    });
    c.stdin.on('error', () => {});
    c.stdin.end(JSON.stringify(body));
  });
}
const tok = (s) => `r2-${s}-${Math.random().toString(36).slice(2, 10)}`;
const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
function bigrams(s) { const n = norm(s), out = new Set(); for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; }
function overlap(a, b) { const x = bigrams(a), y = bigrams(b); if (!x.size || !y.size) return 0; let c = 0; for (const g of x) if (y.has(g)) c++; return c / Math.min(x.size, y.size); }
// ── 2026-09-18 판정도구 결함 수정 (거짓 양성 P0-04) ──
// 예전에는 정정 이후의 '모든' 서버 문장에 대해 bigram 겹침이 0이면 정정무시로 셌다.
// 그래서 한 번 정정을 반영하고 대화가 다른 주제로 넘어가면 턴마다 계속 오판이 났다
// (캐너리 D·F 의 정정무시 4건이 전부 이 오판이었다. 실제로는 다음 요약·질문에 반영되어 있었다).
// FINAL LOCK P0-04 의 뜻대로 '정정 바로 다음 서버 문장' 하나만 본다.
// 비교는 앞머리 상투어를 뺀 내용어로 하고, 비교할 내용어가 없으면 판정하지 않는다(확인 불가).
const CORRECTION_BOILERPLATE = /(?:조금\s*달라요|그게\s*아니에요|제가\s*직접\s*설명할게요|아니요|아니에요|반은\s*맞고\s*반은\s*아닌\s*것\s*같아요|사실은)/gu;
const PARTICLE_TAIL = /(?:이|가|은|는|을|를|에|의|도|보다|부터|까지|으로|로|와|과)$/u;
function contentWords(text) {
  return (String(text ?? '').replace(CORRECTION_BOILERPLATE, ' ').match(/[가-힣]{2,}/gu) ?? [])
    .map((w) => w.replace(PARTICLE_TAIL, ''))
    .filter((w) => w.length >= 2);
}
function reflectsCorrection(shown, correction) {
  const words = contentWords(correction);
  if (!words.length) return null; // 비교할 내용어가 없다 → 판정하지 않는다
  const s = norm(shown);
  return words.some((w) => s.includes(norm(w)));
}
function questionSentence(t) {
  const parts = String(t ?? '').split(/(?<=[.?!…])\s+/).map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) if (/\?\s*$/.test(parts[i])) return parts[i];
  return String(t ?? '').trim();
}
const isBanmal = (t) => String(t || '').split(/(?<=[.?!…])\s+/).map((s) => s.trim())
  .filter((s) => s.length >= 3 && /[가-힣]/.test(s))
  .some((s) => !/(요|죠|쇼|니다|니까)\s*[?.!]?$/u.test(s));

// 지시서 §90 LOCK: 정확히 10개 그룹 × 10회 = 100회.
const TYPES = {
  A: { name: '짧은 자유입력', answers: ['돈 때문에', '일 때문에', '사람 때문에', '그냥 답답해', '요즘 좀 힘들어', '걱정돼', '기분이 이상해', '머리가 복잡해', '별일은 아닌데', '좀 지쳐'] },
  B: { name: '구체적 설명', answers: ['요즘 일이 너무 많고 돈 문제까지 겹쳐서 정신이 없어', '밤에 잠이 안 오고 아침마다 몸이 무거워요', '회사 사람들 눈치 보느라 말도 제대로 못 하고 집에 오면 지쳐요', '돈 나갈 데는 많은데 일은 줄어서 불안해요'] },
  C: { name: '애매함/모름', answers: ['잘 모르겠어', '아직 모르겠어', '애매해', '뭐라고 해야 할지 모르겠어', '생각이 정리가 안 돼'] },
  D: { name: '약한 정정', choice: 'alittle', text: '조금 달라요. 반은 맞고 반은 아닌 것 같아요. 사실은 일보다 사람이 더 힘들어요' },
  // 2026-09-18 검사도구 결함 수정: 서버는 agree 가 아닌 선택에 반드시 내용을 요구한다(index.ts BAD_REQUEST).
  // 빈 문자열을 보내던 예전 E 그룹은 제품 결함이 아니라 검사도구 결함이었다. 실제 사용자가 치는 거절 문장을 보낸다.
  E: { name: '강한 거절', choice: 'no', text: '그게 아니에요. 제가 말한 건 그런 뜻이 전혀 아니에요' },
  F: { name: '직접 설명', choice: 'explain', text: '제가 직접 설명할게요. 돈보다 시간이 없는 게 더 힘들어요' },
  G: { name: 'AI 판단 질문', answers: ['왜 그렇게 생각했어?', '내가 언제 그렇게 말했어?', '그 판단은 어디서 나온 거야?', '무슨 뜻이야?'] },
  H: { name: '해결방법 되물음', answers: ['어떻게 해야 좋을까?', '그럼 난 뭘 하면 돼?', '지금 내가 할 수 있는 건 뭐야?', '그래서 어떻게 해?'] },
  I: { name: '생각 보류', answers: ['다시 생각해볼게', '잠깐 생각해볼게', '조금 있다 말할게', '생각 좀 해볼게'] },
  J: { name: '기존 해석 반박', answers: ['내가 말한 뜻은 그게 아니야', '아까 말한 건 좀 달라', '완전히 잘못 이해했어', '난 그렇게 생각하지 않아'] },
};

const MIND = ['맑지만 걱정이야 ㅠ', '요즘 너무 지쳐', '돈 걱정이 많아', '일이 너무 많아', '사람이 힘들어'];
const PLAIN = ['일이 너무 많아서 잠을 못 자요', '돈이 제일 크게 걸려요', '조금 쉬고 싶어요', '주말에도 일 생각이 나요'];

const RUNS = Number(process.env.RUNS || 100);
const SPREAD = process.env.SPREAD === '1';
const OUT = process.env.OUT_FILE || 'r2-results.jsonl', PROG = process.env.PROG_FILE || 'r2-progress.log';
writeFileSync(OUT, ''); writeFileSync(PROG, '');
const note = (l) => { appendFileSync(PROG, l + '\n'); console.log(l); };

let { token } = await login();
const counters = {
  요청수: 0, 정상응답: 0, 서버오류: 0, fallback: 0, 빈응답: 0, 반말: 0,
  반복질문: 0, 맥락무시: 0, 사용자질문무시: 0, 되물음후STEP증가: 0, 장문: 0, 거절의미재등장: 0, 정정무시: 0,
};
const lat = [];
const typeStat = {};
for (const k of Object.keys(TYPES)) typeStat[k] = { n: 0, ok: 0, fallback: 0, banmal: 0, lat: [] };

// 2026-09-18 검사도구 충실도 수정: 화면(UI)은 AI 생성이 실패하면 같은 질문을 한 번 더 요청한다.
// 서버는 답변·단계를 이미 저장해 두므로 재요청이 안전하다(qa/full-flow-edge-simulation 이 보장).
// 검사도구만 재시도를 하지 않아 외부 OpenAI 타임아웃 1건이 '대화 중단'으로 기록됐다.
// 제품 규칙 결함과 외부 장애를 섞지 않기 위해 UI 와 같은 1회 재시도를 넣는다.
const RETRYABLE = new Set(['AI_ERROR', 'ERROR']);
// 2026-09-18 실AI 100회: 3시간짜리 장시간 검사에서 #72~79 가 UNAUTHORIZED 로 막혔다가
// #80 부터 같은 토큰으로 다시 붙었다(상류 검증 일시 장애). 장시간 검사에서 인증 흔들림이
// 제품 결함으로 기록되지 않도록, 인증 거절이 나면 한 번 다시 로그인해 이어간다.
async function reloginOnAuthFail(res) {
  if (res.json?.ok !== false && res.http !== 401) return null;
  const code = String(res.json?.code ?? '');
  if (!/UNAUTHORIZED/.test(code) && res.http !== 401) return null;
  counters.재로그인 = (counters.재로그인 ?? 0) + 1;
  await sleep(1500);
  try { return (await login()).token; } catch { return null; }
}
// 2026-09-19 최종 100회: 실제 화면(StepQuestionScreen.tsx)은 AI 실패에 자동 재시도하지 않는다.
// in_progress(동시성 충돌)에만 다시 요청하고, 그 밖의 실패는 오류 화면 + '다시 시도하기' 버튼이다.
// 따라서 본검사에서는 자동 재시도를 끈다(AI_RETRY=0). UI 와 같은 조건으로만 측정한다.
const AI_RETRY = process.env.AI_RETRY === '1';
async function askWithRetry(call, fn, body) {
  const first = await call(fn, body);
  if (first.json?.ok !== false || !RETRYABLE.has(first.json.code)) return first;
  if (!AI_RETRY) { counters.AI재시도차단 = (counters.AI재시도차단 ?? 0) + 1; return first; }
  counters.AI재시도 = (counters.AI재시도 ?? 0) + 1;
  await sleep(700);
  return call(fn, { ...body, token: body.token + '-r' });
}

const WINDOW = 10 * 60_000 + 20_000, BATCH = 9;
let winStart = Date.now(), inWin = 0;

for (let i = 0; i < RUNS; i++) {
  if (inWin >= BATCH) {
    const wait = Math.max(0, winStart + WINDOW - Date.now());
    if (wait > 0) { note(`제한 대기 ${Math.round(wait / 1000)}초 (${i}/${RUNS})`); await sleep(wait); }
    winStart = Date.now(); inWin = 0;
  }
  if (i > 0 && i % 20 === 0) { try { ({ token } = await login()); note('토큰 갱신'); } catch (e) { note('토큰 갱신 실패 ' + e.message); } }

  const keys = Object.keys(TYPES);
  // §90 LOCK: 100회는 각 그룹 10회 연속. SPREAD=1(Canary)일 때만 그룹을 한 번씩 돌아 10종을 모두 본다.
  const type = keys[(SPREAD ? i : Math.floor(i / 10)) % keys.length];
  const rec = { i, type, turns: [], stuck: null, completed: false, flags: [] };
  const call = async (fn, body) => { const t0 = Date.now(); const r = await post(`${URL}/functions/v1/${fn}`, { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body); return { ms: Date.now() - t0, ...r }; };

  const s = await call('get-step-question', { action: 'start', mindText: MIND[i % MIND.length], token: tok(`s${i}`) });
  counters.요청수++; lat.push(s.ms); typeStat[type].lat.push(s.ms);
  if (s.json?.ok === false || !s.json?.conversationId) { rec.stuck = { at: 'start', code: s.json?.code }; counters.서버오류++; appendFileSync(OUT, JSON.stringify(rec) + '\n'); inWin++; continue; }
  const cid = s.json.conversationId;
  // FINAL LOCK 판정용 원본 기록: 무엇을 보냈고, 무엇이 돌아왔고, 상태가 어떻게 바뀌었는가.
  rec.events = [];
  const ev = (o) => rec.events.push(o);
  let status = s.json.status, chose = false, lastUser = '', rejected = '';
  const asked = [];
  let pendingCorrection = null;

  for (let turn = 0; turn < 26 && !rec.completed; turn++) {
    const fn = EARLY.has(status) ? 'get-step-question' : 'echo-journey';
    const q = await askWithRetry(call, fn, { action: 'ask', conversationId: cid, token: tok(`q${i}-${turn}`) });
    counters.요청수++; lat.push(q.ms); typeStat[type].lat.push(q.ms);
    if (q.json?.ok === false) {
      rec.stuck = { at: status, turn, code: q.json.code, ms: q.ms };
      ev({ kind: 'blocked', turn, status, code: q.json.code, ms: q.ms });
      if (q.json.code === 'NO_CANDIDATE') { counters.fallback++; typeStat[type].fallback++; } else counters.서버오류++;
      break;
    }
    counters.정상응답++;
    const shown = String(q.json.understanding ?? q.json.question ?? '');
    rec.turns.push({ status, ms: q.ms, text: shown });
    ev({ kind: 'ask', turn, status, ms: q.ms, shown });
    if (!shown.trim()) { counters.빈응답++; rec.flags.push('빈응답'); }
    if (isBanmal(shown)) { counters.반말++; typeStat[type].banmal++; rec.flags.push('반말'); }
    if (shown.length > 220) { counters.장문++; rec.flags.push('장문'); }
    const qs = questionSentence(shown);
    if (asked.some((a) => overlap(qs, a) > 0.7)) { counters.반복질문++; rec.flags.push('반복질문'); }
    if (lastUser && lastUser.length >= 4 && overlap(qs, lastUser) === 0) { counters.맥락무시++; rec.flags.push('맥락무시'); }
    if (rejected && overlap(shown, rejected) > 0.6) { counters.거절의미재등장++; rec.flags.push('거절재등장'); }
    if (pendingCorrection) {
      const reflected = reflectsCorrection(shown, pendingCorrection);
      if (reflected === false) { counters.정정무시++; rec.flags.push('정정무시'); }
      if (reflected === null) rec.flags.push('정정반영_확인불가');
      pendingCorrection = null;
    }
    if (qs) asked.push(qs);

    if (q.json.status === 'report_ready' || q.json.status === 'report_done') { rec.completed = true; break; }

    if (q.json.understanding) {
      const t = TYPES[type];
      const choice = !chose && t.choice ? t.choice : 'agree';
      const text = !chose && t.choice ? t.text : '';
      if (choice === 'no') rejected = String(q.json.understanding);
      if (choice === 'alittle' || choice === 'explain') pendingCorrection = text;
      chose = true;
      const c = await call(fn, { action: 'choose', conversationId: cid, choice, text, token: tok(`c${i}-${turn}`) });
      counters.요청수++; lat.push(c.ms); typeStat[type].lat.push(c.ms);
      if (c.json?.ok === false) { rec.stuck = { at: 'choose', code: c.json.code }; counters.서버오류++; break; }
      ev({ kind: 'choose', turn, choice, text, understanding: String(q.json.understanding), statusBefore: status, statusAfter: c.json.status, ms: c.ms });
      lastUser = text || '맞아요';
      status = c.json.status; continue;
    }

    const t = TYPES[type];
    const answer = t.answers ? t.answers[turn % t.answers.length] : PLAIN[turn % PLAIN.length];
    const isAskBack = /\?$/.test(answer) || type === 'G' || type === 'H';
    const statusBefore = status;
    const a = await call(fn, { action: 'answer', conversationId: cid, answer, token: tok(`a${i}-${turn}`) });
    counters.요청수++; lat.push(a.ms); typeStat[type].lat.push(a.ms);
    if (a.json?.ok === false) { rec.stuck = { at: `answer:${status}`, code: a.json.code }; counters.서버오류++; break; }
    ev({ kind: 'answer', turn, answer, isAskBack, statusBefore, statusAfter: a.json.status, ms: a.ms });
    lastUser = answer;
    status = a.json.status;
    if (isAskBack && status !== statusBefore) { counters.되물음후STEP증가++; rec.flags.push('되물음후STEP증가'); }
    if (isAskBack) {
      const next = await askWithRetry(call, fn, { action: 'ask', conversationId: cid, token: tok(`r${i}-${turn}`) });
      counters.요청수++; lat.push(next.ms); typeStat[type].lat.push(next.ms);
      if (next.json?.ok === false) { rec.stuck = { at: `askback:${status}`, code: next.json.code }; counters.fallback++; typeStat[type].fallback++; break; }
      const reply = String(next.json.question ?? '');
      rec.turns.push({ status, ms: next.ms, text: reply, askback: true });
      ev({ kind: 'askbackReply', turn, question: answer, reply, status, ms: next.ms });
      // 사용자 질문에 답했는가: 첫 덩어리가 질문 하나로만 이뤄져 있으면 '답을 안 한 것'으로 본다.
      const head = reply.split('\n\n')[0] ?? '';
      if (!head.trim() || /^[^?]*\?\s*$/.test(head.trim())) { counters.사용자질문무시++; rec.flags.push('사용자질문무시'); }
      if (isBanmal(reply)) { counters.반말++; rec.flags.push('반말'); }
      status = next.json.status;
    }
    if (status === 'report_ready' || status === 'report_done') rec.completed = true;
  }
  typeStat[type].n++; if (rec.completed) typeStat[type].ok++;
  appendFileSync(OUT, JSON.stringify(rec) + '\n');
  inWin++;
  note(`${i + 1}/${RUNS} [${type} ${TYPES[type].name}] 완주=${rec.completed} 문장=${rec.turns.length} 표시=${rec.flags.join(',') || '-'} ${rec.stuck ? '막힘=' + rec.stuck.code + '@' + rec.stuck.at : ''}`);
}

lat.sort((a, b) => a - b);
const q = (p) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] : 0;
note('\n=== 속도 ===');
note(`표본 ${lat.length}  p50=${q(0.5)}ms  p75=${q(0.75)}ms  p95=${q(0.95)}ms  최대=${lat[lat.length - 1]}ms  10초초과=${lat.filter((x) => x > 10000).length}건`);
note('\n=== 품질 ===');
for (const [k, v] of Object.entries(counters)) note(`${k}: ${v}`);
note('\n=== 유형별 ===');
for (const [k, v] of Object.entries(typeStat)) {
  v.lat.sort((a, b) => a - b);
  const p = (x) => v.lat.length ? v.lat[Math.min(v.lat.length - 1, Math.floor(v.lat.length * x))] : 0;
  note(`${k} ${TYPES[k].name}: 대화=${v.n} 완주=${v.ok} fallback=${v.fallback} 반말=${v.banmal} p50=${p(0.5)}ms p95=${p(0.95)}ms`);
}
