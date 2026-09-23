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
          note={`${menu.table} 테이블은 관리자 SELECT 정책이 없어 관리자 전체 조회가 차단됩니다.`}
        />
      ) : state.status === "missing" ? (
        <StateNotice
          status="missing"
          note={`${menu.table} 테이블이 아직 생성되지 않았습니다 (미구현).`}
        />
      ) : state.status === "error" ? (
        <StateNotice status="error" note={`${menu.table} 조회 실패`} />
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
          ? "아직 만들어지지 않은 테이블입니다. 실제 구현 전에는 데이터가 존재하지 않으며, 가짜 0건으로 표시하지 않습니다."
          : "관리자 조회 전용 RLS 정책이 필요한 테이블입니다. RLS를 임의로 변경하거나 프론트에서 서비스 역할 키로 우회하지 않고, 권한 오류로 표시합니다."}
      </p>
    </div>
  );
}