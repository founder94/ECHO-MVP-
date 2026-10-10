/**
 * 첫 대화 진입 장면의 상태 계약.
 *
 * 연결 완료 문구·연출은 「서버가 확인한」 서로 선택 상태(mutual_confirmed)에서만 보인다(대표 「추가 효과 배치」 §2).
 * 추천 중·상대 응답 대기·연결 오류·알 수 없음에서는 완료 문구도 효과도 내지 않고, 효과 엔진도 불러오지 않는다.
 *
 * 이 시안은 서버에 연결돼 있지 않다. 그래서 상태는 주소의 검토용 표시(?preview=…)로만 정하고, 표시가 없으면
 * 「확인할 수 없음」이다 — 화면 코드가 연결을 임의로 확정하지 않는다. 실제 서비스에서는 readConnectionState 를
 * 서버(연결 상태 조회) 응답으로 바꾼다. 클라이언트가 status 를 만들어 내는 경로는 두지 않는다.
 */
export type ConnectionStatus = "recommending" | "awaiting_other" | "mutual_confirmed" | "error" | "unknown";

export interface ConnectionState {
  status: ConnectionStatus;
  /** 연결 하나를 가리키는 값 — 첫 진입 재생 기록의 열쇠. mutual_confirmed 일 때만 있다. */
  connectionId?: string;
  /** 시안의 검토용 상태인지(서버 응답이 아님) — 화면에 그대로 밝힌다. */
  preview: boolean;
}

const PREVIEW: Record<string, ConnectionStatus> = {
  recommending: "recommending",
  waiting: "awaiting_other",
  mutual: "mutual_confirmed",
  error: "error",
};

export const PREVIEW_CONNECTION_ID = "preview-connection-1";

export const readConnectionState = (): ConnectionState => {
  const key = new URLSearchParams(window.location.search).get("preview") ?? "";
  const status = PREVIEW[key];
  if (!status) return { status: "unknown", preview: false };
  return status === "mutual_confirmed"
    ? { status, connectionId: PREVIEW_CONNECTION_ID, preview: true }
    : { status, preview: true };
};

/* 첫 진입에서만 재생 — 같은 연결로 다시 들어오면(뒤로가기·새로고침·재접속) 움직임 없이 완성된 한 장만. */
const playedKey = (id: string) => `echo:first-chat-intro:${id}`;

export const introAlreadyPlayed = (id: string): boolean => {
  try {
    return window.localStorage.getItem(playedKey(id)) === "1";
  } catch {
    return false; // 저장소를 못 쓰면 매번 처음처럼 — 대신 반복 기록을 남길 수 없다(보고서에 기록)
  }
};

export const markIntroPlayed = (id: string) => {
  try {
    window.localStorage.setItem(playedKey(id), "1");
  } catch {
    /* 저장 못 함 — 재생은 그대로 */
  }
};

/** 검토용: 첫 진입 기록 지우기(시안 미리보기에서만 보이는 버튼). */
export const resetIntroPlayed = (id: string) => {
  try {
    window.localStorage.removeItem(playedKey(id));
  } catch {
    /* 무시 */
  }
};
