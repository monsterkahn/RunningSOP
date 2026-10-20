'use strict';

// Deterministic English release media made from real extension pages. All
// content and the team service are synthetic and live only in a temp directory.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.RUNTIME_SOP_PLAYWRIGHT || 'playwright');
const { TeamStore } = require('../server/store.cjs');
const { createTeamServer } = require('../server/app.cjs');

const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
const mediaDirectory = `release-media-v${version}`;
const mediaArchive = `running-sop-media-v${version}.zip`;
const out = path.join(root, 'dist', mediaDirectory);
const extension = path.join(root, 'extension');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'running-sop-media-'));
let context, store, server;
const icon = path.join(extension, 'assets/icons/icon-128.png');
const syntheticImage = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'examples/illustrations/demo-step.jpg')).toString('base64');

function write(file, data) { fs.writeFileSync(path.join(out, file), data); }
function htmlEscape(value) { return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
async function compose(page, filename, width, height, title, subtitle, shot, variant) {
  await page.setViewportSize({width,height});
  const data = shot.toString('base64');
  const landscape = variant === 'landscape';
  const mini = variant === 'mini';
  const markup = `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#f4f7fc;color:#18243b;font:${mini?'12px':'16px'} Inter,Arial,sans-serif}
    .wrap{height:100%;padding:${mini?'14px':landscape?'42px 56px':'42px 58px'};background:radial-gradient(ellipse at 80% 5%,#e5edff 0,transparent 42%),#f4f7fc}
    .brand{display:flex;align-items:center;gap:${mini?'7px':'13px'};color:#17264a;font-weight:700;letter-spacing:.2px;font-size:${mini?'12px':'16px'}}.brand img{width:${mini?'26px':'42px'};height:${mini?'26px':'42px'}}
    .layout{display:grid;grid-template-columns:${mini?'1fr 0.9fr':landscape?'1fr 1.45fr':'1fr 0.92fr'};gap:${mini?'12px':'42px'};align-items:center;height:calc(100% - ${mini?'34px':'52px'})}
    .copy{max-width:510px}.eyebrow{margin:0 0 ${mini?'6px':'18px'};color:#315cec;font-weight:700;letter-spacing:${mini?'0.5px':'1.5px'};text-transform:uppercase;font-size:${mini?'8px':'13px'}}
    h1{font-size:${mini?'20px':landscape?'48px':'43px'};line-height:1.1;letter-spacing:-.7px;margin:0 0 ${mini?'8px':'20px'}}p{font-size:${mini?'12px':'19px'};color:#58667c;line-height:${mini?'1.35':'1.5'};margin:0;max-width:480px}
    .frame{background:#fff;border:1px solid #dce3ef;border-radius:${mini?'9px':'17px'};padding:${mini?'4px':'10px'};box-shadow:0 22px 65px #26395e24;overflow:hidden}
    .frame img{display:block;width:100%;height:${mini?'200px':landscape?'390px':'610px'};object-fit:contain;object-position:center;border-radius:9px;background:#f5f7fb}
    .note{font-size:${mini?'8px':'13px'};color:#758198;margin-top:${mini?'6px':'16px'};line-height:1.4}
    .social .wrap{padding:28px 38px}.social .layout{grid-template-columns:1fr 1.15fr;gap:28px;height:calc(100% - 42px)}.social h1{font-size:38px}.social p{font-size:16px}.social .frame img{height:480px}
  </style><body class="${variant}"><div class="wrap"><div class="brand"><img src="data:image/png;base64,${fs.readFileSync(icon).toString('base64')}"><span>Running SOP</span></div><div class="layout"><div class="copy"><div class="eyebrow">Version ${version} · Step-by-step work guides</div><h1>${htmlEscape(title)}</h1><p>${htmlEscape(subtitle)}</p><div class="note">Illustrative screens use synthetic examples. Team library features are opt-in and experimental.</div></div><div class="frame"><img src="data:image/png;base64,${data}" alt="Actual Running SOP extension screen"></div></div></div></body>`;
  await page.setContent(markup); await page.screenshot({ path: path.join(out, filename), type: 'png' });
}

async function main() {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  context = await chromium.launchPersistentContext(path.join(scratch, 'profile'), {
    channel: 'chromium', headless: !process.env.RUNTIME_SOP_CHROME,
    ...(process.env.RUNTIME_SOP_CHROME ? { executablePath: process.env.RUNTIME_SOP_CHROME } : {}),
    args: [...(process.env.RUNTIME_SOP_CHROME ? ['--headless=new'] : []), '--host-resolver-rules=MAP team.example.test 127.0.0.1', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--no-default-browser-check']
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = 'chrome-extension://' + new URL(worker.url()).host;
  const setup = await context.newPage(); await setup.setViewportSize({width:1280,height:800}); await setup.goto(origin + '/options.html');
  await setup.evaluate(async () => chrome.storage.local.set({ 'runtime-sop-workspace-preferences-v1': { language: 'en' } }));
  await setup.reload(); await setup.waitForFunction(()=>document.documentElement.lang==='en');
  await setup.locator('#choose-sop-folder').scrollIntoViewIfNeeded();
  await setup.screenshot({path:path.join(out,'04-optional-folder-settings.png')});

  const reader = await context.newPage(); await reader.setViewportSize({width:400,height:700});
  await reader.addInitScript(() => { chrome.tabs.query = async () => [{ id: 4567, url: 'https://example.com/requests', title: 'Synthetic work page' }]; });
  await reader.goto(origin + '/workspace.html'); await reader.waitForFunction(() => document.documentElement.dataset.workspaceReady === 'true');
  const guide = { format:'runtime-sop-guide', schemaVersion:1, workflowId:'synthetic-release-guide', title:'Review a work request', version:'1.0.0', notice:'', steps:[
    { id:'step-1', title:'Check the request', where:'Synthetic work page', workUrl:'https://example.com/requests', actions:['Open the request details.','Confirm the required information is present.'], expected:'The request is ready for review.', trouble:'', acceptance:[], imageMode:'thumbnail', image:syntheticImage },
    { id:'step-2', title:'Record the decision', where:'Synthetic work page', workUrl:'https://example.com/requests', actions:['Add a concise review note.'], expected:'', trouble:'', acceptance:[] }
  ] };
  const draft={id:'synthetic-release',title:guide.title,status:'draft',origin:'https://example.com',createdAt:'',updatedAt:'',steps:guide.steps.map(s=>({id:s.id,type:'manual',title:s.title,url:s.workUrl,workUrl:s.workUrl,where:s.where,action:s.actions.join('\n'),expected:s.expected,acceptance:'',trouble:s.trouble,at:''}))};
  await reader.evaluate(async draft=>{ const response=await chrome.runtime.sendMessage({type:'recorder-import',backup:{format:'runtime-sop-recording',schemaVersion:1,draft}}); if(response.error)throw Error(response.error); await WorkspaceApp.refresh(); await WorkspaceApp.openDraft(response.data.drafts.find(d=>d.title===draft.title).id); },draft);
  // Capture the actual recording editor controls at side-panel size.
  await reader.locator('#editor').waitFor({state:'visible'}); await reader.locator('#edit-action').fill('Open the request details.\nConfirm the required information is present.');
  await reader.locator('#next-step').waitFor({state:'visible'}); const editorShot=await reader.screenshot();

  store = new TeamStore({ dbPath:path.join(scratch,'synthetic.sqlite') });
  const session=store.createSession({displayName:'Synthetic team member'});
  const libraryGuide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'synthetic-library-guide',title:'Prepare a weekly review',version:'1.0.0',notice:'',steps:[{id:'first',title:'Open the review page',where:'Synthetic workspace',workUrl:'https://example.com/review',actions:['Open the weekly review page.','Check the dates before continuing.'],expected:'The review page is ready.',trouble:'',acceptance:[],image:syntheticImage,imageMode:'thumbnail'}]};
  store.create(libraryGuide,{actor:session.actor,idempotencyKey:'media-seed-guide'});
  const category=store.createCategory({id:'media-operations',name:'Operations',parentId:null,color:'blue',icon:'briefcase'},{actor:session.actor,idempotencyKey:'media-seed-category'});
  store.assignCategory('synthetic-library-guide',category.id,{actor:session.actor,expectedCategoryRevision:0,idempotencyKey:'media-assign-category'});
  const lease=store.acquireLock('synthetic-library-guide',{actor:session.actor});
  store.publish('synthetic-library-guide',{...libraryGuide,version:'2.0.0',steps:libraryGuide.steps.map(step=>({...step,actions:[...step.actions,'Save the reviewed summary.']}))},{actor:session.actor,...lease,expectedRevision:1,idempotencyKey:'media-publish-v2'});
  server=createTeamServer({store,joinCode:'synthetic-media-join-code',allowOrigins:[origin]}); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const endpoint='http://team.example.test:'+server.address().port;
  await setup.evaluate(async endpoint=>{ chrome.permissions.request=async()=>true; await RunningSOPTeamSettings.connect({endpoint,displayName:'Synthetic team member',joinCode:'synthetic-media-join-code'}); },endpoint);
  const library=await context.newPage(); await library.setViewportSize({width:1280,height:800}); await library.goto(origin+'/team-library.html'); await library.waitForFunction(()=>document.querySelectorAll('#sops li').length===1);
  await library.locator('#sops li button').click(); await library.waitForFunction(()=>!document.querySelector('#reader').hidden);
  await library.locator('#guide article').first().waitFor();
  await library.locator('#read-sop').click();
  await library.locator('#guide img').first().waitFor();const readView=await library.locator('#reader').screenshot();
  await library.locator('#history-sop').click(); await library.waitForFunction(()=>document.querySelectorAll('#history li').length===2);
  await library.evaluate(()=>scrollTo(0,0));const libraryShot=await library.screenshot(); await write('03-team-library-history.png',libraryShot);

  await setup.evaluate(async endpoint=>{const saved=RunningSOPTeamPicker.create();await saved.save({name:'Operations team',endpoint});await saved.save({name:'Training team',endpoint:'https://training.example.test'});},endpoint);
  await setup.locator('#team-settings summary').click();await setup.locator('#team-choose-service').click();await setup.locator('[data-service-select]').first().waitFor();await setup.screenshot({path:path.join(out,'05-select-team-service.png')});await setup.locator('#team-service-close').click();
  // Bind the real editor session to its actual extension tab; all content stays synthetic.
  const annotation=await context.newPage();await annotation.setViewportSize({width:1280,height:800});await annotation.goto(origin+'/options.html');
  const annotationToken=await annotation.evaluate(async image=>{
    const tab=await chrome.tabs.getCurrent(),token=crypto.randomUUID();
    if(!Number.isInteger(tab?.id))throw Error('Synthetic screenshot editor tab is unavailable');
    await chrome.storage.session.set({['sop-screenshot-'+token]:{mode:'edit',tabId:tab.id,expiresAt:Date.now()+60000,step:{title:'Annotate a synthetic work screen',image,imageMarks:[{type:'number',x:.12,y:.27},{type:'rect',x:.24,y:.37,x2:.8,y2:.6}]}}});
    return token;
  },syntheticImage);
  await annotation.goto(origin+'/screenshot-viewer.html?token='+annotationToken+'&mode=edit');
  await annotation.waitForFunction(()=>document.querySelector('#picture').naturalWidth>0&&document.querySelector('#save').textContent==='Save notes'&&document.querySelector('#close-viewer').textContent==='Exit'&&document.querySelectorAll('.tool-group').length===3&&!document.querySelector('#edit-tools').hidden);
  await annotation.screenshot({path:path.join(out,'06-screenshot-editor.png')});
  await setup.evaluate(()=>{window.showDirectoryPicker=async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('Synthetic release categories',{create:true});});
  await setup.locator('#choose-sop-folder').click();await setup.waitForFunction(()=>!document.querySelector('#category-settings').disabled);
  await setup.locator('#category-settings').click();await setup.locator('#category-name').fill('Operations');await setup.locator('#category-color').selectOption('purple');await setup.locator('#category-icon').selectOption('briefcase');
  await setup.locator('#category-form button[type=submit]').click();await setup.waitForFunction(()=>document.querySelector('#category-status').textContent==='Saved.');
  await setup.screenshot({path:path.join(out,'07-category-settings.png')});await setup.locator('#category-close').click();

  const composePage=await context.newPage();
  await compose(composePage,'01-read-guide.png',1280,800,'Keep the instructions in view.','Read published steps, check the details and enlarge screenshots when you need them.',readView,'');
  await compose(composePage,'02-record-and-edit.png',1280,800,'Build one clear step at a time.','Add instructions and screenshots. Next step saves your changes; publish after reviewing the result.',editorShot,'');
  await compose(composePage,'introduction-1280x800.png',1280,800,'Make work repeatable.','Record a process once, add clear steps and screenshots, then publish a guide colleagues can follow beside their work.',editorShot,'');
  await compose(composePage,'promo-1400x560.png',1400,560,'Turn routine work into clear guides.','Capture steps as you work. Edit the details, then publish to a folder you choose.',libraryShot,'landscape');
  await compose(composePage,'social-1280x640.png',1280,640,'Record it once. Follow it step by step.','Screenshots and clear instructions keep routine work easier to repeat.',libraryShot,'social');
  await compose(composePage,'promo-440x280.png',440,280,'Clear steps. Better handoffs.','Record once. Follow alongside your work.',readView,'mini');
  fs.copyFileSync(icon,path.join(out,'icon-128.png'));
  write('README.txt',`Running SOP v${version} introduction media\n\nScreens show actual extension pages populated with synthetic examples. Team library content and settings are opt-in experimental features. No production SOPs, browser profiles, or real services are included.\n\nFiles: 01-read-guide.png, 02-record-and-edit.png, 03-team-library-history.png, 04-optional-folder-settings.png, 05-select-team-service.png, 06-screenshot-editor.png, 07-category-settings.png, introduction-1280x800.png, promo-1400x560.png, promo-440x280.png, social-1280x640.png, icon-128.png.\n`);
  const files=fs.readdirSync(out).filter(name=>name!=='SHA256SUMS.txt').sort();
  const sums=files.map(name=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')}  ${name}`).join('\n')+'\n';
  write('SHA256SUMS.txt',sums);
  const archiver=require('node:child_process');
  const zip=path.join(root,'dist',mediaArchive);
  fs.rmSync(zip,{force:true});archiver.execFileSync('zip',['-q','-r',zip,mediaDirectory],{cwd:path.join(root,'dist')});
  fs.writeFileSync(zip+'.sha256',crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex')+`  ${mediaArchive}\n`);
  console.log(JSON.stringify({out,zip,files:[...files,'SHA256SUMS.txt'],dimensions:{'01-read-guide.png':'1280x800','02-record-and-edit.png':'1280x800','03-team-library-history.png':'1280x800','04-optional-folder-settings.png':'1280x800','05-select-team-service.png':'1280x800','06-screenshot-editor.png':'1280x800','07-category-settings.png':'1280x800','introduction-1280x800.png':'1280x800','promo-1400x560.png':'1400x560','promo-440x280.png':'440x280','social-1280x640.png':'1280x640'}},null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(context)await context.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(store)store.close();fs.rmSync(scratch,{recursive:true,force:true});});
