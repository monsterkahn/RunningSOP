(function(root){
'use strict';
const KEY='runtime-sop-statistics-v1',SETTINGS='runtime-sop-statistics-settings-v1',STATUS='runtime-sop-statistics-status-v1',ALARM='runtime-sop-statistics-flush-v1';
let queue=Promise.resolve(),flushPromise=null,flushAgain=false;const seen=new Set();
async function directory(write){
 if(typeof indexedDB==='undefined')return NASPublisher.getDirectoryHandle();
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('runtime-sop-statistics-directory-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('directory');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 return new Promise((resolve,reject)=>{const tx=db.transaction('directory',write?'readwrite':'readonly'),store=tx.objectStore('directory');let value;if(write)store.put(write,'handle');else{const r=store.get('handle');r.onsuccess=()=>{value=r.result;};}tx.oncomplete=()=>{db.close();resolve(write||value||null);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error);};});
}
const run=fn=>{const next=queue.catch(()=>{}).then(fn);queue=next;return next;};
function fresh(){return {format:'runtime-sop-statistics',schemaVersion:1,clientId:crypto.randomUUID(),revision:0,updatedAt:new Date().toISOString(),records:[]};}
async function state(){const value=(await chrome.storage.local.get(KEY))[KEY];return value?StatsEngine.validateSnapshot(value):fresh();}
async function info(){const data=await chrome.storage.local.get([SETTINGS,STATUS,KEY]);const status=data[STATUS];if(data[SETTINGS]?.enabled&&data[KEY]&&status?.state==='synced'&&status.revision<data[KEY].revision)status.message='本机有新统计，等待自动同步。';return {settings:data[SETTINGS]||{enabled:false},status:status||{state:'local',message:'统计暂存本机，尚未连接 存储器。'},snapshot:data[KEY]?StatsEngine.validateSnapshot(data[KEY]):null};}
async function identity(message){const snapshot=await CatalogSync.loadSnapshot(),workflow=snapshot?.catalog.workflows.find(w=>w.id===message.workflowId&&w.sha256===message.revisionHash);if(!workflow)throw Error('统计目标不在当前已验证目录中。');return workflow;}
async function mutate(message){
 return run(async()=>{
  const workflow=await identity(message);let token=null;if(message.type==='stats-view'){if(typeof message.session!=='string'||message.session.length>100)throw Error('查看会话无效。');const session=message.session+'|'+workflow.id+'|'+workflow.sha256;if(seen.has(session))return info();token=session;}
  const s=await state(),stamp=new Date().toISOString();let record=s.records.find(r=>r.workflowId===workflow.id&&r.revisionHash===workflow.sha256);
  if(!record){record={workflowId:workflow.id,revisionHash:workflow.sha256,version:String(message.version||'').slice(0,80),views:0,lastViewedAt:null,vote:null,note:'',feedbackAt:null};s.records.push(record);}
  if(message.type==='stats-view'){record.views++;record.lastViewedAt=stamp;}
  else{if(![null,'up','down'].includes(message.vote)||typeof message.note!=='string'||message.note.length>10000)throw Error('评价或反馈内容无效。');if(message.rating!==undefined){if(message.rating!==null&&(!Number.isInteger(message.rating)||message.rating<1||message.rating>5))throw Error('评分必须在 1 到 5 之间。');record.rating=message.rating;}record.vote=message.vote;record.note=message.note;record.feedbackAt=stamp;}
  s.revision++;s.updatedAt=stamp;await chrome.storage.local.set({[KEY]:StatsEngine.validateSnapshot(s)});if(token){if(seen.size>=10000)seen.clear();seen.add(token);}flush().catch(()=>{});return info();
 });
}
async function flush(){
 if(flushPromise){flushAgain=true;return flushPromise;}
 flushPromise=(async()=>{
  let acknowledged=null;
  try{
   const data=await info();if(!data.settings.enabled||!data.snapshot)return data.status;
   const rootHandle=await directory();if(!rootHandle||await rootHandle.queryPermission({mode:'readwrite'})!=='granted')throw Error('请在设置中连接统计文件夹并允许写入。');
   const dir=await rootHandle.getDirectoryHandle('statistics',{create:true}),clients=await dir.getDirectoryHandle('clients',{create:true});
   // Keep each device file write single-flight, then drain newer local revisions a few
   // times. A continuing stream of edits falls back to the existing periodic alarm.
   for(let attempt=0;attempt<4;attempt++){
    const snapshot=await state();
    if(!snapshot)break;
    const file=await clients.getFileHandle(snapshot.clientId+'.json',{create:true}),writer=await file.createWritable({keepExistingData:false});
    const raw=JSON.stringify(snapshot,null,2)+'\n';
    try{await writer.write(raw);await writer.close();}catch(e){try{await writer.abort();}catch(_){}throw e;}
    if(await (await file.getFile()).text()!==raw)throw Error('统计文件写入后回读不一致，尚未确认同步。');
    acknowledged=snapshot.revision;
    const currentRevision=(await state()).revision;
    if(currentRevision<=acknowledged&&!flushAgain)break;
    if(attempt<3)flushAgain=false;
    else flushAgain=true;
   }
   const status={state:'synced',revision:acknowledged,syncedAt:new Date().toISOString(),message:'本机统计已同步到 存储器。'};await chrome.storage.local.set({[STATUS]:status});return status;
  }catch(e){const status={state:'pending',message:'统计保留在本机，等待同步：'+e.message};await chrome.storage.local.set({[STATUS]:status});return status;}
 })().finally(()=>{const retry=flushAgain;flushAgain=false;flushPromise=null;if(retry)setTimeout(()=>flush().catch(()=>{}),1000);});return flushPromise;
}
async function configure(enabled){await chrome.storage.local.set({[SETTINGS]:{enabled:enabled===true}});if(enabled){const local=await chrome.storage.local.get(KEY);if(!local[KEY])await chrome.storage.local.set({[KEY]:fresh()});await chrome.alarms.create(ALARM,{periodInMinutes:1});return flush();}await chrome.alarms.clear(ALARM);const status={state:'local',message:'统计同步已关闭；已同步到 存储器 的文件仍保留。'};await chrome.storage.local.set({[STATUS]:status});return status;}
async function request(type,args={}){const reply=await chrome.runtime.sendMessage({type,...args});if(reply?.error)throw Error(reply.error);return reply.data;}
function registerBackground(){
 chrome.runtime.onMessage.addListener((m,sender,sendResponse)=>{if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL(''))||!m?.type?.startsWith('stats-'))return;
  let promise;if(['stats-view','stats-feedback'].includes(m.type))promise=mutate(m);else if(m.type==='stats-get')promise=info();else if(m.type==='stats-configure')promise=configure(m.enabled);else if(m.type==='stats-flush')promise=flush();else return;
  promise.then(data=>sendResponse({data}),e=>sendResponse({error:e.message}));return true;
 });
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)flush().catch(console.error);});
 const start=async()=>{if((await info()).settings.enabled){await chrome.alarms.create(ALARM,{periodInMinutes:1});await flush();}};
 chrome.runtime.onStartup.addListener(()=>start().catch(console.error));start().catch(console.error);
}
root.SOPStats={KEY,SETTINGS,STATUS,info,flush,registerBackground,request,trackView:m=>request('stats-view',m),feedback:m=>request('stats-feedback',m),connect:async()=>{await NASPublisher.chooseDirectory();await directory(await NASPublisher.getDirectoryHandle());return request('stats-configure',{enabled:true});},disconnect:()=>request('stats-configure',{enabled:false})};
})(typeof globalThis!=='undefined'?globalThis:this);
