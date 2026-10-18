'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const FILES = Object.freeze([
  'LICENSE',
  'docs/TEAM-SERVICE-PACKAGE.md',
  'docs/TEAM-SERVICE-DESIGN.md',
  'server/README.md',
  'server/Dockerfile',
  'server/compose.yaml',
  'server/package.json',
  'server/app.cjs',
  'server/backup.cjs',
  'server/category-store.cjs',
  'server/cli.cjs',
  'server/guide-assets.cjs',
  'server/store.cjs',
  'server/tools/backup.cjs',
  'extension/catalog-engine.js',
  'extension/category-engine.js',
  'extension/image-marks.js'
]);

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function checkedInputs(root) {
  return FILES.map(relative => {
    const file = path.join(root, relative);
    let current = root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Symlink not allowed: ${relative}`);
    }
    if (!fs.statSync(file).isFile()) throw new Error(`Packaging input is not a file: ${relative}`);
    return { file, relative };
  });
}

function createZip(entries) {
  const chunks = [];
  const centralEntries = [];
  let offset = 0;
  for (const { file, relative } of entries) {
    const raw = fs.readFileSync(file);
    const compressed = zlib.deflateRawSync(raw);
    const name = Buffer.from(relative);
    const checksum = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);

    chunks.push(local, name, compressed);
    centralEntries.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centralEntries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}

function build({ root = ROOT, dist = path.join(root, 'dist') } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Expected a formal three-part extension version.');
  const entries = checkedInputs(root);
  fs.mkdirSync(dist, { recursive: true });
  const name = `running-sop-team-service-v${manifest.version}-experimental.zip`;
  const archive = createZip(entries);
  const output = path.join(dist, name);
  fs.writeFileSync(output, archive);
  const digest = crypto.createHash('sha256').update(archive).digest('hex');
  const checksum = `${output}.sha256`;
  fs.writeFileSync(checksum, `${digest}  ${name}\n`);
  return { output, checksum, name, digest, entries: entries.map(entry => entry.relative) };
}

if (require.main === module) {
  const result = build();
  console.log(`${result.output}\n${result.digest}  ${result.name}\nPackaging notes: docs/TEAM-SERVICE-PACKAGE.md`);
}

module.exports = { FILES, build, checkedInputs };
