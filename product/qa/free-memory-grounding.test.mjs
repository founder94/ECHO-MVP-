import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; import ts from 'typescript'; import vm from 'node:vm';
const module={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/doit-agent/free-talk.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{module,exports:module.exports,console,Set,Number,Object,Array,JSON,require:n=>n==='./agent.ts'?{parseJson:s=>JSON.parse(s),PRIVATE_DATA:/https?:/,SENSITIVE_TOPIC:/건강|재산/}:{crisisSignal:()=>false}});const F=module.exports;
const known={confirmed:[{key:'user:1',quote:'회사 목표는 500억 원',text:'회사 목표는 500억 원',sensitive:false}],corrected:[],rejected:[{text:'매일 연락을 좋아함'}],guesses:[],forgotten:0};
test('false past memory without a saved citation rejected',()=>{assert.equal(F.parseFree(JSON.stringify({reply:'예전에 회사 목표는 5,000억 원이라고 말씀하셨어요.'}),known),null);});
test('forged source and altered quote rejected',()=>{for(const c of [{key:'other-user',quote:'회사 목표는 500억 원'},{key:'user:1',quote:'회사 목표는 5,000억 원'}])assert.equal(F.parseFree(JSON.stringify({reply:'전에 「'+c.quote+'」라고 말씀하셨어요.',memory_citations:[c]}),known),null);});
test('verified quote cannot hide an extra invented number or decision',()=>{const r=F.parseFree(JSON.stringify({reply:'전에 「회사 목표는 500억 원」이라고 말씀하셨고 최종 목표는 5,000억 원으로 정했어요.',memory_citations:[{key:'user:1',quote:'회사 목표는 500억 원'}]}),known);assert.ok(r.reply.includes('500억'));assert.equal(r.reply.includes('5,000'),false);});
test('rejected meaning not returned as a fact; normal conversation still usable',()=>{assert.equal(F.parseFree(JSON.stringify({reply:'매일 연락을 좋아함이 당신의 특징이에요.'}),known),null);assert.ok(F.parseFree(JSON.stringify({reply:'오늘 이야기부터 편하게 이어가요.'}),known));});
test('a contradictory confirmed copy cannot resurrect a rejected meaning through citation',()=>{const k=structuredClone(known);k.confirmed.push({key:'stale:1',text:'매일 연락을 좋아함',quote:'매일 연락을 좋아함',sensitive:false});assert.equal(F.parseFree(JSON.stringify({reply:'전에 「매일 연락을 좋아함」이라고 말씀하셨어요.',memory_citations:[{key:'stale:1',quote:'매일 연락을 좋아함'}]}),k),null);});
test('citation payload without a past-tense phrase cannot cite a foreign source',()=>{assert.equal(F.parseFree(JSON.stringify({reply:'회사 목표는 5,000억 원이에요.',memory_citations:[{key:'other-user',quote:'회사 목표는 5,000억 원'}]}),known),null);});
test('citation payload without a past-tense phrase cannot alter a stored amount',()=>{assert.equal(F.parseFree(JSON.stringify({reply:'회사 목표는 5,000억 원이에요.',memory_citations:[{key:'user:1',quote:'회사 목표는 5,000억 원'}]}),known),null);});
test('citation payload cannot launder an invented decision by avoiding a memory phrase',()=>{const r=F.parseFree(JSON.stringify({reply:'「회사 목표는 500억 원」이고 최종 목표는 5,000억 원이에요.',memory_citations:[{key:'user:1',quote:'회사 목표는 500억 원'}]}),known);assert.ok(r);assert.equal(r.reply.includes('5,000'),false);assert.ok(r.reply.includes('500억'));});
test('explicit malformed or empty citation payload is rejected even without a memory phrase',()=>{for(const memory_citations of [null,[],{},'user:1'])assert.equal(F.parseFree(JSON.stringify({reply:'회사 목표는 5,000억 원이에요.',memory_citations}),known),null);});
// 2026-10-10 Codex P2(4236681722): 「~를 기억해 두면」 같은 보통 조언은 기억 주장이 아니다(인용 없어도 통과) · ECHO 의 1인칭 기억 주장은 인용 필요
test('ordinary advice with 기억해 is not a memory claim; first-person claims still need citations',()=>{
 assert.ok(F.parseFree(JSON.stringify({reply:'오늘 느낀 편안함을 기억해 두면 다음 만남에도 도움이 돼요.'}),known));
 // 2026-10-10 Codex P2(4237121062): 꾸밈 없는 「기억해요」 권유도 기억 주장이 아니다
 for(const r of ['오늘 느낀 편안함을 기억해요. 다음 만남에도 도움이 돼요.','좋았던 순간을 기억해요.','오늘 이야기한 것을 기억해 두세요.']) assert.ok(F.parseFree(JSON.stringify({reply:r}),known),r);
 assert.equal(F.parseFree(JSON.stringify({reply:'산책 좋아하신다고 하셨던 거 기억나요.'}),known),null);
 assert.ok(F.parseFree(JSON.stringify({reply:'그 마음을 기억하는 것만으로도 충분해요.'}),known));
 for(const r of ['말씀하신 산책 얘기 기억해요.','제가 기억하기로는 주말을 좋아하셨어요.','그 얘기 기억하고 있어요.']) assert.equal(F.parseFree(JSON.stringify({reply:r}),known),null,r);
});
// 2026-10-10 Codex P1(4237313916): 맨 「했어요」·옮겨 말하기(「~다고 했어요/하셨죠」)도 지난 말 주장 → 인용 없으면 거절. 이번 차례·보통 문장은 그대로.
test('bare 했어요 and reported-speech memory claims need a citation',()=>{
 for(const r of ['지난번에는 매일 연락이 좋다고 했어요.','저번에 산책이 좋다고 하셨죠.','주말이 편하다고 했어요.','전에 회사 목표를 500억이라고 적으셨어요.','어제 그 얘기 했잖아요.','지금까지 주말이 좋다고 했어요.']) assert.equal(F.parseFree(JSON.stringify({reply:r}),known),null,r);
 for(const r of ['방금 피곤하다고 했어요. 오늘은 쉬어 가요.','좋다고 하는 사람도 많아요.','오늘 이야기부터 편하게 이어가요.','그렇게 느끼는 건 자연스러워요.']) assert.ok(F.parseFree(JSON.stringify({reply:r}),known),r);
});
