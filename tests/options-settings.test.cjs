'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Options = require('../extension/options.js');
const fs = require('node:fs');
const vm = require('node:vm');

test('workspace settings use a separate preference key and preserve guided preference',()=>{
  assert.equal(Options.PREFERENCES,'runtime-sop-workspace-preferences-v1');
  assert.deepEqual(Options.normalizePreferences({language:'en',guided:true,other:'kept by caller'}),{language:'en',guided:true});
  assert.deepEqual(Options.normalizePreferences({language:'fr',guided:false}),{language:'auto',guided:false});
});

test('NAS login URL defaults to the NAS host and only accepts credential-free HTTP(S)',()=>{
  assert.equal(Options.DEFAULT_LOGIN,'');
  assert.equal(Options.validateLoginUrl('https://nas.example.local/login?next=%2Fhome#form'),'https://nas.example.local/login?next=%2Fhome#form');
  for(const value of ['', 'file:///etc/passwd','javascript:alert(1)','https://user:secret@nas.example/','http://nas.example/'+'x'.repeat(2050)])assert.throws(()=>Options.validateLoginUrl(value));
});

test('login settings retain only URL, optional username, and local note, never password fields',()=>{
  assert.deepEqual(Options.normalizeLogin({loginUrl:'https://nas.example.local',username:'user',deviceHint:'Office PC',password:'secret'}),{
    loginUrl:'https://nas.example.local',username:'user',deviceHint:'Office PC'
  });
  assert.equal('password' in Options.normalizeLogin({loginUrl:'https://nas.example.local',password:'secret'}),false);
  assert.throws(()=>Options.normalizeLogin({loginUrl:'https://user:pass@nas.local'}));
});

test('explicit folder selection replaces malformed settings without enabling polling',async()=>{
  for(const previousEnabled of ['malformed',false,true]){
    const nodes=new Map(),messages=[];
    const node=id=>{
      if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(){}});
      return nodes.get(id);
    };
    let configured=false,selected=false,pickerCalls=0;
    const endpoint='sop-directory://00000000-0000-4000-8000-000000000001/catalog.json';
    const context={
      document:{documentElement:{dataset:{}},addEventListener(){},dispatchEvent(){},getElementById:node,querySelectorAll:()=>[]},
      location:{hash:''},Event:class{},
      chrome:{storage:{local:{get:async()=>({})},onChanged:{addListener(){}}},runtime:{sendMessage(request,reply){
        messages.push(request);
        if(request.type==='catalog-configure')configured=true;
        reply({status:{state:'ready'}});
      }}},
      WorkspaceI18n:{resolveLanguage:()=> 'en',getLanguage:()=> 'en',setLanguage(){},apply(){},t:value=>value},SOPIcons:{svg:()=>'',apply(){}},
      CatalogSync:{async info(){
        if(previousEnabled==='malformed'&&!configured)throw Error('Invalid previous endpoint');
        return {settings:{endpoint:configured?endpoint:'',enabled:configured?previousEnabled===true:previousEnabled},status:{state:configured?'ready':'unconfigured'}};
      }},
      SOPStorageSource:{chooseDirectory(){pickerCalls++;selected=true;return Promise.resolve({endpoint});},isEndpoint:value=>value.startsWith('sop-directory:'),async info(){return {selected,endpoint,name:'Synthetic'};}},
      ConnectionView:{state:()=>configured?'ready':'unconfigured',labels:{ready:['Connected']}}
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('../extension/options.js'),'utf8'),context);
    await context.WorkspaceOptions.init();
    const picking=node('choose-sop-folder').listeners.click();
    assert.equal(pickerCalls,1,'the picker still opens directly from the click');
    await picking;
    assert.equal(configured,true,`selection should recover ${previousEnabled} settings`);
    assert.deepEqual(JSON.parse(JSON.stringify(messages)),[
      {type:'catalog-configure',settings:{endpoint,enabled:previousEnabled===true}},
      {type:'catalog-check'}
    ]);
    assert.equal(node('choose-sop-folder').disabled,false);
  }
});
