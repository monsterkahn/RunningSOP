/* Local passage feedback: no network submission and no page-content collection. */
(function(root){
'use strict';
const KEY='runtime-sop-step-feedback-v1',LIMIT=100,TYPES=['interface','unclear','missing','other'];
const words={
 en:['Feedback on this step','What needs attention?','Interface has changed','Unclear instructions','Missing step','Other','Note (optional)','Notes may contain sensitive information. Check before saving or sharing.','Save locally','Cancel','Saved on this browser only. Export and share it with the person responsible for this SOP.','Export feedback','The SOP or source changed. Close and reopen feedback.','Could not save feedback. Local storage may be full or unavailable.','Local feedback is full (100 records). Export existing feedback before removing it.'],
 zh:['反馈这一步','哪里需要改进？','操作界面已变化','说明不清楚','缺少步骤','其他','补充说明（选填）','说明可能包含敏感信息，保存或分享前请检查。','保存到本机','取消','仅保存在本机浏览器。请导出后交给此 SOP 的负责人。','导出反馈','SOP 或存储来源已变化，请关闭并重新打开反馈。','无法保存反馈，本机空间可能已满或不可用。','本机反馈已满（100 条），请先导出现有反馈，再清理。'],
 'zh-TW':['回饋這一步','哪裡需要改善？','操作介面已變化','說明不清楚','缺少步驟','其他','補充說明（選填）','說明可能包含敏感資訊，儲存或分享前請檢查。','儲存至本機','取消','僅儲存在本機瀏覽器。請匯出後交給此 SOP 的負責人。','匯出回饋','SOP 或儲存來源已變化，請關閉並重新開啟回饋。','無法儲存回饋，本機空間可能已滿或無法使用。','本機回饋已滿（100 筆），請先匯出現有回饋，再清理。'],
 es:['Comentarios sobre este paso','¿Qué debe mejorar?','La interfaz ha cambiado','Instrucciones poco claras','Falta un paso','Otro','Nota (opcional)','Las notas pueden contener información sensible. Revísalas antes de guardarlas o compartirlas.','Guardar localmente','Cancelar','Guardado solo en este navegador. Expórtalo y compártelo con la persona responsable del SOP.','Exportar comentarios','El SOP o el origen cambió. Cierra y vuelve a abrir el formulario.','No se pudo guardar. El almacenamiento local puede estar lleno o no disponible.','Almacenamiento lleno (100 registros). Exporta los comentarios antes de eliminarlos.'],
 ru:['Отзыв об этом шаге','Что нужно улучшить?','Интерфейс изменился','Непонятная инструкция','Пропущен шаг','Другое','Примечание (необязательно)','Заметки могут содержать конфиденциальные данные. Проверьте их перед сохранением или передачей.','Сохранить локально','Отмена','Сохранено только в этом браузере. Экспортируйте и передайте ответственному за SOP.','Экспорт отзывов','SOP или источник изменился. Закройте и снова откройте форму.','Не удалось сохранить. Локальное хранилище заполнено или недоступно.','Хранилище заполнено (100 записей). Экспортируйте отзывы перед удалением.'],
 ko:['이 단계 피드백','어떤 점을 개선해야 하나요?','화면이 변경됨','설명이 불명확함','단계가 누락됨','기타','추가 설명 (선택)','설명에 민감한 정보가 포함될 수 있습니다. 저장하거나 공유하기 전에 확인하세요.','로컬 저장','취소','이 브라우저에만 저장되었습니다. 내보낸 뒤 SOP 담당자에게 전달하세요.','피드백 내보내기','SOP 또는 저장소가 변경되었습니다. 닫고 다시 열어 주세요.','저장할 수 없습니다. 로컬 저장소가 가득 찼거나 사용할 수 없습니다.','피드백 100개가 저장되었습니다. 삭제 전에 기존 피드백을 내보내세요.'],
 ja:['この手順へのフィードバック','改善が必要な点は？','画面が変わった','説明がわかりにくい','手順が不足している','その他','補足（任意）','機密情報が含まれる場合があります。保存・共有前に確認してください。','ローカルに保存','キャンセル','このブラウザにのみ保存しました。エクスポートして SOP の担当者に共有してください。','フィードバックを書き出す','SOP または保存先が変わりました。閉じて再度開いてください。','保存できません。ローカル保存領域が不足しているか使用できません。','フィードバックが100件に達しました。削除前に書き出してください。']};
const localScope={en:'Feedback stays in this browser. It is not sent to a team service. Export it to share with the SOP owner.',zh:'反馈仅保存在本机，不会发送到团队服务。请导出后交给 SOP 负责人。','zh-TW':'回饋僅儲存在本機，不會傳送至團隊服務。請匯出後交給 SOP 負責人。',es:'Los comentarios permanecen en este navegador. No se envían al servicio de equipo. Expórtalos para compartirlos con el responsable del SOP.',ru:'Отзывы остаются в этом браузере и не отправляются в командный сервис. Экспортируйте их для передачи ответственному за SOP.',ko:'피드백은 이 브라우저에만 저장되며 팀 서비스에 전송되지 않습니다. 내보낸 뒤 SOP 담당자에게 전달하세요.',ja:'フィードバックはこのブラウザにのみ保存され、チームサービスへ送信されません。書き出して SOP 担当者に共有してください。'};
function bounded(value,max){return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value);}
function identity(input){
 if(!input||!['folder','team'].includes(input.source)||!bounded(input.sourceId,2048)||!bounded(input.workflowId,160)||!bounded(input.stepId,160)||!bounded(input.revision,160)||!['actions','expected','point','issue'].includes(input.section)||(input.source==='folder'&&!/^[a-f0-9]{64}$/i.test(input.revision))||(input.section==='issue'&&!bounded(input.issueId,160)))throw Error('Invalid feedback identity');
 const result={source:input.source,sourceId:input.sourceId,workflowId:input.workflowId,revision:input.revision,stepId:input.stepId,section:input.section};if(input.section==='issue')result.issueId=input.issueId;return Object.freeze(result);
}
async function fingerprint(value){const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function validRecord(value){return value&&value.format==='runtime-sop-step-feedback'&&value.schemaVersion===1&&bounded(value.id,80)&&bounded(value.createdAt,40)&&Number.isFinite(Date.parse(value.createdAt))&&['folder','team'].includes(value.source)&&/^[a-f0-9]{64}$/.test(value.sourceFingerprint)&&bounded(value.workflowId,160)&&bounded(value.revision,160)&&bounded(value.stepId,160)&&['actions','expected','point','issue'].includes(value.section)&&(value.section!=='issue'||bounded(value.issueId,160))&&TYPES.includes(value.type)&&typeof value.note==='string'&&value.note.length<=2000;}
function readRecords(value){if(value===undefined)return[];if(!value||value.format!=='runtime-sop-step-feedback-list'||value.schemaVersion!==1||!Array.isArray(value.records)||value.records.length>LIMIT||!value.records.every(validRecord))throw Error('Invalid feedback store');return value.records;}
async function save({captured,type,note,verify,alive,storage,lock}){
 const target=identity(captured);if(!TYPES.includes(type)||typeof note!=='string'||note.length>2000)throw Error('Invalid feedback');
 const sourceFingerprint=await fingerprint(target.sourceId);
 return lock(async()=>{
  const data=await storage.get(KEY),records=readRecords(data[KEY]);
  if(!alive()||!await verify(target)||!alive())throw Error('STALE');
  if(records.length>=LIMIT)throw Error('FULL');
  const record={format:'runtime-sop-step-feedback',schemaVersion:1,id:root.crypto.randomUUID(),createdAt:new Date().toISOString(),source:target.source,sourceFingerprint,workflowId:target.workflowId,revision:target.revision,stepId:target.stepId,section:target.section,type,note:note.trim()};if(target.issueId)record.issueId=target.issueId;
  await storage.set({[KEY]:{format:'runtime-sop-step-feedback-list',schemaVersion:1,records:[...records,record]}});const checked=readRecords((await storage.get(KEY))[KEY]);if(!checked.some(item=>Object.keys(record).every(key=>item[key]===record[key])))throw Error('Feedback read-back failed');return record;
 });
}
function create(options={}){
 const doc=options.document||root.document,storage=options.storage||root.chrome.storage.local,lock=options.lock||(fn=>root.navigator.locks.request(KEY,fn));
 let epoch=0,active=null,dialog=null,entries=[];
 function text(index){return(words[typeof options.language==='function'?options.language():options.language]||words.en)[index];}
 function el(tag,value,className){const node=doc.createElement(tag);if(value!==undefined)node.textContent=value;if(className)node.className=className;return node;}
 function close(){epoch++;active=null;if(dialog){if(dialog.open)dialog.close();dialog.remove();dialog=null;}}
 function detach(element){if(active?.element===element)close();entries=entries.filter(entry=>{if(entry.element!==element)return true;entry.button.remove();entry.element.classList.remove('sop-feedback-passage');return false;});}
 function reset(){close();for(const entry of entries){entry.button.remove();entry.element.classList.remove('sop-feedback-passage');}entries=[];}
 function exportAll(){(async()=>{try{const data=await storage.get(KEY),records=readRecords(data[KEY]);const blob=new Blob([JSON.stringify({format:'runtime-sop-step-feedback-export',schemaVersion:1,records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='running-sop-step-feedback.json';doc.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(_){if(dialog)dialog.querySelector('[role="status"]').textContent=text(13);}})();}
 async function open(entry){
  close();const ticket=epoch;
  try{if(!await entry.verify(entry.identity)||ticket!==epoch||!entry.element.isConnected)return;}catch(_){return;}
  active=entry;dialog=el('dialog',undefined,'sop-step-feedback-dialog');dialog.setAttribute('aria-label',text(0));
  const heading=el('h2',text(0)),form=el('form'),label=el('label',text(1)),select=el('select');select.required=true;select.setAttribute('aria-label',text(1));TYPES.forEach((type,index)=>{const item=el('option',text(index+2));item.value=type;select.append(item);});label.append(select);
  const noteLabel=el('label',text(6)),note=el('textarea');note.maxLength=2000;note.rows=3;note.setAttribute('aria-label',text(6));noteLabel.append(note);
  const privacy=el('p',text(7),'sop-step-feedback-privacy'),scope=el('p',localScope[typeof options.language==='function'?options.language():options.language]||localScope.en,'sop-step-feedback-scope'),status=el('p','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const actions=el('div',undefined,'sop-step-feedback-actions'),submit=el('button',text(8)),cancel=el('button',text(9)),download=el('button',text(11));submit.type='submit';cancel.type='button';download.type='button';cancel.addEventListener('click',close);download.addEventListener('click',exportAll);actions.append(submit,cancel);form.append(label,noteLabel,privacy,scope,status,actions,download);dialog.append(heading);if(entry.label)dialog.append(el('p',entry.label,'sop-step-feedback-context'));dialog.append(form);doc.body.append(dialog);
  // Escape invalidates in-flight work synchronously, including on Chrome 116.
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  form.addEventListener('submit',async event=>{event.preventDefault();if(submit.disabled||ticket!==epoch)return;submit.disabled=true;try{await save({captured:entry.identity,type:select.value,note:note.value,verify:entry.verify,alive:()=>ticket===epoch&&active===entry,storage,lock});if(ticket!==epoch)return;status.textContent=text(10);select.disabled=true;note.disabled=true;cancel.textContent=text(9);if(options.onSaved)options.onSaved(entry.identity);}catch(error){if(ticket!==epoch)return;status.textContent=text(error.message==='STALE'?12:error.message==='FULL'?14:13);submit.disabled=false;}});
  dialog.showModal();
 }
 function attach(element,config){let captured;try{captured=identity(config.identity);}catch(_){return null;}if(typeof config.verify!=='function'||!element)return null;
  const contextLabel=bounded(config.label,500)?config.label:'';const accessibleLabel=contextLabel?text(0)+' — '+contextLabel:text(0);const button=el('button',undefined,'sop-step-feedback-trigger');button.type='button';button.title=accessibleLabel;button.setAttribute('aria-label',accessibleLabel);button.setAttribute('aria-haspopup','dialog');
  // This SVG is a fixed bundled icon, never derived from imported SOP content.
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML='<path d="M4 4h16v13H9l-5 4V4Z"/><path d="M12 7v5m0 2v1"/>';button.append(svg);element.classList.add('sop-feedback-passage');element.append(button);const entry={element,button,label:contextLabel,identity:captured,verify:config.verify};entries.push(entry);button.addEventListener('click',()=>open(entry));return button;
 }
 return{attach,detach,reset,destroy:reset};
}
const api=Object.freeze({create,identity,save,readRecords,validRecord,KEY,LIMIT});root.SOPStepFeedback=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
