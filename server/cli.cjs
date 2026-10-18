#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const { TeamStore } = require('./store.cjs');
const { createTeamServer } = require('./app.cjs');

function main(env = process.env) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24 or newer is required.');
  const directory = path.resolve(env.SOP_DATA_DIR || path.join(os.homedir(), '.running-sop-team'));
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const configPath = path.join(directory, 'config.json');
  let joinCode = env.JOIN_CODE;
  if (!joinCode) {
    try { joinCode = JSON.parse(fs.readFileSync(configPath, 'utf8')).joinCode; }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Unable to read service configuration.');
      joinCode = randomBytes(24).toString('base64url');
      try {
        fs.writeFileSync(configPath, JSON.stringify({ joinCode }) + '\n', { flag: 'wx', mode: 0o600 });
        console.log(`First-launch join code: ${joinCode}`);
      } catch (writeError) {
        if (writeError.code !== 'EEXIST') throw writeError;
        joinCode = JSON.parse(fs.readFileSync(configPath, 'utf8')).joinCode;
      }
    }
  }
  if (typeof joinCode !== 'string' || joinCode.length < 16) throw new Error('JOIN_CODE must contain at least 16 characters.');
  const host = env.HOST || '127.0.0.1';
  const port = env.PORT === undefined ? 8787 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT.');
  const allowOrigins = (env.ALLOW_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
  const store = new TeamStore({ dbPath: path.resolve(env.DB_PATH || path.join(directory, 'team.sqlite')) });
  let server;
  try { server = createTeamServer({ store, joinCode, allowOrigins }); } catch (error) { store.close(); throw error; }
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    server.close(() => { store.close(); });
    server.closeIdleConnections();
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  server.once('error', () => { console.error('Team service could not listen. Check the configured address and port.'); stop(); process.exitCode = 1; });
  server.listen(port, host, () => {
    console.log('Running SOP experimental team service is listening.');
    if (!['127.0.0.1', '::1', 'localhost'].includes(host)) console.warn('This service uses unencrypted HTTP. For LAN use, place it behind a configured HTTPS reverse proxy; direct HTTP is for trusted isolated tests only.');
  });
  return server;
}

if (require.main === module) { try { main(); } catch { console.error('Team service startup failed. Check configuration and storage permissions.'); process.exitCode = 1; } }
module.exports = { main };
