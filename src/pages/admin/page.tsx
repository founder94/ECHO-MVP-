import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getTodayVisitCount,
  getTotalVisitorCount,
  getGoogleFormCount,
  getButtonClickStats,
  getPageVisitStats,
  getRecentActivity,
  getActiveNowCount,
  getLastActivityTime,
  getConversionFunnel,
  getDeviceRatio,
  getReferrerStats,
  getSectionTimeStats,
  getVisitorTrend,
  getVisitorProfiles,
  getSignupCount,
  getLoginCount,
  getWhiteDoorCount,
  getAvgStayDuration,
  getConversionRate,
  getEnhancedFunnel,
  getLiveVisitors,
  getButtonCTRStats,
  getRecentNotifications,
  getNewVsReturning,
  type ClickStat,
  type PageStat,
  type ActivityLogEntry,
  type ConversionFunnel,
  type DeviceRatio,
  type ReferrerStat,
  type SectionTimeStat,
  type VisitorProfile,
  type LiveVisitor,
  type ButtonCTR,
  type EnhancedFunnel,
  type NotificationItem,
} from '@/hooks/useAnalytics';
import { useAuth } from '@/hooks/useAuth';
import KPIDashboard from './components/KPIDashboard';
import FunnelSection from './components/FunnelSection';
import LiveVisitorPanel from './components/LiveVisitorPanel';
import ButtonDetailPanel from './components/ButtonDetailPanel';
import ComingSoonPanel from './components/ComingSoonPanel';
import NotificationBell from './components/NotificationBell';

import ServiceHealthScore from './components/ServiceHealthScore';
import CriticalIssues from './components/CriticalIssues';
import FounderToday from './components/FounderToday';
import ErrorCenter from './components/ErrorCenter';
import OpenAIDashboard from './components/OpenAIDashboard';
import UserManagement from './components/UserManagement';
import MobileOpsDashboard from './components/MobileOpsDashboard';
import FeatureControlPanel from './components/FeatureControlPanel';
import NotificationCenter from './components/NotificationCenter';
import ReleaseDashboard from './components/ReleaseDashboard';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  white: '#F5F5F5',
  graphite: '#2A2A2A',
  black: '#0A0A0A',
  blackCard: '#0F0F0F',
  danger: '#F87171',
};

// ── Helpers ────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}.${month}.${day} ${h}:${m}`;
}

function formatDateShort(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ── CountUp Animation ──────────────────────────────────

function useCountUp(target: number, duration: number = 800): number {
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

// ── Time Period Filter ─────────────────────────────────

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'all';

function getPeriodRange(period: Period): { from: string; to: string; label: string } {
  const today = getTodayStr();
  switch (period) {
    case 'today':
      return { from: today, to: today, label: '오늘' };
    case 'yesterday':
      return { from: getDateStr(1), to: getDateStr(1), label: '어제' };
    case '7d':
      return { from: getDateStr(6), to: today, label: '최근 7일' };
    case '30d':
      return { from: getDateStr(29), to: today, label: '최근 30일' };
    case 'all':
      return { from: '2024-01-01', to: today, label: '전체' };
  }
}

// ── StatsCard ──────────────────────────────────────────

function StatsCard({ label, value, accentColor, accentBg, icon, sub, loading }: {
  label: string; value: number; accentColor: string; accentBg: string; icon: string; sub?: string; loading?: boolean;
}) {
  const displayed = useCountUp(value, 1000);
  return (
    <div
      className="relative rounded-2xl border overflow-hidden p-5 md:p-8 transition-all duration-500 cursor-default"
      style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${accentColor}06 50%, ${C.blackCard} 100%)`, borderColor: `${accentColor}15` }}
    >
      <div className="flex items-center gap-2.5 md:gap-3 mb-3 md:mb-4">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center" style={{ background: accentBg }}>
          <i className={`${icon} text-base md:text-lg`} style={{ color: accentColor }} />
        </div>
        <span className="text-[10px] md:text-[11px] font-mono tracking-[0.2em] uppercase text-white/20 whitespace-nowrap">{label}</span>
      </div>
      <div
        className="font-display font-bold tracking-tighter leading-none mb-1 transition-all"
        style={{ fontSize: 'clamp(2rem, 8vw, 4rem)', color: accentColor, fontFamily: 'var(--font-heading, sans-serif)' }}
      >
        {loading ? '...' : displayed.toLocaleString()}
      </div>
      {sub && <p className="text-[10px] md:text-xs text-white/25 mt-1">{sub}</p>}
    </div>
  );
}

// ── TabButton ──────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-4 py-2 rounded-full text-[10px] md:text-xs font-mono tracking-wider uppercase transition-all duration-300 whitespace-nowrap cursor-pointer border ${
        active ? 'bg-white/[0.06] text-white/70 border-white/[0.12]' : 'bg-transparent text-white/25 border-white/[0.04] hover:border-white/[0.10] hover:text-white/40'
      }`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
    </button>
  );
}

// ── Period Filter Tabs ─────────────────────────────────

function PeriodFilter({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const options: { key: Period; label: string }[] = [
    { key: 'today', label: '오늘' },
    { key: 'yesterday', label: '어제' },
    { key: '7d', label: '7일' },
    { key: '30d', label: '30일' },
    { key: 'all', label: '전체' },
  ];
  return (
    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-mono tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer border ${
            period === opt.key
              ? 'bg-white/[0.08] text-white/70 border-white/[0.15]'
              : 'bg-transparent text-white/25 border-white/[0.04] hover:border-white/[0.10] hover:text-white/40'
          }`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CHART COMPONENTS (Inline SVG)
// ═══════════════════════════════════════════════════════

function LineChart({ data, color, height }: { data: { date: string; count: number }[]; color: string; height: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-40 text-white/10 text-xs font-mono">데이터 없음</div>;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const w = 600;
  const h = height;
  const pad = { t: 10, r: 20, b: 30, l: 40 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const points = data
    .map((d, i) => {
      const x = pad.l + (i / Math.max(data.length - 1, 1)) * plotW;
      const y = pad.t + plotH - (d.count / maxVal) * plotH;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPath = `${points} ${pad.l + plotW},${pad.t + plotH} ${pad.l},${pad.t + plotH}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.t + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="white" strokeOpacity={0.04} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fill="white" fillOpacity={0.12} fontSize="8" fontFamily="monospace">{Math.round(maxVal * frac)}</text>
          </g>
        );
      })}
      {/* Area fill */}
      <polygon points={areaPath} fill={color} fillOpacity={0.08} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.8} />
      {/* Dots */}
      {data.map((d, i) => {
        const x = pad.l + (i / Math.max(data.length - 1, 1)) * plotW;
        const y = pad.t + plotH - (d.count / maxVal) * plotH;
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} fillOpacity={0.9} />;
      })}
      {/* X labels */}
      {data.map((d, i) => {
        if (data.length > 10 && i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return null;
        const x = pad.l + (i / Math.max(data.length - 1, 1)) * plotW;
        return (
          <text key={`xl-${i}`} x={x} y={h - 6} textAnchor="middle" fill="white" fillOpacity={0.15} fontSize="7" fontFamily="monospace">
            {d.date.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

function BarChart({ data, color, height }: { data: { buttonName: string; count: number }[]; color: string; height: number }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-40 text-white/10 text-xs font-mono">데이터 없음</div>;
  const top = data.slice(0, 10);
  const maxVal = Math.max(...top.map((d) => d.count), 1);
  const w = 500;
  const h = height;
  const pad = { t: 10, r: 20, b: 60, l: 80 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const barW = Math.min(plotW / top.length - 6, 30);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map((frac) => {
        const y = pad.t + plotH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="white" strokeOpacity={0.04} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fill="white" fillOpacity={0.12} fontSize="8" fontFamily="monospace">{Math.round(maxVal * frac)}</text>
          </g>
        );
      })}
      {top.map((d, i) => {
        const barH = (d.count / maxVal) * plotH;
        const x = pad.l + i * (plotW / top.length) + (plotW / top.length - barW) / 2;
        const y = pad.t + plotH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={2} fill={color} fillOpacity={0.7} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="white" fillOpacity={0.3} fontSize="8" fontFamily="monospace">{d.count}</text>
            <text x={x + barW / 2} y={h - 4} textAnchor="end" fill="white" fillOpacity={0.2} fontSize="7" fontFamily="monospace" transform={`rotate(-35, ${x + barW / 2}, ${h - 4})`}>
              {d.buttonName.length > 8 ? d.buttonName.slice(0, 8) + '…' : d.buttonName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function FunnelChart({ data }: { data: ConversionFunnel[] }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-40 text-white/10 text-xs font-mono">데이터 없음</div>;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const w = 400;
  const h = data.length * 50 + 40;
  const barH = 28;
  const pad = { l: 100, r: 20 };
  const plotW = w - pad.l - pad.r;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barW = (d.count / maxVal) * plotW;
        const y = 20 + i * 50;
        const colors = [C.gold, C.pink, C.silver, C.gold, C.pink];
        const c = colors[i % colors.length];
        return (
          <g key={i}>
            <text x={pad.l - 8} y={y + barH / 2 + 3} textAnchor="end" fill="white" fillOpacity={0.4} fontSize="9" fontFamily="monospace">{d.label}</text>
            <rect x={pad.l} y={y} width={Math.max(barW, 4)} height={barH} rx={3} fill={c} fillOpacity={0.25} />
            <text x={pad.l + Math.max(barW, 4) + 6} y={y + barH / 2 + 3} fill="white" fillOpacity={0.3} fontSize="9" fontFamily="monospace">
              {d.count}명 • {d.rate}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data }: { data: DeviceRatio[] }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-40 text-white/10 text-xs font-mono">데이터 없음</div>;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const w = 160;
  const h = 160;
  const cx = w / 2;
  const cy = h / 2;
  const outerR = 65;
  const innerR = 40;
  const colors = [C.gold, C.silver, C.pink, '#ffffff40'];

  let cumulativeAngle = -Math.PI / 2;

  const slices = data.map((d, i) => {
    const sliceAngle = (d.count / total) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    cumulativeAngle += sliceAngle;
    const endAngle = cumulativeAngle;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const x3 = cx + innerR * Math.cos(endAngle);
    const y3 = cy + innerR * Math.sin(endAngle);
    const x4 = cx + innerR * Math.cos(startAngle);
    const y4 = cy + innerR * Math.sin(startAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const path = `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${largeArc} 0 ${x4},${y4} Z`;

    return { path, color: colors[i % colors.length], label: d.device, ratio: d.ratio };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto mx-auto" preserveAspectRatio="xMidYMid meet">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} fillOpacity={0.6} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fillOpacity={0.6} fontSize="16" fontFamily="var(--font-heading, sans-serif)" fontWeight="bold">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="white" fillOpacity={0.2} fontSize="8" fontFamily="monospace">방문</text>
    </svg>
  );
}

// ── Visitor Card (Mobile) ──────────────────────────────

function VisitorMobileCard({ v }: { v: VisitorProfile }) {
  return (
    <div className="rounded-xl border p-4 space-y-2.5" style={{ borderColor: `${C.graphite}60`, background: `${C.blackCard}80` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-white/60">{v.name || `익명 #${v.visitorId.slice(-4)}`}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold" style={{ background: `${C.gold}15`, color: C.gold }}>
          {v.totalVisits}회
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-white/15 text-[9px] font-mono uppercase tracking-wider">디바이스</span>
          <p className="text-white/25 mt-0.5">{v.device} / {v.browser}</p>
        </div>
        <div>
          <span className="text-white/15 text-[9px] font-mono uppercase tracking-wider">OS</span>
          <p className="text-white/25 mt-0.5">{v.os}</p>
        </div>
        <div className="col-span-2">
          <span className="text-white/15 text-[9px] font-mono uppercase tracking-wider">마지막 방문</span>
          <p className="text-white/20 mt-0.5">{formatDateTime(v.lastVisitAt)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Click Stats Card (Mobile) ──────────────────────────

function ClickStatsMobileCard({ c }: { c: ClickStat }) {
  return (
    <div className="rounded-xl border p-4 flex items-center justify-between" style={{ borderColor: `${C.graphite}60`, background: `${C.blackCard}80` }}>
      <span className="text-sm font-mono text-white/50">{c.buttonName}</span>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-white/20">{formatDateTime(c.lastClickedAt)}</span>
        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[10px] font-mono font-bold" style={{ background: `${C.gold}15`, color: C.gold }}>
          {c.count}회
        </span>
      </div>
    </div>
  );
}

// ── Page Stats Card (Mobile) ───────────────────────────

function PageStatsMobileCard({ p }: { p: PageStat }) {
  const maxCount = p.count; // ratio already calculated
  return (
    <div className="rounded-xl border p-4 flex items-center justify-between" style={{ borderColor: `${C.graphite}60`, background: `${C.blackCard}80` }}>
      <div className="flex-1 min-w-0 mr-3">
        <span className="text-sm font-mono text-white/50">{p.page}</span>
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: `${C.graphite}40` }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p.ratio}%`, background: C.pink, opacity: 0.5 }} />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-mono text-white/15">{p.ratio}%</span>
        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[10px] font-mono font-bold" style={{ background: `${C.pink}15`, color: C.pink }}>
          {p.count}
        </span>
      </div>
    </div>
  );
}

// ── Activity Card (Mobile) ─────────────────────────────

function ActivityMobileCard({ a }: { a: ActivityLogEntry }) {
  const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
    VISIT: { icon: 'ri-user-line', color: C.silver, bg: `${C.silver}12` },
    CLICK: { icon: 'ri-cursor-line', color: C.gold, bg: `${C.gold}15` },
    GOOGLE_FORM: { icon: 'ri-external-link-line', color: C.pink, bg: `${C.pink}15` },
    AUTH: { icon: 'ri-shield-check-line', color: C.gold, bg: `${C.gold}12` },
    SECTION: { icon: 'ri-focus-2-line', color: C.pink, bg: `${C.pink}12` },
    WHITE_DOOR: { icon: 'ri-door-open-line', color: C.silver, bg: `${C.silver}10` },
  };
  const tc = typeConfig[a.type] || { icon: 'ri-information-line', color: C.silver, bg: `${C.silver}10` };

  return (
    <div className="rounded-xl border p-4 flex items-start gap-3" style={{ borderColor: `${C.graphite}60`, background: `${C.blackCard}80` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: tc.bg }}>
        <i className={`${tc.icon} text-sm`} style={{ color: tc.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-mono text-white/40 truncate">{a.visitorName}</span>
          <span className="text-[9px] font-mono text-white/12 shrink-0">{formatDateShort(a.timestamp)} {formatTime(a.timestamp)}</span>
        </div>
        <p className="text-[11px] font-mono text-white/25">{a.message}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {a.page && <span className="text-[8px] font-mono text-white/10">{a.page}</span>}
          {a.device && <span className="text-[8px] font-mono text-white/10">{a.device}</span>}
          {a.browser && <span className="text-[8px] font-mono text-white/10">{a.browser}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Referrer List ──────────────────────────────────────

function ReferrerList({ data }: { data: ReferrerStat[] }) {
  if (data.length === 0) return <div className="text-center py-8 text-white/10 text-xs font-mono">데이터 없음</div>;
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.referrer} className="flex items-center justify-between py-2 px-3 rounded-lg border" style={{ borderColor: `${C.graphite}40`, background: `${C.blackCard}60` }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs font-mono text-white/45">{r.referrer}</span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: `${C.graphite}40` }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${r.ratio}%`, background: C.gold, opacity: 0.4 }} />
            </div>
          </div>
          <span className="text-[10px] font-mono text-white/20 ml-3 shrink-0">{r.count}회 ({r.ratio}%)</span>
        </div>
      ))}
    </div>
  );
}

// ── Section Time List ──────────────────────────────────

function SectionTimeList({ data }: { data: SectionTimeStat[] }) {
  if (data.length === 0) return <div className="text-center py-8 text-white/10 text-xs font-mono">데이터 없음</div>;
  return (
    <div className="space-y-2">
      {data.map((s) => (
        <div key={s.section} className="flex items-center justify-between py-2.5 px-3 rounded-lg border" style={{ borderColor: `${C.graphite}40`, background: `${C.blackCard}60` }}>
          <span className="text-xs font-mono text-white/45">{s.section}</span>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-white/18">{s.visits}회</span>
            <span className="text-[10px] font-mono text-white/25">{s.avgStaySeconds}s (평균)</span>
            <span className="text-[10px] font-mono text-white/15">{s.totalStaySeconds}s 총합</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN ADMIN PAGE
// ═══════════════════════════════════════════════════════

export default function AdminPage() {
  const { currentUser, profile, loading: authLoading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'analytics' | 'activity' | 'kpi' | 'funnel' | 'live' | 'buttons' | 'openai' | 'errors' | 'users' | 'mobile' | 'features' | 'notifications' | 'release'>('overview');
  const [period, setPeriod] = useState<Period>('today');

  const isAdmin = isAuthenticated && profile?.role === 'admin';

  // Data states
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [activeNow, setActiveNow] = useState(0);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [gfCount, setGfCount] = useState(0);
  const [clickStats, setClickStats] = useState<ClickStat[]>([]);
  const [pageStats, setPageStats] = useState<PageStat[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [funnel, setFunnel] = useState<ConversionFunnel[]>([]);
  const [deviceRatio, setDeviceRatio] = useState<DeviceRatio[]>([]);
  const [referrerStats, setReferrerStats] = useState<ReferrerStat[]>([]);
  const [sectionStats, setSectionStats] = useState<SectionTimeStat[]>([]);
  const [visitorTrend, setVisitorTrend] = useState<{ date: string; count: number }[]>([]);
  const [visitors, setVisitors] = useState<VisitorProfile[]>([]);
  // New enhanced data states
  const [signupCount, setSignupCount] = useState(0);
  const [loginCount, setLoginCount] = useState(0);
  const [whiteDoorCount, setWhiteDoorCount] = useState(0);
  const [avgStayDuration, setAvgStayDuration] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [enhancedFunnel, setEnhancedFunnel] = useState<EnhancedFunnel[]>([]);
  const [liveVisitors, setLiveVisitors] = useState<LiveVisitor[]>([]);
  const [buttonCTRStats, setButtonCTRStats] = useState<ButtonCTR[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [newVsReturning, setNewVsReturning] = useState({ newVisitors: 0, returningVisitors: 0 });

  const dashboardRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const range = getPeriodRange(period);

    try {
      const [
        todayVisits,
        totalV,
        activeN,
        lastAct,
        googleF,
        clicks,
        pages,
        recent,
        funnelData,
        deviceD,
        referrerD,
        sectionD,
        trend,
        visitorProfiles,
        // New enhanced data
        signupC,
        loginC,
        wdCount,
        avgStay,
        convRate,
        enhancedFun,
        liveVis,
        buttonCTR,
        notifs,
        newRet,
      ] = await Promise.all([
        getTodayVisitCount().catch(() => 0),
        getTotalVisitorCount().catch(() => 0),
        getActiveNowCount().catch(() => 0),
        getLastActivityTime().catch(() => null),
        getGoogleFormCount(range.from, range.to).catch(() => 0),
        getButtonClickStats(range.from, range.to).catch(() => []),
        getPageVisitStats(range.from, range.to).catch(() => []),
        getRecentActivity(150).catch(() => []),
        getConversionFunnel(range.from, range.to).catch(() => []),
        getDeviceRatio(range.from, range.to).catch(() => []),
        getReferrerStats(range.from, range.to).catch(() => []),
        getSectionTimeStats(range.from, range.to).catch(() => []),
        getVisitorTrend(range.from, range.to).catch(() => []),
        getVisitorProfiles(range.from, range.to).catch(() => []),
        // New enhanced data
        getSignupCount(range.from, range.to).catch(() => 0),
        getLoginCount(range.from, range.to).catch(() => 0),
        getWhiteDoorCount(range.from, range.to).catch(() => 0),
        getAvgStayDuration(range.from, range.to).catch(() => 0),
        getConversionRate(range.from, range.to).catch(() => 0),
        getEnhancedFunnel(range.from, range.to).catch(() => []),
        getLiveVisitors().catch(() => []),
        getButtonCTRStats(range.from, range.to).catch(() => []),
        getRecentNotifications().catch(() => []),
        getNewVsReturning(range.from, range.to).catch(() => ({ newVisitors: 0, returningVisitors: 0 })),
      ]);

      setTodayCount(todayVisits);
      setTotalVisitors(totalV);
      setActiveNow(activeN);
      setLastActivity(lastAct);
      setGfCount(googleF);
      setClickStats(clicks);
      setPageStats(pages);
      setActivity(recent);
      setFunnel(funnelData);
      setDeviceRatio(deviceD);
      setReferrerStats(referrerD);
      setSectionStats(sectionD);
      setVisitorTrend(trend);
      setVisitors(visitorProfiles);
      // Set new enhanced data
      setSignupCount(signupC);
      setLoginCount(loginC);
      setWhiteDoorCount(wdCount);
      setAvgStayDuration(avgStay);
      setConversionRate(convRate);
      setEnhancedFunnel(enhancedFun);
      setLiveVisitors(liveVis);
      setButtonCTRStats(buttonCTR);
      setNotifications(notifs);
      setNewVsReturning(newRet);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [period]);

  const handleLogout = async () => {
    await logout(currentUser?.id);
    navigate('/');
  };

  // Notification handlers
  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleClearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Load data on auth & period change
  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin, loadData]);

  // Auto-refresh every 5s + visibility change
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(loadData, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAdmin, loadData]);

  // Staggered entrance
  useEffect(() => {
    if (!isAdmin || !dashboardRef.current) return;
    const cards = dashboardRef.current.querySelectorAll('.dash-card');
    cards.forEach((card, i) => {
      const el = card as HTMLElement;
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * 60);
    });
  }, [isAdmin, activeTab, period]);

  const totalClicks = clickStats.reduce((sum, c) => sum + c.count, 0);
  const todayStr = getTodayStr();
  const rangeLabel = getPeriodRange(period).label;

  // ═══════════════════════════════════════════════════════
  // AUTH GATE — Supabase Auth + Role 기반 접근 제어
  // ═══════════════════════════════════════════════════════

  // Loading state
  if (authLoading) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden" style={{ background: C.black }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 35%, ${C.gold}04 0%, transparent 50%), radial-gradient(ellipse 40% 30% at 35% 65%, ${C.pink}03 0%, transparent 50%)`,
        }} />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F5D4A1] animate-spin" />
          <span className="text-xs font-mono text-white/15">인증 확인 중...</span>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!isAuthenticated) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden" style={{ background: C.black }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 35%, ${C.gold}04 0%, transparent 50%), radial-gradient(ellipse 40% 30% at 35% 65%, ${C.pink}03 0%, transparent 50%)`,
        }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, ${C.white} 1px, transparent 1px), linear-gradient(to bottom, ${C.white} 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 w-full max-w-sm mx-auto px-6 text-center">
          <span className="text-[10px] font-mono tracking-[0.4em] uppercase text-white/10">Admin Console</span>
          <h1 className="font-display font-bold text-2xl text-white mt-3 mb-1" style={{ fontFamily: 'var(--font-heading, sans-serif)' }}>
            ECHO ADMIN
          </h1>
          <p className="text-xs text-white/15 mb-8">Human Relationship OS Dashboard</p>
          <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: `${C.gold}20`, background: `${C.blackCard}80` }}>
            <i className="ri-shield-check-line text-3xl mb-3 block" style={{ color: C.gold }} />
            <p className="text-sm text-white/40 mb-4">관리자 페이지입니다.<br />로그인이 필요합니다.</p>
            <Link
              to="/auth"
              className="inline-block w-full rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer active:scale-95"
              style={{ background: C.gold, color: C.black, WebkitTapHighlightColor: 'transparent' }}
            >
              로그인하러 가기
            </Link>
          </div>
          <p className="text-[10px] font-mono text-white/05">
            ECHO Admin Console v4.0
          </p>
        </div>
      </div>
    );
  }

  // Authenticated but not admin
  if (!isAdmin) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center overflow-hidden" style={{ background: C.black }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 35%, ${C.gold}04 0%, transparent 50%), radial-gradient(ellipse 40% 30% at 35% 65%, ${C.pink}03 0%, transparent 50%)`,
        }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, ${C.white} 1px, transparent 1px), linear-gradient(to bottom, ${C.white} 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 w-full max-w-sm mx-auto px-6 text-center">
          <span className="text-[10px] font-mono tracking-[0.4em] uppercase text-white/10">Admin Console</span>
          <h1 className="font-display font-bold text-2xl text-white mt-3 mb-1" style={{ fontFamily: 'var(--font-heading, sans-serif)' }}>
            ECHO ADMIN
          </h1>
          <p className="text-xs text-white/15 mb-8">Human Relationship OS Dashboard</p>
          <div className="rounded-2xl border p-6 mb-6" style={{ borderColor: `${C.danger}30`, background: `${C.blackCard}80` }}>
            <i className="ri-error-warning-line text-3xl mb-3 block" style={{ color: C.danger }} />
            <p className="text-sm text-white/40 mb-2">접근 권한이 없습니다.</p>
            <p className="text-xs text-white/15 mb-4">관리자 계정만 접근할 수 있습니다.</p>
            <button
              onClick={handleLogout}
              className="inline-block w-full rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-all duration-300 whitespace-nowrap cursor-pointer active:scale-95 border"
              style={{ color: C.silver, borderColor: `${C.silver}20`, background: 'transparent', WebkitTapHighlightColor: 'transparent' }}
            >
              로그아웃
            </button>
          </div>
          <p className="text-[10px] font-mono text-white/05">
            ECHO Admin Console v4.0
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════
  return (
    <div className="relative w-full min-h-screen" style={{ background: C.black }}>
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 60% 40% at 50% 30%, ${C.gold}03 0%, transparent 50%), radial-gradient(ellipse 40% 35% at 30% 70%, ${C.pink}03 0%, transparent 50%)`,
      }} />
      <div className="fixed inset-0 pointer-events-none opacity-[0.015]" style={{
        backgroundImage: `linear-gradient(to right, ${C.white} 1px, transparent 1px), linear-gradient(to bottom, ${C.white} 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />

      <div ref={dashboardRef} className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pb-20 pt-6 md:pt-12">
        {/* ── Header ───────────────────────────────── */}
        <div className="dash-card flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <div>
            <span className="text-[9px] font-mono tracking-[0.35em] uppercase text-white/10">Analytics Dashboard</span>
            <h1 className="font-display font-bold text-xl md:text-2xl text-white mt-1.5" style={{ fontFamily: 'var(--font-heading, sans-serif)' }}>
              ECHO ADMIN
            </h1>
            <p className="text-[10px] md:text-[11px] text-white/15 mt-1 font-mono tracking-wider">Human Relationship OS Behavior Analytics</p>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <NotificationBell
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onClear={handleClearNotifications}
            />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.gold }} />
              <span className="text-[9px] md:text-[10px] font-mono text-white/15 tracking-wider">LIVE</span>
            </div>
            <span className="text-[10px] md:text-[11px] font-mono text-white/20">{todayStr}</span>
            <button
              onClick={handleLogout}
              className="px-3 md:px-4 py-2 rounded-full text-[11px] md:text-xs font-medium text-white/30 border border-white/[0.08] hover:text-white/60 hover:border-white/[0.15] active:scale-95 transition-all duration-300 whitespace-nowrap cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* ── Period Filter ─────────────────────────── */}
        <div className="dash-card flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 md:mb-6 gap-3">
          <PeriodFilter period={period} onChange={setPeriod} />
          <span className="text-[9px] md:text-[10px] font-mono text-white/10 tracking-wider">{rangeLabel} 기준</span>
        </div>

        {/* ── Stats Cards ───────────────────────────── */}
        <div className="dash-card grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-5 mb-5 md:mb-6">
          <StatsCard label={`방문자 (${rangeLabel})`} value={todayCount} accentColor={C.gold} accentBg={`${C.gold}15`} icon="ri-user-smile-line" sub={todayStr} loading={loading} />
          <StatsCard label="누적 방문자" value={totalVisitors} accentColor={C.silver} accentBg={`${C.silver}12`} icon="ri-group-line" loading={loading} />
          <StatsCard label="현재 접속" value={activeNow} accentColor={C.pink} accentBg={`${C.pink}15`} icon="ri-user-star-line" sub={lastActivity ? `마지막: ${formatTime(lastActivity)}` : undefined} loading={loading} />
          <StatsCard label="회원가입" value={signupCount} accentColor={C.gold} accentBg={`${C.gold}12`} icon="ri-user-add-line" loading={loading} />
          <StatsCard label="로그인" value={loginCount} accentColor={C.silver} accentBg={`${C.silver}10`} icon="ri-shield-check-line" loading={loading} />
        </div>

        {/* ═══════════════════════════════════════════
            P0: HEALTH SCORE + CRITICAL ISSUES + FOUNDER TODAY
           ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-5 md:mb-6">
          <div className="lg:col-span-3">
            <ServiceHealthScore period={period} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 mb-6 md:mb-8">
          <CriticalIssues />
          <FounderToday />
        </div>

        {/* ── Tabs ──────────────────────────────────── */}
        <div className="dash-card flex items-center gap-1.5 md:gap-2 mb-5 md:mb-6 flex-wrap">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
          <TabButton active={activeTab === 'kpi'} onClick={() => setActiveTab('kpi')}>KPI</TabButton>
          <TabButton active={activeTab === 'funnel'} onClick={() => setActiveTab('funnel')}>Funnel</TabButton>
          <TabButton active={activeTab === 'visitors'} onClick={() => setActiveTab('visitors')}>방문자</TabButton>
          <TabButton active={activeTab === 'live'} onClick={() => setActiveTab('live')}>실시간</TabButton>
          <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>Analytics</TabButton>
          <TabButton active={activeTab === 'buttons'} onClick={() => setActiveTab('buttons')}>버튼</TabButton>
          <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>활동 로그</TabButton>
          <TabButton active={activeTab === 'openai'} onClick={() => setActiveTab('openai')}>OpenAI</TabButton>
          <TabButton active={activeTab === 'errors'} onClick={() => setActiveTab('errors')}>오류</TabButton>
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>회원</TabButton>
          <TabButton active={activeTab === 'mobile'} onClick={() => setActiveTab('mobile')}>모바일</TabButton>
          <TabButton active={activeTab === 'features'} onClick={() => setActiveTab('features')}>기능</TabButton>
          <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')}>알림</TabButton>
          <TabButton active={activeTab === 'release'} onClick={() => setActiveTab('release')}>배포</TabButton>
        </div>

        {/* ═══════════════════════════════════════════
            OVERVIEW TAB
           ═══════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5 md:space-y-6">
            {/* Quick Insights */}
            <div className="dash-card grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {[
                { label: '전체 방문', value: totalVisitors, color: C.silver },
                { label: '현재 접속', value: activeNow, color: C.pink },
                { label: '오늘 클릭', value: totalClicks, color: C.gold },
                { label: 'Google Form', value: gfCount, color: C.pink },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border p-4" style={{ borderColor: `${C.graphite}40`, background: `${C.blackCard}80` }}>
                  <span className="text-[9px] font-mono tracking-wider text-white/15 uppercase">{item.label}</span>
                  <div className="text-2xl md:text-3xl font-bold mt-1.5" style={{ color: item.color, fontFamily: 'var(--font-heading, sans-serif)' }}>
                    {loading ? '...' : item.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Visitor Trend + Funnel Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
                <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
                  <i className="ri-line-chart-line text-sm text-white/20" />
                  <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">방문자 추이</span>
                </div>
                <div className="p-4">
                  <LineChart data={visitorTrend} color={C.gold} height={200} />
                </div>
              </div>

              <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
                <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
                  <i className="ri-filter-3-line text-sm text-white/20" />
                  <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">전환 퍼널</span>
                </div>
                <div className="p-4">
                  <FunnelChart data={funnel} />
                </div>
              </div>
            </div>

            {/* Device + Referrer Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
                <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
                  <i className="ri-smartphone-line text-sm text-white/20" />
                  <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">디바이스 비율</span>
                </div>
                <div className="p-4 flex flex-col md:flex-row items-center gap-4">
                  <div className="w-40">
                    <DonutChart data={deviceRatio} />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    {deviceRatio.map((d) => (
                      <div key={d.device} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                          background: d.device === 'Desktop' ? C.gold : d.device === 'Mobile' ? C.silver : C.pink,
                          opacity: 0.7,
                        }} />
                        <span className="text-[11px] font-mono text-white/40 flex-1">{d.device}</span>
                        <span className="text-[10px] font-mono text-white/20">{d.count}회 ({d.ratio}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
                <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
                  <i className="ri-share-forward-line text-sm text-white/20" />
                  <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">유입 경로</span>
                </div>
                <div className="p-4">
                  <ReferrerList data={referrerStats} />
                </div>
              </div>
            </div>

            {/* Section Time Stats */}
            <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
              <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
                <i className="ri-timer-line text-sm text-white/20" />
                <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">섹션 체류 시간</span>
              </div>
              <div className="p-4">
                <SectionTimeList data={sectionStats} />
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            VISITORS TAB
           ═══════════════════════════════════════════ */}
        {activeTab === 'visitors' && (
          <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
            <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
              <div className="flex items-center gap-2">
                <i className="ri-user-line text-sm text-white/20" />
                <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">방문자 목록</span>
              </div>
              <span className="text-[10px] font-mono text-white/10">{visitors.length}명</span>
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: `${C.graphite}80` }}>
                    {['방문자', '마지막 방문', '누적 방문', '디바이스', '브라우저', 'OS'].map((h) => (
                      <th key={h} className="text-left py-3 px-6 text-[9px] font-mono tracking-wider uppercase text-white/12 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visitors.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-16 text-white/10 text-sm font-mono">아직 방문 데이터가 없습니다</td></tr>
                  ) : (
                    visitors.map((v) => (
                      <tr key={v.visitorId} className="border-b transition-all duration-300 hover:bg-white/[0.015]" style={{ borderColor: `${C.graphite}40` }}>
                        <td className="py-3 px-6"><span className="text-xs font-mono text-white/50">{v.name || `익명 #${v.visitorId.slice(-4)}`}</span></td>
                        <td className="py-3 px-6"><span className="text-[11px] font-mono text-white/20">{formatDateTime(v.lastVisitAt)}</span></td>
                        <td className="py-3 px-6">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[10px] font-mono font-bold" style={{ background: `${C.gold}15`, color: C.gold }}>
                            {v.totalVisits}회
                          </span>
                        </td>
                        <td className="py-3 px-6"><span className="text-[10px] font-mono text-white/15">{v.device}</span></td>
                        <td className="py-3 px-6"><span className="text-[10px] font-mono text-white/15">{v.browser}</span></td>
                        <td className="py-3 px-6"><span className="text-[10px] font-mono text-white/15">{v.os}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden">
              {visitors.length === 0 ? (
                <div className="text-center py-16 text-white/10 text-sm font-mono">아직 방문 데이터가 없습니다</div>
              ) : (
                <div className="p-3 space-y-2.5 max-h-[600px] overflow-y-auto">
                  {visitors.map((v) => (
                    <VisitorMobileCard key={v.visitorId} v={v} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            ANALYTICS TAB
           ═══════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-5 md:space-y-6">
            {/* Button Click Bar Chart + Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
              <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
                  <div className="flex items-center gap-2">
                    <i className="ri-bar-chart-line text-sm text-white/20" />
                    <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">버튼 클릭</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/10">총 {totalClicks}회</span>
                </div>
                <div className="p-4">
                  <BarChart data={clickStats} color={C.gold} height={220} />
                </div>
              </div>

              <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
                <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
                  <i className="ri-filter-3-line text-sm text-white/20" />
                  <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">전환 퍼널</span>
                </div>
                <div className="p-4">
                  <FunnelChart data={funnel} />
                </div>
              </div>
            </div>

            {/* Pages Stats */}
            <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
              <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
                <div className="flex items-center gap-2">
                  <i className="ri-pages-line text-sm text-white/20" />
                  <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">페이지별 방문</span>
                </div>
              </div>
              {/* DESKTOP TABLE */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: `${C.graphite}80` }}>
                      {['페이지', '방문 수', '비율'].map((h) => (
                        <th key={h} className="text-left py-3 px-6 text-[9px] font-mono tracking-wider uppercase text-white/12 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageStats.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-16 text-white/10 text-sm font-mono">데이터 없음</td></tr>
                    ) : (
                      pageStats.map((p) => (
                        <tr key={p.page} className="border-b transition-all duration-300 hover:bg-white/[0.015]" style={{ borderColor: `${C.graphite}40` }}>
                          <td className="py-3 px-6"><span className="text-xs font-mono text-white/50">{p.page}</span></td>
                          <td className="py-3 px-6">
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[10px] font-mono font-bold" style={{ background: `${C.pink}15`, color: C.pink }}>{p.count}회</span>
                          </td>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: `${C.graphite}40` }}>
                                <div className="h-full rounded-full" style={{ width: `${p.ratio}%`, background: C.pink, opacity: 0.5 }} />
                              </div>
                              <span className="text-[10px] font-mono text-white/15">{p.ratio}%</span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* MOBILE CARDS */}
              <div className="md:hidden">
                {pageStats.length === 0 ? (
                  <div className="text-center py-16 text-white/10 text-sm font-mono">데이터 없음</div>
                ) : (
                  <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
                    {pageStats.map((p) => (
                      <PageStatsMobileCard key={p.page} p={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            ACTIVITY TAB
           ═══════════════════════════════════════════ */}
        {activeTab === 'activity' && (
          <div className="dash-card rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
            <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
              <div className="flex items-center gap-2">
                <i className="ri-history-line text-sm text-white/20" />
                <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">활동 로그</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.gold }} />
                <span className="text-[9px] font-mono text-white/12 tracking-wider">LIVE</span>
              </div>
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: `${C.graphite}80` }}>
                      {['시간', '방문자', '활동', '페이지', '디바이스', '브라우저', '유입'].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-[9px] font-mono tracking-wider uppercase text-white/12 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activity.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-16 text-white/10 text-sm font-mono">아직 활동 로그가 없습니다</td></tr>
                    ) : (
                      activity.map((a) => {
                        const typeConfig: Record<string, { icon: string; color: string }> = {
                          VISIT: { icon: 'ri-user-line', color: C.silver },
                          CLICK: { icon: 'ri-cursor-line', color: C.gold },
                          GOOGLE_FORM: { icon: 'ri-external-link-line', color: C.pink },
                          AUTH: { icon: 'ri-shield-check-line', color: C.gold },
                          SECTION: { icon: 'ri-focus-2-line', color: C.pink },
                          WHITE_DOOR: { icon: 'ri-door-open-line', color: C.silver },
                        };
                        const tc = typeConfig[a.type] || { icon: 'ri-information-line', color: C.silver };
                        return (
                          <tr key={a.id} className="border-b transition-all duration-300 hover:bg-white/[0.01]" style={{ borderColor: `${C.graphite}40` }}>
                            <td className="py-3 px-4"><span className="text-[10px] font-mono text-white/15 whitespace-nowrap">{formatDateShort(a.timestamp)} {formatTime(a.timestamp)}</span></td>
                            <td className="py-3 px-4"><span className="text-[11px] font-mono text-white/35">{a.visitorName}</span></td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <i className={`${tc.icon} text-[10px]`} style={{ color: tc.color }} />
                                <span className="text-[11px] font-mono text-white/30">{a.message}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4"><span className="text-[10px] font-mono text-white/15">{a.page || '-'}</span></td>
                            <td className="py-3 px-4"><span className="text-[10px] font-mono text-white/12">{a.device || '-'}</span></td>
                            <td className="py-3 px-4"><span className="text-[10px] font-mono text-white/12">{a.browser || '-'}</span></td>
                            <td className="py-3 px-4"><span className="text-[10px] font-mono text-white/12">{a.referrer || '-'}</span></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden">
              {activity.length === 0 ? (
                <div className="text-center py-16 text-white/10 text-sm font-mono">아직 활동 로그가 없습니다</div>
              ) : (
                <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                  {activity.map((a) => (
                    <ActivityMobileCard key={a.id} a={a} />
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 md:px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: C.graphite }}>
              <span className="text-[9px] font-mono text-white/10 tracking-wider">{activity.length} ENTRIES</span>
              <span className="text-[9px] font-mono text-white/06 tracking-wider">AUTO-REFRESH 5s</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            KPI TAB (Enhanced)
           ═══════════════════════════════════════════ */}
        {activeTab === 'kpi' && (
          <div className="space-y-5 md:space-y-6">
            <KPIDashboard
              loading={loading}
              signupCount={signupCount}
              loginCount={loginCount}
              conversionRate={conversionRate}
              avgStayDuration={avgStayDuration}
              whiteDoorCount={whiteDoorCount}
              newVisitors={newVsReturning.newVisitors}
              returningVisitors={newVsReturning.returningVisitors}
              totalClicks={totalClicks}
              gfCount={gfCount}
              activeNow={activeNow}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════
            FUNNEL TAB (Enhanced)
           ═══════════════════════════════════════════ */}
        {activeTab === 'funnel' && (
          <div className="space-y-5 md:space-y-6">
            <FunnelSection data={enhancedFunnel} loading={loading} />
          </div>
        )}

        {/* ═══════════════════════════════════════════
            LIVE VISITORS TAB
           ═══════════════════════════════════════════ */}
        {activeTab === 'live' && (
          <div className="space-y-5 md:space-y-6">
            <LiveVisitorPanel visitors={liveVisitors} loading={loading} />
          </div>
        )}

        {/* ═══════════════════════════════════════════
            BUTTON ANALYTICS TAB
           ═══════════════════════════════════════════ */}
        {activeTab === 'buttons' && (
          <div className="space-y-5 md:space-y-6">
            <ButtonDetailPanel data={buttonCTRStats} loading={loading} />
          </div>
        )}

        {/* ═══════════════════════════════════════════
            OPENAI TAB (Real-time Dashboard)
           ═══════════════════════════════════════════ */}
        {activeTab === 'openai' && <OpenAIDashboard />}

        {/* ═══════════════════════════════════════════
            ERRORS TAB (Error Center)
           ═══════════════════════════════════════════ */}
        {activeTab === 'errors' && (
          <ErrorCenter />
        )}

        {/* ═══════════════════════════════════════════
            USERS TAB (User Management)
           ═══════════════════════════════════════════ */}
        {activeTab === 'users' && <UserManagement />}

        {/* ═══════════════════════════════════════════
            MOBILE TAB (Mobile Operations)
           ═══════════════════════════════════════════ */}
        {activeTab === 'mobile' && <MobileOpsDashboard />}

        {/* ═══════════════════════════════════════════
            FEATURES TAB (Feature Control Panel)
           ═══════════════════════════════════════════ */}
        {activeTab === 'features' && <FeatureControlPanel />}

        {/* ═══════════════════════════════════════════
            NOTIFICATIONS TAB (Real-time Notification Center)
           ═══════════════════════════════════════════ */}
        {activeTab === 'notifications' && <NotificationCenter />}

        {/* ═══════════════════════════════════════════
            RELEASE TAB (Release & Deploy Dashboard)
           ═══════════════════════════════════════════ */}
        {activeTab === 'release' && <ReleaseDashboard />}

        {/* ── Footer ────────────────────────────────── */}
        <p className="mt-8 md:mt-10 text-center text-[8px] md:text-[9px] font-mono text-white/04">
          ECHO Admin Console v4.0 &middot; Supabase Analytics Engine &middot; KPI · Funnel · Live · OpenAI Ready
        </p>
      </div>
    </div>
  );
}