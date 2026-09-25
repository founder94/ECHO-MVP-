import type { AdminData } from '../hooks/useAdminData';
import { PanelTitle, StateNotice, StatCard } from '../components/ui';

// 이 화면을 다시 연결해도 저장된 수치만 보이도록 유지한다.
export default function Journey({ data }: { data: AdminData }) {
  const echoReady = data.echo.status === 'success' || data.echo.status === 'empty';

  return (
    <div className="flex flex-col gap-6">
      <section>
        <PanelTitle>현재 단계별 ECHO 대화</PanelTitle>
        <div className="mt-3">
          {!echoReady ? (
            <StateNotice status={data.echo.status} note="ECHO 진행 자료를 확인할 수 없습니다." />
          ) : data.echo.currentByStep.length === 0 ? (
            <StateNotice status="unavailable" note="현재 단계별 대화 수를 서버에서 받지 못했습니다." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {data.echo.currentByStep.map((item) => (
                <StatCard
                  key={item.step}
                  label={`현재 STEP ${item.step}`}
                  status={item.count === 0 ? 'empty' : 'success'}
                  value={item.count}
                  unit="개"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <PanelTitle>DO IT 저장 현황</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="저장된 기록" status={data.doIt.status} value={data.doIt.records} />
          <StatCard label="만든 인사이트" status={data.doIt.status} value={data.doIt.insights} />
          <StatCard label="전달한 결과" status={data.doIt.status} value={data.doIt.handoffs} />
          <StatCard label="요청 오류" status={data.doIt.status} value={data.doIt.requestErrors} />
          <StatCard label="연결 목적" status={data.doIt.status} value={data.doIt.purposes} />
          <StatCard label="공간" status={data.doIt.status} value={data.doIt.spaces} />
        </div>
        {(data.doIt.status === 'success' || data.doIt.status === 'empty')
          && data.doIt.routeTelemetry === 'not_collected' && (
          <p className="mt-2 text-xs text-foreground-500">
            화면별 도달 수는 아직 측정하지 않습니다. 위 숫자는 서버에 실제 저장된 자료입니다.
          </p>
        )}
      </section>
    </div>
  );
}
