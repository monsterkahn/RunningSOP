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
        nodes.push(`<g><rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(rectWidth)}" height="${fmt(rectHeight)}" fill="none" stroke="#fff" stroke-width="${fmt(stroke * 2.5)}"/><rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(rectWidth)}" height="${fmt(rectHeight)}" fill="none" stroke="#ef3340" stroke-width="${fmt(stroke)}"/></g>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" preserveAspectRatio="none">${nodes.join('')}</svg>`;
  }
  return Object.freeze({ validate, renderSvg, constants: Object.freeze({ MAX_MARKS, MAX_DIMENSION }) });
});
