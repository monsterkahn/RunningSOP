#!/usr/bin/env node
'use strict';
const { createSnapshot, restoreSnapshot, verifySnapshot } = require('../backup.cjs');

async function main(args = process.argv.slice(2)) {
  const [operation, source, destination, ...extra] = args;
  if (extra.length || !source || !['backup', 'restore', 'verify'].includes(operation) || (operation === 'verify' ? destination !== undefined : !destination)) throw new Error('Usage: node server/tools/backup.cjs backup|restore SOURCE NEW_DESTINATION; or verify SOURCE');
  const result = operation === 'verify' ? verifySnapshot(source) : await (operation === 'backup' ? createSnapshot : restoreSnapshot)(source, destination);
  console.log(JSON.stringify({ operation, verified: true, ...result }));
  return result;
}
if (require.main === module) main().catch(() => { console.error('Snapshot operation failed. Check source integrity, available space, permissions, and that the destination and its SQLite sidecars do not exist.'); process.exitCode = 1; });
module.exports = { main };
