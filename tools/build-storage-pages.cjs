'use strict';
// Bundle empty, trusted standalone pages as data. No real SOP snapshot is embedded.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Dashboard=require('./build-dashboard.cjs'),Relationships=require('./build-relationships.cjs');
const Categories=require('../extension/category-engine.js'),Relations=require('../extension/relations-engine.js');
const root=path.resolve(__dirname,'..');
function bundle(){
 const version=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8')).version;
 const empty={catalog:{format:'runtime-sop-catalog',schemaVersion:1,version:'1.0.0',workflows:[]},workflows:[],historyEvents:[],categories:Categories.empty(),statisticsAvailable:false,aggregate:null,source:'unconfigured',sourceLabel:'尚未连接文件夹',builtAt:null};
 const pages=[['index.html',Dashboard.buildHtml(empty)],['relationships.html',Relationships.buildHtml({nodes:[],relations:Relations.empty()})]];
 return {format:'runtime-sop-storage-pages',schemaVersion:1,version,files:pages.map(([name,content])=>({name,content,sha256:crypto.createHash('sha256').update(content).digest('hex')}))};
}
function main(){const value=bundle(),target=path.join(root,'extension/storage-pages.json');fs.writeFileSync(target,JSON.stringify(value)+'\n');console.log('Bundled two empty standalone pages for authorized folder deployment.');return value;}
if(require.main===module)main();
module.exports={bundle,main};
