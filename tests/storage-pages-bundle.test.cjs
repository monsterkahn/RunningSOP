'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {bundle}=require('../tools/build-storage-pages.cjs');
test('deployment bundle contains hashed trusted pages with empty library data and no example documents',()=>{
 const value=bundle();assert.equal(value.format,'runtime-sop-storage-pages');assert.equal(value.schemaVersion,1);assert.equal(value.version,require('../extension/manifest.json').version);
 assert.deepEqual(value.files.map(file=>file.name),['index.html','relationships.html']);
 for(const file of value.files)assert.equal(crypto.createHash('sha256').update(file.content).digest('hex'),file.sha256);
 const seed=JSON.parse(value.files[0].content.match(/<script id="dashboard-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(seed.catalog.workflows,[]);assert.deepEqual(seed.workflows,[]);assert.equal(seed.statisticsAvailable,false);assert.equal(seed.source,'unconfigured');
 const graph=JSON.parse(value.files[1].content.match(/<script id="relations-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(graph.nodes,[]);assert.deepEqual(graph.relations.edges,[]);assert.equal(graph.relations.revision,0);
 assert.deepEqual(bundle(),value,'bundled page generation is deterministic for unchanged sources');
});
