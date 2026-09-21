// doit-photo-check — 프로필 사진 AI 판별 (v1 · 2026-09-21 작성 · 대표 운영 배포 승인 2026-09-22 "포토체크 배포 승인")
//
// 하는 일: 본인 사진 1장을 AI(비전)에게 보여 주고 ① 사람이 있는지 ② 한 명인지 ③ 칸의 종류(전신/패션/취미)와 맞는지
//          ④ 화면·인쇄물을 다시 찍은 사진인지 ⑤ 올릴 수 없는 내용인지 ⑥ 너무 어둡거나 흐린지를 판정한다.
// 하지 않는 일: 본인 여부·실제 촬영일 확인(불가능하다고 명시한다). 사진 바이트·서명 주소·이유 원문을 로그에 남기지 않는다.
// 판정 = 서버 규칙(verdict). AI는 항목별 판단만 돌려준다.
// 원칙: getUser 실검증 → 본인 행(profile_photos.user_id = uid)만 → 짧은 서명 주소(60초)로 AI에 전달 → 결과 반환.
//        결과 저장은 profile_photos 의 check_* 칸이 있을 때만(PENDING_20260921_profile_photo_check.sql). 칸이 없으면 반환만 한다.

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const PHOTO_BUCKET = "profile-photos";
const SIGNED_URL_SECONDS = 60;
const LIMITS = { RATE_WINDOW_MS: 60_000, RATE_MAX_PER_WINDOW: 20, AI_TIMEOUT_MS: 25_000, MAX_TOKENS: 300 } as const;
const CATEGORIES = ["full_body", "fashion", "hobby", "free"] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_DESC: Record<Category, string> = {
  full_body: "머리부터 발끝까지 한 사람의 전신이 보이는 사진",
  fashion: "한 사람이 평소 입는 옷차림·스타일이 잘 보이는 사진(상반신 이상)",
  hobby: "한 사람이 취미·운동·활동을 실제로 하고 있는 모습",
  free: "한 사람이 나온 자연스러운 생활 사진(종류 제한 없음)",
};
const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function resolveModel(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value || value === "gpt-40-mini") return "gpt-4o-mini";
  return value;
}
const corsHeaders = (origin: string | null): Record<string, string> => {
  const allowed = origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) ? origin : (ALLOWED_ORIGINS[0] ?? "*");
  return { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
};
const json = (data: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
const fail = (code: string, error: string, status = 200, origin: string | null = null) => json({ ok: false, code, error }, status, origin);

const rateBuckets = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < LIMITS.RATE_WINDOW_MS);
  if (arr.length >= LIMITS.RATE_MAX_PER_WINDOW) { rateBuckets.set(userId, arr); return true; }
  arr.push(now); rateBuckets.set(userId, arr); return false;
}
function logDiag(fields: Record<string, unknown>): void {
  try { console.log(JSON.stringify({ evt: "doit_photo_check", ...fields })); } catch { /* 무시 */ }
}
function extractJson(text: string): unknown {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

interface Judgement { person: boolean; single_person: boolean; face_visible: boolean; category: Category | "other"; screen_photo: boolean; unsafe: boolean; low_quality: boolean }

async function judgePhoto(apiKey: string, model: string, imageUrl: string, expected: Category): Promise<Judgement> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIMITS.AI_TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: LIMITS.MAX_TOKENS, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "너는 프로필 사진 검수 도우미다. 사진 속 사람의 신원·나이·매력·성격을 추측하거나 평가하지 않는다. 아래 항목만 사실로 판정해 JSON 으로만 답한다. person: 사람이 보이는가. single_person: 사람이 정확히 한 명인가. face_visible: 얼굴이 보이는가. category: 사진 종류를 full_body / fashion / hobby / free / other 중 하나로. screen_photo: 모니터·TV·종이 사진을 다시 찍은 사진인가. unsafe: 노출·성적·폭력 등 프로필에 올릴 수 없는 내용이 있는가. low_quality: 너무 어둡거나 흐려서 사람을 알아보기 어려운가. 종류 기준: " + (Object.entries(CATEGORY_DESC) as [Category, string][]).map(([k, v]) => `${k}=${v}`).join("; ") },
          { role: "user", content: [
            { type: "text", text: `이 사진이 기대하는 종류: ${expected} (${CATEGORY_DESC[expected]}). {"person":bool,"single_person":bool,"face_visible":bool,"category":"full_body|fashion|hobby|free|other","screen_photo":bool,"unsafe":bool,"low_quality":bool} 로만 답하라.` },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ] },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`provider_http_${res.status}`);
    const data = await res.json();
    const out = extractJson(String(data?.choices?.[0]?.message?.content ?? "")) as Record<string, unknown> | null;
    if (!out) throw new Error("AI_EMPTY");
    const category = typeof out.category === "string" && ([...CATEGORIES, "other"] as string[]).includes(out.category) ? out.category as Category | "other" : "other";
    return {
      person: out.person === true, single_person: out.single_person === true, face_visible: out.face_visible === true,
      category, screen_photo: out.screen_photo === true, unsafe: out.unsafe === true, low_quality: out.low_quality === true,
    };
  } finally {
    clearTimeout(timer);
  }
}

// 서버 규칙: AI 항목 → 판정. '자유' 칸은 종류를 따지지 않는다. 패션·취미는 전신 사진도 허용한다(더 많이 보여 준 것이므로).
function verdictOf(j: Judgement, expected: Category): { verdict: "ok" | "review" | "rejected"; reasons: string[] } {
  const reasons: string[] = [];
  if (j.unsafe) reasons.push("unsafe");
  if (!j.person) reasons.push("no_person");
  if (j.screen_photo) reasons.push("screen_photo");
  if (reasons.length) return { verdict: "rejected", reasons };
  if (!j.single_person) reasons.push("multiple_people");
  if (j.low_quality) reasons.push("low_quality");
  if (!j.face_visible && expected !== "hobby") reasons.push("face_hidden");
  const categoryOk = expected === "free" || j.category === expected || (j.category === "full_body" && (expected === "fashion" || expected === "hobby"));
  if (!categoryOk) reasons.push("category_mismatch");
  return { verdict: reasons.length ? "review" : "ok", reasons };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return fail("BAD_REQUEST", "잘못된 요청이에요.", 405, origin);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) return fail("ERROR", "서버 설정이 필요해요.", 500, origin);
    const sb: SupabaseClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401, origin);
    if (rateLimited(user.id)) return fail("RATE_LIMITED", "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.", 429, origin);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const photoId = typeof body?.photoId === "string" ? body.photoId : "";
    const slot = typeof body?.slot === "number" && Number.isInteger(body.slot) ? body.slot : 0;
    const category = typeof body?.category === "string" && (CATEGORIES as readonly string[]).includes(body.category) ? body.category as Category : null;
    if (!/^[0-9a-fA-F-]{36}$/.test(photoId) || slot < 1 || slot > 6 || !category) return fail("BAD_REQUEST", "사진 정보가 올바르지 않아요.", 400, origin);

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = resolveModel(Deno.env.get("OPENAI_MODEL"));
    if (!apiKey) return fail("AI_NOT_CONFIGURED", "AI 서버 설정이 필요해요.", 500, origin);

    const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: row, error: rowError } = await admin.from("profile_photos").select("id, user_id, slot, storage_path").eq("id", photoId).maybeSingle();
    if (rowError) return fail("ERROR", "사진 정보를 읽지 못했어요.", 500, origin);
    if (!row || row.user_id !== user.id || row.slot !== slot || typeof row.storage_path !== "string" || !row.storage_path.startsWith(`${user.id}/`)) {
      return fail("FORBIDDEN", "내 사진만 확인할 수 있어요.", 403, origin);
    }
    const { data: signed, error: signError } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
    if (signError || !signed?.signedUrl) return fail("ERROR", "사진을 열지 못했어요.", 500, origin);

    let judgement: Judgement;
    try {
      judgement = await judgePhoto(apiKey, model, signed.signedUrl, category);
    } catch (e) {
      logDiag({ reason: e instanceof Error && e.message.startsWith("provider_http_") ? e.message : "ai_failed", slot });
      return fail("AI_ERROR", "AI 확인을 마치지 못했어요. 사진은 저장돼 있어요.", 502, origin);
    }
    const { verdict, reasons } = verdictOf(judgement, category);

    // 결과 저장(칸이 있을 때만). 칸이 없으면(42703) 조용히 건너뛴다 — 초안 SQL 실행 전 상태.
    const { error: saveError } = await admin.from("profile_photos")
      .update({ check_status: verdict, check_category: judgement.category, check_reasons: reasons, checked_at: new Date().toISOString() })
      .eq("id", photoId).eq("user_id", user.id);
    const stored = !saveError;
    if (saveError && saveError.code !== "42703" && saveError.code !== "PGRST204") logDiag({ reason: "save_failed", code: saveError.code });
    logDiag({ verdict, reasons, expected: category, detected: judgement.category, stored });

    return json({ ok: true, verdict, reasons, category: judgement.category, stored, note: "AI는 본인 여부와 실제 촬영일을 확인하지 못해요." }, 200, origin);
  } catch {
    return fail("ERROR", "서버 오류가 발생했어요.", 500, origin);
  }
});
