// 대시보드 「대표가 확인할 것」에 연결 서버(doit-connect) 값을 더한다 — 최대 3개.
import type { ConnectCandidates, ConnectMatch } from './api';

export interface Connect { candidates: ConnectCandidates | null; matches: ConnectMatch[] | null; error: string | null }

export function mergeDecisions(base: string[], c: Connect): string[] {
  const out = [...base];
  if (c.candidates && c.candidates.eligible === 0 && !out.some((x) => x.includes('연결 준비'))) out.push('연결 준비가 된 사용자가 0명입니다.');
  else if (c.candidates && c.candidates.eligible > 1 && c.candidates.candidates.length === 0 && !out.some((x) => x.includes('연결 후보'))) out.push('연결 후보가 0쌍입니다.');
  else if (c.candidates && c.candidates.candidates.length > 0) out.push(`승인을 기다리는 연결 후보 ${c.candidates.candidates.length}쌍이 있습니다.`);
  return out.slice(0, 3);
}

