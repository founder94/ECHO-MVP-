import http from 'node:http'; import { readFile, stat } from 'node:fs/promises'; import path from 'node:path';
const root = process.argv[2]; const port = +process.argv[3];
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.webp':'image/webp', '.svg':'image/svg+xml', '.json':'application/json', '.webmanifest':'application/manifest+json', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.woff2':'font/woff2' };
http.createServer(async (req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html'); } catch { p = path.join(root, 'index.html'); }
  try { const b = await readFile(p); res.writeHead(200, { 'Content-Type': types[path.extname(p)] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(port);
