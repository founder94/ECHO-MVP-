// admin-conversations — 대표 관리자 전용 사용자·ECHO 대화 조회
//
// 원칙
// - 사용자 JWT를 getUser()로 실검증하고 profiles.role='admin'을 서버에서 다시 확인한다.
// - 서비스 역할 키는 서버에서만 사용하며 브라우저에 반환하지 않는다.
// - 목록에는 대화 원문을 반환하지 않는다. 상세 조회는 감사 로그 저장에 성공한 경우만 반환한다.
// - 대화·결제·리포트·사용자 데이터를 수정하거나 삭제하지 않는다.
// - 원문·토큰·키를 로그에 남기지 않는다.

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

type Json = Record<string, unknown>;
type Db = SupabaseClient;

const ALLOWED_ORIGINS = new Set([
  "https://do-it.company",
  "https://www.do-it.company",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERIODS = new Set(["today", "7d", "30d"]);
const MAX_LIMIT = 50;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const fail = (req: Request, code: string, error: string, status: number) =>
  json(req, { ok: false, code, error }, status);

// 관리자 화면의 "오늘/7일/30일"은 대표가 보는 한국 날짜(Asia/Seoul) 기준이다.
// UTC 자정을 쓰면 한국 오전 0~9시 데이터가 전날로 밀리므로 KST 달력의 자정을 UTC로 환산한다.
function periodStart(period: string, current = new Date()): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(current.getTime() + KST_OFFSET_MS);
  const daysBack = period === "7d" ? 6 : period === "30d" ? 29 : 0;
  const startUtcMs = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() - daysBack,
    0,
    0,
    0,
    0,
  ) - KST_OFFSET_MS;
  return new Date(startUtcMs).toISOString();
}

function attentionSignals(messages: Array<{ role: string; content: string }>): string[] {
  const signals = new Set<string>();
  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const repeatComplaint = /(?:이야기|말)했잖|이미\s*말|같은?\s*질문|똑같은?\s*질문|질문을?\s*(?:또|반복)|또\s*물어/;
  const confusion = /무슨\s*말|뭔\s*말|말이\s*안\s*되|질문.{0,12}(?:이상|어렵|뜬금|안\s*맞)/;
  const lowInformation = /^(?:응|어|네|예|그래|맞아|맞아요|글쎄|음|(?:잘\s*)?모르겠(?:다|어|어요|습니다|는데|네|음)?|생각(?:이)?\s*안\s*나(?:요)?|딱히\s*없(?:어|어요|습니다)?)[.!?\s~]*$/;

  if (userTexts.some((text) => repeatComplaint.test(text))) signals.add("repeat_complaint");
  if (userTexts.some((text) => confusion.test(text))) signals.add("confusion");
  let streak = 0;
  let maxStreak = 0;
  for (const text of userTexts) {
    if (lowInformation.test(text)) {
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  if (maxStreak >= 2) signals.add("low_information_repeat");
  return [...signals];
}

async function requireAdmin(req: Request): Promise<
  | { ok: true; userId: string; admin: Db }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: fail(req, "UNAUTHORIZED", "로그인이 필요합니다.", 401) };
  }
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { ok: false, response: fail(req, "ERROR", "관리자 서버 설정을 확인해 주세요.", 500) };
  }

  const userClient: Db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return { ok: false, response: fail(req, "UNAUTHORIZED", "로그인이 필요합니다.", 401) };
  }

  const admin: Db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, response: fail(req, "ERROR", "관리자 권한을 확인하지 못했습니다.", 500) };
  }
  if (!profile || profile.role !== "admin") {
    return { ok: false, response: fail(req, "FORBIDDEN", "관리자 권한이 없습니다.", 403) };
  }
  return { ok: true, userId: user.id, admin };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return fail(req, "BAD_REQUEST", "잘못된 요청입니다.", 405);
  const origin = req.headers.get("Origin") ?? "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return fail(req, "FORBIDDEN", "허용되지 않은 접속입니다.", 403);

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json().catch(() => null)) as Json | null;
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "list") {
      const period = typeof body?.period === "string" && PERIODS.has(body.period) ? body.period : "today";
      const limitRaw = Number(body?.limit ?? 30);
      const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(MAX_LIMIT, limitRaw)) : 30;
      const cursor = typeof body?.cursor === "string" ? body.cursor.trim() : "";
      if (cursor && Number.isNaN(Date.parse(cursor))) return fail(req, "BAD_REQUEST", "목록 위치값이 올바르지 않습니다.", 400);

      let query = auth.admin
        .from("conversations")
        .select("id, user_id, status, current_step, created_at, updated_at")
        .gte("updated_at", periodStart(period))
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (cursor) query = query.lt("updated_at", cursor);
      const { data: conversations, error: conversationError } = await query;
      if (conversationError) return fail(req, "ERROR", "대화 목록을 불러오지 못했습니다.", 500);

      const hasMore = (conversations?.length ?? 0) > limit;
      const page = (conversations ?? []).slice(0, limit);
      const conversationIds = page.map((row) => String(row.id));
      const userIds = [...new Set(page.map((row) => String(row.user_id)))];

      const [profileResult, messageResult] = await Promise.all([
        userIds.length
          ? auth.admin.from("profiles").select("id, email, display_name, nickname").in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
        conversationIds.length
          ? auth.admin.from("messages").select("conversation_id, role, content").in("conversation_id", conversationIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profileResult.error || messageResult.error) return fail(req, "ERROR", "대화 요약을 불러오지 못했습니다.", 500);

      const profiles = new Map((profileResult.data ?? []).map((row) => [String(row.id), row]));
      const grouped = new Map<string, Array<{ role: string; content: string }>>();
      for (const row of messageResult.data ?? []) {
        const key = String(row.conversation_id);
        const list = grouped.get(key) ?? [];
        list.push({ role: String(row.role ?? ""), content: String(row.content ?? "") });
        grouped.set(key, list);
      }

      const items = page.map((row) => {
        const profile = profiles.get(String(row.user_id));
        const messages = grouped.get(String(row.id)) ?? [];
        return {
          conversationId: row.id,
          userId: row.user_id,
          email: profile?.email ?? null,
          displayName: profile?.display_name ?? null,
          nickname: profile?.nickname ?? null,
          status: row.status,
          currentStep: row.current_step,
          messageCount: messages.length,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          attentionSignals: attentionSignals(messages),
        };
      });

      return json(req, {
        ok: true,
        items,
        hasMore,
        nextCursor: hasMore && items.length ? items[items.length - 1].updatedAt : null,
      });
    }

    if (action === "detail") {
      const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
      if (!UUID.test(conversationId)) return fail(req, "BAD_REQUEST", "대화 식별값이 올바르지 않습니다.", 400);

      const { data: conversation, error: conversationError } = await auth.admin
        .from("conversations")
        .select("id, user_id, status, current_step, created_at, updated_at")
        .eq("id", conversationId)
        .maybeSingle();
      if (conversationError) return fail(req, "ERROR", "대화를 불러오지 못했습니다.", 500);
      if (!conversation) return fail(req, "NOT_FOUND", "대화를 찾지 못했습니다.", 404);

      const [profileResult, emotionResult, messageResult, understandingResult] = await Promise.all([
        auth.admin.from("profiles").select("id, email, display_name, nickname").eq("id", conversation.user_id).maybeSingle(),
        auth.admin.from("emotions").select("mind_text, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
        auth.admin.from("messages").select("id, role, step, message_kind, content, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
        auth.admin.from("understanding_results").select("step, choice, rejected_interpretation, correction_text, self_explanation, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
      ]);
      if (profileResult.error || emotionResult.error || messageResult.error || understandingResult.error) {
        return fail(req, "ERROR", "대화 내용을 불러오지 못했습니다.", 500);
      }

      const { error: auditError } = await auth.admin.from("audit_logs").insert({
        user_id: auth.userId,
        action: "admin_conversation_view",
        detail: JSON.stringify({ conversation_id: conversationId, viewed_at: new Date().toISOString() }),
      });
      if (auditError) return fail(req, "ERROR", "조회 기록을 저장하지 못했습니다.", 500);

      return json(req, {
        ok: true,
        conversation,
        profile: profileResult.data ?? null,
        emotions: emotionResult.data ?? [],
        messages: messageResult.data ?? [],
        understandings: understandingResult.data ?? [],
      });
    }

    return fail(req, "BAD_REQUEST", "알 수 없는 요청입니다.", 400);
  } catch {
    return fail(req, "ERROR", "서버 오류가 발생했습니다.", 500);
  }
});
