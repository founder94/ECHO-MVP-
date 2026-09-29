import subprocess, os, re
SRV='supabase/functions/doit-understanding/index.ts'
RULES='src/doit/lib/conversationRules.ts'
TESTS=['qa/conversation-v15.test.mjs','qa/conversation-rules.test.mjs','qa/server-conversation-flow.test.mjs']
M=[
 ('D1 상태 관문 없앰(다섯 칸 뒤에도 AI 호출)', [SRV], '      if (await roundFinished(admin, userId, roundStartOf(user))) return json({ ok: true, question: null, duplicate: false, finished: true }, 200, origin);\n', ''),
 ('D2 "왜" 연속 허용', [SRV], '  if (/왜/.test(body) && !!input.lastQuestion && /왜/.test(questionBody(input.lastQuestion))) return { reason: "why_chain", question: q };\n', ''),
 ('D3 판정 AI 에서 목적·톤 관문 문장 빼기', [SRV], ' 목적 관문: 질문은 사용자가 원하는 만남(purpose)에 맞는 상대를 고르는 데 필요한 것(원하는 사람·같이 하고 싶은 것·만나는 방식·상대가 알면 좋을 나)을 알아가는 방향이어야 하며, 그것과 무관한 잡담·정보 확인·진단은 불허한다.', ''),
 ('D4 질문 말투에서 톤 고정 문장 빼기', [SRV], " 톤은 가볍게·짧게·심플하게, 한 번에 하나만 묻는다(대표 확정 2026-09-24):", ''),
 ('D5 분류 규칙을 예전처럼 넓게("같은 거")', [RULES,SRV], '  /(같은|똑같은|비슷한)\\s*질문/,', '  /(같은|똑같은|비슷한)\\s*(질문|말|얘기|걸|거)/,'),
 ('D6 분류 규칙을 예전처럼 넓게("지쳐" 어디서나)', [RULES,SRV], '  /(대답|답|답장|쓰기|적기|말하기|이거|질문에)\\s*(하기)?\\s*싫/,', '  /(지쳤|지친다|지쳐|피곤해|귀찮|하기\\s*싫|답하기\\s*싫|쓰기\\s*싫)/,'),
 ('D7 예전 앱 이해 후보: 저장된 거절 무시(B5 재검)', [SRV], '      mergeRejected(rejected, await rejectedTurns(admin, userId)); // v15.1 대화 중 거절도 이해 후보에서 막는다(예전 앱 경로)', ''),
 ('D8 소개 초안: 저장된 거절 무시(B6 재검)', [SRV], '      mergeRejected(rejected, await rejectedTurns(admin, userId)); // v15.1 대화 중 거절한 문장은 소개에도 쓰지 않는다', ''),
]
def run():
    out=subprocess.run(['node','--test',*TESTS],capture_output=True,text=True,env={**os.environ,'NODE_PATH':'../tools/node_modules'}).stdout
    return [l.split(' - ',1)[-1][:70] for l in out.splitlines() if l.startswith('not ok') and '# TODO' not in l]
base=run(); assert not base, base
for name,paths,old,new in M:
    saved={p:open(p).read() for p in paths}
    for p in paths:
        s=saved[p]; assert s.count(old)==1,(name,p,s.count(old)); open(p,'w').write(s.replace(old,new))
    try: f=run()
    finally:
        for p,c in saved.items(): open(p,'w').write(c)
    print(f"{name} → 잡은 검사 {len(f)}개" + ("  ← 못 잡음" if not f else "") + (": " + " | ".join(f[:2]) if f else ""), flush=True)
print('RESTORED')
