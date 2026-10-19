'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../extension/image-marks.js');
test('annotation moves preserve geometry, clamp both drawing directions and retain strict schema',()=>{
 const box={type:'rect',x:.8,y:.9,x2:.3,y2:.2};
 const moved=M.translate(box,.8,-.8,1000,500);assert.equal(moved.x,1);assert.ok(Math.abs(moved.x2-.5)<1e-9);assert.equal(moved.y2,0);assert.ok(Math.abs(moved.y-.7)<1e-9);assert.deepEqual(M.validate([moved]),[moved]);assert.equal(box.x,.8);
 const number=M.translate({type:'number',x:.5,y:.5},3,-3,1000,500);assert.equal(number.x,.975);assert.ok(Math.abs(number.y-.05)<1e-9);
 assert.equal(M.hitTest([box,{type:'number',x:.5,y:.5}],{x:.5,y:.5},1000,500),1);assert.equal(M.hitTest([box],{x:.4,y:.5},1000,500),0);assert.equal(M.hitTest([box],{x:0,y:0},1000,500),-1);
 assert.throws(()=>M.validate([{...box,selected:true}]));
});
test('saved and preview rectangles share an eight-pixel corner radius without changing stored data',()=>{
 const marks=[{type:'rect',x:.1,y:.2,x2:.7,y2:.6}],svg=M.renderSvg(marks,1000,500);assert.equal((svg.match(/rx="8" ry="8"/g)||[]).length,2);assert.match(M.editorSvg(marks,1000,500,0),/stroke-dasharray/);assert.doesNotMatch(svg,/stroke-dasharray/);assert.match(M.renderSvg([{type:'rect',x:0,y:0,x2:.005,y2:.002}],1000,500),/rx="0.5"/);
});
