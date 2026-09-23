// A구조(DO IT) 자기이해 자산 mock 데이터.
//
// §5·통합 설계도 기준 원칙을 그대로 반영한다.
//   - 상태값: confirmed(확인) / corrected(수정) / rejected(거절)
//   - confirmed·corrected 만 장기 자기이해 자산 후보(타임라인·가치·패턴·선택 기억)로 넘긴다.
//   - rejected 는 사용자 정체성·패턴으로 저장하지 않고, "재사용 차단" 검수 데이터로만 둔다.
//   - 모든 항목은 사용자 원문 근거(source)와 상태값을 항상 유지한다.
//   - 정보 상태(infoStatus): 확정 / 가능성 / 미정 / 검증 필요 (AI는 후보만, 확정은 서버·사용자)
//
// 실제 데이터 연결(서버·DB)은 클로드 담당(STOP)이며, 여기는 화면 구조용 임시 데이터다.

export type InfoStatus = 'confirmed' | 'possible' | 'undetermined' | 'needs_verification';

export type UnderstandingCategory = 'value' | 'pattern' | 'memory';

export type Decision = 'confirmed' | 'corrected' | 'rejected';

// 검토 대기 후보 (사용자가 확인·수정·거절 결정 전)
export interface ReviewCandidate {
  id: string;
  category: UnderstandingCategory;
  source: string; // 사용자 원문 근거
  interpretation: string; // AI 해석 후보
  infoStatus: InfoStatus; // AI 정보 상태
}

// 확정 자산 (confirmed·corrected) — 타임라인·가치·패턴·선택 기억에 노출
export interface UnderstandingItem {
  id: string;
  category: UnderstandingCategory;
  source: string;
  interpretation: string;
  correctedText?: string; // corrected 일 때 사용자 수정본
  status: 'confirmed' | 'corrected';
  createdAt: string;
  sourceLabel: string; // 출처 라벨 (마음 날씨 / ECHO 대화 / 하루 기록 등)
}

// 거절된 항목 — 재사용 차단용으로만 유지(자산에 노출 금지)
export interface RejectedItem {
  id: string;
  category: UnderstandingCategory;
  source: string;
  rejectedInterpretation: string;
  rejectedAt: string;
}

export const INFO_STATUS_LABEL: Record<InfoStatus, string> = {
  confirmed: '확정',
  possible: '가능성',
  undetermined: '미정',
  needs_verification: '검증 필요',
};

export const CATEGORY_LABEL: Record<UnderstandingCategory, string> = {
  value: '가치 기준',
  pattern: '패턴',
  memory: '선택 기억',
};

export const CATEGORY_ICON: Record<UnderstandingCategory, string> = {
  value: 'ri-focus-3-line',
  pattern: 'ri-pulse-line',
  memory: 'ri-bookmark-3-line',
};

// 검토 대기 후보 — "첫 기록" 이후 AI가 생성한 후보들(확정 전, 사용자 결정 대기)
export const reviewCandidates: ReviewCandidate[] = [
  {
    id: 'c1',
    category: 'value',
    source: '회사에서 맡은 프로젝트가 끝나고도, 계속 더 나은 방법을 찾아보고 싶다는 생각이 들었어요.',
    interpretation: '완성보다 성장을 더 중요하게 여기는 편이다.',
    infoStatus: 'possible',
  },
  {
    id: 'c2',
    category: 'pattern',
    source: '바쁜 날일수록 밤에 혼자 걷는 시간이 있어야 마음이 정리돼요.',
    interpretation: '스트레스를 받으면 혼자만의 시간으로 회복하는 패턴이 있다.',
    infoStatus: 'possible',
  },
  {
    id: 'c3',
    category: 'memory',
    source: '지난주 오랜 친구를 만나고 돌아오는 길에, 오래 울었다는 걸 그때 깨달았어요.',
    interpretation: '깊은 관계에서 받는 위로가 나에게 큰 의미가 있다.',
    infoStatus: 'needs_verification',
  },
  {
    id: 'c4',
    category: 'value',
    source: '안정적인 길보다 내가 의미를 느끼는 길을 가고 싶다고, 처음으로 스스로에게 말했어요.',
    interpretation: '안정보다 의미 있는 변화를 선택하는 편이다.',
    infoStatus: 'possible',
  },
];

// 확정 자산 — 타임라인·가치·패턴·선택 기억에 노출되는 자기이해 결과
export const understandingItems: UnderstandingItem[] = [
  {
    id: 'a1',
    category: 'value',
    source: '완벽하게 끝내기보다, 조금씩이라도 매일 이어가는 게 나한테는 더 중요해요.',
    interpretation: '완벽을 추구하는 성향이다.',
    correctedText: '완벽보다 꾸준한 성장을 추구한다.',
    status: 'corrected',
    createdAt: '2026-09-07T21:14:00+09:00',
    sourceLabel: 'ECHO 대화',
  },
  {
    id: 'a2',
    category: 'pattern',
    source: '감정이 복잡할 때, 말로 정리하기 전에 항상 노트에 먼저 적는 편이에요.',
    interpretation: '감정이 복잡할 때 글로 먼저 정리하는 패턴이 있다.',
    status: 'confirmed',
    createdAt: '2026-09-06T22:40:00+09:00',
    sourceLabel: '하루 기록',
  },
  {
    id: 'a3',
    category: 'memory',
    source: '첫 직장을 그만두던 날, 후회보다 후련함이 더 컸어요.',
    interpretation: '막다른 선택의 순간에도 스스로의 결정을 믿는 편이다.',
    status: 'confirmed',
    createdAt: '2026-09-05T19:05:00+09:00',
    sourceLabel: '마음 날씨',
  },
  {
    id: 'a4',
    category: 'memory',
    source: '여행지를 고를 때, 가본 곳보다 한 번도 안 가본 새로운 곳을 고르는 편이에요.',
    interpretation: '익숙함보다 새로움을 선택하는 경향이 있다.',
    status: 'confirmed',
    createdAt: '2026-09-04T20:20:00+09:00',
    sourceLabel: 'ECHO 대화',
  },
  {
    id: 'a5',
    category: 'pattern',
    source: '일요일 저녁이 되면 다음 주를 생각하며 마음이 무거워지는 걸 반복해서 느꼈어요.',
    interpretation: '일요일 저녁에 다음 주를 미리 걱정하는 반복 패턴이 있다.',
    status: 'confirmed',
    createdAt: '2026-09-03T23:02:00+09:00',
    sourceLabel: '하루 기록',
  },
];

// 거절된 항목 — 자산으로 노출하지 않고 재사용 차단 목적으로만 유지
export const rejectedItems: RejectedItem[] = [
  {
    id: 'r1',
    category: 'pattern',
    source: '주말에 약속이 없으면 집에만 있는 편이에요.',
    rejectedInterpretation: '대인관계를 회피하는 성향이다.',
    rejectedAt: '2026-09-06T18:30:00+09:00',
  },
];