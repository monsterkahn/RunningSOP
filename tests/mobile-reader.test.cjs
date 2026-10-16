'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Reader=require('../extension/mobile-reader.js');
const Integrity=require('../extension/reader-integrity.js');
const Engine=require('../extension/catalog-engine.js');
const Assets=require('../extension/sop-assets.js');
const Builder=require('../tools/build-mobile-reader.cjs');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hex=buffer=>Buffer.from(buffer).toString('hex');
const base='http://storage.example/SOP/catalog.json';
function fixture(){
 const root=path.join(__dirname,'..','examples','storage'),catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
 const files=new Map([['catalog.json',Buffer.from(JSON.stringify(catalog))]]);
 const workflow=catalog.workflows[0],raw=fs.readFileSync(path.join(root,workflow.file));files.set(workflow.file,raw);
 const document=JSON.parse(raw);for(const asset of document.assets)files.set(asset.file,fs.readFileSync(path.join(root,asset.file)));
 const requests=[];
 const fetch=async(url,options)=>{requests.push({url,options});const file=String(url).slice(new URL('./',base).href.length);return new Response(files.get(file)||'',{status:files.has(file)?200:404});};
 return {catalog,files,requests,fetch,workflow};
}
function load(f,extra={}){return Reader.loadWorkflow({url:base,id:f.workflow.id,fetch:f.fetch,integrity:Integrity,crypto:{},catalogEngine:Engine,assets:Assets,...extra});}
test('LAN HTTP SHA-256 fallback matches known FIPS vectors, padding boundaries and binary views',async()=>{
 for(const [value,expected] of [['','e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],['abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq','248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1']])assert.equal(hex(Integrity.sha256(Buffer.from(value))),expected);
 for(const size of [55,56,63,64,65,1024,1000000]){const bytes=Buffer.alloc(size,0x61);assert.equal(hex(Integrity.sha256(bytes)),sha(bytes));}
 const view=Uint8Array.from([0,1,2,3,4]).subarray(1,4);assert.equal(hex(Integrity.sha256(view)),sha(view));
 assert.equal(hex(await Integrity.adapter({}).subtle.digest('SHA-256',view)),sha(view));
 await assert.rejects(()=>Integrity.adapter({}).subtle.digest('MD5',view),/SHA-256/);
});
test('reader/build configuration confines catalogs and content to same-origin relative paths',()=>{
 assert.equal(Reader.catalogURL('./SOP/catalog.json','https://storage.example/sop.html?id=demo-work'),'https://storage.example/SOP/catalog.json');
 for(const value of ['https://other.example/catalog.json','//other.example/catalog.json','../catalog.json','./%2e%2e/catalog.json','SOP/catalog.json?q=1','SOP/catalog.json#x'])assert.throws(()=>Builder.buildHtml({catalogPath:value}));
 for(const value of ['../secret.json','a/../../secret.json','https://other.example/a.json','%2e%2e/a.json','a\\b.json'])assert.throws(()=>Reader.contentURL(base,value));
 assert.throws(()=>Reader.catalogURL('./SOP/catalog.json','file:///storage/sop.html'),/HTTP/);
});
test('loads only selected published synthetic SOP and verifies separately stored images without WebCrypto',async()=>{
 const f=fixture(),result=await load(f);
 assert.equal(result.workflow.id,f.workflow.id);assert.equal(result.guide.workflowId,f.workflow.id);assert.match(result.guide.steps[0].image,/^data:image\/jpeg;base64,/);
 assert.equal(f.requests.length,3);assert(f.requests.every(({options})=>options.redirect==='error'&&options.cache==='no-store'&&options.credentials==='same-origin'));
});
test('fails closed for removed IDs, tampered body, schema violations, identity mismatch and tampered images',async()=>{
 await assert.rejects(load(fixture(),{id:'removed'}),/不存在/);
 const body=fixture();body.files.set(body.workflow.file,Buffer.from('{}'));await assert.rejects(load(body),/SHA-256/);
 const schema=fixture(),parsed=JSON.parse(schema.files.get(schema.workflow.file));parsed.content.unknown='bad';const raw=Buffer.from(JSON.stringify(parsed));schema.files.set(schema.workflow.file,raw);schema.catalog.workflows[0].sha256=sha(raw);schema.files.set('catalog.json',Buffer.from(JSON.stringify(schema.catalog)));await assert.rejects(load(schema),/未知字段/);
 const image=fixture(),asset=JSON.parse(image.files.get(image.workflow.file)).assets[0];image.files.set(asset.file,Buffer.alloc(asset.size,0));await assert.rejects(load(image),/图片/);
 const identity=fixture(),doc=JSON.parse(identity.files.get(identity.workflow.file));doc.workflowId='other';const bad=Buffer.from(JSON.stringify(doc));identity.files.set(identity.workflow.file,bad);identity.catalog.workflows[0].sha256=sha(bad);identity.files.set('catalog.json',Buffer.from(JSON.stringify(identity.catalog)));await assert.rejects(load(identity),/身份/);
});
test('bounded streaming and HTTP failures are rejected before rendering',async()=>{
 await assert.rejects(Reader.readLimited(new Response('x',{status:403}),5),/403/);
 await assert.rejects(Reader.readLimited(new Response('123456'),5),/上限/);
 const f=fixture();f.files.set('catalog.json',Buffer.from('{"format":"wrong"}'));await assert.rejects(load(f),/目录/);
});
test('selfcontained reader bundles only local code under hashed CSP and includes no data snapshot',()=>{
 const html=Builder.buildHtml();assert(!/<script\s+src=/.test(html));assert(!/<link[^>]+stylesheet/.test(html));assert.match(html,/script-src 'sha256-/);assert(!html.includes("'unsafe-inline'"));assert.match(html,/"catalogPath":"\.\/SOP\/catalog.json"/);assert(!html.includes('d413947b5a41ac11'));assert(!html.includes('chrome-extension://'));assert.match(html,/referrer/);
});
test('strict YouTube bundle and revision verification also work on LAN HTTP',async()=>{
 const Remote=require('../extension/sync-engine.js');
 const steps=Array.from({length:10},(_,i)=>({id:'YT'+String(i+1).padStart(2,'0'),title:'合成步骤',phase:'演示',locationHint:'合成位置',summary:'说明',inputs:['输入'],actions:['操作'],outputs:['输出'],acceptance:['标准'],resultHint:'结果',gateHint:'异常',dependencies:[],next:[],rework:[],resources:['example']}));
 const lessons=Object.fromEntries(steps.map(s=>[s.id,{lead:'说明',visual:'upload',microsteps:[{title:'标题',where:'位置',do:'操作',expect:'结果',trouble:'异常'}],example:'演示',terms:[{term:'术语',meaning:'含义'}]}]));
 const bundle={format:'runtime-sop-content',schemaVersion:1,workflowId:'youtube-upload',contentVersion:'1.0.0',publishedAt:'2026-10-16T00:00:00.000Z',revision:'0'.repeat(64),config:{version:'1.0.0',schemaVersion:1,name:'合成视频流程',checkedAt:'2026-10-16',scope:'合成',steps,resources:[{id:'example',title:'示例',url:'https://example.com/'}]},tutorials:{version:'1.0.0',lessons},assets:{logo:{mimeType:'image/jpeg',data:Buffer.from([255,216,255]).toString('base64')},studioScreenshot:{mimeType:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')}}};
 bundle.revision=sha(JSON.stringify(Remote.contentParts(Remote.validateBundle(bundle))));
 const workflow={id:'youtube-upload',title:'合成视频流程',summary:'',status:'sample',viewer:'youtube',file:'workflows/youtube.json',sha256:'0'.repeat(64),rules:[]};
 const catalog={format:'runtime-sop-catalog',schemaVersion:1,version:'1',workflows:[workflow]};
 function request(){const raw=JSON.stringify(bundle);workflow.sha256=sha(raw);return async url=>new Response(url===base?JSON.stringify(catalog):raw);}
 const options={url:base,id:workflow.id,fetch:request(),integrity:Integrity,crypto:{},catalogEngine:Engine,assets:Assets,remote:Remote};
 const result=await Reader.loadWorkflow(options);assert.equal(result.guide.steps.length,10);assert.match(result.guide.steps[2].image,/^data:image\/png;base64,/);
 bundle.revision='f'.repeat(64);await assert.rejects(Reader.loadWorkflow({...options,fetch:request()}),/版本指纹/);
 bundle.extra='ignored?';await assert.rejects(Reader.loadWorkflow({...options,fetch:request()}),/未知/);
});
