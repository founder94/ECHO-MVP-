import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/doit/lib/supabase";
import { CONSENT_VERSION } from "@/lib/legal/consent";

export type DataStatus =
  | "loading"
  | "success"
  | "empty"
  | "blocked"
  | "missing"
  | "error";

export type Period = "today" | "7d" | "30d" | "all";

export interface ProfileRow {
  id: string;
  email: string | null;
  nickname: string | null;
  role: string | null;
  grade: string | null;
  verification_status: string | null;
  created_at: string | null;
}

export interface PurposeRow {
  id: string;
  label: string | null;
  icon: string | null;
  description: string | null;
  color: string | null;
  sort_order: number | null;
}

export interface SpaceRow {
  id: string;
  purpose_id: string | null;
  name: string | null;
  description: string | null;
  status: string | null;
  is_locked: boolean | null;
  max_members: number | null;
  owner_id: string | null;
  created_at: string | null;
}

export interface ReportRow {
  id: string;
  reason: string | null;
  detail: string | null;
  status: string | null;
  reporter_id: string | null;
  target_user_id: string | null;
  created_at: string | null;
}

export interface BlockRow {
  id: string;
  blocker_id: string | null;
  blocked_user_id: string | null;
  reason: string | null;
  created_at: string | null;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string | null;
  detail: unknown | null;
  created_at: string | null;
}

export interface TableState {
  status: DataStatus;
  total: number | null;
  note?: string;
}

export interface AdminData {
  loading: boolean;
  lastFetchedAt: Date | null;
  profiles: {
    status: DataStatus;
    total: number | null;
    today: number | null;
    unverified: number | null;
    recent: ProfileRow[];
  };
  purposes: { status: DataStatus; total: number | null; list: PurposeRow[] };
  spaces: {
    status: DataStatus;
    total: number | null;
    active: number | null;
    recent: SpaceRow[];
  };
  reports: { status: DataStatus; total: number | null; recent: ReportRow[] };
  blocks: { status: DataStatus; total: number | null; recent: BlockRow[] };
  auditLogs: {
    status: DataStatus;
    total: number | null;
    recent: AuditLogRow[];
  };
  // 관리자 SELECT 정책이 없어 RLS로 차단되는 테이블들.
  spaceMembers: TableState;
  missions: TableState;
  selections: TableState;
  keyBalances: TableState;
  keyOrders: TableState;
  sajuTaro: TableState;
  aiRateLimits: TableState;
  consents: TableState;
}

const EMPTY: AdminData = {
  loading: true,
  lastFetchedAt: null,
  profiles: { status: "loading", total: null, today: null, unverified: null, recent: [] },
  purposes: { status: "loading", total: null, list: [] },
  spaces: { status: "loading", total: null, active: null, recent: [] },
  reports: { status: "loading", total: null, recent: [] },
  blocks: { status: "loading", total: null, recent: [] },
  auditLogs: { status: "loading", total: null, recent: [] },
  spaceMembers: { status: "loading", total: null },
  missions: { status: "loading", total: null },
  selections: { status: "loading", total: null },
  keyBalances: { status: "loading", total: null },
  keyOrders: { status: "loading", total: null },
  sajuTaro: { status: "loading", total: null },
  aiRateLimits: { status: "loading", total: null },
  consents: { status: "loading", total: null },
};

function periodStart(period: Period): Date | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  const days = period === "7d" ? 7 : 30;
  now.setDate(now.getDate() - days);
  return now;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// 관리자 SELECT 정책이 없는 테이블을 실제로 조회 시도하고,
// RLS 차단(error) 시 'blocked' 상태로 정직하게 표시한다.
async function attemptCount(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  table: string,
): Promise<TableState> {
  try {
    const res = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (res.error) {
      // 테이블이 아예 없는 경우(미구현)와 RLS로 차단된 경우를 구분한다.
      // 가짜 0건을 실제 0건으로 보여주지 않고 정직하게 상태를 나눈다.
      const msg = (res.error.message ?? "").toLowerCase();
      const code = res.error.code;
      const missing =
        msg.includes("does not exist") ||
        msg.includes("could not find") ||
        code === "42P01" ||
        code === "PGRST205";
      return { status: missing ? "missing" : "blocked", total: null };
    }
    const total = res.count ?? 0;
    return { status: total === 0 ? "empty" : "success", total };
  } catch {
    return { status: "blocked", total: null };
  }
}

export function useAdminData(period: Period) {
  const [data, setData] = useState<AdminData>(EMPTY);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setData((prev) => ({
        ...prev,
        loading: false,
        lastFetchedAt: new Date(),
        profiles: { ...prev.profiles, status: "error" },
        purposes: { ...prev.purposes, status: "error" },
        spaces: { ...prev.spaces, status: "error" },
        reports: { ...prev.reports, status: "error" },
        blocks: { ...prev.blocks, status: "error" },
        auditLogs: { ...prev.auditLogs, status: "error" },
      }));
      return;
    }

    const since = periodStart(period);
    const sinceIso = since ? since.toISOString() : null;
    const todayIso = startOfToday().toISOString();

    const next: AdminData = {
      ...EMPTY,
      loading: true,
      lastFetchedAt: null,
    };

    // --- profiles (관리자 SELECT 정책 있음) ---
    try {
      const totalRes = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      const todayRes = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayIso);
      // 본인 인증 미완료 프로필 수 (verified 이외: null/none/pending 등)
      const unverifiedRes = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .neq("verification_status", "verified");
      let recentRes = await supabase
        .from("profiles")
        .select("id, email, nickname, role, grade, verification_status, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (sinceIso) {
        recentRes = await supabase
          .from("profiles")
          .select("id, email, nickname, role, grade, verification_status, created_at")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(30);
      }
      if (totalRes.error || todayRes.error || unverifiedRes.error || recentRes.error) {
        next.profiles = { status: "error", total: null, today: null, unverified: null, recent: [] };
      } else {
        const total = totalRes.count ?? 0;
        const today = todayRes.count ?? 0;
        const unverified = unverifiedRes.count ?? 0;
        const recent = (recentRes.data ?? []) as ProfileRow[];
        next.profiles = {
          status: recent.length === 0 ? "empty" : "success",
          total,
          today,
          unverified,
          recent,
        };
      }
    } catch {
      next.profiles = { status: "error", total: null, today: null, unverified: null, recent: [] };
    }

    // --- purposes (로그인 사용자 조회 가능) ---
    try {
      const listRes = await supabase
        .from("purposes")
        .select("id, label, icon, description, color, sort_order")
        .order("sort_order", { ascending: true });
      if (listRes.error) {
        next.purposes = { status: "error", total: null, list: [] };
      } else {
        const list = (listRes.data ?? []) as PurposeRow[];
        next.purposes = {
          status: list.length === 0 ? "empty" : "success",
          total: list.length,
          list,
        };
      }
    } catch {
      next.purposes = { status: "error", total: null, list: [] };
    }

    // --- spaces (로그인 사용자 조회 가능) ---
    try {
      const totalRes = await supabase
        .from("spaces")
        .select("id", { count: "exact", head: true });
      const activeRes = await supabase
        .from("spaces")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      let recentRes = await supabase
        .from("spaces")
        .select("id, purpose_id, name, description, status, is_locked, max_members, owner_id, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (sinceIso) {
        recentRes = await supabase
          .from("spaces")
          .select("id, purpose_id, name, description, status, is_locked, max_members, owner_id, created_at")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(30);
      }
      if (totalRes.error || activeRes.error || recentRes.error) {
        next.spaces = { status: "error", total: null, active: null, recent: [] };
      } else {
        next.spaces = {
          status: (recentRes.data ?? []).length === 0 ? "empty" : "success",
          total: totalRes.count ?? 0,
          active: activeRes.count ?? 0,
          recent: (recentRes.data ?? []) as SpaceRow[],
        };
      }
    } catch {
      next.spaces = { status: "error", total: null, active: null, recent: [] };
    }

    // --- reports (신고, 관리자 SELECT 정책 있음) ---
    try {
      const totalRes = await supabase
        .from("user_reports")
        .select("id", { count: "exact", head: true });
      let recentRes = await supabase
        .from("user_reports")
        .select("id, reason, detail, status, reporter_id, target_user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (sinceIso) {
        recentRes = await supabase
          .from("user_reports")
          .select("id, reason, detail, status, reporter_id, target_user_id, created_at")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(30);
      }
      if (totalRes.error || recentRes.error) {
        next.reports = { status: "error", total: null, recent: [] };
      } else {
        next.reports = {
          status: (recentRes.data ?? []).length === 0 ? "empty" : "success",
          total: totalRes.count ?? 0,
          recent: (recentRes.data ?? []) as ReportRow[],
        };
      }
    } catch {
      next.reports = { status: "error", total: null, recent: [] };
    }

    // --- blocks (차단, 관리자 SELECT 정책 있음) ---
    try {
      const totalRes = await supabase
        .from("blocks")
        .select("id", { count: "exact", head: true });
      const recentRes = await supabase
        .from("blocks")
        .select("id, blocker_id, blocked_user_id, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (totalRes.error || recentRes.error) {
        next.blocks = { status: "error", total: null, recent: [] };
      } else {
        next.blocks = {
          status: (recentRes.data ?? []).length === 0 ? "empty" : "success",
          total: totalRes.count ?? 0,
          recent: (recentRes.data ?? []) as BlockRow[],
        };
      }
    } catch {
      next.blocks = { status: "error", total: null, recent: [] };
    }

    // --- audit_logs (관리자 SELECT 정책 있음) ---
    try {
      const totalRes = await supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true });
      let recentRes = await supabase
        .from("audit_logs")
        .select("id, user_id, action, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (sinceIso) {
        recentRes = await supabase
          .from("audit_logs")
          .select("id, user_id, action, detail, created_at")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(30);
      }
      if (totalRes.error || recentRes.error) {
        next.auditLogs = { status: "error", total: null, recent: [] };
      } else {
        next.auditLogs = {
          status: (recentRes.data ?? []).length === 0 ? "empty" : "success",
          total: totalRes.count ?? 0,
          recent: (recentRes.data ?? []) as AuditLogRow[],
        };
      }
    } catch {
      next.auditLogs = { status: "error", total: null, recent: [] };
    }

    // --- 관리자 SELECT 정책 없는 테이블 (RLS 차단 여부 실확인) ---
    next.spaceMembers = await attemptCount(supabase, "space_members");
    next.missions = await attemptCount(supabase, "missions");
    next.selections = await attemptCount(supabase, "member_selections");
    next.keyBalances = await attemptCount(supabase, "key_balances");
    next.keyOrders = await attemptCount(supabase, "key_orders");
    next.sajuTaro = await attemptCount(supabase, "saju_taro_records");
    next.aiRateLimits = await attemptCount(supabase, "openai_rate_limits");
    // 대표 2026-09-25 관리자 점검: 동의 기록은 별도 표가 아니라 각 사용자 프로필의 consent_version 에 저장된다(가입 화면 → profiles).
    // 관리자는 profiles 를 읽을 수 있으므로 여기서 센다. total = 지금 약관 판(CONSENT_VERSION)에 동의한 사람 수.
    try {
      const agreed = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("consent_version", CONSENT_VERSION);
      next.consents = agreed.error ? { status: "blocked", total: null } : { status: (agreed.count ?? 0) === 0 ? "empty" : "success", total: agreed.count ?? 0 };
    } catch {
      next.consents = { status: "error", total: null };
    }

    next.loading = false;
    next.lastFetchedAt = new Date();
    setData(next);
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, refresh: load };
}