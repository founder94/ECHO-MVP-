export type RewardVerdict =
  | "VALID"
  | "LOW_INFORMATION"
  | "ABUSIVE"
  | "PERSONAL_DATA"
  | "DUPLICATE"
  | "SAFETY_EXIT";

const ABUSIVE = [
  "바보",
  "멍청",
  "못생",
  "꺼져",
  "죽어",
  "혐오",
  "시발",
  "병신",
  "닥쳐",
];

const LOW_INFO = ["싫음", "별로", "그냥", "몰라", "노잼", "없음", "ㅇㅇ"];

const PERSONAL = [
  /\d{3}[-\s]?\d{3,4}[-\s]?\d{4}/,
  /@[\w.]+/,
  /01\d{8,9}/,
];

// 데모용 클라이언트 판정. 실제 운영에서는 서버 정책이 최종 결정한다.
// LLM이 Reward 최종 지급을 결정하지 않는다.
export function evaluateExitReward(
  text: string,
  priorTexts: string[],
): RewardVerdict {
  const raw = text.trim();
  const normalized = raw.replace(/\s+/g, " ").toLowerCase();

  if (raw && priorTexts.some((t) => t.trim().toLowerCase() === normalized)) {
    return "DUPLICATE";
  }
  if (ABUSIVE.some((w) => normalized.includes(w))) return "ABUSIVE";
  if (PERSONAL.some((re) => re.test(raw))) return "PERSONAL_DATA";

  const meaningfulLen = raw.replace(/(.)\1{2,}/g, "$1").length;
  if (!raw || meaningfulLen < 12) return "LOW_INFORMATION";
  if (
    LOW_INFO.some(
      (w) => normalized === w || (normalized.includes(w) && meaningfulLen < 16),
    )
  ) {
    return "LOW_INFORMATION";
  }
  return "VALID";
}

export const REWARD_COPY: Record<
  RewardVerdict,
  { title: string; body: string; rewarded: boolean }
> = {
  VALID: {
    title: "고마워, 잘 받았어",
    body: "남긴 이유는 다음 경험을 더 나아지게 하는 데 쓸게.",
    rewarded: true,
  },
  LOW_INFORMATION: {
    title: "이유를 조금만 더 들려줄래?",
    body: "구체적으로 적어주면 다음 경험을 개선하는 데 도움이 돼. (보상 대상은 아니야)",
    rewarded: false,
  },
  ABUSIVE: {
    title: "이 표현은 남길 수 없어",
    body: "공격적인 표현은 상대에게 전달되지 않아. 종료는 계속 진행할 수 있어.",
    rewarded: false,
  },
  PERSONAL_DATA: {
    title: "개인정보는 빼줘",
    body: "연락처·계정 같은 정보는 담을 수 없어. 다시 적어줄래?",
    rewarded: false,
  },
  DUPLICATE: {
    title: "같은 이유가 이미 있었어",
    body: "여러 방에 같은 문장을 반복 제출하면 보상 대상이 아니야. 종료는 진행돼.",
    rewarded: false,
  },
  SAFETY_EXIT: {
    title: "안전하게 나왔어",
    body: "이유를 남길 필요 없어. 너의 안전이 가장 중요해.",
    rewarded: false,
  },
};