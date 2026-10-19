'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const {TeamStore}=require('../server/store.cjs'),{createTeamServer}=require('../server/app.cjs');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(run){
 const maximal=process.env.RUNTIME_SOP_MAX_TRANSFER==='1';
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-slow-publish-'));let context,store,server;
 try{
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  store=new TeamStore({dbPath:path.join(directory,'library.sqlite')});const actor=store.createSession({displayName:'Synthetic seed'}).actor;
  const image='data:image/jpeg;base64,'+fs.readFileSync(path.resolve(__dirname,'../examples/illustrations/demo-step.jpg')).toString('base64');
  const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'images-a',title:'Synthetic images A',version:'1',notice:'',steps:Array.from({length:24},(_,i)=>({id:'step-'+i,title:'Step '+i,where:'Synthetic',workUrl:i<12?'https://work.example.test/work':'https://work.example.test/other',actions:['Historical action '+i],expected:'',trouble:'',acceptance:[],image,imageMarks:[{type:'number',x:.2,y:.3}],issues:i===0?[{id:'issue-one',title:'Synthetic exception one',actions:['Review exception'],next:'Continue',image,imageMarks:[{type:'number',x:.3,y:.4}]},{id:'issue-two',title:'Synthetic exception two',actions:['Review second exception'],next:'Continue',image,imageMarks:[{type:'number',x:.4,y:.5}]}]:[]}))};
  if(maximal)guide.steps=Array.from({length:100},(_,i)=>({...guide.steps[i%24],id:'max-step-'+i,workUrl:'https://work.example.test/'+(i<12?'work':'other'),issues:i<48?[{...guide.steps[0].issues[0],id:'max-issue-'+i}]:[]}));
  store.create(guide,{actor,idempotencyKey:'images-seed-a'});const lease=store.acquireLock('images-a',{actor});store.publish('images-a',{...guide,version:'2',steps:guide.steps.map(step=>({...step,actions:['Current action']}))},{actor,...lease,expectedRevision:1,idempotencyKey:'images-publish-a'});
  server=createTeamServer({store,joinCode:'synthetic-image-browser-code',allowOrigins:[origin]});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint='http://127.0.0.1:'+server.address().port;
  // Coordinate with the installation handler through the actual options tab.
  // Both existing and newly created tabs may still be navigating when it opens.
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
  await options.evaluate(async endpoint=>{await chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}});chrome.permissions.request=async()=>true;await RunningSOPTeamSettings.connect({endpoint,displayName:'Image browser',joinCode:'synthetic-image-browser-code'});},endpoint);
  const page=await context.newPage();await page.setViewportSize({width:1100,height:700});
  await page.addInitScript(()=>{window.syntheticTab={id:12345,url:'https://work.example.test/work',title:'Synthetic work'};chrome.tabs.query=async()=>[window.syntheticTab];});
  const writes=[];page.on('request',request=>{if(request.url()===endpoint+'/v1/sops/images-a'&&request.method()==='PUT')writes.push({key:request.headers()['idempotency-key'],bytes:Buffer.byteLength(request.postData()||'')});});
  await page.goto(origin+'/workspace.html');await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  await run({context,page,writes,store,image,endpoint});
 }finally{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
}
const drafts=page=>page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts);
async function pendingRequests(page){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('running-sop-team-pending',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const tx=db.transaction('requests','readonly'),r=tx.objectStore('requests').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}});}
// Real slow transport: success requires the unchanged complete canonical echo,
// one real publication and no interception or injected timeout settings.
test('large publication completes through slow upload and download with one exact commit',{timeout:180000},()=>fixture(async({context,page,store,image,writes})=>{
 await page.locator('#steps .picture-button img').first().waitFor();await page.locator('#edit-sop').click();await page.locator('#editor').waitFor({state:'visible'});await page.locator('#team-lease-status').waitFor({state:'visible'});
 await page.locator('#edit-action').fill('Synthetic slow publication edit');await page.locator('#preview-publish').click();await page.locator('#confirm-publish').check();
 const expected=await page.evaluate(()=>WorkspaceApp.buildGuide()),guideBytes=Buffer.byteLength(JSON.stringify(expected));const maximal=expected.steps.length===100;assert.ok(maximal?guideBytes>4000000&&guideBytes<4*1024*1024:guideBytes>700000&&guideBytes<800000);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:120,downloadThroughput:64*1024,uploadThroughput:64*1024});
 const started=performance.now();
 try{
  await page.locator('#publish-nas').click();await page.waitForFunction(()=>document.querySelector('#publish-status').textContent.includes('Published to the team'),null,{timeout:165000});
  const elapsedMs=performance.now()-started;assert.ok(elapsedMs>15000,'Actual slow upload and canonical response must exceed the old deadlines');assert.equal(writes.length,1);
  const published=store.get('images-a');assert.equal(published.revision,3);assert.deepEqual(published.guide,expected);assert.equal(store.lockInfo('images-a'),null);assert.equal((await pendingRequests(page)).length,0);
  const draft=(await drafts(page)).find(d=>d.title==='Synthetic images A');assert.equal(draft.steps.length,maximal?100:24);for(const step of draft.steps)assert.equal(step.image,image);for(const issue of draft.steps[0].issues)assert.equal(issue.image,image);
  console.log('SLOW_PUBLISH_EVIDENCE '+JSON.stringify({maximal,guideBytes,requestBytes:writes[0].bytes,elapsedMs,outcome:'verified publication',revision:published.revision,attempts:writes.length,pendingCleared:true}));
 }finally{await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await cdp.detach();}
}));

test('lost large-publication confirmation retains the exact request and replays once after lease expiry',{timeout:60000},()=>fixture(async({page,store,writes,endpoint})=>{
 await page.locator('#steps .picture-button img').first().waitFor();await page.locator('#edit-sop').click();await page.locator('#editor').waitFor({state:'visible'});await page.locator('#team-lease-status').waitFor({state:'visible'});
 await page.locator('#edit-action').fill('Synthetic lost confirmation');await page.locator('#preview-publish').click();await page.locator('#confirm-publish').check();const expected=await page.evaluate(()=>WorkspaceApp.buildGuide());
 let dropped=false;
 // Explicit fault injection after a real commit; the slow success test above
 // uses genuine transport throttling without this route interception.
 await page.route(endpoint+'/v1/sops/images-a',async route=>{if(route.request().method()==='PUT'&&!dropped){dropped=true;const response=await route.fetch();assert.equal(response.status(),200);await route.abort('failed');}else await route.continue();});
 await page.locator('#publish-nas').click();await page.waitForFunction(()=>/unknown|retry/i.test(document.querySelector('#publish-status').textContent));assert.equal(dropped,true);assert.equal(store.get('images-a').revision,3);assert.equal(writes.length,1);
 const pending=await pendingRequests(page);assert.equal(pending.length,1);assert.deepEqual(pending[0].guide,expected);assert.equal(pending[0].key,writes[0].key);await pause(500);assert.equal(writes.length,1);
 const realNow=store.now;store.now=()=>realNow()+121000;
 await page.locator('#publish-nas').click();await page.waitForFunction(()=>document.querySelector('#publish-status').textContent.includes('Published to the team'));
 assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.equal(writes[0].bytes,writes[1].bytes);assert.equal(store.get('images-a').revision,3,'Idempotent replay must not create another revision');assert.deepEqual(store.get('images-a').guide,expected);assert.equal((await pendingRequests(page)).length,0);assert.equal(store.lockInfo('images-a'),null);
}));
