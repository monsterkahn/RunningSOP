'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const DeviceName = require('../extension/device-name.js'), KEY = DeviceName.KEY;
function fixture(initial, os='mac') {
  let value = structuredClone(initial), reads = 0, writes = 0, platformCalls = 0, randomCalls = 0, queue = Promise.resolve();
  const storage = {async get(key){assert.equal(key,KEY);reads++;return value===undefined?{}:{[KEY]:structuredClone(value)};},async set(next){assert.deepEqual(Object.keys(next),[KEY]);writes++;value=structuredClone(next[KEY]);}};
  const locks = {request(name,options,action){assert.equal(name,KEY);assert.deepEqual(options,{mode:'exclusive'});const result=queue.then(action);queue=result.catch(()=>{});return result;}};
  const crypto = {getRandomValues(bytes){randomCalls++;bytes.set([0,1,2,3]);return bytes;}};
  const getPlatformInfo = async()=>{platformCalls++;return {os,arch:'synthetic-unused-architecture'};};
  return {storage,locks,crypto,getPlatformInfo,api:DeviceName.create({storage,locks,crypto,getPlatformInfo}),stored:()=>structuredClone(value),counts:()=>({reads,writes,platformCalls,randomCalls})};
}
test('device names are generated lazily, persist locally and survive platform changes',async()=>{
  const f = fixture();assert.deepEqual(f.counts(),{reads:0,writes:0,platformCalls:0,randomCalls:0});
  assert.equal(await f.api.get(),'Mac-ABCD');assert.deepEqual(f.stored(),{schemaVersion:1,os:'mac',name:'Mac-ABCD'});
  assert.equal(await f.api.get(),'Mac-ABCD');
  const restarted = DeviceName.create({storage:f.storage,locks:null,crypto:null,getPlatformInfo:()=>{throw Error('Existing identity must not inspect platform');}});
  assert.equal(await restarted.get(),'Mac-ABCD');assert.equal(f.counts().writes,1);assert.equal(f.counts().randomCalls,1);assert.equal(f.counts().platformCalls,1);
});
test('every supported platform uses its short prefix and random uppercase alphabet',async()=>{
  for (const [os,prefix] of Object.entries({mac:'Mac',win:'Win',linux:'Lin',cros:'CrOS',android:'And',openbsd:'BSD',fuchsia:'Fuch'})) {
    const f=fixture(undefined,os);f.crypto.getRandomValues=bytes=>{bytes.set([255,254,253,252]);return bytes;};
    assert.equal(await f.api.get(),prefix+'-9876');assert.equal(f.stored().os,os);
  }
});
test('concurrent calls and independently created pages share one verified identity',async()=>{
  const f=fixture(), second=DeviceName.create(f), third=DeviceName.create(f);
  const names=await Promise.all(Array.from({length:30},(_,i)=>[f.api,second,third][i%3].get()));
  assert.deepEqual([...new Set(names)],['Mac-ABCD']);assert.equal(f.counts().writes,1);assert.equal(f.counts().randomCalls,1);assert.equal(f.counts().platformCalls,1);
});
test('corrupt or unknown stored fields never regenerate or overwrite the identity',async()=>{
  for (const raw of [null,[],{},'Mac-ABCD',{schemaVersion:2,os:'mac',name:'Mac-ABCD'},{schemaVersion:1,os:'mac',name:'Win-ABCD'},{schemaVersion:1,os:'mac',name:'Mac-AIO1'},{schemaVersion:1,os:'mac',name:'Mac-abcd'},{schemaVersion:1,os:'unknown',name:'Mac-ABCD'},{schemaVersion:1,os:'mac',name:'Mac-ABCD',hostname:'synthetic-private-host'}]) {
    const f=fixture(raw);await assert.rejects(f.api.get(),{code:'invalid_record'});assert.deepEqual(f.stored(),raw);assert.equal(f.counts().writes,0);assert.equal(f.counts().platformCalls,0);
  }
  const record={schemaVersion:1,os:'mac',name:'Mac-ABCD'};Object.defineProperty(record,'hidden',{value:true});
  const hidden=DeviceName.create({storage:{get:async()=>({[KEY]:record})}});await assert.rejects(hidden.get(),{code:'invalid_record'});
});
test('missing locking, unsupported platform and unavailable entropy fail before writing',async()=>{
  const f=fixture();await assert.rejects(DeviceName.create({...f,locks:null}).get(),{code:'locks_unavailable'});
  for (const os of ['unknown','Mac','__proto__',undefined]) {const x=fixture(undefined,os);if(os===undefined)x.getPlatformInfo=async()=>({});await assert.rejects(DeviceName.create(x).get(),{code:'unsupported_platform'});assert.equal(x.counts().writes,0);}
  await assert.rejects(DeviceName.create({...f,crypto:null}).get(),{code:'crypto_unavailable'});assert.equal(f.counts().writes,0);
});
test('storage failures surface and a rejected call can retry without changing a persisted identity',async()=>{
  const f=fixture(), actualSet=f.storage.set;let rejectOnce=true;
  f.storage.set=async value=>{if(rejectOnce){rejectOnce=false;throw Error('Synthetic quota');}return actualSet(value);};
  await assert.rejects(f.api.get(),/Synthetic quota/);assert.equal(f.stored(),undefined);assert.equal(await f.api.get(),'Mac-ABCD');
  const readFailure=DeviceName.create({...f,storage:{get:async()=>{throw Error('Synthetic unavailable storage');}}});await assert.rejects(readFailure.get(),/Synthetic unavailable storage/);
  const dropped=fixture();dropped.storage.set=async()=>{};await assert.rejects(dropped.api.get(),{code:'readback_failed'});assert.equal(dropped.stored(),undefined);
  const competing=fixture();let wrote=false;competing.storage.set=async()=>{wrote=true;};competing.storage.get=async()=>wrote?{[KEY]:{schemaVersion:1,os:'win',name:'Win-EFGH'}}:{};
  await assert.rejects(competing.api.get(),{code:'readback_failed'});
  // A different valid persisted value is never overwritten on a later retry.
  assert.equal(await competing.api.get(),'Win-EFGH');
});
