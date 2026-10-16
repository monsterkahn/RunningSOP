(function (root, factory) {
  'use strict';
  const api = factory();
  root.RemoteContent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ROOT_KEYS = ['format','schemaVersion','workflowId','contentVersion','publishedAt','revision','config','tutorials','assets','visuals'];
  const VISUALS = new Set(['account','file','upload','details','declarations','elements','checks','visibility','playback','feedback']);
  const ID_RE = /^YT(?:0[1-9]|10)$/;
  const SHA_RE = /^[a-f0-9]{64}$/i;
  const MIME = { logo: 'image/jpeg', studioScreenshot: 'image/png' };
  const MAX_IMAGE_BYTES = { logo: 2 * 1024 * 1024, studioScreenshot: 8 * 1024 * 1024 };
  const fail = message => { throw new Error(message); };
  const obj = (v, label) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) fail(label + '格式无效。');
    return v;
  };
  const exactKeys = (v, keys, label) => {
    obj(v, label);
    const allowed = new Set(keys);
    for (const key of Object.keys(v)) if (!allowed.has(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') fail(label + '含有未知或危险字段。');
  };
  const str = (v, label, max, nonempty = true) => {
    if (typeof v !== 'string' || v.length > max || (nonempty && !v.trim())) fail(label + '无效。');
    return v;
  };
  const stringArray = (v, label, min, maxItems, maxLength) => {
    if (!Array.isArray(v) || v.length < min || v.length > maxItems) fail(label + '数量无效。');
    return v.map((x, i) => str(x, label + '第' + (i + 1) + '项', maxLength));
  };
  const timestamp = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && (new Date(v).toISOString() === v || new Date(v).toISOString().replace('.000Z','Z') === v);

  function validateEndpoint(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048 || value.includes('?') || value.includes('#')) fail('NAS 地址无效。');
    let u;
    try { u = new URL(value); } catch (_) { fail('NAS 地址不是有效的 file:// 文件地址。'); }
    if (u.protocol !== 'file:' || u.search || u.hash || u.username || u.password || u.port || !u.pathname.endsWith('/sop/latest.json')) fail('NAS 地址必须是无参数的 file://.../sop/latest.json 文件地址。');
    if (/%2f|%5c/i.test(u.pathname) || u.pathname.includes('\\') || u.pathname.split('/').some(p => p === '..')) fail('NAS 地址包含不安全路径。');
    if (u.hostname && (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(u.hostname) || u.hostname.toLowerCase() === 'localhost')) fail('NAS 地址主机名无效。');
    return u.href;
  }

  function imageData(asset, name) {
    exactKeys(asset, ['mimeType','data'], '图片');
    if (asset.mimeType !== MIME[name] || typeof asset.data !== 'string') fail('图片类型与内容不匹配。');
    const max = MAX_IMAGE_BYTES[name], encodedMax = Math.ceil(max / 3) * 4;
    if (!asset.data.length || asset.data.length > encodedMax || asset.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)) fail('图片 Base64 数据无效或过大。');
    const padding = asset.data.endsWith('==') ? 2 : asset.data.endsWith('=') ? 1 : 0;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    if ((padding === 2 && (alphabet.indexOf(asset.data[asset.data.length - 3]) & 15) !== 0) || (padding === 1 && (alphabet.indexOf(asset.data[asset.data.length - 2]) & 3) !== 0)) fail('图片 Base64 末尾填充位无效。');
    let raw;
    try { raw = atob(asset.data); } catch (_) { fail('图片 Base64 解码失败。'); }
    if (!raw.length || raw.length > max) fail('图片大小超出限制。');
    const b = i => raw.charCodeAt(i);
    if (name === 'logo' && !(raw.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff)) fail('品牌图片不是有效的 JPEG 文件头。');
    if (name === 'studioScreenshot' && !(raw.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => b(i) === n))) fail('截图不是有效的 PNG 文件头。');
    return { mimeType: MIME[name], data: asset.data };
  }

  function validateBundle(input) {
    exactKeys(input, ROOT_KEYS, '同步内容');
    if (input.format !== 'runtime-sop-content' || input.schemaVersion !== 1 || input.workflowId !== 'youtube-upload') fail('同步内容身份不匹配。');
    if (!timestamp(input.publishedAt)) fail('发布时间必须是有效的 UTC ISO 日期。');
    if (typeof input.revision !== 'string' || !SHA_RE.test(input.revision)) fail('内容版本指纹格式无效。');
    const config = obj(input.config, 'SOP 配置');
    exactKeys(config, ['version','schemaVersion','name','checkedAt','scope','steps','resources'], 'SOP 配置');
    const version = str(config.version, 'SOP 版本', 36);
    const checkedAt = str(config.checkedAt, '核对日期', 10);
    if (!/^\d{4}-\d\d-\d\d$/.test(checkedAt) || !Number.isFinite(Date.parse(checkedAt + 'T00:00:00Z')) || new Date(checkedAt + 'T00:00:00Z').toISOString().slice(0,10) !== checkedAt || config.schemaVersion !== 1) fail('SOP 版本或核对日期无效。');
    const safeConfig = { version, schemaVersion: 1, name: str(config.name, 'SOP 名称', 120), checkedAt, scope: str(config.scope, '适用范围', 1000) };
    if (!Array.isArray(config.steps) || config.steps.length !== 10) fail('SOP 必须包含 YT01 至 YT10 共十个步骤。');
    const ids = config.steps.map((s,i) => { obj(s, 'SOP 步骤'); if (s.id !== 'YT' + String(i+1).padStart(2,'0')) fail('SOP 步骤必须按 YT01 至 YT10 正序排列。'); return s.id; });
    const idSet = new Set(ids), safeSteps = [];
    const stepKeys = ['id','title','phase','locationHint','summary','inputs','actions','outputs','acceptance','resultHint','gateHint','dependencies','next','rework','resources'];
    for (const s of config.steps) {
      exactKeys(s, stepKeys, 'SOP 步骤');
      const out = { id:s.id, title:str(s.title,'步骤标题',200), phase:str(s.phase,'步骤阶段',80), locationHint:str(s.locationHint,'操作位置',500), summary:str(s.summary,'步骤说明',1500), inputs:stringArray(s.inputs,'步骤输入',1,30,500), actions:stringArray(s.actions,'操作动作',1,100,1500), outputs:stringArray(s.outputs,'步骤输出',1,30,500), acceptance:stringArray(s.acceptance,'验收条件',1,100,1000), resultHint:str(s.resultHint,'结果提示',1500), gateHint:str(s.gateHint,'停止条件',1500) };
      for (const field of ['dependencies','next','rework']) {
        const a = s[field]; if (!Array.isArray(a) || a.length > 10 || a.some(id => typeof id !== 'string' || !idSet.has(id)) || new Set(a).size !== a.length) fail('步骤关系中含有无效或重复 ID。');
        out[field] = a.slice();
      }
      if (!Array.isArray(s.resources) || s.resources.length > 50 || s.resources.some(id => typeof id !== 'string' || !id.trim() || id.length > 100) || new Set(s.resources).size !== s.resources.length) fail('步骤资源 ID 无效。');
      out.resources = s.resources.slice(); safeSteps.push(out);
    }
    const visiting = new Set(), visited = new Set();
    function visit(id) { if (visiting.has(id)) fail('步骤依赖关系存在循环。'); if (visited.has(id)) return; visiting.add(id); for (const dep of safeSteps[ids.indexOf(id)].dependencies) visit(dep); visiting.delete(id); visited.add(id); }
    ids.forEach(visit);
    if (!Array.isArray(config.resources) || config.resources.length < 1 || config.resources.length > 100) fail('官方资源列表无效。');
    const resourceIds = new Set(), safeResources = config.resources.map(r => {
      exactKeys(r,['id','title','url'],'官方资源');
      const id = str(r.id,'资源 ID',100); if (resourceIds.has(id) || ['__proto__','constructor','prototype'].includes(id)) fail('资源 ID 重复或危险。'); resourceIds.add(id);
      const url = str(r.url,'资源网址',2048); let u; try { u = new URL(url); } catch (_) { fail('资源网址无效。'); }
      if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) fail('官方资源只允许安全的 HTTPS 网址。');
      return { id, title:str(r.title,'资源标题',300), url:u.href };
    });
    for (const s of safeSteps) if (s.resources.some(id => !resourceIds.has(id))) fail('步骤引用了不存在的资源。');
    safeConfig.steps = safeSteps; safeConfig.resources = safeResources;

    const tutorials = obj(input.tutorials,'新手教程');
    exactKeys(tutorials,['version','lessons'],'新手教程');
    const tutorialVersion = str(tutorials.version,'教程版本',40);
    if (input.contentVersion !== tutorialVersion) fail('内容版本与教程版本不一致。');
    const lessons = obj(tutorials.lessons,'教程课目');
    const lessonKeys = Object.keys(lessons);
    if (lessonKeys.length !== 10 || lessonKeys.some((id,i) => id !== ids[i])) fail('教程必须按顺序完整包含 YT01 至 YT10。');
    const safeLessons = {};
    for (const id of ids) {
      const l = lessons[id]; exactKeys(l,['lead','visual','microsteps','example','terms'],'教程课目');
      if (!VISUALS.has(l.visual)) fail('教程示意类型无效。');
      if (!Array.isArray(l.microsteps) || l.microsteps.length < 1 || l.microsteps.length > 30) fail('教程微操作数量必须为 1 至 30。');
      const microsteps = l.microsteps.map(m => { exactKeys(m,['title','where','do','expect','trouble'],'教程微操作'); return { title:str(m.title,'微操作标题',160), where:str(m.where,'微操作位置',300), do:str(m.do,'微操作说明',1200), expect:str(m.expect,'微操作验收',800), trouble:str(m.trouble,'问题提示',800) }; });
      if (!Array.isArray(l.terms) || l.terms.length < 1 || l.terms.length > 50) fail('教程术语列表无效。');
      const termSeen = new Set();
      const terms = l.terms.map(t => { exactKeys(t,['term','meaning'],'教程术语'); const term = str(t.term,'术语',120); if(termSeen.has(term)) fail('教程术语重复。'); termSeen.add(term); return {term,meaning:str(t.meaning,'术语解释',1000)}; });
      safeLessons[id] = { lead:str(l.lead,'教程导语',1600), visual:l.visual, microsteps, example:str(l.example,'教程示例',1600), terms };
    }
    const assets = obj(input.assets,'图片素材'); exactKeys(assets,['logo','studioScreenshot'],'图片素材');
    const safeBundle = { format:'runtime-sop-content', schemaVersion:1, workflowId:'youtube-upload', contentVersion:tutorialVersion, publishedAt:input.publishedAt, revision:input.revision.toLowerCase(), config:safeConfig, tutorials:{version:tutorialVersion,lessons:safeLessons}, assets:{logo:imageData(assets.logo,'logo'),studioScreenshot:imageData(assets.studioScreenshot,'studioScreenshot')} };
    if (Object.prototype.hasOwnProperty.call(input,'visuals')) {
      const visuals = obj(input.visuals,'教学图解'); exactKeys(visuals,['version','steps'],'教学图解');
      const visualVersion = str(visuals.version,'图解版本',40), visualSteps = obj(visuals.steps,'图解步骤');
      const visualKeys = Object.keys(visualSteps);
      if (visualKeys.some(id => !ID_RE.test(id)) || visualKeys.some((id,i) => i > 0 && Number(id.slice(2)) <= Number(visualKeys[i-1].slice(2)))) fail('图解步骤 ID 无效或未按顺序排列。');
      const safeVisualSteps = {};
      const layouts = new Set(['browser','login','studio','files','player','upload','form','settings','records']);
      const kinds = new Set(['input','button','option','row','progress','check']);
      const sceneKeys = ['matches','screen','layout','heading','controls','gesture','result','tip','basis'];
      for (const id of visualKeys) {
        const scenes = visualSteps[id];
        if (!Array.isArray(scenes) || scenes.length > 30) fail('图解场景数量无效。');
        safeVisualSteps[id] = scenes.map(scene => {
          exactKeys(scene,sceneKeys,'图解场景');
          const matches = str(scene.matches,'图解匹配标题',160);
          const basis = obj(scene.basis,'图解文字基准'); exactKeys(basis,['title','where','do','expect','trouble'],'图解文字基准');
          const safeBasis = {title:str(basis.title,'基准标题',160),where:str(basis.where,'基准位置',300),do:str(basis.do,'基准操作',1200),expect:str(basis.expect,'基准结果',800),trouble:str(basis.trouble,'基准问题提示',800)};
          if (matches !== safeBasis.title) fail('图解标题与文字基准不一致。');
          if (!layouts.has(scene.layout)) fail('图解布局无效。');
          if (!Array.isArray(scene.controls) || scene.controls.length < 2 || scene.controls.length > 4) fail('图解控件数量无效。');
          let activeCount = 0;
          const controls = scene.controls.map(control => {
            exactKeys(control,['label','value','kind','active'],'图解控件');
            if (!kinds.has(control.kind) || typeof control.active !== 'boolean') fail('图解控件类型或状态无效。');
            if (control.active) activeCount++;
            return {label:str(control.label,'控件标签',100),value:str(control.value,'控件值',500),kind:control.kind,active:control.active};
          });
          if (activeCount !== 1) fail('图解必须且只能有一个高亮控件。');
          return {matches,screen:str(scene.screen,'画面标题',200),layout:scene.layout,heading:str(scene.heading,'框中标题',200),controls,gesture:str(scene.gesture,'图解操作',1200),result:str(scene.result,'图解结果',800),tip:str(scene.tip,'图解提示',800),basis:safeBasis};
        });
      }
      safeBundle.visuals = {version:visualVersion,steps:safeVisualSteps};
    }
    return safeBundle;
  }

  function microKey(m) {
    return JSON.stringify([m.title,m.where,m.do,m.expect,m.trouble]);
  }
  function contentParts(bundle) {
    const parts = {config:bundle.config,tutorials:bundle.tutorials,assets:bundle.assets};
    if (Object.prototype.hasOwnProperty.call(bundle,'visuals')) parts.visuals = bundle.visuals;
    return parts;
  }

  function basisVersion(bundle) {
    const version = bundle && bundle.config && bundle.config.version;
    const revision = bundle && bundle.revision;
    if (typeof version !== 'string' || typeof revision !== 'string' || !SHA_RE.test(revision)) fail('无法生成任务基准版本。');
    const result = version + ' @' + revision.slice(0,12);
    if (result.length > 50) fail('任务基准版本超过长度限制。');
    return result;
  }
  return { validateBundle, validateEndpoint, basisVersion, microKey, contentParts };
});
