import { PanelTitle } from "../components/ui";
import type { AnalyticsData, AnalyticsStatus } from "../hooks/useAnalytics";

// 수집 기능 미적용 안내 (공용)
function NotAppliedNotice() {
  return (
    <div className="rounded-lg border border-secondary-300 bg-secondary-50 px-4 py-4">
      <div className="flex items-center gap-2 text-secondary-900">
        <i className="ri-cloud-off-line text-lg" />
        <span className="text-sm font-semibold">방문 통계는 아직 꺼져 있어요</span>
      </div>
      <p className="mt-1 text-xs text-foreground-600">
        방문자 수·기기·이동 경로를 모으는 기능을 아직 켜지 않았어요. 켜려면 DB 준비가 필요해서 대표 승인 뒤에 해요.
      </p>
    </div>
  );
}

function PanelState({ status }: { status: AnalyticsStatus }) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 py-6 text-foreground-600">
        <i className="ri-loader-4-line animate-spin-slow text-lg" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    );
  }
  if (status === "not_applied") return <NotAppliedNotice />;
  if (status === "error") {
    return (
      <div className="rounded-lg border border-secondary-300 bg-secondary-50 px-4 py-4">
        <span className="text-sm font-semibold text-secondary-900">조회 실패</span>
      </div>
    );
  }
  if (status === "empty") {
    return (
      <div className="rounded-lg border border-background-200 bg-background-50 px-4 py-4">
        <span className="text-sm text-foreground-500">데이터 없음 (실제 0건)</span>
      </div>
    );
  }
  return null;
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-4">
      <span className="text-xs font-medium text-foreground-500">{label}</span>
      <div className="mt-2 text-2xl font-semibold tabular text-foreground-950">
        {value}
      </div>
      {sub && <p className="mt-1 text-xs text-foreground-500">{sub}</p>}
    </div>
  );
}

export default function AnalyticsSection({ data }: { data: AnalyticsData }) {
  const ready = data.status === "success" || data.status === "empty";

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle>분석 (브라우저 단위 · 한국시간)</PanelTitle>
        {data.status === "not_applied" && (
          <span className="whitespace-nowrap rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-medium text-secondary-900">
            아직 꺼져 있음
          </span>
        )}
      </div>

      {/* 요약 지표 */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ready ? (
          <>
            <Metric label="오늘 브라우저" value={data.visitors ?? 0} />
            <Metric
              label="처음 온 브라우저"
              value={data.newVisitors ?? 0}
              sub="기간 내 첫 방문"
            />
            <Metric
              label="다시 온 브라우저"
              value={data.returningVisitors ?? 0}
              sub="기간 내 재방문"
            />
            <Metric
              label="최다 클릭"
              value={data.clicks ?? 0}
              sub="클릭 이벤트 수"
            />
          </>
        ) : (
          <div className="sm:col-span-2 lg:col-span-4">
            <PanelState status={data.status} />
          </div>
        )}
      </div>

      {/* 상세 패널 */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 유입 추정 */}
        <div>
          <h4 className="text-sm font-semibold text-foreground-900">유입 추정</h4>
          <div className="mt-2 flex flex-col gap-2">
            {ready && data.referrers.length > 0 ? (
              data.referrers.slice(0, 5).map((r) => (
                <div
                  key={r.referrer}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
                >
                  <span className="truncate text-sm text-foreground-800">
                    {r.referrer}
                  </span>
                  <span className="whitespace-nowrap text-xs text-foreground-500">
                    {r.cnt}
                  </span>
                </div>
              ))
            ) : (
              <PanelState status={data.status} />
            )}
          </div>
        </div>

        {/* 화면 TOP5 */}
        <div>
          <h4 className="text-sm font-semibold text-foreground-900">화면 TOP5</h4>
          <div className="mt-2 flex flex-col gap-2">
            {ready && data.screenViews.length > 0 ? (
              data.screenViews.slice(0, 5).map((s) => (
                <div
                  key={s.screen}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
                >
                  <span className="truncate text-sm text-foreground-800">
                    {s.screen}
                  </span>
                  <span className="whitespace-nowrap text-xs text-foreground-500">
                    {s.views}
                  </span>
                </div>
              ))
            ) : (
              <PanelState status={data.status} />
            )}
          </div>
        </div>

        {/* 디바이스 */}
        <div>
          <h4 className="text-sm font-semibold text-foreground-900">디바이스</h4>
          <div className="mt-2 flex flex-col gap-2">
            {ready && data.devices.length > 0 ? (
              data.devices.slice(0, 5).map((d) => (
                <div
                  key={d.device_type}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-3 py-2"
                >
                  <span className="truncate text-sm text-foreground-800">
                    {d.device_type}
                  </span>
                  <span className="whitespace-nowrap text-xs text-foreground-500">
                    {d.cnt}
                  </span>
                </div>
              ))
            ) : (
              <PanelState status={data.status} />
            )}
          </div>
        </div>

        {/* 핵심 퍼널 (pa_analytics_v1 적용 전 → 미적용) */}
        <div>
          <h4 className="text-sm font-semibold text-foreground-900">핵심 퍼널</h4>
          <div className="mt-2">
            <PanelState
              status={data.status === "not_applied" ? "not_applied" : "empty"}
            />
          </div>
        </div>
      </div>
    </section>
  );
}