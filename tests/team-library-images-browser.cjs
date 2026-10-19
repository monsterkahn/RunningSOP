'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const {TeamStore}=require('../server/store.cjs'),{createTeamServer}=require('../server/app.cjs');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
const imagePath=/\/v1\/sops\/[^/]+\/images\//;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fixture(run,{legacy=false,noObserver=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-library-images-'));let context,store,server;
 try{
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  store=new TeamStore({dbPath:path.join(directory,'library.sqlite')});const actor=store.createSession({displayName:'Synthetic seed'}).actor;
  const image='data:image/jpeg;base64,'+fs.readFileSync(path.resolve(__dirname,'../examples/illustrations/demo-step.jpg')).toString('base64');
  const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'images-a',title:'Synthetic images A',version:'1',notice:'',steps:Array.from({length:24},(_,i)=>({id:'step-'+i,title:'Step '+i,where:'Synthetic',actions:['Historical action '+i],expected:'',trouble:'',acceptance:[],image,imageMarks:[{type:'number',x:.2,y:.3}],issues:i===0?[{id:'issue-one',title:'Synthetic exception',actions:['Review exception'],next:'Continue',image}]:[]}))};
  store.create(guide,{actor,idempotencyKey:'images-seed-a'});const lease=store.acquireLock('images-a',{actor});store.publish('images-a',{...guide,version:'2',steps:guide.steps.map(step=>({...step,actions:['Current action']}))},{actor,...lease,expectedRevision:1,idempotencyKey:'images-publish-a'});
  store.create({...guide,workflowId:'images-b',title:'Synthetic images B',steps:[{...guide.steps[0],actions:['Second SOP']}]},{actor,idempotencyKey:'images-seed-b'});
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
  if(noObserver)await page.addInitScript(()=>{window.IntersectionObserver=undefined;});
  if(legacy)await page.route('**/v1/capabilities',async route=>{const response=await route.fetch(),body=await response.json();body.data.features=body.data.features.filter(feature=>feature!=='read-view-images');await route.fulfill({response,json:body});});
  const requests=[];let activeImages=0,maxImages=0;
  page.on('request',request=>{if(!request.url().startsWith(endpoint))return;requests.push(new URL(request.url()).pathname+new URL(request.url()).search);if(imagePath.test(request.url())){activeImages++;maxImages=Math.max(maxImages,activeImages);}});
  const completed=request=>{if(request.url().startsWith(endpoint)&&imagePath.test(request.url()))activeImages--;};page.on('requestfinished',completed);page.on('requestfailed',completed);
  // Keep actual HTTP responses in flight long enough to expose unbounded queues.
  await page.route(imagePath,async route=>{const response=await route.fetch();await pause(75);await route.fulfill({response}).catch(()=>{});});
  await page.goto(origin+'/team-library.html');await page.waitForFunction(()=>document.querySelectorAll('#sops li button').length===2);
  const open=async id=>{await page.locator('#sops li').filter({hasText:'Synthetic images '+id}).locator('button').click();await page.waitForFunction(()=>document.querySelectorAll('#guide article').length>0);};
  await run({page,options,requests,open,getMax:()=>maxImages});
 }finally{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
}
const imageRequests=requests=>requests.filter(url=>imagePath.test(url));
const fullRequests=requests=>requests.filter(url=>/^\/v1\/sops\/images-[ab](?:\?|$)/.test(url));
async function settle(page){await page.waitForFunction(()=>document.querySelector('#guide img'));await pause(350);}

test('old service retains complete reads and renders images without separate image requests',{timeout:60000},()=>fixture(async({page,requests,open})=>{
 assert.equal(fullRequests(requests).length,0);assert.equal(requests.some(url=>url.endsWith('/view')),false);
 await open('A');await settle(page);assert.equal(fullRequests(requests).length,1);assert.equal(imageRequests(requests).length,0);assert.equal(requests.some(url=>url.includes('/view')),false);
},{legacy:true}));

test('library negotiates text views, bounds visible images, and reads exact historical images and marks',{timeout:60000},()=>fixture(async({page,requests,open,getMax})=>{
 assert.equal(requests.some(url=>url.includes('/view')||url==='/v1/capabilities'),false,'Listing must not negotiate or prefetch SOP views');
 await open('A');await settle(page);assert.ok(requests.includes('/v1/sops/images-a/view'));assert.equal(fullRequests(requests).length,0);
 const initial=imageRequests(requests);assert.ok(initial.length>0&&initial.length<24,'Only the nearby step thumbnails should load');assert.equal(initial.some(url=>url.includes('/issues/')),false,'Closed issues must not fetch images');assert.ok(await page.locator('#guide .image-marks-overlay svg').count());
 const beforePreview=imageRequests(requests).length;for(let i=0;i<2;i++){await page.locator('#guide article').first().locator(':scope > .picture').click();await page.locator('#image-dialog').waitFor({state:'visible'});await page.locator('#close-image').click();}assert.equal(imageRequests(requests).length,beforePreview,'Full-size previews reuse the verified thumbnail image');
 await page.locator('#guide article').last().scrollIntoViewIfNeeded();await page.locator('#guide article').last().locator('img').waitFor();assert.ok(imageRequests(requests).some(url=>url.includes('/images/23?revision=2')));
 await page.locator('#guide article').first().locator('details summary').click();await page.locator('#guide article').first().locator('details img').waitFor();assert.ok(imageRequests(requests).includes('/v1/sops/images-a/images/0/issues/0?revision=2'));
 await page.locator('#history-sop').click();await page.waitForFunction(()=>document.querySelectorAll('#history li').length===2);await page.locator('#history li').last().locator('button').click();await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('Historical action'));await page.locator('#guide article').first().scrollIntoViewIfNeeded();await page.locator('#guide article').first().locator('img').waitFor();
 assert.ok(requests.includes('/v1/sops/images-a/view?revision=1'));assert.ok(imageRequests(requests).includes('/v1/sops/images-a/images/0?revision=1'));assert.ok(await page.locator('#guide article').first().locator('.image-marks-overlay svg').count());assert.equal(fullRequests(requests).length,0);assert.ok(getMax()<=2,'At most two thumbnail requests may be active');
}));

test('fallback without IntersectionObserver bounds requests and keeps closed issue images private',{timeout:60000},()=>fixture(async({page,requests,open,getMax})=>{
 await open('A');await settle(page);await page.waitForFunction(()=>document.querySelectorAll('#guide > article > .picture img').length===24);assert.equal(imageRequests(requests).filter(url=>url.includes('/issues/')).length,0);assert.ok(getMax()<=2);assert.equal(fullRequests(requests).length,0);
 await page.locator('#guide details summary').click();await page.locator('#guide details img').waitFor();assert.equal(imageRequests(requests).filter(url=>url.includes('/issues/')).length,1);
},{noObserver:true}));

test('changing SOP and clearing account cancel held images and clear enlarged previews',{timeout:60000},()=>fixture(async({page,options,requests,open})=>{
 let release,seen;const held=new Promise(resolve=>{seen=resolve;});let hold=true;const aborted=[];page.on('requestfailed',request=>{if(imagePath.test(request.url()))aborted.push(request.url());});
 await page.route('**/v1/sops/images-a/images/**',async route=>{const response=await route.fetch();if(hold){hold=false;seen();await new Promise(resolve=>{release=resolve;});}await route.fulfill({response}).catch(()=>{});});
 await open('A');await held;hold=false;await page.locator('#sops li').filter({hasText:'Synthetic images B'}).locator('button').click();await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('Second SOP'));release();await page.locator('#guide img').waitFor();await pause(150);assert.equal(await page.locator('#guide article').count(),1);assert.ok(aborted.length>0,'Switching SOP must abort old image fetches');
 await page.locator('#guide .picture').first().click();await page.locator('#image-dialog').waitFor({state:'visible'});
 // Opening an issue while the preview is open leaves a held image request; account changes must clear both.
 let releaseAccount,seenAccount;const accountHeld=new Promise(resolve=>{seenAccount=resolve;});await page.route('**/v1/sops/images-b/images/*/issues/*',async route=>{const response=await route.fetch();seenAccount();await new Promise(resolve=>{releaseAccount=resolve;});await route.fulfill({response}).catch(()=>{});});
 await page.locator('#guide details summary').evaluate(summary=>summary.click());await accountHeld;const before=aborted.length;await options.evaluate(()=>RunningSOPTeamSettings.clear());await page.waitForFunction(()=>document.querySelector('#query').disabled&&document.querySelector('#guide').children.length===0);releaseAccount();await page.locator('#image-dialog').waitFor({state:'hidden'});await pause(100);assert.ok(aborted.length>before);assert.equal(await page.locator('#large-picture img').count(),0);assert.equal(await page.locator('#guide img').count(),0);
}));


test('advertised corrupt views fail closed without a complete-read fallback',{timeout:60000},()=>fixture(async({page,requests})=>{
 await page.route('**/v1/sops/images-a/view',async route=>{const response=await route.fetch(),body=await response.json();body.data.viewSha256='0'.repeat(64);await route.fulfill({response,json:body});});
 await page.locator('#sops li').filter({hasText:'Synthetic images A'}).locator('button').click();await page.waitForFunction(()=>document.querySelector('#reader-status').classList.contains('error'));assert.equal(fullRequests(requests).length,0);assert.equal(imageRequests(requests).length,0);assert.equal(await page.locator('#guide img').count(),0);
}));

// Private settings can change before the public storage invalidation event arrives.
// A completed decode must recheck that identity before attaching its staged nodes.
test('thumbnail decode rechecks private account identity before inserting image nodes',{timeout:60000},()=>fixture(async({page})=>{
 await page.evaluate(()=>{
  const render=ScreenshotEditor.renderFigure;let first=true;window.privateChanged=false;window.privateImageInserted=false;
  const inspect=node=>node.nodeType===1&&(node.matches('img')||node.querySelector('img'));
  new MutationObserver(records=>{if(window.privateChanged&&records.some(record=>[...record.addedNodes].some(inspect)))window.privateImageInserted=true;}).observe(document.querySelector('#guide'),{childList:true,subtree:true});
  ScreenshotEditor.renderFigure=async(box,step)=>{
   if(first&&box.id!=='large-picture'){first=false;await new Promise(resolve=>{window.releasePrivateDecode=resolve;});}
   return render(box,step);
  };
 });
 await page.locator('#sops li').filter({hasText:'Synthetic images A'}).locator('button').click();await page.waitForFunction(()=>typeof window.releasePrivateDecode==='function');
 await page.evaluate(()=>{window.privateChanged=true;RunningSOPTeamSettings={...RunningSOPTeamSettings,read:async()=>({enabled:false})};window.releasePrivateDecode();});
 await page.waitForFunction(()=>document.querySelector('#query').disabled&&document.querySelector('#guide').children.length===0);
 assert.equal(await page.evaluate(()=>window.privateImageInserted),false,'No image from the previous account may enter the live guide after private identity changes');assert.equal(await page.locator('#guide img').count(),0);assert.equal(await page.locator('#reader').isVisible(),false);
}));
