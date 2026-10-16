(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.MobileSOPReader=api;api.start();}
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const MAX_CATALOG=512*1024,MAX_FILE=4*1024*1024,MAX_TOTAL=9*1024*1024;
  const fail=message=>{throw Error(message);};
  function catalogURL(path,pageURL){
    if(typeof path!=='string'||!path||path.length>512||path.startsWith('/')||/[\\%?#:\u0000-\u0020]/.test(path)||path.split('/').some(x=>x==='..'||!x)||!path.endsWith('catalog.json'))fail('目录必须是阅读器所在目录内的相对 catalog.json 路径。');
    const page=new URL(pageURL),url=new URL(path,page);
    if(!['http:','https:'].includes(page.protocol)||page.username||page.password)fail('请通过存储器的 HTTP(S) 手机阅读地址打开此页面。');
    if(url.origin!==page.origin||!url.pathname.startsWith(new URL('./',page).pathname))fail('目录不能超出阅读器所在目录。');
    return url.href;
  }
  function contentURL(base,path){
    if(typeof path!=='string'||!path||path.startsWith('/')||/[\\%?#:\u0000-\u001f]/.test(path)||path.split('/').some(x=>!x||x==='.'||x==='..'))fail('正文或图片路径无效。');
    const folder=new URL('./',base),url=new URL(path,folder);
    if(url.origin!==folder.origin||!url.pathname.startsWith(folder.pathname))fail('正文或图片超出目录。');
    return url.href;
  }
  async function readLimited(response,max){
    if(!response.ok)fail('读取失败（HTTP '+response.status+'），请检查地址、网络和访问权限。');
    if(Number(response.headers.get('content-length'))>max)fail('内容超过读取上限。');
    if(!response.body){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>max)fail('内容超过读取上限。');return bytes;}
    const reader=response.body.getReader(),parts=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max)fail('内容超过读取上限。');parts.push(part.value);}}
    catch(error){await reader.cancel().catch(()=>{});throw error;}
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
  }
  const text=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  async function loadWorkflow(options){
    const {id,url,signal}=options,fetcher=options.fetch||root.fetch,nativeCrypto=options.crypto||root.crypto,cryptoObject=(options.integrity||root.ReaderIntegrity).adapter(nativeCrypto);
    const engine=options.catalogEngine||root.CatalogEngine,assets=options.assets||root.SOPAssets,remote=options.remote||root.RemoteContent,sync=options.sync||root.SOPSync;
    if(typeof id!=='string'||!(/^[a-z0-9][a-z0-9-]{0,79}$/).test(id))fail('链接缺少有效 SOP ID，请重新扫描该 SOP 的二维码。');
    const endpoint=new URL(url);if(!['https:','http:'].includes(endpoint.protocol)||endpoint.username||endpoint.password||endpoint.hash||endpoint.search)fail('目录地址无效。');
    let total=0;
    async function read(href,max){const bytes=await readLimited(await fetcher(href,{cache:'no-store',credentials:'same-origin',redirect:'error',signal}),max);total+=bytes.length;if(total>MAX_TOTAL)fail('目录、正文和图片合计超过读取上限。');return bytes;}
    const catalog=engine.validateCatalog(JSON.parse(text(await read(endpoint.href,MAX_CATALOG))));
    const workflow=catalog.workflows.find(w=>w.id===id);if(!workflow)fail('此 SOP 已移除或当前存储器中不存在，请向维护者确认。');
    const raw=await read(contentURL(url,workflow.file),MAX_FILE);
    const digest=Array.from(new Uint8Array(await cryptoObject.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==workflow.sha256)fail('SOP 正文 SHA-256 不匹配，请重试或联系维护者。');
    let parsed=JSON.parse(text(raw));if(parsed.format==='runtime-sop-document')parsed=await assets.hydrate(parsed,workflow,file=>read(contentURL(url,file),MAX_FILE),cryptoObject);
    let guide;
    if(workflow.viewer==='guide'){guide=engine.validateGuide(parsed);if(guide.workflowId!==workflow.id)fail('SOP 正文身份与目录不匹配。');}
    else {
      let bundle=remote.validateBundle(parsed);if(nativeCrypto?.subtle)bundle=await sync.verify(bundle);else{const revision=Array.from(new Uint8Array(await cryptoObject.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(remote.contentParts(bundle))))),b=>b.toString(16).padStart(2,'0')).join('');if(revision!==bundle.revision)fail('YouTube 内容包版本指纹不匹配。');}if(bundle.workflowId!==workflow.id)fail('YouTube 正文身份与目录不匹配。');
      guide={workflowId:workflow.id,title:workflow.title,version:bundle.contentVersion||bundle.config.version,notice:'YouTube SOP：已校验发布内容；网页匹配不代表业务结果。',steps:bundle.config.steps.map(s=>({id:s.id,title:s.title,where:s.locationHint,actions:s.actions,expected:(s.outputs||[]).join('\n'),acceptance:s.acceptance||[],trouble:s.gateHint||'',issues:[],...(s.id==='YT03'?{image:'data:'+bundle.assets.studioScreenshot.mimeType+';base64,'+bundle.assets.studioScreenshot.data}:{})}))};
    }
    return {catalog,workflow,guide,source:endpoint.href};
  }
  function start(){
    const doc=root.document,$=id=>doc.getElementById(id);if(!$('steps'))return;
    const make=(tag,value,cls)=>{const node=doc.createElement(tag);if(value!==undefined)node.textContent=value;if(cls)node.className=cls;return node;};
    const zoom=$('zoom');$('zoom-close').onclick=()=>zoom.close();zoom.addEventListener('click',event=>{if(event.target===zoom){const rect=zoom.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)zoom.close();}});zoom.addEventListener('close',()=>$('zoom-body').replaceChildren());
    function picture(source,label,marks=[]){
      const wrap=make('span',undefined,'picture'),img=make('img'),overlay=make('span',undefined,'marks');img.alt=label;img.onload=()=>{try{if(marks.length)overlay.innerHTML=root.ImageMarks.renderSvg(marks,img.naturalWidth,img.naturalHeight);}catch(_){overlay.replaceChildren();$('status').textContent='图片标记无法显示，请联系维护者。';}};img.onerror=()=>{img.alt='图片无法显示';$('status').textContent='部分图片无法显示，请重试或联系维护者。';};img.src=source;wrap.append(img,overlay);return wrap;
    }
    function appendImage(parent,item,label){if(!item.image)return;const button=make('button',undefined,'image-button');button.type='button';button.setAttribute('aria-label','放大图片：'+label);button.append(picture(item.image,label,item.imageMarks),make('span','点击放大','image-label'));button.onclick=()=>{$('zoom-title').textContent=label;$('zoom-body').replaceChildren(picture(item.image,label,item.imageMarks));zoom.showModal();};parent.append(button);}
    function render(result){
      const {catalog,workflow,guide,source}=result;$('title').textContent=guide.title;$('version').textContent='版本 '+guide.version;$('source').textContent='正文版本：'+guide.version+' · 目录版本：'+catalog.version+'\n来源：'+source+'\nSOP ID：'+workflow.id+'\n正文 SHA-256：'+workflow.sha256;
      $('notice').textContent=(workflow.status==='sample'?'演示样本，请按实际业务核实。\n':'')+guide.notice;
      for(const [index,step] of guide.steps.entries()){
        const article=make('article',undefined,'step');article.append(make('h2','STEP '+(index+1)+(step.title?' · '+step.title:'')),make('p','操作位置：'+step.where));
        const actions=make('ol');for(const action of step.actions)actions.append(make('li',action));article.append(actions);
        if(step.pointType&&step.pointType!=='normal'){const panel=make('aside',undefined,'point');panel.append(make('strong',({report:'◉ 报告点',approval:'✓ 审批点',both:'◉ 报告与审批点'})[step.pointType]),make('p',step.pointNote||''));article.append(panel);}
        if(step.expected)article.append(make('p','预期结果：'+step.expected));
        if(step.acceptance?.length){article.append(make('h3','验收标准'));const list=make('ul');for(const value of step.acceptance)list.append(make('li',value));article.append(list);}
        if(step.trouble)article.append(make('p','异常说明：'+step.trouble));appendImage(article,step,step.title||'STEP '+(index+1));
        for(const issue of step.issues||[]){const panel=make('section',undefined,'issue');panel.append(make('h3','ISSUE · '+issue.title));const list=make('ol');for(const action of issue.actions)list.append(make('li',action));panel.append(list,make('p','处理后：'+issue.next));appendImage(panel,issue,issue.title);article.append(panel);}
        $('steps').append(article);
      }
      $('status').textContent='已校验目录与正文 · 共 '+guide.steps.length+' 步';
    }
    let controller;
    async function run(){
      if(controller)controller.abort();controller=new AbortController();const current=controller,timer=setTimeout(()=>current.abort(),20000);
      $('retry').hidden=true;$('steps').replaceChildren();$('source').textContent='';$('version').textContent='';$('notice').textContent='';$('title').textContent='正在读取 SOP';$('status').className='';$('status').textContent='正在校验目录和正文…';
      try{const config=JSON.parse($('mobile-reader-config').textContent),url=catalogURL(config.catalogPath,root.location.href);const result=await loadWorkflow({url,id:new URL(root.location.href).searchParams.get('id'),signal:current.signal});if(current!==controller)return;render(result);}
      catch(error){if(current!==controller)return;$('title').textContent='暂时无法读取 SOP';$('status').textContent=error.name==='AbortError'?'读取超时，请检查网络后重试。':error.message;$('status').className='error';}
      finally{clearTimeout(timer);if(current===controller)$('retry').hidden=false;}
    }
    $('retry').onclick=run;run();
  }
  return {MAX_CATALOG,MAX_FILE,MAX_TOTAL,catalogURL,contentURL,readLimited,loadWorkflow,start};
});
