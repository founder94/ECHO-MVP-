import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "gpt-4o-mini";
const CONVERSATION_MAX_TOKENS = 4096;

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
type Json = Record<string, unknown>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMsg[],
  maxTokens = CONVERSATION_MAX_TOKENS,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.2, top_p: 0.9, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) throw new Error("OPENAI_HTTP");
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("OPENAI_EMPTY");
  return text;
}

// ── 서버 측 재등장 차단: 문자 bigram Jaccard 유사도 ──
function bigrams(s: string): Set<string> {
  const clean = s.replace(/\s+/g, "").toLowerCase();
  const set = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}
function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}

interface Candidate { question: string; meaning: string; }

function parseCandidates(text: string): Candidate[] {
  try {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) {
        const out = arr
          .map((x: any) => ({
            question: String(x?.question ?? x?.q ?? "").trim(),
            meaning: String(x?.meaning ?? x?.intent ?? x?.m ?? "").trim(),
          }))
          .filter((c) => c.question);
        if (out.length) return out;
      }
    }
  } catch { /* fall through */ }
  return [{ question: text.trim(), meaning: "" }];
}

interface DbMessage { role: string; step: number | null; content: string; }
interface DbUnderstanding {
  choice: string;
  rejected_interpretation: string | null;
  correction_text: string | null;
  self_explanation: string | null;
}
interface Context {
  mindText: string;
  messages: DbMessage[];
  affirmed: string[];
  rejections: string[];
  asked: string[];
}

// ── DB (user-scoped client, RLS가 소유권 보장) ──
async function loadConversation(sb: any, userId: string, conversationId: string) {
  const { data, error } = await sb
    .from("conversations")
    .select("id, user_id, status, current_step, request_token, request_action")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data || data.user_id !== userId) return null;
  return data;
}

async function getLatestAiMessage(sb: any, conversationId: string, step: number): Promise<string | null> {
  const { data, error } = await sb
    .from("messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .eq("role", "ai")
    .eq("step", step)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.content ?? null;
}

async function loadContext(sb: any, conversationId: string): Promise<Context> {
  const [emotionRes, msgRes, undRes] = await Promise.all([
    sb.from("emotions").select("mind_text").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    sb.from("messages").select("role, step, content").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    sb.from("understanding_results").select("choice, rejected_interpretation, correction_text, self_explanation").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);

  const mindText = (emotionRes?.data?.mind_text ?? "") as string;
  const messages: DbMessage[] = (msgRes?.data ?? []) as DbMessage[];
  const unds: DbUnderstanding[] = (undRes?.data ?? []) as DbUnderstanding[];

  // ECHO 기준: 정정·직접 설명은 우선 반영(affirmed), 거절한 해석만 차단(rejected).
  const affirmed: string[] = [];
  const rejections: string[] = [];
  for (const u of unds) {
    if (u.choice === "agree") continue;
    if (u.self_explanation) affirmed.push(u.self_explanation);
    if (u.correction_text) affirmed.push(u.correction_text);
    if (u.rejected_interpretation) rejections.push(u.rejected_interpretation);
  }
  const asked = messages.filter((m) => m.role === "ai").map((m) => m.content);

  return { mindText, messages, affirmed, rejections, asked };
}

function historyText(ctx: Context): string {
  const parts = ctx.messages.map((m) => `${m.role === "ai" ? "ECHO" : "사용자"}: ${m.content}`);
  if (ctx.mindText) parts.unshift(`마음 기록: ${ctx.mindText}`);
  return parts.join("\n");
}

// ── 정정·직접 설명(우선 반영) vs 거절(차단) 분리 프롬프트 ──
function priorityNote(ctx: Context): string {
  const list = (arr: string[]) => arr.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return (ctx.affirmed.length
    ? `\n[사용자가 직접 설명·정정한 내용 — 가장 먼저, 가장 우선으로 반영]\n${list(ctx.affirmed)}`
    : "") +
    (ctx.rejections.length
      ? `\n[사용자가 거절한 해석 — 같은 뜻을 표현만 바꿔서도 다시 쓰지 말 것]\n${list(ctx.rejections)}`
      : "");
}

// ── LLM 생성 ──
async function genStep1Question(apiKey: string, model: string, mindText: string): Promise<string> {
  const system =
    "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'이다. 사용자가 쓴 마음의 기록을 읽고, 그 마음을 공감하며 짚어주는 짧은 한국어 질문을 하나만 만들어라. 질문은 그 마음을 더 알아가기 위한 것이어야 하고, 판단하거나 진단하지 않는다. 질문 텍스트만 출력하고 부가 설명은 붙이지 마라.";
  return callOpenAI(apiKey, model, [{ role: "system", content: system }, { role: "user", content: mindText }]);
}

async function genStep2Question(apiKey: string, model: string, ctx: Context): Promise<string> {
  const system =
    "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'이다. 사용자의 마음 기록과 지금까지의 대화를 읽고, 그 감정의 원인이나 맥락을 더 깊이 알아가는 짧은 한국어 질문을 하나만 만들어라. 사용자가 실제로 말한 내용만 근거로 하고 추측하지 않는다. 질문 텍스트만 출력해라.";
  return callOpenAI(apiKey, model, [{ role: "system", content: system }, { role: "user", content: historyText(ctx) }]);
}

async function genUnderstanding(apiKey: string, model: string, ctx: Context): Promise<string> {
  const system =
    "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'이다. 사용자의 마음 기록과 대화를 바탕으로, 사용자가 지금 어떤 마음인지 한두 문장으로 공감하며 요약해라. 사용자가 실제로 말한 내용만 사실로 사용하고, 추측·진단·평가를 하지 않는다." +
    priorityNote(ctx) +
    "\n요약 텍스트만 출력해라.";
  return callOpenAI(apiKey, model, [{ role: "system", content: system }, { role: "user", content: historyText(ctx) }]);
}

async function genFollowupQuestion(apiKey: string, model: string, ctx: Context): Promise<string> {
  const system =
    "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'이다. 사용자의 이전 대화를 바탕으로, 아직 더 알아가야 할 부분을 묻는 짧은 한국어 질문 후보 3개를 JSON 배열로 만들어라. 각 후보는 {\"question\":\"...\",\"meaning\":\"...\"} 형태이고 meaning은 질문의 핵심 의도를 한 문장으로 요약한 것. 반드시 지켜라: 1) 사용자가 거절한 뜻과 충돌하는 질문은 만들지 않는다. 2) 사용자가 정정하거나 직접 설명한 내용을 가장 먼저 반영한다. 3) 이미 나온 질문과 같은 뜻의 질문을 반복하지 않는다. JSON 배열만 출력하고 다른 설명은 붙이지 마라.";
  const userMsg = `이전 대화:\n${historyText(ctx)}${priorityNote(ctx)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callOpenAI(apiKey, model, [{ role: "system", content: system }, { role: "user", content: userMsg }]);
    const candidates = parseCandidates(raw);
    const survivors = candidates.filter((c) => {
      for (const a of ctx.asked) {
        if (similarity(c.question, a) > 0.6) return false;
        if (c.meaning && similarity(c.meaning, a) > 0.6) return false;
      }
      for (const r of ctx.rejections) {
        if (similarity(c.question, r) > 0.5) return false;
        if (c.meaning && similarity(c.meaning, r) > 0.5) return false;
      }
      return true;
    });
    if (survivors.length) return survivors[0].question;
  }
  throw new Error("NO_CANDIDATE");
}

// ── 상태 응답 ──
const MESSAGE_STEP: Record<string, number> = { step1: 1, step2: 2, understanding: 3, followup: 4 };
const DISPLAY_STEP: Record<string, number> = { step1: 1, step2: 2, understanding: 3, followup: 3, white_door_ready: 3 };

async function buildState(sb: any, conv: any): Promise<Json> {
  const status = conv.status as string;
  const step = DISPLAY_STEP[status] ?? 1;
  if (status === "white_door_ready") return { ok: true, status, step };
  if (status === "understanding") {
    const understanding = await getLatestAiMessage(sb, conv.id, MESSAGE_STEP.understanding);
    return { ok: true, status, step, understanding: understanding ?? "" };
  }
  const q = await getLatestAiMessage(sb, conv.id, MESSAGE_STEP[status] ?? 1);
  return { ok: true, status, step, question: q ?? "" };
}

async function setStatus(sb: any, conversationId: string, status: string, currentStep: number) {
  await sb.from("conversations").update({ status, current_step: currentStep, updated_at: new Date().toISOString() }).eq("id", conversationId);
}

async function setToken(sb: any, conversationId: string, action: string, token: string) {
  if (!token) return;
  await sb.from("conversations").update({ request_token: token, request_action: action }).eq("id", conversationId);
}

// ── 메인 ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) {
      return json({ ok: false, code: "UNAUTHORIZED", error: "로그인이 필요해요." }, 401);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL;

    const body = (await req.json().catch(() => null)) as Json | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    const token = typeof body?.token === "string" ? body.token : "";

    if (action === "start") {
      const mindText = typeof body?.mindText === "string" ? body.mindText.trim() : "";
      if (!mindText) return json({ ok: false, code: "BAD_REQUEST", error: "마음 기록이 없어요." });
      if (!apiKey) return json({ ok: false, code: "AI_NOT_CONFIGURED", error: "AI 서버 설정 필요" });

      const { data: conv, error: convErr } = await sb.from("conversations").insert({ user_id: user.id, status: "step1", current_step: 1 }).select("id, status, current_step").single();
      if (convErr || !conv) return json({ ok: false, code: "ERROR", error: "대화를 시작하지 못했어요." });

      const { error: emoErr } = await sb.from("emotions").insert({ conversation_id: conv.id, user_id: user.id, mind_text: mindText });
      if (emoErr) return json({ ok: false, code: "ERROR", error: "마음 기록 저장에 실패했어요." });

      let question: string;
      try { question = await genStep1Question(apiKey, model, mindText); }
      catch { return json({ ok: false, code: "AI_ERROR", error: "AI 응답을 받지 못했어요." }); }

      const { error: msgErr } = await sb.from("messages").insert({ conversation_id: conv.id, user_id: user.id, role: "ai", step: 1, content: question });
      if (msgErr) return json({ ok: false, code: "ERROR", error: "질문 저장에 실패했어요." });

      return json({ ok: true, status: "step1", step: 1, conversationId: conv.id, question });
    }

    if (!conversationId) return json({ ok: false, code: "BAD_REQUEST", error: "대화 식별값이 없어요." });

    if (action === "resume") {
      const conv = await loadConversation(sb, user.id, conversationId);
      if (!conv) return json({ ok: false, code: "FORBIDDEN", error: "대화를 찾지 못했어요." });
      return json(await buildState(sb, conv));
    }

    if (action === "answer") {
      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!answer) return json({ ok: false, code: "BAD_REQUEST", error: "답변을 입력해 주세요." });
      if (!apiKey) return json({ ok: false, code: "AI_NOT_CONFIGURED", error: "AI 서버 설정 필요" });

      const conv = await loadConversation(sb, user.id, conversationId);
      if (!conv) return json({ ok: false, code: "FORBIDDEN", error: "대화를 찾지 못했어요." });
      if (token && conv.request_token === token) return json(await buildState(sb, conv));

      const status = conv.status as string;
      if (status !== "step1" && status !== "step2" && status !== "followup") {
        return json({ ok: false, code: "INVALID_STATE", error: "현재 단계에서는 답변할 수 없어요." });
      }

      const userStep = status === "followup" ? 4 : status === "step1" ? 1 : 2;
      const { error: userMsgErr } = await sb.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", step: userStep, content: answer });
      if (userMsgErr) return json({ ok: false, code: "ERROR", error: "답변 저장에 실패했어요." });

      const ctx = await loadContext(sb, conversationId);

      if (status === "step1") {
        let q2: string;
        try { q2 = await genStep2Question(apiKey, model, ctx); }
        catch { return json({ ok: false, code: "AI_ERROR", error: "AI 응답을 받지 못했어요." }); }
        const { error: aiErr } = await sb.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "ai", step: 2, content: q2 });
        if (aiErr) return json({ ok: false, code: "ERROR", error: "질문 저장에 실패했어요." });
        await setStatus(sb, conversationId, "step2", 2);
        await setToken(sb, conversationId, "answer", token);
        return json({ ok: true, status: "step2", step: 2, question: q2 });
      }

      let understanding: string;
      try { understanding = await genUnderstanding(apiKey, model, ctx); }
      catch { return json({ ok: false, code: "AI_ERROR", error: "AI 응답을 받지 못했어요." }); }
      const { error: undErr } = await sb.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "ai", step: 3, content: understanding });
      if (undErr) return json({ ok: false, code: "ERROR", error: "이해 내용 저장에 실패했어요." });
      await setStatus(sb, conversationId, "understanding", 3);
      await setToken(sb, conversationId, "answer", token);
      return json({ ok: true, status: "understanding", step: 3, understanding });
    }

    if (action === "choose") {
      const choice = typeof body?.choice === "string" ? body.choice : "";
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!["agree", "alittle", "no", "explain"].includes(choice)) {
        return json({ ok: false, code: "BAD_REQUEST", error: "잘못된 선택이에요." });
      }
      if (choice !== "agree" && !text) {
        return json({ ok: false, code: "BAD_REQUEST", error: "내용을 입력해 주세요." });
      }
      if (!apiKey) return json({ ok: false, code: "AI_NOT_CONFIGURED", error: "AI 서버 설정 필요" });

      const conv = await loadConversation(sb, user.id, conversationId);
      if (!conv) return json({ ok: false, code: "FORBIDDEN", error: "대화를 찾지 못했어요." });
      if (conv.status !== "understanding") {
        return json({ ok: false, code: "INVALID_STATE", error: "현재 단계에서는 선택할 수 없어요." });
      }
      if (token && conv.request_token === token) return json(await buildState(sb, conv));

      const currentUnderstanding = (await getLatestAiMessage(sb, conversationId, 3)) ?? "";

      const { error: undErr } = await sb.from("understanding_results").insert({
        conversation_id: conversationId,
        user_id: user.id,
        step: 3,
        choice,
        rejected_interpretation: choice === "no" ? currentUnderstanding : null,
        correction_text: (choice === "alittle" || choice === "no") ? text : null,
        self_explanation: choice === "explain" ? text : null,
      });
      if (undErr) return json({ ok: false, code: "ERROR", error: "선택 저장에 실패했어요." });

      const userContent = choice === "agree" ? "맞아요" : text;
      await sb.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "user", step: 3, content: userContent });

      if (choice === "agree") {
        await setStatus(sb, conversationId, "white_door_ready", 3);
        await setToken(sb, conversationId, "choose", token);
        return json({ ok: true, status: "white_door_ready", step: 3 });
      }

      const ctx = await loadContext(sb, conversationId);
      let q: string;
      try { q = await genFollowupQuestion(apiKey, model, ctx); }
      catch { return json({ ok: false, code: "NO_CANDIDATE", error: "새 질문을 만들지 못했어요. 잠시 후 다시 시도해 주세요." }); }
      const { error: aiErr } = await sb.from("messages").insert({ conversation_id: conversationId, user_id: user.id, role: "ai", step: 4, content: q });
      if (aiErr) return json({ ok: false, code: "ERROR", error: "질문 저장에 실패했어요." });
      await setStatus(sb, conversationId, "followup", 3);
      await setToken(sb, conversationId, "choose", token);
      return json({ ok: true, status: "followup", step: 3, question: q });
    }

    return json({ ok: false, code: "BAD_REQUEST", error: "알 수 없는 요청이에요." });
  } catch (_err) {
    return json({ ok: false, code: "ERROR", error: "서버 오류가 발생했어요." });
  }
});
