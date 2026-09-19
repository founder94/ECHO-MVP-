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

// ── 정정 우선(Correction Engine) 판정 — get-step-question/rules.ts 와 같은 규칙 ──
// 2026-09-18 운영 캐너리 근거: 서로 다른 정정 2건에 서버가 똑같이 정정 이전 주제를 물었다.
// 정정 우선이 프롬프트 문장으로만 지시되어 있었기 때문이다. 판정은 서버가 한다.
const CORRECTION_LEAD = /(?:제가\s*직접\s*설명할게요|직접\s*설명할게요|반은\s*맞고\s*반은\s*아닌\s*것\s*같아요|조금\s*달라요|그게\s*아니에요|아니에요|아니요|사실은)/gu;
const CORRECTION_PARTICLE_TAIL = /(?:이|가|은|는|을|를|에|의|도|보다|부터|까지|으로|로|와|과)$/u;
export function correctionContentWords(correction: string): string[] {
  return [...new Set((correction.replace(CORRECTION_LEAD, " ").match(/[가-힣]{2,}/gu) ?? [])
    .map((word) => word.replace(CORRECTION_PARTICLE_TAIL, ""))
    .filter((word) => word.length >= 2))];
}
// 비교할 내용어가 아예 없으면 막지 않는다(빠져나갈 문 없는 차단 규칙은 두지 않는다).
export function reflectsCorrection(text: string, correction: string): boolean {
  const words = correctionContentWords(correction);
  if (!words.length) return true;
  const target = normalizeEvidence(text);
  return words.some((word) => target.includes(normalizeEvidence(word)));
}

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

// ── 2026-09-17 행동 분기: 사용자가 ECHO 에게 "물은 말"인지 판정한다(단계 진행 금지 · 먼저 답하기의 근거) ──
// "아까 내 질문에는 답하지 않았어" 처럼 앞 물음에 답하지 않았다는 지적도 '답해야 할 말'로 본다.
const UNANSWERED_COMPLAINT =
  /(?:질문|물어봤|물었)\S{0,10}\s*(?:답|대답)\S{0,4}\s*(?:않|안|못)|(?:답|대답)\S{0,4}\s*(?:않았|않아|않네|않고|안\s*했|못\s*했)/u;
const USER_QUESTION =
  /\?\s*$|(?:어떻게|어떡|뭘|무엇을|어느|왜|언제).{0,16}(?:좋을까|할까|하지|해야|일까|되나|될까|돼)|(?:답|대답)(?:을|은)?\s*(?:못|안)\s*(?:해|햐|하)|(?:답|대답)(?:을|은)?\s*(?:안|못)\s*했/u;
export function isUnansweredComplaint(text: string): boolean {
  return UNANSWERED_COMPLAINT.test(text.trim());
}
export function isUserQuestion(text: string): boolean {
  const value = text.trim();
  return !!value && (USER_QUESTION.test(value) || UNANSWERED_COMPLAINT.test(value));
}

// 사용자가 "앞 질문에 답하지 않았다"고 지적하면, 그 앞의 물음을 찾아 그것에 답한다(마지막 지적 문장 자체는 제외).
export function pendingUserQuestion(ctx: EvidenceContext, exclude: string): string {
  const skipped = exclude.trim();
  for (const message of [...ctx.messages].reverse()) {
    if (message.role !== "user") continue;
    const value = message.content.trim();
    if (!value || value === skipped || isUnansweredComplaint(value)) continue;
    if (isUserQuestion(value)) return value;
  }
  return "";
}

// ECHO(제품·AI) 자체에 대한 물음인지. 이 경우 답만 하고 새 질문을 강제로 붙이지 않는다.
const SELF_DIRECTED = [
  /\bai\b|에이아이|인공지능|에코|echo/i,
  UNANSWERED_COMPLAINT,
  /(너|당신|넌|니가|네가)\s*(는|가|도)?\s*(왜|뭐|무슨|어떻게|답|기억|오타|말)/,
  /오타|오류|버그|고장|틀리|잘못\s*(말|답|이해)/,
  /(답|대답)(을|은)?\s*(못|안)\s*(해|햐|하|했)/,
  /기억(해|하니|하나|나니|나|못)/,
] as const;
export function isSelfDirectedQuestion(text: string): boolean {
  const value = text.trim();
  return isUserQuestion(value) && SELF_DIRECTED.some((pattern) => pattern.test(value));
}

// 따옴표 안의 말이나 '~라고 했다'는 다른 사람의 말일 수 있다. 사용자 확정 사실로 저장하지 않는다.
const REPORTED_SPEECH = [
  /["“'][^"”']{2,}["”']\s*(?:라고|이라고|라며|하고)?\s*(?:했|말했|그랬|하더)/,
  /(?:라고|이라고)\s*(?:했|말했|그랬|하더|들었)/,
  /(?:엄마|아빠|친구|동료|팀장|상사|선생님|그\s*사람|남편|아내|형|누나|언니|오빠|동생)(?:이|가|는|도)\s*[^.!?]{0,30}(?:했|말했|그랬|하더)/,
] as const;
export function isReportedSpeech(text: string): boolean {
  return REPORTED_SPEECH.some((pattern) => pattern.test(text.trim()));
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

// 리포트의 '확정(confirmed)' 판정에만 쓰는 근거: 사용자가 스스로 밝힌 사실만 남긴다.
// 사용자가 던진 질문(전제)과 다른 사람의 말은 확정 사실에서 제외한다(질문·앵커 용도로는 userEvidenceParts 를 계속 쓴다).
export function confirmedEvidenceParts(ctx: EvidenceContext): string[] {
  const parts: string[] = [];
  const keep = (value: string) => {
    const text = value.trim();
    if (!text || isUserQuestion(text) || isReportedSpeech(text)) return;
    parts.push(text);
  };
  if (ctx.mindText.trim()) keep(ctx.mindText);
  for (const message of ctx.messages) {
    if (message.role !== "user" || isLowInformationReply(message.content)) continue;
    if (isMetaFeedback(message.content)) {
      const corrected = correctionEvidence(message.content);
      if (corrected) keep(corrected);
      continue;
    }
    keep(message.content);
  }
  for (const understanding of ctx.understandings) {
    if (understanding.self_explanation) keep(understanding.self_explanation);
    if (understanding.correction_text) keep(understanding.correction_text);
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

// 2026-09-17: 이번 단계에서 사용자가 아직 답하지 않은 ECHO 의 턴.
// kind="question" 정상 질문 / kind="reply" 사용자의 물음에 답만 한 턴(질문 없음, 이어서 자유롭게 답할 수 있다) / "" 없음.
// reply 턴을 "질문 없음"으로 보면 같은 단계에서 질문을 무한 재생성하므로 서버가 구분한다.
export type OpenTurnKind = "question" | "reply" | "";
export function latestOpenJourneyTurn(ctx: EvidenceContext, step: number): { content: string; kind: OpenTurnKind } {
  let open = "";
  let askedBefore = "";
  let lastUser = "";
  for (const message of ctx.messages) {
    if (message.role === "user") {
      lastUser = message.content;
      if (message.step === step && message.message_kind === "journey_answer") open = "";
      continue;
    }
    if (isJourneyQuestion(message, step)) {
      open = message.content;
      askedBefore = lastUser;
    }
  }
  if (!open) return { content: "", kind: "" };
  if (!/\?/.test(open) && isUserQuestion(askedBefore)) return { content: open, kind: "reply" };
  const question = latestJourneyQuestion(ctx, step);
  return question ? { content: question, kind: "question" } : { content: "", kind: "" };
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

// ── 2026-09-17 답변(reply) 품질 판정 ──
// 고정 회피 문장을 답변 성공으로 처리하지 않는다. 잘려서 문장이 끊긴 답도 통과시키지 않는다.
export type ReplyBlockReason =
  | "reply_missing"
  | "reply_question_mark"
  | "reply_too_long"
  | "reply_incomplete"
  | "reply_evasive"
  | "reply_irrelevant";

const REPLY_COMPLETE = /(?:[.!…]|요|죠|다|네|까|군|데|어|아|지|음|함|예|오)\s*$/u;
const EVASIVE_REPLY = [
  /대신\s*정답을?\s*정해/,
  /^(?:같이|함께)\s*찾아(?:볼게요|봐요)[.!]?$/,
  /^(?:음|글쎄요?|잘\s*모르겠어요)[.!]?$/,
] as const;
// 불용 조각(조사·흔한 어미)은 관련성 판정에서 제외한다.
const RELEVANCE_STOP = /^(?:은|는|이|가|을|를|에|의|도|와|과|로|요|죠|다|네|까|어|해|하|것|수|저|제|내|나)$/;

function contentTokens(text: string): string[] {
  return normalizeEvidence(text)
    .split(/(?=[가-힣a-z0-9])/u)
    .join("")
    .match(/[가-힣]{2,}|[a-z0-9]{2,}/gu) ?? [];
}

// 답이 질문과 실제로 관련 있는지: 질문의 내용 글자와 2글자 이상 겹치는 부분이 있어야 한다.
function sharesContent(reply: string, question: string): boolean {
  const q = normalizeEvidence(question);
  const r = normalizeEvidence(reply);
  if (!q || !r) return false;
  for (let i = 0; i < q.length - 1; i++) {
    const pair = q.slice(i, i + 2);
    if (RELEVANCE_STOP.test(pair)) continue;
    if (r.includes(pair)) return true;
  }
  return contentTokens(question).some((token) => r.includes(token));
}

// 질문의 낱말을 그대로 쓰지 않아도, 무엇을 알고 모르는지 밝히는 답은 '응답한 것'으로 본다(대표 지시: 모르면 모른다고 밝힐 것).
const RESPONSIVE_REPLY = /(?:제가|저는|저도|제)\s*[^.!]{0,20}(?:답|정답|모르|알|말씀|물음|질문)/u;

// 2026-09-18 운영 진단(get-step-question 과 같은 원인): 되물음이 의문사·지시어만으로 되어 있으면
// 답이 겹칠 낱말 자체가 없어 어떤 답도 통과하지 못한다. 겹칠 것이 없으면 관련성을 묻지 않는다.
const QUESTION_FILLER = /^(?:어떻게|어떡해|어떤|어느|무슨|무엇|뭐야|뭔데|뭘|왜|언제|어디|누구|얼마나|그래서|그럼|그렇게|그거|그게|이게|저게|지금|내가|나는|저는|제가|해야|하면|할까|할지|좋을까|좋아|있는|있을까|건가|건데|거야|건지|인가|이야|말이야|뜻이야|생각해|생각했어|판단은|나온|했어|하는|하지)$/u;
export function questionHasContent(question: string): boolean {
  return question.split(/[\s,./!?"'“”‘’()\[\]{}]+/u)
    .map((word) => normalizeEvidence(word.trim()))
    .some((word) => word.length >= 2 && !QUESTION_FILLER.test(word));
}

// relaxedRelevance(2번째 시도부터): get-step-question 과 같은 규칙.
export function replyQualityReason(reply: string, userQuestion: string, maxLength: number, relaxedRelevance = false): ReplyBlockReason | null {
  const text = reply.trim();
  if (!text) return "reply_missing";
  if (text.includes("?")) return "reply_question_mark";
  // 길면 잘라서 통과시키지 않고 버린다(잘린 문장을 정상 답변으로 처리 금지).
  if (text.length > maxLength) return "reply_too_long";
  if (!REPLY_COMPLETE.test(text)) return "reply_incomplete";
  if (EVASIVE_REPLY.some((pattern) => pattern.test(text))) return "reply_evasive";
  if (!relaxedRelevance && userQuestion.trim() && questionHasContent(userQuestion) && !sharesContent(text, userQuestion) && !RESPONSIVE_REPLY.test(text)) return "reply_irrelevant";
  return null;
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

// ═══════════════ 말투: 해요체 강제 (2026-09-17 실기기 결함 #2) ═══════════════
// 운영에서 STEP 1 질문이 "…궁금해?" 라는 반말로 나갔다. 프롬프트에 존댓말 규칙이 없었고
// 서버에도 검사가 없었다. LLM 은 후보만 만들고 최종 문장은 서버가 정한다는 원칙대로,
// 여기서 (1) 반말인지 판정하고 (2) 뜻을 바꾸지 않는 어미 교체만으로 해요체로 바꾼다.
// 바꿀 수 없는 문장은 고치지 않고 차단한다(억지로 만들지 않는다).

const HANGUL = /[가-힣]/u;
const TRAILING_MARKS = /[\s"'”’」』)\]]*[.?!…]*[\s"'”’」』)\]]*$/u;
// 해요체·합쇼체 종결. 여기에 걸리면 이미 존댓말이다.
const POLITE_TAIL = /(요|죠|쇼|니다|니까)$/u;

// 반말 종결 → 해요체. 긴 어미부터 검사한다(짧은 규칙이 먼저 먹는 것을 막는다).
const POLITE_MAP: ReadonlyArray<readonly [string, string]> = [
  ["는구나", "는군요"],
  ["구나", "군요"],
  ["잖아", "잖아요"],
  ["거야", "거예요"],
  ["이야", "이에요"],
  ["어때", "어때요"],
  ["을래", "을래요"],
  ["ㄹ래", "ㄹ래요"],
  ["는데", "는데요"],
  ["일까", "일까요"],
  ["할까", "할까요"],
  ["았어", "았어요"],
  ["었어", "었어요"],
  ["겠어", "겠어요"],
  ["겠다", "겠어요"],
  ["았다", "았어요"],
  ["었다", "었어요"],
  ["야", "예요"],
  ["까", "까요"],
  ["래", "래요"],
  ["데", "데요"],
  ["니", "나요"],
  ["냐", "나요"],
  ["나", "나요"],
  ["지", "죠"],
  ["줘", "줘요"],
  ["네", "네요"],
  ["대", "대요"],
  ["해", "해요"],
  ["워", "워요"],
  ["봐", "봐요"],
  ["돼", "돼요"],
  ["와", "와요"],
  ["가", "가요"],
  ["어", "어요"],
  ["아", "아요"],
  ["여", "여요"],
];

interface SentencePiece {
  body: string; // 종결 부호를 뗀 본문
  tail: string; // 종결 부호와 따옴표
}

// 문장 부호를 살린 채로 문장 단위로 나눈다.
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buffer = "";
  for (const ch of text) {
    buffer += ch;
    if (ch === "." || ch === "?" || ch === "!" || ch === "…") {
      out.push(buffer);
      buffer = "";
    }
  }
  if (buffer.trim()) out.push(buffer);
  return out.filter((piece) => piece.trim().length > 0);
}

function cutTail(sentence: string): SentencePiece {
  const match = sentence.match(TRAILING_MARKS);
  const tail = match ? match[0] : "";
  return { body: tail ? sentence.slice(0, sentence.length - tail.length) : sentence, tail };
}

// 판정 대상 문장인지: 한글이 있고 너무 짧지 않은 문장만 본다.
function checkable(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length >= 3 && HANGUL.test(trimmed);
}

export function isPoliteSentence(sentence: string): boolean {
  const { body } = cutTail(sentence);
  const trimmed = body.trim();
  if (!checkable(trimmed)) return true;
  return POLITE_TAIL.test(trimmed);
}

/** 화면에 나갈 문장에 반말이 섞여 있는가. 한 문장이라도 반말이면 true. */
export function hasBanmal(text: string): boolean {
  return splitSentences(text).some((sentence) => !isPoliteSentence(sentence));
}

function politeBody(body: string): string | null {
  const trimmed = body.replace(/\s+$/u, "");
  if (!checkable(trimmed)) return trimmed;
  if (POLITE_TAIL.test(trimmed)) return trimmed;
  for (const [from, to] of POLITE_MAP) {
    if (trimmed.endsWith(from)) return `${trimmed.slice(0, trimmed.length - from.length)}${to}`;
  }
  return null;
}

/**
 * 뜻을 바꾸지 않고 종결 어미만 해요체로 바꾼다.
 * 규칙에 없는 끝맺음은 억지로 고치지 않고 null 을 돌려준다(그 후보는 차단된다).
 */
export function toPoliteKorean(text: string): string | null {
  const source = text.trim();
  if (!source) return source;
  const pieces = splitSentences(source);
  let changed = false;
  const rebuilt: string[] = [];
  for (const piece of pieces) {
    const leading = piece.match(/^\s*/u)?.[0] ?? "";
    const { body, tail } = cutTail(piece.slice(leading.length));
    const fixed = politeBody(body);
    if (fixed === null) return null;
    if (fixed !== body.replace(/\s+$/u, "")) changed = true;
    rebuilt.push(`${leading}${fixed}${tail}`);
  }
  const result = rebuilt.join("");
  return changed ? result : source;
}
