'use strict';
(function (root) {
  const KEY = 'runtime-sop-recorder-v1';
  const MAX_DRAFTS = 10, MAX_STEPS = 100, MAX_SHOT = 200 * 1024, MAX_TOTAL = 4 * 1024 * 1024;
  const TYPES = new Set(['click', 'field', 'manual', 'navigation']);
  const extensionEnabled = Boolean(root.chrome && root.chrome.runtime && root.chrome.storage && root.chrome.tabs && root.chrome.scripting);
  let queue = Promise.resolve();
  let initialized = false;
  let initializePromise = null;

  const trim = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
  function field(value,max){if(typeof value!=='string'||value.length>max)throw Error('步骤文字格式无效或超过长度限制。');return trim(value,max);}
  function imageValid(value){return typeof value==='string'&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)&&byteLength(value)<=MAX_SHOT;}
  function safeWorkUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw Error('工作网址无效。');
    let url;
    try { url = new URL(value); } catch (_) { throw Error('工作网址必须是 HTTP(S) 或 file:// 地址。'); }
    if (url.protocol === 'file:') {
      if (url.username || url.password || url.port || !url.pathname.startsWith('/') || url.pathname.includes('\\') || /%2f|%5c/i.test(url.pathname)) throw Error('本机工作网址必须是规范、无凭据的 file:// 地址。');
      return url.href;
    }
    if (!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error('工作网址必须是无凭据的 HTTP(S) 或 file:// 地址。');
    return value;
  }
  function validatedIssues(value) {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > 10) throw Error('问题数量无效。');
    const ids = new Set();
    return value.map(issue => {
      const allowed = ['id','title','actions','next','image','imageAt','imageMarks'];
      if (!issue || typeof issue !== 'object' || Array.isArray(issue) || Object.keys(issue).some(k => !allowed.includes(k))) throw Error('问题字段无效。');
      if (typeof issue.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(issue.id) || ids.has(issue.id)) throw Error('问题 ID 无效或重复。');
      ids.add(issue.id);
      if (typeof issue.title !== 'string' || !issue.title.trim() || issue.title.length > 160 || !Array.isArray(issue.actions) || issue.actions.length < 1 || issue.actions.length > 20 || issue.actions.some(a => typeof a !== 'string' || !a.trim() || a.length > 1500) || typeof issue.next !== 'string' || issue.next.length > 1500) throw Error('问题内容无效。');
      const out = {id:issue.id,title:issue.title,actions:[...issue.actions],next:issue.next};
      if (issue.image !== undefined) { if (!imageValid(issue.image)) throw Error('问题截图格式或大小无效。'); out.image = issue.image; }
      if (issue.imageAt !== undefined) {
        if (typeof issue.imageAt !== 'string' || issue.image === undefined || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(issue.imageAt) || !Number.isFinite(Date.parse(issue.imageAt))) throw Error('问题截图时间无效。');
        out.imageAt = issue.imageAt;
      }
      if (issue.imageMarks !== undefined) {
        if (issue.image === undefined || !marksAPI()) throw Error('问题标记必须附属于截图。');
        out.imageMarks = marksAPI().validate(issue.imageMarks);
      }
      if ((issue.imageAt !== undefined || issue.imageMarks !== undefined) && issue.image === undefined) throw Error('问题截图标记或时间必须对应截图。');
      return out;
    });
  }
  function pointFields(step) {
    const out={};
    if(step.pointType!==undefined){if(!['normal','report','approval','both'].includes(step.pointType))throw Error('步骤节点类型无效。');out.pointType=step.pointType;}
    if(step.pointNote!==undefined){if(typeof step.pointNote!=='string'||step.pointNote.length>1500)throw Error('节点要求不能超过 1500 字。');out.pointNote=step.pointNote;}
    return out;
  }
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const now = () => new Date().toISOString();
  function safePageUrl(value) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return '';
      if (url.protocol === 'file:') {
        if (url.port || !url.pathname.startsWith('/') || url.pathname.includes('\\') || /%2f|%5c/i.test(url.pathname)) return '';
        // file: URLs have the opaque origin "null"; retain the exact canonical
        // local/shared file URL as this draft's identity instead.
        const href = url.href;
        return { origin: href, url: href };
      }
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      return { origin: url.origin, url: url.origin + url.pathname };
    } catch (_) { return ''; }
  }
  async function fileSchemeAccessAllowed() {
    const api = root.chrome?.extension?.isAllowedFileSchemeAccess;
    if (typeof api !== 'function') return false;
    return await new Promise(resolve => {
      let settled = false;
      const finish = value => { if (settled) return; settled = true; resolve(Boolean(value)); };
      try {
        const result = api.call(root.chrome.extension, finish);
        if (result && typeof result.then === 'function') result.then(finish, () => finish(false));
        else if (typeof result === 'boolean') finish(result);
      } catch (_) {
        try {
          const result = api.call(root.chrome.extension);
          if (result && typeof result.then === 'function') result.then(finish, () => finish(false));
          else finish(Boolean(result));
        } catch (__) { finish(false); }
      }
      setTimeout(() => finish(false), 2000);
    });
  }
  const fileAccessInstruction = '请在 Chrome 扩展详情中开启“允许访问文件网址”，再开始或恢复记录。';
  function defaultState() { return { drafts: [], session: null }; }
  function validateState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.drafts) || value.drafts.length > MAX_DRAFTS) throw Error('录制数据格式无效，已保留原数据，请导出或联系维护者。');
    const draftIds=new Set();
    const drafts = value.drafts.map((draft) => {
      if (!draft || typeof draft !== 'object' || typeof draft.id !== 'string' || typeof draft.title !== 'string' || !['recording', 'paused', 'draft'].includes(draft.status) || !Array.isArray(draft.steps) || draft.steps.length > MAX_STEPS) throw Error('录制草稿格式无效，已保留原数据。');
      if(!/^[a-zA-Z0-9-]{1,100}$/.test(draft.id)||draftIds.has(draft.id))throw Error('草稿标识重复或无效。');draftIds.add(draft.id);
      const stepIds=new Set();
      const page = safePageUrl(draft.origin);
      if (!page || page.origin !== draft.origin) throw Error('录制草稿网址无效，已保留原数据。');
      const steps = draft.steps.map((step) => {
        if (!step || typeof step !== 'object' || typeof step.id !== 'string' || !TYPES.has(step.type)) throw Error('录制步骤格式无效，已保留原数据。');
        if(!/^[a-zA-Z0-9-]{1,100}$/.test(step.id)||stepIds.has(step.id))throw Error('步骤标识重复或无效。');stepIds.add(step.id);
        const s = { ...pointFields(step), id: step.id, type: step.type, title: field(step.title, 200), url: safePageUrl(step.url)?.url || page.url, where: field(step.where, 500), action: field(step.action, 1500), expected: field(step.expected, 1500), acceptance: field(step.acceptance, 1500), trouble: field(step.trouble, 1500), at: typeof step.at === 'string' ? step.at : '' };
        if (step.workUrl !== undefined) s.workUrl = safeWorkUrl(step.workUrl);
        if (step.imageMode !== undefined) { if (!['thumbnail','collapsed','expanded'].includes(step.imageMode)) throw Error('截图显示模式无效。'); s.imageMode = step.imageMode; }
        if (step.issues !== undefined) s.issues = validatedIssues(step.issues);
        if (typeof step.image === 'string') {
          if (!imageValid(step.image)) throw Error('截图格式或大小无效，已保留原数据。');
          s.image = step.image; s.imageAt = typeof step.imageAt === 'string' ? step.imageAt : '';
          if(step.imageMarks!==undefined)s.imageMarks=marksAPI().validate(step.imageMarks);
        }
        else if(step.imageMarks!==undefined)throw Error('标记必须附属于截图。');
        return s;
      });
      return { id: draft.id, title: trim(draft.title, 160) || '未命名 SOP 草稿', createdAt: String(draft.createdAt || ''), updatedAt: String(draft.updatedAt || ''), origin: draft.origin, status: draft.status, steps };
    });
    let session = value.session;
    if (session !== null) {
      if (!session || typeof session !== 'object' || typeof session.draftId !== 'string' || !Number.isInteger(session.tabId) || !['recording', 'paused'].includes(session.status) || typeof session.token !== 'string' || !safePageUrl(session.origin)) throw Error('录制会话格式无效，已保留原数据。');
      if(!drafts.some(d=>d.id===session.draftId&&d.origin===session.origin&&d.status===session.status))throw Error('录制会话与草稿不一致。');
      if (Object.keys(session).some(k => !['draftId','tabId','origin','status','token','currentUrl','pageTitle','followStatus','reason','guided','latestAction'].includes(k))) throw Error('录制会话字段无效，已保留原数据。');
      session = { draftId: session.draftId, tabId: session.tabId, origin: session.origin, status: session.status, token: session.token };
      if(value.session.guided!==undefined){if(typeof value.session.guided!=='boolean')throw Error('录制方式无效。');session.guided=value.session.guided;}
      if(value.session.latestAction!==undefined)session.latestAction=field(value.session.latestAction,600);
      if (typeof value.session.currentUrl === 'string' && value.session.currentUrl.length <= 2048) session.currentUrl = safePageUrl(value.session.currentUrl)?.url || session.origin;
      if (typeof value.session.pageTitle === 'string' && value.session.pageTitle.length <= 200) session.pageTitle = field(value.session.pageTitle, 200);
      if (['loading','following'].includes(value.session.followStatus)) session.followStatus = value.session.followStatus;
      if (typeof value.session.reason === 'string' && value.session.reason.length <= 300) session.reason = field(value.session.reason, 300);
    }
    return { drafts, session };
  }
  function byteLength(value) { return new TextEncoder().encode(value).length; }
  function marksAPI(){return root.ImageMarks||(typeof require==='function'?require('./image-marks.js'):null);}
  function ensureBudget(state) {
    const serialized = JSON.stringify(state);
    if (byteLength(serialized) > MAX_TOTAL) throw Error('录制草稿总大小已达到 4 MB，请删除旧草稿或截图后重试。');
    return state;
  }
  function importDraft(state, backup) {
    if (state?.session) throw Error('请先停止当前录制，再导入草稿。');
    state = validateState(state);
    if (state.drafts.length >= MAX_DRAFTS) throw Error('已保存 10 份草稿，请先在整理草稿中删除不需要的本机草稿。');
    if (!backup || typeof backup !== 'object' || Array.isArray(backup) || backup.format !== 'runtime-sop-recording' || backup.schemaVersion !== 1 || !backup.draft || typeof backup.draft !== 'object' || Array.isArray(backup.draft) || Object.keys(backup).some(k => !['format','schemaVersion','draft'].includes(k))) throw Error('录制备份格式无效。');
    const normalized = validateState({drafts:[backup.draft],session:null}).drafts[0];
    let id;
    do { id = makeId(); } while (state.drafts.some(d => d.id === id));
    normalized.id = id;
    normalized.createdAt = now();
    normalized.updatedAt = normalized.createdAt;
    normalized.status = 'draft';
    const next = {drafts:[...state.drafts,normalized],session:null};
    return ensureBudget(validateState(next));
  }
  async function storageRead() {
    if (!extensionEnabled) return defaultState();
    const record = (await chrome.storage.local.get(KEY))[KEY];
    return record === undefined ? defaultState() : validateState(record);
  }
  async function storageWrite(state) {
    state=ensureBudget(validateState(state));
    await chrome.storage.local.set({ [KEY]: state });
    return state;
  }
  function serialized(fn) {
    const result = queue.then(fn, fn);
    queue = result.catch(() => {});
    return result;
  }
  async function pauseSession(state, status = 'paused') {
    if (!state.session) return state;
    const s = state.session, draft = state.drafts.find((d) => d.id === s.draftId);
    if (draft) { draft.status = status === 'draft' ? 'draft' : 'paused'; draft.updatedAt = now(); }
    if (status === 'draft') state.session = null;
    else state.session = { ...s, status: 'paused' };
    try { await chrome.tabs.sendMessage(s.tabId, { type: status === 'draft' ? 'recorder-content-stop' : 'recorder-content-pause', token: s.token }); } catch (_) {}
    await storageWrite(state); return state;
  }
  async function initialize() {
    if (initialized) return;
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      if (!extensionEnabled) { initialized = true; return; }
      const state = await storageRead();
      if (state.session?.status === 'recording') { state.session.status = 'paused'; const draft = state.drafts.find((d) => d.id === state.session.draftId); if (draft) { draft.status = 'paused'; draft.updatedAt = now(); } await storageWrite(state); }
      initialized = true;
    })();
    try { await initializePromise; } finally { initializePromise = null; }
  }
  async function getResponse() { await initialize(); await queue; return await storageRead(); }
  function extensionPage(sender) {
    return Boolean(sender?.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL('')));
  }
  async function inject(tabId, message) {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['recorder-content.js'] });
    const answer = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
    if (!answer?.ok) throw Error('无法启动网页记录。请确认网页允许扩展访问后重试。');
  }
  async function start(message) {
    await initialize();
    return serialized(async () => {
      const state = await storageRead();
      if (state.session) throw Error('当前已有录制会话，请先暂停或停止。');
      if(state.drafts.length>=MAX_DRAFTS)throw Error('已保存 10 份草稿，请先在整理草稿中删除不需要的本机草稿。');
      const tab = await chrome.tabs.get(message.tabId);
      if (!tab.active) throw Error('请先切换到目标网页，再开始录制。');
      const page = safePageUrl(tab.url || '');
      if (!page) throw Error('只能在普通 http、https 或 file:// 页面录制。');
      if (page.origin.startsWith('file:') && !await fileSchemeAccessAllowed()) throw Error(fileAccessInstruction);
      const token = makeId(), id = makeId(), createdAt = now();
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['recorder-content.js'] }); }
      catch (_) { throw Error('无法访问此网页。请在扩展详情中允许访问目标网站，然后重新开始录制。'); }
      const draft = { id, title: trim(message.title, 160) || '未命名 SOP 草稿', createdAt, updatedAt: createdAt, origin: page.origin, status: 'recording', steps: [] };
      if(message.guided===true)draft.steps.push({id:makeId(),type:'manual',title:'',url:page.url,workUrl:page.url,where:'',action:'',expected:'',acceptance:'',trouble:'',at:createdAt});
      const next = { drafts: [...state.drafts,draft], session: { draftId: id, tabId: tab.id, origin: page.origin, currentUrl: page.url, pageTitle: trim(tab.title || '',200), followStatus:'following', status: 'recording', token, ...(message.guided===true?{guided:true}:{}) } };
      await storageWrite(next);
      try {
        const answer = await chrome.tabs.sendMessage(tab.id, { type: 'recorder-content-start', token }, { frameId: 0 });
        if (!answer?.ok) throw Error('网页记录程序没有响应。');
      } catch (error) { next.drafts = next.drafts.filter((d) => d.id !== id); next.session = null; await storageWrite(next); throw Error('无法开始记录。请确认扩展已获得此网页的访问权限，然后重试。'); }
      return { drafts: next.drafts, session: next.session };
    });
  }
  async function currentSession(state, expectedStatus) {
    const s = state.session;
    if (!s) throw Error('当前没有录制会话。');
    if (expectedStatus && s.status !== expectedStatus) throw Error(expectedStatus === 'recording' ? '请先恢复录制。' : '当前会话不在暂停状态。');
    const tab = await chrome.tabs.get(s.tabId).catch(() => null);
      if (!tab || !tab.active || safePageUrl(tab.url || '')?.origin !== s.origin) throw Error('当前标签页已变化或不在前台。请回到原网站后重新恢复录制。');
    return { s, tab };
  }
  async function mutate(message) {
    await initialize();
    return serialized(async () => {
      const state = await storageRead();
      if (message.type === 'recorder-pause') return await pauseSession(state);
      if (message.type === 'recorder-resume') {
        const { s, tab } = await currentSession(state, 'paused');
        if (s.origin.startsWith('file:') && !await fileSchemeAccessAllowed()) throw Error(fileAccessInstruction);
        try { await inject(tab.id, { type: 'recorder-content-start', token: s.token }); }
        catch (_) { throw Error(s.origin.startsWith('file:') ? fileAccessInstruction : '无法恢复录制。请确认仍在原网站，并允许扩展访问此网页。'); }
        state.session.status = 'recording'; const d = state.drafts.find((x) => x.id === s.draftId); if (d) { d.status = 'recording'; d.updatedAt = now(); }
        await storageWrite(state); return state;
      }
      if (message.type === 'recorder-stop') return await pauseSession(state, 'draft');
      if(message.type==='recorder-next-step'){
        const session=state.session,draft=state.drafts.find(d=>d.id===message.id);
        if(!session?.guided||session.draftId!==message.id||!draft)throw Error('请先开始分步制作。');
        if(draft.steps.length>=MAX_STEPS)throw Error('步骤最多 100 条，请结束录制。');
        const url=safeWorkUrl(session.currentUrl||session.origin);
        draft.steps.push({id:makeId(),type:'manual',title:'',url,workUrl:url,where:'',action:'',expected:'',acceptance:'',trouble:'',at:now()});
        draft.updatedAt=now();await storageWrite(state);return state;
      }
      if (message.type === 'recorder-update') {
        if (state.session?.status === 'recording' && (state.session.draftId!==message.id || !message.patch || (!state.session.guided&&Object.keys(message.patch).some(k=>k!=='title')))) throw Error('录制中可修改 SOP 名称；整理步骤请先暂停录制。');
        if (state.session?.status === 'paused' && state.session.draftId !== message.id) throw Error('只能编辑当前暂停会话对应的草稿。');
        const draft = state.drafts.find((d) => d.id === message.id);
        if (!draft || !message.patch || typeof message.patch !== 'object') throw Error('找不到要修改的草稿。');
        const patch = message.patch;
        if (Object.keys(patch).some((key) => !['title', 'steps'].includes(key))) throw Error('草稿更新字段无效。');
        if ('title' in patch) { if (typeof patch.title !== 'string' || !patch.title.trim() || patch.title.length > 160) throw Error('标题不能为空且不能超过 160 字。'); draft.title = trim(patch.title, 160); }
        if ('steps' in patch) {
          if (!Array.isArray(patch.steps) || patch.steps.length > MAX_STEPS) throw Error('步骤最多 100 条。');
          const steps = patch.steps.map((s) => {
            if (!s || !TYPES.has(s.type)) throw Error('步骤类型无效。');
            const out = { ...pointFields(s), id: typeof s.id === 'string' ? s.id : makeId(), type: s.type, title: field(s.title,200), url: safePageUrl(s.url || draft.origin)?.url || draft.origin, where: field(s.where,500), action: field(s.action,1500), expected: field(s.expected,1500), acceptance: field(s.acceptance,1500), trouble: field(s.trouble,1500), at: typeof s.at === 'string' ? s.at : now() };
            if (s.workUrl !== undefined) out.workUrl = safeWorkUrl(s.workUrl);
            if (s.imageMode !== undefined) { if (!['thumbnail','collapsed','expanded'].includes(s.imageMode)) throw Error('截图显示模式无效。'); out.imageMode = s.imageMode; }
            if (s.issues !== undefined) out.issues = validatedIssues(s.issues);
            if (typeof s.image === 'string') { if (!imageValid(s.image)) throw Error('单张截图不能超过 200 KB，且必须为 JPEG。'); out.image = s.image; out.imageAt = typeof s.imageAt === 'string' ? s.imageAt : ''; }
            if(s.imageMarks!==undefined){if(!out.image)throw Error('标记必须附属于截图。');out.imageMarks=marksAPI().validate(s.imageMarks);}
            return out;
          });
          draft.steps = steps;
        }
        draft.updatedAt = now(); await storageWrite(state); return state;
      }
      if (message.type === 'recorder-delete') {
        if (state.session?.draftId === message.id) throw Error('请先停止当前录制，再删除草稿。');
        const before = state.drafts.length; state.drafts = state.drafts.filter((d) => d.id !== message.id);
        if (state.drafts.length === before) throw Error('找不到要删除的草稿。');
        await storageWrite(state); return state;
      }
      if (message.type === 'recorder-import') {
        const next = importDraft(state, message.backup);
        await storageWrite(next);
        return next;
      }
      if (message.type === 'recorder-picture') {
        if (!message || Object.keys(message).some(k => !['type','id','stepId','image','imageAt','imageMarks','expectedImage','workUrl'].includes(k))) throw Error('截图保存字段无效。');
        if (typeof message.id !== 'string' || (state.session && state.session.draftId !== message.id)) throw Error('截图目标草稿与当前录制会话不一致。');
        if (!imageValid(message.image)) throw Error('截图超过 200 KB 或格式不支持，未保存。');
        if (typeof message.imageAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(message.imageAt) || !Number.isFinite(Date.parse(message.imageAt))) throw Error('截图时间无效。');
        const draft = state.drafts.find(d => d.id === message.id);
        if (!draft) throw Error('找不到截图目标草稿。');
        let step;
        if (message.stepId === null) {
          if (typeof message.workUrl !== 'string') throw Error('新截图步骤需要当前页面网址。');
          const workUrl = safeWorkUrl(message.workUrl), page = safePageUrl(workUrl);
          if (!page || draft.steps.length >= MAX_STEPS) throw Error('无法添加截图步骤：步骤已达上限或网址无效。');
          step = { id:makeId(), type:'manual', title:'页面截图', url:page.url, where:'当前页面', action:'查看截图并补充操作说明', expected:'截图已保存以供参考', acceptance:'核对截图并自行确认操作结果', trouble:'', at:message.imageAt, workUrl };
          draft.steps.push(step);
        } else {
          if (typeof message.stepId !== 'string') throw Error('截图步骤标识无效。');
          step = draft.steps.find(s => s.id === message.stepId);
          if (!step) throw Error('找不到截图目标步骤。');
          if (Object.hasOwn(message, 'expectedImage') && (step.image || null) !== message.expectedImage) throw Error('步骤截图已变化，请检查后重试。');
        }
        step.image = message.image; step.imageAt = message.imageAt;
        if (message.imageMarks !== undefined) step.imageMarks = marksAPI().validate(message.imageMarks);
        else delete step.imageMarks;
        draft.updatedAt = now();
        await storageWrite(state);
        return state;
      }
      if (message.type === 'recorder-shot') return await takeShot(state, message);
      throw Error('不支持的录制操作。');
    });
  }
  async function createManual(message) {
    await initialize();
    return serialized(async () => {
      const state = await storageRead();
      if (state.session) throw Error('请先停止当前录制，再新建草稿。');
      if (state.drafts.length >= MAX_DRAFTS) throw Error('已保存 10 份草稿，请先在整理草稿中删除不需要的本机草稿。');
      let workUrl;
      if (message.workUrl !== undefined) workUrl = safeWorkUrl(message.workUrl);
      else if (Number.isInteger(message.tabId)) {
        const tab = await chrome.tabs.get(message.tabId).catch(() => null);
        workUrl = safeWorkUrl(tab?.url || '');
      } else throw Error('请提供当前标签页 ID 或工作网址。');
      const page = safePageUrl(workUrl);
      if (!page) throw Error('工作网址必须是普通 HTTP(S) 或 file:// 地址。');
      const stamp = now();
      const draft = { id:makeId(), title:trim(message.title,160)||'未命名 SOP 草稿', createdAt:stamp, updatedAt:stamp, origin:page.origin, status:'draft', steps:[{id:makeId(),type:'manual',title:'',url:page.url,where:'',action:'',expected:'',acceptance:'',trouble:'',at:'',workUrl}] };
      state.drafts.push(draft);
      await storageWrite(state);
      return { drafts:state.drafts, session:null };
    });
  }
  async function takeShot(state, message) {
    const draftId = message.draftId || state.session?.draftId;
    const draft = state.drafts.find(d => d.id === draftId);
    const step = draft?.steps.find(s => s.id === message.stepId);
    if (!step) throw Error('请先选择要保存截图的步骤。');
    // A screenshot is reference material, independent of the step's routing URL.
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.active || !Number.isInteger(tab.windowId)) throw Error('请先打开要截图的页面。');
    const imageAt = now();
    let image;
    try { image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 40 }); }
    catch (_) { throw Error('Chrome 尚未允许截图。请点击当前页面右上角的本插件图标，然后再点“截取当前页面”；也可以使用“添加图片”。'); }
    if(typeof image==='string'&&byteLength(image)>MAX_SHOT&&typeof OffscreenCanvas!=='undefined'){
      const decoded=atob(image.split(',')[1]),raw=Uint8Array.from(decoded,c=>c.charCodeAt(0));const bitmap=await createImageBitmap(new Blob([raw],{type:'image/jpeg'}));const scale=Math.min(1,1280/bitmap.width),canvas=new OffscreenCanvas(Math.round(bitmap.width*scale),Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await canvas.convertToBlob({type:'image/jpeg',quality:0.4});const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);image='data:image/jpeg;base64,'+btoa(binary);
    }
    if (!imageValid(image)) throw Error('截图超过 200 KB 或格式不支持，未保存。');
    const [after]=await chrome.tabs.query({active:true,windowId:tab.windowId});if(after?.id!==tab.id||after.url!==tab.url)throw Error('截图期间页面发生变化，请回到原页面重试。');
    step.image = image; step.imageAt = imageAt;delete step.imageMarks; draft.updatedAt = now(); await storageWrite(state); return state;
  }
  async function recordEvent(message, sender) {
    await initialize();
    return serialized(async () => {
      const state = await storageRead(), s = state.session;
      if (!s || s.status !== 'recording' || message.token !== s.token) return { ignored: true };
      const senderPage = safePageUrl(sender.url || ''), tabPage = await chrome.tabs.get(s.tabId).catch(() => null);
      if (sender.id !== chrome.runtime.id || sender.tab?.id !== s.tabId || sender.frameId !== 0 || !senderPage || senderPage.origin !== s.origin || !tabPage?.active || safePageUrl(tabPage.url || '')?.origin !== s.origin) return { ignored: true };
      const event = message.event;
      if (!event || !['click', 'field', 'manual'].includes(event.type) || typeof event.title !== 'string' || typeof event.action !== 'string') return { ignored: true };
      const draft = state.drafts.find((d) => d.id === s.draftId);
      if (!draft || draft.steps.length >= MAX_STEPS) {await pauseSession(state);throw Error('步骤已达到 100 条上限，记录已暂停，请结束并整理草稿。');}
      const at = now();
      if(s.guided){s.latestAction=trim(event.action,600);draft.updatedAt=at;await storageWrite(state);return {recorded:true};}
      draft.steps.push({ id: makeId(), type: event.type, title: trim(event.title, 200), url: senderPage.url, where: trim(event.where, 240), action: trim(event.action, 600), expected: '', acceptance: '', trouble: '', at });
      draft.updatedAt = at;try{await storageWrite(state);}catch(error){draft.steps.pop();await pauseSession(state);throw error;}return { recorded: true };
    });
  }
  async function onTabActivated(info) {
    if (!initialized || !extensionEnabled) return;
    await serialized(async () => { const state = await storageRead(); if (state.session?.status === 'recording' && state.session.tabId !== info.tabId) await pauseSession(state); });
  }
  async function onTabUpdated(tabId, changeInfo) {
    if (!initialized || !extensionEnabled) return;
    if (changeInfo.status === 'loading') {
      await serialized(async () => { const state=await storageRead(),s=state.session;if(s?.status==='recording'&&s.tabId===tabId){s.followStatus='loading';await storageWrite(state);} });
      return;
    }
    if (changeInfo.status !== 'complete' && !changeInfo.url) return;
    await serialized(async () => {
      const state=await storageRead(),s=state.session;
      if(!s||s.status!=='recording'||s.tabId!==tabId)return;
      const tab=await chrome.tabs.get(tabId).catch(()=>null);
      if(!tab?.active){await pauseSession(state);return;}
      const page=safePageUrl(tab.url||changeInfo.url||'');
      if(!page){s.reason='当前页面不支持自动跟随，录制已暂停。';await pauseSession(state);return;}
      if(s.origin.startsWith('file:')){
        if(page.origin!==s.origin){s.reason='本地文件地址已变化；录制已暂停。';await pauseSession(state);return;}
        if(!await fileSchemeAccessAllowed()){s.reason=fileAccessInstruction;await pauseSession(state);return;}
      }else if(page.origin!==s.origin){s.reason=`页面已切换到 ${page.origin}，录制已暂停。请确认后手动恢复。`;await pauseSession(state);return;}
      const previous=s.currentUrl||s.origin, changed=previous!==page.url;
      try{await inject(tabId,{type:'recorder-content-start',token:s.token});}
      catch(_){s.reason=s.origin.startsWith('file:')?fileAccessInstruction:'新页面暂时无法访问，录制已暂停。请检查权限后手动恢复。';await pauseSession(state);return;}
      s.currentUrl=page.url;s.pageTitle=trim(tab.title||'',200);s.followStatus='following';delete s.reason;
      if(changed&&!s.guided){const draft=state.drafts.find(d=>d.id===s.draftId);if(draft&&draft.steps.length<MAX_STEPS){draft.steps.push({id:makeId(),type:'manual',title:'页面导航',url:page.url,where:'页面',action:'页面导航后继续记录',expected:'新页面已加载',acceptance:'检查当前页面后继续操作',trouble:'',at:now()});draft.updatedAt=now();}}
      await storageWrite(state);
    });
  }
  async function onTabRemoved(tabId) {
    if (!initialized || !extensionEnabled) return;
    await serialized(async () => { const state = await storageRead(); if (state.session?.tabId === tabId) await pauseSession(state); });
  }
  function registerBackground() {
    if (!extensionEnabled || registerBackground.registered) return;
    registerBackground.registered = true;
    initialize().catch((error) => console.error('Recorder initialization failed:', error));
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === 'recorder-event') {
        recordEvent(message, sender).then((data) => sendResponse({ data })).catch((error) => sendResponse({ error: error.message || '录制失败。' }));
        return true;
      }
      if (!message || !message.type?.startsWith('recorder-')) return undefined;
      if (!extensionPage(sender)) { sendResponse({ error: '仅扩展页面可以管理录制。' }); return false; }
      (async () => {
        await initialize();
        if (message.type === 'recorder-get') return await getResponse();
        if (message.type === 'recorder-start') return await start(message);
        if (message.type === 'recorder-create') return await createManual(message);
        return await mutate(message);
      })().then((data) => sendResponse({ data })).catch((error) => sendResponse({ error: error.message || '录制操作失败。' }));
      return true;
    });
    chrome.tabs.onActivated.addListener(info=>onTabActivated(info).catch(console.error));
    chrome.tabs.onUpdated.addListener((id,change)=>onTabUpdated(id,change).catch(console.error));
    chrome.tabs.onRemoved.addListener(id=>onTabRemoved(id).catch(console.error));
  }
  const api = { registerBackground, safeWorkUrl, safePageUrl, validateState, ensureBudget, importDraft, constants: { KEY, MAX_DRAFTS, MAX_STEPS, MAX_SHOT, MAX_TOTAL } };
  root.SOPRecorder = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
