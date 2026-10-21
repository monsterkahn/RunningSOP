'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const {webcrypto, createHash} = require('node:crypto');
const Installer = require('../extension/storage-page-installer.js');
const names = ['index.html', 'relationships.html'];
function bundle(contents = ['<html>synthetic overview</html>', '<html>synthetic relationships</html>']) {
  return {format:'runtime-sop-storage-pages', schemaVersion:1, version:'2.0.0', files:names.map((name, i) => ({name, content:contents[i], sha256:createHash('sha256').update(contents[i]).digest('hex')}))};
}
function fixture(initial = {}) {
  const entries = new Map(Object.entries(initial).map(([name,text]) => [name,{bytes:Buffer.from(text),time:1}]));
  const events = []; let hook = async () => {}, permission = 'granted';
  const event = async (type, name) => {events.push([type,name]);await hook(type,name);};
  const handle = {
    async queryPermission({mode}) {await event('permission',mode);return permission;},
    async requestPermission() {throw Error('Must never request permission');},
    async getFileHandle(name, options) {
      await event(options?.create ? 'create' : 'lookup',name);
      if (!entries.has(name)) {if(!options?.create) throw Object.assign(Error('Missing'),{name:'NotFoundError'});entries.set(name,{bytes:Buffer.alloc(0),time:1});}
      const entry = entries.get(name);
      return {
        async isSameEntry(other) {return other.identity === entry;}, identity:entry,
        async getFile() {await event('read',name);const bytes=Buffer.from(entry.bytes);return {size:bytes.length,lastModified:entry.time,async arrayBuffer(){await event('bytes',name);return Uint8Array.from(bytes).buffer;}};},
        async createWritable(options) {
          assert.deepEqual(options,{keepExistingData:true,mode:'exclusive'});await event('open',name);let pending;
          return {async write(bytes){await event('write',name);pending=Buffer.from(bytes);},async close(){await event('close',name);entry.bytes=pending;entry.time++;await event('committed',name);},async abort(){await event('abort',name);}};
        }
      };
    }
  };
  return {handle,entries,events,api:Installer.create({crypto:webcrypto,locks:null}),setHook(fn){hook=fn;},setPermission(value){permission=value;},text(name){return entries.get(name)?.bytes.toString();}};
}
const writes = f => f.events.filter(([type]) => ['create','open','write','close'].includes(type));
test('missing pages install verified bytes; duplicate calls and independent instances serialize',async()=>{
  const f=fixture(), data=bundle(), api2=Installer.create({crypto:webcrypto,locks:null});
  const results=await Promise.all([f.api.install({handle:f.handle,bundle:data}),api2.install({handle:f.handle,bundle:data})]);
  assert.deepEqual(results[0],{installed:names,preserved:[],present:[]});assert.deepEqual(results[1],{installed:[],preserved:[],present:names});
  for(const file of data.files) assert.equal(f.text(file.name),file.content);
  assert.equal(f.events.filter(([type])=>type==='close').length,2);
  assert.ok(f.events.every(([,name])=>names.includes(name)||['read','readwrite'].includes(name)));
});
test('existing customized, old, empty and byte-identical pages are always kept',async()=>{
  for(const text of ['manual customization','old version','']) {
    const f=fixture({'index.html':text,'relationships.html':bundle().files[1].content});
    assert.deepEqual(await f.api.install({handle:f.handle,bundle:bundle()}),{installed:[],preserved:['index.html'],present:['relationships.html']});
    assert.equal(f.text('index.html'),text);assert.deepEqual(writes(f),[]);
  }
});
test('permission denied or prompt never requests access or creates files',async()=>{
  for(const permission of ['denied','prompt']) {const f=fixture();f.setPermission(permission);await assert.rejects(f.api.install({handle:f.handle,bundle:bundle()}),{code:'permission_denied'});assert.deepEqual(writes(f),[]);}
  const f=fixture();f.setHook(async(type,mode)=>{if(type==='permission'&&mode==='readwrite')f.setPermission('denied');});
  await assert.rejects(f.api.install({handle:f.handle,bundle:bundle()}),{code:'permission_denied'});assert.deepEqual(writes(f),[]);
});
test('strict bundle validation rejects bad hashes, names, versions, fields and accessors before touching directory',async()=>{
  const cases=[];
  for(const mutate of [b=>b.files[0].sha256='0'.repeat(64),b=>b.files[0].name='../index.html',b=>b.files[1].name='index.html',b=>b.version='1.4.0',b=>b.unexpected=true,b=>b.files.extra=true,b=>Object.defineProperty(b.files,'0',{get(){throw Error('Array accessor executed');}}),b=>delete b.files[0],b=>b.files[0].unknown=true,b=>b.files[0].sha256='A'.repeat(64),b=>Object.setPrototypeOf(b,{polluted:true}),b=>Object.defineProperty(b.files[0],'content',{get(){throw Error('Accessor executed');}}),b=>Object.defineProperty(b,'hidden',{value:true})]) {const b=bundle();mutate(b);cases.push(b);}
  for(const data of cases){const f=fixture();await assert.rejects(f.api.install({handle:f.handle,bundle:data}));assert.deepEqual(f.events,[]);}
});
test('limits apply to UTF-8 bytes and aggregate size, before hashing or filesystem access',async()=>{
  for(const contents of [['x'.repeat(2*1024*1024+1),'x'],['界'.repeat(800000),'x'],['x'.repeat(1700000),'y'.repeat(1700000)]]){
    const f=fixture();await assert.rejects(f.api.install({handle:f.handle,bundle:bundle(contents)}),{code:'bundle_too_large'});assert.deepEqual(f.events,[]);
  }
});
test('async guard prevents creation, staged writing and commit after source changes',async()=>{
  for(const stopAt of ['initial','lookup','open','write']) {
    const f=fixture();let active=stopAt!=='initial';
    f.setHook(async type=>{if(type===stopAt)active=false;});
    await assert.rejects(f.api.install({handle:f.handle,bundle:bundle(),guard:async()=>active}),{code:'stale_operation'});
    assert.equal(f.events.some(([type])=>type==='close'),false);
    if(['initial','lookup'].includes(stopAt)) assert.deepEqual(writes(f),[]);
    if(['open','write'].includes(stopAt))assert.equal(f.events.some(([type])=>type==='abort'),true);
  }
});
test('permission revocation after stream opens aborts without commit',async()=>{
  const f=fixture();f.setHook(async type=>{if(type==='open')f.setPermission('denied');});
  await assert.rejects(f.api.install({handle:f.handle,bundle:bundle()}),{code:'permission_denied'});
  assert.equal(f.events.some(([type])=>type==='close'),false);assert.equal(f.events.some(([type])=>type==='abort'),true);
});
test('racing creation preserves observed existing content',async()=>{
  const f=fixture();f.setHook(async(type,name)=>{if(type==='create')f.entries.set(name,{bytes:Buffer.from('another client'),time:2});});
  assert.deepEqual(await f.api.install({handle:f.handle,bundle:bundle()}),{installed:[],preserved:names,present:[]});
  assert.equal(f.events.some(([type])=>type==='open'),false);
});
test('racing edits or replacement during staged write abort and preserve external content',async()=>{
  for(const replace of [false,true]) {
    const f=fixture();f.setHook(async(type,name)=>{if(type==='write'){if(replace)f.entries.set(name,{bytes:Buffer.from('external replacement'),time:2});else{const entry=f.entries.get(name);entry.bytes=Buffer.from('external edit');entry.time++;}}});
    await assert.rejects(f.api.install({handle:f.handle,bundle:bundle()}),{code:'file_changed'});
    assert.equal(f.text('index.html'),replace?'external replacement':'external edit');assert.equal(f.events.some(([type])=>type==='close'),false);
  }
});
test('readback detects corruption and retains partial successes without touching existing pages',async()=>{
  const f=fixture();f.setHook(async(type,name)=>{if(type==='committed'&&name==='relationships.html')f.entries.get(name).bytes=Buffer.from('corrupted');});
  await assert.rejects(f.api.install({handle:f.handle,bundle:bundle()}),error=>{assert.equal(error.code,'readback_failed');assert.deepEqual(error.result.installed,['index.html']);return true;});
  assert.equal(f.text('index.html'),bundle().files[0].content);
  const result=await f.api.install({handle:f.handle,bundle:bundle()});assert.deepEqual(result,{installed:[],preserved:['relationships.html'],present:['index.html']});
});
test('Web Locks use an origin exclusive lock, and lock failure never writes',async()=>{
  const f=fixture();let calls=0;
  const api=Installer.create({crypto:webcrypto,locks:{async request(name,options,action){calls++;assert.equal(name,'runtime-sop-storage-page-install-v1');assert.deepEqual(options,{mode:'exclusive'});return action();}}});
  await api.install({handle:f.handle,bundle:bundle()});assert.equal(calls,1);
  const denied=fixture(), bad=Installer.create({crypto:webcrypto,locks:{async request(){throw Error('lock failed');}}});
  await assert.rejects(bad.install({handle:denied.handle,bundle:bundle()}),/lock failed/);assert.deepEqual(denied.events,[]);
});
test('validated bytes are snapshotted before hashing and unaffected by caller mutations',async()=>{
  const data=bundle(), f=fixture();let first=true;
  const api=Installer.create({locks:null,crypto:{subtle:{async digest(...args){if(first){first=false;data.files[0].content='mutated';data.files[1].name='sop.json';}return webcrypto.subtle.digest(...args);}}}});
  await api.install({handle:f.handle,bundle:data});assert.equal(f.text('index.html'),bundle().files[0].content);assert.equal(f.entries.has('sop.json'),false);
});

test('writer failures abort staged data, preserve existing pages and expose partial results',async()=>{
  const f=fixture({'index.html':'manual'});f.setHook(async type=>{if(type==='write')throw Error('Synthetic write error');});
  await assert.rejects(f.api.install({handle:f.handle,bundle:bundle()}),error=>{assert.match(error.message,/Synthetic write error/);assert.deepEqual(error.result,{installed:[],preserved:['index.html'],present:[]});return true;});
  assert.equal(f.text('index.html'),'manual');assert.equal(f.events.some(([type])=>type==='close'),false);assert.equal(f.events.some(([type])=>type==='abort'),true);
});
test('changed empty-file timestamp is also a conflict, and exclusive-open failures never retry',async()=>{
  const changed=fixture();changed.setHook(async(type,name)=>{if(type==='write')changed.entries.get(name).time++;});
  await assert.rejects(changed.api.install({handle:changed.handle,bundle:bundle()}),{code:'file_changed'});assert.equal(changed.events.some(([type])=>type==='close'),false);
  const locked=fixture();locked.setHook(async type=>{if(type==='open')throw Object.assign(Error('Already locked'),{name:'NoModificationAllowedError'});});
  await assert.rejects(locked.api.install({handle:locked.handle,bundle:bundle()}),{name:'NoModificationAllowedError'});assert.equal(locked.events.filter(([type])=>type==='open').length,1);assert.equal(locked.events.some(([type])=>type==='write'),false);
});
