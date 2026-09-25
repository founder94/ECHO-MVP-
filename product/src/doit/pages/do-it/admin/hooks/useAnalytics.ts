import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/doit/lib/supabase";
import type { Period } from "./useAdminData";

export type AnalyticsStatus =
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "not_applied";

export interface AnalyticsData {
  status: AnalyticsStatus;
  error: string | null;
  visitors: number | null;
  newVisitors: number | null;
  returningVisitors: number | null;
  sessions: number | null;
  clicks: number | null;
  pageViews: number | null;
  screenViews: { screen: string; views: number }[];
  referrers: { referrer: string; cnt: number }[];
  devices: { device_type: string; cnt: number }[];
}

const INITIAL: AnalyticsData = {
  status: "loading",
  error: null,
  visitors: null,
  newVisitors: null,
  returningVisitors: null,
  sessions: null,
  clicks: null,
  pageViews: null,
  screenViews: [],
  referrers: [],
  devices: [],
};

// 수집 기능 미적용 여부 (A단계: enabled=false + 마이그레이션 미적용)
export function isAnalyticsNotApplied(): boolean {
  return import.meta.env.VITE_PA_ANALYTICS_ENABLED !== "true";
}

function periodRange(period: Period): { p_start: string; p_end: string } {
  const end = new Date();
  const start = new Date();
  if (period === "today") start.setHours(0, 0, 0, 0);
  else if (period === "7d") start.setDate(start.getDate() - 7);
  else if (period === "30d") start.setDate(start.getDate() - 30);
  else start.setFullYear(start.getFullYear() - 1);
  return { p_start: start.toISOString(), p_end: end.toISOString() };
}

export function useAnalytics(period: Period) {
  const [data, setData] = useState<AnalyticsData>(INITIAL);
  const reqSeqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++reqSeqRef.current;

    // 수집 미적용: RPC 호출 전에 조기 반환 (실제 조회 0)
    if (isAnalyticsNotApplied()) {
      if (seq === reqSeqRef.current) {
        setData({ ...INITIAL, status: "not_applied" });
      }
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      if (seq === reqSeqRef.current) {
        setData({ ...INITIAL, status: "error", error: "Supabase가 연결되지 않았습니다." });
      }
      return;
    }

    const { p_start, p_end } = periodRange(period);

    const { data: result, error } = await supabase.rpc("admin_analytics", {
      p_start,
      p_end,
    });

    if (seq !== reqSeqRef.current) return; // 늦은 응답 폐기

    if (error) {
      setData({ ...INITIAL, status: "error", error: error.message });
      return;
    }

    const visitors = result?.visitors ?? 0;
    const newVisitors = result?.new_returning?.new ?? 0;
    const returningVisitors = result?.new_returning?.returning ?? 0;
    const sessions = result?.sessions ?? 0;
    const clicks = result?.clicks ?? 0;
    const pageViews = result?.page_views ?? 0;

    const empty =
      visitors === 0 && sessions === 0 && clicks === 0 && pageViews === 0;

    setData({
      status: empty ? "empty" : "success",
      error: null,
      visitors,
      newVisitors,
      returningVisitors,
      sessions,
      clicks,
      pageViews,
      screenViews: result?.screen_views ?? [],
      referrers: result?.referrers ?? [],
      devices: result?.devices ?? [],
    });
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, reload: load };
}