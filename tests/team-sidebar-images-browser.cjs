'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const {TeamStore}=require('../server/store.cjs'),{createTeamServer}=require('../server/app.cjs');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
const imagePath=/\/v1\/sops\/[^/]+\/images\//;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(run,{legacy=false,corrupt=false}={}){
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
  const page=await context.newPage();await page.setViewportSize({width:1100,height:700});
  await page.addInitScript(()=>{window.syntheticTab={id:12345,url:'https://work.example.test/work',title:'Synthetic work'};chrome.tabs.query=async()=>[window.syntheticTab];});
  if(corrupt)await page.route('**/v1/sops/images-a/view',async route=>{const response=await route.fetch(),body=await response.json();body.data.viewSha256='0'.repeat(64);await route.fulfill({response,json:body});});
  if(legacy)await page.route('**/v1/capabilities',async route=>{const response=await route.fetch(),body=await response.json();body.data.features=body.data.features.filter(feature=>feature!=='read-view-images');await route.fulfill({response,json:body});});
  const requests=[];let activeImages=0,maxImages=0;
  page.on('request',request=>{if(!request.url().startsWith(endpoint))return;requests.push(new URL(request.url()).pathname+new URL(request.url()).search);if(imagePath.test(request.url())){activeImages++;maxImages=Math.max(maxImages,activeImages);}});
  const completed=request=>{if(request.url().startsWith(endpoint)&&imagePath.test(request.url()))activeImages--;};page.on('requestfinished',completed);page.on('requestfailed',completed);
  // Keep actual HTTP responses in flight long enough to expose unbounded queues.
  await page.route(imagePath,async route=>{const response=await route.fetch();await pause(75);await route.fulfill({response}).catch(()=>{});});
  await page.goto(origin+'/workspace.html');await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  const change=async(url,id=12345)=>page.evaluate(async({url,id})=>{window.syntheticTab={id,url,title:'Synthetic work'};await WorkspaceApp.refresh();},{url,id});
  await run({page,options,requests,store,actor,guide,image,endpoint,change,getMax:()=>maxImages});
 }finally{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
}
const imageRequests=requests=>requests.filter(url=>imagePath.test(url));
const fullRequests=requests=>requests.filter(url=>/^\/v1\/sops\/images-[ab](?:\?|$)/.test(url));
const drafts=page=>page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts);
async function readReady(page){await page.locator('#steps .step').first().waitFor();await page.locator('#steps .picture-button img').first().waitFor();await pause(350);}

test('sidebar reads negotiated text views, filters work addresses, bounds images and defers unchosen issues',{timeout:60000},()=>fixture(async({page,requests,getMax})=>{
 await readReady(page);assert.ok(requests.includes('/v1/capabilities'));assert.ok(requests.includes('/v1/sops/images-a/view'));assert.equal(fullRequests(requests).length,0);assert.equal(await page.locator('#steps .step').count(),12);
 const initial=imageRequests(requests);assert.ok(initial.length>0&&initial.length<12,'Only nearby matching-address thumbnails should load');assert.ok(initial.every(url=>Number(url.match(/\/images\/(\d+)/)[1])<12));assert.equal(initial.some(url=>url.includes('/issues/')),false);
 await page.locator('#steps .issue-toggle').first().click();await pause(150);assert.equal(imageRequests(requests).some(url=>url.includes('/issues/')),false,'Expansion alone does not select an issue');
 await page.locator('#steps .issue-choice').nth(1).click();await page.locator('#steps .issue-panel img').waitFor();assert.deepEqual(imageRequests(requests).filter(url=>url.includes('/issues/')),['/v1/sops/images-a/images/0/issues/1?revision=2']);
 await page.locator('#steps .step').last().scrollIntoViewIfNeeded();await page.locator('#steps .step').last().locator('img').waitFor();assert.ok(imageRequests(requests).some(url=>url.includes('/images/11?revision=2')));assert.ok(getMax()<=2,'At most two image requests are active');assert.equal(fullRequests(requests).length,0);
}));

test('sidebar old-service negotiation retains complete reads',{timeout:60000},()=>fixture(async({page,requests})=>{
 await readReady(page);assert.equal(fullRequests(requests).length,1);assert.equal(requests.some(url=>url.includes('/view')),false);assert.equal(imageRequests(requests).length,0);
},{legacy:true}));

test('sidebar corrupt advertised view fails closed',{timeout:60000},()=>fixture(async({page,requests})=>{
 await page.waitForFunction(()=>document.querySelector('#view-status').classList.contains('error'));assert.equal(fullRequests(requests).length,0);assert.equal(imageRequests(requests).length,0);assert.equal(await page.locator('#steps .step').count(),0);
},{corrupt:true}));

test('sidebar Edit obtains the complete verified guide and preserves unseen images',{timeout:60000},()=>fixture(async({page,requests,image,guide})=>{
 await readReady(page);assert.equal(fullRequests(requests).length,0);assert.equal(imageRequests(requests).some(url=>url.includes('/issues/')),false);
 await page.locator('#edit-sop').click();await page.locator('#editor').waitFor({state:'visible'});assert.ok(fullRequests(requests).length>=1,'Editing must obtain a complete verified guide');
 const saved=(await drafts(page)).find(d=>d.title===guide.title);assert.ok(saved);assert.equal(saved.steps.length,24);
 for(const step of saved.steps)assert.equal(step.image,image);assert.equal(saved.steps[0].issues.length,2);for(const issue of saved.steps[0].issues)assert.equal(issue.image,image);
 assert.equal(saved.steps[23].image,image,'The other-address image must survive despite never being read');assert.deepEqual(saved.steps[0].imageMarks,guide.steps[0].imageMarks);
}));

test('sidebar Edit rejects a changed revision without creating a partial draft',{timeout:60000},()=>fixture(async({page,requests,store,actor,guide})=>{
 await readReady(page);const before=await drafts(page),lease=store.acquireLock('images-a',{actor});store.publish('images-a',{...guide,version:'3'},{actor,...lease,expectedRevision:2,idempotencyKey:'sidebar-change-revision'});
 await page.locator('#edit-sop').click();await page.waitForFunction(()=>!document.querySelector('#edit-sop').disabled);assert.equal(fullRequests(requests).length,1);assert.equal(await page.locator('#editor').isVisible(),false);assert.deepEqual(await drafts(page),before);assert.ok((await page.locator('#view-status').textContent()).length>0);
}));

for(const scenario of ['address','tab','SOP','account'])test('sidebar '+scenario+' switch aborts held images and prevents stale insertion',{timeout:60000},()=>fixture(async({page,options,requests,change})=>{
 await readReady(page);let release,seen;const held=new Promise(resolve=>{seen=resolve;}),aborted=[];page.on('requestfailed',request=>{if(imagePath.test(request.url()))aborted.push(request.url());});
 await page.route('**/v1/sops/images-a/images/0/issues/0?revision=2',async route=>{const response=await route.fetch();seen();await new Promise(resolve=>{release=resolve;});await route.fulfill({response}).catch(()=>{});});
 await page.locator('#steps .issue-toggle').first().click();await page.locator('#steps .issue-choice').first().click();await held;
 if(scenario==='account')await options.evaluate(()=>RunningSOPTeamSettings.clear());else await change(scenario==='SOP'?'https://work.example.test/second':scenario==='address'?'https://work.example.test/other':'https://work.example.test/work',scenario==='tab'?12346:12345);
 await page.waitForFunction(()=>!document.querySelector('#steps .issue-panel img'));release();await pause(300);assert.ok(aborted.some(url=>url.includes('/issues/0')),'The previous context image must be aborted');assert.equal(await page.locator('#steps .issue-panel img').count(),0);
 if(scenario==='account')assert.equal(await page.locator('#steps img').count(),0);if(scenario==='SOP')assert.match(await page.locator('#steps').textContent(),/Second SOP/);if(scenario==='address')assert.ok(imageRequests(requests).some(url=>url.includes('/images/12?revision=2')));
}));

test('sidebar thumbnail decode rechecks private account before inserting images',{timeout:60000},()=>fixture(async({page})=>{
 // Start a fresh view after installing the pause, avoiding any initially decoded images.
 await page.evaluate(()=>{
  const render=ScreenshotEditor.renderFigure;let first=true;window.privateChanged=false;window.privateImageInserted=false;
  const inspect=node=>node.nodeType===1&&(node.matches('img')||node.querySelector('img'));
  new MutationObserver(records=>{if(window.privateChanged&&records.some(record=>[...record.addedNodes].some(inspect)))window.privateImageInserted=true;}).observe(document.querySelector('#steps'),{childList:true,subtree:true});
  ScreenshotEditor.renderFigure=async(box,step)=>{if(first){first=false;await new Promise(resolve=>{window.releasePrivateDecode=resolve;});}return render(box,step);};
  window.syntheticTab={id:12345,url:'https://work.example.test/other',title:'Synthetic other work'};window.privateRefresh=WorkspaceApp.refresh();
 });
 await page.waitForFunction(()=>typeof window.releasePrivateDecode==='function');
 await page.evaluate(()=>{window.privateChanged=true;RunningSOPTeamSettings={...RunningSOPTeamSettings,read:async()=>({enabled:false})};window.releasePrivateDecode();});
 await page.waitForFunction(()=>document.querySelector('#steps').children.length===0);await pause(150);
 assert.equal(await page.evaluate(()=>window.privateImageInserted),false,'A previous-account decoded image must never enter the live reader');assert.equal(await page.locator('#steps img').count(),0);
}));

test('sidebar Edit during a held tab query never creates a partial guide draft',{timeout:60000},()=>fixture(async({page,image})=>{
 await readReady(page);
 await page.evaluate(()=>{const query=chrome.tabs.query;chrome.tabs.query=async(...args)=>{window.queryHeld=true;await new Promise(resolve=>{window.releaseTabQuery=resolve;});return query(...args);};window.heldRefresh=WorkspaceApp.refresh();});
 await page.waitForFunction(()=>window.queryHeld);
 if(await page.locator('#edit-sop').isVisible()){
  await page.locator('#edit-sop').click();await page.waitForFunction(()=>!document.querySelector('#edit-sop').disabled);
 }
 for(const saved of await drafts(page)){
  assert.equal(saved.steps.length,24);for(const step of saved.steps)assert.equal(step.image,image);assert.equal(saved.steps[0].issues.length,2);for(const issue of saved.steps[0].issues)assert.equal(issue.image,image);
 }
 await page.evaluate(async()=>{window.releaseTabQuery();await window.heldRefresh;});
}));

test('sidebar screenshot-viewer refresh preserves complete Edit provenance',{timeout:60000},()=>fixture(async({page,image,requests})=>{
 await readReady(page);await page.evaluate(async()=>{window.syntheticTab.url=chrome.runtime.getURL('screenshot-viewer.html');await WorkspaceApp.refresh();});
 await page.locator('#edit-sop').click();await page.locator('#editor').waitFor({state:'visible'});assert.ok(fullRequests(requests).length>=1);
 const saved=(await drafts(page))[0];assert.equal(saved.steps.length,24);for(const step of saved.steps)assert.equal(step.image,image);for(const issue of saved.steps[0].issues)assert.equal(issue.image,image);assert.equal(saved.steps[0].issues.length,2);
}));

test('sidebar repeatedly selecting issues reuses verified images and keeps annotations',{timeout:60000},()=>fixture(async({page,requests})=>{
 await readReady(page);await page.locator('#steps .issue-toggle').first().click();
 for(let cycle=0;cycle<10;cycle++)for(let choice=0;choice<2;choice++){
  await page.locator('#steps .issue-choice').nth(choice).click();await page.locator('#steps .issue-panel img').waitFor();assert.ok(await page.locator('#steps .issue-panel .image-marks-overlay svg').count(),'Selected issue annotations survive holder reuse');
 }
 assert.equal(imageRequests(requests).filter(url=>url.includes('/issues/')).length,2,'Each selected issue image is fetched once across repeated choices');assert.ok(await page.locator('#steps > .step').first().locator('.image-marks-overlay svg').count(),'Step annotations remain present');
}));
