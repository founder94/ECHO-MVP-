// get-step-question — OpenAI 호출·후보 생성
// LLM 은 후보만 만든다. 차단·선택·상태 전환은 rules.ts + index.ts 가 한다.
import {
  INTENT_HISTORY,
  LIMITS,
  blockReasonFor,
  filterCandidates,
  isParrot,
  isSelfDirectedQuestion,
  isUnansweredComplaint,
  isUserQuestion,
  looksSame,
  normalizeKey,
  parseCandidates,
  pendingUserQuestion,
  pickCandidate,
  politeOrSame,
  questionShape,
  repeatsQuestionIntent,
  replyRevivesRejected,
  validateSingleQuestion,
  type BlockContext,
  type Candidate,
  type Context
} from "./rules.ts";
// ═══════════════════════════ ai.ts (OpenAI 호출·후보 생성) ═══════════════════════════
// get-step-question — OpenAI 호출·프롬프트·후보 생성 (index.ts 에서 사용)
// LLM은 후보(질문·의미)만 만든다. 차단·선택·상태 전환은 logic.ts(순수 규칙) + index.ts(상태머신)가 한다.
// 원문(마음 기록·답변·정정)은 로그에 남기지 않는다.


export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
export const OPENAI_TIMEOUT_MS = 6_000;
export const CONVERSATION_MAX_TOKENS = 500;
// 후보 3개에 reply 까지 담으면 500토큰에서 잘린다. 답변이 필요한 모드만 예산을 늘린다.
export const ASKED_MAX_TOKENS = 900;
export const TEMPERATURE = 0.2;
export const TOP_P = 0.9;

// 모델 이름 해석: 대표가 지정한 OPENAI_MODEL 시크릿을 우선 쓰되, 값이 비어 있거나
// 2026-09-14 운영 장애로 확인된 오타("gpt-40-mini" — 숫자 40, OpenAI 404 model_not_found)이면
// 올바른 기본 모델로 보정한다. 서버에서 Edge 시크릿 값을 직접 편집할 수단이 없어 코드에서 방어한다.
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export function resolveModel(raw: string | undefined): string {
  const m = (raw ?? "").trim();
  if (!m || m === "gpt-40-mini") return DEFAULT_OPENAI_MODEL;
  return m;
}

export type ChatMsg = { role: "system" | "user"; content: string };

export interface Ai {
  apiKey: string;
  model: string;
}

// ── OpenAI ──
export async function callOpenAI(ai: Ai, messages: ChatMsg[], jsonMode: boolean, maxTokens = CONVERSATION_MAX_TOKENS): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENAI_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ai.apiKey}` },
        body: JSON.stringify({
          model: ai.model,
          temperature: TEMPERATURE,
          top_p: TOP_P,
          max_tokens: maxTokens,
          messages,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: ctrl.signal,
      });
    } catch (err) {
      // 진단 로그(운영 원인 추적용): 오류 종류만. 키·원문 없음.
      console.error(`[gsq] openai_fetch_error name=${(err as Error)?.name ?? "?"} model=${ai.model}`);
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
      // 진단 로그: HTTP 상태·오류 코드·모델명만. 키·원문 없음.
      console.error(`[gsq] openai_http status=${res.status} code=${code} model=${ai.model}`);
      throw new Error("OPENAI_HTTP");
    }
    const data = await res.json();
    const finish = String(data?.choices?.[0]?.finish_reason ?? "");
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      console.error(`[gsq] openai_empty finish=${finish} model=${ai.model}`);
      throw new Error("OPENAI_EMPTY");
    }
    if (finish === "length") console.error(`[gsq] openai_truncated max_tokens=${maxTokens} len=${text.length} model=${ai.model}`);
    // 실제 비용 측정용(원문 없음): 요청·응답 토큰 수만 남긴다.
    console.error(`[gsq] openai_usage prompt=${Number(data?.usage?.prompt_tokens ?? 0)} completion=${Number(data?.usage?.completion_tokens ?? 0)} max_tokens=${maxTokens} model=${ai.model}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export const PERSONA =
  "너는 사용자의 마음을 공감하며 이해하는 대화형 동반자 'ECHO'다. 사용자가 실제로 말한 내용만 근거로 하고 추측·판단·진단·평가를 하지 않는다. 의료·법률·점술·성격검사식 단정을 하지 않는다. 데이팅·궁합 같은 표현을 쓰지 않는다. 화면에 나가는 모든 문장은 한국어 해요체 존댓말로 쓴다. 반말(해·했어·야·니·구나·줘·어때·궁금해)로 끝내지 마라.";

export const CONTROL_REPLIES = new Set(["맞아요", "조금 달라요", "그게 아니에요", "직접 설명할게요"]);
export const LOW_INFORMATION_REPLIES = /^(응|어|네|예|그래|맞아|맞아요|그렇지|그렇죠|글쎄|음|모르겠어|모르겠어요|잘 모르겠어요)[.!?\s]*$/;
export const META_FEEDBACK = [
  /질문.{0,18}(없|이상|어렵|안\s*맞|뜬금|똑같|같|반복|또)/,
  /(같|똑같)은?\s*질문|질문을?\s*(또|반복)/,
  /(어떻게|뭘|무엇을)\s*(말|이야기|대답|답)하/,
  /이게\s*(질문|무슨|뭔)/,
  /맥락.{0,8}(안\s*맞|이상|없)/,
  /내가.{0,8}어떻게\s*알/,
  /무슨\s*말|뭔\s*말|말이\s*안\s*되/,
  /(이해|납득).{0,8}(안|못)/,
  /왜.{0,8}(묻|물어|질문|되묻)/,
  /(?:이야기|말)(?:했|해\s*줬|했었).{0,8}잖/,
  /(?:이미|아까|방금).{0,12}(?:이야기|말)(?:했|해\s*줬|했었)/,
] as const;
export function isMetaFeedback(text: string): boolean {
  const value = text.trim();
  return (value !== "맞아요" && CONTROL_REPLIES.has(value)) || META_FEEDBACK.some((pattern) => pattern.test(value));
}
export function isLowInformationReply(text: string): boolean {
  return LOW_INFORMATION_REPLIES.test(text.trim());
}
export function userEvidenceParts(ctx: Context): string[] {
  const parts: string[] = [];
  if (ctx.mindText.trim()) parts.push(ctx.mindText.trim());
  for (const message of ctx.messages) {
    if (message.role !== "user" || isMetaFeedback(message.content) || isLowInformationReply(message.content)) continue;
    parts.push(message.content.trim());
  }
  for (const understanding of ctx.understandings) {
    if (understanding.correction_text?.trim()) parts.push(understanding.correction_text.trim());
    if (understanding.self_explanation?.trim()) parts.push(understanding.self_explanation.trim());
  }
  return [...new Set(parts.filter(Boolean))];
}
export function historyText(ctx: Context): string {
  return userEvidenceParts(ctx).map((part, index) => `${index + 1}. ${part}`).join("\n");
}
export function feedbackText(ctx: Context): string {
  return ctx.messages.filter((message) => message.role === "user" && isMetaFeedback(message.content)).map((message, index) => `${index + 1}. ${message.content}`).join("\n");
}

// 사용자가 정정·직접 설명한 내용(최우선 반영)과 거절한 해석(재사용 금지)을 분리한다
export function correctionBlock(ctx: Context): { affirmed: string[]; rejected: string[] } {
  const affirmed: string[] = [];
  const rejected: string[] = [];
  for (const u of ctx.understandings) {
    if (u.choice === "agree") continue;
    if (u.self_explanation) affirmed.push(u.self_explanation);
    if (u.correction_text) affirmed.push(u.correction_text);
    if (u.rejected_interpretation) rejected.push(u.rejected_interpretation);
  }
  return { affirmed, rejected };
}

export function priorityNote(ctx: Context): string {
  const { affirmed, rejected } = correctionBlock(ctx);
  const a = affirmed.length ? `\n[사용자가 직접 설명·정정한 내용 — 가장 먼저, 가장 우선으로 반영]\n${affirmed.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "";
  const r = rejected.length ? `\n[사용자가 거절한 해석 — 같은 뜻을 표현만 바꿔서도 다시 쓰지 말 것]\n${rejected.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "";
  return a + r;
}

// 확인된 기억과 참고용 리포트 요약을 분리해 넣는다. 둘 다 없으면 아무 말도 만들지 않는다(가짜 기억 금지).
export function priorNote(ctx?: Context): string {
  const memory = ctx?.memory;
  if (!memory) return "";
  const blocks: string[] = [];
  if (memory.confirmed.length) {
    blocks.push(`[내가 확인한 기억 — 사용자가 직접 확인하거나 바로잡은 내용이다. 새 사실을 만들지 말고, 같은 주제가 나오면 이어서 반영]\n${memory.confirmed.map((item, index) => `${index + 1}. ${item}`).join("\n")}`);
  }
  if (memory.summary) {
    blocks.push(`[지난 여정 리포트 요약 — 참고용이며 확인된 사실이 아니다. 단정하지 말 것]\n${memory.summary}`);
  }
  return blocks.length ? `\n\n${blocks.join("\n\n")}` : "";
}
// 바로 앞의 사용자가 직접 쓴 말(버튼 문구 "맞아요" 등은 제외). 정정·직접 설명(understanding_choice 의 본문)도 포함한다.
// 사용자가 ECHO 에게 물었는지(asked) 판정할 때 쓴다.
export function latestUserFreeText(ctx: Context): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    const message = ctx.messages[i];
    if (message.role !== "user" || CONTROL_REPLIES.has(message.content.trim())) continue;
    return message.content.trim();
  }
  return "";
}

// 2026-09-17 실기기 결함 #3: STEP 1 답변이 짧을 때("돈때문에") STEP 2 질문이 3회 모두 막혀
// "질문을 만들지 못했어요" 로 끝났다. 원인은 (a) 의도 반복 검사를 이전 질문 '전체'와 하고
// (b) 후속 질문 경로와 달리 마지막 시도 완화도, 구제도 없었던 것이다.
// 이제: 의도 비교는 최근 INTENT_HISTORY 개까지만, 마지막 시도는 완화, 그래도 없으면
// '안전·근거 검사는 모두 통과했고 의도만 겹친' 질문을 구제한다. 하드코딩 질문은 쓰지 않는다.
// 2026-09-17 실AI 실측: STEP 1·2 는 한 번에 질문 1개만 받아 실패하면 통째로 다시 불렀다.
// 그 결과 (a) 막다른 길이 잦고 (b) 실패할 때마다 LLM 시간이 통째로 더 붙었다.
// 이제 한 번 호출로 서로 다른 질문 3개를 받아 서버가 고른다. LLM 은 후보만, 결정은 서버라는 원칙 그대로다.
export const CANDIDATE_LINE = /^\s*(?:[1-3][.)]|[-•])\s*/;
export function splitQuestionCandidates(raw: string): string[] {
  const lines = String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(CANDIDATE_LINE, "").trim())
    .filter((line) => line.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = normalizeKey(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 3) break;
  }
  return out.length ? out : (String(raw ?? "").trim() ? [String(raw).trim()] : []);
}

// 2026-09-17 실AI 로그: STEP 2 질문이 STEP 1 과 '같은 질문'으로 차단됐다.
// 원인은 뜻이 아니라 앞에 붙는 공감 문장이 겹친 것이었다(reason=REPEAT_OR_SAME_INTENT 다수).
// 반복 비교는 실제로 '묻는 문장'끼리만 한다. 공감 문장은 비교 대상이 아니다.
export function questionSentence(text: string): string {
  const parts = String(text ?? "").split(/(?<=[.?!…])\s+/).map((part) => part.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) if (/\?\s*$/.test(parts[i])) return parts[i];
  return String(text ?? "").trim();
}

export async function genSingleQuestion(ai: Ai, instruction: string, userContent: string, ctx?: Context): Promise<string> {
  const feedback = ctx ? feedbackText(ctx) : "";
  const askedFull = ctx ? ctx.messages.filter((message) => message.role === "ai" && /\?\s*$/.test(message.content)).map((message) => message.content) : [];
  const asked = askedFull.map(questionSentence);
  const startedAt = Date.now();
  let salvage = "";
  let rejected: string[] = [];
  let attempts = 0;
  let lastReason = "";
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - startedAt;
    if (attempt > 0 && elapsed + OPENAI_TIMEOUT_MS > LIMITS.DEADLINE_MS) {
      console.error(`[gsq] single_deadline elapsed_ms=${elapsed} attempts=${attempts}`);
      break;
    }
    attempts = attempt + 1;
    const relaxed = attempt > 0;
    const prompt = `[사용자 근거]\n${userContent}${feedback ? `\n\n[질문 피드백 — 사실 근거로 사용하지 말 것]\n${feedback}` : ""}${asked.length ? `\n\n[이미 물은 질문 — 같은 뜻 반복 금지]\n${asked.join("\n")}` : ""}${rejected.length ? `\n\n[방금 서버에서 막힌 질문 — 다른 뜻으로 다시 써라]\n${rejected.join("\n")}` : ""}`;
    const system = `${PERSONA} ${instruction}${priorNote(ctx)} 친구처럼 편안하되 반드시 해요체 존댓말로, 아직 답하지 않은 새로운 정보를 부탁하는 열린 질문을 만들어라. 사용자의 말을 거의 그대로 옮기고 물음표만 붙이는 되묻기와 예/아니오 확인 질문은 금지한다. 질문 피드백이 있으면 잘못을 짧게 인정하고 더 쉽고 다른 방향으로 묻되 그 피드백을 사용자 마음의 근거로 해석하지 마라. 사용자가 말하지 않은 사람·관계·미래 장면·감정·원인·회피·상처를 만들지 마라.\n서로 뜻이 다른 질문 3개를 만들어 아래 형식으로만 출력해라. 설명·머리말·꼬리말을 붙이지 마라.\n1. (질문)\n2. (질문)\n3. (질문)\n각 줄은 한 문장이고 물음표는 그 줄에 하나만 있어야 한다. 사용자가 쓴 표현을 최소 하나는 그대로 물고 가라.`;
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: prompt }], false);
    const candidates = splitQuestionCandidates(raw);
    for (const candidate of candidates) {
      const v = validateSingleQuestion(candidate, LIMITS.QUESTION_MAX, true, userContent, relaxed);
      if (!v.ok) { lastReason = v.error; continue; }
      const asking = questionSentence(v.text);
      if (asked.some((question) => looksSame(asking, question, LIMITS.REPEAT_SIM, LIMITS.REPEAT_OVERLAP))) { lastReason = "REPEAT_TEXT"; continue; }
      // 의도 반복은 '다양성' 규칙이다. 최근 질문과만 비교하고, 재시도에서는 풀어준다.
      if (relaxed || !repeatsQuestionIntent(asking, asked.slice(-INTENT_HISTORY))) {
        console.error(`[gsq] single_ready attempts=${attempts} parsed=${candidates.length} relaxed=${relaxed} ai_ms=${Date.now() - startedAt}`);
        return v.text;
      }
      // 안전·근거 검사는 모두 통과했다. 다른 후보가 없으면 이 질문을 쓴다.
      if (!salvage) salvage = v.text;
      lastReason = "SAME_INTENT";
      rejected = rejected.concat(v.text).slice(-3);
    }
    // 진단 로그: 후보 수·마지막 실패 사유·길이만. 원문 없음.
    console.error(`[gsq] validate_fail reason=${lastReason || "EMPTY"} parsed=${candidates.length} len=${raw.length} ${questionShape(raw)} attempt=${attempts} relaxed=${relaxed}`);
  }
  if (salvage) {
    console.error(`[gsq] single_salvage attempts=${attempts} ai_ms=${Date.now() - startedAt}`);
    return salvage;
  }
  console.error(`[gsq] no_candidate mode=single attempts=${attempts} ai_ms=${Date.now() - startedAt}`);
  throw new Error("NO_CANDIDATE");
}

export const genStep1Question = (ai: Ai, mindText: string, ctx?: Context) =>
  genSingleQuestion(ai, "사용자가 쓴 마음의 기록을 읽고, 그 마음을 공감하며 짚어주는 짧은 한국어 질문을 하나만 만들어라. 질문은 그 마음을 더 알아가기 위한 것이어야 한다.", mindText, ctx);

export const genStep2Question = (ai: Ai, ctx: Context) =>
  genSingleQuestion(ai, "[사용자 근거]만 읽고, 방금 사용자가 직접 쓴 표현 하나의 뜻이나 맥락을 더 알아가는 짧은 한국어 질문을 하나만 만들어라. 이전 ECHO 문장은 사실 근거가 아니다.", historyText(ctx), ctx);

export async function genUnderstanding(ai: Ai, ctx: Context): Promise<string> {
  const latest = latestUserFreeText(ctx);
  const askedNote = isUserQuestion(latest) && !isLowInformationReply(latest)
    ? ` 사용자가 방금 ECHO에게 물었다("${latest}"). 그 물음을 사용자 마음의 사실로 요약하지 말고, 먼저 친구처럼 편안한 해요체로 1문장 솔직하게 답한 뒤(정답을 대신 정하지 않고, 의료·법률·재무 조언 없이, 물음표 없이) 요약을 이어라.`
    : "";
  const system =
    `${PERSONA} 사용자의 마음 기록과 대화를 바탕으로, 사용자가 지금 어떤 마음인지 한두 문장으로 공감하며 요약해라. 확실하지 않은 부분은 '~인 것 같아요'처럼 후보로만 말한다.${askedNote}${priorNote(ctx)}${priorityNote(ctx)}\n요약 텍스트만 출력해라.`;
  const block = buildBlockContext(ctx);
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: historyText(ctx) }], false);
    const v = validateSingleQuestion(raw, LIMITS.UNDERSTANDING_MAX, false);
    // ④ 거절한 해석은 요약에서도 같은 뜻으로 되살아나면 안 된다.
    if (v.ok && !replyRevivesRejected(v.text, block)) return v.text;
    console.error(`[gsq] understanding_reject reason=${v.ok ? "rejected_meaning" : v.error} attempt=${attempt + 1}`);
  }
  throw new Error("NO_CANDIDATE");
}

// 거절한 해석의 "핵심 의미"를 구조화(키 목록)한다. 저장 열이 아직 없으므로 요청 시 계산한다.
// (PENDING SQL의 understanding_results.rejected_meaning 적용 후 저장으로 전환)
//
// 2026-09-18 P0-06(사용자 원문 과차단): 거절한 요약은 규칙상 사용자 말에 근거해야 한다.
// 그래서 문장을 통째로 쪼개 금지어로 만들면 사용자가 직접 쓴 표현("걱정","일이","상황")까지 금지된다.
// 다음 질문은 사용자 표현을 붙잡아야 하므로(anchor 규칙) 붙잡는 순간 막혀 대화가 끊겼다.
// 버릴 것은 'AI 가 덧붙인 의미'이지 '사용자가 한 말'이 아니다. 사용자 근거에 있는 낱말은 제외한다.
// 표현만 바꾼 거절 해석의 재등장은 rejectedTexts(문장 유사도)가 계속 막는다.
export function extractRejectedKeys(rejectedInterpretation: string, evidenceParts: string[] = []): string[] {
  const userWords = evidenceParts.map(normalizeKey);
  const fromUser = (key: string) => userWords.some((word) => word.includes(key));
  return [...new Set(rejectedInterpretation.split(/[\s,./!?"'“”‘’()[\]{}]+/).map(normalizeKey).filter((part) => part.length >= 2))]
    .filter((key) => !fromUser(key))
    .slice(0, LIMITS.KEYS_MAX);
}

export function buildBlockContext(ctx: Context): BlockContext {
  const evidenceParts = userEvidenceParts(ctx);
  const askedTexts = ctx.messages.filter((m) => m.role === "ai" && /\?\s*$/.test(m.content)).map((m) => m.content);
  const rejectedTexts: string[] = [];
  const rejectedKeys: string[] = [];
  for (const u of ctx.understandings) {
    if (u.choice !== "no" || !u.rejected_interpretation) continue;
    rejectedTexts.push(u.rejected_interpretation);
    const keys = extractRejectedKeys(u.rejected_interpretation, evidenceParts);
    for (const k of keys) if (!rejectedKeys.includes(k)) rejectedKeys.push(k);
  }
  return { askedTexts, rejectedKeys, rejectedTexts, evidenceTexts: evidenceParts };
}

// 후속 질문: LLM은 후보만, 차단·선택은 서버. 모두 차단되면 재요청, 한도 초과 시 NO_CANDIDATE.
export type FollowupMode = "normal" | "asked" | "feedback";
// 우선순위: 사용자가 방금 물었으면 asked(먼저 답한다) → 질문 피드백이 있으면 feedback → normal
export function followupMode(ctx: Context): FollowupMode {
  const latest = latestUserFreeText(ctx);
  if (isUserQuestion(latest) && !isLowInformationReply(latest)) return "asked";
  return feedbackText(ctx) ? "feedback" : "normal";
}
// 서버가 최종 문장을 조립한다: asked → 검증된 답(+필요할 때만 질문) / feedback → 고정 인정 문장 + 질문 / normal → 공감(되받아치기면 제거) + 질문
// 2026-09-17: 고정 회피 문장을 답변으로 쓰지 않는다. asked 모드는 검증을 통과한 reply 가 있을 때만 만들어진다.
export function renderFollowup(candidate: Candidate, mode: FollowupMode, latestUser: string, withQuestion = true): string {
  return politeOrSame(renderFollowupRaw(candidate, mode, latestUser, withQuestion));
}
export function renderFollowupRaw(candidate: Candidate, mode: FollowupMode, latestUser: string, withQuestion = true): string {
  if (mode === "asked") {
    const reply = (candidate.reply ?? "").trim();
    // 2026-09-17 스트레스 검사: 답 후보가 3번 다 품질 검사에 걸리면 화면이 오류로 끝났다.
    // 고정 회피 문장을 지어내지 않고, 검사를 통과한 질문으로 대화를 잇는다.
    if (!reply) return candidate.question ?? "";
    return withQuestion && candidate.question ? `${reply}\n\n${candidate.question}` : reply;
  }
  if (mode === "feedback") return `맞아요. 같은 내용을 되묻지 않고 질문을 바꿔볼게요.\n\n${candidate.question}`;
  const acknowledgement = (candidate.acknowledgement ?? "").replace(/\?+/g, "").trim();
  if (!acknowledgement || isParrot(acknowledgement, latestUser)) return candidate.question;
  return `${acknowledgement}\n\n${candidate.question}`;
}

export async function genFollowupQuestion(ai: Ai, ctx: Context): Promise<Candidate> {
  const block = buildBlockContext(ctx);
  const mode = followupMode(ctx);
  const latest = latestUserFreeText(ctx);
  const pending = isUnansweredComplaint(latest) ? pendingUserQuestion(ctx, latest) : "";
  const questionToAnswer = pending || latest;
  const withQuestion = !(mode === "asked" && isSelfDirectedQuestion(latest) && !pending);
  const userQuestionNote = mode === "asked"
    ? `\n\n[사용자가 ECHO에게 물었다 — 먼저 답할 것]\n"${questionToAnswer}"${pending ? `\n(사용자가 "${latest}" 라고 지적했다. 앞의 물음에 답하지 못한 것을 먼저 인정하고 그 물음에 답한다.)` : ""}\n각 후보에 "reply" 필드를 넣어라: 이 물음에 1~2문장(${LIMITS.REPLY_MAX}자 이내)으로 끝까지 완성된 문장으로 답한다. 물음 속 표현을 실제로 다루고, 모르면 무엇을 모르는지 밝힌 뒤 필요한 정보를 말한다. "대신 정답을 정해 줄 수 없다" 같은 회피 문장만 쓰면 실패로 처리된다. 정답을 대신 정하지 않고, 의료·법률·재무 조언을 하지 않으며, 물음표를 쓰지 않는다. 사용자가 ECHO 자체(오타·답을 못 함 등)를 물었으면 사실대로 인정한다.${withQuestion ? " 그 다음 question 으로 사용자 이야기를 이어간다." : " 이번에는 답만 화면에 나가므로 question 은 참고용이다."}`
    : "";
  const system =
    `${PERSONA} 아래 [사용자 근거]만 사실로 사용해서 아직 더 알아가야 할 부분을 묻는 후보 3개를 만들어라. 각 후보는 {"acknowledgement":"anchor를 글자 그대로 포함해 바로 앞 사용자 말을 짧게 받아주는 1문장","question":"새로운 정보를 부탁하는 열린 질문 1개","anchor":"사용자 근거에서 글자 그대로 가져온 2~12자 핵심 표현(문장 전체 복사 금지)","assumptions":[],"meaning":"이전 질문과 다른 새 질문 의도","keys":["핵심 의미 명사구 2~5개"],"reply":"사용자가 질문했을 때만 1~2문장 답, 아니면 빈 문자열"} 형태이고, 전체를 {"candidates":[...]} JSON 객체로만 출력한다. 반드시 지켜라: 1) acknowledgement에는 anchor를 그대로 넣되 사용자 문장을 통째로 베끼지 말고, question에는 그대로 복사하지 않아도 된다. 2) 사용자의 말을 거의 그대로 옮기고 물음표만 붙이는 되묻기, 예/아니오 확인 질문, 이미 답한 내용을 다시 묻는 질문은 금지한다. 3) 사용자가 말하지 않은 사람·관계·미래 장면·감정·원인·회피·상처·행동을 만들지 않는다. 4) 사용자가 거절한 해석과 같은 뜻은 표현을 바꿔도 만들지 않는다. 5) 사용자가 직접 설명·정정한 내용을 가장 먼저 반영한다. 6) 한 번에 한 가지만 묻는다. 7) acknowledgement·question·reply 는 모두 해요체 존댓말로 끝낸다(반말 금지).${userQuestionNote}${priorNote(ctx)}${priorityNote(ctx)}`;
  const feedback = mode === "feedback" ? feedbackText(ctx) : "";
  const user = `[사용자 근거]\n${historyText(ctx)}${feedback ? `\n\n[질문 피드백 — 사실 근거로 사용하지 말 것]\n${feedback}` : ""}`;

  let blockedAll: string[] = [];
  let replyOnly: Candidate | null = null;
  const startedAt = Date.now();
  const maxTokens = mode === "asked" ? ASKED_MAX_TOKENS : CONVERSATION_MAX_TOKENS;
  let attempts = 0;
  for (let attempt = 0; attempt < LIMITS.GENERATION_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - startedAt;
    if (attempt > 0 && elapsed + OPENAI_TIMEOUT_MS > LIMITS.DEADLINE_MS) {
      console.error(`[gsq] attempts_deadline mode=${mode} elapsed_ms=${elapsed} attempts=${attempts}`);
      break;
    }
    const relaxed = attempt === LIMITS.GENERATION_ATTEMPTS - 1;
    const extra = blockedAll.length ? `\n\n다음 후보는 서버에서 차단되었다. 다른 뜻의 질문을 만들어라:\n${blockedAll.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : "";
    attempts = attempt + 1;
    const raw = await callOpenAI(ai, [{ role: "system", content: system }, { role: "user", content: user + extra }], true, maxTokens);
    const parsed = parseCandidates(raw);
    if (!parsed.ok) {
      console.error(`[gsq] candidates_schema_fail mode=${mode} attempt=${attempts}`);
      continue;
    }
    // normal 외 모드(asked·feedback)는 화면에 공감 문장을 쓰지 않으므로 비워서 검사한다.
    const candidates = mode !== "normal" ? parsed.candidates.map((candidate) => ({ ...candidate, acknowledgement: "" })) : parsed.candidates;
    const result = filterCandidates(candidates, block, { relaxed, userQuestion: mode === "asked" ? questionToAnswer : "", requireQuestion: withQuestion });
    const chosen = pickCandidate(result);
    if (chosen) {
      console.error(`[gsq] question_ready mode=${mode} attempts=${attempts} ai_ms=${Date.now() - startedAt} with_question=${withQuestion}`);
      return chosen;
    }
    // 답만 실패한 경우를 따로 모은다. 질문 자체가 모든 검사를 통과한 후보만 받는다.
    if (mode === "asked" && !replyOnly) {
      for (const b of result.blocked) {
        // gsq 는 거절 재등장을 rejected_text 로 부른다(echo-journey 의 reply_rejected 와 같은 뜻).
        if (b.reason !== "reply_quality" && b.reason !== "rejected_text") continue;
        if (blockReasonFor(b.candidate, block, { relaxed, userQuestion: "", requireQuestion: true })) continue;
        replyOnly = { ...b.candidate, reply: "" };
        break;
      }
    }
    blockedAll = blockedAll.concat(result.blocked.map((b) => b.candidate.question));
    // 진단 로그: 모드·후보 수·차단 사유 수만. 원문 없음.
    const reasons: Record<string, number> = {};
    for (const b of result.blocked) reasons[b.reason] = (reasons[b.reason] ?? 0) + 1;
    console.error(`[gsq] candidates_blocked mode=${mode} parsed=${candidates.length} attempt=${attempts} relaxed=${relaxed} reasons=${Object.entries(reasons).map(([k, v]) => `${k}:${v}`).join(",")}`);
  }
  if (replyOnly) {
    // 답은 못 만들었지만 질문은 만들었다. 대화를 끊는 것보다 낫다. 실패 사실은 로그로 남긴다.
    console.error(`[gsq] asked_reply_failed mode=${mode} attempts=${attempts} ai_ms=${Date.now() - startedAt}`);
    return replyOnly;
  }
  console.error(`[gsq] no_candidate mode=${mode} blocked_total=${blockedAll.length} attempts=${attempts} ai_ms=${Date.now() - startedAt}`);
  throw new Error("NO_CANDIDATE");
}

// 화면에 낼 문장으로 조립한다(서버가 최종 결정). 답만 하는 턴이면 질문을 붙이지 않는다.
export function renderFollowupTurn(candidate: Candidate, ctx: Context): string {
  const mode = followupMode(ctx);
  const latest = latestUserFreeText(ctx);
  const pending = isUnansweredComplaint(latest) ? pendingUserQuestion(ctx, latest) : "";
  return renderFollowup(candidate, mode, latest, !(mode === "asked" && isSelfDirectedQuestion(latest) && !pending));
}

