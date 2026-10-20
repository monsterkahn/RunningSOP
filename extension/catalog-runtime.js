(function (root) {
  'use strict';
  const SETTINGS='runtime-sop-catalog-settings-v1',CACHE='runtime-sop-catalog-cache-v1',STATUS='runtime-sop-catalog-status-v1';
  const DEFAULT='',ALARM='runtime-sop-catalog-check-v1';
  const enabled=Boolean(root.chrome&&root.chrome.runtime&&root.chrome.runtime.id&&root.chrome.storage);
  let inFlight,validatedMemo=null;
  const CATALOG_LIMIT=512*1024,TOTAL_LIMIT=4*1024*1024,MAX_FETCHES=4;
  const Engine=()=>root.CatalogEngine,Source=()=>root.SOPStorageSource;
  const isDirectory=value=>typeof value==='string'&&/^sop-directory:/i.test(value);
  function validateEndpoint(value){return isDirectory(value)?Source().validateEndpoint(value):Engine().validateEndpoint(value);}
  function resolveResource(endpoint,file){
    if(isDirectory(endpoint))return Source().resolve(validateEndpoint(endpoint),file);
    if(file.endsWith('.json'))return Engine().resolveFile(endpoint,file);
    const base=new URL('./',validateEndpoint(endpoint)),url=new URL(file,base);
    if(url.protocol!=='file:'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.search||url.hash)throw Error('图片资源必须位于目录文件夹内。');
    return url.href;
  }
  async function sourceMatches(endpoint){if(!isDirectory(endpoint))return true;const info=await Source().info();return info.selected&&info.endpoint===endpoint;}

  async function getSettings(){
    if(!enabled)return {enabled:false,endpoint:DEFAULT};
    const value=(await chrome.storage.local.get(SETTINGS))[SETTINGS];
    const endpoint=typeof value?.endpoint==='string'&&value.endpoint.trim()?validateEndpoint(value.endpoint):'';return {enabled:Boolean(endpoint)&&value?.enabled!==false,endpoint};
  }
  async function digest(text){
    const bytes=new TextEncoder().encode(text);
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function encodeBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
  function decodeBase64(value){if(typeof value!=='string'||value.length>Math.ceil(TOTAL_LIMIT*4/3)+4||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('图片缓存格式无效。');const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;}
  function parse(raw,label){
    let value;
    try{value=JSON.parse(raw);}catch(_){throw Error(label+' JSON 无效。');}
    return value;
  }
  async function validateContents(catalogURL,catalog,rawContents,rawAssets={},fetchMissingAssets=false,signal){
    const contents={},assets={};
    for(const workflow of catalog.workflows){
      const raw=rawContents[workflow.id];
      if(typeof raw!=='string'||raw.length>4*1024*1024)throw Error('工作流文件缺失或超过 4 MB。');
      if(await digest(raw)!==workflow.sha256)throw Error('工作流 '+workflow.id+' 的 SHA-256 不匹配。');
      let parsed=parse(raw,'工作流 '+workflow.id);
      if(parsed?.format==='runtime-sop-document'){
        if(!root.SOPAssets||typeof root.SOPAssets.hydrate!=='function')throw Error('图片资源读取器不可用。');
        const workflowAssets=rawAssets?.[workflow.id]&&typeof rawAssets[workflow.id]==='object'?rawAssets[workflow.id]:{};assets[workflow.id]={};
        parsed=await root.SOPAssets.hydrate(parsed,workflow,async file=>{
          const prefix='workflows/'+workflow.id+'/images/';
          if(typeof file!=='string'||!file.startsWith(prefix)||!/^workflows\/[a-z0-9][a-z0-9-]{0,79}\/images\/[a-f0-9]{64}\.(?:jpg|png)$/.test(file))throw Error('图片资源路径无效。');
          if(typeof workflowAssets[file]==='string'){try{const cached=decodeBase64(workflowAssets[file]);assets[workflow.id][file]=workflowAssets[file];return cached;}catch(error){if(!fetchMissingAssets)throw error;}}
          if(!fetchMissingAssets)throw Error('图片资源尚未缓存。');
          const assetURL=resolveResource(catalogURL,file);
          if(isDirectory(assetURL)){const bytes=await Source().read(assetURL,{binary:true,limit:TOTAL_LIMIT});assets[workflow.id][file]=encodeBase64(bytes);return bytes;}
          const response=await fetchResponse(assetURL,'图片资源',signal);
          if(Number(response.headers.get('content-length'))>TOTAL_LIMIT)throw Error('图片资源超过大小限制。');
          const reader=response.body?.getReader();
          let bytes;
          if(!reader){bytes=new Uint8Array(await response.arrayBuffer());}
          else{const parts=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>TOTAL_LIMIT)throw Error('图片资源超过大小限制。');parts.push(value);}bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}}
          assets[workflow.id][file]=encodeBase64(bytes);return bytes;
        });
      }
      const validated=workflow.viewer==='youtube'?await root.SOPSync.verify(parsed):Engine().validateGuide(parsed);
      if(workflow.viewer==='guide'&&validated.workflowId!==workflow.id)throw Error('指南身份与目录不匹配。');
      if(workflow.viewer==='youtube'&&parsed.workflowId!=='youtube-upload')throw Error('YouTube 内容身份无效。');
      resolveResource(catalogURL,workflow.file);
      contents[workflow.id]={raw,validated};
    }
    return {contents,assets};
  }
  async function validateSnapshot(entry,endpoint){
    if(!entry||entry.endpoint!==endpoint||typeof entry.rawCatalog!=='string'||new TextEncoder().encode(entry.rawCatalog).length>CATALOG_LIMIT)return null;
    try{
      const catalog=Engine().validateCatalog(parse(entry.rawCatalog,'目录'));
      const ids=new Set(catalog.workflows.map(w=>w.id));
      const sourceContents=entry.rawContents&&typeof entry.rawContents==='object'&&!Array.isArray(entry.rawContents)?entry.rawContents:{};
      const sourceAssets=entry.rawAssets&&typeof entry.rawAssets==='object'&&!Array.isArray(entry.rawAssets)?entry.rawAssets:{};
      const rawContents={},rawAssets={};let total=new TextEncoder().encode(entry.rawCatalog).length;
      for(const workflow of catalog.workflows){
        const raw=sourceContents[workflow.id];if(typeof raw!=='string')continue;
        const bodySize=new TextEncoder().encode(raw).length;if(bodySize>TOTAL_LIMIT||total+bodySize>TOTAL_LIMIT)continue;
        rawContents[workflow.id]=raw;total+=bodySize;
        const group=sourceAssets[workflow.id];if(!group||typeof group!=='object'||Array.isArray(group))continue;
        const entries=Object.entries(group);if(entries.some(([,value])=>typeof value!=='string'))continue;
        const groupSize=entries.reduce((sum,[,value])=>sum+new TextEncoder().encode(value).length,0);
        if(total+groupSize>TOTAL_LIMIT)continue;
        rawAssets[workflow.id]=group;total+=groupSize;
      }
      const memo=validatedMemo;
      if(memo&&memo.endpoint===endpoint&&memo.rawCatalog===entry.rawCatalog&&JSON.stringify(memo.rawContents)===JSON.stringify(rawContents)&&JSON.stringify(memo.rawAssets||{})===JSON.stringify(rawAssets))
        return {endpoint,rawCatalog:entry.rawCatalog,catalog:memo.catalog,contents:memo.contents,rawAssets,checkedAt:typeof entry.checkedAt==='string'?entry.checkedAt:''};
      const contents={};
      return {endpoint,rawCatalog:entry.rawCatalog,catalog,contents,rawAssets,checkedAt:typeof entry.checkedAt==='string'?entry.checkedAt:''};
    }catch(_){return null;}
  }
  async function loadSnapshot(){
    if(!enabled)return null;
    try{
      const settings=await getSettings(),entry=(await chrome.storage.local.get(CACHE))[CACHE];
      if(!(await sourceMatches(settings.endpoint)))return null;
      return await validateSnapshot(entry,settings.endpoint);
    }catch(_){return null;}
  }
  async function loadCatalog(){const snapshot=await loadSnapshot();return snapshot?.catalog||null;}
  const workflowFlights=new Map();let cacheQueue=Promise.resolve();
  function withCacheLock(fn){const task=cacheQueue.catch(()=>{}).then(fn);cacheQueue=task.catch(()=>{});return task;}
  async function currentSnapshot(snapshot){const settings=await getSettings(),entry=(await chrome.storage.local.get(CACHE))[CACHE];return await sourceMatches(snapshot.endpoint)&&settings.endpoint===snapshot.endpoint&&entry?.endpoint===snapshot.endpoint&&entry.rawCatalog===snapshot.rawCatalog;}
  async function loadWorkflow(id){
    if(!enabled)return null;
    const flightSettings=await getSettings(),snapshot=await loadSnapshot();if(!snapshot||snapshot.endpoint!==flightSettings.endpoint)return null;
    const flightKey=flightSettings.endpoint+'\n'+snapshot.rawCatalog+'\n'+id;
    if(workflowFlights.has(flightKey))return workflowFlights.get(flightKey);
    const task=(async()=>{
      const settings=flightSettings;
      const workflow=snapshot.catalog.workflows.find(item=>item.id===id);if(!workflow)return null;
      if(snapshot.contents?.[id]?.validated)return await currentSnapshot(snapshot)?snapshot.contents[id].validated:null;
      const control=new AbortController(),timer=setTimeout(()=>control.abort(),30000);
      try{
        let entry=(await chrome.storage.local.get(CACHE))[CACHE],raw=entry?.endpoint===settings.endpoint&&entry.rawCatalog===snapshot.rawCatalog?entry.rawContents?.[id]:null;
        if(typeof raw!=='string'||new TextEncoder().encode(raw).length>TOTAL_LIMIT||await digest(raw)!==workflow.sha256)raw=await fetchText(resolveResource(settings.endpoint,workflow.file),TOTAL_LIMIT,'工作流 '+id,control.signal);
        if(await digest(raw)!==workflow.sha256)throw Error('工作流 '+id+' 的 SHA-256 不匹配。');
        const result=await validateContents(settings.endpoint,{workflows:[workflow]},{[id]:raw},entry?.rawAssets||{},true,control.signal),contents=result.contents;
        return await withCacheLock(async()=>{
        entry=(await chrome.storage.local.get(CACHE))[CACHE];
        if(!entry||entry.endpoint!==settings.endpoint||entry.rawCatalog!==snapshot.rawCatalog||(await getSettings()).endpoint!==settings.endpoint||!(await sourceMatches(settings.endpoint)))return null;
        const next={...entry,rawContents:{...(entry.rawContents||{}),[id]:raw},rawAssets:{...(entry.rawAssets||{})},checkedAt:entry.checkedAt};
        if(Object.keys(result.assets[id]||{}).length)next.rawAssets[id]=result.assets[id];else delete next.rawAssets[id];
        const cacheSize=()=>new TextEncoder().encode(next.rawCatalog).length+Object.values(next.rawContents).reduce((n,v)=>n+new TextEncoder().encode(v).length,0)+Object.values(next.rawAssets).reduce((n,group)=>n+Object.values(group).reduce((m,v)=>m+new TextEncoder().encode(v).length,0),0);
        while(cacheSize()>TOTAL_LIMIT){const victim=Object.keys(next.rawContents).find(key=>key!==id);if(!victim)break;delete next.rawContents[victim];delete next.rawAssets[victim];}
        if(cacheSize()<=TOTAL_LIMIT){
          await chrome.storage.local.set({[CACHE]:next});
          const previousContents=validatedMemo&&validatedMemo.endpoint===settings.endpoint&&validatedMemo.rawCatalog===snapshot.rawCatalog?validatedMemo.contents:{};
          validatedMemo={endpoint:settings.endpoint,rawCatalog:snapshot.rawCatalog,rawContents:{...next.rawContents},rawAssets:JSON.parse(JSON.stringify(next.rawAssets)),catalog:snapshot.catalog,contents:{...previousContents,[id]:contents[id]}};
        }
        return await currentSnapshot(snapshot)?contents[id].validated:null;
        });
      }finally{clearTimeout(timer);}
    })();workflowFlights.set(flightKey,task);try{return await task;}finally{workflowFlights.delete(flightKey);}
  }
  async function setStatus(state,message,extra={}){
    const status={state,message,checkedAt:new Date().toISOString(),...extra};
    await chrome.storage.local.set({[STATUS]:status});return status;
  }
  async function readLimited(response,limit,label){
    if(Number(response.headers.get('content-length'))>limit)throw Error(label+' 超过大小限制。');
    if(!response.body){const text=await response.text();if(new TextEncoder().encode(text).length>limit)throw Error(label+' 超过大小限制。');return text;}
    const reader=response.body.getReader(),parts=[];let size=0;
    try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>limit)throw Error(label+' 超过大小限制。');parts.push(chunk.value);}}
    catch(error){await reader.cancel().catch(()=>{});throw error;}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch(_){throw Error(label+' 不是有效 UTF-8。');}
  }
  async function fetchResponse(url,label,signal){
    const response=await fetch(url,{cache:'no-store',signal});
    if(!response.ok)throw Error('无法读取'+label+'（'+response.status+'）。');
    return response;
  }
  async function fetchText(url,limit,label,signal){
    if(isDirectory(url))return Source().read(url,{limit});
    return readLimited(await fetchResponse(url,label,signal),limit,label);
  }
  function isFileAccessAllowed(){
    return new Promise((resolve,reject)=>{
      let settled=false;const finish=value=>{if(!settled){settled=true;resolve(Boolean(value));}};
      try{
        const result=chrome.extension.isAllowedFileSchemeAccess(finish);
        if(result&&typeof result.then==='function')result.then(finish,reject);
        else if(typeof result==='boolean')finish(result);
      }catch(error){reject(error);}
    });
  }
  async function performCheck(force=false){
    const settings=await getSettings();
    if(!settings.endpoint)return setStatus('unconfigured','尚未设置存储器目录，可先录制本机 SOP。');if(!settings.enabled&&!force)return setStatus('disabled','目录自动检查已关闭。');
    if(!isDirectory(settings.endpoint)&&!(await isFileAccessAllowed()))return setStatus('blocked','请在扩展详情中开启“允许访问文件网址”，然后检查目录。');
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),30000);
    try{
      let rawCatalog,catalog,migrated=false;
      const oldEndpoint=settings.endpoint,tryEndpoints=[oldEndpoint];
      let lastError;
      for(const endpoint of tryEndpoints){try{const candidateRaw=await fetchText(endpoint,CATALOG_LIMIT,'目录',control.signal),candidate=Engine().validateCatalog(parse(candidateRaw,'目录'));rawCatalog=candidateRaw;catalog=candidate;settings.endpoint=validateEndpoint(endpoint);migrated=settings.endpoint!==oldEndpoint;break;}catch(error){lastError=error;}}
      if(!catalog)throw lastError||Error('目录不可用。');
      const previousEntry=(await chrome.storage.local.get(CACHE))[CACHE];
      const previous=await validateSnapshot(previousEntry,settings.endpoint);
      const rawContents={},rawAssets={};
      const oldById=new Map((previous?.catalog.workflows||[]).map(w=>[w.id,w]));
      for(const workflow of catalog.workflows){
        const old=oldById.get(workflow.id);
        if(old?.sha256===workflow.sha256&&typeof previousEntry?.rawContents?.[workflow.id]==='string'){
          rawContents[workflow.id]=previousEntry.rawContents[workflow.id];
          if(previousEntry.rawAssets?.[workflow.id])rawAssets[workflow.id]=previousEntry.rawAssets[workflow.id];
        }
      }
      const cacheSize=()=>new TextEncoder().encode(rawCatalog).length+Object.values(rawContents).reduce((n,v)=>n+new TextEncoder().encode(v).length,0)+Object.values(rawAssets).reduce((n,group)=>n+Object.values(group).reduce((m,v)=>m+new TextEncoder().encode(v).length,0),0);
      while(cacheSize()>TOTAL_LIMIT){const victim=Object.keys(rawContents)[0];if(!victim)break;delete rawContents[victim];delete rawAssets[victim];}
      if(migrated)await chrome.storage.local.set({[SETTINGS]:settings});
      const checkedAt=new Date().toISOString();
      const changed=previousEntry?.endpoint!==settings.endpoint||previousEntry?.rawCatalog!==rawCatalog||JSON.stringify(previousEntry?.rawContents||{})!==JSON.stringify(rawContents)||JSON.stringify(previousEntry?.rawAssets||{})!==JSON.stringify(rawAssets);
      await withCacheLock(async()=>{if((await getSettings()).endpoint!==settings.endpoint||!(await sourceMatches(settings.endpoint)))throw Error('目录来源已更改，请重新检查。');if(changed){await chrome.storage.local.set({[CACHE]:{endpoint:settings.endpoint,rawCatalog,rawContents,rawAssets,checkedAt}});validatedMemo=null;}});
      if(changed&&chrome.action?.setBadgeText)await chrome.action.setBadgeText({text:'新'});
      if(chrome.action?.setBadgeBackgroundColor)await chrome.action.setBadgeBackgroundColor({color:'#086ce8'});
      return setStatus('ready','目录已读取并验证；工作流正文会在打开时单独读取。',{version:catalog.version,endpoint:settings.endpoint,workflowCount:catalog.workflows.length});
    }catch(error){
      const cached=await loadSnapshot();
      const message=error.name==='AbortError'?'读取超时。':error.message+(isDirectory(settings.endpoint)?' 请在设置中确认存储器文件夹和读取授权。':' 请确认 存储器 文件夹已挂载、目录地址正确，并已允许访问文件网址；网页登录不代表文件夹已挂载。');
      return setStatus('offline',(cached?'目录暂不可读，继续使用已验证缓存。 ':'目录暂不可读，当前没有可用缓存。 ')+message);
    }finally{clearTimeout(timer);}
  }
  function check(options={}){
    if(!enabled)return Promise.resolve({state:'local',message:'独立 HTML 不连接目录；自动检查请使用 Chrome 扩展。'});
    if(inFlight&&options.force===true)return inFlight.then(status=>status.state==='disabled'?check({force:true}):status);
    if(!inFlight)inFlight=performCheck(options.force===true).catch(error=>setStatus('error','目录检查失败：'+error.message)).finally(()=>{inFlight=null;});
    return inFlight;
  }
  async function configure(value){
    if(!enabled)throw Error('目录设置仅在扩展中可用。');
    const endpoint=validateEndpoint(value.endpoint);
    if(inFlight)await inFlight;
    await withCacheLock(async()=>{
      if(!(await sourceMatches(endpoint)))throw Error('存储器目录与已选择的文件夹不匹配，请重新选择。');
      let previous={endpoint:''};
      // A validated, explicitly selected source can replace malformed old settings.
      try{previous=await getSettings();}catch(_){}
      await chrome.storage.local.set({[SETTINGS]:{enabled:value.enabled!==false,endpoint}});
      if(previous.endpoint!==endpoint){await chrome.storage.local.remove([CACHE,STATUS]);validatedMemo=null;}
    });
    if(value.enabled===false)await chrome.alarms.clear(ALARM);
    else await chrome.alarms.create(ALARM,{periodInMinutes:1});
    return check();
  }
  async function info(){
    if(!enabled)return {settings:{enabled:false,endpoint:DEFAULT},status:{state:'local',message:'独立 HTML 不连接目录；自动检查请使用 Chrome 扩展。'}};
    const settings=await getSettings(),status=(await chrome.storage.local.get(STATUS))[STATUS]||(settings.endpoint?{state:'waiting',message:'准备检查目录。'}:{state:'unconfigured',message:'尚未设置存储器目录，可先录制本机 SOP。'});
    return {settings,status};
  }
  function registerBackground(){
    async function start(){try{const settings=await getSettings();if(settings.enabled){await chrome.alarms.create(ALARM,{periodInMinutes:1});await check();}else await chrome.alarms.clear(ALARM);}catch(error){console.error('SOP catalog:',error.message);}}
    chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)check();});
    chrome.runtime.onStartup.addListener(start);chrome.runtime.onInstalled.addListener(start);
    chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
      if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return;
      if(!['catalog-check','catalog-configure'].includes(request?.type))return;
      (request.type==='catalog-check'?check({force:true}):configure(request.settings||{})).then(status=>sendResponse({status}),error=>sendResponse({error:error.message}));return true;
    });
    start();
  }
  root.CatalogSync={keys:{SETTINGS,CACHE,STATUS},SETTINGS,CACHE,STATUS,getSettings,info,loadSnapshot,loadCatalog,loadWorkflow,registerBackground};
})(typeof globalThis!=='undefined'?globalThis:this);
