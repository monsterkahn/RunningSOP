'use strict';
const assert=require('node:assert/strict');
const Store=require('../extension/category-store.js');
const C=require('../extension/category-engine.js');
class MemoryDir{
 constructor(name='root'){this.name=name;this.files=new Map();this.dirs=new Map();this.permission='granted';}
 async queryPermission(){return this.permission;}
 async getDirectoryHandle(name,{create}={}){if(!this.dirs.has(name)){if(!create){const e=Error('missing');e.name='NotFoundError';throw e;}this.dirs.set(name,new MemoryDir(name));}return this.dirs.get(name);}
 async getFileHandle(name,{create}={}){if(!this.files.has(name)){if(!create){const e=Error('missing');e.name='NotFoundError';throw e;}this.files.set(name,'');}const dir=this;return {getFile:async()=>{const raw=dir.files.get(name);return {size:new TextEncoder().encode(raw).length,text:async()=>raw};},createWritable:async()=>{let draft='';return {write:async raw=>{draft=String(raw);},close:async()=>dir.files.set(name,draft),abort:async()=>{}};}};}
}
const cat=(id,name)=>({id,name,color:'purple',icon:'briefcase',parentId:null});
(async()=>{
 const root=new MemoryDir();let data=await Store.read(root);assert.equal(data.format,'runtime-sop-categories');assert.equal(data.revision,0);
 const workflowFile=await root.getFileHandle('workflow.json',{create:true}),body='{"workflow":"untouched"}';const w=await workflowFile.createWritable();await w.write(body);await w.close();
 let next=C.upsert(data,cat('ops','运营'));data=await Store.save(root,next,0);assert.equal(data.revision,1);
 assert.equal(root.files.get('workflow.json'),body,'store must leave SOP body untouched');
 assert.equal(JSON.parse(root.files.get('categories.json')).categories[0].name,'运营');
 assert.equal(root.dirs.get('category-history'),undefined,'empty missing baseline needs no backup');
 next=C.assign(data,'youtube-upload','ops');data=await Store.save(root,next,1);assert.equal(data.revision,2);
 assert(root.dirs.get('category-history').files.has('revision-0000000001.json'),'previous category metadata must be preserved before overwrite');
 assert.deepEqual(await Store.read(root),data);
 for(const stage of ['backup verification','latest read','staged replacement']){
  const guardedRoot=new MemoryDir(),baseline=await Store.save(guardedRoot,C.upsert(C.empty(),cat('ops','Original')),0);
  guardedRoot.files.set('workflow.json',body);
  const originalRaw=guardedRoot.files.get('categories.json');let sourceCurrent=true,reads=0;
  const guard=async()=>{await Promise.resolve();if(!sourceCurrent)throw Error('Source changed');};
  if(stage==='backup verification'){
   const getDirectory=guardedRoot.getDirectoryHandle.bind(guardedRoot);
   guardedRoot.getDirectoryHandle=async(...args)=>{
    const history=await getDirectory(...args),getFile=history.getFileHandle.bind(history);
    history.getFileHandle=async(...fileArgs)=>{const handle=await getFile(...fileArgs),read=handle.getFile;handle.getFile=async()=>{const file=await read(),text=file.text;file.text=async()=>{const raw=await text();sourceCurrent=false;return raw;};return file;};return handle;};
    return history;
   };
  }else{
   const getFile=guardedRoot.getFileHandle.bind(guardedRoot);
   guardedRoot.getFileHandle=async(name,...args)=>{
    const handle=await getFile(name,...args);if(name!=='categories.json')return handle;
    if(stage==='latest read'){
     const read=handle.getFile;handle.getFile=async()=>{const file=await read(),text=file.text;file.text=async()=>{const raw=await text();if(++reads===2)sourceCurrent=false;return raw;};return file;};
    }else{
     const create=handle.createWritable;handle.createWritable=async(...options)=>{const writer=await create(...options),write=writer.write;writer.write=async raw=>{await write(raw);sourceCurrent=false;};return writer;};
    }
    return handle;
   };
  }
  await assert.rejects(()=>Store.save(guardedRoot,C.upsert(baseline,cat('ops','Replacement')),1,{guard}),/Source changed/,stage);
  assert.equal(guardedRoot.files.get('categories.json'),originalRaw,stage+' must preserve the previous main file');
  assert.equal(guardedRoot.files.get('workflow.json'),body,stage+' must preserve SOP body');
 }
 const rejectedRoot=new MemoryDir();let permissionReads=0;rejectedRoot.queryPermission=async()=>{permissionReads++;return 'granted';};
 await assert.rejects(()=>Store.save(rejectedRoot,C.upsert(C.empty(),cat('ops','Unused')),0,{guard:async()=>{throw Error('Source changed');}}),/Source changed/);
 assert.equal(permissionReads,0,'source guard must run at lock entry before permission access');
 assert.equal(rejectedRoot.files.size,0,'entry rejection must not create a shared file');
 const finalRoot=new MemoryDir();let finalSourceCurrent=true,finalReads=0;const finalGet=finalRoot.getFileHandle.bind(finalRoot);
 finalRoot.getFileHandle=async(name,...args)=>{const handle=await finalGet(name,...args);if(name==='categories.json'){const read=handle.getFile;handle.getFile=async()=>{const file=await read(),text=file.text;file.text=async()=>{const raw=await text();if(++finalReads===1)finalSourceCurrent=false;return raw;};return file;};}return handle;};
 // A missing baseline has no file reads until the committed file is verified.
 await assert.rejects(()=>Store.save(finalRoot,C.upsert(C.empty(),cat('ops','Committed')),0,{guard:async()=>{if(!finalSourceCurrent)throw Error('Source changed after verification');}}),/Source changed after verification/);
 assert.equal(JSON.parse(finalRoot.files.get('categories.json')).revision,1,'a committed file is retained, but a changed source cannot report success');
 await assert.rejects(()=>Store.save(root,C.assign(data,'amazon','ops'),1),/已被其他窗口更新/);
 root.permission='prompt';await assert.rejects(()=>Store.save(root,C.assign(data,'amazon','ops'),2),/没有自动申请权限/);
 await assert.rejects(()=>Store.read(root),/允许读取/===false?undefined:/./);
 console.log('Category store tests passed: missing file, write permission, optimistic conflict, revisioned backup, verified write, source guards, and SOP isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
