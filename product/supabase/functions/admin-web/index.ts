// ADMIN WEB 서버(admin-web) — 대표·운영자 전용 읽기 서버. 2026-09-28 대표 「ADMIN WEB FINAL BUILD ORDER」.
// 보안: 화면 숨김이 아니라 여기서 막는다 — 로그인 토큰 진위(getUser) → profiles.role = 'admin' 확인(서비스 권한으로 다시 읽음) → 아니면 403, 자료 0.
// 이 함수는 어떤 표에도 쓰지 않는다(insert·update·delete 0). 비밀값·키 값은 응답에 넣지 않는다.
import { readJsonObject, RequestProblem } from "../_shared/read-json-limited.ts";
import { browserOriginAllowed, browserCorsHeaders } from "../_shared/browser-cors.ts";
import { durableRateDecision, makeLocalLimiter } from "../_shared/durable-rate-limit.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { AGENT_VERSION, type AgentState } from "../doit-agent/agent.ts";
import * as L from "./logic.ts";

type Db = SupabaseClient;
type Json = Record<string, unknown>;
export const ADMIN_WEB_VERSION = "admin-web-v1.0.0";
const ACTIONS = new Set(["overview", "users", "sessions", "session", "safety", "sources"]);
const BODY_MAX_BYTES = 8 * 1024;
const adminRateLimited = makeLocalLimiter(10);
const PAGE = 1000;
const ROW_CAP = 20_000; // 한 번에 읽는 줄 상한(넘으면 truncated 로 알린다 — 숫자를 지어내지 않는다)

const ALLOWED_ORIGINS = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") ?? Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const corsHeaders = (origin: string | null): Record<string, string> => browserCorsHeaders(origin, ALLOWED_ORIGINS);

const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (code: string, message: string, status: number, origin: string | null) => json({ ok: false, code, message }, status, origin);

// 여러 쪽으로 나눠 읽는다. 표가 없거나 읽지 못하면 error 를 돌려준다(0 으로 바꾸지 않는다).
async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, cap = ROW_CAP): Promise<{ rows: T[]; error: string | null; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await build(from, Math.min(from + PAGE, cap) - 1);
    if (error) return { rows, error: String((error as { code?: string; message?: string }).code ?? (error as { message?: string }).message ?? "error"), truncated: false };
    const got = (data ?? []) as T[];
    rows.push(...got);
    if (got.length < Math.min(PAGE, cap - from)) return { rows, error: null, truncated: false };
    if (from + PAGE >= cap) return { rows, error: null, truncated: true };
  }
  return { rows, error: null, truncated: true };
}
// 세션 줄은 대화 상태 전체가 커서(운영 QA 실측: 30일 1,081개 전체를 읽으면 함수 자원 한도 546) 판정에 쓰는 칸만 골라 읽는다.
const SESSION_SLIM = "request_id, user_id, created_at, updated_at, agent:response_payload->agent, goal:response_payload->state->goal, goal_label:response_payload->state->goal_label, phase:response_payload->state->phase, asked:response_payload->state->asked, turns:response_payload->state->turns, summary:response_payload->state->summary, closing:response_payload->state->closing, intro:response_payload->state->intro";
type SlimRow = L.SessionRowIn & { agent?: string; goal?: string; goal_label?: string; phase?: string; asked?: unknown; turns?: unknown; summary?: unknown; closing?: unknown; intro?: unknown };
// 가짜 DB(검사)는 전체 줄을, 실제 서버는 골라 읽은 칸을 준다 — 둘 다 같은 모양으로.
function unslim(r: SlimRow): L.SessionRowIn {
  if (r.response_payload) return r;
  const state = { goal: r.goal, goal_label: r.goal_label, phase: r.phase, asked: r.asked ?? [], turns: r.turns ?? [], summary: r.summary ?? [], closing: r.closing ?? null, intro: r.intro ?? null, slots: {}, inferred: [] } as unknown as AgentState;
  return { request_id: r.request_id, user_id: r.user_id, created_at: r.created_at, updated_at: r.updated_at, response_payload: { agent: r.agent, state } };
}
const TURN_SLIM = "user_id, target_id, created_at, status, kind:response_payload->record->>kind, agent:response_payload->record->>agent, saved:response_payload->record->saved, record_error:response_payload->record->>record_error";
type TurnSlim = L.TurnRowIn & { kind?: string; agent?: string; saved?: boolean; record_error?: string | null };
function unslimTurn(t: TurnSlim): L.TurnRowIn { return t.response_payload ? t : { ...t, response_payload: { record: { kind: t.kind, agent: t.agent, saved: t.saved, record_error: t.record_error } } }; }
export const SESSION_SAMPLE = 600; // 대시보드 품질 판정에 쓰는 최근 대화 수(넘으면 「최근 N개 기준」으로 알린다)

async function countOf(admin: Db, table: string): Promise<{ n: number | null; error: string | null }> {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  return error ? { n: null, error: String((error as { code?: string }).code ?? "error") } : { n: count ?? 0, error: null };
}

interface Profile { id: string; email: string | null; nickname: string | null; display_name: string | null; role: string | null; created_at: string; purpose_id: string | null; purpose_label: string | null; bio: string | null; verification_status: string | null }
interface Report { id: string; reporter_id: string; target_user_id: string; reason: string | null; detail: string | null; status: string | null; created_at: string }
interface Block { id: string; blocker_id: string; blocked_user_id: string; reason: string | null; created_at: string }

async function googleEnabled(url: string, anon: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } });
    if (!r.ok) return null;
    const s = await r.json() as { external?: Record<string, boolean> };
    return typeof s.external?.google === "boolean" ? s.external.google : null;
  } catch { return null; }
}

export async function handle(req: Request, env: { url: string; anon: string; service: string }, clients?: { user: Db; admin: Db }): Promise<Response> {
  const origin = req.headers.get("Origin");
  if (!browserOriginAllowed(origin, ALLOWED_ORIGINS)) return fail("FORBIDDEN", "허용되지 않은 요청이에요.", 403, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail("BAD_REQUEST", "잘못된 요청이에요.", 405, origin);
  if (Number(req.headers.get("content-length") ?? 0) > BODY_MAX_BYTES) return fail("TOO_LARGE", "요청이 너무 커요.", 413, origin);
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
  if (!env.service) return fail("ERROR", "서버 설정이 필요해요.", 500, origin);
  const sb: Db = clients?.user ?? createClient(env.url, env.anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
  const admin: Db = clients?.admin ?? createClient(env.url, env.service, { auth: { persistSession: false } });
  // 관리자 확인: 서비스 권한으로 profiles.role 을 다시 읽는다(화면이 보낸 값 · 토큰 속 값은 믿지 않는다).
  const { data: me, error: meError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (meError) return fail("ADMIN_CHECK_FAILED", "관리자 확인을 하지 못했어요.", 500, origin);
  if (!me || String((me as { role?: unknown }).role) !== "admin") return fail("FORBIDDEN", "관리자 권한이 없어요.", 403, origin);
  const rate = await durableRateDecision(admin, user.id, "admin", Deno.env.get("ECHO_DURABLE_RATE_LIMIT_ENABLED") === "true");
  if (rate === "unavailable") return fail("ERROR", "요청 제한을 확인하지 못했어요.", 503, origin);
  if (rate === "limited" || (rate === "disabled" && adminRateLimited(user.id))) return fail("RATE_LIMITED", "잠시 후 다시 시도해 주세요.", 429, origin);

  let body: Json;
  try { body = await readJsonObject(req, BODY_MAX_BYTES); }
  catch (error) {
    if (error instanceof RequestProblem) return fail(error.code, error.message, error.status, origin);
    return fail("BAD_REQUEST", "요청을 읽지 못했어요.", 400, origin);
  }
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return fail("BAD_REQUEST", "알 수 없는 요청이에요.", 400, origin);
  const period: L.Period = L.PERIODS.includes(body?.period as L.Period) ? body!.period as L.Period : "today";
  const since = L.periodStart(period);
  const asOf = new Date().toISOString();

  try {
    if (action === "overview") {
      const [profiles, sessions, turns, events, reports, blocks, matches, google] = await Promise.all([
        readAll<Profile>((a, b) => admin.from("profiles").select("id, role, created_at, bio").range(a, b)),
        readAll<SlimRow>((a, b) => admin.from("doit_request_events").select(SESSION_SLIM).eq("action", "agent_session").gte("updated_at", since).order("updated_at", { ascending: false }).range(a, b), SESSION_SAMPLE),
        readAll<TurnSlim>((a, b) => admin.from("doit_request_events").select(TURN_SLIM).eq("action", "agent_turn").gte("created_at", since).range(a, b)),
        readAll<{ user_id: string }>((a, b) => admin.from("doit_request_events").select("user_id").gte("created_at", since).range(a, b)),
        readAll<Report>((a, b) => admin.from("user_reports").select("id, reason, status, created_at").range(a, b)),
        readAll<Block>((a, b) => admin.from("blocks").select("id, created_at").range(a, b)),
        readAll<{ id: string; status: string; created_at: string }>((a, b) => admin.from("doit_matches").select("id, status, created_at").range(a, b)),
        googleEnabled(env.url, env.anon),
      ]);
      const dataErrors = [["사용자", profiles], ["대화", sessions], ["대화 기록", turns], ["활동", events], ["신고", reports], ["차단", blocks], ["연결", matches]]
        .filter(([, r]) => (r as { error: string | null }).error).map(([n]) => n as string);
      sessions.rows = sessions.rows.map(unslim) as SlimRow[]; turns.rows = turns.rows.map(unslimTurn) as TurnSlim[];
      // 표본(최근 N개)을 넘으면 시작·완료 수는 표에서 따로 센다(표본 수를 전체처럼 보이지 않게).
      const { count: startedCount } = sessions.truncated ? await admin.from("doit_request_events").select("*", { count: "exact", head: true }).eq("action", "agent_session").gte("created_at", since) : { count: null };
      const { count: doneCount } = sessions.truncated ? await admin.from("doit_request_events").select("*", { count: "exact", head: true }).eq("action", "agent_session").gte("created_at", since).neq("response_payload->state->>phase", "talk") : { count: null };
      const people = profiles.rows.filter((p) => p.role !== "admin");
      const started = sessions.rows.filter((s) => s.created_at >= since);
      const sums = sessions.rows.map(L.sessionSummary);
      const quality: Record<L.QualityKey, number> = { repeat: 0, goal_mismatch: 0, counsel: 0, correction_ignored: 0, unsure_repeat: 0, summary_mismatch: 0 };
      for (const s of sums) if (s.quality) for (const k of Object.keys(quality) as L.QualityKey[]) quality[k] += s.quality[k];
      const labelOnly = L.labelOnlyPairs(sessions.rows.map((r) => ({ goal: r.response_payload?.state?.goal ?? "open", questions: r.response_payload?.state ? L.shownQuestions(r.response_payload.state as AgentState) : [] })));
      const failedTurns = turns.rows.filter(L.turnFailed);
      const records = turns.rows.map((t) => (t.response_payload?.record ?? {}) as Json);
      const correctionTurns = records.filter((r) => r.kind === "correction");
      const qualityTotal = Object.values(quality).reduce((a, b) => a + b, 0) + labelOnly.length;
      const openReports = reports.rows.filter((r) => (r.status ?? "open") !== "resolved" && r.status !== "closed");
      const severe = openReports.filter((r) => L.SEVERE.test(String(r.reason ?? "")));
      const top = (Object.entries(quality) as [L.QualityKey, number][]).sort((a, b) => b[1] - a[1])[0];
      const lastOk = turns.rows.filter((t) => !L.turnFailed(t)).map((t) => t.created_at).sort().at(-1) ?? null;
      const agentSeen = records.map((r) => r.agent).filter((x): x is string => typeof x === "string");
      const health = L.serviceHealth({ turns: turns.rows.length, failedTurns: failedTurns.length, quality: qualityTotal, openReports: openReports.length, severeReports: severe.length, dataErrors });
      return json({
        ok: true, asOf, period, since, server: ADMIN_WEB_VERSION, health,
        truncated: [profiles, turns, events].some((r) => r.truncated), quality_sample: sessions.truncated ? SESSION_SAMPLE : null,
        users: {
          total: profiles.error ? null : people.length,
          signups: profiles.error ? null : people.filter((p) => p.created_at >= since).length,
          active: events.error ? null : new Set(events.rows.map((e) => e.user_id)).size,
          conversations_started: sessions.error ? null : sessions.truncated ? (startedCount ?? null) : started.length,
          conversations_done: sessions.error ? null : sessions.truncated ? (doneCount ?? null) : started.filter((s) => s.response_payload?.state && s.response_payload.state.phase !== "talk").length,
          intro_saved: profiles.error ? null : people.filter((p) => (p.bio ?? "").trim()).length,
        },
        ai: {
          turns: turns.error ? null : turns.rows.length,
          failed: turns.error ? null : failedTurns.length,
          ok_sessions: sessions.error ? null : sums.filter((s) => s.done && !s.quality_total).length,
          corrections: turns.error ? null : correctionTurns.length,
          correction_not_saved: turns.error ? null : correctionTurns.filter((r) => r.saved !== true).length,
          profile_save_failed: turns.error ? null : records.filter((r) => typeof r.record_error === "string" && r.record_error).length,
          quality, quality_label: L.QUALITY_LABEL, label_only: labelOnly.length, label_only_samples: labelOnly.slice(0, 3),
          last_ok_at: lastOk, agent_seen: [...new Set(agentSeen)].slice(0, 3), agent_server: AGENT_VERSION,
        },
        matching: {
          total: matches.error ? null : matches.rows.length,
          by_status: matches.error ? null : matches.rows.reduce((m, r) => ({ ...m, [r.status]: ((m as Record<string, number>)[r.status] ?? 0) + 1 }), {} as Record<string, number>),
        },
        safety: {
          reports: reports.error ? null : reports.rows.length, open: reports.error ? null : openReports.length,
          severe: reports.error ? null : severe.length, blocks: blocks.error ? null : blocks.rows.length,
        },
        auth: { google },
        decisions: L.decisions({ severeReports: severe.length, openReports: openReports.length, failedTurns: failedTurns.length, qualityTop: top && top[1] ? { label: L.QUALITY_LABEL[top[0]], n: top[1] } : null, eligible: null, candidates: null, google }),
        errors: dataErrors,
      }, 200, origin);
    }

    if (action === "users") {
      const [profiles, photos, events, reports, blocks] = await Promise.all([
        readAll<Profile>((a, b) => admin.from("profiles").select("id, email, nickname, display_name, role, created_at, purpose_id, purpose_label, bio, verification_status").order("created_at", { ascending: false }).range(a, b)),
        readAll<{ user_id: string }>((a, b) => admin.from("profile_photos").select("user_id").range(a, b)),
        readAll<{ user_id: string; created_at: string }>((a, b) => admin.from("doit_request_events").select("user_id, created_at").gte("created_at", L.periodStart("30d")).range(a, b)),
        readAll<Report>((a, b) => admin.from("user_reports").select("id, reporter_id, target_user_id, status").range(a, b)),
        readAll<Block>((a, b) => admin.from("blocks").select("id, blocker_id, blocked_user_id").range(a, b)),
      ]);
      if (profiles.error) return fail("DATA_ERROR", "사용자 표를 읽지 못했어요.", 500, origin);
      const photoN = new Map<string, number>(); for (const p of photos.rows) photoN.set(p.user_id, (photoN.get(p.user_id) ?? 0) + 1);
      const last = new Map<string, string>(); for (const e of events.rows) if ((last.get(e.user_id) ?? "") < e.created_at) last.set(e.user_id, e.created_at);
      const reported = new Map<string, number>(); for (const r of reports.rows) reported.set(r.target_user_id, (reported.get(r.target_user_id) ?? 0) + 1);
      const blocked = new Map<string, number>(); for (const b of blocks.rows) blocked.set(b.blocked_user_id, (blocked.get(b.blocked_user_id) ?? 0) + 1);
      const q = typeof body?.q === "string" ? body.q.trim().toLowerCase() : "";
      const list = profiles.rows.filter((p) => !q || [p.nickname, p.display_name, p.email, p.id].some((v) => String(v ?? "").toLowerCase().includes(q)));
      return json({ ok: true, asOf, total: profiles.rows.length, truncated: profiles.truncated, activity_window_days: 30,
        photos_error: photos.error, activity_error: events.error,
        users: list.slice(0, 300).map((p) => ({
          id: p.id, short: L.shortId(p.id), email: L.maskEmail(p.email), nickname: p.nickname || p.display_name || null, role: p.role === "admin" ? "admin" : "user",
          created_at: p.created_at, last_active_at: last.get(p.id) ?? null, purpose: p.purpose_label ?? p.purpose_id ?? null,
          intro_saved: !!(p.bio ?? "").trim(), photos: photos.error ? null : photoN.get(p.id) ?? 0, verification: p.verification_status ?? null,
          reported: reported.get(p.id) ?? 0, blocked_by: blocked.get(p.id) ?? 0,
        })) }, 200, origin);
    }

    if (action === "sessions") {
      const s = await readAll<SlimRow>((a, b) => admin.from("doit_request_events").select(SESSION_SLIM).eq("action", "agent_session").gte("updated_at", since).order("updated_at", { ascending: false }).range(a, b), SESSION_SAMPLE);
      s.rows = s.rows.map(unslim) as SlimRow[];
      if (s.error) return fail("DATA_ERROR", "대화 목록을 읽지 못했어요.", 500, origin);
      const ids = [...new Set(s.rows.map((r) => r.user_id))];
      const { data: profs } = ids.length ? await admin.from("profiles").select("id, nickname, display_name").in("id", ids.slice(0, 500)) : { data: [] };
      const nick = new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p.nickname || p.display_name || null]));
      const failedBySession = new Map<string, number>();
      const t = await readAll<L.TurnRowIn>((a, b) => admin.from("doit_request_events").select("target_id, created_at, status").eq("action", "agent_turn").eq("status", "failed").gte("created_at", since).range(a, b));
      for (const x of t.rows) failedBySession.set(x.target_id, (failedBySession.get(x.target_id) ?? 0) + 1);
      let list = s.rows.map((r) => ({ ...L.sessionSummary(r), nickname: nick.get(r.user_id) ?? null, failed_turns: failedBySession.get(r.request_id) ?? 0 }));
      const f = body ?? {};
      if (typeof f.user === "string" && f.user.trim()) { const u = f.user.trim().toLowerCase(); list = list.filter((x) => x.user_id.toLowerCase().startsWith(u) || String(x.nickname ?? "").toLowerCase().includes(u)); }
      if (typeof f.goal === "string" && f.goal) list = list.filter((x) => x.goal === f.goal);
      if (f.failed === true) list = list.filter((x) => x.failed_turns > 0 || x.quality_total > 0);
      if (f.correction === true) list = list.filter((x) => x.corrections > 0 || x.rejections > 0);
      // 같은 계정 여러 세션(대표 §8): 이 기간에 세션이 둘 이상인 계정 · 목적이 서로 다른지.
      const byUser = new Map<string, Set<string>>(); for (const x of s.rows.map(L.sessionSummary)) byUser.set(x.user_id, (byUser.get(x.user_id) ?? new Set()).add(String(x.goal)));
      return json({ ok: true, asOf, period, since, truncated: s.truncated, total: list.length,
        multi_session_users: [...byUser.entries()].filter(([, g]) => g.size > 1).length,
        sessions: list.slice(0, 200).map(({ user_id, ...rest }) => ({ ...rest, sessions_of_user: [...(byUser.get(user_id) ?? [])] })) }, 200, origin);
    }

    if (action === "session") {
      const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : "";
      if (!id) return fail("BAD_REQUEST", "대화를 골라 주세요.", 400, origin);
      const { data: row, error } = await admin.from("doit_request_events").select("request_id, user_id, created_at, updated_at, response_payload").eq("action", "agent_session").eq("request_id", id).maybeSingle();
      if (error) return fail("DATA_ERROR", "대화를 읽지 못했어요.", 500, origin);
      if (!row) return fail("NOT_FOUND", "대화를 찾지 못했어요.", 404, origin);
      const r = row as L.SessionRowIn; const st = r.response_payload?.state as AgentState | undefined;
      const { data: turnRows } = await admin.from("doit_request_events").select("target_id, created_at, status, response_payload").eq("action", "agent_turn").eq("target_id", id).order("created_at", { ascending: true }).limit(200);
      const recs = ((turnRows ?? []) as L.TurnRowIn[]).map((t) => {
        const rec = (t.response_payload?.record ?? {}) as Json;
        return { at: t.created_at, failed: L.turnFailed(t), turn: rec.turn_index ?? null, kind: rec.kind ?? null, decision: rec.decision ?? null, model: L.turnModel(t), agent: rec.agent ?? null, retry: Array.isArray(rec.retry) ? rec.retry : [], error: rec.error ?? rec.record_error ?? null, ms: rec.total_ms ?? null };
      });
      // 같은 계정의 다른 세션(목적·최근 활동) — 섞였는지 대표가 나란히 본다.
      const { data: siblings } = await admin.from("doit_request_events").select("request_id, created_at, updated_at, response_payload").eq("action", "agent_session").eq("user_id", r.user_id).order("updated_at", { ascending: false }).limit(10);
      return json({ ok: true, asOf,
        session: { ...L.sessionSummary(r), user_id: undefined, first_question: st?.asked?.[0]?.text ?? null,
          turns: (st?.turns ?? []).map((t) => ({ n: t.n, question_before: t.ai ?? null, user: t.user, kind: t.kind, guard: t.guard?.rule ?? null, reply: t.reply ?? "", question: t.question ?? null, saved: !!t.saved, decision: t.decision ?? null })),
          facts: st ? L.factsOf(st) : [], closing: st?.closing ?? null, intro: (st?.intro?.lines ?? []).map((l) => l.text) },
        records: recs,
        siblings: ((siblings ?? []) as L.SessionRowIn[]).map((x) => { const sm = L.sessionSummary({ ...x, user_id: r.user_id }); return { id: sm.id, goal: sm.goal, goal_label: sm.goal_label, updated_at: sm.updated_at, done: sm.done, summary: sm.summary.slice(0, 2) }; }),
      }, 200, origin);
    }

    if (action === "safety") {
      const [reports, blocks, profiles] = await Promise.all([
        readAll<Report>((a, b) => admin.from("user_reports").select("id, reporter_id, target_user_id, reason, detail, status, created_at").order("created_at", { ascending: false }).range(a, b)),
        readAll<Block>((a, b) => admin.from("blocks").select("id, blocker_id, blocked_user_id, reason, created_at").order("created_at", { ascending: false }).range(a, b)),
        readAll<Profile>((a, b) => admin.from("profiles").select("id, nickname, display_name").range(a, b)),
      ]);
      const name = new Map(profiles.rows.map((p) => [p.id, p.nickname || p.display_name || null]));
      const who = (id: string) => ({ short: L.shortId(id), nickname: name.get(id) ?? null });
      return json({ ok: true, asOf, reports_error: reports.error, blocks_error: blocks.error,
        // 처리자·결과를 적는 칸이 표에 없다(새 칸 = DB 변경 승인 필요) — 화면은 「기록 칸 없음」으로 보인다.
        handler_columns: false,
        reports: reports.rows.slice(0, 200).map((r) => ({ id: r.id, reporter: who(r.reporter_id), target: who(r.target_user_id), reason: r.reason, detail: r.detail, status: r.status ?? "open", created_at: r.created_at, severe: L.SEVERE.test(`${r.reason ?? ""} ${r.detail ?? ""}`) })),
        blocks: blocks.rows.slice(0, 200).map((b) => ({ id: b.id, blocker: who(b.blocker_id), blocked: who(b.blocked_user_id), reason: b.reason, created_at: b.created_at })) }, 200, origin);
    }

    // sources: 데이터 확인·감사 기록·서비스 상태 — 표마다 읽히는지와 줄 수(값 대신 이유).
    const tables = ["profiles", "profile_photos", "purposes", "doit_request_events", "doit_records", "doit_insights", "doit_matches", "doit_match_messages", "user_reports", "blocks", "audit_logs"];
    const counts = await Promise.all(tables.map((t) => countOf(admin, t)));
    const { data: purposes } = await admin.from("purposes").select("id, label, is_active, sort_order").order("sort_order", { ascending: true });
    const { data: lastTurn } = await admin.from("doit_request_events").select("created_at, status, response_payload").eq("action", "agent_turn").order("created_at", { ascending: false }).limit(1);
    const lt = ((lastTurn ?? []) as L.TurnRowIn[])[0];
    return json({ ok: true, asOf, server: ADMIN_WEB_VERSION, agent_server: AGENT_VERSION, google: await googleEnabled(env.url, env.anon),
      tables: tables.map((t, i) => ({ table: t, rows: counts[i].n, error: counts[i].error })),
      purposes: purposes ?? [],
      last_turn: lt ? { at: lt.created_at, failed: L.turnFailed(lt), agent: (lt.response_payload?.record as Json | undefined)?.agent ?? null, model: L.turnModel(lt) } : null }, 200, origin);
  } catch (_e) {
    return fail("ERROR", "관리자 자료를 만들지 못했어요.", 500, origin);
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve((req) => handle(req, { url: Deno.env.get("SUPABASE_URL") ?? "", anon: Deno.env.get("SUPABASE_ANON_KEY") ?? "", service: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" }));
}
