(function (root, factory) {
  'use strict';
  const api = factory(); root.RunningSOPTeamEditSession = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function failure(code) { const e = Error('Team editing: ' + code); e.code = code; return e; }
  function create(options) {
    const client = options.client, saveDraft = options.saveDraft;
    if (!client || typeof saveDraft !== 'function') throw failure('invalid_configuration');
    const clock = options.monotonicNow || (() => performance.now());
    const later = options.setTimeout || setTimeout, cancel = options.clearTimeout || clearTimeout;
    const configKey = options.configKey === undefined ? client.endpoint : options.configKey;
    let phase = 'idle', sopId, draft, lease, deadline = 0, timer, pending, epoch = 0, invalidated = false, busy = false, activeController;
    function stopTimer() { if (timer !== undefined) cancel(timer); timer = undefined; }
    function snapshot() { return {phase,id:sopId,remainingMs:lease ? Math.max(0,deadline-clock()) : 0,baseRevision:lease?.baseRevision,hasDraft:draft !== undefined,hasPendingPublish:!!pending,configKey}; }
    function emit() { if (options.onChange) options.onChange(snapshot()); }
    function checkEpoch(value) { if (value !== epoch || invalidated) throw failure('configuration_changed'); }
    function allowed() { if (invalidated) throw failure('configuration_changed'); if (busy) throw failure('busy'); }
    async function persist() { if (draft !== undefined) await saveDraft(clone(draft),{id:sopId,configKey}); }
    function acceptLease(value, sentAt) {
      const duration = Math.min(value.expiresAt - value.serverTime,value.leaseMs);
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 1 || !value.token || !Number.isSafeInteger(value.fence)) throw failure('invalid_lease');
      // Subtract the whole request duration conservatively. Local wall-clock
      // time never participates in expiry calculations.
      lease = clone(value); deadline = sentAt + duration;
      if (deadline <= clock()) throw failure('lease_expired');
    }
    function schedule() {
      stopTimer(); if (phase !== 'editing') return;
      const remaining = deadline-clock();
      timer = later(async () => { timer = undefined; try { await renew(); } catch (_) { /* State and draft handled by renew. */ } },Math.max(1,Math.min(10000,remaining/3)));
    }
    async function lost(e, expectedEpoch) {
      if (expectedEpoch === epoch) { stopTimer(); phase = 'lost'; emit(); await persist(); }
      throw e;
    }
    async function start(id, initialDraft, context = {}) {
      allowed(); if (phase !== 'idle' && phase !== 'released' && phase !== 'published') throw failure('already_editing');
      if (context.configKey !== undefined && context.configKey !== configKey) throw failure('configuration_changed');
      busy = true; sopId = id; draft = clone(initialDraft); phase = 'acquiring'; const current = epoch; activeController = new AbortController(); emit();
      try { await persist(); checkEpoch(current); const sentAt = clock(); const acquired = await client.acquireLock(id,{signal:activeController.signal}); checkEpoch(current); acceptLease(acquired,sentAt); phase = 'editing'; schedule(); emit(); return snapshot(); }
      catch (e) { return await lost(e,current); }
      finally { busy = false; activeController = undefined; }
    }
    async function renew() {
      allowed(); if (phase !== 'editing') throw failure('not_editing');
      if (clock() >= deadline) return lost(failure('lease_expired'),epoch);
      busy = true; stopTimer(); const current = epoch; activeController = new AbortController();
      try { const sentAt = clock(); const renewed = await client.renewLock(sopId,lease,{signal:activeController.signal}); checkEpoch(current); if (renewed.token !== lease.token || renewed.fence !== lease.fence || renewed.baseRevision !== lease.baseRevision) throw failure('lease_changed'); acceptLease(renewed,sentAt); schedule(); emit(); return snapshot(); }
      catch (e) { return await lost(e,current); }
      finally { busy = false; activeController = undefined; }
    }
    async function sendPublish() {
      const current = epoch; let requestSent = false; busy = true; stopTimer(); phase = 'publishing'; activeController = new AbortController(); emit();
      try {
        await persist(); if(options.savePending) await options.savePending(clone({id:sopId,...pending})); checkEpoch(current);
        requestSent = true; const result = await client.publish(sopId,clone(pending.guide),{lease:clone(pending.lease),expectedRevision:pending.expectedRevision,idempotencyKey:pending.key,signal:activeController.signal});
        checkEpoch(current); if(options.savePending) await options.savePending(null); phase = 'published'; pending = undefined; lease = undefined; emit(); return result;
      } catch (e) {
        if (current === epoch) { const uncertain = requestSent && !(Number.isInteger(e.status) && e.status >= 400 && e.status < 500); phase = uncertain ? 'uncertain' : 'lost'; if (!uncertain && options.savePending) { await options.savePending(null); pending = undefined; } emit(); await persist(); }
        throw e;
      } finally { busy = false; activeController = undefined; }
    }
    async function publish(value) {
      allowed(); if (phase !== 'editing' || !lease) throw failure('not_editing');
      if (value !== undefined) draft = clone(value);
      if (clock() >= deadline) return lost(failure('lease_expired'),epoch);
      pending = {guide:clone(draft),lease:clone(lease),expectedRevision:lease.baseRevision,key:client.newIdempotencyKey()};
      return sendPublish();
    }
    function restorePending(value) { allowed(); if(phase !== 'idle') throw failure('already_editing'); if(!value || value.id !== value.guide?.workflowId || !value.key || !value.lease?.token || !Number.isSafeInteger(value.expectedRevision)) throw failure('invalid_pending_publish'); sopId=value.id;pending=clone({guide:value.guide,key:value.key,lease:value.lease,expectedRevision:value.expectedRevision});draft=clone(value.guide);lease=clone(value.lease);deadline=0;phase='uncertain';emit(); }
    async function retryPublish() { allowed(); if (phase !== 'uncertain' || !pending) throw failure('no_pending_publish'); return sendPublish(); }
    async function setDraft(value) { if (invalidated) throw failure('configuration_changed'); draft = clone(value); await persist(); emit(); }
    async function release(value) {
      allowed(); if (value !== undefined) draft = clone(value);
      if (phase === 'uncertain') { await persist(); throw failure('publish_uncertain'); }
      busy = true; stopTimer(); const current = epoch; activeController = new AbortController();
      try { await persist(); checkEpoch(current); if (lease && phase === 'editing' && clock() < deadline) await client.releaseLock(sopId,clone(lease),{signal:activeController.signal}); checkEpoch(current); lease = undefined; phase = 'released'; emit(); return snapshot(); }
      catch (e) { if (current === epoch) { phase = 'lost'; emit(); } throw e; }
      finally { busy = false; activeController = undefined; }
    }
    async function invalidate(nextKey) {
      if (nextKey === configKey && !invalidated) return snapshot();
      invalidated = true; epoch++; stopTimer(); if (activeController) activeController.abort(); lease = undefined; phase = 'invalidated'; emit(); await persist(); return snapshot();
    }
    async function dispose() { invalidated = true; epoch++; stopTimer(); if (activeController) activeController.abort(); lease = undefined; phase = 'disposed'; emit(); await persist(); }
    return Object.freeze({start,renew,setDraft,publish,restorePending,retryPublish,release,invalidate,dispose,snapshot});
  }
  return Object.freeze({create});
});
