import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {canEditBrunch,createBrunchStore,validateBrunch} from './brunch.js';
const allowed={username:'0634545837',role:'superadmin'};
test('only the specified superadmin can edit',()=>{
  assert.equal(canEditBrunch(allowed),true);
  for(const admin of [null,{...allowed,role:'admin'},{...allowed,role:'employee'},{...allowed,username:'superadmin'},{...allowed,role:'hyperadmin'}])assert.equal(canEditBrunch(admin),false);
});
test('save persists, audits and rejects stale changes or unauthorized writes',()=>{
  const db=new DatabaseSync(':memory:'),store=createBrunchStore(db),initial=store.read();
  const next=structuredClone(initial.brunch);next.items[0][2]=24.5;
  assert.throws(()=>store.save({...allowed,username:'other'},next,0),{status:403});
  assert.equal(store.read().revision,0);
  store.save(allowed,next,0);
  assert.equal(createBrunchStore(db).read().brunch.items[0][2],24.5);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM public_brunch_history').get().n,1);
  assert.throws(()=>store.save(allowed,next,0),{status:409});
  assert.equal(store.read().revision,1);
  assert.equal(store.read().updatedBy,undefined);
  db.close();
});
test('reject invalid payloads',()=>{
  for(const value of [null,{}, {notice:['',''],items:[]},{notice:['',''],items:[['A','B',-1,'','']]},{notice:['',''],items:[['A','B',NaN,'','']]},{notice:['',''],items:[['','B',10,'','']]}])assert.throws(()=>validateBrunch(value));
});
