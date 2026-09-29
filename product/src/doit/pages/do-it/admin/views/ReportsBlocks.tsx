import type { AdminData } from "../hooks/useAdminData";
import { PanelTitle, StateNotice, Pill, fmtDate } from "../components/ui";

// 신고·차단 (reports + blocks, 관리자 SELECT 정책 있음)
export default function ReportsBlocks({ data }: { data: AdminData }) {
  const { reports, blocks } = data;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <PanelTitle>신고</PanelTitle>
          <span className="text-sm text-foreground-500">전체 {reports.total ?? "—"}건</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {reports.status === "loading" ? (
            <StateNotice status="loading" />
          ) : reports.status === "error" ? (
            <StateNotice status="error" note="reports 조회 실패" />
          ) : reports.recent.length === 0 ? (
            <StateNotice status="empty" />
          ) : (
            reports.recent.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground-900">
                    {r.reason || "사유 없음"}
                  </p>
                  <Pill tone={r.status === "resolved" ? "accent" : "secondary"}>
                    {r.status || "—"}
                  </Pill>
                </div>
                {r.detail && (
                  <p className="line-clamp-2 text-xs text-foreground-600">{r.detail}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-foreground-500">
                  <span>신고자 {r.reporter_id ? r.reporter_id.slice(0, 8) : "—"}</span>
                  <span>대상 {r.target_user_id ? r.target_user_id.slice(0, 8) : "—"}</span>
                  <span>{fmtDate(r.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <PanelTitle>차단</PanelTitle>
          <span className="text-sm text-foreground-500">
            {blocks.status === "success" ? `전체 ${blocks.total ?? 0}건` : ""}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {blocks.status === "loading" ? (
            <StateNotice status="loading" />
          ) : blocks.status === "error" ? (
            <StateNotice status="error" note="blocks 조회 실패" />
          ) : blocks.recent.length === 0 ? (
            <StateNotice status="empty" />
          ) : (
            blocks.recent.map((b) => (
              <div
                key={b.id}
                className="flex flex-col gap-1 rounded-lg border border-background-200 bg-background-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground-900">
                    차단자 {b.blocker_id ? b.blocker_id.slice(0, 8) : "—"} → 대상{" "}
                    {b.blocked_user_id ? b.blocked_user_id.slice(0, 8) : "—"}
                  </p>
                  {b.reason && (
                    <p className="truncate text-xs text-foreground-500">{b.reason}</p>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-foreground-500">
                  {fmtDate(b.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}