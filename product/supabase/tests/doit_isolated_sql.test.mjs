// Executes the actual reviewed SQL in an ephemeral PGlite PostgreSQL engine.
// Synthetic data only: no URL, SDK, network transport, secret or production database.
// One connection: this verifies SQL behavior, NOT real concurrent transactions or RLS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const moduleUrl = process.env.PGLITE_MODULE || new URL('../../../sql_validation_deps/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href;
const { PGlite } = await import(moduleUrl);
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [schema, baseline, revisionSql, followupSql, rollbackSql] = await Promise.all([
  read('./fixtures/doit_isolated_schema.sql'), read('./fixtures/doit_captured_rpc_baseline.sql'),
  read('../drafts/PENDING_20260921_doit_revision_lock.sql'), read('../drafts/PENDING_20260921_doit_followup.sql'),
  read('../drafts/ROLLBACK_20260921_doit_revision_lock.sql'),
]);
const baselineFingerprints = [...revisionSql.matchAll(/pg_get_functiondef\('([^']+)'::regprocedure\)\) <> '([^']+)'/g)];
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const original = '  약속을 지켜 주는 사람이 좋아요.\n연락은 천천히 해도 괜찮아요.  ';
const sourceText = original.trim();
const question = '약속을 지켜 줬을 때 어떤 기분이 들었나요?';
const candidate = { category: 'value', text: '약속을 지키는 관계를 중요하게 여깁니다.' };

test('isolated PostgreSQL SQL contracts (synthetic data, sequential single connection)', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(schema);
  await db.exec(baseline);
  const query = async (sql, values = []) => (await db.query(sql, values)).rows;
  const rpc = async (name, args) => (await query(`SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`, args))[0].result;
  const count = async (table) => Number((await query(`SELECT count(*) AS n FROM public.${table}`))[0].n);
  const claims = async (role = 'service_role', uid = userA) => {
    await query("SELECT set_config('request.jwt.claim.role', $1, false), set_config('request.jwt.claim.sub', $2, false)", [role, uid]);
  };
  const fingerprints = async () => Promise.all(baselineFingerprints.map(async ([, signature]) =>
    (await query('SELECT md5(pg_get_functiondef($1::regprocedure)) AS digest', [signature]))[0].digest));
  let recordA;
  let recordB;
  const reset = async () => {
    await db.exec('RESET ROLE; TRUNCATE public.doit_insights, public.doit_records, public.doit_request_events;');
    await claims();
    await db.exec('UPDATE public.purposes SET is_active=true');
    await query("UPDATE public.profiles SET purpose_id=CASE WHEN id=$1 THEN 'romance' ELSE 'friendship' END", [userA]);
    recordA = randomUUID(); recordB = randomUUID();
    await query('INSERT INTO public.doit_records(id,user_id,original_text,text) VALUES($1,$2,$3,$4),($5,$6,$3,$4)',
      [recordA, userA, original, sourceText, recordB, userB]);
  };
  const begin = async (kind = 'followup', overrides = {}) => {
    const request = { user: userA, record: recordA, id: randomUUID(), hash: 'synthetic-payload', lease: randomUUID(), ...overrides };
    const output = await rpc(`doit_begin_${kind}`, [request.user, request.record, request.id, request.hash, request.lease]);
    return { request, output };
  };
  const finishQuestion = ({ request: r, output }, overrides = {}) => {
    const values = { context: output.context?.context_hash, lease: r.lease, text: question, error: null, ...overrides };
    return rpc('doit_finish_followup', [r.user, r.record, r.id, r.hash, values.lease, values.context, values.text, values.error]);
  };
  const finishInsight = ({ request: r, output }, overrides = {}) => {
    const values = { context: output.context?.context_hash, lease: r.lease, source: sourceText, candidates: [candidate], rescue: null,
      trace: { test: 'synthetic-only' }, error: null, ...overrides };
    return rpc('doit_finish_insight_generate', [r.user, r.id, 'insight_generate', r.hash, r.record, values.source,
      values.lease, values.context, JSON.stringify(values.candidates), values.rescue && JSON.stringify(values.rescue), JSON.stringify(values.trace), values.error]);
  };
  const self = (text = '연락 횟수보다 약속을 지키는 게 중요해요.') => rpc('doit_apply_insight_self',
    [userA, randomUUID(), 'insight_self', 'self-fixture', recordA, 'value', text]);
  const transition = (id, revision, status, text = null) => rpc('doit_apply_insight_transition',
    [userA, randomUUID(), `insight_${status}`, randomUUID(), id, revision, status, text]);

  await t.test('six captured baseline definitions match untouched release fingerprints', async () => {
    assert.equal(baselineFingerprints.length, 6);
    assert.deepEqual(await fingerprints(), baselineFingerprints.map(([, , digest]) => digest));
  });
  await t.test('actual revision and follow-up drafts execute with their preflight and grants intact', async () => {
    await db.exec(revisionSql);
    await db.exec(followupSql);
    assert.equal((await query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='doit_request_events' AND column_name IN ('response_payload','context_hash','lease_token','lease_expires_at')"))[0].n, 4);
  });
  await t.test('captured table CHECK constraints permit followup_generate but reject empty action and invalid states', async () => {
    await reset();
    const checks = await query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='c' AND conrelid IN ('public.doit_records'::regclass,'public.doit_insights'::regclass,'public.doit_request_events'::regclass)");
    assert.equal(checks.length, 9);
    assert.equal(checks.some((row) => row.definition.includes('revision')), false);
    const claim = await begin(); assert.equal(claim.output.ok, true);
    assert.equal((await query('SELECT action FROM public.doit_request_events WHERE request_id=$1', [claim.request.id]))[0].action, 'followup_generate');
    await assert.rejects(() => query("INSERT INTO public.doit_request_events(user_id,request_id,action) VALUES($1,$2,' ')", [userA, randomUUID()]), /check constraint/);
    await assert.rejects(() => query("UPDATE public.doit_request_events SET status='complete'"), /check constraint/);
    await assert.rejects(() => query("UPDATE public.doit_records SET text=' ' WHERE id=$1", [recordA]), /check constraint/);
  });
  await t.test('revision preflight refuses a second replacement and rolls back without changing definitions', async () => {
    const before = await fingerprints();
    await assert.rejects(() => db.exec(revisionSql), /production definition changed/);
    await db.exec('ROLLBACK');
    assert.deepEqual(await fingerprints(), before);
  });
  await t.test('claim returns only owner context; same and different UUIDs are in flight before finish', async () => {
    await reset();
    const first = await begin();
    assert.equal(first.output.ok, true);
    assert.equal(first.output.duplicate, false);
    assert.equal(first.output.context.record.id, recordA);
    assert.equal(first.output.context.record.original_text, original);
    assert.equal((await begin('followup', first.request)).output.code, 'IN_FLIGHT');
    assert.equal((await begin()).output.code, 'IN_FLIGHT');
    assert.equal((await begin('insight_generate')).output.code, 'IN_FLIGHT');
    assert.equal(await count('doit_request_events'), 1);
  });
  await t.test('accepted question restores exactly; duplicate request and fresh UUID reuse it without another lease', async () => {
    await reset();
    const claim = await begin();
    const done = await finishQuestion(claim);
    assert.deepEqual(done.question, { text: question, sourceRecordId: recordA });
    assert.deepEqual((await rpc('doit_get_followup', [userA, recordA])).question, done.question);
    for (const duplicate of [(await begin('followup', claim.request)).output, (await begin()).output, await finishQuestion(claim)]) {
      assert.equal(duplicate.duplicate, true);
      assert.deepEqual(duplicate.question, done.question);
    }
    assert.equal(await count('doit_request_events'), 2);
  });
  await t.test('changed payload for an existing request is a conflict, not a second AI lease', async () => {
    await reset(); const claim = await begin();
    assert.equal((await begin('followup', { ...claim.request, hash: 'different' })).output.code, 'REQUEST_CONFLICT');
    assert.equal(await count('doit_request_events'), 1);
  });
  await t.test('unreviewed candidates and rejected records cannot advance to a question', async () => {
    await reset();
    await query("INSERT INTO public.doit_insights(user_id,category,text,source_record_id) VALUES($1,'value','미확인 후보',$2)", [userA, recordA]);
    assert.equal((await begin()).output.code, 'PENDING_INSIGHTS');
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).question, null);
    await query("UPDATE public.doit_records SET status='rejected' WHERE id=$1", [recordA]);
    assert.equal((await begin()).output.code, 'INVALID_STATE');
    assert.equal(await count('doit_request_events'), 0);
  });
  await t.test('direct explanation after acceptance invalidates saved question and old request replay', async () => {
    await reset(); const claim = await begin(); await finishQuestion(claim);
    const added = await self(); assert.equal(added.ok, true);
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).question, null);
    assert.equal((await begin('followup', claim.request)).output.code, 'STALE_CONTEXT');
    const fresh = await begin(); assert.equal(fresh.output.ok, true);
    assert.equal(fresh.output.context.insights[0].text, added.insight.text);
  });
  await t.test('purpose is read from the owned canonical profile and invalidates an old accepted question', async () => {
    await reset(); const claim = await begin();
    assert.deepEqual(claim.output.context.purpose, { id: 'romance', label: '연애로 이어질 만남을 원해요' });
    await finishQuestion(claim);
    await query("UPDATE public.profiles SET purpose_id='friendship' WHERE id=$1", [userA]);
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).question, null);
    assert.equal((await begin('followup', claim.request)).output.code, 'STALE_CONTEXT');
    const fresh = await begin();
    assert.deepEqual(fresh.output.context.purpose, { id: 'friendship', label: '편하게 함께할 친구를 원해요' });
  });
  await t.test('purpose changes during generation invalidate both question and candidate results', async () => {
    for (const kind of ['followup', 'insight_generate']) {
      await reset(); const claim = await begin(kind);
      await query("UPDATE public.profiles SET purpose_id='friendship' WHERE id=$1", [userA]);
      const result = await (kind === 'followup' ? finishQuestion(claim) : finishInsight(claim));
      assert.equal(result.code, 'STALE_CONTEXT');
      assert.equal(await count('doit_insights'), 0);
    }
  });
  await t.test('unknown or inactive purpose is omitted, not replaced by a browser label or inferred personality', async () => {
    await reset();
    await query("UPDATE public.profiles SET purpose_id='unknown-test-purpose' WHERE id=$1", [userA]);
    assert.equal((await begin()).output.context.purpose, null);
    await reset();
    await db.exec("UPDATE public.purposes SET is_active=false WHERE id='romance'");
    assert.equal((await begin()).output.context.purpose, null);
  });
  await t.test('user change while a question is being generated rejects the stale result', async () => {
    await reset(); const claim = await begin(); await self();
    assert.equal((await finishQuestion(claim)).code, 'STALE_CONTEXT');
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).question, null);
    assert.equal((await query('SELECT status,response_payload FROM public.doit_request_events WHERE request_id=$1', [claim.request.id]))[0].status, 'failed');
  });
  await t.test('expired old question worker cannot commit after a different request takes over', async () => {
    await reset(); const old = await begin();
    await query("UPDATE public.doit_request_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1", [old.request.id]);
    const fresh = await begin(); assert.equal(fresh.output.ok, true);
    assert.equal((await finishQuestion(old)).code, 'STALE_CONTEXT');
    assert.equal((await finishQuestion(fresh, { text: '새 요청에서 만든 실제 질문은 무엇인가요?' })).ok, true);
    assert.equal((await query("SELECT count(*)::int AS n FROM public.doit_request_events WHERE status='applied'"))[0].n, 1);
  });
  await t.test('same request lease replacement prevents the previous worker from finishing', async () => {
    await reset(); const old = await begin();
    await query("UPDATE public.doit_request_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1", [old.request.id]);
    const fresh = await begin('followup', { ...old.request, lease: randomUUID() });
    assert.equal((await finishQuestion(old)).code, 'IN_FLIGHT');
    assert.equal((await finishQuestion(fresh)).ok, true);
  });
  await t.test('empty, overlong and AI-error questions never become accepted saved questions', async () => {
    for (const overrides of [{ text: '  ' }, { text: '가'.repeat(201) }, { error: 'AI_ERROR' }]) {
      await reset(); const claim = await begin();
      assert.equal((await finishQuestion(claim, overrides)).code, 'AI_ERROR');
      assert.equal((await rpc('doit_get_followup', [userA, recordA])).question, null);
    }
  });
  await t.test('foreign record ownership and cross-account completion are rejected', async () => {
    await reset();
    assert.equal((await begin('followup', { record: recordB })).output.code, 'FORBIDDEN');
    assert.equal((await begin('insight_generate', { record: recordB })).output.code, 'FORBIDDEN');
    assert.equal((await rpc('doit_get_followup', [userA, recordB])).code, 'FORBIDDEN');
    assert.equal(await count('doit_request_events'), 0);
    const claim = await begin();
    assert.equal((await finishQuestion({ ...claim, request: { ...claim.request, user: userB } })).code, 'REQUEST_CONFLICT');
  });
  await t.test('both anonymous and authenticated SQL roles lack execute even with a forged service claim', async () => {
    await reset();
    const functions = ['doit_followup_context(uuid,uuid)', 'doit_begin_followup(uuid,uuid,uuid,text,uuid)',
      'doit_finish_followup(uuid,uuid,uuid,text,uuid,text,text,text)', 'doit_get_followup(uuid,uuid)',
      'doit_begin_insight_generate(uuid,uuid,uuid,text,uuid)',
      'doit_finish_insight_generate(uuid,uuid,text,text,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'];
    for (const role of ['anon', 'authenticated']) {
      for (const signature of functions) {
        assert.equal((await query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed', [role, `public.${signature}`]))[0].allowed, false);
      }
      await db.exec(`SET ROLE ${role}`);
      await assert.rejects(() => rpc('doit_get_followup', [userA, recordA]), /permission denied/);
      await db.exec('RESET ROLE');
    }
    await db.exec('SET ROLE service_role');
    await claims('authenticated');
    await assert.rejects(() => rpc('doit_get_followup', [userA, recordA]), /forbidden/);
    await claims();
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).ok, true);
    await db.exec('RESET ROLE');
  });
  await t.test('modern claims JSON service role also works without the legacy role setting', async () => {
    await reset();
    await query("SELECT set_config('request.jwt.claim.role','',false),set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: 'service_role', sub: userA })]);
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).ok, true);
    await query("SELECT set_config('request.jwt.claims','',false)");
  });
  await t.test('modern service JWT without an end-user sub can atomically finish candidate generation', async () => {
    await reset();
    await query("SELECT set_config('request.jwt.claim.role','',false),set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: 'service_role' })]);
    try {
      const claim = await begin('insight_generate');
      assert.equal(claim.output.ok, true);
      assert.equal((await finishInsight(claim)).ok, true);
    } finally {
      await query("SELECT set_config('request.jwt.claims','',false)");
      await claims();
    }
  });
  await t.test('candidate acceptance stores exact rows once, caches post-insert context and blocks follow-up', async () => {
    await reset(); const claim = await begin('insight_generate');
    assert.equal((await begin()).output.code, 'IN_FLIGHT');
    const done = await finishInsight(claim);
    assert.equal(done.ok, true); assert.equal(done.insights.length, 1);
    assert.equal(done.insights[0].text, candidate.text);
    assert.equal(done.insights[0].source_record_id, recordA);
    assert.equal(done.insights[0].source_text, sourceText);
    for (const duplicate of [(await begin('insight_generate', claim.request)).output, (await begin('insight_generate')).output, await finishInsight(claim)]) {
      assert.equal(duplicate.duplicate, true); assert.deepEqual(duplicate.insights, done.insights);
    }
    assert.equal(await count('doit_insights'), 1);
    assert.equal((await begin()).output.code, 'PENDING_INSIGHTS');
  });
  await t.test('rescue question is stored exactly and restored without manufacturing candidate rows', async () => {
    await reset(); const claim = await begin('insight_generate');
    const rescue = { kind: 'ai_question', text: question };
    const done = await finishInsight(claim, { candidates: [], rescue });
    assert.equal(done.ok, true); assert.equal(done.rescued, true); assert.deepEqual(done.rescue, rescue);
    assert.equal(await count('doit_insights'), 0);
    const duplicate = (await begin('insight_generate', claim.request)).output;
    assert.equal(duplicate.duplicate, true); assert.deepEqual(duplicate.rescue, rescue);
  });
  await t.test('old v5 applied event without response snapshot cannot trigger another paid generation', async () => {
    await reset(); const id = randomUUID();
    await query("INSERT INTO public.doit_request_events(user_id,request_id,action,target_id,payload_hash,status) VALUES($1,$2,'insight_generate',$3,'old-v5-payload','applied')", [userA, id, recordA]);
    assert.equal((await begin('insight_generate', { id, hash: 'old-v5-payload' })).output.code, 'STALE_CONTEXT');
    const row = (await query('SELECT status,response_payload,lease_token FROM public.doit_request_events WHERE request_id=$1', [id]))[0];
    assert.deepEqual(row, { status: 'applied', response_payload: null, lease_token: null });
  });
  await t.test('a new cached request UUID is bound to its payload for both generation actions', async () => {
    for (const kind of ['followup', 'insight_generate']) {
      await reset(); const originalClaim = await begin(kind);
      await (kind === 'followup' ? finishQuestion(originalClaim) : finishInsight(originalClaim));
      const cached = await begin(kind); assert.equal(cached.output.duplicate, true);
      assert.equal((await begin(kind, { ...cached.request, hash: 'changed-cached-payload' })).output.code, 'REQUEST_CONFLICT');
      assert.equal(await count('doit_request_events'), 2);
    }
  });
  await t.test('revision changes during candidate generation reject all new candidate writes', async () => {
    await reset(); const claim = await begin('insight_generate'); await self();
    assert.equal((await finishInsight(claim)).code, 'STALE_CONTEXT');
    assert.equal((await query("SELECT count(*)::int AS n FROM public.doit_insights WHERE origin='ai'"))[0].n, 0);
  });
  await t.test('expired candidate lease cannot write, and a replacement request can finish', async () => {
    await reset(); const old = await begin('insight_generate');
    await query("UPDATE public.doit_request_events SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1", [old.request.id]);
    const fresh = await begin('insight_generate');
    assert.equal((await finishInsight(old)).code, 'STALE_CONTEXT');
    assert.equal((await finishInsight(fresh)).ok, true);
    assert.equal(await count('doit_insights'), 1);
  });
  await t.test('source mismatch, overlarge candidate array and absent rescue do not store candidates', async () => {
    for (const [overrides, code] of [[{ source: '다른 사용자의 문장' }, 'BAD_REQUEST'],
      [{ candidates: Array(10).fill(candidate) }, 'BAD_REQUEST'], [{ candidates: [], rescue: null }, 'AI_ERROR']]) {
      await reset(); const claim = await begin('insight_generate');
      assert.equal((await finishInsight(claim, overrides)).code, code);
      assert.equal(await count('doit_insights'), 0);
    }
  });
  await t.test('correction increments revision, preserves AI and record originals, and stale correction fails', async () => {
    await reset(); const generated = await finishInsight(await begin('insight_generate'));
    const insight = generated.insights[0];
    const corrected = await transition(insight.id, 1, 'corrected', '연락 횟수보다 약속이 중요해요.');
    assert.equal(corrected.insight.revision, 2);
    assert.equal(corrected.insight.ai_text, candidate.text);
    assert.equal(corrected.insight.text, '연락 횟수보다 약속이 중요해요.');
    assert.equal((await transition(insight.id, 1, 'corrected', '오래된 수정')).code, 'STALE_REVISION');
    const rejected = await transition(insight.id, 2, 'rejected'); assert.equal(rejected.ok, true);
    assert.equal((await transition(insight.id, 3, 'confirmed')).code, 'INVALID_STATE');
    assert.equal((await query('SELECT original_text FROM public.doit_records WHERE id=$1', [recordA]))[0].original_text, original);
  });
  await t.test('record edit keeps raw original and rejects stale expected revision', async () => {
    await reset();
    const args = [userA, randomUUID(), 'record_update', 'edit-fixture', recordA, 1, '제가 직접 고친 문장', ''];
    const result = await rpc('doit_apply_record_update', args);
    assert.equal(result.record.revision, 2); assert.equal(result.record.original_text, original);
    args[1] = randomUUID(); args[6] = '오래된 화면의 수정';
    assert.equal((await rpc('doit_apply_record_update', args)).code, 'STALE_REVISION');
  });
  await t.test('identical request UUIDs on independent accounts keep separate contexts and results', async () => {
    await reset(); const id = randomUUID();
    const a = await begin('followup', { id });
    const b = await begin('followup', { id, user: userB, record: recordB });
    assert.equal(a.output.ok, true); assert.equal(b.output.ok, true);
    await finishQuestion(a, { text: '계정 A의 질문인가요?' });
    await finishQuestion(b, { text: '계정 B의 질문인가요?' });
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).question.text, '계정 A의 질문인가요?');
    assert.equal((await rpc('doit_get_followup', [userB, recordB])).question.text, '계정 B의 질문인가요?');
    assert.equal(await count('doit_request_events'), 2);
  });
  await t.test('emergency rollback fingerprint accepts only reviewed functions and preserves saved data', async () => {
    await reset(); const claim = await begin(); await finishQuestion(claim);
    await db.exec(rollbackSql);
    assert.deepEqual(await fingerprints(), baselineFingerprints.map(([, , digest]) => digest));
    assert.equal((await rpc('doit_get_followup', [userA, recordA])).question.text, question);
    await assert.rejects(() => db.exec(rollbackSql), /rollback refused/);
    await db.exec('ROLLBACK');
    assert.equal(await count('doit_request_events'), 1);
    // End with the reviewed safeguards restored inside this isolated, disposable engine.
    await db.exec(revisionSql);
  });
});
