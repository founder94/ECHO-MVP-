/** 첫 대화 진입 — 대표 「추가 효과 배치」 §2 확정 문구(두 마디 = 두 줄). */
export const connectedCopy = {
  brand: "ECHO",
  operator: "by DOIT COMPANY",
  hook: ["서로의 선택이,", "하나의 대화로."],
  desc: "두 분 모두 연결을 선택했어요.",
  start: "첫 대화 시작하기",
  notRun: "시안에서는 대화가 실행되지 않아요.",
  stageLabel: "두 사람을 잇는 빛의 통로 장면(장식)",
  fallback: "",
  states: {
    recommending: { title: "추천을 살펴보는 중이에요", body: "추천은 시작일 뿐, 선택은 당신의 몫이에요." },
    awaiting_other: { title: "상대의 선택을 기다리고 있어요", body: "두 사람이 서로 선택했을 때만 연결이 시작돼요." },
    error: { title: "연결 상태를 확인하지 못했어요", body: "잠시 후 다시 확인해 주세요. 확인되기 전에는 연결로 표시하지 않아요." },
    unknown: { title: "연결 상태를 확인할 수 없어요", body: "이 시안은 서버에 연결되어 있지 않아요. 확인된 연결만 이 화면에 표시돼요." },
  },
  back: "ECHO 소개로",
  preview: {
    badge: "검토용 미리보기 · 서버 연결 없음 — 실제 연결이 아니에요",
    label: "검토할 상태",
    options: [
      { key: "mutual", label: "서로 선택 확인됨" },
      { key: "waiting", label: "상대 응답 대기" },
      { key: "recommending", label: "추천 중" },
      { key: "error", label: "연결 오류" },
    ],
    reset: "첫 진입 기록 지우기",
    played: "이 연결은 이미 한 번 봤어요 — 움직임 없이 표시",
    first: "이 연결의 첫 진입 — 장면이 움직여요",
  },
} as const;
