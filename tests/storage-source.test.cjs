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
test('revoked permission, stale identity, oversized reads and legacy publisher changes fail closed',async()=>{
 const e=env(),a=library();e.choose(a.root);const chosen=await e.source.chooseDirectory();a.root.permission='prompt';await assert.rejects(e.source.read(chosen.endpoint),/重新授权/);a.root.permission='granted';await assert.rejects(e.source.read(Source.resolve(chosen.endpoint,'hello.txt'),{limit:2}),/上限/);await assert.rejects(e.source.read(chosen.endpoint.replace(/000001/, '000002')),/连接已变化/);e.replaceHandle(library('Other').root);await assert.rejects(e.source.info(),/连接已变化/);await assert.rejects(e.source.read(chosen.endpoint),/连接已变化/);
});
test('metadata write failure restores both the selected handle and source identity',async()=>{
 const e=env(),a=library('A'),b=library('B');e.choose(a.root);const previous=await e.source.chooseDirectory();e.choose(b.root);e.breakWrite();await assert.rejects(e.source.chooseDirectory(),/storage failed/);assert.equal((await e.source.info()).endpoint,previous.endpoint);assert.equal(e.pair.handle,a.root);
});

test('permitted Unicode filenames round-trip through an internal resource URL without escaping the chosen folder',async()=>{
 const e=env(),lib=library();const root=folder('SOP',{'catalog.json':lib.catalog,'说明 文件.json':file('说明 文件.json','{}')});e.choose(root);const chosen=await e.source.chooseDirectory();assert.equal(await e.source.read(Source.resolve(chosen.endpoint,'说明 文件.json')),'{}');
});
