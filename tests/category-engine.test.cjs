'use strict';
const assert=require('node:assert/strict');
const C=require('../extension/category-engine.js');
const now='2026-10-15T00:00:00.000Z';
const base=()=>({...C.empty(),updatedAt:now});
const cat=(id,name=id,parentId=null)=>({id,name,color:'blue',icon:'folder',parentId});
let data=C.upsert(base(),cat('team','团队'));
assert.equal(data.revision,1);assert.equal(data.categories[0].id,'team');
data=C.assign(data,'youtube-upload','team');assert.equal(C.find(data,{workflowId:'youtube-upload'}).name,'团队');
data=C.upsert(data,cat('media','媒体','team'));
assert.throws(()=>C.remove(data,'team'),/子分类/);
assert.throws(()=>C.upsert(data,cat('team','团队','media')),/循环/);
assert.throws(()=>C.assign(data,'youtube-upload','missing'),/不存在/);
assert.throws(()=>C.remove(data,'team'),/子分类/);
data=C.assign(data,'youtube-upload',null);data=C.remove(data,'media');data=C.remove(data,'team');
assert.equal(data.categories.length,0);assert.deepEqual(data.assignments,{});
for(const bad of [
 {...base(),format:'wrong'},
 {...base(),categories:[cat('x','') ]},
 {...base(),categories:[cat('x','x'),cat('x','dupe')]},
 {...base(),categories:[cat('x','x','missing')]},
 {...base(),categories:[cat('x','x','x')]},
 {...base(),categories:[{...cat('x','x'),color:'cyan'}]},
 {...base(),categories:[{...cat('x','x'),icon:'script'}]},
 {...base(),categories:[cat('x','x')],assignments:{wf:'missing'}},
 {...base(),categories:[cat('x','x')],extra:true}
])assert.throws(()=>C.validate(bad));
assert.throws(()=>C.upsert({...base(),categories:Array.from({length:500},(_,i)=>cat('c'+i,'x'))},cat('new','N')),/500/);
assert.equal(C.find(base(),'none'),null);
console.log('Category engine tests passed: validation, stable IDs, assignment, hierarchy, cycles, and empty-only removal.');
