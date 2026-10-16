'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Stats=require('../extension/stats-engine.js');
const C1='11111111-1111-4111-8111-111111111111';
const C2='22222222-2222-4222-8222-222222222222';
const H1='a'.repeat(64),H2='b'.repeat(64),NOW='2026-10-13T10:00:00.000Z';
const record=(overrides={})=>({workflowId:'guide-one',revisionHash:H1,version:'1.0.0',views:2,lastViewedAt:NOW,vote:null,note:'',feedbackAt:null,...overrides});
const snap=(overrides={})=>({format:'runtime-sop-statistics',schemaVersion:1,clientId:C1,revision:1,updatedAt:NOW,records:[record()],...overrides});
const event=(overrides={})=>({format:'runtime-sop-publication',schemaVersion:1,workflowId:'guide-one',sha256:H1,version:'1.0.0',publishedAt:NOW,previousSha256:null,...overrides});

test('validates and clones strict anonymous device snapshots',()=>{
  const input=snap({records:[record({vote:'up',note:'Works',feedbackAt:NOW})]});
  const valid=Stats.validateSnapshot(input);
  assert.deepEqual(valid,input);
  assert.notEqual(valid.records,input.records);
  for(const invalid of [
    {...input,clientId:'not-a-uuid'},
    {...input,website:'https://example.com'},
    {...input,records:[record(),record()]},
    {...input,records:[record({vote:'maybe'})]},
    {...input,records:[record({views:-1})]},
    {...input,records:[record({lastViewedAt:'yesterday'})]},
    {...input,updatedAt:'2026-02-30T10:00:00Z'},
    {...input,records:[record({workflowId:'../secret'})]},
    {...input,records:[record({revisionHash:'bad'})]}
  ])assert.throws(()=>Stats.validateSnapshot(invalid));
});

test('aggregates only each client latest revision; votes and notes are per client/workflow',()=>{
  const older=snap({revision:1,records:[record({views:100,vote:'down',note:'old',feedbackAt:'2026-10-01T00:00:00Z'})]});
  const latest=snap({revision:2,updatedAt:'2026-10-12T00:00:00Z',records:[record({views:3,vote:'up',note:'See https://private.example/a and www.example.org/path',feedbackAt:NOW})]});
  const second=snap({clientId:C2,revision:4,records:[record({views:0,vote:'up',note:'Looks good',feedbackAt:NOW})]});
  const result=Stats.aggregate([older,latest,second]);
  assert.equal(result.clients,2);
  assert.deepEqual(result.workflows['guide-one'],{views:3,likes:2,dislikes:0,feedbackCount:2,updateCount:null,publicationCount:null,ratings:null,ungradedRatings:2,notes:[
    {client:C1.slice(0,8),version:'1.0.0',date:NOW,note:'See [link removed] and [link removed]',vote:'up'},
    {client:C2.slice(0,8),version:'1.0.0',date:NOW,note:'Looks good',vote:'up'}
  ]});
  assert.deepEqual(Stats.aggregate([]),{clients:0,workflows:{}});
});

test('same-revision conflicts and reused publication hashes with different data are rejected',()=>{
  assert.throws(()=>Stats.aggregate([snap(),snap({updatedAt:'2026-10-12T00:00:00Z'})]),/Conflicting/);
  assert.throws(()=>Stats.aggregate([], [event(),event({version:'2.0.0'})]),/Conflicting/);
  assert.throws(()=>Stats.validateHistoryEvent({...event(),url:'https://example.com'}));
  assert.throws(()=>Stats.validateHistoryEvent({...event(),publishedAt:'today'}));
});

test('publication history counts exact unique events and recorded updates only',()=>{
  const initial=event();
  const update=event({sha256:H2,version:'2.0.0',publishedAt:'2026-10-12T00:00:00Z',previousSha256:H1});
  const summary=Stats.aggregate([], [initial,initial,update]).workflows['guide-one'];
  assert.equal(summary.views,null);
  assert.equal(summary.likes,null);
  assert.equal(summary.updateCount,1);
  assert.equal(summary.publicationCount,2);
  assert.deepEqual(summary.notes,[]);
});

test('votes are latest per device and SOP across versions; withdrawal clears a prior vote',()=>{
 const prior=record({vote:'up',note:'old',feedbackAt:'2026-10-01T00:00:00Z'}),next=record({revisionHash:H2,version:'2.0.0',views:1,vote:'down',note:'new',feedbackAt:NOW});
 let out=Stats.aggregate([snap({records:[prior,next]})]).workflows['guide-one'];assert.equal(out.views,3);assert.equal(out.likes,0);assert.equal(out.dislikes,1);assert.equal(out.feedbackCount,1);assert.equal(out.notes[0].note,'new');
 next.vote=null;next.note='';out=Stats.aggregate([snap({records:[prior,next]})]).workflows['guide-one'];assert.equal(out.likes,0);assert.equal(out.dislikes,0);assert.equal(out.feedbackCount,0);
});

test('optional five-level satisfaction rating keeps old snapshots compatible and rejects invalid values',()=>{
 for(const rating of [1,2,3,4,5,null]){const input=snap({records:[record({rating,feedbackAt:NOW})]});assert.equal(Stats.validateSnapshot(input).records[0].rating,rating);}
 for(const rating of [0,6,'5',2.5])assert.throws(()=>Stats.validateSnapshot(snap({records:[record({rating,feedbackAt:NOW})]})));
 assert.equal('rating' in Stats.validateSnapshot(snap()).records[0],false);
});

test('five rating buckets use latest device feedback across SOP versions, with legacy ungraded and withdrawal',()=>{
 const prior=record({rating:5,vote:'up',feedbackAt:NOW});const next=record({revisionHash:'b'.repeat(64),version:'1.0.1',rating:2,vote:'down',feedbackAt:'2026-10-14T10:00:00Z'});
 const legacy=snap({clientId:C2,records:[record({vote:'up',feedbackAt:NOW})]});
 let value=Stats.aggregate([snap({records:[prior,next]}),legacy]).workflows['guide-one'];assert.deepEqual(value.ratings,{1:0,2:1,3:0,4:0,5:0});assert.equal(value.ungradedRatings,1);
 next.rating=null;next.vote=null;next.feedbackAt='2026-10-14T11:00:00Z';value=Stats.aggregate([snap({records:[prior,next]}),legacy]).workflows['guide-one'];assert.deepEqual(value.ratings,{1:0,2:0,3:0,4:0,5:0});assert.equal(value.ungradedRatings,1);
});
