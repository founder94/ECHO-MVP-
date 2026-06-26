import { useState, useRef, useEffect } from 'react';
import type { NotificationItem } from '@/hooks/useAnalytics';

const C = {
  gold: '#F5D4A1',
  pink: '#D4A0B8',
  silver: '#A0A0B0',
  graphite: '#2A2A2A',
  blackCard: '#0F0F0F',
  emerald: '#6EE7B7',
  danger: '#F87171',
};

function formatTimeAgoNotif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return '방금';
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  return `${hour}시간 전`;
}

const NOTIF_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  signup: { icon: 'ri-user-add-line', color: C.emerald, label: '회원가입' },
  login: { icon: 'ri-shield-check-line', color: C.gold, label: '로그인' },
  error: { icon: 'ri-error-warning-line', color: C.danger, label: '오류' },
  payment: { icon: 'ri-bank-card-line', color: C.pink, label: '결제' },
  system: { icon: 'ri-settings-3-line', color: C.silver, label: '시스템' },
};

interface NotificationBellProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClear: () => void;
}

export default function NotificationBell({ notifications, onMarkAllRead, onClear }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full border transition-all duration-300 cursor-pointer hover:bg-white/[0.04]"
        style={{ borderColor: open ? `${C.gold}30` : `${C.graphite}60`, background: open ? `${C.gold}06` : 'transparent' }}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <i className="ri-notification-3-line text-sm text-white/35" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[8px] font-mono font-bold" style={{ background: C.danger, color: '#fff' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 md:w-96 rounded-2xl border overflow-hidden z-50 shadow-2xl"
          style={{ borderColor: C.graphite, background: C.blackCard }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: C.graphite }}>
            <div className="flex items-center gap-2">
              <i className="ri-notification-3-line text-sm text-white/30" />
              <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-white/20">알림</span>
              {unreadCount > 0 && (
                <span className="text-[9px] font-mono text-white/10">({unreadCount})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onMarkAllRead(); }}
                className="text-[8px] font-mono tracking-wider text-white/15 hover:text-white/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                모두 읽음
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="text-[8px] font-mono tracking-wider text-white/10 hover:text-white/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                비우기
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <i className="ri-notification-off-line text-xl text-white/06 block mb-2" />
                <span className="text-[10px] font-mono text-white/08">새로운 알림이 없습니다</span>
              </div>
            ) : (
              notifications.slice(0, 30).map((n) => {
                const config = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 border-b transition-all duration-200 hover:bg-white/[0.015]"
                    style={{ borderColor: `${C.graphite}30`, background: n.read ? 'transparent' : `${config.color}04` }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${config.color}12` }}>
                      <i className={`${config.icon} text-[11px]`} style={{ color: config.color, opacity: 0.7 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-mono tracking-wider uppercase" style={{ color: config.color, opacity: 0.6 }}>{config.label}</span>
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />}
                      </div>
                      <p className="text-[10px] font-mono text-white/30 truncate">{n.message}</p>
                      {n.visitorName && (
                        <p className="text-[8px] font-mono text-white/08 mt-0.5">{n.visitorName}</p>
                      )}
                    </div>
                    <span className="text-[8px] font-mono text-white/10 shrink-0 mt-1">{formatTimeAgoNotif(n.timestamp)}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t flex items-center justify-center" style={{ borderColor: C.graphite }}>
            <span className="text-[8px] font-mono text-white/06 tracking-wider">ECHO Admin Notification Center</span>
          </div>
        </div>
      )}
    </div>
  );
}