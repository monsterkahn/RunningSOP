'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto;
const client = require('../extension/team-client.js');
const guide = {format:'runtime-sop-guide',schemaVersion:1,workflowId:'sample',title:'Synthetic',version:'1',notice:'',steps:[{id:'first',title:'',where:'Test',actions:['Synthetic action'],expected:'',trouble:'',acceptance:[]}]};
async function record() { return {id:'sample',revision:1,guide,sha256:Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(guide)))).toString('hex')}; }
function response(data,status=200) {return new Response(JSON.stringify(status===200?{data}:{error:data}),{status,headers:{'Content-Type':'application/json'}});}
function make(fetch,extra={}) {return client.create({endpoint:'http://localhost:8765/proxy',token:'synthetic-token',crypto,fetch,...extra});}
test('endpoint validation blocks normalization escapes and credential/query leakage',()=>{
 for(const value of ['https://u:p@example.test','https://example.test/?secret=x','https://example.test/#x','https://example.test/a/../b','https://example.test/%2e%2e/a','https://example.test/%252e%252e/a','https://example.test/\\x','file:///tmp']) assert.throws(()=>client.validateEndpoint(value));
 assert.equal(client.validateEndpoint('http://localhost:8765/proxy/'),'http://localhost:8765/proxy');
 assert.throws(()=>client.sanitizeWorkURL('https://u:p@example.test/order?q=secret#x'));
 assert.equal(client.sanitizeWorkURL('file:///tmp/synthetic.html?q=secret#x'),'file:///tmp/synthetic.html?q=secret#x');
});
test('construction is inert; requests stay in base path without credentials and sessions are anonymous',async()=>{
 const calls=[]; const api=make(async(url,opts)=>{calls.push({url,opts});return response({protocolVersion:1,minClientProtocol:1,maxClientProtocol:1});});
 assert.equal(calls.length,0);await api.capabilities();
 assert.equal(calls[0].url,'http://localhost:8765/proxy/v1/capabilities');assert.equal(calls[0].opts.credentials,'omit');assert.equal(calls[0].opts.redirect,'error');assert.equal(calls[0].opts.headers.Authorization,undefined);
});
test('read validates guide identity/hash and falls back only explicitly on network failure',async()=>{
 const data=await record();let mode='good';const api=make(async()=>{if(mode==='network')throw Error('synthetic-token');if(mode==='unauthorized')return response({code:'unauthorized',message:'synthetic-token'},401);return response(mode==='corrupt'?{...data,sha256:'0'.repeat(64)}:data);});
 await api.getSop('sample',{retry:false});mode='network';await assert.rejects(api.getSop('sample',{retry:false}),{code:'network_error'});assert.equal((await api.getSop('sample',{allowStale:true,retry:false})).cache.stale,true);
 mode='corrupt';await assert.rejects(api.getSop('sample',{allowStale:true,retry:false}),{code:'integrity_error'});mode='unauthorized';await assert.rejects(api.getSop('sample',{allowStale:true,retry:false}),{code:'unauthorized'});mode='network';await assert.rejects(api.getSop('sample',{allowStale:true,retry:false}),{code:'network_error'});
});
test('wrong SOP/revision and invalid content are rejected',async()=>{
 const data=await record(); await assert.rejects(make(async()=>response({...data,id:'other'})).read('sample'),{code:'integrity_error'});
 await assert.rejects(make(async()=>response(data)).read('sample',{revision:2}),{code:'integrity_error'});
 await assert.rejects(make(async()=>new Response('<script>secret</script>')).read('sample'),{code:'invalid_content_type'});
});
test('real abort timer cancels request and forwards explicit cancellation',async()=>{
 const fetch=async(_,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
 await assert.rejects(make(fetch,{timeoutMs:5}).capabilities(),{code:'timeout'});
 const controller=new AbortController(); const pending=make(fetch).capabilities({signal:controller.signal});controller.abort();await assert.rejects(pending,{code:'aborted'});
});
test('writes never retry automatically; manual retry reuses explicit key and draft survives stale lease',async()=>{
 let calls=0;let firstKey;const data=await record();const api=make(async(_,opts)=>{calls++;if(calls===1){firstKey=opts.headers['Idempotency-Key'];throw Error('lost response');}assert.equal(opts.headers['Idempotency-Key'],firstKey);return response(data);});
 let saved;try{await api.create(guide);}catch(e){saved=e.idempotencyKey;assert.equal(e.code,'network_error');assert.ok(!e.message.includes('synthetic-token'));}assert.equal(calls,1);await api.create(guide,{idempotencyKey:saved});assert.equal(calls,2);
 const draft=JSON.stringify(guide);const failed=make(async()=>response({code:'stale_lease',message:'private'},409));await assert.rejects(failed.publish('sample',guide,{lease:{token:'test',fence:1},expectedRevision:1}),{code:'stale_lease'});assert.equal(JSON.stringify(guide),draft);
});
test('metadata strips remote resources and match URLs contain no secrets',async()=>{
 const api=make(async(_,opts)=>{assert.deepEqual(JSON.parse(opts.body),{url:'https://example.test/path'});return response({state:'matched',items:[{id:'sample',revision:1,title:'Synthetic',sha256:'a'.repeat(64),script:'https://bad.test/x',url:'https://bad.test/'}]});});
 const result=await api.matches('https://example.test/path?token=secret#private');assert.equal(result.items[0].url,undefined);assert.equal(result.items[0].script,undefined);
});
test('stream size is bounded and corrupt envelopes never become cached reads',async()=>{
 const huge=make(async()=>new Response(new Uint8Array(4*1024*1024+65537),{headers:{'Content-Type':'application/json'}}));await assert.rejects(huge.read('sample'),{code:'response_too_large'});
 const malformed=make(async()=>new Response('{"other":{}}',{headers:{'Content-Type':'application/json'}}));await assert.rejects(malformed.read('sample'),{code:'invalid_envelope'});
});
test('publish and lease operations use exact protocol routes and preserve payload fences',async()=>{
 const calls=[];const data={...await record(),revision:2};const api=make(async(url,opts)=>{calls.push({url,opts,body:JSON.parse(opts.body)});return response(opts.method==='PUT'?data:{token:'lease',fence:2,expiresAt:12345,baseRevision:1,owner:{id:'actor',name:'Synthetic'}});});
 const lease={token:'synthetic-lease',fence:2};await api.renewLock('sample',lease);await api.releaseLock('sample',lease);await api.publish('sample',guide,{lease,expectedRevision:1,idempotencyKey:'synthetic-write'});
 assert.equal(calls[0].opts.method,'PATCH');assert.deepEqual(calls[0].body,lease);assert.equal(calls[1].opts.method,'DELETE');assert.equal(calls[2].url,'http://localhost:8765/proxy/v1/sops/sample');assert.equal(calls[2].opts.method,'PUT');assert.equal(calls[2].body.fence,2);assert.equal(calls[2].body.expectedRevision,1);
});
test('metadata requires hashes and consistent match state while retaining numeric timestamps',async()=>{
 const item={id:'sample',revision:1,title:'Synthetic',sha256:'a'.repeat(64),updatedAt:12345};
 for(const data of [{state:'matched',items:[]},{state:'none',items:[item]},{state:'ambiguous',items:[item]},{state:'unknown',items:[]},{state:'matched',items:[{...item,sha256:'bad'}]}]) await assert.rejects(make(async()=>response(data)).matches('https://example.test/'),{code:'invalid_metadata'});
 const result=await make(async()=>response({state:'matched',items:[item]})).matches('https://example.test/');assert.equal(result.items[0].updatedAt,12345);
 await assert.rejects(make(async()=>response({items:[]})).list({limit:101}),{code:'invalid_limit'});
});
test('verified read cache obeys byte budget and rejects invalid byte configuration',async()=>{
 const data=await record();let offline=false;const api=make(async()=>{if(offline)throw Error('offline');return response(data);},{maxCacheBytes:1});await api.read('sample');offline=true;await assert.rejects(api.read('sample',{allowStale:true}),{code:'network_error'});
 for(const maxCacheBytes of [-1,0.5,NaN,Infinity,33*1024*1024]) assert.throws(()=>make(async()=>response(data),{maxCacheBytes}),{code:'invalid_cache_limit'});
 const cached=make(async()=>response(data));const read=await cached.read('sample');read.guide.title='Changed';assert.equal((await cached.read('sample')).guide.title,'Synthetic');
});
test('busy reads retry with a finite policy while writes never retry',async()=>{
 let reads=0;const data=await record(),api=make(async()=>++reads===1?response({code:'BUSY'},503):response(data));
 assert.equal((await api.read('sample')).revision,1);assert.equal(reads,2);
 let writes=0;await assert.rejects(make(async()=>{writes++;return response({code:'BUSY'},503);}).create(guide),{status:503});assert.equal(writes,1);
 let disabled=0;await assert.rejects(make(async()=>{disabled++;return response({code:'BUSY'},503);}).read('sample',{retry:false}),{status:503});assert.equal(disabled,1);
});
test('cancelling a busy read during backoff prevents another request',async()=>{
 const controller=new AbortController();let calls=0;
 const api=make(async()=>{calls++;setTimeout(()=>controller.abort(),10);return response({code:'BUSY'},503);});
 await assert.rejects(api.read('sample',{signal:controller.signal}),{code:'aborted'});assert.equal(calls,1);
});

test('transient connection loss retries a read without changing the requested SOP',async()=>{let calls=0;const data=await record(),api=make(async url=>{assert.equal(url,'http://localhost:8765/proxy/v1/sops/sample');if(++calls===1)throw Error('connection reset');return response(data);});assert.equal((await api.read('sample')).revision,1);assert.equal(calls,2);});
test('category calls validate metadata and preserve optimistic revisions and write keys',async()=>{
 const calls=[],category={id:'business',name:'Business',parentId:null,color:'blue',icon:'briefcase',revision:2};
 const api=make(async(url,options)=>{calls.push({url,options});if(options.method==='GET')return response({items:[{...category,script:'https://bad.test/code.js'}],nextCursor:''});if(url.endsWith('/category'))return response({id:'sample',categoryId:'business',categoryRevision:3});return response(category);});
 const page=await api.categories({limit:100});assert.equal(page.items[0].script,undefined);assert.equal(page.items[0].revision,2);
 await api.updateCategory('business',category,{expectedRevision:1});const update=calls.at(-1);assert.equal(update.options.method,'PUT');assert.equal(JSON.parse(update.options.body).expectedRevision,1);assert.ok(update.options.headers['Idempotency-Key']);
 await api.assignCategory('sample','business',{expectedCategoryRevision:2});assert.equal(JSON.parse(calls.at(-1).options.body).expectedCategoryRevision,2);
 await assert.rejects(api.categories({limit:101}),{code:'invalid_limit'});await assert.rejects(api.assignCategory('sample','business',{expectedCategoryRevision:-1}),{code:'invalid_revision'});
 await assert.rejects(make(async()=>response({items:[{...category,color:'url(https://bad.test)'}],nextCursor:''})).categories(),{code:'invalid_category'});
});

const shaText = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
function readViewFixture() {
 const image='data:image/jpeg;base64,/9j/AB==';
 const body=JSON.parse(JSON.stringify(guide));
 body.steps[0].issues=[{id:'issue-one',title:'Issue',actions:['Review'],next:'Continue'}];
 const images=[{step:0,sha256:shaText(image),imageAt:'2026-01-01T00:00:00Z',imageMarks:[{type:'number',x:.2,y:.3}]},{step:0,issue:0,sha256:shaText(image)}];
 const full=JSON.parse(JSON.stringify(body));full.steps[0].image=image;
 const data={id:'sample',revision:3,sha256:shaText(JSON.stringify(full)),guide:body,images};
 data.viewSha256=shaText(JSON.stringify({guide:data.guide,images:data.images}));return {data,image};
}
test('read-only view fetches metadata alone and images require explicit revision and exact descriptor',async()=>{
 const {data,image}=readViewFixture(),calls=[];
 const api=make(async(url,opts)=>{calls.push({url,opts});if(url.includes('/view'))return response(data);return response({id:'sample',revision:3,step:0,issue:0,sha256:shaText(image),image});});
 const view=await api.readView('sample',{revision:3});assert.equal(calls.length,1);assert.equal(view.guide.steps[0].image,undefined);assert.deepEqual(view.images,data.images);assert.equal(calls[0].url,'http://localhost:8765/proxy/v1/sops/sample/view?revision=3');
 assert.equal((await api.readImage('sample',view.images[1],{revision:view.revision})).image,image);
 assert.equal(calls[1].url,'http://localhost:8765/proxy/v1/sops/sample/images/0/issues/0?revision=3');assert.equal(calls[1].opts.headers.Authorization,'Bearer synthetic-token');
 await assert.rejects(api.readImage('sample',view.images[0]),{code:'invalid_revision'});
 await assert.rejects(api.readImage('sample',{...view.images[0],url:'https://bad.test/image'},{revision:3}),{code:'invalid_image_reference'});assert.equal(calls.length,2);
});
test('read view rejects corrupt manifests, inline bytes, duplicate slots and invalid annotations',async()=>{
 const {data,image}=readViewFixture();
 const malformed=[{...data,viewSha256:'0'.repeat(64)},{...data,revision:4},{...data,images:[data.images[0],data.images[0]]},{...data,images:[{...data.images[0],step:100}]},{...data,images:[{...data.images[0],imageMarks:[{type:'number',x:2,y:0}]}]}];
 for(const value of malformed)await assert.rejects(make(async()=>response(value)).readView('sample',{revision:3}));
 const inline=JSON.parse(JSON.stringify(data));inline.guide.steps[0].image=image;inline.viewSha256=shaText(JSON.stringify({guide:inline.guide,images:inline.images}));await assert.rejects(make(async()=>response(inline)).readView('sample'));
});
test('individual image verifies bytes against manifest, blocks revision swaps and executable resources',async()=>{
 const {data,image}=readViewFixture(),ref=data.images[0],good={id:'sample',revision:3,step:0,sha256:ref.sha256,image};
 const other='data:image/jpeg;base64,/9j/AA==';
 for(const value of [{...good,revision:4},{...good,step:1},{...good,image:other},{...good,image:other,sha256:shaText(other)},{...good,image:'https://bad.test/a.js'}])await assert.rejects(make(async()=>response(value)).readImage('sample',ref,{revision:3}));
 const result=await make(async()=>response(good)).readImage('sample',ref,{revision:3});assert.equal(result.image,image);
});
test('partial views never populate the complete-guide offline cache and old servers fail explicitly',async()=>{
 const {data}=readViewFixture();let offline=false;
 const api=make(async()=>{if(offline)throw Error('offline');return response(data);});await api.readView('sample');offline=true;await assert.rejects(api.read('sample',{allowStale:true,retry:false}),{code:'network_error'});
 let count=0;await assert.rejects(make(async()=>{count++;return response({code:'NOT_FOUND'},404);}).readView('sample'),{code:'NOT_FOUND'});assert.equal(count,1);
});

// Real HTTP streams exercise fetch abort behavior rather than a fetch stub that
// may ignore AbortSignal. The deadlines are scaled; browser tests use defaults.
async function streamingFixture(run){
 const http=require('node:http');let handler,requests=0;const timers=new Set();
 const server=http.createServer((req,res)=>{requests++;handler(req,res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const setHandler=fn=>{handler=fn;};
 const stream=(res,value,{status=200,interval=25,parts=10,neverEnd=false}={})=>{
  res.writeHead(status,{'Content-Type':'application/json'});res.flushHeaders();const bytes=Buffer.from(value);let offset=0;
  const timer=setInterval(()=>{if(neverEnd){res.write(' ');return;}const end=Math.min(bytes.length,offset+Math.ceil(bytes.length/parts));res.write(bytes.subarray(offset,end));offset=end;if(offset===bytes.length){clearInterval(timer);timers.delete(timer);res.end();}},interval);timers.add(timer);res.on('close',()=>{clearInterval(timer);timers.delete(timer);});
 };
 const api=extra=>client.create({endpoint:'http://127.0.0.1:'+server.address().port,token:'synthetic-token',crypto,timeoutMs:100,fullReadTimeoutMs:1500,...extra});
 let guard;try{await Promise.race([run({setHandler,stream,api,requests:()=>requests}),new Promise((_,reject)=>{guard=setTimeout(()=>reject(Error('Synthetic stream fixture exceeded its five-second budget')),5000);})]);}
 finally{clearTimeout(guard);for(const timer of timers)clearInterval(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('complete authenticated read tolerates continued progress beyond its idle deadline and verifies all bytes',()=>streamingFixture(async({setHandler,stream,api})=>{
 const data=await record();setHandler((req,res)=>stream(res,JSON.stringify({data})));
 const started=performance.now(),result=await api().getSop('sample',{retry:false});
 assert.ok(performance.now()-started>200);assert.deepEqual(result.guide,guide);assert.equal(result.sha256,data.sha256);assert.equal(result.cache.stale,false);
}));
test('complete read stops on stalled headers or body and does not populate offline cache',()=>streamingFixture(async({setHandler,api,requests})=>{
 for(const headers of [false,true]){
  setHandler((req,res)=>{if(headers){res.writeHead(200,{'Content-Type':'application/json'});res.write('{"data":');}});
  const reader=api();await assert.rejects(reader.getSop('sample'),{code:'timeout'});
 }
 assert.equal(requests(),2,'Timeouts never automatically retry');
}));
test('complete read has an absolute cap even while response bytes keep arriving',()=>streamingFixture(async({setHandler,stream,api,requests})=>{
 setHandler((req,res)=>stream(res,'',{neverEnd:true}));const started=performance.now();
 await assert.rejects(api({fullReadTimeoutMs:220}).getSop('sample',{retry:false}),{code:'timeout'});
 assert.ok(performance.now()-started>=150);assert.ok(performance.now()-started<1500);assert.equal(requests(),1);
}));
test('explicit cancellation during a progressing complete body stops before caching',()=>streamingFixture(async({setHandler,stream,api})=>{
 const data=await record();let started;const responseStarted=new Promise(resolve=>{started=resolve;});
 setHandler((req,res)=>{stream(res,JSON.stringify({data}));started();});
 const controller=new AbortController(),reader=api(),pending=reader.getSop('sample',{retry:false,signal:controller.signal});await responseStarted;controller.abort();await assert.rejects(pending,{code:'aborted'});
 setHandler((req,res)=>res.destroy());await assert.rejects(reader.getSop('sample',{retry:false,allowStale:true}),{code:'network_error'});
}));
test('progress extension never bypasses the complete guide hash',()=>streamingFixture(async({setHandler,stream,api})=>{
 const data={...await record(),sha256:'0'.repeat(64)};setHandler((req,res)=>stream(res,JSON.stringify({data})));
 const reader=api();await assert.rejects(reader.getSop('sample',{retry:false}),{code:'integrity_error'});
 setHandler((req,res)=>res.destroy());await assert.rejects(reader.getSop('sample',{retry:false,allowStale:true}),{code:'network_error'});
}));
test('metadata, anonymous reads, errors and mutation bodies retain their original total deadline',()=>streamingFixture(async({setHandler,stream,api,requests})=>{
 const data=await record();
 for(const kind of ['capabilities','metadata','anonymous','error','write']){
  setHandler((req,res)=>stream(res,JSON.stringify(kind==='error'?{error:{code:'unauthorized'}}:{data}),{status:kind==='error'?401:200}));
  const reader=api(kind==='anonymous'?{token:''}:{}),before=requests();
  const call=kind==='capabilities'?reader.capabilities():kind==='metadata'?reader.list():kind==='write'?reader.create(guide):reader.getSop('sample',{retry:false});
  await assert.rejects(call,{code:'timeout'});assert.equal(requests(),before+1);
 }
}));
test('full read deadline settings remain bounded and constructing a client stays inert',()=>{
 for(const fullReadTimeoutMs of [0,-1,NaN,Infinity,120001,'120000'])assert.throws(()=>make(()=>{throw Error('Unexpected network');},{fullReadTimeoutMs}),{code:'invalid_timeout'});
});

test('cancellation during full-guide hashing never caches the completed network body',async()=>{
 const data=await record(),controller=new AbortController();let hashing,release;const started=new Promise(resolve=>{hashing=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 let offline=false;
 const reader=make(async()=>{if(offline)throw Error('offline');return response(data);},{crypto:{randomUUID:()=>crypto.randomUUID(),subtle:{digest:async(...args)=>{hashing();await gate;return crypto.subtle.digest(...args);}}}});
 const pending=reader.getSop('sample',{signal:controller.signal,retry:false});await started;controller.abort();release();await assert.rejects(pending,{code:'aborted'});
 offline=true;await assert.rejects(reader.getSop('sample',{allowStale:true,retry:false}),{code:'network_error'});
});

function largeCanonicalRecord(){
 const large={...guide,steps:Array.from({length:3},(_,i)=>({...guide.steps[0],id:'large-'+i,image:'data:image/jpeg;base64,/9j/'+'A'.repeat(92000)}))};
 return {id:'sample',revision:1,guide:large,sha256:shaText(JSON.stringify(large))};
}
test('large canonical writes budget both transfer directions and verify a progressing full-guide echo',()=>streamingFixture(async({setHandler,stream,api,requests})=>{
 const data=largeCanonicalRecord();setHandler((req,res)=>{req.resume();req.on('end',()=>stream(res,JSON.stringify({data})));});
 const result=await api().create(data.guide);assert.deepEqual(result.guide,data.guide);assert.equal(result.sha256,data.sha256);assert.equal(requests(),1);
}));
test('large write hard deadline and explicit cancellation never automatically retry and retain the supplied key',()=>streamingFixture(async({setHandler,stream,api,requests})=>{
 const data=largeCanonicalRecord(),savedKey='synthetic-large-write-key';
 setHandler((req,res)=>{req.resume();req.on('end',()=>stream(res,'',{neverEnd:true}));});
 await assert.rejects(api({largeWriteTimeoutMs:220}).create(data.guide,{idempotencyKey:savedKey}),{code:'timeout',idempotencyKey:savedKey});assert.equal(requests(),1);
 let seen;const started=new Promise(resolve=>{seen=resolve;});setHandler((req,res)=>{req.resume();req.on('end',()=>{stream(res,JSON.stringify({data}));seen();});});
 const controller=new AbortController(),pending=api().create(data.guide,{idempotencyKey:savedKey,signal:controller.signal});await started;controller.abort();
 await assert.rejects(pending,{code:'aborted',idempotencyKey:savedKey});assert.equal(requests(),2);
}));
test('large guide timing cannot bypass canonical echo integrity or be configured without a hard bound',()=>streamingFixture(async({setHandler,stream,api})=>{
 const data=largeCanonicalRecord();setHandler((req,res)=>{req.resume();req.on('end',()=>stream(res,JSON.stringify({data:{...data,sha256:'0'.repeat(64)}})));});
 await assert.rejects(api().create(data.guide),{code:'integrity_error'});
 for(const largeWriteTimeoutMs of [0,-1,NaN,Infinity,180001,'180000'])assert.throws(()=>api({largeWriteTimeoutMs}),{code:'invalid_timeout'});
}));

test('cancellation during a canonical write hash retains its original replay key',async()=>{
 const data=await record(),controller=new AbortController();let signalHash,release;const started=new Promise(resolve=>{signalHash=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const reader=make(async()=>response(data),{crypto:{randomUUID:()=>crypto.randomUUID(),subtle:{digest:async(...args)=>{signalHash();await gate;return crypto.subtle.digest(...args);}}}});
 const pending=reader.create(guide,{signal:controller.signal,idempotencyKey:'synthetic-hash-key'});await started;controller.abort();release();await assert.rejects(pending,{code:'aborted',idempotencyKey:'synthetic-hash-key'});
});
test('large write errors retain a short body deadline despite arriving response bytes',()=>streamingFixture(async({setHandler,stream,api})=>{
 const data=largeCanonicalRecord();setHandler((req,res)=>{req.resume();req.on('end',()=>stream(res,JSON.stringify({error:{code:'unauthorized'}}),{status:401}));});
 await assert.rejects(api().create(data.guide),{code:'timeout'});
}));
