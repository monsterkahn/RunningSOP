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
 await assert.rejects(()=>Store.save(root,C.assign(data,'amazon','ops'),1),/已被其他窗口更新/);
 root.permission='prompt';await assert.rejects(()=>Store.save(root,C.assign(data,'amazon','ops'),2),/没有自动申请权限/);
 await assert.rejects(()=>Store.read(root),/允许读取/===false?undefined:/./);
 console.log('Category store tests passed: missing file, write permission, optimistic conflict, revisioned backup, verified write, and SOP isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
