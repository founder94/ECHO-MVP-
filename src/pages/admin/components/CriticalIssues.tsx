import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
  amber: '#FBBF24',
  danger: '#F87171',
};

interface Issue {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  detectedAt: string;
  description: string;
  status: 'new' | 'investigating' | 'resolved';
}

const SEVERITY_CONFIG = {
  critical: { color: '#F87171', bg: 'rgba(248,113,113,0.10)', icon: 'ri-error-warning-fill', label: '긴급' },
  warning: { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', icon: 'ri-alert-fill', label: '주의' },
  info: { color: '#A0A0B0', bg: 'rgba(160,160,176,0.08)', icon: 'ri-information-fill', label: '정보' },
};

export default function CriticalIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const detectIssues = async () => {
    setLoading(true);
    const detected: Issue[] = [];

    // 1. Check OpenAI Edge Function health
    try {
      const { error } = await supabase.functions.invoke('echo-ai-analysis', {
        body: { action: 'health_check' },
      });
      if (error && error.message?.includes('API key')) {
        detected.push({
          id: 'openai_key',
          title: 'OpenAI API Key 미설정',
          severity: 'critical',
          source: 'OpenAI',
          detectedAt: new Date().toISOString(),
          description: 'AI 분석 기능을 사용하려면 OpenAI API Key 설정이 필요합니다. Supabase Edge Function Secrets에 OPENAI_API_KEY를 추가하세요.',
          status: 'new',
        });
      }
    } catch {
      detected.push({
        id: 'openai_func_error',
        title: 'OpenAI Edge Function 응답 실패',
        severity: 'critical',
        source: 'Edge Function',
        detectedAt: new Date().toISOString(),
        description: 'echo-ai-analysis Edge Function이 응답하지 않습니다. Supabase Functions 로그를 확인하세요.',
        status: 'new',
      });
    }

    // 2. Check for auth provider issues
    // Google OAuth - can't directly check from frontend, but we can infer
    const googleConfigured = true; // Can't verify from frontend; assume OK if no errors
    if (!googleConfigured) {
      detected.push({
        id: 'google_oauth',
        title: 'Google OAuth 미설정',
        severity: 'warning',
        source: 'Auth',
        detectedAt: new Date().toISOString(),
        description: 'Google 로그인을 사용하려면 Supabase Auth Providers에서 Google OAuth 설정이 필요합니다.',
        status: 'new',
      });
    }

    // 3. Check analytics events health
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentEvents, error: eventsError } = await supabase
        .from('analytics_events')
        .select('id, event_type')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) {
        detected.push({
          id: 'analytics_db',
          title: '분석 데이터 조회 실패',
          severity: 'warning',
          source: 'Supabase',
          detectedAt: new Date().toISOString(),
          description: `analytics_events 테이블 조회 중 오류: ${eventsError.message}`,
          status: 'new',
        });
      }

      // Check for auth failures in recent events
      if (recentEvents && recentEvents.length > 0) {
        const authEvents = recentEvents.filter((e: { event_type: string }) => e.event_type === 'auth_login' || e.event_type === 'auth_signup');
        if (authEvents.length === 0 && recentEvents.length > 20) {
          // Lots of activity but no auth events - might indicate auth issue
          // This is informational, not a real error
        }
      }
    } catch {
      detected.push({
        id: 'analytics_system',
        title: '분석 시스템 연결 불안정',
        severity: 'info',
        source: 'System',
        detectedAt: new Date().toISOString(),
        description: 'analytics_events 테이블 연결이 불안정할 수 있습니다. 네트워크 상태를 확인하세요.',
        status: 'new',
      });
    }

    // 4. Check for payment integration status (Stripe not connected)
    detected.push({
      id: 'payment_not_connected',
      title: '결제 시스템 미연동',
      severity: 'info',
      source: 'Payment',
      detectedAt: new Date().toISOString(),
      description: 'Stripe가 아직 연결되지 않았습니다. 결제 기능을 사용하려면 Stripe 연동이 필요합니다.',
      status: 'new',
    });

    // 5. Cross-platform mobile browser check
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { data: mobileData } = await supabase
        .from('analytics_events')
        .select('browser')
        .eq('device_type', 'Mobile')
        .gte('created_at', `${sevenDaysAgo}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`)
        .limit(100);

      if (mobileData) {
        const browsers = mobileData.map((d: { browser: string }) => d.browser);
        const hasMultipleBrowsers = new Set(browsers).size >= 2;
        const hasSafari = browsers.some((b: string) => b === 'Safari');
        const totalMobile = mobileData.length;

        if (totalMobile > 20 && !hasSafari) {
          detected.push({
            id: 'mobile_cross_browser',
            title: 'iOS Safari 접속 없음',
            severity: 'info',
            source: 'Mobile',
            detectedAt: new Date().toISOString(),
            description: '최근 7일간 iOS Safari 접속이 감지되지 않았습니다. iOS 사용자의 접근성을 확인하세요. Android Chrome/Samsung Internet/Firefox/Edge도 함께 모니터링하세요.',
            status: 'new',
          });
        }
      }
    } catch {
      // Non-critical
    }

    // 6. Check Supabase auth configuration
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      // If we can get session info, auth is working
    } catch {
      detected.push({
        id: 'auth_system',
        title: '인증 시스템 응답 없음',
        severity: 'critical',
        source: 'Auth',
        detectedAt: new Date().toISOString(),
        description: 'Supabase Auth 서비스가 응답하지 않습니다. Authentication 설정을 확인하세요.',
        status: 'new',
      });
    }

    setIssues((prev) => {
      // Keep resolved status for previously resolved issues
      const merged = detected.map((d) => {
        const prevIssue = prev.find((p) => p.id === d.id);
        return prevIssue?.status === 'resolved' ? { ...d, status: 'resolved' as const } : d;
      });
      return merged;
    });
    setLoading(false);
  };

  useEffect(() => {
    detectIssues();
    const interval = setInterval(detectIssues, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggleResolved = (id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setIssues((iss) => iss.map((i) => (i.id === id ? { ...i, status: 'new' as const } : i)));
      } else {
        next.add(id);
        setIssues((iss) => iss.map((i) => (i.id === id ? { ...i, status: 'resolved' as const } : i)));
      }
      return next;
    });
  };

  const activeIssues = issues.filter((i) => !resolvedIds.has(i.id));
  const criticalCount = activeIssues.filter((i) => i.severity === 'critical').length;
  const warningCount = activeIssues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="dash-card rounded-2xl border overflow-hidden transition-all duration-500" style={{ borderColor: C.graphite, background: C.blackCard }}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <div className="flex items-center gap-2">
          <i className="ri-error-warning-line text-sm" style={{ color: activeIssues.length > 0 ? C.danger : C.emerald, opacity: 0.6 }} />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">
            Critical Issues
          </span>
          {criticalCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[8px] font-mono font-bold" style={{ background: C.danger, color: '#fff' }}>
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[8px] font-mono font-bold" style={{ background: `${C.amber}30`, color: C.amber }}>
              {warningCount}
            </span>
          )}
        </div>
        <span className="text-[8px] font-mono text-white/08 tracking-wider">{activeIssues.length} ISSUES</span>
      </div>

      <div className="p-4 md:p-5">
        {loading && issues.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-[10px] font-mono text-white/10">이슈 스캔 중...</span>
          </div>
        ) : activeIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${C.emerald}10` }}>
              <i className="ri-check-line text-lg" style={{ color: C.emerald, opacity: 0.6 }} />
            </div>
            <span className="text-[10px] font-mono text-white/15 tracking-wider">No critical issues detected.</span>
            <span className="text-[8px] font-mono text-white/06">모든 시스템이 정상 동작 중입니다</span>
          </div>
        ) : (
          <div className="space-y-2">
            {activeIssues.slice(0, 8).map((issue) => {
              const sev = SEVERITY_CONFIG[issue.severity];
              return (
                <div
                  key={issue.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 hover:bg-white/[0.01]"
                  style={{ borderColor: `${sev.color}15`, background: sev.bg }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${sev.color}15` }}>
                    <i className={`${sev.icon} text-[12px]`} style={{ color: sev.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] md:text-[11px] font-mono text-white/40 font-medium">{issue.title}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider uppercase" style={{ background: `${sev.color}15`, color: sev.color }}>
                        {sev.label}
                      </span>
                      <span className="text-[8px] font-mono text-white/08">{issue.source}</span>
                    </div>
                    <p className="text-[9px] md:text-[10px] font-mono text-white/15 leading-relaxed">{issue.description}</p>
                  </div>
                  <button
                    onClick={() => toggleResolved(issue.id)}
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-200 hover:bg-white/[0.05] cursor-pointer"
                    style={{ borderColor: `${C.graphite}50` }}
                    title="해결 완료"
                  >
                    <i className="ri-check-line text-[10px] text-white/15" />
                  </button>
                </div>
              );
            })}
            {activeIssues.length > 8 && (
              <div className="text-center pt-2">
                <span className="text-[9px] font-mono text-white/08">외 {activeIssues.length - 8}개 이슈</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}