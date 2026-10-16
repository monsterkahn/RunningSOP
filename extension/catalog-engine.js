(function (root, factory) {
  'use strict';
  let imageMarks = root && root.ImageMarks;
  if (typeof module !== 'undefined' && module.exports) imageMarks = require('./image-marks.js');
  const api = factory(imageMarks);
  root.CatalogEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (ImageMarks) {
  'use strict';
  const SHA = /^[a-f0-9]{64}$/i;
  const BAD = new Set(['__proto__', 'prototype', 'constructor']);
  const fail = message => { throw new Error(message); };
  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(label + '格式无效。');
    for (const key of Object.keys(value)) if (BAD.has(key)) fail(label + '含有危险字段。');
    return value;
  }
  function keys(value, expected, label) {
    object(value, label);
    const allowed = new Set(expected);
    if (Object.keys(value).some(key => !allowed.has(key))) fail(label + '含有未知字段。');
  }
  function string(value, label, max, allowEmpty = false) {
    if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) fail(label + '无效。');
    return value;
  }
  function strings(value, label, maxItems, maxLength, min = 0) {
    if (!Array.isArray(value) || value.length < min || value.length > maxItems) fail(label + '数量无效。');
    return value.map((v, i) => string(v, label + '第' + (i + 1) + '项', maxLength));
  }
  function assertData(value, depth = 0, budget = {count:0}) {
    if (++budget.count > 50000 || depth > 32) fail('内容结构过大或嵌套过深。');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('内容含有无效数字。'); return; }
    if (typeof value !== 'object') fail('内容只能包含 JSON 数据。');
    const array = Array.isArray(value);
    const proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : (proto !== Object.prototype && proto !== null)) fail('内容只能包含普通对象和数组。');
    if (Object.getOwnPropertySymbols(value).length) fail('内容不能含有符号字段。');
    const ownKeys = Object.keys(value);
    if (array && (ownKeys.length !== value.length || ownKeys.some((key,index) => key !== String(index)))) fail('数组不能包含空项或额外字段。');
    for (const key of ownKeys) {
      if (BAD.has(key)) fail('内容含有危险字段。');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || !descriptor.enumerable) fail('内容不能含有访问器或隐藏字段。');
      assertData(descriptor.value, depth + 1, budget);
    }
  }
  function safeRelativeFile(value) {
    string(value, '工作流文件路径', 512);
    if (!value.endsWith('.json') || value.startsWith('/') || value.includes('\\') || /[%?#:\u0000-\u001f]/.test(value)) fail('工作流文件路径无效。');
    const parts = value.split('/');
    if (parts.some(part => !part || part === '.' || part === '..')) fail('工作流文件路径越界。');
    return value;
  }
  function validateEndpoint(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[?#]/.test(value)) fail('目录地址无效。');
    let url;
    try { url = new URL(value); } catch (_) { fail('目录地址必须是 file://catalog.json。'); }
    if (url.protocol !== 'file:' || url.search || url.hash || url.username || url.password || url.port || !url.pathname.endsWith('/catalog.json') || /%2f|%5c/i.test(url.pathname) || url.pathname.includes('\\') || url.pathname.split('/').some(p => p === '..')) fail('目录地址必须是无参数的 file://.../catalog.json 文件地址。');
    if (url.hostname && (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(url.hostname) || url.hostname.toLowerCase() === 'localhost')) fail('目录地址主机名无效。');
    return url.href;
  }
  function guideUrl(value) {
    string(value, '工作网址', 2048);
    let url;
    try { url = new URL(value); } catch (_) { fail('工作网址必须是 HTTP(S) 或规范 file:// 地址。'); }
    if (['http:','https:'].includes(url.protocol)) {
      if (!url.hostname || url.username || url.password) fail('工作网址必须是无凭据的 HTTP(S) 地址。');
      return value;
    }
    if (url.protocol !== 'file:' || url.username || url.password || url.port || !url.pathname.startsWith('/') || url.pathname.includes('\\') || /%2f|%5c/i.test(url.pathname) || url.href !== value) fail('本机工作网址必须是规范、无凭据的 file:// 地址。');
    return url.href;
  }
  function fileUrl(value) {
    const normalized = guideUrl(value);
    if (!normalized.startsWith('file:')) fail('文件匹配网址必须是 file:// 地址。');
    return normalized;
  }
  function validateImageFields(item, label) {
    let image, imageAt, imageMarks;
    if (item.image !== undefined) {
      const pattern = /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/;
      if (typeof item.image !== 'string' || !pattern.test(item.image)) fail(label + '格式无效。');
      const encoded = item.image.slice(item.image.indexOf(',') + 1), padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
      const decodedBytes = Math.floor(encoded.length * 3 / 4) - padding;
      if (encoded.length % 4 !== 0 || decodedBytes <= 0 || decodedBytes > 200 * 1024) fail(label + '超过 200 KB 或格式无效。');
      image = item.image;
    }
    if ((item.imageAt !== undefined || item.imageMarks !== undefined) && image === undefined) fail(label + '标记或时间必须对应截图。');
    if (item.imageAt !== undefined) {
      imageAt = string(item.imageAt, '截图时间', 50);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(imageAt) || !Number.isFinite(Date.parse(imageAt))) fail('截图时间必须是 ISO 日期时间。');
    }
    if (item.imageMarks !== undefined) {
      if (!ImageMarks || typeof ImageMarks.validate !== 'function') fail('截图标注校验器不可用。');
      try { imageMarks = ImageMarks.validate(item.imageMarks); } catch (_) { fail(label + '标注格式无效。'); }
    }
    return { ...(image === undefined ? {} : {image}), ...(imageAt === undefined ? {} : {imageAt}), ...(imageMarks === undefined ? {} : {imageMarks}) };
  }
  function validateCatalog(input) {
    assertData(input);
    let encoded;
    try { encoded = JSON.stringify(input); } catch (_) { fail('目录必须是有效的纯数据。'); }
    if (typeof encoded !== 'string' || new TextEncoder().encode(encoded).length > 512 * 1024) fail('目录超过 512 KB。');
    keys(input, ['format','schemaVersion','version','workflows'], '目录');
    if (input.format !== 'runtime-sop-catalog' || input.schemaVersion !== 1) fail('目录格式或版本无效。');
    const version = string(input.version, '目录版本', 64);
    if (!Array.isArray(input.workflows) || input.workflows.length < 1 || input.workflows.length > 500) fail('目录工作流数量无效。');
    const ids = new Set(), files = new Set();
    const workflows = input.workflows.map(w => {
      keys(w, ['id','title','summary','status','viewer','file','sha256','rules'], '工作流');
      const id = string(w.id, '工作流 ID', 80);
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || ids.has(id)) fail('工作流 ID 无效或重复。');
      ids.add(id);
      const file = safeRelativeFile(w.file);
      if (files.has(file)) fail('工作流文件路径重复。');
      files.add(file);
      if (!SHA.test(w.sha256)) fail('工作流 SHA-256 无效。');
      if (!['published','sample'].includes(w.status) || !['youtube','guide'].includes(w.viewer)) fail('工作流状态或查看器无效。');
      if (w.viewer === 'youtube' && id !== 'youtube-upload') fail('YouTube 查看器只支持 youtube-upload 身份。');
      if (!Array.isArray(w.rules) || w.rules.length > 50) fail('匹配规则数量无效。');
      const rules = w.rules.map(rule => {
        keys(rule, ['hosts','origins','pathPrefixes','pathEquals','fileUrls','priority','label'], '匹配规则');
        const fileUrls = rule.fileUrls === undefined ? undefined : [...new Set(strings(rule.fileUrls,'本机文件匹配网址',50,2048,1).map(fileUrl))];
        const hosts = strings(rule.hosts, '匹配域名', 50, 253, fileUrls ? 0 : 1).map(host => {
          const normalized = host.toLowerCase();
          let ipv6=false;try{ipv6=host.startsWith('[')&&host.endsWith(']')&&new URL('http://'+host).hostname===host;}catch(_){}
          if (host !== normalized || !ipv6&&!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(host)) fail('匹配域名必须是精确主机名。');
          return normalized;
        });
        if (new Set(hosts).size !== hosts.length) fail('匹配域名重复。');
        const paths = field => {
          const values = rule[field] === undefined ? [] : strings(rule[field], field, 50, 512);
          for (const path of values) if (!path.startsWith('/') || path.includes('?') || path.includes('#') || path.includes('\\') || /%2f|%5c/i.test(path) || path.split('/').some(part => part === '.' || part === '..')) fail(field + '路径无效。');
          return [...new Set(values)];
        };
        const pathPrefixes = paths('pathPrefixes'), pathEquals = paths('pathEquals');
        if (fileUrls) {
          if(hosts.length || rule.origins !== undefined || pathPrefixes.length || pathEquals.length) fail('file:// 匹配规则只能包含精确文件网址。');
        } else if (!hosts.length) fail('HTTP(S) 匹配规则必须包含主机名。');
        if (!Number.isInteger(rule.priority) || rule.priority < 0 || rule.priority > 100) fail('规则优先级必须为 0 至 100 的整数。');
        const origins=rule.origins===undefined?undefined:strings(rule.origins,'工作站点',50,2048,1).map(value=>{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.origin!==value||url.username||url.password||!hosts.includes(url.hostname))fail('工作站点必须是与主机一致的规范 HTTP(S) origin。');return value;});
        return { hosts, ...(origins?{origins}:{}), ...(rule.pathPrefixes === undefined ? {} : {pathPrefixes}), ...(rule.pathEquals === undefined ? {} : {pathEquals}), ...(fileUrls?{fileUrls}:{}), priority:rule.priority, label:string(rule.label,'规则标签',120) };
      });
      return { id, title:string(w.title,'工作流标题',160), summary:string(w.summary,'工作流摘要',1000,true), status:w.status, viewer:w.viewer, file, sha256:w.sha256.toLowerCase(), rules };
    });
    return { format:'runtime-sop-catalog', schemaVersion:1, version, workflows };
  }
  function validateGuide(input) {
    assertData(input);
    let encoded;
    try { encoded = JSON.stringify(input); } catch (_) { fail('指南必须是有效的纯数据。'); }
    if (typeof encoded !== 'string' || new TextEncoder().encode(encoded).length > 4 * 1024 * 1024) fail('指南超过 4 MB。');
    keys(input, ['format','schemaVersion','workflowId','title','version','notice','steps'], '指南');
    if (input.format !== 'runtime-sop-guide' || input.schemaVersion !== 1 || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.workflowId)) fail('指南格式或身份无效。');
    if (!Array.isArray(input.steps) || input.steps.length < 1 || input.steps.length > 100) fail('指南步骤数量无效。');
    const seen = new Set();
    const steps = input.steps.map((step, index) => {
      try {
      keys(step, ['id','title','where','actions','expected','trouble','acceptance','image','imageAt','imageMarks','workUrl','imageMode','issues','pointType','pointNote'], '指南步骤');
      const id = string(step.id, '步骤 ID', 80);
      if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || seen.has(id)) fail('步骤 ID 无效或重复。');
      seen.add(id);
      if(step.pointType!==undefined&&!['normal','report','approval','both'].includes(step.pointType))fail('步骤节点类型无效。');
      if(step.pointNote!==undefined)string(step.pointNote,'节点要求',1500,true);
      if(Array.isArray(step.actions)&&!step.actions.length)fail('请填写操作说明。');
      const hasImageMeta = step.imageAt !== undefined || step.imageMarks !== undefined;
      let image;
      if (step.image !== undefined) {
        const pattern = /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/;
        if (typeof step.image !== 'string' || !pattern.test(step.image)) fail('指南截图格式无效。');
        const encoded = step.image.slice(step.image.indexOf(',') + 1);
        const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
        const decodedBytes = Math.floor(encoded.length * 3 / 4) - padding;
        if (encoded.length % 4 !== 0 || decodedBytes <= 0 || decodedBytes > 200 * 1024) fail('指南截图超过 200 KB 或格式无效。');
        image = step.image;
      }
      if ((hasImageMeta || step.imageMarks !== undefined) && image === undefined) fail('指南截图标记或时间必须对应截图。');
      let imageAt;
      if (step.imageAt !== undefined) {
        imageAt = string(step.imageAt, '截图时间', 50);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(imageAt) || !Number.isFinite(Date.parse(imageAt))) fail('截图时间必须是 ISO 日期时间。');
      }
      let imageMarks;
      if (step.imageMarks !== undefined) {
        if (!ImageMarks || typeof ImageMarks.validate !== 'function') fail('截图标注校验器不可用。');
        try { imageMarks = ImageMarks.validate(step.imageMarks); } catch (_) { fail('指南截图标注格式无效。'); }
      }
      const workUrl = step.workUrl === undefined ? undefined : guideUrl(step.workUrl);
      if (step.imageMode !== undefined && !['thumbnail','collapsed','expanded'].includes(step.imageMode)) fail('截图显示模式无效。');
      let issues;
      if (step.issues !== undefined) {
        if (!Array.isArray(step.issues) || step.issues.length > 10) fail('问题数量无效。');
        const issueIds = new Set();
        issues = step.issues.map(issue => {
          keys(issue, ['id','title','actions','next','image','imageAt','imageMarks'], '问题');
          const issueId = string(issue.id, '问题 ID', 80);
          if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(issueId) || issueIds.has(issueId)) fail('问题 ID 无效或重复。');
          issueIds.add(issueId);
          const issueImage = validateImageFields(issue, '问题截图');
          return { id:issueId, title:string(issue.title,'问题标题',160), actions:strings(issue.actions,'问题操作',20,1500,1), next:string(issue.next,'下一步',1500), ...issueImage };
        });
      }
      return { ...(step.pointType===undefined?{}:{pointType:step.pointType}), ...(step.pointNote===undefined?{}:{pointNote:step.pointNote}), id, title:string(step.title,'步骤标题',200,true), where:string(step.where,'步骤位置',500), actions:strings(step.actions,'步骤动作',100,1500,1), expected:string(step.expected,'预期结果',1500,true), trouble:string(step.trouble,'问题提示',1500,true), acceptance:strings(step.acceptance,'验收条件',100,1000,0), ...(image === undefined ? {} : {image}), ...(imageAt === undefined ? {} : {imageAt}), ...(imageMarks === undefined ? {} : {imageMarks}), ...(workUrl === undefined ? {} : {workUrl}), ...(step.imageMode === undefined ? {} : {imageMode:step.imageMode}), ...(issues === undefined ? {} : {issues}) };
      } catch(error) { fail('STEP '+(index+1)+'：'+error.message); }
    });
    return { format:'runtime-sop-guide', schemaVersion:1, workflowId:input.workflowId, title:string(input.title,'指南标题',160), version:string(input.version,'指南版本',64), notice:string(input.notice,'指南说明',1000,true), steps };
  }
  function resolveFile(catalogURL, relative) {
    const base = validateEndpoint(catalogURL);
    safeRelativeFile(relative);
    const folder = new URL('./', base);
    const result = new URL(relative, folder);
    if (result.protocol !== 'file:' || result.origin !== folder.origin || !result.pathname.startsWith(folder.pathname) || result.search || result.hash) fail('工作流文件必须位于目录文件夹内。');
    return result.href;
  }
  function matchPage(value, catalog) {
    const safeCatalog = validateCatalog(catalog);
    let page;
    try { page = new URL(value); } catch (_) { return {state:'none',candidates:[]}; }
    if (page.protocol === 'file:') {
      if (!page.pathname.startsWith('/') || page.username || page.password || page.href !== value) return {state:'none',candidates:[]};
    } else if (!['http:','https:'].includes(page.protocol) || !page.hostname) return {state:'none',candidates:[]};
    const host = page.hostname.toLowerCase(), path = page.pathname;
    const matches = [];
    for (const workflow of safeCatalog.workflows) {
      let best = null;
      for (const rule of workflow.rules) {
        if(page.protocol==='file:') {
          if(rule.fileUrls?.includes(page.href)&&(!best||rule.priority>best.priority)) best=rule;
          continue;
        }
        if(!['http:','https:'].includes(page.protocol))continue;
        if(rule.fileUrls)continue;
        if (!rule.hosts.includes(host)||rule.origins&&!rule.origins.includes(page.origin)) continue;
        const eq = rule.pathEquals?.length ? rule.pathEquals.includes(path) : false;
        const prefix = rule.pathPrefixes?.some(p => path === p || path.startsWith(p.endsWith('/') ? p : p + '/')) || false;
        if (!(eq || prefix || (!rule.pathEquals?.length && !rule.pathPrefixes?.length))) continue;
        if (!best || rule.priority > best.priority) best = rule;
      }
      if (best) matches.push({workflow,rule:best});
    }
    if (!matches.length) return {state:'none',candidates:[]};
    const max = Math.max(...matches.map(m => m.rule.priority));
    const candidates = matches.filter(m => m.rule.priority === max);
    return {state:candidates.length === 1 ? 'matched' : 'ambiguous', candidates};
  }
  return { validateCatalog, validateGuide, validateEndpoint, resolveFile, matchPage };
});
