(function(root){
 'use strict';
 const MAX_REQUESTS=50,MAX_BYTES=4*1024*1024+65536;
 function validKey(key){if(typeof key!=='string'||!key||key.length>4096)throw Error('Invalid private request key.');}
 async function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('running-sop-team-pending',1);request.onupgradeneeded=()=>request.result.createObjectStore('requests');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Private pending request storage unavailable.'));});}
 async function transaction(mode,action){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('requests',mode),store=tx.objectStore('requests');let result;try{action(store,value=>{result=value;},tx);}catch(error){tx.abort();reject(error);return;}tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(Error('Private pending request storage unavailable.'));});}finally{db.close();}}
 async function read(key){validKey(key);return transaction('readonly',(store,done)=>{const request=store.get(key);request.onsuccess=()=>done(request.result);});}
 async function clear(key){validKey(key);return transaction('readwrite',store=>store.delete(key));}
 async function save(key,value){validKey(key);if(value===undefined)throw Error('Missing pending request.');const copy=structuredClone(value);if(new TextEncoder().encode(JSON.stringify(copy)).byteLength>MAX_BYTES)throw Error('Pending request exceeds storage limit.');
  return transaction('readwrite',(store,done,tx)=>{const current=store.get(key);current.onsuccess=()=>{if(current.result!==undefined){store.put(copy,key);return;}const count=store.count();count.onsuccess=()=>{if(count.result>=MAX_REQUESTS){tx.abort();return;}store.put(copy,key);};};});
 }
 // Called only after the user confirms deletion of this exact local draft.
 // A snapshot-based orphan sweep could race a draft created in another window.
 async function deleteDraft(id){if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw Error('Invalid draft identity.');return transaction('readwrite',store=>{const cursor=store.openKeyCursor();cursor.onsuccess=()=>{const entry=cursor.result;if(!entry)return;const key=entry.key;if(typeof key==='string'&&key.slice(key.lastIndexOf('|')+1)===id)store.delete(key);entry.continue();};});}
 root.RunningSOPTeamPending=Object.freeze({read,save,clear,deleteDraft});
})(globalThis);
