// 2026-10-02 — 영상 → 각자 모습 확인 → 각자 만남 의사 → 약속 허용 판정(순수 규칙 · 격리 검사). 연결된 기록 표·공급자는 아직 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const src = readFileSync(new URL('../supabase/functions/doit-connect/meetGate.ts', import.meta.url), 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'gate-')); const out = path.join(dir, 'g.mjs');
writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { meetGate, meetStatusForMe, jointSession } = await import(pathToFileURL(out).href);

const A = 'a', B = 'b';
const session = (o = {}) => ({ id: 's1', matchId: 'm1', endedAt: '2026-10-02T10:30:00Z', signatureVerified: true, participants: [{ userId: A, joinedAt: '2026-10-02T10:00:00Z', leftAt: '2026-10-02T10:30:00Z', cameraOnSeconds: 600 }, { userId: B, joinedAt: '2026-10-02T10:01:00Z', leftAt: '2026-10-02T10:30:00Z', cameraOnSeconds: 500 }], ...o });
const base = (o = {}) => ({
  now: '2026-10-02T11:00:00Z', me: A, match: { id: 'm1', userA: A, userB: B, status: 'approved', createdAt: '2026-10-01T00:00:00Z' },
  blocked: false, safetyHold: false, consent: { required: 'connect-v2', a: 'connect-v2', b: 'connect-v2' }, lastStepOpen: true,
  sessions: [session()], checks: [{ userId: A, sessionId: 's1', checkedAt: '2026-10-02T10:31:00Z' }, { userId: B, sessionId: 's1', checkedAt: '2026-10-02T10:32:00Z' }],
  intents: [{ userId: A, intent: 'yes', at: '2026-10-02T10:33:00Z', sessionId: 's1' }, { userId: B, intent: 'yes', at: '2026-10-02T10:34:00Z', sessionId: 's1' }], ...o,
});

test('모두 갖추면 허용 · 통화 참여·모습 확인·만남 의사는 서로 다른 기록', () => {
  assert.deepEqual(meetGate(base()), { allowed: true, missing: [], sessionId: 's1' });
  assert.equal(meetGate(base({ checks: [] })).allowed, false, '통화만으로는 모습 확인이 아님');
  assert.equal(meetGate(base({ intents: [] })).allowed, false, '모습 확인만으로는 만남 의사가 아님');
});

test('우회 0: 카메라 OFF · 다른 연결 세션 · 위조 콜백 · 끝나지 않은 통화 · 다른 세션에 묶인 확인', () => {
  const off = session({ participants: [session().participants[0], { ...session().participants[1], cameraOnSeconds: 0 }] });
  assert.ok(meetGate(base({ sessions: [off] })).missing.includes('no_joint_video'));
  assert.ok(meetGate(base({ sessions: [session({ matchId: 'other' })] })).missing.includes('no_joint_video'));
  assert.ok(meetGate(base({ sessions: [session({ signatureVerified: false })] })).missing.includes('no_joint_video'));
  assert.ok(meetGate(base({ sessions: [session({ endedAt: null })] })).missing.includes('no_joint_video'));
  const r = meetGate(base({ checks: [{ userId: A, sessionId: 'old', checkedAt: '' }, { userId: B, sessionId: 's1', checkedAt: '' }] }));
  assert.ok(r.missing.includes('my_check'), '다른 세션의 모습 확인은 무효');
});

test('차단·종료·안전 제한·오래된 동의·마지막 구간 아님 = 불가 · 비참가자 = 불가', () => {
  for (const [o, k] of [[{ blocked: true }, 'blocked'], [{ safetyHold: true }, 'safety_hold'], [{ match: { ...base().match, status: 'closed' } }, 'connection_closed'], [{ consent: { required: 'connect-v2', a: 'connect-v1', b: 'connect-v2' } }, 'consent_outdated'], [{ lastStepOpen: false }, 'last_step_closed']]) {
    const r = meetGate(base(o)); assert.equal(r.allowed, false); assert.ok(r.missing.includes(k), k); assert.equal(meetStatusForMe(r), 'unavailable');
  }
  assert.deepEqual(meetGate(base({ me: 'c' })).missing, ['not_participant']);
});

test('철회: 가장 최근 의사만 유효 · 상대의 「아니요」와 「아직」은 본인에게 구분해 드러내지 않음', () => {
  const withdrawn = base({ intents: [...base().intents, { userId: B, intent: 'no', at: '2026-10-02T10:40:00Z', sessionId: 's1' }] });
  assert.equal(meetGate(withdrawn).allowed, false);
  assert.equal(meetStatusForMe(meetGate(withdrawn)), 'waiting_partner');
  const notYet = base({ intents: [base().intents[0]] });
  assert.equal(meetStatusForMe(meetGate(notYet)), 'waiting_partner', '「아니요」와 「아직」이 같은 상태로 보인다');
  assert.equal(meetStatusForMe(meetGate(base({ sessions: [] }))), 'need_video');
  assert.equal(meetStatusForMe(meetGate(base({ checks: [base().checks[1]] }))), 'need_my_check');
});

test('여러 세션이면 둘 다 카메라를 켠 가장 최근 세션 · 규칙 파일에 DB·네트워크·보증 문구 0', () => {
  const older = session({ id: 's0', endedAt: '2026-10-01T10:00:00Z' });
  assert.equal(jointSession({ match: base().match, sessions: [older, session()] }).id, 's1');
  assert.doesNotMatch(src, /from\(|fetch\(|Deno\.env|createClient/, '순수 규칙');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /확인된 사람|안전한 상대|인증 완료|verified_badge/);
});
