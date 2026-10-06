// 가짜 Supabase 로그인 서버(얼굴 로그인 부분만) + 화면 파일. 서명 검증은 진짜 서버 몫이라 여기선 "브라우저가 맞는 챌린지·주소로 서명을 만들어 보냈는지"만 본다.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const PORT = 4640, ROOT = path.resolve('out');
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const state = { mode: process.env.MODE || 'on', calls: [], registered: null, challenges: {}, checks: [] };
const USER = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'qa@example.com', email_confirmed_at: '2026-09-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-09-01T00:00:00Z' };
const session = () => ({ access_token: 'at-' + crypto.randomUUID(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'rt-' + crypto.randomUUID(), user: USER });
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const clientData = (cred) => JSON.parse(Buffer.from(cred.response.clientDataJSON, 'base64url').toString());
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }); return res.end(); }
  if (url.pathname === '/__state') return send(res, 200, state);
  if (url.pathname === '/__mode') { state.mode = url.searchParams.get('m'); return send(res, 200, { ok: true }); }
  if (url.pathname.startsWith('/auth/v1/')) {
    let body = ''; for await (const c of req) body += c; const json = body ? JSON.parse(body) : {};
    const p = url.pathname.slice('/auth/v1'.length);
    state.calls.push(`${req.method} ${p}`);
    if (state.mode === 'off' && p.startsWith('/passkeys')) return send(res, 422, { code: 422, error_code: 'passkey_disabled', msg: 'Passkey sign-in is not enabled' });
    if (p === '/token' && url.searchParams.get('grant_type') === 'password') return send(res, 200, session());
    if (p === '/user') return send(res, 200, USER);
    if (p === '/logout') return send(res, 204);
    if (p === '/passkeys/registration/options') {
      const challenge = b64u(crypto.randomBytes(32)); state.challenges.reg = challenge;
      return send(res, 200, { challenge_id: 'c-reg', options: { rp: { id: 'localhost', name: 'DO IT' }, user: { id: b64u(Buffer.from(USER.id)), name: USER.email, displayName: 'QA' }, challenge, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], timeout: 60000, authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' }, attestation: 'none' } });
    }
    if (p === '/passkeys/registration/verify') {
      const cd = clientData(json.credential);
      state.checks.push({ step: 'reg', type: cd.type, challengeOk: cd.challenge === state.challenges.reg, origin: cd.origin, hasAttestation: !!json.credential.response.attestationObject, challengeId: json.challenge_id });
      state.registered = { id: json.credential.id, created_at: new Date().toISOString() };
      return send(res, 200, { id: 'pk-1', friendly_name: 'Chrome 가상 장치', created_at: state.registered.created_at });
    }
    if (p === '/passkeys' && req.method === 'GET') return send(res, 200, state.registered ? [{ id: 'pk-1', friendly_name: 'Chrome 가상 장치', created_at: state.registered.created_at }] : []);
    if (p === '/passkeys/pk-1' && req.method === 'DELETE') { state.registered = null; return send(res, 204); }
    if (p === '/passkeys/authentication/options') {
      const challenge = b64u(crypto.randomBytes(32)); state.challenges.auth = challenge;
      return send(res, 200, { challenge_id: 'c-auth', options: { challenge, rpId: 'localhost', userVerification: 'required', timeout: state.mode === 'short' ? 2500 : 60000 } });
    }
    if (p === '/passkeys/authentication/verify') {
      const cd = clientData(json.credential);
      const known = state.registered && json.credential.id === state.registered.id;
      state.checks.push({ step: 'auth', type: cd.type, challengeOk: cd.challenge === state.challenges.auth, origin: cd.origin, hasSignature: !!json.credential.response.signature, knownCredential: !!known, challengeId: json.challenge_id });
      if (!known) return send(res, 404, { code: 404, error_code: 'webauthn_credential_not_found', msg: 'not found' });
      return send(res, 200, session());
    }
    return send(res, 404, { msg: 'no stub ' + p });
  }
  const f = path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'text/css' }); return fs.createReadStream(f).pipe(res); }
  res.writeHead(200, { 'content-type': 'text/css' }); res.end('');
}).listen(PORT, () => console.log('listening'));
