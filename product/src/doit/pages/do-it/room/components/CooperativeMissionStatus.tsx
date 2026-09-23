import { useMemo } from "react";
import Card from "@/doit/components/base/Card";
import Badge from "@/doit/components/base/Badge";
import {
  isAFeatureEnabled,
} from "@/doit/featureFlags";
import {
  deriveUIState,
  type MissionRefined,
  type MissionUIState,
} from "@/doit/lib/missionStateMachine";

// A구조 협동 미션 6·4·2 상태 표시 컴포넌트.
// - 서버 정제 응답(refined)만 받아 표시용 상태를 파생한다.
// - waitingForPartner / completed / 보상 은 프론트에서 만들지 않는다.
// - 기능 플래그가 꺼져 있으면 "아직 서버에 연결되지 않음"만 보여준다.

interface CooperativeMissionStatusProps {
  refined: MissionRefined | null;
  submitting?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const STATE_COPY: Record<
  MissionUIState,
  { icon: string; title: string; body: string; tone: "accent" | "secondary" | "neutral" }
> = {
  preparing: {
    icon: "ri-loader-4-line",
    title: "미션 준비 중",
    body: "서버가 미션과 상대방을 준비하고 있어요.",
    tone: "neutral",
  },
  waiting_partner: {
    icon: "ri-user-search-line",
    title: "상대방 답변을 기다리는 중",
    body: "내 답변은 안전하게 보관됐어요. 상대가 제출하면 다음 단계로 넘어가요.",
    tone: "secondary",
  },
  writing: {
    icon: "ri-edit-line",
    title: "내 답변 작성",
    body: "이 단계의 답변을 적어 제출해 주세요.",
    tone: "accent",
  },
  submitting: {
    icon: "ri-loader-4-line",
    title: "제출 중",
    body: "서버에 답변을 보내는 중이에요. 잠시만 기다려 주세요.",
    tone: "neutral",
  },
  awaiting_review: {
    icon: "ri-shield-check-line",
    title: "서버 검토 중",
    body: "두 답변이 모두 모였어요. 서버가 검토하고 있어요.",
    tone: "secondary",
  },
  completed: {
    icon: "ri-check-double-line",
    title: "완료",
    body: "이 단계가 서버에서 정상 완료됐어요.",
    tone: "accent",
  },
  partner_exit: {
    icon: "ri-user-unfollow-line",
    title: "상대방이 나갔어요",
    body: "상대방이 미션을 종료했어요. 다음 안내를 확인해 주세요.",
    tone: "neutral",
  },
  expired: {
    icon: "ri-time-line",
    title: "시간이 만료됐어요",
    body: "72시간이 지나 이 미션이 종료됐어요.",
    tone: "neutral",
  },
  error_retry: {
    icon: "ri-restart-line",
    title: "잠시 문제가 있었어요",
    body: "서버 상태를 다시 확인하고 재시도해 주세요.",
    tone: "neutral",
  },
};

export default function CooperativeMissionStatus({
  refined,
  submitting = false,
  error = null,
  onRetry,
}: CooperativeMissionStatusProps) {
  const enabled = isAFeatureEnabled("cooperativeMission");

  const uiState: MissionUIState = useMemo(() => {
    if (!enabled || !refined) return "preparing";
    if (submitting) return "submitting";
    if (error) return "error_retry";
    return deriveUIState(refined);
  }, [enabled, refined, submitting, error]);

  if (!enabled) {
    return (
      <Card padding="md" className="mb-4 border-background-200 bg-background-50">
        <div className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground-400">
            <i className="ri-plug-line text-sm" />
          </span>
          <p className="text-xs leading-relaxed text-foreground-500">
            협동 미션은 아직 서버에 연결되지 않았어요.
          </p>
        </div>
      </Card>
    );
  }

  const copy = STATE_COPY[uiState];

  return (
    <Card padding="md" className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-100 text-secondary-900">
          <i className={`${copy.icon} text-sm`} />
        </span>
        <Badge tone={copy.tone}>{refined?.stage ?? "6"} 단계</Badge>
      </div>
      <h3 className="font-heading text-base font-semibold text-foreground-950">
        {copy.title}
      </h3>
      <p className="mt-1 text-sm text-foreground-600">{copy.body}</p>

      {error && (
        <p className="mt-2 rounded-lg bg-background-100 px-3 py-2 text-xs text-foreground-600">
          {error}
        </p>
      )}

      {uiState === "error_retry" && onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary-100 px-3 py-1.5 text-xs font-medium text-secondary-900 transition-colors hover:bg-secondary-200"
        >
          <i className="ri-restart-line text-sm" />
          다시 확인하기
        </button>
      )}
    </Card>
  );
}