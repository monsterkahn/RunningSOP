'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.RUNTIME_SOP_PLAYWRIGHT||'playwright');
const {TeamStore}=require('../server/store.cjs'),{createTeamServer}=require('../server/app.cjs');
const extension=process.env.RUNTIME_SOP_EXTENSION||path.resolve(__dirname,'../extension');
test('real extension authenticates separate text/image reads and renders historical annotated images',{timeout:60000},async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-read-view-browser-'));let context,store,server;
 try{
  context=await chromium.launchPersistentContext(path.join(directory,'profile'),{channel:'chromium',headless:!process.env.RUNTIME_SOP_CHROME,...(process.env.RUNTIME_SOP_CHROME?{executablePath:process.env.RUNTIME_SOP_CHROME}:{}),args:[...(process.env.RUNTIME_SOP_CHROME?['--headless=new']:[]),`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-first-run','--no-default-browser-check']});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),origin='chrome-extension://'+new URL(worker.url()).host;
  store=new TeamStore({dbPath:path.join(directory,'library.sqlite')});const actor=store.createSession({displayName:'Synthetic seed'}).actor;
  const image='data:image/jpeg;base64,'+fs.readFileSync(path.resolve(__dirname,'../examples/illustrations/demo-step.jpg')).toString('base64');
  const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'view-sample',title:'Synthetic view',version:'1',notice:'',steps:[{id:'first',title:'',where:'Synthetic',actions:['Historical action'],expected:'',trouble:'',acceptance:[],image,imageMarks:[{type:'number',x:.2,y:.3}],issues:[{id:'issue-one',title:'Issue',actions:['Review'],next:'Continue',image}]}]};
  store.create(guide,{actor,idempotencyKey:'read-view-seed-1'});const lease=store.acquireLock('view-sample',{actor});store.publish('view-sample',{...guide,version:'2',steps:guide.steps.map(step=>({...step,actions:['Current action']}))},{actor,...lease,expectedRevision:1,idempotencyKey:'read-view-publish-2'});
  server=createTeamServer({store,joinCode:'synthetic-view-browser-join-code',allowOrigins:[origin]});const routes=[];server.on('request',req=>routes.push(req.url));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint='http://127.0.0.1:'+server.address().port;
  const options=await context.newPage();await options.goto(origin+'/options.html');await options.waitForFunction(()=>!!window.RunningSOPTeamSettings);
  await options.evaluate(async endpoint=>{chrome.permissions.request=async()=>true;await RunningSOPTeamSettings.connect({endpoint,displayName:'View browser',joinCode:'synthetic-view-browser-join-code'});},endpoint);
  const page=await context.newPage();await page.goto(origin+'/team-library.html');await page.waitForFunction(()=>!!window.ScreenshotEditor&&!!window.RunningSOPTeamClient);
  const result=await page.evaluate(async()=>{
   const record=await RunningSOPTeamSettings.read(),api=RunningSOPTeamClient.create({endpoint:record.endpoint,token:record.token});
   const capabilities=await api.capabilities(),view=await api.readView('view-sample',{revision:1}),current=await api.readView('view-sample');
   const ref=view.images.find(v=>v.issue===undefined),picture=await api.readImage(view.id,ref,{revision:view.revision});
   const issue=await api.readImage(view.id,view.images.find(v=>v.issue===0),{revision:view.revision});
   const box=document.createElement('div');box.id='read-view-test-picture';document.body.append(box);
   await ScreenshotEditor.renderFigure(box,{...view.guide.steps[0],image:picture.image,imageMarks:ref.imageMarks});
   return {feature:capabilities.features.includes('read-view-images'),revision:view.revision,current:current.revision,action:view.guide.steps[0].actions[0],images:view.images.length,inline:!!view.guide.steps[0].image,issueMatches:issue.image===picture.image,img:box.querySelectorAll('img').length,marks:box.querySelectorAll('.image-marks-overlay svg').length};
  });
  assert.deepEqual(result,{feature:true,revision:1,current:2,action:'Historical action',images:2,inline:false,issueMatches:true,img:1,marks:1});
  assert.equal(routes.some(route=>/^\/v1\/sops\/view-sample(?:\?|$)/.test(route)),false,'The SDK proof must not silently fall back to full-guide reads');
  assert.ok(routes.includes('/v1/sops/view-sample/images/0?revision=1'));assert.ok(routes.includes('/v1/sops/view-sample/images/0/issues/0?revision=1'));
 }finally{if(context)await context.close();if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});if(store)store.close();fs.rmSync(directory,{recursive:true,force:true});}
});
