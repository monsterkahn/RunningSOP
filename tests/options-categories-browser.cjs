'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
test('Settings keeps categories in the overview and persists a short device name',{timeout:90000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sop-options-categories-'));let context;
 try{
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/options.html');await page.waitForFunction(()=>document.querySelector('#team-display-name').value);
  assert.equal(await page.locator('.language-switch button').last().getAttribute('id'),'language-auto');assert.equal(await page.locator('.language-switch .language-flag').count(),0);assert.equal(await page.locator('.language-switch img').count(),1);assert.equal(await page.locator('#language-auto img').getAttribute('src'),'assets/chrome.svg');
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:850});const bounds=await page.locator('.language-switch button').evaluateAll(buttons=>buttons.map(b=>({id:b.id,x:b.getBoundingClientRect().x,y:b.getBoundingClientRect().y,bottom:b.getBoundingClientRect().bottom,width:b.getBoundingClientRect().width,clipped:b.scrollWidth>b.clientWidth})));const auto=bounds.pop();assert.ok(bounds.every(b=>auto.y>=b.bottom),'Browser language sits below every manual choice');assert.ok(bounds.every(b=>Math.abs(b.width-bounds[0].width)<1&&!b.clipped),'Equal-width language names fit');if(process.env.RUNTIME_SOP_AUDIT_DIR){fs.mkdirSync(process.env.RUNTIME_SOP_AUDIT_DIR,{recursive:true});await page.locator('.language-switch').screenshot({path:path.join(process.env.RUNTIME_SOP_AUDIT_DIR,'language-'+width+'.png')});}}
  assert.equal(await page.locator('#settings-categories,#category-settings,#category-dialog').count(),0);
  assert.equal(await page.locator('#open-folder-library').getAttribute('href'),'dashboard.html?source=connected');
  const initial=await worker.evaluate(async()=>({settings:(await chrome.storage.local.get(CatalogSync.SETTINGS))[CatalogSync.SETTINGS],cache:(await chrome.storage.local.get(CatalogSync.CACHE))[CatalogSync.CACHE]}));assert.equal(initial.settings,undefined);assert.equal(initial.cache,undefined);
  const name=await page.locator('#team-display-name').inputValue();assert.match(name,/^(Mac|Win|Lin|CrOS|And|BSD|Fuch)-[A-HJ-NP-Z2-9]{4}$/);
  await page.locator('#team-settings').evaluate(el=>el.open=true);
  await page.locator('#team-display-name').fill('My desk');await page.locator('#language-zh').click();await page.waitForFunction(()=>document.querySelector('#team-use-device-name').textContent==='使用设备名称');assert.equal(await page.locator('#team-display-name').inputValue(),'My desk');
  await page.locator('#team-use-device-name').click();await page.waitForFunction(name=>document.querySelector('#team-display-name').value===name,name);
  for(const language of ['en','zh-TW','es','ru','ko','ja']){await page.locator('#language-'+language).click();await page.waitForFunction(code=>document.documentElement.lang===code,language);assert.match(await page.locator('#team-join-help').textContent(),/config.json/);assert.ok(await page.locator('#team-use-device-name').textContent());for(const width of [320,1280]){await page.setViewportSize({width,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}}
  await page.reload();await page.waitForFunction(name=>document.querySelector('#team-display-name').value===name,name);
  const other=await context.newPage();await other.goto(origin+'/options.html');await other.waitForFunction(name=>document.querySelector('#team-display-name').value===name,name);
  const identities=await Promise.all([page,other].map(p=>p.evaluate(()=>Promise.all(Array.from({length:10},()=>RunningSOPDeviceName.get())))));assert.ok(identities.flat().every(n=>n===name));
  await page.evaluate(()=>{window.showDirectoryPicker=async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic device settings',{create:true});});await page.locator('#choose-sop-folder').click();await page.waitForFunction(name=>document.querySelector('#source-state-label').textContent.endsWith(' · '+name),name);
  const persisted=await worker.evaluate(async()=>(await chrome.storage.local.get('runtime-sop-device-name-v1'))['runtime-sop-device-name-v1']);assert.equal(persisted.name,name);
  const schedule=await page.evaluate(async()=>(await CatalogSync.getSettings()).enabled);assert.equal(schedule,false);assert.deepEqual(errors,[]);
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
