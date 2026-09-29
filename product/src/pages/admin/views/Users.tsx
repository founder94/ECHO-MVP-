import type { AdminData } from '../hooks/useAdminData';
import { PanelTitle, StateNotice } from '../components/ui';

const PERIOD_LABEL: Record<AdminData['period']['key'], string> = {
  today: '오늘',
  '7d': '최근 7일',
  '30d': '최근 30일',
};

function formatJoinDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 기간은 신규 가입 수에만 적용하고, 목록에는 가장 최근 사용자를 보여 준다.
export default function Users({ data }: { data: AdminData }) {
  const { users } = data;
  const periodLabel = PERIOD_LABEL[data.period.key];
  const unavailableList = users.recent.length === 0 && users.total !== null && users.total > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <PanelTitle>최근 가입 사용자</PanelTitle>
          <p className="mt-1 text-xs text-foreground-500">선택 기간과 관계없이 최근 가입 순서입니다.</p>
        </div>
        <span className="text-sm text-foreground-500">
          전체 {users.total?.toLocaleString('ko-KR') ?? '—'}명 · {periodLabel} 신규{' '}
          {users.periodNew?.toLocaleString('ko-KR') ?? '—'}명
        </span>
      </div>

      {users.status === 'loading' ? (
        <StateNotice status="loading" />
      ) : users.status !== 'success' && users.status !== 'empty' ? (
        <StateNotice status={users.status} note="사용자 자료를 확인할 수 없습니다." />
      ) : unavailableList ? (
        <StateNotice
          status="unavailable"
          note={`전체 사용자는 ${users.total?.toLocaleString('ko-KR')}명이지만 최근 사용자 목록을 받지 못했습니다.`}
        />
      ) : users.total === 0 ? (
        <StateNotice status="empty" note="가입한 사용자가 실제 0명입니다." />
      ) : users.recent.length === 0 ? (
        <StateNotice status="unavailable" note="최근 사용자 목록을 서버에서 받지 못했습니다." />
      ) : (
        <>
          <ul aria-label="최근 가입 사용자" className="flex min-w-0 flex-col gap-3 md:hidden">
            {users.recent.map((user) => (
              <li key={user.id} className="min-w-0 rounded-lg border border-background-200 bg-background-50 p-4">
                <p className="break-words text-sm font-semibold text-foreground-900">
                  {user.nickname || '닉네임 없음'}
                </p>
                <dl className="mt-3 grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-foreground-500">이메일</dt>
                  <dd className="min-w-0 text-foreground-700 [overflow-wrap:anywhere]">
                    {user.emailMasked ?? '—'}
                  </dd>
                  <dt className="text-foreground-500">가입일</dt>
                  <dd className="min-w-0 break-words text-foreground-700">
                    {formatJoinDate(user.createdAt)}
                    <span className="mt-0.5 block text-xs text-foreground-500">한국시간</span>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-background-200 bg-background-50 md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-background-200 bg-background-100 text-xs text-foreground-500">
              <tr>
                <th className="px-4 py-3 font-medium">닉네임</th>
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">가입일 · 한국시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-background-100">
              {users.recent.map((user) => (
                <tr key={user.id} className="text-foreground-800">
                  <td className="px-4 py-3 font-medium text-foreground-900">
                    {user.nickname || '닉네임 없음'}
                  </td>
                  <td className="px-4 py-3 text-foreground-600 [overflow-wrap:anywhere]">{user.emailMasked ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-foreground-500">
                    {formatJoinDate(user.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}
