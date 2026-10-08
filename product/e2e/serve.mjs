import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../e2e-dist', import.meta.url)));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };
for (const [role, port] of [['app', 4173], ['brand', 4174], ['admin', 4175]]) {
  const dir = resolve(root, role);
  // Match the common /* block in the build's actual Netlify header file.
  const headers = {};
  for (const line of readFileSync(resolve(dir, '_headers'), 'utf8').split('\n')) {
    const m = /^\s+([^:]+):\s*(.+)$/.exec(line);
    if (m) headers[m[1]] = m[2];
  }
  http.createServer((req, res) => {
    let path;
    try { path = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname); }
    catch { res.writeHead(400); res.end(); return; }
    let file = resolve(dir, `.${path}`);
    if (file !== dir && !file.startsWith(dir + sep)) { res.writeHead(403); res.end(); return; }
    if (file === dir || !existsSync(file)) file = resolve(dir, 'index.html');
    try {
      res.writeHead(200, { ...headers, 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  }).listen(port, '127.0.0.1', () => process.stdout.write(`${role} test server: ${port}\n`));
}
