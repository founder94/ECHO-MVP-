// v1.5 후보(운영 미배포) 전용 검사 — 운영 agent.ts(v1.4)에는 help_same 이 없어 qa 에서 뺐다. 후보를 채택하면 qa/agent-server.test.mjs 끝에 다시 붙인다.

test('help 뒤 같은 문장을 그대로 내면 한 번 더 쉬운 다른 말로 청한다(help_same · 실AI run 11 관측)', async () => {
  const s = newState(); const h = load(s);
  s.ai.push(T({ extracted: [X('relationship_intent', '친구', '친구')], ...Q('attraction_comfort', '편한 사람은 어떤 사람인가요?') }));
  const sid = (await h.call({ action: 'agent_start', requestId: rid(), tone: 'polite', mode: 'TEXT', firstAnswer: '친구' })).body.session.id;
  s.ai.push(T({ kind: 'help', reply: '어떤 사람이 편한지 말하면 돼요.', ...Q('attraction_comfort', '편한 사람은 어떤 사람인가요?') }),
    T({ kind: 'help', reply: '어떤 사람이 편한지 말하면 돼요.', next: { type: 'core', purpose: 'attraction_comfort', question: '같이 밥 먹을 때 편한 사람은 어떤 사람이에요?', hint: '예: 말투 · 대화 · 취미' } }));
  const r = await h.call({ action: 'agent_turn', requestId: rid(), sessionId: sid, text: '예를 들면?' });
  assert.equal(r.body.turn.question, '같이 밥 먹을 때 편한 사람은 어떤 사람이에요?');
  assert.ok(s.tables.doit_request_events.filter((x) => x.action === 'agent_turn').at(-1).response_payload.record.retry.includes('help_same'));
  assert.equal(r.body.session.current_hint, '예: 말투 · 대화 · 취미');
});
