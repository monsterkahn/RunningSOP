'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');
function fixtureFiles(directory,prefix=''){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const relative=prefix+entry.name,absolute=path.join(directory,entry.name);return entry.isDirectory()?fixtureFiles(absolute,relative+'/'):[{path:relative,base64:fs.readFileSync(absolute).toString('base64')}];});}
test('explicit folder selection adds missing pages, preserves user pages, and opens the selected data without polling',{timeout:120000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'running-sop-pages-'));let context;
 try{
  const extension=process.env.RUNTIME_SOP_EXTENSION||path.join(root,'extension');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
  await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en',guided:false}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`chrome-extension://${id}/options.html`);
  await page.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='unconfigured');
  assert.equal(await page.locator('#install-storage-pages').isDisabled(),true);
  assert.equal(await page.locator('#open-storage-dashboard').count(),0,'Settings has one overview entry');
  assert.equal(await page.locator('#open-folder-library').getAttribute('href'),'dashboard.html?source=connected');
  assert.equal(await page.evaluate(async()=>{let count=0;for await(const entry of (await navigator.storage.getDirectory()).values())count++;return count;}),0);
  const fresh=await context.newPage();await fresh.goto(`chrome-extension://${id}/dashboard.html?source=connected`);await fresh.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));assert.equal(await fresh.locator('#kpi-count').textContent(),'0');await fresh.close();
  await page.evaluate(async files=>{
   const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('SOP',{create:true});
   for(const file of files){const parts=file.path.split('/');let target=dir;for(const part of parts.slice(0,-1))target=await target.getDirectoryHandle(part,{create:true});const writer=await(await target.getFileHandle(parts.at(-1),{create:true})).createWritable();await writer.write(Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0)));await writer.close();}
   window.permissionTrace=[];window.readOnlyFolder=false;
   const nativeGet=FileSystemDirectoryHandle.prototype.getFileHandle,nativeQuery=FileSystemHandle.prototype.queryPermission;
   FileSystemDirectoryHandle.prototype.getFileHandle=function(...args){permissionTrace.push('read:'+args[0]);return nativeGet.apply(this,args);};
   FileSystemHandle.prototype.requestPermission=async function(options){permissionTrace.push('request:'+options.mode);return readOnlyFolder&&options.mode==='readwrite'?'denied':'granted';};
   FileSystemHandle.prototype.queryPermission=async function(options){if(readOnlyFolder&&options.mode==='readwrite')return 'denied';return nativeQuery.call(this,options);};
   window.showDirectoryPicker=async options=>{permissionTrace.push('picker:'+options.mode);return dir;};
  },fixtureFiles(path.join(root,'examples/storage')));
  await page.locator('#choose-sop-folder').click();
  await page.waitForFunction(()=>document.querySelector('#storage-pages-status').textContent.includes('pages are ready'));
  const trace=await page.evaluate(()=>permissionTrace);assert.equal(trace[0],'picker:readwrite');assert.ok(trace.indexOf('request:readwrite')<trace.findIndex(v=>v.startsWith('read:')));
  const readPages=()=>page.evaluate(async()=>{const dir=await SOPStorageSource.getHandle(),result={};for(const name of ['index.html','relationships.html'])result[name]=await(await(await dir.getFileHandle(name)).getFile()).text();return result;});
  assert.equal(await page.locator('#open-folder-library').evaluate(n=>Boolean(n.closest('#source-connection'))),false);assert.equal(await page.locator('#install-storage-pages').evaluate(n=>Boolean(n.closest('#source-connection'))),false);
  const installed=await readPages(),bundle=JSON.parse(fs.readFileSync(path.join(extension,'storage-pages.json'),'utf8'));
  for(const entry of bundle.files)assert.equal(installed[entry.name],entry.content);
  assert.equal((await worker.evaluate(()=>CatalogSync.getSettings())).enabled,false);
  await context.addInitScript(()=>{if(location.pathname.endsWith('/dashboard.html')){window.dashboardIntervals=0;window.dashboardPermissionRequests=0;const interval=window.setInterval;window.setInterval=(...args)=>{dashboardIntervals++;return interval(...args);};FileSystemHandle.prototype.requestPermission=async()=>{dashboardPermissionRequests++;throw Error('unexpected permission request');};}});
  const popupPromise=page.waitForEvent('popup');await page.locator('#open-folder-library').click();const dashboard=await popupPromise;dashboard.on('pageerror',e=>errors.push(e.message));
  await dashboard.waitForFunction(()=>document.querySelector('#kpi-count').textContent==='1');assert.match(dashboard.url(),/dashboard\.html\?source=connected/);assert.equal(await dashboard.evaluate(()=>SOPDashboard.readLive!==undefined),true);assert.deepEqual(await dashboard.evaluate(()=>[dashboardIntervals,dashboardPermissionRequests]),[0,0]);await dashboard.close();
  await page.evaluate(async()=>{const dir=await SOPStorageSource.getHandle();const w=await(await dir.getFileHandle('index.html')).createWritable();await w.write('<!doctype html><title>Custom owner page</title>');await w.close();await dir.removeEntry('relationships.html');});
  await page.locator('#install-storage-pages').click();await page.waitForFunction(()=>document.querySelector('#storage-pages-status').textContent.includes('pages are ready'));
  const repaired=await readPages();assert.equal(repaired['index.html'],'<!doctype html><title>Custom owner page</title>');assert.equal(repaired['relationships.html'],installed['relationships.html']);
  await page.locator('#choose-sop-folder').click();await page.waitForFunction(()=>!document.querySelector('#choose-sop-folder').disabled&&document.querySelector('#storage-pages-status').textContent.includes('pages are ready'));assert.deepEqual(await readPages(),repaired);
  for(const language of ['zh','zh-TW','en','es','ru','ko','ja']){await page.locator('#language-'+language).click();await page.waitForFunction(code=>document.querySelector('#language-'+code).getAttribute('aria-pressed')==='true',language);for(const selector of ['#open-folder-library','#install-storage-pages','#storage-pages-help','#storage-pages-status'])assert.ok((await page.locator(selector).textContent()).trim());await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.locator('#language-en').click();await page.waitForFunction(()=>document.querySelector('#language-en').getAttribute('aria-pressed')==='true');
  await page.evaluate(async()=>{const dir=await SOPStorageSource.getHandle();await dir.removeEntry('relationships.html');window.readOnlyFolder=true;window.permissionTrace=[];});
  await page.locator('#choose-sop-folder').click();await page.waitForFunction(()=>document.querySelector('#storage-pages-status').textContent.includes('could not be installed'));
  await page.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='ready'&&!document.querySelector('#choose-sop-folder').disabled);assert.equal((await worker.evaluate(()=>CatalogSync.loadWorkflow('demo-work'))).steps.length,2);
  assert.equal(await page.evaluate(async()=>{try{await(await SOPStorageSource.getHandle()).getFileHandle('relationships.html');return true;}catch(e){if(e.name==='NotFoundError')return false;throw e;}}),false);
  await page.waitForFunction(()=>!document.querySelector('#install-storage-pages').disabled);
  await page.evaluate(()=>{window.readOnlyFolder=false;window.permissionTrace=[];});
  await page.locator('#install-storage-pages').click();await page.waitForFunction(()=>document.querySelector('#storage-pages-status').textContent.includes('pages are ready'));
  assert.equal((await page.evaluate(()=>permissionTrace))[0],'request:readwrite','retry requests permission directly in its click before reading any file');
  assert.equal((await readPages())['relationships.html'],installed['relationships.html']);
  assert.deepEqual(errors,[]);
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
