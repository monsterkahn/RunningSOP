'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
test('team acknowledgement opens reading even when saving the local edit link fails',{timeout:60000},async()=>{
 const {TeamStore}=require('../server/store.cjs'),{createTeamServer}=require('../server/app.cjs');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-team-published-read-'));let context,store,server;
 try{
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  store=new TeamStore({dbPath:path.join(directory,'synthetic.sqlite')});const actor=store.createSession({displayName:'Synthetic seed'}).actor;
  store.create({format:'runtime-sop-guide',schemaVersion:1,workflowId:'team-publish-read',title:'Team exact publication',version:'1',notice:'',steps:[{id:'first',title:'',where:'Synthetic',workUrl:'https://work.example.test/publish',actions:['Before publication'],expected:'',trouble:'',acceptance:[]}]},{actor,idempotencyKey:'synthetic-team-publish-read'});
  server=createTeamServer({store,joinCode:'synthetic-published-read-code',allowOrigins:[origin]});let writes=0;server.on('request',request=>{if(request.method==='PUT'&&request.url==='/v1/sops/team-publish-read')writes++;});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const endpoint='http://127.0.0.1:'+server.address().port,options=await context.newPage();await options.goto(origin+'/options.html');await options.waitForFunction(()=>!!window.RunningSOPTeamSettings);
  await options.evaluate(async endpoint=>{await chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}});chrome.permissions.request=async()=>true;await RunningSOPTeamSettings.connect({endpoint,displayName:'Synthetic publication actor',joinCode:'synthetic-published-read-code'});},endpoint);
  const page=await context.newPage();await page.addInitScript(()=>{chrome.tabs.query=async()=>[{id:12345,url:'https://work.example.test/publish',title:'Synthetic work'}];});await page.goto(origin+'/workspace.html');await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');await page.locator('#steps .step').waitFor();
  await page.locator('#edit-sop').click();await page.locator('#editor').waitFor({state:'visible'});await page.locator('#edit-action').fill('After verified team publication');await page.locator('#preview-publish').click();await page.locator('#confirm-publish').check();
  await page.evaluate(()=>{const write=chrome.storage.local.set.bind(chrome.storage.local);chrome.storage.local.set=async value=>{if(Object.hasOwn(value,'runtime-sop-draft-links-v1')){chrome.storage.local.set=write;throw Error('Synthetic local link quota');}return write(value);};});
  await page.locator('#publish-nas').click();await page.waitForFunction(()=>document.documentElement.dataset.mode==='view'&&document.querySelector('#steps').textContent.includes('After verified team publication'));
  assert.equal(writes,1);assert.equal(store.get('team-publish-read').revision,2);assert.equal(await page.locator('#publish-view').isVisible(),false);assert.match(await page.locator('#view-status').textContent(),/Published/);assert.equal((await page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts)).length,0);
  await page.locator('.step-actions .sop-step-feedback-trigger').click();await page.locator('.sop-step-feedback-dialog').waitFor({state:'visible'});await page.locator('.sop-step-feedback-dialog button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('.sop-step-feedback-dialog [role=status]').textContent.includes('Saved on this browser only'));
  const record=await page.evaluate(async()=>(await chrome.storage.local.get('runtime-sop-step-feedback-v1'))['runtime-sop-step-feedback-v1'].records[0]);assert.equal(record.source,'team');assert.equal(record.workflowId,'team-publish-read');assert.equal(record.revision,'2');
 }finally{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
});
test('folder publication failure retains the draft; verified success opens the exact published SOP and scoped feedback',{timeout:60000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sop-published-read-'));let context;
 try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}}));
  const options=await context.newPage();await options.goto(origin+'/options.html');await options.waitForFunction(()=>!!window.SOPStorageSource);
  await options.evaluate(async()=>{const directory=await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic publication',{create:true});window.showDirectoryPicker=async()=>directory;});
  await options.locator('#choose-sop-folder').click();await options.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='ready');
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{chrome.tabs.query=async()=>[{id:12345,url:'https://work.example.test/publish',title:'Synthetic publication task'}];});
  await page.goto(origin+'/workspace.html');await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  await page.evaluate(async()=>{
   const draft={id:'synthetic-publish-draft',title:'Exact published SOP',status:'draft',origin:'https://work.example.test',createdAt:'',updatedAt:'',steps:[{id:'first',type:'manual',title:'',url:'https://work.example.test/publish',workUrl:'https://work.example.test/publish',where:'Synthetic',action:'Verified published action',expected:'',acceptance:'',trouble:'',at:''}]};
   const blank={...draft.steps[0],title:'',action:'',where:'',expected:'',acceptance:'',trouble:''};draft.steps=[{...blank,id:'cleared-first'},draft.steps[0],{...blank,id:'cleared-last'}];
   const response=await chrome.runtime.sendMessage({type:'recorder-import',backup:{format:'runtime-sop-recording',schemaVersion:1,draft}});if(response.error)throw Error(response.error);await WorkspaceApp.refresh();await WorkspaceApp.openDraft(response.data.drafts.find(d=>d.title===draft.title).id);
  });
  await page.locator('#preview-publish').click();await page.locator('#confirm-publish').check();
  const expected=await page.evaluate(()=>WorkspaceApp.buildGuide());assert.equal(expected.steps.length,1);assert.equal(expected.steps[0].id,'step-1');
  await page.evaluate(()=>{window.actualPublish=NASPublisher.publish;NASPublisher.publish=async()=>{throw Error('Synthetic unavailable disk');};});
  await page.locator('#publish-nas').click();await page.waitForFunction(()=>document.querySelector('#publish-status').textContent.includes('Synthetic unavailable disk'));
  assert.equal(await page.locator('#publish-view').isVisible(),true);assert.equal(await page.locator('#view').isVisible(),false);
  assert.ok((await page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts)).some(d=>d.steps.some(s=>s.action==='Verified published action')));
  await page.evaluate(()=>{NASPublisher.publish=(...args)=>{window.publishQueuedOptions=args[1];return window.actualPublish(...args);};navigator.locks.request('runtime-sop-nas-publish',{mode:'exclusive'},async()=>{window.publicationHeld=true;await new Promise(resolve=>{window.releasePublishLock=resolve;});});});await page.waitForFunction(()=>window.publicationHeld);
  await page.locator('#publish-nas').click();await page.waitForFunction(()=>window.publishQueuedOptions?.expectedDirectoryHandle);
  await options.evaluate(async()=>{const directory=await(await navigator.storage.getDirectory()).getDirectoryHandle('Queued other library',{create:true});window.showDirectoryPicker=async()=>directory;});await options.locator('#choose-sop-folder').click();await options.waitForFunction(()=>document.querySelector('#source-name').textContent==='Queued other library');
  await page.evaluate(()=>window.releasePublishLock());await page.waitForFunction(()=>!document.querySelector('#publish-nas').disabled);assert.equal(await page.locator('#publish-view').isVisible(),true);
  const queuedCatalog=await options.evaluate(async()=>JSON.parse(await(await(await(await(await navigator.storage.getDirectory()).getDirectoryHandle('Queued other library')).getFileHandle('catalog.json')).getFile()).text()));assert.equal(queuedCatalog.workflows.length,0,'A queued publication must never write the newly selected library');
  await options.evaluate(async()=>{const directory=await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic publication');window.showDirectoryPicker=async()=>directory;});await options.locator('#choose-sop-folder').click();await options.waitForFunction(()=>document.querySelector('#source-name').textContent==='Synthetic publication');
  // A local bookkeeping failure after the real disk commit is not a failed publication.
  await page.evaluate(()=>{NASPublisher.publish=window.actualPublish;const write=chrome.storage.local.set.bind(chrome.storage.local);window.actualLocalSet=write;chrome.storage.local.set=async value=>{if(Object.hasOwn(value,'runtime-sop-draft-links-v1')){chrome.storage.local.set=write;throw Error('Synthetic local link quota');}return write(value);};});await page.locator('#publish-nas').click();
  await page.waitForFunction(()=>document.documentElement.dataset.mode==='view'&&document.querySelector('#steps').textContent.includes('Verified published action'));
  assert.equal(await page.locator('html').getAttribute('data-workflow'),expected.workflowId);
  assert.equal(await page.locator('#publish-view').isVisible(),false);assert.equal(await page.locator('#read-draft').isVisible(),false);assert.equal(await page.locator('#candidates button').count(),0);
  assert.match(await page.locator('#view-status').textContent(),/Published · Reading this SOP: Exact published SOP/);
  assert.equal(await page.locator('#edit-sop').evaluate(e=>document.activeElement===e),true);
  assert.equal((await page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts)).length,0);
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true'&&document.querySelector('#steps').textContent.includes('Verified published action'));
  assert.equal(await page.locator('#read-draft').isVisible(),false);assert.equal(await page.locator('#candidates button').count(),0);
  // Older installations can still contain a linked draft; deduplication remains compatible.
  await page.evaluate(async expected=>{const draft={id:'legacy-editing-copy',title:'Legacy editing copy',status:'draft',origin:'https://work.example.test',createdAt:'',updatedAt:'',steps:[{id:'legacy-first',type:'manual',title:'',url:'https://work.example.test/publish',workUrl:'https://work.example.test/publish',where:'Synthetic',action:'Legacy editable content',expected:'',acceptance:'',trouble:'',at:''}]};const response=await chrome.runtime.sendMessage({type:'recorder-import',backup:{format:'runtime-sop-recording',schemaVersion:1,draft}});const d=response.data.drafts.find(d=>d.title==='Legacy editing copy');const snapshot=await CatalogSync.loadSnapshot(),w=snapshot.catalog.workflows.find(w=>w.id===expected.workflowId);await chrome.storage.local.set({'runtime-sop-draft-links-v1':{[d.id]:{workflowId:w.id,version:expected.version,sourceSha:w.sha256}}});},expected);
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true'&&document.querySelector('#steps').textContent.includes('Verified published action'));
  assert.equal(await page.locator('#read-draft').isVisible(),true);assert.equal(await page.locator('#candidates button').count(),0);
  // An unrelated same-title draft must remain a separate choice; names never merge identity.
  await page.evaluate(async()=>{const draft={id:'unrelated-same-title',title:'Exact published SOP',status:'draft',origin:'https://work.example.test',createdAt:'',updatedAt:'',steps:[{id:'unrelated-first',type:'manual',title:'',url:'https://work.example.test/publish',workUrl:'https://work.example.test/publish',where:'Synthetic',action:'Unrelated local task',expected:'',acceptance:'',trouble:'',at:''}]};await chrome.runtime.sendMessage({type:'recorder-import',backup:{format:'runtime-sop-recording',schemaVersion:1,draft}});});
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true'&&document.querySelectorAll('#candidates button').length===2);await page.getByRole('button',{name:'Exact published SOP',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#steps').textContent.includes('Verified published action'));assert.equal(await page.locator('html').getAttribute('data-workflow'),expected.workflowId);
  const trigger=page.locator('.step-actions .sop-step-feedback-trigger');await trigger.click();
  await page.locator('.sop-step-feedback-dialog').waitFor({state:'visible'});await page.locator('.sop-step-feedback-dialog textarea').fill('Synthetic correction for this exact step');await page.locator('.sop-step-feedback-dialog button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('.sop-step-feedback-dialog [role=status]').textContent.includes('Saved on this browser only'));
  const feedback=await page.evaluate(async()=>(await chrome.storage.local.get('runtime-sop-step-feedback-v1'))['runtime-sop-step-feedback-v1'].records);
  assert.equal(feedback.length,1);assert.equal(feedback[0].workflowId,expected.workflowId);assert.equal(feedback[0].stepId,expected.steps[0].id);assert.equal(feedback[0].section,'actions');assert.match(feedback[0].revision,/^[a-f0-9]{64}$/);assert.equal(feedback[0].note,'Synthetic correction for this exact step');assert.equal(JSON.stringify(feedback).includes('https://work.example.test'),false);
  // A second panel editing during the disk write must keep its newer draft.
  await page.keyboard.press('Escape');await page.locator('#edit-sop').click();await page.locator('#editor').waitFor({state:'visible'});
  await page.locator('#edit-action').fill('Publication before concurrent edit');await page.locator('#preview-publish').click();await page.locator('#confirm-publish').check();
  await page.evaluate(()=>{const publish=NASPublisher.publish;NASPublisher.publish=async(...args)=>{const state=(await chrome.runtime.sendMessage({type:'recorder-get'})).data,d=state.drafts.find(d=>d.steps.some(s=>s.action==='Publication before concurrent edit'));const steps=d.steps.map(s=>({...s,action:'Newer work from another panel'}));await chrome.runtime.sendMessage({type:'recorder-update',id:d.id,patch:{steps}});return publish(...args);};});
  await page.locator('#publish-nas').click();await page.waitForFunction(()=>document.documentElement.dataset.mode==='view'&&document.querySelector('#steps').textContent.includes('Publication before concurrent edit'));
  assert.match(await page.locator('#view-status').textContent(),/cleanup was incomplete/);
  const retained=await page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts);
  assert.ok(retained.some(d=>d.steps.some(s=>s.action==='Newer work from another panel')));assert.ok(retained.some(d=>d.steps.some(s=>s.action==='Unrelated local task')));
  await page.keyboard.press('Escape');await trigger.click();await page.locator('.sop-step-feedback-dialog').waitFor({state:'visible'});
  await options.evaluate(async()=>{const directory=await(await navigator.storage.getDirectory()).getDirectoryHandle('Other publication library',{create:true});window.showDirectoryPicker=async()=>directory;});await options.locator('#choose-sop-folder').click();await options.waitForFunction(()=>document.querySelector('#source-name').textContent==='Other publication library');
  await page.locator('.sop-step-feedback-dialog').waitFor({state:'detached'});await page.waitForFunction(()=>document.querySelector('#steps').children.length===0);
  assert.deepEqual(errors,[]);
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
