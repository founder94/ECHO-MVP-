import type { AdminData } from "../hooks/useAdminData";
import { PanelTitle, StateNotice, Pill, EmptyRow, fmtDate, maskEmail } from "../components/ui";

export default function Users({ data }: { data: AdminData }) {
  const { profiles } = data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PanelTitle>사용자·프로필</PanelTitle>
        <span className="text-sm text-foreground-500">
          전체 {profiles.total ?? "—"}명 · 오늘 신규 {profiles.today ?? "—"}명
        </span>
      </div>

      {profiles.status === "loading" ? (
        <StateNotice status="loading" />
      ) : profiles.status === "error" ? (
        <StateNotice status="error" note="사용자 정보를 불러오지 못했어요. 새로고침해 주세요." />
      ) : profiles.recent.length === 0 ? (
        <StateNotice status="empty" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-background-200 bg-background-100 text-xs text-foreground-500">
              <tr>
                <th className="px-4 py-3 font-medium">닉네임</th>
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">권한</th>
                <th className="px-4 py-3 font-medium">등급</th>
                <th className="px-4 py-3 font-medium">본인 확인</th>
                <th className="px-4 py-3 font-medium">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-background-100">
              {profiles.recent.map((p) => (
                <tr key={p.id} className="text-foreground-800">
                  <td className="px-4 py-3 font-medium text-foreground-900">
                    {p.nickname || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-600">
                    {maskEmail(p.email)}
                  </td>
                  <td className="px-4 py-3">
                    {p.role === "admin" ? (
                      <Pill tone="primary">관리자</Pill>
                    ) : (
                      <Pill tone="neutral">사용자</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.grade || "—"}</td>
                  <td className="px-4 py-3">
                    {p.verification_status === "verified" ? (
                      <Pill tone="accent">확인 완료</Pill>
                    ) : (
                      <Pill tone="secondary">{p.verification_status || "미확인"}</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground-500">
                    {fmtDate(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profiles.recent.length === 0 && <EmptyRow>데이터 없음</EmptyRow>}
        </div>
      )}
    </div>
  );
}