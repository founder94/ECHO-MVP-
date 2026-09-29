// doit-understanding — A구조 자기이해 자산 서버 상태머신 (V412, 미배포)
//
// 원칙 (echo-journey 와 동일)
// - 모든 요청은 getUser() 실검증 → auth.uid() 소유권 확인.
// - LLM은 후보만 만든다. confirmed/corrected/rejected/상태 전이는 서버만 결정.
// - 거절(rejected)한 해석은 같은 뜻·같은 문장으로 재등장 금지 (bigram + LLM 의미 판정 이중 차단).
// - 프론트는 테이블 직접 INSERT/UPDATE/DELETE 불가(RLS: SELECT only). 쓰기는 service_role 로만.
// - 관리자는 테이블 직접 SELECT 정책 없음. admin_read action(서버에서 role='admin' 확인)으로만 읽기.
// - 로그에 사용자 원문·토큰·API키 절대 미기록.
//
// [V412 중복 저장 방지 재설계]
// - "중복 저장이 물리적으로 차단된다"는 이전 판정을 철회.
// - AI 후보 생성은 이 Edge Function 이 수행하고, "최종 데이터 반영 + doit_request_events 완료 기록"은
//   서버 전용 DB 함수(doit_apply_*)의 단일 트랜잭션에서 원자 처리한다.
//   - 같은 (user_id, request_id) 처리 잠금: pg_advisory_xact_lock
//   - action·payload_hash 비교, 완료 요청은 기존 결과 재반환, 미처리일 때만 revision 확인
//   - 데이터 변경 + 완료 기록 동시 commit/rollback → pending 좀비·부분 반영 원천 차단
//   - AI 호출 중 DB 트랜잭션을 열어두지 않음(AI는 RPC 호출 이전에 수행)
// - 따라서 Edge Function 에서는 checkIdempotency/finalize 등의 사전 선점·사후 기록을 하지 않는다.

// 비밀값(서버 전용, 외부 노출 금지): OPENAI_API_KEY, OPENAI_MODEL, SUPABASE_SERVICE_ROLE_KEY.
// SUPABASE_URL / SUPABASE_ANON_KEY 는 플랫폼이 자동 주입.

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

// ── 상태 화이트리스트 ──
const CATEGORIES = ["value", "pattern", "memory"] as const;
type Category = (typeof CATEGORIES)[number];

// action 화이트리스트 (이 외의 action 은 전부 거부)
const ACTIONS = new Set([
  "record_list", "record_create",
  "insight_list", "insight_generate",
  "insight_confirm", "insight_correct", "insight_reject", "insight_self",
  "handoff", "admin_read",
]);

// ── 한도·상수 ──
const LIMITS = {
  BODY_MAX_BYTES: 64 * 1024,          // 요청 크기 제한 64KB
  RATE_WINDOW_MS: 60_000,             // 1분
  RATE_MAX_PER_WINDOW: 60,            // 사용자당 1분 60회
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

// 고정 오류 코드 (프론트와 1:1 계약)
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

// CORS 허용 주소 (환경변수 CORS_ALLOWED_ORIGINS, 콤마 구분). 운영 도메인은 반드시 등록.
const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 25_000;
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

// ── 텍스트 유사도 (echo-journey 와 동일한 bigram/overlap) ──
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

interface Rejected { text: string; keys: string[] }

// 1단계 차단: 글자(정규화) 동일 + bigram 겹침 + 의미 키 포함 — 결정론적·무비용
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

// ── OpenAI 호출 (응답 텍스트만 반환, 로그에 원문/키 미기록) ──
async function callOpenAI(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);
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

// 2단계 차단: LLM '같은 뜻' 판정 (표현이 달라도 의미 동일한 후보 차단).
async function judgeSemanticBlock(apiKey: string, model: string, candidates: Candidate[], rejected: Rejected[]): Promise<Set<number>> {
  const blocked = new Set<number>();
  if (!candidates.length || !rejected.length) return blocked;
  const system = `${PERSONA} 두 문장이 '같은 뜻'인지 판정하라. 표현이 달라도 의미가 같으면 같은 뜻으로 본다. 입력 후보와 거절된 해석을 비교해, 같은 뜻인 후보의 인덱스 배열만 {"blocked":[0,2,...]} JSON으로 출력하라. 같은 뜻이 없으면 {"blocked":[]} 로 출력한다.`;
  const user = JSON.stringify({
    candidates: candidates.map((c, i) => ({ i, text: c.text, meaning: c.meaning })),
    rejected: rejected.map((r) => r.text),
  });
  const raw = await callOpenAI(apiKey, model, system, user);
  const o = extractJson(raw) as Json | null;
  if (!o || !Array.isArray(o.blocked)) throw new Error("SEMANTIC_PARSE_FAILED");
  const arr = o.blocked as unknown[];
  for (const x of arr) {
    const n = Number(x);
    if (Number.isInteger(n) && n >= 0 && n < candidates.length) blocked.add(n);
  }
  return blocked;
}

// 기록 원문 + 거절 insight → LLM 후보 생성 (1단계+2단계 차단 적용). 트랜잭션 없음.
async function genInsights(apiKey: string, model: string, recordText: string, rejected: Rejected[]): Promise<Candidate[]> {
  const system = `${PERSONA} 다음 기록을 바탕으로 '가치(value)·패턴(pattern)·선택 기억(memory)' 각 카테고리에서 후보를 최대 ${LIMITS.CANDIDATES_PER_CATEGORY}개 만들어라. 각 후보는 {"category":"value|pattern|memory","text":"...","meaning":"핵심 의도 한 문장","keys":["명사구 2~5개"]} 형태이고, 전체를 {"candidates":[...]} JSON 객체로만 출력한다. 거절된 해석과 같은 뜻은 표현을 바꿔도 만들지 않는다.`;
  const rejectedNote = rejected.length
    ? `\n[거절된 해석 — 같은 뜻으로 다시 만들지 말 것]\n${rejected.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}`
    : "";
  for (let i = 0; i < LIMITS.ATTEMPTS; i++) {
    const raw = await callOpenAI(apiKey, model, system, `기록:\n${recordText}${rejectedNote}`);
    const cands = parseCandidates(raw);
    let survivors = cands.filter((c) => !blockedByOverlap(c.text, c.keys, rejected));
    const semantic = await judgeSemanticBlock(apiKey, model, survivors, rejected);
    survivors = survivors.filter((_, idx) => !semantic.has(idx));
    if (survivors.length) return survivors;
  }
  throw new Error("NO_CANDIDATE");
}

// ── DB 헬퍼 (조회 전용) ──
async function loadRejected(sb: Db, userId: string): Promise<Rejected[]> {
  const { data, error } = await sb.from("doit_insights")
    .select("text, ai_text")
    .eq("user_id", userId)
    .eq("status", "rejected");
  if (error) throw new Error("REJECTED_LOAD_FAILED"); // 조회 오류를 빈 거절 목록으로 취급 금지
  const out: Rejected[] = [];
  for (const r of (data ?? []) as { text: string; ai_text: string | null }[]) {
    const t = r.text || r.ai_text || "";
    if (t) out.push({ text: t, keys: cleanKeys([t]) });
  }
  return out;
}
async function loadRecord(sb: Db, userId: string, id: string): Promise<Json | null> {
  const { data } = await sb.from("doit_records").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return (data as Json | null) ?? null;
}

// ── 멱등: payload 해시 (requestId 제외 정규화) ──
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

// ── 요청 횟수 제한 (메모리 기반; 콜드스타트 시 초기화 — 운영은 별도 저장소 권장) ──
const rateBuckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < LIMITS.RATE_WINDOW_MS);
  if (arr.length >= LIMITS.RATE_MAX_PER_WINDOW) { rateBuckets.set(userId, arr); return true; }
  arr.push(now);
  rateBuckets.set(userId, arr);
  return false;
}

// ── RPC 반영 결과 → HTTP 응답 공통 변환 ──
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

    // request_id 는 DB 컬럼이 uuid 타입이므로 uuid 형식만 허용
    const requestId = typeof body.requestId === "string" &&
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(body.requestId)
      ? body.requestId : "";
    const payloadHash = await sha256(canonicalPayload(body));
    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = Deno.env.get("OPENAI_MODEL") ?? "";
    const aiReady = !!apiKey && !!model;

    // ── record_list: 자기 기록 조회 ──
    if (action === "record_list") {
      const { data, error } = await sb.from("doit_records")
        .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
      if (error) return fail(CODES.ERROR, "기록을 불러오지 못했어요.", 500, origin);
      return json({ ok: true, records: data ?? [] }, 200, origin);
    }

    // ── record_create: 첫 기록 생성 (반영은 DB 함수 원자 트랜잭션) ──
    if (action === "record_create") {
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const emotion = typeof body.emotion === "string" ? body.emotion.trim().slice(0, LIMITS.EMOTION_MAX) : "";
      if (!text || text.length > LIMITS.RECORD_MAX) return fail(CODES.BAD_REQUEST, "기록을 입력해 주세요.", 400, origin);
      if (!requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);

      const { data, error } = await admin.rpc("doit_apply_record_create", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_text: text, p_emotion: emotion,
      });
      if (error) return fail(CODES.ERROR, "저장에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, record: out.record, duplicate: !!out.duplicate }, 200, origin);
    }

    // ── insight_list: 가치·패턴·선택 기억 조회 ──
    if (action === "insight_list") {
      const category = typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category) ? body.category : "";
      let q = sb.from("doit_insights").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (error) return fail(CODES.ERROR, "이해 항목을 불러오지 못했어요.", 500, origin);
      return json({ ok: true, insights: data ?? [] }, 200, origin);
    }

    // ── insight_generate: AI 후보 생성 → 반영은 DB 함수 (AI 는 트랜잭션 밖) ──
    if (action === "insight_generate") {
      const recordId = typeof body.recordId === "string" ? body.recordId : "";
      if (!recordId || !requestId) return fail(CODES.BAD_REQUEST, "요청 식별값이 없어요.", 400, origin);

      const record = await loadRecord(sb, userId, recordId);
      if (!record) return fail(CODES.FORBIDDEN, "기록을 찾지 못했어요.", 403, origin);
      if (!aiReady) return fail(CODES.AI_NOT_CONFIGURED, "AI 서버 설정이 필요해요.", 500, origin);

      const recordText = String(record.text ?? record.original_text ?? "");
      let candidates: Candidate[];
      try {
        const rejected = await loadRejected(admin, userId);
        candidates = await genInsights(apiKey, model, recordText, rejected);
      } catch (e) {
        return fail(e instanceof Error && e.message === "NO_CANDIDATE" ? CODES.NO_CANDIDATE : CODES.AI_ERROR, "AI 후보 생성에 실패했어요.", 502, origin);
      }

      // 후보는 DB 함수에 넘겨 원자 반영 (동일 요청 동시 도달 시 한 번만 반영)
      const { data, error } = await admin.rpc("doit_apply_insight_generate", {
        p_user_id: userId, p_request_id: requestId, p_action: action, p_payload_hash: payloadHash,
        p_record_id: recordId, p_source_text: recordText,
        p_candidates: candidates.map((c) => ({ category: c.category, text: c.text })),
      });
      if (error) return fail(CODES.ERROR, "후보 저장에 실패했어요.", 500, origin);
      const out = data as RpcOut;
      const mapped = codeToResponse(out, origin);
      if (mapped) return mapped;
      return json({ ok: true, insights: out.insights ?? [], duplicate: !!out.duplicate }, 200, origin);
    }

    // ── 상태 전이 공통 (서버만 결정, revision 은 DB 함수가 낙관 잠금) ──
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

    // ── insight_self: 직접 설명 (origin=self, 생성 시 confirmed) ──
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

    // ── handoff: B→A 근거 연결 (doit_handoffs, 원문 미복사) ──
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

    // ── admin_read: 관리자 읽기 전용 (테이블 직접 SELECT 정책 없음) ──
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
    // 로그에 원문·토큰·키를 남기지 않기 위해 상세 없이 일반 오류만 반환
    return fail(CODES.ERROR, "서버 오류가 발생했어요.", 500, origin);
  }
});