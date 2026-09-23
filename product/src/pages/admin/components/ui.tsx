/* eslint-disable react-refresh/only-export-components -- 관리자 공용 UI 묶음. 동작 영향 없음 */
import type { ReactNode } from 'react';
import type { DataStatus } from '../hooks/useAdminData';

// 상태별 표시 문구(색으로만 구분하지 않고 반드시 한글 문구를 함께 표시)
export function statusLabel(status: DataStatus): string {
  switch (status) {
    case 'loading':
      return '불러오는 중';
    case 'success':
      return '정상';
    case 'empty':
      return '0건';
    case 'blocked':
      return '권한 없음';
    case 'missing':
      return '서버 자료 없음';
    case 'unavailable':
      return '확인할 수 없음';
    case 'error':
      return '불러오기 실패';
    case 'needs_check':
      return '운영 점검 대상';
    default:
      return '상태 확인 불가';
  }
}

export function StateNotice({ status, note }: { status: DataStatus; note?: string }) {
  if (status === 'loading') {
    return (
      <div className="flex items-center gap-3 py-8 text-foreground-600">
        <i className="ri-loader-4-line animate-spin text-lg" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-background-200 bg-background-100 px-4 py-4">
        <div className="flex items-center gap-2 text-foreground-900">
          <i className="ri-close-circle-line text-lg" />
          <span className="text-sm font-semibold">불러오기 실패</span>
        </div>
        <p className="mt-1 text-xs text-foreground-600">{note ?? '데이터를 불러오지 못했습니다.'}</p>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="rounded-lg border border-background-200 bg-background-100 px-4 py-4">
        <div className="flex items-center gap-2 text-foreground-900">
          <i className="ri-lock-line text-lg" />
          <span className="text-sm font-semibold">권한 없음</span>
        </div>
        <p className="mt-1 text-xs text-foreground-600">{note ?? '이 데이터를 읽을 권한이 없습니다.'}</p>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="rounded-lg border border-background-200 bg-background-100 px-4 py-4">
        <div className="flex items-center gap-2 text-foreground-900">
          <i className="ri-link-unlink text-lg" />
          <span className="text-sm font-semibold">서버 자료 없음</span>
        </div>
        <p className="mt-1 text-xs text-foreground-600">{note ?? '서버가 이 항목의 자료를 보내지 않았습니다.'}</p>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="rounded-lg border border-background-200 bg-background-100 px-4 py-4">
        <div className="flex items-center gap-2 text-foreground-900">
          <i className="ri-question-line text-lg" />
          <span className="text-sm font-semibold">확인할 수 없음</span>
        </div>
        <p className="mt-1 text-xs text-foreground-600">
          {note ?? '서버에서 이 자료를 제공하지 않았습니다.'}
        </p>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="rounded-lg border border-background-200 bg-background-50 px-4 py-4">
        <div className="flex items-center gap-2 text-foreground-500">
          <i className="ri-inbox-line text-lg" />
          <span className="text-sm">{note ?? '데이터 없음 (실제 0건)'}</span>
        </div>
      </div>
    );
  }

  return null;
}

// 핵심 숫자 카드. 로딩/오류/미연결 상태를 숫자와 구분해 정직하게 표시한다.
export function StatCard({
  label,
  value,
  status,
  note,
  unit,
}: {
  label: string;
  value: number | null;
  status: DataStatus;
  note?: string;
  unit?: string;
}) {
  const unavailable = status === 'unavailable' || (value === null && status !== 'loading');

  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground-500">{label}</span>
        {status === 'missing' && (
          <i className="ri-link-unlink text-xs text-foreground-400" title="서버 자료 없음" />
        )}
        {status === 'blocked' && (
          <i className="ri-lock-line text-xs text-foreground-400" title="권한 없음" />
        )}
        {status === 'error' && (
          <i className="ri-close-circle-line text-xs text-foreground-400" title="불러오기 실패" />
        )}
        {status === 'unavailable' && (
          <i className="ri-question-line text-xs text-foreground-400" title="확인할 수 없음" />
        )}
        {status === 'needs_check' && (
          <i className="ri-alert-line text-xs text-accent-500" title="운영 점검 대상" />
        )}
      </div>

      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground-950">
        {status === 'loading' ? (
          <span className="text-base font-normal text-foreground-400">불러오는 중</span>
        ) : status === 'missing' ? (
          <span className="text-base font-normal text-foreground-400">서버 자료 없음</span>
        ) : status === 'blocked' ? (
          <span className="text-base font-normal text-foreground-400">권한 없음</span>
        ) : status === 'error' ? (
          <span className="text-base font-normal text-foreground-400">불러오기 실패</span>
        ) : unavailable ? (
          <span className="text-base font-normal text-foreground-400">
            {status === 'needs_check' ? '운영 점검 대상' : '확인할 수 없음'}
          </span>
        ) : (
          <>
            {value?.toLocaleString('ko-KR')}
            <span className="ml-1 text-sm font-normal text-foreground-500">
              {unit ?? (label.includes('사용자') ? '명' : '건')}
            </span>
          </>
        )}
      </div>

      {note && (
        <p className="mt-1 text-xs text-foreground-500">{note}</p>
      )}
    </div>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground-950">{children}</h2>;
}

type PillTone = 'neutral' | 'ok' | 'progress' | 'needs_check' | 'failed';

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  const tones: Record<PillTone, string> = {
    neutral: 'bg-background-100 text-foreground-700',
    ok: 'bg-secondary-100 text-secondary-900',
    progress: 'bg-primary-100 text-primary-900',
    needs_check: 'bg-accent-100 text-accent-900',
    failed: 'bg-primary-100 text-primary-900',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 이메일 기본 마스킹(개인정보 최소 노출)
export function maskEmail(email: string | null): string {
  if (!email) return '—';
  const at = email.indexOf('@');
  if (at <= 0) return '—';
  const name = email.slice(0, at);
  const domain = email.slice(at);
  const visible = name.slice(0, 2);
  return `${visible}***${domain}`;
}
