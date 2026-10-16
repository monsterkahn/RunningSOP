'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const QR = require('../extension/qr-code.js');

// These module digests were independently decoded with jsQR 1.4.0 from
// 5-pixel-per-module RGBA images, including the full white quiet zone.
// The decoder is a development verification tool, not a runtime dependency.
const vectors = [
  ['https://example.com/sop/demo?step=2#review', 29,
    'f9a2e156a81c97eacea601ae17fc3b0cc3203d90f2f1f397ee140d7dbefd1c9e'],
  ['http://192.0.2.10:8080/library/index.html', 29,
    'd85e89b2dbee8732d4bd2aa81235a56d4e0b4ca97ca9233c29d2dbefad2c2bab'],
  ['https://example.com/流程/例子?q=资料&emoji=✓', 41,
    '08e91a2e1702377e0a8539a09d2570a8991ef477bbd6d0f511b2c9aafc4c0a3d'],
  ['https://example.com/?q=' + 'x'.repeat(1001), 121,
    'd4c8ae5e68e3b745d80eb7ae2a185799711627262534cf1a775bb2efeadbd17d']
];

test('offline QR matrices retain independently decoded URL vectors', () => {
  for (const [url, size, digest] of vectors) {
    const encoded = QR.encode(url);
    assert.equal(encoded.url, new URL(url).href);
    assert.equal(encoded.size, size);
    assert.equal(encoded.modules.length, size);
    assert.ok(encoded.modules.every(row => row.length === size && row.every(cell => typeof cell === 'boolean')));
    assert.equal(createHash('sha256').update(JSON.stringify(encoded.modules)).digest('hex'), digest);
  }
});

test('QR accepts exactly the byte limit and rejects longer serialized URLs', () => {
  const prefix = 'https://example.com/?q=';
  const exact = prefix + 'x'.repeat(QR.MAX_BYTES - prefix.length);
  assert.equal(QR.encode(exact).url.length, 1024);
  assert.throws(() => QR.encode(exact + 'x'), /1024 bytes/);
  assert.throws(() => QR.encode(prefix + '资'.repeat(120)), /1024 bytes/);
});

test('QR rejects invalid, executable, credential-bearing and ambiguous links', () => {
  for (const value of [null, {}, '', '//example.com', 'javascript:alert(1)', 'data:text/html,hello',
    'file:///example', 'ftp://example.com', 'https://', 'https://user:pass@example.com',
    'https://example.com/\npath', ' https://example.com', 'https://example.com/a b']) {
    assert.throws(() => QR.encode(value), TypeError);
  }
});

test('SVG renders the exact matrix with a white four-module quiet zone', () => {
  const url = 'https://example.com/?q=%3Cscript%3E';
  const {size, modules} = QR.encode(url);
  const svg = QR.toSVG(url);
  assert.ok(svg.includes('viewBox="0 0 ' + (size + 8) + ' ' + (size + 8) + '"'));
  assert.ok(svg.includes('fill="#fff"'));
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
  assert.ok(!svg.includes('example.com'));
  assert.ok(!/<(?:script|image|foreignObject)\b|\bon\w+=|\bhref=/i.test(svg));
  const commands = Array.from(svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g));
  assert.equal(commands.length, modules.flat().filter(Boolean).length);
  const rendered = new Set(commands.map(([, x, y]) => `${Number(x) - 4},${Number(y) - 4}`));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) assert.equal(rendered.has(`${x},${y}`), modules[y][x]);
  }
  assert.ok(commands.every(([, x, y]) => +x >= 4 && +x < size + 4 && +y >= 4 && +y < size + 4));
});

test('standalone browser export works without CommonJS, DOM, or network globals', () => {
  const sandbox = {URL, TextEncoder};
  vm.runInNewContext(readFileSync(require.resolve('../extension/qr-code.js'), 'utf8'), sandbox);
  assert.deepEqual(Object.keys(sandbox).sort(), ['SOPQRCode', 'TextEncoder', 'URL'].sort());
  assert.equal(sandbox.SOPQRCode.toSVG(vectors[0][0]), QR.toSVG(vectors[0][0]));
});
