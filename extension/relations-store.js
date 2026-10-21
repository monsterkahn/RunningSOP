(function (root, factory) {
  'use strict';
  const engine = typeof module !== 'undefined' && module.exports ? require('./relations-engine.js') : root.SOPRelations;
  const api = factory(engine, root);
  root.SOPRelationsStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Relations, root) {
  'use strict';
  const FILE = 'relations.json', LOCK = 'runtime-sop-relations-write-v1';
  let queue = Promise.resolve();
  const fail = message => { throw new Error(message); };
  const noop = async () => {};
  const missing = error => error?.name === 'NotFoundError';
  async function permission(handle, mode) {
    if (!handle || typeof handle.getFileHandle !== 'function') fail('所选目录句柄无效。');
    if (typeof handle.queryPermission === 'function') {
      let state;
      try { state = await handle.queryPermission({mode}); } catch (_) { state = 'denied'; }
      if (state !== 'granted') fail(mode === 'read' ? '请先允许读取所选 SOP 文件夹。' : '请先在用户操作中允许写入所选 SOP 文件夹；没有自动申请权限。');
    }
  }
  async function boundedText(handle, guard) {
    await guard();
    const file = await handle.getFile();
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > Relations.MAX_BYTES) fail('关系文件超过 512 KiB 或大小无效，未读取或覆盖。');
    await guard();
    const raw = await file.text();
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > Relations.MAX_BYTES) fail('关系文件超过 512 KiB，未读取或覆盖。');
    await guard();
    return raw;
  }
  async function snapshot(handle, guard = noop) {
    await guard();
    await permission(handle, 'read');
    await guard();
    let fileHandle;
    try { fileHandle = await handle.getFileHandle(FILE); }
    catch (error) { if (missing(error)) { await guard(); return {data: Relations.empty(), exists: false}; } throw error; }
    const raw = await boundedText(fileHandle, guard);
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { fail('relations.json JSON 无效，已保留原文件。'); }
    return {data: Relations.validate(parsed), exists: true};
  }
  async function read(handle) { return (await snapshot(handle)).data; }
  function encode(data) {
    const normalized = Relations.validate(data), raw = JSON.stringify(normalized, null, 2) + '\n';
    if (new TextEncoder().encode(raw).byteLength > Relations.MAX_BYTES) fail('关系数据超过 512 KiB，未写入。');
    return {normalized, raw};
  }
  async function writeReplace(handle, name, raw, guard) {
    await guard();
    const target = await handle.getFileHandle(name, {create: true});
    await guard();
    const writer = await target.createWritable({keepExistingData: false});
    try {
      await guard();
      await writer.write(raw);
      await guard();
      await writer.close();
    } catch (error) { try { await writer.abort(); } catch (_) {} throw error; }
    await guard();
  }
  async function backup(handle, current, guard) {
    const raw = encode(current).raw, name = 'revision-' + String(current.revision).padStart(10, '0') + '.json';
    await guard();
    const history = await handle.getDirectoryHandle('relation-history', {create: true});
    await guard();
    let existing;
    try { existing = await history.getFileHandle(name); } catch (error) { if (!missing(error)) throw error; }
    if (existing) {
      if (await boundedText(existing, guard) !== raw) fail('关系历史备份文件已存在且内容不同，已停止写入以保护数据。');
      return;
    }
    await writeReplace(history, name, raw, guard);
    await guard();
    const check = await history.getFileHandle(name);
    if (await boundedText(check, guard) !== raw) fail('关系历史备份回读不一致，已停止覆盖当前关系。');
  }
  async function saveOnce(handle, next, expectedRevision, guard) {
    await guard();
    await permission(handle, 'readwrite');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail('保存所需的原修订号无效。');
    const current = await snapshot(handle, guard);
    if (current.data.revision !== expectedRevision) fail('关系数据已被其他窗口更新；请重新读取后再保存。');
    const encoded = encode(next);
    if (encoded.normalized.revision !== expectedRevision + 1) fail('新关系数据必须在当前修订号基础上增加 1。');
    if (current.exists) await backup(handle, current.data, guard);
    const latest = await snapshot(handle, guard);
    if (latest.exists !== current.exists || JSON.stringify(latest.data) !== JSON.stringify(current.data)) fail('关系数据已在保存过程中变化；请重新读取后再保存。');
    await writeReplace(handle, FILE, encoded.raw, guard);
    const verified = await snapshot(handle, guard);
    if (JSON.stringify(verified.data) !== JSON.stringify(encoded.normalized)) fail('关系文件写入后回读校验失败。请检查文件后重试。');
    await guard();
    return verified.data;
  }
  function save(handle, next, expectedRevision, {guard = noop} = {}) {
    const run = async () => {
      if (typeof guard !== 'function') fail('关系保存来源校验器无效。');
      const locks = root?.navigator?.locks;
      if (typeof locks?.request === 'function') return locks.request(LOCK, {mode: 'exclusive'}, () => saveOnce(handle, next, expectedRevision, guard));
      return saveOnce(handle, next, expectedRevision, guard);
    };
    // Also serialize within this context when Web Locks are unavailable.
    const result = queue.catch(() => {}).then(run);
    queue = result.catch(() => {});
    return result;
  }
  return Object.freeze({FILE, read, save});
});
