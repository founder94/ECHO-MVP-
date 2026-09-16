// Pure question-quality rules for echo-journey.
// The model proposes candidates; this module decides whether a candidate is safe to show.

export type JourneyMessageKind =
  | "step_question"
  | "step_answer"
  | "understanding_summary"
  | "understanding_choice"
  | "followup_question"
  | "followup_answer"
  | "journey_question"
  | "journey_answer";

export interface EvidenceMessage {
  role: string;
  step: number | null;
  content: string;
  message_kind: string | null;
}

export interface EvidenceUnderstanding {
  choice: string;
  rejected_interpretation: string | null;
  correction_text: string | null;
  self_explanation: string | null;
}

export interface GroundedCandidate {
  acknowledgement?: string;
  question: string;
  meaning: string;
  keys: string[];
  anchor: string;
  assumptions: string[];
}

export interface EvidenceContext {
  mindText: string;
  messages: EvidenceMessage[];
  understandings: EvidenceUnderstanding[];
}

export const normalizeEvidence = (value: string): string =>
  value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

const CONTROL_REPLIES = new Set(["맞아요", "조금 달라요", "그게 아니에요", "직접 설명할게요"]);
// 짧은 동의나 "모르겠다" 계열 답변은 사용자의 마음에 대한 새 사실로 쓰지 않는다.
// 실사용자는 문어체·반말·존댓말을 섞어 쓰므로 어미가 달라도 같은 답변 상태로 본다.
const LOW_INFORMATION_REPLIES = /^(?:응|어|네|예|그래|맞아|맞아요|그렇지|그렇죠|글쎄|음|(?:잘\s*)?모르겠(?:다|어|어요|습니다|는데|네|음)?|생각(?:이)?\s*안\s*나(?:요)?|떠오르지\s*않(?:아|아요|습니다)|생각해\s*본\s*적\s*없(?:어|어요|습니다)|(?:딱히\s*)?없(?:어|어요|습니다)|패스|(?:이번\s*질문(?:은|을)?\s*)?(?:넘어갈|건너뛸)(?:게|게요|래|래요))[.!?\s~]*$/;
const META_FEEDBACK = [
  /질문.{0,18}(없|이상|어렵|안\s*맞|뜬금|똑같|같|반복|또)/,
  /(같|똑같)은?\s*질문|질문을?\s*(또|반복)/,
  /(어떻게|뭘|무엇을)\s*(말|이야기|대답|답)하/,
  /이게\s*(질문|무슨|뭔)/,
  /맥락.{0,8}(안\s*맞|이상|없)/,
  /내가.{0,8}어떻게\s*알/,
  /무슨\s*말|뭔\s*말|말이\s*안\s*되/,
  /(이해|납득).{0,8}(안|못)/,
  /왜.{0,8}(묻|물어|질문|되묻)/,
  /너가.{0,12}(말|질문)/,
  /에코.{0,12}(말|질문)/i,
  /(?:이야기|말)(?:했|해\s*줬|했었).{0,8}잖/,
  /(?:이미|아까|방금).{0,12}(?:이야기|말)(?:했|해\s*줬|했었)/,
] as const;

const REPEAT_FEEDBACK = [
  /(?:같은?|똑같은?|비슷한?)\s*질문/,
  /질문을?\s*(또|반복)/,
  /(아까|방금|계속).{0,12}(물었|묻|질문)/,
  /(?:이야기|말)(?:했|해\s*줬|했었).{0,8}잖/,
  /(?:이미|아까|방금).{0,12}(?:이야기|말)(?:했|해\s*줬|했었)/,
] as const;
const BURDEN_FEEDBACK = [
  /(질문|대화).{0,12}(어렵|길|지루|루즈|피곤|부담)/,
  /(답|대답|말).{0,10}(못|어렵|힘들)/,
  /(그만|건너뛰|넘어가고|짧게\s*해)/,
] as const;
const CORRECTION_FEEDBACK = [
  /^(?:아니(?:야|에요|예요|고|라니까)?|그게\s*아니(?:야|에요|예요|고|라니까)?|그건\s*아니(?:야|에요|예요|고|라니까)?|이건\s*아니(?:야|에요|예요|고|라니까)?)[,.:\s]+\S/,
  /^(?:내\s*말은|내가\s*말한\s*(?:건|것은)|정확히는|사실은)[,.:\s]*\S/,
  /(?:라는|란)\s*(?:뜻|말)(?:이야|이에요|예요)/,
] as const;

export type JourneyFeedbackKind = "repeat" | "burden" | "correction" | "confusion" | null;

export function journeyFeedbackKind(text: string): JourneyFeedbackKind {
  const value = text.trim();
  if (!value || value === "맞아요") return null;
  if (REPEAT_FEEDBACK.some((pattern) => pattern.test(value))) return "repeat";
  if (BURDEN_FEEDBACK.some((pattern) => pattern.test(value))) return "burden";
  if (CORRECTION_FEEDBACK.some((pattern) => pattern.test(value))) return "correction";
  if ((CONTROL_REPLIES.has(value) && value !== "맞아요") || META_FEEDBACK.some((pattern) => pattern.test(value))) return "confusion";
  return null;
}

// AI를 바로잡는 문장 안에도 사용자가 새로 알려준 사실이 있을 수 있다.
// 불평 문장은 제외하고, 명시적인 정정 뒤의 사용자 표현만 다음 질문 근거로 보존한다.
export function correctionEvidence(text: string): string {
  if (journeyFeedbackKind(text) !== "correction") return "";
  const value = text.trim()
    .replace(/^(?:아니(?:야|에요|예요|고|라니까)?|그게\s*아니(?:야|에요|예요|고)?|그건\s*아니(?:야|에요|예요|고)?|이건\s*아니(?:야|에요|예요|고)?)[,.:\s]*/u, "")
    .replace(/^(?:내\s*말은|내가\s*말한\s*(?:건|것은)|정확히는|사실은)[,.:\s]*/u, "")
    .trim();
  return normalizeEvidence(value).length >= 2 ? value : "";
}

export function isMetaFeedback(text: string): boolean {
  return journeyFeedbackKind(text) !== null;
}

export function isLowInformationReply(text: string): boolean {
  return LOW_INFORMATION_REPLIES.test(text.trim());
}

// 짧지만 의미는 있는 답은 사실 근거로 보존하되, 다음 질문의 부담만 낮춘다.
export function isBriefReply(text: string): boolean {
  const value = text.trim();
  if (!value || isLowInformationReply(value) || isMetaFeedback(value)) return false;
  return normalizeEvidence(value).length <= 8;
}

export function displayedQuestionText(content: string): string {
  const paragraphs = content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return [...paragraphs].reverse().find((part) => /\?\s*$/.test(part)) ?? content.trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

// Only the user's own words and explicit corrections are evidence.
// Previous AI messages are deliberately excluded so an AI guess cannot become a later "fact".
export function userEvidenceParts(ctx: EvidenceContext): string[] {
  const parts: string[] = [];
  if (ctx.mindText.trim()) parts.push(ctx.mindText.trim());
  for (const message of ctx.messages) {
    if (message.role !== "user" || isLowInformationReply(message.content)) continue;
    if (isMetaFeedback(message.content)) {
      const corrected = correctionEvidence(message.content);
      if (corrected) parts.push(corrected);
      continue;
    }
    parts.push(message.content.trim());
  }
  for (const understanding of ctx.understandings) {
    if (understanding.self_explanation?.trim()) parts.push(understanding.self_explanation.trim());
    if (understanding.correction_text?.trim()) parts.push(understanding.correction_text.trim());
  }
  return unique(parts);
}

export function userEvidenceText(ctx: EvidenceContext): string {
  return userEvidenceParts(ctx).map((part, index) => `${index + 1}. ${part}`).join("\n");
}

export function metaFeedbackText(ctx: EvidenceContext): string {
  return unique(ctx.messages.filter((message) => message.role === "user" && isMetaFeedback(message.content)).map((message) => message.content))
    .map((part, index) => `${index + 1}. ${part}`)
    .join("\n");
}

export function isJourneyQuestion(message: EvidenceMessage, step: number): boolean {
  return message.role === "ai" && message.step === step && message.message_kind === "journey_question";
}

export function latestJourneyQuestion(ctx: EvidenceContext, step: number): string {
  let open = "";
  for (const message of ctx.messages) {
    if (isJourneyQuestion(message, step)) open = message.content;
    if (message.role === "user" && message.step === step && message.message_kind === "journey_answer") open = "";
  }
  if (!open) return "";
  const question = displayedQuestionText(open);
  if (!/(어떤|어떻게|무엇|뭐가|언제|어디|누구|왜|얼마나|어느|들려줄|말해줄|알려줄)/.test(question)) return "";
  const q = normalizeEvidence(question);
  const echoed = userEvidenceParts(ctx).some((part) => {
    const e = normalizeEvidence(part);
    if (e.length < 5) return false;
    const shorter = Math.min(q.length, e.length);
    const longer = Math.max(q.length, e.length);
    return shorter / longer >= 0.72 && (q.includes(e) || e.includes(q));
  });
  return echoed ? "" : open;
}

export function latestUserAnswer(ctx: EvidenceContext): string {
  for (const message of [...ctx.messages].reverse()) {
    if (message.role !== "user" || message.message_kind === "understanding_choice" || isLowInformationReply(message.content)) continue;
    if (isMetaFeedback(message.content)) {
      const corrected = correctionEvidence(message.content);
      if (corrected) return corrected;
      continue;
    }
    return message.content;
  }
  return ctx.mindText.trim();
}

export function latestUserTurn(ctx: EvidenceContext): string {
  return [...ctx.messages].reverse().find((message) =>
    message.role === "user" && message.content.trim() !== "맞아요"
  )?.content ?? ctx.mindText.trim();
}

export function askedQuestionTexts(ctx: EvidenceContext): string[] {
  return ctx.messages
    .filter((message) => message.role === "ai" && /\?\s*$/.test(message.content.trim()))
    .map((message) => displayedQuestionText(message.content));
}

export function askedJourneyQuestionTexts(ctx: EvidenceContext): string[] {
  return ctx.messages
    .filter((message) => message.role === "ai" && message.message_kind === "journey_question" && /\?\s*$/.test(message.content.trim()))
    .map((message) => displayedQuestionText(message.content));
}

// 화면에 표시된 질문 전체(짧은 공감 문장 포함)를 보존한다.
// 사용자가 답하기 어려워했는데도 같은 중심 표현(anchor)만 붙잡는 것을 서버에서 막을 때 사용한다.
export function askedJourneyFullTexts(ctx: EvidenceContext): string[] {
  return ctx.messages
    .filter((message) => message.role === "ai" && /\?\s*$/.test(message.content.trim()))
    .map((message) => message.content.trim());
}

export function reusesJourneyAnchor(anchor: string, askedJourneyFull: string[]): boolean {
  const normalizedAnchor = normalizeEvidence(anchor);
  // '오늘'처럼 짧고 일반적인 연결어까지 차단하면 자연스러운 마무리 질문을 만들 수 없다.
  if (normalizedAnchor.length < 3) return false;
  return askedJourneyFull.some((asked) => normalizeEvidence(asked).includes(normalizedAnchor));
}

const QUESTION_INTENTS = [
  { tag: "problem", pattern: /(고민|문제|걱정|마음에\s*걸리|해결|막막|힘든|어려운\s*(?:점|부분|것)|부담)/ },
  { tag: "preserve", pattern: /(남기|기억|간직)/ },
  { tag: "action", pattern: /(해\s*볼|선택|바꾸|지키|이어가|시작|실천)/ },
  { tag: "preference", pattern: /(원하|바라|좋겠|편하|끌리|마음이\s*가(?:는|요|다|는\s*쪽)|고르|선호)/ },
  { tag: "pattern", pattern: /(처음|전에도|예전에도|자주|반복|비슷한\s*(?:때|순간|일)|또\s*그랬)/ },
  { tag: "contrast", pattern: /(다르|차이|반대|대신|둘\s*중|비교)/ },
  { tag: "reason", pattern: /(왜|이유|때문|계기)/ },
  { tag: "context", pattern: /(언제|어느\s*때|상황|장면|어디|무슨\s*일|어떤\s*때|생활에\s*어떻게|어떻게\s*나타)/ },
  { tag: "importance", pattern: /(중요|소중|우선)/ },
  { tag: "meaning", pattern: /(의미|뜻|한마디|다른\s*말|표현)/ },
  { tag: "emotion", pattern: /(감정|기분|느낌|마음은\s*어땠|몸에서\s*느껴)/ },
  { tag: "detail", pattern: /(더\s*들려|더\s*설명|구체|어떤\s*부분|무엇인지|떠오르는\s*(?:생각|말)|조금만\s*말)/ },
] as const;

export type QuestionIntent = (typeof QUESTION_INTENTS)[number]["tag"];

const STEP_FOCUS: Readonly<Record<number, readonly QuestionIntent[]>> = {
  3: ["detail", "context", "emotion"],
  4: ["context", "contrast", "preference"],
  5: ["emotion", "importance", "meaning"],
  6: ["preference", "pattern", "contrast"],
  7: ["preserve", "action", "preference"],
};

export function nextQuestionFocus(step: number, askedJourney: string[], lighten = false): QuestionIntent {
  const covered = new Set(askedJourney.flatMap(questionIntentTags));
  const preferred = lighten
    ? (["preference", "contrast", "preserve", "context"] as const)
    : (STEP_FOCUS[step] ?? STEP_FOCUS[7]);
  return preferred.find((focus) => !covered.has(focus))
    ?? (["context", "emotion", "meaning", "preference", "pattern", "contrast", "action", "preserve", "detail", "importance", "reason"] as const)
      .find((focus) => !covered.has(focus))
    ?? "detail";
}

export function questionIntentTags(question: string): string[] {
  return QUESTION_INTENTS.filter(({ pattern }) => pattern.test(question)).map(({ tag }) => tag);
}

export function questionIntentTag(question: string): string {
  return questionIntentTags(question)[0] ?? "";
}

export function repeatsQuestionIntent(question: string, askedJourney: string[]): boolean {
  const intents = new Set(questionIntentTags(question));
  return intents.size > 0 && askedJourney.some((asked) => questionIntentTags(asked).some((intent) => intents.has(intent)));
}

const DECLARATION_ENDINGS = /(것\s*같아요|보여요|느껴져요|의미해요|나타나요|거예요)[.!]?$/;
const IMPOSSIBLE_FUTURE_MEMORY = [
  /미래.{0,30}(기억에\s*남|기억나)/,
  /(앞으로|훗날|몇\s*년\s*뒤).{0,30}(기억에\s*남|기억나)/,
] as const;

const PREMISE_GROUPS = [
  { candidate: ["피하고", "회피", "참고 있는", "억누르고"], evidence: ["피하", "회피", "참", "억누르"] },
  { candidate: ["부정적인 사람", "나쁜 사람", "해로운 사람"], evidence: ["부정적인 사람", "나쁜 사람", "해로운 사람"] },
  { candidate: ["관계에서", "그 사람", "상대방"], evidence: ["관계", "사람", "상대", "친구", "가족", "동료", "연인"] },
  { candidate: ["상처", "트라우마"], evidence: ["상처", "트라우마"] },
] as const;

function premiseWithoutEvidence(question: string, evidence: string): boolean {
  const q = normalizeEvidence(question);
  const e = normalizeEvidence(evidence);
  return PREMISE_GROUPS.some((group) =>
    group.candidate.some((word) => q.includes(normalizeEvidence(word))) &&
    !group.evidence.some((word) => e.includes(normalizeEvidence(word)))
  );
}

export type QuestionBlockReason =
  | "not_question"
  | "multiple_questions"
  | "declarative_summary"
  | "missing_anchor"
  | "unsupported_anchor"
  | "echoed_user_statement"
  | "closed_question"
  | "declared_assumption"
  | "impossible_future_memory"
  | "unsupported_premise";

export function questionQualityReason(candidate: GroundedCandidate, evidenceParts: string[]): QuestionBlockReason | null {
  const question = candidate.question.trim();
  const questionMarks = question.match(/\?/g)?.length ?? 0;
  if (!question.endsWith("?") || questionMarks === 0) return "not_question";
  if (questionMarks !== 1) return "multiple_questions";
  if (DECLARATION_ENDINGS.test(question)) return "declarative_summary";
  if (candidate.assumptions.length > 0) return "declared_assumption";
  if (IMPOSSIBLE_FUTURE_MEMORY.some((pattern) => pattern.test(question))) return "impossible_future_memory";

  const anchor = normalizeEvidence(candidate.anchor);
  if (anchor.length < 2) return "missing_anchor";
  const normalizedParts = evidenceParts.map(normalizeEvidence);
  if (!normalizedParts.some((part) => part.includes(anchor))) return "unsupported_anchor";
  const normalizedQuestion = normalizeEvidence(question);
  if (normalizedParts.some((part) => {
    if (part.length < 5) return false;
    const shorter = Math.min(part.length, normalizedQuestion.length);
    const longer = Math.max(part.length, normalizedQuestion.length);
    return shorter / longer >= 0.72 && (part.includes(normalizedQuestion) || normalizedQuestion.includes(part));
  })) return "echoed_user_statement";
  if (!/(어떤|어떻게|무엇|뭐가|언제|어디|누구|왜|얼마나|어느|들려줄|말해줄|알려줄)/.test(question)) return "closed_question";
  if (premiseWithoutEvidence(question, evidenceParts.join("\n"))) return "unsupported_premise";
  return null;
}
