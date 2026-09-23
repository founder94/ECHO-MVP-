import type { AdminData, AdminFeatureItem, DataStatus } from '../hooks/useAdminData';
import { StatCard, PanelTitle, StateNotice, Pill, fmtDate } from '../components/ui';

const PERIOD_LABEL: Record<AdminData['period']['key'], string> = {
  today: '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
};

const FEATURE_LABEL: Record<AdminFeatureItem['status'], string> = {
  ok: '연결됨',
  empty: '연결됨',
  error: '오류',
  unavailable: '증거 없음',
  needs_check: '운영 점검',
  review_pending: '심사 중',
  not_run: '미실행',
};

const FEATURE_TONE: Record<AdminFeatureItem['status'], 'ok' | 'progress' | 'needs_check' | 'failed'> = {
  ok: 'ok',
  empty: 'ok',
  error: 'failed',
  unavailable: 'needs_check',
  needs_check: 'needs_check',
  review_pending: 'progress',
  not_run: 'needs_check',
};

function canShow(status: DataStatus): boolean {
  return status === 'success' || status === 'empty';
}

function FeatureRow({ feature }: { feature: AdminFeatureItem }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-background-200 bg-background-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground-900">{feature.label}</p>
        {feature.detail && <p className="text-xs text-foreground-500">{feature.detail}</p>}
        {feature.evidenceAt && (
          <p className="mt-0.5 text-[11px] text-foreground-400">최근 확인 {fmtDate(feature.evidenceAt)}</p>
        )}
      </div>
      <Pill tone={FEATURE_TONE[feature.status]}>{FEATURE_LABEL[feature.status]}</Pill>
    </div>
  );
}

export default function Dashboard({ data }: { data: AdminData }) {
  const periodLabel = PERIOD_LABEL[data.period.key];
  const attentionFeatures = data.features.items.filter(
    (feature) => feature.status !== 'ok' && feature.status !== 'empty',
  );
  // 심사 대기와 아직 실행하지 않은 검사는 서비스 오류로 세지 않는다.
  const problemCount = data.features.items.filter(
    (feature) => feature.status === 'error'
      || feature.status === 'needs_check'
      || feature.status === 'unavailable',
  ).length;
  const problemStatus: DataStatus = data.features.status === 'loading'
    ? 'loading'
    : data.features.status === 'blocked' || data.features.status === 'error'
      ? data.features.status
      : data.features.status === 'unavailable'
        ? 'unavailable'
        : problemCount === 0
          ? 'empty'
          : 'needs_check';

  let summaryText = '급히 확인할 운영 문제가 없습니다.';
  if (!canShow(data.operations.status)) {
    summaryText = '운영 기록을 확인할 수 없습니다.';
  } else if ((data.operations.reportsOpen ?? 0) > 0) {
    summaryText = `처리할 사용자 신고가 ${data.operations.reportsOpen}건 있습니다.`;
  } else if ((data.doIt.requestErrors ?? 0) > 0) {
    summaryText = `DO IT 요청 오류가 ${data.doIt.requestErrors}건 있습니다.`;
  } else if (problemCount > 0) {
    summaryText = `기능 확인이 필요한 항목이 ${problemCount}건 있습니다.`;
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <PanelTitle>지금 확인할 일</PanelTitle>
        <div className="mt-3 flex flex-col gap-2">
          {data.features.status === 'loading' ? (
            <StateNotice status="loading" />
          ) : data.features.status !== 'success' ? (
            <StateNotice
              status={data.features.status}
              note={data.features.status === 'empty'
                ? '서버가 돌려준 기능 확인 항목이 실제 0건입니다.'
                : '기능 확인 자료를 불러오지 못했습니다.'}
            />
          ) : attentionFeatures.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3">
              <p className="text-sm text-foreground-900">지금 바로 확인할 기능 항목이 없습니다.</p>
              <Pill tone="ok">확인됨</Pill>
            </div>
          ) : (
            attentionFeatures.map((feature) => <FeatureRow key={feature.id} feature={feature} />)
          )}
        </div>
      </section>

      <section>
        <PanelTitle>{periodLabel} 한눈에</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            label={`${periodLabel} 신규 사용자`}
            status={data.users.status}
            value={data.users.periodNew}
            unit="명"
          />
          <StatCard
            label="시작한 대화"
            status={data.echo.status}
            value={data.echo.started}
            unit="건"
            note="사람 수가 아닌 대화 수입니다."
          />
          <StatCard
            label="7단계까지 마친 대화"
            status={data.echo.status}
            value={data.echo.step7Completed}
            unit="건"
          />
          <StatCard
            label="White Door 안내 가능"
            status={data.echo.status}
            value={data.echo.whiteDoorReached}
            unit="건"
            note="7단계 답변 저장 기준이며, 실제 방문 수는 아닙니다."
          />
          <StatCard
            label="유효 결제 완료"
            status={data.payments.status}
            value={data.payments.periodPaid}
          />
          <StatCard label="오류·점검 항목" status={problemStatus} value={problemCount} />
        </div>
        <p className="mt-2 text-xs text-foreground-500">{summaryText}</p>
      </section>

      <section>
        <PanelTitle>ECHO 대화는 어디까지 진행됐나요?</PanelTitle>
        <p className="mt-1 text-xs text-foreground-500">
          시작·완료는 선택 기간의 기록이고, 아래 숫자는 지금 각 단계에 있는 대화 수입니다.
        </p>
        <div className="mt-3">
          {!canShow(data.echo.status) ? (
            <StateNotice status={data.echo.status} note="ECHO 진행 자료를 확인할 수 없습니다." />
          ) : data.echo.currentByStep.length === 0 ? (
            <StateNotice
              status="unavailable"
              note="현재 단계별 대화 수를 서버에서 받지 못했습니다."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {data.echo.currentByStep.map((item) => (
                <StatCard
                  key={item.step}
                  label={`현재 STEP ${item.step}`}
                  status={item.count === 0 ? 'empty' : 'success'}
                  value={item.count}
                  unit="건"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <PanelTitle>DO IT 진행 현황</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="저장된 기록" status={data.doIt.status} value={data.doIt.records} />
          <StatCard label="만든 인사이트" status={data.doIt.status} value={data.doIt.insights} />
          <StatCard label="전달한 결과" status={data.doIt.status} value={data.doIt.handoffs} />
          <StatCard label="요청 오류" status={data.doIt.status} value={data.doIt.requestErrors} />
          <StatCard label="연결 목적" status={data.doIt.status} value={data.doIt.purposes} />
          <StatCard label="공간" status={data.doIt.status} value={data.doIt.spaces} />
        </div>
        {canShow(data.doIt.status) && data.doIt.routeTelemetry === 'not_collected' && (
          <p className="mt-2 text-xs text-foreground-500">
            화면별 도달 수는 아직 측정하지 않습니다. 위 숫자는 서버에 실제 저장된 자료입니다.
          </p>
        )}
      </section>

      <section>
        <PanelTitle>기능 연결 상태</PanelTitle>
        <div className="mt-3 flex flex-col gap-2">
          {data.features.status === 'loading' ? (
            <StateNotice status="loading" />
          ) : data.features.status !== 'success' ? (
            <StateNotice status={data.features.status} note="기능 확인 자료를 확인할 수 없습니다." />
          ) : (
            data.features.items.map((feature) => <FeatureRow key={feature.id} feature={feature} />)
          )}
        </div>
      </section>

      <section>
        <PanelTitle>최근 운영 활동 기록</PanelTitle>
        <div className="mt-3">
          {!canShow(data.operations.status) ? (
            <StateNotice status={data.operations.status} note="운영 활동 기록을 확인할 수 없습니다." />
          ) : data.operations.auditRecent.length === 0 && data.operations.auditRecords === 0 ? (
            <StateNotice status="empty" note="운영 활동 기록이 실제 0건입니다." />
          ) : data.operations.auditRecent.length === 0 ? (
            <StateNotice status="unavailable" note="최근 운영 활동 목록을 서버에서 받지 못했습니다." />
          ) : (
            <div className="flex flex-col gap-2">
              {data.operations.auditRecent.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-background-200 bg-background-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground-900">운영 활동</p>
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
    </div>
  );
}
