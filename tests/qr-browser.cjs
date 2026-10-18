'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),{buildHtml:dashboard}=require('../tools/build-dashboard.cjs'),{loadSnapshot}=require('../tools/build-dashboard.cjs'),{buildHtml:mobile}=require('../tools/build-mobile-reader.cjs');
const launch={headless:!process.env.RUNTIME_SOP_CHROME,args:process.env.RUNTIME_SOP_CHROME?['--headless=new']:[],...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{})};
test('dashboard generates one stable QR, downloads all labels, and rejects local file destinations',{timeout:30000},async()=>{
 const browser=await chromium.launch(launch);try{
  const page=await browser.newPage({acceptDownloads:true,locale:'zh-CN'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const html=dashboard(loadSnapshot(path.join(root,'examples/storage')));
  await page.route('http://storage.test/dashboard.html',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://storage.test/dashboard.html#sop=demo-work');
  await page.locator('#detail-qr').click();await page.locator('#qr-preview svg').waitFor();
  assert.equal(await page.locator('#qr-link').inputValue(),'http://storage.test/sop.html?id=demo-work');
  if(process.env.RUNTIME_SOP_AUDIT_DIR){fs.mkdirSync(process.env.RUNTIME_SOP_AUDIT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RUNTIME_SOP_AUDIT_DIR,'qr-dialog-desktop.png')});}
  await page.setViewportSize({width:390,height:844});assert(await page.locator('#qr-dialog').evaluate(n=>n.getBoundingClientRect().width<=innerWidth));await page.setViewportSize({width:1280,height:720});
  const one=page.waitForEvent('download');await page.locator('#qr-download').click();assert.equal((await one).suggestedFilename(),'demo-work.svg');
  await page.locator('#qr-reader-url').fill('file:///shared/sop.html');assert(await page.locator('#qr-download').isDisabled());assert(await page.locator('#qr-export').isDisabled());assert.equal(await page.locator('#qr-preview svg').count(),0);assert.match(await page.locator('#qr-status').textContent(),/file/);
  await page.locator('#qr-reader-url').fill('http://storage.test:8080/sop.html');await page.locator('#qr-save').click();
  const batch=page.waitForEvent('download');await page.locator('#qr-export').click();assert.equal((await batch).suggestedFilename(),'Running-SOP-二维码标签.html');
  await page.locator('#qr-close').click();await page.reload();await page.locator('#detail-qr').click();assert.equal(await page.locator('#qr-reader-url').inputValue(),'http://storage.test:8080/sop.html');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
test('phone reader on ordinary HTTP opens annotated SOP, refreshes latest version, and fails safely',{timeout:30000},async()=>{
 const browser=await chromium.launch(launch);try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'examples/storage/catalog.json'),'utf8')),w=catalog.workflows[0];
  const doc=JSON.parse(fs.readFileSync(path.join(root,'examples/storage',w.file),'utf8'));doc.content.steps[0].pointType='report';doc.content.steps[0].pointNote='报告工作完成情况。';doc.content.steps[0].imageMarks=[{type:'number',x:.35,y:.3}];doc.content.steps[0].issues=[{id:'missing',title:'没有输入框',actions:['重新打开工作页面。'],next:'回到第一步'}];
  function revise(version){doc.content.version=version;const raw=JSON.stringify(doc);w.sha256=crypto.createHash('sha256').update(raw).digest('hex');w.file='workflows/demo-work/versions/'+w.sha256+'.json';return raw;}
  let raw=revise('1.0.0');let tamper=false;
  await page.route('http://storage.test/**',async r=>{const u=new URL(r.request().url());if(u.pathname==='/sop.html')return r.fulfill({contentType:'text/html',body:mobile()});if(u.pathname==='/SOP/catalog.json')return r.fulfill({contentType:'application/json',body:JSON.stringify(catalog)});if(u.pathname==='/SOP/'+w.file)return r.fulfill({contentType:'application/json',body:tamper?'{}':raw});const asset=doc.assets.find(a=>u.pathname==='/SOP/'+a.file);if(asset)return r.fulfill({contentType:asset.mimeType,body:fs.readFileSync(path.join(root,'examples/storage',asset.file))});return r.fulfill({status:404,body:'Not found'});});
  await page.goto('http://storage.test/sop.html?id=demo-work');await page.locator('.step').first().waitFor();
  assert.equal(await page.evaluate(()=>Boolean(crypto.subtle)),false,'ordinary non-localhost HTTP must exercise bundled SHA fallback');
  assert.match(await page.locator('#source').textContent(),/1.0.0/);assert.equal(await page.locator('.step').count(),2);assert.match(await page.locator('.point').textContent(),/报告点/);assert.match(await page.locator('.issue').textContent(),/没有输入框/);
  await page.locator('.marks svg').waitFor();await page.locator('.image-button').click();await page.locator('#zoom').waitFor({state:'visible'});await page.locator('#zoom .marks svg').waitFor();assert.equal(await page.locator('#zoom .marks svg').count(),1);await page.locator('#zoom-close').click();assert.equal(await page.locator('#zoom').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.RUNTIME_SOP_AUDIT_DIR){fs.mkdirSync(process.env.RUNTIME_SOP_AUDIT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.RUNTIME_SOP_AUDIT_DIR,'mobile-reader-390.png'),fullPage:true});}
  raw=revise('1.0.1');await page.locator('#retry').click();await page.waitForFunction(()=>document.getElementById('source').textContent.includes('1.0.1'));
  tamper=true;await page.locator('#retry').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('SHA-256'));assert.equal(await page.locator('.step').count(),0);
  await page.goto('http://storage.test/sop.html?id=removed');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('不存在'));assert.equal(await page.locator('.step').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
