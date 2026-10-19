'use strict';
// Combined primary planning fixture. All business content and addresses are synthetic.
// Run: node server/tools/primary-rich.cjs --out /tmp/primary-rich.json
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { Readable, Transform } = require('node:stream');
const { createHash, webcrypto } = require('node:crypto');
const { TeamStore } = require('../store.cjs');
const { createTeamServer } = require('../app.cjs');
const TeamClient = require('../../extension/team-client.js');
const { validateGuide } = require('../../extension/catalog-engine.js');

const GUIDE_COUNT = 500, READER_COUNT = 75;
const JOIN_CODE = 'synthetic-primary-rich-join-code';
const departments = [
  { id:'finance', name:'Finance', areas:['Invoice processing','Expense review','Month close'] },
  { id:'people', name:'Human Resources', areas:['Employee onboarding','Leave approval','Training records'] },
  { id:'procurement', name:'Procurement', areas:['Purchase requests','Supplier review','Goods receipt'] },
  { id:'sales', name:'Sales', areas:['Lead qualification','Quote approval','Order handover'] },
  { id:'support', name:'Customer Support', areas:['Ticket triage','Refund review','Escalation handling'] },
  { id:'it', name:'Information Technology', areas:['Access requests','Device provisioning','Incident response'] }
];
const colors = ['blue','purple','green','orange','red','gray'];
const jpegBytes = fs.readFileSync(path.join(__dirname, '../../examples/illustrations/demo-step.jpg'));
const image = 'data:image/jpeg;base64,' + jpegBytes.toString('base64');
const sha = value => createHash('sha256').update(value).digest('hex');
const flowId = i => 'synthetic-rich-' + String(i).padStart(4, '0');
const department = i => departments[i % departments.length];
const areaIndex = i => Math.floor(i / departments.length) % 3;
const categoryId = i => department(i).id + '-area-' + areaIndex(i);
const workUrl = (i, s = 0) => 'https://work.example.test/' + department(i).id + '/' + flowId(i) + '/step/' + s;
const categoryDefinitions = departments.flatMap((d, n) => [
  {id:d.id,name:d.name,parentId:null,color:colors[n],icon:'briefcase'},
  ...d.areas.map((name, a) => ({id:d.id+'-area-'+a,name,parentId:d.id,color:colors[n],icon:'folder'}))
]);
function guide(i) {
  const d = department(i), area = d.areas[areaIndex(i)], size = 3 + i % 10;
  return validateGuide({
    format:'runtime-sop-guide',schemaVersion:1,workflowId:flowId(i),
    title:d.name+' | '+area+' | Case '+String(i).padStart(4,'0'),version:'1',
    notice:'Synthetic test only. Reuses the same illustrated JPEG; no real people, business records, or screenshots.',
    steps:Array.from({length:size}, (_, s) => ({
      id:'step-'+s,title:s===0?'Review request':s===size-1?'Confirm completion':'Process checkpoint '+s,
      where:d.name+' / '+area,workUrl:workUrl(i,s),
      actions:[s===0?'Open the synthetic '+area.toLowerCase()+' request.':
        s===size-1?'Confirm the approved outcome and close the synthetic request.':
        'Check synthetic supporting evidence and complete checkpoint '+s+'.',
      'Confirm case '+String(i).padStart(4,'0')+' belongs to '+d.name+'.'],
      expected:'Case '+i+' checkpoint '+s+' has a recorded, reviewed outcome.',
      trouble:'Use the issue branch when evidence is incomplete or approval is declined.',
      acceptance:['The synthetic reference matches.','The responsible reviewer confirmed the outcome.'],
      pointType:s===1?'report':s===size-1?'approval':'normal',
      pointNote:s===1?'Report the checkpoint summary to the department lead.':
        s===size-1?'Wait for the designated manager to approve completion.':'',
      image,imageAt:'2026-01-01T00:00:00Z',imageMarks:[{type:'number',x:.2,y:.3}],
      ...(s===0||s===size-1 ? {issues:[{
        id:s===0?'missing-evidence':'approval-declined',
        title:s===0?'Supporting evidence is missing':'Manager declines completion',
        actions:[s===0?'Ask the requester to supply the synthetic missing evidence.':'Record the synthetic rejection and return the case for review.'],
        next:s===0?'Return to the request review.':'Return to the previous checkpoint.',
        image,imageMarks:[{type:'number',x:.4,y:.5}]
      }]} : {})
    }))
  });
}

function childMain() {
  const directory = process.env.SOP_PRIMARY_RICH_DIRECTORY;
  const dbPath = process.env.SOP_PRIMARY_RICH_DATABASE;
  // A child must have private parent IPC and a fresh isolated directory. Never
  // accept a real endpoint or arbitrary database file from a command-line flag.
  assert.ok(process.send && directory && dbPath, 'Use the parent fixture orchestrator');
  assert.equal(path.dirname(dbPath), directory);
  assert.equal(path.basename(dbPath), 'primary.sqlite');
  assert.ok(path.basename(directory).startsWith('sop-primary-rich-'));
  assert.equal(fs.readFileSync(path.join(directory, 'isolated-fixture'), 'utf8'), 'synthetic-primary-rich');
  assert.equal(fs.existsSync(dbPath), false, 'Fixture database must be new');
  const started = performance.now(), store = new TeamStore({dbPath});
  const seedActor = store.createSession({displayName:'Synthetic fixture seed'}).actor;
  for (const value of categoryDefinitions) store.createCategory(value, {actor:seedActor,idempotencyKey:'rich-category-'+value.id});
  let stepCount = 0, issueCount = 0, reportPoints = 0, approvalPoints = 0;
  let minGuideBytes = Infinity, maxGuideBytes = 0, totalGuideBytes = 0;
  const manifest = [];
  for (let i = 0; i < GUIDE_COUNT; i++) {
    const created = store.create(guide(i), {actor:seedActor,idempotencyKey:'rich-guide-'+i});
    store.assignCategory(created.id, categoryId(i), {actor:seedActor,expectedCategoryRevision:0,idempotencyKey:'rich-assignment-'+i});
    const bytes = Buffer.byteLength(JSON.stringify(created.guide));
    stepCount += created.guide.steps.length;
    issueCount += created.guide.steps.reduce((n,s) => n+(s.issues||[]).length, 0);
    reportPoints += created.guide.steps.filter(s=>s.pointType==='report').length;
    approvalPoints += created.guide.steps.filter(s=>s.pointType==='approval').length;
    minGuideBytes = Math.min(minGuideBytes, bytes); maxGuideBytes = Math.max(maxGuideBytes, bytes); totalGuideBytes += bytes;
    manifest.push({id:created.id,revision:created.revision,sha256:created.sha256,bytes});
  }
  const before = store.db.prepare('SELECT id,revision,sha256,guide,wireBytes FROM revisions ORDER BY id,revision').all();
  const immutableDigest = () => sha(JSON.stringify(store.db.prepare('SELECT id,revision,sha256,guide,wireBytes FROM revisions ORDER BY id,revision').all()));
  const originalDigest = sha(JSON.stringify(before));
  const queryPlans = {
    match:store.db.prepare('EXPLAIN QUERY PLAN SELECT id FROM matches WHERE matchKey=?').all(store.urlKey(workUrl(17))),
    category:store.db.prepare('EXPLAIN QUERY PLAN SELECT id FROM workflows WHERE category=? ORDER BY updatedAt DESC,id LIMIT 7').all(categoryId(17)),
    search:store.db.prepare('EXPLAIN QUERY PLAN SELECT w.id FROM title_search JOIN workflows w ON w.id=title_search.id WHERE title_search MATCH ?').all('"3132"')
  };
  assert.match(JSON.stringify(queryPlans.match), /SEARCH.*INDEX/);
  assert.match(JSON.stringify(queryPlans.category), /workflow_category/);
  assert.match(JSON.stringify(queryPlans.search), /VIRTUAL TABLE INDEX/);
  let connections = 0, peakConnections = 0, getCalls = 0;
  const actualGet = store.get.bind(store);
  store.get = (...args) => {getCalls++; return actualGet(...args);};
  const server = createTeamServer({store,joinCode:JOIN_CODE}); // All production limits unchanged.
  const liveSockets = new Set();
  server.on('connection', socket => {
    liveSockets.add(socket); connections++; peakConnections = Math.max(peakConnections, connections);
    socket.once('close', () => {liveSockets.delete(socket); connections--;});
  });
  server.listen({port:0,host:'127.0.0.1'}, () => process.send({
    ready:true,port:server.address().port,seedMs:performance.now()-started,manifest,queryPlans,
    dataset:{guides:GUIDE_COUNT,steps:stepCount,issues:issueCount,minStepsPerGuide:3,maxStepsPerGuide:12,
      reportPoints,approvalPoints,departments:departments.length,
      categories:categoryDefinitions.length,businessSubcategories:18,stepImageReferences:stepCount,
      issueImageReferences:issueCount,uniqueImageHashes:store.db.prepare('SELECT count(*) AS n FROM assets').get().n,
      uniqueAssetBytes:store.db.prepare('SELECT sum(byteLength) AS n FROM assets').get().n,
      jpegFileSha256:sha(jpegBytes),imageDataUrlSha256:sha(image),minGuideBytes,maxGuideBytes,totalGuideBytes,
      serviceSchemaVersion:store.db.prepare('PRAGMA user_version').get().user_version,
      departmentCounts:departments.map(d=>({id:d.id,name:d.name,guides:Array.from({length:GUIDE_COUNT},(_,i)=>i).filter(i=>department(i).id===d.id).length}))}
  }));
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    server.close(() => {store.close(); process.exit(0);});
    for (const socket of liveSockets) socket.destroy();
  };
  process.on('message', message => {
    if (message.type === 'stats') process.send({stats:true,connections,peakConnections,getCalls,
      revisionsUnchanged:immutableDigest()===originalDigest,
      categoryUpdates:store.db.prepare("SELECT count(*) AS n FROM category_audit WHERE action='update'").get().n,
      assignments:store.db.prepare("SELECT count(*) AS n FROM category_audit WHERE action='assign'").get().n,
      memory:process.memoryUsage()});
    if (message.type === 'stop') stop();
  });
  process.on('disconnect', stop);
}

function waitMessage(child, key, send) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(Error('Fixture IPC deadline: '+key)), 30000);
    const message = value => {if (value[key]) finish(null, value);};
    const exited = code => finish(Error('Fixture exited before '+key+': '+code));
    function finish(error, value) {
      clearTimeout(timer); child.off('message', message); child.off('exit', exited); child.off('error', failed);
      error ? reject(error) : resolve(value);
    }
    const failed = error => finish(error);
    child.on('message', message); child.once('exit', exited); child.once('error', failed);
    if (send) child.send(send);
  });
}
async function main() {
  const flag = process.argv.indexOf('--out');
  const output = path.resolve(flag < 0 ? path.join(os.tmpdir(),'primary-rich-report.json') : process.argv[flag+1]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'sop-primary-rich-'));
  fs.writeFileSync(path.join(directory,'isolated-fixture'), 'synthetic-primary-rich');
  const agents = Array.from({length:READER_COUNT}, () => new http.Agent({keepAlive:true,maxSockets:1,maxFreeSockets:1}));
  const child = fork(__filename, [], {env:{...process.env,SOP_PRIMARY_RICH_CHILD:'1',
    SOP_PRIMARY_RICH_DIRECTORY:directory,SOP_PRIMARY_RICH_DATABASE:path.join(directory,'primary.sqlite')},
    stdio:['ignore','inherit','inherit','ipc']});
  let currentPhase;
  const report = {kind:'combined-rich-primary-actual-sdk-http',recordedAt:new Date().toISOString(),
    node:process.version,platform:process.platform,arch:process.arch,clients:READER_COUNT,
    latencyDefinition:'Per-participant completion time within a phase, including paging, sequential guide reads, and SDK retries where applicable; not individual HTTP response latency.',
    cache:{cacheLimit:0,maxCacheBytes:0,fetch:'no-store'},phases:[],
    limitations:[
      '500 synthetic SOPs and a simultaneous 75-reader planning burst; 75 is not measured organization concurrency.',
      'All 4,750 image references reuse ONE actual synthetic illustrated JPEG and deduplicate to one binary asset. These are not distinct physical screenshots.',
      'Independent authenticated SDK readers and HTTP socket agents on one loopback host; not 75 devices, browser rendering, physical LAN, NAS, HTTPS, or old-hardware evidence.',
      'Sockets warm in batches of 25; measured read phases burst all 75 readers. Cold socket acceptance is covered by the separate scale fixture.',
      'Response bytes count received HTTP bodies, including rejected admission attempts; request headers and TCP overhead are excluded.',
      'Production admission, rate, body, and timeout limits are unchanged. Only the real SDK bounded authenticated-read retries are allowed.',
      'Category rename and assignment writes are explicitly performed once, with no mutation retry.'
    ]};
  const fetcher = index => (url, opts = {}) => new Promise((resolve, reject) => {
    const u = new URL(url), phase = currentPhase;
    assert.equal(u.origin, report.endpointOrigin, 'Fixture fetch must use its private service');
    if (phase) {
      phase.httpRequests++; const route = (opts.method||'GET')+' '+u.pathname+u.search;
      // POST /matches legitimately occurs for two different addresses in one
      // phase; only repeated identical requests are SDK retry attempts.
      const retryKey = index+' '+route+' '+(opts.body===undefined?'':sha(opts.body));
      const tries = phase.attempts.get(retryKey)||0; if (tries) phase.retryAttempts++;
      phase.attempts.set(retryKey,tries+1);
      if (u.pathname.includes('/images/')) phase.imageRequests++;
    }
    const req = http.request({hostname:u.hostname,port:u.port,path:u.pathname+u.search,
      method:opts.method,headers:opts.headers,signal:opts.signal,agent:agents[index]}, res => {
      if (phase) phase.statuses[res.statusCode]=(phase.statuses[res.statusCode]||0)+1;
      const counted = new Transform({transform(chunk,encoding,callback) {
        if (phase) phase.responseBytes += chunk.length; callback(null,chunk);
      }});
      res.once('error', error => counted.destroy(error));
      counted.once('close', () => {if (!res.complete) res.destroy();}); res.pipe(counted);
      resolve(new Response(Readable.toWeb(counted),{status:res.statusCode,headers:res.headers}));
    });
    req.once('error', error => {if (phase) phase.transportErrors++; reject(error);}); req.end(opts.body);
  });
  async function phase(name, operation, participants = READER_COUNT) {
    const p = {name,participants,completed:0,uncompleted:0,httpRequests:0,retryAttempts:0,imageRequests:0,
      responseBytes:0,transportErrors:0,statuses:{},attempts:new Map()};
    currentPhase = p; const started = performance.now(), times = [];
    const outcomes = await Promise.allSettled(Array.from({length:participants},async(_,index) => {
      const start = performance.now(); await operation(index); times.push(performance.now()-start); p.completed++;
    }));
    p.durationMs = performance.now()-started; times.sort((a,b)=>a-b);
    p.p50Ms=times[Math.floor(times.length*.5)];p.p95Ms=times[Math.min(times.length-1,Math.floor(times.length*.95))];p.maxMs=times.at(-1);
    p.uncompleted = outcomes.filter(r=>r.status==='rejected').length;
    p.failures = outcomes.flatMap((r,i)=>r.status==='rejected'?[{reader:i,code:r.reason.code||r.reason.name,message:r.reason.message}]:[]);
    delete p.attempts; currentPhase = null; report.phases.push(p); console.log(JSON.stringify(p));
    if (p.uncompleted) throw outcomes.find(r=>r.status==='rejected').reason;
    return p;
  }
  try {
    const ready = await waitMessage(child,'ready');
    report.endpointOrigin = 'http://127.0.0.1:'+ready.port; // Kept in memory, omitted from the written report.
    report.seedMs=ready.seedMs;report.dataset=ready.dataset;report.queryPlans=ready.queryPlans;
    assert.equal(ready.dataset.guides,500);assert.equal(ready.dataset.steps,3750);assert.equal(ready.dataset.issues,1000);
    assert.equal(ready.dataset.uniqueImageHashes,1);assert.equal(ready.dataset.uniqueAssetBytes,jpegBytes.length);
    report.manifestSha256=sha(JSON.stringify(ready.manifest));
    const manifest = new Map(ready.manifest.map(v=>[v.id,v]));
    for(let start=0;start<READER_COUNT;start+=25) await Promise.all(Array.from({length:Math.min(25,READER_COUNT-start)},async(_,offset)=>{
      const response=await fetcher(start+offset)(report.endpointOrigin+'/health');assert.equal(response.status,200);await response.text();
    }));
    const apis = [], actors = new Set(), tokens = new Set();
    await phase('independent-authenticated-sessions', async i => {
      const config={endpoint:report.endpointOrigin,fetch:fetcher(i),crypto:webcrypto,cacheLimit:0,maxCacheBytes:0};
      const session=await TeamClient.create(config).join(JOIN_CODE,'Synthetic reader '+i);
      actors.add(session.actor.id);tokens.add(session.token);
      apis[i]=TeamClient.create({...config,token:session.token});
    });
    assert.equal(actors.size,READER_COUNT);assert.equal(tokens.size,READER_COUNT);
    report.independentAuthenticatedActors=actors.size;
    assert.ok((await apis[0].capabilities()).features.includes('read-view-images'));
    const selected = i => (i * 7) % GUIDE_COUNT;
    const assertMetadata = (item, expectedCategory) => {
      const wanted=manifest.get(item.id);assert.ok(wanted,'Unexpected guide '+item.id);
      assert.equal(item.revision,wanted.revision);assert.equal(item.sha256,wanted.sha256);
      if(expectedCategory)assert.equal(item.categoryId,expectedCategory);
      assert.equal(item.guide,undefined,'Metadata may not include full guide');
    };
    async function paged(api, options, expectedIds) {
      let cursor, pages=0;const seen=[];
      do {
        const result=await api.list({...options,...(cursor?{cursor}:{})});pages++;
        for(const item of result.items){assertMetadata(item,options.category);seen.push(item.id);}
        if(result.nextCursor)assert.notEqual(result.nextCursor,cursor,'Paging must advance');
        cursor=result.nextCursor;assert.ok(pages<=GUIDE_COUNT,'Paging must terminate');
      } while(cursor);
      assert.equal(new Set(seen).size,seen.length,'No duplicate page items');
      assert.deepEqual(seen.slice().sort(),expectedIds.slice().sort(),'Exact categorized search membership');
    }
    await phase('exact-indexed-address-match',async i=>{
      const n=selected(i), result=await apis[i].matches(workUrl(n)+'?ignored=synthetic#ignored');
      assert.equal(result.state,'matched');assert.equal(result.items.length,1);assert.equal(result.items[0].id,flowId(n));
      assertMetadata(result.items[0],categoryId(n));
      const absent=await apis[i].matches(workUrl(n)+'-absent');assert.equal(absent.state,'none');assert.equal(absent.items.length,0);
    });
    await phase('selective-search',async i=>{
      const n=selected(i), result=await apis[i].list({query:'Case '+String(n).padStart(4,'0'),limit:7});
      assert.equal(result.items.length,1);assert.equal(result.items[0].id,flowId(n));assertMetadata(result.items[0],categoryId(n));
      assert.equal(result.nextCursor,null);
    });
    await phase('department-search-paging',async i=>{
      const d=departments[i%6],ids=Array.from({length:GUIDE_COUNT},(_,n)=>n).filter(n=>department(n).id===d.id).map(flowId);
      await paged(apis[i],{query:d.name,limit:17},ids);
    });
    await phase('business-category-search-paging',async i=>{
      const n=selected(i),ids=Array.from({length:GUIDE_COUNT},(_,n)=>n).filter(v=>categoryId(v)===categoryId(n)).map(flowId);
      await paged(apis[i],{query:department(n).areas[areaIndex(n)],category:categoryId(n),limit:7},ids);
    });
    await phase('category-tree-paging',async i=>{
      const found=[];let cursor;
      do {const page=await apis[i].categories({limit:7,...(cursor?{cursor}:{})});found.push(...page.items);cursor=page.nextCursor;} while(cursor);
      assert.deepEqual(found.map(v=>v.id).sort(),categoryDefinitions.map(v=>v.id).sort());
      for(const value of found){const expected=categoryDefinitions.find(v=>v.id===value.id);assert.equal(value.parentId,expected.parentId);assert.equal(value.revision,1);}
    });
    await phase('verified-text-and-selected-step-and-issue-images',async i=>{
      const n=selected(i),expected=guide(n),view=await apis[i].readView(flowId(n)),wanted=manifest.get(flowId(n));
      assert.equal(view.revision,1);assert.equal(view.sha256,wanted.sha256);assert.equal(view.guide.workflowId,flowId(n));
      const stripped=JSON.parse(JSON.stringify(expected));
      for(const step of stripped.steps)for(const target of [step,...(step.issues||[])]){delete target.image;delete target.imageAt;delete target.imageMarks;}
      assert.deepEqual(view.guide,stripped);assert.equal(view.images.length,expected.steps.length+2);
      const stepRef=view.images.find(r=>r.issue===undefined&&r.step===i%expected.steps.length);
      const issueRef=view.images.find(r=>r.issue!==undefined&&r.step===(i%2?expected.steps.length-1:0));
      assert.ok(stepRef&&issueRef);
      for(const ref of [stepRef,issueRef]){const result=await apis[i].readImage(flowId(n),ref,{revision:view.revision});assert.equal(result.image,image);assert.equal(result.sha256,sha(image));}
    });
    let fullVerified=0;
    const verifyFull=async(api,n)=>{
      const result=await api.getSop(flowId(n)),wanted=manifest.get(flowId(n)),raw=JSON.stringify(result.guide);
      assert.equal(result.id,wanted.id);assert.equal(result.revision,wanted.revision);assert.equal(result.sha256,wanted.sha256);
      assert.equal(sha(raw),wanted.sha256);assert.equal(Buffer.byteLength(raw),wanted.bytes);assert.deepEqual(result.guide,guide(n));
      fullVerified++;
    };
    await phase('all-500-full-guide-integrity-75-reader-burst',async i=>{
      for(let n=i;n<GUIDE_COUNT;n+=READER_COUNT)await verifyFull(apis[i],n);
    });
    assert.equal(fullVerified,GUIDE_COUNT);report.fullGuideCoverage=fullVerified;
    await phase('rename-six-departments',async i=>{
      const value=categoryDefinitions.find(v=>v.id===departments[i].id);
      const updated=await apis[i].updateCategory(value.id,{...value,name:value.name+' (Reviewed)'},{expectedRevision:1});
      assert.equal(updated.revision,2);assert.equal(updated.id,value.id);assert.equal(updated.parentId,null);
    },6);
    await phase('reassign-75-guide-business-categories',async i=>{
      const n=selected(i),newCategory=department(n).id+'-area-'+((areaIndex(n)+1)%3);
      const result=await apis[i].assignCategory(flowId(n),newCategory,{expectedCategoryRevision:1});
      assert.equal(result.categoryRevision,2);assert.equal(result.categoryId,newCategory);
      const list=await apis[i].list({query:'Case '+String(n).padStart(4,'0'),category:newCategory,limit:7});
      assert.equal(list.items.length,1);assert.equal(list.items[0].id,flowId(n));assertMetadata(list.items[0],newCategory);assert.equal(list.items[0].categoryRevision,2);
    });
    await phase('post-category-update-unchanged-canonical-guides',async i=>verifyFull(apis[i],selected(i)));
    const stats=await waitMessage(child,'stats',{type:'stats'});report.server=stats;
    assert.equal(stats.revisionsUnchanged,true,'All 500 stored revisions and guide bytes must be unchanged');
    assert.equal(stats.categoryUpdates,6);assert.equal(stats.assignments,575);assert.ok(stats.peakConnections>=READER_COUNT);
    assert.ok(stats.getCalls>=GUIDE_COUNT+READER_COUNT*2,'Cache-off reads must reach the store');
    report.totalFullGuideVerifications=fullVerified;
    report.uncompleted=report.phases.reduce((n,p)=>n+p.uncompleted,0);assert.equal(report.uncompleted,0);
    report.unexpectedFailures=0;report.success=true;
  } catch(error) {
    report.success=false;report.failure={code:error.code||error.name,message:error.message};throw error;
  } finally {
    for(const agent of agents)agent.destroy();
    if(child.exitCode===null&&child.signalCode===null){
      const exited=once(child,'exit');
      if(child.connected)child.send({type:'stop'});else child.kill();
      const fallback=setTimeout(()=>child.kill('SIGKILL'),5000);fallback.unref();
      await exited;clearTimeout(fallback);
    }
    fs.rmSync(directory,{recursive:true,force:true});
    delete report.endpointOrigin;report.cleanup={socketsDestroyed:true,childStopped:true,temporaryDatabaseRemoved:!fs.existsSync(directory)};
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({report:output,success:report.success,cleanup:report.cleanup}));
  }
}
if(process.env.SOP_PRIMARY_RICH_CHILD==='1')childMain();
else main().catch(error=>{console.error(error);process.exitCode=1;});
