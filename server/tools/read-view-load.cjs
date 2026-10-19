'use strict';
// Compare complete reads with a text view followed by ONE selected image.
// Separate fixture processes keep peak-memory observations independent.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {fork}=require('node:child_process'),{once}=require('node:events'),{Readable,Transform}=require('node:stream');
const {webcrypto}=require('node:crypto'),assert=require('node:assert/strict');
const TeamClient=require('../../extension/team-client.js');
const option=name=>{const at=process.argv.indexOf('--'+name);return at<0?undefined:process.argv[at+1];};
const clients=Number(option('clients')||75);
if(!Number.isSafeInteger(clients)||clients<1||clients>500)throw Error('Use 1..500 clients');
const output=path.resolve(option('out')||'dist/team-read-view-load.json');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-read-view-load-'));
function ipc(child,type){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(Error('Fixture IPC deadline exceeded')),30000);const listener=value=>{if(value[type])finish(null,value);};const exited=()=>finish(Error('Fixture exited before reply'));function finish(error,value){clearTimeout(timer);child.off('message',listener);child.off('exit',exited);error?reject(error):resolve(value);}child.on('message',listener);child.once('exit',exited);});}
async function run(mode){
 const agents=Array.from({length:clients},()=>new http.Agent({keepAlive:true,maxSockets:1,maxFreeSockets:1}));
 const child=fork(path.join(__dirname,'fixture-real-large-read.cjs'),[],{env:{...process.env,SOP_LARGE_READ_DB:path.join(directory,mode+'.sqlite')},execArgv:['--max-old-space-size=256'],stdio:['ignore','inherit','inherit','ipc']});
 let wireBytes=0,requests=0,imageRequests=0,statuses={};
 try{
  const ready=await ipc(child,'ready'),endpoint='http://127.0.0.1:'+ready.port;
  function fetcher(index){return (url,opts={})=>new Promise((resolve,reject)=>{
   const u=new URL(url);const req=http.request({hostname:u.hostname,port:u.port,path:u.pathname+u.search,method:opts.method,headers:opts.headers,signal:opts.signal,agent:agents[index]},res=>{
    statuses[res.statusCode]=(statuses[res.statusCode]||0)+1;
    const counted=new Transform({transform(chunk,encoding,callback){wireBytes+=chunk.length;callback(null,chunk);}});
    res.once('error',error=>counted.destroy(error));counted.once('close',()=>{if(!res.complete)res.destroy();});res.pipe(counted);
    resolve(new Response(Readable.toWeb(counted),{status:res.statusCode,headers:res.headers}));
   });requests++;if(u.pathname.includes('/images/'))imageRequests++;req.once('error',reject);req.end(opts.body);
  });}
  for(let start=0;start<clients;start+=32)await Promise.all(Array.from({length:Math.min(32,clients-start)},async(_,offset)=>{const response=await fetcher(start+offset)(endpoint+'/health');assert.equal(response.status,200);await response.text();}));
  const apis=await Promise.all(agents.map(async(_,index)=>{const config={endpoint,crypto:webcrypto,fetch:fetcher(index),cacheLimit:0,maxCacheBytes:0};const session=await TeamClient.create(config).join('synthetic-large-read-join-code','Synthetic reader '+index);return TeamClient.create({...config,token:session.token});}));
  assert.ok((await apis[0].capabilities()).features.includes('read-view-images'));
  const initial=ipc(child,'stats');child.send({type:'stats'});const baseline=await initial;
  wireBytes=0;requests=0;imageRequests=0;statuses={};const times=[],started=performance.now();
  const results=await Promise.all(apis.map(async(api,index)=>{
   try{
    if(mode==='full'){const data=await api.read('heavy-sample');assert.equal(data.guide.steps.length,12);}
    else {const view=await api.readView('heavy-sample');assert.equal(view.images.length,12);assert.equal(view.guide.steps.some(step=>step.image!==undefined),false);return {api,view,index};}
    times.push(performance.now()-started);return true;
   }catch(error){return {failure:error.code||error.message};}
  }));
  const textStage={elapsedMs:performance.now()-started,wireBytes,requests,imageRequests,statuses:{...statuses}};
  if(mode==='view'){
   assert.equal(imageRequests,0,'Text views must not request image bytes');
   for(const result of results)assert.ok(!result.failure,result.failure);
   await Promise.all(results.map(async({api,view,index})=>{const ref=view.images[index%view.images.length],image=await api.readImage('heavy-sample',ref,{revision:view.revision});assert.equal(image.sha256,ref.sha256);times.push(performance.now()-started);}));
  }else for(const result of results)assert.equal(result,true,result.failure);
  times.sort((a,b)=>a-b);const snapshot=ipc(child,'stats');child.send({type:'stats'});
  return {mode,clients,completed:times.length,guideBytes:ready.guideBytes,selectedImagesPerReader:mode==='view'?1:12,textStage:mode==='view'?textStage:undefined,elapsedMs:performance.now()-started,p95Ms:times[Math.floor(times.length*.95)],wireBytes,requests,imageRequests,statuses,baseline,server:await snapshot};
 }finally{
  agents.forEach(agent=>agent.destroy());if(child.connected){const exit=once(child,'exit');child.send({type:'stop'});await exit;}else if(child.exitCode===null){child.kill();await once(child,'exit');}
 }
}
(async()=>{
 const full=await run('full'),view=await run('view');
 const report={kind:'actual-client-full-vs-text-plus-one-image',recordedAt:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,clients,phases:[full,view],payloadReduction:1-view.wireBytes/full.wireBytes,limitations:['75-client loopback default; warmed independent sockets and temporary synthetic SQLite databases, not physical LAN or older hardware.','The view phase retrieves text plus one image per reader, whereas complete reads include all twelve images. It is not an all-images speed comparison.','View generation still reconstructs and verifies the whole guide on the server; no reduced server reconstruction-cost claim.','Actual SDK under Node streams, no browser rendering or image decoding. The UI does not yet select these new methods.','Peak memory is sampled per separate fixture process; it is an observation, not a universal upper bound.']};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 assert.equal(full.completed,clients);assert.equal(view.completed,clients);assert.ok(view.wireBytes<full.wireBytes,'Selected-image reading should transfer fewer bytes for this fixture');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(directory,{recursive:true,force:true}));
