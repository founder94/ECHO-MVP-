// doit-understanding — A구조 자기이해 자산 서버 상태머신
//
// 원칙
// - 모든 요청은 getUser() 실검증 → auth.uid() 소유권 확인.
// - LLM은 후보만 만든다. confirmed/corrected/rejected/상태 전이는 서버(DB 함수)만 결정.
// - 거절(rejected)한 해석은 같은 뜻·같은 문장으로 재등장 금지 (bigram + LLM 의미 판정 이중 차단).
// - 프론트는 테이블 직접 INSERT/UPDATE/DELETE 불가(RLS: SELECT only). 쓰기는 DB 함수(doit_apply_*)로.
// - 로그에 사용자 원문·토큰·API키 절대 미기록.
//
// 멱등: 같은 (user_id, request_id) 는 pg_advisory_xact_lock + payload_hash 비교로 한 번만 반영.

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const CATEGORIES = ["value", "pattern", "memory"] as const;
type Category = (typeof CATEGORIES)[number];

const ACTIONS = new Set([
  "record_list", "record_create", "record_update",
  "insight_list", "insight_generate",
  "insight_confirm", "insight_correct", "insight_reject", "insight_self",
  "handoff", "admin_read",
]);

const LIMITS = {
  BODY_MAX_BYTES: 64 * 1024,
  RATE_WINDOW_MS: 60_000,
  RATE_MAX_PER_WINDOW: 60,
  RECORD_MAX: 2000,
  EMOTION_MAX: 60,
  INSIGHT_MAX: 200,
  MEANING_MAX: 120,
  KEY_MAX: 24,
  KEYS_MAX: 6,
  CANDIDATES_PER_CATEGORY: 3,
  ATTEMPTS: 3,
  REPEAT_SIM: 0.6,
  REPEAT_OVERLAP: 0.7,
  REJECT_SIM: 0.5,
  REJECT_OVERLAP: 0.6,
} as const;

const CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  INVALID_STATE: "INVALID_STATE",
  STALE_REVISION: "STALE_REVISION",
  DUPLICATE_REQUEST: "DUPLICATE_REQUEST",
  REQUEST_CONFLICT: "REQUEST_CONFLICT",
  IN_FLIGHT: "IN_FLIGHT",
  NO_CANDIDATE: "NO_CANDIDATE",
  AI_NOT_CONFIGURED: "AI_NOT_CONFIGURED",
  AI_ERROR: "AI_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  TOO_LARGE: "TOO_LARGE",
  ERROR: "ERROR",
} as const;

const RECORD_STATUS = ["confirmed", "corrected", "rejected"] as const;

const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// 호출 주소는 환경변수로 바꿀 수 없다(비공식 게이트웨이 경유 금지).

// 시간 예산 — 고정 25초 단일 timeout 대신, 요청에 남은 시간을 보고 각 AI 호출의 timeout 을 정한다.
// 후보 생성 → 의미 검사 → (필요 시) 구제 까지가 한 요청 안에서 끝나야 한다.
const BUDGET = {
  REQUEST_MS: 50_000,        // 요청 1건 전체 예산
  RESERVE_WRITE_MS: 4_000,   // 마지막 DB 저장(RPC) 몫
  RESERVE_RESCUE_MS: 6_000,  // 구제 단계 몫
  GEN_MAX_MS: 20_000,        // 후보 생성 1회 상한
  JUDGE_MAX_MS: 9_000,       // 의미/근거 판정 1회 상한
  MIN_CALL_MS: 3_000,        // 이보다 적게 남으면 호출하지 않는다
  CONFIRMED_MAX: 12,         // 다음 생성에 넣을 확정 의미 개수
  GROUND_COVERAGE: 0.5,      // 후보가 근거에 덮이는 최소 비율(글자 기준 빠른 통과선)
  RESCUE_QUOTE_MAX: 40,      // 구제 질문에 인용할 사용자 원문 최대 길이
} as const;

// 진단 사유 — 왜 후보가 막혔는지/구제됐는지 구분한다. 사용자 원문·비밀값은 절대 넣지 않는다.
const REASON = {
  GENERATED: "candidate_generated",
  NOT_GROUNDED: "candidate_rejected_not_grounded",
  REJECTED_LEXICAL: "candidate_rejected_lexical",
  REJECTED_SEMANTIC: "candidate_rejected_semantic",
  RESCUED: "candidate_rescued",
  PARSE_FAILURE: "parse_failure",
  TIMEOUT: "timeout",
  BUDGET_EXHAUSTED: "budget_exhausted",
  NO_CANDIDATE: "no_candidate",
  SUCCESS: "success",
} as const;

const MAX_TOKENS = 4096;
const TEMPERATURE = 0.2;
const TOP_P = 0.9;
const PERSONA =
  "너는 사용자가 스스로를 이해하도록 돕는 동반자 'DO IT'이다. 사용자가 실제로 말한 내용만 근거로 하고 추측·판단·진단·평가를 하지 않는다. 가치·패턴·선택 기억을 후보로만 제시한다.";

type Json = Record<string, unknown>;
type Db = SupabaseClient;

const corsHeaders = (origin: string | null): Record<string, string> => {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin
    : ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
const fail = (code: string, error: string, status = 200, origin: string | null = null) =>
  json({ ok: false, code, error }, status, origin);

// ── 텍스트 유사도 ──
const normalizeKey = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
function bigrams(s: string): Set<string> {
  const c = normalizeKey(s);
  const set = new Set<string>();
  for (let i = 0; i < c.length - 1; i++) set.add(c.slice(i, i + 2));
  return set;
}
function overlapStats(a: string, b: string): { sim: number; overlap: number } {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return { sim: 0, overlap: 0 };
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return { sim: inter / (A.size + B.size - inter), overlap: inter / Math.min(A.size, B.size) };
}
function looksSame(a: string, b: string, sim: number, overlap: number): boolean {
  const s = overlapStats(a, b);
  return s.sim > sim || s.overlap > overlap;
}
function cleanKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== "string") continue;
    const n = normalizeKey(k).slice(0, LIMITS.KEY_MAX);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= LIMITS.KEYS_MAX) break;
  }
  return out;
}
function extractJson(text: string): unknown {
  const t = text.trim();
  for (const cand of [t, t.match(/\{[\s\S]*\}/)?.[0], t.match(/\[[\s\S]*\]/)?.[0]]) {
    if (!cand) continue;
    try { return JSON.parse(cand); } catch { /* next */ }
  }
  return null;
}

// ── 시간 예산 ──
interface Budget { deadline: number }
const newBudget = (): Budget => ({ deadline: Date.now() + BUDGET.REQUEST_MS });
const remainingMs = (b: Budget): number => b.deadline - Date.now();
// 남은 시간에서 뒤에 쓸 몫(reserve)을 뺀 만큼만 이번 호출에 준다. 모자라면 호출하지 않는다(null).
function callBudget(b: Budget, maxMs: number, reserveMs: number): number | null {
  const left = remainingMs(b) - reserveMs;
  if (left < BUDGET.MIN_CALL_MS) return null;
  return Math.min(maxMs, left);
}

// AI 호출이 시간 초과로 끊긴 경우를 다른 실패와 구분한다.
class AiTimeout extends Error {
  constructor() { super("OPENAI_TIMEOUT"); }
}

interface Rejected { text: string; keys: string[] }

function blockedByOverlap(candidateText: string, candidateKeys: string[], rejected: Rejected[]): boolean {
  for (const r of rejected) {
    if (looksSame(candidateText, r.text, LIMITS.REJECT_SIM, LIMITS.REJECT_OVERLAP)) return true;
    for (const k of candidateKeys) {
      for (const rk of r.keys) {
        if (k === rk || (k.length >= 2 && rk.length >= 2 && (k.includes(rk) || rk.includes(k)))) return true;
      }
    }
  }
  return false;
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: TEMPERATURE, top_p: TOP_P, max_tokens: MAX_TOKENS,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("OPENAI_HTTP");
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("OPENAI_EMPTY");
    return text;
  } catch (e) {
    if (timedOut) throw new AiTimeout();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

interface Candidate { category: Category; text: string; meaning: string; keys: string[] }
function parseCandidates(raw: string): Candidate[] {
  const o = extractJson(raw) as Json | null;
  const list = Array.isArray(o) ? o : o && Array.isArray(o.candidates) ? o.candidates as unknown[] : null;
  if (!list) return [];
  const out: Candidate[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const x = item as Json;
    const category = typeof x.category === "string" && (CATEGORIES as readonly string[]).includes(x.category) ? x.category as Category : "";
    const text = typeof x.text === "string" ? x.text.trim().slice(0, LIMITS.INSIGHT_MAX) : "";
    if (!category || !text) continue;
    out.push({
      category,
      text,
      meaning: typeof x.meaning === "string" ? x.meaning.trim().slice(0, LIMITS.MEANING_MAX) : "",
      keys: cleanKeys(x.keys),
    });
  }
  return out;
}

async function judgeSemanticBlock(apiKey: string, model: string, candidates: Candidate[], rejected: Rejected[], timeoutMs: number): Promise<Set<number>> {
  const blocked = new Set<number>();
  if (!candidates.length || !rejected.length) return blocked;
  const system = `${PERSONA} 두 문장이 '같은 뜻'인지 판정하라. 표현이 달라도 의미가 같으면 같은 뜻으로 본다. 입력 후보와 거절된 해석을 비교해, 같은 뜻인 후보의 인덱스 배열만 {"blocked":[0,2,...]} JSON으로 출력하라. 같은 뜻이 없으면 {"blocked":[]} 로 출력한다.`;
  const user = JSON.stringify({
    candidates: candidates.map((c, i) => ({ i, text: c.text, meaning: c.meaning })),
    rejected: rejected.map((r) => r.text),
  });
  const raw = await callOpenAI(apiKey, model, system, user, timeoutMs);
  const o = extractJson(raw) as Json | null;
  if (!o || !Array.isArray(o.blocked)) throw new Error("SEMANTIC_PARSE_FAILED");
  const arr = o.blocked as unknown[];
  for (const x of arr) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= 0 && n < candidates.length) blocked.add(n);
  }
  return blocked;
}

// ── 확정 의미(CONFIRMED MEANING) ──
// 사용자가 "맞아요"로 확정했거나 직접 정정/작성한 내용. 다음 생성에서 AI 가 처음부터 다시 추측하지 않도록 넣는다.
interface Confirmed { text: string; kind: "corrected" | "self" | "confirmed" }

// 최신 것이 앞에 오도록 정렬한 뒤, 같은 뜻이 이미 있으면 뒤(오래된) 것을 버린다.
// → 최신 사용자 정정이 과거 confirmed 보다 항상 앞선다.
async function loadConfirmed(sb: Db, userId: string): Promise<Confirmed[]> {
  const { data, error } = await sb.from("doit_insights")
    .select("text, status, origin, updated_at")
    .eq("user_id", userId)
    .in("status", ["confirmed", "corrected"])
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw new Error("CONFIRMED_LOAD_FAILED");

  const rows = (data ?? []) as { text: string | null; status: string; origin: string; updated_at: string | null }[];
  // 최신순 정렬을 전송 계층에만 맡기지 않는다. 여기서 한 번 더 확정한다.
  rows.sort((a, b) => Date.parse(b.updated_at ?? "") - Date.parse(a.updated_at ?? ""));
  const out: Confirmed[] = [];
  for (const r of rows) {
    const t = (r.text ?? "").trim();
    if (!t) continue;
    // 이미 더 최신 항목이 같은 뜻을 담고 있으면 오래된 쪽은 넣지 않는다(충돌 시 최신 승리).
    if (out.some((k) => looksSame(k.text, t, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP))) continue;
    const kind: Confirmed["kind"] = r.status === "corrected" ? "corrected" : r.origin === "self" ? "self" : "confirmed";
    out.push({ text: t, kind });
    if (out.length >= BUDGET.CONFIRMED_MAX) break;
  }
  return out;
}

const KIND_LABEL: Record<Confirmed["kind"], string> = {
  corrected: "정정",
  self: "직접 설명",
  confirmed: "확인",
};

// ── 근거(GROUNDING) ──
// 후보가 사용자 원문 / 확정된 의미 안에 실제로 담겨 있는지 서버가 검사한다.
// 1단계는 글자 기반 빠른 통과선일 뿐이고, 통과하지 못한 후보는 버리지 않고 2단계 의미 판정으로 넘긴다.
// (글자가 똑같아야만 통과하는 단순 필터로 만들지 않기 위해서다.)
interface Grounding { normalized: string; grams: Set<string> }
function buildGrounding(lines: string[]): Grounding {
  const joined = lines.join("\n");
  return { normalized: normalizeKey(joined), grams: bigrams(joined) };
}
function groundedByOverlap(c: Candidate, g: Grounding): boolean {
  const A = bigrams(c.text);
  if (!A.size) return false;
  let inter = 0;
  A.forEach((x) => { if (g.grams.has(x)) inter++; });
  if (inter / A.size >= BUDGET.GROUND_COVERAGE) return true;
  for (const k of c.keys) {
    if (k.length >= 2 && g.normalized.includes(k)) return true;
  }
  return false;
}

// 남은 후보를 한 번에 물어 근거 있는 인덱스만 돌려받는다.
async function judgeGrounding(
  apiKey: string, model: string, candidates: Candidate[], groundLines: string[], timeoutMs: number,
): Promise<Set<number>> {
  const grounded = new Set<number>();
  if (!candidates.length) return grounded;
  const system = `${PERSONA} 각 후보가 아래 '근거'에 실제로 담긴 내용인지 판정하라. 표현이 달라도 근거에서 읽어낼 수 있으면 근거 있음이다. 근거에 없는 추측·일반론·새로 지어낸 사실은 근거 없음이다. 근거 있는 후보의 인덱스 배열만 {"grounded":[0,2,...]} JSON으로 출력하라. 하나도 없으면 {"grounded":[]} 로 출력한다.`;
  const user = JSON.stringify({
    candidates: candidates.map((c, i) => ({ i, text: c.text, meaning: c.meaning })),
    grounds: groundLines,
  });
  const raw = await callOpenAI(apiKey, model, system, user, timeoutMs);
  const o = extractJson(raw) as Json | null;
  if (!o || !Array.isArray(o.grounded)) throw new Error("GROUNDING_PARSE_FAILED");
  for (const x of o.grounded as unknown[]) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= 0 && n < candidates.length) grounded.add(n);
  }
  return grounded;
}

// ── 구제(RESCUE) ──
// 후보가 모두 막혔을 때 빈 화면 대신 돌려줄, 가장 보수적인 다음 질문.
// 거절한 의미를 되살리지 않고, 새로운 사실을 지어내지 않고, 원문을 길게 복사하지도 않는다.
interface Rescue { kind: "ai_question" | "quoted_question" | "generic_question"; text: string }

const GENERIC_RESCUE = "방금 남긴 기록에서 가장 마음에 남는 부분은 어디였나요?";

function quoteFromRecord(recordText: string): string {
  const first = recordText.split(/[\n.!?。]/).map((x) => x.trim()).find((x) => x.length > 0) ?? "";
  return first.slice(0, BUDGET.RESCUE_QUOTE_MAX);
}

function rescueBlocked(text: string, rejected: Rejected[]): boolean {
  return blockedByOverlap(text, cleanKeys([text]), rejected);
}

async function buildRescue(
  apiKey: string, model: string, recordText: string, rejected: Rejected[], budget: Budget,
): Promise<Rescue> {
  // 1) 예산이 남아 있으면 AI 에게 '기록 안에서만' 확인 질문 하나를 만들게 한다.
  const ms = callBudget(budget, BUDGET.JUDGE_MAX_MS, BUDGET.RESERVE_WRITE_MS);
  if (ms !== null) {
    try {
      const system = `${PERSONA} 아래 기록 안에 실제로 있는 내용만 가지고, 사용자에게 되물을 짧은 질문 1개를 만들어라. 새로운 사실·해석·평가를 덧붙이지 않는다. 기록을 길게 그대로 옮기지 않는다. {"question":"..."} JSON으로만 출력한다.`;
      const rejectedNote = rejected.length
        ? `\n[다시 꺼내지 말 것]\n${rejected.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}`
        : "";
      const raw = await callOpenAI(apiKey, model, system, `기록:\n${recordText}${rejectedNote}`, ms);
      const o = extractJson(raw) as Json | null;
      const q = typeof o?.question === "string" ? o.question.trim().slice(0, LIMITS.INSIGHT_MAX) : "";
      if (q && !rescueBlocked(q, rejected)) return { kind: "ai_question", text: q };
    } catch { /* 구제는 실패해도 아래 단계로 내려간다 */ }
  }

  // 2) AI 없이, 사용자 자신의 말 일부만 짧게 인용해 되묻는다.
  const quote = quoteFromRecord(recordText);
  if (quote) {
    const text = `방금 남긴 기록에서 "${quote}" 부분을 조금 더 들려주실 수 있을까요?`;
    if (!rescueBlocked(text, rejected)) return { kind: "quoted_question", text };
  }

  // 3) 아무것도 인용하지 않는 질문. 거절한 의미를 되살릴 수 없고 지어내는 것도 없다.
  return { kind: "generic_question", text: GENERIC_RESCUE };
}

// ── 후보 생성 파이프라인 ──
// 생성 → 근거 검사 → 거절/정정 검사 → 안전 후보 있으면 서버가 선택, 없으면 구제.
interface GenTrace {
  attempts: number;
  generated: number;
  dropped_not_grounded: number;
  dropped_rejected_lexical: number;
  dropped_rejected_semantic: number;
  survived: number;
  reasons: string[];
}
interface GenResult { candidates: Candidate[]; rescue: Rescue | null; trace: GenTrace }

async function generateInsights(args: {
  apiKey: string; model: string; recordText: string;
  rejected: Rejected[]; confirmed: Confirmed[]; budget: Budget;
}): Promise<GenResult> {
  const { apiKey, model, recordText, rejected, confirmed, budget } = args;

  const trace: GenTrace = {
    attempts: 0, generated: 0,
    dropped_not_grounded: 0, dropped_rejected_lexical: 0, dropped_rejected_semantic: 0,
    survived: 0, reasons: [],
  };
  const note = (r: string) => { if (!trace.reasons.includes(r)) trace.reasons.push(r); };

  const system = `${PERSONA} 다음 기록을 바탕으로 '가치(value)·패턴(pattern)·선택 기억(memory)' 각 카테고리에서 후보를 최대 ${LIMITS.CANDIDATES_PER_CATEGORY}개 만들어라. 각 후보는 {"category":"value|pattern|memory","text":"...","meaning":"핵심 의도 한 문장","keys":["명사구 2~5개"]} 형태이고, 전체를 {"candidates":[...]} JSON 객체로만 출력한다. 기록과 이미 확인된 내용에 실제로 담긴 것만 쓰고, 거절된 해석과 같은 뜻은 표현을 바꿔도 만들지 않는다.`;

  // 확정된 의미는 최신 것이 위에 온다. AI 가 이미 확인된 내용을 처음부터 다시 추측하지 않게 한다.
  const confirmedNote = confirmed.length
    ? `\n[이미 확인된 내용 — 위에 있을수록 최신이다. 다시 처음부터 추측하지 말 것]\n${confirmed.map((c, i) => `${i + 1}. (${KIND_LABEL[c.kind]}) ${c.text}`).join("\n")}`
    : "";
  const rejectedNote = rejected.length
    ? `\n[거절된 해석 — 같은 뜻으로 다시 만들지 말 것]\n${rejected.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}`
    : "";

  const groundLines = [recordText, ...confirmed.map((c) => c.text)];
  const grounding = buildGrounding(groundLines);

  for (let i = 0; i < LIMITS.ATTEMPTS; i++) {
    const genMs = callBudget(budget, BUDGET.GEN_MAX_MS, BUDGET.RESERVE_RESCUE_MS + BUDGET.RESERVE_WRITE_MS);
    if (genMs === null) { note(REASON.BUDGET_EXHAUSTED); break; }

    trace.attempts += 1;
    let cands: Candidate[];
    try {
      const raw = await callOpenAI(apiKey, model, system, `기록:\n${recordText}${confirmedNote}${rejectedNote}`, genMs);
      cands = parseCandidates(raw);
    } catch (e) {
      note(e instanceof AiTimeout ? REASON.TIMEOUT : REASON.PARSE_FAILURE);
      continue;
    }
    if (!cands.length) { note(REASON.PARSE_FAILURE); continue; }
    trace.generated += cands.length;
    note(REASON.GENERATED);

    // 1) 근거 검사 — 글자 기준으로 먼저 통과시키고, 남은 것만 의미 판정에 보낸다.
    const fastPass: Candidate[] = [];
    const needJudge: Candidate[] = [];
    for (const c of cands) (groundedByOverlap(c, grounding) ? fastPass : needJudge).push(c);

    let grounded = fastPass;
    if (needJudge.length) {
      const judgeMs = callBudget(budget, BUDGET.JUDGE_MAX_MS, BUDGET.RESERVE_RESCUE_MS + BUDGET.RESERVE_WRITE_MS);
      if (judgeMs === null) {
        // 판정할 시간이 없다 → 근거를 확인하지 못한 후보는 통과시키지 않는다. 구제 단계가 받아 준다.
        trace.dropped_not_grounded += needJudge.length;
        note(REASON.BUDGET_EXHAUSTED);
        note(REASON.NOT_GROUNDED);
      } else {
        try {
          const ok = await judgeGrounding(apiKey, model, needJudge, groundLines, judgeMs);
          const passed = needJudge.filter((_, idx) => ok.has(idx));
          trace.dropped_not_grounded += needJudge.length - passed.length;
          if (passed.length < needJudge.length) note(REASON.NOT_GROUNDED);
          grounded = [...fastPass, ...passed];
        } catch (e) {
          trace.dropped_not_grounded += needJudge.length;
          note(e instanceof AiTimeout ? REASON.TIMEOUT : REASON.PARSE_FAILURE);
          note(REASON.NOT_GROUNDED);
        }
      }
    }

    // 2) 거절 의미 차단 — A 의 기존 이중 차단(글자 겹침 + 의미 판정)을 그대로 쓴다.
    const beforeLexical = grounded.length;
    let survivors = grounded.filter((c) => !blockedByOverlap(c.text, c.keys, rejected));
    if (survivors.length < beforeLexical) {
      trace.dropped_rejected_lexical += beforeLexical - survivors.length;
      note(REASON.REJECTED_LEXICAL);
    }

    if (survivors.length && rejected.length) {
      const semMs = callBudget(budget, BUDGET.JUDGE_MAX_MS, BUDGET.RESERVE_RESCUE_MS + BUDGET.RESERVE_WRITE_MS);
      if (semMs === null) {
        // 의미 판정을 못 하면 거절 재등장을 확신할 수 없다 → 통과시키지 않는다(거절 보호가 우선).
        trace.dropped_rejected_semantic += survivors.length;
        survivors = [];
        note(REASON.BUDGET_EXHAUSTED);
        note(REASON.REJECTED_SEMANTIC);
      } else {
        try {
          const blocked = await judgeSemanticBlock(apiKey, model, survivors, rejected, semMs);
          if (blocked.size) {
            trace.dropped_rejected_semantic += blocked.size;
            note(REASON.REJECTED_SEMANTIC);
          }
          survivors = survivors.filter((_, idx) => !blocked.has(idx));
        } catch (e) {
          trace.dropped_rejected_semantic += survivors.length;
          survivors = [];
          note(e instanceof AiTimeout ? REASON.TIMEOUT : REASON.PARSE_FAILURE);
          note(REASON.REJECTED_SEMANTIC);
        }
      }
    }

    if (survivors.length) {
      trace.survived = survivors.length;
      note(REASON.SUCCESS);
      return { candidates: survivors, rescue: null, trace };
    }
  }

  // 3) 안전 후보 0개 → 구제. 여기서는 DB에 아무것도 쓰지 않는다(재시도 가능한 상태 유지).
  const rescue = await buildRescue(apiKey, model, recordText, rejected, budget);
  note(REASON.RESCUED);
  return { candidates: [], rescue, trace };
}

async function loadRejected(sb: Db, userId: string): Promise<Rejected[]> {
  const { data, error } = await sb.from("doit_insights")
    .select("text, ai_text")
    .eq("user_id", userId)
    .eq("status", "rejected");
  if (error) throw new Error("REJECTED_LOAD_FAILED");
  const out: Rejected[] = [];
  for (const r of (data ?? []) as { text: string; ai_text: string | null }[]) {
    // 정정 후 거절된 항목은 '정정한 문장'과 'AI 원래 문장'이 다르다. 둘 다 거절된 의미로 본다.
    for (const t of [r.text, r.ai_text]) {
      const v = (t ?? "").trim();
      if (!v) continue;
      if (out.some((o) => o.text === v)) continue;
      out.push({ text: v, keys: cleanKeys([v]) });
    }
  }
  return out;
}
async function loadRecord(sb: Db, userId: string, id: string): Promise<Json | null> {
  const { data } = await sb.from("doit_records").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return (data as Json | null) ?? null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = sortKeysDeep(v);
    return out;
  }
  return value;
}
function canonicalPayload(body: Json): string {
  const { requestId: _r, ...rest } = body;
  return JSON.stringify(sortKeysDeep(rest));
}

const rateBuckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < LIMITS.RATE_WINDOW_MS);
  if (arr.length >= LIMITS.RATE_MAX_PER_WINDOW) { rateBuckets.set(userId, arr); return true; }
  arr.push(now);
  rateBuckets.set(userId, arr);
  return false;
}

// 진단 로그 — 사용자 원문·비밀값·토큰은 넣지 않는다. 코드와 개수만 남긴다.
function logDiag(fields: Record<string, unknown>): void {
  try { console.log(JSON.stringify({ evt: "doit_understanding", ...fields })); } catch { /* 로그 실패는 무시 */ }
}

interface RpcOut { ok: boolean; code?: string; duplicate?: boolean; record?: Json; insight?: Json; insights?: Json[]; handoff?: Json }
function codeToResponse(out: RpcOut, origin: string | null): Response | null {
  if (out.ok) return null;
  const code = String(out.code ?? CODES.ERROR);
  const map: Record<string, [number, string]> = {
    REQUEST_CONFLICT: [409, "같은 요청 식별값이 다른 내용으로 사용됐어요."],
    FORBIDDEN: [403, "항목을 찾지 못했어요."],
    INVALID_STATE: [409, "현재 상태에서는 처리할 수 없어요."],
    STALE_REVISION: [409, "내용이 변경됐어요. 새로고침 후 다시 시도해 주세요."],
    BAD_REQUEST: [400, "요청 형식이 잘못됐어요."],
  };
  const m = map[code] ?? [500, "서버 오류가 발생했어요."];
  return fail(code, m[1], m[0], origin);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail(CODES.BAD_REQUEST, "잘못된 요청이에요.", 405, origin);

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > LIMITS.BODY_MAX_BYTES) return fail(CODES.TOO_LARGE, "요청이 너무 커요.", 413, origin);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail(CODES.UNAUTHORIZED, "로그인이 필요해요.", 401, origin);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) return fail(CODES.ERROR, "서버 저장 설정이 필요해요.", 500, origin);

    const sb: Db = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return fail(CODES.UNAUTHORIZED, "로그인이 필요해요.", 401, origin);

    const admin: Db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const userId = user.id;

    if (rateLimited(userId)) return fail(CODES.RATE_LIMITED, "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.", 429, origin);

    const body = (await req.json().catch(() => null)) as Json | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);

    const action = typeof body.action === "string" ? body.action : "";
    if (!ACTIONS.has(action)) return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);

    const requestId = typeof body.requestId === "string" &&
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(body.requestId)
      ? body.requestId : "";
    const payloadHash = await sha256(canonicalPayload(body));
    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = Deno.env.get("OPENAI_MODEL") ?? "";
    const aiReady = !!apiKey && !!model;

    if (action === "record_list") {
      const { data, error } = await sb.from("doit_records")
        .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
      if (error) return fail(CODES.ERROR, "기록을 불러오지 못했어요.", 500, origin);
      return json({ ok: true, records: data ?? [] }, 200, origin);
    }

    if (action === "record_create") {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const originalText = typeof body.originalText === "string" ? body.originalText.trim() : text;
      const emotion = typeof body.emotion === "string" ? body.emotion.trim().slice(0, LIMITS.EMOTION_MAX) : "";
      const status = typeof body.status === "string" && (RECORD_STATUS as readonly string[]).includes(body.status) ? body.status : "confirmed";
      if (!text || text.length > LIMITS.RECORD_MAX) return fail(CODES.BAD_REQUEST, "기록을 입력해 주세요.", 400, origin);
      if (!requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);

      const { data, error } = await admin.rpc("doit_apply_record_create", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_text: text, p_original_text: originalText, p_emotion: emotion, p_status: status,
      });
      if (error) return fail(CODES.ERROR, "저장에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, record: out.record, duplicate: !!out.duplicate }, 200, origin);
    }

    if (action === "record_update") {
      const id = typeof body.id === "string" ? body.id : "";
      const expectedRevision = typeof body.expectedRevision === "number" ? body.expectedRevision : undefined;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const emotion = typeof body.emotion === "string" ? body.emotion.trim().slice(0, LIMITS.EMOTION_MAX) : "";
      if (!id || !requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);
      if (typeof expectedRevision !== "number") return fail(CODES.BAD_REQUEST, "갱신 기준값이 없어요.", 400, origin);
      if (!text || text.length > LIMITS.RECORD_MAX) return fail(CODES.BAD_REQUEST, "기록을 입력해 주세요.", 400, origin);

      const { data, error } = await admin.rpc("doit_apply_record_update", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_record_id: id, p_expected_revision: expectedRevision, p_text: text, p_emotion: emotion,
      });
      if (error) return fail(CODES.ERROR, "저장에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, record: out.record, duplicate: !!out.duplicate }, 200, origin);
    }

    if (action === "insight_list") {
      const category = typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category) ? body.category : "";
      let q = sb.from("doit_insights").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) return fail(CODES.ERROR, "이해 항목을 불러오지 못했어요.", 500, origin);
      return json({ ok: true, insights: data ?? [] }, 200, origin);
    }

    if (action === "insight_generate") {
      const recordId = typeof body.recordId === "string" ? body.recordId : "";
      if (!recordId || !requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);

      const record = await loadRecord(sb, userId, recordId);
      if (!record) return fail(CODES.FORBIDDEN, "기록을 찾지 못했어요.", 403, origin);
      if (!aiReady) return fail(CODES.AI_NOT_CONFIGURED, "AI 서버 설정이 필요해요.", 500, origin);

      const recordText = String(record.text ?? record.original_text ?? "");
      const budget = newBudget();
      const startedAt = Date.now();

      let gen: GenResult;
      try {
        const rejected = await loadRejected(admin, userId);
        const confirmed = await loadConfirmed(admin, userId);
        gen = await generateInsights({ apiKey, model, recordText, rejected, confirmed, budget });
      } catch {
        // 읽기 단계 실패 — 아직 아무것도 쓰지 않았으므로 상태가 깨지지 않는다. 같은 requestId 로 재시도 가능.
        logDiag({ action, request_id: requestId, reason: REASON.NO_CANDIDATE, stage: "load", elapsed_ms: Date.now() - startedAt });
        return fail(CODES.AI_ERROR, "AI 후보 생성에 실패했어요.", 502, origin);
      }

      const candidates = gen.candidates;
      if (!candidates.length) {
        // 후보 전멸 — 저장하지 않는다. 빈 화면 대신 가장 보수적인 다음 질문을 돌려준다.
        logDiag({
          action, request_id: requestId,
          reason: gen.rescue ? REASON.RESCUED : REASON.NO_CANDIDATE,
          rescue_kind: gen.rescue?.kind ?? null,
          ...gen.trace, elapsed_ms: Date.now() - startedAt,
        });
        if (gen.rescue) {
          return json({ ok: true, insights: [], rescued: true, rescue: gen.rescue, trace: gen.trace }, 200, origin);
        }
        return fail(CODES.NO_CANDIDATE, "지금은 후보를 만들지 못했어요. 잠시 후 다시 시도해 주세요.", 502, origin);
      }

      logDiag({ action, request_id: requestId, reason: REASON.SUCCESS, ...gen.trace, elapsed_ms: Date.now() - startedAt });

      const { data, error } = await admin.rpc("doit_apply_insight_generate", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_record_id: recordId, p_source_text: recordText,
        p_candidates: candidates.map((c) => ({ category: c.category, text: c.text })),
      });
      if (error) return fail(CODES.ERROR, "후보 저장에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, insights: out.insights ?? [], duplicate: !!out.duplicate, trace: gen.trace }, 200, origin);
    }

    const transition = async (transitionKey: "confirm" | "correct" | "reject"): Promise<Response> => {
      const insightId = typeof body.id === "string" ? body.id : "";
      const expectedRevision = typeof body.expectedRevision === "number" ? body.expectedRevision : undefined;
      if (!insightId || !requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);
      if (typeof expectedRevision !== "number") return fail(CODES.BAD_REQUEST, "갱신 기준값이 없어요.", 400, origin);

      let newStatus = "";
      let newText = "";
      if (transitionKey === "confirm") newStatus = "confirmed";
      else if (transitionKey === "reject") newStatus = "rejected";
      else {
        newStatus = "corrected";
        newText = typeof body.text === "string" ? body.text.trim().slice(0, LIMITS.INSIGHT_MAX) : "";
        if (!newText) return fail(CODES.BAD_REQUEST, "수정 내용을 입력해 주세요.", 400, origin);
      }

      const { data, error } = await admin.rpc("doit_apply_insight_transition", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_insight_id: insightId, p_expected_revision: expectedRevision,
        p_new_status: newStatus, p_text: newText,
      });
      if (error) return fail(CODES.ERROR, "저장에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, insight: out.insight, duplicate: !!out.duplicate }, 200, origin);
    };

    if (action === "insight_confirm") return await transition("confirm");
    if (action === "insight_correct") return await transition("correct");
    if (action === "insight_reject") return await transition("reject");

    if (action === "insight_self") {
      const category = typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category) ? body.category as Category : "";
      const text = typeof body.text === "string" ? body.text.trim().slice(0, LIMITS.INSIGHT_MAX) : "";
      const recordId = typeof body.recordId === "string" ? body.recordId : "";
      if (!category || !text) return fail(CODES.BAD_REQUEST, "내용을 입력해 주세요.", 400, origin);
      if (!recordId || !requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);

      const { data, error } = await admin.rpc("doit_apply_insight_self", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_record_id: recordId, p_category: category, p_text: text,
      });
      if (error) return fail(CODES.ERROR, "저장에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, insight: out.insight, duplicate: !!out.duplicate }, 200, origin);
    }

    if (action === "handoff") {
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
      if (!conversationId || !requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);

      const { data, error } = await admin.rpc("doit_apply_handoff", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_conversation_id: conversationId,
      });
      if (error) return fail(CODES.ERROR, "연결에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, handoff: out.handoff, duplicate: !!out.duplicate }, 200, origin);
    }

    if (action === "admin_read") {
      const { data: prof } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (!prof || String(prof.role) !== "admin") return fail(CODES.FORBIDDEN, "관리자 권한이 없어요.", 403, origin);
      const [records, insights, handoffs, events] = await Promise.all([
        admin.from("doit_records").select("*").limit(200),
        admin.from("doit_insights").select("*").limit(200),
        admin.from("doit_handoffs").select("*").limit(200),
        admin.from("doit_request_events").select("*").limit(200),
      ]);
      return json({ ok: true, records: records.data ?? [], insights: insights.data ?? [], handoffs: handoffs.data ?? [], events: events.data ?? [] }, 200, origin);
    }

    return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);
  } catch {
    return fail(CODES.ERROR, "서버 오류가 발생했어요.", 500, origin);
  }
});
