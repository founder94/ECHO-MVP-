const STORAGE_KEY = 'echo_visit_log';

export interface VisitEntry {
  date: string;
  timestamp: string;
}

export function getVisits(): VisitEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VisitEntry[];
  } catch {
    return [];
  }
}

export function recordVisit(): void {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const timestamp = now.toISOString();
  const visits = getVisits();
  visits.push({ date, timestamp });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
  } catch {
    // storage full — silently ignore
  }
}

export function getTodayCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  return getVisits().filter((v) => v.date === today).length;
}

export function getTotalCount(): number {
  return getVisits().length;
}