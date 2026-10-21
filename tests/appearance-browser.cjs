'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),KEY='runtime-sop-appearance-v1';
const seed=encodeURIComponent(JSON.stringify({nodes:[{id:'synthetic-one',title:'Synthetic one',stepCount:1},{id:'synthetic-two',title:'Synthetic two',stepCount:2}],source:'dashboard'}));
function launch(){return {headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME,args:['--headless=new']}:{})};}
async function theme(page,value){await page.waitForFunction(v=>document.documentElement.dataset.theme===v&&getComputedStyle(document.documentElement).colorScheme===v,value);}
test('extension appearance persists, syncs pages, follows system and leaves graph data unchanged',{timeout:90000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'sop-appearance-'));let context;
 try{
  const extension=process.env.RUNTIME_SOP_EXTENSION||path.join(root,'extension'),settings=launch();
  context=await chromium.launchPersistentContext(profile,{...settings,channel:'chromium',colorScheme:'dark',args:[...(settings.args||[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host,errors=[],requests=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));context.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const dashboard=await context.newPage();await dashboard.goto(origin+'/dashboard.html');await theme(dashboard,'dark');
  assert.equal(await dashboard.locator('[data-theme-choice=system]').getAttribute('aria-pressed'),'true');
  const empty=await dashboard.locator('#sop-rows').textContent();
  await dashboard.locator('[data-theme-choice=light]').click();await theme(dashboard,'light');assert.equal(await dashboard.evaluate(k=>localStorage.getItem(k),KEY),'light');
  const graph=await context.newPage();await graph.goto(origin+'/relationships.html#seed='+seed);await theme(graph,'light');
  const titles=await graph.locator('#nodes>[data-node]>title').allTextContents();assert.equal(titles.length,2);
  await graph.locator('[data-theme-choice=dark]').focus();await graph.keyboard.press('Enter');await theme(graph,'dark');await theme(dashboard,'dark');
  assert.equal(await graph.locator('meta[name=color-scheme]').getAttribute('content'),'dark');
  await graph.emulateMedia({colorScheme:'light'});await theme(graph,'dark');await graph.reload();await theme(graph,'dark');
  await graph.emulateMedia({colorScheme:'dark'});await theme(graph,'dark');assert.equal(await graph.evaluate(k=>localStorage.getItem(k),KEY),'dark');
  await graph.emulateMedia({colorScheme:'light'});await theme(graph,'dark');
  for(const page of [dashboard,graph]){
   for(const value of ['light','dark']){
    await page.locator('[data-theme-choice='+value+']').click();await theme(page,value);
    await page.waitForTimeout(180);
    const colors=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,text:getComputedStyle(document.body).color}));
    if(value==='dark')assert.notEqual(colors.background,'rgb(255, 255, 255)');
    if(process.env.RUNTIME_SOP_AUDIT_DIR){fs.mkdirSync(process.env.RUNTIME_SOP_AUDIT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RUNTIME_SOP_AUDIT_DIR,(page===graph?'relationships':'dashboard')+'-'+value+'.png'),fullPage:true});}
   }
  }
  assert.deepEqual(await graph.locator('#nodes>[data-node]>title').allTextContents(),titles);assert.equal(await graph.locator('#edges .edge-line').count(),0);
  assert.equal(await dashboard.locator('#sop-rows').textContent(),empty);
  await graph.locator('[data-theme-choice=system]').click();await theme(graph,'light');await theme(dashboard,'dark');assert.equal(await graph.evaluate(k=>localStorage.getItem(k),KEY),null);
  await dashboard.emulateMedia({colorScheme:'light'});await theme(dashboard,'light');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  // Blocked persistence still permits an explicit choice for the current page.
  const denied=await context.newPage();await denied.addInitScript(()=>{for(const name of ['getItem','setItem','removeItem'])Storage.prototype[name]=()=>{throw new DOMException('Blocked','SecurityError');};});
  await denied.goto(origin+'/relationships.html#seed='+seed);await denied.locator('[data-theme-choice=dark]').click();await theme(denied,'dark');assert.deepEqual(errors,[]);
 }finally{await context?.close();fs.rmSync(profile,{recursive:true,force:true});}
});
test('standalone index and relationships carry an early theme script and shared preference without external assets',{timeout:90000},async()=>{
 const Dashboard=require('../tools/build-dashboard.cjs'),Relationships=require('../tools/build-relationships.cjs');
 const snapshot=Dashboard.loadSnapshot(path.join(root,'examples/storage')),pages={'/index.html':Dashboard.buildHtml(snapshot),'/relationships.html':Relationships.buildHtml(Relationships.snapshot(path.join(root,'examples/storage')))};
 const requests=[],server=http.createServer((req,res)=>{const file=req.url.split('?')[0];requests.push(file);if(!pages[file])return res.writeHead(404).end();res.setHeader('Content-Type','text/html; charset=utf-8');res.end(pages[file]);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch(launch());const context=await browser.newContext({colorScheme:'dark'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:'+server.address().port;
  assert(pages['/index.html'].indexOf('runtime-sop-appearance-v1')<pages['/index.html'].indexOf('<style>'));
  assert(pages['/relationships.html'].indexOf('runtime-sop-appearance-v1')<pages['/relationships.html'].indexOf('<style>'));
  await page.goto(url+'/index.html');await theme(page,'dark');const titles=await page.locator('#sop-rows .sop-name').allTextContents();
  await page.locator('[data-theme-choice=light]').click();await theme(page,'light');await page.goto(url+'/relationships.html');await theme(page,'light');
  await page.locator('[data-theme-choice=dark]').click();await page.goto(url+'/index.html');await theme(page,'dark');assert.deepEqual(await page.locator('#sop-rows .sop-name').allTextContents(),titles);
  assert.deepEqual(errors,[]);assert(requests.every(p=>['/index.html','/relationships.html'].includes(p)));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
