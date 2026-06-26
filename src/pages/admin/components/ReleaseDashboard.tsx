import { useState, useEffect } from 'react';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
  amber: '#FBBF24',
  sky: '#7DD3FC',
};

// ── DESIGN TEAM EDIT ZONE ─────────────────────────────
const REFRESH_INTERVAL = 30000; // 30s
// ───────────────────────────────────────────────────────

interface DeploymentInfo {
  version: string;
  projectId: string;
  versionId: string;
  buildTime: string;
  environment: 'production' | 'preview' | 'development';
  basePath: string;
}

interface SystemInfo {
  nodeEnv: string;
  userAgent: string;
  language: string;
  screenResolution: string;
  timezone: string;
  online: boolean;
}

function getDeploymentInfo(): DeploymentInfo {
  const isPreview = (typeof __IS_PREVIEW__ !== 'undefined' ? __IS_PREVIEW__ : false) as boolean;

  return {
    version: `v${(typeof __READDY_VERSION_ID__ !== 'undefined' ? __READDY_VERSION_ID__ : '247') as string}`,
    projectId: (typeof __READDY_PROJECT_ID__ !== 'undefined' ? __READDY_PROJECT_ID__ : '-') as string,
    versionId: (typeof __READDY_VERSION_ID__ !== 'undefined' ? __READDY_VERSION_ID__ : '-') as string,
    buildTime: new Date().toISOString(),
    environment: isPreview ? 'preview' : 'production',
    basePath: (typeof __BASE_PATH__ !== 'undefined' ? __BASE_PATH__ : '/') as string,
  };
}

function getSystemInfo(): SystemInfo {
  return {
    nodeEnv: 'browser',
    userAgent: navigator.userAgent.slice(0, 80) + '...',
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
  };
}

function formatDateTimeFull(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}.${mo}.${day} ${h}:${min}:${sec}`;
}

function getTimeSinceBuild(buildTime: string): string {
  const diff = Date.now() - new Date(buildTime).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  return `${day}일 전`;
}

const RELEASE_HISTORY = [
  { version: 'v247', date: '2026-06-26', changes: 'P2 Feature Control Panel · Notification Center · Release Dashboard 추가', type: 'feature' },
  { version: 'v246', date: '2026-06-26', changes: 'Admin P1: OpenAI Dashboard · User Management · Mobile Ops Dashboard 완료', type: 'feature' },
  { version: 'v245', date: '2026-06-26', changes: 'Admin P0: ServiceHealthScore · CriticalIssues · FounderToday · ErrorCenter 완료', type: 'feature' },
  { version: 'v244', date: '2026-06-25', changes: '음파 파동 뮤직 플레이어 — 20분 루프 YouTube 연동', type: 'feature' },
  { version: 'v243', date: '2026-06-25', changes: 'Admin Console 기반 구축 — Analytics 대시보드', type: 'feature' },
  { version: 'v242', date: '2026-06-24', changes: 'Supabase 인증 · 리포트 페이지 · SEO 최적화', type: 'feature' },
  { version: 'v241', date: '2026-06-23', changes: 'ECHO 랜딩페이지 초기 배포 — Hero · Mission · Approach', type: 'deploy' },
];

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  feature: { icon: 'ri-sparkling-line', color: C.gold },
  deploy: { icon: 'ri-rocket-line', color: C.emerald },
  fix: { icon: 'ri-tools-line', color: C.sky },
  hotfix: { icon: 'ri-fire-line', color: C.pink },
};

export default function ReleaseDashboard() {
  const [deployInfo] = useState<DeploymentInfo>(getDeploymentInfo);
  const [systemInfo] = useState<SystemInfo>(getSystemInfo);
  const [timeSinceBuild, setTimeSinceBuild] = useState(getTimeSinceBuild(deployInfo.buildTime));
  const [currentTime, setCurrentTime] = useState(formatDateTimeFull(new Date().toISOString()));
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceBuild(getTimeSinceBuild(deployInfo.buildTime));
      setCurrentTime(formatDateTimeFull(new Date().toISOString()));
    }, 10000);
    return () => clearInterval(interval);
  }, [deployInfo.buildTime]);

  const envColor = deployInfo.environment === 'production' ? C.emerald : deployInfo.environment === 'preview' ? C.amber : C.sky;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Deployment Status Cards */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4"
        style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.5s ease-out' }}
      >
        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${envColor}06 50%, ${C.blackCard} 100%)`, borderColor: `${envColor}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${envColor}15` }}>
              <i className="ri-global-line text-sm" style={{ color: envColor }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">환경</span>
          </div>
          <div className="text-xl md:text-2xl font-display font-bold tracking-tighter" style={{ color: envColor, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {deployInfo.environment === 'production' ? 'Production' : deployInfo.environment === 'preview' ? 'Preview' : 'Dev'}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: envColor }} />
            <span className="text-[9px] font-mono text-white/12">온라인</span>
          </div>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.gold}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.gold}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}15` }}>
              <i className="ri-git-branch-line text-sm" style={{ color: C.gold }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">현재 버전</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.gold, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {deployInfo.version}
          </div>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.sky}04 50%, ${C.blackCard} 100%)`, borderColor: `${C.sky}10` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.sky}10` }}>
              <i className="ri-time-line text-sm" style={{ color: C.sky }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">마지막 빌드</span>
          </div>
          <div className="text-sm font-mono text-white/40 font-medium mt-1">{timeSinceBuild}</div>
          <p className="text-[9px] font-mono text-white/10 mt-1">{currentTime}</p>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.pink}04 50%, ${C.blackCard} 100%)`, borderColor: `${C.pink}10` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.pink}10` }}>
              <i className="ri-folders-line text-sm" style={{ color: C.pink }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">프로젝트 ID</span>
          </div>
          <div className="text-xs font-mono text-white/30 font-medium mt-1 break-all">
            {deployInfo.projectId.slice(0, 12)}...
          </div>
          <p className="text-[9px] font-mono text-white/08 mt-1">Base: {deployInfo.basePath}</p>
        </div>
      </div>

      {/* Deploy Details + System Info Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        {/* Deploy Details */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
          <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
            <i className="ri-server-line text-sm text-white/20" />
            <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">배포 상세 정보</span>
          </div>
          <div className="p-4 md:p-5 space-y-3">
            {[
              { label: '버전 ID', value: deployInfo.versionId, icon: 'ri-hashtag' },
              { label: '프로젝트 ID', value: deployInfo.projectId, icon: 'ri-key-2-line' },
              { label: 'Base Path', value: deployInfo.basePath, icon: 'ri-link' },
              { label: '빌드 시간', value: formatDateTimeFull(deployInfo.buildTime), icon: 'ri-calendar-check-line' },
              { label: '환경', value: deployInfo.environment, icon: 'ri-global-line' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded-lg border" style={{ borderColor: `${C.graphite}40`, background: `${C.blackCard}60` }}>
                <div className="flex items-center gap-3">
                  <i className={`${item.icon} text-[11px] text-white/15`} />
                  <span className="text-[10px] font-mono tracking-wider text-white/18 uppercase">{item.label}</span>
                </div>
                <span className="text-[11px] font-mono text-white/35">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
          <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
            <i className="ri-computer-line text-sm text-white/20" />
            <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">시스템 정보</span>
          </div>
          <div className="p-4 md:p-5 space-y-3">
            {[
              { label: '런타임', value: 'Browser (Vite + React 19)', icon: 'ri-reactjs-line' },
              { label: '언어', value: systemInfo.language, icon: 'ri-translate-2' },
              { label: '해상도', value: systemInfo.screenResolution, icon: 'ri-aspect-ratio-line' },
              { label: '타임존', value: systemInfo.timezone, icon: 'ri-earth-line' },
              { label: '네트워크', value: systemInfo.online ? '온라인' : '오프라인', icon: 'ri-wifi-line' },
              { label: 'User Agent', value: systemInfo.userAgent, icon: 'ri-information-line' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5 px-3 rounded-lg border" style={{ borderColor: `${C.graphite}40`, background: `${C.blackCard}60` }}>
                <div className="flex items-center gap-3">
                  <i className={`${item.icon} text-[11px] text-white/15`} />
                  <span className="text-[10px] font-mono tracking-wider text-white/18 uppercase">{item.label}</span>
                </div>
                <span className={`text-[11px] font-mono ${item.value.length > 40 ? 'text-white/15 max-w-[200px] truncate' : 'text-white/35'}`} title={item.value}>
                  {item.value.length > 60 ? item.value.slice(0, 60) + '...' : item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Release History Timeline */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-history-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">릴리즈 히스토리</span>
          <span className="ml-auto text-[9px] font-mono text-white/10">{RELEASE_HISTORY.length} RELEASES</span>
        </div>
        <div className="p-4 md:p-6">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px" style={{ background: `linear-gradient(to bottom, ${C.graphite}80, ${C.graphite}20)` }} />

            <div className="space-y-5">
              {RELEASE_HISTORY.map((release, i) => {
                const typeCfg = TYPE_CONFIG[release.type] || TYPE_CONFIG.feature;
                return (
                  <div
                    key={release.version}
                    className="relative pl-12"
                    style={{
                      opacity: animateIn ? 1 : 0,
                      transform: animateIn ? 'translateX(0)' : 'translateX(-12px)',
                      transition: `all 0.4s ease-out ${i * 80}ms`,
                    }}
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute left-[13px] top-1 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: typeCfg.color, background: `${C.blackCard}` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeCfg.color }} />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 mb-1">
                      <span className="text-xs font-mono font-bold text-white/50">{release.version}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-mono" style={{ background: `${typeCfg.color}12`, color: typeCfg.color }}>
                        <i className={`${typeCfg.icon} text-[9px]`} />
                        {release.type === 'feature' ? '기능' : release.type === 'deploy' ? '배포' : release.type === 'fix' ? '수정' : '긴급'}
                      </span>
                      <span className="text-[9px] font-mono text-white/12">{release.date}</span>
                    </div>
                    <p className="text-[10px] font-mono text-white/25 leading-relaxed">{release.changes}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-4 md:px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: C.graphite }}>
          <span className="text-[9px] font-mono text-white/08 tracking-wider">ECHO DEPLOYMENT HISTORY</span>
          <span className="text-[9px] font-mono text-white/06 tracking-wider">CURRENT: {deployInfo.version}</span>
        </div>
      </div>

      {/* Footer Legend */}
      <div className="flex items-center gap-4 justify-center">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
            <span className="text-[9px] font-mono text-white/10 uppercase">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}