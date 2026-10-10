import { test as base, expect, type Route } from '@playwright/test';
import { createHash } from 'node:crypto';

export const SID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
export const MID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
export const PURPOSE = '깊은 대화부터 시작하고 싶어요';
const now = () => new Date().toISOString();
const copy = <T>(v: T): T => structuredClone(v);
export const slots = ['relationship_intent', 'attraction_comfort', 'values_character', 'relationship_style', 'boundaries'];
export function conversation(done = false): any {
  return { id: SID, tone: 'polite', mode: 'TEXT', phase: done ? 'done' : 'talk', progress: { asked: done ? 5 : 2, of: 5 },
    current_question: done ? null : '일주일에 몇 번쯤 보면 편해요?', current_hint: null, current_choices: null,
    current_rescue: { options: ['조용하고 편하게', '밝고 가볍게', '밥 먹으면서'], symbols: ['🫧', '☀️', '🍽️'], show: false, fallback: false },
    messages: [{ role: 'ai', text: '어떤 친구를 만나고 싶어요?' }, { role: 'user', text: '일주일에 세 번 만나는 친구요' }, { role: 'ai', text: '일주일에 몇 번쯤 보면 편해요?' }],
    summary: [], closing: done ? '이야기를 들었어요.' : null, handoff: null, goal: 'conversation', goal_label: PURPOSE,
    profile: done ? { ...Object.fromEntries(slots.map((s, i) => [s, { status: 'CONFIRMED', items: [{ note: `확인할 이야기 ${i + 1}`, quote: `내가 직접 한 말 ${i + 1}` }] }])), mbti: { status: 'UNKNOWN', items: [] }, blood_type: { status: 'UNKNOWN', items: [] }, core_questions: 5, user_corrections: [] } : null };
}
export const candidate = () => ({ id: 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee', created_at: now(), purpose: PURPOSE, reasons: ['천천히 이야기 나누고 싶다고 직접 말했어요.'], my_choice: null, waiting: false });
export const match = (extra = {}) => ({ id: MID, status: 'open', created_at: now(), first_question: '요즘 가장 편하게 쉬는 시간은 언제예요?', my_answer: null, partner_answered: false, revealed: false, outcome: null, ...extra });
export const partner = { nickname: '합성 시험 상대', bio: '가상 검사 자료', purpose: PURPOSE, answer: '저녁에 산책할 때요.', photo_url: null };
export const readiness = { conversation: { ready: true, source: 'agent', finished: true, have: 3, need: 3 }, purpose: true, intro: true, photos: 3, photos_needed: 3, phone_verified: false };

type Failure = { remaining: number; status: number; code: string; network?: boolean; when?: (body: any) => boolean };
export class FakeBackend {
  calls: any[] = [];
  unhandled: string[] = [];
  failures = new Map<string, Failure>();
  waits = new Map<string, { promise: Promise<void>; release: () => void }>();
  session: any = conversation();
  known: any = { confirmed: [], guesses: [], corrected: [], rejected: [], confirmed_at: null, forgotten: 0 };
  candidates: any[] = [candidate()];
  matches: any[] = [];
  free = { enabled: false, entitled: false, trial_left: 3, daily_left: 20 };
  eligible = true;
  mutual = false;
  partnerAnswered = false;
  purposes: any[] = [{ id: 'conversation', label: PURPOSE, description: '합성 시험 목적', sort_order: 1 }, { id: 'hobby', label: '함께 취미를 즐기고 싶어요', description: '시험 목적', sort_order: 2 }];
  profile: any;
  user: any;
  auth: any;
  photos: any[] = [];
  photoObjects = new Set<string>();
  memory: any = { intent: 'history', status: 'NOT_FOUND', complete: true, notice: null, next: null, evidence: [] };
  refCorrection: string | null = null;
  constructor(public uid: string) {
    this.profile = { id: uid, role: 'user', consent_version: 'v1.0', purpose_id: 'conversation', purpose_label: PURPOSE, nickname: '합성 시험 사용자', bio: '직접 작성한 소개', region: '시험 생활권', life_rhythm: 'regular' };
    this.user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: now() };
    const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const expires = Math.floor(Date.now() / 1000) + 7200;
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: expires })}.synthetic-invalid-signature`;
    this.auth = { access_token: token, token_type: 'bearer', refresh_token: 'synthetic-refresh-not-a-credential', expires_in: 7200, expires_at: expires, user: this.user };
  }
  fail(key: string, code = 'ERROR', status = 500, remaining = 1, when?: (body: any) => boolean) { this.failures.set(key, { remaining, status, code, when }); }
  disconnect(key: string) { this.failures.set(key, { remaining: 1, status: 0, code: 'NETWORK', network: true }); }
  hold(key: string) { let release!: () => void; const promise = new Promise<void>(r => { release = r; }); this.waits.set(key, { promise, release }); return release; }
  requests(action: string) { return this.calls.filter(c => c.action === action); }
  async route(route: Route) {
    const req = route.request(), u = new URL(req.url()), method = req.method();
    if (u.hostname === '127.0.0.1' && [4173, 4174, 4175].includes(Number(u.port))) return route.continue();
    if (u.hostname !== 'echo-e2e.supabase.co') {
      // Cosmetic resources only; no provider/API traffic is allowed.
      if (['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'].includes(u.hostname)) return route.abort();
      this.unhandled.push(`${method} ${u.origin}${u.pathname}`);
      return route.abort();
    }
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    // Binary photo bodies must not be parsed as JSON or included in reports.
    const body = (req.headers()['content-type'] ?? '').includes('json') ? (req.postDataJSON() ?? {}) : {};
    const isPhotoUpload = method === 'POST' && u.pathname.startsWith('/storage/v1/object/profile-photos/');
    const key = isPhotoUpload ? 'photo_upload' : u.pathname.startsWith('/functions/v1/') ? body.action : `${method} ${u.pathname}`;
    this.calls.push({ ...body, action: key, path: u.pathname, method, urlQuery: u.search, uid: this.uid });
    if (this.waits.has(key)) await this.waits.get(key)!.promise;
    const f = this.failures.get(key);
    if (f && (!f.when || f.when(body)) && f.remaining-- > 0) return f.network ? route.abort('failed') : route.fulfill({ status: f.status, json: { ok: false, code: f.code, message: '합성 시험 실패', error: f.code, error_description: '합성 시험 실패' } });
    const json = (data: any, status = 200) => route.fulfill({ status, json: copy(data) });
    if (u.pathname === '/auth/v1/user') {
      if (method === 'PUT') Object.assign(this.user.user_metadata, body.data);
      if (['GET', 'PUT'].includes(method)) return json(this.user);
    }
    if (u.pathname === '/auth/v1/token' && method === 'POST') return json(this.auth);
    if (u.pathname === '/auth/v1/logout' && method === 'POST') return route.fulfill({ status: 204 });
    if (u.pathname === '/auth/v1/signup' && method === 'POST') return json({ ...this.auth, user: { ...this.user, user_metadata: body.data } });
    if (u.pathname === '/rest/v1/purposes' && method === 'GET') return json(this.purposes);
    if (u.pathname === '/rest/v1/profiles') {
      if (u.searchParams.get('id') && u.searchParams.get('id') !== `eq.${this.uid}`) { this.unhandled.push('cross-user profile request'); return json({ code: 'FORBIDDEN' }, 403); }
      if (method === 'PATCH') Object.assign(this.profile, body);
      if (method === 'POST') Object.assign(this.profile, Array.isArray(body) ? body[0] : body);
      if (['GET', 'POST', 'PATCH'].includes(method)) return json((req.headers().accept ?? '').includes('vnd.pgrst.object') ? this.profile : [this.profile]);
    }
    if (u.pathname === '/rest/v1/profile_photos') {
      if (u.searchParams.get('user_id') && u.searchParams.get('user_id') !== `eq.${this.uid}`) {
        this.unhandled.push('cross-user photo request'); return json({ code: 'FORBIDDEN' }, 403);
      }
      if (method === 'GET') return json(this.photos);
      if (method === 'POST' && body.user_id === this.uid && body.storage_path?.startsWith(`${this.uid}/`)) {
        const photo = { ...body, id: 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee' };
        this.photos = this.photos.filter(p => p.slot !== photo.slot); this.photos.push(photo);
        return json({ id: photo.id });
      }
      if (method === 'PATCH') {
        const selected = this.photos.filter(p => (!u.searchParams.get('slot') || `eq.${p.slot}` === u.searchParams.get('slot')) && (!u.searchParams.get('is_primary') || `eq.${p.is_primary}` === u.searchParams.get('is_primary')));
        selected.forEach(p => Object.assign(p, body));
        return json((req.headers().accept ?? '').includes('vnd.pgrst.object') ? selected[0] : selected);
      }
    }
    if (isPhotoUpload) {
      const path = u.pathname.slice('/storage/v1/object/profile-photos/'.length);
      if (path.startsWith(`${this.uid}/`) && /^\d\/[a-f0-9-]+\.jpg$/i.test(path.slice(this.uid.length + 1))) {
        this.photoObjects.add(path); return json({ Id: 'synthetic-object', Key: `profile-photos/${path}` });
      }
    }
    if (u.pathname.startsWith('/storage/v1/object/sign/profile-photos/')) {
      const path = u.pathname.slice('/storage/v1/object/sign/profile-photos/'.length);
      if (this.photoObjects.has(path)) {
        if (method === 'POST') return json({ signedURL: `/object/sign/profile-photos/${path}?token=synthetic` });
        if (method === 'GET') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nGQAAAAASUVORK5CYII=', 'base64') });
      }
    }
    if (u.pathname.startsWith('/functions/v1/')) {
      const fn = u.pathname.split('/').pop();
      if (fn === 'doit-understanding') {
        if (body.action === 'record_list') return json({ ok: true, records: [] });
        if (body.action === 'insight_list') return json({ ok: true, insights: [] });
        if (body.action === 'connection_preview') return json({ ok: true, purpose: PURPOSE, eligible: true, readiness: { answers: 5, answers_needed: 5, confirmed: 5, photos: 3, photos_needed: 3, intro: true, phone_verified: false }, candidates: this.candidates.length, waiting: 0, common: [] });
      }
      if (fn === 'doit-agent') {
        if (body.action === 'agent_get') return json({ ok: true, session: this.session, known: this.known, free_talk: this.free });
        if (body.action === 'agent_start') { this.session = conversation(); return json({ ok: true, session: this.session }); }
        if (body.action === 'agent_confirm') return json({ ok: true, session: this.session });
        if (body.action === 'agent_rescue') { this.session.current_rescue.show = true; return json({ ok: true, session: this.session }); }
        if (body.action === 'agent_turn') {
          const corrected = !!body.correction;
          if (corrected && this.session.profile) {
            const field = body.correction.purpose ?? slots[0];
            this.session.profile[field] = { status: 'CONFIRMED', items: [{ note: body.text, quote: body.text }] };
          } else this.session.messages.push({ role: 'user', text: body.text });
          return json({ ok: true, session: this.session, turn: { kind: corrected ? 'correction' : 'answer', reply: '', question: this.session.current_question, saved: !/모르겠|질문이 너무|넘어가/.test(body.text), finish: false, after: false, ...(corrected ? { receipt: { line: '고친 내용으로 기억할게요.', kind: 'corrected' } } : {}) } });
        }
        if (body.action === 'agent_recall') return json({ ok: true, memory: this.memory, reply: this.memory.evidence.length ? '가상 저장 기록을 찾았어요.' : '확인할 기록이 없어요.' });
        if (body.action === 'agent_ref') return json({ ok: true, reply: body.text ? '합성 응답: 지금 느낀 말을 들었어요.' : `「${body.ref.label ?? '사주'}」 참고 이야기예요. 읽기만 해도 괜찮아요.`, question: body.text === '질문 하나 해줘' ? '지금 가장 떠오르는 생각은 무엇인가요?' : null, ...(body.text && this.refCorrection ? { correction: { text: this.refCorrection } } : {}) });
        if (body.action === 'agent_self_note') return json({ ok: true, session: this.session });
        if (body.action === 'agent_card') return json({ ok: true, reading: { summary: '가상 카드 해석: 잠시 쉬어 가도 괜찮아요.', tags: ['합성 자료'], cards: [{ label: '참고', value: '미래를 확정하지 않아요.' }] } });
        if (body.action === 'agent_free_talk') { this.free.trial_left--; return json({ ok: true, reply: '합성 자유 대화 응답', ai: true, entitled: this.free.entitled, trial_left: this.free.trial_left }); }
        if (body.action === 'agent_run') { const run = { version: 1, goal: 'conversation', plan_rev: 1, outcome: 'done', waiting: null, next: 'open_candidates', missing: [], steps: [{ id: 'find_candidates', status: 'done', why: null }], candidates: { outcome: 'found', count: this.candidates.length, at: now(), fresh: true } }; this.session.run = run; return json({ ok: true, session: this.session, run }); }
      }
      if (fn === 'doit-connect') {
        if (body.action === 'my_candidates') return json({ ok: true, eligible: this.eligible, missing: this.eligible ? [] : ['대화'], readiness, prepared: 0, candidates: this.candidates });
        if (body.action === 'my_matches') return json({ ok: true, matches: this.matches, consented: true });
        if (body.action === 'my_turns') return json({ ok: true, open: this.matches.length, turns: { answer: 0, reply: 0, opened: 0, choose: this.candidates.length } });
        if (body.action === 'choose') {
          const c = this.candidates.find(c => c.id === body.candidateId);
          if (!c) return json({ ok: false, code: 'NOT_FOUND' }, 404);
          if (body.choice === 'yes') {
            if (this.mutual) { this.candidates = []; this.matches = [match({ via_mutual: true })]; return json({ ok: true, status: 'mutual', match_id: MID, first_question: this.matches[0].first_question, question_source: 'fixed' }); }
            Object.assign(c, { waiting: true, my_choice: 'yes' }); return json({ ok: true, status: 'waiting' });
          }
          this.candidates = this.candidates.filter(x => x.id !== c.id);
          return json({ ok: true, status: 'declined', blocked: body.block === true, reported: !!body.reason });
        }
        if (['answer', 'message', 'leave', 'outcome'].includes(body.action)) {
          const m = this.matches.find(m => m.id === body.matchId);
          if (!m) return json({ ok: false, code: 'NOT_FOUND' }, 404);
          if (body.action === 'answer') { m.my_answer = body.text; if (this.partnerAnswered) Object.assign(m, { revealed: true, partner_answered: true, partner, messages: [] }); }
          if (body.action === 'message') { if (!m.revealed) return json({ ok: false, code: 'NOT_ALLOWED' }, 403); (m.messages ??= []).push({ id: String(m.messages.length), mine: true, body: body.text, created_at: now() }); }
          if (body.action === 'leave') m.status = 'closed';
          return json({ ok: true, blocked: body.block === true, reported: !!body.reason });
        }
        if (body.action === 'meet_status') return json({ ok: false, code: 'MEET_NOT_CONFIGURED' }, 503);
        if (body.action === 'admin_candidates') return json({ ok: true, pool: 0, eligible: 0, missing: { purpose: 0, answers: 0, photos: 0, intro: 0 }, candidates: [] });
        if (body.action === 'admin_matches') return json({ ok: true, matches: [], proposals: [] });
        if (body.action === 'admin_members') return json({ ok: true, members: [] });
      }
      if (fn === 'admin-web') {
        if (this.profile.role !== 'admin') return json({ ok: false, code: 'FORBIDDEN', message: '관리자만 볼 수 있어요.' }, 403);
        if (body.action === 'overview') return json({ ok: true, asOf: now(), period: body.period, since: now(), server: 'synthetic', truncated: false, quality_sample: null, errors: [], health: { level: '정상', reasons: [] }, users: { total: 0, signups: 0, active: 0, conversations_started: 0, conversations_done: 0, intro_saved: 0 }, ai: { turns: 0, failed: 0, ok_sessions: 0, corrections: 0, correction_not_saved: 0, profile_save_failed: 0, quality: Object.fromEntries(['repeat', 'goal_mismatch', 'counsel', 'correction_ignored', 'unsure_repeat', 'summary_mismatch'].map(k => [k, 0])), quality_label: { repeat: '반복', goal_mismatch: '목적 불일치', counsel: '상담', correction_ignored: '정정 무시', unsure_repeat: '모호한 반복', summary_mismatch: '요약 불일치' }, label_only: 0, label_only_samples: [], last_ok_at: null, agent_seen: [], agent_server: 'synthetic' }, matching: { total: 0, by_status: {} }, safety: { reports: 0, open: 0, severe: 0, blocks: 0 }, auth: { google: false }, decisions: [] });
        if (body.action === 'safety') return json({ ok: true, reports_error: null, blocks_error: null, handler_columns: true, reports: [], blocks: [] });
        if (body.action === 'users') return json({ ok: true, total: 0, truncated: false, activity_window_days: 7, photos_error: null, activity_error: null, users: [] });
      }
    }
    this.unhandled.push(`${method} ${u.pathname} ${key}`);
    return json({ ok: false, code: 'UNHANDLED_E2E_REQUEST' }, 501);
  }
  dispose() { for (const wait of this.waits.values()) wait.release(); this.waits.clear(); this.failures.clear(); this.photoObjects.clear(); }
}

export const test = base.extend<{ seed: FakeBackend; authMode: 'user' | 'anonymous' | 'expired' | 'admin'; networkGuard: void }>({
  authMode: ['user', { option: true }],
  seed: async ({}, use, info) => {
    const h = createHash('sha256').update(`${info.testId}:${info.workerIndex}:${info.retry}`).digest('hex');
    const seed = new FakeBackend(`${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`);
    try { await use(seed); } finally { seed.dispose(); }
  },
  storageState: async ({ seed, authMode, baseURL }, use) => {
    if (authMode === 'admin') seed.profile.role = 'admin';
    if (authMode === 'expired') { seed.auth.expires_at = 1; seed.fail('POST /auth/v1/token', 'refresh_token_not_found', 400, 10); }
    const localStorage = authMode === 'anonymous' ? [] : [{ name: 'sb-echo-e2e-auth-token', value: JSON.stringify(seed.auth) }];
    await use({ cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage }] });
  },
  networkGuard: [async ({ context, seed }, use, info) => {
    const errors: string[] = [];
    context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    await context.route('**/*', r => seed.route(r));
    await context.addInitScript(() => { if (location.hostname === '127.0.0.1') sessionStorage.setItem('doit:intro-seen', '1'); });
    try { await use(); } finally {
      seed.dispose();
      await info.attach('synthetic-api-requests', { body: JSON.stringify(seed.calls, null, 2), contentType: 'application/json' });
      expect(seed.unhandled, 'Unexpected network/API requests must never silently succeed').toEqual([]);
      expect(errors, 'Uncaught browser errors').toEqual([]);
    }
  }, { auto: true }],
});
export { expect };
