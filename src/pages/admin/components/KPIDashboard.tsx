import { useCountUp } from './useCountUp';

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

interface KPICardData {
  label: string;
  value: number;
  suffix?: string;
  accentColor: string;
  accentBg: string;
  icon: string;
  sub?: string;
  status?: 'active' | 'coming_soon';
  change?: { value: number; direction: 'up' | 'down' | 'neutral' };
}

function KPICard({ data, loading }: { data: KPICardData; loading: boolean }) {
  const displayed = useCountUp(data.value, 800);

  return (
    <div
      className="relative rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500 cursor-default group"
      style={{
        background: `linear-gradient(145deg, ${C.blackCard} 0%, ${data.accentColor}06 50%, ${C.blackCard} 100%)`,
        borderColor: `${data.accentColor}15`,
      }}
    >
      {data.status === 'coming_soon' && (
        <div className="absolute top-2 right-2 md:top-3 md:right-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-mono tracking-wider" style={{ background: `${C.amber}15`, color: C.amber }}>
            <i className="ri-time-line text-[8px]" />
            연결 대기
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2.5 md:mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: data.accentBg }}>
          <i className={`${data.icon} text-sm`} style={{ color: data.accentColor }} />
        </div>
        <span className="text-[9px] md:text-[10px] font-mono tracking-[0.15em] uppercase text-white/18 whitespace-nowrap">{data.label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <div
          className="font-display font-bold tracking-tighter leading-none"
          style={{ fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', color: data.accentColor, fontFamily: 'var(--font-heading, sans-serif)', opacity: data.status === 'coming_soon' ? 0.3 : 1 }}
        >
          {loading ? '...' : displayed.toLocaleString()}
        </div>
        {data.suffix && (
          <span className="text-xs md:text-sm font-mono text-white/15">{data.suffix}</span>
        )}
      </div>
      {data.sub && (
        <p className="text-[9px] md:text-[10px] text-white/12 mt-1.5 font-mono tracking-wider">{data.sub}</p>
      )}
      {data.change && data.change.direction !== 'neutral' && (
        <div className="flex items-center gap-1 mt-1.5">
          <i
            className={`${data.change.direction === 'up' ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-[9px]`}
            style={{ color: data.change.direction === 'up' ? C.emerald : C.danger }}
          />
          <span className="text-[9px] font-mono" style={{ color: data.change.direction === 'up' ? C.emerald : C.danger }}>
            {data.change.value}%
          </span>
        </div>
      )}
      {data.status === 'coming_soon' && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <span className="text-[11px] font-mono tracking-wider text-white/60">Stripe / OpenAI 연결 필요</span>
        </div>
      )}
    </div>
  );
}

interface KPIDashboardProps {
  loading: boolean;
  signupCount: number;
  loginCount: number;
  conversionRate: number;
  avgStayDuration: number;
  whiteDoorCount: number;
  newVisitors: number;
  returningVisitors: number;
  totalClicks: number;
  gfCount: number;
  activeNow: number;
}

export default function KPIDashboard({ loading, signupCount, loginCount, conversionRate, avgStayDuration, whiteDoorCount, newVisitors, returningVisitors, totalClicks, gfCount, activeNow }: KPIDashboardProps) {
  const kpiCards: KPICardData[] = [
    // ── 사용자 KPI ──
    { label: '회원가입', value: signupCount, suffix: '명', accentColor: C.emerald, accentBg: `${C.emerald}15`, icon: 'ri-user-add-line', status: 'active' },
    { label: '로그인', value: loginCount, suffix: '회', accentColor: C.silver, accentBg: `${C.silver}12`, icon: 'ri-shield-check-line', status: 'active' },
    { label: '회원 전환율', value: conversionRate, suffix: '%', accentColor: C.pink, accentBg: `${C.pink}15`, icon: 'ri-line-chart-line', sub: '방문자 → 회원가입', status: 'active' },
    { label: '현재 접속자', value: activeNow, suffix: '명', accentColor: C.emerald, accentBg: `${C.emerald}12`, icon: 'ri-user-star-line', status: 'active' },
    { label: '평균 체류시간', value: avgStayDuration, suffix: '초', accentColor: C.gold, accentBg: `${C.gold}15`, icon: 'ri-timer-line', status: 'active' },
    { label: '신규 방문자', value: newVisitors, suffix: '명', accentColor: C.emerald, accentBg: `${C.emerald}12`, icon: 'ri-user-smile-line', status: 'active' },
    { label: '재방문자', value: returningVisitors, suffix: '명', accentColor: C.silver, accentBg: `${C.silver}10`, icon: 'ri-user-heart-line', status: 'active' },
    { label: 'White Door', value: whiteDoorCount, suffix: '회', accentColor: C.pink, accentBg: `${C.pink}12`, icon: 'ri-door-open-line', status: 'active' },

    // ── 제품 KPI ──
    { label: '버튼 클릭', value: totalClicks, suffix: '회', accentColor: C.gold, accentBg: `${C.gold}12`, icon: 'ri-cursor-line', status: 'active' },
    { label: 'Google Form', value: gfCount, suffix: '회', accentColor: C.pink, accentBg: `${C.pink}10`, icon: 'ri-external-link-line', status: 'active' },

    // ── AI KPI ──
    { label: 'AI 분석 실행', value: 0, suffix: '회', accentColor: C.amber, accentBg: `${C.amber}12`, icon: 'ri-brain-line', status: 'coming_soon' },
    { label: '리포트 생성', value: 0, suffix: '건', accentColor: C.amber, accentBg: `${C.amber}10`, icon: 'ri-file-chart-line', status: 'coming_soon' },
    { label: 'AI 성공률', value: 0, suffix: '%', accentColor: C.amber, accentBg: `${C.amber}10`, icon: 'ri-check-double-line', status: 'coming_soon' },
    { label: '토큰 사용량', value: 0, suffix: 'K', accentColor: C.gold, accentBg: `${C.gold}10`, icon: 'ri-database-2-line', status: 'coming_soon' },
    { label: '예상 API 비용', value: 0, suffix: 'USD', accentColor: C.gold, accentBg: `${C.gold}10`, icon: 'ri-money-dollar-circle-line', status: 'coming_soon' },
    { label: '평균 응답시간', value: 0, suffix: 'ms', accentColor: C.silver, accentBg: `${C.silver}10`, icon: 'ri-speed-up-line', status: 'coming_soon' },

    // ── 결제 KPI ──
    { label: '결제 클릭', value: 0, suffix: '회', accentColor: C.amber, accentBg: `${C.amber}12`, icon: 'ri-bank-card-line', status: 'coming_soon' },
    { label: '결제 완료', value: 0, suffix: '건', accentColor: C.amber, accentBg: `${C.amber}10`, icon: 'ri-exchange-dollar-line', status: 'coming_soon' },
  ];

  return (
    <div>
      {/* Section headers */}
      <div className="mb-4 md:mb-5">
        <div className="flex items-center gap-2 mb-1">
          <i className="ri-user-line text-xs text-white/15" />
          <span className="text-[8px] md:text-[9px] font-mono tracking-[0.2em] uppercase text-white/12">사용자</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {kpiCards.slice(0, 8).map((card) => (
            <KPICard key={card.label} data={card} loading={loading} />
          ))}
        </div>
      </div>

      <div className="mb-4 md:mb-5">
        <div className="flex items-center gap-2 mb-1">
          <i className="ri-product-hunt-line text-xs text-white/15" />
          <span className="text-[8px] md:text-[9px] font-mono tracking-[0.2em] uppercase text-white/12">제품</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {kpiCards.slice(8, 10).map((card) => (
            <KPICard key={card.label} data={card} loading={loading} />
          ))}
        </div>
      </div>

      <div className="mb-4 md:mb-5">
        <div className="flex items-center gap-2 mb-1">
          <i className="ri-brain-line text-xs text-white/15" />
          <span className="text-[8px] md:text-[9px] font-mono tracking-[0.2em] uppercase text-white/12">AI</span>
          <span className="text-[7px] font-mono text-amber-400/40 tracking-wider">(OpenAI 연결 대기)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {kpiCards.slice(10, 16).map((card) => (
            <KPICard key={card.label} data={card} loading={loading} />
          ))}
        </div>
      </div>

      <div className="mb-4 md:mb-5">
        <div className="flex items-center gap-2 mb-1">
          <i className="ri-bank-card-line text-xs text-white/15" />
          <span className="text-[8px] md:text-[9px] font-mono tracking-[0.2em] uppercase text-white/12">결제</span>
          <span className="text-[7px] font-mono text-amber-400/40 tracking-wider">(Stripe 연결 대기)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {kpiCards.slice(16).map((card) => (
            <KPICard key={card.label} data={card} loading={loading} />
          ))}
        </div>
      </div>
    </div>
  );
}