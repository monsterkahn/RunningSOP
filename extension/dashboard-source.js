(function(root,factory){'use strict';const api=factory(root);root.SOPDashboardSource=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const MAX_TOTAL=32*1024*1024;
 const fail=message=>{throw Error(message);};
 async function readText(handle,path,limit=4*1024*1024){let dir=handle;const parts=path.split('/');for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part);const file=await(await dir.getFileHandle(parts.at(-1))).getFile();if(file.size>limit)fail('SOP file exceeds its read limit.');const raw=await file.text();if(new TextEncoder().encode(raw).length>limit)fail('SOP file exceeds its read limit.');return raw;}
 async function digest(raw){const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
 async function find(handle){const hits=[];for(const parts of [[],['SOP'],['sop'],['工作SOP','SOP']]){try{let dir=handle;for(const part of parts)dir=await dir.getDirectoryHandle(part);const file=await dir.getFileHandle('catalog.json');let duplicate=false;for(const hit of hits)if(typeof file.isSameEntry==='function'&&await file.isSameEntry(hit.file))duplicate=true;if(!duplicate)hits.push({handle:dir,file});}catch(error){if(error.name!=='NotFoundError')throw error;}}if(hits.length!==1)fail(hits.length?'Select one SOP folder; multiple catalogs were found.':'Select an SOP folder containing catalog.json.');return hits[0].handle;}
 async function readMetadata(handle){
  if(typeof handle?.queryPermission==='function'&&await handle.queryPermission({mode:'read'})!=='granted')fail('Read permission is required for the selected SOP folder.');
  const raw=await readText(handle,'catalog.json',512*1024),catalog=root.CatalogEngine.validateCatalog(JSON.parse(raw));let total=new TextEncoder().encode(raw).length;const nodes=[];
  for(const workflow of catalog.workflows){
   const body=await readText(handle,workflow.file);total+=new TextEncoder().encode(body).length;if(total>MAX_TOTAL)fail('SOP catalog and documents exceed 32 MiB.');
   if(await digest(body)!==workflow.sha256)fail('SOP document SHA-256 does not match: '+workflow.id);
   let parsed=JSON.parse(body);let stepCount;
   if(parsed.format==='runtime-sop-document')parsed=await root.SOPAssets.hydrate(parsed,workflow,async file=>{let dir=handle;const parts=file.split('/');for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part);const asset=await(await dir.getFileHandle(parts.at(-1))).getFile();if(asset.size>4*1024*1024)fail('SOP image exceeds 4 MiB.');total+=asset.size;if(total>MAX_TOTAL)fail('SOP catalog and assets exceed 32 MiB.');return new Uint8Array(await asset.arrayBuffer());});
   if(workflow.viewer==='guide'){
    // Guides and referenced assets are validated, then discarded; only this metadata is returned.
    const guide=root.CatalogEngine.validateGuide(parsed);
    if(guide.workflowId!==workflow.id)fail('SOP document identity does not match its catalog.');stepCount=guide.steps.length;
   }else{const verified=await root.SOPSync.verify(parsed);if(verified.workflowId!==workflow.id)fail('SOP document identity does not match its catalog.');stepCount=verified.config.steps.length;}
   nodes.push({id:workflow.id,title:workflow.title,stepCount});
  }
  // Detect a concurrent catalog update before accepting metadata from the chosen folder.
  if(await readText(handle,'catalog.json',512*1024)!==raw)fail('SOP catalog changed while loading; reload the folder.');
  return {nodes,catalogRaw:raw,catalogSha256:await digest(raw)};
 }
 return Object.freeze({readText,digest,find,readMetadata});
});
