(function (root) {
  'use strict';
  const SETTINGS='youtube-sop-sync-settings-v1',CACHE='youtube-sop-content-cache-v1',STATUS='youtube-sop-sync-status-v1';
  const DEFAULT='',ALARM='youtube-sop-content-check';
  const enabled=Boolean(root.chrome&&chrome.runtime&&chrome.runtime.id&&chrome.storage);
  let inFlight;
  async function getSettings(){
    if(!enabled)return {enabled:false,endpoint:DEFAULT};
    const value=(await chrome.storage.local.get(SETTINGS))[SETTINGS];
    const endpoint=typeof value?.endpoint==='string'&&value.endpoint.trim()?root.RemoteContent.validateEndpoint(value.endpoint):'';return {enabled:Boolean(endpoint)&&value?.enabled!==false,endpoint};
  }
  async function verify(input){
    const bundle=root.RemoteContent.validateBundle(input);
    const bytes=new TextEncoder().encode(JSON.stringify(root.RemoteContent.contentParts(bundle)));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==bundle.revision)throw Error('SOP 内容指纹不匹配，继续使用上一份可用内容。');
    return bundle;
  }
  async function loadCached(){
    if(!enabled)return null;
    const settings=await getSettings(),entry=(await chrome.storage.local.get(CACHE))[CACHE];
    if(!entry||entry.endpoint!==settings.endpoint)return null;
    try{return await verify(entry.bundle);}catch(_){return null;}
  }
  async function setStatus(state,message,extra={}){
    const status={state,message,checkedAt:new Date().toISOString(),...extra};
    await chrome.storage.local.set({[STATUS]:status});return status;
  }
  async function readLimited(response){
    const MAX=4*1024*1024;
    if(Number(response.headers.get('content-length'))>MAX)throw Error('发布文件超过 4 MB。');
    if(!response.body){const text=await response.text();if(new TextEncoder().encode(text).length>MAX)throw Error('发布文件超过 4 MB。');return text;}
    const reader=response.body.getReader(),parts=[];let size=0;
    try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX)throw Error('发布文件超过 4 MB。');parts.push(chunk.value);}}
    catch(error){await reader.cancel().catch(()=>{});throw error;}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    return new TextDecoder().decode(bytes);
  }
  async function performCheck(){
    const settings=await getSettings();
    if(!settings.enabled)return setStatus('disabled','自动同步已关闭。');
    if(!(await chrome.extension.isAllowedFileSchemeAccess()))return setStatus('blocked','请在扩展详情中开启“允许访问文件网址”，然后检查更新。');
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),8000);
    try{
      const response=await fetch(settings.endpoint,{cache:'no-store',signal:control.signal});
      if(!response.ok)throw Error('无法读取发布文件（'+response.status+'）。');
      const bundle=await verify(JSON.parse(await readLimited(response)));
      const old=(await chrome.storage.local.get(CACHE))[CACHE];
      const changed=old?.endpoint!==settings.endpoint||old?.bundle?.revision!==bundle.revision;
      if(changed){await chrome.action.setBadgeText({text:'新'});await chrome.storage.local.set({[CACHE]:{endpoint:settings.endpoint,bundle}});}
      await chrome.action.setBadgeBackgroundColor({color:'#086ce8'});
      return setStatus('ready','已同步 NAS 发布内容。',{version:bundle.contentVersion,revision:bundle.revision,publishedAt:bundle.publishedAt,endpoint:settings.endpoint});
    }catch(error){
      const hasCache=Boolean(await loadCached());
      return setStatus('offline',(hasCache?'NAS 暂不可读，继续使用已验证缓存。':'NAS 暂不可读，继续使用插件内置内容。')+' '+(error.name==='AbortError'?'读取超时。':error.message));
    }finally{clearTimeout(timer);}
  }
  function check(){
    if(!enabled)return Promise.resolve({state:'local',message:'独立 HTML 用于离线阅读；NAS 自动同步请使用 Chrome 扩展。'});
    if(!inFlight)inFlight=performCheck().catch(error=>setStatus('error','同步失败：'+error.message)).finally(()=>{inFlight=null;});
    return inFlight;
  }
  async function configure(value){
    const endpoint=root.RemoteContent.validateEndpoint(value.endpoint);
    if(inFlight)await inFlight; // Finish the previous source before replacing its cache/settings.
    const previous=await getSettings();
    await chrome.storage.local.set({[SETTINGS]:{enabled:value.enabled!==false,endpoint}});
    if(previous.endpoint!==endpoint)await chrome.storage.local.remove([CACHE,STATUS]);
    if(value.enabled===false)await chrome.alarms.clear(ALARM);
    else await chrome.alarms.create(ALARM,{periodInMinutes:1});
    return check();
  }
  async function info(){
    if(!enabled)return {settings:{enabled:false,endpoint:DEFAULT},status:{state:'local',message:'独立 HTML 用于离线阅读；NAS 自动同步请使用 Chrome 扩展。'}};
    const settings=await getSettings(),status=(await chrome.storage.local.get(STATUS))[STATUS]||{state:'waiting',message:'准备检查 NAS 发布内容。'};
    return {settings,status};
  }
  function registerBackground(){
    async function start(){try{const settings=await getSettings();if(settings.enabled){await chrome.alarms.create(ALARM,{periodInMinutes:1});await check();}else await chrome.alarms.clear(ALARM);}catch(error){console.error('SOP sync:',error.message);}}
    chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)check();});
    chrome.runtime.onStartup.addListener(start);chrome.runtime.onInstalled.addListener(start);
    chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
      if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return;
      if(!['sop-sync-check','sop-sync-configure'].includes(request?.type))return;
      (request.type==='sop-sync-check'?check():configure(request.settings||{})).then(status=>sendResponse({status}),error=>sendResponse({error:error.message}));return true;
    });
    start();
  }
  root.SOPSync={loadCached,info,verify,getSettings,registerBackground,keys:{SETTINGS,CACHE,STATUS}};
})(typeof globalThis!=='undefined'?globalThis:this);
