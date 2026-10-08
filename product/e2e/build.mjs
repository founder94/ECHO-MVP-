import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
// Remove inherited VITE settings so tests cannot accidentally use real services.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')));
Object.assign(env, {
  VITE_PUBLIC_SUPABASE_URL: 'https://echo-e2e.supabase.co',
  VITE_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key-not-a-credential',
  VITE_APP_ORIGIN: 'http://127.0.0.1:4173',
  VITE_BRAND_ORIGIN: 'http://127.0.0.1:4174',
  VITE_ADMIN_ORIGIN: 'http://127.0.0.1:4175',
  VITE_A_STRUCTURE_SERVER_ENABLED: 'true',
  VITE_ECHO_FOLLOWUP_ENABLED: 'true',
  VITE_ECHO_AGENT_ENABLED: 'true',
  VITE_GOOGLE_LOGIN_ENABLED: 'false',
});
// Dedicated mode ignores production .env.production. Required public test values
// above override defaults; the browser fixture rejects all real outbound APIs.
for (const role of ['app', 'brand', 'admin']) {
  const r = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e', '--outDir', `e2e-dist/${role}`], {
    cwd: root, env: { ...env, VITE_SITE_ROLE: role }, stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
