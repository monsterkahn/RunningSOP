(function (root, factory) {
  'use strict';
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./catalog-engine.js') : root.CatalogEngine);
  root.RunningSOPTeamClient = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CatalogEngine) {
  'use strict';
  const MAX = 4 * 1024 * 1024 + 65536;
  function error(code, status) { const e = new Error('Team service request failed (' + code + ').'); e.code = code; if (status) e.status = status; return e; }
  function object(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function text(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max && !/[\x00-\x1f\x7f]/.test(v); }
  function id(v) { if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(v || '')) throw error('invalid_id'); return v; }
  function revision(v) { if (!Number.isSafeInteger(v) || v < 1) throw error('invalid_revision'); return v; }
  function validateEndpoint(value) {
    if (!text(value, 2048) || value !== value.trim() || !/^https?:\/\//i.test(value) || /[\\?#]/.test(value)) throw error('invalid_endpoint');
    let u; try { u = new URL(value); } catch (_) { throw error('invalid_endpoint'); }
    let path; try { path = decodeURIComponent(value.replace(/^[a-z]+:\/\/[^/]+/i, '')); } catch (_) { throw error('invalid_endpoint'); }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || /[\\?#%]/.test(path) || path.split('/').some(p => p === '.' || p === '..')) throw error('invalid_endpoint');
    return u.origin + u.pathname.replace(/\/+$/, '');
  }
  function sanitizeWorkURL(value) {
    if (!text(value, 8192) || /\\/.test(value)) throw error('invalid_work_url');
    let u; try { u = new URL(value); } catch (_) { throw error('invalid_work_url'); }
    if (!['http:', 'https:', 'file:'].includes(u.protocol)) throw error('invalid_work_url');
    if (u.username || u.password) throw error('invalid_work_url');
    if (u.protocol === 'file:') return u.href;
    u.search = ''; u.hash = '';
    return u.protocol === 'file:' ? u.href : u.origin + u.pathname;
  }
  function create(config) {
    const endpoint = validateEndpoint(config.endpoint), token = config.token || '';
    if (token && !text(token, 2048)) throw error('invalid_token');
    const fetcher = config.fetch || globalThis.fetch, crypto = config.crypto || globalThis.crypto;
    const timeout = config.timeoutMs === undefined ? 8000 : config.timeoutMs;
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 120000) throw error('invalid_timeout');
    // A complete authenticated SOP may keep progressing past the normal deadline.
    // Its idle deadline stays short and its total transfer remains bounded.
    const fullReadTimeout = config.fullReadTimeoutMs === undefined ? 120000 : config.fullReadTimeoutMs;
    if (!Number.isFinite(fullReadTimeout) || fullReadTimeout < 1 || fullReadTimeout > 120000) throw error('invalid_timeout');
    const largeWriteTimeout = config.largeWriteTimeoutMs;
    if (largeWriteTimeout !== undefined && (!Number.isFinite(largeWriteTimeout) || largeWriteTimeout < 1 || largeWriteTimeout > 180000)) throw error('invalid_timeout');
    const maxCacheBytes = config.maxCacheBytes === undefined ? 8 * 1024 * 1024 : config.maxCacheBytes;
    if (!Number.isSafeInteger(maxCacheBytes) || maxCacheBytes < 0 || maxCacheBytes > 32 * 1024 * 1024) throw error('invalid_cache_limit');
    const now = config.now || Date.now, cache = new Map(), limit = Math.max(0, Math.min(100, config.cacheLimit === undefined ? 20 : config.cacheLimit));
    function key(value) { if (value !== undefined && !/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw error('invalid_idempotency_key'); return value || crypto.randomUUID(); }
    async function requestOnce(path, method, body, opts = {}, anonymous = false, writeKey, fullRead = false, guideWrite = false) {
      const serialized = body === undefined ? undefined : JSON.stringify(body);
      const writeBytes = guideWrite && token && !anonymous ? new TextEncoder().encode(serialized).byteLength : 0;
      const largeWrite = guideWrite && ['POST','PUT'].includes(method) && writeBytes > 256 * 1024;
      // Fetch exposes no upload progress here. Budget only large canonical writes
      // for upload plus the verified full-guide echo; keep an absolute cap.
      const writeBudget = largeWrite ? (largeWriteTimeout === undefined ? Math.min(180000, timeout + Math.ceil(writeBytes * 2000 / 65536)) : largeWriteTimeout) : timeout;
      const controller = new AbortController(); let timedOut = false;
      const abort = () => controller.abort();
      if (opts.signal) { if (opts.signal.aborted) throw error('aborted'); opts.signal.addEventListener('abort', abort, {once:true}); }
      const expire = () => { timedOut = true; controller.abort(); };
      let timer = setTimeout(expire, writeBudget), totalTimer;
      const progressive = largeWrite || fullRead && !anonymous && !!token && method === 'GET';
      if (progressive) totalTimer = setTimeout(expire, largeWrite ? writeBudget : fullReadTimeout);
      const progress = () => { clearTimeout(timer); timer = setTimeout(expire, timeout); };
      try {
        const headers = {'Accept':'application/json','X-Running-SOP-Protocol':'1'};
        if (!anonymous && token) headers.Authorization = 'Bearer ' + token;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (writeKey) headers['Idempotency-Key'] = writeKey;
        let response;
        try { response = await fetcher(endpoint + path, {method,headers,body:serialized,credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal}); }
        catch (_) { throw error(timedOut ? 'timeout' : controller.signal.aborted ? 'aborted' : 'network_error'); }
        if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw error('invalid_content_type');
        if (Number(response.headers.get('content-length')) > MAX) throw error('response_too_large');
        if (progressive && response.ok) progress();
        else if (largeWrite) progress(); // One short total deadline for an error body.
        if (!response.body || typeof response.body.getReader !== 'function') throw error('invalid_response');
        const reader = response.body.getReader(), chunks = []; let size = 0;
        try { while (true) { const part = await reader.read(); if (controller.signal.aborted) throw error(timedOut ? 'timeout' : 'aborted'); if (part.done) break; size += part.value.byteLength; if (size > MAX) throw error('response_too_large'); if (progressive && response.ok && part.value.byteLength) progress(); chunks.push(part.value); } }
        catch (e) { await reader.cancel().catch(() => {}); if (controller.signal.aborted) throw error(timedOut ? 'timeout' : 'aborted'); throw error(e && e.code === 'response_too_large' ? 'response_too_large' : 'invalid_response'); }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        let envelope; try { envelope = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); } catch (_) { throw error('invalid_json'); }
        if (!object(envelope)) throw error('invalid_envelope');
        if (!response.ok) { const code = object(envelope.error) && /^[a-zA-Z0-9_-]{1,64}$/.test(envelope.error.code) ? envelope.error.code : 'http_error'; if (response.status === 401 || response.status === 403) cache.clear(); const failure=error(code,response.status);const retry=Number(response.headers.get('retry-after'));failure.retryAfterMs=Number.isFinite(retry)&&retry>0?Math.min(5000,retry*1000):1000;throw failure; }
        if (!object(envelope.data)) throw error('invalid_envelope');
        return envelope.data;
      } finally { clearTimeout(timer); clearTimeout(totalTimer); controller.abort(); if (opts.signal) opts.signal.removeEventListener('abort', abort); }
    }
    async function request(path,method,body,opts={},anonymous=false,writeKey,fullRead=false,guideWrite=false){
      // Only authenticated reads retry. Lease operations and publication never
      // repeat automatically, even when their response is uncertain.
      const safe=!!token&&!anonymous&&(method==='GET'||method==='POST'&&path==='/v1/matches');
      const started=performance.now();let networkRetries=0;
      for(let attempt=0;;attempt++){
        if(opts.signal?.aborted)throw error('aborted');
        try{return await requestOnce(path,method,body,opts,anonymous,writeKey,fullRead,guideWrite);}
        catch(e){
          const network=e.code==='network_error',busy=e.status===503&&e.code==='BUSY';
          if(!safe||opts.retry===false||!network&&!busy||attempt>=7||network&&networkRetries++>=4)throw e;
          const delay=network?1000+Math.floor(Math.random()*Math.min(3000,750*networkRetries)):e.retryAfterMs+Math.floor(Math.random()*Math.min(4000,250*2**(attempt+1)));
          if(performance.now()-started+delay+timeout>30000)throw e;
          await new Promise((resolve,reject)=>{let timer;const abort=()=>{clearTimeout(timer);reject(error('aborted'));};timer=setTimeout(()=>{opts.signal?.removeEventListener('abort',abort);resolve();},delay);if(opts.signal){if(opts.signal.aborted)abort();else opts.signal.addEventListener('abort',abort,{once:true});}});
        }
      }
    }
    async function verified(data, expectedId, expectedRevision) {
      if (!object(data) || data.id !== expectedId || (expectedRevision !== undefined && data.revision !== expectedRevision) || !/^[a-f0-9]{64}$/i.test(data.sha256 || '')) throw error('integrity_error');
      revision(data.revision);
      try { CatalogEngine.validateGuide(data.guide); } catch (_) { throw error('invalid_guide'); }
      if (data.guide.workflowId !== expectedId) throw error('integrity_error');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data.guide)))), b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== data.sha256.toLowerCase()) throw error('integrity_error');
      const result = {id:data.id,revision:data.revision,sha256:data.sha256,guide:JSON.parse(JSON.stringify(data.guide))};
      if (data.lock === null) result.lock = null;
      else if (object(data.lock) && object(data.lock.owner) && text(data.lock.owner.id,128) && text(data.lock.owner.name,80) && Number.isSafeInteger(data.lock.fence) && data.lock.fence > 0 && Number.isFinite(data.lock.expiresAt)) result.lock = {owner:{id:data.lock.owner.id,name:data.lock.owner.name},fence:data.lock.fence,expiresAt:data.lock.expiresAt,baseRevision:data.lock.baseRevision,serverTime:data.lock.serverTime,leaseMs:data.lock.leaseMs};
      return result;
    }
    async function digest(value) {
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
    }
    function imageReference(value) {
      if (!object(value) || !Object.keys(value).every(k => ['step','issue','sha256','imageAt','imageMarks'].includes(k)) || !Number.isSafeInteger(value.step) || value.step < 0 || value.step >= 100 || value.issue !== undefined && (!Number.isSafeInteger(value.issue) || value.issue < 0 || value.issue >= 10) || !/^[a-f0-9]{64}$/.test(value.sha256 || '')) throw error('invalid_image_reference');
      return JSON.parse(JSON.stringify(value));
    }
    // Read-only alternative: never use a partial view as a publication draft or
    // place it in the full-guide/offline cache. The original read API is intact.
    async function readView(sopId, opts = {}) {
      id(sopId); if (opts.revision !== undefined) revision(opts.revision);
      const data = await request('/v1/sops/' + sopId + '/view' + (opts.revision === undefined ? '' : '?revision=' + opts.revision),'GET',undefined,opts);
      if (data.id !== sopId || opts.revision !== undefined && data.revision !== opts.revision || !/^[a-f0-9]{64}$/.test(data.sha256 || '') || !/^[a-f0-9]{64}$/.test(data.viewSha256 || '') || !Array.isArray(data.images) || data.images.length > 1100) throw error('integrity_error');
      revision(data.revision);
      let guide; try { guide = CatalogEngine.validateGuide(data.guide); } catch (_) { throw error('invalid_guide'); }
      if (guide.workflowId !== sopId || JSON.stringify(guide) !== JSON.stringify(data.guide)) throw error('integrity_error');
      const template = JSON.parse(JSON.stringify(guide)), seen = new Set();
      for (const step of template.steps) for (const item of [step,...(step.issues || [])]) if (item.image !== undefined || item.imageAt !== undefined || item.imageMarks !== undefined) throw error('invalid_image_reference');
      const images = data.images.map(imageReference);
      for (const ref of images) {
        const step = template.steps[ref.step], target = ref.issue === undefined ? step : step?.issues?.[ref.issue], position = ref.step + ':' + (ref.issue === undefined ? 'step' : ref.issue);
        if (!target || seen.has(position)) throw error('invalid_image_reference');
        seen.add(position); target.image = 'data:image/jpeg;base64,/9j/AA==';
        for (const name of ['imageAt','imageMarks']) if (ref[name] !== undefined) target[name] = ref[name];
      }
      try { CatalogEngine.validateGuide(template); } catch (_) { throw error('invalid_image_reference'); }
      if (await digest(JSON.stringify({guide:data.guide,images:data.images})) !== data.viewSha256) throw error('integrity_error');
      return {id:sopId,revision:data.revision,sha256:data.sha256,viewSha256:data.viewSha256,guide,images};
    }
    async function readImage(sopId, reference, opts = {}) {
      id(sopId); revision(opts.revision); const ref = imageReference(reference), requestedRevision = opts.revision;
      const path = '/v1/sops/' + sopId + '/images/' + ref.step + (ref.issue === undefined ? '' : '/issues/' + ref.issue) + '?revision=' + requestedRevision;
      const data = await request(path,'GET',undefined,opts);
      if (data.id !== sopId || data.revision !== requestedRevision || data.step !== ref.step || data.issue !== ref.issue || data.sha256 !== ref.sha256 || typeof data.image !== 'string' || data.image.length > 280000) throw error('integrity_error');
      try { CatalogEngine.validateGuide({format:'runtime-sop-guide',schemaVersion:1,workflowId:sopId,title:'Image verification',version:'1',notice:'',steps:[{id:'image',title:'',where:'Image',actions:['Image verification'],expected:'',trouble:'',acceptance:[],image:data.image,...(ref.imageAt === undefined ? {} : {imageAt:ref.imageAt}),...(ref.imageMarks === undefined ? {} : {imageMarks:ref.imageMarks})}]}); } catch (_) { throw error('invalid_image'); }
      if (await digest(data.image) !== ref.sha256) throw error('integrity_error');
      return {id:sopId,revision:requestedRevision,step:ref.step,...(ref.issue === undefined ? {} : {issue:ref.issue}),sha256:ref.sha256,image:data.image};
    }
    function query(opts = {}) {
      const params = new URLSearchParams();
      for (const name of ['query','category','cursor']) if (opts[name] !== undefined) { if (!text(opts[name], name === 'cursor' ? 512 : name === 'query' ? 120 : 160)) throw error('invalid_query'); params.set(name, opts[name]); }
      if (opts.query !== undefined && opts.query.normalize('NFKC').trim().length < 2) throw error('invalid_query');
      if(opts.uncategorized!==undefined){if(typeof opts.uncategorized!=='boolean'||opts.uncategorized&&opts.category)throw error('invalid_query');if(opts.uncategorized)params.set('uncategorized','1');}
      if (opts.limit !== undefined) { if (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > 100) throw error('invalid_limit'); params.set('limit', opts.limit); }
      return params.size ? '?' + params.toString() : '';
    }
    function metadata(data, matching = false) {
      if (!Array.isArray(data.items) || data.items.length > (matching ? 200 : 100) || (data.nextCursor != null && data.nextCursor !== '' && !text(data.nextCursor,512))) throw error('invalid_metadata');
      for (const item of data.items) { if (!object(item)) throw error('invalid_metadata'); if(item.categoryId!==undefined&&item.categoryId!==null&&(typeof item.categoryId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(item.categoryId))||item.categoryRevision!==undefined&&(!Number.isSafeInteger(item.categoryRevision)||item.categoryRevision<0))throw error('invalid_metadata'); id(item.id); revision(item.revision); if (!text(item.title,160) || !/^[a-f0-9]{64}$/i.test(item.sha256 || '')) throw error('invalid_metadata'); }
      if (matching && (!['none','matched','ambiguous'].includes(data.state) || (data.state === 'none' && data.items.length !== 0) || (data.state === 'matched' && (data.items.length !== 1 || data.overflow === true)) || (data.state === 'ambiguous' && data.items.length < 2 && data.overflow !== true))) throw error('invalid_metadata');
      // Only documented display fields escape this boundary; URLs/resources are never followed.
      return {state:['matched','none','ambiguous'].includes(data.state) ? data.state : undefined,overflow:data.overflow === true,items:data.items.map(i => ({id:i.id,revision:i.revision,title:i.title,sha256:/^[a-f0-9]{64}$/i.test(i.sha256 || '') ? i.sha256 : undefined,updatedAt:Number.isSafeInteger(i.updatedAt) && i.updatedAt >= 0 ? i.updatedAt : undefined,summary:typeof i.summary === 'string' ? i.summary.slice(0,1000) : '',category:typeof i.category === 'string' ? i.category.slice(0,160) : '',categoryId:typeof i.categoryId==='string'&&/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(i.categoryId)?i.categoryId:null,categoryRevision:Number.isSafeInteger(i.categoryRevision)&&i.categoryRevision>=0?i.categoryRevision:0})),nextCursor:data.nextCursor || null};
    }
    async function getSop(sopId, opts = {}) {
      id(sopId); if (opts.revision !== undefined) revision(opts.revision);
      const path = '/v1/sops/' + sopId + (opts.revision === undefined ? '' : '?revision=' + opts.revision);
      try { const data = await verified(await request(path,'GET',undefined,opts,false,undefined,true),sopId,opts.revision); if (opts.signal?.aborted) throw error('aborted'); cache.delete(path); const bytes = new TextEncoder().encode(JSON.stringify(data)).byteLength; if (limit && bytes <= maxCacheBytes) cache.set(path,{data,at:now(),bytes}); let totalBytes = Array.from(cache.values()).reduce((sum,item) => sum + item.bytes,0); while(cache.size > limit || totalBytes > maxCacheBytes) { const oldest = cache.keys().next().value; totalBytes -= cache.get(oldest).bytes; cache.delete(oldest); } return {...JSON.parse(JSON.stringify(data)),cache:{stale:false}}; }
      catch (e) { const cached = cache.get(path); if (opts.allowStale === true && cached && ['network_error','timeout'].includes(e.code)) return {...JSON.parse(JSON.stringify(cached.data)),cache:{stale:true,verifiedAt:cached.at}}; throw e; }
    }
    async function write(path, guide, opts, extra, method = 'POST') {
      try { CatalogEngine.validateGuide(guide); } catch (_) { throw error('invalid_guide'); }
      const writeKey = key(opts.idempotencyKey);
      try { const data = await request(path,method,{guide,...extra},opts,false,writeKey,false,true); const result = await verified(data,guide.workflowId,extra.expectedRevision === undefined ? 1 : extra.expectedRevision + 1); if (opts.signal?.aborted) throw error('aborted'); cache.clear(); return {...result,idempotencyKey:writeKey}; }
      catch (e) { e.idempotencyKey = writeKey; throw e; }
    }
    function leaseData(d) { if (!text(d.token,2048) || !object(d.owner) || !text(d.owner.id,128) || !text(d.owner.name,80) || !Number.isSafeInteger(d.fence) || d.fence < 1 || !Number.isFinite(d.expiresAt)) throw error('invalid_lease'); revision(d.baseRevision); return {token:d.token,fence:d.fence,expiresAt:d.expiresAt,owner:{id:d.owner.id,name:d.owner.name},baseRevision:d.baseRevision,serverTime:d.serverTime,leaseMs:d.leaseMs}; }
    const categoryId=value=>{if(!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value||''))throw error('invalid_category');return value;};
    function categoryValue(value,versioned=false){
      if(!object(value)||!text(value.name,40)||!['blue','purple','green','orange','red','gray'].includes(value.color)||!['folder','briefcase','video','users','settings','file-text'].includes(value.icon))throw error('invalid_category');
      const result={...(value.id===undefined?{}:{id:categoryId(value.id)}),name:value.name,parentId:value.parentId==null?null:categoryId(value.parentId),color:value.color,icon:value.icon};
      if(versioned){categoryId(value.id);revision(value.revision);return {...result,revision:value.revision};}return result;
    }
    async function categoryWrite(path,method,body,opts={}){
      const requestKey=key(opts.idempotencyKey);
      try{return await request(path,method,body,opts,false,requestKey);}catch(e){e.idempotencyKey=requestKey;throw e;}
    }
    return Object.freeze({
      endpoint, clearCache() { cache.clear(); }, newIdempotencyKey() { return key(); },
      async capabilities(opts) { const d = await request('/v1/capabilities','GET',undefined,opts,true); if (d.protocolVersion !== 1 || !Number.isInteger(d.minClientProtocol) || !Number.isInteger(d.maxClientProtocol) || d.minClientProtocol > 1 || d.maxClientProtocol < 1) throw error('unsupported_protocol'); return d; },
      async join(joinCode,displayName,opts) { if (!text(joinCode,128) || !text(displayName,80)) throw error('invalid_session'); const d = await request('/v1/sessions','POST',{joinCode,displayName},opts,true); if (!text(d.token,2048) || !object(d.actor) || !text(d.actor.id,128) || !text(d.actor.name,80)) throw error('invalid_session'); cache.clear(); return d; },
      getSop, read:getSop, readView, readImage,
      async matches(url,opts) { return metadata(await request('/v1/matches','POST',{url:sanitizeWorkURL(url)},opts),true); },
      async list(opts = {}) { return metadata(await request('/v1/sops' + query(opts),'GET',undefined,opts)); },
      async categories(opts={}){
        const params=new URLSearchParams();if(opts.cursor)params.set('cursor',categoryId(opts.cursor));if(opts.parentId!==undefined)params.set('parentId',opts.parentId===null?'':categoryId(opts.parentId));
        if(opts.limit!==undefined){if(!Number.isInteger(opts.limit)||opts.limit<1||opts.limit>100)throw error('invalid_limit');params.set('limit',opts.limit);}
        const data=await request('/v1/categories'+(params.size?'?'+params.toString():''),'GET',undefined,opts);
        if(!Array.isArray(data.items)||data.items.length>100||data.nextCursor&&!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(data.nextCursor))throw error('invalid_category');
        return {items:data.items.map(item=>categoryValue(item,true)),nextCursor:data.nextCursor||''};
      },
      async createCategory(value,opts={}){return categoryValue(await categoryWrite('/v1/categories','POST',{category:categoryValue(value)},opts),true);},
      async updateCategory(category,value,opts={}){revision(opts.expectedRevision);return categoryValue(await categoryWrite('/v1/categories/'+categoryId(category),'PUT',{category:categoryValue({...value,id:category}),expectedRevision:opts.expectedRevision},opts),true);},
      async deleteCategory(category,opts={}){revision(opts.expectedRevision);const data=await categoryWrite('/v1/categories/'+categoryId(category),'DELETE',{expectedRevision:opts.expectedRevision},opts);if(data.id!==category||data.deleted!==true)throw error('invalid_category');return data;},
      async assignCategory(sopId,category,opts={}){id(sopId);if(!Number.isSafeInteger(opts.expectedCategoryRevision)||opts.expectedCategoryRevision<0)throw error('invalid_revision');const categoryValue=category===null?null:categoryId(category);const data=await categoryWrite('/v1/sops/'+sopId+'/category','PUT',{categoryId:categoryValue,expectedCategoryRevision:opts.expectedCategoryRevision},opts);if(data.id!==sopId||data.categoryId!==categoryValue||data.categoryRevision!==opts.expectedCategoryRevision+1)throw error('invalid_category');return data;},
      create(guide,opts = {}) { return write('/v1/sops',guide,opts,{}); },
      async acquireLock(sopId,opts) { return leaseData(await request('/v1/sops/' + id(sopId) + '/lock','POST',{},opts)); },
      async renewLock(sopId,lease,opts) { return leaseData(await request('/v1/sops/' + id(sopId) + '/lock','PATCH',{token:lease.token,fence:lease.fence},opts)); },
      releaseLock(sopId,lease,opts) { return request('/v1/sops/' + id(sopId) + '/lock','DELETE',{token:lease.token,fence:lease.fence},opts); },
      publish(sopId,guide,opts = {}) { id(sopId); if (guide.workflowId !== sopId) throw error('integrity_error'); revision(opts.expectedRevision); return write('/v1/sops/' + sopId,guide,opts,{token:opts.lease && opts.lease.token,fence:opts.lease && opts.lease.fence,expectedRevision:opts.expectedRevision},'PUT'); },
      async history(sopId,opts = {}) { id(sopId); const data = await request('/v1/sops/' + sopId + '/history' + query(opts),'GET',undefined,opts); if (!Array.isArray(data.items) || data.items.length > 200 || (data.nextCursor != null && data.nextCursor !== '' && !text(data.nextCursor,512))) throw error('invalid_history'); for (const item of data.items) { if (item.id !== sopId || !/^[a-f0-9]{64}$/i.test(item.sha256 || '')) throw error('invalid_history'); revision(item.revision); } return {items:data.items.map(i => ({id:i.id,revision:i.revision,sha256:i.sha256,updatedAt:Number.isSafeInteger(i.updatedAt) && i.updatedAt >= 0 ? i.updatedAt : undefined})),nextCursor:data.nextCursor || null}; }
    });
  }
  return Object.freeze({create,validateEndpoint,sanitizeWorkURL});
});
