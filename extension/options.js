(function(root){
  'use strict';
if(typeof document!=='undefined')root.SOPIcons?.apply(document);
  const PREFERENCES='runtime-sop-workspace-preferences-v1';
  const LOGIN_SETTINGS='runtime-sop-nas-login-v1';
  const DEFAULT_LOGIN='';
  const $=id=>document.getElementById(id);
  let catalogView=null,selectingSource=false,sourceInfo=null,deviceName='';
  let appearanceEndpoint='',appearanceDirty=false,appearanceIcon='folder',installingPages=false,pageInstallState='',pageInstallHandle=null,pageInstallEndpoint='';
  const tr=text=>root.WorkspaceI18n?root.WorkspaceI18n.t(text):text;
  function normalizePreferences(value){return {language:['auto','zh','zh-TW','en','es','ru','ko','ja'].includes(value?.language)?value.language:'auto',guided:typeof value?.guided==='boolean'?value.guided:false};}
  function validateLoginUrl(value){
    if(typeof value!=='string'||!value.trim()||value.length>2048)throw Error('请输入有效的 HTTP(S) 登录地址。');
    let url;try{url=new URL(value);}catch(_){throw Error('请输入有效的 HTTP(S) 登录地址。');}
    if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error('登录地址必须使用 HTTP(S)，且不能包含用户名或密码。');
    return value;
  }
  function normalizeLogin(value){return {loginUrl:typeof value?.loginUrl==='string'&&value.loginUrl.trim()?validateLoginUrl(value.loginUrl):DEFAULT_LOGIN,username:typeof value?.username==='string'?value.username.slice(0,120):'',deviceHint:typeof value?.deviceHint==='string'?value.deviceHint.slice(0,240):''};}
  function show(id,text,kind=''){const node=$(id);if(!node)return;node.textContent=tr(text||'');node.className='status'+(kind?' '+kind:'');}
  async function savePreferences(language){
    const previous=normalizePreferences((await chrome.storage.local.get(PREFERENCES))[PREFERENCES]);
    const next=normalizePreferences({...previous,language:language||previous.language});
    // Keep unknown future preference fields intact while preserving guided.
    await chrome.storage.local.set({[PREFERENCES]:{...(await chrome.storage.local.get(PREFERENCES))[PREFERENCES],...next}});
    root.WorkspaceI18n?.setLanguage(next.language);root.WorkspaceI18n?.apply(document);root.SOPReleaseNotes?.render($('release-notes'),root.WorkspaceI18n?.getLanguage());
    renderLanguage(next.language);
  }
  const PAGE_WORDS={
    en:['Open dashboard','Install missing dashboard pages','Selecting a folder adds index.html and relationships.html. Existing pages are preserved.','Dashboard pages are ready; existing pages were preserved.','Dashboard pages could not be installed. SOPs remain available. Retry when write access is available.','Installing dashboard pages…'],
    zh:['打开总表','补装缺失的总表页面','选择文件夹后会添加 index.html 和 relationships.html，已有页面会保留。','总表页面已就绪，已有页面已保留。','未能安装总表页面，SOP 仍可使用。获得写入权限后可重试。','正在安装总表页面…'],
    'zh-TW':['開啟總表','補裝缺少的總表頁面','選擇資料夾後會新增 index.html 和 relationships.html，已有頁面會保留。','總表頁面已就緒，已有頁面已保留。','無法安裝總表頁面，SOP 仍可使用。取得寫入權限後可重試。','正在安裝總表頁面…'],
    es:['Abrir panel','Instalar páginas que faltan','Al elegir una carpeta se añaden index.html y relationships.html. Se conservan las páginas existentes.','Páginas listas; se conservaron las existentes.','No se pudieron instalar las páginas. Los SOP siguen disponibles. Reintenta con acceso de escritura.','Instalando páginas…'],
    ru:['Открыть панель','Установить недостающие страницы','При выборе папки добавляются index.html и relationships.html. Существующие страницы сохраняются.','Страницы готовы; существующие страницы сохранены.','Не удалось установить страницы. SOP доступны. Повторите с правом записи.','Установка страниц…'],
    ko:['대시보드 열기','없는 대시보드 페이지 설치','폴더를 선택하면 index.html과 relationships.html을 추가합니다. 기존 페이지는 보존됩니다.','페이지가 준비되었습니다. 기존 페이지를 보존했습니다.','페이지를 설치하지 못했습니다. SOP는 계속 사용할 수 있습니다. 쓰기 권한을 얻은 후 다시 시도하세요.','페이지 설치 중…'],
    ja:['ダッシュボードを開く','不足しているページを追加','フォルダー選択時に index.html と relationships.html を追加します。既存のページは保持されます。','ページの準備ができました。既存のページは保持されています。','ページを追加できませんでした。SOP は利用できます。書き込み権限を取得して再試行してください。','ページを追加中…']
  };
  function renderPageEntry(){
    const words=PAGE_WORDS[root.WorkspaceI18n?.getLanguage()]||PAGE_WORDS.en;
    $('install-storage-pages').textContent=words[1];$('storage-pages-help').textContent=words[2];
    const status=$('storage-pages-status');status.textContent=pageInstallState?words[{ready:3,error:4,busy:5}[pageInstallState]]:'';status.className='status'+(pageInstallState==='error'?' error':'');
    $('install-storage-pages').disabled=installingPages||selectingSource||!pageInstallHandle;
  }
  async function installStoragePages(endpoint,handle,permission){
    if(installingPages)return;
    installingPages=true;pageInstallState='busy';renderPageEntry();
    try{
      if(permission&&await permission!=='granted')throw Error('permission denied');
      if(!endpoint&&!handle){const selected=await root.SOPStorageSource.info();endpoint=selected.endpoint;handle=await root.SOPStorageSource.getHandle();}
      if(!endpoint||!handle)throw Error('unconfigured');
      const guard=async()=>{const [info,view,latest]=await Promise.all([root.SOPStorageSource.info(),root.CatalogSync.info(),root.SOPStorageSource.getHandle()]);return info.endpoint===endpoint&&view.settings?.endpoint===endpoint&&Boolean(latest&&await handle.isSameEntry(latest));};
      const response=await fetch(chrome.runtime.getURL('storage-pages.json'),{cache:'no-store'});if(!response.ok)throw Error('bundle unavailable');
      await root.SOPStoragePageInstaller.install({handle,bundle:await response.json(),guard});pageInstallState='ready';
    }catch(_){pageInstallState='error';}
    finally{installingPages=false;renderPageEntry();}
  }
  function renderLibraryEntry(){
    const code=root.WorkspaceI18n?.getLanguage()||'en',labels={en:['View SOP overview','Overview, categories, SOPs, retained versions and process relationships.'],zh:['查看 SOP 总表','在一个工作区查看总览、分类、SOP、历史版本与流程关系。'],'zh-TW':['查看 SOP 總表','在同一工作區查看總覽、分類、SOP、歷史版本與流程關係。'],es:['Ver resumen de SOP','Resumen, categorías, SOP, versiones conservadas y relaciones de procesos.'],ru:['Обзор SOP','Обзор, категории, SOP, сохранённые версии и связи процессов.'],ko:['SOP 전체 보기','개요, 분류, SOP, 보관된 버전과 프로세스 관계를 확인하세요.'],ja:['SOP 一覧を見る','概要、分類、SOP、保存された版とプロセスの関係を確認できます。']}[code]||['View SOP overview','Overview, categories, SOPs, retained versions and process relationships.'];
    if($('open-folder-library'))$('open-folder-library').textContent=labels[0];if($('folder-library-help'))$('folder-library-help').textContent=labels[1];renderPageEntry();
  }
  function renderLanguage(language){$('language-auto').title=tr('跟随浏览器语言');for(const code of ['auto','zh','zh-TW','en','es','ru','ko','ja'])$('language-'+code).setAttribute('aria-pressed',String(language===code));const resolved=root.WorkspaceI18n.resolveLanguage(language);document.documentElement.lang=resolved==='zh'?'zh-CN':resolved;renderLibraryEntry();document.dispatchEvent(new Event('workspace-language-change'));}
  function send(type,settings){return new Promise((resolve,reject)=>chrome.runtime.sendMessage({type,...(settings?{settings}:{})},response=>{const error=chrome.runtime.lastError;if(error)return reject(Error(error.message));if(response?.error)return reject(Error(response.error));resolve(response); }));}
  async function refreshCatalog(){
    try{
      const result=await root.CatalogSync.info(),endpoint=result.settings?.endpoint||'',info=await root.SOPStorageSource.info();
      catalogView=result;sourceInfo=info;
      const selected=root.SOPStorageSource.isEndpoint(endpoint)&&info.selected&&info.endpoint===endpoint;
      pageInstallHandle=selected?await root.SOPStorageSource.getHandle():null;pageInstallEndpoint=selected?endpoint:'';
      const view=root.ConnectionView.state({settings:result.settings,status:result.status,sourceInfo:info,checking:selectingSource});
      $('source-connection').dataset.state=view;
      $('source-name').textContent=selected?(info.displayName||info.name||tr('SOP 文件夹')):tr('尚未选择文件夹');
      $('source-end-icon').innerHTML=root.SOPIcons.svg(selected?info.icon:'folder');
      $('source-appearance').hidden=!selected;
      if($('folder-library-entry'))$('folder-library-entry').hidden=false;
      renderLibraryEntry();
      $('source-state-label').hidden=!selected;
      if(selected){
        $('source-state-label').textContent=tr(root.ConnectionView.labels[view][0])+(view==='ready'&&deviceName?' · '+deviceName:'');
        if(appearanceEndpoint!==endpoint||!appearanceDirty){appearanceEndpoint=endpoint;appearanceDirty=false;$('source-display-name').value=info.displayName||info.name||'';appearanceIcon=info.icon||'folder';renderAppearance();}
      }else{appearanceEndpoint='';appearanceDirty=false;}
      return result;
    }catch(error){showError(error.message);return null;}
  }
  function showError(message){$('catalog-status').hidden=!message;show('catalog-status',message,'error');}
  function renderAppearance(){for(const button of document.querySelectorAll('[data-source-icon]'))button.setAttribute('aria-pressed',String(button.dataset.sourceIcon===appearanceIcon));}
  async function chooseLibrary(){
    if(selectingSource)return;
    const picking=root.SOPStorageSource.chooseDirectory({mode:'readwrite'});
    selectingSource=true;$('choose-sop-folder').disabled=true;showError('');
    try{
      const selected=await picking;
      // Preserve a previously enabled schedule; choosing a new library alone
      // performs one check and does not opt the user into background polling.
      let previous=null;
      // Explicit folder selection must also recover malformed older settings.
      // An unreadable setting is not evidence that polling was enabled.
      try{previous=(await root.CatalogSync.info()).settings;}catch(_){}
      await send('catalog-configure',{endpoint:selected.endpoint,enabled:previous?.enabled===true});
      const checked=await send('catalog-check');
      if(['offline','error','blocked'].includes(checked.status?.state))throw Error(checked.status.message||tr('暂时无法读取'));
      await installStoragePages(selected.endpoint,await root.SOPStorageSource.getHandle());
    }catch(error){if(error.name!=='AbortError')showError(error.message);}
    finally{selectingSource=false;$('choose-sop-folder').disabled=false;await refreshCatalog();}
  }
  async function init(){
    if(!root.chrome?.storage?.local)return;
    const pauseMotion=()=>{document.documentElement.dataset.motionPaused=String(document.hidden);};
    pauseMotion();document.addEventListener('visibilitychange',pauseMotion);
    const stored=(await chrome.storage.local.get([PREFERENCES]));
    const prefs=normalizePreferences(stored[PREFERENCES]);
    root.WorkspaceI18n?.setLanguage(prefs.language);root.WorkspaceI18n?.apply(document);root.SOPReleaseNotes?.render($('release-notes'),root.WorkspaceI18n?.getLanguage());renderLanguage(prefs.language);
    renderLanguage(prefs.language);
    root.SOPReleaseNotes?.render($('release-notes'),root.WorkspaceI18n?.getLanguage());root.SOPAbout?.render();
    if(['#about','#updates'].includes(location.hash)){if(location.hash==='#updates')$('about-release-notes').open=true;$('section-about').scrollIntoView();}
    let languageQueue=Promise.resolve();
    for(const code of ['auto','zh','zh-TW','en','es','ru','ko','ja'])$('language-'+code).addEventListener('click',()=>{languageQueue=languageQueue.catch(()=>{}).then(()=>savePreferences(code)).then(()=>refreshCatalog()).catch(e=>show('catalog-status','设置保存失败：'+e.message,'error'));});
    $('source-display-name').addEventListener('input',()=>{appearanceDirty=true;show('source-appearance-status','');});
    for(const button of document.querySelectorAll('[data-source-icon]'))button.addEventListener('click',()=>{appearanceDirty=true;appearanceIcon=button.dataset.sourceIcon;renderAppearance();show('source-appearance-status','');});
    $('save-source-appearance').addEventListener('click',async()=>{
      const button=$('save-source-appearance');button.disabled=true;
      try{await root.SOPStorageSource.saveAppearance({endpoint:appearanceEndpoint,name:$('source-display-name').value,icon:appearanceIcon});appearanceDirty=false;await refreshCatalog();show('source-appearance-status','已保存','ok');$('source-appearance').open=false;}
      catch(e){show('source-appearance-status',e.message,'error');}finally{button.disabled=false;}
    });
    $('choose-sop-folder').addEventListener('click',chooseLibrary);
    $('install-storage-pages').addEventListener('click',()=>{
      const handle=pageInstallHandle,endpoint=pageInstallEndpoint;if(!handle||installingPages||selectingSource)return;
      // Retry authorization belongs to this click, before any asynchronous work.
      try{const permission=typeof handle.requestPermission==='function'?handle.requestPermission({mode:'readwrite'}):handle.queryPermission({mode:'readwrite'});installStoragePages(endpoint,handle,permission);}
      catch(_){pageInstallState='error';renderPageEntry();}
    });

    let sourceRefresh=Promise.resolve();
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local'||![root.CatalogSync.SETTINGS,root.CatalogSync.STATUS,root.SOPStorageSource.KEY].some(key=>key in changes))return;
      sourceRefresh=sourceRefresh.catch(()=>{}).then(()=>refreshCatalog());
    });
    try{deviceName=await root.RunningSOPDeviceName.get();}catch(_){}
    await refreshCatalog();
  }
  const api={PREFERENCES,LOGIN_SETTINGS,DEFAULT_LOGIN,normalizePreferences,validateLoginUrl,normalizeLogin,init};
  root.WorkspaceOptions=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init,{once:true});
})(typeof globalThis!=='undefined'?globalThis:this);
