// 2026-10-02 대표 「QA 마감 v1.1」 §13 — 대표가 첫 화면에서 20초 안에 「지금 문제 · 막힌 구간 · 다음 클릭」을 알 수 있게 하는 판정(순수 함수 · 검사 대상).
// 원칙: 못 읽은 자료를 「정상」이나 0 으로 바꾸지 않는다. 없는 기능은 0 이 아니라 「기능 없음」. QA 와 운영을 크게 구분한다.
import type { Level } from './api';

export type Env = '시험용 QA' | '실제 운영' | '알 수 없음';
// 운영 빌드 주소 잠금(qa/*): 소스에 QA 주소·프로젝트 id 를 적지 않는다 — 지금 열린 관리자 사이트의 이름으로만 구분한다.
export function envOf(hostname: string | undefined): Env {
  if (!hostname) return '알 수 없음';
  if (/(^|[-.])qa([-.]|$)/.test(hostname)) return '시험용 QA';
  if (hostname === 'do-it.company' || hostname.endsWith('.do-it.company')) return '실제 운영';
  return '알 수 없음';
}

export type State = '정상' | '확인 필요' | '일부 중단' | '확인 불가';
export interface StateInput { overviewOk: boolean; health: Level | null; safetyOk: boolean; connectOk: boolean }
/** 지금 상태 하나. 전체 자료를 못 읽으면 확인 불가 · 안전·연결 자료를 못 읽었으면 「정상」 금지. */
export function stateOf(x: StateInput): { state: State; reasons: string[] } {
  if (!x.overviewOk || !x.health) return { state: '확인 불가', reasons: ['운영 자료를 읽지 못했어요.'] };
  const reasons: string[] = [];
  if (!x.safetyOk) reasons.push('안전(신고·차단) 자료를 읽지 못했어요.');
  if (!x.connectOk) reasons.push('연결 자료를 읽지 못했어요.');
  if (x.health === '오류') return { state: '일부 중단', reasons };
  if (x.health === '주의' || reasons.length) return { state: '확인 필요', reasons };
  return { state: '정상', reasons };
}

export type Owner = '대표' | 'Claude' | 'Codex' | '운영자';
export interface Task { what: string; why: string; impact: string; owner: Owner; menu: string }
/** 먼저 할 일 1건 — 서버가 준 결정 목록(우선순위 순)을 이유·영향·담당·이동할 메뉴와 함께. 안전 자료를 못 읽었으면 그것이 먼저다. */
export function firstTask(decisions: string[], safetyOk: boolean, connectOk: boolean): Task | null {
  if (!safetyOk) return { what: '안전 자료를 다시 불러오기', why: '신고·차단 목록을 읽지 못했어요.', impact: '처리할 신고가 있어도 보이지 않을 수 있어요.', owner: '운영자', menu: 'safety' };
  const d = decisions[0];
  if (d) {
    if (/중대 의심 신고/.test(d)) return { what: d, why: '위협·사기 같은 말이 들어간 신고예요.', impact: '사용자 안전과 직결돼요. 판단은 사람이 해요.', owner: '대표', menu: 'safety' };
    if (/처리 안 된 신고/.test(d)) return { what: d, why: '검토를 기다리는 신고가 있어요.', impact: '오래 두면 신고한 사람의 신뢰가 떨어져요.', owner: '운영자', menu: 'safety' };
    if (/Google 로그인/.test(d)) return { what: d, why: '로그인 설정이 꺼져 있어요.', impact: 'Google 로 시작하는 사람이 들어오지 못해요.', owner: '대표', menu: 'status' };
    if (/AI 가 답을 못 만든/.test(d)) return { what: d, why: 'AI 대화 서버가 답을 만들지 못한 기록이 있어요.', impact: '대화가 멈춘 사용자가 있을 수 있어요.', owner: 'Claude', menu: 'failures' };
    if (/대화 품질 실패/.test(d)) return { what: d, why: '서버 검사에 걸린 대화가 있어요.', impact: '질문 반복·목적 어긋남이 생길 수 있어요.', owner: 'Claude', menu: 'conversations' };
    if (/연결 준비가 된 사용자가 0명|연결 후보가 0쌍/.test(d)) return { what: d, why: '후보를 만들 사람이 없어요.', impact: '「당신이 잠든 사이」 후보가 나가지 않아요.', owner: '운영자', menu: 'connect' };
    return { what: d, why: '서버가 확인이 필요하다고 표시했어요.', impact: '자세한 내용은 해당 메뉴에서 확인하세요.', owner: '운영자', menu: 'dashboard' };
  }
  if (!connectOk) return { what: '연결 자료를 다시 불러오기', why: '연결 서버 자료를 읽지 못했어요.', impact: '막힌 연결 구간이 보이지 않을 수 있어요.', owner: '운영자', menu: 'connect' };
  return null;
}

/** 검토를 가장 오래 기다린 신고(열린 것만) — 몇 시간째인지. 없으면 null. */
export function oldestOpenHours(reports: { status: string; created_at: string }[], now = Date.now()): number | null {
  const open = reports.filter((r) => r.status !== 'resolved' && r.status !== 'closed').map((r) => Date.parse(r.created_at)).filter((t) => !Number.isNaN(t));
  return open.length ? Math.max(0, Math.floor((now - Math.min(...open)) / 3_600_000)) : null;
}
