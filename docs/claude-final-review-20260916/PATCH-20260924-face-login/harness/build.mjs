import { build } from '../tools/node_modules/esbuild/lib/main.js';
import path from 'node:path';
const SRC = path.resolve('../check-v17/src');
await build({
  entryPoints: ['entry.tsx'], bundle: true, outdir: 'out', format: 'esm', jsx: 'automatic', target: 'es2022',
  nodePaths: [path.resolve('../check-v17/node_modules')],
  loader: { '.png': 'dataurl', '.webp': 'dataurl', '.svg': 'dataurl', '.jpg': 'dataurl', '.css': 'css' },
  define: { 'import.meta.env': JSON.stringify({ VITE_PUBLIC_SUPABASE_URL: 'http://localhost:4640', VITE_PUBLIC_SUPABASE_ANON_KEY: 'stub-anon', VITE_A_STRUCTURE_SERVER_ENABLED: 'true', VITE_SITE_ROLE: 'app', DEV: false, PROD: true, MODE: 'production' }), 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  plugins: [{ name: 'alias', setup(b) {
    b.onResolve({ filter: /^@\// }, async (args) => b.resolve(path.join(SRC, args.path.slice(2)), { resolveDir: args.resolveDir, kind: args.kind }));
  } }],
});
console.log('built');
