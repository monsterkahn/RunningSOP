'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto').webcrypto;
const Assets=require('../extension/sop-assets.js');
const jpeg=Uint8Array.from([255,216,255,1,2,3]);
const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'guide-one',title:'指南',version:'1',notice:'',steps:[{id:'step-one',title:'步骤',where:'页面',actions:['动作'],expected:'结果',trouble:'',acceptance:['确认'],image:'data:image/jpeg;base64,'+Buffer.from(jpeg).toString('base64'),imageAt:'2026-10-14T00:00:00Z',imageMarks:[{type:'number',x:.2,y:.3,label:'1'}],issues:[{id:'issue-one',title:'异常',actions:['处理'],next:'重试',image:'data:image/jpeg;base64,'+Buffer.from(jpeg).toString('base64')}]}]};
const wf={id:'guide-one',viewer:'guide'};

test('packs guide step and issue screenshots into immutable hashed image files and restores exact data URIs',async()=>{
  const packed=await Assets.pack(guide,wf,crypto);
  assert.equal(packed.document.format,'runtime-sop-document');
  assert.deepEqual(packed.document.assets.map(a=>a.path),['/steps/0/image','/steps/0/issues/0/image']);
  assert(packed.document.assets.every(a=>a.file===`workflows/guide-one/images/${a.sha256}.jpg`));
  assert.equal(packed.document.content.steps[0].image,null);
  const files=new Map(packed.assets.map(a=>[a.file,a.bytes]));
  const hydrated=await Assets.hydrate(packed.document,wf,async file=>files.get(file),crypto);
  assert.deepEqual(hydrated,guide);
  const sync=Assets.hydrateSync(packed.document,wf,file=>files.get(file));
  assert.deepEqual(sync,guide);
});

test('rejects path traversal, wrong workflow, tampered bytes, and missing image descriptors',async()=>{
  const packed=await Assets.pack(guide,wf,crypto),files=new Map(packed.assets.map(a=>[a.file,a.bytes]));
  const bad=structuredClone(packed.document);bad.assets[0].file='../outside.jpg';
  await assert.rejects(Assets.hydrate(bad,wf,async file=>files.get(file),crypto),/描述无效/);
  await assert.rejects(Assets.hydrate(packed.document,{id:'other',viewer:'guide'},async file=>files.get(file),crypto),/身份无效/);
  const tampered=files.get(packed.assets[0].file).slice();tampered[3]^=1;
  await assert.rejects(Assets.hydrate(packed.document,wf,async file=>file===packed.assets[0].file?tampered:files.get(file),crypto),/SHA-256/);
  const omitted=structuredClone(packed.document);omitted.assets.pop();
  await assert.rejects(Assets.hydrate(omitted,wf,async file=>files.get(file),crypto),/图片资产缺失/);
});

