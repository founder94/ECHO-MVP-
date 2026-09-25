// 가짜 Supabase(로그인 + doit-account). 탈퇴 버튼이 무엇을 보내는지, 어떤 순서로 화면이 바뀌는지만 본다.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const PORT = 4650, ROOT = path.resolve('out');
const state = { mode: 'ok', calls: [], deleteAttempts: 0, logout: 0 };
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'qa@example.com', email_confirmed_at: '2026-09-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-09-01T00:00:00Z' };
const session = () => ({ access_token: 'at-' + crypto.randomUUID(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rt-x', user: USER });
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const counts = { answers: 5, insights: 3, photos: 3, matches: 1 };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); return res.end(); }
  if (url.pathname === '/__state') return send(res, 200, state);
  if (url.pathname === '/__mode') { Object.assign(state, { mode: url.searchParams.get('m'), calls: [], deleteAttempts: 0, logout: 0 }); return send(res, 200, { ok: true }); }
  let body = ''; for await (const c of req) body += c; const json = body ? JSON.parse(body) : {};
  if (url.pathname.startsWith('/auth/v1/')) {
    const p = url.pathname.slice('/auth/v1'.length);
    if (p === '/token') return send(res, 200, session());
    if (p === '/user') return send(res, 200, USER);
    if (p === '/logout') { state.logout++; return state.deleteAttempts && state.mode !== 'storagefail' ? send(res, 403, { code: 403, error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' }) : send(res, 204); }
    return send(res, 404, { msg: 'no stub ' + p });
  }
  if (url.pathname === '/functions/v1/doit-account') {
    state.calls.push({ action: json.action, confirm: json.confirm ?? null, keys: Object.keys(json).sort(), auth: (req.headers.authorization || '').startsWith('Bearer at-') });
    const m = state.mode;
    if (m === 'notdeployed') return send(res, 404, { code: 'NOT_FOUND', message: 'Requested function was not found' });
    if (json.action === 'preview') {
      if (m === 'admin') return send(res, 200, { ok: true, counts, can_delete: false, blocked_code: 'ADMIN_ACCOUNT', blocked_reason: '관리자 계정은 앱에서 탈퇴할 수 없어요. 운영 메일로 요청해 주세요.' });
      return send(res, 200, { ok: true, counts, can_delete: true, blocked_code: null, blocked_reason: null });
    }
    if (json.action === 'delete_me') {
      state.deleteAttempts++;
      if (m === 'storagefail' && state.deleteAttempts === 1) return send(res, 500, { ok: false, code: 'STORAGE_FAILED', error: '사진을 지우는 중에 멈췄어요. 계정은 그대로예요. 잠시 뒤 다시 눌러 주세요.' });
      return send(res, 200, { ok: true, deleted: true });
    }
  }
  const f = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'text/css' }); return fs.createReadStream(f).pipe(res); }
  res.writeHead(200, { 'content-type': 'text/css' }); res.end('');
}).listen(PORT, () => console.log('listening'));
