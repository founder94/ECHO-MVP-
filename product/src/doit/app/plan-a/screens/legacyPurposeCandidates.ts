// 2026-09-20 대표 확정: 이 12종은 Purpose("나는 어떤 관계를 원하는가")가 아니다.
// Purpose 정본은 운영 DB public.purposes 활성 행이다. 이 목록은 메인 목적 화면에서 사용하지 않는다.
// 삭제하지 않고 향후 축 후보로 보존한다.
//   - 관심사/직군/프로젝트 계열(interest, startup, professional, creator, project)
//       → Interest / Context / Space Filter 후보
//   - 성소수자 보호 공간(lgbtq)
//       → Space Policy 후보 (목적이 아니라 공간 정책)
//   - 중복 계열(same-gender 는 friend 의 하위 조건, colleague 는 professional 과 겹침)

export interface LegacyPurposeCandidate {
  id: string;
  label: string;
  emoji: string;
  note: string;
  protected?: boolean;
}

export const LEGACY_PURPOSE_CANDIDATES: LegacyPurposeCandidate[] = [
  {
    id: "friend",
    label: "친구 관계",
    emoji: "🤝",
    note: "편하게 어울릴 사람",
  },
  {
    id: "romantic",
    label: "이성 관계",
    emoji: "💛",
    note: "천천히 알아가는 연결",
  },
  {
    id: "same-gender",
    label: "동성 친구 관계",
    emoji: "🌿",
    note: "깊이 공감하는 우정",
  },
  {
    id: "colleague",
    label: "동료 관계",
    emoji: "💼",
    note: "함께 성장하는 사람",
  },
  {
    id: "interest",
    label: "관심사 기반 관계",
    emoji: "🎨",
    note: "취미와 열정이 통하는 사람",
  },
  {
    id: "values",
    label: "가치관 기반 관계",
    emoji: "✨",
    note: "삶의 방향이 비슷한 사람",
  },
  {
    id: "startup",
    label: "창업가 그룹",
    emoji: "🚀",
    note: "같이 만들어가는 사람",
  },
  {
    id: "professional",
    label: "전문직 그룹",
    emoji: "📐",
    note: "전문성을 나눌 사람",
  },
  {
    id: "creator",
    label: "크리에이터 그룹",
    emoji: "🎬",
    note: "창작 에너지가 맞는 사람",
  },
  {
    id: "project",
    label: "프로젝트·스터디·성장 목적 그룹",
    emoji: "📖",
    note: "함께 배우고 만들어가는 목적",
  },
  {
    id: "conversation",
    label: "목적성 기반 대화 그룹",
    emoji: "💬",
    note: "의미 있는 대화",
  },
  {
    id: "lgbtq",
    label: "성소수자 보호 공간",
    emoji: "🏳️",
    note: "안전과 정체성 보호",
    protected: true,
  },
];

export const LEGACY_PURPOSE_DETAILS: Record<string, string> = {
  friend:
    "부담 없이 자주 어울리며 편하게 지낼 사람을 찾아요.",
  romantic:
    "서두르지 않고 대화와 시간을 통해 천천히 알아가요.",
  "same-gender":
    "같은 성별의 친구로서 깊이 공감하는 우정을 만들어요.",
  colleague:
    "일과 성장의 결이 맞아 함께 나아갈 사람을 찾아요.",
  interest:
    "같은 취미와 관심사로 자연스럽게 이어지는 관계예요.",
  values:
    "삶의 방향과 우선순위가 비슷한 사람을 찾아요.",
  startup:
    "함께 만들고 도전할 창업 동료를 찾는 공간이에요.",
  professional:
    "전문성과 경험을 나눌 같은 분야의 사람을 찾아요.",
  creator:
    "창작 에너지와 감각이 맞는 사람과 이어져요.",
  project:
    "프로젝트·스터디·성장이라는 분명한 목적으로 함께해요.",
  conversation:
    "가벼운 잡담이 아닌, 의미 있는 대화를 나눌 사람을 찾아요.",
  lgbtq:
    "안전과 정체성 보호를 최우선으로 하는 목적성 공간이에요.",
};
