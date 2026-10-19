(function(root,factory){'use strict';const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.SOPFolderHistory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const MAX_BYTES=4*1024*1024,MAX_EVENTS=200,EVENT_BYTES=8192;
  const fail=message=>{throw Error(message);};
  const hashOK=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  const decoder=new TextDecoder('utf-8',{fatal:true});
  function create(dependencies={}) {
    const engine=dependencies.engine||root.CatalogEngine||(typeof require==='function'?require('./catalog-engine.js'):null);
    const assets=dependencies.assets||root.SOPAssets||(typeof require==='function'?require('./sop-assets.js'):null);
    const source=dependencies.source||root.SOPStorageSource;
    const sync=dependencies.catalogSync||root.CatalogSync;
    const fetcher=dependencies.fetch||root.fetch?.bind(root),cryptoObject=dependencies.crypto||root.crypto;
    function abort(signal){if(signal?.aborted)throw Object.assign(Error('历史读取已取消。'),{name:'AbortError'});}
    function validateWorkflow(workflow){
      if(!workflow||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(workflow.id)||workflow.viewer!=='guide'||!hashOK(workflow.sha256))fail('历史工作流身份无效。');
      safePath(workflow.file);return {...workflow};
    }
    function safePath(file){if(typeof file!=='string'||file.length>2048||!file||/[\\%?#:\u0000-\u001f]/.test(file)||file.split('/').some(p=>!p||p==='.'||p==='..'))fail('历史文件路径无效。');return file;}
    function directory(endpoint){return typeof endpoint==='string'&&endpoint.startsWith('sop-directory:');}
    async function context(options={}){
      abort(options.signal);
      const info=sync?await sync.info():null;
      const endpoint=options.endpoint||info?.settings?.endpoint;
      if(!endpoint)fail('尚未选择 SOP 内容库。');
      if(directory(endpoint)){if(!source)fail('文件夹读取器尚未加载。');source.validateEndpoint(endpoint);}else engine.validateEndpoint(endpoint);
      async function check(){
        abort(options.signal);
        if(sync&&(await sync.info()).settings?.endpoint!==endpoint)fail('内容库来源已变化，请重新打开历史。');
        if(directory(endpoint)){const current=await source.info();if(!current.selected||current.endpoint!==endpoint)fail('文件夹来源已变化，请重新打开历史。');}
        abort(options.signal);
      }
      // An absolute operation deadline also caps chains of individually bounded
      // file requests. Native directory reads cannot be aborted; their late
      // results are discarded by the check immediately after each read.
      const control=new AbortController(),relay=()=>control.abort();
      const originalSignal=options.signal;
      originalSignal?.addEventListener('abort',relay,{once:true});
      if(originalSignal?.aborted)control.abort();
      const timer=setTimeout(()=>control.abort(),30000);
      options={...options,signal:control.signal};
      const dispose=()=>{clearTimeout(timer);originalSignal?.removeEventListener('abort',relay);};
      try{await check();}catch(error){dispose();throw error;}
      return {endpoint,signal:control.signal,check,dispose};
    }
    async function bytes(ctx,file,limit=MAX_BYTES){
      safePath(file);await ctx.check();let data;
      if(directory(ctx.endpoint))data=await source.read(source.resolve(ctx.endpoint,file),{binary:true,limit,signal:ctx.signal});
      else {
        const base=new URL('./',engine.validateEndpoint(ctx.endpoint)),url=new URL(file,base);
        if(url.protocol!=='file:'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))fail('历史文件路径越界。');
        const control=new AbortController(),relay=()=>control.abort();ctx.signal?.addEventListener('abort',relay,{once:true});if(ctx.signal?.aborted)control.abort();
        const timer=setTimeout(()=>control.abort(),15000);
        try {
          const response=await fetcher(url.href,{cache:'no-store',credentials:'omit',redirect:'error',signal:control.signal});
          if(!response.ok){const e=Error('历史文件不可用 ('+response.status+')。');if(response.status===404)e.name='NotFoundError';throw e;}
          const length=response.headers?.get('content-length');if(length!==null&&length!==undefined&&Number(length)>limit)fail('历史文件超过读取上限。');
          const reader=response.body?.getReader();
          if(!reader)fail('历史文件无法进行有界读取。');
          const chunks=[];let size=0;
          try{while(true){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>limit)fail('历史文件超过读取上限。');chunks.push(result.value);}}
          catch(error){try{await reader.cancel();}catch(_){}throw error;}
          data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
        }finally{clearTimeout(timer);ctx.signal?.removeEventListener('abort',relay);}
      }
      if(!(data instanceof Uint8Array))data=new Uint8Array(data);
      if(data.length>limit)fail('历史文件超过读取上限。');await ctx.check();return data;
    }
    async function digest(raw){const result=await cryptoObject.subtle.digest('SHA-256',raw);return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('');}
    const docPath=(id,hash)=>`workflows/${id}/versions/${hash}.json`;
    async function document(ctx,workflow,hash,file){
      const raw=await bytes(ctx,file);if(await digest(raw)!==hash)fail('历史正文 SHA-256 不匹配。');await ctx.check();
      let parsed=JSON.parse(decoder.decode(raw));
      if(parsed?.format===assets.FORMAT)parsed=await assets.hydrate(parsed,workflow,path=>bytes(ctx,path),cryptoObject);
      const guide=engine.validateGuide(parsed);if(guide.workflowId!==workflow.id)fail('历史指南身份不匹配。');await ctx.check();return guide;
    }
    async function event(ctx,workflow,hash){
      let raw;try{raw=await bytes(ctx,`publication-history/${workflow.id}/${hash}.json`,EVENT_BYTES);}catch(error){
        // Chromium file:// misses can reject fetch with TypeError instead of a
        // 404 response. Treat only transport unavailability as an unknown tail;
        // parsing, size, permission and integrity failures still fail closed.
        if(error.name==='NotFoundError'||!directory(ctx.endpoint)&&error.name==='TypeError'){await ctx.check();return null;}
        throw error;
      }
      const value=JSON.parse(decoder.decode(raw));
      if(value?.format!=='runtime-sop-publication'||value.schemaVersion!==1||value.workflowId!==workflow.id||value.sha256!==hash||typeof value.version!=='string'||!value.version||value.version.length>64||!(value.previousSha256===null||hashOK(value.previousSha256))||!(value.publishedAt===null||typeof value.publishedAt==='string'&&value.publishedAt.length<=40&&Number.isFinite(Date.parse(value.publishedAt))))fail('发布历史记录无效。');
      return value;
    }
    async function list(input,options={}){
      const workflow=validateWorkflow(input),ctx=await context(options),limit=options.limit===undefined?20:options.limit;
      try {
      if(!Number.isInteger(limit)||limit<1||limit>50)fail('历史分页大小无效。');
      let offset=0;if(options.cursor){if(typeof options.cursor!=='string'||options.cursor.length>4096)fail('历史分页标识无效。');const c=JSON.parse(options.cursor);if(c.endpoint!==ctx.endpoint||c.workflowId!==workflow.id||c.head!==workflow.sha256||!Number.isInteger(c.offset)||c.offset<1||c.offset>=MAX_EVENTS)fail('历史分页来源已变化或标识无效。');offset=c.offset;}
      const items=[],seen=new Set();let hash=workflow.sha256,index=0,nextCursor=null,warning='';
      while(hash){
        if(seen.has(hash))fail('发布历史存在循环。');if(index>=MAX_EVENTS){warning='历史读取已达到 200 条上限。';break;}seen.add(hash);
        const record=await event(ctx,workflow,hash),current=hash===workflow.sha256;
        if(index>=offset){
          const file=current?workflow.file:docPath(workflow.id,hash);
          let version=record?.version||null;
          if(!record&&current)version=(await document(ctx,workflow,hash,file)).version;
          items.push({workflowId:workflow.id,sha256:hash,version,publishedAt:record?.publishedAt||null,previousSha256:record?.previousSha256||null,current,file,endpoint:ctx.endpoint,historyUnavailable:!record});
        }
        index++;hash=record?.previousSha256||null;
        if(!record){warning='此版本缺少发布历史记录；无法确定更早版本。';break;}
        if(items.length===limit&&hash){if(seen.has(hash))fail('发布历史存在循环。');if(index>=MAX_EVENTS)warning='历史读取已达到 200 条上限。';else nextCursor=JSON.stringify({endpoint:ctx.endpoint,workflowId:workflow.id,head:workflow.sha256,offset:index});break;}
      }
      await ctx.check();return {items,nextCursor,...(warning?{warning,warningCode:warning.includes('200')?'history-limit':'history-unavailable'}: {})};
      } finally {ctx.dispose();}
    }
    async function read(input,record,options={}){
      const workflow=validateWorkflow(input),ctx=await context(options);
      try {
      if(!record||record.workflowId!==workflow.id||!hashOK(record.sha256)||record.endpoint&&record.endpoint!==ctx.endpoint)fail('历史版本身份或来源无效。');
      const expected=record.sha256===workflow.sha256?workflow.file:docPath(workflow.id,record.sha256);
      if(record.file!==expected)fail('历史版本文件路径无效。');
      const guide=await document(ctx,workflow,record.sha256,expected);
      if(record.version&&guide.version!==record.version)fail('历史版本号与正文不匹配。');
      return guide;
      } finally {ctx.dispose();}
    }
    return {list,read};
  }
  return {...create(),create,MAX_EVENTS};
});
