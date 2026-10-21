'use strict';
(function (root, factory) {
  const api = factory(root);
  root.SOPStoragePageInstaller = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const NAMES = Object.freeze(['index.html', 'relationships.html']);
  const MAX_FILE_BYTES = 2 * 1024 * 1024, MAX_TOTAL_BYTES = 3 * 1024 * 1024;
  const LOCK = 'runtime-sop-storage-page-install-v1';
  // Shared by instances in this JS context. Web Locks additionally cover this
  // origin's other pages. Neither is a mutex across physical devices / NAS clients.
  let queue = Promise.resolve();
  function fail(code) { const error = Error('Storage pages: ' + code); error.code = code; return error; }
  function record(value, keys) {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw fail('invalid_bundle');
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || own.some(key => !keys.includes(key))) throw fail('invalid_bundle');
    for (const key of own) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw fail('invalid_bundle');
    }
  }
  function create({crypto = root.crypto, locks = root.navigator?.locks} = {}) {
    async function validate(bundle, check) {
      record(bundle, ['format', 'schemaVersion', 'version', 'files']);
      if (bundle.format !== 'runtime-sop-storage-pages' || bundle.schemaVersion !== 1 || bundle.version !== '2.0.0' || !Array.isArray(bundle.files) || bundle.files.length !== 2) throw fail('invalid_bundle');
      if (Object.getPrototypeOf(bundle.files) !== Array.prototype || Reflect.ownKeys(bundle.files).length !== 3 ||
          !['0', '1', 'length'].every(key => Object.hasOwn(bundle.files, key)) ||
          ['0', '1'].some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(bundle.files, key), 'value'))) throw fail('invalid_bundle');
      // Snapshot every primitive before the first await; no mutable caller data
      // is consulted after its hash has been verified.
      const seen = new Set(); let total = 0;
      const files = bundle.files.map(file => {
        record(file, ['name', 'sha256', 'content']);
        const {name, sha256, content} = file;
        if (!NAMES.includes(name) || seen.has(name) || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256) || typeof content !== 'string') throw fail('invalid_bundle');
        seen.add(name);
        if (content.length > MAX_FILE_BYTES) throw fail('bundle_too_large');
        const bytes = new TextEncoder().encode(content);
        total += bytes.length;
        if (bytes.length > MAX_FILE_BYTES || total > MAX_TOTAL_BYTES) throw fail('bundle_too_large');
        return {name, sha256, bytes};
      });
      if (typeof crypto?.subtle?.digest !== 'function') throw fail('crypto_unavailable');
      for (const file of files) {
        await check();
        const digest = await crypto.subtle.digest('SHA-256', file.bytes);
        await check();
        if (Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') !== file.sha256) throw fail('hash_mismatch');
      }
      return files;
    }
    async function run({handle, bundle, guard = () => true} = {}) {
      const result = {installed: [], preserved: [], present: []};
      if (typeof guard !== 'function') throw fail('invalid_guard');
      const check = async () => { if (await guard() === false) throw fail('stale_operation'); };
      const call = async action => { await check(); const value = await action(); await check(); return value; };
      async function permission() {
        if (typeof handle?.queryPermission !== 'function' || typeof handle?.getFileHandle !== 'function') throw fail('invalid_handle');
        for (const mode of ['read', 'readwrite']) {
          if (await call(() => handle.queryPermission({mode})) !== 'granted') throw fail('permission_denied');
        }
      }
      async function existing(name) {
        try { return await call(() => handle.getFileHandle(name)); }
        catch (error) { if (error.name === 'NotFoundError') return null; throw error; }
      }
      async function classify(fileHandle, file) {
        const stored = await call(() => fileHandle.getFile());
        if (stored.size !== file.bytes.length) { result.preserved.push(file.name); return; }
        const bytes = new Uint8Array(await call(() => stored.arrayBuffer()));
        const same = bytes.length === file.bytes.length && bytes.every((byte, index) => byte === file.bytes[index]);
        result[same ? 'present' : 'preserved'].push(file.name);
      }
      try {
        const files = await validate(bundle, check);
        await permission();
        for (const file of files) {
          let current = await existing(file.name);
          if (current) { await classify(current, file); continue; }
          await permission();
          current = await existing(file.name);
          if (current) { await classify(current, file); continue; }
          const created = await call(() => handle.getFileHandle(file.name, {create: true}));
          const empty = await call(() => created.getFile());
          if (empty.size !== 0) { await classify(created, file); continue; }
          let writable;
          try {
            await permission();
            // Chrome 121+ honors exclusive; Chrome 116 ignores unknown dictionary
            // members. Do not retry failures with a weaker writer mode.
            await check();
            writable = await created.createWritable({keepExistingData: true, mode: 'exclusive'});
            await check();
            const before = await call(() => created.getFile());
            if (before.size !== 0 || before.lastModified !== empty.lastModified) throw fail('file_changed');
            await permission();
            await call(() => writable.write(file.bytes));
            const latest = await existing(file.name);
            if (!latest) throw fail('file_changed');
            if (typeof created.isSameEntry === 'function' && !await call(() => created.isSameEntry(latest))) throw fail('file_changed');
            const final = await call(() => latest.getFile());
            if (final.size !== 0 || final.lastModified !== empty.lastModified) throw fail('file_changed');
            await permission();
            await call(() => writable.close());
            writable = null;
            const saved = await existing(file.name);
            if (!saved) throw fail('readback_failed');
            const savedFile = await call(() => saved.getFile());
            if (savedFile.size !== file.bytes.length) throw fail('readback_failed');
            const readback = new Uint8Array(await call(() => savedFile.arrayBuffer()));
            if (readback.length !== file.bytes.length || !readback.every((byte, index) => byte === file.bytes[index])) throw fail('readback_failed');
            result.installed.push(file.name);
          } finally {
            // Abort the temporary stream even if the source/permission guard was
            // revoked. Never delete the entry: another client may now own it.
            if (writable && typeof writable.abort === 'function') { try { await writable.abort(); } catch (_) {} }
          }
        }
        return result;
      } catch (error) {
        error.result = result;
        throw error;
      }
    }
    function install(options) {
      const action = () => typeof locks?.request === 'function' ? locks.request(LOCK, {mode: 'exclusive'}, () => run(options)) : run(options);
      const pending = queue.then(action);
      queue = pending.catch(() => {});
      return pending;
    }
    return Object.freeze({install});
  }
  let singleton;
  return Object.freeze({create, install(options) { if (!singleton) singleton = create(); return singleton.install(options); }});
});
