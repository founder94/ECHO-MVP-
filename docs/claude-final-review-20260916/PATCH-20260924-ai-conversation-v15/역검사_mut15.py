import subprocess, shutil, re, os, sys
SRV='supabase/functions/doit-understanding/index.ts'
CLI='src/doit/components/feature/CoreConversation.tsx'
RULES='src/doit/lib/conversationRules.ts'
TESTS=['qa/conversation-v15.test.mjs','qa/conversation-continuity.test.mjs','qa/server-conversation-flow.test.mjs','qa/core-conversation-question-state.test.mjs','qa/conversation-rules.test.mjs']
M=[
 ('① 이미 답한 말 되묻기 검사 제거(restatesAnswers)', SRV, 'if (restatesAnswers(q, answers)) return { reason: "restate", question: q };', ''),
 ('② 결정적 최소 방어 제거(not_anchored)', SRV, 'if (factual && !input.skip && finalStrategy !== "RECOVER_FROM_REJECTION" && !(ack && basisGrounded) && !sharesWords(q, anchorLines)) return { reason: "not_anchored", question: q };', ''),
 ('③ 다시 만들기 없음(1번만)', SRV, 'const COMPOSE_ATTEMPTS = 3;', 'const COMPOSE_ATTEMPTS = 1;'),
 ('④ 떨어진 이유를 다음 생성에 안 알려 줌', SRV, 'JSON.stringify(dropped.length ? { ...evidence, rejected_candidates: dropped } : evidence)', 'JSON.stringify(evidence)'),
 ('⑤ 고정 안전문장 되살리기(실패 시 "방금 한 말, 조금만 더 들려줄래요?")', SRV, '  return await composeQuestion(apiKey, model, budget, {\n    recordText, confirmed, rejected, superseded, asked,', '  return await composeQuestion(apiKey, model, budget, {\n    recordText, confirmed, rejected, superseded, asked,'),
 ('⑥ 불만 규칙 제거(COMPLAINT_PATTERNS)', None, None, None),
 ('⑦ 지친 말 규칙 제거(FATIGUE_PATTERNS)', None, None, None),
 ('⑧ 예전 앱 기록도 이해 후보로(recordKind 무시)', SRV, 'const factual = !args.recordKind || args.recordKind === "answer" || args.recordKind === "correction";', 'const factual = true;'),
 ('⑨ 통합 카드: 「할 말이 없어요」 항목 걸러내기 제거', SRV, 'if (k === "fatigue" || k === "unsure" || k === "complaint") { drop("not_fact"); continue; }', ''),
 ('⑩ 통합 카드: 근거 검사 제거', SRV, 'if (!grounded) { drop("not_grounded"); continue; }', ''),
 ('⑪ 통합 카드: 거절한 뜻 차단 제거', SRV, 'if (blockedByOverlap(text, [], blockers)) { drop("rejected"); continue; }', ''),
 ('⑫ 정정 대상 문장 검증 제거(아무 문장이나 받음)', SRV, 'const key = normalizeKey(raw);', 'const key = normalizeKey(raw); if (raw) return raw;'),
 ('⑬ 기계적 받아 주기("…라고 하셨죠") 허용', SRV, 'const ackOk = !!ack && ack.length <= LIMITS.ACK_MAX && !MECHANICAL_ACK.test(ack)', 'const ackOk = !!ack && ack.length <= LIMITS.ACK_MAX'),
 ('⑭ 화면: 답마다 이해 후보(4버튼 카드) 되살리기', CLI, "    const record = await api.record(text);\n    if (!alive.current) return;", "    const record = await api.record(text);\n    await (api as unknown as { generate: (id: string) => Promise<unknown> }).generate(record.id);\n    if (!alive.current) return;"),
 ('⑮ 화면: 불만을 답으로 저장', CLI, "    if (turn.kind === 'complaint') {", "    if (turn.kind === 'complaint' && false) {"),
 ('⑯ 화면: 지친 말을 답으로 저장', CLI, "    if (turn.kind === 'fatigue') {", "    if (turn.kind === 'fatigue' && false) {"),
 ('⑰ 서버: 다른 질문 받기가 DB 캐시 경로로(같은 질문 반복)', SRV, '      if (body.skip === true) {', '      if (body.skip === true && false) {'),
 ('⑱ 판정 결과 무시(항상 허용)', SRV, '      return judged?.allowed === true;', '      return true;'),
 ('⑲ AI 가 스스로 밝힌 반복·미확정 전제 표시 무시', SRV, 'if (out?.is_repeat === true || out?.assumes_unconfirmed_fact === true || out?.uses_rejected_meaning === true) return { reason: "self_flag", question: q };', ''),
 ('⑳ 통합 카드 결정: 확인 대기 항목인지 검사 제거', SRV, "        if (already.length !== missing.length) return fail(CODES.INVALID_STATE,", "        if (false) return fail(CODES.INVALID_STATE,"),
]
def run():
    out=subprocess.run(['node','--test',*TESTS],capture_output=True,text=True,env={**os.environ,'NODE_PATH':'../tools/node_modules'}).stdout
    fails=[l[7:].split(' - ',1)[-1][:70] for l in out.splitlines() if l.startswith('not ok')]
    return fails
base=run(); assert not base, base
for name,path,old,new in M:
    files={}
    if name.startswith('⑤'):
        s=open(SRV).read(); files[SRV]=s
        s=s.replace('  throw new Error(`FOLLOWUP_EXHAUSTED:${lastReason}`);','  return { question: "방금 한 말, 조금만 더 들려줄래요?", topic: null, strategy };')
        assert s!=files[SRV]; open(SRV,'w').write(s)
    elif name.startswith('⑥') or name.startswith('⑦'):
        var='COMPLAINT_PATTERNS' if name.startswith('⑥') else 'FATIGUE_PATTERNS'
        for p in (SRV,RULES):
            s=open(p).read(); files[p]=s
            s2=re.sub(r'const %s: readonly RegExp\[\] = \[[\s\S]*?\n\];'%var, 'const %s: readonly RegExp[] = [];'%var, s, count=1)
            assert s2!=s; open(p,'w').write(s2)
    else:
        s=open(path).read(); files[path]=s
        assert s.count(old)==1,(name,s.count(old)); open(path,'w').write(s.replace(old,new))
    try:
        f=run()
    finally:
        for p,c in files.items(): open(p,'w').write(c)
    print(f"{name} → 잡은 검사 {len(f)}개" + ("  ← 못 잡음" if not f else "") + (": " + " | ".join(f[:3]) if f else ""))
print('RESTORED')
