// ADMIN WEB 공통 조각. 값이 없으면 숫자 대신 이유(데이터 없음 · 연결 필요 · 확인 필요)를 보인다 — 0 으로 바꾸지 않는다.
import type { ReactNode } from 'react';
import type { Level } from './api';

export type Missing = '데이터 없음' | '연결 필요' | '확인 필요';

export function Num({ value, missing = '확인 필요' }: { value: number | null | undefined; missing?: Missing }) {
  if (value === null || value === undefined || Number.isNaN(value)) return <span className="aw-missing">{missing}</span>;
  return <>{value.toLocaleString('ko-KR')}</>;
}

export function Stat({ label, value, missing, hint, tone }: { label: string; value: number | null | undefined; missing?: Missing; hint?: string; tone?: 'bad' | 'warn' }) {
  const t = tone && typeof value === 'number' && value > 0 ? ` aw-stat--${tone}` : '';
  return (
    <div className={`aw-stat${t}`}>
      <div className="aw-stat-label">{label}</div>
      <div className="aw-stat-value"><Num value={value} missing={missing} /></div>
      {hint ? <div className="aw-stat-hint">{hint}</div> : null}
    </div>
  );
}

const LEVEL_CLASS: Record<Level, string> = { 정상: 'ok', 주의: 'warn', 오류: 'bad' };
export function LevelBadge({ level, big }: { level: Level; big?: boolean }) {
  return <span className={`aw-level aw-level--${LEVEL_CLASS[level]}${big ? ' aw-level--big' : ''}`}><span aria-hidden="true" className="aw-dot" />{level}</span>;
}

export function Tag({ children, tone }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'muted' }) {
  return <span className={`aw-tag${tone ? ` aw-tag--${tone}` : ''}`}>{children}</span>;
}

export function Section({ title, sub, children, right }: { title: string; sub?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="aw-section">
      <header className="aw-section-head">
        <div><h2>{title}</h2>{sub ? <p>{sub}</p> : null}</div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Notice({ kind, children }: { kind: Missing | '오류'; children: ReactNode }) {
  return <div className={`aw-notice${kind === '오류' ? ' aw-notice--bad' : ''}`}><strong>{kind}</strong><span>{children}</span></div>;
}

export function Loading() { return <div className="aw-loading" role="status">불러오는 중…</div>; }

