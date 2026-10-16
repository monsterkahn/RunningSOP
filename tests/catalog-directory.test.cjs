'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const A='sop-directory://11111111-1111-4111-8111-111111111111/catalog.json',B='sop-directory://22222222-2222-4222-8222-222222222222/catalog.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const resource=(endpoint,file)=>new URL(file,endpoint).href;
const KEY='runtime-sop-catalog-settings-v1',CACHE='runtime-sop-catalog-cache-v1';
function fixture(endpoint=A,version='1',id='guide-one'){
 const image=new Uint8Array([255,216,255]),imageHash=hash(image),file=`workflows/${id}/images/${imageHash}.jpg`;
 const content={format:'runtime-sop-guide',schemaVersion:1,workflowId:id,title:'Synthetic guide',version,notice:'',steps:[{id:'step-one',title:'Step',where:'Page',actions:['Review'],expected:'Done',trouble:'',acceptance:['Confirm'],image:null}]};
 const body=JSON.stringify({format:'runtime-sop-document',schemaVersion:1,workflowId:id,viewer:'guide',content,assets:[{path:'/steps/0/image',file,sha256:imageHash,mimeType:'image/jpeg',size:image.length}]});
 const workflow={id,title:id,summary:'',status:'published',viewer:'guide',file:`workflows/${id}/document.json`,sha256:hash(body),rules:[{hosts:['example.com'],priority:1,label:'Synthetic'}]};
 const catalog=JSON.stringify({format:'runtime-sop-catalog',schemaVersion:1,version,workflows:[workflow]});
 return {catalog,body,image,workflow,bodyURL:resource(endpoint,workflow.file),imageURL:resource(endpoint,file),routes:{[endpoint]:catalog,[resource(endpoint,workflow.file)]:body,[resource(endpoint,file)]:image}};
}
function boot(routes={},settings={enabled:true,endpoint:A},seed={}){
 const data=structuredClone(seed),reads=[],messages=[],alarms={created:0,cleared:0,listeners:[]},state={endpoint:A,permission:'granted',selected:true};
 if(settings)data[KEY]=settings;
 const chrome={runtime:{id:'synthetic',getURL:p=>'chrome-extension://synthetic/'+p,onMessage:{addListener:f=>messages.push(f)},onStartup:{addListener(){}},onInstalled:{addListener(){}}},storage:{local:{async get(key){return {[key]:structuredClone(data[key])};},async set(values){Object.assign(data,structuredClone(values));},async remove(keys){for(const key of keys)delete data[key];}}},extension:{isAllowedFileSchemeAccess(){throw Error('Directory must not request file URL access');}},alarms:{onAlarm:{addListener:f=>alarms.listeners.push(f)},async create(){alarms.created++;},async clear(){alarms.cleared++;}},action:{async setBadgeText(){},async setBadgeBackgroundColor(){}}};
 const Source={isEndpoint:value=>typeof value==='string'&&value.startsWith('sop-directory:'),validateEndpoint(value){if(!/^sop-directory:\/\/[a-f0-9-]{36}\/catalog\.json$/.test(value))throw Error('invalid directory endpoint');return value;},resolve(endpoint,file){this.validateEndpoint(endpoint);if(typeof file!=='string'||file.split('/').some(p=>!p||p==='.'||p==='..')||/[\\%?#:]/.test(file))throw Error('invalid relative file');return resource(endpoint,file);},async info(){return {selected:state.selected,endpoint:state.endpoint,readPermission:state.permission};},async read(url,options={}){reads.push({url,...options});if(!state.selected||new URL(url).host!==new URL(state.endpoint).host)throw Error('source changed');if(state.permission!=='granted')throw Error('permission denied');if(!Object.hasOwn(routes,url))throw Error('missing synthetic file');const value=typeof routes[url]==='function'?await routes[url]():routes[url];const bytes=typeof value==='string'?new TextEncoder().encode(value):value;if(bytes.length>options.limit)throw Error('size limit');return options.binary?bytes:new TextDecoder('utf-8',{fatal:true}).decode(bytes);}};
 const context={chrome,SOPStorageSource:Source,fetch:async()=>{throw Error('Directory URL must never reach fetch');},crypto:webcrypto,TextEncoder,TextDecoder,URL,AbortController,setTimeout,clearTimeout,console,atob,btoa};
 for(const file of ['catalog-engine.js','sop-assets.js','catalog-runtime.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),context,{filename:file});
 context.CatalogSync.registerBackground();
 const message=(type,settings)=>new Promise(resolve=>messages[0]({type,settings},{id:'synthetic',url:'chrome-extension://synthetic/options.html'},resolve));
 return {data,reads,state,message,alarms,sync:context.CatalogSync};
}

test('directory checks read only catalog; selected body and images load on demand',async()=>{
 const one=fixture(),two=fixture(A,'1','guide-two'),catalog=JSON.stringify({...JSON.parse(one.catalog),workflows:[one.workflow,two.workflow]});
 const app=boot({...one.routes,...two.routes,[A]:catalog});
 assert.equal((await app.message('catalog-check')).status.state,'ready');
 assert.deepEqual(app.reads.map(r=>r.url),[A]);
 assert.deepEqual(app.data[CACHE].rawContents,{});
 const guide=await app.sync.loadWorkflow('guide-one');
 assert.equal(guide.workflowId,'guide-one');assert.equal(guide.steps[0].image,'data:image/jpeg;base64,/9j/');
 assert.deepEqual(app.reads.map(r=>r.url),[A,one.bodyURL,one.imageURL]);
 assert.equal(app.reads[2].binary,true);assert.equal(app.reads[0].limit,512*1024);
});

test('denied directory permission preserves verified persisted body and images',async()=>{
 const one=fixture(),app=boot(one.routes);await app.message('catalog-check');await app.sync.loadWorkflow('guide-one');
 const before=structuredClone(app.data[CACHE]);app.state.permission='denied';
 const check=await app.message('catalog-check');assert.equal(check.status.state,'offline');assert.deepEqual(app.data[CACHE],before);
 const restarted=boot({}, {enabled:true,endpoint:A},app.data);restarted.state.permission='prompt';await restarted.message('catalog-check');
 assert.equal((await restarted.sync.loadWorkflow('guide-one')).steps[0].image,'data:image/jpeg;base64,/9j/');
 assert.deepEqual(restarted.reads.map(r=>r.url),[A]);
});

test('configuration accepts only currently selected directory and preserves settings shape',async()=>{
 const one=fixture(),app=boot(one.routes,null);await app.message('catalog-check');
 assert.deepEqual({...await app.sync.getSettings()},{enabled:false,endpoint:''});
 const bad=await app.message('catalog-configure',{enabled:true,endpoint:B});assert.match(bad.error,/不匹配/);assert.equal(app.data[KEY],undefined);
 const good=await app.message('catalog-configure',{enabled:true,endpoint:A});assert.equal(good.status.state,'ready');
 assert.deepEqual(app.data[KEY],{enabled:true,endpoint:A});
});

test('changing selected directory hides old cached catalog before configuration',async()=>{
 const one=fixture(),app=boot(one.routes);await app.message('catalog-check');await app.sync.loadWorkflow('guide-one');
 app.state.endpoint=B;
 assert.equal(await app.sync.loadCatalog(),null);assert.equal(await app.sync.loadWorkflow('guide-one'),null);
 assert.equal((await app.message('catalog-check')).status.state,'offline');assert.equal(app.data[CACHE].endpoint,A);
});

test('pending old-directory body cannot overwrite cache after source switch',async()=>{
 const old=fixture(),next=fixture(B,'2');let release,started;
 const wait=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
 const routes={...old.routes,...next.routes,[old.bodyURL]:async()=>{started();await wait;return old.body;}};
 const app=boot(routes);await app.message('catalog-check');
 const pending=app.sync.loadWorkflow('guide-one');await began;app.state.endpoint=B;
 assert.equal((await app.message('catalog-configure',{enabled:true,endpoint:B})).status.state,'ready');
 assert.equal((await app.sync.loadWorkflow('guide-one')).version,'2');release();
 await assert.rejects(pending,/source changed/);
 assert.equal(app.data[CACHE].endpoint,B);assert.equal(app.data[CACHE].rawContents['guide-one'],next.body);
});

test('old plain-body load returns no result when selection changes during read',async()=>{
 const one=fixture(),document=JSON.parse(one.body).content;delete document.steps[0].image;
 const body=JSON.stringify(document),catalog=JSON.parse(one.catalog);catalog.workflows[0].sha256=hash(body);
 let release,started;const wait=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve);
 const app=boot({...one.routes,[A]:JSON.stringify(catalog),[one.bodyURL]:async()=>{started();await wait;return body;}});
 await app.message('catalog-check');const pending=app.sync.loadWorkflow('guide-one');await began;
 app.state.endpoint=B;release();assert.equal(await pending,null);assert.deepEqual(app.data[CACHE].rawContents,{});
});


test('manual directory check works with automatic checks disabled and keeps them disabled',async()=>{
 const one=fixture(),app=boot(one.routes,{enabled:false,endpoint:A});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(app.reads,[]);assert.equal(app.alarms.created,0);assert.ok(app.alarms.cleared>0);
 const configured=await app.message('catalog-configure',{enabled:false,endpoint:A});
 assert.equal(configured.status.state,'disabled');assert.deepEqual(app.reads,[]);
 const checked=await app.message('catalog-check');assert.equal(checked.status.state,'ready');
 assert.deepEqual(app.reads.map(r=>r.url),[A]);assert.equal(app.data[CACHE].endpoint,A);
 assert.deepEqual(app.data[KEY],{enabled:false,endpoint:A});assert.equal(app.alarms.created,0);
 app.alarms.listeners[0]({name:'runtime-sop-catalog-check-v1'});
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(app.reads.map(r=>r.url),[A]);
});
