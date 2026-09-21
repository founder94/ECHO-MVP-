// ── RULES (shared with supabase/functions/doit-understanding/index.ts v13) ──
// 대화 규칙의 순수 판정 함수. 질문 문장을 만들지 않는다(문장은 서버의 AI가 만든다).
// 서버 파일에 같은 블록이 있고, qa/conversation-rules.test.mjs 가 두 복사본이 같은지 검사한다.
// - TOPICS: 서버가 "아직 안 나온 주제"를 고를 때 쓰는 나침반. 순서는 우선순위일 뿐 고정 질문이 아니다.
// - isMetaReply: 답이 아니라 "질문이 무슨 뜻이냐"는 되묻기인지. 짧고 질문 자체를 가리킬 때만 true.
// - blockedContentReason: 저장하면 안 되는 입력(연락처·식별번호·링크·성적 표현). 규칙 판정이라 AI를 거치지 않는다.
export const TOPICS = [
  { id: "purpose", label: "원하는 만남" },
  { id: "partner_style", label: "끌리는 사람의 스타일" },
  { id: "partner_traits", label: "그 관계에서 중요한 상대의 성향" },
  { id: "self", label: "상대가 알아야 할 나의 모습" },
  { id: "mood", label: "요즘 사람을 만나는 일에 대한 마음" },
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
const META_PATTERNS: readonly RegExp[] = [
  /(질문|말|뜻)\s*(이|은|가)?\s*(무슨|뭔|이해|어렵|이상|모르)/,
  /무슨\s*(뜻|말|질문|소리)/,
  /뭔\s*(뜻|말|소리)/,
  /다시\s*(말|설명|물어|얘기)/,
  /예를?\s*들/,
  /어떻게\s*(답|대답|적|써|말)/,
  /뭐라고\s*(요|묻|물|한|하)/,
  /^\?+$/,
];
export function isMetaReply(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > META_MAX_LENGTH) return false;
  return META_PATTERNS.some((p) => p.test(t));
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
