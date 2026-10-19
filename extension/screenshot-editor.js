(function(){
'use strict';
const $=id=>document.getElementById(id),M=window.ImageMarks,escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadImage(src){return new Promise((resolve,reject)=>{if(!/^data:image\/(jpeg|png);base64,/.test(src))return reject(Error('请使用 PNG 或 JPEG 图片。'));const img=new Image();img.onload=()=>{if(img.naturalWidth>20000||img.naturalHeight>20000||img.naturalWidth*img.naturalHeight>40000000)return reject(Error('图片尺寸过大，请先缩小后添加。'));resolve(img);};img.onerror=()=>reject(Error('图片无法读取，请重新选择截图。'));img.src=src;});}
async function importFile(file){if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>10*1024*1024)throw Error('请选择 10 MB 以内的 PNG 或 JPEG 截图。');const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('图片读取失败。'));r.readAsDataURL(file);});const img=await loadImage(src),scale=Math.min(1,1600/img.naturalWidth,1600/img.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);for(const q of [.8,.65,.5,.35,.2]){const data=canvas.toDataURL('image/jpeg',q);if(data.length<=200*1024)return data;}throw Error('压缩后仍超过单图 200 KB，请裁剪截图后重试。');}
async function capturePage(){
 if(!navigator.mediaDevices?.getDisplayMedia)throw Error('当前浏览器不支持选择页面截图，请使用“添加图片”。');
 let stream,video;
 try{
  // Invoke the chooser directly within the user's click, before any storage awaits.
  stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false,systemAudio:'exclude',surfaceSwitching:'exclude'});
  video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('截图画面读取超时，请重试。')),12000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(Error('无法读取截图画面。'));};video.play().catch(e=>{clearTimeout(timer);reject(e);});});
  if(!video.videoWidth||!video.videoHeight)throw Error('没有获取到截图画面，请重新选择网页。');
  const canvas=document.createElement('canvas'),scale=Math.min(1,1600/video.videoWidth,1600/video.videoHeight);canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  for(const q of [.8,.65,.5,.35,.2]){const image=canvas.toDataURL('image/jpeg',q);if(image.length<=200*1024)return image;}
  throw Error('截图压缩后仍过大，请使用“添加图片”导入裁剪后的截图。');
 }catch(e){if(e.name==='NotAllowedError'||e.name==='AbortError')throw Error('未选择截图页面或未获授权，原图片已保留。请点击“截图”并在窗口中选择网页，再点击“分享”。');throw e;}
 finally{stream?.getTracks().forEach(t=>t.stop());if(video){video.pause();video.srcObject=null;}}
}
async function renderFigure(container,step){
 const ticket=Symbol();container._pictureTicket=ticket;container.replaceChildren();if(!step.image)return;const img=await loadImage(step.image);if(container._pictureTicket!==ticket)return;
 const frame=document.createElement('div');frame.className='marked-image';img.alt='SOP 步骤截图，包含操作者添加的位置与顺序标记';img.draggable=false;
 const overlay=document.createElement('div');overlay.className='image-marks-overlay';overlay.innerHTML=M.renderSvg(step.imageMarks,img.naturalWidth,img.naturalHeight);frame.append(img,overlay);container.append(frame);
}
async function figureHTML(step){if(!step.image)return '<p><small>本步尚未添加截图。</small></p>';const img=await loadImage(step.image);return '<figure><div style="position:relative;line-height:0"><img style="width:100%;display:block" src="'+escape(step.image)+'" alt="SOP步骤截图"><div style="position:absolute;inset:0;pointer-events:none">'+M.renderSvg(step.imageMarks,img.naturalWidth,img.naturalHeight).replace('<svg ','<svg style="display:block;width:100%;height:100%" ')+'</div></div><figcaption>附图时间：'+escape(step.imageAt)+'；编号表示本图中的操作顺序。</figcaption></figure>';}
let opening=false,resolveOpen=null,marks=[],source=null,mode='number',drag=null;
function requestAccess(context){
 try{
  const url=new URL(context?.url||''),api=globalThis.chrome;
  if(['http:','https:'].includes(url.protocol))return api.permissions.request({origins:[url.protocol+'//'+url.hostname+'/*']}).then(Boolean,()=>false);
  if(url.protocol==='file:')return new Promise(resolve=>{const fn=api.extension?.isAllowedFileSchemeAccess;if(typeof fn!=='function')return resolve(false);let done=false;const finish=value=>{if(done)return;done=true;resolve(Boolean(value));};try{const result=fn.call(api.extension,finish);if(typeof result==='boolean')finish(result);else if(result?.then)result.then(finish,()=>finish(false));}catch(_){finish(false);}setTimeout(()=>finish(false),2000);});
 }catch(_){}
 return Promise.resolve(false);
}
function announceFallback(action){const english=window.WorkspaceI18n?.getLanguage?.()==='en',message=english?'This page cannot show the overlay. Opened the screenshot in the side panel.':(window.WorkspaceI18n?.t('当前页面不允许覆盖显示，已在侧栏打开。')||'当前页面不允许覆盖显示，已在侧栏打开。');const target=action==='edit'?$('editor-status'):$('view-status');if(target)target.textContent=message;const hint=$('marks-hint');if(action==='edit'&&hint)hint.textContent=message;}
let activePageSession=null,currentView=null;
function cancelledView(){const error=new Error('Screenshot view cancelled');error.name='AbortError';return error;}
async function checkView(state){if(!state)return;if(state.cancelled||currentView!==state||state.signal?.aborted)throw cancelledView();if(state.verify&&await state.verify()===false)throw cancelledView();if(state.cancelled||currentView!==state||state.signal?.aborted)throw cancelledView();}
function releaseView(state){state.signal?.removeEventListener('abort',state.abort);state.dialog?.removeEventListener('close',state.onDialogClose);if(currentView===state)currentView=null;}
async function cancelView(state){if(!state)return;state.cancelled=true;releaseView(state);if(state.dialog){const dialog=state.dialog;state.dialog=null;dialog.close();$('large-picture')?.replaceChildren();}if(state.close)await state.close();}
async function closeView(){await cancelView(currentView);}

async function openOnPage(step,title,action,context,accessPromise,state){
 const api=globalThis.chrome;
 if(!context||!Number.isInteger(context.tabId)||!context.url||!api?.scripting?.executeScript||!api?.storage?.session)return null;
 const access=accessPromise===undefined?requestAccess(context):accessPromise;const allowed=await access;await checkView(state);if(!allowed)return null;
 let tab;try{tab=await api.tabs.get(context.tabId);}catch(_){await checkView(state);return null;}await checkView(state);
 if(!tab?.active||!tab.url)return null;
 const requested=new URL(context.url),actual=new URL(tab.url);
 if(requested.protocol==='file:'?actual.href!==requested.href:actual.origin!==requested.origin)return null;
 if(activePageSession)await activePageSession();
 await checkView(state);
 const token=crypto.randomUUID(),key='sop-screenshot-'+token;
 return await new Promise(resolve=>{
  let ready=false,finished=false,resolved=false,readyTimer,expiryTimer,poll;
  const respond=value=>{if(!resolved){resolved=true;resolve(value);}};
  const close=async(result=null)=>{
   if(finished)return;finished=true;clearTimeout(readyTimer);clearTimeout(expiryTimer);clearInterval(poll);api.storage.onChanged.removeListener(onChange);
   if(activePageSession===close)activePageSession=null;
   if(state&&state.close===close){state.close=null;if(ready||state.cancelled)releaseView(state);}
   await api.storage.session.remove(key).catch(()=>{});
   await api.scripting.executeScript({target:{tabId:context.tabId},func:t=>window.SOPImageOverlay?.dispose(t),args:[token]}).catch(()=>{});
   respond(state?.cancelled?{handled:true,result:null}:ready?{handled:true,result}:null);
  };
  const onChange=(changes,area)=>{if(area!=='session'||!changes[key]?.newValue)return;const value=changes[key].newValue;
   if(value.ready===true&&!ready){ready=true;clearTimeout(readyTimer);if(action==='view')respond({handled:true,result:{opened:true}});}
   if(Object.hasOwn(value,'result')){let result=null;try{result=value.result===null?null:M.validate(value.result);}catch(_){}close(result);}
   if(value.error)close(null);
  };
  api.storage.onChanged.addListener(onChange);activePageSession=close;if(state)state.close=close;
  readyTimer=setTimeout(()=>close(null),4000);expiryTimer=setTimeout(()=>close(null),20*60*1000);
  (async()=>{try{
   await checkView(state);if(finished)return;
   await api.storage.session.set({[key]:{step:{image:step.image,imageMarks:M.validate(step.imageMarks),imageAt:step.imageAt||'',title:String(title||step.title||'截图').slice(0,160)},mode:action,tabId:context.tabId,expiresAt:Date.now()+20*60*1000}});
   if(finished){await api.storage.session.remove(key).catch(()=>{});return;}
   await api.scripting.executeScript({target:{tabId:context.tabId},files:['screenshot-overlay.js']});
   await checkView(state);if(finished)return;
   const url=api.runtime.getURL('screenshot-viewer.html')+'?token='+token+'&mode='+action;
   const mounted=await api.scripting.executeScript({target:{tabId:context.tabId},func:(u,t)=>window.SOPImageOverlay.mount(u,t),args:[url,token]});
   if(finished){await api.scripting.executeScript({target:{tabId:context.tabId},func:t=>window.SOPImageOverlay?.dispose(t),args:[token]}).catch(()=>{});return;}
   if(!mounted?.[0]?.result){await close(null);return;}
   poll=setInterval(async()=>{try{const status=await api.scripting.executeScript({target:{tabId:context.tabId},func:t=>window.SOPImageOverlay?.alive(t),args:[token]});if(!status?.[0]?.result)await close(null);}catch(_){await close(null);}},750);
  }catch(error){if(state&&(error.name==='AbortError'||currentView!==state)){state.cancelled=true;releaseView(state);}await close(null);}})();
 });
}

function draw(preview){$('marks-overlay').innerHTML=M.renderSvg(preview||marks,source.naturalWidth,source.naturalHeight);$('marks-count').textContent=marks.length+' / 40 个标记 · 下一个编号 '+(marks.filter(m=>m.type==='number').length+1);$('marks-undo').disabled=!marks.length;$('marks-clear').disabled=!marks.length;}
function choose(next){mode=next;for(const type of ['number','arrow','rect'])$('marks-'+type).setAttribute('aria-pressed',String(next===type));$('marks-hint').textContent=next==='number'?'在图片上点击，依次添加 1、2、3…':next==='arrow'?'按住起点，拖到需要指向的位置。':'按住一个角，拖动框住需要关注的区域。';}
function pos(e){const r=$('marks-surface').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
function finish(value){if(!resolveOpen)return;const done=resolveOpen;resolveOpen=null;drag=null;$('marks-dialog').close();done(value);}
function install(){if(!$('marks-dialog')||install.done)return;install.done=true;
 for(const type of ['number','arrow','rect'])$('marks-'+type).onclick=()=>choose(type);
 $('marks-surface').onpointerdown=e=>{if(e.button!==0||marks.length>=40)return;e.preventDefault();const p=pos(e);if(mode==='number'){marks.push({type:'number',...p});draw();return;}drag={...p,type:mode,pointer:e.pointerId};$('marks-surface').setPointerCapture(e.pointerId);};
 $('marks-surface').onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;const p=pos(e);draw([...marks,{type:drag.type,x:drag.x,y:drag.y,x2:p.x,y2:p.y}]);};
 $('marks-surface').onpointerup=e=>{if(!drag||drag.pointer!==e.pointerId)return;const p=pos(e);if(Math.hypot(p.x-drag.x,p.y-drag.y)>.005)marks.push({type:drag.type,x:drag.x,y:drag.y,x2:p.x,y2:p.y});drag=null;draw();};
 $('marks-surface').onpointercancel=()=>{drag=null;draw();};
 $('marks-undo').onclick=()=>{marks.pop();draw();};$('marks-clear').onclick=()=>{marks=[];draw();};
 $('marks-save').onclick=()=>finish(M.validate(marks));$('marks-cancel').onclick=()=>finish(null);$('marks-dialog').oncancel=e=>{e.preventDefault();finish(null);};
}
async function openFallback(step,title){install();opening=true;try{source=await loadImage(step.image);marks=M.validate(step.imageMarks);$('marks-img').src=step.image;if($('marks-title'))$('marks-title').textContent=title||'标记图片';choose('number');draw();announceFallback('edit');$('marks-dialog').showModal();return await new Promise(resolve=>{resolveOpen=resolve;});}finally{opening=false;}}
async function openFallbackView(step,title,state){const dialog=$('image-dialog'),picture=$('large-picture');if(!dialog||!picture)throw Error('当前页面不支持显示截图。');const staging=document.createElement('div');await renderFigure(staging,step);await checkView(state);$('image-title').textContent=title||'截图查看';picture.replaceChildren(...staging.childNodes);if(state){state.dialog=dialog;state.onDialogClose=()=>{if(dialog.open)return;state.dialog=null;if(state.signal||state.verify)picture.replaceChildren();releaseView(state);};dialog.addEventListener('close',state.onDialogClose);}dialog.showModal();return {opened:true,fallback:true};}
async function open(step,title,context,accessPromise){if(opening||resolveOpen)throw Error('请先完成当前图片的标记。');opening=true;try{if(globalThis.chrome?.scripting&&context){const access=accessPromise===undefined?requestAccess(context):accessPromise;const result=await openOnPage(step,title,'edit',context,access);if(result?.handled)return result.result;}return await openFallback(step,title);}finally{opening=false;}}
async function view(step,title,context,accessPromise,guard={}){
 // Keep native access requests inside the initiating user gesture.
 const access=globalThis.chrome?.scripting&&context?(accessPromise===undefined?requestAccess(context):accessPromise):accessPromise;
 const previous=currentView,state={signal:guard.signal,verify:guard.verify,cancelled:false};currentView=state;
 state.abort=()=>{cancelView(state).catch(()=>{});};state.signal?.addEventListener('abort',state.abort,{once:true});
 try{await cancelView(previous);await checkView(state);if(globalThis.chrome?.scripting&&context){const result=await openOnPage(step,title,'view',context,access,state);await checkView(state);if(result?.handled)return result.result;}await checkView(state);announceFallback('view');return await openFallbackView(step,title,state);}
 catch(error){await cancelView(state);if(error.name==='AbortError')return null;throw error;}
}
window.ScreenshotEditor= {capturePage,open,view,closeView,requestAccess,renderFigure,figureHTML,importFile};
})();
