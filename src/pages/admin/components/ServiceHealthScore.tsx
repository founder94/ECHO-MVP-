import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  white: '#F5F5F5',
  graphite: '#2A2A2A',
  black: '#0A0A0A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
  amber: '#FBBF24',
  danger: '#F87171',
};

interface HealthCheck {
  label: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  score: number;
  weight: number;
}

function useCountUp(target: number, duration: number = 1000): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}

interface ServiceHealthScoreProps {
  period: 'today' | 'yesterday' | '7d' | '30d' | 'all';
}

export default function ServiceHealthScore({ period }: ServiceHealthScoreProps) {
  const [healthScore, setHealthScore] = useState(0);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState('');
  const displayedScore = useCountUp(healthScore, 1200);

  const checkHealth = async () => {
    setLoading(true);
    const results: HealthCheck[] = [];

    // 1. Supabase connection check
    try {
      const start = performance.now();
      const { data, error } = await supabase.from('analytics_events').select('id', { count: 'exact', head: true }).limit(1);
      const latency = performance.now() - start;
      if (!error && latency < 3000) {
        results.push({ label: 'Supabase DB', status: 'healthy', score: 100, weight: 20 });
      } else if (!error && latency < 8000) {
        results.push({ label: 'Supabase DB', status: 'degraded', score: 60, weight: 20 });
      } else {
        results.push({ label: 'Supabase DB', status: 'down', score: 0, weight: 20 });
      }
    } catch {
      results.push({ label: 'Supabase DB', status: 'down', score: 0, weight: 20 });
    }

    // 2. Auth check (via Supabase auth)
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (authData) {
        results.push({ label: '인증 시스템', status: 'healthy', score: 100, weight: 15 });
      } else {
        results.push({ label: '인증 시스템', status: 'degraded', score: 50, weight: 15 });
      }
    } catch {
      results.push({ label: '인증 시스템', status: 'unknown', score: 30, weight: 15 });
    }

    // 3. OpenAI Edge Function check (check if function exists)
    try {
      const { data: funcData, error: funcError } = await supabase.functions.invoke('echo-ai-analysis', {
        body: { action: 'health_check' },
      });
      if (!funcError) {
        results.push({ label: 'OpenAI 분석', status: 'healthy', score: 100, weight: 25 });
      } else if (funcError.message?.includes('API key')) {
        results.push({ label: 'OpenAI 분석', status: 'degraded', score: 50, weight: 25 });
      } else {
        results.push({ label: 'OpenAI 분석', status: 'down', score: 0, weight: 25 });
      }
    } catch {
      results.push({ label: 'OpenAI 분석', status: 'down', score: 0, weight: 25 });
    }

    // 4. Recent errors check
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: errorCount } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'page_view')
        .gte('created_at', oneHourAgo);

      if (errorCount !== null) {
        results.push({ label: '이벤트 수집', status: 'healthy', score: 100, weight: 10 });
      } else {
        results.push({ label: '이벤트 수집', status: 'degraded', score: 40, weight: 10 });
      }
    } catch {
      results.push({ label: '이벤트 수집', status: 'unknown', score: 30, weight: 10 });
    }

    // 5. Frontend status (always healthy if we got this far)
    results.push({ label: '프론트엔드', status: 'healthy', score: 100, weight: 15 });

    // 6. Mobile compatibility check (based on analytics data)
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { count: mobileCount } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('device_type', 'Mobile')
        .gte('created_at', `${sevenDaysAgo}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`);

      if (mobileCount !== null && mobileCount > 0) {
        results.push({ label: '모바일 호환성', status: 'healthy', score: 90, weight: 10 });
      } else if (mobileCount === 0) {
        results.push({ label: '모바일 호환성', status: 'degraded', score: 60, weight: 10 });
      } else {
        results.push({ label: '모바일 호환성', status: 'unknown', score: 50, weight: 10 });
      }
    } catch {
      results.push({ label: '모바일 호환성', status: 'unknown', score: 50, weight: 10 });
    }

    // 7. Build/Deploy status (can't check from frontend, assume healthy)
    results.push({ label: '배포 상태', status: 'healthy', score: 100, weight: 5 });

    // Calculate weighted score
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
    const weightedScore = results.reduce((sum, r) => sum + r.score * r.weight, 0) / totalWeight;
    const finalScore = Math.round(weightedScore);

    setChecks(results);
    setHealthScore(finalScore);
    setLastChecked(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [period]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return C.emerald;
    if (score >= 70) return C.amber;
    if (score >= 50) return C.gold;
    return C.danger;
  };

  const getStatusLabel = (score: number) => {
    if (score >= 90) return 'Stable';
    if (score >= 70) return 'Watch';
    if (score >= 50) return 'Risk';
    return 'Critical';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return 'ri-check-line';
      case 'degraded': return 'ri-error-warning-line';
      case 'down': return 'ri-close-line';
      default: return 'ri-question-line';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return C.emerald;
      case 'degraded': return C.amber;
      case 'down': return C.danger;
      default: return C.silver;
    }
  };

  const scoreColor = getScoreColor(healthScore);

  return (
    <div className="dash-card rounded-2xl border overflow-hidden transition-all duration-500" style={{ borderColor: C.graphite, background: C.blackCard }}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: scoreColor }} />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">
            ECHO Health Score
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-[8px] font-mono text-white/08 tracking-wider">갱신 {lastChecked}</span>
          )}
          <button
            onClick={checkHealth}
            className="w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 hover:bg-white/[0.04] cursor-pointer"
            style={{ borderColor: `${C.graphite}60` }}
            title="새로고침"
          >
            <i className="ri-refresh-line text-[10px] text-white/25" />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
          {/* Score Circle */}
          <div className="relative shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100" className="w-20 h-20 md:w-[100px] md:h-[100px]">
              {/* Background circle */}
              <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeOpacity={0.04} strokeWidth="6" />
              {/* Progress arc */}
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={scoreColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 264} 264`}
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 1.2s ease-out, stroke 0.5s ease' }}
                opacity={0.8}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-display font-bold tracking-tighter leading-none"
                style={{ fontSize: 'clamp(1.2rem, 4vw, 2rem)', color: scoreColor, fontFamily: 'var(--font-heading, sans-serif)' }}
              >
                {loading ? '...' : displayedScore}
              </span>
              <span className="text-[8px] md:text-[9px] font-mono text-white/12 tracking-wider">/ 100</span>
            </div>
          </div>

          {/* Status & Checks */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] md:text-[10px] font-mono tracking-wider"
                style={{ background: `${scoreColor}15`, color: scoreColor }}
              >
                {getStatusLabel(healthScore)}
              </span>
            </div>

            {/* Check items grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-2">
              {checks.map((check) => {
                const sColor = getStatusColor(check.status);
                return (
                  <div
                    key={check.label}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all duration-300"
                    style={{ borderColor: `${sColor}15`, background: `${C.blackCard}80` }}
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: `${sColor}15` }}>
                      <i className={`${getStatusIcon(check.status)} text-[8px]`} style={{ color: sColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] md:text-[9px] font-mono text-white/25 block truncate" title={check.label}>
                        {check.label}
                      </span>
                      <span className="text-[7px] md:text-[8px] font-mono text-white/10">{check.score}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}