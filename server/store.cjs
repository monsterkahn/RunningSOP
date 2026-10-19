'use strict';
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,randomUUID,createHash}=require('node:crypto');
const {validateGuide}=require('../extension/catalog-engine.js');
const {compactGuide,reconstructGuide,readGuideImage}=require('./guide-assets.cjs');
class ServiceError extends Error { constructor(status,code,message){super(message);this.status=status;this.code=code;} }
const fail=(s,c,m)=>{throw new ServiceError(s,c,m);};
const hash=s=>createHash('sha256').update(s).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
class TeamStore {
 constructor({dbPath,now=Date.now,leaseMs=120000}){
  if(!Number.isSafeInteger(leaseMs)||leaseMs<1)throw new TypeError('Invalid lease duration');
  this.now=now;this.leaseMs=leaseMs;this.db=new DatabaseSync(dbPath);this.statements=new Map();this.termCounts=new Map();
  try{this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  this.tx(()=>{const v=this.db.prepare('PRAGMA user_version').get().user_version;if(v>6)fail(500,'schema_version','Database schema is newer than this service');
  if(v===0)this.db.exec(`CREATE TABLE actors(id TEXT PRIMARY KEY,name TEXT NOT NULL); CREATE TABLE sessions(token TEXT PRIMARY KEY,actor TEXT NOT NULL REFERENCES actors(id),expires INTEGER NOT NULL);
 CREATE INDEX sessions_actor_expiry ON sessions(actor,expires);
 CREATE TABLE workflows(id TEXT PRIMARY KEY,title TEXT NOT NULL,revision INTEGER NOT NULL,sha256 TEXT NOT NULL,updatedAt INTEGER NOT NULL,category TEXT NOT NULL DEFAULT '',fence INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX workflow_listing ON workflows(updatedAt DESC,id); CREATE INDEX workflow_category ON workflows(category,updatedAt DESC,id);
 CREATE TABLE revisions(id TEXT NOT NULL REFERENCES workflows(id),revision INTEGER NOT NULL,sha256 TEXT NOT NULL,guide TEXT NOT NULL,updatedAt INTEGER NOT NULL,PRIMARY KEY(id,revision));
 CREATE TABLE matches(matchKey TEXT NOT NULL,id TEXT NOT NULL REFERENCES workflows(id),PRIMARY KEY(matchKey,id));
 CREATE TABLE leases(id TEXT PRIMARY KEY REFERENCES workflows(id),actor TEXT NOT NULL REFERENCES actors(id),token TEXT NOT NULL,fence INTEGER NOT NULL,expires INTEGER NOT NULL,baseRevision INTEGER NOT NULL);
 CREATE TABLE idempotency(actor TEXT NOT NULL REFERENCES actors(id),key TEXT NOT NULL,payload TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(actor,key)); PRAGMA user_version=1;`);
  if(v<2){this.db.exec("CREATE VIRTUAL TABLE title_search USING fts5(id UNINDEXED, grams, tokenize='unicode61'); ALTER TABLE workflows ADD COLUMN normalizedTitle TEXT NOT NULL DEFAULT '';");for(const row of this.db.prepare('SELECT rowid,id,title FROM workflows').iterate()){const normalized=this.normalTitle(row.title);this.db.prepare('UPDATE workflows SET normalizedTitle=? WHERE id=?').run(normalized,row.id);this.db.prepare('INSERT INTO title_search(rowid,id,grams) VALUES(?,?,?)').run(row.rowid,row.id,this.grams(normalized).join(' '));}this.db.exec('PRAGMA user_version=2');}
  if(v<3)this.db.exec(`CREATE TABLE categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,parentId TEXT REFERENCES categories(id),color TEXT NOT NULL,icon TEXT NOT NULL,revision INTEGER NOT NULL,updatedAt INTEGER NOT NULL); CREATE INDEX category_parent ON categories(parentId,id); ALTER TABLE workflows ADD COLUMN categoryRevision INTEGER NOT NULL DEFAULT 0; CREATE TABLE category_audit(sequence INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,categoryId TEXT,workflowId TEXT,actorId TEXT NOT NULL REFERENCES actors(id),updatedAt INTEGER NOT NULL,beforeJson TEXT NOT NULL,afterJson TEXT NOT NULL); CREATE INDEX category_audit_category ON category_audit(categoryId,sequence DESC); CREATE INDEX category_audit_workflow ON category_audit(workflowId,sequence DESC); PRAGMA user_version=3;`);
  if(v<4)this.db.exec(`CREATE TABLE assets(sha256 TEXT PRIMARY KEY,bytes BLOB NOT NULL,byteLength INTEGER NOT NULL CHECK(byteLength BETWEEN 1 AND 204800)); PRAGMA user_version=4;`);if(v<5)this.db.exec('CREATE INDEX IF NOT EXISTS matches_workflow ON matches(id); PRAGMA user_version=5');if(v<6)this.db.exec('ALTER TABLE revisions ADD COLUMN wireBytes INTEGER CHECK(wireBytes BETWEEN 0 AND 4194304); PRAGMA user_version=6');});this.db.exec("CREATE VIRTUAL TABLE temp.title_terms USING fts5vocab(main,title_search,'row')");}catch(e){this.db.close();throw e;}
 }
 close(){this.db.close();}
 q(sql){if(!this.statements.has(sql))this.statements.set(sql,this.db.prepare(sql));return this.statements.get(sql);}
 tx(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 actor(actor){if(!actor||typeof actor.id!=='string')fail(401,'unauthorized','Valid session required');const a=this.q('SELECT a.id,a.name FROM actors a WHERE a.id=? AND EXISTS(SELECT 1 FROM sessions s WHERE s.actor=a.id AND s.expires>?)').get(actor.id,this.now());if(!a)fail(401,'unauthorized','Valid session required');return a;}
 createSession({displayName}={}){if(typeof displayName!=='string'||!displayName.trim()||displayName.length>80||/[\x00-\x1f]/.test(displayName))fail(400,'invalid_name','Display name must contain 1–80 characters');return this.tx(()=>{const actor={id:randomUUID(),name:displayName.trim()},token=secret(),expiresAt=this.now()+30*86400000;this.q('INSERT INTO actors VALUES(?,?)').run(actor.id,actor.name);this.q('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),actor.id,expiresAt);return {token,actor,expiresAt};});}
 authenticate(token){if(typeof token!=='string'||token.length>128)fail(401,'unauthorized','Valid session required');const a=this.q('SELECT a.id,a.name FROM sessions s JOIN actors a ON a.id=s.actor WHERE s.token=? AND s.expires>?').get(hash(token),this.now());if(!a)fail(401,'unauthorized','Session expired or invalid');return {...a};}
 normalize(input){try{const guide=validateGuide(input),json=JSON.stringify(guide);if(Buffer.byteLength(json)>4*1024*1024)throw Error('Guide exceeds 4 MiB');return {guide,json,sha256:hash(json)};}catch(e){fail(400,'invalid_guide',e.message);}}
 idem(actor,key,payload,fn){if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{8,128}$/.test(key))fail(400,'invalid_idempotency_key','Idempotency key must contain 8–128 safe characters');const digest=hash(JSON.stringify(payload)),old=this.q('SELECT payload,response FROM idempotency WHERE actor=? AND key=?').get(actor.id,key);if(old){if(old.payload!==digest)fail(409,'idempotency_conflict','Key already used for another request');return this.replay(JSON.parse(old.response));}const result=fn();const saved=result&&result.guide&&typeof result.id==='string'&&Number.isSafeInteger(result.revision)&&typeof result.sha256==='string'?{internalFormat:'team-guide-result-v1',id:result.id,revision:result.revision,sha256:result.sha256}:result;this.q('INSERT INTO idempotency VALUES(?,?,?,?)').run(actor.id,key,digest,JSON.stringify(saved));return result;}
 replay(saved){if(saved&&saved.internalFormat==='team-guide-result-v1'){const result=this.result(saved.id,saved.revision);if(result.sha256!==saved.sha256)fail(500,'stored_integrity','Stored replay reference failed integrity verification');return result;}return saved;}
 row(id){const row=this.q('SELECT * FROM workflows WHERE id=?').get(id);if(!row)fail(404,'not_found','SOP not found');return row;}
 result(id,revision){const r=this.q('SELECT id,revision,sha256,guide FROM revisions WHERE id=? AND revision=?').get(id,revision);if(!r)fail(404,'not_found','Revision not found');try{return {...r,guide:reconstructGuide(this.db,r.guide,r.sha256,id)};}catch{fail(500,'stored_integrity','Stored guide or image failed integrity verification');}}
 keys(guide){return [...new Set(guide.steps.filter(s=>s.workUrl).map(s=>this.urlKey(s.workUrl)).filter(Boolean))];}
 urlKey(value){try{const u=new URL(value);if(u.username||u.password)return null;if(u.protocol==='file:')return u.href===value?'file:'+u.href:null;if(['http:','https:'].includes(u.protocol))return 'web:'+u.origin+u.pathname;}catch{}return null;}
 normalTitle(title){return title.normalize('NFKC').toLowerCase();}
 grams(title){const chars=Array.from(title),out=new Set();for(let i=0;i<chars.length-1;i++)out.add(Buffer.from(chars[i]+chars[i+1]).toString('hex'));return [...out];}
 write(id,n,revision){this.termCounts.clear();const t=this.now();if(revision===1)this.q('INSERT INTO workflows(id,title,revision,sha256,updatedAt) VALUES(?,?,?,?,?)').run(id,n.guide.title,revision,n.sha256,t);else this.q('UPDATE workflows SET title=?,revision=?,sha256=?,updatedAt=? WHERE id=?').run(n.guide.title,revision,n.sha256,t,id);const normalized=this.normalTitle(n.guide.title);this.q('UPDATE workflows SET normalizedTitle=? WHERE id=?').run(normalized,id);const searchRow=this.q('SELECT rowid FROM workflows WHERE id=?').get(id).rowid;this.q('DELETE FROM title_search WHERE rowid=?').run(searchRow);this.q('INSERT INTO title_search(rowid,id,grams) VALUES(?,?,?)').run(searchRow,id,this.grams(normalized).join(' '));this.q('INSERT INTO revisions(id,revision,sha256,guide,updatedAt,wireBytes) VALUES(?,?,?,?,?,?)').run(id,revision,n.sha256,compactGuide(this.db,n.guide),t,Buffer.byteLength(n.json));this.q('DELETE FROM matches WHERE id=?').run(id);for(const key of this.keys(n.guide))this.q('INSERT INTO matches VALUES(?,?)').run(key,id);return this.result(id,revision);}
 create(guide,{actor,idempotencyKey}={}){const n=this.normalize(guide);return this.tx(()=>{actor=this.actor(actor);return this.idem(actor,idempotencyKey,['create',n.json],()=>{if(this.q('SELECT id FROM workflows WHERE id=?').get(n.guide.workflowId))fail(409,'already_exists','SOP already exists');return this.write(n.guide.workflowId,n,1);});});}
 estimatedReadBytes(id,{revision}={}){const current=this.row(id);const row=this.q("SELECT coalesce(wireBytes,CASE WHEN substr(guide,1,60) LIKE '%team-guide-assets-v1%' THEN 4194304 ELSE length(CAST(guide AS BLOB)) END) AS bytes FROM revisions WHERE id=? AND revision=?").get(id,revision??current.revision);if(!row)fail(404,'not_found','Revision not found');return row.bytes+1024;}
 get(id,{revision}={}){const r=this.row(id);if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<1))fail(400,'invalid_revision','Invalid revision');return this.result(id,revision??r.revision);}
 getView(id,options={}){
  const full=this.get(id,options),guide=JSON.parse(JSON.stringify(full.guide)),images=[];
  const strip=(target,step,issue)=>{if(target.image!==undefined){images.push({step,...(issue===undefined?{}:{issue}),sha256:hash(target.image),...(target.imageAt===undefined?{}:{imageAt:target.imageAt}),...(target.imageMarks===undefined?{}:{imageMarks:target.imageMarks})});}delete target.image;delete target.imageAt;delete target.imageMarks;};
  guide.steps.forEach((step,index)=>{strip(step,index);(step.issues||[]).forEach((issue,i)=>strip(issue,index,i));});
  return {id:full.id,revision:full.revision,sha256:full.sha256,viewSha256:hash(JSON.stringify({guide,images})),guide,images};
 }
 getImage(id,{revision,step,issue}={}){
  if(!Number.isSafeInteger(revision)||revision<1)fail(400,'invalid_revision','Exact revision required');
  if(!Number.isSafeInteger(step)||step<0||step>=100||issue!==undefined&&(!Number.isSafeInteger(issue)||issue<0||issue>=10))fail(400,'invalid_index','Invalid image index');
  this.row(id);const row=this.q('SELECT guide,sha256 FROM revisions WHERE id=? AND revision=?').get(id,revision);if(!row)fail(404,'not_found','Revision not found');
  let image;try{image=readGuideImage(this.db,row.guide,row.sha256,id,step,issue);}catch{fail(500,'stored_integrity','Stored guide or image failed integrity verification');}
  if(image===null)fail(404,'not_found','Image not found');
  return {id,revision,step,...(issue===undefined?{}:{issue}),sha256:hash(image),image};
 }
 cursor(value){if(!value)return null;try{const v=JSON.parse(Buffer.from(value,'base64url').toString());if(!Array.isArray(v)||v.length!==2||!Number.isSafeInteger(v[0])||typeof v[1]!=='string'||v[1].length>80)throw Error();return v;}catch{fail(400,'invalid_cursor','Invalid cursor');}}
 limit(n){if(!Number.isSafeInteger(n)||n<1||n>200)fail(400,'invalid_limit','Limit must be between 1 and 200');return n;}
 list({query='',category='',cursor='',limit=50,uncategorized=false}={}){
  this.limit(limit);
  if(typeof query!=='string'||query.length>120||typeof category!=='string'||category.length>160||typeof uncategorized!=='boolean'||uncategorized&&category)fail(400,'invalid_query','Invalid query');
  const dataVersion=this.q('PRAGMA data_version').get().data_version;if(this.searchDataVersion!==dataVersion){this.termCounts.clear();this.searchDataVersion=dataVersion;}
  const normalized=this.normalTitle(query);
  if(normalized&&Array.from(normalized).length<2)fail(400,'invalid_query','Search requires at least two characters');
  const c=this.cursor(cursor),args=[],where=[];
  if(category||uncategorized){where.push('w.category=?');args.push(category);}
  if(c){where.push('(w.updatedAt<? OR (w.updatedAt=? AND w.id>?))');args.push(c[0],c[0],c[1]);}
  const clause=where.length?'WHERE '+where.join(' AND '):'';
  const columns="w.id,w.title,w.revision,w.sha256,w.updatedAt,NULLIF(w.category,'') AS categoryId,w.categoryRevision";
  const finish=rows=>{const more=rows.length>limit;rows.length=Math.min(rows.length,limit);return {items:rows.map(r=>({...r})),nextCursor:more?Buffer.from(JSON.stringify([rows.at(-1).updatedAt,rows.at(-1).id])).toString('base64url'):''};};
  if(!normalized){
   if(!c)return finish(this.q(`SELECT ${columns} FROM workflows w ${clause} ORDER BY w.updatedAt DESC,w.id LIMIT ?`).all(...args,limit+1));
   // Separate equality and older-time seeks keep deep pages from rescanning
   // all preceding records in a mixed DESC-time/ASC-identity index.
   const base=category||uncategorized?'w.category=? AND ':'',baseArgs=category||uncategorized?[category]:[];
   const equal=this.q(`SELECT ${columns} FROM workflows w WHERE ${base}w.updatedAt=? AND w.id>? ORDER BY w.updatedAt DESC,w.id LIMIT ?`).all(...baseArgs,c[0],c[1],limit+1);
   if(equal.length>limit)return finish(equal);
   const older=this.q(`SELECT ${columns} FROM workflows w WHERE ${base}w.updatedAt<? ORDER BY w.updatedAt DESC,w.id LIMIT ?`).all(...baseArgs,c[0],limit+1-equal.length);
   return finish([...equal,...older]);
  }
  const terms=this.grams(normalized);
  // Common terms can match almost the entire library. Avoid sorting every hit:
  // inspect a bounded recent window in listing-index order first. Return it only
  // when it proves the exact first page; otherwise retain the complete FTS path.
  let frequent=true;
  for(const term of terms){let doc=this.termCounts.get(term);if(doc===undefined){doc=this.q('SELECT doc FROM temp.title_terms WHERE term=?').get(term)?.doc||0;if(this.termCounts.size>=1024)this.termCounts.delete(this.termCounts.keys().next().value);this.termCounts.set(term,doc);}if(!doc)return finish([]);if(doc<=4096){frequent=false;break;}}
  if(frequent){
   const hits=this.q(`WITH recent AS MATERIALIZED (SELECT ${columns},w.normalizedTitle FROM workflows w ${clause} ORDER BY w.updatedAt DESC,w.id LIMIT 512) SELECT id,title,revision,sha256,updatedAt,categoryId,categoryRevision FROM recent WHERE instr(normalizedTitle,?)>0 ORDER BY updatedAt DESC,id LIMIT ?`).all(...args,normalized,limit+1);
   if(hits.length>limit)return finish(hits);
  }
  const filter=['title_search MATCH ?','instr(w.normalizedTitle,?)>0',...where];
  return finish(this.q(`SELECT ${columns} FROM title_search JOIN workflows w ON w.id=title_search.id WHERE ${filter.join(' AND ')} ORDER BY w.updatedAt DESC,w.id LIMIT ?`).all(terms.map(g=>`"${g}"`).join(' AND '),normalized,...args,limit+1));
 }
 match(url){if(typeof url!=='string'||url.length>2048)return {state:'none',items:[]};const key=this.urlKey(url);if(!key)return {state:'none',items:[]};const rows=this.q("SELECT w.id,w.title,w.revision,w.sha256,w.updatedAt,NULLIF(w.category,'') AS categoryId,w.categoryRevision FROM matches m JOIN workflows w ON w.id=m.id WHERE m.matchKey=? ORDER BY w.id LIMIT 201").all(key);const overflow=rows.length>200;return {state:overflow||rows.length>1?'ambiguous':rows.length?'matched':'none',items:rows.slice(0,200).map(r=>({...r})),...(overflow?{overflow:true}:{})};}
 leaseResult(l){return {serverTime:this.now(),leaseMs:this.leaseMs,token:l.rawToken,fence:l.fence,expiresAt:l.expires,owner:{id:l.actor,name:l.name},baseRevision:l.baseRevision};}
 lockInfo(id){this.row(id);const l=this.q('SELECT l.*,a.name FROM leases l JOIN actors a ON a.id=l.actor WHERE l.id=? AND l.expires>?').get(id,this.now());if(!l)return null;return {owner:{id:l.actor,name:l.name},expiresAt:l.expires,baseRevision:l.baseRevision,fence:l.fence,serverTime:this.now(),leaseMs:this.leaseMs};}
 acquireLock(id,{actor}={}){return this.tx(()=>{actor=this.actor(actor);const r=this.row(id),old=this.q('SELECT * FROM leases WHERE id=?').get(id);if(old&&old.expires>this.now())fail(409,'locked','SOP is already being edited');const token=secret(),fence=r.fence+1,expires=this.now()+this.leaseMs;this.q('UPDATE workflows SET fence=? WHERE id=?').run(fence,id);this.q('INSERT OR REPLACE INTO leases VALUES(?,?,?,?,?,?)').run(id,actor.id,hash(token),fence,expires,r.revision);return this.leaseResult({actor:actor.id,name:actor.name,rawToken:token,fence,expires,baseRevision:r.revision});});}
 validLease(id,actor,token,fence){const l=this.q('SELECT * FROM leases WHERE id=?').get(id);if(!l||l.actor!==actor.id||typeof token!=='string'||l.token!==hash(token)||l.fence!==fence||l.expires<=this.now())fail(409,'stale_lock','Editing lease is expired or no longer valid');return l;}
 renewLock(id,{actor,token,fence}={}){return this.tx(()=>{actor=this.actor(actor);const l=this.validLease(id,actor,token,fence);l.expires=this.now()+this.leaseMs;this.q('UPDATE leases SET expires=? WHERE id=?').run(l.expires,id);return this.leaseResult({...l,name:actor.name,rawToken:token});});}
 releaseLock(id,{actor,token,fence}={}){return this.tx(()=>{actor=this.actor(actor);this.validLease(id,actor,token,fence);this.q('DELETE FROM leases WHERE id=?').run(id);return {released:true};});}
 publish(id,guide,{actor,token,fence,expectedRevision,idempotencyKey}={}){const n=this.normalize(guide);if(n.guide.workflowId!==id)fail(400,'identity_mismatch','Guide identity does not match');return this.tx(()=>{actor=this.actor(actor);return this.idem(actor,idempotencyKey,['publish',id,n.json,token,fence,expectedRevision],()=>{const l=this.validLease(id,actor,token,fence),r=this.row(id);if(!Number.isSafeInteger(expectedRevision)||r.revision!==expectedRevision||l.baseRevision!==expectedRevision)fail(409,'revision_conflict','SOP revision changed');const result=this.write(id,n,r.revision+1);this.q('DELETE FROM leases WHERE id=?').run(id);return result;});});}
 history(id,{limit=50,cursor=''}={}){this.row(id);this.limit(limit);let before=Number.MAX_SAFE_INTEGER;if(cursor){if(!/^[1-9][0-9]{0,15}$/.test(cursor)||!Number.isSafeInteger(Number(cursor)))fail(400,'invalid_cursor','Invalid history cursor');before=Number(cursor);}const rows=this.q('SELECT id,revision,sha256,updatedAt FROM revisions WHERE id=? AND revision<? ORDER BY revision DESC LIMIT ?').all(id,before,limit+1);const more=rows.length>limit;rows.length=Math.min(rows.length,limit);return {items:rows.map(r=>({...r})),nextCursor:more?String(rows.at(-1).revision):''};}
}
require('./category-store.cjs')(TeamStore,fail);
module.exports={TeamStore,ServiceError};
