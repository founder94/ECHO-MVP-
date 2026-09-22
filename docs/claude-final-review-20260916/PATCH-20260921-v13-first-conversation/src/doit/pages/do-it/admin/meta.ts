// DO IT Plan A 관리자 메뉴 메타데이터.
// 각 메뉴가 연결하는 실제 Supabase 테이블과 RLS 상태를 정의한다.
// 값은 2026-08-24 기준 실제 스키마 + RLS 정책 확인 결과다.

export type MenuKind = "real" | "partial" | "blocked" | "missing";

export interface MenuMeta {
  key: string;
  label: string;
  icon: string;
  kind: MenuKind;
  table: string;
  note: string;
}

// DO IT Plan A 관리자 메뉴 15개.
export const ADMIN_MENUS: MenuMeta[] = [
  { key: "dashboard", label: "운영 대시보드", icon: "ri-dashboard-line", kind: "partial", table: "여러 테이블", note: "profiles·purposes·spaces·reports·blocks·audit_logs 실조회" },
  { key: "conversation-logs", label: "AI 대화 기록", icon: "ri-chat-history-line", kind: "partial", table: "doit_records + doit_insights + doit_request_events", note: "본인 줄만 조회(관리자 RLS 미적용) / request_events 는 서버 전용" },
  { key: "users", label: "사용자·프로필", icon: "ri-user-line", kind: "real", table: "profiles", note: "profiles_admin_select" },
  { key: "profile-verify", label: "본인·프로필 확인 상태", icon: "ri-shield-check-line", kind: "real", table: "profiles", note: "verification_status 집계" },
  { key: "purposes", label: "연결 목적", icon: "ri-heart-line", kind: "real", table: "purposes", note: "purposes_read" },
  { key: "spaces", label: "공간·방·참여자", icon: "ri-building-line", kind: "partial", table: "spaces + space_members", note: "spaces 실조회 / space_members RLS 차단" },
  { key: "missions", label: "협동 활동", icon: "ri-task-line", kind: "blocked", table: "missions", note: "missions_select(space_members 기준)만 존재" },
  { key: "selections", label: "사용자 선택", icon: "ri-heart-add-line", kind: "blocked", table: "member_selections", note: "selections_select_own만 존재" },
  { key: "key-balances", label: "KEY 보유 현황", icon: "ri-key-line", kind: "blocked", table: "key_balances", note: "keys_select_own만 존재" },
  { key: "key-orders", label: "KEY 주문·결제", icon: "ri-bank-card-line", kind: "blocked", table: "key_orders", note: "orders_select_own만 존재" },
  { key: "saju-taro", label: "사주·타로 기록", icon: "ri-magic-line", kind: "blocked", table: "saju_taro_records", note: "saju_select_own만 존재" },
  { key: "ai-ops", label: "AI 사용·요청 제한", icon: "ri-robot-line", kind: "blocked", table: "openai_rate_limits", note: "SELECT 정책 없음" },
  { key: "consents", label: "동의 기록", icon: "ri-file-check-line", kind: "blocked", table: "consents", note: "consents_select_own만 존재" },
  { key: "reports-blocks", label: "신고·차단", icon: "ri-alert-line", kind: "real", table: "reports + blocks", note: "reports_admin_select / blocks_admin_select" },
  { key: "audit-logs", label: "운영 감사 기록", icon: "ri-history-line", kind: "real", table: "audit_logs", note: "audit_admin_select" },
];

// RLS 분석 근거 (2026-08-24 확인):
// - 관리자 SELECT 정책이 있는 테이블(실데이터 표시): profiles, audit_logs, blocks, reports
// - 로그인 사용자 전체 조회 가능: spaces(spaces_read), purposes(purposes_read)
// - 관리자 SELECT 정책이 없어 차단되는 테이블(권한 오류로 표시):
//   space_members, missions, member_selections, key_balances, key_orders,
//   saju_taro_records, openai_rate_limits, consents
// - analytics_events: INSERT 정책만 있고 SELECT 정책 없음(분석·퍼널용, 이번 메뉴에 미포함)