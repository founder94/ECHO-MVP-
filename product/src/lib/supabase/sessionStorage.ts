// 2026-10-08 approved security change: retire shared-domain authentication cookies.
// New sessions use the SDK's origin-scoped storage. Never copy old cookies into it.
// Brand/app single sign-on needs a separately reviewed server-mediated implementation.
export function retireSharedSessionCookies(authKey: string, win: Window | undefined = typeof window === 'undefined' ? undefined : window): void {
  if (!win) return;
  const host = win.location.hostname.toLowerCase();
  if (host !== 'do-it.company' && !host.endsWith('.do-it.company')) return;
  if (win.location.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
  try {
    for (const entry of win.document.cookie.split(';')) {
      const name = entry.trim().split('=')[0];
      if (name === authKey || name.startsWith(`${authKey}.`) || name.startsWith(`${authKey}-`)) {
        win.document.cookie = `${name}=; Max-Age=0; Domain=do-it.company; Path=/; Secure; SameSite=Lax`;
      }
    }
  } catch {
    // Cookie-disabled browsers still use origin storage; do not recover a shared token.
  }
}
