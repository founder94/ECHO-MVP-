/**
 * ECHO Analytics Data Layer — Supabase Backed
 *
 * Supabase analytics_events 테이블에 모든 이벤트를 저장합니다.
 * 프론트엔드 성능을 위해 로컬 큐에 버퍼링 후 debounce flush 방식으로 전송합니다.
 *
 * - visitor_id: 익명 추적용 UUID (localStorage 유지)
 * - user_id: 로그인 후 연결
 * - session_id: 페이지 로드 시 생성, 세션 단위 추적
 */

import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────

export interface VisitorProfile {
  visitorId: string;
  name?: string;
  email?: string;
  firstVisitAt: string;
  lastVisitAt: string;
  totalVisits: number;
  device: string;
  browser: string;
  os: string;
}

export interface AnalyticsEvent {
  id?: number;
  visitor_id: string;
  user_id?: string | null;
  event_type: 'page_view' | 'button_click' | 'section_enter' | 'section_exit' | 'google_form' | 'auth_signup' | 'auth_login' | 'auth_logout' | 'white_door_enter';
  event_name: string;
  page_path?: string;
  button_name?: string;
  section_name?: string;
  referrer?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ClickStat {
  buttonName: string;
  count: number;
  lastClickedAt: string;
}

export interface PageStat {
  page: string;
  count: number;
  ratio: number;
}

export interface ActivityLogEntry {
  id: string;
  type: 'VISIT' | 'CLICK' | 'GOOGLE_FORM' | 'AUTH' | 'SECTION' | 'WHITE_DOOR';
  visitorId: string;
  visitorName: string;
  message: string;
  timestamp: string;
  device?: string;
  browser?: string;
  referrer?: string;
  page?: string;
  buttonName?: string;
}

export interface ConversionFunnel {
  label: string;
  count: number;
  rate: number;
}

export interface DeviceRatio {
  device: string;
  count: number;
  ratio: number;
}

export interface ReferrerStat {
  referrer: string;
  count: number;
  ratio: number;
}

export interface SectionTimeStat {
  section: string;
  totalStaySeconds: number;
  avgStaySeconds: number;
  visits: number;
}

// ── Storage Keys ───────────────────────────────────────

const KEYS = {
  VISITOR_ID: 'echo_visitor_id',
  SESSION_ID: 'echo_session_id',
  EVENT_QUEUE: 'echo_event_queue',
};

// ── Helpers ────────────────────────────────────────────

function generateId(): string {
  return `echo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('KAKAO')) return 'Kakao';
  if (ua.includes('Instagram')) return 'Instagram';
  return 'Other';
}

export function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    if (/iPad|Tablet/i.test(ua) || (navigator.maxTouchPoints > 1 && !/Mobile/i.test(ua))) return 'Tablet';
    return 'Mobile';
  }
  return 'Desktop';
}

export function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return 'iOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  return 'Other';
}

export function detectReferrer(): string {
  const ref = document.referrer || '';
  if (!ref) return 'Direct';
  if (ref.includes('linkedin.com')) return 'LinkedIn';
  if (ref.includes('instagram.com')) return 'Instagram';
  if (ref.includes('youtube.com')) return 'YouTube';
  if (ref.includes('kakao.com')) return 'Kakao';
  if (ref.includes('google.com') || ref.includes('google.co')) return 'Google';
  if (ref.includes('naver.com')) return 'Naver';
  return 'Other';
}

// ── Visitor ID & Session ─────────────────────────────────

export function getOrCreateVisitorId(): string {
  let visitorId = localStorage.getItem(KEYS.VISITOR_ID);
  if (!visitorId) {
    visitorId = generateId();
    localStorage.setItem(KEYS.VISITOR_ID, visitorId);
  }
  return visitorId;
}

export function getVisitorId(): string | null {
  return localStorage.getItem(KEYS.VISITOR_ID);
}

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(KEYS.SESSION_ID);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(KEYS.SESSION_ID, sessionId);
  }
  return sessionId;
}

// ── Local Event Queue (Background Flush) ───────────────

let flushTimer: ReturnType<typeof setTimeout> | null = null;
const QUEUE_FLUSH_INTERVAL = 2000; // 2 second debounce
const QUEUE_MAX_SIZE = 50;         // force flush at 50 events

function getQueue(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(KEYS.EVENT_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setQueue(queue: AnalyticsEvent[]): void {
  try {
    localStorage.setItem(KEYS.EVENT_QUEUE, JSON.stringify(queue));
  } catch {
    // storage full — flush immediately to clear space
    flushQueue(true);
  }
}

async function flushQueue(immediate = false): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const queue = getQueue();
  if (queue.length === 0) return;

  // Remove from localStorage immediately so we don't lose them on crash
  setQueue([]);

  try {
    const { error } = await supabase.from('analytics_events').insert(queue);
    if (error) {
      // Re-queue failed events (only if not too many)
      const currentQueue = getQueue();
      if (currentQueue.length < 200) {
        setQueue([...queue, ...currentQueue]);
      }
    }
  } catch {
    // Network error — re-queue
    const currentQueue = getQueue();
    if (currentQueue.length < 200) {
      setQueue([...queue, ...currentQueue]);
    }
  }
}

function enqueueEvent(event: Omit<AnalyticsEvent, 'id' | 'created_at'>): void {
  const queue = getQueue();
  queue.push(event as AnalyticsEvent);
  setQueue(queue);

  // Force flush if queue is large
  if (queue.length >= QUEUE_MAX_SIZE) {
    flushQueue(true);
    return;
  }

  // Debounced flush
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flushQueue(), QUEUE_FLUSH_INTERVAL);
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushQueue(true));
  window.addEventListener('pagehide', () => flushQueue(true));
}

// ── Event Recording ────────────────────────────────────

function baseEventFields() {
  return {
    visitor_id: getOrCreateVisitorId(),
    session_id: getOrCreateSessionId(),
    device_type: detectDevice(),
    browser: detectBrowser(),
    os: detectOS(),
    referrer: detectReferrer(),
  };
}

export function recordPageView(page: string, path: string): void {
  enqueueEvent({
    ...baseEventFields(),
    event_type: 'page_view',
    event_name: page,
    page_path: path,
  });
}

export function recordButtonClick(buttonName: string, page: string): void {
  enqueueEvent({
    ...baseEventFields(),
    event_type: 'button_click',
    event_name: buttonName,
    button_name: buttonName,
    page_path: window.location.pathname,
  });
}

export function recordGoogleForm(): void {
  enqueueEvent({
    ...baseEventFields(),
    event_type: 'google_form',
    event_name: 'Google Form 이동',
  });
}

export function recordSectionEnter(sectionName: string): void {
  enqueueEvent({
    ...baseEventFields(),
    event_type: 'section_enter',
    event_name: sectionName,
    section_name: sectionName,
    page_path: window.location.pathname,
  });
}

export function recordSectionExit(sectionName: string, durationMs: number): void {
  enqueueEvent({
    ...baseEventFields(),
    event_type: 'section_exit',
    event_name: sectionName,
    section_name: sectionName,
    page_path: window.location.pathname,
    metadata: { duration_ms: durationMs },
  });
}

export function recordAuthEvent(eventName: string, eventType: 'auth_signup' | 'auth_login' | 'auth_logout', userId?: string): void {
  enqueueEvent({
    ...baseEventFields(),
    user_id: userId || null,
    event_type: eventType,
    event_name: eventName,
    page_path: window.location.pathname,
  });
}

export function recordWhiteDoorEnter(): void {
  enqueueEvent({
    ...baseEventFields(),
    event_type: 'white_door_enter',
    event_name: 'White Door 진입',
    page_path: window.location.pathname,
  });
}

// ── Query Functions (for Admin Dashboard) ──────────────

function getTimeRange(start: string, end: string) {
  return { start: start + 'T00:00:00Z', end: end + 'T23:59:59Z' };
}

export async function getCountByType(
  eventType: string,
  from: string,
  to: string
): Promise<number> {
  const range = getTimeRange(from, to);
  const { count } = await supabase
    .from('analytics_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', eventType)
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  return count || 0;
}

export async function getTodayVisitCount(): Promise<number> {
  const today = getToday();
  return getCountByType('page_view', today, today);
}

export async function getTotalVisitorCount(): Promise<number> {
  const { count } = await supabase
    .from('analytics_events')
    .select('visitor_id', { count: 'exact', head: true });
  // Count distinct visitors via query
  const { data } = await supabase
    .from('analytics_events')
    .select('visitor_id');
  if (!data) return 0;
  const uniqueVisitors = new Set(data.map((d: { visitor_id: string }) => d.visitor_id));
  return uniqueVisitors.size;
}

export async function getUniqueVisitorCount(from: string, to: string): Promise<number> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  if (!data) return 0;
  return new Set(data.map((d: { visitor_id: string }) => d.visitor_id)).size;
}

export async function getGoogleFormCount(from: string, to: string): Promise<number> {
  return getCountByType('google_form', from, to);
}

export async function getButtonClickStats(from: string, to: string): Promise<ClickStat[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('button_name, created_at')
    .eq('event_type', 'button_click')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];

  const map = new Map<string, { count: number; lastClickedAt: string }>();
  (data as { button_name: string; created_at: string }[]).forEach((e) => {
    const name = e.button_name || 'Unknown';
    const existing = map.get(name);
    if (existing) {
      existing.count += 1;
      if (e.created_at > existing.lastClickedAt) existing.lastClickedAt = e.created_at;
    } else {
      map.set(name, { count: 1, lastClickedAt: e.created_at });
    }
  });
  return Array.from(map.entries())
    .map(([buttonName, stats]) => ({ buttonName, ...stats }))
    .sort((a, b) => b.count - a.count);
}

export async function getPageVisitStats(from: string, to: string): Promise<PageStat[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('event_name')
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];

  const map = new Map<string, number>();
  let total = 0;
  (data as { event_name: string }[]).forEach((e) => {
    const name = e.event_name || 'Unknown';
    map.set(name, (map.get(name) || 0) + 1);
    total += 1;
  });

  return Array.from(map.entries())
    .map(([page, count]) => ({ page, count, ratio: total > 0 ? ((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getActiveNowCount(): Promise<number> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('analytics_events')
    .select('visitor_id', { count: 'exact', head: true })
    .gte('created_at', fiveMinAgo);
  if (!count) return 0;

  const { data } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .gte('created_at', fiveMinAgo);

  if (!data) return 0;
  return new Set(data.map((d: { visitor_id: string }) => d.visitor_id)).size;
}

export async function getLastActivityTime(): Promise<string | null> {
  const { data } = await supabase
    .from('analytics_events')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data as { created_at: string }).created_at : null;
}

export async function getConversionFunnel(from: string, to: string): Promise<ConversionFunnel[]> {
  const range = getTimeRange(from, to);

  // 1. All visitors
  const { count: totalVisitors } = await supabase
    .from('analytics_events')
    .select('visitor_id', { count: 'exact', head: true })
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  // 2. Clicked "시작하기"
  const { data: clickData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'button_click')
    .or('button_name.ilike.%시작하기%,button_name.ilike.%ECHO 시작%')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const clickVisitors = new Set((clickData || []).map((d: { visitor_id: string }) => d.visitor_id));

  // 3. Reached auth page
  const { data: authData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'page_view')
    .ilike('event_name', '%Login%')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const authVisitors = new Set((authData || []).map((d: { visitor_id: string }) => d.visitor_id));

  // 4. Signed up
  const { data: signupData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'auth_signup')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const signupVisitors = new Set((signupData || []).map((d: { visitor_id: string }) => d.visitor_id));

  // 5. Logged in
  const { data: loginData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'auth_login')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const loginVisitors = new Set((loginData || []).map((d: { visitor_id: string }) => d.visitor_id));

  const v = totalVisitors || 1;
  return [
    { label: '방문자', count: v, rate: 100 },
    { label: '시작하기 클릭', count: clickVisitors.size, rate: Math.round((clickVisitors.size / v) * 100) },
    { label: 'Auth 진입', count: authVisitors.size, rate: Math.round((authVisitors.size / v) * 100) },
    { label: '회원가입 완료', count: signupVisitors.size, rate: Math.round((signupVisitors.size / v) * 100) },
    { label: '로그인 완료', count: loginVisitors.size, rate: Math.round((loginVisitors.size / v) * 100) },
  ];
}

export async function getDeviceRatio(from: string, to: string): Promise<DeviceRatio[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('device_type')
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];
  const map = new Map<string, number>();
  let total = 0;
  (data as { device_type: string }[]).forEach((d) => {
    const dt = d.device_type || 'Unknown';
    map.set(dt, (map.get(dt) || 0) + 1);
    total += 1;
  });
  return Array.from(map.entries())
    .map(([device, count]) => ({ device, count, ratio: total > 0 ? Math.round((count / total) * 100) : 0 }));
}

export async function getReferrerStats(from: string, to: string): Promise<ReferrerStat[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('referrer')
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];
  const map = new Map<string, number>();
  let total = 0;
  (data as { referrer: string }[]).forEach((d) => {
    const ref = d.referrer || 'Direct';
    map.set(ref, (map.get(ref) || 0) + 1);
    total += 1;
  });
  return Array.from(map.entries())
    .map(([referrer, count]) => ({ referrer, count, ratio: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getSectionTimeStats(from: string, to: string): Promise<SectionTimeStat[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('section_name, metadata, visitor_id')
    .eq('event_type', 'section_exit')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];
  const map = new Map<string, { totalDuration: number; count: number }>();
  (data as { section_name: string; metadata: { duration_ms: number } }[]).forEach((d) => {
    const name = d.section_name || 'Unknown';
    const dur = (d.metadata?.duration_ms || 0) / 1000;
    const existing = map.get(name);
    if (existing) {
      existing.totalDuration += dur;
      existing.count += 1;
    } else {
      map.set(name, { totalDuration: dur, count: 1 });
    }
  });
  return Array.from(map.entries())
    .map(([section, s]) => ({
      section,
      totalStaySeconds: Math.round(s.totalDuration),
      avgStaySeconds: s.count > 0 ? Math.round(s.totalDuration / s.count) : 0,
      visits: s.count,
    }))
    .sort((a, b) => b.totalStaySeconds - a.totalStaySeconds);
}

export async function getVisitorTrend(
  from: string,
  to: string
): Promise<{ date: string; count: number }[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('created_at')
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: true });

  if (!data) return [];
  const dayMap = new Map<string, number>();
  (data as { created_at: string }[]).forEach((d) => {
    const day = d.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  });
  return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));
}

export async function getRecentActivity(limit: number = 100): Promise<ActivityLogEntry[]> {
  const { data } = await supabase
    .from('analytics_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  return (data as AnalyticsEvent[]).map((e) => {
    let type: ActivityLogEntry['type'] = 'VISIT';
    if (e.event_type === 'button_click') type = 'CLICK';
    else if (e.event_type === 'google_form') type = 'GOOGLE_FORM';
    else if (e.event_type?.startsWith('auth_')) type = 'AUTH';
    else if (e.event_type?.startsWith('section_')) type = 'SECTION';
    else if (e.event_type === 'white_door_enter') type = 'WHITE_DOOR';

    let message = e.event_name || '';
    if (e.event_type === 'page_view') message = `${e.event_name} 방문`;
    else if (e.event_type === 'button_click') message = `${e.button_name} 클릭`;
    else if (e.event_type === 'google_form') message = 'Google Form 이동';
    else if (e.event_type === 'auth_signup') message = '회원가입';
    else if (e.event_type === 'auth_login') message = '로그인';
    else if (e.event_type === 'auth_logout') message = '로그아웃';
    else if (e.event_type === 'section_enter') message = `${e.section_name} 섹션 진입`;

    return {
      id: String(e.id || ''),
      type,
      visitorId: e.visitor_id,
      visitorName: `익명 #${e.visitor_id.slice(-4)}`,
      message,
      timestamp: e.created_at || '',
      device: e.device_type,
      browser: e.browser,
      referrer: e.referrer,
      page: e.event_name,
      buttonName: e.button_name,
    };
  });
}

export async function getMostClickedCTA(from: string, to: string): Promise<string> {
  const stats = await getButtonClickStats(from, to);
  return stats.length > 0 ? stats[0].buttonName : '-';
}

export async function getMostExitedSection(from: string, to: string): Promise<SectionTimeStat | null> {
  const stats = await getSectionTimeStats(from, to);
  // The section with most entries but shortest avg time = likely bounce point
  if (stats.length === 0) return null;
  return stats.sort((a, b) => a.avgStaySeconds - b.avgStaySeconds)[0];
}

export async function getVisitorProfiles(from: string, to: string): Promise<VisitorProfile[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('visitor_id, created_at, device_type, browser, os, page_path')
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false });

  if (!data) return [];

  const map = new Map<string, VisitorProfile>();
  (data as { visitor_id: string; created_at: string; device_type: string; browser: string; os: string; page_path: string }[]).forEach((row) => {
    const existing = map.get(row.visitor_id);
    if (existing) {
      existing.totalVisits += 1;
      if (row.created_at > existing.lastVisitAt) {
        existing.lastVisitAt = row.created_at;
        existing.device = row.device_type || 'Unknown';
        existing.browser = row.browser || 'Unknown';
        existing.os = row.os || 'Unknown';
      }
    } else {
      map.set(row.visitor_id, {
        visitorId: row.visitor_id,
        firstVisitAt: row.created_at,
        lastVisitAt: row.created_at,
        totalVisits: 1,
        device: row.device_type || 'Unknown',
        browser: row.browser || 'Unknown',
        os: row.os || 'Unknown',
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => b.lastVisitAt.localeCompare(a.lastVisitAt));
}

// ── 추가 쿼리 함수들 (Admin 고도화용) ──────────────────

export async function getSignupCount(from: string, to: string): Promise<number> {
  return getCountByType('auth_signup', from, to);
}

export async function getLoginCount(from: string, to: string): Promise<number> {
  return getCountByType('auth_login', from, to);
}

export async function getWhiteDoorCount(from: string, to: string): Promise<number> {
  return getCountByType('white_door_enter', from, to);
}

export async function getAvgStayDuration(from: string, to: string): Promise<number> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('metadata')
    .eq('event_type', 'section_exit')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data || data.length === 0) return 0;
  let totalMs = 0;
  let count = 0;
  (data as { metadata: { duration_ms: number } | null }[]).forEach((d) => {
    if (d.metadata?.duration_ms) {
      totalMs += d.metadata.duration_ms;
      count += 1;
    }
  });
  return count > 0 ? Math.round(totalMs / count / 1000) : 0;
}

export async function getConversionRate(from: string, to: string): Promise<number> {
  const totalVisitors = await getUniqueVisitorCount(from, to);
  if (totalVisitors === 0) return 0;
  const signupCount = await getSignupCount(from, to);
  return Math.round((signupCount / totalVisitors) * 1000) / 10;
}

export interface LiveVisitor {
  visitorId: string;
  name: string;
  currentPage: string;
  device: string;
  browser: string;
  os: string;
  lastActiveAt: string;
  sessionDurationMin: number;
  referrer: string;
}

export async function getLiveVisitors(): Promise<LiveVisitor[]> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('analytics_events')
    .select('visitor_id, event_name, page_path, device_type, browser, os, created_at, referrer')
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false });

  if (!data) return [];

  const map = new Map<string, LiveVisitor>();
  (data as { visitor_id: string; event_name: string; page_path: string; device_type: string; browser: string; os: string; created_at: string; referrer: string }[]).forEach((row) => {
    if (map.has(row.visitor_id)) return;
    const firstSeen = data.filter((d: any) => d.visitor_id === row.visitor_id).pop() as any;
    const sessionStart = firstSeen?.created_at || row.created_at;
    const durationMs = new Date(row.created_at).getTime() - new Date(sessionStart).getTime();
    map.set(row.visitor_id, {
      visitorId: row.visitor_id,
      name: `방문자 #${row.visitor_id.slice(-5)}`,
      currentPage: row.page_path || row.event_name || '/',
      device: row.device_type || 'Unknown',
      browser: row.browser || 'Unknown',
      os: row.os || 'Unknown',
      lastActiveAt: row.created_at,
      sessionDurationMin: Math.round(durationMs / 60000),
      referrer: row.referrer || 'Direct',
    });
  });

  return Array.from(map.values()).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

export interface ButtonCTR {
  buttonName: string;
  clicks: number;
  uniqueVisitors: number;
  ctr: number;
  lastClickedAt: string;
}

export async function getButtonCTRStats(from: string, to: string): Promise<ButtonCTR[]> {
  const range = getTimeRange(from, to);
  const totalVisitors = await getUniqueVisitorCount(from, to);

  const { data } = await supabase
    .from('analytics_events')
    .select('button_name, visitor_id, created_at')
    .eq('event_type', 'button_click')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];

  const map = new Map<string, { clicks: number; visitors: Set<string>; lastClickedAt: string }>();
  (data as { button_name: string; visitor_id: string; created_at: string }[]).forEach((e) => {
    const name = e.button_name || 'Unknown';
    const existing = map.get(name);
    if (existing) {
      existing.clicks += 1;
      existing.visitors.add(e.visitor_id);
      if (e.created_at > existing.lastClickedAt) existing.lastClickedAt = e.created_at;
    } else {
      map.set(name, { clicks: 1, visitors: new Set([e.visitor_id]), lastClickedAt: e.created_at });
    }
  });

  return Array.from(map.entries())
    .map(([buttonName, stats]) => ({
      buttonName,
      clicks: stats.clicks,
      uniqueVisitors: stats.visitors.size,
      ctr: totalVisitors > 0 ? Math.round((stats.visitors.size / totalVisitors) * 1000) / 10 : 0,
      lastClickedAt: stats.lastClickedAt,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

export interface EnhancedFunnel {
  label: string;
  count: number;
  rate: number;
  dropOff: number;
  status: 'active' | 'coming_soon';
}

export async function getEnhancedFunnel(from: string, to: string): Promise<EnhancedFunnel[]> {
  const range = getTimeRange(from, to);

  // 1. All visitors (unique)
  const { data: allVisitors } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const visitorSet = new Set((allVisitors || []).map((d: any) => d.visitor_id));
  const totalV = visitorSet.size || 1;

  // 2. Clicked "시작하기" or "회원가입"
  const { data: clickData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'button_click')
    .or('button_name.ilike.%시작하기%,button_name.ilike.%ECHO 시작%,button_name.ilike.%회원가입%')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const clickSet = new Set((clickData || []).map((d: any) => d.visitor_id));

  // 3. Signed up
  const { data: signupData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'auth_signup')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const signupSet = new Set((signupData || []).map((d: any) => d.visitor_id));

  // 4. Logged in
  const { data: loginData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'auth_login')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const loginSet = new Set((loginData || []).map((d: any) => d.visitor_id));

  // 5. White Door entered
  const { data: wdData } = await supabase
    .from('analytics_events')
    .select('visitor_id')
    .eq('event_type', 'white_door_enter')
    .gte('created_at', range.start)
    .lte('created_at', range.end);
  const wdSet = new Set((wdData || []).map((d: any) => d.visitor_id));

  const funnel: EnhancedFunnel[] = [
    { label: '방문', count: totalV, rate: 100, dropOff: 0, status: 'active' },
    { label: 'CTA 클릭', count: clickSet.size, rate: Math.round((clickSet.size / totalV) * 100), dropOff: Math.round(((totalV - clickSet.size) / totalV) * 100), status: 'active' },
    { label: '회원가입', count: signupSet.size, rate: Math.round((signupSet.size / totalV) * 100), dropOff: Math.round(((clickSet.size - signupSet.size) / Math.max(clickSet.size, 1)) * 100), status: 'active' },
    { label: '로그인', count: loginSet.size, rate: Math.round((loginSet.size / totalV) * 100), dropOff: Math.round(((signupSet.size - loginSet.size) / Math.max(signupSet.size, 1)) * 100), status: 'active' },
    { label: 'AI 분석 시작', count: 0, rate: 0, dropOff: 0, status: 'coming_soon' },
    { label: 'AI 분석 완료', count: 0, rate: 0, dropOff: 0, status: 'coming_soon' },
    { label: 'White Door', count: wdSet.size, rate: Math.round((wdSet.size / totalV) * 100), dropOff: Math.round(((loginSet.size - wdSet.size) / Math.max(loginSet.size, 1)) * 100), status: 'active' },
    { label: '결제', count: 0, rate: 0, dropOff: 0, status: 'coming_soon' },
  ];

  return funnel;
}

export interface NotificationItem {
  id: string;
  type: 'signup' | 'login' | 'error' | 'payment' | 'system';
  message: string;
  timestamp: string;
  read: boolean;
  visitorName?: string;
}

export async function getRecentNotifications(): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from('analytics_events')
    .select('event_type, event_name, visitor_id, created_at')
    .or('event_type.eq.auth_signup,event_type.eq.auth_login')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!data) return [];

  return (data as { event_type: string; event_name: string; visitor_id: string; created_at: string }[]).map((e) => {
    const type = e.event_type === 'auth_signup' ? 'signup' : 'login';
    const msg = e.event_type === 'auth_signup' ? '새로운 회원가입' : '사용자 로그인';
    return {
      id: `notif_${e.created_at}_${e.visitor_id.slice(-4)}`,
      type: type as NotificationItem['type'],
      message: msg,
      timestamp: e.created_at,
      read: false,
      visitorName: `#${e.visitor_id.slice(-4)}`,
    };
  });
}

export async function getBrowserStats(from: string, to: string): Promise<{ browser: string; count: number; ratio: number }[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('browser')
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];
  const map = new Map<string, number>();
  let total = 0;
  (data as { browser: string }[]).forEach((d) => {
    const b = d.browser || 'Unknown';
    map.set(b, (map.get(b) || 0) + 1);
    total += 1;
  });
  return Array.from(map.entries())
    .map(([browser, count]) => ({ browser, count, ratio: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getOSStats(from: string, to: string): Promise<{ os: string; count: number; ratio: number }[]> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('os')
    .eq('event_type', 'page_view')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (!data) return [];
  const map = new Map<string, number>();
  let total = 0;
  (data as { os: string }[]).forEach((d) => {
    const o = d.os || 'Unknown';
    map.set(o, (map.get(o) || 0) + 1);
    total += 1;
  });
  return Array.from(map.entries())
    .map(([os, count]) => ({ os, count, ratio: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getNewVsReturning(from: string, to: string): Promise<{ newVisitors: number; returningVisitors: number }> {
  const range = getTimeRange(from, to);
  const { data } = await supabase
    .from('analytics_events')
    .select('visitor_id, created_at')
    .eq('event_type', 'page_view')
    .order('created_at', { ascending: true });

  if (!data) return { newVisitors: 0, returningVisitors: 0 };

  const visitorFirstSeen = new Map<string, string>();
  (data as { visitor_id: string; created_at: string }[]).forEach((d) => {
    if (!visitorFirstSeen.has(d.visitor_id) || d.created_at < visitorFirstSeen.get(d.visitor_id)!) {
      visitorFirstSeen.set(d.visitor_id, d.created_at);
    }
  });

  let newVisitors = 0;
  let returningVisitors = 0;
  visitorFirstSeen.forEach((firstSeen) => {
    if (firstSeen >= (range.start + 'T00:00:00Z')) {
      newVisitors += 1;
    } else {
      returningVisitors += 1;
    }
  });

  return { newVisitors, returningVisitors };
}

// ── Sync: user_id 연결 ────────────────────────────────

export async function linkVisitorToUser(visitorId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('analytics_events')
      .update({ user_id: userId })
      .eq('visitor_id', visitorId)
      .is('user_id', null);
    if (error) {
      // silently fail — analytics should never break UX
    }
  } catch {
    // silently fail
  }
}

// ── Init ───────────────────────────────────────────────

getOrCreateVisitorId();
getOrCreateSessionId();

// Flush any remaining events from previous session on startup
flushQueue();