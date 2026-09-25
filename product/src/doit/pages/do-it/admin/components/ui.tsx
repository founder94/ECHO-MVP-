/* eslint-disable react-refresh/only-export-components -- A 구조 원본 구조 유지(컴포넌트+훅 같은 파일). 동작 영향 없음 */
import type { ReactNode } from "react";
import type { DataStatus } from "../hooks/useAdminData";

export function StateNotice({
  status,
  note,
}: {
  status: DataStatus;
  note?: string;
}) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 py-8 text-foreground-600">
        <i className="ri-loader-4-line animate-spin-slow text-lg" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-secondary-300 bg-secondary-50 px-4 py-4">
        <div className="flex items-center gap-2 text-secondary-900">
          <i className="ri-close-circle-line text-lg" />
          <span className="text-sm font-semibold">불러오지 못했어요</span>
        </div>
        <p className="mt-1 text-xs text-foreground-600">
          {note ?? "데이터를 불러오지 못했습니다."}
        </p>
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="rounded-lg border border-secondary-300 bg-secondary-50 px-4 py-4">
        <div className="flex items-center gap-2 text-secondary-900">
          <i className="ri-lock-line text-lg" />
          <span className="text-sm font-semibold">볼 권한이 아직 없어요</span>
        </div>
        <p className="mt-1 text-xs text-foreground-600">
          {note ?? "관리자가 이 기록을 볼 권한이 아직 없어요. 권한 추가는 대표 승인 뒤에 해요."}
        </p>
      </div>
    );
  }

  if (status === "missing") {
    return (
      <div className="rounded-lg border border-secondary-300 bg-secondary-50 px-4 py-4">
        <div className="flex items-center gap-2 text-secondary-900">
          <i className="ri-link-unlink text-lg" />
          <span className="text-sm font-semibold">아직 없는 기능이에요</span>
        </div>
        <p className="mt-1 text-xs text-foreground-600">
          {note ?? "이 기능은 아직 만들지 않았어요. 만들지는 대표가 정해요."}
        </p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="rounded-lg border border-background-200 bg-background-50 px-4 py-4">
        <div className="flex items-center gap-2 text-foreground-500">
          <i className="ri-inbox-line text-lg" />
          <span className="text-sm">데이터 없음 (실제 0건)</span>
        </div>
      </div>
    );
  }

  return null;
}

export function StatCard({
  label,
  value,
  sub,
  status,
  note,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  status: DataStatus;
  note?: string;
  accent?: boolean;
}) {
  const valueColor = accent ? "text-accent-700" : "text-foreground-950";
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground-500">{label}</span>
        {status === "blocked" && (
          <i className="ri-lock-line text-xs text-secondary-600" title="관리자가 볼 권한이 아직 없어요" />
        )}
        {status === "missing" && (
          <i className="ri-link-unlink text-xs text-secondary-600" title="아직 만들지 않은 기능이에요" />
        )}
        {status === "error" && (
          <i className="ri-close-circle-line text-xs text-secondary-600" title="불러오지 못했어요" />
        )}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular ${valueColor}`}>
        {status === "loading" ? (
          <span className="text-foreground-400 text-base">불러오는 중...</span>
        ) : status === "blocked" ? (
          <span className="text-foreground-400 text-base">볼 권한 없음</span>
        ) : status === "missing" ? (
          <span className="text-foreground-400 text-base">아직 없는 기능</span>
        ) : status === "error" ? (
          <span className="text-foreground-400 text-base">불러오지 못함</span>
        ) : (
          value
        )}
      </div>
      {sub && status !== "loading" && status !== "blocked" && status !== "error" && (
        <p className="mt-1 text-xs text-foreground-500">{sub}</p>
      )}
      {note &&
        (status === "blocked" || status === "error" || status === "missing") && (
          <p className="mt-1 text-xs text-foreground-500">{note}</p>
        )}
    </div>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground-950">{children}</h2>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "primary" | "secondary" | "danger";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-background-100 text-foreground-700",
    accent: "bg-accent-100 text-accent-900",
    primary: "bg-primary-100 text-primary-900",
    secondary: "bg-secondary-100 text-secondary-900",
    danger: "bg-primary-100 text-primary-900",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center px-4 py-10 text-sm text-foreground-500">
      {children}
    </div>
  );
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}***@${domain}`;
}