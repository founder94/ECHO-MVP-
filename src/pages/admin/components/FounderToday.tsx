import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
  amber: '#FBBF24',
  danger: '#F87171',
};

interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'today' | 'soon';
  category: string;
  icon: string;
  completed: boolean;
}

const PRIORITY_CONFIG = {
  urgent: { color: '#F87171', bg: 'rgba(248,113,113,0.10)', label: '긴급' },
  today: { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', label: '오늘' },
  soon: { color: '#A0A0B0', bg: 'rgba(160,160,176,0.08)', label: '곧' },
};

export default function FounderToday() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const generateActions = async () => {
    setLoading(true);
    const actions: ActionItem[] = [];

    // 1. Check OpenAI API Key status
    try {
      const { error } = await supabase.functions.invoke('echo-ai-analysis', {
        body: { action: 'health_check' },
      });
      if (error && error.message?.includes('API key')) {
        actions.push({
          id: 'setup_openai_key',
          title: 'OpenAI API Key 설정',
          description: 'AI 분석 기능을 활성화하려면 Supabase Secrets에서 OPENAI_API_KEY를 등록하세요.',
          priority: 'urgent',
          category: 'AI',
          icon: 'ri-key-2-line',
          completed: false,
        });
      } else if (!error) {
        actions.push({
          id: 'test_openai',
          title: 'OpenAI 분석 테스트 실행',
          description: '실제 관계 분석 리포트가 정상 생성되는지 테스트 계정으로 확인하세요.',
          priority: 'today',
          category: 'AI',
          icon: 'ri-brain-line',
          completed: false,
        });
      }
    } catch {
      actions.push({
        id: 'check_edge_func',
        title: 'Edge Function 상태 확인',
        description: 'echo-ai-analysis 함수가 정상 배포되었는지 Supabase Dashboard에서 확인하세요.',
        priority: 'urgent',
        category: 'Infra',
        icon: 'ri-server-line',
        completed: false,
      });
    }

    // 2. Check Google OAuth
    actions.push({
      id: 'google_oauth',
      title: 'Google OAuth Provider 설정 확인',
      description: 'Supabase Authentication → Providers에서 Google 로그인이 활성화되어 있는지 확인하세요.',
      priority: 'today',
      category: 'Auth',
      icon: 'ri-google-line',
      completed: false,
    });

    // 3. Check conversion data
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { count: signupCount } = await supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'auth_signup')
        .gte('created_at', `${today}T00:00:00Z`);

      const { count: visitorCount } = await supabase
        .from('analytics_events')
        .select('visitor_id', { count: 'exact', head: true })
        .eq('event_type', 'page_view')
        .gte('created_at', `${today}T00:00:00Z`);

      if (visitorCount && visitorCount > 10 && (!signupCount || signupCount === 0)) {
        actions.push({
          id: 'check_conversion',
          title: '회원가입 전환율 점검 필요',
          description: `오늘 ${visitorCount}명 방문했지만 회원가입은 ${signupCount || 0}건입니다. CTA 문구나 온보딩 플로우를 확인하세요.`,
          priority: 'today',
          category: 'Growth',
          icon: 'ri-line-chart-line',
          completed: false,
        });
      }
    } catch {
      // silently handle
    }

    // 4. Cross-platform mobile browser check
    actions.push({
      id: 'mobile_cross_browser_test',
      title: '크로스플랫폼 모바일 QA 실행',
      description: 'iOS Safari/Chrome + Android Chrome/Samsung Internet/Firefox/Edge에서 회원가입 → 온보딩 → 리포트까지 전체 플로우 테스트하세요.',
      priority: 'today',
      category: 'QA',
      icon: 'ri-smartphone-line',
      completed: false,
    });

    // 5. Domain check
    actions.push({
      id: 'domain_check',
      title: '도메인 연결 상태 확인',
      description: '커스텀 도메인이 올바르게 연결되어 있고 HTTPS가 정상 작동하는지 확인하세요.',
      priority: 'soon',
      category: 'Deploy',
      icon: 'ri-global-line',
      completed: false,
    });

    // 6. Stripe payment setup reminder
    actions.push({
      id: 'stripe_setup',
      title: 'Stripe 결제 연동 준비',
      description: '유료 기능 출시 전 Stripe 연동을 완료하고 테스트 결제를 진행하세요.',
      priority: 'soon',
      category: 'Payment',
      icon: 'ri-bank-card-line',
      completed: false,
    });

    // 7. Check recent signups
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { data: recentSignups } = await supabase
        .from('analytics_events')
        .select('visitor_id, created_at')
        .eq('event_type', 'auth_signup')
        .gte('created_at', `${sevenDaysAgo}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`)
        .order('created_at', { ascending: false });

      if (recentSignups && recentSignups.length > 0) {
        actions.push({
          id: 'review_signups',
          title: '최근 가입 사용자 리뷰',
          description: `최근 7일간 ${recentSignups.length}명이 가입했습니다. 사용자 패턴을 확인하세요.`,
          priority: 'today',
          category: 'Growth',
          icon: 'ri-user-add-line',
          completed: false,
        });
      }
    } catch {
      // silently handle
    }

    // 8. SEO check reminder
    actions.push({
      id: 'seo_check',
      title: 'SEO 메타태그 확인',
      description: 'Google Search Console에 등록하고 메타태그가 올바르게 설정되었는지 확인하세요.',
      priority: 'soon',
      category: 'Growth',
      icon: 'ri-search-line',
      completed: false,
    });

    // Filter by completion status
    setItems(actions);
    setLoading(false);
  };

  useEffect(() => {
    generateActions();
    const interval = setInterval(generateActions, 120000);
    return () => clearInterval(interval);
  }, []);

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setItems((it) => it.map((i) => (i.id === id ? { ...i, completed: false } : i)));
      } else {
        next.add(id);
        setItems((it) => it.map((i) => (i.id === id ? { ...i, completed: true } : i)));
      }
      return next;
    });
  };

  const activeItems = items.filter((i) => !i.completed);
  const completedItems = items.filter((i) => i.completed);

  return (
    <div className="dash-card rounded-2xl border overflow-hidden transition-all duration-500" style={{ borderColor: C.graphite, background: C.blackCard }}>
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <div className="flex items-center gap-2">
          <i className="ri-rocket-line text-sm" style={{ color: C.gold, opacity: 0.6 }} />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">
            Founder Today
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-white/06 tracking-wider">
            {activeItems.length} 대기 · {completedItems.length} 완료
          </span>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-[10px] font-mono text-white/10">액션 아이템 분석 중...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${C.emerald}10` }}>
              <i className="ri-check-double-line text-lg" style={{ color: C.emerald, opacity: 0.6 }} />
            </div>
            <span className="text-[10px] font-mono text-white/15 tracking-wider">모든 작업이 완료되었습니다</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Sort: urgent first */}
            {[...activeItems]
              .sort((a, b) => {
                const order = { urgent: 0, today: 1, soon: 2 };
                return order[a.priority] - order[b.priority];
              })
              .map((item) => {
                const prio = PRIORITY_CONFIG[item.priority];
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 hover:bg-white/[0.01]"
                    style={{ borderColor: `${prio.color}12`, background: prio.bg }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${prio.color}15` }}>
                      <i className={`${item.icon} text-[12px]`} style={{ color: prio.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] md:text-[11px] font-mono text-white/40">{item.title}</span>
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider uppercase"
                          style={{ background: `${prio.color}15`, color: prio.color }}
                        >
                          {prio.label}
                        </span>
                        <span className="text-[8px] font-mono text-white/06">{item.category}</span>
                      </div>
                      <p className="text-[9px] md:text-[10px] font-mono text-white/13 leading-relaxed">{item.description}</p>
                    </div>
                    <button
                      onClick={() => toggleComplete(item.id)}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-200 hover:bg-white/[0.05] cursor-pointer"
                      style={{ borderColor: `${C.graphite}50` }}
                      title="완료"
                    >
                      <i className="ri-check-line text-[10px] text-white/12" />
                    </button>
                  </div>
                );
              })}

            {/* Completed items (collapsed) */}
            {completedItems.length > 0 && (
              <div className="pt-2 mt-2 border-t" style={{ borderColor: `${C.graphite}40` }}>
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-check-double-line text-[10px]" style={{ color: C.emerald, opacity: 0.5 }} />
                  <span className="text-[8px] font-mono text-white/08 tracking-wider">완료됨 ({completedItems.length})</span>
                </div>
                <div className="space-y-1 opacity-40">
                  {completedItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 px-2 py-1">
                      <i className={`${item.icon} text-[10px] text-white/10`} />
                      <span className="text-[9px] font-mono text-white/12 line-through">{item.title}</span>
                    </div>
                  ))}
                  {completedItems.length > 3 && (
                    <span className="text-[8px] font-mono text-white/06 pl-2">외 {completedItems.length - 3}개</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}