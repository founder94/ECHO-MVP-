// Staged integration: DB approval and the reviewed RPC are required before enabling.
// Disabled keeps the existing in-isolate limit; it is not distributed protection.
type RateRoute = 'agent' | 'connect' | 'understanding' | 'admin';
type RateDb = { rpc: (name: string, args: { p_user_id: string; p_route: RateRoute }) => PromiseLike<{ data: unknown; error: unknown }> };
export async function durableRateDecision(db: RateDb, userId: string, route: RateRoute, enabled: boolean): Promise<'disabled' | 'allowed' | 'limited' | 'unavailable'> {
  if (!enabled) return 'disabled';
  try {
    const { data, error } = await db.rpc('echo_consume_api_rate', { p_user_id: userId, p_route: route });
    if (error || typeof data !== 'boolean') return 'unavailable';
    return data ? 'allowed' : 'limited';
  } catch { return 'unavailable'; }
}

// Local compatibility guard only; not a cross-runner limit.
export function makeLocalLimiter(limit: number): (userId: string) => boolean {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('INVALID_SERVER_LIMIT');
  const users = new Map<string, number[]>();
  return (userId: string) => {
    const now = Date.now();
    for (const [key, hits] of users) if (!hits.length || hits[hits.length - 1] <= now - 60000) users.delete(key);
    const hits = (users.get(userId) ?? []).filter(t => t > now - 60000);
    if (hits.length >= limit) return true;
    hits.push(now); users.set(userId, hits); return false;
  };
}
