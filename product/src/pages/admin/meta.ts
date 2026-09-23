// ECHO · DO IT 관리자 메뉴 메타데이터.
// 대표가 20초 안에 이해하도록 쉬운 한국어 라벨만 사용하고, 영문 테이블명은 화면에 노출하지 않는다.
// 모바일 하단 메뉴는 5개(한눈에/사용자/대화/결제/오류), 설정은 상단 메뉴에 둔다.

export type AdminMenuKey = 'overview' | 'users' | 'journey' | 'payments' | 'errors';

export interface AdminMenuItem {
  key: AdminMenuKey;
  label: string;
  icon: string;
}

export const ADMIN_MENUS: AdminMenuItem[] = [
  { key: 'overview', label: '한눈에', icon: 'ri-dashboard-line' },
  { key: 'users', label: '사용자', icon: 'ri-user-line' },
  { key: 'journey', label: '대화', icon: 'ri-chat-3-line' },
  { key: 'payments', label: '결제', icon: 'ri-bank-card-line' },
  { key: 'errors', label: '오류', icon: 'ri-alert-line' },
];

export type Period = 'today' | '7d' | '30d';

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: '7d', label: '7일' },
  { key: '30d', label: '30일' },
];
