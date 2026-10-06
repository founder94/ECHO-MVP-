import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AnalyticsCollector } from "@/doit/lib/analytics";

interface AnalyticsBootstrapProps {
  supabase: SupabaseClient;
  enabled: boolean;
}

// 앱 전체에 1개만 설치. A단계에서는 enabled={false} 로 비활성화.
// 관리자 경로에서는 ID 생성/저장소 접근/이벤트/모든 분석 RPC 호출 0.
export default function AnalyticsBootstrap({
  supabase,
  enabled,
}: AnalyticsBootstrapProps) {
  const collectorRef = useRef<AnalyticsCollector | null>(null);

  useEffect(() => {
    const collector = new AnalyticsCollector({ supabase, enabled });
    collectorRef.current = collector;

    // Strict Mode 중복 방지: double-invoke 시 첫 인스턴스 정리
    const existing = collectorRef.current;
    if (existing !== collector) existing?.stop();

    if (collectorRef.current === collector) {
      collector.trackPageView();
      collector.startHeartbeat();
    }

    return () => {
      collector.stop();
      if (collectorRef.current === collector) collectorRef.current = null;
    };
  }, [supabase, enabled]);

  return null;
}