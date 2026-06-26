import type { ButtonCTR } from '@/hooks/useAnalytics';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
};

function formatDateTimeShort(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function CTRBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: `${C.graphite}40` }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: value > 5 ? C.emerald : value > 1 ? C.gold : C.pink, opacity: 0.7 }}
        />
      </div>
      <span className="text-[10px] font-mono w-10 text-right" style={{ color: value > 5 ? C.emerald : value > 1 ? C.gold : C.pink, opacity: 0.8 }}>
        {value}%
      </span>
    </div>
  );
}

interface ButtonDetailPanelProps {
  data: ButtonCTR[];
  loading: boolean;
}

export default function ButtonDetailPanel({ data, loading }: ButtonDetailPanelProps) {
  const maxCTR = Math.max(...data.map((d) => d.ctr), 1);

  if (loading) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-cursor-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">버튼 분석</span>
        </div>
        <div className="p-6 flex items-center justify-center h-40">
          <span className="text-white/10 text-xs font-mono">로딩 중...</span>
        </div>
      </div>
    );
  }

  const totalClicks = data.reduce((s, d) => s + d.clicks, 0);
  const avgCTR = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.ctr, 0) / data.length * 10) / 10 : 0;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <div className="flex items-center gap-2">
          <i className="ri-cursor-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">버튼 클릭 분석</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-white/10">총 {totalClicks}회</span>
          <span className="text-[9px] font-mono text-white/10">평균 CTR {avgCTR}%</span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="py-16 text-center">
          <span className="text-[11px] font-mono text-white/10">클릭 데이터가 없습니다</span>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: `${C.graphite}60` }}>
                  {['버튼', '클릭 수', '고유 방문자', 'CTR', '마지막 클릭'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[9px] font-mono tracking-wider uppercase text-white/10 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.buttonName} className="border-b transition-all duration-300 hover:bg-white/[0.01]" style={{ borderColor: `${C.graphite}30` }}>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono text-white/45">{d.buttonName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-[10px] font-mono font-bold" style={{ background: `${C.gold}15`, color: C.gold }}>
                        {d.clicks}회
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono text-white/20">{d.uniqueVisitors}명</span>
                    </td>
                    <td className="py-3 px-4">
                      <CTRBar value={d.ctr} max={maxCTR} />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/12">{formatDateTimeShort(d.lastClickedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {data.map((d) => (
              <div key={d.buttonName} className="rounded-xl border p-3.5" style={{ borderColor: `${C.graphite}60`, background: `${C.blackCard}80` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-white/50 truncate flex-1 mr-2">{d.buttonName}</span>
                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0" style={{ background: `${C.gold}15`, color: C.gold }}>
                    {d.clicks}회
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-white/12 font-mono">고유 {d.uniqueVisitors}명</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/08 font-mono">CTR</span>
                    <span className="font-mono" style={{ color: d.ctr > 5 ? C.emerald : C.gold, opacity: 0.8 }}>{d.ctr}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="px-4 md:px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: C.graphite }}>
        <span className="text-[8px] font-mono text-white/08 tracking-wider">{data.length} BUTTONS TRACKED</span>
        <span className="text-[8px] font-mono text-white/05 tracking-wider">CTR = 고유클릭방문자 / 전체고유방문자</span>
      </div>
    </div>
  );
}