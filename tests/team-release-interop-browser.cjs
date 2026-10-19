'use strict';
// Supply an extracted, independently verified official v1.2.0 source archive.
// This suite never downloads a baseline or substitutes simulated capabilities.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash,webcrypto}=require('node:crypto');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
assert.ok(process.env.RUNTIME_SOP_RELEASE_ROOT,'RUNTIME_SOP_RELEASE_ROOT must identify the verified extracted official v1.2.0 source');
const released=path.resolve(process.env.RUNTIME_SOP_RELEASE_ROOT),current=path.resolve(__dirname,'..');
assert.equal(require(path.join(released,'extension/manifest.json')).version,'1.2.0');
assert.notEqual(fs.realpathSync(released),fs.realpathSync(current),'Released source must be independent of the development checkout');
const hash=guide=>createHash('sha256').update(JSON.stringify(guide)).digest('hex');
const code='synthetic-release-interop-code',id='release-interop';
const sdk=root=>require(path.join(root,'extension/team-client.js'));
async function client(root,endpoint,name){const api=sdk(root),session=await api.create({endpoint,crypto:webcrypto}).join(code,name);return api.create({endpoint,crypto:webcrypto,token:session.token});}
async function fixture(clientRoot,serverRoot,run){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-release-interop-'));let context,store,server;
 try{
  const extension=path.join(clientRoot,'extension');
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  const {TeamStore}=require(path.join(serverRoot,'server/store.cjs')),{createTeamServer}=require(path.join(serverRoot,'server/app.cjs'));
  store=new TeamStore({dbPath:path.join(directory,'library.sqlite')});
  const actor=store.createSession({displayName:'Synthetic seed'}).actor;
  const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(current,'examples/illustrations/demo-step.jpg')).toString('base64');
  const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:id,title:'Synthetic release interoperability',version:'1',notice:'',steps:[0,1].map(i=>({id:'step-'+(i+1),title:'Synthetic step '+i,where:'Synthetic',workUrl:'https://work.example.test/'+(i?'other':'work'),actions:['Original action'],expected:'',trouble:'',acceptance:[],image,imageMarks:[{type:'number',x:.2,y:.3}],issues:i?[]:[{id:'unseen-issue',title:'Unseen exception',actions:['Synthetic exception action'],next:'Continue',image,imageMarks:[{type:'number',x:.4,y:.5}]}]}))};
  const seeded=store.create(guide,{actor,idempotencyKey:'interop-seed-create'});
  server=createTeamServer({store,joinCode:code,allowOrigins:[origin]});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint='http://127.0.0.1:'+server.address().port;
  const optionsUrl=origin+'/options.html';
  const optionsReady=new Promise((resolve,reject)=>{
   const watched=new Map();let timer,settled=false;
   const finish=page=>{if(settled)return;settled=true;clearTimeout(timer);context.off('page',watch);for(const [tab,listener] of watched)tab.off('framenavigated',listener);resolve(page);};
   const check=page=>{if(page.url()===optionsUrl)finish(page);};
   const watch=page=>{if(settled)return;const listener=()=>check(page);watched.set(page,listener);page.on('framenavigated',listener);check(page);};
   timer=setTimeout(()=>{context.off('page',watch);for(const [tab,listener] of watched)tab.off('framenavigated',listener);reject(new Error('Installation options tab did not reach its extension URL'));},30000);
   context.on('page',watch);for(const page of context.pages())watch(page);
  });
  await worker.evaluate(()=>chrome.runtime.openOptionsPage());const options=await optionsReady;
  await options.waitForLoadState('domcontentloaded');await options.waitForFunction(()=>!!window.RunningSOPTeamSettings);
  await options.evaluate(async({endpoint,code})=>{await chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}});chrome.permissions.request=async()=>true;await RunningSOPTeamSettings.connect({endpoint,displayName:'Synthetic browser',joinCode:code});},{endpoint,code});
  const page=await context.newPage();await page.setViewportSize({width:1100,height:700});
  await page.addInitScript(()=>{chrome.tabs.query=async()=>[{id:12345,url:'https://work.example.test/work',title:'Synthetic work'}];});
  const requests=[];page.on('request',request=>{if(request.url().startsWith(endpoint))requests.push({method:request.method(),path:new URL(request.url()).pathname});});
  await page.goto(origin+'/workspace.html');await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  await run({page,store,endpoint,requests,image,seeded});
 }finally{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
}
for(const [clientName,clientRoot] of [['released',released],['development',current]])for(const [serverName,serverRoot] of [['released',released],['development',current]]){
 test(clientName+' extension / '+serverName+' service: annotated reading, complete Edit and revision-2 publication',{timeout:60000},()=>fixture(clientRoot,serverRoot,async({page,store,endpoint,requests,image,seeded})=>{
  await page.locator('#steps .step').first().waitFor();await page.locator('#steps .picture-button img').first().waitFor();
  assert.match(await page.locator('#steps').textContent(),/Original action/);
  assert.ok(await page.locator('#steps .image-marks-overlay svg').count(),'Annotations must render');
  const selected=clientRoot===current&&serverRoot===current;
  assert.equal(requests.some(r=>r.path.endsWith('/view')),selected);
  assert.equal(requests.some(r=>r.path.includes('/images/')),selected);
  assert.equal(requests.filter(r=>r.method==='GET'&&r.path==='/v1/sops/'+id).length,selected?0:1);
  assert.equal(requests.some(r=>r.path.includes('/issues/')),false,'The exception image has not been selected');
  await page.locator('#edit-sop').click();await page.locator('#editor').waitFor({state:'visible'});await page.locator('#team-lease-status').waitFor({state:'visible'});
  assert.ok(store.lockInfo(id),'Editing must hold a real server lease');
  const saved=await page.evaluate(async()=> (await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts);
  const draft=saved.find(d=>d.title==='Synthetic release interoperability');assert.ok(draft);assert.equal(draft.steps.length,2);
  for(const step of draft.steps)assert.equal(step.image,image);
  assert.equal(draft.steps[0].issues[0].image,image);assert.deepEqual(draft.steps[0].issues[0].imageMarks,seeded.guide.steps[0].issues[0].imageMarks);
  await page.locator('#edit-action').fill('Published synthetic interoperability action');
  await page.locator('#preview-publish').click();await page.locator('#confirm-publish').check();
  // Capture the actual complete validated preview, before the HTTP publication.
  const expected=await page.evaluate(()=>WorkspaceApp.buildGuide());
  await page.locator('#publish-nas').click();await page.waitForFunction(()=>document.querySelector('#publish-status').textContent.includes('Published to the team'));
  const result=store.get(id);assert.equal(result.revision,2);assert.deepEqual(result.guide,expected);assert.equal(result.sha256,hash(expected));assert.equal(store.lockInfo(id),null);
  assert.equal(requests.filter(r=>r.method==='PUT'&&r.path==='/v1/sops/'+id).length,1);
  assert.ok(requests.some(r=>r.method==='POST'&&r.path.endsWith('/lock')));
  for(const step of result.guide.steps)assert.equal(step.image,image);assert.equal(result.guide.steps[0].issues[0].image,image);
  const opposite=await client(clientRoot===released?current:released,endpoint,'Synthetic opposite-version reader');
  const read=await opposite.getSop(id);assert.equal(read.revision,2);assert.deepEqual(read.guide,expected);assert.equal(read.sha256,hash(expected));
 }));
}
for(const [name,root] of [['released',released],['development',current]])test('released and development SDK leases have exactly one winner on '+name+' service',{timeout:15000},async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-release-lock-'));let store,server;
 try{
  const {TeamStore}=require(path.join(root,'server/store.cjs')),{createTeamServer}=require(path.join(root,'server/app.cjs'));store=new TeamStore({dbPath:path.join(directory,'library.sqlite')});
  const actor=store.createSession({displayName:'Synthetic seed'}).actor;
  store.create({format:'runtime-sop-guide',schemaVersion:1,workflowId:id,title:'Synthetic lease contention',version:'1',notice:'',steps:[{id:'one',title:'Synthetic',where:'Synthetic',workUrl:'https://work.example.test/work',actions:['Synthetic action'],expected:'',trouble:'',acceptance:[]}]},{actor,idempotencyKey:'interop-lease-seed'});
  server=createTeamServer({store,joinCode:code});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint='http://127.0.0.1:'+server.address().port;
  const clients=await Promise.all([client(released,endpoint,'Synthetic released editor'),client(current,endpoint,'Synthetic development editor')]);
  const attempts=await Promise.allSettled(clients.map(c=>c.acquireLock(id)));assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(attempts.filter(r=>r.status==='rejected'&&r.reason.code==='locked').length,1);
  const winner=attempts.findIndex(r=>r.status==='fulfilled');await clients[winner].releaseLock(id,attempts[winner].value);assert.equal(store.lockInfo(id),null);
  const lease=await clients[1-winner].acquireLock(id);assert.ok(lease.fence>attempts[winner].value.fence);await clients[1-winner].releaseLock(id,lease);
 }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
});
