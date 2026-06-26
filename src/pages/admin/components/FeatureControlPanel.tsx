import { useState, useEffect } from 'react';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
  amber: '#FBBF24',
  danger: '#F87171',
  sky: '#7DD3FC',
};

interface FeatureStatus {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'auth' | 'payment' | 'engagement' | 'infra';
  status: 'active' | 'inactive' | 'configured' | 'not_configured' | 'coming_soon';
  icon: string;
}

// ── DESIGN TEAM EDIT ZONE ─────────────────────────────
// 디자인팀이 이 상수들만 수정하면 전체 UI 색상/크기 변경 가능
const PANEL_BG = C.blackCard;
const PANEL_BORDER = C.graphite;
const STATUS_DOT_SIZE = 'w-2 h-2';
// ───────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  core: '핵심 기능',
  auth: '인증 / 보안',
  payment: '결제 / 수익',
  engagement: '참여 / 인터랙션',
  infra: '인프라 / 운영',
};

const CATEGORY_COLORS: Record<string, string> = {
  core: C.gold,
  auth: C.sky,
  payment: C.emerald,
  engagement: C.pink,
  infra: C.silver,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: '활성', color: C.emerald, bg: `${C.emerald}10`, dot: C.emerald },
  inactive: { label: '비활성', color: C.silver, bg: `${C.silver}08`, dot: C.silver },
  configured: { label: '설정됨', color: C.sky, bg: `${C.sky}10`, dot: C.sky },
  not_configured: { label: '미설정', color: C.amber, bg: `${C.amber}10`, dot: C.amber },
  coming_soon: { label: '준비중', color: C.pink, bg: `${C.pink}08`, dot: C.pink },
};

function useFeatureStatuses(): { features: FeatureStatus[]; summary: { total: number; active: number; inactive: number; notConfigured: number } } {
  const features: FeatureStatus[] = [
    {
      id: 'ai-analysis',
      name: 'AI 분석 (Echo)',
      description: 'OpenAI 기반 인간관계 패턴 분석 엔진',
      category: 'core',
      status: 'active',
      icon: 'ri-brain-line',
    },
    {
      id: 'user-auth',
      name: '회원가입 / 로그인',
      description: 'Supabase Auth — 이메일 기반 인증',
      category: 'auth',
      status: 'active',
      icon: 'ri-shield-user-line',
    },
    {
      id: 'report',
      name: '리포트 페이지',
      description: 'AI 분석 결과 시각화 대시보드',
      category: 'core',
      status: 'active',
      icon: 'ri-file-chart-line',
    },
    {
      id: 'analytics',
      name: '방문자 분석',
      description: 'Supabase analytics_events 기반 추적',
      category: 'infra',
      status: 'active',
      icon: 'ri-bar-chart-grouped-line',
    },
    {
      id: 'music-player',
      name: '배경 음악',
      description: 'YouTube 기반 20분 루프 음파 플레이어',
      category: 'engagement',
      status: 'active',
      icon: 'ri-music-line',
    },
    {
      id: 'white-door',
      name: 'White Door',
      description: '심층 분석 진입 게이트',
      category: 'engagement',
      status: 'active',
      icon: 'ri-door-open-line',
    },
    {
      id: 'member-gate',
      name: '멤버 게이트',
      description: '회원 전용 콘텐츠 접근 제어',
      category: 'engagement',
      status: 'active',
      icon: 'ri-vip-crown-line',
    },
    {
      id: 'google-form',
      name: 'Google Form 연동',
      description: '체험 신청 / 문의 폼',
      category: 'engagement',
      status: 'active',
      icon: 'ri-survey-line',
    },
    {
      id: 'notification-center',
      name: '실시간 알림',
      description: 'Supabase Realtime 기반 이벤트 알림',
      category: 'infra',
      status: 'active',
      icon: 'ri-notification-3-line',
    },
    {
      id: 'admin-console',
      name: 'Admin Console',
      description: '운영 대시보드 — P0/P1/P2 완료',
      category: 'infra',
      status: 'active',
      icon: 'ri-dashboard-line',
    },
    {
      id: 'stripe-payment',
      name: 'Stripe 결제',
      description: '카드 결제 및 구독 관리',
      category: 'payment',
      status: 'not_configured',
      icon: 'ri-bank-card-line',
    },
    {
      id: 'shopify',
      name: 'Shopify 연동',
      description: '상품 관리 및 주문 처리',
      category: 'payment',
      status: 'not_configured',
      icon: 'ri-shopping-bag-3-line',
    },
    {
      id: 'google-oauth',
      name: 'Google OAuth',
      description: '구글 계정으로 소셜 로그인',
      category: 'auth',
      status: 'not_configured',
      icon: 'ri-google-line',
    },
    {
      id: 'apple-oauth',
      name: 'Apple OAuth',
      description: 'Apple ID로 소셜 로그인',
      category: 'auth',
      status: 'not_configured',
      icon: 'ri-apple-line',
    },
    {
      id: 'kakao-oauth',
      name: 'Kakao OAuth',
      description: '카카오 계정으로 소셜 로그인',
      category: 'auth',
      status: 'not_configured',
      icon: 'ri-chat-smile-2-line',
    },
    {
      id: 'maintenance-mode',
      name: '점검 모드',
      description: '서비스 일시 중단 및 공지 표시',
      category: 'infra',
      status: 'inactive',
      icon: 'ri-tools-line',
    },
    {
      id: 'multi-language',
      name: '다국어 지원',
      description: 'i18n 기반 다국어 번역 시스템',
      category: 'core',
      status: 'configured',
      icon: 'ri-global-line',
    },
    {
      id: 'seo',
      name: 'SEO 최적화',
      description: '메타태그 / Schema.org / 사이트맵',
      category: 'core',
      status: 'configured',
      icon: 'ri-search-eye-line',
    },
  ];

  const summary = {
    total: features.length,
    active: features.filter(f => f.status === 'active').length,
    inactive: features.filter(f => f.status === 'inactive' || f.status === 'not_configured').length,
    notConfigured: features.filter(f => f.status === 'not_configured').length,
  };

  return { features, summary };
}

export default function FeatureControlPanel() {
  const { features, summary } = useFeatureStatuses();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateIn(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const categories = ['all', ...new Set(features.map(f => f.category))];
  const filteredFeatures = selectedCategory === 'all'
    ? features
    : features.filter(f => f.category === selectedCategory);

  const activePercent = Math.round((summary.active / summary.total) * 100);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Summary Cards */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4"
        style={{ opacity: animateIn ? 1 : 0, transform: animateIn ? 'translateY(0)' : 'translateY(16px)', transition: 'all 0.5s ease-out' }}
      >
        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.emerald}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.emerald}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.emerald}15` }}>
              <i className="ri-check-double-line text-sm" style={{ color: C.emerald }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">활성 기능</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.emerald, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {summary.active}
            <span className="text-lg text-white/15 ml-1">/ {summary.total}</span>
          </div>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.gold}04 50%, ${C.blackCard} 100%)`, borderColor: `${C.gold}12` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}12` }}>
              <i className="ri-pie-chart-line text-sm" style={{ color: C.gold }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">활성화율</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.gold, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {activePercent}%
          </div>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.amber}06 50%, ${C.blackCard} 100%)`, borderColor: `${C.amber}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.amber}15` }}>
              <i className="ri-alert-line text-sm" style={{ color: C.amber }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">미설정</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.amber, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {summary.notConfigured}
          </div>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.silver}04 50%, ${C.blackCard} 100%)`, borderColor: `${C.silver}10` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.silver}10` }}>
              <i className="ri-stack-line text-sm" style={{ color: C.silver }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">카테고리</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.silver, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {categories.length - 1}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-mono tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer border ${
              selectedCategory === cat
                ? 'bg-white/[0.06] text-white/50 border-white/[0.12]'
                : 'bg-transparent text-white/18 border-white/[0.04] hover:border-white/[0.08]'
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {cat === 'all' ? '전체' : CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {filteredFeatures.map((feature, i) => {
          const statusCfg = STATUS_CONFIG[feature.status];
          const catColor = CATEGORY_COLORS[feature.category];
          return (
            <div
              key={feature.id}
              className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500 hover:bg-white/[0.015]"
              style={{
                background: C.blackCard,
                borderColor: C.graphite,
                opacity: animateIn ? 1 : 0,
                transform: animateIn ? 'translateY(0)' : 'translateY(20px)',
                transition: `all 0.5s ease-out ${i * 60}ms`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${catColor}12` }}>
                    <i className={`${feature.icon} text-sm`} style={{ color: catColor, opacity: 0.8 }} />
                  </div>
                  <div>
                    <h3 className="text-xs font-mono text-white/50 font-medium">{feature.name}</h3>
                    <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: catColor, opacity: 0.4 }}>
                      {CATEGORY_LABELS[feature.category]}
                    </span>
                  </div>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-mono font-bold shrink-0"
                  style={{ background: statusCfg.bg, color: statusCfg.color }}
                >
                  <span className={`${STATUS_DOT_SIZE} rounded-full`} style={{ background: statusCfg.dot }} />
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-[10px] font-mono text-white/15 leading-relaxed">{feature.description}</p>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="rounded-2xl border overflow-hidden p-3 md:p-4 flex items-center justify-between" style={{ borderColor: C.graphite, background: `${C.blackCard}80` }}>
        <span className="text-[9px] font-mono text-white/10 tracking-wider">{summary.total} FEATURES TRACKED</span>
        <div className="flex items-center gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full`} style={{ background: cfg.dot }} />
              <span className="text-[8px] font-mono text-white/10">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}