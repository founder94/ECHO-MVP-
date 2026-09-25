// doit-agent — ECHO Conversation Agent 운영 서버(2026-09-25, 대표 「구현 → 운영배포 → 운영검증」 FINAL).
// - 모든 요청은 getUser() 실검증. 관리자 요청은 profiles.role = 'admin' 을 서버가 다시 확인한다(doit-connect 와 같은 방식).
// - DB·RLS 변경 0: 기존 표만 쓴다.
//   · 대화 상태 = doit_request_events 한 줄(action "agent_session", request_id = 세션 id, response_payload = 상태, applied_revision = 판 번호 — 동시 쓰기 막기)
//   · 턴 기록 = doit_request_events 한 줄(action "agent_turn", request_id = 화면이 만든 요청 id → 같은 요청 재전송은 저장된 결과를 돌려준다, target_id = 세션 id)
//   · 매칭에 쓰는 답 = 기존 RPC doit_apply_record_create 로 doit_records 에(소개 초안·연결 화면이 그대로 읽는다)
// - 모델 = 기존 승인 모델(resolveModel(OPENAI_MODEL) · 운영 Secret 그대로 · 새 키 0). 호출 주소는 환경변수로 바꿀 수 없다.
// - 로그에는 코드·개수·시간만 남긴다(사용자 원문·토큰·키 0).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import * as A from "./agent.ts";

type Db = SupabaseClient;
type Json = Record<string, unknown>;

const SESSION_ACTION = "agent_session";
const TURN_ACTION = "agent_turn";
const ACTIONS = new Set(["agent_get", "agent_start", "agent_turn", "agent_intro", "agent_intro_mark", "admin_sessions", "admin_session"]);
const INTRO_USES = new Set(["as_is", "edited", "own"]);
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const TEXT_MAX = 1000;
const BODY_MAX_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const CALL_TIMEOUT_MS = 18_000;
const ADMIN_LIST_MAX = 50;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function resolveModel(raw: string | undefined): string {
  const model = (raw ?? "").trim();
  return !model || model === "gpt-40-mini" ? "gpt-4o-mini" : model;
}

const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const corsHeaders = (origin: string | null): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});
const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
const fail = (code: string, error: string, status: number, origin: string | null) => json({ ok: false, code, error }, status, origin);

const buckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (buckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { buckets.set(userId, arr); return true; }
  arr.push(now); buckets.set(userId, arr); return false;
}
function logDiag(fields: Json): void {
  try { console.log(JSON.stringify({ evt: "doit_agent", ...fields })); } catch { /* 로그 실패는 무시 */ }
}
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// 턴 요청 id 에서 기록용 요청 id 를 정해진 방식으로 만든다 → 같은 턴을 다시 저장해도 RPC 가 같은 기록을 돌려준다.
async function derivedUuid(seed: string): Promise<string> {
  const h = await sha256(seed);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function roundStartOf(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const raw = user.user_metadata?.doit_round_started_at;
  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
}

class ProviderError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
// OpenAI 한 번 부르기. 응답의 실제 모델 이름·토큰 수(usage)를 함께 돌려준다(관리자 관측).
function openAI(apiKey: string, model: string): A.Llm {
  return async (_kind, system, input) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, ...A.AGENT_PARAMS, response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(input) }] }),
      });
      if (!res.ok) throw new ProviderError(`http_${res.status}`);
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
      if (!text) throw new ProviderError("empty");
      const usage = data?.usage ?? {};
      return { text, model: typeof data?.model === "string" ? data.model : null,
        input_tokens: Number.isFinite(usage.prompt_tokens) ? usage.prompt_tokens : null, output_tokens: Number.isFinite(usage.completion_tokens) ? usage.completion_tokens : null };
    } catch (e) {
      if (ctrl.signal.aborted) throw new ProviderError("timeout");
      throw e instanceof ProviderError ? e : new ProviderError("network");
    } finally { clearTimeout(timer); }
  };
}

interface SessionRow { request_id: string; user_id: string; created_at: string; updated_at: string; applied_revision: number | null; response_payload: Json | null }
interface Stored { agent: string; state: A.AgentState; round_since: string | null; profile?: A.MatchingProfile | null; handoff?: Json | null }

// 화면에 줄 모습. 내부 상태(추측·되묻기 수 등)는 주지 않는다.
export function sessionView(id: string, stored: Stored) {
  const st = stored.state;
  const messages: { role: "ai" | "user"; text: string }[] = [];
  st.turns.forEach((t, k) => {
    if (k === 0 && t.ai) messages.push({ role: "ai", text: t.ai });
    messages.push({ role: "user", text: t.user });
    if (t.reply) messages.push({ role: "ai", text: t.reply });
    if (t.question) messages.push({ role: "ai", text: t.question });
    if ((t.decision ?? "").startsWith("finish") && st.closing) messages.push({ role: "ai", text: st.closing });
  });
  if (!st.turns.length) { if (st.opening_reply) messages.push({ role: "ai", text: st.opening_reply }); if (st.current) messages.push({ role: "ai", text: st.current.text }); }
  const done = st.phase !== "talk";
  return {
    id, agent: stored.agent, tone: st.tone, mode: st.mode, phase: done ? "done" : "talk",
    progress: { asked: A.coreAsked(st).length, of: A.MAX_CORE_QUESTIONS },
    current_question: st.current?.text ?? null, current_hint: done ? null : st.current?.hint ?? null, messages,
    summary: done ? st.summary : [], closing: done ? st.closing : null,
    profile: done ? A.matchingProfile(st) : null, handoff: done ? stored.handoff ?? null : null,
    // v1.6 소개 초안: 문장과 상태만(근거 인용·버린 이유는 관리자 화면에서만).
    intro: done && st.intro ? { status: st.intro.status, text: A.introText(st.intro), lines: st.intro.lines.map((l) => l.text), tries_left: Math.max(0, A.INTRO_TRIES_MAX - st.intro.tries), used: st.intro.used } : null,
  };
}

async function currentSession(admin: Db, userId: string, since: string | null): Promise<SessionRow | null> {
  let q = admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, applied_revision, response_payload")
    .eq("user_id", userId).eq("action", SESSION_ACTION).eq("status", "applied");
  if (since) q = q.gte("created_at", since);
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  const row = (data ?? [])[0] as SessionRow | undefined;
  return row && row.response_payload && typeof row.response_payload === "object" ? row : null;
}

async function isAdmin(admin: Db, userId: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return !!data && String(data.role) === "admin";
}

// 한 턴(또는 시작의 첫 답)을 돌리고 결과를 저장한다. 판 번호가 바뀌었으면(다른 창에서 먼저 저장) 저장하지 않고 409.
async function runAndSave(ctx: { admin: Db; userId: string; llm: A.Llm; model: string; origin: string | null }, sessionId: string, stored: Stored, rev: number, text: string, requestId: string, fresh: boolean) {
  const t0 = Date.now();
  const st = stored.state;
  const before = st.turns.length;
  const { obs, response } = await A.runTurn(st, text, ctx.llm);
  if (response.error) {
    logDiag({ step: "turn", code: response.error, calls: obs.calls.length, retry: obs.retry });
    return fail(response.error === "PROVIDER" ? "AI_ERROR" : "AI_READ_FAILED", "AI 가 답을 만들지 못했어요. 적은 말은 그대로 있으니 다시 보내 주세요.", 502, ctx.origin);
  }
  const lastTurn = st.turns.length > before ? st.turns.at(-1) : undefined; // 저장 금지 입력·대화 상한은 턴을 만들지 않는다
  if (response.finish || response.after) { stored.profile = A.matchingProfile(st); stored.handoff = A.matchingHandoff(stored.profile); }
  // 1) 상태 저장(판 번호 확인) — 이긴 쪽만 아래 기록을 남긴다.
  if (fresh) {
    const { error } = await ctx.admin.from("doit_request_events").insert({ user_id: ctx.userId, request_id: sessionId, action: SESSION_ACTION, status: "applied", payload_hash: "", applied_revision: rev + 1, response_payload: stored });
    if (error) return fail("REQUEST_CONFLICT", "대화를 시작하지 못했어요. 다시 눌러 주세요.", 409, ctx.origin);
  } else {
    const { data, error } = await ctx.admin.from("doit_request_events").update({ response_payload: stored, applied_revision: rev + 1 })
      .eq("user_id", ctx.userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).eq("applied_revision", rev).select("request_id");
    if (error || !data || !data.length) return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 이어졌어요. 새로 불러올게요.", 409, ctx.origin);
  }
  // 2) 매칭에 쓰는 답이면 기록으로도 남긴다(기존 RPC · 같은 턴은 같은 기록).
  let recordId: string | null = null; let recordError: string | null = null;
  if (response.saved === true && lastTurn) {
    const { data, error } = await ctx.admin.rpc("doit_apply_record_create", { p_user_id: ctx.userId, p_request_id: await derivedUuid(`${requestId}:record`), p_action: "record_create",
      p_payload_hash: await sha256(text), p_text: text, p_original_text: text, p_emotion: "", p_status: "confirmed" });
    const out = data as { ok?: boolean; record?: { id?: string } } | null;
    if (error || !out?.ok) recordError = "record_save_failed"; else recordId = out.record?.id ?? null;
  }
  // 2-1) 「아까 말했는데」처럼 앞선 말에서 되살린 정보: 그 앞선 말(사용자 원문)을 그 턴의 기록으로 남긴다(같은 턴은 같은 기록 · 항의 문장은 남기지 않음).
  for (const n of lastTurn?.recovered_from ?? []) {
    const earlier = st.turns.find((t) => t.n === n); if (!earlier?.user) continue;
    const { data, error } = await ctx.admin.rpc("doit_apply_record_create", { p_user_id: ctx.userId, p_request_id: await derivedUuid(`${sessionId}:turn:${n}:record`), p_action: "record_create",
      p_payload_hash: await sha256(earlier.user), p_text: earlier.user, p_original_text: earlier.user, p_emotion: "", p_status: "confirmed" });
    const out = data as { ok?: boolean } | null;
    if (error || !out?.ok) recordError = recordError ?? "recovered_record_save_failed";
  }
  // 3) 턴 기록(관리자 관측 · 실패/성공 후보의 재료). 원문은 상태에 있고 여기엔 코드·수치만.
  const view = sessionView(sessionId, stored);
  const kind = String(response.kind ?? "");
  const text4 = [response.reply, response.closing, response.question].filter((x) => typeof x === "string" && x).join("\n");
  const record = {
    turn_index: lastTurn?.n ?? null, session_id: sessionId, agent: A.AGENT_VERSION, input_mode: st.mode, tone: st.tone, kind,
    saved: response.saved === true, extracted: lastTurn?.extracted ?? [], recovered: lastTurn?.recovered ?? [], recovered_from: lastTurn?.recovered_from ?? [], dropped: lastTurn?.dropped ?? null, hint_shown: !!lastTurn?.hint, question_check: lastTurn?.check ?? null, decision: lastTurn?.decision ?? kind, question_index: A.coreAsked(st).length,
    question_purpose: lastTurn?.question_purpose ?? null, next_purpose: response.question_purpose ?? null,
    flags: { correction: kind === "correction", rejection: kind === "repair", complaint: kind === "repair", skip: kind === "skip", fatigue: kind === "stop", unsure: kind === "unsure", ask: kind === "ask", help: kind === "help", blocked: kind === "blocked" },
    provider: "openai", model_requested: ctx.model, calls: obs.calls, retry: obs.retry, fallback: 0,
    tone_mismatch_observed: text4 ? A.toneMismatch(st.tone, text4) : false, id_leak: A.leaksId(text4),
    record_id: recordId, record_error: recordError, total_ms: Date.now() - t0,
  };
  const turnOut = { kind, reply: response.reply ?? "", question: response.question ?? null, saved: response.saved === true, finish: response.finish === true, after: response.after === true };
  const { error: turnError } = await ctx.admin.from("doit_request_events").insert({ user_id: ctx.userId, request_id: requestId, action: TURN_ACTION, target_id: sessionId, status: "applied",
    payload_hash: await sha256(`${sessionId}:${text}`), applied_revision: rev + 1, response_payload: { turn: turnOut, record } });
  logDiag({ step: "turn", kind, saved: record.saved, decision: record.decision, q: record.question_index, calls: obs.calls.length, retry: obs.retry,
    tokens_in: obs.calls.reduce((n, c) => n + (c.input_tokens ?? 0), 0), tokens_out: obs.calls.reduce((n, c) => n + (c.output_tokens ?? 0), 0),
    model: obs.calls.find((c) => c.model)?.model ?? null, record_error: recordError, turn_log_error: !!turnError, ms: record.total_ms,
    ...(response.finish ? { intro: st.intro?.status ?? null, intro_lines: st.intro?.lines.length ?? 0, intro_dropped: st.intro?.dropped ?? {}, intro_error: st.intro?.error ?? null } : {}) });
  return json({ ok: true, session: view, turn: turnOut }, 200, ctx.origin);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail("BAD_REQUEST", "잘못된 요청이에요.", 405, origin);
  try {
    if (Number(req.headers.get("content-length") ?? 0) > BODY_MAX_BYTES) return fail("TOO_LARGE", "요청이 너무 커요.", 413, origin);
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) return fail("ERROR", "서버 저장 설정이 필요해요.", 500, origin);
    const sb: Db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
    const admin: Db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const userId = user.id;
    if (rateLimited(userId)) return fail("RATE_LIMITED", "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.", 429, origin);

    const body = (await req.json().catch(() => null)) as Json | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail("BAD_REQUEST", "요청 형식이 잘못됐어요.", 400, origin);
    const action = typeof body.action === "string" ? body.action : "";
    if (!ACTIONS.has(action)) return fail("BAD_REQUEST", "알 수 없는 요청이에요.", 400, origin);
    const since = roundStartOf(user);

    if (action === "agent_get") {
      const row = await currentSession(admin, userId, since);
      return json({ ok: true, session: row ? sessionView(row.request_id, row.response_payload as unknown as Stored) : null }, 200, origin);
    }

    if (action === "admin_sessions" || action === "admin_session") {
      if (!(await isAdmin(admin, userId))) return fail("FORBIDDEN", "관리자 권한이 없어요.", 403, origin);
      if (action === "admin_sessions") {
        const { data, error } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, applied_revision, response_payload")
          .eq("action", SESSION_ACTION).eq("status", "applied").order("updated_at", { ascending: false }).limit(ADMIN_LIST_MAX);
        if (error) return fail("ERROR", "대화 목록을 읽지 못했어요.", 500, origin);
        const rows = (data ?? []) as SessionRow[];
        const ids = rows.map((r) => r.request_id);
        const { data: turns } = ids.length ? await admin.from("doit_request_events").select("target_id, created_at, response_payload").eq("action", TURN_ACTION).in("target_id", ids).limit(2000) : { data: [] };
        const userIds = [...new Set(rows.map((r) => r.user_id))];
        const { data: profs } = userIds.length ? await admin.from("profiles").select("id, nickname, verification_status, bio").in("id", userIds) : { data: [] };
        const profRows = (profs ?? []) as { id: string; nickname: string | null; verification_status: string | null; bio: string | null }[];
        const nick = new Map(profRows.map((p) => [p.id, p.nickname]));
        // 연결 준비의 부족 조건(MASTER §20): 참·거짓만 보낸다. 전화번호·인증번호·소개 글은 보내지 않는다.
        const ready = new Map(profRows.map((p) => [p.id, { phone_verified: p.verification_status === "verified", intro_saved: !!(p.bio ?? "").trim() }]));
        // 사진은 이미 있는 칸만 읽는다(장수·대표 사진·마지막으로 올린 시각). 사진 파일·주소는 주지 않는다. 최근 2개월 확인 상태는 저장하는 칸이 없다(새 칸 = 승인 필요).
        const { data: photoRows } = userIds.length ? await admin.from("profile_photos").select("user_id, is_primary, updated_at").in("user_id", userIds) : { data: [] };
        const photos = new Map<string, { count: number; primary: boolean; last_updated_at: string | null }>();
        for (const ph of (photoRows ?? []) as { user_id: string; is_primary: boolean | null; updated_at: string | null }[]) {
          const cur = photos.get(ph.user_id) ?? { count: 0, primary: false, last_updated_at: null };
          cur.count++; if (ph.is_primary) cur.primary = true; if (ph.updated_at && (!cur.last_updated_at || ph.updated_at > cur.last_updated_at)) cur.last_updated_at = ph.updated_at;
          photos.set(ph.user_id, cur);
        }
        return json({ ok: true, sessions: rows.map((r) => ({ id: r.request_id, user: r.user_id.slice(0, 8), nickname: nick.get(r.user_id) ?? null, created_at: r.created_at, updated_at: r.updated_at, stored: r.response_payload, photos: photos.get(r.user_id) ?? { count: 0, primary: false, last_updated_at: null }, readiness: ready.get(r.user_id) ?? { phone_verified: false, intro_saved: false } })),
          turns: ((turns ?? []) as { target_id: string; created_at: string; response_payload: Json | null }[]).map((t) => ({ session_id: t.target_id, created_at: t.created_at, record: (t.response_payload as Json | null)?.record ?? null })) }, 200, origin);
      }
      const id = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      if (!id) return fail("BAD_REQUEST", "대화를 골라 주세요.", 400, origin);
      const { data: row } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, response_payload").eq("action", SESSION_ACTION).eq("request_id", id).maybeSingle();
      if (!row) return fail("NOT_FOUND", "대화를 찾지 못했어요.", 404, origin);
      const { data: turns } = await admin.from("doit_request_events").select("created_at, response_payload").eq("action", TURN_ACTION).eq("target_id", id).order("created_at", { ascending: true }).limit(200);
      return json({ ok: true, session: { id, user: String(row.user_id).slice(0, 8), created_at: row.created_at, updated_at: row.updated_at, stored: row.response_payload },
        turns: ((turns ?? []) as { created_at: string; response_payload: Json | null }[]).map((t) => ({ created_at: t.created_at, record: t.response_payload?.record ?? null })) }, 200, origin);
    }

    // ── 대화(agent_start · agent_turn)
    const requestId = typeof body.requestId === "string" && UUID.test(body.requestId) ? body.requestId : "";
    if (!requestId) return fail("BAD_REQUEST", "요청 식별값이 없어요.", 400, origin);
    const { data: prior } = await admin.from("doit_request_events").select("action, status, target_id, response_payload").eq("user_id", userId).eq("request_id", requestId).maybeSingle();
    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = resolveModel(Deno.env.get("OPENAI_MODEL"));
    const ctx = { admin, userId, llm: openAI(apiKey, model), model, origin };

    if (action === "agent_start") {
      // 이번 회차에 이미 대화가 있으면 새로 만들지 않고 그것을 돌려준다(같은 요청 재전송 포함).
      const existing = await currentSession(admin, userId, since);
      if (existing) return json({ ok: true, session: sessionView(existing.request_id, existing.response_payload as unknown as Stored), existing: true }, 200, origin);
      if (prior) return fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
      if (!apiKey) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
      const tone = A.isTone(body.tone) ? body.tone : A.DEFAULT_TONE;
      const mode = body.mode === "VOICE" ? "VOICE" : "TEXT";
      const first = typeof body.firstAnswer === "string" ? body.firstAnswer.trim().slice(0, TEXT_MAX) : "";
      const stored: Stored = { agent: A.AGENT_VERSION, state: A.newState({ tone, mode }), round_since: since, profile: null, handoff: null };
      if (first) {
        // 앱의 첫 질문(목적 타일 화면)에 한 답 = 첫 턴. 세션 id 는 요청 id 에서 만들고, 턴 기록은 요청 id 로 남긴다.
        A.seedFirstQuestion(stored.state);
        return await runAndSave(ctx, await derivedUuid(`${requestId}:session`), stored, 0, first, requestId, true);
      }
      const obs: A.Obs = { calls: [], retry: [] };
      const opened = await A.runOpening(stored.state, ctx.llm, obs).catch(() => null);
      if (!opened) { logDiag({ step: "opening", code: "failed", calls: obs.calls.length }); return fail("AI_ERROR", "첫 질문을 만들지 못했어요. 다시 눌러 주세요.", 502, origin); }
      const { error } = await admin.from("doit_request_events").insert({ user_id: userId, request_id: requestId, action: SESSION_ACTION, status: "applied", payload_hash: "", applied_revision: 1, response_payload: stored });
      if (error) return fail("REQUEST_CONFLICT", "대화를 시작하지 못했어요. 다시 눌러 주세요.", 409, origin);
      logDiag({ step: "opening", calls: obs.calls.length, model: obs.calls.find((c) => c.model)?.model ?? null });
      return json({ ok: true, session: sessionView(requestId, stored) }, 200, origin);
    }

    // v1.6 소개 초안 다시 쓰기 · 사용자가 고른 것 기록(agent_intro · agent_intro_mark). 판 번호로 동시 쓰기를 막는다. 턴 기록·doit_records 는 만들지 않는다.
    if (action === "agent_intro" || action === "agent_intro_mark") {
      const sid = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
      if (!sid) return fail("BAD_REQUEST", "대화를 찾지 못했어요.", 400, origin);
      const { data: row } = await admin.from("doit_request_events").select("request_id, created_at, applied_revision, response_payload")
        .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).maybeSingle();
      if (!row || !row.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
      const stored = row.response_payload as unknown as Stored;
      if (stored.state.phase === "talk") return fail("NOT_READY", "다섯 가지 이야기를 마친 뒤에 소개를 쓸 수 있어요.", 409, origin);
      const rev = Number(row.applied_revision ?? 0);
      let obs: A.Obs = { calls: [], retry: [] }; let limited = false;
      if (action === "agent_intro_mark") {
        const how = typeof body.how === "string" && INTRO_USES.has(body.how) ? body.how as "as_is" | "edited" | "own" : null;
        if (!how) return fail("BAD_REQUEST", "잘못된 요청이에요.", 400, origin);
        const base = stored.state.intro ?? { status: "none" as const, lines: [], dropped: {}, tries: 0, error: null, used: null, used_at: null };
        stored.state.intro = { ...base, used: how, used_at: new Date().toISOString() };
      } else {
        if (!apiKey) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
        const r = await A.draftIntro(stored.state, ctx.llm, obs); obs = r.obs; limited = r.limited;
      }
      if (!limited) {
        const { data, error } = await admin.from("doit_request_events").update({ response_payload: stored, applied_revision: rev + 1 })
          .eq("user_id", userId).eq("request_id", sid).eq("action", SESSION_ACTION).eq("applied_revision", rev).select("request_id");
        if (error || !data || !data.length) return fail("REQUEST_CONFLICT", "다른 화면에서 먼저 바뀌었어요. 새로 불러올게요.", 409, origin);
      }
      const intro = stored.state.intro;
      logDiag({ step: action, intro: intro?.status ?? null, lines: intro?.lines.length ?? 0, dropped: intro?.dropped ?? {}, error: intro?.error ?? null, used: intro?.used ?? null, limited,
        calls: obs.calls.length, tokens_in: obs.calls.reduce((n, c) => n + (c.input_tokens ?? 0), 0), tokens_out: obs.calls.reduce((n, c) => n + (c.output_tokens ?? 0), 0), model: obs.calls.find((c) => c.model)?.model ?? null });
      return json({ ok: true, session: sessionView(sid, stored), limited }, 200, origin);
    }

    // agent_turn
    const sessionId = typeof body.sessionId === "string" && UUID.test(body.sessionId) ? body.sessionId : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!sessionId || !text) return fail("BAD_REQUEST", "보낼 말을 적어 주세요.", 400, origin);
    if (text.length > TEXT_MAX) return fail("TOO_LARGE", `한 번에 ${TEXT_MAX}자까지 보낼 수 있어요.`, 400, origin);
    if (prior) {
      const p = prior.response_payload as Json | null;
      if (prior.action === TURN_ACTION && prior.target_id === sessionId && p?.turn) {
        const { data: again } = await admin.from("doit_request_events").select("request_id, response_payload").eq("user_id", userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).maybeSingle();
        if (again) return json({ ok: true, session: sessionView(sessionId, again.response_payload as unknown as Stored), turn: p.turn, duplicate: true }, 200, origin);
      }
      return fail("REQUEST_CONFLICT", "같은 요청 식별값이 이미 쓰였어요.", 409, origin);
    }
    const { data: row } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, applied_revision, response_payload")
      .eq("user_id", userId).eq("request_id", sessionId).eq("action", SESSION_ACTION).maybeSingle();
    if (!row || !row.response_payload) return fail("NOT_FOUND", "대화를 찾지 못했어요. 새로 불러올게요.", 404, origin);
    const stored = row.response_payload as unknown as Stored;
    if (since && (stored.round_since ?? null) !== since && String(row.created_at) < since) return fail("ROUND_CHANGED", "처음부터 다시 시작한 대화예요. 새로 불러올게요.", 409, origin);
    if (!apiKey) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);
    return await runAndSave(ctx, sessionId, stored, Number(row.applied_revision ?? 0), text, requestId, false);
  } catch (e) {
    logDiag({ step: "unhandled", code: e instanceof Error ? e.name : "unknown" });
    return fail("ERROR", "서버 오류가 발생했어요.", 500, origin);
  }
});
