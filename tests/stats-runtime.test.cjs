'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Engine=require('../extension/stats-engine.js');
const mem={},listeners=[],files=new Map();let granted=true,failWrite=false,writeHook=null,corruptRead=false;
const handle={name:'sop',queryPermission:async()=>granted?'granted':'prompt',getDirectoryHandle:async function(){return this;},getFileHandle:async name=>({getFile:async()=>({text:async()=>corruptRead?'truncated':files.get(name)}),createWritable:async()=>({write:async value=>{if(failWrite)throw Error('offline');if(writeHook)await writeHook(value);files.set(name,value);},close:async()=>{},abort:async()=>{}})})};
global.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>listeners.push(f)},onStartup:{addListener:()=>{}}},storage:{local:{get:async key=>{const out={};for(const k of typeof key==='string'?[key]:key)if(mem[k])out[k]=structuredClone(mem[k]);return out;},set:async obj=>Object.assign(mem,structuredClone(obj))}},alarms:{create:async()=>{},clear:async()=>{},onAlarm:{addListener:()=>{}}}};
global.StatsEngine=Engine;global.NASPublisher={getDirectoryHandle:async()=>handle};
const hash='a'.repeat(64);global.CatalogSync={loadSnapshot:async()=>({catalog:{workflows:[{id:'flow',sha256:hash}]}})};
require('../extension/stats-runtime.js');global.SOPStats.registerBackground();
const send=m=>new Promise((resolve,reject)=>{const used=listeners[0](m,{id:'test',url:'chrome-extension://test/workspace.html'},r=>r.error?reject(Error(r.error)):resolve(r.data));if(!used)reject(Error('message ignored'));});
test('actual metrics retain anonymous data, dedupe view refresh, update votes and retry own file only',async()=>{
 const target={workflowId:'flow',revisionHash:hash,version:'1.0.0'};
 await send({type:'stats-view',...target,session:'open-a'});await send({type:'stats-view',...target,session:'open-a'});await send({type:'stats-view',...target,session:'open-b'});
 let value=mem[SOPStats.KEY];assert.equal(value.records[0].views,2);assert.equal('workUrl' in value.records[0],false);
 await send({type:'stats-feedback',...target,vote:'up',note:'可核对的反馈'});await send({type:'stats-feedback',...target,vote:'down',note:'修正后的反馈'});
 assert.equal(Engine.aggregate([mem[SOPStats.KEY]]).workflows.flow.dislikes,1);
 files.set('other-device.json','preserve');await send({type:'stats-configure',enabled:true});assert.equal(files.get('other-device.json'),'preserve');
 const raw=files.get(value.clientId+'.json');assert.equal(Engine.validateSnapshot(JSON.parse(raw)).records[0].views,2);
 granted=false;await send({type:'stats-view',...target,session:'open-c'});await new Promise(r=>setTimeout(r,5));assert.equal(mem[SOPStats.KEY].records[0].views,3);assert.equal(mem[SOPStats.STATUS].state,'pending');
 granted=true;await send({type:'stats-flush'});assert.equal(JSON.parse(files.get(value.clientId+'.json')).records[0].views,3);
 await assert.rejects(send({type:'stats-view',...target,workflowId:'unknown',session:'bad'}));assert.equal(mem[SOPStats.KEY].records[0].views,3);
});

test('flush drains a local revision that arrives during a slow snapshot write',async()=>{
 const target={workflowId:'flow',revisionHash:hash,version:'1.0.0'};
 await send({type:'stats-configure',enabled:true});
 let startedResolve,releaseResolve;
 const started=new Promise(resolve=>{startedResolve=resolve;}),release=new Promise(resolve=>{releaseResolve=resolve;});
 let paused=false;
 writeHook=async()=>{if(paused)return;paused=true;startedResolve();await release;};
 await send({type:'stats-feedback',...target,vote:'up',note:'first'});
 await started;
 await send({type:'stats-feedback',...target,vote:'down',rating:2,note:'arrived while write was pending'});
 releaseResolve();
 for(let i=0;i<50&&mem[SOPStats.STATUS]?.revision<mem[SOPStats.KEY]?.revision;i++)await new Promise(r=>setTimeout(r,10));
 writeHook=null;
 const local=mem[SOPStats.KEY],published=JSON.parse(files.get(local.clientId+'.json'));
 assert.equal(published.revision,local.revision);
 assert.equal(published.records[0].note,'arrived while write was pending');
 assert.equal(published.records[0].rating,2);
});

 test('a successful close with mismatched persisted bytes remains pending until verified retry',async()=>{
  const local=structuredClone(mem[SOPStats.KEY]);
  corruptRead=true;
  try {
   const result=await send({type:'stats-flush'});
   assert.equal(result.state,'pending');
   assert.match(result.message,/回读不一致/);
   assert.deepEqual(mem[SOPStats.KEY],local);
  } finally {corruptRead=false;}
  const result=await send({type:'stats-flush'});
  assert.equal(result.state,'synced');assert.equal(result.revision,local.revision);
 });
