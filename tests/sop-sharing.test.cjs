'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Sharing=require('../extension/sop-sharing.js'),QR=require('../extension/qr-code.js'),{main}=require('../tools/generate-qr.cjs');
test('QR destinations retain workflow identity across content revisions and accept internal HTTP hosts',()=>{
 const base='http://storage.internal:8080/sop.html';
 assert.equal(Sharing.link(base,'equipment-check'),'http://storage.internal:8080/sop.html?id=equipment-check');
 const original=Sharing.entries({workflows:[{id:'equipment-check',title:'旧标题',file:'versions/old.json'}]},base);
 const revised=Sharing.entries({workflows:[{id:'equipment-check',title:'新标题',file:'versions/new.json'}]},base);
 assert.equal(original[0].url,revised[0].url);
 for(const bad of ['file:///Volumes/shared/sop.html','chrome-extension://abc/workspace.html','javascript:alert(1)','https://u:p@example.org/sop.html','https://example.org/sop.html?id=stale','https://example.org/sop.html#old','https://example.org/\nsecret'])assert.throws(()=>Sharing.readerURL(bad));
 for(const bad of ['../bad','bad&other=1','', '<script>'])assert.throws(()=>Sharing.link(base,bad));
});
test('batch labels escape titles and produce an independently addressable QR for every SOP',()=>{
 const catalog={workflows:[{id:'one',title:'<img onerror="alert(1)">'},{id:'two',title:'第二份 & 检查'}]};
 const entries=Sharing.entries(catalog,'https://storage.example/sop.html'),html=Sharing.sheet(entries,QR);
 assert.deepEqual(entries.map(x=>x.url),['https://storage.example/sop.html?id=one','https://storage.example/sop.html?id=two']);
 assert.equal((html.match(/<svg /g)||[]).length,2);assert(!html.includes('<img onerror='));assert(html.includes('&lt;img'));assert(html.includes('第二份 &amp; 检查'));assert(!html.includes('<script'));
});
test('batch CLI validates catalog, exports every safe ID, and does not write before URL validation',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sop-qr-'));
 try{
  const input=path.resolve(__dirname,'../examples/storage/catalog.json'),out=path.join(dir,'labels');
  assert.throws(()=>main([input,out,'file:///shared/sop.html']));assert(!fs.existsSync(out));
  const items=main([input,out,'https://storage.example/sop.html']);assert(items.length>0);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'links.json'),'utf8'));assert.equal(manifest.items.length,items.length);
  for(const item of items){assert(fs.readFileSync(path.join(out,item.file),'utf8').includes('<svg'));assert.equal(new URL(item.url).searchParams.get('id'),item.id);}
  assert(fs.existsSync(path.join(out,'index.html')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
