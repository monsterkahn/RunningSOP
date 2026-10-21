'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const M = require('../extension/image-marks.js'), E = require('../extension/screenshot-redaction.js');
const region = {type:'mosaic',x:.251,y:.202,x2:.451,y2:.398};
const number = {type:'number',x:.5,y:.5};
function fixture(encode = () => 'data:image/jpeg;base64,/9j/4AA=') {
  const fills = [], draws = [];
  const ctx = {fillRect(...args) { fills.push({color:this.fillStyle,args}); },drawImage(...args) { draws.push(args); }};
  const canvas = {getContext:() => ctx,toDataURL:encode};
  const image = {naturalWidth:100,naturalHeight:50,src:'data:image/jpeg;base64,/9j/secret',ownerDocument:{createElement:type => {assert.equal(type,'canvas');return canvas;}}};
  return {image,canvas,fills,draws};
}
test('transient mosaic validation stays separate from persisted image marks', () => {
  assert.throws(() => M.validate([region]));
  assert.deepEqual(E.validate([{...region,x:region.x2,x2:region.x},number]),[region,number]);
  for (const bad of [{...region,url:'https://example.test/secret'}, {...region,x:NaN}, {...region,y2:1.1},Object.assign(Object.create({}),region)]) assert.throws(() => E.validate([bad]));
  const hidden = {...region};Object.defineProperty(hidden,'secret',{value:'private'});assert.throws(() => E.validate([hidden]));
  assert.throws(() => E.validate(Array.from({length:41},() => region)));
});
test('mosaic previews are opaque geometric patterns and move within image bounds', () => {
  const svg = E.renderSvg([number,region],100,50,1);
  assert.match(svg,/patternUnits="userSpaceOnUse"/);assert.match(svg,/fill="#a0a6ad"/);assert.match(svg,/stroke="#146ef5"/);
  assert.match(svg,/<rect x="25" y="10" width="21" height="10" fill="url\(#sop-redaction-grid\)"/);
  assert.doesNotMatch(svg,/image|filter|opacity|secret/);
  assert.equal(E.hitTest([number,region],{x:.3,y:.3},100,50),1);
  const moved = E.translate(region,1,1,100,50);assert.equal(moved.type,'mosaic');assert.ok(Math.abs(moved.x-.8)<1e-12);assert.ok(Math.abs(moved.y-.804)<1e-12);assert.equal(moved.x2,1);assert.equal(moved.y2,1);
});
test('redaction save replaces every covered pixel and returns only new JPEG bytes plus normal marks', () => {
  const x = fixture(), result = E.save(x.image,[number,region]);
  assert.deepEqual(Object.keys(result).sort(),['image','imageMarks']);assert.deepEqual(result.imageMarks,[number]);
  assert.notEqual(result.image,x.image.src);assert.equal(x.image.src,'data:image/jpeg;base64,/9j/secret');
  assert.equal(x.draws.length,1);assert.equal(x.draws[0][0],x.image);
  assert.deepEqual(x.fills[1],{color:'#a0a6ad',args:[25,10,21,10]});
  for (const fill of x.fills.slice(2)) { const [left,top,width,height] = fill.args;assert.ok(left>=25&&top>=10&&left+width<=46&&top+height<=20); }
  assert.equal(x.canvas.width,0);assert.equal(x.canvas.height,0);
});
test('mark-only saves avoid image recompression; failures preserve source and release canvas', () => {
  const markOnly = fixture();assert.deepEqual(E.save(markOnly.image,[number]),[number]);assert.equal(markOnly.draws.length,0);
  const failing = fixture(() => 'data:image/jpeg;base64,/9j/'+ 'A'.repeat(200*1024));
  assert.throws(() => E.save(failing.image,[region]),/200 KB/);assert.equal(failing.image.src,'data:image/jpeg;base64,/9j/secret');assert.equal(failing.canvas.width,0);
  const broken = fixture(() => {throw Error('Encoding failed');});assert.throws(() => E.save(broken.image,[region]),/Encoding failed/);assert.equal(broken.canvas.height,0);
  for (const [width,height] of [[0,50],[20001,1],[10000,5000]]) {const x=fixture();x.image.naturalWidth=width;x.image.naturalHeight=height;assert.throws(() => E.save(x.image,[region]),/尺寸/);assert.equal(x.draws.length,0);}
});
