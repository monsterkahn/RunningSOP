'use strict';

// Exact-size listing exports from actual 1.4.1 pages and isolated synthetic data.
// No generated UI, production content, external service, or everyday profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.RUNTIME_SOP_PLAYWRIGHT || 'playwright');
const Relations = require('../extension/relations-engine.js');
const Categories = require('../extension/category-engine.js');
const root = path.resolve(__dirname, '..'), extension = path.join(root, 'extension');
const version = require('../package.json').version;
if (version !== '1.4.1') throw Error('This media fixture targets the actual 1.4.1 release.');
const directory = 'release-media-v' + version, out = path.join(root, 'dist', directory);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-release-media-141-'));
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
  files.push({file: 'catalog.json', raw: JSON.stringify({format: 'runtime-sop-catalog', schemaVersion: 1, version: '1.4.1', workflows})});
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
  const shot=shots[0];
  await page.setViewportSize({width:1280,height:800});
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;width:1280px;height:800px;overflow:hidden;color:#18243b;font:16px Arial,sans-serif;background:radial-gradient(ellipse at 80% 5%,#e5edff 0,transparent 42%),#f4f7fc}
  .wrap{height:100%;padding:42px 58px}.brand{display:flex;align-items:center;gap:13px;color:#17264a;font-weight:700;letter-spacing:.2px}.brand img{width:42px;height:42px}
  .layout{display:grid;grid-template-columns:1fr 1.18fr;gap:38px;align-items:center;height:calc(100% - 52px)}.copy{max-width:470px}.eyebrow{margin:0 0 18px;color:#315cec;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-size:13px}h1{font-size:43px;line-height:1.1;letter-spacing:-.7px;margin:0 0 20px}p{font-size:19px;color:#58667c;line-height:1.5;margin:0}.note{font-size:13px;color:#758198;margin-top:16px;line-height:1.4}.frame{background:white;border:1px solid #dce3ef;border-radius:17px;padding:10px;box-shadow:0 22px 65px #26395e24;overflow:hidden}.frame img{display:block;width:100%;height:610px;object-fit:contain;border-radius:9px;background:#f5f7fb}
  </style><body><div class="wrap"><div class="brand"><img src="${icon}" alt=""><span>Running SOP</span></div><div class="layout"><div class="copy"><div class="eyebrow">Version ${version} · Step-by-step work guides</div><h1>${escape(title)}</h1><p>${escape(subtitle)}</p><div class="note">Actual extension screens. Synthetic examples.<br>Choose your storage folder before sharing.</div></div><div class="frame"><img src="data:image/png;base64,${shot.buffer.toString('base64')}" alt="Actual Running SOP extension screen"></div></div></div></body></html>`);
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
  const readShot=await capture(reader,'reading.png',480,804);
  const nextBounds=await reader.locator('#next-sop').boundingBox();if(!nextBounds||nextBounds.y+nextBounds.height>804)throw Error('Next SOP card is clipped');
  const compose=await context.newPage();
  await exportComposite(compose,'01-read-and-continue.png','Keep the instructions in view.','Read published steps beside your work. Continue to the linked next SOP when you are ready.',[{buffer:readShot,source:'extension/workspace.html, published folder reading with complete next-SOP card'}]);
  const editor=await context.newPage();await editor.setViewportSize({width:440,height:740});await editor.goto(origin+'/workspace.html');await editor.waitForFunction(()=>document.documentElement.dataset.workspaceReady==='true');
  const guide=documents[0],draft={id:'synthetic-release',title:guide.title,status:'draft',origin:'https://work.example.test',createdAt:'',updatedAt:'',steps:guide.steps.map(step=>({id:step.id,type:'manual',title:step.title,url:step.workUrl,workUrl:step.workUrl,where:step.where,action:step.actions.join('\n'),expected:'',acceptance:'',trouble:'',at:''}))};
  await editor.evaluate(async draft=>{const response=await chrome.runtime.sendMessage({type:'recorder-import',backup:{format:'runtime-sop-recording',schemaVersion:1,draft}});if(response.error)throw Error(response.error);await WorkspaceApp.refresh();await WorkspaceApp.openDraft(response.data.drafts.find(item=>item.title===draft.title).id);},draft);
  await editor.locator('#editor').waitFor({state:'visible'});await editor.locator('#next-step').waitFor({state:'visible'});const editorBounds=await editor.locator('#next-step').boundingBox();if(!editorBounds||editorBounds.y+editorBounds.height>740)throw Error('Next step button is clipped');const editorShot=await capture(editor,'recording-editor.png',440,740);
  await exportComposite(compose,'02-record-and-edit.png','Build one clear step at a time.','Add instructions and screenshots. Next step saves your changes; publish after reviewing the result.',[{buffer:editorShot,source:'extension/workspace.html actual recording editor'}]);
  const annotation=await context.newPage();await annotation.setViewportSize({width:920,height:704});await annotation.goto(origin+'/options.html');
  const token=await annotation.evaluate(async image=>{const tab=await chrome.tabs.getCurrent(),token=crypto.randomUUID();await chrome.storage.session.set({['sop-screenshot-'+token]:{mode:'edit',tabId:tab.id,expiresAt:Date.now()+120000,step:{title:'Review the request details',image,imageMarks:[{type:'number',x:.34,y:.25},{type:'rect',x:.065,y:.28,x2:.92,y2:.6}]}}});return token;},image);
  await annotation.goto(origin+'/screenshot-viewer.html?token='+token+'&mode=edit');await annotation.waitForFunction(()=>document.querySelector('#picture').naturalWidth>0&&!document.querySelector('#edit-tools').hidden);
  await annotation.locator('#marks-mosaic').click();
  const picture=await annotation.locator('#picture').boundingBox();await annotation.mouse.move(picture.x+picture.width*.08,picture.y+picture.height*.47);await annotation.mouse.down();await annotation.mouse.move(picture.x+picture.width*.38,picture.y+picture.height*.515,{steps:5});await annotation.mouse.up();
  const annotationShot=await capture(annotation,'screenshot-annotations-mosaic.png',920,704);
  await exportComposite(compose,'03-mark-and-mask.png','Show the details. Hide the sensitive parts.','Add numbered notes and boxes. Apply a mosaic mask before saving a screenshot.',[{buffer:annotationShot,source:'extension/screenshot-viewer.html actual annotation tools and active mosaic'}]);
  const library=await context.newPage();await library.setViewportSize({width:800,height:800});await library.goto(origin+'/library.html?source=folder');await library.waitForFunction(()=>document.documentElement.dataset.libraryReady==='true');await library.locator('#sops tr').nth(7).waitFor();
  const libraryShot=await capture(library,'folder-library.png',800,800);
  await exportComposite(compose,'04-organize-your-library.png','Give every guide a place.','Find published procedures in your chosen folder. Organize them with category names, colors and icons.',[{buffer:libraryShot,source:'extension/library.html?source=folder with actual shared categories'}]);
  await setup.setViewportSize({width:680,height:820});await setup.reload();await setup.waitForFunction(()=>document.documentElement.lang==='en'&&document.querySelector('#source-connection').dataset.state==='ready');
  const settingsShot=await capture(setup,'folder-and-language-settings.png',680,820);
  await exportComposite(compose,'05-choose-folder-and-language.png','Your folder. Your language.','Choose where SOPs are stored and select an interface language. Storage connects only after your selection.',[{buffer:settingsShot,source:'extension/options.html actual language and connected-folder settings'}]);
  // Promotional images emphasize the existing brand mark, with no feature UI invented.
  for(const [filename,width,height]of [['promo-440x280.png',440,280],['promo-1400x560.png',1400,560]]){
    const big=width>500;await compose.setViewportSize({width,height});await compose.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:radial-gradient(ellipse at 80% 5%,#e5edff 0,transparent 52%),#f4f7fc;color:#18243b;display:flex;align-items:center;justify-content:center;gap:${big?65:20}px;font-family:Arial,sans-serif}.mark{width:${big?190:90}px;height:${big?190:90}px}.mark img{width:100%;height:100%}h1{margin:0;font-size:${big?68:30}px;letter-spacing:-1px}p{margin:14px 0 0;font-size:${big?25:14}px;color:#58667c;line-height:1.4}.copy{max-width:${big?770:240}px}</style><body><div class="mark"><img src="${icon}" alt=""></div><div class="copy"><h1>Running SOP</h1><p>Clear steps.<br>Right where you work.</p></div></body>`);await compose.screenshot({path:path.join(out,filename)});assets.push({file:filename,kind:'brand-promotion',...verify(path.join(out,filename),width,height),provenance:['Existing extension/assets/icons/icon-128.png; pale blue brand background from retained pre-1.4.0 media']});
  }
  // Review-only contact sheet. It is not one of the five store screenshots.
  await compose.setViewportSize({width:1440,height:1440});await compose.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0;background:#e9eef7;padding:24px;color:#203455;font:16px/1.4 Arial,sans-serif}h1{font-size:26px;margin:0 0 7px}p{margin:0 0 20px;color:#63718b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}figure{margin:0;background:white;padding:10px;border:1px solid #ccd6e7}figure img{width:100%;display:block}figcaption{font-size:14px;margin-top:7px}.promo{display:flex;gap:18px;height:280px;align-items:center}.promo img{max-width:100%;max-height:240px}</style><h1>Running SOP 1.4.1 · Store media review</h1><p>Actual interface pages · Synthetic examples · Five listing screenshots + brand promotion</p><div class="grid">${assets.filter(asset=>asset.kind==='store-screenshot').map(asset=>`<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(out,asset.file)).toString('base64')}"><figcaption>${escape(asset.file)}</figcaption></figure>`).join('')}<figure class="promo"><img src="data:image/png;base64,${fs.readFileSync(path.join(out,'promo-440x280.png')).toString('base64')}"></figure></div>`);await compose.screenshot({path:path.join(out,'contact-sheet.png'),fullPage:true});
  const manifest={version,builtAt:new Date().toISOString(),browser:context.browser()?.version()||'Chromium persistent context',source:'Actual 1.4.1 extension runtime; isolated temporary profile and synthetic data',officialRequirements:'https://developer.chrome.com/docs/webstore/images',requirementsChecked:'2026-10-21',screenshots:assets.filter(asset=>asset.kind==='store-screenshot'),promotions:assets.filter(asset=>asset.kind==='brand-promotion'),notes:['No AI generation, UI redraw, production workflow, personal data, real browser profile or team service.','All five listing images use real extension captures in the retained pre-1.4.0 pale blue left-copy/right-frame brand layout.','No dashboard, index or relationship-page screenshots are included.','Exact 1.3.7 media archive was not found locally; retained 1.3.5 media and original tools/build-release-media.cjs are the verified style reference.','Format checks are local technical checks, not Google review or Chrome Web Store acceptance.']};
  output('manifest.json',JSON.stringify(manifest,null,2)+'\n');
  output('README.md',`# Running SOP ${version} — Extension media\n\nFive English listing screenshots, numbered 01–05: read and continue, record and edit, screenshot annotations and mosaic, category library, and folder/language settings. Each is 1280 × 800, opaque 8-bit RGB PNG (24-bit, PNG color type 2). Promotional images are 440 × 280 and 1400 × 560. contact-sheet.png is for review. No dashboard, index, or relationships page is pictured.\n\nThe pale blue background, top-left brand, large left headline and framed real screen on the right follow retained pre-1.4.0 media (dist/release-media-v1.3.5/01-read-guide.png and tools/build-release-media.cjs). A separate 1.3.7 media archive was not present locally. The visual style is reused; all pictured interfaces are newly captured from 1.4.1.\n\nAll examples are synthetic. Raw browser captures are in source-captures/. An isolated temporary Chromium profile uses real extension pages, real OPFS read/write and a fixture-selected folder. No real SOP, private work page, ordinary profile, AI-generated screen or remote service is used. Settings selection is fixture automation, not a native operating-system permission-prompt acceptance test.\n\nRebuild: node tools/build-release-media-141.cjs\nSee manifest.json for provenance and SHA256SUMS.txt for integrity.\n`);
  const list=[];function walk(dir,base=''){for(const name of fs.readdirSync(dir).sort()){const item=path.join(dir,name),relative=base+name;if(fs.statSync(item).isDirectory())walk(item,relative+'/');else if(relative!=='SHA256SUMS.txt')list.push(relative);}}walk(out);
  output('SHA256SUMS.txt',list.map(file=>hash(fs.readFileSync(path.join(out,file)))+'  '+file).join('\n')+'\n');
  const zip=path.join(root,'dist','running-sop-media-v'+version+'.zip');fs.rmSync(zip,{force:true});execFileSync('zip',['-q','-r',zip,directory],{cwd:path.join(root,'dist')});fs.writeFileSync(zip+'.sha256',hash(fs.readFileSync(zip))+'  '+path.basename(zip)+'\n');
  console.log(JSON.stringify({out,zip,assets,preview:path.join(out,'contact-sheet.png')},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}fs.rmSync(scratch,{recursive:true,force:true});});
