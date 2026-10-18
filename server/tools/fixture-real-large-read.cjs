'use strict';
const { TeamStore } = require('../store.cjs'); const { createTeamServer } = require('../app.cjs');
if (!process.send || !process.env.SOP_LARGE_READ_DB) throw new Error('Use only from isolated real-large-read benchmark.');
const store = new TeamStore({ dbPath: process.env.SOP_LARGE_READ_DB });
const actor = store.createSession({ displayName: 'Synthetic fixture seed' }).actor;
const steps = Array.from({ length: 12 }, (_, index) => {
  // Structurally valid synthetic JPEG bytes. No photograph or business data.
  const bytes = Buffer.alloc(196608, index); bytes[0] = 255; bytes[1] = 216; bytes[2] = 255;
  return { id: 'step-' + index, title: '', where: 'Synthetic', actions: ['Synthetic action'], expected: '', trouble: '', acceptance: [], workUrl: 'https://example.test/task/' + index, image: 'data:image/jpeg;base64,' + bytes.toString('base64') };
});
store.create({ format: 'runtime-sop-guide', schemaVersion: 1, workflowId: 'heavy-sample', title: 'Synthetic image-heavy fixture', version: '1', notice: '', steps }, { actor, idempotencyKey: 'synthetic-heavy-seed' });
let peakRss = 0, peakHeapUsed = 0, peakArrayBuffers = 0, peakConnections = 0, connections = 0, getCalls = 0;
const sample = () => { const m = process.memoryUsage(); peakRss = Math.max(peakRss, m.rss); peakHeapUsed = Math.max(peakHeapUsed, m.heapUsed); peakArrayBuffers = Math.max(peakArrayBuffers, m.arrayBuffers); };
const get = store.get.bind(store); store.get = (...args) => { const result = get(...args); getCalls++; sample(); return result; };
const timer = setInterval(sample, 5); timer.unref(); sample();
const server = createTeamServer({ store, joinCode: 'synthetic-large-read-join-code' });
server.on('connection', socket => { connections++; peakConnections = Math.max(peakConnections, connections); socket.once('close', () => connections--); });
server.listen({ port: 0, host: '127.0.0.1', backlog: 1024 }, () => process.send({ ready: true, port: server.address().port, guideBytes: Buffer.byteLength(JSON.stringify(store.get('heavy-sample').guide)), assetRows: store.db.prepare('SELECT count(*) AS count FROM assets').get().count, assetBytes: store.db.prepare('SELECT sum(byteLength) AS bytes FROM assets').get().bytes }));
process.on('message', message => {
  if (message.type === 'stats') { sample(); process.send({ stats: true, peakRss, peakHeapUsed, peakArrayBuffers, peakConnections, connections, getCalls, memory: process.memoryUsage() }); }
  if (message.type === 'stop') { server.closeAllConnections(); server.close(() => { store.close(); process.exit(0); }); }
});
process.on('disconnect', () => { server.closeAllConnections(); server.close(() => { store.close(); process.exit(0); }); });
