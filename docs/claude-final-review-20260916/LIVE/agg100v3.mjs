// 최종 100회 v3 집계 — 2026-09-20 대표 지시 §12 항목을 결과 파일 + 상태 파일에서 센다.
// 서버 쪽 사유(correction_unreflected·grounded_fallback·AbortError·openai_http·timeout)는 운영 로그에서 따로 센다.
import { readFileSync, existsSync } from 'node:fs';
const file = process.argv[2];
const rows = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const state = existsSync(`${file}.state.json`) ? JSON.parse(readFileSync(`${file}.state.json`, 'utf8')) : null;
const isBanmal = (t) => String(t || '').split(/(?<=[.?!…])\s+/).map((s) => s.trim())
  .filter((s) => s.length >= 3 && /[가-힣]/.test(s))
  .some((s) => !/(요|죠|쇼|니다|니까)\s*[?.!]?$/u.test(s));
const looksTruncated = (t) => { const s = String(t ?? '').trim(); return s.length > 0 && !/[.?!…"'’”)]$/u.test(s); };
const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
function bigrams(s) { const n = norm(s), out = new Set(); for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; }
function overlap(a, b) { const x = bigrams(a), y = bigrams(b); if (!x.size || !y.size) return 0; let c = 0; for (const g of x) if (y.has(g)) c++; return c / Math.min(x.size, y.size); }
const CORRECTION_BOILERPLATE = /(?:조금\s*달라요|그게\s*아니에요|제가\s*직접\s*설명할게요|아니요|아니에요|반은\s*맞고\s*반은\s*아닌\s*것\s*같아요|사실은)/gu;
const PARTICLE_TAIL = /(?:이|가|은|는|을|를|에|의|도|보다|부터|까지|으로|로|와|과)$/u;
function contentWords(text) {
  return (String(text ?? '').replace(CORRECTION_BOILERPLATE, ' ').match(/[가-힣]{2,}/gu) ?? []).map((w) => w.replace(PARTICLE_TAIL, '')).filter((w) => w.length >= 2);
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
function rejudgeRejected(r) {
  let rejected = ''; const userTexts = [MIND[r.i % MIND.length]]; const out = { REJECTED_MEANING_REAPPEARED: [], USER_SOURCE_AFTER_REJECTION: [], LEXICAL_REUSE_ONLY: [], REVIEW_REQUIRED: [] };
  for (const e of (r.events ?? [])) {
    if (e.kind === 'ask' || e.kind === 'askbackReply') {
      const shown = e.kind === 'ask' ? e.shown : e.reply;
      const c = classifyAfterRejection(shown, rejected, userTexts);
      if (c) out[c.tier].push(`${r.i}@${e.status}:${c.words.join('/')}`);
    }
    if (e.kind === 'choose') { if (e.choice === 'no') rejected = String(e.understanding ?? ''); if (e.text) userTexts.push(e.text); }
    if (e.kind === 'answer') userTexts.push(e.answer);
  }
  return out;
}
const MIND = ['맑지만 걱정이야 ㅠ', '요즘 너무 지쳐', '돈 걱정이 많아', '일이 너무 많아', '사람이 힘들어'];
const GSQ = new Set(['step1', 'step2', 'understanding', 'followup']);
const lat = [];
let turns = 0, askback = 0, 질문무시 = 0, 빈응답 = 0, 반말 = 0, 잘림 = 0;
for (const r of rows) {
  for (const t of (r.turns ?? [])) { turns++; if (typeof t.ms === 'number') lat.push(t.ms); if (!String(t.text ?? '').trim()) 빈응답++; if (isBanmal(t.text)) 반말++; if (looksTruncated(t.text)) 잘림++; }
  for (const e of (r.events ?? [])) {
    if (typeof e.ms === 'number' && e.kind !== 'ask') lat.push(e.ms);
    if (e.kind === 'askbackReply') { askback++; const head = (String(e.reply ?? '').split('\n\n')[0] ?? '').trim(); if (!head || /^[^?]*\?\s*$/.test(head)) 질문무시++; }
  }
}
lat.sort((a, b) => a - b);
const p = (q) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0;
const started = rows.filter((r) => !(r.stuck && r.stuck.at === 'start'));
const stuck = rows.filter((r) => r.stuck);
const codes = {}, flags = {};
for (const r of rows) { if (r.stuck) { const k = `${r.stuck.code}@${r.stuck.at}`; codes[k] = (codes[k] ?? 0) + 1; } for (const f of (r.flags ?? [])) flags[f] = (flags[f] ?? 0) + 1; }
const nc = stuck.filter((r) => r.stuck.code === 'NO_CANDIDATE');
const ncGsq = nc.filter((r) => GSQ.has(String(r.stuck.at).replace(/^askback:/, ''))).length;
const ncEj = nc.length - ncGsq;
const cnt = (re) => stuck.filter((r) => re.test(String(r.stuck.code))).length;
const 접근거절 = cnt(/UNAUTHORIZED|FORBIDDEN/);
const 제품중단 = stuck.filter((r) => r.stuck.at !== 'start' && !/UNAUTHORIZED|FORBIDDEN/.test(String(r.stuck.code))).length;
const byType = {};
for (const r of rows) { byType[r.type] = byType[r.type] ?? { n: 0, ok: 0 }; byType[r.type].n++; if (r.completed) byType[r.type].ok++; }
console.log(`결과 줄(=실제 시작 회차)   ${rows.length}`);
console.log(`실제 시작 성공            ${started.length}  (start 실패 ${rows.length - started.length})`);
console.log(`완주                     ${rows.filter((r) => r.completed).length}`);
console.log(`중단 전체                 ${stuck.length}  = 제품 경로 ${제품중단} + 접근거절(401/403) ${접근거절} + start 실패 ${rows.length - started.length}`);
console.log(`AI 턴(화면 문장)           ${turns}`);
console.log(`되물음 턴                 ${askback}   사용자질문무시 ${질문무시}`);
console.log(`정정무시                  ${flags['정정무시'] ?? 0}   정정반영_확인불가 ${flags['정정반영_확인불가'] ?? 0}`);
const tiers = { REJECTED_MEANING_REAPPEARED: [], USER_SOURCE_AFTER_REJECTION: [], LEXICAL_REUSE_ONLY: [], REVIEW_REQUIRED: [] };
for (const r of rows) { const j = rejudgeRejected(r); for (const k of Object.keys(tiers)) tiers[k].push(...j[k]); }
console.log(`거절 후 판정(3단계+수동확인, 검사기 표시 거절재등장=${flags['거절재등장'] ?? 0})`);
console.log(`  1 REJECTED_MEANING_REAPPEARED (P0 후보)   ${tiers.REJECTED_MEANING_REAPPEARED.length}${tiers.REJECTED_MEANING_REAPPEARED.length ? ' → ' + tiers.REJECTED_MEANING_REAPPEARED.join(', ') : ''}`);
console.log(`  2 USER_SOURCE_AFTER_REJECTION (정상)      ${tiers.USER_SOURCE_AFTER_REJECTION.length}`);
console.log(`  3 LEXICAL_REUSE_ONLY (관찰)               ${tiers.LEXICAL_REUSE_ONLY.length}`);
console.log(`  R REVIEW_REQUIRED (수동 확인 필요)         ${tiers.REVIEW_REQUIRED.length}${tiers.REVIEW_REQUIRED.length ? ' → ' + tiers.REVIEW_REQUIRED.join(', ') : ''}`);
const ids = rows.map((r) => r.i); const dup = ids.length - new Set(ids).size;
const timeouts = stuck.filter((r) => r.stuck.http === 0 || (r.stuck.code === 'BAD_JSON' && r.stuck.http === 0)).length;
console.log(`중복 저장(같은 회차 2줄) ${dup}   클라이언트 timeout(http=0) ${timeouts}${state ? `   중단→재개 ${Math.max(0, state.launches.length - 1)}회(기동 ${state.launches.length}회, 회차 연속성 ${ids.every((v, k) => k === 0 || v === ids[k - 1] + 1) ? '정상' : '깨짐'})` : ''}`);
console.log(`NO_CANDIDATE             ${nc.length}  (gsq ${ncGsq} / ej ${ncEj})`);
console.log(`AI_ERROR ${cnt(/^AI_ERROR$/)}   BAD_JSON ${cnt(/^BAD_JSON$/)}   NEVER_FINISHED ${cnt(/NEVER_FINISHED/)}   기타 ${JSON.stringify(codes)}`);
console.log(`빈 응답 ${빈응답}   잘림 의심 ${잘림}   반말 ${반말}   되물음후STEP증가 ${flags['되물음후STEP증가'] ?? 0}`);
console.log(`표시 전체: ${JSON.stringify(flags)}`);
console.log(`지연 표본 ${lat.length}  p50=${p(0.5)}ms p75=${p(0.75)}ms p95=${p(0.95)}ms 최대=${lat.at(-1)}ms`);
console.log(`6초 초과 ${lat.filter((x) => x > 6000).length} (${(100 * lat.filter((x) => x > 6000).length / (lat.length || 1)).toFixed(1)}%)  9초 초과 ${lat.filter((x) => x > 9000).length} (${(100 * lat.filter((x) => x > 9000).length / (lat.length || 1)).toFixed(1)}%)  10초 초과 ${lat.filter((x) => x > 10000).length} (${(100 * lat.filter((x) => x > 10000).length / (lat.length || 1)).toFixed(1)}%)`);
console.log(`유형별 완주: ${Object.entries(byType).map(([k, v]) => `${k}=${v.ok}/${v.n}`).join(' ')}`);
if (state) console.log(`상태파일: AI_RETRY=${state.aiRetryEnv === null ? '미설정' : state.aiRetryEnv}  AI재시도=${state.aiRetries}  AI재시도차단=${state.aiRetryBlocked}  시작거절(RATE_LIMITED)=${state.rateRefusals}  재로그인=${state.relogins}  기동횟수=${state.launches.length}`);
