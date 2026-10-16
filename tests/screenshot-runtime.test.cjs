'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const key='runtime-sop-recorder-v1',mem={},listeners=[];
let tab={id:7,windowId:3,active:true,url:'https://other.test/unrelated'},captureFailure=false,switchDuring=false;
const image='data:image/jpeg;base64,/9j/4AA=',event={addListener:()=>{}};
global.chrome={scripting:{},runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>listeners.push(f)}},storage:{local:{get:async k=>({[k]:structuredClone(mem[k])}),set:async v=>Object.assign(mem,structuredClone(v))}},tabs:{query:async()=>[structuredClone(tab)],captureVisibleTab:async windowId=>{assert.equal(windowId,3);if(captureFailure)throw Error('activeTab required');if(switchDuring)tab.id=8;return image;},onActivated:event,onUpdated:event,onRemoved:event}};
require('../extension/recorder-runtime.js').registerBackground();
const send=m=>new Promise((resolve,reject)=>listeners[0](m,{id:'test',url:'chrome-extension://test/workspace.html'},r=>r.error?reject(Error(r.error)):resolve(r.data)));
const seed=()=>{mem[key]={drafts:[{id:'draft',title:'Test',origin:'https://work.test',status:'draft',createdAt:'',updatedAt:'',steps:[{id:'step',type:'manual',title:'Step',url:'https://work.test/a',workUrl:'https://work.test/a?q=1#x',where:'',action:'Do',expected:'',acceptance:'',trouble:'',at:'',image,imageMarks:[{type:'number',x:.1,y:.2}]}]}],session:null};};
test('capture any active page independent of routing, retain old image on denial or tab change',async()=>{
 await send({type:'recorder-get'});
 for(const url of ['https://other.test/unrelated','http://nas.example/files','file:///test/example.html','chrome://extensions/']){
  seed();tab.url=url;await send({type:'recorder-shot',draftId:'draft',stepId:'step',tabId:999});
  const step=mem[key].drafts[0].steps[0];assert.equal(step.image,image);assert(step.imageAt);assert.equal(step.imageMarks,undefined);assert.equal(step.workUrl,'https://work.test/a?q=1#x');
 }
 seed();mem[key].drafts[0].status='paused';mem[key].session={draftId:'draft',tabId:99,origin:'https://work.test',status:'paused',token:'token'};await send({type:'recorder-shot',draftId:'draft',stepId:'step'});assert(mem[key].drafts[0].steps[0].imageAt);
 seed();const before=JSON.stringify(mem[key]);captureFailure=true;await assert.rejects(send({type:'recorder-shot',draftId:'draft',stepId:'step'}),/插件图标/);assert.equal(JSON.stringify(mem[key]),before);captureFailure=false;
 switchDuring=true;await assert.rejects(send({type:'recorder-shot',draftId:'draft',stepId:'step'}),/页面发生变化/);assert.equal(JSON.stringify(mem[key]),before);switchDuring=false;
 await assert.rejects(send({type:'recorder-shot',draftId:'draft',stepId:'missing'}),/选择/);
});
