'use strict';
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const { fork } = require('node:child_process'); const { once } = require('node:events'); const assert = require('node:assert/strict');
const clients = 500;
const agents = Array.from({ length: clients }, () => new http.Agent({ keepAlive: true, maxSockets: 1, maxFreeSockets: 1 }));
let child, port;
const held = [];
function request(index, route, pause = false) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: route, agent: agents[index], headers: { 'X-Running-SOP-Protocol': '1', Authorization: `Bearer synthetic_reader_${String(index).padStart(5, '0')}` } }, res => {
      if (pause && res.statusCode === 200) { res.pause(); res.on('error', () => {}); held.push({ req, res }); resolve({ status: res.statusCode }); }
      else { res.resume(); res.once('end', () => resolve({ status: res.statusCode, retryAfter: res.headers['retry-after'] })); res.once('error', reject); }
    });
    req.once('error', reject); req.setTimeout(15000, () => req.destroy(new Error('Transport fixture deadline exceeded')));
  });
}
async function stats() { const next = once(child, 'message'); child.send({ type: 'stats' }); return (await next)[0]; }
async function main() {
  child = fork(path.join(__dirname, 'fixture-large-response.cjs'), [], { execArgv: ['--max-old-space-size=256'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const ready = await Promise.race([once(child, 'message').then(([message]) => message), once(child, 'exit').then(() => { throw new Error('Fixture exited before startup'); })]); port = ready.port;
  for (let start = 0; start < clients; start += 32) await Promise.all(Array.from({ length: Math.min(32, clients - start) }, (_, i) => request(start + i, '/health')));
  const baseline = await stats(), start = performance.now();
  const results = await Promise.all(Array.from({ length: clients }, (_, index) => request(index, '/v1/sops/sample', true)));
  const blocked = await stats();
  const statuses = results.reduce((counts, result) => { counts[result.status] = (counts[result.status] || 0) + 1; return counts; }, {});
  assert.ok(statuses[200] > 0); assert.ok(statuses[503] > 0); assert.equal((statuses[200] || 0) + (statuses[503] || 0), clients);
  assert.ok(results.filter(result => result.status === 503).every(result => result.retryAfter === '1'));
  assert.ok(blocked.peakConnections >= clients);
  const successfulIndex = results.findIndex(result => result.status === 200);
  for (const item of held) { item.res.destroy(); item.req.destroy(); }
  held.length = 0;
  await new Promise(resolve => setTimeout(resolve, 100));
  // One new connection verifies that closed large responses released capacity.
  assert.equal((await request(successfulIndex, '/v1/sops/sample')).status, 200);
  const recovered = await stats();
  const report = { kind: 'synthetic-slow-reader-http-response-admission', node: process.version, platform: process.platform, clients, liveIndependentSockets: blocked.peakConnections, responseBytes: ready.responseBytes, responseBudgetBytes: 32 * 1024 * 1024, fixtureHeapLimitMiB: 256, statuses, durationMs: performance.now() - start, baseline, blocked, recovered, unexpectedFailures: 0, limitations: ['Transport fixture uses one shared synthetic image-sized string; it does not benchmark SQLite asset reconstruction.', 'Paused clients establish userland backpressure; OS TCP buffers are outside the application response budget.', 'Warm-up uses batches of 32 because this host has a 128-connection accept backlog.', 'Peak memory figures describe this isolated process, not a bound for every workload.'] };
  const output = process.argv[2];
  if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const item of held) { item.res.destroy(); item.req.destroy(); }
  for (const agent of agents) agent.destroy();
  if (child && child.connected) { const exited = once(child, 'exit'); child.send({ type: 'stop' }); await exited; }
});
