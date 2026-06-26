import { useState, useEffect, useCallback, useRef } from 'react';
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
  sky: '#7DD3FC',
};

// ── DESIGN TEAM EDIT ZONE ─────────────────────────────
const MAX_NOTIFICATIONS = 50;
const AUTO_CLEAR_AGE_MS = 24 * 60 * 60 * 1000; // 24h
// ───────────────────────────────────────────────────────

interface RealtimeNotification {
  id: string;
  type: 'signup' | 'login' | 'ai_call' | 'ai_error' | 'ai_safety' | 'error' | 'page_view' | 'form_submit' | 'white_door' | 'system';
  title: string;
  message: string;
  details?: string;
  timestamp: string;
  read: boolean;
  visitorId?: string;
}

const NOTIF_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  signup: { icon: 'ri-user-add-line', color: C.emerald, label: '회원가입' },
  login: { icon: 'ri-shield-check-line', color: C.gold, label: '로그인' },
  ai_call: { icon: 'ri-brain-line', color: C.sky, label: 'AI 호출' },
  ai_error: { icon: 'ri-error-warning-line', color: C.danger, label: 'AI 오류' },
  ai_safety: { icon: 'ri-alert-line', color: C.amber, label: 'AI 안전' },
  error: { icon: 'ri-close-circle-line', color: C.danger, label: '오류' },
  page_view: { icon: 'ri-eye-line', color: C.silver, label: '방문' },
  form_submit: { icon: 'ri-survey-line', color: C.pink, label: '폼 제출' },
  white_door: { icon: 'ri-door-open-line', color: C.gold, label: 'White Door' },
  system: { icon: 'ri-settings-3-line', color: C.silver, label: '시스템' },
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 3) return '방금';
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  return `${day}일 전`;
}

function generateId(): string {
  return `rt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'signup' | 'ai' | 'error'>('all');
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<RealtimeNotification | null>(null);

  const addNotification = useCallback((notif: RealtimeNotification) => {
    setNotifications((prev) => {
      // Deduplicate by type+visitorId within 10 seconds
      const tenSecAgo = Date.now() - 10000;
      const duplicate = prev.find(
        (n) =>
          n.type === notif.type &&
          n.visitorId === notif.visitorId &&
          new Date(n.timestamp).getTime() > tenSecAgo
      );
      if (duplicate) return prev;

      const updated = [notif, ...prev].slice(0, MAX_NOTIFICATIONS);
      return updated;
    });

    // Show toast for important events
    if (['signup', 'ai_error', 'error'].includes(notif.type)) {
      setToast(notif);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    }

    setLastEventAt(new Date().toISOString());
  }, []);

  // Subscribe to Supabase realtime channels
  useEffect(() => {
    // Channel 1: analytics_events — signup, login, white_door, error events
    const analyticsChannel = supabase
      .channel('notif-analytics')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events' },
        (payload) => {
          const evt = payload.new as any;
          if (!evt) return;

          let notifType: RealtimeNotification['type'] = 'page_view';
          let title = '';
          let message = '';

          switch (evt.event_type) {
            case 'auth_signup':
              notifType = 'signup';
              title = '새로운 회원가입';
              message = `새로운 사용자가 가입했습니다`;
              break;
            case 'auth_login':
              notifType = 'login';
              title = '사용자 로그인';
              message = `사용자가 로그인했습니다`;
              break;
            case 'white_door_enter':
              notifType = 'white_door';
              title = 'White Door 진입';
              message = `사용자가 White Door에 진입했습니다`;
              break;
            case 'google_form':
              notifType = 'form_submit';
              title = 'Google Form 이동';
              message = `사용자가 구글 폼으로 이동했습니다`;
              break;
            default:
              return; // Don't notify for page views / clicks (too noisy)
          }

          addNotification({
            id: generateId(),
            type: notifType,
            title,
            message,
            details: evt.event_name || '',
            timestamp: evt.created_at || new Date().toISOString(),
            read: false,
            visitorId: evt.visitor_id,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
      });

    // Channel 2: ai_logs — AI call results
    const aiChannel = supabase
      .channel('notif-ai-logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_logs' },
        (payload) => {
          const log = payload.new as any;
          if (!log) return;

          let notifType: RealtimeNotification['type'] = 'ai_call';
          let title = '';
          let message = '';

          if (log.status === 'success') {
            notifType = 'ai_call';
            title = 'AI 분석 완료';
            message = `분석 완료 — ${log.total_tokens?.toLocaleString() || 0} 토큰, ${log.response_time_ms || 0}ms`;
          } else if (log.status === 'safety_triggered') {
            notifType = 'ai_safety';
            title = '⚠️ AI 안전 필터 발동';
            message = '안전 키워드가 감지되어 분석이 중단되었습니다';
          } else {
            notifType = 'ai_error';
            title = 'AI 분석 오류';
            message = log.error_message?.slice(0, 80) || '알 수 없는 오류';
          }

          addNotification({
            id: generateId(),
            type: notifType,
            title,
            message,
            details: `모델: ${log.model || 'gpt-4o-mini'}`,
            timestamp: log.created_at || new Date().toISOString(),
            read: false,
          });
        }
      )
      .subscribe();

    channelsRef.current = [analyticsChannel, aiChannel];

    return () => {
      supabase.removeChannel(analyticsChannel);
      supabase.removeChannel(aiChannel);
    };
  }, [addNotification]);

  // Load recent history on mount
  useEffect(() => {
    async function loadRecent() {
      try {
        // Load recent auth events
        const { data: authEvents } = await supabase
          .from('analytics_events')
          .select('*')
          .or('event_type.eq.auth_signup,event_type.eq.auth_login,event_type.eq.white_door_enter,event_type.eq.google_form')
          .order('created_at', { ascending: false })
          .limit(20);

        if (authEvents) {
          (authEvents as any[]).forEach((evt) => {
            let notifType: RealtimeNotification['type'] = 'page_view';
            let title = '';
            let message = '';
            switch (evt.event_type) {
              case 'auth_signup':
                notifType = 'signup'; title = '회원가입'; message = '새로운 사용자 가입';
                break;
              case 'auth_login':
                notifType = 'login'; title = '로그인'; message = '사용자 로그인';
                break;
              case 'white_door_enter':
                notifType = 'white_door'; title = 'White Door'; message = 'White Door 진입';
                break;
              case 'google_form':
                notifType = 'form_submit'; title = '폼 제출'; message = 'Google Form 이동';
                break;
            }
            addNotification({
              id: `hist_${evt.id}`,
              type: notifType,
              title,
              message,
              timestamp: evt.created_at,
              read: true, // historical = already read
              visitorId: evt.visitor_id,
            });
          });
        }

        // Load recent AI logs
        const { data: aiLogs } = await supabase
          .from('ai_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (aiLogs) {
          (aiLogs as any[]).forEach((log) => {
            let notifType: RealtimeNotification['type'] = 'ai_call';
            let title = '';
            let message = '';
            if (log.status === 'success') {
              notifType = 'ai_call'; title = 'AI 분석'; message = `완료 — ${log.total_tokens?.toLocaleString() || 0} 토큰`;
            } else if (log.status === 'safety_triggered') {
              notifType = 'ai_safety'; title = 'AI 안전'; message = '안전 필터 발동';
            } else {
              notifType = 'ai_error'; title = 'AI 오류'; message = log.error_message?.slice(0, 60) || '오류';
            }
            addNotification({
              id: `hist_ai_${log.id}`,
              type: notifType,
              title,
              message,
              details: `모델: ${log.model || '-'} · ${log.response_time_ms || 0}ms`,
              timestamp: log.created_at,
              read: true,
            });
          });
        }
      } catch {
        // silent
      }
    }
    loadRecent();
  }, [addNotification]);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleClearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleMarkOneRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = (() => {
    switch (statusFilter) {
      case 'unread':
        return notifications.filter((n) => !n.read);
      case 'signup':
        return notifications.filter((n) => n.type === 'signup' || n.type === 'login');
      case 'ai':
        return notifications.filter((n) => n.type.startsWith('ai_'));
      case 'error':
        return notifications.filter((n) => n.type === 'error' || n.type === 'ai_error');
      default:
        return notifications;
    }
  })();

  return (
    <div className="space-y-5 md:space-y-6 relative">
      {/* Toast for important events */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 max-w-sm rounded-2xl border p-4 shadow-2xl animate-slide-in"
          style={{
            background: C.blackCard,
            borderColor: NOTIF_CONFIG[toast.type]?.color + '40' || C.graphite,
            animation: 'slideDown 0.3s ease-out',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${NOTIF_CONFIG[toast.type]?.color || C.silver}15` }}>
              <i className={`${NOTIF_CONFIG[toast.type]?.icon || 'ri-information-line'} text-sm`} style={{ color: NOTIF_CONFIG[toast.type]?.color || C.silver }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-white/60 font-medium">{toast.title}</p>
              <p className="text-[10px] font-mono text-white/30 mt-0.5">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status + Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${connected ? C.emerald : C.danger}06 50%, ${C.blackCard} 100%)`, borderColor: `${connected ? C.emerald : C.danger}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${connected ? C.emerald : C.danger}15` }}>
              <div className={`w-2 h-2 rounded-full ${connected ? '' : 'animate-pulse'}`} style={{ background: connected ? C.emerald : C.danger }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">연결 상태</span>
          </div>
          <div className="text-sm font-mono font-bold" style={{ color: connected ? C.emerald : C.danger }}>
            {connected ? '실시간 수신 중' : '연결 중...'}
          </div>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${C.pink}04 50%, ${C.blackCard} 100%)`, borderColor: `${C.pink}12` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${C.pink}12` }}>
              <i className="ri-notification-3-line text-sm" style={{ color: C.pink }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">전체 알림</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: C.pink, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {notifications.length}
          </div>
        </div>

        <div
          className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500"
          style={{ background: `linear-gradient(145deg, ${C.blackCard} 0%, ${unreadCount > 0 ? C.danger : C.silver}06 50%, ${C.blackCard} 100%)`, borderColor: `${unreadCount > 0 ? C.danger : C.silver}15` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${unreadCount > 0 ? C.danger : C.silver}15` }}>
              <i className="ri-message-3-line text-sm" style={{ color: unreadCount > 0 ? C.danger : C.silver }} />
            </div>
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">읽지 않음</span>
          </div>
          <div className="text-3xl md:text-4xl font-display font-bold tracking-tighter" style={{ color: unreadCount > 0 ? C.danger : C.silver, fontFamily: 'var(--font-heading, sans-serif)' }}>
            {unreadCount}
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
            <span className="text-[9px] font-mono tracking-[0.15em] uppercase text-white/18">마지막 이벤트</span>
          </div>
          <div className="text-xs font-mono text-white/30 mt-2">
            {lastEventAt ? formatTimeAgo(lastEventAt) : '없음'}
          </div>
        </div>
      </div>

      {/* Filter + Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'unread', 'signup', 'ai', 'error'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-mono tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer border ${
                statusFilter === f
                  ? 'bg-white/[0.06] text-white/50 border-white/[0.12]'
                  : 'bg-transparent text-white/18 border-white/[0.04] hover:border-white/[0.08]'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {f === 'all' ? '전체' : f === 'unread' ? '읽지 않음' : f === 'signup' ? '회원' : f === 'ai' ? 'AI' : '오류'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="px-3 py-1.5 rounded-full text-[9px] font-mono tracking-wider text-white/20 border border-white/[0.06] hover:text-white/40 hover:border-white/[0.12] transition-all duration-300 whitespace-nowrap cursor-pointer"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            모두 읽음
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-full text-[9px] font-mono tracking-wider text-white/12 border border-white/[0.04] hover:text-white/25 hover:border-white/[0.08] transition-all duration-300 whitespace-nowrap cursor-pointer"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            전체 삭제
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-notification-3-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">실시간 알림 피드</span>
          <div className="ml-auto flex items-center gap-2">
            {connected && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.emerald }} />}
            <span className="text-[9px] font-mono text-white/12 tracking-wider">{connected ? 'LIVE' : 'CONNECTING'}</span>
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="py-16 text-center">
            <i className="ri-notification-off-line text-2xl text-white/06 block mb-3" />
            <span className="text-xs font-mono text-white/10">
              {notifications.length === 0 ? '아직 수신된 알림이 없습니다' : '해당 필터에 맞는 알림이 없습니다'}
            </span>
            {notifications.length === 0 && (
              <p className="text-[10px] font-mono text-white/06 mt-1">회원가입, 로그인, AI 호출 이벤트가 발생하면 여기에 표시됩니다</p>
            )}
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            {filteredNotifications.map((notif) => {
              const cfg = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.system;
              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkOneRead(notif.id)}
                  className="flex items-start gap-3 px-4 py-3 border-b transition-all duration-200 hover:bg-white/[0.015] cursor-pointer"
                  style={{ borderColor: `${C.graphite}30`, background: notif.read ? 'transparent' : `${cfg.color}04` }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${cfg.color}12` }}>
                    <i className={`${cfg.icon} text-[11px]`} style={{ color: cfg.color, opacity: 0.7 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-mono tracking-wider uppercase" style={{ color: cfg.color, opacity: 0.6 }}>{cfg.label}</span>
                      {!notif.read && <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />}
                    </div>
                    <p className="text-[11px] font-mono text-white/40 font-medium">{notif.title}</p>
                    <p className="text-[10px] font-mono text-white/20 mt-0.5">{notif.message}</p>
                    {notif.details && (
                      <p className="text-[8px] font-mono text-white/08 mt-0.5">{notif.details}</p>
                    )}
                    {notif.visitorId && (
                      <p className="text-[8px] font-mono text-white/06 mt-0.5">#{notif.visitorId.slice(-4)}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-white/12 shrink-0 mt-1 whitespace-nowrap">{formatTimeAgo(notif.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-4 md:px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: C.graphite }}>
          <span className="text-[9px] font-mono text-white/10 tracking-wider">{notifications.length} NOTIFICATIONS</span>
          <span className="text-[9px] font-mono text-white/06 tracking-wider">SUPABASE REALTIME</span>
        </div>
      </div>

      {/* Toast animation style */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}