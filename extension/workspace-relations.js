(function(root){
 'use strict';
 // Relations are optional folder data. Never infer them from URL matching or team caches.
 const cancelled=()=>Object.assign(new Error('Reading changed'),{code:'aborted'});
 async function load({endpoint,snapshot,workflowId,alive}){
  const source=root.SOPStorageSource,sync=root.CatalogSync,engine=root.CatalogEngine;
  if(!root.SOPRelationsStore||!root.SOPRelations||!source.isEndpoint(endpoint)||!snapshot||snapshot.endpoint!==endpoint)return null;
  const handle=await source.getHandle();if(!handle)return null;
  async function guard(){
   if(!alive())throw cancelled();
   const [settings,info,current,latest]=await Promise.all([sync.getSettings(),source.info(),source.getHandle(),sync.loadSnapshot()]);
   if(!alive()||settings.endpoint!==endpoint||!info.selected||info.endpoint!==endpoint||!current||!await current.isSameEntry(handle)||latest?.rawCatalog!==snapshot.rawCatalog)throw cancelled();
   if(!alive())throw cancelled();
  }
  const read=async(file,options={})=>{await guard();const raw=await source.read(source.resolve(endpoint,file),options);await guard();return raw;};
  await guard();
  // A cached catalog alone does not establish that this folder is readable now.
  if(await read('catalog.json',{limit:512*1024})!==snapshot.rawCatalog)throw cancelled();
  const relations=await root.SOPRelationsStore.read(handle);await guard();
  const available=snapshot.catalog.workflows.filter(item=>item.status==='published'&&item.viewer==='guide');
  const id=root.SOPRelations.next(relations,workflowId,available.map(item=>item.id));if(!id)return null;
  const workflow=available.find(item=>item.id===id),raw=await read(workflow.file,{limit:4*1024*1024});
  const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(hash!==workflow.sha256)throw Error('SOP integrity mismatch');
  let data=JSON.parse(raw);
  if(data.format==='runtime-sop-document')data=await root.SOPAssets.hydrate(data,workflow,file=>read(file,{limit:4*1024*1024,binary:true}));
  const guide=engine.validateGuide(data);if(guide.workflowId!==workflow.id)throw Error('SOP identity mismatch');
  await guard();
  if(await read('catalog.json',{limit:512*1024})!==snapshot.rawCatalog||JSON.stringify(await root.SOPRelationsStore.read(handle))!==JSON.stringify(relations))throw cancelled();
  await guard();
  const workUrl=guide.steps.find(step=>step.workUrl)?.workUrl||'';
  const url=workUrl?root.RunningSOPTeamClient.sanitizeWorkURL(workUrl):'';
  return {workflow,guide,workUrl,url,endpoint,rawCatalog:snapshot.rawCatalog};
 }
 root.SOPWorkspaceRelations=Object.freeze({load});
})(globalThis);
