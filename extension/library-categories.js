(function(root){
 'use strict';
 const labels={
  en:['Category settings','Assign category','New category','Category name','Parent category','Top level','Save','Delete empty category','Close','Saved.','Saving…','Choose a category','Uncategorized','Categories are shared with everyone using this folder. Saving requires folder write access.','Allow write access to save categories.','Refresh the overview before editing categories.','SOP','Category','Cancel','Save failed. Refresh before retrying.'],
  zh:['归类设置','指定分类','新建分类','分类名称','上级分类','顶级分类','保存','删除空分类','关闭','已保存。','正在保存…','选择分类','未分类','分类由使用同一文件夹的人共享，保存时需要文件夹写入许可。','请允许写入文件夹后保存分类。','请刷新总表后再修改分类。','SOP','分类','取消','保存失败，请刷新后重试。'],
  'zh-TW':['歸類設定','指定分類','新增分類','分類名稱','上層分類','頂層分類','儲存','刪除空分類','關閉','已儲存。','儲存中…','選擇分類','未分類','分類由使用同一資料夾的人共用，儲存時需要資料夾寫入許可。','請允許寫入資料夾後儲存分類。','請重新整理總表後再修改分類。','SOP','分類','取消','儲存失敗，請重新整理後重試。'],
  es:['Configurar categorías','Asignar categoría','Nueva categoría','Nombre','Categoría superior','Nivel superior','Guardar','Eliminar categoría vacía','Cerrar','Guardado.','Guardando…','Elegir categoría','Sin categoría','Las categorías se comparten con quienes usan esta carpeta. Guardar requiere acceso de escritura.','Permite escribir en la carpeta.','Actualiza el resumen antes de editar categorías.','SOP','Categoría','Cancelar','No se guardó. Actualiza antes de reintentar.'],
  ru:['Настройки категорий','Назначить категорию','Новая категория','Название','Родительская категория','Верхний уровень','Сохранить','Удалить пустую категорию','Закрыть','Сохранено.','Сохранение…','Выбрать категорию','Без категории','Категории общие для пользователей папки. Для сохранения нужен доступ на запись.','Разрешите запись в папку.','Обновите обзор перед изменением категорий.','SOP','Категория','Отмена','Не сохранено. Обновите перед повтором.'],
  ko:['분류 설정','분류 지정','새 분류','분류 이름','상위 분류','최상위','저장','빈 분류 삭제','닫기','저장됨.','저장 중…','분류 선택','미분류','분류는 같은 폴더를 사용하는 사용자와 공유됩니다. 저장하려면 쓰기 권한이 필요합니다.','폴더 쓰기 권한을 허용하세요.','분류를 수정하기 전에 목록을 새로고침하세요.','SOP','분류','취소','저장하지 못했습니다. 새로고침한 후 재시도하세요.'],
  ja:['分類設定','分類を指定','新しい分類','分類名','親分類','最上位','保存','空の分類を削除','閉じる','保存しました。','保存中…','分類を選択','未分類','分類は同じフォルダーの利用者と共有します。保存には書き込み許可が必要です。','フォルダーへの書き込みを許可してください。','分類を編集する前に一覧を更新してください。','SOP','分類','キャンセル','保存できませんでした。更新して再試行してください。']
 };
 root.SOPLibraryCategories={create({getContext,assertActive,onSaved,language}){
  const $=id=>document.getElementById(id);let words=labels[language]||labels.en;
  const styleLabels={
   en:['Color','Icon','Blue','Purple','Green','Orange','Red','Gray','Folder','Business','Video','Team','Settings','Document'],
   zh:['颜色','图标','蓝色','紫色','绿色','橙色','红色','灰色','文件夹','业务','视频','团队','设置','文档'],
   'zh-TW':['顏色','圖示','藍色','紫色','綠色','橙色','紅色','灰色','資料夾','業務','影片','團隊','設定','文件'],
   es:['Color','Icono','Azul','Morado','Verde','Naranja','Rojo','Gris','Carpeta','Negocio','Vídeo','Equipo','Ajustes','Documento'],
   ru:['Цвет','Значок','Синий','Фиолетовый','Зелёный','Оранжевый','Красный','Серый','Папка','Бизнес','Видео','Команда','Настройки','Документ'],
   ko:['색상','아이콘','파랑','보라','초록','주황','빨강','회색','폴더','업무','영상','팀','설정','문서'],
   ja:['色','アイコン','青','紫','緑','オレンジ','赤','グレー','フォルダー','業務','動画','チーム','設定','文書']
  };
  let styles=styleLabels[language]||styleLabels.en;
  const colors=['blue','purple','green','orange','red','gray'],icons=['folder','briefcase','video','users','settings','file-text'];
  const palette={blue:'#315cec',purple:'#7656bc',green:'#258461',orange:'#b96e16',red:'#bd4747',gray:'#6a7484'};
  const keys=['manage','assign','new','name','parent','top','save','remove','close','done','saving','choose','none','notice','permission','changed','sop','category','cancel','failure'];
  const t=key=>key==='color'?styles[0]:key==='icon'?styles[1]:words[keys.indexOf(key)]||key;
  document.querySelectorAll('[data-category-word]').forEach(n=>n.textContent=t(n.dataset.categoryWord));
  let handle=null,source='',data=null,busy=false,opening=false,target=null;
  const dialog=$('category-dialog'),assignment=$('assignment-dialog');
  const available=()=>{const c=getContext();return Boolean(c.catalog&&c.categoryValid&&!c.offline&&!c.invalidated&&!c.refreshing&&SOPStorageSource.isEndpoint(c.endpoint));};
  function message(id,text,error=false){$(id).textContent=text;$(id).classList.toggle('error',error);}
  function update(){ $('category-settings').disabled=!available()||opening||busy;document.querySelectorAll('.assign-category').forEach(b=>b.disabled=!available()||opening||busy); }
  function close(){dialog.close();assignment.close();handle=null;source='';target=null;data=null;update();}
  function option(select,value,text){const item=document.createElement('option');item.value=value;item.textContent=text;select.append(item);}
  function choices(select,empty,exclude){select.replaceChildren();option(select,'',empty);for(const c of data.categories)if(c.id!==exclude)option(select,c.id,c.name);}
  function preview(){const color=palette[$('category-color').value]||palette.blue,icon=icons.includes($('category-icon').value)?$('category-icon').value:'folder';$('category-preview').style.color=color;$('category-preview').style.backgroundColor=color+'14';$('category-preview').innerHTML=SOPIcons.svg(icon);}
  function styleChoices(){const color=$('category-color').value||'blue',icon=$('category-icon').value||'folder';$('category-color').replaceChildren();$('category-icon').replaceChildren();colors.forEach((c,i)=>option($('category-color'),c,styles[2+i]));icons.forEach((c,i)=>option($('category-icon'),c,styles[8+i]));$('category-color').value=color;$('category-icon').value=icon;preview();}
  function translate(next){words=labels[next]||labels.en;styles=styleLabels[next]||styleLabels.en;document.querySelectorAll('[data-category-word]').forEach(n=>n.textContent=t(n.dataset.categoryWord));styleChoices();if(data){const chosen=$('category-edit').value,parent=$('category-parent').value,assigned=$('assignment-category').value;choices($('category-edit'),t('new'));$('category-edit').value=chosen;choices($('category-parent'),t('top'),chosen);$('category-parent').value=parent;choices($('assignment-category'),t('none'));$('assignment-category').value=assigned;}}
  function editor(){const id=$('category-edit').value,c=data.categories.find(c=>c.id===id);$('category-name').value=c?.name||'';choices($('category-parent'),t('top'),id);$('category-parent').value=c?.parentId||'';$('category-color').value=c?.color||'blue';$('category-icon').value=c?.icon||'folder';preview();$('category-delete').disabled=!c||busy;}
  function renderEditor(id=''){choices($('category-edit'),t('new'));$('category-edit').value=id;editor();}
  async function guard(){await assertActive();if(!available()||getContext().endpoint!==source)throw Error(t('changed'));const current=await SOPStorageSource.getHandle();if(!current||!handle||!await current.isSameEntry(handle))throw Error(t('changed'));await assertActive();}
  async function prepare(){
   if(!available()||opening||busy)return false;opening=true;update();
   try{await assertActive();source=getContext().endpoint;handle=await SOPStorageSource.getHandle();await guard();data=await SOPCategoryStore.read(handle);await guard();onSaved(data);return true;}
   catch(error){if(!getContext().invalidated)message('status',t('failure')+' '+error.message,true);return false;}
   finally{opening=false;update();}
  }
  async function openManager(){if(!await prepare()||!available())return;target=null;renderEditor();message('category-status','');dialog.showModal();}
  async function openAssignment(workflow){if(!await prepare()||!available())return;if(!getContext().catalog.workflows.some(w=>w.id===workflow.id&&w.status==='published'))return;target=workflow.id;$('assignment-name').textContent=workflow.title;choices($('assignment-category'),t('none'));$('assignment-category').value=data.assignments[target]||'';message('assignment-status','');assignment.showModal();}
  function controls(disabled){for(const n of document.querySelectorAll('#category-dialog button,#category-dialog input,#category-dialog select,#assignment-dialog button,#assignment-dialog select'))n.disabled=disabled;if(!disabled&&data)$('category-delete').disabled=!$('category-edit').value;update();}
  async function save(transform,statusId){
   if(busy||!handle||!data||!available())return;
   // Use the captured handle synchronously while this Save click is active.
   let permission;try{permission=typeof handle.requestPermission==='function'?handle.requestPermission({mode:'readwrite'}):handle.queryPermission({mode:'readwrite'});}catch(error){message(statusId,t('permission'),true);return;}
   busy=true;controls(true);message(statusId,t('saving'));
   try{
    if(await permission!=='granted')throw Error(t('permission'));await guard();
    const expected=data.revision,next=transform(data);
    const saved=await SOPCategoryStore.save(handle,next,expected,{guard});await guard();
    data=saved;onSaved(saved);message(statusId,t('done'));return saved;
   }catch(error){if(!getContext().invalidated)message(statusId,t('failure')+' '+error.message,true);}
   finally{busy=false;controls(false);}
  }
  $('category-settings').onclick=openManager;
  $('category-edit').onchange=()=>{editor();message('category-status','');};
  $('category-form').onsubmit=async event=>{event.preventDefault();if(busy||!$('category-form').reportValidity())return;const old=data.categories.find(c=>c.id===$('category-edit').value),id=old?.id||'category-'+crypto.randomUUID(),name=$('category-name').value.trim(),parentId=$('category-parent').value||null,color=$('category-color').value,icon=$('category-icon').value;if(!name)return;
   const saved=await save(current=>SOPCategories.upsert(current,{id,name,parentId,color,icon}),'category-status');if(saved)renderEditor(id);
  };
  $('category-delete').onclick=async()=>{const id=$('category-edit').value;if(!id||busy)return;const saved=await save(current=>SOPCategories.remove(current,id),'category-status');if(saved)renderEditor();};
  $('assignment-form').onsubmit=async event=>{event.preventDefault();const id=target,destination=$('assignment-category').value||null;if(!id||busy)return;const saved=await save(current=>{if(!getContext().catalog.workflows.some(w=>w.id===id&&w.status==='published'))throw Error(t('changed'));return SOPCategories.assign(current,id,destination);},'assignment-status');if(saved)assignment.close();};
  for(const id of ['category-close','assignment-close'])$(id).onclick=()=>{if(!busy)close();};
  for(const d of [dialog,assignment])d.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('category-color').onchange=preview;$('category-icon').onchange=preview;styleChoices();
  return {update,close,translate,button(workflow){const b=document.createElement('button');b.type='button';b.className='assign-category';b.textContent=t('assign');b.setAttribute('aria-label',t('assign')+' · '+workflow.title);b.disabled=!available()||opening||busy;b.onclick=()=>openAssignment(workflow);return b;}};
 }};
})(globalThis);
