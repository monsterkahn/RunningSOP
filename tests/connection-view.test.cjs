'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Connection = require('../extension/connection-view.js');
const endpoint = 'sop-directory://00000000-0000-4000-8000-000000000001/catalog.json';
const settings = { endpoint, enabled: false };
const sourceInfo = { selected: true, endpoint, name: 'Synthetic SOP', readPermission: 'granted' };

test('connection state requires verified read status rather than a selected path or enabled timer', () => {
  assert.equal(Connection.state({ settings: { endpoint: '', enabled: false } }), 'unconfigured');
  assert.equal(Connection.state({ settings, sourceInfo, status: { state: 'waiting' } }), 'idle');
  assert.equal(Connection.state({ settings, sourceInfo, status: { state: 'disabled' } }), 'idle');
  assert.equal(Connection.state({ settings, sourceInfo, status: { state: 'ready', endpoint } }), 'ready');
  assert.equal(Connection.state({ settings, sourceInfo, status: { state: 'ready', endpoint: endpoint.replace('000001', '000002') } }), 'idle', 'a previous library verification does not prove the current source is readable');
});

test('checking is transient and the final read result determines ready or offline', () => {
  const ready = { state: 'ready', endpoint };
  assert.equal(Connection.state({ settings, sourceInfo, status: ready, checking: true }), 'checking');
  assert.equal(Connection.state({ settings, sourceInfo, status: ready, checking: false }), 'ready');
  assert.equal(Connection.state({ settings, sourceInfo, status: { state: 'offline' } }), 'offline');
  assert.equal(Connection.state({ settings, sourceInfo, status: { state: 'error' } }), 'offline');
});

test('a missing or mismatched directory handle cannot reuse a ready status', () => {
  const status = { state: 'ready', endpoint };
  assert.equal(Connection.state({ settings, status }), 'offline');
  assert.equal(Connection.state({ settings, status, sourceInfo: { ...sourceInfo, selected: false } }), 'offline');
  assert.equal(Connection.state({ settings, status, sourceInfo: { ...sourceInfo, endpoint: endpoint.replace('000001', '000002') } }), 'offline');
});

test('revoked folder read access cannot display a ready connection', () => {
  for (const readPermission of ['denied', 'prompt']) {
    assert.equal(Connection.state({ settings, sourceInfo: { ...sourceInfo, readPermission }, status: { state: 'ready', endpoint } }), 'permission');
  }
  assert.equal(Connection.state({ settings: { endpoint: 'file:///synthetic/catalog.json', enabled: false }, status: { state: 'blocked' } }), 'permission');
});
