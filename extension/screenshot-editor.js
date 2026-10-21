(function(){
'use strict';
const $=id=>document.getElementById(id),M=window.ImageMarks,E=window.ScreenshotRedaction,escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

function pictureResult(image,result){
 if(Array.isArray(result))return {image,imageMarks:M.validate(result)};
 if(!result||typeof result!=='object'||Object.keys(result).sort().join(',')!=='image,imageMarks'||typeof result.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(result.image)||result.image.length>200*1024)throw Error('Invalid screenshot edit result');
 return {image:result.image,imageMarks:M.validate(result.imageMarks)};
}
const mosaicWords={zh:['马赛克','拖动框选要遮挡的区域。保存后遮挡写入图片，无法撤销；已发布的历史版本不受影响。','截图遮挡保存失败，请重试。'],'zh-TW':['馬賽克','拖曳框選要遮擋的區域。儲存後遮擋寫入圖片，無法復原；已發佈的歷史版本不受影響。','截圖遮擋儲存失敗，請重試。'],en:['Mosaic','Drag over the area to hide. Saving permanently applies the mask to this image; previously published versions are unchanged.','Could not save the redacted screenshot. Try again.'],es:['Mosaico','Arrastra sobre el área que deseas ocultar. Guardar aplica la máscara permanentemente; las versiones anteriores no cambian.','No se pudo guardar la imagen ocultada. Reintenta.'],ru:['Мозаика','Выделите область. Сохранение необратимо скрывает её на этом изображении; прежние публикации не меняются.','Не удалось сохранить скрытую область. Повторите.'],ko:['모자이크','숨길 영역을 드래그하세요. 저장하면 이미지에 영구 적용되며 이전 게시 버전은 바뀌지 않습니다.','가린 스크린샷을 저장하지 못했습니다. 재시도하세요.'],ja:['モザイク','隠す範囲をドラッグします。保存すると画像に永久適用され、公開済みの旧版は変わりません。','加工した画像を保存できませんでした。再試行してください。']};
function mosaicText(index){return (mosaicWords[window.WorkspaceI18n?.getLanguage?.()||'zh']||mosaicWords.en)[index];}
let opening=false,saving=false,resolveOpen=null,marks=[],source=null,mode='number',drag=null,selected=-1,undo=[];
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
   if(Object.hasOwn(value,'result')){let result=null;try{result=value.result===null?null:Array.isArray(value.result)?M.validate(value.result):pictureResult(step.image,value.result);}catch(_){}close(result);}
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

const moveHints={en:'Select a number, box or mosaic. Drag, or use arrow keys (Shift: 10 px).',zh:'选择编号、方框或马赛克后拖动，方向键微调，Shift 加方向键移动 10 像素。','zh-TW':'選擇編號、方框或馬賽克後拖動，方向鍵微調，Shift 加方向鍵移動 10 像素。',es:'Selecciona un número, recuadro o mosaico. Arrastra o usa las flechas (Mayús: 10 px).',ru:'Выберите номер, рамку или мозаику. Перетаскивайте или используйте стрелки (Shift: 10 пикселей).',ko:'번호, 상자 또는 모자이크를 선택하고 드래그하거나 방향키로 이동하세요 (Shift: 10px).',ja:'番号、枠、モザイクを選択し、ドラッグまたは矢印キーで移動します（Shift: 10px）。'};
function snapshot(){undo.push(E.validate(marks));if(undo.length>80)undo.shift();}
function draw(preview){$('marks-overlay').innerHTML=E.renderSvg(preview||marks,source.naturalWidth,source.naturalHeight,selected);$('marks-count').textContent=marks.length+' / 40';$('marks-undo').disabled=!undo.length;$('marks-clear').disabled=!marks.length;}
function choose(next){if(saving)return;mode=next;selected=-1;const labels={move:'移动',number:'编号',arrow:'箭头',rect:'方框',mosaic:mosaicText(0)};for(const type of ['move','number','arrow','rect','mosaic']){const el=$('marks-'+type);if(!el)continue;el.classList.add('marks-tool');el.removeAttribute('data-i18n');el.innerHTML=M.toolIcon(type);const label=window.WorkspaceI18n?.t(labels[type])||labels[type];el.title=label;el.setAttribute('aria-label',label);el.setAttribute('aria-pressed',String(next===type));}$('marks-hint').textContent=next==='mosaic'?mosaicText(1):next==='move'?(moveHints[window.WorkspaceI18n?.getLanguage?.()||'zh']||moveHints.en):'';for(const [id,type,label]of [['marks-undo','undo','撤销'],['marks-clear','clear','清空']]){const el=$(id);el.removeAttribute('data-i18n');el.innerHTML=M.toolIcon(type);el.classList.add('marks-tool');el.title=window.WorkspaceI18n?.t(label)||label;el.setAttribute('aria-label',el.title);}const language=window.WorkspaceI18n?.getLanguage?.()||'zh',actions={zh:['保存笔记','退出'],'zh-TW':['儲存筆記','退出'],en:['Save notes','Exit'],es:['Guardar notas','Salir'],ru:['Сохранить заметки','Выйти'],ko:['메모 저장','나가기'],ja:['メモを保存','終了']}[language]||['Save notes','Exit'];$('marks-save').textContent=actions[0];$('marks-exit').textContent=actions[1];if(source)draw();}
function pos(e){const r=$('marks-surface').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
function finish(value){if(!resolveOpen)return;const done=resolveOpen;resolveOpen=null;drag=null;$('marks-dialog').close();$('marks-img').removeAttribute('src');$('marks-overlay').replaceChildren();source=null;marks=[];undo=[];done(value);}
function install(){if(!$('marks-dialog')||install.done)return;install.done=true;
 for(const type of ['move','number','arrow','rect','mosaic'])if($('marks-'+type))$('marks-'+type).onclick=()=>choose(type);
 const surface=$('marks-surface');surface.tabIndex=0;surface.setAttribute('aria-label',moveHints[window.WorkspaceI18n?.getLanguage?.()||'zh']||moveHints.en);
 function stop(cancel){if(drag?.moving&&cancel)marks[drag.index]=drag.original;else if(drag?.moving&&JSON.stringify(marks[drag.index])!==JSON.stringify(drag.original)){undo.push(drag.before);if(undo.length>80)undo.shift();}drag=null;draw();}
 surface.onpointerdown=e=>{if(saving||e.button!==0)return;e.preventDefault();surface.focus({preventScroll:true});const p=pos(e);if(mode==='move'){selected=E.hitTest(marks,p,source.naturalWidth,source.naturalHeight);if(selected>=0)drag={moving:true,index:selected,original:{...marks[selected]},before:E.validate(marks),...p,pointer:e.pointerId};draw();}else if(marks.length<40){if(mode==='number'){snapshot();marks.push({type:'number',...p});draw();}else drag={...p,type:mode,pointer:e.pointerId};}if(drag)surface.setPointerCapture(e.pointerId);};
 surface.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;const p=pos(e);if(drag.moving){marks[drag.index]=E.translate(drag.original,p.x-drag.x,p.y-drag.y,source.naturalWidth,source.naturalHeight);draw();}else draw([...marks,{type:drag.type,x:drag.x,y:drag.y,x2:p.x,y2:p.y}]);};
 surface.onpointerup=e=>{if(!drag||drag.pointer!==e.pointerId)return;const p=pos(e);if(drag.moving)marks[drag.index]=E.translate(drag.original,p.x-drag.x,p.y-drag.y,source.naturalWidth,source.naturalHeight);else if(Math.hypot(p.x-drag.x,p.y-drag.y)>.005){snapshot();marks.push({type:drag.type,x:drag.x,y:drag.y,x2:p.x,y2:p.y});}stop(false);};
 surface.onpointercancel=()=>stop(true);surface.onlostpointercapture=()=>{if(drag)stop(true);};
 surface.onkeydown=e=>{if(saving||mode!=='move'||selected<0||drag||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();snapshot();const amount=e.shiftKey?10:1;marks[selected]=E.translate(marks[selected],(e.key==='ArrowRight'?amount:e.key==='ArrowLeft'?-amount:0)/source.naturalWidth,(e.key==='ArrowDown'?amount:e.key==='ArrowUp'?-amount:0)/source.naturalHeight,source.naturalWidth,source.naturalHeight);draw();};
 $('marks-undo').onclick=()=>{if(saving||drag)return;const previous=undo.pop();if(previous)marks=previous;selected=-1;draw();};$('marks-clear').onclick=()=>{if(saving||drag)return;snapshot();marks=[];selected=-1;draw();};
 $('marks-save').onclick=async()=>{if(saving)return;if(drag)stop(true);saving=true;const controls=[...document.querySelectorAll('#marks-dialog button')];controls.forEach(b=>b.disabled=true);try{finish(await E.save(source,marks));}catch(_){$('marks-hint').textContent=mosaicText(2);}finally{saving=false;controls.forEach(b=>b.disabled=false);if(source)draw();}};$('marks-exit').onclick=()=>{if(!saving)finish(null);};$('marks-dialog').oncancel=e=>{e.preventDefault();if(!saving)finish(null);};
}
async function openFallback(step,title){install();opening=true;try{source=await loadImage(step.image);marks=E.validate(step.imageMarks);undo=[];selected=-1;$('marks-img').src=step.image;if($('marks-title'))$('marks-title').textContent=title||'标记图片';choose('number');draw();announceFallback('edit');$('marks-dialog').showModal();return await new Promise(resolve=>{resolveOpen=resolve;});}finally{opening=false;}}
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
window.ScreenshotEditor= {capturePage,open,pictureResult,view,closeView,requestAccess,renderFigure,figureHTML,importFile};
})();
