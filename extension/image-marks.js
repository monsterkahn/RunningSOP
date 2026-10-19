'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ImageMarks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_MARKS = 40;
  const MAX_DIMENSION = 20000;
  const NUMBER_KEYS = ['type', 'x', 'y'];
  const SHAPE_KEYS = ['type', 'x', 'y', 'x2', 'y2'];

  function invalid() { throw new TypeError('截图标记格式无效'); }
  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function validate(marks) {
    if (marks === undefined) return [];
    if (!Array.isArray(marks) || marks.length > MAX_MARKS) invalid();
    return marks.map(mark => {
      if (!isPlainObject(mark)) invalid();
      const keys = Reflect.ownKeys(mark).sort();
      if (keys.some(key => typeof key !== 'string')) invalid();
      if (mark.type === 'number') {
        if (keys.length !== NUMBER_KEYS.length || keys.join(',') !== NUMBER_KEYS.slice().sort().join(',')) invalid();
      } else if (mark.type === 'arrow' || mark.type === 'rect') {
        if (keys.length !== SHAPE_KEYS.length || keys.join(',') !== SHAPE_KEYS.slice().sort().join(',')) invalid();
      } else invalid();
      for (const key of keys) {
        if (key === 'type') continue;
        if (typeof mark[key] !== 'number' || !Number.isFinite(mark[key]) || mark[key] < 0 || mark[key] > 1) invalid();
      }
      return mark.type === 'number'
        ? { type: 'number', x: mark.x, y: mark.y }
        : { type: mark.type, x: mark.x, y: mark.y, x2: mark.x2, y2: mark.y2 };
    });
  }
  function fmt(value) {
    return String(Math.round(value * 1000) / 1000);
  }
  function renderSvg(marks, width, height) {
    const clean = validate(marks);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new RangeError('截图尺寸无效');
    }
    const shortSide = Math.min(width, height);
    const radius = Math.max(10, shortSide * 0.05);
    const stroke = Math.max(2, shortSide * 0.009);
    const fontSize = Math.max(11, radius * 1.08);
    const nodes = [];
    let number = 0;
    for (const mark of clean) {
      const x = mark.x * width;
      const y = mark.y * height;
      if (mark.type === 'number') {
        number += 1;
        nodes.push(`<g aria-label="${number}"><circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(radius)}" fill="#ef3340" stroke="#fff" stroke-width="${fmt(stroke)}"/><text x="${fmt(x)}" y="${fmt(y)}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-family="Arial,sans-serif" font-size="${fmt(fontSize)}" font-weight="700">${number}</text></g>`);
      } else if (mark.type === 'arrow') {
        const x2 = mark.x2 * width;
        const y2 = mark.y2 * height;
        const outer = Math.max(5, stroke * 2.6);
        const inner = Math.max(2.5, stroke * 1.15);
        const dx = x2 - x;
        const dy = y2 - y;
        const length = Math.hypot(dx, dy);
        let head = '';
        if (length > 0) {
          const ux = dx / length;
          const uy = dy / length;
          const headLength = Math.min(length * 0.45, Math.max(8, stroke * 4));
          const halfWidth = headLength * 0.58;
          const baseX = x2 - ux * headLength;
          const baseY = y2 - uy * headLength;
          const wingX = -uy * halfWidth;
          const wingY = ux * halfWidth;
          const leftX = baseX + wingX;
          const leftY = baseY + wingY;
          const rightX = baseX - wingX;
          const rightY = baseY - wingY;
          const triangle = `M ${fmt(x2)} ${fmt(y2)} L ${fmt(leftX)} ${fmt(leftY)} L ${fmt(rightX)} ${fmt(rightY)} Z`;
          head = `<path d="${triangle}" fill="#fff" stroke="#fff" stroke-width="${fmt(Math.max(2, stroke * 1.2))}" stroke-linejoin="round"/><path d="${triangle}" fill="#ef3340" stroke="#ef3340" stroke-width="${fmt(Math.max(1, stroke * 0.25))}" stroke-linejoin="round"/>`;
        }
        nodes.push(`<g><path d="M ${fmt(x)} ${fmt(y)} L ${fmt(x2)} ${fmt(y2)}" fill="none" stroke="#fff" stroke-width="${fmt(outer)}" stroke-linecap="round"/><path d="M ${fmt(x)} ${fmt(y)} L ${fmt(x2)} ${fmt(y2)}" fill="none" stroke="#ef3340" stroke-width="${fmt(inner)}" stroke-linecap="round"/>${head}</g>`);
      } else {
        const x2 = mark.x2 * width;
        const y2 = mark.y2 * height;
        const left = Math.min(x, x2);
        const top = Math.min(y, y2);
        const rectWidth = Math.abs(x2 - x);
        const rectHeight = Math.abs(y2 - y);
        nodes.push(`<g><rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(rectWidth)}" height="${fmt(rectHeight)}" rx="${fmt(Math.min(8,rectWidth/2,rectHeight/2))}" ry="${fmt(Math.min(8,rectWidth/2,rectHeight/2))}" fill="none" stroke="#fff" stroke-width="${fmt(stroke * 2.5)}"/><rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(rectWidth)}" height="${fmt(rectHeight)}" rx="${fmt(Math.min(8,rectWidth/2,rectHeight/2))}" ry="${fmt(Math.min(8,rectWidth/2,rectHeight/2))}" fill="none" stroke="#ef3340" stroke-width="${fmt(stroke)}"/></g>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" preserveAspectRatio="none">${nodes.join('')}</svg>`;
  }
  // Editing helpers never add fields to the persisted marker schema.
  function hitTest(marks, point, width, height) {
    const radius=Math.max(10,Math.min(width,height)*.05);
    for(let i=marks.length-1;i>=0;i--){const m=marks[i];
      if(m.type==='number'&&Math.hypot((point.x-m.x)*width,(point.y-m.y)*height)<=radius+5)return i;
      if(m.type==='rect'&&point.x>=Math.min(m.x,m.x2)-5/width&&point.x<=Math.max(m.x,m.x2)+5/width&&point.y>=Math.min(m.y,m.y2)-5/height&&point.y<=Math.max(m.y,m.y2)+5/height)return i;
    }return -1;
  }
  function translate(mark, dx, dy, width, height) {
    const m={...mark},r=m.type==='number'?Math.max(10,Math.min(width,height)*.05):0;
    const minX=m.type==='number'?m.x:Math.min(m.x,m.x2), maxX=m.type==='number'?m.x:Math.max(m.x,m.x2);
    const minY=m.type==='number'?m.y:Math.min(m.y,m.y2), maxY=m.type==='number'?m.y:Math.max(m.y,m.y2);
    dx=Math.max(r/width-minX,Math.min(1-r/width-maxX,dx));dy=Math.max(r/height-minY,Math.min(1-r/height-maxY,dy));
    m.x=Math.max(0,Math.min(1,m.x+dx));m.y=Math.max(0,Math.min(1,m.y+dy));
    if(m.type!=='number'){m.x2=Math.max(0,Math.min(1,m.x2+dx));m.y2=Math.max(0,Math.min(1,m.y2+dy));}return m;
  }
  function selectionSvg(mark,width,height){
    if(!mark)return '';const r=mark.type==='number'?Math.max(10,Math.min(width,height)*.05):0;
    const x=(mark.type==='number'?mark.x*width-r:Math.min(mark.x,mark.x2)*width)-4,y=(mark.type==='number'?mark.y*height-r:Math.min(mark.y,mark.y2)*height)-4;
    const w=(mark.type==='number'?r*2:Math.abs(mark.x2-mark.x)*width)+8,h=(mark.type==='number'?r*2:Math.abs(mark.y2-mark.y)*height)+8;
    return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="4" fill="none" stroke="#146ef5" stroke-width="2" stroke-dasharray="5 3"/>`;
  }
  function editorSvg(marks,width,height,selected){return renderSvg(marks,width,height).replace('</svg>',selectionSvg(marks[selected],width,height)+'</svg>');}
  function toolIcon(type){const shapes={fit:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="7" y="7" width="10" height="10" rx="1"/>',actual:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 10 2-2v8m5-6 2-2v8"/><circle cx="12.5" cy="11" r=".65" fill="currentColor" stroke="none"/><circle cx="12.5" cy="15" r=".65" fill="currentColor" stroke="none"/>','zoom-out':'<path d="M5 12h14"/>','zoom-in':'<path d="M5 12h14M12 5v14"/>',undo:'<path d="m8 5-5 5 5 5M3 10h10a7 7 0 0 1 7 7v2"/>',clear:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',number:'<circle cx="12" cy="12" r="9"/><path d="m10 9 2-2v10m-2 0h4"/>',arrow:'<path d="M5 19 19 5m-9 0h9v9"/>',rect:'<rect x="3" y="5" width="18" height="14" rx="3"/>'};return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(shapes[type]||'')+'</svg>';}
  return Object.freeze({ validate, renderSvg, hitTest, translate, editorSvg, toolIcon, constants: Object.freeze({ MAX_MARKS, MAX_DIMENSION }) });
});
