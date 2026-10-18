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
