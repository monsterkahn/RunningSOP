(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SOPAssets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'runtime-sop-document', MAX_TOTAL = 4 * 1024 * 1024;
  const fail = message => { throw new Error(message); };
  const sha = async (raw, cryptoObject) => {
    if (!cryptoObject?.subtle) fail('当前环境不支持 SHA-256 校验。');
    const digest = await cryptoObject.subtle.digest('SHA-256', raw);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  };
  function validIdentity(workflow) {
    if (!workflow || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(workflow.id) || !['guide','youtube'].includes(workflow.viewer)) fail('工作流身份无效。');
  }
  function b64bytes(value) {
    if (typeof value !== 'string' || !value || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail('图片 Base64 数据无效。');
    let raw;
    try { raw = typeof atob === 'function' ? atob(value) : Buffer.from(value, 'base64').toString('binary'); } catch (_) { fail('图片 Base64 解码失败。'); }
    const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function inspectImage(data, mime, path) {
    const len = data.length;
    if (!len || len > MAX_TOTAL) fail('图片大小无效。');
    if (mime === 'image/jpeg') {
      const max = path === '/assets/logo/data' ? 2 * 1024 * 1024 : 200 * 1024;
      if (len > max || len < 3 || data[0] !== 255 || data[1] !== 216 || data[2] !== 255) fail('JPEG 图片头或大小无效。');
    } else if (mime === 'image/png') {
      if (len > 8 * 1024 * 1024 || len < 8 || ![137,80,78,71,13,10,26,10].every((b,i)=>data[i]===b)) fail('PNG 图片头或大小无效。');
    } else fail('只允许 JPEG 或 PNG 图片。');
  }
  function descriptorPathAllowed(path, workflow, content) {
    if (workflow.viewer === 'youtube') return ['/assets/logo/data','/assets/studioScreenshot/data'].includes(path);
    const step = /^\/steps\/(0|[1-9]\d*)\/image$/.exec(path);
    const issue = /^\/steps\/(0|[1-9]\d*)\/issues\/(0|[1-9]\d*)\/image$/.exec(path);
    if (step) return Number(step[1]) < content.steps.length;
    if (issue) return Number(issue[1]) < content.steps.length && Number(issue[2]) < (content.steps[Number(issue[1])]?.issues?.length || 0);
    return false;
  }
  function mimeForPath(path, workflow) {
    if (workflow.viewer === 'youtube') return path === '/assets/logo/data' ? 'image/jpeg' : 'image/png';
    return 'image/jpeg';
  }
  function replaceAt(root, pointer, value) {
    const tokens = pointer.slice(1).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~'));
    let parent = root;
    for (const token of tokens.slice(0,-1)) parent = parent[token];
    parent[tokens.at(-1)] = value;
  }
  function getAt(root, pointer) {
    return pointer.slice(1).split('/').map(x=>x.replace(/~1/g,'/').replace(/~0/g,'~')).reduce((v,k)=>v?.[k],root);
  }
  async function pack(content, workflow, cryptoObject = globalThis.crypto) {
    validIdentity(workflow);
    if (!content || content.workflowId !== workflow.id) fail('内容身份与目录工作流不匹配。');
    const copy = JSON.parse(JSON.stringify(content)), assets = [], descriptors = [];
    const candidates = [];
    if (workflow.viewer === 'guide') {
      if (copy.format !== 'runtime-sop-guide' || !Array.isArray(copy.steps)) fail('指南内容格式无效。');
      copy.steps.forEach((step, i) => {
        if (step.image !== undefined) candidates.push({ path:`/steps/${i}/image`, value:step.image });
        (step.issues || []).forEach((issue,j)=>{ if(issue.image !== undefined) candidates.push({path:`/steps/${i}/issues/${j}/image`,value:issue.image}); });
      });
    } else {
      if (workflow.id !== 'youtube-upload' || copy.format !== 'runtime-sop-content' || !copy.assets) fail('YouTube 内容格式无效。');
      for (const name of ['logo','studioScreenshot']) {
        const asset=copy.assets[name]; if (!asset || typeof asset.data !== 'string') fail('YouTube 图片缺失。');
        candidates.push({path:`/assets/${name}/data`,value:asset.data,mime:asset.mimeType});
      }
    }
    for (const item of candidates) {
      const mime = item.mime || 'image/jpeg';
      const value = workflow.viewer==='youtube'&&!item.value.startsWith('data:')?`data:${mime};base64,${item.value}`:item.value;
      const match = /^data:(image\/(?:jpeg|png));base64,([\s\S]+)$/.exec(value);
      if (!match || match[1] !== mime) fail('图片数据 URI 或类型无效。');
      const raw = b64bytes(match[2]); inspectImage(raw,mime,item.path);
      const digest = await sha(raw,cryptoObject), ext = mime === 'image/jpeg' ? 'jpg' : 'png';
      const file = `workflows/${workflow.id}/images/${digest}.${ext}`;
      descriptors.push({path:item.path,file,sha256:digest,mimeType:mime,size:raw.length});
      assets.push({file,bytes:raw,mimeType:mime,sha256:digest,size:raw.length});
      replaceAt(copy,item.path,null);
      if (assets.reduce((n,a)=>n+a.size,0) > MAX_TOTAL) fail('图片总大小超过 4 MB。');
    }
    const document = {format:FORMAT,schemaVersion:1,workflowId:workflow.id,viewer:workflow.viewer,content:copy,assets:descriptors};
    return {document,assets};
  }
  async function hydrate(document, workflow, readAsset, cryptoObject = globalThis.crypto) {
    validIdentity(workflow);
    if (!document || Object.getPrototypeOf(document)!==Object.prototype || Object.keys(document).sort().join(',')!=='assets,content,format,schemaVersion,viewer,workflowId' || document.format !== FORMAT || document.schemaVersion !== 1 || document.workflowId !== workflow.id || document.viewer !== workflow.viewer || !document.content || !Array.isArray(document.assets) || document.assets.length>1100 || typeof readAsset !== 'function') fail('图片文档格式或工作流身份无效。');
    const content = JSON.parse(JSON.stringify(document.content));
    const seen = new Set(); let total = 0;
    for (const descriptor of document.assets) {
      if (!descriptor || Object.keys(descriptor).sort().join(',') !== 'file,mimeType,path,sha256,size' || typeof descriptor.path !== 'string' || !descriptorPathAllowed(descriptor.path,workflow,content) || seen.has(descriptor.path)) fail('图片资产路径无效或重复。');
      seen.add(descriptor.path);
      const expectedFile = `workflows/${workflow.id}/images/${descriptor.sha256}.${descriptor.mimeType === 'image/jpeg'?'jpg':'png'}`;
      if (!/^[a-f0-9]{64}$/.test(descriptor.sha256) || descriptor.file !== expectedFile || !Number.isSafeInteger(descriptor.size) || descriptor.size < 1 || descriptor.size > MAX_TOTAL || descriptor.mimeType !== mimeForPath(descriptor.path,workflow) || getAt(content,descriptor.path) !== null) fail('图片资产描述无效。');
      const rawValue = await readAsset(descriptor.file);
      const raw = rawValue instanceof Uint8Array ? rawValue : rawValue instanceof ArrayBuffer ? new Uint8Array(rawValue) : ArrayBuffer.isView(rawValue) ? new Uint8Array(rawValue.buffer,rawValue.byteOffset,rawValue.byteLength) : null;
      if (!raw || raw.length !== descriptor.size) fail('图片资产缺失或大小不匹配。');
      inspectImage(raw,descriptor.mimeType,descriptor.path);
      if (await sha(raw,cryptoObject) !== descriptor.sha256) fail('图片资产 SHA-256 不匹配。');
      total += raw.length; if (total > MAX_TOTAL) fail('图片总大小超过 4 MB。');
      let binary=''; for(let i=0;i<raw.length;i+=0x8000) binary+=String.fromCharCode(...raw.subarray(i,i+0x8000));
      const prefix = workflow.viewer === 'youtube' ? '' : `data:${descriptor.mimeType};base64,`;
      replaceAt(content,descriptor.path,prefix+(typeof btoa==='function'?btoa(binary):Buffer.from(binary,'binary').toString('base64')));
    }
    // Every recognized image slot must have precisely one descriptor; metadata without an image is rejected by the domain validator.
    if (workflow.viewer === 'youtube' && seen.size !== 2) fail('YouTube 图片资产不完整。');
    if (workflow.viewer === 'guide') {
      for(const [i,s] of content.steps.entries()) {
        const check=(image,p)=>{if(image===null&&!seen.has(p)) fail('指南图片资产缺失。');};
        check(s.image,`/steps/${i}/image`);
        (s.issues||[]).forEach((issue,j)=>check(issue.image,`/steps/${i}/issues/${j}/image`));
      }
    }
    return content;
  }
  function hydrateSync(document, workflow, readAssetSync, cryptoObject) {
    validIdentity(workflow);
    if (!document || Object.getPrototypeOf(document)!==Object.prototype || Object.keys(document).sort().join(',')!=='assets,content,format,schemaVersion,viewer,workflowId' || document.format !== FORMAT || document.schemaVersion !== 1 || document.workflowId !== workflow.id || document.viewer !== workflow.viewer || !document.content || !Array.isArray(document.assets) || document.assets.length>1100 || typeof readAssetSync !== 'function') fail('图片文档格式或工作流身份无效。');
    if (!cryptoObject) { try { cryptoObject = require('node:crypto'); } catch (_) {} }
    const content = JSON.parse(JSON.stringify(document.content)), seen = new Set(); let total = 0;
    for (const descriptor of document.assets) {
      if (!descriptor || Object.keys(descriptor).sort().join(',') !== 'file,mimeType,path,sha256,size' || typeof descriptor.path !== 'string' || !descriptorPathAllowed(descriptor.path,workflow,content) || seen.has(descriptor.path)) fail('图片资产路径无效或重复。');
      seen.add(descriptor.path);
      const expectedFile = `workflows/${workflow.id}/images/${descriptor.sha256}.${descriptor.mimeType === 'image/jpeg'?'jpg':'png'}`;
      if (!/^[a-f0-9]{64}$/.test(descriptor.sha256) || descriptor.file !== expectedFile || !Number.isSafeInteger(descriptor.size) || descriptor.size < 1 || descriptor.size > MAX_TOTAL || descriptor.mimeType !== mimeForPath(descriptor.path,workflow) || getAt(content,descriptor.path) !== null) fail('图片资产描述无效。');
      const value = readAssetSync(descriptor.file);
      const raw = value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer,value.byteOffset,value.byteLength) : null;
      if (!raw || raw.length !== descriptor.size) fail('图片资产缺失或大小不匹配。');
      inspectImage(raw,descriptor.mimeType,descriptor.path);
      const digest = cryptoObject?.createHash ? cryptoObject.createHash('sha256').update(raw).digest('hex') : '';
      if (digest !== descriptor.sha256) fail('图片资产 SHA-256 不匹配.');
      total += raw.length; if (total > MAX_TOTAL) fail('图片总大小超过 4 MB。');
      let binary=''; for(let i=0;i<raw.length;i+=0x8000) binary+=String.fromCharCode(...raw.subarray(i,i+0x8000));
      const prefix = workflow.viewer === 'youtube' ? '' : `data:${descriptor.mimeType};base64,`;
      replaceAt(content,descriptor.path,prefix+(typeof btoa==='function'?btoa(binary):Buffer.from(binary,'binary').toString('base64')));
    }
    if (workflow.viewer === 'youtube' && seen.size !== 2) fail('YouTube 图片资产不完整。');
    if (workflow.viewer === 'guide') for(const [i,s] of content.steps.entries()) {
      if(s.image===null&&!seen.has(`/steps/${i}/image`)) fail('指南图片资产缺失。');
      (s.issues||[]).forEach((issue,j)=>{if(issue.image===null&&!seen.has(`/steps/${i}/issues/${j}/image`)) fail('指南图片资产缺失。');});
    }
    return content;
  }
  return {pack,hydrate,hydrateSync,FORMAT,MAX_TOTAL};
});
