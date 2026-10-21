'use strict';

// Exact-size listing exports from actual 1.4.0 pages and isolated synthetic data.
// No generated UI, production content, external service, or everyday profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.RUNTIME_SOP_PLAYWRIGHT || 'playwright');
const Dashboard = require('./build-dashboard.cjs');
const Relationships = require('./build-relationships.cjs');
const Relations = require('../extension/relations-engine.js');
const Categories = require('../extension/category-engine.js');
const root = path.resolve(__dirname, '..'), extension = path.join(root, 'extension');
const version = require('../package.json').version;
if (version !== '1.4.0') throw Error('This media fixture targets the actual 1.4.0 release.');
const directory = 'release-media-v' + version, out = path.join(root, 'dist', directory);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-release-media-140-'));
const source = path.join(scratch, 'synthetic-library');
const rawDir = path.join(out, 'source-captures');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(extension, 'assets/icons/icon-128.png')).toString('base64');
let context, server;
const assets = [];
function output(name, body) { fs.writeFileSync(path.join(out, name), body); }
function pngInfo(file) {
  const bytes = fs.readFileSync(file);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('Invalid PNG: ' + file);
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bitDepth: bytes[24], colorType: bytes[25], bytes: bytes.length};
}
function verify(file, width, height) {
  const info = pngInfo(file);
  if (info.width !== width || info.height !== height || info.bitDepth !== 8 || info.colorType !== 2) throw Error('Expected exact-size opaque 24-bit RGB PNG: ' + file + ' ' + JSON.stringify(info));
  return info;
}
const workMarkup = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic request workspace</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f6fb;color:#23314a;font:16px/1.5 Arial,sans-serif}header{height:72px;background:white;border-bottom:1px solid #e1e6ef;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}header strong{font-size:20px}header span{color:#75839a;font-size:13px}main{padding:36px 32px;max-width:1000px;margin:auto}.label{font-size:13px;color:#61738f}h1{font-size:30px;line-height:1.2;margin:10px 0 8px}.intro{color:#748198;margin:0 0 24px}.card{background:white;border:1px solid #dfe5ef;border-radius:12px;padding:24px;margin-bottom:18px}.row{display:grid;grid-template-columns:1fr 1fr;gap:24px}h2{font-size:18px;margin:0 0 18px}.value{margin:5px 0 19px;font-weight:600}.badge{display:inline-block;background:#eaf2ff;color:#315fe0;border-radius:30px;padding:5px 12px;font-size:12px}textarea{width:100%;height:88px;border:1px solid #d9e0ed;border-radius:7px;padding:12px;font:15px Arial,sans-serif;resize:none}button{border:0;border-radius:7px;background:#2a59eb;color:white;padding:12px 20px;font-size:14px;float:right}.foot{font-size:12px;color:#7c889c;margin-top:22px}.note{padding:12px 15px;background:#eef4ff;border-radius:7px;font-size:13px;color:#5c7191}</style><body><header><strong>Request workspace</strong><span>Synthetic demonstration</span></header><main><div class="label">Operations / Requests</div><h1>Review a work request</h1><p class="intro">Sample request · No production information</p><div class="card"><h2>Request details <span class="badge">Ready for review</span></h2><div class="row"><div><div class="label">Request</div><div class="value">Demo equipment check</div><div class="label">Requested by</div><div class="value">Example colleague</div></div><div><div class="label">Reference</div><div class="value">DEMO-014</div><div class="label">Category</div><div class="value">Operations</div></div></div><div class="note">Confirm the details before recording a decision.</div></div><div class="card"><h2>Review note</h2><textarea aria-label="Review note" placeholder="Add your review note"></textarea><p style="height:34px;margin:18px 0 0"><button>Save review</button></p></div><p class="foot">All names, requests and reference values are synthetic examples.</p></main></body></html>`;
function fixture(image) {
  const definitions = [
    ['review-request', 'Review a work request', 'ops', 2],
    ['record-decision', 'Record a review decision', 'ops', 2],
    ['resolve-missing-details', 'Resolve missing details', 'ops', 3],
    ['prepare-weekly-review', 'Prepare the weekly review', 'planning', 3],
    ['publish-team-update', 'Publish a team update', 'planning', 2],
    ['check-workstation', 'Check a workstation', 'equipment', 4],
    ['welcome-new-colleague', 'Welcome a new colleague', 'people', 3],
    ['archive-completed-request', 'Archive a completed request', 'ops', 2]
  ];
  const documents = definitions.map(([workflowId, title, , count]) => ({
    format: 'runtime-sop-guide', schemaVersion: 1, workflowId, title, version: '1.0.0', notice: '',
    steps: Array.from({length: count}, (_, index) => ({id: 'step-' + (index + 1), title: '', where: 'Synthetic request workspace', workUrl: 'https://work.example.test/' + (workflowId === 'review-request' ? 'requests' : workflowId), actions: [index ? 'Record the result and save the review.' : 'Open the request and confirm the required details.'], expected: '', trouble: '', acceptance: [], ...(workflowId === 'review-request' && index === 0 ? {image, imageMode: 'thumbnail', pointType: 'report', pointNote: 'Report the review result.', issues: [{id: 'missing-details', title: 'Required details are missing', actions: ['Ask for the missing details before continuing.'], next: 'Return to this step.'}]} : {})}))
  }));
  const files = [], workflows = documents.map(guide => {
    const raw = JSON.stringify(guide), sha256 = hash(raw), file = 'workflows/' + guide.workflowId + '/' + sha256 + '.json';
    files.push({file, raw});
    return {id: guide.workflowId, title: guide.title, summary: 'Synthetic example workflow', status: 'published', viewer: 'guide', file, sha256, rules: [{hosts: ['work.example.test'], pathPrefixes: ['/' + (guide.workflowId === 'review-request' ? 'requests' : guide.workflowId)], priority: 20, label: 'Synthetic workspace'}]};
  });
  files.push({file: 'catalog.json', raw: JSON.stringify({format: 'runtime-sop-catalog', schemaVersion: 1, version: '1.4.0', workflows})});
  const categories = {...Categories.empty(), revision: 1, updatedAt: '2026-10-21T00:00:00.000Z', categories: [{id:'ops',name:'Operations',color:'blue',icon:'briefcase',parentId:null},{id:'planning',name:'Planning',color:'purple',icon:'folder',parentId:null},{id:'equipment',name:'Equipment',color:'orange',icon:'settings',parentId:null},{id:'people',name:'People',color:'green',icon:'users',parentId:null}], assignments: Object.fromEntries(definitions.map(([id,,category]) => [id, category]))};
  files.push({file: 'categories.json', raw: JSON.stringify(Categories.validate(categories))});
  const positions = [[45,70],[335,70],[335,230],[45,390],[335,390],[650,70],[650,230],[650,390]];
  const pairs = [['review-request','record-decision','next',''],['record-decision','archive-completed-request','next',''],['review-request','resolve-missing-details','issue','Missing details'],['resolve-missing-details','review-request','issue','Ready to review'],['prepare-weekly-review','publish-team-update','next','']];
  const relations = {...Relations.empty(), revision:1,updatedAt:'2026-10-21T00:00:00.000Z', name:'Operations workflow',nodes:definitions.map(([workflowId],index)=>({workflowId,x:positions[index][0],y:positions[index][1]})),edges:pairs.map(([from,to,kind,label],index)=>({id:'link-'+index,from,to,kind,label}))};
  files.push({file:'relations.json',raw:JSON.stringify(Relations.validate(relations))});
  for(const {file,raw} of files){const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw);}
  return {files, documents};
}
async function capture(page, filename, width, height) {
  await page.setViewportSize({width,height}); await page.screenshot({path:path.join(rawDir,filename),type:'png',animations:'disabled'});
  verify(path.join(rawDir,filename),width,height);
  return fs.readFileSync(path.join(rawDir,filename));
}
async function exportComposite(page, filename, title, subtitle, shots) {
  await page.setViewportSize({width:1280,height:800});
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>*{box-sizing:border-box}html{font-size:16px}body{margin:0;width:1280px;height:800px;overflow:hidden;background:#f5f7fc;color:#1b2e52;font:1rem/1.45 Arial,sans-serif}.heading{height:96px;padding:15px 28px;display:flex;align-items:center;gap:17px;background:#fff;border-bottom:1px solid #dbe3ef}.heading img{width:48px;height:48px}.copy{flex:1}h1{font-size:1.75rem;line-height:1.2;margin:0 0 4px}p{font-size:.9rem;margin:0;color:#63738e;max-width:80ch}.version{font-size:.75rem;color:#6c7d95;text-align:right}.shots{height:704px;display:flex;align-items:flex-start;overflow:hidden}.shots img{display:block;object-fit:contain;object-position:top center;height:704px;border:0}.shots img+img{border-left:2px solid #cbd6e8}</style><body><div class="heading"><img src="${icon}" alt=""><div class="copy"><h1>${escape(title)}</h1><p>${escape(subtitle)}</p></div><div class="version">Running SOP ${version}<br>Synthetic examples</div></div><div class="shots">${shots.map(shot=>`<img style="width:${shot.width}px" src="data:image/png;base64,${shot.buffer.toString('base64')}" alt="Actual product screenshot">`).join('')}</div></body></html>`);
  await page.screenshot({path:path.join(out,filename),type:'png'});
  assets.push({file:filename,kind:'store-screenshot',...verify(path.join(out,filename),1280,800),title,provenance:shots.map(shot=>shot.source)});
}
async function main(){
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(rawDir,{recursive:true});fs.mkdirSync(source,{recursive:true});
  context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  context.setDefaultTimeout(15000);
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  await worker.evaluate(()=>chrome.storage.local.set({'runtime-sop-workspace-preferences-v1':{language:'en'}}));
  await context.route('https://work.example.test/**',route=>route.fulfill({contentType:'text/html',body:workMarkup}));
  const work=await context.newPage();await work.setViewportSize({width:800,height:704});await work.goto('https://work.example.test/requests');
  const image='data:image/jpeg;base64,'+(await work.screenshot({type:'jpeg',quality:88})).toString('base64');
  const {files,documents}=fixture(image);
  const setup=await context.newPage();await setup.goto(origin+'/options.html');await setup.waitForFunction(()=>!!window.SOPStorageSource);
  await setup.evaluate(async files=>{const selected=await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic operations library',{create:true});for(const {file,raw}of files){const parts=file.split('/');let dir=selected;for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create:true});const writer=await(await dir.getFileHandle(parts.at(-1),{create:true})).createWritable();await writer.write(raw);await writer.close();}window.showDirectoryPicker=async()=>selected;},files);
  await setup.locator('#source-name').click();await setup.waitForFunction(()=>document.querySelector('#source-connection').dataset.state==='ready');
  const reader=await context.newPage();await reader.setViewportSize({width:480,height:804});
  await reader.addInitScript(()=>{chrome.tabs.query=async()=>[{id:4567,url:'https://work.example.test/requests',title:'Synthetic request workspace'}];});
  await reader.goto(origin+'/workspace.html');await reader.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');await reader.locator('#next-sop').waitFor({state:'visible'});
  const readShot=await capture(reader,'reading.png',480,804),workShot=await capture(work,'synthetic-work-page.png',800,704);
  const compose=await context.newPage();
  await exportComposite(compose,'01-read-and-continue.png','Follow the steps. Keep the work in view.','Read the current SOP, then open the linked next workflow when you are ready.',[{buffer:workShot,width:800,source:'Synthetic work page captured in browser'},{buffer:readShot,width:480,source:'extension/workspace.html, published folder reading with next SOP'}]);
  const editor=await context.newPage();await editor.setViewportSize({width:360,height:704});await editor.goto(origin+'/workspace.html');await editor.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  const guide=documents[0],draft={id:'synthetic-release',title:guide.title,status:'draft',origin:'https://work.example.test',createdAt:'',updatedAt:'',steps:guide.steps.map(step=>({id:step.id,type:'manual',title:step.title,url:step.workUrl,workUrl:step.workUrl,where:step.where,action:step.actions.join('\n'),expected:'',acceptance:'',trouble:'',at:'',image}))};
  await editor.evaluate(async draft=>{const response=await chrome.runtime.sendMessage({type:'recorder-import',backup:{format:'runtime-sop-recording',schemaVersion:1,draft}});if(response.error)throw Error(response.error);await WorkspaceApp.refresh();await WorkspaceApp.openDraft(response.data.drafts.find(item=>item.title===draft.title).id);},draft);
  await editor.locator('#editor').waitFor({state:'visible'});const editorShot=await capture(editor,'recording-editor.png',360,704);
  const annotation=await context.newPage();await annotation.setViewportSize({width:920,height:704});await annotation.goto(origin+'/options.html');
  const token=await annotation.evaluate(async image=>{const tab=await chrome.tabs.getCurrent(),token=crypto.randomUUID();await chrome.storage.session.set({['sop-screenshot-'+token]:{mode:'edit',tabId:tab.id,expiresAt:Date.now()+120000,step:{title:'Review the request details',image,imageMarks:[{type:'number',x:.34,y:.25},{type:'rect',x:.065,y:.28,x2:.92,y2:.6}]}}});return token;},image);
  await annotation.goto(origin+'/screenshot-viewer.html?token='+token+'&mode=edit');await annotation.waitForFunction(()=>document.querySelector('#picture').naturalWidth>0&&!document.querySelector('#edit-tools').hidden);
  await annotation.locator('#marks-mosaic').click();
  const picture=await annotation.locator('#picture').boundingBox();await annotation.mouse.move(picture.x+picture.width*.08,picture.y+picture.height*.47);await annotation.mouse.down();await annotation.mouse.move(picture.x+picture.width*.38,picture.y+picture.height*.515,{steps:5});await annotation.mouse.up();
  const annotationShot=await capture(annotation,'screenshot-annotations-mosaic.png',920,704);
  await exportComposite(compose,'02-record-mark-and-mask.png','Capture a step. Mark what matters.','Add instructions, screenshot notes and a mosaic mask before publishing.',[{buffer:editorShot,width:360,source:'extension/workspace.html recording editor'},{buffer:annotationShot,width:920,source:'extension/screenshot-viewer.html actual annotation tools and active mosaic'}]);
  const library=await context.newPage();await library.setViewportSize({width:1280,height:704});await library.goto(origin+'/library.html?source=folder');await library.waitForFunction(()=>document.documentElement.dataset.libraryReady==='true');await library.locator('#sops tr').nth(7).waitFor();
  const libraryShot=await capture(library,'folder-library.png',1280,704);
  await exportComposite(compose,'03-organize-your-library.png','Find the right SOP, in one shared library.','Organize published procedures with categories, colors and icons.',[{buffer:libraryShot,width:1280,source:'extension/library.html?source=folder with actual shared categories'}]);
  fs.writeFileSync(path.join(scratch,'index.html'),Dashboard.buildHtml(Dashboard.loadSnapshot(source)));
  fs.writeFileSync(path.join(scratch,'relationships.html'),Relationships.buildHtml(Relationships.snapshot(source)));
  server=http.createServer((request,response)=>{const filename=request.url.split('?')[0].slice(1);if(!['index.html','relationships.html'].includes(filename)){response.writeHead(404).end();return;}response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(fs.readFileSync(path.join(scratch,filename)));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const dashboard=await context.newPage();await dashboard.setViewportSize({width:1280,height:704});await dashboard.goto(base+'/index.html');await dashboard.locator('#dashboard-language').selectOption('en');await dashboard.locator('#sop-rows tr').nth(7).waitFor({state:'attached'});
  const dashboardShot=await capture(dashboard,'storage-dashboard.png',1280,704);
  await exportComposite(compose,'04-see-the-library-overview.png','See the library at a glance.','Open the storage dashboard for published procedures and recorded feedback.',[{buffer:dashboardShot,width:1280,source:'tools/build-dashboard.cjs actual self-contained index.html; statistics absent intentionally'}]);
  const graph=await context.newPage();await graph.setViewportSize({width:1280,height:800});await graph.goto(base+'/relationships.html');await graph.locator('#dashboard-language').selectOption('en');await graph.locator('#nodes [data-node]').nth(7).waitFor();await graph.locator('#zoom-value').click();await graph.waitForTimeout(450);
  const graphShot=await capture(graph,'relationships.png',1280,800);
  output('05-connect-your-workflows.png',graphShot);assets.push({file:'05-connect-your-workflows.png',kind:'store-screenshot',...verify(path.join(out,'05-connect-your-workflows.png'),1280,800),title:'Connect your workflows',provenance:['tools/build-relationships.cjs actual standalone relationship editor; verified synthetic relations.json']});
  // Promotional images emphasize the existing brand mark, with no feature UI invented.
  for(const [filename,width,height]of [['promo-440x280.png',440,280],['promo-1400x560.png',1400,560]]){
    const big=width>500;await compose.setViewportSize({width,height});await compose.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#15358f;display:flex;align-items:center;justify-content:center;gap:${big?70:20}px;flex-direction:${big?'row':'column'};color:white;font-family:Arial,sans-serif} .brand-name{position:relative;text-align:${big?'left':'center'}}h1{margin:0;font-size:${big?76:32}px;letter-spacing:-1px}p{margin:12px 0 0;font-size:${big?25:14}px;color:#ccdcff}body:before,body:after{content:'';position:absolute;width:${big?700:300}px;height:${big?700:300}px;border:1px solid #6b9aff66;border-radius:50%;transform:translate(-48%,-25%)}body:after{transform:translate(56%,35%);border-color:#96b7ff55}.mark{position:relative;width:${big?230:110}px;height:${big?230:110}px;border-radius:24%;background:white;box-shadow:0 22px 65px #05174855;display:grid;place-items:center}.mark img{width:80%;height:80%}.dot{position:absolute;width:${big?13:7}px;height:${big?13:7}px;border-radius:50%;background:#9ec1ff;left:14%;top:25%}</style><body><span class="dot"></span><div class="mark"><img src="${icon}" alt="Running SOP"></div><div class="brand-name"><h1>Running SOP</h1><p>Clear steps. Right where you work.</p></div></body>`);await compose.screenshot({path:path.join(out,filename)});assets.push({file:filename,kind:'brand-promotion',...verify(path.join(out,filename),width,height),provenance:['Existing extension/assets/icons/icon-128.png; deterministic geometric brand background']});
  }
  // Review-only contact sheet. It is not one of the five store screenshots.
  await compose.setViewportSize({width:1440,height:1440});await compose.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;background:#e9eef7;padding:24px;color:#203455;font:16px/1.4 Arial,sans-serif}h1{font-size:26px;margin:0 0 7px}p{margin:0 0 20px;color:#63718b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0;background:white;padding:10px;border:1px solid #ccd6e7}figure img{width:100%;display:block}figcaption{font-size:14px;margin-top:7px}.promo{display:flex;gap:18px;height:280px;align-items:center}.promo img{max-width:100%;max-height:240px}</style><h1>Running SOP 1.4.0 · Store media review</h1><p>Actual interface pages · Synthetic examples · Five listing screenshots + brand promotion</p><div class="grid">${assets.filter(asset=>asset.kind==='store-screenshot').map(asset=>`<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(out,asset.file)).toString('base64')}"><figcaption>${escape(asset.file)}</figcaption></figure>`).join('')}<figure class="promo"><img src="data:image/png;base64,${fs.readFileSync(path.join(out,'promo-440x280.png')).toString('base64')}"></figure></div>`);await compose.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});
  const manifest={version,builtAt:new Date().toISOString(),browser:context.browser()?.version()||'Chromium persistent context',source:'Actual repository runtime and standalone builders; isolated temporary profile and synthetic data',officialRequirements:'https://developer.chrome.com/docs/webstore/images',requirementsChecked:'2026-10-21',screenshots:assets.filter(asset=>asset.kind==='store-screenshot'),promotions:assets.filter(asset=>asset.kind==='brand-promotion'),notes:['No AI generation, UI redraw, production workflow, personal data, real browser profile or team service.','Screenshots 01-04 use exact actual browser captures below a separate descriptive header; screenshot 05 is the full actual relationship page.','The work page in screenshot 01 is a clearly labeled synthetic demonstration, not a third-party account.','Absent usage statistics are shown as not collected, not fabricated as real usage.','Format checks are local technical checks, not Google review or Chrome Web Store acceptance.']};
  output('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  output('README.md',`# Running SOP ${version} — Chrome Web Store media\n\nFive English listing screenshots are numbered 01–05 in upload order. Each is exactly 1280 × 800 pixels, 8 bits per RGB channel (24-bit PNG, PNG color type 2), with no alpha channel. Optional brand exports are 440 × 280 and 1400 × 560. The contact sheet is for review only.\n\nAll product views come from the actual repository pages, loaded in an isolated temporary Chromium profile with synthetic documents and categories. Raw source captures are retained in source-captures/. Nothing uses a real user account, real SOP, private work page or ordinary browser profile. No UI was drawn or regenerated with AI. The request workspace is a clearly labeled synthetic demonstration.\n\n[Official Chrome Web Store image guidance](https://developer.chrome.com/docs/webstore/images), checked 2026-10-21: provide 1–5 screenshots at 1280 × 800 or 640 × 400 with square corners and full bleed; provide a 440 × 280 small promotional image, and optionally a 1400 × 560 marquee. We additionally enforce the requested opaque 24-bit RGB PNG export format. These checks do not establish Google review or store approval.\n\n01 — Published side-panel reading with a linked next SOP beside a synthetic work page.\n02 — Real recording editor and actual screenshot annotation/mosaic tools.\n03 — Actual folder library with shared categories.\n04 — Actual index dashboard built from verified synthetic files; no fabricated usage statistics.\n05 — Actual standalone relationship editor showing next and issue links.\n\nRebuild from repository root: node tools/build-release-media-140.cjs\n\nSee manifest.json for exact dimensions, provenance and browser details. SHA256SUMS.txt covers all files except itself.\n`);
  const list=[];function walk(dir,base=''){for(const name of fs.readdirSync(dir).sort()){const item=path.join(dir,name),relative=base+name;if(fs.statSync(item).isDirectory())walk(item,relative+'/');else if(relative!=='SHA256SUMS.txt')list.push(relative);}}walk(out);
  output('SHA256SUMS.txt',list.map(file=>hash(fs.readFileSync(path.join(out,file)))+'  '+file).join('\n')+'\n');
  const zip=path.join(root,'dist','running-sop-media-v'+version+'.zip');fs.rmSync(zip,{force:true});execFileSync('zip',['-q','-r',zip,directory],{cwd:path.join(root,'dist')});fs.writeFileSync(zip+'.sha256',hash(fs.readFileSync(zip))+'  '+path.basename(zip)+'\n');
  console.log(JSON.stringify({out,zip,assets,preview:path.join(out,'contact-sheet.png')},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}fs.rmSync(scratch,{recursive:true,force:true});});
