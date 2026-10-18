'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Source=require('../extension/storage-source.js'),Engine=require('../extension/catalog-engine.js');
const catalog=fs.readFileSync(path.join(__dirname,'../examples/storage/catalog.json'),'utf8');
const notFound=()=>Object.assign(Error('Not found'),{name:'NotFoundError'});
function file(name,text){return {name,kind:'file',async isSameEntry(other){return this===other;},async getFile(){const bytes=Buffer.from(text);return {size:bytes.length,async arrayBuffer(){return Uint8Array.from(bytes).buffer;}};}};}
function folder(name,children={}){return {name,kind:'directory',permission:'granted',async isSameEntry(other){return this===other;},async queryPermission(){return this.permission;},async getFileHandle(key){const value=children[key];if(!value||value.kind!=='file')throw notFound();return value;},async getDirectoryHandle(key){const value=children[key];if(!value||value.kind!=='directory')throw notFound();return value;}};}
function env(){let pair={handle:null,record:null},values={},next,chosenFile,id=0,writeFailure=false;const calls=[];const storage={async get(key){return {[key]:values[key]};},async set(v){if(writeFailure){writeFailure=false;throw Error('storage failed');}Object.assign(values,v);},async remove(k){delete values[k];}};const win={showDirectoryPicker(options){calls.push(options);return next instanceof Error?Promise.reject(next):Promise.resolve(next);},showOpenFilePicker(){return Promise.resolve([chosenFile]);}};const source=Source.create({window:win,engine:Engine,storage,store:{async get(){return pair;},async set(v){pair=v;}},crypto:{randomUUID(){return '00000000-0000-4000-8000-'+String(++id).padStart(12,'0');}}});return {source,calls,get pair(){return pair;},get values(){return values;},choose(v){next=v;},file(v){chosenFile=v;},breakWrite(){writeFailure=true;},replaceHandle(v){pair={...pair,handle:v};}};}
function library(name='SOP'){const c=file('catalog.json',catalog);return {root:folder(name,{'catalog.json':c,'hello.txt':file('hello.txt','hello')}),catalog:c};}
test('directory identifiers and resource paths stay bounded and never accept filesystem or network URLs',()=>{
 const ep='sop-directory://00000000-0000-4000-8000-000000000001/catalog.json';assert.equal(Source.resolve(ep,'workflows/demo/body.json'),ep.replace('catalog.json','workflows/demo/body.json'));
 for(const bad of ['file:///tmp/catalog.json','sop-directory://other/catalog.json',ep+'?x',ep.replace('catalog.json','secret')])assert.throws(()=>Source.validateEndpoint(bad));
 for(const bad of ['../secret','/absolute','a/../b','https://example.org/file','a%2fb','a\\b'])assert.throws(()=>Source.resolve(ep,bad));
});
test('folder selection immediately opens a read-only picker and binds reading and publishing to one folder',async()=>{
 const e=env(),lib=library();e.choose(lib.root);const pending=e.source.chooseDirectory();assert.deepEqual(e.calls,[{mode:'read'}]);const chosen=await pending;assert.equal(chosen.workflowCount,1);assert.equal(e.pair.handle,lib.root);assert.equal(e.pair.record.handle,lib.root);assert.equal((await e.source.info()).endpoint,chosen.endpoint);assert.equal(await e.source.read(chosen.endpoint),catalog);assert.equal(await e.source.read(Source.resolve(chosen.endpoint,'hello.txt')),'hello');assert.deepEqual(await e.source.read(Source.resolve(chosen.endpoint,'hello.txt'),{binary:true}),Uint8Array.from(Buffer.from('hello')));
});
test('a catalog file alone never activates a library and only its matching folder can finish selection',async()=>{
 const e=env(),a=library('A'),b=library('B');e.file(a.catalog);const chosen=await e.source.chooseFile();assert.equal(chosen.handle,a.catalog);assert.equal((await e.source.info()).selected,false);e.choose(b.root);await assert.rejects(e.source.chooseDirectory({expectedFile:chosen.handle}),/不包含/);assert.equal((await e.source.info()).selected,false);e.choose(a.root);await e.source.chooseDirectory({expectedFile:chosen.handle});assert.equal((await e.source.info()).name,'A');
});
test('selection requests read permission before accessing files and denied access preserves the connection',async()=>{
 const e=env(),original=library('Original');e.choose(original.root);const previous=await e.source.chooseDirectory();
 for(const result of ['granted','denied']){
  const lib=library(result),events=[];lib.root.permission='prompt';
  lib.root.requestPermission=async options=>{events.push(['permission',options]);lib.root.permission=result;return result;};
  const getFile=lib.root.getFileHandle;lib.root.getFileHandle=async function(key){events.push(['file',key]);return getFile.call(this,key);};
  e.choose(lib.root);
  if(result==='denied'){
   await assert.rejects(e.source.chooseDirectory(),/重新授权/);assert.deepEqual(events,[['permission',{mode:'read'}]]);
   assert.equal((await e.source.info()).endpoint,previous.endpoint);
  }else{
   const selected=await e.source.chooseDirectory();assert.deepEqual(events[0],['permission',{mode:'read'}]);assert.equal(await e.source.read(selected.endpoint),catalog);
   // Restore the original connection for the denial case.
   e.choose(original.root);const restored=await e.source.chooseDirectory();previous.endpoint=restored.endpoint;
  }
 }
});
test('cancellation, malformed catalog, ambiguous libraries and mismatched files preserve the previous connection',async()=>{
 const e=env(),a=library('Original');e.choose(a.root);const chosen=await e.source.chooseDirectory();
 e.choose(Object.assign(Error('cancel'),{name:'AbortError'}));await assert.rejects(e.source.chooseDirectory(),{name:'AbortError'});
 e.choose(folder('bad',{'catalog.json':file('catalog.json','{}')}));await assert.rejects(e.source.chooseDirectory());
 e.choose(folder('parent',{SOP:library('SOP').root,sop:library('sop').root}));await assert.rejects(e.source.chooseDirectory(),/多个/);
 assert.equal((await e.source.info()).endpoint,chosen.endpoint);assert.equal(e.pair.handle,a.root);
});
test('known nested SOP directory is found without enumerating unrelated folders',async()=>{
 const e=env(),a=library();e.choose(folder('parent',{SOP:a.root,private:folder('private')}));const result=await e.source.chooseDirectory();assert.equal(result.name,'SOP');assert.equal(e.pair.handle,a.root);
});
test('case-insensitive SOP aliases identify one native library, including file-first selection',async()=>{
 for(const expectedFile of [false,true]){
  const e=env(),lib=library(),parent=folder('parent');
  parent.getDirectoryHandle=async name=>{
   if(name.toLowerCase()!=='sop')throw notFound();
   // Native APIs can return distinct handle objects for the same file entry.
   const alias={...lib.catalog,async isSameEntry(other){return other.entry===lib.catalog;},entry:lib.catalog};
   return {...lib.root,async getFileHandle(name){if(name!=='catalog.json')throw notFound();return alias;}};
  };
  e.choose(parent);const alias={...lib.catalog,entry:lib.catalog};
  const result=await e.source.chooseDirectory(expectedFile?{expectedFile:alias}:{});
  assert.equal(result.workflowCount,1);assert.equal(await e.source.read(result.endpoint),catalog);
 }
});
test('revoked permission, stale identity, oversized reads and legacy publisher changes fail closed',async()=>{
 const e=env(),a=library();e.choose(a.root);const chosen=await e.source.chooseDirectory();a.root.permission='prompt';await assert.rejects(e.source.read(chosen.endpoint),/重新授权/);a.root.permission='granted';await assert.rejects(e.source.read(Source.resolve(chosen.endpoint,'hello.txt'),{limit:2}),/上限/);await assert.rejects(e.source.read(chosen.endpoint.replace(/000001/, '000002')),/连接已变化/);e.replaceHandle(library('Other').root);await assert.rejects(e.source.info(),/连接已变化/);await assert.rejects(e.source.read(chosen.endpoint),/连接已变化/);
});
test('metadata write failure restores both the selected handle and source identity',async()=>{
 const e=env(),a=library('A'),b=library('B');e.choose(a.root);const previous=await e.source.chooseDirectory();e.choose(b.root);e.breakWrite();await assert.rejects(e.source.chooseDirectory(),/storage failed/);assert.equal((await e.source.info()).endpoint,previous.endpoint);assert.equal(e.pair.handle,a.root);
});

test('permitted Unicode filenames round-trip through an internal resource URL without escaping the chosen folder',async()=>{
 const e=env(),lib=library();const root=folder('SOP',{'catalog.json':lib.catalog,'说明 文件.json':file('说明 文件.json','{}')});e.choose(root);const chosen=await e.source.chooseDirectory();assert.equal(await e.source.read(Source.resolve(chosen.endpoint,'说明 文件.json')),'{}');
});
test('missing catalog is initialized only after write permission and can be read as an empty library',async()=>{
 const e=env(),events=[];let stored=null;
 const dir=folder('Empty');dir.requestPermission=async options=>{events.push(options.mode);return 'granted';};
 dir.getFileHandle=async(name,options)=>{
  assert.equal(name,'catalog.json');if(stored)return stored;
  if(!options?.create)throw notFound();
  let raw='';stored={...file(name,''),async getFile(){const data=Buffer.from(raw);return {size:data.length,async arrayBuffer(){return Uint8Array.from(data).buffer;}};},async createWritable(options){assert.equal(options.mode,'exclusive');let pending='';return {async write(value){pending=value;},async close(){raw=pending;},async abort(){}};}};
  return stored;
 };
 e.choose(dir);const chosen=await e.source.chooseDirectory();assert.equal(chosen.workflowCount,0);
 assert.deepEqual(events,['read','readwrite']);assert.deepEqual(JSON.parse(await e.source.read(chosen.endpoint)).workflows,[]);
 await e.source.chooseDirectory();assert.deepEqual(events,['read','readwrite','read']);
});
test('denying initialization does not create a catalog or replace the previous connection',async()=>{
 const e=env(),original=library();e.choose(original.root);const before=await e.source.chooseDirectory();
 const dir=folder('Empty');const getFile=dir.getFileHandle;
 dir.requestPermission=async({mode})=>mode==='read'?'granted':'denied';
 dir.getFileHandle=async function(name,options){assert.ok(!options?.create);return getFile.call(this,name);};
 e.choose(dir);await assert.rejects(e.source.chooseDirectory(),/允许写入/);assert.equal((await e.source.info()).endpoint,before.endpoint);
});
test('folder display settings stay local, survive reselection, and do not follow another folder',async()=>{
 const e=env(),lib=library('Actual folder');e.choose(lib.root);const first=await e.source.chooseDirectory();
 await e.source.saveAppearance({endpoint:first.endpoint,name:'  Team SOP  ',icon:'storage'});
 assert.equal((await e.source.info()).displayName,'Team SOP');assert.equal(lib.root.name,'Actual folder');assert.equal(await e.source.read(first.endpoint),catalog);
 await e.source.chooseDirectory();assert.equal((await e.source.info()).displayName,'Team SOP');assert.equal((await e.source.info()).icon,'storage');
 await assert.rejects(e.source.saveAppearance({endpoint:first.endpoint,name:'stale',icon:'folder'}),/连接已变化/);
 const current=(await e.source.info()).endpoint;
 for(const values of [{name:'x'.repeat(81),icon:'folder'},{name:'safe',icon:'javascript:bad'},{name:'bad\nname',icon:'folder'}])await assert.rejects(e.source.saveAppearance({endpoint:current,...values}),/显示设置无效/);
 e.choose(library('Other').root);await e.source.chooseDirectory();assert.equal((await e.source.info()).displayName,'');assert.equal((await e.source.info()).icon,'folder');
});
test('internal identifiers reject credentials, queries and encoded traversal before reading files',async()=>{
 const e=env(),lib=library();e.choose(lib.root);const {endpoint}=await e.source.chooseDirectory();
 for(const bad of [endpoint+'?x',endpoint+'#x',endpoint.replace('://','://user:pass@'),endpoint.replace('/catalog.json','/%2e%2e/secret'),endpoint.replace('/catalog.json','/%2Fsecret'),endpoint.replace('/catalog.json','/%'),endpoint.replace('/catalog.json','/bad%00name')])await assert.rejects(e.source.read(bad));
 assert.equal(await e.source.read(endpoint),catalog);
});
