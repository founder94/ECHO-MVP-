// openai-chat — 2026-10-10 대표 결정 「타로는 잠시 끈다」(PR #141 · #149 같은 파일): 모든 요청 410 · AI 호출 0 · DB 호출 0(가짜 서버·가짜 AI 기준 · 실 AI 0).
// 이 파일은 2026-10-06 사주 「ECHO의 이야기」 서버 검사였다. 서버를 끈 뒤에는 「켜진 채로 새는 길이 없는지」를 같은 가짜 DB·가짜 OpenAI 로 확인한다.
// 사주 이야기 서버 원본·옛 검사는 git 기록(커밋 0ab7f2f · 1a683d2)에 있다 — 로그인 확인판을 만들 때 그 기록에서 다시 시작한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const SERVER = 'supabase/functions/openai-chat/index.ts';
const USER = '10000000-0000-4000-8000-00000000000a';
const S1 = '11111111-1111-4111-8111-111111111111', S2 = '22222222-2222-4222-8222-222222222222';
const FACTS = { dayMaster: '갑목', elements: { 목: 3, 화: 1, 토: 2, 금: 1, 수: 1 } };

function load({ ai, env = {} } = {}) {
  const st = { keys: [], ips: [], prompts: [], counts: new Map() };
  const db = {
    auth: { getUser: async (t) => (t === 'user-token' ? { data: { user: { id: USER } }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
    rpc: async (_fn, args) => { st.keys.push(args.p_session_id); st.ips.push(args.p_ip); const n = (st.counts.get(args.p_session_id) ?? 0) + 1; st.counts.set(args.p_session_id, n); return { data: n <= args.p_daily_limit, error: null }; },
  };
  const fetchFake = async (_url, init) => {
    const body = JSON.parse(init.body); st.prompts.push(body.messages);
    const content = typeof ai === 'function' ? ai(body.messages) : ai ?? JSON.stringify({ summary: '오늘은 천천히 가도 괜찮아요.', tags: ['쉼'], cards: [] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  };
  const code = ts.transpileModule(readFileSync(SERVER, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  vm.runInNewContext(code, {
    exports: {}, console, crypto: globalThis.crypto, TextEncoder, Uint8Array, setTimeout, clearTimeout, AbortController, Request, Response, Headers, URL, JSON, Promise, Map, Set, Array, Object, Number, String, Date, Error, RegExp,
    fetch: fetchFake,
    Deno: { env: { get: (k) => ({ SUPABASE_URL: 'http://db', SUPABASE_SERVICE_ROLE_KEY: 's', OPENAI_API_KEY: 'k', OPENAI_MODEL: 'm', SAJU_STORY_ENABLED: 'true', ...env })[k] }, serve: (h) => { handler = h; } },
    require: (n) => { if (n.startsWith('npm:@supabase/supabase-js')) return { createClient: () => db }; throw new Error(n); },
  }, { filename: 'openai-chat.ts' });
  const call = async (payload, { token, session = S1, ip = '203.0.113.7', origin = 'https://app.do-it.company' } = {}) => {
    const headers = { 'content-type': 'application/json', 'x-anon-session': session };
    if (token) headers.authorization = `Bearer ${token}`;
    if (ip) headers['x-forwarded-for'] = ip;
    if (origin) headers.origin = origin;
    const res = await handler(new Request('http://fn/', { method: 'POST', headers, body: JSON.stringify(payload) }));
    return { status: res.status, body: await res.json() };
  };
  return { st, call };
}
const PAYLOADS = [
  { type: 'saju_reading', facts: FACTS },
  { type: 'tarot_reading', cardName: '별', purpose: '천천히 알아가는 만남' },
  { type: 'conversation', history: [] },
  { type: 'unknown' },
];

test('꺼짐: 사주·타로·대화 어떤 요청이든 410 · AI(OpenAI) 호출 0 · 호출 제한 기록(DB) 0 — 로그인·비로그인·허용/비허용 주소 · 서버 스위치를 켜도', async () => {
  for (const env of [{}, { SAJU_STORY_ENABLED: 'true' }]) {
    const { st, call } = load({ env, ai: () => JSON.stringify({ story: '부르면 안 됨', closing: '부르면 안 됨' }) });
    for (const payload of PAYLOADS) {
      for (const opt of [{ token: 'user-token' }, {}, { origin: 'https://evil.example' }, { origin: null, ip: null }]) {
        const r = await call(payload, opt);
        assert.equal(r.status, 410, `${payload.type} ${JSON.stringify(opt)} ${JSON.stringify(env)}`);
        assert.equal(r.body.code, 'LEGACY_DISABLED');
      }
    }
    assert.equal(st.prompts.length, 0, 'OpenAI 호출 0');
    assert.equal(st.keys.length, 0, '호출 제한 기록 0');
  }
});

test('꺼짐: 서버 파일에 모델 호출·저장 코드가 닿지 않음(fetch 0 · 표 쓰기 0) · PR #149 와 같은 끄기 표시', () => {
  const src = readFileSync(SERVER, 'utf8');
  assert.match(src, /Legacy function is disabled: every non-OPTIONS request returns 410/);
  assert.match(src, /Deno\.serve\(\(req: Request\) => \{[\s\S]*?status: 410/);
  assert.doesNotMatch(src, /fetch\(/, 'OpenAI 호출 코드 0');
  assert.doesNotMatch(src, /\.from\(|\.insert\(|\.upsert\(/, '저장 0');
});

test('화면: 사주 이야기 카드는 기본으로 꺼짐(켜기 스위치만 남김) · 켜면 예전 안내 문구·실패 처리 그대로', () => {
  const ui = readFileSync('src/doit/app/plan-a/screens/SajuResult.tsx', 'utf8');
  assert.match(ui, /const SAJU_STORY_ENABLED = import\.meta\.env\.VITE_SAJU_STORY_ENABLED === "true";/, '기본 꺼짐 · 명시해서 켤 때만');
  assert.doesNotMatch(ui, /VITE_SAJU_STORY_ENABLED !== "false"/, '예전 「기본 켬」 줄 0');
  assert.match(ui, /\{SAJU_STORY_ENABLED && <SajuStoryCard facts=\{sajuStoryFacts\(r\)\} onTalk=\{\(\) => onTalk\(sajuSeedKey\(r\)\)\} \/>\}/);
  assert.match(ui, /지금은 이야기를 만들지 못했어요\. 위 해설은 그대로 볼 수 있어요\./, '켰는데 서버가 꺼져 있어도 해설은 그대로');
  const facts = readFileSync('src/doit/lib/saju/storyFacts.ts', 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(facts, /input\.|date|gender|time|annual|cycle|currentFlow/, '보내는 값에 생년월일·시간·성별·시기 0');
});

test('AI 사용 기록 30일 뒤 삭제(대표 승인 2026-10-06): 실행 전 초안 · 같은 함수 이름·인자·권한 · 표 구조 변경 0', () => {
  const sql = readFileSync('supabase/drafts/PENDING_20261006_openai_rate_limits_30d.sql', 'utf8');
  assert.match(sql, /사용기록 저장 승인 30일뒤 삭제/);
  assert.match(sql, /create or replace function public\.openai_rate_limit_allow\(\s*p_session_id text,\s*p_ip text,\s*p_day text,\s*p_daily_limit integer,\s*p_cooldown_ms integer\s*\) returns boolean/);
  assert.match(sql, /delete from public\.openai_rate_limits\s+where day < to_char\(\(v_now at time zone 'utc'\)::date - 30, 'YYYY-MM-DD'\);/);
  assert.match(sql, /revoke all on function public\.openai_rate_limit_allow\(text, text, text, integer, integer\) from public, anon, authenticated;/);
  assert.doesNotMatch(sql, /alter table|drop table|create table|create extension|grant /i);
});
