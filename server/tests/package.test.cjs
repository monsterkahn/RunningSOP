'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const zlib = require('node:zlib');
const { FILES, build } = require('../../tools/build-team-service.cjs');

function extractAllowlistedZip(archive, destination) {
  const allowed = new Set(FILES);
  const names = [];
  let offset = 0;
  while (offset + 4 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const method = archive.readUInt16LE(offset + 8);
    const compressedLength = archive.readUInt32LE(offset + 18);
    const uncompressedLength = archive.readUInt32LE(offset + 22);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = archive.toString('utf8', nameStart, nameStart + nameLength);
    assert.ok(allowed.has(name), `unexpected archive path: ${name}`);
    assert.ok(!name.startsWith('/') && !name.split('/').includes('..'), `unsafe archive path: ${name}`);
    assert.equal(method, 8, `unexpected compression method for ${name}`);
    const dataStart = nameStart + nameLength + extraLength;
    const data = zlib.inflateRawSync(archive.subarray(dataStart, dataStart + compressedLength));
    assert.equal(data.length, uncompressedLength, `invalid uncompressed size for ${name}`);
    const file = path.join(destination, ...name.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data, { flag: 'wx' });
    names.push(name);
    offset = dataStart + compressedLength;
  }
  assert.equal(archive.readUInt32LE(offset), 0x02014b50, 'archive should have a central directory');
  assert.deepEqual(names, FILES, 'archive entries should match the fixed packaging allowlist');
  return names;
}

function waitForListening(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => finish(new Error('Packaged service did not report listening before timeout.')), timeoutMs);
    const onData = chunk => {
      output += chunk.toString();
      if (output.includes('Running SOP experimental team service is listening.')) finish();
    };
    const onExit = code => finish(new Error(`Packaged service exited before listening (code ${code}).`));
    const onError = error => finish(error);
    function finish(error) {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve();
    }
    child.stdout.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
  });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve({ code: child.exitCode, signal: child.signalCode });
    const timer = setTimeout(() => finish(new Error('Packaged service did not exit before timeout.')), timeoutMs);
    const onExit = (code, signal) => finish(null, { code, signal });
    const onError = error => finish(error);
    function finish(error, result) {
      clearTimeout(timer);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve(result);
    }
    child.once('exit', onExit);
    child.once('error', onError);
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (child.connected) {
    try { child.send({ type: 'shutdown' }); } catch { /* Cleanup continues below. */ }
  }
  try { await waitForExit(child, 3000); } catch {
    child.kill();
    try { await waitForExit(child, 3000); } catch { /* The temporary directory is still safe to remove. */ }
  }
}

test('experimental source ZIP extracts and starts as an isolated service', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'running-sop-source-zip-'));
  const distribution = path.join(temporary, 'distribution');
  const extracted = path.join(temporary, 'extracted');
  const dataDirectory = path.join(temporary, 'service-data');
  fs.mkdirSync(extracted);
  fs.mkdirSync(dataDirectory);
  let child;
  t.after(async () => {
    await stopChild(child);
    fs.rmSync(temporary, { recursive: true, force: true });
  });

  const packageResult = build({ dist: distribution });
  const archive = fs.readFileSync(packageResult.output);
  extractAllowlistedZip(archive, extracted);

  child = spawn(process.execPath, [path.join(extracted, 'server/cli.cjs')], {
    cwd: extracted,
    env: {
      ...process.env,
      SOP_DATA_DIR: dataDirectory,
      DB_PATH: path.join(dataDirectory, 'team.sqlite'),
      JOIN_CODE: '',
      ALLOW_ORIGINS: '',
      HOST: '127.0.0.1',
      PORT: '0'
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });

  await waitForListening(child);
  const exit = waitForExit(child, 10000);
  child.send({ type: 'shutdown' });
  const stopped = await exit;
  assert.equal(stopped.code, 0, `packaged service should stop cleanly${stderr ? `: ${stderr}` : ''}`);
  assert.equal(stopped.signal, null);

  const configuration = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'config.json'), 'utf8'));
  assert.equal(typeof configuration.joinCode, 'string');
  assert.ok(configuration.joinCode.length >= 16);
  assert.ok(fs.statSync(path.join(dataDirectory, 'team.sqlite')).size > 0, 'service should create its SQLite database');
});
