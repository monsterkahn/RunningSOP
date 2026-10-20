(function(root){
 'use strict';
 async function init(){
  const state={endpoint:'',catalog:null,categoryValid:false,offline:true,invalidated:false,refreshing:true};
  let generation=0,refreshTicket=0;
  const cancelled=()=>Error('The selected SOP folder changed. Reopen category settings.');
  async function assertActive(){
   const expected=state.endpoint,ticket=generation;
   if(state.invalidated||!expected)throw cancelled();
   const [settings,source]=await Promise.all([CatalogSync.getSettings(),SOPStorageSource.info()]);
   if(ticket!==generation||state.invalidated||settings.endpoint!==expected||!source.selected||source.endpoint!==expected)throw cancelled();
  }
  const controller=SOPLibraryCategories.create({language:root.WorkspaceI18n?.getLanguage()||'en',getContext:()=>state,assertActive,onSaved:()=>{state.categoryValid=true;}});
  async function refresh(){
   const ticket=++refreshTicket;
   try{
    // Cached metadata only: opening Settings never starts a directory check.
    const [settings,catalog,source]=await Promise.all([CatalogSync.getSettings(),CatalogSync.loadCatalog(),SOPStorageSource.info()]);
    if(ticket!==refreshTicket)return;
    const matched=SOPStorageSource.isEndpoint(settings.endpoint)&&source.selected&&source.endpoint===settings.endpoint;
    Object.assign(state,{endpoint:settings.endpoint,catalog:matched?catalog:null,categoryValid:Boolean(matched),offline:!matched||source.readPermission!=='granted',invalidated:false});
    document.getElementById('status').textContent='';document.getElementById('status').classList.remove('error');
   }catch(error){if(ticket!==refreshTicket)return;Object.assign(state,{catalog:null,categoryValid:false,offline:true,invalidated:false});document.getElementById('status').textContent=error.message;document.getElementById('status').classList.add('error');}
   finally{if(ticket===refreshTicket){state.refreshing=false;controller.update();}}
  }
  chrome.storage.onChanged.addListener((changes,area)=>{
   if(area!=='local')return;
   if(changes[CatalogSync.SETTINGS]||changes[SOPStorageSource.KEY]){
    generation++;state.invalidated=true;state.refreshing=true;controller.close();refresh();
   }else if(changes[CatalogSync.CACHE])refresh();
  });
  document.addEventListener('workspace-language-change',()=>controller.translate?.(root.WorkspaceI18n?.getLanguage()||'en'));
  window.addEventListener('pagehide',()=>{generation++;refreshTicket++;state.invalidated=true;controller.close();});
  await refresh();
 }
 document.addEventListener('DOMContentLoaded',init,{once:true});
})(globalThis);
