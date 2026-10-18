'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {reconstructGuide,verifyAssets}=require('./guide-assets.cjs');
const { DatabaseSync, backup } = require('node:sqlite');

function verifySnapshot(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    const check = db.prepare('PRAGMA integrity_check').all();
    if (check.length !== 1 || check[0].integrity_check !== 'ok') throw new Error('Database integrity check failed.');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Database foreign key check failed.');
    const schemaVersion = db.prepare('PRAGMA user_version').get().user_version;
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 6) throw new Error('Not a team service database.');
    let revisions = 0;
    for (const row of db.prepare('SELECT id,revision,sha256,guide FROM revisions').iterate()) {
      reconstructGuide(db,row.guide,row.sha256,row.id);
      revisions++;
    }
    const invalid = db.prepare('SELECT w.id FROM workflows w LEFT JOIN revisions r ON r.id=w.id AND r.revision=w.revision WHERE r.id IS NULL OR r.sha256<>w.sha256 LIMIT 1').get();
    if (invalid) throw new Error('Current revision verification failed.');
    return { ...(schemaVersion>=4?verifyAssets(db):{}),schemaVersion, workflows: db.prepare('SELECT count(*) AS count FROM workflows').get().count, revisions };
  } finally { db.close(); }
}

function ensureUnused(destination) {
  for (const filename of [destination, destination + '-wal', destination + '-shm', destination + '-journal']) {
    try { fs.lstatSync(filename); throw new Error('Destination or its SQLite sidecars already exist. Use a new path.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function syncDirectory(directory) {
  let descriptor;
  try { descriptor = fs.openSync(directory, 'r'); fs.fsyncSync(descriptor); }
  catch (error) { if (process.platform !== 'win32' || !['EPERM', 'EISDIR', 'EINVAL', 'EBADF', 'EACCES'].includes(error.code)) throw error; }
  finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
}

// sqlite.backup includes committed WAL records; copying the database file alone
// does not. Publication uses an exclusive hard link to avoid partial or replaced
// destination files. Both paths must be on storage supporting SQLite and links.
async function snapshot(sourcePath, destinationPath) {
  if (typeof sourcePath !== 'string' || typeof destinationPath !== 'string' || !sourcePath || !destinationPath) throw new TypeError('Source and destination paths are required.');
  const source = fs.realpathSync(sourcePath), destination = path.resolve(destinationPath);
  if (!fs.statSync(source).isFile()) throw new Error('Source must be a database file.');
  ensureUnused(destination);
  const directory = fs.realpathSync(path.dirname(destination));
  const temporaryDirectory = fs.mkdtempSync(path.join(directory, '.sop-backup-'));
  fs.chmodSync(temporaryDirectory, 0o700);
  const temporary = path.join(temporaryDirectory, 'snapshot.sqlite');
  let db;
  try {
    fs.closeSync(fs.openSync(temporary, 'wx', 0o600));
    db = new DatabaseSync(source, { readOnly: true });
    await backup(db, temporary);
    db.close(); db = undefined;
    // Make the published artifact standalone, with no required WAL sidecar.
    const completed = new DatabaseSync(temporary);
    try { completed.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;'); } finally { completed.close(); }
    const verification = verifySnapshot(temporary);
    const descriptor = fs.openSync(temporary, 'r');
    try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    ensureUnused(destination);
    fs.linkSync(temporary, destination);
    syncDirectory(directory);
    return { ...verification, bytes: fs.statSync(destination).size };
  } finally {
    if (db) db.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function restoreSnapshot(source, destination) {
  // Deliberately the same exclusive creation rule: never restore over a running
  // or stopped existing database. Operators choose a fresh path and switch only
  // after stopping the service and verifying the recovered snapshot.
  return snapshot(source, destination);
}

module.exports = { createSnapshot: snapshot, restoreSnapshot, verifySnapshot };
