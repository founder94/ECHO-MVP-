import test from 'node:test';
import assert from 'node:assert/strict';
import { firstRoom, deliveryAllowed } from '../supabase/functions/doit-connect/lifecycle.ts';
import { completeMission, agreeTogetherExit, validateKeyTarget, validateReceipt } from '../supabase/functions/doit-connect/contracts.ts';
import { ID, world, loadServer, approveBoth, candOf } from './connect-server.test.mjs';

const time = Date.parse('2026-10-01T00:00:00Z');
test('72H server clock: exact deadline, refresh, interaction before expiry, invalid/future anchor', () => {
  const at = new Date(time).toISOString();
  assert.equal(firstRoom(at, [], time + 72 * 3600000 - 1).status, 'open');
  assert.equal(firstRoom(at, [], time + 72 * 3600000).status, 'expired');
  assert.equal(firstRoom(at, [new Date(time + 1000).toISOString()], time + 90 * 3600000).status, 'active');
  assert.equal(firstRoom(at, [new Date(time + 72 * 3600000).toISOString()], time + 90 * 3600000).status, 'expired');
  assert.equal(firstRoom('invalid', [], time).status, 'unavailable');
  assert.deepEqual(firstRoom(at, [], time), firstRoom(at, [], time));
});
test('personal delivery: daytime sleep, overnight, IANA timezone, DST, unrestricted, invalid config', () => {
  const day = { timezone: 'Asia/Seoul', quiet: { start: 9 * 60, end: 17 * 60 }, delivery: null };
  assert.equal(deliveryAllowed(time, day), false); // 09:00 Seoul
  assert.equal(deliveryAllowed(time + 8 * 3600000, day), true);
  const night = { timezone: 'America/New_York', quiet: { start: 22 * 60, end: 6 * 60 }, delivery: { start: 6 * 60, end: 10 * 60 } };
  assert.equal(deliveryAllowed(Date.parse('2026-03-08T10:30:00Z'), night), true); // DST: 06:30, not 05:30
  assert.equal(deliveryAllowed(Date.parse('2026-03-08T06:30:00Z'), night), false);
  assert.equal(deliveryAllowed(time, { timezone: 'Pacific/Auckland', quiet: null, delivery: null }), true);
  assert.throws(() => deliveryAllowed(time, { ...day, timezone: 'invalid' }));
  assert.throws(() => deliveryAllowed(time, { ...day, quiet: { start: 0, end: 0 } }));
});
test('mission contract: A/B completion, retry has one reward reference, outsider/cancel rejection', () => {
  const m = { id: 'm', connection_id: 'c', participants: { a: ID.a, b: ID.b }, state: 'assigned', completed: { a: false, b: false }, reward_reference: null };
  const a = completeMission(m, ID.a); assert.equal(a.state, 'assigned'); assert.equal(a.reward_reference, null);
  const both = completeMission(a, ID.b); assert.equal(both.state, 'completed'); assert.equal(both.reward_reference, 'mission:m:completed');
  assert.deepEqual(completeMission(both, ID.b), both);
  assert.throws(() => completeMission(m, ID.c)); assert.throws(() => completeMission({ ...m, state: 'cancelled' }, ID.a));
});
test('Together Exit contract: independent consent; no account deletion action', () => {
  const e = { connection_id: 'c', participants: { a: ID.a, b: ID.b }, agreed: { a: false, b: false }, outcome: 'pending' };
  const a = agreeTogetherExit(e, ID.a); assert.equal(a.outcome, 'pending');
  const both = agreeTogetherExit(a, ID.b); assert.equal(both.outcome, 'left_together');
  assert.deepEqual(agreeTogetherExit(both, ID.a), both);
  assert.ok(!JSON.stringify(both).includes('delete')); assert.throws(() => agreeTogetherExit(e, ID.c));
});
test('KEY contract: cannot buy mutual/yes/chat/trust/full-face; support isolated from trust', () => {
  for (const target of ['mutual', 'yes', 'chat', 'trust', 'relationship_level', 'full_face']) assert.throws(() => validateKeyTarget(target));
  validateKeyTarget('scene');
  assert.throws(() => validateReceipt({ axis: 'trust', source: 'purchase', reference_id: 'p', evidence_id: 'e' }));
  assert.throws(() => validateReceipt({ axis: 'activity', source: 'message_count', reference_id: 'p', evidence_id: 'e' }));
  validateReceipt({ axis: 'support', source: 'purchase', reference_id: 'p', evidence_id: 'e' });
});
async function paired() { const s = world(); const call = loadServer(s); await approveBoth(s, call, ID.a, ID.b); return { s, call, matchId: s.tables.doit_matches[0].id }; }
test('two-account simulated flow: candidate → mutual → room → first answers → reveal → bidirectional chat → outcome; retries', async () => {
  const { s, call, matchId } = await paired();
  let m = (await call(ID.a, { action: 'my_matches' })).body.matches[0];
  assert.equal(m.room.status, 'open'); assert.equal(m.reveal_state, 'CANDIDATE_SAFE'); assert.equal(s.signedPaths?.length ?? 0, 0);
  for (const who of [ID.a, ID.b]) {
    assert.equal((await call(who, { action: 'answer', matchId, text: '천천히 이야기해요' })).status, 200);
    assert.equal((await call(who, { action: 'answer', matchId, text: '천천히 이야기해요' })).body.replayed, true);
  }
  m = (await call(ID.a, { action: 'my_matches' })).body.matches[0]; assert.equal(m.reveal_state, 'FULL_SAFE'); assert.ok(m.partner.photo_url);
  for (const who of [ID.a, ID.b]) {
    const requestId = crypto.randomUUID(); const body = { action: 'message', matchId, text: '반가워요', requestId };
    const results = await Promise.all([call(who, body), call(who, body)]);
    assert.ok(results.every(r => r.status === 200));
    assert.equal((await call(who, { ...body, text: '다른 이야기' })).status, 409);
  }
  assert.equal(s.tables.doit_match_messages.length, 2);
  await Promise.all([call(ID.a, { action: 'outcome', matchId, talked: 'yes' }), call(ID.a, { action: 'outcome', matchId, met: 'planned' })]);
  assert.equal(s.tables.doit_match_outcomes.length, 1); assert.equal(s.tables.doit_match_outcomes[0].talked, 'yes'); assert.equal(s.tables.doit_match_outcomes[0].met, 'planned');
});
test('safety read failure prevents reveal and sends no URL', async () => {
  const { s, call, matchId } = await paired();
  for (const who of [ID.a, ID.b]) await call(who, { action: 'answer', matchId, text: '반가워요' });
  s.failDb = q => q.name === 'blocks';
  const result = await call(ID.a, { action: 'my_matches' }); assert.equal(result.status, 500); assert.equal(s.signedPaths?.length ?? 0, 0);
});
test('block during signed URL creation: no partner/photo returned', async () => {
  const { s, call, matchId } = await paired();
  for (const who of [ID.a, ID.b]) await call(who, { action: 'answer', matchId, text: '반가워요' });
  s.onSign = () => s.tables.blocks.push({ blocker_id: ID.b, blocked_user_id: ID.a });
  const m = (await call(ID.a, { action: 'my_matches' })).body.matches[0];
  assert.equal(m.revealed, false); assert.ok(!m.partner); assert.equal(m.status, 'closed');
});
test('consent withdrawal: full URL is withheld even with both answers', async () => {
  const { s, call, matchId } = await paired();
  for (const who of [ID.a, ID.b]) await call(who, { action: 'answer', matchId, text: '반가워요' });
  s.users[ID.b].user_metadata = {};
  const m = (await call(ID.a, { action: 'my_matches' })).body.matches[0]; assert.equal(m.revealed, false); assert.ok(!m.partner); assert.equal(s.signedPaths?.length ?? 0, 0);
});
test('room expiry: both clients and server writes agree, refresh cannot reopen', async () => {
  const { s, call, matchId } = await paired();
  s.tables.doit_matches[0].created_at = new Date(Date.now() - 73 * 3600000).toISOString();
  for (const who of [ID.a, ID.b]) {
    const m = (await call(who, { action: 'my_matches' })).body.matches[0]; assert.equal(m.room.status, 'expired'); assert.equal(m.status, 'closed'); assert.ok(!m.partner);
    assert.equal((await call(who, { action: 'answer', matchId, text: '반가워요' })).status, 409);
    assert.equal((await call(who, { action: 'my_turns' })).body.open, 0);
  }
});
test('recover connection orphan after link write failure; never expose before repair', async () => {
  const s = world(); const call = loadServer(s); await call(ID.a, { action: 'my_candidates' }); const c = candOf(s, ID.a, ID.b);
  await call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' });
  s.failDb = q => q.name === 'doit_match_candidates' && q.op === 'update' && !!q.patch?.match_id;
  assert.equal((await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' })).status, 409);
  assert.equal(s.tables.doit_matches.length, 1); assert.equal((await call(ID.a, { action: 'my_matches' })).body.matches.length, 0);
  s.failDb = null; assert.equal((await call(ID.b, { action: 'choose', candidateId: c.id, choice: 'yes' })).body.status, 'mutual');
  assert.equal(s.tables.doit_matches.length, 1); assert.equal((await call(ID.a, { action: 'my_matches' })).body.matches.length, 1);
});
test('simultaneous conflicting choice from same account cannot overwrite terminal no', async () => {
  const s = world(); const call = loadServer(s); await call(ID.a, { action: 'my_candidates' }); const c = candOf(s, ID.a, ID.b);
  const results = await Promise.all([call(ID.a, { action: 'choose', candidateId: c.id, choice: 'no' }), call(ID.a, { action: 'choose', candidateId: c.id, choice: 'yes' })]);
  assert.equal(c.a_choice, 'no'); assert.equal(c.status, 'declined'); assert.equal(s.tables.doit_matches.length, 0); assert.ok(results.some(r => r.status === 409));
});
test('rejected/stale candidate common text is not delivered after confirmed profile changes', async () => {
  const s = world(); const call = loadServer(s); await call(ID.a, { action: 'my_candidates' });
  s.tables.doit_insights.forEach(i => { if (i.user_id === ID.a) i.status = 'rejected'; });
  const c = (await call(ID.a, { action: 'my_candidates' })).body.candidates[0]; assert.ok(c.reasons.every(r => !r.includes('내가 직접 한 말')));
});
test('block/report write errors return failure; terminated connection cannot chat or re-enter', async () => {
  const { s, call, matchId } = await paired(); s.failDb = q => q.name === 'blocks' && q.op === 'insert';
  assert.equal((await call(ID.a, { action: 'leave', matchId, block: true, report: true })).status, 500);
  assert.equal((await call(ID.b, { action: 'message', matchId, text: '반가워요' })).status, 409);
  assert.equal((await call(ID.a, { action: 'choose', candidateId: candOf(s, ID.a, ID.b).id, choice: 'yes' })).status, 409);
});
test('ZZARIT persisted once per participant/connection: concurrent retries, refresh, block', async () => {
 const {s,call,matchId}=await paired();
 const before=(await call(ID.a,{action:'my_matches'})).body.matches[0];assert.equal(before.zzarit_eligible,true);
 const rr=await Promise.all([call(ID.a,{action:'zzarit_seen',matchId}),call(ID.a,{action:'zzarit_seen',matchId})]);
 assert.equal(rr.filter(r=>r.body.zzarit_event).length,1);assert.equal(s.tables.doit_request_events.length,1);
 assert.equal((await call(ID.a,{action:'my_matches'})).body.matches[0].zzarit_eligible,false);
 assert.equal((await call(ID.b,{action:'my_matches'})).body.matches[0].zzarit_eligible,true);
 assert.equal((await call(ID.c,{action:'zzarit_seen',matchId})).status,404);
 await call(ID.a,{action:'leave',matchId,block:true});assert.equal((await call(ID.b,{action:'zzarit_seen',matchId})).status,409);
});
test('candidate safety preserves waiting YES withdrawal; concurrent report has one durable row', async () => {
 const s=world(),call=loadServer(s);await call(ID.a,{action:'my_candidates'});const c=candOf(s,ID.a,ID.b);
 await call(ID.a,{action:'choose',candidateId:c.id,choice:'yes'});
 const r=await call(ID.a,{action:'choose',candidateId:c.id,choice:'hide',block:true,reason:'spam'});assert.equal(r.body.blocked,true);assert.equal(r.body.reported,true);assert.equal(c.status,'declined');
 assert.equal((await call(ID.b,{action:'choose',candidateId:c.id,choice:'yes'})).status,409);
 const x=await paired();await Promise.all([x.call(ID.a,{action:'leave',matchId:x.matchId,reason:'spam'}),x.call(ID.a,{action:'leave',matchId:x.matchId,reason:'spam'})]);assert.equal(x.s.tables.user_reports.length,1);
});
