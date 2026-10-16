#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Reader=require('../extension/mobile-reader.js');
const ROOT=path.resolve(__dirname,'..'),DEFAULT_OUTPUT=path.join(ROOT,'dist','sop.html');
const SCRIPTS=['image-marks.js','catalog-engine.js','sop-assets.js','sync-engine.js','sync-runtime.js','reader-integrity.js','mobile-reader.js'];
function buildHtml(options={}){
  const catalogPath=options.catalogPath===undefined?'./SOP/catalog.json':options.catalogPath;
  Reader.catalogURL(catalogPath,'https://reader.example/sop.html');
  let html=fs.readFileSync(path.join(ROOT,'extension','mobile-reader.html'),'utf8');
  const css=fs.readFileSync(path.join(ROOT,'extension','mobile-reader.css'),'utf8');
  html=html.replace('<link rel="stylesheet" href="mobile-reader.css">',()=>'<style>\n'+css+'\n</style>');
  const hashes=[];
  for(const name of SCRIPTS){const script=fs.readFileSync(path.join(ROOT,'extension',name),'utf8');if(/<\/script/i.test(script))throw Error('脚本包含无效 HTML 结束标记。');hashes.push("'sha256-"+crypto.createHash('sha256').update('\n'+script+'\n').digest('base64')+"'");html=html.replace('<script src="'+name+'"></script>',()=>'<script>\n'+script+'\n</script>');}
  const styleHash="'sha256-"+crypto.createHash('sha256').update('\n'+css+'\n').digest('base64')+"'";
  html=html.replace("script-src 'self'; style-src 'self';",'script-src '+hashes.join(' ')+'; style-src '+styleHash+';');
  const config=JSON.stringify({catalogPath}).replace(/</g,'\\u003c');
  html=html.replace(/(<script id="mobile-reader-config" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+config+b);
  return html;
}
function main(argv=process.argv.slice(2)){
  if(argv.length>2)throw Error('用法：node tools/build-mobile-reader.cjs [输出 HTML 路径] [相对目录路径]');
  const output=path.resolve(argv[0]||DEFAULT_OUTPUT),catalogPath=argv[1]||'./SOP/catalog.json',html=buildHtml({catalogPath});
  fs.mkdirSync(path.dirname(output),{recursive:true});const temp=output+'.tmp-'+process.pid;
  fs.writeFileSync(temp,html,{flag:'wx'});try{fs.renameSync(temp,output);}catch(error){try{fs.unlinkSync(temp);}catch(_){}throw error;}
  process.stdout.write('已生成手机阅读器：'+output+'\n请部署到存储器 HTTP(S) 根目录，目录相对路径：'+catalogPath+'\n');return {output,catalogPath};
}
if(require.main===module){try{main();}catch(error){console.error('手机阅读器构建失败：'+error.message);process.exitCode=1;}}
module.exports={DEFAULT_OUTPUT,SCRIPTS,buildHtml,main};
