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

interface Profile {
  id: string;
  email: string;
  name: string;
  age_group: string;
  onboarding_answers: any;
  created_at: string;
  updated_at: string;
}

type StatusFilter = 'all' | 'today' | 'active' | 'dormant';
type SortField = 'created_at' | 'email' | 'name';

function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}.${month}.${day} ${h}:${m}`;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [aiStats, setAiStats] = useState<Record<string, number>>({});

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      const profiles = (data || []) as Profile[];
      setUsers(profiles);

      // Fetch AI stats per user
      const { data: aiLogs } = await supabase
        .from('ai_logs')
        .select('user_id')
        .eq('status', 'success');

      if (aiLogs) {
        const statsMap: Record<string, number> = {};
        (aiLogs as { user_id: string }[]).forEach((l) => {
          if (l.user_id) {
            statsMap[l.user_id] = (statsMap[l.user_id] || 0) + 1;
          }
        });
        setAiStats(statsMap);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || '사용자 데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 15000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  // Filter + Sort
  useEffect(() => {
    let result = [...users];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          (u.email || '').toLowerCase().includes(q) ||
          (u.name || '').toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    }

    // Status filter
    const today = getTodayStr();
    if (statusFilter === 'today') {
      result = result.filter((u) => u.created_at?.startsWith(today));
    } else if (statusFilter === 'active') {
      result = result.filter((u) => {
        const updated = new Date(u.updated_at).getTime();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return updated > weekAgo;
      });
    } else if (statusFilter === 'dormant') {
      result = result.filter((u) => {
        const updated = new Date(u.updated_at).getTime();
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return updated < monthAgo;
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') {
        cmp = (a.created_at || '').localeCompare(b.created_at || '');
      } else if (sortField === 'email') {
        cmp = (a.email || '').localeCompare(b.email || '');
      } else if (sortField === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    setFilteredUsers(result);
  }, [users, searchQuery, statusFilter, sortField, sortDir]);

  if (loading && users.length === 0) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
        <div className="flex items-center gap-2 px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
          <i className="ri-group-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">User Management</span>
        </div>
        <div className="p-10 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.graphite, background: C.blackCard }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 md:py-4 border-b" style={{ borderColor: C.graphite }}>
        <div className="flex items-center gap-2">
          <i className="ri-group-line text-sm text-white/20" />
          <span className="text-[9px] md:text-[10px] font-mono tracking-[0.2em] uppercase text-white/18 whitespace-nowrap">User Management</span>
        </div>
        <span className="text-[10px] font-mono text-white/10">{filteredUsers.length}명 / 총 {users.length}명</span>
      </div>

      {/* Search + Filters */}
      <div className="px-4 md:px-6 py-3 border-b flex flex-col sm:flex-row gap-3" style={{ borderColor: C.graphite }}>
        {/* Search */}
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/15" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이메일, 이름, ID로 검색..."
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none transition-all duration-300 border bg-white/[0.02] text-white/60 placeholder:text-white/10"
            style={{ borderColor: `${C.white}08`, background: C.blackCard, fontSize: '13px' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <i className="ri-close-line text-xs" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: 'all', label: '전체' },
            { key: 'today', label: '오늘 가입' },
            { key: 'active', label: '활성' },
            { key: 'dormant', label: '휴면' },
          ] as { key: StatusFilter; label: string }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-1.5 rounded-full text-[9px] font-mono tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer border ${
                statusFilter === f.key
                  ? 'bg-white/[0.06] text-white/50 border-white/[0.12]'
                  : 'bg-transparent text-white/18 border-white/[0.04] hover:border-white/[0.08]'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="rounded-lg px-2 py-1.5 text-[9px] font-mono outline-none border bg-white/[0.02] text-white/30 cursor-pointer"
            style={{ borderColor: `${C.white}08`, background: C.blackCard }}
          >
            <option value="created_at">가입일</option>
            <option value="email">이메일</option>
            <option value="name">이름</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="w-7 h-7 rounded-lg flex items-center justify-center border cursor-pointer transition-all duration-300"
            style={{ borderColor: `${C.white}08`, background: C.blackCard, WebkitTapHighlightColor: 'transparent' }}
          >
            <i className={`${sortDir === 'asc' ? 'ri-sort-asc' : 'ri-sort-desc'} text-xs text-white/30`} />
          </button>
        </div>
      </div>

      {/* User Table */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-16 text-white/10 text-xs font-mono">
          {searchQuery ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: `${C.graphite}80` }}>
                {['사용자', '이메일', '가입일', '연령대', 'AI 분석', '상태'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-[9px] font-mono tracking-wider uppercase text-white/12 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const updated = new Date(user.updated_at).getTime();
                const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                const isActive = updated > weekAgo;
                const isDormant = updated < monthAgo;
                const aiCount = aiStats[user.id] || 0;

                return (
                  <tr
                    key={user.id}
                    className="border-b transition-all duration-300 hover:bg-white/[0.008] cursor-pointer"
                    style={{ borderColor: `${C.graphite}40` }}
                    onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-mono font-bold" style={{ background: `${C.gold}15`, color: C.gold }}>
                          {(user.name || user.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-mono text-white/50">{user.name || '이름 없음'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono text-white/30">{user.email || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/18">{formatDateTime(user.created_at)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono text-white/15">{user.age_group || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold"
                        style={{ background: aiCount > 0 ? `${C.emerald}12` : `${C.graphite}20`, color: aiCount > 0 ? C.emerald : C.graphite }}
                      >
                        {aiCount}회
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold"
                        style={{
                          background: isActive ? `${C.emerald}12` : isDormant ? `${C.amber}12` : `${C.silver}10`,
                          color: isActive ? C.emerald : isDormant ? C.amber : C.silver,
                        }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? C.emerald : isDormant ? C.amber : C.silver }} />
                        {isActive ? 'Active' : isDormant ? 'Dormant' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* User Detail Panel (expand) */}
      {selectedUser && (
        <div className="border-t px-4 md:px-6 py-4" style={{ borderColor: C.graphite }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono text-white/30 tracking-wider">사용자 상세</h3>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-white/15 hover:text-white/40 cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <i className="ri-close-line" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
            <div>
              <span className="text-white/10 text-[9px] font-mono uppercase tracking-wider">ID</span>
              <p className="text-white/25 font-mono mt-0.5 break-all">{selectedUser.id}</p>
            </div>
            <div>
              <span className="text-white/10 text-[9px] font-mono uppercase tracking-wider">이메일</span>
              <p className="text-white/25 font-mono mt-0.5">{selectedUser.email || '-'}</p>
            </div>
            <div>
              <span className="text-white/10 text-[9px] font-mono uppercase tracking-wider">이름</span>
              <p className="text-white/25 font-mono mt-0.5">{selectedUser.name || '-'}</p>
            </div>
            <div>
              <span className="text-white/10 text-[9px] font-mono uppercase tracking-wider">연령대</span>
              <p className="text-white/25 font-mono mt-0.5">{selectedUser.age_group || '-'}</p>
            </div>
            <div>
              <span className="text-white/10 text-[9px] font-mono uppercase tracking-wider">AI 분석</span>
              <p className="text-white/25 font-mono mt-0.5">{aiStats[selectedUser.id] || 0}회</p>
            </div>
            <div>
              <span className="text-white/10 text-[9px] font-mono uppercase tracking-wider">마지막 활동</span>
              <p className="text-white/25 font-mono mt-0.5">{formatDateTime(selectedUser.updated_at)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 md:px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: C.graphite }}>
        <span className="text-[9px] font-mono text-white/10 tracking-wider">{filteredUsers.length} USERS</span>
        <span className="text-[9px] font-mono text-white/06 tracking-wider">AUTO-REFRESH 15s</span>
      </div>
    </div>
  );
}