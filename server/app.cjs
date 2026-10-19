'use strict';

const http = require('node:http');
const { createHash, timingSafeEqual } = require('node:crypto');
const MAX_BODY_BYTES = 4 * 1024 * 1024 + 65536;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

function failure(status, code, message) { return Object.assign(new Error(message), { status, code }); }
function equalSecret(a, b) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
function integer(value, name, max = Number.MAX_SAFE_INTEGER) {
  if (!/^[1-9]\d*$/.test(value || '') || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw failure(400, 'INVALID_REQUEST', `Invalid ${name}.`);
  return Number(value);
}
function readBody(req, limit, timeoutMs, budget) {
  return new Promise((resolve, reject) => {
    let size = 0, settled = false; const chunks = [];
    const finish = (error, value) => {
      if (settled) return; settled = true; clearTimeout(timer);
      budget.bytes -= size; chunks.length = 0;
      if (error) { error.closeConnection = true; req.pause(); reject(error); } else resolve(value);
    };
    const timer = setTimeout(() => finish(failure(408, 'REQUEST_TIMEOUT', 'Request timed out.')), timeoutMs); timer.unref();
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) { finish(failure(415, 'CONTENT_TYPE', 'Use application/json.')); return; }
    if (Number(req.headers['content-length']) > limit) { finish(failure(413, 'BODY_TOO_LARGE', 'Request body is too large.')); return; }
    req.on('data', chunk => {
      if (settled) return;
      if (size + chunk.length > limit) { finish(failure(413, 'BODY_TOO_LARGE', 'Request body is too large.')); return; }
      if (budget.bytes + chunk.length > budget.limit) { finish(failure(503, 'BUSY', 'Service body buffer is full.')); return; }
      size += chunk.length; budget.bytes += chunk.length; chunks.push(chunk);
    });
    req.once('aborted', () => finish(failure(400, 'ABORTED', 'Request aborted.')));
    req.once('error', () => finish(failure(400, 'INVALID_REQUEST', 'Unable to read request.')));
    req.once('end', () => {
      if (settled) return;
      try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); finish(null, value); }
      catch { finish(failure(400, 'INVALID_JSON', 'Expected a JSON object.')); }
    });
  });
}

function createTeamServer({ store, joinCode, allowOrigins = [], maxBodyBytes = MAX_BODY_BYTES, requestTimeoutMs = 15000, maxConcurrent = 512, rateLimit = 120, preAuthRateLimit = 6000, rateWindowMs = 60000, maxBufferedBodyBytes = 32 * 1024 * 1024, maxConnections = 1024, maxBufferedResponseBytes = 32 * 1024 * 1024, responseTimeoutMs = 15000, now = Date.now } = {}) {
  if (!store || typeof joinCode !== 'string' || joinCode.length < 16) throw new TypeError('A store and join code of at least 16 characters are required.');
  for (const [name, value] of Object.entries({ maxBodyBytes, requestTimeoutMs, maxConcurrent, rateLimit, preAuthRateLimit, rateWindowMs, maxBufferedBodyBytes, maxConnections, maxBufferedResponseBytes, responseTimeoutMs })) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer.`);
  }
  const origins = new Set(allowOrigins);
  for (const origin of origins) { if (typeof origin !== 'string' || origin === '*' || !/^(?:chrome-extension:\/\/[a-p]{32}|https?:\/\/[^/]+)$/.test(origin)) throw new TypeError('Origins must be explicit extension or HTTP(S) origins.'); }
  const buckets = new Map(); let active = 0;
  const budget = { bytes: 0, limit: maxBufferedBodyBytes };
  let bufferedResponses=0;
  const admitRate = (key, limit) => {
    const timestamp = now(); let bucket = buckets.get(key);
    if (bucket && timestamp - bucket.start >= rateWindowMs) { buckets.delete(key); bucket = null; }
    if (!bucket) { if (buckets.size >= 65536) throw failure(503, 'BUSY', 'Service is busy.'); bucket = { start: timestamp, count: 0 }; buckets.set(key, bucket); }
    if (++bucket.count > limit) throw failure(429, 'RATE_LIMITED', 'Too many requests.');
  };
  const cleanup = setInterval(() => { const timestamp = now(); for (const [key, bucket] of buckets) if (timestamp - bucket.start >= rateWindowMs) buckets.delete(key); }, Math.max(1000, rateWindowMs)); cleanup.unref();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    const send = (status, body) => {
      if (res.destroyed || res.writableEnded) return;
      let serialized=JSON.stringify(body),bytes=Buffer.byteLength(serialized);
      if(bufferedResponses+bytes>maxBufferedResponseBytes){status=503;serialized=JSON.stringify({error:{code:'BUSY',message:'Service response buffer is full.'}});res.setHeader('Retry-After','1');bytes=0;}
      bufferedResponses+=bytes;let released=false;
      const responseDeadline = setTimeout(() => res.destroy(), responseTimeoutMs); responseDeadline.unref();
      const release=()=>{if(!released){released=true;clearTimeout(responseDeadline);bufferedResponses-=bytes;}};
      res.once('finish',release);res.once('close',release);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(serialized);
    };
    
    try {
      const origin = req.headers.origin;
      if (origin && !origins.has(origin)) throw failure(403, 'ORIGIN_DENIED', 'Origin is not allowed.');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        if (!origin) throw failure(403, 'ORIGIN_DENIED', 'Origin is required.');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Running-SOP-Protocol');
        res.writeHead(204); res.end(); return;
      }
      const authorization = req.headers.authorization || '';
      let actor;
      if (/^Bearer [A-Za-z0-9_-]{16,256}$/.test(authorization)) {
        try { actor = store.authenticate(authorization.slice(7)); } catch (error) { if (error.status !== 401) throw error; }
      }
      if (actor) admitRate(`actor:${actor.id}`, rateLimit);
      else admitRate(`ip:${req.socket.remoteAddress || 'unknown'}`, preAuthRateLimit);
      if (active >= maxConcurrent) throw failure(503, 'BUSY', 'Service is busy.');
      active++;let released=false;const release=()=>{if(!released){released=true;active--;}};res.once('finish',release);res.once('close',release);
      if (!req.url.startsWith('/') || req.url.startsWith('//') || /[%\\#]/.test(req.url.split('?')[0])) throw failure(400, 'INVALID_PATH', 'Invalid request path.');
      const url = new URL(req.url, 'http://localhost'); const path = url.pathname;
      if (req.method === 'GET' && path === '/health') { send(200, { data: { status: 'ok' } }); return; }
      if (req.method === 'GET' && path === '/v1/capabilities') { send(200, { data: { protocolVersion: 1, serverVersion: '0.1.0', experimental: true, minClientProtocol: 1, maxClientProtocol: 1, limits: { maxBodyBytes, maxPageSize: 100 }, features: ['editing-leases','history','categories',...(store.getView&&store.getImage?['read-view-images']:[])] } }); return; }
      if (!path.startsWith('/v1/')) throw failure(404, 'NOT_FOUND', 'Route not found.');
      if (req.headers['x-running-sop-protocol'] !== '1') throw failure(426, 'PROTOCOL_MISMATCH', 'Protocol version 1 is required.');
      const body = (guide = false) => readBody(req, guide ? maxBodyBytes : Math.min(8192, maxBodyBytes), requestTimeoutMs, budget);
      if (req.method === 'POST' && path === '/v1/sessions') {
        const data = await body();
        if (typeof data.joinCode !== 'string' || !equalSecret(data.joinCode, joinCode)) throw failure(401, 'INVALID_JOIN_CODE', 'Invalid join code.');
        send(201, { data: store.createSession({ displayName: data.displayName }) }); return;
      }
      if (!actor) throw failure(401, 'UNAUTHORIZED', 'A valid device session is required.');
      const page = () => ({ cursor: url.searchParams.get('cursor') || undefined, limit: url.searchParams.has('limit') ? integer(url.searchParams.get('limit'), 'limit', 100) : undefined });
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey))) throw failure(400, 'INVALID_REQUEST', 'Invalid idempotency key.');
      let result, status = 200;
      if (path === '/v1/categories' && req.method === 'GET') result = store.listCategories({actor,...page(),...(url.searchParams.has('parentId')?{parentId:url.searchParams.get('parentId')||null}:{})});
      else if (path === '/v1/categories' && req.method === 'POST') { const data=await body(); result=store.createCategory(data.category,{actor,idempotencyKey}); status=201; }
      else if (path === '/v1/category-audit' && req.method === 'GET') result=store.categoryAudit({actor,...page(),categoryId:url.searchParams.get('categoryId')||undefined,workflowId:url.searchParams.get('workflowId')||undefined});
      else if (/^\/v1\/categories\/[a-z0-9][a-z0-9_-]{0,79}$/i.test(path) && ['PUT','DELETE'].includes(req.method)) {
        const id=path.slice('/v1/categories/'.length),data=await body();
        result=req.method==='PUT'?store.updateCategory(id,data.category,{actor,expectedRevision:data.expectedRevision,idempotencyKey}):store.deleteCategory(id,{actor,expectedRevision:data.expectedRevision,idempotencyKey});
      }
      else if (/^\/v1\/sops\/[a-z0-9][a-z0-9-]{0,79}\/category$/.test(path) && req.method==='PUT') {
        const id=path.split('/')[3],data=await body();result=store.assignCategory(id,data.categoryId,{actor,expectedCategoryRevision:data.expectedCategoryRevision,idempotencyKey});
      }
      else if (path === '/v1/sops' && req.method === 'GET') {if(url.searchParams.has('uncategorized')&&url.searchParams.get('uncategorized')!=='1')throw failure(400,'INVALID_REQUEST','Invalid category filter.');result = store.list({ ...page(), query: url.searchParams.get('query') || '', category: url.searchParams.get('category') || '',uncategorized:url.searchParams.get('uncategorized')==='1' });}
      else if (path === '/v1/sops' && req.method === 'POST') { const data = await body(true); result = store.create(data.guide, { actor, idempotencyKey }); status = 201; }
      else if (req.method==='GET' && /^\/v1\/sops\/[a-z0-9][a-z0-9-]{0,79}\/(?:view|images\/[^/]+(?:\/issues\/[^/]+)?)$/.test(path)) {
        const parts=path.split('/'),id=parts[3],options={revision:url.searchParams.has('revision')?integer(url.searchParams.get('revision'),'revision'):undefined};
        if(parts[4]==='images'){
          if(options.revision===undefined)throw failure(400,'INVALID_REQUEST','Exact revision is required.');
          const index=(value,max=100)=>{if(!/^(?:0|[1-9]\d*)$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>=max)throw failure(400,'INVALID_REQUEST','Invalid image index.');return Number(value);};
          options.step=index(parts[5]);if(parts[6])options.issue=index(parts[7],10);
        }
        if(store.estimatedReadBytes&&bufferedResponses+store.estimatedReadBytes(id,options)>maxBufferedResponseBytes)throw failure(503,'BUSY','Service response buffer is full.');
        result=parts[4]==='view'?store.getView(id,options):store.getImage(id,options);
      }
      else if (path === '/v1/matches' && req.method === 'POST') { const data = await body(); result = store.match(data.url); }
      else {
        const match = /^\/v1\/sops\/([^/]+)(?:\/(lock|history))?$/.exec(path);
        if (!match || !ID.test(match[1])) throw failure(404, 'NOT_FOUND', 'Route not found.');
        const [, id, action] = match;
        if (!action && req.method === 'GET') {
          const options={revision:url.searchParams.has('revision')?integer(url.searchParams.get('revision'),'revision'):undefined};
          if(store.estimatedReadBytes&&bufferedResponses+store.estimatedReadBytes(id,options)>maxBufferedResponseBytes)throw failure(503,'BUSY','Service response buffer is full.');
          result={...store.get(id,options),lock:store.lockInfo(id)};
        }
        else if (!action && req.method === 'PUT') { const data = await body(true); result = store.publish(id, data.guide, { actor, token: data.token, fence: data.fence, expectedRevision: data.expectedRevision, idempotencyKey }); }
        else if (action === 'history' && req.method === 'GET') result = store.history(id, page());
        else if (action === 'lock' && req.method === 'POST') {
          // Consume a supplied action envelope before responding, including on
          // contention, so a normal 409 does not discard the reusable socket.
          if (req.headers['transfer-encoding'] || Number(req.headers['content-length']) > 0) await body();
          result = { ...store.acquireLock(id, { actor }), serverTime: store.now ? store.now() : now(), leaseMs: store.leaseMs };
        }
        else if (action === 'lock' && ['PATCH', 'DELETE'].includes(req.method)) { const data = await body(); result = store[req.method === 'PATCH' ? 'renewLock' : 'releaseLock'](id, { actor, token: data.token, fence: data.fence }); if (req.method === 'PATCH') result = { ...result, serverTime: store.now ? store.now() : now(), leaseMs: store.leaseMs }; }
        else throw failure(404, 'NOT_FOUND', 'Route not found.');
      }
      send(status, { data: result === undefined ? null : result });
    } catch (error) {
      if(error.status===503)res.setHeader('Retry-After','1');
      if (error.status === 429) res.setHeader('Retry-After', String(Math.ceil(rateWindowMs / 1000)));
      if (error.closeConnection || !req.complete && (Number(req.headers['content-length'])>0 || req.headers['transfer-encoding'])) { res.setHeader('Connection', 'close'); res.once('finish', () => req.destroy()); }
      const safe = Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
      const status = safe ? error.status : error.status === 503 ? 503 : 500;
      send(status, { error: { code: safe || status === 503 ? error.code : 'INTERNAL_ERROR', message: safe || status === 503 ? error.message : 'Internal service error.' } });
    } finally { if (!req.complete && !res.getHeader('Connection')) req.resume(); }
  });
  server.maxConnections = maxConnections;
  server.once('close', () => clearInterval(cleanup));
  server.requestTimeout = requestTimeoutMs; server.headersTimeout = requestTimeoutMs; server.keepAliveTimeout = 5000; server.maxRequestsPerSocket = 100;
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  return server;
}

module.exports = { createTeamServer, MAX_BODY_BYTES };
