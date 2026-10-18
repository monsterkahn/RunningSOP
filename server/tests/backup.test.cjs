'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { TeamStore } = require('../store.cjs');
const { createSnapshot, restoreSnapshot, verifySnapshot } = require('../backup.cjs');
const guide = title => ({ format: 'runtime-sop-guide', schemaVersion: 1, workflowId: 'sample', title, version: '1', notice: '', steps: [{ id: 'step-1', title: '', where: 'Synthetic', actions: ['Synthetic action'], expected: '', trouble: '', acceptance: [], workUrl: 'https://example.test/task' }] });
function directory(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sop-backup-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }

test('online WAL snapshot and restored restart preserve revisions, hashes, sessions and fencing', async t => {
  const dir = directory(t), source = path.join(dir, 'live.sqlite'), output = path.join(dir, 'backup.sqlite'), restored = path.join(dir, 'restored.sqlite');
  const store = new TeamStore({ dbPath: source, now: () => 1000, leaseMs: 100 });
  try {
    store.db.exec('PRAGMA wal_autocheckpoint=0;');
    const session = store.createSession({ displayName: 'Synthetic editor' }), actor = session.actor;
    store.create(guide('Initial'), { actor, idempotencyKey: 'backup-create' });
    const firstLease = store.acquireLock('sample', { actor });
    const published = store.publish('sample', guide('Published'), { actor, ...firstLease, expectedRevision: 1, idempotencyKey: 'backup-publish' });
    const held = store.acquireLock('sample', { actor });
    assert.ok(fs.statSync(source + '-wal').size > 0);
    // A second reader must include committed WAL records and exclude this
    // deliberately incomplete transaction in the still-running writer.
    store.db.exec("BEGIN IMMEDIATE; UPDATE workflows SET title='uncommitted' WHERE id='sample';");
    let summary;
    try { summary = await createSnapshot(source, output); } finally { store.db.exec('ROLLBACK'); }
    assert.equal(summary.revisions, 2); assert.equal(summary.workflows, 1);
    assert.equal(fs.existsSync(output + '-wal'), false);
    if (process.platform !== 'win32') assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    await restoreSnapshot(output, restored);
    const reopened = new TeamStore({ dbPath: restored, now: () => 1000, leaseMs: 100 });
    try {
      assert.deepEqual(reopened.get('sample'), published);
      assert.equal(reopened.get('sample', { revision: 1 }).guide.title, 'Initial');
      assert.equal(reopened.history('sample').items.length, 2);
      assert.deepEqual(reopened.authenticate(session.token), actor);
      assert.equal(reopened.lockInfo('sample').fence, held.fence);
      assert.throws(() => reopened.acquireLock('sample', { actor }), error => error.code === 'locked');
      reopened.releaseLock('sample', { actor, ...held });
      assert.equal(reopened.acquireLock('sample', { actor }).fence, held.fence + 1);
    } finally { reopened.close(); }
  } finally { store.close(); }
  const offline = path.join(dir, 'offline.sqlite'); await createSnapshot(source, offline);
  assert.equal(verifySnapshot(offline).revisions, 2);
});

test('backup and restore refuse existing files, live targets, sidecars and corrupt snapshots', async t => {
  const dir = directory(t), source = path.join(dir, 'source.sqlite'), other = path.join(dir, 'other.sqlite');
  const store = new TeamStore({ dbPath: source });
  try {
    const actor = store.createSession({ displayName: 'Synthetic' }).actor;
    store.create(guide('Initial'), { actor, idempotencyKey: 'backup-create' });
    await assert.rejects(restoreSnapshot(source, source));
    fs.writeFileSync(other, 'sentinel'); await assert.rejects(createSnapshot(source, other)); assert.equal(fs.readFileSync(other, 'utf8'), 'sentinel');
    fs.unlinkSync(other); fs.writeFileSync(other + '-wal', 'sentinel'); await assert.rejects(restoreSnapshot(source, other)); fs.unlinkSync(other + '-wal');
    store.db.prepare("UPDATE revisions SET sha256=? WHERE id='sample'").run('0'.repeat(64));
    await assert.rejects(createSnapshot(source, other)); assert.equal(fs.existsSync(other), false);
    assert.equal(fs.readdirSync(dir).some(name => name.startsWith('.sop-backup-')), false);
  } finally { store.close(); }
});

test('CLI creates and verifies a standalone backup without printing source content', async t => {
  const dir = directory(t), source = path.join(dir, 'source.sqlite'), target = path.join(dir, 'snapshot.sqlite');
  const store = new TeamStore({ dbPath: source }); store.close();
  const cli = path.join(__dirname, '../tools/backup.cjs');
  const result = spawnSync(process.execPath, [cli, 'backup', source, target], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).verified, true);
  assert.equal(spawnSync(process.execPath, [cli, 'verify', target]).status, 0);
  assert.equal(spawnSync(process.execPath, [cli, 'restore', target, source]).status, 1);
});

test('abrupt process termination rolls back incomplete publication and retains committed WAL', async t => {
  const dir = directory(t), source = path.join(dir, 'crash.sqlite');
  const worker = fork(path.join(__dirname, 'fixtures/crash-worker.cjs'), [], { env: { ...process.env, SOP_CRASH_TEST_DB: source }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  t.after(() => { if (worker.exitCode === null && worker.signalCode === null) worker.kill('SIGKILL'); });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Crash worker timed out')), 5000);
    worker.once('message', message => { clearTimeout(timeout); message.staged ? resolve() : reject(new Error('Unexpected worker state')); });
    worker.once('error', error => { clearTimeout(timeout); reject(error); });
    worker.once('exit', () => { clearTimeout(timeout); reject(new Error('Worker exited before staging')); });
  });
  const exited = once(worker, 'exit'); worker.kill('SIGKILL'); await exited;
  assert.ok(fs.statSync(source + '-wal').size > 0);
  const backupFile = path.join(dir, 'recovered.sqlite'); await createSnapshot(source, backupFile);
  const recovered = new TeamStore({ dbPath: backupFile, now: () => 1000 });
  try {
    assert.equal(recovered.get('sample').revision, 2);
    assert.equal(recovered.get('sample').guide.title, 'Committed second revision');
    assert.equal(recovered.history('sample').items.length, 2);
    assert.equal(recovered.db.prepare("SELECT fence FROM workflows WHERE id='sample'").get().fence, 1);
    assert.equal(recovered.db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { recovered.close(); }
});

test('asset-backed history snapshots reconstruct exactly and reject corrupt binary assets',async t=>{const dir=directory(t),source=path.join(dir,'images.sqlite'),output=path.join(dir,'images-backup.sqlite'),store=new TeamStore({dbPath:source});try{const actor=store.createSession({displayName:'Synthetic editor'}).actor,g=guide('With image');g.steps[0].image='data:image/jpeg;base64,/9j/AA==';const created=store.create(g,{actor,idempotencyKey:'images-create-01'});const summary=await createSnapshot(source,output);assert.equal(summary.assets,1);assert.equal(summary.assetBytes,4);const reopened=new TeamStore({dbPath:output});try{assert.deepEqual(reopened.get('sample'),created);}finally{reopened.close();}store.db.prepare('UPDATE assets SET bytes=?').run(Buffer.alloc(4));assert.throws(()=>verifySnapshot(source),/asset/i);await assert.rejects(createSnapshot(source,path.join(dir,'corrupt-backup.sqlite')));}finally{store.close();}});
