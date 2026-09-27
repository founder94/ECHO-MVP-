// Public, read-only smoke. Auth and real AI are deliberately not claimed by this probe.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [origin, build] = process.argv.slice(2);
if (origin !== 'https://echo-qa-app-20260927.netlify.app') throw Error('QA smoke origin is locked');
if (!build) throw Error('Checked build directory required');
const expected = [
  ['/', 'text/html'], ['/do-it/intro?next=app', 'text/html'], ['/login', 'text/html'],
  ['/signup', 'text/html'], ['/doit/start-journey', 'text/html'],
  ['/manifest.webmanifest', 'application/manifest+json'],
  ['/pwa/echo-icon-192.png', 'image/png'], ['/pwa/echo-icon-512.png', 'image/png'],
  ['/pwa/echo-icon-512-maskable.png', 'image/png'], ['/pwa/echo-icon-180.png', 'image/png']
];
for (const [path, type] of expected) {
  const res = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(20000), cache: 'no-store', redirect: 'error' });
  const content = res.headers.get('content-type') || '';
  if (!res.ok || !content.includes(type)) throw Error(`${path}: HTTP ${res.status}, ${content}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length < 100 || (type === 'image/png' && !(bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71))) throw Error(`${path}: invalid body`);
  if (path === '/manifest.webmanifest') {
    const m = JSON.parse(new TextDecoder().decode(bytes));
    if (m.short_name !== 'DO IT QA' || !m.start_url?.startsWith('/do-it/intro')) throw Error('Live manifest disagrees with QA contract');
  }
  if (path.startsWith('/pwa/') || path === '/manifest.webmanifest' || path === '/') {
    const local = readFileSync(join(build, path === '/' ? 'index.html' : path));
    const digest = b => createHash('sha256').update(b).digest('hex');
    if (digest(bytes) !== digest(local)) throw Error(`${path}: live bytes differ from checked build`);
  }
  console.log(`${path}: PASS`);
}
