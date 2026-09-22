// AI 대화 기록 조회 — doit_records / doit_insights / doit_request_events.
// 정직 원칙: 권한이 없어 못 읽은 것을 "0건"으로 보여주지 않는다. blocked / missing / empty 를 구분한다.
// 지금 RLS 는 본인 줄만 허용한다(doit_records_select_own · doit_insights_select_own).
// doit_request_events 는 authenticated 에게 SELECT 권한 자체가 없다(서버 함수 전용).
// 관리자 전체 조회는 PENDING_20260922_admin_read_doit_conversation.sql 실행 후에만 가능하다(대표 승인 전 실행 금지).
import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/doit/lib/supabase";
import type { DataStatus, Period } from "./useAdminData";

export interface RecordRow {
  id: string;
  user_id: string | null;
  original_text: string | null;
  text: string | null;
  status: string | null;
  revision: number | null;
  created_at: string | null;
}

export interface InsightRow {
  id: string;
  user_id: string | null;
  category: string | null;
  text: string | null;
  ai_text: string | null;
  status: string | null;
  origin: string | null;
  revision: number | null;
  created_at: string | null;
}

export interface FeedbackCounts {
  candidate: number;
  confirmed: number;
  corrected: number;
  rejected: number;
}

export interface ConversationLogs {
  loading: boolean;
  lastFetchedAt: Date | null;
  /** 지금 보이는 범위가 본인 계정으로 좁혀져 있는가 (관리자 RLS 미적용) */
  ownRowsOnly: boolean;
  records: { status: DataStatus; total: number | null; rows: RecordRow[]; note?: string };
  insights: { status: DataStatus; total: number | null; rows: InsightRow[]; counts: FeedbackCounts; note?: string };
  /** 질문 생성 기록(doit_request_events) — 화면에서 읽을 권한이 없는 것이 정상이다. */
  requestEvents: { status: DataStatus; total: number | null; note?: string };
}

const EMPTY_COUNTS: FeedbackCounts = { candidate: 0, confirmed: 0, corrected: 0, rejected: 0 };

const EMPTY: ConversationLogs = {
  loading: true,
  lastFetchedAt: null,
  ownRowsOnly: true,
  records: { status: "loading", total: null, rows: [] },
  insights: { status: "loading", total: null, rows: [], counts: EMPTY_COUNTS },
  requestEvents: { status: "loading", total: null },
};

const ROW_LIMIT = 50;

function periodStartIso(period: Period): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = period === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

// 테이블 자체가 없는 것(미구현)과 권한으로 막힌 것을 구분한다. 가짜 0건을 만들지 않는다.
function classify(error: { message?: string; code?: string } | null): DataStatus | null {
  if (!error) return null;
  const msg = (error.message ?? "").toLowerCase();
  const code = error.code;
  const missing =
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    code === "42P01" ||
    code === "PGRST205";
  return missing ? "missing" : "blocked";
}

function countByStatus(rows: InsightRow[]): FeedbackCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const row of rows) {
    if (row.status === "confirmed") counts.confirmed += 1;
    else if (row.status === "corrected") counts.corrected += 1;
    else if (row.status === "rejected") counts.rejected += 1;
    else if (row.status === "candidate") counts.candidate += 1;
  }
  return counts;
}

export function useConversationLogs(period: Period) {
  const [data, setData] = useState<ConversationLogs>(EMPTY);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setData({
        ...EMPTY,
        loading: false,
        lastFetchedAt: new Date(),
        records: { status: "error", total: null, rows: [], note: "Supabase 연결 없음" },
        insights: { status: "error", total: null, rows: [], counts: EMPTY_COUNTS, note: "Supabase 연결 없음" },
        requestEvents: { status: "error", total: null, note: "Supabase 연결 없음" },
      });
      return;
    }

    setData((prev) => ({ ...prev, loading: true }));
    const sinceIso = periodStartIso(period);
    const next: ConversationLogs = { ...EMPTY, loading: true };

    // --- doit_records (사용자가 적은 답) ---
    try {
      let countQuery = supabase.from("doit_records").select("id", { count: "exact", head: true });
      if (sinceIso) countQuery = countQuery.gte("created_at", sinceIso);
      let rowQuery = supabase
        .from("doit_records")
        .select("id, user_id, original_text, text, status, revision, created_at")
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (sinceIso) rowQuery = rowQuery.gte("created_at", sinceIso);
      const [countRes, rowRes] = await Promise.all([countQuery, rowQuery]);
      const blocked = classify(countRes.error) ?? classify(rowRes.error);
      if (blocked) {
        next.records = { status: blocked, total: null, rows: [] };
      } else {
        const rows = (rowRes.data ?? []) as RecordRow[];
        const total = countRes.count ?? rows.length;
        next.records = { status: total === 0 ? "empty" : "success", total, rows };
      }
    } catch {
      next.records = { status: "error", total: null, rows: [], note: "doit_records 조회 실패" };
    }

    // --- doit_insights (AI 가 만든 이해 + 4버튼 결과) ---
    try {
      let countQuery = supabase.from("doit_insights").select("id", { count: "exact", head: true });
      if (sinceIso) countQuery = countQuery.gte("created_at", sinceIso);
      let rowQuery = supabase
        .from("doit_insights")
        .select("id, user_id, category, text, ai_text, status, origin, revision, created_at")
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (sinceIso) rowQuery = rowQuery.gte("created_at", sinceIso);
      const [countRes, rowRes] = await Promise.all([countQuery, rowQuery]);
      const blocked = classify(countRes.error) ?? classify(rowRes.error);
      if (blocked) {
        next.insights = { status: blocked, total: null, rows: [], counts: EMPTY_COUNTS };
      } else {
        const rows = (rowRes.data ?? []) as InsightRow[];
        const total = countRes.count ?? rows.length;
        next.insights = {
          status: total === 0 ? "empty" : "success",
          total,
          rows,
          counts: countByStatus(rows),
        };
      }
    } catch {
      next.insights = { status: "error", total: null, rows: [], counts: EMPTY_COUNTS, note: "doit_insights 조회 실패" };
    }

    // --- doit_request_events (질문 생성 기록) ---
    // authenticated 에게 SELECT 권한이 없다. 막히는 것이 정상이며, 그 사실을 그대로 표시한다.
    try {
      const res = await supabase.from("doit_request_events").select("id", { count: "exact", head: true });
      const blocked = classify(res.error);
      if (blocked) {
        next.requestEvents = { status: blocked, total: null };
      } else {
        const total = res.count ?? 0;
        next.requestEvents = { status: total === 0 ? "empty" : "success", total };
      }
    } catch {
      next.requestEvents = { status: "blocked", total: null };
    }

    // 관리자 전체 조회 정책이 붙기 전까지는 본인 줄만 보인다.
    const userIds = new Set<string>();
    for (const row of next.records.rows) if (row.user_id) userIds.add(row.user_id);
    for (const row of next.insights.rows) if (row.user_id) userIds.add(row.user_id);

    setData({ ...next, loading: false, lastFetchedAt: new Date(), ownRowsOnly: userIds.size <= 1 });
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, refresh: load };
}
