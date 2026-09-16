// echo-journey — 무료 여정 서버 상태머신 (STEP 3 → … → STEP 7) + 유료 리포트 권한
//
// 원칙(get-step-question 과 동일)
// - 모든 요청은 토큰 getUser 실검증. 상태 쓰기는 서비스 역할로만 수행하고 사용자 소유권을 모든 경로에서 확인.
// - LLM은 후보만 만든다. 최종 선택·차단·상태 전환·완료 판정은 서버가 한다. 질문 하드코딩 없음(단계별 '주제'만 서버가 지정).
// - 정정·직접 설명 최우선 반영, 거절한 해석은 같은 뜻으로 재등장 금지(의미 키 + 글자 겹침 이중 차단).
// - 답변은 AI 호출 전에 먼저 저장·완료한다. 다음 질문 실패가 사용자 답변 저장을 막지 않는다.
// - 알 수 없는 상태는 UNKNOWN_STATE 로 명시 거절. 리포트 미구매 상태에는 본문을 돌려주지 않는다.
// - 인증은 사용자 토큰으로 검증하고 모든 상태·본문 쓰기는 서비스 역할로만 수행한다. 원문은 로그에 남기지 않는다.
//
// 비밀값: OPENAI_API_KEY, OPENAI_MODEL (get-step-question 과 공유). SUPABASE_* 는 자동 주입.

// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  askedJourneyFullTexts,
  askedJourneyQuestionTexts,
  askedQuestionTexts,
  isBriefReply,
  isLowInformationReply,
  isMetaFeedback,
  journeyFeedbackKind,
  latestJourneyQuestion,
  latestUserAnswer,
  latestUserTurn,
  nextQuestionFocus,
  questionQualityReason,
  reusesJourneyAnchor,
  repeatsQuestionIntent,
  userEvidenceParts,
  userEvidenceText,
  type GroundedCandidate,
  type JourneyMessageKind,
} from "./question-quality.ts";

// ── 상태·한도 ──
const PRE_STATUSES = ["step1", "step2", "understanding", "followup", "white_door_ready"] as const;
const STEP_STATUSES = ["step3", "step4", "step5", "step6", "step7"] as const;
const REPORT_READY = "report_ready";
const REPORT_DONE = "report_done";
type StepStatus = (typeof STEP_STATUSES)[number];
type Status = StepStatus | typeof REPORT_READY | typeof REPORT_DONE;
const isPre = (v: string) => (PRE_STATUSES as readonly string[]).includes(v);
const isStep = (v: string): v is StepStatus => (STEP_STATUSES as readonly string[]).includes(v);
const isJourney = (v: string): v is Status => isStep(v) || v === REPORT_READY || v === REPORT_DONE;
const stepOf = (s: StepStatus) => Number(s.slice(4));
const REPORT_STEP = 8;
const displayStep = (s: Status) => (isStep(s) ? stepOf(s) : REPORT_STEP);
const nextAfterAnswer = (s: StepStatus): Status => (stepOf(s) < 7 ? (`step${stepOf(s) + 1}` as StepStatus) : REPORT_READY);

// 단계별 목적만 정한다. 관계·미래·회피 같은 내용을 미리 가정하지 않는다.
// 실제 질문은 사용자의 직접 표현을 인용한 LLM 후보를 서버가 검증한 뒤 선택한다.
const STEP_OBJECTIVES: Readonly<Record<StepStatus, string>> = {
  step3: "사용자가 직접 쓴 표현 하나가 지금 본인에게 어떤 뜻인지 한 가지만 구체적으로 묻는다.",
  step4: "바로 앞의 유효한 사용자 답변에 있는 표현 하나를 좁혀 묻는다. 미래의 일을 이미 겪은 기억처럼 묻지 않는다.",
  step5: "사용자가 직접 말한 감정·생각·중요함 중 아직 충분히 설명되지 않은 한 부분만 묻는다.",
  step6: "사용자가 직접 말한 바람이나 어려움이 있을 때만 그중 하나를 구체화한다. 피함·참음·관계를 먼저 가정하지 않는다.",
  step7: "사용자가 직접 말한 내용 중 오늘 대화에서 남기고 싶은 의미나 가능한 작은 선택 하나를 묻는다. 행동이나 관계를 강요하지 않는다.",
};

// 질문 문장은 AI가 만들지만, 대화 방식은 단계마다 바꿔 지루한 반복을 막는다.
const STEP_LENSES: Readonly<Record<StepStatus, string>> = {
  step3: "사용자가 쓴 표현을 쉬운 말로 풀어보는 질문",
  step4: "오늘의 구체적인 때·상황·변화 중 하나를 떠올리게 하는 질문",
  step5: "느낌과 중요함 중 앞에서 묻지 않은 한 방향을 살피는 질문",
  step6: "앞선 답과 다른 관점에서 차이·우선순위 중 하나를 살피는 질문",
  step7: "오늘 남기고 싶은 말 또는 부담 없는 작은 선택을 묻는 마무리 질문",
};

const LIMITS = {
  ANSWER_MAX: 500,
  QUESTION_MAX: 80,
  MEANING_MAX: 120,
  KEY_MAX: 24,
  KEYS_MAX: 6,
  CANDIDATES_MAX: 3,
  ATTEMPTS: 2,
  TOKEN: /^[A-Za-z0-9-]{8,64}$/,
  REPEAT_SIM: 0.6,
  REPEAT_OVERLAP: 0.7,
  REJECT_SIM: 0.5,
  REJECT_OVERLAP: 0.6,
  TITLE_MAX: 40,
  SUMMARY_MAX: 300,
  SECTION_MAX: 600,
  SECTIONS_MIN: 3,
  SECTIONS_MAX: 5,
} as const;
const PENDING = "pending";
const PENDING_STALE_MS = 90_000;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const QUESTION_TIMEOUT_MS = 6_000;
const REPORT_TIMEOUT_MS = 20_000;
const QUESTION_MAX_TOKENS = 500;
const REPORT_MAX_TOKENS = 3000;
const TEMPERATURE = 0.2;
const TOP_P = 0.9;
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
function resolveModel(raw: string | undefined): string {
  const model = (raw ?? "").trim();
  return !model || model === "gpt-40-mini" ? DEFAULT_OPENAI_MODEL : model;
}
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const FORBIDDEN_TERMS = ["진단", "치료", "처방", "증상", "우울증", "공황", "불안장애", "사주", "타로", "운세", "궁합", "점술", "법적", "소송", "변호사", "성격검사", "성격 유형", "mbti"] as const;
const PERSONA =
  "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'다. 사용자가 실제로 말한 내용만 근거로 하고 추측·판단·진단·평가를 하지 않는다. 의료·법률·점술·성격검사식 단정을 하지 않는다. 데이팅·궁합 같은 표현을 쓰지 않는다. 확실하지 않은 것은 '~인 것 같아요'처럼 후보로만 말한다.";

type Json = Record<string, unknown>;
type Db = SupabaseClient;
interface Conv { id: string; user_id: string; status: string; request_token: string | null; request_action: string | null; updated_at: string | null }
interface Msg { role: string; step: number | null; content: string; message_kind: string | null }
interface Und { choice: string; rejected_interpretation: string | null; correction_text: string | null; self_explanation: string | null }
interface Ctx { mindText: string; messages: Msg[]; understandings: Und[] }
interface Ai { apiKey: string; model: string }
type Candidate = GroundedCandidate;
interface Section { heading: string; body: string; status: "confirmed" | "candidate" }
interface Report { title: string; summary: string; sections: Section[]; next_step: string }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (code: string, error: string, status = 200) => json({ ok: false, code, error }, status);

// ── 텍스트 규칙(순수) ──
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
function forbidden(text: string): boolean {
  const t = text.toLowerCase();
  return FORBIDDEN_TERMS.some((term) => t.includes(term));
}
function extractJson(text: string): unknown {
  const t = text.trim();
  for (const cand of [t, t.match(/\{[\s\S]*\}/)?.[0], t.match(/\[[\s\S]*\]/)?.[0]]) {
    if (!cand) continue;
    try { return JSON.parse(cand); } catch { /* next */ }
  }
  return null;
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
// 2026-09-16: 후보 질문 끝의 장식(이모지·기호·닫는 따옴표)은 서버가 잘라낸다. 글자를 새로 만들지 않는다(get-step-question 과 같은 규칙).
function tidyQuestionText(raw: string): string {
  const text = raw.trim().replace(/^["'「『]+|["'」』]+$/g, "").trim();
  if (text.endsWith("?")) return text;
  const last = text.lastIndexOf("?");
  if (last < 0) return text;
  if (/[\p{L}\p{N}]/u.test(text.slice(last + 1))) return text;
  return text.slice(0, last + 1).trim();
}
function parseCandidates(raw: string): Candidate[] {
  const parsed = extractJson(raw);
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as Json).candidates) ? ((parsed as Json).candidates as unknown[]) : null;
  if (!list) return [];
  const out: Candidate[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Json;
    const question = typeof o.question === "string" ? tidyQuestionText(o.question) : "";
    if (!question || question.length > LIMITS.QUESTION_MAX) continue;
    const anchor = typeof o.anchor === "string" ? o.anchor.trim().slice(0, LIMITS.MEANING_MAX) : "";
    const assumptions = Array.isArray(o.assumptions)
      ? o.assumptions.filter((value): value is string => typeof value === "string" && !!value.trim()).slice(0, LIMITS.KEYS_MAX)
      : ["schema_missing"];
    out.push({
      acknowledgement: typeof o.acknowledgement === "string" ? o.acknowledgement.trim().slice(0, 100) : "",
      question,
      meaning: typeof o.meaning === "string" ? o.meaning.trim().slice(0, LIMITS.MEANING_MAX) : "",
      keys: cleanKeys(o.keys),
      anchor,
      assumptions,
    });
    if (out.length >= LIMITS.CANDIDATES_MAX) break;
  }
  return out;
}
interface Block { asked: string[]; askedJourney: string[]; askedJourneyFull: string[]; rejectedKeys: string[]; rejectedTexts: string[] }
function blocked(c: Candidate, b: Block, evidenceParts: string[], intentHistory: string[], avoidAnchorReuse = false): boolean {
  if (forbidden(`${c.acknowledgement ?? ""}\n${c.question}`)) return true;
  if (c.acknowledgement && !normalizeKey(c.acknowledgement).includes(normalizeKey(c.anchor))) return true;
  if (questionQualityReason(c, evidenceParts)) return true;
  if (b.asked.some((a) => looksSame(c.question, a, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP))) return true;
  if (repeatsQuestionIntent(c.question, intentHistory)) return true;
  const anchorKey = normalizeKey(c.anchor);
  const anchorStem = anchorKey.slice(0, Math.min(2, anchorKey.length));
  const hasDifferentEvidence = evidenceParts.some((part) => {
    const partKey = normalizeKey(part);
    const sameTopic = partKey.includes(anchorKey) || anchorKey.includes(partKey) ||
      (anchorStem.length >= 2 && partKey.includes(anchorStem)) || looksSame(c.anchor, part, 0.35, 0.49);
    return !sameTopic;
  });
  if (avoidAnchorReuse && hasDifferentEvidence && reusesJourneyAnchor(c.anchor, b.askedJourneyFull)) return true;
  for (const k of c.keys) {
    for (const r of b.rejectedKeys) {
      if (k === r || (k.length >= 2 && r.length >= 2 && (k.includes(r) || r.includes(k)))) return true;
    }
  }
  return b.rejectedTexts.some((r) => looksSame(`${c.acknowledgement ?? ""} ${c.question}`, r, LIMITS.REJECT_SIM, LIMITS.REJECT_OVERLAP) || (!!c.meaning && looksSame(c.meaning, r, LIMITS.REJECT_SIM, LIMITS.REJECT_OVERLAP)));
}
// 2026-09-16: 리포트의 '확정(confirmed)'은 AI 출력이 아니라 서버가 결정한다(Information Status).
// 항목의 anchor(사용자 근거에서 글자 그대로 가져온 표현)가 실제 사용자 근거에 있고 본문에도 그대로 들어 있을 때만 confirmed 를 인정하고,
// 그렇지 않으면 candidate 로 내린다. 글자는 바꾸지 않는다.
function sectionGrounded(anchor: string, body: string, evidenceParts: string[]): boolean {
  const a = normalizeKey(anchor);
  if (a.length < 2) return false;
  if (!normalizeKey(body).includes(a)) return false;
  return evidenceParts.some((part) => normalizeKey(part).includes(a));
}
function parseReport(raw: string, rejectedTexts: string[], evidenceParts: string[]): Report | null {
  const o = extractJson(raw) as Json | null;
  if (!o || typeof o !== "object") return null;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, LIMITS.TITLE_MAX) : "";
  const summary = typeof o.summary === "string" ? o.summary.trim().slice(0, LIMITS.SUMMARY_MAX) : "";
  const next_step = typeof o.next_step === "string" ? o.next_step.trim().slice(0, LIMITS.SUMMARY_MAX) : "";
  if (!title || !summary || !next_step || !Array.isArray(o.sections)) return null;
  const sections: Section[] = [];
  for (const s of o.sections as unknown[]) {
    if (!s || typeof s !== "object") continue;
    const x = s as Json;
    const heading = typeof x.heading === "string" ? x.heading.trim().slice(0, LIMITS.TITLE_MAX) : "";
    const body = typeof x.body === "string" ? x.body.trim().slice(0, LIMITS.SECTION_MAX) : "";
    if (!heading || !body) continue;
    const anchor = typeof x.anchor === "string" ? x.anchor.trim().slice(0, LIMITS.MEANING_MAX) : "";
    const confirmed = x.status === "confirmed" && sectionGrounded(anchor, body, evidenceParts);
    sections.push({ heading, body, status: confirmed ? "confirmed" : "candidate" });
    if (sections.length >= LIMITS.SECTIONS_MAX) break;
  }
  if (sections.length < LIMITS.SECTIONS_MIN) return null;
  const texts = [title, summary, next_step, ...sections.flatMap((s) => [s.heading, s.body])];
  if (texts.some(forbidden)) return null;
  // 거절한 해석이 리포트에 그대로 되살아나면 폐기
  if (texts.some((t) => rejectedTexts.some((r) => overlapStats(t, r).overlap > LIMITS.REJECT_OVERLAP))) return null;
  return { title, summary, sections, next_step };
}

// ── OpenAI ──
async function callOpenAI(ai: Ai, system: string, user: string, jsonMode: boolean, maxTokens = QUESTION_MAX_TOKENS): Promise<string> {
  const ctrl = new AbortController();
  const timeoutMs = maxTokens === REPORT_MAX_TOKENS ? REPORT_TIMEOUT_MS : QUESTION_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // 2026-09-16: 진단 로그를 get-step-question([gsq])과 같은 형식으로 남긴다([ej]). 오류 종류·HTTP 상태·모델명만. 키·원문 없음.
    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({ model: ai.model, temperature: TEMPERATURE, top_p: TOP_P, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }], ...(jsonMode ? { response_format: { type: "json_object" } } : {}) }),
        signal: ctrl.signal,
      });
    } catch (err) {
      console.error(`[ej] openai_fetch_error name=${(err as Error)?.name ?? "?"} model=${ai.model} timeout_ms=${timeoutMs}`);
      throw err;
    }
    if (!res.ok) {
      let code = "";
      try {
        const j = await res.json();
        code = String(j?.error?.code ?? j?.error?.type ?? "");
      } catch {
        /* 본문 없음 */
      }
      console.error(`[ej] openai_http status=${res.status} code=${code} model=${ai.model}`);
      throw new Error("OPENAI_HTTP");
    }
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      console.error(`[ej] openai_empty finish=${String(data?.choices?.[0]?.finish_reason ?? "")} model=${ai.model}`);
      throw new Error("OPENAI_EMPTY");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}
function priorityNote(ctx: Ctx): string {
  const affirmed: string[] = [], rejected: string[] = [];
  for (const u of ctx.understandings) {
    if (u.choice === "agree") continue;
    if (u.self_explanation) affirmed.push(u.self_explanation);
    if (u.correction_text) affirmed.push(u.correction_text);
    if (u.rejected_interpretation) rejected.push(u.rejected_interpretation);
  }
  const list = (arr: string[]) => arr.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return (affirmed.length ? `\n[사용자가 직접 설명·정정한 내용 — 가장 먼저, 가장 우선으로 반영]\n${list(affirmed)}` : "") +
    (rejected.length ? `\n[사용자가 거절한 해석 — 같은 뜻을 표현만 바꿔서도 다시 쓰지 말 것]\n${list(rejected)}` : "");
}
function rejectedKeysOf(rejected: string): string[] {
  return [...new Set(rejected.split(/[\s,./!?"'“”‘’()[\]{}]+/).map(normalizeKey).filter((part) => part.length >= 2))].slice(0, LIMITS.KEYS_MAX);
}
function buildBlock(ctx: Ctx): Block {
  const b: Block = {
    asked: askedQuestionTexts(ctx),
    askedJourney: askedJourneyQuestionTexts(ctx),
    askedJourneyFull: askedJourneyFullTexts(ctx),
    rejectedKeys: [],
    rejectedTexts: [],
  };
  for (const u of ctx.understandings) {
    if (u.choice !== "no" || !u.rejected_interpretation) continue;
    b.rejectedTexts.push(u.rejected_interpretation);
    for (const k of rejectedKeysOf(u.rejected_interpretation)) if (!b.rejectedKeys.includes(k)) b.rejectedKeys.push(k);
  }
  return b;
}
type QuestionMode = "normal" | "feedback" | "brief" | "uncertain" | "fatigue";
function renderCandidate(candidate: Candidate, mode: QuestionMode, feedbackKind = journeyFeedbackKind("")): string {
  if (mode === "feedback") {
    const acknowledgement = feedbackKind === "repeat"
      ? "맞아요. 같은 내용을 되묻지 않고 질문을 바꿔볼게요."
      : feedbackKind === "burden"
      ? "제가 어렵게 물었어요. 이번에는 짧고 편하게 이어갈게요."
      : feedbackKind === "correction"
      ? "알겠어요. 방금 바로잡아 준 내용에서 다시 이어갈게요."
      : "제가 맥락을 놓쳤어요. 방금 한 말에서 다시 이어갈게요.";
    return `${acknowledgement}\n\n${candidate.question}`;
  }
  if (mode === "fatigue") return `괜찮아요. 더 깊이 묻지 않고 가볍게 이어갈게요.\n\n${candidate.question}`;
  if (mode === "uncertain") return `괜찮아요. 바로 떠오르지 않아도 돼요.\n\n${candidate.question}`;
  if (mode === "brief") return `짧게 말해줘도 충분해요.\n\n${candidate.question}`;
  const acknowledgement = (candidate.acknowledgement ?? "").replace(/\?+/g, "").trim();
  return acknowledgement ? `${acknowledgement}\n\n${candidate.question}` : candidate.question;
}
function latestJourneyAnswer(ctx: Ctx): string {
  return [...ctx.messages].reverse().find((message) => message.role === "user" && message.message_kind === "journey_answer")?.content.trim() ?? "";
}
function lowInformationStreak(ctx: Ctx): number {
  let count = 0;
  for (const message of [...ctx.messages].reverse()) {
    if (message.role !== "user" || message.message_kind !== "journey_answer") continue;
    if (!isLowInformationReply(message.content)) break;
    count++;
  }
  return count;
}
function lowEffortStreak(ctx: Ctx): number {
  let count = 0;
  for (const message of [...ctx.messages].reverse()) {
    if (message.role !== "user" || message.message_kind !== "journey_answer") continue;
    if (!isLowInformationReply(message.content) && !isBriefReply(message.content)) break;
    count++;
  }
  return count;
}
async function genStepQuestion(ai: Ai, ctx: Ctx, status: StepStatus): Promise<string> {
  const block = buildBlock(ctx);
  const evidenceParts = userEvidenceParts(ctx);
  const evidence = userEvidenceText(ctx);
  const latestAnswer = latestJourneyAnswer(ctx);
  // 질문 피드백은 바로 다음 질문 한 번만 고친다. 과거 피드백을 뒤 단계까지 끌고 가지 않는다.
  const feedbackKind = journeyFeedbackKind(latestAnswer);
  const feedback = feedbackKind ? latestAnswer : "";
  const uncertainCount = lowInformationStreak(ctx);
  const uncertain = uncertainCount > 0 && isLowInformationReply(latestAnswer);
  const effortCount = lowEffortStreak(ctx);
  const brief = !uncertain && isBriefReply(latestAnswer);
  const fatigued = effortCount >= 2;
  const mode: QuestionMode = feedback ? "feedback" : fatigued ? "fatigue" : uncertain ? "uncertain" : brief ? "brief" : "normal";
  // 다른 사용자 근거가 실제로 있을 때만 같은 중심 표현을 버린다(blocked에서 유사도까지 확인).
  // 근거가 하나뿐이면 그 표현을 언급하되 질문 관점은 반드시 바꾼다.
  const avoidAnchorReuse = mode === "uncertain" || mode === "fatigue" || feedbackKind === "repeat" || feedbackKind === "burden";
  const focus = nextQuestionFocus(stepOf(status), block.asked, mode !== "normal");
  const latestMeaningful = latestUserAnswer(ctx);
  const uncertaintyNote = mode === "fatigue"
    ? `\n[대화 피로 회복 — 사용자 마음의 사실로 사용 금지]\n최근 ${effortCount}개의 답이 짧거나 답하기 어려운 상태다. 더 깊게 캐묻지 말고, 한 단어나 짧은 문장으로 답할 수 있는 가벼운 새 방향을 묻는다. 이유·의미를 다시 캐묻지 않는다.`
    : uncertain
    ? `\n[답변 상태 — 사용자 마음의 사실로 사용 금지]\n사용자가 ${uncertainCount}회 연속으로 바로 답하기 어렵다는 뜻을 밝혔다. 이전 질문의 주제와 의도를 반복하지 말고, 한 단어나 짧은 문장으로 답할 수 있는 다른 방향을 묻는다. 이유를 캐묻거나 답을 강요하지 않는다.`
    : brief
    ? `\n[짧은 답변 — 사실은 보존하되 부담 완화]\n답변은 유효하지만 짧다. 같은 내용을 확대 해석하지 말고, 짧게 답할 수 있는 구체적인 새 방향을 묻는다.`
    : "";
  const askedNote = block.asked.length
    ? `\n\n[이미 한 질문 — STEP 1부터 표현만 바꾼 반복도 금지]\n${block.asked.slice(-7).map((question, index) => `${index + 1}. ${question}`).join("\n")}`
    : "";
  const system = `${PERSONA} 지금은 STEP ${stepOf(status)}이다. 목적은 "${STEP_OBJECTIVES[status]}"이다. 이번 질문 방식은 "${STEP_LENSES[status]}"이고, 아직 묻지 않은 이번 초점은 "${focus}"이다. 아래 [사용자 근거]만 사실로 사용할 수 있다. 이전 ECHO 문장은 사실 근거가 아니다. 친구와 이어서 대화하듯 후보 3개를 만들되 세 후보의 표현도 서로 달라야 한다. 각 후보는 {"acknowledgement":"anchor를 글자 그대로 포함해 바로 앞 사용자 말을 짧게 받아주는 1문장","question":"80자 이내의 짧고 쉬운 열린 질문 1개","anchor":"사용자 근거에서 글자 그대로 가져온 핵심 표현","assumptions":[],"meaning":"이전 질문과 다른 새 질문 의도","keys":["핵심 의미 명사구 2~5개"]} 형태이고, 전체를 {"candidates":[...]} JSON 객체로만 출력한다. 반드시 지켜라: 1) 바로 앞의 유효한 사용자 말인 "${latestMeaningful}"에서 자연스럽게 이어가고, 오래전 표현으로 갑자기 돌아가지 않는다. acknowledgement에는 anchor를 그대로 넣되 question에는 그대로 복사하지 않아도 된다. 2) 사용자의 말을 거의 그대로 옮기고 물음표만 붙이는 되묻기, 예/아니오로 끝나는 확인 질문, 이미 답한 내용을 다시 묻는 질문은 금지한다. 3) 바로 앞 답변에서 아직 나오지 않은 새로운 정보 한 가지만 묻는다. 4) 사용자가 말하지 않은 사람·관계·미래 장면·감정·원인·회피·상처·행동을 만들지 않는다. 5) 따옴표 안의 말이나 '~라고 했다'는 다른 사람의 말일 수 있다. 그것을 사용자의 감정·생각으로 바꾸지 않는다. 6) 미래의 일을 이미 겪은 기억처럼 묻지 않는다. 7) 거절한 해석과 같은 뜻은 표현을 바꿔도 만들지 않는다. 8) AI가 틀렸다는 피드백이나 정정이 있으면 기존 해석을 버리고 사용자가 바로잡은 표현에서만 다시 시작한다. 9) 이미 물은 질문과 같은 의도(이유·의미·감정·상황·중요함·행동·남기기·구체화·바람·반복·비교)를 다시 묻지 않는다. 10) 질문 앞 설명은 만들지 말고 물음표는 하나만 쓴다. 11) 사용자가 답하기 어려워했거나 반복을 지적했다면 최근 질문의 중심 표현(anchor)을 다시 쓰지 말고 다른 사용자 근거로 주제를 전환한다.${askedNote}${uncertaintyNote}${priorityNote(ctx)}`;
  let blockedAll: string[] = [];
  for (let i = 0; i < LIMITS.ATTEMPTS; i++) {
    const extra = blockedAll.length ? `\n\n다음 후보는 서버에서 차단되었다. 다른 뜻의 질문을 만들어라:\n${blockedAll.map((q, n) => `${n + 1}. ${q}`).join("\n")}` : "";
    const user = `[사용자 근거]\n${evidence || "(근거 없음)"}${feedback ? `\n\n[질문에 대한 피드백 — 사실 근거로 사용 금지]\n${feedback}` : ""}${extra}`;
    const parsed = parseCandidates(await callOpenAI(ai, system, user, true));
    const cands = mode !== "normal" ? parsed.map((candidate) => ({ ...candidate, acknowledgement: "" })) : parsed;
    const intentHistory = block.asked;
    const survivor = cands.find((c) => !blocked(c, block, evidenceParts, intentHistory, avoidAnchorReuse));
    if (survivor) return renderCandidate(survivor, mode, feedbackKind);
    blockedAll = blockedAll.concat(cands.map((c) => c.question));
    // 진단 로그: 단계·모드·후보 수·차단 수만. 원문 없음.
    console.error(`[ej] candidates_blocked step=${stepOf(status)} mode=${mode} parsed=${cands.length} attempt=${i + 1}`);
  }
  console.error(`[ej] no_candidate step=${stepOf(status)} mode=${mode} blocked_total=${blockedAll.length}`);
  throw new Error("NO_CANDIDATE");
}
async function genReport(ai: Ai, ctx: Ctx): Promise<Report> {
  const rejectedTexts = ctx.understandings.filter((u) => u.choice === "no" && u.rejected_interpretation).map((u) => u.rejected_interpretation as string);
  const system = `${PERSONA} 제공된 [사용자 근거]만 바탕으로 사용자가 '진짜 나'를 이해하도록 돕는 자기이해 리포트를 한국어로 써라. 이전 ECHO 질문·요약은 근거가 아니다. 카피의 주어는 '나/내가'다. JSON 객체로만 출력한다. 형식: {"title":"40자 이내 제목","summary":"2~3문장 요약","sections":[{"heading":"소제목","body":"3~6문장","status":"confirmed 또는 candidate","anchor":"사용자 근거에서 글자 그대로 가져온 핵심 표현"}],"next_step":"지금 해볼 수 있는 아주 작은 한 걸음 1~2문장"}. sections 는 3~5개. status 규칙: 사용자가 직접 말한 내용만으로 쓴 부분은 "confirmed" 로 표시하되 그 항목의 anchor 를 본문에 그대로 인용해야 한다(서버가 사용자 근거와 대조해 인용이 없으면 candidate 로 내린다). 조심스러운 해석이 섞인 부분은 "candidate" 로 표시하고 문장도 '~인 것 같아요'로 쓴다. 반드시 지켜라: 1) 사용자가 직접 설명·정정한 내용을 가장 우선으로 반영한다. 2) 거절한 해석은 표현을 바꿔도 다시 쓰지 않는다. 3) 사용자가 말하지 않은 사람·관계·사건·감정·원인·회피·상처를 만들지 않는다. 4) 진단·치료·점술·성격검사식 단정, 데이팅·궁합 표현을 쓰지 않는다.${priorityNote(ctx)}`;
  for (let i = 0; i < LIMITS.ATTEMPTS; i++) {
    const report = parseReport(await callOpenAI(ai, system, `[사용자 근거]\n${userEvidenceText(ctx)}`, true, REPORT_MAX_TOKENS), rejectedTexts, userEvidenceParts(ctx));
    if (report) return report;
  }
  throw new Error("NO_CANDIDATE");
}

// ── DB ──
const CONV_COLUMNS = "id, user_id, status, request_token, request_action, updated_at";
async function loadConv(sb: Db, userId: string, id: string): Promise<Conv | null> {
  const { data, error } = await sb.from("conversations").select(CONV_COLUMNS).eq("id", id).maybeSingle();
  return error || !data || data.user_id !== userId ? null : (data as Conv);
}
async function loadCtx(sb: Db, id: string): Promise<Ctx> {
  const [e, m, u] = await Promise.all([
    sb.from("emotions").select("mind_text").eq("conversation_id", id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    sb.from("messages").select("role, step, content, message_kind").eq("conversation_id", id).order("created_at", { ascending: true }),
    sb.from("understanding_results").select("choice, rejected_interpretation, correction_text, self_explanation").eq("conversation_id", id).order("created_at", { ascending: true }),
  ]);
  return { mindText: String(e?.data?.mind_text ?? ""), messages: (m?.data ?? []) as Msg[], understandings: (u?.data ?? []) as Und[] };
}
async function loadReport(sb: Db, id: string): Promise<Json | null> {
  const { data } = await sb.from("reports").select("id, title, summary, content, created_at").eq("conversation_id", id).maybeSingle();
  return (data as Json | null) ?? null;
}
async function hasPaidReportAccess(sb: Db, userId: string, conversationId: string): Promise<boolean> {
  const { data, error } = await sb.from("payments")
    .select("id")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  return !error && !!data;
}

// 구 흐름에서 STEP 2 뒤 white_door_ready로 멈춘 대화만 복원한다.
// 저장된 이해 확인(agree)이 실제로 있을 때에만 STEP 3으로 조건부 전환하며, STEP 7 완료로 간주하지 않는다.
async function restoreLegacyWhiteDoor(sb: Db, conv: Conv): Promise<Conv | null> {
  if (conv.status !== "white_door_ready") return conv;
  const { data: understanding, error: understandingError } = await sb.from("understanding_results")
    .select("id")
    .eq("conversation_id", conv.id)
    .eq("user_id", conv.user_id)
    .eq("choice", "agree")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (understandingError || !understanding) return null;

  const { data: updated, error: updateError } = await sb.from("conversations")
    .update({ status: "step3", current_step: 3, updated_at: new Date().toISOString() })
    .eq("id", conv.id)
    .eq("user_id", conv.user_id)
    .eq("status", "white_door_ready")
    .select(CONV_COLUMNS)
    .maybeSingle();
  if (updateError) return null;
  if (updated) return updated as Conv;
  return loadConv(sb, conv.user_id, conv.id);
}
type Claim = "claimed" | "duplicate_done" | "duplicate_pending" | "busy" | "invalid_state";
async function claim(sb: Db, conv: Conv, expected: string, token: string): Promise<Claim> {
  const now = new Date();
  const stale = new Date(now.getTime() - PENDING_STALE_MS).toISOString();
  const { data, error } = await sb.from("conversations").update({ request_token: token, request_action: PENDING, updated_at: now.toISOString() })
    .eq("id", conv.id).eq("status", expected)
    .or(`request_token.is.null,request_token.neq.${token}`)
    .or(`request_action.is.null,request_action.neq.${PENDING},updated_at.is.null,updated_at.lt.${stale}`)
    .select("id");
  if (!error && data && data.length === 1) return "claimed";
  const fresh = await loadConv(sb, conv.user_id, conv.id);
  if (!fresh) return "invalid_state";
  if (fresh.request_token === token) return fresh.request_action === PENDING ? "duplicate_pending" : "duplicate_done";
  return fresh.status !== expected ? "invalid_state" : "busy";
}
async function release(sb: Db, conv: Conv, token: string) {
  await sb.from("conversations").update({ request_token: conv.request_token, request_action: conv.request_action }).eq("id", conv.id).eq("request_token", token);
}
async function commit(sb: Db, id: string, token: string, action: string, status: Status): Promise<boolean> {
  const { data, error } = await sb.from("conversations").update({ status, current_step: displayStep(status), request_action: action, updated_at: new Date().toISOString() }).eq("id", id).eq("request_token", token).select("id");
  return !error && !!data && data.length === 1;
}
async function insertMsg(
  sb: Db,
  convId: string,
  userId: string,
  role: "ai" | "user",
  step: number,
  content: string,
  messageKind: JourneyMessageKind,
): Promise<string | null> {
  const { data, error } = await sb.from("messages").insert({
    conversation_id: convId,
    user_id: userId,
    role,
    step,
    content,
    message_kind: messageKind,
  }).select("id").single();
  return error || !data ? null : String(data.id);
}
async function rollback(sb: Db, ids: string[]) {
  if (ids.length) await sb.from("messages").delete().in("id", ids);
}
function claimError(c: Claim): Response {
  if (c === "duplicate_pending") return fail("IN_PROGRESS", "이미 처리 중이에요. 잠시만 기다려 주세요.", 409);
  if (c === "busy") return fail("IN_PROGRESS", "다른 요청을 처리하고 있어요. 잠시 후 다시 시도해 주세요.", 409);
  return fail("INVALID_STATE", "현재 단계에서는 진행할 수 없어요.");
}
// 현재 상태 → 화면 응답. 리포트 미구매 상태에는 status 만 반환한다. 여정 단계는 질문 유무까지 반환한다.
async function stateResponse(sb: Db, conv: Conv): Promise<Response> {
  if (isPre(conv.status)) return json({ ok: true, status: conv.status, conversationId: conv.id });
  if (!isJourney(conv.status)) return fail("UNKNOWN_STATE", "알 수 없는 상태예요. 잠시 후 다시 시도해 주세요.");
  if (isStep(conv.status)) {
    const ctx = await loadCtx(sb, conv.id);
    const question = latestJourneyQuestion(ctx, stepOf(conv.status));
    return json({ ok: true, status: conv.status, step: stepOf(conv.status), conversationId: conv.id, question, previousAnswer: latestUserTurn(ctx), needsQuestion: !question });
  }
  const reportEntitled = await hasPaidReportAccess(sb, conv.user_id, conv.id);
  if (!reportEntitled) {
    return json({ ok: true, status: REPORT_READY, step: REPORT_STEP, conversationId: conv.id, hasReport: false, reportEntitled: false });
  }
  const report = await loadReport(sb, conv.id);
  return json({ ok: true, status: conv.status, step: REPORT_STEP, conversationId: conv.id, hasReport: !!report, reportEntitled: true, report: report ?? undefined });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("BAD_REQUEST", "잘못된 요청이에요.", 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!authHeader.startsWith("Bearer ")) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);
    const userSb: Db = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userSb.auth.getUser();
    if (authError || !user) return fail("UNAUTHORIZED", "로그인이 필요해요.", 401);
    if (!serviceKey) return fail("ERROR", "서버 저장 설정이 필요해요.");
    const sb: Db = createClient(url, serviceKey, { auth: { persistSession: false } });

    const ai: Ai = { apiKey: Deno.env.get("OPENAI_API_KEY") ?? "", model: resolveModel(Deno.env.get("OPENAI_MODEL")) };
    const aiReady = !!ai.apiKey && !!ai.model;
    const body = (await req.json().catch(() => null)) as Json | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const token = typeof body?.token === "string" && LIMITS.TOKEN.test(body.token) ? body.token : "";

    // ── list: 보관함(본인 리포트 목록, RLS) ──
    if (action === "list") {
      const { data: paidRows, error: paidError } = await sb.from("payments")
        .select("conversation_id")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .limit(200);
      if (paidError) return fail("ERROR", "보관함을 불러오지 못했어요.");
      const paidConversationIds = [...new Set((paidRows ?? []).map((row) => String(row.conversation_id)))];
      if (!paidConversationIds.length) return json({ ok: true, items: [] });
      const { data: completedRows, error: completedError } = await sb.from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .in("id", paidConversationIds)
        .in("status", [REPORT_READY, REPORT_DONE])
        .limit(200);
      if (completedError) return fail("ERROR", "보관함을 불러오지 못했어요.");
      const completedConversationIds = (completedRows ?? []).map((row) => String(row.id));
      if (!completedConversationIds.length) return json({ ok: true, items: [] });
      const { data, error } = await sb.from("reports")
        .select("id, conversation_id, title, summary, created_at")
        .eq("user_id", user.id)
        .in("conversation_id", completedConversationIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return fail("ERROR", "보관함을 불러오지 못했어요.");
      return json({ ok: true, items: data ?? [] });
    }

    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
    if (!conversationId) return fail("BAD_REQUEST", "대화 식별값이 없어요.");
    const conv = await loadConv(sb, user.id, conversationId);
    if (!conv) return fail("FORBIDDEN", "대화를 찾지 못했어요.", 403);

    if (action === "resume") {
      if (conv.status === "white_door_ready") {
        const restored = await restoreLegacyWhiteDoor(sb, conv);
        if (!restored) return fail("INVALID_STATE", "이해 확인 기록을 확인하지 못했어요. 다시 확인해 주세요.");
        return stateResponse(sb, restored);
      }
      return stateResponse(sb, conv);
    }
    if (!token) return fail("BAD_REQUEST", "요청 식별값이 없어요.");
    if (!isJourney(conv.status)) return fail(isPre(conv.status) ? "INVALID_STATE" : "UNKNOWN_STATE", isPre(conv.status) ? "아직 이 단계가 아니에요." : "알 수 없는 상태예요. 잠시 후 다시 시도해 주세요.");

    // ── ask: 현재 단계 질문 생성(없을 때만 · 멱등) ──
    if (action === "ask") {
      if (!isStep(conv.status)) return fail("INVALID_STATE", "현재 단계에서는 질문을 만들 수 없어요.");
      const step = stepOf(conv.status);
      const before = await loadCtx(sb, conv.id);
      if (latestJourneyQuestion(before, step)) return stateResponse(sb, conv);
      if (!aiReady) return fail("AI_NOT_CONFIGURED", "AI 서버 설정 필요");
      const c = await claim(sb, conv, conv.status, token);
      if (c === "duplicate_done") return stateResponse(sb, conv);
      if (c !== "claimed") return claimError(c);
      const created: string[] = [];
      try {
        const question = await genStepQuestion(ai, before, conv.status);
        const id = await insertMsg(sb, conv.id, user.id, "ai", step, question, "journey_question");
        if (!id) throw new Error("DB_AI_MSG");
        created.push(id);
        if (!(await commit(sb, conv.id, token, "ask", conv.status))) throw new Error("DB_STATE");
        return json({ ok: true, status: conv.status, step, conversationId: conv.id, question, previousAnswer: latestUserTurn(before), needsQuestion: false });
      } catch (e) {
        await rollback(sb, created);
        await release(sb, conv, token);
        const m = (e as Error).message;
        if (m === "NO_CANDIDATE") return fail("NO_CANDIDATE", "질문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        if (m.startsWith("DB_")) return fail("ERROR", "저장에 실패했어요. 다시 시도해 주세요.");
        return fail("AI_ERROR", "AI 응답을 받지 못했어요.");
      }
    }

    // ── answer: 답변을 먼저 저장하고 상태를 확정한다. 다음 질문 AI 호출은 별도 ask 요청이다. ──
    if (action === "answer") {
      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!answer) return fail("BAD_REQUEST", "답변을 입력해 주세요.");
      if (answer.length > LIMITS.ANSWER_MAX) return fail("BAD_REQUEST", `답변은 ${LIMITS.ANSWER_MAX}자까지 적을 수 있어요.`);
      // 어느 단계든 저장은 끝났지만 응답이 끊겨 같은 토큰으로 다시 온 경우, 저장된 상태를 그대로 돌려준다.
      if (conv.request_token === token && conv.request_action === "answer") {
        return stateResponse(sb, conv);
      }
      if (!isStep(conv.status)) return fail("INVALID_STATE", "현재 단계에서는 답변할 수 없어요.");
      const status = conv.status;
      const step = stepOf(status);
      // “무슨 말이야/같은 질문이잖아” 같은 피드백은 답변으로 왜곡하지 않고 같은 단계에서 질문을 고친다.
      const repair = isMetaFeedback(answer);
      const next = repair ? status : nextAfterAnswer(status);
      const c = await claim(sb, conv, status, token);
      if (c === "duplicate_done") return stateResponse(sb, conv);
      if (c !== "claimed") return claimError(c);
      const created: string[] = [];
      try {
        const ctx = await loadCtx(sb, conv.id);
        if (!latestJourneyQuestion(ctx, step)) throw new Error("NO_QUESTION");
        const userId = await insertMsg(sb, conv.id, user.id, "user", step, answer, "journey_answer");
        if (!userId) throw new Error("DB_USER_MSG");
        created.push(userId);
        if (!(await commit(sb, conv.id, token, "answer", next))) throw new Error("DB_STATE");
        return json({ ok: true, status: next, step: displayStep(next), conversationId: conv.id, previousAnswer: answer, needsQuestion: isStep(next) });
      } catch (e) {
        await rollback(sb, created);
        await release(sb, conv, token);
        const m = (e as Error).message;
        if (m === "NO_QUESTION") return fail("INVALID_STATE", "먼저 질문을 불러와 주세요.");
        if (m.startsWith("DB_")) return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
        return fail("ERROR", "저장에 실패했어요. 작성한 내용은 그대로 남아 있어요.");
      }
    }

    // ── report: 리포트 생성(대화당 1건 · 멱등) 또는 조회 ──
    if (action === "report") {
      if (conv.status !== REPORT_READY && conv.status !== REPORT_DONE) {
        return fail("INVALID_STATE", "아직 이야기가 끝나지 않았어요.");
      }
      if (!(await hasPaidReportAccess(sb, user.id, conv.id))) {
        return fail("PAYMENT_REQUIRED", "리포트를 열려면 구매 권한이 필요해요.", 403);
      }
      const existing = await loadReport(sb, conv.id);
      if (existing) {
        if (conv.status !== REPORT_DONE) await sb.from("conversations").update({ status: REPORT_DONE, current_step: REPORT_STEP, updated_at: new Date().toISOString() }).eq("id", conv.id).eq("status", REPORT_READY);
        return json({ ok: true, status: REPORT_DONE, step: REPORT_STEP, conversationId: conv.id, hasReport: true, report: existing });
      }
      if (!aiReady) return fail("AI_NOT_CONFIGURED", "AI 서버 설정 필요");
      const c = await claim(sb, conv, conv.status, token);
      if (c === "duplicate_done") return stateResponse(sb, conv);
      if (c !== "claimed") return claimError(c);
      try {
        const ctx = await loadCtx(sb, conv.id);
        const report = await genReport(ai, ctx);
        const { data: saved, error: saveErr } = await sb.from("reports")
          .insert({ user_id: user.id, conversation_id: conv.id, title: report.title, summary: report.summary, content: report, model: ai.model })
          .select("id, title, summary, content, created_at").single();
        if (saveErr || !saved) throw new Error("DB_REPORT");
        if (!(await commit(sb, conv.id, token, "report", REPORT_DONE))) throw new Error("DB_STATE");
        return json({ ok: true, status: REPORT_DONE, step: REPORT_STEP, conversationId: conv.id, hasReport: true, report: saved });
      } catch (e) {
        await release(sb, conv, token);
        const m = (e as Error).message;
        if (m === "NO_CANDIDATE") return fail("NO_CANDIDATE", "리포트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        if (m === "DB_REPORT") return fail("ERROR", "리포트 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        if (m === "DB_STATE") return fail("ERROR", "상태 저장에 실패했어요. 다시 열면 리포트를 볼 수 있어요.");
        return fail("AI_ERROR", "AI 응답을 받지 못했어요.");
      }
    }

    return fail("BAD_REQUEST", "알 수 없는 요청이에요.");
  } catch {
    return fail("ERROR", "서버 오류가 발생했어요.", 500);
  }
});
