// 배포 산출물(out)을 Netlify 와 같은 방식(_redirects: /* → /index.html 200)으로 띄운다.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
const ROOT = resolve(process.argv[2]);
const PORT = Number(process.argv[3] || 8899);
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json', '.webp':'image/webp', '.png':'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = join(ROOT, decodeURIComponent(url.pathname));
  try {
    const s = await stat(p);
    if (s.isDirectory()) p = join(p, 'index.html');
  } catch {
    p = join(ROOT, 'index.html'); // SPA fallback = _redirects 200
  }
  try {
    const body = await readFile(p);
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => console.log('serving', ROOT, 'on', PORT));
