import subprocess, shutil, re
S='supabase/functions/doit-understanding/index.ts'; C='src/doit/components/feature/CoreConversation.tsx'
orig_s=open('../du-v144.ts').read(); orig_c=open('../cc-v144.tsx').read()
TESTS=['qa/conversation-continuity.test.mjs','qa/server-conversation-flow.test.mjs','qa/core-conversation-question-state.test.mjs','qa/conversation-rules.test.mjs']
muts=[
 ('① 직전 답(record) 제거', S, 'const evidence = { strategy, record: recordText, last_question', 'const evidence = { strategy, record: "", last_question'),
 ('② 직전 질문 제거', S, 'last_question: input.lastQuestion, history', 'last_question: null, history'),
 ('③ history 제거', S, 'history: input.history, confirmed', 'history: [], confirmed'),
 ('④ 정정(superseded) 제거', S, 'confirmed, rejected: rejected.map((r) => r.text), superseded, asked_questions', 'confirmed, rejected: rejected.map((r) => r.text), superseded: [], asked_questions'),
 ('⑤ 거절(rejected) 제거', S, 'confirmed, rejected: rejected.map((r) => r.text), superseded, asked_questions', 'confirmed, rejected: [], superseded, asked_questions'),
 ('⑥ 목적/상태(strategy) 제거', S, 'let strategy = pickStrategy(context, recordText);\n', 'let strategy: Strategy = "EXPLORE_USER_MEANING";\n'),
 ('⑦ 이어받는 구절 검사 제거', S, 'if (needsLink && (!link || !bridged(ack, askedQ, link))) throw new Error("FOLLOWUP_NOT_LINKED");', ''),
 ('⑧ 새 갈래 다리 검사 제거', S, 'if (newBranch && !ackBridges) throw new Error("FOLLOWUP_NO_BRIDGE");', ''),
 ('⑨ 판정 불허 시 첫 줄만 떼고 내보내기(옛 동작)', S, 'if (!allowed) throw new Error("FOLLOWUP_NOT_COHERENT");', 'if (!allowed) { if (newBranch) question = askedQ; else throw new Error("FOLLOWUP_NOT_COHERENT"); }'),
 ('⑩ 판정 기준에서 앞뒤 연결 문장 제거', S, '가장 먼저 대화의 연결을 본다: evidence.last_question(직전 질문) → evidence.record(사용자의 답) → question 이 한 줄로 이어 읽히는가. 답의 핵심을 받지 않고 관련 없는 주제로 건너뛰어 사용자가 "왜 갑자기 이걸 묻지?" 할 질문은 문법이 맞아도 불허한다. ', ''),
 ('⑪ 화면이 보낸 직전 질문 무시', S, 'const lastQuestion = answeredQuestion ?? (', 'const lastQuestion = (answeredQuestion && null) ?? ('),
 ('⑫ 답-질문 시각 짝짓기 제거(마지막 질문을 그냥 씀)', S, 'const lastQuestion = answeredQuestion ?? (currentAt !== null ? questionFor(askedAt, currentAt, prevAt) : asked[0] ?? null);', 'const lastQuestion = answeredQuestion ?? asked[0] ?? null;'),
 ('⑬ 구제 경로 이어받기 검사 제거', S, 'if (text && linked && ackOk && lightQuestion(q)', 'if (text && lightQuestion(q)'),
 ('⑭ AI 에게 한 질문 판정 제거(서버)', S, 'const asking = isAskingAi(text);', 'const asking = false;'),
 ('⑮ 화면: 직전 질문 안 보냄', C, 'const result = await api.generate(record.id, first ? 1 : undefined, answered);', 'const result = await api.generate(record.id, first ? 1 : undefined);'),
 ('⑯ 화면: AI 에게 한 질문을 답으로 저장', C, 'if (shown && !answeredOverride && (isAskingAi(text) || isMetaReply(text))) {', 'if (shown && !answeredOverride && isMetaReply(text)) {'),
 ('⑰ 대체 문장이 다시 새 주제 고정 질문으로 건너뜀', S, '  candidates.push(STAY_PLAIN, STAY_LAST);', '  candidates.unshift("알겠어요.\\n어떤 사람한테 끌려요?");\n  candidates.push(STAY_PLAIN, STAY_LAST);'),
]
for name,f,a,b in muts:
    src = orig_s if f==S else orig_c
    assert src.count(a)==1,(name,src.count(a))
    open(f,'w').write(src.replace(a,b,1))
    r=subprocess.run(['node','--test',*TESTS],capture_output=True,text=True)
    failed=[re.sub(r'^not ok \d+ - ','',l) for l in r.stdout.splitlines() if l.startswith('not ok')]
    print(f"{name} → 잡은 검사 {len(failed)}개" + (": " + " | ".join(x[:60] for x in failed[:3]) if failed else "  ← 못 잡음"))
    shutil.copy('../du-v144.ts',S); shutil.copy('../cc-v144.tsx',C)
