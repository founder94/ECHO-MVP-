import type { AdminData } from "../hooks/useAdminData";
import { PanelTitle, StateNotice, Pill, fmtDate, maskEmail } from "../components/ui";

// 본인·프로필 확인 상태 (profiles.verification_status 기준)
export default function ProfileVerify({ data }: { data: AdminData }) {
  const { profiles } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PanelTitle>본인·프로필 확인 상태</PanelTitle>
        <span className="text-sm text-foreground-500">
          확인 미완료 {profiles.unverified ?? "—"}명
        </span>
      </div>

      {profiles.status === "loading" ? (
        <StateNotice status="loading" />
      ) : profiles.status === "error" ? (
        <StateNotice status="error" note="profiles 조회 실패" />
      ) : profiles.recent.length === 0 ? (
        <StateNotice status="empty" />
      ) : (
        <div className="flex flex-col gap-2">
          {profiles.recent.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground-900">
                  {p.nickname || "—"}
                </p>
                <p className="truncate text-xs text-foreground-500">
                  {maskEmail(p.email)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {p.verification_status === "verified" ? (
                  <Pill tone="accent">확인 완료</Pill>
                ) : (
                  <Pill tone="secondary">{p.verification_status || "미확인"}</Pill>
                )}
                <span className="whitespace-nowrap text-xs text-foreground-500">
                  {fmtDate(p.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}