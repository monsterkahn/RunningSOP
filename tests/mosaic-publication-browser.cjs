'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const {chromium} = require(process.env.RUNTIME_SOP_PLAYWRIGHT || 'playwright');
const extension = process.env.RUNTIME_SOP_EXTENSION || path.resolve(__dirname,'../extension');
async function dragMask(page, start, end) {
  await page.locator('#marks-dialog').waitFor({state:'visible'});
  await page.locator('#marks-mosaic').click();
  const r = await page.locator('#marks-surface').boundingBox();
  await page.mouse.move(r.x+r.width*start[0],r.y+r.height*start[1]);await page.mouse.down();
  await page.mouse.move(r.x+r.width*end[0],r.y+r.height*end[1],{steps:5});await page.mouse.up();
}
function withoutImage(value) { const {image,imageMarks,...rest} = value;return rest; }
function imageHash(image) { return crypto.createHash('sha256').update(Buffer.from(image.split(',')[1],'base64')).digest('hex'); }

test('step and issue mosaics survive local saving, verified folder assets and reload; stale edits preserve replacement images',{timeout:60000},async()=>{
  const profile = fs.mkdtempSync(path.join(os.tmpdir(),'sop-mosaic-publication-'));let context;
  try {
    context = await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),viewport:{width:1200,height:1000},args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'), origin = 'chrome-extension://'+new URL(worker.url()).host;
    await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}}));
    const options = await context.newPage();await options.goto(origin+'/options.html');await options.waitForFunction(()=>!!window.SOPStorageSource);
    // Only replace the native picker selection; all OPFS reads and writes use
    // actual directory/file handles and the production publishing code.
    await options.evaluate(async()=>{const directory=await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic mosaic library',{create:true});window.showDirectoryPicker=async()=>directory;});
    await options.locator('#choose-sop-folder').click();await options.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='ready');
    const page = await context.newPage(), errors = [];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{chrome.tabs.query=async()=>[{id:12345,url:'https://work.example.test/mosaic',title:'Synthetic mosaic task'}];});
    await page.goto(origin+'/workspace.html');await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
    const fixture = await page.evaluate(async()=>{
      function picture(color) {const c=document.createElement('canvas');c.width=640;c.height=320;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,640,320);ctx.fillStyle='#f00010';ctx.fillRect(160,80,160,80);return c.toDataURL('image/jpeg',.9);}
      const original = picture('#2050c0'), replacement = picture('#20b050'), imageAt = '2026-10-21T00:00:00.000Z';
      const marks = [{type:'number',x:.8,y:.8},{type:'rect',x:.75,y:.1,x2:.9,y2:.3}];
      const issue = {id:'synthetic-issue',title:'Synthetic exception',actions:['Check the synthetic exception'],next:'Return to this step',image:original,imageAt,imageMarks:marks};
      const step = {id:'synthetic-step',type:'manual',title:'Synthetic mosaic step',url:'https://work.example.test/mosaic',workUrl:'https://work.example.test/mosaic',where:'Synthetic location',action:'Synthetic redaction action',expected:'Masked synthetic rectangle',acceptance:'Check synthetic data only',trouble:'Synthetic trouble',at:imageAt,image:original,imageAt,imageMode:'thumbnail',imageMarks:marks,issues:[issue]};
      const draft = {id:'synthetic-mosaic-draft',title:'Synthetic mosaic publication',status:'draft',origin:'https://work.example.test',createdAt:'',updatedAt:'',steps:[step]};
      const response=await chrome.runtime.sendMessage({type:'recorder-import',backup:{format:'runtime-sop-recording',schemaVersion:1,draft}});if(response.error)throw Error(response.error);
      const saved=response.data.drafts.find(d=>d.title===draft.title);await WorkspaceApp.refresh();await WorkspaceApp.openDraft(saved.id);
      ScreenshotEditor.requestAccess=()=>Promise.resolve(false);
      return {id:saved.id,original,replacement,step:saved.steps[0],marks};
    });
    // A competing image replacement while the editor is open must win over a
    // stale edit. The comparison must use the original image, not the mask.
    await page.locator('#annotate-shot').click();await dragMask(page,[.2,.15],[.6,.65]);
    const replaced = await page.evaluate(async f=>chrome.runtime.sendMessage({type:'recorder-picture',id:f.id,stepId:f.step.id,image:f.replacement,imageAt:f.step.imageAt,imageMarks:f.marks,expectedImage:f.original}),fixture);assert.equal(replaced.error,undefined);
    await page.locator('#marks-save').click();await page.waitForFunction(()=>!document.querySelector('#marks-dialog').open&&!document.querySelector('#annotate-shot').disabled);
    assert.equal(await page.locator('#editor-status').evaluate(e=>e.classList.contains('error')),true);
    let stored = await worker.evaluate(async id=>(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'].drafts.find(d=>d.id===id),fixture.id);
    assert.equal(stored.steps[0].image,fixture.replacement);assert.deepEqual(stored.steps[0].imageMarks,fixture.marks);
    await page.evaluate(async id=>WorkspaceApp.openDraft(id),fixture.id);
    await page.locator('#annotate-shot').click();await dragMask(page,[.2,.15],[.6,.65]);await page.locator('#marks-save').click();
    await page.waitForFunction(async f=>{const d=(await chrome.runtime.sendMessage({type:'recorder-get'})).data.drafts.find(d=>d.id===f.id);return !document.querySelector('#annotate-shot').disabled&&d.steps[0].image!==f.replacement;},fixture);
    stored = await worker.evaluate(async id=>(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'].drafts.find(d=>d.id===id),fixture.id);
    assert.notEqual(stored.steps[0].image,fixture.replacement);assert.deepEqual(stored.steps[0].imageMarks,fixture.marks);
    const {issues:beforeIssues,...beforeStep} = withoutImage(fixture.step), {issues:afterIssues,...afterStep} = withoutImage(stored.steps[0]);assert.deepEqual(afterStep,beforeStep);assert.deepEqual(afterIssues,beforeIssues);
    await page.locator('#issue-editor > summary').click();await page.locator('#issue-edit-list button').click();await page.locator('#issue-annotate').click();
    await dragMask(page,[.15,.1],[.7,.7]);await page.locator('#marks-save').click();await page.locator('#save-issue').click();await page.waitForFunction(()=>!document.querySelector('#save-issue').disabled);
    stored = await worker.evaluate(async id=>(await chrome.storage.local.get('runtime-sop-recorder-v1'))['runtime-sop-recorder-v1'].drafts.find(d=>d.id===id),fixture.id);
    assert.notEqual(stored.steps[0].issues[0].image,fixture.original);assert.deepEqual(stored.steps[0].issues[0].imageMarks,fixture.marks);assert.deepEqual(withoutImage(stored.steps[0].issues[0]),withoutImage(fixture.step.issues[0]));
    assert.equal(JSON.stringify(stored).includes('"mosaic"'),false);
    await page.locator('#preview-publish').click();await page.locator('#confirm-publish').check();await page.locator('#publish-nas').click();
    await page.waitForFunction(()=>document.documentElement.dataset.mode==='view'&&document.querySelector('#steps').textContent.includes('Synthetic redaction action'));
    const workflowId = await page.locator('html').getAttribute('data-workflow');
    const disk = await page.evaluate(async workflowId=>{
      const directory=await NASPublisher.getDirectoryHandle();
      async function file(name) {const parts=name.split('/');let handle=directory;for(const part of parts.slice(0,-1))handle=await handle.getDirectoryHandle(part);return (await handle.getFileHandle(parts[parts.length-1])).getFile();}
      const catalog=JSON.parse(await(await file('catalog.json')).text()), entry=catalog.workflows.find(w=>w.id===workflowId), text=await(await file(entry.file)).text(), document=JSON.parse(text);
      const guide=await SOPAssets.hydrate(document,entry,async name=>new Uint8Array(await(await file(name)).arrayBuffer()));
      const imageDirectory=await(await directory.getDirectoryHandle('workflows')).getDirectoryHandle(workflowId), images=await imageDirectory.getDirectoryHandle('images'), names=[];for await (const name of images.keys())names.push(name);
      async function pixels(src) {const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=src;});const c=globalThis.document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {width:c.width,height:c.height,masked:[...ctx.getImageData(240,120,1,1).data],outside:[...ctx.getImageData(20,20,1,1).data]};}
      return {text,guide,names,descriptors:document.assets,pixels:await Promise.all([pixels(guide.steps[0].image),pixels(guide.steps[0].issues[0].image)])};
    },workflowId);
    assert.equal(disk.guide.steps[0].image,stored.steps[0].image);assert.equal(disk.guide.steps[0].issues[0].image,stored.steps[0].issues[0].image);
    assert.deepEqual(disk.descriptors.map(d=>d.path).sort(),['/steps/0/image','/steps/0/issues/0/image']);
    assert.equal(disk.text.includes(fixture.original.split(',')[1]),false);assert.equal(disk.text.includes('"mosaic"'),false);
    assert.ok(!disk.names.includes(imageHash(fixture.original)+'.jpg'));assert.ok(!disk.names.includes(imageHash(fixture.replacement)+'.jpg'));
    assert.deepEqual(disk.names.sort(),[...new Set(disk.descriptors.map(d=>d.sha256+'.jpg'))].sort());
    for (const pixel of disk.pixels) {assert.equal(pixel.width,640);assert.equal(pixel.height,320);const [r,g,b,a]=pixel.masked;assert.ok(Math.max(r,g,b)-Math.min(r,g,b)<20,'The synthetic red secret has been replaced by neutral pixels');assert.equal(a,255);}
    assert.ok(disk.pixels[0].outside[1]>disk.pixels[0].outside[0]+70);assert.ok(disk.pixels[1].outside[2]>disk.pixels[1].outside[0]+70);
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true'&&document.querySelector('#steps').textContent.includes('Synthetic redaction action'));
    const reloaded = await worker.evaluate(async id=>CatalogSync.loadWorkflow(id),workflowId);assert.equal(reloaded.steps[0].image,stored.steps[0].image);assert.equal(reloaded.steps[0].issues[0].image,stored.steps[0].issues[0].image);assert.deepEqual(reloaded.steps[0].imageMarks,fixture.marks);assert.deepEqual(reloaded.steps[0].issues[0].imageMarks,fixture.marks);
    assert.deepEqual(errors,[]);
  } finally {if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
});
