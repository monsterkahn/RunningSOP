'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const KEY='runtime-sop-team-settings-v1';
const source=fs.readFileSync(path.join(__dirname,'../extension/team-settings.js'),'utf8');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function record(endpoint,actorId){return {enabled:true,endpoint,token:'synthetic-'+actorId,actor:{id:actorId,name:'Synthetic'},protocolVersion:1};}
function harness(gates){
 const nodes=new Map(),storageListeners=[];let reads=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',hidden:false,disabled:false,dataset:{},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});return nodes.get(id);};
 const form=node('team-connect-form');form.reportValidity=()=>true;
 const document={readyState:'complete',getElementById:node,querySelectorAll:()=>[],addEventListener(){}};
 const db={close(){},transaction(){const tx={};tx.objectStore=()=>({get(){const index=reads++,request={};gates[index].promise.then(value=>{request.result=value;request.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());},()=>queueMicrotask(()=>tx.onerror?.()));return request;}});return tx;}};
 const indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess?.());return request;}};
 const chrome={storage:{onChanged:{addListener(fn){storageListeners.push(fn);}}}};
 const context=vm.createContext({document,indexedDB,chrome,URL,queueMicrotask});
 vm.runInContext(source,context,{filename:'extension/team-settings.js'});
 return {nodes,form,storageListeners,get reads(){return reads;},fireChange(){for(const fn of storageListeners)fn({[KEY]:{newValue:{enabled:true}}},'local');}};
}
async function waitFor(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('Timed out waiting for settings UI state.');}

test('a late initial settings read cannot replace the newer storage-event account',async()=>{
 const older=deferred(),newer=deferred(),ui=harness([older,newer]);
 await waitFor(()=>ui.reads===1);
 ui.fireChange();
 await waitFor(()=>ui.reads===2);
 newer.resolve(record('https://b.example.test','actor-b'));
 await waitFor(()=>ui.nodes.get('team-status')?.textContent.includes('https://b.example.test'));
 older.resolve(record('https://a.example.test','actor-a'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(ui.nodes.get('team-status').textContent,/https:\/\/b\.example\.test/);
});

test('a failed settings read is handled and shown without an unhandled rejection',async()=>{
 const failed=deferred(),ui=harness([failed]);
 await waitFor(()=>ui.reads===1);
 failed.reject(Error('synthetic storage failure'));
 await waitFor(()=>ui.nodes.get('team-status')?.textContent.includes('Connection failed'));
 assert.match(ui.nodes.get('team-status').textContent,/Connection failed/);
});
