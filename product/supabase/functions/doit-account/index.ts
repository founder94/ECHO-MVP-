// doit-account — 회원 탈퇴 서버 (v1 · 2026-09-24)
//
// 근거: 대표 2026-09-24 "출시 1.0 진행해 실수하지말고 다 만들고 전체 검수진행해"
//       (출시 1.0 = 앱 안 회원 탈퇴 버튼 + 공간·월드 탭 숨기기).
//
// 하는 일
// ① preview: 탈퇴하면 무엇이 지워지는지 개수만 알려 준다(답·AI 이해·사진·연결). 내용은 내려 주지 않는다.
//    지금 앱에서 바로 탈퇴할 수 있는지도 함께 알려 준다(관리자 계정·결제 기록이 있으면 메일로).
// ② delete_me: 로그인한 "나"의 계정만 지운다. 순서 = 사진 파일 → 로그인 계정.
//    로그인 계정을 지우면 DB 가 연결된 줄을 함께 지운다(profiles·doit_records·doit_insights·profile_photos·
//    doit_matches·doit_match_answers·doit_match_messages·blocks·얼굴 로그인 등록 = ON DELETE CASCADE,
//    운영 DB 에서 2026-09-24 읽기로 확인). 사진 파일은 DB 줄이 아니라 저장소 파일이라 먼저 직접 지운다.
//
// 원칙
// - getUser() 실검증. 화면이 보낸 사용자 번호는 받지도 않는다 — 지울 대상은 로그인 토큰의 주인 하나뿐이다.
// - 되돌릴 수 없는 일이라 화면의 확인 문자열(DELETE_CONFIRM)이 맞아야만 지운다(잘못 눌린 요청 방지).
// - 빠져나갈 문: 앱에서 못 지우는 경우(관리자·결제 기록·저장소 오류)는 멈추고 메일 문의로 안내한다.
//   사진 파일을 다 지우지 못하면 계정을 지우지 않는다(다시 누르면 이어서 지운다).
// - 결제 기록(payments)은 법령상 보관 대상일 수 있어 자동으로 지우지 않는다(검증 필요 — 대표·법무 확인).
// - 로그에 사용자 번호·이메일·전화번호·토큰을 남기지 않는다(단계와 개수만).

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

type Json = Record<string, unknown>;
type Db = SupabaseClient;

// 화면(src/doit/lib/accountApi.ts)의 같은 이름 값과 같아야 한다 — 검사가 확인한다.
const DELETE_CONFIRM = "delete-my-account-v1";
const ACTIONS = new Set(["preview", "delete_me"]);

const LIMITS = {
  BODY_MAX_BYTES: 4 * 1024,
  RATE_WINDOW_MS: 60_000,
  RATE_MAX_PER_WINDOW: 10,
  STORAGE_PAGE: 1000,        // 폴더 하나에서 한 번에 읽는 파일 수
  STORAGE_REMOVE_BATCH: 100, // 한 번에 지우는 파일 수
  STORAGE_MAX_FILES: 5000,   // 한 사람 사진 파일 상한(무한 반복 방지)
} as const;

const CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  BAD_REQUEST: "BAD_REQUEST",
  CONFIRM_REQUIRED: "CONFIRM_REQUIRED",
  ADMIN_ACCOUNT: "ADMIN_ACCOUNT",
  PAYMENT_RECORDS: "PAYMENT_RECORDS",
  STORAGE_FAILED: "STORAGE_FAILED",
  DELETE_FAILED: "DELETE_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  TOO_LARGE: "TOO_LARGE",
  ERROR: "ERROR",
} as const;

const PHOTO_BUCKET = "profile-photos";

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

// 단계·개수만 남긴다. 사용자 번호·이메일·토큰은 넣지 않는다.
function logDiag(fields: Json): void {
  console.log(JSON.stringify({ fn: "doit-account", ...fields }));
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

async function countRows(admin: Db, table: string, column: string, userId: string): Promise<number> {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, userId);
  if (error) throw new Error(`count_failed:${table}`);
  return count ?? 0;
}

// 내 사진 폴더(<사용자 번호>/<칸>/<파일>) 아래의 모든 파일 경로. 다른 사람 폴더는 절대 읽지 않는다.
async function listMyPhotoFiles(admin: Db, userId: string): Promise<string[]> {
  const bucket = admin.storage.from(PHOTO_BUCKET);
  const out: string[] = [];
  const queue: string[] = [userId];
  while (queue.length) {
    const folder = queue.shift() as string;
    for (let offset = 0; ; offset += LIMITS.STORAGE_PAGE) {
      const { data, error } = await bucket.list(folder, { limit: LIMITS.STORAGE_PAGE, offset });
      if (error) throw new Error("storage_list_failed");
      const entries = data ?? [];
      for (const e of entries) {
        const path = `${folder}/${e.name}`;
        // 폴더는 id 가 없다. 내 폴더 아래 한 단계(칸)까지만 내려간다.
        if (e.id === null || e.id === undefined) { if (folder === userId) queue.push(path); }
        else out.push(path);
        if (out.length > LIMITS.STORAGE_MAX_FILES) throw new Error("storage_too_many");
      }
      if (entries.length < LIMITS.STORAGE_PAGE) break;
    }
  }
  return out.filter((p) => p.startsWith(`${userId}/`));
}

async function removeMyPhotoFiles(admin: Db, userId: string): Promise<number> {
  const { data: rows } = await admin.from("profile_photos").select("storage_path").eq("user_id", userId);
  const fromRows = (rows ?? []).map((r) => String(r.storage_path ?? "")).filter((p) => p.startsWith(`${userId}/`));
  const paths = Array.from(new Set([...fromRows, ...(await listMyPhotoFiles(admin, userId))]));
  const bucket = admin.storage.from(PHOTO_BUCKET);
  for (let i = 0; i < paths.length; i += LIMITS.STORAGE_REMOVE_BATCH) {
    const { error } = await bucket.remove(paths.slice(i, i + LIMITS.STORAGE_REMOVE_BATCH));
    if (error) throw new Error("storage_remove_failed");
  }
  // 다 지웠는지 다시 확인한다. 남아 있으면 계정을 지우지 않는다(사진만 남는 일을 막는다).
  const left = await listMyPhotoFiles(admin, userId);
  if (left.length) throw new Error("storage_left");
  return paths.length;
}

// 앱에서 바로 지울 수 없는 경우. null 이면 지울 수 있다.
async function blockedReason(admin: Db, userId: string): Promise<{ code: string; error: string } | null> {
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "admin") {
    return { code: CODES.ADMIN_ACCOUNT, error: "관리자 계정은 앱에서 탈퇴할 수 없어요. 운영 메일로 요청해 주세요." };
  }
  if ((await countRows(admin, "payments", "user_id", userId)) > 0) {
    return { code: CODES.PAYMENT_RECORDS, error: "결제 기록이 있는 계정은 법에 따라 보관할 기록을 먼저 확인해야 해요. 메일로 요청해 주시면 처리해 드릴게요." };
  }
  return null;
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
    if (!serviceKey) return fail(CODES.ERROR, "서버 설정이 필요해요.", 500, origin);

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

    if (action === "preview") {
      const [answers, insights, photos, matchesA, matchesB, blocked] = await Promise.all([
        countRows(admin, "doit_records", "user_id", userId),
        countRows(admin, "doit_insights", "user_id", userId),
        countRows(admin, "profile_photos", "user_id", userId),
        countRows(admin, "doit_matches", "user_a", userId),
        countRows(admin, "doit_matches", "user_b", userId),
        blockedReason(admin, userId),
      ]);
      logDiag({ action, blocked: blocked?.code ?? null });
      return json({
        ok: true,
        counts: { answers, insights, photos, matches: matchesA + matchesB },
        can_delete: !blocked, blocked_code: blocked?.code ?? null, blocked_reason: blocked?.error ?? null,
      }, 200, origin);
    }

    // delete_me — 되돌릴 수 없다. 확인 문자열이 정확히 맞아야 한다.
    if (body.confirm !== DELETE_CONFIRM) {
      return fail(CODES.CONFIRM_REQUIRED, "탈퇴 확인이 필요해요. 확인 칸을 체크한 뒤 다시 눌러 주세요.", 400, origin);
    }
    const blocked = await blockedReason(admin, userId);
    if (blocked) { logDiag({ action, stop: blocked.code }); return fail(blocked.code, blocked.error, 409, origin); }

    let removed = 0;
    try {
      removed = await removeMyPhotoFiles(admin, userId);
    } catch (e) {
      logDiag({ action, stop: CODES.STORAGE_FAILED, step: e instanceof Error ? e.message : "unknown" });
      return fail(CODES.STORAGE_FAILED, "사진을 지우는 중에 멈췄어요. 계정은 그대로예요. 잠시 뒤 다시 눌러 주세요.", 500, origin);
    }

    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) {
      logDiag({ action, stop: CODES.DELETE_FAILED, photos: removed });
      return fail(CODES.DELETE_FAILED, "계정을 지우지 못했어요. 사진은 이미 지웠어요. 잠시 뒤 다시 눌러 주세요.", 500, origin);
    }
    logDiag({ action, ok: true, photos: removed });
    return json({ ok: true, deleted: true }, 200, origin);
  } catch (e) {
    logDiag({ stop: CODES.ERROR, step: e instanceof Error ? e.message.slice(0, 40) : "unknown" });
    return fail(CODES.ERROR, "잠시 문제가 생겼어요. 계정은 그대로예요. 잠시 뒤 다시 해 주세요.", 500, origin);
  }
});
