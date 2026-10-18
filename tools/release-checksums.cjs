'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function collect({directory=path.join(root,'dist'),version=require('../package.json').version}={}){
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
 const names=[`running-sop-extension-v${version}.zip`,`running-sop-github-v${version}.zip`,`running-sop-webstore-v${version}.zip`,`running-sop-team-service-v${version}-experimental.zip`,`running-sop-media-v${version}.zip`];
 const lines=names.map(name=>{const file=path.join(directory,name);if(!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw Error('Invalid release artifact');const bytes=fs.readFileSync(file);if(bytes.length<22||bytes.readUInt32LE(0)!==0x04034b50)throw Error('Invalid ZIP artifact');return crypto.createHash('sha256').update(bytes).digest('hex')+'  '+name;});
 const content=lines.join('\n')+'\n';fs.writeFileSync(path.join(directory,'SHA256SUMS.txt'),content);return content;
}
if(require.main===module)console.log(collect());
module.exports={collect};
