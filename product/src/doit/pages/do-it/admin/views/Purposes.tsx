import type { AdminData } from "../hooks/useAdminData";
import { PanelTitle, StateNotice, Pill, EmptyRow } from "../components/ui";

// 연결 목적 (purposes)
export default function Purposes({ data }: { data: AdminData }) {
  const { purposes } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PanelTitle>연결 목적</PanelTitle>
        <span className="text-sm text-foreground-500">
          전체 {purposes.total ?? "—"}개
        </span>
      </div>

      {purposes.status === "loading" ? (
        <StateNotice status="loading" />
      ) : purposes.status === "error" ? (
        <StateNotice status="error" note="purposes 조회 실패" />
      ) : purposes.list.length === 0 ? (
        <StateNotice status="empty" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-background-200 bg-background-100 text-xs text-foreground-500">
              <tr>
                <th className="px-4 py-3 font-medium">목적</th>
                <th className="px-4 py-3 font-medium">설명</th>
                <th className="px-4 py-3 font-medium">정렬</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-background-100">
              {purposes.list.map((p) => (
                <tr key={p.id} className="text-foreground-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.icon && (
                        <i className={`${p.icon} text-base text-foreground-600`} />
                      )}
                      <span className="font-medium text-foreground-900">
                        {p.label || p.id}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground-600">
                    {p.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone="neutral">{p.sort_order ?? "—"}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {purposes.list.length === 0 && <EmptyRow>데이터 없음</EmptyRow>}
        </div>
      )}
    </div>
  );
}