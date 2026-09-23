import type { AdminData, DataStatus } from '../hooks/useAdminData';
import { PanelTitle, StateNotice, Pill, StatCard, fmtDate } from '../components/ui';

const PERIOD_LABEL: Record<AdminData['period']['key'], string> = {
  today: '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
};

function canShow(status: DataStatus): boolean {
  return status === 'success' || status === 'empty';
}

function paymentStatusLabel(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'paid':
    case 'done':
    case 'completed':
    case 'approved':
      return '결제 완료';
    case 'refunded':
    case 'canceled':
    case 'cancelled':
      return '취소·환불';
    default:
      return '상태 확인';
  }
}

function formatWon(amount: number | null): string {
  return amount === null ? '—' : `${amount.toLocaleString('ko-KR')}원`;
}

export default function Payments({ data }: { data: AdminData }) {
  const { payments } = data;
  const periodLabel = PERIOD_LABEL[data.period.key];
  const reviewPending = payments.paymentMode === 'review_pending';

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>결제 이용 상태</PanelTitle>
          {reviewPending ? (
            <Pill tone="progress">심사 중</Pill>
          ) : payments.paymentMode === 'enabled' && payments.purchaseAvailable === true ? (
            <Pill tone="ok">이용 가능</Pill>
          ) : (
            <Pill tone="needs_check">확인 불가</Pill>
          )}
        </div>

        {reviewPending ? (
          <div className="mt-3 rounded-lg border border-background-200 bg-background-50 px-4 py-4">
            <p className="text-sm font-medium text-foreground-900">토스페이먼츠 심사가 진행 중입니다.</p>
            <p className="mt-1 text-xs text-foreground-500">
              지금은 새 결제를 받지 않습니다. 아래에는 서버가 유효하다고 확인한 결제만 표시합니다.
            </p>
          </div>
        ) : payments.paymentMode === 'unavailable' ? (
          <div className="mt-3">
            <StateNotice status="unavailable" note="현재 결제 이용 상태를 확인할 수 없습니다." />
          </div>
        ) : null}
      </section>

      <section>
        <PanelTitle>유효 결제 완료</PanelTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard
            label={`${periodLabel} 결제`}
            status={payments.status}
            value={payments.periodPaid}
          />
          <StatCard label="전체 결제" status={payments.status} value={payments.lifetimePaid} />
        </div>
      </section>

      <section>
        <PanelTitle>최근 유효 결제</PanelTitle>
        <div className="mt-3">
          {!canShow(payments.status) ? (
            <StateNotice status={payments.status} note="결제 완료 자료를 확인할 수 없습니다." />
          ) : payments.recent.length === 0 && payments.periodPaid === 0 ? (
            <StateNotice status="empty" note={`${periodLabel} 유효 결제 완료가 실제 0건입니다.`} />
          ) : payments.recent.length === 0 ? (
            <StateNotice status="unavailable" note="최근 결제 목록을 서버에서 받지 못했습니다." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-background-200 bg-background-100 text-xs text-foreground-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">결제 번호</th>
                    <th className="px-4 py-3 font-medium">금액</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">승인 시각</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-100">
                  {payments.recent.map((payment, index) => (
                    <tr
                      key={`${payment.orderIdMasked ?? 'payment'}-${payment.approvedAt ?? index}`}
                      className="text-foreground-800"
                    >
                      <td className="px-4 py-3 font-medium text-foreground-900">
                        {payment.orderIdMasked ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatWon(payment.amount)}</td>
                      <td className="px-4 py-3">
                        <Pill tone={paymentStatusLabel(payment.status) === '결제 완료' ? 'ok' : 'neutral'}>
                          {paymentStatusLabel(payment.status)}
                        </Pill>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-foreground-500">
                        {fmtDate(payment.approvedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
