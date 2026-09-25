import type { AdminData } from "../hooks/useAdminData";
import { PanelTitle, StateNotice, Pill, fmtDate } from "../components/ui";

// 공간·방·참여자 (spaces 실조회 + space_members RLS 차단)
export default function Spaces({ data }: { data: AdminData }) {
  const { spaces, spaceMembers } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PanelTitle>공간</PanelTitle>
        <span className="text-sm text-foreground-500">
          전체 {spaces.total ?? "—"}개 · 진행 중 {spaces.active ?? "—"}개
        </span>
      </div>

      {spaces.status === "loading" ? (
        <StateNotice status="loading" />
      ) : spaces.status === "error" ? (
        <StateNotice status="error" note="공간 목록을 불러오지 못했어요. 새로고침해 주세요." />
      ) : spaces.recent.length === 0 ? (
        <StateNotice status="empty" />
      ) : (
        <div className="flex flex-col gap-2">
          {spaces.recent.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground-900">
                  {s.name || "이름 없음"}
                </p>
                <p className="truncate text-xs text-foreground-500">
                  목적 {s.purpose_id || "—"} · 정원 {s.max_members ?? "—"}명
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={s.status === "active" ? "accent" : "neutral"}>
                  {s.status || "—"}
                </Pill>
                {s.is_locked && <Pill tone="secondary">잠김</Pill>}
                <span className="whitespace-nowrap text-xs text-foreground-500">
                  {fmtDate(s.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <PanelTitle>방·참여자(space_members)</PanelTitle>
        <div className="mt-3">
          {spaceMembers.status === "loading" ? (
            <StateNotice status="loading" />
          ) : spaceMembers.status === "blocked" ? (
            <StateNotice
              status="blocked"
              note="방 참여자 기능은 아직 만들지 않았어요."
            />
          ) : spaceMembers.status === "error" ? (
            <StateNotice status="error" note="방 참여자를 불러오지 못했어요. 새로고침해 주세요." />
          ) : (
            <StateNotice status="empty" />
          )}
        </div>
      </div>
    </div>
  );
}