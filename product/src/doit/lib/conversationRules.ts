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
