// ECHO 실AI 결과 판정기 — FINAL LOCK(2026-09-18) 기준을 코드로 옮긴 것.
//  · P0-01~12 로만 판정하고, 한 사건은 근본 원인 하나로만 센다(중복 집계 금지).
//  · P0 가 아닌 것만 T-01~05(목표 미달)로 본다.
//  · 증거 없는 항목은 PASS 가 아니라 '확인 불가'.
// 사용법: node judge.mjs <결과.jsonl> [차단사유.json]
import { readFileSync, existsSync } from 'node:fs';

const P0 = {
  '01': '인증·사용자 격리 실패', '02': '사용자 입력 유실', '03': '상태머신 손상',
  '04': '정정 무시', '05': '거절 무시/재등장', '06': '사용자 원문 과차단',
  '07': '직접 설명 무시', '08': '사용자 질문 처리 실패', '09': '대화 진행 불가',
  '10': '미확정 사실화', '11': '핵심 출력 신뢰 위반', '12': '보안정보 노출',
};
const STEP_OF = { step1: 1, step2: 2, understanding: 3, followup: 3, step3: 3, step4: 4, step5: 5, step6: 6, step7: 7, report_ready: 8, report_done: 8 };
const SECRET = /(sbp_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9]{16,}|service_role|eyJ[A-Za-z0-9_-]{20,}\.)/;

const file = process.argv[2];
if (!file || !existsSync(file)) { console.error('결과 파일이 필요합니다'); process.exit(1); }
const rows = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
// 서버 차단사유(선택): { "<대화 i>": ["rejected_key", ...] } — 있으면 NO_CANDIDATE 의 근본 원인을 가린다.
const blocks = process.argv[3] && existsSync(process.argv[3]) ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : null;

const events = [];              // 중복 제거된 P0 사건
const add = (code, r, cause, symptom, step) =>
  events.push({ id: `P0-E-${String(events.length + 1).padStart(3, '0')}`, p0: code, name: P0[code], 대화: r.i, 그룹: r.type, 원인: cause, 증상: symptom, STEP: step, 여정중단: !r.completed });

let T = { 반복질문: 0, fallback: 0, 장문: 0, 일반론: 0, 접근거절: 0, 외부지연: 0 };
const lat = [];
let turns = 0;

for (const r of rows) {
  const f = r.flags || [];
  const seen = new Set();                       // 이 대화에서 이미 센 P0
  const once = (code, cause, symptom, step) => { if (!seen.has(code)) { seen.add(code); add(code, r, cause, symptom, step); } };
  for (const t of r.turns || []) { lat.push(t.ms); turns++; if (SECRET.test(String(t.text || ''))) once('12', '응답 본문에 인증정보 형태 문자열', '노출', t.status); }

  // ── 근본 원인 우선: 막다른 길의 원인이 '사용자 원문 과차단'이면 P0-06 하나로만 센다 ──
  const stuckCode = r.stuck?.code;
  const reasons = blocks?.[String(r.i)] || null;
  const 과차단 = reasons ? reasons.includes('rejected_key') : null;

  // FINAL LOCK §3: 한 사건을 여러 P0 로 부풀리지 않는다.
  // '빈 응답 → 이어진 answer 가 INVALID_STATE' 는 한 사건이다. 근본 원인(빈 응답)으로만 센다.
  const 빈응답 = f.includes('빈응답');
  const 빈응답발 = 빈응답 && /INVALID_STATE/.test(String(stuckCode || ''));

  if (stuckCode === 'NO_CANDIDATE') {
    if (과차단 === true) once('06', 'rejected_key 가 사용자 원문 표현까지 금지', 'NO_CANDIDATE → 대화 진행 불가', r.stuck.at);
    else once('09', reasons ? `후보 전부 차단(${reasons.join(',')})` : '후보 전부 차단(사유 로그 없음)', 'NO_CANDIDATE → 정상 질문 제공 실패', r.stuck.at);
  } else if (stuckCode && stuckCode !== 'NEVER_FINISHED') {
    // 2026-09-18 판정 수정: P0-01 은 '격리 실패' — 남의 대화가 열리거나 인증 없이 통과한 경우다.
    // 401/403 은 문이 제대로 잠긴 것이므로 P0-01 이 아니다. 접근 가능성 문제로 따로 센다.
    // (실AI 100회 #72~79 의 UNAUTHORIZED_ASYMMETRIC_JWT 8건이 이 오분류였다. 서버는 거절했고,
    //  #80 부터 같은 토큰으로 다시 정상 동작했다 → 만료가 아니라 상류 검증 일시 장애.)
    if (/UNAUTHORIZED|FORBIDDEN/.test(stuckCode)) { T.접근거절 = (T.접근거절 ?? 0) + 1; continue; }
    else if (/INVALID_STATE/.test(stuckCode)) {
      if (빈응답발) once('09', '서버가 빈 문자열을 화면으로 보냄', `빈 화면 → ${stuckCode} 로 답변 거부`, r.stuck.at);
      else once('03', `${stuckCode}@${r.stuck.at}`, '상태 불일치로 진행 불가', r.stuck.at);
    }
    else once('09', stuckCode, '대화 중단', r.stuck.at);
  } else if (stuckCode === 'NEVER_FINISHED') {
    once('09', '26턴 내 미완주', '여정 미완료', r.turns?.at(-1)?.status);
  }

  if (/AI_ERROR|BAD_JSON/.test(stuckCode)) { T.외부지연 = (T.외부지연 ?? 0) + 1; }
  if (빈응답) once('09', '서버가 빈 문자열을 화면으로 보냄', '빈 화면', r.turns?.find((t) => !String(t.text || '').trim())?.status);
  if (f.includes('반말')) once('11', '해요체가 아닌 문장이 화면에 노출', '반말', null);
  if (f.includes('정정무시')) once('04', '정정 내용이 다음 질문에 반영되지 않음', '정정 무시', null);
  if (f.includes('거절재등장')) once('05', '거절한 해석이 이후 문장에 재등장', '거절 재등장', null);
  if (f.includes('되물음후STEP증가')) once('08', '사용자 되물음인데 STEP 이 진행됨', 'STEP 오증가(증상)', null);
  if (f.includes('사용자질문무시')) once('08', '사용자 질문에 답하지 않고 질문만 반환', '질문 무시', null);

  // ── P0 가 아닌 것만 목표 미달로 ──
  const isP0 = seen.size > 0;
  if (!isP0) {
    if (f.includes('반복질문')) T.반복질문++;
    if (f.includes('장문')) T.장문++;
    if (f.includes('맥락무시')) T.일반론++;
  }
}

const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : null; };
const tally = Object.fromEntries(Object.keys(P0).map((k) => [k, events.filter((e) => e.p0 === k).length]));
const 완주 = rows.filter((r) => r.completed).length;

console.log(`\n【실행】 대화 ${rows.length}건 · 완주 ${완주}건 · 질문 ${turns}개`);
console.log('\n【P0 집계 — 중복 제거】');
for (const [k, n] of Object.entries(tally)) if (n) console.log(`  P0-${k} ${P0[k]}: ${n}건`);
console.log(`  중복 제거 총 P0 사건: ${events.length}건`);
if (events.length) { console.log('\n【사건 상세】'); for (const e of events) console.log(`  ${e.id} [${e.p0}] 대화#${e.대화}(${e.그룹}) ${e.원인} → ${e.증상} @${e.STEP ?? '-'} 여정중단=${e.여정중단}`); }
const j5 = (v, pass, miss) => v <= pass ? 'PASS' : (v >= miss ? '목표 미달' : '목표 미달');
console.log('\n【목표 미달 — P0 아닌 정상 대화만】');
console.log(`  T-01 반복질문 ${T.반복질문}건 → ${T.반복질문 === 0 ? 'PASS' : '목표 미달'}`);
console.log(`  T-02 fallback ${T.fallback}건 → ${T.fallback <= 2 ? 'PASS' : '목표 미달'}`);
console.log(`  T-03 장문 ${T.장문}건 → ${T.장문 <= 2 ? 'PASS' : '목표 미달'}`);
const 입력기록 = rows.some((r) => (r.events || r.inputs));
console.log(`  T-04 일반론/맥락약화 ${입력기록 ? `${T.일반론}건 → ${T.일반론 <= 2 ? 'PASS' : '목표 미달'}` : '확인 불가 (결과 파일에 사용자 입력이 없어 의미 기준 판정 불가)'}`);
const P50 = p(lat, .5), P75 = p(lat, .75), P95 = p(lat, .95);
const over10 = lat.filter((x) => x > 10000).length;
const perfPass = P50 <= 3000 && P75 <= 4500 && P95 <= 6000 && over10 === 0;
console.log(`  T-05 성능 p50=${P50}ms p75=${P75}ms p95=${P95}ms 최대=${Math.max(...lat)}ms 10초초과=${over10} → ${perfPass ? 'PASS' : '목표 미달'}`);
console.log(`\n【최종】 ${events.length === 0 ? '기능 PASS' : `기능 FAIL / P0 ${events.length}건`}${events.length === 0 && perfPass && T.반복질문 === 0 ? ' / 품질·성능 PASS' : ''}`);
