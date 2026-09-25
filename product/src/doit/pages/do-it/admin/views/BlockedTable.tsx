import type { MenuMeta } from "../meta";
import type { TableState } from "../hooks/useAdminData";
import { PanelTitle, StateNotice } from "../components/ui";

// 관리자 SELECT 정책이 없는 테이블을 정직하게 표시한다.
// RLS를 풀거나 서비스 역할 키로 우회하지 않고 '권한 오류'로 표시.
export default function BlockedTable({
  menu,
  state,
}: {
  menu: MenuMeta;
  state: TableState;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PanelTitle>{menu.label}</PanelTitle>

      {state.status === "loading" ? (
        <StateNotice status="loading" />
      ) : state.status === "blocked" ? (
        <StateNotice
          status="blocked"
          note="기록은 있지만 관리자가 볼 권한이 아직 없어요. 권한 추가는 대표 승인 뒤에 해요."
        />
      ) : state.status === "missing" ? (
        <StateNotice
          status="missing"
          note="이 기능은 아직 만들지 않았어요. 만들지는 대표가 정해요."
        />
      ) : state.status === "error" ? (
        <StateNotice status="error" note="불러오지 못했어요. 새로고침해 주세요." />
      ) : state.status === "empty" ? (
        <StateNotice status="empty" />
      ) : (
        <div className="rounded-lg border border-background-200 bg-background-50 px-4 py-4">
          <p className="text-sm text-foreground-800">
            전체 <span className="font-semibold tabular">{state.total ?? 0}</span>건
          </p>
        </div>
      )}

      <p className="text-xs text-foreground-500">
        {state.status === "missing"
          ? "아직 만들지 않은 기능이라 기록이 없어요. 0건으로 꾸며 보여 주지 않아요."
          : "관리자가 보려면 권한을 따로 추가해야 해요. 대표 승인 없이 권한을 풀지 않아요."}
      </p>
    </div>
  );
}