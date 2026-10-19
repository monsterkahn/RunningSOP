'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const {TeamStore}=require('../server/store.cjs'),{createTeamServer}=require('../server/app.cjs');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
const imagePath=/\/v1\/sops\/[^/]+\/images\//;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(run,{legacy=false,corrupt=false,realNetwork=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-sidebar-images-'));let context,store,server;
 try{
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  store=new TeamStore({dbPath:path.join(directory,'library.sqlite')});const actor=store.createSession({displayName:'Synthetic seed'}).actor;
  const image='data:image/jpeg;base64,'+fs.readFileSync(path.resolve(__dirname,'../examples/illustrations/demo-step.jpg')).toString('base64');
  const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'images-a',title:'Synthetic images A',version:'1',notice:'',steps:Array.from({length:24},(_,i)=>({id:'step-'+i,title:'Step '+i,where:'Synthetic',workUrl:i<12?'https://work.example.test/work':'https://work.example.test/other',actions:['Historical action '+i],expected:'',trouble:'',acceptance:[],image,imageMarks:[{type:'number',x:.2,y:.3}],issues:i===0?[{id:'issue-one',title:'Synthetic exception one',actions:['Review exception'],next:'Continue',image,imageMarks:[{type:'number',x:.3,y:.4}]},{id:'issue-two',title:'Synthetic exception two',actions:['Review second exception'],next:'Continue',image,imageMarks:[{type:'number',x:.4,y:.5}]}]:[]}))};
  store.create(guide,{actor,idempotencyKey:'images-seed-a'});const lease=store.acquireLock('images-a',{actor});store.publish('images-a',{...guide,version:'2',steps:guide.steps.map(step=>({...step,actions:['Current action']}))},{actor,...lease,expectedRevision:1,idempotencyKey:'images-publish-a'});
  store.create({...guide,workflowId:'images-b',title:'Synthetic images B',steps:[{...guide.steps[0],workUrl:'https://work.example.test/second',actions:['Second SOP']}]},{actor,idempotencyKey:'images-seed-b'});
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
  const page=await context.newPage();page.on('pageerror',error=>console.error('HISTORY_PAGE_ERROR',error.message));await page.setViewportSize({width:1100,height:700});
  await page.addInitScript(()=>{window.syntheticTab={id:12345,url:'https://work.example.test/work',title:'Synthetic work'};chrome.tabs.query=async()=>[window.syntheticTab];});
  if(corrupt)await page.route('**/v1/sops/images-a/view',async route=>{const response=await route.fetch(),body=await response.json();body.data.viewSha256='0'.repeat(64);await route.fulfill({response,json:body});});
  if(legacy)await page.route('**/v1/capabilities',async route=>{const response=await route.fetch(),body=await response.json();body.data.features=body.data.features.filter(feature=>feature!=='read-view-images');await route.fulfill({response,json:body});});
  const requests=[];let activeImages=0,maxImages=0;
  page.on('request',request=>{if(!request.url().startsWith(endpoint))return;requests.push(new URL(request.url()).pathname+new URL(request.url()).search);if(imagePath.test(request.url())){activeImages++;maxImages=Math.max(maxImages,activeImages);}});
  const completed=request=>{if(request.url().startsWith(endpoint)&&imagePath.test(request.url()))activeImages--;};page.on('requestfinished',completed);page.on('requestfailed',completed);
  // Keep actual HTTP responses in flight long enough to expose unbounded queues.
  if(!realNetwork)await page.route(imagePath,async route=>{const response=await route.fetch();await pause(75);await route.fulfill({response}).catch(()=>{});});
  await page.goto(origin+'/workspace.html');await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  const change=async(url,id=12345)=>page.evaluate(async({url,id})=>{window.syntheticTab={id,url,title:'Synthetic work'};await WorkspaceApp.refresh();},{url,id});
  await run({context,page,options,requests,store,actor,guide,image,endpoint,change,getMax:()=>maxImages});
 }finally{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
}
const imageRequests=requests=>requests.filter(url=>imagePath.test(url));
const fullRequests=requests=>requests.filter(url=>/^\/v1\/sops\/images-[ab](?:\?|$)/.test(url));
const drafts=page=>page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts);
async function readReady(page){await page.locator('#steps .step').first().waitFor();await page.locator('#steps .picture-button img').first().waitFor();await pause(350);}

async function showHistory(page){await page.locator('#version-history').click();await page.locator('#history-list button').first().waitFor();}
async function historical(page){await showHistory(page);await page.locator('#history-list button').filter({hasText:/^1 ·/}).click();await page.locator('#history-banner').waitFor({state:'visible'});await page.locator('#steps img').first().waitFor();}

test('history reads exact team revision text, images and marks; return current restores safe editing',{timeout:60000},()=>fixture(async({page,requests})=>{
 await readReady(page);await historical(page);
 assert.match(await page.locator('#steps').textContent(),/Historical action/);assert.doesNotMatch(await page.locator('#steps').textContent(),/Current action/);
 assert.equal(await page.locator('#edit-sop').isVisible(),false);assert.equal(await page.locator('#feedback-section').isVisible(),false);assert.equal(await page.locator('#rating-send').isDisabled(),true);
 assert.ok(await page.locator('#steps > .step').first().locator('.image-marks-overlay svg').count());
 await page.locator('#steps .issue-toggle').first().click();await page.locator('#steps .issue-choice').first().click();await page.locator('#steps .issue-panel img').waitFor();
 assert.ok(await page.locator('#steps .issue-panel .image-marks-overlay svg').count());
 assert.ok(requests.includes('/v1/sops/images-a/view?revision=1'));assert.ok(requests.includes('/v1/sops/images-a/images/0?revision=1'));assert.ok(requests.includes('/v1/sops/images-a/images/0/issues/0?revision=1'));
 // Programmatic dispatch must not bypass the read-only UI.
 const before=await drafts(page);await page.evaluate(()=>{document.querySelector('#edit-sop').click();document.querySelector('#publish-nas').click();document.querySelector('#save-feedback').click();});await pause(150);assert.deepEqual(await drafts(page),before);assert.equal(await page.locator('#editor').isVisible(),false);
 await page.locator('#history-current').click();await readReady(page);assert.match(await page.locator('#steps').textContent(),/Current action/);assert.equal(await page.locator('#history-banner').isVisible(),false);assert.equal(await page.locator('#edit-sop').isVisible(),true);
}));

test('history supports complete exact-revision reads from older team services',{timeout:60000},()=>fixture(async({page,requests})=>{
 await readReady(page);await historical(page);assert.ok(requests.includes('/v1/sops/images-a?revision=1'));assert.equal(requests.some(url=>url.includes('/images/')),false);assert.match(await page.locator('#steps').textContent(),/Historical action/);
},{legacy:true}));

test('account change cancels an in-flight historical read before any old content appears',{timeout:60000},()=>fixture(async({page,options})=>{
 await readReady(page);let release,seen;const held=new Promise(resolve=>{seen=resolve;});
 await page.route('**/v1/sops/images-a/view?revision=1',async route=>{const response=await route.fetch();seen();await new Promise(resolve=>{release=resolve;});await route.fulfill({response}).catch(()=>{});});
 await showHistory(page);await page.locator('#history-list button').filter({hasText:/^1 ·/}).click();await held;
 await options.evaluate(()=>RunningSOPTeamSettings.clear());await page.waitForFunction(()=>document.querySelector('#steps').children.length===0);release();await pause(200);
 assert.equal(await page.locator('#history-banner').isVisible(),false);assert.equal(await page.locator('#steps img').count(),0);assert.equal(await page.locator('#history-dialog').isVisible(),false);
}));

test('closing the history dialog cancels pending reads and keeps current content',{timeout:60000},()=>fixture(async({page})=>{
 await readReady(page);let release,seen;const held=new Promise(resolve=>{seen=resolve;});
 await page.route('**/v1/sops/images-a/view?revision=1',async route=>{const response=await route.fetch();seen();await new Promise(resolve=>{release=resolve;});await route.fulfill({response}).catch(()=>{});});
 await showHistory(page);await page.locator('#history-list button').filter({hasText:/^1 ·/}).click();await held;await page.keyboard.press('Escape');release();await pause(200);
 assert.equal(await page.locator('#history-banner').isVisible(),false);assert.match(await page.locator('#steps').textContent(),/Current action/);assert.equal(await page.locator('#edit-sop').isVisible(),true);
}));

test('a screenshot-viewer refresh cannot turn a historical SOP into current edit provenance',{timeout:60000},()=>fixture(async({page})=>{
 await readReady(page);await historical(page);await page.evaluate(async()=>{window.syntheticTab.url=chrome.runtime.getURL('screenshot-viewer.html');await WorkspaceApp.refresh();});
 assert.equal(await page.locator('#steps .step').count(),0);assert.equal(await page.locator('#edit-sop').isVisible(),false);
}));

test('history unavailable and empty history preserve current readable SOP',{timeout:60000},()=>fixture(async({page,endpoint})=>{
 await readReady(page);await page.route(endpoint+'/v1/sops/images-a/history**',route=>route.fulfill({status:404,json:{error:{code:'not_found'}}}));
 await page.locator('#version-history').click();await page.waitForFunction(()=>document.querySelector('#history-status').textContent.includes('unavailable'));
 await page.locator('#history-close').click();assert.match(await page.locator('#steps').textContent(),/Current action/);assert.equal(await page.locator('#edit-sop').isVisible(),true);
 await page.unroute(endpoint+'/v1/sops/images-a/history**');await page.route(endpoint+'/v1/sops/images-a/history**',route=>route.fulfill({json:{data:{items:[],nextCursor:null}}}));
 await page.locator('#version-history').click();await page.waitForFunction(()=>document.querySelector('#history-status').textContent.includes('No historical versions'));await page.locator('#history-close').click();assert.match(await page.locator('#steps').textContent(),/Current action/);
}));

test('folder history pages remain bounded, show full historical content and never send statistics',{timeout:60000},()=>fixture(async({page,guide})=>{
 await readReady(page);
 await page.evaluate(async old=>{
  const current={...structuredClone(old),version:'2',steps:[{...old.steps[0],actions:['Current folder action']}]},workflow={id:old.workflowId,title:old.title,viewer:'guide',sha256:'a'.repeat(64)},endpoint='sop-directory://synthetic-history/catalog.json';
  RunningSOPTeamSettings={...RunningSOPTeamSettings,read:async()=>({enabled:false})};await chrome.storage.local.remove(RunningSOPTeamSettings.KEY);
  CatalogSync.loadSnapshot=async()=>({endpoint,catalog:{workflows:[workflow]}});CatalogSync.loadWorkflow=async()=>current;CatalogSync.info=async()=>({settings:{endpoint},status:{state:'ready'}});CatalogEngine.matchPage=()=>({state:'matched',candidates:[{workflow}]});
  window.folderReads=[];window.historyViews=0;SOPStats.trackView=async()=>{window.historyViews++;};
  window.SOPFolderHistory={list:async(w,options)=>{window.folderReads.push({kind:'list',cursor:options.cursor,limit:options.limit});return options.cursor?{items:[{version:'0',sha256:'c'.repeat(64),publishedAt:null,updatedAt:null}],nextCursor:null}:{items:[{version:'1',sha256:'b'.repeat(64),publishedAt:'2026-02-01T00:00:00Z'}],nextCursor:'next'};},read:async(w,item,options)=>{window.folderReads.push({kind:'read',sha256:item.sha256});return structuredClone(old);}};
  await WorkspaceApp.refresh();
 },guide);
 await page.waitForFunction(()=>document.querySelector('#steps').textContent.includes('Current folder action'));
 await showHistory(page);await page.locator('#history-next').click();await page.locator('#history-list button').filter({hasText:/^0$/}).waitFor();assert.doesNotMatch(await page.locator('#history-list').textContent(),/1970/);await page.locator('#history-previous').click();await page.locator('#history-list button').filter({hasText:/^1 ·/}).waitFor();
 const before=await page.evaluate(()=>window.historyViews);await page.locator('#history-list button').first().click();await page.locator('#history-banner').waitFor({state:'visible'});await page.locator('#steps img').first().waitFor();
 assert.equal(await page.locator('#steps .step').count(),24,'Historical addresses do not hide historical steps');assert.match(await page.locator('#steps').textContent(),/Historical action/);assert.equal(await page.evaluate(()=>window.historyViews),before);assert.equal(await page.locator('#feedback-section').isVisible(),false);
 assert.ok((await page.evaluate(()=>window.folderReads)).filter(r=>r.kind==='list').every(r=>r.limit===20));
 await page.locator('#history-current').click();await page.waitForFunction(()=>document.querySelector('#steps').textContent.includes('Current folder action'));assert.equal(await page.locator('#history-banner').isVisible(),false);
}));
