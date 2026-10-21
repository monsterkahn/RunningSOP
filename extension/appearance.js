(function(root){
 'use strict';
 const KEY='runtime-sop-appearance-v1',doc=root.document,media=root.matchMedia('(prefers-color-scheme: dark)');
 const valid=value=>value==='light'||value==='dark'?value:null;
 function read(){try{return valid(root.localStorage.getItem(KEY));}catch(_){return null;}}
 let preference=read();
 function apply(){
  const theme=preference||(media.matches?'dark':'light'),html=doc.documentElement;
  html.dataset.theme=theme;html.style.colorScheme=theme;
  const meta=doc.querySelector('meta[name="color-scheme"]');if(meta)meta.content=preference||'light dark';
  for(const button of doc.querySelectorAll('[data-theme-choice]'))button.setAttribute('aria-pressed',String(button.dataset.themeChoice===(preference||'system')));
 }
 function choose(value){
  if(!['system','light','dark'].includes(value))return;
  preference=valid(value);
  try{if(preference)root.localStorage.setItem(KEY,preference);else root.localStorage.removeItem(KEY);}catch(_){}
  apply();
 }
 apply();
 doc.addEventListener('DOMContentLoaded',()=>{
  for(const button of doc.querySelectorAll('[data-theme-choice]'))button.addEventListener('click',()=>choose(button.dataset.themeChoice));
  apply();
 },{once:true});
 media.addEventListener('change',()=>{if(!preference)apply();});
 root.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){preference=read();apply();}});
})(globalThis);
