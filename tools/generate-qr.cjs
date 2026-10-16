#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const Catalog=require('../extension/catalog-engine.js'),Sharing=require('../extension/sop-sharing.js'),QR=require('../extension/qr-code.js');
function main(argv=process.argv.slice(2)){
 if(argv.length!==3)throw Error('用法：node tools/generate-qr.cjs <catalog.json> <输出目录> <手机阅读页HTTP/HTTPS地址>');
 const [source,target,base]=argv;const stat=fs.statSync(source);if(!stat.isFile()||stat.size>512*1024)throw Error('目录文件无效或超过512KB。');
 const catalog=Catalog.validateCatalog(JSON.parse(fs.readFileSync(source,'utf8'))),items=Sharing.entries(catalog,base);
 // Prepare every QR before writing so a failed link never produces a partial batch.
 const rendered=items.map(item=>[item.file,QR.toSVG(item.url)]),html=Sharing.sheet(items,QR);fs.mkdirSync(target,{recursive:true});
 for(const [file,svg]of rendered)fs.writeFileSync(path.join(target,file),svg);
 fs.writeFileSync(path.join(target,'index.html'),html);fs.writeFileSync(path.join(target,'links.json'),JSON.stringify({reader:Sharing.readerURL(base),items},null,2)+'\n');
 console.log('已生成 '+items.length+' 份二维码及打印标签。请手机试扫后再张贴。');return items;
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={main};
