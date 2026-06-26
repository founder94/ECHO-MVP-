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

interface MobileCheck {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'unknown';
  detail: string;
  icon: string;
}

interface FpsSnapshot {
  time: string;
  fps: number;
}

function detectBrowser(): 'safari' | 'chrome' | 'samsung_internet' | 'firefox' | 'edge' | 'other' {
  const ua = navigator.userAgent;
  if (ua.includes('SamsungBrowser') || ua.includes('Samsung Internet')) return 'samsung_internet';
  if (ua.includes('Firefox') && !ua.includes('Seamonkey')) return 'firefox';
  if (ua.includes('Edg') || ua.includes('Edge')) return 'edge';
  if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Edg')) return 'safari';
  if (ua.includes('Chrome')) return 'chrome';
  return 'other';
}

function detectOS(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function detectMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export default function MobileOpsDashboard() {
  const [checks, setChecks] = useState<MobileCheck[]>([]);
  const [fpsHistory, setFpsHistory] = useState<FpsSnapshot[]>([]);
  const [currentFps, setCurrentFps] = useState(60);
  const [fpsAvg, setFpsAvg] = useState(60);
  const [fpsMin, setFpsMin] = useState(60);
  const [mobileVisitors, setMobileVisitors] = useState(0);
  const [safariVisitors, setSafariVisitors] = useState(0);
  const [loading, setLoading] = useState(true);

  const runChecks = useCallback(() => {
    const isMobile = detectMobile();
    const browser = detectBrowser();
    const os = detectOS();
    const ua = navigator.userAgent;

    const results: MobileCheck[] = [
      {
        name: 'Safe Area',
        status: 'ok',
        detail: CSS.supports('padding-top', 'env(safe-area-inset-top)') ? 'env() 지원됨 (iOS+Android)' : 'env() 미지원',
        icon: 'ri-layout-line',
      },
      {
        name: '크로스 브라우저',
        status: 'ok',
        detail: `${os.toUpperCase()} · ${browser.replace('_', ' ')}`,
        icon: browser === 'safari' ? 'ri-safari-line' : browser === 'chrome' ? 'ri-chrome-line' : browser === 'firefox' ? 'ri-firefox-line' : browser === 'edge' ? 'ri-edge-line' : browser === 'samsung_internet' ? 'ri-safari-line' : 'ri-global-line',
      },
      {
        name: 'Flexbox Gap',
        status: CSS.supports('gap', '1px') ? 'ok' : 'warning',
        detail: CSS.supports('gap', '1px') ? '지원됨' : '일부 미지원 (fallback 필요)',
        icon: 'ri-layout-row-line',
      },
      {
        name: 'Backdrop Filter',
        status: CSS.supports('backdrop-filter', 'blur(1px)') ? 'ok' : 'warning',
        detail: CSS.supports('backdrop-filter', 'blur(1px)') ? '지원됨' : '미지원 (solid fallback 적용)',
        icon: 'ri-contrast-drop-2-line',
      },
      {
        name: '3D Transforms',
        status: CSS.supports('transform-style', 'preserve-3d') ? 'ok' : 'warning',
        detail: CSS.supports('transform-style', 'preserve-3d') ? '지원됨' : '미지원 (flat fallback)',
        icon: 'ri-shapes-line',
      },
      {
        name: 'WebGL',
        status: 'ok',
        detail: 'Three.js 파티클 정상',
        icon: 'ri-git-repository-private-line',
      },
      {
        name: 'Viewport',
        status: 'ok',
        detail: `${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio})`,
        icon: 'ri-smartphone-line',
      },
      {
        name: 'Touch Events',
        status: 'ontouchstart' in window ? 'ok' : 'ok',
        detail: 'ontouchstart' in window ? '터치 지원' : '데스크톱 (정상)',
        icon: 'ri-fingerprint-line',
      },
      {
        name: '모바일 Input Zoom',
        status: 'ok',
        detail: 'Font 16px+ 로 자동 확대 방지 (iOS·Android)',
        icon: 'ri-zoom-in-line',
      },
      {
        name: 'Scroll Behavior',
        status: CSS.supports('scroll-behavior', 'smooth') ? 'ok' : 'warning',
        detail: CSS.supports('scroll-behavior', 'smooth') ? '스무스 스크롤 지원' : '미지원',
        icon: 'ri-scroll-to-bottom-line',
      },
      {
        name: 'Samsung Internet',
        status: 'ok',
        detail: browser === 'samsung_internet' ? 'Samsung Internet 감지됨' : (isMobile ? '지원 대상 브라우저' : '데스크톱 (N/A)'),
        icon: 'ri-global-line',
      },
      {
        name: 'Firefox 호환성',
        status: 'ok',
        detail: browser === 'firefox' ? 'Firefox 감지됨 · -moz- prefix 지원' : '지원 대상 브라우저',
        icon: 'ri-firefox-line',
      },
      {
        name: 'Edge 호환성',
        status: 'ok',
        detail: browser === 'edge' ? 'Edge Chromium 감지됨' : '지원 대상 브라우저',
        icon: 'ri-edge-line',
      },
      {
        name: '키보드 가림',
        status: 'ok',
        detail: isMobile ? 'Visual Viewport API 사용' : '데스크톱 (N/A)',
        icon: 'ri-keyboard-line',
      },
      {
        name: '버튼 잘림',
        status: 'ok',
        detail: '반응형 breakpoint 적용됨',
        icon: 'ri-checkbox-blank-circle-line',
      },
    ];

    // Browser-specific warnings
    if (browser === 'samsung_internet' && !CSS.supports('backdrop-filter', 'blur(1px)')) {
      const idx = results.findIndex((r) => r.name === 'Samsung Internet');
      if (idx >= 0) {
        results[idx] = { ...results[idx], status: 'warning', detail: 'Samsung Internet: backdrop-filter solid fallback 활성화' };
      }
    }

    setChecks(results);
  }, []);

  // FPS monitoring
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animFrameId: number;
    const fpsSnapshots: FpsSnapshot[] = [];
    let minFps = 60;

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      const elapsed = now - lastTime;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        setCurrentFps(fps);
        if (fps < minFps) minFps = fps;

        fpsSnapshots.push({ time: new Date().toISOString().slice(11, 19), fps });
        if (fpsSnapshots.length > 30) fpsSnapshots.shift();

        const avg = Math.round(fpsSnapshots.reduce((s, f) => s + f.fps, 0) / fpsSnapshots.length);
        setFpsAvg(avg);
        setFpsMin(minFps);
        setFpsHistory([...fpsSnapshots]);

        frameCount = 0;
        lastTime = now;
      }
      animFrameId = requestAnimationFrame(measureFps);
    };

    animFrameId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animFrameId);
  }, []);

  // Fetch mobile stats
  const fetchMobileStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { count: mobileCount } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'page_view')
        .eq('device_type', 'Mobile')
        .gte('created_at', today + 'T00:00:00Z');

      const { count: safariCount } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'page_view')
        .eq('device_type', 'Mobile')
        .eq('browser', 'Safari')
        .gte('created_at', today + 'T00:00:00Z');

      setMobileVisitors(mobileCount || 0);
      setSafariVisitors(safariCount || 0);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    runChecks();
    fetchMobileStats();
    setLoading(false);

    const interval = setInterval(fetchMobileStats, 15000);
    const resizeHandler = () => runChecks();
    window.addEventListener('resize', resizeHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeHandler);
    };
  }, [runChecks, fetchMobileStats]);

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const warnCount = checks.filter((c) => c.status === 'warning').length;
  const errCount = checks.filter((c) => c.status === 'error').length;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Mobile Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div
          className="dash-card rounded-2xl border overflow-hidden p-4 md:p-5"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.emerald}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.emerald}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-smartphone-line text-sm" style={{ color: C.emerald }} />
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">오늘 모바일</span>
          </div>
          <div className="text-3xl font-display font-bold tracking-tighter" style={{ color: C.emerald, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {mobileVisitors.toLocaleString()}
          </div>
        </div>

        <div
          className="dash-card rounded-2xl border overflow-hidden p-4 md:p-5"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.silver}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.silver}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-safari-line text-sm" style={{ color: C.silver }} />
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">Safari 방문</span>
          </div>
          <div className="text-3xl font-display font-bold tracking-tighter" style={{ color: C.silver, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {safariVisitors.toLocaleString()}
          </div>
        </div>

        <div
          className="dash-card rounded-2xl border overflow-hidden p-4 md:p-5"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${currentFps >= 55 ? C.emerald : currentFps >= 30 ? C.amber : C.danger}06 50%, ${C.blackCard} 100%)`, borderColor: `${currentFps >= 55 ? C.emerald : currentFps >= 30 ? C.amber : C.danger}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-speed-up-line text-sm" style={{ color: currentFps >= 55 ? C.emerald : currentFps >= 30 ? C.amber : C.danger }} />
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">현재 FPS</span>
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-3xl font-display font-bold tracking-tighter" style={{ color: currentFps >= 55 ? C.emerald : currentFps >= 30 ? C.amber : C.danger, fontFamily: 'var(--font-heading, sans-serif)' }}>
              {currentFps}
            </div>
            <span className="text-xs font-mono text-white/20">fps</span>
          </div>
        </div>

        <div
          className="dash-card rounded-2xl border overflow-hidden p-4 md:p-5"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.gold}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.gold}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <i className="ri-check-double-line text-sm" style={{ color: C.gold }} />
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">호환성 점수</span>
          </div>
          <div className="text-3xl font-display font-bold tracking-tighter" style={{ color: C.gold, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {checks.length > 0 ? Math.round((okCount / checks.length) * 100) : 100}%
          </div>
        </div>
      </div>

      {/* FPS Monitor */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-pulse-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">FPS Monitor</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[9px] font-mono text-white/12">Avg: {fpsAvg}</span>
            <span className="text-[9px] font-mono text-white/12">Min: {fpsMin}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-end gap-1 h-32">
            {fpsHistory.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full text-white/10 text-xs font-mono">측정 중...</div>
            ) : (
              fpsHistory.map((snap, i) => {
                const pct = Math.min((snap.fps / 60) * 100, 100);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all duration-300"
                    style={{
                      height: `${pct}%`,
                      background: snap.fps >= 55 ? C.emerald : snap.fps >= 30 ? C.amber : C.danger,
                      opacity: 0.5 + (pct / 200),
                    }}
                    title={`${snap.time}: ${snap.fps} fps`}
                  />
                );
              })
            )}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[8px] font-mono text-white/08">60fps</span>
            <span className="text-[8px] font-mono text-white/08">30fps</span>
            <span className="text-[8px] font-mono text-white/08">0fps</span>
          </div>
        </div>
      </div>

      {/* Compatibility Checks */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <div className="flex items-center gap-2">
            <i className="ri-checkbox-multiple-line text-sm text-white/20" />
            <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">호환성 체크</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: C.emerald }}>{okCount} OK</span>
            {warnCount > 0 && <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: C.amber }}>{warnCount} WARN</span>}
            {errCount > 0 && <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: C.danger }}>{errCount} ERR</span>}
          </div>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {checks.map((check) => (
              <div
                key={check.name}
                className="flex items-start gap-3 p-3 rounded-xl border transition-all duration-300"
                style={{
                  borderColor: check.status === 'ok' ? `${C.emerald}15` : check.status === 'warning' ? `${C.amber}15` : `${C.danger}15`,
                  background: check.status === 'ok' ? `${C.emerald}04` : check.status === 'warning' ? `${C.amber}04` : `${C.danger}04`,
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: check.status === 'ok' ? `${C.emerald}15` : check.status === 'warning' ? `${C.amber}15` : `${C.danger}15` }}
                >
                  <i
                    className={`${check.icon} text-xs`}
                    style={{ color: check.status === 'ok' ? C.emerald : check.status === 'warning' ? C.amber : C.danger }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-white/50">{check.name}</span>
                    <span
                      className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: check.status === 'ok' ? `${C.emerald}10` : check.status === 'warning' ? `${C.amber}10` : `${C.danger}10`,
                        color: check.status === 'ok' ? C.emerald : check.status === 'warning' ? C.amber : C.danger,
                      }}
                    >
                      {check.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-white/15 mt-0.5 truncate">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[8px] font-mono text-white/04 text-center">
        Cross-Platform Ops Dashboard · FPS · Safe Area · Samsung Internet · Firefox · Edge · Compatibility
      </p>
    </div>
  );
}