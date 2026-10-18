'use strict';
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const http = require('node:http');
const {Readable}=require('node:stream');
const { createHash, webcrypto } = require('node:crypto'); const { fork } = require('node:child_process'); const { once } = require('node:events'); const assert = require('node:assert/strict');
const TeamClient = require('../../extension/team-client.js');
const option=name=>{const index=process.argv.indexOf('--'+name);return index<0?undefined:process.argv[index+1];};
const clients=Number(option('clients')||75),maxAttempts=8,deadlineMs=30000;
if(!Number.isSafeInteger(clients)||clients<1||clients>500)throw Error('Use 1..500 test clients');
const reportPath=option('out')||(process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:null);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-real-large-read-'));
const agents = Array.from({ length: clients }, () => new http.Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 }));
let child, port, referenceHash;
function request(index, route, token, body, timeoutMs = 30000) {
  return new Promise(resolve => {
    const raw = body && JSON.stringify(body), headers = { 'X-Running-SOP-Protocol': '1' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (raw) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(raw); }
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method: raw ? 'POST' : 'GET', agent: agents[index], headers }, res => {
      let bytes = 0, text = ''; const hash = createHash('sha256');
      res.on('data', chunk => { bytes += chunk.length; if (route.startsWith('/v1/sops/') && res.statusCode === 200) hash.update(chunk); else if (bytes <= 65536) text += chunk; });
      res.once('end', () => { let data; if (text) { try { data = JSON.parse(text).data; } catch {} } resolve({ status: res.statusCode, bytes, hash: res.statusCode === 200 && route.startsWith('/v1/sops/') ? hash.digest('hex') : undefined, retryAfter: Number(res.headers['retry-after']) || 0, data }); });
      res.once('error', error => resolve({ status: 0, error: error.code || 'response_error' }));
    });
    const timer = setTimeout(() => req.destroy(new Error('overall_request_deadline')), Math.max(1, timeoutMs)); timer.unref(); req.once('close', () => clearTimeout(timer));
    req.once('error', error => resolve({ status: 0, error: error.code || error.message })); req.end(raw);
  });
}
function clientFetch(index){return (url,options)=>new Promise((resolve,reject)=>{const u=new URL(url);const req=http.request({hostname:u.hostname,port:u.port,path:u.pathname+u.search,method:options.method,headers:options.headers,signal:options.signal,agent:agents[index]},res=>{resolve(new Response(Readable.toWeb(res),{status:res.statusCode,headers:res.headers}));});req.once('error',reject);req.end(options.body);});}
async function actualClients(tokens){
 const started=performance.now(),times=[],failures={},counts={};
 const results=await Promise.all(tokens.map(async(token,i)=>{
  const api=TeamClient.create({endpoint:`http://127.0.0.1:${port}`,token,crypto:webcrypto,fetch:async(...args)=>{const response=await clientFetch(i)(...args);counts[response.status]=(counts[response.status]||0)+1;return response;},cacheLimit:0,maxCacheBytes:0,timeoutMs:8000});
  try{const value=await api.read('heavy-sample');assert.equal(value.guide.steps.length,12);times.push(performance.now()-started);return true;}catch(e){failures[e.code||e.message]=(failures[e.code||e.message]||0)+1;return false;}
 }));times.sort((a,b)=>a-b);return {name:'actual-extension-client-bounded-retry',clients,completed:results.filter(Boolean).length,incomplete:results.filter(v=>!v).length,statusCounts:counts,failures,elapsedMs:performance.now()-started,completedP95Ms:times[Math.floor(times.length*.95)],server:await stats()};
}
async function stats() { const next = once(child, 'message'); child.send({ type: 'stats' }); return (await next)[0]; }
async function phase(name, tokens, retry) {
  const start = performance.now(), statusCounts = {}, failures = {}, completedTimes = []; let attempts = 0, transferredBytes = 0;
  const results = await Promise.all(tokens.map(async (token, index) => {
    let attempt = 0, last;
    while (++attempt <= (retry ? maxAttempts : 1)) {
      const remaining = deadlineMs - (performance.now() - start); if (remaining <= 0) break;
      last = await request(index, '/v1/sops/heavy-sample', token, undefined, remaining); attempts++; statusCounts[last.status] = (statusCounts[last.status] || 0) + 1; transferredBytes += last.bytes || 0;
      if (last.status === 200) { if (!referenceHash) referenceHash = last.hash; assert.equal(last.hash, referenceHash); completedTimes.push(performance.now() - start); return true; }
      if (!retry || last.status !== 503 || attempt === maxAttempts) break;
      // Benchmark-only GET retry. No mutation retry and no hidden queue limit.
      const delay = Math.max(1000, last.retryAfter * 1000) + Math.floor(Math.random() * Math.min(4000, 250 * 2 ** attempt));
      if (performance.now() - start + delay >= deadlineMs) break;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    const reason = last ? last.error || String(last.status) : 'deadline'; failures[reason] = (failures[reason] || 0) + 1; return false;
  }));
  completedTimes.sort((a, b) => a - b);
  const result = { name, clients, completed: results.filter(Boolean).length, incomplete: results.filter(value => !value).length, attempts, statusCounts, failures, transferredBytes, elapsedMs: performance.now() - start, completedP95Ms: completedTimes.length ? completedTimes[Math.min(completedTimes.length - 1, Math.floor(completedTimes.length * .95))] : null, server: await stats() };
  console.log(JSON.stringify(result)); return result;
}
async function main() {
  child = fork(path.join(__dirname, 'fixture-real-large-read.cjs'), [], { env: { ...process.env, SOP_LARGE_READ_DB: path.join(directory, 'test.sqlite') }, execArgv: ['--max-old-space-size=256'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const ready = await Promise.race([once(child, 'message').then(([message]) => message), once(child, 'exit').then(() => { throw new Error('Server exited before ready'); })]); port = ready.port;
  for (let start = 0; start < clients; start += 32) { const responses = await Promise.all(Array.from({ length: Math.min(32, clients - start) }, (_, index) => request(start + index, '/health'))); responses.forEach(response => assert.equal(response.status, 200)); }
  const sessions = await Promise.all(Array.from({ length: clients }, (_, index) => request(index, '/v1/sessions', undefined, { joinCode: 'synthetic-large-read-join-code', displayName: 'Synthetic reader ' + index })));
  sessions.forEach(response => assert.equal(response.status, 201)); const tokens = sessions.map(response => response.data.token);
  // Verify the actual extension client's validation/hash path once, with cache
  // disabled, rather than retaining 500 decoded guides in this load generator.
  const client = TeamClient.create({ endpoint: `http://127.0.0.1:${port}`, token: tokens[0], crypto: webcrypto, cacheLimit: 0, maxCacheBytes: 0, timeoutMs: 30000 });
  const verified = await client.read('heavy-sample'); assert.equal(verified.guide.steps.length, 12);
  const baseline = await stats();
  const noRetry = await phase('normal-consuming-no-retry', tokens, false);
  const boundedRetry = await phase('normal-consuming-benchmark-get-retry', tokens, true);
  const extensionClients=await actualClients(tokens);console.log(JSON.stringify(extensionClients));
  const report = { kind: 'real-sqlite-image-guide-normal-readers', node: process.version, platform: process.platform, clients, guideBytes: ready.guideBytes, assetRows: ready.assetRows, assetBytes: ready.assetBytes, responseBudgetBytes: 32 * 1024 * 1024, childHeapLimitMiB: 256, retryPolicy: { implementedInExtension: true, maxAttempts, deadlineMs, retryStatuses: [503], delay: 'Retry-After minimum 1s plus exponential jitter capped at4s' }, baseline, phases: [noRetry, boundedRetry,extensionClients], limitations: ['One synthetic schema4 guide with 12 distinct JPEG-shaped 192KiB byte arrays; no actual image decoding or business screenshots.', 'Independent warmed sockets matching the stated client count; same host loopback, not physical LAN.', 'Normal readers stream/hash/discard responses; one real TeamClient verifies content with cache disabled. This does not measure 500 browser caches.', 'The third phase uses the actual extension client and a streaming HTTP adapter over the existing per-user socket; no browser rendering or image decoding.', 'Reported peak memory is observed, not a universal bound.'] };
  if (reportPath) fs.writeFileSync(path.resolve(reportPath), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { for (const agent of agents) agent.destroy(); if (child && child.connected) { const exit = once(child, 'exit'); child.send({ type: 'stop' }); await exit; } fs.rmSync(directory, { recursive: true, force: true }); });
