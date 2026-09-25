import type { AdminData } from "../hooks/useAdminData";
import { PanelTitle, StateNotice, fmtDate } from "../components/ui";

// 운영 감사 기록 (audit_logs, 관리자 SELECT 정책 있음)
export default function AuditLogs({ data }: { data: AdminData }) {
  const { auditLogs } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PanelTitle>운영 감사 기록</PanelTitle>
        <span className="text-sm text-foreground-500">전체 {auditLogs.total ?? "—"}건</span>
      </div>
      {auditLogs.status === "loading" ? (
        <StateNotice status="loading" />
      ) : auditLogs.status === "error" ? (
        <StateNotice status="error" note="운영 감사 기록을 불러오지 못했어요. 새로고침해 주세요." />
      ) : auditLogs.recent.length === 0 ? (
        <StateNotice status="empty" />
      ) : (
        <div className="flex flex-col gap-2">
          {auditLogs.recent.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-1 rounded-lg border border-background-200 bg-background-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground-900">
                  {log.action || "활동"}
                </p>
                <p className="truncate text-xs text-foreground-500">
                  {log.user_id ?? "익명"}
                </p>
              </div>
              <span className="whitespace-nowrap text-xs text-foreground-500">
                {fmtDate(log.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}