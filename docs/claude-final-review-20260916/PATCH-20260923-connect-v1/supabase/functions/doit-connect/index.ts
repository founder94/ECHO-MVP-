// doit-connect — 연결 서버 (v1 · 2026-09-23)
//
// 근거: 대표 확정 연결 원칙(2026-09-21) "전화 인증 필수 → 확인한 이해 5개 + 필수 사진 3장 + 소개 = 연결 자격 →
// 목적 호환 + 확인한 말 공통점으로 서버가 후보 결정 → AI 첫 질문 동시 공개(blind-first) → 첫 100명 대표 수동 승인",
// 대표 2026-09-23 "어디까지 구현을 해야 되는 단계까지는 승인하니까 허용하고 끝까지 진행시켜".
//
// 하는 일
// ① phone_sync: 로그인 정보에 문자 인증이 끝난 번호가 있으면 profiles.verification_status 를 verified 로 맞춘다.
//    화면이 "인증됐다"고 말해도 믿지 않는다 — Auth 서버가 돌려준 phone_confirmed_at 만 본다. 번호는 돌려주지도 기록하지도 않는다.
// ② admin_candidates(관리자): 연결 자격을 갖춘 사람 중 같은 목적 + 맞다고 한 말이 겹치는 쌍을 서버가 고른다.
//    차단한 사이·이미 결정한 쌍은 빼고, 겹친 말이 없으면 후보가 아니다.
// ③ admin_decide(관리자): 대표가 승인하면 AI 가 두 사람에게 같은 첫 질문을 만든다(검사에 걸리면 고정 문장). 넘기기도 기록한다.
//    결정 순간에 자격·목적·차단·겹침을 서버가 다시 확인한다(화면이 보낸 값을 믿지 않는다).
// ④ my_matches: 내 연결. 두 사람이 모두 첫 질문에 답하기 전에는 상대의 이름·사진·소개·답을 절대 내려 주지 않는다(blind-first).
// ⑤ answer / message: 첫 답, 그 뒤 이야기. 저장 금지 입력(연락처·식별번호·링크·성적 표현)은 막고 안내한다.
// ⑥ leave: 그만하기(차단·신고 선택). 끝난 연결은 상대 정보를 다시 내려 주지 않는다.
// ⑦ admin_matches(관리자): 연결 목록과 진행(답 수·이야기 수). 이야기 내용은 내려 주지 않는다.
//
// 원칙
// - 모든 요청은 getUser() 실검증. 관리자 요청은 profiles.role = 'admin' 을 서버가 다시 확인한다.
// - 저장 표(doit_matches·doit_match_answers·doit_match_messages)는 RLS 정책 0개 + 화면 권한 없음 → 이 함수만 읽고 쓴다.
// - 로그에 사용자 원문·번호·토큰을 남기지 않는다(코드와 개수만).

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

type Json = Record<string, unknown>;
type Db = SupabaseClient;

const ACTIONS = new Set([
  "phone_sync",
  "my_matches", "answer", "message", "leave",
  "admin_candidates", "admin_matches", "admin_decide",
]);

const LIMITS = {
  BODY_MAX_BYTES: 32 * 1024,
  RATE_WINDOW_MS: 60_000,
  RATE_MAX_PER_WINDOW: 60,
  REPEAT_SIM: 0.6,              // doit-understanding 과 같은 값(겹친 말 판정)
  REPEAT_OVERLAP: 0.7,
  CONNECT_CONFIRMED_NEEDED: 5,  // 연결 자격: 맞다고 한 말 5개(대표 승인 2026-09-21, doit-understanding 과 같다)
  CONNECT_PHOTOS_NEEDED: 3,     // 연결 자격: 필수 사진 3장(전신·패션·취미)
  COMMON_MAX: 3,                // 쌍마다 보여 줄 겹친 말 최대 개수(한쪽 기준)
  POOL_MAX: 500,                // 한 번에 살펴볼 사람 상한
  CONFIRMED_PER_USER: 24,       // 한 사람의 맞다고 한 말 상한
  CANDIDATES_MAX: 50,           // 관리자에게 보여 줄 후보 쌍 상한
  MATCHES_MAX: 100,
  ANSWER_MAX: 300,
  MESSAGE_MAX: 500,
  MESSAGES_SHOWN: 80,
  QUESTION_MIN: 5,
  QUESTION_MAX: 60,
  AI_TIMEOUT_MS: 12_000,
  SIGNED_URL_SECONDS: 600,
} as const;

const CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  INVALID_STATE: "INVALID_STATE",
  NOT_ELIGIBLE: "NOT_ELIGIBLE",
  BLOCKED_CONTENT: "BLOCKED_CONTENT",
  RATE_LIMITED: "RATE_LIMITED",
  TOO_LARGE: "TOO_LARGE",
  ERROR: "ERROR",
} as const;

const PHOTO_BUCKET = "profile-photos";
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// 호출 주소는 환경변수로 바꿀 수 없다(비공식 게이트웨이 경유 금지).
function resolveModel(raw: string | undefined): string {
  const model = (raw ?? "").trim();
  return !model || model === "gpt-40-mini" ? "gpt-4o-mini" : model;
}

// 화면에 쓰지 않는 단어(기준 문서 §1).
const BANNED_WORDS = /데이팅|소개팅|궁합|점술|심리치료|성격검사/;
// 첫 질문에서 묻지 않는 것: 연락처·사는 곳·직장·나이·몸·외모. 처음 만나는 사이에 부담이 되거나 개인정보다.
const PRIVATE_ASK = /연락처|번호|주소|사는\s*곳|어디\s*살|직장|회사|학교|나이|몇\s*살|키가|몸무게|외모|사진|인스타|카톡|아이디/;
const FIRST_QUESTION_FALLBACK = "처음 만난 사람에게 가장 먼저 들려주고 싶은 내 이야기는 뭐예요?";

const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
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

// ── 텍스트 유사도 (doit-understanding 과 같은 식 — qa/connect-server.test.mjs 가 두 복사본이 같은지 검사한다) ──
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
// ── /텍스트 유사도 ──

// ── 저장 금지 입력 (doit-understanding RULES 의 같은 부분 복사 — 검사가 같은지 확인한다) ──
type BlockedReason = "phone" | "email" | "id_number" | "link" | "card" | "sexual";
const BLOCKED_PATTERNS: readonly { reason: BlockedReason; pattern: RegExp }[] = [
  { reason: "phone", pattern: /(?:\+?82[-\s.]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/ },
  { reason: "phone", pattern: /(?:^|\D)0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}(?:\D|$)/ },
  { reason: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { reason: "id_number", pattern: /(?:^|\D)\d{6}[-\s]?[1-4]\d{6}(?:\D|$)/ },
  { reason: "card", pattern: /(?:^|\D)\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}(?:\D|$)/ },
  { reason: "link", pattern: /https?:\/\/|www\.|[A-Za-z0-9-]+\.(?:com|net|kr|io|me|link)(?:\/|\s|$)/i },
  { reason: "sexual", pattern: /섹스|성관계|원나잇|조건\s*만남|성매매|야한\s*사진|몸\s*사진|노콘/ },
];
function blockedContentReason(text: string): BlockedReason | null {
  const t = text.normalize("NFKC");
  for (const { reason, pattern } of BLOCKED_PATTERNS) if (pattern.test(t)) return reason;
  return null;
}
// ── /저장 금지 입력 ──
function blockedMessage(reason: BlockedReason): string {
  const what = reason === "sexual" ? "성적인 표현" : reason === "link" ? "링크" : reason === "email" ? "이메일 주소" : reason === "card" ? "카드번호" : reason === "id_number" ? "주민번호" : "전화번호";
  return `${what}은(는) 보낼 수 없어요. 그 부분을 빼고 다시 적어 주세요. 적은 내용은 그대로 남아 있어요.`;
}

function roundStartOf(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const v = user.user_metadata?.doit_round_started_at;
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;
}
const inRound = (createdAt: string | undefined, since: string | null): boolean => !since || !createdAt || createdAt >= since;

const rateBuckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < LIMITS.RATE_WINDOW_MS);
  if (arr.length >= LIMITS.RATE_MAX_PER_WINDOW) { rateBuckets.set(userId, arr); return true; }
  arr.push(now);
  rateBuckets.set(userId, arr);
  return false;
}

// 진단 로그 — 사용자 원문·번호·토큰은 넣지 않는다.
function logDiag(fields: Record<string, unknown>): void {
  try { console.log(JSON.stringify({ evt: "doit_connect", ...fields })); } catch { /* 로그 실패는 무시 */ }
}

const pairOf = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);
const pairKey = (x: string, y: string): string => pairOf(x, y).join("|");
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const cleanText = (v: unknown): string => str(v).normalize("NFKC").replace(/\s+/g, " ").trim();

interface Member {
  id: string;
  nickname: string;
  purposeId: string | null;
  purposeLabel: string | null;
  bio: string;
  phoneVerified: boolean;
  confirmed: string[];
  requiredPhotos: number;
  eligible: boolean;
  missing: string[];
}

interface AuthInfo { phoneConfirmed: boolean; since: string | null }

// 로그인 정보(문자 인증 여부·회차 시작 시각)를 한 번에 읽는다. 사람이 많아지면 여러 쪽으로 나눠 읽는다.
async function authInfoOf(admin: Db, ids: Set<string>): Promise<Map<string, AuthInfo>> {
  const out = new Map<string, AuthInfo>();
  for (let page = 1; page <= 20 && out.size < ids.size; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("auth_list_failed");
    const users = data?.users ?? [];
    for (const u of users) {
      if (!ids.has(u.id)) continue;
      out.set(u.id, { phoneConfirmed: !!u.phone && !!u.phone_confirmed_at, since: roundStartOf(u) });
    }
    if (users.length < 1000) break;
  }
  return out;
}

// 연결 자격을 서버가 계산한다. 화면의 "준비 상태"(doit-understanding connection_preview)와 같은 기준이다.
async function loadMembers(admin: Db, onlyIds?: string[]): Promise<Member[]> {
  let q = admin.from("profiles").select("id, nickname, display_name, purpose_id, purpose_label, bio, verification_status");
  q = onlyIds ? q.in("id", onlyIds) : q.not("purpose_id", "is", null);
  const { data: profiles, error } = await q.limit(LIMITS.POOL_MAX);
  if (error) throw new Error("profiles_failed");
  const rows = profiles ?? [];
  if (!rows.length) return [];
  const ids = rows.map((p) => String(p.id));
  const [{ data: photos }, { data: insights }, auth] = await Promise.all([
    admin.from("profile_photos").select("user_id, slot").in("user_id", ids),
    admin.from("doit_insights").select("user_id, text, created_at").in("user_id", ids).in("status", ["confirmed", "corrected"]).order("updated_at", { ascending: false }).limit(ids.length * LIMITS.CONFIRMED_PER_USER),
    authInfoOf(admin, new Set(ids)),
  ]);
  const slots = new Map<string, Set<number>>();
  for (const p of photos ?? []) {
    const s = Number(p.slot);
    if (s >= 1 && s <= LIMITS.CONNECT_PHOTOS_NEEDED) slots.set(String(p.user_id), (slots.get(String(p.user_id)) ?? new Set()).add(s));
  }
  const confirmed = new Map<string, string[]>();
  for (const row of insights ?? []) {
    const uid = String(row.user_id);
    const t = cleanText(row.text);
    if (!t || !inRound(str(row.created_at) || undefined, auth.get(uid)?.since ?? null)) continue;
    const list = confirmed.get(uid) ?? [];
    if (list.length < LIMITS.CONFIRMED_PER_USER && !list.includes(t)) list.push(t);
    confirmed.set(uid, list);
  }
  return rows.map((p) => {
    const id = String(p.id);
    const phoneVerified = str(p.verification_status) === "verified" || !!auth.get(id)?.phoneConfirmed;
    const mine = confirmed.get(id) ?? [];
    const requiredPhotos = slots.get(id)?.size ?? 0;
    const bio = cleanText(p.bio);
    const missing: string[] = [];
    if (!p.purpose_id) missing.push("purpose");
    if (!phoneVerified) missing.push("phone");
    if (mine.length < LIMITS.CONNECT_CONFIRMED_NEEDED) missing.push("confirmed");
    if (requiredPhotos < LIMITS.CONNECT_PHOTOS_NEEDED) missing.push("photos");
    if (!bio) missing.push("intro");
    return {
      id, nickname: cleanText(p.nickname) || cleanText(p.display_name) || "이름 없음",
      purposeId: p.purpose_id ? String(p.purpose_id) : null, purposeLabel: p.purpose_label ? String(p.purpose_label) : null,
      bio, phoneVerified, confirmed: mine, requiredPhotos, eligible: missing.length === 0, missing,
    };
  });
}

function commonOf(a: Member, b: Member): { a: string[]; b: string[] } {
  const pick = (from: string[], other: string[]) => from.filter((m) => other.some((t) => looksSame(m, t, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP))).slice(0, LIMITS.COMMON_MAX);
  return { a: pick(a.confirmed, b.confirmed), b: pick(b.confirmed, a.confirmed) };
}

// 차단은 어느 한쪽만 해도 둘은 다시 이어지지 않는다.
async function blockedPairs(admin: Db, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!ids.length) return out;
  const [{ data: byMe }, { data: byOther }] = await Promise.all([
    admin.from("blocks").select("blocker_id, blocked_user_id").in("blocker_id", ids),
    admin.from("blocks").select("blocker_id, blocked_user_id").in("blocked_user_id", ids),
  ]);
  for (const r of [...(byMe ?? []), ...(byOther ?? [])]) out.add(pairKey(String(r.blocker_id), String(r.blocked_user_id)));
  return out;
}

async function isAdmin(admin: Db, userId: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return !!data && String(data.role) === "admin";
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0.4, max_tokens: 300, response_format: { type: "json_object" } }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`openai_${res.status}`);
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

const FIRST_QUESTION_SYSTEM =
  "너는 'DO IT'이다. 같은 만남을 원하는 두 사람이 처음으로 서로에게 답할 질문 하나를 만든다. " +
  "아래 자료는 두 사람이 각자 '맞아요'라고 한 말 중 서로 겹치는 부분이다. 두 사람 모두 편하게 답할 수 있고, 답을 읽으면 서로를 조금 알게 되는 질문을 만든다. " +
  "규칙: 한 문장, 물음표 하나, 공백 포함 45자 이내. 자료의 문장을 그대로 옮기지 않는다. 연락처·사는 곳·직장·학교·나이·몸·외모·사진을 묻지 않는다. " +
  "마음속을 파고들거나 진단하지 않는다. 데이팅·소개팅·궁합·점술·심리치료·성격검사 같은 단어를 쓰지 않는다. " +
  "JSON {\"question\":\"...\"} 로만 답한다.";

// AI 가 만든 첫 질문을 서버가 검사한다. 하나라도 걸리면 쓰지 않는다.
function acceptableQuestion(q: string, sources: string[]): boolean {
  if (q.length < LIMITS.QUESTION_MIN || q.length > LIMITS.QUESTION_MAX) return false;
  if ((q.match(/\?/g) ?? []).length !== 1 || !q.endsWith("?")) return false;
  if (q.includes("\n")) return false;
  if (BANNED_WORDS.test(q) || PRIVATE_ASK.test(q) || blockedContentReason(q)) return false;
  const nq = normalizeKey(q);
  return !sources.some((s) => { const ns = normalizeKey(s); return ns.length >= 6 && nq.includes(ns); });
}

async function firstQuestionFor(purpose: string | null, common: { a: string[]; b: string[] }): Promise<{ question: string; source: "ai" | "fixed"; reason?: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const model = resolveModel(Deno.env.get("OPENAI_MODEL"));
  if (!apiKey) return { question: FIRST_QUESTION_FALLBACK, source: "fixed", reason: "no_key" };
  try {
    const raw = await callOpenAI(apiKey, model, FIRST_QUESTION_SYSTEM, JSON.stringify({ purpose, first_person: common.a, second_person: common.b }), LIMITS.AI_TIMEOUT_MS);
    const parsed = JSON.parse(raw) as { question?: unknown };
    const q = cleanText(parsed?.question);
    if (acceptableQuestion(q, [...common.a, ...common.b])) return { question: q, source: "ai" };
    return { question: FIRST_QUESTION_FALLBACK, source: "fixed", reason: "rejected" };
  } catch {
    return { question: FIRST_QUESTION_FALLBACK, source: "fixed", reason: "ai_error" };
  }
}

interface MatchRow { id: string; user_a: string; user_b: string; purpose_id: string | null; common: string[] | null; first_question: string | null; status: string; created_at: string }

async function loadMatch(admin: Db, matchId: string, userId: string): Promise<{ match: MatchRow; partnerId: string } | null> {
  const { data } = await admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").eq("id", matchId).maybeSingle();
  if (!data) return null;
  const m = data as MatchRow;
  if (m.user_a !== userId && m.user_b !== userId) return null; // 남의 연결은 "없음"으로 답한다(있는지조차 알리지 않는다)
  return { match: m, partnerId: m.user_a === userId ? m.user_b : m.user_a };
}

async function answersOf(admin: Db, matchIds: string[]): Promise<Map<string, Map<string, { answer: string; created_at: string }>>> {
  const out = new Map<string, Map<string, { answer: string; created_at: string }>>();
  if (!matchIds.length) return out;
  const { data } = await admin.from("doit_match_answers").select("match_id, user_id, answer, created_at").in("match_id", matchIds);
  for (const r of data ?? []) {
    const m = out.get(String(r.match_id)) ?? new Map();
    m.set(String(r.user_id), { answer: str(r.answer), created_at: str(r.created_at) });
    out.set(String(r.match_id), m);
  }
  return out;
}

async function primaryPhotoUrl(admin: Db, userId: string): Promise<string | null> {
  const { data } = await admin.from("profile_photos").select("slot, storage_path, is_primary").eq("user_id", userId);
  const rows = (data ?? []).filter((r) => typeof r.storage_path === "string" && r.storage_path.startsWith(`${userId}/`));
  if (!rows.length) return null;
  const pick = rows.find((r) => r.is_primary === true) ?? rows.slice().sort((x, y) => Number(x.slot) - Number(y.slot))[0];
  const { data: signed } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(String(pick.storage_path), LIMITS.SIGNED_URL_SECONDS);
  return signed?.signedUrl ?? null;
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

    if (rateLimited(userId)) return fail(CODES.RATE_LIMITED, "요청이 너무 잦아요. 잠시 뒤 다시 해 주세요.", 429, origin);

    const body = (await req.json().catch(() => null)) as Json | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
    const action = typeof body.action === "string" ? body.action : "";
    if (!ACTIONS.has(action)) return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);

    // ① 문자 인증 결과를 프로필에 맞춘다. Auth 서버가 확인한 값만 믿는다. 이미 verified 면 되돌리지 않는다.
    if (action === "phone_sync") {
      const verified = !!user.phone && !!user.phone_confirmed_at;
      if (verified) {
        const { error } = await admin.from("profiles").update({ verification_status: "verified" }).eq("id", userId);
        if (error) return fail(CODES.ERROR, "인증 결과를 저장하지 못했어요. 잠시 뒤 다시 열어 주세요.", 500, origin);
      }
      logDiag({ action, verified });
      return json({ ok: true, verified }, 200, origin);
    }

    if (action === "my_matches") {
      const [{ data: asA }, { data: asB }] = await Promise.all([
        admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").eq("user_a", userId).in("status", ["approved", "closed"]).limit(LIMITS.MATCHES_MAX),
        admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").eq("user_b", userId).in("status", ["approved", "closed"]).limit(LIMITS.MATCHES_MAX),
      ]);
      const rows = [...(asA ?? []), ...(asB ?? [])] as MatchRow[];
      rows.sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
      const blocked = await blockedPairs(admin, [userId]);
      const answers = await answersOf(admin, rows.map((r) => r.id));
      const out = [];
      for (const m of rows) {
        const partnerId = m.user_a === userId ? m.user_b : m.user_a;
        const open = m.status === "approved" && !blocked.has(pairKey(userId, partnerId));
        const got = answers.get(m.id) ?? new Map();
        const mine = got.get(userId) ?? null;
        const theirs = got.get(partnerId) ?? null;
        const revealed = open && !!mine && !!theirs;
        const item: Json = {
          id: m.id, status: open ? "open" : "closed", created_at: m.created_at,
          first_question: open ? m.first_question : null,
          my_answer: open ? mine?.answer ?? null : null,
          partner_answered: open ? !!theirs : false,
          revealed,
        };
        if (revealed) {
          const [{ data: p }, photo, { data: msgs }] = await Promise.all([
            admin.from("profiles").select("nickname, display_name, bio, purpose_label").eq("id", partnerId).maybeSingle(),
            primaryPhotoUrl(admin, partnerId),
            admin.from("doit_match_messages").select("id, sender_id, body, created_at").eq("match_id", m.id).order("created_at", { ascending: false }).limit(LIMITS.MESSAGES_SHOWN),
          ]);
          item.partner = {
            nickname: cleanText(p?.nickname) || cleanText(p?.display_name) || "이름 없음",
            bio: cleanText(p?.bio), purpose: p?.purpose_label ?? null, answer: theirs?.answer ?? "", photo_url: photo,
          };
          item.messages = (msgs ?? []).slice().reverse().map((x) => ({ id: String(x.id), mine: String(x.sender_id) === userId, body: str(x.body), created_at: str(x.created_at) }));
        }
        out.push(item);
      }
      logDiag({ action, matches: out.length });
      return json({ ok: true, matches: out }, 200, origin);
    }

    if (action === "answer" || action === "message") {
      const matchId = str(body.matchId);
      const text = cleanText(body.text);
      const max = action === "answer" ? LIMITS.ANSWER_MAX : LIMITS.MESSAGE_MAX;
      if (!UUID_RE.test(matchId)) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
      if (!text) return fail(CODES.BAD_REQUEST, "한 글자 이상 적어 주세요.", 400, origin);
      if (text.length > max) return fail(CODES.BAD_REQUEST, `${max}자까지 보낼 수 있어요.`, 400, origin);
      const reason = blockedContentReason(text);
      if (reason) { logDiag({ action, blocked: reason }); return fail(CODES.BLOCKED_CONTENT, blockedMessage(reason), 200, origin); }
      const found = await loadMatch(admin, matchId, userId);
      if (!found) return fail(CODES.NOT_FOUND, "이 연결을 찾지 못했어요.", 404, origin);
      const blocked = await blockedPairs(admin, [userId]);
      if (found.match.status !== "approved" || blocked.has(pairKey(userId, found.partnerId))) return fail(CODES.INVALID_STATE, "끝난 연결이에요.", 409, origin);
      if (action === "answer") {
        const { error } = await admin.from("doit_match_answers").insert({ match_id: matchId, user_id: userId, answer: text });
        if (error) {
          if ((error as { code?: string }).code === "23505") return fail(CODES.INVALID_STATE, "이미 답을 보냈어요.", 409, origin);
          return fail(CODES.ERROR, "답을 보내지 못했어요. 적은 내용은 그대로 있어요. 다시 눌러 주세요.", 500, origin);
        }
        logDiag({ action });
        return json({ ok: true }, 200, origin);
      }
      const answers = (await answersOf(admin, [matchId])).get(matchId) ?? new Map();
      if (!answers.has(userId) || !answers.has(found.partnerId)) return fail(CODES.INVALID_STATE, "두 사람이 모두 첫 질문에 답한 뒤에 이야기할 수 있어요.", 409, origin);
      const { error } = await admin.from("doit_match_messages").insert({ match_id: matchId, sender_id: userId, body: text });
      if (error) return fail(CODES.ERROR, "보내지 못했어요. 적은 내용은 그대로 있어요. 다시 눌러 주세요.", 500, origin);
      logDiag({ action });
      return json({ ok: true }, 200, origin);
    }

    if (action === "leave") {
      const matchId = str(body.matchId);
      if (!UUID_RE.test(matchId)) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
      const found = await loadMatch(admin, matchId, userId);
      if (!found) return fail(CODES.NOT_FOUND, "이 연결을 찾지 못했어요.", 404, origin);
      const block = body.block === true;
      const report = body.report === true;
      if (found.match.status === "approved") {
        const { error } = await admin.from("doit_matches").update({ status: "closed", closed_by: userId, updated_at: new Date().toISOString() }).eq("id", matchId);
        if (error) return fail(CODES.ERROR, "지금은 끝내지 못했어요. 다시 눌러 주세요.", 500, origin);
      }
      if (block) await admin.from("blocks").upsert({ blocker_id: userId, blocked_user_id: found.partnerId, reason: "connection" }, { onConflict: "blocker_id,blocked_user_id", ignoreDuplicates: true });
      if (report) await admin.from("user_reports").insert({ reporter_id: userId, target_user_id: found.partnerId, reason: "connection", detail: null });
      logDiag({ action, block, report });
      return json({ ok: true }, 200, origin);
    }

    // ── 여기부터 관리자 전용 ──
    if (!(await isAdmin(admin, userId))) return fail(CODES.FORBIDDEN, "관리자 권한이 없어요.", 403, origin);

    if (action === "admin_candidates") {
      const members = await loadMembers(admin);
      const eligible = members.filter((m) => m.eligible);
      const blocked = await blockedPairs(admin, eligible.map((m) => m.id));
      const { data: decided } = await admin.from("doit_matches").select("user_a, user_b");
      const done = new Set((decided ?? []).map((r) => pairKey(String(r.user_a), String(r.user_b))));
      const candidates: Json[] = [];
      for (let i = 0; i < eligible.length; i++) {
        for (let j = i + 1; j < eligible.length; j++) {
          const x = eligible[i], y = eligible[j];
          if (!x.purposeId || x.purposeId !== y.purposeId) continue;
          const key = pairKey(x.id, y.id);
          if (blocked.has(key) || done.has(key)) continue;
          const [a, b] = x.id < y.id ? [x, y] : [y, x];
          const common = commonOf(a, b);
          if (!common.a.length) continue;
          candidates.push({
            user_a: a.id, user_b: b.id, purpose: a.purposeLabel,
            a: { nickname: a.nickname, confirmed: a.confirmed.length }, b: { nickname: b.nickname, confirmed: b.confirmed.length },
            common_a: common.a, common_b: common.b, score: common.a.length + common.b.length,
          });
        }
      }
      candidates.sort((p, q) => Number(q.score) - Number(p.score));
      const missing: Record<string, number> = { purpose: 0, phone: 0, confirmed: 0, photos: 0, intro: 0 };
      for (const m of members) for (const k of m.missing) missing[k] = (missing[k] ?? 0) + 1;
      logDiag({ action, pool: members.length, eligible: eligible.length, candidates: candidates.length });
      return json({ ok: true, pool: members.length, eligible: eligible.length, missing, candidates: candidates.slice(0, LIMITS.CANDIDATES_MAX) }, 200, origin);
    }

    if (action === "admin_matches") {
      const { data: rows } = await admin.from("doit_matches").select("id, user_a, user_b, purpose_id, common, first_question, status, created_at").order("created_at", { ascending: false }).limit(LIMITS.MATCHES_MAX);
      const list = (rows ?? []) as MatchRow[];
      const ids = [...new Set(list.flatMap((m) => [m.user_a, m.user_b]))];
      const matchIds = list.map((m) => m.id);
      const [{ data: people }, answers, { data: msgs }] = await Promise.all([
        ids.length ? admin.from("profiles").select("id, nickname, display_name").in("id", ids) : Promise.resolve({ data: [] as Json[] }),
        answersOf(admin, matchIds),
        matchIds.length ? admin.from("doit_match_messages").select("match_id").in("match_id", matchIds) : Promise.resolve({ data: [] as Json[] }),
      ]);
      const nameOf = new Map((people ?? []).map((p) => [String(p.id), cleanText(p.nickname) || cleanText(p.display_name) || "이름 없음"]));
      const msgCount = new Map<string, number>();
      for (const r of msgs ?? []) msgCount.set(String(r.match_id), (msgCount.get(String(r.match_id)) ?? 0) + 1);
      return json({
        ok: true,
        matches: list.map((m) => ({
          id: m.id, status: m.status, created_at: m.created_at, first_question: m.first_question, common: m.common ?? [],
          a: nameOf.get(m.user_a) ?? "이름 없음", b: nameOf.get(m.user_b) ?? "이름 없음",
          answered: (answers.get(m.id)?.size ?? 0), messages: msgCount.get(m.id) ?? 0,
        })),
      }, 200, origin);
    }

    if (action === "admin_decide") {
      const x = str(body.userA), y = str(body.userB);
      const decision = str(body.decision);
      if (!UUID_RE.test(x) || !UUID_RE.test(y) || x === y || (decision !== "approve" && decision !== "reject")) return fail(CODES.BAD_REQUEST, "요청 형식이 잘못됐어요.", 400, origin);
      const [ua, ub] = pairOf(x, y);
      const { data: existing } = await admin.from("doit_matches").select("id").eq("user_a", ua).eq("user_b", ub).maybeSingle();
      if (existing) return fail(CODES.INVALID_STATE, "이미 결정한 쌍이에요.", 409, origin);
      if (decision === "reject") {
        const { error } = await admin.from("doit_matches").insert({ user_a: ua, user_b: ub, status: "rejected", decided_by: userId });
        if (error) return fail(CODES.ERROR, "저장하지 못했어요.", 500, origin);
        logDiag({ action, decision });
        return json({ ok: true, status: "rejected" }, 200, origin);
      }
      // 승인 순간에 다시 확인한다: 두 사람 모두 자격, 같은 목적, 차단 없음, 겹친 말 있음.
      const members = await loadMembers(admin, [ua, ub]);
      const a = members.find((m) => m.id === ua), b = members.find((m) => m.id === ub);
      if (!a || !b || !a.eligible || !b.eligible) return fail(CODES.NOT_ELIGIBLE, "두 사람 중 연결 자격이 없는 사람이 있어요.", 409, origin);
      if (!a.purposeId || a.purposeId !== b.purposeId) return fail(CODES.NOT_ELIGIBLE, "원하는 만남이 서로 달라요.", 409, origin);
      if ((await blockedPairs(admin, [ua])).has(pairKey(ua, ub))) return fail(CODES.NOT_ELIGIBLE, "둘 중 한 사람이 상대를 차단했어요.", 409, origin);
      const common = commonOf(a, b);
      if (!common.a.length) return fail(CODES.NOT_ELIGIBLE, "겹친 말이 없어요.", 409, origin);
      const first = await firstQuestionFor(a.purposeLabel, common);
      const { error } = await admin.from("doit_matches").insert({
        user_a: ua, user_b: ub, purpose_id: a.purposeId, common: common.a, first_question: first.question, status: "approved", decided_by: userId,
      });
      if (error) {
        if ((error as { code?: string }).code === "23505") return fail(CODES.INVALID_STATE, "이미 결정한 쌍이에요.", 409, origin);
        return fail(CODES.ERROR, "저장하지 못했어요.", 500, origin);
      }
      logDiag({ action, decision, question: first.source, reason: first.reason ?? null });
      return json({ ok: true, status: "approved", first_question: first.question, question_source: first.source }, 200, origin);
    }

    return fail(CODES.BAD_REQUEST, "알 수 없는 요청이에요.", 400, origin);
  } catch {
    return fail(CODES.ERROR, "서버 오류가 발생했어요.", 500, origin);
  }
});
