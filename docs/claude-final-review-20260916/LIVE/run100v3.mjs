// 최종 실AI 100회 v3 — 2026-09-20 대표 지시 §11: '100회 시도'가 아니라 '실제 시작 100회'.
// 서버 보호장치(10분 10회, START_RATE_MAX)는 그대로 두고 검사기가 서버 정책에 맞춘다.
//  · 시작 시각을 상태 파일(OUT.state.json)에 보존 → 워커/셸 재시작 후에도 제한을 넘지 않는다.
//  · 서버가 RATE_LIMITED 로 거절하면 그 회차는 '시작'이 아니므로 결과 줄을 쓰지 않고 기다렸다가 같은 회차를 다시 연다.
//  · 자동 재시도 없음: AI_RETRY 환경변수 값과 재시도 횟수를 상태 파일에 그대로 기록한다(§8 증거).
//  · 판정 규칙은 v2 와 같다(정정무시 = 정정 바로 다음 서버 문장만, 401/403 은 P0 아님).
import { appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { login } from './live.mjs';

const URL = 'https://zyyhhxyupizcqhxqnxuu.supabase.co';
const ANON = 'sb_publishable_ZLm0g3z7ad2-N0--kB5uFQ_sho1OGtn';
const EARLY = new Set(['step1', 'step2', 'understanding', 'followup']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DRY = process.env.DRY === '1'; // 서버를 건드리지 않고 시작 제한·상태 보존 논리만 검사
const DRY_WINDOW = Number(process.env.DRY_WINDOW_MS) || 0; // DRY 에서만 창을 줄여 빨리 검사

function post(url, headers, body) {
  if (DRY) return dryPost(url, body);
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
// DRY: 서버 보호장치(10분 10회)를 흉내 내어 검사기가 제한을 넘는지만 본다.
const dryStarts = [];
async function dryPost(url, body) {
  await sleep(5);
  if (body.action === 'start') {
    const now = Date.now();
    while (dryStarts.length && dryStarts[0] < now - SERVER_WINDOW) dryStarts.shift();
    if (dryStarts.length >= 10) return { http: 429, json: { ok: false, code: 'RATE_LIMITED' } };
    dryStarts.push(now);
    return { http: 200, json: { ok: true, conversationId: 'dry', status: 'step1' } };
  }
  return { http: 200, json: { ok: true, status: 'report_done', question: '오늘 하루는 어떠셨나요?' } };
}
const tok = (s) => `r3-${s}-${Math.random().toString(36).slice(2, 10)}`;
const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
function bigrams(s) { const n = norm(s), out = new Set(); for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; }
function overlap(a, b) { const x = bigrams(a), y = bigrams(b); if (!x.size || !y.size) return 0; let c = 0; for (const g of x) if (y.has(g)) c++; return c / Math.min(x.size, y.size); }
const CORRECTION_BOILERPLATE = /(?:조금\s*달라요|그게\s*아니에요|제가\s*직접\s*설명할게요|아니요|아니에요|반은\s*맞고\s*반은\s*아닌\s*것\s*같아요|사실은)/gu;
const PARTICLE_TAIL = /(?:이|가|은|는|을|를|에|의|도|보다|부터|까지|으로|로|와|과)$/u;
function contentWords(text) {
  return (String(text ?? '').replace(CORRECTION_BOILERPLATE, ' ').match(/[가-힣]{2,}/gu) ?? [])
    .map((w) => w.replace(PARTICLE_TAIL, ''))
    .filter((w) => w.length >= 2);
}
function reflectsCorrection(shown, correction) {
  const words = contentWords(correction);
  if (!words.length) return null;
  const s = norm(shown);
  return words.some((w) => s.includes(norm(w)));
}
// ── 2026-09-20 대표 보정: 거절 재등장은 '낱말 재사용'이 아니라 '거절된 의미의 재등장'만 P0 후보다. 3단계 + 수동확인.
//   REJECTED_MEANING_REAPPEARED : 거절된 AI 요약과 문장 수준으로 크게 겹치고(bigram > 0.6) AI 가 만든 핵심 낱말이 다시 나옴 → P0 FAIL 후보(수동 확인 병행)
//   USER_SOURCE_AFTER_REJECTION : 겹치는 내용이 전부 사용자 원문(마음 날씨·답변·정정 문장)에 있음 → 정상, P0 아님
//   LEXICAL_REUSE_ONLY          : 일부 낱말만 겹치고(일반어·사용자 낱말) 거절된 핵심 의미는 재등장하지 않음 → 관찰
//   REVIEW_REQUIRED             : 문장 겹침은 낮은데 AI 가 만든 비일반 낱말이 다시 나옴 → 자동으로 의미 동일성을 단정할 수 없어 수동 확인
const GENERIC = new Set(['상황', '마음', '기분', '느낌', '생각', '요즘', '지금', '조금', '부분', '어떤', '이야기', '말씀', '때문', '정도', '자신', '이런', '그런', '같아요', '같네요', '느껴지', '느끼', '계신', '하신', '하시', '있으신', '일상', '감정', '현재', '이전', '내용', '경우', '가장', '특히', '더욱', '많이', '너무', '정말', '문제', '대해', '관련', '이후', '다음', '지치', '힘드', '힘든', '힘들', '걱정', '많고', '많아', '인해', '때문에', '무엇', '어떻게', '이유', '순간', '하루', '오늘', '스스로']);
const isGeneric = (w) => GENERIC.has(w) || [...GENERIC].some((g) => w.startsWith(g));
const userHas = (userNorm, w) => userNorm.includes(norm(w)) || userNorm.includes(norm(w).slice(0, 2));
function classifyAfterRejection(shown, rejected, userTexts) {
  if (!rejected) return null;
  const userNorm = userTexts.map(norm).join(' ');
  const shownNorm = norm(shown);
  const shared = contentWords(rejected).filter((w) => shownNorm.includes(norm(w)));
  if (!shared.length) return null;
  const aiOnly = shared.filter((w) => !userHas(userNorm, w));
  const aiCore = aiOnly.filter((w) => !isGeneric(w));
  const strong = overlap(shown, rejected) > 0.6;
  if (strong && aiCore.length) return { tier: 'REJECTED_MEANING_REAPPEARED', words: aiCore };
  if (strong && !aiOnly.length) return { tier: 'USER_SOURCE_AFTER_REJECTION', words: shared };
  if (aiCore.length) return { tier: 'REVIEW_REQUIRED', words: aiCore };
  if (!aiOnly.length && shared.some((w) => !isGeneric(w))) return { tier: 'USER_SOURCE_AFTER_REJECTION', words: shared };
  return { tier: 'LEXICAL_REUSE_ONLY', words: shared };
}
function questionSentence(t) {
  const parts = String(t ?? '').split(/(?<=[.?!…])\s+/).map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) if (/\?\s*$/.test(parts[i])) return parts[i];
  return String(t ?? '').trim();
}
const isBanmal = (t) => String(t || '').split(/(?<=[.?!…])\s+/).map((s) => s.trim())
  .filter((s) => s.length >= 3 && /[가-힣]/.test(s))
  .some((s) => !/(요|죠|쇼|니다|니까)\s*[?.!]?$/u.test(s));
// 잘린 응답 의심: 내용이 있는데 문장 끝 부호 없이 끝난다.
const looksTruncated = (t) => { const s = String(t ?? '').trim(); return s.length > 0 && !/[.?!…"'’”)]$/u.test(s); };

const TYPES = {
  A: { name: '짧은 자유입력', answers: ['돈 때문에', '일 때문에', '사람 때문에', '그냥 답답해', '요즘 좀 힘들어', '걱정돼', '기분이 이상해', '머리가 복잡해', '별일은 아닌데', '좀 지쳐'] },
  B: { name: '구체적 설명', answers: ['요즘 일이 너무 많고 돈 문제까지 겹쳐서 정신이 없어', '밤에 잠이 안 오고 아침마다 몸이 무거워요', '회사 사람들 눈치 보느라 말도 제대로 못 하고 집에 오면 지쳐요', '돈 나갈 데는 많은데 일은 줄어서 불안해요'] },
  C: { name: '애매함/모름', answers: ['잘 모르겠어', '아직 모르겠어', '애매해', '뭐라고 해야 할지 모르겠어', '생각이 정리가 안 돼'] },
  D: { name: '약한 정정', choice: 'alittle', text: '조금 달라요. 반은 맞고 반은 아닌 것 같아요. 사실은 일보다 사람이 더 힘들어요' },
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
const OUT = process.env.OUT_FILE || 'final100v3-results.jsonl', PROG = process.env.PROG_FILE || 'final100v3-progress.log';
const STATE = `${OUT}.state.json`;
const TEST_RUN_ID = process.env.TEST_RUN_ID || OUT.replace(/\.jsonl$/, '');
const STOP_FILE = `${OUT}.STOP`; // 무결성 감시기(integrity-watch.sh)나 검사기 자신이 만들면 즉시 멈춘다
let consecutiveStartErrors = 0;
const note = (l) => { appendFileSync(PROG, l + '\n'); console.log(l); };

// ── 상태 파일: 시작 시각 목록·완료 줄 수·거절 횟수·재시도 증거 ──
function loadState() {
  if (existsSync(STATE)) { try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { /* 새로 만든다 */ } }
  return { starts: [], rateRefusals: 0, aiRetryEnv: process.env.AI_RETRY ?? null, aiRetries: 0, aiRetryBlocked: 0, relogins: 0, launches: [] };
}
const state = loadState();
state.aiRetryEnv = process.env.AI_RETRY ?? null;
state.launches.push(new Date().toISOString());
const saveState = () => writeFileSync(STATE, JSON.stringify(state));
saveState();

// 이어 돌리기: 결과 파일의 줄 수가 곧 '실제 시작된 회차 수'다. START 를 주면 그 값을 우선한다.
const doneRows = existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).length : 0;
const START = process.env.START !== undefined ? Number(process.env.START) : doneRows;
if (START === 0) { writeFileSync(OUT, ''); if (!existsSync(PROG)) writeFileSync(PROG, ''); }
note(`[v3] 시작 회차=${START} 결과줄=${doneRows} AI_RETRY=${state.aiRetryEnv === null ? '미설정' : state.aiRetryEnv} 상태파일=${STATE}`);

// 서버 정책: 10분 안에 10번. 검사기는 여유를 두고 10분 20초 안에 9번까지만 연다.
const SERVER_WINDOW = DRY && DRY_WINDOW ? DRY_WINDOW : 10 * 60_000, MARGIN = DRY && DRY_WINDOW ? 200 : 20_000, HARNESS_MAX = DRY && Number(process.env.DRY_HARNESS_MAX) ? Number(process.env.DRY_HARNESS_MAX) : 9;
async function waitForStartSlot(i) {
  for (;;) {
    const now = Date.now();
    state.starts = state.starts.filter((t) => t > now - (SERVER_WINDOW + MARGIN));
    if (state.starts.length < HARNESS_MAX) return;
    const wait = state.starts[0] + SERVER_WINDOW + MARGIN - now;
    note(`제한 대기 ${Math.round(wait / 1000)}초 (${i}/${RUNS}, 최근 ${state.starts.length}회 시작)`);
    saveState();
    await sleep(Math.max(1000, wait));
  }
}

let { token } = DRY ? { token: 'dry' } : await login();
const counters = {
  요청수: 0, 정상응답: 0, 서버오류: 0, fallback: 0, 빈응답: 0, 반말: 0, 잘림의심: 0,
  반복질문: 0, 맥락무시: 0, 사용자질문무시: 0, 되물음후STEP증가: 0, 장문: 0, 거절의미재등장: 0, 정정무시: 0, 정정반영_확인불가: 0,
  시작거절_RATE_LIMITED: 0, AI재시도: 0, AI재시도차단: 0, 재로그인: 0,
};
const lat = [];

async function reloginOnAuthFail(res) {
  if (res.json?.ok !== false && res.http !== 401) return null;
  const code = String(res.json?.code ?? '');
  if (!/UNAUTHORIZED/.test(code) && res.http !== 401) return null;
  counters.재로그인++; state.relogins++;
  await sleep(1500);
  try { return (await login()).token; } catch { return null; }
}
const RETRYABLE = new Set(['AI_ERROR', 'ERROR']);
const AI_RETRY = process.env.AI_RETRY === '1';
async function askWithRetry(call, fn, body) {
  const first = await call(fn, body);
  if (first.json?.ok !== false || !RETRYABLE.has(first.json.code)) return first;
  if (!AI_RETRY) { counters.AI재시도차단++; state.aiRetryBlocked++; return first; }
  counters.AI재시도++; state.aiRetries++;
  await sleep(700);
  return call(fn, { ...body, token: body.token + '-r' });
}

for (let i = START; i < RUNS; i++) {
  if (existsSync(STOP_FILE)) { note(`STOP 파일 감지 → 검사 중단 (${i}/${RUNS}) 사유: ${readFileSync(STOP_FILE, 'utf8').trim().slice(0, 200)}`); break; }
  if (i > 0 && i % 20 === 0 && !DRY) { try { ({ token } = await login()); note('토큰 갱신'); } catch (e) { note('토큰 갱신 실패 ' + e.message); } }
  const keys = Object.keys(TYPES);
  const type = keys[(SPREAD ? i : Math.floor(i / 10)) % keys.length];
  const rec = { i, test_run_id: TEST_RUN_ID, type, turns: [], stuck: null, completed: false, flags: [], startedAt: null, conversationId: null, gsqVersion: null };
  const call = async (fn, body) => { const t0 = Date.now(); const r = await post(`${URL}/functions/v1/${fn}`, { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body); return { ms: Date.now() - t0, ...r }; };

  // ── 실제 시작을 보장한다: 서버가 RATE_LIMITED 면 결과 줄을 쓰지 않고 기다렸다 같은 회차를 다시 연다 ──
  let s = null;
  for (let attempt = 0; attempt < 12; attempt++) { // 상태 유실 시 서버 창(10분)을 넘길 만큼: 12 × 65초
    await waitForStartSlot(i);
    state.starts.push(Date.now()); saveState();
    s = await call('get-step-question', { action: 'start', mindText: MIND[i % MIND.length], token: tok(`s${i}-${attempt}`) });
    counters.요청수++;
    if (s.json?.code === 'RATE_LIMITED') {
      counters.시작거절_RATE_LIMITED++; state.rateRefusals++; saveState();
      note(`시작 거절(RATE_LIMITED) ${i}/${RUNS} attempt=${attempt} → 서버 창이 닫힐 때까지 기다린다`);
      await sleep(DRY && DRY_WINDOW ? 500 : 65_000);
      continue;
    }
    if (s.http === 401 || /UNAUTHORIZED/.test(String(s.json?.code ?? ''))) {
      const nt = await reloginOnAuthFail(s); if (nt) { token = nt; note(`재로그인 후 재시작 ${i}`); continue; }
    }
    break;
  }
  lat.push(s.ms);
  rec.startedAt = new Date().toISOString();
  if (s.json?.ok === false || !s.json?.conversationId) {
    rec.stuck = { at: 'start', code: s.json?.code, http: s.http }; counters.서버오류++;
    appendFileSync(OUT, JSON.stringify(rec) + '\n'); saveState();
    note(`${i + 1}/${RUNS} [${type}] 시작 실패 code=${s.json?.code} http=${s.http}`);
    consecutiveStartErrors++;
    if (consecutiveStartErrors >= 2) { writeFileSync(STOP_FILE, `연속 시작 실패 ${consecutiveStartErrors}회 code=${s.json?.code} at i=${i} ${new Date().toISOString()}`); note('연속 시작 실패 2회 → STOP 파일 생성, 검사 중단'); break; }
    continue;
  }
  const cid = s.json.conversationId;
  rec.conversationId = cid;
  consecutiveStartErrors = 0;
  rec.events = [];
  const ev = (o) => rec.events.push(o);
  let status = s.json.status, chose = false, lastUser = '', rejected = '';
  const userTexts = [MIND[i % MIND.length]];
  const asked = [];
  let pendingCorrection = null;

  for (let turn = 0; turn < 26 && !rec.completed; turn++) {
    const fn = EARLY.has(status) ? 'get-step-question' : 'echo-journey';
    let q = await askWithRetry(call, fn, { action: 'ask', conversationId: cid, token: tok(`q${i}-${turn}`) });
    counters.요청수++; lat.push(q.ms);
    if (q.http === 401 || /UNAUTHORIZED/.test(String(q.json?.code ?? ''))) {
      const nt = await reloginOnAuthFail(q);
      if (nt) { token = nt; q = await call(fn, { action: 'ask', conversationId: cid, token: tok(`q${i}-${turn}-relogin`) }); counters.요청수++; lat.push(q.ms); }
    }
    if (q.json?.ok === false) {
      rec.stuck = { at: status, turn, code: q.json.code, ms: q.ms, http: q.http };
      ev({ kind: 'blocked', turn, status, code: q.json.code, ms: q.ms });
      if (q.json.code === 'NO_CANDIDATE') counters.fallback++; else counters.서버오류++;
      break;
    }
    counters.정상응답++;
    const shown = String(q.json.understanding ?? q.json.question ?? '');
    rec.turns.push({ status, ms: q.ms, text: shown });
    ev({ kind: 'ask', turn, status, ms: q.ms, shown });
    if (!shown.trim()) { counters.빈응답++; rec.flags.push('빈응답'); }
    if (isBanmal(shown)) { counters.반말++; rec.flags.push('반말'); }
    if (looksTruncated(shown)) { counters.잘림의심++; rec.flags.push('잘림의심'); }
    if (shown.length > 220) { counters.장문++; rec.flags.push('장문'); }
    const qs = questionSentence(shown);
    if (asked.some((a) => overlap(qs, a) > 0.7)) { counters.반복질문++; rec.flags.push('반복질문'); }
    if (lastUser && lastUser.length >= 4 && overlap(qs, lastUser) === 0) { counters.맥락무시++; rec.flags.push('맥락무시'); }
    const rj = classifyAfterRejection(shown, rejected, userTexts);
    if (rj?.tier === 'REJECTED_MEANING_REAPPEARED') { counters.거절의미재등장++; rec.flags.push('거절재등장'); rec.flags.push(`거절재등장어:${rj.words.join('/')}`); }
    else if (rj) { counters[rj.tier] = (counters[rj.tier] ?? 0) + 1; rec.flags.push(rj.tier); }
    if (pendingCorrection) {
      const reflected = reflectsCorrection(shown, pendingCorrection);
      if (reflected === false) { counters.정정무시++; rec.flags.push('정정무시'); }
      if (reflected === null) { counters.정정반영_확인불가++; rec.flags.push('정정반영_확인불가'); }
      pendingCorrection = null;
    }
    if (qs) asked.push(qs);
    if (q.json.status === 'report_ready' || q.json.status === 'report_done') { rec.completed = true; break; }

    if (q.json.understanding) {
      const t = TYPES[type];
      const choice = !chose && t.choice ? t.choice : 'agree';
      const text = !chose && t.choice ? t.text : '';
      if (choice === 'no') rejected = String(q.json.understanding);
      if (text) userTexts.push(text);
      if (choice === 'alittle' || choice === 'explain') pendingCorrection = text;
      chose = true;
      const c = await call(fn, { action: 'choose', conversationId: cid, choice, text, token: tok(`c${i}-${turn}`) });
      counters.요청수++; lat.push(c.ms);
      if (c.json?.ok === false) { rec.stuck = { at: 'choose', code: c.json.code, http: c.http }; counters.서버오류++; break; }
      ev({ kind: 'choose', turn, choice, text, understanding: String(q.json.understanding), statusBefore: status, statusAfter: c.json.status, ms: c.ms });
      lastUser = text || '맞아요';
      status = c.json.status; continue;
    }

    const t = TYPES[type];
    const answer = t.answers ? t.answers[turn % t.answers.length] : PLAIN[turn % PLAIN.length];
    const isAskBack = /\?$/.test(answer) || type === 'G' || type === 'H';
    const statusBefore = status;
    const a = await call(fn, { action: 'answer', conversationId: cid, answer, token: tok(`a${i}-${turn}`) });
    counters.요청수++; lat.push(a.ms);
    if (a.json?.ok === false) { rec.stuck = { at: `answer:${status}`, code: a.json.code, http: a.http }; counters.서버오류++; break; }
    ev({ kind: 'answer', turn, answer, isAskBack, statusBefore, statusAfter: a.json.status, ms: a.ms });
    userTexts.push(answer);
    lastUser = answer;
    status = a.json.status;
    if (isAskBack && status !== statusBefore) { counters.되물음후STEP증가++; rec.flags.push('되물음후STEP증가'); }
    if (isAskBack) {
      const next = await askWithRetry(call, fn, { action: 'ask', conversationId: cid, token: tok(`r${i}-${turn}`) });
      counters.요청수++; lat.push(next.ms);
      if (next.json?.ok === false) { rec.stuck = { at: `askback:${status}`, code: next.json.code, http: next.http }; if (next.json.code === 'NO_CANDIDATE') counters.fallback++; else counters.서버오류++; break; }
      const reply = String(next.json.question ?? '');
      rec.turns.push({ status, ms: next.ms, text: reply, askback: true });
      ev({ kind: 'askbackReply', turn, question: answer, reply, status, ms: next.ms });
      const head = reply.split('\n\n')[0] ?? '';
      if (!head.trim() || /^[^?]*\?\s*$/.test(head.trim())) { counters.사용자질문무시++; rec.flags.push('사용자질문무시'); }
      if (isBanmal(reply)) { counters.반말++; rec.flags.push('반말'); }
      if (looksTruncated(reply)) { counters.잘림의심++; rec.flags.push('잘림의심'); }
      status = next.json.status;
    }
    if (status === 'report_ready' || status === 'report_done') rec.completed = true;
  }
  if (!rec.completed && !rec.stuck) rec.stuck = { at: rec.turns.at(-1)?.status ?? status, code: 'NEVER_FINISHED' };
  appendFileSync(OUT, JSON.stringify(rec) + '\n');
  state.counters = counters; saveState();
  note(`${i + 1}/${RUNS} [${type} ${TYPES[type].name}] 완주=${rec.completed} 문장=${rec.turns.length} 표시=${rec.flags.join(',') || '-'} ${rec.stuck ? '막힘=' + rec.stuck.code + '@' + rec.stuck.at : ''}`);
}

lat.sort((a, b) => a - b);
const q = (p) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] : 0;
note('\n=== 이번 구간 속도 ===');
note(`표본 ${lat.length}  p50=${q(0.5)}ms  p75=${q(0.75)}ms  p95=${q(0.95)}ms  최대=${lat[lat.length - 1] ?? 0}ms`);
note('\n=== 이번 구간 품질 ===');
for (const [k, v] of Object.entries(counters)) note(`${k}: ${v}`);
state.counters = counters; saveState();
