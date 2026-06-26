import { useEffect, useState } from 'react';

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

interface ErrorEntry {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location: string;
  userId?: string;
  device?: string;
  browser?: string;
  cause: string;
  status: 'new' | 'investigating' | 'fixed' | 'ignored';
  detectedAt: string;
  resolvedAt?: string;
}

const ERROR_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  '404': { label: '404 Not Found', icon: 'ri-file-unknow-line', color: C.amber },
  '500': { label: '500 Server Error', icon: 'ri-server-line', color: C.danger },
  'supabase': { label: 'Supabase Error', icon: 'ri-database-2-line', color: C.amber },
  'auth': { label: 'Auth Error', icon: 'ri-shield-keyhole-line', color: C.danger },
  'openai': { label: 'OpenAI Error', icon: 'ri-brain-line', color: C.danger },
  'edge_function': { label: 'Edge Function Error', icon: 'ri-function-line', color: C.danger },
  'network': { label: 'Network Error', icon: 'ri-wifi-off-line', color: C.amber },
  'oauth': { label: 'OAuth Error', icon: 'ri-shield-check-line', color: C.amber },
  'runtime': { label: 'Runtime Error', icon: 'ri-bug-line', color: C.danger },
  'mobile_safari': { label: 'Mobile Safari Error', icon: 'ri-safari-line', color: C.amber },
  'console': { label: 'Console Error', icon: 'ri-terminal-box-line', color: C.silver },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: C.danger, bg: 'rgba(248,113,113,0.12)', label: 'CRITICAL' },
  high: { color: C.danger, bg: 'rgba(248,113,113,0.08)', label: 'HIGH' },
  medium: { color: C.amber, bg: 'rgba(251,191,36,0.08)', label: 'MEDIUM' },
  low: { color: C.silver, bg: 'rgba(160,160,176,0.08)', label: 'LOW' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  new: { color: C.danger, bg: 'rgba(248,113,113,0.10)', label: 'New' },
  investigating: { color: C.amber, bg: 'rgba(251,191,36,0.10)', label: 'Investigating' },
  fixed: { color: C.emerald, bg: 'rgba(110,231,183,0.10)', label: 'Fixed' },
  ignored: { color: C.silver, bg: 'rgba(160,160,176,0.06)', label: 'Ignored' },
};

const STORAGE_KEY = 'echo_admin_errors';

function loadErrors(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveErrors(errors: ErrorEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
}

// Initial demo errors
const DEMO_ERRORS: ErrorEntry[] = [
  {
    id: 'err_demo_1',
    type: 'openai',
    severity: 'high',
    message: 'OpenAI API 응답 실패: Rate limit exceeded',
    location: 'echo-ai-analysis Edge Function',
    device: 'Desktop',
    browser: 'Chrome',
    cause: 'API Rate Limit',
    status: 'fixed',
    detectedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'err_demo_2',
    type: 'auth',
    severity: 'medium',
    message: '로그인 실패: Invalid login credentials',
    location: '/auth',
    device: 'Mobile',
    browser: 'Safari',
    cause: '잘못된 비밀번호',
    status: 'ignored',
    detectedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
  {
    id: 'err_demo_3',
    type: '404',
    severity: 'low',
    message: '404: /favicon-custom.svg not found',
    location: '/',
    device: 'Desktop',
    browser: 'Chrome',
    cause: '리소스 누락',
    status: 'fixed',
    detectedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'err_demo_4',
    type: 'network',
    severity: 'medium',
    message: 'Supabase 연결 타임아웃 (5초 초과)',
    location: 'analytics_events insert',
    device: 'Mobile',
    browser: 'Kakao',
    cause: '네트워크 불안정',
    status: 'fixed',
    detectedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
];

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${h}:${m}`;
}

export default function ErrorCenter() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = loadErrors();
    if (current.length === 0) {
      saveErrors(DEMO_ERRORS);
      current = DEMO_ERRORS;
    }
    setErrors(current);
    setLoading(false);
  }, []);

  const updateStatus = (id: string, status: ErrorEntry['status']) => {
    const updated = errors.map((e) =>
      e.id === id
        ? { ...e, status, ...(status === 'fixed' || status === 'ignored' ? { resolvedAt: new Date().toISOString() } : {}) }
        : e
    );
    setErrors(updated);
    saveErrors(updated);
  };

  const addError = (entry: Omit<ErrorEntry, 'id' | 'detectedAt'>) => {
    const newError: ErrorEntry = {
      ...entry,
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      detectedAt: new Date().toISOString(),
    };
    const updated = [newError, ...errors].slice(0, 200);
    setErrors(updated);
    saveErrors(updated);
  };

  const filtered = errors.filter((e) => {
    if (filter !== 'all' && e.type !== filter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    return true;
  });

  const typeOptions = Object.keys(ERROR_TYPES);
  const counts = {
    total: errors.length,
    new: errors.filter((e) => e.status === 'new').length,
    investigating: errors.filter((e) => e.status === 'investigating').length,
    critical: errors.filter((e) => e.severity === 'critical' || e.severity === 'high').length,
  };

  if (loading) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-error-warning-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">Error Center</span>
        </div>
        <div className="p-6 flex items-center justify-center h-40">
          <span className="text-white/10 text-xs font-mono">로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: '총 오류', value: counts.total, color: C.silver, icon: 'ri-error-warning-line' },
          { label: 'New', value: counts.new, color: C.danger, icon: 'ri-alert-fill' },
          { label: 'Investigating', value: counts.investigating, color: C.amber, icon: 'ri-search-line' },
          { label: 'Critical/High', value: counts.critical, color: C.danger, icon: 'ri-error-warning-fill' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border overflow-hidden p-4 md:p-5 transition-all duration-500 cursor-default" style={{ borderColor: C.graphite, background: C.blackCard }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${item.color}12` }}>
                <i className={`${item.icon} text-[13px]`} style={{ color: item.color, opacity: 0.7 }} />
              </div>
              <span className="text-[9px] font-mono tracking-wider text-white/15 uppercase">{item.label}</span>
            </div>
            <div className="font-display font-bold text-2xl md:text-3xl" style={{ color: item.color, fontFamily: 'var(--font-heading, sans-serif)' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main error list */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <div className="flex items-center gap-2">
            <i className="ri-error-warning-line text-sm" style={{ color: counts.new > 0 ? C.danger : C.silver, opacity: 0.6 }} />
            <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">Error Center</span>
            {counts.new > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[8px] font-mono font-bold" style={{ background: C.danger, color: '#fff' }}>
                {counts.new}
              </span>
            )}
          </div>
          <span className="text-[8px] font-mono text-white/08 tracking-wider">{filtered.length} ENTRIES</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 px-4 md:px-6 py-2.5 border-b flex-wrap" style={{ borderColor: `${C.graphite}60` }}>
          {/* Type filter */}
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-full text-[8px] font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer border ${
              filter === 'all' ? 'bg-white/[0.06] text-white/40 border-white/[0.10]' : 'bg-transparent text-white/15 border-white/[0.03] hover:border-white/[0.08]'
            }`}
          >
            ALL
          </button>
          {typeOptions.map((type) => {
            const t = ERROR_TYPES[type];
            return (
              <button
                key={type}
                onClick={() => setFilter(filter === type ? 'all' : type)}
                className={`px-2.5 py-1 rounded-full text-[8px] font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer border ${
                  filter === type ? 'bg-white/[0.06] text-white/40 border-white/[0.10]' : 'bg-transparent text-white/12 border-white/[0.03] hover:border-white/[0.08]'
                }`}
                style={{ color: filter === type ? t.color : undefined, borderColor: filter === type ? `${t.color}25` : undefined }}
              >
                {t.label}
              </button>
            );
          })}

          <span className="text-white/06 mx-2">|</span>

          {/* Status filter */}
          {(['all', 'new', 'investigating', 'fixed', 'ignored'] as const).map((s) => {
            const sc = STATUS_CONFIG[s] || { color: C.silver, label: s };
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`px-2 py-1 rounded-full text-[8px] font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer border ${
                  statusFilter === s ? 'bg-white/[0.06] text-white/40 border-white/[0.10]' : 'bg-transparent text-white/12 border-white/[0.03] hover:border-white/[0.08]'
                }`}
                style={{ color: statusFilter === s ? sc.color : undefined }}
              >
                {s === 'all' ? 'ALL STATUS' : sc.label}
              </button>
            );
          })}
        </div>

        {/* Error list */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(110,231,183,0.06)' }}>
              <i className="ri-check-line text-2xl" style={{ color: C.emerald, opacity: 0.3 }} />
            </div>
            <span className="text-[11px] font-mono text-white/10">No errors detected</span>
            <p className="text-[9px] font-mono text-white/04 mt-1">시스템이 정상 동작 중입니다</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: `${C.graphite}60` }}>
                    {['시간', '유형', '심각도', '메시지', '위치', '디바이스', '상태', ''].map((h) => (
                      <th key={h} className="text-left py-2.5 px-3 text-[8px] font-mono tracking-wider uppercase text-white/10 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const typeConfig = ERROR_TYPES[e.type] || { icon: 'ri-error-warning-line', color: C.silver, label: e.type };
                    const sev = SEVERITY_CONFIG[e.severity];
                    const statusConf = STATUS_CONFIG[e.status];
                    return (
                      <tr key={e.id} className="border-b transition-all duration-300 hover:bg-white/[0.01]" style={{ borderColor: `${C.graphite}30` }}>
                        <td className="py-2.5 px-3">
                          <span className="text-[9px] font-mono text-white/12 whitespace-nowrap">{formatDateTime(e.detectedAt)}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <i className={`${typeConfig.icon} text-[10px]`} style={{ color: typeConfig.color, opacity: 0.5 }} />
                            <span className="text-[9px] font-mono text-white/25">{typeConfig.label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider uppercase" style={{ background: sev.bg, color: sev.color }}>
                            {sev.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[280px]">
                          <span className="text-[9px] font-mono text-white/35 truncate block">{e.message}</span>
                          <span className="text-[7px] font-mono text-white/06">{e.cause}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[8px] font-mono text-white/12">{e.location}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[8px] font-mono text-white/10">{e.device || '-'} · {e.browser || '-'}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider uppercase" style={{ background: statusConf.bg, color: statusConf.color }}>
                            {statusConf.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            {e.status === 'new' && (
                              <button
                                onClick={() => updateStatus(e.id, 'investigating')}
                                className="w-5 h-5 rounded flex items-center justify-center text-[8px] transition-all cursor-pointer hover:bg-white/[0.04]"
                                style={{ color: C.amber }}
                                title="조사 중"
                              >
                                <i className="ri-search-line" />
                              </button>
                            )}
                            {e.status !== 'fixed' && (
                              <button
                                onClick={() => updateStatus(e.id, 'fixed')}
                                className="w-5 h-5 rounded flex items-center justify-center text-[8px] transition-all cursor-pointer hover:bg-white/[0.04]"
                                style={{ color: C.emerald }}
                                title="해결 완료"
                              >
                                <i className="ri-check-line" />
                              </button>
                            )}
                            {e.status !== 'ignored' && (
                              <button
                                onClick={() => updateStatus(e.id, 'ignored')}
                                className="w-5 h-5 rounded flex items-center justify-center text-[8px] transition-all cursor-pointer hover:bg-white/[0.04]"
                                style={{ color: C.silver }}
                                title="무시"
                              >
                                <i className="ri-close-line" />
                              </button>
                            )}
                            {(e.status === 'fixed' || e.status === 'ignored') && (
                              <button
                                onClick={() => updateStatus(e.id, 'new')}
                                className="w-5 h-5 rounded flex items-center justify-center text-[8px] transition-all cursor-pointer hover:bg-white/[0.04]"
                                style={{ color: C.danger }}
                                title="다시 열기"
                              >
                                <i className="ri-refresh-line" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-3 space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.map((e) => {
                const typeConfig = ERROR_TYPES[e.type] || { icon: 'ri-error-warning-line', color: C.silver, label: e.type };
                const sev = SEVERITY_CONFIG[e.severity];
                const statusConf = STATUS_CONFIG[e.status];
                return (
                  <div key={e.id} className="rounded-xl border p-3.5 space-y-2" style={{ borderColor: `${C.graphite}60`, background: `${C.blackCard}80` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <i className={`${typeConfig.icon} text-xs`} style={{ color: typeConfig.color, opacity: 0.6 }} />
                        <span className="text-[10px] font-mono text-white/35">{typeConfig.label}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider uppercase" style={{ background: sev.bg, color: sev.color }}>
                          {sev.label}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-white/10">{formatDateTime(e.detectedAt)}</span>
                    </div>
                    <p className="text-[10px] font-mono text-white/25">{e.message}</p>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-white/08 font-mono">{e.cause}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-mono tracking-wider uppercase" style={{ background: statusConf.bg, color: statusConf.color }}>
                        {statusConf.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 pt-1">
                      {e.status === 'new' && (
                        <button onClick={() => updateStatus(e.id, 'investigating')} className="px-2 py-1 rounded text-[8px] font-mono cursor-pointer" style={{ background: `${C.amber}10`, color: C.amber }}>
                          조사 중
                        </button>
                      )}
                      {e.status !== 'fixed' && (
                        <button onClick={() => updateStatus(e.id, 'fixed')} className="px-2 py-1 rounded text-[8px] font-mono cursor-pointer" style={{ background: `${C.emerald}10`, color: C.emerald }}>
                          해결 완료
                        </button>
                      )}
                      {e.status !== 'ignored' && (
                        <button onClick={() => updateStatus(e.id, 'ignored')} className="px-2 py-1 rounded text-[8px] font-mono cursor-pointer" style={{ background: `${C.silver}10`, color: C.silver }}>
                          무시
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Shared utility — consumed by other admin modules
// eslint-disable-next-line react-refresh/only-export-components
export function addErrorToCenter(entry: Omit<ErrorEntry, 'id' | 'detectedAt'>) {
  const errors = loadErrors();
  const newError: ErrorEntry = {
    ...entry,
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    detectedAt: new Date().toISOString(),
  };
  const updated = [newError, ...errors].slice(0, 200);
  saveErrors(updated);
}