(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NASPublisher = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DB_NAME = 'runtime-sop-nas-publisher-v1';
  const STORE = 'handles';
  const HANDLE_KEY = 'publish-directory';
  const MAX_TOTAL = 4 * 1024 * 1024;
  const MAX_CATALOG = 512 * 1024;
  const DEFAULT_LABEL = '工作地址';
  const SOPAssets = typeof require === 'function' ? require('./sop-assets.js') : (typeof window !== 'undefined' ? window.SOPAssets : null);
  const fail = message => { throw new Error(message); };

  function bytes(text) { return new TextEncoder().encode(text); }
  async function sha256(text, cryptoObject = globalThis.crypto) {
    if (!cryptoObject?.subtle) fail('当前浏览器不支持 SHA-256 校验。');
    const digest = await cryptoObject.subtle.digest('SHA-256', bytes(text));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  }
  function parse(raw, label) {
    try { return JSON.parse(raw); } catch (_) { fail(label + ' JSON 无效。'); }
  }
  async function boundedBytes(file, limit) {
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > limit) fail('文件超过读取上限。');
    const content = typeof file.arrayBuffer === 'function' ? new Uint8Array(await file.arrayBuffer()) : bytes(await file.text());
    if (content.length > limit) fail('文件超过读取上限。');
    return content;
  }
  async function readText(directory, path) {
    const parts = path.split('/');
    let dir = directory;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const handle = await dir.getFileHandle(parts[parts.length - 1]);
    const file = await handle.getFile();
    return new TextDecoder('utf-8', { fatal: true }).decode(await boundedBytes(file, path === 'catalog.json' ? MAX_CATALOG : MAX_TOTAL));
  }
  async function readBinary(directory, path) {
    const parts=path.split('/');let dir=directory;
    for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part);
    const file=await (await dir.getFileHandle(parts.at(-1))).getFile();
    return boundedBytes(file, MAX_TOTAL);
  }
  async function writeNew(directory, path, raw) {
    const parts = path.split('/');
    let dir = directory;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
    let handle;
    try { handle = await dir.getFileHandle(parts[parts.length - 1]); }
    catch (error) {
      if (error.name !== 'NotFoundError') throw error;
      handle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
      const writable = await handle.createWritable({ keepExistingData: false });
      try { await writable.write(raw); await writable.close(); }
      catch (error) { try { await writable.abort(); } catch (_) {} throw error; }
      // Verify immutable bytes before the catalog can reference them.
      const verified = await handle.getFile();
      const actual = await boundedBytes(verified, MAX_TOTAL), expected = typeof raw === 'string' ? bytes(raw) : raw;
      if (actual.length !== expected.length || actual.some((value, i) => value !== expected[i])) fail('不可变发布文件写入后回读不一致。');
      return;
    }
    const file=await handle.getFile();
    const existing=await boundedBytes(file,MAX_TOTAL),expected=typeof raw==='string'?bytes(raw):raw;
    if(existing.length!==expected.length||existing.some((v,i)=>v!==expected[i]))fail('不可变发布文件已存在但内容不一致，已停止以保护现有内容。');
  }
  async function replaceText(directory, path, raw) {
    const parts = path.split('/');
    let dir = directory;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const handle = await dir.getFileHandle(parts[parts.length - 1]);
    const writable = await handle.createWritable({ keepExistingData: false });
    try { await writable.write(raw); await writable.close(); }
    catch (error) { try { await writable.abort(); } catch (_) {} throw error; }
  }
  async function inspectSelected(handle) {
    // A user may choose either the upload root or its sop/ directory. Probe only
    // these two known paths; never enumerate the selected directory.
    try { await handle.getFileHandle('catalog.json'); return { root: handle, selected: 'sop' }; }
    catch (error) { if (error.name !== 'NotFoundError') throw error; }
    for(const parts of [['工作SOP','SOP'],['SOP'],['sop']]) {
      try { let nested=handle;for(const name of parts)nested=await nested.getDirectoryHandle(name);await nested.getFileHandle('catalog.json');return {root:nested,selected:parts.join('/')}; }
      catch(error) { if(error.name!=='NotFoundError')throw error; }
    }
    fail('所选目录中找不到 catalog.json。请选 upload、工作SOP 或 SOP 目录。');
  }
  function openDb(indexedDBObject) {
    return new Promise((resolve, reject) => {
      const request = indexedDBObject.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法保存 存储器 目录授权。'));
    });
  }
  async function idbGet(indexedDBObject) {
    const db = await openDb(indexedDBObject);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly'), req = tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  }
  async function idbSet(indexedDBObject, value) {
    const db = await openDb(indexedDBObject);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, HANDLE_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('无法保存 存储器 目录授权。')); };
    });
  }
  function createPublisher(options = {}) {
    const win = options.window || (typeof window !== 'undefined' ? window : null);
    const idb = options.indexedDB || win?.indexedDB || globalThis.indexedDB;
    const engine = options.engine || (typeof require === 'function' ? require('./catalog-engine.js') : win?.CatalogEngine);
    const remoteContent = options.remoteContent || win?.SOPSync;
    const cryptoObject = options.crypto || win?.crypto || globalThis.crypto;
    let selected = options.directoryHandle || null;
    function supportError() { return new Error('此浏览器无法使用目录选择器。请使用 JSON 导出方式并按 docs/CATALOG.md 手动发布。'); }
    async function chooseDirectory() {
      if (!win?.showDirectoryPicker || !idb) throw supportError();
      // This method must be called directly from a user gesture.
      const chosen = await win.showDirectoryPicker({ mode: 'readwrite' });
      const inspected = await inspectSelected(chosen);
      selected = inspected.root;
      await idbSet(idb, selected);
      return info();
    }
    async function getHandle() {
      if (!idb) return selected;
      // Options and the side panel share this store; never keep another tab's old folder.
      selected = await idbGet(idb);
      return selected;
    }
    async function permissionState(handle) {
      if (!handle) return 'missing';
      try { return await handle.queryPermission({ mode: 'readwrite' }); }
      catch (_) { return 'unsupported'; }
    }
    async function info() {
      const handle = await getHandle();
      if (!handle) return { selected: false, permission: 'missing' };
      return { selected: true, name: handle.name || '', permission: await permissionState(handle) };
    }
    async function ensureWritePermission(handle) {
      let state = await permissionState(handle);
      if (state !== 'granted') {
        if (typeof handle.requestPermission !== 'function') fail('存储器 目录写入授权不可用。请重新选择目录后再发布。');
        // Explicitly called only from publish(), which the UI must invoke from a
        // user gesture. No background permission prompt is ever made.
        state = await handle.requestPermission({ mode: 'readwrite' });
      }
      if (state !== 'granted') fail('没有获得 存储器 目录写入授权，未发布任何内容。');
    }
    async function verifyExisting(raw, workflow, handle) {
      if (await sha256(raw, cryptoObject) !== workflow.sha256) fail('现有工作流 ' + workflow.id + ' 的 SHA-256 不匹配。');
      let parsed = parse(raw, '现有工作流 ' + workflow.id);
      if(parsed?.format === SOPAssets?.FORMAT) {
        if(!SOPAssets)fail('图片资产校验器尚未加载。');
        parsed=await SOPAssets.hydrate(parsed,workflow,file=>readBinary(handle,file),cryptoObject);
      }
      if (workflow.viewer === 'youtube') {
        if (remoteContent?.verify) await remoteContent.verify(parsed);
        else fail('YouTube 内容校验器尚未加载，无法安全发布目录。');
        if (parsed.workflowId !== 'youtube-upload') fail('现有 YouTube 工作流身份无效。');
      } else {
        const guide = engine.validateGuide(parsed);
        if (guide.workflowId !== workflow.id) fail('现有指南身份与目录不匹配。');
      }
      return parsed;
    }
    let publicationQueue=Promise.resolve();
    async function publishOnce(guideInput, publishOptions = {}) {
      const handle = await getHandle();
      if (!handle) fail('请先选择 存储器 的 upload 或 sop 文件夹。');
      await ensureWritePermission(handle);
      if (!engine) fail('目录校验器尚未加载。');
      const guide = engine.validateGuide(guideInput);
      if (guide.workflowId === 'youtube-upload') fail('指南身份不能覆盖 YouTube 工作流。');
      if(!SOPAssets)fail('图片资产校验器尚未加载。');

      const originalCatalogRaw = await readText(handle, 'catalog.json');
      if (bytes(originalCatalogRaw).length > MAX_CATALOG) fail('目录超过 512 KB。');
      const originalCatalog = engine.validateCatalog(parse(originalCatalogRaw, '现有目录'));
      const existingTarget = originalCatalog.workflows.find(workflow => workflow.id === guide.workflowId);
      if (existingTarget && existingTarget.viewer !== 'guide') {
        fail('此工作流 ID 已属于其他查看器，不能替换身份。');
      }
      if (existingTarget && (typeof publishOptions.expectedSha !== 'string' || publishOptions.expectedSha.toLowerCase() !== existingTarget.sha256)) {
        fail('此指南已存在，但编辑基准指纹缺失或已过期；请重新读取目录后再发布。');
      }
      if(existingTarget) {
        const oldRaw=await readText(handle,existingTarget.file);
        await verifyExisting(oldRaw,existingTarget,handle);
      }
      const packed=await SOPAssets.pack(guide,{id:guide.workflowId,viewer:'guide'},cryptoObject);
      const serialized=JSON.stringify(packed.document),docHash=await sha256(serialized,cryptoObject);
      const releasePath=`workflows/${guide.workflowId}/versions/${docHash}.json`;
      const guideBytes=bytes(serialized);
      const withoutTarget = originalCatalog.workflows.filter(workflow => workflow.id !== guide.workflowId);
      const routeRules = new Map();
      for (const step of guide.steps) {
        if (!step.workUrl) continue;
        const url = new URL(step.workUrl);
        if(url.protocol==='file:') routeRules.set('file\n'+url.href,{hosts:[],fileUrls:[url.href],priority:20,label:'本机文件地址'});
        else routeRules.set('http\n'+url.origin+'\n'+url.pathname,{hosts:[url.hostname.toLowerCase()],origins:[url.origin],pathEquals:[url.pathname],priority:20,label:DEFAULT_LABEL});
      }
      if (!routeRules.size) fail('指南没有任何步骤工作网址，无法创建精确网页匹配规则。');
      const rules = Array.from(routeRules.values());
      const title = guide.title;
      const summary = guide.notice || '';
      const entry = { id: guide.workflowId, title, summary, status: 'published', viewer: 'guide', file: releasePath, sha256: docHash, rules };
      const catalog = engine.validateCatalog({ ...originalCatalog, workflows: [...withoutTarget, entry] });
      const catalogRaw = JSON.stringify(catalog, null, 2) + '\n';
      const total = bytes(catalogRaw).length + guideBytes.length + packed.assets.reduce((sum,item)=>sum+item.bytes.length,0);
      if (total > MAX_TOTAL) fail('目录与所有工作流合计超过 4 MB。');

      // Write immutable content first. A pre-existing hash path is accepted only
      // when its exact bytes match. The catalog remains the final pointer write.
      for(const asset of packed.assets)await writeNew(handle,asset.file,asset.bytes);
      await writeNew(handle, releasePath, serialized);
      if (await readText(handle, 'catalog.json') !== originalCatalogRaw) fail('目录在发布期间发生变化；已保留不可变正文，请重新检查后再发布。');
      await replaceText(handle, 'catalog.json', catalogRaw);
      if(await readText(handle,'catalog.json')!==catalogRaw)fail('其他设备在发布期间改写了目录，请重新读取目录确认。');
      let historyWarning='';
      try{const event={format:'runtime-sop-publication',schemaVersion:1,workflowId:guide.workflowId,sha256:docHash,version:guide.version,publishedAt:new Date().toISOString(),previousSha256:existingTarget?.sha256||null};
        const eventPath='publication-history/'+guide.workflowId+'/'+docHash+'.json';
        let existing;try{existing=await readText(handle,eventPath);}catch(e){if(e.name!=='NotFoundError')throw e;}
        if(!existing)await writeNew(handle,eventPath,JSON.stringify(event,null,2)+'\n');
        else {const old=JSON.parse(existing);if(old.workflowId!==event.workflowId||old.sha256!==event.sha256||old.version!==event.version)throw Error('发布历史指纹冲突。');}
      }catch(e){historyWarning='SOP 已发布，但更新历史未能记录：'+e.message;}
      return { historyWarning, workflowId: guide.workflowId, file: releasePath, sha256: docHash, catalogVersion: catalog.version };
    }
    function publish(guideInput,publishOptions={}){const execute=()=>win?.navigator?.locks?.request?win.navigator.locks.request('runtime-sop-nas-publish',{mode:'exclusive'},()=>publishOnce(guideInput,publishOptions)):publishOnce(guideInput,publishOptions);const result=publicationQueue.catch(()=>{}).then(execute);publicationQueue=result.catch(()=>{});return result;}
    return { chooseDirectory, info, publish, getDirectoryHandle:getHandle };
  }
  const defaultPublisher = createPublisher();
  return { createPublisher, chooseDirectory: (...args) => defaultPublisher.chooseDirectory(...args), info: (...args) => defaultPublisher.info(...args), publish: (...args) => defaultPublisher.publish(...args), getDirectoryHandle: (...args) => defaultPublisher.getDirectoryHandle(...args), sha256, MAX_TOTAL };
});
