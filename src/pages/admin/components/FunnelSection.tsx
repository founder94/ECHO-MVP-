import type { EnhancedFunnel } from '@/hooks/useAnalytics';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  amber: '#FBBF24',
  emerald: '#6EE7B7',
};

function EnhancedFunnelChart({ data }: { data: EnhancedFunnel[] }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-40 text-white/10 text-xs font-mono">데이터 없음</div>;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const w = 600;
  const h = data.length * 56 + 60;
  const barH = 32;
  const pad = { l: 110, r: 90 };
  const plotW = w - pad.l - pad.r;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barW = Math.max((d.count / maxVal) * plotW, 6);
        const y = 24 + i * 56;
        const isActive = d.status === 'active';
        const c = isActive ? [C.gold, C.pink, C.emerald, C.silver, C.amber, C.amber, C.pink, C.amber][i % 8] : C.graphite;

        return (
          <g key={i}>
            {/* Step number */}
            <text x={14} y={y + barH / 2 + 3} textAnchor="middle" fill="white" fillOpacity={isActive ? 0.3 : 0.06} fontSize="10" fontFamily="monospace" fontWeight="bold">
              {String(i + 1).padStart(2, '0')}
            </text>

            {/* Label */}
            <text x={pad.l - 8} y={y + barH / 2 + 3} textAnchor="end" fill="white" fillOpacity={isActive ? 0.5 : 0.12} fontSize="10" fontFamily="monospace">
              {d.label}
            </text>

            {/* Bar */}
            <rect x={pad.l} y={y} width={barW} height={barH} rx={6} fill={c} fillOpacity={isActive ? 0.3 : 0.06} />

            {/* Count + Rate */}
            <text x={pad.l + barW + 8} y={y + barH / 2 + 3} fill="white" fillOpacity={isActive ? 0.35 : 0.1} fontSize="9" fontFamily="monospace">
              {isActive ? `${d.count.toLocaleString()}명 • ${d.rate}%` : '연결 대기'}
            </text>

            {/* Drop-off indicator */}
            {isActive && d.dropOff > 0 && i < data.length - 1 && (
              <g>
                <line x1={pad.l + 4} y1={y + barH + 4} x2={pad.l + 4} y2={y + barH + 16} stroke="white" strokeOpacity={0.04} />
                <text x={pad.l + 12} y={y + barH + 14} fill={C.pink} fillOpacity={0.4} fontSize="8" fontFamily="monospace">
                  이탈 {d.dropOff}%
                </text>
              </g>
            )}

            {/* Status badge */}
            {!isActive && (
              <text x={w - 18} y={y + barH / 2 + 3} textAnchor="end" fill={C.amber} fillOpacity={0.5} fontSize="8" fontFamily="monospace">
                <tspan dx={0} dy={0}>⏳</tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface FunnelSectionProps {
  data: EnhancedFunnel[];
  loading: boolean;
}

export default function FunnelSection({ data, loading }: FunnelSectionProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-filter-3-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">전환 퍼널</span>
        </div>
        <div className="p-6 flex items-center justify-center h-60">
          <span className="text-white/10 text-xs font-mono">로딩 중...</span>
        </div>
      </div>
    );
  }

  const activeSteps = data.filter((d) => d.status === 'active');
  const comingSoonSteps = data.filter((d) => d.status === 'coming_soon');

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <div className="flex items-center gap-2">
          <i className="ri-filter-3-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">전환 퍼널</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-white/10">
            {activeSteps.length} 활성 / {comingSoonSteps.length} 대기
          </span>
        </div>
      </div>
      <div className="p-4">
        <EnhancedFunnelChart data={data} />
      </div>
      {comingSoonSteps.length > 0 && (
        <div className="px-4 md:px-6 py-3 border-t flex items-center gap-2" style={{ borderColor: C.graphite }}>
          <i className="ri-information-line text-[10px]" style={{ color: C.amber, opacity: 0.6 }} />
          <span className="text-[8px] md:text-[9px] font-mono text-white/10 tracking-wider">
            AI 분석 및 결제 단계는 Stripe / OpenAI 연결 후 활성화됩니다
          </span>
        </div>
      )}
    </div>
  );
}