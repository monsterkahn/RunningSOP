'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../extension/catalog-engine.js');
const LocalSOP=require('../extension/local-sop-engine.js');

function workflow(id,host,overrides={}){
  return {id,title:id,summary:'',status:'published',viewer:'guide',file:id+'.json',sha256:'a'.repeat(64),rules:[{hosts:[host],pathPrefixes:['/studio'],priority:10,label:'Studio'}],...overrides};
}
function catalog(workflows=[workflow('media-workflow','studio.example.com')]){
  return E.validateCatalog({format:'runtime-sop-catalog',schemaVersion:1,version:'1.0.0',workflows});
}

test('catalog normalizes safe data and matches exact hostname',()=>{
  const c=catalog();
  assert.equal(c.format,'runtime-sop-catalog');
  assert.equal(E.matchPage('https://studio.example.com/studio/videos',c).state,'matched');
  assert.equal(E.matchPage('https://studio.example.com.evil.test/studio/videos',c).state,'none');
  assert.equal(E.matchPage('https://evilstudio.example.com/studio/videos',c).state,'none');
});

test('path prefixes respect segment boundaries and exact paths',()=>{
  const c=catalog([workflow('media-workflow','studio.example.com',{rules:[{hosts:['studio.example.com'],pathPrefixes:['/upload'],pathEquals:['/exact'],priority:3,label:'Upload'}]})]);
  assert.equal(E.matchPage('https://studio.example.com/upload',c).state,'matched');
  assert.equal(E.matchPage('https://studio.example.com/upload/video',c).state,'matched');
  assert.equal(E.matchPage('https://studio.example.com/uploading',c).state,'none');
  assert.equal(E.matchPage('https://studio.example.com/exact?x=1',c).state,'matched');
  assert.equal(E.matchPage('https://studio.example.com/exactly',c).state,'none');
  assert.equal(E.matchPage('ftp://studio.example.com/upload',c).state,'none');
});

test('highest priority wins and equal workflow winners are ambiguous',()=>{
  const c=catalog([
    workflow('low','example.com',{rules:[{hosts:['example.com'],priority:2,label:'low'}]}),
    workflow('high','example.com',{rules:[{hosts:['example.com'],priority:8,label:'high'}]}),
    workflow('also-high','example.com',{rules:[{hosts:['example.com'],priority:8,label:'also'}]})
  ]);
  const result=E.matchPage('https://example.com/',c);
  assert.equal(result.state,'ambiguous');
  assert.deepEqual(result.candidates.map(x=>x.workflow.id),['high','also-high']);
  const unique=catalog([workflow('low','example.com',{rules:[{hosts:['example.com'],priority:2,label:'low'}]}),workflow('high','example.com',{rules:[{hosts:['example.com'],priority:8,label:'high'}]})]);
  assert.equal(E.matchPage('https://example.com/',unique).candidates[0].workflow.id,'high');
});

test('catalog rejects traversal, malformed hosts, duplicate IDs and dangerous fields',()=>{
  assert.throws(()=>catalog([workflow('x','example.com',{file:'../x.json'})]),/路径/);
  assert.throws(()=>catalog([workflow('x','*.example.com')]),/主机名/);
  assert.throws(()=>catalog([workflow('x','example.com'),workflow('x','example.org')]),/重复/);
  const malicious=JSON.parse('{"format":"runtime-sop-catalog","schemaVersion":1,"version":"1","workflows":[],"__proto__":{"polluted":true}}');
  assert.throws(()=>E.validateCatalog(malicious),/危险/);
  const accessor={format:'runtime-sop-catalog',schemaVersion:1,version:'1',workflows:[]};
  Object.defineProperty(accessor,'secret',{enumerable:true,get(){throw Error('getter executed');}});
  assert.throws(()=>E.validateCatalog(accessor),/访问器/);
  assert.equal({}.polluted,undefined);
});

test('file resolution stays inside the catalog folder and endpoint is file-only',()=>{
  const base='file:///test/shared/catalog.json';
  assert.equal(E.resolveFile(base,'guides/media-workflow.json'),'file:///test/shared/guides/media-workflow.json');
  for(const path of ['../private.json','/outside.json','a/../../outside.json','a%2f..%2foutside.json','a\\b.json']) assert.throws(()=>E.resolveFile(base,path));
  for(const endpoint of ['https://example.com/catalog.json','file:///x/catalog.json?x=1','file:///x/not-catalog.json']) assert.throws(()=>E.validateEndpoint(endpoint));
  assert.equal(E.validateEndpoint(base),base);
});

test('guide validator returns bounded normalized data and rejects unsafe schema',()=>{
  const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'guide-one',title:'Guide',version:'1',notice:'',steps:[{id:'step-one',title:'Step',where:'Page',actions:['Click'],expected:'Done',trouble:'',acceptance:['Confirm']}]};
  assert.deepEqual(E.validateGuide(guide),guide);
  assert.throws(()=>E.validateGuide({...guide,steps:[...guide.steps,{...guide.steps[0]}]}),/重复/);
  assert.throws(()=>E.validateGuide({...guide,extra:'executable'}),/未知/);
});

test('guide work URLs accept canonical local file URLs and reject unsafe schemes or credentials',()=>{
  const base={format:'runtime-sop-guide',schemaVersion:1,workflowId:'local-guide',title:'Local',version:'1',notice:'',steps:[{id:'step-one',title:'Step',where:'File',actions:['Open'],expected:'Done',trouble:'',acceptance:['Confirm'],workUrl:'file:///test/user/My%20Folder/guide.html?mode=edit#top'}]};
  assert.equal(E.validateGuide(base).steps[0].workUrl,base.steps[0].workUrl);
  for(const workUrl of ['file://user:pass/server/path','javascript:alert(1)','data:text/html,x','chrome://settings','https://user:pass@example.com/a','file:///test/user/a b.html','file:///test/user/../private.html'])
    assert.throws(()=>E.validateGuide({...base,steps:[{...base.steps[0],workUrl}]}),/工作网址|本机/);
});

test('file route rules require exact normalized file URLs and never match all local files',()=>{
  const file='file:///test/user/My%20Folder/guide.html?mode=edit#top';
  const c=catalog([workflow('local','example.com',{rules:[{hosts:[],fileUrls:[file],priority:10,label:'Local file'}]})]);
  assert.equal(E.matchPage(file,c).state,'matched');
  assert.equal(E.matchPage('file:///test/user/My%20Folder/guide.html?mode=other#top',c).state,'none');
  assert.equal(E.matchPage('file://remote.example/test/user/My%20Folder/guide.html?mode=edit#top',c).state,'none');
  for(const rule of [
    {hosts:[],priority:10,label:'Broad file'},
    {hosts:['example.com'],fileUrls:[file],priority:10,label:'Mixed routes'},
    {hosts:[],fileUrls:[file],pathPrefixes:['/Users'],priority:10,label:'Broad file path'},
    {hosts:[],fileUrls:['file:///test/user/a b.html'],priority:10,label:'Noncanonical URL'},
    {hosts:[],fileUrls:['file://user:pass@nas/a'],priority:10,label:'Credential URL'}
  ]) assert.throws(()=>catalog([workflow('bad','example.com',{rules:[rule]})]));
  assert.equal(LocalSOP.same('file:///test/user/My%20Folder/guide.html','file:///test/user/My%20Folder/guide.html'),true);
  assert.equal(LocalSOP.same('file:///test/user/guide.html','file://remote.example/test/user/guide.html'),false);
});

test('private IPv4, IPv6, localhost and intranet domains support exact protocol and port routing',()=>{
 for(const origin of ['http://nas.example:5000','http://localhost:8080','https://oa.corp.local','http://nas:5000','http://[::1]:8080']){
 const host=new URL(origin).hostname,cat={format:'runtime-sop-catalog',schemaVersion:1,version:'1',workflows:[{id:'internal',title:'Internal',summary:'',status:'published',viewer:'guide',file:'internal.json',sha256:'a'.repeat(64),rules:[{hosts:[host],origins:[origin],pathEquals:['/work'],priority:1,label:'Internal'}]}]};
 assert.equal(E.matchPage(origin+'/work',cat).state,'matched');assert.equal(E.matchPage(origin+'/other',cat).state,'none');const changed=new URL(origin+'/work');changed.port='9090';assert.equal(E.matchPage(changed.href,cat).state,'none');
 }
});

test('bounded catalog supports 500 entries and rejects a 501st',()=>{const rows=Array.from({length:500},(_,i)=>workflow('flow-'+i,'company.local'));assert.equal(catalog(rows).workflows.length,500);assert.throws(()=>catalog([...rows,workflow('flow-500','company.local')]));});


test('blank step titles and report/approval requirements survive validated publication data',()=>{
 const base={format:'runtime-sop-guide',schemaVersion:1,workflowId:'points-demo',title:'Demo',version:'1',notice:'',steps:[{id:'step-one',title:'',where:'Page',actions:['Submit'],expected:'Received',trouble:'',acceptance:['Confirmed'],pointType:'both',pointNote:'Report to lead; await approval.'}]};
 assert.deepEqual(E.validateGuide(base),base);
 assert.throws(()=>E.validateGuide({...base,steps:[{...base.steps[0],pointType:'admin'}]}),/节点/);
 assert.throws(()=>E.validateGuide({...base,steps:[{...base.steps[0],pointNote:'x'.repeat(1501)}]}),/节点/);
});


test('publication accepts empty optional results and criteria, and identifies invalid steps',()=>{
 const step={id:'one',title:'',where:'Page',actions:['Do the work'],expected:'',trouble:'',acceptance:[]};
 const guide={format:'runtime-sop-guide',schemaVersion:1,workflowId:'optional-results',title:'Demo',version:'1',notice:'',steps:[step]};
 assert.deepEqual(E.validateGuide(guide),guide);
 assert.throws(()=>E.validateGuide({...guide,steps:[step,{...step,id:'two',actions:[]}]}),/STEP 2.*请填写操作说明/);
 assert.throws(()=>E.validateGuide({...guide,steps:[{...step,expected:'x'.repeat(1501)}]}),/STEP 1.*预期结果/);
});
