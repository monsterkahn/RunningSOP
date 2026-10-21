'use strict';
(function (root, factory) {
  const api = factory(root);
  root.RunningSOPDeviceName = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const KEY = 'runtime-sop-device-name-v1';
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PREFIXES = Object.freeze({mac:'Mac',win:'Win',linux:'Lin',cros:'CrOS',android:'And',openbsd:'BSD',fuchsia:'Fuch'});
  function fail(code) { const error = Error('Device name: '+code);error.code = code;return error; }
  function validate(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || ![Object.prototype,null].includes(Object.getPrototypeOf(record))) throw fail('invalid_record');
    const keys = Reflect.ownKeys(record);
    if (keys.length !== 3 || keys.some(key => !['schemaVersion','os','name'].includes(key)) || record.schemaVersion !== 1 || typeof record.os !== 'string' || !Object.hasOwn(PREFIXES,record.os)) throw fail('invalid_record');
    const prefix = PREFIXES[record.os]+'-';
    if (typeof record.name !== 'string' || !record.name.startsWith(prefix) || record.name.length !== prefix.length+4 || [...record.name.slice(prefix.length)].some(letter => !ALPHABET.includes(letter))) throw fail('invalid_record');
    return {schemaVersion:1,os:record.os,name:record.name};
  }
  function create({storage=root.chrome?.storage?.local,getPlatformInfo=()=>root.chrome.runtime.getPlatformInfo(),crypto=root.crypto,locks=root.navigator?.locks}={}) {
    let pending = null;
    async function read() {
      if (typeof storage?.get !== 'function') throw fail('storage_unavailable');
      const values = await storage.get(KEY);
      if (!values || typeof values !== 'object' || Array.isArray(values)) throw fail('storage_error');
      return values[KEY] === undefined ? null : validate(values[KEY]);
    }
    async function loadOrCreate() {
      const existing = await read();
      if (existing) return existing.name;
      // The lock is shared by extension pages of this origin. Re-read inside it
      // so that simultaneous first use cannot create different local names.
      if (typeof locks?.request !== 'function') throw fail('locks_unavailable');
      return locks.request(KEY,{mode:'exclusive'},async()=>{
        const saved = await read();
        if (saved) return saved.name;
        if (typeof storage?.set !== 'function') throw fail('storage_unavailable');
        if (typeof getPlatformInfo !== 'function') throw fail('platform_unavailable');
        const platform = await getPlatformInfo(), os = platform?.os;
        if (typeof os !== 'string' || !Object.hasOwn(PREFIXES,os)) throw fail('unsupported_platform');
        if (typeof crypto?.getRandomValues !== 'function') throw fail('crypto_unavailable');
        const bytes = new Uint8Array(4);crypto.getRandomValues(bytes);
        // The alphabet has 32 entries, which divides 256 exactly: no bias and
        // no account, host name, network address or browser fingerprint input.
        const name = PREFIXES[os]+'-'+Array.from(bytes,byte=>ALPHABET[byte % ALPHABET.length]).join('');
        const record = validate({schemaVersion:1,os,name});
        await storage.set({[KEY]:record});
        const verified = await read();
        if (!verified || verified.os !== record.os || verified.name !== record.name) throw fail('readback_failed');
        return verified.name;
      });
    }
    function get() {
      if (!pending) pending = (async()=>{try{return await loadOrCreate();}finally{pending=null;}})();
      return pending;
    }
    return Object.freeze({get});
  }
  let singleton;
  return Object.freeze({KEY,create,get:()=>{if(!singleton)singleton=create();return singleton.get();}});
});
