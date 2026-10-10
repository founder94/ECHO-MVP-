// CORS is defense in depth. Token and record ownership checks remain mandatory.
export function browserOriginAllowed(origin: string | null, allowed: readonly string[]): boolean {
  return origin === null || (origin !== 'null' && origin !== '*' && allowed.includes(origin));
}
export function browserCorsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  return {
    ...(origin && browserOriginAllowed(origin, allowed) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin, Authorization',
  };
}
