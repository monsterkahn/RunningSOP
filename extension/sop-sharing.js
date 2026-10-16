(function(root,factory){'use strict';
const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SOPSharing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const t=(key,vars)=>globalThis.DashboardI18n?.t(key,vars)??key;
const KEY='running-sop-mobile-reader-url-v1';
function readerURL(value){
 if(typeof value!=='string'||!value.trim())throw Error(t('请先填写手机可访问的 SOP 阅读页面地址。'));
 const raw=value.trim();if(/[\u0000-\u0020\u007f]/.test(raw))throw Error(t('阅读地址不能包含空白或控制字符。'));
 let u;try{u=new URL(raw);}catch{throw Error(t('请填写完整的 HTTP／HTTPS 阅读页面地址。'));}
 if(!['http:','https:'].includes(u.protocol))throw Error(t('手机不能使用 file:/// 或插件地址；请填写 HTTP／HTTPS 阅读页面地址。'));
 if(u.username||u.password||u.search||u.hash)throw Error(t('请使用不含账号、密码、查询参数或锚点的固定阅读页面地址。'));
 if(u.href.length>850)throw Error(t('阅读页面地址过长，请使用较短的固定地址。'));
 return u.href;
}
function link(base,id){if(typeof id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id))throw Error(t('SOP 编号无效。'));const u=new URL(readerURL(base));u.searchParams.set('id',id);return u.href;}
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function entries(catalog,base){const address=readerURL(base);return catalog.workflows.map(w=>({id:w.id,title:w.title,url:link(address,w.id),file:w.id+'.svg'}));}
function sheet(items,qr=globalThis.SOPQRCode){if(!qr?.toSVG)throw Error(t('二维码生成器未加载。'));return '<!doctype html><html lang="'+escape(globalThis.DashboardI18n?.locale()||'zh-CN')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Running SOP · '+escape(t('二维码标签'))+'</title><style>body{font:16px system-ui;margin:24px;color:#182333}header{margin-bottom:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}.label{break-inside:avoid;border:1px solid #ccd5df;border-radius:12px;padding:20px;text-align:center;overflow-wrap:anywhere}.label svg{display:block;width:220px;max-width:100%;height:auto;margin:8px auto}h2{font-size:19px}small{color:#58677d}a{font-size:12px;color:#2462af} @media print{body{margin:0}main{grid-template-columns:repeat(2,1fr)}header{font-size:12px}.label{border-radius:0}a{color:inherit}}</style><header><h1>Running SOP · '+escape(t('扫码查看步骤'))+'</h1><p>'+escape(t('请先用手机试扫，确认地址可访问，再打印张贴。使用浏览器“打印”可保存为 PDF。'))+'</p></header><main>'+items.map(item=>'<article class="label"><small>RUNNING SOP</small><h2>'+escape(item.title)+'</h2>'+qr.toSVG(item.url)+'<p>'+escape(item.id)+'</p><a href="'+escape(item.url)+'">'+escape(item.url)+'</a></article>').join('')+'</main></html>';}
function save(name,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function init({getPayload}){
 const dialog=document.getElementById('qr-dialog');if(!dialog)return;
 const input=document.getElementById('qr-reader-url'),status=document.getElementById('qr-status'),preview=document.getElementById('qr-preview'),linkBox=document.getElementById('qr-link');let selected='';
 function base(){return readerURL(input.value);}
 function showError(e){status.textContent=e.message;status.className='status error';}
 function update(){preview.replaceChildren();linkBox.value='';document.getElementById('qr-download').disabled=true;document.getElementById('qr-open').hidden=true;document.getElementById('qr-export').disabled=true;
  try{const b=base();const payload=getPayload();document.getElementById('qr-export').disabled=payload.workflows.length===0;
   if(selected){const item=payload.workflows.find(x=>x.workflow.id===selected);if(!item)throw Error(t('当前目录中已没有此 SOP。'));const url=link(b,selected);preview.innerHTML=globalThis.SOPQRCode.toSVG(url);linkBox.value=url;const a=document.getElementById('qr-open');a.href=url;a.hidden=false;document.getElementById('qr-download').disabled=false;status.textContent=t('二维码已生成。请先用手机试扫，确认可访问后再张贴。');}
   else status.textContent=t('已准备 {count} 份 SOP，点击“下载全部标签”生成每份 SOP 的二维码。',{count:payload.workflows.length});status.className='status';
  }catch(e){showError(e);}}
 function open(id=''){selected=id;const item=getPayload().workflows.find(x=>x.workflow.id===id);document.getElementById('qr-title').textContent=item?t('手机扫码 · {name}',{name:item.workflow.title}):t('SOP 二维码');let stored='';try{stored=localStorage.getItem(KEY)||'';}catch{}
  input.value=stored;if(!stored&&['http:','https:'].includes(location.protocol)){const u=new URL(location.href);u.search='';u.hash='';const nested=decodeURIComponent(u.pathname).includes('/界面/总表/');input.value=new URL(nested?'../../sop.html':'sop.html',u).href;}
  update();dialog.showModal();}
 input.addEventListener('input',update);document.getElementById('qr-save').onclick=()=>{try{const url=base();try{localStorage.setItem(KEY,url);}catch{}update();status.textContent+=t(' 地址已保存在本浏览器。');}catch(e){showError(e);}};
 document.getElementById('qr-close').onclick=()=>dialog.close();document.getElementById('qr-all').onclick=()=>open();document.getElementById('detail-qr').onclick=()=>{let id='';try{id=decodeURIComponent((location.hash.match(/^#sop=(.*)$/)||[])[1]||'');}catch{}open(id);};
 document.getElementById('qr-download').onclick=()=>{try{save(selected+'.svg',globalThis.SOPQRCode.toSVG(link(base(),selected)),'image/svg+xml;charset=utf-8');}catch(e){showError(e);}};
 document.getElementById('qr-export').onclick=()=>{try{const all=entries({workflows:getPayload().workflows.map(x=>x.workflow)},base());save(t('Running-SOP-二维码标签.html'),sheet(all),'text/html;charset=utf-8');status.textContent=t('已下载 {count} 份二维码标签，打开文件即可打印。',{count:all.length});}catch(e){showError(e);}};
 return {open};
}
return {KEY,readerURL,link,entries,sheet,init};
});
