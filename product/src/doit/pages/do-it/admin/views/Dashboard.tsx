import type { AdminData } from "../hooks/useAdminData";
import type { AnalyticsData } from "../hooks/useAnalytics";
import { StatCard, PanelTitle, StateNotice, fmtDate } from "../components/ui";
import AnalyticsSection from "./AnalyticsSection";
import FeatureChecklist from "./FeatureChecklist";

export default function Dashboard({
  data,
  analytics,
}: {
  data: AdminData;
  analytics: AnalyticsData;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* 대표 2026-09-25: 맨 위에 기능별 상태 점검표 */}
      <FeatureChecklist consents={data.consents.total} />

      {/* 분석 (운영 대시보드 본문 상단 통합) */}
      <AnalyticsSection data={analytics} />

      {/* 핵심 지표 */}
      <section>
        <PanelTitle>핵심 지표</PanelTitle>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="전체 사용자"
            status={data.profiles.status}
            value={data.profiles.total ?? "—"}
            sub={`오늘 신규 ${data.profiles.today ?? "—"}명`}
            accent
          />
          <StatCard
            label="오늘 신규 사용자"
            status={data.profiles.status}
            value={data.profiles.today ?? "—"}
          />
          <StatCard
            label="확인 필요한 프로필"
            status={data.profiles.status}
            value={data.profiles.unverified ?? "—"}
            sub="본인 인증 미완료"
          />
          <StatCard
            label="공간(진행 중)"
            status={data.spaces.status}
            value={data.spaces.active ?? "—"}
            sub={`전체 ${data.spaces.total ?? "—"}개`}
          />
          <StatCard
            label="신고"
            status={data.reports.status}
            value={data.reports.total ?? "—"}
          />
          <StatCard
            label="차단"
            status={data.blocks.status}
            value={data.blocks.total ?? "—"}
          />
          <StatCard
            label="운영 감사 기록"
            status={data.auditLogs.status}
            value={data.auditLogs.total ?? "—"}
          />
          <StatCard
            label="연결 목적"
            status={data.purposes.status}
            value={data.purposes.total ?? "—"}
            sub="등록된 목적 수"
          />
        </div>
      </section>

      {/* 대표 2026-09-25 「초보 대표가 이해하기 쉽게」: 영어 표 이름·RLS 같은 말 대신 지금 상태를 한 줄로. */}
      <section>
        <PanelTitle>아직 없거나 볼 수 없는 것</PanelTitle>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="동의 기록"
            status={data.consents.status}
            value={data.consents.total ?? "—"}
            sub="지금 약관에 동의한 사람 수(가입할 때 저장)"
            note="프로필을 읽지 못했어요. 새로고침해 주세요."
          />
          <StatCard
            label="KEY 보유 현황"
            status={data.keyBalances.status}
            value={data.keyBalances.total ?? "—"}
            note="기록은 있지만 관리자가 볼 권한이 아직 없어요. 권한 추가는 대표 승인 뒤에 해요."
          />
          <StatCard
            label="KEY 주문·결제"
            status={data.keyOrders.status}
            value={data.keyOrders.total ?? "—"}
            note="아직 만들지 않은 기능이에요. 지금 결제는 토스 4,900원 단건만 있어요."
          />
          <StatCard
            label="사주·타로 기록"
            status={data.sajuTaro.status}
            value={data.sajuTaro.total ?? "—"}
            note="무료 재미 콘텐츠라 기록을 남기지 않아요. 정상이에요."
          />
          <StatCard
            label="AI 요청 제한"
            status={data.aiRateLimits.status}
            value={data.aiRateLimits.total ?? "—"}
            note="AI를 너무 자주 부르지 못하게 막는 내부 장치예요. 관리자 화면에서 볼 필요는 없어요."
          />
          <StatCard
            label="협동 활동 · 사용자 선택 · 방 참여자"
            status={[data.missions.status, data.selections.status, data.spaceMembers.status].every((x) => x === "missing") ? "missing" : data.spaceMembers.status}
            value={data.spaceMembers.total ?? "—"}
            note="공간(방) 안에서 함께 하는 기능은 아직 만들지 않았어요."
          />
        </div>
      </section>

      {/* 최근 활동 */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <PanelTitle>최근 가입자</PanelTitle>
          <div className="mt-3 flex flex-col gap-2">
            {data.profiles.status === "loading" ? (
              <StateNotice status="loading" />
            ) : data.profiles.status === "error" ? (
              <StateNotice status="error" note="사용자 정보를 불러오지 못했어요. 새로고침해 주세요." />
            ) : data.profiles.recent.length === 0 ? (
              <StateNotice status="empty" />
            ) : (
              data.profiles.recent.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground-900">
                      {p.nickname || p.email || "—"}
                    </p>
                    <p className="truncate text-xs text-foreground-500">
                      {p.email || "이메일 없음"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-foreground-500">
                    {new Date(p.created_at ?? "").toLocaleDateString("ko-KR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <PanelTitle>최근 운영 기록</PanelTitle>
          <div className="mt-3 flex flex-col gap-2">
            {data.auditLogs.status === "loading" ? (
              <StateNotice status="loading" />
            ) : data.auditLogs.status === "error" ? (
              <StateNotice status="error" note="운영 감사 기록을 불러오지 못했어요. 새로고침해 주세요." />
            ) : data.auditLogs.recent.length === 0 ? (
              <StateNotice status="empty" />
            ) : (
              data.auditLogs.recent.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
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
              ))
            )}
          </div>
        </div>
      </section>

      {/* 최근 공간 + 최근 신고 */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <PanelTitle>최근 공간</PanelTitle>
          <div className="mt-3 flex flex-col gap-2">
            {data.spaces.status === "loading" ? (
              <StateNotice status="loading" />
            ) : data.spaces.status === "error" ? (
              <StateNotice status="error" note="공간 목록을 불러오지 못했어요. 새로고침해 주세요." />
            ) : data.spaces.recent.length === 0 ? (
              <StateNotice status="empty" />
            ) : (
              data.spaces.recent.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground-900">
                      {s.name || "이름 없음"}
                    </p>
                    <p className="truncate text-xs text-foreground-500">
                      {s.status || "—"} · 정원 {s.max_members ?? "—"}명
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-foreground-500">
                    {fmtDate(s.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <PanelTitle>최근 신고</PanelTitle>
          <div className="mt-3 flex flex-col gap-2">
            {data.reports.status === "loading" ? (
              <StateNotice status="loading" />
            ) : data.reports.status === "error" ? (
              <StateNotice status="error" note="신고 기록을 불러오지 못했어요. 새로고침해 주세요." />
            ) : data.reports.recent.length === 0 ? (
              <StateNotice status="empty" />
            ) : (
              data.reports.recent.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground-900">
                      {r.reason || "사유 없음"}
                    </p>
                    <p className="truncate text-xs text-foreground-500">
                      {r.status || "—"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-foreground-500">
                    {fmtDate(r.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}