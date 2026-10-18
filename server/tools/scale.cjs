'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {fork}=require('node:child_process'),{once}=require('node:events'),{createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const {TeamStore}=require('../store.cjs');
const arg=name=>{const at=process.argv.indexOf('--'+name);return at<0?undefined:process.argv[at+1];};
const count=Number(arg('sops')||500),clients=Number(arg('clients')||75);
if(!Number.isSafeInteger(count)||count<clients||count>1000000||!Number.isSafeInteger(clients)||clients<2||clients>500)throw Error('Use 2..500 clients and at least as many SOPs, up to 1 million');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'running-sop-team-scale-')),dbPath=path.join(directory,'team.sqlite');
const sockets=Number(arg('sockets')||clients);
if(!Number.isSafeInteger(sockets)||sockets<1||sockets>clients)throw Error('Socket pool must be between 1 and client count');
const agents=Array.from({length:sockets===clients?clients:1},()=>new http.Agent({keepAlive:true,maxSockets:sockets===clients?1:sockets,maxFreeSockets:sockets===clients?1:sockets}));
let requestIndex=0;
const id=i=>'flow-'+String(i).padStart(6,'0');
const guide=i=>({format:'runtime-sop-guide',schemaVersion:1,workflowId:id(i),title:'Synthetic 采购审批 '+String(i).padStart(6,'0'),version:'1',notice:'Synthetic performance fixture',steps:[{id:'step-one',title:'',where:'Synthetic',actions:['Check the synthetic fixture'],expected:'',trouble:'',acceptance:[],workUrl:'https://work.example.test/task/'+i}]});
const report={kind:'isolated-local-http-load-test',node:process.version,platform:process.platform,arch:process.arch,cpuModel:os.cpus()[0]?.model,cpus:os.cpus().length,totalMemory:os.totalmem(),sops:count,clients,socketPool:sockets,phases:[],limitations:['Synthetic one-step documents; not 200,000 image-heavy production SOPs.','Loopback VM/process tests do not establish physical LAN latency or old-hardware performance.']};
let child,port;
async function message(type,data={}){const response=new Promise((resolve,reject)=>{const listener=m=>{if(m[type]){child.off('message',listener);resolve(m);}};child.on('message',listener);child.once('error',reject);});child.send(data);return response;}
function request(method,route,token,body,key){return new Promise((resolve,reject)=>{
 const raw=body===undefined?null:JSON.stringify(body),headers={'X-Running-SOP-Protocol':'1'};
 if(token)headers.Authorization='Bearer '+token;if(raw){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(raw);}if(key)headers['Idempotency-Key']=key;
 const deadline=setTimeout(()=>req.destroy(Error('Total request deadline exceeded')),30000);
 const req=http.request({host:'127.0.0.1',port,path:route,method,agent:agents[requestIndex++%agents.length],headers},res=>{let data='',length=0;res.setEncoding('utf8');res.on('data',s=>{length+=Buffer.byteLength(s);if(length>5*1024*1024){req.destroy(Error('Oversized response'));return;}data+=s;});res.on('end',()=>{try{resolve({status:res.statusCode,...JSON.parse(data),bytes:length});}catch(e){reject(e);}});res.on('error',reject);});req.setTimeout(30000,()=>req.destroy(Error('Request deadline exceeded')));req.once('close',()=>clearTimeout(deadline));req.on('error',reject);if(raw)req.write(raw);req.end();
});}
async function phase(name,operation){const elapsed=[],start=performance.now();let responseBytes=0;const results=await Promise.all(Array.from({length:clients},async(_,i)=>{const t=performance.now(),r=await operation(i);elapsed.push(performance.now()-t);responseBytes+=r.bytes||0;return r;}));elapsed.sort((a,b)=>a-b);const result={name,requests:clients,concurrency:clients,durationMs:performance.now()-start,p50Ms:elapsed[Math.floor(elapsed.length*.5)],p95Ms:elapsed[Math.min(elapsed.length-1,Math.floor(elapsed.length*.95))],maxMs:elapsed.at(-1),responseBytes};report.phases.push(result);console.log(JSON.stringify(result));return results;}
async function main(){
 const start=performance.now(),store=new TeamStore({dbPath});report.serviceSchemaVersion=store.db.prepare('PRAGMA user_version').get().user_version;
 try{
  const w=store.db.prepare('INSERT INTO workflows(id,title,revision,sha256,updatedAt,normalizedTitle) VALUES(?,?,1,?,?,?)');
  const r=store.db.prepare('INSERT INTO revisions(id,revision,sha256,guide,updatedAt,wireBytes) VALUES(?,1,?,?,?,?)'),m=store.db.prepare('INSERT INTO matches VALUES(?,?)'),f=store.db.prepare('INSERT INTO title_search(rowid,id,grams) VALUES(?,?,?)');
  // Bulk fixtures preserve production hashes/routes/search data, without running
  // 200,000 separate durable user publications or storing idempotency replays.
  for(let offset=0;offset<count;offset+=1000)store.tx(()=>{for(let i=offset;i<Math.min(count,offset+1000);i++){
   const g=guide(i),raw=JSON.stringify(g),hash=createHash('sha256').update(raw).digest('hex'),title=store.normalTitle(g.title),t=1700000000000+i;
   const row=w.run(id(i),g.title,hash,t,title);r.run(id(i),hash,raw,t,Buffer.byteLength(raw));m.run(store.urlKey(g.steps[0].workUrl),id(i));f.run(Number(row.lastInsertRowid),id(i),store.grams(title).join(' '));
  }});
  report.seedMs=performance.now()-start;
  report.queryPlans={match:store.db.prepare('EXPLAIN QUERY PLAN SELECT id FROM matches WHERE matchKey=?').all('web:https://work.example.test/task/123'),list:store.db.prepare('EXPLAIN QUERY PLAN SELECT id FROM workflows ORDER BY updatedAt DESC,id LIMIT 50').all(),search:store.db.prepare('EXPLAIN QUERY PLAN SELECT w.id FROM title_search JOIN workflows w ON w.id=title_search.id WHERE title_search MATCH ?').all('"3132"')};
  assert.match(JSON.stringify(report.queryPlans.match),/SEARCH.*INDEX/);assert.match(JSON.stringify(report.queryPlans.list),/workflow_listing/);assert.match(JSON.stringify(report.queryPlans.search),/VIRTUAL TABLE INDEX/);
 }finally{store.close();}
 report.databaseBytes=fs.statSync(dbPath).size;console.log(JSON.stringify({seedMs:report.seedMs,databaseBytes:report.databaseBytes}));
 child=fork(path.join(__dirname,'fixture-service.cjs'),[],{env:{...process.env,SOP_TEST_DATABASE:dbPath},stdio:['ignore','inherit','inherit','ipc']});
 const ready=await new Promise((resolve,reject)=>{child.on('message',m=>{if(m.ready)resolve(m);});child.once('exit',code=>reject(Error('Server exited before startup: '+code)));});port=ready.port;
 // A gradual startup avoids overflowing the host TCP accept queue. Cold-start
 // bursts are a separate host-capacity experiment, not hidden application retries.
 if(agents.length===clients&&arg('cold')!=='true'){
  for(let offset=0;offset<clients;offset+=32){const warm=await Promise.all(Array.from({length:Math.min(32,clients-offset)},()=>request('GET','/health')));warm.forEach(r=>assert.equal(r.status,200));}
  report.connectionStartup='gradual batches of 32';
 }else report.connectionStartup=agents.length===clients?'cold burst':'shared socket pool';
 const sessions=await phase('join',()=>request('POST','/v1/sessions',null,{joinCode:'synthetic-benchmark-join-code',displayName:'Synthetic client'}));sessions.forEach(r=>assert.equal(r.status,201));
 const auth=sessions.map(r=>r.data.token);
 const matching=await phase('indexed-match',i=>request('POST','/v1/matches',auth[i],{url:guide(i).steps[0].workUrl}));matching.forEach((r,i)=>{assert.equal(r.status,200);assert.equal(r.data.state,'matched');assert.equal(r.data.items[0].id,id(i));});
 const reads=await phase('read',i=>request('GET','/v1/sops/'+id(i),auth[i]));reads.forEach((r,i)=>{assert.equal(r.status,200);assert.equal(r.data.id,id(i));assert.equal(r.data.revision,1);});
 const listed=await phase('paged-list',i=>request('GET','/v1/sops?limit=50',auth[i]));listed.forEach(r=>{assert.equal(r.status,200);assert.equal(r.data.items.length,50);assert.ok(r.data.nextCursor);assert.equal(r.data.items[0].guide,undefined);});
 const midpoint=Math.floor(count/2),deepCursor=Buffer.from(JSON.stringify([1700000000000+midpoint,id(midpoint)])).toString('base64url');
 const deep=await phase('deep-paged-list',i=>request('GET','/v1/sops?limit=50&cursor='+deepCursor,auth[i]));deep.forEach(r=>{assert.equal(r.status,200);assert.equal(r.data.items[0].id,id(midpoint-1));});
 const searches=await phase('selective-search',i=>request('GET','/v1/sops?query='+String(i).padStart(6,'0')+'&limit=20',auth[i]));searches.forEach((r,i)=>{assert.equal(r.status,200);assert.equal(r.data.items[0].id,id(i));});
 const broad=await phase('broad-chinese-search',i=>request('GET','/v1/sops?query='+encodeURIComponent('采购')+'&limit=20',auth[i]));broad.forEach(r=>{assert.equal(r.status,200);assert.equal(r.data.items.length,20);});
 const race=await phase('contested-lock',i=>request('POST','/v1/sops/'+id(0)+'/lock',auth[i],{}));assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===409).length,clients-1);
 const winner=race.findIndex(r=>r.status===200),lease=race[winner].data;assert.equal((await request('DELETE','/v1/sops/'+id(0)+'/lock',auth[winner],{token:lease.token,fence:lease.fence})).status,200);
 const leases=await phase('independent-locks',i=>request('POST','/v1/sops/'+id(i)+'/lock',auth[i],{}));leases.forEach(r=>assert.equal(r.status,200));
 const published=await phase('publish',i=>request('PUT','/v1/sops/'+id(i),auth[i],{guide:{...guide(i),version:'2'},token:leases[i].data.token,fence:leases[i].data.fence,expectedRevision:1},'scale-publish-'+i));published.forEach(r=>{assert.equal(r.status,200);assert.equal(r.data.revision,2);});
 const repeated=await request('PUT','/v1/sops/'+id(0),auth[0],{guide:{...guide(0),version:'2'},token:leases[0].data.token,fence:leases[0].data.fence,expectedRevision:1},'scale-publish-0');assert.equal(repeated.status,200);assert.equal(repeated.data.revision,2);
 const sustainedStart=performance.now(),samples=[];await Promise.all(auth.map(async(token,i)=>{for(let round=0;round<20;round++){const start=performance.now(),r=await request('GET','/v1/sops/'+id(i),token);assert.equal(r.status,200);assert.equal(r.data.revision,2);samples.push(performance.now()-start);}}));samples.sort((a,b)=>a-b);report.sustained={requests:samples.length,requestsPerActor:20,durationMs:performance.now()-sustainedStart,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1)};console.log(JSON.stringify({sustained:report.sustained}));
 report.server=await message('stats',{type:'stats'});if(agents.length===clients)assert.ok(report.server.peakConnections>=clients,'Expected 500 independent live connections');report.unexpectedFailures=0;
 const slow=report.phases.filter(p=>['indexed-match','read','selective-search','broad-chinese-search'].includes(p.name)&&p.p95Ms>1000);report.initialLatencyTargetMet=slow.length===0;report.requiresOptimization=slow.map(p=>p.name);
 const target=path.resolve(arg('out')||path.join(__dirname,'../../dist/team-scale-report.json'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log('Report: '+target);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{for(const agent of agents)agent.destroy();if(child&&child.connected){child.send({type:'stop'});await once(child,'exit');}fs.rmSync(directory,{recursive:true,force:true});});
