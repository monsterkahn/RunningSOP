'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTeamServer } = require('../app.cjs');
const JOIN = 'synthetic-join-code-for-tests';

async function fixture(t, options = {}) {
  const actor = { id: 'device-a', name: 'Synthetic device' };
  const store = {
    createSession: ({ displayName }) => ({ token: 'synthetic_session_token_123', actor: { ...actor, name: displayName }, expiresAt: 999999 }),
    authenticate: token => { if (token !== 'synthetic_session_token_123') throw Object.assign(new Error('Invalid session.'), { status: 401, code: 'UNAUTHORIZED' }); return actor; },
    list: () => ({ items: [], nextCursor: null }),
    create: (guide, args) => ({ guide, actor: args.actor, key: args.idempotencyKey }),
    acquireLock: (id, args) => ({ id, owner: args.actor, token: 'lease-token', fence: 1 }),
    renewLock: (_id, args) => args,
    releaseLock: () => ({ released: true }),
    ...options.store
  };
  const server = createTeamServer({ joinCode: JOIN, ...options, store: options.store && options.store.constructor !== Object ? options.store : store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, { method = 'GET', data, headers = {}, authenticated = true } = {}) => {
    const response = await fetch(base + route, { method, headers: { 'X-Running-SOP-Protocol': '1', ...(authenticated ? { Authorization: 'Bearer synthetic_session_token_123' } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
  };
  return { request, base, server };
}

test('HTTP discovery, explicit protocol, joining and authentication boundaries', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('/health', { authenticated: false })).status, 200);
  assert.equal((await request('/v1/capabilities', { authenticated: false })).body.data.protocolVersion, 1);
  assert.equal((await request('/v1/sops', { authenticated: false })).status, 401);
  assert.equal((await request('/v1/sops', { headers: { 'X-Running-SOP-Protocol': '2' } })).status, 426);
  assert.equal((await request('/v1/sessions', { method: 'POST', data: { joinCode: 'wrong' } })).status, 401);
  const joined = await request('/v1/sessions', { method: 'POST', authenticated: false, data: { joinCode: JOIN, displayName: 'Synthetic' } });
  assert.equal(joined.status, 201); assert.equal(joined.body.data.actor.name, 'Synthetic');
  assert.equal((await request('/v1/sops', { headers: { Authorization: 'Bearer spoofed_session_token' } })).status, 401);
});

test('HTTP restricts origin, body, paths and metadata pagination', async t => {
  const origin = `chrome-extension://${'a'.repeat(32)}`;
  const { request, base } = await fixture(t, { allowOrigins: [origin], maxBodyBytes: 100 });
  assert.equal((await request('/health', { headers: { Origin: 'https://foreign.example' } })).status, 403);
  assert.equal((await request('/health', { headers: { Origin: origin } })).headers.get('access-control-allow-origin'), origin);
  assert.equal((await request('/health')).headers.get('access-control-allow-origin'), null);
  assert.equal((await request('/v1/sops?limit=101')).status, 400);
  assert.equal((await request('/v1/sops/%61')).status, 400);
  assert.equal((await request('/v1/sops', { method: 'POST', data: { guide: 'x'.repeat(120) } })).status, 413);
  const malformed = await fetch(base + '/v1/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Running-SOP-Protocol': '1' }, body: '{' });
  assert.equal(malformed.status, 400);
});

test('HTTP binds actor to bearer session and forwards lease/idempotency fields', async t => {
  const { request } = await fixture(t);
  const result = await request('/v1/sops', { method: 'POST', headers: { 'Idempotency-Key': 'synthetic-key' }, data: { guide: { id: 'synthetic' }, actor: { id: 'spoof' } } });
  assert.equal(result.body.data.actor.id, 'device-a'); assert.equal(result.body.data.key, 'synthetic-key');
  const lease = await request('/v1/sops/synthetic/lock', { method: 'POST' });
  assert.equal(lease.body.data.owner.id, 'device-a');
  const renewed = await request('/v1/sops/synthetic/lock', { method: 'PATCH', data: { token: 'lease-token', fence: 1, actor: { id: 'spoof' } } });
  assert.equal(renewed.body.data.actor.id, 'device-a'); assert.equal(renewed.body.data.fence, 1);
});

test('HTTP rate admission is bounded and unexpected failures are redacted', async t => {
  const limited = await fixture(t, { preAuthRateLimit: 1 });
  assert.equal((await limited.request('/health', { authenticated: false })).status, 200); assert.equal((await limited.request('/health', { authenticated: false })).status, 429);
  const broken = await fixture(t, { store: { list: () => { throw new Error('synthetic-secret-stack'); } } });
  const response = await broken.request('/v1/sops');
  assert.equal(response.status, 500); assert.equal(JSON.stringify(response.body).includes('synthetic-secret'), false);
});

test('real SQLite HTTP clients exclude concurrent editors and replay publication retries', async t => {
  const { TeamStore } = require('../store.cjs');
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-http-'));
  let time = 1000;
  const store = new TeamStore({ dbPath: path.join(directory, 'test.sqlite'), now: () => time, leaseMs: 100 });
  t.after(() => { store.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const { request } = await fixture(t, { store });
  const session = async name => (await request('/v1/sessions', { method: 'POST', authenticated: false, data: { joinCode: JOIN, displayName: name } })).body.data.token;
  const a = await session('Synthetic A'), b = await session('Synthetic B');
  const headers = token => ({ Authorization: `Bearer ${token}` });
  const guide = { format: 'runtime-sop-guide', schemaVersion: 1, workflowId: 'sample', title: 'Synthetic', version: '1', notice: '', steps: [{ id: 'step-1', title: '', where: 'Synthetic', actions: ['Click synthetic control'], expected: '', trouble: '', acceptance: [], workUrl: 'https://example.test/task' }] };
  const create = await request('/v1/sops', { method: 'POST', headers: { ...headers(a), 'Idempotency-Key': 'create-synthetic' }, data: { guide } });
  assert.equal(create.status, 201);
  const lease = (await request('/v1/sops/sample/lock', { method: 'POST', headers: headers(a) })).body.data;
  assert.equal(lease.serverTime, time); assert.equal(lease.leaseMs, 100);
  const lockedRead = await request('/v1/sops/sample', { headers: headers(b) });
  assert.equal(lockedRead.body.data.lock.owner.name, 'Synthetic A');
  assert.equal(lockedRead.body.data.lock.token, undefined);
  const competing = await Promise.all(Array.from({ length: 8 }, () => request('/v1/sops/sample/lock', { method: 'POST', headers: headers(b) })));
  assert.ok(competing.every(result => result.status === 409 || result.status === 423));
  const data = { guide: { ...guide, title: 'Updated synthetic' }, token: lease.token, fence: lease.fence, expectedRevision: 1 };
  assert.equal((await request('/v1/sops/sample', { method: 'PUT', headers: { ...headers(b), 'Idempotency-Key': 'publish-spoof' }, data })).status, 409);
  const publish = () => request('/v1/sops/sample', { method: 'PUT', headers: { ...headers(a), 'Idempotency-Key': 'publish-synthetic' }, data });
  const published = await publish(); assert.equal(published.status, 200); assert.equal(published.body.data.revision, 2);
  assert.deepEqual((await publish()).body, published.body);
  assert.equal((await request('/v1/sops/sample?revision=1', { headers: headers(b) })).body.data.guide.title, 'Synthetic');
  assert.equal((await request('/v1/sops/sample/history', { headers: headers(b) })).body.data.items.length, 2);
  const oldLease = (await request('/v1/sops/sample/lock', { method: 'POST', headers: headers(a) })).body.data;
  time += 101;
  const takeover = (await request('/v1/sops/sample/lock', { method: 'POST', headers: headers(b) })).body.data;
  assert.ok(takeover.fence > oldLease.fence);
  const stale = await request('/v1/sops/sample', { method: 'PUT', headers: { ...headers(a), 'Idempotency-Key': 'publish-stale' }, data: { guide, token: oldLease.token, fence: oldLease.fence, expectedRevision: 2 } });
  assert.equal(stale.status, 409);
});

test('CLI first launch uses private temporary configuration and graceful stop', async t => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const { spawn } = require('node:child_process');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const launch = async (useIpc=process.platform==='win32') => {
    const child = spawn(process.execPath, [path.join(__dirname, '../cli.cjs')], { env: { ...process.env, SOP_DATA_DIR: directory, DB_PATH: path.join(directory, 'test.sqlite'), JOIN_CODE: '', HOST: '127.0.0.1', PORT: '0', ALLOW_ORIGINS: '' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let output = '';
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI start timed out')); }, 5000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`CLI exited before listening (${code})`)); });
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('is listening')) { clearTimeout(timeout); resolve(); } });
    });
    await new Promise((resolve, reject) => { child.once('exit', code => code === 0 ? resolve() : reject(new Error('CLI shutdown failed'))); if(useIpc)child.send({type:'shutdown'});else child.kill('SIGTERM'); });
    return output;
  };
  assert.ok((await launch()).includes('First-launch join code:'));
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
  assert.ok(config.joinCode.length >= 16);
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(directory, 'config.json')).mode & 0o777, 0o600);
  assert.equal((await launch(true)).includes('First-launch join code:'), false);
});

test('500 actors behind one address can burst while actor rate limits recover', async t => {
  let time = 1000;
  const { request, base } = await fixture(t, { now: () => time, rateLimit: 1, preAuthRateLimit: 1, store: { authenticate: token => ({ id: token, name: 'Synthetic' }) } });
  const http = require('node:http'); const agent = new http.Agent({ keepAlive: true, maxSockets: 32 });
  t.after(() => agent.destroy());
  const results = await Promise.all(Array.from({ length: 500 }, (_, i) => new Promise((resolve, reject) => {
    const req = http.get(base + '/v1/sops', { agent, headers: { 'X-Running-SOP-Protocol': '1', Authorization: `Bearer synthetic_actor_${String(i).padStart(5, '0')}` } }, res => { res.resume(); res.once('end', () => resolve({ status: res.statusCode })); }); req.once('error', reject);
  })));
  assert.ok(results.every(result => result.status === 200));
  assert.equal((await request('/health', { authenticated: false })).status, 200);
  assert.equal((await request('/health', { authenticated: false })).status, 429);
  assert.equal((await request('/v1/sops', { headers: { Authorization: 'Bearer synthetic_actor_after_anonymous_limit' } })).status, 200);
  const headers = { Authorization: 'Bearer synthetic_actor_00000' };
  assert.equal((await request('/v1/sops', { headers })).status, 429);
  time += 60001;
  assert.equal((await request('/v1/sops', { headers })).status, 200);
});

test('buffer and concurrency admission release capacity after timeout and overload', async t => {
  const http = require('node:http');
  const { request, base } = await fixture(t, { maxBufferedBodyBytes: 64, requestTimeoutMs: 100, maxConcurrent: 2 });
  const hold = () => {
    let resolveResponse;
    const response = new Promise(resolve => { resolveResponse = resolve; });
    const req = http.request(base + '/v1/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Running-SOP-Protocol': '1' } }, res => { res.resume(); res.on('end', () => resolveResponse(res.statusCode)); });
    req.on('error', () => resolveResponse(0)); req.write('{"padding":"' + 'x'.repeat(36));
    return { req, response };
  };
  const first = hold();
  await new Promise(resolve => setTimeout(resolve, 20));
  const busy = await request('/v1/sessions', { method: 'POST', authenticated: false, data: { joinCode: JOIN, displayName: 'Synthetic' } });
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get('connection'), 'close');
  assert.equal(await first.response, 408);
  first.req.destroy();
  assert.equal((await request('/health')).status, 200);
  assert.equal((await request('/v1/sessions', { method: 'POST', data: { padding: 'x'.repeat(9000) } })).status, 413);
});

test('admission configuration rejects nonfinite and invalid bounds', () => {
  for (const option of ['maxConcurrent', 'maxBodyBytes', 'maxBufferedBodyBytes', 'maxConnections', 'rateLimit', 'preAuthRateLimit', 'rateWindowMs', 'requestTimeoutMs', 'maxBufferedResponseBytes', 'responseTimeoutMs']) {
    for (const value of [0, -1, NaN, Infinity, 1.5]) assert.throws(() => createTeamServer({ store: {}, joinCode: JOIN, [option]: value }), TypeError);
  }
});

test('concurrency overload returns 503 and recovers once the held request expires', async t => {
  const http = require('node:http');
  const { base, request } = await fixture(t, { maxConcurrent: 1, requestTimeoutMs: 100 });
  let resolveHeld;
  const done = new Promise(resolve => { resolveHeld = resolve; });
  const held = http.request(base + '/v1/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Running-SOP-Protocol': '1' } }, res => { res.resume(); res.once('end', () => resolveHeld(res.statusCode)); });
  held.on('error', () => resolveHeld(0)); held.write('{');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await request('/health')).status, 503);
  assert.equal(await done, 408); held.destroy();
  assert.equal((await request('/health')).status, 200);
});

test('normal lock contention consumes its envelope and preserves the connection', async t => {
  const http = require('node:http');
  const { base } = await fixture(t, { store: { acquireLock: () => { throw Object.assign(new Error('SOP is locked.'), { status: 409, code: 'locked' }); } } });
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 }); t.after(() => agent.destroy());
  const post = () => new Promise((resolve, reject) => {
    const req = http.request(base + '/v1/sops/sample/lock', { agent, method: 'POST', headers: { Authorization: 'Bearer synthetic_session_token_123', 'X-Running-SOP-Protocol': '1', 'Content-Type': 'application/json', 'Content-Length': '2' } }, res => { res.resume(); res.once('end', () => resolve({ status: res.statusCode, reused: req.reusedSocket, connection: res.headers.connection })); });
    req.once('error', reject); req.end('{}');
  });
  const first = await post(), second = await post();
  assert.equal(first.status, 409); assert.equal(first.connection, 'keep-alive');
  assert.equal(second.status, 409); assert.equal(second.reused, true);
});

// Hold response completion explicitly: kernel TCP buffers vary by OS and may
// accept the entire synthetic payload even after the reader pauses. The wire
// budget covers outstanding Node responses, not kernel memory.
test('slow large response reserves bytes, overloads explicitly, and releases on client close', async t => {
  const http = require('node:http'); const payload = 'x'.repeat(8 * 1024 * 1024);
  const { base, request,server } = await fixture(t, { maxBufferedResponseBytes: 9 * 1024 * 1024, store: { get: () => ({ guide: { image: payload } }), lockInfo: () => null } });
  server.prependListener('request',(req,res)=>{if(req.url==='/v1/sops/sample?hold=1'){res.end=function(){res.flushHeaders();return res;};}});
  const held = await new Promise((resolve, reject) => { const req = http.get(base + '/v1/sops/sample?hold=1', { headers: { Authorization: 'Bearer synthetic_session_token_123', 'X-Running-SOP-Protocol': '1' } }, res => { res.pause(); resolve({ req, res }); }); req.once('error', reject); });
  assert.equal(held.res.statusCode, 200);
  const overloaded = await request('/v1/sops/sample');
  assert.equal(overloaded.status, 503); assert.equal(overloaded.headers.get('retry-after'), '1');
  held.res.destroy(); held.req.destroy();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await request('/v1/sops/sample')).status, 200);
});

test('slow response deadline releases active admission without waiting for reader disconnect', async t => {
  const http = require('node:http');
  const { base, request,server } = await fixture(t, { maxConcurrent: 1, responseTimeoutMs: 300, store: { get: () => ({ guide: { image: 'x'.repeat(8 * 1024 * 1024) } }), lockInfo: () => null } });
  server.prependListener('request',(req,res)=>{if(req.url==='/v1/sops/sample?hold=1'){res.end=function(){res.flushHeaders();return res;};}});
  const held = await new Promise((resolve, reject) => { const req = http.get(base + '/v1/sops/sample?hold=1', { headers: { Authorization: 'Bearer synthetic_session_token_123', 'X-Running-SOP-Protocol': '1' } }, res => { res.pause(); res.on('error', () => {}); resolve({ req, res }); }); req.once('error', reject); });
  assert.equal((await request('/health')).status, 503);
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal((await request('/health')).status, 200);
  held.res.destroy(); held.req.destroy();
});

test('category HTTP routes preserve identity, reject stale moves and expose paged audit',async t=>{
 const {TeamStore}=require('../store.cjs'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sop-category-http-')),store=new TeamStore({dbPath:path.join(directory,'team.sqlite')});
 t.after(()=>{store.close();fs.rmSync(directory,{recursive:true,force:true});});
 const {request}=await fixture(t,{store});
 const token=(await request('/v1/sessions',{method:'POST',authenticated:false,data:{joinCode:JOIN,displayName:'Classifier'}})).body.data.token;
 const headers=key=>({Authorization:'Bearer '+token,...(key?{'Idempotency-Key':key}:{})});
 const category={id:'finance',name:'Finance',parentId:null,color:'blue',icon:'briefcase'};
 const created=await request('/v1/categories',{method:'POST',headers:headers('category-create'),data:{category}});assert.equal(created.status,201);
 const renamed=await request('/v1/categories/finance',{method:'PUT',headers:headers('category-rename'),data:{category:{...category,name:'Finance team'},expectedRevision:1}});assert.equal(renamed.body.data.revision,2);
 assert.equal((await request('/v1/categories/finance',{method:'PUT',headers:headers('category-stale'),data:{category,expectedRevision:1}})).status,409);
 assert.equal((await request('/v1/categories?limit=1&parentId=',{headers:headers()})).body.data.items[0].name,'Finance team');
 const actor=store.authenticate(token),guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'classified',title:'Synthetic',version:'1',notice:'',steps:[{id:'step-one',title:'',where:'Synthetic',actions:['Check'],expected:'',trouble:'',acceptance:[]}]};store.create(guide,{actor,idempotencyKey:'create-workflow'});
 const moved=await request('/v1/sops/classified/category',{method:'PUT',headers:headers('category-assign'),data:{categoryId:'finance',expectedCategoryRevision:0}});assert.equal(moved.status,200);assert.equal(moved.body.data.categoryRevision,1);
 assert.equal((await request('/v1/sops/classified/category',{method:'PUT',headers:headers('category-assign-stale'),data:{categoryId:null,expectedCategoryRevision:0}})).status,409);
 assert.equal((await request('/v1/categories/finance',{method:'DELETE',headers:headers('category-delete'),data:{expectedRevision:2}})).status,409);
 const list=await request('/v1/sops?category=finance',{headers:headers()});assert.equal(list.body.data.items[0].id,'classified');assert.equal(list.body.data.items[0].categoryId,'finance');
 const audit=await request('/v1/category-audit?workflowId=classified&limit=1',{headers:headers()});assert.equal(audit.body.data.items[0].action,'assign');assert.equal(store.get('classified').revision,1);
});
test('busy full-guide reads reject before hydrating images and keep bodyless GET reusable',async t=>{
 let hydrated=0;const {request}=await fixture(t,{maxBufferedResponseBytes:1024,store:{estimatedReadBytes:()=>4096,get:()=>{hydrated++;throw Error('Must not hydrate');}}});
 const busy=await request('/v1/sops/sample');assert.equal(busy.status,503);assert.equal(busy.headers.get('retry-after'),'1');assert.notEqual(busy.headers.get('connection'),'close');assert.equal(hydrated,0);assert.equal((await request('/health')).status,200);
});

test('real SQLite view and selective images preserve exact revision identity and reject corruption', async t => {
  const {TeamStore}=require('../store.cjs'),{createHash}=require('node:crypto');
  const store=new TeamStore({dbPath:':memory:'});t.after(()=>store.close());
  const session=store.createSession({displayName:'Synthetic reader'}),actor=session.actor;
  const sha=s=>createHash('sha256').update(s).digest('hex');
  // Noncanonical padding bits are deliberately accepted by the guide validator;
  // reconstruction must retain the exact original string, not re-encode it.
  const image='data:image/jpeg;base64,/9j/AB==',issueImage='data:image/jpeg;base64,/9j/Ag==';
  const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'view-test',title:'Synthetic view',version:'1',notice:'',steps:[{id:'step-1',title:'',where:'Synthetic',actions:['Review'],expected:'',trouble:'',acceptance:[],image,imageAt:'2026-01-01T00:00:00Z',imageMarks:[],issues:[{id:'issue-1',title:'Issue',actions:['Review'],next:'Continue',image:issueImage}]}]};
  const first=store.create(guide,{actor,idempotencyKey:'view-create-01'});
  const {request}=await fixture(t,{store});
  const get=(route,options={})=>request(route,{...options,headers:{Authorization:`Bearer ${session.token}`,...options.headers}});
  const route='/v1/sops/view-test';
  assert.ok((await get('/v1/capabilities')).body.data.features.includes('read-view-images'));
  const view=(await get(route+'/view')).body.data;
  assert.equal(view.sha256,first.sha256);assert.equal(view.revision,1);
  assert.equal(view.guide.steps[0].image,undefined);assert.equal(view.guide.steps[0].imageAt,undefined);assert.equal(view.guide.steps[0].imageMarks,undefined);assert.equal(view.guide.steps[0].issues[0].image,undefined);
  assert.equal(view.images.length,2);assert.equal(view.images[0].sha256,sha(image));assert.equal(view.images[1].sha256,sha(issueImage));assert.equal(view.images[1].issue,0);
  assert.equal(view.viewSha256,sha(JSON.stringify({guide:view.guide,images:view.images})));
  assert.equal((await get(route+'/images/0?revision=1')).body.data.image,image);
  assert.equal((await get(route+'/images/0?revision=1')).body.data.issue,undefined);
  assert.equal((await get(route+'/images/0/issues/0?revision=1')).body.data.image,issueImage);
  for(const suffix of ['/images/0','/images/-1?revision=1','/images/01?revision=1','/images/100?revision=1','/images/0/issues/10?revision=1','/images/0?revision=0'])assert.equal((await get(route+suffix)).status,400);
  for(const suffix of ['/images/1?revision=1','/images/0/issues/1?revision=1','/images/0?revision=99'])assert.equal((await get(route+suffix)).status,404);
  let reads=0;const old=store.getImage.bind(store);store.getImage=(...args)=>{reads++;return old(...args);};
  assert.equal((await request(route+'/images/0?revision=1',{authenticated:false})).status,401);
  assert.equal((await get(route+'/view',{headers:{'X-Running-SOP-Protocol':'2'}})).status,426);assert.equal(reads,0);
  const lease=store.acquireLock('view-test',{actor});store.publish('view-test',{...guide,title:'Changed',steps:[{...guide.steps[0],image:issueImage}]},{actor,...lease,expectedRevision:1,idempotencyKey:'view-publish-01'});
  assert.equal((await get(route+'/view')).body.data.revision,2);assert.equal((await get(route+'/view?revision=1')).body.data.sha256,first.sha256);assert.equal((await get(route+'/images/0?revision=1')).body.data.image,image);
  const row=store.db.prepare('SELECT guide FROM revisions WHERE id=? AND revision=1').get('view-test'),compact=JSON.parse(row.guide);
  // Corrupt an unrequested asset: selected reads still work, full views fail.
  const issueHash=compact.guide.steps[0].issues[0].image.assetSha256;
  store.db.prepare('UPDATE assets SET bytes=? WHERE sha256=?').run(Buffer.from([0,0,0,0]),issueHash);
  assert.equal((await get(route+'/images/0?revision=1')).status,200);assert.equal((await get(route+'/images/0/issues/0?revision=1')).status,500);assert.equal((await get(route+'/view?revision=1')).status,500);
  for(const mutated of [{...compact,guide:{...compact.guide,workflowId:'other'}},{...compact,guide:{...compact.guide,steps:[{...compact.guide.steps[0],image:{assetSha256:'bad'}}]}}]){
    store.db.prepare('UPDATE revisions SET guide=? WHERE id=? AND revision=1').run(JSON.stringify(mutated),'view-test');assert.equal((await get(route+'/images/0?revision=1')).status,500);
  }
  // Legacy inline fallback verifies the complete original canonical record.
  store.db.prepare('UPDATE revisions SET guide=? WHERE id=? AND revision=1').run(JSON.stringify(first.guide),'view-test');
  assert.equal((await get(route+'/images/0?revision=1')).body.data.image,image);assert.equal((await get(route+'/view?revision=1')).body.data.sha256,first.sha256);
  store.db.prepare("UPDATE revisions SET sha256=? WHERE id=? AND revision=1").run('0'.repeat(64),'view-test');assert.equal((await get(route+'/images/0?revision=1')).status,500);
  assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,6);
});

test('view and image response admission rejects before reconstructing a revision',async t=>{
 let calls=0;const {request}=await fixture(t,{maxBufferedResponseBytes:1024,store:{estimatedReadBytes:()=>2048,getView:()=>{calls++;throw Error('must not reconstruct');},getImage:()=>{calls++;throw Error('must not load asset');}}});
 for(const route of ['/v1/sops/synthetic/view','/v1/sops/synthetic/images/0?revision=1']){const response=await request(route);assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'1');}
 assert.equal(calls,0);
});


// Keep real HTTP framing, admission and buffering, but expose the scheduled
// deadlines so their full bounds can be checked without a two-minute sleep.
function captureTransferDeadlines(t) {
  const timers=[], schedule=global.setTimeout, cancel=global.clearTimeout;
  t.mock.method(global,'setTimeout',(callback,ms,...args)=>{
    const handle=schedule(callback,ms,...args);
    if(callback.name==='expire'||callback.name==='responseExpired')timers.push({callback,ms,handle,cleared:false});
    return handle;
  });
  t.mock.method(global,'clearTimeout',handle=>{for(const timer of timers)if(timer.handle===handle)timer.cleared=true;return cancel(handle);});
  return timers;
}
function heldUpload(base,{route='/v1/sops',length=300000,authenticated=true,chunked=false,initial='{' }={}){
  const http=require('node:http');let complete;
  const done=new Promise(resolve=>{complete=resolve;});
  const req=http.request(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Running-SOP-Protocol':'1',...(authenticated?{Authorization:'Bearer synthetic_session_token_123'}:{}),...(chunked?{}:{'Content-Length':String(length)})}},res=>{res.resume();res.once('end',()=>complete(res.statusCode));});
  req.on('error',()=>complete(0));req.write(initial);
  return {req,done};
}
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('HTTP request did not reach the expected state');}

test('guide body size budgets keep idle, absolute cap, buffer and active admission bounded',async t=>{
  const timers=captureTransferDeadlines(t);
  const {base,request,server}=await fixture(t,{maxConcurrent:1,maxBufferedBodyBytes:64,maxBodyBytes:16*1024*1024});
  assert.equal(server.headersTimeout,15000);assert.equal(server.requestTimeout,120000);
  const upload=heldUpload(base,{length:8*1024*1024});
  await until(()=>timers.some(timer=>timer.ms===120000));
  const absolute=timers.find(timer=>timer.ms===120000),firstIdle=timers.find(timer=>timer.ms===15000&&!timer.cleared);
  assert.ok(firstIdle);upload.req.write(' ');await until(()=>firstIdle.cleared);
  assert.equal(absolute.cleared,false,'Progress must not reset the absolute transfer budget');
  assert.equal((await request('/health')).status,503);
  absolute.callback();assert.equal(await upload.done,408);upload.req.destroy();
  assert.equal((await request('/health')).status,200,'Absolute expiry releases active admission');
  const stalled=heldUpload(base);await until(()=>timers.some(timer=>timer.callback.name==='expire'&&timer.ms===15000&&!timer.cleared));
  timers.find(timer=>timer.callback.name==='expire'&&timer.ms===15000&&!timer.cleared).callback();assert.equal(await stalled.done,408);stalled.req.destroy();
  assert.equal((await request('/v1/sops',{method:'POST',data:{guide:'x'.repeat(52)}})).status,201,'Expiry also releases buffered-body bytes');
});

test('small, unknown-length, control and unauthenticated bodies never receive the large guide budget',async t=>{
  const timers=captureTransferDeadlines(t),{base}=await fixture(t);
  for(const options of [{length:100},{chunked:true},{route:'/v1/sops/sample/lock',length:100},{route:'/v1/sessions',length:100,authenticated:false}]){
    const before=timers.length,upload=heldUpload(base,options);
    await until(()=>timers.slice(before).some(timer=>timer.callback.name==='expire'));
    const deadlines=timers.slice(before).filter(timer=>timer.callback.name==='expire');assert.deepEqual(deadlines.map(timer=>timer.ms),[15000]);
    deadlines[0].callback();assert.equal(await upload.done,408);upload.req.destroy();
  }
  const before=timers.length,unauthorized=heldUpload(base,{authenticated:false});assert.equal(await unauthorized.done,401);unauthorized.req.destroy();
  assert.equal(timers.slice(before).some(timer=>timer.callback.name==='expire'),false,'Unauthenticated guide uploads are rejected before body admission');
});

test('complete guide responses size their deadline and release byte admission on expiry',async t=>{
  const timers=captureTransferDeadlines(t),payload='x'.repeat(300000);
  const {base,request,server}=await fixture(t,{maxBufferedResponseBytes:400000,store:{get:()=>({guide:{image:payload}}),lockInfo:()=>null}});
  server.prependListener('request',(req,res)=>{if(req.url.endsWith('?hold=1'))res.end=function(){res.flushHeaders();return res;};});
  const http=require('node:http');
  const held=await new Promise((resolve,reject)=>{const req=http.get(base+'/v1/sops/sample?hold=1',{headers:{Authorization:'Bearer synthetic_session_token_123','X-Running-SOP-Protocol':'1'}},res=>{res.on('error',()=>{});res.pause();resolve({req,res});});req.once('error',reject);});
  const deadline=timers.find(timer=>timer.callback.name==='responseExpired'&&!timer.cleared);
  const bytes=Buffer.byteLength(JSON.stringify({data:{guide:{image:payload},lock:null}}));
  assert.equal(deadline.ms,15000+Math.ceil(bytes*1000/(64*1024)));
  assert.equal((await request('/v1/sops/sample')).status,503);deadline.callback();
  await until(()=>deadline.cleared);assert.equal((await request('/v1/sops/sample')).status,200,'Response expiry frees its entire byte reservation');held.req.destroy();held.res.destroy();
  const before=timers.length;await request('/health');assert.equal(timers.slice(before).find(timer=>timer.callback.name==='responseExpired').ms,15000);
  const capFixture=await fixture(t,{store:{get:()=>({guide:{image:'x'.repeat(8*1024*1024)}}),lockInfo:()=>null,list:()=>({padding:payload})}});
  let start=timers.length;await capFixture.request('/v1/sops/sample');assert.equal(timers.slice(start).find(timer=>timer.callback.name==='responseExpired').ms,120000,'Even oversized synthetic guide responses have a hard cap');
  start=timers.length;await capFixture.request('/v1/sops');assert.equal(timers.slice(start).find(timer=>timer.callback.name==='responseExpired').ms,15000,'Large metadata responses never inherit a guide deadline');
});

test('explicit short guide deadlines remain strict for large requests and responses',async t=>{
  const timers=captureTransferDeadlines(t),{base,server,request}=await fixture(t,{requestTimeoutMs:100,responseTimeoutMs:100,store:{get:()=>({guide:{image:'x'.repeat(300000)}}),lockInfo:()=>null}});
  assert.equal(server.requestTimeout,100);assert.equal(server.headersTimeout,100);
  const upload=heldUpload(base);assert.equal(await upload.done,408);upload.req.destroy();
  assert.equal(timers.find(timer=>timer.callback.name==='expire').ms,100);
  await request('/v1/sops/sample');assert.ok(timers.filter(timer=>timer.callback.name==='responseExpired').every(timer=>timer.ms===100));
});

test('real progressing known-length guide upload survives the old fifteen-second total deadline', {timeout:22000},async t=>{
  const {base,server}=await fixture(t),http=require('node:http');
  const payload=JSON.stringify({guide:{synthetic:'x'.repeat(300000)}}),started=performance.now();
  const result=new Promise((resolve,reject)=>{
    const req=http.request(base+'/v1/sops',{method:'POST',headers:{Authorization:'Bearer synthetic_session_token_123','X-Running-SOP-Protocol':'1','Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode));});
    req.once('error',reject);t.after(()=>req.destroy());let offset=0;
    const send=()=>{const end=Math.min(payload.length,offset+Math.ceil(payload.length/8));req.write(payload.slice(offset,end));offset=end;if(offset===payload.length){clearInterval(timer);req.end();}};
    const timer=setInterval(send,2000);t.after(()=>clearInterval(timer));
  });
  assert.equal(await result,201);assert.ok(performance.now()-started>=15000);assert.equal(server.headersTimeout,15000);
});

test('public GET and preflight reject unexpected bodies instead of inheriting long parser exposure',async t=>{
 const origin='http://localhost',{base,request}=await fixture(t,{allowOrigins:[origin]}),http=require('node:http');
 for(const [method,route,headers] of [['GET','/health',{'Content-Length':'1000000'}],['GET','/v1/capabilities',{'Transfer-Encoding':'chunked'}],['OPTIONS','/v1/sops',{'Content-Length':'1000000',Origin:origin}]]){
  const result=await new Promise((resolve,reject)=>{
   const req=http.request(base+route,{method,headers},res=>{res.resume();res.once('end',()=>resolve({status:res.statusCode,connection:res.headers.connection}));});
   req.once('error',reject);t.after(()=>req.destroy());req.write('x');
  });
  assert.equal(result.status,400);assert.equal(result.connection,'close');
 }
 assert.equal((await request('/health',{authenticated:false})).status,200);
 assert.equal((await request('/v1/sops',{method:'OPTIONS',authenticated:false,headers:{Origin:origin}})).status,204);
});
