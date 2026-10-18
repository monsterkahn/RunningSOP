'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto;
const Publisher = require('../extension/nas-publisher.js');
const Engine = require('../extension/catalog-engine.js');

function fileHandle(initial = '', onClose) {
  let value = initial;
  return {
    async getFile() { return { size: typeof value==='string'?new TextEncoder().encode(value).length:value.length, text: async () => typeof value==='string'?value:new TextDecoder().decode(value), arrayBuffer: async () => typeof value==='string'?new TextEncoder().encode(value).buffer:value.slice().buffer }; },
    async createWritable() {
      let next = '';
      return {
        async write(raw) { next = typeof raw === 'string' || raw instanceof Uint8Array ? raw : await raw.text(); },
        async close() { value = next; if (onClose) await onClose(value); }
      };
    },
    get value() { return value; },
    set value(next) { value = next; }
  };
}
function directory(name = '') {
  const dirs = new Map(), files = new Map();
  return {
    name,
    dirs,
    files,
    async getDirectoryHandle(key, options = {}) {
      if (!dirs.has(key)) {
        if (!options.create) throw Object.assign(new Error('missing directory'), { name: 'NotFoundError' });
        dirs.set(key, directory(key));
      }
      return dirs.get(key);
    },
    async getFileHandle(key, options = {}) {
      if (!files.has(key)) {
        if (!options.create) throw Object.assign(new Error('missing file'), { name: 'NotFoundError' });
        files.set(key, fileHandle());
      }
      return files.get(key);
    },
    async queryPermission() { return 'granted'; }
  };
}
async function putFile(root, path, raw) {
  const parts = path.split('/'); let dir = root;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
  dir.files.set(parts.at(-1), fileHandle(raw));
}
function workflow(id, viewer, file, sha256, host) {
  return { id, title: id, summary: '', status: 'published', viewer, file, sha256,
    rules: [{ hosts: [host], priority: 10, label: id }] };
}
const guide = (id = 'new-flow', workUrl = 'https://studio.example.com/upload/video') => ({
  format: 'runtime-sop-guide', schemaVersion: 1, workflowId: id, title: '新指南', version: '1.0.0', notice: '供内部使用',
  steps: [{ id: 'step-one', title: '上传', where: 'Studio', actions: ['检查页面'], expected: '页面就绪', trouble: '', acceptance: ['由操作者确认'], workUrl }]
});
async function fixture({ catalogRaw, contents, onCatalogClose } = {}) {
  const root = directory('sop');
  const catalogHandle = fileHandle(catalogRaw || JSON.stringify({ format: 'runtime-sop-catalog', schemaVersion: 1, version: '1.0.0', workflows: [] }), onCatalogClose);
  root.files.set('catalog.json', catalogHandle);
  for (const [path, raw] of Object.entries(contents || {})) await putFile(root, path, raw);
  const publisher = Publisher.createPublisher({ directoryHandle: root, engine: Engine, crypto,
    remoteContent: { verify: async () => ({ workflowId: 'youtube-upload' }) } });
  return { root, publisher, catalogHandle };
}
async function seeded() {
  const ytRaw = '{"workflowId":"youtube-upload"}';
  const ytHash = await Publisher.sha256(ytRaw, crypto);
  const guideRaw = JSON.stringify({ format: 'runtime-sop-guide', schemaVersion: 1, workflowId: 'existing-flow', title: 'Existing', version: '1', notice: '', steps: [{ id: 'a', title: 'A', where: 'B', actions: ['C'], expected: 'D', trouble: '', acceptance: ['E'] }] });
  const guideHash = await Publisher.sha256(guideRaw, crypto);
  const catalog = Engine.validateCatalog({ format: 'runtime-sop-catalog', schemaVersion: 1, version: '1.0.0', workflows: [
    workflow('youtube-upload', 'youtube', `catalog-releases/${ytHash}.json`, ytHash, 'studio.youtube.com'),
    workflow('existing-flow', 'guide', `catalog-releases/${guideHash}.json`, guideHash, 'example.com')
  ] });
  return { catalog, catalogRaw: JSON.stringify(catalog), contents: { [`catalog-releases/${ytHash}.json`]: ytRaw, [`catalog-releases/${guideHash}.json`]: guideRaw } };
}

test('publishes a new exact-host/path guide while preserving unrelated catalog entries and payloads', async () => {
  const seed = await seeded(), { publisher, root } = await fixture(seed);
  const result = await publisher.publish(guide());
  const catalog = Engine.validateCatalog(JSON.parse(root.files.get('catalog.json').value));
  const added = catalog.workflows.find(item => item.id === 'new-flow');
  assert.equal(result.workflowId, 'new-flow');
  const history=JSON.parse(root.dirs.get('publication-history').dirs.get('new-flow').files.get(result.sha256+'.json').value);assert.equal(history.previousSha256,null);assert.equal(history.sha256,result.sha256);assert.equal(result.historyWarning,'');
  assert.equal(added.viewer, 'guide');
  assert.equal(added.status, 'published');
  assert.deepEqual(added.rules, [{ hosts: ['studio.example.com'], origins:['https://studio.example.com'], pathEquals: ['/upload/video'], priority: 20, label: '工作地址' }]);
  assert.deepEqual(catalog.workflows.filter(item => item.id !== 'new-flow'), seed.catalog.workflows);
  for (const [path, raw] of Object.entries(seed.contents)) assert.equal(await (await (await root.getDirectoryHandle('catalog-releases')).getFileHandle(path.split('/').at(-1))).getFile().then(f => f.text()), raw);
  const parts=result.file.split('/');let docDir=root;for(const part of parts.slice(0,-1))docDir=await docDir.getDirectoryHandle(part);
  const transport=JSON.parse(await (await docDir.getFileHandle(parts.at(-1))).getFile().then(f=>f.text()));
  assert.equal(transport.format,'runtime-sop-document');
  assert.deepEqual(transport.content,Engine.validateGuide(guide()));
});

test('publishes exact file URL rules including encoded spaces, query and hash',async()=>{
  const {publisher,root}=await fixture(await seeded());
  const target='file:///test/user/My%20Folder/studio%20page.html?tab=1#upload';
  const input=guide('local-file-flow',target);
  await publisher.publish(input);
  const catalog=Engine.validateCatalog(JSON.parse(root.files.get('catalog.json').value));
  const rule=catalog.workflows.find(w=>w.id==='local-file-flow').rules[0];
  assert.deepEqual(rule.hosts,[]);
  assert.deepEqual(rule.fileUrls,[target]);
  assert.equal(Object.hasOwn(rule,'origins'),false);
  assert.equal(Object.hasOwn(rule,'pathEquals'),false);
  assert.equal(Engine.matchPage(target,catalog).state,'matched');
  assert.equal(Engine.matchPage(target.replace('tab=1','tab=2'),catalog).state,'none');
  assert.equal(Engine.matchPage('file:///test/user/elsewhere.html',catalog).state,'none');
});

test('rejects unsafe file work URLs before changing the catalog',async()=>{
  const {publisher,root}=await fixture(await seeded()),before=root.files.get('catalog.json').value;
  for(const value of ['file://user:pass@nas/private.html','file:///test/user/a b.html','javascript:alert(1)','chrome://settings']) {
    const input=guide('unsafe-url');input.steps[0].workUrl=value;
    await assert.rejects(publisher.publish(input),/工作网址|本机/);
    assert.equal(root.files.get('catalog.json').value,before);
  }
});

test('updates an existing guide identity but refuses to change a different viewer identity', async () => {
  const seed = await seeded();
  const existing = seed.catalog.workflows.find(item => item.id === 'existing-flow');
  const root = directory('sop');
  root.files.set('catalog.json', fileHandle(seed.catalogRaw));
  for (const [path, raw] of Object.entries(seed.contents)) await putFile(root, path, raw);
  const pub = Publisher.createPublisher({ directoryHandle: root, engine: Engine, crypto, remoteContent: { verify: async () => ({}) } });
  await assert.rejects(pub.publish(guide('youtube-upload')), /不能覆盖 YouTube/);
  await pub.publish(guide('existing-flow'), { expectedSha: existing.sha256 });
  const catalog = JSON.parse(root.files.get('catalog.json').value);
  assert.equal(catalog.workflows.filter(item => item.id === existing.id).length, 1);
});

test('publishes image bytes separately by content hash and stores an immutable envelope version', async () => {
  const {publisher,root}=await fixture(await seeded());
  const input=guide('with-image');input.steps[0].image='data:image/jpeg;base64,/9j/AAECAwQ=';
  input.steps[0].imageAt='2026-10-14T00:00:00Z';
  const result=await publisher.publish(input);
  const parts=result.file.split('/');let dir=root;for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part);
  const doc=JSON.parse(await (await dir.getFileHandle(parts.at(-1))).getFile().then(f=>f.text()));
  assert.equal(doc.content.steps[0].image,null);
  assert.equal(doc.assets.length,1);
  const imageParts=doc.assets[0].file.split('/');let imageDir=root;for(const part of imageParts.slice(0,-1))imageDir=await imageDir.getDirectoryHandle(part);
  const stored=await (await imageDir.getFileHandle(imageParts.at(-1))).getFile();
  assert.deepEqual(new Uint8Array(await stored.arrayBuffer()),Uint8Array.from([255,216,255,0,1,2,3,4]));
  assert.match(result.file,new RegExp(`^workflows/with-image/versions/${result.sha256}\\.json$`));
});

test('does not read unrelated payloads; refuses missing exact work URLs without changing catalog', async () => {
  const seed = await seeded();
  const broken = { ...seed.contents, 'catalog-releases/bad.json': 'tampered' };
  const catalog = JSON.parse(seed.catalogRaw);
  catalog.workflows[0].file = 'catalog-releases/bad.json';
  const { publisher, root } = await fixture({ catalogRaw: JSON.stringify(catalog), contents: broken });
  const before = root.files.get('catalog.json').value;
  await publisher.publish(guide());
  assert.notEqual(root.files.get('catalog.json').value, before);
  const clean = await fixture(await seeded());
  const missingUrl = guide('no-url'); delete missingUrl.steps[0].workUrl;
  await assert.rejects(clean.publisher.publish(missingUrl), /没有任何步骤工作网址/);
  assert.equal(clean.root.files.get('catalog.json').value.includes('no-url'), false);
});

test('detects catalog changes after immutable write and does not replace concurrent catalog data', async () => {
  let root;
  const concurrent = JSON.stringify({ concurrent: true });
  const seed = await seeded();
  const catalogFile = fileHandle(seed.catalogRaw, async () => { if (root && root.files.has('catalog-releases')) root.files.get('catalog.json').value = concurrent; });
  const setup = await fixture({ ...seed }); root = setup.root;
  setup.root.files.set('catalog.json', catalogFile);
  // Mutate the catalog as the immutable output is committed.
  function hook(dir) {
    if(dir._hooked)return;dir._hooked=true;
    const getDir=dir.getDirectoryHandle.bind(dir);
    dir.getDirectoryHandle=async(...args)=>{const child=await getDir(...args);hook(child);return child;};
    const getFile=dir.getFileHandle.bind(dir);
    dir.getFileHandle=async(name,opts)=>{const h=await getFile(name,opts);if(opts?.create){const create=h.createWritable.bind(h);h.createWritable=async(...a)=>{const w=await create(...a),close=w.close;w.close=async()=>{await close();catalogFile.value=concurrent;};return w;};}return h;};
  }
  hook(root);
  const pub = Publisher.createPublisher({ directoryHandle: root, engine: Engine, crypto, remoteContent: { verify: async () => ({}) } });
  await assert.rejects(pub.publish(guide()), /目录在发布期间发生变化/);
  assert.equal(root.files.get('catalog.json').value, concurrent);
});

test('rejects aggregate content beyond 4 MB before writing any release', async () => {
  const { publisher, root } = await fixture(await seeded());
  const huge = guide('huge'); huge.steps[0].actions = ['x'.repeat(4 * 1024 * 1024)];
  const before = root.files.get('catalog.json').value;
  const releaseDir = await root.getDirectoryHandle('catalog-releases');
  const fileCount = releaseDir.files.size;
  await assert.rejects(publisher.publish(huge), /超过 4 MB/);
  assert.equal(root.files.get('catalog.json').value, before);
  assert.equal(releaseDir.files.size, fileCount);
});

test('rejects oversized catalog and existing document before allocating their contents',async()=>{
 for(const target of ['catalog','document']){
  const seed=await seeded(),{publisher,root,catalogHandle}=await fixture(seed),before=catalogHandle.value;
  const existing=seed.catalog.workflows.find(item=>item.id==='existing-flow');
  const handle=target==='catalog'?catalogHandle:root.dirs.get('catalog-releases').files.get(existing.file.split('/').at(-1));
  let reads=0;handle.getFile=async()=>({size:(target==='catalog'?512*1024:Publisher.MAX_TOTAL)+1,async arrayBuffer(){reads++;throw Error('must not allocate');},async text(){reads++;throw Error('must not allocate');}});
  await assert.rejects(publisher.publish(guide('existing-flow'),{expectedSha:existing.sha256}),/读取上限/);
  assert.equal(reads,0);assert.equal(catalogHandle.value,before);assert.equal(root.dirs.has('workflows'),false);
 }
});

test('checks actual catalog bytes even when reported size is smaller',async()=>{
 const {publisher,root,catalogHandle}=await fixture(),before=catalogHandle.value;
 catalogHandle.getFile=async()=>({size:1,async arrayBuffer(){return new Uint8Array(512*1024+1).buffer;}});
 await assert.rejects(publisher.publish(guide()),/读取上限/);
 assert.equal(catalogHandle.value,before);assert.equal(root.dirs.size,0);
});

test('rejects oversized existing image before allocating bytes or updating catalog',async()=>{
 const {publisher,root,catalogHandle}=await fixture();const input=guide('bounded-image');
 input.steps[0].image='data:image/jpeg;base64,/9j/AAECAwQ=';input.steps[0].imageAt='2026-10-14T00:00:00Z';
 const first=await publisher.publish(input),before=catalogHandle.value;
 const imageDir=root.dirs.get('workflows').dirs.get(input.workflowId).dirs.get('images');
 const handle=[...imageDir.files.values()][0];let reads=0;
 handle.getFile=async()=>({size:Publisher.MAX_TOTAL+1,async arrayBuffer(){reads++;throw Error('must not allocate');}});
 input.title='Changed title';await assert.rejects(publisher.publish(input,{expectedSha:first.sha256}),/读取上限/);
 assert.equal(reads,0);assert.equal(catalogHandle.value,before);
});

test('rejects oversized pre-existing immutable output before reading or changing the catalog',async()=>{
 const {publisher,root,catalogHandle}=await fixture(),before=catalogHandle.value,input=guide('hostile-output');
 const packed=await require('../extension/sop-assets.js').pack(Engine.validateGuide(input),{id:input.workflowId,viewer:'guide'},crypto);
 const hash=await Publisher.sha256(JSON.stringify(packed.document),crypto);
 await putFile(root,`workflows/${input.workflowId}/versions/${hash}.json`,'');
 const handle=root.dirs.get('workflows').dirs.get(input.workflowId).dirs.get('versions').files.get(hash+'.json');
 let reads=0;handle.getFile=async()=>({size:Publisher.MAX_TOTAL+1,async arrayBuffer(){reads++;throw Error('must not allocate');},async text(){reads++;throw Error('must not allocate');}});
 await assert.rejects(publisher.publish(input),/读取上限/);
 assert.equal(reads,0);assert.equal(catalogHandle.value,before);
});

test('requests permission only during publish and exposes missing picker fallback', async () => {
  let requested = 0;
  const seed = await seeded(), root = directory('sop');
  root.files.set('catalog.json', fileHandle(seed.catalogRaw));
  for (const [path, raw] of Object.entries(seed.contents)) await putFile(root, path, raw);
  root.queryPermission = async () => 'prompt';
  root.requestPermission = async () => { requested++; return 'denied'; };
  const pub = Publisher.createPublisher({ directoryHandle: root, engine: Engine, crypto });
  assert.equal((await pub.info()).permission, 'prompt');
  assert.equal(requested, 0);
  await assert.rejects(pub.publish(guide()), /没有获得 存储器/);
  assert.equal(requested, 1);
  const unsupported = Publisher.createPublisher({ window: {}, indexedDB: null });
  await assert.rejects(unsupported.chooseDirectory(), /JSON 导出/);
});

test('two simultaneous publications on one publisher are serialized and retain both catalog entries',async()=>{const seed=await seeded(),{publisher,root}=await fixture(seed);await Promise.all([publisher.publish(guide('parallel-one')),publisher.publish(guide('parallel-two'))]);const catalog=JSON.parse(await (await root.getFileHandle('catalog.json')).getFile().then(f=>f.text()));assert(catalog.workflows.some(w=>w.id==='parallel-one'));assert(catalog.workflows.some(w=>w.id==='parallel-two'));assert(catalog.workflows.some(w=>w.id==='youtube-upload'));});

test('can update an already packed guide and reuses verified image assets',async()=>{
 const {publisher,root}=await fixture(await seeded());
 const input=guide('packed-update');
 input.steps[0].image='data:image/jpeg;base64,/9j/AAECAwQ=';
 input.steps[0].imageAt='2026-10-14T00:00:00Z';
 const first=await publisher.publish(input);
 input.title='Updated title';
 const second=await publisher.publish(input,{expectedSha:first.sha256});
 assert.notEqual(second.sha256,first.sha256);
 const entry=JSON.parse(root.files.get('catalog.json').value).workflows.find(w=>w.id===input.workflowId);
 assert.equal(entry.title,'Updated title');
});

test('refuses to point catalog at immutable content that fails readback',async()=>{
 const {publisher,root,catalogHandle}=await fixture(await seeded());
 const before=catalogHandle.value;
 function corrupt(dir){
  if(dir.corruptHook)return;dir.corruptHook=true;
  const getDir=dir.getDirectoryHandle.bind(dir),getFile=dir.getFileHandle.bind(dir);
  dir.getDirectoryHandle=async(...args)=>{const child=await getDir(...args);corrupt(child);return child;};
  dir.getFileHandle=async(name,opts)=>{const file=await getFile(name,opts);if(opts?.create) {const create=file.createWritable.bind(file);file.createWritable=async()=>{const writer=await create(),close=writer.close;writer.close=async()=>{await close();file.value='truncated';};return writer;};}return file;};
 }
 corrupt(root);
 await assert.rejects(publisher.publish(guide('bad-write')),/回读不一致/);
 assert.equal(catalogHandle.value,before);
});
