// ── RULES (shared with supabase/functions/doit-understanding/index.ts v13) ──
// 대화 규칙의 순수 판정 함수. 질문 문장을 만들지 않는다(문장은 서버의 AI가 만든다).
// 서버 파일에 같은 블록이 있고, qa/conversation-rules.test.mjs 가 두 복사본이 같은지 검사한다.
// - TOPICS: 서버가 "아직 안 나온 주제"를 고를 때 쓰는 나침반. 순서는 우선순위일 뿐 고정 질문이 아니다.
// - isMetaReply: 답이 아니라 "질문이 무슨 뜻이냐"는 되묻기인지. 짧고 질문 자체를 가리킬 때만 true.
// - blockedContentReason: 저장하면 안 되는 입력(연락처·식별번호·링크·성적 표현). 규칙 판정이라 AI를 거치지 않는다.
// v14(대표 2026-09-22): 주제는 "자기이해 심화"가 아니라 "상대를 골라 주려면 알아야 하는 것"이다.
// 두 사람을 겹쳐 볼 수 있는 칸만 남긴다. 마음·감정을 파고드는 주제(mood)는 뺐다.
export const TOPICS = [
  { id: "purpose", label: "원하는 만남" },
  { id: "partner_style", label: "끌리는 사람" },
  { id: "together", label: "같이 하고 싶은 것" },
  { id: "self", label: "상대가 알면 좋을 나" },
  { id: "pace", label: "만나는 방식" },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];
export function isTopicId(value: unknown): value is TopicId {
  return typeof value === "string" && TOPICS.some((t) => t.id === value);
}
export function pickNextTopic(covered: Iterable<string>): TopicId | null {
  const done = new Set(covered);
  return TOPICS.find((t) => !done.has(t.id))?.id ?? null;
}
const META_MAX_LENGTH = 60;
// v14.3(대표 실기기 2026-09-24): "질문이 머이래"·"딥하네"·"무슨 말이야 글자 오타 아니야?"를 답으로 저장했다 → 구어체(머·먼)·불평·오타 지적을 더한다.
// "모르겠어요"는 되묻기가 아니라 정상 답이다(기준 문서 §2) — 질문을 가리키는 말 없이 "모르겠어요"만 오면 답으로 저장한다.
// "말이 이상한 사람은 싫어" 같은 진짜 답을 되묻기로 오인하지 않게, "말"은 무슨·뭔·이해 와만 묶는다.
const META_PATTERNS: readonly RegExp[] = [
  /(질문|뜻|문장|글자|글씨)\s*(이|은|가)?\s*(무슨|뭔|머|뭐|이해|어렵|어려|이상|모르|헷갈|애매)/,
  /말\s*(이|은)?\s*(무슨|뭔|머|뭐|이해)/,
  /(무슨|뭔|먼|머)\s*(뜻|말|질문|소리|얘기)/,
  /(뭐|머)라(는|고|냐|구)/,
  /이게\s*(뭐|머|무슨)/,
  /다시\s*(말|설명|물어|얘기)/,
  /예를?\s*들/,
  /어떻게\s*(답|대답|적|써|말)/,
  /오타/,
  /^(너무|좀|넘|질문이?|말이)?\s*(딥|깊|무겁|어렵|어려|헷갈|이상)(하네|해|하다|네|다|워|운데|네요|해요|어요|하네요|하다고|려|려요|리네|리네요)?[\s.!?~ㅋㅎ]*$/,
  /^[^\s?]{1,6}\?+$/,
  /^\?+$/,
];
export function isMetaReply(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > META_MAX_LENGTH) return false;
  return META_PATTERNS.some((p) => p.test(t));
}
// v14.4 AI 에게 하는 질문(답이 아님): "왜 이런 걸 물어봐?", "이거 어디에 써요?", "누가 봐요?", "몇 개 남았어요?", "넌 누구야?".
// 답으로 저장하지 않고 먼저 답한 뒤 같은 질문을 다시 건넨다. "왜"가 들어간 진짜 답("왜냐면 편해서요")을 막지 않게 묻는 대상과 묶는다.
const ASK_AI_PATTERNS: readonly RegExp[] = [
  /왜\s*(이런|그런|이|그|저런)?\s*(걸|거|것|질문|얘기)?\s*(을|를)?\s*(자꾸|계속)?\s*(물어|묻|알아야|알려고|궁금|필요)/,
  /(이거|이건|이걸|여기|이\s*앱|이\s*서비스|두잇|DO\s*IT)\s*(는|은|가|이)?\s*(뭐|머|뭔|무슨|왜)\s*(야|예요|에요|하는|해|하|지|죠|인데|냐|니|데|\?)/i,
  /(너|넌|니가|네가|너는|AI|에이아이)\s*(는|가|은)?\s*(누구|뭐|머|뭔|진짜)/i,
  /(너|넌|너는)\s*(AI|에이아이|로봇|사람|기계)\s*(야|이야|예요|이에요|인가요|니|냐)?\s*[?？]/i,
  /(어디에|어디|어따|누가|누구한테|누구에게)\s*(써|쓰|쓰여|쓰이|쓸|봐|보|보여|보이|공개|저장|넘어)/,
  /(저장|공개|기록)\s*(돼요|되나요|될까요|되는\s*거(야|예요|에요|죠)?|돼|되나|될까)\s*[?？]/,
  /(저장|공개|기록)\s*(되나요|될까요|되는\s*건가요)/,
  /(몇\s*(개|번|가지)\s*(더|남|까지|물어|해야)|언제\s*(끝|까지)|얼마나\s*(더|남))/,
];
export function isAskingAi(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > META_MAX_LENGTH) return false;
  return ASK_AI_PATTERNS.some((p) => p.test(t));
}
// v15(대표 실기기 2026-09-24 "뭘더 얘길해야해 너가 내 내용을 반영해서 다음 질문을 해야하는거 아니야?" / "할말이없다 휴"):
// 관계에 대한 답이 아닌 말을 규칙으로 먼저 가른다. 규칙이 못 잡은 짧은 말은 서버의 AI 분류가 한 번 더 본다(turn_classify).
// - complaint: 질문이 겉돈다·같은 걸 또 묻는다·내 말을 반영하라는 불만. 기록하지 않고, 앞 답에서 이어지는 새 질문을 받는다.
// - fatigue: 지친 말·할 말이 없다·그만하고 싶다. 기록하지 않고 사용자의 성향으로 해석하지 않는다(다른 질문 받기·쉬어 가기).
// - unsure: "모르겠어요"는 정상 답이다(기록하고 다섯 칸에 센다). 다만 나에 대한 사실로 만들지 않고 다음 질문을 더 쉽게 한다.
// - correction: "그 뜻 아니야"·"잘못 이해했어"처럼 AI 가 잘못 들었다고 고치는 말. 뒤에 붙은 설명이 있으면 그 설명이 답이다.
//   "아니요, 대화가 많은 게 좋아요"처럼 질문에 대한 부정 답은 정정이 아니다(질문이 아니라 AI 의 이해를 가리킬 때만).
export type TurnKind = "answer" | "ask" | "meta" | "complaint" | "fatigue" | "unsure" | "correction";
const COMPLAINT_MAX_LENGTH = 120;
const COMPLAINT_PATTERNS: readonly RegExp[] = [
  /(뭘|뭐를|무엇을|뭐|머)\s*(더|또)\s*(얘기|애기|이야기|말|적|써|답)/,
  /(너|니|네|AI|에이아이)\s*(가|는|이)?\s*(알아서|내\s*(말|얘기|애기|이야기|내용|답)|반영)/i,
  /내\s*(말|얘기|애기|이야기|내용|답)\s*(을|를|은|좀)?\s*(반영|안\s*듣|안\s*들|못\s*알아|무시)/,
  /반영\s*(해\s*(줘|야|주)|을\s*안|이\s*안|안\s*(해|돼|되)|좀)/,
  /(같은|똑같은|비슷한)\s*(질문|말|얘기|걸|거)/,
  /(또|계속|자꾸)\s*(같은|똑같은|그)?\s*(질문|물어|묻)/,
  /(질문|물어|묻)\S*\s*(이|가|은)?\s*(이상|엉뚱|뜬금|겉돌|왜\s*이래)/,
  /(아까|이미|벌써|다)\s*(말했|얘기했|애기했|이야기했|적었|답했)/,
];
const FATIGUE_PATTERNS: readonly RegExp[] = [
  /할\s*말\s*(이|은|도)?\s*(없|더\s*없)/,
  /그만\s*(할|하|둘|두|해|하고)/,
  /(지쳤|지친다|지쳐|피곤해|귀찮|하기\s*싫|답하기\s*싫|쓰기\s*싫)/,
  /^(휴+|하+|에휴|아휴|후+|하아+)[\s.!~ㅠㅜ]*$/,
  /(패스|넘어갈래|넘길래|건너뛸래|다음에\s*할래|나중에\s*할래|오늘은\s*여기까지)/,
];
const UNSURE_MAX_LENGTH = 24;
const UNSURE_PATTERN = /^(음+|글쎄(요)?|잘|흠+)?[\s,.]*(모르겠|몰라|모름|글쎄|딱히\s*(없|생각)|생각\s*(이\s*)?안\s*나|아직\s*(모르|생각)|없어요?$|없음$|없는\s*것\s*같)/;
const CORRECTION_PATTERNS: readonly RegExp[] = [
  /^(아니|아뇨|아니야|아니요)?[\s,.]*(그게|그건|그런|그|이건|이게)\s*(뜻|말|의미)?\s*(이|은|은요)?\s*아니\S*/,
  /잘못\s*(이해|알아|들|짚|알았|받아)\S*/,
  /(내|제)\s*(말|뜻)\s*(은|는)\s*(그게|그런|그런\s*뜻이)?\s*아니\S*/,
  /^아니[야요]?[\s,.!~]*$/,
];
export function correctionRest(text: string): string {
  const t = text.trim();
  for (const p of CORRECTION_PATTERNS) {
    const m = t.match(p);
    if (m) return t.slice((m.index ?? 0) + m[0].length).replace(/^[\s,.!~]*/, "").trim();
  }
  return "";
}
export function ruleKind(text: string): TurnKind | null {
  const t = text.trim();
  if (!t) return null;
  if (isAskingAi(t)) return "ask";
  if (t.length <= COMPLAINT_MAX_LENGTH && COMPLAINT_PATTERNS.some((p) => p.test(t))) return "complaint";
  if (isMetaReply(t)) return "meta";
  if (t.length <= COMPLAINT_MAX_LENGTH && FATIGUE_PATTERNS.some((p) => p.test(t))) return "fatigue";
  if (t.length <= COMPLAINT_MAX_LENGTH && CORRECTION_PATTERNS.some((p) => p.test(t))) return "correction";
  if (t.length <= UNSURE_MAX_LENGTH && UNSURE_PATTERN.test(t)) return "unsure";
  return null;
}
export type BlockedReason = "phone" | "email" | "id_number" | "link" | "card" | "sexual";
const BLOCKED_PATTERNS: readonly { reason: BlockedReason; pattern: RegExp }[] = [
  { reason: "phone", pattern: /(?:\+?82[-\s.]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/ },
  { reason: "phone", pattern: /(?:^|\D)0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}(?:\D|$)/ },
  { reason: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { reason: "id_number", pattern: /(?:^|\D)\d{6}[-\s]?[1-4]\d{6}(?:\D|$)/ },
  { reason: "card", pattern: /(?:^|\D)\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}(?:\D|$)/ },
  { reason: "link", pattern: /https?:\/\/|www\.|[A-Za-z0-9-]+\.(?:com|net|kr|io|me|link)(?:\/|\s|$)/i },
  { reason: "sexual", pattern: /섹스|성관계|원나잇|조건\s*만남|성매매|야한\s*사진|몸\s*사진|노콘/ },
];
export function blockedContentReason(text: string): BlockedReason | null {
  const t = text.normalize("NFKC");
  for (const { reason, pattern } of BLOCKED_PATTERNS) if (pattern.test(t)) return reason;
  return null;
}
export function blockedContentMessage(reason: BlockedReason): string {
  const what = reason === "sexual" ? "성적인 표현" : reason === "link" ? "링크" : reason === "email" ? "이메일 주소" : reason === "card" ? "카드번호" : reason === "id_number" ? "주민번호" : "전화번호";
  return `${what}은(는) 저장하지 않아요. 그 부분을 빼고 다시 적어 주세요. 적은 내용은 그대로 남아 있어요.`;
}
// ── /RULES ──
