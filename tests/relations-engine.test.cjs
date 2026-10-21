'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const R = require('../extension/relations-engine.js');
const node = (workflowId, x = 20, y = 20) => ({workflowId, x, y});
const edge = (from, to, kind = 'next', label = '', id = from + '-' + to) => ({id, from, to, kind, label});
const graph = (edges = [edge('alpha', 'beta')]) => ({...R.empty(), nodes: [node('alpha', 3800, 20), node('beta', 20, 3800), node('gamma', 20, 20)], edges});

test('relations schema is a separate cloned JSON model with stable IDs', () => {
  assert.equal(R.empty().format, 'runtime-sop-relations');
  assert.equal(R.empty().name, 'SOP relationships');
  assert.equal(R.empty().revision, 0);
  assert.deepEqual(R.validate(R.empty()), R.empty());
  const source = graph(), validated = R.validate(source);
  validated.nodes[0].x = 40;
  assert.equal(source.nodes[0].x, 3800);
  assert.equal(R.next(source, 'alpha'), 'beta', 'geometry must never infer the order');
  assert.equal(R.next(source, 'gamma'), null);
  assert.equal(R.next(source, 'alpha', ['alpha', 'beta']), 'beta');
  assert.equal(R.next(source, 'alpha', new Set(['alpha', 'beta'])), 'beta');
  assert.equal(R.next(source, 'alpha', ['beta']), null, 'a missing source cannot suggest a continuation');
  assert.equal(R.next(source, 'alpha', ['alpha']), null, 'a missing target cannot suggest a continuation');
  assert.equal(R.next(graph([edge('alpha', 'beta', 'issue', 'Retry')]), 'alpha'), null);
  assert.throws(() => R.next(source, 'alpha', {}));
  R.validate({...R.empty(), nodes: [node('constructor'), node('prototype')], edges: [edge('constructor', 'prototype')]});
});

test('relations enforce next uniqueness and acyclicity but permit issue cycles and converging next paths', () => {
  assert.throws(() => R.validate(graph([edge('alpha', 'beta'), edge('alpha', 'gamma')])), /下一步/);
  assert.throws(() => R.validate(graph([edge('alpha', 'beta'), edge('beta', 'alpha')])), /循环/);
  assert.throws(() => R.validate(graph([edge('alpha', 'beta'), edge('beta', 'gamma'), edge('gamma', 'alpha')])), /循环/);
  R.validate(graph([edge('alpha', 'gamma'), edge('beta', 'gamma')]));
  R.validate(graph([edge('alpha', 'beta', 'issue', 'Retry'), edge('beta', 'alpha', 'issue', 'Review')]));
  R.validate(graph([edge('alpha', 'beta'), edge('beta', 'alpha', 'issue', 'Retry')]));
});

test('relations validate ISO calendar dates and explicit numeric UTC offsets', () => {
  for (const updatedAt of ['2024-02-29T12:30:45.123Z', '2026-10-21T00:00:00+23:59', '2026-10-21T00:00:00-23:59', '2026-10-21T00:00:00.123456789+08:00']) {
    assert.equal(R.validate({...R.empty(), updatedAt}).updatedAt, updatedAt);
  }
  for (const updatedAt of ['2026-02-29T00:00:00Z', '2026-10-21T00:00:00+24:00', '2026-10-21T00:00:00-24:00', '2026-10-21T00:00:00+00:60', '2026-10-21T24:00:00Z']) {
    assert.throws(() => R.validate({...R.empty(), updatedAt}), /ISO/);
  }
});

test('relations reject unknown or missing fields, unsafe data, bad geometry, IDs and edge endpoints', () => {
  const cases = [
    {...graph(), format: 'runtime-sop-categories'}, {...graph(), schemaVersion: 2},
    {...graph(), revision: -1}, {...graph(), revision: 1.5}, {...graph(), revision: Number.MAX_SAFE_INTEGER + 1},
    {...graph(), updatedAt: '2026-02-30T00:00:00Z'}, {...graph(), updatedAt: 'not-a-date'},
    {...graph(), name: ' '}, {...graph(), name: 'x'.repeat(81)}, {...graph(), extra: true},
    {...graph(), nodes: [node('Alpha')]}, {...graph(), nodes: [node('alpha_id')]},
    {...graph(), nodes: [node('__proto__')]}, {...graph(), nodes: [node('alpha', 19)]},
    {...graph(), nodes: [node('alpha', 3801)]}, {...graph(), nodes: [node('alpha', NaN)]},
    {...graph(), nodes: [node('alpha'), node('alpha')]},
    {...graph(), nodes: [Object.assign(node('alpha'), {extra: 1})]},
    graph([edge('alpha', 'missing')]), graph([edge('alpha', 'alpha')]),
    graph([edge('alpha', 'beta', 'sequence')]), graph([edge('alpha', 'beta', 'issue', '')]),
    graph([edge('alpha', 'beta', 'issue', '   ')]), graph([edge('alpha', 'beta', 'next', 'x'.repeat(51))]),
    graph([edge('alpha', 'beta', 'next', '', '../escape')]),
    graph([edge('alpha', 'beta', 'next', '', 'constructor')]),
    graph([edge('alpha', 'beta'), edge('beta', 'gamma', 'next', '', 'alpha-beta')]),
    graph([edge('alpha', 'beta', 'issue', 'Retry', 'one'), edge('alpha', 'beta', 'issue', 'Retry', 'two')]),
    {...graph(), nodes: new Array(3)}, {...graph(), edges: new Date()},
    JSON.parse('{"__proto__":{},"format":"runtime-sop-relations"}')
  ];
  const missing = graph(); delete missing.name; cases.push(missing);
  const hidden = graph(); Object.defineProperty(hidden, 'secret', {value: 'hidden'}); cases.push(hidden);
  const accessor = graph(); let executed = false;
  Object.defineProperty(accessor, 'name', {enumerable: true, get() { executed = true; return 'Unsafe'; }}); cases.push(accessor);
  const symbol = graph(); symbol[Symbol('hidden')] = 1; cases.push(symbol);
  const inherited = Object.create({polluted: true}); Object.assign(inherited, graph()); cases.push(inherited);
  const customArray = graph(); customArray.nodes.extra = 'no'; cases.push(customArray);
  for (const input of cases) assert.throws(() => R.validate(input));
  assert.equal(executed, false, 'validation must not execute imported accessors');
});

test('relations limits bound model size and JSON structure', () => {
  const nodes = Array.from({length: 500}, (_, index) => node('flow-' + index));
  const edges = Array.from({length: 1000}, (_, index) => edge('flow-' + (index % 499), 'flow-499', 'issue', 'Case ' + index, 'edge-' + index));
  R.validate({...R.empty(), nodes, edges});
  assert.throws(() => R.validate({...R.empty(), nodes: [...nodes, node('extra')]}), /500/);
  assert.throws(() => R.validate({...R.empty(), nodes, edges: [...edges, edge('flow-0', 'flow-1', 'issue', 'Extra')]}), /1000/);
  const cyclic = graph(); cyclic.nodes.push(cyclic); assert.throws(() => R.validate(cyclic), /嵌套|过大/);
  const deep = graph(); let item = deep; for (let i = 0; i < 20; i++) { item.extra = {}; item = item.extra; }
  assert.throws(() => R.validate(deep), /嵌套/);
});
