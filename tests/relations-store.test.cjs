'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const R = require('../extension/relations-engine.js');
const Store = require('../extension/relations-store.js');
const advance = (data = R.empty(), name = 'Synthetic relationships') => ({...data, name, revision: data.revision + 1, updatedAt: '2026-10-21T00:00:00.000Z'});
const raw = value => JSON.stringify(value, null, 2) + '\n';
const absent = () => Object.assign(Error('missing'), {name: 'NotFoundError'});
class MemoryDir {
  constructor(name = 'root') { this.name = name; this.files = new Map(); this.dirs = new Map(); this.events = []; this.mode = 'granted'; this.hook = async () => {}; }
  async event(action, name, extra = {}) { const event = {action, name, dir: this, ...extra}; this.events.push(event); await this.hook(event); }
  async queryPermission({mode}) { await this.event('permission', mode); return this.mode; }
  async requestPermission() { throw Error('Store must never request permission'); }
  async getDirectoryHandle(name, {create} = {}) {
    await this.event('directory', name, {create});
    if (!this.dirs.has(name)) { if (!create) throw absent(); this.dirs.set(name, new MemoryDir(name)); }
    return this.dirs.get(name);
  }
  async getFileHandle(name, {create} = {}) {
    await this.event('handle', name, {create});
    if (!this.files.has(name)) { if (!create) throw absent(); this.files.set(name, ''); }
    const dir = this;
    return {
      async getFile() {
        await dir.event('file', name);
        const value = dir.files.get(name);
        return {size: Buffer.byteLength(value), async text() { await dir.event('text', name); return value; }};
      },
      async createWritable() {
        await dir.event('writer', name);
        let draft = '';
        return {
          async write(value) { draft = String(value); await dir.event('write', name); },
          async close() { dir.files.set(name, draft); await dir.event('close', name); },
          async abort() { await dir.event('abort', name); }
        };
      }
    };
  }
}
const writes = dir => dir.events.filter(event => event.create || ['writer', 'write', 'close'].includes(event.action));

test('relations reads remain read only and missing files yield empty without implicit creation', async () => {
  const dir = new MemoryDir();
  assert.deepEqual(await Store.read(dir), R.empty());
  assert.equal(dir.files.size, 0); assert.equal(dir.dirs.size, 0); assert.equal(writes(dir).length, 0);
  assert.equal(Store.FILE, 'relations.json');
  dir.mode = 'prompt'; await assert.rejects(Store.read(dir), /允许读取/);
  await assert.rejects(Store.save(dir, advance(), 0), /没有自动申请权限/);
  assert.equal(dir.files.size, 0);
});

test('relations refuse corrupt and oversized main files before text or writes', async () => {
  for (const value of ['{invalid', raw({...R.empty(), extra: true}), '', 'x'.repeat(R.MAX_BYTES + 1)]) {
    const dir = new MemoryDir(); dir.files.set(Store.FILE, value);
    await assert.rejects(Store.read(dir));
    await assert.rejects(Store.save(dir, advance(), 0));
    assert.equal(dir.files.get(Store.FILE), value); assert.equal(writes(dir).length, 0);
    if (value.length > R.MAX_BYTES) assert.equal(dir.events.filter(event => event.action === 'text').length, 0);
  }
});

test('relations save verifies writes and keeps immutable revision backups separate from SOP files', async () => {
  const dir = new MemoryDir(); dir.files.set('workflow.json', '{"synthetic":"untouched"}');
  const first = await Store.save(dir, advance(), 0);
  assert.equal(first.revision, 1); assert.equal(dir.dirs.size, 0);
  const second = await Store.save(dir, advance(first, 'Changed'), 1);
  const history = dir.dirs.get('relation-history');
  assert.equal(history.files.get('revision-0000000001.json'), raw(first));
  assert.deepEqual(await Store.read(dir), second);
  assert.equal(dir.files.get('workflow.json'), '{"synthetic":"untouched"}');
  await assert.rejects(Store.save(dir, advance(second), 1), /其他窗口/);
  await assert.rejects(Store.save(dir, {...second, name: 'No revision increase'}, 2), /增加 1/);
  await assert.rejects(Store.save(dir, advance(second), -1), /原修订号/);
  // A present revision-zero document is still a real file and deserves a backup.
  const existing = new MemoryDir(); existing.files.set(Store.FILE, raw(R.empty()));
  await Store.save(existing, advance(), 0);
  assert.equal(existing.dirs.get('relation-history').files.get('revision-0000000000.json'), raw(R.empty()));
});

test('relations never overwrite conflicting or oversized existing history', async () => {
  for (const conflict of ['different history', 'x'.repeat(R.MAX_BYTES + 1)]) {
    const dir = new MemoryDir(), baseline = await Store.save(dir, advance(), 0), before = dir.files.get(Store.FILE);
    const history = new MemoryDir('relation-history'); history.files.set('revision-0000000001.json', conflict); dir.dirs.set('relation-history', history);
    await assert.rejects(Store.save(dir, advance(baseline), 1), /历史备份|512 KiB/);
    assert.equal(dir.files.get(Store.FILE), before); assert.equal(history.files.get('revision-0000000001.json'), conflict);
    assert.equal(writes(history).length, 0);
    if (conflict.length > R.MAX_BYTES) assert.equal(history.events.filter(event => event.action === 'text').length, 0);
  }
});

test('relations compare full second read including same-revision edits and file appearance', async () => {
  const dir = new MemoryDir(), baseline = await Store.save(dir, advance(), 0);
  const concurrent = {...baseline, name: 'Concurrent same-revision update'};
  dir.hook = async event => {
    if (event.action === 'directory') {
      const history = new MemoryDir('relation-history'); dir.dirs.set('relation-history', history);
      history.hook = async value => { if (value.action === 'close') dir.files.set(Store.FILE, raw(concurrent)); };
    }
  };
  await assert.rejects(Store.save(dir, advance(baseline), 1), /保存过程中变化/);
  assert.equal(dir.files.get(Store.FILE), raw(concurrent));
  const appeared = new MemoryDir(); let reads = 0;
  appeared.hook = async event => { if (event.action === 'handle' && !event.create && ++reads === 2) appeared.files.set(Store.FILE, raw(R.empty())); };
  await assert.rejects(Store.save(appeared, advance(), 0), /保存过程中变化/);
  assert.equal(appeared.files.get(Store.FILE), raw(R.empty()));
});

test('relations report failed backup or main readback and abort failed writes', async () => {
  const dir = new MemoryDir(), baseline = await Store.save(dir, advance(), 0), before = dir.files.get(Store.FILE);
  dir.hook = async event => {
    if (event.action === 'directory') {
      const history = new MemoryDir('relation-history'); dir.dirs.set('relation-history', history);
      history.hook = async value => { if (value.action === 'close') history.files.set(value.name, 'corrupt backup'); };
    }
  };
  await assert.rejects(Store.save(dir, advance(baseline), 1), /备份回读/);
  assert.equal(dir.files.get(Store.FILE), before);
  const corrupted = new MemoryDir();
  corrupted.hook = async event => { if (event.action === 'close') corrupted.files.set(Store.FILE, raw({...advance(), name: 'Unexpected readback'})); };
  await assert.rejects(Store.save(corrupted, advance(), 0), /回读校验失败/);
  const failed = new MemoryDir();
  failed.hook = async event => { if (event.action === 'write') throw Error('Disk write failed'); };
  await assert.rejects(Store.save(failed, advance(), 0), /Disk write failed/);
  assert(failed.events.some(event => event.action === 'abort'));
  assert.equal(failed.files.get(Store.FILE), '');
});

test('relations source guards stop stale writes at entry, history, CAS, staging and verification', async () => {
  const rejected = new MemoryDir();
  await assert.rejects(Store.save(rejected, advance(), 0, {guard: async () => { throw Error('Source changed'); }}), /Source changed/);
  assert.equal(rejected.events.length, 0);
  for (const stage of ['history', 'CAS', 'staging', 'verification']) {
    const dir = new MemoryDir(), baseline = await Store.save(dir, advance(), 0), before = dir.files.get(Store.FILE);
    let active = true, textReads = 0;
    dir.hook = async event => {
      if (stage === 'history' && event.action === 'directory') {
        const history = new MemoryDir('relation-history'); dir.dirs.set('relation-history', history);
        history.hook = async value => { if (value.action === 'text') active = false; };
      }
      if (stage === 'CAS' && event.action === 'text' && ++textReads === 2) active = false;
      if (stage === 'staging' && event.action === 'write') active = false;
      if (stage === 'verification' && event.action === 'text' && ++textReads === 3) active = false;
    };
    await assert.rejects(Store.save(dir, advance(baseline), 1, {guard: async () => { if (!active) throw Error('Source changed'); }}), /Source changed/, stage);
    if (stage !== 'verification') assert.equal(dir.files.get(Store.FILE), before, stage);
    else assert.equal(JSON.parse(dir.files.get(Store.FILE)).revision, 2, 'a completed write is retained but stale source cannot report success');
  }
});

test('relations serialize concurrent saves with fallback queue and Web Locks', async () => {
  const dir = new MemoryDir();
  const results = await Promise.allSettled([Store.save(dir, advance(), 0), Store.save(dir, advance(R.empty(), 'Other editor'), 0)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(results.find(result => result.status === 'rejected').reason.message, /其他窗口/);
  const calls = [], lockDir = new MemoryDir();
  const context = {module: {exports: {}}, require: () => R, JSON, TextEncoder, navigator: {locks: {async request(name, options, callback) { calls.push({name, options}); return callback(); }}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../extension/relations-store.js'), 'utf8'), context);
  await context.module.exports.save(lockDir, advance(), 0);
  assert.equal(calls[0].name, 'runtime-sop-relations-write-v1'); assert.equal(calls[0].options.mode, 'exclusive');
});
