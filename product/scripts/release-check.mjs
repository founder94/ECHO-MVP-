// Fail closed before a QA or production asset may be uploaded.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const [target, directory] = process.argv.slice(2);
if (!['qa-app', 'qa-brand', 'production-app', 'production-brand'].includes(target) || !directory) throw Error('Target and build directory required');
const qa = target.startsWith('qa-');
const app = target.endsWith('-app');
const ref = 'mutniujeiyujhkobadkd';
const url = process.env.VITE_PUBLIC_SUPABASE_URL || '';
const expected = qa ? `https://${ref}.supabase.co` : process.env.PROD_PUBLIC_SUPABASE_URL;
if (!expected || url !== expected || (qa ? process.env.PROD_PUBLIC_SUPABASE_URL === url : url.includes(ref))) throw Error('Supabase target mismatch');
if (qa && process.env.VITE_APP_ORIGIN !== 'https://echo-qa-app-20260927.netlify.app') throw Error('QA app origin mismatch');
if (qa && process.env.VITE_BRAND_ORIGIN !== 'https://echo-qa-app-20260927.netlify.app') throw Error('QA brand origin mismatch');
const files = [];
function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const p = join(path, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile()) files.push(p);
    else throw Error(`Unsupported output entry: ${p}`);
  }
}
walk(directory);
const file = (p) => readFileSync(join(directory, p));
const html = file('index.html').toString();
const manifestPath = join(directory, 'manifest.webmanifest');
if (app) {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (m.display !== 'standalone' || m.scope !== '/' || !m.start_url?.startsWith('/do-it/intro')) throw Error('PWA entry/scope invalid');
  if (m.short_name !== (qa ? 'DO IT QA' : 'DO IT')) throw Error('PWA name mismatch');
  if (!m.icons.some(x => x.sizes === '192x192' && x.purpose === 'any') || !m.icons.some(x => x.sizes === '512x512' && x.purpose === 'any') || !m.icons.some(x => x.sizes === '512x512' && x.purpose === 'maskable')) throw Error('PWA icon set incomplete');
  for (const icon of m.icons) {
    const p = icon.src.split('?')[0];
    if (!p.startsWith('/pwa/') || !statSync(join(directory, p)).size) throw Error('PWA icon missing');
  }
  if (!html.includes('apple-touch-icon') || !html.includes('rel="manifest"') || !html.includes('/pwa/echo-icon-32.png')) throw Error('App head missing install assets');
  if (qa && process.env.VITE_AUTH_GOOGLE_ENABLED !== 'false') throw Error('QA Google control not disabled');
  if (qa && ['src/pages/login/page.tsx', 'src/pages/signup/page.tsx'].some(p => !readFileSync(p, 'utf8').includes('VITE_AUTH_GOOGLE_ENABLED'))) throw Error('Google buttons have no QA display guard');
} else if (html.includes('rel="manifest"') || html.includes('apple-touch-icon')) throw Error('Brand contains app install metadata');
for (const path of files) {
  const name = relative(directory, path).replaceAll('\\', '/');
  if (/\.(map|env)(\.|$)/i.test(name) || /(^|\/)\.env/i.test(name)) throw Error('Forbidden build artifact');
  if (!/\.(html|js|css|json|webmanifest|svg|txt|xml|webp|png|jpg|jpeg)$/i.test(name)) continue;
  const data = readFileSync(path);
  if (/\.(png|webp|jpg|jpeg)$/i.test(name)) continue;
  const body = data.toString();
  if (/service_role|sb_secret_|sk_live_|test_sk_|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|localhost:\d+|127\.0\.0\.1:\d+/i.test(body)) throw Error(`Forbidden public content: ${name}`);
  if (qa && /(?:https?:\/\/)(?:app\.)?do-it\.company\b|https?:\/\/[^\s"'<>]*\.supabase\.co/.test(body.replaceAll(expected, ''))) throw Error(`Production or foreign URL in QA build: ${name}`);
  if (!qa && body.includes(ref)) throw Error(`QA reference in production build: ${name}`);
}
const hash = createHash('sha256');
for (const p of files.sort()) { hash.update(relative(directory, p)); hash.update(readFileSync(p)); }
console.log(JSON.stringify({ target, commit: process.env.GITHUB_SHA || 'local', build_sha256: hash.digest('hex'), file_count: files.length }));
