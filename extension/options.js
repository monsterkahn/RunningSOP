(function(root){
  'use strict';
if(typeof document!=='undefined')root.SOPIcons?.apply(document);
  const PREFERENCES='runtime-sop-workspace-preferences-v1';
  const LOGIN_SETTINGS='runtime-sop-nas-login-v1';
  const DEFAULT_LOGIN='';
  const $=id=>document.getElementById(id);
  let pendingCatalogFile=null,catalogView=null,selectingSource=false,checkingConnection=false,sourceInfo=null,sourceLocationKind='unspecified',sourceLocationEndpoint='',catalogURLDirty=false;
  const tr=text=>root.WorkspaceI18n?root.WorkspaceI18n.t(text):text;
  function normalizePreferences(value){return {language:['auto','zh','en','es','ru','ko','ja'].includes(value?.language)?value.language:'auto',guided:typeof value?.guided==='boolean'?value.guided:false};}
  function validateLoginUrl(value){
    if(typeof value!=='string'||!value.trim()||value.length>2048)throw Error('请输入有效的 HTTP(S) 登录地址。');
    let url;try{url=new URL(value);}catch(_){throw Error('请输入有效的 HTTP(S) 登录地址。');}
    if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error('登录地址必须使用 HTTP(S)，且不能包含用户名或密码。');
    return value;
  }
  function normalizeLogin(value){return {loginUrl:typeof value?.loginUrl==='string'&&value.loginUrl.trim()?validateLoginUrl(value.loginUrl):DEFAULT_LOGIN,username:typeof value?.username==='string'?value.username.slice(0,120):'',deviceHint:typeof value?.deviceHint==='string'?value.deviceHint.slice(0,240):''};}
  function show(id,text,kind=''){const node=$(id);if(!node)return;node.textContent=tr(text||'');node.className='status'+(kind?' '+kind:'');}
  function catalogMessage(status){
    if(!status)return '';
    const known={unconfigured:'尚未设置存储器目录，可先录制本机 SOP。',waiting:'准备检查目录。',ready:'已连接，打开 SOP 时读取步骤和图片。',disabled:'目录自动检查已关闭。',blocked:'请在扩展详情中开启“允许访问文件网址”，然后检查目录。'};
    if(known[status.state])return tr(known[status.state]);
    const message=status.message||'';
    for(const prefix of ['目录暂不可读，继续使用已验证缓存。','目录暂不可读，当前没有可用缓存。'])if(message.startsWith(prefix))return tr(prefix)+message.slice(prefix.length);
    return tr(message);
  }
  async function savePreferences(language){
    const previous=normalizePreferences((await chrome.storage.local.get(PREFERENCES))[PREFERENCES]);
    const next=normalizePreferences({...previous,language:language||previous.language});
    // Keep unknown future preference fields intact while preserving guided.
    await chrome.storage.local.set({[PREFERENCES]:{...(await chrome.storage.local.get(PREFERENCES))[PREFERENCES],...next}});
    root.WorkspaceI18n?.setLanguage(next.language);root.WorkspaceI18n?.apply(document);root.SOPReleaseNotes?.render($('release-notes'),root.WorkspaceI18n?.getLanguage());
    renderLanguage(next.language);
  }
  function renderLanguage(language){for(const code of ['auto','zh','en','es','ru','ko','ja'])$('language-'+code).setAttribute('aria-pressed',String(language===code));const resolved=root.WorkspaceI18n.resolveLanguage(language);document.documentElement.lang=resolved==='zh'?'zh-CN':resolved;}
  function send(type,settings){return new Promise((resolve,reject)=>chrome.runtime.sendMessage({type,...(settings?{settings}:{})},response=>{const error=chrome.runtime.lastError;if(error)return reject(Error(error.message));if(response?.error)return reject(Error(response.error));resolve(response); }));}
  function renderCatalog(result){
    const status=result?.status;
    catalogView={...(catalogView||{}),...result};
    if(status)show('catalog-status',catalogMessage(status),status.state==='ready'?'ok':(['offline','error','blocked'].includes(status.state)?'error':''));
    renderConnection();
    if(result?.settings){if(!catalogURLDirty)$('catalog-url').value=root.SOPStorageSource?.isEndpoint(result.settings.endpoint)?'':result.settings.endpoint||'';if(!selectingSource)$('auto-sync').checked=result.settings.endpoint?result.settings.enabled!==false:true;}
  }
  function renderConnection(){
    const view=root.ConnectionView.state({settings:catalogView?.settings,status:catalogView?.status,sourceInfo,checking:checkingConnection});
    $('source-connection').dataset.state=view;
    const labels=root.ConnectionView.labels[view];$('source-bridge-label').textContent=tr(labels[0]);$('source-device-state').textContent=tr(labels[1]);
    const stamp=catalogView?.status?.checkedAt,date=new Date(stamp||'');
    $('source-checked-at').textContent=(['ready','offline','error','blocked'].includes(catalogView?.status?.state)&&(!catalogView?.status?.endpoint||catalogView.status.endpoint===catalogView?.settings?.endpoint)&&Number.isFinite(date.getTime()))?tr('上次检查：')+date.toLocaleString(document.documentElement.lang||'zh-CN',{hour12:false}):'';
    $('source-kind').value=sourceLocationKind;
    $('source-end-icon').innerHTML=root.SOPIcons.svg(sourceLocationKind==='local'?'folder':'storage');
    if(checkingConnection)show('catalog-status','正在检查连接…');
    else if(view==='permission'&&root.SOPStorageSource.isEndpoint(catalogView?.settings?.endpoint))show('catalog-status','需要重新授权，请重新选择 SOP 文件夹。','error');
    else if(view==='offline'&&catalogView?.status?.state==='ready')show('catalog-status','内容库连接已变化，请重新选择 SOP 文件夹。','error');
    else if(view==='idle'&&catalogView?.status?.state==='ready')show('catalog-status','点击检查连接');
    else if(catalogView?.status)show('catalog-status',catalogMessage(catalogView.status),view==='ready'?'ok':(['offline','permission'].includes(view)?'error':''));
  }
  function connectionBusy(value){checkingConnection=value;renderConnection();}
  async function refreshCatalog(){
    try{const result=await root.CatalogSync.info();renderCatalog(result);await refreshSource(result);return result;}
    catch(error){sourceInfo=null;renderCatalog({status:{state:'error',message:error.message}});return null;}
  }
  async function refreshSource(result=catalogView){
    if(pendingCatalogFile)$('pending-file-name').textContent=tr('已选择文件：')+pendingCatalogFile.name;
    const endpoint=result?.settings?.endpoint||'',isDirectory=root.SOPStorageSource?.isEndpoint(endpoint);
    if(endpoint!==sourceLocationEndpoint)sourceLocationKind='unspecified';
    const info=await root.SOPStorageSource.info();sourceInfo=info;
    $('section-publishing').hidden=Boolean(isDirectory);$('source-publishing-note').hidden=!isDirectory;
    if(isDirectory&&info.selected&&info.endpoint===endpoint){
      $('source-name').removeAttribute('data-i18n');$('source-name').textContent=info.name||tr('SOP 文件夹');$('source-location-note').textContent=tr('已选择文件夹');
      const count=result?.status?.workflowCount??(await root.CatalogSync.loadCatalog())?.workflows.length;
      $('source-count').textContent=Number.isInteger(count)?tr('{count} 份 SOP').replace('{count}',String(count)):tr('已选择文件夹');
      if(info.readPermission&&info.readPermission!=='granted')$('source-count').textContent+=' · '+tr('需要重新授权');
    }else{
      $('source-name').removeAttribute('data-i18n');$('source-location-note').textContent=endpoint?tr('已保存的内容库地址'):tr('选择文件夹后连接');$('source-name').textContent=tr(endpoint?'已保存的内容库地址':'尚未选择文件夹');
      $('source-count').textContent=tr(endpoint?'点击检查连接':'尚未选择文件夹');
    }
    renderConnection();return info;
  }
  function sourceBusy(value){selectingSource=value;for(const id of ['choose-sop-folder','choose-catalog-file','grant-catalog-folder','save-catalog','check-catalog','cancel-catalog-file','auto-sync'])$(id).disabled=value;}
  async function chooseLibrary(expectedFile){
    if(selectingSource)return;
    // Start the native picker before awaiting work, retaining the user's click activation.
    const autoEnabled=$('auto-sync').checked;const picking=root.SOPStorageSource.chooseDirectory(expectedFile?{expectedFile}:{});sourceBusy(true);let selectionError=null;
    try{
      const selected=await picking;connectionBusy(true);let response=await send('catalog-configure',{endpoint:selected.endpoint,enabled:autoEnabled});
      if(!autoEnabled)response=await send('catalog-check');
      pendingCatalogFile=null;catalogURLDirty=false;$('pending-file').hidden=true;
      const info=await refreshCatalog();if(info)renderCatalog({settings:info.settings,status:response.status});await refreshDirectory();
    }catch(error){if(error.name!=='AbortError')selectionError=error;}
    finally{checkingConnection=false;sourceBusy(false);await refreshCatalog();if(selectionError)show('catalog-status',selectionError.message,'error');}
  }
  async function chooseCatalogFile(){
    if(selectingSource)return;const picking=root.SOPStorageSource.chooseFile();sourceBusy(true);
    try{const selected=await picking;pendingCatalogFile=selected.handle;$('pending-file-name').textContent=tr('已选择文件：')+selected.name;$('pending-file').hidden=false;}
    catch(error){if(error.name!=='AbortError')show('catalog-status',error.message,'error');}
    finally{sourceBusy(false);}
  }
  async function refreshDirectory(){
    try{
      const info=await root.NASPublisher.info();
      if(!info.selected){show('directory-state','尚未选择 存储器 发布文件夹。');return info;}
      const name=info.name||tr('发布文件夹');
      const permission={granted:'已选择 {name}，当前写入授权已允许。',prompt:'已选择 {name}；发布前浏览器可能会询问写入授权。',denied:'已选择 {name}，但当前写入授权未允许。',unsupported:'已选择 {name}；此浏览器无法查询写入授权状态。'};
      show('directory-state',tr(permission[info.permission]||permission.unsupported).replace('{name}',name),info.permission==='granted'?'ok':'');return info;
    }catch(error){show('directory-state',tr('无法读取发布文件夹状态：')+error.message,'error');return null;}
  }
  async function init(){
    if(!root.chrome?.storage?.local)return;
    const stored=(await chrome.storage.local.get([PREFERENCES,LOGIN_SETTINGS]));
    const prefs=normalizePreferences(stored[PREFERENCES]);
    sourceLocationKind=['network','local'].includes(stored[PREFERENCES]?.sourceLocationKind)?stored[PREFERENCES].sourceLocationKind:'unspecified';sourceLocationEndpoint=stored[PREFERENCES]?.sourceLocationEndpoint||'';$('source-kind').value=sourceLocationKind;
    let login;try{login=normalizeLogin(stored[LOGIN_SETTINGS]||{});}catch(_){login=normalizeLogin({});}
    root.WorkspaceI18n?.setLanguage(prefs.language);root.WorkspaceI18n?.apply(document);root.SOPReleaseNotes?.render($('release-notes'),root.WorkspaceI18n?.getLanguage());renderLanguage(prefs.language);
    renderLanguage(prefs.language);
    $('login-url').value=login.loginUrl;$('nas-username').value=login.username;$('device-hint').value=login.deviceHint;
    root.SOPReleaseNotes?.render($('release-notes'),root.WorkspaceI18n?.getLanguage());root.SOPAbout?.render();
    if(['#about','#updates'].includes(location.hash)){$('section-about').open=true;if(location.hash==='#updates')$('about-release-notes').open=true;$('section-about').scrollIntoView();}
    let languageQueue=Promise.resolve();
    for(const code of ['auto','zh','en','es','ru','ko','ja'])$('language-'+code).addEventListener('click',()=>{languageQueue=languageQueue.catch(()=>{}).then(()=>savePreferences(code)).then(()=>Promise.all([refreshCatalog(),refreshDirectory(),refreshStats()])).catch(e=>show('catalog-status','设置保存失败：'+e.message,'error'));});
    $('source-kind').addEventListener('change',()=>{const kind=$('source-kind').value,endpoint=catalogView?.settings?.endpoint||'';sourceLocationKind=kind;sourceLocationEndpoint=endpoint;renderConnection();languageQueue=languageQueue.catch(()=>{}).then(async()=>{const previous=(await chrome.storage.local.get(PREFERENCES))[PREFERENCES]||{};await chrome.storage.local.set({[PREFERENCES]:{...previous,sourceLocationKind:kind,sourceLocationEndpoint:endpoint}});}).catch(e=>show('catalog-status',e.message,'error'));});
    $('catalog-url').addEventListener('input',()=>{catalogURLDirty=true;});
    $('choose-sop-folder').addEventListener('click',()=>chooseLibrary());
    $('choose-catalog-file').addEventListener('click',chooseCatalogFile);
    $('grant-catalog-folder').addEventListener('click',()=>chooseLibrary(pendingCatalogFile));
    $('cancel-catalog-file').addEventListener('click',()=>{pendingCatalogFile=null;$('pending-file').hidden=true;});
    $('auto-sync').addEventListener('change',async()=>{if(selectingSource)return;try{const info=await root.CatalogSync.info();if(!info.settings.endpoint)return;const result=await send('catalog-configure',{endpoint:info.settings.endpoint,enabled:$('auto-sync').checked});renderCatalog({settings:{...info.settings,enabled:$('auto-sync').checked},status:result.status});}catch(e){show('catalog-status',e.message,'error');}});
    $('save-catalog').addEventListener('click',async()=>{const button=$('save-catalog');button.disabled=true;connectionBusy(true);try{const endpoint=root.CatalogEngine.validateEndpoint($('catalog-url').value);await send('catalog-configure',{endpoint,enabled:$('auto-sync').checked});await chrome.storage.local.remove(root.SOPStorageSource.KEY);catalogURLDirty=false;await refreshCatalog();}catch(e){show('catalog-status',e.message,'error');}finally{button.disabled=false;connectionBusy(false);}});
    $('check-catalog').addEventListener('click',async()=>{const button=$('check-catalog');button.disabled=true;connectionBusy(true);try{const result=await send('catalog-check');renderCatalog({status:result.status});await refreshSource();}catch(e){renderCatalog({status:{state:'error',message:e.message}});}finally{button.disabled=false;connectionBusy(false);}});
    $('file-access').addEventListener('click',()=>chrome.tabs.create({url:'chrome://extensions/?id='+chrome.runtime.id}));
    $('save-login').addEventListener('click',async()=>{try{const value=normalizeLogin({loginUrl:$('login-url').value,username:$('nas-username').value,deviceHint:$('device-hint').value});await chrome.storage.local.set({[LOGIN_SETTINGS]:value});$('login-url').value=value.loginUrl;$('nas-username').value=value.username;$('device-hint').value=value.deviceHint;show('login-status','登录设置已保存在本机；密码未保存。','ok');}catch(e){show('login-status',e.message,'error');}});
    $('open-login').addEventListener('click',async()=>{try{const url=validateLoginUrl($('login-url').value);await chrome.tabs.create({url});show('login-status','已在新标签页打开 存储器 登录地址；请在 存储器 页面自行登录。','ok');}catch(e){show('login-status',e.message,'error');}});
    $('choose-directory').addEventListener('click',async()=>{const button=$('choose-directory');button.disabled=true;try{await root.NASPublisher.chooseDirectory();await refreshDirectory();}catch(e){show('directory-state',e.message,'error');}finally{button.disabled=false;}});
    const refreshStats=async()=>{try{const r=await SOPStats.request('stats-get');show('statistics-status',r.status.message);}catch(e){show('statistics-status',e.message,'error');}};
    $('connect-stats').onclick=async()=>{try{await SOPStats.connect();await refreshStats();}catch(e){show('statistics-status',e.message,'error');}};
    $('flush-stats').onclick=async()=>{try{await SOPStats.request('stats-flush');await refreshStats();}catch(e){show('statistics-status',e.message,'error');}};
    $('disable-stats').onclick=async()=>{try{await SOPStats.disconnect();await refreshStats();}catch(e){show('statistics-status',e.message,'error');}};
    $('export-stats').onclick=async()=>{try{const r=await SOPStats.request('stats-get');if(!r.snapshot)throw Error('尚无本机统计。');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(r.snapshot,null,2)],{type:'application/json'}));a.download=r.snapshot.clientId+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}catch(e){show('statistics-status',e.message,'error');}};

    let sourceRefresh=Promise.resolve();
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local'||![root.CatalogSync.SETTINGS,root.CatalogSync.STATUS,root.SOPStorageSource.KEY].some(key=>key in changes))return;
      sourceRefresh=sourceRefresh.catch(()=>{}).then(()=>refreshCatalog());
    });
    await Promise.all([refreshCatalog(),refreshDirectory(),refreshStats()]);
  }
  const api={PREFERENCES,LOGIN_SETTINGS,DEFAULT_LOGIN,normalizePreferences,validateLoginUrl,normalizeLogin,init};
  root.WorkspaceOptions=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init,{once:true});
})(typeof globalThis!=='undefined'?globalThis:this);
