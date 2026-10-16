'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Recorder = require('../extension/recorder-runtime.js');
const { MAX_DRAFTS, MAX_STEPS, MAX_SHOT, MAX_TOTAL } = Recorder.constants;

const baseDraft = (overrides = {}) => ({
  id: 'draft-1', title: '上传流程', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  origin: 'https://studio.example.com', status: 'draft', steps: [], ...overrides
});
const baseState = (drafts = [baseDraft()]) => ({ drafts, session: null });

assert.deepEqual(Recorder.safePageUrl('https://studio.example.com/upload?id=sample#step'), {
  origin: 'https://studio.example.com', url: 'https://studio.example.com/upload'
});
assert.equal(Recorder.safePageUrl('chrome://settings'), '');
assert.deepEqual(Recorder.safePageUrl('file:///tmp/private.html?view=one#section'), {
  origin: 'file:///tmp/private.html?view=one#section', url: 'file:///tmp/private.html?view=one#section'
});
assert.equal(Recorder.safePageUrl('javascript:alert(1)'), '');
assert.equal(Recorder.safeWorkUrl('file:///tmp/private.html'), 'file:///tmp/private.html');
assert.throws(() => Recorder.safeWorkUrl('javascript:alert(1)'), /HTTP\(S\)|file/);
assert.throws(() => Recorder.safeWorkUrl('chrome://settings'), /HTTP\(S\)|file/);
assert.equal(Recorder.safePageUrl('https://studio.example.com:443/path?q=private#secret').url, 'https://studio.example.com/path');

const editable = Recorder.validateState({
  drafts: [baseDraft({ steps: [{ id: 'manual-1', type: 'manual', title: '手动补充步骤', url: '', where: '', action: '', expected: '', acceptance: '', trouble: '', at: '2026-01-01T00:00:00.000Z' }] })],
  session: null
});
assert.equal(editable.drafts[0].steps[0].url, 'https://studio.example.com/');
assert.equal(editable.drafts[0].steps[0].acceptance, '');

assert.throws(() => Recorder.validateState({ drafts: new Array(MAX_DRAFTS + 1).fill(0).map((_, i) => baseDraft({ id: `d${i}` })), session: null }), /无效/);
assert.throws(() => Recorder.validateState(baseState([baseDraft({ steps: new Array(MAX_STEPS + 1).fill(0).map((_, i) => ({ id: `s${i}`, type: 'click' })) })])), /无效/);
assert.throws(() => Recorder.validateState(baseState([baseDraft({ origin: 'https://studio.example.com/path' })])), /网址无效/);
assert.throws(() => Recorder.validateState(baseState([baseDraft({ steps: [{ id: 's1', type: 'click', title:'',where:'',action:'',expected:'',acceptance:'',trouble:'', image: `data:image/jpeg;base64,${'A'.repeat(MAX_SHOT)}` }] })])), /截图格式或大小无效/);
assert.throws(() => Recorder.validateState(baseState([baseDraft({ steps: [{ id: 's1', type: 'other' }] })])), /步骤格式无效/);

const tooLarge = baseState([baseDraft({ steps: [{ id: 's1', type: 'manual', title: 'x'.repeat(MAX_TOTAL), url: '', where: '', action: '', expected: '', acceptance: '', trouble: '', at: '' }] })]);
assert.throws(() => Recorder.ensureBudget(tooLarge), /4 MB/);
assert.deepEqual(Recorder.ensureBudget(baseState()), baseState());

function loadBackgroundMock() {
  const key = Recorder.constants.KEY;
  const data = {};
  let messageListener;
  let updatedListener;
  let allowedFileAccess = false;
  let injectCount = 0;
  const tab = { id: 7, active: true, url: 'file:///tmp/manual.html?draft=1#edit' };
  const chrome = {
    runtime: {
      id: 'unit-extension',
      getURL: file => `chrome-extension://unit-extension/${file}`,
      onMessage: { addListener: fn => { messageListener = fn; } }
    },
    extension: { isAllowedFileSchemeAccess: async () => allowedFileAccess },
    storage: { local: {
      get: async name => ({ [name]: data[name] }),
      set: async values => Object.assign(data, values)
    } },
    tabs: {
      get: async id => id === tab.id ? { ...tab } : null,
      sendMessage: async () => ({ ok: true }),
      onActivated: { addListener() {} }, onUpdated: { addListener: fn => { updatedListener = fn; } }, onRemoved: { addListener() {} }
    },
    scripting: { executeScript: async () => { injectCount++; } }
  };
  const context = { chrome, URL, TextEncoder, Date, Math, setTimeout, clearTimeout, console };
  context.self = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'extension', 'recorder-runtime.js'), 'utf8'), context, { filename: 'recorder-runtime.js' });
  context.SOPRecorder.registerBackground();
  const send = (type, extra = {}) => new Promise(resolve => {
    messageListener({ type, ...extra }, { id: chrome.runtime.id, url: chrome.runtime.getURL('workspace.html') }, resolve);
  });
  return { send, setFileAccess: value => { allowedFileAccess = value; }, getInjectCount: () => injectCount, getStored: () => data[key], navigate: async (url, phase) => { tab.url=url; await updatedListener(tab.id, {status:phase,url}); }, setTabUrl: url => { tab.url = url; } };
}

(async () => {
  const mock = loadBackgroundMock();
  const created = await mock.send('recorder-create', { workUrl: 'file:///tmp/manual.html?draft=1#edit', title: '本机文件 SOP' });
  assert(created.data, created.error || 'file URL manual draft should be created');
  let fileDraft = created.data.drafts[0];
  assert.equal(fileDraft.origin, 'file:///tmp/manual.html?draft=1#edit');
  assert.equal(fileDraft.steps[0].workUrl, 'file:///tmp/manual.html?draft=1#edit');

  const updated = await mock.send('recorder-update', { id: fileDraft.id, patch: { title: '已保存文件 SOP', steps: [{
    id: 'step-file', type: 'manual', title: '打开本地页面', url: 'file:///tmp/second.html#anchor', workUrl: 'file:///tmp/second.html#anchor',
    where: '本机页面', action: '打开文件', expected: '页面显示', acceptance: '确认页面', trouble: '', at: ''
  }] } });
  assert(updated.data, updated.error || 'file URL draft should update and save');
  const saved = await mock.send('recorder-get');
  assert(saved.data, saved.error || 'saved file URL draft should reload');
  assert.equal(saved.data.drafts[0].title, '已保存文件 SOP');
  assert.equal(saved.data.drafts[0].steps[0].workUrl, 'file:///tmp/second.html#anchor');
  assert.equal(Recorder.validateState(mock.getStored()).drafts[0].origin, fileDraft.origin);

  const rejected = await mock.send('recorder-create', { workUrl: 'javascript:alert(1)' });
  assert(rejected.error && /HTTP\(S\)|file/.test(rejected.error), 'unsafe protocols must be rejected when creating a draft');

  const deniedStart = await mock.send('recorder-start', { tabId: 7, title: '文件页记录' });
  assert(deniedStart.error && /允许访问文件网址/.test(deniedStart.error));
  assert.equal(mock.getInjectCount(), 0, 'file injection must not run before file access is enabled');
  mock.setFileAccess(true);
  const started = await mock.send('recorder-start', { tabId: 7, title: '文件页记录' });
  assert(started.data?.session, started.error || 'recording should start after explicit file access is enabled');
  assert.equal(mock.getInjectCount(), 1);
  await mock.navigate('file:///tmp/other.html#edit', 'loading');
  assert.equal(mock.getStored().session.status, 'recording', 'same-tab navigation remains recording while loading');
  await mock.navigate('file:///tmp/other.html#edit', 'complete');
  assert.equal(mock.getStored().session.status, 'paused', 'distinct file identity pauses recording');
  assert.match(mock.getStored().session.reason, /本地文件地址已变化/);
  await mock.send('recorder-stop');
  // A stop issued while navigation is pending clears the session; completion must not restart it.
  mock.setTabUrl('file:///tmp/manual.html?draft=1#edit');
  const restarted = await mock.send('recorder-start', { tabId: 7, title: '停止竞态检查' });
  assert(restarted.data?.session, restarted.error || 'recording should restart for race check');
  const injectionBeforePendingStop = mock.getInjectCount();
  await mock.navigate('file:///tmp/manual.html?draft=1#edit', 'loading');
  await mock.send('recorder-stop');
  await mock.navigate('file:///tmp/manual.html?draft=1#edit', 'complete');
  assert.equal(mock.getStored().session, null, 'navigation completion must not resume a stopped session');
  assert.equal(mock.getInjectCount(), injectionBeforePendingStop, 'stopped pending navigation must not inject the content script');
  const tinyJpeg = `data:image/jpeg;base64,/9j/${'A'.repeat(32)}`;
  const picture = await mock.send('recorder-picture', { id:fileDraft.id, stepId:null, image:tinyJpeg, imageAt:'2026-10-15T00:00:00.000Z', workUrl:'file:///tmp/manual.html?draft=1#edit' });
  assert(picture.data, picture.error || 'image-only screenshot RPC should save an appended screenshot step');
  assert.equal(picture.data.drafts[0].steps.length, 2);
  assert.equal(picture.data.drafts[0].steps[0].id, 'step-file', 'screenshot append must preserve prior steps');
  const stalePicture = await mock.send('recorder-picture', { id:fileDraft.id, stepId:'step-file', image:tinyJpeg, imageAt:'2026-10-15T00:00:00.000Z', expectedImage:'data:image/jpeg;base64,/9j/stale' });
  assert(stalePicture.error && /截图已变化/.test(stalePicture.error), 'stale screenshot edit must be rejected');
  // Start a fresh session to keep the file-permission resume check meaningful.
  const again = await mock.send('recorder-start', { tabId: 7, title: '文件页记录' });
  assert(again.data?.session, again.error || 'recording should start after stop');
  await mock.send('recorder-pause');
  const pausedEdit = await mock.send('recorder-update', { id:again.data.session.draftId, patch:{ title:'暂停中整理' } });
  assert(pausedEdit.data, pausedEdit.error || 'paused session draft should be editable');
  assert.equal(pausedEdit.data.session.status, 'paused', 'paused edit must retain the resumable session');
  mock.setFileAccess(false);
  const beforeDeniedResume = mock.getInjectCount();
  const deniedResume = await mock.send('recorder-resume');
  assert(deniedResume.error && /允许访问文件网址/.test(deniedResume.error));
  assert.equal(mock.getInjectCount(), beforeDeniedResume, 'denied file permission must block resume injection');
  await mock.send('recorder-stop');
  mock.setTabUrl('https://example.test/start');
  const httpStart = await mock.send('recorder-start', { tabId:7, title:'同源网页跟随' });
  assert(httpStart.data?.session, httpStart.error || 'HTTP recording should start');
  const beforeFollow = mock.getInjectCount();
  await mock.navigate('https://example.test/next?private=value', 'loading');
  assert.equal(mock.getStored().session.status, 'recording', 'HTTP same-origin loading keeps recording');
  await mock.navigate('https://example.test/next?private=value', 'complete');
  assert.equal(mock.getStored().session.status, 'recording', 'HTTP same-origin navigation follows on completion');
  assert.equal(mock.getInjectCount(), beforeFollow + 1, 'new same-origin document receives recorder injection');
  assert.equal(mock.getStored().drafts.at(-1).steps[0].url, 'https://example.test/next', 'navigation step strips query values');
  await mock.navigate('https://other.test/page', 'loading');
  await mock.navigate('https://other.test/page', 'complete');
  assert.equal(mock.getStored().session.status, 'paused', 'cross-origin navigation pauses by default');
  assert.match(mock.getStored().session.reason, /https:\/\/other\.test/);

  await mock.send('recorder-stop');
  mock.setTabUrl('https://example.test/guided');
  const guided=await mock.send('recorder-start',{tabId:7,title:'New workflow',guided:true});
  assert(guided.data?.session?.guided,guided.error);
  const guidedId=guided.data.session.draftId;
  let gd=guided.data.drafts.find(d=>d.id===guidedId);
  assert.equal(gd.steps.length,1);
  assert.equal(gd.steps[0].title,'');
  const renamed=await mock.send('recorder-update',{id:guidedId,patch:{title:'Renamed while recording'}});
  assert.equal(renamed.data.session.status,'recording');
  const changed=await mock.send('recorder-update',{id:guidedId,patch:{steps:[{...gd.steps[0],action:'Prepare report',pointType:'report',pointNote:'Send the summary to the team lead.'}]}});
  assert(changed.data,changed.error);
  const next=await mock.send('recorder-next-step',{id:guidedId});
  gd=next.data.drafts.find(d=>d.id===guidedId);
  assert.equal(gd.steps.length,2);
  assert.equal(gd.steps[0].pointType,'report');
  assert.equal(gd.steps[1].title,'');
  await mock.navigate('https://example.test/changed','complete');
  assert.equal(mock.getStored().drafts.find(d=>d.id===guidedId).steps.length,2);
  const nextAgain=await mock.send('recorder-next-step',{id:guidedId});
  assert.equal(nextAgain.data.drafts.find(d=>d.id===guidedId).steps[2].workUrl,'https://example.test/changed');
  const ended=await mock.send('recorder-stop');
  assert.equal(ended.data.session,null);
  assert.equal(ended.data.drafts.find(d=>d.id===guidedId).title,'Renamed while recording');
  console.log('Recorder core checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
