'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../extension/catalog-engine.js');

const base = {
  format: 'runtime-sop-guide', schemaVersion: 1, workflowId: 'guide-one', title: 'Guide', version: '1', notice: '',
  steps: [{ id: 'step-one', title: 'Step', where: 'Page', actions: ['Click'], expected: 'Done', trouble: '', acceptance: ['Confirm'] }]
};
const jpeg = 'data:image/jpeg;base64,/9j/4AA=';

test('legacy schema 1 guides remain unchanged when screenshot fields are absent', () => {
  assert.deepEqual(E.validateGuide(base), base);
});

test('guide screenshots, ISO time and validated marks are retained as optional fields', () => {
  const guide = structuredClone(base);
  guide.steps[0].image = jpeg;
  guide.steps[0].imageAt = '2026-10-13T12:34:56.000Z';
  guide.steps[0].imageMarks = [
    { type: 'number', x: 0.25, y: 0.4 },
    { type: 'arrow', x: 0.2, y: 0.3, x2: 0.8, y2: 0.7 }
  ];
  const validated = E.validateGuide(guide);
  assert.deepEqual(validated, guide);
  assert.notEqual(validated.steps[0].imageMarks, guide.steps[0].imageMarks);
  assert.notEqual(validated.steps[0].imageMarks[0], guide.steps[0].imageMarks[0]);
});

test('invalid screenshot types, encodings and byte sizes are rejected', () => {
  for (const image of [
    'data:image/png;base64,/9j/4AA=',
    'data:image/jpeg;base64,AAAA',
    'data:image/jpeg;base64,/9j/A=',
    'data:image/jpeg;base64,/9j/' + 'A'.repeat(273100)
  ]) {
    const guide = structuredClone(base);
    guide.steps[0].image = image;
    assert.throws(() => E.validateGuide(guide), /截图/);
  }
});

test('image marks and timestamps require a screenshot and valid values', () => {
  for (const field of [
    { imageMarks: [] },
    { imageAt: 'yesterday' },
    { imageAt: '2026-99-42T88:99:99Z', image: jpeg },
    { imageMarks: [{ type: 'script', x: 0, y: 0 }], image: jpeg },
    { imageMarks: [{ type: 'number', x: 0, y: 1.1 }], image: jpeg },
    { imageMarks: [{ type: 'number', x: 0, y: 0, label: '<img>' }], image: jpeg }
  ]) {
    const guide = structuredClone(base);
    Object.assign(guide.steps[0], field);
    assert.throws(() => E.validateGuide(guide));
  }
});

console.log('Catalog image checks passed.');
