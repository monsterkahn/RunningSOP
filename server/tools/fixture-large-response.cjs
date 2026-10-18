'use strict';
// Transport-only synthetic fixture. Never opens an operator's database.
const { createHash } = require('node:crypto');
const { createTeamServer } = require('../app.cjs');
if (!process.send) throw new Error('Use from the isolated large-response benchmark.');
const imageBytes = 4 * 1024 * 1024 - 65536;
const guide = { format: 'runtime-sop-guide', schemaVersion: 1, workflowId: 'sample', title: 'Synthetic transport fixture', version: '1', steps: [{ id: 'step-one', image: 'data:image/png;base64,' + 'A'.repeat(imageBytes) }] };
const result = { id: 'sample', revision: 1, sha256: createHash('sha256').update(JSON.stringify(guide)).digest('hex'), guide };
let peakRss = 0, peakHeapUsed = 0, peakExternal = 0, connections = 0, peakConnections = 0;
const sample = () => { const memory = process.memoryUsage(); peakRss = Math.max(peakRss, memory.rss); peakHeapUsed = Math.max(peakHeapUsed, memory.heapUsed); peakExternal = Math.max(peakExternal, memory.external); };
const timer = setInterval(sample, 5); timer.unref(); sample();
const store = { authenticate: token => ({ id: token, name: 'Synthetic reader' }), get: () => { sample(); return result; }, lockInfo: () => null };
const server = createTeamServer({ store, joinCode: 'synthetic-transport-join-code', responseTimeoutMs: 10000 });
server.on('connection', socket => { connections++; peakConnections = Math.max(peakConnections, connections); socket.once('close', () => connections--); });
server.listen({ port: 0, host: '127.0.0.1', backlog: 1024 }, () => process.send({ ready: true, port: server.address().port, responseBytes: Buffer.byteLength(JSON.stringify({ data: { ...result, lock: null } })) }));
process.on('message', message => {
  if (message.type === 'stats') { sample(); process.send({ stats: true, peakRss, peakHeapUsed, peakExternal, connections, peakConnections, memory: process.memoryUsage() }); }
  if (message.type === 'stop') { server.closeAllConnections(); server.close(() => process.exit(0)); }
});
process.on('disconnect', () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
