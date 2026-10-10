// 2026-10-10 Codex MEM-F02 · 대표 승인(같은 목적 안에서만): 「지금」 기억 찾기가 같은 목적의 다른 대화에서 확정한 말도 찾는다.
// 순수 함수·가짜 DB 검사(실제 DB·모델·실기기 아님). 기준: A확정→B조회 · B정정→C최신값 · 거절·삭제 재등장 0 · 다른 목적 0 · 미확정 0.
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import ts from 'typescript'; import vm from 'node:vm';
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../supabase/functions/doit-agent/history-retrieval.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: mod, exports: mod.exports, Date, JSON, String, Number, Object, Array, Set, Map, Error });
const H = mod.exports;
const U = 'user-1';
const row = (id, at, goal, turns, slots, extra = {}) => ({ user_id: U, request_id: id, action: 'agent_session', status: 'applied', created_at: at, applied_revision: 1, response_payload: { state: { goal, turns, slots, ...extra } } });
const said = (n, user) => ({ n, user, kind: 'answer' });
const item = (turn, quote, status = 'CONFIRMED', source_type = 'USER_DIRECT', note = quote) => ({ turn, quote, note, status, source_type });
const quotes = (r) => r.evidence.map((e) => e.quote);

const A = row('sess-a', '2026-09-01T00:00:00Z', 'friend', [said(1, '주말 아침에 등산하는 걸 좋아해요')], { lifestyle: { items: [item(1, '주말 아침에 등산하는 걸 좋아해요')] } });
const B = row('sess-b', '2026-09-20T00:00:00Z', 'friend', [said(1, '요즘 친구랑 보드게임 하는 게 좋아요')], { hobby: { items: [item(1, '요즘 친구랑 보드게임 하는 게 좋아요')] } });

test('A 대화에서 확정한 말을 같은 목적의 B 대화에서 「지금」 기억으로 찾는다(출처는 A)', () => {
  const r = H.recallRows([A, B], U, '등산 좋아', 'current', 'sess-b');
  const e = r.evidence.find((x) => x.quote === '주말 아침에 등산하는 걸 좋아해요');
  assert.ok(e, JSON.stringify(r));
  assert.equal(e.session_id, 'sess-a'); assert.equal(e.validity, 'CURRENT_CONFIRMED'); assert.equal(e.matching_promotion, false);
  assert.equal(H.verifyCitation(r, e.source_id, e.quote, true), true);
});

test('다른 목적(goal) 대화의 말은 「지금」 기억에 섞지 않는다(세션 격리 2026-09-28)', () => {
  const other = row('sess-x', '2026-09-25T00:00:00Z', 'romance', [said(1, '등산 같이 다닐 사람을 찾아요')], { want: { items: [item(1, '등산 같이 다닐 사람을 찾아요')] } });
  const r = H.recallRows([A, other, B], U, '등산', 'current', 'sess-b');
  assert.ok(!quotes(r).includes('등산 같이 다닐 사람을 찾아요'));
  assert.ok(quotes(r).includes('주말 아침에 등산하는 걸 좋아해요'));
  // 지난 기록(history)은 원래대로 목적과 상관없이 읽기만 한다
  assert.ok(quotes(H.recallRows([A, other, B], U, '등산', 'history', 'sess-b')).includes('등산 같이 다닐 사람을 찾아요'));
});

test('B 에서 같은 칸을 다시 확정(정정)하면 C 에서 지금 값은 B 의 것 · A 의 옛 값은 지금 값으로 안 나옴', () => {
  const B2 = row('sess-b2', '2026-09-20T00:00:00Z', 'friend', [said(1, '이제 주말엔 집에서 쉬는 게 좋아요')], { lifestyle: { items: [item(1, '이제 주말엔 집에서 쉬는 게 좋아요', 'CONFIRMED', 'USER_CORRECTED')] } });
  const C = row('sess-c', '2026-10-05T00:00:00Z', 'friend', [said(1, '반가워요')], {});
  const r = H.recallRows([A, B2, C], U, '주말 좋아', 'current', 'sess-c');
  assert.ok(quotes(r).includes('이제 주말엔 집에서 쉬는 게 좋아요'), JSON.stringify(r));
  assert.ok(!quotes(r).includes('주말 아침에 등산하는 걸 좋아해요'));
  assert.ok(quotes(H.recallRows([A, B2, C], U, '주말 등산', 'history', 'sess-c')).includes('주말 아침에 등산하는 걸 좋아해요'), '옛 값은 지난 기록으로만');
});

test('뒤 대화에서 지운 말·아니라고 한 해석은 앞 대화에서 다시 나오지 않는다', () => {
  const del = row('sess-d', '2026-09-30T00:00:00Z', 'friend', [said(1, '주말 아침에 등산하는 걸 좋아해요')], { lifestyle: { items: [item(1, '주말 아침에 등산하는 걸 좋아해요', 'FORGOTTEN')] } }, { forgotten: ['주말 아침에 등산'] });
  assert.ok(!quotes(H.recallRows([A, del], U, '등산', 'current', 'sess-d')).includes('주말 아침에 등산하는 걸 좋아해요'), '지운 말 0');
  const A3 = row('sess-a3', '2026-09-01T00:00:00Z', 'friend', [said(1, '매일 연락하는 사람이 좋아요')], { contact: { items: [item(1, '매일 연락하는 사람이 좋아요')] } });
  const dis = row('sess-e', '2026-09-30T00:00:00Z', 'friend', [said(1, '그건 아니에요')], {}, { disputed: ['매일 연락하는 사람'] });
  assert.ok(!quotes(H.recallRows([A3, dis], U, '매일 연락', 'current', 'sess-e')).includes('매일 연락하는 사람이 좋아요'), '아니라고 한 뜻 0');
});

test('앞에서 지웠어도 뒤 대화에서 다시 직접 확정하면 뒤의 말이 지금 값(최신 우선)', () => {
  const del = row('sess-d1', '2026-09-10T00:00:00Z', 'friend', [said(1, '보드게임은 별로예요')], {}, { forgotten: ['보드게임'] });
  const r = H.recallRows([del, B], U, '보드게임', 'current', 'sess-b');
  assert.ok(quotes(r).includes('요즘 친구랑 보드게임 하는 게 좋아요'), JSON.stringify(r));
});

test('다른 대화의 미확정·AI 짐작·원문 통째는 「지금」 기억으로 쓰지 않는다', () => {
  const guess = row('sess-g', '2026-09-05T00:00:00Z', 'friend', [said(1, '바다 보러 가는 거 좋아해요'), said(2, '캠핑도 가끔 해요')], { trip: { items: [item(1, '바다 보러 가는 거 좋아해요', 'UNCONFIRMED'), item(1, '바다 보러 가는 거 좋아해요', 'CONFIRMED', 'AI_EXTRACTED')] } });
  const r = H.recallRows([guess, B], U, '바다 캠핑', 'current', 'sess-b');
  assert.equal(r.evidence.length, 0, JSON.stringify(r));
});

test('readRecall(지금): 최근 대화 50개를 읽고, 지금 대화가 그 밖이면 따로 읽는다 · 읽기 실패는 READ_FAILED', async () => {
  const cur = row('sess-now', '2026-08-01T00:00:00Z', 'friend', [said(1, '안녕하세요')], {});
  const many = Array.from({ length: 50 }, (_, k) => row(`sess-${k}`, `2026-09-${String(10 + (k % 18)).padStart(2, '0')}T00:00:${String(k).padStart(2, '0')}Z`, 'friend', [said(1, '조용한 카페에서 책 읽는 걸 좋아해요')], { calm: { items: [item(1, '조용한 카페에서 책 읽는 걸 좋아해요')] } }));
  const db = (rows, fail = false) => ({ from: () => { const f = []; let asc = true; let rg = null; const c = { select: () => c, eq: (k, v) => { f.push((r) => r[k] === v); return c; }, order: (_k, o) => { asc = o?.ascending !== false; return c; }, range: (a, b) => { rg = [a, b]; return c; },
    then: (res) => { let d = rows.filter((r) => f.every((x) => x(r))).sort((a, b) => (a.created_at < b.created_at ? -1 : 1) * (asc ? 1 : -1)); if (rg) d = d.slice(rg[0], rg[1] + 1); return Promise.resolve(fail ? { data: null, error: { message: 'x' } } : { data: d, error: null }).then(res); } }; return c; } });
  const r = await H.readRecall(db([cur, ...many]), U, '카페 책', 'current', 'sess-now');
  assert.equal(r.status === 'FOUND' || r.status === 'PARTIAL', true, JSON.stringify(r));
  assert.ok(quotes(r).includes('조용한 카페에서 책 읽는 걸 좋아해요'));
  assert.equal((await H.readRecall(db([cur], true), U, '카페', 'current', 'sess-now')).status, 'READ_FAILED');
  assert.equal((await H.readRecall(db([cur]), U, '카페', 'current', null)).status, 'NOT_FOUND');
});

test('Codex P1(4237121057): 뒤 대화에서 같은 칸의 해석을 바꿔 말한 글로 물려도(글자 안 겹침) 앞 대화 값은 지금 값이 아님', () => {
  const A3 = row('sess-p1a', '2026-09-01T00:00:00Z', 'friend', [said(1, '매일 연락하는 게 좋아요')], { contact: { items: [item(1, '매일 연락하는 게 좋아요')] } });
  const later = row('sess-p1b', '2026-09-30T00:00:00Z', 'friend', [said(1, '그건 좀 달라요')], { contact: { items: [item(1, '그건 좀 달라요', 'DISPUTED', 'AI_EXTRACTED', '매일 연락을 자주 주고받는 관계가 편하다')] } });
  const r = H.recallRows([A3, later], U, '매일 연락', 'current', 'sess-p1b');
  assert.ok(!quotes(r).includes('매일 연락하는 게 좋아요'), JSON.stringify(r));
  assert.ok(quotes(H.recallRows([A3, later], U, '매일 연락', 'history', 'sess-p1b')).includes('매일 연락하는 게 좋아요'), '지난 기록으로는 남음');
  // 다른 칸은 그대로 찾는다(칸 계보만)
  const other = row('sess-p1c', '2026-09-02T00:00:00Z', 'friend', [said(1, '매일 산책을 해요')], { routine: { items: [item(1, '매일 산책을 해요')] } });
  assert.ok(quotes(H.recallRows([A3, other, later], U, '매일 산책', 'current', 'sess-p1b')).includes('매일 산책을 해요'));
});
