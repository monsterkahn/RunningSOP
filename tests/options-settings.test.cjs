'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Options = require('../extension/options.js');

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
