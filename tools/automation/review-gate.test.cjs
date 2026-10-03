const {test}=require('node:test');
const assert=require('node:assert/strict');
const {check}=require('./review-gate.cjs');
const sha='a'.repeat(40), bot={login:'chatgpt-codex-connector[bot]',type:'Bot'};
function fixture(){return {eventName:'pull_request_review',repository:'founder94/ECHO-MVP-',event:{action:'submitted',review:{id:9,user:bot,commit_id:sha}},pr:{state:'open',draft:false,base:{ref:'echo-qa'},head:{sha,repo:{full_name:'founder94/ECHO-MVP-'}}},reviews:[{id:9,user:bot,commit_id:sha}],comments:[{pull_request_review_id:9,user:bot,commit_id:sha,path:'product/x.ts',line:1,body:'[P1] actual finding'}],issueComments:[{user:{login:'founder94',type:'User'},body:'[ECHO-AUTO-OWNER:actions]'}]};}
test('actual trusted Codex review does not require mention or invented marker',()=>assert.equal(check(fixture()).run,true));
test('untrusted bot rejected',()=>{const x=fixture();x.event.review.user={login:'evil[bot]',type:'Bot'};assert.equal(check(x).run,false)});
test('stale SHA rejected',()=>{const x=fixture();x.pr.head.sha='b'.repeat(40);assert.equal(check(x).reason,'stale_source')});
test('foreign fork rejected',()=>{const x=fixture();x.pr.head.repo.full_name='evil/repo';assert.equal(check(x).run,false)});
test('session owner prevents parallel implementation',()=>{const x=fixture();x.issueComments.push({user:{login:'founder94',type:'User'},body:'[ECHO-AUTO-OWNER:session]'});assert.equal(check(x).run,false)});
test('missing owner fails closed',()=>{const x=fixture();x.issueComments=[];assert.equal(check(x).run,false)});
test('other actor cannot claim ownership',()=>{const x=fixture();x.issueComments[0].user.login='evil';assert.equal(check(x).run,false)});
test('exact trusted claim prevents duplicate',()=>{const x=fixture();x.issueComments.push({user:{login:'github-actions[bot]'},body:check(x).marker});assert.equal(check(x).reason,'duplicate_review')});
test('forged claim cannot suppress review',()=>{const x=fixture();x.issueComments.push({user:{login:'evil'},body:check(x).marker});assert.equal(check(x).run,true)});
test('five handoffs stop loop',()=>{const x=fixture();for(let i=0;i<5;i++)x.issueComments.push({user:{login:'claude[bot]'},body:`<!-- echo-handoff to=codex sha=${sha} round=${i+1} -->`});assert.equal(check(x).reason,'round_limit')});
test('review summary or thumbs up is not finding',()=>{const x=fixture();x.comments=[];assert.equal(check(x).reason,'no_actionable_findings')});
test('other review finding does not trigger',()=>{const x=fixture();x.comments[0].pull_request_review_id=8;assert.equal(check(x).run,false)});
test('review missing from API fails closed',()=>{const x=fixture();x.reviews=[];assert.equal(check(x).reason,'review_not_confirmed')});
