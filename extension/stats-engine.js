(function(root,factory){
  'use strict';
  const api=factory();
  root.StatsEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_BYTES=2*1024*1024,MAX_RECORDS=1000,MAX_EVENTS=50000;
  const HASH=/^[a-f0-9]{64}$/i;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ID=/^[a-z0-9][a-z0-9-]{0,79}$/;
  const BAD=new Set(['__proto__','prototype','constructor']);
  const fail=message=>{throw new Error(message);};
  function assertData(value,depth=0,budget={n:0}){
    if(++budget.n>100000||depth>32)fail('Statistics data is too large or deeply nested.');
    if(value===null||typeof value==='string'||typeof value==='boolean')return;
    if(typeof value==='number'){if(!Number.isFinite(value))fail('Statistics contain a non-finite number.');return;}
    if(typeof value!=='object')fail('Statistics must contain JSON data only.');
    const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
    if(array?proto!==Array.prototype:(proto!==Object.prototype&&proto!==null))fail('Statistics must contain plain objects and arrays.');
    if(Object.getOwnPropertySymbols(value).length)fail('Statistics cannot contain symbol properties.');
    const names=Object.keys(value);
    if(array&&(names.length!==value.length||names.some((k,i)=>k!==String(i))))fail('Statistics arrays cannot have holes or extra properties.');
    for(const key of names){
      if(BAD.has(key))fail('Statistics contain an unsafe property.');
      const d=Object.getOwnPropertyDescriptor(value,key);
      if(!d||!Object.prototype.hasOwnProperty.call(d,'value')||!d.enumerable)fail('Statistics cannot contain accessors or hidden properties.');
      assertData(d.value,depth+1,budget);
    }
  }
  function object(value,label,allowed){
    if(!value||typeof value!=='object'||Array.isArray(value)||(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))fail(label+' must be an object.');
    const keys=Object.keys(value);
    if(keys.some(k=>BAD.has(k)||!allowed.includes(k)))fail(label+' contains an unknown or unsafe field.');
  }
  function text(value,label,max,empty=false){if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))fail(label+' is invalid.');return value;}
  function timestamp(value,label,nullable=false){
    if(nullable&&value===null)return null;
    const pattern=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|([+-])(\d{2}):(\d{2}))$/;
    const match=typeof value==='string'&&value.length<=40?pattern.exec(value):null;
    if(!match||!Number.isFinite(Date.parse(value)))fail(label+' must be an ISO date-time.');
    const [,year,month,day,hour,minute,second,, ,offsetHour,offsetMinute]=match;
    const y=Number(year),m=Number(month),d=Number(day),h=Number(hour),min=Number(minute),s=Number(second);
    const monthDays=new Date(Date.UTC(2000,m,0)).getUTCDate();
    if(m<1||m>12||d<1||d>monthDays||h>23||min>59||s>59||(offsetHour&&(Number(offsetHour)>14||(Number(offsetHour)===14&&Number(offsetMinute)>0)||Number(offsetMinute)>59)))fail(label+' must be an ISO date-time.');
    return value;
  }
  function integer(value,label){if(!Number.isSafeInteger(value)||value<0)fail(label+' must be a nonnegative safe integer.');return value;}
  function checkSize(value,label){let raw;try{raw=JSON.stringify(value);}catch(_){fail(label+' must be valid JSON.');}if(new TextEncoder().encode(raw).length>MAX_BYTES)fail(label+' exceeds 2 MB.');}
  function validateSnapshot(input){
    assertData(input);
    object(input,'Snapshot',['format','schemaVersion','clientId','revision','updatedAt','records']);
    if(input.format!=='runtime-sop-statistics'||input.schemaVersion!==1)fail('Statistics snapshot format or version is invalid.');
    if(typeof input.clientId!=='string'||!UUID.test(input.clientId))fail('Client ID must be a UUID.');
    const revision=integer(input.revision,'Snapshot revision'),updatedAt=timestamp(input.updatedAt,'Snapshot updatedAt');
    if(!Array.isArray(input.records)||input.records.length>MAX_RECORDS)fail('Statistics record count is invalid.');
    const seen=new Set();
    const records=input.records.map(record=>{
      object(record,'Record',['workflowId','revisionHash','version','views','lastViewedAt','vote','note','feedbackAt','rating']);
      if(typeof record.workflowId!=='string'||!ID.test(record.workflowId))fail('Workflow ID is invalid or duplicated.');
      if(typeof record.revisionHash!=='string'||!HASH.test(record.revisionHash))fail('Revision hash must be SHA-256.');
      const recordKey=record.workflowId+'|'+record.revisionHash.toLowerCase();if(seen.has(recordKey))fail('Duplicate workflow revision record.');seen.add(recordKey);
      if(record.vote!==null&&record.vote!=='up'&&record.vote!=='down')fail('Vote must be up, down, or null.');
      if(record.rating!==undefined&&record.rating!==null&&(!Number.isInteger(record.rating)||record.rating<1||record.rating>5))fail('Rating must be 1 to 5 or null.');
      if((record.rating||record.vote||typeof record.note==='string'&&record.note.trim())&&record.feedbackAt===null)fail('Feedback requires a timestamp.');if(record.views>0&&record.lastViewedAt===null)fail('Views require a timestamp.');
      return {workflowId:record.workflowId,revisionHash:record.revisionHash.toLowerCase(),version:text(record.version,'Version',80),views:integer(record.views,'Views'),lastViewedAt:timestamp(record.lastViewedAt,'lastViewedAt',true),vote:record.vote,note:text(record.note,'Note',10000,true),feedbackAt:timestamp(record.feedbackAt,'feedbackAt',true),...(record.rating===undefined?{}:{rating:record.rating})};
    });
    const result={format:'runtime-sop-statistics',schemaVersion:1,clientId:input.clientId.toLowerCase(),revision,updatedAt,records};
    checkSize(result,'Statistics snapshot');
    return result;
  }
  function validateHistoryEvent(input){
    assertData(input);
    object(input,'Publication event',['format','schemaVersion','workflowId','sha256','version','publishedAt','previousSha256']);
    if(input.format!=='runtime-sop-publication'||input.schemaVersion!==1)fail('Publication event format or version is invalid.');
    if(typeof input.workflowId!=='string'||!ID.test(input.workflowId))fail('Publication workflow ID is invalid.');
    if(typeof input.sha256!=='string'||!HASH.test(input.sha256))fail('Publication hash must be SHA-256.');
    if(input.previousSha256!==null&&(typeof input.previousSha256!=='string'||!HASH.test(input.previousSha256)))fail('Previous publication hash must be SHA-256 or null.');
    return {format:'runtime-sop-publication',schemaVersion:1,workflowId:input.workflowId,sha256:input.sha256.toLowerCase(),version:text(input.version,'Publication version',80),publishedAt:timestamp(input.publishedAt,'publishedAt'),previousSha256:input.previousSha256===null?null:input.previousSha256.toLowerCase()};
  }
  function redactUrls(note){return note.replace(/(?:https?:\/\/|www\.)[^\s<>"'`]+/gi,'[link removed]');}
  function stable(value){return JSON.stringify(value);}
  function aggregate(snapshots=[],historyEvents=[]){
    if(!Array.isArray(snapshots)||snapshots.length>10000)fail('Snapshot list is invalid.');
    if(!Array.isArray(historyEvents)||historyEvents.length>MAX_EVENTS)fail('Publication history is invalid.');
    const clients=new Map();
    for(const raw of snapshots){
      const snap=validateSnapshot(raw),prior=clients.get(snap.clientId);
      if(!prior||snap.revision>prior.revision){clients.set(snap.clientId,snap);continue;}
      if(snap.revision===prior.revision&&stable(snap)!==stable(prior))fail('Conflicting snapshots have the same client ID and revision.');
    }
    const workflows=new Map();
    function row(id){let r=workflows.get(id);if(!r){r={views:0,likes:0,dislikes:0,feedbackCount:0,updateCount:0,publicationCount:0,notes:[],ratings:{1:0,2:0,3:0,4:0,5:0},hasRatings:false,ungradedRatings:0,hasRecords:false,hasHistory:false};workflows.set(id,r);}return r;}
    for(const [clientId,snap] of clients){
      const feedback=new Map();
      for(const record of snap.records){
        const r=row(record.workflowId);r.hasRecords=true;r.views+=record.views;
        if(!Number.isSafeInteger(r.views))fail('Aggregated view count exceeds the safe integer range.');
        const prior=feedback.get(record.workflowId);
        if(record.feedbackAt&&(!prior||Date.parse(record.feedbackAt)>Date.parse(prior.feedbackAt)))feedback.set(record.workflowId,record);
      }
      for(const record of feedback.values()){
        const r=row(record.workflowId);
        if(record.vote==='up')r.likes++;if(record.vote==='down')r.dislikes++;
        if(record.rating!==undefined)r.hasRatings=true;if(Number.isInteger(record.rating))r.ratings[record.rating]++;else if(record.vote)r.ungradedRatings++;
        if(record.note.trim()){r.feedbackCount++;r.notes.push({client:clientId.slice(0,8),version:record.version,date:record.feedbackAt,note:redactUrls(record.note),vote:record.vote,...(record.rating===undefined?{}:{rating:record.rating})});}
      }
    }
    const events=new Map();
    for(const raw of historyEvents){
      const event=validateHistoryEvent(raw),key=event.workflowId+'|'+event.sha256,old=events.get(key);
      if(old&&stable(old)!==stable(event))fail('Conflicting publication events reuse the same workflow hash.');
      if(!old)events.set(key,event);
    }
    for(const event of events.values()){
      const r=row(event.workflowId);r.hasHistory=true;r.publicationCount++;
      if(event.previousSha256!==null&&event.previousSha256!==event.sha256)r.updateCount++;
    }
    const result={clients:clients.size,workflows:{}};
    for(const [id,r] of workflows){
      result.workflows[id]={views:r.hasRecords?r.views:null,likes:r.hasRecords?r.likes:null,dislikes:r.hasRecords?r.dislikes:null,feedbackCount:r.hasRecords?r.feedbackCount:null,updateCount:r.hasHistory?r.updateCount:null,publicationCount:r.hasHistory?r.publicationCount:null,notes:r.notes,ratings:r.hasRatings?r.ratings:null,ungradedRatings:r.ungradedRatings};
    }
    return result;
  }
  return {validateSnapshot,validateHistoryEvent,aggregate,constants:{MAX_BYTES,MAX_RECORDS,MAX_EVENTS}};
});
