'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function stepBody(name){const lines=fs.readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8').split('\n'),start=lines.findIndex(l=>l===`      - name: ${name}`);assert(start>=0);const run=lines.findIndex((l,i)=>i>start&&l==='        run: |');assert(run>start);const out=[];for(let i=run+1;i<lines.length;i++){if(lines[i]&&!lines[i].startsWith('          '))break;out.push(lines[i].slice(10));}return out.join('\n');}
test('current release-note synchronization is idempotent and preserves older releases and binary assets',{skip:process.platform==='win32'},()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'running-sop-release-notes-'));
 try{
  for(const p of ['bin','docs/releases','dist'])fs.mkdirSync(path.join(temp,p),{recursive:true});
  fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({version:'1.1.0'}));
  fs.writeFileSync(path.join(temp,'docs/GITHUB-RELEASE.md'),'Current English release notes\n');fs.writeFileSync(path.join(temp,'docs/releases/v1.0.0.md'),'Historical English release notes\n');
  const binary=Buffer.from('published package bytes'),digest=crypto.createHash('sha256').update(binary).digest('hex');fs.writeFileSync(path.join(temp,'dist/package.zip'),binary);fs.writeFileSync(path.join(temp,'dist/SHA256SUMS.txt'),digest+'  package.zip\n');
  fs.writeFileSync(path.join(temp,'state.json'),JSON.stringify({'v1.0.0':'Previous historical notes','v1.1.0':'Previous current notes'}));
  const gh=`#!${process.execPath}\nconst fs=require('node:fs');const a=process.argv.slice(2),state=JSON.parse(fs.readFileSync('state.json'));fs.appendFileSync('calls.jsonl',JSON.stringify(a)+'\\n');if(a[0]!=='release')process.exit(2);const tag=a[2];if(a[1]==='view'){if(a.includes('--jq'))process.stdout.write(state[tag]);else console.log(JSON.stringify({isDraft:false,targetCommitish:'published-commit',body:state[tag]}));}else if(a[1]==='edit'){if(a.length!==7||a[5]!=='--notes-file')process.exit(3);state[tag]=fs.readFileSync(a[6],'utf8').trimEnd();fs.writeFileSync('state.json',JSON.stringify(state));}else process.exit(4);\n`;
  fs.writeFileSync(path.join(temp,'bin/gh'),gh,{mode:0o755});
  const sha=`#!${process.execPath}\nconst fs=require('node:fs'),crypto=require('node:crypto');for(const l of fs.readFileSync('SHA256SUMS.txt','utf8').trim().split('\\n')){const [sum,name]=l.split(/\\s+/);if(crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex')!==sum)process.exit(1);}\n`;
  fs.writeFileSync(path.join(temp,'bin/sha256sum'),sha,{mode:0o755});
  const scripts=[stepBody('Publish the version once')];
  for(let round=0;round<2;round++)for(const script of scripts){const r=spawnSync('bash',['-e','-c',script],{cwd:temp,env:{...process.env,PATH:path.join(temp,'bin')+path.delimiter+process.env.PATH,GITHUB_REPOSITORY:'example/running-sop',GITHUB_SHA:'documentation-commit'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
  const calls=fs.readFileSync(path.join(temp,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse),edits=calls.filter(a=>a[1]==='edit');
  assert.equal(edits.length,1,'only the current changed published description is updated once');assert.deepEqual(edits.map(a=>a[2]),['v1.1.0']);assert(calls.every(a=>a[2]!=='v1.0.0'),'older releases must not be queried or modified');
  assert(calls.every(a=>!['upload','delete','create'].includes(a[1])),'published assets and tags must not be replaced');assert.deepEqual(fs.readFileSync(path.join(temp,'dist/package.zip')),binary);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temp,'state.json'))),{'v1.0.0':'Previous historical notes','v1.1.0':'Current English release notes'});
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
