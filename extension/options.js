(function(root){
  'use strict';
if(typeof document!=='undefined')root.SOPIcons?.apply(document);
  const PREFERENCES='runtime-sop-workspace-preferences-v1';
  const LOGIN_SETTINGS='runtime-sop-nas-login-v1';
  const DEFAULT_LOGIN='';
  const $=id=>document.getElementById(id);
  let catalogView=null,selectingSource=false,sourceInfo=null;
  let appearanceEndpoint='',appearanceDirty=false,appearanceIcon='folder';
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
  function renderLibraryEntry(){
    const code=root.WorkspaceI18n?.getLanguage()||'en',labels={en:['View SOP overview','Browse SOPs and retained versions.'],zh:['查看 SOP 总表','浏览 SOP 与已保留的历史版本。'],'zh-TW':['查看 SOP 總表','瀏覽 SOP 與已保留的歷史版本。'],es:['Ver resumen de SOP','Explora SOP y versiones conservadas.'],ru:['Обзор SOP','SOP и сохранённые версии.'],ko:['SOP 전체 보기','SOP와 보관된 버전을 확인하세요.'],ja:['SOP 一覧を見る','SOP と保存された版を確認できます。']}[code]||['View SOP overview','Browse SOPs and retained versions.'];
    if($('open-folder-library'))$('open-folder-library').textContent=labels[0];if($('folder-library-help'))$('folder-library-help').textContent=labels[1];
  }
  function renderLanguage(language){$('language-auto').title=tr('跟随浏览器语言');for(const code of ['auto','zh','zh-TW','en','es','ru','ko','ja'])$('language-'+code).setAttribute('aria-pressed',String(language===code));const resolved=root.WorkspaceI18n.resolveLanguage(language);document.documentElement.lang=resolved==='zh'?'zh-CN':resolved;renderLibraryEntry();document.dispatchEvent(new Event('workspace-language-change'));}
  function send(type,settings){return new Promise((resolve,reject)=>chrome.runtime.sendMessage({type,...(settings?{settings}:{})},response=>{const error=chrome.runtime.lastError;if(error)return reject(Error(error.message));if(response?.error)return reject(Error(response.error));resolve(response); }));}
  async function refreshCatalog(){
    try{
      const result=await root.CatalogSync.info(),endpoint=result.settings?.endpoint||'',info=await root.SOPStorageSource.info();
      catalogView=result;sourceInfo=info;
      const selected=root.SOPStorageSource.isEndpoint(endpoint)&&info.selected&&info.endpoint===endpoint;
      const view=root.ConnectionView.state({settings:result.settings,status:result.status,sourceInfo:info,checking:selectingSource});
      $('source-connection').dataset.state=view;
      $('source-name').textContent=selected?(info.displayName||info.name||tr('SOP 文件夹')):tr('尚未选择文件夹');
      $('source-end-icon').innerHTML=root.SOPIcons.svg(selected?info.icon:'folder');
      $('source-appearance').hidden=!selected;
      if($('folder-library-entry'))$('folder-library-entry').hidden=false;
      renderLibraryEntry();
      $('source-count').hidden=!selected;
      if(selected){
        const count=result.status?.workflowCount;
        $('source-count').textContent=tr(root.ConnectionView.labels[view][0])+(Number.isInteger(count)?' · '+tr('{count} 份 SOP').replace('{count}',String(count)):'');
        if(appearanceEndpoint!==endpoint||!appearanceDirty){appearanceEndpoint=endpoint;appearanceDirty=false;$('source-display-name').value=info.displayName||info.name||'';appearanceIcon=info.icon||'folder';renderAppearance();}
      }else{appearanceEndpoint='';appearanceDirty=false;}
      return result;
    }catch(error){showError(error.message);return null;}
  }
  function showError(message){$('catalog-status').hidden=!message;show('catalog-status',message,'error');}
  function renderAppearance(){for(const button of document.querySelectorAll('[data-source-icon]'))button.setAttribute('aria-pressed',String(button.dataset.sourceIcon===appearanceIcon));}
  async function chooseLibrary(){
    if(selectingSource)return;
    const picking=root.SOPStorageSource.chooseDirectory();
    selectingSource=true;$('choose-sop-folder').disabled=true;showError('');
    try{
      const selected=await picking;
      // Preserve a previously enabled schedule; choosing a new library alone
      // performs one check and does not opt the user into background polling.
      const previous=(await root.CatalogSync.info()).settings;
      await send('catalog-configure',{endpoint:selected.endpoint,enabled:previous?.enabled===true});
      const checked=await send('catalog-check');
      if(['offline','error','blocked'].includes(checked.status?.state))throw Error(checked.status.message||tr('暂时无法读取'));
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

    let sourceRefresh=Promise.resolve();
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local'||![root.CatalogSync.SETTINGS,root.CatalogSync.STATUS,root.SOPStorageSource.KEY].some(key=>key in changes))return;
      sourceRefresh=sourceRefresh.catch(()=>{}).then(()=>refreshCatalog());
    });
    await refreshCatalog();
  }
  const api={PREFERENCES,LOGIN_SETTINGS,DEFAULT_LOGIN,normalizePreferences,validateLoginUrl,normalizeLogin,init};
  root.WorkspaceOptions=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init,{once:true});
})(typeof globalThis!=='undefined'?globalThis:this);
