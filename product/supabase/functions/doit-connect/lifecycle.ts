// Server projections only. No price, reward amount, reputation weight, or inferred facts.
export const FIRST_ROOM_MS = 72 * 60 * 60 * 1000;
export function firstRoom(openedAt: string, actionTimes: string[], now: number) {
  const opened = Date.parse(openedAt);
  if (!Number.isFinite(opened) || !Number.isFinite(now) || opened > now) return { status: 'unavailable', opened_at: null, expires_at: null, first_action_at: null };
  const expires = opened + FIRST_ROOM_MS;
  const first = actionTimes.map(Date.parse).filter(t => Number.isFinite(t) && t >= opened && t < expires && t <= now).sort((a, b) => a - b)[0];
  return {
    status: first !== undefined ? 'active' : now >= expires ? 'expired' : 'open',
    opened_at: new Date(opened).toISOString(), expires_at: new Date(expires).toISOString(),
    first_action_at: first === undefined ? null : new Date(first).toISOString(),
  };
}
export interface WindowPreference { timezone: string; quiet: { start: number; end: number } | null; delivery: { start: number; end: number } | null }
function inWindow(minute: number, window: { start: number; end: number }) {
  if (![window.start, window.end].every(n => Number.isInteger(n) && n >= 0 && n < 1440) || window.start === window.end) throw new Error('INVALID_WINDOW');
  return window.start < window.end ? minute >= window.start && minute < window.end : minute >= window.start || minute < window.end;
}
// IANA timezone + local minutes, including DST and overnight/daytime sleep. No universal midnight batch.
export function deliveryAllowed(now: number, preference: WindowPreference): boolean {
  if (!Number.isFinite(now)) throw new Error('INVALID_TIME');
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: preference.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const minute = Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);
  return !(preference.quiet && inWindow(minute, preference.quiet)) && (!preference.delivery || inWindow(minute, preference.delivery));
}
