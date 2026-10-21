'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),extension=process.env.RUNTIME_SOP_EXTENSION||path.join(root,'extension');
const nodes=['alpha','beta','gamma'].map(id=>({id:'synthetic-'+id,title:'Synthetic '+id,stepCount:1}));

test('connected relationships preserve drafts, require explicit writes and fence stale sources',{timeout:120000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sop-connected-relations-'));let context;
 try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host,errors=[],external=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  context.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
  await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}}));
  await context.addInitScript(()=>{
   if(!location.pathname.endsWith('/relationships.html'))return;
   window.audit={pickers:0,requests:[],creates:0,writers:0};window.permissionResult='denied';
   window.showDirectoryPicker=async()=>{audit.pickers++;throw Error('Unexpected picker');};
   FileSystemHandle.prototype.requestPermission=function(options){audit.requests.push({mode:options.mode,active:navigator.userActivation.isActive});if(window.holdPermission)return new Promise(resolve=>{window.releasePermission=()=>resolve('granted');});return Promise.resolve(window.permissionResult);};
   const getFile=FileSystemDirectoryHandle.prototype.getFileHandle,getDir=FileSystemDirectoryHandle.prototype.getDirectoryHandle,writable=FileSystemFileHandle.prototype.createWritable;
   FileSystemDirectoryHandle.prototype.getFileHandle=async function(name,options){if(options?.create)audit.creates++;if(name==='catalog.json'&&new URLSearchParams(location.search).has('delay')&&!window.readDelayed){window.readDelayed=true;await new Promise(resolve=>{window.releaseRead=resolve;});}return getFile.call(this,name,options);};
   FileSystemDirectoryHandle.prototype.getDirectoryHandle=function(name,options){if(options?.create)audit.creates++;return getDir.call(this,name,options);};
   FileSystemFileHandle.prototype.createWritable=function(...args){audit.writers++;return writable.apply(this,args);};
  });
  const settings=await context.newPage();await settings.goto(origin+'/options.html');await settings.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='unconfigured');
  const entries=()=>settings.evaluate(async()=>{const names=[];for await(const [name]of(await navigator.storage.getDirectory()).entries())names.push(name);return names.sort();});
  const before=await entries(),fresh=await context.newPage();await fresh.goto(origin+'/relationships.html?source=connected');
  await fresh.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));
  assert.equal(await fresh.locator('#save').isDisabled(),true);assert.deepEqual(await fresh.evaluate(()=>audit),{pickers:0,requests:[],creates:0,writers:0});assert.deepEqual(await entries(),before);await fresh.close();
  async function selectFolder(name){
   await settings.evaluate(async name=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(name,{create:true});window.showDirectoryPicker=async()=>dir;},name);
   await settings.locator('#choose-sop-folder').click();await settings.waitForFunction(name=>document.querySelector('#source-name').textContent===name&&!document.querySelector('#choose-sop-folder').disabled,name);
  }
  async function publish(){await settings.evaluate(async nodes=>{for(const n of nodes)await NASPublisher.publish({format:'runtime-sop-guide',schemaVersion:1,workflowId:n.id,title:n.title,version:'1.0',notice:'Synthetic fixture',steps:[{id:'first',title:'First',workUrl:'https://work.example.test/relations',where:'Synthetic work',actions:['Synthetic action'],expected:'',trouble:'',acceptance:[]}]});await chrome.runtime.sendMessage({type:'catalog-check'});},nodes);}
  await selectFolder('Synthetic relations A');await publish();
  const seed='#seed='+encodeURIComponent(JSON.stringify({source:'dashboard',nodes})),page=await context.newPage();
  await page.goto(origin+'/relationships.html?source=connected&delay=1'+seed);await page.waitForFunction(()=>window.readDelayed);
  async function add(from,to){await page.locator('#from').selectOption('synthetic-'+from);await page.locator('#to').selectOption('synthetic-'+to);await page.locator('#add-link').click();}
  const edges=()=>page.locator('#edges > [data-edge]').count();
  await add('alpha','beta');await page.locator('#node-x').fill('321');await page.locator('#node-y').fill('234');await page.locator('#position').click();
  await page.evaluate(()=>releaseRead());await page.waitForFunction(()=>!document.querySelector('#save').disabled);
  assert.equal(await edges(),1);assert.equal(await page.locator('[data-node="synthetic-alpha"]').getAttribute('transform'),'translate(321 234)');
  assert.deepEqual(await page.evaluate(()=>audit),{pickers:0,requests:[],creates:0,writers:0});
  const relations=()=>settings.evaluate(async()=>{const result={};for(const name of ['Synthetic relations A','Synthetic relations B']){try{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle(name);try{result[name]=JSON.parse(await(await(await dir.getFileHandle('relations.json')).getFile()).text());}catch(e){if(e.name!=='NotFoundError')throw e;result[name]=null;}}catch(e){if(e.name!=='NotFoundError')throw e;result[name]=null;}}return result;});
  await page.locator('#save').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled&&document.querySelector('#status').classList.contains('error'));
  assert.equal(await edges(),1);assert.match(await page.locator('#save').textContent(),/·/);assert.equal((await relations())['Synthetic relations A'],null);assert.deepEqual(await page.evaluate(()=>[audit.creates,audit.writers]),[0,0]);
  await page.locator('#use-connected').click();await page.waitForFunction(()=>!document.querySelector('#use-connected').disabled&&document.querySelector('#status').classList.contains('ok'));assert.equal(await edges(),1);assert.match(await page.locator('#save').textContent(),/·/);
  await add('beta','gamma');await page.evaluate(()=>{window.permissionResult='granted';});await page.locator('#save').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled&&!document.querySelector('#save').textContent.includes('·'));
  const saved=(await relations())['Synthetic relations A'];assert.equal(saved.revision,1);assert.deepEqual(saved.edges.map(({from,to,kind})=>({from,to,kind})),[{from:'synthetic-alpha',to:'synthetic-beta',kind:'next'},{from:'synthetic-beta',to:'synthetic-gamma',kind:'next'}]);assert.deepEqual(saved.nodes.find(n=>n.workflowId==='synthetic-alpha'),{workflowId:'synthetic-alpha',x:321,y:234});
  assert.deepEqual(await page.evaluate(()=>audit.requests),[{mode:'readwrite',active:true},{mode:'readwrite',active:true}]);
  // Another editor advances the shared revision; reconnect and Save must retain this draft.
  await page.locator('#from').selectOption('synthetic-alpha');await page.locator('#node-x').fill('456');await page.locator('#position').click();
  await settings.evaluate(async()=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic relations A'),fh=await dir.getFileHandle('relations.json'),data=JSON.parse(await(await fh.getFile()).text());data.revision++;data.updatedAt='2026-01-01T00:00:00.000Z';const writer=await fh.createWritable();await writer.write(JSON.stringify(data));await writer.close();});
  const writes=await page.evaluate(()=>audit.writers);await page.locator('#use-connected').click();await page.waitForFunction(()=>!document.querySelector('#use-connected').disabled&&document.querySelector('#status').classList.contains('error'));
  assert.equal(await edges(),2);assert.equal(await page.locator('[data-node="synthetic-alpha"]').getAttribute('transform'),'translate(456 234)');assert.match(await page.locator('#save').textContent(),/·/);
  await page.locator('#save').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled&&document.querySelector('#status').classList.contains('error'));assert.equal(await page.evaluate(()=>audit.writers),writes);assert.equal((await relations())['Synthetic relations A'].revision,2);assert.equal(await edges(),2);
  // Reload revision 2 so the pending Save would succeed without the source guard.
  page.once('dialog',dialog=>dialog.accept());await page.locator('#reload-folder').click();await page.waitForFunction(()=>!document.querySelector('#save').disabled&&!document.querySelector('#save').textContent.includes('·'));
  await page.locator('#from').selectOption('synthetic-alpha');await page.locator('#node-x').fill('456');await page.locator('#position').click();
  // Hold native authorization while Settings changes to a different folder with identical IDs.
  await page.evaluate(()=>{window.holdPermission=true;});await page.locator('#save').click();await page.waitForFunction(()=>typeof window.releasePermission==='function');
  await selectFolder('Synthetic relations B');await publish();await page.waitForFunction(()=>document.querySelector('#save').disabled&&document.querySelector('#folder-state').textContent===DashboardI18n.t('尚未连接文件夹。可编辑和导出，保存共享关系前请明确选择 SOP 文件夹。'));
  await page.evaluate(()=>releasePermission());await page.waitForFunction(()=>!document.querySelector('#use-connected').disabled);
  const after=await relations();assert.equal(after['Synthetic relations A'].revision,2);assert.equal(after['Synthetic relations B'],null);assert.equal(await page.evaluate(()=>audit.writers),writes);assert.equal(await edges(),2);assert.equal(await page.locator('#save').isDisabled(),true);assert.match(await page.locator('#save').textContent(),/·/);assert.equal(await page.evaluate(()=>audit.pickers),0);
  await page.locator('#use-connected').click();assert.equal(await page.locator('#save').isDisabled(),true);assert.equal(await edges(),2);assert.equal((await relations())['Synthetic relations B'],null);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
