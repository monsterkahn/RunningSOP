'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const blocked=[['192','168','1','220'].join('.'),['kahn','kim'].join(''),['UCcmHam','T8tZflo'].join('')];
const privateName=/(^\.env($|\.)|\.DS_Store$|\.(pem|key|crx|log)$|\.(sqlite|db)(?:-(?:wal|shm|journal))?$)/i;
let count=0;
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','dist','.git','.DS_Store'].includes(item.name))continue;const file=path.join(dir,item.name),relative=path.relative(root,file);if(item.isSymbolicLink())throw Error('Symlink not allowed: '+relative);if(privateName.test(item.name))throw Error('Private file type: '+relative);if(item.isDirectory()){walk(file);continue;}if(/\.(png|jpe?g|gif|webp|ico)$/i.test(item.name))continue;const text=fs.readFileSync(file,'utf8');if(text.includes('\u0000'))throw Error('Binary file in public source: '+relative);for(const token of blocked)if(text.includes(token))throw Error('Private identifier found: '+relative);count++;}}
walk(root);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(pkg.version!==manifest.version)throw Error(`Version mismatch: package.json ${pkg.version}, manifest ${manifest.version}`);
const entrypoints=[manifest.background?.service_worker,manifest.side_panel?.default_path,manifest.options_page,manifest.options_ui?.page,...Object.values(manifest.icons||{}),...Object.values(manifest.action?.default_icon||{})].filter(Boolean);
for(const file of entrypoints)if(!fs.existsSync(path.join(root,'extension',file)))throw Error('Missing manifest file: '+file);
// Every local script, stylesheet, and image referenced by extension HTML must ship.
for(const file of fs.readdirSync(path.join(root,'extension')).filter(name=>name.endsWith('.html'))){const html=fs.readFileSync(path.join(root,'extension',file),'utf8');for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){const ref=match[1];if(/^(?:https?:|data:|mailto:|tel:|#|__)/i.test(ref))continue;const localRef=ref.split(/[?#]/,1)[0];if(!localRef)continue;const resolved=path.resolve(root,'extension',path.dirname(file),localRef);if(!resolved.startsWith(path.join(root,'extension')+path.sep)||!fs.existsSync(resolved))throw Error(`Missing or unsafe extension asset in ${file}: ${ref}`);}}
console.log(`Public scan passed: ${count} text files; package and manifest versions ${manifest.version}; manifest entrypoints and local HTML assets present.`);
