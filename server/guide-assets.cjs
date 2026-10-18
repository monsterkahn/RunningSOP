'use strict';
const {createHash}=require('node:crypto');
const {validateGuide}=require('../extension/catalog-engine.js');
const statementCaches=new WeakMap();
function statement(db,sql){let cache=statementCaches.get(db);if(!cache){cache=new Map();statementCaches.set(db,cache);}if(!cache.has(sql))cache.set(sql,db.prepare(sql));return cache.get(sql);}
const FORMAT='team-guide-assets-v1',MAX_IMAGE=200*1024,MAX_GUIDE=4*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function images(guide,fn){for(const step of guide.steps){if(step.image!==undefined)step.image=fn(step.image);for(const issue of step.issues||[])if(issue.image!==undefined)issue.image=fn(issue.image);}}
function compactGuide(db,guide){
 const compact=JSON.parse(JSON.stringify(guide));
 const insert=statement(db,'INSERT OR IGNORE INTO assets(sha256,bytes,byteLength) VALUES(?,?,?)');
 const check=statement(db,'SELECT bytes,byteLength FROM assets WHERE sha256=? AND byteLength<=? AND length(bytes)<=?');
 images(compact,image=>{const encoded=image.slice(image.indexOf(',')+1),bytes=Buffer.from(encoded,'base64');if(bytes.length<1||bytes.length>MAX_IMAGE)throw Error('Image exceeds storage bound');const sha256=digest(bytes);insert.run(sha256,bytes,bytes.length);const stored=check.get(sha256,MAX_IMAGE,MAX_IMAGE);if(!stored||stored.byteLength!==bytes.length||!Buffer.from(stored.bytes).equals(bytes))throw Error('Asset integrity verification failed');const canonical=bytes.toString('base64');return {assetSha256:sha256,...(canonical===encoded?{}:{suffix:encoded.slice(-4)})};});
 return JSON.stringify({internalFormat:FORMAT,guide:compact});
}
// Read-only: suitable for offline backup verification without migrations or writes.
function reconstructGuide(db,serialized,expectedHash,expectedId){
 if(typeof serialized!=='string'||Buffer.byteLength(serialized)>MAX_GUIDE+65536)throw Error('Stored guide exceeds storage bound');
 let guide=JSON.parse(serialized);let total=0;
 if(guide&&guide.internalFormat===FORMAT){guide=guide.guide;if(!guide||!Array.isArray(guide.steps)||guide.steps.length>100)throw Error('Invalid compact guide');
 const read=statement(db,'SELECT bytes,byteLength FROM assets WHERE sha256=? AND byteLength<=? AND length(bytes)<=?');
 images(guide,ref=>{if(!ref||typeof ref!=='object'||Array.isArray(ref)||!Object.keys(ref).every(k=>['assetSha256','suffix'].includes(k))||!/^[a-f0-9]{64}$/.test(ref.assetSha256)||ref.suffix!==undefined&&(typeof ref.suffix!=='string'||!/^[A-Za-z0-9+/]{2,4}={0,2}$/.test(ref.suffix)||ref.suffix.length!==4))throw Error('Invalid image asset reference');const asset=read.get(ref.assetSha256,MAX_IMAGE,MAX_IMAGE);if(!asset||asset.byteLength<1||asset.byteLength!==asset.bytes.length||digest(asset.bytes)!==ref.assetSha256)throw Error('Missing or corrupt image asset');let encoded=Buffer.from(asset.bytes).toString('base64');if(ref.suffix){encoded=encoded.slice(0,-4)+ref.suffix;if(!Buffer.from(encoded,'base64').equals(Buffer.from(asset.bytes)))throw Error('Invalid image asset encoding');}const image='data:image/jpeg;base64,'+encoded;total+=Buffer.byteLength(image);if(total>MAX_GUIDE)throw Error('Reconstructed guide exceeds storage bound');return image;});}
 const json=JSON.stringify(guide);if(Buffer.byteLength(json)>MAX_GUIDE||digest(json)!==expectedHash||guide.workflowId!==expectedId)throw Error('Revision verification failed');
 const validated=validateGuide(guide);if(JSON.stringify(validated)!==json)throw Error('Stored guide is not canonical');return validated;
}
function verifyAssets(db){let assets=0,assetBytes=0;for(const row of statement(db,'SELECT sha256,byteLength,length(bytes) AS actualLength FROM assets').iterate()){if(row.byteLength<1||row.byteLength>MAX_IMAGE||row.byteLength!==row.actualLength)throw Error('Asset size verification failed');const data=statement(db,'SELECT bytes FROM assets WHERE sha256=?').get(row.sha256).bytes;if(digest(data)!==row.sha256)throw Error('Asset hash verification failed');assets++;assetBytes+=row.byteLength;}return {assets,assetBytes};}
module.exports={compactGuide,reconstructGuide,verifyAssets};
