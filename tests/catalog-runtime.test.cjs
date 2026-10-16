'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const engineSource=fs.readFileSync(path.join(__dirname,'../extension/catalog-engine.js'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'../extension/catalog-runtime.js'),'utf8');
const assetsSource=fs.readFileSync(path.join(__dirname,'../extension/sop-assets.js'),'utf8');

const ENDPOINT_A='file:///test/sop/catalog.json';
const ENDPOINT_B='file:///other/sop/catalog.json';
const bytesHash=async text=>Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
function guide(id='guide-one',version='1'){
  return {format:'runtime-sop-guide',schemaVersion:1,workflowId:id,title:'Guide',version,notice:'',steps:[{id:'step-one',title:'Step',where:'Page',actions:['Review'],expected:'Done',trouble:'',acceptance:['Confirm']}]};
}
function guideWithImages(id,count){
  const image='data:image/jpeg;base64,/9j/'+ 'A'.repeat(273060);
  return {format:'runtime-sop-guide',schemaVersion:1,workflowId:id,title:'Guide',version:'1',notice:'',steps:Array.from({length:count},(_,index)=>({id:'step-'+index,title:'Step',where:'Page',actions:['Review'],expected:'Done',trouble:'',acceptance:['Confirm'],image}))};
}
async function pack(workflowId='guide-one',raw=JSON.stringify(guide(workflowId)),opts={}){
  const id=opts.catalogId||workflowId;
  const wf={id,title:id,summary:'',status:'published',viewer:opts.viewer||'guide',file:'contents/'+id+'.json',sha256:opts.hash||await bytesHash(raw),rules:[{hosts:['example.com'],priority:5,label:'example'}]};
  const catalog={format:'runtime-sop-catalog',schemaVersion:1,version:opts.catalogVersion||'1',workflows:[wf]};
  return {catalog,rawCatalog:JSON.stringify(catalog),rawContents:{[id]:raw},workflow:wf};
}
function response(value){return {ok:true,status:200,headers:{get:()=>null},body:null,text:async()=>typeof value==='string'?value:new TextDecoder().decode(value),arrayBuffer:async()=>typeof value==='string'?new TextEncoder().encode(value).buffer:value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)};}
function boot(routes,settings={endpoint:ENDPOINT_A,enabled:true},seed={}){
  const data={...structuredClone(seed)},writes={},fetches={},alarmsCreated=[],alarmsCleared=[];
  if(settings!==null&&settings!==undefined)data['runtime-sop-catalog-settings-v1']=settings;
  const listeners={alarms:[],startup:[],installed:[],messages:[]};
  const chrome={
    runtime:{id:'test-extension',getURL:path=>'chrome-extension://test-extension/'+path,onStartup:{addListener:f=>listeners.startup.push(f)},onInstalled:{addListener:f=>listeners.installed.push(f)},onMessage:{addListener:f=>listeners.messages.push(f)}},
    storage:{local:{async get(keys){const names=Array.isArray(keys)?keys:[keys];return Object.fromEntries(names.filter(k=>Object.hasOwn(data,k)).map(k=>[k,structuredClone(data[k])]));},async set(entries){for(const [key,value]of Object.entries(entries)){data[key]=structuredClone(value);writes[key]=(writes[key]||0)+1;}},async remove(keys){for(const key of keys)delete data[key];}}},
    extension:{isAllowedFileSchemeAccess:async()=>true},
    alarms:{onAlarm:{addListener:f=>listeners.alarms.push(f)},create:async(...args)=>alarmsCreated.push(args),clear:async(...args)=>{alarmsCleared.push(args);return true;}},
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}}
  };
  const fetch=async url=>{fetches[url]=(fetches[url]||0)+1;if(!Object.hasOwn(routes,url))throw Error('missing fixture '+url);return response(typeof routes[url]==='function'?await routes[url]():routes[url]);};
  const context={chrome,SOPSync:{verify:async input=>input},fetch,crypto:webcrypto,TextEncoder,TextDecoder,URL,AbortController,setTimeout,clearTimeout,Date,console,atob,btoa};
  vm.runInNewContext(assetsSource,context,{filename:'sop-assets.js'});
  vm.runInNewContext(engineSource,context,{filename:'catalog-engine.js'});
  vm.runInNewContext(source,context,{filename:'catalog-runtime.js'});
  context.CatalogSync.registerBackground();
  async function message(type,settings){
    const listener=listeners.messages[0];
    return new Promise((resolve,reject)=>{
      const async=listener({type,settings},{id:'test-extension',url:'chrome-extension://test-extension/sidepanel.html'},result=>resolve(result));
      if(!async)reject(Error('message was not accepted'));
    });
  }
  return {context,data,writes,fetches,listeners,message,alarmsCreated,alarmsCleared};
}
function routesFor(endpoint,packed){
  const routes={[endpoint]:packed.rawCatalog};
  routes[new URL(packed.workflow.file,endpoint.slice(0,endpoint.lastIndexOf('/')+1)).href]=packed.rawContents[packed.workflow.id];
  return routes;
}

test('catalog check reads only directory and requested workflow is loaded on demand',async()=>{
 const good=await pack(),routes=routesFor(ENDPOINT_A,good),app=boot(routes);
 await app.message('catalog-check');
 const bodyURL=new URL(good.workflow.file,ENDPOINT_A.slice(0,ENDPOINT_A.lastIndexOf('/')+1)).href;
 assert.equal(app.fetches[ENDPOINT_A],1);assert.equal(app.fetches[bodyURL],undefined);
 assert.deepEqual(app.data[app.context.CatalogSync.CACHE].rawContents,{});
 const loaded=await app.context.CatalogSync.loadWorkflow('guide-one');
 assert.equal(loaded.workflowId,'guide-one');assert.equal(app.fetches[bodyURL],1);
 assert.ok(app.data[app.context.CatalogSync.CACHE].rawContents['guide-one']);
});

test('bad requested body SHA is rejected and never cached for display',async()=>{
 const good=await pack('guide-one',JSON.stringify(guide()),{hash:'f'.repeat(64)}),app=boot(routesFor(ENDPOINT_A,good));
 await app.message('catalog-check');
 await assert.rejects(app.context.CatalogSync.loadWorkflow('guide-one'),/SHA-256/);
 assert.deepEqual(app.data[app.context.CatalogSync.CACHE].rawContents,{});
});

test('simultaneous requests for the same workflow share one body fetch',async()=>{
 const good=await pack(),routes=routesFor(ENDPOINT_A,good),app=boot(routes);
 await app.message('catalog-check');
 const bodyURL=new URL(good.workflow.file,ENDPOINT_A.slice(0,ENDPOINT_A.lastIndexOf('/')+1)).href;
 const [a,b]=await Promise.all([app.context.CatalogSync.loadWorkflow('guide-one'),app.context.CatalogSync.loadWorkflow('guide-one')]);
 assert.equal(a.workflowId,b.workflowId);assert.equal(app.fetches[bodyURL],1);
});

test('catalog refresh preserves unchanged cached bodies and drops changed SHA bodies',async()=>{
 const first=await pack(),routes=routesFor(ENDPOINT_A,first),app=boot(routes);
 await app.message('catalog-check');await app.context.CatalogSync.loadWorkflow('guide-one');
 const bodyURL=new URL(first.workflow.file,ENDPOINT_A.slice(0,ENDPOINT_A.lastIndexOf('/')+1)).href;
 const updated=await pack('guide-one',JSON.stringify(guide('guide-one','2')),{catalogVersion:'2'});
 routes[ENDPOINT_A]=updated.rawCatalog;routes[bodyURL]=updated.rawContents['guide-one'];
 await app.message('catalog-check');
 assert.deepEqual(app.data[app.context.CatalogSync.CACHE].rawContents,{});
 assert.equal(app.fetches[bodyURL],1,'checking directory must not fetch changed body');
 assert.equal((await app.context.CatalogSync.loadWorkflow('guide-one')).version,'2');
 assert.equal(app.fetches[bodyURL],2);
});

test('fresh install stays disabled with no endpoint, directory fetch, or sync alarm',async()=>{
 const app=boot({},null);
 assert.deepEqual({...await app.context.CatalogSync.getSettings()},{enabled:false,endpoint:''});
 assert.deepEqual({...((await app.context.CatalogSync.info()).settings)},{enabled:false,endpoint:''});
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.deepEqual(app.fetches,{});
 assert.equal(app.alarmsCreated.length,0);
 assert.ok(app.alarmsCleared.length>=1);
});

test('a corrupt cached body does not make other cached workflows unavailable',async()=>{
 const raws={alpha:JSON.stringify(guide('alpha')),beta:JSON.stringify(guide('beta'))},workflows=[];
 for(const [id,raw]of Object.entries(raws))workflows.push({id,title:id,summary:'',status:'published',viewer:'guide',file:`workflows/${id}/document.json`,sha256:await bytesHash(raw),rules:[{hosts:['example.com'],priority:1,label:id}]});
 const catalog={format:'runtime-sop-catalog',schemaVersion:1,version:'1',workflows},rawCatalog=JSON.stringify(catalog),routes={[ENDPOINT_A]:rawCatalog};
 const urls={};for(const workflow of workflows){urls[workflow.id]=new URL(workflow.file,ENDPOINT_A.slice(0,ENDPOINT_A.lastIndexOf('/')+1)).href;routes[urls[workflow.id]]=raws[workflow.id];}
 const first=boot(routes);await first.message('catalog-check');await first.context.CatalogSync.loadWorkflow('alpha');await first.context.CatalogSync.loadWorkflow('beta');
 first.data[first.context.CatalogSync.CACHE].rawContents.alpha='damaged cached bytes';
 const restarted=boot(routes,{endpoint:ENDPOINT_A,enabled:true},first.data),partial=await restarted.context.CatalogSync.loadSnapshot();
 assert.ok(partial.catalog);assert.equal(partial.contents.alpha,undefined);
 assert.equal((await restarted.context.CatalogSync.loadWorkflow('beta')).workflowId,'beta');
 assert.equal(restarted.fetches[urls.beta],undefined,'the other verified cached workflow remains available');
 assert.equal((await restarted.context.CatalogSync.loadWorkflow('alpha')).workflowId,'alpha');
 assert.equal(restarted.fetches[urls.alpha],1,'only the requested corrupt workflow is reloaded');
});

test('requested document hydrates its image from a safe catalog-relative asset URL',async()=>{
 const id='guide-one',workflow={id,title:id,summary:'',status:'published',viewer:'guide',file:'workflows/guide-one/document.json',sha256:'',rules:[{hosts:['example.com'],priority:5,label:'example'}]};
 const imageBytes=new Uint8Array([255,216,255]),assetHash=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',imageBytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const document={format:'runtime-sop-document',schemaVersion:1,workflowId:id,viewer:'guide',content:{format:'runtime-sop-guide',schemaVersion:1,workflowId:id,title:'Guide',version:'1',notice:'',steps:[{id:'step-one',title:'Step',where:'Page',actions:['Review'],expected:'Done',trouble:'',acceptance:['Confirm'],image:null}]},assets:[{path:'/steps/0/image',file:`workflows/${id}/images/${assetHash}.jpg`,sha256:assetHash,mimeType:'image/jpeg',size:imageBytes.length}]};
 const raw=JSON.stringify(document);workflow.sha256=await bytesHash(raw);const catalog={format:'runtime-sop-catalog',schemaVersion:1,version:'1',workflows:[workflow]},rawCatalog=JSON.stringify(catalog);
 const bodyURL=new URL(workflow.file,ENDPOINT_A.slice(0,ENDPOINT_A.lastIndexOf('/')+1)).href,assetURL=new URL(document.assets[0].file,ENDPOINT_A.slice(0,ENDPOINT_A.lastIndexOf('/')+1)).href;
 const app=boot({[ENDPOINT_A]:rawCatalog,[bodyURL]:raw,[assetURL]:imageBytes});
 await app.message('catalog-check');assert.equal(app.fetches[bodyURL],undefined);assert.equal(app.fetches[assetURL],undefined);
 const loaded=await app.context.CatalogSync.loadWorkflow(id);
 assert.match(loaded.steps[0].image,/^data:image\/jpeg;base64,/);assert.equal(app.fetches[assetURL],1);
 const restarted=boot({}, {endpoint:ENDPOINT_A,enabled:true},app.data),offline=await restarted.context.CatalogSync.loadWorkflow(id);
 assert.match(offline.steps[0].image,/^data:image\/jpeg;base64,/);
 assert.equal(restarted.fetches[bodyURL],undefined,'restart must use the cached verified body');
 assert.equal(restarted.fetches[assetURL],undefined,'restart must use persisted verified image bytes');
});

test('source switch does not reuse a pending workflow from the old source',async()=>{
 const old=await pack('guide-one',JSON.stringify(guide('guide-one','old')));
 const next=await pack('guide-one',JSON.stringify(guide('guide-one','new')));
 let release,started;const blocked=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
 const routes={...routesFor(ENDPOINT_A,old),...routesFor(ENDPOINT_B,next)};
 const oldURL=new URL(old.workflow.file,ENDPOINT_A).href;
 routes[oldURL]=async()=>{started();await blocked;return old.rawContents['guide-one'];};
 const app=boot(routes);await app.message('catalog-check');
 const pending=app.context.CatalogSync.loadWorkflow('guide-one');await began;
 await app.message('catalog-configure',{endpoint:ENDPOINT_B,enabled:true});
 try {
  const loaded=await app.context.CatalogSync.loadWorkflow('guide-one');
  assert.equal(loaded.version,'new');
 } finally {release();}
 assert.equal(await pending,null);
});

test('catalog revision change starts a separate workflow flight and discards old result',async()=>{
 const old=await pack('guide-one',JSON.stringify(guide('guide-one','old')));
 const next=await pack('guide-one',JSON.stringify(guide('guide-one','new')));
 let release,started;const blocked=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
 const routes=routesFor(ENDPOINT_A,old),bodyURL=new URL(old.workflow.file,ENDPOINT_A).href;
 routes[bodyURL]=async()=>{started();await blocked;return old.rawContents['guide-one'];};
 const app=boot(routes);await app.message('catalog-check');
 const pending=app.context.CatalogSync.loadWorkflow('guide-one');await began;
 routes[ENDPOINT_A]=next.rawCatalog;routes[bodyURL]=next.rawContents['guide-one'];
 await app.message('catalog-check');
 try {assert.equal((await app.context.CatalogSync.loadWorkflow('guide-one')).version,'new');}finally{release();}
 assert.equal(await pending,null);
 assert.equal(JSON.parse(app.data[app.context.CatalogSync.CACHE].rawContents['guide-one']).version,'new');
});

test('concurrent distinct workflow loads merge their verified cache entries',async()=>{
 const one=await pack('guide-one'),two=await pack('guide-two');
 const catalog={...one.catalog,workflows:[one.workflow,two.workflow]};
 const routes={...routesFor(ENDPOINT_A,one),...routesFor(ENDPOINT_A,two),[ENDPOINT_A]:JSON.stringify(catalog)};
 const app=boot(routes);await app.message('catalog-check');
 await Promise.all(['guide-one','guide-two'].map(id=>app.context.CatalogSync.loadWorkflow(id)));
 assert.deepEqual(Object.keys(app.data[app.context.CatalogSync.CACHE].rawContents).sort(),['guide-one','guide-two']);
});
