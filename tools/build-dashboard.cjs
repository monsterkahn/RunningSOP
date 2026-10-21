#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ImageMarks=require('../extension/image-marks.js');
const CatalogEngine=require('../extension/catalog-engine.js');
const SOPAssets=require('../extension/sop-assets.js');
const SOPCategories=require('../extension/category-engine.js');
const StatsEngine=require('../extension/stats-engine.js');
const RemoteContent=require('../extension/sync-engine.js');
require('../extension/sync-runtime.js');
const SOPSync=globalThis.SOPSync;

const DEFAULT_SOURCE=path.resolve(__dirname,'..','examples','storage');
const DEFAULT_OUTPUT=path.resolve(__dirname,'..','dist','dashboard.html');
const MAX_TOTAL=32*1024*1024,MAX_FILE=2*1024*1024,MAX_JSON_FILES=1000;
const fail=message=>{throw new Error(message);};
const sha=raw=>crypto.createHash('sha256').update(raw,'utf8').digest('hex');
function readRaw(file,max){let stat;try{stat=fs.statSync(file);}catch(e){if(e.code==='ENOENT')fail('缺少必要文件：'+file);throw e;}if(!stat.isFile()||stat.size>max)fail('文件不是普通文件或超过读取上限：'+file);const raw=fs.readFileSync(file,'utf8');if(Buffer.byteLength(raw,'utf8')>max)fail('文件超过读取上限：'+file);return raw;}
function readJson(file,max,label){const raw=readRaw(file,max);let value;try{value=JSON.parse(raw);}catch(_){fail(label+' JSON 无效。');}return {raw,value};}
function youtubeSubset(bundle,workflow){return {workflowId:workflow.id,title:workflow.title,version:bundle.contentVersion||bundle.config.version,notice:'YouTube SOP 正文从已验证内容包的 config 子集读取；图解素材保持在本地阅读器中。',steps:bundle.config.steps.map(step=>({id:step.id,title:step.title,where:step.locationHint,actions:step.actions,expected:(step.outputs||[]).join('\n'),acceptance:step.acceptance||[],trouble:step.gateHint||'',issues:[],...(step.id==='YT03'&&bundle.assets?.studioScreenshot?{imageData:'data:'+bundle.assets.studioScreenshot.mimeType+';base64,'+bundle.assets.studioScreenshot.data}:{})}))};}
function knownJsonFiles(directory,pattern,budget,total){let result=[];if(!fs.existsSync(directory))return result;const stat=fs.statSync(directory);if(!stat.isDirectory())fail('预期为目录：'+directory);for(const name of fs.readdirSync(directory)){if(!pattern.test(name))continue;const file=path.join(directory,name),item=fs.statSync(file);if(!item.isFile())continue;if(++budget.count>MAX_JSON_FILES)fail('发布历史与统计 JSON 合计超过 1000 个文件。');if(item.size>MAX_FILE)fail('单个发布历史/统计 JSON 超过 2 MB：'+file);total.size+=item.size;if(total.size>MAX_TOTAL)fail('目录、正文、历史与统计合计超过 32 MB。');result.push({name,raw:fs.readFileSync(file,'utf8')});}return result;}
function loadSnapshot(sourceDir){
  const catFile=readJson(path.join(sourceDir,'catalog.json'),512*1024,'NAS目录');
  const catalog=CatalogEngine.validateCatalog(catFile.value);
  const total={size:Buffer.byteLength(catFile.raw,'utf8')},workflows=[];
  for(const workflow of catalog.workflows){
    const file=path.resolve(sourceDir,workflow.file),base=path.resolve(sourceDir)+path.sep;
    if(!file.startsWith(base))fail('目录工作流路径越界：'+workflow.id);
    const raw=readRaw(file,4*1024*1024);
    total.size+=Buffer.byteLength(raw,'utf8');if(total.size>MAX_TOTAL)fail('目录与正文合计超过 32 MB。');
    if(sha(raw)!==workflow.sha256)fail('工作流 '+workflow.id+' SHA-256 不匹配。');
    let parsed=JSON.parse(raw);if(parsed.format==='runtime-sop-document')parsed=SOPAssets.hydrateSync(parsed,workflow,file=>{const asset=fs.readFileSync(path.join(sourceDir,file));total.size+=asset.length;if(total.size>MAX_TOTAL)fail('目录、正文和图片合计超过32MB。');return new Uint8Array(asset);});let guide;
    if(workflow.viewer==='guide'){
      guide=CatalogEngine.validateGuide(parsed);
      if(guide.workflowId!==workflow.id)fail('指南正文身份与目录不匹配：'+workflow.id);
    }else if(workflow.viewer==='youtube'){
      if(!SOPSync?.verify||!RemoteContent?.validateBundle||!ImageMarks?.validate)fail('YouTube / 图片校验器未加载。');
      // verify() checks the content revision; validateBundle checks the strict data schema.
      const validated=RemoteContent.validateBundle(parsed);
      const payload=JSON.stringify(RemoteContent.contentParts(validated));
      const revision=crypto.createHash('sha256').update(payload,'utf8').digest('hex');
      if(revision!==validated.revision)fail('YouTube 内容包版本指纹不匹配。');
      if(validated.workflowId!==workflow.id)fail('YouTube 正文身份与目录不匹配。');
      guide=youtubeSubset(validated,workflow);
    }else fail('不支持的工作流查看器：'+workflow.viewer);
    workflows.push({workflow,guide,updatedAt:null});
  }
  const historyEvents=[],snapshots=[],budget={count:0};
  for(const workflow of catalog.workflows){
    const dir=path.join(sourceDir,'publication-history',workflow.id);
    for(const {name,raw}of knownJsonFiles(dir,/^[a-f0-9]{64}\.json$/i,budget,total)){
      let event;try{event=StatsEngine.validateHistoryEvent(JSON.parse(raw));}catch(e){fail('发布历史无效：'+name+' · '+e.message);}
      if(event.workflowId!==workflow.id||name.toLowerCase()!==event.sha256+'.json')fail('发布历史文件名或工作流身份不匹配：'+name);
      historyEvents.push(event);
    }
  }
  const clientsDir=path.join(sourceDir,'statistics','clients');
  for(const {name,raw}of knownJsonFiles(clientsDir,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i,budget,total)){
    let snapshot;try{snapshot=StatsEngine.validateSnapshot(JSON.parse(raw));}catch(e){fail('匿名统计无效：'+name+' · '+e.message);}
    if(name.toLowerCase()!==snapshot.clientId+'.json')fail('匿名统计文件名与设备 ID 不匹配：'+name);
    snapshots.push(snapshot);
  }
  for(const item of workflows){item.updatedAt=historyEvents.filter(e=>e.workflowId===item.workflow.id).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0]?.publishedAt||null;}
  const aggregate=StatsEngine.aggregate(snapshots,historyEvents);
  let categories=SOPCategories.empty();const categoryPath=path.join(sourceDir,'categories.json');if(fs.existsSync(categoryPath)){const raw=readRaw(categoryPath,SOPCategories.MAX_BYTES);categories=SOPCategories.validate(JSON.parse(raw));total.size+=Buffer.byteLength(raw,'utf8');if(total.size>MAX_TOTAL)fail('内容及分类数据超过读取上限。');}
  return {catalog,workflows,historyEvents,categories,statisticsAvailable:snapshots.length>0,aggregate,sourceLabel:'构建时已校验快照',builtAt:new Date().toISOString(),provenance:{catalogSha256:sha(catFile.raw),workflowCount:workflows.length,totalBytes:total.size}};
}
function scriptData(value){return JSON.stringify(JSON.stringify(value)).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function buildHtml(payload){
  // Source pages load local scripts for Manifest V3; the standalone artifact inlines them once.
  const template=fs.readFileSync(path.join(__dirname,'..','extension','dashboard.html'),'utf8').replace('<script src="appearance.js"></script>',()=>'<script>\n'+fs.readFileSync(path.join(__dirname,'..','extension','appearance.js'),'utf8')+'\n</script>').replace(/\s*<script src="(?!dashboard\.js)[^"]+"><\/script>/g,'');
  const logo='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'..','extension','assets/icons/icon-48.png')).toString('base64');
  const css=fs.readFileSync(path.join(__dirname,'..','extension','dashboard.css'),'utf8');
  const app=fs.readFileSync(path.join(__dirname,'..','extension','dashboard.js'),'utf8');
  const engines=[
    fs.readFileSync(path.join(__dirname,'..','extension','dashboard-i18n.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','qr-code.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','sop-sharing.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','image-marks.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','ui-icons.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','category-engine.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','category-store.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','dashboard-categories.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','catalog-engine.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','sop-assets.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','sync-engine.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','sync-runtime.js'),'utf8'),
    fs.readFileSync(path.join(__dirname,'..','extension','stats-engine.js'),'utf8')
  ].join('\n;\n');
  let html=template.replaceAll('__PLUGIN_VERSION__',JSON.parse(fs.readFileSync(path.join(__dirname,'..','extension','manifest.json'),'utf8')).version).replaceAll('__SOP_LOGO__',logo).replaceAll('assets/icons/icon-48.png',logo).replace('<link rel="stylesheet" href="dashboard.css">','<style>\n'+css+'\n</style>');
  html=html.replace('<script src="dashboard.js"></script>',()=>'<script>\n'+engines+'\n</script>\n<script id="dashboard-data" type="application/json">'+JSON.stringify(payload).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+'</script>\n<script>\n'+app+'\n</script>');
  return html;
}
function main(argv=process.argv.slice(2)){
  if(argv.length>2)fail('用法：node build-dashboard.cjs [NAS sop 目录] [输出 HTML 路径]');
  const source=path.resolve(argv[0]||DEFAULT_SOURCE),output=path.resolve(argv[1]||DEFAULT_OUTPUT);
  const payload=loadSnapshot(source),html=buildHtml(payload);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  // Write only the explicitly requested output artifact. The NAS source is read-only.
  const temp=output+'.tmp-'+process.pid;
  fs.writeFileSync(temp,html,{flag:'wx'});
  try{fs.renameSync(temp,output);}catch(e){try{fs.unlinkSync(temp);}catch(_){}throw e;}
  if(output===DEFAULT_OUTPUT)fs.writeFileSync(path.join(path.dirname(output),'index.html'),html);
  process.stdout.write(`已生成离线总表：${output}\n目录：${payload.catalog.version} · SOP ${payload.workflows.length} 份 · ${payload.provenance.totalBytes} bytes\n统计：${payload.statisticsAvailable?'已读取匿名设备样本':'未采集'} · 更新历史：${payload.historyEvents.length?payload.historyEvents.length+' 条':'未追踪'}\n`);
  return {output,payload};
}
if(require.main===module){try{main();}catch(error){console.error('总表打包失败：'+error.message);process.exitCode=1;}}
module.exports={DEFAULT_SOURCE,DEFAULT_OUTPUT,MAX_TOTAL,MAX_FILE,MAX_JSON_FILES,loadSnapshot,buildHtml,main,scriptData};
