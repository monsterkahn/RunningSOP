const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const images=[],elements={};let permissionCalls=0,tabResolve,sessionWrites=0;
 function node(){return {childNodes:[],textContent:'',open:false,append(...n){this.childNodes.push(...n);},replaceChildren(...n){this.childNodes=n;},addEventListener(){},removeEventListener(){},showModal(){this.open=true;},close(){this.open=false;}};}
 for(const id of ['image-dialog','large-picture','image-title','view-status'])elements[id]=node();
 const context={window:{ImageMarks:{validate:x=>x||[],renderSvg:()=>''}},document:{getElementById:id=>elements[id],createElement:node},Image:class{constructor(){images.push(this);}set src(v){this.value=v;}},URL,AbortController,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,setInterval,clearInterval};
 vm.runInNewContext(fs.readFileSync('extension/screenshot-editor.js','utf8'),context);
 return {editor:context.window.ScreenshotEditor,elements,images,context,decode(){const i=images.at(-1);i.naturalWidth=20;i.naturalHeight=20;i.onload();},native(){context.chrome={permissions:{request(){permissionCalls++;return Promise.resolve(true);}},tabs:{get:()=>new Promise(r=>tabResolve=r)},scripting:{executeScript:async()=>[]},storage:{session:{set:async()=>{sessionWrites++;}},onChanged:{addListener(){},removeListener(){}}}};},get permissionCalls(){return permissionCalls;},get writes(){return sessionWrites;},tab(){tabResolve({active:true,url:'https://example.test/a'});}};
}
const shot={image:'data:image/png;base64,AAAA',imageMarks:[]};
const tick=()=>new Promise(r=>setImmediate(r));
test('view verifies identity after detached decode before inserting screenshot',async()=>{const x=setup();let valid=true;const promise=x.editor.view(shot,'test',null,undefined,{verify:async()=>valid});await tick();assert.equal(x.images.length,1);assert.equal(x.elements['large-picture'].childNodes.length,0);valid=false;x.decode();assert.equal(await promise,null);assert.equal(x.elements['image-dialog'].open,false);assert.equal(x.elements['large-picture'].childNodes.length,0);});
test('closeView invalidates decoding while a newer view can open',async()=>{const x=setup();const old=x.editor.view(shot);await tick();await x.editor.closeView();const fresh=x.editor.view(shot);await tick();const first=x.images[0];first.naturalWidth=20;first.naturalHeight=20;first.onload();assert.equal(await old,null);x.decode();assert.equal((await fresh).opened,true);assert.equal(x.elements['image-dialog'].open,true);await x.editor.closeView();assert.equal(x.elements['image-dialog'].open,false);assert.equal(x.elements['large-picture'].childNodes.length,0);});
test('abort after tab lookup prevents session storage and fallback; access begins synchronously',async()=>{const x=setup();x.native();const controller=new AbortController();const promise=x.editor.view(shot,'test',{tabId:1,url:'https://example.test/a'},undefined,{signal:controller.signal});assert.equal(x.permissionCalls,1);await tick();controller.abort();x.tab();assert.equal(await promise,null);assert.equal(x.writes,0);assert.equal(x.images.length,0);});
test('abort during session write removes late secret and never mounts or decodes',async()=>{
 const x=setup(),controller=new AbortController(),removed=[],scripts=[];let finishWrite,writes=0;
 x.context.chrome={permissions:{request:async()=>true},tabs:{get:async()=>({active:true,url:'https://example.test/a'})},scripting:{executeScript:async value=>{scripts.push(value);return [{result:true}];}},runtime:{getURL:x=>x},storage:{session:{set:()=>{writes++;return new Promise(r=>finishWrite=r);},remove:async key=>removed.push(key)},onChanged:{addListener(){},removeListener(){}}}};
 const promise=x.editor.view(shot,'test',{tabId:1,url:'https://example.test/a'},undefined,{signal:controller.signal});await tick();assert.equal(writes,1);controller.abort();finishWrite();assert.equal(await promise,null);await tick();assert(removed.length>=1);assert.equal(scripts.some(x=>x.files),false);assert.equal(x.images.length,0);
});
test('closeView leaves a pending edit overlay session untouched',async()=>{
 const x=setup();let writes=0,removes=0,listener,key;
 x.context.chrome={tabs:{get:async()=>({active:true,url:'https://example.test/a'})},scripting:{executeScript:async()=>[{result:true}]},runtime:{getURL:x=>x},storage:{session:{set:async value=>{writes++;key=Object.keys(value)[0];},remove:async()=>{removes++;}},onChanged:{addListener:fn=>listener=fn,removeListener(){}}}};
 const promise=x.editor.open(shot,'edit',{tabId:1,url:'https://example.test/a'},Promise.resolve(true));await tick();await x.editor.closeView();assert.equal(writes,1);assert.equal(removes,0);
 listener({[key]:{newValue:{ready:true,result:[]}}},'session');assert.deepEqual(Array.from(await promise),[]);assert.equal(removes,1);
});
