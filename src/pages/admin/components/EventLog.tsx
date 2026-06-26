import { useEffect, useRef, useState } from 'react';

interface EventLogProps {
  accentColor: string;
}

interface LogEvent {
  id: string;
  type: 'VISIT' | 'LOGIN' | 'FORM_SUBMIT' | 'LOGOUT' | 'SYSTEM';
  message: string;
  timestamp: number;
  status: 'info' | 'success' | 'warning' | 'error';
}

const EVENT_ICONS: Record<string, string> = {
  VISIT: 'ri-user-line', LOGIN: 'ri-shield-check-line', FORM_SUBMIT: 'ri-mail-send-line', LOGOUT: 'ri-logout-box-line', SYSTEM: 'ri-settings-3-line',
};

const EVENT_COLORS: Record<string, string> = {
  info: 'rgba(212,212,212,0.35)', success: 'rgba(74,222,128,0.50)', warning: 'rgba(251,191,36,0.50)', error: 'rgba(248,113,113,0.50)',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function loadEvents(): LogEvent[] {
  const raw = localStorage.getItem('echo_admin_events');
  if (raw) {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

// eslint-disable-next-line react-refresh/only-export-components
export function addEvent(type: LogEvent['type'], message: string, status: LogEvent['status'] = 'info') {
  const events = loadEvents();
  const newEvent: LogEvent = { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type, message, timestamp: Date.now(), status };
  events.unshift(newEvent);
  if (events.length > 50) events.pop();
  localStorage.setItem('echo_admin_events', JSON.stringify(events));
}

const INITIAL_EVENTS: LogEvent[] = [
  { id: 'evt_1', type: 'SYSTEM', message: 'ECHO Admin Terminal initialized', timestamp: Date.now() - 3600000 * 24, status: 'info' },
  { id: 'evt_2', type: 'VISIT', message: 'New visitor from Seoul, KR', timestamp: Date.now() - 3600000 * 20, status: 'info' },
  { id: 'evt_3', type: 'FORM_SUBMIT', message: '무료 체험 신청 — 홍길동 (HX Design)', timestamp: Date.now() - 3600000 * 18, status: 'success' },
  { id: 'evt_4', type: 'VISIT', message: 'New visitor from Busan, KR', timestamp: Date.now() - 3600000 * 15, status: 'info' },
  { id: 'evt_5', type: 'FORM_SUBMIT', message: '무료 체험 신청 — 김철수 (Relationship Intelligence)', timestamp: Date.now() - 3600000 * 12, status: 'success' },
  { id: 'evt_6', type: 'VISIT', message: 'New visitor from Tokyo, JP', timestamp: Date.now() - 3600000 * 8, status: 'info' },
  { id: 'evt_7', type: 'LOGIN', message: 'Admin authentication successful', timestamp: Date.now() - 3600000 * 2, status: 'success' },
  { id: 'evt_8', type: 'FORM_SUBMIT', message: '무료 체험 신청 — 이영희 (AI Coaching)', timestamp: Date.now() - 3600000 * 1, status: 'success' },
  { id: 'evt_9', type: 'VISIT', message: 'New visitor from Incheon, KR', timestamp: Date.now() - 1800000, status: 'info' },
  { id: 'evt_10', type: 'SYSTEM', message: 'System health check: OK', timestamp: Date.now() - 600000, status: 'info' },
];

export default function EventLog({ accentColor }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);

  useEffect(() => {
    let current = loadEvents();
    if (current.length === 0) {
      localStorage.setItem('echo_admin_events', JSON.stringify(INITIAL_EVENTS));
      current = INITIAL_EVENTS;
    }
    setEvents(current);
    const interval = setInterval(() => { setEvents(loadEvents()); }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { if (scrollRef.current) { scrollRef.current.scrollTop = 0; } }, [events.length]);

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6 h-full flex flex-col">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: `${accentColor}25` }} />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: `${accentColor}25` }} />
      <div className="flex items-center justify-between mb-5">
        <span className="text-[8px] font-mono tracking-[0.35em] uppercase text-white/18">REAL-TIME EVENT LOG</span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400/60 animate-pulse" />
          <span className="text-[8px] font-mono text-white/15 tracking-wider">LIVE</span>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '320px' }}>
        {events.map((evt, i) => (
          <div key={evt.id} className="flex items-start gap-3 py-2 px-3 rounded-lg border border-white/[0.03] bg-white/[0.01] transition-all duration-300 hover:bg-white/[0.03]" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <i className={`${EVENT_ICONS[evt.type]} text-[10px]`} style={{ color: EVENT_COLORS[evt.status] }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[9px] font-mono tracking-wider uppercase" style={{ color: EVENT_COLORS[evt.status] }}>{evt.type}</span>
                <span className="text-[8px] font-mono text-white/15 tracking-wider shrink-0">{formatTime(evt.timestamp)}</span>
              </div>
              <p className="text-[10px] font-mono text-white/35 leading-relaxed truncate">{evt.message}</p>
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="text-center py-8"><span className="text-[9px] font-mono text-white/15 tracking-wider">NO EVENTS RECORDED</span></div>}
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[8px] font-mono text-white/15 tracking-wider">{events.length} EVENTS</span>
        <span className="text-[8px] font-mono text-white/10 tracking-wider">AUTO-REFRESH 3s</span>
      </div>
    </div>
  );
}