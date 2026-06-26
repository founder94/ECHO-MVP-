import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  white: '#F5F5F5',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
  amber: '#FBBF24',
  danger: '#F87171',
};

interface AiLogEntry {
  id: number;
  user_id: string | null;
  model: string;
  status: string;
  total_tokens: number;
  response_time_ms: number;
  total_time_ms: number;
  estimated_cost: number;
  error_message: string | null;
  safety_triggered: boolean;
  created_at: string;
}

interface AiStats {
  todayCalls: number;
  totalCalls: number;
  successRate: number;
  avgResponseTime: number;
  maxResponseTime: number;
  totalTokens: number;
  todayTokens: number;
  todayCost: number;
  monthCost: number;
  totalCost: number;
  recentLogs: AiLogEntry[];
}

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${month}.${day} ${h}:${m}`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return '<$0.01';
  return '$' + cost.toFixed(4);
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function OpenAIDashboard() {
  const [stats, setStats] = useState<AiStats>({
    todayCalls: 0,
    totalCalls: 0,
    successRate: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
    totalTokens: 0,
    todayTokens: 0,
    todayCost: 0,
    monthCost: 0,
    totalCost: 0,
    recentLogs: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'safety_triggered'>('all');

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const today = getTodayStr();
      const monthStart = getMonthStr() + '-01';

      // All logs
      const { data: allLogs, error: allErr } = await supabase
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (allErr) throw allErr;

      const logs = (allLogs || []) as AiLogEntry[];

      // Today stats
      const todayLogs = logs.filter(l => l.created_at?.startsWith(today));
      const monthLogs = logs.filter(l => l.created_at?.startsWith(monthStart));
      const successLogs = logs.filter(l => l.status === 'success');
      const todaySuccess = todayLogs.filter(l => l.status === 'success');

      setStats({
        todayCalls: todayLogs.length,
        totalCalls: logs.length,
        successRate: logs.length > 0 ? Math.round((successLogs.length / logs.length) * 100) : 0,
        avgResponseTime: successLogs.length > 0
          ? Math.round(successLogs.reduce((s, l) => s + l.response_time_ms, 0) / successLogs.length)
          : 0,
        maxResponseTime: successLogs.length > 0
          ? Math.max(...successLogs.map(l => l.response_time_ms))
          : 0,
        totalTokens: logs.reduce((s, l) => s + l.total_tokens, 0),
        todayTokens: todaySuccess.reduce((s, l) => s + l.total_tokens, 0),
        todayCost: todaySuccess.reduce((s, l) => s + (l.estimated_cost || 0), 0),
        monthCost: monthLogs.reduce((s, l) => s + (l.estimated_cost || 0), 0),
        totalCost: logs.reduce((s, l) => s + (l.estimated_cost || 0), 0),
        recentLogs: logs.slice(0, 20),
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || '데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const filteredLogs = statusFilter === 'all'
    ? stats.recentLogs
    : stats.recentLogs.filter(l => l.status === statusFilter);

  if (loading && stats.totalCalls === 0) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-brain-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">OpenAI Dashboard</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.emerald }} />
            <span className="text-[9px] font-mono text-white/12 tracking-wider">LIVE</span>
          </div>
        </div>
        <div className="p-10 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Today Calls */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.emerald}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.emerald}15` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.emerald}15` }}>
              <i className="ri-flashlight-line text-sm" style={{ color: C.emerald }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">오늘 호출</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.emerald, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {stats.todayCalls.toLocaleString()}
          </div>
        </div>

        {/* Total Calls */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.silver}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.silver}15` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.silver}12` }}>
              <i className="ri-stack-line text-sm" style={{ color: C.silver }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">누적 호출</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.silver, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {stats.totalCalls.toLocaleString()}
          </div>
        </div>

        {/* Success Rate */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${stats.successRate >= 90 ? C.emerald : stats.successRate >= 70 ? C.amber : C.danger}06 50%, ${C.blackCard} 100%)`, borderColor: `${stats.successRate >= 90 ? C.emerald : stats.successRate >= 70 ? C.amber : C.danger}15` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stats.successRate >= 90 ? C.emerald : stats.successRate >= 70 ? C.amber : C.danger}15` }}>
              <i className="ri-check-double-line text-sm" style={{ color: stats.successRate >= 90 ? C.emerald : stats.successRate >= 70 ? C.amber : C.danger }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">성공률</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: stats.successRate >= 90 ? C.emerald : stats.successRate >= 70 ? C.amber : C.danger, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {stats.successRate}%
          </div>
        </div>

        {/* Avg Response Time */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.gold}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.gold}15` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}15` }}>
              <i className="ri-speed-up-line text-sm" style={{ color: C.gold }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">평균 응답</span>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.gold, fontFamily: 'var(--font-heading, sans-serif)' }}>
              {stats.avgResponseTime.toLocaleString()}
            </div>
            <span className="text-xs font-mono text-white/20">ms</span>
          </div>
        </div>

        {/* Total Tokens */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.pink}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.pink}15` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.pink}15` }}>
              <i className="ri-database-2-line text-sm" style={{ color: C.pink }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">총 토큰</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.pink, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {(stats.totalTokens / 1000).toFixed(1)}K
          </div>
        </div>

        {/* Today Tokens */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.gold}04 50%, ${C.blackCard} 100%)`, borderColor: `${C.gold}10` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}10` }}>
              <i className="ri-flashlight-line text-sm" style={{ color: C.gold }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">오늘 토큰</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.gold, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {(stats.todayTokens / 1000).toFixed(1)}K
          </div>
        </div>

        {/* Today Cost */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.amber}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.amber}15` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.amber}15` }}>
              <i className="ri-money-dollar-circle-line text-sm" style={{ color: C.amber }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">오늘 비용</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.amber, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {formatCost(stats.todayCost)}
          </div>
        </div>

        {/* Month Cost */}
        <div
          className="dash-card relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.gold}05 50%, ${C.blackCard} 100%)`, borderColor: `${C.gold}12` }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}12` }}>
              <i className="ri-calendar-check-line text-sm" style={{ color: C.gold }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">이번 달 비용</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.gold, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {formatCost(stats.monthCost)}
          </div>
        </div>
      </div>

      {/* Response Time Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-2xl border overflow-hidden p-4 md:p-5" style={{ borderColor: C.graphite, background: C.blackCard }}>
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/15">최대 응답시간</span>
          <div className="flex items-baseline gap-1 mt-2">
            <div className="text-2xl font-display font-bold tracking-tighter text-white/60" style={{ fontFamily: 'var(--font-heading, sans-serif)' }}>
              {stats.maxResponseTime.toLocaleString()}
            </div>
            <span className="text-[10px] font-mono text-white/15">ms</span>
          </div>
        </div>
        <div className="rounded-2xl border overflow-hidden p-4 md:p-5" style={{ borderColor: C.graphite, background: C.blackCard }}>
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/15">모델</span>
          <div className="text-sm font-mono text-white/40 mt-2">gpt-4o-mini</div>
        </div>
        <div className="rounded-2xl border overflow-hidden p-4 md:p-5" style={{ borderColor: C.graphite, background: C.blackCard }}>
          <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/15">총 비용 (누적)</span>
          <div className="text-2xl font-display font-bold tracking-tighter text-white/60 mt-2" style={{ fontFamily: 'var(--font-heading, sans-serif)' }}>
            {formatCost(stats.totalCost)}
          </div>
        </div>
      </div>

      {/* Recent AI Logs Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <div className="flex items-center gap-2">
            <i className="ri-history-line text-sm text-white/20" />
            <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">AI 호출 로그</span>
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'success', 'error', 'safety_triggered'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer border ${
                  statusFilter === f
                    ? 'bg-white/[0.06] text-white/50 border-white/[0.12]'
                    : 'bg-transparent text-white/18 border-white/[0.04] hover:border-white/[0.08]'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {f === 'all' ? '전체' : f === 'success' ? '성공' : f === 'error' ? '오류' : '안전'}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-white/10 text-xs font-mono">
            {stats.totalCalls === 0 ? '아직 AI 호출이 없습니다' : '해당 상태의 로그가 없습니다'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: `${C.graphite}80` }}>
                  {['시간', '사용자', '모델', '상태', '토큰', '응답속도', '비용', '비고'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[9px] font-mono tracking-wider uppercase text-white/12 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b transition-all duration-300 hover:bg-white/[0.008]" style={{ borderColor: `${C.graphite}40` }}>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/18 whitespace-nowrap">{formatDateTime(log.created_at)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono text-white/30">{log.user_id ? `#${log.user_id.slice(-4)}` : '익명'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/15">{log.model}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold"
                        style={{
                          background: log.status === 'success' ? `${C.emerald}12` : log.status === 'safety_triggered' ? `${C.amber}12` : `${C.danger}12`,
                          color: log.status === 'success' ? C.emerald : log.status === 'safety_triggered' ? C.amber : C.danger,
                        }}
                      >
                        {log.status === 'success' ? '성공' : log.status === 'safety_triggered' ? '안전' : '오류'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/20">{log.total_tokens.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/20">{log.response_time_ms}ms</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/20">{formatCost(log.estimated_cost)}</span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      {log.error_message && (
                        <span className="text-[9px] font-mono text-red-400/40 truncate block" title={log.error_message}>
                          {log.error_message.slice(0, 40)}...
                        </span>
                      )}
                      {log.safety_triggered && (
                        <span className="text-[9px] font-mono text-amber-400/40">⚠ 안전 키워드</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 md:px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: C.graphite }}>
          <span className="text-[9px] font-mono text-white/10 tracking-wider">{stats.totalCalls} TOTAL CALLS</span>
          <span className="text-[9px] font-mono text-white/06 tracking-wider">AUTO-REFRESH 10s</span>
        </div>
      </div>
    </div>
  );
}