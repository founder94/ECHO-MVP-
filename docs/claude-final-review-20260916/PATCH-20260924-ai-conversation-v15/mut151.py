import subprocess, os
SRV='supabase/functions/doit-understanding/index.ts'
CON='supabase/functions/doit-connect/index.ts'
CLI='src/doit/components/feature/CoreConversation.tsx'
TESTS=['qa/conversation-v15.test.mjs','qa/server-conversation-flow.test.mjs','qa/conversation-continuity.test.mjs','qa/core-conversation-question-state.test.mjs','qa/conversation-rules.test.mjs','qa/connect-server.test.mjs']
M=[
 ('A1 준비 상태: 「모르겠어요」도 자격 답으로 셈', SRV, 'const answers = roundAnswers.filter((r) => informativeAnswer(String(r.text ?? ""))).length;', 'const answers = roundAnswers.length;'),
 ('A2 연결 후보: 「모르겠어요」도 자격 답으로 셈', CON, '    if (!informativeAnswer(String(row.text ?? ""))) continue;\n', ''),
 ('A3 소개 초안: 「모르겠어요」도 재료로 씀', SRV, ' && informativeAnswer(t)).slice(0, LIMITS.DRAFT_RECORDS_MAX)', ').slice(0, LIMITS.DRAFT_RECORDS_MAX)'),
 ('A4 화면 끝: 넘긴 답 안내 없앰', CLI, '{uninformativeCount > 0 && <p', '{false && <p'),
 ('B1 분류: 거절 저장 안 함', SRV, '        if (line) rejectedSaved = await persistRejection(admin, userId, line, targetRecord);', '        void targetRecord;'),
 ('B2 다음 질문: 저장된 거절을 차단 목록에 안 넣음', SRV, '  mergeRejected(rejected, opts.rejectedTurns);\n', ''),
 ('B3 새로고침 뒤 정정 전략 복원 안 함', SRV, '    if (between) correctionLine = between.text;', '    void between;'),
 ('B4 통합 카드: 저장된 거절을 차단 목록에 안 넣음', SRV, '  mergeRejected(rejected, await rejectedTurns(admin, userId)); // v15.1 대화 중 거절도 카드에서 막는다', ''),
 ('B5 예전 앱 이해 후보: 저장된 거절 무시', SRV, '      mergeRejected(rejected, await rejectedTurns(admin, userId)); // v15.1 대화 중 거절도 이해 후보에서 막는다(예전 앱 경로)', ''),
 ('B6 소개 초안: 저장된 거절 무시', SRV, '      mergeRejected(rejected, await rejectedTurns(admin, userId)); // v15.1 대화 중 거절한 문장은 소개에도 쓰지 않는다', ''),
 ('B7 거절 대상 검증 없음(아무 문장이나 저장)', SRV, 'const line = target ? matchAskedLine(target, (await askedQuestionsAt(admin, userId, roundStartOf(user))).map((a) => a.full)) : null;', 'const line = target || null;'),
 ('B8 화면: 분류 때 떠 있는 AI 문장을 안 보냄', CLI, "{ correction: correctionTarget(), recordId: question?.sourceRecordId || null }", "{}"),
 ('C1 안내문을 질문 후보로 허용', SRV, '  if (FIXED_LINE_KEYS.has(normalizeKey(body)) || q.split("\\n").some((line) => FIXED_LINE_KEYS.has(normalizeKey(line)))) return { reason: "fixed_line", question: q };\n', ''),
 ('C2 서버: 두 번째 "아니야"도 같은 안내 되풀이', SRV, '        const again = normalizeKey(questionBody(question)) === normalizeKey(questionBody(TURN_REPLY.correction));', '        const again = false;'),
 ('C3 화면: 안내 되풀이 막는 장치 없앰', CLI, "(turn.again || correctionPrompted)", "(false)"),
 ('C4 설명 붙은 정정에도 안내를 다시 요구', SRV, '      if (turn.kind === "correction" && !turn.rest) {', '      if (turn.kind === "correction") {'),
]
def run():
    out=subprocess.run(['node','--test',*TESTS],capture_output=True,text=True,env={**os.environ,'NODE_PATH':'../tools/node_modules'}).stdout
    return [l.split(' - ',1)[-1][:80] for l in out.splitlines() if l.startswith('not ok') and '# TODO' not in l]
base=run(); assert not base, base
for name,path,old,new in M:
    s=open(path).read(); assert s.count(old)==1,(name,s.count(old))
    open(path,'w').write(s.replace(old,new))
    try: f=run()
    finally: open(path,'w').write(s)
    print(f"{name} → 잡은 검사 {len(f)}개" + ("  ← 못 잡음" if not f else "") + (": " + " | ".join(f[:3]) if f else ""), flush=True)
print('RESTORED')
