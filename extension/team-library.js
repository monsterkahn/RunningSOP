(async function(){
 'use strict';
 const $=id=>document.getElementById(id),I=WorkspaceI18n;
 const keys=['title','settings','categories','manage','category','name','parent','color','icon','save','remove','search','empty','previous','next','close','move','read','history','more','newCategory','all','none','loading','notConnected','connectChanged','searchShort','conflict','failure','confirmRemove','step','report','approval','issue','readOnly','done','version','noHistory','folder','briefcase','video','users','settingsIcon','file','blue','purple','green','orange','red','gray','chooseSop'];
 const words={
 en:['Team library','Settings','Categories','Manage categories','Category','Name','Parent category','Color','Icon','Save','Delete','Search','No matching SOPs.','Previous','Next','Close','Move','Read SOP','Version history','Load more','New category','All SOPs','Uncategorized','Loading…','Connect a team service in Settings first.','Connection changed. Reopen this page to use the new account or server.','Enter at least two characters, or leave search empty.','This item changed or cannot be deleted. Select it again and review before saving.','Unable to complete the request. Check the connection and try again.','Delete this empty category? Published SOPs are not deleted.','Step','Reporting point','Approval point','Issue','Reading a published version. Edit from the work-page side panel.','Saved','Revision','No history available.','Folder','Business','Video','People','Settings','Document','Blue','Purple','Green','Orange','Red','Gray','Choose an SOP to read or organize.'],
 zh:['团队内容库','设置','分类','管理分类','分类','名称','上级分类','颜色','图标','保存','删除','搜索','没有符合条件的 SOP。','上一页','下一页','关闭','调整归属','阅读 SOP','版本历史','加载更多','新建分类','全部 SOP','未分类','正在加载…','请先在设置中连接团队服务。','连接已变化，请重新打开此页面以使用新账号或服务。','请输入至少两个字符，或清空搜索。','内容已变化或分类不可删除，请重新选择并核对后保存。','操作未完成，请检查连接后重试。','删除这个空分类？不会删除已发布的 SOP。','步骤','报告点','审批点','异常情况','正在阅读已发布版本；请在工作页面的侧边栏中编辑。','已保存','修订','暂无历史版本。','文件夹','业务','视频','人员','设置','文档','蓝色','紫色','绿色','橙色','红色','灰色','选择一份 SOP 阅读或整理。'],
 'zh-TW':['團隊內容庫','設定','分類','管理分類','分類','名稱','上級分類','顏色','圖示','儲存','刪除','搜尋','沒有符合條件的 SOP。','上一頁','下一頁','關閉','調整歸屬','閱讀 SOP','版本歷史','載入更多','新增分類','全部 SOP','未分類','載入中…','請先在設定中連線團隊服務。','連線已變更，請重新開啟此頁面以使用新帳號或服務。','請輸入至少兩個字元，或清空搜尋。','內容已變更或分類無法刪除，請重新選擇並核對後儲存。','操作未完成，請檢查連線後重試。','刪除此空分類？不會刪除已發布的 SOP。','步驟','報告點','審批點','異常情況','正在閱讀已發布版本；請在工作頁面的側邊欄中編輯。','已儲存','修訂','暫無歷史版本。','資料夾','業務','影片','人員','設定','文件','藍色','紫色','綠色','橙色','紅色','灰色','選擇一份 SOP 閱讀或整理。'],
 es:['Biblioteca de equipo','Configuración','Categorías','Gestionar categorías','Categoría','Nombre','Categoría superior','Color','Icono','Guardar','Eliminar','Buscar','No hay SOP coincidentes.','Anterior','Siguiente','Cerrar','Mover','Leer SOP','Historial de versiones','Cargar más','Nueva categoría','Todos los SOP','Sin categoría','Cargando…','Conecta un servicio de equipo en Configuración.','La conexión cambió. Abre de nuevo esta página.','Introduce al menos dos caracteres o borra la búsqueda.','El elemento cambió o no se puede eliminar. Vuelve a seleccionarlo y revisa antes de guardar.','No se completó la solicitud. Comprueba la conexión.','¿Eliminar esta categoría vacía? Los SOP publicados se conservan.','Paso','Punto de informe','Punto de aprobación','Incidencia','Versión publicada. Edita desde el panel de la página de trabajo.','Guardado','Revisión','No hay historial.','Carpeta','Negocio','Vídeo','Personas','Ajustes','Documento','Azul','Morado','Verde','Naranja','Rojo','Gris','Elige un SOP para leer u organizar.'],
 ru:['Командная библиотека','Настройки','Категории','Управление категориями','Категория','Название','Родительская категория','Цвет','Значок','Сохранить','Удалить','Поиск','Подходящих SOP нет.','Назад','Далее','Закрыть','Переместить','Читать SOP','История версий','Загрузить ещё','Новая категория','Все SOP','Без категории','Загрузка…','Сначала подключите командный сервис в настройках.','Подключение изменилось. Откройте страницу заново.','Введите хотя бы два символа или очистите поиск.','Элемент изменён или его нельзя удалить. Выберите его заново и проверьте перед сохранением.','Запрос не выполнен. Проверьте подключение.','Удалить пустую категорию? Опубликованные SOP сохранятся.','Шаг','Точка отчёта','Точка согласования','Исключение','Опубликованная версия. Редактируйте на рабочей странице в боковой панели.','Сохранено','Ревизия','Истории пока нет.','Папка','Бизнес','Видео','Люди','Настройки','Документ','Синий','Фиолетовый','Зелёный','Оранжевый','Красный','Серый','Выберите SOP для чтения или организации.'],
 ko:['팀 콘텐츠 라이브러리','설정','분류','분류 관리','분류','이름','상위 분류','색상','아이콘','저장','삭제','검색','일치하는 SOP가 없습니다.','이전','다음','닫기','분류 이동','SOP 읽기','버전 기록','더 보기','새 분류','모든 SOP','미분류','불러오는 중…','설정에서 먼저 팀 서비스에 연결하세요.','연결이 변경되었습니다. 이 페이지를 다시 여세요.','두 글자 이상 입력하거나 검색어를 비우세요.','항목이 변경되었거나 삭제할 수 없습니다. 다시 선택하고 확인 후 저장하세요.','요청을 완료하지 못했습니다. 연결을 확인하세요.','빈 분류를 삭제할까요? 게시된 SOP는 삭제되지 않습니다.','단계','보고 지점','승인 지점','예외 상황','게시된 버전을 읽고 있습니다. 작업 페이지의 사이드 패널에서 편집하세요.','저장됨','개정','버전 기록이 없습니다.','폴더','업무','동영상','사용자','설정','문서','파랑','보라','초록','주황','빨강','회색','읽거나 정리할 SOP를 선택하세요.'],
 ja:['チームライブラリ','設定','分類','分類を管理','分類','名前','親分類','色','アイコン','保存','削除','検索','一致する SOP はありません。','前へ','次へ','閉じる','分類を変更','SOP を読む','版の履歴','さらに読み込む','分類を作成','すべての SOP','未分類','読み込み中…','設定でチームサービスに接続してください。','接続が変わりました。このページを開き直してください。','2 文字以上入力するか、検索を空にしてください。','項目が変更されたか削除できません。選び直して確認してから保存してください。','操作を完了できません。接続を確認してください。','空の分類を削除しますか？公開済み SOP は削除されません。','手順','報告ポイント','承認ポイント','例外','公開済みの版を表示中です。作業ページのサイドパネルで編集してください。','保存しました','改訂','履歴はありません。','フォルダー','業務','動画','ユーザー','設定','文書','青','紫','緑','オレンジ','赤','灰色','読む、または整理する SOP を選択してください。']};
 const saved=await chrome.storage.local.get('runtime-sop-workspace-preferences-v1');I.setLanguage(saved['runtime-sop-workspace-preferences-v1']?.language||'auto');
 const dictionary=Object.fromEntries(keys.map((key,i)=>[key,(words[I.getLanguage()]||words.en)[i]])),t=key=>dictionary[key]||key;
 const historyWords={
  en:['Historical version — read only. Category changes are unavailable.','Return to current version','Current','Reporting and approval point','Screenshots and manually entered notes may contain sensitive information. Review before sharing.'],
  zh:['历史版本，只读。无法调整分类归属。','返回当前版本','当前版本','报告与审批点','截图和手动填写的备注可能包含敏感信息，分享前请检查。'],
  'zh-TW':['歷史版本，唯讀。無法調整分類歸屬。','返回目前版本','目前版本','報告與審批點','截圖和手動填寫的備註可能包含敏感資訊，分享前請檢查。'],
  es:['Versión histórica, solo lectura. No se puede cambiar la categoría.','Volver a la versión actual','Actual','Punto de informe y aprobación','Las capturas y las notas introducidas manualmente pueden contener información sensible. Revísalas antes de compartirlas.'],
  ru:['Историческая версия — только чтение. Изменение категории недоступно.','Вернуться к текущей версии','Текущая','Точка отчёта и согласования','Снимки экрана и введённые вручную заметки могут содержать конфиденциальные сведения. Проверьте их перед передачей.'],
  ko:['이전 버전은 읽기 전용입니다. 분류를 변경할 수 없습니다.','현재 버전으로 돌아가기','현재 버전','보고 및 승인 지점','스크린샷과 직접 입력한 메모에는 민감한 정보가 포함될 수 있습니다. 공유 전에 확인하세요.'],
  ja:['履歴の版は読み取り専用です。分類は変更できません。','現在の版に戻る','現在の版','報告・承認ポイント','スクリーンショットや手入力のメモには機密情報が含まれる場合があります。共有前に確認してください。']};
 ['historical','returnCurrent','current','reportAndApproval','sensitivity'].forEach((key,index)=>dictionary[key]=(historyWords[I.getLanguage()]||historyWords.en)[index]);
 dictionary.root=({en:'Top level',zh:'顶级分类','zh-TW':'頂級分類',es:'Nivel superior',ru:'Верхний уровень',ko:'최상위 분류',ja:'最上位の分類'})[I.getLanguage()]||'Top level';document.documentElement.lang=I.getLanguage();document.title=t('title')+' · Running SOP';document.querySelectorAll('[data-word]').forEach(n=>n.textContent=t(n.dataset.word));
 const colors=['blue','purple','green','orange','red','gray'],icons=['folder','briefcase','video','users','settings','file-text'];
 const option=(value,label)=>{const n=document.createElement('option');n.value=value;n.textContent=label;return n;};
 colors.forEach(v=>$('category-color').append(option(v,t(v))));icons.forEach((v,i)=>$('category-icon').append(option(v,t(['folder','briefcase','video','users','settingsIcon','file'][i]))));
 let client,identity,configAbort=new AbortController(),categories=[],items=[],selected=null,category='',cursor='',nextCursor='',pages=[],historyCursor='',categoryBusy=false,invalidated=false,listSequence=0,readSequence=0,historySequence=0,imageViewSequence=0,readingHistorical=false;
 function readingState(historical){readingHistorical=historical;$('historical-notice').hidden=!historical;$('sop-category').disabled=historical||categoryBusy;$('move-sop').disabled=historical||categoryBusy;}
 const identify=record=>record.enabled?record.endpoint+'|'+record.actor?.id+'|'+record.token:'';
 function status(message,error=false,target='status'){const node=$(target);node.textContent=message;node.classList.toggle('error',error);}
 function failure(error,target='status'){if(invalidated||error.code==='aborted')return;status(t(error.status===409?'conflict':'failure'),true,target);}
 async function active(){const source=client;if(!source||invalidated)throw Error('Disconnected');const next=await RunningSOPTeamSettings.read();if(identify(next)!==identity){invalidate();throw Error('Connection changed');}if(client!==source||invalidated)throw Error('Connection changed');}
 function invalidate(){invalidated=true;imageViewSequence++;configAbort.abort();resetImages();client=null;selected=null;categories=[];for(const id of ['categories','category-edit','category-parent','sop-category','guide','history','large-picture'])$(id).replaceChildren();$('category-name').value='';$('large-picture')._pictureTicket=Symbol();if($('image-dialog').open)$('image-dialog').close();listSequence++;readSequence++;$('sops').replaceChildren();$('reader').hidden=true;$('connection').textContent='';document.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);status(t('connectChanged'),true);}
 const opts=()=>({signal:configAbort.signal});
 function button(label,action){const n=document.createElement('button');n.type='button';n.textContent=label;n.onclick=()=>Promise.resolve(action()).catch(e=>failure(e));return n;}
 function categoryLabel(id){return categories.find(c=>c.id===id)?.name||t('none');}
 function categoryOptions(node,first){node.replaceChildren(option('',first),...categories.map(c=>option(c.id,c.name)));}
 function renderCategories(){
  const nav=$('categories');nav.replaceChildren();
  const all=button(t('all'),()=>filter(''));all.setAttribute('aria-pressed',String(!category));nav.append(all);const unassigned=button(t('none'),()=>filter('__uncategorized__'));unassigned.setAttribute('aria-pressed',String(category==='__uncategorized__'));nav.append(unassigned);
  const visited=new Set();function branch(parent,depth){for(const entry of categories.filter(c=>c.parentId===parent).sort((a,b)=>a.name.localeCompare(b.name))){if(visited.has(entry.id)||depth>8)continue;visited.add(entry.id);const b=button(entry.name,()=>filter(entry.id));b.dataset.categoryId=entry.id;b.setAttribute('aria-pressed',String(category===entry.id));b.style.setProperty('--category-color','var(--'+entry.color+')');b.style.paddingInlineStart=String(8+depth*10)+'px';const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.innerHTML=SOPIcons.svg(entry.icon);b.prepend(icon);nav.append(b);branch(entry.id,depth+1);}}branch(null,0);
  const editing=$('category-edit').value;categoryOptions($('category-edit'),t('newCategory'));if(categories.some(c=>c.id===editing))$('category-edit').value=editing;
  categoryOptions($('category-parent'),t('root'));if(selected){categoryOptions($('sop-category'),t('none'));$('sop-category').value=selected.categoryId||'';}
 }
 async function loadCategories(){const source=client;const output=[],seen=new Set();let after='';do{const data=await source.categories({...opts(),limit:100,cursor:after});await active();if(client!==source||invalidated)throw Error('Connection changed');for(const value of data.items){if(seen.has(value.id)||output.length>=500)throw Error('Invalid category page');seen.add(value.id);output.push(value);}if(data.nextCursor&&data.nextCursor===after)throw Error('Invalid category cursor');after=data.nextCursor;}while(after);categories=output;renderCategories();}
 function categoryEditor(){const entry=categories.find(c=>c.id===$('category-edit').value);$('category-name').value=entry?.name||'';$('category-parent').value=entry?.parentId||'';$('category-color').value=entry?.color||'blue';$('category-icon').value=entry?.icon||'folder';$('delete-category').disabled=!entry||categoryBusy;}
 function renderItems(){const list=$('sops');list.replaceChildren();for(const item of items){const row=document.createElement('li'),description=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=item.title;detail.textContent=categoryLabel(item.categoryId)+' · '+t('version')+' '+item.revision;description.append(name,detail);row.append(description,button(t('read'),()=>openItem(item)));list.append(row);}$('empty').hidden=items.length>0;$('previous').disabled=pages.length===0;$('next').disabled=!nextCursor;$('page-number').textContent=String(pages.length+1);}
 async function loadPage(after='',query=$('query').value.trim()){
  const sequence=++listSequence;if(query&&Array.from(query.normalize('NFKC')).length<2){status(t('searchShort'),true);return false;}
  status(t('loading'));$('next').disabled=true;$('previous').disabled=true;
  try{await active();const data=await client.list({...opts(),limit:50,...(after?{cursor:after}:{}),...(query?{query}:{}),...(category==='__uncategorized__'?{uncategorized:true}:category?{category}:{})});await active();if(sequence!==listSequence||!client)return null;items=data.items;cursor=after;nextCursor=data.nextCursor||'';renderItems();status('');return true;}catch(e){if(sequence!==listSequence||!client)return null;failure(e);return false;}
 }
 async function filter(id){category=id;pages=[];renderCategories();await loadPage();}
 async function openItem(item){selected={...item};readSequence++;historySequence++;readingState(false);$('reader').hidden=false;$('sop-title').textContent=item.title;$('revision').textContent=t('version')+' '+item.revision;resetImages();$('guide').replaceChildren();$('history').replaceChildren();$('more-history').hidden=true;historyCursor='';categoryOptions($('sop-category'),t('none'));$('sop-category').value=item.categoryId||'';status(t('chooseSop'),false,'reader-status');await readGuide();if(client&&selected?.id===item.id)$('reader').scrollIntoView({block:'start',behavior:'auto'});}
 let imageQueue=[],decoding=0,imageGeneration=0,imageAbort=new AbortController(),pictureJobs=new Set(),readViewMode;
 configAbort.signal.addEventListener('abort',()=>imageAbort.abort(),{once:true});
 const cancelled=()=>Object.assign(new Error('Reading changed'),{code:'aborted'});
 function currentJob(job){return !invalidated&&client===job.source&&identity===job.identity&&readSequence===job.sequence&&imageGeneration===job.generation&&!job.signal.aborted&&job.box.isConnected;}
 function openJob(job){if(!currentJob(job))return false;for(let node=job.button.parentElement;node&&node!==$('guide');node=node.parentElement)if(node.tagName==='DETAILS'&&!node.open)return false;return true;}
 function queueImage(job){
  if(!openJob(job))return Promise.reject(cancelled());
  if(job.loaded)return Promise.resolve(job.loaded);
  if(job.promise)return job.promise;
  job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});job.promise.catch(()=>{});imageQueue.push(job);pumpImages();return job.promise;
 }
 function pumpImages(){
  while(decoding<2&&imageQueue.length){
   const job=imageQueue.shift();
   if(!openJob(job)){job.reject(cancelled());job.promise=null;continue;}
   decoding++;
   (async()=>{
    const result=job.ref?await job.source.readImage(job.sopId,job.ref,{revision:job.revision,signal:job.signal}):{image:job.step.image};
    if(!openJob(job))throw cancelled();await active();if(!openJob(job))throw cancelled();
    const step={...job.step,image:result.image,...(job.ref?.imageAt===undefined?{}:{imageAt:job.ref.imageAt}),...(job.ref?.imageMarks===undefined?{}:{imageMarks:job.ref.imageMarks})};
    // Decode away from the document: private settings can change before the
    // storage notification reaches this page. Recheck persisted identity after
    // decoding, before exposing any pixels from the previous account.
    const staging=document.createElement('div');await ScreenshotEditor.renderFigure(staging,step);
    await active();if(!openJob(job))throw cancelled();
    job.box.replaceChildren(...staging.childNodes);job.loaded=step;job.box.querySelectorAll('img').forEach(n=>n.alt=t('step'));job.resolve(step);
   })().catch(error=>{if(currentJob(job)&&error.code!=='aborted')job.box.textContent=t('failure');job.reject(error);}).finally(()=>{job.promise=null;decoding--;pumpImages();});
  }
 }
 const imageObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const job=entry.target._imageJob;if(job&&openJob(job)){imageObserver.unobserve(entry.target);queueImage(job).catch(()=>{});}}},{rootMargin:'160px'}):null;
 function observeImage(job){if(imageObserver)imageObserver.observe(job.button);else queueMicrotask(()=>{if(openJob(job))queueImage(job).catch(()=>{});});}
 function resetImages(){
  imageGeneration++;imageAbort.abort();imageAbort=new AbortController();imageObserver?.disconnect();
  for(const job of pictureJobs){job.box._pictureTicket=Symbol();job.reject?.(cancelled());}pictureJobs.clear();imageQueue=[];
  cancelImage();if($('image-dialog').open)$('image-dialog').close();
 }
 function paragraph(parent,value,className){if(!value)return;const node=document.createElement('p');node.textContent=value;if(className)node.className=className;parent.append(node);}
 function picture(parent,step,ref,data){
  if(!step.image&&!ref)return;
  const box=document.createElement('div');box.textContent=t('loading');let job;
  const b=button(t('read'),async()=>{
   const ticket=++imageViewSequence,loaded=await queueImage(job);await active();if(!currentJob(job)||ticket!==imageViewSequence)return;
   const staging=document.createElement('div');staging.id='large-picture';
   await ScreenshotEditor.renderFigure(staging,loaded);await active();if(!currentJob(job)||ticket!==imageViewSequence)return;
   $('large-picture').replaceChildren(...staging.childNodes);
   $('large-picture').querySelectorAll('img').forEach(n=>n.alt=t('step'));$('image-title').textContent=step.title||t('step');$('image-dialog').showModal();
  });
  b.className='picture';b.replaceChildren(box);b.setAttribute('aria-label',t('read'));parent.append(b);
  job={box,button:b,step,ref,source:client,identity,sequence:readSequence,generation:imageGeneration,signal:imageAbort.signal,sopId:data.id,revision:data.revision};
  pictureJobs.add(job);b._imageJob=job;observeImage(job);
  if(parent.tagName==='DETAILS')parent.addEventListener('toggle',()=>{if(parent.open&&currentJob(job))observeImage(job);});
 }
 async function readGuide(revision){
  const item=selected;if(!item)return;const sequence=++readSequence;historySequence++;readingState(Boolean(revision&&revision!==item.revision));resetImages();const source=client,signal=imageAbort.signal;
  $('guide').replaceChildren();status(t('loading'),false,'reader-status');
  try{
   await active();if(sequence!==readSequence||source!==client||signal.aborted)return;
   if(readViewMode===undefined){const capabilities=await source.capabilities({signal});if(sequence!==readSequence||source!==client||signal.aborted)return;readViewMode=Array.isArray(capabilities.features)&&capabilities.features.includes('read-view-images');}
   const data=await source[readViewMode?'readView':'getSop'](item.id,{signal,...(revision?{revision}:{})});await active();if(sequence!==readSequence||selected?.id!==item.id||source!==client||signal.aborted)return;
   if(revision===undefined){selected={...selected,revision:data.revision};for(const row of $('history').children){const label=row.firstElementChild;if(label?.firstChild)label.firstChild.textContent=t('version')+' '+row.dataset.revision+(Number(row.dataset.revision)===data.revision?' · '+t('current'):'');}}
   readingState(data.revision!==selected.revision);
   $('sop-title').textContent=data.guide.title;paragraph($('guide'),data.guide.notice);
   $('revision').textContent=t('version')+' '+data.revision+' · '+data.guide.version;
   const refs=new Map((data.images||[]).map(ref=>[ref.step+':'+(ref.issue===undefined?'step':ref.issue),ref]));
   data.guide.steps.forEach((step,index)=>{
    const article=document.createElement('article'),heading=document.createElement('h3');heading.textContent=t('step')+' '+(index+1)+(step.title?' · '+step.title:'');article.append(heading);paragraph(article,step.where,'step-location');paragraph(article,step.workUrl,'step-work-url');paragraph(article,step.actions.join('\n'));
    if(step.pointType&&step.pointType!=='normal')paragraph(article,t(step.pointType==='both'?'reportAndApproval':step.pointType==='approval'?'approval':'report')+'\n'+(step.pointNote||''),'point');
    picture(article,step,refs.get(index+':step'),data);paragraph(article,step.expected);(step.acceptance||[]).forEach(text=>paragraph(article,text));
    (step.issues||[]).forEach((issue,i)=>{const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('issue')+' · '+issue.title;details.append(summary);paragraph(details,issue.actions.join('\n'));paragraph(details,issue.next);picture(details,issue,refs.get(index+':'+i),data);article.append(details);});
    paragraph(article,step.trouble);$('guide').append(article);
   });status(t(readingHistorical?'historical':'readOnly'),false,'reader-status');
  }catch(e){if(sequence===readSequence)failure(e,'reader-status');}
 }
 async function history(more=false){
  if(!selected)return;const item=selected,sequence=readSequence,request=++historySequence,source=client;
  const current=()=>selected?.id===item.id&&sequence===readSequence&&request===historySequence&&source===client&&!invalidated;
  try{
   await active();if(!current())return;
   const result=await source.history(item.id,{...opts(),limit:20,...(more&&historyCursor?{cursor:historyCursor}:{})});await active();if(!current())return;
   if(!more)$('history').replaceChildren();
   for(const record of result.items){
    const row=document.createElement('li'),label=document.createElement('span');label.textContent=t('version')+' '+record.revision+(record.revision===selected.revision?' · '+t('current'):'');
    row.dataset.revision=String(record.revision);
    if(Number.isSafeInteger(record.updatedAt)&&record.updatedAt>=0){const date=new Date(record.updatedAt);if(Number.isFinite(date.getTime())){const time=document.createElement('time');time.dateTime=date.toISOString();time.textContent=date.toLocaleString(I.getLanguage());label.append(time);}}
    row.append(label,button(t('read'),()=>readGuide(record.revision)));$('history').append(row);
   }
   historyCursor=result.nextCursor||'';$('more-history').hidden=!historyCursor;if(!result.items.length&&!more)status(t('noHistory'),false,'reader-status');
  }catch(e){if(current())failure(e,'reader-status');}
 }
 async function mutate(action){if(categoryBusy)return;categoryBusy=true;document.querySelectorAll('#category-tools button,#move-sop').forEach(n=>n.disabled=true);try{await active();await action();await active();if(client)status(t('done'));}catch(e){if(e.status===409&&client){const parent=$('category-parent').value;try{await loadCategories();if(categories.some(c=>c.id===parent))$('category-parent').value=parent;await loadPage(cursor);}catch(_){} }failure(e);}finally{categoryBusy=false;if(client){document.querySelectorAll('#category-tools button,#move-sop').forEach(n=>n.disabled=false);$('delete-category').disabled=!$('category-edit').value;readingState(readingHistorical);}}}
 $('category-edit').onchange=categoryEditor;
 $('category-form').onsubmit=event=>{event.preventDefault();$('category-name').value=$('category-name').value.trim();if(!$('category-form').reportValidity())return;const old=categories.find(c=>c.id===$('category-edit').value),value={name:$('category-name').value.trim(),parentId:$('category-parent').value||null,color:$('category-color').value,icon:$('category-icon').value};mutate(async()=>{const result=old?await client.updateCategory(old.id,value,{...opts(),expectedRevision:old.revision}):await client.createCategory(value,opts());await active();await loadCategories();$('category-edit').value=result.id;categoryEditor();await loadPage(cursor);});};
 $('delete-category').onclick=()=>{const old=categories.find(c=>c.id===$('category-edit').value);if(!old||!confirm(t('confirmRemove')))return;mutate(async()=>{await client.deleteCategory(old.id,{...opts(),expectedRevision:old.revision});await active();if(category===old.id){category='';pages=[];}await loadCategories();categoryEditor();await loadPage();});};
 $('move-sop').onclick=()=>{const item=selected,sequence=readSequence;if(!item||readingHistorical)return;const destination=$('sop-category').value||null;mutate(async()=>{if(readingHistorical||sequence!==readSequence||selected?.id!==item.id)return;const result=await client.assignCategory(item.id,destination,{...opts(),expectedCategoryRevision:item.categoryRevision});await active();if(!client||readingHistorical||sequence!==readSequence||selected?.id!==item.id)return;selected={...selected,...result};await loadPage(cursor);});};
 $('search-form').onsubmit=event=>{event.preventDefault();pages=[];loadPage();};$('next').onclick=async()=>{if(!nextCursor)return;const previousPages=[...pages];pages.push(cursor);if(await loadPage(nextCursor)===false){pages=previousPages;renderItems();}};$('previous').onclick=async()=>{if(!pages.length)return;const previousPages=[...pages],target=pages.pop();if(await loadPage(target)===false){pages=previousPages;renderItems();}};
 $('return-current').onclick=()=>readGuide();$('read-sop').onclick=()=>readGuide();$('history-sop').onclick=()=>history();$('more-history').onclick=()=>history(true);$('close-reader').onclick=()=>{selected=null;readSequence++;historySequence++;readingState(false);resetImages();$('reader').hidden=true;};function cancelImage(){imageViewSequence++;$('large-picture')._pictureTicket=Symbol();$('large-picture').replaceChildren();} $('close-image').onclick=()=>{cancelImage();$('image-dialog').close();};$('image-dialog').addEventListener('cancel',cancelImage);$('image-dialog').addEventListener('close',cancelImage);
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[RunningSOPTeamSettings.KEY])invalidate();});
 try{const record=await RunningSOPTeamSettings.read();if(invalidated)return;if(!record.enabled){status(t('notConnected'));document.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);return;}identity=identify(record);client=RunningSOPTeamClient.create({endpoint:record.endpoint,token:record.token});$('connection').textContent=record.endpoint;await loadCategories();categoryEditor();await loadPage();}catch(e){failure(e);}
})();
