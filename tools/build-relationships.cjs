#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadSnapshot,DEFAULT_SOURCE}=require('./build-dashboard.cjs');
const Relations=require('../extension/relations-engine.js');
const ROOT=path.resolve(__dirname,'..'),DEFAULT_OUTPUT=path.join(ROOT,'dist','relationships.html');
function snapshot(source){const dashboard=loadSnapshot(source),file=path.join(source,'relations.json');let relations=Relations.empty();if(fs.existsSync(file)){const stat=fs.statSync(file);if(!stat.isFile()||stat.size>Relations.MAX_BYTES)throw Error('relations.json exceeds 512 KiB or is not a regular file.');relations=Relations.validate(JSON.parse(fs.readFileSync(file,'utf8')));}return {nodes:dashboard.workflows.map(item=>({id:item.workflow.id,title:item.workflow.title,stepCount:item.guide.steps.length})),relations};}
function buildHtml(payload){
 let html=fs.readFileSync(path.join(ROOT,'extension','relationships.html'),'utf8');
 const data=JSON.stringify(payload).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 html=html.replace("img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'","img-src data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
 html=html.replace('href="dashboard.html"','href="index.html"');
 html=html.replaceAll('assets/icons/icon-48.png','data:image/png;base64,'+fs.readFileSync(path.join(ROOT,'extension/assets/icons/icon-48.png')).toString('base64'));
 html=html.replace('<link rel="stylesheet" href="relationships.css">',()=>'<style>\n'+fs.readFileSync(path.join(ROOT,'extension/relationships.css'),'utf8')+'\n</style>');
 html=html.replace(/<script src="([a-z0-9-]+\.js)"><\/script>/g,(_,file)=>'<script>\n'+fs.readFileSync(path.join(ROOT,'extension',file),'utf8')+'\n</script>');
 return html.replace('<script>','<script id="relations-data" type="application/json">'+data+'</script>\n<script>');
}
function main(argv=process.argv.slice(2)){if(argv.length>2)throw Error('Usage: node tools/build-relationships.cjs [SOP directory] [output HTML]');const source=path.resolve(argv[0]||DEFAULT_SOURCE),output=path.resolve(argv[1]||DEFAULT_OUTPUT),payload=snapshot(source),html=buildHtml(payload);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);process.stdout.write('Built offline relationship editor: '+payload.nodes.length+' SOP metadata nodes.\n');return {output,payload};}
if(require.main===module)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={DEFAULT_OUTPUT,snapshot,buildHtml,main};
