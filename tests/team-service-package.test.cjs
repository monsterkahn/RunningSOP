'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { FILES, build } = require('../tools/build-team-service.cjs');

function zipNames(buffer) {
  const names = [];
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const compressedLength = buffer.readUInt32LE(offset + 18);
    const nameStart = offset + 30;
    names.push(buffer.toString('utf8', nameStart, nameStart + nameLength));
    offset = nameStart + nameLength + extraLength + compressedLength;
  }
  assert.ok(offset < buffer.length, 'ZIP local entries should be followed by a central directory');
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
  return names;
}

function makeFixture(root) {
  for (const relative of [...FILES, 'extension/manifest.json']) {
    const source = path.resolve(__dirname, '..', relative);
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  fs.mkdirSync(path.join(root, 'server/tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server/tests/private.test.cjs'), 'private test');
  fs.mkdirSync(path.join(root, 'server/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server/data/team.sqlite'), 'private database');
  fs.writeFileSync(path.join(root, 'server/config.json'), 'private config');
  fs.mkdirSync(path.join(root, 'server/tools'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server/tools/scale.cjs'), 'development tool');
}

test('experimental team service ZIP contains only its explicit runtime allowlist', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'running-sop-package-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  makeFixture(root);

  const serverDirectory = path.join(root, 'server');
  const savedServerDirectory = path.join(root, 'server-saved');
  fs.renameSync(serverDirectory, savedServerDirectory);
  fs.symlinkSync(savedServerDirectory, serverDirectory, 'junction');
  assert.throws(() => build({ root, dist: path.join(root, 'dist') }), /Symlink not allowed/);
  fs.rmSync(serverDirectory);
  fs.renameSync(savedServerDirectory, serverDirectory);

  const result = build({ root, dist: path.join(root, 'dist') });
  const archive = fs.readFileSync(result.output);
  const names = zipNames(archive);
  assert.deepEqual(names, FILES);
  assert.ok(result.name.endsWith('-experimental.zip'));
  assert.equal(fs.readFileSync(result.checksum, 'utf8'), `${crypto.createHash('sha256').update(archive).digest('hex')}  ${result.name}\n`);
  for (const forbidden of ['server/tests/', 'server/tools/scale.cjs', 'server/config.json', 'server/data/team.sqlite']) {
    assert.ok(!names.some(name => name === forbidden || name.startsWith(forbidden)), `ZIP excludes ${forbidden}`);
  }

  // Verify the custom writer produced readable entries, not just plausible names.
  let offset = 0;
  let count = 0;
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const compressedLength = archive.readUInt32LE(offset + 18);
    const uncompressedLength = archive.readUInt32LE(offset + 22);
    const dataStart = offset + 30 + nameLength + extraLength;
    assert.equal(zlib.inflateRawSync(archive.subarray(dataStart, dataStart + compressedLength)).length, uncompressedLength);
    offset = dataStart + compressedLength;
    count++;
  }
  assert.equal(count, FILES.length);
});
