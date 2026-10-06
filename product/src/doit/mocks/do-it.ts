export const purposes = [
  {
    id: "slow",
    label: "사람을 천천히 알아가기",
    icon: "ri-hearts-line",
    desc: "서두르지 않고 서로의 이야기를 들어봐요",
    color: "#C4453C",
  },
  {
    id: "friend",
    label: "친구",
    icon: "ri-user-smile-line",
    desc: "일상을 나누는 친구를 만나요",
    color: "#C9A24B",
  },
  {
    id: "hobby",
    label: "취미",
    icon: "ri-palette-line",
    desc: "같은 취미를 즐기는 사람들과",
    color: "#A8B0B8",
  },
  {
    id: "workout",
    label: "운동",
    icon: "ri-run-line",
    desc: "함께 운동하며 동기부여를",
    color: "#D9A7A0",
  },
  {
    id: "culture",
    label: "문화 활동",
    icon: "ri-movie-line",
    desc: "전시, 공연, 영화를 함께",
    color: "#6E7A84",
  },
  {
    id: "local",
    label: "지역 활동",
    icon: "ri-map-pin-2-line",
    desc: "우리 동네에서 만나요",
    color: "#C4453C",
  },
  {
    id: "create",
    label: "창작",
    icon: "ri-pencil-ruler-2-line",
    desc: "함께 만들고 기록해요",
    color: "#C9A24B",
  },
  {
    id: "collab",
    label: "협업",
    icon: "ri-team-line",
    desc: "프로젝트와 아이디어를 나눠요",
    color: "#A8B0B8",
  },
  {
    id: "pro",
    label: "전문 프로젝트",
    icon: "ri-briefcase-line",
    desc: "전문 분야에서 함께 성장해요",
    color: "#D9A7A0",
  },
  {
    id: "safe",
    label: "보호가 필요한 목적 공간",
    icon: "ri-shield-star-line",
    desc: "안전하게 지켜지는 공간",
    color: "#6E7A84",
  },
];

export const spaces = [
  {
    id: "s1",
    purposeId: "slow",
    name: "느린 대화방",
    members: 4,
    maxMembers: 6,
    status: "open",
    description: "서두르지 않고 서로의 이야기를 들어봐요",
    lock: false,
    currentMission: "서로의 최애 음악 하나씩 공유하기",
    progress: 40,
  },
  {
    id: "s2",
    purposeId: "friend",
    name: "주말 산책 메이트",
    members: 3,
    maxMembers: 5,
    status: "open",
    description: "근처 공원에서 가벼운 산책을 함께해요",
    lock: false,
    currentMission: "이번 주 산책 코스 추천하기",
    progress: 60,
  },
  {
    id: "s3",
    purposeId: "create",
    name: "글쓰기 모임",
    members: 5,
    maxMembers: 5,
    status: "full",
    description: "매주 짧은 글을 쓰고 피드백을 나눠요",
    lock: false,
    currentMission: "300자 자기소개 작성하기",
    progress: 80,
  },
  {
    id: "s4",
    purposeId: "hobby",
    name: "필름 카메라 클럽",
    members: 4,
    maxMembers: 6,
    status: "open",
    description: "아날로그 감성으로 사진을 찍고 공유해요",
    lock: false,
    currentMission: "이번 주 주제: 빛",
    progress: 20,
  },
  {
    id: "s5",
    purposeId: "workout",
    name: "아침 스트레칭 방",
    members: 6,
    maxMembers: 8,
    status: "open",
    description: "15분 아침 스트레칭으로 하루를 시작해요",
    lock: false,
    currentMission: "3일 연속 출석하기",
    progress: 33,
  },
  {
    id: "s6",
    purposeId: "culture",
    name: "전시 메이트",
    members: 2,
    maxMembers: 4,
    status: "open",
    description: "이번 달 추천 전시를 함께 보러 가요",
    lock: false,
    currentMission: "가보고 싶은 전시 공유하기",
    progress: 0,
  },
  {
    id: "s7",
    purposeId: "collab",
    name: "사이드 프로젝트 팀",
    members: 3,
    maxMembers: 4,
    status: "locked",
    description: "같이 만들어갈 작은 프로젝트를 시작해요",
    lock: true,
    currentMission: "아이디어 브레인스토밍",
    progress: 0,
  },
  {
    id: "s8",
    purposeId: "pro",
    name: "UX 디자인 스터디",
    members: 4,
    maxMembers: 6,
    status: "open",
    description: "UX 케이스 스터디와 포트폴리오 리뷰",
    lock: false,
    currentMission: "좋아하는 앱의 UX 분석하기",
    progress: 50,
  },
  {
    id: "s9",
    purposeId: "local",
    name: "동네 맛집 탐방",
    members: 3,
    maxMembers: 5,
    status: "open",
    description: "숨은 동네 맛집을 함께 발굴해요",
    lock: false,
    currentMission: "이번 주 탐방할 가게 정하기",
    progress: 10,
  },
  {
    id: "s10",
    purposeId: "safe",
    name: "심리 안정 공간",
    members: 3,
    maxMembers: 4,
    status: "locked",
    description: "전문가가 함께하는 안전한 대화 공간",
    lock: true,
    currentMission: "오늘의 기분 체크인",
    progress: 0,
  },
];

export const connections = [
  {
    id: "k1",
    name: "민지",
    purpose: "창작",
    room: "글쓰기 모임",
    openedAt: "2시간 전",
    status: "new",
    grade: "gold",
    message: "선택이 겹쳐서 KEY가 열렸어요",
  },
  {
    id: "k2",
    name: "준호",
    purpose: "운동",
    room: "아침 스트레칭 방",
    openedAt: "1일 전",
    status: "active",
    grade: "silver",
    message: "3일 연속 미션을 함께 완료했어요",
  },
  {
    id: "k3",
    name: "서연",
    purpose: "취미",
    room: "필름 카메라 클럽",
    openedAt: "3일 전",
    status: "active",
    grade: "perfume",
    message: "서로의 사진 취향이 비슷했어요",
  },
];

export const pendingConnections = [
  { id: "p1", purpose: "친구", room: "주말 산책 메이트", hint: "누군가와의 선택이 곧 겹칠 것 같아요" },
  { id: "p2", purpose: "문화 활동", room: "전시 메이트", hint: "미션을 더 진행하면 열릴 수 있어요" },
];

export const notifications = [
  {
    id: "n1",
    type: "key",
    title: "새로운 연결이 열렸어요",
    message: "민지님과의 선택이 겹쳤어요",
    time: "10분 전",
    read: false,
    icon: "ri-hearts-line",
  },
  {
    id: "n2",
    type: "mission",
    title: "미션 완료",
    message: "'300자 자기소개 작성하기'를 완료했어요",
    time: "1시간 전",
    read: false,
    icon: "ri-check-double-line",
  },
  {
    id: "n3",
    type: "space",
    title: "새로운 공간이 열렸어요",
    message: "'필름 카메라 클럽'에 참여할 수 있어요",
    time: "3시간 전",
    read: true,
    icon: "ri-door-open-line",
  },
  {
    id: "n4",
    type: "system",
    title: "등급이 올랐어요",
    message: "실버 등급이 되었어요. 축하해요!",
    time: "1일 전",
    read: true,
    icon: "ri-vip-crown-line",
  },
  {
    id: "n5",
    type: "mission",
    title: "미션 리마인드",
    message: "'이번 주 주제: 빛' 미션을 진행 중이에요",
    time: "2일 전",
    read: true,
    icon: "ri-time-line",
  },
];

export const myProfile = {
  name: "도은",
  grade: "silver",
  bio: "같이 뭔가를 만들어가는 걸 좋아해요. 글쓰기와 사진에 관심이 많아요.",
  stats: { spaces: 3, connections: 2, missions: 7 },
  joinedAt: "2026.06.15",
};

export const roomDetail = {
  id: "s3",
  name: "글쓰기 모임",
  purposeId: "create",
  purposeLabel: "창작",
  members: [
    { id: "m1", name: "도은", grade: "silver", avatar: "", revealed: true, me: true },
    { id: "m2", name: "민지", grade: "gold", avatar: "", revealed: true, me: false },
    { id: "m3", name: "???", grade: "red", avatar: "", revealed: false, me: false },
    { id: "m4", name: "???", grade: "red", avatar: "", revealed: false, me: false },
    { id: "m5", name: "???", grade: "red", avatar: "", revealed: false, me: false },
  ],
  mission: {
    title: "300자 자기소개 작성하기",
    description: "나를 300자로 표현해보세요. 어떤 사람인지 알아가는 첫 단계예요.",
    progress: 80,
    totalSteps: 5,
    currentStep: 4,
    deadline: "오늘 자정",
  },
  messages: [
    { id: "msg1", sender: "민지", text: "이번 주 주제 재밌네요!", time: "10:23" },
    { id: "msg2", sender: "도은", text: "맞아요, 저도 방금 제출했어요", time: "10:25" },
    { id: "msg3", sender: "시스템", text: "도은님이 미션을 완료했어요", time: "10:26", isSystem: true },
  ],
};

export const worldStats = [
  { label: "참여 공간", value: 3, icon: "ri-compass-3-line" },
  { label: "열린 연결", value: 2, icon: "ri-hearts-line" },
  { label: "완료 미션", value: 7, icon: "ri-check-double-line" },
  { label: "현재 등급", value: "실버", icon: "ri-vip-crown-line", isText: true },
];

export const worldTimeline = [
  { id: "t1", title: "글쓰기 모임에 참여했어요", time: "2시간 전", icon: "ri-door-open-line" },
  { id: "t2", title: "민지님과 연결이 열렸어요", time: "2시간 전", icon: "ri-hearts-line" },
  { id: "t3", title: "실버 등급이 되었어요", time: "1일 전", icon: "ri-vip-crown-line" },
  { id: "t4", title: "아침 스트레칭 방에 참여했어요", time: "3일 전", icon: "ri-door-open-line" },
  { id: "t5", title: "준호님과 연결이 열렸어요", time: "5일 전", icon: "ri-hearts-line" },
];

export const roomMissions = [
  {
    id: "m1",
    title: "300자 자기소개 작성하기",
    description: "나를 300자로 표현해보세요. 어떤 사람인지 알아가는 첫 단계예요.",
  },
  {
    id: "m2",
    title: "서로의 최애 음악 하나씩 공유하기",
    description: "지금 내 마음을 움직이는 곡 한 곡을 골라 그 이유를 들려줘요.",
  },
  {
    id: "m3",
    title: "이번 주 나를 움직이게 한 문장",
    description: "책, 영화, 누군가의 말 중 나를 움직이게 한 문장을 나눠요.",
  },
  {
    id: "m4",
    title: "함께 하고 싶은 작은 약속 정하기",
    description: "이번 주 함께 해보고 싶은 작은 행동 하나를 정해봐요.",
  },
];

export const exitReasons = [
  { id: "purpose", label: "목적이 달랐어" },
  { id: "comm", label: "대화 방식이 나와 맞지 않았어" },
  { id: "pace", label: "참여 속도가 맞지 않았어" },
  { id: "interest", label: "관심사를 이어가기 어려웠어" },
  { id: "mission", label: "Mission 방식이 부담스러웠어" },
  { id: "trust", label: "약속·행동에서 신뢰가 떨어졌어" },
  { id: "situation", label: "지금은 계속할 상황이 아니야" },
  { id: "other", label: "다른 이유가 있어 · 직접 설명할게" },
];

export const safetyReasons = [
  { id: "harass", label: "성희롱" },
  { id: "threat", label: "협박" },
  { id: "stalking", label: "스토킹" },
  { id: "privacy", label: "개인정보 요구" },
  { id: "external", label: "외부 연락 강요" },
  { id: "fraud", label: "사기 의심" },
  { id: "money", label: "금전 요구" },
  { id: "hate", label: "혐오·차별" },
];

export const reportReasons = [
  { id: "r1", label: "성희롱·불쾌한 언행" },
  { id: "r2", label: "협박·위협" },
  { id: "r3", label: "개인정보 요구" },
  { id: "r4", label: "외부 연락 유도" },
  { id: "r5", label: "금전 요구" },
  { id: "r6", label: "혐오·차별 표현" },
];

export const keyWallet = {
  revenueKey: 120,
  rewardKey: 45,
};

// 가격은 서버가 확정한다. 프론트 목업에 금액을 두지 않는다(2026-09-05 통합 기준).
export const keyPackages = [
  { id: "p100", packageId: "p100", name: "100 KEY", amount: 100 },
  { id: "p300", packageId: "p300", name: "300 KEY", amount: 300 },
  { id: "p650", packageId: "p650", name: "650 KEY", amount: 650 },
];

export const keyPolicy = {
  validityDays: 180,
  validityLabel: "결제일로부터 6개월",
  refundNote:
    "결제 후 7일 이내, 사용하지 않은 KEY는 전액 환불돼요. 일부라도 사용했다면 잔여 KEY는 환불되지 않아요. 환불 문의는 고객센터로 남겨주세요.",
};

export interface KeyPurchase {
  id: string;
  orderId: string;
  packageId: string;
  name: string;
  keyAmount: number;
  status: string;
  purchasedAt: string;
}
// 구매내역은 서버(결제 검증) 연결 후에만 채워진다. 가짜 결제 기록을 두지 않는다.
export const keyPurchaseHistory: KeyPurchase[] = [];

export const keyHistory = [
  { id: "h1", type: "earn", title: "미션 완료 보상", amount: 3, bucket: "Reward", time: "2시간 전" },
  { id: "h2", type: "earn", title: "종료 이유 보상", amount: 1, bucket: "Reward", time: "1일 전" },
  { id: "h3", type: "spend", title: "보호 공간 개설", amount: 50, bucket: "Reward", time: "3일 전" },
  { id: "h4", type: "charge", title: "KEY 충전 (100)", amount: 100, bucket: "Revenue", time: "5일 전" },
];

export const grades = [
  { id: "red", label: "레드", color: "#C4453C", desc: "신뢰를 처음 쌓아가는 단계" },
  { id: "silver", label: "실버", color: "#A8B0B8", desc: "활동을 꾸준히 이어온 단계" },
  { id: "gold", label: "골드", color: "#C9A24B", desc: "함께한 활동이 쌓인 단계" },
  { id: "perfume", label: "퍼퓸", color: "#D9A7A0", desc: "깊은 활동을 통해 쌓인 단계" },
  { id: "platinum", label: "플래티늄", color: "#6E7A84", desc: "오랜 신뢰가 쌓인 단계" },
  { id: "black", label: "블랙", color: "#1A1A1A", desc: "돈으로 구매할 수 없는 최고 신뢰" },
];