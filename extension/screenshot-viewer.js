'use strict';
(() => {
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),token=params.get('token'),mode=params.get('mode');
 const key=`sop-screenshot-${token||''}`,M=window.ImageMarks;let marks=[],tool='number',drag=null,spaceDown=false,scale=1,tx=0,ty=0,fitScale=1,ready=false,sessionAuthorized=false;
 let language='zh';
 const words={'截图查看':'Screenshot viewer','适应窗口':'Fit to window','原始尺寸':'Actual size','缩小':'Zoom out','放大':'Zoom in','移动':'Move','编号':'Number','箭头':'Arrow','方框':'Rectangle','撤销':'Undo','清除':'Clear','取消':'Cancel','保存标记':'Save marks','截图会话已过期或格式无效，请回到步骤重新打开。':'This screenshot session has expired or is invalid. Reopen it from the step.','截图无法读取。':'Could not load the screenshot.','图片尺寸过大，请先缩小后添加。':'The image is too large. Resize it before adding it.','截图查看链接无效。':'The screenshot link is invalid.','标记数据无效：':'Invalid marker data: '};
 const t=text=>window.WorkspaceI18n?.t(text)||(language==='en'?(words[text]||text):text);
 const status=text=>{$('status').textContent=t(text||'');};
 async function applyLanguage(){try{const key='runtime-sop-workspace-preferences-v1',prefs=(await chrome.storage.local?.get?.(key))?.[key];language=window.WorkspaceI18n?.setLanguage(prefs?.language||'auto')||'en';}catch(_){language='zh';}for(const [id,zh] of [['fit','适应窗口'],['actual','原始尺寸'],['zoom-out','缩小'],['zoom-in','放大'],['marks-move','移动'],['marks-number','编号'],['marks-arrow','箭头'],['marks-rect','方框'],['undo','撤销'],['clear','清除'],['cancel','取消'],['save','保存标记'],['close-viewer','关闭']]){const el=$(id);if(el){if(id==='zoom-out')el.setAttribute('aria-label',t(zh));else if(id==='zoom-in')el.setAttribute('aria-label',t(zh));else el.textContent=t(zh);}}if(language==='en'&&$('page-title').textContent==='截图查看')$('page-title').textContent=t('截图查看');}
 function resize(){if(!ready)return;const pad=30;fitScale=Math.min(($('viewport').clientWidth-pad*2)/$('picture').naturalWidth,($('viewport').clientHeight-pad*2)/$('picture').naturalHeight,1);setZoom(mode==='edit'?fitScale:fitScale);}
 function setZoom(value){scale=Math.max(.08,Math.min(8,value));apply();}
 function apply(){const w=$('picture').naturalWidth*scale,h=$('picture').naturalHeight*scale;$('stage').style.width=w+'px';$('stage').style.height=h+'px';$('picture').style.width=w+'px';$('picture').style.height=h+'px';$('stage').style.transform=`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(1)`;$('zoom-value').textContent=Math.round(scale*100)+'%';}
 function fit(){tx=ty=0;setZoom(fitScale);}
 function svg(){try{$('overlay').innerHTML=M.renderSvg(M.validate(marks),$('picture').naturalWidth,$('picture').naturalHeight);}catch(e){status('标记数据无效：'+e.message);}}
 function updateCount(){const next=marks.filter(m=>m.type==='number').length+1;$('marks-count').textContent=`${marks.length} / 40 · ${t('下一个编号')} ${next}`;$('undo').disabled=!marks.length;$('clear').disabled=!marks.length;}
 function choose(next){tool=next;for(const t of ['move','number','arrow','rect'])$('marks-'+t).setAttribute('aria-pressed',String(t===next));$('viewport').classList.toggle('moving',next==='move'||mode==='view');}
 function pos(event){const r=$('picture').getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))};}
 async function readSession(){
  if(!token||!/^[-a-zA-Z0-9]{8,100}$/.test(token)||!['view','edit'].includes(mode))throw Error('截图查看链接无效。');
  const value=(await chrome.storage.session.get(key))[key],tab=await chrome.tabs.getCurrent();
  if(!value?.step||value.mode!==mode||!Number.isInteger(value.tabId)||tab?.id!==value.tabId||!Number.isFinite(value.expiresAt)||value.expiresAt<Date.now())throw Error('截图会话已过期或格式无效，请回到步骤重新打开。');
  if(typeof value.step.image!=='string'||!/^data:image\/(jpeg|png);base64,/.test(value.step.image))throw Error('截图会话已过期或格式无效，请回到步骤重新打开。');sessionAuthorized=true;return value.step;
 }
 async function sendResult(result){if(!sessionAuthorized)return;await chrome.storage.session.set({[key]:{result}});}
 async function init(){try{await applyLanguage();const step=await readSession();marks=M.validate(step.imageMarks);$('page-title').textContent=step.title||t('截图查看');$('image-meta').textContent=step.imageAt?t('截图时间：')+step.imageAt:'';document.title=step.title||t('截图查看');if(mode==='edit')$('edit-tools').hidden=false;await new Promise((resolve,reject)=>{$('picture').onload=resolve;$('picture').onerror=()=>reject(Error('截图无法读取。'));$('picture').src=step.image;});const iw=$('picture').naturalWidth,ih=$('picture').naturalHeight;if(iw>20000||ih>20000||iw*ih>40000000)throw Error('图片尺寸过大，请先缩小后添加。');ready=true;svg();updateCount();resize();await chrome.storage.session.set({[key]:{ready:true}});
  if(mode==='edit'){
   for(const t of ['move','number','arrow','rect'])$('marks-'+t).onclick=()=>choose(t);
   $('undo').onclick=()=>{marks.pop();svg();updateCount();};$('clear').onclick=()=>{marks=[];svg();updateCount();};
   $('save').onclick=async()=>{try{await sendResult(M.validate(marks));}catch(e){status(e.message);}};
   $('cancel').onclick=async()=>{try{await sendResult(null);}catch(e){status(e.message);}};
   choose('number');
  }
  $('viewport').classList.toggle('moving',mode==='view');
 }catch(e){if(sessionAuthorized)await chrome.storage.session.set({[key]:{error:true}}).catch(()=>{});status(e.message);}}
 $('close-viewer').onclick=()=>sendResult(null);
 window.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();sendResult(null);}});
 $('fit').onclick=fit;$('actual').onclick=()=>{tx=ty=0;setZoom(1);};$('zoom-in').onclick=()=>setZoom(scale*1.2);$('zoom-out').onclick=()=>setZoom(scale/1.2);$('viewport').addEventListener('wheel',e=>{e.preventDefault();setZoom(scale*(e.deltaY<0?1.12:1/1.12));},{passive:false});
 $('viewport').onpointerdown=e=>{
  const pan=e.button===1||(e.button===0&&(mode==='view'||spaceDown||tool==='move'));
  if(pan){e.preventDefault();drag={pan:true,x:e.clientX,y:e.clientY,tx,ty,pointer:e.pointerId};$('viewport').classList.add('dragging');$('viewport').setPointerCapture(e.pointerId);return;}
  if(mode!=='edit'||e.button!==0)return;const r=$('picture').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
  if(tool==='number'){if(marks.length>=40)return;marks.push({type:'number',...pos(e)});svg();updateCount();return;}
  e.preventDefault();drag={...pos(e),type:tool,pointer:e.pointerId};$('viewport').setPointerCapture(e.pointerId);
 };
 $('viewport').onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;if(drag.pan){tx=drag.tx+e.clientX-drag.x;ty=drag.ty+e.clientY-drag.y;apply();return;}const p=pos(e),preview=[...marks,{type:drag.type,x:drag.x,y:drag.y,x2:p.x,y2:p.y}];$('overlay').innerHTML=M.renderSvg(preview,$('picture').naturalWidth,$('picture').naturalHeight);};
 $('viewport').onpointerup=e=>{if(!drag||drag.pointer!==e.pointerId)return;if(!drag.pan){const p=pos(e);if(Math.hypot(p.x-drag.x,p.y-drag.y)>.005&&marks.length<40)marks.push({type:drag.type,x:drag.x,y:drag.y,x2:p.x,y2:p.y});svg();updateCount();}drag=null;$('viewport').classList.remove('dragging');};
 $('viewport').onpointercancel=()=>{drag=null;$('viewport').classList.remove('dragging');svg();};
 window.addEventListener('keydown',e=>{if(e.code==='Space'&&mode==='edit'&&!['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName)){spaceDown=true;$('viewport').classList.add('moving');e.preventDefault();}});window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;$('viewport').classList.toggle('moving',mode==='view'||tool==='move');}});window.addEventListener('blur',()=>{spaceDown=false;$('viewport').classList.toggle('moving',mode==='view'||tool==='move');});window.addEventListener('resize',resize);
 init();
})();
