'use strict';
(()=>{
const NS='http://www.w3.org/2000/svg',MAX=512*1024,$=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x)),templates=globalThis.SOPRelationNodeTemplates,svg=$('map'),wrap=$('map-wrap'),media=matchMedia('(prefers-reduced-motion: reduce)'),Engine=globalThis.SOPRelations,Store=globalThis.SOPRelationsStore,Adapter=globalThis.SOPDashboardSource;
const t=(key,vars)=>globalThis.DashboardI18n?.t(key,vars)??key;
globalThis.DashboardI18n.init();
const connectedMode=location.protocol==='chrome-extension:'&&new URLSearchParams(location.search).get('source')==='connected';
if(connectedMode)document.querySelector('.back-link').href='dashboard.html?source=connected';
let metadata=[],folderHandle=null,catalogRaw='',sourceEpoch=0,loading=false,saving=false,connectedBinding=null,draftOrigin=null;
let data={...Engine.empty(),nodes:[]},selected='',selectedEdge='',dirty=false,source='',wire=null,suppressClickUntil=0,motion=!media.matches,drag=null,pan=null,history=[],camera={x:0,y:0,w:1100,h:650},pending=null;
function object(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))throw Error(t('关系数据字段无效。'));}
function id(s){return typeof s==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(s);}
function readSeed(){if(!location.hash.startsWith('#seed='))return null;if(location.hash.length>MAX*3)throw Error(t('总表节点数据过大。'));const x=JSON.parse(decodeURIComponent(location.hash.slice(6)));object(x,['nodes','source']);if(x.source!=='dashboard')throw Error(t('总表节点来源无效。'));return validateMetadata(x.nodes);}
function validateMetadata(nodes){if(!Array.isArray(nodes)||nodes.length>500)throw Error(t('总表节点数量无效。'));const seen=new Set();for(const n of nodes){object(n,['id','title','stepCount']);if(!id(n.id)||seen.has(n.id)||typeof n.title!=='string'||!n.title.trim()||n.title.length>160||!Number.isSafeInteger(n.stepCount)||n.stepCount<0||n.stepCount>1000)throw Error(t('总表节点信息无效。'));seen.add(n.id);}return copy(nodes);}
function record(value=data){return {format:Engine.FORMAT,schemaVersion:1,revision:value.revision,updatedAt:value.updatedAt,name:value.name,nodes:value.nodes.map(n=>({workflowId:n.id,x:n.x,y:n.y})),edges:copy(value.edges)};}
function validate(value){Engine.validate(record(value));return copy(value);}
function fromRecord(value,nodes){const safe=Engine.validate(value),positions=new Map(safe.nodes.map(n=>[n.workflowId,n])),available=new Set(nodes.map(n=>n.id)),columns=nodes.length>80?20:4;return validate({...safe,nodes:nodes.map((n,i)=>({...n,x:positions.get(n.id)?.x??40+(i%columns)*185,y:positions.get(n.id)?.y??90+Math.floor(i/columns)*140})),edges:safe.edges.filter(e=>available.has(e.from)&&available.has(e.to))});}
try{const seed=readSeed(),embedded=$('relations-data');const snapshot=embedded?JSON.parse(embedded.textContent):null;metadata=seed??validateMetadata(snapshot?.nodes||[]);data=fromRecord(seed?Engine.empty():snapshot?.relations||Engine.empty(),metadata);selected=data.nodes[0]?.id||'';}catch(error){message(t('载入失败：')+error.message,'error');}
function message(s,kind=''){const n=$('status');n.textContent=t(s);n.className='status'+(kind?' '+kind:'');}
function node(id){return data.nodes.find(n=>n.id===id);}function make(tag,attrs={},content){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(content!==undefined)e.textContent=content;return e;}function btn(t,fn){const b=document.createElement('button');b.type='button';b.textContent=globalThis.DashboardI18n.t(t);b.onclick=fn;return b;}
function remember(snapshot=copy(data)){history.push(snapshot);if(history.length>30)history.shift();$('undo').disabled=!history.length;}
function changed(){dirty=true;updateSourceUI();}
function transact(fn){try{const draft=copy(data);fn(draft);const next=validate(draft);remember();data=next;changed();render();return true;}catch(e){message(e.message,'error');return false;}}
function point(event){const p=new DOMPoint(event.clientX,event.clientY);return p.matrixTransform(svg.getScreenCTM().inverse());}
function setCamera(){svg.setAttribute('viewBox',[camera.x,camera.y,camera.w,camera.h].join(' '));$('zoom-value').textContent=Math.round(svg.clientWidth/camera.w*100)+'%';updateMotion();}
function fit(){if(!data.nodes.length){camera={x:0,y:0,w:Math.max(350,svg.clientWidth),h:svg.clientHeight};setCamera();return;}const minX=Math.min(...data.nodes.map(n=>n.x))-75,minY=Math.min(...data.nodes.map(n=>n.y))-100,maxX=Math.max(...data.nodes.map(n=>n.x+160))+75,maxY=Math.max(...data.nodes.map(n=>n.y+76))+110,ratio=svg.clientWidth/svg.clientHeight;camera.w=Math.max(350,maxX-minX,(maxY-minY)*ratio);camera.h=camera.w/ratio;camera.x=(minX+maxX-camera.w)/2;camera.y=(minY+maxY-camera.h)/2;setCamera();}
function resetZoom(){const n=node(selected);camera.w=svg.clientWidth;camera.h=svg.clientHeight;const cx=svg.clientWidth<600&&n?n.x+80:data.nodes.length?(Math.min(...data.nodes.map(n=>n.x))+Math.max(...data.nodes.map(n=>n.x+160)))/2:camera.w/2;const cy=svg.clientWidth<600&&n?n.y+38:data.nodes.length?(Math.min(...data.nodes.map(n=>n.y))+Math.max(...data.nodes.map(n=>n.y+76)))/2:camera.h/2;camera.x=cx-camera.w/2;camera.y=cy-camera.h/2;setCamera();}
function focusNode(){const n=node(selected);if(!n){fit();return;}camera.w=Math.max(320,svg.clientWidth);camera.h=camera.w*svg.clientHeight/svg.clientWidth;camera.x=n.x+80-camera.w/2;camera.y=n.y+38-camera.h/2;setCamera();}
function curve(e){const a=node(e.from),b=node(e.to),right=b.x>=a.x+100;let x1=a.x+160,y1=a.y+38,x2=b.x,y2=b.y+38;if(!right){x1=a.x+80;y1=a.y+(b.y>a.y?76:0);x2=b.x+80;y2=b.y+(b.y>a.y?0:76);const m=(y1+y2)/2;return {d:`M${x1},${y1} C${x1},${m} ${x2},${m} ${x2},${y2}`,x:(x1+x2)/2,y:m};}const bend=Math.max(55,(x2-x1)*.5);return {d:`M${x1},${y1} C${x1+bend},${y1} ${x2-bend},${y2} ${x2},${y2}`,x:(x1+x2)/2,y:(y1+y2)/2};}
function paintEdges(){const layer=$('edges');layer.replaceChildren();for(const [i,e]of data.edges.entries()){const c=curve(e),g=make('g',{'data-edge':e.id});g.append(make('path',{d:c.d,class:'edge-hit','data-edge':e.id,role:'button',tabindex:0,'aria-label':'选择连线：'+node(e.from).title+' 到 '+node(e.to).title}),make('path',{d:c.d,class:'edge-line '+e.kind+(selectedEdge===e.id?' selected':''),'marker-end':'url(#arrow)'}));if(i<32)g.append(make('path',{d:c.d,class:'edge-glow '+e.kind,pathLength:100,style:'animation-delay:-'+i*.7+'s'}));if(e.label){const width=Math.min(270,[...e.label].length*11+20);g.append(make('rect',{x:c.x-width/2,y:c.y-12,width,height:23,rx:6,class:'edge-label-bg'}),make('text',{x:c.x,y:c.y+3,class:'edge-label'},e.label));}layer.append(g);}updateMotion();}
function paintNodes(){const layer=$('nodes');layer.replaceChildren();for(const[nIndex,n]of data.nodes.entries()){const template=Object.prototype.hasOwnProperty.call(templates,n.id)?templates[n.id]:templates.lead;const g=make('g',{'data-node':n.id,transform:`translate(${n.x} ${n.y})`,class:'node-wrap'+(n.id===selected?' selected':'')+(n.id===source?' source-node':''),role:'group','aria-label':t('{title}，{count} 个步骤',{title:n.title,count:n.stepCount})});const native=make('g',{class:'native',transform:`translate(${-template.x} ${-template.y})`});const doc=new DOMParser().parseFromString('<svg xmlns="'+NS+'">'+template.markup+'</svg>','image/svg+xml'),imported=doc.documentElement.firstElementChild;imported.removeAttribute('id');imported.removeAttribute('aria-label');imported.removeAttribute('data-node-id');imported.removeAttribute('data-node-label');imported.removeAttribute('tabindex');imported.removeAttribute('role');imported.removeAttribute('aria-pressed');imported.querySelector('title').textContent=n.title;imported.querySelector('text[data-node-label]').textContent=n.title.length>12?n.title.slice(0,11)+'…':n.title;imported.querySelector('text[data-detail]').textContent=t('{count} 个步骤',{count:n.stepCount});native.append(imported);g.append(native,make('title',{},n.title+' · '+t('{count} 个步骤',{count:n.stepCount})));const grip=make('g',{class:'drag-grip',role:'button',tabindex:0,'aria-label':'移动 '+n.title+'，使用方向键微调','data-grip':n.id});grip.append(make('rect',{x:132,y:5,width:24,height:22,rx:4,class:'grip-bg'}));for(const y of [11,16,21])for(const x of [139,145])grip.append(make('circle',{cx:x,cy:y,r:1.1,fill:'currentColor'}));g.append(grip);for(const[port,x]of [['in',0],['out',160]]){const pg=make('g',{class:'port-group',role:'button',tabindex:0,'aria-label':(port==='out'?'从此 SOP 连接：':'连接到此 SOP：')+n.title,'data-port':port,'data-owner':n.id});pg.append(make('circle',{cx:x,cy:38,r:12,class:'port-hit'}),make('circle',{cx:x,cy:38,r:4.5,class:'port port-'+port}));g.append(pg);}layer.append(g);}}
function choose(id){selected=id;selectedEdge='';$('nodes').querySelectorAll('[data-node]').forEach(g=>g.classList.toggle('selected',g.dataset.node===id));renderInspector();$('delete-link').disabled=true;}
function options(select,skip){const previous=select.value;select.replaceChildren();for(const n of data.nodes){if(n.id===skip)continue;const o=document.createElement('option');o.value=n.id;o.textContent=n.title;select.append(o);}if([...select.options].some(o=>o.value===previous))select.value=previous;}
function renderInspector(){const n=node(selected);for(const id of ['position','focus-node','add-link'])$(id).disabled=!n;if(!n){$('selected-title').textContent=t('暂无 SOP');$('selected-count').textContent=t('0 个节点');$('node-x').value='';$('node-y').value='';$('from').replaceChildren();$('to').replaceChildren();$('link-list').textContent=t('返回总表选择包含 SOP 的目录后，再打开关系图。');return;}$('selected-title').textContent=n.title;$('selected-count').textContent=t('{count} 个步骤',{count:n.stepCount});$('node-x').value=Math.round(n.x);$('node-y').value=Math.round(n.y);options($('from'));$('from').value=selected;options($('to'),selected);const list=$('link-list');list.replaceChildren();const outgoing=data.edges.filter(e=>e.from===selected);for(const e of outgoing){const row=document.createElement('div');row.className='link-item';const text=document.createElement('span');text.textContent=(e.kind==='next'?t('下一项'):'ISSUE · '+e.label)+' → '+node(e.to).title;const remove=btn('×',()=>transact(d=>{d.edges=d.edges.filter(x=>x.id!==e.id);}));remove.setAttribute('aria-label','删除到 '+node(e.to).title+' 的连接');row.append(text,remove);list.append(row);}if(!outgoing.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=t('还没有后续连接');list.append(empty);}}
function render(){if(!node(selected))selected=data.nodes[0]?.id||'';$('map-title').textContent=data.name==='SOP relationships'?t('SOP 关系图'):data.name;$('meta').textContent=t('{nodes} 份 SOP · {edges} 条连接',{nodes:data.nodes.length,edges:data.edges.length});paintEdges();paintNodes();if(!data.nodes.length)$('nodes').append(make('text',{x:40,y:150,fill:'#89a2bc','font-size':18},t('当前总表没有 SOP')));renderInspector();updateSourceUI();$('undo').disabled=!history.length;updateConnectionStyle();updateMotion();}
function updateMotion(){wrap.classList.toggle('paused',!motion||media.matches||document.hidden||!!drag||!!wire);$('motion').setAttribute('aria-pressed',String(motion&&!media.matches));$('motion').textContent=media.matches?t('已减少动态效果'):motion?t('流光动画 · 开'):t('流光动画 · 关');}
function connectTo(target){if(!source){source=target;choose(target);paintNodes();message('已选择起点：'+node(source).title+'。现在点击目标 SOP。');return;}const from=source,to=target;const kind=$('kind').value,label=kind==='issue'?$('condition').value.trim():'';if(kind==='issue'&&!label){message('请先填写右侧的 ISSUE 触发条件。','error');return;}if(transact(d=>d.edges.push({id:'edge-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,8),from,to,kind,label}))){source='';paintNodes();message('已添加连接。节点的位置不会决定流程顺序。');}}
function moved(n,x,y){n.x=Math.max(20,Math.min(3800,x));n.y=Math.max(20,Math.min(3800,y));const g=$('nodes').querySelector('[data-node="'+n.id+'"]');g.setAttribute('transform',`translate(${n.x} ${n.y})`);paintEdges();$('node-x').value=Math.round(n.x);$('node-y').value=Math.round(n.y);}
svg.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;suppressClickUntil=0;const out=e.target.closest('[data-port=out]');if(out){e.preventDefault();const from=out.dataset.owner;source=from;choose(from);wire={from,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false};out.setPointerCapture(e.pointerId);$('nodes').querySelectorAll('[data-node]').forEach(g=>g.classList.toggle('source-node',g.dataset.node===from));updateMotion();return;}const grip=e.target.closest('[data-grip]');if(grip){e.preventDefault();e.stopPropagation();const n=node(grip.dataset.grip),p=point(e);choose(n.id);drag={id:n.id,pointer:e.pointerId,offsetX:p.x-n.x,offsetY:p.y-n.y,original:copy(data),moved:false,grip};grip.setPointerCapture(e.pointerId);grip.classList.add('dragging');updateMotion();return;}if(e.target.closest('[data-node],[data-edge]'))return;pan={pointer:e.pointerId,clientX:e.clientX,clientY:e.clientY,x:camera.x,y:camera.y};svg.setPointerCapture(e.pointerId);});
svg.addEventListener('pointermove',e=>{if(wire&&wire.pointer===e.pointerId){if(Math.hypot(e.clientX-wire.startX,e.clientY-wire.startY)>4)wire.moved=true;if(wire.moved){const p=point(e),n=node(wire.from);let line=$('wire-preview');if(!line){line=make('path',{id:'wire-preview',class:'wire-preview'});svg.insertBefore(line,$('nodes'));}const x=n.x+160,y=n.y+38,bend=Math.max(40,Math.abs(p.x-x)*.5);line.setAttribute('d',`M${x},${y} C${x+bend},${y} ${p.x-bend},${p.y} ${p.x},${p.y}`);}return;}if(drag&&drag.pointer===e.pointerId){const p=point(e),n=node(drag.id);if(Math.abs(p.x-drag.offsetX-n.x)+Math.abs(p.y-drag.offsetY-n.y)>2)drag.moved=true;moved(n,p.x-drag.offsetX,p.y-drag.offsetY);}else if(pan&&pan.pointer===e.pointerId){camera.x=pan.x-(e.clientX-pan.clientX)*camera.w/svg.clientWidth;camera.y=pan.y-(e.clientY-pan.clientY)*camera.h/svg.clientHeight;setCamera();}});
function endDrag(e,cancel=false){if(wire&&wire.pointer===e.pointerId){const old=wire,target=document.elementFromPoint(e.clientX,e.clientY),owner=target?.closest('[data-owner]')?.dataset.owner||target?.closest('[data-node]')?.dataset.node;cancelWire(false);suppressClickUntil=performance.now()+300;if(cancel){source='';paintNodes();return;}source=old.from;if(old.moved){if(owner)connectTo(owner);else{source='';paintNodes();message('未连接到目标 SOP，连线已取消。');}}else{paintNodes();message('已选择起点。点击目标 SOP 左侧的圆点完成连接，Esc 取消。');}return;}if(drag&&drag.pointer===e.pointerId){const old=drag;drag=null;old.grip.classList.remove('dragging');if(cancel){data=old.original;render();}else if(old.moved){remember(old.original);changed();message('已调整位置，流程连接保持不变。');}updateMotion();}if(pan&&pan.pointer===e.pointerId)pan=null;}
function cancelWire(clear=true){wire=null;$('wire-preview')?.remove();if(clear)source='';updateMotion();}
svg.addEventListener('pointerup',e=>endDrag(e));svg.addEventListener('pointercancel',e=>endDrag(e,true));svg.addEventListener('lostpointercapture',e=>endDrag(e,true));
svg.addEventListener('click',e=>{if(performance.now()<suppressClickUntil)return;const port=e.target.closest('[data-port]');if(port){if(port.dataset.port==='out'){source=port.dataset.owner;choose(source);paintNodes();updateConnectionStyle();message('已选择起点，点击目标 SOP 左侧的圆点完成连接；Esc 取消。');}else if(source)connectTo(port.dataset.owner);else message('先点击起点右侧圆点，或从那里拖线。');return;}if(e.target.closest('[data-grip]'))return;const n=e.target.closest('[data-node]');if(n){if(source)connectTo(n.dataset.node);else choose(n.dataset.node);return;}const edge=e.target.closest('[data-edge]');if(edge)selectEdge(edge.dataset.edge);});
function selectEdge(id){const picked=data.edges.find(e=>e.id===id);if(!picked)return;choose(picked.from);selectedEdge=id;paintEdges();$('delete-link').disabled=false;message('已选中：'+node(picked.from).title+' → '+node(picked.to).title+'。点击“删除连线”或按 Delete 删除。');}
function deleteSelected(){if(!selectedEdge)return;const id=selectedEdge;if(transact(d=>{d.edges=d.edges.filter(e=>e.id!==id);})){selectedEdge='';$('delete-link').disabled=true;message('连线已删除，可撤销恢复。');}}
function updateConnectionStyle(){wrap.classList.add('connecting');$('delete-link').disabled=!data.edges.some(e=>e.id===selectedEdge);}
svg.addEventListener('keydown',e=>{const hit=e.target.closest('.edge-hit');if(hit&&['Enter',' '].includes(e.key)){e.preventDefault();selectEdge(hit.dataset.edge);return;}const grip=e.target.closest('[data-grip]'),port=e.target.closest('[data-port]');if(port&&['Enter',' '].includes(e.key)){e.preventDefault();port.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}if(!grip||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const n=node(grip.dataset.grip),amount=e.shiftKey?10:1;remember();moved(n,n.x+({ArrowLeft:-amount,ArrowRight:amount}[e.key]||0),n.y+({ArrowUp:-amount,ArrowDown:amount}[e.key]||0));changed();choose(n.id);});
$('delete-link').onclick=deleteSelected;
$('motion').onclick=()=>{motion=!motion;updateMotion();};media.addEventListener('change',updateMotion);document.addEventListener('visibilitychange',updateMotion);
document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;if(e.key==='Escape'){source='';cancelWire();paintNodes();updateMotion();message('已取消连接。');}if(['Delete','Backspace'].includes(e.key)&&selectedEdge){e.preventDefault();deleteSelected();}});
$('kind').onchange=()=>{const issue=$('kind').value==='issue';$('condition').hidden=!issue;$('condition-label').hidden=!issue;};$('from').onchange=()=>{selected=$('from').value;choose(selected);};
$('add-link').onclick=()=>{const from=$('from').value,to=$('to').value,kind=$('kind').value,label=kind==='issue'?$('condition').value.trim():'';if(transact(d=>d.edges.push({id:'edge-'+Date.now().toString(36),from,to,kind,label})))message('已添加有向连接。');};
$('position').onclick=()=>{const x=Number($('node-x').value),y=Number($('node-y').value);transact(d=>{const n=d.nodes.find(n=>n.id===selected);n.x=x;n.y=y;});};$('focus-node').onclick=focusNode;
$('zoom-value').onclick=resetZoom;
$('undo').onclick=()=>{if(!history.length)return;data={...history.pop(),revision:data.revision,updatedAt:data.updatedAt};source='';changed();render();message('已撤销上一步。');};$('fit').onclick=fit;
function zoom(factor){const oldW=camera.w;camera.w=Math.max(240,Math.min(6000,camera.w*factor));const oldH=camera.h;camera.h=camera.w*svg.clientHeight/svg.clientWidth;camera.x+=(oldW-camera.w)/2;camera.y+=(oldH-camera.h)/2;setCamera();}$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);
$('export').onclick=()=>{const raw=JSON.stringify(Engine.validate(record()),null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='sop-relations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已导出节点、位置和连线；文件不含 SOP 正文。','ok');};
$('import').onclick=()=>{$('file').value='';$('file').click();};$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>MAX)throw Error(t('关系数据超过 512 KiB。'));const imported=Engine.validate(JSON.parse(await f.text()));const available=new Set(metadata.map(n=>n.id));if(imported.nodes.some(n=>!available.has(n.workflowId)))throw Error(t('导入包含当前目录中不存在的 SOP。'));pending=fromRecord(imported,metadata);$('import-dialog').showModal();}catch(e){pending=null;message('导入失败：'+e.message,'error');}};
$('import-cancel').onclick=()=>{pending=null;$('import-dialog').close();};$('import-confirm').onclick=()=>{if(!pending)return;remember();data={...pending,revision:data.revision,updatedAt:data.updatedAt};pending=null;selected=data.nodes[0]?.id||'';source='';changed();$('import-dialog').close();render();fit();message('已导入脑图，请核对后保存。');};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

function updateSourceUI(){
 $('save').disabled=!folderHandle||saving||loading;
 $('save').textContent=t(saving?'正在保存…':'保存到 SOP 文件夹')+(dirty?' ·':'');
 $('choose-folder').disabled=saving||loading;$('reload-folder').disabled=!folderHandle||saving||loading;
 $('use-connected').disabled=saving||loading;
 $('folder-state').textContent=folderHandle?t('已连接 {name} · 修订 {revision}',{name:folderHandle.name||'SOP',revision:data.revision}):t('尚未连接文件夹。可编辑和导出，保存共享关系前请明确选择 SOP 文件夹。');
}
async function selectedConnection(){
 const source=globalThis.SOPStorageSource,saved=await chrome.storage.local.get(['runtime-sop-catalog-settings-v1','runtime-sop-team-settings-v1']);
 const info=await source.info(),handle=await source.getHandle(),endpoint=saved['runtime-sop-catalog-settings-v1']?.endpoint;
 if(saved['runtime-sop-team-settings-v1']?.enabled||!info.selected||info.endpoint!==endpoint||!source.isEndpoint(endpoint)||!handle)throw Error(t('尚未配置 SOP 文件夹。'));
 if(await handle.queryPermission({mode:'read'})!=='granted')throw Error(t('当前没有该目录的读取授权；请重新选择文件夹并授权。'));
 return {handle,endpoint};
}
async function assertConnection(binding){
 if(!binding)return;
 const current=await selectedConnection();
 if(current.endpoint!==binding.endpoint||!await current.handle.isSameEntry(binding.handle))throw Error(t('SOP 来源已变化，请重新读取。'));
}
async function connectSelected(){
 const epoch=sourceEpoch,binding=await selectedConnection();
 if(epoch!==sourceEpoch)throw Error(t('SOP 来源已变化，请重新读取。'));
 if(dirty&&draftOrigin&&!await draftOrigin.isSameEntry(binding.handle))throw Error(t('SOP 来源已变化，请重新读取。'));
 return loadFolder(binding.handle,{preserveDraft:true,binding});
}
async function loadFolder(handle,{preserveDraft=false,binding=null}={}){
 if(preserveDraft&&!draftOrigin)draftOrigin=handle;
 const epoch=++sourceEpoch;loading=true;updateSourceUI();
 try{
  await assertConnection(binding);
  const nextMetadata=await Adapter.readMetadata(handle),relations=await Store.read(handle);
  await assertConnection(binding);
  if(sourceEpoch!==epoch)throw Error(t('SOP 来源已变化，请重新读取。'));
  let nextData=fromRecord(relations,nextMetadata.nodes);
  const keep=preserveDraft&&dirty;
  if(keep){
   const available=new Set(nextMetadata.nodes.map(n=>n.id));
   if(metadata.length!==available.size||metadata.some(n=>!available.has(n.id)))throw Error(t('SOP 来源已变化，请重新读取。'));
   if(relations.revision!==data.revision)throw Error(t('共享关系已更新；当前连线已保留，请重新读取并核对后再保存。'));
   nextData=fromRecord({...record(),revision:relations.revision,updatedAt:relations.updatedAt},nextMetadata.nodes);
  }
  // Commit a new source only after both its catalog and relationship file validate.
  folderHandle=handle;draftOrigin=handle;connectedBinding=binding;catalogRaw=nextMetadata.catalogRaw;metadata=nextMetadata.nodes;data=nextData;
  selected=data.nodes[0]?.id||'';selectedEdge='';source='';cancelWire();if(!keep)history=[];dirty=keep;render();resetZoom();
  message('已核验所选目录。布局和连线只会在明确保存后写入共享关系文件。','ok');
 }finally{if(sourceEpoch===epoch){loading=false;updateSourceUI();}}
}
$('choose-folder').addEventListener('click',async()=>{
 if(!window.showDirectoryPicker){message('此浏览器不支持文件夹选择，请使用 Chrome。','error');return;}
 if(dirty&&!confirm(t('未保存的布局将被新目录替换，是否继续？')))return;
 try{const picking=window.showDirectoryPicker({mode:'read'});const chosen=await picking;await loadFolder(await Adapter.find(chosen));}catch(error){message(error.message,'error');}
});
$('reload-folder').addEventListener('click',async()=>{
 if(!folderHandle)return;if(dirty&&!confirm(t('重新读取会放弃当前未保存的布局，是否继续？')))return;
 try{await loadFolder(folderHandle,{binding:connectedBinding});}catch(error){message(error.message,'error');}
});
$('use-connected').hidden=!globalThis.chrome?.storage?.local;
$('use-connected').addEventListener('click',async()=>{
 try{await connectSelected();}catch(error){message(error.message,'error');}
});
$('save').addEventListener('click',()=>{
 if(!folderHandle||saving||loading){message('保存前请明确选择 SOP 文件夹。','error');return;}
 const handle=folderHandle,epoch=sourceEpoch,expectedCatalog=catalogRaw,expectedRevision=data.revision,binding=connectedBinding;
 let permission;
 // Request write permission in this synchronous click dispatch, before any await.
 try{permission=typeof handle.requestPermission==='function'?handle.requestPermission({mode:'readwrite'}):handle.queryPermission({mode:'readwrite'});}catch(error){message(error.message,'error');return;}
 const snapshot=record();snapshot.revision=expectedRevision+1;snapshot.updatedAt=new Date().toISOString();
 saving=true;updateSourceUI();
 const guard=async()=>{
  if(folderHandle!==handle||sourceEpoch!==epoch||loading)throw Error(t('SOP 来源已变化，已停止保存。'));
  await assertConnection(binding);
  if(await Adapter.readText(handle,'catalog.json',512*1024)!==expectedCatalog)throw Error(t('目录已变化，请重新读取后再保存。'));
  if(folderHandle!==handle||sourceEpoch!==epoch||loading)throw Error(t('SOP 来源已变化，已停止保存。'));
 };
 (async()=>{try{
  if(await permission!=='granted')throw Error(t('没有写入授权；共享文件未保存。'));
  const verified=await Store.save(handle,Engine.validate(snapshot),expectedRevision,{guard});
  await guard();
  const unchanged=JSON.stringify({...record(),revision:snapshot.revision,updatedAt:snapshot.updatedAt})===JSON.stringify(snapshot);
  data.revision=verified.revision;data.updatedAt=verified.updatedAt;dirty=!unchanged;
  message('共享关系已保存并回读核验；SOP 正文和目录未修改。','ok');
 }catch(error){message(error.message,'error');}finally{saving=false;updateSourceUI();}})();
});
globalThis.DashboardI18n.subscribe(()=>{document.title=t('Running SOP · SOP 关系图');render();});
document.title=t('Running SOP · SOP 关系图');
window.addEventListener('hashchange',()=>{
 try{const nodes=readSeed();if(nodes===null)return;sourceEpoch++;folderHandle=null;connectedBinding=null;draftOrigin=null;catalogRaw='';loading=false;metadata=nodes;data=fromRecord(Engine.empty(),nodes);history=[];dirty=false;selected=data.nodes[0]?.id||'';selectedEdge='';source='';cancelWire();render();resetZoom();message('保存前请明确选择 SOP 文件夹。');if(connectedMode)connectSelected().catch(error=>message(error.message,'error'));}catch(error){message(error.message,'error');}
});
if(connectedMode)chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local'||!(changes['runtime-sop-catalog-settings-v1']||changes['runtime-sop-team-settings-v1']||changes[globalThis.SOPStorageSource.KEY]))return;
 sourceEpoch++;folderHandle=null;connectedBinding=null;catalogRaw='';loading=false;updateSourceUI();message('SOP 来源已变化，请重新读取。','error');
});
let previousWidth=svg.clientWidth;new ResizeObserver(()=>{const scale=previousWidth>0?previousWidth/camera.w:1,oldW=camera.w,oldH=camera.h;camera.w=svg.clientWidth/scale;camera.h=svg.clientHeight/scale;camera.x+=(oldW-camera.w)/2;camera.y+=(oldH-camera.h)/2;previousWidth=svg.clientWidth;setCamera();}).observe(wrap);render();requestAnimationFrame(resetZoom);if(connectedMode)connectSelected().catch(error=>message(error.message,'error'));
})();
