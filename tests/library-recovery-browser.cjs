'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
test('overview retains verified cached SOPs and recovers a broken source through an explicit folder choice',{timeout:90000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sop-library-recovery-'));let context;
 try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}}));
  const settings=await context.newPage();await settings.goto(origin+'/options.html');await settings.waitForFunction(()=>window.NASPublisher&&window.SOPStorageSource);
  await settings.evaluate(()=>{window.showDirectoryPicker=async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic recovery library',{create:true});});
  await settings.locator('#choose-sop-folder').click();await settings.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='ready');
  await settings.evaluate(async()=>{
   await NASPublisher.publish({format:'runtime-sop-guide',schemaVersion:1,workflowId:'synthetic-recovery',title:'Synthetic cached SOP',version:'1.0',notice:'',steps:[{id:'one',title:'',where:'Synthetic work',workUrl:'https://work.example.test/recovery',actions:['Synthetic cached action'],expected:'',trouble:'',acceptance:[]}]});
   await chrome.runtime.sendMessage({type:'catalog-check'});await CatalogSync.loadWorkflow('synthetic-recovery');
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/library.html?source=folder');await page.waitForFunction(()=>document.documentElement.dataset.libraryReady==='true');
  assert.equal(await page.locator('#sops tr').count(),1);
  // Isolate a native read denial without touching actual profiles or native prompts.
  await worker.evaluate(()=>{globalThis.originalSourceRead=SOPStorageSource.read;SOPStorageSource.read=async()=>{throw new DOMException('Synthetic folder read denied','NotAllowedError');};});
  await page.evaluate(()=>{SOPFolderHistory.read=async()=>{throw Error('Cached current SOP must not read history files');};});
  await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('previously verified'));
  assert.equal(await page.locator('#sops tr').count(),1);assert.equal(await page.locator('#choose-folder').isVisible(),true);assert.match(await page.locator('#failure-reason').textContent(),/Synthetic folder read denied/);
  await page.locator('#sops .read-sop').click();await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('Synthetic cached action'));assert.equal(await page.locator('#history-open').isDisabled(),true);
  await page.locator('#back-list').click();
  const previousCache=await page.evaluate(async()=>{const cache=(await chrome.storage.local.get(CatalogSync.CACHE))[CatalogSync.CACHE],next=structuredClone(cache),catalog=JSON.parse(next.rawCatalog);catalog.workflows[0].sha256='f'.repeat(64);next.rawCatalog=JSON.stringify(catalog);await chrome.storage.local.set({[CatalogSync.CACHE]:next});return cache;});
  await page.locator('#sops .read-sop').click();await page.waitForFunction(()=>document.querySelector('#reader-status').textContent.includes('changed or is not cached'));assert.equal(await page.locator('#guide').textContent(),'');
  await page.locator('#back-list').click();await page.evaluate(cache=>chrome.storage.local.set({[CatalogSync.CACHE]:cache}),previousCache);
  await page.evaluate(()=>chrome.storage.local.remove(CatalogSync.CACHE));await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.equal(await page.locator('#sops tr').count(),0);assert.equal(await page.locator('#recovery').isVisible(),true);assert.match(await page.locator('#failure-reason').textContent(),/Synthetic folder read denied/);
  // Permission diagnostics are distinct from an empty library.
  await page.evaluate(()=>{const original=SOPStorageSource.info;SOPStorageSource.info=async()=>({...await original(),readPermission:'prompt'});});await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('authorization'));
  await worker.evaluate(()=>{SOPStorageSource.read=globalThis.originalSourceRead;});
  await page.evaluate(()=>{window.showDirectoryPicker=()=>{if(!navigator.userActivation.isActive)throw Error('Picker lost user activation');return navigator.storage.getDirectory().then(root=>root.getDirectoryHandle('Synthetic recovery library'));};});
  await page.locator('#choose-folder').click();await page.waitForFunction(()=>document.documentElement.dataset.libraryReady==='true'&&document.querySelectorAll('#sops tr').length===1);
  assert.equal(await page.locator('#recovery').isVisible(),false);
  const enabled=await worker.evaluate(async()=>((await chrome.storage.local.get('runtime-sop-catalog-settings-v1'))['runtime-sop-catalog-settings-v1']).enabled);assert.equal(enabled,false,'Choosing a folder must not enable background polling');
  await page.locator('#sops .read-sop').click();await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('Synthetic cached action'));assert.equal(await page.locator('#history-open').isDisabled(),false);
  // A different source while open must discard the previous source's content.
  await settings.evaluate(()=>{window.showDirectoryPicker=async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic different library',{create:true});});await settings.locator('#choose-sop-folder').click();await page.waitForFunction(()=>document.querySelector('#guide').children.length===0&&document.querySelector('#status').textContent.includes('changed'));
  assert.equal(await page.locator('#reader').isVisible(),false);assert.equal(await page.locator('#choose-folder').isEnabled(),true);assert.deepEqual(errors,[]);
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
