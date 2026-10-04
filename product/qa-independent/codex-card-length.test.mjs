import test from 'node:test';
import assert from 'node:assert/strict';
import {maskPii} from '../supabase/functions/doit-agent/modelRouter.ts';
test('non-16-digit synthetic card is completely masked as a card',()=>{
 const x=maskPii({latest:'카드 378282246310005 로 결제했어요'});
 assert.equal(x.counts.card,1,'15-digit test card is not recognized');
 assert.doesNotMatch(JSON.stringify(x.value),/\d/,'card digit suffix or prefix remains');
});
test('ordinary short numbers remain unchanged',()=>{
 const x=maskPii({latest:'주말에 2번, 3시간 정도 만나요'});assert.deepEqual(x.counts,{});assert.equal(x.value.latest,'주말에 2번, 3시간 정도 만나요');
});

