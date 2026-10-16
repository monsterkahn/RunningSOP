'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function copyTree(from,to){fs.mkdirSync(to,{recursive:true});for(const entry of fs.readdirSync(from,{withFileTypes:true})){if(['.git','node_modules','dist','.DS_Store'].includes(entry.name))continue;const src=path.join(from,entry.name),dst=path.join(to,entry.name);if(entry.isDirectory())copyTree(src,dst);else if(!entry.isSymbolicLink())fs.copyFileSync(src,dst);}}
function zipNames(file){const b=fs.readFileSync(file),names=[];let at=0;while(at+4<=b.length&&b.readUInt32LE(at)===0x04034b50){const method=b.readUInt16LE(at+8),compressed=b.readUInt32LE(at+18),nameLen=b.readUInt16LE(at+26),extraLen=b.readUInt16LE(at+28),name=b.toString('utf8',at+30,at+30+nameLen);names.push(name);at+=30+nameLen+extraLen+compressed;if(method!==8)throw Error('Unexpected ZIP compression method');}return names;}
function relativeFiles(dir,base=dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry=>entry.isDirectory()?relativeFiles(path.join(dir,entry.name),base):[path.relative(base,path.join(dir,entry.name)).split(path.sep).join('/')]);}
test('release archives use the explicit source allowlist and current checksums',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'runtime-sop-dist-'));
 try{
  const copy=path.join(temp,'repo');copyTree(root,copy);const dist=path.join(copy,'dist');fs.mkdirSync(dist,{recursive:true});fs.writeFileSync(path.join(dist,'old-release.zip'),'old');fs.writeFileSync(path.join(copy,'.DS_Store'),'machine-specific');
  const built=spawnSync(process.execPath,['tools/package.cjs'],{cwd:copy,encoding:'utf8'});assert.equal(built.status,0,built.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(copy,'extension/manifest.json'))),files=fs.readdirSync(dist);
  const sums=fs.readFileSync(path.join(dist,'SHA256SUMS.txt'),'utf8').trim().split('\n');assert.equal(sums.length,3);
  const names=sums.map(line=>line.split(/\s+/)[1]);assert.deepEqual(names.sort(),[`running-sop-extension-v${manifest.version}.zip`,`running-sop-github-v${manifest.version}.zip`,`running-sop-webstore-v${manifest.version}.zip`].sort());
  for(const line of sums){const [expected,name]=line.split(/\s+/),bytes=fs.readFileSync(path.join(dist,name));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected);}
  const extension=zipNames(path.join(dist,names.find(name=>name.includes('-extension-'))));assert(extension.includes('extension/locale-data.js'));
  const webstore=zipNames(path.join(dist,names.find(name=>name.includes('-webstore-'))));assert(webstore.includes('manifest.json'),'Chrome Web Store manifest must be at ZIP root');assert.deepEqual(webstore.slice().sort(),relativeFiles(path.join(copy,'extension')).sort());assert(!webstore.some(name=>name.startsWith('extension/')||/^(?:PRIVACY\.md|docs\/|tests\/|tools\/|workflows\/)/.test(name)));assert(!webstore.some(name=>/^(?:demo|sample|default-data|workflows)(?:\/|\.|$)/i.test(name)));
  const source=zipNames(path.join(dist,names.find(name=>name.includes('-github-'))));assert(!source.some(name=>name.includes('.DS_Store')||name.startsWith('dist/')));assert(source.includes('docs/RELEASE-CHECKLIST.md'));
  assert(fs.existsSync(path.join(dist,'old-release.zip')),'packaging should preserve local historical archives without checksumming them');
  const scan=spawnSync(process.execPath,['tools/scan-public.cjs'],{cwd:copy,encoding:'utf8'});assert.equal(scan.status,0,scan.stderr);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
