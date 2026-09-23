import type { AdminData, DataStatus } from '../hooks/useAdminData';
import { PanelTitle, StateNotice, Pill, StatCard, fmtDate } from '../components/ui';

function canShow(status: DataStatus): boolean {
  return status === 'success' || status === 'empty';
}

function reportStatus(status: string | null): { label: string; tone: 'neutral' | 'ok' | 'needs_check' } {
  switch (status?.toLowerCase()) {
    case 'open':
    case 'pending':
      return { label: '처리 필요', tone: 'needs_check' };
    case 'closed':
    case 'resolved':
      return { label: '처리 완료', tone: 'ok' };
    default:
      return { label: '상태 확인', tone: 'neutral' };
  }
}

// 자동 오류 진단, 관리자 활동 기록, 사용자 신고를 서로 다른 자료로 표시한다.
export default function Errors({ data }: { data: AdminData }) {
  const { operations } = data;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <PanelTitle>운영 확인</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard
            label="처리할 사용자 신고"
            status={operations.status}
            value={operations.reportsOpen}
          />
          <StatCard label="차단된 관계" status={operations.status} value={operations.blocks} />
        </div>
      </section>

      <section>
        <PanelTitle>자동 오류 진단</PanelTitle>
        <div className="mt-3">
          {operations.diagnosticsStatus === 'success' ? (
            <div className="rounded-lg border border-background-200 bg-background-50 px-4 py-4 text-sm text-foreground-700">
              자동 오류 진단 자료를 확인할 수 있습니다.
            </div>
          ) : (
            <StateNotice
              status={operations.diagnosticsStatus}
              note={operations.diagnosticsStatus === 'empty'
                ? '자동 오류 진단 결과가 실제 0건입니다.'
                : '자동 오류 진단 자료는 제공되지 않습니다. 아래 운영 기록과 사용자 신고는 별도 자료입니다.'}
            />
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>관리자 활동 기록</PanelTitle>
          <span className="text-sm text-foreground-500">
            전체 기록 {operations.auditRecords?.toLocaleString('ko-KR') ?? '—'}건
          </span>
        </div>
        <div className="mt-3">
          {!canShow(operations.status) ? (
            <StateNotice status={operations.status} note="관리자 활동 기록을 확인할 수 없습니다." />
          ) : operations.auditRecent.length === 0 && operations.auditRecords === 0 ? (
            <StateNotice status="empty" note="관리자 활동 기록이 실제 0건입니다." />
          ) : operations.auditRecent.length === 0 ? (
            <StateNotice status="unavailable" note="최근 관리자 활동 목록을 서버에서 받지 못했습니다." />
          ) : (
            <div className="flex flex-col gap-2">
              {operations.auditRecent.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground-900">관리자 활동</p>
                    <p className="truncate text-xs text-foreground-500">{log.label ?? '내용 없음'}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-foreground-500">
                    {fmtDate(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>사용자 신고</PanelTitle>
          <span className="text-sm text-foreground-500">
            처리할 신고 {operations.reportsOpen?.toLocaleString('ko-KR') ?? '—'}건
          </span>
        </div>
        <div className="mt-3">
          {!canShow(operations.status) ? (
            <StateNotice status={operations.status} note="사용자 신고를 확인할 수 없습니다." />
          ) : operations.reportRecent.length === 0 && operations.reportsOpen === 0 ? (
            <StateNotice status="empty" note="처리할 사용자 신고가 실제 0건입니다." />
          ) : operations.reportRecent.length === 0 ? (
            <StateNotice status="unavailable" note="최근 사용자 신고 목록을 서버에서 받지 못했습니다." />
          ) : (
            <div className="flex flex-col gap-2">
              {operations.reportRecent.slice(0, 20).map((report) => {
                const status = reportStatus(report.status);
                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground-900">
                        {report.label ?? '신고 사유 없음'}
                      </p>
                      <p className="mt-0.5 text-xs text-foreground-500">사용자 신고</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={status.tone}>{status.label}</Pill>
                      <span className="whitespace-nowrap text-xs text-foreground-500">
                        {fmtDate(report.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
