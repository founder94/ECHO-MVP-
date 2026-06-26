import type { LiveVisitor } from '@/hooks/useAnalytics';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return '방금';
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  return `${min}분 전`;
}

function getDeviceIcon(device: string): string {
  if (device === 'Mobile') return 'ri-smartphone-line';
  if (device === 'Tablet') return 'ri-tablet-line';
  return 'ri-computer-line';
}

function getBrowserIcon(browser: string): string {
  if (browser === 'Chrome') return 'ri-chrome-line';
  if (browser === 'Safari') return 'ri-safari-line';
  if (browser === 'Firefox') return 'ri-firefox-line';
  if (browser === 'Edge') return 'ri-edge-line';
  return 'ri-global-line';
}

interface LiveVisitorPanelProps {
  visitors: LiveVisitor[];
  loading: boolean;
}

export default function LiveVisitorPanel({ visitors, loading }: LiveVisitorPanelProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.emerald }} />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">실시간 접속자</span>
        </div>
        <div className="p-6 flex items-center justify-center h-40">
          <span className="text-white/10 text-xs font-mono">로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.emerald }} />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">실시간 접속자</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-white/20">{visitors.length}명 접속 중</span>
          <span className="text-[8px] font-mono text-white/08 tracking-wider">5s REFRESH</span>
        </div>
      </div>

      {visitors.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: `${C.graphite}40` }}>
            <i className="ri-user-line text-lg text-white/10" />
          </div>
          <span className="text-[11px] font-mono text-white/10">현재 접속자가 없습니다</span>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: `${C.graphite}60` }}>
                  {['방문자', '현재 페이지', '디바이스', '브라우저', 'OS', '세션 시간', '마지막 활동'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[9px] font-mono tracking-wider uppercase text-white/10 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => (
                  <tr key={v.visitorId} className="border-b transition-all duration-300 hover:bg-white/[0.01]" style={{ borderColor: `${C.graphite}30` }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.emerald, opacity: 0.8 }} />
                        <span className="text-[11px] font-mono text-white/45">{v.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/25">{v.currentPage}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <i className={`${getDeviceIcon(v.device)} text-[11px] text-white/15`} />
                        <span className="text-[10px] font-mono text-white/15">{v.device}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <i className={`${getBrowserIcon(v.browser)} text-[11px] text-white/15`} />
                        <span className="text-[10px] font-mono text-white/15">{v.browser}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/12">{v.os}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/18">{v.sessionDurationMin}분</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[9px] font-mono text-white/12">{formatTimeAgo(v.lastActiveAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {visitors.map((v) => (
              <div key={v.visitorId} className="rounded-xl border p-3.5 space-y-2" style={{ borderColor: `${C.graphite}60`, background: `${C.blackCard}80` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: C.emerald, opacity: 0.8 }} />
                    <span className="text-xs font-mono text-white/50">{v.name}</span>
                  </div>
                  <span className="text-[9px] font-mono text-white/12">{formatTimeAgo(v.lastActiveAt)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-white/10 text-[8px] font-mono uppercase">페이지</span>
                    <p className="text-white/20 mt-0.5 truncate">{v.currentPage}</p>
                  </div>
                  <div>
                    <span className="text-white/10 text-[8px] font-mono uppercase">세션</span>
                    <p className="text-white/20 mt-0.5">{v.sessionDurationMin}분</p>
                  </div>
                  <div>
                    <span className="text-white/10 text-[8px] font-mono uppercase">디바이스</span>
                    <p className="text-white/20 mt-0.5">{v.device} / {v.os}</p>
                  </div>
                  <div>
                    <span className="text-white/10 text-[8px] font-mono uppercase">브라우저</span>
                    <p className="text-white/20 mt-0.5">{v.browser}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Device summary */}
      {visitors.length > 0 && (
        <div className="px-4 md:px-6 py-3 border-t flex items-center gap-4 flex-wrap" style={{ borderColor: C.graphite }}>
          {[
            { label: 'Desktop', icon: 'ri-computer-line', count: visitors.filter((v) => v.device === 'Desktop').length },
            { label: 'Mobile', icon: 'ri-smartphone-line', count: visitors.filter((v) => v.device === 'Mobile').length },
            { label: 'Tablet', icon: 'ri-tablet-line', count: visitors.filter((v) => v.device === 'Tablet').length },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <i className={`${item.icon} text-[10px] text-white/12`} />
              <span className="text-[9px] font-mono text-white/15">{item.label}: {item.count}</span>
            </div>
          ))}
          <span className="text-[9px] font-mono text-white/06">·</span>
          {[
            { label: 'Chrome', count: visitors.filter((v) => v.browser === 'Chrome').length },
            { label: 'Safari', count: visitors.filter((v) => v.browser === 'Safari').length },
            { label: 'Edge', count: visitors.filter((v) => v.browser === 'Edge').length },
            { label: 'Firefox', count: visitors.filter((v) => v.browser === 'Firefox').length },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <span className="text-[9px] font-mono text-white/12">{item.label}: {item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}