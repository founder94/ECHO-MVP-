import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
test('CSP-safe font loader keeps slow fonts nonblocking and activates cached/loaded sheets',()=>{
  const delayed={media:'print',sheet:null,addEventListener(name,fn){this[name]=fn;}};
  const cached={media:'print',sheet:{},addEventListener(name,fn){this[name]=fn;}};
  vm.runInNewContext(readFileSync('public/font-styles.js','utf8'),{document:{querySelectorAll:()=>[delayed,cached]}});
  assert.equal(delayed.media,'print');assert.equal(cached.media,'all');
  delayed.load();assert.equal(delayed.media,'all');
});
