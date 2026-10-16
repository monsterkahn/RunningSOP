'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.RUNTIME_SOP_PLAYWRIGHT || 'playwright');

const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'extension');

test('fresh extension install is private by default and About shows release identity', { timeout: 60000 }, async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-sop-public-'));
  const browserArgs = [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    '--no-first-run',
    '--no-default-browser-check'
  ];
  const launchOptions = {
    headless: true,
    args: browserArgs
  };
  if (process.env.RUNTIME_SOP_CHROME) launchOptions.executablePath = process.env.RUNTIME_SOP_CHROME;

  let context;
  try {
    context = await chromium.launchPersistentContext(profile, launchOptions);
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const config = await worker.evaluate(async () => ({
      settings: await CatalogSync.getSettings(),
      manifest: chrome.runtime.getManifest()
    }));
    assert.deepEqual(config.settings, { enabled: false, endpoint: '' });
    assert.equal(config.manifest.name, 'Running SOP');
    assert.equal(config.manifest.permissions.includes('scripting'), true);

    await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'zh',guided:false}}));
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    assert.match(await page.title(),/Running SOP/);
    for(const id of ['section-general','section-nas','section-statistics'])assert.equal(await page.locator('#'+id).isVisible(),true);
    assert.equal(await page.locator('.sidebar,#language').count(),0);
    assert.equal(await page.locator('#source-other').evaluate(n=>n.open),false);
    assert.equal(await page.locator('#legacy-source').evaluate(n=>n.open),false);
    assert.equal(await page.locator('#choose-sop-folder').isVisible(),true);
    assert.equal(await page.locator('#catalog-url').isVisible(),false);
    assert.equal(await page.locator('[data-i18n="SOP存储地址"]').textContent(),'SOP存储地址');
    assert.equal(await page.locator('[data-i18n="局域网存储"]').textContent(),'局域网存储');
    await page.locator('#language-en').click();
    await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('#language-en').getAttribute('aria-pressed')==='true');
    assert.equal(await page.locator('#language-en').textContent(),'English 🇬🇧');
    assert.equal(await page.locator('[data-i18n="SOP存储地址"]').textContent(),'SOP storage address');
    assert.equal(await page.locator('[data-i18n="局域网存储"]').textContent(),'Local network storage');
    await page.reload();await page.waitForFunction(()=>document.documentElement.lang==='en');
    await page.locator('#language-zh').click();await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');
    const tables=require('../extension/locale-data.js');
    for(const code of ['es','ru','ko','ja']){
      await page.locator('#language-'+code).click();await page.waitForFunction(c=>document.documentElement.lang===c,code);
      assert.equal(await page.locator('[data-i18n="SOP存储地址"]').textContent(),tables[code]['SOP存储地址']);
      assert.equal(await page.locator('[data-i18n="关于"]').textContent(),tables[code]['关于']);
      await page.waitForFunction(expected=>document.getElementById('statistics-status').textContent===expected,tables[code]['统计暂存本机，尚未连接 存储器。']);
      assert.equal(await page.locator('#catalog-status').textContent(),tables[code]['尚未设置存储器目录，可先录制本机 SOP。']);
    }
    await page.locator('#language-auto').click();await page.waitForFunction(()=>document.querySelector('#language-auto').getAttribute('aria-pressed')==='true');
    const autoState=await page.evaluate(()=>({actual:document.documentElement.lang,resolved:WorkspaceI18n.resolveLanguage('auto')}));
    assert.equal(autoState.actual,autoState.resolved==='zh'?'zh-CN':autoState.resolved);
    await page.locator('#language-zh').click();await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');


    assert.equal(await page.locator('#section-about').evaluate(e=>e.open),true);
    await assert.doesNotReject(page.locator('#section-about').waitFor({ state: 'visible' }));
    assert.equal(await page.locator('#about-author-name').textContent(), 'don Kimxote');
    assert.equal(await page.locator('#about-author-email').getAttribute('href'), 'mailto:gwangphug@gmail.com');
    assert.equal(await page.locator('#about-version').textContent(), config.manifest.version);
    assert.equal(await page.locator('#section-about').evaluate(e=>getComputedStyle(e).textAlign),'center');
    assert.equal(await page.locator('.about-author>div').first().evaluate(e=>getComputedStyle(e).alignItems),'center');

    const beforeURL = page.url();
    const beforeTabs = context.pages().length;
    await page.locator('#about-updates').click();
    assert.equal(page.url(), beforeURL);
    assert.equal(context.pages().length, beforeTabs);
    assert.match(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'), /^MIT License/m);
    // Exercise the actual draft-import, edit-save, persistent storage and fallback viewer path.
    const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'examples/illustrations/demo-step.jpg')).toString('base64');
    const draft={id:'shot-regression',title:'Screenshot regression',status:'draft',origin:'https://example.com',createdAt:'',updatedAt:'',steps:[{id:'step-one',type:'manual',title:'Annotated step',url:'https://example.com/work',workUrl:'https://example.com/work',where:'Demo',action:'Demo',expected:'',acceptance:'',trouble:'',at:'',image}]};
    await page.goto(`chrome-extension://${extensionId}/workspace.html`);
    await page.locator('#backup-file').setInputFiles({name:'synthetic-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'runtime-sop-recording',schemaVersion:1,draft}))});
    await page.locator('#annotate-shot').waitFor({state:'visible'});
    await page.locator('#annotate-shot').click();
    await page.locator('#marks-dialog').waitFor({state:'visible'});
    const rect=await page.locator('#marks-img').boundingBox();
    await page.mouse.click(rect.x+50,rect.y+50);
    await page.locator('#marks-save').click();
    await page.locator('#edit-title').fill('');
    await page.locator('#edit-action').fill('Submit the work summary.');
    await page.locator('#point-approval').click();
    await page.locator('#edit-point-note').fill('Team lead approves before proceeding.');
    await page.locator('#save-draft').click();

    await page.waitForFunction(async()=>{const s=(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'];return s?.drafts?.[0]?.steps?.[0]?.imageMarks?.length===1;});
    await page.reload();
    const persisted=await page.evaluate(async()=>{const state=(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'];return state.drafts[0].steps[0];});
    assert.equal(persisted.imageMarks.length,1);
    assert.equal(persisted.title,'');
    assert.equal(persisted.pointType,'approval');
    assert.equal(persisted.pointNote,'Team lead approves before proceeding.');
    await page.evaluate(shot=>ScreenshotEditor.view(shot,'Persisted screenshot'),persisted);
    await page.locator('#image-dialog').waitFor({state:'visible'});
    assert.equal(await page.locator('#large-picture .image-marks-overlay svg').count(),1);
    assert.match(await page.locator('#large-picture .image-marks-overlay').innerHTML(),/>1<\/text>/);

  } finally {
    if (context) await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});


test('standalone demo dashboard opens and shows synthetic workflow', {timeout:30000}, async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{})});
  try {
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(require('node:url').pathToFileURL(path.join(root,'dist/dashboard.html')).href);
    await page.waitForTimeout(300);
    assert.match(await page.locator('body').innerText(),/演示|内容库/);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});

test('screenshot iframe isolates image bytes from work pages and saves annotations', {timeout:60000},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'runtime-secure-viewer-')),staged=path.join(temp,'extension');fs.cpSync(extension,staged,{recursive:true});
 const m=JSON.parse(fs.readFileSync(path.join(staged,'manifest.json')));m.host_permissions.push('https://example.test/*');fs.writeFileSync(path.join(staged,'manifest.json'),JSON.stringify(m));
 let context;
 try{
  context=await chromium.launchPersistentContext(path.join(temp,'profile'),{headless:true,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[`--disable-extensions-except=${staged}`,`--load-extension=${staged}`]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
  await context.route('https://example.test/**',r=>r.fulfill({contentType:'text/html',body:'<title>Synthetic page</title><p>Work page</p>'}));
  const work=await context.newPage();await work.goto('https://example.test/work');
  const panel=await context.newPage();await panel.goto(`chrome-extension://${id}/workspace.html`);await panel.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  await work.bringToFront();
  const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'examples/illustrations/demo-step.jpg')).toString('base64');
  const shot={image,imageMarks:[{type:'arrow',x:.2,y:.2,x2:.4,y2:.4},{type:'rect',x:.5,y:.5,x2:.8,y2:.8}]};
  await panel.evaluate(async shot=>{const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];window.editorResult=ScreenshotEditor.open(shot,'Regression',{tabId:tab.id,url:tab.url},Promise.resolve(true));},shot);
  let frame;for(let n=0;n<80;n++){frame=work.frames().find(f=>f.url().includes('/screenshot-viewer.html'));if(frame)break;await new Promise(r=>setTimeout(r,100));}
  assert(frame,'extension-origin viewer frame must load');
  await frame.locator('#picture').waitFor({state:'visible'});
  if(process.env.RUNTIME_SOP_AUDIT_DIR){fs.mkdirSync(process.env.RUNTIME_SOP_AUDIT_DIR,{recursive:true});await work.screenshot({path:path.join(process.env.RUNTIME_SOP_AUDIT_DIR,'secure-screenshot-edit.png')});}
  const visibility=await work.evaluate(()=>({closed:document.getElementById('sop-image-overlay-host').shadowRoot===null,leaked:document.documentElement.outerHTML.includes('data:image/jpeg;base64,')}));
  assert.deepEqual(visibility,{closed:true,leaked:false});
  assert.equal(await work.evaluate(()=>{try{return Boolean(window.frames[0].document);}catch(e){return false;}}),false);
  const box=await frame.locator('#picture').boundingBox();await work.mouse.click(box.x+60,box.y+60);
  await frame.locator('#save').click();const saved=await panel.evaluate(()=>window.editorResult);
  assert.equal(saved.length,3);assert.deepEqual(saved.map(x=>x.type),['arrow','rect','number']);
  await work.waitForFunction(()=>!document.getElementById('sop-image-overlay-host'));
  await panel.evaluate(async shot=>{const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];window.viewResult=ScreenshotEditor.view(shot,'Reopened',{tabId:tab.id,url:tab.url},Promise.resolve(true));},{...shot,imageMarks:saved});
  frame=undefined;for(let n=0;n<80;n++){frame=work.frames().find(f=>f.url().includes('/screenshot-viewer.html'));if(frame)break;await new Promise(r=>setTimeout(r,100));}
  assert(frame);await frame.locator('#picture').waitFor({state:'visible'});assert.match(await frame.locator('#overlay').innerHTML(),/>1<\/text>/);
  if(process.env.RUNTIME_SOP_AUDIT_DIR)await work.screenshot({path:path.join(process.env.RUNTIME_SOP_AUDIT_DIR,'secure-screenshot-view.png')});
  await frame.locator('#close-viewer').click();await work.waitForFunction(()=>!document.getElementById('sop-image-overlay-host'));
  assert.equal(work.isClosed(),false);
  const residue=await worker.evaluate(async()=>Object.keys(await chrome.storage.session.get(null)).filter(k=>k.startsWith('sop-screenshot-')));assert.deepEqual(residue,[]);
  // A public viewer URL in another tab may not read or cancel a legitimate session.
  const isolated=await worker.evaluate(async shot=>{const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0],token=crypto.randomUUID(),key='sop-screenshot-'+token;await chrome.storage.session.set({[key]:{step:shot,mode:'view',tabId:tab.id,expiresAt:Date.now()+60000}});return {token,key};},shot);
  const unauthorized=await context.newPage();await unauthorized.goto(`chrome-extension://${id}/screenshot-viewer.html?token=${isolated.token}&mode=view`);
  await unauthorized.waitForFunction(()=>Boolean(document.getElementById('status').textContent));
  assert.equal(await unauthorized.locator('#picture').getAttribute('src'),null);
  await unauthorized.locator('#close-viewer').click();await unauthorized.keyboard.press('Escape');
  assert.equal(await worker.evaluate(async key=>Boolean((await chrome.storage.session.get(key))[key]?.step?.image),isolated.key),true);
  await worker.evaluate(key=>chrome.storage.session.remove(key),isolated.key);await unauthorized.close();
  // Sites with strict frame CSP safely fall back to extension-owned sidebar UI.
  await context.route('https://example.test/blocked',r=>r.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':"frame-src 'none'"},body:'<title>Frame blocked</title><p>Work page</p>'}));
  await work.goto('https://example.test/blocked');await work.bringToFront();
  const fallback=await panel.evaluate(async shot=>{const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];return ScreenshotEditor.view(shot,'CSP fallback',{tabId:tab.id,url:tab.url},Promise.resolve(true));},shot);
  assert.equal(fallback.opened,true);
  const cspFrame=work.frames().find(f=>f.url().includes('/screenshot-viewer.html'));if(cspFrame){await cspFrame.locator('#close-viewer').click();await work.waitForFunction(()=>!document.getElementById('sop-image-overlay-host'));}
  // Browser-internal pages cannot host content scripts and must use safe sidebar fallback.
  await work.goto('chrome://extensions/');await work.bringToFront();
  const protectedResult=await panel.evaluate(async shot=>{const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];return ScreenshotEditor.view(shot,'Protected page',{tabId:tab.id,url:tab.url},Promise.resolve(true));},shot);
  assert.equal(protectedResult.fallback,true);await panel.locator('#image-dialog').waitFor({state:'visible'});

 }finally{if(context)await context.close();fs.rmSync(temp,{recursive:true,force:true});}
});

test('guided recording edits STEP 1, advances explicitly and preserves approval points on stop', {timeout:60000},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'runtime-guided-'));
 const staged=path.join(temp,'extension');fs.cpSync(extension,staged,{recursive:true});
 // Only this isolated test copy grants its synthetic origin up front.
 const m=JSON.parse(fs.readFileSync(path.join(staged,'manifest.json')));m.host_permissions.push('https://example.test/*');fs.writeFileSync(path.join(staged,'manifest.json'),JSON.stringify(m));
 let context;
 try{
  context=await chromium.launchPersistentContext(path.join(temp,'profile'),{headless:true,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[`--disable-extensions-except=${staged}`,`--load-extension=${staged}`]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
  await context.route('https://example.test/**',route=>route.fulfill({contentType:'text/html',body:'<title>Synthetic work</title><button id="work">Prepare report</button>'}));
  const work=await context.newPage();await work.goto('https://example.test/work');
  const panel=await context.newPage();await panel.goto(`chrome-extension://${id}/workspace.html`);
  await panel.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');await work.bringToFront();
  await panel.waitForFunction(()=>WorkspaceApp.getContext().url==='https://example.test/work');
  await panel.evaluate(()=>document.querySelector('#start-record').click());
  await panel.locator('#next-step').waitFor({state:'visible'});
  assert.equal(await panel.locator('#draft-title').isEnabled(),true);
  const selectionStyle=await panel.evaluate(()=>({label:getComputedStyle(document.querySelector('#editor')).userSelect,input:getComputedStyle(document.querySelector('#draft-title')).userSelect,intro:getComputedStyle(document.querySelector('#intro-guide')).userSelect}));assert.deepEqual(selectionStyle,{label:'none',input:'text',intro:'none'});

  assert.equal(await panel.locator('#edit-title').inputValue(),'');
  assert.equal(await panel.locator('#add-step,#save-step,#image-mode,#step-up,#step-down,#delete-step').count(),0);
  const buttonSizes=await panel.evaluate(()=>Object.fromEntries(['take-shot','import-shot','next-step'].map(id=>[id,document.getElementById(id).getBoundingClientRect().width])));
  assert.equal(buttonSizes['take-shot'],buttonSizes['import-shot']);assert.equal(buttonSizes['next-step'],160);
  const nav=await panel.evaluate(()=>['next-step','preview-publish'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));assert.equal(nav[0].width,nav[1].width);assert.equal(nav[0].y,nav[1].y);assert(nav[1].x>nav[0].x);
  assert.equal(await panel.locator('.action-editor #take-shot,.action-editor #import-shot').count(),2);
  assert.equal(await panel.locator('#point-report svg,#point-approval svg,#take-shot svg,#import-shot svg').count(),4);
  const placement=await panel.evaluate(()=>document.querySelector('#take-shot').getBoundingClientRect().top>=document.querySelector('#edit-action').getBoundingClientRect().bottom);
  assert.equal(placement,true);
  await panel.setViewportSize({width:390,height:900});
  await panel.evaluate(()=>{WorkspaceI18n.setLanguage('en');WorkspaceI18n.apply(document);});
  const englishLayout=await panel.evaluate(()=>['take-shot','import-shot','point-report','point-approval'].map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return {width:r.width,overflow:el.scrollWidth>el.clientWidth,icons:el.querySelectorAll('svg').length};}));
  assert.equal(new Set(englishLayout.map(b=>b.width)).size,1);
  assert(englishLayout.every(b=>!b.overflow&&b.icons===1));
  await panel.setViewportSize({width:320,height:900});
  const narrow=await panel.evaluate(()=>['take-shot','import-shot'].every(id=>{const e=document.getElementById(id);return e.scrollWidth<=e.clientWidth;}));assert(narrow);



  async function field(selector,value){await panel.evaluate(({selector,value})=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},{selector,value});}
  await field('#draft-title','Guided workflow');
  await field('#edit-action','Prepare a report.');
  await panel.evaluate(()=>document.querySelector('#point-report').click());await field('#edit-point-note','Report to the team lead.');
  await work.locator('#work').click();
  await panel.evaluate(()=>document.querySelector('#next-step').click());
  await panel.waitForFunction(()=>document.querySelector('#edit-steps').children.length===2);
  assert.equal(await panel.locator('#edit-title').inputValue(),'');
  await field('#edit-action','Submit for approval.');await panel.evaluate(()=>document.querySelector('#point-approval').click());await field('#edit-point-note','Wait for manager approval.');
  await panel.evaluate(()=>document.querySelector('#preview-publish').click());
  await panel.locator('#publish-view').waitFor({state:'visible'});
  await panel.waitForFunction(async()=>!(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'].session);
  const stored=await worker.evaluate(async()=> (await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'].drafts[0]);
  assert.equal(stored.title,'Guided workflow');assert.equal(stored.steps.length,2);
  assert.equal(stored.steps[0].expected,'');assert.equal(stored.steps[0].acceptance,'');assert.equal(stored.steps[0].title,'');assert.equal(stored.steps[0].pointType,'report');assert.equal(stored.steps[0].action,'Prepare a report.');
  assert.equal(stored.steps[1].imageMode,'thumbnail');assert.equal(stored.steps[1].pointType,'approval');assert.equal(stored.steps[1].pointNote,'Wait for manager approval.');
  await panel.evaluate(()=>document.querySelector('#publish-back').click());
  await panel.evaluate(()=>document.querySelector('#close-editor').click());
  await panel.locator('.step-point.report').waitFor({state:'visible'});
  assert.equal(await panel.locator('.step-point.report .point-heading svg').count(),1);
  const style=await panel.evaluate(()=>({body:getComputedStyle(document.querySelector('.step-actions')).fontSize,note:getComputedStyle(document.querySelector('.step-point.report p')).fontSize,radius:getComputedStyle(document.querySelector('.step-point.report')).borderRadius,border:getComputedStyle(document.querySelector('.step-point.report')).borderTopWidth}));
  assert.deepEqual(style,{body:'16px',note:'14px',radius:'10px',border:'1px'});
  assert.equal(await panel.locator('.step-label').first().innerText(),'STEP 1');
  const titled=await panel.evaluate(async()=>{const key='runtime-sop-recorder-v1',state=(await chrome.storage.local.get(key))[key];state.drafts[0].steps[0].title='Prepare the report';await chrome.storage.local.set({[key]:state});return true;});
  assert(titled);await panel.evaluate(()=>WorkspaceApp.refresh());
  await panel.locator('.step-label .step-title').first().waitFor({state:'visible'});
  assert.equal(await panel.locator('.step-label .step-title').first().innerText(),'Prepare the report');
  assert.equal(await panel.locator('.step > .step-title').count(),0);


 }finally{if(context)await context.close();fs.rmSync(temp,{recursive:true,force:true});}
});


test('annotation results stay with their original step when sidebar selection changes', {timeout:60000},async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'runtime-target-marks-'));let context;
 try{
  context=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
  const page=await context.newPage();await page.goto(`chrome-extension://${id}/workspace.html`);await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  const image='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'examples/illustrations/demo-step.jpg')).toString('base64');
  const base={type:'manual',title:'',url:'https://example.test/work',workUrl:'https://example.test/work',where:'Page',action:'Do the work',expected:'',acceptance:'',trouble:'',at:'',image,imageAt:'2026-10-16T00:00:00.000Z'};
  const draft={id:'target-test',title:'Target test',status:'draft',origin:'https://example.test',createdAt:'',updatedAt:'',steps:[{...base,id:'step-a'},{...base,id:'step-b'}]};
  await page.locator('#backup-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'runtime-sop-recording',schemaVersion:1,draft}))});
  await page.locator('#annotate-shot').waitFor({state:'visible'});
  await page.evaluate(()=>{ScreenshotEditor.open=()=>new Promise(resolve=>window.finishTestMarks=resolve);});
  await page.locator('#annotate-shot').click();await page.waitForFunction(()=>Boolean(window.finishTestMarks));
  await page.locator('#edit-steps button').nth(1).click();await page.waitForFunction(()=>document.querySelector('#edit-steps button:nth-child(2)').getAttribute('aria-current')==='step');
  await page.evaluate(()=>window.finishTestMarks([{type:'number',x:.25,y:.3}]));
  await page.waitForFunction(async()=>{const s=(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'];return s.drafts[0].steps[0].imageMarks?.length===1;});
  const steps=await worker.evaluate(async()=>(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'].drafts[0].steps);
  assert.equal(steps[0].imageMarks.length,1);assert.equal(steps[1].imageMarks,undefined);
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
