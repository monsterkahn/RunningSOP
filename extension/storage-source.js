(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.SOPStorageSource=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const KEY='runtime-sop-storage-source-v1',DB='runtime-sop-nas-publisher-v1',STORE='handles',HANDLE='publish-directory',RECORD='library-source',MAX_CATALOG=512*1024;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const fail=message=>{throw Error(message);};
function isEndpoint(value){return typeof value==='string'&&value.startsWith('sop-directory:');}
function validateEndpoint(value){if(typeof value!=='string'||!(new RegExp('^sop-directory://'+UUID+'/catalog\\.json$')).test(value))fail('文件夹连接标识无效，请重新选择文件夹。');return value;}
function safePath(value){if(typeof value!=='string'||!value||value.length>2048||/[\\%?#:\u0000-\u001f]/.test(value)||value.split('/').some(part=>!part||part==='.'||part==='..'))fail('文件路径无效。');return value;}
function resolve(endpoint,file){validateEndpoint(endpoint);return new URL(safePath(file),endpoint).href;}
function create(options={}){
 const win=options.window||root,engine=options.engine||root.CatalogEngine||(typeof require==='function'?require('./catalog-engine.js'):null),storage=options.storage||root.chrome?.storage?.local,idb=options.indexedDB||win.indexedDB||root.indexedDB;
 let queue=Promise.resolve();
 function openDb(){return new Promise((yes,no)=>{if(!idb)return no(Error('此浏览器不能保存文件夹授权。'));const r=idb.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});}
 async function getPair(){if(options.store)return options.store.get();const db=await openDb();return new Promise((yes,no)=>{const tx=db.transaction(STORE,'readonly'),s=tx.objectStore(STORE),a=s.get(HANDLE),b=s.get(RECORD);tx.oncomplete=()=>{db.close();yes({handle:a.result||null,record:b.result||null});};tx.onerror=tx.onabort=()=>{db.close();no(tx.error||Error('读取文件夹授权失败。'));};});}
 async function setPair(value){if(options.store)return options.store.set(value);const db=await openDb();return new Promise((yes,no)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);for(const [key,v]of [[HANDLE,value.handle],[RECORD,value.record]])if(v)s.put(v,key);else s.delete(key);tx.oncomplete=()=>{db.close();yes();};tx.onerror=tx.onabort=()=>{db.close();no(tx.error||Error('保存文件夹授权失败。'));};});}
 async function metadata(){if(!storage)return null;return (await storage.get(KEY))[KEY]||null;}
 async function permission(handle,mode){try{return await handle.queryPermission({mode});}catch{return 'unsupported';}}
 async function same(a,b){return Boolean(a&&b&&typeof a.isSameEntry==='function'&&await a.isSameEntry(b));}
 async function selected(){const [meta,pair]=await Promise.all([metadata(),getPair()]);if(!meta)return null;const endpoint=validateEndpoint('sop-directory://'+meta.id+'/catalog.json');if(!pair.handle||pair.record?.id!==meta.id||!(await same(pair.handle,pair.record.handle)))fail('文件夹连接已变化，请重新选择 SOP 文件夹。');return {meta,...pair,endpoint};}
 async function info(){const current=await selected();if(!current)return {selected:false,name:'',endpoint:'',readPermission:'missing',writePermission:'missing'};return {selected:true,name:current.meta.name||current.handle.name||'',endpoint:current.endpoint,readPermission:await permission(current.handle,'read'),writePermission:await permission(current.handle,'readwrite')};}
 async function getHandle(){return (await selected())?.handle||null;}
 async function readFile(handle,limit,binary=false){const file=await handle.getFile();if(!Number.isSafeInteger(file.size)||file.size<0||file.size>limit)fail('文件超过读取上限。');const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>limit)fail('文件超过读取上限。');return binary?bytes:new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 async function inspect(handle,expectedFile){
  const hits=[];for(const parts of [[],['SOP'],['sop'],['工作SOP','SOP']]){
   try{let dir=handle;for(const p of parts)dir=await dir.getDirectoryHandle(p);const file=await dir.getFileHandle('catalog.json');if(!hits.some(hit=>hit.path===parts.join('/')))hits.push({handle:dir,file,path:parts.join('/')});}
   catch(e){if(e.name!=='NotFoundError')throw e;}
  }
  if(!hits.length)fail('此文件夹中没有 SOP 内容库，请选择含 catalog.json 的文件夹。');
  let hit;if(expectedFile){const matches=[];for(const item of hits)if(await same(item.file,expectedFile))matches.push(item);if(matches.length!==1)fail('选择的文件夹不包含刚才的目录文件，请重新选择它所在的文件夹。');hit=matches[0];}
  else {if(hits.length!==1)fail('找到多个 SOP 内容库，请直接选择其中一个 SOP 文件夹。');hit=hits[0];}
  const raw=await readFile(hit.file,MAX_CATALOG);const catalog=engine.validateCatalog(JSON.parse(raw));return {...hit,catalog};
 }
 async function chooseFile(){
  if(!win.showOpenFilePicker)fail('此浏览器不支持文件选择，请选择 SOP 文件夹。');
  const picking=win.showOpenFilePicker({multiple:false,types:[{description:'SOP catalog.json',accept:{'application/json':['.json']}}]});
  const handles=await picking,handle=handles?.[0];if(!handle)fail('没有选择文件。');if(handle.name!=='catalog.json')fail('请选择内容库中的 catalog.json 文件。');const raw=await readFile(handle,MAX_CATALOG),catalog=engine.validateCatalog(JSON.parse(raw));return {handle,name:handle.name,catalog};
 }
 async function chooseDirectory({expectedFile}={}){
  if(!win.showDirectoryPicker||(!idb&&!options.store)||!storage)fail('此浏览器不支持文件夹选择，请使用 Chrome 扩展设置。');
  // Must precede all awaits: permission UI is authorized by this click only.
  const picking=win.showDirectoryPicker({mode:'read'}),chosen=await picking,hit=await inspect(chosen,expectedFile);
  const task=queue.catch(()=>{}).then(async()=>{
   const oldPair=await getPair(),oldMeta=await metadata(),id=(options.crypto||win.crypto||root.crypto).randomUUID(),name=hit.handle.name||chosen.name||'SOP';
   const record={id,name,handle:hit.handle};await setPair({handle:hit.handle,record});
   try{await storage.set({[KEY]:{id,name}});}catch(error){
    // Cross-store failures must not silently pair a new handle with old metadata.
    const now=await getPair();if(now.record?.id===id){await setPair(oldPair);if(oldMeta)await storage.set({[KEY]:oldMeta});else await storage.remove(KEY);}throw error;
   }
   const result=await selected();if(result?.meta.id!==id)fail('文件夹连接已变化，请重新选择 SOP 文件夹。');return {endpoint:result.endpoint,name,workflowCount:hit.catalog.workflows.length};
  });queue=task.catch(()=>{});return task;
 }
 async function read(url,{binary=false,limit=4*1024*1024}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>4*1024*1024)fail('读取上限无效。');let u;try{u=new URL(url);}catch{fail('文件夹连接标识无效，请重新选择文件夹。');}
  const endpoint='sop-directory://'+u.host+'/catalog.json';validateEndpoint(endpoint);if(u.username||u.password||u.search||u.hash)fail('文件路径无效。');let decoded;try{decoded=decodeURIComponent(u.pathname.slice(1));}catch{fail('文件路径无效。');}const relative=safePath(decoded),current=await selected();
  if(!current||current.endpoint!==endpoint)fail('文件夹连接已变化，请重新选择 SOP 文件夹。');if(await permission(current.handle,'read')!=='granted')fail('需要重新授权，请点击“选择 SOP 文件夹”。');
  let dir=current.handle;const parts=relative.split('/');for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p);const result=await readFile(await dir.getFileHandle(parts.at(-1)),limit,binary);
  const latest=await selected();if(!latest||latest.endpoint!==endpoint)fail('文件夹连接已变化，请重新选择 SOP 文件夹。');return result;
 }
 return {KEY,isEndpoint,validateEndpoint,resolve,chooseDirectory,chooseFile,info,getHandle,read};
}
return {...create(),create,KEY,isEndpoint,validateEndpoint,resolve};
});
