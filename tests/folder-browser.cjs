'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');
function fixtureFiles(directory,prefix=''){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const relative=prefix+entry.name,absolute=path.join(directory,entry.name);return entry.isDirectory()?fixtureFiles(absolute,relative+'/'):[{path:relative,base64:fs.readFileSync(absolute).toString('base64')}];});}
// Only substitute the OS picker result. Directory handles, permissions, catalog
// reads, metadata persistence, and background messages are native/production.
test('clickable folder card selects a native library, preserves customization and initializes an empty library',{timeout:90000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'running-sop-folder-'));let context;
 try{
  const extension=process.env.RUNTIME_SOP_EXTENSION||path.join(root,'extension');
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
  await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'zh',guided:false}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='unconfigured');
  assert.equal(await page.locator('#section-statistics,#source-other,#source-kind,#check-catalog,#auto-sync,#login-url').count(),0);
  assert.equal(await page.locator('#section-about').isVisible(),true);
  await page.bringToFront();
  const cue=await page.locator('#source-end-icon').evaluate(el=>({name:getComputedStyle(el).animationName,cycles:Number(getComputedStyle(el).animationIterationCount),ring:getComputedStyle(el,'::after').animationName}));
  assert.equal(cue.name,'sop-folder-breathe');assert.equal(cue.ring,'sop-folder-ring');assert.equal(cue.cycles,3);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#source-end-icon').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Headless tabs can all report visible; emulate the visibility event only.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('html').getAttribute('data-motion-paused'),'true');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('html').getAttribute('data-motion-paused'),'false');

  assert.deepEqual(await page.locator('[data-source-icon]').evaluateAll(items=>items.map(b=>b.dataset.sourceIcon)),['folder','storage','monitor']);
  assert.deepEqual(await worker.evaluate(()=>CatalogSync.getSettings()),{enabled:false,endpoint:''});
  await page.evaluate(async files=>{
   const storage=await navigator.storage.getDirectory(),selected=await storage.getDirectoryHandle('SOP',{create:true});
   for(const file of files){const parts=file.path.split('/');let dir=selected;for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create:true});const writer=await(await dir.getFileHandle(parts.at(-1),{create:true})).createWritable();await writer.write(Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0)));await writer.close();}
   window.showDirectoryPicker=async()=>selected;
  },fixtureFiles(path.join(root,'examples/storage')));
  await page.locator('#source-name').click();
  try{await page.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='ready',null,{timeout:10000});}
  catch(error){console.error('Folder connection diagnostic:',await page.locator('#catalog-status').textContent(),await worker.evaluate(()=>CatalogSync.info()));throw error;}
  assert.equal(await page.locator('#source-name').textContent(),'SOP');
  assert.equal(await page.locator('#source-end-icon').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal((await worker.evaluate(()=>CatalogSync.getSettings())).enabled,false);
  assert.equal((await worker.evaluate(()=>CatalogSync.loadWorkflow('demo-work'))).steps.length,2);
  await page.locator('#source-appearance summary').click();await page.locator('#source-display-name').fill('Team <SOP>');await page.locator('[data-source-icon=storage]').click();await page.locator('#save-source-appearance').click();
  await page.waitForFunction(()=>document.querySelector('#source-name').textContent==='Team <SOP>'&&!document.querySelector('#source-appearance').open);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#source-name').textContent==='Team <SOP>');
  assert.equal(await page.locator('#source-name > *').count(),0);assert.equal((await worker.evaluate(()=>SOPStorageSource.info())).name,'SOP');
  for(const language of ['zh','zh-TW','en','es','ru','ko','ja']){
   await page.locator('#language-'+language).click();await page.waitForFunction(code=>document.querySelector('#language-'+code).getAttribute('aria-pressed')==='true',language);
   assert.equal(await page.locator('#source-name').textContent(),'Team <SOP>');
   for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const layout=await page.locator('.language-switch button:not(#language-auto)').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {top:r.top,width:r.width};}));assert.equal(new Set(layout.map(r=>r.top)).size,1);assert.ok(Math.max(...layout.map(r=>r.width))-Math.min(...layout.map(r=>r.width))<1);}
  }
  await page.locator('#language-zh').click();
  if(process.env.RUNTIME_SOP_AUDIT_DIR){fs.mkdirSync(process.env.RUNTIME_SOP_AUDIT_DIR,{recursive:true});await page.locator('#source-appearance summary').click();await page.screenshot({path:path.join(process.env.RUNTIME_SOP_AUDIT_DIR,'folder-card-390.png'),fullPage:true});}
  const previous=(await worker.evaluate(()=>CatalogSync.getSettings())).endpoint;
  await page.evaluate(()=>{window.showDirectoryPicker=async()=>{throw new DOMException('cancel','AbortError');};});
  await page.locator('#source-name').click();await page.waitForFunction(()=>!document.querySelector('#choose-sop-folder').disabled);
  assert.equal((await worker.evaluate(()=>CatalogSync.getSettings())).endpoint,previous);
  await page.evaluate(async()=>{const storage=await navigator.storage.getDirectory(),empty=await storage.getDirectoryHandle('Empty',{create:true});window.showDirectoryPicker=async()=>empty;});
  await page.locator('#source-name').click();await page.waitForFunction(()=>document.querySelector('#source-name').textContent==='Empty'&&document.querySelector('#source-connection').dataset.state==='ready');
  const empty=await page.evaluate(async()=>{const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('Empty');return JSON.parse(await(await(await dir.getFileHandle('catalog.json')).getFile()).text());});
  assert.deepEqual(empty,{format:'runtime-sop-catalog',schemaVersion:1,version:'1.0.0',workflows:[]});
  assert.deepEqual(errors,[]);
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
